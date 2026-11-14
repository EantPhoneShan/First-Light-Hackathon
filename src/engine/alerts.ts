/**
 * Conflict alerts (task 1.10, PRD F11): compare the design before and after a
 * change, and say which role it hurt, who caused it and how to fix it.
 *
 *   // In the sync 'remote-change' handler (Member 3, task 3.7):
 *   const alerts = conflictAlerts(before, after, scenario, gameData, { byRole: event.role, byName: event.byName });
 *   alerts.filter((a) => myRoles.includes(a.hurtRole)).forEach(showToast);   // Member 2, task 2.8
 *
 * e.g. "Power is now 1 W short. Lucas (Flight Dynamics) added the X-band radio."
 */
import { ROLE_LABELS } from '../sync/types';
import { evaluate } from './rules';
import type { Design, Evaluation, GameData, Problem, ProblemKind, ResourceId, Role, Scenario, Status } from './types';
import { RESOURCES } from './types';
import { fmt, list, pct } from './why';

export interface ConflictAlert {
  id: string;
  /** The role whose panel gets the alert. */
  hurtRole: Role;
  /** The role that made the change. */
  byRole: Role;
  /** Who made it, e.g. "Lucas (Flight Dynamics)". */
  by: string;
  resource: ResourceId | ProblemKind;
  before: Status;
  after: Status;
  /** One sentence for the toast. */
  message: string;
  /** What changed, e.g. "added the X-band radio". */
  change: string;
  /** Up to 2 suggested fixes. */
  fixes: string[];
}

export interface AlertOptions {
  /** Who changed it. Missing = worked out from which section differs. */
  byRole?: Role;
  byName?: string;
  /** Also return alerts for the role that made the change (solo mode may want them). */
  includeSelf?: boolean;
}

const RANK: Record<Status, number> = { ok: 0, warn: 1, fail: 2 };
const ROLE_ORDER: Role[] = ['planner', 'science', 'engineer', 'flight'];
/** Resources where running out reads as "short" (the rest read as "over"). */
const SHORT = new Set<ResourceId>(['power', 'comms', 'data', 'deltaV']);
/** Problems that have no gauge but still hurt another role. */
const EXTRA_KINDS: ProblemKind[] = ['slots', 'compat', 'science', 'lifetime', 'disposal'];

export function conflictAlerts(before: Design, after: Design, scenario: Scenario, data: GameData, opts: AlertOptions = {}): ConflictAlert[] {
  const byRole = opts.byRole ?? changedRole(before, after);
  if (!byRole) return [];
  const change = describeChange(before, after, byRole, data);
  if (!change) return [];
  const by = opts.byName ? `${opts.byName} (${ROLE_LABELS[byRole]})` : ROLE_LABELS[byRole];

  const evA = evaluate(before, scenario, data);
  const evB = evaluate(after, scenario, data);
  const oldIds = new Set(evA.problems.map((p) => p.id));
  const fresh = evB.problems.filter((p) => !oldIds.has(p.id));
  const alerts: ConflictAlert[] = [];

  // Gauges that got worse.
  for (const r of RESOURCES) {
    const a = evA.gauges[r];
    const b = evB.gauges[r];
    if (RANK[b.status] <= RANK[a.status]) continue;
    const matches = (p: Problem) => p.kind === r || (r === 'time' && p.kind === 'lifetime') || (r === 'deltaV' && p.kind === 'disposal');
    const fixes = fixesFor(fresh, evB, matches);
    // A gauge can turn red from a linked problem while still under its limit
    // (e.g. Time, from an orbit that decays too soon): use that problem's words.
    const linked = fresh.find(matches);
    const sentence = b.status === 'fail' && b.used <= b.limit && linked ? linked.why : gaugeSentence(b);
    alerts.push({
      id: `alert.${r}`,
      hurtRole: b.owner,
      byRole,
      by,
      resource: r,
      before: a.status,
      after: b.status,
      message: `${sentence} ${by} ${change}.`,
      change,
      fixes,
    });
  }

  // New problems with no gauge (e.g. the bus is now full).
  for (const p of fresh) {
    if (!EXTRA_KINDS.includes(p.kind) || p.status === 'warn') continue;
    if (alerts.some((x) => x.hurtRole === p.owner && x.resource === p.kind)) continue;
    alerts.push({
      id: `alert.${p.id}`,
      hurtRole: p.owner,
      byRole,
      by,
      resource: p.kind,
      before: 'ok',
      after: p.status,
      message: `${p.why} ${by} ${change}.`,
      change,
      fixes: p.hint ? [p.hint] : [],
    });
  }

  return opts.includeSelf ? alerts : alerts.filter((a) => a.hurtRole !== byRole);
}

