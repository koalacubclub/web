# ParkGame — the hero mini-game

`src/components/ParkGame.tsx` is a self-contained **canvas 2D** mini-game that
serves as the site hero: Koala walks around a nighttime park and catches food
that spawns for points. It's a Neko-Atsume-style, cozy flat-cartoon look — all art
is drawn **procedurally** with `ctx` shapes (no spritesheet, no image assets).

## How it's built

- **One `useEffect`** sets up the canvas, input listeners, and a
  `requestAnimationFrame` loop. All mutable state lives in a `useRef`
  (`gameRef.current`) — the game never triggers React re-renders (perf).
- **Coordinate system:** tiles of `PIXEL = 16 * SCALE` (48px). The map is
  `MAP_COLS=58` × `MAP_ROWS = GROUND_ROWS(13) + SKY_ROWS(2)`. The playable park is
  the ground rows; the world is drawn shifted down by `WORLD_OFFSET` so there's sky
  above it. Positions are tile coords; cat/food centers are `tile + 0.5`.
- **Render order:** ground/objects/cat are drawn, then a purple `multiply` night
  wash over everything, then stars/moon/**food**/popups/HUD on top (true colors,
  above the wash).
- **Controls (desktop):** arrow keys / WASD, or mouse press-and-drag to walk Koala
  toward the pointer (release to stop). Mouse/pen engage immediately. **Space** =
  jump; the on-screen ability buttons + keyboard keys (shift = dash, 1/2 =
  bite/hand, where **hand** is the paw-slap) — see Multiplayer → Abilities.
  Ability buttons fire on **pointerdown** (not click) so you can cast mid-run on
  mobile — a second finger's tap is a non-primary pointer that never gets a
  synthesized click; keyboard/AT still fire via the `detail===0` click.
  **Meow** is not a button/key — it's a cosmetic emote fired by **tapping Koala**.
- **Controls (touch):** the hero stays a **scrollable** hero — a quick **swipe
  scrolls the page**, a tap on a channel sign / photo opens it, a tap on Koala
  meows, and a **double-tap** jumps. Movement is the on-screen **joystick** (a
  fixed, discreet golden stick bottom-left; ability buttons bottom-right, always
  shown) — **or** a **press-and-hold** anywhere on the open park: hold still for a
  beat (`HOLD_MS`) and Koala walks toward your finger, following it as you drag
  (release to stop), the same "walk toward the pointer" the mouse uses. The
  hold-to-steer path is the **only** touch gesture that `preventDefault`s (and only
  once engaged), so a plain swipe still scrolls natively; hold-vs-swipe is the only
  way to tell steering from scrolling, so they interfere a little — the joystick
  stays the primary mover and hold-to-walk is a zero-UI fallback for drop-in
  players who never spot it.
- **Camera:** on viewports narrower than the (scaled) canvas, a **horizontal
  camera** pans the canvas via CSS `transform` to keep Koala centered; the score
  HUD is offset by `g.hudShift` so it stays pinned to the viewport instead of
  sliding with the pan. Details of `updateCamera()`:
  - **Fit gate:** panning is a no-op unless the canvas is actually wider than the
    viewport (`displayW - viewportW > 0.5`) — when the whole map fits, the
    transform stays at `0` and `g.hudShift = 0`.
  - **Clamped follow:** the canvas is laid out centered, so its left edge sits at
    `centeredLeft = (viewportW - displayW) / 2`. The camera picks a target left
    edge that puts Koala at viewport-center (`viewportW/2 - catDisplayX`),
    **clamped to `[viewportW - displayW, 0]`** so it never scrolls past the map's
    left (`> 0`) or right (`< viewportW - displayW`) edge:
    `desiredLeft = min(0, max(viewportW - displayW, viewportW/2 - catDisplayX))`.
    The applied transform is the delta from the centered layout,
    `tx = desiredLeft - centeredLeft`, and it's written to
    `canvas.style.transform` **only when `tx` actually changes** (`lastTx`).
  - **HUD counter-pan:** `g.hudShift = -desiredLeft * (CANVAS_WIDTH / displayW)`
    converts the pan back into logical canvas px so `drawHUD()` can offset the
    score pill and keep it pinned to the viewport's left.
  - **No per-frame reflow:** `viewportW` / `displayW` are cached, read from a
    `measure()` helper on setup and refreshed by a **`ResizeObserver`** on the
    canvas (plus the window `resize` handler) — the loop never reads `offsetWidth`.
  - **Measurement gotcha:** `viewportW` is measured from
    `canvas.parentElement.clientWidth`, **not `window.innerWidth`** — the latter
    includes the vertical scrollbar, but the canvas is centered in the
    scrollbar-excluded content box. Using `innerWidth` made the right clamp
    overshoot by the scrollbar width, so the camera stopped short of the right
    edge and Koala could slide off-screen going right. The `ResizeObserver` also
    matters here: a scrollbar appearing or a DPR / mobile `svh` change resizes the
    canvas **without** firing window `resize`, which would otherwise leave a stale
    `displayW`.
