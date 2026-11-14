/**
 * Score check for the leaderboard (task 1.11, for Member 3's submitScore Lambda, 3.8).
 *
 * The client never sends a score the server just trusts. It sends what it
 * built and chose; the server replays the whole flight with the same engine
 * and stores the score IT computes. Same design + seed + choices = the same
 * flight on every machine, so an honest client always matches.
 *
 *   // amplify/functions/submit-score/handler.ts (Member 3)
 *   import { verifyScore } from '../../../src/engine/verify';
 *   import { gameData } from '../../../src/engine/data';
 *   const v = verifyScore(event.arguments, gameData);
 *   if (!v.ok) throw new Error(v.reasons.join(' '));
 *   // write { scenario: v.scenarioId, score: v.score, stars: v.stars, outcome: v.outcome, ... }
 *
 *   // In the game, after a flight (Member 2 / 3):
 *   const submission = makeSubmission(scenario.id, design, sim, { allApproved });
 */
import { normalizeDesign } from './design';
import { scoreMission, type ScoreContext } from './score';
import { choicesOf, simulate } from './simulate';
import type { Design, GameData, Outcome, SimResult } from './types';

/** What the game sends to the Lambda. Plain JSON. */
export interface ScoreSubmission {
  scenarioId: string;
  /** The four role sections (the store's design, or mergedDesign(room)). */
  design: unknown;
  /** room.seed (or the solo seed) the flight used. */
  seed: number;
  /** Event choices from the flight: choicesOf(sim). */
  choices: Record<string, string>;
  /** What the client says it scored; checked, never stored. */
  claimedScore?: number;
  /**
   * Client-only facts worth a few points (approvals, trade study), plus
   * eventsOff for tutorial or practice flights (makeSubmission sets it).
   * The Lambda forwards this object as-is.
   */
  context?: Pick<ScoreContext, 'allApproved' | 'tradeStudyUsed'> & { eventsOff?: boolean };
}

export interface VerifiedScore {
  /** False if the submission is malformed or the claimed score doesn't match the replay. */
  ok: boolean;
  /** Why not, in plain sentences (for logs and the error message). */
  reasons: string[];
  scenarioId: string;
  /** The score the SERVER computed. Store this one. */
  score: number;
  stars: 0 | 1 | 2 | 3;
  outcome: Outcome | 'invalid';
}

/** Limits that stop oversized or hostile payloads before any work is done. */
export const VERIFY_LIMITS = {
  maxDesignChars: 20_000,
  maxChoices: 10,
  /** Allowed gap between the claimed and replayed score (rounding). */
  scoreTolerance: 1,
};

/** Builds the submission for a finished flight (client side). */
export function makeSubmission(scenarioId: string, design: Design, sim: SimResult, context?: ScoreSubmission['context'], claimedScore?: number): ScoreSubmission {
  // A flight with events off (the tutorial) can't be replayed as a normal flight:
  // say so, so the server refuses it clearly instead of scoring a different mission.
  const ctx = sim.eventsEnabled === false ? { ...context, eventsOff: true } : context;
  return { scenarioId, design, seed: sim.seed, choices: choicesOf(sim), context: ctx, claimedScore };
}

/** Replays the flight and scores it on the server. Pure: no network, no clock. */
export function verifyScore(sub: unknown, data: GameData): VerifiedScore {
  const reasons: string[] = [];
  const bad = (scenarioId = ''): VerifiedScore => ({ ok: false, reasons, scenarioId, score: 0, stars: 0, outcome: 'invalid' });

  if (!sub || typeof sub !== 'object') {
    reasons.push('The submission is empty.');
    return bad();
  }
  const s = sub as Partial<ScoreSubmission>;

  const scenario = data.scenarios.find((x) => x.id === s.scenarioId);
  if (!scenario) {
    reasons.push(`Unknown scenario "${String(s.scenarioId)}".`);
    return bad();
  }

  let designText = '';
  try {
    designText = JSON.stringify(s.design ?? null);
  } catch {
    reasons.push('The design could not be read.');
    return bad(scenario.id);
  }
  if (designText.length > VERIFY_LIMITS.maxDesignChars) {
    reasons.push('The design is too large.');
    return bad(scenario.id);
  }

  if (s.context?.eventsOff === true) {
    reasons.push('Tutorial and practice flights (random events off) don’t go on the leaderboard.');
    return bad(scenario.id);
  }

  if (typeof s.seed !== 'number' || !Number.isInteger(s.seed) || s.seed < 0 || s.seed > 0xffffffff) {
    reasons.push('The seed must be a whole number from 0 to 4294967295.');
    return bad(scenario.id);
  }

  const choices: Record<string, string> = {};
  const raw = s.choices && typeof s.choices === 'object' ? (s.choices as Record<string, unknown>) : {};
  const entries = Object.entries(raw);
  if (entries.length > VERIFY_LIMITS.maxChoices) {
    reasons.push('Too many event choices.');
    return bad(scenario.id);
  }
  for (const [eventId, choiceId] of entries) {
    const ev = data.events.find((e) => e.id === eventId);
    if (!ev || typeof choiceId !== 'string' || !ev.choices.some((c) => c.id === choiceId)) {
      reasons.push(`Unknown event choice "${eventId}: ${String(choiceId)}".`);
      return bad(scenario.id);
    }
    choices[eventId] = choiceId;
  }

  // Replay: same design + seed + choices = the same flight as on the player's screen.
  const design = normalizeDesign(s.design as never);
  const sim = simulate(design, scenario, data, { seed: s.seed, choices });
  const ctx: ScoreContext = {
    allApproved: s.context?.allApproved === true,
    tradeStudyUsed: s.context?.tradeStudyUsed === true,
    // eventChoices is never taken from the client: the replay records them.
  };
  const score = scoreMission(design, scenario, data, sim, ctx);

  if (typeof s.claimedScore === 'number' && Math.abs(s.claimedScore - score.total) > VERIFY_LIMITS.scoreTolerance) {
    reasons.push(`The claimed score (${s.claimedScore}) does not match the replayed flight (${score.total}).`);
  }
  return { ok: reasons.length === 0, reasons, scenarioId: scenario.id, score: score.total, stars: score.stars, outcome: sim.outcome };
}
