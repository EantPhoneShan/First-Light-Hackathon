import { useMemo } from 'react'
import { create } from 'zustand'
import { findPart, findScenario, gameData } from '@/engine/data'
import { emptyDesign } from '@/engine/design'
import { evaluate } from '@/engine/rules'
import type { Design, DisposalPlan, Evaluation, PlannerData, ResourceId, Role, Scenario } from '@/engine/types'
import { GAUGE_WATCHER, withPart, withoutPart } from '@/game/ui'
import type { FlightResult } from '@/sim/types'

/**
 * One store for the design, the shared-screen team and local UI (per PRD).
 * `design` is Member 1's Design (four role sections), so Member 3's sync can store
 * each section as-is: mergedDesign(room) <-> design.
 */
interface GameState {
  scenarioId: string
  setScenario: (id: string) => void

  design: Design
  /** Bumped on every edit; approvals and conflict alerts compare against it. */
  designVersion: number
  /** Role that made the last edit (null in solo play). */
  updatedBy: Role | null
  /** Replace one role's section via a recipe. Every design edit goes through here. */
  edit: (role: Role, recipe: (d: Design) => Design) => void
  setBus: (busId: string | null) => void
  addPart: (partId: string) => void
  removePart: (partId: string) => void
  setOrbit: (orbitId: string | null) => void
  setAltitude: (km: number) => void
  setLauncher: (launcherId: string | null) => void
  toggleStation: (stationId: string) => void
  setScience: (goalId: string | null, measurementId: string | null) => void
  setDisposal: (plan: DisposalPlan) => void
  setWeight: (key: keyof PlannerData['weights'], value: number) => void
  resetDesign: () => void

  /** Shared-screen team (Lobby): one name per role. */
  players: LobbyPlayer[]
  setPlayer: (role: Role, name: string) => void
  myRole: Role | 'solo'
  setMyRole: (role: Role | 'solo') => void

  /** Finished flights, newest last. The report reads the last one; the next flight shows it as a ghost. */
  flights: FlightResult[]
  saveFlight: (f: FlightResult) => void
  /** Set by "Modify and re-fly": parts and tabs to highlight on the workbench (F18). */
  refly: Refly | null
  setRefly: (r: Refly | null) => void
  /** Design review sign-off per role (F12). Only counts if `version` matches designVersion. */
  approvals: Partial<Record<Role, Approval>>
  setApproval: (role: Role, state: Approval['state'] | null, note?: string) => void
  /**
   * Event choices, by eventKey() (flight number + event + its scheduled time).
   * Team flow: only the event's owner role picks; every device applies the pick
   * it finds here, so a relay of this field (Member 3) keeps all flights the same.
   */
  eventChoices: Record<string, string>
  setEventChoice: (key: string, choiceId: string) => void
  /** Tutorial mode (F1): the guide card walks the player through fly, fail, fix, re-fly. */
  tutorial: boolean
  startTutorial: () => void
  endTutorial: () => void
}

export interface LobbyPlayer {
  role: Role
  name: string
}

export interface Approval {
  state: 'approved' | 'hold'
  version: number
  note?: string
}

export interface Refly {
  partIds: string[]
  tabs: ('launch' | 'ground')[]
  fixes: string[]
}

const firstScenario = gameData.scenarios[0]

