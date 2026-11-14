import { describe, expect, it } from 'vitest';
import { buildMissionReport } from '../report';
import { SCORING, scoreMission, starsFor } from '../score';
import { simulate } from '../simulate';
import type { Design, Scenario } from '../types';
import { fixed, flood, gameData, mod, multispectral, radarBuild, tutorial, wildfire } from './fixtures';

function fly(d: Design, sc: Scenario = wildfire) {
  const sim = simulate(d, sc, gameData, { seed: 1, choices: { 'solar-storm': 'safe-mode', 'station-outage': 'slow-down', 'part-failure': 'reboot' } });
  const score = scoreMission(d, sc, gameData, sim);
  return { sim, score, report: buildMissionReport(d, sc, gameData, sim, score) };
}

describe('score', () => {
  it('rewards each fix on a re-fly (tutorial -> battery fix -> both role goals)', () => {
    const a = fly(tutorial).score;
    const b = fly(fixed).score;
    const c = fly(multispectral).score;
    expect(a.stars).toBe(0);
    expect(a.total).toBeLessThan(150);
    expect(b.stars).toBe(2);
    expect(c.stars).toBe(3);
    expect(a.total).toBeLessThan(b.total);
  });

  it('needs every role goal for 3 stars', () => {
    const b = fly(fixed).score;
    expect(b.total).toBeGreaterThanOrEqual(SCORING.stars[2]);
    expect(b.roleGoals.find((g) => g.role === 'science')!.met).toBe(false);
    expect(b.notes.collaboration).toMatch(/3 stars needs every role/);
  });

  it('stays within the PRD maximums and 0 to 1000', () => {
    for (const d of [tutorial, fixed, multispectral]) {
      const s = fly(d).score;
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(1000);
      expect(s.byCategory.objective).toBeLessThanOrEqual(350);
      expect(s.byCategory.collaboration).toBeLessThanOrEqual(50);
    }
  });

  it('gives a launch failure almost nothing', () => {
    expect(fly(mod(fixed, (d) => d.engineer.partIds.push('cold-gas-thruster'))).score.total).toBeLessThan(100);
  });

  it('uses the star thresholds 400 / 650 / 850', () => {
    expect([starsFor(399), starsFor(400), starsFor(650), starsFor(850), starsFor(850, false)]).toEqual([0, 1, 2, 3, 2]);
  });

  it('counts good event choices', () => {
    const d = fixed;
    const good = simulate(d, wildfire, gameData, { seed: 1, choices: { 'solar-storm': 'safe-mode', 'station-outage': 'slow-down', 'part-failure': 'reboot' } });
    const bad = simulate(d, wildfire, gameData, { seed: 1, choices: { 'solar-storm': 'keep-working', 'station-outage': 'slow-down', 'part-failure': 'wait' } });
    expect(scoreMission(d, wildfire, gameData, good).byCategory.decisions).toBeGreaterThan(scoreMission(d, wildfire, gameData, bad).byCategory.decisions);
  });

  it('balances Flood Radar: power and mass decide it', () => {
    expect(fly(radarBuild, flood).sim.outcome).toBe('success');
    expect(fly(mod(radarBuild, (d) => d.science.instrumentIds.push('multispectral-imager')), flood).score.stars).toBe(3);
    const oneArray = fly(mod(radarBuild, (d) => (d.engineer.partIds = ['solar-array', 'battery-pack', 'computer', 'reaction-wheel'])), flood);
    expect(oneArray.sim.outcome).toBe('failure');
  });

  it('halves the Flood Radar objective without a way to see through clouds', () => {
    const withRadar = fly(mod(radarBuild, (d) => (d.science.instrumentIds = ['radar'])), flood).score;
    const noRadar = fly(mod(radarBuild, (d) => (d.science.instrumentIds = ['multispectral-imager'])), flood).score;
    expect(noRadar.byCategory.objective).toBeLessThan(withRadar.byCategory.objective * 0.6);
    expect(noRadar.notes.objective).toMatch(/needs the ground under storm clouds/);
  });
});

describe('mission report', () => {
  it('puts the battery first for the tutorial, once, with the part to highlight', () => {
    const r = fly(tutorial).report;
    expect(r.headline).toBe('Mission lost on orbit 1: battery ran out in Earth’s shadow.');
    expect(r.findings[0]).toMatchObject({ kind: 'bad', top: true, partIds: ['battery-small'], area: 'spacecraft' });
    expect(r.findings.filter((f) => /battery/i.test(f.title))).toHaveLength(1);
    expect(r.findings.filter((f) => f.top)).toHaveLength(Math.min(3, r.findings.length));
    expect(r.highlightPartIds).toContain('battery-small');
  });

  it('compares a re-fly with the last flight', () => {
    const last = fly(tutorial);
    const now = fly(fixed);
    const r = buildMissionReport(fixed, wildfire, gameData, now.sim, now.score, last);
    expect(r.compare!.totalDelta).toBeGreaterThan(700);
    expect(r.compare!.fixedTitles).toContain('Battery ran out in Earth’s shadow');
  });

  it('does not suggest a trade study until that screen exists', () => {
    if (SCORING.tradeStudyAvailable) return;
    expect(fly(fixed).report.findings.some((f) => f.id === 'tip.trade-study')).toBe(false);
  });
});
