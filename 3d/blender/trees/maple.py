"""Maple in autumn — deep red pooling at the rim, hotter orange and gold higher.

Ports `client/src/game/trees/maple.ts`:

  form 0 — tall oval:   noticeably taller than wide.
  form 1 — broad crown: shorter, spreading instead of climbing.

Same lobed-cluster canopy as the broadleaf, but the tone ramp is the whole point
here: five colours from `deep` at the underside up through `glow` at the crown,
which is what makes it read as autumn rather than a green tree painted orange.

Run from the package root:
    blender --background --python blender/trees/maple.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lib  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as tc  # noqa: E402

TONES = {
    "trunk": "#6B4E18",
    "deep": "#96331F",
    "dark": "#BE4726",
    "light": "#E0692C",
    "glow": "#EFA83A",
}


def build(form):
    lib.reset_scene()
    col = lib.collection(f"tree_maple_{form}")
    rand = tc.rng(0x3A91 + form)

    bark = lib.clay("maple.trunk", TONES["trunk"], rough=0.74)
    ramp = [
        lib.clay("maple.deep", TONES["deep"], rough=0.68),
        lib.clay("maple.dark", TONES["dark"], rough=0.66),
        lib.clay("maple.light", TONES["light"], rough=0.64),
        lib.clay("maple.glow", TONES["glow"], rough=0.60),
    ]

    tall = form == 0
    trunk_h = 1.02 if tall else 0.74
    crown_z = trunk_h + (0.76 if tall else 0.58)
    radius = 0.80 if tall else 1.08
    height = 1.06 if tall else 0.78

    lib.add(col, tc.trunk(trunk_h, 0.098, 0.066), bark).name = "trunk"

    parts = tc.blob_crown(rand, (0, 0, crown_z), radius, height,
                          count=8 if tall else 10)
    for p in parts:
        # -1 at the underside, +1 at the crown -> index into the autumn ramp
        rel = (p.location.z - crown_z) / max(height, 1e-6)
        idx = min(len(ramp) - 1, max(0, int((rel + 0.75) / 1.5 * len(ramp))))
        p.data.materials.clear()
        p.data.materials.append(ramp[idx])
        for poly in p.data.polygons:
            poly.use_smooth = True

    crown = tc.merge(parts, "crown")
    for c in crown.users_collection:
        c.objects.unlink(crown)
    col.objects.link(crown)
    crown.name = "crown"

    lib.seat_on_ground(col)
    return col


if __name__ == "__main__":
    for form in (0, 1):
        lib.export(build(form), f"trees/maple_{form}.glb", budget=3200)
