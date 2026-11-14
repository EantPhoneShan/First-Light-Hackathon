/**
 * 3D launch (PRD F13): the chosen rocket, with your spacecraft inside, flies
 * the ascent from game/ascent.ts. The rocket stays at the origin and the world
 * moves under it: the pad and tower fall away, the sky darkens with altitude,
 * Earth's curve appears, stages and fairing separate on the real event times,
 * and in orbit the craft is released and unfolds its panels.
 *
 * Everything is a pure function of the launch screen's clock (getT), so Skip
 * and Watch again just work. Units are metres; a logarithmic depth buffer lets
 * a 70 m rocket and a 6,371 km Earth share one scene.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Bus, Launcher, Part } from '@/engine/types'
import { flightTime, sampleAt, type AscentProfile } from '@/game/ascent'
import { busGeom } from './craftLayout'
import { earthTexture, grassTexture, mats, puffTexture } from './materials'
import { Booster, FairingHalf, FirstStage, Interstage, Payload, rocketSpec, SecondStage, stackOf, upperEngineLen, type RocketSpec } from './rocketParts'
import { SpacecraftModel } from './SpacecraftModel'

export interface Timeline {
  liftoff: number
  maxQ: number
  sep: number
  fairing: number
  orbit: number
  deploy: number
  done: number
  fail: number
}

export interface Launch3DProps {
  getT: () => number
  T: Timeline
  fails: boolean
  launcher: Launcher
  bus?: Bus
  parts: Part[]
  profile: AscentProfile
}

const RE = 6371e3
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const smooth = (k: number) => k * k * (3 - 2 * k)

export default function Launch3D(props: Launch3DProps) {
  return (
    <Canvas dpr={[1, 2]} gl={{ logarithmicDepthBuffer: true, antialias: true, alpha: true }} camera={{ fov: 40, near: 0.05, far: 3e7, position: [60, 20, 90] }} aria-label="3D launch">
      <Scene {...props} />
    </Canvas>
  )
}

// ---------------------------------------------------------------- exhaust

const plumeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const plumeFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    // vUv.y = 1 at the nozzle, 0 at the tail.
    float along = vUv.y;
    float flick = 0.85 + 0.15 * sin(uTime * 60.0 + vUv.x * 40.0) * sin(uTime * 37.0);
    vec3 col = mix(uEdge, uCore, smoothstep(0.55, 1.0, along));
    float a = smoothstep(0.0, 0.6, along) * flick * uOpacity;
    // Shock diamonds near the nozzle in thick air.
    a += 0.25 * uOpacity * smoothstep(0.7, 1.0, along) * (0.5 + 0.5 * sin(along * 60.0));
    gl_FragColor = vec4(col * a, a);
  }
`

function makePlumeMaterial(core: string, edge: string) {
  return new THREE.ShaderMaterial({
    vertexShader: plumeVertex,
    fragmentShader: plumeFragment,
    uniforms: { uTime: { value: 0 }, uCore: { value: new THREE.Color(core) }, uEdge: { value: new THREE.Color(edge) }, uOpacity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

/** A cone of flame pointing down from y = 0. Scale x/z for width, y for length. */
function Plume({ material, radius }: { material: THREE.ShaderMaterial; radius: number }) {
  return (
    <mesh material={material} position={[0, -0.5, 0]}>
      <cylinderGeometry args={[radius, radius * 0.25, 1, 32, 1, true]} />
    </mesh>
  )
}

// ---------------------------------------------------------------- atmosphere

const atmoVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
const atmoFragment = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 5.0);
    gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * rim * 0.9, rim * 0.8);
  }
