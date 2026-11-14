# Playtest feedback: all three members linked (14 Nov)

Branch `lucas` now runs **Member 1's engine** (rules, simulate, score, report, events, alerts) with **Member 3's team sync**, under **Member 2's screens**. Tested in the browser:

| Test | Result |
|---|---|
| Solo tutorial: fly, battery dies, report, fix, re-fly | ✅ Dies 29 min into the 35-min eclipse; fixed craft scores 888 (85 → 888) |
| Random events with choice cards | ✅ Event card pauses the flight; the choice shows in the log |
| Two devices in one room (local backend, two tabs) | ✅ Create and join with a room code, roles, shared design |
| Hidden gauges per role | ✅ Engineer sees Time (plus gauges of roles nobody holds) |
| Conflict alert to the right person | ✅ Engineer removes solar wings → Science Lead gets "Power is now 0.64 W short. Ben (Spacecraft Engineer) removed the deployable solar wings." Engineer gets "Chen got an alert" |
| Approve/Hold across devices | ✅ Syncs, and clears when the design changes |
| Rejoin after page refresh | ✅ |
| Build, type-check | ✅ |

Not tested: the real AWS backend (no `amplify_outputs.json` locally), more than 2 devices, phones on the live URL.

---

## Member 1 (game logic)

1. **Agree the role split for gauges (important).** `RESOURCE_OWNER` says the Engineer owns Mass and Power. The team's hidden-gauge rule says the Engineer only sees Time, and Power/Data/Comms are watched by the Science Lead. Because of this, `conflictAlerts()` treated "Engineer drained the power" as self-inflicted and **alerted nobody**. The UI now works around it (asks for all alerts with `includeSelf` and routes by `GAUGE_WATCHER` in `src/game/ui.ts`). Better: make `RESOURCE_OWNER` match the team rule, or add a `watcher` map the alerts use.
2. **Decision quality is capped in solo play.** Without a trade study (CML 3, F6, not built yet) every flight loses points and gets the tip "Compare two designs". Until F6 exists, consider not counting it (or say "coming soon" in the tip).
3. **Tutorial: Power is already red before launch.** The tutorial craft shows a red Power gauge on the workbench (the `power.battery` problem colours it). The PRD wants the failure to surprise players in flight. Option: make the battery shortfall `warn` on the gauge until the craft has flown once, or accept it (the guide now says "Power is red, but lots of teams launch anyway").
4. **Check event timing with a seed.** In one test, `createSim(…, { seed })` predicted the station outage on day 309, but it fired on day 157 in the live flight. Probably my test read a different seed, but worth a quick check that `stepSim` playback and `simulate()` schedule the same events for the same seed.
5. **Science text.** Please check the glossary (`src/content/glossary.ts`) and the tutorial guide wording against your numbers.

## Member 3 (cloud and multiplayer)

1. **Please review `src/sync/teamBridge.ts`.** It was written for the old store. I kept your logic (debounce, pending edits, approval hash, resume) and only changed the mapping: each section is now Member 1's `Design` section as-is (`planner + scenarioId`, `science`, `engineer`, `flight`), read back with `normalize*()`.
2. **Flights are not shared.** Each device flies its own copy. Same `room.seed` → same events, but:
   - an event choice made on one device doesn't reach the others, and
   - any design edit during a flight restarts the flight on every device.
   Suggestion: set `room.phase` to `'simulate'` when the team launches and lock edits until `'report'`; send event choices through sync (only the event's owner role chooses).
3. **Test on AWS.** Only the local backend was tested. A 4-device test on the deployed URL is still needed.
4. **Lockfile.** `npm ci` can't pass with the Amplify packages (they bundle pinned copies of `@aws-cdk/toolkit-lib` and `@opentelemetry/core`). Keep `npm install` in `amplify.yml`.
5. **Branches.** Your sync commit was also pushed onto `lucas`. It merged fine, but please use your own branch or a pull request so work isn't overwritten.

## Member 2 (interface and visuals: still to do)

- Accessibility of the "Or play on separate devices" panel: the name field has no label (screen readers read nothing).
- An event card is shown to everyone on a shared screen; on separate devices it should show only for its owner role (needs item 2 above).
- Trade study screen (CML 3) once Member 1 adds it.
- 30-second video, screenshots, project page media.
- Optional: ChatGPT art (`art/README.md`, `npm run art`).
