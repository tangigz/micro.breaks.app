import { type ReactNode, useEffect, useState } from 'react';

/** The design frame. A window this size shows the screens exactly as drawn. */
const DESIGN = { width: 1440, height: 900 };
/** What the content itself needs: the 1120 px column and its header, without the frame's wide margins. */
const CONTENT = { width: 1200, height: 720 };
const MAX_SCALE = 1.5;

/**
 * Bigger windows scale the whole frame up. Smaller ones first give up the margins, and only
 * shrink once the content itself no longer fits, so text stays as large as the window allows.
 */
function fit(): number {
  const { innerWidth: w, innerHeight: h } = window;
  const frame = Math.min(w / DESIGN.width, h / DESIGN.height);
  if (frame >= 1) return Math.min(frame, MAX_SCALE);
  return Math.min(1, w / CONTENT.width, h / CONTENT.height);
}

/** Screens are designed at 1440 × 900 and scaled to fit the window. */
export function Frame({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(fit);

  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div
      className="relative flex flex-col items-center overflow-hidden"
      style={{ zoom: scale, width: `${100 / scale}vw`, height: `${100 / scale}vh` }}
    >
      {children}
    </div>
  );
}