/** The single role whose section differs, or null if none or several changed. */
export function changedRole(before: Design, after: Design): Role | null {
  const changed = ROLE_ORDER.filter((r) => JSON.stringify(before[r]) !== JSON.stringify(after[r]));
  return changed.length === 1 ? changed[0] : null;
}

function gaugeSentence(g: Evaluation['gauges'][ResourceId]): string {
  if (g.status === 'fail') {
    const gap = g.used - g.limit;
    const unit = g.unit === '$M' ? '' : ` ${g.unit}`;
    const amount = g.unit === '$M' ? `$${fmt(gap)}M` : `${fmt(gap)}${unit}`;
    return `${g.label} is now ${amount} ${SHORT.has(g.resource) ? 'short' : 'over'}.`;
  }
  return `${g.label} is down to ${pct(g.marginPct)} spare.`;
}

function fixesFor(fresh: Problem[], ev: Evaluation, match: (p: Problem) => boolean): string[] {
  const hints = [...fresh, ...ev.problems].filter(match).map((p) => p.hint).filter((h): h is string => !!h);
  return [...new Set(hints)].slice(0, 2);
}

// ---------------------------------------------------------------------------
// Plain-English description of a change, e.g. "added the X-band radio"
// ---------------------------------------------------------------------------

function describeChange(before: Design, after: Design, role: Role, data: GameData): string {
  const name = (id: string) => data.parts.find((p) => p.id === id)?.name ?? id;
  // "Large battery" -> "large battery", but keep "S-band radio", "Space Station orbit", "CubeSat ...".
  const lower = (s: string) => (/^[A-Z][a-z]/.test(s) && !/\s[A-Z]|[a-z][A-Z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const diffIds = (a: string[], b: string[]) => {
    const added = [...b];
    const removed: string[] = [];
    for (const id of a) {
      const i = added.indexOf(id);
      if (i >= 0) added.splice(i, 1);
      else removed.push(id);
    }
    return { added, removed };
  };
  const partsChange = (a: string[], b: string[]) => {
    const { added, removed } = diffIds(a, b);
    const parts: string[] = [];
    if (added.length && removed.length && added.length === 1 && removed.length === 1) {
      return `swapped the ${lower(name(removed[0]))} for the ${lower(name(added[0]))}`;
    }
    if (added.length) parts.push(`added the ${list(added.map((id) => lower(name(id))))}`);
    if (removed.length) parts.push(`removed the ${list(removed.map((id) => lower(name(id))))}`);
    return parts.join(' and ');
  };

  const out: string[] = [];
  if (role === 'engineer') {
    const a = before.engineer;
    const b = after.engineer;
    if (a.busId !== b.busId) out.push(`changed the bus to the ${lower(data.buses.find((x) => x.id === b.busId)?.name ?? 'none')}`);
    const pc = partsChange(a.partIds, b.partIds);
    if (pc) out.push(pc);
  } else if (role === 'science') {
    const a = before.science;
    const b = after.science;
    const pc = partsChange(a.instrumentIds, b.instrumentIds);
    if (pc) out.push(pc);
    if (a.goalId !== b.goalId || a.measurementId !== b.measurementId) out.push('changed the science goal');
  } else if (role === 'flight') {
    const a = before.flight;
    const b = after.flight;
    if (a.orbitId !== b.orbitId) out.push(`moved to the ${lower(data.orbits.find((o) => o.id === b.orbitId)?.name ?? 'no orbit')}`);
    else if (a.altitudeKm !== b.altitudeKm && b.altitudeKm !== null) out.push(`changed the altitude to ${fmt(b.altitudeKm)} km`);
    if (a.launcherId !== b.launcherId) out.push(`picked the ${lower(data.launchers.find((l) => l.id === b.launcherId)?.name ?? 'no rocket')}`);
    const pc = partsChange(a.antennaIds, b.antennaIds);
    if (pc) out.push(pc);
    const st = diffIds(a.stationIds, b.stationIds);
    const sName = (id: string) => lower(data.stations.find((s) => s.id === id)?.name ?? id);
    if (st.added.length) out.push(`added the ${list(st.added.map(sName))}`);
    if (st.removed.length) out.push(`dropped the ${list(st.removed.map(sName))}`);
  } else {
    const a = before.planner;
    const b = after.planner;
    if (a.disposal !== b.disposal) out.push('changed the end-of-mission plan');
    if (JSON.stringify(a.weights) !== JSON.stringify(b.weights)) out.push('changed the mission priorities');
  }
  return list(out);
}
