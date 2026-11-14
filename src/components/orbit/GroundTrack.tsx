import { useMemo } from 'react'
import type { Orbit, Station } from '@/engine/types'

interface GroundTrackProps {
  orbit: Orbit
  altitudeKm: number
  periodMin: number
  stations: Station[]
  selectedStationIds: string[]
}

const W = 360
const H = 180
const RE = 6371
const x = (lon: number) => ((lon + 180) / 360) * W
const y = (lat: number) => ((90 - lat) / 180) * H
const rad = Math.PI / 180

/**
 * Flat map of where the craft passes over in one day, with ground stations and the
 * circle each one can "see". Display only: Member 1's simulate.ts owns the real passes.
 */
export function GroundTrack({ orbit, altitudeKm, periodMin, stations, selectedStationIds }: GroundTrackProps) {
  const inc = orbit.inclinationDeg

  const paths = useMemo(() => {
    if (inc === null || orbit.id === 'geo' || periodMin <= 0) return []
    const orbitsInDay = Math.min(16, Math.floor(1440 / periodMin))
    const steps = 120
    const lines: string[] = []
    for (let k = 0; k < orbitsInDay; k++) {
      let d = ''
      let prevX: number | null = null
      for (let s = 0; s <= steps; s++) {
        const tMin = (k + s / steps) * periodMin
        const u = (2 * Math.PI * tMin) / periodMin
        const lat = Math.asin(Math.sin(inc * rad) * Math.sin(u)) / rad
        const inertialLon = Math.atan2(Math.cos(inc * rad) * Math.sin(u), Math.cos(u)) / rad
        let lon = inertialLon - (360 / 1436) * tMin
        lon = ((((lon + 180) % 360) + 360) % 360) - 180
        const px = x(lon)
        // Start a new segment when the track wraps around the map edge.
        d += prevX !== null && Math.abs(px - prevX) < W / 2 ? `L${px.toFixed(1)},${y(lat).toFixed(1)}` : `M${px.toFixed(1)},${y(lat).toFixed(1)}`
        prevX = px
      }
      lines.push(d)
    }
    return lines
  }, [inc, orbit.id, periodMin])

  // Ground footprint: how far from a station the craft can be and still talk to it.
  const footprintDeg = orbit.altitudeKm ? Math.min(80, (Math.acos(RE / (RE + altitudeKm)) / rad) * 0.8) : 0

  return (
    <div className="w-full max-w-xl">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-space-800" role="img" aria-label={`Ground track for one day in ${orbit.name}`}>
        {/* Grid */}
        {[-60, -30, 0, 30, 60].map((lat) => (
          <line key={lat} x1={0} x2={W} y1={y(lat)} y2={y(lat)} stroke="var(--color-space-700)" strokeWidth={lat === 0 ? 1 : 0.5} />
        ))}
        {[-120, -60, 0, 60, 120].map((lon) => (
          <line key={lon} y1={0} y2={H} x1={x(lon)} x2={x(lon)} stroke="var(--color-space-700)" strokeWidth={0.5} />
        ))}
        <text x={4} y={y(0) - 3} className="fill-muted text-[7px]">Equator</text>

        {/* Station footprints and dots */}
        {stations.map((st) => {
          const on = selectedStationIds.includes(st.id)
          return (
            <g key={st.id} opacity={on ? 1 : 0.35}>
              {on && footprintDeg > 0 && (
                <ellipse cx={x(st.lon)} cy={y(st.lat)} rx={(footprintDeg / Math.max(0.2, Math.cos(st.lat * rad)) / 360) * W} ry={(footprintDeg / 180) * H} fill="var(--color-ok)" fillOpacity={0.12} stroke="var(--color-ok)" strokeOpacity={0.5} strokeWidth={0.6} />
              )}
              <circle cx={x(st.lon)} cy={y(st.lat)} r={on ? 3 : 2} fill={on ? 'var(--color-ok)' : 'var(--color-muted)'} />
            </g>
          )
        })}

        {/* Track */}
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--color-accent)" strokeWidth={i === 0 ? 1.6 : 0.7} strokeOpacity={i === 0 ? 1 : 0.45} />
        ))}
        {orbit.id === 'geo' && (
          <g>
            <circle cx={x(100)} cy={y(0)} r={4} fill="var(--color-accent)" />
            <circle cx={x(100)} cy={y(0)} r={60} fill="var(--color-accent)" fillOpacity={0.08} stroke="var(--color-accent)" strokeOpacity={0.4} />
          </g>
        )}
        {inc === null && (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-muted text-[10px]">
            No Earth ground track: the craft leaves Earth orbit
          </text>
        )}
      </svg>
      <p className="mt-1 text-[11px] text-muted">
        {orbit.id === 'geo'
          ? 'Stays over one spot and sees the same hemisphere all the time.'
          : inc !== null
            ? 'One day of passes. The bold line is the first orbit; Earth turns underneath, so each pass shifts west.'
            : ''}
        {selectedStationIds.length > 0 && inc !== null && ' Green circles show where each ground station can hear the craft.'}
      </p>
    </div>
  )
}
