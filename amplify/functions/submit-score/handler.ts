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

/** Same rule as the leaderboard: letters, numbers, spaces, _ . - only, 24 characters. */
function cleanName(value: unknown): string {
  const name = String(value ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 24);
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
  const { data, errors } = await client.models.Score.create({
    scenario: v.scenarioId,
    score: v.score,
    stars: v.stars,
    outcome: v.outcome,
    teamName: cleanName(args.teamName),
    roomCode,
  });
  if (errors?.length || !data) {
    console.error('[submit-score] save failed', errors);
    throw new Error('The score was checked but could not be saved. Please try again.');
  }

  return { id: data.id, scenarioId: v.scenarioId, score: v.score, stars: v.stars, outcome: v.outcome, teamName: data.teamName ?? 'Anonymous' };
};
