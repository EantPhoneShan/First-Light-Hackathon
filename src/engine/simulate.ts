/**
 * Mission simulation (task 1.6). Fixed time step of 1 minute (PRD: "believable
 * is enough"), deterministic: the same design always flies the same way on
 * every device and in the score Lambda. Random events come in task 1.9.
 *
 * Two ways to use it:
 *
 *   Live playback (simulation view, pause and speed controls):
 *     const setup = createSim(design, scenario, gameData);
 *     const state = initialState(setup);
 *     stepSim(state, setup, minutes);      // each animation frame; mutates state
 *     craftAngleDeg(setup, state.tMin);    // for drawing
 *     const result = finishSim(state, setup); // once state.done
 *
 *   Whole flight at once (report, score, re-fly ghost, Lambda):
 *     const result = simulate(design, scenario, gameData);
 *
 * Models (all approximate):
 *   Eclipse: the shadow is centred half-way round each orbit (orbit.ts geometry).
 *   Power: solar panels charge the battery in sunlight and wear by 2% a year;
 *     the battery is the usable share only (RULES.batteryUsable). Empty = dead.
 *   Data: instruments fill storage at a steady rate; ground passes are spaced
 *     evenly through the day per station; full storage throws new data away.
 *   Drag: if the orbit decays before the mission ends, the craft re-enters.
 */
import { RULES, evaluate } from './rules';
import { allPartIds } from './design';
import { judgeChoice, rollChance, scheduleEvents } from './events';
import type { Why } from './why';
import { flight, when } from './why';
import type {
  Design,
  EventChoice,
  Evaluation,
  GameData,
  GameEvent,
  Part,
  Scenario,
  ScheduledEvent,
  SimFrame,
  SimMarker,
  SimResult,
  SimState,
  Status,
} from './types';

/** Options for one flight. */
export interface SimOptions {
  /** Shared random seed (room.seed). Same seed = same events everywhere. */
  seed?: number;
  /** Choices already made, by event id: replays a flight exactly (report, ghost, Lambda). */
  choices?: Record<string, string>;
  /** Pick the first choice for any event not in `choices`, instead of pausing. */
  autoChoose?: boolean;
  /** Turn random events off (e.g. the tutorial). Default on. */
  events?: boolean;
}

/** Seed used when none is given (solo quick runs, tests). */
export const DEFAULT_SEED = 1;

export const SIM = {
  /** One frame per minute up to here, then one per orbit. */
  detailUntilMin: 1440,
  /** Largest physics step, in minutes. */
  maxStepMin: 1,
  /** Spread between station pass times, so passes don't all line up (minutes). */
  stationOffsetMin: 47,
};

const MIN_PER_YEAR = 365.25 * 1440;

interface Pass {
  stationId: string;
  intervalMin: number;
  offsetMin: number;
  lengthMin: number;
}

/** Fixed numbers for one design, worked out once before flying. */
export interface SimSetup {
  evaluation: Evaluation;
  /** Null when the craft reaches orbit; otherwise why the launch failed. */
  launchFailure: Why | null;
  periodMin: number;
  eclipseMin: number;
  eclipseFraction: number;
  missionMin: number;
  /** When drag brings the craft down, if before the end of the mission. */
  reentryMin: number | null;
  sunlitW: number;
  drawW: number;
  batteryUsableWh: number;
  dataPerMin: number;
  dataMBPerDay: number;
  storageMB: number;
  radioMBPerMin: number;
  passes: Pass[];
  /** GEO: one station is always in view. */
  continuousStationId: string | null;
  propellantKg: number;
  /** Science points earned per full day of data delivered. */
  sciencePerDay: number;
  customerDeadlineMin: number;
  /** Average power was already short before any wear (rules: power.average). */
  powerShort: boolean;
  batteryPartIds: string[];
  solarPartIds: string[];
  /** What happens at the end of the mission. */
  disposal: { status: Status; why: Why; ok: boolean };
  /** Power the instruments use (saved while they are switched off). */
  instrumentDrawW: number;
  seed: number;
  /** Events planned for this flight, in time order. */
  schedule: ScheduledEvent[];
  eventsById: Record<string, GameEvent>;
  choices: Record<string, string>;
  autoChoose: boolean;
  /** Random events are on for this flight (off for the tutorial). */
  eventsEnabled: boolean;
}

