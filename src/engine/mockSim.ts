/**
 * TEMPORARY stand-in for Member 1's simulate.ts, so the simulation view can be built now.
 * Fixed time step, simple models (PRD: "believable is enough"). Replace with the real engine.
 *
 * UI contract this file assumes:
 *   createSim(design, scenario) -> SimContext   (static numbers for this design)
 *   initialState(ctx)           -> SimState
 *   stepSim(state, ctx, minutes)                (mutates state, appends events/samples)
 *   craftAngle(ctx, tMin)       -> radians, for drawing
 */
import { orbitById, orbitStats, partById } from './mock'
import type { Design, Part, Scenario, SimEvent, SimState } from './types'

const RE = 6371
const STEP_MIN = 0.5
const SAMPLES = 300

export interface SimContext {
  ready: boolean
  missing: string[]
  periodMin: number
  shadowHalfWidth: number // R/a: craft is in shadow when cos(angle) > 0 and |sin(angle)| < this
  genW: number
  drawW: number
  batteryCapWh: number
  dataPerMin: number
  bufferCapGb: number
  passSpacingMin: number // 0 = no contact ever
  passLenMin: number
  downlinkPerMin: number
  lifetimeMin: number
  customer: string
}

export function createSim(design: Design, scenario: Scenario): SimContext {
  const chosen = Object.values(design.partsBySlot).map(partById).filter((p): p is Part => !!p)
  const sum = (f: (p: Part) => number) => chosen.reduce((s, p) => s + f(p), 0)
  const orbit = orbitById(design.orbitId)
  const stats = orbitStats(design)

  const missing: string[] = []
  if (!design.partsBySlot.bus) missing.push('a bus')
  if (!orbit) missing.push('an orbit')

  const periodMin = stats && stats.periodMin > 0 ? stats.periodMin : 1440
  const a = RE + (orbit?.altitudeKm ? design.altitudeKm : 400000)
  const passes = stats?.passesPerDay ?? 0
  const continuous = orbit?.id === 'geo' && passes >= 24
  const passLenMin = continuous ? 1440 : orbit?.altitudeKm ? 8 : 240
  const radioGbPerPass = sum((p) => p.downlinkGbPerPass ?? 0)

  return {
    ready: missing.length === 0,
    missing,
    periodMin,
    shadowHalfWidth: orbit?.altitudeKm ? RE / a : 0,
    genW: sum((p) => Math.max(0, -p.powerW)),
    drawW: sum((p) => Math.max(0, p.powerW)),
    batteryCapWh: sum((p) => p.batteryWh ?? 0),
    dataPerMin: sum((p) => p.dataPerOrbitGb ?? 0) / periodMin,
    bufferCapGb: sum((p) => p.storageGb ?? 0) || 0.5, // a bus with no computer still has a tiny buffer
    passSpacingMin: continuous ? 1 : passes > 0 ? 1440 / passes : 0,
    passLenMin,
    downlinkPerMin: continuous ? (radioGbPerPass * 24) / 1440 : radioGbPerPass / passLenMin,
    lifetimeMin: scenario.lifetimeYears * 525600,
    customer: scenario.customer.toLowerCase(),
  }
}

export function initialState(ctx: SimContext): SimState {
  return {
    tMin: 0,
    batteryWh: ctx.batteryCapWh,
    bufferGb: 0,
    madeGb: 0,
    deliveredGb: 0,
    lostGb: 0,
    inEclipse: false,
    inContact: false,
    status: 'flying',
    events: [{ tMin: 0, kind: 'info', text: 'Orbit insertion complete. Systems on.' }],
    samples: [],
  }
}

/**
 * Angle of the craft around Earth, in radians. The Sun is on the left (−x), so angle 0 is the
 * night side. The flight starts at π (sunlit side), so the first eclipse comes half an orbit in.
 */
export const craftAngle = (ctx: SimContext, tMin: number) => ((2 * Math.PI * tMin) / ctx.periodMin + Math.PI) % (2 * Math.PI)

/** Sun on the left (−x), shadow to the right (+x). */
function inShadow(ctx: SimContext, tMin: number) {
  const th = craftAngle(ctx, tMin)
  return Math.cos(th) > 0 && Math.abs(Math.sin(th)) < ctx.shadowHalfWidth
}

