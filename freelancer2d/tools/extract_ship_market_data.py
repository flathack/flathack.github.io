#!/usr/bin/env python3
"""Extract playable ship market data and FLAtlas top-view icons."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLATLAS_ROOT = Path("C:/Users/steve/Github/FLAtlas")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fl_config import freelancer_data, freelancer_root, output_data_dir  # noqa: E402
import extract_universe_data as universe  # noqa: E402

FL_ROOT = freelancer_root()
FL_DATA = freelancer_data()


def parse_ini_sections(path: Path) -> list[tuple[str, list[tuple[str, str]]]]:
    sections: list[tuple[str, list[tuple[str, str]]]] = []
    current_name: str | None = None
    current_props: list[tuple[str, str]] = []
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith(";") or line.startswith("#"):
                continue
            if line.startswith("[") and line.endswith("]"):
                if current_name is not None:
                    sections.append((current_name, current_props))
                current_name = line[1:-1]
                current_props = []
                continue
            if "=" not in line or current_name is None:
                continue
            key, value = line.split("=", 1)
            current_props.append((key.strip().lower(), value.strip()))
    if current_name is not None:
        sections.append((current_name, current_props))
    return sections


def first(props: list[tuple[str, str]], key: str, default: str = "") -> str:
    key = key.lower()
    for prop_key, value in props:
        if prop_key == key:
            return value
    return default


def all_values(props: list[tuple[str, str]], key: str) -> list[str]:
    key = key.lower()
    return [value for prop_key, value in props if prop_key == key]


def to_int(value: str, default: int = 0) -> int:
    try:
        return int(float(value.split(",", 1)[0].strip()))
    except Exception:
        return default


def to_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value.split(",", 1)[0].strip())
    except Exception:
        return default


def to_float_triplet(value: str) -> tuple[float, float, float] | None:
    try:
        parts = [float(part.strip()) for part in value.split(",")[:3]]
    except Exception:
        return None
    if len(parts) != 3:
        return None
    return parts[0], parts[1], parts[2]


def fl_text(text: str) -> str:
    text = text or ""
    if "Ã" in text or "Â" in text:
        try:
            text = text.encode("latin-1").decode("utf-8")
        except UnicodeError:
            pass
    return text


def clean_info(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", fl_text(text)).strip()
    return text


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def derive_handling(
    ship_type: str,
    mass: int,
    linear_drag: float,
    steering_torque: tuple[float, float, float] | None,
    angular_drag: tuple[float, float, float] | None,
    rotation_inertia: tuple[float, float, float] | None,
    nudge_force: float,
    strafe_force: float,
    max_bank_angle: float,
) -> dict[str, float]:
    mass_value = max(float(mass), 1.0)
    torque = steering_torque or (24000.0, 24000.0, 58000.0)
    drag = angular_drag or (15000.0, 15000.0, 35000.0)
    inertia = rotation_inertia or (2800.0, 2800.0, 1000.0)
    yaw_response = (torque[2] / max(drag[2], 1.0)) * (100.0 / mass_value) ** 0.35
    pitch_response = (torque[0] / max(drag[0], 1.0)) * (100.0 / mass_value) ** 0.35
    inertia_penalty = clamp((1800.0 / max(inertia[2], 1.0)) ** 0.12, 0.78, 1.18)
    type_factor = 0.82 if ship_type == "FREIGHTER" else 1.0
    turn_rate = clamp((0.58 + yaw_response * 0.86) * inertia_penalty * type_factor, 0.75, 3.35)
    agility = clamp((yaw_response * 0.68 + pitch_response * 0.32) * inertia_penalty * type_factor, 0.45, 3.25)
    acceleration = clamp((max(nudge_force, 16000.0) / mass_value) / 135.0, 0.85, 4.2)
    brake_rate = clamp((max(linear_drag, 0.4) * 2.0) + (max(drag[2], 1.0) / max(torque[2], 1.0)) * 3.0, 1.5, 6.5)
    strafe_power = clamp((max(strafe_force, 10000.0) / mass_value) / 130.0, 0.55, 3.4)
    bank_factor = clamp(max_bank_angle / 35.0, 0.45, 1.25)
    return {
        "turnRate": round(turn_rate, 2),
        "agility": round(agility, 2),
        "acceleration": round(acceleration, 2),
        "brakeRate": round(brake_rate, 2),
        "strafePower": round(strafe_power, 2),
        "linearDrag": round(max(linear_drag, 0.1), 2),
        "bankFactor": round(bank_factor, 2),
    }


def load_resources() -> None:
    universe.RESOURCE_STRINGS = universe.load_resource_strings()
    universe.RESOURCE_INFOCARDS = universe.load_resource_infocards()


def extract_shiparch() -> dict[str, dict]:
    ships: dict[str, dict] = {}
    for ini_path in sorted((FL_DATA / "SHIPS").glob("*.ini")):
        for section, props in parse_ini_sections(ini_path):
            if section.lower() != "ship":
                continue
            nickname = first(props, "nickname").lower()
            if not nickname or nickname in ships:
                continue
            ids_name = first(props, "ids_name")
            ids_info = first(props, "ids_info")
            archetype = first(props, "da_archetype")
            torque = to_float_triplet(first(props, "steering_torque"))
            angular_drag = to_float_triplet(first(props, "angular_drag"))
            rotation_inertia = to_float_triplet(first(props, "rotation_inertia"))
            mass = to_int(first(props, "mass"), 100)
            ship_class = to_int(first(props, "ship_class"), 0)
            hold_size = to_int(first(props, "hold_size"), 25)
            hit_pts = to_int(first(props, "hit_pts"), 1000)
            ship_type = first(props, "type", "FIGHTER").upper()
            linear_drag = to_float(first(props, "linear_drag"), 1.0)
            nudge_force = to_float(first(props, "nudge_force"), 25000.0)
            strafe_force = to_float(first(props, "strafe_force"), 15000.0)
            max_bank_angle = to_float(first(props, "max_bank_angle"), 30.0)
            fire_power = sum(1 for value in all_values(props, "hp_type") if "hp_gun" in value.lower())
            model_path = str((FL_DATA / archetype.replace("\\", "/")).resolve()) if archetype else ""
            handling = derive_handling(ship_type, mass, linear_drag, torque, angular_drag, rotation_inertia, nudge_force, strafe_force, max_bank_angle)
            ships[nickname] = {
                "id": nickname,
                "name": fl_text(universe.resolve_id(ids_name, nickname)),
                "info": clean_info(universe.resolve_info(ids_info)),
                "idsName": ids_name,
                "idsInfo": ids_info,
                "type": ship_type,
                "shipClass": ship_class,
                "mass": mass,
                "holdSize": hold_size,
                "hitPts": hit_pts,
                "linearDrag": linear_drag,
                "steeringTorque": list(torque) if torque else None,
                "angularDrag": list(angular_drag) if angular_drag else None,
                "rotationInertia": list(rotation_inertia) if rotation_inertia else None,
                "nudgeForce": nudge_force,
                "strafeForce": strafe_force,
                "maxBankAngle": max_bank_angle,
                "handling": handling,
                "turnRate": handling["turnRate"],
                "firePower": max(1, fire_power),
                "modelPath": model_path,
            }
    return ships


def populate_ship_model_bounds(ships: dict[str, dict]) -> None:
    sys.path.insert(0, str(FLATLAS_ROOT))
    try:
        from fl_editor.native_scene_loader import load_native_scene_data
    except Exception as exc:
        print(f"Warning: FLAtlas model bounds unavailable: {exc}")
        return

    for ship in ships.values():
        model_path = Path(ship.get("modelPath", ""))
        if not model_path.exists():
            continue
        try:
            result = load_native_scene_data(model_path)
            bounds = getattr(result.scene_data, "bounds", None) if result.scene_data else None
        except Exception:
            bounds = None
        if not bounds:
            continue
        min_xyz = [round(float(value), 4) for value in bounds.min_xyz]
        max_xyz = [round(float(value), 4) for value in bounds.max_xyz]
        width = max(abs(min_xyz[0]), abs(max_xyz[0])) * 2.0
        height = max(abs(min_xyz[1]), abs(max_xyz[1])) * 2.0
        length = max(abs(min_xyz[2]), abs(max_xyz[2])) * 2.0
        radius = float(bounds.radius or 0.0)
        ship["modelBounds"] = {
            "min": min_xyz,
            "max": max_xyz,
            "radius": round(radius, 4),
            "width": round(width, 4),
            "height": round(height, 4),
            "length": round(length, 4),
        }


def extract_goods() -> tuple[dict[str, dict], dict[str, dict]]:
    hulls: dict[str, dict] = {}
    packages: dict[str, dict] = {}
    for section, props in parse_ini_sections(FL_DATA / "EQUIPMENT" / "goods.ini"):
        if section.lower() != "good":
            continue
        nickname = first(props, "nickname").lower()
        category = first(props, "category").lower()
        if not nickname:
            continue
        if category == "shiphull":
            ids_name = first(props, "ids_name")
            hulls[nickname] = {
                "id": nickname,
                "ship": first(props, "ship").lower(),
                "price": to_int(first(props, "price")),
                "name": fl_text(universe.resolve_id(ids_name, nickname)),
                "idsName": ids_name,
            }
        elif category == "ship":
            packages[nickname] = {
                "id": nickname,
                "hull": first(props, "hull").lower(),
                "addons": all_values(props, "addon"),
            }
    return hulls, packages


def load_powerplants() -> dict[str, dict]:
    powerplants: dict[str, dict] = {}
    for ini_path in sorted((FL_DATA / "EQUIPMENT").glob("*.ini")):
        if ini_path.name.lower() in {"goods.ini", "market_misc.ini", "market_commodities.ini", "market_ships.ini"}:
            continue
        for section, props in parse_ini_sections(ini_path):
            if section.lower() != "power":
                continue
            nickname = first(props, "nickname").lower()
            if not nickname:
                continue
            ids_name = first(props, "ids_name")
            ids_info = first(props, "ids_info")
            powerplants[nickname] = {
                "id": nickname,
                "name": fl_text(universe.resolve_id(ids_name, nickname)),
                "idsName": ids_name,
                "idsInfo": ids_info,
                "info": clean_info(universe.resolve_info(ids_info)),
                "capacity": to_float(first(props, "capacity"), 1000.0),
                "chargeRate": to_float(first(props, "charge_rate"), 100.0),
                "thrustCapacity": to_float(first(props, "thrust_capacity"), 1000.0),
                "thrustChargeRate": to_float(first(props, "thrust_charge_rate"), 100.0),
                "sourceFile": ini_path.name,
            }
    return powerplants


def load_engines() -> dict[str, dict]:
    engines: dict[str, dict] = {}
    for ini_path in sorted((FL_DATA / "EQUIPMENT").glob("*.ini")):
        if ini_path.name.lower() in {"goods.ini", "market_misc.ini", "market_commodities.ini", "market_ships.ini"}:
            continue
        for section, props in parse_ini_sections(ini_path):
            if section.lower() != "engine":
                continue
            nickname = first(props, "nickname").lower()
            if not nickname:
                continue
            ids_name = first(props, "ids_name")
            ids_info = first(props, "ids_info")
            engines[nickname] = {
                "id": nickname,
                "name": fl_text(universe.resolve_id(ids_name, nickname)),
                "idsName": ids_name,
                "idsInfo": ids_info,
                "info": clean_info(universe.resolve_info(ids_info)),
                "maxForce": to_float(first(props, "max_force"), 0.0),
                "linearDrag": to_float(first(props, "linear_drag"), 0.0),
                "powerUsage": to_float(first(props, "power_usage"), 0.0),
                "reverseFraction": to_float(first(props, "reverse_fraction"), 1.0),
                "cruiseChargeTime": to_float(first(props, "cruise_charge_time"), 5.0),
                "cruisePowerUsage": to_float(first(props, "cruise_power_usage"), 20.0),
                "sourceFile": ini_path.name,
            }
    return engines


def parse_addon(value: str) -> tuple[str, str, int]:
    parts = [part.strip() for part in value.split(",")]
    addon_id = parts[0].lower() if parts else ""
    hardpoint = parts[1] if len(parts) > 1 else ""
    quantity = to_int(parts[2], 1) if len(parts) > 2 else 1
    return addon_id, hardpoint, quantity


def package_powerplant(package: dict, powerplants: dict[str, dict]) -> dict | None:
    for addon in package.get("addons", []):
        addon_id, _hardpoint, _quantity = parse_addon(addon)
        if addon_id in powerplants:
            return powerplants[addon_id]
    for addon in package.get("addons", []):
        addon_id, _hardpoint, _quantity = parse_addon(addon)
        if "power" in addon_id:
            return powerplants.get(addon_id)
    return None


def package_engine(package: dict, engines: dict[str, dict]) -> dict | None:
    for addon in package.get("addons", []):
        addon_id, _hardpoint, _quantity = parse_addon(addon)
        if addon_id in engines:
            return engines[addon_id]
    for addon in package.get("addons", []):
        addon_id, _hardpoint, _quantity = parse_addon(addon)
        if "engine" in addon_id:
            return engines.get(addon_id)
    return None


def extract_markets() -> dict[str, list[str]]:
    markets: dict[str, list[str]] = {}
    for section, props in parse_ini_sections(FL_DATA / "EQUIPMENT" / "market_ships.ini"):
        if section.lower() != "basegood":
            continue
        base = first(props, "base").lower()
        if not base:
            continue
        goods = []
        for value in all_values(props, "marketgood"):
            parts = [part.strip() for part in value.split(",")]
            if len(parts) < 8 or parts[3:8] != ["1", "1", "0", "1", "1"]:
                continue
            good = parts[0].lower()
            if good:
                goods.append(good)
        if goods:
            markets[base] = goods
    return markets


def render_icons(ships: dict[str, dict], package_ids: set[str], packages: dict[str, dict], hulls: dict[str, dict]) -> None:
    if "--skip-icons" in sys.argv or os.environ.get("FREELANCER2D_SKIP_ICONS") == "1":
        return
    icon_dir = ROOT / "data" / "ship_icons"
    icon_dir.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(FLATLAS_ROOT))
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    try:
        from PySide6.QtWidgets import QApplication
        from fl_editor.native_scene_loader import load_native_scene_data
        from fl_editor.top_view_icons import render_native_scene_top_view_icon
    except Exception as exc:
        print(f"Warning: FLAtlas icon renderer unavailable: {exc}")
        return

    app = QApplication.instance() or QApplication([])
    rendered_ship_ids: set[str] = set()
    for package_id in sorted(package_ids):
        package = packages.get(package_id)
        hull = hulls.get(package.get("hull", "") if package else "")
        ship = ships.get(hull.get("ship", "") if hull else "")
        if not ship or ship["id"] in rendered_ship_ids:
            continue
        model_path = Path(ship.get("modelPath", ""))
        if not model_path.exists():
            continue
        out_path = icon_dir / f"{ship['id']}.png"
        if out_path.exists() and out_path.stat().st_size > 100:
            ship["icon"] = f"data/ship_icons/{ship['id']}.png"
            rendered_ship_ids.add(ship["id"])
            continue
        result = load_native_scene_data(model_path)
        if not result.scene_data:
            continue
        image = render_native_scene_top_view_icon(result.scene_data, size=96)
        if image.save(str(out_path), "PNG"):
            ship["icon"] = f"data/ship_icons/{ship['id']}.png"
            rendered_ship_ids.add(ship["id"])
    app.quit()


def build_payload() -> dict:
    load_resources()
    ships = extract_shiparch()
    populate_ship_model_bounds(ships)
    hulls, packages = extract_goods()
    powerplants = load_powerplants()
    engines = load_engines()
    markets = extract_markets()
    market_package_ids = {package for packages_for_base in markets.values() for package in packages_for_base}
    market_package_ids.add("gf1_package")
    render_icons(ships, market_package_ids, packages, hulls)

    package_payload: dict[str, dict] = {}
    for package_id in sorted(market_package_ids):
        package = packages.get(package_id)
        if not package:
            continue
        hull = hulls.get(package["hull"])
        ship = ships.get(hull["ship"] if hull else "")
        if not hull or not ship:
            continue
        ship_name = ship.get("name") or hull.get("name") or ship["id"]
        ship_type = ship.get("type", "FIGHTER")
        handling = ship.get("handling", {})
        powerplant = package_powerplant(package, powerplants)
        engine = package_engine(package, engines)
        max_speed = 250 if ship_type == "FREIGHTER" else 300
        max_speed = round(max_speed * clamp(0.86 + float(handling.get("agility", 1.4)) * 0.08, 0.88, 1.12))
        if ship["mass"] > 800:
            max_speed = 180
        package_payload[package_id] = {
            "id": package_id,
            "name": ship_name,
            "ship": ship["id"],
            "hull": hull["id"],
            "price": hull["price"],
            "type": ship_type,
            "icon": ship.get("icon", f"data/ship_icons/{ship['id']}.png"),
            "stats": {
                "hull": ship["hitPts"],
                "shield": max(60, round(ship["hitPts"] * 0.22)),
                "maxSpeed": max_speed,
                "turnRate": handling.get("turnRate", ship["turnRate"]),
                "agility": handling.get("agility", 1.4),
                "acceleration": handling.get("acceleration", 1.5),
                "brakeRate": handling.get("brakeRate", 3.0),
                "strafePower": handling.get("strafePower", 1.0),
                "linearDrag": handling.get("linearDrag", 1.0),
                "bankFactor": handling.get("bankFactor", 1.0),
                "holdSize": ship["holdSize"],
                "firePower": ship["firePower"],
                "mass": ship["mass"],
                "shipClass": ship.get("shipClass", 0),
                "modelBounds": ship.get("modelBounds", {}),
                "powerCapacity": round(powerplant["capacity"], 2) if powerplant else 1000,
                "powerChargeRate": round(powerplant["chargeRate"], 2) if powerplant else 100,
                "thrustCapacity": round(powerplant["thrustCapacity"], 2) if powerplant else 1000,
                "thrustChargeRate": round(powerplant["thrustChargeRate"], 2) if powerplant else 100,
            },
            "powerplant": powerplant or {},
            "engine": engine or {},
            "info": ship.get("info", ""),
        }

    market_payload = {
        base: [package for package in package_ids if package in package_payload]
        for base, package_ids in sorted(markets.items())
    }
    market_payload = {base: packages for base, packages in market_payload.items() if packages}

    return {
        "ships": {ship_id: ship for ship_id, ship in sorted(ships.items())},
        "packages": package_payload,
        "markets": market_payload,
    }


def write_js(payload: dict) -> Path:
    output = output_data_dir(ROOT / "data") / "ships.js"
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        handle.write("// Auto-generated ship market data\n")
        handle.write("// Generated from Freelancer HD goods.ini, market_ships.ini and shiparch.ini\n\n")
        handle.write("const FL_SHIPS = ")
        json.dump(payload["ships"], handle, indent=2, ensure_ascii=False)
        handle.write(";\n\nconst FL_SHIP_PACKAGES = ")
        json.dump(payload["packages"], handle, indent=2, ensure_ascii=False)
        handle.write(";\n\nconst FL_BASE_SHIP_MARKETS = ")
        json.dump(payload["markets"], handle, indent=2, ensure_ascii=False)
        handle.write(";\n")
    return output


def main() -> None:
    payload = build_payload()
    output = write_js(payload)
    print(f"Saved {len(payload['packages'])} ship packages for {len(payload['markets'])} bases to {output}")


if __name__ == "__main__":
    main()
