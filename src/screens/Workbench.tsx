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
import { Box, Orbit as OrbitIcon, RadioTower, Scale, Wrench, X } from 'lucide-react'
import { TradeStudy } from '@/components/TradeStudy'
import { Fallback3D } from '@/components/Fallback3D'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { LaunchPicker } from '@/components/orbit/LaunchPicker'
import { OrbitPicker } from '@/components/orbit/OrbitPicker'
import { StationPicker } from '@/components/orbit/StationPicker'
import { ResourceGauge } from '@/components/ResourceGauge'
import { Screen } from '@/components/Screen'
import { CRAFT_ID, TRAY_ID, type DragData } from '@/components/workbench/dnd'
import { useDroppable } from '@dnd-kit/core'
import { PartIcon } from '@/components/workbench/PartIcon'
import { PartInfo, PartsTray } from '@/components/workbench/PartsTray'
import { Spacecraft } from '@/components/workbench/Spacecraft'
import { findBus, findPart } from '@/engine/data'
import { CATEGORY_OWNER, RESOURCES, type Availability, type Part } from '@/engine/types'
import { EditGate } from '@/components/LeadButton'
import { useTeamFlow } from '@/game/teamFlow'
import { GAUGE_WATCHER, gameData, n1, partsOnCraft, roleNames } from '@/game/ui'
import { cn } from '@/lib/cn'
import { play } from '@/lib/sound'
import { useCanSee, useEvaluation, useGame, useScenario } from '@/store/game'

type Tab = 'craft' | 'launch' | 'ground' | 'trade'

// three.js is big: only download it when the 3D view opens.
const Craft3D = lazy(() => import('@/three/Craft3D'))

/** The 3D view is also where you drop parts from the tray. */
function CraftDrop({ className, children }: { className?: string; children: ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: CRAFT_ID })
  const incoming = active && !(active.data.current as DragData | undefined)?.fromCraft
  return (
    <div ref={setNodeRef} className={cn('rounded-xl transition-shadow', className, incoming && 'ring-2 ring-accent/50', isOver && incoming && 'ring-accent')}>
      {children}
    </div>
  )
}

/**
 * CML 4 Point design. Three tabs, one per segment the player builds:
 * Space (spacecraft), Launch (orbit + rocket), Ground (stations). Gauges stay on top.
 * Every number comes from Member 1's evaluate().
 */
