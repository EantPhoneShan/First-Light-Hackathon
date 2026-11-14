/**
 * Save and share codes (PRD F19): a whole design as one short text code.
 *
 *   const code = encodeDesign('wildfire-watch', design);   // "FL1.wildfire-watch.eyJ...x.5k2f"
 *   const got = decodeDesign(code, gameData);               // { scenarioId, design } or null
 *
 * The code is versioned (FL1) and ends in a checksum, so a mistyped or edited
 * code is refused instead of loading something strange. Decoding always goes
 * through normalizeDesign(), so even a hand-made code can't break the game.
 * Local saving (localStorage) is up to the UI; this is just the format.
 */
import { normalizeDesign } from './design';
import { hashSeed } from './events';
import type { Design, GameData } from './types';

const VERSION = 'FL1';

/** Short keys keep codes short enough to paste in a chat. */
function pack(d: Design): unknown[] {
  return [
    [d.planner.weights.coverage, d.planner.weights.detail, d.planner.weights.lifetime, d.planner.disposal],
    [d.science.goalId, d.science.measurementId, d.science.instrumentIds],
    [d.engineer.busId, d.engineer.partIds],
    [d.flight.orbitId, d.flight.altitudeKm, d.flight.launcherId, d.flight.antennaIds, d.flight.stationIds],
  ];
}

function unpack(raw: unknown): Design | null {
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every(Array.isArray)) return null;
  const [p, s, e, f] = raw as unknown[][];
  return normalizeDesign({
    planner: { weights: { coverage: p[0], detail: p[1], lifetime: p[2] }, disposal: p[3] },
    science: { goalId: s[0], measurementId: s[1], instrumentIds: s[2] },
    engineer: { busId: e[0], partIds: e[1] },
    flight: { orbitId: f[0], altitudeKm: f[1], launcherId: f[2], antennaIds: f[3], stationIds: f[4] },
  });
}

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

const checksum = (body: string) => hashSeed(0, body).toString(36).slice(0, 4);

export function encodeDesign(scenarioId: string, design: Design): string {
  const body = `${VERSION}.${scenarioId}.${toBase64Url(JSON.stringify(pack(design)))}`;
  return `${body}.${checksum(body)}`;
}

/** Reads a share code. Returns null for anything that isn't a valid code for a known scenario. */
export function decodeDesign(code: string, data: GameData): { scenarioId: string; design: Design } | null {
  const trimmed = code.trim();
  if (trimmed.length > 4000) return null;
  const parts = trimmed.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const [, scenarioId, payload, check] = parts;
  if (checksum(`${parts[0]}.${scenarioId}.${payload}`) !== check) return null;
  if (!data.scenarios.some((s) => s.id === scenarioId)) return null;
  try {
    const design = unpack(JSON.parse(fromBase64Url(payload)));
    return design ? { scenarioId, design } : null;
  } catch {
    return null;
  }
}

/** True when two designs are the same build (for "you already flew this"). */
export function sameDesign(a: Design, b: Design): boolean {
  return JSON.stringify(pack(normalizeDesign(a as never))) === JSON.stringify(pack(normalizeDesign(b as never)));
}
