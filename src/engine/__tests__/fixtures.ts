/** Shared test designs (task 1.12). */
import { findScenario, gameData } from '../data';
import type { Design, Scenario } from '../types';

export { gameData };

export const wildfire: Scenario = findScenario(gameData, 'wildfire-watch')!;
export const flood: Scenario = findScenario(gameData, 'flood-radar')!;

/** The tutorial's deliberately flawed CubeSat: battery too small for the eclipse. */
export const tutorial: Design = wildfire.tutorialDesign!;

/** Returns a changed copy of a design. */
export function mod(base: Design, change: (d: Design) => void): Design {
  const copy = structuredClone(base);
  change(copy);
  return copy;
}

/** The tutorial with its one mistake fixed: the large battery. */
export const fixed: Design = mod(tutorial, (d) => {
  d.engineer.partIds[2] = 'battery-large';
});

/** A build that meets every role goal on Wildfire Watch (3 stars). */
export const multispectral: Design = mod(fixed, (d) => {
  d.science.goalId = null;
  d.science.measurementId = null;
  d.science.instrumentIds = ['multispectral-imager'];
});

/** Flood Radar winning build. */
export const radarBuild: Design = {
  planner: { weights: { coverage: 0.5, detail: 0.5, lifetime: 0.5 }, disposal: 'natural-decay' },
  science: { goalId: 'map-floods', measurementId: null, instrumentIds: ['radar'] },
  engineer: { busId: 'bus-smallsat', partIds: ['solar-array', 'solar-array', 'battery-pack', 'computer', 'reaction-wheel'] },
  flight: { orbitId: 'sso', altitudeKm: 550, launcherId: 'small-rocket', antennaIds: ['antenna-x'], stationIds: ['station-polar'] },
};
