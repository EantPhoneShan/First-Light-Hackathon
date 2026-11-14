/**
 * First Light game engine: shared types (task 1.1).
 *
 * This file is the contract between the three members:
 *   Member 1 (engine)  computes results from a Design.
 *   Member 2 (UI)      shows them and edits the Design.
 *   Member 3 (sync)    stores the Design as four role sections (see src/sync/types.ts).
 *
 * Pure types and constants only: no UI, no network, so the score Lambda can import it.
 * Every number in the data files is approximate and names its source (see SourceId).
 */
import type { Role } from '../sync/types';

export type { Role };

// ---------------------------------------------------------------------------
// Sources: where each number comes from (shown in tooltips and credits)
// ---------------------------------------------------------------------------

/** The challenge text and the NASA resources from the challenge Resources tab. */
export type SourceId =
  | 'challenge' // NASA Space Apps 2026 challenge text
  | 'cubesat101' // NASA CubeSat 101 (CSLI)
  | 'science-missions' // NASA "Design and Develop Science Missions" (four segments)
  | 'cml' // JPL Concept Maturity Levels
  | 'mdl' // Goddard Mission Design Lab
  | 'gmat' // NASA General Mission Analysis Tool (orbit values to check against)
  | 'physics' // Textbook formula (orbit period, eclipse, rocket equation)
  | 'estimate'; // Rounded game value; the note says what it is based on

// ---------------------------------------------------------------------------
// Basic vocabulary
// ---------------------------------------------------------------------------

/** The four mission segments from "Design and Develop Science Missions". */
export type Segment = 'launch' | 'space' | 'ground' | 'user';

/** Resources the engine checks. The first six are the challenge's list; delta-v is ours. */
export type ResourceId = 'mass' | 'power' | 'budget' | 'data' | 'comms' | 'time' | 'deltaV';
export const RESOURCES: ResourceId[] = ['mass', 'power', 'budget', 'data', 'comms', 'time', 'deltaV'];

export const RESOURCE_LABELS: Record<ResourceId, string> = {
  mass: 'Mass',
  power: 'Power',
  budget: 'Budget',
  data: 'Data storage',
  comms: 'Communications',
  time: 'Time',
  deltaV: 'Delta-v',
};

/** Which role is responsible for each resource (whose panel shows the warning). */
export const RESOURCE_OWNER: Record<ResourceId, Role> = {
  mass: 'engineer',
  power: 'engineer',
  budget: 'planner',
  data: 'science',
  comms: 'flight',
  time: 'planner',
  deltaV: 'flight',
};

export type Tier = 'simple' | 'advanced';
export type Band = 'uhf' | 's' | 'x';
export type BusSize = 'cubesat' | 'smallsat' | 'large';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

/** Fields every data entry has, so the UI can show a tooltip and a credit. */
interface Described {
  id: string;
  name: string;
  /** Plain-English tooltip, one or two short sentences (F21). */
  tooltip: string;
  learnMoreUrl?: string;
  source: SourceId;
  /** What the rounded number is based on, e.g. "CubeSat 101: 1U is 1 to 1.33 kg". */
  sourceNote?: string;
}

// ---------------------------------------------------------------------------
// Data files (src/data/*.json)
// ---------------------------------------------------------------------------

export type PartCategory =
  | 'solar'
  | 'battery'
  | 'computer'
  | 'adcs' // attitude control: magnetorquer, reaction wheel
  | 'propulsion'
  | 'thermal'
  | 'antenna'
  | 'instrument';

/** Who may add or remove a part of each category. */
export const CATEGORY_OWNER: Record<PartCategory, Role> = {
  solar: 'engineer',
  battery: 'engineer',
  computer: 'engineer',
  adcs: 'engineer',
  propulsion: 'engineer',
  thermal: 'engineer',
  antenna: 'flight',
  instrument: 'science',
};

/** One spacecraft part. Only the fields for its category are set. */
export interface Part extends Described {
  category: PartCategory;
  tier: Tier;
  /** Bus slots it fills. 0 = mounted outside (solar cells and wings). */
  slots: number;
  /** Most copies allowed on one craft (e.g. 1 pair of solar wings). */
  maxPerCraft?: number;
  /** Bus sizes it fits on. Missing = all. */
  fits?: BusSize[];
  massKg: number;
  /** Average power the part uses while the craft runs, in watts. */
  powerW: number;
  costM: number;
  /** Months to buy or build it and get it ready for integration. */
  buildMonths: number;
  /** Chance it works for the whole mission, 0 to 1 (used for risk, P1). */
  reliability: number;
  /** Art file in public/assets/, named by part id. */
  icon: string;

