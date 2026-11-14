import { BatteryFull, Box, Camera, Compass, Cpu, Flame, RadioTower, Sun, Thermometer, type LucideIcon } from 'lucide-react'
import { Art } from '@/components/Art'
import type { Part, PartCategory } from '@/engine/types'
import { cn } from '@/lib/cn'

export const categoryIcon: Record<PartCategory, LucideIcon> = {
  bus: Box,
  power: Sun,
  battery: BatteryFull,
  comms: RadioTower,
  computer: Cpu,
  attitude: Compass,
  propulsion: Flame,
  thermal: Thermometer,
  instrument: Camera,
}

export const categoryLabel: Record<PartCategory, string> = {
  bus: 'Bus',
  power: 'Power',
  battery: 'Battery',
  comms: 'Comms',
  computer: 'Computer',
  attitude: 'Attitude',
  propulsion: 'Propulsion',
  thermal: 'Thermal',
  instrument: 'Instruments',
}

/** The part's art (ChatGPT WebP or built-in SVG, named by part id); falls back to a category icon. */
export function PartIcon({ part, className }: { part: Part; className?: string }) {
  const Icon = categoryIcon[part.category]
  return (
    <Art
      name={`part-${part.id}`}
      className={className}
      fallback={
        <span className={cn('flex items-center justify-center rounded-lg bg-space-700 text-accent', className)}>
          <Icon className="size-1/2" aria-hidden />
        </span>
      }
    />
  )
}
