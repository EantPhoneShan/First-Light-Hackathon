/**
 * First Light sync API. This is the ONLY file the game imports for multiplayer.
 *
 *   import { sync } from './sync';
 *
 *   await sync.resume();                         // on app start: rejoin after a refresh
 *   sync.startSolo('wildfire-watch');            // single player, all 4 roles
 *   const code = await sync.createRoom('Adam', 'wildfire-watch');
 *   await sync.joinRoom('K7QF', 'Mei');
 *   await sync.chooseRoles(['science']);
 *   await sync.updateDesign('science', { instruments: ['thermal-camera'] });
 *   await sync.setApproved('science', true);
 *   sync.onRoomChange((room) => render(room));   // fires on every local or remote change
 *   sync.onStatus((s) => showDot(s));            // solo | connecting | connected | reconnecting | offline
 *   sync.onEvent((e) => toast(e));               // remote-change, conflict, approvals-reset, ...
 *
 * Which backend is used is set by VITE_SYNC (auto | local | aws | firebase; auto
 * means AWS when amplify_outputs.json exists, otherwise local). If the
 * cloud backend fails, the game keeps running on this device and retries.
 */
import { normalizeEngineer, normalizeFlight, normalizePlanner, normalizeScience } from '../engine/design';
import { canEditSection, canLead, stepInfo } from '../engine/flow';
import type { DesignSection, Phase, Player, Role, Room, SyncAdapter, SyncEvent, SyncStatus } from './types';
import { ConflictError, EditRefusedError, ROLES } from './types';
import { localAdapter } from './adapters/local';
import { emptySections, isValidCode, makeId, makeRoomCode, normaliseCode, sanitiseRoom, sleep } from './util';

export * from './types';
export { isValidCode, normaliseCode } from './util';

type Listener<T> = (v: T) => void;

const AUTOSAVE_KEY = 'first-light:autosave';
const PLAYER_KEY = 'first-light:player';
const LAST_ROOM_KEY = 'first-light:last-room';
const HEARTBEAT_MS = 15_000;
const ONLINE_WINDOW_MS = 45_000;

/** Key of the current design: changes whenever any role changes its data. */
export function designKey(room: Room): string {
  return ROLES.map((r) => room.sections[r].dataVersion).join('.');
}

/** True if this role has approved the design as it is right now. */
export function isApproved(room: Room, role: Role): boolean {
  return room.sections[role].approvedKey === designKey(room);
}

/** True when every role has approved the current design (ready to launch). */
export function allApproved(room: Room): boolean {
  return ROLES.every((r) => isApproved(room, r));
}

/** Merge all four sections into one object for Member 1's rules engine. */
export function mergedDesign(room: Room): Record<Role, Record<string, unknown>> {
  return Object.fromEntries(ROLES.map((r) => [r, room.sections[r].data])) as Record<Role, Record<string, unknown>>;
}

const ROLE_NAMES: Record<Role, string> = { planner: 'Mission Planner', science: 'Science Lead', engineer: 'Spacecraft Engineer', flight: 'Flight Dynamics' };

/** Sorted-key JSON, so field order (which the cloud does not keep) never matters. */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x,
  );
}

/** What a part that nobody has filled in yet looks like once the game reads it (an empty room section). */
function blankSection(role: Role, scenario: string): Record<string, unknown> {
  const blank = { planner: normalizePlanner, science: normalizeScience, engineer: normalizeEngineer, flight: normalizeFlight }[role]({});
  return role === 'planner' ? { ...blank, scenarioId: scenario } : { ...blank };
}

/**
 * True when two section payloads differ only in their `approval` field.
 * An empty section counts as the blank part, so a role that never changed its
 * part can still press Approve or Hold.
 */
function sameExceptApproval(a: Record<string, unknown>, b: Record<string, unknown>, role: Role, scenario: string): boolean {
  const strip = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => k !== 'approval'));
  const before = Object.keys(a ?? {}).length ? a : blankSection(role, scenario);
  return canonical(strip(before)) === canonical(strip(b));
}

export function isOnline(p: Player, now = Date.now()): boolean {
  return now - p.lastSeen < ONLINE_WINDOW_MS;
}

