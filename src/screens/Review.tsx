import { AlertTriangle, CheckCircle2, Hand, Rocket, ThumbsUp, Wrench, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Screen } from '@/components/Screen'
import { reviewChecks, roleNames, type Check } from '@/engine/mockReview'
import type { Role, Status } from '@/engine/placeholderTypes'
import { cn } from '@/lib/cn'
import { useGame, useScenario } from '@/store/game'
import { Term } from '@/components/Term'
import { play } from '@/lib/sound'

const roles = Object.keys(roleNames) as Role[]

/** Checks whose name is a space term with a glossary entry. */
const checkTerm: Record<string, string> = { bus: 'bus', battery: 'eclipse', comms: 'downlink', deltaV: 'deorbit', instrument: 'payload' }

const statusStyle: Record<Status, { icon: typeof CheckCircle2; text: string; box: string; word: string }> = {
  ok: { icon: CheckCircle2, text: 'text-ok', box: 'border-space-700 bg-space-900', word: 'Go' },
  warn: { icon: AlertTriangle, text: 'text-warn', box: 'border-warn/40 bg-warn/5', word: 'Watch' },
  bad: { icon: XCircle, text: 'text-bad', box: 'border-bad/50 bg-bad/10', word: 'Problem' },
}

/** PRD F12: every check with its reason, sign-off per role. Launch is allowed with warnings. */
export function Review() {
  const scenario = useScenario()
  const design = useGame((s) => s.design)
  const navigate = useNavigate()
  const reqs = useGame((s) => s.requirements)
  const checks = reviewChecks(design, scenario, reqs)
  const approvals = useGame((s) => s.approvals)

  const count = (st: Status) => checks.filter((c) => c.status === st).length
  const blockers = checks.filter((c) => c.blocker)
  const holds = roles.filter((r) => approvals[r]?.state === 'hold' && approvals[r]?.version === design.version)
  const canLaunch = blockers.length === 0 && holds.length === 0
  const problems = count('bad')

  // Problems first, then warnings, then the green ones.
  const order = { bad: 0, warn: 1, ok: 2 }
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status])

  return (
    <Screen title="Design review" subtitle="Every check, with the reason. Each role signs off before launch." reqs="F12" hideNext>
      <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Checklist summary">
        {(['ok', 'warn', 'bad'] as const).map((st) => {
          const { icon: Icon, text, word } = statusStyle[st]
          return (
            <div key={st} className="flex flex-col items-center gap-1 rounded-xl border border-space-700 bg-space-900 p-3 sm:flex-row sm:justify-center sm:gap-3">
              <Icon className={cn('size-6', text)} aria-hidden />
              <span className="font-display text-2xl tabular-nums">{count(st)}</span>
              <span className="text-xs text-muted sm:text-sm">{word}</span>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ul className="flex flex-col gap-2" aria-label="Pre-flight checklist">
          {sorted.map((c) => (
            <CheckRow key={c.id} c={c} />
          ))}
        </ul>

        <div className="flex flex-col gap-3 lg:sticky lg:top-[120px] lg:self-start">
          <h2 className="font-semibold">Sign-off</h2>
          {roles.map((r) => (
            <RoleCard key={r} role={r} checks={checks.filter((c) => c.owner === r)} />
          ))}
          <p className="text-xs text-muted">Playing alone? Sign off for each role yourself, or just launch. A Hold stops the launch until it's lifted.</p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        {!canLaunch && (
          <p className="text-sm text-bad" role="status">
            {blockers.length > 0
              ? `Can't launch yet: ${blockers.map((b) => b.label.toLowerCase()).join(', ')}.`
              : `On hold by ${holds.map((r) => roleNames[r]).join(', ')}.`}
          </p>
        )}
        {canLaunch && problems > 0 && (
          <p className="max-w-md text-right text-sm text-muted">You can launch with problems. The flight will show what they cause, and the report will explain.</p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Link to="/workbench" className="inline-flex items-center gap-2 rounded-lg border border-space-600 px-5 py-2.5 hover:bg-space-800">
            <Wrench className="size-4" aria-hidden />
            Back to the workbench
          </Link>
          <button
            onClick={() => navigate('/launch')}
            disabled={!canLaunch}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              problems > 0 ? 'bg-warn text-space-950 hover:bg-warn/80' : 'bg-accent text-space-950 hover:bg-accent-strong',
            )}
          >
            <Rocket className="size-4" aria-hidden />
            {problems > 0 ? `Launch with ${problems} problem${problems > 1 ? 's' : ''}` : 'Launch'}
          </button>
        </div>
      </div>
    </Screen>
  )
}

function CheckRow({ c }: { c: Check }) {
  const { icon: Icon, text, box, word } = statusStyle[c.status]
  return (
    <li className={cn('flex items-start gap-3 rounded-xl border p-3', box)}>
      <Icon className={cn('mt-0.5 size-5 shrink-0', text)} aria-label={word} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="font-medium">{checkTerm[c.id] ? <Term id={checkTerm[c.id]}>{c.label}</Term> : c.label}</span>
          <span className="text-xs text-muted">{roleNames[c.owner]}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted">{c.why}</p>
        {c.fix && (
          <p className="mt-1 flex items-start gap-1.5 text-sm">
            <Wrench className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
            {c.fix}
          </p>
        )}
      </div>
    </li>
  )
}

function RoleCard({ role, checks }: { role: Role; checks: Check[] }) {
  const version = useGame((s) => s.design.version)
  const approval = useGame((s) => s.approvals[role])
  const setApproval = useGame((s) => s.setApproval)
  const player = useGame((s) => s.room.players.find((p) => p.role === role)?.name)
  const [holding, setHolding] = useState(false)
  const [note, setNote] = useState('')

  const current = approval && approval.version === version ? approval : undefined
  const stale = approval && !current
  const bad = checks.filter((c) => c.status === 'bad').length
  const warn = checks.filter((c) => c.status === 'warn').length

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        current?.state === 'approved' ? 'border-ok/50 bg-ok/10' : current?.state === 'hold' ? 'border-bad/50 bg-bad/10' : 'border-space-700 bg-space-900',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block font-medium">{roleNames[role]}</span>
          {player && <span className="block truncate text-xs text-muted">{player}</span>}
        </span>
        <span className="text-xs text-muted">
          {bad > 0 ? <span className="text-bad">{bad} problem{bad > 1 && 's'}</span> : warn > 0 ? <span className="text-warn">{warn} to watch</span> : 'All clear'}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted" aria-live="polite">
        {current?.state === 'approved'
          ? 'Approved.'
          : current?.state === 'hold'
            ? `On hold${current.note ? `: "${current.note}"` : '.'}`
            : stale
              ? 'The design changed since this role signed off. Check again.'
              : 'Waiting for sign-off.'}
      </p>

      {holding ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setApproval(role, 'hold', note.trim() || undefined)
            play('hold')
            setHolding(false)
            setNote('')
          }}
        >
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why? (optional)"
            aria-label={`Reason for ${roleNames[role]} hold`}
            className="min-w-0 flex-1 rounded-lg border border-space-600 bg-space-950 px-2 py-1.5 text-sm placeholder:text-muted/60"
          />
          <button type="submit" className="rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-space-950">
            Hold
          </button>
        </form>
      ) : (
        <div className="mt-2 flex gap-2">
          {current ? (
            <button onClick={() => setApproval(role, null)} className="flex-1 rounded-lg border border-space-600 px-3 py-1.5 text-sm hover:bg-space-800">
              {current.state === 'hold' ? 'Lift hold' : 'Undo'}
            </button>
          ) : (
            <>
              <button onClick={() => (setApproval(role, 'approved'), play('approve'))} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ok/20 px-3 py-1.5 text-sm font-medium text-ok hover:bg-ok/30">
                <ThumbsUp className="size-4" aria-hidden />
                Approve
              </button>
              <button onClick={() => setHolding(true)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-bad/15 px-3 py-1.5 text-sm font-medium text-bad hover:bg-bad/25">
                <Hand className="size-4" aria-hidden />
                Hold
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
