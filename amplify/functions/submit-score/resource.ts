import { defineFunction } from '@aws-amplify/backend';

/**
 * submitScore Lambda (task 3.8). Replays a finished flight with Member 1's engine
 * (verifyScore) and saves the score the server computes, never the client's number.
 * Grouped with the data stack because it is both a resolver and a data client.
 */
export const submitScore = defineFunction({
  name: 'submit-score',
  entry: './handler.ts',
  timeoutSeconds: 15,
  memoryMB: 512,
  resourceGroupName: 'data',
});
