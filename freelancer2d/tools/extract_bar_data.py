#!/usr/bin/env python3
"""Extract bar NPC, rumor, and news data from Freelancer HD mission INIs."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fl_config import freelancer_data, freelancer_root, output_data_dir  # noqa: E402
from extract_ship_market_data import all_values, first, fl_text, parse_ini_sections  # noqa: E402
import extract_universe_data as universe  # noqa: E402

FL_ROOT = freelancer_root()
FL_DATA = freelancer_data()

RAW_RESOURCE_STRINGS: dict[int, str] = {}


def resolve_optional_text(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        numeric_id = int(text)
    except ValueError:
        return fl_text(text)
    resolved = universe.RESOURCE_STRINGS.get(numeric_id) or universe.RESOURCE_INFOCARDS.get(numeric_id) or RAW_RESOURCE_STRINGS.get(numeric_id)
    return fl_text(resolved or "")


def rumor_text(value: str) -> str:
    parts = [part.strip() for part in value.split(",")]
    if not parts:
        return ""
    text_id = parts[-1]
    return resolve_optional_text(text_id)


def extract_mbase_bars() -> dict[str, dict]:
    bars: dict[str, dict] = {}
    current_base = ""
    for section, props in parse_ini_sections(FL_DATA / "MISSIONS" / "mbases.ini"):
        lower_section = section.lower()
        if lower_section == "mbase":
            current_base = first(props, "nickname").lower()
            if current_base:
                bars.setdefault(current_base, {"npcs": [], "factions": [], "news": []})
            continue
        if not current_base:
            continue
        if lower_section == "basefaction":
            faction = first(props, "faction")
            if faction:
                bars[current_base]["factions"].append({
                    "id": faction,
                    "weight": first(props, "weight", ""),
                    "npcs": all_values(props, "npc"),
                })
            continue
        if lower_section != "gf_npc" or first(props, "room").lower() != "bar":
            continue
        name_id = first(props, "individual_name")
        rumors = [rumor_text(value) for value in all_values(props, "rumor") + all_values(props, "rumor_type2")]
        rumors = [text for text in rumors if text]
        bars[current_base]["npcs"].append({
            "id": first(props, "nickname"),
            "name": fl_text(universe.resolve_id(name_id, first(props, "nickname"))),
            "idsName": name_id,
            "affiliation": first(props, "affiliation"),
            "voice": first(props, "voice"),
            "rumors": rumors[:8],
        })
    return bars


def extract_news(bars: dict[str, dict]) -> dict[str, dict]:
    for section, props in parse_ini_sections(FL_DATA / "MISSIONS" / "news.ini"):
        if section.lower() != "newsitem":
            continue
        bases = [base.lower() for base in all_values(props, "base") if base]
        if not bases:
            continue
        item = {
            "icon": first(props, "icon"),
            "logo": first(props, "logo"),
            "category": resolve_optional_text(first(props, "category")),
            "headline": resolve_optional_text(first(props, "headline")),
            "text": resolve_optional_text(first(props, "text")),
        }
        if not item["headline"] and not item["text"]:
            continue
        for base in bases:
            bars.setdefault(base, {"npcs": [], "factions": [], "news": []})
            bars[base]["news"].append(item)
    for bar in bars.values():
        bar["news"] = bar["news"][:12]
    return bars


def write_js(bars: dict[str, dict]) -> Path:
    output = output_data_dir(ROOT / "data") / "bar_data.js"
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        handle.write("// Auto-generated bar NPC, rumor, and news data\n")
        handle.write("// Generated from Freelancer HD mbases.ini and news.ini\n\n")
        handle.write("const FL_BASE_BAR_DATA = ")
        json.dump(dict(sorted(bars.items())), handle, indent=2, ensure_ascii=False)
        handle.write(";\n")
    return output


def main() -> None:
    global RAW_RESOURCE_STRINGS
    universe.RESOURCE_STRINGS = universe.load_resource_strings()
    universe.RESOURCE_INFOCARDS = universe.load_resource_infocards()
    RAW_RESOURCE_STRINGS = universe.extract_string_table(universe.FL_EXE / "resources.dll")
    bars = extract_mbase_bars()
    bars = extract_news(bars)
    output = write_js(bars)
    npc_count = sum(len(bar.get("npcs", [])) for bar in bars.values())
    news_count = sum(len(bar.get("news", [])) for bar in bars.values())
    print(f"Saved bar data for {len(bars)} bases, {npc_count} NPCs, {news_count} news items to {output}")


if __name__ == "__main__":
    main()