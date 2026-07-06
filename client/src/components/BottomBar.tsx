import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bug, Settings, Volume2, VolumeX, X } from 'lucide-react'
import * as parkStore from '@/game/parkStore'
import { radio } from '@/game/radio'
import * as perfPrefs from '@/game/perfPrefs'
import * as devPrefs from '@/game/devPrefs'
import { MULTIPLAYER_ENABLED } from '@/multiplayer/connection'
import { NAME_MAX } from '@koala/shared'
import Shop from './Shop'

const DISPLAY_FONT = "'Cormorant Garamond', Georgia, serif"
const PILL =
  'flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white'

// The hero's bottom control cluster: the score/likes readout + the Shop trigger +
// a Settings button, grouped on one line. Score/coins + the display name come
// from parkStore (server-fed in multiplayer). Settings is ALWAYS available (it
// holds the radio mute); the rename + roster + world-stats sections inside it are
// server-backed, so they only render when a backend is configured.
export default function BottomBar({ atTop }: { atTop: boolean }) {
  const snap = useSyncExternalStore(
    parkStore.subscribe,
    parkStore.getSnapshot,
    parkStore.getSnapshot,
  )

  const [shopOpen, setShopOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [devOpen, setDevOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [muted, setMuted] = useState(() => radio.isMuted())
  const [reducedFps, setReducedFps] = useState(() => perfPrefs.isReducedFps())
  // Unlocked once per session by the `?dev` query param (persisted). When off,
  // the Dev button never renders.
  const devMode = devPrefs.isDevMode()
  const [devFlags, setDevFlags] = useState(() => devPrefs.getFlags())

  const toggleDevFlag = (key: keyof devPrefs.DevFlags) => {
    const next = !devFlags[key]
    devPrefs.setFlag(key, next) // persisted; the game loop's ref picks it up
    setDevFlags(devPrefs.getFlags())
  }

  const toggleMuted = () => {
    const next = !muted
    radio.setMuted(next) // click is a user gesture → audio can (re)start
    setMuted(next)
  }

  const toggleReducedFps = () => {
    const next = !reducedFps
    perfPrefs.setReducedFps(next) // persisted; the game loop's ref picks it up
    setReducedFps(next)
  }

  const shopTriggerRef = useRef<HTMLButtonElement>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Close everything once the hero is scrolled away.
  useEffect(() => {
    if (!atTop) {
      setShopOpen(false)
      setSettingsOpen(false)
      setDevOpen(false)
    }
  }, [atTop])

  // Settings popover: seed the input (but don't auto-focus it — opening Settings
  // shouldn't grab focus/pop the keyboard), close on Escape.
  useEffect(() => {
    if (!settingsOpen) return
    if (MULTIPLAYER_ENABLED) {
      setNameDraft(snap.name)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen])

  const closeSettings = () => {
    setSettingsOpen(false)
    settingsTriggerRef.current?.focus()
  }

  const saveName = () => {
    const clean = nameDraft.trim().slice(0, NAME_MAX)
    if (clean) parkStore.rename(clean) // server echoes `renamed` → snap.name updates
    closeSettings()
  }

  return (
    <>
      {/* Inline cluster — placed by Home in the top-right, next to the socials. */}
      <div className="flex items-center gap-2">
        {/* Score / likes pill — also the shop trigger (consolidated; no separate
            Shop button). Current money only — the best is tracked, just not shown. */}
        <button
          ref={shopTriggerRef}
          type="button"
          onClick={() => {
            setSettingsOpen(false)
            setDevOpen(false)
            setShopOpen(true)
          }}
          aria-haspopup="dialog"
          aria-expanded={shopOpen}
          aria-label={`${snap.coins} likes — open the shop`}
          className="flex h-8 items-center gap-1 rounded-full bg-black/30 px-3 leading-none text-white ring-1 ring-white/10 backdrop-blur-md transition-colors hover:bg-black/50"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          <span className="text-[oklch(0.82_0.13_78)]" aria-hidden="true">
            ♥
          </span>
          <span className="text-base tabular-nums">{snap.coins}</span>
        </button>

        {/* Settings — always available (sound); the rename + roster + stats
            sections are server-backed, so only shown when connected. */}
        <div className="relative">
          <button
            ref={settingsTriggerRef}
            type="button"
            onClick={() => {
              setDevOpen(false)
              setSettingsOpen((v) => !v)
            }}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            aria-label="Settings"
            className={PILL}
          >
            <Settings className="h-4 w-4" />
          </button>

          <AnimatePresence>
            {settingsOpen && (
              <motion.div
                role="dialog"
                aria-label="Settings"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                onPointerDownCapture={(e) => e.stopPropagation()}
                onTouchStartCapture={(e) => e.stopPropagation()}
                /* Anchored to the viewport (not the gear) so the 288px sheet can't
                   clip off the left edge on phones (body is overflow-x:hidden). */
                className="fixed right-4 top-14 w-[min(18rem,calc(100vw-2rem))] rounded-2xl bg-[oklch(0.13_0.008_60_/_0.97)] p-3 ring-1 ring-white/15 backdrop-blur-md sm:right-7 sm:top-[4.25rem]"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className="text-base text-white/90"
                    style={{ fontFamily: DISPLAY_FONT }}
                  >
                    Settings
                  </span>
                  <button
                    type="button"
                    onClick={closeSettings}
                    aria-label="Close settings"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Display name (server-backed) */}
                {MULTIPLAYER_ENABLED && (
                  <>
                    <label className="mb-1 block text-xs text-white/50">
                      Your name
                    </label>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        saveName()
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        ref={nameInputRef}
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        maxLength={NAME_MAX}
                        placeholder="Koala…"
                        aria-label="Display name"
                        className="min-w-0 flex-1 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-white/40 focus:ring-white/40"
                      />
                      <button
                        type="submit"
                        disabled={!nameDraft.trim()}
                        className="rounded-full bg-white/[0.12] px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/15 transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Save
                      </button>
                    </form>
                  </>
                )}

                {/* Sound — mutes the park radio (persisted) */}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-white/50">Sound</span>
                  <button
                    type="button"
                    onClick={toggleMuted}
                    aria-pressed={muted}
                    aria-label={muted ? 'Unmute radio' : 'Mute radio'}
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/15 transition-colors hover:bg-white/20"
                  >
                    {muted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                    {muted ? 'Muted' : 'On'}
                  </button>
                </div>

                {/* Performance — caps the game to ~30fps (persisted, default off) */}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-white/50">Performance</span>
                  <button
                    type="button"
                    onClick={toggleReducedFps}
                    aria-pressed={reducedFps}
                    aria-label={
                      reducedFps
                        ? 'Switch to full frame rate (60 fps)'
                        : 'Cap the game to 30 fps to save power'
                    }
                    className="flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/15 transition-colors hover:bg-white/20"
                  >
                    {reducedFps ? '30 fps' : '60 fps'}
                  </button>
                </div>

                {MULTIPLAYER_ENABLED && (
                  <>
                    {/* Who's here right now */}
                    <div className="mt-4 mb-1 flex items-baseline justify-between">
                      <span className="text-xs text-white/50">Online now</span>
                      <span className="text-xs tabular-nums text-white/40">
                        {snap.online.length}
                      </span>
                    </div>
                    {snap.online.length ? (
                      <ul className="max-h-32 space-y-0.5 overflow-y-auto pr-1">
                        {snap.online.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center gap-2 text-sm text-white/85"
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 truncate">{p.name}</span>
                            {p.self && (
                              <span className="shrink-0 text-xs text-white/40">
                                you
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-white/40">Connecting…</p>
                    )}

                    {/* Durable world stats */}
                    <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/10 pt-3">
                      <Stat
                        label="Active (24h)"
                        value={snap.stats?.active24h}
                      />
                      <Stat
                        label="Your visits"
                        value={snap.stats?.yourVisits}
                      />
                      <Stat
                        label="Total sessions"
                        value={snap.stats?.totalSessions}
                      />
                      <Stat label="Online" value={snap.online.length} />
                    </dl>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dev — hidden unless unlocked by the `?dev` query param. Toggles the
            on-canvas debug overlays (tile grid + FPS/info HUD). */}
        {devMode && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false)
                setShopOpen(false)
                setDevOpen((v) => !v)
              }}
              aria-haspopup="dialog"
              aria-expanded={devOpen}
              aria-label="Developer overlays"
              className={PILL}
            >
              <Bug className="h-4 w-4" />
            </button>

            <AnimatePresence>
              {devOpen && (
                <motion.div
                  role="dialog"
                  aria-label="Developer overlays"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onTouchStartCapture={(e) => e.stopPropagation()}
                  className="fixed right-4 top-14 w-[min(16rem,calc(100vw-2rem))] rounded-2xl bg-[oklch(0.13_0.008_60_/_0.97)] p-3 ring-1 ring-white/15 backdrop-blur-md sm:right-7 sm:top-[4.25rem]"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className="text-base text-white/90"
                      style={{ fontFamily: DISPLAY_FONT }}
                    >
                      Developer
                    </span>
                    <button
                      type="button"
                      onClick={() => setDevOpen(false)}
                      aria-label="Close developer overlays"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <DevToggle
                    label="Tile grid"
                    on={devFlags.tiles}
                    onClick={() => toggleDevFlag('tiles')}
                  />
                  <DevToggle
                    label="Pixel grid"
                    on={devFlags.pixels}
                    onClick={() => toggleDevFlag('pixels')}
                  />
                  <DevToggle
                    label="FPS counter"
                    on={devFlags.fps}
                    onClick={() => toggleDevFlag('fps')}
                  />
                  <DevToggle
                    label="Coords"
                    on={devFlags.coords}
                    onClick={() => toggleDevFlag('coords')}
                  />

                  <p className="mt-3 text-xs leading-snug text-white/40">
                    Unlocked via <code className="text-white/60">?dev</code>.
                    Add <code className="text-white/60">?dev=0</code> to hide.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Shop open={shopOpen} onClose={() => setShopOpen(false)} />
    </>
  )
}

// One labelled on/off row in the Developer popover (styled like the Settings
// toggles). Shows the current state as the button text.
function DevToggle({
  label,
  on,
  onClick,
}: {
  label: string
  on: boolean
  onClick: () => void
}) {
  return (
    <div className="mt-3 flex items-center justify-between first:mt-0">
      <span className="text-xs text-white/50">{label}</span>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        className="min-w-[3.5rem] rounded-full bg-white/[0.12] px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/15 transition-colors hover:bg-white/20"
      >
        {on ? 'On' : 'Off'}
      </button>
    </div>
  )
}

// One stat cell in the Settings footer. Shows an em-dash until the number arrives.
function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div>
      <dt className="text-xs text-white/45">{label}</dt>
      <dd className="text-lg leading-tight tabular-nums text-white/90">
        {value == null ? '—' : value.toLocaleString()}
      </dd>
    </div>
  )
}
