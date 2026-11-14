/**
 * A finished flight, kept in the store for the report and the ghost of the next flight.
 * The flight itself is Member 1's SimResult (src/engine/simulate.ts).
 */
import type { Design, SimResult } from '@/engine/types'

export interface FlightResult {
  sim: SimResult
  /** Snapshot of the design that flew, so the report still matches after edits. */
  design: Design
  designVersion: number
  scenarioId: string
  /** Every role had approved this exact design at launch (for the collaboration score). */
  allApproved: boolean
}
