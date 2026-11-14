/**
 * Scoring (task 1.7): 0 to 1000 points in the PRD's six categories, then 0 to 3 stars.
 *
 *   const result = simulate(design, scenario, gameData);
 *   const score = scoreMission(design, scenario, gameData, result, { teamSize, allApproved });
 *
 * Pure and deterministic, so the submitScore Lambda can re-run simulate() and
 * scoreMission() on the server and reject faked scores. The context fields are
 * things only the game client knows (approvals, trade study, event choices);
 * they are worth few points, so a faked context can't buy a high score.
 *
 * Failed missions still score for what they achieved (how long they survived,
 * how much data arrived), so every fix on a re-fly shows progress.
 */
import { evaluate, marginPct } from './rules';
import { allPartIds } from './design';
import { pct } from './why';
import type { Design, GameData, ResourceId, RoleGoal, Scenario, ScoreCategory, ScoreResult, SimResult } from './types';
import { SCORE_MAX } from './types';

/** Tuning knobs for balancing (task 1.15). */
export const SCORING = {
  /** Points needed for 1, 2 and 3 stars. */
  stars: [400, 650, 850] as const,
  /**
   * 3 stars also needs every role's private goal met (PRD: "make collaboration
   * necessary: no role can fix a failure on its own"). Set false to drop the rule.
   */
  threeStarsNeedAllGoals: true,
  /** Margins in this band count as sensible, not overbuilt. */
  goodMarginPct: { min: 10, max: 25 },
  /** At 100% spare, a resource scores this share (heavily overbuilt). */
  overbuiltFloor: 0.4,
  /** Resources judged for efficiency (storage and delta-v are left out: big spares there are normal). */
  efficiencyResources: ['mass', 'power', 'budget', 'comms', 'time'] as ResourceId[],
  /** Detail score with only one kind of science, as a share of two kinds. */
  oneKindShare: 0.8,
  /** Decision points: review quality, trade study, event choices. */
  decisions: { review: 75, tradeStudy: 25, events: 25, perFail: 25, perWarn: 10 },
  /** Collaboration points: each role goal, and everyone approving. */
  collaboration: { perGoal: 10, approved: 10 },
  /** PRD private role goals. */
  goals: { plannerReservePct: 10, engineerPowerMarginPct: 15, scienceKinds: 2, flightDownlinkPct: 90 },
};

