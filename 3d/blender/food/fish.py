"""The `fish` collectible — a common, 10-point food (see `shared/protocol.ts`).

Run from the package root:
    blender --background --python blender/food/fish.py
"""

import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lib  # noqa: E402


def build():
    lib.reset_scene()
    col = lib.collection("food_fish")

    body_mat = lib.clay("fish.body", "#F0894C", rough=0.52)
    fin_mat = lib.clay("fish.fin", "#D9623A", rough=0.58)
    eye_mat = lib.clay("fish.eye", "#2B2018", rough=0.35)

    # --- Body: a low-res sphere squashed to an ellipsoid, then tapered so it's
    # plump at the head (+X) and narrow at the tail (-X). Smooth-shaded rather
    # than subdivided — at ~48px on screen the vertex normals do all the work.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1.0)
    body = bpy.context.active_object
    body.name = "fish_body"
    for v in body.data.vertices:
        x, y, z = v.co
        x *= 0.17
        y *= 0.095
        z *= 0.115
        t = max(0.0, min(1.0, (x + 0.17) / 0.34))  # 0 at tail, 1 at head
        taper = 0.30 + 0.70 * (t**0.55)
        # the small z nudge lifts the tail-end spine so she reads as swimming
        v.co = Vector((x, y * taper, z * taper + 0.012 * (1.0 - t)))
    body.data.update()
    lib.add(col, body, body_mat)

    # --- Tail: a cone fanning out behind the body, flattened sideways. radius1
    # is deliberately chunky so it merges into the body instead of pinching.
    bpy.ops.mesh.primitive_cone_add(
        vertices=14, radius1=0.045, radius2=0.095, depth=0.115,
        location=(-0.213, 0, 0.012),
    )
    tail = bpy.context.active_object
    tail.name = "fish_tail"
    tail.rotation_euler = (0, math.radians(-90), 0)
    tail.scale = (1.0, 0.30, 1.0)
    lib.add(col, tail, fin_mat)

    # --- Dorsal fin
    bpy.ops.mesh.primitive_cone_add(
        vertices=10, radius1=0.055, radius2=0.008, depth=0.07, location=(0.0, 0, 0.115),
    )
    dorsal = bpy.context.active_object
    dorsal.name = "fish_dorsal"
    dorsal.scale = (1.25, 0.28, 1.0)
    dorsal.rotation_euler = (0, math.radians(-14), 0)
    lib.add(col, dorsal, fin_mat)

    # --- Pectoral fins, one per side
    for i, sgn in enumerate((1, -1)):
        bpy.ops.mesh.primitive_cone_add(
            vertices=10, radius1=0.042, radius2=0.006, depth=0.055,
            location=(0.055, sgn * 0.055, 0.0),
        )
        fin = bpy.context.active_object
        fin.name = f"fish_pectoral_{i}"
        fin.rotation_euler = (math.radians(sgn * 62), 0, math.radians(sgn * -18))
        fin.scale = (1.0, 0.3, 1.0)
        lib.add(col, fin, fin_mat)

    # --- Eyes
    for i, sgn in enumerate((1, -1)):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=10, ring_count=6, radius=0.021,
            location=(0.125, sgn * 0.055, 0.045),
        )
        eye = bpy.context.active_object
        eye.name = f"fish_eye_{i}"
        eye.scale = (0.85, 0.7, 1.0)
        lib.add(col, eye, eye_mat)

    lib.seat_on_ground(col)
    return col


if __name__ == "__main__":
    lib.export(build(), "food/fish.glb", budget=900)
