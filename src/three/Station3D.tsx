/**
 * Ground station in 3D (Ground tab). Each station type gets real hardware:
 *   amateur  – crossed Yagi UHF antennas on a rotator mast, next to a shed
 *   campus   – a 3 m dish and a Yagi on the roof of a university building
 *   polar    – radomes and a big open dish
 *   network  – a commercial antenna farm with several dishes
 * Dishes slew to track a pass, and a faint beam shows the downlink when the
 * station is part of your plan. The mountain photo is the backdrop at every site.
 */
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GroundStation as Station } from '@/engine/types'
import { grassTexture, mats, meadowPatches } from './materials'
import { SpaceLights } from './Stage'

type Kind = 'amateur' | 'campus' | 'polar' | 'network'
const kindOf = (st: Station): Kind => (st.id.includes('amateur') ? 'amateur' : st.id.includes('campus') ? 'campus' : st.id.includes('polar') ? 'polar' : 'network')

/** Parabolic reflector: y = r² / 4f, as a lathe. */
function useDishGeometry(radius: number) {
  return useMemo(() => {
    const f = radius * 0.45
    const pts = Array.from({ length: 24 }, (_, i) => {
      const r = (radius * i) / 23
      return new THREE.Vector2(r, (r * r) / (4 * f))
    })
    return new THREE.LatheGeometry(pts, 64)
  }, [radius])
}

const dishMat = () => {
  const m = mats().whitePaint.clone()
  m.side = THREE.DoubleSide
  return m
}

/** A dish on an alt-az pedestal. `phase` offsets its tracking motion so a farm doesn't move in lockstep. */
function Dish({ radius, phase = 0, beam = false }: { radius: number; phase?: number; beam?: boolean }) {
  const m = mats()
  const geo = useDishGeometry(radius)
  const white = useMemo(dishMat, [])
  const az = useRef<THREE.Group>(null)
  const el = useRef<THREE.Group>(null)
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#7fd4ff', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [])
  // Follow a pass: sweep across the sky in azimuth, rise and set in elevation.
  useFrame(({ clock }) => {
    const k = (clock.elapsedTime * 0.08 + phase) % 1
    if (az.current) az.current.rotation.y = -1.2 + k * 2.4
    if (el.current) el.current.rotation.x = 0.25 + Math.sin(k * Math.PI) * 0.9
  })
  const ped = radius * 1.1
  return (
    <group>
      {/* Concrete footing and pedestal */}
      <mesh material={m.aluminium} position={[0, radius * 0.05, 0]}>
        <cylinderGeometry args={[radius * 0.55, radius * 0.6, radius * 0.1, 24]} />
      </mesh>
      <mesh material={m.whitePaint} position={[0, ped / 2, 0]}>
        <cylinderGeometry args={[radius * 0.16, radius * 0.24, ped, 20]} />
      </mesh>
      <group ref={az} position={[0, ped, 0]}>
        {/* Yoke */}
        {[-1, 1].map((s) => (
          <mesh key={s} material={m.whitePaint} position={[s * radius * 0.28, radius * 0.18, 0]}>
            <boxGeometry args={[radius * 0.08, radius * 0.4, radius * 0.18]} />
          </mesh>
        ))}
        <group ref={el} position={[0, radius * 0.32, 0]}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <mesh geometry={geo} material={white} rotation={[Math.PI, 0, 0]} position={[0, radius * 0.1, 0]} />
            {/* Feed on three struts at the focus */}
            {[0, 1, 2].map((i) => (
              <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]} position={[0, -radius * 0.25, 0]}>
                <group position={[radius * 0.45, 0, 0]} rotation={[0, 0, 0.9]}>
                  <mesh material={m.aluminium}>
                    <cylinderGeometry args={[radius * 0.012, radius * 0.012, radius * 0.75, 6]} />
                  </mesh>
                </group>
              </group>
            ))}
            <mesh material={m.orange} position={[0, -radius * 0.45, 0]}>
              <cylinderGeometry args={[radius * 0.06, radius * 0.09, radius * 0.16, 16]} />
            </mesh>
            {beam && (
              <mesh material={beamMat} position={[0, -radius * 6, 0]}>
                <cylinderGeometry args={[radius * 2.2, radius * 0.5, radius * 11, 32, 1, true]} />
              </mesh>
            )}
          </group>
        </group>
      </group>
    </group>
  )
}

