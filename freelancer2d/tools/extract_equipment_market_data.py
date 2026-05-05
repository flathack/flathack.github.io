#!/usr/bin/env python3
"""Extract equipment definitions and base markets from Freelancer HD market_misc.ini."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fl_config import freelancer_data, freelancer_root, output_data_dir  # noqa: E402
from extract_ship_market_data import all_values, first, fl_text, parse_ini_sections, to_int  # noqa: E402
import extract_universe_data as universe  # noqa: E402

FL_ROOT = freelancer_root()
FL_DATA = freelancer_data()


def title_from_nickname(nickname: str) -> str:
    text = re.sub(r"_(mark|mk)(\d+)", r" Mark \2", nickname, flags=re.IGNORECASE)
    text = text.replace("ge_s_", "").replace("ge_", "")
    return " ".join(part.capitalize() for part in re.split(r"[_\s]+", text) if part)


def classify_equipment(nickname: str, category: str, equipment_id: str) -> str:
    value = f"{nickname} {category} {equipment_id}".lower()
    is_mine_dropper = category in {"mine", "minedropper"} or bool(re.match(r"^mine\d+_mark\d+(?:_ammo)?$", nickname.lower()))
    if category == "power":
        return "powerplant"
    if "battery" in value:
        return "shield_battery"
    if "repair" in value or "nanobot" in value:
        return "nanobot"
    if "shield" in value:
        return "shield"
    if "thruster" in value:
        return "thruster"
    if "cm_" in value or "counter" in value:
        return "countermeasure"
    if "missile" in value or "rocket" in value or "torpedo" in value or "disruptor" in value:
        return "missile"
    if "turret" in value:
        return "turret"
    if "gun" in value:
        return "weapon"
    if is_mine_dropper:
        return "mine"
    if "ammo" in value:
        return "ammo"
    return category or "equipment"


def is_mine_dropper_item(item: dict) -> bool:
    return (
        str(item.get("category", "")).lower() == "mine"
        and not bool(item.get("combinable"))
        and bool(str(item.get("projectileArchetype", "")).strip())
    )


def mine_dropper_display_name(name: str) -> str:
    text = fl_text(name).strip()
    lowered = text.lower()
    if "dropper" in lowered or "werfer" in lowered:
        return text
    if text.endswith("-Mine"):
        return text[:-5] + "-Minen-Werfer"
    if text.endswith("-Mines"):
        return text[:-6] + "-Minen-Werfer"
    if text.endswith(" Mine"):
        return text + " Dropper"
    if text.endswith(" Mines"):
        return text[:-1] + " Dropper"
    return text + " Dropper"


def to_float(value: str, default: float = 0.0) -> float:
    try:
        return float(str(value).split(",", 1)[0].strip())
    except Exception:
        return default


def to_price(value: str, default: int = 1) -> int:
    return max(1, round(to_float(value, default)))


def good_ini_files() -> list[Path]:
    files = [FL_DATA / "EQUIPMENT" / "goods.ini"]
    files.extend(sorted(path for path in (FL_DATA / "EQUIPMENT").glob("*_good.ini") if path.name.lower() != "goods.ini"))
    return files


def extract_goods() -> dict[str, dict]:
    equipment: dict[str, dict] = {}
    for ini_path in good_ini_files():
        for section, props in parse_ini_sections(ini_path):
            if section.lower() != "good":
                continue
            category = first(props, "category").lower()
            if category in {"commodity", "shiphull", "ship"}:
                continue
            nickname = first(props, "nickname").lower()
            if not nickname:
                continue
            equipment_id = first(props, "equipment", nickname).lower()
            ids_name = first(props, "ids_name")
            ids_info = first(props, "ids_info")
            equipment[nickname] = {
                "id": nickname,
                "equipmentId": equipment_id,
                "name": fl_text(universe.resolve_id(ids_name, title_from_nickname(nickname))) if ids_name else fl_text(title_from_nickname(nickname)),
                "category": classify_equipment(nickname, category, equipment_id),
                "rawCategory": category,
                "price": to_price(first(props, "price"), 1),
                "idsName": ids_name,
                "idsInfo": ids_info,
                "info": universe.resolve_info(ids_info) if ids_info else "",
                "itemIcon": first(props, "item_icon"),
                "shopArchetype": first(props, "shop_archetype"),
                "materialLibrary": first(props, "material_library"),
                "combinable": first(props, "combinable", "false").lower() == "true",
                "priceSource": ini_path.name,
            }
    return equipment


def equipment_item_for_archetype(equipment: dict[str, dict], archetype_id: str) -> dict | None:
    key = archetype_id.lower()
    if key in equipment:
        return equipment[key]
    for item in equipment.values():
        if str(item.get("equipmentId", "")).lower() == key:
            return item
    return None


def enrich_from_equipment_files(equipment: dict[str, dict]) -> dict[str, dict]:
    for ini_path in sorted((FL_DATA / "EQUIPMENT").glob("*.ini")):
        if ini_path.name.lower() in {"goods.ini", "market_misc.ini", "market_commodities.ini", "market_ships.ini"}:
            continue
        sections = parse_ini_sections(ini_path)
        explosions: dict[str, dict] = {}
        motors: dict[str, dict] = {}
        for section, props in sections:
            nickname = first(props, "nickname").lower()
            if not nickname:
                continue
            if section.lower() == "explosion":
                explosions[nickname] = {
                    "explosionRadius": to_float(first(props, "radius"), 0),
                    "explosionHullDamage": to_float(first(props, "hull_damage"), 0),
                    "explosionEnergyDamage": to_float(first(props, "energy_damage"), 0),
                    "explosionImpulse": to_float(first(props, "impulse"), 0),
                }
            elif section.lower() == "motor":
                motors[nickname] = {
                    "motorLifetime": to_float(first(props, "lifetime"), 0),
                    "motorAccel": to_float(first(props, "accel"), 0),
                    "motorDelay": to_float(first(props, "delay"), 0),
                }
        munitions: dict[str, dict] = {}
        for section, props in sections:
            section_name = section.lower()
            if section_name not in {"munition", "mine", "countermeasure"}:
                continue
            nickname = first(props, "nickname").lower()
            if not nickname:
                continue
            explosion_arch = first(props, "explosion_arch").lower()
            motor = first(props, "motor").lower()
            munition = {
                "hullDamage": to_float(first(props, "hull_damage"), 0),
                "energyDamage": to_float(first(props, "energy_damage"), 0),
                "weaponType": first(props, "weapon_type"),
                "projectileLifetime": to_float(first(props, "lifetime"), 0),
                "requiresAmmo": first(props, "requires_ammo", "false").lower() == "true",
                "munitionHitEffect": first(props, "munition_hit_effect"),
                "constEffect": first(props, "const_effect"),
                "explosionArchetype": explosion_arch,
                "detonationDist": to_float(first(props, "detonation_dist"), 0),
                "seeker": first(props, "seeker"),
                "seekerRange": to_float(first(props, "seeker_range"), 0),
                "seekerFovDeg": to_float(first(props, "seeker_fov_deg"), 0),
                "maxAngularVelocity": to_float(first(props, "max_angular_velocity"), 0),
                "ownerSafeTime": to_float(first(props, "owner_safe_time"), 0),
                "seekDist": to_float(first(props, "seek_dist"), 0),
                "topSpeed": to_float(first(props, "top_speed"), 0),
                "acceleration": to_float(first(props, "acceleration"), 0),
                "linearDrag": to_float(first(props, "linear_drag"), 0),
                "motor": motor,
                **explosions.get(explosion_arch, {}),
                **motors.get(motor, {}),
            }
            if section_name == "countermeasure":
                munition["countermeasureRange"] = to_float(first(props, "range"), 0)
                munition["diversionPctg"] = to_float(first(props, "diversion_pctg"), 0)
            munitions[nickname] = munition
        for section, props in sections:
            if section.lower() == "good":
                continue
            nickname = first(props, "nickname").lower()
            if not nickname:
                continue
            ids_name = first(props, "ids_name")
            ids_info = first(props, "ids_info")
            category = classify_equipment(nickname, section.lower(), nickname)
            item = equipment_item_for_archetype(equipment, nickname) or {
                "id": nickname,
                "equipmentId": nickname,
                "name": fl_text(universe.resolve_id(ids_name, title_from_nickname(nickname))),
                "category": category,
                "rawCategory": section.lower(),
                "price": 500,
                "itemIcon": "",
                "combinable": category in {"ammo", "nanobot", "shield_battery"},
                "priceSource": "fallback",
            }
            if ids_name:
                item["name"] = fl_text(universe.resolve_id(ids_name, item["name"]))
            item["idsName"] = ids_name
            item["idsInfo"] = ids_info
            item["info"] = universe.resolve_info(ids_info)
            item["category"] = category
            item["hitPts"] = to_int(first(props, "hit_pts"), item.get("hitPts", 0))
            item["powerUsage"] = to_float(first(props, "power_usage"), item.get("powerUsage", 0))
            item["refireDelay"] = to_float(first(props, "refire_delay"), item.get("refireDelay", 0))
            item["muzzleVelocity"] = to_float(first(props, "muzzle_velocity"), item.get("muzzleVelocity", 0))
            item["projectileArchetype"] = first(props, "projectile_archetype", item.get("projectileArchetype", ""))
            item["capacity"] = to_float(first(props, "capacity"), item.get("capacity", 0))
            item["chargeRate"] = to_float(first(props, "charge_rate"), item.get("chargeRate", 0))
            item["shieldCapacity"] = to_float(first(props, "max_capacity"), item.get("shieldCapacity", 0))
            item["shieldRegenRate"] = to_float(first(props, "regeneration_rate"), item.get("shieldRegenRate", 0))
            item["shieldOfflineRebuildTime"] = to_float(first(props, "offline_rebuild_time"), item.get("shieldOfflineRebuildTime", 0))
            item["shieldOfflineThreshold"] = to_float(first(props, "offline_threshold"), item.get("shieldOfflineThreshold", 0))
            item["shieldConstantPowerDraw"] = to_float(first(props, "constant_power_draw"), item.get("shieldConstantPowerDraw", 0))
            item["shieldRebuildPowerDraw"] = to_float(first(props, "rebuild_power_draw"), item.get("shieldRebuildPowerDraw", 0))
            item["shieldType"] = first(props, "shield_type", item.get("shieldType", ""))
            item["thrustCapacity"] = to_float(first(props, "thrust_capacity"), item.get("thrustCapacity", 0))
            item["thrustChargeRate"] = to_float(first(props, "thrust_charge_rate"), item.get("thrustChargeRate", 0))
            item["maxForce"] = to_float(first(props, "max_force"), item.get("maxForce", 0))
            item["linearDrag"] = to_float(first(props, "linear_drag"), item.get("linearDrag", 0))
            item["reverseFraction"] = to_float(first(props, "reverse_fraction"), item.get("reverseFraction", 0))
            item["cruiseChargeTime"] = to_float(first(props, "cruise_charge_time"), item.get("cruiseChargeTime", 0))
            item["cruisePowerUsage"] = to_float(first(props, "cruise_power_usage"), item.get("cruisePowerUsage", 0))
            if category == "scanner":
                item["scannerRange"] = to_float(first(props, "range"), item.get("scannerRange", 0))
                item["cargoScanRange"] = to_float(first(props, "cargo_scan_range"), item.get("cargoScanRange", 0))
            if category == "tractor":
                item["tractorRange"] = to_float(first(props, "max_length"), item.get("tractorRange", 0))
                item["tractorReachSpeed"] = to_float(first(props, "reach_speed"), item.get("tractorReachSpeed", 0))
            munition = munitions.get(str(item.get("projectileArchetype", "")).lower()) or munitions.get(nickname)
            if munition:
                item.update(munition)
            if is_mine_dropper_item(item):
                item["name"] = mine_dropper_display_name(item.get("name", title_from_nickname(nickname)))
            item["sourceFile"] = ini_path.name
            equipment[item["id"]] = item
    return equipment


def extract_markets(equipment: dict[str, dict]) -> dict[str, list[dict]]:
    markets: dict[str, list[dict]] = {}
    for section, props in parse_ini_sections(FL_DATA / "EQUIPMENT" / "market_misc.ini"):
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
            item_id = parts[0].lower()
            item = equipment.get(item_id)
            if not item:
                item = {
                    "id": item_id,
                    "equipmentId": item_id,
                    "name": title_from_nickname(item_id),
                    "category": classify_equipment(item_id, "equipment", item_id),
                    "rawCategory": "market_misc",
                    "price": 500 + to_int(parts[1]) * 250,
                    "itemIcon": "",
                    "combinable": item_id.endswith("_ammo") or "battery" in item_id or "repair" in item_id,
                    "priceSource": "fallback",
                }
                equipment[item_id] = item
            min_stock = to_int(parts[3])
            max_stock = to_int(parts[4])
            multiplier = to_float(parts[6], 1.0)
            entries.append({
                "id": item_id,
                "price": max(1, round(item["price"] * multiplier)),
                "rank": to_int(parts[1]),
                "reputation": to_float(parts[2], -1),
                "stockMin": min_stock,
                "stockMax": max_stock,
                "forSale": max_stock > 0,
            })
        if entries:
            markets[base] = entries
    return markets


def write_js(equipment: dict[str, dict], markets: dict[str, list[dict]]) -> Path:
    output = output_data_dir(ROOT / "data") / "equipment.js"
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        handle.write("// Auto-generated equipment market data\n")
        handle.write("// Generated from Freelancer HD goods.ini and market_misc.ini\n\n")
        handle.write("const FL_EQUIPMENT = ")
        json.dump(dict(sorted(equipment.items())), handle, indent=2, ensure_ascii=False)
        handle.write(";\n\nconst FL_BASE_EQUIPMENT_MARKETS = ")
        json.dump(dict(sorted(markets.items())), handle, indent=2, ensure_ascii=False)
        handle.write(";\n")
    return output


def main() -> None:
    universe.RESOURCE_STRINGS = universe.load_resource_strings()
    universe.RESOURCE_INFOCARDS = universe.load_resource_infocards()
    equipment = extract_goods()
    equipment = enrich_from_equipment_files(equipment)
    markets = extract_markets(equipment)
    output = write_js(equipment, markets)
    print(f"Saved {len(equipment)} equipment goods for {len(markets)} bases to {output}")


if __name__ == "__main__":
    main()
