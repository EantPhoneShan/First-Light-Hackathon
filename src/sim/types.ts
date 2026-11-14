/**
 * Types for the stand-in flight simulation (src/sim/standInSim.ts).
 * Member 1's simulate.ts will return SimResult (src/engine/types.ts); when it lands,
 * the simulation view switches to that and these types go away.
 */
import type { Design } from '@/engine/types'

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
  deliveredMB: number
}

export interface SimState {
  tMin: number
  batteryWh: number
  bufferMB: number
  madeMB: number
  deliveredMB: number
  lostMB: number
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
  madeMB: number
  deliveredMB: number
  lostMB: number
  events: SimEvent[]
  samples: SimSample[]
  designVersion: number
  /** Snapshot of the design that flew, so the report still matches after edits. */
  design: Design
}
