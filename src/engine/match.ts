/**
 * "Your design is most like..." (PRD F17): the closest real mission, with a
 * Learn more link, plus up to 2 other builds that would also have won.
 *
 *   const m = closestMission(design, gameData);
 *   m.mission.name, m.reasons, m.mission.url
 *   const others = otherWinningBuilds(design, scenario, gameData);   // ~1 second: run once per report
 *
 * Mission facts in src/data/missions.json were checked on NASA pages (see each
 * entry's "checked" note). Matching is about the KIND of mission (orbit, size,
 * instruments), not exact numbers.
 */
import missionsJson from '../data/missions.json';
import { scoreMission } from './score';
import { simulate } from './simulate';
import { sameDesign } from './share';
import type { BusSize, Design, GameData, OrbitKind, Scenario } from './types';

export interface RealMission {
  id: string;
  name: string;
  agency: string;
  orbitKind: OrbitKind;
  busSize: BusSize;
  /** Game instruments that do the same kind of job. */
  instrumentIds: string[];
  summary: string;
  url: string;
  /** What was checked, and where. */
  checked: string;
}

export const REAL_MISSIONS = missionsJson.missions as RealMission[];

export interface MissionMatch {
  mission: RealMission;
  /** Plain reasons, e.g. "Both use a radar", "Both fly a sun-synchronous orbit". */
  reasons: string[];
  /** 0 to 1, how alike. */
  similarity: number;
}

/** "a" or "an", read the way people say it: an S-band, an X-band, a UHF, an imager. */
export function article(phrase: string): string {
  const w = phrase.trim();
  const spokenVowel = /^(S-|X-|F-|H-|L-|M-|N-|R-)/.test(w) || (/^[aeiou]/i.test(w) && !/^U[A-Z]/.test(w) && !/^uni|^use/i.test(w));
  return `${spokenVowel ? 'an' : 'a'} ${w}`;
}

const ORBIT_WORDS: Record<OrbitKind, string> = { leo: 'a low Earth orbit', sso: 'a sun-synchronous orbit', geo: 'geostationary orbit' };
const SIZE_WORDS: Record<BusSize, string> = { cubesat: 'Both are CubeSats', smallsat: 'Both are small satellites', large: 'Both are large satellites' };

export function closestMission(design: Design, data: GameData, missions: RealMission[] = REAL_MISSIONS): MissionMatch | null {
  const orbit = data.orbits.find((o) => o.id === design.flight.orbitId);
  const bus = data.buses.find((b) => b.id === design.engineer.busId);
  const instruments = new Set(design.science.instrumentIds);
  let best: MissionMatch | null = null;
  for (const m of missions) {
    const reasons: string[] = [];
    let points = 0;
    const shared = m.instrumentIds.filter((id) => instruments.has(id));
    if (shared.length) {
      points += 3 * shared.length;
      const names = shared.map((id) => data.parts.find((p) => p.id === id)?.name.toLowerCase() ?? id);
      reasons.push(`Both use ${names.map(article).join(' and ')}`);
    }
    if (orbit && orbit.kind === m.orbitKind) {
      points += 2;
      reasons.push(`Both fly ${ORBIT_WORDS[m.orbitKind]}`);
    }
    if (bus && bus.size === m.busSize) {
      points += 1;
      reasons.push(SIZE_WORDS[m.busSize]);
    }
    const max = 3 * Math.max(1, m.instrumentIds.length) + 3;
    const similarity = points / max;
    if (points > 0 && (!best || similarity > best.similarity)) best = { mission: m, reasons, similarity };
  }
  return best;
}

export interface OtherBuild {
  design: Design;
  score: number;
  stars: 0 | 1 | 2 | 3;
  /** What is different from the player's build, e.g. "multispectral imager instead of thermal imager". */
  change: string;
}

/**
 * Up to `max` builds that differ from the player's in one choice (instrument,
 * radio or ground stations) and still succeed with 2+ stars: there is rarely
 * one perfect answer (challenge text). Tries at most ~20 variations.
 */
export function otherWinningBuilds(design: Design, scenario: Scenario, data: GameData, max = 2): OtherBuild[] {
  const name = (id: string) => data.parts.find((p) => p.id === id)?.name.toLowerCase() ?? data.stations.find((s) => s.id === id)?.name.toLowerCase() ?? id;
  const variants: { design: Design; change: string }[] = [];
  const copy = () => structuredClone(design);

  const allowed = [...new Set(scenario.goals.flatMap((g) => g.measurements.flatMap((m) => m.instrumentIds)))];
  for (const inst of allowed) {
    if (design.science.instrumentIds.length === 1 && design.science.instrumentIds[0] === inst) continue;
    const d = copy();
    d.science.instrumentIds = [inst];
    d.science.measurementId = null;
    variants.push({ design: d, change: `only ${article(name(inst))}${design.science.instrumentIds[0] ? ` instead of the ${design.science.instrumentIds.map(name).join(' and ')}` : ''}` });
  }
  for (const radio of data.parts.filter((p) => p.category === 'antenna')) {
    if (design.flight.antennaIds.includes(radio.id)) continue;
    const d = copy();
    d.flight.antennaIds = [radio.id];
    variants.push({ design: d, change: `${article(radio.name)} instead` });
  }
  for (const st of data.stations) {
    if (design.flight.stationIds.length === 1 && design.flight.stationIds[0] === st.id) continue;
    const d = copy();
    d.flight.stationIds = [st.id];
    variants.push({ design: d, change: `the ${name(st.id)} as the only ground station` });
  }

  const out: OtherBuild[] = [];
  for (const v of variants.slice(0, 20)) {
    if (out.length >= max) break;
    if (sameDesign(v.design, design)) continue;
    const sim = simulate(v.design, scenario, data, { events: false });
    if (sim.outcome !== 'success') continue;
    const s = scoreMission(v.design, scenario, data, sim);
    if (s.stars >= 2) out.push({ design: v.design, score: s.total, stars: s.stars, change: v.change });
  }
  return out;
}
