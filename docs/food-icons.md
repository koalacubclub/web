# Koala's Park — Food Collectibles Icon Spec

Authoritative art spec for the collectible food icons in the `ParkGame` mini-game
(`src/components/ParkGame.tsx`). Hand this to whoever generates the icons.

## 1) TL;DR

Deliver **8 flat-cartoon "sticker" food icons** as **256×256 px RGBA PNGs** with
transparent backgrounds, one per collectible, dropped at
`public/game/food/<key>.png` using the exact keys `treat, fish, cheese,
drumstick, shrimp, tin, sushi, goldfish`. Each is a single centered subject
filling **~78% of the frame (~200 px on its longest axis) with a ~28 px
transparent margin on all sides**, in a cozy Neko-Atsume-like house style: solid
flat fills, 2–3 tone cel shading, one uniform charcoal `#4A4A4A` outline, light
from the top-left. Author colors TRUE/final (no pre-tinting) and bake **no**
background, glow, halo, drop/ground shadow, plate, border, or sparkle — the game
engine adds glow, ground shadow, bob, pop-in, and twinkle procedurally.

## 2) Global technical contract

| Property           | Requirement                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files              | Exactly 8 PNGs, one per food. No sprite sheet, atlas, subfolders, or variants.                                                                                   |
| Path               | `public/game/food/<key>.png`                                                                                                                                     |
| Keys/filenames     | `treat, fish, cheese, drumstick, shrimp, tin, sushi, goldfish` — lowercase, exact, `.png`. Do NOT rename/pluralize/capitalize/suffix (`fish_v2.png` won't load). |
| Format             | PNG, 32-bit RGBA, 8-bit/channel, straight (non-premultiplied) alpha. Not indexed, not 16-bit, not webp/jpg/svg, no `@2x`.                                        |
| Dimensions         | Exactly 256×256 px, square.                                                                                                                                      |
| Color space        | sRGB.                                                                                                                                                            |
| Subject size       | Single centered subject, longest axis 200 px ± 8 (~78% of frame).                                                                                                |
| Margin / safe area | ≥28 px fully transparent on all four sides; outline/sparkle count as subject and stay inside the 200 px box.                                                     |
| Center of mass     | Balanced near (128,128) — the engine centers the image, not the visual mass.                                                                                     |
| Transparency       | Fully transparent background; transparent pixels RGBA (0,0,0,0).                                                                                                 |
| No baked FX        | No background, border, drop-shadow, glow, halo, ground shadow, plate/dish, vignette, or baked sparkle (goldfish star glints are the sole exception).             |
| Colors             | Author TRUE/final at full saturation; do NOT pre-darken/tint for the purple night wash (it multiplies under collectibles).                                       |

**Why 256 + margin:** the sprite is drawn at ~43 px (`PIXEL*0.9` on a 48 px tile),
downscaled from 256 by the browser, then the whole canvas is CSS-upscaled ~1.4×–3×
with `image-rendering: pixelated`. Author at 256 with clean anti-aliasing for crisp
downsamples; the 28 px margin is headroom for the bob + pop-in overshoot + outline.

**Edges:** author crisp and anti-aliased (a sticker, NOT hand-aliased pixel-art).
Apply defringe / alpha-bleed so edge RGB carries the subject color outward — a
white fringe on the purple wash is the #1 failure mode. Minimum feature ≥ ~5–6 px
at 256. No dithering, noise, gradients, or banding.

**QA checklist (per file, then compare all 8):** correct path+key; 256×256 RGBA
sRGB non-premultiplied; corner pixels (0,0,0,0); no baked shadow/glow/plate/border;
subject longest axis 200 px ±8 with ≥28 px margin; center of mass ~(128,128);
smooth AA edges, no white fringe (check on dark purple), outermost outline `#4A4A4A`
not pure black; uniform outline weight across the set; light top-left everywhere;
2–3 cel tones only; matching apparent visual weight (shrimp ≈ tin ≈ fish, treat not
tiny); true cheerful colors; in-engine smoke test (pops/bobs without clipping,
engine FX present, goldfish reads premium vs plain fish).

## 3) Global style guide

Each food is a **die-cut vinyl sticker** — a single flat cartoon subject in one
continuous outline on pure transparency. Cozy, wholesome, Neko-Atsume-like. NOT
realistic, gradient-heavy, glossy 3D, or retro 8-bit.

- **Outline:** one consistent charcoal `#4A4A4A` (never pure black), uniform weight
  ~5–6 px at 256 on the silhouette; interior lines ~3–4 px. Round every corner/terminal.
- **Shading:** flat base + 2–3 tone cel shading (shadow ~12–18% darker, optional
  highlight ~12–15% lighter). Hard cel steps, no gradients. Optional single near-white
  micro-highlight dot on the glossiest curve of shiny items.
- **Light:** top-left on every item — highlights upper-left, one clean cel shadow
  hugging the lower-right of the outline.
- **Finish/saturation:** matte flat sticker; medium-high appetizing saturation (a
  notch juicier than the muted grass/dirt tiles), never neon. Plump forms; thicken
  spindly parts so they survive at ~43 px.
- **Palette anchors (sRGB):** grass `#A8D5A2`/`#7CB87A`; dirt/sand `#D4A574`/`#E8D5A8`;
  gold `#FFD93D`; pink `#FF6B9D`; lilac `#C9B1FF`; water/fish-blue `#64B5F6`; cat browns
  `#C4A882`/`#A07850`/`#8B5E3C`; outline `#4A4A4A`; brand deep gold `#D4A94F`.

## 4) Per-item table

| Key       | File            | Subject                          | Palette (base / shadow / highlight + accents)                                                               | Silhouette notes                                                                                                                                                                   | Pts / tier     |
| --------- | --------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| treat     | `treat.png`     | Cat biscuit, paw-print shaped    | `#E0A867` / `#C4894A` / `#F2C88A`; indents darker                                                           | Plump paw: 1 big pad + 4 fat toe beans in an arc; cookie-thick. ~180².                                                                                                             | 5 / common     |
| fish      | `fish.png`      | Whole fish, side view, head left | body `#9FD0E8` / `#6FA8C9` / belly `#EAF6FC`; fins `#64B5F6`→`#4A90C2`; eye white+charcoal; cheek `#FF6B9D` | Deep-forked tail right, 1 dorsal + 1 belly fin, bold round eye, gentle curve, pale belly. ~200×100.                                                                                | 10 / common    |
| cheese    | `cheese.png`    | Wedge with holes                 | `#FFD256` / `#E3A93A` / `#FFE79A`; holes `#E3A93A` w/ darker rim                                            | Fat rounded right-triangle; 2–3 round holes on the front face; top highlighted, right shadowed. ~200×150.                                                                          | 15 / uncommon  |
| drumstick | `drumstick.png` | Chicken drumstick                | meat `#D9A15C` / `#B47637` / `#EEC489`; bone `#FFF3DC` / `#E4D2B4`                                          | Big meat lobe lower-left + white bone knob upper-right (exaggerated), ~30–45° diagonal. ~200 diag.                                                                                 | 15 / uncommon  |
| shrimp    | `shrimp.png`    | Cooked prawn, curled             | `#FF8A5B` / `#E56636` / `#FFB48A`; tail tip `#FF7A7A`                                                       | Bold open C-curl, 4–5 segment bands, forked tail fan, micro-highlight on back. ~190².                                                                                              | 20 / uncommon  |
| tin       | `tin.png`       | Opened cat-food tin              | metal `#C9CDD2` / `#9AA0A6` / `#EDEFF1`; pâté `#B5763F`+`#8B5E3C`; label `#FF6B9D` + `#FFD93D` heart        | Squat opened cylinder, lid peeled back behind, pâté mound on top, pink label band w/ gold heart. No text. ~195×150.                                                                | 25 / rare      |
| sushi     | `sushi.png`     | Salmon nigiri                    | rice `#FBF7EF` / `#E4DCC9` / `#FFFFFF`; salmon `#FF9264` / `#E86B3E` + `#FFD9C2` stripes; nori `#3A5A40`    | Rice pillow + thick salmon slab draped over, 2–3 pale stripes, optional single nori strap. ~200×130.                                                                               | 30 / rare      |
| goldfish  | `goldfish.png`  | Shiny GOLDEN fish (jackpot)      | `#FFD93D` / `#E0A82E` / `#FFF1A8`; core `#F5B800`; fins `#F0B429`; gilded rim `#B8860B`; glints `#FFFDF0`   | Same silhouette as `fish` but plumper/regal; premium via 3–4 tone gold + gilded inner rim on shadow side + 2–3 tiny 4-point white star glints. NO glow (engine adds it). ~200×110. | 50 / legendary |

Apparent-weight rule: target roughly equal filled area (~45–60% of the 200² box)
so shrimp ≈ tin ≈ fish and the treat never reads tiny.

## 5) Generation prompts

Generate `fish` first as the anchor; lock its seed/style and reference it for the
other 7 (goldfish = "the fish, but gold"). Batch all 8 with identical settings, 1:1,
transparent background. If the model can't emit alpha, render on flat lime `#00FF00`
and key it out, then defringe.

**Shared preamble (prefix every prompt):**

```
Flat cute cartoon sticker illustration, cozy wholesome Neko-Atsume style. Single centered subject, one object only. Solid flat color fills with gentle 2-to-3-tone cel shading (one soft shadow tone + one light tone), no gradients, no glossy sheen, no photorealism, no 3D render. Bold clean consistent dark charcoal outline (#4A4A4A) of even medium weight all the way around, rounded corners and terminals. Soft rounded friendly plump forms. Light from top-left: highlights upper-left, soft cel shadow lower-right. Die-cut sticker finish, matte. Fully TRANSPARENT background (alpha), no background fill, no scene, no plate, no table, no border, no drop shadow, no glow, no halo. Colors bright, appetizing, true. Object fills ~78% of a 1:1 square frame, generously centered with even margin on all sides. Crisp anti-aliased edges. No text, no watermark, no logo.
```

**Shared negative prompt:**

```
background, scene, backdrop, table, plate, bowl, tray, floor, surface, ground, wall, gradient background, colored background, white background, checkerboard, drop shadow, cast shadow, ground shadow, glow, halo, bloom, light rays, lens flare, baked sparkles, reflection, glossy, wet look, 3D render, realistic, photograph, photo, texture noise, film grain, bevel, emboss, border, frame, outline halo, white fringe, multiple objects, duplicate, collage, grid, extra items, hands, fingers, cutlery, fork, knife, chopsticks, text, letters, numbers, caption, watermark, signature, logo, blurry, low-res, jpeg artifacts, messy sketchy lines, thin inconsistent outline, cropped, off-center, clipped edges, pixel-art, dithering.
```

**Per item (append to preamble):**

- **treat** — A single cat kibble treat shaped like a rounded paw print — one large rounded main pad plus four small fat toe beans in an arc above, well separated. Chunky, cookie-thick. Warm tan: base #E0A867, cel shadow #C4894A lower-right, cream highlight #F2C88A upper-left; paw indents slightly darker.
- **fish** — A single whole fresh fish, clean side view, head facing left, gently banana-curved. Silver-blue: base #9FD0E8, shadow #6FA8C9 lower-right, pale belly #EAF6FC; rounded fins #64B5F6 / #4A90C2; one bold round eye (white + charcoal pupil); tiny pink cheek dot #FF6B9D; deep-forked triangular tail right. Plump, not spiky.
- **cheese** — A single wedge of cheese, fat rounded right-triangle, three-quarter view. Cheddar: base #FFD256, shadow #E3A93A on right face, highlight #FFE79A on top; 2–3 round holes of varying size on the front face with slightly darker rims.
- **drumstick** — A single roasted chicken drumstick on a slight diagonal: big rounded meaty lobe lower-left, clean white bone knob poking upper-right (exaggerate bone). Meat #D9A15C / shadow #B47637 / highlight #EEC489; bone #FFF3DC / #E4D2B4. Matte, not glossy.
- **shrimp** — A single cooked prawn curled into a bold open C, side view. Orange: base #FF8A5B, shadow #E56636, highlight #FFB48A; 4–5 plump segment bands with thin charcoal lines; forked fanned tail with coral #FF7A7A tip; small near-white highlight on the outer back curve.
- **tin** — A single opened tin of cat food, squat short cylinder, slight 3/4 top view, round lid peeled back and curled up behind. Metal #C9CDD2 / #9AA0A6 / #EDEFF1; lid #E3E6E9; chunky pâté #B5763F w/ #8B5E3C flecks in the open top; pink label band #FF6B9D with a small gold #FFD93D heart. No text. Short, not a tall soda can.
- **sushi** — A single salmon nigiri, 3/4 side view: rounded pillow of white rice, one thick salmon slice draped over, overhanging slightly at front. Rice #FBF7EF / #E4DCC9 / #FFFFFF; salmon #FF9264 / #E86B3E with 2–3 pale #FFD9C2 fatty stripes; optional single dark green #3A5A40 nori strap across center.
- **goldfish** — A single legendary GOLDEN fish, exact same cute plump side-view fish shape (head left, deep-forked tail, round eye) but shiny premium solid gold, slightly plumper/regal, fins a touch more flared. Rich metallic gold: base #FFD93D, deep shadow #E0A82E, bright highlight #FFF1A8, molten-amber core #F5B800, fins #F0B429; a gilded gold-brown rim #B8860B just inside the charcoal outline on the shadow side; jewel eye (white + charcoal); 2–3 tiny crisp 4-point white star glints #FFFDF0 on the upper-left body curve and tail. Opulent via cel shading + gilded edge only — NO glow/bloom/halo (engine adds those).

## 6) Delivery & drop-in

Export each as 256×256 RGBA PNG (sRGB, straight alpha, defringed, ~28 px margin),
name it with its exact key, and drop the 8 files into `public/game/food/`. That's
it — the code indexes them by key and draws the glow, ground shadow, bob, pop-in,
and twinkle procedurally. No config, manifest, or code changes needed. Until the
PNGs exist, each food falls back to its emoji so the game already works.
