"""Render homepage-ready Nomad ship sprites from Freelancer HD models."""

from __future__ import annotations

import sys
import json
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from render_v2_common import find_v2_exporter

ROOT = Path(__file__).resolve().parent.parent
SOURCE_ROOT = Path(r"C:\Users\steve\Github\FL-Installationen\Freelancer-HD\DATA\SHIPS\NOMAD")
OUT_DIR = ROOT / "freelancer2d" / "data" / "ship_icons"
ICON_SIZE = 128

ASSETS = {
    "no_hd_fighter": SOURCE_ROOT / "NO_FIGHTER" / "no_fighter.3db",
    "no_hd_gunboat": SOURCE_ROOT / "NO_GUNSHIP" / "no_gunship.3db",
    "no_hd_battleship": SOURCE_ROOT / "NO_BATTLESHIP" / "no_battleship.3db",
}

BASE_COLOR = np.array([0.34, 0.84, 1.0])
RIM_COLOR = np.array([0.72, 0.46, 1.0])
LIGHT_DIR = np.array([0.25, 0.48, 0.84])
LIGHT_DIR = LIGHT_DIR / np.linalg.norm(LIGHT_DIR)
RUNTIME_PATHS = [
    r"C:\Qt\6.8.3\mingw_64\bin",
    r"C:\Qt\Tools\mingw1310_64\bin",
]


def load_triangles(model_path: Path, exporter_path: Path) -> np.ndarray | None:
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as handle:
        json_path = Path(handle.name)

    env = os.environ.copy()
    env["PATH"] = os.pathsep.join(RUNTIME_PATHS + [env.get("PATH", "")])
    try:
        result = subprocess.run(
            [str(exporter_path), "--model", str(model_path), "--output", str(json_path)],
            cwd=str(exporter_path.parent),
            env=env,
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            message = result.stderr.strip() or result.stdout.strip() or f"exporter failed with {result.returncode}"
            print(f"    SKIP (V2 export error): {message}")
            return None

        payload = json.loads(json_path.read_text(encoding="utf-8"))
        triangles = np.array(payload.get("triangles", []), dtype=float)
        if triangles.size == 0 or triangles.ndim != 3 or triangles.shape[1:] != (3, 3):
            print("    SKIP (no usable V2 triangles)")
            return None

        return triangles[:, :, [0, 2, 1]]
    finally:
        json_path.unlink(missing_ok=True)


def rotation_matrix(elev_deg: float, azim_deg: float) -> np.ndarray:
    elev = np.deg2rad(elev_deg)
    azim = np.deg2rad(azim_deg)
    rot_z = np.array([
        [np.cos(azim), -np.sin(azim), 0],
        [np.sin(azim), np.cos(azim), 0],
        [0, 0, 1],
    ])
    rot_x = np.array([
        [1, 0, 0],
        [0, np.cos(elev), -np.sin(elev)],
        [0, np.sin(elev), np.cos(elev)],
    ])
    return rot_x @ rot_z


def render_sprite(triangles: np.ndarray, out_path: Path) -> bool:
    v0, v1, v2 = triangles[:, 0], triangles[:, 1], triangles[:, 2]
    normals = np.cross(v1 - v0, v2 - v0)
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms[norms == 0] = 1
    normals = normals / norms

    light = np.abs(np.dot(normals, LIGHT_DIR))
    rim = np.clip(1.0 - np.abs(normals[:, 2]), 0, 1)
    colors = np.clip((0.2 + 0.8 * light)[:, None] * BASE_COLOR + (rim * 0.28)[:, None] * RIM_COLOR, 0, 1)

    out_path.parent.mkdir(parents=True, exist_ok=True)

    render_size = 768
    matrix = rotation_matrix(34, 225)
    rotated = triangles @ matrix.T
    points = rotated.reshape(-1, 3)
    mn, mx = points.min(axis=0), points.max(axis=0)
    center = (mn + mx) / 2
    span = max(mx[0] - mn[0], mx[1] - mn[1]) * 1.16
    if span <= 0:
        return False

    scale = render_size / span
    projected = rotated[:, :, :2]
    projected[:, :, 0] = (projected[:, :, 0] - center[0]) * scale + render_size / 2
    projected[:, :, 1] = render_size / 2 - (projected[:, :, 1] - center[1]) * scale
    order = np.argsort(rotated[:, :, 2].mean(axis=1))

    glow = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    image = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for idx in order:
        polygon = [tuple(point) for point in projected[idx]]
        rgb = tuple(int(channel * 255) for channel in colors[idx])
        glow_draw.polygon(polygon, fill=(70, 220, 255, 64))
        draw.polygon(polygon, fill=rgb + (236,))
        draw.line(polygon + [polygon[0]], fill=(190, 245, 255, 36), width=1)

    glow = glow.filter(ImageFilter.GaussianBlur(8))
    image = Image.alpha_composite(glow, image)

    arr = np.array(image)
    alpha = arr[:, :, 3]
    rows = np.any(alpha > 8, axis=1)
    cols = np.any(alpha > 8, axis=0)
    if not rows.any() or not cols.any():
        return False

    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    pad = 8
    cropped = image.crop((
        max(0, cmin - pad),
        max(0, rmin - pad),
        min(image.width, cmax + pad + 1),
        min(image.height, rmax + pad + 1),
    ))
    size = max(cropped.size)
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    square.paste(cropped, ((size - cropped.width) // 2, (size - cropped.height) // 2))
    square = square.resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
    square = ImageEnhance.Contrast(square).enhance(1.18)
    square.save(out_path, optimize=True)
    return True


def main() -> int:
    exporter = find_v2_exporter()
    if exporter is None:
        print("ERROR: flatlas_model_screenshot_exporter not found")
        return 1

    ok = 0
    for name, model_path in ASSETS.items():
        if not model_path.exists():
            print(f"SKIP {name}: missing {model_path}")
            continue

        triangles = load_triangles(model_path, exporter)
        if triangles is None:
            print(f"SKIP {name}: model export failed")
            continue

        out_path = OUT_DIR / f"{name}.png"
        if render_sprite(triangles, out_path):
            ok += 1
            print(f"OK {name}: {out_path}")
        else:
            print(f"SKIP {name}: empty render")

    return 0 if ok == len(ASSETS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
