/**
 * Shared 3D materials and textures for the spacecraft and rocket models.
 * Every texture is drawn on a canvas at runtime, so the game needs no image
 * downloads and works offline. Made once and reused by every model.
 */
import * as THREE from 'three'

// ---------- small helpers ----------

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h)
  return c
}

function tex(c: HTMLCanvasElement, opts: { repeat?: [number, number]; srgb?: boolean } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (opts.repeat) t.repeat.set(...opts.repeat)
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Deterministic pseudo-random numbers, so textures look the same on every device. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ---------- textures ----------

/** Solar cells: dark blue cells with silver busbars and thin finger lines. */
function solarCells(cols = 4, rows = 6) {
  return canvas(256, 384, (g, w, h) => {
    g.fillStyle = '#c9ced8'
    g.fillRect(0, 0, w, h)
    const cw = w / cols
    const ch = h / rows
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const x = i * cw + 3
        const y = j * ch + 3
        const grd = g.createLinearGradient(x, y, x + cw, y + ch)
        grd.addColorStop(0, '#1a3a8c')
        grd.addColorStop(0.5, '#10276a')
        grd.addColorStop(1, '#1b3f96')
        g.fillStyle = grd
        g.fillRect(x, y, cw - 6, ch - 6)
        // clipped corners, like real triple-junction cells
        g.fillStyle = '#c9ced8'
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + 7, y)
        g.lineTo(x, y + 7)
        g.fill()
        g.strokeStyle = 'rgba(200,210,235,0.35)'
        g.lineWidth = 1
        for (let k = 1; k < 8; k++) {
          g.beginPath()
          g.moveTo(x, y + (k * (ch - 6)) / 8)
          g.lineTo(x + cw - 6, y + (k * (ch - 6)) / 8)
          g.stroke()
        }
        g.strokeStyle = 'rgba(225,230,245,0.8)'
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(x + (cw - 6) / 2, y)
        g.lineTo(x + (cw - 6) / 2, y + ch - 6)
        g.stroke()
      }
  })
}

/** Gold thermal blanket (MLI): wrinkled foil, as a colour map and a bump map. */
function foil(seed: number, bump: boolean) {
  const r = rng(seed)
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = bump ? '#808080' : '#c99a2e'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 900; i++) {
      const x = r() * w
      const y = r() * h
      const len = 20 + r() * 90
      const a = r() * Math.PI
      const light = r()
      g.strokeStyle = bump ? `rgba(${light > 0.5 ? 255 : 0},${light > 0.5 ? 255 : 0},${light > 0.5 ? 255 : 0},0.18)` : light > 0.5 ? 'rgba(255,230,150,0.22)' : 'rgba(120,80,10,0.22)'
      g.lineWidth = 1 + r() * 3
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 20, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 20, x + Math.cos(a) * len, y + Math.sin(a) * len)
      g.stroke()
    }
    // taped seams
    g.fillStyle = bump ? 'rgba(255,255,255,0.25)' : 'rgba(255,215,120,0.35)'
    g.fillRect(0, h * 0.49, w, 8)
    g.fillRect(w * 0.49, 0, 8, h)
  })
}

/** Rocket skin: white paint, faint panel lines and a few weld seams. */
function rocketSkin(dark: boolean) {
  return canvas(512, 1024, (g, w, h) => {
    g.fillStyle = dark ? '#1b1d22' : '#eef0f2'
    g.fillRect(0, 0, w, h)
    const r = rng(dark ? 7 : 3)
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = dark ? `rgba(255,255,255,${r() * 0.04})` : `rgba(0,0,0,${r() * 0.025})`
      g.fillRect(r() * w, r() * h, 2, 2)
    }
    g.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)'
    g.lineWidth = 2
    for (let y = 0; y < h; y += 128) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w, y)
      g.stroke()
    }
    for (let x = 0; x < w; x += 128) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, h)
      g.stroke()
    }
  })
}

/** Printed circuit board: green with gold traces and black chips. */
function pcb() {
  const r = rng(11)
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#1d6b4a'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#c9a84a'
    g.lineWidth = 1.5
    for (let i = 0; i < 60; i++) {
      let x = r() * w
      let y = r() * h
      g.beginPath()
      g.moveTo(x, y)
      for (let k = 0; k < 3; k++) {
        if (r() > 0.5) x += (r() - 0.5) * 80
        else y += (r() - 0.5) * 80
        g.lineTo(x, y)
      }
      g.stroke()
    }
    for (let i = 0; i < 7; i++) {
      g.fillStyle = '#16181c'
      const s = 20 + r() * 40
      g.fillRect(r() * (w - s), r() * (h - s), s, s * (0.6 + r() * 0.4))
    }
  })
}