/** Things only the client knows; all optional. */
export interface ScoreContext {
  /** Every role pressed Approve on the design that flew (solo counts as yes). */
  allApproved?: boolean;
  /** The team built and compared Option A and B (CML 3, F6). */
  tradeStudyUsed?: boolean;
  /** Override for testing only; normally the score reads sim.events itself. */
  eventChoices?: { good: number; total: number };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const MIN_PER_YEAR = 365.25 * 1440;

export function scoreMission(
  design: Design,
  scenario: Scenario,
  data: GameData,
  sim: SimResult,
  ctx: ScoreContext = {},
): ScoreResult {
  const ev = evaluate(design, scenario, data);
  const notes: ScoreResult['notes'] = {};
  const flew = sim.outcome !== 'launch-failure';
  const survived = flew ? clamp01(sim.survivedMin / sim.missionMin) : 0;
  const s = sim.summary;

  // --- Science: which kinds of measurement the craft covers, and how good ------
  const onboard = new Set(allPartIds(design));
  const measurements = scenario.goals.flatMap((g) => g.measurements);
  const covered = measurements.filter((m) => m.instrumentIds.some((id) => onboard.has(id)));
  const kinds = covered.length;
  const bestValue = Math.max(
    0,
    ...data.parts.filter((p) => p.category === 'instrument' && onboard.has(p.id) && ev.compat.instruments[p.id]?.ok).map((p) => p.scienceValue ?? 0),
  );
  const quality = (bestValue / 100) * (kinds >= SCORING.goals.scienceKinds ? 1 : SCORING.oneKindShare);

  // --- Objective (350), weighted by the CML 2 sliders ----------------------------
  const orbit = data.orbits.find((o) => o.id === design.flight.orbitId);
  const revisitOk = orbit ? (orbit.revisitDays <= scenario.revisitDays ? 1 : scenario.revisitDays / orbit.revisitDays) : 0;
  const coverage = revisitOk * (s.deliveredPct / 100) * survived;
  const detail = quality * survived;
  const lifetime = survived;
  const w = design.planner.weights;
  const wSum = w.coverage + w.detail + w.lifetime;
  const objectiveShare = wSum > 0 ? (w.coverage * coverage + w.detail * detail + w.lifetime * lifetime) / wSum : (coverage + detail + lifetime) / 3;
  const objective = SCORE_MAX.objective * objectiveShare;
  if (objectiveShare < 0.9) {
    notes.objective = !flew
      ? 'The craft never reached orbit.'
      : survived < 1
        ? `The craft only lasted ${pct(survived * 100)} of the mission.`
        : revisitOk < 1
          ? 'The orbit did not revisit the area often enough.'
          : kinds < SCORING.goals.scienceKinds
            ? 'Only one kind of science; a second kind would score more.'
            : 'Some data never reached Earth.';
  }

  // --- Customer value (200): data on time, and how fresh ----------------------------
  const fullMissionMB = sim.missionMin > 0 ? (s.madeMB / Math.max(1, sim.survivedMin)) * sim.missionMin : 0;
  const onTimeShare = fullMissionMB > 0 ? clamp01(s.onTimeMB / fullMissionMB) : 0;
  const deadlineH = scenario.customer.needsDataWithinHours;
  const freshness = 1 - clamp01(s.avgDelayHours / deadlineH);
  const customer = SCORE_MAX.customer * onTimeShare * (0.5 + 0.5 * freshness);
  if (customer < SCORE_MAX.customer * 0.9) {
    notes.customer =
      onTimeShare < 0.9
        ? `${scenario.customer.name} got only ${pct(onTimeShare * 100)} of the data they needed, on time.`
        : `Data took ${s.avgDelayHours.toFixed(1)} hours on average to reach ${scenario.customer.name.toLowerCase()}.`;
  }

  // --- Resource efficiency (150): sensible margins, no overbuilding -------------------
  const effScores = SCORING.efficiencyResources.map((r) => marginScore(ev.gauges[r].marginPct));
  // A design only earns efficiency points for as long as it actually worked.
  const effShare = (effScores.reduce((a, b) => a + b, 0) / effScores.length) * survived;
  const efficiency = SCORE_MAX.efficiency * effShare;
  if (effShare < 0.9 && flew) {
    const worst = SCORING.efficiencyResources[effScores.indexOf(Math.min(...effScores))];
    const g = ev.gauges[worst];
    notes.efficiency =
      survived < 1
        ? 'Efficiency only counts while the craft is working.'
        : g.marginPct < 0
          ? `${g.label} is over its limit.`
          : g.marginPct < SCORING.goodMarginPct.min
            ? `${g.label} margin is too thin (${pct(g.marginPct)}).`
            : `${g.label} is overbuilt (${pct(g.marginPct)} spare): something cheaper or lighter would do.`;
  }

  // --- Lifetime, schedule, end of mission (125) --------------------------------------
  const onSchedule = flew && ev.totals.buildMonths <= scenario.launchInMonths ? 1 : 0;
  const disposalOk = s.disposal === 'ok' ? 1 : 0;
  const lifePts = 25 * onSchedule + 75 * survived + 25 * disposalOk;
  if (lifePts < SCORE_MAX.lifetime) {
    notes.lifetime = !flew
      ? 'The craft never reached orbit.'
      : !onSchedule
        ? 'The craft was not ready by launch day.'
      : survived < 1
        ? `The mission ended early, after ${(sim.survivedMin / MIN_PER_YEAR).toFixed(1)} of ${scenario.lifetimeYears} years.`
        : 'The end-of-mission plan leaves the craft as space debris.';
  }

  // --- Decision quality (125) -------------------------------------------------------
  const D = SCORING.decisions;
  const fails = ev.problems.filter((p) => p.status === 'fail').length;
  const warns = ev.problems.filter((p) => p.status === 'warn').length;
  const review = Math.max(0, D.review - D.perFail * fails - D.perWarn * warns);
  const trade = ctx.tradeStudyUsed ? D.tradeStudy : 0;
  // Event points only come from real event choices, never for free. The flight
  // records them itself, so the Lambda can check them by replaying it.
  const choiceStats = ctx.eventChoices ?? { good: sim.events.filter((e) => e.good).length, total: sim.events.length };
  const events = choiceStats.total > 0 ? D.events * clamp01(choiceStats.good / choiceStats.total) : 0;
  const decisions = review + trade + events;
  if (decisions < SCORE_MAX.decisions) {
    const open = [fails ? `${fails} red` : '', warns ? `${warns} amber` : ''].filter(Boolean).join(' and ');
    notes.decisions =
      fails + warns > 0
        ? `Launched with ${open} warning${fails + warns === 1 ? '' : 's'} still open.`
        : !ctx.tradeStudyUsed
          ? 'Try a trade study: compare two designs before choosing.'
          : events === 0
            ? 'Good choices during random events earn the last points.'
            : 'Some event choices could have been better.';
  }

  // --- Collaboration (50): every role's private goal, and agreement ---------------------
  const G = SCORING.goals;
  const reserve = marginPct(ev.totals.costTotalM, scenario.budgetM);
  const powerMargin = ev.gauges.power.marginPct;
  // "Finish with" and "keep" only count if the mission actually finished.
  const finished = flew && survived >= 1;
  const roleGoals: RoleGoal[] = [
    { role: 'planner', label: `Finish with a ${G.plannerReservePct}% budget reserve`, met: finished && reserve >= G.plannerReservePct, detail: `${pct(reserve)} of the budget left` },
    { role: 'engineer', label: `Keep a ${G.engineerPowerMarginPct}% power margin`, met: finished && powerMargin >= G.engineerPowerMarginPct, detail: `${pct(powerMargin)} power to spare` },
    { role: 'science', label: `Return ${G.scienceKinds} kinds of science`, met: flew && kinds >= G.scienceKinds && s.deliveredMB > 0, detail: `${kinds} kind${kinds === 1 ? '' : 's'}: ${covered.map((m) => m.name.toLowerCase()).join(', ') || 'none'}` },
    { role: 'flight', label: `Downlink ${G.flightDownlinkPct}% of the data`, met: flew && s.deliveredPct >= G.flightDownlinkPct, detail: `${pct(s.deliveredPct)} delivered` },
  ];
  const C = SCORING.collaboration;
  const approved = ctx.allApproved ?? true;
  const collaboration = Math.min(SCORE_MAX.collaboration, C.perGoal * roleGoals.filter((g) => g.met).length + (approved ? C.approved : 0));
  const missed = roleGoals.filter((g) => !g.met);
  if (missed.length > 0) notes.collaboration = `Missed: ${missed.map((g) => g.label.toLowerCase()).join('; ')}.`;
  else if (!approved) notes.collaboration = 'Not every role approved the design.';

  const byCategory: Record<ScoreCategory, number> = {
    objective: Math.round(objective),
    customer: Math.round(customer),
    efficiency: Math.round(efficiency),
    lifetime: Math.round(Math.min(SCORE_MAX.lifetime, lifePts)),
    decisions: Math.round(Math.min(SCORE_MAX.decisions, decisions)),
    collaboration: Math.round(collaboration),
  };
  const total = Math.min(1000, Object.values(byCategory).reduce((a, b) => a + b, 0));
  const allGoals = roleGoals.every((g) => g.met);
  const stars = starsFor(total, allGoals);
  if (stars < starsFor(total, true)) {
    notes.collaboration = `${notes.collaboration ?? ''} 3 stars needs every role's goal met.`.trim();
  }
  return { total, stars, byCategory, notes, roleGoals };
}

export function starsFor(total: number, allGoalsMet = true): 0 | 1 | 2 | 3 {
  const [one, two, three] = SCORING.stars;
  if (total >= three && (allGoalsMet || !SCORING.threeStarsNeedAllGoals)) return 3;
  return total >= two ? 2 : total >= one ? 1 : 0;
}

/** 1 inside the sensible band; less when too thin or overbuilt; 0 when over the limit. */
function marginScore(m: number): number {
  const { min, max } = SCORING.goodMarginPct;
  if (m < 0) return 0;
  if (m < min) return m / min;
  if (m <= max) return 1;
  const over = Math.min(1, (m - max) / (100 - max));
  return 1 - (1 - SCORING.overbuiltFloor) * over;
}
