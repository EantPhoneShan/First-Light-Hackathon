import { ArrowRight, Box, ClipboardList, FlaskConical, RadioTower, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Art } from '@/components/Art'
import { Screen } from '@/components/Screen'
import { ROLE_ORDER, roleNames } from '@/game/ui'
import type { Role } from '@/engine/types'
import { TeamDevicesPanel } from '@/components/TeamDevicesPanel'
import { cn } from '@/lib/cn'
import { useGame } from '@/store/game'

const roleInfo: Record<Role, { icon: LucideIcon; owns: string; does: string }> = {
  planner: { icon: ClipboardList, owns: 'Budget', does: 'Sets the requirements and is the only one who sees the budget. Warn the team before it runs out.' },
  engineer: { icon: Box, owns: 'Build time', does: 'Builds the spacecraft, but only sees build time. Listen to the others: they see what your parts do.' },
  science: { icon: FlaskConical, owns: 'Power, data & comms', does: 'Picks the science and watches power and data. Tell the Engineer when either gets too high.' },
  flight: { icon: RadioTower, owns: 'Mass, delta-v', does: 'Picks the orbit, rocket and ground stations, and watches mass and delta-v.' },
}

/** Team mode MVP: one shared screen, four role panels. Separate devices with room codes: TeamDevicesPanel (Member 3). */
export function Lobby() {
  const players = useGame((s) => s.players)
  const setPlayer = useGame((s) => s.setPlayer)
  const setMyRole = useGame((s) => s.setMyRole)
  const navigate = useNavigate()
  const roles = ROLE_ORDER
  const nameOf = (r: Role) => players.find((p) => p.role === r)?.name ?? ''
  const filled = players.length

  const start = () => {
    const first = roles.find((r) => nameOf(r))
    setMyRole(first ?? 'solo')
    navigate('/briefing')
  }

  return (
    <Screen title="Team mission" subtitle="Up to four players share this screen. Each takes a role and signs off on the design." hideNext>
      <div className="grid gap-3 sm:grid-cols-2">
        {roles.map((r) => {
          const { icon: Icon, owns, does } = roleInfo[r]
          const name = nameOf(r)
          return (
            <div key={r} className={cn('rounded-xl border p-4 transition-colors', name ? 'border-accent/60 bg-accent/5' : 'border-space-700 bg-space-900')}>
              <div className="flex items-center gap-3">
                <Art
                  name={`role-${r}`}
                  className={cn('size-14 shrink-0 transition-[filter,opacity]', !name && 'opacity-60 grayscale')}
                  fallback={
                    <span className={cn('flex size-10 items-center justify-center rounded-full', name ? 'bg-accent text-space-950' : 'bg-space-800 text-muted')}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                  }
                />
                <div>
                  <h2 className="font-display font-semibold">{roleNames[r]}</h2>
                  <p className="text-xs text-muted">Sees: {owns}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">{does}</p>
              <label className="mt-3 block text-xs text-muted" htmlFor={`name-${r}`}>
                Player name
              </label>
              <input
                id={`name-${r}`}
                value={name}
                onChange={(e) => setPlayer(r, e.target.value)}
                placeholder="Leave empty if nobody takes this role"
                maxLength={24}
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-space-600 bg-space-950 px-3 py-2 text-sm placeholder:text-muted/60 focus:border-accent focus:outline-none"
              />
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-space-700 bg-space-900 p-4 text-sm text-muted sm:flex-row sm:items-center">
        <p className="flex-1">
          Each role only sees its own gauges, so talk to each other! Fewer than four players? Gauges for roles with no name are shared by everyone. Switch who is at the controls with <b className="text-ink">Acting as</b> at the top of
          the screen. Or each player can use their own device: see below.
        </p>
        <button
          onClick={start}
          disabled={filled === 0}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-space-950 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start briefing ({filled} player{filled === 1 ? '' : 's'})
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>

      <TeamDevicesPanel />
    </Screen>
  )
}
