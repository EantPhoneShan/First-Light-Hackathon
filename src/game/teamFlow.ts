/**
 * Member 2's side of the team flow (team decision, 14 Nov). Member 1's rules in
 * engine/flow.ts say who may do what in each step; this file turns them into
 * hooks the screens use:
 *
 *   useTeamFlow()        step, my roles, can I lead / edit, and goTo(step)
 *   useFollowRoomStep()  mount once (Layout): every device goes where the room is
 *
 * Where the step lives:
 *   - Device room (Member 3's sync): room.phase, which holds the full Step
 *     (sync's Phase was widened to the 8 steps).
 *   - Solo or one shared screen: the step is simply the screen you are on.
 *
 * Roles nobody in the team holds count as mine, the same rule as hidden gauges,
 * so a team of two is never stuck waiting for a role that nobody took.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { canAdvance, canEditSection, canLead, STEPS, stepForPath, stepInfo, type FlowFacts, type Step } from '@/engine/flow'
import type { Role } from '@/engine/types'
import { useGame } from '@/store/game'
import { sync, type Room } from '@/sync'
import { useDeviceRoom } from '@/sync/teamBridge'

const ALL_ROLES: Role[] = ['planner', 'science', 'engineer', 'flight']

const isStep = (v: unknown): v is Step => typeof v === 'string' && STEPS.some((s) => s.id === v)

// ---------- the room's step, read from sync ----------

let roomStep: Step | null = null
let roomCode: string | null = null
let roomHost: string | null = null
const listeners = new Set<() => void>()

function readRoom(room: Room | null) {
  const step = room && isStep(room.phase) ? room.phase : null
  const code = room?.code ?? null
  if (step === roomStep && code === roomCode) return
  roomStep = step
  roomCode = code
  roomHost = room?.hostId ?? null
  listeners.forEach((fn) => fn())
}

let wired = false
function wire() {
  if (wired) return
  wired = true
  readRoom(sync.getRoom())
  sync.onRoomChange(readRoom)
}

function useRoomStep(): { step: Step | null; code: string | null } {
  wire()
  const step = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => roomStep,
  )
  return { step, code: roomCode }
}

// ---------- roles ----------

/** The roles this player acts for: their own, plus any role nobody in the team holds. */
export function useMyRoles(): Role[] {
  const myRole = useGame((s) => s.myRole)
  const players = useGame((s) => s.players)
  return useMemo(() => {
    if (myRole === 'solo' || players.length === 0) return ALL_ROLES
    const held = new Set(players.map((p) => p.role))
    return ALL_ROLES.filter((r) => r === myRole || !held.has(r))
  }, [myRole, players])
}

// ---------- the hook the screens use ----------

export interface TeamFlow {
  /** The step the whole room is on. */
  step: Step
  myRoles: Role[]
  /** Playing with others (some role belongs to someone else). */
  team: boolean
  /** Every device follows the room's step (separate devices). */
  deviceRoom: boolean
  /** Can I press this step's Next / Launch / Re-fly? */
  lead: boolean
  /** Can I edit this section in this step? */
  canEdit: (section: Role) => boolean
  /** Can the team move on from here, and if not, why not. */
  check: (facts: Omit<FlowFacts, 'design' | 'players'> & Partial<Pick<FlowFacts, 'design' | 'players'>>) => ReturnType<typeof canAdvance>
  /** Move the whole room to a step. */
  goTo: (step: Step) => void
}

export function useTeamFlow(): TeamFlow {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const device = useDeviceRoom()
  const { step: shared } = useRoomStep()
  const myRoles = useMyRoles()
  const design = useGame((s) => s.design)
  const players = useGame((s) => s.players.length)

  const deviceRoom = device.active && shared !== null
  const step: Step = (deviceRoom ? shared : stepForPath(pathname)) ?? 'lobby'
  const team = myRoles.length < ALL_ROLES.length

  const goTo = useCallback(
    (to: Step) => {
      if (deviceRoom) {
        sync.setPhase(to).catch(() => {})
      }
      navigate(stepInfo(to).path)
    },
    [deviceRoom, navigate],
  )

  return {
    step,
    myRoles,
    team,
    deviceRoom,
    lead: canLead(step, myRoles),
    canEdit: (section) => canEditSection(step, myRoles, section),
    check: (facts) => canAdvance(step, { design, players, ...facts }),
    goTo,
  }
}

/** Approvals in the store, as the flow wants them. */
export function useApprovalFacts(): Pick<FlowFacts, 'allApproved' | 'anyHold'> {
  const approvals = useGame((s) => s.approvals)
  const version = useGame((s) => s.designVersion)
  const current = ALL_ROLES.map((r) => approvals[r]).filter((a) => a && a.version === version)
  return {
    allApproved: current.length === ALL_ROLES.length && current.every((a) => a!.state === 'approved'),
    anyHold: current.some((a) => a!.state === 'hold'),
  }
}

/**
 * Mount once in the layout. In a device room, whenever room.phase changes
 * every screen goes to stepInfo(step).path. The host's room starts on the
 * host's own step, so making a room in the lobby doesn't throw them into design.
 */
export function useFollowRoomStep() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const device = useDeviceRoom()
  const { step, code } = useRoomStep()
  const seeded = useRef<string | null>(null)

  useEffect(() => {
    if (!device.active || !code || !step) return
    // First time we see this room as its host: put the room on the step we are on.
    if (seeded.current !== code) {
      seeded.current = code
      const here = stepForPath(pathname)
      if (roomHost === sync.playerId && here && here !== step) {
        sync.setPhase(here).catch(() => {})
        return
      }
    }
    const target = stepInfo(step).path
    // Only flow screens follow; the title screen and the glossary stay put.
    if (stepForPath(pathname) && pathname !== target) navigate(target, { replace: true })
  }, [device.active, code, step, pathname, navigate])

  useEffect(() => {
    if (!device.active) seeded.current = null
  }, [device.active])
}
