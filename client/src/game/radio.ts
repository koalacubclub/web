// Web Audio "rave" loop for the park's portable radio.
//
// A driving four-on-the-floor electronic-dance loop that fades IN when Koala
// walks near a placed radio and fades OUT when she wanders away. The
// AudioContext is created lazily on first use — browser autoplay rules require a
// prior user gesture, and walking the cat (keyboard / pointer) is one, so by the
// time she reaches a radio the context can resume. Everything is a no-op when
// Web Audio is unavailable (SSR / very old browsers), so callers never guard.
//
// Voices: a synthesised kick (four-on-the-floor), a noise clap on beats 2 & 4,
// closed hi-hats on the offbeats, an offbeat saw bass, and a detuned-saw arp
// lead through a resonant low-pass — all glued by a limiter so the busy mix
// never clips. A minor pentatonic (A) keeps it dark and consonant.

type Ctor = typeof AudioContext

// Pitches (Hz), A-minor pentatonic (A C D E G). Bass low, arp lead up high.
const A2 = 110.0
const E2 = 82.41
const A4 = 440.0
const C5 = 523.25
const E5 = 659.25
const A5 = 880.0
const _ = 0 // rest

// 16-step grid = one bar. At STEP≈0.107s that's ~140 BPM (a rave tempo).
const STEP = 0.107
// Four-on-the-floor kick; clap on beats 2 & 4; closed hats on the offbeats.
const KICK = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
const CLAP = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
const HAT = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
// Offbeat bass (the classic house/rave pump), root A with an E turnaround.
const BASS = [_, _, A2, _, _, _, A2, _, _, _, A2, _, _, _, E2, _]
// Sixteenth-note arp lead — a rising/falling A-minor figure.
const LEAD = [A4, C5, E5, A5, E5, C5, A4, C5, E5, A5, E5, C5, A4, C5, E5, A5]

const PEAK = 0.22 // master gain when playing (limiter catches the peaks)
const FADE = 0.3 // seconds to fade in / out

class RadioAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private nextTime = 0
  private step = 0
  private near = false

  // Lazily build the context, master gain and a limiter. Returns false if Web
  // Audio is missing (so the caller silently gets no sound).
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
    // A limiter glues the busy drum/bass/lead mix and stops it clipping.
    const limiter = this.ctx.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.knee.value = 6
    limiter.ratio.value = 12
    limiter.attack.value = 0.003
    limiter.release.value = 0.12
    this.master.connect(limiter)
    limiter.connect(this.ctx.destination)
    return true
  }

  // One shared white-noise buffer for the percussion (clap + hats).
  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise
    const ctx = this.ctx as AudioContext
    const len = Math.floor(ctx.sampleRate * 0.4)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noise = buf
    return buf
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

  // Look-ahead scheduler: queue any 16th-note steps within the next 0.2s, each
  // firing whichever voices its patterns call for.
  private schedule() {
    if (!this.ctx || !this.master) return
    const LOOKAHEAD = 0.2
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      const i = this.step % 16
      const at = this.nextTime
      if (KICK[i]) this.kick(at)
      if (CLAP[i]) this.clap(at)
      if (HAT[i]) this.hat(at)
      if (BASS[i] > 0) this.bass(BASS[i], at)
      if (LEAD[i] > 0) this.lead(LEAD[i], at)
      this.nextTime += STEP
      this.step++
    }
  }

  // Punchy kick: a sine pitched from ~160Hz down to ~45Hz with a fast decay.
  private kick(at: number) {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(160, at)
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.11)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.9, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
    osc.connect(g)
    g.connect(master)
    osc.start(at)
    osc.stop(at + 0.18)
  }

  // Clap: a band-passed noise burst with a quick decay.
  private clap(at: number) {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1600
    bp.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.5, at + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)
    src.connect(bp)
    bp.connect(g)
    g.connect(master)
    src.start(at)
    src.stop(at + 0.14)
  }

  // Closed hi-hat: a very short high-passed noise tick.
  private hat(at: number) {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer()
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.22, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04)
    src.connect(hp)
    hp.connect(g)
    g.connect(master)
    src.start(at)
    src.stop(at + 0.05)
  }

  // Offbeat saw bass through a low-pass — the pump under the kick.
  private bass(freq: number, at: number) {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const dur = STEP * 0.9
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 700
    lp.Q.value = 4
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.45, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(lp)
    lp.connect(g)
    g.connect(master)
    osc.start(at)
    osc.stop(at + dur)
  }

  // Detuned-saw arp stab through a resonant low-pass with a downward sweep.
  private lead(freq: number, at: number) {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const dur = STEP * 0.9
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 8
    lp.frequency.setValueAtTime(3800, at)
    lp.frequency.exponentialRampToValueAtTime(900, at + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.2, at + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    lp.connect(g)
    g.connect(master)
    for (const detune of [-8, 8]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = detune
      osc.connect(lp)
      osc.start(at)
      osc.stop(at + dur)
    }
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
    this.noise = null
    this.near = false
    this.step = 0
  }
}

// A single shared player — only the local koala's proximity drives it.
export const radio = new RadioAudio()
