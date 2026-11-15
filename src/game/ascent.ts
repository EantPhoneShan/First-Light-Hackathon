/**
 * Ascent physics for the launch screen: a 2D point-mass flight in polar
 * coordinates round a round Earth, with inverse-square gravity, an exponential
 * atmosphere and drag, real stage masses, thrust and Isp (rounded from public
 * figures for each launcher class), a pitch program for the first stage and
 * closed-loop guidance for the upper stage that levels off at the target
 * altitude and cuts the engine at orbital speed.
 *
 * It produces the telemetry the charts show (altitude, speed, dynamic pressure
 * with Max-Q, g-load) and the event times the 3D scene is keyed to.
 * Pure TypeScript, no imports, so it can be tested on its own.
 */

export type LauncherClassId = 'rideshare' | 'small' | 'medium' | 'heavy' | 'super-heavy'

interface Stage {
  /** Propellant and dry mass, kg. */
  prop: number
  dry: number
  /** Thrust at sea level and in vacuum, N. */
  thrustSL: number
  thrustVac: number
  /** Specific impulse at sea level and in vacuum, s. */
  ispSL: number
  ispVac: number
}

interface Vehicle {
  /** Frontal area, m². */
  area: number
  s1: Stage
  /** Strap-on boosters (each like s1), burning alongside the core. */
  boosters: number
  s2: Stage
  fairing: number
}

const VEHICLES: Record<LauncherClassId, Vehicle> = {
  small: {
    area: 1.13,
    s1: { prop: 9250, dry: 950, thrustSL: 162e3, thrustVac: 192e3, ispSL: 303, ispVac: 311 },
    boosters: 0,
    s2: { prop: 2050, dry: 250, thrustSL: 25.8e3, thrustVac: 25.8e3, ispSL: 343, ispVac: 343 },
    fairing: 50,
  },
  medium: {
    area: 10.75,
    s1: { prop: 411e3, dry: 25.6e3, thrustSL: 7607e3, thrustVac: 8227e3, ispSL: 282, ispVac: 311 },
    boosters: 0,
    s2: { prop: 107.5e3, dry: 4e3, thrustSL: 981e3, thrustVac: 981e3, ispSL: 348, ispVac: 348 },
    fairing: 1900,
  },
  rideshare: {
    area: 10.75,
    s1: { prop: 411e3, dry: 25.6e3, thrustSL: 7607e3, thrustVac: 8227e3, ispSL: 282, ispVac: 311 },
    boosters: 0,
    s2: { prop: 107.5e3, dry: 4e3, thrustSL: 981e3, thrustVac: 981e3, ispSL: 348, ispVac: 348 },
    fairing: 1900,
  },
  heavy: {
    area: 32,
    s1: { prop: 411e3, dry: 25.6e3, thrustSL: 7607e3, thrustVac: 8227e3, ispSL: 282, ispVac: 311 },
    boosters: 2,
    s2: { prop: 107.5e3, dry: 4e3, thrustSL: 981e3, thrustVac: 981e3, ispSL: 348, ispVac: 348 },
    fairing: 1900,
  },
  'super-heavy': {
    area: 63.6,
    s1: { prop: 3400e3, dry: 200e3, thrustSL: 74e6, thrustVac: 80e6, ispSL: 327, ispVac: 350 },
    boosters: 0,
    s2: { prop: 1200e3, dry: 120e3, thrustSL: 12e6, thrustVac: 14.7e6, ispSL: 355, ispVac: 380 },
    fairing: 0,
  },
}

const MU = 3.986004e14
const RE = 6371e3
const G0 = 9.80665

export interface Sample {
  /** Seconds after liftoff. */
  t: number
  /** Altitude, km. */
  altKm: number
  /** Speed (inertial, no Earth rotation), m/s. */
  speed: number
  /** Ground distance flown, km. */
  downrangeKm: number
  /** Dynamic pressure, kPa. */
  qKPa: number
  /** Felt acceleration (thrust and drag), in g. */
  gLoad: number
  /** Angle of the rocket from vertical, degrees. */
  pitchDeg: number
  /** Which stage is firing: 1, 2, or 0 (coasting). */
  stage: 0 | 1 | 2
}

