import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronDown, Compass, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Term } from '@/components/Term'
import { useEvaluation, useGame } from '@/store/game'

interface Step {
  id: string
  n: number
  title: string
  body: ReactNode
  action?: { label: string; to: string }
}

const TOTAL = 6

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
  const won = last?.status === 'complete'
  const step = tutorial ? pickStep(pathname, !!last, last?.status === 'dead', fixed, won) : null

  // On the fix step, outline the battery slot even if the player skipped the report.
  useEffect(() => {
    if (step?.id === 'fix' && !refly) setRefly({ partIds: ['battery-small'], tabs: [], fixes: [] })
  }, [step?.id, refly, setRefly])

  // Open the card again whenever the step changes.
  useEffect(() => setCollapsed(false), [step?.id])

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
            <h2 className="mt-2 font-display text-lg font-semibold">{step.title}</h2>
            <div className="mt-1 text-sm text-muted [&_button]:text-ink">{step.body}</div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-space-700">
              <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${(Math.min(step.n, TOTAL) / TOTAL) * 100}%` }} />
            </div>
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
              This <Term id="cubesat">CubeSat</Term> is built to spot wildfires from <Term id="sso">sun-synchronous orbit</Term>. The Power gauge at the top is red, but lots of teams launch anyway. Let's launch it and see what that means.
            </>
          ),
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
        }
      return {
        id: 'ready',
        n: 6,
        title: 'Fly it again',
        body: <>The large battery easily covers the shadow, and the Power gauge has turned green. Launch again and watch the battery bar this time.</>,
        action: { label: 'Launch again', to: '/launch' },
      }

    case '/review':
      return {
        id: 'review',
        n: fixed ? 6 : 2,
        title: 'Design review',
        body: <>In a real mission every role signs off here. Notice anything red? The tutorial lets you launch anyway.</>,
        action: { label: 'Go to launch', to: '/launch' },
      }

    case '/launch':
      return {
        id: fixed ? 'launch2' : 'launch',
        n: fixed ? 6 : 2,
        title: 'Launch',
        body: (
          <>
            The rocket climbs through <Term id="max-q">Max Q</Term>, drops its first stage, then opens the <Term id="fairing">fairing</Term> to release your craft. Press
            Go to orbit when it's done.
          </>
        ),
      }

    case '/sim':
      if (dead && !fixed)
        return {
          id: 'died',
          n: 4,
          title: 'It went dark',
          body: <>The spacecraft shut down in its first pass through Earth's shadow. The report will tell you why.</>,
          action: { label: 'See why', to: '/report' },
        }
      if (fixed)
        return {
          id: 'fly2',
          n: 6,
          title: 'Through the shadow',
          body: <>Watch the battery dip in shadow and recharge in sunlight. Pick the Year speed to fast-forward the 3-year mission.</>,
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
      }

    case '/report':
      return {
        id: 'report',
        n: 4,
        title: 'Find out why',
        body: <>Read "Why it happened": the battery was too small for the time in shadow. Press Modify and re-fly to fix it.</>,
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
