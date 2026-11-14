/**
 * Procedural launch vehicles, one per launcher class in launchers.json, at
 * roughly real proportions (metres). Every piece is its own component so the
 * picker can explode the stack and the launch scene can drop stages, open the
 * fairing and release the spacecraft.
 *
 * Coordinates: y = 0 at the bottom of the first stage, the rocket points +y.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Bus, Launcher, Part } from '@/engine/types'
import { busGeom } from './craftLayout'
import { mats } from './materials'
import { SpacecraftModel } from './SpacecraftModel'

export type Skin = 'white' | 'black' | 'steel'
export type PayloadKind = 'fairing' | 'dispenser' | 'capsule'

export interface RocketSpec {
  /** Core diameter. */
  d: number
  s1: { len: number; engines: number; skin: Skin; legs: boolean; gridFins: boolean }
  inter: { len: number; skin: Skin }
  s2: { len: number; skin: Skin; nose?: boolean }
  fairing: { len: number; d: number; skin: Skin }
  boosters: number
  payload: PayloadKind
}

/** Generic vehicles by class (no real rocket's livery or name). */
export function rocketSpec(l: Pick<Launcher, 'id' | 'class'>): RocketSpec {
  const medium: RocketSpec = {
    d: 3.7,
    s1: { len: 41, engines: 9, skin: 'white', legs: true, gridFins: true },
    inter: { len: 4.5, skin: 'black' },
    s2: { len: 12.5, skin: 'white' },
    fairing: { len: 13, d: 5.2, skin: 'white' },
    boosters: 0,
    payload: 'fairing',
  }
  if (l.id === 'iss-deploy') return { ...medium, payload: 'capsule', fairing: { len: 0, d: 3.7, skin: 'white' } }
  if (l.class === 'rideshare') return { ...medium, payload: 'dispenser' }
  if (l.class === 'small')
    return {
      d: 1.2,
      s1: { len: 12.1, engines: 9, skin: 'black', legs: false, gridFins: false },
      inter: { len: 0.8, skin: 'black' },
      s2: { len: 2.4, skin: 'black' },
      fairing: { len: 2.5, d: 1.2, skin: 'black' },
      boosters: 0,
      payload: 'fairing',
    }
  if (l.class === 'heavy') return { ...medium, boosters: 2 }
  if (l.class === 'super-heavy')
    return {
      d: 9,
      s1: { len: 71, engines: 33, skin: 'steel', legs: false, gridFins: true },
      inter: { len: 2, skin: 'steel' },
      s2: { len: 40, skin: 'steel', nose: true },
      fairing: { len: 0, d: 9, skin: 'steel' },
      boosters: 0,
      payload: 'fairing',
    }
  return medium
}

/** Heights of each piece in the stack (bottom of each), for animation and exploded view. */
export function stackOf(spec: RocketSpec) {
  const s1 = 0
  const inter = spec.s1.len
  const s2 = inter + spec.inter.len
  // A super-heavy carries its payload inside the nosed upper stage.
  const payload = spec.s2.nose ? s2 + spec.s2.len * 0.75 : s2 + spec.s2.len
  const fairing = payload
  const top = spec.s2.nose ? s2 + spec.s2.len + spec.d / 2 : fairing + (spec.payload === 'capsule' ? 7.2 : spec.fairing.len || spec.d)
  return { s1, inter, s2, payload, fairing, top }
}

const skinMat = (s: Skin) => (s === 'white' ? mats().rocketWhite : s === 'black' ? mats().rocketBlack : mats().steel)

// ---------------------------------------------------------------- engines

/** Where the engines sit on the base: centre, ring of 8, or 3 + 10 + 20. */
function engineLayout(n: number, r: number): [number, number][] {
  if (n === 1) return [[0, 0]]
  const ring = (k: number, rr: number, off = 0) => Array.from({ length: k }, (_, i) => [Math.cos((i / k) * Math.PI * 2 + off) * rr, Math.sin((i / k) * Math.PI * 2 + off) * rr] as [number, number])
  if (n === 9) return [[0, 0], ...ring(8, r * 0.62)]
  return [...ring(3, r * 0.18), ...ring(10, r * 0.48, 0.2), ...ring(20, r * 0.82, 0.1)]
}

export function Engine({ size, vacuum = false, hot = false }: { size: number; vacuum?: boolean; hot?: boolean }) {
  const m = mats()
  // Bell: narrow throat at the top, wide exit at the bottom. Vacuum engines have huge bells.
  const exit = size * (vacuum ? 0.9 : 0.42)
  const len = size * (vacuum ? 2.2 : 0.9)
  return (
    <group>
      <mesh material={m.anodised} position={[0, size * 0.25, 0]}>
        <cylinderGeometry args={[size * 0.22, size * 0.28, size * 0.5, 16]} />
      </mesh>
      <mesh material={hot ? m.nozzleHot : m.nozzle} position={[0, -len / 2, 0]}>
        <cylinderGeometry args={[size * 0.14, exit, len, 28, 1, true]} />
      </mesh>
    </group>
  )
}

