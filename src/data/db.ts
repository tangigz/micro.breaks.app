import Dexie, { type Table } from 'dexie';
import type { EventType } from '@/engine';

export interface LogEvent {
  id?: number;
  ts: number;
  day: string;
  type: EventType;
  payload?: Record<string, unknown>;
}

/** Append-only log of everything. Every number shown later is derived from it. */
class Db extends Dexie {
  events!: Table<LogEvent, number>;

  constructor() {
    super('micro.breaks');
    this.version(1).stores({ events: '++id, ts, day, type' });
  }
}

export const db = new Db();
