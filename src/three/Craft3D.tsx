/**
 * Workbench 3D view (CML 4 point design). Every part you add drops into its
 * slot in the bus; drag to orbit, scroll or pinch to zoom, click a part to
 * select it. Loaded lazily so three.js only downloads when it's needed.
 */
import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Box, Expand, PanelTopOpen, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Bus, Part } from '@/engine/types'
import { cn } from '@/lib/cn'
import { busGeom } from './craftLayout'
import { SpacecraftModel } from './SpacecraftModel'
import { Earth, SpaceLights } from './Stage'

type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>

export interface Craft3DProps {
  bus?: Bus
  parts: Part[]
  problemIds?: string[]
  /** May this player take this part off? */
  canRemove?: (p: Part) => boolean
  onRemove?: (partId: string) => void
  /** Empty-state text when there is no bus yet. */
  empty?: ReactNode
}

/** Puts the camera at a good distance for this bus; re-runs when the bus or "reset" changes. */
function CameraRig({ size, resetKey, controls }: { size: number; resetKey: number; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    const d = size * 3.2
    camera.position.set(d * 0.75, d * 0.5, d * 0.95)
    camera.near = size / 100
    camera.far = size * 400
    camera.updateProjectionMatrix()
    controls.current?.target.set(0, 0, 0)
    controls.current?.update()
  }, [size, resetKey, camera, controls])
  return null
}

export default function Craft3D({ bus, parts, problemIds, canRemove = () => true, onRemove, empty }: Craft3DProps) {
  const [exploded, setExploded] = useState(false)
  const [cutaway, setCutaway] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedPart, setSelectedPart] = useState<Part | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const controls = useRef<OrbitControlsImpl>(null)
  const size = bus ? Math.max(...busGeom(bus).size) : 0.3

  // A part that was removed can't stay selected.
  useEffect(() => {
    if (selected && !parts.some((p) => selected.startsWith(`${p.id}#`))) setSelected(null)
  }, [parts, selected])

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-xl bg-[url('/assets/bg/stars.webp')] bg-cover bg-center sm:h-[480px]">
      <Canvas dpr={[1, 2]} camera={{ fov: 35 }} gl={{ antialias: true, alpha: true }} aria-label="3D spacecraft">
        <SpaceLights photoBackdrop />
        {/* Earth far below, so the craft looks like it's already in orbit */}
        <group position={[size * 4, -size * 34, -size * 18]}>
          <Earth radius={size * 30} segments={96} />
        </group>
        <CameraRig size={size} resetKey={resetKey} controls={controls} />
        <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={size * 1.2} maxDistance={size * 9} autoRotate={!selected} autoRotateSpeed={0.6} />
        {bus && (
          <SpacecraftModel
            bus={bus}
            parts={parts}
            cutaway={cutaway}
            exploded={exploded}
            problemIds={problemIds}
            interactive
            selectedKey={selected}
            onSelect={(k, p) => (setSelected(k), setSelectedPart(p))}
          />
        )}
      </Canvas>

      {/* The selected part, with Remove: a normal panel over the view (not inside the 3D scene) */}
      {bus && selected && selectedPart && (
        <div className="absolute inset-x-2 bottom-10 flex items-center gap-2 rounded-lg border border-accent/60 bg-space-900/95 px-3 py-2 text-sm shadow-xl sm:right-auto">
          <span className="min-w-0 flex-1 truncate font-medium">{selectedPart.name}</span>
          {onRemove && canRemove(selectedPart) && (
            <button
              onClick={() => {
                onRemove(selectedPart.id)
                setSelected(null)
              }}
              className="rounded-md bg-bad/20 px-3 py-1.5 text-bad hover:bg-bad/30"
            >
              Remove
            </button>
          )}
          <button onClick={() => setSelected(null)} className="rounded-md px-2 py-1.5 text-muted hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>
      )}

      {!bus && <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted">{empty}</div>}

      {bus && (
        <div className="absolute top-2 left-2 flex gap-1.5">
          <ToolButton on={exploded} onClick={() => setExploded((v) => !v)} icon={Expand} label="Exploded view" />
          <ToolButton on={cutaway} onClick={() => setCutaway((v) => !v)} icon={PanelTopOpen} label="Open panel" />
          <ToolButton on={false} onClick={() => setResetKey((k) => k + 1)} icon={RotateCcw} label="Reset view" />
        </div>
      )}
      {bus && (
        <p className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-space-950/70 px-2 py-1 text-[11px] text-muted">
          <Box className="size-3" aria-hidden />
          <span className="pointer-coarse:hidden">Drag to turn · scroll to zoom · click a part</span>
          <span className="hidden pointer-coarse:inline">Drag to turn · pinch to zoom · tap a part</span>
        </p>
      )}
    </div>
  )
}

function ToolButton({ on, onClick, icon: Icon, label }: { on: boolean; onClick: () => void; icon: typeof Box; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      title={label}
      className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs backdrop-blur transition-colors', on ? 'border-accent bg-accent/20 text-ink' : 'border-space-600 bg-space-900/70 text-muted hover:text-ink')}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
