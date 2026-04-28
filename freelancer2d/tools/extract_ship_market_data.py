#!/usr/bin/env python3
"""Extract playable ship market data and FLAtlas top-view icons."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FL_ROOT = Path("C:/Users/steve/Github/FL-Installationen/Freelancer-HD")
FL_DATA = FL_ROOT / "DATA"
FLATLAS_ROOT = Path("C:/Users/steve/Github/FLAtlas")

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_universe_data as universe  # noqa: E402


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
            mass = to_int(first(props, "mass"), 100)
            hold_size = to_int(first(props, "hold_size"), 25)
            hit_pts = to_int(first(props, "hit_pts"), 1000)
            ship_type = first(props, "type", "FIGHTER").upper()
            fire_power = sum(1 for value in all_values(props, "hp_type") if "hp_gun" in value.lower())
            model_path = str((FL_DATA / archetype.replace("\\", "/")).resolve()) if archetype else ""
            ships[nickname] = {
                "id": nickname,
                "name": fl_text(universe.resolve_id(ids_name, nickname)),
                "info": clean_info(universe.resolve_info(ids_info)),
                "idsName": ids_name,
                "idsInfo": ids_info,
                "type": ship_type,
                "mass": mass,
                "holdSize": hold_size,
                "hitPts": hit_pts,
                "turnRate": round(max(0.9, min(2.8, ((torque[2] / max(mass, 1)) / 1400) if torque else 1.6)), 2),
                "firePower": max(1, fire_power),
                "modelPath": model_path,
            }
    return ships


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
            good = value.split(",", 1)[0].strip().lower()
            if good:
                goods.append(good)
        if goods:
            markets[base] = goods
    return markets


def render_icons(ships: dict[str, dict], package_ids: set[str], packages: dict[str, dict], hulls: dict[str, dict]) -> None:
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
    hulls, packages = extract_goods()
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
        max_speed = 260 if ship_type == "FREIGHTER" else 300
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
                "turnRate": ship["turnRate"],
                "holdSize": ship["holdSize"],
                "firePower": ship["firePower"],
            },
            "info": ship.get("info", ""),
        }

    market_payload = {
        base: [package for package in package_ids if package in package_payload]
        for base, package_ids in sorted(markets.items())
    }
    market_payload = {base: packages for base, packages in market_payload.items() if packages}

    return {
        "ships": {ship_id: ship for ship_id, ship in sorted(ships.items()) if any(p["ship"] == ship_id for p in package_payload.values())},
        "packages": package_payload,
        "markets": market_payload,
    }


def write_js(payload: dict) -> Path:
    output = ROOT / "data" / "ships.js"
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
