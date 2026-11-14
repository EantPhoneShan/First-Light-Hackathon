import { describe, expect, it } from 'vitest';
import { article, closestMission, otherWinningBuilds, REAL_MISSIONS } from '../match';
import { missionRisk, oneIn } from '../risk';
import { decodeDesign, encodeDesign, sameDesign } from '../share';
import { compareDesigns } from '../trade';
import { fixed, flood, gameData, mod, multispectral, radarBuild, tutorial, wildfire } from './fixtures';

describe('mission risk %', () => {
  it('is about 1 in 5 for a CubeSat with no backups', () => {
    const r = missionRisk(fixed, wildfire, gameData);
    expect(r.riskPct).toBeGreaterThan(15);
    expect(r.riskPct).toBeLessThan(30);
    expect(r.biggest!.why).toMatch(/no backup/);
    expect(r.items.every((i) => i.failPct >= 0 && i.failPct <= 100)).toBe(true);
  });

  it('drops when a part has a backup', () => {
    const one = missionRisk(fixed, wildfire, gameData);
    const two = missionRisk(mod(fixed, (d) => d.engineer.partIds.push('computer')), wildfire, gameData);
    expect(two.riskPct).toBeLessThan(one.riskPct);
    expect(two.items.find((i) => i.system === 'Flight computer')!.count).toBe(2);
  });

  it('reads as "1 in N"', () => {
    expect(oneIn(20)).toBe('1 in 5');
    expect(oneIn(0)).toBe('almost none');
  });
});

describe('trade study (F6)', () => {
  it('compares two designs side by side and picks the better one', () => {
    const t = compareDesigns(tutorial, fixed, wildfire, gameData, { seed: 1 });
    expect(t.recommendation).toBe('b');
    expect(t.why).toMatch(/^Option B scores \d+ more: it completes the mission/);
    expect(t.rows.find((r) => r.id === 'lifetime')!.better).toBe('b');
    expect(t.rows.map((r) => r.id)).toEqual(['score', 'outcome', 'lifetime', 'delivered', 'delay', 'science', 'cost', 'power', 'mass', 'risk', 'goals']);
  });

  it('calls it a tie for the same design, and prefers the cheaper of two close ones', () => {
    expect(compareDesigns(fixed, fixed, wildfire, gameData).recommendation).toBe('tie');
    const t = compareDesigns(fixed, multispectral, wildfire, gameData, { seed: 1, tieWithin: 100 });
    expect(['a', 'b']).toContain(t.recommendation);
    expect(t.why).toMatch(/cheaper/);
  });
});

describe('share codes (F19)', () => {
  it('round-trips a design exactly', () => {
    const code = encodeDesign('wildfire-watch', multispectral);
    expect(code).toMatch(/^FL1\.wildfire-watch\./);
    const back = decodeDesign(code, gameData)!;
    expect(back.scenarioId).toBe('wildfire-watch');
    expect(sameDesign(back.design, multispectral)).toBe(true);
    expect(sameDesign(back.design, fixed)).toBe(false);
  });

  it('refuses typos, edits, unknown scenarios and junk', () => {
    const code = encodeDesign('wildfire-watch', fixed);
    expect(decodeDesign(code.slice(0, -1) + (code.endsWith('a') ? 'b' : 'a'), gameData)).toBeNull();
    expect(decodeDesign(code.replace('wildfire-watch', 'flood-radar'), gameData)).toBeNull();
    expect(decodeDesign(encodeDesign('nope', fixed), gameData)).toBeNull();
    expect(decodeDesign('hello', gameData)).toBeNull();
    expect(decodeDesign('', gameData)).toBeNull();
  });
});

describe('real mission match (F17)', () => {
  it('has checked facts and a NASA link for every mission', () => {
    for (const m of REAL_MISSIONS) {
      expect(m.url, m.id).toMatch(/^https:\/\/([a-z]+\.)*nasa\.gov\//);
      expect(m.checked.length, m.id).toBeGreaterThan(20);
      for (const id of m.instrumentIds) expect(gameData.parts.some((p) => p.id === id), `${m.id}: ${id}`).toBe(true);
    }
  });

  it('matches the radar build to NISAR and the thermal CubeSat to a fire-watching mission', () => {
    expect(closestMission(radarBuild, gameData)!.mission.id).toBe('nisar');
    expect(closestMission(radarBuild, gameData)!.reasons).toContain('Both use an imaging radar');
    expect(['terra-modis', 'landsat-9']).toContain(closestMission(fixed, gameData)!.mission.id);
  });

  it('finds other builds that would also have won', () => {
    const others = otherWinningBuilds(fixed, wildfire, gameData);
    expect(others.length).toBeGreaterThan(0);
    for (const o of others) {
      expect(o.stars).toBeGreaterThanOrEqual(2);
      expect(sameDesign(o.design, fixed)).toBe(false);
    }
    expect(otherWinningBuilds(radarBuild, flood, gameData).length).toBeGreaterThan(0);
  });

  it('uses the right article', () => {
    expect([article('S-band radio'), article('UHF radio'), article('imaging radar'), article('camera')]).toEqual(['an S-band radio', 'a UHF radio', 'an imaging radar', 'a camera']);
  });
});
