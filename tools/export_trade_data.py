"""Export Freelancer mod data to JSON for the web-based trade route calculator.

Usage:  python export_trade_data.py
Output: ../data/trade-routes/<mod-id>.json for each configured installation.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pefile

# ── Configuration ────────────────────────────────────────────────

INSTALLATIONS = [
    dict(
        id="vanilla",
        name="Vanilla Freelancer",
        path=Path(r"C:\Users\steve\Github\FL-Installationen\_FL Fresh Install-deutsch"),
    ),
    dict(
        id="hamburg-city",
        name="Hamburg City",
        path=Path(r"C:\Users\steve\Github\FL-Installationen\HamburgCityFLMM"),
    ),
    dict(
        id="crossfire",
        name="Crossfire 2.0",
        path=Path(r"C:\Users\steve\Github\FL-Installationen\Freelancer Crossfire"),
    ),
    dict(
        id="discovery",
        name="Discovery 5.3.2",
        path=Path(r"C:\Users\steve\Github\FL-Installationen\Discovery Freelancer 5.3.2"),
    ),
    dict(
        id="freelancer-universe",
        name="Freelancer-Universe",
        path=Path(r"C:\Users\steve\Github\FL-Installationen\Freelancer-Universe-ARM"),
    ),
]

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR.parent / "data" / "trade-routes"

# Optional English installation for bilingual name export (vanilla only).
EN_INSTALL_PATH = Path(r"C:\Users\steve\Github\FL-Installationen\_FL Fresh Install-englisch")

# ── Freelancer nickname hash (CreateID) ──────────────────────────

_HASH_TABLE: list[int] | None = None


def _hash_table() -> list[int]:
    global _HASH_TABLE
    if _HASH_TABLE is not None:
        return _HASH_TABLE
    poly = (0xA001 << 14) & 0xFFFFFFFF
    tbl: list[int] = []
    for i in range(256):
        c = i
        for _ in range(8):
            c = ((c >> 1) ^ poly) if (c & 1) else (c >> 1)
        tbl.append(c & 0xFFFFFFFF)
    _HASH_TABLE = tbl
    return tbl


def fl_hash(nickname: str) -> int:
    t = nickname.strip().lower()
    if not t:
        return 0
    tbl = _hash_table()
    h = 0
    for b in t.encode("latin1", errors="ignore"):
        h = ((h >> 8) ^ tbl[(h ^ b) & 0xFF]) & 0xFFFFFFFF
    h = (
        (h >> 24)
        | ((h >> 8) & 0x0000FF00)
        | ((h << 8) & 0x00FF0000)
        | ((h << 24) & 0xFF000000)
    ) & 0xFFFFFFFF
    h = ((h >> 2) | 0x80000000) & 0xFFFFFFFF
    return h


# ── BINI support (Vanilla FL uses binary INI files) ──────────────
import sys as _sys
_FLATLAS_ROOT = Path(__file__).resolve().parent.parent.parent / "FLAtlas"
_sys.path.insert(0, str(_FLATLAS_ROOT))
from fl_editor.bini import is_bini_bytes, decode_bini_to_ini_text

# ── INI Parser ───────────────────────────────────────────────────

Section = tuple[str, list[tuple[str, str]]]


def parse_ini(path: Path) -> list[Section]:
    raw = path.read_bytes()
    # Auto-decode BINI (binary INI) format used by Vanilla FL
    if is_bini_bytes(raw):
        text = decode_bini_to_ini_text(raw)
    elif raw[:3] == b"\xef\xbb\xbf":
        text = raw.decode("utf-8-sig", errors="ignore")
    elif raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        text = raw.decode("utf-16", errors="ignore")
    else:
        text = raw.decode("latin-1", errors="ignore")
    sections: list[Section] = []
    name: str | None = None
    entries: list[tuple[str, str]] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith(";") or line.startswith("//"):
            continue
        if line.startswith("[") and "]" in line:
            if name is not None:
                sections.append((name, entries))
            name = line[1 : line.index("]")].strip()
            entries = []
            continue
        if name is None or "=" not in line:
            continue
        if ";" in line:
            line = line.split(";", 1)[0].strip()
        k, _, v = line.partition("=")
        entries.append((k.strip(), v.strip()))
    if name is not None:
        sections.append((name, entries))
    return sections


# ── DLL String Resolver ──────────────────────────────────────────


class DLLResolver:
    """Resolve Freelancer IDS string resources using pefile (architecture-independent)."""

    def __init__(self, dll_paths: list[Path]):
        self._dll_paths = dll_paths
        self._tables: dict[str, dict[int, str]] = {}

    def _load_table(self, dll_path: Path) -> dict[int, str]:
        key = str(dll_path).lower()
        if key in self._tables:
            return self._tables[key]
        strings: dict[int, str] = {}
        if not dll_path.exists():
            self._tables[key] = strings
            return strings
        try:
            pe = pefile.PE(str(dll_path), fast_load=True)
            pe.parse_data_directories(
                directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_RESOURCE"]]
            )
            root = getattr(pe, "DIRECTORY_ENTRY_RESOURCE", None)
            if root:
                for type_entry in getattr(root, "entries", []):
                    if getattr(type_entry, "id", None) != 6:  # RT_STRING
                        continue
                    for name_entry in getattr(type_entry.directory, "entries", []):
                        block_id = getattr(name_entry, "id", None)
                        if not isinstance(block_id, int):
                            continue
                        for lang_entry in getattr(name_entry.directory, "entries", []):
                            data_entry = getattr(lang_entry, "data", None)
                            if data_entry is None:
                                continue
                            rva = int(data_entry.struct.OffsetToData)
                            size = int(data_entry.struct.Size)
                            blob = pe.get_data(rva, size)
                            self._decode_block(blob, block_id, strings)
            pe.close()
        except Exception:
            pass
        self._tables[key] = strings
        return strings

    @staticmethod
    def _decode_block(blob: bytes, block_id: int, out: dict[int, str]):
        offset = 0
        base_id = (block_id - 1) * 16
        for index in range(16):
            if offset + 2 > len(blob):
                break
            length = int.from_bytes(blob[offset : offset + 2], "little")
            offset += 2
            byte_len = length * 2
            if offset + byte_len > len(blob):
                break
            if length > 0:
                text = blob[offset : offset + byte_len].decode("utf-16le", errors="ignore").strip()
                if text:
                    out[base_id + index] = text
            offset += byte_len

    def get(self, ids: str | int | None) -> str:
        try:
            ids_value = int(ids)  # type: ignore[arg-type]
        except (ValueError, TypeError):
            return ""
        if ids_value <= 0:
            return ""

        # Freelancer two-part ID: high 16 bits = DLL slot (1-based), low 16 bits = local ID
        slot = (ids_value >> 16) & 0xFFFF
        local_id = ids_value & 0xFFFF
        if slot > 0 and local_id > 0 and slot <= len(self._dll_paths):
            table = self._load_table(self._dll_paths[slot - 1])
            text = table.get(local_id, "")
            if text:
                return text

        # Fallback: small IDs, try all DLLs
        if 0 < ids_value < 65536:
            for dll_path in self._dll_paths:
                table = self._load_table(dll_path)
                text = table.get(ids_value, "")
                if text:
                    return text

        # Last resort: use local_id across all DLLs
        if local_id > 0:
            for dll_path in self._dll_paths:
                table = self._load_table(dll_path)
                text = table.get(local_id, "")
                if text:
                    return text
        return ""

    def close(self):
        self._tables.clear()


# ── Helpers ──────────────────────────────────────────────────────


def find_data_files(fl_ini: Path, sections: list[Section], key: str) -> list[Path]:
    parent = fl_ini.parent
    data_root = (
        parent.parent / "DATA"
        if parent.name.lower() == "exe"
        else parent / "DATA"
    )
    result: list[Path] = []
    seen: set[str] = set()
    for sec, entries in sections:
        if sec.lower() != "data":
            continue
        for k, v in entries:
            if k.lower() != key.lower():
                continue
            p = data_root / v.replace("\\", "/")
            if p.exists() and p.is_file():
                lk = str(p).lower()
                if lk not in seen:
                    seen.add(lk)
                    result.append(p)
    return result


def get_dll_paths(fl_ini: Path, sections: list[Section]) -> list[Path]:
    exe_dir = fl_ini.parent
    result: list[Path] = []
    for sec, entries in sections:
        if sec.lower() != "resources":
            continue
        for k, v in entries:
            if k.lower() == "dll":
                result.append(exe_dir / v.strip())
    return result


def commodity_fallback(nick: str) -> str:
    raw = nick.strip()
    if raw.lower().startswith("commodity_"):
        raw = raw[len("commodity_") :]
    return " ".join(p.capitalize() for p in raw.split("_") if p) or nick


# ── Extraction Functions ─────────────────────────────────────────


def extract_systems(universe_file: Path, res: DLLResolver) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for sec, entries in parse_ini(universe_file):
        if sec.lower() != "system":
            continue
        vals = {k.lower(): v for k, v in entries}
        nick = vals.get("nickname", "").strip().upper()
        if not nick:
            continue
        ids = vals.get("ids_name") or vals.get("strid_name") or ""
        name = res.get(ids) or nick
        result[nick] = {"name": name, "file": vals.get("file", "").strip()}
    return result


def extract_bases(universe_file: Path, res: DLLResolver) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for sec, entries in parse_ini(universe_file):
        if sec.lower() != "base":
            continue
        vals = {k.lower(): v for k, v in entries}
        nick = vals.get("nickname", "").strip().lower()
        if not nick:
            continue
        sys_nick = vals.get("system", "").strip().upper()
        ids = vals.get("strid_name") or vals.get("ids_name") or ""
        name = res.get(ids) or nick
        result[nick] = {"name": name, "sys": sys_nick}
    return result


def enrich_bases(universe_file: Path, systems: dict, bases: dict):
    root = universe_file.parent
    for sys_nick, sys_info in systems.items():
        rel = sys_info.get("file", "").strip()
        if not rel:
            continue
        sys_file = root / rel.replace("\\", "/")
        if not sys_file.exists():
            continue
        for sec, entries in parse_ini(sys_file):
            if sec.lower() != "object":
                continue
            vals = {k.lower(): v for k, v in entries}
            base_nick = (vals.get("base") or vals.get("dock_with") or "").strip().lower()
            if not base_nick or base_nick not in bases:
                continue
            home_sys = (bases[base_nick].get("sys") or "").strip().upper()
            if home_sys and sys_nick != home_sys:
                continue
            rep = vals.get("reputation", "").strip().lower()
            if rep:
                bases[base_nick]["faction"] = rep
            if not bases[base_nick].get("sys"):
                bases[base_nick]["sys"] = sys_nick


import math


def extract_travel_data(universe_file: Path, systems: dict) -> dict:
    """Extract travel-relevant data: base positions, TL proximity, gate positions, TL polylines."""
    root = universe_file.parent  # DATA/UNIVERSE

    base_positions: dict[str, list[float]] = {}   # base_nick_lower -> [x, z]
    base_tl: dict[str, bool] = {}                 # base_nick_lower -> True/False
    system_gates: dict[str, list[dict]] = {}       # SYS_NICK -> [{pos, goto}]
    system_tl: dict[str, list] = {}                # SYS_NICK -> [[[x1,z1],[x2,z2],...], ...]

    for sys_nick, sys_info in systems.items():
        rel = sys_info.get("file", "").strip()
        if not rel:
            continue
        sys_file = root / rel.replace("\\", "/")
        if not sys_file.exists():
            continue

        tl_rings: dict[str, dict] = {}  # nick -> {pos, prev, next}
        base_objs: list[dict] = []      # [{nick, pos}]
        gate_objs: list[dict] = []      # [{pos, goto}]

        for sec, entries in parse_ini(sys_file):
            if sec.lower() != "object":
                continue
            vals = {k.lower(): v.strip() for k, v in entries}
            pos_str = vals.get("pos", "0, 0, 0")
            pos_parts = [p.strip() for p in pos_str.split(",")]
            try:
                x = float(pos_parts[0])
                z = float(pos_parts[2]) if len(pos_parts) > 2 else 0.0
            except (ValueError, IndexError):
                x, z = 0.0, 0.0

            nickname = vals.get("nickname", "")
            archetype = vals.get("archetype", "").lower()

            # Trade lane ring?
            if "trade_lane_ring" in archetype or vals.get("prev_ring") or vals.get("next_ring"):
                tl_rings[nickname] = {
                    "pos": [x, z],
                    "prev": vals.get("prev_ring", ""),
                    "next": vals.get("next_ring", ""),
                }

            # Base?
            base_nick = vals.get("base", "").lower()
            if base_nick:
                base_positions[base_nick] = [round(x), round(z)]
                base_objs.append({"nick": base_nick, "pos": [x, z]})

            # Gate/hole?
            goto_str = vals.get("goto", "")
            if goto_str:
                goto_parts = [p.strip() for p in goto_str.split(",")]
                goto_sys = goto_parts[0].upper() if goto_parts else ""
                if goto_sys:
                    gate_objs.append({
                        "pos": [round(x), round(z)],
                        "goto": goto_sys,
                    })

        # Build TL polylines
        tl_polylines: list[list[list[float]]] = []
        visited: set[str] = set()
        for nick in tl_rings:
            if nick in visited:
                continue
            start = nick
            while tl_rings.get(start, {}).get("prev", ""):
                prev = tl_rings[start]["prev"]
                if prev not in tl_rings or prev in visited:
                    break
                start = prev
            chain: list[list[float]] = []
            cur = start
            while cur and cur in tl_rings and cur not in visited:
                visited.add(cur)
                chain.append(tl_rings[cur]["pos"])
                cur = tl_rings[cur].get("next", "")
            if len(chain) >= 2:
                tl_polylines.append([[round(p[0]), round(p[1])] for p in chain])

        # Check TL proximity for bases in this system
        for bo in base_objs:
            nearby = False
            for ring in tl_rings.values():
                dx = bo["pos"][0] - ring["pos"][0]
                dz = bo["pos"][1] - ring["pos"][1]
                if math.hypot(dx, dz) <= 5000:
                    nearby = True
                    break
            base_tl[bo["nick"]] = nearby

        if gate_objs:
            system_gates[sys_nick] = gate_objs
        if tl_polylines:
            system_tl[sys_nick] = tl_polylines

    return {
        "base_positions": base_positions,
        "base_tl": base_tl,
        "system_gates": system_gates,
        "system_tl": system_tl,
    }


def extract_locked_hashes(universe_file: Path) -> set[int]:
    data_dir = universe_file.parent.parent
    for name in ("initialworld.ini", "InitialWorld.ini"):
        iw = data_dir / name
        if iw.exists():
            break
    else:
        return set()
    hashes: set[int] = set()
    for sec, entries in parse_ini(iw):
        if sec.lower() != "locked_gates":
            continue
        for k, v in entries:
            if k.lower() == "locked_gate":
                try:
                    hashes.add(int(v.strip()))
                except ValueError:
                    pass
    return hashes


def build_adjacency(universe_file: Path, locked: set[int]) -> dict[str, list[str]]:
    systems_dir = universe_file.parent / "SYSTEMS"
    if not systems_dir.exists():
        return {}
    adj: dict[str, set[str]] = {}
    for sys_dir in systems_dir.iterdir():
        if not sys_dir.is_dir():
            continue
        sys_file = next(
            (
                f
                for f in sys_dir.iterdir()
                if f.is_file()
                and f.suffix.lower() == ".ini"
                and f.stem.lower() == sys_dir.name.lower()
            ),
            None,
        )
        if not sys_file:
            continue
        current = sys_dir.name.upper()
        adj.setdefault(current, set())
        for sec, entries in parse_ini(sys_file):
            if sec.lower() != "object":
                continue
            nick = ""
            goto = ""
            for k, v in entries:
                kl = k.lower()
                if kl == "nickname":
                    nick = v.strip()
                elif kl == "goto":
                    goto = v.strip()
            if not goto:
                continue
            if locked and nick:
                if fl_hash(nick) in locked:
                    continue
            target = goto.split(",", 1)[0].strip().upper()
            if target:
                adj.setdefault(current, set()).add(target)
                adj.setdefault(target, set()).add(current)
    return {k: sorted(v) for k, v in adj.items()}


def extract_commodity_prices(
    goods_files: list[Path], equip_files: list[Path], res: DLLResolver
) -> tuple[dict[str, int], dict[str, str], dict[str, float]]:
    prices: dict[str, int] = {}
    names: dict[str, str] = {}
    volumes: dict[str, float] = {}
    for gf in goods_files:
        for sec, entries in parse_ini(gf):
            if sec.lower() != "good":
                continue
            nick = ""
            price = 0
            ids = ""
            for k, v in entries:
                kl = k.lower()
                if kl == "nickname":
                    nick = v.strip()
                elif kl == "price":
                    try:
                        price = int(float(v.strip()))
                    except ValueError:
                        pass
                elif kl in ("ids_name", "strid_name") and not ids:
                    ids = v.strip()
            if not nick.lower().startswith("commodity_"):
                continue
            prices[nick.lower()] = price
            resolved = res.get(ids) if ids else ""
            names[nick.lower()] = resolved or commodity_fallback(nick)
    for ef in equip_files:
        for sec, entries in parse_ini(ef):
            if sec.lower() != "commodity":
                continue
            nick = ""
            volume = 1.0
            for k, v in entries:
                kl = k.lower()
                if kl == "nickname":
                    nick = v.strip().lower()
                elif kl == "volume":
                    try:
                        volume = float(v.strip())
                    except ValueError:
                        pass
            if not nick.startswith("commodity_"):
                continue
            if volume <= 0:
                volume = 1.0
            volumes[nick] = volume
    return prices, names, volumes


def extract_market_entries(
    market_files: list[Path],
    bases: dict[str, dict],
    commodity_prices: dict[str, int],
) -> dict[str, list[dict]]:
    by_commodity: dict[str, list[dict]] = {}
    for mf in market_files:
        for sec, entries in parse_ini(mf):
            if sec.lower() != "basegood":
                continue
            base_nick = ""
            for k, v in entries:
                if k.lower() == "base":
                    base_nick = v.strip().lower()
                    break
            if not base_nick or base_nick not in bases:
                continue
            for k, v in entries:
                if k.lower() != "marketgood":
                    continue
                fields = [f.strip() for f in v.split(",")]
                if len(fields) < 7:
                    continue
                commodity = fields[0].lower()
                if not commodity.startswith("commodity_") or commodity.startswith(
                    "commodity_pilot_"
                ):
                    continue
                try:
                    rel_flag = int(float(fields[5]))
                    mult = float(fields[6])
                except ValueError:
                    continue
                if mult <= 0:
                    continue
                bp = commodity_prices.get(commodity, 0)
                if bp <= 0:
                    continue
                system = bases[base_nick].get("sys", "").upper()
                by_commodity.setdefault(commodity, []).append(
                    {
                        "base": base_nick,
                        "sys": system,
                        "price": round(float(bp) * mult, 2),
                        "src": rel_flag == 0,
                    }
                )
    return by_commodity


def extract_ships(fl_ini: Path, res: DLLResolver, bases: dict[str, dict]) -> list[dict]:
    parent = fl_ini.parent
    data_root = (
        parent.parent / "DATA" if parent.name.lower() == "exe" else parent / "DATA"
    )
    ship_file = data_root / "SHIPS" / "shiparch.ini"
    if not ship_file.exists():
        return []

    # 1) Parse ship archetypes
    ship_arch: dict[str, dict] = {}
    for sec, entries in parse_ini(ship_file):
        if sec.lower() != "ship":
            continue
        nick = ""
        ids = ""
        hold = 0
        hit_pts = 0
        ship_type = ""
        nanobot_limit = 0
        shield_battery_limit = 0
        steering_torque = (0.0, 0.0, 0.0)
        angular_drag = (0.0, 0.0, 0.0)
        strafe_force = 0.0
        nudge_force = 0.0
        linear_drag = 0.0
        mass = 0.0
        hp_types: list[tuple[str, list[str]]] = []  # [(type, [mount1, mount2, ...])]
        ship_class = 0
        num_exhaust_nozzles = 0
        for k, v in entries:
            kl = k.lower()
            if kl == "nickname":
                nick = v.strip()
            elif kl in ("ids_name", "strid_name") and not ids:
                ids = v.strip()
            elif kl == "hold_size":
                try:
                    hold = int(float(v.strip()))
                except ValueError:
                    pass
            elif kl == "hit_pts":
                try:
                    hit_pts = int(float(v.strip()))
                except ValueError:
                    pass
            elif kl == "type":
                ship_type = v.strip()
            elif kl == "nanobot_limit":
                try:
                    nanobot_limit = int(float(v.strip()))
                except ValueError:
                    pass
            elif kl == "shield_battery_limit":
                try:
                    shield_battery_limit = int(float(v.strip()))
                except ValueError:
                    pass
            elif kl == "steering_torque":
                parts = [p.strip() for p in v.split(",")]
                try:
                    steering_torque = (float(parts[0]), float(parts[1]), float(parts[2]))
                except (ValueError, IndexError):
                    pass
            elif kl == "angular_drag":
                parts = [p.strip() for p in v.split(",")]
                try:
                    angular_drag = (float(parts[0]), float(parts[1]), float(parts[2]))
                except (ValueError, IndexError):
                    pass
            elif kl == "strafe_force":
                try:
                    strafe_force = float(v.strip())
                except ValueError:
                    pass
            elif kl == "nudge_force":
                try:
                    nudge_force = float(v.strip())
                except ValueError:
                    pass
            elif kl == "linear_drag":
                try:
                    linear_drag = float(v.strip())
                except ValueError:
                    pass
            elif kl == "mass":
                try:
                    mass = float(v.strip())
                except ValueError:
                    pass
            elif kl == "hp_type":
                parts = [p.strip() for p in v.split(",")]
                if len(parts) >= 2:
                    hp_types.append((parts[0], parts[1:]))
            elif kl == "ship_class":
                try:
                    ship_class = int(float(v.strip()))
                except ValueError:
                    pass
            elif kl == "num_exhaust_nozzles":
                try:
                    num_exhaust_nozzles = int(float(v.strip()))
                except ValueError:
                    pass
        if not nick or hold <= 0 or hold > 5000:
            continue
        name = res.get(ids) if ids else ""
        # Agility: average turn rate (steering_torque / angular_drag) as degrees/sec approx
        agility = 0.0
        if angular_drag[0] > 0 and angular_drag[1] > 0:
            turn_x = steering_torque[0] / angular_drag[0]
            turn_y = steering_torque[1] / angular_drag[1]
            agility = round((turn_x + turn_y) / 2, 2)
        # Categorize hardpoints
        weapon_mounts: list[str] = []
        shield_mounts: list[str] = []
        other_equip: dict[str, int] = {}  # category -> count
        for hp_cat, mounts in hp_types:
            hp_lower = hp_cat.lower()
            if "gun" in hp_lower or "torpedo" in hp_lower or "turret" in hp_lower:
                for m in mounts:
                    if m.strip():
                        weapon_mounts.append(m.strip())
            elif "shield" in hp_lower:
                for m in mounts:
                    if m.strip():
                        shield_mounts.append(m.strip())
            elif "thruster" in hp_lower:
                other_equip["thruster"] = other_equip.get("thruster", 0) + len(mounts)
            elif "mine" in hp_lower:
                other_equip["mine"] = other_equip.get("mine", 0) + len(mounts)
            elif "countermeasure" in hp_lower:
                other_equip["cm"] = other_equip.get("cm", 0) + len(mounts)

        # Max speed: nudge_force / linear_drag (simplified Freelancer physics)
        max_speed = round(nudge_force / linear_drag) if linear_drag > 0 else 0

        ship_arch[nick.lower()] = {
            "nick": nick,
            "name": name or nick,
            "cargo": hold,
            "hit_pts": hit_pts,
            "type": ship_type,
            "nanobots": nanobot_limit,
            "batteries": shield_battery_limit,
            "agility": agility,
            "strafe": round(strafe_force),
            "mass": round(mass),
            "max_speed": max_speed,
            "weapon_mounts": len(set(weapon_mounts)),
            "shield_mounts": len(set(shield_mounts)),
            "equipment": other_equip,
            "ship_class": ship_class,
        }

    # 2) Parse goods to get hull prices and package→hull mapping
    sections_fl = parse_ini(fl_ini)
    goods_files = find_data_files(fl_ini, sections_fl, "goods")
    hull_prices: dict[str, int] = {}   # ship_nick -> price
    hull_ids: dict[str, str] = {}      # hull_nick -> ship_nick
    package_hull: dict[str, str] = {}  # package_nick -> hull_nick
    for gf in goods_files:
        for sec, entries in parse_ini(gf):
            if sec.lower() != "good":
                continue
            nick = ""
            category = ""
            price = 0
            ship_nick = ""
            hull_nick = ""
            for k, v in entries:
                kl = k.lower()
                if kl == "nickname":
                    nick = v.strip()
                elif kl == "category":
                    category = v.strip().lower()
                elif kl == "price":
                    try:
                        price = int(float(v.strip()))
                    except ValueError:
                        pass
                elif kl == "ship":
                    ship_nick = v.strip().lower()
                elif kl == "hull":
                    hull_nick = v.strip().lower()
            if category == "shiphull" and ship_nick:
                hull_prices[ship_nick] = price
                hull_ids[nick.lower()] = ship_nick
            elif category == "ship" and hull_nick:
                package_hull[nick.lower()] = hull_nick

    # 3) Parse market_ships to find where each package is sold
    market_files = find_data_files(fl_ini, sections_fl, "markets")
    ship_bases: dict[str, list[dict]] = {}  # ship_nick -> [{base, sys, name}]
    for mf in market_files:
        for sec, entries in parse_ini(mf):
            if sec.lower() != "basegood":
                continue
            base_nick = ""
            for k, v in entries:
                if k.lower() == "base":
                    base_nick = v.strip().lower()
                    break
            if not base_nick or base_nick not in bases:
                continue
            for k, v in entries:
                if k.lower() != "marketgood":
                    continue
                fields = [f.strip() for f in v.split(",")]
                if len(fields) >= 5 and fields[3] == "0" and fields[4] == "0":
                    continue  # no stock – NPC-only, not purchasable
                pkg = fields[0].lower()
                if pkg not in package_hull:
                    continue
                hull = package_hull[pkg]
                ship_nick = hull_ids.get(hull, "")
                if not ship_nick or ship_nick not in ship_arch:
                    continue
                base_info = bases.get(base_nick, {})
                ship_bases.setdefault(ship_nick, []).append({
                    "base": base_nick,
                    "sys": base_info.get("sys", ""),
                    "name": base_info.get("name", base_nick),
                })

    # 4) Build final ship list
    ships: list[dict] = []
    for nick, arch in ship_arch.items():
        price = hull_prices.get(nick, 0)
        dealers = ship_bases.get(nick, [])
        ships.append({
            "nick": arch["nick"],
            "name": arch["name"],
            "type": arch["type"],
            "cargo": arch["cargo"],
            "hit_pts": arch["hit_pts"],
            "nanobots": arch["nanobots"],
            "batteries": arch["batteries"],
            "agility": arch["agility"],
            "strafe": arch["strafe"],
            "mass": arch["mass"],
            "max_speed": arch["max_speed"],
            "weapon_mounts": arch["weapon_mounts"],
            "shield_mounts": arch["shield_mounts"],
            "equipment": arch["equipment"],
            "ship_class": arch["ship_class"],
            "price": price,
            "dealers": dealers,
        })
    ships.sort(key=lambda s: (-s["cargo"], s["name"]))
    return ships


# ── Main Export ──────────────────────────────────────────────────


def export_installation(inst: dict):
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
        locked = extract_locked_hashes(universe_file)
        adjacency = build_adjacency(universe_file, locked)
        comm_prices, comm_names, comm_volumes = extract_commodity_prices(goods_files, equip_files, res)
        markets = extract_market_entries(market_files, bases, comm_prices)
        ships = extract_ships(fl_ini, res, bases)
        travel = extract_travel_data(universe_file, systems)

        snapshot = {
            "label": "Default",
            "ships": ships,
            "systems": {nick: info["name"] for nick, info in systems.items()},
            "bases": {
                nick: {
                    "name": info["name"],
                    "sys": info.get("sys", ""),
                    **({"faction": info["faction"]} if info.get("faction") else {}),
                    **({"pos": travel["base_positions"][nick]} if nick in travel["base_positions"] else {}),
                    **({"tl": True} if travel["base_tl"].get(nick) else {}),
                }
                for nick, info in bases.items()
            },
            "adjacency": adjacency,
            "commodities": {
                nick: {
                    "name": comm_names.get(nick, commodity_fallback(nick)),
                    "price": price,
                    "volume": comm_volumes.get(nick, 1.0),
                }
                for nick, price in comm_prices.items()
                if price > 0
            },
            "markets": markets,
            "travel": {
                sys_nick: {
                    **({"gates": travel["system_gates"][sys_nick]} if sys_nick in travel["system_gates"] else {}),
                    **({"tl": travel["system_tl"][sys_nick]} if sys_nick in travel["system_tl"] else {}),
                }
                for sys_nick in systems
                if sys_nick in travel["system_gates"] or sys_nick in travel["system_tl"]
            },
        }
        output = {
            "id": inst["id"],
            "name": inst["name"],
            "default_dataset": "default",
            "dataset_order": ["default"],
            "datasets": {
                "default": snapshot
            },
        }

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_file = OUTPUT_DIR / f"{inst['id']}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

        size_kb = out_file.stat().st_size / 1024
        print(f"  -> {out_file.name} ({size_kb:.1f} KB)")
        print(
            f"    Systems: {len(systems)}, Bases: {len(bases)}, "
            f"Commodities: {len(comm_prices)}, Ships: {len(ships)}, "
            f"Market entries: {sum(len(v) for v in markets.values())}"
        )
    finally:
        res.close()

    # ── English names (for vanilla only) ──
    if inst["id"] == "vanilla" and EN_INSTALL_PATH.exists():
        print("  Loading English names...")
        en_fl_ini = EN_INSTALL_PATH / "EXE" / "Freelancer.ini"
        if not en_fl_ini.exists():
            en_fl_ini = EN_INSTALL_PATH / "EXE" / "freelancer.ini"
        if en_fl_ini.exists():
            en_sections = parse_ini(en_fl_ini)
            en_res = DLLResolver(get_dll_paths(en_fl_ini, en_sections))

            # English base names
            en_universe_files = find_data_files(en_fl_ini, en_sections, "universe")
            en_universe = en_universe_files[0] if en_universe_files else None
            en_bases = extract_bases(en_universe, en_res) if en_universe else {}

            # English ship names
            en_ships = extract_ships(en_fl_ini, en_res, en_bases) if en_universe else []
            en_ship_map = {}
            for s in en_ships:
                en_ship_map[s["nick"]] = s["name"]

            # Enrich output JSON
            out_file = OUTPUT_DIR / f"{inst['id']}.json"
            with open(out_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            en_base_count = 0
            snapshot = ((data.get("datasets") or {}).get("default")) or data

            for nick, base_info in snapshot["bases"].items():
                en_info = en_bases.get(nick, {})
                en_name = en_info.get("name", "")
                if en_name and en_name != base_info.get("name"):
                    base_info["nameEn"] = en_name
                    en_base_count += 1

            en_ship_count = 0
            for ship in snapshot["ships"]:
                en_name = en_ship_map.get(ship.get("nick", ""), "")
                if en_name and en_name != ship.get("name"):
                    ship["nameEn"] = en_name
                    en_ship_count += 1

            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

            print(f"  -> {en_base_count} bases, {en_ship_count} ships with English names added")
            en_res.close()


def main():
    print("Exporting trade route data...\n")
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
