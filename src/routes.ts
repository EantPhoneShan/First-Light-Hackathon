/** Mission flow, in order. The stepper and Next buttons both read this list. */
export const flow = [
  { path: '/briefing', label: 'Idea', cml: 'CML 1' },
  { path: '/feasibility', label: 'Feasibility', cml: 'CML 2' },
  { path: '/workbench', label: 'Point design', cml: 'CML 4' },
  { path: '/review', label: 'Review', cml: '' },
  { path: '/launch', label: 'Launch', cml: '' },
  { path: '/sim', label: 'Fly', cml: '' },
  { path: '/report', label: 'Report', cml: '' },
] as const

export type FlowPath = (typeof flow)[number]['path']

export function nextPath(current: string): string | null {
  const i = flow.findIndex((s) => s.path === current)
  return i >= 0 && i < flow.length - 1 ? flow[i + 1].path : null
}
