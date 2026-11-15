import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/submit-score';
import type { Schema } from '../../data/resource';
import { verifyScore } from '../../../src/engine/verify';
import { gameData } from '../../../src/engine/data';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

/** AWSJSON arguments can arrive as text; the engine wants objects. */
function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** Same rule as the leaderboard: letters, numbers, spaces, _ . & - only, single spaces, 24 characters. */
function cleanName(value: unknown): string {
  const name = String(value ?? '').replace(/[^\p{L}\p{N} _.&-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return name || 'Anonymous';
}

export const handler: Schema['submitScore']['functionHandler'] = async (event) => {
  const args = event.arguments;
  const submission = {
    scenarioId: args.scenarioId,
    design: parseJson(args.design),
    seed: args.seed,
    choices: parseJson(args.choices) ?? {},
    claimedScore: args.claimedScore ?? undefined,
    context: parseJson(args.context) ?? undefined,
  };

  const v = verifyScore(submission, gameData);
  if (!v.ok) {
    console.warn('[submit-score] rejected', v.scenarioId, v.reasons);
    throw new Error(v.reasons.join(' '));
  }

  const roomCode = args.roomCode ? String(args.roomCode).replace(/[^A-Za-z0-9]/g, '').slice(0, 12) : undefined;

  // A team flight is one flight, however many teammates press "Add this flight".
  // Room + seed + scenario names it (every launch gets a new seed), so the first
  // save wins and everyone after that gets the same row back.
  const flightId = roomCode ? `room-${roomCode}-${v.scenarioId}-${submission.seed}` : undefined;
  if (flightId) {
    const existing = await client.models.Score.get({ id: flightId });
    if (existing.data) return saved(existing.data);
  }

  const { data, errors } = await client.models.Score.create({
    ...(flightId ? { id: flightId } : {}),
    scenario: v.scenarioId,
    score: v.score,
    stars: v.stars,
    outcome: v.outcome,
    teamName: cleanName(args.teamName),
    roomCode,
  });
  if (errors?.length || !data) {
    // Two teammates pressed at the same moment: the other save got there first.
    if (flightId) {
      const existing = await client.models.Score.get({ id: flightId });
      if (existing.data) return saved(existing.data);
    }
    console.error('[submit-score] save failed', errors);
    throw new Error('The score was checked but could not be saved. Please try again.');
  }

  return saved(data);
};

type ScoreRow = { id: string; scenario: string; score: number; stars?: number | null; outcome?: string | null; teamName?: string | null };

function saved(row: ScoreRow) {
  return { id: row.id, scenarioId: row.scenario, score: row.score, stars: row.stars ?? 0, outcome: row.outcome ?? '', teamName: row.teamName ?? 'Anonymous' };
}
