import { CheckCircle2, ClipboardList, XCircle } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Screen } from '@/components/Screen'
import { Term } from '@/components/Term'
import { revisitAt, scenarios } from '@/engine/mock'
import { cn } from '@/lib/cn'
import { useGame, useScenario } from '@/store/game'

const H_MIN = 300
const H_MAX = 1000
const SSO = { min: 450, max: 900 }

/** Lowest altitude whose revisit time meets the target (revisit improves as you go higher). */
function minAltForRevisit(days: number) {
  for (let h = H_MIN; h <= H_MAX; h += 5) if (revisitAt(h) <= days) return h
  return null
}

/** CML 2 Feasibility (F4, F5): set the requirements and see which orbits can meet them. */
export function Feasibility() {
  const scenario = useScenario()
  const req = useGame((s) => s.requirements)
  const setReq = useGame((s) => s.setRequirements)
  const planner = useGame((s) => s.room.players.find((p) => p.role === 'planner')?.name)
  const baseYears = scenarios.find((s) => s.id === scenario.id)!.lifetimeYears

  const hDetail = Math.min(H_MAX, req.detailM / 0.01) // highest altitude that is still sharp enough
  const hRevisit = minAltForRevisit(req.revisitDays) // lowest altitude that covers ground fast enough
  const lo = hRevisit ?? Infinity
  const hi = hDetail
  const feasible = lo <= hi
  const inSso = feasible && Math.max(lo, SSO.min) <= Math.min(hi, SSO.max)

  return (
    <Screen title="Requirements" subtitle="CML 2 · Feasibility: decide what matters most, then check it's possible." reqs="F4, F5" nextLabel="Start designing">
      <p className="inline-flex w-fit items-center gap-2 rounded-full border border-space-700 bg-space-900 px-3 py-1 text-sm text-muted">
        <ClipboardList className="size-4 text-accent" aria-hidden />
        {planner ? `${planner} (Mission Planner) leads this step` : 'The Mission Planner leads this step'}
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 rounded-xl border border-space-700 bg-space-900 p-4">
          <Slider
            label="Coverage: how often to look at each place"
            value={req.revisitDays}
            min={1}
            max={10}
            step={0.5}
            onChange={(v) => setReq({ revisitDays: v })}
            display={`every ${req.revisitDays} day${req.revisitDays === 1 ? '' : 's'}`}
            note={
              req.revisitDays <= 2
                ? 'Very frequent. One satellite needs a wide view (a high orbit), or you need two satellites.'
                : req.revisitDays <= 5
                  ? 'A fire can grow a lot in a few days, but one satellite can manage this.'
                  : 'Easy to reach, but the firefighters may see a fire too late.'
            }
          />
          <Slider
            label="Image detail: size of one pixel on the ground"
            value={req.detailM}
            min={2}
            max={30}
            step={1}
            onChange={(v) => setReq({ detailM: v })}
            display={`${req.detailM} m`}
            note={
              req.detailM <= 5
                ? 'Sharp enough to see single buildings, but the camera must fly low and sees a narrow strip.'
                : req.detailM <= 15
                  ? 'Good for spotting fire fronts and burn scars.'
                  : 'Blurry: fine for big fires, but small new ones may be missed.'
            }
          />
          <Slider
            label="Mission lifetime"
            value={req.lifetimeYears}
            min={baseYears}
            max={baseYears + 4}
            step={1}
            onChange={(v) => setReq({ lifetimeYears: v })}
            display={`${req.lifetimeYears} years`}
            note={
              req.lifetimeYears === baseYears
                ? `The ${scenario.customer.toLowerCase()} need at least ${baseYears} years.`
                : `Each extra year adds ground-station fees, and a low orbit needs more fuel to stay up against air drag.`
            }
          />
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-space-700 bg-space-900 p-4">
          <h2 className="font-semibold">Which altitudes work?</h2>
          <TradeChart lo={hRevisit} hi={hDetail} />
          <div
            role="status"
            className={cn('flex items-start gap-2 rounded-lg p-3 text-sm', feasible ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad')}
          >
            {feasible ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span className="text-ink">
              {feasible ? (
                <>
                  Feasible. Fly between <b>{Math.round(lo)}</b> and <b>{Math.round(hi)} km</b>.{' '}
                  {inSso ? (
                    <>
                      That includes <Term id="sso">sun-synchronous orbits</Term>, a good fit for this mission.
                    </>
                  ) : (
                    'That is outside the usual sun-synchronous range, so check the orbit choices carefully.'
                  )}
                </>
              ) : (
                <>
                  Not possible with one satellite.{' '}
                  {hRevisit === null
                    ? `Even at ${H_MAX} km, one satellite can't come back every ${req.revisitDays} days.`
                    : `${req.detailM} m pixels need an orbit below ${Math.round(hDetail)} km, but coming back every ${req.revisitDays} days needs at least ${hRevisit} km.`}{' '}
                  Relax the coverage or the detail, or plan for two satellites (coming in a later version).
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-muted">
            Higher orbits see a wider strip, so they come back sooner, but each pixel covers more ground. That's the trade-off every Earth-watching mission makes.
          </p>
        </div>
      </div>
    </Screen>
  )
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display: string; note: ReactNode }) {
  const id = useId()
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {props.label}
        </label>
        <span className="shrink-0 font-display text-accent tabular-nums">{props.display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        aria-valuetext={props.display}
        className="mt-1 h-8 w-full cursor-pointer accent-accent"
      />
      <p className="mt-1 text-xs text-muted">{props.note}</p>
    </div>
  )
}

/** Altitude axis with the band that meets detail (left), the band that meets coverage (right) and their overlap. */
function TradeChart({ lo, hi }: { lo: number | null; hi: number }) {
  const W = 320
  const x = (h: number) => ((Math.min(H_MAX, Math.max(H_MIN, h)) - H_MIN) / (H_MAX - H_MIN)) * W
  const loX = lo === null ? W : x(lo)
  const hiX = x(hi)
  return (
    <svg viewBox={`-8 0 ${W + 16} 110`} className="w-full" role="img" aria-label={`Detail met below ${Math.round(hi)} km; coverage met above ${lo === null ? 'no altitude' : `${Math.round(lo)} km`}`}>
      {/* Detail band */}
      <text x={0} y={12} className="fill-muted text-[9px]">
        Sharp enough
      </text>
      <rect x={0} y={16} width={W} height={12} rx={3} className="fill-space-800" />
      <rect x={0} y={16} width={hiX} height={12} rx={3} className="fill-accent/60" />
      {/* Coverage band */}
      <text x={0} y={44} className="fill-muted text-[9px]">
        Covers ground often enough
      </text>
      <rect x={0} y={48} width={W} height={12} rx={3} className="fill-space-800" />
      {lo !== null && <rect x={loX} y={48} width={W - loX} height={12} rx={3} className="fill-accent/60" />}
      {/* Overlap */}
      {loX < hiX && <rect x={loX} y={14} width={hiX - loX} height={48} rx={4} className="fill-ok/20 stroke-ok" strokeWidth={1.5} />}
      {/* SSO bracket */}
      <line x1={x(SSO.min)} x2={x(SSO.max)} y1={72} y2={72} className="stroke-muted" />
      <line x1={x(SSO.min)} x2={x(SSO.min)} y1={68} y2={76} className="stroke-muted" />
      <line x1={x(SSO.max)} x2={x(SSO.max)} y1={68} y2={76} className="stroke-muted" />
      <text x={(x(SSO.min) + x(SSO.max)) / 2} y={84} textAnchor="middle" className="fill-muted text-[9px]">
        Sun-synchronous range
      </text>
      {/* Axis */}
      {[300, 500, 700, 900].map((h) => (
        <text key={h} x={x(h)} y={104} textAnchor={h === H_MIN ? 'start' : 'middle'} className="fill-muted text-[9px]">
          {h} km
        </text>
      ))}
    </svg>
  )
}
