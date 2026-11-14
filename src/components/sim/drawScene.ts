import { craftAngle, type SimContext } from '@/engine/mockSim'
import type { SimState } from '@/engine/placeholderTypes'

export interface Star {
  x: number
  y: number
  r: number
  a: number
}

/** Fixed starfield (0..1 coordinates) so it doesn't flicker between frames. */
export function makeStars(n = 140): Star[] {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: n }, () => ({ x: rand(), y: rand(), r: rand() * 1.2 + 0.3, a: rand() * 0.6 + 0.2 }))
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/**
 * Draws one frame: stars, Sun glow, Earth with day/night, the shadow cone,
 * the orbit, the spacecraft (panels dark in eclipse) and a downlink beam during passes.
 */
export function drawScene(g: CanvasRenderingContext2D, w: number, h: number, s: SimState, ctx: SimContext, stars: Star[], altitudeKm: number) {
  const accent = css('--color-accent') || '#ff8a3d'
  const ok = css('--color-ok') || '#3ddc97'
  const bad = css('--color-bad') || '#ff5c6c'

  g.clearRect(0, 0, w, h)
  g.fillStyle = '#04081a'
  g.fillRect(0, 0, w, h)

  for (const st of stars) {
    g.globalAlpha = st.a
    g.fillStyle = '#fff'
    g.beginPath()
    g.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1

  // Sun glow on the left
  const sun = g.createRadialGradient(0, h / 2, 0, 0, h / 2, w * 0.45)
  sun.addColorStop(0, 'rgba(255,214,120,0.35)')
  sun.addColorStop(1, 'rgba(255,214,120,0)')
  g.fillStyle = sun
  g.fillRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const m = Math.min(w, h)
  const R = m * 0.17
  const deep = ctx.shadowHalfWidth === 0
  const r = deep ? m * 0.42 : Math.max(R + 16, R + (m * 0.44 - R) * Math.sqrt(altitudeKm / 35786))

  // Shadow cone (to the right)
  if (!deep) {
    const sh = g.createLinearGradient(cx, 0, w, 0)
    sh.addColorStop(0, 'rgba(0,0,0,0.6)')
    sh.addColorStop(1, 'rgba(0,0,0,0.15)')
    g.fillStyle = sh
    g.fillRect(cx, cy - R, w - cx, R * 2)
  }

  // Orbit path
  g.setLineDash([4, 6])
  g.strokeStyle = 'rgba(143,155,191,0.45)'
  g.lineWidth = 1
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.stroke()
  g.setLineDash([])

  // Earth with day side facing the Sun
  const earth = g.createRadialGradient(cx - R * 0.4, cy - R * 0.3, R * 0.1, cx, cy, R)
  earth.addColorStop(0, '#5a9bff')
  earth.addColorStop(0.7, '#1f4fae')
  earth.addColorStop(1, '#0d2560')
  g.fillStyle = earth
  g.beginPath()
  g.arc(cx, cy, R, 0, Math.PI * 2)
  g.fill()
  const night = g.createLinearGradient(cx - R, 0, cx + R, 0)
  night.addColorStop(0.5, 'rgba(0,0,0,0)')
  night.addColorStop(0.62, 'rgba(0,0,0,0.65)')
  g.fillStyle = night
  g.beginPath()
  g.arc(cx, cy, R, 0, Math.PI * 2)
  g.fill()
  // Atmosphere rim
  g.strokeStyle = 'rgba(120,180,255,0.35)'
  g.lineWidth = 2
  g.beginPath()
  g.arc(cx, cy, R + 1.5, Math.PI * 0.5, Math.PI * 1.5)
  g.stroke()

  const th = craftAngle(ctx, s.tMin)
  const px = cx + Math.cos(th) * r
  const py = cy + Math.sin(th) * r
  const dead = s.status === 'dead'

  // Trail
  g.strokeStyle = dead ? 'rgba(255,92,108,0.25)' : 'rgba(255,138,61,0.45)'
  g.lineWidth = 2
  g.beginPath()
  g.arc(cx, cy, r, th - 0.5, th)
  g.stroke()

  // Downlink beam to the ground under the craft
  if (s.inContact && !dead) {
    const gx = cx + Math.cos(th) * R
    const gy = cy + Math.sin(th) * R
    const beam = g.createLinearGradient(px, py, gx, gy)
    beam.addColorStop(0, ok)
    beam.addColorStop(1, 'rgba(61,220,151,0.1)')
    g.strokeStyle = beam
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(px, py)
    g.lineTo(gx, gy)
    g.stroke()
    g.fillStyle = ok
    g.beginPath()
    g.arc(gx, gy, 3.5, 0, Math.PI * 2)
    g.fill()
  }

  // Spacecraft: body + two panels, rotated along its path
  g.save()
  g.translate(px, py)
  g.rotate(th + Math.PI / 2)
  const sz = Math.max(5, m * 0.018)
  if (!dead) {
    g.shadowColor = s.inEclipse ? 'transparent' : accent
    g.shadowBlur = 12
  }
  g.fillStyle = s.inEclipse || dead ? '#2a3350' : '#cfe0ff'
  g.fillRect(-sz * 3, -sz * 0.45, sz * 1.9, sz * 0.9)
  g.fillRect(sz * 1.1, -sz * 0.45, sz * 1.9, sz * 0.9)
  g.fillStyle = dead ? '#555c70' : accent
  g.fillRect(-sz * 0.8, -sz * 0.8, sz * 1.6, sz * 1.6)
  g.restore()

  if (dead) {
    g.fillStyle = bad
    g.font = `600 ${Math.max(11, m * 0.028)}px Inter, sans-serif`
    g.textAlign = 'center'
    g.fillText('NO SIGNAL', px, py - sz * 2.4)
  }

  // Labels
  g.fillStyle = 'rgba(255,214,120,0.8)'
  g.font = '11px Inter, sans-serif'
  g.textAlign = 'left'
  g.fillText('☀ Sun', 10, 18)
  if (!deep) {
    g.fillStyle = 'rgba(143,155,191,0.8)'
    g.textAlign = 'right'
    g.fillText("Earth's shadow", w - 10, cy + R + 16)
  }
}
