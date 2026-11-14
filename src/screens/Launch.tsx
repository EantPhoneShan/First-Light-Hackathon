import { useReducedMotion } from 'framer-motion'
import { FastForward, RotateCcw, Wrench } from 'lucide-react'
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AscentCharts } from '@/components/AscentCharts'
import { findBus } from '@/engine/data'
import { flightTime, simulateAscent } from '@/game/ascent'
import { partsOnCraft } from '@/game/ui'
import { LeadButton } from '@/components/LeadButton'
import { Screen } from '@/components/Screen'
import { findLauncher, findOrbit } from '@/engine/data'
import { clampAltitude } from '@/engine/rules'
import { gameData } from '@/game/ui'
import { cn } from '@/lib/cn'
import { useEvaluation, useGame } from '@/store/game'
import { play, type Sfx } from '@/lib/sound'

/** Timeline in seconds. Everything in the scene is a pure function of `t`. */
const T = { liftoff: 3, maxQ: 5, sep: 7, fairing: 8.2, orbit: 9.6, deploy: 11, done: 12.6, fail: 6 }

// three.js only downloads on this screen.
const Launch3D = lazy(() => import('@/three/Launch3D'))

/** If WebGL isn't available (old device, blocked GPU), fall back to the 2D animation. */
class Fallback3D extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const mix = (a: number, b: number, k: number) => a + (b - a) * k
const mixRgb = (a: number[], b: number[], k: number) => `rgb(${a.map((v, i) => Math.round(mix(v, b[i], k))).join(',')})`
const ease = (k: number) => k * k * (3 - 2 * k)

