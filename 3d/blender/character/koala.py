"""Koala — the park's resident tabby cat, and the hero asset.

She is a *cat* named Koala, not a koala. Her palette is lifted verbatim from
`COLORS` in `client/src/game/constants.ts`.

Built as ONE continuous swept tube — nose, head bulge, neck pinch, barrel, rump
and tail are all a single bezier with a per-point radius. An earlier version
assembled her from separate spheres for body/head/legs and read as a bag of
balls; the reference clay cats this is modelled on get their charm from head and
body being one unbroken form, with the tail a tube growing out of the same
spine. Everything else is a small addition pressed into that form.

This is the **standing** pose only. `lying` / `sleeping` and the walk cycle want
an armature rather than three static meshes, so they aren't attempted here.

Her markings — the white bib and the tabby bars — are cut from the body's own
faces and lifted along their normals (`_surface_patch`), so they lie flat on her
the way painted clay does. Read that function's docstring before reaching for a
buried solid or a shrinkwrap; both were tried and both fail in specific,
non-obvious ways.

Run from the package root:
    blender --background --python blender/character/koala.py
"""

import math
import os
import sys

import bmesh
import bpy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lib  # noqa: E402

# She faces +X. Cats are narrower than they are deep, so the circular sweep is
# squashed sideways by this much.
WIDTH = 0.82

# (x, z, radius) along her spine. The head is a swelling in this profile, never
# a ball parked on top of it, and the neck is a gentle pinch rather than a waist.
SPINE = [
    (0.398, 0.372, 0.082),   # nose — first two share a z so the end cap sits
    (0.362, 0.374, 0.156),   # square to her face instead of curling to a spike
    (0.262, 0.376, 0.190),   # head, widest point
    (0.140, 0.332, 0.152),   # neck pinch
    (0.000, 0.298, 0.188),   # shoulders
    (-0.152, 0.284, 0.178),  # barrel
    (-0.288, 0.268, 0.118),  # rump
    (-0.368, 0.298, 0.052),  # tail root
    (-0.440, 0.470, 0.040),
    (-0.398, 0.664, 0.029),
    (-0.302, 0.748, 0.018),  # tip
]


def _sphere(loc, scale, seg=18, ring=11):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=seg, ring_count=ring, radius=1.0, location=loc
    )
    obj = bpy.context.active_object
    obj.scale = scale
    return obj


def _cone(loc, r1, r2, depth, seg=12):
    bpy.ops.mesh.primitive_cone_add(
        vertices=seg, radius1=r1, radius2=r2, depth=depth, location=loc
    )
    return bpy.context.active_object


