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
    notifications(): Promise<string[]>;
    events(): Promise<string[]>;
  };
}

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
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
    await use(page);
  },
  engine: async ({ home }, use) => {
    const message = <T>(m: unknown) => home.evaluate((msg) => chrome.runtime.sendMessage(msg), m) as Promise<T>;
    await use({
      send: (input) => message({ mb: 'dispatch', input }),
      advance: (min) => message({ mb: 'dev_advance', ms: min * 60_000 }),
      notifications: () =>
        home.evaluate(() => new Promise<string[]>((r) => chrome.notifications.getAll((all) => r(Object.keys(all))))),
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
