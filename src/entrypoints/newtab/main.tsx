import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { send, useEngine } from '@/data/client';
import { DevBar } from '@/ui/DevBar';
import { Frame } from '@/ui/Frame';
import { Header } from '@/ui/Header';
import { Recharged, rechargedEyebrow } from '@/ui/Recharged';
import { applySavedTheme, applyTheme } from '@/ui/theme';
import { mount } from '@/ui/mount';
import '@/ui/tokens.css';
import { HealthLine, NewTab } from './NewTab';
import { askForNotifications, notificationsAllowed } from '@/data/notifications';
import { useStored } from '@/data/stored';

applySavedTheme();

/** False when micro.breaks may not show notifications: not allowed yet, or blocked in Chrome. */
function useNotificationsAllowed(): [boolean, () => void] {
  const [allowed, setAllowed] = useState(true);
  const check = () => void notificationsAllowed().then(setAllowed);
  useEffect(() => {
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [allowed, check];
}

/**
 * "Turn on": Chrome's prompt, right here. Granted but blocked in Chrome's own settings, the prompt
 * can't help: the settings page opens instead.
 */
async function turnOnNotifications(recheck: () => void): Promise<void> {
  if (!(await askForNotifications())) return;
  if (!(await notificationsAllowed())) await browser.tabs.create({ url: 'chrome://settings/content/notifications' });
  // "Not now" on the welcome screen no longer holds: its step reads as done with notifications
  const { setup } = await browser.storage.local.get('setup');
  if ((setup as { notify?: number } | undefined)?.notify === 2) {
    await browser.storage.local.set({ setup: { ...(setup as object), notify: 1 } });
  }
  recheck();
}

function App() {
  const engine = useEngine();
  const [allowed, recheckNotifications] = useNotificationsAllowed();
  const [healthDismissed, setHealthDismissed] = useStored('healthLineDismissed', false);
  const theme = engine?.state.settings.theme;

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  // Until the welcome flow is finished, every new tab is the welcome flow
  const needsSetup = engine != null && !engine.state.setupDone;
  useEffect(() => {
    if (needsSetup) location.replace('/setup.html');
  }, [needsSetup]);

  if (!engine || needsSetup) return null;
  // A recharge earned away from the prompt (a coffee, "Yes, I moved") plays once, then the normal new tab
  const { outcome } = engine.state;
  const recharged = outcome != null && outcome.kind !== 'skipped' && !engine.state.break;
  return (
    <Frame>
      <Header theme={engine.state.settings.theme} />
      {recharged ? (
        <Recharged eyebrow={rechargedEyebrow(outcome.kind)} onDone={() => void send({ type: 'outcome_seen' })} />
      ) : (
        <NewTab {...engine} />
      )}
      {!allowed && engine.state.setupDone && healthDismissed === false && (
        <HealthLine onTurnOn={() => void turnOnNotifications(recheckNotifications)} onDismiss={() => setHealthDismissed(true)} />
      )}
      <DevBar {...engine} />
    </Frame>
  );
}

mount(<App />);
