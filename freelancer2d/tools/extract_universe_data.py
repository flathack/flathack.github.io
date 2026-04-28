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

try:
    import pefile
except ImportError:
    pefile = None

# Base paths
FL_DATA = Path('C:/Users/steve/Github/FL-Installationen/Freelancer-HD/DATA')
FL_ROOT = FL_DATA.parent
FL_EXE = FL_ROOT / 'EXE'
UNIVERSE_DIR = FL_DATA / 'UNIVERSE'
RESOURCE_DLLS = [
    'infocards.dll',
    'misctext.dll',
    'nameresources.dll',
    'equipresources.dll',
    'offerbriberesources.dll',
    'misctextinfo2.dll',
    'controls.dll',
    'FLAtlas_FLMM_b351117f8299be5f.dll',
]
RESOURCE_STRINGS = {}
RESOURCE_INFOCARDS = {}
SOLAR_ARCH = {}

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
                        current_props[key] = value
        
        if current_section is not None:
            sections.append((current_section, current_props))
    
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    
    return sections

def get_prop(props: dict, key: str, default=''):
    """Get property, handling case sensitivity."""
    if key in props:
        return props[key]
    lower_key = key.lower()
    if lower_key in props:
        return props[lower_key]
    upper_key = key.upper()
    if upper_key in props:
        return props[upper_key]
    return default

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
    for dll_index, dll_name in enumerate(RESOURCE_DLLS, start=1):
        dll_strings = extract_string_table(FL_EXE / dll_name)
        for string_id, text in dll_strings.items():
            if text:
                resources[dll_index * 65536 + string_id] = text
    return resources

def load_resource_infocards() -> dict:
    """Load Freelancer ids_info HTML resources according to freelancer.ini order."""
    resources = {}
    for dll_index, dll_name in enumerate(RESOURCE_DLLS, start=1):
        dll_cards = extract_html_resources(FL_EXE / dll_name)
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
        'missionZones': []
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
                'rotate_y': 0
            }
            ring['rotate_y'] = parse_rotation_y(get_prop(props, 'rotate', '0,0,0'))
            
            all_trade_lane_rings.append(ring)
            ring_data_by_id[ring['nickname']] = ring
            continue
        
        # Jump Gates
        if archetype == 'jumpgate':
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
                'rotate_y': rotate_y
            }
            result['jumpgates'].append(gate)
            continue
        
        # Jump Holes
        if archetype.startswith('jumphole'):
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
                'faction': get_prop(props, 'faction', ''),
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
                        if archetype in ['jumpgate', 'jumphole', 'jumphole_red', 'jumphole_orange', 'jumphole_gamma', 'jumphole_blue']:
                            goto = get_prop(props, 'goto', '')
                            if goto:
                                goto_parts = goto.split(',')
                                dest_system = goto_parts[0].strip()
                                if dest_system:
                                    if system_name not in connections:
                                        connections[system_name] = []
                                    if dest_system not in connections[system_name]:
                                        connections[system_name].append(dest_system)
    
    return {'systems': systems, 'connections': connections}

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
    
    output_dir = Path(__file__).parent.parent
    systems_file = output_dir / 'data' / 'systems.json'
    systems_file.parent.mkdir(exist_ok=True)
    
    with open(systems_file, 'w', encoding='utf-8') as f:
        json.dump(all_systems, f, indent=2, ensure_ascii=False)
    print(f"   Saved to {systems_file}")
    
    print()
    print("3. Saving universe map...")
    universe_file = output_dir / 'data' / 'universe_map.json'
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
            'asteroidfields': sys_data.get('asteroidfields', []),
            'tradelanes': tradelanes,  # Note: spelled tradelanes in output
            'nebulae': sys_data.get('nebulae', [])
        }
    
    game_data_file = output_dir / 'data' / 'game_systems.js'
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
