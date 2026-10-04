import { type ReactNode, useEffect, useState } from 'react';

const WIDTH = 1440;
const HEIGHT = 900;

const fit = () => Math.min(1, window.innerWidth / WIDTH, window.innerHeight / HEIGHT);

/** Screens are designed at 1440 × 900. Smaller windows get the same layout, scaled down. */
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
