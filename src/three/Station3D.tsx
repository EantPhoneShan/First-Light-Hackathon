/**
 * Ground station in 3D (Ground tab), built at real scale with real hardware
 * (see stationParts.tsx) and lit by the sun with shadows:
 *   amateur  – a radio amateur's house with crossed Yagis on a guyed lattice mast
 *   campus   – a university block with a tracking dish and Yagis on the roof
 *   polar    – a fenced site: big tracking dish, two radomes, ops building
 *   network  – a commercial antenna farm: four dishes, ops building, road
 * Dishes slew to track a pass, and a faint beam shows the downlink when the
 * station is part of your plan. The mountain photo is the backdrop at every site.
 */
import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { GroundStation as Station } from '@/engine/types'
import { grassTexture, meadowPatches } from './materials'
import { AcUnit, Cabinet, CableTray, Fence, House, LightPole, OfficeBuilding, OpsBuilding, Pad, Radome, TrackingDish, YagiMast } from './stationParts'
import { SpaceLights } from './Stage'

type Kind = 'amateur' | 'campus' | 'polar' | 'network'
const kindOf = (st: Station): Kind => (st.id.includes('amateur') ? 'amateur' : st.id.includes('campus') ? 'campus' : st.id.includes('polar') ? 'polar' : 'network')

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

/** Every solid mesh casts and receives shadows; glows, beams and the photo backdrop don't. */
function ShadowsOn() {
  const scene = useThree((st) => st.scene)
  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      const lit = !(m instanceof THREE.MeshBasicMaterial) && !(m instanceof THREE.ShaderMaterial)
      if (mesh.castShadow !== lit || mesh.receiveShadow !== lit) {
        mesh.castShadow = lit
        mesh.receiveShadow = lit
        // Receiving shadows is compiled into the shader, so rebuild it.
        for (const mm of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) mm.needsUpdate = true
      }
    })
  })
  return null
}

function Scene({ kind, active }: { kind: Kind; active: boolean }) {
  // The mountain backdrop behind every station (the team's favourite).
  const b = BACKDROPS.mountains
  const grass = useMemo(() => grassTexture(160), [])
  const patches = useMemo(() => meadowPatches(), [])
  return (
    <>
      {/* Outdoor light: one real sun (below, with shadows), soft blue sky and green ground bounce */}
      <SpaceLights photoBackdrop sunOnly />
      <hemisphereLight args={['#bcd4f5', '#56602a', 0.9]} />
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
      {/* The sun, with shadows: the single biggest thing that makes it look solid */}
      <directionalLight
        castShadow
        position={[-50, 55, -12]}
        intensity={3.2}
        color="#fff3e2"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <ShadowsOn />

      {kind === 'amateur' && (
        <>
          <group position={[3, 0, -3]}>
            <House />
          </group>
          <group position={[-5, 0, 2]}>
            <YagiMast height={10} />
          </group>
          <Pad kind="asphalt" w={3.2} d={12} position={[3, 0, 6]} />
          <Pad kind="concrete" w={1.2} d={3} position={[-1, 0, 3]} rotation={0.6} />
          <Cabinet position={[-3.2, 0, 3.5]} rotation={-0.6} />
        </>
      )}
      {kind === 'campus' && (
        <>
          <OfficeBuilding w={24} d={14} floors={3} />
          <group position={[-5, 10.5, -1]}>
            <TrackingDish radius={1.9} beam={active} plinth={false} />
          </group>
          <group position={[6, 10.5, 2]}>
            <YagiMast height={3.5} phase={0.2} guys={false} />
          </group>
          <AcUnit position={[2, 10.5, 4]} />
          <Pad kind="asphalt" w={60} d={7} position={[0, 0, 15]} />
          <Pad kind="concrete" w={3} d={4} position={[0, 0, 10]} />
          <LightPole position={[-14, 0, 12]} />
          <LightPole position={[14, 0, 12]} />
        </>
      )}
      {kind === 'polar' && (
        <>
          <Pad kind="gravel" w={54} d={44} />
          <Fence w={56} d={46} gate={8} />
          <Pad kind="asphalt" w={7} d={40} position={[0, 0, 43]} />
          <TrackingDish radius={6} beam={active} />
          <group position={[-17, 0, -9]}>
            <Radome radius={4.2} />
          </group>
          <group position={[16, 0, -11]}>
            <Radome radius={3.2} />
          </group>
          <group position={[15, 0, 11]}>
            <OpsBuilding w={11} d={7} />
          </group>
          <CableTray from={[4, 2]} to={[10, 10]} />
          <Cabinet position={[-5, 0, 6]} />
          <Cabinet position={[-6.3, 0, 6]} />
          <LightPole position={[-26, 0, 20]} />
          <LightPole position={[26, 0, -20]} />
        </>
      )}
      {kind === 'network' && (
        <>
          <Pad kind="gravel" w={74} d={56} />
          <Fence w={76} d={58} gate={9} />
          <Pad kind="asphalt" w={8} d={40} position={[0, 0, 49]} />
          {[
            [-22, -10, 6.5, 0],
            [4, -14, 8, 0.3],
            [24, -6, 5, 0.55],
            [-8, 10, 4, 0.75],
          ].map(([x, z, r, ph], i) => (
            <group key={i} position={[x, 0, z]}>
              <TrackingDish radius={r} phase={ph} beam={active && i === 1} />
            </group>
          ))}
          <group position={[20, 0, 16]}>
            <OpsBuilding w={14} d={8} h={4} />
          </group>
          <CableTray from={[8, -6]} to={[16, 12]} />
          <CableTray from={[-5, 12]} to={[13, 16]} />
          {[-30, -18].map((x) => (
            <Cabinet key={x} position={[x, 0, 6]} />
          ))}
          <LightPole position={[-36, 0, 27]} />
          <LightPole position={[36, 0, -27]} />
          <LightPole position={[36, 0, 27]} />
        </>
      )}
    </>
  )
}

export default function Station3D({ station, active }: { station: Station; active: boolean }) {
  const kind = kindOf(station)
  // Low cameras looking almost level, so the mountains fill the background.
  const cam: Record<Kind, [number, number, number]> = { amateur: [14, 4, 20], campus: [28, 12, 36], polar: [40, 8, 50], network: [50, 9, 62] }
  const target: Record<Kind, [number, number, number]> = { amateur: [0, 4, 0], campus: [0, 8, 0], polar: [0, 6, 0], network: [0, 6, 0] }
  return (
    <div className="relative h-[260px] w-full overflow-hidden rounded-xl border border-space-700 sm:h-[360px]">
      <Canvas key={kind} shadows dpr={[1, 2]} camera={{ fov: 38, position: cam[kind], near: 0.1, far: RING * 3 }} aria-label={`3D model of the ${station.name}`}>
        <Scene kind={kind} active={active} />
        <OrbitControls makeDefault target={target[kind]} enablePan={false} minDistance={8} maxDistance={90} minPolarAngle={1.3} maxPolarAngle={Math.PI / 2 - 0.04} autoRotate autoRotateSpeed={0.4} />
      </Canvas>
      <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-space-950/70 px-2 py-1 text-[11px] text-muted">
        {station.name} · {station.lat}°, {station.lon}° {active ? '· tracking your craft' : ''}
      </p>
    </div>
  )
}
