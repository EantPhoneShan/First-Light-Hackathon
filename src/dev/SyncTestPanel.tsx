/**
 * Temporary team-sync test screen (Member 3). Member 2's real screens replace
 * this; it stays useful for checking sync on several devices.
 * Open it with ?synctest in the URL once the real UI is in place.
 */
import { useEffect, useState } from 'react';
import {
  sync,
  ROLES,
  ROLE_LABELS,
  allApproved,
  isApproved,
  isOnline,
  type Role,
  type Room,
  type SyncEvent,
  type SyncStatus,
} from '../sync';

const DOT: Record<SyncStatus, string> = {
  solo: '#9aa0a6',
  connecting: '#f9ab00',
  connected: '#1e8e3e',
  reconnecting: '#f9ab00',
  offline: '#d93025',
};

export default function SyncTestPanel() {
  const [room, setRoom] = useState<Room | null>(sync.getRoom());
  const [status, setStatus] = useState<SyncStatus>(sync.getStatus());
  const [log, setLog] = useState<string[]>([]);
  const [name, setName] = useState(sync.playerName === 'Player' ? '' : sync.playerName);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    sync.resume();
    const a = sync.onRoomChange(setRoom);
    const b = sync.onStatus(setStatus);
    const c = sync.onEvent((e: SyncEvent) => setLog((l) => [describe(e), ...l].slice(0, 12)));
    return () => {
      a();
      b();
      c();
    };
  }, []);

  const run = async (fn: () => Promise<unknown> | unknown) => {
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const mine = sync.getMyRoles();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1 style={{ marginBottom: 4 }}>First Light</h1>
      <p style={{ marginTop: 0, color: '#666' }}>
        Team sync test · backend: <b>{sync.backend}</b> ·{' '}
        <span style={{ color: DOT[status] }}>●</span> {status === 'solo' ? 'Playing solo' : status}
      </p>

      {!room || status === 'solo' ? (
        <section style={box}>
          <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} style={input} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button onClick={() => run(() => sync.startSolo())}>Play solo</button>
            <button onClick={() => run(() => sync.createRoom(name))}>Create team room</button>
            <input placeholder="Room code" value={code} onChange={(e) => setCode(e.target.value)} style={{ ...input, width: 110 }} />
            <button onClick={() => run(() => sync.joinRoom(code, name))}>Join</button>
          </div>
        </section>
      ) : null}

      {room && (
        <>
          <section style={box}>
            <b>Room {room.code}</b> · phase {room.phase} · {allApproved(room) ? '✅ all approved, ready to launch' : 'waiting for approvals'}
            <div style={{ marginTop: 6 }}>
              Players:{' '}
              {room.players.map((p) => (
                <span key={p.id} style={{ marginRight: 10, opacity: isOnline(p) || status === 'solo' ? 1 : 0.4 }}>
                  {p.name}
                  {p.id === sync.playerId ? ' (you)' : ''} [{p.roles.map((r) => ROLE_LABELS[r].split(' ')[0]).join(', ') || 'no role'}]
                </span>
              ))}
            </div>
            {status !== 'solo' && (
              <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                Take roles:
                {ROLES.map((r) => (
                  <label key={r}>
                    <input
                      type="checkbox"
                      checked={mine.includes(r)}
                      onChange={(e) =>
                        run(() => sync.chooseRoles(e.target.checked ? [...mine, r] : mine.filter((x) => x !== r)))
                      }
                    />{' '}
                    {ROLE_LABELS[r]}
                  </label>
                ))}
              </div>
            )}
          </section>

          {ROLES.map((r: Role) => {
            const s = room.sections[r];
            const editable = sync.canEdit(r);
            return (
              <section key={r} style={{ ...box, opacity: editable ? 1 : 0.75 }}>
                <b>{ROLE_LABELS[r]}</b> {isApproved(room, r) ? '✅ approved' : ''}{' '}
                <small style={{ color: '#888' }}>v{s.version}</small>
                <textarea
                  key={`${r}-${s.dataVersion}`}
                  defaultValue={JSON.stringify(s.data)}
                  disabled={!editable}
                  rows={2}
                  style={{ ...input, width: '100%', fontFamily: 'monospace' }}
                  onBlur={(e) =>
                    run(() => {
                      const next = JSON.parse(e.target.value || '{}');
                      if (JSON.stringify(next) !== JSON.stringify(s.data)) return sync.updateDesign(r, next);
                    })
                  }
                />
                {editable && (
                  <button onClick={() => run(() => sync.setApproved(r, !isApproved(room, r)))}>
                    {isApproved(room, r) ? 'Hold' : 'Approve'}
                  </button>
                )}
              </section>
            );
          })}
          <button onClick={() => run(() => { sync.leaveRoom(); setRoom(null); })}>Leave room</button>
        </>
      )}

      {err && <p style={{ color: '#d93025' }}>{err}</p>}
      {log.length > 0 && (
        <section style={box}>
          <b>Alerts</b>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function describe(e: SyncEvent): string {
  switch (e.type) {
    case 'remote-change':
      return `${e.byName} changed ${ROLE_LABELS[e.role]}`;
    case 'conflict':
      return `Conflict on ${ROLE_LABELS[e.role]}: ${e.message}`;
    case 'approvals-reset':
      return `Approvals cleared because ${e.byName} changed ${ROLE_LABELS[e.role]}`;
    case 'player-joined':
      return `${e.player.name} joined`;
    case 'player-left':
      return `${e.player.name} left`;
    case 'error':
      return e.message;
  }
}

const box: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: 12, margin: '10px 0' };
const input: React.CSSProperties = { padding: 6, fontSize: 14, boxSizing: 'border-box' };
