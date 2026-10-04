import { browser } from 'wxt/browser';
import { busyUntil, type Effect, type IdleState, type Input, isLocked, nextWake, type State, step } from '@/engine';
import { dayKey } from '@/engine/time';
import type { Message } from '@/data/client';
import { advanceClock, clockNow, toRealTime } from '@/data/clock';
import { db } from '@/data/db';
import { loadState, saveState } from '@/data/store';
import { flushSoon, track } from './analytics';
import { CALENDAR_ALARM, connectCalendar, disconnectCalendar, refreshCalendar, savedBusy } from './calendar';
import { clearNotification, notify } from './notifications';
import { HOME, MISSION, SETUP, show } from './tabs';
import { allowYouTubeEmbeds } from './youtube';

const TICK = 'tick';
const WAKE = 'wake';
/** chrome.idle's minimum: how fast a running mission notices the user leaving. */
const MISSION_DETECTION_S = 15;

let cache: State | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Seconds without input before chrome.idle reports "idle": the away threshold, or 15 s while a mission runs. */
const detectionSeconds = (s: State) =>
  s.break?.phase === 'mission' ? MISSION_DETECTION_S : s.settings.awayBreakMin * 60;

async function execute(effect: Effect, now: number): Promise<void> {
  switch (effect.type) {
    case 'log':
      await db.events.add({ ts: now, day: dayKey(now), type: effect.event, payload: effect.payload });
      // The theme is not usage worth counting
      if (!(effect.event === 'setting_changed' && effect.payload && 'theme' in effect.payload)) {
        track(effect.event, effect.payload, now);
      }
      break;
    case 'notify':
      await notify(effect.kind, effect.seatedMin);
      break;
    case 'clear_notification':
      await clearNotification(effect.kind);
      break;
    case 'open_prompt':
      await show(MISSION);
      break;
    case 'open_home':
      await show(HOME);
      break;
    case 'unlock':
      // Nothing to undo: the lock is enforced from the state, see enforceLock
      break;
  }
}

/** Keeps chrome.idle and the wake alarm in line with the state. */
async function sync(state: State): Promise<void> {
  browser.idle.setDetectionInterval(detectionSeconds(state));
  const wake = nextWake(state);
  if (wake == null) await browser.alarms.clear(WAKE);
  else await browser.alarms.create(WAKE, { when: await toRealTime(wake) });
}

async function run(input: Input, at?: number): Promise<State> {
  const now = at ?? (await clockNow());
  let prev = cache ?? (await loadState(now));
  const effects: Effect[] = [];
  // Before each tick, tell the engine whether a meeting is running: prompts and heads-ups wait for it
  if (input.type === 'tick') {
    const until = prev.settings.calendar ? busyUntil(await savedBusy(), now) : null;
    if (until !== prev.meetingUntil) {
      // A meeting ending can open the held prompt: its effects count too
      const result = step(prev, { type: 'calendar', busyUntil: until }, now);
      prev = result.state;
      effects.push(...result.effects);
    }
  }
  const { state, effects: more } = step(prev, input, now);
  effects.push(...more);
  cache = state;
  // The service worker can be stopped at any time: save before doing anything else
  await saveState(state);
  for (const effect of effects) {
    try {
      await execute(effect, now);
    } catch (error) {
      console.error('[micro.breaks] effect failed', effect, error);
    }
  }
  await sync(state);
  return state;
}

/** One input at a time, in order. */
export function dispatch(input: Input, at?: number): Promise<State> {
  const result = queue.then(() => run(input, at));
  queue = result.catch((error) => console.error('[micro.breaks] step failed', input, error));
  return result;
}

/**
 * The lock: from the prompt until the mission is completed or skipped, any tab or window switch
 * inside Chrome is sent back to the mission tab. Other apps can't be blocked.
 */
async function enforceLock(): Promise<void> {
  const state = cache ?? (await loadState(await clockNow()));
  if (!isLocked(state)) return;
  const [active] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  const url = active?.pendingUrl ?? active?.url;
  if (url === browser.runtime.getURL(MISSION)) return;
  // Test mode: the video review page stays reachable during a break
  if (import.meta.env.DEV && url === browser.runtime.getURL('/videos.html')) return;
  try {
    await show(MISSION);
  } catch {
    // Chrome refuses tab changes while the user is dragging a tab: try once more
    setTimeout(() => void show(MISSION).catch(() => {}), 200);
  }
}

