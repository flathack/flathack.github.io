#!/usr/bin/env python3
"""
Generate an animated GIF forum signature for the FL Atlas Suite.

Output: widget-animated-suite.gif  (1225 × 160 px, ~3 s loop)

Layout:
  | Suite ring (69%) | Proj-1 bar + info | Proj-2 bar + info | Proj-3 bar + info |

Requires: Pillow
"""

from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Canvas
# ---------------------------------------------------------------------------
W, H = 1000, 150
FPS  = 24
DURATION_S = 3
TOTAL_FRAMES = FPS * DURATION_S          # 72

# ---------------------------------------------------------------------------
# Column layout — matches HTML grid: 140px | 1fr | 1fr | 1fr
# ---------------------------------------------------------------------------
BRAND_W = 140
PROJ_W  = (W - BRAND_W) // 3            # ~361 each

BRAND_X = 0
PROJ1_X = BRAND_W
PROJ2_X = BRAND_W + PROJ_W
PROJ3_X = BRAND_W + PROJ_W * 2

# Ring geometry (suite only)
RING_R_OUT = 36
RING_R_IN  = 27

# Bar geometry
BAR_H     = 9
BAR_PAD_X = 18   # left/right padding inside each project column

# ---------------------------------------------------------------------------
# Project data
# ---------------------------------------------------------------------------
PROJECTS = [
    {
        "name":    "FL Atlas — Visual Editor",
        "version": "v0.6.3",
        "status":  "Released · Alpha · 16 Updates",
        "detail":  "3D Viewer · INI Editor · Universe Map",
        "target":  "→ v1.0",
        "pct":     63,
        "dot":     "green",
    },
    {
        "name":    "FL Atlas — Savegame Editor",
        "version": "v0.1.5",
        "status":  "Released · Alpha · Active",
        "detail":  "Save Editing · Inventory · Ship Swap",
        "target":  "→ v1.0",
        "pct":     74,
        "dot":     "green",
    },
    {
        "name":    "FL Lingo — Translator",
        "version": "v0.1.1",
        "status":  "Released · Early · New",
        "detail":  "Relocalization · Auto-Translate · DLL Patch",
        "target":  "→ v1.0",
        "pct":     71,
        "dot":     "blue",
    },
]

SUITE_PCT = 69

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------
BG_DARK     = (10, 13, 19)
BG_MID      = (21, 26, 34)
BG_BRAND    = (28, 34, 44)
BG_BRAND_B  = (13, 17, 23)
RED_BRIGHT  = (255, 45, 55)
RED_MID     = (255, 107, 115)
TEXT_WHITE   = (244, 248, 255)
TEXT_MUTED   = (139, 149, 168)
TEXT_SUB     = (94, 106, 126)
TEXT_DIM     = (74, 85, 104)
RING_TRACK   = (40, 20, 25)
BAR_TRACK    = (30, 36, 48)
DIVIDER      = (44, 52, 66)
ACCENT2      = (255, 107, 115)
DOT_GREEN    = (52, 208, 88)
DOT_BLUE     = (88, 166, 255)

# ---------------------------------------------------------------------------
# Fonts — Windows system fonts
# ---------------------------------------------------------------------------
def _load_font(names: list[str], size: int) -> ImageFont.FreeTypeFont:
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()

font_pct_lg   = _load_font(["consola.ttf", "consolab.ttf", "arial.ttf"], 17)
font_ring_sub = _load_font(["segoeuil.ttf", "segoeui.ttf", "arial.ttf"], 9)
font_name     = _load_font(["segoeuib.ttf", "segoeui.ttf", "arialbd.ttf"], 13)
font_version  = _load_font(["segoeuib.ttf", "segoeui.ttf", "arialbd.ttf"], 10)
font_status   = _load_font(["segoeuil.ttf", "segoeui.ttf", "arial.ttf"], 9)
font_detail   = _load_font(["segoeuil.ttf", "segoeui.ttf", "arial.ttf"], 9)
font_pct_bar  = _load_font(["segoeuib.ttf", "consolab.ttf", "arialbd.ttf"], 11)
font_brand    = _load_font(["segoeuib.ttf", "segoeui.ttf", "arialbd.ttf"], 9)
font_foot     = _load_font(["segoeuil.ttf", "segoeui.ttf", "arial.ttf"], 7)

# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------
def lerp_color(c1: tuple, c2: tuple, t: float) -> tuple:
    t = max(0.0, min(1.0, t))
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def draw_arc_ring(draw: ImageDraw.ImageDraw, cx: int, cy: int,
                  r_out: int, r_in: int, pct: float,
                  fill_col: tuple, track_col: tuple):
    """Draw a conic progress ring via pieslice."""
    bbox_out = [cx - r_out, cy - r_out, cx + r_out, cy + r_out]
    bbox_in  = [cx - r_in,  cy - r_in,  cx + r_in,  cy + r_in]
    draw.pieslice(bbox_out, 0, 360, fill=track_col)
    arc_deg = pct * 3.6
    if arc_deg > 0.5:
        draw.pieslice(bbox_out, -90, -90 + arc_deg, fill=fill_col)
    draw.ellipse(bbox_in, fill=(5, 14, 22))


