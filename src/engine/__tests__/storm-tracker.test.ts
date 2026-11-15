import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules';
import { scoreMission } from '../score';
import { simulate } from '../simulate';
import type { Design } from '../types';
import { gameData, mod, storm, stormBuild } from './fixtures';

const good = { 'solar-storm': 'safe-mode', 'station-outage': 'slow-down', 'part-failure': 'reboot' };
const fly = (d: Design) => {
  const sim = simulate(d, storm, gameData, { seed: 4, choices: good });
  return { ev: evaluate(d, storm, gameData), sim, score: scoreMission(d, storm, gameData, sim, { allApproved: true }) };
};

describe('Storm Tracker (GEO weather satellite)', () => {
  it('wins with 3 stars on the medium rocket with both instruments', () => {
    const r = fly(stormBuild);
    expect(r.ev.ready).toBe(true);
    expect(r.sim.outcome).toBe('success');
    expect(r.score.stars).toBe(3);
    expect(r.ev.orbit!.eclipseMin).toBeGreaterThan(65); // GEO eclipses are about 70 minutes
    expect(r.ev.totals.latencyHours).toBe(0); // always in view of the ground
  });

  it('makes mass and budget the trade-off: a heavy rocket breaks the reserve', () => {
    const heavy = fly(mod(stormBuild, (d) => (d.flight.launcherId = 'heavy-rocket')));
    expect(heavy.score.stars).toBeLessThan(3);
    expect(heavy.score.roleGoals.find((g) => g.role === 'planner')!.met).toBe(false);
  });

  it('needs fuel to stay in its slot for 10 years, plus the graveyard move', () => {
    const e = fly(stormBuild).ev;
    expect(e.totals.deltaVNeedMs).toBeGreaterThan(500);
    const cubesatThruster = fly(mod(stormBuild, (d) => (d.engineer.partIds = d.engineer.partIds.map((p) => (p === 'hydrazine-system' ? 'green-thruster' : p)))));
    expect(cubesatThruster.ev.problems.find((p) => p.id === 'deltaV.short')!.why).toMatch(/stay in its slot/);
    const none = fly(mod(stormBuild, (d) => (d.engineer.partIds = d.engineer.partIds.filter((p) => p !== 'hydrazine-system'))));
    expect(none.ev.problems.find((p) => p.id === 'deltaV.no-thruster')!.why).toMatch(/GEO satellite needs thrusters/);
  });

  it('fails a sun-synchronous orbit, an S-band radio and too little solar power', () => {
    expect(fly(mod(stormBuild, (d) => { d.flight.orbitId = 'sso'; d.flight.altitudeKm = 600; })).ev.problems.some((p) => p.id === 'science.revisit')).toBe(true);
    expect(fly(mod(stormBuild, (d) => (d.flight.antennaIds = ['antenna-s']))).sim.outcome).toBe('failure');
    const small = fly(mod(stormBuild, (d) => (d.engineer.partIds = d.engineer.partIds.map((p) => (p === 'solar-array-large' ? 'solar-array' : p)).concat(['solar-array']))));
    expect(small.sim.outcome).toBe('failure');
  });

  it('only lets a real weather imager do the cloud imagery', () => {
    const e = evaluate(stormBuild, storm, gameData);
    expect(e.compat.instruments['weather-imager'].ok).toBe(true);
    expect(e.compat.instruments['multispectral-imager'].ok).toBe(false);
    const mapperOnly = fly(mod(stormBuild, (d) => (d.science.instrumentIds = ['lightning-mapper'])));
    expect(mapperOnly.score.notes.objective).toMatch(/needs clouds and moisture/);
  });
});
