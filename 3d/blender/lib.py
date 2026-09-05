"""Shared helpers for the park's 3D asset generators.

Every asset is a Python script under `blender/` that builds itself from scratch
in Blender and exports a `.glb` into `dist/`. The script is the source of truth;
the `.glb` is a committed build artifact (see `../README.md` for why it's
committed rather than rebuilt in CI).

House style — the "claymorphic" look:
  * chunky rounded forms, smooth-shaded, no subsurf (smooth vertex normals are
    enough at the size these render, and subsurf costs ~20x the triangles)
  * saturated flat base colours, low specular, no texture maps by default
  * surface richness is a per-asset dial: water, fairy lights and the boombox
    earn a real shader, the eight foods do not

Conventions every asset must hold to:
  * 1 Blender unit == 1 game tile, the unit the game and the wire protocol
    already think in (`shared/protocol.ts`)
  * origin at the base centre: the mesh sits on z=0 and is centred on x/y, so it
    drops onto the ground plane without a per-asset offset
  * exported +Y up (the glTF convention), materials embedded, modifiers applied
"""

import json
import os

import bpy
from mathutils import Vector

# `lib.py` lives at <package>/blender/, so dist is one level up.
PACKAGE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DIST_DIR = os.path.join(PACKAGE_ROOT, "dist")

# Every export() appends its measurements here; build.py writes them out as
# dist/manifest.json. See write_manifest() for why that file exists.
MANIFEST = []


def srgb(hexstr):
    """`'#F0894C'` -> linear RGB, which is what Blender's colour inputs want.

    Colours are authored as hex so they can be pasted straight from the site's
    palette; skipping the conversion makes everything wash out pale.
    """
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def clay(name, hexcolor, rough=0.55, spec=0.18):
    """A flat, low-spec material — the default surface for claymorphic parts."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    rgb = srgb(hexcolor)
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    # Blender renamed this socket in 4.x; accept either name.
    for key in ("Specular IOR Level", "Specular"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = spec
            break
    mat.diffuse_color = (*rgb, 1.0)  # solid-shading / viewport colour
    return mat


def reset_scene():
    """Empty the file so a generator always builds from a known state."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.lights):
        for b in list(block):
            if b.users == 0:
                block.remove(b)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)


def collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def add(col, obj, material=None):
    """Move a freshly-created object into `col`, smooth it, give it a material."""
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)
    for p in obj.data.polygons:
        p.use_smooth = True
    if material is not None:
        obj.data.materials.clear()
        obj.data.materials.append(material)
    return obj


def _world_points(col):
    return [obj.matrix_world @ Vector(c) for obj in col.objects for c in obj.bound_box]


def seat_on_ground(col):
    """Drop the asset onto z=0 and centre it on x/y — the origin convention."""
    bpy.context.view_layer.update()
    pts = _world_points(col)
    minz = min(p[2] for p in pts)
    dx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2.0
    dy = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2.0
    for obj in col.objects:
        obj.location.z -= minz
        obj.location.x -= dx
        obj.location.y -= dy
    bpy.context.view_layer.update()


def tri_count(col):
    deps = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in col.objects:
        ev = obj.evaluated_get(deps)
        mesh = ev.to_mesh()
        total += sum(len(p.vertices) - 2 for p in mesh.polygons)
        ev.to_mesh_clear()
    return total


def export(col, relpath, budget=None):
    """Write `col` to `dist/<relpath>` as a .glb.

    `budget` is a triangle ceiling; exceeding it is a hard failure so a careless
    tweak can't quietly ship a 20k-triangle collectible. Lower the primitive
    resolution rather than raising the budget.
    """
    tris = tri_count(col)
    if budget is not None and tris > budget:
        raise SystemExit(
            f"{relpath}: {tris} triangles exceeds the {budget} budget. "
            "Lower the primitive resolution rather than raising the budget."
        )

    out = os.path.join(DIST_DIR, relpath)
    os.makedirs(os.path.dirname(out), exist_ok=True)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in col.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = col.objects[0]

    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )

    pts = _world_points(col)
    size = [
        round(max(p[i] for p in pts) - min(p[i] for p in pts), 3) for i in range(3)
    ]
    MANIFEST.append(
        {
            "asset": relpath,
            "tris": tris,
            "size_tiles": size,
            "nodes": sorted(o.name for o in col.objects),
        }
    )
    print(
        f"{relpath}: {tris} tris, {os.path.getsize(out) / 1024:.1f} KB, "
        f"{size[0]:.2f} x {size[1]:.2f} x {size[2]:.2f} tiles"
    )
    return out


def write_manifest():
    """Write dist/manifest.json — the reviewable record of what dist contains.

    The .glb bytes are NOT reproducible: Blender's glTF exporter shuffles vertex
    and index order between runs, so three builds of an unchanged asset give
    three different files with identical geometry (verified — the JSON chunk is
    byte-identical and only the index buffer permutes; PYTHONHASHSEED does not
    pin it). So `git diff` over the binaries can't answer "did anything actually
    change?".

    This manifest can. It records triangle count, bounding size and node names
    per asset — all stable across rebuilds, all things a careless edit would
    move — as sorted JSON that diffs cleanly in review. `pnpm check` compares
    THIS, not the binaries.

    Only build.py calls this, since only a full build knows the complete set.
    """
    out = os.path.join(DIST_DIR, "manifest.json")
    os.makedirs(DIST_DIR, exist_ok=True)
    payload = sorted(MANIFEST, key=lambda e: e["asset"])
    with open(out, "w") as fh:
        json.dump(payload, fh, indent=2, sort_keys=True)
        fh.write("\n")
    total = sum(e["tris"] for e in payload)
    print(f"\nmanifest: {len(payload)} assets, {total} tris total")
    return out
