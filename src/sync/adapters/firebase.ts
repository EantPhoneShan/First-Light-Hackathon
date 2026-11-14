/**
 * Firebase adapter (Plan B): Realtime Database on the free Spark plan.
 * Config comes from VITE_FIREBASE_* env vars (see .env.example).
 *
 * Data layout:
 *   rooms/{code}/meta              { code, scenario, phase, hostId, seed }
 *   rooms/{code}/players/{id}      Player
 *   rooms/{code}/sections/{role}   DesignSection
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  runTransaction,
  onDisconnect,
  type Database,
} from 'firebase/database';
import type { DesignSection, Room, SyncAdapter, SyncStatus } from '../types';
import { ConflictError } from '../types';
import { sanitiseRoom } from '../util';

let app: FirebaseApp | null = null;
let db: Database | null = null;
let authReady: Promise<unknown> | null = null;

function init(): Database {
  if (db) return db;
  const env = import.meta.env;
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.databaseURL) throw new Error('Firebase env vars missing (VITE_FIREBASE_*)');
  app = initializeApp(config);
  db = getDatabase(app);
  // Anonymous sign-in so database rules can require auth != null. Ignore if disabled.
  authReady = signInAnonymously(getAuth(app)).catch((e) => console.warn('[sync:firebase] anonymous auth failed', e));
  return db;
}

function toRoom(code: string, v: Record<string, unknown> | null): Room | null {
  if (!v || !v.meta) return null;
  const meta = v.meta as Record<string, unknown>;
  return sanitiseRoom({
    ...meta,
    code,
    players: Object.values((v.players as object) ?? {}),
    sections: (v.sections as object) ?? {},
  });
}

export function firebaseAdapter(): SyncAdapter {
  const d = init();
  const ready = () => authReady ?? Promise.resolve();

  return {
    name: 'firebase',

    async createRoom(room) {
      await ready();
      const metaRef = ref(d, `rooms/${room.code}/meta`);
      const res = await runTransaction(metaRef, (cur) =>
        cur ? undefined : { code: room.code, scenario: room.scenario, phase: room.phase, hostId: room.hostId, seed: room.seed, createdAt: Date.now() },
      );
      if (!res.committed) return null;
      await Promise.all(room.players.map((p) => set(ref(d, `rooms/${room.code}/players/${p.id}`), p)));
      return room;
    },

    async getRoom(code) {
      await ready();
      const snap = await get(ref(d, `rooms/${code}`));
      return toRoom(code, snap.val());
    },

    async upsertPlayer(code, p) {
      await ready();
      const r = ref(d, `rooms/${code}/players/${p.id}`);
      await set(r, p);
      onDisconnect(r).remove().catch(() => {});
    },

    async removePlayer(code, playerId) {
      await remove(ref(d, `rooms/${code}/players/${playerId}`));
    },

    async writeSection(code, s: DesignSection, expectedVersion) {
      await ready();
      const r = ref(d, `rooms/${code}/sections/${s.role}`);
      let latest: DesignSection | undefined;
      // Atomic version check on the server.
      const res = await runTransaction(r, (cur: DesignSection | null) => {
        const v = cur?.version ?? 0;
        if (v !== expectedVersion) {
          latest = cur ?? undefined;
          return; // abort
        }
        return s;
      });
      if (!res.committed) throw new ConflictError(`${s.role} was changed by someone else`, latest);
    },

    async setRoomFields(code, fields) {
      await update(ref(d, `rooms/${code}/meta`), fields);
    },

    subscribe(code, onRoom, onStatus: (s: SyncStatus) => void) {
      onStatus('connecting');
      const offRoom = onValue(
        ref(d, `rooms/${code}`),
        (snap) => {
          const room = toRoom(code, snap.val());
          if (room) onRoom(room);
        },
        (err) => {
          console.warn('[sync:firebase]', err);
          onStatus('offline');
        },
      );
      const offConn = onValue(ref(d, '.info/connected'), (snap) => onStatus(snap.val() ? 'connected' : 'reconnecting'));
      return () => {
        offRoom();
        offConn();
      };
    },
  };
}
