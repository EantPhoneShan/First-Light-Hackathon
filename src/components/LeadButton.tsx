import { ArrowRight, Hourglass, type LucideIcon } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { stepInfo, type FlowFacts, type Step } from '@/engine/flow'
import { roleNames } from '@/game/ui'
import { useTeamFlow } from '@/game/teamFlow'
import { cn } from '@/lib/cn'
import { useGame } from '@/store/game'

interface LeadButtonProps {
  children: ReactNode
  /** Facts the step needs (approvals, flight, launch done…). Design and player count are added for you. */
  facts?: Omit<FlowFacts, 'design' | 'players'>
  /** Where to go. Default: the step canAdvance() says comes next. */
  to?: Step
  /** Runs just before the room moves (e.g. remember the re-fly fixes). */
  onGo?: () => void
  icon?: LucideIcon | null
  /** Extra classes for the button (colour). */
  className?: string
  /** Skip canAdvance(): for going back (Re-fly, Fix the design). */
  ignoreCheck?: boolean
  /** A reason of the screen's own to keep the button disabled (on top of canAdvance). */
  blocked?: string
  /** Show nothing to non-leaders (when another button on the screen already says who we wait for). */
  quietWhenWaiting?: boolean
}

/**
 * The step's Next / Launch / Re-fly button (team flow). Only the step's leader
 * (canLead) sees it; everyone else sees who they are waiting for. When the team
 * can't move on yet, it is disabled with canAdvance().reason as its tooltip.
 */
export function LeadButton({ children, facts = {}, to, onGo, icon: Icon = ArrowRight, className, ignoreCheck, blocked: ownReason, quietWhenWaiting }: LeadButtonProps) {
  const flow = useTeamFlow()
  const leader = stepInfo(flow.step).leader
  const leaderName = useGame((s) => s.players.find((p) => p.role === leader)?.name)
  const reasonId = useId()

  if (!flow.lead) return quietWhenWaiting ? null : <WaitingFor role={roleNames[leader]} name={flow.leaderName ?? leaderName} />

  const check = flow.check(facts)
  const target = to ?? check.to
  const reason = ownReason ?? (!ignoreCheck && !check.ok ? check.reason : undefined)
  const blocked = reason !== undefined

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        onClick={() => {
          if (blocked || !target) return
          onGo?.()
          flow.goTo(target)
        }}
        disabled={blocked || !target}
        title={reason}
        aria-describedby={reason ? reasonId : undefined}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-space-950 transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40',
          className,
        )}
      >
        {children}
        {Icon && <Icon className="size-4" aria-hidden />}
      </button>
      {reason && (
        <span id={reasonId} className="max-w-xs text-right text-xs text-muted">
          {reason}
        </span>
      )}
    </span>
  )
}

export function WaitingFor({ role, name, doing = '' }: { role: string; name?: string; doing?: string }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-lg border border-space-700 bg-space-900 px-4 py-2.5 text-sm text-muted" role="status">
      <Hourglass className="size-4 animate-pulse text-accent" aria-hidden />
      {doing ? `The ${role}${name ? ` (${name})` : ''} is ${doing}…` : `Waiting for the ${role}${name ? ` (${name})` : ''}…`}
    </p>
  )
}

/**
 * Greys out a block the player can't edit in this step. Uses a disabled
 * fieldset, so every button, slider and input inside stops working at once.
 */
export function EditGate({ can, who, children, className }: { can: boolean; who: string; children: ReactNode; className?: string }) {
  return (
    <fieldset disabled={!can} className={cn('min-w-0', !can && 'opacity-60', className)} title={can ? undefined : `Only the ${who} can change this now.`}>
      {!can && <legend className="sr-only">Only the {who} can change this now.</legend>}
      {children}
    </fieldset>
  )
}
