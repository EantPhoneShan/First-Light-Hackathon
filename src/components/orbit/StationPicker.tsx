import { Check, RadioTower } from 'lucide-react'
import { Art } from '@/components/Art'
import { orbitById, stationPasses, stations } from '@/engine/mock'
import { cn } from '@/lib/cn'
import { useGame, useScenario } from '@/store/game'

/** Ground segment: pick stations. More stations = more passes but higher yearly cost (PRD F9). */
export function StationPicker() {
  const scenario = useScenario()
  const design = useGame((s) => s.design)
  const updateDesign = useGame((s) => s.updateDesign)
  const orbit = orbitById(design.orbitId)

  const toggle = (id: string) =>
    updateDesign({
      stationIds: design.stationIds.includes(id) ? design.stationIds.filter((s) => s !== id) : [...design.stationIds, id],
    })

  const yearly = stations.filter((s) => design.stationIds.includes(s.id)).reduce((n, s) => n + s.opsCostMPerYear, 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Art name="scene-ground-dish" className="size-8" />
          Ground stations
        </h2>
        <span className="text-xs text-muted tabular-nums">
          ${yearly.toFixed(2)}M a year × {scenario.lifetimeYears} years = ${(yearly * scenario.lifetimeYears).toFixed(2)}M
        </span>
      </div>
      {!orbit && <p className="text-sm text-muted">Pick an orbit to see how many passes each station gets.</p>}

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stations.map((st) => {
          const on = design.stationIds.includes(st.id)
          const passes = orbit ? stationPasses(orbit, st) : null
          return (
            <li key={st.id}>
              <button
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(st.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                  on ? 'border-ok/70 bg-ok/10' : 'border-space-700 bg-space-900 hover:border-space-600',
                )}
              >
                <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border', on ? 'border-ok bg-ok text-space-950' : 'border-space-600')}>
                  {on && <Check className="size-3.5" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium">
                    <RadioTower className="size-3.5 text-muted" aria-hidden />
                    {st.name}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted">{st.note}</span>
                  <span className="mt-1.5 block text-xs tabular-nums">
                    {passes !== null && (
                      <span className={passes === 0 ? 'text-bad' : 'text-ok'}>
                        {passes === 0 ? 'Never sees this orbit' : orbit?.id === 'geo' ? 'Always in view' : `${passes} passes a day`}
                      </span>
                    )}
                    <span className="text-muted">{passes !== null ? ' · ' : ''}${st.opsCostMPerYear}M a year</span>
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
