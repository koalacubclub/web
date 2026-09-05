"""Crabapple — masses of pink-and-white blossom with leaf green breaking through.

Ports `client/src/game/trees/crabapple.ts`:

  form 0 — upright:   crown held high on a clear trunk, three branches.
  form 1 — spreading: low and wide, five branches showing.

Layer order matters and is the same as the 2D: green underneath, blossom over
it, then a few leaf clumps back on top so the tree doesn't turn into a pink
cloud. A couple of last season's fruit hang in the crown.

Run from the package root:
    blender --background --python blender/trees/crabapple.py
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lib  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as tc  # noqa: E402

TONES = {
    "trunk": "#6E5424",
    "branch": "#5C4520",
    "leaf": "#5C9A4C",
    "leafLight": "#7CBE63",
    "blossom": "#F3BAD0",
    "bloomPale": "#FCEDF2",
    "fruit": "#CC3B35",
}


def build(form):
    lib.reset_scene()
    col = lib.collection(f"tree_crabapple_{form}")
    rand = tc.rng(0xC4AB + form)

    bark = lib.clay("crabapple.trunk", TONES["trunk"], rough=0.76)
    branch_m = lib.clay("crabapple.branch", TONES["branch"], rough=0.76)
    leaf = lib.clay("crabapple.leaf", TONES["leaf"], rough=0.68)
    leaf_light = lib.clay("crabapple.leafLight", TONES["leafLight"], rough=0.66)
    blossom = lib.clay("crabapple.blossom", TONES["blossom"], rough=0.62)
    pale = lib.clay("crabapple.bloomPale", TONES["bloomPale"], rough=0.60)
    fruit = lib.clay("crabapple.fruit", TONES["fruit"], rough=0.44)

    upright = form == 0
    branches = 3 if upright else 5
    trunk_h = 1.10 if upright else 0.66
    crown_z = trunk_h + (0.56 if upright else 0.46)
    radius = 0.80 if upright else 1.10
    height = 0.82 if upright else 0.64

    lib.add(col, tc.trunk(trunk_h, 0.096, 0.062), bark).name = "trunk"

    def tone(obj, mat):
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for p in obj.data.polygons:
            p.use_smooth = True
        return obj

    parts = []

    # open branches reaching out of the trunk into the crown
    for i in range(branches):
        ang = (i / branches) * math.tau + rand() * 0.7
        reach = radius * (0.52 + rand() * 0.30)
        limb = tc.tube(
            f"branch_{i}",
            [(0.0, trunk_h * 0.72, 0.050), (reach * 0.62, crown_z - height * 0.20, 0.028)],
            bevel_res=2, res_u=4,
        )
        limb.rotation_euler = (0, 0, ang)
        parts.append(tone(limb, branch_m))

    # Crabapple layers TWO crowns (green, then blossom over it), so it carries
    # roughly double the lobes of the other species — hence the coarser spheres.
    LOBE = dict(seg=10, ring=7)

    # green underneath...
    green = tc.blob_crown(rand, (0, 0, crown_z - height * 0.16), radius * 0.92,
                          height * 0.86, count=5 if upright else 7, **LOBE)
    for p in green:
        tone(p, leaf)
    parts += green

    # ...blossom over it...
    bloom = tc.blob_crown(rand, (0, 0, crown_z + height * 0.10), radius * 0.96,
                          height * 0.80, count=7 if upright else 9, **LOBE)
    for i, p in enumerate(bloom):
        tone(p, pale if i % 3 == 0 else blossom)
    parts += bloom

    # ...then a few leaf clumps back on top, so it isn't just a pink cloud
    for i in range(3 if upright else 4):
        ang = rand() * math.tau
        reach = radius * (0.40 + rand() * 0.44)
        lobe = radius * (0.20 + rand() * 0.12)
        parts.append(tone(
            tc.sphere((math.cos(ang) * reach, math.sin(ang) * reach,
                       crown_z + height * (0.16 + rand() * 0.30)),
                      (lobe, lobe, lobe * 0.86), 10, 7),
            leaf_light,
        ))

    # last season's fruit, hanging low in the crown
    for i in range(2 if upright else 3):
        ang = rand() * math.tau
        reach = radius * (0.52 + rand() * 0.30)
        parts.append(tone(
            tc.sphere((math.cos(ang) * reach, math.sin(ang) * reach,
                       crown_z - height * (0.34 + rand() * 0.20)),
                      (0.052, 0.052, 0.050), 8, 6),
            fruit,
        ))

    crown = tc.merge(parts, "crown")
    for c in crown.users_collection:
        c.objects.unlink(crown)
    col.objects.link(crown)
    crown.name = "crown"

    lib.seat_on_ground(col)
    return col


if __name__ == "__main__":
    for form in (0, 1):
        lib.export(build(form), f"trees/crabapple_{form}.glb", budget=4200)
