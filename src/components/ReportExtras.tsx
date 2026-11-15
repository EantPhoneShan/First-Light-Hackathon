import { ExternalLink, Loader2, Medal, Satellite, Send, Shuffle, Star, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { findScenario } from '@/engine/data'
import { closestMission, otherWinningBuilds, type OtherBuild } from '@/engine/match'
import { makeSubmission } from '@/engine/verify'
import { gameData } from '@/game/ui'
import { cn } from '@/lib/cn'
import type { FlightResult } from '@/sim/types'
import { useTeamFlow } from '@/game/teamFlow'
import { useGame } from '@/store/game'
import { sync } from '@/sync'
import { ScoreRejectedError, submitFlight, topScores, type ScoreEntry, type SubmittedScore } from '@/sync/leaderboard'

/** "Your design is most like…": the closest real mission, with reasons and a NASA link (Member 1's match.ts, F17). */
export function RealMissionCard({ flight }: { flight: FlightResult }) {
  const match = useMemo(() => closestMission(flight.design, gameData), [flight.design])
  if (!match) return null
  const m = match.mission
  return (
    <section aria-labelledby="real-h" className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 id="real-h" className="flex items-center gap-2 font-semibold">
        <Satellite className="size-4 text-accent" aria-hidden />
        Your design is most like {m.name}
      </h2>
      <p className="mt-0.5 text-xs text-muted">{m.agency}</p>
      <p className="mt-2 text-sm">{m.summary}</p>
      <ul className="mt-2 flex flex-col gap-0.5 text-sm text-muted">
        {match.reasons.map((r) => (
          <li key={r}>✓ {r}</li>
        ))}
      </ul>
      <a href={m.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
        Read about {m.name} on NASA's site
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </section>
  )
}

/**
 * Other builds that also win (otherWinningBuilds, ~1 s). Runs once per report,
 * after the page has painted, so the report never waits for it.
 */
export function OtherBuilds({ flight }: { flight: FlightResult }) {
  const loadDesign = useGame((s) => s.loadDesign)
  // "Try it" replaces every role's part, so only when this device plays all four roles.
  const canTry = useTeamFlow().canRewriteDesign
  const [builds, setBuilds] = useState<OtherBuild[] | null>(null)
  useEffect(() => {
    setBuilds(null)
    const sc = findScenario(gameData, flight.scenarioId)
    if (!sc) return setBuilds([])
    const id = setTimeout(() => setBuilds(otherWinningBuilds(flight.design, sc, gameData)), 50)
    return () => clearTimeout(id)
  }, [flight])

  return (
    <section aria-labelledby="other-h" className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 id="other-h" className="flex items-center gap-2 font-semibold">
        <Shuffle className="size-4 text-accent" aria-hidden />
        Other builds that also win
      </h2>
      <p className="mt-0.5 text-sm text-muted">There is rarely one perfect design. Each of these changes one choice from yours and still succeeds.</p>
      {builds === null ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Flying a few variations…
        </p>
      ) : builds.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No single change made a winning build this time. Try the fixes above first.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {builds.map((b) => (
            <li key={b.change} className="flex flex-wrap items-center gap-3 rounded-lg border border-space-700 bg-space-950/50 p-2.5 text-sm">
              <span className="min-w-0 flex-1 first-letter:uppercase">{b.change}</span>
              <span className="flex items-center gap-0.5 text-warn" aria-label={`${b.stars} stars`}>
                {Array.from({ length: 3 }, (_, i) => (
                  <Star key={i} className={cn('size-3.5', i < b.stars ? 'fill-current' : 'opacity-30')} aria-hidden />
                ))}
              </span>
              <span className="font-display tabular-nums">{b.score}</span>
              <button
                onClick={() => loadDesign(b.design)}
                disabled={!canTry}
                title={canTry ? 'Load this build onto the workbench' : 'In a team, each role changes its own part to try this.'}
                className="rounded-md border border-space-600 px-3 py-1.5 text-xs hover:bg-space-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Try it
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Leaderboard (Member 3's leaderboard.ts). Sends what was built and chosen,
 * never a score: the server replays the flight and keeps the score it computes.
 */
export function Leaderboard({ flight }: { flight: FlightResult }) {
  const players = useGame((s) => s.players)
  const room = sync.getRoom()
  const defaultName = players.length ? players.map((p) => p.name).join(' & ').slice(0, 24) : ''
  const [team, setTeam] = useState(defaultName)
  const [saved, setSaved] = useState<SubmittedScore | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [top, setTop] = useState<ScoreEntry[] | null>(null)
  const scenario = findScenario(gameData, flight.scenarioId)

  const refresh = () => topScores(flight.scenarioId).then(setTop).catch(() => setTop([]))
  useEffect(() => {
    setSaved(null)
    setError(null)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const sub = makeSubmission(flight.scenarioId, flight.design, flight.sim, { allApproved: flight.allApproved, tradeStudyUsed: flight.tradeStudyUsed })
      setSaved(await submitFlight(sub, { teamName: team.trim() || 'Anonymous', roomCode: room && room.code !== 'SOLO' ? room.code : undefined }))
      await refresh()
    } catch (e) {
      setError(e instanceof ScoreRejectedError ? e.reasons.join(' ') : 'Could not save the score. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="lb-h" className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 id="lb-h" className="flex items-center gap-2 font-semibold">
        <Trophy className="size-4 text-warn" aria-hidden />
        Leaderboard{scenario ? ` · ${scenario.name}` : ''}
      </h2>
      {!saved ? (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <input
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            maxLength={24}
            placeholder="Team name"
            aria-label="Team name"
            className="min-w-0 flex-1 rounded-lg border border-space-600 bg-space-950 px-3 py-1.5 text-sm placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
          <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-space-950 hover:bg-accent-strong disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            Add this flight
          </button>
        </form>
      ) : (
        <p className="mt-2 text-sm text-ok">
          Saved: {saved.score} points{saved.online ? ', checked by the score server.' : ', kept on this device (offline).'}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-bad" role="alert">
          {error}
        </p>
      )}
      <ol className="mt-3 flex flex-col gap-1 text-sm">
        {top === null ? (
          <li className="text-muted">Loading…</li>
        ) : top.length === 0 ? (
          <li className="text-muted">No scores yet. Be the first.</li>
        ) : (
          top.map((e, i) => (
            <li key={`${e.teamName}-${e.createdAt}-${i}`} className={cn('flex items-center gap-2 rounded-md px-2 py-1', saved && e.teamName === saved.teamName && e.score === saved.score && 'bg-accent/10')}>
              <span className="w-5 text-right text-muted tabular-nums">{i + 1}</span>
              {i < 3 && <Medal className={cn('size-3.5', ['text-warn', 'text-muted', 'text-accent'][i])} aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{e.teamName}</span>
              <span className="text-xs text-muted capitalize">{e.outcome}</span>
              <span className="w-12 text-right font-display tabular-nums">{e.score}</span>
            </li>
          ))
        )}
      </ol>
    </section>
  )
}