`

// ---------------------------------------------------------------- scene

function Scene({ getT, T, fails, launcher, bus, parts, profile }: Launch3DProps) {
  const spec = useMemo(() => rocketSpec(launcher), [launcher])
  const st = useMemo(() => stackOf(spec), [spec])
  const H = st.top
  const m = mats()
  const { scene, camera } = useThree()

  const plume1 = useMemo(() => makePlumeMaterial('#fff7d6', '#ff7a1a'), [])
  const plume2 = useMemo(() => makePlumeMaterial('#eaf2ff', '#7fa8ff'), [])
  const earthMap = useMemo(() => earthTexture(), [])
  const puff = useMemo(() => puffTexture(), [])
  const grass = useMemo(() => grassTexture(Math.max(4, H / 6)), [H])
  const atmo = useMemo(() => new THREE.ShaderMaterial({ vertexShader: atmoVertex, fragmentShader: atmoFragment, transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }), [])

  // Refs to everything that moves.
  const rocket = useRef<THREE.Group>(null)
  const s1 = useRef<THREE.Group>(null)
  const boosters = useRef<THREE.Group[]>([])
  const s2 = useRef<THREE.Group>(null)
  const fairL = useRef<THREE.Group>(null)
  const fairR = useRef<THREE.Group>(null)
  const craft = useRef<THREE.Group>(null)
  const p1 = useRef<THREE.Group>(null)
  const p2 = useRef<THREE.Group>(null)
  const earth = useRef<THREE.Group>(null)
  const pad = useRef<THREE.Group>(null)
  const boom = useRef<THREE.Group>(null)
  const sky = useMemo(() => new THREE.Color(), [])
  const camTarget = useRef(new THREE.Vector3(0, H / 2, 0))

  // Exhaust trail and pad smoke: point clouds rebuilt from the flight path each frame.
  const TRAIL = 700
  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3))
    return g
  }, [])
  const SMOKE = 160
  const smoke = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SMOKE * 3), 3))
    return g
  }, [])
  const smokeSeeds = useMemo(() => Array.from({ length: SMOKE }, (_, i) => ({ a: (i / SMOKE) * Math.PI * 2 + Math.sin(i * 12.9) * 0.4, v: 0.5 + ((i * 7) % 11) / 11, up: ((i * 5) % 7) / 7 })), [])
  const debris = useMemo(() => Array.from({ length: 24 }, (_, i) => new THREE.Vector3(Math.sin(i * 2.3), Math.cos(i * 1.7) * 0.8 + 0.3, Math.sin(i * 3.1)).normalize()), [])

  const earthMat = useRef<THREE.MeshStandardMaterial>(null)

  const craftH = bus ? busGeom(bus).size[1] : 0.3
  const s2Top = st.payload

  useFrame((state, delta) => {
    const t = getT()
    const tau = flightTime(profile, t, T, fails)
    const s = sampleAt(profile, Math.max(0, tau))
    const e = profile.events
    const alt = s.altKm * 1000
    const dr = s.downrangeKm * 1000
    const exploded = fails && t >= T.fail
    const inOrbit = !fails && t >= T.orbit

    // The sky is drawn behind the canvas (photos + gradient, see Launch.tsx), so the scene stays see-through.
    scene.background = null
    scene.fog = null
    void sky
    void smooth
    // Earth fades in once the mountains have dropped away.
    if (earthMat.current) {
      const o = clamp((alt - 2500) / 12000)
      earthMat.current.opacity = o
      earthMat.current.transparent = o < 1
      earthMat.current.visible = o > 0
    }


    // World moves under the rocket.
    if (earth.current) {
      earth.current.position.set(0, -RE - alt, 0)
      earth.current.rotation.z = dr / RE
    }
    if (pad.current) {
      pad.current.position.set(-dr, -alt, 0)
      pad.current.visible = alt < 25e3
    }

    // Rocket attitude from the pitch program; tilts toward +x (downrange).
    if (rocket.current) {
      rocket.current.rotation.z = (-s.pitchDeg * Math.PI) / 180
      rocket.current.visible = !exploded || t < T.fail + 0.12
    }

    // Engines: first stage until MECO, upper stage from ignition to cut-off.
    const s1Firing = t >= T.liftoff - 0.4 && tau < e.meco && !exploded
    const s2Firing = !fails && tau >= e.ses && tau < e.seco
    const thin = clamp(alt / 50e3)
    if (p1.current) {
      p1.current.visible = s1Firing
      const len = spec.d * (3.5 + thin * 9) * (t < T.liftoff ? 0.5 : 1)
      p1.current.scale.set(1 + thin * 2.2, len, 1 + thin * 2.2)
    }
    if (p2.current) {
      p2.current.visible = s2Firing
      p2.current.scale.set(1.4, spec.d * 6, 1.4)
    }
    plume1.uniforms.uTime.value = state.clock.elapsedTime
    plume2.uniforms.uTime.value = state.clock.elapsedTime

    // Side boosters drop away.
    boosters.current.forEach((b, i) => {
      if (!b) return
      const side = i === 0 ? -1 : 1
      const dt = e.boosterSep !== null ? Math.max(0, tau - e.boosterSep) : 0
      b.position.set(side * spec.d * 1.02 + side * dt * 4, -dt * dt * 0.8, 0)
      b.rotation.z = side * -dt * 0.04
      b.visible = dt < 40
    })

    // First stage + interstage fall back after separation (timed on screen, so it reads at any speed).
    if (s1.current) {
      const dt = fails ? 0 : Math.max(0, t - T.sep) * 6
      s1.current.position.set(0, -dt * 6 - dt * dt * 1.2, 0)
      s1.current.rotation.z = dt * 0.02
      s1.current.visible = dt < 40
    }

    // Fairing halves swing open and drift.
    const fOpen = fails ? 0 : clamp((t - T.fairing) / 0.5)
    ;[fairL.current, fairR.current].forEach((f, i) => {
      if (!f) return
      const side = i === 0 ? -1 : 1
      const dt = Math.max(0, t - T.fairing) * 6
      // Group sits on the hinge (outer base edge); the shell hangs off it.
      f.position.set(side * (spec.fairing.d / 2 + dt * 1.5), s2Top - dt * 0.6, 0)
      f.rotation.z = -side * fOpen * 0.9
      f.visible = dt < 25
    })

    // In orbit: release the craft and unfold it.
    const rel = clamp((t - T.deploy) / 1.6)
    const unfold = clamp((t - T.deploy - 0.6) / 1.4)
    if (craft.current) {
      if (spec.payload === 'dispenser') {
        // Springs sideways out of its orange dispenser pod.
        craft.current.position.set(1.6 + rel * 3, s2Top + 0.6, 0)
        craft.current.rotation.set(0, rel * 0.8, -Math.PI / 2 + rel * 0.4)
      } else if (spec.payload === 'capsule') {
        // Leaves through the capsule's nose hatch (in real life, later, from the Station).
        craft.current.position.set(0, s2Top + 4.4 + rel * 4, 0)
        craft.current.rotation.set(0, rel * 0.6, 0)
      } else {
        craft.current.position.set(0, s2Top + spec.d * 0.08 + craftH / 2 + rel * craftH * 3, 0)
        craft.current.rotation.set(0, rel * 0.6, 0)
      }
      craft.current.userData.deploy = unfold
    }

    // Breakup.
    if (boom.current) {
      boom.current.visible = exploded
      const bt = Math.max(0, t - T.fail)
      const [fire, bits] = boom.current.children
      // Fire: camera-facing puffs in three layers (white-hot core, orange fireball, dark smoke that lingers).
      fire.children.forEach((c, i) => {
        const layer = i % 3
        const n = Math.floor(i / 3)
        const grow = [0.45, 0.8, 1.0][layer]
        const fade = [0.6, 1.3, 4][layer]
        const a = n * 2.1 + layer
        const spread = bt * H * 0.12 * (layer + 1)
        c.position.set(Math.cos(a) * spread, H * 0.5 + Math.sin(a * 1.3) * spread * 0.6 + bt * H * 0.04 * layer, Math.sin(a) * spread)
        c.scale.setScalar(H * (0.1 + bt * grow) * (0.7 + (n % 3) * 0.2))
        ;((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = clamp(1 - bt / fade) * (layer === 2 ? 0.8 : 1)
      })
      bits.children.forEach((c, i) => {
        const d = debris[i]
        c.position.set(d.x * bt * H * 0.4, H * 0.5 + d.y * bt * H * 0.4 - bt * bt * 4, d.z * bt * H * 0.4)
        c.rotation.set(bt * 3 + i, bt * 2, i)
      })
    }

    // Exhaust trail: where the rocket was, relative to where it is now.
    const pos = trail.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < TRAIL; i++) {
      const ti = Math.max(0, tau) * (i / TRAIL)
      const p = sampleAt(profile, ti)
      const show = t >= T.liftoff && ti < Math.min(tau, e.meco) && p.altKm < 45
      pos.setXYZ(i, show ? p.downrangeKm * 1000 - dr : 0, show ? p.altKm * 1000 - alt : -1e9, show ? Math.sin(i) * spec.d * 0.6 : 0)
    }
    pos.needsUpdate = true

    // Pad smoke billows out at ignition.
    const sp = smoke.attributes.position as THREE.BufferAttribute
    const since = t - (T.liftoff - 0.6)
    for (let i = 0; i < SMOKE; i++) {
      const sd = smokeSeeds[i]
      const r = since > 0 ? spec.d * (2 + since * 14 * sd.v) : 0
      sp.setXYZ(i, Math.cos(sd.a) * r - dr, since > 0 ? -alt + spec.d * (0.5 + sd.up * since * 3) : -1e9, Math.sin(sd.a) * r)
    }
    sp.needsUpdate = true

    // Camera: on the pad, a tracking shot up close; then follow the upper stage; in orbit, the craft.
    const cam = camera as THREE.PerspectiveCamera
    const want = new THREE.Vector3()
    const look = new THREE.Vector3()
    if (exploded) {
      look.set(0, H * 0.5, 0)
      want.set(H * 1.4, H * 0.4, H * 2.2)
    } else if (inOrbit) {
      // Side-on to the craft, a little behind it, so the spent stage drifts out of shot and Earth's curve fills the bottom.
      const c = craft.current?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(0, s2Top, 0)
      const up = new THREE.Vector3(0, 1, 0).applyEuler(rocket.current?.rotation ?? new THREE.Euler())
      const r = Math.max(craftH * 3.2, 0.9)
      look.copy(c)
      want.copy(c).addScaledVector(up, -r * 0.4).add(new THREE.Vector3(0, r * 0.5, r * 2.6))
    } else if (tau > e.stageSep + 2) {
      const top = rocket.current ? new THREE.Vector3(0, st.s2 + spec.s2.len / 2, 0).applyEuler(rocket.current.rotation) : new THREE.Vector3(0, st.s2, 0)
      look.copy(top)
      const r = spec.s2.len * 2.6 + spec.d * 4
      want.set(top.x + r * 0.7, top.y - r * 0.15, top.z + r)
    } else {
      // Ground tracking camera, slowly falling behind as the rocket climbs.
      const mid = new THREE.Vector3(0, H * 0.5, 0).applyEuler(rocket.current?.rotation ?? new THREE.Euler())
      look.copy(mid)
      const lag = clamp((tau + 2) / 60)
      want.set(H * (0.9 + lag * 0.6), H * (0.15 - lag * 0.5), H * (1.4 + lag * 1.2))
    }
    // Snap on big jumps (Skip / replay), otherwise glide.
    const jump = cam.position.distanceTo(want) > H * 6
    // Time-based easing: settles at the same speed on fast and slow computers.
    cam.position.lerp(want, jump ? 1 : 1 - Math.exp(-delta * 3.5))
    camTarget.current.lerp(look, jump ? 1 : 1 - Math.exp(-delta * 6))
    cam.lookAt(camTarget.current)
    cam.near = Math.max(0.02, (inOrbit ? craftH : H) * 0.01)
    cam.updateProjectionMatrix()
  })

  const eng1Y = 0
  const eng2Y = st.s2 - upperEngineLen(spec)

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[0.8, 0.6, 0.5]} intensity={3} color="#fff4e2" />
      <hemisphereLight args={['#a8c4ff', '#24324f', 0.5]} />


      {/* Earth, with its thin blue atmosphere seen edge-on */}
      <group ref={earth}>
        {/* Turned so the launch site sits on the equator of the texture, not on a pinched pole */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[RE, 160, 80]} />
          <meshStandardMaterial ref={earthMat} map={earthMap} roughness={0.9} metalness={0} />
        </mesh>
        <mesh material={atmo}>
          <sphereGeometry args={[RE * 1.012, 96, 48]} />
        </mesh>
      </group>

      {/* Launch site: ground, pad, tower */}
      <group ref={pad}>
        {/* Grassy apron round the pad; the mountains behind are the photo */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          <circleGeometry args={[H * 3, 64]} />
          <meshStandardMaterial map={grass} roughness={1} />
        </mesh>
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[H * 0.35, H * 0.4, 0.5, 48]} />
          <meshStandardMaterial color="#8a8d93" roughness={0.95} />
        </mesh>
        <group position={[-spec.d * 2.2, 0, 0]}>
          {/* Steel lattice tower: four legs and cross-bracing */}
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} material={m.titanium} position={[sx * spec.d * 0.6, H * 0.55, sz * spec.d * 0.6]}>
                <boxGeometry args={[spec.d * 0.1, H * 1.1, spec.d * 0.1]} />
              </mesh>
            )),
          )}
          {Array.from({ length: 12 }, (_, i) => (
            <group key={i} position={[0, (H * 1.1 * (i + 0.5)) / 12, 0]}>
              <mesh material={m.titanium} position={[0, 0, spec.d * 0.6]} rotation={[0, 0, i % 2 ? 0.7 : -0.7]}>
                <boxGeometry args={[spec.d * 1.5, spec.d * 0.05, spec.d * 0.05]} />
              </mesh>
              <mesh material={m.titanium} position={[spec.d * 0.6, 0, 0]} rotation={[i % 2 ? 0.7 : -0.7, 0, 0]}>
                <boxGeometry args={[spec.d * 0.05, spec.d * 0.05, spec.d * 1.5]} />
              </mesh>
            </group>
          ))}
          {[0.3, 0.6, 0.85].map((y) => (
            <mesh key={y} material={m.orange} position={[spec.d * 0.9, H * y, 0]}>
              <boxGeometry args={[spec.d * 1.4, spec.d * 0.15, spec.d * 0.3]} />
            </mesh>
          ))}
        </group>
        <points geometry={smoke}>
          <pointsMaterial map={puff} size={spec.d * 9} sizeAttenuation transparent depthWrite={false} color="#e9ecef" opacity={0.8} />
        </points>
      </group>

      {/* Contrail, in world space */}
      <points geometry={trail}>
        <pointsMaterial map={puff} size={spec.d * 3.2} sizeAttenuation transparent depthWrite={false} color="#dfe3ea" opacity={0.55} />
      </points>

      <group ref={rocket}>
        {/* Side boosters */}
        {spec.boosters > 0 &&
          [0, 1].map((i) => (
            <group key={i} ref={(g) => void (g && (boosters.current[i] = g))}>
              <Booster spec={spec} hot />
            </group>
          ))}

        {/* First stage + interstage */}
        <group ref={s1}>
          <FirstStage spec={spec} hot />
          <group position={[0, st.inter, 0]}>
            <Interstage spec={spec} />
          </group>
          <group ref={p1} position={[0, eng1Y - spec.d * 0.35, 0]}>
            <Plume material={plume1} radius={spec.d * 0.55} />
          </group>
        </group>

        {/* Upper stage and payload adapter */}
        <group ref={s2}>
          <group position={[0, st.s2, 0]}>
            <SecondStage spec={spec} hot />
          </group>
          <group ref={p2} position={[0, eng2Y, 0]}>
            <Plume material={plume2} radius={spec.d * 0.5} />
          </group>
          <group position={[0, st.payload, 0]}>
            <Payload spec={spec} bus={bus} parts={parts} withCraft={false} />
          </group>
        </group>

        {/* Your craft, released in orbit */}
        <group ref={craft}>{bus && <DeployingCraft bus={bus} parts={parts} />}</group>

        {/* Fairing halves */}
        {spec.fairing.len > 0 && spec.payload !== 'capsule' && (
          <>
            <group ref={fairL}>
              <FairingShell spec={spec} side={-1} />
            </group>
            <group ref={fairR}>
              <FairingShell spec={spec} side={1} />
            </group>
          </>
        )}
      </group>

      {/* Breakup: fireball and debris */}
      <group ref={boom} visible={false}>
        <group>
          {Array.from({ length: 15 }, (_, i) => (
            <sprite key={i}>
              <spriteMaterial map={puff} color={['#fff1c4', '#ff7a2a', '#3b3633'][i % 3]} transparent depthWrite={false} />
            </sprite>
          ))}
        </group>
        <group>
          {debris.map((_, i) => (
            <mesh key={i} material={i % 3 ? m.rocketWhite : m.anodised}>
              <boxGeometry args={[spec.d * 0.4, spec.d * 0.15, spec.d * 0.3]} />
            </mesh>
          ))}
        </group>
      </group>
    </>
  )
}

/** Fairing half with its hinge (outer base edge) at the group origin; the parent moves and turns it. */
function FairingShell({ spec, side }: { spec: RocketSpec; side: 1 | -1 }) {
  return (
    <group position={[(-side * spec.fairing.d) / 2, 0, 0]}>
      <FairingHalf spec={spec} side={side} />
    </group>
  )
}

/** The craft, folded for launch, reading its unfold amount from the parent group each frame. */
function DeployingCraft({ bus, parts }: { bus: Bus; parts: Part[] }) {
  const ref = useRef<THREE.Group>(null)
  const last = useRef(-1)
  const [, force] = useFrameCounter()
  useFrame(() => {
    const d = (ref.current?.parent?.userData.deploy as number | undefined) ?? 0
    const q = Math.round(d * 30) / 30
    if (q !== last.current) {
      last.current = q
      force()
    }
  })
  const d = Math.max(0, last.current)
  return (
    <group ref={ref}>
      <SpacecraftModel bus={bus} parts={parts} cutaway={false} deploy={d} />
    </group>
  )
}

/** Tiny re-render trigger for components animated through React props. */
function useFrameCounter(): [number, () => void] {
  const [n, set] = useState(0)
  return [n, () => set((x) => x + 1)]
}
