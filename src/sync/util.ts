import type { DesignSection, Role, Room } from './types';
import { ROLES } from './types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function makeRoomCode(len = 4): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidCode(code: string): boolean {
  return /^[A-Z0-9]{4,6}$/.test(code);
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function emptySection(role: Role, by = ''): DesignSection {
  return { role, data: {}, version: 0, dataVersion: 0, updatedBy: by, updatedAt: 0, approvedKey: null };
}

export function emptySections(by = ''): Record<Role, DesignSection> {
  return Object.fromEntries(ROLES.map((r) => [r, emptySection(r, by)])) as Record<Role, DesignSection>;
}

/** Fills any missing or broken fields so bad data never crashes the game. */
export function sanitiseRoom(raw: unknown): Room | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Room>;
  if (typeof r.code !== 'string') return null;
  const sections = emptySections();
  for (const role of ROLES) {
    const s = (r.sections as Record<string, Partial<DesignSection>> | undefined)?.[role];
    if (s && typeof s === 'object') {
      sections[role] = {
        role,
        data: s.data && typeof s.data === 'object' ? (s.data as Record<string, unknown>) : {},
        version: Number(s.version) || 0,
        dataVersion: Number(s.dataVersion) || 0,
        updatedBy: String(s.updatedBy ?? ''),
        updatedAt: Number(s.updatedAt) || 0,
        approvedKey: typeof s.approvedKey === 'string' ? s.approvedKey : null,
      };
    }
  }
  const players = Array.isArray(r.players)
    ? r.players
        .filter((p) => p && typeof p.id === 'string')
        .map((p) => ({
          id: p.id,
          name: String(p.name ?? 'Player').slice(0, 24),
          roles: Array.isArray(p.roles) ? p.roles.filter((x): x is Role => ROLES.includes(x as Role)) : [],
          lastSeen: Number(p.lastSeen) || 0,
        }))
    : [];
  return {
    code: r.code,
    scenario: typeof r.scenario === 'string' ? r.scenario : 'wildfire-watch',
    phase: (['lobby', 'design', 'launch', 'simulate', 'report'] as const).includes(r.phase as never)
      ? (r.phase as Room['phase'])
      : 'lobby',
    hostId: String(r.hostId ?? ''),
    players,
    sections,
    seed: Number(r.seed) || 1,
    updatedAt: Number(r.updatedAt) || 0,
  };
}

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
