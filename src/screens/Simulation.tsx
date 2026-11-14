import { AnimatePresence, motion } from 'framer-motion'
import { BatteryMedium, Database, Moon, Pause, Play, RadioTower, RotateCcw, Satellite, Send, Sun } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { drawScene, makeStars } from '@/components/sim/drawScene'
import { Screen } from '@/components/Screen'
import { clampAltitude } from '@/engine/rules'
import { findOrbit } from '@/engine/data'
import { gameData } from '@/game/ui'
import { createSim, initialState, stepSim } from '@/sim/standInSim'
import type { SimState } from '@/sim/types'
import { cn } from '@/lib/cn'
import { useEvaluation, useGame, useScenario } from '@/store/game'
import { Term } from '@/components/Term'
import { play } from '@/lib/sound'

/** Playback speeds in simulated minutes per real second (PRD: 1 orbit in a few s, 1 year in ~30 s). */
const speeds = [
  { id: 'orbit', label: '1 orbit / 4 s', short: 'Orbit', perSec: (p: number) => p / 4 },
  { id: 'day', label: '1 day / 5 s', short: 'Day', perSec: () => 1440 / 5 },
  { id: 'month', label: '1 month / 10 s', short: 'Month', perSec: () => 43800 / 10 },
  { id: 'year', label: '1 year / 30 s', short: 'Year', perSec: () => 525600 / 30 },
] as const
type SpeedId = (typeof speeds)[number]['id']

/** One sound per notable log event (the once-only ones, so fast speeds don't spam). */
function eventSound(text: string, kind: string) {
  if (text.startsWith("Entered Earth's shadow")) play('eclipse')
  else if (text.startsWith('First light')) play('firstLight')
  else if (text.startsWith('Storage full')) play('alert')
  else if (text.startsWith('Mission lifetime reached')) play('complete')
  else if (kind === 'bad') play('dead')
}

