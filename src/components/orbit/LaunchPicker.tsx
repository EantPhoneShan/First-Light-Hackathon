import { CheckCircle2, Rocket, XCircle } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { findBus, findLauncher } from '@/engine/data'
import { partsOnCraft } from '@/game/ui'
import { Art } from '@/components/Art'
import { findOrbit } from '@/engine/data'
import type { LauncherClass } from '@/engine/types'
import { gameData, n1, roleNames, GAUGE_WATCHER } from '@/game/ui'
import { cn } from '@/lib/cn'
import { useCanSee, useEvaluation, useGame, useScenario } from '@/store/game'

/** Art name and height per rocket class, so the size difference reads at a glance. */
const rocketArt: Record<LauncherClass, [string, string]> = {
  rideshare: ['rocket-rideshare', 'h-10'],
  small: ['rocket-small', 'h-12'],
  medium: ['rocket-medium', 'h-16'],
  heavy: ['rocket-heavy', 'h-[4.5rem]'],
  'super-heavy': ['rocket-super', 'h-20'],
}

// three.js only downloads when a rocket is shown.
const Rocket3D = lazy(() => import('@/three/Rocket3D'))

/** Launch vehicle cards, greyed out with the engine's reason when they can't do the job (task 2.5, PRD F8). */
export function LaunchPicker() {
  const scenario = useScenario()
  const flight = useGame((s) => s.design.flight)
  const setLauncher = useGame((s) => s.setLauncher)
  const ev = useEvaluation()
  const orbit = findOrbit(gameData, flight.orbitId)
  const canSee = useCanSee()
  const design = useGame((s) => s.design)
  // The 3D view shows the rocket you point at, or else the one you picked.
  const [preview, setPreview] = useState<string | null>(null)
  const shown = findLauncher(gameData, preview ?? flight.launcherId)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Launch vehicle</h2>
        <span className="text-xs text-muted">
          {canSee('mass') ? `Craft mass ${n1(ev.totals.massKg)} kg` : `Craft mass: ask the ${roleNames[GAUGE_WATCHER.mass]}`}
          {orbit ? ` · going to ${orbit.kind.toUpperCase()}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Launch vehicle">
        {gameData.launchers.map((l) => {
          const check = ev.compat.launchers[l.id] ?? { ok: true }
          const cap = orbit ? l.capacityKg[orbit.id] : undefined
          const selected = l.id === flight.launcherId
          const overBudget = l.costM > scenario.budgetM
          return (
            <button
              key={l.id}
              role="radio"
              aria-checked={selected}
              aria-disabled={!check.ok && !selected}
              disabled={!check.ok && !selected}
              onClick={() => setLauncher(selected ? null : l.id)}
              onMouseEnter={() => setPreview(l.id)}
              onMouseLeave={() => setPreview(null)}
              onFocus={() => setPreview(l.id)}
              onBlur={() => setPreview(null)}
              title={l.tooltip}
              className={cn(
                'flex items-end gap-3 rounded-xl border p-3 text-left transition-colors',
                selected && check.ok && 'border-accent bg-accent/10',
                selected && !check.ok && 'border-bad bg-bad/10',
                !selected && check.ok && 'border-space-700 bg-space-900 hover:border-space-600',
                !selected && !check.ok && 'cursor-not-allowed border-space-800 bg-space-900/50 opacity-50',
              )}
            >
              <span className="flex w-8 shrink-0 justify-center self-center">
                <Art name={rocketArt[l.class][0]} className={rocketArt[l.class][1]} fallback={<Rocket className="size-5 text-accent" aria-hidden />} />
              </span>
              <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  {l.name}
                </span>
                <span className={cn('font-display text-sm tabular-nums', overBudget ? 'text-bad' : 'text-muted')}>${l.costM}M</span>
              </span>
              <span className="mt-1 block text-xs leading-snug text-muted">{l.tooltip}</span>
              <span className={cn('mt-2 flex items-start gap-1.5 text-xs leading-snug', check.ok ? 'text-ok' : 'text-bad')}>
                {check.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden /> : <XCircle className="mt-px size-3.5 shrink-0" aria-hidden />}
                {check.ok ? (cap !== undefined ? `Lifts up to ${cap.toLocaleString()} kg to ${orbit!.kind.toUpperCase()}.` : 'Pick an orbit to check it can get there.') : check.reason}
              </span>
              {overBudget && check.ok && <span className="mt-1 block text-xs text-bad">Costs more than your whole ${scenario.budgetM}M budget.</span>}
              </span>
            </button>
          )
        })}
      </div>

      {shown ? (
        <Suspense fallback={<div className="flex h-[340px] items-center justify-center sm:h-[540px] rounded-xl border border-space-700 text-sm text-muted">Loading 3D rocket…</div>}>
          <Rocket3D launcher={shown} bus={findBus(gameData, design.engineer.busId)} parts={partsOnCraft(design)} />
        </Suspense>
      ) : (
        <p className="rounded-xl border border-dashed border-space-700 p-4 text-center text-sm text-muted">Pick a rocket to see it in 3D, with your spacecraft inside.</p>
      )}
    </div>
  )
}
