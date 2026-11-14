import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { X } from 'lucide-react'
import { partById } from '@/engine/mock'
import type { Part, SlotDef, SlotZone } from '@/engine/placeholderTypes'
import { cn } from '@/lib/cn'
import type { DragData } from './dnd'
import { categoryIcon, PartIcon } from './PartIcon'

interface SpacecraftProps {
  slots: SlotDef[]
  partsBySlot: Record<string, string | null>
  problemSlots?: string[] // highlighted after a failed flight (F18)
  onRemove: (slotId: string) => void
}

/** 2D spacecraft: antennas on top, solar panels on the sides, core inside, instruments below. */
export function Spacecraft({ slots, partsBySlot, problemSlots = [], onRemove }: SpacecraftProps) {
  const zone = (z: SlotZone) => slots.filter((s) => s.zone === z && s.id !== 'bus')
  const hasBus = !!partsBySlot.bus

  const render = (s: SlotDef, variant: 'wing' | 'cell') => (
    <Slot key={s.id} slot={s} part={partById(partsBySlot[s.id])} variant={variant} problem={problemSlots.includes(s.id)} onRemove={onRemove} />
  )

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      {hasBus && <div className="flex flex-wrap justify-center gap-2">{zone('top').map((s) => render(s, 'cell'))}</div>}
      {hasBus && zone('top').length > 0 && <div className="h-3 w-0.5 bg-space-600" aria-hidden />}

      <div className="flex w-full items-center justify-center gap-2">
        {hasBus && <div className="flex flex-col gap-2">{zone('left').map((s) => render(s, 'wing'))}</div>}

        <div
          className={cn(
            'rounded-2xl border-2 p-3',
            hasBus ? 'border-space-600 bg-space-800/60' : 'border-transparent',
          )}
        >
          <div className="mb-2 flex justify-center">{render(slots.find((s) => s.id === 'bus')!, 'cell')}</div>
          {hasBus && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{zone('core').filter((s) => s.id !== 'bus').map((s) => render(s, 'cell'))}</div>}
        </div>

        {hasBus && <div className="flex flex-col gap-2">{zone('right').map((s) => render(s, 'wing'))}</div>}
      </div>

      {hasBus && zone('bottom').length > 0 && <div className="h-3 w-0.5 bg-space-600" aria-hidden />}
      {hasBus && <div className="flex flex-wrap justify-center gap-2">{zone('bottom').map((s) => render(s, 'cell'))}</div>}

      {!hasBus && <p className="max-w-xs text-center text-sm text-muted">Start with a bus. It's the frame, and its size decides how many slots you get.</p>}
    </div>
  )
}

interface SlotProps {
  slot: SlotDef
  part?: Part
  variant: 'wing' | 'cell'
  problem: boolean
  onRemove: (slotId: string) => void
}

function Slot({ slot, part, variant, problem, onRemove }: SlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id, data: { accepts: slot.accepts } })
  const { active } = useDndContext()
  const dragged = partById((active?.data.current as DragData | undefined)?.partId)
  const fits = dragged?.category === slot.accepts
  const Icon = categoryIcon[slot.accepts]

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex items-center gap-2 rounded-xl border-2 text-left transition-colors',
        variant === 'wing' ? 'h-24 w-20 flex-col justify-center p-2 sm:w-28' : 'h-16 w-32 p-2 sm:w-44',
        part ? 'border-space-600 bg-space-900' : 'border-dashed border-space-600 bg-space-900/40',
        fits && 'border-accent/70 bg-accent/5',
        fits && isOver && 'border-accent bg-accent/15',
        dragged && !fits && 'opacity-40',
        problem && 'border-bad ring-2 ring-bad/40',
      )}
    >
      {part ? (
        <PlacedPart slotId={slot.id} part={part} variant={variant} onRemove={onRemove} />
      ) : (
        <span className={cn('flex items-center gap-2 text-xs text-muted', variant === 'wing' && 'flex-col')}>
          <Icon className="size-4" aria-hidden />
          {slot.label}
        </span>
      )}
    </div>
  )
}

function PlacedPart({ slotId, part, variant, onRemove }: { slotId: string; part: Part; variant: 'wing' | 'cell'; onRemove: (id: string) => void }) {
  const data: DragData = { partId: part.id, fromSlot: slotId }
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `slot:${slotId}`, data })

  return (
    <>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        aria-label={`${part.name}. Drag to move, or drag back to the tray to remove.`}
        title={part.tooltip}
        className={cn(
          'flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 active:cursor-grabbing',
          variant === 'wing' && 'flex-col text-center',
          isDragging && 'opacity-30',
        )}
      >
        <PartIcon part={part} className={variant === 'wing' ? 'size-10' : 'size-10 shrink-0'} />
        <span className="line-clamp-2 text-xs leading-tight font-medium">{part.name}</span>
      </div>
      <button
        onClick={() => onRemove(slotId)}
        className="absolute -top-2 -right-2 rounded-full border border-space-600 bg-space-800 p-0.5 text-muted after:absolute after:-inset-2 after:content-[''] hover:text-ink"
        aria-label={`Remove ${part.name}`}
      >
        <X className="size-3.5" />
      </button>
    </>
  )
}
