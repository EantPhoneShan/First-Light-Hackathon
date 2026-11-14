import { Lock, Star } from 'lucide-react'
import { orbitById, orbits, orbitStats, stations } from '@/engine/mock'
import type { Orbit } from '@/engine/placeholderTypes'
import { cn } from '@/lib/cn'
import { useGame, useScenario } from '@/store/game'
import { GroundTrack } from './GroundTrack'
import { OrbitPreview } from './OrbitPreview'

/** Orbit cards, altitude slider and live previews (task 2.5, PRD F8). */
export function OrbitPicker() {
  const scenario = useScenario()
  const design = useGame((s) => s.design)
  const updateDesign = useGame((s) => s.updateDesign)
  const orbit = orbitById(design.orbitId)
  const stats = orbitStats(design)
  const advancedLocked = scenario.difficulty === 'easy'

  const choose = (o: Orbit) => updateDesign({ orbitId: o.id, altitudeKm: o.altitudeKm?.default ?? 0 })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold">Orbit</h2>
        <p className="text-sm text-muted">Where your spacecraft flies decides what it can see, how sharp its pictures are, and how often it can talk to Earth.</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Orbit">
        {orbits.map((o) => {
          const locked = o.tier === 'advanced' && advancedLocked
          const selected = o.id === design.orbitId
          const good = scenario.goodOrbits.includes(o.id)
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={selected}
              disabled={locked}
              onClick={() => choose(o)}
              className={cn(
                'relative rounded-xl border p-3 text-left transition-colors',
                selected ? 'border-accent bg-accent/10' : 'border-space-700 bg-space-900 hover:border-space-600',
                locked && 'cursor-not-allowed opacity-45 hover:border-space-700',
              )}
            >
              <span className="flex items-center gap-2">
                <span className="rounded bg-space-700 px-1.5 py-0.5 font-display text-xs font-semibold">{o.short}</span>
                <span className="font-medium">{o.name}</span>
              </span>
              <span className="mt-1.5 block text-xs leading-snug text-muted">{o.goodFor}</span>
              {good && !locked && (
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent">
                  <Star className="size-3" aria-hidden /> Fits {scenario.name}
                </span>
              )}
              {locked && (
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted">
                  <Lock className="size-3" aria-hidden /> Unlocks on Medium missions
                </span>
              )}
            </button>
          )
        })}
      </div>

      {orbit && stats && (
        <div className="grid gap-4 rounded-xl border border-space-700 bg-space-900 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="flex flex-col items-center">
            <OrbitPreview orbit={orbit} altitudeKm={design.altitudeKm} periodMin={stats.periodMin} />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {orbit.altitudeKm && orbit.altitudeKm.min < orbit.altitudeKm.max && (
              <label className="block">
                <span className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">Altitude</span>
                  <span className="font-display font-semibold tabular-nums">{Math.round(design.altitudeKm).toLocaleString()} km</span>
                </span>
                <input
                  type="range"
                  min={orbit.altitudeKm.min}
                  max={orbit.altitudeKm.max}
                  step={orbit.altitudeKm.max > 5000 ? 100 : 10}
                  value={design.altitudeKm}
                  onChange={(e) => updateDesign({ altitudeKm: Number(e.target.value) })}
                  className="mt-1 h-8 w-full cursor-pointer accent-[var(--color-accent)]"
                />
                <span className="flex justify-between text-[11px] text-muted">
                  <span>Lower: sharper images, shorter life</span>
                  <span>Higher: wider view, longer life</span>
                </span>
              </label>
            )}

            <OrbitFacts stats={stats} deep={!orbit.altitudeKm} />

            <GroundTrack orbit={orbit} altitudeKm={design.altitudeKm} periodMin={stats.periodMin} stations={stations} selectedStationIds={design.stationIds} />
          </div>
        </div>
      )}
    </div>
  )
}

function OrbitFacts({ stats, deep }: { stats: NonNullable<ReturnType<typeof orbitStats>>; deep: boolean }) {
  const facts: [string, string, string][] = deep
    ? [['Ground contacts', `${stats.passesPerDay} per day`, 'Long, slow contacts through big dishes.']]
    : [
        ['One orbit', `${Math.round(stats.periodMin)} min`, `${stats.orbitsPerDay.toFixed(1)} orbits a day`],
        ['In shadow', `${Math.round(stats.eclipseMin)} min`, `${Math.round(stats.eclipsePct)}% of each orbit on battery`],
        ['Revisit', stats.revisitDays === 0 ? 'Always' : `${stats.revisitDays!.toFixed(1)} days`, 'How often it sees the same place'],
        ['Image detail', `${stats.detailM!.toFixed(stats.detailM! < 10 ? 1 : 0)} m`, 'Size of one pixel on the ground'],
        ['Ground passes', `${stats.passesPerDay} a day`, stats.passesPerDay === 0 ? 'Pick ground stations that can see this orbit' : 'Chances to send data home'],
      ]

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {facts.map(([k, v, hint]) => (
        <div key={k} title={hint}>
          <dt className="text-[11px] text-muted uppercase">{k}</dt>
          <dd className="font-display font-semibold tabular-nums">{v}</dd>
          <dd className="text-[11px] leading-snug text-muted">{hint}</dd>
        </div>
      ))}
    </dl>
  )
}
