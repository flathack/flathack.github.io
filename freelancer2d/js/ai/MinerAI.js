/**
 * MinerAI - NPC mining behavior
 */
export class MinerAI {
    constructor(npc, game) {
        this.npc = npc;
        this.game = game;
        this.state = 'idle';
        this.miningZone = null;
        this.extractionTimer = 0;
        this.cargoHeld = 0;
    }
    
    update(deltaTime) {
        if (this.npc.isDestroyed) return;
        
        switch (this.state) {
            case 'idle':
                this.stateIdle(deltaTime);
                break;
            case 'traveling':
                this.stateTraveling(deltaTime);
                break;
            case 'mining':
                this.stateMining(deltaTime);
                break;
            case 'returning':
                this.stateReturning(deltaTime);
                break;
        }
    }
    
    stateIdle(deltaTime) {
        this.npc.stateTimer += deltaTime;
        
        if (this.npc.stateTimer > 2) {
            // Find mining zone
            this.findMiningZone();
            this.state = 'traveling';
            this.npc.stateTimer = 0;
        }
    }
    
    stateTraveling(deltaTime) {
        if (!this.miningZone) {
            this.state = 'idle';
            return;
        }
        
        const dx = this.miningZone.x - this.npc.x;
        const dy = this.miningZone.y - this.npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 100) {
            // Arrived at mining zone
            this.state = 'mining';
            this.extractionTimer = 0;
        } else {
            this.npc.targetAngle = Math.atan2(dy, dx);
            this.npc.throttle = 0.6;
        }
    }
    
    stateMining(deltaTime) {
        this.extractionTimer += deltaTime;
        this.npc.throttle = 0;
        
        // Simulate mining extraction
        if (this.extractionTimer > 5) {
            const extracted = Math.min(5, this.npc.maxCargo - this.cargoHeld);
            this.cargoHeld += extracted;
            this.extractionTimer = 0;
            
            if (this.cargoHeld >= this.npc.maxCargo * 0.8) {
                // Cargo full, return to sell
                this.state = 'returning';
            }
        }
        
        // Move slightly in zone
        this.npc.targetAngle = Math.random() * Math.PI * 2;
        this.npc.throttle = 0.1;
    }
    
    stateReturning(deltaTime) {
        if (!this.npc.homeStation) {
            // Find station to sell at
            const stations = this.game.data.stations.filter(s => 
                s.system === this.game.currentSystem?.id
            );
            if (stations.length > 0) {
                this.npc.homeStation = stations[0];
            } else {
                this.state = 'idle';
                return;
            }
        }
        
        const dx = this.npc.homeStation.position.x - this.npc.x;
        const dy = this.npc.homeStation.position.y - this.npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 200) {
            // Arrived, sell cargo
            this.sellCargo();
            this.state = 'idle';
            this.cargoHeld = 0;
            this.npc.stateTimer = 0;
        } else {
            this.npc.targetAngle = Math.atan2(dy, dx);
            this.npc.throttle = 0.8;
        }
    }
    
    findMiningZone() {
        // Find asteroid/mining zone
        const bounds = this.game.currentSystem?.bounds || { width: 8000, height: 6000 };
        
        this.miningZone = {
            x: (Math.random() - 0.5) * bounds.width * 0.8,
            y: (Math.random() - 0.5) * bounds.height * 0.8
        };
    }
    
    sellCargo() {
        // Simulate selling mined ore
        if (this.cargoHeld > 0) {
            // Would add credits in full implementation
            this.npc.stateTimer = 3;
        }
    }
}