export function createSim(design: Design, scenario: Scenario, data: GameData, opts: SimOptions = {}): SimSetup {
  const evaluation = evaluate(design, scenario, data);
  const has = (id: string) => evaluation.problems.find((p) => p.id === id);
  const blocking = evaluation.problems.find((p) => p.blocking);
  const tooHeavy = has('mass.rocket') ?? has('mass.bus');
  const launchFailure = blocking ? flight.launchFailed(blocking.why) : tooHeavy ? flight.launchFailed(tooHeavy.why) : null;

  const partById = new Map(data.parts.map((p) => [p.id, p]));
  const parts = allPartIds(design)
    .map((id) => partById.get(id))
    .filter((p): p is Part => !!p);
  const sum = (f: (p: Part) => number, ps: Part[] = parts) => ps.reduce((s, p) => s + f(p), 0);
  const bus = data.buses.find((b) => b.id === design.engineer.busId);
  const orbit = data.orbits.find((o) => o.id === design.flight.orbitId);
  const info = evaluation.orbit;
  const periodMin = info?.periodMin ?? 1440;
  const missionMin = scenario.lifetimeYears * MIN_PER_YEAR;

  // Radio and ground passes (same rules as the rules engine).
  const radio = parts.filter((p) => p.category === 'antenna').sort((a, b) => (b.dataRateMbps ?? 0) - (a.dataRateMbps ?? 0))[0];
  const passes: Pass[] = [];
  let continuousStationId: string | null = null;
  if (orbit && radio?.band) {
    const usable = data.stations.filter(
      (s) => design.flight.stationIds.includes(s.id) && (s.passesPerDay[orbit.id] ?? 0) > 0 && s.bands.includes(radio.band!),
    );
    usable.forEach((s, i) => {
      if (orbit.kind === 'geo') {
        continuousStationId ??= s.id;
        return;
      }
      const interval = 1440 / s.passesPerDay[orbit.id];
      passes.push({ stationId: s.id, intervalMin: interval, offsetMin: (i * SIM.stationOffsetMin) % interval, lengthMin: s.passMinutes });
    });
  }

  const instruments = parts.filter((p) => p.category === 'instrument');
  const dataPerMin = sum((p) => p.dataMBPerOrbit ?? 0, instruments) / periodMin;
  const decayMin = info && Number.isFinite(info.decayYears) ? info.decayYears * MIN_PER_YEAR : Infinity;
  const seed = opts.seed ?? DEFAULT_SEED;
  const schedule = opts.events === false || launchFailure ? [] : scheduleEvents(seed, scenario, data.events, missionMin);

  return {
    instrumentDrawW: sum((p) => p.powerW, instruments),
    seed,
    schedule,
    eventsById: Object.fromEntries(data.events.map((e) => [e.id, e])),
    choices: opts.choices ?? {},
    autoChoose: opts.autoChoose ?? false,
    eventsEnabled: opts.events !== false,
    evaluation,
    launchFailure,
    periodMin,
    eclipseMin: info?.eclipseMin ?? 0,
    eclipseFraction: info?.eclipseFraction ?? 0,
    missionMin,
    reentryMin: decayMin < missionMin ? decayMin : null,
    sunlitW: sum((p) => p.generationW ?? 0),
    drawW: (bus?.powerW ?? 0) + sum((p) => p.powerW),
    batteryUsableWh: evaluation.totals.batteryUsableWh,
    dataPerMin,
    dataMBPerDay: dataPerMin * 1440,
    storageMB: evaluation.totals.storageMB,
    radioMBPerMin: ((radio?.dataRateMbps ?? 0) * 60) / 8,
    passes,
    continuousStationId,
    propellantKg: sum((p) => p.propellantKg ?? 0),
    sciencePerDay: sum((p) => p.scienceValue ?? 0, instruments),
    customerDeadlineMin: scenario.customer.needsDataWithinHours * 60,
    powerShort: !!has('power.average'),
    batteryPartIds: parts.filter((p) => p.category === 'battery').map((p) => p.id),
    solarPartIds: parts.filter((p) => p.category === 'solar').map((p) => p.id),
    disposal: disposalOutcome(design, evaluation, data),
  };
}

