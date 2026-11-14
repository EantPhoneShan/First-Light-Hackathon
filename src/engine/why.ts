/**
 * Why sentences (task 1.5): one plain-English sentence per failed or risky
 * check, with the real numbers, plus a hint of what to try.
 * Short words, no jargon without a reason: players can be 12 years old.
 */

export interface Why {
  why: string;
  hint?: string;
}

/** Rounds to a friendly number of digits: 0.0347 -> "0.035", 12.34 -> "12", 2.46 -> "2.5". */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const a = Math.abs(n);
  const digits = a >= 100 ? 0 : a >= 10 ? 0 : a >= 1 ? 1 : a >= 0.1 ? 2 : 3;
  return Number(n.toFixed(digits)).toLocaleString('en-US');
}

export const money = (m: number) => `$${fmt(m)}M`;
export const pct = (p: number) => `${Math.round(p)}%`;

/** "2.4 years" / "1 year" / "8 months" */
export function years(y: number): string {
  if (!Number.isFinite(y)) return 'hundreds of years';
  if (y < 1) return `${Math.max(1, Math.round(y * 12))} months`;
  const v = fmt(y);
  return `${v} year${v === '1' ? '' : 's'}`;
}

export function hours(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} minutes`;
  const v = fmt(h);
  return `${v} hour${v === '1' ? '' : 's'}`;
}

export const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

// ---------------------------------------------------------------------------
// Missing choices (blocking)
// ---------------------------------------------------------------------------

export const why = {
  noBus: (): Why => ({ why: 'Pick a spacecraft bus first. It is the body that holds every part.' }),
  noOrbit: (): Why => ({ why: 'Pick an orbit, so the team knows where the craft will fly.' }),
  noLauncher: (): Why => ({ why: 'Pick a rocket to carry the craft to space.' }),
  noAntenna: (): Why => ({
    why: 'There is no radio, so the craft could never talk to Earth.',
    hint: 'Add a UHF, S-band or X-band radio.',
  }),
  noInstrument: (): Why => ({
    why: 'There is no instrument, so the mission collects no science.',
    hint: 'Add an instrument that fits your science goal.',
  }),
  noSolar: (): Why => ({
    why: 'There are no solar panels, so the battery would be empty within hours.',
    hint: 'Add body solar cells or solar wings.',
  }),
  noBattery: (): Why => ({
    why: 'There is no battery, so everything switches off the moment the craft enters Earth’s shadow.',
    hint: 'Add a battery.',
  }),
  noComputer: (): Why => ({
    why: 'There is no flight computer to run the craft or store its data.',
    hint: 'Add a flight computer.',
  }),
  noAdcs: (): Why => ({
    why: 'Nothing can turn the craft, so instruments can’t point at the ground and the antenna can’t point at Earth.',
    hint: 'Add a magnetorquer (cheap) or a reaction wheel (precise).',
  }),
  noStations: (): Why => ({
    why: 'No ground station is chosen, so nobody on Earth is listening.',
    hint: 'Pick at least one ground station.',
  }),

  // -------------------------------------------------------------------------
  // Fit and compatibility (blocking)
  // -------------------------------------------------------------------------

  slots: (used: number, slots: number, bus: string): Why => ({
    why: `The parts need ${used} slots, but the ${bus} only has ${slots}.`,
    hint: 'Remove a part, or pick parts that take fewer slots.',
  }),
  tooMany: (part: string, max: number): Why => ({
    why: `A craft can carry at most ${max} ${part}${max === 1 ? '' : 's'}.`,
  }),
  doesNotFit: (part: string, bus: string): Why => ({
    why: `The ${part} is too big for the ${bus}.`,
    hint: 'Choose a part made for this bus size.',
  }),
  launcherNoOrbit: (rocket: string, orbit: string): Why => ({
    why: `The ${rocket} can’t reach the ${orbit}.`,
    hint: 'Pick another rocket or another orbit.',
  }),
  launcherTooSmallBus: (rocket: string, bus: string): Why => ({
    why: `The ${rocket} can’t carry a ${bus}.`,
    hint: 'Pick a bigger rocket.',
  }),

  // -------------------------------------------------------------------------
  // Resources (may fly, then fail)
  // -------------------------------------------------------------------------

  massOverRocket: (mass: number, cap: number, rocket: string, orbit: string, heavy: string[]): Why => ({
    why: `Your craft is ${fmt(mass - cap)} kg over what the ${rocket} can lift to the ${orbit} (${fmt(mass)} of ${fmt(cap)} kg).`,
    hint: heavy.length ? `Lighten it: the heaviest parts are the ${list(heavy)}. Or pick a bigger rocket.` : 'Pick a bigger rocket.',
  }),
  massOverBus: (mass: number, max: number, bus: string): Why => ({
    why: `The ${bus} may weigh at most ${fmt(max)} kg, but yours is ${fmt(mass)} kg.`,
    hint: 'Remove or swap heavy parts.',
  }),

  powerShort: (draw: number, avg: number, eclipseMin: number, canAddSolar: boolean): Why => ({
    why: `Your parts use ${fmt(draw)} W, but the solar panels only make ${fmt(avg)} W on average, because the craft spends ${Math.round(eclipseMin)} minutes of every orbit in Earth’s shadow.`,
    hint: canAddSolar
      ? 'Add more solar panels, or remove parts that use a lot of power.'
      : 'Your solar panels are maxed out: remove or swap parts that use a lot of power.',
  }),
  powerTight: (marginPct: number): Why => ({
    why: `Only ${pct(marginPct)} power to spare. Solar panels slowly wear out, so a thin margin can turn into a shortage.`,
    hint: 'Aim for at least 10% spare.',
  }),
  batteryShort: (needWh: number, haveWh: number, eclipseMin: number, drawW: number): Why => {
    const lastsMin = drawW > 0 ? (haveWh / drawW) * 60 : 0;
    return {
      why: `Your battery runs out ${Math.max(1, Math.round(lastsMin))} minutes into the ${Math.round(eclipseMin)}-minute eclipse (it needs ${fmt(needWh)} Wh, but only ${fmt(haveWh)} Wh can be used).`,
      hint: 'Use a bigger battery, add a second one, or use less power.',
    };
  },

  budgetOver: (total: number, cap: number, opsM: number, yrs: number): Why => ({
    why: `The mission costs ${money(total)}, which is ${money(total - cap)} more than the ${money(cap)} you have (operations for ${years(yrs)} are ${money(opsM)} of it).`,
    hint: 'Pick cheaper parts, a cheaper rocket, or fewer paid ground stations.',
  }),
  budgetReserve: (reservePct: number): Why => ({
    why: `Only ${pct(reservePct)} of the budget is left. CubeSat 101 advises keeping at least 10% for surprises.`,
    hint: 'Swap an expensive part for a cheaper one.',
  }),

  dataStorage: (needMB: number, haveMB: number, gapH: number): Why => ({
    why: `Between ground passes (up to ${hours(gapH)}) the craft collects ${fmt(needMB)} MB, but it can only store ${fmt(haveMB)} MB, so the rest is lost.`,
    hint: 'Add storage (a second computer), more ground stations, or a less data-hungry instrument.',
  }),

  commsShort: (madeMB: number, sentMB: number): Why => {
    const lost = madeMB > 0 ? (1 - sentMB / madeMB) * 100 : 0;
    return {
      why: `${pct(lost)} of your data never reaches Earth: the craft makes ${fmt(madeMB)} MB a day but can only send ${fmt(sentMB)} MB.`,
      hint: 'Try a faster radio (S-band or X-band) or a second ground station.',
    };
  },
  commsNoLink: (madeMB: number): Why => ({
    why: `None of your ground stations can talk to the craft, so all ${fmt(madeMB)} MB a day of data is lost.`,
    hint: 'Pick a station that your orbit flies over and that hears your radio band.',
  }),
  commsTight: (marginPct: number): Why => ({
    why: `The radio link only has ${pct(marginPct)} to spare. One missed pass and data starts to pile up.`,
    hint: 'Add another ground station or a faster radio.',
  }),
  latency: (waitH: number, needH: number, customer: string): Why => ({
    why: `${customer} wait about ${hours(waitH)} for new data, but they need it within ${hours(needH)}.`,
    hint: 'More ground stations means more passes and fresher data.',
  }),
  stationCantHear: (station: string, band: string): Why => ({
    why: `The ${station} can’t receive your ${band} radio, so it never gets any data.`,
    hint: 'Pick a station that supports your radio band, or change radio.',
  }),
  stationNeverSees: (station: string, orbit: string): Why => ({
    why: `The ${station} never sees a craft in the ${orbit}.`,
    hint: 'Pick a station that the orbit flies over.',
  }),

  late: (months: number, launchIn: number, slowest: string, slowestMonths: number): Why => ({
    why: `Building the craft takes ${fmt(months)} months, so it misses launch day by ${fmt(months - launchIn)} months (the ${slowest} alone takes ${fmt(slowestMonths)}).`,
    hint: 'Swap the slowest part for one that is quicker to build.',
  }),
  scheduleTight: (spare: number): Why => ({
    why: `Only ${fmt(spare)} month${spare === 1 ? '' : 's'} to spare before launch day. Any delay and you miss the rocket.`,
  }),

  decayTooSoon: (decay: number, need: number, alt: number): Why => ({
    why: `At ${fmt(alt)} km, air drag pulls the craft down after about ${years(decay)}, but the mission needs ${years(need)}.`,
    hint: 'Fly higher, or pick an orbit with a higher altitude.',
  }),
  revisit: (got: number, need: number, orbit: string): Why => ({
    why: `From the ${orbit} the craft only sees the same spot every ${fmt(got)} days, but the mission needs every ${fmt(need)} days.`,
    hint: 'Pick an orbit with a shorter revisit time.',
  }),

  // -------------------------------------------------------------------------
  // End of mission and delta-v
  // -------------------------------------------------------------------------

  noDisposal: (): Why => ({
    why: 'There is no end-of-mission plan. Dead satellites that stay up become space debris.',
    hint: 'The Mission Planner should choose how the craft leaves its orbit.',
  }),
  debris: (decay: number, rule: number): Why => ({
    why: `Left alone, the craft would stay up as debris for about ${years(decay)}, but the rule is at most ${rule} years.`,
    hint: 'Fly lower, or carry a thruster and plan a de-orbit burn.',
  }),
  graveyardOnlyGeo: (): Why => ({
    why: 'A graveyard orbit is only used for GEO. In low orbit, the craft should come down instead.',
    hint: 'Choose natural decay or a de-orbit burn.',
  }),
  geoNeedsGraveyard: (): Why => ({
    why: 'Air drag never brings a craft down from GEO, so it would drift there forever.',
    hint: 'Plan a move to a graveyard orbit, and carry the propellant for it.',
  }),
  burnNoThruster: (): Why => ({
    why: 'The plan says de-orbit burn, but the craft has no thruster to burn with.',
    hint: 'Add a thruster, or fly low enough to decay naturally.',
  }),
  deltaVShort: (need: number, have: number): Why => ({
    why: `No propellant left for the end of the mission: it needs ${fmt(need)} m/s of delta-v, but the thruster only gives ${fmt(have)} m/s, so it stays as debris.`,
    hint: 'Fly lower so less is needed, or carry a lighter craft.',
  }),

  // -------------------------------------------------------------------------
  // Science traceability (CML 1)
  // -------------------------------------------------------------------------

  instrumentOffGoal: (inst: string, measurement: string): Why => ({
    why: `The ${inst} can’t measure ${measurement.toLowerCase()}.`,
    hint: 'Pick an instrument that fits the chosen measurement.',
  }),
  instrumentOffMission: (inst: string): Why => ({
    why: `The ${inst} doesn’t help any of this mission’s science goals.`,
  }),
};

// ---------------------------------------------------------------------------
// Greyed-out reasons for pickers (short, one line)
// ---------------------------------------------------------------------------

export const reason = {
  launcherNoOrbit: (orbit: string) => `Can’t reach the ${orbit}.`,
  launcherTooSmall: (bus: string) => `Can’t carry a ${bus}.`,
  launcherTooWeak: (mass: number, cap: number) => `Your craft (${fmt(mass)} kg) is over its ${fmt(cap)} kg limit for this orbit.`,
  orbitNoRocket: (orbit: string) => `No rocket that carries this craft reaches the ${orbit}.`,
  orbitTooExpensive: (cheapest: number) => `The cheapest rocket that gets there costs ${money(cheapest)}, more than the whole budget.`,
  partNoFit: (bus: string) => `Doesn’t fit a ${bus}.`,
  partMax: (max: number) => `Limit of ${max} per craft.`,
  partNoSlots: (need: number, free: number) => `Needs ${need} slot${need === 1 ? '' : 's'}, only ${free} free.`,
  stationBand: (band: string) => `Can’t receive ${band}.`,
  stationOrbit: (orbit: string) => `Never sees the ${orbit}.`,
};
