/**
 * Local adapter: no cloud. Rooms live in this browser's localStorage and other
 * tabs on the same browser are told about changes over BroadcastChannel.
 * Used for solo play, offline play and testing team mode with several tabs.
 *
 * Like the cloud tables, each part of a room is stored on its own key
 * (room info, one key per player, one key per role's section), so a tab's
 * presence ping can never overwrite another tab's step change or edit.
 *   first-light:room:{code}            { code, scenario, phase, hostId, seed, choices }
 *   first-light:room:{code}:p:{id}     Player
 *   first-light:room:{code}:s:{role}   DesignSection
 */
import type { DesignSection, Player, Room, SyncAdapter, SyncStatus } from '../types';
import { ConflictError, ROLES } from '../types';
import { sanitiseRoom } from '../util';

const KEY = (code: string) => `first-light:room:${code}`;
const PLAYER = (code: string, id: string) => `${KEY(code)}:p:${id}`;
const SECTION = (code: string, role: string) => `${KEY(code)}:s:${role}`;
const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('first-light-sync') : null;

// Small key-value layer over localStorage, with an in-memory fallback when storage is blocked.
const memory = new Map<string, string>();
const store = {
  get(k: string): unknown {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(k);
    } catch {
      raw = memory.get(k) ?? null;
    }
    if (raw === null) raw = memory.get(k) ?? null;
    try {
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    const raw = JSON.stringify(v);
    memory.set(k, raw);
    try {
      localStorage.setItem(k, raw);
    } catch {
      /* storage blocked: memory only */
    }
  },
  del(k: string) {
    memory.delete(k);
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
  keys(prefix: string): string[] {
    const out = new Set<string>();
    for (const k of memory.keys()) if (k.startsWith(prefix)) out.add(k);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(prefix)) out.add(k);
      }
    } catch {
      /* ignore */
    }
    return [...out];
  },
};

function read(code: string): Room | null {
  const meta = store.get(KEY(code)) as Record<string, unknown> | null;
  if (!meta) return null;
  const players = store.keys(`${KEY(code)}:p:`).map((k) => store.get(k)).filter(Boolean);
  const sections: Record<string, unknown> = {};
  for (const r of ROLES) {
    const s = store.get(SECTION(code, r));
    if (s) sections[r] = s;
  }
  return sanitiseRoom({ ...meta, players, sections });
}

const localListeners = new Map<string, Set<(r: Room) => void>>();

function changed(code: string) {
  channel?.postMessage({ code });
  const r = read(code);
  if (r) localListeners.get(code)?.forEach((fn) => fn(structuredClone(r)));
}

function requireRoom(code: string) {
  if (!store.get(KEY(code))) throw new Error(`Room ${code} not found`);
}

export const localAdapter: SyncAdapter = {
  name: 'local',
  async createRoom(room) {
    if (store.get(KEY(room.code))) return null;
    const { players, sections, ...meta } = room;
    store.set(KEY(room.code), { ...meta, updatedAt: Date.now() });
    for (const p of players) store.set(PLAYER(room.code, p.id), p);
    for (const r of ROLES) store.set(SECTION(room.code, r), sections[r]);
    changed(room.code);
    return room;
  },
  async getRoom(code) {
    return read(code);
  },
  async upsertPlayer(code, player: Player) {
    requireRoom(code);
    store.set(PLAYER(code, player.id), player);
    changed(code);
  },
  async removePlayer(code, playerId) {
    store.del(PLAYER(code, playerId));
    changed(code);
  },
  async writeSection(code, section: DesignSection, expectedVersion) {
    requireRoom(code);
    const cur = store.get(SECTION(code, section.role)) as DesignSection | null;
    if ((cur?.version ?? 0) !== expectedVersion) {
      throw new ConflictError(`${section.role} was changed by someone else`, cur ?? undefined);
    }
    store.set(SECTION(code, section.role), section);
    changed(code);
  },
  async setRoomFields(code, fields) {
    const meta = store.get(KEY(code)) as Record<string, unknown> | null;
    if (!meta) throw new Error(`Room ${code} not found`);
    store.set(KEY(code), { ...meta, ...fields, updatedAt: Date.now() });
    changed(code);
  },
  subscribe(code, onRoom, onStatus: (s: SyncStatus) => void) {
    const fire = () => {
      const r = read(code);
      if (r) onRoom(r);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.data?.code === code) fire();
    };
    // The channel message can arrive before another tab's storage write is visible here;
    // the storage event fires once it is, so read again then.
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(KEY(code))) fire();
    };
    channel?.addEventListener('message', onMsg);
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    let set = localListeners.get(code);
    if (!set) localListeners.set(code, (set = new Set()));
    set.add(onRoom);
    onStatus('connected');
    fire();
    return () => {
      channel?.removeEventListener('message', onMsg);
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
      set!.delete(onRoom);
    };
  },
};