/** Crossed Yagi antennas (UHF) on a mast with a rotator. */
function Yagi({ height, phase = 0 }: { height: number; phase?: number }) {
  const m = mats()
  const head = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const k = (clock.elapsedTime * 0.08 + phase) % 1
    if (head.current) {
      head.current.rotation.y = -1.2 + k * 2.4
      head.current.rotation.z = 0.2 + Math.sin(k * Math.PI) * 0.7
    }
  })
  const boom = height * 0.55
  return (
    <group>
      <mesh material={m.rail} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[height * 0.015, height * 0.02, height, 8]} />
      </mesh>
      <mesh material={m.anodised} position={[0, height, 0]}>
        <boxGeometry args={[height * 0.06, height * 0.06, height * 0.06]} />
      </mesh>
      <group ref={head} position={[0, height * 1.03, 0]}>
        {[-1, 1].map((side) => (
          <group key={side} position={[0, 0, side * height * 0.08]}>
            <mesh material={m.aluminium} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[height * 0.008, height * 0.008, boom, 6]} />
            </mesh>
            {Array.from({ length: 9 }, (_, i) => (
              <group key={i} position={[-boom / 2 + (i + 0.5) * (boom / 9), 0, 0]}>
                <mesh material={m.rail}>
                  <cylinderGeometry args={[height * 0.003, height * 0.003, height * (0.2 - i * 0.008), 4]} />
                </mesh>
                <mesh material={m.rail} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[height * 0.003, height * 0.003, height * (0.2 - i * 0.008), 4]} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>
    </group>
  )
}

/** Geodesic radome hiding a dish from Arctic wind. */
function Radome({ radius }: { radius: number }) {
  const m = mats()
  return (
    <group>
      <mesh material={m.whitePaint} position={[0, radius * 0.4, 0]}>
        <cylinderGeometry args={[radius * 0.7, radius * 0.75, radius * 0.8, 24]} />
      </mesh>
      <mesh material={m.capsule} position={[0, radius * 0.8 + radius * 0.85, 0]}>
        <icosahedronGeometry args={[radius, 2]} />
      </mesh>
      <mesh position={[0, radius * 0.8 + radius * 0.85, 0]}>
        <icosahedronGeometry args={[radius * 1.003, 2]} />
        <meshBasicMaterial color="#9aa3b5" wireframe transparent opacity={0.45} />
      </mesh>
    </group>
  )
}

function Building({ w, h, d, roof = false }: { w: number; h: number; d: number; roof?: boolean }) {
  const m = mats()
  return (
    <group>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#c9c3b6" roughness={0.9} />
      </mesh>
      {/* Window rows */}
      {Array.from({ length: Math.max(1, Math.floor(h / 3.2)) }, (_, i) => (
        <mesh key={i} material={m.glass} position={[0, 2 + i * 3.2, d / 2 + 0.01]}>
          <planeGeometry args={[w * 0.85, 1.1]} />
        </mesh>
      ))}
      {roof && (
        <mesh material={m.anodised} position={[0, h + 0.15, 0]}>
          <boxGeometry args={[w * 1.02, 0.3, d * 1.02]} />
        </mesh>
      )}
    </group>
  )
}

/**
 * The photo backdrop, wrapped round the station on a giant cylinder (a film-set
 * cyclorama) instead of sitting flat behind the canvas. It's part of the 3D
 * world, so zooming and turning move it with the ground and the two always fit.
 * The photo's horizon row sits exactly at ground level; its top fades into the sky.
 */
interface Backdrop {
  url: string
  /** Width / height of the photo. */
  aspect: number
  /** How far down the photo the horizon (ground line) is, 0..1. */
  horizon: number
  /** Sky colour at the top of the photo, and the ground colour at its horizon (for the haze). */
  sky: string
  haze: string
}

const BACKDROPS: Record<'grass' | 'mountains', Backdrop> = {
  grass: { url: '/assets/bg/grassland.jpg', aspect: 468 / 312, horizon: 0.47, sky: '#556590', haze: '#5a6125' },
  mountains: { url: '/assets/bg/mountains.webp', aspect: 1510 / 1080, horizon: 0.88, sky: '#2f6fab', haze: '#555126' },
}

const RING = 600 // backdrop radius, metres
const REPEATS = 4 // photo copies round the circle (mirrored, so the joins match)

function Cyclorama({ b }: { b: Backdrop }) {
  const map = useMemo(() => {
    const t = new THREE.TextureLoader().load(b.url)
    t.wrapS = THREE.MirroredRepeatWrapping
    t.repeat.set(REPEATS, 1)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [b.url])
  // Top of the photo fades out into the plain sky colour.
  const fade = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 256
    const g = c.getContext('2d')!
    const grd = g.createLinearGradient(0, 0, 0, 256)
    grd.addColorStop(0, '#000')
    grd.addColorStop(0.18, '#fff')
    grd.addColorStop(1, '#fff')
    g.fillStyle = grd
    g.fillRect(0, 0, 4, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  const width = (2 * Math.PI * RING) / REPEATS
  const height = width / b.aspect
  const top = b.horizon * height
  return (
    <mesh position={[0, top - height / 2, 0]}>
      <cylinderGeometry args={[RING, RING, height, 128, 1, true]} />
      <meshBasicMaterial map={map} alphaMap={fade} transparent side={THREE.BackSide} fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

function Scene({ kind, active }: { kind: Kind; active: boolean }) {
  // The mountain backdrop behind every station (the team's favourite).
  const b = BACKDROPS.mountains
  const grass = useMemo(() => grassTexture(160), [])
  const patches = useMemo(() => meadowPatches(), [])
  return (
    <>
      <SpaceLights photoBackdrop />
      <color attach="background" args={[b.sky]} />
      {/* Haze: the ground fades into the photo's own horizon colour where they meet */}
      <fog attach="fog" args={[b.haze, RING * 0.18, RING * 0.97]} />
      <Cyclorama b={b} />
      {/* Real grass out to the backdrop; frosty at the polar site */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[RING, 96]} />
        <meshStandardMaterial map={grass} roughness={1} />
      </mesh>
      {/* Darker patches across the meadow, like real fields (and they hide the tile repeat) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[RING, 96]} />
        <meshBasicMaterial color="#26300d" alphaMap={patches} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {kind === 'amateur' && (
        <>
          <group position={[-2, 0, 0]}>
            <Yagi height={7} />
          </group>
          <group position={[4, 0, -2]}>
            <Building w={5} h={3} d={4} roof />
          </group>
        </>
      )}
      {kind === 'campus' && (
        <>
          <Building w={13} h={7} d={9} roof />
          <group position={[-2.5, 7.3, 0]}>
            <Dish radius={2.2} beam={active} />
          </group>
          <group position={[4, 7.3, 1.5]}>
            <Yagi height={4} phase={0.2} />
          </group>
        </>
      )}
      {kind === 'polar' && (
        <>
          <group position={[-9, 0, -4]}>
            <Radome radius={3.5} />
          </group>
          <group position={[9, 0, -6]}>
            <Radome radius={2.8} />
          </group>
          <group position={[0, 0, 2]}>
            <Dish radius={5.5} beam={active} />
          </group>
          <group position={[12, 0, 6]}>
            <Building w={6} h={3.5} d={5} roof />
          </group>
        </>
      )}
      {kind === 'network' && (
        <>
          {[
            [-10, 0, 0, 4.5, 0],
            [0, 0, -5, 6, 0.3],
            [10, 0, 1, 3.5, 0.55],
            [3, 0, 9, 2.5, 0.75],
          ].map(([x, y, z, r, ph], i) => (
            <group key={i} position={[x, y, z]}>
              <Dish radius={r} phase={ph} beam={active && i === 1} />
            </group>
          ))}
          <group position={[-12, 0, 11]}>
            <Building w={10} h={4} d={6} roof />
          </group>
        </>
      )}
    </>
  )
}

export default function Station3D({ station, active }: { station: Station; active: boolean }) {
  const kind = kindOf(station)
  // Low cameras looking almost level, so the mountains fill the background.
  const cam: Record<Kind, [number, number, number]> = { amateur: [10, 3, 15], campus: [16, 9, 22], polar: [26, 6, 32], network: [30, 7, 36] }
  const target: Record<Kind, [number, number, number]> = { amateur: [0, 4.5, 0], campus: [0, 9, 0], polar: [0, 7, 0], network: [0, 6, 0] }
  return (
    <div className="relative h-[260px] w-full overflow-hidden rounded-xl border border-space-700 sm:h-[360px]">
      <Canvas key={kind} dpr={[1, 2]} camera={{ fov: 38, position: cam[kind], near: 0.1, far: RING * 3 }} aria-label={`3D model of the ${station.name}`}>
        <Scene kind={kind} active={active} />
        <OrbitControls makeDefault target={target[kind]} enablePan={false} minDistance={6} maxDistance={60} minPolarAngle={1.33} maxPolarAngle={Math.PI / 2 - 0.04} autoRotate autoRotateSpeed={0.4} />
      </Canvas>
      <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-space-950/70 px-2 py-1 text-[11px] text-muted">
        {station.name} · {station.lat}°, {station.lon}° {active ? '· tracking your craft' : ''}
      </p>
    </div>
  )
}
