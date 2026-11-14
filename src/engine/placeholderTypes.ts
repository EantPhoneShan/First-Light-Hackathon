/**
 * TEMPORARY placeholder types, written by Member 2 from the PRD.
 *
 * Member 1's real types have arrived in src/engine/types.ts (with rules.ts,
 * data.ts, design.ts). This file was moved here from types.ts during the merge
 * so the UI keeps compiling. Move each screen over to '@/engine/types' and the
 * real engine (evaluate() in rules.ts), then delete this file and the mock*.ts
 * files. Do not add game maths here.
 */

export type Role = 'planner' | 'engineer' | 'science' | 'flight'

export type Phase =
  | 'lobby'
  | 'briefing' // CML 1 Idea
  | 'feasibility' // CML 2
  | 'trade' // CML 3 (P1)
  | 'design' // CML 4 Point design
  | 'review'
  | 'launch'
  | 'sim'
  | 'report'

export type PartCategory =
  | 'bus'
  | 'power'
  | 'battery'
  | 'comms'
  | 'computer'
  | 'attitude'
  | 'propulsion'
  | 'thermal'
  | 'instrument'

export type Tier = 'simple' | 'advanced'

export interface Part {
  id: string
  category: PartCategory
  tier: Tier
  name: string
  massKg: number
  powerW: number // negative = generates power
  costM: number
  buildMonths: number
  reliability: number // 0..1
  dataPerOrbitGb?: number // instruments: data made per orbit
  downlinkGbPerPass?: number // radios: data sent per ground-station pass
  batteryWh?: number // batteries: stored energy
  storageGb?: number // computers: onboard data storage
  massLimitKg?: number // buses: how much the whole craft may weigh
  slots?: SlotDef[] // buses: which slots this bus size offers
  icon: string // public/assets/part-<id>.webp
  tooltip: string
}

/** Where a slot sits on the 2D spacecraft drawing. */
export type SlotZone = 'top' | 'left' | 'right' | 'core' | 'bottom'

export interface SlotDef {
  id: string // e.g. "instrument-1"
  accepts: PartCategory
  zone: SlotZone
  label: string
}

export interface Design {
  orbitId: string | null
  altitudeKm: number
  launcherId: string | null
  partsBySlot: Record<string, string | null> // slot id -> part id
  stationIds: string[]
  version: number
  updatedBy: Role | null
}

export interface Player {
  name: string
  role: Role
  approved: boolean
}

export interface Room {
  code: string
  scenarioId: string
  phase: Phase
  seed: string
  players: Player[]
}

export type ResourceKey =
  | 'mass'
  | 'power'
  | 'comms'
  | 'budget'
  | 'time'
  | 'deltaV'

export type Status = 'ok' | 'warn' | 'bad'

export interface Gauge {
  key: ResourceKey
  label: string
  used: number
  limit: number
  unit: string
  status: Status
  critical: boolean
  /** Short reason shown instead of the margin, e.g. "No ground station". */
  note?: string
}

export interface Orbit {
  id: string
  name: string
  short: string // e.g. "SSO"
  goodFor: string // plain-English card text
  altitudeKm: { min: number; max: number; default: number } | null // null = not a circular Earth orbit
  inclinationDeg: number | null
  tier: Tier
}

export interface Launcher {
  id: string
  name: string
  costM: number
  /** kg it can lift to each orbit id; missing = can't reach that orbit. */
  capacityKg: Record<string, number>
  tooltip: string
}

export interface Station {
  id: string
  name: string
  lat: number
  lon: number
  opsCostMPerYear: number
  note: string
}

export interface OrbitStats {
  periodMin: number
  orbitsPerDay: number
  eclipsePct: number
  eclipseMin: number
  revisitDays: number | null
  detailM: number | null // ground pixel size for a standard camera
  passesPerDay: number // with the chosen stations
}

export interface LaunchCheck {
  ok: boolean
  reason: string
}

export interface Warning {
  id: string
  resource: ResourceKey
  status: Status
  why: string
  hint: string
}

export interface Scenario {
  id: string
  name: string
  objective: string
  customer: string
  craft: string
  budgetM: number
  lifetimeYears: number
  launchDate: string
  critical: ResourceKey[]
  goodOrbits: string[]
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
}

/* ---------------- Simulation (Member 1 owns the real simulate.ts) ---------------- */

export type SimStatus = 'flying' | 'dead' | 'complete'

export interface SimEvent {
  tMin: number
  kind: 'info' | 'good' | 'warn' | 'bad'
  text: string
}

export interface SimSample {
  tMin: number
  batteryPct: number
  bufferPct: number
  deliveredGb: number
}

export interface SimState {
  tMin: number
  batteryWh: number
  bufferGb: number
  madeGb: number
  deliveredGb: number
  lostGb: number
  inEclipse: boolean
  inContact: boolean
  status: SimStatus
  events: SimEvent[]
  samples: SimSample[]
}

export interface FlightResult {
  status: SimStatus
  endMin: number
  lifetimeMin: number
  madeGb: number
  deliveredGb: number
  lostGb: number
  events: SimEvent[]
  samples: SimSample[]
  designVersion: number
  /** Snapshot of the design that flew, so the report still matches after edits. */
  design: Design
}
