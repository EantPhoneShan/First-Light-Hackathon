/**
 * UI-side helpers around Member 1's engine (src/engine). Nothing here computes game rules:
 * it only routes edits to the right role section, names things for the screens, and
 * holds UI-only decisions such as who watches which gauge.
 */
import { findPart, gameData } from '@/engine/data'
import { RESOURCE_WATCHER, type Design, type Part, type PartCategory, type ResourceId, type Role } from '@/engine/types'
import { ROLE_LABELS } from '@/sync/types'

export { gameData }
export const roleNames = ROLE_LABELS
export const ROLE_ORDER: Role[] = ['planner', 'engineer', 'science', 'flight']

/** Which design section a part lives in (matches allPartIds() in engine/design.ts). */
export type PartSection = 'engineer' | 'science' | 'flight'
export const sectionFor = (p: Part): PartSection => (p.category === 'instrument' ? 'science' : p.category === 'antenna' ? 'flight' : 'engineer')

/** Every part on the craft, with duplicates (same order as engine/design.ts allPartIds). */
export function partsOnCraft(d: Design): Part[] {
  return [...d.engineer.partIds, ...d.science.instrumentIds, ...d.flight.antennaIds].map((id) => findPart(gameData, id)).filter((p): p is Part => !!p)
}

/** Add one copy of a part to its section. */
export function withPart(d: Design, p: Part): Design {
  const s = sectionFor(p)
  if (s === 'science') return { ...d, science: { ...d.science, instrumentIds: [...d.science.instrumentIds, p.id] } }
  if (s === 'flight') return { ...d, flight: { ...d.flight, antennaIds: [...d.flight.antennaIds, p.id] } }
  return { ...d, engineer: { ...d.engineer, partIds: [...d.engineer.partIds, p.id] } }
}

/** Remove one copy of a part from its section. */
export function withoutPart(d: Design, p: Part): Design {
  const drop = (ids: string[]) => {
    const i = ids.lastIndexOf(p.id)
    return i < 0 ? ids : [...ids.slice(0, i), ...ids.slice(i + 1)]
  }
  const s = sectionFor(p)
  if (s === 'science') return { ...d, science: { ...d.science, instrumentIds: drop(d.science.instrumentIds) } }
  if (s === 'flight') return { ...d, flight: { ...d.flight, antennaIds: drop(d.flight.antennaIds) } }
  return { ...d, engineer: { ...d.engineer, partIds: drop(d.engineer.partIds) } }
}

export const categoryLabel: Record<PartCategory, string> = {
  solar: 'Solar',
  battery: 'Battery',
  computer: 'Computer',
  adcs: 'Attitude',
  propulsion: 'Propulsion',
  thermal: 'Thermal',
  antenna: 'Radio',
  instrument: 'Instruments',
}

/** Parts that sit outside the body (no slots): drawn on the outside of the craft. */
export const isExternal = (p: Part) => p.slots === 0

/**
 * Who WATCHES each gauge in team play (team decision, 14 Nov): only the watcher sees it,
 * so the Engineer, who builds, has to be told when power or data gets too high.
 * Now lives in Member 1's engine (RESOURCE_WATCHER), which conflictAlerts() also uses,
 * so alerts and hidden gauges always agree.
 */
export const GAUGE_WATCHER: Record<ResourceId, Role> = RESOURCE_WATCHER

/** Short gauge labels for the 7-across row on phones. */
export const shortLabel: Partial<Record<ResourceId, string>> = { data: 'Storage', comms: 'Comms', time: 'Time', deltaV: 'Δv' }

/** Glossary term behind each gauge label, if any. */
export const gaugeTerm: Partial<Record<ResourceId, string>> = { comms: 'downlink', deltaV: 'delta-v' }

/** Number formatting for the screens. */
export const n1 = (n: number) => (!Number.isFinite(n) ? '∞' : Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : Math.abs(n) >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ''))
