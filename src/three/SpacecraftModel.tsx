/**
 * The whole spacecraft in 3D: the bus frame (cut open at the front so you can
 * see inside), every internal part packed into its slot cells, and the parts
 * that mount outside (solar panels, antennas, radar panel, magnetometer boom).
 *
 * New parts drop in from above and snap into place; parts slide when the
 * packing changes. Hover a part to see its name; click it to select it.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Bus, Part } from '@/engine/types'
import { busGeom, outsideParts, packParts, type BusGeom, type Placed, type Vec3 } from './craftLayout'
import { mats } from './materials'
import { InsidePart } from './parts3d'
import { TextLabel } from './TextLabel'

export interface SpacecraftModelProps {
  bus: Bus
  parts: Part[]
  /** Open front panel so the inside shows (workbench). */
  cutaway?: boolean
  /** Pull every part out from the bus to show how it fits together. */
  exploded?: boolean
  /** 0 = panels and antennas folded for launch, 1 = deployed. */
  deploy?: number
  /** Parts to outline in red (after a failed flight). */
  problemIds?: string[]
  /** Hover labels and click-to-select. */
  interactive?: boolean
  selectedKey?: string | null
  onSelect?: (key: string | null, part: Part | null) => void
  /** Rendered inside the selected part's label (e.g. a Remove button). */
  selectedActions?: (part: Part) => ReactNode
}

export function SpacecraftModel({ bus, parts, cutaway = true, exploded = false, deploy = 1, problemIds = [], interactive = false, selectedKey, onSelect, selectedActions }: SpacecraftModelProps) {
  const g = useMemo(() => busGeom(bus), [bus])
  const placed = useMemo(() => packParts(bus, parts), [bus, parts])
  const outside = useMemo(() => outsideParts(parts), [parts])
  const [hover, setHover] = useState<string | null>(null)
  const hasBodyCells = parts.some((p) => p.id === 'solar-body')
  const [W, H, D] = g.size

  const pick = (key: string, part: Part) =>
    interactive
      ? {
          onPointerOver: (e: { stopPropagation: () => void }) => (e.stopPropagation(), setHover(key)),
          onPointerOut: () => setHover((h) => (h === key ? null : h)),
          onClick: (e: { stopPropagation: () => void }) => (e.stopPropagation(), onSelect?.(selectedKey === key ? null : key, selectedKey === key ? null : part)),
        }
      : {}

  return (
    <group onPointerMissed={() => interactive && onSelect?.(null, null)}>
      <BusFrame g={g} cutaway={cutaway} solarSides={hasBodyCells} />
      <BusDetails g={g} />

      {placed.map((p) => {
        const target: Vec3 = exploded ? [p.pos[0] * 2.4, p.pos[1] * 1.9 + (p.pos[1] >= 0 ? H * 0.15 : -H * 0.15), p.pos[2] * 2.4 + D * 0.5] : p.pos
        const flagged = p.overflow || problemIds.includes(p.part.id)
        return (
          <Snap key={p.key} target={target} dropFrom={H * 1.6}>
            <group {...pick(p.key, p.part)}>
              <InsidePart part={p.part} size={p.size} toBottom={p.pos[1] - p.size[1] / 2 + H / 2} toBack={p.pos[2] - p.size[2] / 2 + D / 2} />
              {(hover === p.key || selectedKey === p.key || flagged) && <Highlight size={p.size} tone={flagged ? 'bad' : 'accent'} />}
              {(hover === p.key || selectedKey === p.key) && (
                <Label part={p.part} at={[0, p.size[1] / 2, 0]} extra={selectedKey === p.key ? selectedActions?.(p.part) : undefined} overflow={p.overflow} />
              )}
            </group>
          </Snap>
        )
      })}

      {/* Outside: solar panels */}
      {outside.map((o) => (
        <group key={o.key} {...pick(o.key, o.part)}>
          {o.part.id === 'solar-wings' && <Wings g={g} index={o.index} deploy={deploy} big={false} />}
          {o.part.id === 'solar-array' && <Wings g={g} index={o.index} deploy={deploy} big />}
          {(hover === o.key || selectedKey === o.key) && <Label part={o.part} at={[W / 2, H / 2, 0]} extra={selectedKey === o.key ? selectedActions?.(o.part) : undefined} />}
        </group>
      ))}

      {/* Outside elements of internal parts: antennas, radar panel, magnetometer boom */}
      <OutsideElements g={g} placed={placed} deploy={deploy} exploded={exploded} />
    </group>
  )
}

