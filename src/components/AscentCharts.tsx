import { useId, useMemo, useState } from 'react'
import { sampleAt, type AscentProfile, type Sample } from '@/game/ascent'
import { cn } from '@/lib/cn'

/**
 * Live flight data under the 3D launch: telemetry readouts and four small
 * charts (altitude, speed, dynamic pressure, g-load) from game/ascent.ts.
 * Each chart shows the whole planned profile faintly and the part flown so far
 * in solid colour, with a cursor at "now". Hover a chart to read any moment.
 */
export function AscentCharts({ profile, now, failed }: { profile: AscentProfile; now: number; failed: boolean }) {
  const s = sampleAt(profile, Math.max(0, now))
  const e = profile.events
  const marks: Mark[] = [
    { t: e.maxQ, label: 'Max-Q' },
    ...(e.boosterSep !== null ? [{ t: e.boosterSep, label: 'Boosters off' }] : []),
    ...(failed ? [] : [{ t: e.meco, label: 'MECO' }, { t: e.seco, label: 'SECO' }]),
  ]
  const phase = now < 0 ? 'Countdown' : failed && e.breakup !== null && now >= e.breakup ? 'Vehicle lost' : s.stage === 1 ? 'First stage burn' : s.stage === 2 ? 'Upper stage burn' : now >= e.seco ? 'In orbit, coasting' : 'Stage separation'

  return (
    <section aria-label="Flight data" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Readout label="Mission time" value={now < 0 ? `T−${Math.abs(now).toFixed(0)} s` : `T+${fmtClock(now)}`} />
        <Readout label="Altitude" value={`${s.altKm < 10 ? s.altKm.toFixed(2) : s.altKm.toFixed(0)} km`} />
        <Readout label="Speed" value={`${(s.speed * 3.6).toLocaleString(undefined, { maximumFractionDigits: 0 })} km/h`} />
        <Readout label="Downrange" value={`${s.downrangeKm.toFixed(0)} km`} />
        <Readout label="Phase" value={phase} tone={failed && phase === 'Vehicle lost' ? 'bad' : undefined} className="col-span-2 sm:col-span-1" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Chart title="Altitude" unit="km" profile={profile} now={now} pick={(p) => p.altKm} marks={marks} format={(v) => `${v.toFixed(v < 10 ? 1 : 0)} km`} note={`Target orbit ${profile.targetKm.toFixed(0)} km`} target={profile.targetKm} />
        <Chart title="Speed" unit="km/s" profile={profile} now={now} pick={(p) => p.speed / 1000} marks={marks} format={(v) => `${v.toFixed(2)} km/s`} note="About 7.6 km/s keeps you in low orbit" />
        <Chart title="Dynamic pressure" unit="kPa" profile={profile} now={now} pick={(p) => p.qKPa} marks={marks.slice(0, 1)} format={(v) => `${v.toFixed(1)} kPa`} note={`Max-Q ${profile.maxQKPa.toFixed(0)} kPa: the hardest push of air on the rocket`} />
        <Chart title="G-force" unit="g" profile={profile} now={now} pick={(p) => p.gLoad} marks={marks} format={(v) => `${v.toFixed(1)} g`} note="Engines throttle back to stay under ~4.5 g" />
      </div>
    </section>
  )
}