function disposalOutcome(design: Design, ev: Evaluation, data: GameData): SimSetup['disposal'] {
  const failed = ev.problems.some((p) => p.status === 'fail' && (p.kind === 'disposal' || p.kind === 'deltaV'));
  const decay = ev.orbit?.decayYears ?? Infinity;
  if (failed) return { ok: false, status: 'warn', why: flight.disposalDebris(decay, data.disposalRuleYears) };
  const plan = design.planner.disposal;
  if (plan === 'graveyard') return { ok: true, status: 'ok', why: flight.disposalGraveyard() };
  // A burn plan with no thruster still ends well if drag brings the craft down in time.
  if (plan === 'deorbit-burn' && ev.totals.deltaVHaveMs > 0) return { ok: true, status: 'ok', why: flight.disposalBurn() };
  return { ok: true, status: 'ok', why: flight.disposalDecay(decay) };
}

/** Angle round the orbit in degrees (0 = orbit insertion, in sunlight). */
export function craftAngleDeg(setup: SimSetup, tMin: number): number {
  return ((tMin % setup.periodMin) / setup.periodMin) * 360;
}

/** The shadow is centred half-way round each orbit. */
export function inEclipseAt(setup: SimSetup, tMin: number): boolean {
  if (setup.eclipseFraction <= 0) return false;
  const phase = (tMin % setup.periodMin) / setup.periodMin;
  return Math.abs(phase - 0.5) < setup.eclipseFraction / 2;
}

/** Minutes since the current eclipse began. */
function minutesIntoEclipse(setup: SimSetup, tMin: number): number {
  const phase = (tMin % setup.periodMin) / setup.periodMin;
  return (phase - (0.5 - setup.eclipseFraction / 2)) * setup.periodMin;
}

function stationInView(setup: SimSetup, tMin: number): string | null {
  if (setup.continuousStationId) return setup.continuousStationId;
  for (const p of setup.passes) {
    if ((tMin + p.offsetMin) % p.intervalMin < p.lengthMin) return p.stationId;
  }
  return null;
}

export function initialState(setup: SimSetup): SimState {
  const s: SimState = {
    tMin: 0,
    orbitAngleDeg: 0,
    inEclipse: false,
    downlinking: false,
    stationId: null,
    batteryWh: setup.batteryUsableWh,
    bufferMB: 0,
    madeMB: 0,
    deliveredMB: 0,
    lostMB: 0,
    onTimeMB: 0,
    delayMBMin: 0,
    propellantKg: setup.propellantKg,
    health: 100,
    scienceScore: 0,
    alive: !setup.launchFailure,
    done: !!setup.launchFailure,
    orbits: 0,
    eclipses: 0,
    diedAtMin: null,
    reenteredAtMin: null,
    firstLightMin: null,
    frames: [],
    markers: [],
    orbitMinBatteryWh: setup.batteryUsableWh,
    seen: {},
    carryMin: 0,
    pendingEvent: null,
    nextEventIndex: 0,
    eventLog: [],
    effects: [],
    radioLost: false,
    solarFactor: 1,
  };
  if (setup.launchFailure) {
    s.health = 0;
    s.markers.push({ tMin: 0, kind: 'mission-end', status: 'fail', label: 'Launch failed', ...setup.launchFailure, owner: 'flight' });
  } else {
    s.frames.push(frameOf(s, setup, s.batteryWh));
  }
  return s;
}

/**
 * Advances the mission by `minutes` (any amount, e.g. per animation frame).
 * Only whole steps are simulated; the rest is carried to the next call, so the
 * flight is identical whatever the playback speed. Mutates and returns the state.
 */
export function stepSim(s: SimState, setup: SimSetup, minutes: number): SimState {
  // Paused on an event card: time stands still until chooseEvent().
  if (s.pendingEvent) return s;
  let remaining = s.carryMin + minutes;
  while (!s.done) {
    const t0 = s.tMin;

    // A random event is due: replay a known choice, auto-pick, or pause for the team.
    const due = setup.schedule[s.nextEventIndex];
    if (due && t0 >= due.tMin - 1e-9) {
      const ev = setup.eventsById[due.eventId];
      const known = setup.choices[due.eventId];
      const choice = ev?.choices.find((c) => c.id === known) ?? (setup.autoChoose ? ev?.choices[0] : undefined);
      if (!ev) {
        s.nextEventIndex++;
        continue;
      }
      if (!choice) {
        s.pendingEvent = due;
        break;
      }
      applyChoice(s, setup, due, ev, choice);
      continue;
    }

    // The step never depends on `minutes`, only on the mission clock.
    const dt = Math.min(SIM.maxStepMin, setup.missionMin - t0, (setup.reentryMin ?? Infinity) - t0, due ? due.tMin - t0 : Infinity);
    if (dt <= 0 || remaining < dt - 1e-9) break;
    const mid = t0 + dt / 2;
    const ecl = inEclipseAt(setup, mid);
    const years = t0 / MIN_PER_YEAR;
    const active = (kind: SimState['effects'][number]['kind']) => s.effects.find((e) => e.kind === kind && e.untilMin > t0);
    const instrumentsOff = !!active('instrumentsOff');
    const dataFactor = active('dataFactor')?.factor ?? 1;
    const noLink = s.radioLost || !!active('radioOff') || !!active('stationOutage');

    // Entering Earth's shadow.
    if (ecl && !s.inEclipse) {
      s.eclipses++;
      if (s.eclipses === 1) mark(s, 'first-eclipse', { tMin: t0, kind: 'eclipse', status: 'ok', label: 'First eclipse', ...flight.firstEclipse(setup.eclipseMin) });
    }

    // Power.
    const wear = Math.max(0, 1 - RULES.solarWearPerYear * years) * s.solarFactor;
    const gen = ecl ? 0 : setup.sunlitW * wear;
    const draw = setup.drawW - (instrumentsOff ? setup.instrumentDrawW : 0);
    s.batteryWh = Math.min(setup.batteryUsableWh, s.batteryWh + ((gen - draw) * dt) / 60);
    if (s.batteryWh <= 0) {
      s.batteryWh = 0;
      s.tMin = t0 + dt;
      die(s, setup, ecl, wear);
      break;
    }
    s.orbitMinBatteryWh = Math.min(s.orbitMinBatteryWh, s.batteryWh);

    // Data in.
    const made = instrumentsOff ? 0 : setup.dataPerMin * dataFactor * dt;
    const bufferBefore = s.bufferMB;
    s.madeMB += made;
    s.bufferMB += made;

    // Data down.
    const station = noLink ? null : stationInView(setup, mid);
    let sent = 0;
    if (station && s.bufferMB > 0) {
      sent = Math.min(s.bufferMB, setup.radioMBPerMin * dt);
      // First in, first out: the data sent now is about this old.
      const ageMin = setup.dataPerMin > 0 ? Math.max(0, bufferBefore - sent / 2) / setup.dataPerMin : 0;
      s.delayMBMin += sent * ageMin;
      if (ageMin <= setup.customerDeadlineMin) s.onTimeMB += sent;
      if (s.firstLightMin === null && sent > 0) {
        s.firstLightMin = t0;
        s.markers.push({ tMin: t0, kind: 'event', status: 'ok', label: 'First light', why: 'The first data reaches the ground station.' });
      }
      s.deliveredMB += sent;
      s.bufferMB -= sent;
      if (setup.dataMBPerDay > 0) s.scienceScore += (sent / setup.dataMBPerDay) * setup.sciencePerDay;
    }

    // Storage full: new data is thrown away.
    if (s.bufferMB > setup.storageMB) {
      s.lostMB += s.bufferMB - setup.storageMB;
      s.bufferMB = setup.storageMB;
      const problem = setup.evaluation.problems.find((p) => p.kind === 'comms' || p.kind === 'data');
      mark(s, 'storage-full', {
        tMin: t0,
        kind: 'data-lost',
        status: 'warn',
        label: 'Storage full, data lost',
        ...flight.storageFull(when(t0, setup.periodMin)),
        ...(problem?.hint ? { hint: problem.hint } : {}),
        owner: 'flight',
      });
    }

    // Move on.
    s.tMin = t0 + dt;
    remaining -= dt;
    s.orbitAngleDeg = craftAngleDeg(setup, s.tMin);
    s.inEclipse = ecl;
    s.downlinking = sent > 0;
    s.stationId = station;

    // Frames: every minute on day 1, then once per orbit.
    const orbitIndex = Math.floor(s.tMin / setup.periodMin);
    if (orbitIndex > s.orbits) {
      s.orbits = orbitIndex;
      if (s.tMin > SIM.detailUntilMin) s.frames.push(frameOf(s, setup, s.orbitMinBatteryWh));
      s.orbitMinBatteryWh = s.batteryWh;
    }
    if (s.tMin <= SIM.detailUntilMin && Math.abs(s.tMin - Math.round(s.tMin)) < 1e-9) {
      s.frames.push(frameOf(s, setup, s.batteryWh));
    }

    // Drag brings it down early.
    if (setup.reentryMin !== null && s.tMin >= setup.reentryMin - 1e-9) {
      s.alive = false;
      s.done = true;
      s.health = 0;
      s.reenteredAtMin = s.tMin;
      const lifetimeYears = setup.missionMin / MIN_PER_YEAR;
      s.markers.push({ tMin: s.tMin, kind: 'deorbit', status: 'fail', label: 'Burned up early', ...flight.reentered(s.tMin / MIN_PER_YEAR, lifetimeYears), owner: 'flight' });
      s.frames.push(frameOf(s, setup, s.batteryWh));
      break;
    }

    // Mission complete.
    if (s.tMin >= setup.missionMin - 1e-9) {
      s.done = true;
      const deliveredPct = s.madeMB > 0 ? (s.deliveredMB / s.madeMB) * 100 : 0;
      s.markers.push({ tMin: s.tMin, kind: 'mission-end', status: 'ok', label: 'Mission complete', ...flight.complete(s.tMin / MIN_PER_YEAR, deliveredPct) });
      s.markers.push({
        tMin: s.tMin,
        kind: 'deorbit',
        status: setup.disposal.status,
        label: setup.disposal.ok ? 'End of mission' : 'Left as debris',
        ...setup.disposal.why,
        owner: 'planner',
      });
      if (setup.disposal.ok && setup.evaluation.totals.deltaVNeedMs > 0) s.propellantKg = 0;
      s.frames.push(frameOf(s, setup, s.batteryWh));
    }
  }
  s.carryMin = s.done || !Number.isFinite(remaining) ? 0 : Math.max(0, remaining);
  return s;
}

