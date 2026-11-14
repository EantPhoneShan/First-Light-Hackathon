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

/** Brushed aluminium with a screw at each corner and along the edges (CubeSat side panels). */
function cubePanel() {
  const r = rng(21)
  return canvas(256, 384, (g, w, h) => {
    g.fillStyle = '#b8bec9'
    g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y++) {
      g.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},255,${r() * 0.05})`
      g.fillRect(0, y, w, 1)
    }
    // Lightening cut-outs and a raised border, like real machined panels
    g.strokeStyle = 'rgba(40,46,58,0.45)'
    g.lineWidth = 3
    g.strokeRect(14, 14, w - 28, h - 28)
    g.fillStyle = 'rgba(60,66,80,0.25)'
    g.fillRect(40, 60, w - 80, h / 2 - 90)
    g.fillRect(40, h / 2 + 30, w - 80, h / 2 - 90)
    for (const [x, y] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10], [w / 2, 10], [w / 2, h - 10], [10, h / 2], [w - 10, h / 2]]) {
      g.fillStyle = '#6b7180'
      g.beginPath()
      g.arc(x, y, 5, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#2a2e36'
      g.fillRect(x - 3, y - 0.8, 6, 1.6)
    }
  })
}

/** White radiator panel: painted, with a grid of bonded heat pipes showing through. */
function radiator() {
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#eef1f5'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = 'rgba(120,130,150,0.35)'
    g.lineWidth = 2
    for (let x = 16; x < w; x += 32) {
      g.beginPath()
      g.moveTo(x, 8)
      g.lineTo(x, h - 8)
      g.stroke()
    }
    g.strokeStyle = 'rgba(80,90,110,0.5)'
    g.strokeRect(4, 4, w - 8, h - 8)
  })
}

/** Rocket livery: white body, an orange band, a black stripe and the game's name in big letters. */
function livery() {
  return canvas(1024, 2048, (g, w, h) => {
    g.fillStyle = '#f2f3f5'
    g.fillRect(0, 0, w, h)
    const r = rng(9)
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.025})`
      g.fillRect(r() * w, r() * h, 2, 2)
    }
    g.strokeStyle = 'rgba(0,0,0,0.09)'
    g.lineWidth = 3
    for (let y = 0; y < h; y += 256) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w, y)
      g.stroke()
    }
    // Orange band near the top, thin black pinstripes
    g.fillStyle = '#ff7a1f'
    g.fillRect(0, h * 0.08, w, h * 0.035)
    g.fillStyle = '#15171b'
    g.fillRect(0, h * 0.125, w, h * 0.008)
    g.fillRect(0, h * 0.07, w, h * 0.006)
    // Name down the side (one side of the cylinder only)
    g.save()
    g.translate(w * 0.25, h * 0.22)
    g.rotate(Math.PI / 2)
    g.fillStyle = '#15171b'
    g.font = 'bold 150px "Space Grotesk", Inter, sans-serif'
    g.fillText('FIRST LIGHT', 0, 0)
    g.restore()
    // Dark band at the base
    g.fillStyle = '#1b1d22'
    g.fillRect(0, h * 0.94, w, h * 0.06)
  })
}

