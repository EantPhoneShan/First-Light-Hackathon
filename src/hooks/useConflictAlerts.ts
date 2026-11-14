import { useEffect } from 'react'
import { toast } from 'sonner'
import { conflictAlerts } from '@/engine/mockReview'
import { canSeeGauge, currentScenario, useGame } from '@/store/game'
import { resourceOwner, roleNames } from '@/engine/mockReview'
import { play } from '@/lib/sound'

/**
 * F11: when a design change pushes a resource into amber or red, tell the role it hurts.
 * Mounted once in the layout. Member 3's sync will make remote changes trigger this too.
 */
export function useConflictAlerts() {
  useEffect(
    () =>
      useGame.subscribe((state, prev) => {
        if (state.design === prev.design || state.design.version <= prev.design.version) return
        // Loading a whole design (starting or ending the tutorial) isn't a player's change.
        if (state.tutorial !== prev.tutorial) return
        const scenario = currentScenario(state)
        const alerts = conflictAlerts(prev.design, state.design, scenario, state.design.updatedBy)
        if (alerts.length) play(alerts.some((a) => a.status === 'bad') ? 'error' : 'alert')
        for (const a of alerts) {
          // Only the watching role sees the numbers. Everyone else just learns that someone needs a word.
          if (!canSeeGauge(a.resource, { myRole: state.myRole, players: state.room.players })) {
            const who = roleNames[resourceOwner[a.resource]]
            const name = state.room.players.find((p) => p.role === resourceOwner[a.resource])?.name
            toast(`${name ?? who} got an alert`, {
              id: `alert-${a.resource}`,
              description: `Your change affected something only the ${who} can see. Ask ${name ?? 'them'} how it looks.`,
            })
            continue
          }
          const show = a.status === 'bad' ? toast.error : toast.warning
          show(a.title, { id: `alert-${a.resource}`, description: a.body })
        }
      }),
    [],
  )
}
