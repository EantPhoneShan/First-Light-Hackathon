import { useEffect, useRef } from 'react'

/**
 * A sharp star field drawn for the screen it is on, so it stays crisp on any size or
 * high-resolution display (a photo gets stretched and turns grainy). Same stars every time.
 */
export function Starfield({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Deep navy, a little lighter in the middle behind the title.
      const sky = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, Math.max(w, h) * 0.8)
      sky.addColorStop(0, '#0d1630')
      sky.addColorStop(1, '#03060f')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, h)

      // Seeded random, so the sky doesn't change between visits.
      let seed = 20261115
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed / 4294967296
      }
      const tints = ['255,255,255', '214,226,255', '255,236,214']
      const count = Math.round((w * h) / 2600)
      for (let i = 0; i < count; i++) {
        const x = rand() * w
        const y = rand() * h
        const big = rand() < 0.03
        const r = big ? 1.1 + rand() * 0.9 : 0.4 + rand() * 0.6
        const a = big ? 0.85 + rand() * 0.15 : 0.25 + rand() * 0.5
        const tint = tints[Math.floor(rand() * tints.length)]
        if (big) {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          glow.addColorStop(0, `rgba(${tint},${a * 0.35})`)
          glow.addColorStop(1, `rgba(${tint},0)`)
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(x, y, r * 5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = `rgba(${tint},${a})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    draw()
    let timer: ReturnType<typeof setTimeout> | undefined
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(draw, 150)
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={ref} aria-hidden className={`pointer-events-none fixed inset-0 -z-10 h-full w-full ${className}`} />
}