async function pickAdapter(): Promise<SyncAdapter> {
  // auto (default) = AWS if amplify_outputs.json is present, otherwise local.
  const want = (import.meta.env.VITE_SYNC as string | undefined)?.toLowerCase() || 'auto';
  try {
    if (want === 'aws' || want === 'auto') return (await import('./adapters/aws')).awsAdapter();
    if (want === 'firebase') return (await import('./adapters/firebase')).firebaseAdapter();
  } catch (err) {
    console.warn('[sync] cloud adapter failed to load, using local', err);
  }
  return localAdapter;
}

// Player id lives in sessionStorage (one per tab, survives refresh) so two tabs
// count as two players when testing; the name is remembered in localStorage.
function loadPlayer(): { id: string; name: string } {
  let id = '';
  let name = 'Player';
  try {
    id = sessionStorage.getItem(PLAYER_KEY + ':id') ?? '';
    name = localStorage.getItem(PLAYER_KEY + ':name') ?? name;
  } catch {
    /* ignore */
  }
  const p = { id: id || makeId(), name };
  savePlayer(p);
  return p;
}
function savePlayer(p: { id: string; name: string }) {
  try {
    sessionStorage.setItem(PLAYER_KEY + ':id', p.id);
    localStorage.setItem(PLAYER_KEY + ':name', p.name);
  } catch {
    /* ignore */
  }
}

class Sync {
  private adapter: SyncAdapter = localAdapter;
  private adapterReady: Promise<SyncAdapter> | null = null;
  private room: Room | null = null;
  private status: SyncStatus = 'solo';
  private myRoles: Role[] = [...ROLES];
  /** True once this player has picked roles in the current room: from then on this device owns its own roles. */
  private rolesChosen = false;
  private me = loadPlayer();
  private unsub: (() => void) | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  /** Latest unsent write per role, resent on reconnect. */
  private queue = new Map<Role, DesignSection>();
  private flushing = false;

  private roomListeners = new Set<Listener<Room>>();
  private statusListeners = new Set<Listener<SyncStatus>>();
  private eventListeners = new Set<Listener<SyncEvent>>();

  // ---------- read ----------
  get playerId() {
    return this.me.id;
  }
  get playerName() {
    return this.me.name;
  }
  get backend() {
    return this.adapter.name;
  }
  getRoom(): Room | null {
    return this.room ? structuredClone(this.room) : null;
  }
  getStatus(): SyncStatus {
    return this.status;
  }
  getMyRoles(): Role[] {
    return [...this.myRoles];
  }
  /**
   * Roles this player may act for: their own, plus any role no online player
   * holds (a team of 2 or 3 shares the empty roles, like the shared screen).
   */
  getActingRoles(): Role[] {
    const room = this.room;
    if (!room || this.status === 'solo') return [...ROLES];
    const held = new Set(room.players.filter((p) => p.id !== this.me.id && isOnline(p)).flatMap((p) => p.roles));
    return ROLES.filter((r) => this.myRoles.includes(r) || !held.has(r));
  }

  /** The step the whole room is on. */
  getStep(): Phase {
    return this.room?.phase ?? 'lobby';
  }

  /**
   * Player id of whoever moves the room on (Next, Launch, Re-fly): the online
   * player holding the step's leader role (Mission Planner). If nobody holds
   * it, the host leads, or the first online player if the host has left.
   */
  leaderId(): string | null {
    const room = this.room;
    if (!room) return null;
    if (this.status === 'solo') return this.me.id;
    const online = room.players.filter((p) => p.id === this.me.id || isOnline(p));
    const leadRole = stepInfo(room.phase).leader;
    const holder = online.find((p) => p.roles.includes(leadRole));
    if (holder) return holder.id;
    if (online.some((p) => p.id === room.hostId)) return room.hostId;
    return [...online].sort((a, b) => a.id.localeCompare(b.id))[0]?.id ?? null;
  }

  isLeader(): boolean {
    return this.leaderId() === this.me.id || (this.room !== null && canLead(this.getStep(), this.myRoles));
  }