/** Lerps its children to `target`; a newly added part starts above and drops in. */
function Snap({ target, dropFrom, children }: { target: Vec3; dropFrom: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const born = useRef(false)
  useFrame((_, dt) => {
    const o = ref.current
    if (!o) return
    if (!born.current) {
      born.current = true
      o.position.set(target[0], target[1] + dropFrom, target[2])
      o.scale.setScalar(0.4)
    }
    const k = 1 - Math.exp(-dt * 9)
    o.position.x += (target[0] - o.position.x) * k
    o.position.y += (target[1] - o.position.y) * k
    o.position.z += (target[2] - o.position.z) * k
    o.scale.setScalar(o.scale.x + (1 - o.scale.x) * k)
  })
  return <group ref={ref}>{children}</group>
}

function Highlight({ size, tone }: { size: Vec3; tone: 'accent' | 'bad' }) {
  return (
    <mesh scale={[1.04, 1.04, 1.04]} raycast={() => null}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={tone === 'bad' ? '#ff5c6c' : '#ffffff'} wireframe transparent opacity={0.9} />
    </mesh>
  )
}

/** Part name drawn in the scene (no HTML, so it can't break when the view closes). */
function Label({ part, at, overflow }: { part: Part; at: Vec3; extra?: ReactNode; overflow?: boolean }) {
  return <TextLabel text={part.name} sub={overflow ? "Doesn't fit in the bus" : undefined} position={at} anchor="above" color={overflow ? '#ff5c6c' : '#e8edf8'} />
}

// ---------------------------------------------------------------- bus frame

function BusFrame({ g, cutaway, solarSides }: { g: BusGeom; cutaway: boolean; solarSides: boolean }) {
  const m = mats()
  const [W, H, D] = g.size
  const t = g.cell * (g.skin === 'cubesat' ? 0.085 : 0.05)
  const side = solarSides ? m.solar : g.skin === 'foil' ? m.gold : m.cubePanel
  const plate = g.skin === 'foil' ? m.whitePaint : m.aluminium
  const levels = g.grid[1]
  return (
    <group>
      {/* Corner rails (CubeSat rails are what slides along the deployer) */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`r${sx}${sz}`} material={g.skin === 'cubesat' ? m.rail : m.anodised} position={[sx * (W / 2 - t / 2), 0, sz * (D / 2 - t / 2)]}>
            <boxGeometry args={[t, H + (g.skin === 'cubesat' ? t * 1.6 : 0), t]} />
          </mesh>
        )),
      )}
      {/* Top and bottom decks */}
      {[-1, 1].map((sy) => (
        <mesh key={`p${sy}`} material={plate} position={[0, sy * (H / 2 - t / 4), 0]}>
          <boxGeometry args={[W, t / 2, D]} />
        </mesh>
      ))}
      {/* Side panels: left, right, back (and front when closed) */}
      <mesh material={side} position={[W / 2 - t * 0.3, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D - t * 2, H - t]} />
      </mesh>
      <mesh material={side} position={[-W / 2 + t * 0.3, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D - t * 2, H - t]} />
      </mesh>
      <mesh material={side} position={[0, 0, -D / 2 + t * 0.3]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W - t * 2, H - t]} />
      </mesh>
      {/* Inside of the walls, so the cutaway shows a lining, not see-through faces */}
      <mesh material={g.skin === 'foil' ? m.silverFoil : m.anodised} position={[0, 0, -D / 2 + t * 0.35]}>
        <planeGeometry args={[W - t * 2, H - t]} />
      </mesh>
      <mesh material={g.skin === 'foil' ? m.silverFoil : m.anodised} position={[W / 2 - t * 0.35, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D - t * 2, H - t]} />
      </mesh>
      <mesh material={g.skin === 'foil' ? m.silverFoil : m.anodised} position={[-W / 2 + t * 0.35, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D - t * 2, H - t]} />
      </mesh>
      {cutaway ? (
        // Shelf edges at each level, so you can read the slot grid from the front
        Array.from({ length: levels - 1 }, (_, i) => (
          <mesh key={`s${i}`} material={m.anodised} position={[0, -H / 2 + ((i + 1) * H) / levels, D / 2 - t / 2]}>
            <boxGeometry args={[W - t * 2, t * 0.35, t * 0.35]} />
          </mesh>
        ))
      ) : (
        <mesh material={side} position={[0, 0, D / 2 - t * 0.3]}>
          <planeGeometry args={[W - t * 2, H - t]} />
        </mesh>
      )}
    </group>
  )
}

