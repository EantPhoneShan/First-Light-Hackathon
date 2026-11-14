import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, RotateCcw, Sparkles, Star, Wrench, XCircle } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Screen } from '@/components/Screen'
import { buildReport, fmtDuration, type Report as ReportData } from '@/sim/standInReport'
import type { FlightResult, SimEvent } from '@/sim/types'
import { cn } from '@/lib/cn'
import { useGame, useScenario } from '@/store/game'
import { play } from '@/lib/sound'

/** PRD F16 (report), F18 (re-fly). Reads the last saved flight; the one before it is the ghost. */
export function Report() {
  const scenario = useScenario()
  const flights = useGame((s) => s.flights)
  const setRefly = useGame((s) => s.setRefly)
  const resetDesign = useGame((s) => s.resetDesign)
  const navigate = useNavigate()

  const flight = flights[flights.length - 1]
  const ghost = flights.length > 1 ? flights[flights.length - 2] : undefined
  const report = useMemo(() => flight && buildReport(flight, scenario), [flight, scenario])
  const ghostReport = useMemo(() => ghost && buildReport(ghost, scenario), [ghost, scenario])

  if (!flight || !report) {
    return (
      <Screen title="Mission report" reqs="F16, F18">
        <div className="rounded-xl border border-space-700 bg-space-900 p-6">
          <p>No flight yet. Fly your mission first and the report will explain what happened.</p>
          <Link to="/sim" className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-space-950 hover:bg-accent-strong">
            Go to the simulation
          </Link>
        </div>
      </Screen>
    )
  }

  const refly = () => {
    setRefly({
      partIds: [...new Set(report.findings.flatMap((f) => f.partIds))],
      tabs: [...new Set(report.findings.flatMap((f) => f.tabs))],
      fixes: report.findings.map((f) => f.fix).filter((x): x is string => !!x),
    })
    navigate('/workbench')
  }

  const startOver = () => {
    resetDesign()
    setRefly(null)
    navigate('/workbench')
  }

  return (
    <Screen title="Mission report" subtitle={`${scenario.name} · flight ${flights.length}`} reqs="F16, F18" hideNext>
      <Summary report={report} ghost={ghostReport} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ScoreCard report={report} ghost={ghostReport} />
        <div className="flex flex-col gap-4">
          <DataCard report={report} flight={flight} customer={scenario.customer.name} />
          <DeliveredChart flight={flight} ghost={ghost} expectedMB={report.expectedMB} />
        </div>
      </div>

      <Timeline flight={flight} markers={report.markers} />
      <Findings report={report} />

      <div className="flex flex-wrap justify-end gap-3">
        <button onClick={startOver} className="inline-flex items-center gap-2 rounded-lg border border-space-600 px-5 py-2.5 hover:bg-space-800">
          New design
        </button>
        <button onClick={refly} className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-space-950 hover:bg-accent-strong">
          <RotateCcw className="size-4" aria-hidden />
          Modify and re-fly
        </button>
      </div>
    </Screen>
  )
}

/* ---------------- Headline, stars, total ---------------- */

function Summary({ report, ghost }: { report: ReportData; ghost?: ReportData }) {
  const lost = report.headline.startsWith('Mission lost')
  const diff = ghost ? report.total - ghost.total : 0
  useEffect(() => {
    const ids = Array.from({ length: report.stars }, (_, i) => window.setTimeout(() => play('star'), 400 + i * 200))
    return () => ids.forEach(clearTimeout)
  }, [report.stars])
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-xl border p-6 text-center', lost ? 'border-bad/50 bg-bad/10' : 'border-space-700 bg-space-900')}>
      <div className="flex gap-2" aria-label={`${report.stars} of 3 stars`}>
        {[1, 2, 3].map((n) => (
          <motion.span key={n} initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.2 + n * 0.2, type: 'spring', stiffness: 260, damping: 14 }}>
            <Star className={cn('size-10', n <= report.stars ? 'fill-accent text-accent' : 'text-space-600')} aria-hidden />
          </motion.span>
        ))}
      </div>
      <p className="font-display text-4xl font-semibold tabular-nums">
        {report.total}
        <span className="text-lg text-muted"> / 1000</span>
      </p>
      <p className="text-lg">{report.headline}</p>
      {ghost && (
        <p className={cn('text-sm', diff > 0 ? 'text-ok' : diff < 0 ? 'text-bad' : 'text-muted')}>
          {diff > 0 ? `+${diff} points` : diff < 0 ? `${diff} points` : 'Same score'} compared with your last flight
        </p>
      )}
    </div>
  )
}

