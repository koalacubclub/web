// Persisted "performance" preference (survives reloads). When ON, the game
// render loop is throttled to ~30fps to save battery/CPU on weaker devices.
// Opt-in — the default is full 60fps. Mirrors radio.ts's defensive localStorage
// approach so private-mode / SSR never throws, plus a tiny listener Set so React
// can subscribe (useSyncExternalStore or useState+effect) and the game loop can
// keep a ref in sync.

const REDUCED_FPS_KEY = 'koala:reduced-fps'

const listeners = new Set<() => void>()

// In-memory mirror so the preference is stable even if storage is unavailable
// (private mode) — seeded from storage on module load.
let reduced = readReducedFps()

function readReducedFps(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(REDUCED_FPS_KEY) === '1'
  } catch {
    return false
  }
}

// Whether the 30fps cap is currently enabled (default false).
export function isReducedFps(): boolean {
  return reduced
}

// Set + persist the preference, then notify subscribers.
export function setReducedFps(v: boolean): void {
  if (v === reduced) return
  reduced = v
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(REDUCED_FPS_KEY, v ? '1' : '0')
    }
  } catch {
    /* private mode — keep the in-memory preference for this session */
  }
  for (const cb of listeners) cb()
}

// Subscribe to changes; returns an unsubscribe function.
export function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
