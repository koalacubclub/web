# ParkGame — the hero mini-game

`src/components/ParkGame.tsx` is a self-contained **canvas 2D** mini-game that
serves as the site hero: Koala walks around a nighttime park and catches food
that spawns for points. It's a Neko-Atsume-style, cozy flat-cartoon look — all art
is drawn **procedurally** with `ctx` shapes (no spritesheet), except the drop-in
food PNGs.

## How it's built

- **One `useEffect`** sets up the canvas, input listeners, and a
  `requestAnimationFrame` loop. All mutable state lives in a `useRef`
  (`gameRef.current`) — the game never triggers React re-renders (perf).
- **Coordinate system:** tiles of `PIXEL = 16 * SCALE` (48px). The map is
  `MAP_COLS=20` × `MAP_ROWS = GROUND_ROWS(13) + SKY_ROWS(4)`. The playable park is
  the ground rows; the world is drawn shifted down by `WORLD_OFFSET` so there's sky
  above it. Positions are tile coords; cat/food centers are `tile + 0.5`.
- **Render order:** ground/objects/cat are drawn, then a purple `multiply` night
  wash over everything, then stars/moon/**food**/popups/HUD on top (true colors,
  above the wash).
- **Controls:** arrow keys / WASD, or tap / press-and-drag to walk toward the
  pointer. On viewports narrower than the (scaled) canvas, a **horizontal camera**
  pans the canvas via CSS `transform` to keep Koala centered; the score HUD is
  offset by `g.hudShift` so it stays pinned to the viewport instead of sliding
  with the pan.
- **Reduced motion:** the page respects `prefers-reduced-motion` for framer-motion
  and CSS, but the canvas loop itself keeps animating (it's the hero centerpiece).

## Food-collectible system

Config lives at the top of the file:

```ts
FOODS = [{ key, label, emoji, points, weight, tier }, …]
```

- **Spawning:** every ~4–9s, up to 3 on screen at once, on a random free ground
  tile (weighted by `weight`, avoiding objects/other food/the cat). Each has a
  ~15s lifespan (blinks before despawning).
- **Collecting:** walk within ~0.85 tile → score `+= points`, a `+N Label` popup
  pops, and Koala shows hearts. Rarer/higher-point items (goldfish = 50) spawn
  less often.
- **Score:** shown in a top-left HUD; the **best score persists** in
  `localStorage` under `kcc-park-best`.
- **Art:** each food renders its **emoji as a fallback**, and automatically uses
  `public/game/food/<key>.png` (256px, transparent) once that file exists — images
  are preloaded into `g.foodImages`. To add real art, drop the PNGs in; no code
  change. Full sprite spec + generation prompts: [food-icons.md](./food-icons.md).

## Tuning

Spawn cadence, max on screen, lifespan, collect radius, and the `FOODS` table
(items/points/weights) are all constants near the top of `ParkGame.tsx`. The unit
test (`src/pages/Home.test.tsx`) asserts the game canvas renders with its
`aria-label`; keep that label containing "Koala's Park".
