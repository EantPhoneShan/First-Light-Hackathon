/**
 * Simple orbit maths (circular orbits). Approximate by design: believable
 * numbers a beginner can follow, not mission-grade results (see GMAT for those).
 */
import type { DecayPoint, Orbit, OrbitInfo } from './types';

/** Earth radius in km. */
export const EARTH_RADIUS_KM = 6371;
/** Earth's gravity constant, km^3/s^2. */
export const MU_EARTH = 398600.4418;
/** Standard gravity, m/s^2 (for the rocket equation). */
export const G0 = 9.80665;

/** Minutes for one lap at this altitude. */
export function periodMin(altitudeKm: number): number {
  const r = EARTH_RADIUS_KM + altitudeKm;
  return (2 * Math.PI * Math.sqrt(r ** 3 / MU_EARTH)) / 60;
}

/** Orbit speed in m/s. */
export function circularSpeedMs(altitudeKm: number): number {
  return Math.sqrt(MU_EARTH / (EARTH_RADIUS_KM + altitudeKm)) * 1000;
}

/**
 * Share of each orbit spent in Earth's shadow, 0 to 1 (cylindrical shadow).
 * betaDeg is the Sun's angle to the orbit plane; 0 gives the longest eclipse.
 */
export function eclipseFraction(altitudeKm: number, betaDeg: number): number {
  const r = EARTH_RADIUS_KM + altitudeKm;
  const beta = (betaDeg * Math.PI) / 180;
  const x = Math.sqrt(altitudeKm ** 2 + 2 * EARTH_RADIUS_KM * altitudeKm) / (r * Math.cos(beta));
  return x >= 1 ? 0 : Math.acos(x) / Math.PI;
}

/** Years before drag brings an unpowered craft down (log-interpolated table). */
export function decayYears(altitudeKm: number, table: DecayPoint[]): number {
  if (table.length === 0) return Infinity;
  if (altitudeKm <= table[0].altitudeKm) return table[0].years;
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1];
    const b = table[i];
    if (altitudeKm <= b.altitudeKm) {
      const t = (altitudeKm - a.altitudeKm) / (b.altitudeKm - a.altitudeKm);
      return Math.exp(Math.log(a.years) + t * (Math.log(b.years) - Math.log(a.years)));
    }
  }
  // Above the table (GEO): drag is effectively zero.
  return Infinity;
}

/** Highest altitude whose decay time is within the rule (e.g. 25 years). */
export function safeDecayAltitudeKm(ruleYears: number, table: DecayPoint[]): number {
  let best = table[0]?.altitudeKm ?? 0;
  const top = table.length ? table[table.length - 1].altitudeKm : best;
  for (let alt = best; alt <= top; alt += 5) {
    if (decayYears(alt, table) <= ruleYears) best = alt;
  }
  return best;
}

/**
 * Delta-v (m/s) to lower the low point of the orbit from a circular altitude
 * down to targetKm, so drag finishes the job (one burn of a Hohmann transfer).
 */
export function lowerPerigeeDeltaV(fromKm: number, targetKm: number): number {
  if (targetKm >= fromKm) return 0;
  const r = EARTH_RADIUS_KM + fromKm;
  const rp = EARTH_RADIUS_KM + targetKm;
  return circularSpeedMs(fromKm) * (1 - Math.sqrt((2 * rp) / (r + rp)));
}

/** Delta-v (m/s) for a two-burn raise between circular orbits (e.g. GEO to graveyard). */
export function raiseOrbitDeltaV(fromKm: number, toKm: number): number {
  const r1 = EARTH_RADIUS_KM + fromKm;
  const r2 = EARTH_RADIUS_KM + toKm;
  const v1 = Math.sqrt(MU_EARTH / r1);
  const v2 = Math.sqrt(MU_EARTH / r2);
  const a = (r1 + r2) / 2;
  const vp = Math.sqrt(MU_EARTH * (2 / r1 - 1 / a));
  const va = Math.sqrt(MU_EARTH * (2 / r2 - 1 / a));
  return (Math.abs(vp - v1) + Math.abs(v2 - va)) * 1000;
}

/** Rocket equation: delta-v (m/s) from burning propellantKg out of a craft of wetMassKg. */
export function rocketDeltaV(ispS: number, wetMassKg: number, propellantKg: number): number {
  const dry = wetMassKg - propellantKg;
  if (ispS <= 0 || propellantKg <= 0 || dry <= 0) return 0;
  return ispS * G0 * Math.log(wetMassKg / dry);
}

/** Altitude actually flown: the slider value kept inside the orbit's range. */
export function clampAltitude(orbit: Orbit, altitudeKm: number | null): number {
  const alt = altitudeKm ?? orbit.altitudeKm;
  return Math.min(orbit.maxAltitudeKm, Math.max(orbit.minAltitudeKm, alt));
}

export function orbitInfo(orbit: Orbit, altitudeKm: number | null, decay: DecayPoint[]): OrbitInfo {
  const alt = clampAltitude(orbit, altitudeKm);
  const period = periodMin(alt);
  const ef = eclipseFraction(alt, orbit.betaDeg);
  return {
    altitudeKm: alt,
    periodMin: period,
    orbitsPerDay: 1440 / period,
    eclipseMin: ef * period,
    eclipseFraction: ef,
    decayYears: decayYears(alt, decay),
  };
}
