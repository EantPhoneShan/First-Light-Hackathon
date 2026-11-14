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
import { Html, OrbitControls } from '@react-three/drei'
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

export interface OrbitView {
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
  const camTarget = useRef(new THREE.Vector3())
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
    const a = (v.angleDeg * Math.PI) / 180
    const pos = new THREE.Vector3(Math.cos(a) * R, 0, -Math.sin(a) * R).applyQuaternion(tilt)
    const vel = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)).applyQuaternion(tilt)
    const down = pos.clone().negate().normalize()

    // Earth turns once a "day" while the craft flies (sped up to match the flight).
    if (earth.current) earth.current.rotation.y = (v.angleDeg / 360) * (Math.PI / 8)

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

    // Camera: chase the craft from behind and above, or show the whole orbit.
    const want = new THREE.Vector3()
    const look = new THREE.Vector3()
    if (mode === 'follow') {
      look.copy(pos)
      want.copy(pos).addScaledVector(vel, -0.22).addScaledVector(down, -0.07).add(new THREE.Vector3(0, 0.03, 0))
    } else {
      look.set(0, 0, 0)
      want.set(1.6, 2.2, 3.4)
    }
    const jump = camera.position.distanceTo(want) > 2
    camera.position.lerp(want, jump ? 1 : 1 - Math.exp(-delta * 3))
    camTarget.current.lerp(look, jump ? 1 : 1 - Math.exp(-delta * 5))
    camera.lookAt(camTarget.current)
  })

  return (
    <>
      <SpaceLights photoBackdrop sunOnly />
      {/* The Sun: strong light from +x, and its glow far away */}
      <directionalLight position={[10, 0, 0]} intensity={3.2} color="#fff4e0" />
      <sprite position={[40, 0, 0]} scale={[14, 14, 1]}>
        <spriteMaterial map={puff} color="#ffe2a0" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      <group ref={earth}>
        <Earth radius={1} atmosphere={1.02} spin={[0, 0, 0]} segments={128} />
        {stationPoints.map(({ st, p }) => (
          <group key={st.id} position={p}>
            <mesh>
              <sphereGeometry args={[0.006, 12, 8]} />
              <meshBasicMaterial color="#3ddc97" />
            </mesh>
            {mode === 'whole' && (
              <Html center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
                <span className="translate-y-3 rounded bg-space-950/80 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-ok">{st.name}</span>
              </Html>
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
        <lineBasicMaterial color="#ff8a3d" transparent opacity={0.45} />
      </lineLoop>

      {/* Downlink beam */}
      {/* @ts-expect-error three's <line> clashes with SVG <line> in JSX types */}
      <line ref={link} geometry={linkGeo}>
        <lineBasicMaterial color="#3ddc97" transparent opacity={0.8} />
      </line>

      <group ref={craft}>
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
      <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ fov: 45, near: 0.001, far: 200, position: [1.6, 2.2, 3.4] }} aria-label="3D view of your spacecraft in orbit">
        <Scene {...props} mode={mode} />
        {mode === 'whole' && <OrbitControls makeDefault enablePan={false} minDistance={1.4} maxDistance={8} />}
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
            className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs backdrop-blur', mode === id ? 'border-accent bg-accent/20 text-ink' : 'border-space-600 bg-space-900/70 text-muted hover:text-ink')}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