def draw_rounded_rect(draw: ImageDraw.ImageDraw, bbox, r: int, fill):
    x0, y0, x1, y1 = bbox
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill)


# ---------------------------------------------------------------------------
# Render a single frame
# ---------------------------------------------------------------------------
def render_frame(frame_idx: int, total: int) -> Image.Image:
    img  = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)

    t     = frame_idx / total
    pulse = 0.5 + 0.5 * math.sin(t * 2 * math.pi)
    shimmer_frac = 0.5 + 0.5 * math.sin(t * 2 * math.pi)

    # ── Background gradients ──
    # Brand column
    for y in range(H):
        ty = y / H
        c = lerp_color(BG_BRAND, BG_BRAND_B, ty)
        draw.line([(BRAND_X, y), (BRAND_X + BRAND_W - 1, y)], fill=c)

    # Project columns
    for col_x in (PROJ1_X, PROJ2_X, PROJ3_X):
        for y in range(H):
            ty = y / H
            c = lerp_color(BG_MID, BG_DARK, ty)
            draw.line([(col_x, y), (col_x + PROJ_W - 1, y)], fill=c)

    # ── Dividers ──
    for dx in (BRAND_W, PROJ2_X, PROJ3_X):
        draw.line([(dx, 0), (dx, H)], fill=DIVIDER)

    # ══════════════════════════════════════════════════════════
    # SUITE RING (brand column)
    # ══════════════════════════════════════════════════════════
    bcx = BRAND_X + BRAND_W // 2
    bcy = H // 2 - 10

    # Outer glow (pulsing)
    for dr in range(4, 0, -1):
        a = int((35 + pulse * 30) / dr)
        c = lerp_color(BG_DARK, RED_BRIGHT, a / 255)
        gr = RING_R_OUT + 4 + int(pulse * 2)
        draw.ellipse([bcx - gr + dr*2, bcy - gr + dr*2,
                      bcx + gr - dr*2, bcy + gr - dr*2], outline=c, width=1)

    draw_arc_ring(draw, bcx, bcy, RING_R_OUT, RING_R_IN,
                  SUITE_PCT, RED_BRIGHT, RING_TRACK)

    # Scan dot on suite ring
    arc_span = SUITE_PCT * 3.6
    if arc_span > 1:
        scan_deg = -90.0 + (t * arc_span) % arc_span
        scan_rad = math.radians(scan_deg)
        ring_mid = (RING_R_OUT + RING_R_IN) / 2.0
        sx = bcx + math.cos(scan_rad) * ring_mid
        sy = bcy + math.sin(scan_rad) * ring_mid
        for blur in range(4, 0, -1):
            alpha = (1.0 - blur / 5) * 0.8
            sc = lerp_color(RED_MID, (255, 248, 249), alpha)
            draw.ellipse([int(sx) - blur, int(sy) - blur,
                          int(sx) + blur, int(sy) + blur], fill=sc)
        draw.ellipse([int(sx) - 2, int(sy) - 2,
                      int(sx) + 2, int(sy) + 2], fill=(255, 255, 255))

    # Re-punch inner with pulsing tint
    inner_col = lerp_color((20, 10, 14), (40, 16, 22), pulse)
    draw.ellipse([bcx - RING_R_IN, bcy - RING_R_IN,
                  bcx + RING_R_IN, bcy + RING_R_IN], fill=inner_col)

    # Ring centre text
    pct_str = f"{SUITE_PCT}%"
    bb = draw.textbbox((0, 0), pct_str, font=font_pct_lg)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    draw.text((bcx - tw // 2, bcy - th // 2 - 3), pct_str, font=font_pct_lg, fill=TEXT_WHITE)
    sub = "Suite"
    bb2 = draw.textbbox((0, 0), sub, font=font_ring_sub)
    tw2 = bb2[2] - bb2[0]
    draw.text((bcx - tw2 // 2, bcy + th // 2 - 1), sub, font=font_ring_sub, fill=TEXT_MUTED)

    # Brand labels
    lbl1, lbl2 = "FL ATLAS SUITE", "by flathack"
    bb_l1 = draw.textbbox((0, 0), lbl1, font=font_brand)
    bb_l2 = draw.textbbox((0, 0), lbl2, font=font_foot)
    draw.text((bcx - (bb_l1[2]-bb_l1[0])//2, H - 28), lbl1, font=font_brand, fill=TEXT_MUTED)
    draw.text((bcx - (bb_l2[2]-bb_l2[0])//2, H - 17), lbl2, font=font_foot, fill=TEXT_DIM)

    # ══════════════════════════════════════════════════════════
    # PROJECT COLUMNS (bar charts)
    # ══════════════════════════════════════════════════════════
    for i, proj in enumerate(PROJECTS):
        col_x = BRAND_W + i * PROJ_W
        px = col_x + BAR_PAD_X           # left content edge
        pw = PROJ_W - BAR_PAD_X * 2      # available content width

        # ── Project name + version ──
        ty_name = 18
        draw.text((px, ty_name), proj["name"], font=font_name, fill=TEXT_WHITE)
        # version right of name
        nb = draw.textbbox((0, 0), proj["name"], font=font_name)
        vx = px + (nb[2] - nb[0]) + 8
        draw.text((vx, ty_name + 2), proj["version"], font=font_version, fill=ACCENT2)

        # ── Status line with dot ──
        ty_status = ty_name + 20
        dot_col = DOT_GREEN if proj["dot"] == "green" else DOT_BLUE
        draw.ellipse([px, ty_status + 3, px + 5, ty_status + 8], fill=dot_col)
        draw.text((px + 9, ty_status), proj["status"], font=font_status, fill=TEXT_MUTED)

        # ── Progress bar with shimmer ──
        ty_bar = ty_status + 18
        bar_x0 = px
        bar_x1 = px + pw - 42           # leave room for % label
        bar_fill_w = int((bar_x1 - bar_x0) * proj["pct"] / 100)

        # Track
        draw_rounded_rect(draw, [bar_x0, ty_bar, bar_x1, ty_bar + BAR_H], 4, BAR_TRACK)

        # Filled portion
        if bar_fill_w > 3:
            # gradient fill
            for x in range(bar_x0, bar_x0 + bar_fill_w):
                frac = (x - bar_x0) / max(1, bar_fill_w)
                c = lerp_color(RED_BRIGHT, ACCENT2, frac)
                draw.line([(x, ty_bar + 1), (x, ty_bar + BAR_H - 1)], fill=c)
            # round caps
            draw_rounded_rect(draw, [bar_x0, ty_bar, bar_x0 + min(bar_fill_w, 4), ty_bar + BAR_H], 4, RED_BRIGHT)
            draw_rounded_rect(draw, [bar_x0 + bar_fill_w - 4, ty_bar, bar_x0 + bar_fill_w, ty_bar + BAR_H], 4, lerp_color(RED_BRIGHT, ACCENT2, 1.0))

            # Shimmer sweep
            phase = i * 0.33
            sfrac = ((shimmer_frac + phase) % 1.0)
            scx = bar_x0 + int(bar_fill_w * sfrac)
            shimmer_hw = 18
            for x in range(max(bar_x0 + 1, scx - shimmer_hw),
                           min(bar_x0 + bar_fill_w - 1, scx + shimmer_hw)):
                d = abs(x - scx)
                if d < shimmer_hw:
                    a = ((1.0 - d / shimmer_hw) ** 2) * 0.75
                    sc = lerp_color(ACCENT2, (255, 240, 242), a)
                    draw.line([(x, ty_bar + 1), (x, ty_bar + BAR_H - 1)], fill=sc)

        # Percentage text
        pct_text = f"{proj['pct']} %"
        draw.text((bar_x1 + 6, ty_bar - 2), pct_text, font=font_pct_bar, fill=ACCENT2)

        # ── Detail + target ──
        ty_detail = ty_bar + BAR_H + 6
        draw.text((px, ty_detail), proj["detail"], font=font_detail, fill=TEXT_SUB)

        target_bb = draw.textbbox((0, 0), proj["target"], font=font_detail)
        target_w = target_bb[2] - target_bb[0]
        draw.text((px + pw - target_w, ty_detail), proj["target"], font=font_detail, fill=TEXT_DIM)

    return img


# ---------------------------------------------------------------------------
# Compose and save
# ---------------------------------------------------------------------------
OUT_DIR = Path(__file__).parent


def main():
    raw_path = OUT_DIR / "widget-animated-suite-raw.gif"
    opt_path = OUT_DIR / "widget-animated-suite.gif"

    print(f"Rendering {TOTAL_FRAMES} frames at {W}×{H} …")
    frames: list[Image.Image] = []
    for i in range(TOTAL_FRAMES):
        frames.append(render_frame(i, TOTAL_FRAMES))
        if (i + 1) % FPS == 0:
            print(f"  {i+1}/{TOTAL_FRAMES}")

    ms = 1000 // FPS
    frames[0].save(raw_path, save_all=True, append_images=frames[1:],
                   duration=ms, loop=0)
    print(f"  Raw GIF saved ({raw_path.stat().st_size // 1024} KB)")

    # Optimise: halve frame rate → 12 fps, reduce palette to 96 colours
    opt_frames: list[Image.Image] = []
    opt_dur: list[int] = []
    src = Image.open(raw_path)
    j = 0
    while True:
        try:
            src.seek(j)
            if j % 2 == 0:
                opt_frames.append(src.copy().convert("RGB").quantize(colors=96))
                opt_dur.append(83)
            j += 1
        except EOFError:
            break

    opt_frames[0].save(
        opt_path, save_all=True, append_images=opt_frames[1:],
        duration=opt_dur, loop=0, optimize=True,
    )
    src.close()

    try:
        raw_path.unlink()
    except PermissionError:
        pass

    kb = opt_path.stat().st_size // 1024
    print(f"  -> {opt_path.name}  ({kb} KB)")
    print("Done.")


if __name__ == "__main__":
    main()
