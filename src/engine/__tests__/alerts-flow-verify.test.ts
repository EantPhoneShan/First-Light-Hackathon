import { describe, expect, it } from 'vitest';
import { changedRole, conflictAlerts } from '../alerts';
import { backStep, canAdvance, canEditSection, canLead, toSyncPhase } from '../flow';
import { scoreMission } from '../score';
import { simulate } from '../simulate';
import { makeSubmission, verifyScore } from '../verify';
import { RESOURCE_WATCHER } from '../types';
import { fixed, gameData, mod, wildfire } from './fixtures';

describe('conflict alerts', () => {
  it('tell the gauge watcher who caused it, and suggest a fix', () => {
    const after = mod(fixed, (d) => (d.flight.antennaIds = ['antenna-x']));
    const alerts = conflictAlerts(fixed, after, wildfire, gameData, { byName: 'Lucas' });
    const power = alerts.find((a) => a.resource === 'power')!;
    expect(power.hurtRole).toBe(RESOURCE_WATCHER.power);
    expect(power.after).toBe('fail');
    expect(power.message).toBe('Power is now 0.91 W short. Lucas (Flight Dynamics) swapped the S-band radio for the X-band radio.');
    expect(power.fixes.length).toBeGreaterThan(0);
    expect(alerts.find((a) => a.resource === 'budget')!.hurtRole).toBe('planner');
  });

  it('name the slot problem for the Engineer when Science adds a part', () => {
    const alerts = conflictAlerts(fixed, mod(fixed, (d) => d.science.instrumentIds.push('camera')), wildfire, gameData);
    expect(alerts.some((a) => a.hurtRole === 'engineer' && a.resource === 'slots')).toBe(true);
  });

  it('send nothing when nothing got worse, or when two roles changed at once', () => {
    expect(conflictAlerts(fixed, mod(fixed, (d) => (d.planner.disposal = 'natural-decay')), wildfire, gameData)).toEqual([]);
    const two = mod(fixed, (d) => { d.flight.antennaIds = ['antenna-x']; d.science.instrumentIds = ['camera']; });
    expect(changedRole(fixed, two)).toBeNull();
  });
});

describe('team flow', () => {
  it('lets each role edit only its own section, and only in the right step', () => {
    expect(canEditSection('design', ['engineer'], 'engineer')).toBe(true);
    expect(canEditSection('design', ['engineer'], 'planner')).toBe(false);
    expect(canEditSection('review', ['engineer'], 'engineer')).toBe(false);
    expect(canEditSection('briefing', ['science'], 'science')).toBe(true);
    expect(canEditSection('feasibility', ['science'], 'science')).toBe(false);
    expect(canEditSection('feasibility', ['planner'], 'planner')).toBe(true);
    expect(canLead('design', ['planner'])).toBe(true);
    expect(canLead('design', ['flight'])).toBe(false);
  });

  it('only launches when nothing blocks and everyone approved', () => {
    const facts = { design: fixed, players: 4 };
    expect(canAdvance('review', { ...facts, allApproved: false }).ok).toBe(false);
    expect(canAdvance('review', { ...facts, allApproved: true, anyHold: true }).ok).toBe(false);
    expect(canAdvance('review', { ...facts, allApproved: true })).toEqual({ ok: true, to: 'launch' });
    expect(canAdvance('review', { design: fixed, players: 1 }).ok).toBe(true); // solo needs no vote
    expect(canAdvance('briefing', { design: mod(fixed, (d) => (d.science.goalId = null)) }).ok).toBe(false);
  });

  it('sends a Hold or a Re-fly back to the design, and maps onto sync phases', () => {
    expect(backStep('review')).toBe('design');
    expect(backStep('report')).toBe('design');
    expect(toSyncPhase('feasibility')).toBe('design');
    expect(toSyncPhase('simulate')).toBe('simulate');
  });
});

describe('score check for the Lambda', () => {
  const sim = simulate(fixed, wildfire, gameData, { seed: 42 });
  const honest = scoreMission(fixed, wildfire, gameData, sim, { allApproved: true }).total;

  it('accepts an honest flight and returns the server score', () => {
    const v = verifyScore(makeSubmission('wildfire-watch', fixed, sim, { allApproved: true }, honest), gameData);
    expect(v).toMatchObject({ ok: true, score: honest, outcome: 'success', reasons: [] });
  });

  it('survives a JSON round trip (the Lambda gets plain JSON)', () => {
    const wire = JSON.parse(JSON.stringify(makeSubmission('wildfire-watch', fixed, sim, { allApproved: true }, honest)));
    expect(verifyScore(wire, gameData).score).toBe(honest);
  });

  it('rejects a faked score, unknown choices and bad input', () => {
    expect(verifyScore({ ...makeSubmission('wildfire-watch', fixed, sim), claimedScore: 999 }, gameData).ok).toBe(false);
    expect(verifyScore({ ...makeSubmission('wildfire-watch', fixed, sim), choices: { 'solar-storm': 'cheat' } }, gameData).ok).toBe(false);
    expect(verifyScore({ ...makeSubmission('wildfire-watch', fixed, sim), seed: -1 }, gameData).ok).toBe(false);
    expect(verifyScore({ ...makeSubmission('nope', fixed, sim) }, gameData).ok).toBe(false);
    expect(verifyScore(null, gameData).ok).toBe(false);
  });

  it('never takes event credit from the client', () => {
    const sub = { ...makeSubmission('wildfire-watch', fixed, sim), context: { eventChoices: { good: 99, total: 99 } } };
    // No context sent = nobody approved, and event credit comes only from the replay.
    expect(verifyScore(sub, gameData).score).toBe(scoreMission(fixed, wildfire, gameData, sim, { allApproved: false }).total);
  });
});
