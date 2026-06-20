"""Export Freelancer mod data to JSON for the web-based trade route calculator.

Usage:  python export_trade_data.py
Output: ../data/trade-routes/<mod-id>.json for each configured installation.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pefile

# ── Configuration ────────────────────────────────────────────────

def first_existing_path(*paths: Path) -> Path:
    for path in paths:
        if path.exists():
            return path
    return paths[-1]


def resolve_mod_path(root: Path, rel_path: str) -> Path:
    path = root
    for raw_part in rel_path.replace("\\", "/").split("/"):
        part = raw_part.strip()
        if not part or part == ".":
            continue
        candidate = path / part
        if candidate.exists():
            path = candidate
            continue
        try:
            matches = [entry for entry in path.iterdir() if entry.name.lower() == part.lower()]
        except OSError:
            path = candidate
            continue
        path = matches[0] if matches else candidate
    return path


INSTALLATIONS = [
    dict(
        id="vanilla",
        name="Vanilla Freelancer",
        path=first_existing_path(
            Path("/home/steven/Games/freelancer-discovery/drive_c/Freelancer-HD"),
            Path(r"C:\Users\steve\Github\FL-Installationen\_FL Fresh Install-deutsch"),
        ),
    ),
    dict(
        id="hamburg-city",
        name="Hamburg City",
        path=Path(r"C:\Users\steve\Github\FL-Installationen\HamburgCityFLMM"),
    ),
    dict(
        id="crossfire",
        name="Crossfire 2.0",
        path=first_existing_path(
            Path("/home/steven/Games/freelancer-discovery/drive_c/Freelancer Crossfire"),
            Path(r"C:\C-Installed-Apps\CF-DEUTSCH"),
        ),
    ),
    dict(
        id="discovery",
        name="Discovery 5.3.2",
        path=first_existing_path(
            Path("/home/steven/Games/freelancer-discovery/drive_c/Discovery Freelancer 5.3.2"),
            Path(r"C:\Users\steve\Github\FL-Installationen\Discovery Freelancer 5.3.2"),
        ),
    ),
    dict(
        id="freelancer-universe",
        name="Freelancer-Universe",
        path=first_existing_path(
            Path("/home/steven/Games/freelancer-discovery/drive_c/FLUniverse+MOD"),
            Path(r"C:\Users\steve\Github\FL-Installationen\Freelancer-Universe-ARM"),
        ),
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
_FLATLAS_CANDIDATES = [
    Path(os.environ["FLATLAS_ROOT"]) if os.environ.get("FLATLAS_ROOT") else None,
    Path(__file__).resolve().parent.parent.parent / "FLAtlas",
    Path(r"C:\PROJECTS\PRIVATE\FLAtlas-PYTHON"),
    Path(r"C:\PROJECTS\PUBLIC\FLAtlas"),
]
for _FLATLAS_ROOT in _FLATLAS_CANDIDATES:
    if _FLATLAS_ROOT and (_FLATLAS_ROOT / "fl_editor" / "bini.py").exists():
        _sys.path.insert(0, str(_FLATLAS_ROOT))
        break
try:
    from fl_editor.bini import is_bini_bytes, decode_bini_to_ini_text
except ModuleNotFoundError:
    def is_bini_bytes(raw: bytes) -> bool:
        return raw.startswith(b"BINI")

    def decode_bini_to_ini_text(raw: bytes) -> str:
        raise RuntimeError("BINI decoding requires FLAtlas fl_editor.bini on PYTHONPATH")

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
        self._html_tables: dict[str, dict[int, str]] = {}

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

    def _load_html_table(self, dll_path: Path) -> dict[int, str]:
        key = str(dll_path).lower()
        if key in self._html_tables:
            return self._html_tables[key]
        strings: dict[int, str] = {}
        if not dll_path.exists():
            self._html_tables[key] = strings
            return strings
        try:
            pe = pefile.PE(str(dll_path), fast_load=True)
            pe.parse_data_directories(
                directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_RESOURCE"]]
            )
            root = getattr(pe, "DIRECTORY_ENTRY_RESOURCE", None)
            if root:
                for type_entry in getattr(root, "entries", []):
                    if getattr(type_entry, "id", None) != 23:  # RT_HTML
                        continue
                    for name_entry in getattr(type_entry.directory, "entries", []):
                        resource_id = getattr(name_entry, "id", None)
                        if not isinstance(resource_id, int):
                            continue
                        for lang_entry in getattr(name_entry.directory, "entries", []):
                            data_entry = getattr(lang_entry, "data", None)
                            if data_entry is None:
                                continue
                            rva = int(data_entry.struct.OffsetToData)
                            size = int(data_entry.struct.Size)
                            text = self._decode_text_resource(pe.get_data(rva, size))
                            if text:
                                strings[resource_id] = text
            pe.close()
        except Exception:
            pass
        self._html_tables[key] = strings
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

    @staticmethod
    def _decode_text_resource(blob: bytes) -> str:
        raw = blob.strip(b"\x00")
        if not raw:
            return ""
        if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
            return raw.decode("utf-16", errors="ignore").strip()
        if b"\x00" in raw[: min(len(raw), 80)]:
            return raw.decode("utf-16le", errors="ignore").strip()
        return raw.decode("cp1252", errors="ignore").strip()

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
            dll_path = self._dll_paths[slot - 1]
            table = self._load_table(dll_path)
            text = table.get(local_id, "")
            if not text:
                text = self._load_html_table(dll_path).get(local_id, "")
            if text:
                return text

        # Fallback: small IDs, try all DLLs
        if 0 < ids_value < 65536:
            for dll_path in self._dll_paths:
                table = self._load_table(dll_path)
                text = table.get(ids_value, "")
                if not text:
                    text = self._load_html_table(dll_path).get(ids_value, "")
                if text:
                    return text

        # Last resort: use local_id across all DLLs
        if local_id > 0:
            for dll_path in self._dll_paths:
                table = self._load_table(dll_path)
                text = table.get(local_id, "")
                if not text:
                    text = self._load_html_table(dll_path).get(local_id, "")
                if text:
                    return text
        return ""

    def close(self):
        self._tables.clear()
        self._html_tables.clear()


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
            p = resolve_mod_path(data_root, v)
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
                result.append(resolve_mod_path(exe_dir, v.strip()))
    return result


def commodity_fallback(nick: str) -> str:
    raw = nick.strip()
    if raw.lower().startswith("commodity_"):
        raw = raw[len("commodity_") :]
    return " ".join(p.capitalize() for p in raw.split("_") if p) or nick


def market_item_fallback(nick: str) -> str:
    raw = nick.strip()
    for prefix in ("ge_", "li_", "br_", "rh_", "ku_", "co_", "gd_", "fc_", "commodity_"):
        if raw.lower().startswith(prefix):
            raw = raw[len(prefix) :]
            break
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
        gate_objs: list[dict] = []      # [{nick, pos, goto, target}]

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
                goto_target = goto_parts[1] if len(goto_parts) > 1 else ""
                if goto_sys:
                    gate_objs.append({
                        "nick": nickname,
                        "pos": [round(x), round(z)],
                        "goto": goto_sys,
                        "target": goto_target,
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


def build_adjacency(
    universe_file: Path, systems: dict[str, dict], locked: set[int]
) -> dict[str, list[str]]:
    root = universe_file.parent
    adj: dict[str, set[str]] = {sys_nick: set() for sys_nick in systems}

    for sys_nick, sys_info in systems.items():
        rel = (sys_info.get("file") or "").strip()
        if not rel:
            continue
        sys_file = root / rel.replace("\\", "/")
        if not sys_file.exists():
            continue

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
            if locked and nick and fl_hash(nick) in locked:
                continue

            target = goto.split(",", 1)[0].strip().upper()
            if target and target in systems and target != sys_nick:
                adj[sys_nick].add(target)

    return {k: sorted(v) for k, v in adj.items()}


def externally_reachable_systems(
    systems: dict[str, dict], adjacency: dict[str, list[str]]
) -> set[str]:
    inbound: dict[str, set[str]] = {sys_nick: set() for sys_nick in systems}
    for src, targets in adjacency.items():
        for dst in targets:
            if dst != src and dst in inbound:
                inbound[dst].add(src)
    return {sys_nick for sys_nick, sources in inbound.items() if sources}


def filter_market_entries(
    markets: dict[str, list[dict]], bases: dict[str, dict]
) -> dict[str, list[dict]]:
    filtered: dict[str, list[dict]] = {}
    for commodity, offers in markets.items():
        kept = [offer for offer in offers if offer.get("base", "").lower() in bases]
        if kept:
            filtered[commodity] = kept
    return filtered


def filter_special_market_entries(
    special_items: dict[str, dict],
    special_markets: dict[str, list[dict]],
    bases: dict[str, dict],
) -> tuple[dict[str, dict], dict[str, list[dict]]]:
    filtered_items: dict[str, dict] = {}
    filtered_markets: dict[str, list[dict]] = {}
    for item_nick, offers in special_markets.items():
        kept = [offer for offer in offers if offer.get("base", "").lower() in bases]
        if not kept:
            continue
        filtered_markets[item_nick] = kept
        if item_nick in special_items:
            filtered_items[item_nick] = special_items[item_nick]
    return filtered_items, filtered_markets


def filter_ships_by_bases(ships: list[dict], bases: dict[str, dict]) -> list[dict]:
    allowed_bases = set(bases)
    filtered: list[dict] = []
    for ship in ships:
        dealers = [dealer for dealer in ship.get("dealers", []) if dealer.get("base", "").lower() in allowed_bases]
        if dealers:
            ship = {**ship, "dealers": dealers}
        filtered.append(ship)
    return filtered


def preserve_existing_datasets(out_file: Path, snapshot: dict) -> dict:
    if not out_file.exists():
        return {
            "default_dataset": "default",
            "dataset_order": ["default"],
            "datasets": {"default": snapshot},
        }

    try:
        existing = json.loads(out_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {
            "default_dataset": "default",
            "dataset_order": ["default"],
            "datasets": {"default": snapshot},
        }

    snapshot_bases = set(snapshot.get("bases", {}))
    snapshot_systems = set(snapshot.get("systems", {}))
    snapshot_commodities = set(snapshot.get("commodities", {}))

    datasets: dict[str, dict] = {"default": snapshot}
    dataset_order = ["default"]

    ordered_ids = [
        ds_id
        for ds_id in existing.get("dataset_order", [])
        if ds_id != "default" and ds_id in existing.get("datasets", {})
    ]
    for ds_id in existing.get("datasets", {}):
        if ds_id != "default" and ds_id not in ordered_ids:
            ordered_ids.append(ds_id)

    for ds_id in ordered_ids:
        existing_dataset = existing["datasets"].get(ds_id) or {}
        filtered_markets: dict[str, list[dict]] = {}
        for commodity, offers in (existing_dataset.get("markets") or {}).items():
            if commodity not in snapshot_commodities:
                continue
            kept = [
                offer
                for offer in offers
                if offer.get("base", "").lower() in snapshot_bases
                and str(offer.get("sys", "")).upper() in snapshot_systems
            ]
            if kept:
                filtered_markets[commodity] = kept

        datasets[ds_id] = {
            **snapshot,
            "label": existing_dataset.get("label", ds_id.upper()),
            "markets": filtered_markets,
        }
        dataset_order.append(ds_id)

    default_dataset = existing.get("default_dataset", "default")
    if default_dataset not in datasets:
        default_dataset = "default"

    return {
        "default_dataset": default_dataset,
        "dataset_order": dataset_order,
        "datasets": datasets,
    }


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


def extract_special_market_items(
    goods_files: list[Path],
    equip_files: list[Path],
    market_files: list[Path],
    bases: dict[str, dict],
    res: DLLResolver,
) -> tuple[dict[str, dict], dict[str, list[dict]]]:
    goods_map: dict[str, dict] = {}
    volumes: dict[str, float] = {}

    for gf in goods_files:
        for sec, entries in parse_ini(gf):
            if sec.lower() != "good":
                continue
            vals = {k.lower(): v.strip() for k, v in entries}
            good_nick = vals.get("nickname", "").lower()
            if not good_nick:
                continue
            item_nick = vals.get("equipment", "").lower() or good_nick
            category = vals.get("category", "").lower()
            if (
                good_nick.startswith("commodity_")
                or item_nick.startswith("commodity_")
                or category in {"commodity", "ship", "shiphull"}
            ):
                continue
            try:
                price = int(float(vals.get("price", "0")))
            except ValueError:
                price = 0
            if price <= 0:
                continue
            ids = vals.get("ids_name") or vals.get("strid_name") or ""
            goods_map[good_nick] = {
                "item_nick": item_nick,
                "price": price,
                "name": res.get(ids) if ids else "",
            }

    for ef in equip_files:
        for _, entries in parse_ini(ef):
            vals = {k.lower(): v.strip() for k, v in entries}
            nick = vals.get("nickname", "").lower()
            if not nick or nick.startswith("commodity_"):
                continue
            if "volume" in vals:
                try:
                    volume = float(vals["volume"])
                except ValueError:
                    volume = 1.0
                if volume > 0:
                    volumes[nick] = volume

    item_meta: dict[str, dict] = {}
    item_markets: dict[str, list[dict]] = {}
    for mf in market_files:
        if mf.name.lower() != "market_misc.ini":
            continue
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
                good_nick = fields[0].lower()
                if len(fields) >= 5 and fields[3] == "0" and fields[4] == "0":
                    continue
                mapping = goods_map.get(good_nick)
                if not mapping:
                    continue
                try:
                    rel_flag = int(float(fields[5]))
                    mult = float(fields[6])
                except ValueError:
                    continue
                try:
                    resale_multiplier = abs(float(fields[2]))
                except (ValueError, IndexError):
                    resale_multiplier = 0.3
                if resale_multiplier <= 0 or resale_multiplier > 1:
                    resale_multiplier = 0.3
                if mult <= 0:
                    continue
                item_nick = mapping["item_nick"]
                base_price = int(mapping["price"])
                item_meta.setdefault(
                    item_nick,
                    {
                        "name": mapping.get("name") or market_item_fallback(item_nick),
                        "price": base_price,
                        "volume": volumes.get(item_nick, 1.0),
                        "resaleMultiplier": resale_multiplier,
                    },
                )
                item_markets.setdefault(item_nick, []).append(
                    {
                        "base": base_nick,
                        "sys": bases[base_nick].get("sys", "").upper(),
                        "price": round(base_price * mult, 2),
                        "resalePrice": round(base_price * mult * resale_multiplier, 2),
                        "multiplier": mult,
                        "resaleMultiplier": resale_multiplier,
                        "src": rel_flag == 0,
                    }
                )

    filtered_meta: dict[str, dict] = {}
    filtered_markets: dict[str, list[dict]] = {}
    for item_nick, offers in item_markets.items():
        distinct_multipliers = {round(float(offer.get("multiplier", 0)), 4) for offer in offers}
        if len(distinct_multipliers) <= 1:
            continue
        filtered_meta[item_nick] = item_meta[item_nick]
        filtered_markets[item_nick] = offers
    return filtered_meta, filtered_markets


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
        adjacency = build_adjacency(universe_file, systems, locked)
        reachable_systems = externally_reachable_systems(systems, adjacency)
        hidden_systems = sorted(set(systems) - reachable_systems)
        systems = {nick: info for nick, info in systems.items() if nick in reachable_systems}
        bases = {
            nick: info
            for nick, info in bases.items()
            if (info.get("sys") or "").strip().upper() in reachable_systems
        }
        adjacency = {
            sys_nick: [dst for dst in targets if dst in reachable_systems]
            for sys_nick, targets in adjacency.items()
            if sys_nick in reachable_systems
        }
        comm_prices, comm_names, comm_volumes = extract_commodity_prices(goods_files, equip_files, res)
        markets = extract_market_entries(market_files, bases, comm_prices)
        special_items, special_markets = extract_special_market_items(goods_files, equip_files, market_files, bases, res)
        ships = extract_ships(fl_ini, res, bases)
        markets = filter_market_entries(markets, bases)
        special_items, special_markets = filter_special_market_entries(special_items, special_markets, bases)
        ships = filter_ships_by_bases(ships, bases)
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
            "specialItems": special_items,
            "specialMarkets": special_markets,
            "travel": {
                sys_nick: {
                    **({"gates": travel["system_gates"][sys_nick]} if sys_nick in travel["system_gates"] else {}),
                    **({"tl": travel["system_tl"][sys_nick]} if sys_nick in travel["system_tl"] else {}),
                }
                for sys_nick in systems
                if sys_nick in travel["system_gates"] or sys_nick in travel["system_tl"]
            },
        }
        out_file = OUTPUT_DIR / f"{inst['id']}.json"
        preserved = preserve_existing_datasets(out_file, snapshot)
        output = {
            "id": inst["id"],
            "name": inst["name"],
            "default_dataset": preserved["default_dataset"],
            "dataset_order": preserved["dataset_order"],
            "datasets": preserved["datasets"],
        }

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

        size_kb = out_file.stat().st_size / 1024
        print(f"  -> {out_file.name} ({size_kb:.1f} KB)")
        print(
            f"    Systems: {len(systems)}, Bases: {len(bases)}, "
            f"Commodities: {len(comm_prices)}, Special items: {len(special_items)}, Ships: {len(ships)}, "
            f"Market entries: {sum(len(v) for v in markets.values())}"
        )
        if hidden_systems:
            print(f"    Hidden unreachable systems: {', '.join(hidden_systems)}")
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
