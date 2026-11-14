# First Light

A cooperative space mission design game for 1 to 4 players. Build a spacecraft, pick its orbit and rocket, watch the mission fly, and learn why it worked or failed. NASA Space Apps 2026, "Space Mission Design Game" challenge.

**Play:** _live link coming soon_

## Run locally

```bash
npm install
npm run dev
```

Works fully offline (solo, and team mode across browser tabs).

## Team mode / cloud

- Sync API for game code: [docs/SYNC.md](docs/SYNC.md)
- Backend: AWS Amplify Gen 2 in `amplify/`: AppSync (GraphQL + real-time subscriptions) on DynamoDB, API-key auth so players join without accounts.
- Hosting: AWS Amplify Hosting builds and deploys backend + frontend on every push to `main` (`amplify.yml`).
- Fallback: set `VITE_SYNC=firebase` and the `VITE_FIREBASE_*` vars (see `.env.example`) to use Firebase Realtime Database instead. If no cloud is reachable the game plays solo.

```
Browser (React + Vite) ──GraphQL / WebSocket──> AWS AppSync ──> DynamoDB (Room, Player, Section, Score)
        └── hosted on AWS Amplify Hosting (CI/CD from GitHub)
```

## Project layout

| Path | Owner | What |
|---|---|---|
| `src/sync/` | Member 3 | Multiplayer sync (only import `src/sync/index.ts`) |
| `amplify/` | Member 3 | AWS backend definition |
| `src/` (rest) | Members 1 & 2 | Game logic and screens |
