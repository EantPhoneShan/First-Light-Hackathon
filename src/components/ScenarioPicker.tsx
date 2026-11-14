import { CheckCircle2 } from 'lucide-react'
import { PartIcon } from '@/components/workbench/PartIcon'
import { findBus } from '@/engine/data'
import { gameData } from '@/game/ui'
import { cn } from '@/lib/cn'
import { useGame, useScenario } from '@/store/game'

const difficultyStyle = { easy: 'text-ok', medium: 'text-warn', hard: 'text-bad', expert: 'text-bad' } as const

/**
 * Pick the mission (scenario). One card per scenario in Member 1's scenarios.json,
 * showing the spacecraft it flies (e.g. Flood Radar's small satellite).
 * Changing the mission starts a fresh design, so in a team only the Mission Planner can.
 */
export function ScenarioPicker({ disabled, who = 'Mission Planner' }: { disabled?: boolean; who?: string }) {
  const scenario = useScenario()
  const setScenario = useGame((s) => s.setScenario)
  const designVersion = useGame((s) => s.designVersion)

  const pick = (id: string) => {
    if (disabled || id === scenario.id) return
    // Switching mission clears the design; check first if someone already built something.
    if (designVersion > 0 && !window.confirm('Switch mission? This clears the current design for the whole team.')) return
    setScenario(id)
  }

  return (
    <div role="radiogroup" aria-label="Mission" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" title={disabled ? `Only the ${who} picks the mission.` : undefined}>
      {gameData.scenarios.map((sc) => {
        const selected = sc.id === scenario.id
        const bus = findBus(gameData, sc.busIds[Math.floor(sc.busIds.length / 2)])
        return (
          <button
            key={sc.id}
            role="radio"
            aria-checked={selected}
            disabled={disabled && !selected}
            onClick={() => pick(sc.id)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              selected ? 'border-accent bg-accent/10' : 'border-space-700 bg-space-900',
              !disabled && !selected && 'hover:border-space-600',
              disabled && selected && 'cursor-default',
            )}
          >
            {bus && <PartIcon item={bus} className="size-14 shrink-0" />}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-display font-semibold">{sc.name}</span>
                {selected && <CheckCircle2 className="size-4 shrink-0 text-accent" aria-hidden />}
              </span>
              <span className={cn('block text-xs capitalize', difficultyStyle[sc.difficulty])}>
                {sc.difficulty} · {bus?.name ?? 'Spacecraft'}
              </span>
              <span className="mt-1 line-clamp-3 block text-xs text-muted">{sc.tooltip}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
