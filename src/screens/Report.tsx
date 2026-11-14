import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Lightbulb, RotateCcw, Sparkles, Star, Target, Wrench, XCircle } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { LeadButton } from '@/components/LeadButton'
import { Leaderboard, OtherBuilds, RealMissionCard } from '@/components/ReportExtras'
import { backStep } from '@/engine/flow'
import { Screen } from '@/components/Screen'
import { buildMissionReport, formatDuration } from '@/engine/report'
import { scoreMission } from '@/engine/score'
import type { Finding, MissionReport, SimMarker, SimResult, Status } from '@/engine/types'
import { gameData, roleNames } from '@/game/ui'
import { cn } from '@/lib/cn'
import { play } from '@/lib/sound'
import type { FlightResult } from '@/sim/types'
import { useGame, useScenario } from '@/store/game'

/** Score and report for one flight, from Member 1's score.ts and report.ts. */
function reportFor(f: FlightResult, previous?: FlightResult): MissionReport {
  const sc = gameData.scenarios.find((s) => s.id === f.scenarioId) ?? gameData.scenarios[0]
  const score = scoreMission(f.design, sc, gameData, f.sim, { allApproved: f.allApproved, tradeStudyUsed: f.tradeStudyUsed })
  const prev = previous && { sim: previous.sim, score: scoreMission(previous.design, sc, gameData, previous.sim, { allApproved: previous.allApproved, tradeStudyUsed: previous.tradeStudyUsed }) }
  return buildMissionReport(f.design, sc, gameData, f.sim, score, prev)
}

/** PRD F16 (report), F18 (re-fly). Reads the last saved flight; the one before it is the ghost. */
export function Report() {
  const scenario = useScenario()
  const flights = useGame((s) => s.flights)
  const setRefly = useGame((s) => s.setRefly)
  const resetDesign = useGame((s) => s.resetDesign)

  const flight = flights[flights.length - 1]
  const ghost = flights.length > 1 ? flights[flights.length - 2] : undefined
  const report = useMemo(() => flight && reportFor(flight, ghost), [flight, ghost])
  const ghostReport = useMemo(() => ghost && reportFor(ghost), [ghost])

  if (!flight || !report) {
    return (
      <Screen title="Mission report" reqs="F16, F18" hideNext>
        <div className="rounded-xl border border-space-700 bg-space-900 p-6">
          <p>No flight yet. Fly your mission first and the report will explain what happened.</p>
          <div className="mt-4">
            <LeadButton to="simulate" ignoreCheck>
              Go to the simulation
            </LeadButton>
          </div>
        </div>
      </Screen>
    )
  }

  const refly = () => {
    // Runs on the leader's device just before the room moves back to design (backStep).
    const fixes = report.findings.filter((f) => f.kind !== 'tip')
    setRefly({
      partIds: report.highlightPartIds,
      tabs: [...new Set(fixes.map((f) => f.area).filter((a): a is 'launch' | 'ground' => a === 'launch' || a === 'ground'))],
      fixes: fixes.filter((f) => f.top).map((f) => f.fix),
    })
  }

  const startOver = () => {
    resetDesign()
    setRefly(null)
  }

  return (
    <Screen title="Mission report" subtitle={`${scenario.name} · flight ${flights.length}`} reqs="F16, F18" hideNext>
      <Summary report={report} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <ScoreCard report={report} ghost={ghostReport} />
          <RoleGoals report={report} />
        </div>
        <div className="flex flex-col gap-4">
          <DataCard report={report} />
          <DeliveredChart sim={flight.sim} ghost={ghost?.sim} expectedMB={report.customer.expectedMB} />
        </div>
      </div>

      <Timeline report={report} />
      <Findings findings={report.findings} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <RealMissionCard flight={flight} />
        <Leaderboard flight={flight} />
      </div>
      <OtherBuilds flight={flight} />

      <div className="flex flex-wrap justify-end gap-3">
        <LeadButton to={backStep('report') ?? 'design'} ignoreCheck onGo={startOver} icon={null} quietWhenWaiting className="border border-space-600 bg-transparent font-normal text-ink hover:bg-space-800">
          New design
        </LeadButton>
        <LeadButton to={backStep('report') ?? 'design'} ignoreCheck onGo={refly} icon={RotateCcw}>
          Modify and re-fly
        </LeadButton>
      </div>
    </Screen>
  )
}

/* ---------------- Headline, stars, total ---------------- */

function Summary({ report }: { report: MissionReport }) {
  const lost = report.outcome === 'failure' || report.outcome === 'launch-failure'
  const diff = report.compare?.totalDelta ?? 0
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
      <p className="max-w-xl text-lg">{report.headline}</p>
      {report.compare && (
        <p className={cn('text-sm', diff > 0 ? 'text-ok' : diff < 0 ? 'text-bad' : 'text-muted')}>
          {diff > 0 ? `+${diff} points` : diff < 0 ? `${diff} points` : 'Same score'} compared with your last flight
          {report.compare.fixedTitles.length > 0 && <span className="block text-ok">Fixed: {report.compare.fixedTitles.join(', ')}</span>}
        </p>
      )}
    </div>
  )
}

