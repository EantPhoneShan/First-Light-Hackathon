import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { nextPath } from '@/routes'

interface ScreenProps {
  title: string
  subtitle?: string
  /** PRD requirement IDs this screen covers, e.g. "F7, F8". */
  reqs?: string
  nextLabel?: string
  /** Hide the Next button, for screens that show their own (e.g. the simulation). */
  hideNext?: boolean
  children?: ReactNode
}

/** Shared frame for every phase screen: heading, body, and a Next button. */
export function Screen({ title, subtitle, reqs, nextLabel = 'Next', hideNext, children }: ScreenProps) {
  const next = nextPath(useLocation().pathname)

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        {reqs && <p className="mt-1 text-xs text-muted/70">PRD {reqs}</p>}
      </div>

      {children}

      {next && !hideNext && (
        <div className="flex justify-end">
          <Link
            to={next}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-space-950 transition-colors hover:bg-accent-strong"
          >
            {nextLabel}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
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
