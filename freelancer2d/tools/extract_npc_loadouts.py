#!/usr/bin/env python3
import json
from pathlib import Path

from fl_config import freelancer_data, output_data_dir

FL_DATA = freelancer_data()
OUTPUT = output_data_dir(Path(__file__).resolve().parents[1] / 'data') / 'npc_loadouts.js'


def parse_ini_sections(path: Path) -> list[tuple[str, dict[str, list[str]]]]:
    sections: list[tuple[str, dict[str, list[str]]]] = []
    current_section = ''
    current_props: dict[str, list[str]] = {}
    with path.open('r', encoding='utf-8', errors='ignore') as handle:
        for raw_line in handle:
            line = raw_line.split(';', 1)[0].strip()
            if not line:
                continue
            if line.startswith('[') and line.endswith(']'):
                if current_section:
                    sections.append((current_section, current_props))
                current_section = line[1:-1].strip()
                current_props = {}
            elif '=' in line and current_section:
                key, value = [part.strip() for part in line.split('=', 1)]
                current_props.setdefault(key.lower(), []).append(value)
    if current_section:
        sections.append((current_section, current_props))
    return sections


def first(props: dict[str, list[str]], key: str, default: str = '') -> str:
    values = props.get(key.lower()) or []
    return values[0].strip() if values else default


def all_values(props: dict[str, list[str]], key: str) -> list[str]:
    return [value.strip() for value in props.get(key.lower(), []) if value.strip()]


def parse_equip(value: str) -> dict:
    parts = [part.strip() for part in value.split(',')]
    return {
        'id': parts[0].lower() if parts else '',
        'hardpoint': parts[1] if len(parts) > 1 else ''
    }


def parse_level(value: str) -> int:
    value = value.strip().lower()
    if value.startswith('d'):
        value = value[1:]
    try:
        return int(value)
    except ValueError:
        return 1


def load_ship_archetypes() -> set[str]:
    result: set[str] = set()
    for shiparch in FL_DATA.glob('SHIPS/**/shiparch.ini'):
        for section, props in parse_ini_sections(shiparch):
            if section.lower() == 'ship':
                nickname = first(props, 'nickname').lower()
                if nickname:
                    result.add(nickname)
    return result


def load_loadouts() -> dict[str, dict]:
    loadouts: dict[str, dict] = {}
    loadout_files = list((FL_DATA / 'SHIPS').glob('loadouts*.ini')) + list((FL_DATA / 'SOLAR').glob('loadouts*.ini'))
    for path in sorted(loadout_files):
        for section, props in parse_ini_sections(path):
            if section.lower() != 'loadout':
                continue
            nickname = first(props, 'nickname').lower()
            if not nickname:
                continue
            equips = [parse_equip(value) for value in all_values(props, 'equip')]
            loadouts[nickname] = {
                'id': nickname,
                'archetype': first(props, 'archetype').lower(),
                'weapons': [item for item in equips if item['hardpoint'].lower().startswith(('hpweapon', 'hpturret'))],
                'shields': [item for item in equips if item['hardpoint'].lower().startswith('hpshield')],
                'thrusters': [item for item in equips if item['hardpoint'].lower().startswith('hpthruster')],
                'sourceFile': str(path.relative_to(FL_DATA)).replace('\\', '/')
            }
    return loadouts


def load_npc_ships(ship_archetypes: set[str], loadouts: dict[str, dict]) -> list[dict]:
    npc_ships: list[dict] = []
    for path in sorted((FL_DATA / 'MISSIONS').glob('**/npcships.ini')):
        for section, props in parse_ini_sections(path):
            if section.lower() != 'npcshiparch':
                continue
            nickname = first(props, 'nickname').lower()
            loadout_id = first(props, 'loadout').lower()
            ship_id = first(props, 'ship_archetype').lower()
            if not nickname or not loadout_id or not ship_id:
                continue
            loadout = loadouts.get(loadout_id)
            if ship_id not in ship_archetypes or not loadout:
                continue
            npc_ships.append({
                'id': nickname,
                'loadout': loadout_id,
                'ship': ship_id,
                'level': parse_level(first(props, 'level', 'd1')),
                'classes': all_values(props, 'npc_class'),
                'sourceFile': str(path.relative_to(FL_DATA)).replace('\\', '/')
            })
    npc_ships.sort(key=lambda item: (item['level'], item['ship'], item['id']))
    return npc_ships


def main() -> None:
    ship_archetypes = load_ship_archetypes()
    loadouts = load_loadouts()
    npc_ships = load_npc_ships(ship_archetypes, loadouts)
    payload = {
        'loadouts': loadouts,
        'ships': npc_ships
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open('w', encoding='utf-8') as handle:
        handle.write('// Auto-generated NPC ship and loadout data from Freelancer\n')
        handle.write('const FL_NPC_LOADOUTS = ')
        json.dump(payload['loadouts'], handle, indent=2, ensure_ascii=False)
        handle.write(';\n\nconst FL_NPC_SHIPS = ')
        json.dump(payload['ships'], handle, indent=2, ensure_ascii=False)
        handle.write(';\n')
    print(f'Saved {len(npc_ships)} NPC ship archetypes and {len(loadouts)} loadouts to {OUTPUT}')


if __name__ == '__main__':
    main()