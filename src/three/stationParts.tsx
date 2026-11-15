/**
 * Realistic ground-station hardware for Station3D, at real-world scale (metres).
 * Textures are painted on canvases at runtime (no downloads): building facades
 * with window bays, corrugated metal, roof membrane, gravel, asphalt and
 * chain-link fencing.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mats } from './materials'

/** 0, 1, … n-1 (so .map gets the whole list as its third argument). */
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

// ---------------------------------------------------------------- textures

function paint(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function rand(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** Speckle noise on a base colour (concrete, gravel, asphalt). */
function speckle(g: CanvasRenderingContext2D, w: number, h: number, base: string, n: number, light: number, dark: number, seed: number, size = 2) {
  g.fillStyle = base
  g.fillRect(0, 0, w, h)
  const r = rand(seed)
  for (let i = 0; i < n; i++) {
    const v = r() > 0.5 ? `rgba(255,255,255,${r() * light})` : `rgba(0,0,0,${r() * dark})`
    g.fillStyle = v
    const s = size * (0.5 + r())
    g.fillRect(r() * w, r() * h, s, s)
  }
}

/**
 * One facade bay (3 m wide, one 3.5 m storey): precast concrete with a framed
 * window, sill and a little weathering. Repeated across the wall.
 */
function facadeBay() {
  return paint(256, 300, (g, w, h) => {
    speckle(g, w, h, '#cfc8bb', 2500, 0.08, 0.08, 3)
    // Panel joints
    g.fillStyle = 'rgba(70,64,56,0.55)'
    g.fillRect(0, 0, w, 3)
    g.fillRect(0, 0, 3, h)
    // Window: frame, glass with sky reflection, mullion
    const x0 = w * 0.14
    const y0 = h * 0.22
    const ww = w * 0.72
    const wh = h * 0.5
    g.fillStyle = '#3d4248'
    g.fillRect(x0 - 5, y0 - 5, ww + 10, wh + 10)
    const glass = g.createLinearGradient(0, y0, 0, y0 + wh)
    glass.addColorStop(0, '#9fb4cc')
    glass.addColorStop(0.45, '#4b6280')
    glass.addColorStop(1, '#22324a')
    g.fillStyle = glass
    g.fillRect(x0, y0, ww, wh)
    g.fillStyle = 'rgba(255,255,255,0.18)'
    g.beginPath()
    g.moveTo(x0, y0 + wh * 0.7)
    g.lineTo(x0 + ww * 0.35, y0)
    g.lineTo(x0 + ww * 0.5, y0)
    g.lineTo(x0, y0 + wh)
    g.fill()
    g.fillStyle = '#3d4248'
    g.fillRect(x0 + ww / 2 - 3, y0, 6, wh)
    // Sill and rain streaks under it
    g.fillStyle = '#b5ad9f'
    g.fillRect(x0 - 10, y0 + wh + 5, ww + 20, 8)
    for (let i = 0; i < 6; i++) {
      const sx = x0 + (ww / 6) * (i + 0.5)
      const grd = g.createLinearGradient(0, y0 + wh + 13, 0, h)
      grd.addColorStop(0, 'rgba(60,55,48,0.18)')
      grd.addColorStop(1, 'rgba(60,55,48,0)')
      g.fillStyle = grd
      g.fillRect(sx, y0 + wh + 13, 3, h - y0 - wh - 13)
    }
  })
}

/** Vertical corrugated steel cladding (sheds, equipment buildings). */
function corrugated(color: string) {
  return paint(256, 256, (g, w, h) => {
    g.fillStyle = color
    g.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 16) {
      const grd = g.createLinearGradient(x, 0, x + 16, 0)
      grd.addColorStop(0, 'rgba(0,0,0,0.18)')
      grd.addColorStop(0.5, 'rgba(255,255,255,0.12)')
      grd.addColorStop(1, 'rgba(0,0,0,0.18)')
      g.fillStyle = grd
      g.fillRect(x, 0, 16, h)
    }
    const r = rand(9)
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(80,60,40,${r() * 0.06})`
      g.fillRect(r() * w, r() * h, 2, 6)
    }
  })
}

/** Horizontal timber/vinyl siding for the radio amateur's house. */
function siding() {
  return paint(256, 256, (g, w, h) => {
    g.fillStyle = '#e4ddcf'
    g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = 'rgba(0,0,0,0.14)'
      g.fillRect(0, y + 14, w, 2)
      g.fillStyle = 'rgba(255,255,255,0.25)'
      g.fillRect(0, y, w, 2)
    }
  })
}

/** Roof shingles. */
function shingles() {
  return paint(256, 256, (g, w, h) => {
    g.fillStyle = '#4a4440'
    g.fillRect(0, 0, w, h)
    const r = rand(17)
    for (let y = 0; y < h; y += 16)
      for (let x = (y / 16) % 2 ? -16 : 0; x < w; x += 32) {
        g.fillStyle = `rgb(${66 + r() * 22},${60 + r() * 18},${56 + r() * 16})`
        g.fillRect(x + 1, y + 1, 30, 14)
      }
  })
}

const textures = {
  facade: null as THREE.Texture | null,
  steel: null as THREE.Texture | null,
  whiteSteel: null as THREE.Texture | null,
  siding: null as THREE.Texture | null,
  shingles: null as THREE.Texture | null,
}

function tex<K extends keyof typeof textures>(k: K, make: () => THREE.Texture) {
  if (!textures[k]) textures[k] = make()
  return textures[k]!
}

/** A copy of a shared texture repeated `x` by `y` times (each mesh needs its own repeat). */
function tiled(t: THREE.Texture, x: number, y: number) {
  const c = t.clone()
  c.repeat.set(x, y)
  c.needsUpdate = true
  return c
}

let groundMats: { gravel: THREE.MeshStandardMaterial; asphalt: THREE.MeshStandardMaterial; concrete: THREE.MeshStandardMaterial; membrane: THREE.MeshStandardMaterial; fence: THREE.MeshStandardMaterial; galv: THREE.MeshStandardMaterial } | null = null

/** Materials for the site: gravel, asphalt, concrete, roof membrane, chain-link, galvanised steel. */
export function siteMats() {
  if (groundMats) return groundMats
  const gravel = paint(256, 256, (g, w, h) => speckle(g, w, h, '#8d8a84', 9000, 0.35, 0.4, 5, 3))
  gravel.repeat.set(6, 6)
  const asphalt = paint(256, 256, (g, w, h) => speckle(g, w, h, '#3b3d40', 7000, 0.18, 0.35, 8, 2))
  asphalt.repeat.set(1, 10)
  const concrete = paint(256, 256, (g, w, h) => speckle(g, w, h, '#b9b5ad', 3000, 0.12, 0.12, 11))
  const membrane = paint(256, 256, (g, w, h) => {
    speckle(g, w, h, '#77797c', 2500, 0.1, 0.15, 13)
    g.strokeStyle = 'rgba(0,0,0,0.2)'
    for (let x = 0; x < w; x += 64) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, h)
      g.stroke()
    }
  })
  membrane.repeat.set(3, 3)
  const chain = paint(128, 128, (g, w) => {
    g.clearRect(0, 0, w, w)
    g.strokeStyle = 'rgba(205,210,215,0.95)'
    g.lineWidth = 2
    for (let i = -w; i < w * 2; i += 16) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i + w, w)
      g.stroke()
      g.beginPath()
      g.moveTo(i + w, 0)
      g.lineTo(i, w)
      g.stroke()
    }
  })
  groundMats = {
    gravel: new THREE.MeshStandardMaterial({ map: gravel, roughness: 1 }),
    asphalt: new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 }),
    concrete: new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.9 }),
    membrane: new THREE.MeshStandardMaterial({ map: membrane, roughness: 0.85 }),
    fence: new THREE.MeshStandardMaterial({ map: chain, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 }),
    galv: new THREE.MeshStandardMaterial({ color: '#a8adb3', metalness: 0.8, roughness: 0.35 }),
  }
  return groundMats
}

// ---------------------------------------------------------------- buildings

/**
 * Office / university block: precast facade with window bays, a roof parapet,
 * a door, rooftop air-conditioning units, and a stair housing.
 */
export function OfficeBuilding({ w, d, floors }: { w: number; d: number; floors: number }) {
  const h = floors * 3.5
  const s = siteMats()
  const facade = useMemo(() => tex('facade', facadeBay), [])
  const front = useMemo(() => tiled(facade, w / 3, floors), [facade, w, floors])
  const side = useMemo(() => tiled(facade, d / 3, floors), [facade, d, floors])
  const wallFront = useMemo(() => new THREE.MeshStandardMaterial({ map: front, roughness: 0.85 }), [front])
  const wallSide = useMemo(() => new THREE.MeshStandardMaterial({ map: side, roughness: 0.85 }), [side])
  const faces = useMemo(() => [wallSide, wallSide, s.membrane, s.concrete, wallFront, wallFront], [wallSide, wallFront, s])
  return (
    <group>
      <mesh material={faces} position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* Parapet round the roof */}
      {[
        [0, d / 2, w, 0.25],
        [0, -d / 2, w, 0.25],
        [w / 2, 0, 0.25, d],
        [-w / 2, 0, 0.25, d],
      ].map(([x, z, sx, sz], i) => (
        <mesh key={i} material={s.concrete} position={[x, h + 0.45, z]}>
          <boxGeometry args={[sx + 0.25, 0.9, sz + 0.25]} />
        </mesh>
      ))}
      {/* Entrance: glass door with a canopy */}
      <mesh material={mats().glass} position={[0, 1.2, d / 2 + 0.02]}>
        <planeGeometry args={[2.2, 2.4]} />
      </mesh>
      <mesh material={s.concrete} position={[0, 2.7, d / 2 + 0.8]}>
        <boxGeometry args={[3.4, 0.2, 1.6]} />
      </mesh>
      {/* Rooftop plant: two AC units and the stair housing */}
      {[-w * 0.3, w * 0.05].map((x) => (
        <AcUnit key={x} position={[x, h, -d * 0.2]} />
      ))}
      <mesh material={s.concrete} position={[w * 0.32, h + 1.3, d * 0.25]}>
        <boxGeometry args={[2.4, 2.6, 2.6]} />
      </mesh>
    </group>
  )
}

/** Rooftop air-conditioning unit: grey box, louvres, a fan on top. */
export function AcUnit({ position }: { position: [number, number, number] }) {
  const s = siteMats()
  const fan = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (fan.current) fan.current.rotation.y += dt * 9
  })
  return (
    <group position={position}>
      <mesh material={s.galv} position={[0, 0.7, 0]}>
        <boxGeometry args={[2.2, 1.4, 1.4]} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} material={mats().anodised} position={[-0.9 + i * 0.36, 0.7, 0.71]}>
          <boxGeometry args={[0.2, 1.1, 0.02]} />
        </mesh>
      ))}
      <mesh material={mats().anodised} position={[0.4, 1.41, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.04, 24]} />
      </mesh>
      <mesh ref={fan} material={mats().aluminium} position={[0.4, 1.44, 0]}>
        <boxGeometry args={[0.9, 0.02, 0.12]} />
      </mesh>
    </group>
  )
}

/** Steel-clad operations building with a shallow roof, door and vents (remote sites). */
export function OpsBuilding({ w, d, h = 3.6, color = '#7f8a8f' }: { w: number; d: number; h?: number; color?: string }) {
  const s = siteMats()
  const steel = useMemo(() => tex(color === '#e9ecef' ? 'whiteSteel' : 'steel', () => corrugated(color)), [color])
  const front = useMemo(() => tiled(steel, w / 4, 1), [steel, w])
  const side = useMemo(() => tiled(steel, d / 4, 1), [steel, d])
  const faces = useMemo(() => {
    const f = new THREE.MeshStandardMaterial({ map: front, metalness: 0.5, roughness: 0.5 })
    const sd = new THREE.MeshStandardMaterial({ map: side, metalness: 0.5, roughness: 0.5 })
    return [sd, sd, s.membrane, s.concrete, f, f]
  }, [front, side, s])
  return (
    <group>
      <mesh material={s.concrete} position={[0, 0.15, 0]}>
        <boxGeometry args={[w + 0.8, 0.3, d + 0.8]} />
      </mesh>
      <mesh material={faces} position={[0, 0.3 + h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <mesh material={s.galv} position={[0, 0.3 + h + 0.1, 0]}>
        <boxGeometry args={[w + 0.4, 0.2, d + 0.4]} />
      </mesh>
      {/* Door, wall vents, a small window, and the cable entry */}
      <mesh material={mats().anodised} position={[-w * 0.25, 1.35, d / 2 + 0.02]}>
        <planeGeometry args={[1, 2.1]} />
      </mesh>
      <mesh material={mats().glass} position={[w * 0.2, 2, d / 2 + 0.02]}>
        <planeGeometry args={[1.4, 0.9]} />
      </mesh>
      {[0.25, 0.4].map((k) => (
        <mesh key={k} material={mats().black} position={[w / 2 + 0.02, h * k + 1, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.6, 0.4]} />
        </mesh>
      ))}
    </group>
  )
}

/** The radio amateur's house: siding walls, a pitched shingle roof, windows and a porch. */
export function House() {
  const sideTex = useMemo(() => tex('siding', siding), [])
  const roofTex = useMemo(() => tex('shingles', shingles), [])
  const wall = useMemo(() => new THREE.MeshStandardMaterial({ map: tiled(sideTex, 3, 1), roughness: 0.8 }), [sideTex])
  const roof = useMemo(() => new THREE.MeshStandardMaterial({ map: tiled(roofTex, 4, 2), roughness: 0.9, side: THREE.DoubleSide }), [roofTex])
  const W = 9
  const D = 7
  const H = 3
  const ridge = 2.2
  const roofGeo = useMemo(() => {
    // A gable roof: two sloped panels meeting at the ridge, with eaves.
    const g = new THREE.BufferGeometry()
    const e = 0.5
    const x = W / 2 + e
    const z = D / 2 + e
    const v = new Float32Array([
      -x, 0, z, x, 0, z, x, ridge, 0, -x, 0, z, x, ridge, 0, -x, ridge, 0,
      -x, 0, -z, -x, ridge, 0, x, ridge, 0, -x, 0, -z, x, ridge, 0, x, 0, -z,
    ])
    const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0])
    g.setAttribute('position', new THREE.BufferAttribute(v, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    g.computeVertexNormals()
    return g
  }, [])
  // Gable ends: triangles at the two ends of the ridge (the ridge runs along x)
  const gable = useMemo(() => {
    const sh = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, ridge)])
    return new THREE.ShapeGeometry(sh)
  }, [])
  return (
    <group>
      <mesh material={wall} position={[0, H / 2, 0]}>
        <boxGeometry args={[W, H, D]} />
      </mesh>
      {[W / 2, -W / 2].map((x) => (
        <mesh key={x} geometry={gable} material={wall} position={[x, H, 0]} rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} />
      ))}
      <mesh geometry={roofGeo} material={roof} position={[0, H, 0]} />
      {/* Windows with white frames, front door, porch step, chimney */}
      {[-2.8, 2.8].map((x) => (
        <group key={x} position={[x, 1.6, D / 2 + 0.02]}>
          <mesh material={mats().whitePaint}>
            <planeGeometry args={[1.5, 1.3]} />
          </mesh>
          <mesh material={mats().glass} position={[0, 0, 0.01]}>
            <planeGeometry args={[1.3, 1.1]} />
          </mesh>
        </group>
      ))}
      <mesh material={new THREE.MeshStandardMaterial({ color: '#7a3b2a', roughness: 0.7 })} position={[0, 1.05, D / 2 + 0.02]}>
        <planeGeometry args={[1, 2.1]} />
      </mesh>
      <mesh material={siteMats().concrete} position={[0, 0.1, D / 2 + 0.6]}>
        <boxGeometry args={[2, 0.2, 1.2]} />
      </mesh>
      <mesh material={new THREE.MeshStandardMaterial({ color: '#8a5a44', roughness: 0.9 })} position={[2.4, H + ridge * 0.7, -1]}>
        <boxGeometry args={[0.7, 1.8, 0.7]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------- antennas

/** Parabolic reflector, y = r² / 4f, as a lathe; opens toward +y. */
function useReflector(radius: number, f: number) {
  return useMemo(() => {
    const pts = Array.from({ length: 28 }, (_, i) => {
      const r = Math.max(0.0001, (radius * i) / 27)
      return new THREE.Vector2(r, (r * r) / (4 * f))
    })
    return new THREE.LatheGeometry(pts, 72)
  }, [radius, f])
}

/** Panel seams on the dish surface (rings and radial lines), like a real segmented reflector. */
function usePanelMat() {
  return useMemo(() => {
    const t = paint(512, 512, (g, w, h) => {
      g.fillStyle = '#eef0f2'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = 'rgba(120,128,140,0.35)'
      g.lineWidth = 2
      for (let x = 0; x < w; x += w / 24) {
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, h)
        g.stroke()
      }
      for (const y of [0.35, 0.65, 0.88]) {
        g.beginPath()
        g.moveTo(0, y * h)
        g.lineTo(w, y * h)
        g.stroke()
      }
    })
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide })
  }, [])
}

/**
 * A tracking dish on an alt-azimuth mount, built like real ones: concrete
 * plinth with steps and a railing, a pedestal with a door, the azimuth
 * turntable, the elevation gearbox with a counterweight, a ribbed backing
 * structure, four feed struts and a Cassegrain sub-reflector.
 * `radius` is the reflector radius in metres. It slowly tracks a pass.
 */
export function TrackingDish({ radius, phase = 0, beam = false, plinth = true }: { radius: number; phase?: number; beam?: boolean; plinth?: boolean }) {
  const m = mats()
  const s = siteMats()
  const f = radius * 0.42
  const depth = (radius * radius) / (4 * f)
  const reflector = useReflector(radius, f)
  const panel = usePanelMat()
  const backing = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide }), [])
  const backingFrame = useMemo(() => new THREE.MeshBasicMaterial({ color: '#7d838c', wireframe: true }), [])
  const az = useRef<THREE.Group>(null)
  const el = useRef<THREE.Group>(null)
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#8fd8ff', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [])
  useFrame(({ clock }) => {
    const k = (clock.elapsedTime * 0.05 + phase) % 1
    if (az.current) az.current.rotation.y = -1.1 + k * 2.2
    if (el.current) el.current.rotation.x = 0.35 + Math.sin(k * Math.PI) * 0.8 // tilt the -z-facing dish up toward the sky
  })
  const pedH = radius * 0.95
  const base = plinth ? 0.6 : 0
  return (
    <group>
      {plinth && (
        <>
          <mesh material={s.concrete} position={[0, 0.3, 0]}>
            <boxGeometry args={[radius * 1.6, 0.6, radius * 1.6]} />
          </mesh>
          {/* Steps up the front, and a railing round the edge */}
          {[0, 1, 2].map((i) => (
            <mesh key={i} material={s.concrete} position={[0, 0.1 + i * 0.2, radius * 0.8 + 0.6 - i * 0.3]}>
              <boxGeometry args={[1.2, 0.2, 0.3]} />
            </mesh>
          ))}
          <Railing w={radius * 1.6} d={radius * 1.6} y={0.6} gap={1.2} />
        </>
      )}
      {/* Pedestal with an access door and the azimuth bearing */}
      <mesh material={m.whitePaint} position={[0, base + pedH / 2, 0]}>
        <cylinderGeometry args={[radius * 0.2, radius * 0.27, pedH, 24]} />
      </mesh>
      <mesh material={m.anodised} position={[0, base + pedH * 0.3, radius * 0.245]}>
        <boxGeometry args={[0.7, 1.7, 0.05]} />
      </mesh>
      <mesh material={s.galv} position={[0, base + pedH + 0.1, 0]}>
        <cylinderGeometry args={[radius * 0.25, radius * 0.25, 0.2, 32]} />
      </mesh>
      <group ref={az} position={[0, base + pedH + 0.2, 0]}>
        {/* Elevation gearbox and the two yoke arms */}
        <mesh material={m.whitePaint} position={[0, radius * 0.15, 0]}>
          <boxGeometry args={[radius * 0.5, radius * 0.3, radius * 0.4]} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} material={m.whitePaint} position={[sx * radius * 0.3, radius * 0.38, 0]}>
            <boxGeometry args={[radius * 0.08, radius * 0.5, radius * 0.25]} />
          </mesh>
        ))}
        <group ref={el} position={[0, radius * 0.55, 0]}>
          {/* Counterweight behind the axis */}
          <mesh material={m.anodised} position={[0, -radius * 0.05, radius * 0.45]}>
            <boxGeometry args={[radius * 0.45, radius * 0.25, radius * 0.25]} />
          </mesh>
          {/* The reflector opens along -z (rotated from +y), hub on the axis */}
          <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -radius * 0.15]}>
            <mesh geometry={reflector} material={panel} />
            {/* Backing structure: hub and radial ribs behind the surface */}
            <mesh material={m.aluminium} position={[0, -radius * 0.08, 0]}>
              <cylinderGeometry args={[radius * 0.16, radius * 0.22, radius * 0.18, 16]} />
            </mesh>
            {/* Backing structure: a steel truss cone behind the surface, out to 70% of the rim */}
            <mesh material={backing} position={[0, (0.49 * depth - radius * 0.06 - radius * 0.12) / 2, 0]}>
              <cylinderGeometry args={[radius * 0.68, radius * 0.22, 0.49 * depth - radius * 0.06 + radius * 0.12, 24, 1, true]} />
            </mesh>
            <mesh material={backingFrame} position={[0, (0.49 * depth - radius * 0.06 - radius * 0.12) / 2, 0]}>
              <cylinderGeometry args={[radius * 0.685, radius * 0.225, 0.49 * depth - radius * 0.06 + radius * 0.12, 12, 2, true]} />
            </mesh>
            {/* Quadripod: four struts from the rim to the sub-reflector at the focus */}
            {[0, 1, 2, 3].map((i) => {
              const a = (i / 4) * Math.PI * 2 + Math.PI / 4
              const rimR = radius * 0.82
              const rimY = (rimR * rimR) / (4 * f)
              const top = new THREE.Vector3(0, f * 0.92, 0)
              const foot = new THREE.Vector3(Math.cos(a) * rimR, rimY, Math.sin(a) * rimR)
              const mid = top.clone().add(foot).multiplyScalar(0.5)
              const dir = top.clone().sub(foot)
              const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
              return (
                <mesh key={i} material={m.whitePaint} position={mid} quaternion={q}>
                  <cylinderGeometry args={[radius * 0.018, radius * 0.018, dir.length(), 8]} />
                </mesh>
              )
            })}
            <mesh material={m.whitePaint} position={[0, f * 0.95, 0]} rotation={[Math.PI, 0, 0]}>
              <cylinderGeometry args={[radius * 0.12, radius * 0.04, radius * 0.05, 24]} />
            </mesh>
            {/* Feed horn at the centre */}
            <mesh material={m.aluminium} position={[0, depth * 0.1 + radius * 0.12, 0]}>
              <cylinderGeometry args={[radius * 0.05, radius * 0.08, radius * 0.25, 20]} />
            </mesh>
            {beam && (
              <mesh material={beamMat} position={[0, radius * 9, 0]}>
                <cylinderGeometry args={[radius * 1.6, radius * 0.9, radius * 17, 32, 1, true]} />
              </mesh>
            )}
          </group>
        </group>
      </group>
    </group>
  )
}

/** Two crossed Yagi antennas on a tower with a rotator, held up by guy wires. */
export function YagiMast({ height, phase = 0, guys = true }: { height: number; phase?: number; guys?: boolean }) {
  const m = mats()
  const s = siteMats()
  const head = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const k = (clock.elapsedTime * 0.05 + phase) % 1
    if (head.current) {
      head.current.rotation.y = -1.1 + k * 2.2
      head.current.rotation.z = 0.15 + Math.sin(k * Math.PI) * 0.7
    }
  })
  const boom = 2.6
  return (
    <group>
      {/* Lattice tower: three legs and zig-zag bracing */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} material={s.galv} position={[Math.cos(a) * 0.22, height / 2, Math.sin(a) * 0.22]}>
            <cylinderGeometry args={[0.025, 0.025, height, 6]} />
          </mesh>
        )
      })}
      {Array.from({ length: Math.floor(height / 0.6) }, (_, i) => (
        <mesh key={i} material={s.galv} position={[0, 0.3 + i * 0.6, 0]} rotation={[0, (i * Math.PI) / 3, 0]}>
          <torusGeometry args={[0.22, 0.012, 4, 3]} />
        </mesh>
      ))}
      {guys &&
        [0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + 0.5
          const top = new THREE.Vector3(0, height * 0.8, 0)
          const foot = new THREE.Vector3(Math.cos(a) * height * 0.6, 0, Math.sin(a) * height * 0.6)
          const mid = top.clone().add(foot).multiplyScalar(0.5)
          const dir = top.clone().sub(foot)
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
          return (
            <mesh key={i} material={m.anodised} position={mid} quaternion={q}>
              <cylinderGeometry args={[0.008, 0.008, dir.length(), 4]} />
            </mesh>
          )
        })}
      <mesh material={m.anodised} position={[0, height + 0.15, 0]}>
        <boxGeometry args={[0.35, 0.3, 0.35]} />
      </mesh>
      <group ref={head} position={[0, height + 0.5, 0]}>
        <mesh material={m.aluminium} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.4, 8]} />
        </mesh>
        {[-0.6, 0.6].map((z) => (
          <group key={z} position={[0, 0, z]}>
            <mesh material={m.aluminium} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.02, 0.02, boom, 8]} />
            </mesh>
            {Array.from({ length: 11 }, (_, i) => {
              const len = 0.36 - i * 0.012
              return (
                <group key={i} position={[-boom / 2 + 0.1 + i * 0.24, 0, 0]}>
                  <mesh material={m.rail}>
                    <cylinderGeometry args={[0.006, 0.006, len, 4]} />
                  </mesh>
                  <mesh material={m.rail} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.006, 0.006, len, 4]} />
                  </mesh>
                </group>
              )
            })}
          </group>
        ))}
      </group>
    </group>
  )
}

/** Radome: a faceted geodesic sphere of panels on a short building, with a door. */
export function Radome({ radius }: { radius: number }) {
  const m = mats()
  const s = siteMats()
  const shell = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f3f4f2', roughness: 0.6, flatShading: true }), [])
  const seams = useMemo(() => new THREE.MeshBasicMaterial({ color: '#b9bec6', wireframe: true, transparent: true, opacity: 0.55 }), [])
  const baseH = radius * 0.7
  return (
    <group>
      <OpsBuilding w={radius * 1.7} d={radius * 1.7} h={baseH} color="#e9ecef" />
      {/* Ring beam the dome sits on */}
      <mesh material={s.galv} position={[0, 0.3 + baseH + 0.15, 0]}>
        <cylinderGeometry args={[radius * 0.86, radius * 0.86, 0.3, 48]} />
      </mesh>
      <group position={[0, 0.3 + baseH + radius * 0.45, 0]}>
        <mesh material={shell}>
          <icosahedronGeometry args={[radius, 3]} />
        </mesh>
        <mesh material={seams}>
          <icosahedronGeometry args={[radius * 1.002, 3]} />
        </mesh>
      </group>
      {/* Aircraft warning light on top */}
      <mesh position={[0, 0.3 + baseH + radius * 1.47, 0]}>
        <sphereGeometry args={[0.15, 12, 8]} />
        <meshBasicMaterial color="#ff4a3a" />
      </mesh>
      <mesh material={m.anodised} position={[0, 0.3 + baseH + radius * 1.4, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 6]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------- site details

/** Pipe railing round a rectangle (open at the front, where the steps are). */
function Railing({ w, d, y, gap = 0 }: { w: number; d: number; y: number; gap?: number }) {
  const s = siteMats()
  const h = 1.05
  const sides: [number, number, number, number][] = [
    [0, -d / 2, w, 0],
    [-w / 2, 0, d, Math.PI / 2],
    [w / 2, 0, d, Math.PI / 2],
  ]
  // Front: two halves with a gap for the steps
  const half = (w - gap) / 2
  sides.push([-(gap / 2 + half / 2), d / 2, half, 0], [gap / 2 + half / 2, d / 2, half, 0])
  return (
    <group position={[0, y, 0]}>
      {sides.map(([x, z, len, rot], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, rot, 0]}>
          {[h, h * 0.5].map((ry) => (
            <mesh key={ry} material={s.galv} position={[0, ry, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, len, 6]} />
            </mesh>
          ))}
          {range(Math.max(2, Math.round(len / 1.5) + 1)).map((k, _i, arr) => (
            <mesh key={k} material={s.galv} position={[-len / 2 + (len * k) / (arr.length - 1), h / 2, 0]}>
              <cylinderGeometry args={[0.025, 0.025, h, 6]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Chain-link security fence round a rectangle, with a gate gap at the front. */
export function Fence({ w, d, gate = 6 }: { w: number; d: number; gate?: number }) {
  const s = siteMats()
  const h = 2.2
  const runs: [number, number, number, number][] = [
    [0, -d / 2, w, 0],
    [-w / 2, 0, d, Math.PI / 2],
    [w / 2, 0, d, Math.PI / 2],
    [-(gate / 2 + (w - gate) / 4), d / 2, (w - gate) / 2, 0],
    [gate / 2 + (w - gate) / 4, d / 2, (w - gate) / 2, 0],
  ]
  return (
    <group>
      {runs.map(([x, z, len, rot], i) => {
        const mesh = s.fence.clone()
        mesh.map = s.fence.map!.clone()
        mesh.map.repeat.set(len / 1.2, h / 1.2)
        mesh.map.needsUpdate = true
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, rot, 0]}>
            <mesh material={mesh} position={[0, h / 2, 0]}>
              <planeGeometry args={[len, h]} />
            </mesh>
            {range(Math.round(len / 3) + 1).map((k, _i, arr) => (
              <mesh key={k} material={s.galv} position={[-len / 2 + (len * k) / Math.max(1, arr.length - 1), h / 2 + 0.1, 0]}>
                <cylinderGeometry args={[0.04, 0.04, h + 0.2, 6]} />
              </mesh>
            ))}
            <mesh material={s.galv} position={[0, h, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.03, len, 6]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** Flat ground pads: gravel round equipment, asphalt for roads. */
export function Pad({ w, d, kind, position = [0, 0, 0], rotation = 0 }: { w: number; d: number; kind: 'gravel' | 'asphalt' | 'concrete'; position?: [number, number, number]; rotation?: number }) {
  const s = siteMats()
  const mat = useMemo(() => {
    const base = s[kind]
    const c = base.clone()
    if (base.map) {
      c.map = base.map.clone()
      c.map.repeat.set(kind === 'asphalt' ? 1 : w / 4, kind === 'asphalt' ? d / 6 : d / 4)
      c.map.needsUpdate = true
    }
    return c
  }, [s, kind, w, d])
  return (
    <mesh material={mat} position={[position[0], 0.02 + (kind === 'concrete' ? 0.03 : 0), position[2]]} rotation={[-Math.PI / 2, 0, rotation]}>
      <planeGeometry args={[w, d]} />
    </mesh>
  )
}

/** Outdoor equipment cabinet with a door, vents and a status lamp. */
export function Cabinet({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const s = siteMats()
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={s.concrete} position={[0, 0.08, 0]}>
        <boxGeometry args={[1.1, 0.16, 0.8]} />
      </mesh>
      <mesh material={s.galv} position={[0, 0.96, 0]}>
        <boxGeometry args={[0.9, 1.6, 0.6]} />
      </mesh>
      <mesh material={mats().anodised} position={[0, 1.2, 0.302]}>
        <planeGeometry args={[0.5, 0.25]} />
      </mesh>
      <mesh position={[0.32, 1.6, 0.31]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshBasicMaterial color="#3ddc97" />
      </mesh>
    </group>
  )
}

/** Site floodlight on a pole. */
export function LightPole({ position, height = 7 }: { position: [number, number, number]; height?: number }) {
  const s = siteMats()
  return (
    <group position={position}>
      <mesh material={s.galv} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.1, height, 8]} />
      </mesh>
      <mesh material={s.galv} position={[0.35, height, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.8, 6]} />
      </mesh>
      <mesh material={mats().anodised} position={[0.75, height - 0.05, 0]}>
        <boxGeometry args={[0.45, 0.12, 0.3]} />
      </mesh>
    </group>
  )
}

/** Cable tray on short posts, between an antenna and its building. */
export function CableTray({ from, to }: { from: [number, number]; to: [number, number] }) {
  const s = siteMats()
  const dx = to[0] - from[0]
  const dz = to[1] - from[1]
  const len = Math.hypot(dx, dz)
  const ang = Math.atan2(dz, dx)
  return (
    <group position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]} rotation={[0, -ang, 0]}>
      <mesh material={s.galv} position={[0, 0.55, 0]}>
        <boxGeometry args={[len, 0.08, 0.35]} />
      </mesh>
      {range(Math.max(2, Math.round(len / 2.5))).map((k, _i, arr) => (
        <mesh key={k} material={s.galv} position={[-len / 2 + (len * k) / (arr.length - 1), 0.27, 0]}>
          <boxGeometry args={[0.06, 0.55, 0.06]} />
        </mesh>
      ))}
    </group>
  )
}
