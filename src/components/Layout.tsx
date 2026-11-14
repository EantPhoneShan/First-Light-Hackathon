import { BookOpen, Rocket, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useConflictAlerts } from '@/hooks/useConflictAlerts'
import { cn } from '@/lib/cn'
import { setMuted, useMuted } from '@/lib/sound'
import { flow } from '@/routes'
import { TutorialGuide } from '@/components/TutorialGuide'
import { SyncStatusDot } from '@/components/SyncStatusDot'
import { useTeamSyncBridge } from '@/sync/teamBridge'
import { roleNames } from '@/engine/mockReview'
import type { Role } from '@/engine/placeholderTypes'
import { useGame, useScenario } from '@/store/game'

export function Layout() {
  const { pathname } = useLocation()
  useConflictAlerts()
  useTeamSyncBridge()
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
  const players = useGame((s) => s.room.players)
  const myRole = useGame((s) => s.myRole)
  const setMyRole = useGame((s) => s.setMyRole)
  const current = flow.findIndex((s) => s.path === pathname)

  return (
    <div className="flex min-h-screen flex-col">
      <header ref={headerRef} className="sticky top-0 z-10 border-b border-space-700 bg-space-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold">
            <Rocket className="size-5 text-accent" aria-hidden />
            First Light
          </Link>
          <span className="hidden truncate text-sm text-muted sm:inline">
            {scenario.name}
            {tutorial && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">Tutorial</span>}
          </span>
          {players.length > 0 && (
            <label className="ml-auto flex items-center gap-2 text-sm text-muted">
              <span className="hidden sm:inline">Acting as</span>
              <select
                value={myRole}
                onChange={(e) => setMyRole(e.target.value as Role)}
                aria-label="Acting as"
                className="max-w-40 rounded-lg border border-space-600 bg-space-950 px-2 py-2 text-ink sm:py-1"
              >
                {(Object.keys(roleNames) as Role[]).map((r) => {
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
          <Link to="/learn" className={cn('-m-2 flex items-center gap-1.5 rounded-lg p-2 text-sm text-muted hover:text-ink', players.length === 0 && 'ml-auto')}>
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

        <nav aria-label="Mission phases" className="mx-auto max-w-6xl overflow-x-auto px-4 pb-3">
          <ol className="flex min-w-max gap-1">
            {flow.map((step, i) => (
              <li key={step.path}>
                <Link
                  to={step.path}
                  aria-current={i === current ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors sm:py-1',
                    i === current && 'bg-accent text-space-950',
                    i < current && 'bg-space-700 text-ink',
                    i > current && 'text-muted hover:text-ink',
                  )}
                >
                  <span className="tabular-nums">{i + 1}</span>
                  {step.label}
                  {step.cml && <span className="opacity-70">· {step.cml}</span>}
                </Link>
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
