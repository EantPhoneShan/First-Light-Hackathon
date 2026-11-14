import { Screen } from '@/components/Screen'
import { Traceability } from '@/components/Traceability'
import { scenarios } from '@/engine/mock'
import { cn } from '@/lib/cn'
import { useGame, useScenario } from '@/store/game'
import { Term } from '@/components/Term'

export function Briefing() {
  const scenario = useScenario()
  const setScenario = useGame((s) => s.setScenario)

  const facts = [
    ['Data customer', scenario.customer],
    ['Spacecraft', scenario.craft],
    ['Budget', `$${scenario.budgetM}M`],
    ['Launch date', scenario.launchDate],
    ['Required lifetime', `${scenario.lifetimeYears} years`],
    ['Critical resources', scenario.critical.join(', ')],
  ]

  return (
    <Screen title="Mission briefing" subtitle="CML 1 · Idea: start from the science goal." reqs="F2, F3" nextLabel="Set requirements">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Scenario">
        {scenarios.map((sc) => (
          <button
            key={sc.id}
            role="tab"
            aria-selected={sc.id === scenario.id}
            onClick={() => setScenario(sc.id)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm transition-colors',
              sc.id === scenario.id ? 'border-accent bg-accent/15 text-ink' : 'border-space-700 text-muted hover:text-ink',
            )}
          >
            {sc.name}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-space-700 bg-space-900 p-5">
        <h2 className="text-xl font-semibold">{scenario.name}</h2>
        <p className="mt-1">{scenario.objective}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted uppercase">{k === 'Data customer' ? <Term id="data-customer">{k}</Term> : k}</dt>
              <dd className="font-medium capitalize">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Traceability />
    </Screen>
  )
}
