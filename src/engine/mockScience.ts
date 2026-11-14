/**
 * TEMPORARY stand-in for Member 1's science traceability data (PRD F3).
 * Goal -> measurement -> instrument type. Instruments that can't serve the goal are locked with a reason.
 *
 * UI contract this file assumes:
 *   scienceFor(scenarioId) -> Science
 *   instrumentLock(scenarioId, partId) -> reason string, or null if the instrument fits
 */

export interface Measurement {
  id: string
  label: string
  /** Plain-English: what this measurement actually senses. */
  senses: string
  fits: 'best' | 'ok' | 'no'
  /** Why it does or doesn't serve the goal. */
  why: string
  /** Part ids of instruments that make this measurement. */
  instruments: string[]
}

export interface Science {
  goal: string
  measurements: Measurement[]
  /** Instruments locked for this scenario, with the reason shown in the parts tray. */
  locked: Record<string, string>
}

const science: Record<string, Science> = {
  'wildfire-watch': {
    goal: 'Spot new fires early and map where they are spreading.',
    measurements: [
      {
        id: 'heat',
        label: 'Heat given off by the ground',
        senses: 'Infrared light: things that are hot glow brightly, even through smoke.',
        fits: 'best',
        why: 'Fires are far hotter than the land around them, and infrared sees through smoke. This is how real fire satellites spot new fires.',
        instruments: ['thermal-imager'],
      },
      {
        id: 'visible',
        label: 'Ordinary colour pictures',
        senses: 'Visible light, like a phone camera.',
        fits: 'ok',
        why: "Shows burn scars and big fires, but thick smoke hides the flames and it can't see at night.",
        instruments: ['camera'],
      },
      {
        id: 'radar',
        label: 'Radar echoes from the surface',
        senses: 'Radio waves bounced off the ground.',
        fits: 'no',
        why: "Radar sees the shape of the ground, not its temperature, so it can't tell a fire from cold ground.",
        instruments: ['radar'],
      },
    ],
    locked: {
      radar: "Doesn't fit the goal: radar can't tell a fire from cold ground.",
    },
  },
  'flood-radar': {
    goal: 'Map floodwater during storms, when the sky is full of cloud.',
    measurements: [
      {
        id: 'radar',
        label: 'Radar echoes from the surface',
        senses: 'Radio waves bounced off the ground. They pass straight through cloud and work at night.',
        fits: 'best',
        why: 'Calm floodwater reflects radar away like a mirror, so it shows up dark and easy to map, whatever the weather.',
        instruments: ['radar'],
      },
      {
        id: 'visible',
        label: 'Ordinary colour pictures',
        senses: 'Visible light, like a phone camera.',
        fits: 'no',
        why: 'Storm clouds block visible light, so the camera only sees the tops of clouds.',
        instruments: ['camera'],
      },
      {
        id: 'heat',
        label: 'Heat given off by the ground',
        senses: 'Infrared light.',
        fits: 'no',
        why: 'Clouds block infrared too, and water and wet ground are about the same temperature.',
        instruments: ['thermal-imager'],
      },
    ],
    locked: {
      camera: "Doesn't fit the goal: storm clouds hide the ground from cameras.",
      'thermal-imager': "Doesn't fit the goal: clouds block infrared, too.",
    },
  },
}

export const scienceFor = (scenarioId: string): Science | undefined => science[scenarioId]

export const instrumentLock = (scenarioId: string, partId: string): string | null => science[scenarioId]?.locked[partId] ?? null
