#!/usr/bin/env python3
"""
Freelancer Data Extractor v8
Fixed: Parse Trade Lane Rings properly with next_ring/prev_ring connections.
Builds trade lane groups from connected rings.
"""

import os
import re
import json
from pathlib import Path
from typing import Optional, Dict, List, Set

from fl_config import freelancer_data, freelancer_exe, freelancer_root, output_data_dir

try:
    import pefile
except ImportError:
    pefile = None

# Base paths
FL_ROOT = freelancer_root()
FL_DATA = freelancer_data()
FL_EXE = freelancer_exe()
UNIVERSE_DIR = FL_DATA / 'UNIVERSE'
RESOURCE_STRINGS = {}
RESOURCE_INFOCARDS = {}
SOLAR_ARCH = {}

JUMP_GATE_ARCHETYPES = {
    'jumpgate',
    'nomad_gate',
    'nomad_gate2',
    'dkjumpgate',
    'vortex',
    'blhazard2',
    'track_ring2',
    'track_ring2coal',
}

def resource_dll_paths() -> list[Path]:
    """Load resource DLLs in freelancer.ini order so mod-specific text DLLs resolve correctly."""
    freelancer_ini = FL_EXE / 'freelancer.ini'
    dll_paths: list[Path] = []
    seen: set[Path] = set()

    if freelancer_ini.exists():
        in_resources = False
        for raw_line in freelancer_ini.read_text(encoding='utf-8', errors='ignore').splitlines():
            line = raw_line.split(';', 1)[0].strip()
            if not line:
                continue
            if line.startswith('[') and line.endswith(']'):
                in_resources = line[1:-1].strip().lower() == 'resources'
                continue
            if not in_resources or '=' not in line:
                continue
            key, value = line.split('=', 1)
            if key.strip().lower() != 'dll':
                continue
            dll_name = value.split(',', 1)[0].strip()
            if not dll_name:
                continue
            candidate = (FL_EXE / dll_name).resolve() if not Path(dll_name).is_absolute() else Path(dll_name).resolve()
            if candidate.exists() and candidate not in seen:
                seen.add(candidate)
                dll_paths.append(candidate)

    fallback_names = [
        'infocards.dll',
        'misctext.dll',
        'nameresources.dll',
        'equipresources.dll',
        'offerbriberesources.dll',
        'misctextinfo2.dll',
        'controls.dll',
    ]
    for name in fallback_names:
        candidate = (FL_EXE / name).resolve()
        if candidate.exists() and candidate not in seen:
            seen.add(candidate)
            dll_paths.append(candidate)

    return dll_paths

def parse_ini_file_with_duplicates(filepath: Path) -> list:
    """Parse a Freelancer INI file, handling duplicate section names like [Object]."""
    sections = []
    current_section = None
    current_props = {}
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith(';') or line.startswith('#'):
                    continue
                
                if line.startswith('[') and line.endswith(']'):
                    if current_section is not None:
                        sections.append((current_section, current_props))
                    
                    current_section = line[1:-1]
                    current_props = {}
                elif '=' in line and current_section is not None:
                    parts = line.split('=', 1)
                    if len(parts) == 2:
                        key = parts[0].strip()
                        value = parts[1].strip()
                        if key in current_props:
                            existing = current_props[key]
                            if isinstance(existing, list):
                                existing.append(value)
                            else:
                                current_props[key] = [existing, value]
                        else:
                            current_props[key] = value
        
        if current_section is not None:
            sections.append((current_section, current_props))
    
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    
    return sections

def get_prop(props: dict, key: str, default=''):
    """Get property, handling case sensitivity."""
    if key in props:
        value = props[key]
        return value[-1] if isinstance(value, list) and value else value
    lower_key = key.lower()
    if lower_key in props:
        value = props[lower_key]
        return value[-1] if isinstance(value, list) and value else value
    upper_key = key.upper()
    if upper_key in props:
        value = props[upper_key]
        return value[-1] if isinstance(value, list) and value else value
    return default

def get_all_props(props: dict, key: str) -> list[str]:
    """Get all values for a possibly repeated property."""
    for candidate in (key, key.lower(), key.upper()):
        if candidate in props:
            value = props[candidate]
            return value if isinstance(value, list) else [value]
    return []

def parse_float(value: str, default: float = 0.0) -> float:
    try:
        return float(str(value).split(',', 1)[0].strip())
    except Exception:
        return default

def load_solar_arch() -> dict:
    solar = {}
    solararch = FL_DATA / 'SOLAR' / 'solararch.ini'
    for section_name, props in parse_ini_file_with_duplicates(solararch):
        if section_name.lower() != 'solar':
            continue
        nickname = get_prop(props, 'nickname', '').lower()
        if not nickname:
            continue
        solar[nickname] = {
            'nickname': nickname,
            'type': get_prop(props, 'type', '').upper(),
            'ids_name': get_prop(props, 'ids_name', ''),
            'ids_info': get_prop(props, 'ids_info', ''),
            'solar_radius': parse_float(get_prop(props, 'solar_radius', ''), 600),
            'shape_name': get_prop(props, 'shape_name', ''),
            'da_archetype': get_prop(props, 'DA_archetype', get_prop(props, 'da_archetype', '')),
        }
    return solar

def solar_info(archetype: str) -> dict:
    return SOLAR_ARCH.get(str(archetype or '').lower(), {})

def object_reputation(props: dict) -> str:
    return get_prop(props, 'reputation', get_prop(props, 'faction', '')).split(',', 1)[0].strip()

