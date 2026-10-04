import data from '../../content/missions.json';
import { shuffle } from './rng';
import type { State } from './types';

export interface Video {
  id: string;
  /** Trim points in seconds. Null until they are set. */
  start: number | null;
  end: number | null;
}

export interface Mission {
  id: string;
  name: string;
  cue: string;
  img: string;
  tile: string;
  videos?: Video[];
}

export const MISSIONS: Mission[] = data.missions;

export function mission(id: string): Mission {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown mission: ${id}`);
  return m;
}

/** Next mission from the shuffled deck. No repeat until all have come up. */
export function draw(s: State): string {
  if (s.deck.length === 0) {
    s.deck = shuffle(
      s,
      MISSIONS.map((m) => m.id),
    );
    if (s.deck.length > 1 && s.deck[0] === s.lastMissionId) {
      [s.deck[0], s.deck[1]] = [s.deck[1]!, s.deck[0]!];
    }
  }
  const id = s.deck.shift()!;
  s.lastMissionId = id;
  return id;
}
