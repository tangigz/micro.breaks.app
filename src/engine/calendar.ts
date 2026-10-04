/** A busy block from the calendar, as timestamps. */
export type Busy = [start: number, end: number];

/**
 * When the meeting running at `now` ends, or null if none is. Back-to-back and overlapping
 * meetings count as one: the prompt waits until the last of them is over.
 */
export function busyUntil(busy: readonly Busy[], now: number): number | null {
  let until: number | null = null;
  let at = now;
  for (const [start, end] of [...busy].sort((a, b) => a[0] - b[0])) {
    if (start <= at && end > at) {
      until = end;
      at = end;
    }
  }
  return until;
}
