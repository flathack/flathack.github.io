/**
 * Factions - Reputation and faction relationship system
 */
export class Factions {
    constructor(game) {
        this.game = game;
        this.factions = new Map();
        this.reputations = new Map();
        
        this.loadFactions();
    }
    
    loadFactions() {
        const factions = this.game.data?.factions || [];
        
        for (const faction of factions) {
            this.factions.set(faction.id, {
                ...faction,
                territory: [],
                allegiances: faction.allegiances || [],
                hostilities: faction.hostilities || []
            });
        }
    }
    
    getFaction(id) {
        return this.factions.get(id);
    }
    
    getReputation(fromFaction, toFaction) {
        const key = `${fromFaction}_${toFaction}`;
        return this.reputations.get(key) || 0;
    }
    
    setReputation(fromFaction, toFaction, value) {
        const key = `${fromFaction}_${toFaction}`;
        this.reputations.set(key, Math.max(-100, Math.min(100, value)));
    }
    
    modifyReputation(fromFaction, toFaction, delta) {
        const current = this.getReputation(fromFaction, toFaction);
        this.setReputation(fromFaction, toFaction, current + delta);
    }
    
    isHostile(faction1, faction2) {
        // Check direct hostility
        const f1 = this.factions.get(faction1);
        const f2 = this.factions.get(faction2);
        
        if (f1?.hostilities?.includes(faction2)) return true;
        if (f2?.hostilities?.includes(faction1)) return true;
        
        // Check reputation threshold
        const rep = this.getReputation(faction1, faction2);
        if (rep <= -50) return true;
        
        return false;
    }
    
    isFriendly(faction1, faction2) {
        // Check allegiances
        const f1 = this.factions.get(faction1);
        const f2 = this.factions.get(faction2);
        
        if (f1?.allegiances?.includes(faction2)) return true;
        if (f2?.allegiances?.includes(faction1)) return true;
        
        // Check reputation threshold
        const rep = this.getReputation(faction1, faction2);
        if (rep >= 25) return true;
        
        return false;
    }
    
    canDock(faction, stationFaction) {
        const rep = this.getReputation(faction, stationFaction);
        return rep >= -25;
    }
    
    getHostileFactions(faction) {
        const hostile = [faction];
        const f = this.factions.get(faction);
        
        if (f?.hostilities) {
            hostile.push(...f.hostilities);
        }
        
        // Also add factions with low rep
        for (const [key, rep] of this.reputations) {
            if (key.startsWith(faction + '_') && rep <= -50) {
                const targetFaction = key.split('_')[1];
                if (!hostile.includes(targetFaction)) {
                    hostile.push(targetFaction);
                }
            }
        }
        
        return hostile;
    }
    
    getAllyFactions(faction) {
        const allies = [faction];
        const f = this.factions.get(faction);
        
        if (f?.allegiances) {
            allies.push(...f.allegiances);
        }
        
        return allies;
    }
    
    controlTerritory(faction, systemId) {
        const f = this.factions.get(faction);
        return f?.territory?.includes(systemId) || false;
    }
}