/** PRD F13: ascent, stage separation and orbit insertion. Fails with the reason if the rocket can't do the job. */
export function Launch() {
  const design = useGame((s) => s.design)
  const ev = useEvaluation()
  const orbit = findOrbit(gameData, design.flight.orbitId)
  const launcher = findLauncher(gameData, design.flight.launcherId)
  const hasBus = !!design.engineer.busId
  // The launch fails when Member 1's engine says the rocket can't get this craft to this orbit.
  const failure = ev.problems.find((p) => p.id === 'mass.rocket' || p.id.startsWith('compat.launcher'))
  const check = failure ? { ok: false, reason: failure.why } : { ok: true, reason: '' }
  const fails = !!failure
  const reduce = useReducedMotion()
  const end = fails ? T.fail + 2 : T.done

  const [t, setT] = useState(0)
  const [run, setRun] = useState(0)
  const tRef = useRef(0)

  // Realistic ascent for this rocket, payload and orbit (game/ascent.ts): drives the 3D scene and the charts.
  const altKm = orbit ? clampAltitude(orbit, design.flight.altitudeKm) : 500
  const profile = useMemo(() => {
    if (!launcher) return null
    const extra = launcher.id === 'iss-deploy' ? 6000 : launcher.class === 'rideshare' ? 3000 : 0
    // GEO missions go to a low parking orbit first; the long climb to GEO comes later.
    const targetKm = orbit?.kind === 'geo' ? 250 : altKm
    return simulateAscent({ klass: launcher.class, payloadKg: ev.totals.massKg + extra, targetKm, fails })
  }, [launcher, orbit?.kind, altKm, ev.totals.massKg, fails])
  const bus = findBus(gameData, design.engineer.busId)
  const parts = useMemo(() => partsOnCraft(design), [design])
  const cueRef = useRef(-1) // last time we checked for sound cues (-1 = before the countdown)

  // Sound cues, fired when the timeline passes each moment (not when skipping past them).
  useEffect(() => {
    // Time going backwards means a replay started: listen from the top again.
    const prev = t < cueRef.current ? -1 : cueRef.current
    cueRef.current = t
    const cues: [number, Sfx][] = fails
      ? [[0, 'beep'], [1, 'beep'], [2, 'beep'], [T.liftoff, 'liftoff'], [T.fail, 'explode']]
      : [[0, 'beep'], [1, 'beep'], [2, 'beep'], [T.liftoff, 'liftoff'], [T.sep, 'stage'], [T.fairing, 'stage'], [T.deploy, 'deploy'], [T.done - 0.1, 'complete']]
    for (const [at, sfx] of cues) if (prev < at && t >= at && t - at < 0.5) play(sfx)
  }, [t, fails])

  useEffect(() => {
    if (!orbit || !launcher || !hasBus) return
    // Dev only: ?t=8.5 freezes the scene at that second (for testing and video stills).
    const frozen = import.meta.env.DEV ? new URLSearchParams(location.search).get('t') : null
    if (reduce || frozen) {
      tRef.current = frozen ? Number(frozen) : end
      setT(tRef.current)
      return
    }
    tRef.current = 0
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      tRef.current = Math.min(end, tRef.current + Math.min(0.1, (now - last) / 1000))
      last = now
      setT(tRef.current)
      if (tRef.current < end) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [run, end, reduce, orbit, launcher, hasBus])

  const skip = () => {
    cueRef.current = end
    tRef.current = end
    setT(end)
  }

  if (!orbit || !launcher || !hasBus) {
    return (
      <Screen title="Launch" reqs="F13" hideNext>
        <div className="rounded-xl border border-space-700 bg-space-900 p-6">
          <p>Nothing on the pad yet. The design needs a bus, an orbit and a rocket before it can launch.</p>
          <div className="mt-4">
            <LeadButton to="design" ignoreCheck icon={Wrench}>
              Back to the workbench
            </LeadButton>
          </div>
        </div>
      </Screen>
    )
  }

  const deep = false // every orbit in the data is an Earth orbit for now
  const caption = captionAt(t, fails, launcher.name, orbit.kind.toUpperCase(), deep)
  const finished = t >= end

  return (
    <Screen title="Launch" subtitle={`${launcher.name} to ${orbit.name}, ${clampAltitude(orbit, design.flight.altitudeKm).toLocaleString()} km`} reqs="F13" hideNext>
      <div className="relative overflow-hidden rounded-xl border border-space-700 bg-space-950">
        {profile ? (
          <Fallback3D fallback={<Scene t={t} fails={fails} deep={deep} />}>
            <Suspense fallback={<Scene t={t} fails={fails} deep={deep} />}>
              <div className="h-[56vh] min-h-[340px] w-full sm:h-[520px]">
                <Launch3D getT={() => tRef.current} T={T} fails={fails} launcher={launcher} bus={bus} parts={parts} profile={profile} />
              </div>
            </Suspense>
          </Fallback3D>
        ) : (
          <Scene t={t} fails={fails} deep={deep} />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 p-4 text-center">
          {t < T.liftoff && !finished && (
            <span key={Math.ceil(T.liftoff - t)} className="font-display text-6xl font-semibold tabular-nums drop-shadow">
              {Math.ceil(T.liftoff - t)}
            </span>
          )}
          <p aria-live="polite" className={cn('rounded-full bg-space-950/70 px-4 py-1.5 text-sm backdrop-blur', fails && t >= T.fail && 'text-bad')}>
            {caption}
          </p>
        </div>
        <span className="absolute bottom-3 left-3 rounded bg-space-950/70 px-2 py-1 font-mono text-xs tabular-nums text-muted">
          {(() => {
            // Real flight time from the ascent model (the animation is sped up).
            const ft = profile ? flightTime(profile, t, T, fails) : t - T.liftoff
            const a = Math.abs(ft)
            return `T${ft < 0 ? '−' : '+'}${a >= 60 ? `${Math.floor(a / 60)}:${String(Math.floor(a % 60)).padStart(2, '0')}` : `${a.toFixed(1)} s`}`
          })()}
        </span>
        {!finished && (
          <button onClick={skip} className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg bg-space-950/70 px-3 py-1.5 text-sm text-muted backdrop-blur hover:text-ink">
            <FastForward className="size-4" aria-hidden />
            Skip
          </button>
        )}
      </div>

      {profile && <AscentCharts profile={profile} now={flightTime(profile, t, T, fails)} failed={fails} />}

      {finished && fails && (
        <div className="rounded-xl border border-bad/50 bg-bad/10 p-4" role="alert">
          <p className="font-medium">Launch failed</p>
          <p className="mt-1 text-sm">{check?.reason}</p>
          <p className="mt-1 text-sm text-muted">Rockets have a fixed lifting capacity for each orbit. A heavier craft or a higher orbit needs a bigger rocket.</p>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <button onClick={() => setRun((r) => r + 1)} className="inline-flex items-center gap-2 rounded-lg border border-space-600 px-5 py-2.5 hover:bg-space-800">
          <RotateCcw className="size-4" aria-hidden />
          Watch again
        </button>
        {fails ? (
          <LeadButton to="design" ignoreCheck icon={Wrench}>
            Fix the design
          </LeadButton>
        ) : (
          <LeadButton facts={{ launchDone: finished }}>Go to orbit</LeadButton>
        )}
      </div>
    </Screen>
  )
}

function captionAt(t: number, fails: boolean, rocket: string, orbit: string, deep: boolean) {
  if (t < T.liftoff) return `${rocket} on the pad. All systems go.`
  if (fails && t >= T.fail) return "The rocket can't get this craft to orbit."
  if (t < T.maxQ) return 'Liftoff!'
  if (t < T.sep) return 'Max Q: the hardest push through the air.'
  if (t < T.fairing) return 'Stage separation. The first stage falls away.'
  if (t < T.orbit) return 'Fairing open. The nose cone that protected the craft drops off.'
  if (t < T.deploy) return deep ? 'Engine burn to leave Earth orbit.' : `Upper stage burn into ${orbit}.`
  if (t < T.done) return 'Spacecraft deployed. Solar panels opening.'
  return deep ? `On its way. Heading for ${orbit === 'Moon' ? 'the Moon' : orbit}.` : `Orbit insertion complete. Welcome to ${orbit}.`
}

/* ---------------- Scene ---------------- */

const W = 400
const H = 520

function Scene({ t, fails, deep }: { t: number; fails: boolean; deep: boolean }) {
  const stars = useMemo(() => Array.from({ length: 200 }, (_, i) => ({ x: ((i * 97.3) % (W * 3)) - W, y: (i * 53.7) % H, r: (i % 3) * 0.4 + 0.5 })), [])
  const flicker = 0.85 + 0.15 * Math.sin(t * 40) * Math.sin(t * 23)

  // Ascent: altitude in scene pixels; the camera follows the rocket once it passes the middle.
  const up = Math.max(0, t - T.liftoff)
  const h = up * up * 28
  const padY = 440
  const rocketY = Math.max(300, padY - h)
  const groundShift = Math.max(0, h - (padY - 300))
  const sky = clamp(h / 650)
  const tilt = clamp((t - 4) / 3) * 14

  // Failure: the rocket stalls and breaks up.
  const failK = fails ? clamp((t - T.fail) / 0.6) : 0
  const exploded = fails && t >= T.fail

  // Orbit view cross-fade.
  const orbitK = fails ? 0 : clamp((t - T.orbit) / 0.6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block max-h-[70vh] w-full" role="img" aria-label="Launch animation">
      <defs>
        <radialGradient id="flame" cx="50%" cy="10%" r="90%">
          <stop offset="0%" stopColor="#fff6d8" />
          <stop offset="35%" stopColor="#ffc94a" />
          <stop offset="75%" stopColor="#ff6b1a" />
          <stop offset="100%" stopColor="#ff6b1a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="boom">
          <stop offset="0%" stopColor="#fff6d8" />
          <stop offset="40%" stopColor="#ff8a3d" />
          <stop offset="100%" stopColor="#ff5c6c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="earthLimb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4aa3ff" />
          <stop offset="12%" stopColor="#1f5fa8" />
          <stop offset="100%" stopColor="#0d2a55" />
        </linearGradient>
      </defs>

      {/* Sky darkening into space */}
      <rect x={-W} width={W * 3} height={H} fill={mixRgb([58, 110, 170], [6, 11, 26], ease(sky))} />
      <g opacity={clamp(sky * 1.4 - 0.3)}>
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e8edf8" opacity={0.7} />
        ))}
      </g>

      {/* Ground, pad and smoke (scroll away as we climb) */}
      <g transform={`translate(0 ${groundShift})`} opacity={1 - orbitK}>
        <rect x={-W} y={padY} width={W * 3} height={200} fill="#14361f" />
        <rect x={-W} y={padY} width={W * 3} height={4} fill="#1f4d2d" />
        <rect x={150} y={padY - 4} width={100} height={8} fill="#3a4766" />
        <rect x={226} y={padY - 150} width={8} height={146} fill="#56607d" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={226} y1={padY - 30 - i * 32} x2={212} y2={padY - 30 - i * 32} stroke="#56607d" strokeWidth={3} />
        ))}
        {t > T.liftoff - 0.4 &&
          [-60, -30, 0, 30, 60].map((dx, i) => {
            const k = clamp((t - T.liftoff + 0.4) / 3)
            return <circle key={i} cx={200 + dx * (0.6 + k * 1.4)} cy={padY - 6 - k * 14} r={10 + k * 26 + (i % 2) * 6} fill="#cfd6e6" opacity={0.55 * (1 - clamp((t - T.liftoff - 2) / 3))} />
          })}
      </g>

      {/* Rocket during ascent */}
      {orbitK < 1 && (
        <g transform={`translate(200 ${rocketY}) rotate(${tilt})`} opacity={(1 - orbitK) * (1 - failK)}>
          {/* First stage: falls away after separation */}
          <g
            transform={
              t >= T.sep && !fails
                ? `translate(${-(t - T.sep) * 18} ${(t - T.sep) ** 2 * 90}) rotate(${-(t - T.sep) * 40} 0 -35)`
                : undefined
            }
            opacity={t >= T.sep && !fails ? 1 - clamp((t - T.sep) / 1.4) : 1}
          >
            {t >= T.liftoff && t < T.sep && <path d={`M-8,0 Q0,${60 * flicker} 8,0 Z`} fill="url(#flame)" />}
            <rect x={-9} y={-70} width={18} height={70} rx={2} fill="#e8edf8" />
            <rect x={-9} y={-40} width={18} height={4} fill="#ff8a3d" />
            <path d="M-9,-14 L-17,2 L-9,0 Z M9,-14 L17,2 L9,0 Z" fill="#8f9bbf" />
          </g>

          {/* Upper stage */}
          {t >= T.sep + 0.4 && !fails && <path d={`M-5,-70 Q0,${-70 + 34 * flicker} 5,-70 Z`} fill="url(#flame)" />}
          <rect x={-9} y={-110} width={18} height={40} rx={2} fill="#dfe5f2" />
          <rect x={-9} y={-74} width={18} height={4} fill="#3a4766" />

          {/* Payload (visible once the fairing opens) */}
          <rect x={-5} y={-128} width={10} height={14} rx={1} fill="#ffc94a" />

          {/* Fairing halves */}
          {(['l', 'r'] as const).map((side) => {
            const s = side === 'l' ? -1 : 1
            const k = t >= T.fairing && !fails ? t - T.fairing : 0
            return (
              <path
                key={side}
                d={`M${9 * s},-110 L${9 * s},-130 Q${9 * s},-146 0,-152 L0,-110 Z`}
                fill="#f4f6fb"
                stroke="#c9d1e3"
                strokeWidth={0.5}
                transform={`translate(${s * k * 30} ${k * k * 30}) rotate(${s * k * 50} ${9 * s} -110)`}
                opacity={1 - clamp(k / 1.2)}
              />
            )
          })}
        </g>
      )}

      {/* Failure: break-up */}
      {exploded && (
        <g transform={`translate(200 ${rocketY - 80})`}>
          <circle r={20 + failK * 70} fill="url(#boom)" opacity={1 - clamp((t - T.fail - 0.6) / 1.4) * 0.7} />
        </g>
      )}

      {/* Orbit view: Earth's limb, the orbit path, deployment */}
      {orbitK > 0 && <OrbitView t={t} k={orbitK} flicker={flicker} deep={deep} />}
    </svg>
  )
}

