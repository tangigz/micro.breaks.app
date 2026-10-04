import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { useEngine } from '@/data/client';
import { DevBar } from '@/ui/DevBar';
import { Frame } from '@/ui/Frame';
import { Header } from '@/ui/Header';
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

  if (!engine) return null;
  return (
    <Frame>
      <Header theme={engine.state.settings.theme} />
      <NewTab {...engine} />
      {!allowed && engine.state.setupDone && <HealthLine />}
      <DevBar {...engine} />
    </Frame>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
