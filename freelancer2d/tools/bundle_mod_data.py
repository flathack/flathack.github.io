#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from fl_config import output_data_dir

ROOT = Path(__file__).resolve().parents[1]

SOURCES = {
    "game_systems.js": ["GAME_SYSTEMS", "UNIVERSE_CONNECTIONS", "UNIVERSE_SYSTEMS", "UNIVERSE_SECTORS"],
    "ships.js": ["FL_SHIPS", "FL_SHIP_PACKAGES", "FL_BASE_SHIP_MARKETS"],
    "commodities.js": ["FL_COMMODITIES", "FL_BASE_COMMODITY_MARKETS"],
    "equipment.js": ["FL_EQUIPMENT", "FL_BASE_EQUIPMENT_MARKETS"],
    "npc_loadouts.js": ["FL_NPC_LOADOUTS", "FL_NPC_SHIPS"],
    "bar_data.js": ["FL_BASE_BAR_DATA"],
    "reputation.js": ["FL_REPUTATION"],
    "object_icons.js": ["FL_OBJECT_ICONS"],
}


def cli_value(name: str, default: str = "") -> str:
    prefix = name + "="
    for index, arg in enumerate(sys.argv[1:], start=1):
        if arg == name and index + 1 < len(sys.argv):
            return sys.argv[index + 1]
        if arg.startswith(prefix):
            return arg[len(prefix):]
    return default


def extract_const(text: str, name: str):
    match = re.search(rf"const\s+{re.escape(name)}\s*=\s*(.*?);\s*(?=const\s+|$)", text, re.S)
    if not match:
        return {} if not name.endswith("SHIPS") else []
    return json.loads(match.group(1))


def main() -> None:
    data_dir = output_data_dir(ROOT / "data")
    mod_id = cli_value("--mod-id", "crossfire")
    bundle = {}
    for filename, names in SOURCES.items():
        path = data_dir / filename
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for name in names:
            bundle[name] = extract_const(text, name)

    output = data_dir / "mod_data.js"
    output.write_text(
        "// Auto-generated Freelancer2D mod data bundle\n"
        "window.FREELANCER2D_MOD_DATA = window.FREELANCER2D_MOD_DATA || {};\n"
        f"window.FREELANCER2D_MOD_DATA[{json.dumps(mod_id)}] = {json.dumps(bundle, ensure_ascii=False, indent=2)};\n",
        encoding="utf-8",
    )
    print(f"Saved mod bundle '{mod_id}' with {len(bundle)} datasets to {output}")


if __name__ == "__main__":
    main()
