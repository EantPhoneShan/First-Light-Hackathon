import { describe, expect, it } from 'vitest';
import { emptyDesign, normalizeDesign } from '../design';
import { evaluate } from '../rules';
import { fixed, gameData, mod, multispectral, tutorial, wildfire } from './fixtures';

const ev = (d = fixed) => evaluate(d, wildfire, gameData);

describe('rules engine', () => {
  it('blocks an empty design with a reason for each missing choice', () => {
    const e = ev(emptyDesign());
    expect(e.canLaunch).toBe(false);
    expect(e.problems.filter((p) => p.blocking).map((p) => p.id)).toEqual(
      expect.arrayContaining(['missing.bus', 'missing.orbit', 'missing.launcher', 'missing.antenna']),
    );
  });

  it('finds exactly one red problem in the tutorial craft: the battery', () => {
    const e = ev(tutorial);
    expect(e.canLaunch).toBe(true); // it may fly, and fail in flight
    expect(e.problems.filter((p) => p.status === 'fail').map((p) => p.id)).toEqual(['power.battery']);
    expect(e.problems[0].why).toMatch(/runs out 29 minutes into the 35-minute eclipse/);
    expect(e.problems[0].partIds).toEqual(['battery-small']);
  });

  it('passes the fixed craft and the multispectral craft', () => {
    expect(ev(fixed).ready).toBe(true);
    expect(ev(multispectral).ready).toBe(true);
    expect(ev(fixed).gauges.power.status).toBe('ok');
  });

  it('blocks parts that do not fit and too many parts', () => {
    const e = ev(mod(fixed, (d) => d.science.instrumentIds.push('radar')));
    expect(e.canLaunch).toBe(false);
    expect(e.problems.some((p) => p.id === 'fit.slots')).toBe(true);
    expect(e.problems.some((p) => p.id === 'fit.size.radar')).toBe(true);
  });

  it('says when solar panels are maxed out', () => {
    const e = ev(mod(fixed, (d) => (d.flight.antennaIds = ['antenna-x'])));
    const p = e.problems.find((x) => x.id === 'power.average')!;
    expect(p.hint).toMatch(/maxed out/);
  });

  it('fails a low orbit on lifetime and revisit, and flags debris above 600 km', () => {
    const iss = ev(mod(fixed, (d) => { d.flight.orbitId = 'iss'; d.flight.altitudeKm = 400; d.flight.launcherId = 'iss-deploy'; }));
    expect(iss.problems.map((p) => p.id)).toEqual(expect.arrayContaining(['lifetime.decay', 'science.revisit', 'comms.no-link']));
    const high = ev(mod(fixed, (d) => (d.flight.altitudeKm = 650)));
    expect(high.problems.some((p) => p.id === 'disposal.debris')).toBe(true);
  });

  it('greys out GEO and wrong instruments with reasons', () => {
    const e = ev(fixed);
    expect(e.compat.orbits.geo.ok).toBe(false);
    expect(e.compat.orbits.geo.reason).toMatch(/\$60M/);
    expect(e.compat.launchers['iss-deploy'].ok).toBe(false);
    expect(e.compat.instruments.camera).toEqual({ ok: false, reason: 'The Camera can’t measure heat from active fires.' });
    expect(e.compat.instruments['thermal-imager'].ok).toBe(true);
  });

  it('turns amber under 10% spare (CubeSat 101 reserve)', () => {
    const e = ev(mod(fixed, (d) => (d.engineer.partIds[4] = 'reaction-wheel')));
    expect(e.gauges.power.status).toBe('warn');
    expect(e.gauges.budget.status).toBe('warn');
  });

  it('never crashes on broken synced data', () => {
    const d = normalizeDesign({ planner: { weights: 'x' } as never, science: undefined, engineer: { partIds: [1, 'computer'] } as never, flight: null as never });
    expect(d.engineer.partIds).toEqual(['computer']);
    expect(() => evaluate(d, wildfire, gameData)).not.toThrow();
  });
});
