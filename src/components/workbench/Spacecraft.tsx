import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { X } from 'lucide-react'
import type { Bus, Part } from '@/engine/types'
import { isExternal } from '@/game/ui'
import { cn } from '@/lib/cn'
import { CRAFT_ID, type DragData } from './dnd'
import { PartIcon } from './PartIcon'

interface SpacecraftProps {
  bus?: Bus
  parts: Part[]
  /** Parts to outline in red (after a failed flight, F18). */
  problemIds?: string[]
  onRemove: (partId: string) => void
  onRemoveBus: () => void
}

/**
 * The craft as Member 1's engine sees it: a bus with a number of slots, internal parts
 * filling them (a part may take 1, 2 or more), and slot-free parts such as solar panels
 * mounted outside. The whole craft is one drop target.
 */
export function Spacecraft({ bus, parts, problemIds = [], onRemove, onRemoveBus }: SpacecraftProps) {
  const { setNodeRef, isOver } = useDroppable({ id: CRAFT_ID })
  const { active } = useDndContext()
  const dragging = active?.data.current as DragData | undefined
  const incoming = dragging && !dragging.fromCraft

  const inside = parts.filter((p) => !isExternal(p))
  const outside = parts.filter(isExternal)
  const used = inside.reduce((n, p) => n + p.slots, 0)
  const cols = !bus ? 3 : bus.slots <= 6 ? 3 : bus.slots <= 16 ? 4 : 8
  const free = Math.max(0, (bus?.slots ?? 0) - used)

  return (
    <div
      ref={setNodeRef}
      className={cn('flex flex-col items-center gap-3 rounded-xl py-3 transition-colors', incoming && 'outline-2 outline-dashed outline-accent/50', isOver && incoming && 'bg-accent/5 outline-accent')}
    >
      {!bus ? (
        <p className="max-w-xs py-10 text-center text-sm text-muted">
          Start with a bus. Drag it here from the <b className="text-ink">Bus</b> tab of the parts tray. Its size decides how many slots you get.
        </p>
      ) : (
        <>
          {/* Outside: solar panels and other slot-free parts */}
          {outside.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {outside.map((p, i) => (
                <PlacedPart key={`out-${p.id}-${i}`} uid={`out-${p.id}-${i}`} part={p} span={1} problem={problemIds.includes(p.id)} onRemove={onRemove} outside />
              ))}
            </div>
          )}

          {/* The bus and its slots */}
          <div className="w-full max-w-lg rounded-2xl border-2 border-space-600 bg-space-800/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <PartIcon item={bus} className="size-8 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{bus.name}</span>
              <span className={cn('shrink-0 text-xs tabular-nums', used > bus.slots ? 'text-bad' : 'text-muted')}>
                {used}/{bus.slots} slots
              </span>
              <button onClick={onRemoveBus} className="relative shrink-0 rounded p-1 text-muted after:absolute after:-inset-2 after:content-[''] hover:text-ink" aria-label={`Remove ${bus.name}`}>
                <X className="size-3.5" />
              </button>
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {inside.map((p, i) => (
                <PlacedPart key={`in-${p.id}-${i}`} uid={`in-${p.id}-${i}`} part={p} span={Math.min(p.slots, cols)} problem={problemIds.includes(p.id)} onRemove={onRemove} />
              ))}
              {Array.from({ length: free }, (_, i) => (
                <div key={`free-${i}`} className="flex min-h-14 items-center justify-center rounded-lg border border-dashed border-space-600 text-[11px] text-muted/70">
                  Free
                </div>
              ))}
            </div>
            {used > bus.slots && <p className="mt-2 text-xs text-bad">Too many parts: {used - bus.slots} slot(s) over. Remove something or use a bigger bus.</p>}
          </div>
        </>
      )}
    </div>
  )
}

function PlacedPart({ uid, part, span, problem, onRemove, outside }: { uid: string; part: Part; span: number; problem: boolean; onRemove: (id: string) => void; outside?: boolean }) {
  const data: DragData = { id: part.id, kind: 'part', fromCraft: true }
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `craft:${uid}`, data })
  return (
    <div
      className={cn(
        'relative flex min-h-14 items-center gap-2 rounded-lg border bg-space-900 p-1.5 pr-5',
        outside ? 'border-space-600' : 'border-space-700',
        problem && 'border-bad ring-2 ring-bad/40',
        isDragging && 'opacity-40',
      )}
      style={{ gridColumn: `span ${span} / span ${span}` }}
    >
      <div ref={setNodeRef} {...listeners} {...attributes} aria-label={`Drag ${part.name} off the craft`} className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 active:cursor-grabbing">
        <PartIcon item={part} className="size-9 shrink-0" />
        <span className="min-w-0 text-xs leading-tight">
          <span className="line-clamp-2">{part.name}</span>
          {part.slots > 1 && <span className="text-[10px] text-muted">{part.slots} slots</span>}
        </span>
      </div>
      <button
        onClick={() => onRemove(part.id)}
        className="absolute -top-2 -right-2 rounded-full border border-space-600 bg-space-800 p-0.5 text-muted after:absolute after:-inset-2 after:content-[''] hover:text-ink"
        aria-label={`Remove ${part.name}`}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
