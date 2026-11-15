/**
 * 3D orbit view for the flight screen (PRD F14). Earth turns under your
 * spacecraft, which flies Member 1's simulation live: its orbit angle, whether
 * it is in Earth's shadow, whether it is sending data to a ground station, and
 * whether it is still alive.
 *
 * Same conventions as the 2D drawing (components/sim/drawScene.ts): the Sun is
 * along +x, angle 0 is in sunlight and Earth's shadow is centred at 180 deg.
 * Units: Earth radius = 1. The craft is drawn far larger than real so you can
 * see it (a real one would be smaller than a pixel).
 */
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Eye, Globe2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Bus, GroundStation, Part } from '@/engine/types'
import { cn } from '@/lib/cn'
import { busGeom } from './craftLayout'
import { puffTexture } from './materials'
import { SpacecraftModel } from './SpacecraftModel'
import { Earth, SpaceLights } from './Stage'
import { TextLabel } from './TextLabel'

export interface OrbitView {
  /** Flight time in minutes (drives Earth's spin). */
  tMin: number
  angleDeg: number
  inEclipse: boolean
  downlinking: boolean
  alive: boolean
}

export interface Orbit3DProps {
  getView: () => OrbitView
  altitudeKm: number
  inclinationDeg: number
  bus?: Bus
  parts: Part[]
  stations: GroundStation[]
}

const RE_KM = 6371
/** How big the craft is drawn, in Earth radii (hugely exaggerated so it's visible). */
const CRAFT_SIZE = 0.045

/** Point on Earth's surface for a latitude/longitude (y is the polar axis). */
function surface(latDeg: number, lonDeg: number, r = 1) {
  const la = (latDeg * Math.PI) / 180
  const lo = (lonDeg * Math.PI) / 180
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r)
}

