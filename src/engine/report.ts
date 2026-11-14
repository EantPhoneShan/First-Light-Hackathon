/**
 * Mission report (task 1.8, PRD F16 and F18): what happened, why, and what to
 * fix, built from the rules engine, the flight and the score.
 *
 *   const sim = simulate(design, scenario, gameData);
 *   const score = scoreMission(design, scenario, gameData, sim, ctx);
 *   const report = buildMissionReport(design, scenario, gameData, sim, score, lastFlight);
 *
 * Every problem is listed, biggest first; the 3 that cost the most are marked
 * top. A problem seen in flight (battery died on orbit 1) replaces the same
 * problem found at design time, so nothing is said twice.
 */
import { evaluate } from './rules';
import type {
  Design,
  Evaluation,
  Finding,
  FixArea,
  GameData,
  MissionReport,
  Problem,
  ReportCompare,
  Role,
  Scenario,
  ScoreCategory,
  ScoreResult,
  SimMarker,
  SimResult,
} from './types';
import { SCORE_MAX } from './types';
import { hours, when, years } from './why';

const MIN_PER_YEAR = 365.25 * 1440;

export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  objective: 'Objective met',
  customer: 'Value to the data customer',
  efficiency: 'Resource efficiency',
  lifetime: 'Lifetime, schedule and end of mission',
  decisions: 'Decision quality',
  collaboration: 'Collaboration',
};

/** The previous flight, for the ghost comparison. */
export interface PreviousFlight {
  sim: SimResult;
  score: ScoreResult;
  report?: MissionReport;
}

// ---------------------------------------------------------------------------
// Titles and fix areas for each rules-engine problem
// ---------------------------------------------------------------------------

const TITLES: [prefix: string, title: string][] = [
  ['missing.bus', 'No spacecraft bus'],
  ['missing.orbit', 'No orbit chosen'],
  ['missing.launcher', 'No rocket chosen'],
  ['missing.antenna', 'No radio'],
  ['missing.instrument', 'No instrument'],
  ['missing.solar', 'No solar panels'],
  ['missing.battery', 'No battery'],
  ['missing.computer', 'No flight computer'],
  ['missing.adcs', 'The craft can’t point'],
  ['missing.stations', 'No ground station'],
  ['fit.slots', 'Too many parts for the bus'],
  ['fit.size', 'A part is too big for the bus'],
  ['fit.max', 'Too many of one part'],
  ['compat.launcher-orbit', 'The rocket can’t reach this orbit'],
  ['compat.launcher-bus', 'The rocket can’t carry this bus'],
  ['mass.', 'Too heavy'],
  ['power.average', 'Not enough solar power'],
  ['power.battery', 'Battery too small for the eclipse'],
  ['power.margin', 'Thin power margin'],
  ['comms.no-link', 'No ground station can hear the craft'],
  ['comms.downlink', 'Radio link too slow'],
  ['comms.margin', 'Tight radio link'],
  ['comms.latency', 'Data arrives too late'],
  ['comms.station-orbit', 'A ground station never sees the craft'],
  ['comms.station-band', 'A ground station can’t hear the radio'],
  ['data.storage', 'Not enough storage'],
  ['budget.over', 'Over budget'],
  ['budget.reserve', 'Small budget reserve'],
  ['time.late', 'Misses launch day'],
  ['time.tight', 'Tight schedule'],
  ['lifetime.decay', 'Orbit too low to last'],
  ['science.revisit', 'Not revisiting often enough'],
  ['science.off-goal', 'Instrument doesn’t fit the goal'],
  ['disposal.', 'End-of-mission plan'],
  ['deltaV.', 'Not enough propellant'],
];

function titleFor(p: Problem): string {
  return TITLES.find(([prefix]) => p.id.startsWith(prefix))?.[1] ?? 'Problem';
}

function areaFor(p: Problem): FixArea {
  if (p.id.startsWith('comms.') || p.id === 'missing.stations') return 'ground';
  if (p.kind === 'science' && p.id !== 'science.revisit') return 'science';
  if (p.id === 'missing.instrument' || p.id === 'data.storage') return 'science';
  if (['missing.orbit', 'missing.launcher', 'lifetime.decay', 'science.revisit'].includes(p.id)) return 'launch';
  if (p.id.startsWith('compat.') || p.id === 'mass.rocket' || p.id.startsWith('deltaV.')) return 'launch';
  if (p.owner === 'planner') return 'mission';
  return 'spacecraft';
}

