import { useEffect } from 'react';
import { openPage, send, useEngine } from '@/data/client';
import { Popup, type PopupTarget } from '@/ui/Popup';
import { mount } from '@/ui/mount';
import { applySavedTheme, applyTheme } from '@/ui/theme';
import { useToolbarView } from '@/ui/useToolbarView';
import '@/ui/tokens.css';

applySavedTheme();

/** Every action leaves the popup: Chrome closes it once the focus moves anyway. */
async function act(target: PopupTarget): Promise<void> {
  if (target === 'moved' || target === 'kept_working') await send({ type: 'gap_answer', moved: target === 'moved' });
  else await openPage(target);
  window.close();
}

function Live({ engine }: { engine: NonNullable<ReturnType<typeof useEngine>> }) {
  const view = useToolbarView(engine.state, engine.now);
  return <Popup view={view} settings={engine.state.settings} now={engine.now} act={(t) => void act(t)} />;
}

function App() {
  const engine = useEngine();
  const theme = engine?.state.settings.theme;
  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);
  return engine ? <Live engine={engine} /> : null;
}

mount(<App />);
