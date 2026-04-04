"""Batch-render ship images from Freelancer .cmp/.3db models.

Usage:
    python render_ships.py <game_path> <mod_key>

Examples:
    python render_ships.py "C:\FL-Installationen\HamburgCityFLMM" hamburg-city
    python render_ships.py "C:\FL-Installationen\Freelancer Crossfire" crossfire
"""

from __future__ import annotations

import json
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

BG_RGB = (15, 15, 26)
BG_F = tuple(c / 255 for c in BG_RGB)
BASE_COLOR = np.array([0.3, 0.55, 0.75])
LIGHT_DIR = np.array([0.4, 0.6, 0.8])
LIGHT_DIR = LIGHT_DIR / np.linalg.norm(LIGHT_DIR)


def parse_shiparch(game_path: Path) -> dict[str, str]:
    """Return {nickname_lower: da_archetype_rel_path}."""
    shiparch = game_path / "DATA" / "SHIPS" / "shiparch.ini"
    text = shiparch.read_text(encoding="latin1")
    # Split on any section header — [Ship] sections contain [Simple]/[CollisionGroup] sub-sections
    sections = re.split(r"(?=\[)", text)
    result: dict[str, str] = {}
    for sec in sections:
        if not sec.strip().lower().startswith("[ship]"):
            continue
        nick = ""
        da = ""
        for line in sec.split("\n"):
            kv = line.strip().split("=", 1)
            if len(kv) == 2:
                k = kv[0].strip().lower()
                if k == "nickname":
                    nick = kv[1].strip().lower()
                elif k == "da_archetype":
                    da = kv[1].strip()
        if nick and da:
            result[nick] = da
    return result


def render_ship(model_path: Path, out_path: Path) -> bool:
    """Render a single ship model to PNG. Returns True on success."""
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
                # Swap Y/Z for Freelancer coordinate system
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

    # Render
    fig = plt.figure(figsize=(8, 8), dpi=200)
    ax = fig.add_subplot(111, projection="3d")
    poly = Poly3DCollection(triangles, alpha=0.95)
    poly.set_facecolors(colors)
    poly.set_edgecolor("none")
    ax.add_collection3d(poly)

    all_pts = triangles.reshape(-1, 3)
    mn, mx = all_pts.min(axis=0), all_pts.max(axis=0)
    center = (mn + mx) / 2
    span = (mx - mn).max() / 2 * 1.05
    ax.set_xlim(center[0] - span, center[0] + span)
    ax.set_ylim(center[1] - span, center[1] + span)
    ax.set_zlim(center[2] - span, center[2] + span)
    ax.view_init(elev=25, azim=225)
    ax.set_axis_off()
    ax.set_facecolor(BG_F)
    fig.patch.set_facecolor(BG_F)
    ax.set_position([0, 0, 1, 1])

    plt.savefig(out_path, dpi=200, facecolor=BG_F, pad_inches=0)
    plt.close(fig)

    # Auto-crop
    img = Image.open(out_path)
    arr = np.array(img)
    bg_arr = np.array(BG_RGB)
    mask = np.any(np.abs(arr[:, :, :3].astype(int) - bg_arr) > 10, axis=2)
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    if not rows.any() or not cols.any():
        print("    SKIP (empty render)")
        return False
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    pad = 10
    rmin = max(0, rmin - pad)
    rmax = min(arr.shape[0] - 1, rmax + pad)
    cmin = max(0, cmin - pad)
    cmax = min(arr.shape[1] - 1, cmax + pad)
    cropped = img.crop((cmin, rmin, cmax + 1, rmax + 1))
    cropped.save(out_path, optimize=True)
    return True


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    game_path = Path(sys.argv[1])
    mod_key = sys.argv[2]
    json_path = Path(__file__).resolve().parent.parent / "data" / "trade-routes" / f"{mod_key}.json"
    out_dir = Path(__file__).resolve().parent.parent / "data" / "ships" / mod_key

    if not json_path.exists():
        print(f"ERROR: {json_path} not found")
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)

    # Load ship list from JSON
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    ship_nicks = [s["nick"] for s in data["ships"]]

    # Parse shiparch for model paths
    arch_map = parse_shiparch(game_path)

    print(f"Rendering {len(ship_nicks)} ships for [{mod_key}] -> {out_dir}")
    t0 = time.time()
    ok = 0
    skip = 0

    for idx, nick in enumerate(ship_nicks, 1):
        out_path = out_dir / f"{nick}.png"
        if out_path.exists():
            print(f"  [{idx}/{len(ship_nicks)}] {nick} — already exists")
            ok += 1
            continue

        da = arch_map.get(nick.lower())
        if not da:
            print(f"  [{idx}/{len(ship_nicks)}] {nick} — no model path found")
            skip += 1
            continue

        model_path = game_path / "DATA" / da.replace("\\", "/")
        if not model_path.exists():
            # Try case-insensitive search
            parts = Path(da.replace("\\", "/")).parts
            resolved = game_path / "DATA"
            found = True
            for part in parts:
                candidates = list(resolved.iterdir()) if resolved.is_dir() else []
                match = next((c for c in candidates if c.name.lower() == part.lower()), None)
                if match:
                    resolved = match
                else:
                    found = False
                    break
            if found:
                model_path = resolved
            else:
                print(f"  [{idx}/{len(ship_nicks)}] {nick} — model file not found: {da}")
                skip += 1
                continue

        print(f"  [{idx}/{len(ship_nicks)}] {nick}", end="", flush=True)
        success = render_ship(model_path, out_path)
        if success:
            ok += 1
            sz = out_path.stat().st_size
            print(f" — OK ({sz//1024} KB)")
        else:
            skip += 1

    elapsed = time.time() - t0
    print(f"\nDone: {ok} rendered, {skip} skipped in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
