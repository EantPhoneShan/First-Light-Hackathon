/**
 * TEMPORARY stand-in for Member 1's score.ts and report.ts, so the report screen can be built now.
 * Category weights are the PRD's: Objective 350, Value to customer 200, Efficiency 150,
 * Lifetime 125, Decision quality 125, Collaboration 50 (total 1000, 1–3 stars).
 *
 * UI contract this file assumes:
 *   buildReport(flight, design, scenario) -> Report
 */
import { mockGauges, orbitById, orbitStats, slotsFor } from './mock'
import { createSim } from './mockSim'
import type { Design, FlightResult, PartCategory, Scenario, SimEvent } from './placeholderTypes'

export interface ScoreLine {
  id: 'objective' | 'value' | 'efficiency' | 'lifetime' | 'decisions' | 'collaboration'
  label: string
  score: number
  max: number
  why: string
}

export interface Finding {
  /** When it happened in the flight, or null for a design-level issue. */
  tMin: number | null
  kind: 'warn' | 'bad'
  title: string
  why: string
  fix: string
  /** Workbench slots to highlight on re-fly. */
  slots: string[]
  /** Workbench tabs that hold the fix, besides the spacecraft. */
  tabs: ('launch' | 'ground')[]
}

export interface Report {
  total: number
  stars: 1 | 2 | 3
  headline: string
  lines: ScoreLine[]
  findings: Finding[]
  /** Timeline markers: notable events from the flight log. */
  markers: SimEvent[]
  expectedGb: number
  deliveredPct: number
  firstLightMin: number | null
}

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString()

export function fmtDuration(min: number) {
  if (min < 120) return `${Math.round(min)} min`
  if (min < 2880) return `${fmt(min / 60)} hours`
  if (min < 2 * 43800) return `${Math.round(min / 1440)} days`
  if (min < 2 * 525600) return `${Math.round(min / 43800)} months`
  return `${fmt(min / 525600)} years`
}

