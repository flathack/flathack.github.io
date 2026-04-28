#!/usr/bin/env python3
"""Extract Freelancer faction reputation and empathy data."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fl_config import freelancer_data, output_data_dir  # noqa: E402
from extract_ship_market_data import all_values, first, parse_ini_sections, to_float  # noqa: E402
import extract_universe_data as universe  # noqa: E402

FL_DATA = freelancer_data()
RESOURCE_STRINGS: dict[int, str] = {}


def resolve_resource_name(value: str) -> str:
    try:
        numeric_id = int(str(value or "").strip())
    except ValueError:
        return ""
    return RESOURCE_STRINGS.get(numeric_id, "")


def parse_rep_value(value: str) -> tuple[float, str] | None:
    parts = [part.strip() for part in str(value or "").split(",")]
    if len(parts) < 2 or not parts[1]:
        return None
    return to_float(parts[0], 0), parts[1]


def parse_named_value(value: str) -> tuple[str, float] | None:
    parts = [part.strip() for part in str(value or "").split(",")]
    if len(parts) < 2 or not parts[0]:
        return None
    return parts[0], to_float(parts[1], 0)


def extract_initial_world() -> dict:
    factions: dict[str, dict] = {}
    relationships: dict[str, dict[str, float]] = {}
    for section, props in parse_ini_sections(FL_DATA / "initialworld.ini"):
        if section.lower() != "group":
            continue
        faction_id = first(props, "nickname")
        if not faction_id:
            continue
        factions[faction_id] = {
            "id": faction_id,
            "idsName": first(props, "ids_name"),
            "idsInfo": first(props, "ids_info"),
            "idsShortName": first(props, "ids_short_name"),
        }
        factions[faction_id]["name"] = resolve_resource_name(factions[faction_id]["idsName"])
        factions[faction_id]["shortName"] = resolve_resource_name(factions[faction_id]["idsShortName"])
        faction_reps: dict[str, float] = {}
        for value in all_values(props, "rep"):
            parsed = parse_rep_value(value)
            if parsed:
                rep_value, target_id = parsed
                faction_reps[target_id] = max(-1, min(1, rep_value))
        relationships[faction_id] = faction_reps
    return {"factions": factions, "relationships": relationships}


def extract_empathy() -> dict[str, dict]:
    empathy: dict[str, dict] = {}
    for section, props in parse_ini_sections(FL_DATA / "MISSIONS" / "empathy.ini"):
        if section.lower() != "repchangeeffects":
            continue
        faction_id = first(props, "group")
        if not faction_id:
            continue
        events: dict[str, float] = {}
        for value in all_values(props, "event"):
            parsed = parse_named_value(value)
            if parsed:
                event_id, event_value = parsed
                events[event_id] = event_value
        rates: dict[str, float] = {}
        for value in all_values(props, "empathy_rate"):
            parsed = parse_named_value(value)
            if parsed:
                target_id, rate_value = parsed
                rates[target_id] = rate_value
        empathy[faction_id] = {"events": events, "empathyRates": rates}
    return empathy


def write_js(data: dict) -> Path:
    output = output_data_dir(ROOT / "data") / "reputation.js"
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        handle.write("// Auto-generated faction reputation and empathy data\n")
        handle.write("// Generated from Freelancer initialworld.ini and MISSIONS/empathy.ini\n\n")
        handle.write("const FL_REPUTATION = ")
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write(";\n")
    return output


def main() -> None:
    global RESOURCE_STRINGS
    RESOURCE_STRINGS = universe.load_resource_strings()
    initial = extract_initial_world()
    data = {
        "initialPlayerFaction": "li_n_grp",
        "hostileThreshold": -0.6,
        "friendlyThreshold": 0.6,
        "factions": initial["factions"],
        "relationships": initial["relationships"],
        "empathy": extract_empathy(),
    }
    output = write_js(data)
    print(f"Saved reputation data for {len(data['factions'])} factions to {output}")


if __name__ == "__main__":
    main()