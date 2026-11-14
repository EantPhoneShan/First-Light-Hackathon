import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, scheduleEvents } from '../events';
import { chooseEvent, choicesOf, createSim, finishSim, initialState, pendingEventCard, simulate, stepSim } from '../simulate';
import type { Design } from '../types';
import { fixed, gameData, mod, tutorial, wildfire } from './fixtures';

const YEAR = 365.25 * 1440;

/** Plays a flight live in chunks, answering each event card with pick(). */
function playLive(design: Design, seed: number, chunk: number, pick: (ids: string[]) => string = (ids) => ids[0]) {
  const setup = createSim(design, wildfire, gameData, { seed });
  const s = initialState(setup);
  for (let guard = 0; !s.done && guard < 1e7; guard++) {
    stepSim(s, setup, chunk);
    const card = pendingEventCard(s, setup);
    if (card) chooseEvent(s, setup, pick(card.choices.map((c) => c.id)));
  }
  return finishSim(s, setup);
}

describe('simulation', () => {
  it('kills the tutorial craft 29 minutes into its first eclipse', () => {
    const r = simulate(tutorial, wildfire, gameData);
    expect(r.outcome).toBe('failure');
    expect(r.survivedMin).toBeGreaterThan(55);
    expect(r.survivedMin).toBeLessThan(65);
    const dead = r.markers.find((m) => m.kind === 'battery-dead')!;
    expect(dead.why).toMatch(/29 minutes into the 35-minute eclipse on orbit 1/);
    expect(dead.partIds).toEqual(['battery-small']);
  });

  it('flies the fixed craft for the whole 3 years and delivers its data', () => {
    const r = simulate(fixed, wildfire, gameData);
    expect(r.outcome).toBe('success');
    expect(r.survivedMin).toBeCloseTo(3 * YEAR, 0);
    expect(r.summary.deliveredPct).toBeGreaterThan(95);
    expect(r.summary.firstLightMin).not.toBeNull();
    expect(r.summary.disposal).toBe('ok');
  });

  it('burns up early in the Space Station orbit', () => {
    const r = simulate(mod(fixed, (d) => { d.flight.orbitId = 'iss'; d.flight.altitudeKm = 400; d.flight.launcherId = 'iss-deploy'; }), wildfire, gameData);
    expect(r.summary.reenteredAtMin! / YEAR).toBeCloseTo(1.2, 1);
  });

  it('kills a thin-margin craft late, once its panels wear out', () => {
    const r = simulate(mod(fixed, (d) => (d.engineer.partIds[4] = 'reaction-wheel')), wildfire, gameData);
    expect(r.outcome).toBe('partial');
    expect(r.markers.find((m) => m.kind === 'battery-dead')!.why).toMatch(/worn down/);
  });

  it('flies exactly the same mission live at any speed as in one go', () => {
    for (const design of [tutorial, fixed]) {
      const once = simulate(design, wildfire, gameData, { seed: 7 });
      // A small odd step on the short tutorial flight, bigger steps on the 3-year one.
      for (const chunk of design === tutorial ? [0.37, 95.5] : [7.3, 95.5, 10_000]) {
        const live = playLive(design, 7, chunk);
        expect(live.survivedMin).toBe(once.survivedMin);
        expect(live.summary.deliveredMB).toBe(once.summary.deliveredMB);
        expect(live.frames.length).toBe(once.frames.length);
      }
    }
  });

  it('launch-fails a design that cannot be built', () => {
    const r = simulate(mod(fixed, (d) => d.engineer.partIds.push('cold-gas-thruster')), wildfire, gameData);
    expect(r.outcome).toBe('launch-failure');
    expect(r.frames).toEqual([]);
  });
});

describe('random events', () => {
  const mission = 3 * YEAR;

  it('are the same for the same seed and spread through the mission', () => {
    const a = scheduleEvents(5, wildfire, gameData.events, mission);
    expect(a).toEqual(scheduleEvents(5, wildfire, gameData.events, mission));
    expect(a).toHaveLength(3);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].tMin).toBeGreaterThanOrEqual(3 * 1440);
      expect(a[i].tMin).toBeLessThanOrEqual(mission * 0.9);
      if (i > 0) expect(a[i].tMin).toBeGreaterThan(a[i - 1].tMin);
    }
    const others = [1, 2, 3, 4].map((s) => JSON.stringify(scheduleEvents(s, wildfire, gameData.events, mission)));
    expect(new Set(others).size).toBeGreaterThan(1);
  });

  it('use a repeatable random generator', () => {
    const r1 = mulberry32(hashSeed(9, 'x'));
    const r2 = mulberry32(hashSeed(9, 'x'));
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });

  it('pause the flight until the owner chooses, then replay identically', () => {
    for (const seed of [1, 7]) {
      const live = playLive(fixed, seed, 777.7, (ids) => ids[ids.length - 1]);
      expect(live.events).toHaveLength(3);
      const replay = simulate(fixed, wildfire, gameData, { seed, choices: choicesOf(live) });
      expect(replay.events).toEqual(live.events);
      expect(replay.summary.deliveredMB).toBe(live.summary.deliveredMB);
      expect(replay.survivedMin).toBe(live.survivedMin);
    }
  });

  it('can be turned off (tutorial)', () => {
    expect(simulate(fixed, wildfire, gameData, { events: false }).events).toEqual([]);
  });

  it('safe mode protects the craft; keep working can damage it', () => {
    const safe = simulate(fixed, wildfire, gameData, { seed: 1, choices: { 'solar-storm': 'safe-mode' } });
    expect(safe.events.find((e) => e.eventId === 'solar-storm')).toMatchObject({ good: true, hit: false });
    const risky = simulate(fixed, wildfire, gameData, { seed: 1, choices: { 'solar-storm': 'keep-working' } });
    const rec = risky.events.find((e) => e.eventId === 'solar-storm')!;
    expect(rec.good).toBe(false);
    if (rec.hit) expect(risky.summary.solarHealthPct).toBeLessThan(safe.summary.solarHealthPct);
  });
});
