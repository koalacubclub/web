"""Build every asset in one Blender process.

    blender --background --python blender/build.py

Each generator calls `lib.reset_scene()` first, so they can safely share one
process — which is much faster than launching Blender ~25 times.
"""

import os
import runpy
import sys

BLENDER_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BLENDER_DIR)

import lib  # noqa: E402


def generators():
    """Every `<group>/<asset>.py` under `blender/`, in a stable order."""
    for group in sorted(os.listdir(BLENDER_DIR)):
        group_dir = os.path.join(BLENDER_DIR, group)
        if not os.path.isdir(group_dir) or group.startswith(("_", ".")):
            continue
        for name in sorted(os.listdir(group_dir)):
            if name.endswith(".py") and not name.startswith("_"):
                yield os.path.join(group_dir, name)


if __name__ == "__main__":
    paths = list(generators())
    if not paths:
        raise SystemExit("no generators found under blender/")
    for path in paths:
        runpy.run_path(path, run_name="__main__")
    print(f"\nbuilt {len(paths)} generator(s)")
    lib.write_manifest()
