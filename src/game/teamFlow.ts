/**
 * Member 2's side of the team flow (team decision, 14 Nov). Member 1's rules in
 * engine/flow.ts say who may do what in each step; this file turns them into
 * what the screens need:
 *
 *   useTeamFlow()   step, my roles, can I lead / edit, and goTo(step)
 *
 * Where the truth lives:
 *   - Device room: Member 3's sync. The room's step, who leads (sync.isLeader)
 *     and which roles this device acts for (sync.getActingRoles) all come from
 *     there, and sync's useFollowRoomStep keeps every device on the room's step.
 *     The screens only mirror those rules, so nothing offered here is refused there.
 *   - Solo or one shared screen: the step is simply the screen you are on, and
 *     roles nobody holds count as yours (same rule as hidden gauges).
 */
import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { canAdvance, canEditSection, canLead, stepForPath, stepInfo, type FlowFacts, type Step } from '@/engine/flow'
import type { Role } from '@/engine/types'
import { useGame } from '@/store/game'
import { sync } from '@/sync'
import { useDeviceRoom } from '@/sync/teamBridge'

const ALL_ROLES: Role[] = ['planner', 'science', 'engineer', 'flight']

// ---------- roles ----------

/** The roles this player acts for: their own, plus any role nobody in the team holds. */
export function useMyRoles(): Role[] {
  const myRole = useGame((s) => s.myRole)
  const players = useGame((s) => s.players)
  const device = useDeviceRoom()
  return useMemo(() => {
    // Device room: exactly what sync will accept edits for (online players only).
    if (device.active) return sync.getActingRoles() as Role[]
    if (myRole === 'solo' || players.length === 0) return ALL_ROLES
    const held = new Set(players.map((p) => p.role))
    return ALL_ROLES.filter((r) => r === myRole || !held.has(r))
    // device changes on every room update, which is when acting roles can change
  }, [myRole, players, device])
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
  /** Name of whoever leads, when it's someone else (device room). */
  leaderName: string | null
  /**
   * May I replace the whole design at once (load a share code, fly a trade-study
   * option, "New design")? Only when this device acts for every role, because
   * in a team room each part belongs to its own role.
   */
  canRewriteDesign: boolean
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
  const myRoles = useMyRoles()
  const design = useGame((s) => s.design)
  const players = useGame((s) => s.players.length)

  const deviceRoom = device.active
  const step: Step = (deviceRoom ? device.step : stepForPath(pathname)) ?? 'lobby'
  const team = myRoles.length < ALL_ROLES.length

  const goTo = useCallback(
    (to: Step) => {
      // In a room, move the room first (sync accepts it from the leader), then
      // this screen; sync's step follower brings everyone else along.
      if (deviceRoom) void sync.setPhase(to)
      navigate(stepInfo(to).path)
    },
    [deviceRoom, navigate],
  )

  return {
    step,
    myRoles,
    team,
    deviceRoom,
    lead: deviceRoom ? device.leader : canLead(step, myRoles),
    leaderName: deviceRoom ? device.leaderName : null,
    canRewriteDesign: myRoles.length === ALL_ROLES.length,
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
