#!/usr/bin/env python3
"""Generate FL Atlas V2 progress forum signatures."""

from __future__ import annotations

import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


W, H = 800, 100
OUT = Path(__file__).parent / "widget-flatlas-v2-progress.png"
OUT_GIF = Path(__file__).parent / "widget-animated-flatlas-v2-progress.gif"
FPS = 24
DURATION_S = 3
TOTAL_FRAMES = FPS * DURATION_S

BG_TOP = (12, 16, 24)
BG_BOTTOM = (5, 8, 14)
PANEL = (17, 23, 34)
PANEL_B = (9, 13, 21)
GRID = (34, 45, 64)
TEXT = (244, 248, 255)
MUTED = (139, 149, 168)
DIM = (82, 94, 116)
RED = (255, 45, 55)
RED_2 = (255, 118, 126)
BLUE = (88, 166, 255)
BLUE_2 = (126, 198, 255)
GREEN = (52, 208, 88)
GREEN_2 = (122, 229, 155)
GOLD = (255, 196, 87)
TRACK = (29, 37, 52)
TRACK_2 = (42, 52, 70)
BORDER = (51, 61, 78)


MILESTONES = [
    {"version": "v0.7.1", "label": "RELEASED", "pct": 71, "state": "done"},
    {"version": "v0.8.0", "label": "IN PROGRESS", "pct": 80, "state": "active"},
    {"version": "v0.9.0", "label": "NEXT", "pct": 90, "state": "next"},
    {"version": "v1.0.0", "label": "FINAL", "pct": 100, "state": "final"},
]


def load_font(names: list[str], size: int) -> ImageFont.FreeTypeFont:
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


