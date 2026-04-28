/**
 * PlayerShip - Player-controlled ship with mouse-aim controls
 */
import { Ship } from './Ship.js';

export class PlayerShip extends Ship {
    constructor(game, data) {
        super(game, data);
        
        this.name = 'Your Ship';
        this.credits = 10000;
        this.faction = 'player';
        
        this.minimapColor = '#ffffff';
        this.minimapSize = 5;
        
        this.targetIndex = 0;
        this.targetMode = 'enemy'; // 'enemy', 'friendly', 'all'
    }
    
    update(deltaTime) {
        // Mouse aiming
        const worldPos = this.game.input.getWorldMousePosition();
        this.targetAngle = Math.atan2(worldPos.y - this.y, worldPos.x - this.x);
        
        // Continuous fire while mouse is down
        if (this.game.input.mouseDown) {
            if (this.firePrimary()) {
                this.spawnProjectile();
            }
        }
        
        // Right click for secondary
        if (this.game.input.rightMouseDown) {
            if (this.fireSecondary()) {
                this.fireMissile();
            }
        }
        
        // Release cruise when shift released
        if (!this.game.input.isKeyDown('ShiftLeft') && !this.game.input.isKeyDown('ShiftRight')) {
            this.isCruising = false;
        }
        
        super.update(deltaTime);
    }
    
    spawnProjectile() {
        const projectile = {
            x: this.x + Math.cos(this.rotation) * 30,
            y: this.y + Math.sin(this.rotation) * 30,
            vx: Math.cos(this.rotation) * 1000 + this.vx,
            vy: Math.sin(this.rotation) * 1000 + this.vy,
            damage: 10,
            owner: this,
            lifetime: 2,
            radius: 5,
            color: '#ffff00'
        };
        
        // Add to game projectiles
        if (!this.game.projectiles) {
            this.game.projectiles = [];
        }
        this.game.projectiles.push(projectile);
    }
    
    fireMissile() {
        const missile = {
            x: this.x + Math.cos(this.rotation) * 25,
            y: this.y + Math.sin(this.rotation) * 25,
            vx: Math.cos(this.rotation) * 500 + this.vx,
            vy: Math.sin(this.rotation) * 500 + this.vy,
            damage: 50,
            owner: this,
            lifetime: 5,
            radius: 8,
            color: '#ff4444',
            isMissile: true,
            target: this.target
        };
        
        if (!this.game.projectiles) {
            this.game.projectiles = [];
        }
        this.game.projectiles.push(missile);
    }
    
    nextTarget() {
        if (!this.game.npcs || this.game.npcs.length === 0) return;
        
        this.targetIndex = (this.targetIndex + 1) % this.game.npcs.length;
        this.target = this.game.npcs[this.targetIndex];
        
        if (this.target) {
            this.game.hud.addLog(`Target locked: ${this.target.name || 'Unknown'}`, 'system');
        }
    }
    
    toggleTargetMode() {
        const modes = ['enemy', 'friendly', 'all'];
        const currentIndex = modes.indexOf(this.targetMode);
        this.targetMode = modes[(currentIndex + 1) % modes.length];
        this.game.hud.addLog(`Target mode: ${this.targetMode}`, 'system');
    }
    
