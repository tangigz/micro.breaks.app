import { batteryRgb } from './battery-color';

interface BatteryLook {
  /** 0–100. */
  level: number;
  /** Grey: not tracking right now (before hours, done, days off). */
  idle?: boolean;
}

export const rgb = ({ level, idle }: BatteryLook) => (idle ? 'var(--grey)' : batteryRgb(level).join(' '));

/** 1100 px glow behind the battery, in the battery's colour. Grows stronger as the level drops. */
export function Halo({ level, idle, dim }: BatteryLook & { dim?: boolean }) {
  const t = 1 - level / 100;
  const alpha = idle ? 'var(--grey-glow)' : `calc(var(--glow-min) + (var(--glow-max) - var(--glow-min)) * ${t.toFixed(3)})`;
  const color = rgb({ level, idle });
  return (
    <div
      aria-hidden="true"
      className="absolute top-[378px] left-[270px] -mt-[550px] -ml-[550px] size-[1100px] rounded-full transition-opacity duration-400"
      style={{
        opacity: dim ? 0.3 : 1,
        background: `radial-gradient(closest-side, rgb(${color} / ${alpha}), rgb(${color} / 0))`,
      }}
    />
  );
}

/** Drains with time seated; colour follows the level. 220 × 440, 6 px outline, 12 px inset. */
export function Battery({ level, idle, still, dim, label }: BatteryLook & { still?: boolean; dim?: boolean; label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 transition-opacity duration-400"
      style={{ opacity: dim ? 0.3 : 1 }}
    >
      <div className="h-4 w-[72px] rounded-t-[10px] bg-ink" />
      <div
        role="img"
        aria-label={label}
        className="flex h-[440px] w-[220px] flex-col justify-end rounded-[48px] border-[6px] border-ink p-3"
      >
        <div
          className={`relative min-h-6 w-full overflow-hidden rounded-[32px] transition-[height,background-color] duration-1000 ease-linear ${still ? '' : 'battery-breathe'}`}
          style={{ height: `${level}%`, backgroundColor: `rgb(${rgb({ level, idle })})` }}
        >
          {!still && (
            <div className="battery-shine absolute inset-x-0 bottom-0 h-[30%] bg-linear-to-t from-white/0 via-white/35 to-white/0" />
          )}
        </div>
      </div>
    </div>
  );
}
