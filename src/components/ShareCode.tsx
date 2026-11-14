import { Check, ClipboardCopy, Download, Share2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { decodeDesign, encodeDesign } from '@/engine/share'
import { gameData } from '@/game/ui'
import { useTeamFlow } from '@/game/teamFlow'
import { useGame } from '@/store/game'

/**
 * Save and share a whole design as one short code (PRD F19, Member 1's
 * share.ts). Copy it to send to friends; paste one to load it. A mistyped
 * code is refused by its checksum. In a team, only the leader can load one,
 * because it replaces every role's part.
 */
export function ShareCode({ allowLoad = true }: { allowLoad?: boolean }) {
  const scenarioId = useGame((s) => s.scenarioId)
  const design = useGame((s) => s.design)
  const setScenario = useGame((s) => s.setScenario)
  const loadDesign = useGame((s) => s.loadDesign)
  const flow = useTeamFlow()
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const code = encodeDesign(scenarioId, design)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast('Select the code and copy it by hand.')
    }
  }

  const load = () => {
    const got = decodeDesign(input.trim(), gameData)
    if (!got) return toast.error("That code doesn't work. Check it was copied whole.")
    if (got.scenarioId !== scenarioId) setScenario(got.scenarioId)
    loadDesign(got.design)
    setInput('')
    toast.success('Design loaded.')
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-space-700 bg-space-900 p-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Share2 className="size-4 text-accent" aria-hidden />
        Share code
      </h2>
      <div className="flex gap-2">
        <input readOnly value={code} onFocus={(e) => e.target.select()} aria-label="Share code for this design" className="min-w-0 flex-1 truncate rounded-lg border border-space-600 bg-space-950 px-2 py-1.5 font-mono text-xs text-muted" />
        <button onClick={copy} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-space-600 px-2.5 py-1.5 text-xs hover:bg-space-800" aria-label="Copy share code">
          {copied ? <Check className="size-3.5 text-ok" aria-hidden /> : <ClipboardCopy className="size-3.5" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {allowLoad && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a friend's code"
            aria-label="Paste a share code to load"
            disabled={!flow.canRewriteDesign}
            title={!flow.canRewriteDesign ? 'A code replaces every role’s part, so it only loads when you play all four roles.' : undefined}
            className="min-w-0 flex-1 rounded-lg border border-space-600 bg-space-950 px-2 py-1.5 font-mono text-xs placeholder:font-sans placeholder:text-muted/60 disabled:opacity-50"
          />
          <button type="submit" disabled={!input.trim() || !flow.canRewriteDesign} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-space-700 px-2.5 py-1.5 text-xs hover:bg-space-600 disabled:opacity-40">
            <Download className="size-3.5" aria-hidden />
            Load
          </button>
        </form>
      )}
    </div>
  )
}
