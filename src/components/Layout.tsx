import { BookOpen, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useConflictAlerts } from '@/hooks/useConflictAlerts'
import { cn } from '@/lib/cn'
import { setMuted, useMuted } from '@/lib/sound'
import { flow } from '@/routes'
import { TutorialGuide } from '@/components/TutorialGuide'
import { ROLE_ORDER, roleNames } from '@/game/ui'
import type { Role } from '@/engine/types'
import { SyncStatusDot } from '@/components/SyncStatusDot'
import { useTeamSyncBridge } from '@/sync/teamBridge'
import { useTeamFlow } from '@/game/teamFlow'
import { useGame, useScenario } from '@/store/game'

export function Layout() {
  const { pathname } = useLocation()
  useConflictAlerts()
  useTeamSyncBridge()
  const teamFlow = useTeamFlow()
  // Expose the header's height so sticky bars (like the gauges) sit right under it on any screen.
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scenario = useScenario()
  const tutorial = useGame((s) => s.tutorial)
  const muted = useMuted()
  const players = useGame((s) => s.players)
  const myRole = useGame((s) => s.myRole)
  const setMyRole = useGame((s) => s.setMyRole)
  // In a team the stepper shows the room's step and can't be used to jump ahead:
  // only the Mission Planner moves everyone on, with Next.
  const locked = teamFlow.team || teamFlow.deviceRoom
  // Phones: keep the current step in view in the scrolling step bar.
  const stepsRef = useRef<HTMLElement>(null)
  const current = flow.findIndex((s) => (locked ? s.id === teamFlow.step : s.path === pathname))
  useEffect(() => {
    const nav = stepsRef.current
    const el = nav?.querySelector<HTMLElement>('[aria-current="step"]')
    if (!nav || !el) return
    nav.scrollTo({ left: el.offsetLeft - nav.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' })
  }, [current])

  return (
    <div className="flex min-h-screen flex-col">
      <header ref={headerRef} className="sticky top-0 z-10 border-b border-space-700 bg-space-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold">
            <img src="/assets/svg/logo.svg" alt="" className="h-6 w-auto" draggable={false} />
            First Light
          </Link>
          <span className="hidden truncate text-sm text-muted sm:inline">
            {scenario.name}
            {tutorial && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">Tutorial</span>}
          </span>
          {/* Shared screen only: on separate devices each player is their own role. */}
          {players.length > 0 && !teamFlow.deviceRoom && (
            <label className="ml-auto flex items-center gap-2 text-sm text-muted">
              <span className="hidden sm:inline">Acting as</span>
              <select
                value={myRole}
                onChange={(e) => setMyRole(e.target.value as Role)}
                aria-label="Acting as"
                className="max-w-40 rounded-lg border border-space-600 bg-space-950 px-2 py-2 text-ink sm:py-1"
              >
                {ROLE_ORDER.map((r) => {
                  const p = players.find((pl) => pl.role === r)
                  return (
                    <option key={r} value={r}>
                      {p ? `${p.name} · ${roleNames[r]}` : roleNames[r]}
                    </option>
                  )
                })}
              </select>
            </label>
          )}
          <SyncStatusDot showLabel />
          <Link to="/learn" className={cn('-m-2 flex items-center gap-1.5 rounded-lg p-2 text-sm text-muted hover:text-ink', (players.length === 0 || teamFlow.deviceRoom) && 'ml-auto')}>
            <BookOpen className="size-4" aria-hidden />
            <span className="hidden sm:inline">Space words</span>
          </Link>
          <button
            onClick={() => setMuted(!muted)}
            aria-pressed={muted}
            aria-label={muted ? 'Turn sound on' : 'Mute sound'}
            title={muted ? 'Turn sound on' : 'Mute sound'}
            className="-m-2 ml-1 rounded-lg p-2 text-muted hover:text-ink"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>

        <nav ref={stepsRef} aria-label="Mission phases" className="mx-auto max-w-6xl overflow-x-auto px-4 pb-3">
          <ol className="flex min-w-max gap-1">
            {flow.map((step, i) => (
              <li key={step.path}>
                {(() => {
                  const cls = cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors sm:py-1',
                    i === current && 'bg-accent text-space-950',
                    i < current && 'bg-space-700 text-ink',
                    i > current && 'text-muted',
                    i > current && !locked && 'hover:text-ink',
                  )
                  const body = (
                    <>
                      <span className="font-mono tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      {step.label}
                      {step.cml && <span className="opacity-70">· {step.cml}</span>}
                    </>
                  )
                  // Team play: everyone is on the room's step, so the stepper is a map, not a menu.
                  return locked ? (
                    <span aria-current={i === current ? 'step' : undefined} title={step.what} className={cls}>
                      {body}
                    </span>
                  ) : (
                    <Link to={step.path} aria-current={i === current ? 'step' : undefined} title={step.what} className={cls}>
                      {body}
                    </Link>
                  )
                })()}
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <main className={cn('mx-auto w-full max-w-6xl flex-1 px-4 py-6', tutorial && 'pb-56')}>
        <Outlet />
      </main>
      <TutorialGuide />
    </div>
  )
}
