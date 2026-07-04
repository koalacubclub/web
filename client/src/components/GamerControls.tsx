import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowUp, ChevronsRight, Hand, MessageCircle, Zap } from 'lucide-react'
import { ABILITY_COOLDOWNS_MS, type AbilityKind } from '@koala/shared'
import * as controls from '@/game/controlsStore'

// Coarse-pointer = touch device. The joystick is mobile-only; the ability buttons
// show on both (desktop also has keyboard shortcuts).
const IS_TOUCH =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches

// The controls are deliberately DISCREET — faint golden glass (gold = the ♥ score
// colour) so the park shows through, firming up only while in use.

// The on-screen control overlay, shown only in Gamer mode while the hero is up.
// Rendered inside Home's pointer-events-none hero layer, so only these control
// zones capture touch — an empty-center swipe still scrolls the page.
export default function GamerControls({ atTop }: { atTop: boolean }) {
  const gamer = useSyncExternalStore(
    controls.subscribe,
    controls.getGamerMode,
    controls.getGamerMode,
  )
  if (!gamer || !atTop) return null
  return (
    <>
      {IS_TOUCH && <Joystick />}
      <AbilityDock />
    </>
  )
}

// A fixed, always-visible analog joystick anchored bottom-left (so it's obvious
// what steers and everything else scrolls). Faint when idle, brighter while held.
// It's a <button> (so the canvas' window-level touch handlers bail via their
// `a,button` gate) with touchAction none + stopPropagation.
function Joystick() {
  const baseRef = useRef<HTMLButtonElement>(null)
  const pointerId = useRef<number | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [held, setHeld] = useState(false)

  // If the stick unmounts mid-drag (scrolled away while held), the pointerup
  // handler never runs — release the vector so the koala doesn't keep walking.
  useEffect(() => () => controls.clearMove(), [])

  const update = (clientX: number, clientY: number) => {
    const el = baseRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const max = r.width / 2
    let dx = clientX - (r.left + max)
    let dy = clientY - (r.top + r.height / 2)
    const mag = Math.hypot(dx, dy)
    if (mag > max) {
      dx = (dx / mag) * max
      dy = (dy / mag) * max
    }
    setKnob({ x: dx, y: dy })
    controls.setMove(dx / max, dy / max)
  }
  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    pointerId.current = e.pointerId
    baseRef.current?.setPointerCapture(e.pointerId)
    setHeld(true)
    update(e.clientX, e.clientY)
  }
  const onMove = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return
    e.stopPropagation()
    update(e.clientX, e.clientY)
  }
  const release = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return
    pointerId.current = null
    setHeld(false)
    setKnob({ x: 0, y: 0 })
    controls.clearMove()
  }

  return (
    <button
      ref={baseRef}
      type="button"
      aria-label="Movement joystick"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={release}
      onPointerCancel={release}
      className="pointer-events-auto absolute h-28 w-28 rounded-full backdrop-blur-[2px] transition-opacity duration-200"
      style={{
        left: 'max(1.25rem, env(safe-area-inset-left))',
        bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        touchAction: 'none',
        background: cssGold(0.08),
        boxShadow: `inset 0 0 0 1px ${cssGold(held ? 0.5 : 0.28)}`,
        opacity: held ? 1 : 0.55,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full"
        style={{
          background: cssGold(held ? 0.8 : 0.5),
          boxShadow: `0 0 12px ${cssGold(held ? 0.5 : 0.25)}`,
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      />
    </button>
  )
}

function cssGold(alpha: number): string {
  return `oklch(0.82 0.13 78 / ${alpha})`
}

const ABILITY_META: Record<
  AbilityKind,
  { label: string; Icon: typeof ArrowUp }
> = {
  jump: { label: 'Jump', Icon: ArrowUp },
  dash: { label: 'Dash forward', Icon: ChevronsRight },
  bite: { label: 'Bite', Icon: Zap },
  hand: { label: 'Swipe', Icon: Hand },
  meow: { label: 'Meow', Icon: MessageCircle },
}

// Ability cluster anchored bottom-right: a big Jump + a 2×2 grid of the rest.
function AbilityDock() {
  return (
    <div
      className="pointer-events-none absolute flex items-end gap-2.5"
      style={{
        right: 'max(1rem, env(safe-area-inset-right))',
        bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <AbilityBtn a="dash" size={48} />
        <AbilityBtn a="bite" size={48} />
        <AbilityBtn a="hand" size={48} />
        <AbilityBtn a="meow" size={48} />
      </div>
      <AbilityBtn a="jump" size={64} primary />
    </div>
  )
}

function AbilityBtn({
  a,
  size,
  primary,
}: {
  a: AbilityKind
  size: number
  primary?: boolean
}) {
  const { label, Icon } = ABILITY_META[a]
  // A cooldown wedge that sweeps away as the ability recovers (rAF-polled).
  const [cooldown, setCooldown] = useState(0) // 0..1 remaining
  useEffect(() => {
    let raf = 0
    const cd = ABILITY_COOLDOWNS_MS[a]
    const tick = () => {
      const since = performance.now() - controls.getFiredAt(a)
      setCooldown(cd > 0 ? Math.max(0, 1 - since / cd) : 0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [a])

  // Fire on click so keyboard (Enter/Space) + assistive tech work — a native
  // button turns those into `click`, never `pointerdown`. onPointerDown only
  // stops the event reaching the canvas' window-level gesture handlers.
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => controls.fireAbility(a)}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto relative flex items-center justify-center rounded-full backdrop-blur-[2px] transition-colors"
      style={{
        width: size,
        height: size,
        touchAction: 'manipulation',
        background: cssGold(primary ? 0.2 : 0.1),
        boxShadow: `inset 0 0 0 1px ${cssGold(primary ? 0.5 : 0.3)}`,
        color: primary ? '#fff' : 'rgba(255,255,255,0.9)',
      }}
    >
      <Icon style={{ width: size * 0.42, height: size * 0.42 }} />
      {cooldown > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(rgba(0,0,0,0.5) ${cooldown * 360}deg, transparent 0deg)`,
          }}
        />
      )}
    </button>
  )
}