function inContact(ctx: SimContext, tMin: number) {
  if (ctx.passSpacingMin === 0) return false
  if (ctx.passSpacingMin === 1) return true
  return (tMin + ctx.passSpacingMin * 0.4) % ctx.passSpacingMin < ctx.passLenMin
}

const fmtT = (m: number) => {
  if (m < 120) return `${Math.floor(m)} min`
  if (m < 2880) return `${(m / 60).toFixed(1)} h`
  return `day ${Math.floor(m / 1440) + 1}`
}

/** Advance the simulation by `minutes`. Mutates `s`. */
export function stepSim(s: SimState, ctx: SimContext, minutes: number) {
  if (s.status !== 'flying') return
  const once = (key: string, e: Omit<SimEvent, 'tMin'>) => {
    if (!flags.has(s)) flags.set(s, new Set())
    const f = flags.get(s)!
    if (f.has(key)) return
    f.add(key)
    s.events.push({ tMin: s.tMin, ...e })
  }

  let left = minutes
  while (left > 0 && s.status === 'flying') {
    const dt = Math.min(STEP_MIN, left)
    left -= dt
    s.tMin += dt

    // Power
    const ecl = inShadow(ctx, s.tMin)
    if (ecl && !s.inEclipse) once('eclipse', { kind: 'info', text: `Entered Earth's shadow. Running on battery (${ctx.batteryCapWh} Wh).` })
    if (!ecl && s.inEclipse) once('sunrise', { kind: 'good', text: 'Back in sunlight. Battery charging.' })
    s.inEclipse = ecl
    const net = (ecl ? 0 : ctx.genW) - ctx.drawW
    s.batteryWh = Math.min(ctx.batteryCapWh, s.batteryWh + (net * dt) / 60)
    if (s.batteryWh <= 0) {
      s.batteryWh = 0
      s.status = 'dead'
      s.events.push({
        tMin: s.tMin,
        kind: 'bad',
        text: ecl
          ? `Battery ran out in Earth's shadow, ${fmtT(s.tMin)} after launch. The spacecraft shut down.`
          : `Solar panels can't keep up: parts use ${ctx.drawW} W but panels make ${ctx.genW} W. The battery ran flat.`,
      })
      break
    }

    // Data
    const made = ctx.dataPerMin * dt
    s.madeGb += made
    s.bufferGb += made
    const contact = inContact(ctx, s.tMin)
    if (contact && !s.inContact && ctx.downlinkPerMin > 0) once('contact', { kind: 'info', text: 'First ground-station pass. Antenna on.' })
    s.inContact = contact && ctx.downlinkPerMin > 0
    if (s.inContact) {
      const sent = Math.min(s.bufferGb, ctx.downlinkPerMin * dt)
      if (sent > 0 && s.deliveredGb === 0) once('first-light', { kind: 'good', text: `First light! The first images reached the ${ctx.customer}.` })
      s.bufferGb -= sent
      s.deliveredGb += sent
    }
    if (s.bufferGb > ctx.bufferCapGb) {
      once('overflow', { kind: 'warn', text: `Storage full (${ctx.bufferCapGb} GB). New images are being lost before they can be sent.` })
      s.lostGb += s.bufferGb - ctx.bufferCapGb
      s.bufferGb = ctx.bufferCapGb
    }

    // Samples for the report timeline and ghost comparison
    const every = ctx.lifetimeMin / SAMPLES
    if (s.samples.length === 0 || s.tMin - s.samples[s.samples.length - 1].tMin >= every) {
      s.samples.push({
        tMin: s.tMin,
        batteryPct: ctx.batteryCapWh ? (s.batteryWh / ctx.batteryCapWh) * 100 : 0,
        bufferPct: (s.bufferGb / ctx.bufferCapGb) * 100,
        deliveredGb: s.deliveredGb,
      })
    }

    if (s.tMin >= 525600 && s.tMin - dt < 525600) once('year1', { kind: 'info', text: 'One year in orbit.' })
    if (s.tMin >= ctx.lifetimeMin) {
      s.status = 'complete'
      s.events.push({ tMin: s.tMin, kind: 'good', text: 'Mission lifetime reached. Mission complete!' })
    }
  }
}

// One-time event flags per sim run, kept outside the state so the state stays plain data.
const flags = new WeakMap<SimState, Set<string>>()
