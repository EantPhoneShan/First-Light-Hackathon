/**
 * Team mode on separate devices (Member 3).
 *
 * Bridges Member 2's game store (src/store/game.ts) and the cloud sync
 * (src/sync/index.ts). Shared-screen team mode and solo play do not use it.
 *
 *   hostDeviceRoom(name, role)  -> room code to share
 *   joinDeviceRoom(code, name, role)
 *   leaveDeviceRoom()
 *   useTeamSyncBridge()         mount once (Layout); keeps store and cloud in step
 *   useDeviceRoom()             status for the UI
 *
 * The store's design is split into the four role sections that sync stores:
 *   planner  { scenarioId, requirements }
 *   science  { measurementId }
 *   engineer { partsBySlot }
 *   flight   { orbitId, altitudeKm, launcherId, stationIds }
 * Each section also carries that role's Approve/Hold, tied to a hash of the
 * design it was given for, so a later change clears it on every device.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { Design, Role as GameRole } from '@/engine/placeholderTypes'
import { useGame, type Approval, type Requirements } from '@/store/game'
import { ROLES, sync, type Role, type Room, type SyncStatus } from './index'

type Payload = Record<string, unknown>

interface DeviceRoomState {
  active: boolean
  code: string | null
  status: SyncStatus
  busy: boolean
  error: string | null
}

let state: DeviceRoomState = { active: false, code: null, status: 'solo', busy: false, error: null }
const listeners = new Set<() => void>()
function setState(patch: Partial<DeviceRoomState>) {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}

/** Status of the device room, for the lobby panel and the header badge. */
export function useDeviceRoom(): DeviceRoomState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state,
  )
}

// ---------- mapping between the store and the four sections ----------

/** Stable text of the shared design, used to tie approvals to one version of it. */
function designHash(d: Design): string {
  const text = JSON.stringify([d.orbitId, d.altitudeKm, d.launcherId, sortObj(d.partsBySlot), [...d.stationIds].sort()])
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function sortObj<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(o ?? {}).sort(([a], [b]) => a.localeCompare(b)))
}

type GameState = ReturnType<typeof useGame.getState>

function approvalFor(s: GameState, role: Role): Payload | null {
  const a = s.approvals[role as GameRole]
  if (!a || a.version !== s.design.version) return null
  return { state: a.state, note: a.note ?? null, hash: designHash(s.design) }
}

/** The four section payloads for the store's current state. Key order is fixed so JSON compares work. */
function payloads(s: GameState): Record<Role, Payload> {
  const d = s.design
  return {
    planner: { scenarioId: s.room.scenarioId, requirements: s.requirements, approval: approvalFor(s, 'planner') },
    science: { measurementId: s.measurementId, approval: approvalFor(s, 'science') },
    engineer: { partsBySlot: sortObj(d.partsBySlot), approval: approvalFor(s, 'engineer') },
    flight: {
      orbitId: d.orbitId,
      altitudeKm: d.altitudeKm,
      launcherId: d.launcherId,
      stationIds: [...d.stationIds].sort(),
      approval: approvalFor(s, 'flight'),
    },
  }
}

const isEmpty = (p: Payload | undefined) => !p || Object.keys(p).length === 0

/** Apply the room from the cloud to the store. Returns nothing; only changes what differs. */
function applyRemote(room: Room, keepLocal: Set<Role>) {
  const s = useGame.getState()
  const sec = room.sections
  // Roles with an unsent local edit keep the local version until it is sent.
  const get = (r: Role) => (keepLocal.has(r) || isEmpty(sec[r].data) ? null : (sec[r].data as Payload))
  const planner = get('planner')
  const science = get('science')
  const engineer = get('engineer')
  const flight = get('flight')

  // Who made the latest design change: their role becomes design.updatedBy, so
  // Member 2's conflict alerts name the right teammate.
  const latest = [...ROLES].sort((a, b) => sec[b].updatedAt - sec[a].updatedAt)[0]
  const byPlayer = room.players.find((p) => p.id === sec[latest].updatedBy)
  const byRole = (byPlayer?.roles[0] ?? latest) as GameRole

  const nextDesign: Design = {
    ...s.design,
    ...(engineer && { partsBySlot: (engineer.partsBySlot as Design['partsBySlot']) ?? {} }),
    ...(flight && {
      orbitId: (flight.orbitId as string | null) ?? null,
      altitudeKm: typeof flight.altitudeKm === 'number' ? flight.altitudeKm : s.design.altitudeKm,
      launcherId: (flight.launcherId as string | null) ?? null,
      stationIds: Array.isArray(flight.stationIds) ? (flight.stationIds as string[]) : [],
    }),
  }
  const designChanged = designHash(nextDesign) !== designHash(s.design)
  const design = designChanged ? { ...nextDesign, version: s.design.version + 1, updatedBy: byRole } : s.design

  // Approvals count only if they were given for exactly this design.
  const hash = designHash(design)
  const approvals: Partial<Record<GameRole, Approval>> = {}
  for (const r of ROLES) {
    if (keepLocal.has(r)) {
      const mine = s.approvals[r as GameRole]
      if (mine && mine.version === s.design.version && !designChanged) approvals[r as GameRole] = mine
      continue
    }
    const a = (get(r)?.approval ?? null) as { state: Approval['state']; note: string | null; hash: string } | null
    if (a && a.hash === hash) approvals[r as GameRole] = { state: a.state, version: design.version, note: a.note ?? undefined }
  }

  const players = room.players
    .filter((p) => p.roles.length > 0)
    .map((p) => ({ name: p.name, role: p.roles[0] as GameRole, approved: false }))
  const mine = room.players.find((p) => p.id === sync.playerId)?.roles[0] as GameRole | undefined

  const patch: Partial<GameState> = {
    design,
    approvals,
    room: { ...s.room, code: room.code, players, ...(planner?.scenarioId ? { scenarioId: String(planner.scenarioId) } : {}) },
    ...(mine && { myRole: mine }),
  }
  if (planner?.requirements) patch.requirements = planner.requirements as Requirements
  if (science && 'measurementId' in science) patch.measurementId = (science.measurementId as string | null) ?? null
  useGame.setState(patch)
}

