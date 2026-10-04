import { type ReactNode, useEffect, useState } from 'react';

/** The design frame. A window this size shows the screens exactly as drawn. */
interface Size {
  width: number;
  height: number;
}

const DESIGN = { width: 1440, height: 900 };
/** What the content itself needs: the 1120 px column and its header, without the frame's wide margins. */
const CONTENT = { width: 1200, height: 720 };
const MAX_SCALE = 1.5;

/**
 * Bigger windows scale the whole frame up. Smaller ones first give up the margins, and only
 * shrink once the content itself no longer fits, so text stays as large as the window allows.
 */
function fit(content: Size): number {
  const { innerWidth: w, innerHeight: h } = window;
  const frame = Math.min(w / DESIGN.width, h / DESIGN.height);
  if (frame >= 1) return Math.min(frame, MAX_SCALE);
  return Math.min(1, w / content.width, h / content.height);
}

/** Screens are designed at 1440 × 900 and scaled to fit the window. */
export function Frame({ children, tall }: { children: ReactNode; tall?: boolean }) {
  // Screens that fill the frame's height (the video player) can't give up as much of it
  const content = tall ? { width: CONTENT.width, height: DESIGN.height - 20 } : CONTENT;
  const [scale, setScale] = useState(() => fit(content));

  useEffect(() => {
    const onResize = () => setScale(fit(content));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tall]);

  return (
    <div
      className="relative flex flex-col items-center overflow-hidden"
      style={{ zoom: scale, width: `${100 / scale}vw`, height: `${100 / scale}vh` }}
    >
      {children}
    </div>
  );
}
