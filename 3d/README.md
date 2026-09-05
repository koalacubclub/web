# `@koala/3d` — the park's 3D assets

Everything three-dimensional lives here: the **Blender generator scripts** that
build each asset and the **`.glb` files** they produce. Self-contained on
purpose — this package is expected to grow into its own repo, so nothing in it
imports from `client/`, `server/` or `shared/`.

## Quick start

```bash
pnpm --filter @koala/3d build     # rebuild every .glb into dist/
pnpm --filter @koala/3d check     # rebuild + fail if dist/ drifted from the scripts
```

Requires **Blender 5.x** on `PATH` (`brew install --cask blender`).

## The two rules

**1. The Python script is the source of truth. The `.glb` is a build artifact.**

Each asset is a script under `blender/<group>/<name>.py` that builds itself from
an empty scene. "Make the tail 20% wider" is a one-line diff you can review,
not a binary blob you have to open Blender to inspect. It also means per-asset
variance (five tree species, a per-tree seed) is a loop rather than N hand-made
meshes — the same trick `client/src/game/trees/` already plays in 2D.

The trade-off is a ceiling on organic sculpting. If an asset outgrows scripting
— the koala's rig is the likely first — that's a real signal to reach for a
`.blend`, not a reason to fight the script.

**2. `dist/` is committed, even though it's generated.**

Building it in CI would mean installing Blender on every runner: a ~400 MB
download and a GUI app driven headlessly, for assets that change rarely. That's
the same trade the site already made when it
[chose a `<noscript>` mirror over SSR](../docs/decisions.md#1-client-rendered-spa--build-time-noscript-for-crawlers-not-ssr)
rather than put a headless browser in the build.

`pnpm check` rebuilds and fails on any diff, so a stale `dist/` can't drift
silently past review.

## House style — "claymorphic"

Chunky rounded forms, smooth-shaded, saturated flat colour, low specular.
Deliberately **not realistic**.

Two things that sound like one and aren't:

- **Form language** — rounded vs. faceted. A property of the geometry. This is
  fixed across every asset; it's what makes the park look like one place.
- **Surface treatment** — flat colour vs. material richness vs. painted texture
  maps. A property of the shading. This is a **per-asset dial.**

The eight foods stay flat colour: they render at roughly 48 px, where texture
detail is invisible payload. Assets where the material _is_ the point earn more
— pond water wants a real animated shader, the fairy-light tree wants emission,
the boombox wants some sheen. Prefer a shader to a texture map where you can;
it costs no image payload and no UV unwrapping.

### No subsurf

Smooth vertex normals give the rounded look on their own at the size these
render. Subdividing the fish took it from **800 to 20,080 triangles** and its
`.glb` from **30 KB to 495 KB** — for no visible difference in-game. Every
`export()` takes a triangle `budget` and hard-fails past it; lower the primitive
resolution rather than raising the budget.

## Conventions

| Convention  | Value                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| **Unit**    | 1 Blender unit = **1 game tile** — the unit `shared/protocol.ts` speaks |
| **Origin**  | base centre — mesh sits on `z=0`, centred on x/y                        |
| **Up axis** | exported **+Y up** (glTF convention; Blender's Z-up is converted)       |
| **Format**  | `.glb`, materials embedded, modifiers applied                           |

Origin-at-base-centre means a mesh drops onto the ground plane with no per-asset
offset, and the tile-based domain layer (positions, collisions, the wire
protocol) needs no changes at all to render in 3D.

## Layout

```
blender/
  lib.py              srgb/clay/reset_scene/seat_on_ground/export
  build.py            runs every generator in one Blender process
  food/fish.py        one script per asset
dist/
  food/fish.glb       generated, committed
```

Adding an asset: drop a `<group>/<name>.py` next to the others that defines
`build()` and calls `lib.export(...)` under `if __name__ == "__main__"`.
`build.py` discovers it automatically.

## Status

| Group       | Done | Total | Notes                                                                                  |
| ----------- | ---- | ----- | -------------------------------------------------------------------------------------- |
| Food        | 1    | 8     | fish ✅ — treat, cheese, drumstick, shrimp, tin, sushi, goldfish                       |
| Trees       | 0    | 5     | broadleaf, crabapple, maple, pine, willow; needs per-tree variance                     |
| Shop / park | 0    | 11    | flowers, mushroom, stone, ball, snowcat, cardbox, bench, pond, lighttree, house, radio |
| Character   | 0    | 1     | koala — 3 poses + walk cycle; the hard one                                             |
| Scene       | 0    | —     | ground, social signs, photo frames, moon/stars                                         |

Nothing consumes these yet — the game still renders in canvas 2D
([`docs/game.md`](../docs/game.md)). These are being built ahead of the
renderer.
