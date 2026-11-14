/**
 * Mission risk % (PRD P1, "Risk (new)" resource): the chance something
 * essential breaks, from each part's reliability and any backups.
 *
 *   const r = missionRisk(design, scenario, gameData);
 *   r.riskPct      // e.g. 22: about a 1 in 5 chance of losing the mission
 *   r.biggest.why  // "A single S-band radio with no backup gives a 1 in 25 chance of losing contact."
 *
 * Model (approximate, like the rest of the game): the mission needs every
 * essential system (launch, bus, power, battery, computer, pointing, radio,
 * at least one instrument). Two parts of the same kind back each other up, so
 * that system only fails if both do: 1 - (1 - r1)(1 - r2)...
 * Real small-satellite missions often fail early, which is why CubeSat teams
 * add redundancy where they can (see Goddard MDL: reliability and risk are
 * studied as their own discipline).
 */
import { allPartIds } from './design';
import type { Design, GameData, Part, PartCategory, Role, Scenario } from './types';

export interface RiskItem {
  system: string;
  /** Chance this system fails during the mission, 0 to 100. */
  failPct: number;
  /** Number of parts doing this job (2+ = has a backup). */
  count: number;
  owner: Role;
  partIds: string[];
  why: string;
  hint?: string;
}

export interface MissionRisk {
  /** Chance the mission is lost, 0 to 100. */
  riskPct: number;
  /** "1 in 5", for plain-English display. */
  oneIn: string;
  items: RiskItem[];
  /** The single biggest risk, if any. */
  biggest: RiskItem | null;
}

interface System {
  name: string;
  categories: PartCategory[];
  owner: Role;
  /** Words for the why sentence. */
  loss: string;
}

/** Systems the mission cannot do without. Thermal and propulsion are optional. */
const SYSTEMS: System[] = [
  { name: 'Power (solar)', categories: ['solar'], owner: 'engineer', loss: 'losing power' },
  { name: 'Battery', categories: ['battery'], owner: 'engineer', loss: 'going dark in eclipse' },
  { name: 'Flight computer', categories: ['computer'], owner: 'engineer', loss: 'losing control of the craft' },
  { name: 'Pointing', categories: ['adcs'], owner: 'engineer', loss: 'not being able to point' },
  { name: 'Radio', categories: ['antenna'], owner: 'flight', loss: 'losing contact' },
  { name: 'Instruments', categories: ['instrument'], owner: 'science', loss: 'collecting no science' },
];

/** "1 in 5" from a percentage. */
export function oneIn(pct: number): string {
  if (pct <= 0) return 'almost none';
  const n = Math.max(1, Math.round(100 / pct));
  return `1 in ${n}`;
}

export function missionRisk(design: Design, scenario: Scenario, data: GameData): MissionRisk {
  const byId = new Map(data.parts.map((p) => [p.id, p]));
  const parts = allPartIds(design)
    .map((id) => byId.get(id))
    .filter((p): p is Part => !!p);
  const items: RiskItem[] = [];

  const launcher = data.launchers.find((l) => l.id === design.flight.launcherId);
  if (launcher) {
    const failPct = (1 - launcher.reliability) * 100;
    items.push({
      system: 'Launch',
      failPct,
      count: 1,
      owner: 'flight',
      partIds: [],
      why: `The ${launcher.name.toLowerCase()} has about a ${oneIn(failPct)} chance of failing on the way up.`,
    });
  }
  const bus = data.buses.find((b) => b.id === design.engineer.busId && scenario.busIds.includes(b.id));
  if (bus) {
    const failPct = (1 - bus.reliability) * 100;
    items.push({ system: 'Bus', failPct, count: 1, owner: 'engineer', partIds: [], why: `The ${bus.name} itself has about a ${oneIn(failPct)} chance of a fault.` });
  }

  for (const sys of SYSTEMS) {
    const group = parts.filter((p) => sys.categories.includes(p.category));
    if (group.length === 0) continue; // missing parts are the rules engine's job
    // Backups: the system only fails if every part doing the job fails.
    const allFail = group.reduce((acc, p) => acc * (1 - p.reliability), 1);
    const failPct = allFail * 100;
    const single = group.length === 1;
    const name = group[0].name.toLowerCase();
    items.push({
      system: sys.name,
      failPct,
      count: group.length,
      owner: sys.owner,
      partIds: group.map((p) => p.id),
      why: single
        ? `A single ${name} with no backup gives a ${oneIn(failPct)} chance of ${sys.loss}.`
        : `${group.length} parts back each other up here, so the chance of ${sys.loss} is only ${oneIn(failPct)}.`,
      hint: single ? `A second ${sys.name === 'Radio' ? 'radio' : 'part of this kind'} would act as a backup, if you have the slots, power and budget.` : undefined,
    });
  }

  const survive = items.reduce((acc, i) => acc * (1 - i.failPct / 100), 1);
  const riskPct = (1 - survive) * 100;
  const biggest = [...items].sort((a, b) => b.failPct - a.failPct)[0] ?? null;
  return { riskPct, oneIn: oneIn(riskPct), items: items.sort((a, b) => b.failPct - a.failPct), biggest };
}
