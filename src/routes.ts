import { STEPS } from '@/engine/flow'

/**
 * Mission flow, in order, for the stepper. Comes from Member 1's STEPS
 * (engine/flow.ts) so screens and rules always agree. The lobby is not a step
 * on the stepper.
 */
export const flow = STEPS.filter((s) => s.id !== 'lobby')
