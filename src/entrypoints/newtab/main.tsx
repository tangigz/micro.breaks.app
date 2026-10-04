import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { send, useEngine } from '@/data/client';
import { DevBar } from '@/ui/DevBar';
import { Frame } from '@/ui/Frame';
import { Header } from '@/ui/Header';
import { Recharged, rechargedEyebrow } from '@/ui/Recharged';
import { applySavedTheme, applyTheme } from '@/ui/theme';
import '@/ui/tokens.css';
import { HealthLine, NewTab } from './NewTab';

applySavedTheme();

/** False when Chrome's notifications are blocked for micro.breaks. */
function useNotificationsAllowed(): boolean {
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    const check = () => void browser.notifications.getPermissionLevel().then((level) => setAllowed(level === 'granted'));
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);
  return allowed;
}

function App() {
  const engine = useEngine();
  const allowed = useNotificationsAllowed();
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
      {!allowed && engine.state.setupDone && <HealthLine />}
      <DevBar {...engine} />
    </Frame>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
