"""Conifer — tapering tiers over a short bare trunk.

Ports `client/src/game/trees/pine.ts`:

  form 0 — spire: tall and narrow, six tight tiers.
  form 1 — full:  shorter and broader, four tiers with a wide skirt.

The 2D draws a solid cone first and lays the tiers over it as skirts, so a tall
tree can't come apart into floating triangles. The same trick applies here: a
continuous core cone carries the silhouette and the tiers are stacked over it.

Every tier gets its own reach off the seeded rng, so the tree is deliberately
lopsided — a conifer that mirrors itself down the middle reads as a cut-out.

Run from the package root:
    blender --background --python blender/trees/pine.py
"""

import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lib  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as tc  # noqa: E402

TONES = {"trunk": "#7A5A12", "dark": "#2F7C43", "light": "#46A15A"}


def build(form):
    lib.reset_scene()
    col = lib.collection(f"tree_pine_{form}")
    rand = tc.rng(0x50E + form)

    bark = lib.clay("pine.trunk", TONES["trunk"], rough=0.72)
    dark = lib.clay("pine.dark", TONES["dark"], rough=0.66)
    light = lib.clay("pine.light", TONES["light"], rough=0.66)

    spire = form == 0
    tiers = 6 if spire else 4
    trunk_h = 0.42 if spire else 0.58
    cone_h = 1.92 if spire else 1.44
    reach = 0.80 if spire else 1.04

    lib.add(col, tc.trunk(trunk_h, 0.085, 0.062), bark).name = "trunk"

    base_z = trunk_h * 0.85
    parts = []

    def tone(obj, mat):
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for p in obj.data.polygons:
            p.use_smooth = True
        return obj

    # Core cone: a continuous body so the tiers are shading on a silhouette
    # rather than a stack of separate skirts with gaps between them.
    parts.append(
        tone(tc.cone((0, 0, base_z + cone_h * 0.5), reach * 0.82, 0.012, cone_h, 16),
             dark)
    )

    for i in range(tiers):
        f = i / (tiers - 1)  # 0 = bottom skirt, 1 = apex
        taper = 1.0 - 0.72 * f
        # each tier leans its own way, so no two sides of the tree match
        wobble = 0.86 + rand() * 0.30
        r = reach * taper * wobble
        h = cone_h / tiers * 1.85
        z = base_z + cone_h * f * 0.82 + h * 0.30
        skirt = tc.cone((0, 0, z), r, r * 0.16, h, 16)
        skirt.location.x += (rand() - 0.5) * 0.06
        skirt.location.y += (rand() - 0.5) * 0.06
        # alternate the two greens, as the 2D tiers do
        parts.append(tone(skirt, light if i % 2 else dark))

    # Materials are assigned BEFORE the join so the merged crown keeps both
    # slots — `lib.add` would clear them, so link it by hand.
    crown = tc.merge(parts, "crown")
    for c in crown.users_collection:
        c.objects.unlink(crown)
    col.objects.link(crown)
    crown.name = "crown"

    lib.seat_on_ground(col)
    return col


if __name__ == "__main__":
    for form in (0, 1):
        lib.export(build(form), f"trees/pine_{form}.glb", budget=2600)
