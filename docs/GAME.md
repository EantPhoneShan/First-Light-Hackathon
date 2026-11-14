# Game UI (Member 2)

All the game screens: title, lobby, briefing (with science traceability), feasibility, workbench, design review, launch, simulation, report and re-fly, plus the tutorial, glossary, art and sound.

- Run: `npm install`, then `npm run dev`.
- Sync test panel (Member 3): open the app with `?synctest` in the URL.
- Art: built-in SVGs in `public/assets/svg/`. To swap in ChatGPT images, see `art/README.md` and run `npm run art`.

## Where the game logic lives today

The screens call **stand-in engine files** until Member 1's real ones are wired in. The top of each file lists the functions the UI calls.

| Stand-in (src/engine/) | Replaced by Member 1's |
|---|---|
| `mock.ts`, `types.ts` | `types.ts`, `rules.ts` and the JSON data in `src/data/` (on the `dusk` branch) |
| `mockSim.ts` | `simulate.ts` |
| `mockReport.ts` | `score.ts`, `report.ts` |
| `mockReview.ts` | `rules.ts`, `alerts.ts` |
| `mockScience.ts` | Science traceability data (F3) |

## Multiplayer hooks for Member 3

- Game state is one Zustand store: `src/store/game.ts`. `design`, `room.players`, `myRole` and `approvals` are the parts to sync.
- Each design change bumps `design.version` and sets `design.updatedBy`. Conflict alerts are driven by that (`src/hooks/useConflictAlerts.ts`).
- **Hidden gauges (team decision):** in team play each role sees only the gauges it watches. Engineer: build time. Science Lead: power, data & comms. Mission Planner: budget. Comms & Flight Dynamics: mass, delta-v. The split is `resourceOwner` in `src/engine/mockReview.ts`, and visibility is `canSeeGauge` in the store. On separate devices, set `myRole` per device and each player sees only their own gauges.
- The game does not call `src/sync` yet. Connecting the store to `sync.onRoomChange` / `sync.updateDesign` is the next step.

## Version notes

- React 19, Vite 8, Tailwind CSS 4. TypeScript stays on 5.8 for the Amplify tooling.
- `package-lock.json` was regenerated: the old one pinned `@vitejs/plugin-react` 4, which conflicts with Vite 8.