/** Length of the vacuum engine bell hanging below the upper stage. */
export const upperEngineLen = (spec: RocketSpec) => spec.d * (spec.s1.engines === 33 ? 0.3 : 0.55) * 2.2

// ---------------------------------------------------------------- stages

export function FirstStage({ spec, hot = false, legsOut = 0 }: { spec: RocketSpec; hot?: boolean; legsOut?: number }) {
  const m = mats()
  const { d, s1 } = spec
  const r = d / 2
  const engines = engineLayout(s1.engines, r)
  const eSize = s1.engines === 33 ? d * 0.12 : d * 0.3
  return (
    <group>
      <mesh material={skinMat(s1.skin)} position={[0, s1.len / 2, 0]}>
        <cylinderGeometry args={[r, r, s1.len, 48]} />
      </mesh>
      {/* Thrust section skirt */}
      <mesh material={m.anodised} position={[0, d * 0.08, 0]}>
        <cylinderGeometry args={[r * 1.02, r * 1.05, d * 0.16, 48]} />
      </mesh>
      {/* Cable raceway along the side */}
      <mesh material={skinMat(s1.skin)} position={[r * 0.98, s1.len / 2, 0]}>
        <boxGeometry args={[d * 0.06, s1.len * 0.9, d * 0.12]} />
      </mesh>
      {engines.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Engine size={eSize} hot={hot} />
        </group>
      ))}
      {s1.legs &&
        [0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 2 + Math.PI / 4, 0]}>
            <group position={[r, d * 0.25, 0]} rotation={[0, 0, legsOut * 0.55]}>
              <mesh material={m.rocketBlack} position={[0, d * 1.6, 0]}>
                <boxGeometry args={[d * 0.08, d * 3.2, d * 0.22]} />
              </mesh>
            </group>
          </group>
        ))}
      {s1.gridFins &&
        [0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 2, 0]} position={[0, s1.len - d * 0.4, 0]}>
            <mesh material={m.titanium} position={[r + d * 0.1, 0, 0]}>
              <boxGeometry args={[d * 0.05, d * 0.3, d * 0.3]} />
            </mesh>
          </group>
        ))}
    </group>
  )
}

export function Booster({ spec, hot = false }: { spec: RocketSpec; hot?: boolean }) {
  const m = mats()
  const { d, s1 } = spec
  return (
    <group>
      <FirstStage spec={{ ...spec, s1: { ...s1, legs: true } }} hot={hot} />
      {/* Nose cone on top of a side booster */}
      <mesh material={m.rocketWhite} position={[0, s1.len + d * 0.9, 0]}>
        <coneGeometry args={[d / 2, d * 1.8, 48]} />
      </mesh>
    </group>
  )
}

export function Interstage({ spec }: { spec: RocketSpec }) {
  const r = spec.d / 2
  const m = useMemo(() => {
    const c = skinMat(spec.inter.skin).clone()
    c.side = THREE.DoubleSide
    return c
  }, [spec.inter.skin])
  return (
    <mesh material={m} position={[0, spec.inter.len / 2, 0]}>
      <cylinderGeometry args={[r, r, spec.inter.len, 48, 1, true]} />
    </mesh>
  )
}

