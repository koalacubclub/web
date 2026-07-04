import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, X } from 'lucide-react'
import * as parkStore from '@/game/parkStore'
import { SHOP_ITEMS } from '@/game/shopItems'
import ItemPreview from './ItemPreview'

const DISPLAY_FONT = "'Cormorant Garamond', Georgia, serif"

// The shop: a trigger button (in the hero overlay) + a **bottom sheet** carousel
// of buyable decorations rendered as their real art. Buying spends the game score
// (coins) and spawns the item at Koala's tile. The sheet only covers the bottom
// of the screen and adds **no backdrop dim/blur**, so the park stays visible and
// interactive above it — you can position Koala, then buy, and watch it land.
export default function Shop({ atTop }: { atTop: boolean }) {
  // Live coin balance (re-renders only this component, never the game loop).
  const snap = useSyncExternalStore(
    parkStore.subscribe,
    parkStore.getSnapshot,
    parkStore.getSnapshot,
  )
  const coins = snap.coins

  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState<{
    key: string
    kind: 'ok' | 'no-room'
  } | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const feedbackTimer = useRef<number | undefined>(undefined)

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  // Hide the shop once the hero is scrolled away (matches the other controls).
  useEffect(() => {
    if (!atTop) setOpen(false)
  }, [atTop])

  // Escape closes; focus the close button on open.
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    },
    [],
  )

  const buy = (key: string) => {
    const result = parkStore.purchase(key)
    if (result === 'insufficient') return // Buy is disabled in this case
    setFeedback({ key, kind: result })
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 1500)
  }

  const Coin = ({ value }: { value: number }) => (
    <span className="inline-flex items-center gap-1 text-[oklch(0.82_0.13_78)]">
      <span aria-hidden="true">★</span>
      <span>{value}</span>
    </span>
  )

  return (
    <>
      {/* Trigger — a real <button>, so the game's pointer handler ignores it.
          Hidden while the sheet is open (the sheet sits over it). */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open the shop"
        className={`absolute bottom-6 right-5 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-white/80 ring-1 ring-white/15 backdrop-blur-md transition-all duration-300 hover:bg-white/20 hover:text-white sm:bottom-7 sm:right-7 ${
          atTop && !open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <ShoppingBag className="h-4 w-4" />
        <span
          className="text-base leading-none"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          Shop
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Shop"
            className="pointer-events-auto fixed inset-x-0 bottom-0 z-50 bg-gradient-to-t from-[oklch(0.11_0.008_60_/_0.98)] from-30% to-[oklch(0.16_0.01_60_/_0)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            // Stop pointer/touch-downs on the sheet from reaching the window
            // listeners that would otherwise start walking Koala underneath it.
            // (No full-screen backdrop, so the park above stays interactive.)
            onPointerDownCapture={(e) => e.stopPropagation()}
            onTouchStartCapture={(e) => e.stopPropagation()}
          >
            {/* Close button — floats just above the sheet, over the park */}
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close the shop"
              className="absolute -top-5 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/80 ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Horizontal carousel — items at real relative size, ground-aligned */}
            <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto px-2 pb-2 pt-5 sm:px-2 [scrollbar-width:thin]">
              {SHOP_ITEMS.map((item) => {
                const affordable = coins >= item.price
                const fb = feedback?.key === item.key ? feedback.kind : null
                return (
                  <div
                    key={item.key}
                    className="flex shrink-0 snap-start flex-col items-center gap-1"
                  >
                    <div className="flex h-[130px] items-end justify-center">
                      <ItemPreview item={item} />
                    </div>
                    <button
                      type="button"
                      onClick={() => buy(item.key)}
                      disabled={!affordable}
                      aria-label={`Buy ${item.label} for ${item.price} coins`}
                      className={`min-w-[74px] rounded-full px-3 py-1.5 text-sm transition-all duration-200 ${
                        fb === 'ok'
                          ? 'bg-[oklch(0.7_0.13_150)]/25 text-[oklch(0.85_0.13_150)] ring-1 ring-[oklch(0.7_0.13_150)]/40'
                          : fb === 'no-room'
                            ? 'bg-[oklch(0.7_0.14_60)]/20 text-[oklch(0.85_0.12_75)] ring-1 ring-[oklch(0.7_0.14_60)]/40'
                            : 'bg-white/[0.06] text-white/80 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/[0.06]'
                      }`}
                    >
                      {fb === 'ok' ? (
                        'Placed ✓'
                      ) : fb === 'no-room' ? (
                        'No room'
                      ) : (
                        <Coin value={item.price} />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
