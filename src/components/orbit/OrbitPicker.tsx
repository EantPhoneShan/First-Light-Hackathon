import { Lock, Star } from 'lucide-react'
import { Term } from '@/components/Term'
import { findOrbit } from '@/engine/data'
import { clampAltitude } from '@/engine/rules'
import type { Orbit, OrbitInfo } from '@/engine/types'
import { gameData, n1 } from '@/game/ui'
import { cn } from '@/lib/cn'
import { useEvaluation, useGame, useScenario } from '@/store/game'
import { GroundTrack } from './GroundTrack'
import { OrbitPreview } from './OrbitPreview'

/** Orbit cards, altitude slider and live previews (task 2.5, PRD F8). Locks and numbers come from evaluate(). */
export function OrbitPicker() {
  const scenario = useScenario()
  const flight = useGame((s) => s.design.flight)
  const setOrbit = useGame((s) => s.setOrbit)
  const setAltitude = useGame((s) => s.setAltitude)
  const ev = useEvaluation()
  const orbit = findOrbit(gameData, flight.orbitId)
  const altitudeKm = orbit ? clampAltitude(orbit, flight.altitudeKm) : 0
  const stations = gameData.stations
  const passes = orbit ? stations.filter((s) => flight.stationIds.includes(s.id)).reduce((n, s) => n + (s.passesPerDay[orbit.id] ?? 0), 0) : 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">Orbit</h2>
        <p className="text-sm text-muted">Where your spacecraft flies decides what it can see, how long it stays up, and how often it can talk to Earth.</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Orbit">
        {gameData.orbits.map((o) => {
          const lock = ev.compat.orbits[o.id]
          const locked = lock && !lock.ok
          const selected = o.id === flight.orbitId
          const fits = o.revisitDays > 0 && o.revisitDays <= scenario.revisitDays
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={selected}
              disabled={locked && !selected}
              onClick={() => setOrbit(selected ? null : o.id)}
              title={o.tooltip}
              className={cn(
                'relative rounded-xl border p-3 text-left transition-colors',
                selected ? (locked ? 'border-bad bg-bad/10' : 'border-accent bg-accent/10') : 'border-space-700 bg-space-900 hover:border-space-600',
                locked && !selected && 'cursor-not-allowed opacity-45 hover:border-space-700',
              )}
            >
              <span className="flex items-center gap-2">
                <span className="rounded bg-space-700 px-1.5 py-0.5 font-display text-xs font-semibold">{o.kind.toUpperCase()}</span>
                <span className="font-medium">{o.name}</span>
              </span>
              <span className="mt-1.5 block text-xs leading-snug text-muted">{o.tooltip}</span>
              <span className="mt-1.5 block text-[11px] text-muted tabular-nums">
                {o.minAltitudeKm === o.maxAltitudeKm ? `${o.altitudeKm.toLocaleString()} km` : `${o.minAltitudeKm}–${o.maxAltitudeKm} km`}
                {o.revisitDays > 0 ? ` · revisits every ${o.revisitDays} days` : ' · watches one spot all the time'}
              </span>
              {fits && !locked && (
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent">
                  <Star className="size-3" aria-hidden /> Meets the {scenario.revisitDays}-day revisit target
                </span>
              )}
              {locked && (
                <span className="mt-2 flex items-start gap-1 text-[11px] text-bad">
                  <Lock className="mt-px size-3 shrink-0" aria-hidden /> {lock.reason}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {orbit && ev.orbit && (
        <div className="grid gap-4 rounded-xl border border-space-700 bg-space-900 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="flex flex-col items-center">
            <OrbitPreview orbit={orbit} altitudeKm={altitudeKm} periodMin={ev.orbit.periodMin} />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {orbit.minAltitudeKm < orbit.maxAltitudeKm && (
              <label className="block">
                <span className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">Altitude</span>
                  <span className="font-display font-semibold tabular-nums">{Math.round(altitudeKm).toLocaleString()} km</span>
                </span>
                <input
                  type="range"
                  min={orbit.minAltitudeKm}
                  max={orbit.maxAltitudeKm}
                  step={10}
                  value={altitudeKm}
                  onChange={(e) => setAltitude(Number(e.target.value))}
                  className="mt-1 h-8 w-full cursor-pointer accent-[var(--color-accent)]"
                />
                <span className="flex justify-between text-[11px] text-muted">
                  <span>Lower: falls back to Earth sooner</span>
                  <span>Higher: stays up for decades</span>
                </span>
              </label>
            )}

            <OrbitFacts orbit={orbit} info={ev.orbit} passes={passes} latencyHours={ev.totals.latencyHours} />

            <GroundTrack orbit={orbit} altitudeKm={altitudeKm} periodMin={ev.orbit.periodMin} stations={stations} selectedStationIds={flight.stationIds} />
          </div>
        </div>
      )}
    </div>
  )
}

function OrbitFacts({ orbit, info, passes, latencyHours }: { orbit: Orbit; info: OrbitInfo; passes: number; latencyHours: number }) {
  const geo = orbit.kind === 'geo'
  const facts: [React.ReactNode, string, string][] = [
    ['One orbit', geo ? '1 day' : `${Math.round(info.periodMin)} min`, geo ? 'Turns with the Earth' : `${n1(info.orbitsPerDay)} orbits a day`],
    [<Term id="eclipse">In shadow</Term>, `${Math.round(info.eclipseMin)} min`, `${Math.round(info.eclipseFraction * 100)}% of each orbit on battery`],
    ['Stays up', info.decayYears >= 1000 ? 'Forever' : `${n1(info.decayYears)} years`, 'Before air drag brings it down with no fuel'],
    ['Revisit', orbit.revisitDays === 0 ? 'Always' : `${orbit.revisitDays} days`, 'How often it sees the same place'],
    [
      'Ground passes',
      geo && passes > 0 ? 'Always' : `${passes} a day`,
      passes === 0 ? 'Pick ground stations that can see this orbit' : Number.isFinite(latencyHours) ? `Images wait about ${n1(latencyHours)} h to reach Earth` : 'Chances to send data home',
    ],
  ]

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {facts.map(([k, v, hint], i) => (
        <div key={i}>
          <dt className="text-[11px] text-muted uppercase">{k}</dt>
          <dd className="font-display font-semibold tabular-nums">{v}</dd>
          <dd className="text-[11px] leading-snug text-muted">{hint}</dd>
        </div>
      ))}
    </dl>
  )
}
