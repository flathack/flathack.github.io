#!/usr/bin/env python3
"""Generate top-view icons for solar objects used by Freelancer2D."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLATLAS_ROOT = Path("C:/Users/steve/Github/FLAtlas")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fl_config import freelancer_data, freelancer_root, output_data_dir  # noqa: E402
from extract_ship_market_data import first, parse_ini_sections  # noqa: E402

FL_ROOT = freelancer_root()
FL_DATA = freelancer_data()
ICON_SIZE = 384


def used_archetypes() -> set[str]:
    systems_path = output_data_dir(ROOT / "data") / "systems.json"
    systems = json.loads(systems_path.read_text(encoding="utf-8"))
    archetypes = {"trade_lane_ring"}
    for system in systems.values():
        for station in system.get("stations", []):
            archetype = str(station.get("archetype", "")).lower()
            if archetype:
                archetypes.add(archetype)
    return archetypes


def solar_archetypes() -> dict[str, Path]:
    found: dict[str, Path] = {}
    for section, props in parse_ini_sections(FL_DATA / "SOLAR" / "solararch.ini"):
        if section.lower() != "solar":
            continue
        nickname = first(props, "nickname").lower()
        archetype = first(props, "da_archetype")
        if nickname and archetype:
            found[nickname] = (FL_DATA / archetype.replace("\\", "/")).resolve()
    return found


def render_icon(renderer, model_path: Path, output_path: Path) -> bool:
    load_native_scene_data, render_native_scene_top_view_icon = renderer
    if not model_path.exists():
        return False
    result = load_native_scene_data(model_path)
    if not result.scene_data:
        return False
    image = render_native_scene_top_view_icon(result.scene_data, size=ICON_SIZE)
    return bool(image.save(str(output_path), "PNG"))


def main() -> None:
    sys.path.insert(0, str(FLATLAS_ROOT))
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    from PySide6.QtWidgets import QApplication
    from fl_editor.native_scene_loader import load_native_scene_data
    from fl_editor.top_view_icons import render_native_scene_top_view_icon

    app = QApplication.instance() or QApplication([])
    data_dir = output_data_dir(ROOT / "data")
    icon_dir = data_dir / "object_icons"
    icon_dir.mkdir(parents=True, exist_ok=True)
    solar = solar_archetypes()
    icons: dict[str, str] = {}
    rendered = 0
    force = "--force" in sys.argv[1:]

    for archetype in sorted(used_archetypes()):
        model_path = solar.get(archetype)
        if not model_path:
            continue
        output_path = icon_dir / f"{archetype}.png"
        if not force and output_path.exists() and output_path.stat().st_size > 100:
            icons[archetype] = f"data/object_icons/{archetype}.png"
            continue
        if render_icon((load_native_scene_data, render_native_scene_top_view_icon), model_path, output_path):
            icons[archetype] = f"data/object_icons/{archetype}.png"
            rendered += 1

    output = data_dir / "object_icons.js"
    with output.open("w", encoding="utf-8") as handle:
        handle.write("// Auto-generated object icon lookup\n")
        handle.write("// Generated from Freelancer HD solararch.ini via FLAtlas top-view renderer\n\n")
        handle.write("const FL_OBJECT_ICONS = ")
        json.dump(icons, handle, indent=2, ensure_ascii=False)
        handle.write(";\n")

    app.quit()
    print(f"Saved {len(icons)} object icons ({rendered} newly rendered) to {output}")


if __name__ == "__main__":
    main()
