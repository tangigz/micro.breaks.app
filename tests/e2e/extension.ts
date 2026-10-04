import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import type { Input, State } from '../../src/engine';

const EXTENSION = path.resolve('.output/chrome-mv3');

interface Fixtures {
  context: BrowserContext;
  extensionId: string;
  /** A micro.breaks page, used to talk to the background. */
  home: Page;
  engine: {
    send(input: Input): Promise<State>;
    /** Test mode: moves the clock forward. */
    advance(min: number): Promise<State>;
    /** Test mode: jumps to a local date and time (in the future), without ticking on the way. */
    setClock(year: number, month: number, day: number, hour: number, minute?: number): Promise<void>;
    /** Jumps forward without ticking, as if Chrome had been closed. */
    jump(min: number): Promise<void>;
    /** Setup done, working hours as in the spec, user active. */
    begin(): Promise<State>;
    notifications(): Promise<string[]>;
    events(): Promise<string[]>;
    /** The usage events queued for PostHog. */
    tracked(): Promise<{ event: string; distinct_id: string; properties: Record<string, unknown> }[]>;
  };
}

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      viewport: { width: 1440, height: 900 },
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(new URL(worker.url()).host);
  },
  home: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await page.waitForURL(/setup\.html$/);
    // Idle changes are sent by the tests; the real state of this machine must not interfere
    // Usage events are kept in the queue for the tests to read, and never sent
    await page.evaluate(() => chrome.storage.local.set({ testIgnoreIdle: true, testAnalytics: true }));
    await use(page);
  },
  engine: async ({ home }, use) => {
    const message = <T>(m: unknown) => home.evaluate((msg) => chrome.runtime.sendMessage(msg), m) as Promise<T>;
    const send = (input: Input) => message<State>({ mb: 'dispatch', input });
    await use({
      send,
      setClock: (year, month, day, hour, minute = 0) =>
        home.evaluate(
          (target) => chrome.storage.local.set({ devOffsetMs: target - Date.now() }),
          new Date(year, month - 1, day, hour, minute).getTime(),
        ),
      jump: (min) =>
        home.evaluate(async (ms) => {
          const { devOffsetMs = 0 } = await chrome.storage.local.get('devOffsetMs');
          await chrome.storage.local.set({ devOffsetMs: (devOffsetMs as number) + ms });
        }, min * 60_000),
      begin: async () => {
        await send({ type: 'setup_done' });
        const state = await send({ type: 'idle', state: 'active' });
        // Before setup the new tab hands over to the welcome flow: load it again now
        await home.goto(home.url().replace(/[^/]+$/, 'newtab.html'));
        return state;
      },
      advance: (min) => message({ mb: 'dev_advance', ms: min * 60_000 }),
      notifications: () =>
        home.evaluate(() => new Promise<string[]>((r) => chrome.notifications.getAll((all) => r(Object.keys(all))))),
      tracked: async () => {
        // Events are queued a moment after they happen
        await home.waitForTimeout(300);
        return home.evaluate(async () => ((await chrome.storage.local.get('analyticsQueue')).analyticsQueue ?? []) as never);
      },
      events: () =>
        home.evaluate(
          () =>
            new Promise<string[]>((resolve, reject) => {
              const open = indexedDB.open('micro.breaks');
              open.onerror = () => reject(open.error);
              open.onsuccess = () => {
                const all = open.result.transaction('events').objectStore('events').getAll();
                all.onsuccess = () => resolve(all.result.map((e: { type: string }) => e.type));
              };
            }),
        ),
    });
  },
});

export { expect } from '@playwright/test';
