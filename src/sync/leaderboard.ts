/**
 * Leaderboard (Member 3). Scores go to the DynamoDB Score table when AWS is
 * configured, otherwise they are kept in this browser only.
 *
 *   import { submitScore, topScores } from './sync/leaderboard';
 *   await submitScore({ scenario: 'wildfire-watch', score: 742, teamName: 'Orbiters', outcome: 'success' });
 *   const top = await topScores('wildfire-watch'); // highest first
 */
import { sync } from './index';

export interface ScoreEntry {
  scenario: string;
  score: number; // 0–1000
  teamName: string;
  outcome: string; // e.g. 'success' | 'partial' | 'failed'
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
    roomCode: e.roomCode,
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
    models: { Score: { create: (x: unknown) => Promise<{ errors?: unknown[] }>; topScores: (...a: unknown[]) => Promise<{ data: ScoreEntry[] }> } };
  };
}

export async function submitScore(entry: ScoreEntry): Promise<void> {
  const e = clean(entry);
  const local = [...readLocal(), e].sort((a, b) => b.score - a.score).slice(0, 50);
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
  } catch {
    /* ignore */
  }
  try {
    const c = await awsClient();
    if (c) await c.models.Score.create({ scenario: e.scenario, score: e.score, teamName: e.teamName, outcome: e.outcome, roomCode: e.roomCode });
  } catch (err) {
    console.warn('[leaderboard] could not save online, kept locally', err);
  }
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
