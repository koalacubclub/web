import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Settings, ShoppingBag, X } from 'lucide-react'
import * as parkStore from '@/game/parkStore'
import { MULTIPLAYER_ENABLED } from '@/multiplayer/connection'
import { NAME_MAX } from '@koala/shared'
import Shop from './Shop'

const DISPLAY_FONT = "'Cormorant Garamond', Georgia, serif"
const PILL =
  'flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-white/80 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/20 hover:text-white'

// The hero's bottom control cluster: the score/likes readout + the Shop trigger +
// a Settings button (rename), grouped on one line. Score/coins + the display name
// come from parkStore (server-fed in multiplayer). Settings is only shown when a
// backend is configured — renaming is a server action.
export default function BottomBar({ atTop }: { atTop: boolean }) {
  const snap = useSyncExternalStore(
    parkStore.subscribe,
    parkStore.getSnapshot,
    parkStore.getSnapshot,
  )

  const [shopOpen, setShopOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const shopTriggerRef = useRef<HTMLButtonElement>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Close everything once the hero is scrolled away.
  useEffect(() => {
    if (!atTop) {
      setShopOpen(false)
      setSettingsOpen(false)
    }
  }, [atTop])

  // Settings popover: seed the input, focus it, close on Escape.
  useEffect(() => {
    if (!settingsOpen) return
    setNameDraft(snap.name)
    nameInputRef.current?.focus()
    nameInputRef.current?.select()
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

  const barVisibility =
    atTop && !shopOpen
      ? 'pointer-events-auto opacity-100'
      : 'pointer-events-none opacity-0'

  return (
    <>
      <div
        className={`absolute bottom-6 left-1/2 flex -translate-x-1/2 items-end gap-3 transition-opacity duration-300 sm:bottom-7 ${barVisibility}`}
      >
        {/* Score / likes readout (was the on-canvas HUD pill). Current money
            only — the personal best is still tracked, just not displayed. */}
        <div
          className="flex items-center gap-1.5 rounded-full bg-black/40 px-4 py-2 leading-none text-white ring-1 ring-white/10 backdrop-blur-md"
          style={{ fontFamily: DISPLAY_FONT }}
          aria-label={`${snap.coins} likes`}
        >
          <span className="text-[oklch(0.82_0.13_78)]" aria-hidden="true">
            ★
          </span>
          <span className="text-xl tabular-nums">{snap.coins}</span>
        </div>

        {/* Shop trigger */}
        <button
          ref={shopTriggerRef}
          type="button"
          onClick={() => {
            setSettingsOpen(false)
            setShopOpen(true)
          }}
          aria-haspopup="dialog"
          aria-expanded={shopOpen}
          aria-label="Open the shop"
          className={PILL}
        >
          <ShoppingBag className="h-4 w-4" />
          <span
            className="text-base leading-none"
            style={{ fontFamily: DISPLAY_FONT }}
          >
            Shop
          </span>
        </button>

        {/* Settings (rename) — server-backed, so only when connected */}
        {MULTIPLAYER_ENABLED && (
          <div className="relative">
            <button
              ref={settingsTriggerRef}
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onTouchStartCapture={(e) => e.stopPropagation()}
                  className="absolute bottom-[calc(100%+10px)] right-0 w-72 rounded-2xl bg-[oklch(0.13_0.008_60_/_0.97)] p-3 ring-1 ring-white/15 backdrop-blur-md"
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

                  {/* Display name */}
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
                    <Stat label="Active (24h)" value={snap.stats?.active24h} />
                    <Stat label="Your visits" value={snap.stats?.yourVisits} />
                    <Stat
                      label="Total sessions"
                      value={snap.stats?.totalSessions}
                    />
                    <Stat label="Online" value={snap.online.length} />
                  </dl>
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
