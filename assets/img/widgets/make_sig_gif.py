"""
Generates animated 600x100 forum signature GIFs for all FL Atlas widgets.
Output: widget-animated-*.gif in the same folder as this script.

Widgets generated:
  widget-animated-roadmap.gif  - version roadmap v0.6.3 -> v1.0
  widget-animated-combo.gif    - all projects combined
  widget-animated-visual.gif   - FL Atlas Visual Editor
  widget-animated-savegame.gif - FL Atlas Savegame Editor
  widget-animated-lingo.gif    - FL-Lingo

Run with: python make_sig_gif.py
Requires: Pillow  (pip install pillow)
"""

from __future__ import annotations
import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
W, H = 600, 100
RING_COL_W = 86
FPS = 24
TOTAL_FRAMES = FPS * 3     # 3-second loop

# Widget definitions: (id, ring_pct, bar_pct, title, sub, meta_left, meta_mid, meta_right, foot, mini_bars)
# mini_bars: list of (label, pct) or None for roadmap
WIDGETS = [
    {
        "id":          "roadmap",
        "ring_pct":    16,
        "bar_pct":     None,          # roadmap uses milestone-bar instead
        "roadmap":     True,
        "title":       "FL Atlas Version Progress",
        "sub":         "Aktuell zwischen v0.6.3 und v0.6.4",
        "meta":        ("Pfad zu v1.0", "Current", "v0.6.3+"),
        "foot":        "Naechster Meilenstein: v0.6.4",
        "mini":        None,
    },
    {
        "id":          "combo",
        "ring_pct":    69,
        "bar_pct":     69,
        "roadmap":     False,
        "title":       "FL Atlas Project Suite",
        "sub":         "Alle Projekte kombiniert",
        "meta":        ("v1.0 Progress 69%", "Multi", "Build 0.6.3+"),
        "foot":        "Visual 63 | Save 74 | Lingo 71",
        "mini":        [("Visual", 63), ("Save", 74), ("Lingo", 71)],
    },
    {
        "id":          "visual",
        "ring_pct":    63,
        "bar_pct":     63,
        "roadmap":     False,
        "title":       "FL Atlas Visual Editor",
        "sub":         "FL Atlas Visual Editor v0.6.3",
        "meta":        ("v1.0 Progress 63%", "Alpha", "Build 0.6.3"),
        "foot":        "16 total updates (1 today)",
        "mini":        [("3D", 72), ("Ref", 78), ("INI", 66), ("Doc", 42), ("QA", 57)],
    },
    {
        "id":          "savegame",
        "ring_pct":    74,
        "bar_pct":     74,
        "roadmap":     False,
        "title":       "FL Atlas Savegame Editor",
        "sub":         "FL Atlas Savegame Editor v0.74",
        "meta":        ("v1.0 Progress 74%", "Alpha", "Build 0.7.4"),
        "foot":        "Safety 78 | Features 80 | QA 64",
        "mini":        [("Feat", 80), ("Safe", 78), ("UX", 64)],
    },
    {
        "id":          "lingo",
        "ring_pct":    71,
        "bar_pct":     71,
        "roadmap":     False,
        "title":       "FL-Lingo",
        "sub":         "FL-Lingo v0.71",
        "meta":        ("v1.0 Progress 71%", "Active", "Build 0.7.1"),
        "foot":        "Core 79 | Flow 68 | QA 66",
        "mini":        [("Core", 79), ("Flow", 68), ("QA", 66)],
    },
]

# Placeholders replaced per-widget during render
RING_PCT = 63
BAR_PCT = 63

# Colors
BG_DARK    = (22, 8, 12)
BG_MID     = (38, 17, 24)
DIVIDER    = (80, 36, 44)
RED_BRIGHT = (255, 45, 55)
RED_MID    = (255, 100, 107)
RED_PALE   = (255, 162, 166)
TEXT_WHITE = (241, 246, 255)
TEXT_MUTED = (199, 169, 176)
TEXT_SUB   = (215, 188, 196)
TRACK_BG   = (36, 42, 52)
RING_TRACK = (80, 40, 50)

# ---------------------------------------------------------------------------
# Font helpers – fall back to default if no system font found
# ---------------------------------------------------------------------------
def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ]
    if bold:
        candidates = [
            "C:/Windows/Fonts/consolab.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/segoeuib.ttf",
        ] + candidates
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


font_title  = load_font(13, bold=True)
font_sub    = load_font(9)
font_meta   = load_font(8)
font_ring   = load_font(14, bold=True)
font_ring_s = load_font(7)
font_foot   = load_font(8)

# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------

def draw_rounded_rect(draw: ImageDraw.ImageDraw, xy, radius: int, fill, outline=None, width=1):
    """Rounded rectangle helper (Pillow < 9 compat)."""
    x0, y0, x1, y1 = xy
    if x1 - x0 < 1 or y1 - y0 < 1:
        return
    radius = min(radius, (x1 - x0) // 2, (y1 - y0) // 2)
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + radius*2, y0 + radius*2], fill=fill)
    draw.ellipse([x1 - radius*2, y0, x1, y0 + radius*2], fill=fill)
    draw.ellipse([x0, y1 - radius*2, x0 + radius*2, y1], fill=fill)
    draw.ellipse([x1 - radius*2, y1 - radius*2, x1, y1], fill=fill)
    if outline:
        draw.arc([x0, y0, x0+radius*2, y0+radius*2], 180, 270, fill=outline, width=width)
        draw.arc([x1-radius*2, y0, x1, y0+radius*2], 270, 360, fill=outline, width=width)
        draw.arc([x0, y1-radius*2, x0+radius*2, y1], 90, 180, fill=outline, width=width)
        draw.arc([x1-radius*2, y1-radius*2, x1, y1], 0, 90, fill=outline, width=width)
        draw.line([x0+radius, y0, x1-radius, y0], fill=outline, width=width)
        draw.line([x0+radius, y1, x1-radius, y1], fill=outline, width=width)
        draw.line([x0, y0+radius, x0, y1-radius], fill=outline, width=width)
        draw.line([x1, y0+radius, x1, y1-radius], fill=outline, width=width)


def draw_arc_ring(draw: ImageDraw.ImageDraw, cx: int, cy: int, r_out: int, r_in: int,
                  pct: float, color_fill, color_track):
    """Draw a conic-style ring progress."""
    bbox_out = [cx - r_out, cy - r_out, cx + r_out, cy + r_out]
    bbox_in  = [cx - r_in,  cy - r_in,  cx + r_in,  cy + r_in]

    # track (background arc, full 360)
    draw.ellipse(bbox_out, fill=color_track)
    draw.ellipse(bbox_in,  fill=BG_DARK)

    # progress arc – draw as a filled sector then punch hole
    if pct > 0:
        deg = pct * 3.6  # percent -> degrees
        # Pillow arc starts at 3 o'clock; we want 12 o'clock start = -90
        draw.pieslice(bbox_out, start=-90, end=-90 + deg, fill=color_fill)
        draw.ellipse(bbox_in, fill=BG_DARK)


