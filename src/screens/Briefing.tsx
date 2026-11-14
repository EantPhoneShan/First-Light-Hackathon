import { Screen } from '@/components/Screen'
import { Traceability } from '@/components/Traceability'
import { RESOURCE_LABELS } from '@/engine/types'
import { gameData, roleNames } from '@/game/ui'
import { useScenario } from '@/store/game'
import { EditGate } from '@/components/LeadButton'
import { ScenarioPicker } from '@/components/ScenarioPicker'
import { useTeamFlow } from '@/game/teamFlow'
import { Term } from '@/components/Term'

export function Briefing() {
  const scenario = useScenario()
  const flow = useTeamFlow()

  const facts = [
    ['Data customer', `${scenario.customer.name} (need images within ${scenario.customer.needsDataWithinHours} h)`],
    ['Spacecraft', gameData.buses.filter((b) => scenario.busIds.includes(b.id)).map((b) => b.name).join(' or ')],
    ['Budget', `$${scenario.budgetM}M`],
    ['Launch', `in ${scenario.launchInMonths} months`],
    ['Required lifetime', `${scenario.lifetimeYears} years`],
    ['Revisit target', `every ${scenario.revisitDays} days`],
    ['Critical resources', scenario.criticalResources.map((r) => RESOURCE_LABELS[r]).join(', ')],
  ]

  return (
    <Screen title="Mission briefing" subtitle="CML 1 · Idea: start from the science goal." reqs="F2, F3" nextLabel="Set requirements">
      <ScenarioPicker disabled={!flow.lead} />

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

      <EditGate can={flow.canEdit('science')} who={roleNames.science}>
        <Traceability />
      </EditGate>
    </Screen>
  )
}
