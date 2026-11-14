/**
 * STAND-IN mission report and score until Member 1's score.ts and report.ts exist.
 * Findings ("why it happened" + fix + parts to highlight) are Member 1's evaluate().problems
 * for the design that flew. Only the score arithmetic is ours, using the PRD weights (SCORE_MAX).
 *
 *   buildReport(flight, scenario) -> Report
 */
import { evaluate } from '@/engine/rules'
import { RESOURCES, SCORE_MAX, type ProblemKind, type ScoreCategory, type Scenario } from '@/engine/types'
import { gameData } from '@/game/ui'
import type { FlightResult, SimEvent } from './types'

export interface ScoreLine {
  id: ScoreCategory
  label: string
  score: number
  max: number
  why: string
}

export interface Finding {
  /** When it showed up in the flight, or null for a design-level issue. */
  tMin: number | null
  kind: 'warn' | 'fail'
  title: string
  why: string
  fix?: string
  /** Workbench parts to outline on re-fly (F18). */
  partIds: string[]
  /** Workbench tabs that hold the fix, besides the spacecraft. */
  tabs: ('launch' | 'ground')[]
}

export interface Report {
  total: number
  stars: 1 | 2 | 3
  headline: string
  lines: ScoreLine[]
  findings: Finding[]
  markers: SimEvent[]
  expectedMB: number
  deliveredPct: number
  firstLightMin: number | null
}

export function fmtDuration(min: number) {
  const r = (n: number) => (Math.round(n * 10) / 10).toString()
  if (min < 120) return `${Math.round(min)} min`
  if (min < 2880) return `${r(min / 60)} hours`
  if (min < 2 * 43800) return `${Math.round(min / 1440)} days`
  if (min < 2 * 525600) return `${Math.round(min / 43800)} months`
  return `${r(min / 525600)} years`
}

const findingTitle: Record<ProblemKind, string> = {
  power: 'Power problem',
  mass: 'Too heavy',
  budget: 'Over budget',
  data: 'Storage filled up',
  comms: "Data couldn't get home fast enough",
  time: 'Schedule problem',
  deltaV: 'Not enough delta-v',
  slots: "Parts don't fit",
  compat: "Rocket can't do the job",
  science: 'Science mismatch',
  lifetime: 'Orbit too low to last',
  disposal: 'End-of-mission plan',
  missing: 'Something is missing',
}

/** Where a problem is fixed, besides the spacecraft tab. */
const tabFor: Partial<Record<ProblemKind, 'launch' | 'ground'>> = { comms: 'ground', compat: 'launch', lifetime: 'launch', science: 'launch', deltaV: 'launch' }

