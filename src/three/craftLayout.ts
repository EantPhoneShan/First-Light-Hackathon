/**
 * Where every part goes on the 3D craft. Pure maths, no three.js.
 *
 * The bus is a box of slot cells (Member 1's `slots`): a 6U CubeSat is 2 wide,
 * 3 tall and 1 deep, a small satellite 2x4x2, a large one 4x4x2. Internal parts
 * are packed into cells (a 2-slot imager takes two cells side by side), from the
 * bottom up: instruments first, so their lenses look out of the bottom (nadir)
 * face, then propulsion, batteries, attitude control, computers, radios on top.
 * Slot-free parts (solar panels) and antennas also get outside mounts.
 */
import type { Bus, Part, PartCategory } from '@/engine/types'

export type Vec3 = [number, number, number]

export interface BusGeom {
  /** Cells along x (width), y (height), z (depth). */
  grid: Vec3
  /** Size of one cell in metres. */
  cell: number
  /** Outer size of the bus in metres. */
  size: Vec3
  /** Gold-foil skin (small and large satellites) or bare aluminium panels (CubeSats). */
  skin: 'cubesat' | 'foil'
}

export function busGeom(bus: Bus): BusGeom {
  const grid: Vec3 = bus.size === 'cubesat' ? [2, 3, 1] : bus.size === 'smallsat' ? [2, 4, 2] : [4, 4, 2]
  const cell = bus.size === 'cubesat' ? 0.11 : bus.size === 'smallsat' ? 0.25 : 0.5
  return { grid, cell, size: [grid[0] * cell, grid[1] * cell, grid[2] * cell], skin: bus.size === 'cubesat' ? 'cubesat' : 'foil' }
}

export interface Placed {
  /** Stable key for this copy of the part, e.g. "camera#0". */
  key: string
  part: Part
  /** Centre in metres, relative to the bus centre. */
  pos: Vec3
  /** Size of the block of cells it fills, in metres. */
  size: Vec3
  /** Cells it fills, e.g. [2,1,1]. */
  cells: Vec3
  /** Didn't fit in the bus (too many slots): shown floating, outlined red. */
  overflow: boolean
}

const order: Record<PartCategory, number> = { instrument: 0, propulsion: 1, battery: 2, thermal: 3, adcs: 4, computer: 5, antenna: 6, solar: 7 }

/** Block shapes (x, y, z) that hold `s` cells, flattest first. */
function shapes(s: number, [nx, ny, nz]: Vec3): Vec3[] {
  const out: Vec3[] = []
  for (let b = 1; b <= ny; b++)
    for (let a = 1; a <= nx; a++)
      for (let c = 1; c <= nz; c++) if (a * b * c === s) out.push([a, b, c])
  return out.sort((p, q) => p[1] - q[1] || Math.abs(p[0] - p[2]) - Math.abs(q[0] - q[2]))
}

/** Pack the craft's internal parts into the bus. Parts with 0 slots are skipped (they mount outside). */
export function packParts(bus: Bus, parts: Part[]): Placed[] {
  const g = busGeom(bus)
  const [nx, ny, nz] = g.grid
  const used = new Set<string>()
  const free = (x: number, y: number, z: number, [a, b, c]: Vec3) => {
    if (x + a > nx || y + b > ny || z + c > nz) return false
    for (let i = x; i < x + a; i++) for (let j = y; j < y + b; j++) for (let k = z; k < z + c; k++) if (used.has(`${i},${j},${k}`)) return false
    return true
  }
  const counts: Record<string, number> = {}
  const keyed = parts.map((p) => ({ p, key: `${p.id}#${(counts[p.id] = (counts[p.id] ?? -1) + 1)}` }))
  const inside = keyed.filter(({ p }) => p.slots > 0).sort((a, b) => order[a.p.category] - order[b.p.category])

  const out: Placed[] = []
  let spill = 0
  for (const { p, key } of inside) {
    let spot: { at: Vec3; shape: Vec3 } | null = null
    search: for (const shape of shapes(p.slots, g.grid))
      for (let y = 0; y < ny; y++)
        for (let z = nz - 1; z >= 0; z--)
          for (let x = 0; x < nx; x++)
            if (free(x, y, z, shape)) {
              spot = { at: [x, y, z], shape }
              break search
            }
    if (spot) {
      const [x, y, z] = spot.at
      const [a, b, c] = spot.shape
      for (let i = x; i < x + a; i++) for (let j = y; j < y + b; j++) for (let k = z; k < z + c; k++) used.add(`${i},${j},${k}`)
      out.push({
        key,
        part: p,
        cells: spot.shape,
        size: [a * g.cell, b * g.cell, c * g.cell],
        pos: [(x + a / 2) * g.cell - g.size[0] / 2, (y + b / 2) * g.cell - g.size[1] / 2, (z + c / 2) * g.cell - g.size[2] / 2],
        overflow: false,
      })
    } else {
      // No room: float it beside the craft so the player sees what doesn't fit.
      const side = Math.cbrt(p.slots) * g.cell
      out.push({ key, part: p, cells: [1, 1, 1], size: [side, side, side], pos: [g.size[0] / 2 + side * 1.2 + spill, -g.size[1] / 2 + side / 2, g.size[2] / 2 + side], overflow: true })
      spill += side * 1.3
    }
  }
  return out
}

/** Outside parts (solar panels), with which copy they are, for mounting on alternating faces. */
export function outsideParts(parts: Part[]): { key: string; part: Part; index: number }[] {
  const n: Record<string, number> = {}
  return parts.filter((p) => p.slots === 0).map((p) => {
    const index = (n[p.id] = (n[p.id] ?? -1) + 1)
    return { key: `${p.id}#${index}`, part: p, index }
  })
}
