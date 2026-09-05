"""Shared machinery for the five tree species.

Mirrors `client/src/game/trees/` — same five species, same two forms each, same
palettes. Read that folder first; the *why* behind the forms lives there.

## Variance survives the port

The 2D trees get their individuality from `variance.ts`: a tile-seeded PRNG rolls
a `jitter()` of width, height, lean and a spare `d`, applied at draw time. None
of that is baked into a mesh here, and none of it needs porting.

Each species exports **two meshes per form**, named `trunk` and `crown`, as
separate nodes in the .glb. The renderer applies the same `jitter()` at runtime:
scale `crown` by `(w, w, h)`, scale `trunk` by `trunkScale(j)`, offset both by
`lean`. So `variance.ts` keeps working unchanged, tile seeding still gives a
deterministic tree per tile, and a park of nine broadleafs is still nine
different broadleafs from two meshes rather than nine baked variants.

That split is the whole reason trunk and crown aren't joined — do not merge them.

## Footprint

A tree occupies 2x2 tiles and its trunk foot sits at z=0. Crowns overhang the
footprint, exactly as the 2D art already does.
"""

import math

import bpy


def rng(seed):
    """mulberry32 — the same PRNG as `makeRng` in client/src/game/constants.ts.

    Matching it isn't required (nothing has to line up across the two renderers)
    but it means a species' 3D silhouette can be tuned against the 2D one using
    the same seed and getting the same rolls.
    """
    a = seed & 0xFFFFFFFF

    def next_():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = (t ^ (t >> 15)) * (1 | t) & 0xFFFFFFFF
        t = (t + ((t ^ (t >> 7)) * (61 | t) & 0xFFFFFFFF)) & 0xFFFFFFFF ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return next_


def sphere(loc, scale, seg=14, ring=9):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=seg, ring_count=ring, radius=1.0, location=loc
    )
    obj = bpy.context.active_object
    obj.scale = scale
    return obj


def cone(loc, r1, r2, depth, seg=14):
    bpy.ops.mesh.primitive_cone_add(
        vertices=seg, radius1=r1, radius2=r2, depth=depth, location=loc
    )
    return bpy.context.active_object


def tube(name, points, bevel_res=3, res_u=6, caps=True):
    """A swept tube from (x, z, radius) control points, converted to mesh.

    Used for trunks (root flare -> taper) and for willow strands. Far cheaper
    and smoother than stacking primitives.
    """
    curve = bpy.data.curves.new(name + "_curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = res_u
    curve.bevel_depth = 1.0  # scaled by each control point's own radius
    curve.bevel_resolution = bevel_res
    curve.use_fill_caps = caps
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


def trunk(height, base_r, top_r, flare=1.55, lean=0.0):
    """A trunk with a root flare that tapers to the crown.

    The flare matters more than it sounds: a plain cylinder reads as a dowel
    pushed into the grass, while a foot that spreads slightly reads as grown.
    """
    return tube(
        "trunk",
        [
            (0.0, 0.0, base_r * flare),
            (lean * 0.15, height * 0.14, base_r),
            (lean * 0.55, height * 0.58, (base_r + top_r) * 0.5),
            (lean, height, top_r),
        ],
    )


def merge(objs, name):
    """Join parts into one object so a crown ships as a single node."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name
    return joined


def blob_crown(rand, centre, radius, height, count, squash=1.0, seg=12, ring=8):
    """A canopy as a cluster of overlapping spheres.

    The 2D canopies are built from `disc()` calls for the same reason: a single
    smooth ellipsoid reads as a lollipop, while overlapping lobes give the rim
    the broken outline a tree needs. Positions are jittered off `rand` so the
    cluster is lopsided — a canopy symmetric about its trunk looks stamped.
    """
    cx, cy, cz = centre
    parts = []
    # one big core lobe so the crown can never come apart into floating balls
    parts.append(sphere((cx, cy, cz),
                        (radius * 0.82, radius * 0.82 * squash, height * 0.80),
                        seg + 2, ring + 1))
    for i in range(count):
        ang = (i / count) * math.tau + rand() * 0.9
        reach = radius * (0.42 + rand() * 0.46)
        lobe = radius * (0.36 + rand() * 0.26)
        parts.append(
            sphere(
                (cx + math.cos(ang) * reach,
                 cy + math.sin(ang) * reach * squash,
                 cz + (rand() - 0.42) * height * 0.62),
                (lobe, lobe * squash, lobe * (0.80 + rand() * 0.34)),
                seg, ring,
            )
        )
    return parts
