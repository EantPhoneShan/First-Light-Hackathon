import type { DisposalPlan } from '@/engine/types'

/** End-of-mission plans the Mission Planner can pick (F10), with plain-English notes. */
export const disposals: { id: DisposalPlan; label: string; what: string }[] = [
  { id: 'natural-decay', label: 'Let air drag bring it down', what: 'Free, but only works if the orbit is low enough to fall within the time limit.' },
  { id: 'deorbit-burn', label: 'Fire a thruster at the end', what: 'Needs a thruster and enough fuel (delta-v), but works from any low orbit.' },
  { id: 'graveyard', label: 'Move to a graveyard orbit', what: 'Only for GEO: push the craft higher, out of the busy ring.' },
  { id: 'none', label: 'No plan yet', what: 'The craft could stay up as space junk for decades.' },
]
