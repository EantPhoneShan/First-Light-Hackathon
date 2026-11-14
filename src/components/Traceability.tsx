import { motion } from 'framer-motion'
import { ArrowDown, ArrowRight, CheckCircle2, CircleAlert, FlaskConical, Lock, Target, XCircle } from 'lucide-react'
import { PartIcon } from '@/components/workbench/PartIcon'
import { partById } from '@/engine/mock'
import { scienceFor, type Measurement } from '@/engine/mockScience'
import type { Part } from '@/engine/placeholderTypes'
import { cn } from '@/lib/cn'
import { useGame, useScenario } from '@/store/game'

const fitStyle = {
  best: { icon: CheckCircle2, text: 'text-ok', box: 'border-ok/60 bg-ok/10', word: 'Best fit' },
  ok: { icon: CircleAlert, text: 'text-warn', box: 'border-warn/60 bg-warn/10', word: 'Works, with limits' },
  no: { icon: XCircle, text: 'text-bad', box: 'border-bad/60 bg-bad/10', word: "Doesn't fit" },
} as const

/**
 * PRD F3, CML 1: start from the science goal. Goal -> what to measure -> which instrument.
 * The Science Lead leads this step. Instruments that can't serve the goal are locked on the workbench.
 */
export function Traceability() {
  const scenario = useScenario()
  const sci = scienceFor(scenario.id)
  const chosenId = useGame((s) => s.measurementId)
  const setMeasurement = useGame((s) => s.setMeasurement)
  const lead = useGame((s) => s.room.players.find((p) => p.role === 'science')?.name)
  if (!sci) return null

  const chosen = sci.measurements.find((m) => m.id === chosenId)
  const lockedParts = Object.entries(sci.locked)
    .map(([id, why]) => ({ part: partById(id), why }))
    .filter((x): x is { part: Part; why: string } => !!x.part)

  return (
    <section aria-labelledby="trace-h" className="rounded-xl border border-space-700 bg-space-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="trace-h" className="text-lg font-semibold">
          Science traceability
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <FlaskConical className="size-3.5 text-accent" aria-hidden />
          {lead ? `${lead} (Science Lead) leads this step` : 'The Science Lead leads this step'}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">Real missions start from the science, not the spacecraft: what do we need to know, what must we measure, and which instrument measures it?</p>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)_auto_minmax(0,1fr)]">
        {/* 1. Goal */}
        <Step n={1} title="Science goal" icon={Target}>
          <p className="text-sm">{sci.goal}</p>
          <p className="mt-2 text-xs text-muted">For the {scenario.customer.toLowerCase()}.</p>
        </Step>

        <Arrow />

        {/* 2. Measurement */}
        <Step n={2} title="What should we measure?">
          <div role="radiogroup" aria-label="Measurement" className="flex flex-col gap-2">
            {sci.measurements.map((m) => (
              <MeasurementCard key={m.id} m={m} selected={m.id === chosenId} onPick={() => setMeasurement(m.id)} />
            ))}
          </div>
        </Step>

        <Arrow />

        {/* 3. Instrument */}
        <Step n={3} title="Instrument">
            {chosen ? (
              <motion.div key={chosen.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                {chosen.instruments.map((id) => {
                  const p = partById(id)
                  if (!p) return null
                  const locked = sci.locked[id]
                  return (
                    <div key={id} className={cn('flex items-center gap-3 rounded-lg border p-2', locked ? 'border-bad/40 opacity-70' : 'border-ok/50 bg-ok/5')}>
                      <PartIcon part={p} className={cn('size-12 shrink-0', locked && 'grayscale')} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {locked && <Lock className="size-3.5 text-bad" aria-label="Locked" />}
                          {p.name}
                        </span>
                        <span className="block text-xs text-muted">{locked ? 'Locked for this mission' : 'Unlocked on the workbench'}</span>
                      </span>
                    </div>
                  )
                })}
                <p className="mt-2 text-xs text-muted">{chosen.senses}</p>
              </motion.div>
            ) : (
              <p className="text-sm text-muted">Pick a measurement to see which instrument does it.</p>
            )}

          {lockedParts.length > 0 && (
            <div className="mt-3 border-t border-space-700 pt-3">
              <p className="text-xs font-medium text-muted">Locked for {scenario.name}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {lockedParts.map(({ part, why }) => (
                  <li key={part.id} className="flex items-start gap-1.5 text-xs text-muted">
                    <Lock className="mt-0.5 size-3 shrink-0 text-bad" aria-hidden />
                    <span>
                      <span className="text-ink">{part.name}:</span> {why.replace(/^Doesn't fit the goal: /, '')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Step>
      </div>
    </section>
  )
}

function Step({ n, title, icon: Icon, children }: { n: number; title: string; icon?: typeof Target; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-space-700 bg-space-950/50 p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wider text-accent uppercase">
        <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[11px] text-space-950">{n}</span>
        {title}
        {Icon && <Icon className="size-3.5" aria-hidden />}
      </p>
      {children}
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex justify-center text-muted lg:h-full lg:items-center" aria-hidden>
      <ArrowDown className="size-5 lg:hidden" />
      <ArrowRight className="hidden size-5 lg:block" />
    </div>
  )
}

function MeasurementCard({ m, selected, onPick }: { m: Measurement; selected: boolean; onPick: () => void }) {
  const st = fitStyle[m.fits]
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className={cn('rounded-lg border p-2.5 text-left text-sm transition-colors', selected ? st.box : 'border-space-700 hover:border-space-600')}
    >
      <span className="font-medium">{m.label}</span>
      {selected && (
        <span className={cn('mt-1 flex items-start gap-1.5 text-xs', st.text)}>
          <st.icon className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            <b>{st.word}.</b> <span className="text-ink/80">{m.why}</span>
          </span>
        </span>
      )}
    </button>
  )
}