/**
 * The team's answer to the event card that paused the flight.
 * Returns false (and changes nothing) if no event is waiting or the id is unknown.
 */
export function chooseEvent(s: SimState, setup: SimSetup, choiceId: string): boolean {
  const due = s.pendingEvent;
  if (!due) return false;
  const ev = setup.eventsById[due.eventId];
  const choice = ev?.choices.find((c) => c.id === choiceId);
  if (!ev || !choice) return false;
  s.pendingEvent = null;
  applyChoice(s, setup, due, ev, choice);
  return true;
}

/** The event card waiting for a choice, if any (for the UI). */
export function pendingEventCard(s: SimState, setup: SimSetup): GameEvent | null {
  return s.pendingEvent ? (setup.eventsById[s.pendingEvent.eventId] ?? null) : null;
}

function applyChoice(s: SimState, setup: SimSetup, due: ScheduledEvent, ev: GameEvent, choice: EventChoice): void {
  const fx = choice.effects;
  const t = s.tMin;
  const facts = { freeStorageMB: Math.max(0, setup.storageMB - s.bufferMB), dataPerMin: setup.dataPerMin * (fx.dataFactor ?? 1) };
  const good = judgeChoice(choice, facts);
  const hit = rollChance(setup.seed, due, choice);

  // Always-on effects.
  if (fx.instrumentsOffHours) s.effects.push({ kind: 'instrumentsOff', untilMin: t + fx.instrumentsOffHours * 60 });
  if (fx.stationOutageHours) s.effects.push({ kind: 'stationOutage', untilMin: t + fx.stationOutageHours * 60 });
  if (fx.radioOffHours) s.effects.push({ kind: 'radioOff', untilMin: t + fx.radioOffHours * 60 });
  if (fx.dataFactor !== undefined) s.effects.push({ kind: 'dataFactor', untilMin: t + (fx.dataFactorHours ?? 24) * 60, factor: fx.dataFactor });
  // Harmful effects, only if the chance roll hits.
  if (hit) {
    if (fx.healthDelta) s.health = Math.max(0, Math.min(100, s.health + fx.healthDelta));
    if (fx.solarLossPct) s.solarFactor *= 1 - fx.solarLossPct / 100;
    if (fx.radioLost) s.radioLost = true;
  }

  const lucky = fx.chance !== undefined && !hit;
  const outcome = lucky
    ? (choice.outcomeIfLucky ?? choice.outcome)
    : choice.good === 'if-storage-holds' && !good
      ? (choice.outcomeIfFull ?? choice.outcome)
      : choice.outcome;
  const harmed = hit && (fx.healthDelta !== undefined || fx.solarLossPct !== undefined || fx.radioLost === true);
  s.eventLog.push({ eventId: ev.id, choiceId: choice.id, tMin: t, good, hit: harmed, outcome });
  s.markers.push({
    tMin: t,
    kind: 'event',
    status: harmed ? 'fail' : good ? 'ok' : 'warn',
    label: `${ev.name}: ${choice.label.toLowerCase()}`,
    why: outcome,
    owner: ev.owner,
  });
  s.nextEventIndex++;
}

