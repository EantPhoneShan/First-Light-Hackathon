import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';
import { submitScore } from './functions/submit-score/resource';

/**
 * First Light backend (AWS Amplify Gen 2).
 *  - AppSync GraphQL API with real-time subscriptions (live team sync)
 *  - DynamoDB tables for Room, Player, Section and Score (one table per model)
 *  - submitScore Lambda: replays a flight on the server and saves the verified score
 * Auth is an API key, so players join without accounts.
 */
defineBackend({ data, submitScore });
