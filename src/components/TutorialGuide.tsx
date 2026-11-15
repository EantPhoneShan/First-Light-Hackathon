import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronDown, Compass, MousePointerClick, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Term } from '@/components/Term'
import { cn } from '@/lib/cn'
import { useEvaluation, useGame } from '@/store/game'

interface Step {
  id: string
  n: number
  title: string
  body: ReactNode
  /** The one thing to do now, in a few words. Shown on its own line so it can't be missed. */
  task?: ReactNode
  action?: { label: string; to: string }
}

const TOTAL = 6
/** The six stops of the tutorial, shown as a track along the top of the card. */
const STOPS = ['Meet', 'Launch', 'Fly', 'Why', 'Fix', 'Re-fly']

/**
 * What to point at on each step. The guide finds these on the page and makes them glow,
 * so the player sees where to look instead of hunting for it.
 */
interface Spot {
  css: string
  /** Only the element whose text contains this. */
  text?: string
  /** Light up a parent instead (e.g. the whole bar, not just the meter). */
  up?: number
}
const SPOTS: Record<string, Spot[]> = {
  meet: [{ css: '[data-tour="gauge-power"]' }],
  launch: [{ css: 'button', text: 'Go to orbit' }],
  launch2: [{ css: 'button', text: 'Go to orbit' }],
  fly: [{ css: '[role="meter"][aria-label="Battery"]', up: 1 }],
  fly2: [{ css: '[role="radiogroup"][aria-label="Speed"]' }],
  report: [
    { css: 'h2', text: 'Why it happened', up: 1 },
    { css: 'button', text: 'Modify and re-fly' },
  ],
  fix: [{ css: '[role="tab"]', text: 'Battery' }],
  ready: [{ css: '[data-tour="gauge-power"]' }],
}

function findSpot(sp: Spot): Element | null {
  const all = Array.from(document.querySelectorAll(sp.css))
  let el: Element | null | undefined = sp.text ? all.find((e) => e.textContent?.trim() === sp.text || e.textContent?.includes(sp.text!)) : all[0]
  for (let i = 0; el && i < (sp.up ?? 0); i++) el = el.parentElement
  return el ?? null
}