function OrbitView({ t, k, flicker, deep }: { t: number; k: number; flicker: number; deep: boolean }) {
  const cx = W / 2
  const cy = H + 520
  const R = 640
  const orbitR = R + 150
  // Craft moves along the orbit arc, left to right.
  const ang = -Math.PI / 2 - 0.28 + clamp((t - T.orbit) / (T.done - T.orbit + 1)) * 0.5
  const outward = deep ? clamp((t - T.deploy) / 2) * 120 : 0
  const px = cx + (orbitR + outward) * Math.cos(ang)
  const py = cy + (orbitR + outward) * Math.sin(ang)
  const rot = (ang * 180) / Math.PI + 90
  const dep = clamp((t - T.deploy) / 1.2)
  const panels = clamp((t - T.deploy - 0.6) / 0.9)

  return (
    <g opacity={k}>
      <circle cx={cx} cy={cy} r={R + 14} fill="#4aa3ff" opacity={0.18} />
      <circle cx={cx} cy={cy} r={R} fill="url(#earthLimb)" />
      {!deep && <circle cx={cx} cy={cy} r={orbitR} fill="none" stroke="#ff8a3d" strokeOpacity={0.5} strokeDasharray="6 6" />}

      <g transform={`translate(${px} ${py}) rotate(${rot})`}>
        {/* Upper stage drifts back after deployment */}
        <g transform={`translate(${-dep * 34} 0)`} opacity={1 - dep * 0.5}>
          {t < T.deploy && <path d={`M-30,-4 Q${-30 - 26 * flicker},0 -30,4 Z`} fill="url(#flame)" />}
          <rect x={-30} y={-7} width={26} height={14} rx={2} fill="#dfe5f2" />
        </g>
        {/* The spacecraft */}
        <g transform={`translate(${dep * 12} 0)`}>
          <rect x={-4} y={-6} width={12} height={12} rx={1.5} fill="#ffc94a" stroke="#b8862a" strokeWidth={0.6} />
          <rect x={-2} y={-6 - 22 * panels} width={8} height={22 * panels} fill="#2a5bd7" stroke="#8fb0ff" strokeWidth={0.5} />
          <rect x={-2} y={6} width={8} height={22 * panels} fill="#2a5bd7" stroke="#8fb0ff" strokeWidth={0.5} />
        </g>
      </g>
    </g>
  )
}
