import { CheckCircle2, ClipboardList, XCircle } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Screen } from '@/components/Screen'
import { Term } from '@/components/Term'
import { orbitInfo } from '@/engine/orbit'
import type { DisposalPlan, PlannerData } from '@/engine/types'
import { gameData, n1, roleNames } from '@/game/ui'
import { useTeamFlow } from '@/game/teamFlow'
import { EditGate } from '@/components/LeadButton'
import { RoleSummary } from '@/components/RoleSummary'
import { cn } from '@/lib/cn'
import { useEvaluation, useGame, useScenario } from '@/store/game'

const weightInfo: { key: keyof PlannerData['weights']; label: string; low: string; high: string }[] = [
  { key: 'coverage', label: 'Coverage: looking often', low: 'Fine to look now and then', high: 'Must see every spot as often as possible' },
  { key: 'detail', label: 'Detail: sharp, rich data', low: 'Rough pictures are enough', high: 'Every image must count' },
  { key: 'lifetime', label: 'Lifetime: lasting the whole mission', low: 'A short mission is OK', high: 'Must last every planned year' },
]

const disposals: { id: DisposalPlan; label: string; what: string }[] = [
  { id: 'natural-decay', label: 'Let air drag bring it down', what: 'Free, but only works if the orbit is low enough to fall within the time limit.' },
  { id: 'deorbit-burn', label: 'Fire a thruster at the end', what: 'Needs a thruster and enough fuel (delta-v), but works from any low orbit.' },
  { id: 'graveyard', label: 'Move to a graveyard orbit', what: 'Only for GEO: push the craft higher, out of the busy ring.' },
  { id: 'none', label: 'No plan yet', what: 'The craft could stay up as space junk for decades.' },
]

/**
 * CML 2 Feasibility. F4: the Mission Planner's sliders weight the score. F10: end-of-mission plan.
 * F5: a quick check of every orbit against this mission's targets, using Member 1's orbit maths.
 */
