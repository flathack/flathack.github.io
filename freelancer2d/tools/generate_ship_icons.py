#!/usr/bin/env python3
"""
Freelancer Ship Icon Generator
Generates 2D top-view PNG icons from Freelancer CMP ship models.
"""

import os
import struct
import json
from pathlib import Path

# Freelancer CMP file structure
CMP_HEADER = b'CMSH'
CMP_VERSION = 0x00000005

def read_cmp_vertices(cmp_path):
    """Read vertex data from CMP file."""
    vertices = []
    try:
        with open(cmp_path, 'rb') as f:
            # Read header
            magic = f.read(4)
            if magic != CMP_HEADER:
                return vertices
            
            version = struct.unpack('<I', f.read(4))[0]
            mesh_count = struct.unpack('<I', f.read(4))[0]
            
            # Skip to geometry data
            # CMP files have varying structures, we'll try to extract vertex positions
            f.seek(0)
            data = f.read()
            
            # Simple pattern: look for float sequences that look like vertices
            # Each vertex is typically 3 floats (x, y, z)
            floats = []
            for i in range(0, len(data) - 12, 4):
                try:
                    val = struct.unpack('<f', data[i:i+4])[0]
                    if -1000 < val < 1000:  # Reasonable vertex range
                        floats.append(val)
                except:
                    pass
            
            # Extract triplets
            for i in range(0, len(floats) - 2, 3):
                vertices.append((floats[i], floats[i+1], floats[i+2]))
    except Exception as e:
        print(f"Error reading {cmp_path}: {e}")
    return vertices

def vertices_to_topview_png(vertices, size=72, output_path=None):
    """Generate top-view PNG from vertex data."""
    try:
        import numpy as np
        from PIL import Image, ImageDraw
        
        if len(vertices) < 9:  # Need at least 3 triangles
            return None
        
        # Calculate bounds
        xs = [v[0] for v in vertices]
        zs = [v[2] for v in vertices]
        
        min_x, max_x = min(xs), max(xs)
        min_z, max_z = min(zs), max(zs)
        
        span = max(max_x - min_x, max_z - min_z, 1)
        margin = size * 0.15
        scale = (size - margin * 2) / span
        
        # Create image
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Project vertices to 2D
        points_2d = []
        for v in vertices:
            px = margin + (v[0] - min_x) * scale
            pz = margin + (v[2] - min_z) * scale
            points_2d.append((px, pz))
        
        # Simple convex hull drawing for silhouette
        if len(points_2d) > 3:
            # Draw filled shape
            try:
                # Calculate center
                cx = sum(p[0] for p in points_2d) / len(points_2d)
                cz = sum(p[1] for p in points_2d) / len(points_2d)
                
                # Sort by angle from center
                angles = []
                for i, p in enumerate(points_2d):
                    angle = ((cx, cz), (p[0] - cx, p[1] - cz))
                    angles.append((angle, i))
                angles.sort(key=lambda x: x[0][1])
                
                hull = [points_2d[angles[0][1]]]
                for angle, idx in angles[1:]:
                    hull.append(points_2d[idx])
                
                # Draw hull
                draw.polygon(hull, fill=(185, 215, 245, 220), outline=(120, 175, 225, 235))
            except:
                pass
        
        if output_path:
            img.save(output_path, 'PNG')
        
        return img
    except ImportError:
        print("PIL/numpy not available, skipping image generation")
        return None
    except Exception as e:
        print(f"Error generating image: {e}")
        return None

