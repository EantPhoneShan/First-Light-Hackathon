/**
 * Procedural 3D models of every part, drawn to fill the block of slot cells it
 * takes inside the bus (see craftLayout.ts). Real-looking details: cylindrical
 * battery cells, stacked circuit boards, a spinning reaction wheel, a gas tank,
 * lens barrels that look out through the bottom (nadir) panel.
 */
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { Part } from '@/engine/types'
import { mats } from './materials'
import type { Vec3 } from './craftLayout'

interface InsideProps {
  part: Part
  /** Block size in metres (already the full cells; we leave a small gap). */
  size: Vec3
  /** Distance from the block's bottom face down to the bus's bottom face (for lenses). */
  toBottom: number
  /** Distance from the block's back face to the bus's back face (for thruster nozzles). */
  toBack: number
}

/** The model for a part inside the bus, centred on (0,0,0). */
export function InsidePart({ part, size, toBottom, toBack }: InsideProps) {
  const [w, h, d] = size.map((v) => v * 0.9) as Vec3
  switch (part.category) {
    case 'battery':
      return <Battery w={w} h={h} d={d} big={part.id !== 'battery-small'} />
    case 'computer':
      return <Computer w={w} h={h} d={d} />
    case 'adcs':
      return part.id === 'reaction-wheel' ? <ReactionWheels w={w} h={h} d={d} /> : <Magnetorquer w={w} h={h} d={d} />
    case 'propulsion':
      return <Thruster w={w} h={h} d={d} toBack={toBack} />
    case 'antenna':
      return <Radio w={w} h={h} d={d} />
    case 'instrument':
      return <Instrument id={part.id} w={w} h={h} d={d} toBottom={toBottom} />
    default:
      return (
        <mesh material={mats().aluminium}>
          <boxGeometry args={[w, h, d]} />
        </mesh>
      )
  }
}

type Box = { w: number; h: number; d: number }

function Battery({ w, h, d, big }: Box & { big: boolean }) {
  const m = mats()
  const n = big ? 3 : 2
  const r = Math.min(w, d) / (n * 2.3)
  const cells: [number, number][] = []
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) cells.push([(i - (n - 1) / 2) * r * 2.2, (k - (n - 1) / 2) * r * 2.2])
  return (
    <group>
      <mesh material={m.black} position={[0, -h / 2 + h * 0.06, 0]}>
        <boxGeometry args={[w, h * 0.12, d]} />
      </mesh>
      {cells.map(([x, z], i) => (
        <group key={i} position={[x, -h * 0.02, z]}>
          <mesh material={m.battery}>
            <cylinderGeometry args={[r, r, h * 0.7, 20]} />
          </mesh>
          <mesh material={m.aluminium} position={[0, h * 0.36, 0]}>
            <cylinderGeometry args={[r * 0.45, r * 0.45, h * 0.03, 12]} />
          </mesh>
        </group>
      ))}
      <mesh material={m.pcb} position={[0, h / 2 - h * 0.08, 0]}>
        <boxGeometry args={[w, h * 0.05, d]} />
      </mesh>
      <mesh material={m.orange} position={[w * 0.35, h / 2 - h * 0.02, d * 0.35]}>
        <boxGeometry args={[w * 0.12, h * 0.08, d * 0.12]} />
      </mesh>
    </group>
  )
}

function Computer({ w, h, d }: Box) {
  const m = mats()
  const boards = 3
  return (
    <group>
      {Array.from({ length: boards }, (_, i) => {
        const y = -h / 2 + (h / boards) * (i + 0.5)
        return (
          <group key={i} position={[0, y, 0]}>
            <mesh material={m.pcb}>
              <boxGeometry args={[w, h * 0.04, d]} />
            </mesh>
            <mesh material={m.black} position={[w * 0.1 * (i - 1), h * 0.04, 0]}>
              <boxGeometry args={[w * 0.32, h * 0.04, d * 0.32]} />
            </mesh>
            <mesh material={m.anodised} position={[-w * 0.35, h * 0.03, d * 0.35]}>
              <boxGeometry args={[w * 0.15, h * 0.05, d * 0.1]} />
            </mesh>
          </group>
        )
      })}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} material={m.rail} position={[sx * w * 0.44, 0, sz * d * 0.44]}>
            <cylinderGeometry args={[w * 0.02, w * 0.02, h, 6]} />
          </mesh>
        )),
      )}
    </group>
  )
}