export function Workbench() {
  const scenario = useScenario()
  const design = useGame((s) => s.design)
  const setBus = useGame((s) => s.setBus)
  const addPart = useGame((s) => s.addPart)
  const removePart = useGame((s) => s.removePart)
  const refly = useGame((s) => s.refly)
  const setRefly = useGame((s) => s.setRefly)
  const ev = useEvaluation()
  const canSee = useCanSee()
  const [dragging, setDragging] = useState<DragData | null>(null)
  const [tab, setTab] = useState<Tab>('craft')
  const [view, setView] = useState<'3d' | 'slots'>('3d')

  const bus = findBus(gameData, design.engineer.busId)
  const buses = gameData.buses.filter((b) => scenario.busIds.includes(b.id))
  const onCraft = partsOnCraft(design)
  const counts = onCraft.reduce<Record<string, number>>((m, p) => ((m[p.id] = (m[p.id] ?? 0) + 1), m), {})
  // A part can be added when the engine allows one more, and (instruments) when it serves the science goal (F3).
  const availability: Record<string, Availability> = { ...ev.compat.parts }
  for (const [id, a] of Object.entries(ev.compat.instruments)) if (!a.ok) availability[id] = a

  // Team flow: each role builds only its own part of the craft (engine/flow.ts canEditSection).
  const flow = useTeamFlow()
  const canEditPart = (p: Part) => flow.canEdit(CATEGORY_OWNER[p.category])
  const canBus = flow.canEdit('engineer')
  for (const p of gameData.parts) {
    if (!canEditPart(p)) availability[p.id] = { ok: false, reason: `Only the ${roleNames[CATEGORY_OWNER[p.category]]} adds this.` }
  }

  const allTabs = [
    { id: 'craft' as const, label: 'Spacecraft', short: 'Craft', icon: Box, missing: !bus },
    { id: 'launch' as const, label: 'Orbit & launch', short: 'Orbit', icon: OrbitIcon, missing: !design.flight.orbitId || !design.flight.launcherId },
    { id: 'ground' as const, label: 'Ground', short: 'Ground', icon: RadioTower, missing: design.flight.stationIds.length === 0 },
    { id: 'trade' as const, label: 'Trade study', short: 'Trade', icon: Scale, missing: false },
  ]
  // Team play: each player sees only the tabs for their own work. Engineer and Science Lead
  // build the craft; Flight Dynamics does orbit, launch and ground; the Planner runs the trade study.
  const mine = flow.myRoles
  const ownsTab = (id: Tab) =>
    id === 'craft' ? mine.includes('engineer') || mine.includes('science') : id === 'trade' ? mine.includes('planner') : mine.includes('flight')
  const tabs = flow.team ? allTabs.filter((t) => ownsTab(t.id)) : allTabs
  const shown = tabs.length ? tabs : allTabs.slice(0, 1)
  const activeTab: Tab = shown.some((t) => t.id === tab) ? tab : shown[0].id
  // ...and the parts tray holds only the parts this player adds.
  const trayParts = flow.team ? gameData.parts.filter(canEditPart) : gameData.parts
  const trayBuses = flow.team && !canBus ? [] : buses

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  /** Add a bus or one more of a part, unless the engine says it can't go on. */
  const add = (kind: 'part' | 'bus', id: string) => {
    if (kind === 'bus') {
      if (!canBus) return toast.error(`Only the ${roleNames.engineer} picks the bus.`)
      setBus(id)
      return play('place')
    }
    if (!bus) {
      play('error')
      return toast.error('Add a bus first. It decides how many slots you have.')
    }
    const a = availability[id]
    if (a && !a.ok) {
      play('error')
      return toast.error(a.reason ?? "That part can't go on this craft.")
    }
    addPart(id)
    play('place')
  }

  const remove = (id: string) => {
    const p = findPart(gameData, id)
    if (p && !canEditPart(p)) return toast.error(`Only the ${roleNames[CATEGORY_OWNER[p.category]]} can take this off.`)
    removePart(id)
    play('remove')
  }

  const onDragStart = (e: DragStartEvent) => setDragging(e.active.data.current as DragData)

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const d = e.active.data.current as DragData
    const over = e.over ? String(e.over.id) : null
    if (d.fromCraft && over === TRAY_ID) return remove(d.id)
    if (!d.fromCraft && over === CRAFT_ID) add(d.kind, d.id)
  }

  const draggedItem: Part | undefined = dragging?.kind === 'part' ? findPart(gameData, dragging.id) : undefined
  const draggedBus = dragging?.kind === 'bus' ? findBus(gameData, dragging.id) : undefined

  return (
    <Screen title="Workbench" subtitle="CML 4 · Point design: build the spacecraft." reqs="F7, F8, F9, F21" nextLabel="Design review">
      <div className="sticky top-[var(--header-h,104px)] z-[5] -mx-4 bg-space-950/90 px-4 py-2 backdrop-blur">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {RESOURCES.map((r) => (
            <ResourceGauge key={r} g={ev.gauges[r]} hiddenBy={canSee(r) ? undefined : roleNames[GAUGE_WATCHER[r]]} />
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
            {refly.partIds.length > 0 && <p className="mt-1 text-xs text-muted">Parts to change are outlined in red.</p>}
          </div>
          <button onClick={() => setRefly(null)} className="rounded p-1 text-muted hover:bg-space-800 hover:text-ink" aria-label="Dismiss fixes">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex gap-1 rounded-xl border border-space-700 bg-space-900 p-1" role="tablist" aria-label="Mission segment">
        {shown.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-xs font-medium transition-colors sm:px-2 sm:text-sm',
              activeTab === t.id ? 'bg-accent text-space-950' : 'text-muted hover:bg-space-800 hover:text-ink',
            )}
          >
            <t.icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate sm:hidden">{t.short}</span>
            <span className="hidden truncate sm:inline">{t.label}</span>
            {refly?.tabs.includes(t.id as 'launch' | 'ground') ? (
              <span className="size-1.5 shrink-0 rounded-full bg-bad" aria-label="has a fix to make" />
            ) : (
              t.missing && <span className="size-1.5 shrink-0 rounded-full bg-warn" aria-label="needs a choice" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'launch' && (
        <EditGate can={flow.canEdit('flight')} who={roleNames.flight} className="flex flex-col gap-8">
          <OrbitPicker />
          <LaunchPicker />
        </EditGate>
      )}
      {activeTab === 'trade' && <TradeStudy />}
      {activeTab === 'ground' && (
        <EditGate can={flow.canEdit('flight')} who={roleNames.flight}>
          <StationPicker />
        </EditGate>
      )}

      {activeTab === 'craft' && (
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-xl border border-space-700 bg-[radial-gradient(circle_at_50%_40%,var(--color-space-800),var(--color-space-900)_70%)] p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Spacecraft</h2>
              <span className="ml-auto text-xs text-muted">{n1(ev.totals.massKg)} kg</span>
              <div className="flex rounded-lg bg-space-800 p-0.5 text-xs" role="radiogroup" aria-label="Spacecraft view">
                {(['3d', 'slots'] as const).map((v) => (
                  <button
                    key={v}
                    role="radio"
                    aria-checked={view === v}
                    onClick={() => setView(v)}
                    className={cn('rounded-md px-3 py-1.5 transition-colors', view === v ? 'bg-accent text-space-950' : 'text-muted hover:text-ink')}
                  >
                    {v === '3d' ? '3D' : 'Slots'}
                  </button>
                ))}
              </div>
            </div>
            {view === '3d' ? (
              // No WebGL on this device? Fall back to the 2D slot view instead of crashing the page.
              <Fallback3D fallback={<Spacecraft bus={bus} parts={onCraft} problemIds={refly?.partIds} onRemove={remove} onRemoveBus={() => (setBus(null), play('remove'))} canRemove={canEditPart} canRemoveBus={canBus} />}>
              <CraftDrop className="mt-3">
                <Suspense fallback={<div className="flex h-[320px] items-center justify-center text-sm text-muted sm:h-[480px]">Loading 3D view…</div>}>
                  <Craft3D
                    bus={bus}
                    parts={onCraft}
                    problemIds={refly?.partIds}
                    canRemove={canEditPart}
                    onRemove={remove}
                    empty={
                      <span>
                        Start with a bus. Drag it here, or tap + in the <b className="text-ink">Bus</b> tab of the parts tray.
                      </span>
                    }
                  />
                </Suspense>
              </CraftDrop>
              </Fallback3D>
            ) : (
              <Spacecraft bus={bus} parts={onCraft} problemIds={refly?.partIds} onRemove={remove} onRemoveBus={() => (setBus(null), play('remove'))} canRemove={canEditPart} canRemoveBus={canBus} />
            )}
          </div>

          <PartsTray buses={trayBuses} parts={trayParts} availability={availability} counts={counts} currentBusId={design.engineer.busId} onAdd={add} busLocked={canBus ? undefined : `Only the ${roleNames.engineer} picks the bus.`} />
        </div>

        <DragOverlay dropAnimation={null}>
          {(draggedItem || draggedBus) && (
            <div className="flex w-64 items-center gap-2.5 rounded-lg border border-accent bg-space-800 p-2 shadow-xl shadow-black/50">
              <PartIcon item={draggedItem ?? draggedBus!} className="size-10 shrink-0" />
              {draggedItem ? <PartInfo part={draggedItem} /> : <span className="text-sm font-medium">{draggedBus!.name}</span>}
            </div>
          )}
        </DragOverlay>
      </DndContext>
      )}
    </Screen>
  )
}