def generate_ship_data(ships_dir, output_json, icons_dir):
    """Generate ship data JSON and placeholder icons."""
    
    ships = []
    ship_folders = [
        # Civilian ships
        ('CIVILIAN/CV_STARFLIER', 'Starflier', 'Civilian', 5000, 80, 20, 40, 1.0),
        ('CIVILIAN/CV_FIGHTER', 'Fighter', 'Civilian', 8000, 100, 30, 50, 1.0),
        ('CIVILIAN/CV_ELITE', 'Elite', 'Civilian', 15000, 150, 50, 80, 1.0),
        ('CIVILIAN/CV_STARBLAZER', 'Starblazer', 'Civilian', 12000, 120, 40, 60, 1.0),
        ('CIVILIAN/CV_STARTRACKER', 'Startracker', 'Civilian', 6000, 90, 25, 45, 1.0),
        ('CIVILIAN/CV_VHEAVY_FIGHTER', 'Heavy Fighter', 'Civilian', 25000, 180, 60, 100, 1.2),
        
        # Add more ship categories here
        ('LIBERTY/LI_FIGHTER', 'Liberty Fighter', 'Liberty', 10000, 100, 35, 55, 1.0),
        ('LIBERTY/LI_HEAVY_FIGHTER', 'Liberty Heavy Fighter', 'Liberty', 20000, 160, 55, 85, 1.1),
        ('LIBERTY/LI_BOMBER', 'Liberty Bomber', 'Liberty', 30000, 200, 70, 100, 1.3),
        
        ('BRETONIA/BR_FIGHTER', 'Bretonia Fighter', 'Bretonia', 11000, 110, 38, 58, 1.0),
        ('BRETONIA/BR_HEAVY_FIGHTER', 'Bretonia Heavy', 'Bretonia', 22000, 170, 58, 88, 1.1),
        ('BRETONIA/BR_CRUISER', 'Bretonia Cruiser', 'Bretonia', 50000, 300, 100, 150, 1.5),
        
        ('RHEINLAND/RH_FIGHTER', 'Rheinland Fighter', 'Rheinland', 9500, 95, 32, 52, 1.0),
        ('RHEINLAND/RH_HEAVY_FIGHTER', 'Rheinland Heavy', 'Rheinland', 21000, 165, 55, 85, 1.1),
        ('RHEINLAND/RH_CRUISER', 'Rheinland Cruiser', 'Rheinland', 48000, 290, 95, 145, 1.5),
        
        ('KUSARI/KU_FIGHTER', 'Kusari Fighter', 'Kusari', 10500, 105, 36, 56, 1.0),
        ('KUSARI/KU_HEAVY_FIGHTER', 'Kusari Heavy', 'Kusari', 23000, 175, 58, 90, 1.1),
        ('KUSARI/KU_CRUISER', 'Kusari Cruiser', 'Kusari', 52000, 310, 105, 155, 1.5),
        
        ('PIRATE/PI_FIGHTER', 'Pirate Fighter', 'Pirate', 3000, 60, 15, 30, 0.8),
        ('PIRATE/PI_HEAVY_FIGHTER', 'Pirate Heavy', 'Pirate', 8000, 120, 40, 65, 0.9),
        
        ('ORDER/ORDER_FIGHTER', 'Order Fighter', 'Order', 14000, 130, 45, 70, 1.0),
        ('ORDER/ORDER_CRUISER', 'Order Cruiser', 'Order', 55000, 320, 110, 160, 1.5),
        
        ('NOMAD/NOMAD_FIGHTER', 'Nomad Fighter', 'Nomad', 40000, 180, 60, 100, 1.2),
        ('NOMAD/NOMAD_CRUISER', 'Nomad Cruiser', 'Nomad', 80000, 400, 150, 200, 1.8),
    ]
    
    icons_dir = Path(icons_dir)
    icons_dir.mkdir(parents=True, exist_ok=True)
    
    for ship_path, name, faction, price, hull, shield, speed, scale in ship_folders:
        full_path = ships_dir / ship_path
        cmp_file = None
        
        # Look for .cmp file
        if full_path.is_dir():
            for f in full_path.glob('*.cmp'):
                cmp_file = f
                break
        
        ship_id = ship_path.replace('/', '_').lower()
        
        ship_data = {
            'id': ship_id,
            'name': name,
            'faction': faction,
            'price': price,
            'stats': {
                'hull': hull,
                'shield': shield,
                'maxSpeed': speed,
                'turnRate': 2.0,
                'firePower': 10
            },
            'scale': scale,
            'icon': f'icons/{ship_id}.png' if cmp_file else None,
            'modelPath': str(cmp_file) if cmp_file else None
        }
        
        ships.append(ship_data)
        
        # Try to generate icon if CMP exists
        if cmp_file and cmp_file.exists():
            verts = read_cmp_vertices(cmp_file)
            if verts:
                output_icon = icons_dir / f'{ship_id}.png'
                vertices_to_topview_png(verts, 72, output_icon)
                print(f"Generated icon: {output_icon}")
            else:
                print(f"No vertices found in: {cmp_file}")
        else:
            print(f"CMP not found: {full_path}")
    
    # Save ship data
    with open(output_json, 'w') as f:
        json.dump(ships, f, indent=2)
    
    print(f"Generated ship data: {output_json}")
    print(f"Ships count: {len(ships)}")
    return ships

if __name__ == '__main__':
    import sys
    
    ships_dir = Path('C:/Users/steve/Github/FL-Installationen/Freelancer-HD/DATA/SHIPS')
    output_json = Path(__file__).parent.parent / 'ships.json'
    icons_dir = Path(__file__).parent.parent / 'icons'
    
    if len(sys.argv) > 1:
        ships_dir = Path(sys.argv[1])
    if len(sys.argv) > 2:
        output_json = Path(sys.argv[2])
    
    generate_ship_data(ships_dir, output_json, icons_dir)