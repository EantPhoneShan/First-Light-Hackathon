/**
 * First Light sync contract.
 *
 * Member 1 (logic) and Member 2 (UI) only need this file and `src/sync/index.ts`.
 * The game never talks to AWS or Firebase directly: it calls the functions in
 * index.ts, and the chosen adapter (local, AWS AppSync or Firebase) does the rest.
 */

/** The four team roles. Solo players hold all four. */
export type Role = 'planner' | 'science' | 'engineer' | 'flight';
export const ROLES: Role[] = ['planner', 'science', 'engineer', 'flight'];

export const ROLE_LABELS: Record<Role, string> = {
  planner: 'Mission Planner',
  science: 'Science Lead',
  engineer: 'Spacecraft Engineer',
  flight: 'Flight Dynamics',
};

/** Game phase shared by the whole room. */
export type Phase = 'lobby' | 'design' | 'launch' | 'simulate' | 'report';

export interface Player {
  id: string;
  name: string;
  /** Roles this player holds. One player can hold several when the team is small. */
  roles: Role[];
  /** ms since epoch; used to show who is online. */
  lastSeen: number;
}

/**
 * One role's slice of the spacecraft design. Each role only writes its own
 * section, so two roles can never overwrite each other.
 *
 * `data` is whatever Member 1's design format says that role owns, for example:
 *   planner:  { goals, budgetCap }
 *   science:  { instruments: [...] }
 *   engineer: { bus, power: [...], comms: [...] }
 *   flight:   { orbit, launchVehicle }
 */
export interface DesignSection<T = Record<string, unknown>> {
  role: Role;
  data: T;
  /** Goes up by one on every write (data or approval). Used to detect stale writes. */
  version: number;
  /** Goes up by one only when `data` changes. */
  dataVersion: number;
  updatedBy: string; // player id
  updatedAt: number;
  /**
   * Design key (see designKey() in index.ts) at the moment this role pressed
   * Approve, or null. An approval only counts while it matches the current
   * key, so any design change by anyone clears every approval automatically,
   * without one role ever writing another role's section.
   */
  approvedKey: string | null;
}

export interface Room {
  code: string; // 4–6 uppercase letters/digits, e.g. "K7QF"
  scenario: string; // e.g. "wildfire-watch"
  phase: Phase;
  hostId: string;
  players: Player[];
  sections: Record<Role, DesignSection>;
  /** Shared seed so every device runs the same random events. */
  seed: number;
  updatedAt: number;
}

/** connected = live team sync; solo = playing alone on this device on purpose. */
export type SyncStatus = 'solo' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

/** Things the UI should tell the player about. */
export type SyncEvent =
  | { type: 'remote-change'; role: Role; by: string; byName: string; section: DesignSection }
  | { type: 'conflict'; role: Role; message: string; latest: DesignSection }
  | { type: 'approvals-reset'; by: string; byName: string; role: Role }
  | { type: 'player-joined'; player: Player }
  | { type: 'player-left'; player: Player }
  | { type: 'error'; message: string };

/**
 * What every backend must implement. Only adapters implement this; the game
 * uses the functions in index.ts.
 */
export interface SyncAdapter {
  readonly name: 'local' | 'aws' | 'firebase';
  /** Create a room record, or return null if the code is taken. */
  createRoom(room: Room): Promise<Room | null>;
  /** Read a room, or null if it does not exist. */
  getRoom(code: string): Promise<Room | null>;
  upsertPlayer(code: string, player: Player): Promise<void>;
  removePlayer(code: string, playerId: string): Promise<void>;
  /**
   * Write one section. Must fail with ConflictError if the stored version is
   * not `expectedVersion` (when the backend can check it).
   */
  writeSection(code: string, section: DesignSection, expectedVersion: number): Promise<void>;
  setRoomFields(code: string, fields: Partial<Pick<Room, 'phase' | 'scenario' | 'seed'>>): Promise<void>;
  /** Subscribe to the full room. Returns an unsubscribe function. */
  subscribe(code: string, onRoom: (room: Room) => void, onStatus: (s: SyncStatus) => void): () => void;
}

export class ConflictError extends Error {
  latest?: DesignSection;
  constructor(message: string, latest?: DesignSection) {
    super(message);
    this.name = 'ConflictError';
    this.latest = latest;
  }
}
