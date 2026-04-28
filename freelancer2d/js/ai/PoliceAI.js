/**
 * PoliceAI - NPC police/patrol behavior
 */
export class PoliceAI {
    constructor(npc, game) {
        this.npc = npc;
        this.game = game;
        this.state = 'patrol';
        this.patrolRoute = [];
        this.currentWaypoint = 0;
        this.respondingTo = null;
    }
    
    update(deltaTime) {
        if (this.npc.isDestroyed) return;
        
        switch (this.state) {
            case 'patrol':
                this.statePatrol(deltaTime);
                break;
            case 'scanning':
                this.stateScanning(deltaTime);
                break;
            case 'engaging':
                this.stateEngaging(deltaTime);
                break;
            case 'responding':
                this.stateResponding(deltaTime);
                break;
        }
    }
    
    statePatrol(deltaTime) {
        this.npc.stateTimer += deltaTime;
        
        // Set up patrol route if not set
        if (this.patrolRoute.length === 0) {
            this.generatePatrolRoute();
        }
        
        // Move to current waypoint
        if (this.patrolRoute.length > 0) {
            const waypoint = this.patrolRoute[this.currentWaypoint];
            const dx = waypoint.x - this.npc.x;
            const dy = waypoint.y - this.npc.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 100) {
                // Reached waypoint, move to next
                this.currentWaypoint = (this.currentWaypoint + 1) % this.patrolRoute.length;
            } else {
                this.npc.targetAngle = Math.atan2(dy, dx);
                this.npc.throttle = 0.6;
            }
        }
        
        // Check for crimes
        this.checkForCrimes();
    }
    
    stateScanning(deltaTime) {
        this.npc.stateTimer += deltaTime;
        
        // Slow down and scan nearby ships
        this.npc.throttle = 0.2;
        
        // Check if suspicious NPCs are nearby
        const nearby = this.checkNearbyShips();
        if (nearby.length > 0) {
            const suspicious = nearby.find(n => this.isSuspicious(n));
            if (suspicious) {
                this.state = 'engaging';
                this.npc.target = suspicious;
            } else {
                this.state = 'patrol';
            }
        } else if (this.npc.stateTimer > 5) {
            this.state = 'patrol';
        }
    }
    
    stateEngaging(deltaTime) {
        if (!this.npc.target || this.npc.target.isDestroyed) {
            this.npc.target = null;
            this.state = 'patrol';
            return;
        }
        
        const dx = this.npc.target.x - this.npc.x;
        const dy = this.npc.target.y - this.npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        this.npc.targetAngle = Math.atan2(dy, dx);
        
        // Interdict and fine/destroy criminals
        if (dist < 100) {
            if (this.isSuspicious(this.npc.target)) {
                // Attack hostile NPCs
                if (this.npc.target.role === 'pirate') {
                    if (Math.random() < 0.03) {
                        this.npc.target.hull -= 8;
                        if (this.npc.target.hull <= 0) {
                            this.npc.target.isDestroyed = true;
                            this.state = 'patrol';
                            this.game.hud?.addLog('Police destroyed a criminal vessel', 'system');
                        }
                    }
                }
            }
            this.npc.throttle = 0;
        } else {
            this.npc.throttle = 0.8;
        }
    }
    
    stateResponding(deltaTime) {
        if (!this.respondingTo) {
            this.state = 'patrol';
            return;
        }
        
        const dx = this.respondingTo.x - this.npc.x;
        const dy = this.respondingTo.y - this.npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 200) {
            // Arrived at alert location
            this.respondingTo = null;
            this.state = 'scanning';
            this.npc.stateTimer = 0;
        } else {
            this.npc.targetAngle = Math.atan2(dy, dx);
            this.npc.throttle = 1.0; // Full speed to respond
        }
    }
    
    generatePatrolRoute() {
        // Generate patrol route around stations and trade lanes
        const stations = this.game.data.stations.filter(s => 
            s.system === this.game.currentSystem?.id
        );
        
        this.patrolRoute = [];
        
        for (const station of stations.slice(0, 3)) {
            this.patrolRoute.push({
                x: station.position.x + (Math.random() - 0.5) * 500,
                y: station.position.y + (Math.random() - 0.5) * 500
            });
        }
        
        // Add some random points
        for (let i = 0; i < 3; i++) {
            this.patrolRoute.push({
                x: (Math.random() - 0.5) * 3000,
                y: (Math.random() - 0.5) * 3000
            });
        }
    }
    
    checkForCrimes() {
        // Check if any pirates are attacking nearby
        const npcs = this.game.npcs;
        
        for (const npc of npcs) {
            if (npc === this.npc || npc.isDestroyed) continue;
            
            const dist = Math.sqrt(
                Math.pow(npc.x - this.npc.x, 2) + 
                Math.pow(npc.y - this.npc.y, 2)
            );
            
            if (dist < 500 && npc.role === 'pirate') {
                this.npc.target = npc;
                this.state = 'engaging';
                return;
            }
        }
    }
    
    checkNearbyShips() {
        const nearby = [];
        const npcs = this.game.npcs;
        const player = this.game.player;
        
        // Check player
        if (player && !player.isDestroyed) {
            const dist = Math.sqrt(
                Math.pow(player.x - this.npc.x, 2) + 
                Math.pow(player.y - this.npc.y, 2)
            );
            if (dist < 300) {
                nearby.push(player);
            }
        }
        
        // Check NPCs
        for (const npc of npcs) {
            if (npc === this.npc || npc.isDestroyed) continue;
            
            const dist = Math.sqrt(
                Math.pow(npc.x - this.npc.x, 2) + 
                Math.pow(npc.y - this.npc.y, 2)
            );
            
            if (dist < 300) {
                nearby.push(npc);
            }
        }
        
        return nearby;
    }
    
    isSuspicious(ship) {
        // Check if ship is hostile or has contraband
        if (ship.role === 'pirate') return true;
        
        // Check faction hostility
        if (this.game.factions?.isHostile(ship.faction, this.npc.faction)) {
            return true;
        }
        
        return false;
    }
}
