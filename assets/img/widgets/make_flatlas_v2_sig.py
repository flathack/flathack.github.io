#!/usr/bin/env python3
"""Generate FLAtlas signatures from the blue splash art, keeping existing forum URLs."""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 800, 100
SCALE = 3
SW, SH = W * SCALE, H * SCALE
BASE = Path(__file__).parent / "flatlas-signature-splash.png"
OUT = Path(__file__).parent / "widget-flatlas-v2-progress.png"
OUT_GIF = Path(__file__).parent / "widget-animated-flatlas-v2-progress.gif"
FPS = 20
DURATION_S = 14
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


def text(draw: ImageDraw.ImageDraw, xy, value, font, fill) -> None:
    draw.text((sc(xy[0]), sc(xy[1])), value, font=font, fill=fill, anchor="lt")


def make_background(source: Image.Image | None = None) -> Image.Image:
    if source is None:
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


def render_frame(phase: float = 0.0, background: Image.Image | None = None) -> Image.Image:
    image = (BACKGROUND if background is None else background).copy()
    draw = ImageDraw.Draw(image)
    draw.line((sc(273), sc(19), sc(273), sc(75)), fill=(44, 112, 150, 150), width=sc(0.6))
    text(draw, (291, 20), "CURRENT RELEASE", FONT_LABEL, MUTED)
    text(draw, (290, 38), "v0.9.0", FONT_VERSION, TEXT)
    text(draw, (292, 68), "AVAILABLE NOW", FONT_LABEL, (130, 213, 240))
    text(draw, (433, 20), "BETA RELEASE", FONT_LABEL, MUTED)
    text(draw, (431, 38), "BETA", FONT_VERSION, TEXT)
    text(draw, (433, 68), "WINDOWS + LINUX", FONT_LABEL, (130, 213, 240))

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


def make_flight_frames() -> list[Image.Image]:
    original = Image.open(BASE).convert("RGB")
    background = make_background(Image.open(BASE.parent / "flatlas-signature-space.png").convert("RGB"))

    # Reuse the exact existing wordmark rather than generated lettering.
    logo = original.crop((135, 280, 910, 490)).resize((sc(238), sc(64.5)), Image.Resampling.LANCZOS)
    logo_mask = Image.new("L", logo.size, 255)
    md = ImageDraw.Draw(logo_mask)
    for i in range(sc(8)):
        md.rectangle((i, i, logo.width - i - 1, logo.height - i - 1), outline=round(i / sc(8) * 255))

    ship = Image.open(BASE.parent / "flatlas-signature-ship.png").convert("RGBA")
    ship = ship.crop(ship.getbbox())
    ship = ship.resize((round(ship.width * sc(70) / ship.height), sc(70)), Image.Resampling.LANCZOS)

    # The split sits just past the metal engine housings. Only the plasma changes.
    nozzle_x = round(ship.width * 0.445)
    body = ship.crop((0, 0, nozzle_x, ship.height))
    plumes = []
    for top, bottom in ((0, 94), (94, 126), (126, ship.height)):
        plume = np.asarray(ship.crop((nozzle_x, top, ship.width, bottom))).astype(np.float32)
        plumes.append((top, plume))


    def animated_ship(seconds):
        result = Image.new("RGBA", (ship.width + sc(25), ship.height))
        result.alpha_composite(body)
        glow = Image.new("RGBA", result.size)
        gd = ImageDraw.Draw(glow)
        for engine, (top, source) in enumerate(plumes):
            offset = engine * 1.4
            pulse = math.sin(math.tau * 2.5 * seconds + offset)
            flicker = math.sin(math.tau * 3.5 * seconds + offset * 1.7)
            length = 0.91 + 0.10 * pulse + 0.035 * flicker
            u = np.linspace(0, 1, source.shape[1])[None, :]
            # Brightness ripples move away from the nozzle, along the exhaust.
            ripple = np.sin(math.tau * (3 * u - 2.5 * seconds) + offset)
            brightness = 0.92 + 0.16 * pulse + 0.16 * ripple
            pixels = source.copy()
            pixels[:, :, :3] = np.clip(pixels[:, :, :3] * brightness[:, :, None], 0, 255)
            pixels[:, :, 3] *= np.clip(0.87 + 0.10 * pulse + 0.10 * ripple, 0, 1)
            plume = Image.fromarray(pixels.astype(np.uint8)).resize(
                (round(source.shape[1] * length), source.shape[0]), Image.Resampling.BICUBIC)
            # Slight waves at the far end keep the nozzle itself perfectly fixed.
            for left in range(0, plume.width, 10):
                right = min(left + 10, plume.width)
                progress = left / plume.width
                shift = round(sc(0.9) * progress ** 1.3 * math.sin(
                    math.tau * (progress * 2 - 2.5 * seconds) + offset))
                result.alpha_composite(plume.crop((left, 0, right, plume.height)),
                                       (nozzle_x + left, top + shift))
            center_y = (68, 99, 135)[engine]
            radius = sc(1.6 + 0.5 * (pulse + 1))
            gd.ellipse((nozzle_x - radius, center_y - radius,
                        nozzle_x + radius, center_y + radius),
                       fill=(130, 228, 255, round(90 + 50 * (pulse + 1))))
        return Image.alpha_composite(result, glow.filter(ImageFilter.GaussianBlur(sc(1.2))))


    # Soft shading behind the version labels preserves readability as it passes.
    shade = Image.new("RGBA", background.size)
    sd = ImageDraw.Draw(shade)
    sd.rectangle((sc(282), sc(12), sc(575), sc(79)), fill=(0, 8, 18, 95))
    shade = shade.filter(ImageFilter.GaussianBlur(sc(7)))

    frames = []
    for index in range(TOTAL_FRAMES):
        phase = (index / TOTAL_FRAMES + 0.15) % 1.0
        scene = background.copy()
        scene.paste(logo, (sc(17), sc(17)), logo_mask)
        if phase < 0.88:
            x = 820 - (820 + ship.width / SCALE + 45) * phase / 0.88
            y = 15 + 1.5 * math.sin(phase * math.tau)
            scene.alpha_composite(animated_ship(index / FPS), (sc(x), sc(y)))
        scene = Image.alpha_composite(scene, shade)
        frames.append(render_frame((index / TOTAL_FRAMES * 3) % 1.0, scene))

    return frames


def main() -> None:
    # Requires Pillow and NumPy; all artwork is stored beside this generator.
    frames = make_flight_frames()
    frames[0].save(OUT, optimize=True)
    # Sample the whole flight for one palette to keep the starfield stable.
    samples = Image.new("RGB", (W, H * 6))
    for row, index in enumerate(range(0, TOTAL_FRAMES, 50)):
        samples.paste(frames[index], (0, row * H))
    palette = samples.quantize(colors=256)
    indexed = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    indexed[0].save(OUT_GIF, save_all=True, append_images=indexed[1:], duration=50,
                    loop=0, optimize=True, disposal=1)
    for output in (OUT, OUT_GIF):
        print(f"Saved {output.name} ({W}x{H}, {output.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