// ---------- the bridge ----------

let lastSynced: Partial<Record<Role, string>> = {}
let applyingRemote = false
const timers = new Map<Role, ReturnType<typeof setTimeout>>()
/** Roles with a local edit that has not been sent yet. */
const pending = new Set<Role>()
const writing = new Map<Role, Promise<void>>()

function pushChanges(s: GameState) {
  if (!state.active || applyingRemote) return
  const p = payloads(s)
  for (const r of ROLES) {
    const text = JSON.stringify(p[r])
    if (text === lastSynced[r]) continue
    // Wait a moment (sliders send many changes) and never send two writes for one role at once.
    clearTimeout(timers.get(r))
    pending.add(r)
    timers.set(
      r,
      setTimeout(() => {
        pending.delete(r)
        const now = JSON.stringify(payloads(useGame.getState())[r])
        if (now === lastSynced[r]) return
        lastSynced[r] = now
        const prev = writing.get(r) ?? Promise.resolve()
        const next = prev.then(() => sync.updateDesign(r, JSON.parse(now))).catch(() => {})
        writing.set(r, next)
      }, 250),
    )
  }
}

function onRoom(room: Room) {
  if (!state.active) return
  const keepLocal = new Set(pending)
  for (const r of ROLES) if (!keepLocal.has(r) && !isEmpty(room.sections[r].data)) lastSynced[r] = JSON.stringify(room.sections[r].data)
  applyingRemote = true
  try {
    applyRemote(room, keepLocal)
  } finally {
    applyingRemote = false
  }
  // The store may have normalised something (for example dropped an approval); send that back.
  pushChanges(useGame.getState())
}

/** Mount once, in the layout. Does nothing until a device room is joined. */
export function useTeamSyncBridge() {
  useEffect(() => {
    const offStore = useGame.subscribe((s, prev) => {
      if (s === prev) return
      pushChanges(s)
    })
    const offRoom = sync.onRoomChange(onRoom)
    const offStatus = sync.onStatus((status) => setState({ status }))
    const offEvent = sync.onEvent((e) => {
      if (!state.active) return
      if (e.type === 'conflict') toast.warning('Two people changed the same thing', { description: e.message })
      else if (e.type === 'player-joined') toast(`${e.player.name} joined the room`)
      else if (e.type === 'player-left') toast(`${e.player.name} left the room`)
      else if (e.type === 'error') toast.error(e.message)
    })
    resumeDeviceRoom()
    return () => {
      offStore()
      offRoom()
      offStatus()
      offEvent()
    }
  }, [])
}

const RESUME_KEY = 'first-light:device-room'

function remember(v: { code: string; name: string; role: Role } | null) {
  try {
    if (v) sessionStorage.setItem(RESUME_KEY, JSON.stringify(v))
    else sessionStorage.removeItem(RESUME_KEY)
  } catch {
    /* storage blocked: no resume after refresh */
  }
}

/** After a page refresh, rejoin the device room this tab was in. */
function resumeDeviceRoom() {
  if (state.active || state.busy) return
  try {
    const raw = sessionStorage.getItem(RESUME_KEY)
    if (!raw) return
    const { code, name, role } = JSON.parse(raw)
    joinDeviceRoom(code, name, role).catch(() => remember(null))
  } catch {
    remember(null)
  }
}

async function enter(run: () => Promise<string>, role: Role, pushFirst: boolean, name: string) {
  setState({ busy: true, error: null })
  lastSynced = {}
  try {
    // Turn the bridge on before joining so the first room update reaches the store.
    setState({ active: true })
    const code = await run()
    sync.setOpenEditing(true)
    const granted = await sync.chooseRoles([role])
    if (!granted.includes(role)) {
      sync.leaveRoom()
      throw new Error('Someone in that room already has this role. Pick another one.')
    }
    useGame.setState({ myRole: role as GameRole })
    if (pushFirst) pushChanges(useGame.getState())
    setState({ code, busy: false })
    remember({ code, name, role })
    return code
  } catch (err) {
    sync.setOpenEditing(false)
    setState({ active: false, code: null, busy: false, error: err instanceof Error ? err.message : String(err) })
    throw err
  }
}

/** Create a room from this device's current design. Returns the code to share. */
export function hostDeviceRoom(name: string, role: Role) {
  return enter(() => sync.createRoom(name, useGame.getState().room.scenarioId), role, true, name)
}

/** Join a teammate's room. The room's design replaces this device's design. */
export function joinDeviceRoom(code: string, name: string, role: Role) {
  return enter(async () => (await sync.joinRoom(code, name)).code, role, false, name)
}

export function leaveDeviceRoom() {
  timers.forEach(clearTimeout)
  timers.clear()
  pending.clear()
  remember(null)
  sync.leaveRoom()
  sync.setOpenEditing(false)
  lastSynced = {}
  setState({ active: false, code: null, status: 'solo', error: null })
  useGame.setState((s) => ({ room: { ...s.room, code: '', players: [] }, myRole: 'solo' }))
}
