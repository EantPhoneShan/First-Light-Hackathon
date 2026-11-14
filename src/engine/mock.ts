/**
 * TEMPORARY mock data and engine stubs so the UI can be built before
 * Member 1's data files and rules.ts land. Numbers are placeholders.
 * Delete this file once the real engine is wired in.
 */
import type { Design, Gauge, LaunchCheck, Launcher, Orbit, OrbitStats, Part, PartCategory, Scenario, SlotDef, Station, Status } from './placeholderTypes'

export const scenarios: Scenario[] = [
  {
    id: 'wildfire-watch',
    name: 'Wildfire Watch',
    objective: 'Image fire-prone areas every few days for 3 years',
    customer: 'Firefighters',
    craft: '6U CubeSat',
    budgetM: 4,
    lifetimeYears: 3,
    launchDate: '2028-03-01',
    goodOrbits: ['sso', 'leo'],
    critical: ['comms'], // PRD: Data + Communications, both shown on the comms & data gauge
    difficulty: 'easy',
  },
  {
    id: 'flood-radar',
    name: 'Flood Radar',
    objective: 'See through clouds during storms',
    customer: 'Disaster agencies',
    craft: 'Small sat',
    budgetM: 40,
    lifetimeYears: 5,
    launchDate: '2028-09-01',
    goodOrbits: ['leo', 'sso'],
    critical: ['power', 'mass'],
    difficulty: 'easy',
  },
]

/** Slot layouts per bus size. Bigger buses get more slots. */
const slot = (accepts: PartCategory, n: number, zone: SlotDef['zone'], label: string): SlotDef => ({
  id: `${accepts}-${n}`,
  accepts,
  zone,
  label,
})

const coreSlots = [
  slot('battery', 1, 'core', 'Battery'),
  slot('computer', 1, 'core', 'Computer'),
  slot('attitude', 1, 'core', 'Attitude'),
  slot('propulsion', 1, 'core', 'Propulsion'),
]

const layouts: Record<string, SlotDef[]> = {
  '3u': [slot('power', 1, 'left', 'Power'), slot('comms', 1, 'top', 'Antenna'), ...coreSlots.slice(0, 3), slot('instrument', 1, 'bottom', 'Instrument')],
  '6u': [
    slot('power', 1, 'left', 'Power'),
    slot('power', 2, 'right', 'Power'),
    slot('comms', 1, 'top', 'Antenna'),
    ...coreSlots,
    slot('instrument', 1, 'bottom', 'Instrument'),
    slot('instrument', 2, 'bottom', 'Instrument'),
  ],
  '12u': [
    slot('power', 1, 'left', 'Power'),
    slot('power', 2, 'right', 'Power'),
    slot('comms', 1, 'top', 'Antenna'),
    slot('comms', 2, 'top', 'Antenna'),
    ...coreSlots,
    slot('battery', 2, 'core', 'Battery'),
    slot('instrument', 1, 'bottom', 'Instrument'),
    slot('instrument', 2, 'bottom', 'Instrument'),
    slot('instrument', 3, 'bottom', 'Instrument'),
  ],
}

export const BUS_SLOT: SlotDef = { id: 'bus', accepts: 'bus', zone: 'core', label: 'Bus' }

