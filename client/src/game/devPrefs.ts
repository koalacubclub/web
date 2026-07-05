// Developer overlay preferences + dev-mode gating.
//
// Dev mode is unlocked by a `?dev` query param and then remembered (persisted to
// localStorage) so it survives reloads / SPA navigation in this browser; `?dev=0`
// (or `?dev=false`) turns it back off. Because the on/off is now a permanent
// state, the `dev` param is stripped from the URL right after it's applied so the
// address bar stays clean. While unlocked, a small Dev button appears next to
// Settings that toggles on-canvas debug overlays (a tile grid + an FPS readout);
// when dev mode is OFF every overlay flag is forced off so nothing lingers on the
// canvas. Mirrors perfPrefs.ts's defensive localStorage approach (private-mode /
// SSR never throws) plus a tiny listener Set so React can subscribe and the game
// loop can keep a ref in sync.

const DEV_KEY = 'koala:dev'
const FLAGS_KEY = 'koala:dev-flags'

// The individual overlays the Dev menu can toggle. Add a flag here + a row in
// BottomBar + a draw in ParkGame's loop to grow the toolbox.
export interface DevFlags {
  tiles: boolean // draw the tile grid (+ highlight the cat's tile)
  pixels: boolean // draw the 16×16 base-pixel lattice inside the cat's tile
  fps: boolean // draw the FPS / info HUD
  coords: boolean // draw the tile→logical→device→screen coordinate inspector
}

const DEFAULTS: DevFlags = {
  tiles: false,
  pixels: false,
  fps: false,
  coords: false,
}

const listeners = new Set<() => void>()

// Whether the `?dev` unlock is active for this browser. Decided once on module
// load: a URL param wins (and is persisted), else the remembered flag.
let devMode = readDevMode()
// In-memory mirror so toggles are stable even if storage is unavailable. When dev
// mode is off, every overlay is forced off (and that reset is persisted) so a
// stale flag can never keep drawing on the canvas.
let flags = devMode ? readFlags() : clearFlags()

function readDevMode(): boolean {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search)
      if (params.has('dev')) {
        const raw = params.get('dev')
        const on = raw !== '0' && raw !== 'false'
        try {
          localStorage.setItem(DEV_KEY, on ? '1' : '0')
        } catch {
          /* private mode — keep the URL-derived value for this session */
        }
        // The on/off is now permanent state, so drop the param from the URL.
        stripDevParam()
        return on
      }
    }
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(DEV_KEY) === '1'
  } catch {
    return false
  }
}

// Remove the `dev` query param from the address bar (no reload/history entry).
function stripDevParam(): void {
  try {
    if (typeof window === 'undefined' || !window.history?.replaceState) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('dev')) return
    url.searchParams.delete('dev')
    window.history.replaceState(
      null,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    )
  } catch {
    /* history unavailable — leaving the param is harmless */
  }
}

// Force every overlay off and persist the reset. Used when dev mode is disabled.
function clearFlags(): DevFlags {
  const off = { ...DEFAULTS }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FLAGS_KEY, JSON.stringify(off))
    }
  } catch {
    /* private mode — the in-memory reset still applies */
  }
  return off
}

function readFlags(): DevFlags {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULTS }
    const raw = localStorage.getItem(FLAGS_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<DevFlags>
    return {
      tiles: parsed?.tiles === true,
      pixels: parsed?.pixels === true,
      fps: parsed?.fps === true,
      coords: parsed?.coords === true,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

// Whether the Dev button/overlays are unlocked (default false).
export function isDevMode(): boolean {
  return devMode
}

// Current overlay toggles. Stable reference until a flag actually changes, so it
// is safe to use as a useSyncExternalStore snapshot.
export function getFlags(): DevFlags {
  return flags
}

// Flip one overlay flag, persist, then notify subscribers.
export function setFlag(key: keyof DevFlags, v: boolean): void {
  if (flags[key] === v) return
  flags = { ...flags, [key]: v }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FLAGS_KEY, JSON.stringify(flags))
    }
  } catch {
    /* private mode — keep the in-memory flags for this session */
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