export function Feasibility() {
  const scenario = useScenario()
  const planner = useGame((s) => s.design.planner)
  const setWeight = useGame((s) => s.setWeight)
  const setDisposal = useGame((s) => s.setDisposal)
  const lead = useGame((s) => s.players.find((p) => p.role === 'planner')?.name)
  const ev = useEvaluation()
  const flow = useTeamFlow()

  return (
    <Screen title="Requirements" subtitle="CML 2 · Feasibility: decide what matters most, then check it's possible." reqs="F4, F5, F10" nextLabel="Start designing">
      <p className="inline-flex w-fit items-center gap-2 rounded-full border border-space-700 bg-space-900 px-3 py-1 text-sm text-muted">
        <ClipboardList className="size-4 text-accent" aria-hidden />
        {lead ? `${lead} (Mission Planner) leads this step` : 'The Mission Planner leads this step'}
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {flow.team && !flow.myRoles.includes('planner') ? (
          // Team play: priorities are the Mission Planner's call; others see what was chosen.
          <RoleSummary role="planner">
            <ul className="flex flex-col gap-1">
              {weightInfo.map((w) => (
                <li key={w.key}>
                  {w.label.split(':')[0]}: <b className="text-ink">{planner.weights[w.key] < 0.34 ? 'Low' : planner.weights[w.key] < 0.67 ? 'Medium' : 'High'}</b>
                </li>
              ))}
              <li>
                End of mission: <b className="text-ink">{disposals.find((d) => d.id === planner.disposal)?.label ?? 'not chosen yet'}</b>
              </li>
            </ul>
          </RoleSummary>
        ) : (
        <EditGate can={flow.canEdit('planner')} who={roleNames.planner} className="flex flex-col gap-4 rounded-xl border border-space-700 bg-space-900 p-4">
            <div>
              <h2 className="font-semibold">What matters most?</h2>
              <p className="text-sm text-muted">These set how the final score is weighted. You can't max everything: that's the trade-off.</p>
            </div>
            {weightInfo.map((w) => (
              <Slider
                key={w.key}
                label={w.label}
                value={planner.weights[w.key]}
                onChange={(v) => setWeight(w.key, v)}
                display={planner.weights[w.key] < 0.34 ? 'Low' : planner.weights[w.key] < 0.67 ? 'Medium' : 'High'}
                note={planner.weights[w.key] < 0.34 ? w.low : planner.weights[w.key] < 0.67 ? 'Balanced with the others' : w.high}
              />
            ))}
  
            <div className="border-t border-space-700 pt-4">
              <h2 className="font-semibold">
                End-of-mission plan (<Term id="deorbit">de-orbit</Term>)
              </h2>
              <p className="text-sm text-muted">Dead satellites must come down within {gameData.disposalRuleYears} years, so they don't become space junk.</p>
              <div role="radiogroup" aria-label="End-of-mission plan" className="mt-2 flex flex-col gap-2">
                {disposals.map((d) => (
                  <button
                    key={d.id}
                    role="radio"
                    aria-checked={planner.disposal === d.id}
                    onClick={() => setDisposal(d.id)}
                    className={cn('rounded-lg border p-2.5 text-left text-sm transition-colors', planner.disposal === d.id ? 'border-accent bg-accent/10' : 'border-space-700 hover:border-space-600')}
                  >
                    <span className="font-medium">{d.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{d.what}</span>
                  </button>
                ))}
              </div>
            </div>
          </EditGate>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-space-700 bg-space-900 p-4">
          <div>
            <h2 className="font-semibold">Quick feasibility check</h2>
            <p className="text-sm text-muted">
              {scenario.name} needs to revisit every {scenario.revisitDays} days for {scenario.lifetimeYears} years, on ${scenario.budgetM}M. Which orbits can do it?
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {gameData.orbits.map((o) => {
              const info = orbitInfo(o, null, gameData.decay)
              const lock = ev.compat.orbits[o.id]
              const checks: [boolean, string][] = [
                [lock?.ok !== false, lock?.ok === false ? lock.reason ?? 'No rocket can get there' : 'A rocket in budget can get there'],
                [o.revisitDays <= scenario.revisitDays, o.revisitDays === 0 ? 'Watches one spot all the time' : `Revisits every ${o.revisitDays} days (need ${scenario.revisitDays})`],
                [info.decayYears >= scenario.lifetimeYears, info.decayYears >= 1000 ? 'Stays up forever' : `Stays up about ${n1(info.decayYears)} years at ${o.altitudeKm} km (need ${scenario.lifetimeYears})`],
              ]
              const ok = checks.every(([pass]) => pass)
              return (
                <li key={o.id} className={cn('rounded-lg border p-3', ok ? 'border-ok/50 bg-ok/5' : 'border-space-700')}>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {ok ? <CheckCircle2 className="size-4 text-ok" aria-hidden /> : <XCircle className="size-4 text-bad" aria-hidden />}
                    {o.name}
                    <span className={cn('ml-auto text-xs', ok ? 'text-ok' : 'text-bad')}>{ok ? 'Feasible' : 'Not feasible'}</span>
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-0.5 pl-6 text-xs">
                    {checks.map(([pass, text]) => (
                      <li key={text} className={pass ? 'text-muted' : 'text-bad'}>
                        {pass ? '✓' : '✗'} {text}
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Screen>
  )
}

function Slider(props: { label: string; value: number; onChange: (v: number) => void; display: string; note: ReactNode }) {
  const id = useId()
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {props.label}
        </label>
        <span className="shrink-0 font-display text-accent">{props.display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        aria-valuetext={props.display}
        className="mt-1 h-8 w-full cursor-pointer accent-accent disabled:cursor-not-allowed"
      />
      <p className="mt-1 text-xs text-muted">{props.note}</p>
    </div>
  )
}
