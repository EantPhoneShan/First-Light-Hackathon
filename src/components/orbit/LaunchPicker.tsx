import { CheckCircle2, Rocket, XCircle } from 'lucide-react'
import { Art } from '@/components/Art'
import { craftMass, launchCheck, launchers, orbitById } from '@/engine/mock'
import { cn } from '@/lib/cn'
import { useCanSee, useGame, useScenario } from '@/store/game'

/** Rocket art height grows with the rocket class, so the size difference reads at a glance. */
const rocketHeight: Record<string, string> = { rideshare: 'h-10', small: 'h-12', medium: 'h-16', heavy: 'h-[4.5rem]', super: 'h-20' }

/** Launch vehicle cards, greyed out with the reason when they can't do the job (task 2.5, PRD F8). */
export function LaunchPicker() {
  const scenario = useScenario()
  const design = useGame((s) => s.design)
  const updateDesign = useGame((s) => s.updateDesign)
  const orbit = orbitById(design.orbitId)
  const mass = craftMass(design)
  const canSee = useCanSee()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Launch vehicle</h2>
        <span className="text-xs text-muted">
          {canSee('mass') ? `Craft mass ${mass.toFixed(1)} kg` : 'Craft mass: ask Comms & Flight Dynamics'}
          {orbit ? ` · going to ${orbit.short}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Launch vehicle">
        {launchers.map((l) => {
          const check = launchCheck(design, l)
          const selected = l.id === design.launcherId
          const overBudget = l.costM > scenario.budgetM
          return (
            <button
              key={l.id}
              role="radio"
              aria-checked={selected}
              aria-disabled={!check.ok && !selected}
              disabled={!check.ok && !selected}
              onClick={() => updateDesign({ launcherId: selected ? null : l.id })}
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
                <Art name={`rocket-${l.id}`} className={rocketHeight[l.id] ?? 'h-14'} fallback={<Rocket className="size-5 text-accent" aria-hidden />} />
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
                {check.reason}
              </span>
              {overBudget && check.ok && <span className="mt-1 block text-xs text-bad">Costs more than your whole ${scenario.budgetM}M budget.</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
