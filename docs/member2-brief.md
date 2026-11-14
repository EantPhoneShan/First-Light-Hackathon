# First Light: Member 2 (Interface and Visuals) brief, v3

Source: Member 1's PRD "Mission Design Lab: First Light" (v3, 14 Nov). Times are Malaysia time (UTC+8).

## What changed in v3 (vs the 3-concepts doc)
- **Phases are named after JPL Concept Maturity Levels (CML):** Tutorial → CML 1 Idea → CML 2 Feasibility → (CML 3 Trade study, P1) → CML 4 Point design → Design review → Launch → Simulation → Report → Re-fly.
- **Four mission segments are player decisions:** Launch, Space, Ground (stations), User (data customer, set by scenario).
- **Extra resources:** Delta-v (P0), Thermal (P1), Risk % (P1), on top of Mass, Power, Comms/Data, Budget, Time.
- **Easy tier is a 6U CubeSat** (numbers from NASA CubeSat 101).
- **Team mode MVP is one shared screen with 4 role panels.** Multi-device room codes are now P2 (stretch).
- **I also own the art:** about 38 images made with ChatGPT image generation.

## Front-end stack (mine)
| Layer | Choice |
|---|---|
| Build | Vite |
| Framework | React 18 + TypeScript (strict) |
| Routing | React Router: title, lobby, briefing, workbench, review, launch, simulation, report |
| Styling | Tailwind CSS, dark space theme, phone layout |
| Components | shadcn/ui (dialogs, tooltips, sliders, tabs, buttons) |
| Icons | Lucide React |
| State | Zustand: one store for design, room and local UI (Member 3's sync reads and writes it) |
| Drag and drop | dnd-kit (touch support) |
| Orbit/sim view | HTML canvas 2D (PixiJS only if too slow) |
| Gauges | Custom SVG |
| Animation | Framer Motion |
| Toasts | Sonner (conflict alerts) |
| Fonts | Space Grotesk (headings) + Inter (body) |
| Sound | Howler.js + CC0 sounds (Kenney / Freesound) |

## Contract with Member 1 (engine, pure TS, no UI)
I import these and never write game maths myself:
- `src/engine/types.ts`: Design, Room, Part, Result
- `rules.ts`: checks + compatibility + why sentences/hints
- `simulate.ts`: returns a **timeline I animate** (eclipse, battery, buffer, passes, downlink, lifetime)
- `events.ts` (seeded), `alerts.ts` (who's hurt, by whom, fixes), `score.ts`, `report.ts`
- Data: `data/parts.json` (each part has an `icon` field pointing to my art), `launchers.json`, `orbits.json`, `stations.json`, `scenarios.json`

**Synced data (Member 3):** Room = code, scenario, phase, seed, players (name, role, approved). Design = orbit, launch vehicle, parts by slot, ground stations, version, updatedBy.

## Screens and the PRD requirements behind them (P0 = must ship)
| Screen | Req | Priority |
|---|---|---|
| Tutorial: flawed CubeSat dies in first eclipse, guide walks through the fix | F1 | P0 |
| Briefing: objective, data customer, budget, launch date, lifetime, 2 critical resources | F2 | P0 |
| Science traceability: goal → measurement → instrument, misfit instruments locked with reason | F3 | P0 |
| Requirement sliders: coverage / detail / lifetime + one-line note | F4 | P0 |
| Workbench: drag parts, 6 gauges + risk %, critical gauges glow | F7 | P0 |
| Orbit picker: altitude slider, ground track/coverage preview, delta-v, launcher greyed with reason | F8 | P0 |
| Ground station picker (more stations = more passes + higher ops cost) | F9 | P0 |
| Design review: green/amber/red checklist with why sentences, Approve/Hold per role | F12 | P0 |
| Launch animation; fails with reason if over capacity | F13 | P0 |
| Simulation: 1 orbit in a few s, 1 yr ≈ 30 s; eclipse, battery, buffer, downlink, propellant, health, science; pause/speed | F14 | P0 |
| Report: timeline markers, why + fix, score by category, data delivered + delay | F16 | P0 |
| Re-fly: back to workbench with problem parts highlighted, ghost of last flight | F18 | P0 |
| Tooltips + Learn more on every part/orbit/concept | F21 | P0 |
| Feasibility check, trade study A vs B, end-of-mission plan, conflict alerts, events, real-mission match, save/share | F5, F6, F10, F11, F15, F17, F19 | P1 |
| Competitive, sandbox, leaderboard | F20 | P2 |

## Score categories (for the report screen)
Objective 350 · Value to data customer 200 · Efficiency 150 · Lifetime/schedule/end-of-mission 125 · Decision quality 125 · Collaboration 50 → 0–1000, 1–3 stars.

## Wildfire Watch (tutorial scenario)
Image fire-prone areas every 2 days for 3 years · customer: firefighters · 6U CubeSat · critical: Data, Communications · Easy. Second MVP scenario: **Flood Radar** (small sat, critical Power + Mass).

## My task list (29 h)
| # | Task | Slot | h |
|---|---|---|---|
| 2.1 | App skeleton: Vite + React + TS, Tailwind, shadcn/ui, Router, layout, routing | Fri 10 PM | 1.5 |
| 2.2 | Lock art style prompt, 3 test parts | Sat AM | 0.5 |
| 2.3 | Workbench: slots by bus size, parts tray by category, dnd-kit, tooltips | Sat 9:15 | 3 |
| 2.4 | Six SVG gauges, margins, R/A/G, critical glow | Sat 9:15 | 1.5 |
| 2.5 | Orbit + launch picker, altitude slider, greyed launchers with reason | Sat 1 PM | 2 |
| 2.6 | Simulation canvas: planet, orbit, eclipse shadow, craft, downlink beam, bars, pause/speed | Sat 1 PM | 4 |
| 2.7 | Report: score, stars, timeline markers, why, "Modify and re-fly" | Sat 1 PM | 2 |
| 2.8 | Sonner conflict alerts + Approve/Hold with role status | Sat 5 PM | 1.5 |
| 2.9 | Report polish | Sat 5 PM | 0.5 |
| 2.10 | Tutorial screens + tooltips | Sat 8:30 PM | 2 |
| 2.11 | Art assets (~38, ChatGPT), remove bg, resize, WebP, name by part id | gaps | 4 |
| 2.12 | Visual polish, phone layout, loading/error states | Sun 9:30 | 3 |
| 2.13 | Sound + small animations | Sun 1:30 | 0.5 |
| 2.14 | Record team mission (OBS) | Sun 2 PM | 1 |
| 2.15 | 30-second video (CapCut/DaVinci): dies in eclipse → fix → success → team play | Sun 3 PM | 1.5 |
| 2.16 | Add video + screenshots to project page | Sun 5 PM | 0.5 |

## Art pipeline (task 2.11)
- Style prompt (start every request with it): "Flat vector game illustration, clean shapes, soft cel shading, 3/4 view, navy and white with orange accents, transparent background, no text, no logos, centred on the canvas."
- Set: 14 parts, 6 instruments, 4 rockets (generic), 4 scene (ground dish, CubeSat, starfield, title art), 5 event cards, 4 role avatars, Earth from NASA Blue Marble (credit it).
- Sizes: parts/instruments/avatars 256 px WebP, rockets 512 px tall, events 512 px, Earth 1024 px.
- Steps: generate → pick → save prompt in `art/prompts.md` → remove bg (rembg / remove.bg) → resize + WebP (Squoosh / sharp) → `public/assets/part-<id>.webp`.
- Rules: no NASA logos or real rockets, no text in images. Credit "illustrations generated with ChatGPT" and declare AI use on the project page.

## Open items
- Need Member 1's `types.ts` (Design type) before wiring real data. I can build against a temporary mock until then.
- Need Member 3's GitHub repo URL (skeleton should live there).
