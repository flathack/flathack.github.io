"""Batch-render ship images from Freelancer .cmp/.3db models using the FLAtlas V2 decoder.

Usage:
    python render_ships_v2.py <game_path> <mod_key> [limit]
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import numpy as np
from PIL import Image

from render_v2_common import extract_ship_nicks, find_v2_exporter, load_v2_triangles, parse_shiparch, resolve_case_insensitive

BG_RGB = (15, 15, 26)
BG_F = tuple(c / 255 for c in BG_RGB)
BASE_COLOR = np.array([0.3, 0.55, 0.75])
LIGHT_DIR = np.array([0.4, 0.6, 0.8])
LIGHT_DIR = LIGHT_DIR / np.linalg.norm(LIGHT_DIR)


def render_triangles(triangles: np.ndarray, out_path: Path) -> bool:
    v0, v1, v2 = triangles[:, 0], triangles[:, 1], triangles[:, 2]
    normals = np.cross(v1 - v0, v2 - v0)
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms[norms == 0] = 1
    normals = normals / norms
    intensity = np.abs(np.dot(normals, LIGHT_DIR))
    intensity = 0.3 + 0.7 * intensity
    colors = np.clip(np.outer(intensity, BASE_COLOR), 0, 1)

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
    img.crop((cmin, rmin, cmax + 1, rmax + 1)).save(out_path, optimize=True)
    return True


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(1)

    game_path = Path(sys.argv[1])
    mod_key = sys.argv[2]
    limit = int(sys.argv[3]) if len(sys.argv) >= 4 else None
    json_path = Path(__file__).resolve().parent.parent / "data" / "trade-routes" / f"{mod_key}.json"
    out_dir = Path(__file__).resolve().parent.parent / "data" / "ships-v2" / mod_key
    exporter = find_v2_exporter()

    if exporter is None:
        print("ERROR: flatlas_model_screenshot_exporter not found. Build FLAtlas-V2 first.")
        raise SystemExit(1)
    if not json_path.exists():
        print(f"ERROR: {json_path} not found")
        raise SystemExit(1)

    out_dir.mkdir(parents=True, exist_ok=True)
    data = json.loads(json_path.read_text(encoding="utf-8"))
    ship_nicks = extract_ship_nicks(data)
    if limit is not None:
        ship_nicks = ship_nicks[:limit]

    arch_map = parse_shiparch(game_path)

    print(f"Rendering {len(ship_nicks)} ships for [{mod_key}] with V2 -> {out_dir}")
    t0 = time.time()
    ok = 0
    skip = 0

    for idx, nick in enumerate(ship_nicks, 1):
        out_path = out_dir / f"{nick}.png"
        da = arch_map.get(nick.lower())
        if not da:
            print(f"  [{idx}/{len(ship_nicks)}] {nick} — no model path found")
            skip += 1
            continue

        model_path = resolve_case_insensitive(game_path / "DATA", da)
        if model_path is None:
            model_path = resolve_case_insensitive(game_path, da)
        if model_path is None:
            print(f"  [{idx}/{len(ship_nicks)}] {nick} — model file not found: {da}")
            skip += 1
            continue

        print(f"  [{idx}/{len(ship_nicks)}] {nick}", end="", flush=True)
        triangles = load_v2_triangles(model_path, exporter)
        if triangles is None:
            skip += 1
            continue

        if render_triangles(triangles, out_path):
            ok += 1
            print(f" — OK ({out_path.stat().st_size // 1024} KB)")
        else:
            skip += 1

    print(f"\nDone: {ok} rendered, {skip} skipped in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()