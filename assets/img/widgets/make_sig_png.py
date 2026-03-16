"""Generate a clean, high-quality static PNG signature (no GIF artifacts)."""
from pathlib import Path
from make_sig_gif import *

img = Image.new("RGB", (W, H), BG_DARK)
draw = ImageDraw.Draw(img)

# Background gradients
for y in range(H):
    ty = y / H
    c = lerp_color(BG_BRAND, BG_BRAND_B, ty)
    draw.line([(BRAND_X, y), (BRAND_X + BRAND_W - 1, y)], fill=c)
for col_x in (PROJ1_X, PROJ2_X, PROJ3_X):
    for y in range(H):
        ty = y / H
        c = lerp_color(BG_MID, BG_DARK, ty)
        draw.line([(col_x, y), (col_x + PROJ_W - 1, y)], fill=c)

# Dividers
for dx in (BRAND_W, PROJ2_X, PROJ3_X):
    draw.line([(dx, 0), (dx, H)], fill=DIVIDER)

# Suite ring — clean, no glow / scan-dot
bcx = BRAND_X + BRAND_W // 2
bcy = H // 2 - 10
draw_arc_ring(draw, bcx, bcy, RING_R_OUT, RING_R_IN, SUITE_PCT, RED_BRIGHT, RING_TRACK)
draw.ellipse([bcx - RING_R_IN, bcy - RING_R_IN,
              bcx + RING_R_IN, bcy + RING_R_IN], fill=(30, 13, 18))

pct_str = f"{SUITE_PCT}%"
bb = draw.textbbox((0, 0), pct_str, font=font_pct_lg)
tw, th = bb[2] - bb[0], bb[3] - bb[1]
draw.text((bcx - tw // 2, bcy - th // 2 - 3), pct_str, font=font_pct_lg, fill=TEXT_WHITE)
bb2 = draw.textbbox((0, 0), "Suite", font=font_ring_sub)
tw2 = bb2[2] - bb2[0]
draw.text((bcx - tw2 // 2, bcy + th // 2 - 1), "Suite", font=font_ring_sub, fill=TEXT_MUTED)

lbl1, lbl2 = "FL ATLAS SUITE", "by flathack"
bb_l1 = draw.textbbox((0, 0), lbl1, font=font_brand)
bb_l2 = draw.textbbox((0, 0), lbl2, font=font_foot)
draw.text((bcx - (bb_l1[2] - bb_l1[0]) // 2, H - 28), lbl1, font=font_brand, fill=TEXT_MUTED)
draw.text((bcx - (bb_l2[2] - bb_l2[0]) // 2, H - 17), lbl2, font=font_foot, fill=TEXT_DIM)

# Project columns — clean gradient bars, no shimmer
for i, proj in enumerate(PROJECTS):
    col_x = BRAND_W + i * PROJ_W
    px = col_x + BAR_PAD_X
    pw = PROJ_W - BAR_PAD_X * 2

    ty_name = 18
    draw.text((px, ty_name), proj["name"], font=font_name, fill=TEXT_WHITE)
    nb = draw.textbbox((0, 0), proj["name"], font=font_name)
    vx = px + (nb[2] - nb[0]) + 8
    draw.text((vx, ty_name + 2), proj["version"], font=font_version, fill=ACCENT2)

    ty_status = ty_name + 20
    dot_col = DOT_GREEN if proj["dot"] == "green" else DOT_BLUE
    draw.ellipse([px, ty_status + 3, px + 5, ty_status + 8], fill=dot_col)
    draw.text((px + 9, ty_status), proj["status"], font=font_status, fill=TEXT_MUTED)

    ty_bar = ty_status + 18
    bar_x0 = px
    bar_x1 = px + pw - 42
    bar_fill_w = int((bar_x1 - bar_x0) * proj["pct"] / 100)

    draw_rounded_rect(draw, [bar_x0, ty_bar, bar_x1, ty_bar + BAR_H], 4, BAR_TRACK)
    if bar_fill_w > 3:
        for x in range(bar_x0, bar_x0 + bar_fill_w):
            frac = (x - bar_x0) / max(1, bar_fill_w)
            c = lerp_color(RED_BRIGHT, ACCENT2, frac)
            draw.line([(x, ty_bar + 1), (x, ty_bar + BAR_H - 1)], fill=c)
        draw_rounded_rect(draw, [bar_x0, ty_bar, bar_x0 + min(bar_fill_w, 4), ty_bar + BAR_H], 4, RED_BRIGHT)
        draw_rounded_rect(draw, [bar_x0 + bar_fill_w - 4, ty_bar, bar_x0 + bar_fill_w, ty_bar + BAR_H], 4,
                          lerp_color(RED_BRIGHT, ACCENT2, 1.0))

    draw.text((bar_x1 + 6, ty_bar - 2), f"{proj['pct']} %", font=font_pct_bar, fill=ACCENT2)

    ty_detail = ty_bar + BAR_H + 6
    draw.text((px, ty_detail), proj["detail"], font=font_detail, fill=TEXT_SUB)
    tbb = draw.textbbox((0, 0), proj["target"], font=font_detail)
    draw.text((px + pw - (tbb[2] - tbb[0]), ty_detail), proj["target"], font=font_detail, fill=TEXT_DIM)

out = Path(__file__).parent / "widget-suite.png"
img.save(out, optimize=False)
print(f"Saved {out.name} ({img.size[0]}x{img.size[1]}, {out.stat().st_size // 1024} KB, full RGB)")