/** Every 5 min while connected: fetch the busy blocks again. A failed poll keeps the last ones. */
async function pollCalendar(): Promise<void> {
  const now = await clockNow();
  const state = cache ?? (await loadState(now));
  if (!state.settings.calendar) return;
  try {
    await refreshCalendar(now);
  } catch (error) {
    console.error('[micro.breaks] calendar poll failed', error);
  }
  await dispatch({ type: 'tick' });
}

async function setCalendar(connect: boolean): Promise<string | undefined> {
  const now = await clockNow();
  if (connect) {
    const error = await connectCalendar(now);
    if (error) return error;
  } else {
    await disconnectCalendar();
  }
  await dispatch({ type: 'settings', patch: { calendar: connect } });
  await dispatch({ type: 'tick' });
}

/** Browser tests send idle changes by hand; the machine's real idle state must not interfere. */
async function realIdleIgnored(): Promise<boolean> {
  return (await browser.storage.local.get('testIgnoreIdle')).testIgnoreIdle === true;
}

/** Test mode: moves the clock forward, ticking every minute on the way like the alarm would. */
async function advance(ms: number): Promise<State> {
  const end = (await clockNow()) + ms;
  await advanceClock(ms);
  let state = cache;
  for (let t = end - ms + 60_000; t < end; t += 60_000) state = await dispatch({ type: 'tick' }, t);
  return dispatch({ type: 'tick' }, end);
}

export function start(): void {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason !== 'install') return;
    track('extension_installed');
    void show(SETUP);
  });

  browser.runtime.onStartup.addListener(() => void dispatch({ type: 'startup' }));

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CALENDAR_ALARM) void pollCalendar();
    else void dispatch({ type: 'tick' }).then(flushSoon);
  });

  browser.idle.onStateChanged.addListener((idle) => {
    void realIdleIgnored().then((ignored) => {
      if (ignored) return;
      const state = idle as IdleState;
      const idleForMs = state === 'idle' && cache ? detectionSeconds(cache) * 1000 : undefined;
      void dispatch({ type: 'idle', state, idleForMs });
    });
  });

  browser.tabs.onActivated.addListener(() => void enforceLock());
  browser.tabs.onCreated.addListener(() => void enforceLock());
  browser.tabs.onRemoved.addListener(() => void enforceLock());
  browser.tabs.onUpdated.addListener((_id, change) => {
    if (change.url) void enforceLock();
  });
  browser.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== browser.windows.WINDOW_ID_NONE) void enforceLock();
  });

  const onNotification = (id: string) => {
    void browser.notifications.clear(id);
    if (id === 'headsup') void dispatch({ type: 'start_break_now' });
    else void show(MISSION);
  };
  browser.notifications.onClicked.addListener(onNotification);
  browser.notifications.onButtonClicked.addListener(onNotification);

  browser.runtime.onMessage.addListener((message: Message, _sender, respond) => {
    if (message?.mb === 'dispatch') void dispatch(message.input).then(respond);
    else if (message?.mb === 'dev_advance') void advance(message.ms).then(respond);
    else if (message?.mb === 'calendar') void setCalendar(message.connect).then((error) => respond({ error }));
    else if (message?.mb === 'track') void clockNow().then((now) => respond(track(message.event, message.properties, now)));
    else return;
    return true;
  });

  void allowYouTubeEmbeds();

  // Every time the service worker wakes: the alarm exists, and the idle state has not changed behind our back
  void (async () => {
    if (!(await browser.alarms.get(TICK))) await browser.alarms.create(TICK, { periodInMinutes: 1 });
    if (!(await browser.alarms.get(CALENDAR_ALARM))) await browser.alarms.create(CALENDAR_ALARM, { periodInMinutes: 5 });
    const state = await dispatch({ type: 'tick' });
    // A break is still open (the extension was reloaded or updated mid-break): bring its tab back
    if (isLocked(state)) void enforceLock();
    if (await realIdleIgnored()) return;
    const idle = (await browser.idle.queryState(detectionSeconds(state))) as IdleState;
    if (idle !== state.idle) {
      await dispatch({ type: 'idle', state: idle, idleForMs: idle === 'idle' ? detectionSeconds(state) * 1000 : undefined });
    }
  })();
}