  /** May this device change that role's part right now? Follows Member 1's flow rules. */
  canEdit(role: Role): boolean {
    if (!this.room || this.status === 'solo') return true;
    return canEditSection(this.room.phase, this.getActingRoles(), role);
  }

  // ---------- subscribe ----------
  onRoomChange(fn: Listener<Room>) {
    this.roomListeners.add(fn);
    if (this.room) fn(structuredClone(this.room));
    return () => this.roomListeners.delete(fn);
  }
  onStatus(fn: Listener<SyncStatus>) {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }
  onEvent(fn: Listener<SyncEvent>) {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  // ---------- rooms ----------
  /** Single player on this device. Never touches the network. */
  startSolo(scenario = 'wildfire-watch'): Room {
    this.leaveRoom();
    this.adapter = localAdapter;
    const saved = this.loadAutosave();
    this.myRoles = [...ROLES];
    this.room =
      saved && saved.code === 'SOLO' && saved.scenario === scenario
        ? saved
        : this.newRoom('SOLO', scenario, [{ id: this.me.id, name: this.me.name, roles: [...ROLES], lastSeen: Date.now() }]);
    this.setStatus('solo');
    this.emitRoom();
    return this.getRoom()!;
  }

  /** Create a team room. Returns the room code to share. Falls back to solo on failure. */
  async createRoom(name: string, scenario = 'wildfire-watch'): Promise<string> {
    this.setName(name);
    this.leaveRoom();
    this.setStatus('connecting');
    const adapter = await this.getAdapter();
    const me: Player = { id: this.me.id, name: this.me.name, roles: [], lastSeen: Date.now() };
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode(4);
      try {
        const created = await adapter.createRoom(this.newRoom(code, scenario, [me]));
        if (created) {
          await this.attach(code);
          return code;
        }
      } catch (err) {
        this.fallBackToSolo(scenario, err);
        throw err;
      }
    }
    const err = new Error('Could not find a free room code, try again');
    this.fallBackToSolo(scenario, err);
    throw err;
  }

  /** Join an existing room by code. Throws if the code is invalid or not found. */
  async joinRoom(rawCode: string, name: string): Promise<Room> {
    const code = normaliseCode(rawCode);
    if (!isValidCode(code)) throw new Error('Room codes are 4 to 6 letters or numbers');
    this.setName(name);
    this.leaveRoom();
    this.setStatus('connecting');
    const adapter = await this.getAdapter();
    let room: Room | null;
    try {
      room = await adapter.getRoom(code);
    } catch (err) {
      this.setStatus('offline');
      this.emit({ type: 'error', message: 'Could not reach the team server. Playing solo, team sync unavailable.' });
      throw err;
    }
    if (!room) {
      this.setStatus('solo');
      throw new Error(`No room called ${code}`);
    }
    // Keep roles if rejoining after a refresh.
    const existing = room.players.find((p) => p.id === this.me.id);
    await adapter.upsertPlayer(code, { id: this.me.id, name: this.me.name, roles: existing?.roles ?? [], lastSeen: Date.now() });
    await this.attach(code);
    return this.getRoom()!;
  }

  /** Pick which roles this player holds. Roles already taken by an online player are refused. */
  async chooseRoles(roles: Role[]): Promise<Role[]> {
    const room = this.requireRoom();
    if (this.status === 'solo') {
      this.myRoles = [...ROLES];
      return this.myRoles;
    }
    const takenByOthers = new Set(
      room.players.filter((p) => p.id !== this.me.id && isOnline(p)).flatMap((p) => p.roles),
    );
    const granted = roles.filter((r) => !takenByOthers.has(r));
    this.myRoles = granted;
    this.rolesChosen = true;
    const meNow: Player = { id: this.me.id, name: this.me.name, roles: granted, lastSeen: Date.now() };
    // Show the choice here straight away; the server copy can arrive a moment later.
    room.players = [...room.players.filter((p) => p.id !== this.me.id), meNow];
    this.emitRoom();
    await this.adapter.upsertPlayer(room.code, meNow);
    return granted;
  }

