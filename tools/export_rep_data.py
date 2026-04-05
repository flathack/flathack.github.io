"""Export Freelancer faction reputation & empathy data for the web-based Rep Planner.

Usage:  python export_rep_data.py
Output: ../data/reputation/<mod-id>.json for each configured installation.

Data sources per installation:
  EXE/mpnewcharacter.fl          – player's default starting reputation
  DATA/InitialWorld.ini          – [Group] sections with ids_name for display names
  DATA/MISSIONS/empathy.ini      – rep change on kill/mission + empathy cascades
  DATA/MISSIONS/faction_prop.ini – legality, npc_ship presence
  DATA/MISSIONS/mbases.ini       – bribe locations per faction
  DATA/UNIVERSE/universe.ini     – base display names
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Re-use utilities from the trade-route exporter (same folder)
from export_trade_data import (
    INSTALLATIONS,
    DLLResolver,
    parse_ini,
    get_dll_paths,
)

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR.parent / "data" / "reputation"

# Optional English installation for bilingual name export (vanilla only).
EN_INSTALL_PATH = Path(r"C:\Users\steve\Github\FL-Installationen\_FL Fresh Install-englisch")

# ── Extraction ───────────────────────────────────────────────────


def extract_faction_names(
    iw_path: Path, res: DLLResolver
) -> dict[str, dict[str, str]]:
    """Parse [Group] sections from InitialWorld.ini → {nick: {name, short_name}}."""
    groups: dict[str, dict[str, str]] = {}
    for sec, entries in parse_ini(iw_path):
        if sec != "Group":
            continue
        vals = {k.lower(): v for k, v in entries}
        nick = vals.get("nickname", "").strip().lower()
        if not nick:
            continue
        ids_name = vals.get("ids_name", "")
        ids_short = vals.get("ids_short_name", "")
        name = res.get(ids_name) or nick
        short = res.get(ids_short) or ""
        groups[nick] = {"name": name, "short_name": short}
    return groups


def extract_empathy(empathy_path: Path) -> dict[str, dict]:
    """Parse empathy.ini → {group_nick: {object_destruction, mission_success, empathy: {nick: rate}}}."""
    factions: dict[str, dict] = {}
    for sec, entries in parse_ini(empathy_path):
        if sec != "RepChangeEffects":
            continue
        group = ""
        obj_dest = 0.0
        mission_success = 0.0
        mission_failure = 0.0
        mission_abort = 0.0
        empathy: dict[str, float] = {}
        for k, v in entries:
            kl = k.lower()
            if kl == "group":
                group = v.strip().lower()
            elif kl == "event":
                parts = [p.strip() for p in v.split(",")]
                if len(parts) >= 2:
                    event_type = parts[0].lower()
                    try:
                        val = float(parts[1])
                    except ValueError:
                        val = 0.0
                    if event_type == "object_destruction":
                        obj_dest = val
                    elif event_type == "random_mission_success":
                        mission_success = val
                    elif event_type == "random_mission_failure":
                        mission_failure = val
                    elif event_type == "random_mission_abortion":
                        mission_abort = val
            elif kl == "empathy_rate":
                parts = [p.strip() for p in v.split(",")]
                if len(parts) >= 2:
                    target = parts[0].lower()
                    try:
                        rate = float(parts[1])
                    except ValueError:
                        rate = 0.0
                    if rate != 0.0:
                        empathy[target] = rate
        if group:
            factions[group] = {
                "object_destruction": obj_dest,
                "mission_success": mission_success,
                "mission_failure": mission_failure,
                "mission_abort": mission_abort,
                "empathy": empathy,
            }
    return factions


def extract_faction_props(fp_path: Path) -> dict[str, dict]:
    """Parse faction_prop.ini → {nick: {legality, has_npc_ships}}."""
    props: dict[str, dict] = {}
    for sec, entries in parse_ini(fp_path):
        if sec != "FactionProps":
            continue
        vals_list = entries
        aff = ""
        legality = "unlawful"
        has_npc = False
        for k, v in vals_list:
            kl = k.lower()
            if kl == "affiliation":
                aff = v.strip().lower()
            elif kl == "legality":
                legality = v.strip().lower()
            elif kl == "npc_ship":
                has_npc = True
        if aff:
            props[aff] = {"legality": legality, "has_npc_ships": has_npc}
    return props


def extract_base_names(
    uni_path: Path, res: DLLResolver | None
) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """Parse universe.ini → base names, base→system mapping, system names.

    Returns:
        base_names:   {base_nick_lower: display_name}
        base_system:  {base_nick_lower: system_nick_lower}
        system_names: {system_nick_lower: display_name}
    """
    bases: dict[str, str] = {}
    base_sys: dict[str, str] = {}
    systems: dict[str, str] = {}
    if not uni_path.exists() or res is None:
        return bases, base_sys, systems
    for sec, entries in parse_ini(uni_path):
        sl = sec.lower()
        if sl == "base":
            vals = {k.lower(): v for k, v in entries}
            nick = vals.get("nickname", "").strip()
            strid = vals.get("strid_name", "")
            sys_nick = vals.get("system", "").strip()
            name = res.get(strid) or nick
            if nick:
                bases[nick.lower()] = name
                if sys_nick:
                    base_sys[nick.lower()] = sys_nick.lower()
        elif sl == "system":
            vals = {k.lower(): v for k, v in entries}
            nick = vals.get("nickname", "").strip()
            strid = vals.get("strid_name", "")
            name = res.get(strid) or nick
            if nick:
                systems[nick.lower()] = name
    return bases, base_sys, systems


def extract_bribes(
    mbases_path: Path, base_names: dict[str, str]
) -> dict[str, list[str]]:
    """Parse mbases.ini [GF_NPC] sections → {bribed_faction_nick: [base_display_name, ...]}.

    Returns deduplicated base names per faction.
    """
    if not mbases_path.exists():
        return {}

    sections = parse_ini(mbases_path)
    current_base = ""
    # faction → set of base display names
    bribes: dict[str, set[str]] = {}

    for sec, entries in sections:
        if sec == "MBase":
            for k, v in entries:
                if k.lower() == "nickname":
                    current_base = v.strip()
        elif sec == "GF_NPC":
            for k, v in entries:
                if k.lower() == "bribe":
                    parts = [p.strip() for p in v.split(",")]
                    if len(parts) >= 2:
                        faction_nick = parts[0].lower()
                        base_display = base_names.get(
                            current_base.lower(), current_base
                        )
                        if faction_nick not in bribes:
                            bribes[faction_nick] = set()
                        bribes[faction_nick].add(base_display)

    return {nick: sorted(bases) for nick, bases in bribes.items()}


def extract_mission_bases(
    mbases_path: Path,
    base_names: dict[str, str],
    base_system: dict[str, str],
    system_names: dict[str, str],
) -> dict[str, list[str]]:
    """Parse mbases.ini GF_NPC sections for mission-offering NPCs.

    Returns {faction_nick: ["System → Base", ...]}.
    """
    if not mbases_path.exists():
        return {}

    sections = parse_ini(mbases_path)
    current_base = ""
    missions: dict[str, set[str]] = {}

    for sec, entries in sections:
        if sec == "MBase":
            for k, v in entries:
                if k.lower() == "nickname":
                    current_base = v.strip()
        elif sec == "GF_NPC":
            has_missions = False
            affiliation = ""
            for k, v in entries:
                kl = k.lower()
                if kl == "affiliation":
                    affiliation = v.strip().lower()
                elif kl == "misn":
                    has_missions = True
            if has_missions and affiliation:
                base_lower = current_base.lower()
                sys_nick = base_system.get(base_lower, "")
                sys_name = system_names.get(sys_nick, sys_nick)
                base_name = base_names.get(base_lower, current_base)
                label = f"{sys_name} \u2192 {base_name}"
                if affiliation not in missions:
                    missions[affiliation] = set()
                missions[affiliation].add(label)

    return {nick: sorted(locs) for nick, locs in missions.items()}


def extract_default_rep(fl_root: Path) -> dict[str, float]:
    """Parse mpnewcharacter.fl for the player's default starting reputation.

    Returns {faction_nick: rep_value}.
    """
    # Try common locations
    for candidate in [
        fl_root / "EXE" / "mpnewcharacter.fl",
        fl_root / "mpnewcharacter.fl",
    ]:
        if candidate.exists():
            break
    else:
        return {}

    reps: dict[str, float] = {}
    try:
        raw = candidate.read_bytes()
        text = raw.decode("utf-8", errors="ignore")
    except Exception:
        return {}

    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith(";"):
            continue
        if not line.lower().startswith("house"):
            continue
        _, _, value = line.partition("=")
        parts = [p.strip() for p in value.split(",")]
        if len(parts) >= 2:
            try:
                rep_val = float(parts[0])
            except ValueError:
                continue
            nick = parts[1].strip().lower()
            if nick:
                reps[nick] = rep_val
    return reps


# ── Main Export ──────────────────────────────────────────────────


def export_mod(install: dict) -> None:
    mod_id = install["id"]
    mod_name = install["name"]
    fl_root = Path(install["path"])
    print(f"\n{'='*60}")
    print(f"  Exporting reputation data: {mod_name}")
    print(f"{'='*60}")

    # ── Locate files ──
    iw_path = fl_root / "DATA" / "InitialWorld.ini"
    if not iw_path.exists():
        iw_path = fl_root / "DATA" / "initialworld.ini"
    empathy_path = fl_root / "DATA" / "MISSIONS" / "empathy.ini"
    fp_path = fl_root / "DATA" / "MISSIONS" / "faction_prop.ini"

    for p, label in [
        (iw_path, "InitialWorld.ini"),
        (empathy_path, "empathy.ini"),
        (fp_path, "faction_prop.ini"),
    ]:
        if not p.exists():
            print(f"  ✗ Missing {label}: {p}")
            return
        print(f"  ✓ {label}")

    # ── DLL resolver for faction names ──
    fl_ini_path = fl_root / "EXE" / "Freelancer.ini"
    if not fl_ini_path.exists():
        fl_ini_path = fl_root / "Freelancer.ini"
    if fl_ini_path.exists():
        fl_ini_sections = parse_ini(fl_ini_path)
        dll_paths = get_dll_paths(fl_ini_path, fl_ini_sections)
    else:
        dll_paths = []
    res = DLLResolver(dll_paths) if dll_paths else None

    # ── Extract data ──
    names = extract_faction_names(iw_path, res) if res else {}
    empathy = extract_empathy(empathy_path)
    props = extract_faction_props(fp_path)
    default_rep = extract_default_rep(fl_root)

    # ── Bribes / base names ──
    mbases_path = fl_root / "DATA" / "MISSIONS" / "mbases.ini"
    uni_path = fl_root / "DATA" / "UNIVERSE" / "universe.ini"
    if not uni_path.exists():
        uni_path = fl_root / "DATA" / "Universe" / "universe.ini"
    base_names, base_system, system_names = extract_base_names(uni_path, res)
    faction_bribes = extract_bribes(mbases_path, base_names)
    faction_missions = extract_mission_bases(
        mbases_path, base_names, base_system, system_names
    )
    if mbases_path.exists():
        print(f"  ✓ mbases.ini  ({sum(len(v) for v in faction_bribes.values())} bribe locations, "
              f"{sum(len(v) for v in faction_missions.values())} mission locations)")
    if uni_path.exists():
        print(f"  ✓ universe.ini ({len(base_names)} bases, {len(system_names)} systems)")

    # ── Determine which factions are changeable ──
    # A faction's rep CAN change if:
    #   - It appears in empathy.ini (has object_destruction) → direct kills affect it
    #   - OR it appears as empathy_rate target of any faction → indirect effect
    empathy_targets: set[str] = set()
    for data in empathy.values():
        empathy_targets.update(data["empathy"].keys())

    # All known factions = union of all sources
    all_nicks = set(names.keys()) | set(empathy.keys()) | set(props.keys()) | set(default_rep.keys())

    # ── Build output ──
    factions = []
    for nick in sorted(all_nicks):
        name_info = names.get(nick, {})
        emp_data = empathy.get(nick, {})
        prop_data = props.get(nick, {})

        display_name = name_info.get("name", nick)
        short_name = name_info.get("short_name", "")
        legality = prop_data.get("legality", "unlawful")
        has_npc = prop_data.get("has_npc_ships", False)
        obj_dest = emp_data.get("object_destruction", 0.0)

        # Shootable: has NPC ships AND appears in empathy.ini
        shootable = has_npc and nick in empathy and obj_dest != 0.0

        # Changeable: appears in empathy (can be directly affected) OR is target of empathy cascades
        changeable = (nick in empathy and obj_dest != 0.0) or nick in empathy_targets

        faction_entry: dict = {
            "nick": nick,
            "name": display_name,
            "legality": legality,
            "shootable": shootable,
            "changeable": changeable,
            "defaultRep": round(default_rep.get(nick, 0.0), 4),
        }
        if short_name:
            faction_entry["shortName"] = short_name

        # Include empathy data for all factions that have events in empathy.ini
        # (needed for both kills AND missions)
        if nick in empathy:
            if obj_dest != 0.0:
                faction_entry["objectDestruction"] = round(obj_dest, 6)
            ms = emp_data.get("mission_success", 0.0)
            if ms != 0.0:
                faction_entry["missionSuccess"] = round(ms, 6)
            mf = emp_data.get("mission_failure", 0.0)
            if mf != 0.0:
                faction_entry["missionFailure"] = round(mf, 6)
            ma = emp_data.get("mission_abort", 0.0)
            if ma != 0.0:
                faction_entry["missionAbort"] = round(ma, 6)
            faction_entry["empathy"] = {
                k: round(v, 6) for k, v in emp_data.get("empathy", {}).items()
            }

        # Include bribe locations
        if nick in faction_bribes:
            faction_entry["bribes"] = faction_bribes[nick]

        # Include mission base locations
        if nick in faction_missions:
            faction_entry["missionBases"] = faction_missions[nick]

        factions.append(faction_entry)

    output = {"mod": mod_name, "factions": factions}

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"{mod_id}.json"
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

    shootable_count = sum(1 for f in factions if f["shootable"])
    changeable_count = sum(1 for f in factions if f["changeable"])
    bribeable_count = sum(1 for f in factions if "bribes" in f)
    missionable_count = sum(1 for f in factions if "missionSuccess" in f)
    locked_count = len(factions) - changeable_count
    print(f"\n  → {len(factions)} factions total")
    print(f"    {shootable_count} shootable, {missionable_count} missionable, {bribeable_count} bribeable")
    print(f"    {changeable_count} changeable, {locked_count} locked")
    print(f"  → Saved: {out_path}")

    if res:
        res.close()

    # ── English names (for vanilla only) ──
    if mod_id == "vanilla" and EN_INSTALL_PATH.exists():
        print("\n  Loading English names...")
        en_fl_ini = EN_INSTALL_PATH / "EXE" / "Freelancer.ini"
        if en_fl_ini.exists():
            en_sections = parse_ini(en_fl_ini)
            en_dll_paths = get_dll_paths(en_fl_ini, en_sections)
            en_res = DLLResolver(en_dll_paths) if en_dll_paths else None
        else:
            en_res = None

        if en_res:
            en_iw = EN_INSTALL_PATH / "DATA" / "InitialWorld.ini"
            if not en_iw.exists():
                en_iw = EN_INSTALL_PATH / "DATA" / "initialworld.ini"
            en_names = extract_faction_names(en_iw, en_res) if en_iw.exists() else {}

            en_uni = EN_INSTALL_PATH / "DATA" / "UNIVERSE" / "universe.ini"
            if not en_uni.exists():
                en_uni = EN_INSTALL_PATH / "DATA" / "Universe" / "universe.ini"
            en_base_names, en_base_system, en_system_names = extract_base_names(en_uni, en_res)

            en_mbases = EN_INSTALL_PATH / "DATA" / "MISSIONS" / "mbases.ini"
            en_bribes = extract_bribes(en_mbases, en_base_names)
            en_missions = extract_mission_bases(en_mbases, en_base_names, en_base_system, en_system_names)

            for faction_entry in output["factions"]:
                nick = faction_entry["nick"]
                en_info = en_names.get(nick, {})
                en_name = en_info.get("name", "")
                en_short = en_info.get("short_name", "")
                if en_name and en_name != faction_entry.get("name"):
                    faction_entry["nameEn"] = en_name
                if en_short and en_short != faction_entry.get("shortName", ""):
                    faction_entry["shortNameEn"] = en_short
                if nick in en_bribes:
                    faction_entry["bribesEn"] = en_bribes[nick]
                if nick in en_missions:
                    faction_entry["missionBasesEn"] = en_missions[nick]

            en_count = sum(1 for f in output["factions"] if "nameEn" in f)
            print(f"  → {en_count} factions with English names added")
            en_res.close()

            # Re-write updated JSON
            out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"  → Re-saved with English names: {out_path}")


def main() -> None:
    for install in INSTALLATIONS:
        try:
            export_mod(install)
        except Exception as e:
            print(f"\n  ✗ Error processing {install['name']}: {e}")
            import traceback
            traceback.print_exc()
    print("\nDone.")


if __name__ == "__main__":
    main()
