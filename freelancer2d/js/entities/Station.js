/**
 * Station - Orbital stations and bases for docking
 */
import { Entity } from './Entity.js';

export class Station extends Entity {
    constructor(game, data) {
        super(game, data);
        
        this.name = data.name || 'Station';
        this.type = data.type || 'orbital-station';
        this.services = data.services || ['trading'];
        this.dockRadius = data.dockRadius || 150;
        this.repRequired = data.repRequired || -50;
        
        this.radius = 80;
        this.minimapColor = '#00aaff';
        this.minimapSize = 6;
        
        this.rotation = 0;
        this.rotationSpeed = 0.1;
    }
    
    update(deltaTime) {
        this.rotation += this.rotationSpeed * deltaTime;
    }
    
    draw(ctx) {
        // Station body - different shapes based on type
        ctx.save();
        
        const pulse = 1 + Math.sin(Date.now() / 500) * 0.05;
        ctx.scale(pulse, pulse);
        
        switch (this.type) {
            case 'orbital-station':
                this.drawOrbitalStation(ctx);
                break;
            case 'mining-outpost':
                this.drawMiningOutpost(ctx);
                break;
            case 'trading-post':
                this.drawTradingPost(ctx);
                break;
            default:
                this.drawOrbitalStation(ctx);
        }
        
        ctx.restore();
    }
    
    drawOrbitalStation(ctx) {
        // Main ring
        ctx.fillStyle = '#334455';
        ctx.strokeStyle = '#556677';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Inner ring
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Center module
        ctx.fillStyle = '#445566';
        ctx.fillRect(-15, -15, 30, 30);
        
        // Lights
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + this.rotation;
            const x = Math.cos(angle) * 55;
            const y = Math.sin(angle) * 55;
            
            ctx.fillStyle = (i % 2 === 0) ? '#00ff00' : '#ff0000';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Docking indicator
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, this.dockRadius * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    drawMiningOutpost(ctx) {
        // Mining outpost - industrial look
        ctx.fillStyle = '#553333';
        ctx.strokeStyle = '#774444';
        ctx.lineWidth = 2;
        
        // Main structure
        ctx.beginPath();
        ctx.rect(-40, -30, 80, 60);
        ctx.fill();
        ctx.stroke();
        
        // Drill arm
        ctx.save();
        ctx.rotate(this.rotation);
        ctx.fillStyle = '#666666';
        ctx.fillRect(-5, -70, 10, 40);
        ctx.fillStyle = '#888888';
        ctx.beginPath();
        ctx.moveTo(-10, -70);
        ctx.lineTo(0, -85);
        ctx.lineTo(10, -70);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        
        // Lights
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(-30, -40, 5, 0, Math.PI * 2);
        ctx.arc(30, -40, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawTradingPost(ctx) {
        // Trading post - commercial hub look
        ctx.fillStyle = '#334433';
        ctx.strokeStyle = '#446644';
        ctx.lineWidth = 2;
        
        // Main dome
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Inner structure
        ctx.fillStyle = '#445544';
        ctx.beginPath();
        ctx.arc(0, 0, 35, 0, Math.PI * 2);
        ctx.fill();
        
        // Windows
        ctx.fillStyle = '#aaffaa';
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + this.rotation * 0.5;
            const x = Math.cos(angle) * 40;
            const y = Math.sin(angle) * 40;
            
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Docking ring indicator
        ctx.strokeStyle = '#44ff44';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 60, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    canDock(faction) {
        const rep = this.game.factions?.getReputation(faction, this.faction) || 0;
        return rep >= this.repRequired;
    }
}