  /** solar: watts made while in sunlight (already allows for pointing). */
  generationW?: number;
  /** battery: stored energy in watt-hours. */
  capacityWh?: number;
  /** computer: onboard data storage in MB. */
  storageMB?: number;
  /** antenna: radio band and downlink speed. */
  band?: Band;
  dataRateMbps?: number;
  /** propulsion: propellant carried (included in massKg) and engine efficiency. */
  propellantKg?: number;
  ispS?: number;
  /** instrument: data made per orbit, what it can measure, science points. */
  dataMBPerOrbit?: number;
  measures?: string[];
  scienceValue?: number;
}

/** The spacecraft body. It sets the slots and the mass limit. */
export interface Bus extends Described {
  size: BusSize;
  slots: number;
  /** Most the whole craft may weigh on this bus (CubeSat standard for CubeSats). */
  maxMassKg: number;
  massKg: number;
  /** Housekeeping power that is always on. */
  powerW: number;
  costM: number;
  /** Months to build, integrate and test the craft (the longest part can add to it). */
  buildMonths: number;
  reliability: number;
  icon: string;
}

export type LauncherClass = 'rideshare' | 'small' | 'medium' | 'heavy' | 'super-heavy';

/** A generic launch vehicle class (no real brands). */
export interface Launcher extends Described {
  class: LauncherClass;
  costM: number;
  /** Most mass it can put into each orbit, by orbit id. Missing orbit = can't go there. */
  capacityKg: Record<string, number>;
  /** Biggest bus it can carry. */
  maxBus: BusSize;
  reliability: number;
  icon: string;
}

export type OrbitKind = 'leo' | 'sso' | 'geo';

export interface Orbit extends Described {
  kind: OrbitKind;
  /** Default altitude and the slider range, in km. */
  altitudeKm: number;
  minAltitudeKm: number;
  maxAltitudeKm: number;
  inclinationDeg: number;
  /**
   * Sun angle to the orbit plane used for the eclipse check, in degrees.
   * 0 = longest possible eclipse. The engine uses the worst case for the mission.
   */
  betaDeg: number;
  /** Days between looks at the same spot on the ground. */
  revisitDays: number;
}

/** Years an uncontrolled small craft stays up at each altitude (approximate). */
export interface DecayPoint {
  altitudeKm: number;
  years: number;
}

export interface GroundStation extends Described {
  lat: number;
  lon: number;
  bands: Band[];
  /** Usable passes per day for each orbit id. Missing orbit = never in view. */
  passesPerDay: Record<string, number>;
  passMinutes: number;
  costPerYearM: number;
  icon: string;
}

/** CML 1 science traceability: goal, then measurement, then instruments (F3). */
export interface Measurement {
  id: string;
  name: string;
  /** Plain-English reason this measurement serves the goal. */
  why: string;
  instrumentIds: string[];
}

export interface ScienceGoal {
  id: string;
  name: string;
  measurements: Measurement[];
}

export interface Scenario extends Described {
  objective: string;
  difficulty: Difficulty;
  /** User segment: who uses the data and how fast they need it. */
  customer: { name: string; needsDataWithinHours: number };
  busIds: string[];
  budgetM: number;
  /** Operations cost per year before ground stations (team, mission control). */
  baseOpsCostPerYearM: number;
  /** Months from the start of the project to launch day. */
  launchInMonths: number;
  lifetimeYears: number;
  /** Required days between looks at the target area. */
  revisitDays: number;
  /** The 2 resources this scenario is mainly about (they glow in the UI). */
  criticalResources: ResourceId[];
  goals: ScienceGoal[];
  eventsAllowed: string[];
  /** The tutorial's deliberately flawed starting design (F1), if this scenario has one. */
  tutorialDesign?: Design;
}

/** A resource we credit (src/data/sources.json). */
export interface Source {
  id: SourceId;
  title: string;
  url?: string;
}

/** A source reference for a whole table, e.g. the decay table. */
export interface SourceRef {
  source: SourceId;
  sourceNote?: string;
}

/** Everything loaded from the data files, passed into every engine function. */
export interface GameData {
  parts: Part[];
  buses: Bus[];
  launchers: Launcher[];
  orbits: Orbit[];
  decay: DecayPoint[];
  decaySource: SourceRef;
  /** Most years a dead craft may stay in orbit before it must come down. */
  disposalRuleYears: number;
  disposalSource: SourceRef;
  stations: GroundStation[];
  scenarios: Scenario[];
  sources: Source[];
}

// ---------------------------------------------------------------------------
// Design: what the players build. Stored as one sync section per role.
// ---------------------------------------------------------------------------

