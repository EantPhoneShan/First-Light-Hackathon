import { describe, expect, it } from 'vitest';
import { dataProblems, RAW_DATA_FILES } from '../data';
import { validateDataFiles } from '../schema';

describe('data file schemas (task 1.3)', () => {
  it('find no problems in the real data files', () => {
    expect(dataProblems).toEqual([]);
  });

  it('name a typo in a key, with the file and the path', () => {
    const parts = structuredClone(RAW_DATA_FILES['parts.json']) as { parts: Record<string, unknown>[] };
    parts.parts[0].masKg = parts.parts[0].massKg;
    delete parts.parts[0].massKg;
    const problems = validateDataFiles({ 'parts.json': parts });
    expect(problems.some((p) => p.startsWith('parts.json: parts[0]') && /masKg/.test(p))).toBe(true);
    expect(problems.some((p) => /massKg/.test(p))).toBe(true);
  });

  it('catch impossible numbers', () => {
    const orbits = structuredClone(RAW_DATA_FILES['orbits.json']) as { orbits: Record<string, unknown>[] };
    orbits.orbits[0].altitudeKm = 99_999;
    expect(validateDataFiles({ 'orbits.json': orbits }).some((p) => /between minAltitudeKm and maxAltitudeKm/.test(p))).toBe(true);
    const parts = structuredClone(RAW_DATA_FILES['parts.json']) as { parts: Record<string, unknown>[] };
    parts.parts[0].reliability = 1.5;
    expect(validateDataFiles({ 'parts.json': parts })).toHaveLength(1);
  });
});
