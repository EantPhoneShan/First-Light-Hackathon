import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Lock, Plus } from 'lucide-react'
import { useState } from 'react'
import type { Part, PartCategory } from '@/engine/types'
import { cn } from '@/lib/cn'
import { TRAY_ID, type DragData } from './dnd'
import { categoryLabel, PartIcon } from './PartIcon'

interface PartsTrayProps {
  parts: Part[]
  onAdd: (part: Part) => void
  /** Part id -> reason it's locked for this mission (F3). */
  locks?: Record<string, string>
}

/** Parts grouped by category. Drag a part onto the craft, or tap + to drop it in the first free slot. */
export function PartsTray({ parts, onAdd, locks = {} }: PartsTrayProps) {
  const categories = [...new Set(parts.map((p) => p.category))]
  const [tab, setTab] = useState<PartCategory | 'all'>('all')
  const shown = tab === 'all' ? parts : parts.filter((p) => p.category === tab)
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_ID })

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
        {(['all', ...categories] as const).map((c) => (
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
            {c === 'all' ? 'All' : categoryLabel[c]}
          </button>
        ))}
      </div>

      <ul className="mt-2 flex max-h-[460px] flex-col gap-1.5 overflow-y-auto pr-1">
        {shown.map((p) => (
          <TrayPart key={p.id} part={p} onAdd={onAdd} locked={locks[p.id]} />
        ))}
      </ul>
    </aside>
  )
}

function TrayPart({ part, onAdd, locked }: { part: Part; onAdd: (p: Part) => void; locked?: string }) {
  const data: DragData = { partId: part.id, fromSlot: null }
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `tray:${part.id}`, data, disabled: !!locked })

  if (locked) {
    return (
      <li className="flex items-center gap-2 rounded-lg border border-dashed border-space-700 p-2" aria-label={`${part.name}, locked. ${locked}`}>
        <PartIcon part={part} className="size-10 shrink-0 opacity-50 grayscale" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <Lock className="size-3.5 shrink-0 text-bad" aria-hidden />
            <span className="truncate">{part.name}</span>
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-bad/90">{locked}</span>
        </span>
      </li>
    )
  }

  return (
    <li className={cn('flex items-center gap-2 rounded-lg border border-transparent bg-space-800/60 p-2 hover:border-space-600', isDragging && 'opacity-40')}>
      <div ref={setNodeRef} {...listeners} {...attributes} aria-label={`Drag ${part.name}`} className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2.5 active:cursor-grabbing">
        <PartIcon part={part} className="size-10 shrink-0" />
        <PartInfo part={part} />
      </div>
      <button onClick={() => onAdd(part)} className="shrink-0 rounded-md p-2.5 text-accent hover:bg-space-700 sm:p-1.5" aria-label={`Add ${part.name}`}>
        <Plus className="size-4" />
      </button>
    </li>
  )
}

export function PartInfo({ part }: { part: Part }) {
  const power = part.powerW < 0 ? `+${-part.powerW} W` : `${part.powerW} W`
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium">{part.name}</span>
      <span className="block text-[11px] text-muted tabular-nums">
        {part.massKg} kg · <span className={part.powerW < 0 ? 'text-ok' : undefined}>{power}</span> · ${part.costM}M · {part.buildMonths} mo
      </span>
      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted/80">{part.tooltip}</span>
    </span>
  )
}
