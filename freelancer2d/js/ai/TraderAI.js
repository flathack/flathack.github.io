/**
 * TraderAI - NPC trading behavior
 */
export class TraderAI {
    constructor(npc, game) {
        this.npc = npc;
        this.game = game;
        this.state = 'idle';
        this.currentCargo = [];
        this.targetStation = null;
        this.profitMargin = 0;
    }
    
    update(deltaTime) {
        if (this.npc.isDestroyed) return;
        
        switch (this.state) {
            case 'idle':
                this.stateIdle(deltaTime);
                break;
            case 'planning':
                this.statePlanning(deltaTime);
                break;
            case 'traveling':
                this.stateTraveling(deltaTime);
                break;
            case 'docked':
                this.stateDocked(deltaTime);
                break;
            case 'returning':
                this.stateReturning(deltaTime);
                break;
        }
    }
    
    stateIdle(deltaTime) {
        this.npc.stateTimer += deltaTime;
        if (this.npc.stateTimer > 2) {
            this.state = 'planning';
            this.npc.stateTimer = 0;
        }
    }
    
    statePlanning(deltaTime) {
        // Find profitable route
        if (this.npc.homeStation && this.currentCargo.length === 0) {
            // Look for cargo to buy
            const commodities = this.game.data.commodities;
            const bestCommodity = this.findBestBuy(commodities, this.npc.homeStation);
            
            if (bestCommodity) {
                this.targetStation = bestCommodity.destination;
                this.npc.cargo = [{ ...bestCommodity.commodity, quantity: 10 }];
                this.currentCargo = this.npc.cargo;
                this.npc.stateTimer = 0;
                this.state = 'traveling';
            } else {
                // No profitable route, just cruise
                this.npc.targetAngle = Math.random() * Math.PI * 2;
                this.npc.throttle = 0.3;
            }
        } else if (this.currentCargo.length > 0) {
            // Has cargo, need to sell
            this.targetStation = this.npc.homeStation;
            this.state = 'returning';
        }
    }
    
    stateTraveling(deltaTime) {
        if (!this.targetStation) {
            this.state = 'planning';
            return;
        }
        
        // Move toward target
        const dx = this.targetStation.position.x - this.npc.x;
        const dy = this.targetStation.position.y - this.npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 200) {
            // Arrived
            this.state = 'docked';
            this.npc.stateTimer = 0;
        } else {
            this.npc.targetAngle = Math.atan2(dy, dx);
            this.npc.throttle = 0.8;
        }
    }
    
    stateDocked(deltaTime) {
        this.npc.stateTimer += deltaTime;
        
        // Simulate docking time
        if (this.npc.stateTimer > 3) {
            if (this.currentCargo.length > 0) {
                // Sell cargo
                const profit = this.calculateProfit(this.currentCargo[0]);
                this.npc.cargo = [];
                this.currentCargo = [];
                this.state = 'planning';
            } else {
                // Buy cargo
                const commodities = this.game.data.commodities;
                const best = this.findBestBuy(commodities, this.npc.homeStation);
                if (best) {
                    this.npc.cargo = [{ ...best.commodity, quantity: 10 }];
                    this.currentCargo = this.npc.cargo;
                }
                this.state = 'planning';
            }
            this.npc.stateTimer = 0;
        }
        
        this.npc.throttle = 0;
    }
    
    stateReturning(deltaTime) {
        if (!this.targetStation) {
            this.state = 'planning';
            return;
        }
        
        const dx = this.targetStation.position.x - this.npc.x;
        const dy = this.targetStation.position.y - this.npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 200) {
            this.state = 'docked';
            this.npc.stateTimer = 0;
        } else {
            this.npc.targetAngle = Math.atan2(dy, dx);
            this.npc.throttle = 0.8;
        }
    }
    
    findBestBuy(commodities, station) {
        let best = null;
        let bestProfit = 0;
        
        for (const commodity of commodities) {
            const routes = this.game.economy.findBestRoute(station, commodity.id);
            if (routes && routes.length > 0) {
                const route = routes[0];
                if (route.profit.profit > bestProfit) {
                    bestProfit = route.profit.profit;
                    best = {
                        commodity,
                        destination: route.destination,
                        profit: route.profit
                    };
                }
            }
        }
        
        return best;
    }
    
    calculateProfit(cargo) {
        if (!this.npc.homeStation || !cargo) return 0;
        
        const buyPrice = this.game.economy.getPrice(cargo, this.targetStation);
        const sellPrice = this.game.economy.getPrice(cargo, this.npc.homeStation);
        
        return sellPrice - buyPrice;
    }
}
