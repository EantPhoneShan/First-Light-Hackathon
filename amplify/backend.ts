import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';
import { submitScore } from './functions/submit-score/resource';

/**
 * First Light backend (AWS Amplify Gen 2).
 *  - AppSync GraphQL API with real-time subscriptions (live team sync)
 *  - DynamoDB tables for Room, Player, Section and Score (one table per model)
 *  - submitScore Lambda: replays a flight on the server and saves the verified score
 *  - Time to Live on Room, Player and Section, so old rooms are deleted automatically
 * Auth is an API key, so players join without accounts.
 */
const backend = defineBackend({ data, submitScore });

// Automatic cleanup: DynamoDB deletes a row once the time in its `ttl` field has passed
// (Time to Live). The game sets ttl on every write (src/sync/adapters/aws.ts), so a room goes
// about a day after it was last used. The Score table has no ttl: the leaderboard is kept.
const { amplifyDynamoDbTables } = backend.data.resources.cfnResources;
for (const model of ['Room', 'Player', 'Section']) {
  amplifyDynamoDbTables[model].timeToLiveAttribute = { attributeName: 'ttl', enabled: true };
}
