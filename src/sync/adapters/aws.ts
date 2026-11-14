/**
 * AWS adapter: AppSync (GraphQL + real-time subscriptions) over DynamoDB,
 * created by Amplify Gen 2 from amplify/data/resource.ts.
 *
 * Needs amplify_outputs.json in the project root. `npx ampx sandbox` writes it
 * for local dev, and Amplify Hosting writes it during each build.
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { Hub } from 'aws-amplify/utils';
import { CONNECTION_STATE_CHANGE, ConnectionState } from 'aws-amplify/api';
import type { DesignSection, Player, Role, Room, SyncAdapter, SyncStatus } from '../types';
import { ConflictError, ROLES } from '../types';
import { emptySections, sanitiseRoom } from '../util';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const outputs = import.meta.glob('../../../amplify_outputs.json', { eager: true, import: 'default' });

let client: Any = null;

function getClient(): Any {
  if (client) return client;
  const config = Object.values(outputs)[0];
  if (!config) throw new Error('amplify_outputs.json not found: run `npx ampx sandbox` or deploy with Amplify Hosting');
  Amplify.configure(config as Any);
  client = generateClient();
  return client;
}

function check<T>(res: { data: T; errors?: { message: string }[] }): T {
  if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join('; '));
  return res.data;
}

const parseJson = (v: unknown) => {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return {};
    }
  }
  return v ?? {};
};

function toSection(row: Any): DesignSection {
  return {
    role: row.role as Role,
    data: parseJson(row.data),
    version: row.version ?? 0,
    dataVersion: row.dataVersion ?? 0,
    updatedBy: row.updatedBy ?? '',
    updatedAt: row.updatedAt ?? 0,
    approvedKey: row.approvedKey ?? null,
  };
}

function toPlayer(row: Any): Player {
  return { id: row.playerId, name: row.name ?? 'Player', roles: (row.roles ?? []) as Role[], lastSeen: row.lastSeen ?? 0 };
}

function assemble(roomRow: Any, players: Any[], sections: Any[]): Room | null {
  if (!roomRow) return null;
  const secs = emptySections();
  for (const s of sections) if (ROLES.includes(s.role)) secs[s.role as Role] = toSection(s);
  return sanitiseRoom({
    code: roomRow.code,
    scenario: roomRow.scenario,
    phase: roomRow.phase,
    hostId: roomRow.hostId,
    seed: roomRow.seed,
    choices: roomRow.choices,
    players: players.map(toPlayer),
    sections: secs,
    updatedAt: Date.now(),
  });
}

async function fetchRoom(code: string): Promise<Room | null> {
  const c = getClient();
  const [room, players, sections] = await Promise.all([
    c.models.Room.get({ code }),
    c.models.Player.list({ roomCode: code }),
    c.models.Section.list({ roomCode: code }),
  ]);
  return assemble(check(room), check(players) ?? [], check(sections) ?? []);
}

export function awsAdapter(): SyncAdapter {
  getClient(); // fail fast if not configured, so index.ts falls back to local

  return {
    name: 'aws',

    async createRoom(room) {
      const c = getClient();
      const existing = check(await c.models.Room.get({ code: room.code }));
      if (existing) return null;
      check(
        await c.models.Room.create({
          code: room.code,
          scenario: room.scenario,
          phase: room.phase,
          hostId: room.hostId,
          seed: room.seed,
          choices: JSON.stringify(room.choices ?? {}),
        }),
      );
      await Promise.all(room.players.map((p) => this.upsertPlayer(room.code, p)));
      return room;
    },

    getRoom: fetchRoom,

    async upsertPlayer(code, p) {
      const c = getClient();
      const row = { roomCode: code, playerId: p.id, name: p.name, roles: p.roles, lastSeen: p.lastSeen };
      const res = await c.models.Player.update(row);
      if (!res.data) check(await c.models.Player.create(row));
    },

    async removePlayer(code, playerId) {
      await getClient().models.Player.delete({ roomCode: code, playerId });
    },

    async writeSection(code, s, expectedVersion) {
      const c = getClient();
      // Read-then-write version check. Each role is held by one player, so a
      // clash only happens if the same role is open on two devices.
      const current: Any = check(await c.models.Section.get({ roomCode: code, role: s.role }));
      const curVersion = current?.version ?? 0;
      if (curVersion !== expectedVersion) {
        throw new ConflictError(`${s.role} was changed by someone else`, current ? toSection(current) : undefined);
      }
      const row = {
        roomCode: code,
        role: s.role,
        data: JSON.stringify(s.data),
        version: s.version,
        dataVersion: s.dataVersion,
        updatedBy: s.updatedBy,
        updatedAt: s.updatedAt,
        approvedKey: s.approvedKey,
      };
      check(current ? await c.models.Section.update(row) : await c.models.Section.create(row));
    },

    async setRoomFields(code, fields) {
      // choices is an AWSJSON field: send it as a JSON string like section data.
      const row: Any = { code, ...fields };
      if (fields.choices !== undefined) row.choices = JSON.stringify(fields.choices);
      check(await getClient().models.Room.update(row));
    },

    subscribe(code, onRoom, onStatus: (s: SyncStatus) => void) {
      const c = getClient();
      let roomRow: Any = null;
      let players: Any[] = [];
      let sections: Any[] = [];
      let ready = { room: false, players: false, sections: false };
      let announced = false;
      let catchUp: ReturnType<typeof setTimeout> | undefined;
      const push = () => {
        if (!ready.room || !ready.players || !ready.sections) return;
        if (!announced) {
          announced = true;
          onStatus('connected');
          // A change made while the live feed was starting can be missed; read once more to catch it.
          catchUp = setTimeout(() => fetchRoom(code).then((r) => r && onRoom(r)).catch(() => {}), 2000);
        }
        const r = assemble(roomRow, players, sections);
        if (r) onRoom(r);
      };
      const fail = (err: unknown) => {
        console.warn('[sync:aws] subscription error', err);
        onStatus('reconnecting');
      };

      onStatus('connecting');
      const subs = [
        c.models.Room.observeQuery({ filter: { code: { eq: code } } }).subscribe({
          next: ({ items }: Any) => {
            roomRow = items[0] ?? roomRow;
            ready.room = true;
            push();
          },
          error: fail,
        }),
        c.models.Player.observeQuery({ filter: { roomCode: { eq: code } } }).subscribe({
          next: ({ items }: Any) => {
            players = items;
            ready.players = true;
            push();
          },
          error: fail,
        }),
        c.models.Section.observeQuery({ filter: { roomCode: { eq: code } } }).subscribe({
          next: ({ items }: Any) => {
            sections = items;
            ready.sections = true;
            push();
          },
          error: fail,
        }),
      ];

      const stopHub = Hub.listen('api', ({ payload }: Any) => {
        if (payload.event !== CONNECTION_STATE_CHANGE) return;
        const st = payload.data.connectionState as ConnectionState;
        if (st === ConnectionState.Connected) {
          onStatus('connected');
          // Catch up on anything missed while disconnected.
          fetchRoom(code).then((r) => r && onRoom(r)).catch(() => {});
        } else if (st === ConnectionState.Connecting) onStatus('connecting');
        else if (st === ConnectionState.ConnectionDisrupted || st === ConnectionState.ConnectionDisruptedPendingNetwork)
          onStatus('reconnecting');
        else if (st === ConnectionState.Disconnected) onStatus('offline');
      });

      return () => {
        clearTimeout(catchUp);
        subs.forEach((s) => s.unsubscribe());
        stopHub();
        ready = { room: false, players: false, sections: false };
      };
    },
  };
}
