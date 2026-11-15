import { browser } from 'wxt/browser';

/**
 * Notifications are an optional permission: Chrome asks for it on the welcome screen's "Allow",
 * after micro.breaks has said why, not in the install dialog. Until it is granted,
 * chrome.notifications does not exist.
 */
const NOTIFICATIONS = { permissions: ['notifications'] } as Parameters<typeof browser.permissions.request>[0];

/** Browser tests: behave as if the user had declined (their build has notifications granted at install). */
const TEST_DECLINED_KEY = 'testNotificationsDeclined';

async function declinedInTests(): Promise<boolean> {
  return (await browser.storage.local.get(TEST_DECLINED_KEY))[TEST_DECLINED_KEY] === true;
}

/** True once the user has allowed notifications for micro.breaks. */
export async function notificationsGranted(): Promise<boolean> {
  if (await declinedInTests()) return false;
  return browser.permissions.contains(NOTIFICATIONS);
}

/** True when micro.breaks may show notifications: the permission is granted and not blocked in Chrome. */
export async function notificationsAllowed(): Promise<boolean> {
  if (!(await notificationsGranted())) return false;
  return (await browser.notifications.getPermissionLevel()) === 'granted';
}

/** Shows Chrome's prompt. Must run straight from a click. Resolves true at once if already granted. */
export async function askForNotifications(): Promise<boolean> {
  // First, with nothing awaited before it: Chrome only shows the prompt straight after a click
  const granted = await browser.permissions.request(NOTIFICATIONS);
  // Browser tests: as if the user clicked "Deny" in Chrome's prompt
  return granted && !(await declinedInTests());
}
