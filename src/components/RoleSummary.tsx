import type { ReactNode } from 'react'
import type { Role } from '@/engine/types'
import { roleNames } from '@/game/ui'
import { useGame } from '@/store/game'

/**
 * Team play: in place of another role's controls, a short read-only note of
 * what that role decided. Each player sees only their own work in full.
 */
export function RoleSummary({ role, children }: { role: Role; children: ReactNode }) {
  const name = useGame((s) => s.players.find((p) => p.role === role)?.name)
  return (
    <section className="rounded-xl border border-dashed border-space-600 bg-space-900 p-4 text-sm text-muted">
      <h2 className="text-xs tracking-wide uppercase">
        {roleNames[role]}'s decision{name ? ` · ${name}` : ''}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}
