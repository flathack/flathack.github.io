# Freelancer2D - Browser-Based Space Sandbox

A 2D browser-based open space sandbox inspired by Freelancer's systemic depth and living universe feel.

## Concept

**Stellar Drift** - A living universe where NPCs trade, patrol, and fight independently. Players pilot ships between connected star systems, engage in commerce, combat, and exploration across a dynamic galaxy.

## Features

- **Living Universe Simulation**: NPCs follow schedules, trade routes, and patrol patterns
- **Dynamic Economy**: Buy low, sell high across interconnected markets
- **Faction System**: Build reputation, unlock docking, gain access
- **Mouse-Aim Flight**: Point-to-fly controls with optional keyboard assist
- **Connected Star Systems**: Travel via gates and jump holes between sectors
- **Combat System**: Weapons, shields, missiles, and countermeasure systems

## Tech Stack

- Pure HTML5 / Canvas 2D
- Vanilla JavaScript ES6+
- Web Audio API for sound
- Local Storage for saves
- Optional Python tools for content generation

## Quick Start

```bash
# Open in browser
start index.html
```

## Project Structure

```
Freelancer2D/
├── index.html              # Entry point
├── js/
│   ├── main.js            # Game initialization
│   ├── core/              # Engine components
│   ├── simulation/        # World systems
│   ├── entities/          # Game objects
│   ├── ai/               # NPC behavior
│   ├── ui/               # Interface
│   └── data/             # JSON world data
├── tools/                # Content pipeline
└── assets/               # Sprites and audio
```

## Controls

| Input | Action |
|-------|--------|
| Mouse | Aim ship |
| Left Click | Primary weapon |
| Right Click | Secondary / missiles |
| W / Scroll Up | Increase throttle |
| S / Scroll Down | Decrease throttle |
| Shift | Cruise mode |
| Space | Brake |
| D | Dock at station |
| G | Enter gate |
| M | Toggle map |
| Tab | Next target |

## Design Philosophy

Inspired by Freelancer's world structure and systemic depth, but entirely original content and implementation. Not a clone - a new game that captures the "living universe" feel.

## Status

**Phase 1**: Core engine and player ship controls  
**Phase 2**: Combat, economy, factions  
**Phase 3**: Living universe simulation  
**Phase 4**: Polish and content expansion

---

*This is an original game design project. Freelancer is used as a design reference for structure and systemic patterns only.*
