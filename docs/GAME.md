# Game UI (Member 2)

All the game screens: title, lobby, briefing (with science traceability), feasibility, workbench, design review, launch, simulation, report and re-fly, plus the tutorial, glossary, art and sound.

- Run: `npm install`, then `npm run dev`.
- Sync test panel (Member 3): open the app with `?synctest` in the URL.
- Art: built-in SVGs in `public/assets/svg/`. To swap in ChatGPT images, see `art/README.md` and run `npm run art`.

## Where the game logic lives

The screens run on **Member 1's engine** (`src/engine/`): `evaluate()` gives the gauges, the
problems with why sentences and hints, greyed-out choices with reasons, orbit numbers and totals.
The data is `src/data/*.json`. `useEvaluation()` in `src/store/game.ts` runs it for the current design.

Two stand-ins remain, until Member 1 writes `simulate.ts` and `score.ts` / `report.ts`:

| Stand-in | Replaced by Member 1's | Notes |
|---|---|---|
| `src/sim/standInSim.ts` | `simulate.ts` (returns `SimResult`) | No physics of its own: plays evaluate()'s numbers forward in time for the animation |
| `src/sim/standInReport.ts` | `score.ts`, `report.ts` | Findings are evaluate().problems; only the score arithmetic is ours (PRD weights) |

UI-only helpers live in `src/game/`: `ui.ts` (routing a part to its role section, labels, who watches each gauge)
and `checks.ts` (review checklist and conflict alerts, until Member 1's `alerts.ts`).

## Multiplayer hooks for Member 3

- Game state is one Zustand store: `src/store/game.ts`. `design` is Member 1's `Design` (four role sections), so it maps straight onto `mergedDesign(room)`. Also sync `players`, `myRole` and `approvals`.
- Every edit goes through `edit(role, recipe)`, which bumps `designVersion` and sets `updatedBy`. Conflict alerts are driven by that (`src/hooks/useConflictAlerts.ts`).
- **Hidden gauges (team decision):** in team play each role sees only the gauges it watches. Engineer: build time. Science Lead: power, data & comms. Mission Planner: budget. Comms & Flight Dynamics: mass, delta-v. The split is `GAUGE_WATCHER` in `src/game/ui.ts`, and visibility is `canSeeGauge` in the store. Note: Member 1's `RESOURCE_OWNER` (whose panel shows a warning) is a different split; the team should agree on one. On separate devices, set `myRole` per device and each player sees only their own gauges.
- The game does not call `src/sync` yet. Connecting the store to `sync.onRoomChange` / `sync.updateDesign` is the next step.

## Version notes

- React 19, Vite 8, Tailwind CSS 4. TypeScript stays on 5.8 for the Amplify tooling.
- `package-lock.json` was regenerated: the old one pinned `@vitejs/plugin-react` 4, which conflicts with Vite 8.
