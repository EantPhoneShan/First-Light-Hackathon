/**
 * Random events (task 1.9, PRD F15): when they happen and how chance is rolled.
 *
 * Everything comes from the room's shared seed (room.seed in src/sync), so
 * every device and the score Lambda get the same events at the same times and
 * the same lucky or unlucky rolls. The simulation applies the choices
 * (see chooseEvent in simulate.ts).
 *
 * Uses a small built-in generator (mulberry32) instead of the seedrandom
 * package, so no new dependency is needed; it is just as repeatable.
 */
import type { EventChoice, GameEvent, Scenario, ScheduledEvent } from './types';

/** Tuning knobs for balancing (task 1.15). */
export const EVENTS = {
  /** Most events per flight (PRD: 3). */
  maxPerFlight: 3,
  /** No events before this (let the craft settle in), in minutes. */
  earliestMin: 3 * 1440,
  /** No events after this share of the mission. */
  latestShare: 0.9,
  /** Least time between two events, in minutes. */
  minGapMin: 5 * 1440,
};

/** Small, fast, repeatable random numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes a seed with a label, so each use gets its own repeatable stream. */
export function hashSeed(seed: number, label: string): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Picks which events happen and when, for one flight. */
export function scheduleEvents(seed: number, scenario: Scenario, events: GameEvent[], missionMin: number): ScheduledEvent[] {
  const rand = mulberry32(hashSeed(seed, `schedule:${scenario.id}`));
  const pool = events.filter((e) => scenario.eventsAllowed.includes(e.id));
  // Shuffle (Fisher-Yates) so the order and the pick vary by seed.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const start = EVENTS.earliestMin;
  const end = missionMin * EVENTS.latestShare;
  if (end <= start) return [];
  const picked = pool.slice(0, EVENTS.maxPerFlight);
  // Spread events over the mission: one per equal slice, at a random point in it.
  const slice = (end - start) / Math.max(1, picked.length);
  return picked.map((e, i) => {
    const lo = start + i * slice;
    const hi = lo + Math.max(0, slice - EVENTS.minGapMin);
    return { eventId: e.id, tMin: Math.round(lo + rand() * (hi - lo)) };
  });
}

/** True when a choice's harmful effect happens (same answer on every device). */
export function rollChance(seed: number, ev: ScheduledEvent, choice: EventChoice): boolean {
  const chance = choice.effects.chance;
  if (chance === undefined) return true;
  return mulberry32(hashSeed(seed, `roll:${ev.eventId}:${ev.tMin}:${choice.id}`))() < chance;
}

/** Facts about the craft needed to judge "it depends" choices. */
export interface ChoiceFacts {
  freeStorageMB: number;
  dataPerMin: number;
}

/** Was this a good choice, given the craft's situation right now? */
export function judgeChoice(choice: EventChoice, facts: ChoiceFacts): boolean {
  if (typeof choice.good === 'boolean') return choice.good;
  // 'if-storage-holds': storing data through an outage is only wise if it fits.
  const outageMin = (choice.effects.stationOutageHours ?? 0) * 60;
  return facts.freeStorageMB >= facts.dataPerMin * outageMin;
}
