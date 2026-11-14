import { ArrowLeftRight, CheckCircle2, Loader2, Rocket, Save, Scale } from 'lucide-react'
import { useEffect, useState } from 'react'
import { findBus, findLauncher, findOrbit } from '@/engine/data'
import { DEFAULT_SEED } from '@/engine/simulate'
import { compareDesigns, type Side, type TradeStudy as Study } from '@/engine/trade'
import type { Design } from '@/engine/types'
import { gameData, partsOnCraft } from '@/game/ui'
import { useTeamFlow } from '@/game/teamFlow'
import { cn } from '@/lib/cn'
import { play } from '@/lib/sound'
import { useGame, useScenario } from '@/store/game'
import { sync } from '@/sync'

/** One line that says what an option is: bus, instruments, orbit, rocket. */
function summary(d: Design): string[] {
  const bus = findBus(gameData, d.engineer.busId)?.name ?? 'No bus'
  const inst = partsOnCraft(d).filter((p) => p.category === 'instrument').map((p) => p.name)
  const orbit = findOrbit(gameData, d.flight.orbitId)?.name ?? 'No orbit'
  const rocket = findLauncher(gameData, d.flight.launcherId)?.name ?? 'No rocket'
  return [bus, inst.length ? inst.join(', ') : 'No instrument', `${orbit} · ${rocket}`, `${partsOnCraft(d).length} parts`]
}

/**
 * Trade study (CML 3, PRD F6): save two versions of the craft as Option A and
 * Option B, fly both on the same seed (Member 1's compareDesigns), read the
 * side-by-side table, then fly the one the team picks. Flying a picked option
 * earns the trade-study decision points.
 */
export function TradeStudy() {
  const scenario = useScenario()
  const design = useGame((s) => s.design)
  const a = useGame((s) => s.tradeA)
  const b = useGame((s) => s.tradeB)
  const used = useGame((s) => s.tradeUsed)
  const saveOption = useGame((s) => s.saveTradeOption)
  const loadDesign = useGame((s) => s.loadDesign)
  const flow = useTeamFlow()
  const [study, setStudy] = useState<Study | null>(null)
  const [busy, setBusy] = useState(false)

  // A changed option makes the old comparison wrong.
  useEffect(() => setStudy(null), [a, b])

  // Loading an option rewrites every role's part, so in a team only the leader does it.
  const canLoad = flow.lead
  const canSave = !flow.team || flow.lead

  const compare = () => {
    if (!a || !b) return
    setBusy(true)
    // Two full flights take a moment; let the spinner paint first.
    setTimeout(() => {
      setStudy(compareDesigns(a, b, scenario, gameData, { seed: sync.getRoom()?.seed ?? DEFAULT_SEED }))
      setBusy(false)
      play('complete')
    }, 30)
  }

  const fly = (side: 'a' | 'b') => {
    const d = side === 'a' ? a : b
    if (!d) return
    loadDesign(d, true)
    play('place')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-space-700 bg-space-900 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Scale className="size-4 text-accent" aria-hidden />
          Trade study <span className="text-sm font-normal text-muted">· CML 3</span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Real teams never build the first idea. Save the craft as <b className="text-ink">Option A</b>, change something (a different instrument, orbit or rocket), save it as{' '}
          <b className="text-ink">Option B</b>, then compare. Both fly the same mission with the same events, so only the design differs. Flying the option you pick earns decision points.
        </p>
        {used && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-ok">
            <CheckCircle2 className="size-4" aria-hidden />
            This design was picked in a trade study.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['a', 'b'] as const).map((slot) => {
          const d = slot === 'a' ? a : b
          const win = study && study.recommendation === slot
          return (
            <div key={slot} className={cn('flex flex-col gap-2 rounded-xl border p-4', win ? 'border-ok/60 bg-ok/5' : 'border-space-700 bg-space-900')}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">Option {slot.toUpperCase()}</h3>
                {win && <span className="rounded-full bg-ok/20 px-2 py-0.5 text-xs text-ok">Recommended</span>}
              </div>
              {d ? (
                <ul className="text-sm text-muted">
                  {summary(d).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Empty. Build a craft on the other tabs, then save it here.</p>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => (saveOption(slot), play('place'))}
                  disabled={!canSave || !design.engineer.busId}
                  title={!design.engineer.busId ? 'Add a bus first.' : !canSave ? 'Only the Mission Planner saves options in a team.' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-space-600 px-3 py-1.5 text-sm hover:bg-space-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save className="size-4" aria-hidden />
                  {d ? 'Replace with current' : 'Save current design'}
                </button>
                {d && (
                  <button
                    onClick={() => fly(slot)}
                    disabled={!canLoad}
                    title={!canLoad ? 'Only the Mission Planner switches the team to an option.' : 'Put this option on the workbench, ready to review and launch'}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40',
                      win ? 'bg-accent text-space-950 hover:bg-accent-strong' : 'bg-space-700 hover:bg-space-600',
                    )}
                  >
                    <Rocket className="size-4" aria-hidden />
                    Fly Option {slot.toUpperCase()}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center">
        <button
          onClick={compare}
          disabled={!a || !b || busy}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-space-950 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowLeftRight className="size-4" aria-hidden />}
          {busy ? 'Flying both options…' : 'Compare A and B'}
        </button>
      </div>

      {study && <StudyTable study={study} />}
    </div>
  )
}

function StudyTable({ study }: { study: Study }) {
  const mark = (row: Side, side: 'a' | 'b') => row === side
  return (
    <div className="overflow-hidden rounded-xl border border-space-700 bg-space-900">
      <p className="border-b border-space-700 p-4 text-sm">
        <b className="text-ink">{study.recommendation === 'tie' ? 'A close call.' : `Pick Option ${study.recommendation.toUpperCase()}.`}</b> <span className="text-muted">{study.why}</span>
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted uppercase">
            <th className="px-4 py-2 font-medium">Measure</th>
            <th className="px-4 py-2 font-medium">Option A</th>
            <th className="px-4 py-2 font-medium">Option B</th>
          </tr>
        </thead>
        <tbody>
          {study.rows.map((r) => (
            <tr key={r.id} className="border-t border-space-700/60">
              <td className="px-4 py-2 text-muted">{r.label}</td>
              {(['a', 'b'] as const).map((side) => (
                <td key={side} className={cn('px-4 py-2 tabular-nums', r.id === 'outcome' && 'capitalize', mark(r.better, side) ? 'font-medium text-ok' : 'text-ink')}>
                  {r[side]}
                  {mark(r.better, side) && <CheckCircle2 className="ml-1.5 inline size-3.5 align-[-2px]" aria-label="better" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