/** Make the step's targets glow (and bring the first into view). Keeps looking, since some appear later. */
function useSpotlight(stepId: string | undefined) {
  useEffect(() => {
    const spots = stepId ? SPOTS[stepId] : undefined
    if (!spots) return
    let lit: Element[] = []
    let scrolled = false
    const tick = () => {
      const found = spots.map(findSpot).filter((e): e is Element => !!e)
      for (const el of lit) if (!found.includes(el)) el.classList.remove('tut-spot')
      for (const el of found) el.classList.add('tut-spot')
      lit = found
      if (!scrolled && found[0]) {
        scrolled = true
        found[0].scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => {
      window.clearInterval(id)
      for (const el of lit) el.classList.remove('tut-spot')
    }
  }, [stepId])
}

/**
 * F1 tutorial guide. A floating card that works out the current step from where the player is
 * and what has happened (flights, design), so it never gets out of step with the game.
 */
export function TutorialGuide() {
  const tutorial = useGame((s) => s.tutorial)
  const design = useGame((s) => s.design)
  const flights = useGame((s) => s.flights)
  const refly = useGame((s) => s.refly)
  const setRefly = useGame((s) => s.setRefly)
  const endTutorial = useGame((s) => s.endTutorial)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const last = flights[flights.length - 1]
  // Fixed = Member 1's engine no longer finds the battery problem.
  const ev = useEvaluation()
  const fixed = !!design.engineer.busId && !ev.problems.some((p) => p.id === 'power.battery')
  // Member 1's SimResult: died = battery ran out (or burned up); won = flew the whole mission.
  const died = !!last && (last.sim.summary.diedAtMin !== null || last.sim.summary.reenteredAtMin !== null)
  const won = !!last && !died && last.sim.survivedMin >= last.sim.missionMin
  const step = tutorial ? pickStep(pathname, !!last, died, fixed, won) : null

  // On the fix step, outline the battery slot even if the player skipped the report.
  useEffect(() => {
    if (step?.id === 'fix' && !refly) setRefly({ partIds: ['battery-small'], tabs: [], fixes: [] })
  }, [step?.id, refly, setRefly])

  // Open the card again whenever the step changes.
  useEffect(() => setCollapsed(false), [step?.id])
  useSpotlight(pathname === '/learn' ? undefined : step?.id)
  // Leave room under the page so the card never sits on top of the button it points at.
  const open = !!step && !collapsed && pathname !== '/learn'
  useEffect(() => {
    document.body.classList.toggle('tutorial-open', open)
    return () => document.body.classList.remove('tutorial-open')
  }, [open])

  if (!step || pathname === '/learn') return null

  const finish = () => {
    endTutorial()
    navigate('/briefing')
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end p-3 sm:p-4">
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.button
            key="pill"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => setCollapsed(false)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-accent bg-space-900 px-4 py-2 text-sm font-medium shadow-xl"
          >
            <Compass className="size-4 text-accent" aria-hidden />
            Mission guide · step {step.n} of {TOTAL}
          </motion.button>
        ) : (
          <motion.aside
            key={step.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            aria-label="Mission guide"
            aria-live="polite"
            className="pointer-events-auto w-full max-w-sm rounded-xl border border-accent/60 bg-space-900/95 p-4 shadow-2xl backdrop-blur"
          >
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-accent" aria-hidden />
              <span className="text-xs font-medium tracking-wider text-accent uppercase">
                Mission guide · {step.n <= TOTAL ? `step ${step.n} of ${TOTAL}` : 'done'}
              </span>
              <button onClick={() => setCollapsed(true)} className="ml-auto rounded p-1 text-muted hover:bg-space-800 hover:text-ink" aria-label="Minimise guide">
                <ChevronDown className="size-4" />
              </button>
              <button onClick={finish} className="rounded p-1 text-muted hover:bg-space-800 hover:text-ink" aria-label="Exit tutorial">
                <X className="size-4" />
              </button>
            </div>
            <ol className="mt-3 grid grid-cols-6 gap-1" aria-label="Tutorial progress">
              {STOPS.map((label, i) => {
                const n = i + 1
                const state = n < step.n ? 'done' : n === step.n ? 'now' : 'next'
                return (
                  <li key={label} className="flex flex-col gap-1" aria-current={state === 'now' ? 'step' : undefined}>
                    <span className={cn('h-1 rounded-full transition-colors duration-500', state === 'next' ? 'bg-space-700' : state === 'now' ? 'bg-accent' : 'bg-accent/50')} />
                    <span className={cn('text-center font-mono text-[10px]', state === 'now' ? 'text-ink' : 'text-muted')}>{label}</span>
                  </li>
                )
              })}
            </ol>
            <h2 className="mt-3 font-display text-lg font-semibold">{step.title}</h2>
            <div className="mt-1 text-sm text-muted [&_button]:text-ink">{step.body}</div>
            {step.task && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-ink">
                <MousePointerClick className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{step.task}</span>
              </p>
            )}
            {(step.action || step.id === 'done') && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => (step.id === 'done' ? finish() : navigate(step.action!.to))}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-space-950 hover:bg-accent-strong"
                >
                  {step.id === 'done' ? 'Start the campaign' : step.action!.label}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}

function pickStep(path: string, flown: boolean, dead: boolean, fixed: boolean, won: boolean): Step {
  if (won && fixed) {
    return {
      id: 'done',
      n: TOTAL + 1,
      title: 'First light!',
      body: (
        <>
          The firefighters are getting their images. You just did what mission designers do: fly, fail, find out why, fix it and fly again. The campaign gives you a
          blank workbench and a budget.
        </>
      ),
    }
  }

  switch (path) {
    case '/workbench':
      if (!flown || (!dead && !fixed))
        return {
          id: 'meet',
          n: 1,
          title: 'Meet your CubeSat',
          body: (
            <>
              This <Term id="cubesat">CubeSat</Term> is built to spot wildfires from <Term id="sso">sun-synchronous orbit</Term>. The Power gauge at the top is red on purpose: this craft has a design mistake built in. Launch it anyway and watch what the mistake does in flight.
            </>
          ),
          task: <>Look at the glowing Power gauge, then press <b>Launch it</b>.</>,
          action: { label: 'Launch it', to: '/launch' },
        }
      if (!fixed)
        return {
          id: 'fix',
          n: 5,
          title: 'Fit a bigger battery',
          body: (
            <>
              The red outline is the small battery. The bus is full, so remove it with its × first. Then open the Battery tab in the parts tray and drag the{' '}
              <b className="text-ink">Large battery</b> onto the craft, or tap its + button.
            </>
          ),
          task: (
            <ol className="list-decimal pl-4">
              <li>Remove the red-outlined small battery with its ×.</li>
              <li>Open the glowing Battery tab.</li>
              <li>Press + on the Large battery.</li>
            </ol>
          ),
        }
      return {
        id: 'ready',
        n: 6,
        title: 'Fly it again',
        body: <>The large battery easily covers the shadow, and the Power gauge has turned green. Launch again and watch the battery bar this time.</>,
        task: <>Press <b>Launch again</b>.</>,
        action: { label: 'Launch again', to: '/launch' },
      }

    case '/review':
      return {
        id: 'review',
        n: fixed ? 6 : 2,
        title: 'Design review',
        body: fixed ? (
          <>In a real mission every role signs off here. Everything should be green now.</>
        ) : (
          <>In a real mission every role signs off here, and a red check would stop the launch. This red one is deliberate: launch anyway so you can see what it does to the craft.</>
        ),
        task: <>Press <b>Go to launch</b>.</>,
        action: { label: 'Go to launch', to: '/launch' },
      }

    case '/launch':
      return {
        id: fixed ? 'launch2' : 'launch',
        n: fixed ? 6 : 2,
        title: 'Launch',
        body: (
          <>
            The rocket climbs through <Term id="max-q">Max Q</Term>, drops its first stage, then opens the <Term id="fairing">fairing</Term> to release your craft.
          </>
        ),
        task: <>Wait for the craft to reach orbit, then press the glowing <b>Go to orbit</b> button.</>,
      }

    case '/sim':
      if (dead && !fixed)
        return {
          id: 'died',
          n: 4,
          title: 'It went dark',
          body: <>The spacecraft shut down in its first pass through Earth's shadow. The report will tell you why.</>,
          task: <>Press <b>See why</b>.</>,
          action: { label: 'See why', to: '/report' },
        }
      if (fixed)
        return {
          id: 'fly2',
          n: 6,
          title: 'Through the shadow',
          body: <>Watch the battery dip in shadow and recharge in sunlight.</>,
          task: <>Pick <b>Year</b> or <b>Fast</b> on the glowing speed bar to fly the whole 3-year mission.</>,
        }
      return {
        id: 'fly',
        n: 3,
        title: 'Watch the battery',
        body: (
          <>
            Every orbit the craft passes through Earth's shadow, an <Term id="eclipse">eclipse</Term>. With no sunlight it runs on its battery. Keep an eye on the
            battery bar.
          </>
        ),
        task: <>Watch the glowing Battery bar. What happens when the craft enters the shadow?</>,
      }

    case '/report':
      return {
        id: 'report',
        n: 4,
        title: 'Find out why',
        body: <>The battery was too small for the time in shadow.</>,
        task: <>Read the glowing <b>Why it happened</b> box, then press <b>Modify and re-fly</b>.</>,
      }

    default:
      return {
        id: 'other',
        n: 1,
        title: "You're in the tutorial",
        body: <>Head back to the workbench to carry on.</>,
        action: { label: 'Workbench', to: '/workbench' },
      }
  }
}