  /** After a page refresh, rejoin the room this tab was in. Returns false if there was none. */
  async resume(): Promise<boolean> {
    let code: string | null = null;
    try {
      code = sessionStorage.getItem(LAST_ROOM_KEY);
    } catch {
      /* ignore */
    }
    if (!code) return false;
    try {
      await this.joinRoom(code, this.me.name);
      return true;
    } catch {
      return false;
    }
  }

  leaveRoom() {
    try {
      sessionStorage.removeItem(LAST_ROOM_KEY);
    } catch {
      /* ignore */
    }
    const room = this.room;
    this.unsub?.();
    this.unsub = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.queue.clear();
    this.rolesChosen = false;
    this.myRoles = [...ROLES];
    if (room && room.code !== 'SOLO' && this.status !== 'solo') {
      this.adapter.removePlayer(room.code, this.me.id).catch(() => {});
    }
    this.room = null;
  }

  // ---------- design ----------
  /**
   * Replace this role's part of the design. The UI updates instantly; the
   * write goes to the server in the background. Clears every approval.
   */
  async updateDesign(role: Role, data: Record<string, unknown>): Promise<void> {
    const room = this.requireRoom();
    const cur = room.sections[role];
    const refusal = this.refusalFor(room, role, cur, data);
    if (refusal) {
      this.emit({ type: 'edit-refused', role, step: room.phase, message: refusal });
      throw new EditRefusedError(refusal, role, room.phase);
    }
    const next: DesignSection = {
      ...cur,
      data: structuredClone(data),
      version: cur.version + 1,
      dataVersion: cur.dataVersion + 1,
      updatedBy: this.me.id,
      updatedAt: Date.now(),
      approvedKey: null,
    };
    await this.commit(next, cur.version);
  }

  /** Press Approve (or Hold) for one of your roles. */
  async setApproved(role: Role, approved: boolean): Promise<void> {
    const room = this.requireRoom();
    if (this.status !== 'solo' && !this.getActingRoles().includes(role)) return;
    const cur = room.sections[role];
    const next: DesignSection = {
      ...cur,
      version: cur.version + 1,
      updatedBy: this.me.id,
      updatedAt: Date.now(),
      approvedKey: approved ? designKey(room) : null,
    };
    await this.commit(next, cur.version);
  }

  /**
   * Move the whole room to another step. Only the leader may (see leaderId).
   * Entering launch starts a new flight: a new seed and no event choices yet.
   * Returns false if refused.
   */
  async setPhase(phase: Phase): Promise<boolean> {
    const room = this.requireRoom();
    if (this.status !== 'solo' && !this.isLeader()) {
      this.emit({ type: 'error', message: `Only the ${stepInfo(room.phase).leader === 'planner' ? 'Mission Planner' : 'team leader'} moves the team on.` });
      return false;
    }
    const fields: Partial<Pick<Room, 'phase' | 'seed' | 'choices'>> = { phase };
    if (phase === 'launch' && room.phase !== 'launch') {
      fields.seed = Math.floor(Math.random() * 1e9);
      fields.choices = {};
    }
    Object.assign(room, fields);
    this.emitRoom();
    if (this.status === 'solo') {
      this.saveAutosave();
      return true;
    }
    await this.adapter.setRoomFields(room.code, fields).catch((e) => this.handleNetError(e));
    return true;
  }

  /**
   * Record the answer to a flight event so every device applies the same one.
   * Only a player acting for the event's owner role may answer.
   */
  async setChoice(eventId: string, choiceId: string, ownerRole: Role): Promise<boolean> {
    const room = this.requireRoom();
    if (this.status !== 'solo' && !this.getActingRoles().includes(ownerRole)) return false;
    if (room.choices[eventId]) return room.choices[eventId] === choiceId;
    room.choices = { ...room.choices, [eventId]: choiceId };
    this.emitRoom();
    if (this.status === 'solo') return true;
    try {
      // Merge with the server copy so two quick answers never overwrite each other.
      const latest = await this.adapter.getRoom(room.code);
      const choices = { ...(latest?.choices ?? {}), ...room.choices };
      await this.adapter.setRoomFields(room.code, { choices });
    } catch (e) {
      this.handleNetError(e);
    }
    return true;
  }

