/**
 * Data file checks (task 1.3): Zod schemas for every file in src/data.
 *
 * Objects are strict, so a typo such as "masKg" is reported by name instead
 * of silently becoming a missing number. data.ts runs these at start-up and
 * logs a clear message; the unit tests fail on any problem.
 */
import { z } from 'zod';

const sourceId = z.enum(['challenge', 'cubesat101', 'science-missions', 'cml', 'mdl', 'gmat', 'physics', 'estimate']);
const role = z.enum(['planner', 'science', 'engineer', 'flight']);
const busSize = z.enum(['cubesat', 'smallsat', 'large']);
const band = z.enum(['uhf', 's', 'x']);
const resourceId = z.enum(['mass', 'power', 'budget', 'data', 'comms', 'time', 'deltaV']);
const id = z.string().regex(/^[a-z0-9-]+$/, 'ids use lower-case letters, digits and dashes');
const nonNeg = z.number().finite().nonnegative();
const positive = z.number().finite().positive();
const share = z.number().min(0).max(1);

const described = {
  id,
  name: z.string().min(1),
  tooltip: z.string().min(10),
  learnMoreUrl: z.url().optional(),
  source: sourceId,
  sourceNote: z.string().min(1).optional(),
};

export const partSchema = z.strictObject({
  ...described,
  category: z.enum(['solar', 'battery', 'computer', 'adcs', 'propulsion', 'thermal', 'antenna', 'instrument']),
  tier: z.enum(['simple', 'advanced']),
  slots: z.number().int().nonnegative(),
  maxPerCraft: z.number().int().positive().optional(),
  fits: z.array(busSize).min(1).optional(),
  massKg: nonNeg,
  powerW: nonNeg,
  costM: nonNeg,
  buildMonths: nonNeg,
  reliability: z.number().gt(0).max(1),
  icon: z.string().min(1),
  generationW: positive.optional(),
  capacityWh: positive.optional(),
  storageMB: positive.optional(),
  band: band.optional(),
  dataRateMbps: positive.optional(),
  propellantKg: positive.optional(),
  ispS: positive.optional(),
  dataMBPerOrbit: nonNeg.optional(),
  measures: z.array(z.string().min(1)).optional(),
  scienceValue: z.number().min(0).max(100).optional(),
});

export const busSchema = z.strictObject({
  ...described,
  size: busSize,
  slots: z.number().int().positive(),
  maxMassKg: positive,
  massKg: nonNeg,
  powerW: nonNeg,
  costM: nonNeg,
  buildMonths: nonNeg,
  reliability: z.number().gt(0).max(1),
  icon: z.string().min(1),
});

export const launcherSchema = z.strictObject({
  ...described,
  class: z.enum(['rideshare', 'small', 'medium', 'heavy', 'super-heavy']),
  costM: nonNeg,
  capacityKg: z.record(z.string(), positive),
  maxBus: busSize,
  reliability: z.number().gt(0).max(1),
  icon: z.string().min(1),
});

export const orbitSchema = z
  .strictObject({
    ...described,
    kind: z.enum(['leo', 'sso', 'geo']),
    altitudeKm: positive,
    minAltitudeKm: positive,
    maxAltitudeKm: positive,
    inclinationDeg: z.number().min(0).max(180),
    betaDeg: z.number().min(-90).max(90),
    revisitDays: nonNeg,
  })
  .refine((o) => o.minAltitudeKm <= o.altitudeKm && o.altitudeKm <= o.maxAltitudeKm, 'altitudeKm must sit between minAltitudeKm and maxAltitudeKm');

const sourceRef = z.strictObject({ source: sourceId, sourceNote: z.string().optional() });

export const orbitsFileSchema = z.strictObject({
  orbits: z.array(orbitSchema).min(1),
  decay: z.array(z.strictObject({ altitudeKm: positive, years: positive })).min(2),
  decaySource: sourceRef,
  disposalRuleYears: positive,
  disposalSource: sourceRef,
});

export const stationSchema = z.strictObject({
  ...described,
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  bands: z.array(band).min(1),
  passesPerDay: z.record(z.string(), positive),
  passMinutes: positive,
  costPerYearM: nonNeg,
  icon: z.string().min(1),
});

