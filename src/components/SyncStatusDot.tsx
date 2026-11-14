import { cn } from '@/lib/cn'
import { useDeviceRoom } from '@/sync/teamBridge'

const label = {
  solo: 'Playing solo',
  connecting: 'Connecting',
  connected: 'Team synced',
  reconnecting: 'Reconnecting',
  offline: 'Offline, playing solo',
} as const

/** Small cloud-sync status dot (Member 3). Renders nothing outside a device room unless `always`. */
export function SyncStatusDot({ showLabel, always }: { showLabel?: boolean; always?: boolean }) {
  const { active, status, code } = useDeviceRoom()
  if (!active && !always) return null
  const color = status === 'connected' ? 'bg-ok' : status === 'offline' ? 'bg-bad' : status === 'solo' ? 'bg-muted' : 'bg-warn'
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted" title={`${label[status]}${code ? ` · room ${code}` : ''}`}>
      <span className={cn('size-2.5 rounded-full', color, status !== 'connected' && status !== 'solo' && 'animate-pulse')} aria-hidden />
      {showLabel && <span>{code ? `Room ${code}` : label[status]}</span>}
    </span>
  )
}