def is_true_planet_archetype(archetype: str, solar_type: str) -> bool:
    value = str(archetype or '').lower()
    return solar_type == 'PLANET' or value.startswith('planet_') or value.startswith('planetform_')

def is_true_sun_archetype(archetype: str, solar_type: str) -> bool:
    value = str(archetype or '').lower()
    return solar_type == 'SUN' or value.startswith('sun_')

def extract_string_table(dll_path: Path) -> dict:
    """Extract string table resources from a Windows DLL."""
    if not pefile or not dll_path.exists():
        return {}

    import struct

    strings = {}
    try:
        pe = pefile.PE(str(dll_path), fast_load=False)
        if not hasattr(pe, 'DIRECTORY_ENTRY_RESOURCE'):
            return strings

        for type_entry in pe.DIRECTORY_ENTRY_RESOURCE.entries:
            if type_entry.id != 6:  # RT_STRING
                continue
            for name_entry in type_entry.directory.entries:
                block_id = name_entry.id
                for lang_entry in name_entry.directory.entries:
                    data = pe.get_data(
                        lang_entry.data.struct.OffsetToData,
                        lang_entry.data.struct.Size
                    )
                    offset = 0
                    for index in range(16):
                        if offset + 2 > len(data):
                            break
                        length = struct.unpack_from('<H', data, offset)[0]
                        offset += 2
                        raw = data[offset:offset + length * 2]
                        offset += length * 2
                        if length:
                            strings[(block_id - 1) * 16 + index] = raw.decode('utf-16le', errors='ignore').strip()
    except Exception as exc:
        print(f"   Warning: could not read resource strings from {dll_path.name}: {exc}")

    return strings

def decode_resource_text(data: bytes) -> str:
    if data.startswith(b'\xff\xfe') or data.startswith(b'\xfe\xff'):
        return data.decode('utf-16', errors='ignore')
    try:
        return data.decode('utf-8', errors='ignore')
    except UnicodeDecodeError:
        return data.decode('latin-1', errors='ignore')

