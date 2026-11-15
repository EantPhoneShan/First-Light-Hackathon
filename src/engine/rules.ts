/**
 * Rules engine (task 1.4): checks a Design against a scenario and returns the
 * live gauges, the problems with their why sentences, and which choices are
 * greyed out. Pure function: same input, same output, on every device and in
 * the score Lambda.
 *
 *   const result = evaluate(normalizeDesign(mergedDesign(room)), scenario, gameData);
 *
 * Gauge colours: green with at least 10% spare (CubeSat 101's reserve advice),
 * amber under 10%, red over the limit. Red designs can still launch and fail
 * in flight; only impossible builds are blocking.
 */
import { allPartIds } from './design';
import {
  clampAltitude,
  lowerPerigeeDeltaV,
  orbitInfo,
  raiseOrbitDeltaV,
  rocketDeltaV,
  safeDecayAltitudeKm,
} from './orbit';
import type {
  Availability,
  Bus,
  BusSize,
  Compatibility,
  Design,
  GameData,
  Gauge,
  Launcher,
  Orbit,
  OrbitInfo,
  Part,
  Problem,
  ProblemKind,
  ResourceId,
  Role,
  Scenario,
  Status,
  Totals,
  Evaluation,
} from './types';
import { CATEGORY_OWNER, RESOURCES, RESOURCE_LABELS, RESOURCE_OWNER } from './types';
import { reason, why, type Why } from './why';

/** Tuning knobs, kept in one place for balancing (task 1.15). */
export const RULES = {
  /** Under this % spare a gauge turns amber (CubeSat 101: keep at least 10% reserve). */
  warnMarginPct: 10,
  /** Share of a battery's charge used each eclipse, to keep it healthy for years (estimate). */
  batteryUsable: 0.6,
  /** GEO graveyard orbit: about 300 km above GEO. */
  graveyardRaiseKm: 300,
  /** Solar panels lose this share of their power each year in space (estimate). */
  solarWearPerYear: 0.02,
  /**
   * Delta-v a GEO satellite spends each year to stay in its slot (textbook value,
   * mostly to fight the pull of the Sun and Moon). The GOES-R fuel requirement is
   * 15 years, per the NASA GOES-R design overview.
   */
  geoStationKeepingMsPerYear: 50,
};

const BUS_RANK: Record<BusSize, number> = { cubesat: 0, smallsat: 1, large: 2 };
const BAND_NAMES = { uhf: 'UHF', s: 'S-band', x: 'X-band' } as const;

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

