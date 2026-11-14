import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { glossary } from '@/content/glossary'
import { cn } from '@/lib/cn'

/** "Learn more" page: every space term in the game, with a longer explanation (F21). */
export function Learn() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const target = hash.slice(1)

  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView({ block: 'center' })
  }, [target])

  return (
    <Screen title="Space words" subtitle="Every term in the game, in plain English." hideNext>
      <button onClick={() => navigate(-1)} className="-my-2 inline-flex w-fit items-center gap-2 py-2 text-sm text-accent hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Back to the mission
      </button>
      <dl className="grid gap-3 sm:grid-cols-2">
        {glossary.map((t) => (
          <div
            key={t.id}
            id={t.id}
            className={cn('scroll-mt-32 rounded-xl border bg-space-900 p-4', t.id === target ? 'border-accent' : 'border-space-700')}
          >
            <dt className="font-display font-semibold">{t.term}</dt>
            <dd className="mt-1 text-sm">{t.short}</dd>
            <dd className="mt-2 text-sm text-muted">{t.long}</dd>
          </div>
        ))}
      </dl>
    </Screen>
  )
}
