import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { termById } from '@/content/glossary'
import { cn } from '@/lib/cn'

/**
 * A space term with a dotted underline. Hover, focus or tap shows a short explanation
 * and a Learn more link to the glossary page (F21).
 */
export function Term({ id, children, align = 'center' }: { id: string; children?: ReactNode; align?: 'center' | 'end' }) {
  const t = termById(id)
  const [open, setOpen] = useState(false)
  const [above, setAbove] = useState(false)
  const tipId = useId()
  const ref = useRef<HTMLSpanElement>(null)
  const closeTimer = useRef<number>(undefined)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  if (!t) return <>{children}</>

  const show = () => {
    window.clearTimeout(closeTimer.current)
    // Open upward when there isn't room below (e.g. inside the tutorial card at the bottom).
    const r = ref.current?.getBoundingClientRect()
    setAbove(!!r && r.bottom + 180 > window.innerHeight)
    setOpen(true)
  }
  const hide = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 150)
  }

  return (
    <span ref={ref} className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          if (open) setOpen(false)
          else show()
        }}
        onFocus={show}
        onBlur={hide}
        className="cursor-help underline decoration-muted decoration-dotted underline-offset-4 hover:decoration-accent"
      >
        {children ?? t.term}
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          onMouseEnter={show}
          onFocus={show}
          onBlur={hide}
          className={cn('absolute z-50 block w-64 max-w-[80vw] rounded-lg border border-space-600 bg-space-800 p-3 text-left text-sm font-normal text-ink normal-case shadow-xl', align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2', above ? 'bottom-full mb-2' : 'top-full mt-2')}
        >
          <span className="block font-medium">{t.term}</span>
          <span className="mt-1 block text-muted">{t.short}</span>
          <Link to={`/learn#${t.id}`} className="mt-2 inline-block text-xs text-accent underline" onClick={() => setOpen(false)}>
            Learn more
          </Link>
        </span>
      )}
    </span>
  )
}