export const parts: Part[] = [
  { id: 'bus-3u', category: 'bus', tier: 'simple', name: '3U CubeSat bus', massKg: 1.5, powerW: 0.5, costM: 0.3, buildMonths: 4, reliability: 0.97, massLimitKg: 5, slots: layouts['3u'], icon: 'part-bus-small.webp', tooltip: 'A frame the size of a loaf of bread. Light and cheap, but few slots.' },
  { id: 'bus-6u', category: 'bus', tier: 'simple', name: '6U CubeSat bus', massKg: 3, powerW: 1, costM: 0.6, buildMonths: 6, reliability: 0.97, massLimitKg: 12, slots: layouts['6u'], icon: 'part-bus-medium.webp', tooltip: 'The frame that holds everything. 6U is about the size of a cereal box.' },
  { id: 'bus-12u', category: 'bus', tier: 'simple', name: '12U CubeSat bus', massKg: 6, powerW: 2, costM: 1.2, buildMonths: 8, reliability: 0.96, massLimitKg: 24, slots: layouts['12u'], icon: 'part-bus-large.webp', tooltip: 'Room for more instruments, but heavier and pricier to launch.' },
  { id: 'solar-body', category: 'power', tier: 'simple', name: 'Body-mounted solar', massKg: 0.3, powerW: -8, costM: 0.1, buildMonths: 2, reliability: 0.99, icon: 'part-solar-body.webp', tooltip: 'Solar cells glued to the sides. Cheap, but not much power.' },
  { id: 'solar-wings', category: 'power', tier: 'simple', name: 'Deployable solar wings', massKg: 0.8, powerW: -20, costM: 0.4, buildMonths: 4, reliability: 0.95, icon: 'part-solar-wings.webp', tooltip: 'Panels that unfold in orbit for much more power.' },
  { id: 'battery-small', category: 'battery', tier: 'simple', name: 'Small battery', batteryWh: 8, massKg: 0.3, powerW: 0, costM: 0.1, buildMonths: 1, reliability: 0.98, icon: 'part-battery-small.webp', tooltip: "Keeps the craft alive in Earth's shadow, but only just." },
  { id: 'battery-large', category: 'battery', tier: 'simple', name: 'Large battery', batteryWh: 40, massKg: 0.9, powerW: 0, costM: 0.2, buildMonths: 2, reliability: 0.98, icon: 'part-battery-large.webp', tooltip: 'Enough energy to get through a long eclipse.' },
  { id: 'radio-uhf', category: 'comms', tier: 'simple', name: 'UHF radio', massKg: 0.1, powerW: 2, costM: 0.05, buildMonths: 1, reliability: 0.97, downlinkGbPerPass: 0.2, icon: 'part-antenna-uhf.webp', tooltip: 'Simple and cheap, but sends data slowly.' },
  { id: 'radio-s', category: 'comms', tier: 'simple', name: 'S-band radio', massKg: 0.2, powerW: 6, costM: 0.15, buildMonths: 2, reliability: 0.97, downlinkGbPerPass: 1.5, icon: 'part-antenna-s.webp', tooltip: 'Faster downlink. Good for small images.' },
  { id: 'radio-x', category: 'comms', tier: 'simple', name: 'X-band radio', massKg: 0.3, powerW: 12, costM: 0.4, buildMonths: 3, reliability: 0.96, downlinkGbPerPass: 6, icon: 'part-antenna-x.webp', tooltip: 'Sends lots of data quickly, but uses more power.' },
  { id: 'computer-std', category: 'computer', tier: 'simple', name: 'Standard computer', storageGb: 8, massKg: 0.1, powerW: 1.5, costM: 0.05, buildMonths: 1, reliability: 0.96, icon: 'part-computer.webp', tooltip: 'Runs the spacecraft and stores data until it can be sent.' },
  { id: 'magnetorquer', category: 'attitude', tier: 'simple', name: 'Magnetorquers', massKg: 0.2, powerW: 1, costM: 0.05, buildMonths: 1, reliability: 0.98, icon: 'part-magnetorquer.webp', tooltip: "Uses Earth's magnetic field to turn the craft. Slow but simple." },
  { id: 'cold-gas', category: 'propulsion', tier: 'simple', name: 'Cold-gas thruster', massKg: 0.6, powerW: 0.5, costM: 0.2, buildMonths: 3, reliability: 0.95, icon: 'part-cold-gas-thruster.webp', tooltip: 'Small puffs of gas to move the craft and de-orbit at the end.' },
  { id: 'camera', category: 'instrument', tier: 'simple', name: 'Camera', massKg: 0.4, powerW: 4, costM: 0.3, buildMonths: 2, reliability: 0.97, dataPerOrbitGb: 1, icon: 'part-camera.webp', tooltip: 'Takes pictures in visible light. Cannot see through smoke or clouds.' },
  { id: 'thermal-imager', category: 'instrument', tier: 'simple', name: 'Thermal imager', massKg: 0.7, powerW: 8, costM: 0.8, buildMonths: 4, reliability: 0.95, dataPerOrbitGb: 2.5, icon: 'part-thermal-imager.webp', tooltip: 'Sees heat, so it spots fires even through smoke.' },
  { id: 'radar', category: 'instrument', tier: 'simple', name: 'Imaging radar', massKg: 4, powerW: 30, costM: 2.5, buildMonths: 7, reliability: 0.93, dataPerOrbitGb: 3, icon: 'part-radar.webp', tooltip: 'Bounces radio waves off the ground, so it sees through clouds and at night. Heavy and power-hungry.' },
]

export const partById = (id: string | null | undefined) => (id ? parts.find((p) => p.id === id) : undefined)

/** Slots available for a design: the bus slot, plus whatever the chosen bus offers. */
export function slotsFor(design: Design): SlotDef[] {
  const bus = partById(design.partsBySlot.bus)
  return [BUS_SLOT, ...(bus?.slots ?? [])]
}

