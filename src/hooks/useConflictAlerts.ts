import { useEffect } from 'react'
import { toast } from 'sonner'
import { conflictAlerts } from '@/engine/alerts'
import { RESOURCES, type ResourceId } from '@/engine/types'
import { GAUGE_WATCHER, gameData, roleNames } from '@/game/ui'
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
        const alerts = conflictAlerts(prev.design, state.design, scenarioById(state.scenarioId), gameData, {
          byRole: state.updatedBy ?? undefined,
          byName,
          // Ask for every alert: Member 1's hurtRole uses RESOURCE_OWNER (Engineer owns power), but in
          // team play the gauge's WATCHER is who needs to hear (team rule), so we route below.
          includeSelf: true,
        }).filter((a) => {
          const to = isGauge(a.resource) ? GAUGE_WATCHER[a.resource] : a.hurtRole
          return solo || to !== a.byRole
        })
        if (alerts.length) play(alerts.some((a) => a.after === 'fail') ? 'error' : 'alert')
        for (const a of alerts) {
          // Gauge alerts go to whoever watches that gauge (team rule); others to Member 1's hurt role.
          const hurt = isGauge(a.resource) ? GAUGE_WATCHER[a.resource] : a.hurtRole
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
