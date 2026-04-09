"""Export purchasable Freelancer equipment data to JSON for the web equipment explorer.

Usage: python export_equipment_data.py
Output: ../data/equipment/<mod-id>.json for each configured installation.
"""
from __future__ import annotations

import json
from pathlib import Path

from export_trade_data import (
    EN_INSTALL_PATH,
    INSTALLATIONS,
    SCRIPT_DIR,
    DLLResolver,
    extract_bases,
    extract_systems,
    enrich_bases,
    find_data_files,
    get_dll_paths,
    parse_ini,
)


OUTPUT_DIR = SCRIPT_DIR.parent / "data" / "equipment"
VALID_CATEGORIES = {
    "weapon",
    "shield",
    "thruster",
    "mine",
    "missile",
    "countermeasure",
    "scanner",
    "tractor",
    "armor",
    "nanobot",
    "battery",
}


def parse_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value.strip())
    except (AttributeError, ValueError):
        return default


def parse_int(value: str, default: int = 0) -> int:
    try:
        return int(float(value.strip()))
    except (AttributeError, ValueError):
        return default


def fallback_item_name(nick: str) -> str:
    raw = nick.strip().lower()
    for prefix in ("ge_", "li_", "br_", "rh_", "ku_", "co_", "gd_", "fc_"):
        if raw.startswith(prefix) and raw.count("_") >= 2:
            raw = raw.split("_", 2)[2]
            break
    return " ".join(part.capitalize() for part in raw.split("_") if part) or nick


def classify_item(section_name: str, nick: str) -> str:
    sec = (section_name or "").strip().lower()
    lower_nick = (nick or "").strip().lower()
    joined = sec + " " + lower_nick

    if "repairkit" in joined or "nanobot" in joined or lower_nick == "ge_s_repair_01":
        return "nanobot"
    if "shieldbattery" in joined or lower_nick == "ge_s_battery_01":
        return "battery"
    if "countermeasure" in joined or "cm_" in lower_nick:
        return "countermeasure"
    if "thruster" in joined:
        return "thruster"
    if "scanner" in joined:
        return "scanner"
    if "tractor" in joined:
        return "tractor"
    if "armor" in joined:
        return "armor"
    if "shield" in joined and "battery" not in joined:
        return "shield"
    if "mine" in joined:
        return "mine"
    if "missile" in joined or "torpedo" in joined or "cruise_disruptor" in joined:
        return "missile"
    if "gun" in joined or "turret" in joined or "launcher" in joined:
        return "weapon"
    return ""


def item_stats(vals: dict[str, str]) -> dict[str, float | str]:
    stats: dict[str, float | str] = {}
    numeric_keys = {
        "hull_damage",
        "energy_damage",
        "refire_delay",
        "shield_capacity",
        "power_usage",
        "range",
        "max_range",
        "cruise_disruptor_range",
        "lootable",
        "linear_drag",
        "max_force",
        "hit_pts",
    }
    string_keys = {"hp_type", "loot_appearance", "munition_hp_type"}
    for key in numeric_keys:
        if key in vals:
            stats[key] = parse_float(vals[key])
    for key in string_keys:
        if key in vals and vals[key].strip():
            stats[key] = vals[key].strip()
    return stats


def extract_item_defs(equip_files: list[Path], res: DLLResolver) -> dict[str, dict]:
    items: dict[str, dict] = {}
    for equip_file in equip_files:
        for sec, entries in parse_ini(equip_file):
            vals = {k.lower(): v.strip() for k, v in entries}
            nick = vals.get("nickname", "").lower()
            if not nick:
                continue
            category = classify_item(sec, nick)
            if category not in VALID_CATEGORIES:
                continue
            ids = vals.get("ids_name") or vals.get("strid_name") or ""
            name = res.get(ids) if ids else ""
            items[nick] = {
                "nick": nick,
                "name": name or fallback_item_name(nick),
                "category": category,
                "subcategory": sec.lower(),
                "price": 0,
                "stats": item_stats(vals),
                "offers": [],
            }
    return items


def extract_goods_catalog(goods_files: list[Path], res: DLLResolver) -> tuple[dict[str, dict], dict[str, dict]]:
    goods_map: dict[str, dict] = {}
    items_from_goods: dict[str, dict] = {}
    for goods_file in goods_files:
        for sec, entries in parse_ini(goods_file):
            if sec.lower() != "good":
                continue
            vals = {k.lower(): v.strip() for k, v in entries}
            good_nick = vals.get("nickname", "").lower()
            if not good_nick:
                continue
            item_nick = vals.get("equipment", "").lower() or good_nick
            category = classify_item("", item_nick) or classify_item("", good_nick)
            if category not in VALID_CATEGORIES:
                continue
            ids = vals.get("ids_name") or vals.get("strid_name") or ""
            price = parse_int(vals.get("price", "0"), 0)
            name = res.get(ids) if ids else ""
            goods_map[good_nick] = {
                "good_nick": good_nick,
                "item_nick": item_nick,
                "price": price,
                "name": name or fallback_item_name(item_nick),
                "category": category,
            }
            existing = items_from_goods.get(item_nick)
            if existing and existing.get("price", 0) >= price > 0:
                continue
            items_from_goods[item_nick] = {
                "nick": item_nick,
                "name": name or fallback_item_name(item_nick),
                "category": category,
                "subcategory": "good",
                "price": price,
                "stats": {},
                "offers": [],
            }
    return goods_map, items_from_goods


