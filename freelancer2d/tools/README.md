# Freelancer2D - Tools & Utilities

## INI Parser

The `ini_parser.py` tool helps analyze Freelancer INI files for reference patterns.

### Usage

```bash
python tools/ini_parser.py "C:/Games/Freelancer/DATA"
```

### What It Does

1. Parses Freelancer INI files
2. Extracts structural patterns (not content)
3. Generates universe templates

### Output

- `universe_template.json` - Template for creating new systems/stations

### Important Notes

- **Reference Only**: This tool extracts structural patterns, not game content
- **No Copyright Infringement**: No Freelancer assets, text, or data is copied
- **For Inspiration**: Use patterns as a guide for your own original content

## Creating New Content

### Add a New System

Edit `js/data/systems.json`:

```json
{
  "id": "new-system",
  "name": "New System Name",
  "faction": "faction_id",
  "bounds": { "width": 8000, "height": 6000 },
  "connectedSystems": [
    { "system": "existing-system", "gate": "gate-name" }
  ]
}
```

### Add a New Station

Edit `js/data/stations.json`:

```json
{
  "id": "new-station",
  "name": "Station Name",
  "system": "system-id",
  "position": { "x": 0, "y": 0 },
  "faction": "faction-id",
  "type": "orbital-station",
  "services": ["trading", "repair", "refuel"],
  "dockRadius": 150
}
```

### Add a New Commodity

Edit `js/data/commodities.json`:

```json
{
  "id": "new-commodity",
  "name": "Commodity Name",
  "category": "industrial",
  "basePrice": 100,
  "legal": true,
  "weight": 5
}
```

### Add a New Ship

Edit `js/data/ships.json`:

```json
{
  "id": "new-ship",
  "name": "Ship Name",
  "class": "medium-fighter",
  "stats": {
    "hull": 100,
    "shield": 80,
    "maxSpeed": 300,
    "turnRate": 3.0,
    "cargoCapacity": 30
  },
  "price": 75000
}
```

## Architecture Overview

```
Freelancer2D/
├── js/
│   ├── main.js              # Game entry point
│   ├── core/                # Engine core
│   │   ├── GameLoop.js      # Fixed timestep loop
│   │   ├── Renderer.js      # Canvas 2D rendering
│   │   └── Input.js         # Mouse/keyboard handling
│   ├── entities/            # Game objects
│   │   ├── Entity.js        # Base class
│   │   ├── Ship.js          # Ship base
│   │   ├── PlayerShip.js    # Player ship
│   │   ├── Station.js       # Docking stations
│   │   ├── Gate.js          # Jump gates
│   │   └── Planet.js        # Planets/stars
│   ├── simulation/           # World simulation
│   │   ├── Universe.js      # System connections
│   │   ├── Economy.js       # Dynamic pricing
│   │   ├── Factions.js      # Reputation
│   │   ├── Scheduler.js     # Daily rhythm
│   │   └── Spawner.js       # NPC spawning
│   ├── ai/                  # NPC behavior
│   │   ├── TraderAI.js      # Trading behavior
│   │   ├── PirateAI.js      # Pirate behavior
│   │   ├── PoliceAI.js      # Police behavior
│   │   └── MinerAI.js       # Mining behavior
│   ├── ui/                  # Interface
│   │   └── HUD.js          # Heads-up display
│   └── data/                # JSON world data
│       ├── systems.json     # Star systems
│       ├── stations.json    # Stations/bases
│       ├── factions.json    # Factions
│       ├── commodities.json # Trade goods
│       └── ships.json       # Ship definitions
├── css/
│   └── style.css            # UI styling
├── tools/
│   └── ini_parser.py        # Freelancer reference parser
└── index.html               # Entry point
```

## Running the Game

1. Open `index.html` in a modern browser
2. Click "New Game" to start
3. Use mouse to aim, W/S for throttle
4. Press D to dock at stations
5. Press G to enter gates
6. Press M for galaxy map

## Development

The game uses vanilla JavaScript ES6+ modules. No build step required.

For testing changes:
1. Edit source files
2. Refresh browser
3. Check console for errors
