/**
 * TEMPORARY stand-in for Member 1's rules.ts (pre-flight checks) and alerts.ts (conflict alerts).
 *
 * UI contract this file assumes:
 *   reviewChecks(design, scenario) -> Check[]       (the design review checklist, F12)
 *   conflictAlerts(before, after, scenario, by) -> Alert[]   (who a change hurt, F11)
 */
import { craftMass, launchCheck, launcherById, mockGauges, orbitById, orbitStats, partById } from './mock'

/** Team requirements from the Feasibility screen (the store's Requirements). */
export interface Reqs {
  revisitDays: number
  detailM: number
}
import { createSim } from './mockSim'
import { instrumentLock } from './mockScience'
import type { Design, Gauge, Part, ResourceKey, Role, Scenario, Status } from './placeholderTypes'

export const roleNames: Record<Role, string> = {
  planner: 'Mission Planner',
  engineer: 'Spacecraft Engineer',
  science: 'Science Lead',
  flight: 'Comms & Flight Dynamics',
}

/**
 * Which role watches each gauge (team decision, 14 Nov). In team play only the watcher sees it,
 * so the Engineer, who builds, has to be told when Power or Data gets too high.
 * Alerts for a resource go to its watcher.
 */
export const resourceOwner: Record<ResourceKey, Role> = {
  time: 'engineer',
  comms: 'science',
  power: 'science',
  budget: 'planner',
  mass: 'flight',
  deltaV: 'flight',
}

export interface Check {
  id: string
  label: string
  status: Status
  why: string
  /** Shown when the check is amber or red. */
  fix?: string
  owner: Role
  /** True if the craft physically can't launch (no bus, orbit or rocket). Blocks the Launch button. */
  blocker?: boolean
}

const n1 = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1))