export const emptyDesign = (): Design => ({
  orbitId: null,
  altitudeKm: 500,
  launcherId: null,
  partsBySlot: {},
  stationIds: [],
  version: 0,
  updatedBy: null,
})


/**
 * Tutorial craft (F1): looks fine on every gauge, but the small battery can't last through
 * Earth's shadow, so it dies about 50 minutes after launch. The fix is the large battery.
 */
export const tutorialDesign = (): Design => ({
  orbitId: 'sso',
  altitudeKm: 600,
  launcherId: 'rideshare',
  stationIds: ['svalbard'],
  version: 1,
  updatedBy: null,
  partsBySlot: {
    bus: 'bus-6u',
    'power-1': 'solar-wings',
    'power-2': 'solar-wings',
    'comms-1': 'radio-x',
    'battery-1': 'battery-small',
    'computer-1': 'computer-std',
    'attitude-1': 'magnetorquer',
    'propulsion-1': 'cold-gas',
    'instrument-1': 'thermal-imager',
  },
})

/* ---------------- Orbits, launchers, ground stations ---------------- */

export const orbits: Orbit[] = [
  { id: 'leo', name: 'Low Earth orbit', short: 'LEO', tier: 'simple', inclinationDeg: 51.6, altitudeKm: { min: 300, max: 1000, default: 500 }, goodFor: 'Close to Earth, so pictures are sharp and radios need little power. Thin air slowly drags you down.' },
  { id: 'sso', name: 'Sun-synchronous orbit', short: 'SSO', tier: 'simple', inclinationDeg: 97.8, altitudeKm: { min: 450, max: 900, default: 600 }, goodFor: 'Passes over each place at the same local time every day, so images are easy to compare.' },
  { id: 'meo', name: 'Medium Earth orbit', short: 'MEO', tier: 'simple', inclinationDeg: 55, altitudeKm: { min: 2000, max: 20200, default: 8000 }, goodFor: 'Used by navigation satellites. Sees a lot of Earth at once, but radiation is harsh.' },
  { id: 'geo', name: 'Geostationary orbit', short: 'GEO', tier: 'simple', inclinationDeg: 0, altitudeKm: { min: 35786, max: 35786, default: 35786 }, goodFor: 'Stays above one spot on the equator and watches it all the time. Far away and costly to reach.' },
  { id: 'lunar', name: 'Lunar orbit', short: 'Moon', tier: 'advanced', inclinationDeg: null, altitudeKm: null, goodFor: 'Circles the Moon. Needs a big rocket, lots of delta-v and a strong radio.' },
  { id: 'mars', name: 'Mars transfer', short: 'Mars', tier: 'advanced', inclinationDeg: null, altitudeKm: null, goodFor: 'A months-long trip to Mars. You can only launch when the planets line up (every 26 months).' },
]

export const launchers: Launcher[] = [
  { id: 'rideshare', name: 'CubeSat rideshare', costM: 0.3, capacityKg: { leo: 24, sso: 24 }, tooltip: "Hitch a ride on someone else's rocket. Very cheap, but only for tiny satellites going to low orbits." },
  { id: 'small', name: 'Small rocket', costM: 8, capacityKg: { leo: 500, sso: 400 }, tooltip: 'Your own small rocket: you choose the orbit and launch date.' },
  { id: 'medium', name: 'Medium rocket', costM: 30, capacityKg: { leo: 8000, sso: 6000, meo: 3000, geo: 2500, lunar: 1200 }, tooltip: 'Lifts several tonnes to low orbit, much less to high orbits.' },
  { id: 'heavy', name: 'Heavy rocket', costM: 90, capacityKg: { leo: 22000, sso: 17000, meo: 9000, geo: 8000, lunar: 5000, mars: 4000 }, tooltip: 'Big enough for the Moon and Mars, at a big price.' },
  { id: 'super', name: 'Super-heavy rocket', costM: 150, capacityKg: { leo: 60000, sso: 50000, meo: 25000, geo: 22000, lunar: 15000, mars: 12000 }, tooltip: 'The largest class. Usually far more than a science mission needs.' },
]