export interface AscentEvents {
  maxQ: number
  boosterSep: number | null
  meco: number
  stageSep: number
  ses: number
  fairing: number
  seco: number
  /** Time the profile ends (a coast after SECO, or the breakup). */
  end: number
  /** Breakup time when the launch fails, else null. */
  breakup: number | null
}

export interface AscentProfile {
  samples: Sample[]
  events: AscentEvents
  /** Reached orbital speed at the target altitude. */
  reachedOrbit: boolean
  maxQKPa: number
  targetKm: number
}

export interface AscentInput {
  klass: LauncherClassId
  /** Mass on top of the upper stage, kg (your craft, or the whole rideshare/cargo stack). */
  payloadKg: number
  /** Orbit altitude, km. */
  targetKm: number
  /** Engine says this launch fails: the profile ends in a breakup near Max-Q. */
  fails?: boolean
}

const rho = (h: number) => (h > 150e3 ? 0 : 1.225 * Math.exp(-h / 8500))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** Thrust and mass flow for a stage at this air pressure (fraction of sea level). */
function engine(s: Stage, pFrac: number, throttle: number) {
  const thrust = lerp(s.thrustVac, s.thrustSL, pFrac) * throttle
  const isp = lerp(s.ispVac, s.ispSL, pFrac)
  return { thrust, mdot: thrust / (isp * G0) }
}