function die(s: SimState, setup: SimSetup, inEclipse: boolean, wear: number): void {
  s.alive = false;
  s.done = true;
  s.health = 0;
  s.diedAtMin = s.tMin;
  const whenText = when(s.tMin, setup.periodMin);
  const avgWithWear = setup.sunlitW * wear * (1 - setup.eclipseFraction);
  let w: Why;
  let partIds = setup.batteryPartIds;
  if (setup.powerShort) {
    w = flight.diedDrain(whenText);
    partIds = setup.solarPartIds;
  } else if (avgWithWear < setup.drawW) {
    w = flight.diedWorn(whenText, (1 - wear) * 100);
    partIds = setup.solarPartIds;
  } else if (inEclipse) {
    w = flight.diedInEclipse(whenText, minutesIntoEclipse(setup, s.tMin), setup.eclipseMin);
  } else {
    w = flight.diedDrain(whenText);
  }
  s.markers.push({ tMin: s.tMin, kind: 'battery-dead', status: 'fail', label: 'Battery empty, craft lost', ...w, owner: 'engineer', partIds });
  s.frames.push(frameOf(s, setup, 0));
}

/** Adds a marker only the first time its key happens. */
function mark(s: SimState, key: string, m: SimMarker): void {
  if (s.seen[key]) return;
  s.seen[key] = true;
  s.markers.push(m);
}