/* ---------------- Score by category ---------------- */

function ScoreCard({ report, ghost }: { report: ReportData; ghost?: ReportData }) {
  return (
    <div className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 className="font-semibold">Score by category</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {report.lines.map((l, i) => {
          const pct = (l.score / l.max) * 100
          const before = ghost?.lines.find((g) => g.id === l.id)
          return (
            <li key={l.id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{l.label}</span>
                <span className="tabular-nums text-muted">
                  {l.score} / {l.max}
                </span>
              </div>
              <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-space-800">
                <motion.div
                  className={cn('h-full rounded-full', pct >= 80 ? 'bg-ok' : pct >= 40 ? 'bg-warn' : 'bg-bad')}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.6 }}
                />
                {before && (
                  <div className="absolute inset-y-0 w-0.5 bg-ink/60" style={{ left: `${(before.score / before.max) * 100}%` }} title={`Last flight: ${before.score}`} />
                )}
              </div>
              <p className="mt-1 text-xs text-muted">{l.why}</p>
            </li>
          )
        })}
      </ul>
      {ghost && <p className="mt-3 text-xs text-muted">The white tick on each bar is your last flight.</p>}
    </div>
  )
}

/* ---------------- Data delivered ---------------- */

function DataCard({ report, flight, customer }: { report: ReportData; flight: FlightResult; customer: string }) {
  return (
    <div className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 className="font-semibold">What the {customer.toLowerCase()} got</h2>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-xs text-muted">Images delivered</dt>
          <dd className="font-display text-2xl tabular-nums">{Math.round(report.deliveredPct)}%</dd>
          <dd className="text-xs text-muted">
            {fmtMB(flight.deliveredMB)} of {fmtMB(report.expectedMB)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">First image</dt>
          <dd className="font-display text-2xl">{report.firstLightMin === null ? 'Never' : fmtDuration(report.firstLightMin)}</dd>
          <dd className="text-xs text-muted">after launch</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Lost</dt>
          <dd className={cn('font-display text-2xl tabular-nums', flight.lostMB > 0 && 'text-warn')}>{fmtMB(flight.lostMB)}</dd>
          <dd className="text-xs text-muted">{flight.lostMB > 0 ? 'storage was full' : 'nothing lost'}</dd>
        </div>
      </dl>
    </div>
  )
}

/* ---------------- Delivered over time, with the last flight as a ghost ---------------- */

const fmtMB = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(mb >= 10000 ? 0 : 1)} GB` : `${Math.round(mb)} MB`)

function DeliveredChart({ flight, ghost, expectedMB }: { flight: FlightResult; ghost?: FlightResult; expectedMB: number }) {
  const W = 320
  const H = 120
  const life = flight.lifetimeMin
  const yMax = Math.max(expectedMB, flight.deliveredMB, ghost?.deliveredMB ?? 0, 1)
  const path = (f: FlightResult) => {
    const pts = [{ tMin: 0, deliveredMB: 0 }, ...f.samples, { tMin: f.endMin, deliveredMB: f.deliveredMB }]
    return pts.map((p, i) => `${i ? 'L' : 'M'}${((p.tMin / life) * W).toFixed(1)},${(H - (p.deliveredMB / yMax) * H).toFixed(1)}`).join(' ')
  }
  const endX = (flight.endMin / life) * W
  const endY = H - (flight.deliveredMB / yMax) * H

  return (
    <div className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 className="font-semibold">Images reaching Earth over the mission</h2>
      <svg viewBox={`-4 -4 ${W + 8} ${H + 24}`} className="mt-2 w-full" role="img" aria-label="Data delivered over time">
        <line x1={0} y1={0} x2={W} y2={0} className="stroke-ok/50" strokeDasharray="3 3" />
        <text x={W} y={-6} textAnchor="end" className="fill-muted text-[9px]">
          Goal
        </text>
        <line x1={0} y1={H} x2={W} y2={H} className="stroke-space-600" />
        {ghost && <path d={path(ghost)} fill="none" className="stroke-ink/40" strokeWidth={2} strokeDasharray="5 4" />}
        <motion.path d={path(flight)} fill="none" className="stroke-accent" strokeWidth={2.5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
        {flight.status === 'dead' && (
          <g>
            <circle cx={endX} cy={endY} r={4} className="fill-bad" />
            <text x={Math.min(endX + 6, W - 40)} y={endY - 6} className="fill-bad text-[9px]">
              Lost
            </text>
          </g>
        )}
        <text x={0} y={H + 14} className="fill-muted text-[9px]">
          Launch
        </text>
        <text x={W} y={H + 14} textAnchor="end" className="fill-muted text-[9px]">
          {fmtDuration(life)}
        </text>
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-accent" /> This flight
        </span>
        {ghost && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-ink/40" /> Last flight
          </span>
        )}
      </div>
    </div>
  )
}

/* ---------------- Timeline with problem markers ---------------- */

const markerStyle: Record<SimEvent['kind'], { icon: typeof Star; cls: string }> = {
  good: { icon: Sparkles, cls: 'text-ok bg-ok/15 border-ok/50' },
  info: { icon: CheckCircle2, cls: 'text-muted bg-space-800 border-space-600' },
  warn: { icon: AlertTriangle, cls: 'text-warn bg-warn/15 border-warn/50' },
  bad: { icon: XCircle, cls: 'text-bad bg-bad/15 border-bad/50' },
}

function Timeline({ flight, markers }: { flight: FlightResult; markers: SimEvent[] }) {
  // Stretched time axis, so events in the first hour and the third year both have room.
  const pos = (t: number) => (Math.log1p(t) / Math.log1p(flight.lifetimeMin)) * 100
  const ticks = [
    { t: 60, label: '1 h' },
    { t: 1440, label: '1 day' },
    { t: 43800, label: '1 month' },
    { t: 525600, label: '1 year' },
  ].filter((k) => k.t < flight.lifetimeMin)

  return (
    <div className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 className="font-semibold">Mission timeline</h2>
      <div className="relative mx-3 mt-8 mb-6 h-2 rounded-full bg-space-800">
        <motion.div className={cn('absolute inset-y-0 left-0 rounded-full', flight.status === 'dead' ? 'bg-bad/60' : 'bg-ok/60')} initial={{ width: 0 }} animate={{ width: `${pos(flight.endMin)}%` }} transition={{ duration: 1 }} />
        {ticks.map((k) => (
          <div key={k.t} className="absolute top-3 -translate-x-1/2 text-[10px] text-muted" style={{ left: `${pos(k.t)}%` }}>
            {k.label}
          </div>
        ))}
        {markers.map((m, i) => {
          const { icon: Icon, cls } = markerStyle[m.kind]
          return (
            <div key={i} className={cn('absolute -top-6 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border', cls)} style={{ left: `${pos(m.tMin)}%` }} title={m.text}>
              <Icon className="size-3.5" aria-hidden />
            </div>
          )
        })}
      </div>
      <ol className="flex flex-col gap-2 text-sm">
        {markers.map((m, i) => {
          const { icon: Icon, cls } = markerStyle[m.kind]
          return (
            <li key={i} className="flex items-start gap-2">
              <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border', cls)}>
                <Icon className="size-3" aria-hidden />
              </span>
              <span>
                <span className="tabular-nums text-muted">{fmtDuration(m.tMin)}: </span>
                {m.text}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ---------------- Why it happened, and the fix ---------------- */

function Findings({ report }: { report: ReportData }) {
  if (report.findings.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-ok/50 bg-ok/10 p-4">
        <CheckCircle2 className="size-5 shrink-0 text-ok" aria-hidden />
        <p>No problems found. Try a harder mission, or see if you can do it for less money.</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold">Why it happened</h2>
      {report.findings.map((f, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.1 }}
          className={cn('rounded-xl border p-4', f.kind === 'fail' ? 'border-bad/50 bg-bad/10' : 'border-warn/50 bg-warn/10')}
        >
          <div className="flex items-center gap-2">
            {f.kind === 'fail' ? <XCircle className="size-5 shrink-0 text-bad" aria-hidden /> : <AlertTriangle className="size-5 shrink-0 text-warn" aria-hidden />}
            <h3 className="font-medium">{f.title}</h3>
            {f.tMin !== null && <span className="ml-auto text-xs text-muted">{fmtDuration(f.tMin)} after launch</span>}
          </div>
          <p className="mt-2 text-sm">{f.why}</p>
          <p className="mt-2 flex items-start gap-2 text-sm text-ink">
            <Wrench className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            <span>
              <span className="font-medium">Fix: </span>
              {f.fix}
            </span>
          </p>
        </motion.div>
      ))}
    </div>
  )
}
