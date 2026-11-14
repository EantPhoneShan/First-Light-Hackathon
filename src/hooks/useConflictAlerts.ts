import { useEffect } from 'react'
import { toast } from 'sonner'
import { evaluate } from '@/engine/rules'
import { conflictAlerts } from '@/game/checks'
import { gameData, roleNames } from '@/game/ui'
import { play } from '@/lib/sound'
import { canSeeGauge, scenarioById, useGame } from '@/store/game'

/**
 * F11: when a design change pushes a resource into amber or red, tell the role that watches it.
 * Mounted once in the layout. Member 3's sync will make remote changes trigger this too.
 */
export function useConflictAlerts() {
  useEffect(
    () =>
      useGame.subscribe((state, prev) => {
        if (state.design === prev.design || state.designVersion <= prev.designVersion) return
        // Loading a whole design (starting or ending the tutorial) isn't a player's change.
        if (state.tutorial !== prev.tutorial || prev.designVersion === 0) return
        const scenario = scenarioById(state.scenarioId)
        const alerts = conflictAlerts(evaluate(prev.design, scenario, gameData), evaluate(state.design, scenario, gameData), state.updatedBy)
        if (alerts.length) play(alerts.some((a) => a.status === 'fail') ? 'error' : 'alert')
        for (const a of alerts) {
          // Only the watching role sees the numbers. Everyone else just learns that someone needs a word.
          if (!canSeeGauge(a.resource, { myRole: state.myRole, players: state.players })) {
            const name = state.players.find((p) => p.role === a.hurt)?.name
            toast(`${name ?? roleNames[a.hurt]} got an alert`, {
              id: `alert-${a.resource}`,
              description: `Your change affected something only the ${roleNames[a.hurt]} can see. Ask ${name ?? 'them'} how it looks.`,
            })
            continue
          }
          const show = a.status === 'fail' ? toast.error : toast.warning
          show(a.title, { id: `alert-${a.resource}`, description: a.body })
        }
      }),
    [],
  )
}