    render(renderer) {
        if (!this.visible) return;
        
        const pos = renderer.worldToScreen(this.x, this.y);
        
        renderer.ctx.save();
        renderer.ctx.translate(pos.x, pos.y);
        renderer.ctx.rotate(this.rotation);
        
        // Ship body
        renderer.ctx.fillStyle = '#eeeeee';
        renderer.ctx.strokeStyle = '#aaaaaa';
        renderer.ctx.lineWidth = 2;
        
        // Main body
        renderer.ctx.beginPath();
        renderer.ctx.moveTo(30, 0);
        renderer.ctx.lineTo(-20, -18);
        renderer.ctx.lineTo(-12, -8);
        renderer.ctx.lineTo(-12, 8);
        renderer.ctx.lineTo(-20, 18);
        renderer.ctx.closePath();
        renderer.ctx.fill();
        renderer.ctx.stroke();
        
        // Cockpit
        renderer.ctx.fillStyle = '#4488ff';
        renderer.ctx.beginPath();
        renderer.ctx.ellipse(5, 0, 8, 5, 0, 0, Math.PI * 2);
        renderer.ctx.fill();
        
        // Engine glow
        if (this.speed > 10) {
            const glowIntensity = Math.min(1, this.speed / this.maxSpeed);
            const gradient = renderer.ctx.createRadialGradient(-15, 0, 0, -15, 0, 15 + glowIntensity * 10);
            gradient.addColorStop(0, `rgba(255, 150, 50, ${glowIntensity})`);
            gradient.addColorStop(0.5, `rgba(255, 100, 0, ${glowIntensity * 0.5})`);
            gradient.addColorStop(1, 'transparent');
            
            renderer.ctx.fillStyle = gradient;
            renderer.ctx.beginPath();
            renderer.ctx.arc(-15, 0, 15 + glowIntensity * 10, 0, Math.PI * 2);
            renderer.ctx.fill();
        }
        
        // Cruise effect
        if (this.isCruising) {
            renderer.ctx.strokeStyle = `rgba(100, 200, 255, 0.5)`;
            renderer.ctx.lineWidth = 3;
            renderer.ctx.beginPath();
            renderer.ctx.moveTo(-20, 0);
            renderer.ctx.lineTo(-60, 0);
            renderer.ctx.stroke();
        }
        
        renderer.ctx.restore();
        
        // Draw target reticle
        if (this.target && !this.target.isDestroyed) {
            const targetPos = renderer.worldToScreen(this.target.x, this.target.y);
            
            renderer.ctx.strokeStyle = '#ffaa00';
            renderer.ctx.lineWidth = 2;
            
            // Square reticle
            const size = 40;
            renderer.ctx.strokeRect(
                targetPos.x - size/2,
                targetPos.y - size/2,
                size, size
            );
            
            // Corner brackets
            const bracket = 10;
            // Top-left
            renderer.ctx.beginPath();
            renderer.ctx.moveTo(targetPos.x - size/2, targetPos.y - size/2 + bracket);
            renderer.ctx.lineTo(targetPos.x - size/2, targetPos.y - size/2);
            renderer.ctx.lineTo(targetPos.x - size/2 + bracket, targetPos.y - size/2);
            renderer.ctx.stroke();
            // Top-right
            renderer.ctx.beginPath();
            renderer.ctx.moveTo(targetPos.x + size/2 - bracket, targetPos.y - size/2);
            renderer.ctx.lineTo(targetPos.x + size/2, targetPos.y - size/2);
            renderer.ctx.lineTo(targetPos.x + size/2, targetPos.y - size/2 + bracket);
            renderer.ctx.stroke();
            // Bottom-right
            renderer.ctx.beginPath();
            renderer.ctx.moveTo(targetPos.x + size/2, targetPos.y + size/2 - bracket);
            renderer.ctx.lineTo(targetPos.x + size/2, targetPos.y + size/2);
            renderer.ctx.lineTo(targetPos.x + size/2 - bracket, targetPos.y + size/2);
            renderer.ctx.stroke();
            // Bottom-left
            renderer.ctx.beginPath();
            renderer.ctx.moveTo(targetPos.x - size/2 + bracket, targetPos.y + size/2);
            renderer.ctx.lineTo(targetPos.x - size/2, targetPos.y + size/2);
            renderer.ctx.lineTo(targetPos.x - size/2, targetPos.y + size/2 - bracket);
            renderer.ctx.stroke();
        }
    }
    
    getSaveData() {
        return {
            ...super.getSaveData(),
            credits: this.credits
        };
    }
}
