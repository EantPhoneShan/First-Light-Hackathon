# Team sync: how to plug in (for Member 1 and Member 2)

All multiplayer goes through one import. You never call AWS or Firebase.

```ts
import { sync, mergedDesign, allApproved, isApproved, ROLES, ROLE_LABELS } from './sync';
```

## The data

A **Room** holds the whole shared state:

| Field | Meaning |
|---|---|
| `code` | Room code to share, e.g. `K7QF` (`SOLO` in single player) |
| `scenario` | e.g. `wildfire-watch` |
| `phase` | `lobby` · `design` · `launch` · `simulate` · `report` |
| `players` | `{ id, name, roles, lastSeen }[]` |
| `sections` | One **DesignSection** per role: `planner`, `science`, `engineer`, `flight` |
| `seed` | Shared random seed, so every device gets the same random events |

Each role owns one section and only that role can write it, so teammates never overwrite each other. `section.data` is a plain object in **Member 1's design format**; suggested split:

| Role | `data` it owns |
|---|---|
| `planner` (Mission Planner) | goals, budget cap |
| `science` (Science Lead) | instruments |
| `engineer` (Spacecraft Engineer) | bus, power, battery, comms |
| `flight` (Flight Dynamics) | orbit, launch vehicle |

Only the Design syncs. Gauges, warnings, simulation and score are computed on each device from `mergedDesign(room)`, which returns `{ planner, science, engineer, flight }`.

## Calls

| Call | What it does |
|---|---|
| `await sync.resume()` | On app start: rejoins the room after a page refresh |
| `sync.startSolo(scenario)` | Single player. All 4 roles, no network, autosaves to localStorage |
| `await sync.createRoom(name, scenario)` | Makes a team room, returns the code |
| `await sync.joinRoom(code, name)` | Joins; throws a readable error if the code is wrong |
| `await sync.chooseRoles(['science'])` | Claims roles; roles held by an online teammate are refused. Returns the roles you got |
| `await sync.updateDesign(role, data)` | Replace that role's `data`. UI updates instantly, server in background. Clears all approvals |
| `await sync.setApproved(role, true/false)` | Approve / Hold |
| `await sync.setPhase('simulate')` | Moves everyone to a phase (call when `allApproved(room)`) |
| `sync.canEdit(role)` / `sync.getMyRoles()` | Grey out panels you don't own |
| `sync.getRoom()` | Current room snapshot |

## Listening

```ts
useEffect(() => {
  const offRoom   = sync.onRoomChange(setRoom);  // every local or remote change
  const offStatus = sync.onStatus(setStatus);    // 'solo' | 'connecting' | 'connected' | 'reconnecting' | 'offline'
  const offEvent  = sync.onEvent(showAlert);     // see below
  return () => { offRoom(); offStatus(); offEvent(); };
}, []);
```

Events from `onEvent`:

| `type` | When | Suggested UI |
|---|---|---|
| `remote-change` | A teammate changed their section (`role`, `byName`, `section`) | Run Member 1's "who is hurt" rule on old vs new design and show the conflict alert to the affected role |
| `approvals-reset` | A change cleared approvals | Small toast |
| `conflict` | The same role was edited on two devices at once; the latest version is already shown | "Someone else changed this, try again" |
| `player-joined` / `player-left` | | Toast |
| `error` | e.g. "Playing solo, team sync unavailable." | Banner |

Approvals: use `isApproved(room, role)` and `allApproved(room)`. Never read `approvedKey` directly; an approval stops counting as soon as anyone changes the design.

## Rules for Member 2

- Show the status dot from `onStatus` (grey solo, green connected, amber reconnecting, red offline).
- The game must work if team sync fails: on any thrown error, offer **Play solo**.
- `src/dev/SyncTestPanel.tsx` is a throwaway test screen. Replace `App.tsx`, but keep it reachable at `?synctest` for testing.

## Testing without the cloud

`npm run dev`, open two tabs, create a room in one and join with the code in the other. Each tab counts as its own player (local backend). With AWS deployed, use two phones.

## Leaderboard

```ts
import { submitScore, topScores } from './sync/leaderboard';
await submitScore({ scenario: 'wildfire-watch', score: 742, teamName: 'Orbiters', outcome: 'success' });
const top = await topScores('wildfire-watch'); // [{ teamName, score, outcome, ... }] highest first
```

Saves to DynamoDB when AWS is live, otherwise to this browser. Scores are clamped to 0–1000.