def _tube(name, points, bevel_res=5, res_u=10):
    """A swept tube from (x, z, radius) control points, converted to mesh."""
    curve = bpy.data.curves.new(name + "_curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = res_u
    curve.bevel_depth = 1.0  # scaled by each control point's own radius
    curve.bevel_resolution = bevel_res
    curve.use_fill_caps = True
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, (x, z, radius) in zip(spline.bezier_points, points):
        bp.co = (x, 0.0, z)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
        bp.radius = radius
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return bpy.context.active_object


def _surface_patch(col, src, name, mat, keep, offset=0.006):
    """A marking cut from the body's OWN faces and lifted along their normals.

    This is how every marking on her is made. It cannot detach or collapse,
    because every vertex starts life on the surface — which the two obvious
    alternatives both fail at:

      * A solid buried in the body (an ellipsoid bib, a torus band) either pokes
        out as a lump or hides completely. There is no setting between "beard"
        and "invisible".
      * Shrinkwrap looks like the right tool and isn't. NEAREST_SURFACEPOINT
        from a patch inside the mesh collapses it to a sliver, and PROJECT
        leaves any vertex whose ray missed the body floating exactly where it
        started — which put a white plate in mid-air in front of her face.

    `keep(centre, normal)` selects faces in WORLD space; the result carries no
    transform of its own, so `seat_on_ground` still moves it with everything
    else.
    """
    deps = bpy.context.evaluated_depsgraph_get()
    ev = src.evaluated_get(deps)
    src_mesh = ev.to_mesh()

    bm = bmesh.new()
    bm.from_mesh(src_mesh)
    bm.transform(src.matrix_world)
    bm.normal_update()
    doomed = [
        f for f in bm.faces
        if not keep(f.calc_center_median(), f.normal.normalized())
    ]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal.normalized() * offset

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    ev.to_mesh_clear()

    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    mesh.materials.clear()
    mesh.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth = True
    return obj


def build():
    lib.reset_scene()
    col = lib.collection("koala")

    # Palette — COLORS in client/src/game/constants.ts. Authored BRIGHT: the 2D
    # park re-inks to night values by hand because a filter over one canvas made
    # every surface share a hue. In 3D that's the lighting rig's job.
    fur = lib.clay("cat.fur", "#C4A882")  # catLight
    orange = lib.clay("cat.orange", "#A07850")  # catOrange — ears, nose
    stripe = lib.clay("cat.stripe", "#6D4C2A")  # catStripe
    inner_ear = lib.clay("cat.ear", "#FFC9D9")  # catEar
    white = lib.clay("cat.white", "#FFFFFF")  # bib, paws
    eye = lib.clay("cat.eye", "#778128")  # the olive pupil drawCat gives her

    body = _tube("body", SPINE)
    body.scale = (1.0, WIDTH, 1.0)
    lib.add(col, body, fur)

    # --- tabby bars: three bands over the spine, on upward-facing faces only so
    # they stop at her flanks instead of hooping under her belly.
    bars = ((-0.020, 0.042), (-0.124, 0.040), (-0.226, 0.036))  # (centre x, half width)
    _surface_patch(
        col, body, "bands", stripe,
        lambda c, n: (n.z > 0.05 and c.z > 0.26
                      and any(abs(c.x - bx) < hw for bx, hw in bars)),
        offset=0.005,
    )

    # --- ears: small rounded-triangular tabs. Flattening them completely turned
    # them into brown spots, so they keep real height.
    for i, sgn in enumerate((1, -1)):
        ear = _cone((0.236, sgn * 0.106, 0.520), 0.062, 0.010, 0.085, 12)
        ear.rotation_euler = (math.radians(sgn * 34), math.radians(-18), 0)
        ear.scale = (1.0, 0.46, 1.0)
        lib.add(col, ear, orange).name = f"ear_{i}"

        inner = _cone((0.245, sgn * 0.101, 0.512), 0.038, 0.006, 0.060, 10)
        inner.rotation_euler = (math.radians(sgn * 34), math.radians(-18), 0)
        inner.scale = (1.0, 0.40, 1.0)
        lib.add(col, inner, inner_ear).name = f"ear_inner_{i}"

    # --- face: big round eyes, olive pupils, and the glint drawCat gives her
    for i, sgn in enumerate((1, -1)):
        lib.add(col, _sphere((0.345, sgn * 0.086, 0.415), (0.048, 0.048, 0.052), 16, 10),
                white).name = f"eye_{i}"
        lib.add(col, _sphere((0.374, sgn * 0.082, 0.414), (0.031, 0.031, 0.034), 14, 9),
                eye).name = f"pupil_{i}"
        lib.add(col, _sphere((0.388, sgn * 0.070, 0.430), (0.011,) * 3, 8, 6),
                white).name = f"glint_{i}"

    lib.add(col, _sphere((0.398, 0, 0.362), (0.026, 0.030, 0.019), 12, 8),
            orange).name = "nose"

    # --- bib: the white chest patch. Forward of the shoulders, below the eye
    # line, and only on faces that actually face forward or down so it doesn't
    # creep up the back of her skull.
    _surface_patch(
        col, body, "bib", white,
        lambda c, n: (0.130 < c.x < 0.395 and c.z < 0.292 and abs(c.y) < 0.150
                      and (n.x > 0.12 or n.z < -0.20)),
        offset=0.006,
    )

    # --- paws: small stubs sunk into the belly. The references barely have legs
    # — the body sits on the ground and the paws just peek out.
    for i, (px, sgn) in enumerate([(0.245, 1), (0.245, -1), (-0.185, 1), (-0.185, -1)]):
        lib.add(col, _sphere((px, sgn * 0.068, 0.135), (0.068, 0.052, 0.044), 12, 8),
                white).name = f"paw_{i}"

    lib.seat_on_ground(col)
    return col


if __name__ == "__main__":
    lib.export(build(), "character/koala.glb", budget=7000)
