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

// A fixed analog joystick anchored bottom-left, shaped like a cat food bowl (a
// rimmed bowl with two ears) so it reads as a toy, drawn as a thin gold outline
// with NO fill. The knob is a little cosmetic "pole" (lever + ball). It's a
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
      {/* Cat-bowl outline (no fill) */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        fill="none"
        stroke={line}
        strokeWidth={2}
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* ears */}
        <path d="M26 30 L20 15 L38 24 Z" />
        <path d="M74 30 L80 15 L62 24 Z" />
        {/* bowl: rim ellipse + rounded body */}
        <ellipse cx="50" cy="34" rx="34" ry="10" />
        <path d="M16 34 C18 64, 30 82, 50 82 C70 82, 82 64, 84 34" />
      </svg>
      {/* Cosmetic pole (lever) + ball knob, moved with the drag */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2"
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      >
        <span
          className="block h-10 w-1.5 -translate-y-4 rounded-full"
          style={{ background: gold(held ? 0.45 : 0.28) }}
        />
        <span
          className="absolute left-1/2 top-0 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: gold(held ? 0.7 : 0.45),
            boxShadow: `0 0 10px ${gold(held ? 0.4 : 0.2)}`,
          }}
        />
      </span>
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

// Ability WHEEL: Jump anchored in the bottom-right corner; the four others fan out
// in a quarter-arc hugging it (top → left), so the cluster stays compact.
const JUMP_SIZE = 60
const ARC_BTN = 42
const ARC_R = 60 // arc radius from the jump centre
const ARC = [
  { a: 'dash' as const, deg: 90 }, // straight above jump
  { a: 'bite' as const, deg: 120 },
  { a: 'hand' as const, deg: 150 },
  { a: 'meow' as const, deg: 180 }, // straight left of jump
]
// Box big enough to hold the arc (jump centre sits at its bottom-right).
const BOX = JUMP_SIZE / 2 + ARC_R + ARC_BTN / 2

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
      {ARC.map(({ a, deg }) => {
        const rad = (deg * Math.PI) / 180
        // Centre offset from the jump centre (which is at the box's bottom-right).
        const centreRight = JUMP_SIZE / 2 - ARC_R * Math.cos(rad)
        const centreBottom = JUMP_SIZE / 2 + ARC_R * Math.sin(rad)
        return (
          <AbilityBtn
            key={a}
            a={a}
            size={ARC_BTN}
            style={{
              position: 'absolute',
              right: centreRight - ARC_BTN / 2,
              bottom: centreBottom - ARC_BTN / 2,
            }}
          />
        )
      })}
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
    const tick = () => {
      const since = performance.now() - controls.getFiredAt(a)
      setCooldown(cd > 0 ? Math.max(0, 1 - since / cd) : 0)
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