function frameOf(s: SimState, setup: SimSetup, batteryWh: number): SimFrame {
  return {
    tMin: s.tMin,
    orbitAngleDeg: s.orbitAngleDeg,
    inEclipse: s.inEclipse,
    downlinking: s.downlinking,
    stationId: s.stationId,
    batteryWh,
    batteryPct: setup.batteryUsableWh > 0 ? (batteryWh / setup.batteryUsableWh) * 100 : 0,
    bufferMB: s.bufferMB,
    bufferPct: setup.storageMB > 0 ? (s.bufferMB / setup.storageMB) * 100 : 0,
    deliveredMB: s.deliveredMB,
    lostMB: s.lostMB,
    propellantKg: s.propellantKg,
    health: s.health,
    scienceScore: s.scienceScore,
    alive: s.alive,
  };
}

/** Wraps up a finished (or stopped) flight into a SimResult. */
export function finishSim(s: SimState, setup: SimSetup): SimResult {
  const deliveredPct = s.madeMB > 0 ? (s.deliveredMB / s.madeMB) * 100 : 0;
  const onTimePct = s.madeMB > 0 ? (s.onTimeMB / s.madeMB) * 100 : 0;
  const lost = s.diedAtMin !== null || s.reenteredAtMin !== null;
  const survivedShare = s.tMin / setup.missionMin;
  const outcome: SimResult['outcome'] = setup.launchFailure
    ? 'launch-failure'
    : lost
      ? survivedShare >= 0.5
        ? 'partial'
        : 'failure'
      : deliveredPct >= 90
        ? 'success'
        : deliveredPct >= 25
          ? 'partial'
          : 'failure';
  const completed = s.done && !lost && !setup.launchFailure;

  return {
    frames: s.frames,
    markers: s.markers,
    outcome,
    survivedMin: setup.launchFailure ? 0 : s.tMin,
    missionMin: setup.missionMin,
    detailUntilMin: SIM.detailUntilMin,
    summary: {
      madeMB: s.madeMB,
      deliveredMB: s.deliveredMB,
      lostMB: s.lostMB,
      onTimeMB: s.onTimeMB,
      deliveredPct,
      onTimePct,
      avgDelayHours: s.deliveredMB > 0 ? s.delayMBMin / s.deliveredMB / 60 : 0,
      firstLightMin: s.firstLightMin,
      orbits: s.orbits,
      eclipses: s.eclipses,
      diedAtMin: s.diedAtMin,
      reenteredAtMin: s.reenteredAtMin,
      disposal: !completed ? 'not-reached' : setup.disposal.ok ? 'ok' : 'debris',
      solarHealthPct: Math.max(0, 1 - RULES.solarWearPerYear * (s.tMin / MIN_PER_YEAR)) * s.solarFactor * 100,
    },
    events: s.eventLog,
    seed: setup.seed,
    eventsEnabled: setup.eventsEnabled,
  };
}

/** Choices made in a finished flight, to replay it exactly with simulate(..., { choices }). */
export function choicesOf(result: SimResult): Record<string, string> {
  return Object.fromEntries(result.events.map((e) => [e.eventId, e.choiceId]));
}

/**
 * Flies the whole mission at once. Events use `opts.choices` when given,
 * otherwise the first choice of each event (it never pauses).
 */
export function simulate(design: Design, scenario: Scenario, data: GameData, opts: SimOptions = {}): SimResult {
  const setup = createSim(design, scenario, data, { ...opts, autoChoose: true });
  const state = initialState(setup);
  stepSim(state, setup, Infinity);
  return finishSim(state, setup);
}