export function buildReport(flight: FlightResult, design: Design, scenario: Scenario): Report {
  const ctx = createSim(design, scenario)
  const gauges = mockGauges(design, scenario)
  const orbit = orbitById(design.orbitId)
  const stats = orbitStats(design)
  const slots = slotsFor(design)
  const slotsOf = (...cats: PartCategory[]) => slots.filter((s) => cats.includes(s.accepts)).map((s) => s.id)

  const expectedGb = ctx.dataPerMin * ctx.lifetimeMin
  const deliveredFrac = expectedGb > 0 ? Math.min(1, flight.deliveredGb / expectedGb) : 0
  const lifeFrac = Math.min(1, flight.endMin / flight.lifetimeMin)
  const firstLight = flight.events.find((e) => e.text.startsWith('First light'))
  const firstLightMin = firstLight?.tMin ?? null

  /* ---------- Findings: what went wrong, why, and how to fix it ---------- */
  const findings: Finding[] = []
  const death = flight.status === 'dead' ? flight.events[flight.events.length - 1] : undefined
  const shadowMin = ctx.shadowHalfWidth > 0 ? (ctx.periodMin * Math.asin(Math.min(1, ctx.shadowHalfWidth))) / Math.PI : 0

  if (death && death.text.includes('shadow')) {
    const needWh = (ctx.drawW * shadowMin) / 60
    findings.push({
      tMin: death.tMin,
      kind: 'bad',
      title: "Battery ran out in Earth's shadow",
      why: `Each orbit spends about ${Math.round(shadowMin)} minutes in shadow with no sunlight. Your parts use ${fmt(ctx.drawW)} W, so the craft needs about ${fmt(needWh)} Wh to get through, but the battery only holds ${ctx.batteryCapWh} Wh.`,
      fix: `Fit a battery bigger than ${Math.ceil(needWh * 1.3)} Wh (that leaves a safety margin), or remove a power-hungry part.`,
      slots: slotsOf('battery'),
      tabs: [],
    })
  } else if (death) {
    findings.push({
      tMin: death.tMin,
      kind: 'bad',
      title: "Solar panels couldn't keep up",
      why: `Your parts use ${fmt(ctx.drawW)} W but the solar panels only make ${fmt(ctx.genW)} W in sunlight, so the battery drained even in the Sun.`,
      fix: 'Add deployable solar wings, or remove a part that uses a lot of power.',
      slots: slotsOf('power'),
      tabs: [],
    })
  }

  if (flight.deliveredGb === 0 && flight.madeGb > 0 && flight.status !== 'dead') {
    const noStation = design.stationIds.length === 0
    findings.push({
      tMin: null,
      kind: 'bad',
      title: 'No images ever reached Earth',
      why: noStation
        ? 'The spacecraft took pictures but had no ground station to send them to.'
        : ctx.downlinkPerMin === 0
          ? 'The spacecraft has no working radio, so it could never send its pictures.'
          : 'None of your ground stations could see this orbit.',
      fix: noStation ? 'Pick at least one ground station in the Ground tab.' : 'Fit a radio, or choose ground stations that see this orbit.',
      slots: slotsOf('comms'),
      tabs: ['ground'],
    })
  } else if (flight.lostGb > 0.05 * flight.madeGb) {
    const overflow = flight.events.find((e) => e.text.startsWith('Storage full'))
    const perDay = (ctx.dataPerMin * 1440).toFixed(1)
    const sentPerDay = ((stats?.passesPerDay ?? 0) * ctx.downlinkPerMin * ctx.passLenMin).toFixed(1)
    findings.push({
      tMin: overflow?.tMin ?? null,
      kind: 'warn',
      title: `${Math.round((flight.lostGb / flight.madeGb) * 100)}% of the images were lost`,
      why: `The instruments make about ${perDay} GB a day, but the radio and ground stations can only send about ${sentPerDay} GB a day. Storage filled up and new images were thrown away.`,
      fix: 'Use a faster radio (X-band), add another ground station, or carry fewer instruments.',
      slots: slotsOf('comms', 'computer'),
      tabs: ['ground'],
    })
  }

  for (const g of gauges) {
    if (g.status !== 'bad' || g.key === 'power' || g.key === 'comms') continue
    const tips: Record<string, [string, PartCategory[], Finding['tabs']]> = {
      mass: ['Use a bigger rocket or a lighter bus, or remove parts.', ['bus'], ['launch']],
      budget: ['Use cheaper parts, a rideshare launch, or fewer ground stations.', [], ['launch', 'ground']],
      time: ['Pick parts that take less time to build.', [], []],
      deltaV: ['Add a thruster so the craft can hold its orbit and de-orbit at the end.', ['propulsion'], []],
    }
    const [fix, cats, tabs] = tips[g.key] ?? ['Check this resource on the workbench.', [], []]
    findings.push({
      tMin: null,
      kind: 'warn',
      title: `${g.label} over the limit`,
      why: g.note ?? `The design uses ${fmt(g.used)} ${g.unit} but the limit is ${fmt(g.limit)} ${g.unit}.`,
      fix,
      slots: slotsOf(...cats),
      tabs,
    })
  }

  /* ---------- Score ---------- */
  const okCount = gauges.filter((g) => g.status === 'ok').length
  const badCount = gauges.filter((g) => g.status === 'bad').length
  const warnCount = gauges.length - okCount - badCount
  const names = (st: string) => gauges.filter((g) => g.status === st).map((g) => g.label.toLowerCase()).join(', ')
  const badNames = names('bad')
  const warnNames = names('warn')
  const goodOrbit = !!orbit && scenario.goodOrbits.includes(orbit.id)
  const criticalOk = scenario.critical.every((k) => gauges.find((g) => g.key === k)?.status !== 'bad')
  const quick = firstLightMin !== null && firstLightMin < 1440

  const lines: ScoreLine[] = [
    {
      id: 'objective',
      label: 'Mission objective',
      max: 350,
      score: Math.round(350 * deliveredFrac),
      why: `${Math.round(deliveredFrac * 100)}% of the planned images reached Earth.`,
    },
    {
      id: 'value',
      label: `Value to the ${ctx.customer}`,
      max: 200,
      score: Math.round(200 * deliveredFrac * (quick ? 1 : firstLightMin === null ? 0 : 0.6)),
      why:
        firstLightMin === null
          ? 'They never received an image.'
          : `First images arrived ${fmtDuration(firstLightMin)} after launch${quick ? ', fast enough to act on.' : '. That is slow for a disaster.'}`,
    },
    {
      id: 'efficiency',
      label: 'Efficiency',
      max: 150,
      // Margins only count for the part of the mission that actually flew.
      score: Math.round(Math.max(0, 150 - badCount * 50 - warnCount * 15) * lifeFrac),
      why:
        (badCount + warnCount === 0
          ? 'Every resource has a healthy margin.'
          : [
              badNames && `Over the limit: ${badNames}.`,
              warnNames && `Close to the limit: ${warnNames}.`,
            ]
              .filter(Boolean)
              .join(' ')) +
        (lifeFrac < 1 ? ' Counted only for the time the craft flew.' : ''),
    },
    {
      id: 'lifetime',
      label: 'Lifetime and schedule',
      max: 125,
      score: Math.round(125 * lifeFrac),
      why: flight.status === 'complete' ? `Flew the full ${scenario.lifetimeYears} years.` : `Flew ${fmtDuration(flight.endMin)} of the planned ${scenario.lifetimeYears} years.`,
    },
    {
      id: 'decisions',
      label: 'Decision quality',
      max: 125,
      score: (goodOrbit ? 50 : 0) + (criticalOk ? 75 : 0),
      why: [goodOrbit ? 'The orbit suits this mission.' : 'This orbit is not a good fit for the mission.', criticalOk ? 'Critical resources are within limits.' : 'A critical resource is over its limit.'].join(' '),
    },
    {
      id: 'collaboration',
      label: 'Collaboration',
      max: 50,
      score: 50,
      why: 'Full marks in solo play. In a team room this counts approvals and resolved alerts.',
    },
  ]

  const total = lines.reduce((s, l) => s + l.score, 0)
  const stars = total >= 800 ? 3 : total >= 500 ? 2 : 1
  const headline =
    flight.status === 'dead'
      ? `Mission lost after ${fmtDuration(flight.endMin)}`
      : findings.length === 0
        ? 'Mission complete. Every image made it home.'
        : 'Mission complete, with problems to fix'

  const markers = flight.events.filter((e) => e.kind === 'bad' || e.kind === 'warn' || e.text.startsWith('First light'))

  return { total, stars, headline, lines, findings, markers, expectedGb, deliveredPct: deliveredFrac * 100, firstLightMin }
}
