#!/usr/bin/env python3
"""Extract commodity definitions and base markets from Freelancer HD."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FL_ROOT = Path("C:/Users/steve/Github/FL-Installationen/Freelancer-HD")
FL_DATA = FL_ROOT / "DATA"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_ship_market_data import all_values, first, fl_text, parse_ini_sections, to_int  # noqa: E402


def title_from_nickname(nickname: str) -> str:
    name = re.sub(r"^commodity_", "", nickname, flags=re.IGNORECASE)
    return " ".join(part.capitalize() for part in name.split("_") if part)


def to_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value.strip())
    except Exception:
        return default


def extract_goods() -> dict[str, dict]:
    commodities: dict[str, dict] = {}
    for section, props in parse_ini_sections(FL_DATA / "EQUIPMENT" / "goods.ini"):
        if section.lower() != "good" or first(props, "category").lower() != "commodity":
            continue
        nickname = first(props, "nickname").lower()
        if not nickname:
            continue
        commodities[nickname] = {
            "id": nickname,
            "name": fl_text(title_from_nickname(nickname)),
            "basePrice": to_int(first(props, "price"), 1),
            "jumpDist": to_int(first(props, "jump_dist"), 1),
            "itemIcon": first(props, "item_icon"),
            "shopArchetype": first(props, "shop_archetype"),
        }
    return commodities


def extract_markets(commodities: dict[str, dict]) -> dict[str, list[dict]]:
    markets: dict[str, list[dict]] = {}
    for section, props in parse_ini_sections(FL_DATA / "EQUIPMENT" / "market_commodities.ini"):
        if section.lower() != "basegood":
            continue
        base = first(props, "base").lower()
        if not base:
            continue
        entries = []
        for value in all_values(props, "marketgood"):
            parts = [part.strip() for part in value.split(",")]
            if len(parts) < 7:
                continue
            commodity_id = parts[0].lower()
            commodity = commodities.get(commodity_id)
            if not commodity:
                continue
            min_stock = to_int(parts[3])
            max_stock = to_int(parts[4])
            multiplier = to_float(parts[6], 1.0)
            price = max(1, round(commodity["basePrice"] * multiplier))
            entries.append({
                "id": commodity_id,
                "price": price,
                "multiplier": multiplier,
                "stockMin": min_stock,
                "stockMax": max_stock,
                "forSale": max_stock > 0,
            })
        if entries:
            markets[base] = entries
    return markets


def write_js(commodities: dict[str, dict], markets: dict[str, list[dict]]) -> Path:
    output = ROOT / "data" / "commodities.js"
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        handle.write("// Auto-generated commodity market data\n")
        handle.write("// Generated from Freelancer HD goods.ini and market_commodities.ini\n\n")
        handle.write("const FL_COMMODITIES = ")
        json.dump(dict(sorted(commodities.items())), handle, indent=2, ensure_ascii=False)
        handle.write(";\n\nconst FL_BASE_COMMODITY_MARKETS = ")
        json.dump(dict(sorted(markets.items())), handle, indent=2, ensure_ascii=False)
        handle.write(";\n")
    return output


def main() -> None:
    commodities = extract_goods()
    markets = extract_markets(commodities)
    output = write_js(commodities, markets)
    print(f"Saved {len(commodities)} commodities for {len(markets)} bases to {output}")


if __name__ == "__main__":
    main()