export const useGame = create<GameState>((set, get) => ({
  scenarioId: firstScenario.id,
  setScenario: (id) => set({ scenarioId: id, design: emptyDesign(), designVersion: 0, approvals: {} }),

  design: emptyDesign(),
  designVersion: 0,
  updatedBy: null,
  edit: (role, recipe) =>
    set((s) => ({
      design: recipe(s.design),
      designVersion: s.designVersion + 1,
      updatedBy: s.myRole === 'solo' ? null : s.myRole === role ? role : s.myRole,
    })),
  setBus: (busId) => get().edit('engineer', (d) => ({ ...d, engineer: { ...d.engineer, busId } })),
  addPart: (partId) => {
    const p = findPart(gameData, partId)
    if (!p) return
    get().edit(roleForPart(p.category), (d) => withPart(d, p))
  },
  removePart: (partId) => {
    const p = findPart(gameData, partId)
    if (!p) return
    get().edit(roleForPart(p.category), (d) => withoutPart(d, p))
    set((s) => ({ refly: s.refly && { ...s.refly, partIds: s.refly.partIds.filter((id) => id !== partId) } }))
  },
  setOrbit: (orbitId) => get().edit('flight', (d) => ({ ...d, flight: { ...d.flight, orbitId, altitudeKm: null } })),
  setAltitude: (altitudeKm) => get().edit('flight', (d) => ({ ...d, flight: { ...d.flight, altitudeKm } })),
  setLauncher: (launcherId) => get().edit('flight', (d) => ({ ...d, flight: { ...d.flight, launcherId } })),
  toggleStation: (id) =>
    get().edit('flight', (d) => {
      const has = d.flight.stationIds.includes(id)
      return { ...d, flight: { ...d.flight, stationIds: has ? d.flight.stationIds.filter((x) => x !== id) : [...d.flight.stationIds, id] } }
    }),
  setScience: (goalId, measurementId) => get().edit('science', (d) => ({ ...d, science: { ...d.science, goalId, measurementId } })),
  setDisposal: (disposal) => get().edit('planner', (d) => ({ ...d, planner: { ...d.planner, disposal } })),
  setWeight: (key, value) => get().edit('planner', (d) => ({ ...d, planner: { ...d.planner, weights: { ...d.planner.weights, [key]: value } } })),
  resetDesign: () => set({ design: emptyDesign(), designVersion: 0, approvals: {}, refly: null }),

  players: [],
  setPlayer: (role, name) =>
    set((s) => {
      const others = s.players.filter((p) => p.role !== role)
      const players = name.trim() ? [...others, { role, name }] : others
      // The first named player takes the controls; if the player at the controls leaves, hand them on.
      const stillHere = s.myRole !== 'solo' && players.some((p) => p.role === s.myRole)
      const myRole = players.length === 0 ? 'solo' : stillHere ? s.myRole : players[0].role
      return { players, myRole }
    }),
  myRole: 'solo',
  setMyRole: (myRole) => set({ myRole }),

  flights: [],
  saveFlight: (f) => set((s) => ({ flights: [...s.flights, f], refly: null })),
  refly: null,
  setRefly: (refly) => set({ refly }),
  approvals: {},
  setApproval: (role, state, note) =>
    set((s) => {
      const approvals = { ...s.approvals }
      if (state) approvals[role] = { state, version: s.designVersion, note }
      else delete approvals[role]
      return { approvals }
    }),

  eventChoices: {},
  setEventChoice: (key, choiceId) => set((s) => ({ eventChoices: { ...s.eventChoices, [key]: choiceId } })),

  tutorial: false,
  startTutorial: () =>
    set(() => {
      const sc = gameData.scenarios.find((x) => x.tutorialDesign) ?? firstScenario
      return { tutorial: true, scenarioId: sc.id, design: sc.tutorialDesign ?? emptyDesign(), designVersion: 1, flights: [], refly: null, approvals: {}, eventChoices: {} }
    }),
  endTutorial: () => set({ tutorial: false, design: emptyDesign(), designVersion: 0, flights: [], refly: null, approvals: {}, eventChoices: {} }),
}))

/** Same on every device for the same flight and event (the schedule comes from the room's seed). */
export const eventKey = (flightNo: number, ev: { eventId: string; tMin: number }) => `${flightNo}:${ev.eventId}@${ev.tMin}`

/** The role that edits a part (matches CATEGORY_OWNER in engine/types.ts). */
const roleForPart = (c: string): Role => (c === 'instrument' ? 'science' : c === 'antenna' ? 'flight' : 'engineer')

export const scenarioById = (id: string): Scenario => findScenario(gameData, id) ?? firstScenario

export const useScenario = () => {
  const id = useGame((s) => s.scenarioId)
  return useMemo(() => scenarioById(id), [id])
}

/** Member 1's evaluate() for the current design: gauges, problems, greyed-out choices, totals. */
export function useEvaluation(): Evaluation {
  const design = useGame((s) => s.design)
  const scenario = useScenario()
  return useMemo(() => evaluate(design, scenario, gameData), [design, scenario])
}

/**
 * Team play hides gauges: each role sees only the ones it watches (GAUGE_WATCHER).
 * Solo play, or a role nobody has taken, shows the gauge to everyone.
 */
export function canSeeGauge(key: ResourceId, s: { myRole: Role | 'solo'; players: LobbyPlayer[] }) {
  if (s.myRole === 'solo' || s.players.length === 0) return true
  const watcher = GAUGE_WATCHER[key]
  if (!s.players.some((p) => p.role === watcher)) return true
  return watcher === s.myRole
}

export function useCanSee() {
  const myRole = useGame((s) => s.myRole)
  const players = useGame((s) => s.players)
  return (key: ResourceId) => canSeeGauge(key, { myRole, players })
}

// Dev only: lets test scripts set up a design without dragging parts.
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame
