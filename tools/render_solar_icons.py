"""Render top-down solar icons (48×48 transparent PNGs) for the universe viewer.

Renders stations, gates, and other dockable/interactive objects from their
3D CMP/3DB models as top-down view icons.

Usage:
    python render_solar_icons.py <game_path> <mod_key>

Examples:
    python render_solar_icons.py "C:\FL-Installationen\HamburgCityFLMM" hamburg-city
    python render_solar_icons.py "C:\FL-Installationen\Freelancer Crossfire" crossfire
"""

from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import numpy as np
from PIL import Image

# FLAtlas loader
FLATLAS_ROOT = Path(__file__).resolve().parent.parent.parent / "FLAtlas"
sys.path.insert(0, str(FLATLAS_ROOT))
from fl_editor.cmp_loader import load_native_freelancer_model
from fl_editor.native_preview_geometry import decode_native_preview_geometries

# Shared INI parser (handles BINI)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_trade_data import parse_ini

SCRIPT_DIR = Path(__file__).resolve().parent

# Render settings
ICON_SIZE = 48
BASE_COLOR = np.array([0.55, 0.75, 0.88])
LIGHT_DIR = np.array([0.0, 1.0, 0.3])   # Mostly from above for top-down
LIGHT_DIR = LIGHT_DIR / np.linalg.norm(LIGHT_DIR)

# Skip archetypes that are planets/suns (rendered as circles in the viewer)
SKIP_PREFIXES = ("planet_", "sun_", "star_")


def parse_solararch(game_path: Path) -> dict[str, str]:
    """Return {nickname_lower: da_archetype_rel_path}."""
    solararch = game_path / "DATA" / "SOLAR" / "solararch.ini"
    if not solararch.exists():
        print(f"ERROR: {solararch} not found")
        return {}
    sections = parse_ini(solararch)
    result: dict[str, str] = {}
    for sec, entries in sections:
        if sec.lower() != "solar":
            continue
        vals = {k.lower(): v for k, v in entries}
        nick = vals.get("nickname", "").strip()
        da = vals.get("da_archetype", "").strip()
        if nick and da:
            result[nick.lower()] = da
    return result


def find_used_archetypes(game_path: Path) -> set[str]:
    """Find all unique archetypes used by stations, gates, holes in system files."""
    used: set[str] = set()
    systems_dir = game_path / "DATA" / "UNIVERSE" / "SYSTEMS"
    if not systems_dir.exists():
        return used

    for root, _dirs, files in os.walk(systems_dir):
        for f in files:
            if not f.lower().endswith(".ini"):
                continue
            path = Path(root) / f
            try:
                sections = parse_ini(path)
            except OSError:
                continue
            for sec, entries in sections:
                if sec.lower() != "object":
                    continue
                vals = {k.lower(): v.strip() for k, v in entries}
                arch = vals.get("archetype", "")
                if not arch:
                    continue
                al = arch.lower()
                has_base = "base" in vals
                has_goto = "goto" in vals
                if has_base or has_goto or "gate" in al or "hole" in al or "dock" in al:
                    used.add(al)
    return used