/* ---------------- Score by category ---------------- */

function ScoreCard({ report, ghost }: { report: MissionReport; ghost?: MissionReport }) {
  return (
    <div className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 className="font-semibold">Score by category</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {report.lines.map((l, i) => {
          const pct = l.max ? (l.points / l.max) * 100 : 0
          const before = ghost?.lines.find((g) => g.id === l.id)
          return (
            <li key={l.id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{l.label}</span>
                <span className="tabular-nums text-muted">
                  {l.points} / {l.max}
                </span>
              </div>
              <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-space-800">
                <motion.div
                  className={cn('h-full rounded-full', pct >= 80 ? 'bg-ok' : pct >= 40 ? 'bg-warn' : 'bg-bad')}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.6 }}
                />
                {before && before.max > 0 && <div className="absolute inset-y-0 w-0.5 bg-ink/60" style={{ left: `${(before.points / before.max) * 100}%` }} title={`Last flight: ${before.points}`} />}
              </div>
              {l.note && <p className="mt-1 text-xs text-muted">{l.note}</p>}
            </li>
          )
        })}
      </ul>
      {ghost && <p className="mt-3 text-xs text-muted">The white tick on each bar is your last flight.</p>}
    </div>
  )
}

/* ---------------- Each role's private goal ---------------- */