function Magnetorquer({ w, h, d }: Box) {
  const m = mats()
  return (
    <group>
      <mesh material={m.pcb} position={[0, -h * 0.3, 0]}>
        <boxGeometry args={[w, h * 0.05, d]} />
      </mesh>
      {/* Two torque rods and an air-core coil: copper wound on a frame */}
      {[-0.22, 0.22].map((z, i) => (
        <mesh key={i} material={m.copper} position={[0, -h * 0.1, z * d]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[h * 0.09, h * 0.09, w * 0.8, 16]} />
        </mesh>
      ))}
      <mesh material={m.copper} position={[0, h * 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[Math.min(w, d) * 0.33, h * 0.05, 8, 32]} />
      </mesh>
    </group>
  )
}

function ReactionWheels({ w, h, d }: Box) {
  const m = mats()
  const spin = useRef<THREE.Group>(null)
  // Wheels really spin all the time: that's how the craft turns without fuel.
  useFrame((_, dt) => {
    spin.current?.children.forEach((c, i) => (c.rotation.y += dt * (6 + i * 2)))
  })
  const r = Math.min(w, d) * 0.22
  return (
    <group>
      <mesh material={m.anodised} position={[0, -h / 2 + h * 0.05, 0]}>
        <boxGeometry args={[w, h * 0.1, d]} />
      </mesh>
      <group ref={spin}>
        {[
          [-w * 0.24, 0, -d * 0.2],
          [w * 0.24, 0, -d * 0.2],
          [0, 0, d * 0.22],
        ].map((p, i) => (
          <group key={i} position={p as Vec3}>
            <mesh material={m.aluminium}>
              <cylinderGeometry args={[r, r, h * 0.25, 28]} />
            </mesh>
            <mesh material={m.black} position={[r * 0.6, h * 0.13, 0]}>
              <boxGeometry args={[r * 0.3, h * 0.02, r * 0.1]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

function Thruster({ w, h, d, toBack }: Box & { toBack: number }) {
  const m = mats()
  const r = Math.min(w, h, d) * 0.4
  return (
    <group>
      <mesh material={m.tank}>
        <sphereGeometry args={[r, 32, 16]} />
      </mesh>
      <mesh material={m.copper} position={[0, 0, -r * 1.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.08, r * 0.08, r * 0.6, 8]} />
      </mesh>
      {/* Nozzle pokes out of the back panel */}
      <mesh material={m.nozzle} position={[0, 0, -d / 2 - toBack - r * 0.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.35, r * 0.1, r * 0.6, 20, 1, true]} />
      </mesh>
    </group>
  )
}

function Radio({ w, h, d }: Box) {
  const m = mats()
  return (
    <group>
      <mesh material={m.aluminium}>
        <boxGeometry args={[w * 0.9, h * 0.7, d * 0.9]} />
      </mesh>
      {[-0.25, 0.25].map((x) => (
        <mesh key={x} material={m.copper} position={[x * w, h * 0.38, 0]}>
          <cylinderGeometry args={[w * 0.05, w * 0.05, h * 0.12, 8]} />
        </mesh>
      ))}
      <mesh material={m.black} position={[0, 0, d * 0.46]}>
        <boxGeometry args={[w * 0.5, h * 0.2, d * 0.02]} />
      </mesh>
    </group>
  )
}

function Instrument({ id, w, h, d, toBottom }: Box & { id: string; toBottom: number }) {
  const m = mats()
  const housing = id === 'thermal-imager' ? m.gold : id === 'radar' ? m.aluminium : m.black
  const lensR = Math.min(w, d) * (id === 'multispectral-imager' ? 0.14 : 0.3)
  const lensLen = h * 0.4 + toBottom
  const lenses: [number, number][] = id === 'multispectral-imager' ? [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] : id === 'radar' || id === 'magnetometer' ? [] : [[0, 0]]
  return (
    <group>
      <mesh material={housing} position={[0, h * 0.15, 0]}>
        <boxGeometry args={[w, h * 0.7, d]} />
      </mesh>
      {id === 'spectrometer' && (
        <mesh material={m.orange} position={[0, h * 0.2, d / 2 + 0.001]}>
          <boxGeometry args={[w * 0.6, h * 0.04, d * 0.01]} />
        </mesh>
      )}
      {id === 'radar' && (
        <mesh material={m.pcb} position={[0, -h * 0.3, 0]}>
          <boxGeometry args={[w * 0.9, h * 0.1, d * 0.9]} />
        </mesh>
      )}
      {id === 'magnetometer' && (
        <mesh material={m.pcb} position={[0, -h * 0.3, 0]}>
          <boxGeometry args={[w * 0.8, h * 0.06, d * 0.8]} />
        </mesh>
      )}
      {lenses.map(([x, z], i) => (
        <group key={i} position={[x * w, -h * 0.2 - lensLen / 2, z * d]}>
          <mesh material={id === 'thermal-imager' ? m.gold : m.anodised}>
            <cylinderGeometry args={[lensR, lensR * 1.1, lensLen, 28]} />
          </mesh>
          <mesh material={id === 'thermal-imager' ? m.glass : m.lensCoat} position={[0, -lensLen / 2 - 0.0005, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[lensR * 0.85, 28]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
