/**
 * Sound effects (task 2.13), synthesised with the Web Audio API: no audio files to download,
 * license or credit. Browsers only allow audio after a user gesture, so the context starts
 * on the first tap or key press. Muting is remembered on this device.
 */
import { useSyncExternalStore } from 'react'

export type Sfx =
  | 'place' | 'remove' | 'error' | 'alert' | 'approve' | 'hold'
  | 'beep' | 'liftoff' | 'stage' | 'deploy' | 'explode'
  | 'eclipse' | 'firstLight' | 'dead' | 'complete' | 'star'

const KEY = 'first-light-muted'
let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = readMuted()
const listeners = new Set<() => void>()

function readMuted() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.35
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// Unlock audio on the first gesture, so later sounds (from timers or the sim loop) can play.
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem(KEY, m ? '1' : '0')
  } catch {
    /* private mode: keep it for this session only */
  }
  listeners.forEach((l) => l())
}

export function useMuted() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => muted,
  )
}

/* ---------------- building blocks ---------------- */

function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; vol?: number; to?: number } = {}) {
  const a = ctx!
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = opts.type ?? 'sine'
  o.frequency.setValueAtTime(freq, start)
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, start + dur)
  const v = opts.vol ?? 0.5
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(v, start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(g).connect(master!)
  o.start(start)
  o.stop(start + dur + 0.05)
}

function noise(start: number, dur: number, opts: { vol?: number; from?: number; to?: number; attack?: number } = {}) {
  const a = ctx!
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(opts.from ?? 800, start)
  f.frequency.exponentialRampToValueAtTime(opts.to ?? 200, start + dur)
  const g = a.createGain()
  const v = opts.vol ?? 0.5
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(v, start + (opts.attack ?? 0.02))
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  src.connect(f).connect(g).connect(master!)
  src.start(start)
}

const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G4: 392, E4: 329.63, C4: 261.63 }

/* ---------------- the sounds ---------------- */

export function play(s: Sfx) {
  const a = muted ? null : audio()
  // Dev only: a log of what played, so tests can check sounds without listening.
  if (import.meta.env.DEV) ((window as unknown as { __sfx: string[] }).__sfx ??= []).push(`${muted ? `${s} (muted)` : a?.state === "running" ? s : `${s} (no audio yet)`}@${Math.round(performance.now())}`)
  if (!a || a.state !== 'running') return
  const t = a.currentTime + 0.01
  switch (s) {
    case 'place': // a soft click-thunk as a part seats in its slot
      tone(520, t, 0.09, { type: 'triangle', to: 380, vol: 0.5 })
      noise(t, 0.05, { vol: 0.15, from: 3000, to: 800 })
      break
    case 'remove':
      tone(380, t, 0.09, { type: 'triangle', to: 260, vol: 0.4 })
      break
    case 'error':
      tone(220, t, 0.12, { type: 'square', vol: 0.12 })
      tone(185, t + 0.13, 0.16, { type: 'square', vol: 0.12 })
      break
    case 'alert':
      tone(NOTE.A5, t, 0.12, { vol: 0.3 })
      tone(NOTE.A5, t + 0.16, 0.18, { vol: 0.3 })
      break
    case 'approve':
      tone(NOTE.C5, t, 0.14, { type: 'triangle', vol: 0.45 })
      tone(NOTE.G5, t + 0.1, 0.25, { type: 'triangle', vol: 0.45 })
      break
    case 'hold':
      tone(160, t, 0.25, { type: 'sine', to: 110, vol: 0.55 })
      break
    case 'beep': // countdown
      tone(1000, t, 0.12, { type: 'sine', vol: 0.3 })
      break
    case 'liftoff': // ignition crack, then a long rumble that fades as the rocket climbs
      noise(t, 0.4, { vol: 0.6, from: 4000, to: 600 })
      noise(t + 0.05, 4.5, { vol: 0.55, from: 500, to: 90, attack: 0.3 })
      tone(55, t + 0.05, 4, { type: 'sawtooth', vol: 0.12, to: 40 })
      break
    case 'stage': // pyro bolts
      noise(t, 0.18, { vol: 0.5, from: 5000, to: 900 })
      tone(140, t, 0.2, { type: 'square', to: 70, vol: 0.15 })
      break
    case 'deploy': // spring release and panels clicking open
      tone(900, t, 0.08, { type: 'triangle', to: 1300, vol: 0.3 })
      tone(NOTE.E6, t + 0.35, 0.08, { type: 'triangle', vol: 0.2 })
      tone(NOTE.C6, t + 0.5, 0.08, { type: 'triangle', vol: 0.2 })
      break
    case 'explode':
      noise(t, 1.6, { vol: 0.8, from: 2500, to: 60 })
      tone(80, t, 1.2, { type: 'sawtooth', to: 30, vol: 0.2 })
      break
    case 'eclipse': // the light goes: a low falling hum
      tone(220, t, 1.2, { type: 'sine', to: 90, vol: 0.25 })
      break
    case 'firstLight': // rising arpeggio
      ;[NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone(f, t + i * 0.09, 0.35, { type: 'triangle', vol: 0.35 }))
      break
    case 'dead': // power-down whine
      tone(600, t, 1.4, { type: 'sawtooth', to: 60, vol: 0.12 })
      tone(NOTE.E4, t + 0.2, 0.5, { type: 'triangle', vol: 0.3 })
      tone(NOTE.C4, t + 0.6, 0.9, { type: 'triangle', vol: 0.3 })
      break
    case 'complete':
      ;[NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => tone(f, t + i * 0.12, 0.3, { type: 'triangle', vol: 0.35 }))
      tone(NOTE.C6, t + 0.5, 0.7, { type: 'triangle', vol: 0.35 })
      break
    case 'star':
      tone(NOTE.E6, t, 0.25, { type: 'sine', vol: 0.25 })
      tone(NOTE.G5 * 2, t + 0.06, 0.3, { type: 'sine', vol: 0.15 })
      break
  }
}
