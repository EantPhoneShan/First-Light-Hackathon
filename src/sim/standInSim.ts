/**
 * STAND-IN flight simulation until Member 1's simulate.ts exists (SimResult in engine/types.ts).
 * It does no physics of its own: every number (power draw, solar, usable battery, eclipse,
 * data per day, downlink, storage) comes from Member 1's evaluate(). It only plays those
 * numbers forward in time so the simulation view can animate them.
 *
 *   createSim(design, scenario, evaluation) -> SimContext
 *   initialState(ctx) -> SimState
 *   stepSim(state, ctx, minutes)       (mutates state, appends events/samples)
 *   craftAngle(ctx, tMin) -> radians, for drawing
 */
import { findOrbit, findPart } from '@/engine/data'
import type { Design, Evaluation, Scenario } from '@/engine/types'
import { gameData } from '@/game/ui'
import type { SimEvent, SimState } from './types'

const STEP_MIN = 0.5
const SAMPLES = 300

export interface SimContext {
  ready: boolean
  /** Why it can't fly yet (blocking problems from evaluate()). */
  missing: string[]
  periodMin: number
  /** Craft is in shadow when cos(angle) > 0 and |sin(angle)| < this. Set so the shadow fraction matches the engine. */
  shadowHalfWidth: number
  genW: number
  drawW: number
  batteryCapWh: number
  dataPerMin: number
  bufferCapMB: number
  /** 0 = never in contact, 1 = always (GEO). */
  passSpacingMin: number
  passLenMin: number
  downlinkPerMin: number
  lifetimeMin: number
  customer: string
}

export function createSim(design: Design, scenario: Scenario, ev: Evaluation): SimContext {
  const t = ev.totals
  const orbit = findOrbit(gameData, design.flight.orbitId)
  const info = ev.orbit
  const blockers = ev.problems.filter((p) => p.blocking)
  const radio = design.flight.antennaIds.map((id) => findPart(gameData, id)).sort((a, b) => (b?.dataRateMbps ?? 0) - (a?.dataRateMbps ?? 0))[0]
  const stations = gameData.stations.filter((s) => design.flight.stationIds.includes(s.id) && orbit && (s.passesPerDay[orbit.id] ?? 0) > 0 && radio?.band && s.bands.includes(radio.band))
  const geo = orbit?.kind === 'geo'
  const passes = stations.reduce((n, s) => n + (orbit ? s.passesPerDay[orbit.id] : 0), 0)
  const passLenMin = geo ? 1440 : stations.length ? stations.reduce((n, s) => n + s.passMinutes, 0) / stations.length : 10
  const ecl = info?.eclipseFraction ?? 0

  return {
    ready: !!info && blockers.length === 0,
    missing: blockers.map((p) => p.why),
    periodMin: info?.periodMin ?? 1440,
    shadowHalfWidth: Math.sin(Math.PI * ecl),
    // evaluate() reports the orbit-average solar power; in sunlight the panels make more.
    genW: ecl < 1 ? t.powerAvgW / (1 - ecl) : 0,
    drawW: t.powerDrawW,
    batteryCapWh: t.batteryUsableWh,
    dataPerMin: t.dataMBPerDay / 1440,
    bufferCapMB: t.storageMB || 50,
    passSpacingMin: geo && passes > 0 ? 1 : passes > 0 ? 1440 / passes : 0,
    passLenMin,
    downlinkPerMin: geo ? t.downlinkMBPerDay / 1440 : passes > 0 ? t.downlinkMBPerDay / (passes * passLenMin) : 0,
    lifetimeMin: scenario.lifetimeYears * 525600,
    customer: scenario.customer.name.toLowerCase(),
  }
}

export function initialState(ctx: SimContext): SimState {
  return {
    tMin: 0,
    batteryWh: ctx.batteryCapWh,
    bufferMB: 0,
    madeMB: 0,
    deliveredMB: 0,
    lostMB: 0,
    inEclipse: false,
    inContact: false,
    status: 'flying',
    events: [{ tMin: 0, kind: 'info', text: 'Orbit insertion complete. Systems on.' }],
    samples: [],
  }
}

/** Angle around Earth in radians. Sun on the left (−x); the flight starts on the sunlit side. */
export const craftAngle = (ctx: SimContext, tMin: number) => ((2 * Math.PI * tMin) / ctx.periodMin + Math.PI) % (2 * Math.PI)

function inShadow(ctx: SimContext, tMin: number) {
  const th = craftAngle(ctx, tMin)
  return Math.cos(th) > 0 && Math.abs(Math.sin(th)) < ctx.shadowHalfWidth
}

function inContact(ctx: SimContext, tMin: number) {
  if (ctx.passSpacingMin === 0) return false
  if (ctx.passSpacingMin === 1) return true
  return (tMin + ctx.passSpacingMin * 0.4) % ctx.passSpacingMin < ctx.passLenMin
}

const fmtT = (m: number) => (m < 120 ? `${Math.floor(m)} min` : m < 2880 ? `${(m / 60).toFixed(1)} h` : `day ${Math.floor(m / 1440) + 1}`)
const fmtMB = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.round(mb)} MB`)

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
    if (ecl && !s.inEclipse) once('eclipse', { kind: 'info', text: `Entered Earth's shadow. Running on battery (${ctx.batteryCapWh.toFixed(1)} Wh usable).` })
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
          : `Solar panels can't keep up: parts use ${ctx.drawW.toFixed(1)} W but panels make ${ctx.genW.toFixed(1)} W in sunlight. The battery ran flat.`,
      })
      break
    }

    // Data
    const made = ctx.dataPerMin * dt
    s.madeMB += made
    s.bufferMB += made
    const contact = inContact(ctx, s.tMin)
    if (contact && !s.inContact && ctx.downlinkPerMin > 0) once('contact', { kind: 'info', text: 'First ground-station pass. Antenna on.' })
    s.inContact = contact && ctx.downlinkPerMin > 0
    if (s.inContact) {
      const sent = Math.min(s.bufferMB, ctx.downlinkPerMin * dt)
      if (sent > 0 && s.deliveredMB === 0) once('first-light', { kind: 'good', text: `First light! The first images reached the ${ctx.customer}.` })
      s.bufferMB -= sent
      s.deliveredMB += sent
    }
    if (s.bufferMB > ctx.bufferCapMB) {
      once('overflow', { kind: 'warn', text: `Storage full (${fmtMB(ctx.bufferCapMB)}). New images are being lost before they can be sent.` })
      s.lostMB += s.bufferMB - ctx.bufferCapMB
      s.bufferMB = ctx.bufferCapMB
    }

    // Samples for the report timeline and ghost comparison
    const every = ctx.lifetimeMin / SAMPLES
    if (s.samples.length === 0 || s.tMin - s.samples[s.samples.length - 1].tMin >= every) {
      s.samples.push({
        tMin: s.tMin,
        batteryPct: ctx.batteryCapWh ? (s.batteryWh / ctx.batteryCapWh) * 100 : 0,
        bufferPct: (s.bufferMB / ctx.bufferCapMB) * 100,
        deliveredMB: s.deliveredMB,
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

