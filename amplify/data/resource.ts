import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Data model. Each model becomes a DynamoDB table plus GraphQL queries,
 * mutations and subscriptions in AppSync.
 *
 *  Room     one row per team room            key: code
 *  Player   who is in the room, their roles  key: roomCode + playerId
 *  Section  one role's part of the design    key: roomCode + role
 *           (each role writes only its own row, so roles never overwrite each other)
 *  Score    leaderboard entries              index: scenario, sorted by score
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
    })
    .secondaryIndexes((index) => [index('scenario').sortKeys(['score']).queryField('topScores')])
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    // Enough to cover the hackathon and judging. Max is 365.
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});
