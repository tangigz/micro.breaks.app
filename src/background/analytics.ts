import { browser } from 'wxt/browser';
import { POSTHOG_HOST, POSTHOG_KEY } from '@/config';

/**
 * Usage events for the test phase, sent to PostHog's HTTP API. No SDK: extensions can't load
 * remote scripts. Only what micro.breaks itself does is sent: never tabs, URLs or calendar content.
 */

/** The shortlist. Anything else the app logs stays in the local event log only. */
const SENT = new Set([
  'extension_installed',
  'setup_step_done',
  'setup_completed',
  'mission_started',
  'mission_completed',
  'skip_challenge_shown',
  'skip_passed',
  'setting_changed',
]);

const QUEUE_KEY = 'analyticsQueue';
const TESTER_KEY = 'tester';
/** Browser tests: events stay in the queue, where the tests read them. Nothing is sent. */
const TEST_KEY = 'testAnalytics';
const MAX_QUEUED = 500;
const FLUSH_DELAY_MS = 5000;

interface Tester {
  /** Random, made at install. The identity events are attached to. */
  id: string;
  /** Given on the welcome screen, so the author can tell testers apart. */
  email?: string;
}

interface Queued {
  event: string;
  distinct_id: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

async function tester(): Promise<Tester> {
  const saved = (await browser.storage.local.get(TESTER_KEY))[TESTER_KEY] as Partial<Tester> | undefined;
  if (saved?.id) return saved as Tester;
  const made: Tester = { ...saved, id: crypto.randomUUID() };
  await browser.storage.local.set({ [TESTER_KEY]: made });
  return made;
}

let queue: Promise<unknown> = Promise.resolve();
let timer: ReturnType<typeof setTimeout> | undefined;

async function add(event: string, properties: Record<string, unknown>, at: number): Promise<void> {
  const who = await tester();
  const item: Queued = {
    event,
    distinct_id: who.id,
    timestamp: new Date(at).toISOString(),
    properties: {
      ...properties,
      version: browser.runtime.getManifest().version,
      // Shows the tester's email on their PostHog profile
      ...(who.email ? { $set: { email: who.email } } : {}),
    },
  };
  const saved = ((await browser.storage.local.get(QUEUE_KEY))[QUEUE_KEY] as Queued[] | undefined) ?? [];
  await browser.storage.local.set({ [QUEUE_KEY]: [...saved, item].slice(-MAX_QUEUED) });
}

/** Sends what is queued. Kept for the next try when offline or refused. */
async function flush(): Promise<void> {
  const stored = await browser.storage.local.get([QUEUE_KEY, TEST_KEY]);
  const batch = (stored[QUEUE_KEY] as Queued[] | undefined) ?? [];
  if (!batch.length || !POSTHOG_KEY || stored[TEST_KEY] || import.meta.env.DEV) return;
  try {
    const response = await fetch(`${POSTHOG_HOST}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: POSTHOG_KEY, batch }),
    });
    if (!response.ok) return;
  } catch {
    return;
  }
  // Drop what was sent; keep anything queued meanwhile
  const now = ((await browser.storage.local.get(QUEUE_KEY))[QUEUE_KEY] as Queued[] | undefined) ?? [];
  await browser.storage.local.set({ [QUEUE_KEY]: now.slice(batch.length) });
}

/** Records one event. `at` is the extension's own clock, so test-mode time travel is kept. */
export function track(event: string, properties: Record<string, unknown> = {}, at: number = Date.now()): void {
  if (!SENT.has(event)) return;
  queue = queue.then(() => add(event, properties, at)).catch((error) => console.error('[micro.breaks] analytics', error));
  clearTimeout(timer);
  timer = setTimeout(() => flushSoon(), FLUSH_DELAY_MS);
}

/** Also called on every tick, in case the service worker was stopped before the delay ran out. */
export function flushSoon(): void {
  queue = queue.then(flush).catch(() => {});
}
