import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, EyeOff, XCircle } from 'lucide-react'
import type { Gauge, ResourceId } from '@/engine/types'
import { gaugeTerm, n1, shortLabel } from '@/game/ui'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { Term } from '@/components/Term'

const R = 34
const C = 2 * Math.PI * R
const ARC = 0.75 * C // 270° dial, gap at the bottom

const colour = { ok: 'var(--color-ok)', warn: 'var(--color-warn)', fail: 'var(--color-bad)' } as const
const StatusIcon = { ok: CheckCircle2, warn: AlertTriangle, fail: XCircle } as const

/** Plain-English explanation of each gauge, shown as a tooltip (F21). */
const explain: Record<ResourceId, string> = {
  mass: 'How heavy the spacecraft is, compared with what the bus and the rocket can carry.',
  power: 'Power your parts use, compared with what the solar panels make on average over an orbit (sunlight and shadow).',
  budget: 'Parts, launch and operations for the whole mission, compared with your budget.',
  data: 'The biggest pile of data waiting between two ground passes, compared with your storage.',
  comms: 'Data your instruments make each day, compared with what your radio and ground stations can send home.',
  time: 'How long the build takes, compared with the months until launch.',
  deltaV: 'Speed change needed for the end-of-mission plan, compared with what your thruster can give.',
}

const fmt = n1

function marginText(g: Gauge): string {
  if (g.limit === 0 && g.used === 0) return 'Nothing yet'
  if (g.limit === 0) return 'None available'
  const m = g.limit - g.used
  if (m < 0) return `${fmt(-m)} ${g.unit} ${g.resource === 'power' ? 'short' : 'over'}`
  return `${fmt(m)} ${g.unit} spare (${Math.round(g.marginPct)}%)`
}

/** Dial gauge for one of the seven resources (task 2.4), fed by Member 1's evaluate(). */
export function ResourceGauge({ g, hiddenBy }: { g: Gauge; /** Team play: name of the role that watches this gauge, if it isn't you. */ hiddenBy?: string }) {
  if (hiddenBy) return <HiddenGauge g={g} who={hiddenBy} />
  const empty = g.limit === 0 && g.used === 0
  const fill = empty ? 0 : g.limit > 0 ? Math.min(1, g.used / g.limit) : 1
  const Icon = StatusIcon[g.status]
  const stroke = empty ? 'var(--color-space-600)' : colour[g.status]
  const label = (
    <>
      <span className="sm:hidden">{shortLabel[g.resource] ?? g.label}</span>
      <span className="hidden sm:inline">{g.label}</span>
    </>
  )

  return (
    <div
      data-tour={`gauge-${g.resource}`}
      title={explain[g.resource]}
      // Hover titles don't exist on touch screens, so a tap explains the gauge too.
      onClick={() => toast(`${g.label}: ${marginText(g)}`, { id: 'gauge-info', description: explain[g.resource] })}
      className={cn(
        'relative flex cursor-pointer flex-col items-center rounded-lg border bg-space-900 px-0.5 pt-1.5 pb-1.5 transition-shadow sm:rounded-xl sm:px-2 sm:pt-3 sm:pb-2.5',
        g.critical ? 'border-accent/70 shadow-[0_0_20px_-6px_var(--color-accent)]' : 'border-space-700',
      )}
    >
      {g.critical && (
        <span className="absolute top-1.5 right-1.5 hidden rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase sm:block">
          Critical
        </span>
      )}

      <svg viewBox="0 0 80 80" className="size-12 sm:size-20" role="meter" aria-label={g.label} aria-valuenow={g.used} aria-valuemin={0} aria-valuemax={g.limit} aria-valuetext={marginText(g)}>
        <g transform="rotate(135 40 40)">
          <circle cx="40" cy="40" r={R} fill="none" stroke="var(--color-space-700)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${ARC} ${C}`} />
          <motion.circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            stroke={stroke}
            style={{ transition: 'stroke 300ms' }}
            initial={false}
            animate={{ strokeDasharray: `${Math.max(0.001, ARC * fill)} ${C}` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          />
        </g>
        <text x="40" y="40" textAnchor="middle" className="fill-ink font-mono text-[14px] font-medium tabular-nums">
          {empty ? '–' : g.limit > 0 ? `${Math.round((g.used / g.limit) * 100)}%` : '!'}
        </text>
        <text x="40" y="54" textAnchor="middle" className="fill-muted text-[8px]">
          {fmt(g.used)}/{fmt(g.limit)}
        </text>
      </svg>

      <span className="mt-0.5 max-w-full truncate font-display text-[10px] font-semibold sm:text-sm">
        {gaugeTerm[g.resource] ? <Term id={gaugeTerm[g.resource]!} align={g.resource === 'deltaV' ? 'end' : 'center'}>{label}</Term> : label}
      </span>
      <motion.span
        key={g.status}
        initial={{ scale: 0.9, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          'mt-0.5 hidden items-center gap-1 text-center text-[11px] leading-tight sm:flex',
          empty ? 'text-muted' : g.status === 'ok' ? 'text-ok' : g.status === 'warn' ? 'text-warn' : 'text-bad',
        )}
      >
        {!empty && <Icon className="size-3 shrink-0" aria-hidden />}
        {marginText(g)}
      </motion.span>
    </div>
  )
}

/** A gauge another role watches: no numbers, just who to ask. */
function HiddenGauge({ g, who }: { g: Gauge; who: string }) {
  return (
    <div
      onClick={() => toast(`Only the ${who} can see ${g.label}`, { id: 'gauge-info', description: 'Ask them how it looks before you add or swap parts.' })}
      className="relative flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-space-700 bg-space-900/50 px-0.5 pt-1.5 pb-1.5 text-center sm:rounded-xl sm:px-2 sm:pt-3 sm:pb-2.5"
      aria-label={`${g.label}: hidden. The ${who} watches this.`}
    >
      <span className="flex size-12 items-center justify-center rounded-full border-[6px] border-space-800 sm:size-20 sm:border-[7px]">
        <EyeOff className="size-4 text-muted sm:size-6" aria-hidden />
      </span>
      <span className="mt-0.5 max-w-full truncate font-display text-[10px] font-semibold text-muted sm:text-sm">{shortLabel[g.resource] ?? g.label}</span>
      <span className="mt-0.5 hidden text-[11px] leading-tight text-muted sm:block">Ask the {who}</span>
    </div>
  )
}