def lerp_color(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


# ---------------------------------------------------------------------------
# Frame renderer
# ---------------------------------------------------------------------------

def render_frame(frame_idx: int, total: int, widget: dict) -> Image.Image:
    ring_pct = widget["ring_pct"]
    bar_pct  = widget["bar_pct"] or 0
    is_roadmap = widget.get("roadmap", False)

    img = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)

    # t  = animation progress 0..1 (one full loop)
    t = frame_idx / total

    # === Background gradient ===
    for y in range(H):
        ty = y / H
        draw.line([(RING_COL_W, y), (W, y)], fill=lerp_color(BG_MID, BG_DARK, ty))
    for y in range(H):
        ty = y / H
        draw.line([(0, y), (RING_COL_W - 1, y)], fill=lerp_color((28, 34, 44), (13, 17, 23), ty))

    # === Divider ===
    draw.line([(RING_COL_W, 0), (RING_COL_W, H)], fill=DIVIDER)

    # === Ring ===
    # pulse drives outer-glow brightness
    pulse = 0.5 + 0.5 * math.sin(t * 2 * math.pi)
    r_out, r_in = 30, 22
    cx, cy = RING_COL_W // 2, H // 2

    # Outer glow (pulsing)
    for dr in range(4, 0, -1):
        a = int((40 + pulse * 30) / dr)
        c = lerp_color(BG_DARK, RED_BRIGHT, a / 255)
        glow_r = r_out + 4 + int(pulse * 3)
        draw.ellipse([cx - glow_r + dr*2, cy - glow_r + dr*2,
                      cx + glow_r - dr*2, cy + glow_r - dr*2], outline=c, width=1)

    # Ring arc — always at full ring_pct (no grow/shrink)
    draw_arc_ring(draw, cx, cy, r_out, r_in, ring_pct, RED_BRIGHT, RING_TRACK)

    # Rotating scan-dot on the filled arc portion
    arc_start_deg = -90.0
    arc_span_deg  = ring_pct * 3.6           # degrees covered by the filled arc
    scan_deg = arc_start_deg + (t * arc_span_deg) % arc_span_deg
    scan_rad = math.radians(scan_deg)
    ring_mid_r = (r_out + r_in) / 2.0
    scan_x = cx + math.cos(scan_rad) * ring_mid_r
    scan_y = cy + math.sin(scan_rad) * ring_mid_r
    spot_r = 5
    for blur in range(spot_r, 0, -1):
        alpha = (1.0 - blur / (spot_r + 1)) * 0.85
        sc = lerp_color(RED_MID, (255, 248, 249), alpha)
        b = blur + 1
        draw.ellipse([int(scan_x) - b, int(scan_y) - b,
                      int(scan_x) + b, int(scan_y) + b], fill=sc)
    draw.ellipse([int(scan_x) - 2, int(scan_y) - 2,
                  int(scan_x) + 2, int(scan_y) + 2], fill=(255, 255, 255))

    # Re-punch inner hole (clips scan dot to ring band; also pulsing inner fill)
    inner_col = lerp_color((30, 12, 16), (60, 20, 28), pulse)
    draw.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=inner_col)

    # Ring text
    pct_str = f"{ring_pct}%"
    sub_str = "roadmap" if is_roadmap else "v1.0"
    tb = draw.textbbox((0, 0), pct_str, font=font_ring)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    draw.text((cx - tw // 2, cy - th // 2 - 3), pct_str, font=font_ring, fill=TEXT_WHITE)
    tb2 = draw.textbbox((0, 0), sub_str, font=font_ring_s)
    tw2 = tb2[2] - tb2[0]
    draw.text((cx - tw2 // 2, cy + th // 2 - 1), sub_str, font=font_ring_s, fill=TEXT_MUTED)

    # === Right content ===
    x0, x1 = RING_COL_W + 10, W - 10
    bar_w = x1 - x0

    title_y = 8
    draw.text((x0, title_y), widget["title"], font=font_title, fill=RED_BRIGHT)

    sub_y = title_y + 16
    draw.text((x0, sub_y), widget["sub"], font=font_sub, fill=TEXT_SUB)

    meta_y = sub_y + 12
    m0, m1, m2 = widget["meta"]
    draw.text((x0,       meta_y), m0, font=font_meta, fill=TEXT_MUTED)
    draw.text((x0 + 130, meta_y), m1, font=font_meta, fill=TEXT_MUTED)
    draw.text((x0 + 185, meta_y), m2, font=font_meta, fill=TEXT_MUTED)

    bar_y = meta_y + 12
    bar_h = 7

    # Smooth ping-pong shimmer position (0→1→0→…)
    shimmer_frac = 0.5 + 0.5 * math.sin(t * 2 * math.pi)

    def draw_bar_shimmer(bx0: int, bx1: int, by: int, bh: int,
                         pct: float, phase: float = 0.0, hw: int = 20):
        """Fixed-width bar with a sweeping internal shimmer highlight."""
        bfw = int((bx1 - bx0) * pct / 100)
        draw_rounded_rect(draw, [bx0, by, bx1, by + bh], 3, TRACK_BG)
        if bfw < 3:
            return
        draw_rounded_rect(draw, [bx0, by, bx0 + bfw, by + bh], 3, RED_MID)
        frac = (shimmer_frac + phase) % 1.0
        scx = bx0 + int(bfw * frac)
        x_lo = max(bx0 + 1, scx - hw)
        x_hi = min(bx0 + bfw - 1, scx + hw)
        for x in range(x_lo, x_hi):
            d = abs(x - scx)
            if d >= hw:
                continue
            alpha = ((1.0 - d / hw) ** 2) * 0.80
            sc = lerp_color(RED_MID, (255, 240, 242), alpha)
            lh = max(1, bh - 2)
            draw.line([(x, by + 1), (x, by + lh)], fill=sc)

    if is_roadmap:
        # --- Roadmap milestone bar (fixed at current_pos) ---
        milestones   = [0.0, 0.3333, 0.6667, 1.0]
        current_pos  = 0.16   # between v0.6.3 and v0.6.4
        fill_w = int(bar_w * current_pos)

        draw_rounded_rect(draw, [x0, bar_y, x1, bar_y + bar_h], 3, TRACK_BG)
        if fill_w > 4:
            draw_rounded_rect(draw, [x0, bar_y, x0 + fill_w, bar_y + bar_h], 3, RED_MID)
            # Shimmer within the filled roadmap segment
            scx = x0 + int(fill_w * shimmer_frac)
            shimmer_hw = 12
            for x in range(x0 + 1, x0 + fill_w - 1):
                d = abs(x - scx)
                if d < shimmer_hw:
                    alpha = ((1.0 - d / shimmer_hw) ** 2) * 0.80
                    sc = lerp_color(RED_MID, (255, 240, 242), alpha)
                    draw.line([(x, bar_y + 1), (x, bar_y + bar_h - 1)], fill=sc)

        # Milestone marks
        labels = ["v0.6.3", "v0.6.4", "v0.7.0", "v1.0"]
        for pos, lbl in zip(milestones, labels):
            mx = x0 + int(bar_w * pos)
            draw.ellipse([mx - 3, bar_y + 1, mx + 3, bar_y + bar_h - 1],
                         fill=(60, 20, 28) if pos <= current_pos else (22, 28, 38))
            draw.ellipse([mx - 3, bar_y + 1, mx + 3, bar_y + bar_h - 1],
                         outline=(130, 50, 60), width=1)
            tb_l = draw.textbbox((0, 0), lbl, font=font_ring_s)
            lw = tb_l[2] - tb_l[0]
            label_x = mx - lw // 2
            label_x = max(x0, min(label_x, x1 - lw))
            draw.text((label_x, bar_y + bar_h + 2), lbl, font=font_ring_s, fill=TEXT_MUTED)

        # Pulse dot at current position (size pulses with sine)
        dot_x = x0 + fill_w
        dot_r = 4
        dot_glow = int(2 + pulse * 2)
        glow_c = lerp_color((80, 20, 26), RED_BRIGHT, pulse * 0.6)
        draw.ellipse([dot_x - dot_r - dot_glow, bar_y - dot_glow,
                      dot_x + dot_r + dot_glow, bar_y + bar_h + dot_glow], fill=glow_c)
        draw.ellipse([dot_x - dot_r, bar_y, dot_x + dot_r, bar_y + bar_h],
                     fill=(255, 125, 132))

    else:
        # --- Standard progress bar — fixed width, shimmer sweep ---
        draw_bar_shimmer(x0, x1, bar_y, bar_h, bar_pct)

        # Mini bars (staggered shimmer phase per bar)
        mini = widget.get("mini")
        if mini:
            mb_y = bar_y + bar_h + 3
            if mb_y + 8 < H - 4:
                n   = len(mini)
                gap = 4
                mb_w = (bar_w - gap * (n - 1)) // n
                for mi, (lbl, pct) in enumerate(mini):
                    mbx = x0 + mi * (mb_w + gap)
                    phase = mi * (1.0 / max(n, 1))   # stagger per mini bar
                    draw_bar_shimmer(mbx, mbx + mb_w, mb_y + 6, 4, pct,
                                     phase=phase, hw=8)
                    draw.text((mbx, mb_y), f"{lbl} {pct}%",
                              font=font_ring_s, fill=TEXT_MUTED)

    foot_y = bar_y + bar_h + (13 if is_roadmap else 4)
    draw.text((x0, foot_y), widget["foot"], font=font_foot, fill=TEXT_MUTED)

    return img


# ---------------------------------------------------------------------------
# Compose, save and optimise all widgets
# ---------------------------------------------------------------------------

OUT_DIR = Path(__file__).parent

def save_widget_gif(widget: dict):
    wid = widget["id"]
    raw_path = OUT_DIR / f"widget-animated-{wid}-raw.gif"
    opt_path = OUT_DIR / f"widget-animated-{wid}.gif"

    print(f"\n[{wid}] Rendering {TOTAL_FRAMES} frames …")
    frames: list[Image.Image] = []
    for i in range(TOTAL_FRAMES):
        frames.append(render_frame(i, TOTAL_FRAMES, widget))
        if (i + 1) % FPS == 0:
            print(f"  {i+1}/{TOTAL_FRAMES}")

    ms = 1000 // FPS
    frames[0].save(raw_path, save_all=True, append_images=frames[1:], duration=ms, loop=0)

    # Optimise: 12 fps, 96 colors
    opt_frames, opt_dur = [], []
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
        pass   # Windows lock; raw file will be cleaned up on next run
    kb = opt_path.stat().st_size // 1024
    print(f"  -> {opt_path.name}  {kb} KB")


for w in WIDGETS:
    save_widget_gif(w)

print("\nAll done.")
