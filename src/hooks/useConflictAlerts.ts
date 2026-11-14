import { useEffect } from 'react'
import { toast } from 'sonner'
import { conflictAlerts } from '@/engine/alerts'
import { RESOURCES, type ResourceId } from '@/engine/types'
import { gameData, roleNames } from '@/game/ui'
import { play } from '@/lib/sound'
import { canSeeGauge, scenarioById, useGame } from '@/store/game'

const isGauge = (r: string): r is ResourceId => (RESOURCES as string[]).includes(r)

/**
 * F11: when a design change hurts another role, tell that role (Member 1's alerts.ts says who
 * was hurt, by whom, and how to fix it). Mounted once in the layout; with Member 3's sync,
 * remote changes arrive through the same store update and alert here too.
 */
export function useConflictAlerts() {
  useEffect(
    () =>
      useGame.subscribe((state, prev) => {
        if (state.design === prev.design || state.designVersion <= prev.designVersion) return
        // Loading a whole design (starting or ending the tutorial) isn't a player's change.
        if (state.tutorial !== prev.tutorial || prev.designVersion === 0) return
        const solo = state.players.length === 0
        const byName = state.players.find((p) => p.role === state.updatedBy)?.name
        // Member 1's alerts now go to the gauge's watcher (RESOURCE_WATCHER) and already leave out
        // the player's own role. Solo players hold every role, so they want every alert.
        const alerts = conflictAlerts(prev.design, state.design, scenarioById(state.scenarioId), gameData, {
          byRole: state.updatedBy ?? undefined,
          byName,
          includeSelf: solo,
        })
        if (alerts.length) play(alerts.some((a) => a.after === 'fail') ? 'error' : 'alert')
        for (const a of alerts) {
          const hurt = a.hurtRole
          const visible = solo || (isGauge(a.resource) ? canSeeGauge(a.resource, { myRole: state.myRole, players: state.players }) : state.myRole === hurt)
          if (!visible) {
            const name = state.players.find((p) => p.role === hurt)?.name
            toast(`${name ?? roleNames[hurt]} got an alert`, {
              id: `alert-${a.id}`,
              description: `Your change affected something only the ${roleNames[hurt]} can see. Ask ${name ?? 'them'} how it looks.`,
            })
            continue
          }
          const show = a.after === 'fail' ? toast.error : toast.warning
          show(a.message, { id: `alert-${a.id}`, description: a.fixes.length ? `Try: ${a.fixes.join(' Or: ')}` : undefined })
        }
      }),
    [],
  )
}