def merge_item_catalog(def_items: dict[str, dict], goods_items: dict[str, dict]) -> dict[str, dict]:
    merged = {nick: dict(item) for nick, item in def_items.items()}
    for nick, item in goods_items.items():
        if nick not in merged:
            merged[nick] = dict(item)
            continue
        if not merged[nick].get("name") and item.get("name"):
            merged[nick]["name"] = item["name"]
        if not merged[nick].get("price") and item.get("price"):
            merged[nick]["price"] = item["price"]
        if not merged[nick].get("category") and item.get("category"):
            merged[nick]["category"] = item["category"]
    return merged


def extract_market_offers(
    market_files: list[Path],
    bases: dict[str, dict],
    goods_map: dict[str, dict],
    items: dict[str, dict],
) -> tuple[dict[str, dict], dict[str, dict]]:
    bases_index: dict[str, dict] = {}
    for market_file in market_files:
        if market_file.name.lower() != "market_misc.ini":
            continue
        for sec, entries in parse_ini(market_file):
            if sec.lower() != "basegood":
                continue
            base_nick = ""
            for key, value in entries:
                if key.lower() == "base":
                    base_nick = value.strip().lower()
                    break
            if not base_nick or base_nick not in bases:
                continue

            base_info = bases[base_nick]
            for key, value in entries:
                if key.lower() != "marketgood":
                    continue
                fields = [field.strip() for field in value.split(",")]
                if not fields:
                    continue
                market_nick = fields[0].lower()
                if len(fields) >= 5 and fields[3] == "0" and fields[4] == "0":
                    continue

                mapping = goods_map.get(market_nick)
                item_nick = (mapping or {}).get("item_nick", market_nick)
                item = items.get(item_nick)
                if not item or item.get("category") not in VALID_CATEGORIES:
                    continue

                price = (mapping or {}).get("price") or item.get("price") or 0
                offer = {
                    "base": base_nick,
                    "baseName": base_info.get("name", base_nick),
                    "system": base_info.get("sys", ""),
                    "systemName": "",
                    "faction": base_info.get("faction", ""),
                    "price": price,
                }
                item.setdefault("offers", []).append(offer)
                bases_index.setdefault(
                    base_nick,
                    {
                        "base": base_nick,
                        "baseName": base_info.get("name", base_nick),
                        "system": base_info.get("sys", ""),
                        "faction": base_info.get("faction", ""),
                        "offers": [],
                    },
                )
                bases_index[base_nick]["offers"].append(item_nick)

    for item in items.values():
        item["offers"].sort(
            key=lambda offer: (
                offer.get("systemName") or offer.get("system") or "",
                offer.get("baseName") or offer.get("base") or "",
                offer.get("price", 0),
            )
        )

    for base in bases_index.values():
        base["offers"] = sorted(set(base["offers"]))
    return items, bases_index


def enrich_system_names(items: dict[str, dict], bases_index: dict[str, dict], systems: dict[str, dict]) -> None:
    for item in items.values():
        for offer in item.get("offers", []):
            system_nick = (offer.get("system") or "").upper()
            offer["systemName"] = systems.get(system_nick, {}).get("name", system_nick)
    for base in bases_index.values():
        system_nick = (base.get("system") or "").upper()
        base["systemName"] = systems.get(system_nick, {}).get("name", system_nick)


def filter_unsold_items(items: dict[str, dict]) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for nick, item in items.items():
        if item.get("offers"):
            result[nick] = item
    return result


def build_output(inst: dict, items: dict[str, dict], bases_index: dict[str, dict], systems: dict[str, dict]) -> dict:
    total_offers = sum(len(item.get("offers", [])) for item in items.values())
    systems_with_offers = {
        (offer.get("system") or "").upper()
        for item in items.values()
        for offer in item.get("offers", [])
        if offer.get("system")
    }
    return {
        "id": inst["id"],
        "name": inst["name"],
        "summary": {
            "items": len(items),
            "offers": total_offers,
            "bases": len(bases_index),
            "systems": len(systems_with_offers),
        },
        "items": dict(sorted(items.items(), key=lambda entry: (entry[1].get("name", entry[0]), entry[0]))),
        "bases": dict(sorted(bases_index.items(), key=lambda entry: (entry[1].get("systemName", ""), entry[1].get("baseName", entry[0])))),
    }


