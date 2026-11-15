import { Check, RadioTower } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Fallback3D } from '@/components/Fallback3D'
import { Art } from '@/components/Art'
import { findOrbit } from '@/engine/data'
import { gameData } from '@/game/ui'
import { cn } from '@/lib/cn'
import { useEvaluation, useGame, useScenario } from '@/store/game'

// three.js only downloads when a station is shown.
const Station3D = lazy(() => import('@/three/Station3D'))

/** Ground segment: pick stations. More stations = more passes but higher yearly cost (PRD F9). */
export function StationPicker() {
  const scenario = useScenario()
  const flight = useGame((s) => s.design.flight)
  const toggle = useGame((s) => s.toggleStation)
  const ev = useEvaluation()
  const orbit = findOrbit(gameData, flight.orbitId)
  const stations = gameData.stations
  // The 3D view shows the station you point at, else the last one you picked, else your first.
  const [preview, setPreview] = useState<string | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const shown = stations.find((s) => s.id === (preview ?? last ?? flight.stationIds[0])) ?? stations[0]

  const yearly = scenario.baseOpsCostPerYearM + stations.filter((s) => flight.stationIds.includes(s.id)).reduce((n, s) => n + s.costPerYearM, 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Art name="scene-ground-dish" className="size-8" />
          Ground stations
        </h2>
        <span className="text-xs text-muted tabular-nums">
          Operations ${yearly.toFixed(2)}M a year × {scenario.lifetimeYears} years = ${(yearly * scenario.lifetimeYears).toFixed(2)}M
        </span>
      </div>
      {!orbit && <p className="text-sm text-muted">Pick an orbit to see how many passes each station gets.</p>}

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stations.map((st) => {
          const on = flight.stationIds.includes(st.id)
          const passes = orbit ? (st.passesPerDay[orbit.id] ?? 0) : null
          const lock = ev.compat.stations[st.id]
          return (
            <li key={st.id}>
              <button
                role="checkbox"
                aria-checked={on}
                onClick={() => (toggle(st.id), setLast(st.id))}
                onMouseEnter={() => setPreview(st.id)}
                onMouseLeave={() => setPreview(null)}
                onFocus={() => setPreview(st.id)}
                onBlur={() => setPreview(null)}
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
                  <span className="mt-0.5 block text-xs leading-snug text-muted">{st.tooltip}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">Hears {st.bands.map((b) => (b === 'uhf' ? 'UHF' : `${b.toUpperCase()}-band`)).join(', ')}</span>
                  <span className="mt-1.5 block text-xs tabular-nums">
                    {passes !== null && (
                      <span className={passes === 0 ? 'text-bad' : 'text-ok'}>
                        {passes === 0 ? 'Never sees this orbit' : orbit?.kind === 'geo' ? 'Always in view' : `${passes} passes a day`}
                      </span>
                    )}
                    <span className="text-muted">{passes !== null ? ' · ' : ''}${st.costPerYearM}M a year</span>
                    {lock && !lock.ok && passes !== 0 && <span className="mt-1 block text-bad">{lock.reason}</span>}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <Fallback3D fallback={<p className="rounded-xl border border-dashed border-space-700 p-4 text-center text-sm text-muted">3D isn't available on this device, so the station can't be shown.</p>}>
      <Suspense fallback={<div className="flex h-[260px] items-center justify-center sm:h-[360px] rounded-xl border border-space-700 text-sm text-muted">Loading 3D station…</div>}>
        <Station3D station={shown} active={flight.stationIds.includes(shown.id)} />
      </Suspense>
      </Fallback3D>
    </div>
  )
}
