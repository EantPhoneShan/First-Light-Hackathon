import type { Orbit } from '@/engine/types'

interface OrbitPreviewProps {
  orbit: Orbit
  altitudeKm: number
  periodMin: number
}

const CX = 120
const CY = 120
const R_EARTH = 38

/** Side view: Earth, its shadow (Sun on the left), and the craft circling at the chosen altitude. */
export function OrbitPreview({ orbit, altitudeKm, periodMin }: OrbitPreviewProps) {
  const deep = false // every orbit in the data is an Earth orbit for now
  // sqrt scale so LEO sits just off the surface and GEO still fits in the frame.
  const r = deep ? 100 : R_EARTH + 8 + 66 * Math.sqrt(altitudeKm / 35786)
  // One orbit takes a few seconds on screen, slower for higher orbits (PRD: 1 orbit in a few seconds).
  const dur = deep ? 12 : Math.max(2.5, Math.min(14, periodMin / 30))

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[260px]" role="img" aria-label={`${orbit.name} side view${deep ? '' : ` at ${Math.round(altitudeKm)} km`}`}>
      <defs>
        <radialGradient id="earth" cx="35%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#4c8dff" />
          <stop offset="60%" stopColor="#1f4fae" />
          <stop offset="100%" stopColor="#0d2560" />
        </radialGradient>
        <linearGradient id="shadow" x1="0" x2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="night" x1="0" x2="1">
          <stop offset="45%" stopColor="#000" stopOpacity="0" />
          <stop offset="60%" stopColor="#000" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Sun direction */}
      <g className="fill-warn" opacity="0.9">
        <circle cx="12" cy="20" r="6" />
        <text x="22" y="24" className="fill-muted text-[9px]">Sun</text>
      </g>

      {/* Earth's shadow (eclipse zone) */}
      {!deep && (
        <>
          <rect x={CX} y={CY - R_EARTH} width={240 - CX} height={R_EARTH * 2} fill="url(#shadow)" />
          <text x={232} y={CY + R_EARTH + 11} textAnchor="end" className="fill-muted text-[8px]">eclipse</text>
        </>
      )}

      {/* Orbit path */}
      <circle cx={CX} cy={CY} r={r} fill="none" stroke="var(--color-space-600)" strokeDasharray="3 4" />

      {/* Earth (or the Moon/Mars target for deep space) */}
      <circle cx={CX} cy={CY} r={R_EARTH} fill="url(#earth)" />
      <circle cx={CX} cy={CY} r={R_EARTH} fill="url(#night)" />
      {deep && <text x={CX} y={CY + 4} textAnchor="middle" className="fill-ink text-[10px]">{orbit.kind.toUpperCase()}</text>}

      {/* Spacecraft */}
      <g>
        <animateTransform attributeName="transform" type="rotate" from={`0 ${CX} ${CY}`} to={`360 ${CX} ${CY}`} dur={`${dur}s`} repeatCount="indefinite" />
        <rect x={CX - 3} y={CY - r - 3} width="6" height="6" rx="1" fill="var(--color-accent)" />
        <rect x={CX - 10} y={CY - r - 1.5} width="5" height="3" fill="var(--color-ink)" opacity="0.8" />
        <rect x={CX + 5} y={CY - r - 1.5} width="5" height="3" fill="var(--color-ink)" opacity="0.8" />
      </g>

      {!deep && (
        <text x={CX} y={234} textAnchor="middle" className="fill-muted text-[9px]">
          {Math.round(altitudeKm).toLocaleString()} km up · not to scale
        </text>
      )}
    </svg>
  )
}