function fmtClock(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s} s`
}

function Readout({ label, value, tone, className }: { label: string; value: string; tone?: 'bad'; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-space-700 bg-space-900 px-3 py-2', className)}>
      <p className="text-[11px] text-muted uppercase">{label}</p>
      <p className={cn('font-display text-base tabular-nums sm:text-lg', tone === 'bad' ? 'text-bad' : 'text-ink')} aria-live="off">
        {value}
      </p>
    </div>
  )
}

interface Mark {
  t: number
  label: string
}

const W = 320
const Hh = 130
const PAD = { l: 34, r: 10, t: 12, b: 20 }

function niceMax(v: number) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => n <= x) ?? 10
  return step * p
}

function Chart({ title, unit, profile, now, pick, marks, format, note, target }: { title: string; unit: string; profile: AscentProfile; now: number; pick: (s: Sample) => number; marks: Mark[]; format: (v: number) => string; note: string; target?: number }) {
  const id = useId()
  const [hover, setHover] = useState<number | null>(null)
  const samples = profile.samples
  const tMax = samples[samples.length - 1].t || 1
  const yMax = useMemo(() => niceMax(Math.max(...samples.map(pick), target ?? 0) * 1.05), [samples, pick, target])
  const x = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r)
  const y = (v: number) => Hh - PAD.b - (v / yMax) * (Hh - PAD.t - PAD.b)
  const path = (list: Sample[]) => list.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(pick(p)).toFixed(1)}`).join('')
  const flown = samples.filter((p) => p.t <= now)
  const cur = sampleAt(profile, Math.max(0, Math.min(now, tMax)))
  const shown = hover !== null ? sampleAt(profile, hover) : null

  const onMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect()
    const t = ((ev.clientX - r.left) / r.width * W - PAD.l) / (W - PAD.l - PAD.r) * tMax
    setHover(t >= 0 && t <= tMax ? t : null)
  }

  return (
    <figure className="rounded-xl border border-space-700 bg-space-900 p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium" id={`${id}-t`}>
          {title} <span className="font-normal text-muted">({unit})</span>
        </span>
        <span className="font-display text-sm text-ink tabular-nums">{now >= 0 ? format(pick(cur)) : '–'}</span>
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${Hh}`} className="mt-1 block w-full touch-none" role="img" aria-labelledby={`${id}-t`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {/* Grid: three recessive lines and the zero baseline */}
          {[0, 0.5, 1].map((k) => (
            <g key={k}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(yMax * k)} y2={y(yMax * k)} stroke="var(--color-space-700)" strokeWidth={k === 0 ? 1 : 0.6} />
              <text x={PAD.l - 4} y={y(yMax * k) + 3} textAnchor="end" fontSize="9" fill="var(--color-muted)">
                {yMax * k >= 100 ? (yMax * k).toFixed(0) : +(yMax * k).toFixed(1)}
              </text>
            </g>
          ))}
          {[0, 0.5, 1].map((k) => (
            <text key={k} x={x(tMax * k)} y={Hh - 6} textAnchor={k === 0 ? 'start' : k === 1 ? 'end' : 'middle'} fontSize="9" fill="var(--color-muted)">
              {fmtClock(tMax * k)}
            </text>
          ))}
          {target !== undefined && <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} stroke="var(--color-muted)" strokeWidth={0.8} strokeDasharray="2 3" />}
          {/* Event markers */}
          {marks.map((mk) => (
            <g key={mk.label}>
              <line x1={x(mk.t)} x2={x(mk.t)} y1={PAD.t} y2={Hh - PAD.b} stroke="var(--color-space-600)" strokeWidth={0.8} />
              <text x={x(mk.t) + 2} y={PAD.t + 7} fontSize="8" fill="var(--color-muted)">
                {mk.label}
              </text>
            </g>
          ))}
          {/* Planned profile (faint), flown so far (solid) */}
          <path d={path(samples)} fill="none" stroke="var(--color-muted)" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="3 3" />
          {flown.length > 1 && <path d={path(flown)} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {now >= 0 && now <= tMax && <circle cx={x(cur.t)} cy={y(pick(cur))} r={4} fill="var(--color-accent)" stroke="var(--color-space-900)" strokeWidth={2} />}
          {/* Hover crosshair */}
          {shown && (
            <g pointerEvents="none">
              <line x1={x(shown.t)} x2={x(shown.t)} y1={PAD.t} y2={Hh - PAD.b} stroke="var(--color-ink)" strokeOpacity={0.5} strokeWidth={0.8} />
              <circle cx={x(shown.t)} cy={y(pick(shown))} r={4} fill="var(--color-ink)" stroke="var(--color-space-900)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {shown && (
          <div className="pointer-events-none absolute top-0 rounded-md border border-space-600 bg-space-950/95 px-2 py-1 text-[11px] whitespace-nowrap shadow-lg" style={{ left: `${(x(shown.t) / W) * 100}%`, transform: `translateX(${x(shown.t) > W * 0.6 ? '-105%' : '5%'})` }}>
            <span className="text-muted">T+{fmtClock(shown.t)}</span> <span className="text-ink tabular-nums">{format(pick(shown))}</span>
          </div>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted">{note}</p>
    </figure>
  )
}