export const stations: Station[] = [
  { id: 'svalbard', name: 'Svalbard, Norway', lat: 78.2, lon: 15.4, opsCostMPerYear: 0.15, note: 'Near the North Pole: polar orbits pass over it almost every orbit.' },
  { id: 'alaska', name: 'Fairbanks, Alaska', lat: 64.8, lon: -147.7, opsCostMPerYear: 0.12, note: 'High latitude: many passes for polar orbits.' },
  { id: 'kuching', name: 'Kuching, Malaysia', lat: 1.6, lon: 110.3, opsCostMPerYear: 0.08, note: 'Near the equator: sees every orbit type, but only a few passes a day.' },
  { id: 'hawaii', name: 'Hawaii, USA', lat: 19.8, lon: -155.5, opsCostMPerYear: 0.1, note: 'Pacific site that fills gaps between other stations.' },
  { id: 'perth', name: 'Perth, Australia', lat: -31.8, lon: 115.9, opsCostMPerYear: 0.1, note: 'Southern hemisphere coverage.' },
  { id: 'chile', name: 'Santiago, Chile', lat: -33.4, lon: -70.7, opsCostMPerYear: 0.1, note: 'Southern hemisphere coverage for the Americas.' },
]

export const orbitById = (id: string | null) => orbits.find((o) => o.id === id)
export const launcherById = (id: string | null) => launchers.find((l) => l.id === id)

const RE = 6371
const MU = 398600

/** Passes per day one station gets for an orbit (very rough). */
export function stationPasses(orbit: Orbit, st: Station): number {
  if (orbit.inclinationDeg === null) return 1 // deep space: one long contact a day
  if (orbit.id === 'geo') return Math.abs(st.lat) < 70 ? 24 : 0 // always in view: count hourly
  const lat = Math.abs(st.lat)
  if (orbit.inclinationDeg > 80) return lat >= 60 ? 10 : 4
  return lat <= orbit.inclinationDeg + 15 ? 4 : 0
}

/** Orbit period in minutes for a circular orbit at altitude h km. */
export const periodAt = (h: number) => (2 * Math.PI * Math.sqrt((RE + h) ** 3 / MU)) / 60

/** Days between looks at the same place for one satellite at altitude h (swath grows with altitude). */
export const revisitAt = (h: number) => Math.min(30, (40075 * 0.77) / (2 * 0.5 * h * (1440 / periodAt(h))))

/** Ground size of one pixel for a standard camera at altitude h, in metres. */
export const detailAt = (h: number) => h * 0.01

/** Stub for Member 1's simulate.ts orbit maths. Simplified and approximate. */
export function orbitStats(design: Design): OrbitStats | null {
  const orbit = orbitById(design.orbitId)
  if (!orbit) return null
  const chosen = stations.filter((s) => design.stationIds.includes(s.id))
  const passesPerDay = chosen.reduce((n, s) => n + stationPasses(orbit, s), 0)
  if (!orbit.altitudeKm) {
    return { periodMin: 0, orbitsPerDay: 1, eclipsePct: 0, eclipseMin: 0, revisitDays: null, detailM: null, passesPerDay }
  }
  const h = design.altitudeKm
  const a = RE + h
  const periodMin = periodAt(h)
  const orbitsPerDay = 1440 / periodMin
  const eclipseFrac = orbit.id === 'geo' ? 0.05 : Math.asin(RE / a) / Math.PI
  const revisitDays = orbit.id === 'geo' ? 0 : revisitAt(h)
  return {
    periodMin,
    orbitsPerDay,
    eclipsePct: eclipseFrac * 100,
    eclipseMin: eclipseFrac * periodMin,
    revisitDays,
    detailM: detailAt(h),
    passesPerDay,
  }
}

/** Stub for rules.ts compatibility check: can this rocket lift this craft to this orbit? */
export function launchCheck(design: Design, launcher: Launcher): LaunchCheck {
  const orbit = orbitById(design.orbitId)
  if (!orbit) return { ok: false, reason: 'Pick an orbit first.' }
  const cap = launcher.capacityKg[orbit.id]
  if (cap === undefined) return { ok: false, reason: `The ${launcher.name} can't reach ${orbit.short}.` }
  const mass = craftMass(design)
  if (mass > cap) return { ok: false, reason: `Your craft is ${fmtNum(mass - cap)} kg over what the ${launcher.name} can lift to ${orbit.short}.` }
  return { ok: true, reason: `Lifts up to ${cap.toLocaleString()} kg to ${orbit.short}.` }
}

const fmtNum = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1))
const chosenParts = (d: Design) => Object.values(d.partsBySlot).map(partById).filter((p): p is Part => !!p)
export const craftMass = (d: Design) => chosenParts(d).reduce((s, p) => s + p.massKg, 0)

