/**
 * Universe - Manages connected star systems
 */
export class Universe {
    constructor(game) {
        this.game = game;
        this.systems = new Map();
        this.connections = [];
        
        this.loadSystems();
    }
    
    loadSystems() {
        const systems = this.game.data?.systems || [];
        
        for (const systemData of systems) {
            this.systems.set(systemData.id, {
                ...systemData,
                loaded: false,
                entities: [],
                npcs: []
            });
        }
    }
    
    getSystem(id) {
        return this.systems.get(id);
    }
    
    getConnectedSystems(systemId) {
        const system = this.systems.get(systemId);
        if (!system) return [];
        return system.connectedSystems || [];
    }
    
    isConnected(from, to) {
        const connected = this.getConnectedSystems(from);
        return connected.some(c => c.system === to);
    }
    
    getRoute(from, to) {
        // Simple BFS pathfinding
        const visited = new Set();
        const queue = [{ path: [from] }];
        
        while (queue.length > 0) {
            const current = queue.shift();
            const lastSystem = current.path[current.path.length - 1];
            
            if (lastSystem === to) {
                return current.path;
            }
            
            if (visited.has(lastSystem)) continue;
            visited.add(lastSystem);
            
            const connected = this.getConnectedSystems(lastSystem);
            for (const conn of connected) {
                if (!visited.has(conn.system)) {
                    queue.push({
                        path: [...current.path, conn.system]
                    });
                }
            }
        }
        
        return null; // No route found
    }
    
    getRouteDistance(from, to) {
        const route = this.getRoute(from, to);
        if (!route) return Infinity;
        return (route.length - 1) * 500; // Arbitrary distance per jump
    }
}