/** Earth: ocean, procedural continents, ice caps and clouds. One-off, larger. */
export function earthTexture(): THREE.Texture {
  const W = 2048
  const H = 1024
  // Value noise that wraps in x, summed over octaves (fractal), from a fixed seed.
  const r = rng(42)
  const grid = (n: number) => Array.from({ length: n * n }, () => r())
  const octaves = [6, 12, 24, 48, 96, 192].map((n) => ({ n, g: grid(n) }))
  const noise = (u: number, v: number, off = 0) => {
    let sum = 0
    let amp = 1
    let norm = 0
    for (const { n, g } of octaves) {
      const x = u * n + off
      const y = v * n * 0.5 + off * 0.7
      const xi = Math.floor(x)
      const yi = Math.floor(y)
      const fx = x - xi
      const fy = y - yi
      const at = (a: number, b: number) => g[(((b % n) + n) % n) * n + (((a % n) + n) % n)]
      const sm = (t: number) => t * t * (3 - 2 * t)
      const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sm(fx)
      const bot = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sm(fx)
      sum += (top + (bot - top) * sm(fy)) * amp
      norm += amp
      amp *= 0.52
    }
    return sum / norm
  }
  const c = canvas(W, H, (g) => {
    const img = g.createImageData(W, H)
    for (let y = 0; y < H; y++) {
      const lat = Math.abs(y / H - 0.5) * 2
      for (let x = 0; x < W; x++) {
        const u = x / W
        const v = y / H
        const n = noise(u, v)
        const dry = noise(u, v, 13.7)
        const cloud = noise(u * 1.3, v, 41.2)
        const i = (y * W + x) * 4
        let col: [number, number, number]
        // Ice caps with a ragged edge
        const ice = 0.83 + (noise(u, v, 7.1) - 0.5) * 0.12
        if (n > 0.545) {
          const k = Math.min(1, (n - 0.545) * 7)
          // Deserts in the dry subtropics, forest near the equator, tundra up north
          if (lat > 0.12 && lat < 0.42 && dry > 0.58) col = [196 - k * 30, 168 - k * 30, 118 - k * 20]
          else if (lat > 0.66) col = [118 + k * 20, 122 + k * 15, 96]
          else col = [52 + k * 40, 96 + k * 25, 46 + k * 18]
          if (k > 0.75) col = [col[0] * 0.8 + 30, col[1] * 0.8 + 26, col[2] * 0.8 + 22] // mountains
        } else {
          // Ocean: shallow shelves turquoise, deep water dark blue
          const d = Math.min(1, (0.545 - n) * 6)
          col = [12 + 40 * (1 - d) ** 3, 44 + 90 * (1 - d) ** 3, 92 + 70 * (1 - d) ** 2]
        }
        // Ice caps blend in over a band of latitude (no hard, blocky edge)
        const iceK = Math.min(1, Math.max(0, (lat - ice + 0.035) / 0.07))
        if (iceK > 0) col = [col[0] + (232 - col[0]) * iceK, col[1] + (238 - col[1]) * iceK, col[2] + (244 - col[2]) * iceK]
        const cl = Math.min(1, Math.max(0, (cloud - 0.56) * 3.5))
        img.data[i] = col[0] + (248 - col[0]) * cl
        img.data[i + 1] = col[1] + (250 - col[1]) * cl
        img.data[i + 2] = col[2] + (252 - col[2]) * cl
        img.data[i + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
  })
  const t = tex(c)
  t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

/**
 * Grass, painted from the team's grassland photo: its own greens and straw
 * yellows, as soft colour variation plus thousands of short blades. Everything
 * wraps at the edges, so the tile repeats with no visible seam or grid.
 * `tiles` = repeats across the ground.
 */
export function grassTexture(tiles: number): THREE.Texture {
  const r = rng(31)
  // Colours sampled from public/assets/bg/grassland.jpg
  const base = ['#555a21', '#5c6820', '#5f6f1f', '#57641d', '#4b571b', '#525c1b']
  const blades = ['#6b7a2a', '#76862c', '#4f5b1b', '#3a4216', '#8a9a3a', '#9aa64a', '#5f6f1f']
  const c = canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#56611f'
    g.fillRect(0, 0, w, h)
    // Soft colour variation (drawn 3x3 so it wraps)
    for (let i = 0; i < 120; i++) {
      const x = r() * w
      const y = r() * h
      const rad = 20 + r() * 70
      const col = base[Math.floor(r() * base.length)]
      for (const ox of [-w, 0, w])
        for (const oy of [-h, 0, h]) {
          const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad)
          grd.addColorStop(0, col + 'aa')
          grd.addColorStop(1, col + '00')
          g.fillStyle = grd
          g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2)
        }
    }
    // Blades: short strokes leaning a little, drawn wrapped at the edges
    g.lineCap = 'round'
    for (let i = 0; i < 9000; i++) {
      const x = r() * w
      const y = r() * h
      const len = 4 + r() * 9
      const lean = (r() - 0.5) * 0.9
      g.strokeStyle = blades[Math.floor(r() * blades.length)]
      g.globalAlpha = 0.35 + r() * 0.5
      g.lineWidth = 0.8 + r() * 1.2
      for (const ox of x < len ? [0, w] : x > w - len ? [0, -w] : [0])
        for (const oy of y < len ? [0, h] : y > h - len ? [0, -h] : [0]) {
          g.beginPath()
          g.moveTo(x + ox, y + oy)
          g.lineTo(x + ox + Math.sin(lean) * len, y + oy - Math.cos(lean) * len)
          g.stroke()
        }
    }
    g.globalAlpha = 1
  })
  const t = tex(c, { repeat: [tiles, tiles] })
  t.anisotropy = 8
  return t
}

/** Big soft patches (lighter and darker ground), laid over the grass to hide any repeat. */
export function meadowPatches(): THREE.Texture {
  const r = rng(77)
  const c = canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 140; i++) {
      const x = r() * w
      const y = r() * h
      const rad = 20 + r() * 90
      const grd = g.createRadialGradient(x, y, 0, x, y, rad)
      grd.addColorStop(0, `rgba(255,255,255,${0.15 + r() * 0.35})`)
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grd
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
  })
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(12, 12)
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
  const panel = tex(cubePanel())
  const rad = tex(radiator())
  const liv = tex(livery())
  return {
    cubePanel: new THREE.MeshStandardMaterial({ map: panel, metalness: 0.75, roughness: 0.35 }),
    radiator: new THREE.MeshStandardMaterial({ map: rad, metalness: 0.05, roughness: 0.4 }),
    rocketLivery: new THREE.MeshStandardMaterial({ map: liv, metalness: 0.1, roughness: 0.45 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e6e9ee', metalness: 1, roughness: 0.12 }),
    frame: new THREE.MeshStandardMaterial({ color: '#9aa1ad', metalness: 0.8, roughness: 0.3 }),
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