function deltaVNeeded(design: Design): number {
  const orbit = orbitById(design.orbitId)
  if (!orbit) return 0
  if (orbit.id === 'leo' || orbit.id === 'sso') return design.altitudeKm > 600 ? 30 + (design.altitudeKm - 600) * 0.15 : 10
  return { meo: 120, geo: 11, lunar: 800, mars: 2100 }[orbit.id] ?? 0
}

/** Stub for Member 1's rules.ts. Simple sums so gauges move while we build the UI. */
export function mockGauges(design: Design, scenario: Scenario): Gauge[] {
  const chosen = chosenParts(design)
  const sum = (f: (p: Part) => number) => chosen.reduce((s, p) => s + f(p), 0)
  const status = (used: number, limit: number): Status =>
    used === 0 && limit === 0 ? 'ok' : used > limit ? 'bad' : used > limit * 0.85 ? 'warn' : 'ok'
  const crit = (k: Gauge['key']) => scenario.critical.includes(k)

  const bus = partById(design.partsBySlot.bus)
  const orbit = orbitById(design.orbitId)
  const launcher = launcherById(design.launcherId)
  const stats = orbitStats(design)

  // Mass: the tighter of the bus limit and the rocket's capacity to this orbit.
  const mass = sum((p) => p.massKg)
  const rocketCap = launcher && orbit ? launcher.capacityKg[orbit.id] : undefined
  const massLimit = Math.min(bus?.massLimitKg ?? Infinity, rocketCap ?? Infinity)
  const massGauge: Gauge = { key: 'mass', label: 'Mass', used: mass, limit: Number.isFinite(massLimit) ? massLimit : 0, unit: 'kg', status: 'ok', critical: crit('mass') }
  if (launcher && orbit && rocketCap === undefined) Object.assign(massGauge, { status: 'bad', note: `Rocket can't reach ${orbit.short}` })
  else if (Number.isFinite(massLimit)) massGauge.status = status(mass, massLimit)

  // Power
  const draw = sum((p) => Math.max(0, p.powerW))
  const gen = sum((p) => Math.max(0, -p.powerW))

  // Data & comms: data made per orbit vs data sent per orbit (radio speed × passes per orbit).
  const dataMade = sum((p) => p.dataPerOrbitGb ?? 0)
  const radioGb = sum((p) => p.downlinkGbPerPass ?? 0)
  const passesPerOrbit = stats ? stats.passesPerDay / stats.orbitsPerDay : 0
  const downlink = radioGb * passesPerOrbit
  const comms: Gauge = { key: 'comms', label: 'Data & comms', used: dataMade, limit: downlink, unit: 'GB/orbit', status: status(dataMade, downlink), critical: crit('comms') }
  if (dataMade > 0 && radioGb === 0) comms.note = 'No radio'
  else if (dataMade > 0 && !orbit) comms.note = 'Pick an orbit'
  else if (dataMade > 0 && design.stationIds.length === 0) comms.note = 'No ground station'
  else if (dataMade > 0 && passesPerOrbit === 0) comms.note = 'Stations never see this orbit'

  // Budget: parts + launch + operations for the whole lifetime.
  const opsPerYear = stations.filter((s) => design.stationIds.includes(s.id)).reduce((n, s) => n + s.opsCostMPerYear, 0)
  const cost = sum((p) => p.costM) + (launcher?.costM ?? 0) + opsPerYear * scenario.lifetimeYears

  // Time
  const months = chosen.reduce((m, p) => Math.max(m, p.buildMonths), 0)

  // Delta-v: needed for station-keeping and de-orbit vs what the thruster gives.
  const needed = deltaVNeeded(design)
  const hasThruster = chosen.some((p) => p.category === 'propulsion')
  const dv: Gauge = { key: 'deltaV', label: 'Delta-v', used: needed, limit: hasThruster ? 60 : 0, unit: 'm/s', status: status(needed, hasThruster ? 60 : 0), critical: crit('deltaV') }
  if (needed > 0 && !hasThruster) dv.note = 'No thruster'

  return [
    massGauge,
    { key: 'power', label: 'Power', used: draw, limit: gen, unit: 'W', status: status(draw, gen), critical: crit('power'), note: draw > 0 && gen === 0 ? 'No power source' : undefined },
    comms,
    { key: 'budget', label: 'Budget', used: cost, limit: scenario.budgetM, unit: '$M', status: status(cost, scenario.budgetM), critical: crit('budget') },
    { key: 'time', label: 'Build time', used: months, limit: 18, unit: 'months', status: status(months, 18), critical: crit('time') },
    dv,
  ]
}
