/**
 * Trade study (PRD F6, CML 3): the team builds Option A and Option B, flies
 * both quickly, compares them side by side and picks one.
 *
 *   const study = compareDesigns(optionA, optionB, scenario, gameData, { seed: room.seed });
 *   study.rows             // one line per measure, with the better option marked
 *   study.recommendation   // 'a' | 'b' | 'tie'
 *   study.why              // "Option B scores 120 more: it returns 2 kinds of science."
 *
 * When the team picks one, score that flight with { tradeStudyUsed: true }, and
 * set SCORING.tradeStudyAvailable = true once the screen exists.
 */
import { evaluate } from './rules';
import { missionRisk } from './risk';
import { scoreMission } from './score';
import { simulate } from './simulate';
import type { Design, GameData, Scenario, ScoreResult, SimResult } from './types';
import { fmt, money } from './why';

export type Side = 'a' | 'b' | 'tie';

export interface TradeOption {
  design: Design;
  sim: SimResult;
  score: ScoreResult;
  riskPct: number;
  costM: number;
}

export interface TradeRow {
  id: string;
  label: string;
  a: string;
  b: string;
  /** Which option is better on this measure. */
  better: Side;
}

export interface TradeStudy {
  a: TradeOption;
  b: TradeOption;
  rows: TradeRow[];
  recommendation: Side;
  /** One plain sentence explaining the pick. */
  why: string;
}

export interface TradeOptions {
  seed?: number;
  /** Score differences up to this count as a tie (then the cheaper option wins). */
  tieWithin?: number;
}

const MIN_PER_YEAR = 365.25 * 1440;

function option(design: Design, scenario: Scenario, data: GameData, seed: number | undefined): TradeOption {
  // Both options meet the same events, and the first choice is taken for each,
  // so the comparison is about the designs, not luck.
  const sim = simulate(design, scenario, data, { seed });
  const score = scoreMission(design, scenario, data, sim, { tradeStudyUsed: true });
  const ev = evaluate(design, scenario, data);
  return { design, sim, score, riskPct: missionRisk(design, scenario, data).riskPct, costM: ev.totals.costTotalM };
}

/** Higher is better unless `lowerIsBetter`. Equal (within eps) = tie. */
function compare(a: number, b: number, lowerIsBetter = false, eps = 1e-6): Side {
  if (Math.abs(a - b) <= eps) return 'tie';
  return (a > b) !== lowerIsBetter ? 'a' : 'b';
}

export function compareDesigns(a: Design, b: Design, scenario: Scenario, data: GameData, opts: TradeOptions = {}): TradeStudy {
  const A = option(a, scenario, data, opts.seed);
  const B = option(b, scenario, data, opts.seed);
  const evA = evaluate(a, scenario, data);
  const evB = evaluate(b, scenario, data);
  const kinds = (o: TradeOption) => o.score.roleGoals.find((g) => g.role === 'science')?.detail ?? '';
  const goalsMet = (o: TradeOption) => o.score.roleGoals.filter((g) => g.met).length;
  const years = (o: TradeOption) => o.sim.survivedMin / MIN_PER_YEAR;

  const rows: TradeRow[] = [
    { id: 'score', label: 'Score', a: `${A.score.total} (${A.score.stars}★)`, b: `${B.score.total} (${B.score.stars}★)`, better: compare(A.score.total, B.score.total) },
    { id: 'outcome', label: 'Result', a: A.sim.outcome, b: B.sim.outcome, better: compare(rank(A.sim.outcome), rank(B.sim.outcome)) },
    { id: 'lifetime', label: 'Years in orbit', a: fmt(years(A)), b: fmt(years(B)), better: compare(years(A), years(B), false, 0.01) },
    { id: 'delivered', label: 'Data delivered', a: `${Math.round(A.sim.summary.deliveredPct)}%`, b: `${Math.round(B.sim.summary.deliveredPct)}%`, better: compare(Math.round(A.sim.summary.deliveredPct), Math.round(B.sim.summary.deliveredPct)) },
    { id: 'delay', label: 'Data delay', a: `${fmt(A.sim.summary.avgDelayHours)} h`, b: `${fmt(B.sim.summary.avgDelayHours)} h`, better: compare(A.sim.summary.avgDelayHours, B.sim.summary.avgDelayHours, true, 0.05) },
    { id: 'science', label: 'Science', a: kinds(A), b: kinds(B), better: compare(A.score.byCategory.objective, B.score.byCategory.objective, false, 0.5) },
    { id: 'cost', label: 'Total cost', a: money(A.costM), b: money(B.costM), better: compare(A.costM, B.costM, true, 0.005) },
    { id: 'power', label: 'Spare power', a: `${Math.round(evA.gauges.power.marginPct)}%`, b: `${Math.round(evB.gauges.power.marginPct)}%`, better: compare(evA.gauges.power.marginPct, evB.gauges.power.marginPct, false, 0.5) },
    { id: 'mass', label: 'Mass', a: `${fmt(evA.totals.massKg)} kg`, b: `${fmt(evB.totals.massKg)} kg`, better: compare(evA.totals.massKg, evB.totals.massKg, true, 0.05) },
    { id: 'risk', label: 'Mission risk', a: `${Math.round(A.riskPct)}%`, b: `${Math.round(B.riskPct)}%`, better: compare(A.riskPct, B.riskPct, true, 0.5) },
    { id: 'goals', label: 'Role goals met', a: `${goalsMet(A)} of 4`, b: `${goalsMet(B)} of 4`, better: compare(goalsMet(A), goalsMet(B)) },
  ];

  const tieWithin = opts.tieWithin ?? 10;
  const diff = A.score.total - B.score.total;
  let recommendation: Side;
  let why: string;
  if (Math.abs(diff) > tieWithin) {
    recommendation = diff > 0 ? 'a' : 'b';
    const win = recommendation === 'a' ? A : B;
    const lose = recommendation === 'a' ? B : A;
    why = `Option ${recommendation.toUpperCase()} scores ${Math.abs(diff)} more: ${reasonFor(win, lose)}.`;
  } else if (Math.abs(A.costM - B.costM) > 0.005) {
    recommendation = A.costM < B.costM ? 'a' : 'b';
    why = `The scores are close, so the cheaper one wins: Option ${recommendation.toUpperCase()} saves ${money(Math.abs(A.costM - B.costM))}.`;
  } else {
    recommendation = 'tie';
    why = 'Both options do about as well. There is rarely one perfect design: pick the one the team prefers.';
  }
  return { a: A, b: B, rows, recommendation, why };
}

const rank = (o: SimResult['outcome']) => ({ success: 3, partial: 2, failure: 1, 'launch-failure': 0 })[o];

/** The category where the winner gained most, in plain words. */
function reasonFor(win: TradeOption, lose: TradeOption): string {
  if (rank(win.sim.outcome) > rank(lose.sim.outcome)) return `it ${win.sim.outcome === 'success' ? 'completes the mission' : 'survives longer'}, the other does not`;
  const cats = Object.keys(win.score.byCategory) as (keyof ScoreResult['byCategory'])[];
  const best = cats.reduce((b, c) => (win.score.byCategory[c] - lose.score.byCategory[c] > win.score.byCategory[b] - lose.score.byCategory[b] ? c : b), cats[0]);
  const words: Record<typeof best, string> = {
    objective: 'it does more of the science objective',
    customer: 'it gets more data to the customer, faster',
    efficiency: 'it uses its resources more sensibly',
    lifetime: 'it lasts longer and ends its mission cleanly',
    decisions: 'it has fewer open warnings',
    collaboration: 'more roles meet their goals',
  };
  return words[best];
}