export function reviewChecks(design: Design, scenario: Scenario, reqs?: Reqs): Check[] {
  const chosen = Object.values(design.partsBySlot).map(partById).filter((p): p is Part => !!p)
  const has = (c: Part['category']) => chosen.some((p) => p.category === c)
  const gauges = mockGauges(design, scenario)
  const gauge = (k: ResourceKey) => gauges.find((g) => g.key === k)!
  const orbit = orbitById(design.orbitId)
  const launcher = launcherById(design.launcherId)
  const stats = orbitStats(design)
  const ctx = createSim(design, scenario)
  const checks: Check[] = []

  // 1. Can it fly at all?
  checks.push(
    design.partsBySlot.bus
      ? { id: 'bus', label: 'Spacecraft frame', status: 'ok', why: `${partById(design.partsBySlot.bus)!.name} fitted.`, owner: 'engineer' }
      : { id: 'bus', label: 'Spacecraft frame', status: 'bad', why: 'There is no bus, so there is nothing to launch.', fix: 'Add a bus on the Spacecraft tab.', owner: 'engineer', blocker: true },
  )
  checks.push(
    orbit
      ? { id: 'orbit', label: 'Orbit', status: scenario.goodOrbits.includes(orbit.id) ? 'ok' : 'warn', why: scenario.goodOrbits.includes(orbit.id) ? `${orbit.name} suits this mission.` : `${orbit.name} works, but it is not the best fit for ${scenario.name}.`, fix: 'The ★ on the Orbit & launch tab marks orbits that fit.', owner: 'flight' }
      : { id: 'orbit', label: 'Orbit', status: 'bad', why: 'No orbit chosen.', fix: 'Pick one on the Orbit & launch tab.', owner: 'flight', blocker: true },
  )
  if (!launcher) {
    checks.push({ id: 'rocket', label: 'Rocket', status: 'bad', why: 'No rocket chosen.', fix: 'Pick one on the Orbit & launch tab.', owner: 'planner', blocker: true })
  } else {
    const lc = launchCheck(design, launcher)
    checks.push(
      lc.ok
        ? { id: 'rocket', label: 'Rocket', status: 'ok', why: `${launcher.name}: ${lc.reason} Your craft weighs ${n1(craftMass(design))} kg.`, owner: 'planner' }
        : { id: 'rocket', label: 'Rocket', status: 'bad', why: lc.reason, fix: 'Choose a bigger rocket or a lighter craft.', owner: 'planner', blocker: true },
    )
  }

  // 2. Science: can it do the job?
  const instruments = chosen.filter((p) => p.category === 'instrument')
  const unfit = instruments.map((p) => [p, instrumentLock(scenario.id, p.id)] as const).filter(([, why]) => why)
  checks.push(
    unfit.length
      ? { id: 'instrument', label: 'Instruments', status: 'bad', why: unfit.map(([p, why]) => `${p.name}: ${why!.replace(/^Doesn't fit the goal: /, '')}`).join(' '), fix: 'Swap it for an instrument that serves the science goal (see the briefing).', owner: 'science' }
      : instruments.length
      ? { id: 'instrument', label: 'Instruments', status: 'ok', why: `Carries ${instruments.map((p) => p.name.toLowerCase()).join(' and ')}.`, owner: 'science' }
      : { id: 'instrument', label: 'Instruments', status: 'bad', why: 'No instrument, so the mission collects no data.', fix: 'Add a camera or imager in an Instrument slot.', owner: 'science' },
  )

  if (reqs && stats?.revisitDays != null && stats.detailM != null && orbit?.id !== 'geo') {
    const revOk = stats.revisitDays <= reqs.revisitDays
    const detOk = stats.detailM <= reqs.detailM
    checks.push({
      id: 'requirements',
      label: 'Meets the requirements',
      status: revOk && detOk ? 'ok' : 'warn',
      why: `At ${design.altitudeKm} km the craft revisits every ${n1(stats.revisitDays)} days (target ${reqs.revisitDays}) with ${n1(stats.detailM)} m pixels (target ${reqs.detailM} m).`,
      fix: !revOk ? 'Fly higher to cover ground faster, or relax the coverage target.' : 'Fly lower for sharper images, or relax the detail target.',
      owner: 'science',
    })
  }

  // 3. Power: sunlight and shadow.
  const power = gauge('power')
  checks.push(
    power.status === 'bad'
      ? { id: 'power', label: 'Power in sunlight', status: 'bad', why: power.note ?? `Parts use ${n1(power.used)} W but the panels make ${n1(power.limit)} W.`, fix: 'Add solar wings or remove a power-hungry part.', owner: 'engineer' }
      : { id: 'power', label: 'Power in sunlight', status: power.status, why: `Panels make ${n1(power.limit)} W, parts use ${n1(power.used)} W.`, fix: 'Little spare power. One more part could tip it over.', owner: 'engineer' },
  )
  if (orbit?.altitudeKm && stats && design.partsBySlot.bus) {
    const needWh = (ctx.drawW * stats.eclipseMin) / 60
    const cap = ctx.batteryCapWh
    const status: Status = cap < needWh ? 'bad' : cap < needWh * 1.3 ? 'warn' : 'ok'
    checks.push({
      id: 'battery',
      label: "Battery in Earth's shadow",
      status,
      why: `Each orbit has about ${Math.round(stats.eclipseMin)} min of shadow. The craft needs ${n1(needWh)} Wh to get through and the battery holds ${cap} Wh.`,
      fix: status === 'ok' ? undefined : `Fit at least ${Math.ceil(needWh * 1.3)} Wh of battery.`,
      owner: 'engineer',
    })
  }

  // 4. Comms and ground.
  const comms = gauge('comms')
  checks.push({
    id: 'comms',
    label: 'Getting data home',
    status: has('instrument') ? (comms.note ? 'bad' : comms.status) : 'ok',
    why: !has('instrument')
      ? 'Nothing to send yet.'
      : comms.note
        ? `${comms.note}: images can't reach the ${scenario.customer.toLowerCase()}.`
        : `Instruments make ${n1(comms.used)} GB per orbit; radio and stations can send ${n1(comms.limit)} GB.`,
    fix: 'Use a faster radio or add ground stations.',
    owner: 'flight',
  })

  // 5. Money, schedule, end of life.
  for (const key of ['budget', 'time', 'deltaV'] as const) {
    const g: Gauge = gauge(key)
    const labels = { budget: 'Budget', time: 'Build schedule', deltaV: 'Orbit keeping and de-orbit' }
    const fixes = {
      budget: 'Rideshare launches and fewer stations save the most.',
      time: 'Swap slow-to-build parts for simpler ones.',
      deltaV: 'Add a thruster so the craft can leave orbit at the end, as space-debris rules expect.',
    }
    const unit = (v: number) => (key === 'budget' ? `$${n1(v)}M` : `${n1(v)} ${g.unit}`)
    checks.push({
      id: key,
      label: labels[key],
      status: g.status,
      why: g.note ?? (key === 'deltaV' && g.used === 0 ? 'No thruster needed for this orbit.' : `Uses ${unit(g.used)} of ${unit(g.limit)}.`),
      fix: fixes[key],
      owner: resourceOwner[key],
    })
  }

  return checks.map((c) => (c.status === 'ok' ? { ...c, fix: undefined } : c))
}

export interface Alert {
  resource: ResourceKey
  status: Status
  /** Role hurt by the change. */
  hurt: Role
  title: string
  body: string
}

/** Compare gauges before and after a change, and report resources that just got worse. */
export function conflictAlerts(before: Design, after: Design, scenario: Scenario, by: Role | null): Alert[] {
  const rank = { ok: 0, warn: 1, bad: 2 }
  const old = new Map(mockGauges(before, scenario).map((g) => [g.key, g]))
  const who = by ? roleNames[by] : 'That change'
  return mockGauges(after, scenario)
    .filter((g) => g.used > 0 && rank[g.status] > rank[old.get(g.key)?.status ?? 'ok'])
    .map((g) => {
      const hurt = resourceOwner[g.key]
      const what = g.status === 'bad' ? 'is now over the limit' : 'is close to the limit'
      return {
        resource: g.key,
        status: g.status,
        hurt,
        title: `${g.label} ${what}`,
        body: `${
          by === hurt ? `That's in the ${roleNames[hurt]}'s own area.` : `${by ? `${who}'s change` : who} affects the ${roleNames[hurt]}.`
        } ${g.note ?? `${n1(g.used)} of ${n1(g.limit)} ${g.unit}.`}`,
      }
    })
}