/** Rough points a problem costs, for sorting (not shown to players). */
function problemImpact(p: Problem): number {
  if (p.blocking) return 900;
  return p.status === 'fail' ? 300 : 60;
}

function fromProblem(p: Problem): Finding {
  return {
    id: p.id,
    tMin: null,
    kind: p.status === 'fail' ? 'bad' : 'warn',
    title: titleFor(p),
    why: p.why,
    fix: p.hint ?? 'Check this part of the design.',
    owner: p.owner,
    partIds: p.partIds,
    area: areaFor(p),
    impact: problemImpact(p),
    top: false,
  };
}

// ---------------------------------------------------------------------------
// Flight findings: what actually happened, linked to the design problems they prove
// ---------------------------------------------------------------------------

interface FlightFinding {
  finding: Finding;
  /** Design problems this flight event replaces. */
  replaces: (p: Problem) => boolean;
}

function flightFindings(sim: SimResult, ev: Evaluation): FlightFinding[] {
  const out: FlightFinding[] = [];
  const find = (kind: SimMarker['kind'], status?: SimMarker['status']) =>
    sim.markers.find((m) => m.kind === kind && (!status || m.status === status));
  const base = (m: SimMarker, id: string, title: string, owner: Role, area: FixArea, impact: number, kind: Finding['kind'] = 'bad'): Finding => ({
    id,
    tMin: m.tMin,
    kind,
    title,
    why: m.why ?? m.label,
    fix: m.hint ?? 'Check this part of the design.',
    owner,
    partIds: m.partIds ?? [],
    area,
    impact,
    top: false,
  });

  if (sim.outcome === 'launch-failure') {
    const m = sim.markers[0];
    const cause = ev.problems.find((p) => p.blocking) ?? ev.problems.find((p) => p.id.startsWith('mass.'));
    const f = base(m, 'flight.launch', cause ? titleFor(cause) : 'The design can’t fly', cause?.owner ?? 'flight', cause ? areaFor(cause) : 'launch', 1000);
    if (cause) f.why = cause.why;
    if (cause?.hint) f.fix = cause.hint;
    if (cause) f.partIds = cause.partIds;
    out.push({ finding: f, replaces: (p) => p === cause });
  }

  const dead = find('battery-dead');
  if (dead) {
    const solar = /solar/.test(dead.why ?? '') || /Every orbit/.test(dead.why ?? '');
    out.push({
      finding: base(dead, 'flight.battery-dead', solar ? 'Ran out of power' : 'Battery ran out in Earth’s shadow', 'engineer', 'spacecraft', 1000),
      replaces: (p) => p.kind === 'power',
    });
  }

  const burned = sim.markers.find((m) => m.kind === 'deorbit' && m.status === 'fail');
  if (burned) {
    out.push({
      finding: base(burned, 'flight.reentered', 'Burned up too early', 'flight', 'launch', 800),
      replaces: (p) => p.id === 'lifetime.decay',
    });
  }

  const lost = find('data-lost');
  if (lost) {
    const lostPct = sim.summary.madeMB > 0 ? (sim.summary.lostMB / sim.summary.madeMB) * 100 : 0;
    const f = base(lost, 'flight.data-lost', 'Data thrown away', 'flight', 'ground', 100 + 3 * lostPct, lostPct > 10 ? 'bad' : 'warn');
    f.why = `${f.why} In the end ${Math.round(lostPct)}% of everything the craft collected was lost.`;
    out.push({ finding: f, replaces: (p) => p.id === 'comms.downlink' || p.id === 'comms.no-link' || p.id === 'data.storage' });
  }

  const debris = sim.markers.find((m) => m.kind === 'deorbit' && m.status === 'warn');
  if (debris) {
    out.push({
      finding: base(debris, 'flight.debris', 'Left as space debris', 'planner', 'mission', 120, 'warn'),
      replaces: (p) => p.kind === 'disposal' || p.kind === 'deltaV',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tips: ways to score more that aren't problems (missed role goals, trade study)
// ---------------------------------------------------------------------------

const GOAL_FIX: Record<Role, { fix: string; area: FixArea }> = {
  planner: { fix: 'Swap an expensive part or paid ground station for a cheaper one, to keep 10% of the budget.', area: 'mission' },
  engineer: { fix: 'Leave more spare power: add solar panels or swap a power-hungry part.', area: 'spacecraft' },
  science: { fix: 'Carry an instrument (or two) that covers a second kind of measurement.', area: 'science' },
  flight: { fix: 'Send more data down: a faster radio or another ground station.', area: 'ground' },
};

function tips(score: ScoreResult, already: Finding[], finished: boolean): Finding[] {
  const out: Finding[] = [];
  const takenRoles = new Set(already.filter((f) => f.kind !== 'tip').map((f) => f.owner));
  for (const g of score.roleGoals) {
    if (g.met || takenRoles.has(g.role)) continue;
    // Planner, Engineer and Flight goals are only judged on a finished mission:
    // after a crash, fixing the crash comes first.
    if (!finished && g.role !== 'science') continue;
    out.push({
      id: `tip.goal.${g.role}`,
      tMin: null,
      kind: 'tip',
      title: `Role goal missed: ${g.label.toLowerCase()}`,
      why: `This flight: ${g.detail}.`,
      fix: GOAL_FIX[g.role].fix,
      owner: g.role,
      partIds: [],
      area: GOAL_FIX[g.role].area,
      impact: 30,
      top: false,
    });
  }
  const lostDecisions = SCORE_MAX.decisions - score.byCategory.decisions;
  if (score.notes.decisions?.startsWith('Try a trade study')) {
    out.push({
      id: 'tip.trade-study',
      tMin: null,
      kind: 'tip',
      title: 'Compare two designs',
      why: 'A trade study (build Option A and Option B, fly both, pick one) is how NASA teams choose a design, and it earns decision points.',
      fix: 'Use the trade study step before the point design.',
      owner: 'planner',
      partIds: [],
      area: 'mission',
      impact: Math.min(25, lostDecisions),
      top: false,
    });
  }
  const custLost = SCORE_MAX.customer - score.byCategory.customer;
  if (finished && score.notes.customer && custLost > 20 && !already.some((f) => f.area === 'ground')) {
    out.push({
      id: 'tip.customer',
      tMin: null,
      kind: 'tip',
      title: 'Get data to the customer faster',
      why: score.notes.customer,
      fix: 'More ground stations mean more passes and fresher data.',
      owner: 'flight',
      partIds: [],
      area: 'ground',
      impact: custLost,
      top: false,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Headline and comparison
// ---------------------------------------------------------------------------

/** Lower-cases only the first letter, so names like Earth keep their capital. */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function headline(sim: SimResult, score: ScoreResult, scenario: Scenario, periodMin: number, findings: Finding[]): string {
  const first = findings.find((f) => f.kind === 'bad');
  switch (sim.outcome) {
    case 'launch-failure':
      return `Launch failed: ${lowerFirst(first?.title ?? 'the design can’t fly')}.`;
    case 'failure':
    case 'partial': {
      if (sim.summary.diedAtMin !== null) return `Mission lost ${when(sim.summary.diedAtMin, periodMin)}: ${lowerFirst(first?.title ?? 'the craft died')}.`;
      if (sim.summary.reenteredAtMin !== null) return `The craft burned up after ${years(sim.summary.reenteredAtMin / MIN_PER_YEAR)}, before the ${scenario.lifetimeYears}-year mission was over.`;
      return `The craft survived, but only ${Math.round(sim.summary.deliveredPct)}% of its data reached ${scenario.customer.name.toLowerCase()}.`;
    }
    case 'success':
      return score.stars === 3
        ? `Mission success! ${scenario.customer.name} got their data, and every role met its goal.`
        : `Mission success! ${scenario.customer.name} got their data. ${findings.length ? 'There is still room to score more.' : ''}`.trim();
  }
}

function compare(score: ScoreResult, sim: SimResult, findings: Finding[], prev: PreviousFlight): ReportCompare {
  const byCategory = Object.fromEntries(
    (Object.keys(score.byCategory) as ScoreCategory[]).map((c) => [c, score.byCategory[c] - prev.score.byCategory[c]]),
  ) as Record<ScoreCategory, number>;
  const now = new Set(findings.map((f) => f.title));
  return {
    totalDelta: score.total - prev.score.total,
    starsDelta: score.stars - prev.score.stars,
    byCategory,
    survivedDeltaMin: sim.survivedMin - prev.sim.survivedMin,
    deliveredPctDelta: sim.summary.deliveredPct - prev.sim.summary.deliveredPct,
    fixedTitles: (prev.report?.findings ?? []).filter((f) => f.kind !== 'tip' && !now.has(f.title)).map((f) => f.title),
  };
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export function buildMissionReport(
  design: Design,
  scenario: Scenario,
  data: GameData,
  sim: SimResult,
  score: ScoreResult,
  previous?: PreviousFlight,
): MissionReport {
  const ev = evaluate(design, scenario, data);
  const flown = flightFindings(sim, ev);
  const replaced = (p: Problem) => flown.some((f) => f.replaces(p));

  // Design problems not already proven by the flight. Station-level comms
  // notes are folded into the bigger comms finding when there is one.
  const designFindings = ev.problems.filter((p) => !replaced(p)).map(fromProblem);
  const problemsAndFlight = [...flown.map((f) => f.finding), ...designFindings];
  const finished = sim.outcome !== 'launch-failure' && sim.summary.diedAtMin === null && sim.summary.reenteredAtMin === null;
  const findings = [...problemsAndFlight, ...tips(score, problemsAndFlight, finished)]
    .sort((a, b) => b.impact - a.impact || (a.tMin ?? Infinity) - (b.tMin ?? Infinity));
  findings.forEach((f, i) => (f.top = i < 3));

  const lines = (Object.keys(SCORE_MAX) as ScoreCategory[]).map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    points: score.byCategory[id],
    max: SCORE_MAX[id],
    ...(score.notes[id] ? { note: score.notes[id] } : {}),
  }));

  const s = sim.summary;
  const expectedMB = sim.survivedMin > 0 ? (s.madeMB / sim.survivedMin) * sim.missionMin : 0;
  const highlightPartIds = [...new Set(findings.flatMap((f) => f.partIds))];
  const periodMin = ev.orbit?.periodMin ?? 90;
  const report: MissionReport = {
    outcome: sim.outcome,
    total: score.total,
    stars: score.stars,
    headline: headline(sim, score, scenario, periodMin, findings),
    lines,
    findings,
    markers: [...sim.markers].sort((a, b) => a.tMin - b.tMin),
    roleGoals: score.roleGoals,
    customer: {
      name: scenario.customer.name,
      needsDataWithinHours: scenario.customer.needsDataWithinHours,
      expectedMB,
      deliveredMB: s.deliveredMB,
      deliveredPct: expectedMB > 0 ? Math.min(100, (s.deliveredMB / expectedMB) * 100) : 0,
      onTimePct: expectedMB > 0 ? Math.min(100, (s.onTimeMB / expectedMB) * 100) : 0,
      avgDelayHours: s.avgDelayHours,
    },
    firstLightMin: s.firstLightMin,
    survivedMin: sim.survivedMin,
    missionMin: sim.missionMin,
    highlightPartIds,
    compare: null,
  };
  if (previous) report.compare = compare(score, sim, findings, previous);
  return report;
}

/** "45 minutes" / "6 hours" / "12 days" / "2.6 years": for the report screen. */
export function formatDuration(min: number): string {
  if (min < 120) {
    const m = Math.max(1, Math.round(min));
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  if (min < 2 * 1440) return hours(min / 60);
  if (min < 60 * 1440) return `${Math.round(min / 1440)} days`;
  if (min < 2 * MIN_PER_YEAR) return `${Math.round(min / (MIN_PER_YEAR / 12))} months`;
  return years(min / MIN_PER_YEAR);
}
