import { useEffect } from 'react';
import { useEngine } from '@/data/client';
import { DevBar } from '@/ui/DevBar';
import { Frame } from '@/ui/Frame';
import { Header } from '@/ui/Header';
import { TimerSentence } from '@/ui/TimerSentence';
import { applySavedTheme, applyTheme } from '@/ui/theme';
import { mount } from '@/ui/mount';
import '@/ui/tokens.css';

applySavedTheme();

function MovementTimer() {
  const engine = useEngine();
  const theme = engine?.state.settings.theme;

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  if (!engine) return null;
  const { settings } = engine.state;

  return (
    <Frame>
      <Header theme={settings.theme} back="/newtab.html" />
      <main className="flex w-[1040px] grow flex-col items-center justify-center gap-6 pb-14">
        <div className="text-[13px] leading-4 font-medium tracking-[0.08em] text-ink-2 uppercase">Your movement timer</div>
        <TimerSentence settings={settings} />
      </main>
      <DevBar {...engine} />
    </Frame>
  );
}

mount(<MovementTimer />);