def render_icon(model_path: Path, out_path: Path) -> bool:
    """Render a single solar model to a small transparent PNG icon (top-down)."""
    try:
        mesh_data = load_native_freelancer_model(model_path)
        geometries = decode_native_preview_geometries(mesh_data)
    except Exception as e:
        print(f"    SKIP (load error): {e}")
        return False

    if not geometries:
        print("    SKIP (no geometry)")
        return False

    # Use highest-LOD per part only
    seen_parts: set[str] = set()
    use_geoms = []
    for g in geometries:
        key = g.part_name or "__main__"
        if key not in seen_parts:
            seen_parts.add(key)
            use_geoms.append(g)

    triangles = []
    for g in use_geoms:
        positions = g.positions
        indices = g.indices
        for i in range(0, len(indices) - 2, 3):
            i0, i1, i2 = indices[i], indices[i + 1], indices[i + 2]
            if i0 < len(positions) and i1 < len(positions) and i2 < len(positions):
                # Freelancer coords: X right, Y up, Z forward
                # For top-down: we view from above (Y axis), so map X→X, Z→Y
                p0 = (positions[i0][0], positions[i0][2], positions[i0][1])
                p1 = (positions[i1][0], positions[i1][2], positions[i1][1])
                p2 = (positions[i2][0], positions[i2][2], positions[i2][1])
                triangles.append([p0, p1, p2])

    if not triangles:
        print("    SKIP (no triangles)")
        return False

    triangles = np.array(triangles)

    # Face-normal shading
    v0, v1, v2 = triangles[:, 0], triangles[:, 1], triangles[:, 2]
    normals = np.cross(v1 - v0, v2 - v0)
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms[norms == 0] = 1
    normals = normals / norms
    intensity = np.abs(np.dot(normals, LIGHT_DIR))
    intensity = 0.3 + 0.7 * intensity
    colors = np.clip(np.outer(intensity, BASE_COLOR), 0, 1)

    # Render at higher internal resolution, then downscale
    internal_dpi = 100
    fig = plt.figure(figsize=(2, 2), dpi=internal_dpi)
    ax = fig.add_subplot(111, projection="3d")
    poly = Poly3DCollection(triangles, alpha=0.95)
    poly.set_facecolors(colors)
    poly.set_edgecolor("none")
    ax.add_collection3d(poly)

    all_pts = triangles.reshape(-1, 3)
    mn, mx = all_pts.min(axis=0), all_pts.max(axis=0)
    center = (mn + mx) / 2
    span = (mx - mn).max() / 2 * 1.15
    ax.set_xlim(center[0] - span, center[0] + span)
    ax.set_ylim(center[1] - span, center[1] + span)
    ax.set_zlim(center[2] - span, center[2] + span)
    # Top-down view
    ax.view_init(elev=90, azim=0)
    ax.set_axis_off()
    ax.set_facecolor((0, 0, 0, 0))
    fig.patch.set_alpha(0)
    ax.set_position([0, 0, 1, 1])

    plt.savefig(out_path, dpi=internal_dpi, transparent=True, pad_inches=0)
    plt.close(fig)

    # Auto-crop and resize to ICON_SIZE × ICON_SIZE
    img = Image.open(out_path).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:, :, 3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if not rows.any() or not cols.any():
        print("    SKIP (empty render)")
        return False
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    pad = 2
    rmin = max(0, rmin - pad)
    rmax = min(arr.shape[0] - 1, rmax + pad)
    cmin = max(0, cmin - pad)
    cmax = min(arr.shape[1] - 1, cmax + pad)
    cropped = img.crop((cmin, rmin, cmax + 1, rmax + 1))
    # Make square by padding the shorter side
    w, h = cropped.size
    size = max(w, h)
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    square.paste(cropped, ((size - w) // 2, (size - h) // 2))
    # Resize to target icon size
    icon = square.resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
    icon.save(out_path, optimize=True)
    return True


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    game_path = Path(sys.argv[1])
    mod_key = sys.argv[2]
    out_dir = SCRIPT_DIR.parent / "data" / "universe" / "icons" / mod_key

    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Find used archetypes
    print(f"Scanning system files for used archetypes...")
    used = find_used_archetypes(game_path)
    print(f"  Found {len(used)} unique archetypes")

    # 2. Load solararch mapping
    arch_models = parse_solararch(game_path)
    print(f"  {len(arch_models)} entries in solararch.ini")

    # 3. Filter: skip planets/suns, skip .sph files
    to_render: list[tuple[str, str]] = []
    for arch in sorted(used):
        if any(arch.startswith(p) for p in SKIP_PREFIXES):
            continue
        model_rel = arch_models.get(arch)
        if not model_rel:
            continue
        if model_rel.lower().endswith(".sph"):
            continue
        to_render.append((arch, model_rel))

    print(f"  {len(to_render)} archetypes to render (after filtering planets/suns)")
    t0 = time.time()
    ok = 0
    skip = 0

    for idx, (arch, model_rel) in enumerate(to_render, 1):
        out_path = out_dir / f"{arch}.png"
        if out_path.exists():
            print(f"  [{idx}/{len(to_render)}] {arch} — already exists")
            ok += 1
            continue

        model_path = game_path / "DATA" / model_rel.replace("\\", "/")
        if not model_path.exists():
            alt = game_path / model_rel.replace("\\", "/")
            if alt.exists():
                model_path = alt
            else:
                print(f"  [{idx}/{len(to_render)}] {arch} — model not found: {model_rel}")
                skip += 1
                continue

        print(f"  [{idx}/{len(to_render)}] {arch}...", end=" ", flush=True)
        if render_icon(model_path, out_path):
            ok += 1
            print("OK")
        else:
            skip += 1

    elapsed = time.time() - t0
    print(f"\nDone: {ok} rendered, {skip} skipped in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
