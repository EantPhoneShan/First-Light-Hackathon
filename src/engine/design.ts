/**
 * Turns the four synced role sections into a typed Design, and back.
 *
 * Sync starts every section as `{}` and a teammate's device may send an older
 * or broken shape, so normalizeDesign() fills every missing field with a safe
 * default instead of crashing.
 *
 *   const design = normalizeDesign(mergedDesign(room));          // read
 *   await sync.updateDesign('flight', { ...design.flight, orbitId: 'sso' }); // write
 */
import type { Design, DisposalPlan, EngineerData, FlightData, PlannerData, ScienceData } from './types';

const DISPOSALS: DisposalPlan[] = ['none', 'natural-decay', 'deorbit-burn', 'graveyard'];

export function emptyDesign(): Design {
  return {
    planner: { weights: { coverage: 0.5, detail: 0.5, lifetime: 0.5 }, disposal: 'none' },
    science: { goalId: null, measurementId: null, instrumentIds: [] },
    engineer: { busId: null, partIds: [] },
    flight: { orbitId: null, altitudeKm: null, launcherId: null, antennaIds: [], stationIds: [] },
  };
}

type Raw = Record<string, unknown> | undefined;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const unit = (v: unknown, fallback: number): number => {
  const n = num(v);
  return n === null ? fallback : Math.min(1, Math.max(0, n));
};

export function normalizePlanner(raw: Raw): PlannerData {
  const d = emptyDesign().planner;
  const w = (raw?.weights ?? {}) as Record<string, unknown>;
  const disposal = DISPOSALS.includes(raw?.disposal as DisposalPlan) ? (raw!.disposal as DisposalPlan) : d.disposal;
  return {
    weights: {
      coverage: unit(w.coverage, d.weights.coverage),
      detail: unit(w.detail, d.weights.detail),
      lifetime: unit(w.lifetime, d.weights.lifetime),
    },
    disposal,
  };
}

export function normalizeScience(raw: Raw): ScienceData {
  return {
    goalId: str(raw?.goalId),
    measurementId: str(raw?.measurementId),
    instrumentIds: ids(raw?.instrumentIds),
  };
}

export function normalizeEngineer(raw: Raw): EngineerData {
  return { busId: str(raw?.busId), partIds: ids(raw?.partIds) };
}

export function normalizeFlight(raw: Raw): FlightData {
  return {
    orbitId: str(raw?.orbitId),
    altitudeKm: num(raw?.altitudeKm),
    launcherId: str(raw?.launcherId),
    antennaIds: ids(raw?.antennaIds),
    stationIds: ids(raw?.stationIds),
  };
}

/** Accepts the output of mergedDesign(room) (or any partial object). */
export function normalizeDesign(raw: Partial<Record<keyof Design, Raw>> | undefined): Design {
  return {
    planner: normalizePlanner(raw?.planner),
    science: normalizeScience(raw?.science),
    engineer: normalizeEngineer(raw?.engineer),
    flight: normalizeFlight(raw?.flight),
  };
}

/** Every part id on the craft (engineer parts, instruments and antennas). */
export function allPartIds(design: Design): string[] {
  return [...design.engineer.partIds, ...design.science.instrumentIds, ...design.flight.antennaIds];
}
