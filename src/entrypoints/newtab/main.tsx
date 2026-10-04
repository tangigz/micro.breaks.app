import { createRoot } from 'react-dom/client';
import { useEngine } from '@/data/client';
import { DevBar } from '@/ui/DevBar';
import '@/ui/tokens.css';

function NewTab() {
  const engine = useEngine();
  return (
    <>
      <header className="flex items-center justify-between px-10 py-6">
        <div className="text-[20px] font-bold tracking-[-0.01em]">
          micro<span className="text-pos">.</span>breaks
        </div>
      </header>
      {engine && <DevBar {...engine} />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<NewTab />);
