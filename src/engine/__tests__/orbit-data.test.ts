import { describe, expect, it } from 'vitest';
import { checkReferences } from '../data';
import { decayYears, eclipseFraction, lowerPerigeeDeltaV, periodMin, rocketDeltaV, safeDecayAltitudeKm } from '../orbit';
import { gameData } from './fixtures';

describe('orbit maths', () => {
  it('gives the textbook orbit periods', () => {
    expect(periodMin(400)).toBeCloseTo(92.6, 0); // Space Station altitude
    expect(periodMin(35786)).toBeCloseTo(1436, -1); // GEO: one sidereal day
  });

  it('gives believable eclipse lengths', () => {
    expect(eclipseFraction(400, 0) * periodMin(400)).toBeCloseTo(36, 0); // about 36 min in LEO
    expect(eclipseFraction(35786, 0) * periodMin(35786)).toBeGreaterThan(65); // about 70 min at GEO
    expect(eclipseFraction(35786, 0) * periodMin(35786)).toBeLessThan(75);
    expect(eclipseFraction(550, 20)).toBeLessThan(eclipseFraction(550, 0)); // sun angle shortens it
  });

  it('interpolates the decay table and keeps it rising with altitude', () => {
    expect(decayYears(550, gameData.decay)).toBeCloseTo(12, 5);
    expect(decayYears(575, gameData.decay)).toBeGreaterThan(12);
    expect(decayYears(575, gameData.decay)).toBeLessThan(25);
    expect(decayYears(35786, gameData.decay)).toBe(Infinity);
    expect(safeDecayAltitudeKm(25, gameData.decay)).toBe(600);
  });

  it('follows the rocket equation and needs no burn to go up', () => {
    expect(rocketDeltaV(65, 4.95, 0.4)).toBeCloseTo(53.7, 0);
    expect(rocketDeltaV(65, 4, 0)).toBe(0);
    expect(lowerPerigeeDeltaV(500, 600)).toBe(0);
    expect(lowerPerigeeDeltaV(650, 600)).toBeGreaterThan(10);
  });
});

describe('data files', () => {
  it('have no broken ids or references', () => {
    expect(checkReferences(gameData)).toEqual([]);
  });

  it('give every entry a tooltip, a known source and an icon', () => {
    const sources = new Set(gameData.sources.map((s) => s.id));
    const rows = [...gameData.parts, ...gameData.buses, ...gameData.launchers, ...gameData.orbits, ...gameData.stations, ...gameData.scenarios];
    for (const r of rows) {
      expect(r.tooltip, r.id).toBeTruthy();
      expect(sources.has(r.source), `${r.id} source`).toBe(true);
    }
    for (const r of [...gameData.parts, ...gameData.buses, ...gameData.launchers, ...gameData.stations]) expect(r.icon, r.id).toMatch(/^(part|rocket|scene)-/);
  });

  it('has no negative numbers in parts', () => {
    for (const p of gameData.parts) {
      for (const k of ['massKg', 'powerW', 'costM', 'buildMonths', 'slots'] as const) expect(p[k], `${p.id}.${k}`).toBeGreaterThanOrEqual(0);
      expect(p.reliability).toBeGreaterThan(0);
      expect(p.reliability).toBeLessThanOrEqual(1);
    }
  });

  it('uses CubeSat 101 mass for the 6U bus (6 x 1.33 kg)', () => {
    expect(gameData.buses.find((b) => b.id === 'bus-cubesat-6u')!.maxMassKg).toBe(8);
  });
});
