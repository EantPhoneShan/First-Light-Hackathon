/**
 * Local adapter: no cloud. Rooms live in this browser's localStorage and other
 * tabs on the same browser are told about changes over BroadcastChannel.
 * Used for solo play, offline play and testing team mode with several tabs.
 */
import type { DesignSection, Player, Room, SyncAdapter, SyncStatus } from '../types';
import { ConflictError } from '../types';
import { sanitiseRoom } from '../util';

const KEY = (code: string) => `first-light:room:${code}`;
const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('first-light-sync') : null;

function read(code: string): Room | null {
  try {
    const raw = localStorage.getItem(KEY(code));
    return raw ? sanitiseRoom(JSON.parse(raw)) : null;
  } catch {
    return memory.get(code) ?? null;
  }
}

const memory = new Map<string, Room>();
const localListeners = new Map<string, Set<(r: Room) => void>>();

function write(room: Room) {
  room.updatedAt = Date.now();
  memory.set(room.code, room);
  try {
    localStorage.setItem(KEY(room.code), JSON.stringify(room));
  } catch {
    /* storage blocked: memory only */
  }
  channel?.postMessage({ code: room.code });
  localListeners.get(room.code)?.forEach((fn) => fn(structuredClone(room)));
}

function mutate(code: string, fn: (r: Room) => void) {
  const room = read(code);
  if (!room) throw new Error(`Room ${code} not found`);
  fn(room);
  write(room);
}

export const localAdapter: SyncAdapter = {
  name: 'local',
  async createRoom(room) {
    if (read(room.code)) return null;
    write(room);
    return room;
  },
  async getRoom(code) {
    return read(code);
  },
  async upsertPlayer(code, player: Player) {
    mutate(code, (r) => {
      r.players = [...r.players.filter((p) => p.id !== player.id), player];
    });
  },
  async removePlayer(code, playerId) {
    mutate(code, (r) => {
      r.players = r.players.filter((p) => p.id !== playerId);
    });
  },
  async writeSection(code, section: DesignSection, expectedVersion) {
    mutate(code, (r) => {
      const cur = r.sections[section.role];
      if (cur.version !== expectedVersion) {
        throw new ConflictError(`${section.role} was changed by someone else`, cur);
      }
      r.sections[section.role] = section;
    });
  },
  async setRoomFields(code, fields) {
    mutate(code, (r) => Object.assign(r, fields));
  },
  subscribe(code, onRoom, onStatus: (s: SyncStatus) => void) {
    const fire = () => {
      const r = read(code);
      if (r) onRoom(r);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.data?.code === code) fire();
    };
    channel?.addEventListener('message', onMsg);
    let set = localListeners.get(code);
    if (!set) localListeners.set(code, (set = new Set()));
    set.add(onRoom);
    onStatus('connected');
    fire();
    return () => {
      channel?.removeEventListener('message', onMsg);
      set!.delete(onRoom);
    };
  },
};
