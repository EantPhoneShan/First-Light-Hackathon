# First Light: project page draft (Member 1, task 1.17)

Draft text for the Space Apps project page. Fill in the bracketed parts on Sunday (video link, live URL, team names), and check every claim against the build that is submitted.

---

## High-level summary

**First Light** is a browser game where 1 player, or a team of up to 4, runs a NASA-style mission design study. Players take a mission from an idea to "first light", the moment its first data reaches Earth: they choose the science goal, set the requirements, build the spacecraft, pick the orbit, rocket and ground stations, and then watch the mission fly in a live simulation. When it fails, the game says exactly why ("Your battery ran out 29 minutes into the 35-minute eclipse"), and the team fixes it and flies again.

Our pitch: *your spacecraft dies in its first eclipse. Find out why, fix it, and fly again.*

## What it does

- **Follows the real process.** The game's steps are JPL's Concept Maturity Levels: CML 1 Idea (pick a science goal, then a measurement, then an instrument, so instruments that don't fit the goal are locked with a reason, as in NASA's telescope game), CML 2 Feasibility (set priorities), CML 4 Point design, then a design review, launch, flight and report.
- **Covers the whole mission.** All four segments from NASA's *Design and Develop Science Missions* are player decisions: launch (rocket class), space (bus and parts), ground (stations) and user (who needs the data, and how fast).
- **Every decision has a consequence.** Seven resources are checked live: mass, power, budget, data storage, communications, time and delta-v. A bigger instrument means more science, but also more power, mass, data and cost. The rules engine explains each warning in one plain sentence with real numbers, and suggests a fix.
- **A real simulation, not a quiz.** The flight is simulated minute by minute: orbit period and eclipse from the altitude, battery charge and drain, data piling up between ground passes, solar panels wearing out, and air drag pulling low orbits down. Random events (a solar storm, a ground station outage, a radio that stops answering) ask the team to choose, with consequences.
- **There is rarely one right answer.** Several builds win each scenario. A thermal imager finds fires best, but a multispectral imager returns two kinds of science; only a team that balances both power and science earns 3 stars.
- **Collaboration is needed.** In team mode each of the four roles (Mission Planner, Spacecraft Engineer, Science Lead, Comms and Flight Dynamics) owns part of the craft and has a private goal that pulls against the others. Only the role that watches a gauge can see it, so when one player's change hurts another's gauge, that player gets an alert naming who did what ("Power is now 0.91 W short. Lucas (Flight Dynamics) swapped the S-band radio for the X-band radio.").
- **A report that teaches.** After each flight: a timeline with what went wrong and when, why, how to fix it, a score by category, how much data reached the customer and how late, and how this flight compares with the last one.
- **Scenarios:** Wildfire Watch (a 6U CubeSat for firefighters, with the guided tutorial) and Flood Radar (a small radar satellite that sees through storm clouds).

## How we built it

- **Game engine:** TypeScript with no UI code, so the same engine runs in every browser and in the server's score check. Every number lives in data files, and each one names the NASA resource it comes from. The engine has automated tests (Vitest), and the data files are checked against schemas (Zod).
- **Screens:** React, Tailwind CSS, Framer Motion, dnd-kit for drag and drop, HTML canvas for the orbit view.
- **Team play and leaderboard:** AWS Amplify Gen 2 (AppSync with live subscriptions and DynamoDB), with a Firebase fallback. The leaderboard score is recomputed on the server by replaying the flight, so scores can't be faked.
- **Hosting:** AWS Amplify Hosting, deployed from GitHub on every push.

## How we used NASA resources

| Resource | Where it shows up in the game |
|---|---|
| CubeSat 101 | The Easy tier is a 6U CubeSat: 1U is a 10 cm cube of 1 to 1.33 kg, so the 6U bus may weigh up to 8 kg. Build time follows its 18 to 24 months; the budget check follows its advice to keep at least a 10% reserve; deployable panels "nearly double" the power; amateur UHF radio, building your own ground station ("launching with an inadequate ground station is a mission killer"), Space Station deployment and rideshare, and the orbital debris rules |
| Design and Develop Science Missions | The four mission segments are the four kinds of decision |
| Concept Maturity Levels (JPL) | The game's phases are CML 1 to 4 |
| Mission Design Lab (Goddard) | Team mode works like an MDL study: disciplines design in parallel and review together; reliability and risk are part of the design |
| GMAT | Orbit decay times are rounded values to check against GMAT; the game uses simplified textbook formulas for period and eclipse |
| A Learning Game About Telescopes | Goal first, then instrument, with mismatched instruments locked; "your design is most like…" a real NASA mission (Landsat 9, Terra MODIS, NISAR, TROPICS, GOES-R), with facts checked on NASA pages |

All numbers are simplified and labelled approximate in the game.

## Benefits and impact

Students rarely get to try a whole mission. First Light lets a beginner (ages 12 and up, no physics needed) design one in about 15 minutes, fail safely, and understand *why*. Plain-English explanations, a guided tutorial that fails on purpose, and short Learn more links make the trade-offs that real mission teams face (mass against power, data against downlink, cost against reliability) something you can feel by playing.

## Use of AI

AI tools helped write code, planning documents and text. Illustrations generated with ChatGPT, if used, are labelled in the credits. [Confirm against the Space Apps rules on declaring AI tools before submitting.]

## Links

- Play: [live URL]
- 30-second video: [link]
- Code: [GitHub link]
- Credits and sources: docs/CREDITS.md