- **Cat idle states:** standing → **lying** after ~10s idle → **sleeping** after
  ~20s (with a "Zzz" dream bubble); any input resets it. Idle time is counted in
  frame-rate-independent units (see Rendering & performance).
- **Reduced motion:** the page respects `prefers-reduced-motion` for framer-motion
  and CSS, but the canvas loop itself keeps animating (it's the hero centerpiece).

## Food-collectible system

> **Multiplayer vs solo.** When connected to the backend, the **server owns food
> and scoring** (see [decisions.md](./decisions.md) #14): it spawns a shared set,
> the client asks to collect on proximity, and the server validates + awards
> "likes" (== coins). The behaviour below is the **solo** (no-backend) fallback;
> the numbers (`FOODS` table, TTL, radius) are shared in `shared/protocol.ts` so
> both paths match.

Config lives at the top of the file (presentation) + `shared/protocol.ts` (the
`FOODS` table — points/weight/tier — shared with the server):

```ts
FOODS = [{ key, label, emoji, points, weight, tier }, …]
```

- **Spawning:** every ~4–9s, up to `foodCap(players)` on screen — ≈half the crowd
  rounded up (1 solo, 2 for 3 players, 5 for 10), on a random free ground
  tile (weighted by `weight`, avoiding objects/other food/the cat). Each has a
  ~30s lifespan (`FOOD_TTL_MS`; blinks before despawning). This cap is a **single
  budget** shared with airborne food (below) — the total on the map, ground +
  airborne, never exceeds `foodCap(players)`.
- **Collecting:** walk within ~0.85 tile → coins `+= points`, a `+N` popup pops,
  and Koala shows hearts. Rarer/higher-point items (goldfish = 50) spawn less
  often.
- **Score:** shown in an on-canvas HUD pill that sits just above the ground line
  (pinned against the camera pan via `g.hudShift`). The score is the coin wallet —
  in multiplayer it's the **server-owned likes total**; solo, the best persists in
  `localStorage` under `kcc-park-best`.
- **Art:** each food is drawn **procedurally with `ctx` primitives**
  (`drawFoodShape()`) as flat basic-shape art, matching the park's other objects
  instead of looking like pasted-in emoji. Colours are bright because food is
  drawn **above** the purple night wash (unlike the objects beneath it) so it
  reads as collectible. The item's emoji is only a last-resort fallback for an
  unknown key. (There is **no PNG sprite pipeline** anymore — the old drop-in
  `public/game/food/<key>.png` loader was removed; see the legacy note in
  [food-icons.md](./food-icons.md) if you ever want to reintroduce raster art.)

## Shop & placed decorations

A **shop** spends coins to buy decorations that spawn at Koala's tile. The
**top-right cluster** (`client/src/components/BottomBar.tsx`, mounted by Home next
to the social icons) is two pills: the **score/likes pill — which opens the shop**
(consolidated; no separate Shop button) and **Settings**. Shop opens a **bottom
sheet** that leaves the park visible so you can see where things land. Settings is
always available and holds the **radio mute** toggle (persisted to
`localStorage`), plus — when connected — the display-name field, the live online
roster, and the world stats. It's bridged through a small framework-agnostic store
so the React UI and the imperative canvas never fight.

> **Multiplayer vs solo.** When connected, the **server owns the whole economy**
> (see [decisions.md](./decisions.md) #14/#15): coins == likes, purchases are
> validated + charged server-side, and placed items are **shared across players**
> with a server-owned TTL. `parkStore` becomes a server-fed mirror
> (`setServerBuyer`/`applyServerWallet`/`applyServerPlaced`); `purchase()` sends a
> `buy` and the item appears when the server broadcasts it. The store details
> below are how it works, with localStorage as the **solo** fallback.

- **`client/src/game/parkStore.ts`** — the client-side bridge for the wallet
  (`coins`/`best`) + placed items. React reads it via `useSyncExternalStore`
  (live balance); the game loop reads/writes plain imperative getters (`getCoins`,
  `getPlaced`, `setCatTile`) so the 60fps loop never triggers a React re-render.
  In multiplayer it's **fed by the server** (`applyServerWallet`/`applyServerPlaced`)
  and `purchase()` routes a `buy` to it (`setServerBuyer`); solo, `earn()` /
  `purchase()` / `sweepExpired()` mutate it directly and persist to localStorage.
- **`shared/protocol.ts` → `SHOP_ITEMS`** — the catalog (`key,label,type,w,h,price`)
  now lives in the shared protocol so the **server** validates purchases against
  the same prices + footprints; `client/src/game/shopItems.ts` re-exports it.
  Reuses existing decor (flowers / mushroom / rock / ball / bench / pond / tree)
  plus shop-only sprites: `snowcat`, `cardbox`, a 4×4 `house`, and a `radio`.
- **Boombox (interactive):** the 2×1 `radio` sprite plays a driving rave loop when
  Koala walks within ~2.5 tiles of it — its speakers pulse and music notes drift
  up. The audio is synthesised with the Web Audio API in `client/src/game/radio.ts`
  (created lazily after a user gesture, per autoplay rules; a no-op where Web Audio
  is unavailable). The game loop reports the _local_ koala's proximity each frame
  (`radio.setNear`), fading the sound in/out; it's silenced when the loop pauses
  (scroll away / tab hidden). There are **two tracks**: `TRACK_A` (a ~140 BPM
  four-on-the-floor A-minor house loop) and `TRACK_B` (a slower ~115 BPM half-time
  D-minor loop with a 2-bar melody). **Slapping the radio cycles** play-A → off →
  play-B → off → … (`radioCycle` 0–3 on the object; `radio.setTrack` picks the
  loop). The Settings **mute** toggle silences all of it globally (persisted).
- **`client/src/game/sprites.ts`** — the shop sprites, drawn with `ctx`
  primitives (`drawShopSprite`); the reused decor mirrors ParkGame's base-object
  art so a bought tree looks like a park tree. The shop renders the **real item
  art at real relative size** via `client/src/components/ItemPreview.tsx` (a
  `<canvas>`), not emoji.
- **Collision-aware placement:** on purchase the store spirals out from Koala's
  tile for the nearest spot whose whole `w×h` footprint fits the ground and
  **overlaps neither other placed items nor the fixed base objects** (registered
  once via `setObstacles`). A full ground returns `'no-room'` and charges nothing.
  Placed decor is **non-solid** — it never traps Koala, even on her own tile.
- **Lifetime (TTL):** placed items persist across reloads but **expire
  `PLACED_TTL_MS` (7 days) after purchase** — a wall-clock `expiresAt` (NOT
  `frameCount`, which pauses with the loop), swept on load and ~once/second during
  play. Fresh items **pop in**; they **blink** in the last 8 s before expiring
  (both wall-clock; skipped under `prefers-reduced-motion`). **Permanent** items
  (the seeded default balls) carry `expiresAt = PLACED_PERMANENT` (`0`), which both
  the sweep and the DO's wake-time reap explicitly skip — they never expire.
- **Persistence:** **multiplayer** — coins + placed items live in the Durable
  Object's SQLite (per-session wallet; shared placed table), fed into `parkStore`
  over the WebSocket. **Solo** — localStorage (`kcc-park-coins`/`-best`/`-placed`
  - `kcc-device-id` + schema version) behind the same `sync` seam. Callers (game
    loop + shop UI) don't change between modes.

## Scenery layout — keep it organic

The park should read as a natural, hand-placed scene, not a grid. Whenever you
**expand the map** (more cols/rows) or **add base objects** (trees, benches,
mushrooms, etc.), give the placement rhythm — do NOT line things up:

- **Vary the Y** of a row of objects. Trees especially must not all sit at the
  same `y` along the horizon — stagger them (integer or fractional tiles, e.g.
  `y: 1.2 / 1.7 / 2.3`) so the treeline undulates instead of forming a straight
  band.
- **Space unevenly along X.** Avoid a constant gap between neighbours (a "picket
  fence" look). Mix short and long gaps (e.g. cols `16, 20, 27, 37` → gaps
  `4, 7, 10`).
- The procedural per-object jitter (`makeRng` seeded by tile) varies each
  sprite's size/shape, but it does NOT move the tile — the varied `x/y` above is
  what breaks the alignment.
- New grass patches (`drawBlobPatch`) follow the same rule: overlap + scatter at
  irregular sizes/positions; keep the topmost ones tucked under the hill ridge and
  don't blanket the bottom edge solid (leave sand showing).
- **Keep the moon in clear sky** (`drawMoon`, `moonX`): it must not overlap trees
  or other objects, and only the hill ridge may just clip its lower edge — never
  let a tree/canopy or a raised object collide with the disc. If you move the moon
  or add tall objects near it, re-check they don't touch. It also has to stay
  inside the load-time centered view band (~cols 19–39) so it's visible on open.

## Rendering & performance

- **Device-resolution canvas.** The backing store is sized to ~device pixels —
  `RS = min(2, cssWidth × devicePixelRatio / CANVAS_WIDTH)` — and the game draws in
  logical coords via `ctx.setTransform(RS, …)`, scaled **smoothly** (there is
  **no `image-rendering: pixelated`**). Rendering at the small backing size and
  nearest-neighbor upscaling used to make everything blocky and made motion
  "crawl". The canvas uses a static `box-shadow`, not a per-frame `drop-shadow`
  filter.
- **Static background is baked once.** The sky gradient + ground (grass blobs,
  sand, dirt) never change, so they're rendered a single time into an **offscreen
  canvas** and blitted with one `drawImage` per frame instead of recomputing all
  the bézier/gradient work every frame.
- **Off-screen objects are culled.** The camera pans the wide (58-column) canvas
  via a CSS transform, so only a ~20-column slice is ever visible. The object pass
  computes that slice once per frame (`visibleRange` in `game/culling.ts`, from the
  camera's `hudShift`) and skips any object whose footprint — plus a pad for canopy/
  rim overhang — falls entirely outside it (`isVisibleX`), so most of the map's
  objects are never drawn. Both helpers are pure and unit-tested (`culling.test.ts`).
- **Reflective ponds are cheap.** Each pond shows a still, reflective surface. The
  mirrored **static** sky + hills never change, so they're **baked once per pond**
  into a cached sprite (`getPondReflection` in `game/pond.ts`, keyed by tile) and
  blitted — no per-frame `bgCanvas` resampling. The bake samples the **sky/hills
  band at the `HORIZON`**, not the ground directly above the pond, so the water
  reflects the sky and distant hills rather than the sand/grass it sits on. On top,
  nearby scenery and cats are mirrored live, but only when they pass cheap gates
  (over the water, within a few tiles above it, on screen — `objectReflectsInPond` /
  `catReflectAxis`, also unit-tested); the expensive sprite draw runs only for the
  rare object/cat actually above a visible pond. Off-screen ponds cost nothing
  (culled with everything else).
- **The loop pauses when it can't be seen.** `requestAnimationFrame` stops when the
  tab is hidden (`visibilitychange`) or the hero is scrolled out of view. The hero
  is `position: fixed` (always intersecting the viewport), so this uses a scroll
  check (`scrollY < innerHeight`), not an IntersectionObserver.
- **Frame-rate independent.** Everything is time-based, so it runs at the same real
  speed regardless of FPS (mobile often runs below 60). Each frame computes `dt`
  (clamped to 100ms so a tab-resume can't teleport anything): the cat moves at
  `0.0021 tiles/ms × dt`, `frameCount` advances as a real-time clock
  (`+= dt × 0.06`, i.e. 60fps-frame units) so every `sin(frameCount·k)` animation
  keeps pace, and per-frame integrations (butterflies, popups, the idle timer)
  scale by the same factor.

See [perf-main-thread-plan.md](./perf-main-thread-plan.md) for the broader
main-thread analysis — this canvas is the dominant animated surface.

## Tuning

Spawn cadence, max on screen, lifespan, collect radius, and the `FOODS` table
(items/points/weights) are all constants near the top of `ParkGame.tsx`. The unit
test (`src/pages/Home.test.tsx`) asserts the game canvas renders with its
`aria-label`; keep that label containing "Koala's Park".

## Multiplayer

The park is shared: other visitors appear as koalas that move in real time. The
backend is a Cloudflare Worker + Durable Object at `game.koalacub.club` (code in
`server/`, wire protocol in `shared/protocol.ts`); the architecture and rationale
are in [decisions.md](./decisions.md) (#14) and [multiplayer-deploy.md](./multiplayer-deploy.md).

How it plugs into the game loop (all inside the one canvas `useEffect`):

- **Connection** (`src/multiplayer/connection.ts`) is framework-agnostic. It does
  the session handshake (`POST /session`, credentialed), opens the WebSocket with
  backoff reconnect, and keeps a `Map<id, RemotePlayer>` the loop reads each
  frame. `createMultiplayer()` returns `null` when no backend is configured, so
  the game runs solo — the whole feature is behind one `if (mp)`.
- **Sending:** after `updateCat`, the loop calls `mp.sendState({x,y,dir,pose,
interacting})`. `connection.ts` throttles to `CLIENT_SEND_HZ` (~12/s) but lets a
  pose/dir/interacting change through immediately. Only that minimal state travels
  — leg/tail/idle animation is derived locally from the shared `frameCount`, so it
  never needs sending.
- **Drawing:** `drawCat(cat = g.cat, label?, jumpPx?, slap?)` is generalized — the local
  koala is drawn unlabelled, each remote one is drawn from a reused scratch object
  with a name tag, depth-sorted by `y`. Remote positions are interpolated toward
  their latest target (`rx/ry` lerp) so they glide between updates instead of
  teleporting.
- **Abilities (actions):** all abilities share one transient broadcast — client
  `mp.sendAction(a)` → `{t:'action',a}`; the server rate-limits per `(session,
ability)` (`ABILITY_COOLDOWNS_MS`), applies any side effect, and rebroadcasts
  `{t:'acted',id,a}` → each peer stamps `RemotePlayer.act/actAt` and the loop
  animates it (the actor plays its own locally). `AbilityKind = jump | dash | bite
| hand | meow`. **Jump** = a vertical hop (`jumpLiftTiles`; `x/y` never change so
  collision/camera stay grounded) that opens the **airborne-food** window: air food
  floats (drawn lifted + winged, grounded shrinking shadow), collectable **only**
  mid-jump (client suppresses off-jump collects; the server enforces it). Air food
  is worth `AIR_POINTS_MULT`× and **shares the `foodCap(players)` budget** (each
  spawn rolls `AIR_SPAWN_SHARE` ~⅓ airborne, with an `AIR_PITY_MS` fallback). **Dash**
  = a functional forward lunge (`dashFrom→dashTo`, clamped, propagates over the
  normal position channel). **Hand = the paw-slap:** Koala raises a white front
  arm and chops it down (`slapPhase` in `client/src/game/slap.ts` drives the
  wind-up → fast strike → hold; the front leg is hidden mid-swing so she isn't
  five-legged). Locally it targets the nearest object within `SLAP_REACH`
  (distance to the object's **box**, so big objects like the pond are reachable at
  an edge): a **ball** is knocked directly away from the cat
  (`updateSlappables` integrates velocity + friction + edge bounce), the **pond**
  splashes, a **radio** cycles its music (play A → off → play B → off), and everything else does a brief
  `slapShake` wobble + spark burst (`drawEffects`); pond/house don't wobble. **Balls
  are server-synced** (see Multiplayer → Balls); the other object reactions are
  still client-local (peers only see the swipe pose). **Bite** = a cosmetic emote (`drawEmote`); **meow** is the same emote but
  fired by **tapping Koala**, not a dock button (cosmetic, `ABILITY_COOLDOWNS_MS.
meow = 0`, off the GCD). **Global cooldown** (`GLOBAL_COOLDOWN_MS`,
  `isOnGlobalCooldown`): firing any GCD ability briefly blocks the other GCD
  abilities so you can't fire two at once; **jump and meow are off the GCD**, and
  movement is never gated (run and cast). It's a client-side input gate; the
  server keeps its own per-ability enforcement.
- **On-screen controls** (`controlsStore`) — **always shown** (this is the default;
  there's no toggle): a fixed, discreet golden **joystick** (mobile only,
  bottom-left) that writes an analog move vector the loop reads each frame, and an
  **ability dock** (bottom-right, desktop too) — a big Jump in the corner + the
  main abilities (dash/bite/hand) fanned in an even arc around it (`arcDeg`
  spreads them symmetric about the 135° diagonal, so the gaps stay proportional
  however many there are), each with cooldown sweeps. The
  controls are `<button>` overlay zones in Home's `pointer-events-none` layer, so
  only they capture touch — the canvas never steers by touch, so an empty-area
  swipe still scrolls the page (the site stays scrollable).
- **Presence + stats:** the connection exposes a live roster (`onPresence` → self
  - remotes) and the world's durable stats (`onStats` → active-24h, total sessions
    ever, this session's visit count). Both are fed into `parkStore` and shown inside
    the **Settings menu** (in the bottom control bar) — there's no on-canvas badge.
    "Online" is derived client-side from the roster; the server broadcasts a `stats`
    message when a brand-new session joins so open menus refresh.
- **Economy (server-owned):** the connection also holds the server's `food` +
  `placed` maps and the `likes` wallet. The loop renders server food and, on
  proximity, `sendCollect(id)`s (with a short retry so a momentarily-stale server
  position can't block a pickup); the shop `sendBuy(key,x,y)`s. Coins/placed are
  fed into `parkStore` via `onWallet`/`onPlaced` so the HUD + shop read one store.
  See the Shop section above and [decisions.md](./decisions.md) #14/#15.
- **Balls (server-synced, no game tick):** every ball is a server-owned
  `PlacedItem` (unified — no more client-only base balls, no `placedAt == null`
  special case). The two defaults are **seeded server-side** as permanent items
  with stable ids (`DEFAULT_BALLS`), `INSERT OR IGNORE`d in the DO constructor so
  seeding is idempotent across wakes and a rolled ball is never reset. **Motion is
  seed-and-simulate:** the koala that slaps a ball owns the roll and runs
  `updateSlappables` locally, sending **one** `push{id,x,y,vx,vy}` (the launch
  vector). The server relays it as `pushed` to peers (sender excluded), who run the
  **same integrator** — so every client renders the roll at 60 fps with no position
  stream (respects `MAX_INBOUND_MSGS_PER_SEC`). When the ball settles the owner
  sends **one** `rest{id,x,y}`; the server rounds to a tile (the `x/y` columns are
  INTEGER — no migration), writes SQLite **once**, and broadcasts the authoritative
  `moved` to everyone (incl. the slapper, whose fractional position snaps to the
  stored tile). Velocity is transient — never persisted, never routed through
  `parkStore` (which would re-render the shop UI); it's applied straight onto the
  in-flight `GameObject`. `ParkGame` shields an in-flight ball from the store's
  wholesale objects rebuild via `ballRolling`/`ballOwned` (see `rebuildObjects`).
  No server tick is added: `push`/`rest` are pure relays like `state`/`acted`, so
  the DO still hibernates. **Solo** (no backend) seeds the two balls locally and
  rolls them purely client-side, exactly as before. Balls are **non-solid** and
  never block a purchase (`overlapsPlaced` skips them).

The camera transform (`parkCamera.ts`, CSS transform on the `<canvas>`) is
camera-agnostic for remotes — they're drawn in world space and pan with everyone
else. Tests: `src/multiplayer/connection.test.ts` (client) and
`server/test/world.test.ts` (the Durable Object, in real `workerd`).
