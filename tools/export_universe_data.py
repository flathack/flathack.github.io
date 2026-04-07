"""Export Freelancer universe/system data to JSON for the web-based System Viewer.

Usage:  python export_universe_data.py
Output: ../data/universe/<mod-id>.json for each configured installation.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Add the tools directory so we can import shared infrastructure
sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_trade_data import (
    INSTALLATIONS,
    DLLResolver,
    fl_hash,
    get_dll_paths,
    parse_ini,
)

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR.parent / "data" / "universe"

# Object archetype keywords that we want to show on the system map
INTERESTING_ARCHETYPES = {
    "planet", "sun", "station", "jumpgate", "jumphole",
    "gate", "base",  # Crossfire custom archetypes (nomad_gate, frgate, co_base …)
    "dock_ring", "docking_fixture", "trade_lane_ring",
    "depot", "weapons_platform", "dreadnought", "buoy", "bouy",
    "battleship", "mining", "surprise", "suprise",
}


def is_interesting(archetype: str) -> bool:
    """Check if an archetype is worth showing on the system map."""
    arch_lower = archetype.lower()
    return any(kw in arch_lower for kw in INTERESTING_ARCHETYPES)


def classify_object(archetype: str) -> str:
    """Classify an object by its archetype into a display category."""
    a = archetype.lower()
    if "sun" in a:
        return "sun"
    if "planet" in a or "moon" in a:
        return "planet"
    if "jumpgate" in a or ("gate" in a and "hole" not in a):
        return "jump_gate"
    if "jumphole" in a:
        return "jump_hole"
    if "station" in a or "base" in a or "dreadnought" in a or "battleship" in a:
        return "station"
    if "dock_ring" in a or "docking_fixture" in a:
        return "dock"
    if "trade_lane" in a:
        return "trade_lane"
    if "buoy" in a or "bouy" in a:
        return "buoy"
    if "depot" in a:
        return "depot"
    if "weapons_platform" in a:
        return "weapons_platform"
    if "mining" in a:
        return "mining"
    if "surprise" in a or "suprise" in a:
        return "surprise"
    return "other"


def parse_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value.strip())
    except (AttributeError, ValueError):
        return default


def parse_solar_meta(data_root: Path) -> dict[str, dict]:
    solararch = data_root / "SOLAR" / "solararch.ini"
    out: dict[str, dict] = {}
    if not solararch.exists():
        return out
    for sec, entries in parse_ini(solararch):
        if sec.lower() != "solar":
            continue
        vals = {k.lower(): v.strip() for k, v in entries}
        nick = vals.get("nickname", "").lower()
        if not nick:
            continue
        radius = parse_float(vals.get("solar_radius", "") or vals.get("radius", ""), 0.0)
        if radius > 0:
            out[nick] = {"radius": radius}
    return out


def parse_item_names(data_root: Path, res: DLLResolver) -> dict[str, str]:
    names: dict[str, str] = {}
    equipment_root = data_root / "EQUIPMENT"
    if not equipment_root.exists():
        return names

    for ini_path in equipment_root.rglob("*.ini"):
        try:
            sections = parse_ini(ini_path)
        except Exception:
            continue
        for _, entries in sections:
            vals = {k.lower(): v.strip() for k, v in entries}
            nick = vals.get("nickname", "").lower()
            if not nick or nick in names:
                continue
            ids = vals.get("ids_name") or vals.get("strid_name") or ""
            name = res.get(ids) if ids else ""
            if name:
                names[nick] = name
    return names


def parse_loadouts(data_root: Path, fl_sections: list[tuple[str, list[tuple[str, str]]]], item_names: dict[str, str]) -> dict[str, dict]:
    loadout_files: list[Path] = []
    for sec, entries in fl_sections:
        for key, value in entries:
            if key.lower() != "loadouts":
                continue
            rel = value.strip().replace("\\", "/")
            candidate = data_root / rel
            if candidate.exists():
                loadout_files.append(candidate)

    loadouts: dict[str, dict] = {}
    for loadout_file in loadout_files:
        for sec, entries in parse_ini(loadout_file):
            if sec.lower() != "loadout":
                continue
            nickname = ""
            equip_items: list[dict] = []
            cargo_items: list[dict] = []
            for key, value in entries:
                kl = key.lower()
                raw = value.strip()
                if kl == "nickname":
                    nickname = raw.lower()
                    continue
                parts = [p.strip() for p in raw.split(",")]
                if kl == "equip" and parts and parts[0]:
                    item_nick = parts[0].lower()
                    equip_items.append({
                        "item": parts[0],
                        "name": item_names.get(item_nick, parts[0]),
                        "hardpoint": parts[1] if len(parts) > 1 else "",
                    })
                elif kl == "cargo" and parts and parts[0]:
                    item_nick = parts[0].lower()
                    cargo_items.append({
                        "item": parts[0],
                        "name": item_names.get(item_nick, parts[0]),
                        "count": parse_float(parts[1], 1.0) if len(parts) > 1 else 1.0,
                    })
            if nickname:
                loadouts[nickname] = {
                    "equip": equip_items,
                    "cargo": cargo_items,
                }
    return loadouts


def extract_universe(fl_ini: Path, res: DLLResolver) -> dict:
    """Extract all universe data for a Freelancer installation."""
    fl_sections = parse_ini(fl_ini)
    dll_paths = get_dll_paths(fl_ini, fl_sections)

    parent = fl_ini.parent
    data_root = parent.parent / "DATA" if parent.name.lower() == "exe" else parent / "DATA"
    universe_file = data_root / "UNIVERSE" / "universe.ini"
    solar_meta = parse_solar_meta(data_root)
    item_names = parse_item_names(data_root, res)
    loadouts = parse_loadouts(data_root, fl_sections, item_names)

    if not universe_file.exists():
        print(f"  ERROR: {universe_file} not found")
        return {}

    # ── Parse universe.ini: systems + bases ──
    uni_sections = parse_ini(universe_file)

    systems_raw: dict[str, dict] = {}
    bases_raw: dict[str, dict] = {}

    for sec, entries in uni_sections:
        sec_lower = sec.lower()
        if sec_lower == "system":
            vals = {k.lower(): v for k, v in entries}
            nick = vals.get("nickname", "").strip()
            if not nick:
                continue
            pos_str = vals.get("pos", "0, 0")
            pos_parts = [p.strip() for p in pos_str.split(",")]
            try:
                pos_x = float(pos_parts[0])
                pos_y = float(pos_parts[1]) if len(pos_parts) > 1 else 0.0
            except ValueError:
                pos_x, pos_y = 0.0, 0.0
            ids = vals.get("strid_name") or vals.get("ids_name") or ""
            name = res.get(ids) or nick
            sys_file = vals.get("file", "").strip()
            # NavMapScale: determines grid extent (half_extent = 120000 / scale)
            navmap_raw = vals.get("navmapscale", "").strip()
            try:
                navmap_scale = float(navmap_raw) if navmap_raw else 1.0
            except ValueError:
                navmap_scale = 1.0
            if navmap_scale <= 0:
                navmap_scale = 1.0
            systems_raw[nick.upper()] = {
                "nick": nick,
                "name": name,
                "pos": [pos_x, pos_y],
                "file": sys_file,
                "navmapscale": navmap_scale,
            }
        elif sec_lower == "base":
            vals = {k.lower(): v for k, v in entries}
            nick = vals.get("nickname", "").strip().lower()
            if not nick:
                continue
            ids = vals.get("strid_name") or vals.get("ids_name") or ""
            name = res.get(ids) or nick
            system = vals.get("system", "").strip().upper()
            bases_raw[nick] = {"name": name, "system": system}

    # ── Parse locked gates ──
    locked: set[int] = set()
    for name_candidate in ("initialworld.ini", "InitialWorld.ini"):
        iw = data_root / name_candidate
        if iw.exists():
            for sec, entries in parse_ini(iw):
                if sec.lower() == "locked_gates":
                    for k, v in entries:
                        if k.lower() == "locked_gate":
                            try:
                                locked.add(int(v.strip()))
                            except ValueError:
                                pass
            break

    # ── Parse each system file for objects ──
    systems_out: list[dict] = []
    connections: list[dict] = []  # jump connections

    for sys_nick, sys_info in systems_raw.items():
        rel_path = sys_info["file"]
        if not rel_path:
            continue
        sys_file = data_root / "UNIVERSE" / rel_path.replace("\\", "/")
        if not sys_file.exists():
            # Try just under data root
            sys_file = data_root / rel_path.replace("\\", "/")
        if not sys_file.exists():
            print(f"  WARN: System file not found: {rel_path}")
            systems_out.append({
                "nick": sys_info["nick"],
                "name": sys_info["name"],
                "pos": sys_info["pos"],
                "objects": [],
            })
            continue

        objects: list[dict] = []
        trade_lane_rings: dict[str, dict] = {}  # nick -> {pos, prev, next}
        zones_raw: dict[str, dict] = {}  # nick -> {pos, size, shape}
        nebula_zones: set[str] = set()
        asteroid_zones: set[str] = set()
        sys_sections = parse_ini(sys_file)

        for sec, entries in sys_sections:
            sec_lower = sec.lower()

            if sec_lower == "object":
                vals: dict[str, str] = {}
                for k, v in entries:
                    kl = k.lower()
                    if kl in ("nickname", "archetype", "pos", "base", "goto",
                              "ids_name", "ids_info", "reputation",
                              "prev_ring", "next_ring", "rotate", "loadout"):
                        vals[kl] = v.strip()

                archetype = vals.get("archetype", "")
                nickname = vals.get("nickname", "")
                has_base = bool(vals.get("base", ""))
                # Detect surprise objects by archetype or nickname
                is_surprise_nick = "surprise" in nickname.lower()
                # Objects with a base= field are always dockable stations
                if not archetype or (not is_interesting(archetype) and not is_surprise_nick and not has_base):
                    continue

                category = classify_object(archetype)
                if is_surprise_nick and category not in ("surprise",):
                    category = "surprise"
                elif has_base and category in ("other",):
                    category = "station"

                # Parse position (x, y, z) — we use x and z for top-down view
                pos_str = vals.get("pos", "0, 0, 0")
                pos_parts = [p.strip() for p in pos_str.split(",")]
                try:
                    obj_x = float(pos_parts[0])
                    obj_z = float(pos_parts[2]) if len(pos_parts) > 2 else 0.0
                except (ValueError, IndexError):
                    obj_x, obj_z = 0.0, 0.0

                rotate_str = vals.get("rotate", "")
                rotate_parts = [p.strip() for p in rotate_str.split(",")] if rotate_str else []
                try:
                    rotate_y = float(rotate_parts[1]) if len(rotate_parts) > 1 else 0.0
                except (ValueError, IndexError):
                    rotate_y = 0.0

                # Trade lane rings: collect for polyline building
                if category == "trade_lane":
                    trade_lane_rings[nickname] = {
                        "pos": [obj_x, obj_z],
                        "prev": vals.get("prev_ring", ""),
                        "next": vals.get("next_ring", ""),
                    }
                    continue

                # Resolve base name
                base_nick = vals.get("base", "").lower()
                base_name = ""
                if base_nick and base_nick in bases_raw:
                    base_name = bases_raw[base_nick]["name"]

                # Parse goto for jump connections
                goto_str = vals.get("goto", "")
                goto_system = ""
                if goto_str:
                    goto_parts = [p.strip() for p in goto_str.split(",")]
                    if goto_parts:
                        goto_system = goto_parts[0].upper()
                        if not locked or fl_hash(nickname) not in locked:
                            connections.append({
                                "from": sys_nick,
                                "to": goto_system,
                                "type": category,
                            })

                # Resolve object name via IDS
                ids_name = vals.get("ids_name", "")
                obj_name = res.get(ids_name) if ids_name else ""
                if not obj_name and base_name:
                    obj_name = base_name

                obj = {
                    "nick": nickname,
                    "type": category,
                    "pos": [obj_x, obj_z],
                }
                if obj_name:
                    obj["name"] = obj_name
                if base_nick:
                    obj["base"] = base_nick
                if goto_system:
                    obj["goto"] = goto_system
                loadout_nick = vals.get("loadout", "").lower()
                if loadout_nick:
                    obj["loadout"] = loadout_nick
                    loadout_info = loadouts.get(loadout_nick)
                    if loadout_info:
                        obj["loadout_items"] = loadout_info
                # Store archetype for icon lookup (lowercase, stripped)
                arch_key = archetype.lower().strip()
                if arch_key:
                    obj["arch"] = arch_key
                    radius = solar_meta.get(arch_key, {}).get("radius", 0.0)
                    if radius > 0:
                        obj["radius"] = radius
                if rotate_y:
                    obj["rotate"] = rotate_y

                objects.append(obj)

            elif sec_lower == "zone":
                vals_z: dict[str, str] = {}
                for k, v in entries:
                    kl = k.lower()
                    if kl in ("nickname", "pos", "size", "shape", "damage"):
                        vals_z[kl] = v.strip()
                zone_nick = vals_z.get("nickname", "")
                if zone_nick:
                    pos_str = vals_z.get("pos", "0, 0, 0")
                    pos_parts = [p.strip() for p in pos_str.split(",")]
                    try:
                        zx = float(pos_parts[0])
                        zz = float(pos_parts[2]) if len(pos_parts) > 2 else 0.0
                    except (ValueError, IndexError):
                        zx, zz = 0.0, 0.0
                    # Parse size — can be single value (sphere) or x,y,z
                    size_str = vals_z.get("size", "0")
                    size_parts = [p.strip() for p in size_str.split(",")]
                    try:
                        sx = float(size_parts[0])
                        sz = float(size_parts[2]) if len(size_parts) > 2 else sx
                    except (ValueError, IndexError):
                        sx, sz = 0.0, 0.0
                    zones_raw[zone_nick] = {
                        "pos": [zx, zz],
                        "size": [sx, sz],
                        "shape": vals_z.get("shape", "SPHERE").upper(),
                        "damage": parse_float(vals_z.get("damage", ""), 0.0),
                    }

            elif sec_lower == "nebula":
                for k, v in entries:
                    if k.lower() == "zone":
                        nebula_zones.add(v.strip())

            elif sec_lower == "asteroids":
                for k, v in entries:
                    if k.lower() == "zone":
                        asteroid_zones.add(v.strip())

        # ── Build trade lane polylines ──
        trade_lanes: list[list[list[float]]] = []
        visited: set[str] = set()
        for nick, ring in trade_lane_rings.items():
            if nick in visited:
                continue
            # Find chain start (no prev_ring)
            start = nick
            while trade_lane_rings.get(start, {}).get("prev", ""):
                prev = trade_lane_rings[start]["prev"]
                if prev not in trade_lane_rings or prev in visited:
                    break
                start = prev
            # Walk chain
            chain: list[list[float]] = []
            cur = start
            while cur and cur in trade_lane_rings and cur not in visited:
                visited.add(cur)
                chain.append(trade_lane_rings[cur]["pos"])
                cur = trade_lane_rings[cur].get("next", "")
            if len(chain) >= 2:
                trade_lanes.append(chain)

        # ── Build nebula/asteroid zone entries ──
        zone_objects: list[dict] = []
        for zone_nick in nebula_zones:
            if zone_nick in zones_raw:
                z = zones_raw[zone_nick]
                zone_objects.append({
                    "type": "nebula",
                    "nick": zone_nick,
                    "pos": z["pos"],
                    "size": z["size"],
                    "shape": z["shape"],
                })
        for zone_nick in asteroid_zones:
            if zone_nick in zones_raw:
                z = zones_raw[zone_nick]
                zone_objects.append({
                    "type": "asteroid_field",
                    "nick": zone_nick,
                    "pos": z["pos"],
                    "size": z["size"],
                    "shape": z["shape"],
                })
        for zone_nick, z in zones_raw.items():
            if z.get("damage", 0.0) <= 0:
                continue
            zone_objects.append({
                "type": "death_zone",
                "kind": "sun_death" if "sun" in zone_nick.lower() else "death",
                "nick": zone_nick,
                "pos": z["pos"],
                "size": z["size"],
                "shape": z["shape"],
                "damage": z["damage"],
            })

        sys_entry = {
            "nick": sys_info["nick"],
            "name": sys_info["name"],
            "pos": sys_info["pos"],
            "objects": objects,
        }
        if trade_lanes:
            sys_entry["trade_lanes"] = trade_lanes
        if zone_objects:
            sys_entry["zones"] = zone_objects
        if sys_info.get("navmapscale", 1.0) != 1.0:
            sys_entry["navmapscale"] = sys_info["navmapscale"]
        systems_out.append(sys_entry)

    # ── Deduplicate connections ──
    seen_conn: set[tuple[str, str]] = set()
    unique_connections: list[dict] = []
    for conn in connections:
        key = tuple(sorted([conn["from"], conn["to"]]))
        if key not in seen_conn:
            seen_conn.add(key)
            conn_type = conn["type"]
            # If both gate and hole exist, prefer gate
            unique_connections.append({
                "from": key[0],
                "to": key[1],
                "type": conn_type,
            })

    return {
        "systems": systems_out,
        "connections": unique_connections,
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for inst in INSTALLATIONS:
        mod_id = inst["id"]
        mod_name = inst["name"]
        fl_path: Path = inst["path"]
        print(f"\n{'='*60}")
        print(f"Processing: {mod_name} ({mod_id})")
        print(f"  Path: {fl_path}")

        # Find Freelancer.ini
        fl_ini = fl_path / "EXE" / "Freelancer.ini"
        if not fl_ini.exists():
            fl_ini = fl_path / "Freelancer.ini"
        if not fl_ini.exists():
            print(f"  ERROR: Freelancer.ini not found in {fl_path}")
            continue

        fl_sections = parse_ini(fl_ini)
        dll_paths = get_dll_paths(fl_ini, fl_sections)
        res = DLLResolver(dll_paths)

        try:
            data = extract_universe(fl_ini, res)
            if not data:
                continue

            out_file = OUTPUT_DIR / f"{mod_id}.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

            n_sys = len(data.get("systems", []))
            n_conn = len(data.get("connections", []))
            total_obj = sum(len(s.get("objects", [])) for s in data.get("systems", []))
            total_tl = sum(len(s.get("trade_lanes", [])) for s in data.get("systems", []))
            total_zones = sum(len(s.get("zones", [])) for s in data.get("systems", []))
            size_kb = out_file.stat().st_size / 1024
            print(f"  => {out_file.name}: {n_sys} systems, {n_conn} connections, {total_obj} objects, {total_tl} trade lanes, {total_zones} zones ({size_kb:.1f} KB)")
        finally:
            res.close()

    print("\nDone.")


if __name__ == "__main__":
    main()
