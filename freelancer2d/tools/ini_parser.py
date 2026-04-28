#!/usr/bin/env python3
"""
INI Parser - Parse Freelancer INI files for reference
This tool parses Freelancer INI files and extracts structural patterns
without copying any copyrighted content.
"""

import re
import json
import os
from pathlib import Path


class INIParser:
    def __init__(self, ini_path):
        self.ini_path = Path(ini_path)
        self.sections = {}
        self.current_section = None
        self.current_data = {}
        
    def parse(self):
        """Parse INI file into sections and key-value pairs"""
        with open(self.ini_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                
                # Skip empty lines and comments
                if not line or line.startswith(';'):
                    continue
                
                # Section header
                if line.startswith('[') and line.endswith(']'):
                    if self.current_section:
                        self.sections[self.current_section] = self.current_data
                    self.current_section = line[1:-1]
                    self.current_data = {}
                    continue
                
                # Key-value pair
                if '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    self.current_data[key] = value
                    
        # Save last section
        if self.current_section:
            self.sections[self.current_section] = self.current_data
            
        return self.sections
    
    def extract_structure(self):
        """Extract structural patterns for conversion"""
        structures = {
            'section_count': len(self.sections),
            'keys_per_section': {},
            'common_keys': [],
            'patterns': {}
        }
        
        all_keys = set()
        for section, data in self.sections.items():
            structures['keys_per_section'][section] = len(data)
            all_keys.update(data.keys())
            
        structures['common_keys'] = list(all_keys)
        return structures


class FreelancerConverter:
    """Convert Freelancer INI patterns to JSON for Freelancer2D"""
    
    def __init__(self, fl_data_path):
        self.fl_data_path = Path(fl_data_path)
        self.systems = []
        self.stations = []
        self.factions = []
        
    def convert_systems(self, output_path):
        """Convert system INI files to JSON"""
        systems_dir = self.fl_data_path / 'DATA' / 'UNIVERSE'
        if not systems_dir.exists():
            print(f"Systems directory not found: {systems_dir}")
            return
            
        # This is reference parsing only - no content copying
        for system_dir in systems_dir.iterdir():
            if system_dir.is_dir() and system_dir.name.startswith('..'):
                continue
            ini_file = system_dir / f"{system_dir.name}.ini"
            if ini_file.exists():
                parser = INIParser(ini_file)
                sections = parser.parse()
                
                # Extract only structural patterns, not content
                structure = {
                    'id': system_dir.name.lower(),
                    'name': system_dir.name,
                    'sections_found': list(sections.keys()),
                    'has_zone': any('zone' in s.lower() for s in sections.keys()),
                    'has_pop': any('pop' in s.lower() for s in sections.keys()),
                    'connected_gates': self._count_gates(sections)
                }
                self.systems.append(structure)
                
        # Save structural reference data only
        output = {'systems_reference': self.systems}
        with open(output_path, 'w') as f:
            json.dump(output, f, indent=2)
            
    def convert_factions(self, output_path):
        """Convert faction data to JSON"""
        factions_file = self.fl_data_path / 'DATA' / 'factions.ini'
        if factions_file.exists():
            parser = INIParser(factions_file)
            sections = parser.parse()
            
            # Extract patterns only
            for faction_id, data in sections.items():
                pattern = {
                    'id': faction_id,
                    'keys': list(data.keys()),
                    'has_rep': 'rep' in data,
                    'has_color': 'color' in data
                }
                self.factions.append(pattern)
                
        output = {'factions_reference': self.factions}
        with open(output_path, 'w') as f:
            json.dump(output, f, indent=2)
            
    def _count_gates(self, sections):
        """Count gate connections"""
        gates = 0
        for section, data in sections.items():
            if 'goto' in data:
                gates += 1
        return gates
        
    def generate_universe_template(self, output_path):
        """Generate a universe template based on Freelancer patterns"""
        template = {
            "name": "Generated Universe Template",
            "description": "Template generated from Freelancer structural patterns",
            "systems": [
                {
                    "id": "template-system-1",
                    "name": "System Name",
                    "description": "System description",
                    "faction": "neutral",
                    "ambientColor": [50, 50, 80],
                    "bounds": {"width": 10000, "height": 8000},
                    "connectedSystems": [],
                    "zones": []
                }
            ],
            "stations": [
                {
                    "id": "template-station-1",
                    "name": "Station Name",
                    "system": "template-system-1",
                    "position": {"x": 0, "y": 0},
                    "faction": "neutral",
                    "type": "orbital-station",
                    "services": ["trading", "repair", "refuel"],
                    "dockRadius": 150,
                    "repRequired": -25
                }
            ],
            "factions": [
                {
                    "id": "template-faction",
                    "name": "Faction Name",
                    "color": "#4488FF",
                    "type": "corporation",
                    "allegiances": [],
                    "hostilities": [],
                    "baseReputation": 0
                }
            ],
            "note": "This is a template - populate with original content"
        }
        
        with open(output_path, 'w') as f:
            json.dump(template, f, indent=2)
            
        return template


def main():
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python ini_parser.py <freelancer_data_path>")
        print("Example: python ini_parser.py C:/Games/Freelancer/DATA")
        sys.exit(1)
        
    fl_path = sys.argv[1]
    converter = FreelancerConverter(fl_path)
    
    # Generate template
    template = converter.generate_universe_template('universe_template.json')
    print(f"Generated universe template at universe_template.json")
    print(f"Template contains {len(template['systems'])} system slots")
    print(f"Template contains {len(template['stations'])} station slots")
    print(f"Template contains {len(template['factions'])} faction slots")


if __name__ == '__main__':
    main()
