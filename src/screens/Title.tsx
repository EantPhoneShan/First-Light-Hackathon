import { BookOpen, Satellite, Swords, Users, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Art } from '@/components/Art'
import { Starfield } from '@/components/Starfield'
import { useGame } from '@/store/game'
import { cn } from '@/lib/cn'

const modes = [
  { to: '/briefing', label: 'Campaign', desc: 'Solo. You hold all four roles.', icon: Satellite, primary: true, mode: 'campaign' },
  { to: '/lobby', label: 'Team mission', desc: 'Up to 4 players, one shared screen.', icon: Users },
  { to: '/workbench', label: 'Tutorial', desc: 'Fly a broken CubeSat and find out why it dies. About 5 minutes.', icon: BookOpen, mode: 'tutorial' },
  { to: '/briefing', label: 'Sandbox', desc: 'No budget, no limits. Coming later.', icon: Wrench, disabled: true },
  { to: '/briefing', label: 'Competitive', desc: 'Two teams, same mission. Coming later.', icon: Swords, disabled: true },
]

export function Title() {
  const startTutorial = useGame((s) => s.startTutorial)
  const tutorial = useGame((s) => s.tutorial)
  const endTutorial = useGame((s) => s.endTutorial)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-4 py-12">
      <Starfield />
      <div className="text-center">
        <Art name="scene-title" className="mx-auto -mb-6 w-full max-w-xl [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_72%)]" />
        <p className="text-sm font-medium tracking-widest text-accent uppercase">Mission Design Lab</p>
        <h1 className="mt-2 text-5xl font-bold sm:text-6xl">First Light</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Your spacecraft dies in its first eclipse. Find out why, fix it, and fly again.
        </p>
      </div>

      <ul className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        {modes.map(({ to, label, desc, icon: Icon, primary, disabled, mode }) => (
          <li key={label} className={cn(primary && 'sm:col-span-2')}>
            <Link
              to={disabled ? '#' : to}
              aria-disabled={disabled}
              onClick={(e) => {
                if (disabled) return e.preventDefault()
                if (mode === 'tutorial') startTutorial()
                else if (tutorial) endTutorial()
                // Campaign is solo: drop any team from an earlier lobby.
                if (mode === 'campaign') useGame.setState({ players: [], myRole: "solo" })
              }}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-4 transition-colors',
                primary
                  ? 'border-accent bg-accent/10 hover:bg-accent/20'
                  : 'border-space-700 bg-space-900 hover:border-space-600',
                disabled && 'cursor-not-allowed opacity-50 hover:border-space-700',
              )}
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', primary ? 'text-accent' : 'text-muted')} aria-hidden />
              <span>
                <span className="block font-display font-semibold">{label}</span>
                <span className="block text-sm text-muted">{desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