/** End-of-mission plan (F10). */
export type DisposalPlan = 'none' | 'natural-decay' | 'deorbit-burn' | 'graveyard';

/** Mission Planner: requirements and the end-of-mission plan. */
export interface PlannerData {
  /** CML 2 sliders, each 0 to 1: how much the score values each (F4). */
  weights: { coverage: number; detail: number; lifetime: number };
  disposal: DisposalPlan;
}

/** Science Lead: user segment and instruments. */
export interface ScienceData {
  goalId: string | null;
  measurementId: string | null;
  /** Part ids; the same id twice = two copies. */
  instrumentIds: string[];
}

/** Spacecraft Engineer: space segment except instruments and antennas. */
export interface EngineerData {
  busId: string | null;
  /** Solar, battery, computer, attitude control, propulsion and thermal part ids. */
  partIds: string[];
}

/** Comms and Flight Dynamics: launch and ground segments, plus antennas. */
export interface FlightData {
  orbitId: string | null;
  /** Chosen on the altitude slider; null = the orbit's default. */
  altitudeKm: number | null;
  launcherId: string | null;
  antennaIds: string[];
  stationIds: string[];
}

/** The full design. Same shape as mergedDesign(room) from src/sync. */
export interface Design {
  planner: PlannerData;
  science: ScienceData;
  engineer: EngineerData;
  flight: FlightData;
}

// ---------------------------------------------------------------------------
// Rules engine results (tasks 1.4 and 1.5)
// ---------------------------------------------------------------------------

export type Status = 'ok' | 'warn' | 'fail';

/** One of the live gauges on the workbench (F7). */
export interface Gauge {
  resource: ResourceId;
  label: string;
  used: number;
  limit: number;
  unit: string;
  /** (limit - used) / limit as a percentage. Negative = over the limit. */
  marginPct: number;
  status: Status;
  /** True for the scenario's critical resources (the gauge glows). */
  critical: boolean;
  owner: Role;
}

export type ProblemKind = ResourceId | 'slots' | 'compat' | 'science' | 'lifetime' | 'disposal' | 'missing';

/** A failed or risky check, with its why sentence (1.5). */
export interface Problem {
  id: string;
  kind: ProblemKind;
  status: 'warn' | 'fail';
  /** Plain sentence with the numbers, e.g. "Your battery runs out 20 minutes into eclipse." */
  why: string;
  /** What to try, e.g. "Try X-band or a second ground station." */
  hint?: string;
  /** The role whose panel shows it. */
  owner: Role;
  /** Parts to highlight on the workbench (F18). */
  partIds: string[];
  /**
   * True only for builds that cannot exist (nothing picked, slots full, no radio,
   * rocket can't reach the orbit). Every other fail may still launch and fail in
   * the simulation, so players learn by failing.
   */
  blocking: boolean;
}

/** Whether a choice can be picked, and why not (greyed out with a reason). */
export interface Availability {
  ok: boolean;
  reason?: string;
}

export interface Compatibility {
  launchers: Record<string, Availability>;
  orbits: Record<string, Availability>;
  instruments: Record<string, Availability>;
  stations: Record<string, Availability>;
  parts: Record<string, Availability>;
}

/** Orbit numbers worked out from the altitude. */
export interface OrbitInfo {
  altitudeKm: number;
  periodMin: number;
  orbitsPerDay: number;
  eclipseMin: number;
  eclipseFraction: number;
  /** Years before drag brings it down with no propulsion. */
  decayYears: number;
}

/** Totals behind the gauges, for tooltips and the review screen. */
export interface Totals {
  massKg: number;
  massLimitKg: number;
  slotsUsed: number;
  slots: number;
  powerDrawW: number;
  /** Average solar power over a whole orbit (sunlight and eclipse). */
  powerAvgW: number;
  batteryUsableWh: number;
  eclipseNeedWh: number;
  dataMBPerDay: number;
  downlinkMBPerDay: number;
  storageMB: number;
  /** Largest pile of data between two ground passes. */
  bufferNeedMB: number;
  /** Average wait between ground passes: how stale the data is when it lands. */
  latencyHours: number;
  costPartsM: number;
  costLaunchM: number;
  costOpsM: number;
  costTotalM: number;
  buildMonths: number;
  deltaVHaveMs: number;
  deltaVNeedMs: number;
}

export interface Evaluation {
  gauges: Record<ResourceId, Gauge>;
  problems: Problem[];
  compat: Compatibility;
  orbit: OrbitInfo | null;
  totals: Totals;
  /** True when nothing is red: the design should work (green review). */
  ready: boolean;
  /** True when nothing is blocking: the Launch button can be pressed, even with reds (F12). */
  canLaunch: boolean;
}

