import { useState, type ReactNode } from 'react'
import { webpArt } from '@/content/artManifest'
import { cn } from '@/lib/cn'

/**
 * Game art by name, e.g. "part-bus-6u", "rocket-small", "role-planner".
 * Uses the ChatGPT WebP if it has been processed (see art/README.md), otherwise the built-in SVG,
 * otherwise `fallback`. Decorative by default (alt="").
 */
export function Art({ name, alt = '', className, fallback }: { name: string; alt?: string; className?: string; fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false)
  const svgName = name.replace(/^part-/, '')
  const src = webpArt.has(name) ? `/assets/${name}.webp` : `/assets/svg/${svgName}.svg`
  if (failed && fallback) return <>{fallback}</>
  return <img src={src} alt={alt} draggable={false} className={cn('object-contain', className)} onError={() => setFailed(true)} />
}
