import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { STEPS, stepForPath, type FlowFacts } from '@/engine/flow'
import { LeadButton } from '@/components/LeadButton'

interface ScreenProps {
  title: string
  subtitle?: string
  /** PRD requirement IDs this screen covers, e.g. "F7, F8". For the team's reference only; not shown. */
  reqs?: string
  nextLabel?: string
  /** Hide the Next button, for screens that show their own (e.g. the simulation). */
  hideNext?: boolean
  /** Extra facts the step's Next needs (see engine/flow.ts canAdvance). */
  facts?: Omit<FlowFacts, 'design' | 'players'>
  children?: ReactNode
}

/**
 * Shared frame for every phase screen: heading, body, and the step's Next button.
 * Next moves the whole room (team flow), so only the Mission Planner sees it.
 */
export function Screen({ title, subtitle, nextLabel = 'Next', hideNext, facts, children }: ScreenProps) {
  // "STEP 03 / 07 · CML 4" above the title, like a mission timeline readout.
  const step = stepForPath(useLocation().pathname)
  const flow = STEPS.filter((s) => s.id !== 'lobby')
  const i = flow.findIndex((s) => s.id === step)
  const info = i >= 0 ? flow[i] : null
  // The step label already says which CML it is, so drop "CML n · Name:" from the subtitle.
  const sub = subtitle?.replace(/^CML \d · [^:]+:\s*/, '')
  return (
    <section className="flex flex-col gap-6">
      <header className="border-l-2 border-accent pl-3">
        {info && (
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
            Step {String(i + 1).padStart(2, '0')} / {String(flow.length).padStart(2, '0')}
            {info.cml && <span className="text-accent"> · {info.cml}</span>}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-muted">{sub.charAt(0).toUpperCase() + sub.slice(1)}</p>}
      </header>

      {children}

      {!hideNext && (
        <div className="flex justify-end">
          <LeadButton facts={facts}>{nextLabel}</LeadButton>
        </div>
      )}
    </section>
  )
}

/** Dashed box that marks where a feature still needs building. */
export function Todo({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-space-600 bg-space-900 p-6 text-sm text-muted">
      {children}
    </div>
  )
}