// ---------------------------------------------------------------------------
// Simulation, score and report (tasks 1.6 to 1.8). Shapes agreed now so
// Member 2 can build the simulation view and report with mock data.
// ---------------------------------------------------------------------------

/**
 * One sample of the mission (F14). The first day has one frame per minute, so
 * eclipses and passes can be animated; after that there is one frame per orbit,
 * and batteryWh/batteryPct hold that orbit's lowest point (so dips still show).
 */
export interface SimFrame {
  /** Mission time in minutes since orbit insertion. */
  tMin: number;
  /** Angle around the orbit in degrees, for drawing the craft. */
  orbitAngleDeg: number;
  inEclipse: boolean;
  /** Over a ground station and sending data. */
  downlinking: boolean;
  stationId: string | null;
  batteryWh: number;
  batteryPct: number;
  bufferMB: number;
  bufferPct: number;
  /** Total data that has reached the ground so far. */
  deliveredMB: number;
  /** Data thrown away because storage was full. */
  lostMB: number;
  propellantKg: number;
  /** 0 to 100. */
  health: number;
  scienceScore: number;
  /** False once the craft has died. */
  alive: boolean;
}

export type MarkerKind = 'eclipse' | 'battery-dead' | 'data-lost' | 'event' | 'part-failed' | 'deorbit' | 'mission-end';

/** A point on the mission timeline to flag in the simulation view and report. */
export interface SimMarker {
  tMin: number;
  kind: MarkerKind;
  status: Status;
  label: string;
  why?: string;
  hint?: string;
  owner?: Role;
  partIds?: string[];
}

export type Outcome = 'success' | 'partial' | 'failure' | 'launch-failure';

/** End-of-flight numbers for the report and the score. */
export interface SimSummary {
  madeMB: number;
  deliveredMB: number;
  lostMB: number;
  /** Delivered within the customer's deadline (e.g. firefighters: 12 hours). */
  onTimeMB: number;
  /** delivered / made, 0 to 100. */
  deliveredPct: number;
  /** onTime / made, 0 to 100. */
  onTimePct: number;
  /** Average age of data when it reached the ground. */
  avgDelayHours: number;
  orbits: number;
  eclipses: number;
  /** When the craft died, or null. */
  diedAtMin: number | null;
  /** When drag brought it down before the end, or null. */
  reenteredAtMin: number | null;
  /** End of mission: did the craft leave orbit within the debris rule? */
  disposal: 'ok' | 'debris' | 'not-reached';
  /** Solar power left at the end, as % of new (panels wear out). */
  solarHealthPct: number;
}

export interface SimResult {
  frames: SimFrame[];
  markers: SimMarker[];
  outcome: Outcome;
  /** Minutes the craft survived (equals the mission length on success). */
  survivedMin: number;
  missionMin: number;
  /** Frames are one per minute up to here, then one per orbit. */
  detailUntilMin: number;
  summary: SimSummary;
}

/**
 * Live simulation state for the playback view (stepSim mutates it).
 * frames and markers grow as the mission plays.
 */
export interface SimState {
  tMin: number;
  orbitAngleDeg: number;
  inEclipse: boolean;
  downlinking: boolean;
  stationId: string | null;
  batteryWh: number;
  bufferMB: number;
  madeMB: number;
  deliveredMB: number;
  lostMB: number;
  onTimeMB: number;
  /** Sum of (MB sent x its age in minutes), for the average delay. */
  delayMBMin: number;
  propellantKg: number;
  health: number;
  scienceScore: number;
  alive: boolean;
  /** True once the mission is over (complete, dead or re-entered). */
  done: boolean;
  orbits: number;
  eclipses: number;
  diedAtMin: number | null;
  reenteredAtMin: number | null;
  frames: SimFrame[];
  markers: SimMarker[];
  /** Lowest battery seen in the current orbit (for per-orbit frames). */
  orbitMinBatteryWh: number;
  /** Markers already shown once, by key. */
  seen: Record<string, true>;
  /**
   * Time asked for but not simulated yet. The engine only takes whole steps,
   * so live playback at any speed gives exactly the same flight as simulate().
   */
  carryMin: number;
}

export type ScoreCategory = 'objective' | 'customer' | 'efficiency' | 'lifetime' | 'decisions' | 'collaboration';

/** Most points per category (PRD scoring table, total 1000). */
export const SCORE_MAX: Record<ScoreCategory, number> = {
  objective: 350,
  customer: 200,
  efficiency: 150,
  lifetime: 125,
  decisions: 125,
  collaboration: 50,
};

export interface ScoreResult {
  total: number;
  stars: 0 | 1 | 2 | 3;
  byCategory: Record<ScoreCategory, number>;
}
