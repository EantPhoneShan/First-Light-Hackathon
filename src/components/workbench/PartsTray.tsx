import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Lock, Plus } from 'lucide-react'
import { useState } from 'react'
import type { Availability, Bus, Part, PartCategory } from '@/engine/types'
import { categoryLabel, n1 } from '@/game/ui'
import { cn } from '@/lib/cn'
import { TRAY_ID, type DragData } from './dnd'
import { PartIcon } from './PartIcon'

interface PartsTrayProps {
  buses: Bus[]
  parts: Part[]
  /** Member 1's evaluate().compat: part id -> can one more be added, and why not. */
  availability: Record<string, Availability>
  /** How many of each part are on the craft. */
  counts: Record<string, number>
  currentBusId: string | null
  onAdd: (kind: 'part' | 'bus', id: string) => void
}

type Tab = 'all' | 'bus' | PartCategory

/** Buses and parts by category. Drag onto the spacecraft, or tap + to add. */
export function PartsTray({ buses, parts, availability, counts, currentBusId, onAdd }: PartsTrayProps) {
  const categories = [...new Set(parts.map((p) => p.category))]
  const [tab, setTab] = useState<Tab>('all')
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_ID })
  const showBuses = tab === 'all' || tab === 'bus'
  const shownParts = tab === 'all' ? parts : tab === 'bus' ? [] : parts.filter((p) => p.category === tab)

  return (
    <aside
      ref={setNodeRef}
      aria-label="Parts tray"
      className={cn('flex flex-col rounded-xl border bg-space-900 p-3 transition-colors', isOver ? 'border-bad/70 bg-bad/5' : 'border-space-700')}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Parts</h2>
        <span className="text-xs text-muted">{isOver ? 'Drop to remove' : 'Drag onto the spacecraft'}</span>
      </div>

      <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Part category">
        {(['all', 'bus', ...categories] as Tab[]).map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={tab === c}
            onClick={() => setTab(c)}
            className={cn(
              'shrink-0 rounded-full px-3 py-2 text-xs transition-colors sm:px-2.5 sm:py-1',
              tab === c ? 'bg-accent text-space-950' : 'bg-space-800 text-muted hover:text-ink',
            )}
          >
            {c === 'all' ? 'All' : c === 'bus' ? 'Bus' : categoryLabel[c]}
          </button>
        ))}
      </div>

      <ul className="mt-2 flex max-h-[460px] flex-col gap-1.5 overflow-y-auto pr-1">
        {showBuses &&
          buses.map((b) => (
            <TrayItem key={b.id} kind="bus" id={b.id} item={b} count={b.id === currentBusId ? 1 : 0} onAdd={onAdd}>
              <Stats item={b} extra={`${b.slots} slots · carries ${n1(b.maxMassKg)} kg`} />
            </TrayItem>
          ))}
        {shownParts.map((p) => (
          <TrayItem key={p.id} kind="part" id={p.id} item={p} count={counts[p.id] ?? 0} locked={availability[p.id]?.ok === false ? availability[p.id].reason ?? 'Not available' : undefined} onAdd={onAdd}>
            <PartInfo part={p} />
          </TrayItem>
        ))}
      </ul>
    </aside>
  )
}

function TrayItem({
  kind,
  id,
  item,
  count,
  locked,
  onAdd,
  children,
}: {
  kind: 'part' | 'bus'
  id: string
  item: Part | Bus
  count: number
  locked?: string
  onAdd: (kind: 'part' | 'bus', id: string) => void
  children: React.ReactNode
}) {
  const data: DragData = { id, kind, fromCraft: false }
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `tray:${id}`, data, disabled: !!locked })
  const category = 'category' in item ? item.category : undefined

  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-lg border p-2',
        locked ? 'border-dashed border-space-700' : 'border-transparent bg-space-800/60 hover:border-space-600',
        isDragging && 'opacity-40',
      )}
      aria-label={locked ? `${item.name}, can't add. ${locked}` : undefined}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        aria-label={locked ? undefined : `Drag ${item.name}`}
        className={cn('flex min-w-0 flex-1 items-center gap-2.5', !locked && 'cursor-grab touch-none active:cursor-grabbing')}
      >
        <span className="relative shrink-0">
          <PartIcon item={{ id, category }} className={cn('size-10', locked && 'opacity-50 grayscale')} />
          {count > 0 && (
            <span className="absolute -right-1 -bottom-1 rounded-full bg-accent px-1 text-[10px] font-semibold text-space-950 tabular-nums">
              {kind === 'bus' ? '✓' : `×${count}`}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          {children}
          {locked && (
            <span className="mt-0.5 flex items-start gap-1 text-[11px] leading-snug text-bad/90">
              <Lock className="mt-px size-3 shrink-0" aria-hidden />
              {locked}
            </span>
          )}
        </span>
      </div>
      {!locked && (
        <button onClick={() => onAdd(kind, id)} className="shrink-0 rounded-md p-2.5 text-accent hover:bg-space-700 sm:p-1.5" aria-label={`Add ${item.name}`}>
          <Plus className="size-4" />
        </button>
      )}
    </li>
  )
}

function Stats({ item, extra }: { item: Part | Bus; extra?: string }) {
  const gen = 'generationW' in item ? item.generationW : undefined
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium">{item.name}</span>
      <span className="block text-[11px] text-muted tabular-nums">
        {n1(item.massKg)} kg · {gen ? <span className="text-ok">+{n1(gen)} W</span> : `${n1(item.powerW)} W`} · ${n1(item.costM)}M · {item.buildMonths} mo
        {extra && ` · ${extra}`}
      </span>
      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted/80">{item.tooltip}</span>
    </span>
  )
}

/** The one stat that matters most for each kind of part. */
function keyStat(p: Part): string | undefined {
  if (p.capacityWh) return `${n1(p.capacityWh)} Wh`
  if (p.storageMB) return `${n1(p.storageMB / 1000)} GB storage`
  if (p.dataRateMbps) return `${n1(p.dataRateMbps)} Mbps`
  if (p.dataMBPerOrbit) return `${n1(p.dataMBPerOrbit)} MB/orbit`
  if (p.propellantKg) return `${n1(p.propellantKg)} kg fuel`
  return undefined
}

export function PartInfo({ part }: { part: Part }) {
  const stat = keyStat(part)
  const slots = part.slots === 0 ? 'outside' : `${part.slots} slot${part.slots > 1 ? 's' : ''}`
  return <Stats item={part} extra={[stat, slots].filter(Boolean).join(' · ')} />
}