export function simulateAscent({ klass, payloadKg, targetKm, fails = false }: AscentInput): AscentProfile {
  const v = VEHICLES[klass]
  const hT = targetKm * 1000
  const rT = RE + hT
  // The stack on the pad. Payload can't be zero (an empty rocket flies oddly).
  const payload = Math.max(payloadKg, klass === 'small' ? 50 : 500)
  let s1Prop = v.s1.prop
  let bProp = v.s1.prop * v.boosters
  let s2Prop = v.s2.prop
  let fairingOn = v.fairing > 0
  let stage: 0 | 1 | 2 = 1
  let boostersOn = v.boosters > 0

  // State: radius, angle, radial and tangential velocity.
  let r = RE
  let th = 0
  let vr = 0
  let vt = 0
  let t = 0
  const dt = 0.1

  const ev: AscentEvents = { maxQ: 0, boosterSep: null, meco: 0, stageSep: 0, ses: 0, fairing: 0, seco: 0, end: 0, breakup: null }
  let maxQ = 0
  let coastUntil = -1
  let secoDone = false
  const samples: Sample[] = []
  let nextSample = 0
  let pitch = 0

  const mass = () => payload + (fairingOn ? v.fairing : 0) + v.s2.dry + s2Prop + (stage === 1 ? v.s1.dry + s1Prop + (boostersOn ? v.boosters * v.s1.dry + bProp : 0) : 0)

  for (let step = 0; step < 20000; step++) {
    const h = r - RE
    const speed = Math.hypot(vr, vt)
    const pFrac = Math.min(1, rho(h) / 1.225)
    const q = 0.5 * rho(h) * speed * speed
    const m = mass()

    // ---- staging and events
    if (stage === 1 && boostersOn && bProp <= 0) {
      boostersOn = false
      ev.boosterSep = t
    }
    if (stage === 1 && s1Prop <= 0) {
      stage = 0
      ev.meco = t
      ev.stageSep = t + 3
      ev.ses = t + 7
      coastUntil = t + 7
    }
    if (stage === 0 && !secoDone && coastUntil > 0 && t >= coastUntil) {
      stage = 2
      coastUntil = -1
    }
    // Fairing comes off once the upper stage is firing and the air is gone.
    if (fairingOn && stage === 2 && h > 110e3) {
      fairingOn = false
      ev.fairing = t
    }

    // ---- guidance: thrust angle from vertical
    let thrust = 0
    let mdot = 0
    if (stage === 1) {
      // Vertical for the first few seconds, then a smooth pitch-over that follows altitude.
      // Gravity-turn-like profile: the rocket pitches over gradually as it climbs.
      const k = Math.min(1, Math.max(0, (h - 300) / (hT * 0.4)))
      pitch = speed < 60 ? 0 : 84 * Math.pow(k, 0.5)
      // Throttle bucket through Max-Q, and keep the crew-safe g-limit (~4.5 g), as real launches do.
      const full = engine(v.s1, pFrac, 1).thrust * (1 + (boostersOn ? v.boosters : 0))
      const bucket = 1 - 0.28 * Math.min(1, Math.max(0, (q - 18e3) / 10e3))
      const throttle = Math.max(0.4, Math.min(bucket, (4.5 * G0 * m) / full))
      const core = engine(v.s1, pFrac, throttle)
      thrust = core.thrust
      mdot = core.mdot
      s1Prop -= core.mdot * dt
      if (boostersOn) {
        const b = engine(v.s1, pFrac, throttle)
        thrust += b.thrust * v.boosters
        bProp -= b.mdot * v.boosters * dt
      }
    } else if (stage === 2 && s2Prop > 0) {
      // Upper stage: split the thrust between climbing and speeding up along the horizon.
      const e = engine(v.s2, pFrac, Math.max(0.4, Math.min(1, (4 * G0 * m) / engine(v.s2, pFrac, 1).thrust)))
      const aMax = e.thrust / m
      const gEff = MU / (r * r) - (vt * vt) / r
      // Terminal guidance: aim the vertical speed so the stage reaches the target
      // height just as it reaches orbital speed (time-to-go from the speed still needed).
      const vNeed = Math.max(0, Math.sqrt(MU / rT) - vt)
      const tGo = Math.max(8, vNeed / (aMax * 0.9))
      // Climb rate falling linearly to zero at cut-off covers twice the average: 2·Δh/t.
      const vrWant = (2 * (hT - h)) / tGo
      const aVert = Math.max(gEff - 0.6 * aMax, Math.min(gEff + 0.9 * aMax, gEff + (vrWant - vr) / 3))
      pitch = (Math.acos(Math.max(-1, Math.min(1, aVert / aMax))) * 180) / Math.PI
      thrust = e.thrust
      mdot = e.mdot
      s2Prop -= e.mdot * dt
      // Cut-off at circular orbit speed.
      if (vt >= Math.sqrt(MU / r) * 0.999 || s2Prop <= 0) {
        stage = 0
        secoDone = true
        ev.seco = t
      }
    }
    void mdot

    // ---- forces
    const drag = 0.5 * rho(h) * speed * speed * 0.35 * v.area
    const pr = (pitch * Math.PI) / 180
    const aThR = (thrust * Math.cos(pr)) / m
    const aThT = (thrust * Math.sin(pr)) / m
    const aDr = speed > 0 ? drag / m : 0
    const ar = aThR - (aDr * vr) / (speed || 1) - MU / (r * r) + (vt * vt) / r
    const at = aThT - (aDr * vt) / (speed || 1) - (vr * vt) / r

    if (q > maxQ && stage === 1) {
      maxQ = q
      ev.maxQ = t
    }

    if (t >= nextSample) {
      samples.push({
        t: Math.round(t * 10) / 10,
        altKm: h / 1000,
        speed,
        downrangeKm: (th * RE) / 1000,
        qKPa: q / 1000,
        gLoad: Math.hypot(thrust / m - aDr) / G0,
        pitchDeg: pitch,
        stage,
      })
      nextSample += 1
    }

    // ---- breakup (failed launch): just past Max-Q
    if (fails && ev.maxQ > 0 && t > ev.maxQ + 6 && t > 40) {
      ev.breakup = t
      ev.end = t
      break
    }

    // ---- integrate (semi-implicit Euler)
    vr += ar * dt
    vt += at * dt
    r += vr * dt
    th += (vt / r) * dt
    t += dt
    if (r < RE) r = RE
    if (secoDone && t > ev.seco + 60) {
      ev.end = t
      break
    }
  }
  if (!ev.end) ev.end = t
  if (!ev.fairing) ev.fairing = ev.ses + 5
  if (!ev.seco) ev.seco = ev.end

  const last = samples[samples.length - 1]
  return {
    samples,
    events: ev,
    reachedOrbit: !fails && secoDone && Math.abs(last.altKm - targetKm) < targetKm * 0.15,
    maxQKPa: maxQ / 1000,
    targetKm,
  }
}

