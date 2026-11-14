/**
 * Loads the data files into one GameData object (task 1.2).
 *
 * Engine functions take GameData as a parameter instead of importing JSON,
 * so tests and the score Lambda can pass in their own data.
 * Full schema checks with Zod come in task 1.3; checkReferences() catches
 * broken ids in the meantime.
 */
import partsJson from '../data/parts.json';
import launchersJson from '../data/launchers.json';
import orbitsJson from '../data/orbits.json';
import stationsJson from '../data/stations.json';
import scenariosJson from '../data/scenarios.json';
import sourcesJson from '../data/sources.json';
import { allPartIds, normalizeDesign } from './design';
import type { Bus, GameData, GroundStation, Launcher, Orbit, Part, Scenario, Source, SourceRef } from './types';

export const gameData: GameData = {
  parts: partsJson.parts as Part[],
  buses: partsJson.buses as Bus[],
  launchers: launchersJson.launchers as Launcher[],
  orbits: orbitsJson.orbits as Orbit[],
  decay: orbitsJson.decay,
  decaySource: orbitsJson.decaySource as SourceRef,
  disposalRuleYears: orbitsJson.disposalRuleYears,
  disposalSource: orbitsJson.disposalSource as SourceRef,
  stations: stationsJson.stations as GroundStation[],
  scenarios: (scenariosJson.scenarios as unknown as Scenario[]).map((s) => ({
    ...s,
    tutorialDesign: s.tutorialDesign ? normalizeDesign(s.tutorialDesign as never) : undefined,
  })),
  sources: sourcesJson.sources as Source[],
};

// ---------------------------------------------------------------------------
// Lookups (undefined when the id is unknown)
// ---------------------------------------------------------------------------

export const findPart = (d: GameData, id: string | null | undefined) => d.parts.find((p) => p.id === id);
export const findBus = (d: GameData, id: string | null | undefined) => d.buses.find((b) => b.id === id);
export const findLauncher = (d: GameData, id: string | null | undefined) => d.launchers.find((l) => l.id === id);
export const findOrbit = (d: GameData, id: string | null | undefined) => d.orbits.find((o) => o.id === id);
export const findStation = (d: GameData, id: string | null | undefined) => d.stations.find((s) => s.id === id);
export const findScenario = (d: GameData, id: string | null | undefined) => d.scenarios.find((s) => s.id === id);

/**
 * Returns a readable message for every duplicate id or id that points at
 * nothing. Empty array = the data is consistent.
 */
export function checkReferences(d: GameData): string[] {
  const errors: string[] = [];
  const sourceIds = new Set(d.sources.map((s) => s.id));
  const orbitIds = new Set(d.orbits.map((o) => o.id));

  const tables: [string, { id: string; source?: string }[]][] = [
    ['parts', d.parts],
    ['buses', d.buses],
    ['launchers', d.launchers],
    ['orbits', d.orbits],
    ['stations', d.stations],
    ['scenarios', d.scenarios],
  ];
  const allIds = new Map<string, string>();
  for (const [table, rows] of tables) {
    for (const row of rows) {
      if (allIds.has(row.id)) errors.push(`${table}: id "${row.id}" is also used in ${allIds.get(row.id)}`);
      allIds.set(row.id, table);
      if (row.source && !sourceIds.has(row.source as Source['id'])) {
        errors.push(`${table}/${row.id}: unknown source "${row.source}"`);
      }
    }
  }

  for (const l of d.launchers) {
    for (const o of Object.keys(l.capacityKg)) {
      if (!orbitIds.has(o)) errors.push(`launchers/${l.id}: unknown orbit "${o}" in capacityKg`);
    }
  }
  for (const s of d.stations) {
    for (const o of Object.keys(s.passesPerDay)) {
      if (!orbitIds.has(o)) errors.push(`stations/${s.id}: unknown orbit "${o}" in passesPerDay`);
    }
  }
  for (const sc of d.scenarios) {
    for (const b of sc.busIds) if (!findBus(d, b)) errors.push(`scenarios/${sc.id}: unknown bus "${b}"`);
    for (const g of sc.goals) {
      for (const m of g.measurements) {
        for (const i of m.instrumentIds) {
          if (findPart(d, i)?.category !== 'instrument') {
            errors.push(`scenarios/${sc.id}: "${i}" in ${g.id}/${m.id} is not an instrument`);
          }
        }
      }
    }
    const t = sc.tutorialDesign;
    if (t) {
      for (const p of allPartIds(t)) if (!findPart(d, p)) errors.push(`scenarios/${sc.id}: tutorial uses unknown part "${p}"`);
      if (!findBus(d, t.engineer.busId)) errors.push(`scenarios/${sc.id}: tutorial uses unknown bus`);
      if (!findOrbit(d, t.flight.orbitId)) errors.push(`scenarios/${sc.id}: tutorial uses unknown orbit`);
      if (!findLauncher(d, t.flight.launcherId)) errors.push(`scenarios/${sc.id}: tutorial uses unknown launcher`);
      for (const st of t.flight.stationIds) if (!findStation(d, st)) errors.push(`scenarios/${sc.id}: tutorial uses unknown station "${st}"`);
    }
  }
  for (let i = 1; i < d.decay.length; i++) {
    if (d.decay[i].altitudeKm <= d.decay[i - 1].altitudeKm) errors.push('orbits.decay: altitudes must go up');
  }
  return errors;
}
