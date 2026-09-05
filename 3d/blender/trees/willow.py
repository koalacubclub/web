"""Weeping willow — the cascade IS the tree.

Ports `client/src/game/trees/willow.ts`:

  form 0 — great dome: wider than tall, hem almost on the grass.
  form 1 — young:      narrower, crown held higher, far more trunk showing.

In 2D the cascade is a filled curtain with a scalloped hem and a cave left in
the middle so the trunk shows through. In 3D the equivalent is a crown dome with
strands raked down around it — tapered tubes, the same technique as the koala's
tail, arranged in a ring with a gap left at the front so the trunk still reads.

Run from the package root:
    blender --background --python blender/trees/willow.py
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lib  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as tc  # noqa: E402

TONES = {"trunk": "#7A5A12", "dark": "#548F4E", "mid": "#6FAB5C", "light": "#97C877"}


def build(form):
    lib.reset_scene()
    col = lib.collection(f"tree_willow_{form}")
    rand = tc.rng(0x3111 + form)

    bark = lib.clay("willow.trunk", TONES["trunk"], rough=0.74)
    dark = lib.clay("willow.dark", TONES["dark"], rough=0.68)
    mid = lib.clay("willow.mid", TONES["mid"], rough=0.66)
    light = lib.clay("willow.light", TONES["light"], rough=0.64)

    dome = form == 0
    trunk_h = 0.86 if dome else 1.24
    crown_z = trunk_h + (0.40 if dome else 0.34)
    radius = 1.16 if dome else 0.82
    height = 0.52 if dome else 0.48
    # how far the strands fall — the great dome's hem nearly reaches the grass
    fall = crown_z - (0.14 if dome else 0.56)
    strands = 26 if dome else 20

    lib.add(col, tc.trunk(trunk_h, 0.100, 0.064), bark).name = "trunk"

    def tone(obj, mat):
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for p in obj.data.polygons:
            p.use_smooth = True
        return obj

    parts = []

    # the crown dome the strands hang from
    for p in tc.blob_crown(rand, (0, 0, crown_z), radius * 0.86, height, count=6):
        parts.append(tone(p, dark))

    # strands raked down around the crown. A gap is left at the front (+X) so
    # the trunk shows through, the way the 2D leaves a cave in the hem.
    for i in range(strands):
        t = i / strands
        ang = t * math.tau
        # skip the front arc
        if abs(((ang + math.pi) % math.tau) - math.pi) < 0.55:
            continue
        reach = radius * (0.72 + rand() * 0.32)
        drop = fall * (0.70 + rand() * 0.38)
        top = crown_z + height * 0.10
        bottom = max(0.06, top - drop)
        x, y = math.cos(ang) * reach, math.sin(ang) * reach
        strand = tc.tube(
            f"strand_{i}",
            [(0.0, top, 0.052),
             (reach * 0.18, top - drop * 0.42, 0.040),
             (reach * 0.24, bottom, 0.020)],
            bevel_res=1, res_u=4,
        )
        strand.rotation_euler = (0, 0, ang)
        strand.location = (x * 0.72, y * 0.72, 0.0)
        parts.append(tone(strand, light if i % 3 == 0 else mid))

    crown = tc.merge(parts, "crown")
    for c in crown.users_collection:
        c.objects.unlink(crown)
    col.objects.link(crown)
    crown.name = "crown"

    lib.seat_on_ground(col)
    return col


if __name__ == "__main__":
    for form in (0, 1):
        lib.export(build(form), f"trees/willow_{form}.glb", budget=6000)
