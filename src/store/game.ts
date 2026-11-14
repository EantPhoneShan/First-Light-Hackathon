import { useMemo } from 'react'
import { create } from 'zustand'
import { emptyDesign, scenarios, slotsFor, tutorialDesign } from '@/engine/mock'
import { resourceOwner } from '@/engine/mockReview'
import type { Design, FlightResult, ResourceKey, Role, Room, Scenario } from '@/engine/placeholderTypes'

/**
 * One store for design, room and local UI (per PRD).
 * Member 3's sync layer reads and writes `design` and `room`.
 */
interface GameState {
  room: Room
  design: Design
  myRole: Role | 'solo'
  setScenario: (id: string) => void
  /** CML 2 requirements set on the Feasibility screen (F4). Lifetime overrides the scenario's. */
  requirements: Requirements
  setRequirements: (patch: Partial<Requirements>) => void
  /** CML 1 science traceability (F3): the measurement the team chose for the goal. */
  measurementId: string | null
  setMeasurement: (id: string | null) => void
  /** Shared-screen team (Lobby): one name per role. */
  setPlayer: (role: Role, name: string) => void
  setMyRole: (role: Role | 'solo') => void
  placePart: (slot: string, partId: string | null) => void
  updateDesign: (patch: Partial<Design>) => void
  resetDesign: () => void
  /** Finished flights, newest last. The report reads the last one; the next flight shows it as a ghost. */
  flights: FlightResult[]
  saveFlight: (f: FlightResult) => void
  /** Set by "Modify and re-fly": parts and tabs to highlight on the workbench (F18). */
  refly: Refly | null
  setRefly: (r: Refly | null) => void
  /** Design review sign-off per role (F12). Only counts if `version` matches the current design. */
  approvals: Partial<Record<Role, Approval>>
  setApproval: (role: Role, state: Approval['state'] | null, note?: string) => void
  /** Tutorial mode (F1): the guide card walks the player through fly, fail, fix, re-fly. */
  tutorial: boolean
  startTutorial: () => void
  endTutorial: () => void
}

export interface Approval {
  state: 'approved' | 'hold'
  version: number
  note?: string
}

export interface Refly {
  slots: string[]
  tabs: ('launch' | 'ground')[]
  fixes: string[]
}

const updatedBy = (r: Role | 'solo'): Role | null => (r === 'solo' ? null : r)

export const useGame = create<GameState>((set) => ({
  room: {
    code: '',
    scenarioId: scenarios[0].id,
    phase: 'briefing',
    seed: 'first-light',
    players: [],
  },
  design: emptyDesign(),
  myRole: 'solo',

  setScenario: (id) =>
    set((s) => ({ room: { ...s.room, scenarioId: id }, requirements: defaultRequirements(scenarioById(id)), measurementId: null })),
  measurementId: null,
  setMeasurement: (measurementId) => set({ measurementId }),
  requirements: defaultRequirements(scenarios[0]),
  setRequirements: (patch) => set((s) => ({ requirements: { ...s.requirements, ...patch } })),
  setPlayer: (role, name) =>
    set((s) => {
      const others = s.room.players.filter((p) => p.role !== role)
      const players = name.trim() ? [...others, { role, name, approved: false }] : others
      // The first named player takes the controls; if everyone leaves, go back to solo.
      // If the player at the controls just left, hand the controls to someone still playing.
      const stillHere = s.myRole !== 'solo' && players.some((p) => p.role === s.myRole)
      const myRole = players.length === 0 ? 'solo' : stillHere ? s.myRole : players[0].role
      return { room: { ...s.room, players }, myRole }
    }),
  setMyRole: (role) => set({ myRole: role }),
  placePart: (slot, partId) =>
    set((s) => {
      let partsBySlot = { ...s.design.partsBySlot, [slot]: partId }
      // Changing the bus changes which slots exist: drop parts in slots that are gone.
      if (slot === 'bus') {
        const valid = new Set(slotsFor({ ...s.design, partsBySlot }).map((d) => d.id))
        partsBySlot = Object.fromEntries(Object.entries(partsBySlot).filter(([id]) => valid.has(id)))
      }
      const refly = s.refly && { ...s.refly, slots: s.refly.slots.filter((id) => id !== slot) }
      return {
        refly,
        design: {
          ...s.design,
          partsBySlot,
          version: s.design.version + 1,
          updatedBy: updatedBy(s.myRole),
        },
      }
    }),
  updateDesign: (patch) =>
    set((s) => ({
      design: { ...s.design, ...patch, version: s.design.version + 1, updatedBy: updatedBy(s.myRole) },
    })),
  resetDesign: () => set({ design: emptyDesign(), approvals: {} }),
  flights: [],
  saveFlight: (f) => set((s) => ({ flights: [...s.flights, f], refly: null })),
  refly: null,
  setRefly: (refly) => set({ refly }),
  approvals: {},
  tutorial: false,
  startTutorial: () =>
    set((s) => ({
      tutorial: true,
      design: tutorialDesign(),
      room: { ...s.room, scenarioId: scenarios[0].id },
      requirements: defaultRequirements(scenarios[0]),
      measurementId: 'heat',
      flights: [],
      refly: null,
      approvals: {},
    })),
  endTutorial: () => set({ tutorial: false, design: emptyDesign(), flights: [], refly: null, approvals: {} }),
  setApproval: (role, state, note) =>
    set((s) => {
      const approvals = { ...s.approvals }
      if (state) approvals[role] = { state, version: s.design.version, note }
      else delete approvals[role]
      return { approvals }
    }),
}))

export interface Requirements {
  /** Days between looks at the same place. */
  revisitDays: number
  /** Ground size of one image pixel, in metres. */
  detailM: number
  lifetimeYears: number
}

// Function declarations (not arrow consts) because the store above calls them while it is created.
export function scenarioById(id: string) {
  return scenarios.find((sc) => sc.id === id) ?? scenarios[0]
}

export function defaultRequirements(sc: Scenario): Requirements {
  return { revisitDays: 4, detailM: 10, lifetimeYears: sc.lifetimeYears }
}

/** The scenario with the team's chosen lifetime applied. Same object while nothing changes. */
export function currentScenario(s: Pick<GameState, 'room' | 'requirements'>): Scenario {
  const sc = scenarioById(s.room.scenarioId)
  return s.requirements.lifetimeYears === sc.lifetimeYears ? sc : { ...sc, lifetimeYears: s.requirements.lifetimeYears }
}

/**
 * Team play hides gauges: each role sees only the ones it watches (see resourceOwner).
 * Solo play, or a role nobody has taken, shows the gauge to everyone.
 */
export function canSeeGauge(key: ResourceKey, s: { myRole: Role | 'solo'; players: Room['players'] }) {
  if (s.myRole === 'solo' || s.players.length === 0) return true
  const watcher = resourceOwner[key]
  if (!s.players.some((p) => p.role === watcher)) return true
  return watcher === s.myRole
}

export function useCanSee() {
  const myRole = useGame((s) => s.myRole)
  const players = useGame((s) => s.room.players)
  return (key: ResourceKey) => canSeeGauge(key, { myRole, players })
}

export const useScenario = () => {
  const id = useGame((s) => s.room.scenarioId)
  const years = useGame((s) => s.requirements.lifetimeYears)
  return useMemo(() => currentScenario({ room: { scenarioId: id } as Room, requirements: { lifetimeYears: years } as Requirements }), [id, years])
}

// Dev only: lets test scripts set up a design without dragging parts.
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame
