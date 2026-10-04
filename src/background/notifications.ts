import { browser } from 'wxt/browser';
import type { NotificationKind } from '@/engine';

function seated(min: number): string {
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

const COPY: Record<NotificationKind, (seatedMin?: number) => { title: string; message: string; action: string }> = {
  headsup: () => ({
    title: 'Nearly time to move.',
    message: 'Get ready for your active break in 5 min.',
    action: 'Start break now',
  }),
  break: (min) => ({
    title: 'Time to move.',
    message: `${min != null ? `${seated(min)} seated. ` : ''}Your break is ready in Chrome.`,
    action: 'Start break',
  }),
  mission_done: () => ({
    title: 'Mission done. Welcome back.',
    message: 'Battery recharged.',
    action: 'Open',
  }),
};

/** Notifications stay until closed. The kind is the id, so each one replaces its predecessor. */
export async function notify(kind: NotificationKind, seatedMin?: number): Promise<void> {
  const { title, message, action } = COPY[kind](seatedMin);
  await browser.notifications.clear(kind);
  await browser.notifications.create(kind, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title,
    message,
    requireInteraction: true,
    buttons: [{ title: action }],
  });
}

export async function clearNotification(kind: NotificationKind): Promise<void> {
  await browser.notifications.clear(kind);
}
