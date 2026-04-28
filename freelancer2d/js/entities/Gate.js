/**
 * Gate - Jump gates and jump holes for system travel
 */
import { Entity } from './Entity.js';

export class Gate extends Entity {
    constructor(game, data) {
        super(game, data);
        
        this.name = data.name || 'Jump Gate';
        this.targetSystem = data.targetSystem;
        this.travelRadius = data.travelRadius || 200;
        
        this.radius = 100;
        this.minimapColor = '#ffaa00';
        this.minimapSize = 5;
        
        this.rotation = 0;
        this.pulsePhase = 0;
    }
    
    update(deltaTime) {
        this.rotation += 0.3 * deltaTime;
        this.pulsePhase += deltaTime * 2;
    }
    
    draw(ctx) {
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.1;
        
        ctx.save();
        ctx.rotate(this.rotation);
        
        // Outer ring
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 80 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner structure
        ctx.strokeStyle = '#cc8800';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 60, 0, Math.PI * 2);
        ctx.stroke();
        
        // Spokes
        ctx.strokeStyle = '#aa6600';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
            ctx.lineTo(Math.cos(angle) * 70, Math.sin(angle) * 70);
            ctx.stroke();
        }
        
        // Energy effect
        ctx.strokeStyle = `rgba(255, 200, 100, ${0.3 + Math.sin(this.pulsePhase * 2) * 0.2})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 90 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        
        // Center glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
        gradient.addColorStop(0, 'rgba(255, 200, 100, 0.5)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        // Draw name label
        ctx.fillStyle = '#ffcc00';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, 0, 120);
        ctx.fillText(`→ ${this.targetSystem}`, 0, 135);
    }
}