export function buildReport(flight: FlightResult, scenario: Scenario): Report {
  const ev = evaluate(flight.design, scenario, gameData)
  const t = ev.totals
  const expectedMB = t.dataMBPerDay * (flight.lifetimeMin / 1440)
  const deliveredFrac = expectedMB > 0 ? Math.min(1, flight.deliveredMB / expectedMB) : 0
  const lifeFrac = Math.min(1, flight.endMin / flight.lifetimeMin)
  const firstLight = flight.events.find((e) => e.text.startsWith('First light'))
  const firstLightMin = firstLight?.tMin ?? null
  const death = flight.status === 'dead' ? flight.events[flight.events.length - 1] : undefined
  const overflow = flight.events.find((e) => e.text.startsWith('Storage full'))

  /* Findings: Member 1's problems for the design that flew, tied to the moment they hit. */
  const findings: Finding[] = ev.problems.map((p) => ({
    tMin: p.kind === 'power' && death ? death.tMin : (p.kind === 'data' || p.kind === 'comms') && overflow ? overflow.tMin : null,
    kind: p.status,
    title: p.kind === 'power' && death ? (death.text.includes('shadow') ? "Battery ran out in Earth's shadow" : "Solar panels couldn't keep up") : findingTitle[p.kind],
    why: p.why,
    fix: p.hint,
    partIds: p.partIds,
    tabs: tabFor[p.kind] ? [tabFor[p.kind]!] : [],
  }))
  if (death && !findings.some((f) => f.tMin === death.tMin)) {
    findings.unshift({ tMin: death.tMin, kind: 'fail', title: 'The spacecraft shut down', why: death.text, partIds: [], tabs: [] })
  }
  findings.sort((a, b) => (a.kind === b.kind ? (a.tMin ?? Infinity) - (b.tMin ?? Infinity) : a.kind === 'fail' ? -1 : 1))

  /* Score (stand-in arithmetic, PRD weights). */
  const fails = RESOURCES.filter((r) => ev.gauges[r].status === 'fail').length
  const warns = RESOURCES.filter((r) => ev.gauges[r].status === 'warn').length
  const quick = t.latencyHours <= scenario.customer.needsDataWithinHours
  const disposalOk = !ev.problems.some((p) => p.kind === 'disposal' && p.status === 'fail')
  const scienceSet = !!flight.design.science.measurementId
  const w = flight.design.planner.weights
  // The Mission Planner's sliders tilt the objective toward what they said mattered (F4).
  const objectiveFrac = Math.min(1, deliveredFrac * (0.8 + 0.2 * w.detail) + 0.2 * w.coverage * deliveredFrac)

  const lines: ScoreLine[] = [
    { id: 'objective', label: 'Mission objective', max: SCORE_MAX.objective, score: Math.round(SCORE_MAX.objective * Math.min(1, objectiveFrac)), why: `${Math.round(deliveredFrac * 100)}% of the planned data reached Earth.` },
    {
      id: 'customer',
      label: `Value to the ${scenario.customer.name.toLowerCase()}`,
      max: SCORE_MAX.customer,
      score: Math.round(SCORE_MAX.customer * deliveredFrac * (firstLightMin === null ? 0 : quick ? 1 : 0.6)),
      why:
        firstLightMin === null
          ? 'They never received any data.'
          : `First data arrived ${fmtDuration(firstLightMin)} after launch; each image waits about ${Math.round(t.latencyHours)} h (they need it within ${scenario.customer.needsDataWithinHours} h).`,
    },
    {
      id: 'efficiency',
      label: 'Efficiency',
      max: SCORE_MAX.efficiency,
      score: Math.round(Math.max(0, SCORE_MAX.efficiency - fails * 50 - warns * 15) * lifeFrac),
      why: fails + warns === 0 ? 'Every resource has a healthy margin.' : `${fails} resource(s) over the limit and ${warns} close to it.${lifeFrac < 1 ? ' Counted only for the time the craft flew.' : ''}`,
    },
    {
      id: 'lifetime',
      label: 'Lifetime and end of mission',
      max: SCORE_MAX.lifetime,
      score: Math.round(SCORE_MAX.lifetime * (0.8 * lifeFrac + (disposalOk ? 0.2 : 0))),
      why: `${flight.status === 'complete' ? `Flew the full ${scenario.lifetimeYears} years.` : `Flew ${fmtDuration(flight.endMin)} of ${scenario.lifetimeYears} years.`} ${disposalOk ? 'End-of-mission plan is sound.' : 'End-of-mission plan breaks the debris rule.'}`,
    },
    {
      id: 'decisions',
      label: 'Decision quality',
      max: SCORE_MAX.decisions,
      score: Math.round(SCORE_MAX.decisions * ((scienceSet ? 0.4 : 0) + (ev.ready ? 0.6 : Math.max(0, 0.6 - 0.2 * ev.problems.filter((p) => p.status === 'fail').length)))),
      why: `${scienceSet ? 'The science measurement was chosen first.' : 'No science measurement was chosen.'} ${ev.ready ? 'No red checks at launch.' : 'Launched with red checks.'}`,
    },
    { id: 'collaboration', label: 'Collaboration', max: SCORE_MAX.collaboration, score: SCORE_MAX.collaboration, why: 'Full marks in solo play. In a team room this counts approvals and resolved alerts.' },
  ]

  const total = lines.reduce((s, l) => s + l.score, 0)
  const stars = total >= 800 ? 3 : total >= 500 ? 2 : 1
  const headline =
    flight.status === 'dead' ? `Mission lost after ${fmtDuration(flight.endMin)}` : findings.length === 0 ? 'Mission complete. Every image made it home.' : 'Mission complete, with problems to fix'
  const markers = flight.events.filter((e) => e.kind === 'bad' || e.kind === 'warn' || e.text.startsWith('First light'))

  return { total, stars, headline, lines, findings, markers, expectedMB, deliveredPct: deliveredFrac * 100, firstLightMin }
}
