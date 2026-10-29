#!/usr/bin/env python3
"""Generate FLAtlas signatures from the blue splash art, keeping existing forum URLs."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 800, 100
SCALE = 3
SW, SH = W * SCALE, H * SCALE
BASE = Path(__file__).parent / "flatlas-signature-splash.png"
OUT = Path(__file__).parent / "widget-flatlas-v2-progress.png"
OUT_GIF = Path(__file__).parent / "widget-animated-flatlas-v2-progress.gif"
FPS = 15
DURATION_S = 4
TOTAL_FRAMES = FPS * DURATION_S
TEXT = (230, 245, 255)
MUTED = (140, 182, 211)
CYAN = (66, 207, 255)


def sc(value: float) -> int:
    return round(value * SCALE)


def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    names = ["bahnschrift.ttf", "segoeuib.ttf" if bold else "segoeui.ttf", "DejaVuSans.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, sc(size))
        except OSError:
            continue
    return ImageFont.load_default(size=sc(size))


FONT_LABEL = load_font(9)
FONT_VERSION = load_font(25, bold=True)
FONT_BETA = load_font(11, bold=True)


def text(draw: ImageDraw.ImageDraw, xy, value, font, fill) -> None:
    draw.text((sc(xy[0]), sc(xy[1])), value, font=font, fill=fill, anchor="lt")


def make_background() -> Image.Image:
    source = Image.open(BASE).convert("RGB")
    # Separate crops preserve the wordmark and ship in the narrow forum format.
    image = Image.new("RGBA", (SW, SH), (1, 8, 16, 255))
    stars = source.crop((0, 0, 1000, 250)).resize((SW, SH), Image.Resampling.LANCZOS)
    image.alpha_composite(stars.convert("RGBA"))
    art = source.crop((920, 250, 2098, 750)).resize((sc(236), SH), Image.Resampling.LANCZOS)
    image.alpha_composite(art.convert("RGBA"), (sc(564), 0))
    shade = Image.new("RGBA", image.size)
    draw = ImageDraw.Draw(shade)
    for x in range(SW):
        alpha = round(215 * max(0.0, 1.0 - max(0, x / SCALE - 475) / 155))
        draw.line((x, 0, x, SH), fill=(0, 7, 15, alpha))
    image = Image.alpha_composite(image, shade)

    logo = source.crop((135, 280, 910, 490)).resize((sc(238), sc(64.5)), Image.Resampling.LANCZOS)
    mask = Image.new("L", logo.size, 255)
    md = ImageDraw.Draw(mask)
    for i in range(sc(8)):
        md.rectangle((i, i, logo.width - i - 1, logo.height - i - 1), outline=round(i / sc(8) * 255))
    image.paste(logo, (sc(17), sc(17)), mask)
    return image


BACKGROUND = make_background()


def render_frame(phase: float = 0.0) -> Image.Image:
    image = BACKGROUND.copy()
    draw = ImageDraw.Draw(image)
    draw.line((sc(273), sc(19), sc(273), sc(75)), fill=(44, 112, 150, 150), width=sc(0.6))
    text(draw, (291, 20), "CURRENT RELEASE", FONT_LABEL, MUTED)
    text(draw, (290, 38), "v0.8.9", FONT_VERSION, TEXT)
    text(draw, (292, 68), "AVAILABLE NOW", FONT_LABEL, (130, 213, 240))
    text(draw, (433, 20), "COMING SOON", FONT_LABEL, MUTED)
    text(draw, (431, 38), "v0.9.0", FONT_VERSION, TEXT)
    draw.polygon([(sc(x), sc(y)) for x, y in [(531, 40), (565, 40), (570, 45), (570, 58), (536, 58), (531, 53)]],
                 fill=(6, 37, 57), outline=CYAN, width=sc(0.6))
    text(draw, (536, 44), "BETA", FONT_BETA, (144, 231, 255))
    text(draw, (433, 68), "ALPHA TO BETA", FONT_LABEL, (130, 213, 240))

    # A looping highlight echoes the splash bar without inventing a percentage.
    glow = Image.new("RGBA", image.size)
    gd = ImageDraw.Draw(glow)
    for index in range(36):
        x = 291 + index * 7.7
        distance = abs(index / 36 - phase)
        distance = min(distance, 1 - distance)
        strength = math.exp(-((distance / 0.09) ** 2))
        color = (round(20 + 93 * strength), round(90 + 147 * strength), round(130 + 125 * strength), 255)
        box = (sc(x), sc(85), sc(x + 5.3), sc(87))
        draw.rectangle(box, fill=color)
        gd.rectangle(box, fill=(55, 202, 255, round(160 * strength)))
    image = Image.alpha_composite(image, glow.filter(ImageFilter.GaussianBlur(sc(1.6))))
    draw = ImageDraw.Draw(image)
    draw.line((sc(15), sc(98), sc(785), sc(98)), fill=(19, 102, 148, 210), width=sc(0.5))
    draw.rectangle((0, 0, SW - 1, SH - 1), outline=(32, 107, 153, 220), width=sc(0.6))
    return image.convert("RGB").resize((W, H), Image.Resampling.LANCZOS)


def main() -> None:
    render_frame(0.25).save(OUT, optimize=True)
    frames = [render_frame(index / TOTAL_FRAMES) for index in range(TOTAL_FRAMES)]
    # A shared palette keeps the stationary artwork from flickering.
    palette = frames[TOTAL_FRAMES // 4].quantize(colors=256)
    frames = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    # GIF delays use 10 ms units: 60/70/70 ms gives exactly 15 fps.
    delays = [60 if index % 3 == 0 else 70 for index in range(TOTAL_FRAMES)]
    frames[0].save(OUT_GIF, save_all=True, append_images=frames[1:], duration=delays,
                   loop=0, optimize=True, disposal=1)
    for output in (OUT, OUT_GIF):
        print(f"Saved {output.name} ({W}x{H}, {output.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