function RoleGoals({ report }: { report: MissionReport }) {
  if (report.roleGoals.length === 0) return null
  return (
    <div className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Target className="size-4 text-accent" aria-hidden />
        Role goals
      </h2>
      <ul className="mt-2 flex flex-col gap-2 text-sm">
        {report.roleGoals.map((g) => (
          <li key={g.role} className="flex items-start gap-2">
            {g.met ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-label="met" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-bad" aria-label="not met" />}
            <span>
              <span className="font-medium">{roleNames[g.role]}:</span> {g.label}
              <span className="block text-xs text-muted">{g.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- Data delivered ---------------- */

const fmtMB = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(mb >= 10000 ? 0 : 1)} GB` : `${Math.round(mb)} MB`)

function DataCard({ report }: { report: MissionReport }) {
  const c = report.customer
  return (
    <div className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 className="font-semibold">What the {c.name.toLowerCase()} got</h2>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-xs text-muted">Data delivered</dt>
          <dd className="font-display text-2xl tabular-nums">{Math.round(c.deliveredPct)}%</dd>
          <dd className="text-xs text-muted">
            {fmtMB(c.deliveredMB)} of {fmtMB(c.expectedMB)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">On time</dt>
          <dd className={cn('font-display text-2xl tabular-nums', c.onTimePct < 80 && c.deliveredMB > 0 && 'text-warn')}>{Math.round(c.onTimePct)}%</dd>
          <dd className="text-xs text-muted">within {c.needsDataWithinHours} h</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">First data</dt>
          <dd className="font-display text-2xl">{report.firstLightMin === null ? 'Never' : formatDuration(report.firstLightMin)}</dd>
          <dd className="text-xs text-muted">{c.deliveredMB > 0 ? `avg wait ${c.avgDelayHours.toFixed(1)} h` : 'after launch'}</dd>
        </div>
      </dl>
    </div>
  )
}

/* ---------------- Delivered over time, with the last flight as a ghost ---------------- */

function DeliveredChart({ sim, ghost, expectedMB }: { sim: SimResult; ghost?: SimResult; expectedMB: number }) {
  const W = 320
  const H = 120
  const life = sim.missionMin
  const yMax = Math.max(expectedMB, sim.summary.deliveredMB, ghost?.summary.deliveredMB ?? 0, 1)
  const path = (r: SimResult) => {
    const pts = [{ tMin: 0, deliveredMB: 0 }, ...r.frames, { tMin: r.survivedMin, deliveredMB: r.summary.deliveredMB }]
    // Thin out the per-minute frames of day 1 so the path stays light.
    const step = Math.max(1, Math.floor(pts.length / 400))
    return pts
      .filter((_, i) => i % step === 0 || i === pts.length - 1)
      .map((p, i) => `${i ? 'L' : 'M'}${((p.tMin / life) * W).toFixed(1)},${(H - (p.deliveredMB / yMax) * H).toFixed(1)}`)
      .join(' ')
  }
  const lost = sim.summary.diedAtMin !== null || sim.summary.reenteredAtMin !== null
  const endX = (sim.survivedMin / life) * W
  const endY = H - (sim.summary.deliveredMB / yMax) * H

  return (
    <div className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 className="font-semibold">Data reaching Earth over the mission</h2>
      <svg viewBox={`-4 -4 ${W + 8} ${H + 24}`} className="mt-2 w-full" role="img" aria-label="Data delivered over time">
        <line x1={0} y1={0} x2={W} y2={0} className="stroke-ok/50" strokeDasharray="3 3" />
        <text x={W} y={-6} textAnchor="end" className="fill-muted text-[9px]">
          Goal
        </text>
        <line x1={0} y1={H} x2={W} y2={H} className="stroke-space-600" />
        {ghost && <path d={path(ghost)} fill="none" className="stroke-ink/40" strokeWidth={2} strokeDasharray="5 4" />}
        <motion.path d={path(sim)} fill="none" className="stroke-accent" strokeWidth={2.5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
        {lost && (
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
          {formatDuration(life)}
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

const markerStyle: Record<Status, { icon: typeof Star; cls: string }> = {
  ok: { icon: Sparkles, cls: 'text-ok bg-ok/15 border-ok/50' },
  warn: { icon: AlertTriangle, cls: 'text-warn bg-warn/15 border-warn/50' },
  fail: { icon: XCircle, cls: 'text-bad bg-bad/15 border-bad/50' },
}

function Timeline({ report }: { report: MissionReport }) {
  const markers: SimMarker[] = report.markers
  // Stretched time axis, so events in the first hour and the third year both have room.
  const pos = (t: number) => (Math.log1p(Math.max(0, t)) / Math.log1p(report.missionMin)) * 100
  const ticks = [
    { t: 60, label: '1 h' },
    { t: 1440, label: '1 day' },
    { t: 43800, label: '1 month' },
    { t: 525960, label: '1 year' },
  ].filter((k) => k.t < report.missionMin)
  const lost = report.survivedMin < report.missionMin

  return (
    <div className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 className="font-semibold">Mission timeline</h2>
      <div className="relative mx-3 mt-8 mb-6 h-2 rounded-full bg-space-800">
        <motion.div className={cn('absolute inset-y-0 left-0 rounded-full', lost ? 'bg-bad/60' : 'bg-ok/60')} initial={{ width: 0 }} animate={{ width: `${pos(report.survivedMin)}%` }} transition={{ duration: 1 }} />
        {ticks.map((k) => (
          <div key={k.t} className="absolute top-3 -translate-x-1/2 text-[10px] text-muted" style={{ left: `${pos(k.t)}%` }}>
            {k.label}
          </div>
        ))}
        {markers.map((m, i) => {
          const { icon: Icon, cls } = markerStyle[m.status]
          return (
            <div key={i} className={cn('absolute -top-6 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border', cls)} style={{ left: `${pos(m.tMin)}%` }} title={m.label}>
              <Icon className="size-3.5" aria-hidden />
            </div>
          )
        })}
      </div>
      <ol className="flex flex-col gap-2 text-sm">
        {markers.map((m, i) => {
          const { icon: Icon, cls } = markerStyle[m.status]
          return (
            <li key={i} className="flex items-start gap-2">
              <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border', cls)}>
                <Icon className="size-3" aria-hidden />
              </span>
              <span>
                <span className="tabular-nums text-muted">{formatDuration(m.tMin)}: </span>
                {m.label}
                {m.why && <span className="block text-xs text-muted">{m.why}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ---------------- Why it happened, and the fix ---------------- */

const findingStyle = {
  bad: { icon: XCircle, box: 'border-bad/50 bg-bad/10', text: 'text-bad' },
  warn: { icon: AlertTriangle, box: 'border-warn/50 bg-warn/10', text: 'text-warn' },
  tip: { icon: Lightbulb, box: 'border-space-600 bg-space-900', text: 'text-accent' },
} as const

function Findings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
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
      {findings.map((f, i) => {
        const st = findingStyle[f.kind]
        return (
          <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + Math.min(i, 6) * 0.1 }} className={cn('rounded-xl border p-4', st.box)}>
            <div className="flex flex-wrap items-center gap-2">
              <st.icon className={cn('size-5 shrink-0', st.text)} aria-hidden />
              <h3 className="font-medium">{f.title}</h3>
              {f.top && f.kind !== 'tip' && <span className="rounded-full bg-bad/20 px-2 py-0.5 text-[10px] font-semibold text-bad uppercase">Top problem</span>}
              <span className="ml-auto text-xs text-muted">
                {roleNames[f.owner]}
                {f.tMin !== null ? ` · ${formatDuration(f.tMin)} after launch` : ''}
              </span>
            </div>
            <p className="mt-2 text-sm">{f.why}</p>
            <p className="mt-2 flex items-start gap-2 text-sm text-ink">
              <Wrench className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="font-medium">{f.kind === 'tip' ? 'Idea: ' : 'Fix: '}</span>
                {f.fix}
              </span>
            </p>
          </motion.div>
        )
      })}
    </div>
  )
}
