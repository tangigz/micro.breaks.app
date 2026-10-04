import { createRoot } from 'react-dom/client';
import '@/ui/tokens.css';

function NewTab() {
  return (
    <header className="flex items-center justify-between px-10 py-6">
      <div className="text-[20px] font-bold tracking-[-0.01em]">
        micro<span className="text-pos">.</span>breaks
      </div>
    </header>
  );
}

createRoot(document.getElementById('root')!).render(<NewTab />);
