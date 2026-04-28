/**
 * Spawner - NPC ship spawning system
 */
export class Spawner {
    constructor(game) {
        this.game = game;
        this.maxNPCs = 30;
        this.spawnCooldowns = new Map();
    }
    
    async spawnInitialNPCs(system) {
        // Spawn initial batch of NPCs
        const count = Math.min(15, this.maxNPCs);
        
        for (let i = 0; i < count; i++) {
            this.spawnRandomNPC(system);
        }
    }
    
    spawnRandomNPC(system) {
        const types = ['trader', 'trader', 'civilian', 'civilian', 'pirate', 'police'];
        const weights = [0.3, 0.3, 0.2, 0.1, 0.05, 0.05];
        
        const roll = Math.random();
        let cumulative = 0;
        let type = 'civilian';
        
        for (let i = 0; i < types.length; i++) {
            cumulative += weights[i];
            if (roll < cumulative) {
                type = types[i];
                break;
            }
        }
        
        this.spawnNPC(system, type);
    }
    
    spawnNPC(system, type) {
        // Random position in system bounds
        const bounds = system.bounds || { width: 8000, height: 6000 };
        const x = (Math.random() - 0.5) * bounds.width;
        const y = (Math.random() - 0.5) * bounds.height;
        
        // Get ship data
        const shipData = this.getRandomShip(type);
        
        const npc = {
            id: 'npc-' + Math.random().toString(36).substr(2, 9),
            name: this.generateName(type),
            x: x,
            y: y,
            rotation: Math.random() * Math.PI * 2,
            targetAngle: Math.random() * Math.PI * 2,
            speed: 0,
            throttle: 0.3,
            role: type,
            faction: this.getFactionForRole(type),
            hull: shipData.hull,
            maxHull: shipData.hull,
            shield: shipData.shield,
            maxShield: shipData.shield,
            maxSpeed: shipData.maxSpeed,
            turnRate: shipData.turnRate,
            cargoCapacity: shipData.cargoCapacity,
            cargo: [],
            isDestroyed: false,
            visible: true,
            radius: 20,
            minimapColor: this.getColorForRole(type),
            minimapSize: 4,
            vx: 0,
            vy: 0,
            
            // AI state
            state: 'idle',
            target: null,
            homeStation: null,
            patrolRoute: [],
            currentWaypoint: 0,
            stateTimer: 0
        };
        
        // Set initial state based on role
        switch (type) {
            case 'trader':
                npc.state = 'planning';
                npc.homeStation = this.getRandomStation(system);
                break;
            case 'pirate':
                npc.state = 'patrol';
                break;
            case 'police':
                npc.state = 'patrol';
                break;
            case 'miner':
                npc.state = 'moving';
                npc.targetAsteroids = this.getAsteroidZone(system);
                break;
        }
        
        this.game.npcs.push(npc);
        return npc;
    }
    
    getRandomShip(type) {
        const ships = {
            trader: [
                { hull: 120, shield: 100, maxSpeed: 250, turnRate: 2.5, cargoCapacity: 80 },
                { hull: 150, shield: 120, maxSpeed: 200, turnRate: 2.0, cargoCapacity: 120 }
            ],
            pirate: [
                { hull: 80, shield: 60, maxSpeed: 350, turnRate: 4.0, cargoCapacity: 30 },
                { hull: 100, shield: 80, maxSpeed: 300, turnRate: 3.5, cargoCapacity: 40 }
            ],
            police: [
                { hull: 100, shield: 100, maxSpeed: 320, turnRate: 3.5, cargoCapacity: 20 },
                { hull: 130, shield: 130, maxSpeed: 280, turnRate: 3.0, cargoCapacity: 30 }
            ],
            civilian: [
                { hull: 60, shield: 40, maxSpeed: 280, turnRate: 2.5, cargoCapacity: 15 },
                { hull: 80, shield: 60, maxSpeed: 250, turnRate: 2.0, cargoCapacity: 25 }
            ],
            miner: [
                { hull: 150, shield: 80, maxSpeed: 180, turnRate: 2.0, cargoCapacity: 100 },
                { hull: 200, shield: 100, maxSpeed: 150, turnRate: 1.5, cargoCapacity: 150 }
            ]
        };
        
        const options = ships[type] || ships.civilian;
        return options[Math.floor(Math.random() * options.length)];
    }
    
    getFactionForRole(role) {
        const factions = {
            trader: ['trader_guild', 'co_me_grp'],
            pirate: ['fc_lr_grp', 'shadow_syndicate'],
            police: ['li_p_grp', 'police_force'],
            civilian: ['co_nws_grp', 'co_be_grp'],
            miner: ['trilon_mining_corp']
        };
        
        const options = factions[role] || factions.civilian;
        return options[Math.floor(Math.random() * options.length)];
    }
    
    getColorForRole(role) {
        const colors = {
            trader: '#44aa44',
            pirate: '#aa4444',
            police: '#4444aa',
            civilian: '#888888',
            miner: '#aa8844'
        };
        return colors[role] || '#888888';
    }
    
    generateName(role) {
        const prefixes = {
            trader: ['MV', 'TS', 'STS'],
            pirate: ['SH', 'BC', 'REAPER'],
            police: ['CPD', 'SFPD'],
            civilian: ['ST', 'LS', 'RV'],
            miner: ['EX', 'MR']
        };
        
        const options = prefixes[role] || ['DS'];
        const prefix = options[Math.floor(Math.random() * options.length)];
        const number = Math.floor(Math.random() * 9000) + 1000;
        
        return `${prefix}-${number}`;
    }
    
    getRandomStation(system) {
        const stations = this.game.data.stations.filter(s => s.system === system.id);
        if (stations.length === 0) return null;
        return stations[Math.floor(Math.random() * stations.length)];
    }
    
    getAsteroidZone(system) {
        // Return a random position for mining
        return {
            x: (Math.random() - 0.5) * 2000,
            y: (Math.random() - 0.5) * 2000
        };
    }
    
    update(deltaTime) {
        const system = this.game.currentSystem;
        if (!system) return;
        
        // Check spawn rate based on scheduler
        if (this.game.npcs.length < this.maxNPCs) {
            if (Math.random() < 0.01 * deltaTime) { // ~1% chance per second
                this.spawnRandomNPC(system);
            }
        }
        
        // Remove destroyed NPCs
        this.game.npcs = this.game.npcs.filter(npc => !npc.isDestroyed);
    }
}
