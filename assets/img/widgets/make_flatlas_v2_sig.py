#!/usr/bin/env python3
"""Generate modern flat FL Atlas V2 forum signatures."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


W, H = 800, 100
SCALE = 3
SW, SH = W * SCALE, H * SCALE
BASE = Path(__file__).parent / "flatlas-v2-signature-bg.png"
OUT = Path(__file__).parent / "widget-flatlas-v2-progress.png"
OUT_GIF = Path(__file__).parent / "widget-animated-flatlas-v2-progress.gif"
FPS = 12
DURATION_S = 3
TOTAL_FRAMES = FPS * DURATION_S

TEXT = (237, 247, 255)
MUTED = (132, 174, 210)
DIM = (82, 119, 154)
CYAN = (74, 197, 255)
CYAN_SOFT = (112, 222, 255)
GREEN = (77, 230, 151)
RED = (255, 94, 124)
GOLD = (255, 211, 104)

MILESTONES = [
    {"version": "v0.8.7", "label": "released", "pct": 87, "state": "done"},
    {"version": "v0.9.0", "label": "in progress", "pct": 90, "state": "active"},
    {"version": "v1.0.0", "label": "final", "pct": 100, "state": "final"},
]


def load_font(names: list[str], size: int) -> ImageFont.ImageFont:
    for name in names:
        try:
            return ImageFont.truetype(name, size * SCALE)
        except OSError:
            continue
    return ImageFont.load_default()


FONT_BRAND = load_font(["segoeuib.ttf", "arialbd.ttf"], 18)
FONT_LABEL = load_font(["segoeui.ttf", "arial.ttf"], 8)
FONT_LABEL_BOLD = load_font(["segoeuib.ttf", "arialbd.ttf"], 8)
FONT_BODY = load_font(["segoeui.ttf", "arial.ttf"], 10)
FONT_MONO = load_font(["consolab.ttf", "consola.ttf", "arialbd.ttf"], 12)
FONT_BIG = load_font(["consolab.ttf", "arialbd.ttf"], 21)


def sc(value: int | float) -> int:
    return round(value * SCALE)


def rgba(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return color + (alpha,)


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def rounded(draw: ImageDraw.ImageDraw, box: list[int], radius: int, fill, outline=None, width: int = 1) -> None:
    draw.rounded_rectangle([sc(v) for v in box], radius=sc(radius), fill=fill, outline=outline, width=sc(width))


def text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, font: ImageFont.ImageFont, fill) -> None:
    draw.text((sc(xy[0]), sc(xy[1])), value, font=font, fill=fill)


def make_background(phase: float) -> Image.Image:
    src = Image.open(BASE).convert("RGB")
    src_ratio = src.width / src.height
    target_ratio = W / H
    if src_ratio > target_ratio:
      crop_h = src.height
      crop_w = round(crop_h * target_ratio)
      # Keep the planet glow on the right, with calm negative space on the left.
      left = min(src.width - crop_w, round(src.width * 0.25))
      top = 0
    else:
      crop_w = src.width
      crop_h = round(crop_w / target_ratio)
      left = 0
      top = max(0, round(src.height * 0.34) - crop_h // 2)
    crop = src.crop((left, top, left + crop_w, top + crop_h))
    bg = crop.resize((SW, SH), Image.LANCZOS)
    bg = ImageEnhance.Color(bg).enhance(0.92)
    bg = ImageEnhance.Contrast(bg).enhance(0.92)
    bg = bg.filter(ImageFilter.GaussianBlur(sc(0.45)))

    overlay = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x in range(SW):
        t = x / max(1, SW - 1)
        shade = int(150 - 54 * t)
        draw.line([(x, 0), (x, SH)], fill=(0, 8, 19, shade))
    draw.rectangle([0, 0, SW, SH], fill=(2, 11, 25, 74))

    # A very restrained sweep in the animated variant.
    sweep_x = round((phase % 1) * SW)
    for x in range(max(0, sweep_x - sc(18)), min(SW, sweep_x + sc(18))):
        strength = int((1 - abs(x - sweep_x) / sc(18)) * 22)
        draw.line([(x, 0), (x, SH)], fill=(82, 202, 255, strength))

    # Thin flat brand line inspired by the splash screen.
    draw.line([(0, SH - sc(2)), (SW, SH - sc(2))], fill=(30, 148, 230, 155), width=sc(1))
    return Image.alpha_composite(bg.convert("RGBA"), overlay)


def draw_brand(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle([sc(18), sc(19), sc(21), sc(80)], fill=rgba(CYAN, 230))
    text(draw, (32, 18), "FL ATLAS V2", FONT_BRAND, TEXT)
    text(draw, (33, 41), "current", FONT_LABEL_BOLD, rgba(MUTED, 245))
    text(draw, (33, 55), "v0.8.7", FONT_MONO, rgba(GREEN, 255))
    rounded(draw, [112, 51, 176, 70], 3, (9, 52, 43, 202), (84, 230, 155, 150))
    tw, th = text_size(draw, "RELEASED", FONT_LABEL_BOLD)
    draw.text((sc(144) - tw // 2, sc(56)), "RELEASED", font=FONT_LABEL_BOLD, fill=rgba(GREEN, 255))


def draw_progress(draw: ImageDraw.ImageDraw, phase: float) -> None:
    panel = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    pd = ImageDraw.Draw(panel)
    rounded(pd, [196, 15, 653, 84], 7, (2, 13, 29, 166), (74, 197, 255, 70))
    panel = panel.filter(ImageFilter.GaussianBlur(sc(0.2)))
    draw._image.alpha_composite(panel)

    text(draw, (216, 19), "ROAD TO v1.0.0", FONT_LABEL_BOLD, rgba(CYAN_SOFT, 245))
    text(draw, (216, 34), "v0.9.0 in progress after v0.8.7 release", FONT_BODY, rgba(MUTED, 235))

    x0, y0 = 216, 60
    bar_w, bar_h = 412, 7
    rounded(draw, [x0, y0, x0 + bar_w, y0 + bar_h], 4, (8, 28, 49, 235), (80, 156, 214, 120))

    released_w = round(bar_w * 0.87)
    active_w = round(bar_w * 0.90)
    for x in range(sc(x0), sc(x0 + released_w)):
        c = lerp((35, 161, 136), GREEN, (x - sc(x0)) / max(1, sc(released_w)))
        draw.line([(x, sc(y0 + 1)), (x, sc(y0 + bar_h - 1))], fill=rgba(c, 255), width=1)
    for x in range(sc(x0 + released_w), sc(x0 + active_w)):
        c = lerp(CYAN, RED, (x - sc(x0 + released_w)) / max(1, sc(active_w - released_w)))
        draw.line([(x, sc(y0 + 1)), (x, sc(y0 + bar_h - 1))], fill=rgba(c, 255), width=1)

    shimmer = sc(x0 + released_w) + round(sc(active_w - released_w) * phase)
    for x in range(max(sc(x0 + released_w), shimmer - sc(8)), min(sc(x0 + active_w), shimmer + sc(8))):
        amount = 1 - abs(x - shimmer) / max(1, sc(8))
        draw.line([(x, sc(y0 + 1)), (x, sc(y0 + bar_h - 1))], fill=rgba(lerp(RED, TEXT, amount * 0.6), 230), width=1)

    for item in MILESTONES:
        x = x0 + round(bar_w * item["pct"] / 100)
        color = {"done": GREEN, "active": RED, "next": MUTED, "final": GOLD}[item["state"]]
        r = 5 if item["state"] in {"active", "final", "done"} else 4
        if item["state"] == "active":
            pulse = 0.5 + 0.5 * math.sin(phase * math.tau)
            draw.ellipse([sc(x - 12 - pulse * 2), sc(y0 - 11 - pulse * 2), sc(x + 12 + pulse * 2), sc(y0 + 18 + pulse * 2)], outline=rgba(RED, 110), width=sc(1))
        draw.ellipse([sc(x - r), sc(y0 + bar_h / 2 - r), sc(x + r), sc(y0 + bar_h / 2 + r)], fill=rgba(color, 255), outline=rgba(TEXT, 210), width=sc(1))
        vy = 72 if item["state"] != "active" else 44
        tw, _ = text_size(draw, item["version"], FONT_LABEL_BOLD)
        draw.text((sc(x) - tw // 2, sc(vy)), item["version"], font=FONT_LABEL_BOLD, fill=rgba(color, 255))
        lw, _ = text_size(draw, item["label"], FONT_LABEL)
        draw.text((sc(x) - lw // 2, sc(vy + 10)), item["label"], font=FONT_LABEL, fill=rgba(DIM, 245))


def draw_target(draw: ImageDraw.ImageDraw, phase: float) -> None:
    rounded(draw, [675, 15, 782, 84], 7, (2, 13, 29, 174), (74, 197, 255, 92))
    text(draw, (690, 23), "TARGET", FONT_LABEL_BOLD, rgba(MUTED, 245))
    text(draw, (690, 38), "v1.0.0", FONT_BIG, rgba(GOLD, 255))
    text(draw, (691, 62), "FINAL RELEASE", FONT_LABEL_BOLD, rgba((255, 225, 144), 255))
    draw.line([(sc(690), sc(77)), (sc(762), sc(77))], fill=rgba((55, 119, 174), 210), width=sc(2))
    draw.line([(sc(690), sc(77)), (sc(748), sc(77))], fill=rgba(CYAN, 230), width=sc(2))
    scan = sc(690) + round(sc(58) * phase)
    draw.line([(scan, sc(73)), (scan, sc(81))], fill=rgba(TEXT, 210), width=sc(1))


def render_frame(phase: float = 0.0) -> Image.Image:
    img = make_background(phase)
    draw = ImageDraw.Draw(img, "RGBA")
    draw_brand(draw)
    draw_progress(draw, phase)
    draw_target(draw, phase)
    draw.rectangle([0, 0, SW - 1, SH - 1], outline=rgba((56, 158, 238), 180), width=sc(1))
    return img.resize((W, H), Image.Resampling.LANCZOS).convert("RGB")


def save_static() -> None:
    img = render_frame(0.0)
    img.save(OUT, optimize=True)
    print(f"Saved {OUT.name} ({W}x{H}, {OUT.stat().st_size // 1024} KB)")


def save_gif() -> None:
    frames = []
    for idx in range(TOTAL_FRAMES):
        if idx % 2:
            continue
        frames.append(render_frame(idx / TOTAL_FRAMES).quantize(colors=96))
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