  async setSeed(seed: number): Promise<void> {
    const room = this.requireRoom();
    room.seed = seed;
    this.emitRoom();
    if (this.status !== 'solo') await this.adapter.setRoomFields(room.code, { seed }).catch((e) => this.handleNetError(e));
  }

  // ---------- internals ----------
  /** Why this write is not allowed now, or null if it is. */
  private refusalFor(room: Room, role: Role, cur: DesignSection, data: Record<string, unknown>): string | null {
    if (this.status === 'solo') return null;
    const acting = this.getActingRoles();
    if (!acting.includes(role)) return `Only the ${ROLE_NAMES[role]} can change that part.`;
    // Approve/Hold travels inside the section (see teamBridge.ts); it is allowed outside the flight.
    if (sameExceptApproval(cur.data, data, role, room.scenario)) {
      return room.phase === 'launch' || room.phase === 'simulate' ? 'The design is locked during the flight.' : null;
    }
    // The host fills in the room's starting design right after creating it.
    if (room.phase === 'lobby' && cur.version === 0 && room.hostId === this.me.id) return null;
    if (canEditSection(room.phase, acting, role)) return null;
    const step = stepInfo(room.phase);
    if (room.phase === 'launch' || room.phase === 'simulate') return 'The design is locked during the flight.';
    return step.editors.length
      ? `In ${step.label} only the ${step.editors.map((r) => ROLE_NAMES[r]).join(', ')} can make changes.`
      : `No design changes in ${step.label}. Wait for the Mission Planner to move the team on.`;
  }

  private async commit(next: DesignSection, expectedVersion: number) {
    const room = this.requireRoom();
    room.sections[next.role] = next; // optimistic
    this.emitRoom();
    if (this.status === 'solo') {
      this.saveAutosave();
      return;
    }
    try {
      await this.adapter.writeSection(room.code, next, expectedVersion);
    } catch (err) {
      if (err instanceof ConflictError) {
        const latest = err.latest ?? (await this.adapter.getRoom(room.code))?.sections[next.role];
        if (latest && this.room) {
          this.room.sections[next.role] = latest;
          this.emitRoom();
        }
        this.emit({
          type: 'conflict',
          role: next.role,
          message: 'Someone else changed this part at the same time. Their version is shown; make your change again.',
          latest: latest ?? next,
        });
      } else {
        this.queue.set(next.role, next);
        this.handleNetError(err);
      }
    }
  }

  private handleNetError(err: unknown) {
    console.warn('[sync] network error', err);
    if (this.status !== 'solo') this.setStatus('reconnecting');
    this.flushQueue();
  }

  /** Resend queued writes with backoff 1s, 2s, 4s ... 30s. */
  private async flushQueue() {
    if (this.flushing) return;
    this.flushing = true;
    let delay = 1000;
    while (this.queue.size && this.room && this.status !== 'solo') {
      await sleep(delay);
      const room = this.room;
      if (!room) break;
      try {
        const latest = await this.adapter.getRoom(room.code);
        for (const [role, sec] of [...this.queue]) {
          const server = latest?.sections[role];
          const base = server?.version ?? 0;
          await this.adapter.writeSection(room.code, { ...sec, version: base + 1 }, base);
          this.queue.delete(role);
        }
        this.setStatus('connected');
        delay = 1000;
      } catch (err) {
        if (err instanceof ConflictError) continue; // re-read and retry immediately
        delay = Math.min(delay * 2, 30_000);
        this.setStatus('reconnecting');
      }
    }
    this.flushing = false;
  }

  private async attach(code: string) {
    const adapter = this.adapter;
    try {
      sessionStorage.setItem(LAST_ROOM_KEY, code);
    } catch {
      /* ignore */
    }
    this.unsub = adapter.subscribe(
      code,
      (incoming) => this.receive(incoming),
      (s) => {
        this.setStatus(s);
        if (s === 'connected') this.flushQueue();
      },
    );
    const first = await adapter.getRoom(code);
    if (first) this.receive(first);
    this.heartbeat = setInterval(() => {
      if (!this.room) return;
      adapter
        .upsertPlayer(code, { id: this.me.id, name: this.me.name, roles: this.myRoles, lastSeen: Date.now() })
        .catch(() => {});
    }, HEARTBEAT_MS);
  }