/** Earth: ocean, procedural continents, ice caps and clouds. One-off, larger. */
export function earthTexture(): THREE.Texture {
  const W = 1024
  const H = 512
  // Value noise on a sphere-ish grid (wraps in x).
  const r = rng(42)
  const grid = (n: number) => Array.from({ length: n * n }, () => r())
  const octaves = [8, 16, 32, 64].map((n) => ({ n, g: grid(n) }))
  const noise = (u: number, v: number) => {
    let sum = 0
    let amp = 1
    let norm = 0
    for (const { n, g } of octaves) {
      const x = u * n
      const y = v * n * 0.5
      const xi = Math.floor(x)
      const yi = Math.floor(y)
      const fx = x - xi
      const fy = y - yi
      const at = (a: number, b: number) => g[((b % n) + n) % n * n + (((a % n) + n) % n)]
      const s = (t: number) => t * t * (3 - 2 * t)
      const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * s(fx)
      const bot = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * s(fx)
      sum += (top + (bot - top) * s(fy)) * amp
      norm += amp
      amp *= 0.5
    }
    return sum / norm
  }
  const c = canvas(W, H, (g) => {
    const img = g.createImageData(W, H)
    for (let y = 0; y < H; y++) {
      const lat = Math.abs(y / H - 0.5) * 2
      for (let x = 0; x < W; x++) {
        const n = noise(x / W, y / H)
        const cloud = noise(x / W + 0.37, y / H + 0.21)
        const i = (y * W + x) * 4
        let col: [number, number, number]
        if (lat > 0.86) col = [235, 240, 245]
        else if (n > 0.53) {
          const k = Math.min(1, (n - 0.53) * 6)
          col = lat > 0.6 ? [120 + 60 * k, 130 + 50 * k, 110 + 40 * k] : lat < 0.35 && n > 0.6 ? [190, 160, 105] : [60 + 50 * k, 110 + 20 * k, 55 + 20 * k]
        } else {
          const d = Math.min(1, (0.53 - n) * 5)
          col = [14 + 20 * (1 - d), 50 + 40 * (1 - d), 110 + 50 * (1 - d)]
        }
        const cl = Math.max(0, (cloud - 0.55) * 3.2)
        img.data[i] = col[0] + (245 - col[0]) * Math.min(1, cl)
        img.data[i + 1] = col[1] + (248 - col[1]) * Math.min(1, cl)
        img.data[i + 2] = col[2] + (252 - col[2]) * Math.min(1, cl)
        img.data[i + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
  })
  const t = tex(c)
  t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

/** Soft round puff for smoke and exhaust particles. */
export function puffTexture(): THREE.Texture {
  return tex(
    canvas(128, 128, (g, w) => {
      const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
      grd.addColorStop(0, 'rgba(255,255,255,1)')
      grd.addColorStop(0.4, 'rgba(255,255,255,0.55)')
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grd
      g.fillRect(0, 0, w, w)
    }),
  )
}

// ---------- materials (lazy singletons) ----------

let cache: ReturnType<typeof make> | null = null

function make() {
  const cells = tex(solarCells())
  const foilMap = tex(foil(5, false), { repeat: [1, 1] })
  const foilBump = tex(foil(5, true), { srgb: false })
  const skin = tex(rocketSkin(false), { repeat: [2, 1] })
  const skinDark = tex(rocketSkin(true), { repeat: [2, 1] })
  const board = tex(pcb())
  return {
    aluminium: new THREE.MeshStandardMaterial({ color: '#c3c8d2', metalness: 0.7, roughness: 0.38 }),
    anodised: new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.6, roughness: 0.45 }),
    rail: new THREE.MeshStandardMaterial({ color: '#d7dbe2', metalness: 0.9, roughness: 0.25 }),
    whitePaint: new THREE.MeshStandardMaterial({ color: '#f1f3f6', metalness: 0.05, roughness: 0.55 }),
    gold: new THREE.MeshStandardMaterial({ map: foilMap, bumpMap: foilBump, bumpScale: 2.5, color: '#ffffff', metalness: 0.65, roughness: 0.38, emissive: '#3a2604', emissiveIntensity: 0.35 }),
    silverFoil: new THREE.MeshStandardMaterial({ bumpMap: foilBump, bumpScale: 2, color: '#8e97aa', metalness: 0.6, roughness: 0.45 }),
    solar: new THREE.MeshStandardMaterial({ map: cells, metalness: 0.4, roughness: 0.28, color: '#ffffff' }),
    panelBack: new THREE.MeshStandardMaterial({ color: '#3a3f48', metalness: 0.3, roughness: 0.7 }),
    pcb: new THREE.MeshStandardMaterial({ map: board, metalness: 0.2, roughness: 0.6 }),
    copper: new THREE.MeshStandardMaterial({ color: '#c87533', metalness: 1, roughness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: '#15171b', metalness: 0.3, roughness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#0d1a2e', metalness: 0.1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 }),
    lensCoat: new THREE.MeshPhysicalMaterial({ color: '#3b2a6e', metalness: 0.6, roughness: 0.1, iridescence: 1, iridescenceIOR: 1.6 }),
    orange: new THREE.MeshStandardMaterial({ color: '#ff8a3d', metalness: 0.2, roughness: 0.5 }),
    battery: new THREE.MeshStandardMaterial({ color: '#2b3a5c', metalness: 0.4, roughness: 0.5 }),
    tank: new THREE.MeshStandardMaterial({ color: '#c3c8d0', metalness: 0.8, roughness: 0.25 }),
    // Rocket
    rocketWhite: new THREE.MeshStandardMaterial({ map: skin, metalness: 0.1, roughness: 0.5 }),
    rocketBlack: new THREE.MeshStandardMaterial({ map: skinDark, metalness: 0.2, roughness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: '#c7cbd1', metalness: 0.8, roughness: 0.3 }),
    nozzle: new THREE.MeshStandardMaterial({ color: '#3b3330', metalness: 0.9, roughness: 0.45, side: THREE.DoubleSide }),
    nozzleHot: new THREE.MeshStandardMaterial({ color: '#4a2a1c', emissive: '#ff6a1a', emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide }),
    titanium: new THREE.MeshStandardMaterial({ color: '#8f949c', metalness: 0.9, roughness: 0.4 }),
    capsule: new THREE.MeshStandardMaterial({ color: '#e9ebee', metalness: 0.15, roughness: 0.45 }),
    heatShield: new THREE.MeshStandardMaterial({ color: '#3a2c22', metalness: 0.1, roughness: 0.9 }),
  }
}

export type Mats = ReturnType<typeof make>

/** All shared materials (made on first use, after the page has a document). */
export function mats(): Mats {
  if (!cache) cache = make()
  return cache
}
