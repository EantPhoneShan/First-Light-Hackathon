import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { submitScore } from '../functions/submit-score/resource';

/**
 * Data model. Each model becomes a DynamoDB table plus GraphQL queries,
 * mutations and subscriptions in AppSync.
 *
 *  Room     one row per team room            key: code
 *  Player   who is in the room, their roles  key: roomCode + playerId
 *  Section  one role's part of the design    key: roomCode + role
 *           (each role writes only its own row, so roles never overwrite each other)
 *  Score    leaderboard entries              index: scenario, sorted by score
 *           (read-only for players; only the submitScore Lambda writes, after replaying the flight)
 *
 *  Room, Player and Section rows carry `ttl`, and DynamoDB removes them by itself after that time,
 *  so finished rooms don't pile up. Score rows have no ttl and are kept.
 *
 *  submitScore  mutation -> Lambda: verifyScore() replays the flight and saves the server's score
 */
const schema = a.schema({
  Room: a
    .model({
      code: a.id().required(),
      scenario: a.string(),
      phase: a.string(),
      hostId: a.string(),
      seed: a.integer(),
      // Event answers for the current flight ({ eventId: choiceId }), so every device replays the same flight.
      choices: a.json(),
      // When DynamoDB may delete this row (epoch seconds). See "Automatic cleanup" in amplify/backend.ts.
      ttl: a.integer(),
    })
    .identifier(['code'])
    .authorization((allow) => [allow.publicApiKey()]),

  Player: a
    .model({
      roomCode: a.id().required(),
      playerId: a.id().required(),
      name: a.string(),
      roles: a.string().array(),
      lastSeen: a.float(),
      ttl: a.integer(),
    })
    .identifier(['roomCode', 'playerId'])
    .authorization((allow) => [allow.publicApiKey()]),

  Section: a
    .model({
      roomCode: a.id().required(),
      role: a.string().required(),
      data: a.json(),
      version: a.integer(),
      dataVersion: a.integer(),
      updatedBy: a.string(),
      updatedAt: a.float(),
      approvedKey: a.string(),
      ttl: a.integer(),
    })
    .identifier(['roomCode', 'role'])
    .authorization((allow) => [allow.publicApiKey()]),

  Score: a
    .model({
      scenario: a.string().required(),
      score: a.integer().required(),
      teamName: a.string(),
      roomCode: a.string(),
      outcome: a.string(),
      stars: a.integer(),
    })
    .secondaryIndexes((index) => [index('scenario').sortKeys(['score']).queryField('topScores')])
    // Players can read the leaderboard but not write to it. Scores come only from submitScore.
    .authorization((allow) => [allow.publicApiKey().to(['read'])]),

  SubmittedScore: a.customType({
    id: a.id().required(),
    scenarioId: a.string().required(),
    score: a.integer().required(),
    stars: a.integer().required(),
    outcome: a.string().required(),
    teamName: a.string().required(),
  }),

  // The game sends what it built and chose (makeSubmission in src/engine/verify.ts), never a trusted score.
  submitScore: a
    .mutation()
    .arguments({
      scenarioId: a.string().required(),
      design: a.json().required(),
      seed: a.float().required(),
      choices: a.json(),
      claimedScore: a.float(),
      context: a.json(),
      teamName: a.string(),
      roomCode: a.string(),
    })
    .returns(a.ref('SubmittedScore'))
    .handler(a.handler.function(submitScore))
    .authorization((allow) => [allow.publicApiKey()]),
})
  // Lets the submitScore Lambda write Score rows with its own IAM role.
  .authorization((allow) => [allow.resource(submitScore)]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    // The longest AppSync allows. The year is counted from each deploy, so any deploy
    // (any push to main) gives the key another full year.
    apiKeyAuthorizationMode: { expiresInDays: 365 },
  },
});
