import { Copy, LogOut, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { roleNames } from '@/game/ui'
import { cn } from '@/lib/cn'
import { useGame } from '@/store/game'
import { ROLES, type Role } from '@/sync'
import { hostDeviceRoom, joinDeviceRoom, leaveDeviceRoom, useDeviceRoom } from '@/sync/teamBridge'
import { SyncStatusDot } from '@/components/SyncStatusDot'

/**
 * Team mode on separate devices (Member 3). Each player picks a role on their
 * own phone or laptop; the design syncs live through the cloud.
 */
export function TeamDevicesPanel() {
  const room = useDeviceRoom()
  const players = useGame((s) => s.players)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('planner')
  const [code, setCode] = useState('')

  const run = (fn: () => Promise<unknown>) => fn().catch((e) => toast.error(e instanceof Error ? e.message : String(e)))

  if (room.active && room.code) {
    return (
      <div className="rounded-xl border border-accent/60 bg-accent/5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Smartphone className="size-5 text-accent" aria-hidden />
          <div className="flex-1">
            <p className="text-sm text-muted">Room code: share it with your team</p>
            <p className="font-display text-3xl font-semibold tracking-widest">{room.code}</p>
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(room.code!).then(() => toast('Room code copied'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-space-600 px-3 py-1.5 text-sm hover:bg-space-800"
          >
            <Copy className="size-4" aria-hidden /> Copy
          </button>
          <button onClick={leaveDeviceRoom} className="inline-flex items-center gap-1.5 rounded-lg border border-space-600 px-3 py-1.5 text-sm hover:bg-space-800">
            <LogOut className="size-4" aria-hidden /> Leave
          </button>
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <SyncStatusDot /> {players.length} player{players.length === 1 ? '' : 's'}:{' '}
          {players.map((p) => `${p.name} (${roleNames[p.role]})`).join(', ') || 'waiting…'}
        </p>
        <button
          onClick={() => navigate('/briefing')}
          className="mt-3 rounded-lg bg-accent px-5 py-2.5 font-medium text-space-950 hover:bg-accent-strong"
        >
          Start briefing
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-space-700 bg-space-900 p-4">
      <h2 className="flex items-center gap-2 font-display font-semibold">
        <Smartphone className="size-5 text-accent" aria-hidden /> Or play on separate devices
      </h2>
      <p className="mt-1 text-sm text-muted">Each player uses their own phone or laptop. One person creates a room, the others join with its code.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-space-600 bg-space-950 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </label>
        <label className="text-xs text-muted">
          Your role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 w-full rounded-lg border border-space-600 bg-space-950 px-3 py-2 text-sm text-ink"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleNames[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          disabled={room.busy || !name.trim()}
          onClick={() => run(() => hostDeviceRoom(name, role))}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-space-950 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create room
        </button>
        <span className="text-sm text-muted">or</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          maxLength={6}
          aria-label="Room code"
          className="w-24 rounded-lg border border-space-600 bg-space-950 px-3 py-2 text-center font-display tracking-widest text-ink focus:border-accent focus:outline-none"
        />
        <button
          disabled={room.busy || !name.trim() || code.length < 4}
          onClick={() => run(() => joinDeviceRoom(code, name, role))}
          className={cn('rounded-lg border border-space-600 px-4 py-2 text-sm hover:bg-space-800 disabled:cursor-not-allowed disabled:opacity-40')}
        >
          Join
        </button>
        {room.busy && <span className="text-sm text-muted">Connecting…</span>}
      </div>
      {room.error && <p className="mt-2 text-sm text-bad">{room.error}</p>}
    </div>
  )
}
