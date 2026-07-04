// Web Audio jingle for the park's portable radio.
//
// A gentle looping chiptune that fades IN when Koala walks near a placed radio
// and fades OUT when she wanders away. The AudioContext is created lazily on
// first use — browser autoplay rules require a prior user gesture, and walking
// the cat (keyboard / pointer) is one, so by the time she reaches a radio the
// context can resume. Everything is a no-op when Web Audio is unavailable
// (SSR / very old browsers), so callers never need to guard.
//
// The melody is a C-major pentatonic loop, so it never lands on a "wrong" note,
// kept quiet and soft on a triangle wave so it reads as a tiny toy speaker.

type Ctor = typeof AudioContext

// Pentatonic notes (Hz) around the fifth/sixth octave — bright but not shrill.
const C = 523.25
const D = 587.33
const E = 659.25
const G = 783.99
const A = 880.0
const C2 = 1046.5
const REST = 0

// [frequency, beats] — one bar per line. A rest (0) leaves a gap.
const STEP = 0.22 // seconds per beat
const MELODY: readonly (readonly [number, number])[] = [
  [C, 1],
  [E, 1],
  [G, 1],
  [E, 1],
  [A, 1],
  [G, 1],
  [E, 1],
  [REST, 1],
  [D, 1],
  [G, 1],
  [A, 1],
  [C2, 1],
  [A, 1],
  [G, 1],
  [E, 1],
  [REST, 1],
]

const PEAK = 0.14 // master gain when playing (deliberately quiet)
const FADE = 0.4 // seconds to fade in / out

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

  // Look-ahead scheduler: queue any notes falling within the next 0.2s.
  private schedule() {
    if (!this.ctx || !this.master) return
    const LOOKAHEAD = 0.2
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      const [freq, beats] = MELODY[this.step % MELODY.length]
      const dur = beats * STEP
      if (freq > 0) this.playNote(freq, this.nextTime, dur)
      this.nextTime += dur
      this.step++
    }
  }

  private playNote(freq: number, at: number, dur: number) {
    if (!this.ctx || !this.master) return
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    // Soft pluck: quick attack, gentle decay so notes don't click.
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(0.5, at + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur * 0.9)
    osc.connect(g)
    g.connect(this.master)
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
