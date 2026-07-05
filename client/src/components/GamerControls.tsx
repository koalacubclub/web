import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowUp, ChevronsRight, Hand, MessageCircle, Zap } from 'lucide-react'
import {
  ABILITY_COOLDOWNS_MS,
  GLOBAL_COOLDOWN_MS,
  isOnGlobalCooldown,
  type AbilityKind,
} from '@koala/shared'
import * as controls from '@/game/controlsStore'

// Coarse-pointer = touch device. The joystick is mobile-only; the ability buttons
// show on both (desktop also has keyboard shortcuts).
const IS_TOUCH =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches

// Gold = the ♥ score colour. Controls are kept as SEE-THROUGH as possible: thin
// gold outlines + a knob, almost no fill, so the park shows through.
const gold = (a: number) => `oklch(0.82 0.13 78 / ${a})`

// The on-screen control overlay, shown only in Gamer mode while the hero is up.
// Lives inside Home's pointer-events-none hero layer, so only these control zones
// capture touch — an empty-area swipe still scrolls the page.
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

// A fixed analog joystick anchored bottom-left, drawn as a flat plate (two thin
// gold ellipses, NO fill) with a simple ball knob that slides on it. It's a
// <button> (so the canvas' window touch handlers bail via their `a,button` gate)
// with touchAction none + stopPropagation.
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

  const line = gold(held ? 0.5 : 0.32)
  return (
    <button
      ref={baseRef}
      type="button"
      aria-label="Movement joystick"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={release}
      onPointerCancel={release}
      className="pointer-events-auto absolute h-28 w-28 transition-opacity duration-200"
      style={{
        left: 'max(1rem, env(safe-area-inset-left))',
        bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        touchAction: 'none',
        opacity: held ? 1 : 0.7,
      }}
    >
      {/* Flat plate outline (rim + well), no fill */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        fill="none"
        stroke={line}
        strokeWidth={2}
        aria-hidden="true"
      >
        <ellipse cx="50" cy="52" rx="46" ry="20" />
        <ellipse cx="50" cy="50" rx="33" ry="13" />
      </svg>
      {/* Ball knob, slides with the drag */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-9 w-9 rounded-full"
        style={{
          background: gold(held ? 0.7 : 0.45),
          boxShadow: `0 0 12px ${gold(held ? 0.4 : 0.2)}`,
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      />
    </button>
  )
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

// Ability WHEEL: a big Jump anchored in the bottom-right corner, the three MAIN
// abilities (dash/bite/hand — the ones you actually aim/use) in a tight arc
// hugging it, and Meow as a small emote tucked right beside Jump (like a Wild-Rift
// summoner spell) since it's a fire-and-forget sprite you don't position.
const JUMP_SIZE = 72
const MAIN_BTN = 48
const MEOW_BTN = 32
const ARC_R = 72 // radius of the main arc from the jump centre
const MAIN_ARC = [
  { a: 'dash' as const, deg: 80 },
  { a: 'bite' as const, deg: 120 },
  { a: 'hand' as const, deg: 160 },
]
const MEOW_POS = { deg: 200, r: 60 } // tucked low-left, right by jump
// Box big enough to hold the arc (jump centre sits at its bottom-right).
const BOX = JUMP_SIZE / 2 + ARC_R + MAIN_BTN / 2 + 4

// Polar → absolute right/bottom offsets, measured from the jump centre (which
// sits at the box's bottom-right).
function place(deg: number, r: number, size: number): React.CSSProperties {
  const rad = (deg * Math.PI) / 180
  return {
    position: 'absolute',
    right: JUMP_SIZE / 2 - r * Math.cos(rad) - size / 2,
    bottom: JUMP_SIZE / 2 + r * Math.sin(rad) - size / 2,
  }
}

function AbilityDock() {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        right: 'max(0.75rem, env(safe-area-inset-right))',
        bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        width: BOX,
        height: BOX,
      }}
    >
      {MAIN_ARC.map(({ a, deg }) => (
        <AbilityBtn
          key={a}
          a={a}
          size={MAIN_BTN}
          style={place(deg, ARC_R, MAIN_BTN)}
        />
      ))}
      <AbilityBtn
        a="meow"
        size={MEOW_BTN}
        style={place(MEOW_POS.deg, MEOW_POS.r, MEOW_BTN)}
      />
      <AbilityBtn
        a="jump"
        size={JUMP_SIZE}
        primary
        style={{ position: 'absolute', right: 0, bottom: 0 }}
      />
    </div>
  )
}

function AbilityBtn({
  a,
  size,
  primary,
  style,
}: {
  a: AbilityKind
  size: number
  primary?: boolean
  style?: React.CSSProperties
}) {
  const { label, Icon } = ABILITY_META[a]
  // A cooldown wedge that sweeps away as the ability recovers (rAF-polled).
  const [cooldown, setCooldown] = useState(0) // 0..1 remaining
  useEffect(() => {
    let raf = 0
    const cd = ABILITY_COOLDOWNS_MS[a]
    const onGcd = isOnGlobalCooldown(a)
    const tick = () => {
      const now = performance.now()
      // Per-ability cooldown wedge…
      const perAbility =
        cd > 0 ? Math.max(0, 1 - (now - controls.getFiredAt(a)) / cd) : 0
      // …plus the shared global cooldown (every GCD button sweeps together).
      let gcd = 0
      if (onGcd) {
        const until = controls.getGcdUntil()
        if (now < until) gcd = Math.min(1, (until - now) / GLOBAL_COOLDOWN_MS)
      }
      setCooldown(Math.max(perAbility, gcd))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [a])

  // Fire on click so keyboard (Enter/Space) + assistive tech work — a native
  // button turns those into `click`, never `pointerdown`. onPointerDown only stops
  // the event reaching the canvas' window-level gesture handlers.
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => controls.fireAbility(a)}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto flex items-center justify-center rounded-full backdrop-blur-[1px] transition-colors"
      style={{
        width: size,
        height: size,
        touchAction: 'manipulation',
        background: gold(primary ? 0.14 : 0.07),
        boxShadow: `inset 0 0 0 1.5px ${gold(primary ? 0.55 : 0.4)}`,
        color: primary ? '#fff' : 'rgba(255,255,255,0.92)',
        ...style,
      }}
    >
      <Icon style={{ width: size * 0.42, height: size * 0.42 }} />
      {cooldown > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(rgba(0,0,0,0.45) ${cooldown * 360}deg, transparent 0deg)`,
          }}
        />
      )}
    </button>
  )
}