export function SecondStage({ spec, hot = false }: { spec: RocketSpec; hot?: boolean }) {
  const r = spec.d / 2
  const { s2 } = spec
  return (
    <group>
      <mesh material={skinMat(s2.skin)} position={[0, s2.len / 2, 0]}>
        <cylinderGeometry args={[r * 0.995, r * 0.995, s2.len, 48]} />
      </mesh>
      {s2.nose && (
        <mesh material={skinMat(s2.skin)} position={[0, s2.len, 0]}>
          <sphereGeometry args={[r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      )}
      {/* Vacuum engine: hidden inside the interstage until separation */}
      <Engine size={spec.d * (spec.s1.engines === 33 ? 0.3 : 0.55)} vacuum hot={hot} />
    </group>
  )
}

// ---------------------------------------------------------------- fairing

function ogive(len: number, r: number): THREE.Vector2[] {
  // Straight barrel for 40% of the length, then a rounded ogive to the tip.
  const pts: THREE.Vector2[] = [new THREE.Vector2(r, 0), new THREE.Vector2(r, len * 0.4)]
  const nose = len * 0.6
  for (let i = 1; i <= 20; i++) {
    const k = i / 20
    pts.push(new THREE.Vector2(r * Math.sqrt(Math.max(0, 1 - k * k)), len * 0.4 + nose * k))
  }
  return pts
}

/** One half of the payload fairing. `open` 0..1 swings it away from the payload, hinged at its base. */
export function FairingHalf({ spec, side, open = 0 }: { spec: RocketSpec; side: 1 | -1; open?: number }) {
  const geo = useMemo(() => new THREE.LatheGeometry(ogive(spec.fairing.len, spec.fairing.d / 2), 48, side === 1 ? 0 : Math.PI, Math.PI), [spec, side])
  // Both sides drawn, so the inside of the shell shows once it swings open.
  const m = useMemo(() => {
    const c = skinMat(spec.fairing.skin).clone()
    c.side = THREE.DoubleSide
    return c
  }, [spec.fairing.skin])
  return (
    <group position={[(side * spec.fairing.d) / 2, 0, 0]} rotation={[0, 0, -side * open * 0.9]}>
      <mesh geometry={geo} material={m} position={[(-side * spec.fairing.d) / 2, 0, 0]} />
    </group>
  )
}

/** Flared adapter between the upper stage and the payload. */
function Adapter({ spec }: { spec: RocketSpec }) {
  return (
    <mesh material={mats().anodised} position={[0, spec.d * 0.04, 0]}>
      <cylinderGeometry args={[spec.d * 0.2, spec.d * 0.42, spec.d * 0.08, 32]} />
    </mesh>
  )
}

/** Height of the adapter, so the craft sits right on top of it. */
export const adapterTop = (spec: RocketSpec) => spec.d * 0.08

/**
 * What rides on top: your spacecraft on an adapter (own rocket), in a CubeSat
 * dispenser among other rideshare satellites, or inside a cargo capsule.
 * `withCraft` false leaves the craft out (the launch scene flies it separately).
 */
export function Payload({ spec, bus, parts, deploy = 0, withCraft = true }: { spec: RocketSpec; bus?: Bus; parts: Part[]; deploy?: number; withCraft?: boolean }) {
  const m = mats()
  const craftH = bus ? busGeom(bus).size[1] : 0
  if (spec.payload === 'dispenser') {
    // A ring of dispenser pods round the main satellite: yours is the orange one.
    return (
      <group>
        <mesh material={m.aluminium} position={[0, 0.6, 0]}>
          <cylinderGeometry args={[1.1, 1.3, 1.2, 32]} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <group key={i} rotation={[0, (i / 8) * Math.PI * 2, 0]}>
            <mesh material={i === 0 ? m.orange : m.anodised} position={[1.35, 0.6, 0]}>
              <boxGeometry args={[0.3, 0.45, 0.2]} />
            </mesh>
          </group>
        ))}
        <mesh material={m.gold} position={[0, 2.4, 0]}>
          <boxGeometry args={[1.8, 2.4, 1.8]} />
        </mesh>
        {withCraft && bus && (
          <group position={[1.6, 0.6, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <SpacecraftModel bus={bus} parts={parts} cutaway={false} deploy={deploy} />
          </group>
        )}
      </group>
    )
  }
  if (spec.payload === 'capsule') {
    // Cargo capsule: a trunk with solar cells below, the capsule with its heat shield on top.
    return (
      <group>
        <mesh material={m.capsule} position={[0, 1.6, 0]}>
          <cylinderGeometry args={[spec.d / 2, spec.d / 2, 3.2, 48]} />
        </mesh>
        <mesh material={m.solar} position={[0, 1.6, 0]}>
          <cylinderGeometry args={[spec.d / 2 + 0.01, spec.d / 2 + 0.01, 2.2, 48, 1, true, 0, Math.PI]} />
        </mesh>
        <mesh material={m.heatShield} position={[0, 3.3, 0]}>
          <cylinderGeometry args={[spec.d / 2, spec.d / 2, 0.2, 48]} />
        </mesh>
        <mesh material={m.capsule} position={[0, 4.9, 0]}>
          <cylinderGeometry args={[spec.d * 0.22, spec.d / 2, 3, 48]} />
        </mesh>
        <mesh material={m.capsule} position={[0, 6.4, 0]}>
          <sphereGeometry args={[spec.d * 0.22, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>
    )
  }
  return (
    <group>
      <Adapter spec={spec} />
      {withCraft && bus && (
        <group position={[0, adapterTop(spec) + craftH / 2, 0]}>
          <SpacecraftModel bus={bus} parts={parts} cutaway={false} deploy={deploy} />
        </group>
      )}
    </group>
  )
}

/** A 1.8 m person, for scale next to the rocket. */
export function Person() {
  const m = mats()
  return (
    <group>
      <mesh material={m.orange} position={[0, 0.75, 0]}>
        <capsuleGeometry args={[0.22, 1, 6, 12]} />
      </mesh>
      <mesh material={m.capsule} position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.17, 16, 12]} />
      </mesh>
    </group>
  )
}