const fmtMB = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`)

const kindStyle = { info: 'text-muted', good: 'text-ok', warn: 'text-warn', bad: 'text-bad' } as const

function fmtElapsed(m: number) {
  if (m < 1440) return `${Math.floor(m / 60)} h ${Math.floor(m % 60)} min`
  // Day index counts the day we're in, so the exact end of year 3 reads "Year 3, day 365", not "Year 4, day 1".
  const days = Math.ceil(m / 1440) - 1
  if (days < 0) return `${Math.floor(m / 60)} h ${Math.floor(m % 60)} min`
  if (days < 365) return `Day ${days + 1}`
  return `Year ${Math.floor(days / 365) + 1}, day ${(days % 365) + 1}`
}

/** Time-accelerated mission view (task 2.6, PRD F14). */
export function Simulation() {
  const scenario = useScenario()
  const design = useGame((s) => s.design)
  const saveFlight = useGame((s) => s.saveFlight)
  const ev = useEvaluation()
  const designVersion = useGame((s) => s.designVersion)
  const orbit = findOrbit(gameData, design.flight.orbitId)
  const altitudeKm = orbit ? clampAltitude(orbit, design.flight.altitudeKm) : 500
  const ctx = useMemo(() => createSim(design, scenario, ev), [design, scenario, ev])

  const stateRef = useRef<SimState>(initialState(ctx))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stars = useMemo(() => makeStars(), [])
  const [speed, setSpeed] = useState<SpeedId>('orbit')
  const [paused, setPaused] = useState(false)
  const [, setFrame] = useState(0) // re-render the dashboard a few times a second
  const savedRef = useRef(false)
  const speedRef = useRef(speed)
  const pausedRef = useRef(paused)
  speedRef.current = speed
  pausedRef.current = paused

  const restart = useCallback(() => {
    stateRef.current = initialState(ctx)
    savedRef.current = false
    setSpeed('orbit')
    setPaused(false)
    setFrame((f) => f + 1)
  }, [ctx])

  useEffect(restart, [restart])

  // Main loop: advance the sim by real time × speed, draw, and refresh the dashboard ~12×/s.
  useEffect(() => {
    if (!ctx.ready) return
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const loop = (now: number) => {
      const dtSec = Math.min(0.1, (now - last) / 1000)
      last = now
      const s = stateRef.current
      if (!pausedRef.current && s.status === 'flying') {
        const sp = speeds.find((x) => x.id === speedRef.current)!
        const before = s.events.length
        stepSim(s, ctx, sp.perSec(ctx.periodMin) * dtSec)
        for (const e of s.events.slice(before)) eventSound(e.text, e.kind)
      }

      const c = canvasRef.current
      if (c) {
        const dpr = window.devicePixelRatio || 1
        const w = c.clientWidth
        const h = c.clientHeight
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
          c.width = Math.round(w * dpr)
          c.height = Math.round(h * dpr)
        }
        const g = c.getContext('2d')!
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
        drawScene(g, w, h, s, ctx, stars, altitudeKm)
      }

      if (s.status !== 'flying' && !savedRef.current) {
        savedRef.current = true
        saveFlight({
          status: s.status,
          endMin: s.tMin,
          lifetimeMin: ctx.lifetimeMin,
          madeMB: s.madeMB,
          deliveredMB: s.deliveredMB,
          lostMB: s.lostMB,
          events: [...s.events],
          samples: [...s.samples],
          designVersion,
          design,
        })
      }
      if (now - lastUi > 80 || s.status !== 'flying') {
        lastUi = now
        setFrame((f) => f + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [ctx, stars, design, saveFlight])

  if (!ctx.ready) {
    return (
      <Screen title="Mission simulation" hideNext>
        <div className="rounded-xl border border-space-700 bg-space-900 p-6">
          <p>Your spacecraft can't fly yet:</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted">
            {(ctx.missing.length ? ctx.missing : ['Pick an orbit on the workbench.']).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <Link to="/workbench" className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-space-950 hover:bg-accent-strong">
            Back to the workbench
          </Link>
        </div>
      </Screen>
    )
  }

  const s = stateRef.current
  const batteryPct = ctx.batteryCapWh ? (s.batteryWh / ctx.batteryCapWh) * 100 : 0
  const bufferPct = (s.bufferMB / ctx.bufferCapMB) * 100
  const reachedPct = s.madeMB > 0 ? (s.deliveredMB / s.madeMB) * 100 : 0
  const missionPct = Math.min(100, (s.tMin / ctx.lifetimeMin) * 100)
  const ended = s.status !== 'flying'

  return (
    <Screen title="Mission simulation" subtitle={`${scenario.name}: ${scenario.objective.toLowerCase()}.`} reqs="F14" hideNext>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Orbit view */}
        <div className="relative overflow-hidden rounded-xl border border-space-700">
          <canvas ref={canvasRef} className="block aspect-square w-full sm:aspect-[4/3]" aria-label="Spacecraft orbiting Earth" role="img" />

          <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5">
            <Chip on={!s.inEclipse} icon={s.inEclipse ? Moon : Sun} tone={s.inEclipse ? 'muted' : 'warn'}>
              {s.inEclipse ? <Term id="eclipse" align="end">In shadow</Term> : 'Sunlit'}
            </Chip>
            <Chip on={s.inContact} icon={RadioTower} tone={s.inContact ? 'ok' : 'muted'}>
              {s.inContact ? <Term id="downlink" align="end">Sending data</Term> : 'No contact'}
            </Chip>
          </div>

          <AnimatePresence>
            {ended && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-space-950/70 p-4 backdrop-blur-[2px]"
              >
                <motion.div initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} className="max-w-sm rounded-xl border border-space-600 bg-space-900 p-5 text-center shadow-2xl">
                  <p className={cn('font-display text-2xl font-bold', s.status === 'dead' ? 'text-bad' : 'text-ok')}>
                    {s.status === 'dead' ? 'Mission lost' : 'Mission complete'}
                  </p>
                  <p className="mt-2 text-sm">{s.events[s.events.length - 1]?.text}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Link to="/report" className="rounded-lg bg-accent px-4 py-2 font-medium text-space-950 hover:bg-accent-strong">
                      {s.status === 'dead' ? "Let's find out why" : 'See mission report'}
                    </Link>
                    <button onClick={restart} className="rounded-lg border border-space-600 px-4 py-2 hover:bg-space-800">
                      Fly again
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dashboard */}
        <aside className="flex flex-col gap-3">
          <div className="rounded-xl border border-space-700 bg-space-900 p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-lg font-semibold tabular-nums">{fmtElapsed(s.tMin)}</span>
              <span className="text-xs text-muted tabular-nums">orbit {Math.floor(s.tMin / ctx.periodMin) + 1}</span>
            </div>
            <Bar label="Mission progress" value={missionPct} text={`${missionPct.toFixed(missionPct < 1 ? 2 : 0)}% of ${scenario.lifetimeYears} years`} tone="accent" />

            <div className="mt-3 flex items-center gap-1.5">
              <button
                onClick={() => setPaused((p) => !p)}
                disabled={ended}
                className="rounded-lg bg-space-700 p-2 hover:bg-space-600 disabled:opacity-40"
                aria-label={paused ? 'Play' : 'Pause'}
              >
                {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </button>
              <div className="flex flex-1 gap-1 rounded-lg bg-space-800 p-1" role="radiogroup" aria-label="Speed">
                {speeds.map((sp) => (
                  <button
                    key={sp.id}
                    role="radio"
                    aria-checked={speed === sp.id}
                    title={sp.label}
                    onClick={() => setSpeed(sp.id)}
                    className={cn('flex-1 rounded-md px-1 py-2 text-xs transition-colors sm:py-1', speed === sp.id ? 'bg-accent text-space-950' : 'text-muted hover:text-ink')}
                  >
                    {sp.short}
                  </button>
                ))}
              </div>
              <button onClick={restart} className="rounded-lg bg-space-700 p-2 hover:bg-space-600" aria-label="Restart flight">
                <RotateCcw className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-space-700 bg-space-900 p-3">
            <Bar icon={BatteryMedium} label="Battery" value={batteryPct} text={`${s.batteryWh.toFixed(1)} / ${ctx.batteryCapWh.toFixed(1)} Wh usable`} tone={batteryPct < 20 ? 'bad' : batteryPct < 50 ? 'warn' : 'ok'} />
            <Bar icon={Database} label="Data storage" value={bufferPct} text={`${fmtMB(s.bufferMB)} / ${fmtMB(ctx.bufferCapMB)}`} tone={bufferPct > 95 ? 'bad' : bufferPct > 75 ? 'warn' : 'ok'} />
            <Bar icon={Send} label="Images reached Earth" value={reachedPct} text={`${fmtMB(s.deliveredMB)} of ${fmtMB(s.madeMB)}`} tone={s.madeMB === 0 ? 'ok' : reachedPct < 50 ? 'bad' : reachedPct < 85 ? 'warn' : 'ok'} />
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Satellite className="size-3.5" aria-hidden />
              Power: makes {ctx.genW.toFixed(1)} W in sunlight, uses {ctx.drawW.toFixed(1)} W
            </p>
          </div>

          <div className="min-h-0 flex-1 rounded-xl border border-space-700 bg-space-900 p-3">
            <h2 className="text-sm font-semibold">Mission log</h2>
            <ol className="mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto text-xs" aria-live="polite">
              {[...s.events].reverse().map((e, i) => (
                <li key={s.events.length - i} className="flex gap-2">
                  <span className="w-16 shrink-0 text-muted tabular-nums">{fmtElapsed(e.tMin).replace('Year', 'Yr')}</span>
                  <span className={kindStyle[e.kind]}>{e.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </Screen>
  )
}

const toneBg = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', accent: 'bg-accent' } as const

function Bar({ icon: Icon, label, value, text, tone }: { icon?: typeof Sun; label: string; value: number; text: string; tone: keyof typeof toneBg }) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          {Icon && <Icon className="size-3.5 text-muted" aria-hidden />}
          {label}
        </span>
        <span className="text-muted tabular-nums">{text}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-space-700" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn('h-full rounded-full', toneBg[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}

function Chip({ on, icon: Icon, tone, children }: { on: boolean; icon: typeof Sun; tone: 'ok' | 'warn' | 'muted'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur',
        tone === 'ok' && 'border-ok/50 bg-ok/15 text-ok',
        tone === 'warn' && 'border-warn/50 bg-warn/15 text-warn',
        tone === 'muted' && 'border-space-600 bg-space-900/70 text-muted',
        !on && 'opacity-90',
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  )
}
