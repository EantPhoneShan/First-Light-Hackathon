import { BatteryFull, Box, Camera, Compass, Cpu, Flame, RadioTower, Sun, Thermometer, type LucideIcon } from 'lucide-react'
import { Art } from '@/components/Art'
import type { PartCategory } from '@/engine/types'
import { cn } from '@/lib/cn'

export const categoryIcon: Record<PartCategory | 'bus', LucideIcon> = {
  bus: Box,
  solar: Sun,
  battery: BatteryFull,
  antenna: RadioTower,
  computer: Cpu,
  adcs: Compass,
  propulsion: Flame,
  thermal: Thermometer,
  instrument: Camera,
}

/** Art for a part or bus (ChatGPT WebP or built-in SVG, named by id); falls back to a category icon. */
export function PartIcon({ item, className }: { item: { id: string; category?: PartCategory }; className?: string }) {
  const Icon = categoryIcon[item.category ?? 'bus']
  return (
    <Art
      name={`part-${item.id}`}
      className={className}
      fallback={
        <span className={cn('flex items-center justify-center rounded-lg bg-space-700 text-accent', className)}>
          <Icon className="size-1/2" aria-hidden />
        </span>
      }
    />
  )
}