/**
 * Small things every real spacecraft has: CubeSat rail feet and deployment
 * springs; on bigger buses a launch-adapter ring, a white radiator and
 * attitude-thruster pods; and on all of them a star tracker (with its sun
 * baffle) and coarse sun sensors.
 */
function BusDetails({ g }: { g: BusGeom }) {
  const m = mats()
  const [W, H, D] = g.size
  const t = g.cell * (g.skin === 'cubesat' ? 0.085 : 0.05)
  const c = g.cell
  return (
    <group>
      {g.skin === 'cubesat' ? (
        <>
          {/* Rail feet top and bottom, springs that push the CubeSat out of its deployer */}
          {[-1, 1].flatMap((sx) =>
            [-1, 1].flatMap((sz) =>
              [-1, 1].map((sy) => (
                <group key={`${sx}${sz}${sy}`} position={[sx * (W / 2 - t / 2), sy * (H / 2 + t * 0.9), sz * (D / 2 - t / 2)]}>
                  <mesh material={sy > 0 && sx > 0 ? m.orange : m.anodised}>
                    <cylinderGeometry args={[t * 0.35, t * 0.35, t * 0.6, 10]} />
                  </mesh>
                </group>
              )),
            ),
          )}
          {/* Kill-switch tab at the foot of one rail */}
          <mesh material={m.black} position={[W / 2 - t / 2, -H / 2 + t, D / 2 + t * 0.3]}>
            <boxGeometry args={[t * 0.6, t * 1.4, t * 0.4]} />
          </mesh>
        </>
      ) : (
        <>
          {/* Launch adapter ring: the bolted ring that held the craft on the rocket */}
          <mesh material={m.aluminium} position={[0, -H / 2 - c * 0.08, 0]}>
            <cylinderGeometry args={[Math.min(W, D) * 0.38, Math.min(W, D) * 0.42, c * 0.16, 40, 1, true]} />
          </mesh>
          <mesh material={m.anodised} position={[0, -H / 2 - c * 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[Math.min(W, D) * 0.42, c * 0.03, 8, 40]} />
          </mesh>
          {/* White radiator on the back, facing deep space to dump heat */}
          <mesh material={m.radiator} position={[0, 0, -D / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[W * 0.8, H * 0.7]} />
          </mesh>
          {/* Attitude-thruster pods on the bottom corners */}
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <group key={`t${sx}${sz}`} position={[sx * (W / 2 - c * 0.12), -H / 2 + c * 0.15, sz * (D / 2 - c * 0.12)]}>
                <mesh material={m.anodised}>
                  <boxGeometry args={[c * 0.18, c * 0.18, c * 0.18]} />
                </mesh>
                <mesh material={m.nozzle} position={[sx * c * 0.12, 0, 0]} rotation={[0, 0, (sx * Math.PI) / 2]}>
                  <cylinderGeometry args={[c * 0.03, c * 0.06, c * 0.08, 10, 1, true]} />
                </mesh>
              </group>
            )),
          )}
        </>
      )}
      {/* Star tracker: a small camera that finds its way by the stars, with a baffle against sunlight */}
      <group position={[-W * 0.28, H / 2, -D * 0.28]} rotation={[0.35, 0.6, 0]}>
        <mesh material={m.black} position={[0, c * 0.1, 0]}>
          <boxGeometry args={[c * 0.22, c * 0.2, c * 0.22]} />
        </mesh>
        <mesh material={m.anodised} position={[0, c * 0.3, 0]}>
          <cylinderGeometry args={[c * 0.16, c * 0.08, c * 0.22, 20, 1, true]} />
        </mesh>
      </group>
      {/* Coarse sun sensors on two corners of the top deck */}
      {[
        [W * 0.38, D * 0.38],
        [-W * 0.38, D * 0.38],
      ].map(([x, z], i) => (
        <mesh key={i} material={m.glass} position={[x, H / 2 + c * 0.015, z]}>
          <boxGeometry args={[c * 0.08, c * 0.03, c * 0.08]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- outside parts

/** A solar panel: cells on top, dark backing below. */
function SolarPanel({ l, w, thick }: { l: number; w: number; thick: number }) {
  const m = mats()
  const faces = useMemo(() => [m.panelBack, m.panelBack, m.solar, m.panelBack, m.panelBack, m.panelBack], [m])
  return (
    <mesh material={faces}>
      <boxGeometry args={[l, thick, w]} />
    </mesh>
  )
}

/**
 * Deployable wings, one each side. Copy 0 hinges on the left/right faces, copy 1
 * on the front/back. Folded (deploy 0) they hang flat against the sides.
 */
function Wings({ g, index, deploy, big }: { g: BusGeom; index: number; deploy: number; big: boolean }) {
  const m = mats()
  const [W, H, D] = g.size
  const alongX = index % 2 === 0
  const half = alongX ? W / 2 : D / 2
  const width = (alongX ? D : W) * (big ? 1.1 : 0.92)
  const panelL = big ? H * 0.95 : H * 0.92
  // CubeSat wings fold out in two panels per side; big arrays in three.
  const panels = big ? 3 : 2
  const boom = big ? half * 0.6 : 0
  const thick = g.cell * 0.04
  const fold = (1 - deploy) * (Math.PI / 2)
  return (
    <group rotation={[0, alongX ? 0 : Math.PI / 2, 0]}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * (alongX ? W / 2 : D / 2), big ? 0 : H / 2 - thick, 0]} rotation={[0, 0, -s * fold]}>
          {big && (
            <mesh material={m.aluminium} position={[(s * boom) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[g.cell * 0.05, g.cell * 0.05, boom, 10]} />
            </mesh>
          )}
          {Array.from({ length: panels }, (_, i) => (
            <group key={i} position={[s * (boom + panelL * (i + 0.5) * 1.02), 0, 0]}>
              <SolarPanel l={panelL} w={width} thick={thick} />
              {/* Aluminium frame round the cells, and a hinge bracket between panels */}
              <mesh material={m.frame} position={[0, -thick * 0.2, 0]}>
                <boxGeometry args={[panelL * 1.01, thick * 0.8, width * 1.03]} />
              </mesh>
              {i > 0 && (
                <mesh material={m.anodised} position={[-s * panelL * 0.51, 0, 0]}>
                  <boxGeometry args={[thick * 2, thick * 2.5, width * 0.6]} />
                </mesh>
              )}
            </group>
          ))}
          {/* Orange hinge */}
          <mesh material={m.orange} position={[s * thick, 0, 0]}>
            <boxGeometry args={[thick * 2, thick * 2, width * 0.3]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function OutsideElements({ g, placed, deploy, exploded }: { g: BusGeom; placed: Placed[]; deploy: number; exploded: boolean }) {
  const m = mats()
  const [W, H, D] = g.size
  const top = H / 2 + (exploded ? H * 0.5 : 0)
  const ids = placed.filter((p) => !p.overflow).map((p) => p.part.id)
  const n = (id: string) => ids.filter((x) => x === id).length
  const whip = Math.max(W, H) * 1.1 * Math.max(0.05, deploy)
  return (
    <group>
      {/* UHF: four tape-measure whips that spring out of the top corners after launch */}
      {n('antenna-uhf') > 0 &&
        [
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ].map(([sx, sz], i) => (
          <group key={i} position={[(sx * W) / 2, top, (sz * D) / 2]} rotation={[sz * 1.35, 0, -sx * 1.35]}>
            <mesh material={m.rail} position={[0, whip / 2, 0]}>
              <boxGeometry args={[g.cell * 0.02, whip, g.cell * 0.005]} />
            </mesh>
          </group>
        ))}
      {/* S-band: flat gold patch antennas on the top deck */}
      {Array.from({ length: n('antenna-s') }, (_, i) => (
        <group key={i} position={[-W * 0.25 + i * W * 0.2, top + g.cell * 0.01, D * 0.2]}>
          <mesh material={m.gold}>
            <boxGeometry args={[g.cell * 0.55, g.cell * 0.02, g.cell * 0.55]} />
          </mesh>
          <mesh material={m.orange} position={[0, g.cell * 0.015, 0]}>
            <cylinderGeometry args={[g.cell * 0.05, g.cell * 0.05, g.cell * 0.01, 12]} />
          </mesh>
        </group>
      ))}
      {/* X-band: a small dish on a mast */}
      {Array.from({ length: n('antenna-x') }, (_, i) => (
        <group key={i} position={[W * 0.25 - i * W * 0.3, top, -D * 0.15]}>
          <mesh material={m.aluminium} position={[0, g.cell * 0.2, 0]}>
            <cylinderGeometry args={[g.cell * 0.04, g.cell * 0.05, g.cell * 0.4, 10]} />
          </mesh>
          {/* Dish: a bowl opening upward (and tilting toward Earth once deployed) */}
          <group position={[0, g.cell * 0.4, 0]} rotation={[0.45 * deploy, 0, 0]}>
            <mesh material={m.whitePaint} position={[0, g.cell * 0.9, 0]} rotation={[Math.PI, 0, 0]}>
              <sphereGeometry args={[g.cell * 0.9, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.2]} />
            </mesh>
            <mesh material={m.aluminium} position={[0, g.cell * 0.32, 0]}>
              <cylinderGeometry args={[g.cell * 0.012, g.cell * 0.012, g.cell * 0.5, 6]} />
            </mesh>
          </group>
          <mesh material={m.orange} position={[0, g.cell * 0.98, g.cell * 0.2 * deploy]}>
            <sphereGeometry args={[g.cell * 0.05, 10, 8]} />
          </mesh>
        </group>
      ))}
      {/* Radar: a big flat antenna panel under the craft, unfolding like a book */}
      {n('radar') > 0 && (
        <group position={[0, -H / 2 - g.cell * 0.15 - (exploded ? H * 0.4 : 0), 0]}>
          {[-1, 1].map((s) => (
            <group key={s} rotation={[0, 0, s * (1 - deploy) * (Math.PI / 2)]}>
              <mesh material={m.aluminium} position={[(s * W * 1.1) / 2, 0, 0]}>
                <boxGeometry args={[W * 1.1, g.cell * 0.06, D * 1.3]} />
              </mesh>
              <mesh material={m.black} position={[(s * W * 1.1) / 2, -g.cell * 0.035, 0]}>
                <boxGeometry args={[W * 1.05, g.cell * 0.01, D * 1.25]} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {/* Magnetometer: sensor at the end of a boom, far from the craft's own magnetic noise */}
      {n('magnetometer') > 0 && (
        <group position={[-W / 2, top, -D / 2]} rotation={[0, Math.PI / 4, (Math.PI / 2) * (1 - deploy) + 0.6]}>
          <mesh material={m.rail} position={[0, H * 0.75, 0]}>
            <cylinderGeometry args={[g.cell * 0.02, g.cell * 0.02, H * 1.5, 8]} />
          </mesh>
          <mesh material={m.orange} position={[0, H * 1.5, 0]}>
            <boxGeometry args={[g.cell * 0.15, g.cell * 0.15, g.cell * 0.15]} />
          </mesh>
        </group>
      )}
    </group>
  )
}