function Scene({ getView, altitudeKm, inclinationDeg, bus, parts, stations, mode }: Orbit3DProps & { mode: 'follow' | 'whole' }) {
  const R = 1 + Math.max(150, altitudeKm) / RE_KM
  const earth = useRef<THREE.Group>(null)
  const craft = useRef<THREE.Group>(null)
  const spinner = useRef<THREE.Group>(null)
  const link = useRef<THREE.Line>(null)
  const { camera } = useThree()
  const controls = useThree((st) => st.controls)
  const placed = useRef(false)
  const camTarget = useRef(new THREE.Vector3())
  // Smooth, forward-only motion: the simulation's angle wraps 0-360 and, at fast
  // speeds, jumps most of a lap per frame (which looks like going backwards).
  // We unwrap it and let the drawn craft chase it at a watchable pace.
  const track = useRef({ lastRaw: NaN, lastT: -1, sim: 0, vis: 0, earthVis: 0 })
  const puff = useMemo(() => puffTexture(), [])
  const scale = bus ? CRAFT_SIZE / Math.max(...busGeom(bus).size) : 1

  // The orbit plane: tilted about the Sun line (x), so sunlight and shadow stay where the simulation puts them.
  const tilt = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (Math.min(inclinationDeg, 98) * Math.PI) / 180), [inclinationDeg])
  const ring = useMemo(() => {
    const pts = Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2
      return new THREE.Vector3(Math.cos(a) * R, 0, -Math.sin(a) * R).applyQuaternion(tilt)
    })
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [R, tilt])
  const linkGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), [])
  const stationPoints = useMemo(() => stations.map((s) => ({ st: s, p: surface(s.lat, s.lon, 1.002) })), [stations])

  useFrame((state, delta) => {
    const v = getView()
    const tr = track.current
    if (Number.isNaN(tr.lastRaw) || v.tMin < tr.lastT) {
      // First frame, or the flight restarted: jump straight there.
      tr.sim = tr.vis = v.angleDeg
      tr.earthVis = 0
    } else {
      tr.sim += (((v.angleDeg - tr.lastRaw) % 360) + 360) % 360 // always forward
    }
    tr.lastRaw = v.angleDeg
    tr.lastT = v.tMin
    let gap = tr.sim - tr.vis
    if (gap >= 360) {
      // Fast-forward: skip whole laps, keep the phase, so it never runs backwards.
      tr.vis += Math.floor(gap / 360) * 360
      gap = tr.sim - tr.vis
    }
    tr.vis += Math.min(gap, 140 * delta) // at most ~a lap every 2.5 s
    const a = (tr.vis * Math.PI) / 180
    const pos = new THREE.Vector3(Math.cos(a) * R, 0, -Math.sin(a) * R).applyQuaternion(tilt)
    const vel = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)).applyQuaternion(tilt)
    const down = pos.clone().negate().normalize()

    // Earth turns once a sidereal day (1,436 min of flight time), always the same
    // way; on fast speeds it turns at a steady watchable rate instead of strobing.
    if (earth.current) {
      const target = (v.tMin / 1436) * Math.PI * 2
      let eg = target - tr.earthVis
      if (eg > Math.PI * 2) tr.earthVis += Math.floor(eg / (Math.PI * 2)) * Math.PI * 2
      eg = target - tr.earthVis
      tr.earthVis += Math.max(0, Math.min(eg, 0.5 * delta))
      earth.current.rotation.y = tr.earthVis
    }

    // Craft: bottom (instruments) faces Earth, nose along its path. A dead craft tumbles.
    if (craft.current) {
      craft.current.position.copy(pos)
      const up = down.clone().negate()
      const back = vel.clone().negate()
      const m = new THREE.Matrix4().makeBasis(up.clone().cross(back).normalize(), up, back)
      craft.current.quaternion.setFromRotationMatrix(m)
    }
    if (spinner.current) {
      if (!v.alive) {
        spinner.current.rotation.x += delta * 0.8
        spinner.current.rotation.z += delta * 0.5
      }
    }

    // Downlink: a beam to the nearest of your ground stations that can see the craft.
    if (link.current) {
      let best: THREE.Vector3 | null = null
      if (v.downlinking && earth.current) {
        let bestD = Infinity
        for (const { p } of stationPoints) {
          const w = p.clone().applyEuler(earth.current.rotation)
          const d = w.distanceTo(pos)
          if (d < bestD) {
            bestD = d
            best = w
          }
        }
      }
      link.current.visible = !!best
      if (best) {
        const attr = linkGeo.attributes.position as THREE.BufferAttribute
        attr.setXYZ(0, pos.x, pos.y, pos.z)
        attr.setXYZ(1, best.x, best.y, best.z)
        attr.needsUpdate = true
        ;(link.current.material as THREE.LineBasicMaterial).opacity = 0.55 + 0.4 * Math.sin(state.clock.elapsedTime * 8)
      }
    }

    // Camera. Follow: chase the craft from behind and above. Whole orbit: place
    // the camera once (Earth, Sun and sunlight in shot), then the mouse is in charge.
    if (mode === 'follow') {
      const want = pos.clone().addScaledVector(vel, -0.22).addScaledVector(down, -0.07).add(new THREE.Vector3(0, 0.03, 0))
      const jump = camera.position.distanceTo(want) > 2
      camera.position.lerp(want, jump ? 1 : 1 - Math.exp(-delta * 3))
      camTarget.current.lerp(pos, jump ? 1 : 1 - Math.exp(-delta * 5))
      camera.lookAt(camTarget.current)
      placed.current = false
    } else if (!placed.current) {
      placed.current = true
      camera.position.set(-2.5, 1.2, 3.2)
      const c = controls as unknown as { target: THREE.Vector3; update: () => void } | null
      c?.target.set(2.5, 0, 0)
      c?.update()
      camera.lookAt(2.5, 0, 0)
    }
  })

  return (
    <>
      <SpaceLights photoBackdrop sunOnly />
      {/* The Sun, along +x: its light, a bright disc with a wide glow, and (whole-orbit view) a sunlight arrow */}
      <directionalLight position={[10, 0, 0]} intensity={3.2} color="#fff4e0" />
      <group position={[12, 0, 0]}>
        <sprite scale={[7, 7, 1]}>
          <spriteMaterial map={puff} color="#ffb547" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        <sprite scale={[2.2, 2.2, 1]}>
          <spriteMaterial map={puff} color="#fff6d8" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        <mesh>
          <sphereGeometry args={[0.5, 32, 16]} />
          <meshBasicMaterial color="#fffbe8" toneMapped={false} />
        </mesh>
        <TextLabel text="☀ Sun" position={[0, -0.8, 0]} anchor="below" color="#ffc94a" px={11} />
      </group>
      {mode === 'whole' && (
        <group>
          {[-0.5, 0, 0.5].map((y) => (
            <group key={y} position={[2.6, y, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.006, 0.006, 1.2, 6]} />
                <meshBasicMaterial color="#ffc94a" transparent opacity={0.7} />
              </mesh>
              <mesh position={[-0.65, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <coneGeometry args={[0.03, 0.1, 12]} />
                <meshBasicMaterial color="#ffc94a" />
              </mesh>
            </group>
          ))}
          <TextLabel text="Sunlight" position={[2.6, 0.75, 0]} color="#ffc94a" px={10} />
        </group>
      )}

      <group ref={earth}>
        <Earth radius={1} atmosphere={1.02} spin={[0, 0, 0]} segments={128} />
        {stationPoints.map(({ st, p }) => (
          <group key={st.id} position={p}>
            <mesh>
              <sphereGeometry args={[0.006, 12, 8]} />
              <meshBasicMaterial color="#3ddc97" />
            </mesh>
            {mode === 'whole' && (
              <TextLabel text={st.name} anchor="below" color="#3ddc97" px={10} />
            )}
          </group>
        ))}
      </group>

      {/* Earth's shadow: the craft is in eclipse while inside this dark tube */}
      <mesh position={[-2.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.995, 0.995, 5, 48, 1, true]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Orbit path */}
      <lineLoop geometry={ring}>
        <lineBasicMaterial color="#ff8a3d" transparent opacity={mode === 'whole' ? 0.85 : 0.45} />
      </lineLoop>

      {/* Downlink beam */}
      {/* @ts-expect-error three's <line> clashes with SVG <line> in JSX types */}
      <line ref={link} geometry={linkGeo}>
        <lineBasicMaterial color="#3ddc97" transparent opacity={0.8} />
      </line>

      <group ref={craft}>
        {/* From far away the craft is tiny: a glowing marker and a label show where it is */}
        {mode === 'whole' && (
          <>
            <sprite scale={[0.14, 0.14, 1]}>
              <spriteMaterial map={puff} color="#ff8a3d" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </sprite>
            <TextLabel text="Your craft" anchor="above" color="#ff8a3d" px={10} />
          </>
        )}
        <group ref={spinner} scale={scale}>
          {bus ? (
            <SpacecraftModel bus={bus} parts={parts} cutaway={false} deploy={1} />
          ) : (
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#ccc" />
            </mesh>
          )}
        </group>
      </group>
    </>
  )
}

export default function Orbit3D(props: Orbit3DProps) {
  const [mode, setMode] = useState<'follow' | 'whole'>('follow')
  return (
    <div className="relative h-full w-full bg-[url('/assets/bg/stars.webp')] bg-cover bg-center">
      <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ fov: 45, near: 0.001, far: 200, position: [-2.5, 1.2, 3.2] }} aria-label="3D view of your spacecraft in orbit">
        <Scene {...props} mode={mode} />
        {mode === 'whole' && <OrbitControls makeDefault enablePan={false} minDistance={1.4} maxDistance={14} />}
      </Canvas>
      <div className="absolute bottom-2 left-2 flex gap-1.5">
        {(
          [
            ['follow', 'Follow craft', Eye],
            ['whole', 'Whole orbit', Globe2],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs backdrop-blur', mode === id ? 'border-accent bg-accent/20 text-ink' : 'border-space-600 bg-space-900/70 text-muted hover:text-ink')}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