def strip_rdl_text(text: str) -> str:
    """Convert Freelancer RDL/HTML infocards into compact plain text."""
    text = re.sub(r'<PARA\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<TEXT[^>]*>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'</TEXT>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
    lines = [re.sub(r'\s+', ' ', line).strip() for line in text.splitlines()]
    return '\n'.join(line for line in lines if line)

def extract_html_resources(dll_path: Path) -> dict:
    """Extract RT_HTML/RDL infocard resources from a Windows DLL."""
    if not pefile or not dll_path.exists():
        return {}

    cards = {}
    try:
        pe = pefile.PE(str(dll_path), fast_load=False)
        if not hasattr(pe, 'DIRECTORY_ENTRY_RESOURCE'):
            return cards

        for type_entry in pe.DIRECTORY_ENTRY_RESOURCE.entries:
            if type_entry.id != 23:  # RT_HTML
                continue
            for name_entry in type_entry.directory.entries:
                for lang_entry in name_entry.directory.entries:
                    raw = pe.get_data(
                        lang_entry.data.struct.OffsetToData,
                        lang_entry.data.struct.Size
                    )
                    text = strip_rdl_text(decode_resource_text(raw))
                    if text:
                        cards[name_entry.id] = text
    except Exception as exc:
        print(f"   Warning: could not read infocards from {dll_path.name}: {exc}")

    return cards

def load_resource_strings() -> dict:
    """Load Freelancer ids_name/strid_name resources according to freelancer.ini order."""
    resources = {}
    for dll_index, dll_path in enumerate(resource_dll_paths(), start=1):
        dll_strings = extract_string_table(dll_path)
        for string_id, text in dll_strings.items():
            if text:
                resources[dll_index * 65536 + string_id] = text
    return resources

def load_resource_infocards() -> dict:
    """Load Freelancer ids_info HTML resources according to freelancer.ini order."""
    resources = {}
    for dll_index, dll_path in enumerate(resource_dll_paths(), start=1):
        dll_cards = extract_html_resources(dll_path)
        for card_id, text in dll_cards.items():
            if text:
                resources[dll_index * 65536 + card_id] = text
    return resources

def resolve_id(value: str, fallback: str = '') -> str:
    """Resolve a Freelancer numeric resource id to display text."""
    if value is None:
        return fallback
    text = str(value).strip()
    if not text:
        return fallback
    try:
        numeric_id = int(text)
    except ValueError:
        return text
    return RESOURCE_STRINGS.get(numeric_id) or fallback or text

def resolve_info(value: str) -> str:
    if value is None:
        return ''
    text = str(value).strip()
    if not text:
        return ''
    try:
        numeric_id = int(text)
    except ValueError:
        return text
    return RESOURCE_INFOCARDS.get(numeric_id, '')

def parse_position_3d(pos_str: str) -> tuple:
    """Parse position string 'x, y, z' to (x, y, z) tuple."""
    if not pos_str:
        return (0, 0, 0)
    try:
        parts = pos_str.split(',')
        if len(parts) >= 3:
            return (float(parts[0].strip()), float(parts[1].strip()), float(parts[2].strip()))
        elif len(parts) >= 2:
            return (float(parts[0].strip()), float(parts[1].strip()), 0)
    except:
        pass
    return (0, 0, 0)

def parse_rotation_y(rotate_str: str) -> float:
    """Parse Freelancer rotate 'x, y, z' and return yaw/Y in degrees."""
    if not rotate_str:
        return 0
    try:
        parts = rotate_str.split(',')
        if len(parts) >= 2:
            return float(parts[1].strip())
    except:
        pass
    return 0

def parse_position_2d(pos_str: str) -> tuple:
    """Parse position string 'x, y' to (x, y) tuple for universe map."""
    if not pos_str:
        return (0, 0)
    try:
        parts = pos_str.split(',')
        if len(parts) >= 2:
            return (float(parts[0].strip()), float(parts[1].strip()))
    except:
        pass
    return (0, 0)

def is_jump_gate_archetype(archetype: str) -> bool:
    return str(archetype or '').strip().lower() in JUMP_GATE_ARCHETYPES

def is_jump_hole_archetype(archetype: str) -> bool:
    return str(archetype or '').strip().lower().startswith('jumphole')

def is_jump_connection_archetype(archetype: str) -> bool:
    return is_jump_gate_archetype(archetype) or is_jump_hole_archetype(archetype)

def sector_display_name(sector_key: str) -> str:
    text = str(sector_key or '').strip()
    if not text:
        return 'Sirius'
    if text.lower() == 'universe':
        return 'Sirius'
    match = re.match(r'^sector(\d+)$', text, re.IGNORECASE)
    if match:
        return f"Sector {int(match.group(1))}"
    return text

def extract_multiuniverse_map(system_lookup: dict[str, dict]) -> list[dict]:
    """Extract Crossfire multiverse sector layout and per-sector system coordinates."""
    multiuniverse_ini = UNIVERSE_DIR / 'multiuniverse.ini'
    if not multiuniverse_ini.exists():
        return []

    sections = parse_ini_file_with_duplicates(multiuniverse_ini)
    layout_name = ''
    sector_layouts: dict[str, dict] = {}
    sector_entries: list[dict] = []

    for section_name, props in sections:
        section_lower = section_name.lower()
        if section_lower == 'const':
            prettymap = get_prop(props, 'prettymap', '')
            layout_name = prettymap.split(',', 1)[-1].strip().lower() if prettymap else ''
            continue

        if layout_name and section_lower == layout_name:
            for mapping in get_all_props(props, 'mapping'):
                parts = [part.strip() for part in str(mapping).split(',')]
                if len(parts) < 3:
                    continue
                key = parts[0].lower()
                sector_layouts[key] = {
                    'x': parse_float(parts[1]),
                    'y': parse_float(parts[2]),
                }
            continue

        if section_lower != 'sector':
            continue

        sector_key = get_prop(props, 'mapping', '').split(',', 1)[0].strip().lower()
        if not sector_key:
            continue

        labels = []
        label_texts = []
        for label in get_all_props(props, 'label'):
            parts = [part.strip() for part in str(label).split(',')]
            if not parts:
                continue
            label_id = parts[0]
            text = resolve_id(label_id, label_id)
            if text:
                label_texts.append(text)
            labels.append({
                'id': label_id,
                'text': text,
                'x': parse_float(parts[1]) if len(parts) > 1 else 0.0,
                'y': parse_float(parts[2]) if len(parts) > 2 else 0.0,
            })

        sector_systems = []
        for system in get_all_props(props, 'system'):
            parts = [part.strip() for part in str(system).split(',')]
            if len(parts) < 3:
                continue
            nickname = parts[0]
            if not nickname:
                continue
            base = system_lookup.get(nickname.lower(), {})
            sector_systems.append({
                'nickname': nickname,
                'name': base.get('name', nickname),
                'strid_name': base.get('strid_name', ''),
                'ids_info': base.get('ids_info', ''),
                'info': base.get('info', ''),
                'x': parse_float(parts[1]),
                'z': parse_float(parts[2]),
            })

        sector_entries.append({
            'key': sector_key,
            'name': sector_display_name(sector_key),
            'layout': sector_layouts.get(sector_key, {'x': 0.0, 'y': 0.0}),
            'labels': labels,
            'systems': sector_systems,
        })

    return sector_entries

def build_trade_lanes_from_rings(all_rings: list, all_ring_data: dict) -> list:
    """Build trade lane routes from connected rings.
    
    Rings are connected via next_ring/prev_ring properties.
    We build groups of connected rings to form complete trade lanes.
    """
    if not all_rings:
        return []
    
    # Build adjacency graph from next_ring/prev_ring
    ring_connections = {}  # ring_id -> [connected_ring_ids]
    ring_start = {}  # ring_id -> True if it's a start (no prev_ring pointing to it)
    
    for ring in all_rings:
        ring_id = ring['nickname']
        ring_connections[ring_id] = []
        
        # Add next_ring connection
        next_ring = ring.get('next_ring', '')
        if next_ring:
            ring_connections[ring_id].append(next_ring)
        
        # Add prev_ring connection
        prev_ring = ring.get('prev_ring', '')
        if prev_ring:
            ring_connections[ring_id].append(prev_ring)
    
    # Find start rings (those that have prev_ring but no one points to them as prev)
    for ring in all_rings:
        ring_id = ring['nickname']
        prev_ring = ring.get('prev_ring', '')
        
        # If this ring has a prev_ring, it means it's not a start of a chain
        # But if no other ring has this as next_ring, it could be a start
        has_incoming = False
        for other_ring in all_rings:
            if other_ring.get('next_ring', '') == ring_id:
                has_incoming = True
                break
        
        if not has_incoming and prev_ring:
            ring_start[ring_id] = True
    
    # BFS to find all connected chains
    visited = set()
    chains = []
    
    def follow_chain(start_ring_id):
        """Follow the chain from a starting ring."""
        chain = []
        current = start_ring_id
        
        # Go backward first to find true start
        while True:
            ring_data = all_ring_data.get(current, {})
            prev_ring = ring_data.get('prev_ring', '')
            
            # Check if any ring points to current as next
            has_prev = False
            for r in all_rings:
                if r.get('next_ring', '') == current:
                    has_prev = True
                    break
            
            if prev_ring and not has_prev:
                current = prev_ring
            else:
                break
        
        # Now follow forward to build the chain
        while current:
            if current in visited:
                break
            visited.add(current)
            
            ring_data = all_ring_data.get(current, {})
            chain.append(ring_data)
            
            next_ring = ring_data.get('next_ring', '')
            if next_ring and next_ring not in visited:
                current = next_ring
            else:
                break
        
        return chain
    
    # Start chains from rings that have prev_ring but no incoming
    for ring in all_rings:
        ring_id = ring['nickname']
        prev_ring = ring.get('prev_ring', '')
        
        # Check if this is a start of a chain
        has_incoming = False
        for other_ring in all_rings:
            if other_ring.get('next_ring', '') == ring_id:
                has_incoming = True
                break
        
        if prev_ring and not has_incoming and ring_id not in visited:
            chain = follow_chain(ring_id)
            if len(chain) > 1:
                chains.append({
                    'rings': chain,
                    'start_station': chain[0].get('start_station', ''),
                    'end_station': chain[-1].get('end_station', '')
                })
    
    # Also check rings without prev_ring (might be standalone routes)
    for ring in all_rings:
        ring_id = ring['nickname']
        if ring_id not in visited and ring.get('next_ring', ''):
            chain = follow_chain(ring_id)
            if len(chain) > 1:
                chains.append({
                    'rings': chain,
                    'start_station': chain[0].get('start_station', ''),
                    'end_station': chain[-1].get('end_station', '')
                })
    
    return chains

def extract_system_data(system_name: str) -> dict:
    """Extract all data for a single system from its .ini file."""
    system_dir = UNIVERSE_DIR / 'SYSTEMS' / system_name
    system_ini = system_dir / f'{system_name.lower()}.ini'
    
    result = {
        'nickname': system_name,
        'name': system_name.replace('_', ' ').title(),
        'jumpgates': [],
        'jumpholes': [],
        'stations': [],
        'planets': [],
        'suns': [],
        'tradelanes': [],
        'asteroidfields': [],
        'nebulae': [],
        'zones': [],
        'missionZones': [],
        'populationZones': []
    }
    
    if not system_ini.exists():
        print(f"   Warning: {system_name.lower()}.ini not found")
        return result
    
    sections = parse_ini_file_with_duplicates(system_ini)
    
    obj_counter = {}
    zone_map = {}
    all_trade_lane_rings = []
    ring_data_by_id = {}
    
    # First pass: collect all [zone] sections
    for section_name, props in sections:
        section_lower = section_name.lower()
        
        if section_lower == 'zone':
            zone_nickname = get_prop(props, 'zone', get_prop(props, 'nickname', ''))
            if zone_nickname:
                zone_map[zone_nickname] = {
                    'nickname': zone_nickname,
                    'name': get_prop(props, 'comment', zone_nickname),
                    'x': 0, 'y': 0, 'z': 0,
                    'size': 1000,
                    'size_x': 1000,
                    'size_y': 1000,
                    'size_z': 1000,
                    'shape': get_prop(props, 'shape', 'ELLIPSOID'),
                    'rotate_y': parse_rotation_y(get_prop(props, 'rotate', '0,0,0')),
                    'sort': get_prop(props, 'sort', '0'),
                    'music': get_prop(props, 'Music', ''),
                    'damage': parse_float(get_prop(props, 'damage', '0'), 0),
                    'interference': parse_float(get_prop(props, 'interference', '0'), 0),
                    'drag_modifier': parse_float(get_prop(props, 'drag_modifier', '1'), 1),
                    'visit': get_prop(props, 'visit', '0')
                }
                pos = parse_position_3d(get_prop(props, 'pos', '0,0,0'))
                zone_map[zone_nickname]['x'] = pos[0]
                zone_map[zone_nickname]['y'] = pos[1]
                zone_map[zone_nickname]['z'] = pos[2]
                size_str = get_prop(props, 'size', '1000')
                if ',' in size_str:
                    sizes = [float(s) for s in size_str.split(',')]
                    zone_map[zone_nickname]['size'] = sizes[0]
                    zone_map[zone_nickname]['size_x'] = sizes[0] if len(sizes) > 0 else sizes[0]
                    zone_map[zone_nickname]['size_y'] = sizes[1] if len(sizes) > 1 else sizes[0]
                    zone_map[zone_nickname]['size_z'] = sizes[2] if len(sizes) > 2 else sizes[0]
                else:
                    try:
                        size = float(size_str)
                        zone_map[zone_nickname]['size'] = size
                        zone_map[zone_nickname]['size_x'] = size
                        zone_map[zone_nickname]['size_y'] = size
                        zone_map[zone_nickname]['size_z'] = size
                    except:
                        pass
                if zone_map[zone_nickname]['damage'] > 0:
                    result['zones'].append(zone_map[zone_nickname])
                if 'destroy_vignette' in zone_nickname.lower():
                    mission_zone = dict(zone_map[zone_nickname])
                    mission_zone['vignette_type'] = get_prop(props, 'vignette_type', '')
                    result['missionZones'].append(mission_zone)
                encounter_values = get_all_props(props, 'encounter')
                faction_values = get_all_props(props, 'faction')
                density = parse_float(get_prop(props, 'density', '0'), 0)
                if encounter_values or faction_values or density > 0:
                    population_zone = dict(zone_map[zone_nickname])
                    population_zone['density'] = density
                    population_zone['population_additive'] = parse_float(get_prop(props, 'population_additive', '0'), 0)
                    population_zone['relief_time'] = parse_float(get_prop(props, 'relief_time', '30'), 30)
                    population_zone['encounters'] = []
                    for value in encounter_values:
                        parts = [part.strip() for part in str(value).split(',')]
                        if not parts or not parts[0]:
                            continue
                        population_zone['encounters'].append({
                            'id': parts[0],
                            'difficulty': parse_float(parts[1], 1) if len(parts) > 1 else 1,
                            'weight': parse_float(parts[2], 1) if len(parts) > 2 else 1,
                        })
                    population_zone['factions'] = []
                    for value in faction_values:
                        parts = [part.strip() for part in str(value).split(',')]
                        if not parts or not parts[0]:
                            continue
                        population_zone['factions'].append({
                            'id': parts[0],
                            'weight': parse_float(parts[1], 1) if len(parts) > 1 else 1,
                        })
                    result['populationZones'].append(population_zone)
    
    # Second pass: process all sections
    for section_name, props in sections:
        section_lower = section_name.lower()
        
        if section_lower == 'archetype':
            continue
        
        if section_lower == 'object':
            if 'object' not in obj_counter:
                obj_counter['object'] = 0
            obj_counter['object'] += 1
            section_name = f"Object_{obj_counter['object']}"
        
        # Handle [Nebula] sections
        if section_lower == 'nebula':
            file_path = get_prop(props, 'file', '')
            zone_ref = get_prop(props, 'zone', '')
            zone_data = zone_map.get(zone_ref, {})
            
            nebula = {
                'nickname': get_prop(props, 'nickname', section_name),
                'name': zone_data.get('name', get_prop(props, 'nickname', section_name)),
                'x': zone_data.get('x', 0),
                'y': zone_data.get('y', 0),
                'z': zone_data.get('z', 0),
                'size': zone_data.get('size', 5000),
                'size_x': zone_data.get('size_x', zone_data.get('size', 5000)),
                'size_y': zone_data.get('size_y', zone_data.get('size', 5000)),
                'size_z': zone_data.get('size_z', zone_data.get('size', 5000)),
                'shape': zone_data.get('shape', 'ELLIPSOID'),
                'rotate_y': zone_data.get('rotate_y', 0),
                'file': file_path,
                'zone': zone_ref
            }
            result['nebulae'].append(nebula)
            continue
        
        # Handle [Asteroids] sections
        if section_lower == 'asteroids':
            file_path = get_prop(props, 'file', '')
            zone_ref = get_prop(props, 'zone', '')
            zone_data = zone_map.get(zone_ref, {})
            
            field = {
                'nickname': get_prop(props, 'nickname', section_name),
                'name': zone_data.get('name', get_prop(props, 'nickname', section_name)),
                'x': zone_data.get('x', 0),
                'y': zone_data.get('y', 0),
                'z': zone_data.get('z', 0),
                'size': zone_data.get('size', 2000),
                'size_x': zone_data.get('size_x', zone_data.get('size', 2000)),
                'size_y': zone_data.get('size_y', zone_data.get('size', 2000)),
                'size_z': zone_data.get('size_z', zone_data.get('size', 2000)),
                'shape': zone_data.get('shape', 'ELLIPSOID'),
                'rotate_y': zone_data.get('rotate_y', 0),
                'file': file_path,
                'zone': zone_ref
            }
            result['asteroidfields'].append(field)
            continue
        
        if section_lower == 'zone':
            continue
        
        # Only process sections that have pos and Archetype
        if not get_prop(props, 'pos'):
            continue
        
        archetype = get_prop(props, 'Archetype', get_prop(props, 'archetype', ''))
        if not archetype:
            continue
        archetype = archetype.lower()
        
        # Trade Lane Rings - collect them for later grouping
        if archetype == 'trade_lane_ring':
            pos = parse_position_3d(get_prop(props, 'pos', '0,0,0'))
            ring = {
                'nickname': get_prop(props, 'nickname', section_name),
                'name': resolve_id(get_prop(props, 'ids_name', ''), get_prop(props, 'nickname', section_name)),
                'ids_name': get_prop(props, 'ids_name', ''),
                'ids_info': get_prop(props, 'ids_info', ''),
                'info': resolve_info(get_prop(props, 'ids_info', '')),
                'x': pos[0], 'y': pos[1], 'z': pos[2],
                'next_ring': get_prop(props, 'next_ring', ''),
                'prev_ring': get_prop(props, 'prev_ring', ''),
                'faction': object_reputation(props),
                'loadout': get_prop(props, 'loadout', ''),
                'rotate_y': 0
            }
            ring['rotate_y'] = parse_rotation_y(get_prop(props, 'rotate', '0,0,0'))
            
            all_trade_lane_rings.append(ring)
            ring_data_by_id[ring['nickname']] = ring
            continue
        
        # Jump Gates
        if is_jump_gate_archetype(archetype):
            arch = solar_info(archetype)
            goto = get_prop(props, 'goto', '')
            goto_parts = goto.split(',')
            dest_system = goto_parts[0].strip() if len(goto_parts) > 0 else ''
            dest_gate = goto_parts[1].strip() if len(goto_parts) > 1 else ''
            
            pos = parse_position_3d(get_prop(props, 'pos', '0,0,0'))
            rotate_y = parse_rotation_y(get_prop(props, 'rotate', '0,0,0'))
            
            gate = {
                'nickname': get_prop(props, 'nickname', section_name),
                'name': resolve_id(get_prop(props, 'ids_name', ''), get_prop(props, 'nickname', section_name)),
                'ids_name': get_prop(props, 'ids_name', ''),
                'ids_info': get_prop(props, 'ids_info', ''),
                'info': resolve_info(get_prop(props, 'ids_info', '')),
                'x': pos[0], 'y': pos[1], 'z': pos[2],
                'archetype': archetype,
                'solar_radius': arch.get('solar_radius', 600),
                'dest_system': dest_system,
                'dest_gate': dest_gate,
                'faction': object_reputation(props),
                'loadout': get_prop(props, 'loadout', ''),
                'rotate_y': rotate_y
            }
            result['jumpgates'].append(gate)
            continue
        
        # Jump Holes
        if is_jump_hole_archetype(archetype):
            arch = solar_info(archetype) or solar_info('jumphole')
            goto = get_prop(props, 'goto', '')
            goto_parts = goto.split(',')
            dest_system = goto_parts[0].strip() if len(goto_parts) > 0 else ''
            dest_hole = goto_parts[1].strip() if len(goto_parts) > 1 else ''
            
            pos = parse_position_3d(get_prop(props, 'pos', '0,0,0'))
            
            hole = {
                'nickname': get_prop(props, 'nickname', section_name),
                'name': resolve_id(get_prop(props, 'ids_name', ''), get_prop(props, 'nickname', section_name)),
                'ids_name': get_prop(props, 'ids_name', ''),
                'ids_info': get_prop(props, 'ids_info', ''),
                'info': resolve_info(get_prop(props, 'ids_info', '')),
                'x': pos[0], 'y': pos[1], 'z': pos[2],
                'archetype': archetype,
                'solar_radius': arch.get('solar_radius', 600),
                'dest_system': dest_system,
                'dest_hole': dest_hole,
                'faction': object_reputation(props),
                'loadout': get_prop(props, 'loadout', ''),
                'rotate_y': parse_rotation_y(get_prop(props, 'rotate', '0,0,0'))
            }
            result['jumpholes'].append(hole)
            continue
        
        arch = solar_info(archetype)
        solar_type = arch.get('type', '')

        # Planets/Suns must be classified before dockable stations; many planets have a base.
        # Do not classify weapon platforms like wplatform_planet_frag as planets just because
        # their nickname contains the word "planet".
        if is_true_planet_archetype(archetype, solar_type) or is_true_sun_archetype(archetype, solar_type):
            pos = parse_position_3d(get_prop(props, 'pos', '0,0,0'))
            radius = arch.get('solar_radius', parse_float(get_prop(props, 'atmosphere_range', ''), 1000))
            planet = {
                'nickname': get_prop(props, 'nickname', section_name),
                'name': resolve_id(get_prop(props, 'ids_name', ''), get_prop(props, 'nickname', section_name)),
                'ids_name': get_prop(props, 'ids_name', ''),
                'ids_info': get_prop(props, 'ids_info', ''),
                'info': resolve_info(get_prop(props, 'ids_info', '')),
                'x': pos[0], 'y': pos[1], 'z': pos[2],
                'archetype': archetype,
                'size': radius,
                'solar_radius': radius,
                'atmosphere_range': parse_float(get_prop(props, 'atmosphere_range', ''), radius * 1.25),
                'spin': get_prop(props, 'spin', ''),
                'faction': object_reputation(props),
                'loadout': get_prop(props, 'loadout', ''),
                'base': get_prop(props, 'base', ''),
                'dock_with': get_prop(props, 'dock_with', ''),
                'has_ring': 'ring' in archetype or 'ring' in arch.get('da_archetype', '').lower() or 'ring' in arch.get('shape_name', '').lower()
            }
            if is_true_sun_archetype(archetype, solar_type):
                result['suns'].append(planet)
            else:
                result['planets'].append(planet)
            continue

        # Stations and other important solar objects
        if (any(stype in archetype for stype in ['station', 'smallstation', 'outpost', 'depot', 'dreadnought', 'battleship', 'battlecruiser', 'dock_ring', 'miningbase', 'shipyard'])
            or get_prop(props, 'base', '') or get_prop(props, 'dock_with', '')
            or solar_type in ['STATION', 'SATELLITE', 'DOCKABLE', 'WEAPONS_PLATFORM']):
            pos = parse_position_3d(get_prop(props, 'pos', '0,0,0'))
            station = {
                'nickname': get_prop(props, 'nickname', section_name),
                'name': resolve_id(get_prop(props, 'ids_name', ''), get_prop(props, 'nickname', section_name)),
                'ids_name': get_prop(props, 'ids_name', ''),
                'ids_info': get_prop(props, 'ids_info', ''),
                'info': resolve_info(get_prop(props, 'ids_info', '')),
                'x': pos[0], 'y': pos[1], 'z': pos[2],
                'archetype': archetype,
                'solar_type': solar_type,
                'solar_radius': arch.get('solar_radius', 600),
                'rotate_y': parse_rotation_y(get_prop(props, 'rotate', '0,0,0')),
                'base': get_prop(props, 'base', ''),
                'faction': object_reputation(props),
                'loadout': get_prop(props, 'loadout', ''),
                'dock_with': get_prop(props, 'dock_with', '')
            }
            result['stations'].append(station)
            continue
    
    # Build trade lanes from collected rings
    trade_lanes = build_trade_lanes_from_rings(all_trade_lane_rings, ring_data_by_id)
    result['tradelanes'] = trade_lanes
    
    return result

def extract_universe_map() -> dict:
    """Extract universe map with all systems and connections."""
    universe_ini = UNIVERSE_DIR / 'universe.ini'
    
    systems = []
    connections = {}
    sectors = []
    
    if not universe_ini.exists():
        print("universe.ini not found!")
        return {'systems': systems, 'connections': {}}
    
    sections = parse_ini_file_with_duplicates(universe_ini)
    
    for section_name, props in sections:
        file_val = get_prop(props, 'file', '')
        if file_val and 'systems' in file_val.lower():
            nickname = get_prop(props, 'nickname', section_name)
            pos = parse_position_2d(get_prop(props, 'pos', '0, 0'))
            system = {
                'nickname': nickname,
                'name': resolve_id(get_prop(props, 'strid_name', ''), nickname),
                'strid_name': get_prop(props, 'strid_name', ''),
                'ids_info': get_prop(props, 'ids_info', ''),
                'info': resolve_info(get_prop(props, 'ids_info', '')),
                'x': pos[0],
                'z': pos[1],
                'file': file_val,
                'reputation': get_prop(props, 'reputation', ''),
                'visit': get_prop(props, 'visit', '0')
            }
            systems.append(system)
    
    # Extract connections from system files
    systems_dir = UNIVERSE_DIR / 'SYSTEMS'
    if systems_dir.exists():
        for system_folder in systems_dir.iterdir():
            if system_folder.is_dir():
                system_name = system_folder.name
                ini_file = system_folder / f'{system_name.lower()}.ini'
                
                if ini_file.exists():
                    sections = parse_ini_file_with_duplicates(ini_file)
                    
                    for section_name, props in sections:
                        if section_name.lower() in ['archetype', 'zone']:
                            continue
                        
                        archetype = get_prop(props, 'Archetype', get_prop(props, 'archetype', '')).lower()
                        if is_jump_connection_archetype(archetype):
                            goto = get_prop(props, 'goto', '')
                            if goto:
                                goto_parts = goto.split(',')
                                dest_system = goto_parts[0].strip()
                                if dest_system:
                                    if system_name not in connections:
                                        connections[system_name] = []
                                    if dest_system not in connections[system_name]:
                                        connections[system_name].append(dest_system)

    for system in systems:
        nickname = str(system.get('nickname', '')).strip()
        file_val = str(system.get('file', '')).replace('/', '\\')
        file_parts = [part for part in file_val.split('\\') if part]
        canonical_system = file_parts[-2] if len(file_parts) >= 2 else ''
        if not nickname or not canonical_system or nickname.lower() == canonical_system.lower():
            continue
        canonical_connections = connections.get(canonical_system) or connections.get(canonical_system.lower()) or connections.get(canonical_system.upper())
        if not canonical_connections:
            continue
        alias_connections = connections.setdefault(nickname, [])
        for dest_system in canonical_connections:
            if dest_system not in alias_connections:
                alias_connections.append(dest_system)
    
    sectors = extract_multiuniverse_map({str(system.get('nickname', '')).lower(): system for system in systems})
    return {'systems': systems, 'connections': connections, 'sectors': sectors}

def extract_all_systems() -> dict:
    """Extract data for all systems in the universe."""
    systems_dir = UNIVERSE_DIR / 'SYSTEMS'
    
    all_systems = {}
    
    if not systems_dir.exists():
        print(f"Systems directory not found: {systems_dir}")
        return all_systems
    
    for system_folder in systems_dir.iterdir():
        if system_folder.is_dir() and system_folder.name not in ['GOLDEN', 'TUTORIAL']:
            system_name = system_folder.name
            print(f"Extracting: {system_name}")
            system_data = extract_system_data(system_name)
            all_systems[system_name] = system_data
    
    return all_systems

def main():
    global RESOURCE_STRINGS, RESOURCE_INFOCARDS, SOLAR_ARCH
    print("=== Freelancer Data Extractor v8 ===")
    print("Fixed: Parse Trade Lane Rings with next_ring/prev_ring connections")
    print()

    print("0. Loading Freelancer resource strings and infocards...")
    RESOURCE_STRINGS = load_resource_strings()
    RESOURCE_INFOCARDS = load_resource_infocards()
    SOLAR_ARCH = load_solar_arch()
    print(f"   Loaded {len(RESOURCE_STRINGS)} resource strings")
    print(f"   Loaded {len(RESOURCE_INFOCARDS)} infocards")
    print(f"   Loaded {len(SOLAR_ARCH)} solar archetypes")

    print()
    print("1. Extracting universe map...")
    universe_map = extract_universe_map()
    print(f"   Found {len(universe_map['systems'])} system entries")
    
    print("2. Extracting all systems...")
    all_systems = extract_all_systems()
    print(f"   Found {len(all_systems)} systems")

    system_names = {s['nickname'].lower(): s for s in universe_map['systems']}
    for sys_name, sys_data in all_systems.items():
        universe_entry = system_names.get(sys_name.lower())
        if universe_entry:
            sys_data['name'] = universe_entry['name']
            sys_data['strid_name'] = universe_entry.get('strid_name', '')
            sys_data['ids_info'] = universe_entry.get('ids_info', '')
            sys_data['info'] = universe_entry.get('info', '')
    
    data_dir = output_data_dir(Path(__file__).parent.parent / 'data')
    systems_file = data_dir / 'systems.json'
    systems_file.parent.mkdir(exist_ok=True)
    
    with open(systems_file, 'w', encoding='utf-8') as f:
        json.dump(all_systems, f, indent=2, ensure_ascii=False)
    print(f"   Saved to {systems_file}")
    
    print()
    print("3. Saving universe map...")
    universe_file = data_dir / 'universe_map.json'
    with open(universe_file, 'w', encoding='utf-8') as f:
        json.dump(universe_map, f, indent=2, ensure_ascii=False)
    print(f"   Saved to {universe_file}")
    
    # Summary
    print()
    print("=== Summary ===")
    total_gates = sum(len(s.get('jumpgates', [])) for s in all_systems.values())
    total_holes = sum(len(s.get('jumpholes', [])) for s in all_systems.values())
    total_stations = sum(len(s.get('stations', [])) for s in all_systems.values())
    total_planets = sum(len(s.get('planets', [])) for s in all_systems.values())
    total_suns = sum(len(s.get('suns', [])) for s in all_systems.values())
    
    # Count trade lanes (groups of rings) and individual rings
    total_tradelanes = 0
    total_trade_rings = 0
    for sys in all_systems.values():
        lanes = sys.get('tradelanes', [])
        total_tradelanes += len(lanes)
        for lane in lanes:
            total_trade_rings += len(lane.get('rings', []))
    
    total_asteroids = sum(len(s.get('asteroidfields', [])) for s in all_systems.values())
    total_nebulae = sum(len(s.get('nebulae', [])) for s in all_systems.values())
    
    print(f"Systems: {len(all_systems)}")
    print(f"Jump Gates: {total_gates}")
    print(f"Jump Holes: {total_holes}")
    print(f"Stations: {total_stations}")
    print(f"Planets: {total_planets}")
    print(f"Suns: {total_suns}")
    print(f"Trade Lane Routes: {total_tradelanes}")
    print(f"Trade Lane Rings: {total_trade_rings}")
    print(f"Asteroid Fields: {total_asteroids}")
    print(f"Nebulae: {total_nebulae}")
    print(f"System connections: {len(universe_map['connections'])}")
    
    # Generate JS
    print()
    print("4. Generating game data files...")
    
    game_systems = {}
    for sys_name, sys_data in all_systems.items():
        # Convert trade lanes to simple ring arrays for game
        tradelanes = []
        for lane in sys_data.get('tradelanes', []):
            # Convert ring dicts to simple objects
            ring_arrays = [
                {
                    'id': r.get('nickname', ''),
                    'name': r.get('name', ''),
                    'x': r['x'],
                    'z': r['z'],
                    'rotate_y': r.get('rotate_y', 0)
                }
                for r in lane.get('rings', [])
            ]
            tradelanes.append({'rings': ring_arrays})
        
        game_systems[sys_name] = {
            'name': sys_data['name'],
            'strid_name': sys_data.get('strid_name', ''),
            'ids_info': sys_data.get('ids_info', ''),
            'info': sys_data.get('info', ''),
            'jumpgates': sys_data.get('jumpgates', []),
            'jumpholes': sys_data.get('jumpholes', []),
            'stations': sys_data.get('stations', []),
            'planets': sys_data.get('planets', []),
            'suns': sys_data.get('suns', []),
            'zones': sys_data.get('zones', []),
            'missionZones': sys_data.get('missionZones', []),
            'populationZones': sys_data.get('populationZones', []),
            'asteroidfields': sys_data.get('asteroidfields', []),
            'tradelanes': tradelanes,  # Note: spelled tradelanes in output
            'nebulae': sys_data.get('nebulae', [])
        }
    
    game_data_file = data_dir / 'game_systems.js'
    with open(game_data_file, 'w', encoding='utf-8') as f:
        f.write("// Auto-generated game systems data\n")
        f.write("// Generated from Freelancer HD installation\n\n")
        f.write("const GAME_SYSTEMS = ")
        json.dump(game_systems, f, indent=2, ensure_ascii=False)
        f.write(";\n\n")
        f.write("const UNIVERSE_CONNECTIONS = ")
        json.dump(universe_map['connections'], f, indent=2)
        f.write(";\n\n")
        f.write("const UNIVERSE_SYSTEMS = ")
        json.dump(universe_map['systems'], f, indent=2, ensure_ascii=False)
        f.write(";\n\n")
        f.write("const UNIVERSE_SECTORS = ")
        json.dump(universe_map.get('sectors', []), f, indent=2, ensure_ascii=False)
        f.write(";\n")
    
    print(f"   Saved to {game_data_file}")
    
    # Print examples
    for sys_name in ['li01', 'br04']:
        if sys_name in all_systems:
            sys = all_systems[sys_name]
            print()
            print(f"=== {sys_name.upper()} ({sys['name']}) ===")
            print(f"  Trade Lane Routes ({len(sys['tradelanes'])}):")
            for i, lane in enumerate(sys['tradelanes'][:3]):
                rings = lane.get('rings', [])
                if rings:
                    print(f"    - Route {i+1}: {len(rings)} rings from ({rings[0]['x']}, {rings[0]['z']}) to ({rings[-1]['x']}, {rings[-1]['z']})")
    
    print()
    print("=== Extraction Complete ===")

if __name__ == '__main__':
    main()