def enrich_vanilla_english(data: dict) -> None:
    if not EN_INSTALL_PATH.exists():
        return
    en_fl_ini = EN_INSTALL_PATH / "EXE" / "Freelancer.ini"
    if not en_fl_ini.exists():
        en_fl_ini = EN_INSTALL_PATH / "EXE" / "freelancer.ini"
    if not en_fl_ini.exists():
        return

    en_sections = parse_ini(en_fl_ini)
    en_res = DLLResolver(get_dll_paths(en_fl_ini, en_sections))
    try:
        goods_files = find_data_files(en_fl_ini, en_sections, "goods")
        equip_files = find_data_files(en_fl_ini, en_sections, "equipment")
        universe_files = find_data_files(en_fl_ini, en_sections, "universe")
        universe_file = universe_files[0] if universe_files else None
        en_goods_map, en_goods_items = extract_goods_catalog(goods_files, en_res)
        en_defs = extract_item_defs(equip_files, en_res)
        en_items = merge_item_catalog(en_defs, en_goods_items)

        if universe_file:
            en_systems = extract_systems(universe_file, en_res)
            en_bases = extract_bases(universe_file, en_res)
            enrich_bases(universe_file, en_systems, en_bases)
        else:
            en_systems = {}
            en_bases = {}

        for nick, item in (data.get("items") or {}).items():
            en_item = en_items.get(nick, {})
            en_name = en_item.get("name", "")
            if en_name and en_name != item.get("name"):
                item["nameEn"] = en_name
            for offer in item.get("offers", []):
                base_nick = (offer.get("base") or "").lower()
                system_nick = (offer.get("system") or "").upper()
                en_base = en_bases.get(base_nick, {})
                en_sys = en_systems.get(system_nick, {})
                if en_base.get("name") and en_base.get("name") != offer.get("baseName"):
                    offer["baseNameEn"] = en_base["name"]
                if en_sys.get("name") and en_sys.get("name") != offer.get("systemName"):
                    offer["systemNameEn"] = en_sys["name"]

        for base in (data.get("bases") or {}).values():
            base_nick = (base.get("base") or "").lower()
            system_nick = (base.get("system") or "").upper()
            en_base = en_bases.get(base_nick, {})
            en_sys = en_systems.get(system_nick, {})
            if en_base.get("name") and en_base.get("name") != base.get("baseName"):
                base["baseNameEn"] = en_base["name"]
            if en_sys.get("name") and en_sys.get("name") != base.get("systemName"):
                base["systemNameEn"] = en_sys["name"]
    finally:
        en_res.close()


def export_installation(inst: dict) -> None:
    inst_path: Path = inst["path"]
    fl_ini = inst_path / "EXE" / "freelancer.ini"
    if not fl_ini.exists():
        fl_ini = inst_path / "EXE" / "Freelancer.ini"
    if not fl_ini.exists():
        print(f"  ERROR: freelancer.ini not found in {inst_path / 'EXE'}")
        return

    sections = parse_ini(fl_ini)
    res = DLLResolver(get_dll_paths(fl_ini, sections))
    try:
        goods_files = find_data_files(fl_ini, sections, "goods")
        equip_files = find_data_files(fl_ini, sections, "equipment")
        market_files = find_data_files(fl_ini, sections, "markets")
        universe_files = find_data_files(fl_ini, sections, "universe")
        universe_file = universe_files[0] if universe_files else None
        if not universe_file:
            print("  ERROR: No universe file found")
            return

        systems = extract_systems(universe_file, res)
        bases = extract_bases(universe_file, res)
        enrich_bases(universe_file, systems, bases)

        item_defs = extract_item_defs(equip_files, res)
        goods_map, goods_items = extract_goods_catalog(goods_files, res)
        items = merge_item_catalog(item_defs, goods_items)
        items, bases_index = extract_market_offers(market_files, bases, goods_map, items)
        items = filter_unsold_items(items)
        enrich_system_names(items, bases_index, systems)

        data = build_output(inst, items, bases_index, systems)
        if inst["id"] == "vanilla":
            enrich_vanilla_english(data)

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_file = OUTPUT_DIR / f"{inst['id']}.json"
        with open(out_file, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))

        size_kb = out_file.stat().st_size / 1024
        print(f"  -> {out_file.name} ({size_kb:.1f} KB)")
        print(
            f"    Items: {data['summary']['items']}, Offers: {data['summary']['offers']}, "
            f"Bases: {data['summary']['bases']}, Systems: {data['summary']['systems']}"
        )
    finally:
        res.close()


def main() -> None:
    print("Exporting equipment data...\n")
    for inst in INSTALLATIONS:
        print(f"[{inst['name']}] {inst['path']}")
        if not inst["path"].exists():
            print("  SKIP: Path does not exist")
            continue
        export_installation(inst)
        print()
    print("Done!")


if __name__ == "__main__":
    main()