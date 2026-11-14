import { motion } from 'framer-motion'
import { ArrowDown, ArrowRight, CheckCircle2, FlaskConical, Lock, Target } from 'lucide-react'
import { PartIcon } from '@/components/workbench/PartIcon'
import { findPart } from '@/engine/data'
import type { Part } from '@/engine/types'
import { gameData } from '@/game/ui'
import { cn } from '@/lib/cn'
import { useEvaluation, useGame, useScenario } from '@/store/game'

/**
 * PRD F3, CML 1: start from the science goal. Goal -> what to measure -> which instrument.
 * Data is the scenario's goals (Member 1). evaluate().compat.instruments locks every instrument
 * that doesn't serve the chosen measurement, with the reason, on the workbench too.
 */
export function Traceability() {
  const scenario = useScenario()
  const science = useGame((s) => s.design.science)
  const setScience = useGame((s) => s.setScience)
  const lead = useGame((s) => s.players.find((p) => p.role === 'science')?.name)
  const ev = useEvaluation()

  const goal = scenario.goals.find((g) => g.id === science.goalId)
  const measurement = goal?.measurements.find((m) => m.id === science.measurementId)
  const instruments = gameData.parts.filter((p) => p.category === 'instrument')
  const unlocked = instruments.filter((p) => ev.compat.instruments[p.id]?.ok)
  const locked = instruments.filter((p) => ev.compat.instruments[p.id]?.ok === false)

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

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)_auto_minmax(0,1fr)]">
        {/* 1. Goal */}
        <Step n={1} title="Science goal" icon={Target}>
          <div role="radiogroup" aria-label="Science goal" className="flex flex-col gap-2">
            {scenario.goals.map((g) => (
              <Choice key={g.id} selected={g.id === science.goalId} onPick={() => setScience(g.id, null)}>
                <span className="font-medium">{g.name}</span>
              </Choice>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">For the {scenario.customer.name.toLowerCase()}.</p>
        </Step>

        <Arrow />

        {/* 2. Measurement */}
        <Step n={2} title="What should we measure?">
          {goal ? (
            <div role="radiogroup" aria-label="Measurement" className="flex flex-col gap-2">
              {goal.measurements.map((m) => (
                <Choice key={m.id} selected={m.id === science.measurementId} onPick={() => setScience(goal.id, m.id)}>
                  <span className="font-medium">{m.name}</span>
                  {m.id === science.measurementId && (
                    <span className="mt-1 flex items-start gap-1.5 text-xs text-ok">
                      <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden />
                      <span className="text-ink/80">{m.why}</span>
                    </span>
                  )}
                </Choice>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Pick a goal first.</p>
          )}
        </Step>

        <Arrow />

        {/* 3. Instrument */}
        <Step n={3} title="Instrument">
          {measurement ? (
            <motion.div key={measurement.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2">
              {measurement.instrumentIds
                .map((id) => findPart(gameData, id))
                .filter((p): p is Part => !!p)
                .map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border border-ok/50 bg-ok/5 p-2">
                    <PartIcon item={p} className="size-12 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{p.name}</span>
                      <span className="block text-xs text-muted">Unlocked on the workbench</span>
                    </span>
                  </div>
                ))}
            </motion.div>
          ) : (
            <p className="text-sm text-muted">
              {goal ? 'Pick a measurement to see which instrument does it.' : `Until you choose, the ${unlocked.length} instruments that serve any goal are open.`}
            </p>
          )}

          {locked.length > 0 && (
            <div className="mt-3 border-t border-space-700 pt-3">
              <p className="text-xs font-medium text-muted">Locked {measurement ? 'for this measurement' : `for ${scenario.name}`}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {locked.map((p) => (
                  <li key={p.id} className="flex items-start gap-1.5 text-xs text-muted">
                    <Lock className="mt-0.5 size-3 shrink-0 text-bad" aria-hidden />
                    <span>
                      <span className="text-ink">{p.name}</span>
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

function Choice({ selected, onPick, children }: { selected: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className={cn('rounded-lg border p-2.5 text-left text-sm transition-colors', selected ? 'border-ok/60 bg-ok/10' : 'border-space-700 hover:border-space-600')}
    >
      {children}
    </button>
  )
}
