/**
 * PirateAI - NPC pirate behavior
 */
export class PirateAI {
    constructor(npc, game) {
        this.npc = npc;
        this.game = game;
        this.state = 'patrol';
        this.ambushPoint = null;
        this.attackTarget = null;
        this.fleeTimer = 0;
    }
    
    update(deltaTime) {
        if (this.npc.isDestroyed) return;
        
        switch (this.state) {
            case 'patrol':
                this.statePatrol(deltaTime);
                break;
            case 'hunting':
                this.stateHunting(deltaTime);
                break;
            case 'engaging':
                this.stateEngaging(deltaTime);
                break;
            case 'fleeing':
                this.stateFleeing(deltaTime);
                break;
        }
    }
    
    statePatrol(deltaTime) {
        this.npc.stateTimer += deltaTime;
        
        // Pick new patrol point periodically
        if (this.npc.stateTimer > 10 || !this.ambushPoint) {
            this.setNewPatrolPoint();
            this.npc.stateTimer = 0;
        }
        
        // Move toward patrol point
        if (this.ambushPoint) {
            const dx = this.ambushPoint.x - this.npc.x;
            const dy = this.ambushPoint.y - this.npc.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 100) {
                // Reached patrol point, look for targets
                this.checkForTargets();
            } else {
                this.npc.targetAngle = Math.atan2(dy, dx);
                this.npc.throttle = 0.5;
            }
        }
    }
    
    stateHunting(deltaTime) {
        if (!this.attackTarget || this.attackTarget.isDestroyed) {
            this.attackTarget = null;
            this.state = 'patrol';
            return;
        }
        
        const dx = this.attackTarget.x - this.npc.x;
        const dy = this.attackTarget.y - this.npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Check if target is in range and vulnerable
        if (dist < 500) {
            // Attack!
            this.state = 'engaging';
        } else if (dist > 1000) {
            // Lost target
            this.attackTarget = null;
            this.state = 'patrol';
        } else {
            // Follow target
            this.npc.targetAngle = Math.atan2(dy, dx);
            this.npc.throttle = 0.9;
        }
    }
    
    stateEngaging(deltaTime) {
        if (!this.attackTarget || this.attackTarget.isDestroyed) {
            this.attackTarget = null;
            this.state = 'patrol';
            return;
        }
        
        const dx = this.attackTarget.x - this.npc.x;
        const dy = this.attackTarget.y - this.npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Aim at target
        this.npc.targetAngle = Math.atan2(dy, dx);
        
        // Approach to attack range
        if (dist > 200) {
            this.npc.throttle = 0.7;
        } else {
            this.npc.throttle = 0.3;
        }
        
        // Fire weapons
        if (dist < 300) {
            // Simulate attack
            if (Math.random() < 0.02) {
                this.attackTarget.hull -= 5;
                if (this.attackTarget.hull <= 0) {
                    this.attackTarget.isDestroyed = true;
                    this.state = 'salvaging';
                }
            }
        }
        
        // Check if should flee (outnumbered or damaged)
        if (this.npc.hull < this.npc.maxHull * 0.3) {
            this.state = 'fleeing';
            this.fleeTimer = 0;
        }
    }
    
    stateFleeing(deltaTime) {
        this.fleeTimer += deltaTime;
        
        // Run away from threats
        if (this.attackTarget) {
            const dx = this.npc.x - this.attackTarget.x;
            const dy = this.npc.y - this.attackTarget.y;
            this.npc.targetAngle = Math.atan2(dy, dx);
        } else {
            this.npc.targetAngle = Math.random() * Math.PI * 2;
        }
        
        this.npc.throttle = 1.0;
        
        // Return to patrol after cooldown
        if (this.fleeTimer > 10) {
            this.attackTarget = null;
            this.state = 'patrol';
            this.fleeTimer = 0;
        }
    }
    
    checkForTargets() {
        // Look for vulnerable targets (traders, civilians)
        const player = this.game.player;
        const npcs = this.game.npcs;
        
        let bestTarget = null;
        let bestScore = 0;
        
        // Check player
        if (player && !player.isDestroyed) {
            const dist = Math.sqrt(
                Math.pow(player.x - this.npc.x, 2) + 
                Math.pow(player.y - this.npc.y, 2)
            );
            
            // Don't attack if player is too strong or too far
            if (dist < 1500 && player.hull < this.npc.hull * 1.5) {
                // Player is good target if vulnerable
                bestScore = 100;
                bestTarget = player;
            }
        }
        
        // Check other NPCs
        for (const npc of npcs) {
            if (npc === this.npc || npc.isDestroyed) continue;
            
            const dist = Math.sqrt(
                Math.pow(npc.x - this.npc.x, 2) + 
                Math.pow(npc.y - this.npc.y, 2)
            );
            
            if (dist > 1500) continue;
            
            // Prefer weaker targets
            if (npc.role === 'trader' || npc.role === 'civilian') {
                const score = 50 + (1 / dist) * 1000 - npc.hull;
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = npc;
                }
            }
        }
        
        if (bestTarget) {
            this.attackTarget = bestTarget;
            this.state = 'hunting';
        }
    }
    
    setNewPatrolPoint() {
        // Set patrol point away from stations (pirate territory)
        this.ambushPoint = {
            x: (Math.random() - 0.5) * 3000 + 1000,
            y: (Math.random() - 0.5) * 3000
        };
    }
}
