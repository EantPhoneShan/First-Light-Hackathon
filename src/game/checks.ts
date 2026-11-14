/**
 * Design review checklist (F12) and conflict alerts (F11), built from Member 1's evaluate().
 * The checks are evaluate().problems as-is; green rows are added for gauges with nothing wrong.
 * Conflict alerts stay here until Member 1's alerts.ts lands.
 */
import { RESOURCES, RESOURCE_LABELS, type Evaluation, type ProblemKind, type ResourceId, type Role, type Status } from '@/engine/types'
import { GAUGE_WATCHER, n1, roleNames } from '@/game/ui'

export interface Check {
  id: string
  kind: ProblemKind
  label: string
  status: Status
  why: string
  fix?: string
  owner: Role
  /** The craft can't exist like this (Launch is disabled). */
  blocker: boolean
  partIds: string[]
}

const kindLabel: Record<ProblemKind, string> = {
  mass: 'Mass',
  power: 'Power',
  budget: 'Budget',
  data: 'Data storage',
  comms: 'Getting data home',
  time: 'Schedule',
  deltaV: 'Delta-v',
  slots: 'Fits on the bus',
  compat: 'Rocket and orbit',
  science: 'Science',
  lifetime: 'Lifetime in orbit',
  disposal: 'End-of-mission plan',
  missing: 'Missing choice',
}

/** Glossary term behind a check's label. */
export const checkTerm: Partial<Record<ProblemKind, string>> = { comms: 'downlink', deltaV: 'delta-v', disposal: 'deorbit', science: 'payload', power: 'eclipse' }

export function reviewChecks(ev: Evaluation): Check[] {
  const checks: Check[] = ev.problems.map((p) => ({
    id: p.id,
    kind: p.kind,
    label: kindLabel[p.kind],
    status: p.status,
    why: p.why,
    fix: p.hint,
    owner: p.owner,
    blocker: p.blocking,
    partIds: p.partIds,
  }))
  const flagged = new Set(ev.problems.map((p) => p.kind))
  for (const r of RESOURCES) {
    const g = ev.gauges[r]
    if (g.status !== 'ok' || flagged.has(r) || (g.used === 0 && g.limit === 0)) continue
    checks.push({
      id: `ok.${r}`,
      kind: r,
      label: RESOURCE_LABELS[r],
      status: 'ok',
      why: `${n1(g.used)} of ${n1(g.limit)} ${g.unit}, ${Math.round(g.marginPct)}% spare.`,
      owner: g.owner,
      blocker: false,
      partIds: [],
    })
  }
  return checks
}

export interface Alert {
  resource: ResourceId
  status: Status
  /** Role that watches the gauge (and gets the alert). */
  hurt: Role
  title: string
  body: string
}

const RANK: Record<Status, number> = { ok: 0, warn: 1, fail: 2 }

/** Gauges that just got worse between two evaluations, with who they affect. */
export function conflictAlerts(before: Evaluation, after: Evaluation, by: Role | null): Alert[] {
  return RESOURCES.filter((r) => RANK[after.gauges[r].status] > RANK[before.gauges[r].status] && after.gauges[r].used > 0).map((r) => {
    const g = after.gauges[r]
    const hurt = GAUGE_WATCHER[r]
    const problem = after.problems.find((p) => p.kind === r)
    const who = by === hurt ? `That's in the ${roleNames[hurt]}'s own area.` : `${by ? `${roleNames[by]}'s change` : 'That change'} affects the ${roleNames[hurt]}.`
    return {
      resource: r,
      status: g.status,
      hurt,
      title: `${g.label} ${g.status === 'fail' ? 'is now over the limit' : 'is close to the limit'}`,
      body: `${who} ${problem?.why ?? `${n1(g.used)} of ${n1(g.limit)} ${g.unit}.`}`,
    }
  })
}
