"""The park's own tree — a lobed canopy over a trunk that flares at the root.

Ports `client/src/game/trees/broadleaf.ts`:

  form 0 — upright:   canopy carried high on a long trunk.
  form 1 — spreading: wider than tall, on a short trunk.

The canopy is a cluster of overlapping lobes rather than one smooth dome, for
the same reason the 2D builds it from `disc()` calls: a single ellipsoid reads
as a lollipop, and it's the broken rim that makes it a tree.

Run from the package root:
    blender --background --python blender/trees/broadleaf.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lib  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as tc  # noqa: E402

TONES = {"trunk": "#8B6914", "deep": "#2E7D3F", "dark": "#3D9C4E", "light": "#66BB6A"}


def build(form):
    lib.reset_scene()
    col = lib.collection(f"tree_broadleaf_{form}")
    rand = tc.rng(0xB1EA + form)

    bark = lib.clay("broadleaf.trunk", TONES["trunk"], rough=0.74)
    deep = lib.clay("broadleaf.deep", TONES["deep"], rough=0.68)
    dark = lib.clay("broadleaf.dark", TONES["dark"], rough=0.66)
    light = lib.clay("broadleaf.light", TONES["light"], rough=0.64)

    upright = form == 0
    trunk_h = 1.16 if upright else 0.62
    crown_z = trunk_h + (0.62 if upright else 0.54)
    radius = 0.86 if upright else 1.12
    height = 0.94 if upright else 0.74

    lib.add(col, tc.trunk(trunk_h, 0.105, 0.072, lean=0.04 if upright else -0.05),
            bark).name = "trunk"

    def tone(obj, mat):
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        for p in obj.data.polygons:
            p.use_smooth = True
        return obj

    parts = tc.blob_crown(rand, (0, 0, crown_z), radius, height,
                          count=7 if upright else 9)
    # Shade by height: the deep green pools underneath, the light green catches
    # the top. Assigned before the join so the merged crown keeps all slots.
    for p in parts:
        rel = (p.location.z - crown_z) / max(height, 1e-6)
        tone(p, light if rel > 0.22 else (dark if rel > -0.24 else deep))

    crown = tc.merge(parts, "crown")
    for c in crown.users_collection:
        c.objects.unlink(crown)
    col.objects.link(crown)
    crown.name = "crown"

    lib.seat_on_ground(col)
    return col


if __name__ == "__main__":
    for form in (0, 1):
        lib.export(build(form), f"trees/broadleaf_{form}.glb", budget=3000)