  private receive(raw: Room) {
    const incoming = sanitiseRoom(raw);
    if (!incoming) return;
    const prev = this.room;
    // Keep my unsent edits on top of what the server says.
    for (const [role, sec] of this.queue) incoming.sections[role] = sec;
    // Keep my optimistic write if the server copy is older.
    if (prev) {
      for (const r of ROLES) {
        if (prev.sections[r].updatedBy === this.me.id && prev.sections[r].version > incoming.sections[r].version) {
          incoming.sections[r] = prev.sections[r];
        }
      }
    }
    const me = incoming.players.find((p) => p.id === this.me.id);
    if (this.rolesChosen) {
      // A late copy of my own row (for example from before I picked a role) must not undo my choice.
      if (me) me.roles = [...this.myRoles];
      else incoming.players.push({ id: this.me.id, name: this.me.name, roles: [...this.myRoles], lastSeen: Date.now() });
    } else if (me) this.myRoles = me.roles;

    if (prev) this.diff(prev, incoming);
    this.room = incoming;
    this.emitRoom();
  }

  private diff(prev: Room, next: Room) {
    const nameOf = (id: string) => next.players.find((p) => p.id === id)?.name ?? 'A teammate';
    for (const r of ROLES) {
      const a = prev.sections[r];
      const b = next.sections[r];
      if (b.dataVersion > a.dataVersion && b.updatedBy !== this.me.id) {
        this.emit({ type: 'remote-change', role: r, by: b.updatedBy, byName: nameOf(b.updatedBy), section: b });
        if (ROLES.some((x) => prev.sections[x].approvedKey === designKey(prev))) {
          this.emit({ type: 'approvals-reset', by: b.updatedBy, byName: nameOf(b.updatedBy), role: r });
        }
      }
    }
    const before = new Set(prev.players.map((p) => p.id));
    const after = new Set(next.players.map((p) => p.id));
    next.players.filter((p) => !before.has(p.id)).forEach((player) => this.emit({ type: 'player-joined', player }));
    prev.players.filter((p) => !after.has(p.id)).forEach((player) => this.emit({ type: 'player-left', player }));
  }

  private fallBackToSolo(scenario: string, err: unknown) {
    console.warn('[sync] falling back to solo', err);
    this.startSolo(scenario);
    this.emit({ type: 'error', message: 'Playing solo, team sync unavailable.' });
  }

  private newRoom(code: string, scenario: string, players: Player[]): Room {
    return {
      code,
      scenario,
      phase: 'lobby',
      choices: {},
      hostId: this.me.id,
      players,
      sections: emptySections(this.me.id),
      seed: Math.floor(Math.random() * 1e9),
      updatedAt: Date.now(),
    };
  }

  private async getAdapter() {
    if (!this.adapterReady) this.adapterReady = pickAdapter();
    this.adapter = await this.adapterReady;
    return this.adapter;
  }

  private setName(name: string) {
    this.me = { ...this.me, name: name.trim().slice(0, 24) || 'Player' };
    savePlayer(this.me);
  }

  private requireRoom(): Room {
    if (!this.room) this.startSolo();
    return this.room!;
  }

  private setStatus(s: SyncStatus) {
    if (s === this.status) return;
    this.status = s;
    this.statusListeners.forEach((fn) => fn(s));
  }

  private emit(e: SyncEvent) {
    this.eventListeners.forEach((fn) => fn(e));
  }

  private emitRoom() {
    if (!this.room) return;
    this.saveAutosave();
    const copy = structuredClone(this.room);
    this.roomListeners.forEach((fn) => fn(copy));
  }

  private saveAutosave() {
    try {
      if (this.room) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(this.room));
    } catch {
      /* ignore */
    }
  }

  private loadAutosave(): Room | null {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      return raw ? sanitiseRoom(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
}

/** The one shared sync instance. */
export const sync = new Sync();