FONT_TITLE = load_font(["segoeuib.ttf", "arialbd.ttf"], 15)
FONT_SUB = load_font(["segoeui.ttf", "arial.ttf"], 8)
FONT_MONO = load_font(["consolab.ttf", "consola.ttf", "arialbd.ttf"], 13)
FONT_SMALL_BOLD = load_font(["segoeuib.ttf", "arialbd.ttf"], 8)
FONT_TINY = load_font(["segoeui.ttf", "arial.ttf"], 7)
FONT_TINY_BOLD = load_font(["segoeuib.ttf", "arialbd.ttf"], 7)
FONT_BIG = load_font(["consolab.ttf", "arialbd.ttf"], 20)


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def centered_text(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
) -> None:
    tw, th = text_size(draw, text, font)
    draw.text((center[0] - tw // 2, center[1] - th // 2 - 1), text, font=font, fill=fill)


def rounded(draw: ImageDraw.ImageDraw, box: list[int], radius: int, fill, outline=None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_background(draw: ImageDraw.ImageDraw, phase: float = 0.0) -> None:
    for y in range(H):
        c = lerp(BG_TOP, BG_BOTTOM, y / (H - 1))
        draw.line([(0, y), (W, y)], fill=c)

    offset = round(phase * 28)
    for x in range(-28 + offset, W + 28, 28):
        shade = lerp(GRID, BG_BOTTOM, 0.42)
        draw.line([(x, 0), (x - 35, H)], fill=shade)

    for x in range(W):
        t = x / (W - 1)
        glow = max(0.0, 1.0 - abs(t - 0.36) / 0.22)
        if glow <= 0:
            continue
        for y in range(0, H, 2):
            base = lerp(BG_TOP, BG_BOTTOM, y / (H - 1))
            c = lerp(base, (34, 16, 25), glow * 0.42)
            draw.point((x, y), fill=c)
            if y + 1 < H:
                draw.point((x, y + 1), fill=c)


def draw_left_block(draw: ImageDraw.ImageDraw, phase: float = 0.0) -> None:
    rounded(draw, [8, 8, 188, 92], 6, PANEL, BORDER)
    for y in range(9, 92):
        c = lerp((29, 34, 46), PANEL_B, (y - 9) / 83)
        draw.line([(9, y), (187, y)], fill=c)

    draw.text((20, 20), "FL ATLAS V2", font=FONT_TITLE, fill=TEXT)
    draw.text((21, 39), "ROAD TO STABLE", font=FONT_SMALL_BOLD, fill=RED_2)
    draw.text((21, 55), "current", font=FONT_TINY_BOLD, fill=DIM)
    draw.text((21, 66), "v0.7.1", font=FONT_MONO, fill=GREEN_2)

    pulse = 0.5 + 0.5 * math.sin(phase * math.tau)
    badge_fill = lerp((22, 34, 28), (31, 55, 38), pulse)
    rounded(draw, [118, 55, 174, 76], 4, badge_fill, (61, 103, 70))
    centered_text(draw, (146, 65), "RELEASED", FONT_TINY_BOLD, GREEN_2)


def draw_progress(draw: ImageDraw.ImageDraw, phase: float = 0.0) -> None:
    bar_x0, bar_y0 = 224, 45
    bar_w, bar_h = 424, 10
    bar_x1 = bar_x0 + bar_w

    draw.text((224, 16), "VERSION PROGRESS", font=FONT_SMALL_BOLD, fill=MUTED)
    draw.text((224, 29), "v0.8.0 work has started after the v0.7.1 release", font=FONT_SUB, fill=DIM)

    rounded(draw, [bar_x0, bar_y0, bar_x1, bar_y0 + bar_h], 5, TRACK, TRACK_2)

    released_w = round(bar_w * 0.71)
    active_w = round(bar_w * 0.80)
    for x in range(bar_x0, bar_x0 + released_w):
        c = lerp(GREEN, GREEN_2, (x - bar_x0) / max(1, released_w))
        draw.line([(x, bar_y0 + 1), (x, bar_y0 + bar_h - 1)], fill=c)
    for x in range(bar_x0 + released_w, bar_x0 + active_w):
        c = lerp(RED, RED_2, (x - (bar_x0 + released_w)) / max(1, active_w - released_w))
        draw.line([(x, bar_y0 + 1), (x, bar_y0 + bar_h - 1)], fill=c)

    shimmer_x = bar_x0 + released_w + round((active_w - released_w) * phase)
    shimmer_hw = 16
    for x in range(max(bar_x0 + released_w, shimmer_x - shimmer_hw), min(bar_x0 + active_w, shimmer_x + shimmer_hw)):
        d = abs(x - shimmer_x)
        amount = (1.0 - d / shimmer_hw) ** 2
        c = lerp(RED_2, (255, 240, 242), amount * 0.8)
        draw.line([(x, bar_y0 + 1), (x, bar_y0 + bar_h - 1)], fill=c)

    for item in MILESTONES:
        x = bar_x0 + round(bar_w * item["pct"] / 100)
        state = item["state"]
        if state == "done":
            fill, outline, text_fill = GREEN_2, (176, 255, 195), GREEN_2
            r = 5
        elif state == "active":
            fill, outline, text_fill = RED_2, (255, 211, 214), RED_2
            r = 6
            pulse = 0.5 + 0.5 * math.sin(phase * math.tau)
            glow_r = 10 + round(pulse * 4)
            glow_col = lerp((78, 31, 39), (130, 50, 62), pulse)
            draw.ellipse([x - glow_r, bar_y0 - glow_r, x + glow_r, bar_y0 + bar_h + glow_r], outline=glow_col, width=1)
        elif state == "final":
            fill, outline, text_fill = GOLD, (255, 234, 173), GOLD
            r = 5
        else:
            fill, outline, text_fill = TRACK_2, (82, 94, 116), MUTED
            r = 4

        draw.ellipse([x - r, bar_y0 + bar_h // 2 - r, x + r, bar_y0 + bar_h // 2 + r], fill=fill, outline=outline)
        version_y = 62 if state in {"done", "next"} else 18 if state == "active" else 62
        label_y = version_y + 11
        tw, _ = text_size(draw, item["version"], FONT_TINY_BOLD)
        draw.text((x - tw // 2, version_y), item["version"], font=FONT_TINY_BOLD, fill=text_fill)
        lw, _ = text_size(draw, item["label"], FONT_TINY)
        draw.text((x - lw // 2, label_y), item["label"], font=FONT_TINY, fill=DIM)


def draw_right_block(draw: ImageDraw.ImageDraw, phase: float = 0.0) -> None:
    rounded(draw, [670, 8, 792, 92], 6, (16, 20, 29), BORDER)
    draw.text((686, 17), "TARGET", font=FONT_SMALL_BOLD, fill=MUTED)
    draw.text((687, 34), "v1.0.0", font=FONT_BIG, fill=GOLD)
    draw.text((688, 56), "FINAL RELEASE", font=FONT_TINY_BOLD, fill=(255, 219, 146))

    rounded(draw, [688, 71, 774, 82], 5, TRACK, TRACK_2)
    for x in range(688, 750):
        c = lerp(RED, GOLD, (x - 688) / 62)
        draw.line([(x, 72), (x, 81)], fill=c)
    scan = 688 + round(62 * phase)
    for x in range(max(688, scan - 10), min(750, scan + 10)):
        d = abs(x - scan)
        c = lerp(GOLD, (255, 245, 211), (1.0 - d / 10) * 0.7)
        draw.line([(x, 72), (x, 81)], fill=c)
    draw.text((753, 70), "80%", font=FONT_TINY_BOLD, fill=RED_2)


def render_frame(phase: float = 0.0) -> Image.Image:
    img = Image.new("RGB", (W, H), BG_BOTTOM)
    draw = ImageDraw.Draw(img)

    draw_background(draw, phase)
    draw_left_block(draw, phase)
    draw_progress(draw, phase)
    draw_right_block(draw, phase)
    draw.rectangle([0, 0, W - 1, H - 1], outline=(48, 57, 73))
    return img


def save_static() -> None:
    img = render_frame(0.0)

    img.save(OUT, optimize=True)
    print(f"Saved {OUT.name} ({W}x{H}, {OUT.stat().st_size // 1024} KB)")


def save_gif() -> None:
    frames = []
    for idx in range(TOTAL_FRAMES):
        if idx % 2 != 0:
            continue
        phase = idx / TOTAL_FRAMES
        frames.append(render_frame(phase).quantize(colors=96))

    frames[0].save(
        OUT_GIF,
        save_all=True,
        append_images=frames[1:],
        duration=83,
        loop=0,
        optimize=True,
    )
    print(f"Saved {OUT_GIF.name} ({W}x{H}, {OUT_GIF.stat().st_size // 1024} KB)")


def main() -> None:
    save_static()
    save_gif()


if __name__ == "__main__":
    main()
