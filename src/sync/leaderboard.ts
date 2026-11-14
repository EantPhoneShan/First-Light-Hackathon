/**
 * Leaderboard (Member 3). Online, a flight is sent to the submitScore Lambda,
 * which replays it with verifyScore() and saves the score IT computes to the
 * DynamoDB Score table. Players can read that table but never write to it.
 * Without AWS, the same check runs in this browser and the score is kept here.
 *
 *   import { makeSubmission } from '../engine/verify';
 *   import { submitFlight, topScores } from './sync/leaderboard';
 *   const saved = await submitFlight(makeSubmission(scenario.id, design, sim, { allApproved }), { teamName: 'Orbiters' });
 *   const top = await topScores('wildfire-watch'); // highest first
 */
import { gameData } from '../engine/data';
import { verifyScore, type ScoreSubmission } from '../engine/verify';
import { sync } from './index';

export interface ScoreEntry {
  scenario: string;
  score: number; // 0–1000
  teamName: string;
  outcome: string; // e.g. 'success' | 'partial' | 'failed'
  stars?: number; // 0–3
  roomCode?: string;
  createdAt?: string;
}

const LOCAL_KEY = 'first-light:scores';

function clean(e: ScoreEntry): ScoreEntry {
  return {
    scenario: String(e.scenario).slice(0, 40),
    score: Math.max(0, Math.min(1000, Math.round(Number(e.score) || 0))),
    teamName: (String(e.teamName || 'Anonymous').replace(/[^\p{L}\p{N} _.-]/gu, '').trim() || 'Anonymous').slice(0, 24),
    outcome: String(e.outcome || '').slice(0, 20),
    stars: typeof e.stars === 'number' ? Math.max(0, Math.min(3, Math.round(e.stars))) : undefined,
    roomCode: e.roomCode ?? undefined,
    createdAt: e.createdAt ?? new Date().toISOString(),
  };
}

function readLocal(): ScoreEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}

async function awsClient() {
  if (sync.backend !== 'aws') {
    // Not connected to AWS yet in this tab: try loading it anyway.
    try {
      const { awsAdapter } = await import('./adapters/aws');
      awsAdapter();
    } catch {
      return null;
    }
  }
  const { generateClient } = await import('aws-amplify/data');
  return generateClient() as unknown as {
    models: { Score: { topScores: (...a: unknown[]) => Promise<{ data: ScoreEntry[] }> } };
    mutations: {
      submitScore: (x: unknown) => Promise<{ data?: { score: number; stars: number; outcome: string; scenarioId: string; teamName: string } | null; errors?: { message?: string }[] }>;
    };
  };
}

function saveLocal(e: ScoreEntry): void {
  const local = [...readLocal(), e].sort((a, b) => b.score - a.score).slice(0, 50);
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
  } catch {
    /* ignore */
  }
}

/** Thrown when the server (or the local check) refuses a flight. `reasons` are plain sentences. */
export class ScoreRejectedError extends Error {
  reasons: string[];
  constructor(reasons: string[]) {
    super(reasons.join(' ') || 'The score was rejected.');
    this.name = 'ScoreRejectedError';
    this.reasons = reasons;
  }
}

export interface SubmittedScore extends ScoreEntry {
  /** True when the score was checked and saved by the server, false when it was only kept in this browser. */
  online: boolean;
}

/**
 * Sends a finished flight to the leaderboard. Pass makeSubmission(...) from
 * src/engine/verify.ts. Returns the score the server computed (not the client's).
 * Throws ScoreRejectedError if the flight doesn't check out.
 */
export async function submitFlight(submission: ScoreSubmission, team: { teamName?: string; roomCode?: string } = {}): Promise<SubmittedScore> {
  let c: Awaited<ReturnType<typeof awsClient>> = null;
  try {
    c = await awsClient();
  } catch {
    c = null;
  }
  if (c?.mutations?.submitScore) {
    try {
      const res = await c.mutations.submitScore({
        scenarioId: submission.scenarioId,
        design: JSON.stringify(submission.design),
        seed: submission.seed,
        choices: JSON.stringify(submission.choices ?? {}),
        claimedScore: submission.claimedScore,
        context: submission.context ? JSON.stringify(submission.context) : undefined,
        teamName: team.teamName,
        roomCode: team.roomCode,
      });
      if (res.data) {
        const e = clean({ scenario: res.data.scenarioId, score: res.data.score, stars: res.data.stars, outcome: res.data.outcome, teamName: res.data.teamName, roomCode: team.roomCode });
        saveLocal(e);
        return { ...e, online: true };
      }
      // An error from the Lambda means the replay refused the flight: don't save it anywhere.
      if (res.errors?.length) throw new ScoreRejectedError(res.errors.map((x) => x.message ?? 'Unknown error'));
    } catch (err) {
      if (err instanceof ScoreRejectedError) throw err;
      console.warn('[leaderboard] could not reach the score server, checking locally', err);
    }
  }
  // Offline or local backend: run the same check here and keep the score in this browser.
  const v = verifyScore(submission, gameData);
  if (!v.ok) throw new ScoreRejectedError(v.reasons);
  const e = clean({ scenario: v.scenarioId, score: v.score, stars: v.stars, outcome: v.outcome, teamName: team.teamName ?? '', roomCode: team.roomCode });
  saveLocal(e);
  return { ...e, online: false };
}

/**
 * Keeps a score in this browser only. The online leaderboard takes scores only
 * from submitFlight(), because the server must replay the flight first.
 * @deprecated Use submitFlight(makeSubmission(...)).
 */
export async function submitScore(entry: ScoreEntry): Promise<void> {
  saveLocal(clean(entry));
}

export async function topScores(scenario: string, limit = 10): Promise<ScoreEntry[]> {
  try {
    const c = await awsClient();
    if (c) {
      const res = await c.models.Score.topScores({ scenario }, { sortDirection: 'DESC', limit });
      if (res.data?.length) return res.data.map(clean);
    }
  } catch (err) {
    console.warn('[leaderboard] online scores unavailable, showing local', err);
  }
  return readLocal()
    .filter((s) => s.scenario === scenario)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