const designSchema = z.strictObject({
  planner: z.strictObject({
    weights: z.strictObject({ coverage: share, detail: share, lifetime: share }),
    disposal: z.enum(['none', 'natural-decay', 'deorbit-burn', 'graveyard']),
  }),
  science: z.strictObject({ goalId: z.string().nullable(), measurementId: z.string().nullable(), instrumentIds: z.array(z.string()) }),
  engineer: z.strictObject({ busId: z.string().nullable(), partIds: z.array(z.string()) }),
  flight: z.strictObject({
    orbitId: z.string().nullable(),
    altitudeKm: z.number().nullable(),
    launcherId: z.string().nullable(),
    antennaIds: z.array(z.string()),
    stationIds: z.array(z.string()),
  }),
});

export const scenarioSchema = z.strictObject({
  ...described,
  objective: z.string().min(10),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
  customer: z.strictObject({ name: z.string().min(1), needsDataWithinHours: positive }),
  busIds: z.array(z.string()).min(1),
  budgetM: positive,
  baseOpsCostPerYearM: nonNeg,
  launchInMonths: positive,
  lifetimeYears: positive,
  revisitDays: nonNeg,
  criticalResources: z.array(resourceId).length(2),
  goals: z
    .array(
      z.strictObject({
        id,
        name: z.string().min(1),
        measurements: z.array(z.strictObject({ id, name: z.string().min(1), why: z.string().min(10), instrumentIds: z.array(z.string()).min(1) })).min(1),
      }),
    )
    .min(1),
  eventsAllowed: z.array(z.string()),
  tutorialDesign: designSchema.optional(),
});

export const eventSchema = z.strictObject({
  id,
  name: z.string().min(1),
  owner: role,
  icon: z.string().min(1),
  text: z.string().min(10),
  source: sourceId,
  sourceNote: z.string().optional(),
  choices: z
    .array(
      z.strictObject({
        id,
        label: z.string().min(1),
        text: z.string().min(1),
        good: z.union([z.boolean(), z.literal('if-storage-holds')]),
        effects: z.strictObject({
          chance: share.optional(),
          instrumentsOffHours: positive.optional(),
          stationOutageHours: positive.optional(),
          radioOffHours: positive.optional(),
          radioLost: z.boolean().optional(),
          dataFactor: share.optional(),
          dataFactorHours: positive.optional(),
          healthDelta: z.number().min(-100).max(100).optional(),
          solarLossPct: z.number().min(0).max(100).optional(),
        }),
        outcome: z.string().min(1),
        outcomeIfLucky: z.string().optional(),
        outcomeIfFull: z.string().optional(),
      }),
    )
    .min(2)
    .max(3),
});

export const sourceSchema = z.strictObject({ id: sourceId, title: z.string().min(1), url: z.url().optional() });

/** One schema per data file, keyed by file name. */
export const DATA_FILE_SCHEMAS = {
  'parts.json': z.strictObject({ buses: z.array(busSchema).min(1), parts: z.array(partSchema).min(1) }),
  'launchers.json': z.strictObject({ launchers: z.array(launcherSchema).min(1) }),
  'orbits.json': orbitsFileSchema,
  'stations.json': z.strictObject({ stations: z.array(stationSchema).min(1) }),
  'scenarios.json': z.strictObject({ scenarios: z.array(scenarioSchema).min(1) }),
  'events.json': z.strictObject({ events: z.array(eventSchema) }),
  'sources.json': z.strictObject({ sources: z.array(sourceSchema).min(1) }),
};

export type DataFileName = keyof typeof DATA_FILE_SCHEMAS;

/**
 * Checks the raw JSON of each data file. Returns one readable line per problem,
 * e.g. 'parts.json: parts[3].masKg: Unrecognized key "masKg"'. Empty = all good.
 */
export function validateDataFiles(files: Partial<Record<DataFileName, unknown>>): string[] {
  const out: string[] = [];
  for (const [name, schema] of Object.entries(DATA_FILE_SCHEMAS) as [DataFileName, z.ZodType][]) {
    if (!(name in files)) continue;
    const r = schema.safeParse(files[name]);
    if (r.success) continue;
    for (const issue of r.error.issues) {
      const path = issue.path.map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`)).join('').replace(/^\./, '');
      out.push(`${name}: ${path || '(file)'}: ${issue.message}`);
    }
  }
  return out;
}
