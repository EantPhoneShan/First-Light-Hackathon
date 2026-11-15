/**
 * A text label drawn inside the 3D scene (a camera-facing sprite), always the
 * same size on screen. Used instead of drei's <Html>, whose separate React
 * roots throw "removeChild" errors when a 3D view unmounts under React 19.
 */
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

interface TextLabelProps {
  text: string
  /** Smaller second line. */
  sub?: string
  position?: [number, number, number]
  color?: string
  /** Which side of the point the label sits on. */
  anchor?: 'center' | 'left' | 'right' | 'above' | 'below'
  /** Text height in CSS pixels. */
  px?: number
}

export function TextLabel({ text, sub, position = [0, 0, 0], color = '#e8edf8', anchor = 'center', px = 12 }: TextLabelProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const height = useThree((s) => s.size.height)
  const dpr = useThree((s) => s.viewport.dpr)

  const { texture, aspect, lines } = useMemo(() => {
    const scale = Math.max(2, Math.ceil(dpr))
    const font = `500 ${px * scale}px Inter, ui-sans-serif, system-ui, sans-serif`
    const subFont = `400 ${(px - 2) * scale}px Inter, ui-sans-serif, system-ui, sans-serif`
    const measure = document.createElement('canvas').getContext('2d')!
    measure.font = font
    let w = measure.measureText(text).width
    if (sub) {
      measure.font = subFont
      w = Math.max(w, measure.measureText(sub).width)
    }
    const padX = 7 * scale
    const padY = 4 * scale
    const lineH = px * scale * 1.3
    const linesN = sub ? 2 : 1
    const c = document.createElement('canvas')
    c.width = Math.ceil(w + padX * 2)
    c.height = Math.ceil(lineH * linesN + padY * 2)
    const g = c.getContext('2d')!
    // Rounded dark chip, matching the app's panels
    const r = 5 * scale
    g.fillStyle = 'rgba(6, 11, 26, 0.85)'
    g.strokeStyle = 'rgba(42, 59, 107, 0.9)'
    g.lineWidth = scale
    g.beginPath()
    g.roundRect(scale / 2, scale / 2, c.width - scale, c.height - scale, r)
    g.fill()
    g.stroke()
    g.textBaseline = 'middle'
    g.font = font
    g.fillStyle = color
    g.fillText(text, padX, padY + lineH / 2)
    if (sub) {
      g.font = subFont
      g.fillStyle = '#8f9bbf'
      g.fillText(sub, padX, padY + lineH * 1.5)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    return { texture: t, aspect: c.width / c.height, lines: linesN }
  }, [text, sub, color, px, dpr])

  useEffect(() => () => texture.dispose(), [texture])

  // sizeAttenuation=false keeps a constant on-screen size: 1 unit = the view's full height at distance 1.
  const pxTall = (px * 1.3 * lines + 8) / height
  const h = pxTall * 2 * Math.tan(((camera.fov ?? 40) * Math.PI) / 360)
  const center: [number, number] = anchor === 'left' ? [1.06, 0.5] : anchor === 'right' ? [-0.06, 0.5] : anchor === 'above' ? [0.5, -0.4] : anchor === 'below' ? [0.5, 1.4] : [0.5, 0.5]

  return (
    <sprite position={position} scale={[h * aspect, h, 1]} center={new THREE.Vector2(...center)} renderOrder={999}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} sizeAttenuation={false} toneMapped={false} />
    </sprite>
  )
}