/** Telemetry at any time, interpolated between the 1 s samples. */
export function sampleAt(p: AscentProfile, t: number): Sample {
  const s = p.samples
  if (t <= 0) return s[0]
  const i = Math.min(s.length - 2, Math.max(0, Math.floor(t)))
  const a = s[i]
  const b = s[i + 1] ?? a
  const k = Math.max(0, Math.min(1, t - a.t))
  return {
    t,
    altKm: lerp(a.altKm, b.altKm, k),
    speed: lerp(a.speed, b.speed, k),
    downrangeKm: lerp(a.downrangeKm, b.downrangeKm, k),
    qKPa: lerp(a.qKPa, b.qKPa, k),
    gLoad: lerp(a.gLoad, b.gLoad, k),
    pitchDeg: lerp(a.pitchDeg, b.pitchDeg, k),
    stage: k < 0.5 ? a.stage : b.stage,
  }
}

/**
 * The launch scene runs on a short timeline (seconds on screen); this maps it
 * to flight time so each on-screen moment (Max-Q, separation, fairing, orbit)
 * lands on the matching moment of the real ascent.
 */
export function flightTime(p: AscentProfile, sceneT: number, T: { liftoff: number; maxQ: number; sep: number; fairing: number; orbit: number; done: number; fail: number }, fails: boolean): number {
  const e = p.events
  const keys: [number, number][] = fails
    ? [
        [T.liftoff, 0],
        [T.maxQ, e.maxQ],
        [T.fail, e.breakup ?? e.maxQ + 8],
      ]
    : [
        [T.liftoff, 0],
        [T.maxQ, e.maxQ],
        [T.sep, e.stageSep],
        // (No fairing key: it comes off only seconds after separation, and a key that
        // close would make playback crawl then race. The scene times the fairing itself.)
        [T.orbit, e.seco],
        [T.done, e.end],
      ]
  // Keep flight times increasing, whatever order the events came in.
  for (let i = 1; i < keys.length; i++) keys[i][1] = Math.max(keys[i][1], keys[i - 1][1] + 1)
  if (sceneT <= keys[0][0]) return sceneT - T.liftoff
  if (sceneT >= keys[keys.length - 1][0]) return keys[keys.length - 1][1]

  // Smooth (monotone cubic) curve through the key moments, so the playback rate
  // eases from one phase to the next instead of jumping: no sudden lurch of the
  // Earth or the trail when the flight speeds up in space.
  const n = keys.length
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]))
  const m: number[] = new Array(n)
  // Lift-off starts at walking pace (rate 1:1 with the clock on the pad), not mid-sprint.
  m[0] = Math.min(d[0], 1)
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]) // harmonic mean keeps it monotone
  for (let i = 1; i < n; i++) {
    const [t0, f0] = keys[i - 1]
    const [t1, f1] = keys[i]
    if (sceneT > t1) continue
    const h = t1 - t0
    const u = (sceneT - t0) / h
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1
    const h10 = u ** 3 - 2 * u ** 2 + u
    const h01 = -2 * u ** 3 + 3 * u ** 2
    const h11 = u ** 3 - u ** 2
    return h00 * f0 + h10 * h * m[i - 1] + h01 * f1 + h11 * h * m[i]
  }
  return keys[n - 1][1]
}