export function evaluate(design: Design, scenario: Scenario, data: GameData): Evaluation {
  const problems: Problem[] = [];
  const add = (
    id: string,
    kind: ProblemKind,
    status: 'warn' | 'fail',
    w: Why,
    owner: Role,
    partIds: string[] = [],
    blocking = false,
  ) => problems.push({ id, kind, status, why: w.why, hint: w.hint, owner, partIds, blocking });

  // --- Resolve ids to data rows (unknown ids are ignored) -------------------
  const bus = data.buses.find((b) => b.id === design.engineer.busId && scenario.busIds.includes(b.id));
  const orbit = data.orbits.find((o) => o.id === design.flight.orbitId);
  const launcher = data.launchers.find((l) => l.id === design.flight.launcherId);
  const partById = new Map(data.parts.map((p) => [p.id, p]));
  const parts = allPartIds(design)
    .map((id) => partById.get(id))
    .filter((p): p is Part => !!p);
  const byCat = (c: Part['category']) => parts.filter((p) => p.category === c);
  const instruments = byCat('instrument');
  const antennas = byCat('antenna');
  const stations = data.stations.filter((s) => design.flight.stationIds.includes(s.id));
  const orb: OrbitInfo | null = orbit ? orbitInfo(orbit, design.flight.altitudeKm, data.decay) : null;
  const years = scenario.lifetimeYears;

  // --- Missing choices ---------------------------------------------------------
  if (!bus) add('missing.bus', 'missing', 'fail', why.noBus(), 'engineer', [], true);
  if (!orbit) add('missing.orbit', 'missing', 'fail', why.noOrbit(), 'flight', [], true);
  if (!launcher) add('missing.launcher', 'missing', 'fail', why.noLauncher(), 'flight', [], true);
  if (antennas.length === 0) add('missing.antenna', 'missing', 'fail', why.noAntenna(), 'flight', [], true);
  if (instruments.length === 0) add('missing.instrument', 'missing', 'fail', why.noInstrument(), 'science');
  if (byCat('solar').length === 0) add('missing.solar', 'missing', 'fail', why.noSolar(), 'engineer');
  if (byCat('battery').length === 0) add('missing.battery', 'missing', 'fail', why.noBattery(), 'engineer');
  if (byCat('computer').length === 0) add('missing.computer', 'missing', 'fail', why.noComputer(), 'engineer');
  if (byCat('adcs').length === 0) add('missing.adcs', 'missing', 'warn', why.noAdcs(), 'engineer');
  if (stations.length === 0) add('missing.stations', 'missing', 'fail', why.noStations(), 'flight');

  // --- Fit on the bus (blocking) ---------------------------------------------
  const slotsUsed = sum(parts, (p) => p.slots);
  if (bus) {
    if (slotsUsed > bus.slots) {
      add('fit.slots', 'slots', 'fail', why.slots(slotsUsed, bus.slots, bus.name), 'engineer', parts.filter((p) => p.slots > 0).map((p) => p.id), true);
    }
    for (const p of uniqueParts(parts)) {
      if (p.fits && !p.fits.includes(bus.size)) {
        add(`fit.size.${p.id}`, 'slots', 'fail', why.doesNotFit(p.name, bus.name), CATEGORY_OWNER[p.category], [p.id], true);
      }
    }
  }
  for (const p of uniqueParts(parts)) {
    const n = parts.filter((x) => x.id === p.id).length;
    if (p.maxPerCraft !== undefined && n > p.maxPerCraft) {
      add(`fit.max.${p.id}`, 'slots', 'fail', why.tooMany(p.name, p.maxPerCraft), CATEGORY_OWNER[p.category], [p.id], true);
    }
  }

  // --- Rocket can reach the orbit and carry the bus (blocking) -----------------
  if (launcher && orbit && launcher.capacityKg[orbit.id] === undefined) {
    add('compat.launcher-orbit', 'compat', 'fail', why.launcherNoOrbit(launcher.name, orbit.name), 'flight', [], true);
  }
  if (launcher && bus && BUS_RANK[bus.size] > BUS_RANK[launcher.maxBus]) {
    add('compat.launcher-bus', 'compat', 'fail', why.launcherTooSmallBus(launcher.name, bus.name), 'flight', [], true);
  }

  // --- Mass ------------------------------------------------------------------
  const massKg = (bus?.massKg ?? 0) + sum(parts, (p) => p.massKg);
  const rocketCap = launcher && orbit ? launcher.capacityKg[orbit.id] : undefined;
  const massLimitKg = Math.min(bus?.maxMassKg ?? Infinity, rocketCap ?? Infinity);
  const heaviest = [...uniqueParts(parts)].sort((a, b) => b.massKg - a.massKg).slice(0, 2);
  if (bus && massKg > bus.maxMassKg) {
    add('mass.bus', 'mass', 'fail', why.massOverBus(massKg, bus.maxMassKg, bus.name), 'engineer', heaviest.map((p) => p.id));
  }
  if (launcher && orbit && rocketCap !== undefined && massKg > rocketCap) {
    add('mass.rocket', 'mass', 'fail', why.massOverRocket(massKg, rocketCap, launcher.name, orbit.name, heaviest.map((p) => p.name)), 'engineer', heaviest.map((p) => p.id));
  }

  // --- Power and battery --------------------------------------------------------
  const powerDrawW = (bus?.powerW ?? 0) + sum(parts, (p) => p.powerW);
  const sunlitW = sum(parts, (p) => p.generationW ?? 0);
  const powerAvgW = orb ? sunlitW * (1 - orb.eclipseFraction) : 0;
  const batteryUsableWh = sum(parts, (p) => p.capacityWh ?? 0) * RULES.batteryUsable;
  const eclipseNeedWh = orb ? (powerDrawW * orb.eclipseMin) / 60 : 0;
  const powerHogs = [...uniqueParts(parts)].filter((p) => p.powerW > 0).sort((a, b) => b.powerW - a.powerW).slice(0, 2).map((p) => p.id);
  if (orb && sunlitW > 0) {
    if (powerDrawW > powerAvgW) {
      const canAddSolar = data.parts.some(
        (p) =>
          p.category === 'solar' &&
          (!bus || !p.fits || p.fits.includes(bus.size)) &&
          parts.filter((x) => x.id === p.id).length < (p.maxPerCraft ?? Infinity),
      );
      add('power.average', 'power', 'fail', why.powerShort(powerDrawW, powerAvgW, orb.eclipseMin, canAddSolar), 'engineer', [...byCat('solar').map((p) => p.id), ...powerHogs]);
    } else if (marginPct(powerDrawW, powerAvgW) < RULES.warnMarginPct) {
      add('power.margin', 'power', 'warn', why.powerTight(marginPct(powerDrawW, powerAvgW)), 'engineer', powerHogs);
    }
  }
  if (orb && byCat('battery').length > 0 && eclipseNeedWh > batteryUsableWh) {
    add('power.battery', 'power', 'fail', why.batteryShort(eclipseNeedWh, batteryUsableWh, orb.eclipseMin, powerDrawW), 'engineer', byCat('battery').map((p) => p.id));
  }

  // --- Data and communications -------------------------------------------------
  const dataMBPerDay = orb ? sum(instruments, (p) => p.dataMBPerOrbit ?? 0) * orb.orbitsPerDay : 0;
  const radio = [...antennas].sort((a, b) => (b.dataRateMbps ?? 0) - (a.dataRateMbps ?? 0))[0];
  let downlinkMBPerDay = 0;
  let passesPerDay = 0;
  let continuous = false;
  if (orbit && radio?.band) {
    for (const st of stations) {
      const passes = st.passesPerDay[orbit.id] ?? 0;
      if (passes === 0) {
        add(`comms.station-orbit.${st.id}`, 'comms', 'warn', why.stationNeverSees(st.name, orbit.name), 'flight');
        continue;
      }
      if (!st.bands.includes(radio.band)) {
        add(`comms.station-band.${st.id}`, 'comms', 'warn', why.stationCantHear(st.name, BAND_NAMES[radio.band]), 'flight', [radio.id]);
        continue;
      }
      // A GEO craft hangs over the station: the link is always on.
      const minutes = orbit.kind === 'geo' ? 1440 : passes * st.passMinutes;
      if (orbit.kind === 'geo') continuous = true;
      passesPerDay += passes;
      downlinkMBPerDay += (minutes * 60 * (radio.dataRateMbps ?? 0)) / 8;
    }
  }
  const latencyHours = continuous ? 0 : passesPerDay > 0 ? 24 / passesPerDay : Infinity;
  // Passes bunch up, so the longest gap is about twice the average (capped at a day).
  const maxGapHours = continuous ? 1 : passesPerDay > 0 ? Math.min(24, 48 / passesPerDay) : 24;
  const storageMB = sum(parts, (p) => p.storageMB ?? 0);
  const bufferNeedMB = (dataMBPerDay * maxGapHours) / 24;
  const antennaIds = antennas.map((p) => p.id);

  if (orb && dataMBPerDay > 0 && radio) {
    if (downlinkMBPerDay === 0 && stations.length > 0) {
      add('comms.no-link', 'comms', 'fail', why.commsNoLink(dataMBPerDay), 'flight');
    } else if (dataMBPerDay > downlinkMBPerDay) {
      add('comms.downlink', 'comms', 'fail', why.commsShort(dataMBPerDay, downlinkMBPerDay), 'flight', antennaIds);
    } else if (marginPct(dataMBPerDay, downlinkMBPerDay) < RULES.warnMarginPct) {
      add('comms.margin', 'comms', 'warn', why.commsTight(marginPct(dataMBPerDay, downlinkMBPerDay)), 'flight', antennaIds);
    }
    if (Number.isFinite(latencyHours) && latencyHours > scenario.customer.needsDataWithinHours) {
      add('comms.latency', 'comms', 'warn', why.latency(latencyHours, scenario.customer.needsDataWithinHours, scenario.customer.name), 'flight');
    }
    if (storageMB > 0 && bufferNeedMB > storageMB) {
      add('data.storage', 'data', 'fail', why.dataStorage(bufferNeedMB, storageMB, maxGapHours), 'science', [...byCat('computer').map((p) => p.id), ...instruments.map((p) => p.id)]);
    }
  }

  // --- Budget ------------------------------------------------------------------
  const costPartsM = (bus?.costM ?? 0) + sum(parts, (p) => p.costM);
  const costLaunchM = launcher?.costM ?? 0;
  const costOpsM = years * (scenario.baseOpsCostPerYearM + sum(stations, (s) => s.costPerYearM));
  const costTotalM = costPartsM + costLaunchM + costOpsM;
  if (costTotalM > scenario.budgetM) {
    add('budget.over', 'budget', 'fail', why.budgetOver(costTotalM, scenario.budgetM, costOpsM, years), 'planner');
  } else if (marginPct(costTotalM, scenario.budgetM) < RULES.warnMarginPct) {
    add('budget.reserve', 'budget', 'warn', why.budgetReserve(marginPct(costTotalM, scenario.budgetM)), 'planner');
  }

  // --- Time: build schedule and lifetime in orbit -------------------------------
  const slowest = [...parts].sort((a, b) => b.buildMonths - a.buildMonths)[0];
  const buildMonths = (bus?.buildMonths ?? 0) + (slowest?.buildMonths ?? 0);
  if (bus) {
    if (buildMonths > scenario.launchInMonths) {
      add('time.late', 'time', 'fail', why.late(buildMonths, scenario.launchInMonths, slowest?.name ?? 'bus', slowest?.buildMonths ?? 0), 'planner', slowest ? [slowest.id] : []);
    } else if (marginPct(buildMonths, scenario.launchInMonths) < RULES.warnMarginPct) {
      add('time.tight', 'time', 'warn', why.scheduleTight(scenario.launchInMonths - buildMonths), 'planner', slowest ? [slowest.id] : []);
    }
  }
  if (orb && orb.decayYears < years) {
    add('lifetime.decay', 'lifetime', 'fail', why.decayTooSoon(orb.decayYears, years, orb.altitudeKm), 'flight');
  }
  if (orbit && orbit.revisitDays > scenario.revisitDays) {
    add('science.revisit', 'science', 'fail', why.revisit(orbit.revisitDays, scenario.revisitDays, orbit.name), 'flight');
  }

  // --- End of mission and delta-v -----------------------------------------------
  const thrusters = byCat('propulsion');
  const deltaVHaveMs = sum(thrusters, (p) => rocketDeltaV(p.ispS ?? 0, massKg, p.propellantKg ?? 0));
  let deltaVNeedMs = 0;
  const plan = design.planner.disposal;
  if (orbit && orb) {
    if (orbit.kind === 'geo') {
      if (plan !== 'graveyard') add('disposal.geo', 'disposal', 'fail', why.geoNeedsGraveyard(), 'planner');
      // Staying in the slot for the whole mission, then the move to the graveyard.
      deltaVNeedMs = RULES.geoStationKeepingMsPerYear * years + raiseOrbitDeltaV(orb.altitudeKm, orb.altitudeKm + RULES.graveyardRaiseKm);
    } else {
      const staysTooLong = orb.decayYears > data.disposalRuleYears;
      if (plan === 'none') add('disposal.none', 'disposal', 'warn', why.noDisposal(), 'planner');
      if (plan === 'graveyard') add('disposal.graveyard', 'disposal', 'warn', why.graveyardOnlyGeo(), 'planner');
      if (staysTooLong && plan !== 'deorbit-burn') {
        add('disposal.debris', 'disposal', 'fail', why.debris(orb.decayYears, data.disposalRuleYears), 'planner');
      }
      if (plan === 'deorbit-burn') {
        const safeAlt = safeDecayAltitudeKm(data.disposalRuleYears, data.decay);
        deltaVNeedMs = lowerPerigeeDeltaV(orb.altitudeKm, safeAlt);
      }
    }
    const needsBurn = orbit.kind === 'geo' || plan === 'deorbit-burn';
    if (needsBurn && thrusters.length === 0) {
      add('deltaV.no-thruster', 'deltaV', 'fail', orbit.kind === 'geo' ? why.geoNoThruster() : why.burnNoThruster(), 'engineer');
    } else if (deltaVNeedMs > deltaVHaveMs) {
      const w = orbit.kind === 'geo' ? why.geoDeltaVShort(deltaVNeedMs, deltaVHaveMs, years) : why.deltaVShort(deltaVNeedMs, deltaVHaveMs);
      add('deltaV.short', 'deltaV', 'fail', w, 'flight', thrusters.map((p) => p.id));
    }
  }

  // --- Science traceability (CML 1) -----------------------------------------------
  const instrumentAvail = scienceLocks(design, scenario, data);
  for (const p of uniqueParts(instruments)) {
    const a = instrumentAvail[p.id];
    if (a && !a.ok) add(`science.off-goal.${p.id}`, 'science', 'fail', { why: a.reason ?? '' }, 'science', [p.id]);
  }

  // --- Totals, gauges, pickers -------------------------------------------------------
  const totals: Totals = {
    massKg,
    massLimitKg: Number.isFinite(massLimitKg) ? massLimitKg : 0,
    slotsUsed,
    slots: bus?.slots ?? 0,
    powerDrawW,
    powerAvgW,
    batteryUsableWh,
    eclipseNeedWh,
    dataMBPerDay,
    downlinkMBPerDay,
    storageMB,
    bufferNeedMB,
    latencyHours,
    costPartsM,
    costLaunchM,
    costOpsM,
    costTotalM,
    buildMonths,
    deltaVHaveMs,
    deltaVNeedMs,
  };

  const gaugeInput: Record<ResourceId, [used: number, limit: number, unit: string]> = {
    mass: [massKg, totals.massLimitKg, 'kg'],
    power: [powerDrawW, powerAvgW, 'W'],
    budget: [costTotalM, scenario.budgetM, '$M'],
    data: [bufferNeedMB, storageMB, 'MB'],
    comms: [dataMBPerDay, downlinkMBPerDay, 'MB/day'],
    time: [buildMonths, scenario.launchInMonths, 'months'],
    deltaV: [deltaVNeedMs, deltaVHaveMs, 'm/s'],
  };
  /** Problem kinds that also colour a gauge. */
  const gaugeKinds: Record<ResourceId, ProblemKind[]> = {
    mass: ['mass'],
    power: ['power'],
    budget: ['budget'],
    data: ['data'],
    comms: ['comms'],
    time: ['time', 'lifetime'],
    deltaV: ['deltaV', 'disposal'],
  };
  const gauges = Object.fromEntries(
    RESOURCES.map((r) => {
      const [used, limit, unit] = gaugeInput[r];
      const fromProblems = problems.filter((p) => gaugeKinds[r].includes(p.kind)).map((p) => p.status);
      const g: Gauge = {
        resource: r,
        label: RESOURCE_LABELS[r],
        used,
        limit,
        unit,
        marginPct: marginPct(used, limit),
        status: worst([thresholdStatus(used, limit), ...fromProblems]),
        critical: scenario.criticalResources.includes(r),
        owner: RESOURCE_OWNER[r],
      };
      return [r, g];
    }),
  ) as Record<ResourceId, Gauge>;

  const compat: Compatibility = {
    buses: busLocks(data, scenario),
    launchers: launcherLocks(data.launchers, bus, orbit, massKg),
    orbits: orbitLocks(data, scenario, bus),
    instruments: instrumentAvail,
    stations: stationLocks(data, orbit, radio),
    parts: partLocks(data.parts, parts, bus, slotsUsed),
  };

  // Fails first, then warnings; blocking first within each.
  problems.sort((a, b) => rank(a) - rank(b));

  return {
    gauges,
    problems,
    compat,
    orbit: orb,
    totals,
    ready: !problems.some((p) => p.status === 'fail'),
    canLaunch: !problems.some((p) => p.blocking),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** % of the limit still spare. Negative = over. */
export function marginPct(used: number, limit: number): number {
  if (limit > 0) return ((limit - used) / limit) * 100;
  return used > 0 ? -100 : 100;
}

function thresholdStatus(used: number, limit: number): Status {
  if (used > limit) return 'fail';
  if (marginPct(used, limit) < RULES.warnMarginPct) return 'warn';
  return 'ok';
}

const STATUS_RANK: Record<Status, number> = { ok: 0, warn: 1, fail: 2 };
function worst(statuses: Status[]): Status {
  return statuses.reduce<Status>((w, s) => (STATUS_RANK[s] > STATUS_RANK[w] ? s : w), 'ok');
}

const rank = (p: Problem) => (p.status === 'fail' ? 0 : 2) + (p.blocking ? 0 : 1);

function uniqueParts(parts: Part[]): Part[] {
  return [...new Map(parts.map((p) => [p.id, p])).values()];
}

/** CML 1 science traceability: which instruments fit the chosen goal and measurement. */
function scienceLocks(design: Design, scenario: Scenario, data: GameData): Record<string, Availability> {
  const goal = scenario.goals.find((g) => g.id === design.science.goalId);
  const measurement = goal?.measurements.find((m) => m.id === design.science.measurementId);
  const pool = measurement ? [measurement] : goal ? goal.measurements : scenario.goals.flatMap((g) => g.measurements);
  const allowed = new Set(pool.flatMap((m) => m.instrumentIds));
  const out: Record<string, Availability> = {};
  for (const p of data.parts.filter((x) => x.category === 'instrument')) {
    if (allowed.has(p.id)) out[p.id] = { ok: true };
    else if (measurement) out[p.id] = { ok: false, reason: why.instrumentOffGoal(p.name, measurement.name).why };
    else out[p.id] = { ok: false, reason: why.instrumentOffMission(p.name).why };
  }
  return out;
}

/** Parts every craft needs, one of each (solar mounts outside, so it takes no slot). */
const ESSENTIAL: Part['category'][] = ['battery', 'computer', 'adcs', 'antenna'];

/** A bus is greyed out when even the smallest essential parts can't fit in it. */
function busLocks(data: GameData, scenario: Scenario): Record<string, Availability> {
  const instrumentIds = new Set(scenario.goals.flatMap((g) => g.measurements.flatMap((m) => m.instrumentIds)));
  const out: Record<string, Availability> = {};
  for (const b of data.buses.filter((x) => scenario.busIds.includes(x.id))) {
    const fits = (p: Part) => !p.fits || p.fits.includes(b.size);
    const minSlots = (ps: Part[]) => (ps.length ? Math.min(...ps.map((p) => p.slots)) : 0);
    const need =
      ESSENTIAL.reduce((s, c) => s + minSlots(data.parts.filter((p) => p.category === c && fits(p))), 0) +
      minSlots(data.parts.filter((p) => p.category === 'instrument' && instrumentIds.has(p.id) && fits(p)));
    out[b.id] = need > b.slots ? { ok: false, reason: reason.busTooSmall(need, b.slots) } : { ok: true };
  }
  return out;
}

function launcherLocks(launchers: Launcher[], bus: Bus | undefined, orbit: Orbit | undefined, massKg: number): Record<string, Availability> {
  const out: Record<string, Availability> = {};
  for (const l of launchers) {
    const cap = orbit ? l.capacityKg[orbit.id] : undefined;
    if (bus && BUS_RANK[bus.size] > BUS_RANK[l.maxBus]) out[l.id] = { ok: false, reason: reason.launcherTooSmall(bus.name) };
    else if (orbit && cap === undefined) out[l.id] = { ok: false, reason: reason.launcherNoOrbit(orbit.name) };
    else if (cap !== undefined && massKg > cap) out[l.id] = { ok: false, reason: reason.launcherTooWeak(massKg, cap) };
    else out[l.id] = { ok: true };
  }
  return out;
}

function orbitLocks(data: GameData, scenario: Scenario, bus: Bus | undefined): Record<string, Availability> {
  const size = bus?.size ?? data.buses.find((b) => b.id === scenario.busIds[0])?.size ?? 'cubesat';
  const out: Record<string, Availability> = {};
  for (const o of data.orbits) {
    const rockets = data.launchers.filter((l) => l.capacityKg[o.id] !== undefined && BUS_RANK[size] <= BUS_RANK[l.maxBus]);
    const cheapest = Math.min(...rockets.map((l) => l.costM));
    if (rockets.length === 0) out[o.id] = { ok: false, reason: reason.orbitNoRocket(o.name) };
    else if (cheapest > scenario.budgetM) out[o.id] = { ok: false, reason: reason.orbitTooExpensive(cheapest) };
    else out[o.id] = { ok: true };
  }
  return out;
}

function stationLocks(data: GameData, orbit: Orbit | undefined, radio: Part | undefined): Record<string, Availability> {
  const out: Record<string, Availability> = {};
  for (const s of data.stations) {
    if (orbit && !(s.passesPerDay[orbit.id] > 0)) out[s.id] = { ok: false, reason: reason.stationOrbit(orbit.name) };
    else if (radio?.band && !s.bands.includes(radio.band)) out[s.id] = { ok: false, reason: reason.stationBand(BAND_NAMES[radio.band]) };
    else out[s.id] = { ok: true };
  }
  return out;
}

/** Can one more of each part be added right now? */
function partLocks(all: Part[], onCraft: Part[], bus: Bus | undefined, slotsUsed: number): Record<string, Availability> {
  const free = (bus?.slots ?? 0) - slotsUsed;
  const out: Record<string, Availability> = {};
  for (const p of all) {
    const count = onCraft.filter((x) => x.id === p.id).length;
    if (bus && p.fits && !p.fits.includes(bus.size)) out[p.id] = { ok: false, reason: reason.partNoFit(bus.name) };
    else if (p.maxPerCraft !== undefined && count >= p.maxPerCraft) out[p.id] = { ok: false, reason: reason.partMax(p.maxPerCraft) };
    else if (bus && p.slots > free) out[p.id] = { ok: false, reason: reason.partNoSlots(p.slots, Math.max(0, free)) };
    else out[p.id] = { ok: true };
  }
  return out;
}

/** Re-exported so the UI can clamp the altitude slider the same way. */
export { clampAltitude };
