import { Term } from '@/components/Term'
import { disposals } from '@/content/disposals'
import { gameData, n1 } from '@/game/ui'
import { cn } from '@/lib/cn'
import { useEvaluation, useGame } from '@/store/game'

/**
 * F10 end-of-mission plan (Mission Planner). Used on Feasibility (CML 2) and on the
 * workbench's Plan tab, so the Planner can change it after the point design shows a
 * problem, the way real design teams iterate. Wrap it in an EditGate for the Planner.
 */
export function DisposalPicker({ heading = true }: { heading?: boolean }) {
  const disposal = useGame((s) => s.design.planner.disposal)
  const setDisposal = useGame((s) => s.setDisposal)
  const ev = useEvaluation()
  const rule = gameData.disposalRuleYears
  const orb = ev.orbit

  return (
    <div>
      {heading && (
        <h2 className="font-semibold">
          End-of-mission plan (<Term id="deorbit">de-orbit</Term>)
        </h2>
      )}
      <p className="text-sm text-muted">Dead satellites must come down within {rule} years, so they don't become space junk.</p>
      {orb && (
        <p className="mt-1 text-sm">
          {Number.isFinite(orb.decayYears)
            ? `At ${n1(orb.altitudeKm)} km, air drag brings the craft down in about ${n1(orb.decayYears)} years (limit ${rule}).${orb.decayYears <= rule ? ' Natural decay is enough here.' : ' That is too long: plan a thruster burn, or fly lower.'}`
            : 'Air drag never brings a craft down from this orbit.'}
        </p>
      )}
      <div role="radiogroup" aria-label="End-of-mission plan" className="mt-2 flex flex-col gap-2">
        {disposals.map((d) => (
          <button
            key={d.id}
            role="radio"
            aria-checked={disposal === d.id}
            onClick={() => setDisposal(d.id)}
            className={cn('rounded-lg border p-2.5 text-left text-sm transition-colors', disposal === d.id ? 'border-accent bg-accent/10' : 'border-space-700 hover:border-space-600')}
          >
            <span className="font-medium">{d.label}</span>
            <span className="mt-0.5 block text-xs text-muted">{d.what}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
