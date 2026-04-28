/**
 * Economy - Dynamic trade and commodity system
 */
export class Economy {
    constructor(game) {
        this.game = game;
        this.prices = new Map();
        this.consumptionRates = new Map();
        this.productionRates = new Map();
        
        this.initializePrices();
    }
    
    initializePrices() {
        const commodities = this.game.data?.commodities || [];
        
        for (const commodity of commodities) {
            this.prices.set(commodity.id, {
                basePrice: commodity.basePrice || 100,
                currentPrice: commodity.basePrice || 100,
                supply: 1.0,
                demand: 1.0,
                lastUpdate: 0
            });
        }
    }
    
    update(deltaTime) {
        // Slowly drift prices based on supply/demand
        const commodities = this.game.data?.commodities || [];
        
        for (const commodity of commodities) {
            const price = this.prices.get(commodity.id);
            if (!price) continue;
            
            // Random walk for supply/demand
            price.supply += (Math.random() - 0.5) * 0.01;
            price.demand += (Math.random() - 0.5) * 0.01;
            
            // Clamp
            price.supply = Math.max(0.1, Math.min(2.0, price.supply));
            price.demand = Math.max(0.1, Math.min(2.0, price.demand));
            
            // Update price based on supply/demand
            price.currentPrice = price.basePrice * (price.demand / price.supply);
        }
    }
    
    getPrice(commodity, station = null) {
        const price = this.prices.get(commodity.id);
        let basePrice = price?.currentPrice || commodity.basePrice || 100;
        
        // Station modifiers
        if (station) {
            // Industrial stations buy raw materials higher
            if (commodity.category === 'industrial' && station.type === 'trading-post') {
                basePrice *= 1.2;
            }
            // Mining outposts sell raw materials cheaper
            if (commodity.category === 'basic' && station.type === 'mining-outpost') {
                basePrice *= 0.8;
            }
        }
        
        return Math.round(basePrice);
    }
    
    calculateProfitability(fromStation, toStation, commodity) {
        const buyPrice = this.getPrice(commodity, fromStation);
        const sellPrice = this.getPrice(commodity, toStation);
        
        const distance = this.calculateDistance(fromStation, toStation);
        const travelCost = distance * 0.1; // Fuel cost per unit distance
        
        const profit = sellPrice - buyPrice - travelCost;
        const margin = profit / buyPrice;
        
        return {
            buyPrice,
            sellPrice,
            profit,
            margin,
            travelCost,
            isProfitable: profit > 0
        };
    }
    
    calculateDistance(station1, station2) {
        const dx = station2.position.x - station1.position.x;
        const dy = station2.position.y - station1.position.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    findBestRoute(startStation, commodityId, maxJumps = 3) {
        const commodity = this.game.data.commodities.find(c => c.id === commodityId);
        if (!commodity) return null;
        
        const routes = [];
        const systems = this.game.data.systems;
        
        // Simple route finding
        for (const system of systems) {
            const stations = this.game.data.stations.filter(s => s.system === system.id);
            for (const station of stations) {
                const profit = this.calculateProfitability(startStation, station, commodity);
                if (profit.isProfitable) {
                    routes.push({
                        destination: station,
                        profit: profit
                    });
                }
            }
        }
        
        // Sort by profit
        routes.sort((a, b) => b.profit.profit - a.profit.profit);
        
        return routes.slice(0, 5);
    }
    
    updateStationSupply(station, commodityId, amount) {
        const key = `${station.id}_${commodityId}`;
        const current = this.consumptionRates.get(key) || 0;
        this.consumptionRates.set(key, current + amount);
    }
}
