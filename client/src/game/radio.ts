// Web Audio jingle for the park's portable radio.
//
// A short, upbeat electronic loop that fades IN when Koala walks near a placed
// radio and fades OUT when she wanders away. The AudioContext is created lazily
// on first use — browser autoplay rules require a prior user gesture, and
// walking the cat (keyboard / pointer) is one, so by the time she reaches a
// radio the context can resume. Everything is a no-op when Web Audio is
// unavailable (SSR / very old browsers), so callers never need to guard.
//
// The synth is a detuned-saw lead through a resonant low-pass (with a pluck
// filter sweep) over a square-wave bass — a small 16-step C-pentatonic groove,
// so it stays consonant while sounding like a chiptune/synth, not a beeper.

type Ctor = typeof AudioContext

// Pitches (Hz). Lead sits around octave 5; bass around octaves 2–3.
const C5 = 523.25
const D5 = 587.33
const E5 = 659.25
const G5 = 783.99
const A5 = 880.0
const C6 = 1046.5
const C3 = 130.81
const G2 = 98.0
const A2 = 110.0
const _ = 0 // rest

// 16-step grid (a 2.4s loop at STEP=0.15). LEAD is a bouncy pentatonic riff;
// BASS pulses a root note at the start of each 4-step bar for the groove.
const STEP = 0.15 // seconds per step (fast → upbeat)
const LEAD: readonly number[] = [
  C5,
  E5,
  G5,
  C6,
  A5,
  G5,
  E5,
  D5,
  C5,
  E5,
  G5,
  A5,
  C6,
  G5,
  E5,
  G5,
]
const BASS: readonly number[] = [
  C3,
  _,
  _,
  _,
  A2,
  _,
  _,
  _,
  G2,
  _,
  _,
  _,
  C3,
  _,
  _,
  _,
]

const PEAK = 0.13 // master gain when playing (deliberately quiet)
const FADE = 0.35 // seconds to fade in / out

class RadioAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private nextTime = 0
  private step = 0
  private near = false

  // Lazily build the context + master gain. Returns false if Web Audio is
  // missing (so the caller silently gets no sound).
  private ensure(): boolean {
    if (this.ctx) return true
    if (typeof window === 'undefined') return false
    const Ctor: Ctor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
    if (!Ctor) return false
    try {
      this.ctx = new Ctor()
    } catch {
      return false
    }
    this.master = this.ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(this.ctx.destination)
    return true
  }

  // Toggle proximity. Idempotent — safe to call every frame.
  setNear(near: boolean) {
    if (near === this.near) return
    this.near = near
    if (near) this.start()
    else this.fadeOut()
  }

  private start() {
    if (!this.ensure() || !this.ctx || !this.master) return
    void this.ctx.resume() // may be blocked until a user gesture; harmless if so
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(PEAK, now + FADE)
    if (this.timer == null) {
      this.nextTime = now + 0.05
      this.timer = setInterval(() => this.schedule(), 25)
      this.schedule()
    }
  }

  private fadeOut() {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(0, now + FADE)
    // Stop queueing new notes; any already scheduled ride out the fade.
    if (this.timer != null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  // Look-ahead scheduler: queue any steps falling within the next 0.2s. Each
  // step fires a lead note and (on bar starts) a bass note, both on one grid.
  private schedule() {
    if (!this.ctx || !this.master) return
    const LOOKAHEAD = 0.2
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      const i = this.step % LEAD.length
      if (LEAD[i] > 0) this.playLead(LEAD[i], this.nextTime)
      if (BASS[i] > 0) this.playBass(BASS[i], this.nextTime)
      this.nextTime += STEP
      this.step++
    }
  }

  // Detuned-saw lead through a resonant low-pass with a downward filter sweep —
  // a classic synth "pluck". Two oscillators a few cents apart give it width.
  private playLead(freq: number, at: number) {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const dur = STEP * 0.95
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 7
    filter.frequency.setValueAtTime(4200, at)
    filter.frequency.exponentialRampToValueAtTime(1100, at + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(0.3, at + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    filter.connect(g)
    g.connect(master)
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      osc.connect(filter)
      osc.start(at)
      osc.stop(at + dur)
    }
  }

  // Punchy square-wave bass, held ~one bar, low-passed so it thumps not buzzes.
  private playBass(freq: number, at: number) {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const dur = STEP * 3.6
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 600
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(0.32, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(filter)
    filter.connect(g)
    g.connect(master)
    osc.start(at)
    osc.stop(at + dur)
  }

  // Tear down entirely (component unmount). Safe to call multiple times.
  dispose() {
    if (this.timer != null) {
      clearInterval(this.timer)
      this.timer = null
    }
    void this.ctx?.close()
    this.ctx = null
    this.master = null
    this.near = false
    this.step = 0
  }
}

// A single shared player — only the local koala's proximity drives it.
export const radio = new RadioAudio()
