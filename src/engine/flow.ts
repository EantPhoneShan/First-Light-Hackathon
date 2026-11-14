/**
 * Team flow rules (team decision, 14 Nov): the whole room is on ONE step at a
 * time, and in each step a role may only edit its own section.
 *
 * Pure rules, no UI and no network. Member 3's sync stores the room's step and
 * refuses edits these rules don't allow; Member 2's screens follow the room's
 * step and grey out what you can't edit. Solo players hold all four roles, so
 * every rule passes for them.
 *
 *   lobby -> briefing (CML 1) -> feasibility (CML 2) -> design (CML 4) -> review
 *         -> launch -> simulate -> report -> (re-fly) design
 *   A Hold at review sends everyone back to design (PRD user flow).
 */
import type { Design, Evaluation, GameEvent, Role, SimState } from './types';

export type Step = 'lobby' | 'briefing' | 'feasibility' | 'design' | 'review' | 'launch' | 'simulate' | 'report';
type Section = keyof Design;

export interface StepInfo {
  id: Step;
  label: string;
  /** JPL Concept Maturity Level this step matches, if any. */
  cml: string;
  /** Member 2's screen for this step. */
  path: string;
  /** Who presses Next (or Launch / Re-fly) for the team. */
  leader: Role;
  /** Roles that may edit their own section in this step. */
  editors: Role[];
  /** What happens here, in one line (for the stepper tooltip). */
  what: string;
}

const ALL: Role[] = ['planner', 'science', 'engineer', 'flight'];

export const STEPS: StepInfo[] = [
  { id: 'lobby', label: 'Lobby', cml: '', path: '/lobby', leader: 'planner', editors: [], what: 'Everyone joins and picks a role.' },
  { id: 'briefing', label: 'Idea', cml: 'CML 1', path: '/briefing', leader: 'planner', editors: ['science'], what: 'Read the mission. The Science Lead picks the goal and measurement.' },
  { id: 'feasibility', label: 'Feasibility', cml: 'CML 2', path: '/feasibility', leader: 'planner', editors: ['planner'], what: 'The Mission Planner sets the priorities; the others push back.' },
  { id: 'design', label: 'Point design', cml: 'CML 4', path: '/workbench', leader: 'planner', editors: ALL, what: 'Everyone builds at once, each in their own part of the craft.' },
  { id: 'review', label: 'Review', cml: '', path: '/review', leader: 'planner', editors: [], what: 'Every role presses Approve or Hold. No edits here.' },
  { id: 'launch', label: 'Launch', cml: '', path: '/launch', leader: 'planner', editors: [], what: 'Everyone watches the launch.' },
  { id: 'simulate', label: 'Fly', cml: '', path: '/sim', leader: 'planner', editors: [], what: 'Everyone watches the same flight. Each event is answered by its owner role.' },
  { id: 'report', label: 'Report', cml: '', path: '/report', leader: 'planner', editors: [], what: 'Read why it went the way it did, then re-fly together.' },
];

export const stepInfo = (step: Step): StepInfo => STEPS.find((s) => s.id === step) ?? STEPS[0];

export function stepForPath(path: string): Step | null {
  return STEPS.find((s) => s.path === path)?.id ?? null;
}

/** May a player holding `myRoles` edit this section in this step? */
export function canEditSection(step: Step, myRoles: Role[], section: Section): boolean {
  return myRoles.includes(section) && stepInfo(step).editors.includes(section);
}

/** May this player press the step's Next / Launch / Re-fly button? */
export function canLead(step: Step, myRoles: Role[]): boolean {
  return myRoles.includes(stepInfo(step).leader);
}

/** May this player answer the event card? Only the event's owner role. */
export function canChooseEvent(myRoles: Role[], event: GameEvent): boolean {
  return myRoles.includes(event.owner);
}

export interface AdvanceCheck {
  ok: boolean;
  /** Why not, in one plain sentence (shown on the disabled button). */
  reason?: string;
  /** The step the team moves to. */
  to: Step | null;
}

/** What the flow needs to know to decide if the team can move on. */
export interface FlowFacts {
  design: Design;
  evaluation?: Evaluation;
  /** Every role pressed Approve on the current design (sync allApproved(room)). */
  allApproved?: boolean;
  /** Any role pressed Hold on the current design. */
  anyHold?: boolean;
  /** Number of players in the room (0 or 1 = solo). */
  players?: number;
  /** The live flight, in the simulate step. */
  flight?: SimState;
  /** The launch animation has finished. */
  launchDone?: boolean;
}

/** Can the team leave this step forward, and to where? */
export function canAdvance(step: Step, f: FlowFacts): AdvanceCheck {
  switch (step) {
    case 'lobby':
      return { ok: true, to: 'briefing' };
    case 'briefing':
      if (!f.design.science.goalId) return { ok: false, reason: 'The Science Lead needs to pick a science goal.', to: 'feasibility' };
      if (!f.design.science.measurementId) return { ok: false, reason: 'The Science Lead needs to pick what to measure.', to: 'feasibility' };
      return { ok: true, to: 'feasibility' };
    case 'feasibility':
      return { ok: true, to: 'design' };
    case 'design':
      // Always allowed: the review is where problems are shown and argued about.
      return { ok: true, to: 'review' };
    case 'review': {
      const blocking = f.evaluation?.problems.find((p) => p.blocking);
      if (blocking) return { ok: false, reason: `Can't launch yet: ${blocking.why}`, to: 'launch' };
      const team = (f.players ?? 0) > 1;
      if (team && f.anyHold) return { ok: false, reason: 'Someone pressed Hold. Talk it through, then go back to the design.', to: 'launch' };
      if (team && !f.allApproved) return { ok: false, reason: 'Every role needs to press Approve first.', to: 'launch' };
      return { ok: true, to: 'launch' };
    }
    case 'launch':
      if (f.launchDone === false) return { ok: false, reason: 'Wait for the launch to finish.', to: 'simulate' };
      return { ok: true, to: 'simulate' };
    case 'simulate':
      if (f.flight && !f.flight.done) return { ok: false, reason: 'The mission is still flying.', to: 'report' };
      return { ok: true, to: 'report' };
    case 'report':
      return { ok: true, to: 'design' };
  }
}

/** Where a Hold at review (or Re-fly from the report) sends the team. */
export function backStep(step: Step): Step | null {
  if (step === 'review' || step === 'report') return 'design';
  if (step === 'feasibility') return 'briefing';
  if (step === 'design') return 'feasibility';
  return null;
}

/**
 * Member 3's sync Phase has only 5 values today; these map the 8 steps onto it.
 * Best: widen sync's Phase to Step (it is stored as a plain string), then
 * room.phase can be the step itself and these become identity functions.
 */
export type SyncPhase = 'lobby' | 'design' | 'launch' | 'simulate' | 'report';
export function toSyncPhase(step: Step): SyncPhase {
  if (step === 'briefing' || step === 'feasibility' || step === 'design' || step === 'review') return 'design';
  return step;
}
