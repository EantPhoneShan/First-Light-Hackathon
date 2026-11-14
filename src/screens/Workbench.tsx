import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Box, Orbit as OrbitIcon, RadioTower, Wrench, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { LaunchPicker } from '@/components/orbit/LaunchPicker'
import { OrbitPicker } from '@/components/orbit/OrbitPicker'
import { StationPicker } from '@/components/orbit/StationPicker'
import { ResourceGauge } from '@/components/ResourceGauge'
import { Screen } from '@/components/Screen'
import { TRAY_ID, type DragData } from '@/components/workbench/dnd'
import { categoryLabel, PartIcon } from '@/components/workbench/PartIcon'
import { PartInfo, PartsTray } from '@/components/workbench/PartsTray'
import { Spacecraft } from '@/components/workbench/Spacecraft'
import { mockGauges, partById, parts, slotsFor } from '@/engine/mock'
import { scienceFor } from '@/engine/mockScience'
import type { Part, SlotDef } from '@/engine/placeholderTypes'
import { cn } from '@/lib/cn'
import { useCanSee, useGame, useScenario } from '@/store/game'
import { resourceOwner, roleNames } from '@/engine/mockReview'
import { play } from '@/lib/sound'

type Tab = 'craft' | 'launch' | 'ground'

/**
 * CML 4 Point design. Three tabs, one per segment the player builds:
 * Space (spacecraft), Launch (orbit + rocket), Ground (stations). Gauges stay on top.
 */
export function Workbench() {
  const scenario = useScenario()
  const design = useGame((s) => s.design)
  const placePart = useGame((s) => s.placePart)
  const refly = useGame((s) => s.refly)
  const setRefly = useGame((s) => s.setRefly)
  const gauges = mockGauges(design, scenario)
  const canSee = useCanSee()
  const slots = slotsFor(design)
  // F3: instruments that can't serve this mission's science goal are locked, with the reason.
  const locks = scienceFor(scenario.id)?.locked ?? {}
  const [dragging, setDragging] = useState<Part | null>(null)
  const [tab, setTab] = useState<Tab>('craft')

  const tabs = [
    { id: 'craft' as const, label: 'Spacecraft', icon: Box, missing: !design.partsBySlot.bus },
    { id: 'launch' as const, label: 'Orbit & launch', icon: OrbitIcon, missing: !design.orbitId || !design.launcherId },
    { id: 'ground' as const, label: 'Ground', icon: RadioTower, missing: design.stationIds.length === 0 },
  ]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const wrongSlot = (part: Part) => {
    const hasSlot = slots.some((s) => s.accepts === part.category)
    play('error')
    toast.error(
      part.category !== 'bus' && !design.partsBySlot.bus
        ? 'Add a bus first. It decides which slots you have.'
        : hasSlot
          ? `${part.name} goes in a ${categoryLabel[part.category]} slot.`
          : `This bus has no ${categoryLabel[part.category]} slot. Try a bigger bus.`,
    )
  }

  /** Tap + in the tray: fill the first empty matching slot, else replace the first matching one. */
  const addPart = (part: Part) => {
    if (locks[part.id]) return play('error'), toast.error(locks[part.id])
    const matching = slots.filter((s) => s.accepts === part.category)
    const target = matching.find((s) => !design.partsBySlot[s.id]) ?? matching[0]
    if (!target) return wrongSlot(part)
    placePart(target.id, part.id)
    play('place')
  }

  const onDragStart = (e: DragStartEvent) => {
    setDragging(partById((e.active.data.current as DragData).partId) ?? null)
  }

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const { partId, fromSlot } = e.active.data.current as DragData
    const part = partById(partId)
    if (!part || !e.over) return
    if (!fromSlot && locks[part.id]) return play('error'), toast.error(locks[part.id])
    const overId = String(e.over.id)

    if (overId === TRAY_ID) {
      if (fromSlot) placePart(fromSlot, null), play('remove')
      return
    }
    if (overId === fromSlot) return

    const target = slots.find((s: SlotDef) => s.id === overId)
    if (!target || target.accepts !== part.category) return wrongSlot(part)

    const displaced = design.partsBySlot[target.id] ?? null
    placePart(target.id, part.id)
    play('place')
    // Moving between two slots of the same kind swaps them.
    if (fromSlot) placePart(fromSlot, displaced)
  }

  return (
    <Screen title="Workbench" subtitle="CML 4 · Point design: build the spacecraft." reqs="F7, F8, F9, F21" nextLabel="Design review">
      <div className="sticky top-[var(--header-h,104px)] z-[5] -mx-4 bg-space-950/90 px-4 py-2 backdrop-blur">
        <div className="grid grid-cols-6 gap-1 sm:gap-2">
          {gauges.map((g) => (
            <ResourceGauge key={g.key} g={g} hiddenBy={canSee(g.key) ? undefined : roleNames[resourceOwner[g.key]]} />
          ))}
        </div>
      </div>

      {refly && refly.fixes.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-bad/50 bg-bad/10 p-4 text-sm" role="status">
          <Wrench className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Fixes from your last flight</p>
            <ul className="mt-1 list-disc pl-5 text-muted">
              {refly.fixes.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {refly.slots.length > 0 && <p className="mt-1 text-xs text-muted">Parts to change are outlined in red.</p>}
          </div>
          <button onClick={() => setRefly(null)} className="rounded p-1 text-muted hover:bg-space-800 hover:text-ink" aria-label="Dismiss fixes">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex gap-1 rounded-xl border border-space-700 bg-space-900 p-1" role="tablist" aria-label="Mission segment">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-xs font-medium transition-colors sm:px-2 sm:text-sm',
              tab === t.id ? 'bg-accent text-space-950' : 'text-muted hover:bg-space-800 hover:text-ink',
            )}
          >
            <t.icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t.label}</span>
            {refly?.tabs.includes(t.id as 'launch' | 'ground') ? (
              <span className="size-1.5 shrink-0 rounded-full bg-bad" aria-label="has a fix to make" />
            ) : (
              t.missing && <span className="size-1.5 shrink-0 rounded-full bg-warn" aria-label="needs a choice" />
            )}
          </button>
        ))}
      </div>

      {tab === 'launch' && (
        <div className="flex flex-col gap-8">
          <OrbitPicker />
          <LaunchPicker />
        </div>
      )}
      {tab === 'ground' && <StationPicker />}

      {tab === 'craft' && (
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-xl border border-space-700 bg-[radial-gradient(circle_at_50%_40%,var(--color-space-800),var(--color-space-900)_70%)] p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Spacecraft</h2>
              <span className="text-xs text-muted">{scenario.craft}</span>
            </div>
            <Spacecraft slots={slots} partsBySlot={design.partsBySlot} problemSlots={refly?.slots} onRemove={(id) => (placePart(id, null), play('remove'))} />
          </div>

          <PartsTray parts={parts} onAdd={addPart} locks={locks} />
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="flex w-64 items-center gap-2.5 rounded-lg border border-accent bg-space-800 p-2 shadow-xl shadow-black/50">
              <PartIcon part={dragging} className="size-10 shrink-0" />
              <PartInfo part={dragging} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      )}
    </Screen>
  )
}
