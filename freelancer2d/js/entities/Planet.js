/**
 * Planet - Planets and stars in systems
 */
import { Entity } from './Entity.js';

export class Planet extends Entity {
    constructor(game, data) {
        super(game, data);
        
        this.name = data.name || 'Planet';
        this.type = data.type || 'planet'; // 'planet', 'star', 'gas-giant'
        this.radius = data.radius || 200;
        this.color = data.color || '#4488ff';
        this.atmosphereColor = data.atmosphereColor || '#88ccff';
        
        this.minimapColor = 'transparent';
        this.minimapSize = 0;
        
        this.rotation = data.rotation || 0;
        this.rotationSpeed = data.rotationSpeed || 0.05;
        
        // Orbital stations/bases around planet
        this.children = data.children || [];
    }
    
    update(deltaTime) {
        this.rotation += this.rotationSpeed * deltaTime;
    }
    
    draw(ctx) {
        ctx.save();
        
        switch (this.type) {
            case 'star':
                this.drawStar(ctx);
                break;
            case 'gas-giant':
                this.drawGasGiant(ctx);
                break;
            default:
                this.drawPlanet(ctx);
        }
        
        ctx.restore();
    }
    
    drawStar(ctx) {
        // Sun/star with glow effect
        const time = Date.now() / 1000;
        
        // Outer corona
        const gradient = ctx.createRadialGradient(0, 0, this.radius * 0.5, 0, 0, this.radius * 2);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.8)');
        gradient.addColorStop(0.6, 'rgba(255, 150, 50, 0.3)');
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Core
        const coreGradient = ctx.createRadialGradient(
            -this.radius * 0.2, -this.radius * 0.2, 0,
            0, 0, this.radius
        );
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(0.3, this.color);
        coreGradient.addColorStop(1, '#ff4400');
        
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Surface details (flares)
        ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 + time;
            const dist = this.radius * (0.3 + Math.sin(time + i) * 0.2);
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            
            ctx.beginPath();
            ctx.arc(x, y, 20 + Math.sin(time * 2 + i) * 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    drawPlanet(ctx) {
        // Base planet
        const gradient = ctx.createRadialGradient(
            -this.radius * 0.3, -this.radius * 0.3, 0,
            0, 0, this.radius
        );
        gradient.addColorStop(0, this.atmosphereColor);
        gradient.addColorStop(0.7, this.color);
        gradient.addColorStop(1, '#222244');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Surface features (bands for atmosphere)
        ctx.save();
        ctx.clip();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 5;
        
        for (let i = -this.radius; i < this.radius; i += 30) {
            ctx.beginPath();
            ctx.moveTo(-this.radius, i);
            ctx.lineTo(this.radius, i);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Atmosphere ring
        ctx.strokeStyle = this.atmosphereColor;
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    
    drawGasGiant(ctx) {
        // Gas giant with horizontal bands
        const gradient = ctx.createRadialGradient(
            -this.radius * 0.2, -this.radius * 0.2, 0,
            0, 0, this.radius
        );
        gradient.addColorStop(0, '#ffeecc');
        gradient.addColorStop(0.5, '#ddaa77');
        gradient.addColorStop(1, '#885544');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Bands
        ctx.save();
        ctx.clip();
        
        const time = Date.now() / 2000;
        const bandColors = [
            'rgba(200, 150, 100, 0.5)',
            'rgba(150, 100, 80, 0.5)',
            'rgba(180, 120, 90, 0.5)'
        ];
        
        for (let i = 0; i < 8; i++) {
            const y = -this.radius + (i / 7) * this.radius * 2;
            const bandHeight = 10 + Math.sin(i * 0.5 + time) * 5;
            
            ctx.fillStyle = bandColors[i % 3];
            ctx.fillRect(-this.radius, y, this.radius * 2, bandHeight);
        }
        
        // Storm spot
        ctx.fillStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.beginPath();
        ctx.ellipse(this.radius * 0.3, 0, 30, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}
