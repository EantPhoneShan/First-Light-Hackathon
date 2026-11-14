# Game engine guide (Member 1)

Everything in `src/engine/` is plain TypeScript: no UI, no network, no clock. The same input always gives the same output, on every device and in the score Lambda. Numbers come from `src/data/*.json`; every entry names its NASA source (`source`, `sourceNote`).

Run the tests with `npm test` (Vitest, about 3 seconds).

## The loop in one screen

```ts
import { gameData, findScenario } from '@/engine/data';
import { normalizeDesign } from '@/engine/design';
import { evaluate } from '@/engine/rules';
import { simulate } from '@/engine/simulate';
import { scoreMission } from '@/engine/score';
import { buildMissionReport } from '@/engine/report';

const scenario = findScenario(gameData, 'wildfire-watch')!;
const design = normalizeDesign(mergedDesign(room));        // the 4 synced role sections

const ev = evaluate(design, scenario, gameData);            // gauges, problems, greyed-out choices
const sim = simulate(design, scenario, gameData, { seed: room.seed, choices });
const score = scoreMission(design, scenario, gameData, sim, { allApproved });
const report = buildMissionReport(design, scenario, gameData, sim, score, lastFlight);
```

## Files

| File | What it gives you | Main calls |
|---|---|---|
| `types.ts` | The shared contract: `Design` (4 role sections), data types, results | `RESOURCE_OWNER` (who fixes), `RESOURCE_WATCHER` (who sees the gauge) |
| `data.ts` | All data files as one `gameData`, lookups, start-up checks | `gameData`, `findPart/findScenario/...`, `dataProblems` |
| `design.ts` | Safe reading of synced sections | `normalizeDesign(raw)`, `emptyDesign()`, `allPartIds(d)` |
| `rules.ts` | Live checks for the workbench and review (F7, F8, F12) | `evaluate(design, scenario, data)` → `gauges`, `problems` (each with `why`, `hint`, `owner`, `partIds`, `blocking`), `compat` (greyed out + reason), `ready`, `canLaunch` |
| `simulate.ts` | The flight (F13, F14, F15) | Live: `createSim` → `initialState` → `stepSim(state, setup, minutes)`; event card: `pendingEventCard`, `chooseEvent`; finish: `finishSim`. Whole flight: `simulate(design, scenario, data, { seed, choices })`. Replay a flight: `choicesOf(sim)` |
| `events.ts` | Random events from the room seed | `scheduleEvents`, `EVENTS` (tuning) |
| `score.ts` | 0 to 1000, stars, role goals | `scoreMission(...)`, `starsFor`, `SCORING` (tuning) |
| `report.ts` | The report screen (F16, F18) | `buildMissionReport(...)` → headline, `lines`, `findings` (top 3 marked), `markers`, `customer`, `compare` with last flight, `highlightPartIds` |
| `alerts.ts` | Conflict alerts (F11) | `conflictAlerts(before, after, scenario, data, { byRole, byName })` → message, `hurtRole` (the gauge watcher), `fixes` |
| `flow.ts` | Team flow: one shared step, role edit rights | `STEPS`, `canEditSection(step, myRoles, section)`, `canLead`, `canAdvance(step, facts)`, `backStep`, `canChooseEvent`, `toSyncPhase` |
| `verify.ts` | Score check for the Lambda (3.8) | Client: `makeSubmission(...)`. Lambda: `verifyScore(submission, gameData)` → store `score` |
| `trade.ts` | Trade study, CML 3 (F6) | `compareDesigns(a, b, scenario, data, { seed })` → `rows`, `recommendation`, `why` |
| `share.ts` | Save and share codes (F19) | `encodeDesign(scenarioId, design)`, `decodeDesign(code, data)`, `sameDesign` |
| `risk.ts` | Mission risk % (P1) | `missionRisk(design, scenario, data)` → `riskPct`, `oneIn` ("1 in 5"), `biggest.why` |
| `match.ts` | "Your design is most like…" (F17) | `closestMission(design, data)` → mission, `reasons`, NASA `url`; `otherWinningBuilds(...)` (about 1 s, run once per report) |
| `orbit.ts`, `why.ts`, `schema.ts` | Orbit maths, sentence templates, data schemas | Internal |

## Rules worth knowing

- **Red can still fly.** Only `blocking` problems stop the Launch button (`ev.canLaunch`). Everything else flies and fails in the simulation: players learn by failing (F12).
- **Live playback = replay.** `stepSim` only takes whole 1-minute steps and carries the rest, so any playback speed gives exactly the flight `simulate()` gives. Same `seed` + same `choices` = same flight everywhere.
- **Events pause the flight.** While `state.pendingEvent` is set, `stepSim` does nothing. Show `pendingEventCard()` to the event's owner (`canChooseEvent`), then call `chooseEvent()`. In a team, send the choice through sync and replay it on every device.
- **Never trust a client score.** The Lambda replays with `verifyScore`; event points come only from the replay.
- **Tuning lives in one place:** `RULES` (rules.ts), `SCORING` (score.ts), `EVENTS` (events.ts), `SIM` (simulate.ts) and the JSON files.
- **Switches for unfinished screens:** `SCORING.tradeStudyAvailable = false` until the CML 3 screen exists; then score the chosen option with `{ tradeStudyUsed: true }`.

## Adding content

- **A part, rocket, orbit or station:** add it to the JSON with a `tooltip`, a `source` and a `sourceNote`. `npm test` fails if a key is misspelled, a number is impossible or an id points at nothing.
- **A scenario:** add it to `scenarios.json` (goals → measurements → instrument ids), then add a winning build and a failing build to the tests.
- **A real mission:** add it to `missions.json` only after checking the facts on a NASA page, and say what you checked in `checked`.
