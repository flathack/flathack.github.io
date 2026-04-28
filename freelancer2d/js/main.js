/**
 * Stellar Drift - Main Game Entry Point
 * A 2D browser-based space sandbox inspired by Freelancer
 */

import { GameLoop } from './core/GameLoop.js';
import { Renderer } from './core/Renderer.js';
import { Input } from './core/Input.js';
import { Universe } from './simulation/Universe.js';
import { Economy } from './simulation/Economy.js';
import { Factions } from './simulation/Factions.js';
import { Scheduler } from './simulation/Scheduler.js';
import { Spawner } from './simulation/Spawner.js';
import { PlayerShip } from './entities/PlayerShip.js';
import { HUD } from './ui/HUD.js';
import { Station } from './entities/Station.js';
import { Gate } from './entities/Gate.js';
import { Planet } from './entities/Planet.js';

class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;
        
        this.gameLoop = null;
        this.renderer = null;
        this.input = null;
        this.universe = null;
        this.economy = null;
        this.factions = null;
        this.scheduler = null;
        this.spawner = null;
        this.hud = null;
        
        this.player = null;
        this.entities = [];
        this.npcs = [];
        this.currentSystem = null;
        this.projectiles = [];
        
        this.isPaused = false;
        this.isDocked = false;
        this.dockedStation = null;
        
        this.lastTime = 0;
        this.deltaTime = 0;
        
        // Game time (in seconds, 1800 = 30 min = 1 game day)
        this.gameTime = 0;
        this.secondsPerDay = 1800;
        
        this.loadingProgress = 0;
        
        // Default game data
        this.data = this.getDefaultData();
        
        this.init();
    }
    
    init() {
        this.showLoadingScreen();
        
        try {
            // Setup canvas
            this.canvas = document.getElementById('game-canvas');
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            
            this.updateLoadingProgress(10, 'Loading core systems...');
            
            // Initialize core systems
            this.gameLoop = new GameLoop(this);
            this.renderer = new Renderer(this);
            this.input = new Input(this);
            
            this.updateLoadingProgress(30, 'Creating universe...');
            
            // Initialize simulation systems
            this.economy = new Economy(this);
            this.factions = new Factions(this);
            this.scheduler = new Scheduler(this);
            this.universe = new Universe(this);
            
            this.updateLoadingProgress(50, 'Spawning entities...');
            
            // Create stations from data
            this.spawnInitialEntities();
            
            this.updateLoadingProgress(80, 'Creating player ship...');
            
            // Initialize player
            this.createPlayer();
            
            // Initialize HUD
            this.hud = new HUD(this);
            
            this.updateLoadingProgress(90, 'Setting up interface...');
            
            // Setup UI event listeners
            this.setupUI();
            
            this.updateLoadingProgress(100, 'Ready!');
            
            // Hide loading, show start
            setTimeout(() => {
                this.hideLoadingScreen();
                this.showStartScreen();
            }, 500);
            
        } catch (error) {
            console.error('Game initialization failed:', error);
            const loadingText = document.getElementById('loading-text');
            if (loadingText) loadingText.textContent = 'Error: ' + error.message;
        }
    }
    
    resizeCanvas() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }
    
    updateLoadingProgress(percent, text) {
        this.loadingProgress = percent;
        const progressBar = document.getElementById('loading-progress');
        const loadingText = document.getElementById('loading-text');
        if (progressBar) progressBar.style.width = percent + '%';
        if (loadingText) loadingText.textContent = text;
    }
    
    showLoadingScreen() {
        document.getElementById('loading-screen').classList.remove('hidden');
        document.getElementById('start-screen').classList.add('hidden');
    }
    
    hideLoadingScreen() {
        document.getElementById('loading-screen').classList.add('hidden');
    }
    
    showStartScreen() {
        document.getElementById('start-screen').classList.remove('hidden');
    }
    
    hideStartScreen() {
        document.getElementById('start-screen').classList.add('hidden');
    }
    
    spawnInitialEntities() {
        const system = this.data.systems[0];
        this.currentSystem = system;
        
        // Create planet/sun
        const planet = new Planet(this, {
            id: 'sigma-sun',
            name: 'Sigma Prime',
            position: { x: -1000, y: 0 },
            type: 'star',
            radius: 300,
            color: '#ffaa44'
        });
        this.entities.push(planet);
        
        // Create stations from data
        for (const stationData of this.data.stations) {
            if (stationData.system === system.id) {
                const station = new Station(this, stationData);
                this.entities.push(station);
            }
        }
        
        // Create gates
        for (const connection of system.connectedSystems || []) {
            const gate = new Gate(this, {
                id: connection.gate,
                name: 'Jump Gate',
                targetSystem: connection.system,
                position: { x: 2000, y: 0 },
                faction: 'trader_guild'
            });
            this.entities.push(gate);
        }
        
        // Spawn NPCs
        this.spawner = new Spawner(this);
        this.spawnInitialNPCs();
    }
    
    spawnInitialNPCs() {
        const count = 10;
        for (let i = 0; i < count; i++) {
            const types = ['trader', 'trader', 'civilian', 'pirate', 'police'];
            const type = types[Math.floor(Math.random() * types.length)];
            this.spawnNPC(type);
        }
    }
    
    spawnNPC(type) {
        const shipData = {
            hull: 100,
            shield: 80,
            maxSpeed: 280 + Math.random() * 100,
            turnRate: 2.5 + Math.random(),
            cargoCapacity: 30 + Math.floor(Math.random() * 50)
        };
        
        const colors = {
            trader: '#44aa44',
            pirate: '#aa4444',
            police: '#4444aa',
            civilian: '#888888'
        };
        
        const npc = {
            id: 'npc-' + Math.random().toString(36).substr(2, 9),
            name: this.generateName(type),
            x: (Math.random() - 0.5) * 4000,
            y: (Math.random() - 0.5) * 3000,
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
            minimapColor: colors[type] || '#888888',
            minimapSize: 4,
            vx: 0,
            vy: 0,
            stateTimer: 0,
            aiState: 'idle'
        };
        
        this.npcs.push(npc);
        return npc;
    }
    
    generateName(role) {
        const prefixes = {
            trader: ['MV', 'TS', 'ST'],
            pirate: ['SH', 'BC', 'RP'],
            police: ['PD', 'SF'],
            civilian: ['ST', 'LS', 'RV']
        };
        const options = prefixes[role] || ['DS'];
        const prefix = options[Math.floor(Math.random() * options.length)];
        return `${prefix}-${Math.floor(Math.random() * 9000) + 1000}`;
    }
    
    getFactionForRole(role) {
        const factions = {
            trader: ['trader_guild', 'co_me_grp'],
            pirate: ['fc_lr_grp', 'shadow_syndicate'],
            police: ['li_p_grp'],
            civilian: ['co_nws_grp']
        };
        const options = factions[role] || ['neutral'];
        return options[Math.floor(Math.random() * options.length)];
    }
    
    createPlayer() {
        const shipData = this.data.ships[0];
        this.player = new PlayerShip(this, {
            id: 'player',
            x: 500,
            y: 0,
            shipData: shipData
        });
        this.entities.push(this.player);
    }
    
    setupUI() {
        // Start screen buttons
        const newGameBtn = document.getElementById('btn-new-game');
        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => {
                this.startGame();
            });
        }
        
        // Close station menu
        const closeMenuBtn = document.getElementById('close-menu');
        if (closeMenuBtn) {
            closeMenuBtn.addEventListener('click', () => {
                this.closeStationMenu();
            });
        }
        
        // Close map
        const closeMapBtn = document.getElementById('close-map');
        if (closeMapBtn) {
            closeMapBtn.addEventListener('click', () => {
                this.closeGalaxyMap();
            });
        }
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchStationTab(tab);
            });
        });
    }
    
    startGame() {
        this.hideStartScreen();
        this.gameLoop.start();
        this.hud.addLog('Welcome to Sigma Sector, pilot.', 'system');
        this.hud.addLog('Use WASD for throttle, mouse to aim.', 'system');
    }
    
    openStationMenu(station) {
        this.isDocked = true;
        this.dockedStation = station;
        
        const stationNameEl = document.getElementById('station-name');
        if (stationNameEl) stationNameEl.textContent = station.name;
        
        const stationMenu = document.getElementById('station-menu');
        if (stationMenu) stationMenu.classList.remove('hidden');
        
        this.updateTradingPanel();
    }
    
    closeStationMenu() {
        this.isDocked = false;
        this.dockedStation = null;
        const stationMenu = document.getElementById('station-menu');
        if (stationMenu) stationMenu.classList.add('hidden');
    }
    
    switchStationTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tab + '-tab');
        });
    }
    
    updateTradingPanel() {
        const list = document.getElementById('commodity-list');
        if (!list) return;
        list.innerHTML = '';
        
        for (const commodity of this.data.commodities) {
            const price = this.economy.getPrice(commodity, this.dockedStation);
            const row = document.createElement('div');
            row.className = 'commodity-row';
            row.innerHTML = `
                <span class="commodity-name">${commodity.name}</span>
                <span class="commodity-price">${price} CR</span>
                <div class="commodity-actions">
                    <button data-action="buy" data-id="${commodity.id}">Buy</button>
                    <button data-action="sell" data-id="${commodity.id}">Sell</button>
                </div>
            `;
            list.appendChild(row);
        }
        
        list.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;
                this.handleTradeAction(action, id);
            });
        });
    }
    
    handleTradeAction(action, commodityId) {
        const commodity = this.data.commodities.find(c => c.id === commodityId);
        if (!commodity) return;
        
        const price = this.economy.getPrice(commodity, this.dockedStation);
        
        if (action === 'buy') {
            if (this.player.credits >= price) {
                this.player.credits -= price;
                this.player.cargo.push({ ...commodity });
                this.hud.addLog(`Purchased ${commodity.name} for ${price} CR`, 'trade');
            } else {
                this.hud.addLog('Not enough credits!', 'alert');
            }
        } else {
            const idx = this.player.cargo.findIndex(c => c.id === commodityId);
            if (idx >= 0) {
                this.player.credits += price;
                this.player.cargo.splice(idx, 1);
                this.hud.addLog(`Sold ${commodity.name} for ${price} CR`, 'trade');
            }
        }
        
        this.updateTradingPanel();
    }
    
    openGalaxyMap() {
        const galaxyMap = document.getElementById('galaxy-map');
        if (galaxyMap) galaxyMap.classList.remove('hidden');
        this.renderer.drawGalaxyMap();
    }
    
    closeGalaxyMap() {
        const galaxyMap = document.getElementById('galaxy-map');
        if (galaxyMap) galaxyMap.classList.add('hidden');
    }
    
    update(deltaTime) {
        if (this.isDocked) return;
        
        // Update game time
        this.gameTime += deltaTime;
        if (this.gameTime >= this.secondsPerDay) {
            this.gameTime = 0;
        }
        
        // Update scheduler
        this.scheduler.update(this.gameTime);
        
        // Update player
        if (this.player) {
            this.player.update(deltaTime);
        }
        
        // Update camera to follow player
        if (this.renderer && this.player) {
            this.renderer.centerOn(this.player.x, this.player.y);
        }
        
        // Update NPCs
        this.updateNPCs(deltaTime);
        
        // Update projectiles
        this.updateProjectiles(deltaTime);
        
        // Update HUD
        if (this.hud) {
            this.hud.update();
        }
    }
    
    updateNPCs(deltaTime) {
        for (const npc of this.npcs) {
            if (npc.isDestroyed) continue;
            
            npc.stateTimer += deltaTime;
            
            // Simple AI behavior
            switch (npc.role) {
                case 'trader':
                case 'civilian':
                    this.updateCivilianAI(npc, deltaTime);
                    break;
                case 'pirate':
                    this.updatePirateAI(npc, deltaTime);
                    break;
                case 'police':
                    this.updatePoliceAI(npc, deltaTime);
                    break;
            }
            
            // Update physics
            this.updateNPCPhysics(npc, deltaTime);
        }
    }
    
    updateCivilianAI(npc, deltaTime) {
        // Random wandering
        if (npc.stateTimer > 5 + Math.random() * 5) {
            npc.targetAngle = Math.random() * Math.PI * 2;
            npc.throttle = 0.2 + Math.random() * 0.3;
            npc.stateTimer = 0;
        }
    }
    
    updatePirateAI(npc, deltaTime) {
        // Look for targets
        if (!npc.target || npc.target.isDestroyed) {
            // Check if player is nearby
            const player = this.player;
            if (player && !player.isDestroyed) {
                const dx = player.x - npc.x;
                const dy = player.y - npc.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 800) {
                    npc.target = player;
                }
            }
        }
        
        if (npc.target) {
            const dx = npc.target.x - npc.x;
            const dy = npc.target.y - npc.y;
            npc.targetAngle = Math.atan2(dy, dx);
            npc.throttle = 0.8;
        } else {
            this.updateCivilianAI(npc, deltaTime);
        }
    }
    
    updatePoliceAI(npc, deltaTime) {
        // Patrol behavior
        if (npc.stateTimer > 8) {
            npc.targetAngle = Math.random() * Math.PI * 2;
            npc.throttle = 0.4;
            npc.stateTimer = 0;
        }
    }
    
    updateNPCPhysics(npc, deltaTime) {
        // Smooth rotation
        const angleDiff = npc.targetAngle - npc.rotation;
        let normalizedAngle = angleDiff;
        while (normalizedAngle > Math.PI) normalizedAngle -= Math.PI * 2;
        while (normalizedAngle < -Math.PI) normalizedAngle += Math.PI * 2;
        
        if (Math.abs(normalizedAngle) > 0.01) {
            const turnAmount = Math.min(Math.abs(normalizedAngle), npc.turnRate * deltaTime);
            npc.rotation += Math.sign(normalizedAngle) * turnAmount;
        }
        
        // Update speed based on throttle
        const targetSpeed = npc.throttle * npc.maxSpeed;
        npc.speed += (targetSpeed - npc.speed) * 0.05;
        
        // Apply velocity
        npc.vx += Math.cos(npc.rotation) * npc.speed * deltaTime * 0.1;
        npc.vy += Math.sin(npc.rotation) * npc.speed * deltaTime * 0.1;
        
        // Drag
        npc.vx *= 0.99;
        npc.vy *= 0.99;
        
        // Update position
        npc.x += npc.vx;
        npc.y += npc.vy;
    }
    
    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            
            proj.x += proj.vx * deltaTime;
            proj.y += proj.vy * deltaTime;
            proj.lifetime -= deltaTime;
            
            // Check collision with NPCs
            for (const npc of this.npcs) {
                if (npc.isDestroyed || proj.owner === npc) continue;
                
                const dx = npc.x - proj.x;
                const dy = npc.y - proj.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < npc.radius + proj.radius) {
                    npc.hull -= proj.damage;
                    proj.lifetime = 0;
                    
                    if (npc.hull <= 0) {
                        npc.isDestroyed = true;
                        this.hud.addLog(`${npc.name} destroyed!`, 'system');
                    }
                    break;
                }
            }
            
            // Check collision with player
            if (proj.owner !== this.player && !this.player.isDestroyed) {
                const dx = this.player.x - proj.x;
                const dy = this.player.y - proj.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < this.player.radius + proj.radius) {
                    this.player.takeDamage(proj.damage);
                    proj.lifetime = 0;
                    
                    if (this.player.hull <= 0) {
                        this.hud.addLog('Ship destroyed!', 'alert');
                    }
                }
            }
            
            // Remove expired projectiles
            if (proj.lifetime <= 0) {
                this.projectiles.splice(i, 1);
            }
        }
    }
    
    render() {
        if (!this.renderer) return;
        
        this.renderer.clear();
        this.renderer.drawBackground();
        
        // Draw all entities
        for (const entity of this.entities) {
            if (entity.visible && entity.render) {
                entity.render(this.renderer);
            }
        }
        
        // Draw NPCs
        for (const npc of this.npcs) {
            if (!npc.isDestroyed) {
                this.renderNPC(npc);
            }
        }
        
        // Draw projectiles
        this.renderProjectiles();
        
        // Draw minimap
        if (this.renderer) {
            this.renderer.drawMinimap();
        }
    }
    
    renderNPC(npc) {
        if (!this.renderer) return;
        
        const pos = this.renderer.worldToScreen(npc.x, npc.y);
        const ctx = this.renderer.ctx;
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(npc.rotation);
        
        // Ship body
        ctx.fillStyle = npc.minimapColor || '#888888';
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-15, -12);
        ctx.lineTo(-8, 0);
        ctx.lineTo(-15, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
        
        // Name label
        ctx.fillStyle = '#00ff00';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(npc.name, pos.x, pos.y + npc.radius + 15);
    }
    
    renderProjectiles() {
        if (!this.renderer) return;
        const ctx = this.renderer.ctx;
        
        for (const proj of this.projectiles) {
            const pos = this.renderer.worldToScreen(proj.x, proj.y);
            
            ctx.fillStyle = proj.color || '#ffff00';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, proj.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    getEntityAtPosition(x, y) {
        for (const entity of this.entities) {
            if (entity.containsPoint && entity.containsPoint(x, y)) {
                return entity;
            }
        }
        return null;
    }
    
    getNearbyEntities(entity, radius) {
        const nearby = [];
        const ex = entity.x;
        const ey = entity.y;
        
        for (const other of this.entities) {
            if (other === entity) continue;
            const dx = other.x - ex;
            const dy = other.y - ey;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius) {
                nearby.push({ entity: other, distance: dist });
            }
        }
        
        return nearby.sort((a, b) => a.distance - b.distance);
    }
    
    travelToSystem(systemId) {
        const system = this.data.systems.find(s => s.id === systemId);
        if (!system) return;
        
        // Clear current NPCs
        this.npcs = [];
        this.entities = [this.player];
        
        // Load new system
        this.currentSystem = system;
        
        // Spawn system entities
        for (const stationData of this.data.stations) {
            if (stationData.system === system.id) {
                const station = new Station(this, stationData);
                this.entities.push(station);
            }
        }
        
        // Add planet
        const planet = new Planet(this, {
            id: system.id + '-star',
            name: system.name,
            position: { x: 0, y: 0 },
            type: 'star',
            radius: 250,
            color: system.id === 'epsilon-3' ? '#884488' : '#ffaa44'
        });
        this.entities.push(planet);
        
        // Reset player position
        this.player.x = -2000;
        this.player.y = 0;
        
        // Spawn new NPCs
        this.spawnInitialNPCs();
        
        this.hud.addLog(`Arrived in ${system.name}`, 'system');
    }
    
    getDefaultData() {
        return {
            systems: [
                {
                    id: 'sigma-7',
                    name: 'Sigma Sector',
                    faction: 'trader_guild',
                    ambientColor: [30, 50, 80],
                    bounds: { width: 8000, height: 6000 },
                    connectedSystems: [
                        { system: 'nexus-prime', gate: 'sigma-nexus-gate' }
                    ]
                },
                {
                    id: 'nexus-prime',
                    name: 'Nexus Prime',
                    faction: 'co_me_grp',
                    ambientColor: [40, 70, 50],
                    bounds: { width: 10000, height: 8000 },
                    connectedSystems: [
                        { system: 'sigma-7', gate: 'nexus-sigma-gate' }
                    ]
                }
            ],
            stations: [
                {
                    id: 'nexus-dock',
                    name: 'Nexus Dock Alpha',
                    system: 'sigma-7',
                    position: { x: 0, y: -500 },
                    faction: 'trader_guild',
                    type: 'orbital-station',
                    services: ['trading', 'repair', 'refuel']
                },
                {
                    id: 'freeport-beta',
                    name: 'Freeport Beta',
                    system: 'sigma-7',
                    position: { x: -2000, y: 1000 },
                    faction: 'shadow_syndicate',
                    type: 'trading-post',
                    services: ['trading', 'black_market']
                },
                {
                    id: 'mining-hub',
                    name: 'Tau Mining Hub',
                    system: 'sigma-7',
                    position: { x: 2500, y: 800 },
                    faction: 'trilon_mining_corp',
                    type: 'mining-outpost',
                    services: ['trading', 'refuel']
                },
                {
                    id: 'nexus-central',
                    name: 'Nexus Central Station',
                    system: 'nexus-prime',
                    position: { x: 0, y: 0 },
                    faction: 'co_me_grp',
                    type: 'orbital-station',
                    services: ['trading', 'repair', 'refuel', 'shipyard']
                }
            ],
            factions: [
                { id: 'trader_guild', name: "Trader's Guild", color: '#44AA44', type: 'corporation' },
                { id: 'co_me_grp', name: 'Corporate Holdings', color: '#4488CC', type: 'corporation' },
                { id: 'shadow_syndicate', name: 'Shadow Syndicate', color: '#884444', type: 'pirate' },
                { id: 'trilon_mining_corp', name: 'Trilon Mining', color: '#AA8844', type: 'corporation' },
                { id: 'fc_lr_grp', name: 'Frontier Corsairs', color: '#AA4444', type: 'pirate' },
                { id: 'li_p_grp', name: 'Planetary Defense', color: '#4488FF', type: 'military' },
                { id: 'co_nws_grp', name: 'New World Shipping', color: '#888888', type: 'civilian' },
                { id: 'neutral', name: 'Independent', color: '#666666', type: 'neutral' }
            ],
            commodities: [
                { id: 'water', name: 'Water', category: 'basic', basePrice: 30, legal: true },
                { id: 'food', name: 'Food Rations', category: 'basic', basePrice: 58, legal: true },
                { id: 'ore', name: 'Raw Ore', category: 'industrial', basePrice: 80, legal: true },
                { id: 'fuel', name: 'H-Fuel', category: 'industrial', basePrice: 300, legal: true },
                { id: 'consumer_goods', name: 'Consumer Goods', category: 'consumer', basePrice: 60, legal: true },
                { id: 'weapons', name: 'Weapons', category: 'military', basePrice: 280, legal: false },
                { id: 'narcotics', name: 'Narcotics', category: 'contraband', basePrice: 750, legal: false }
            ],
            ships: [
                {
                    id: 'scout-fighter',
                    name: 'Scout-class Fighter',
                    class: 'light-fighter',
                    stats: { hull: 100, shield: 80, maxSpeed: 350, turnRate: 3.5, cargoCapacity: 20 },
                    price: 45000
                }
            ]
        };
    }
}

// Start game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
