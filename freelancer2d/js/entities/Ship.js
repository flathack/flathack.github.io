/**
 * Ship - Base class for player and NPC ships
 */
import { Entity } from './Entity.js';

export class Ship extends Entity {
    constructor(game, data) {
        super(game, data);
        
        this.shipData = data.shipData || {
            hull: 100,
            shield: 80,
            maxSpeed: 300,
            turnRate: 3.0,
            cargoCapacity: 50
        };
        
        // Stats
        this.maxHull = this.shipData.hull || 100;
        this.hull = this.maxHull;
        this.maxShield = this.shipData.shield || 80;
        this.shield = this.maxShield;
        this.maxEnergy = 100;
        this.energy = this.maxEnergy;
        
        // Movement
        this.maxSpeed = this.shipData.maxSpeed || 300;
        this.speed = 0;
        this.throttle = 0;
        this.cruiseSpeed = this.maxSpeed * 2.5;
        this.isCruising = false;
        this.turnRate = this.shipData.turnRate || 3.0;
        this.targetAngle = 0;
        
        // Physics
        this.vx = 0;
        this.vy = 0;
        this.acceleration = 500;
        this.drag = 0.98;
        
        // Weapons
        this.primaryWeaponCooldown = 0;
        this.primaryWeaponDelay = 0.15; // seconds
        this.secondaryWeaponCooldown = 0;
        this.secondaryWeaponDelay = 0.5;
        
        // Cargo
        this.maxCargo = this.shipData.cargoCapacity || 50;
        this.cargo = [];
        this.cargoMass = 0;
        
        // State
        this.isTargetingPlayer = false;
        this.target = null;
        this.isDestroyed = false;
        
        this.radius = 20;
        this.minimapColor = '#888888';
        this.minimapSize = 4;
    }
    
    update(deltaTime) {
        if (this.isDestroyed) return;
        
        // Update target angle
        const angleDiff = this.targetAngle - this.rotation;
        let normalizedAngle = angleDiff;
        while (normalizedAngle > Math.PI) normalizedAngle -= Math.PI * 2;
        while (normalizedAngle < -Math.PI) normalizedAngle += Math.PI * 2;
        
        // Smooth rotation
        if (Math.abs(normalizedAngle) > 0.01) {
            const turnAmount = Math.min(Math.abs(normalizedAngle), this.turnRate * deltaTime);
            this.rotation += Math.sign(normalizedAngle) * turnAmount;
        }
        
        // Update speed based on throttle
        const effectiveMaxSpeed = this.isCruising ? this.cruiseSpeed : this.maxSpeed;
        const targetSpeed = this.throttle * effectiveMaxSpeed;
        this.speed += (targetSpeed - this.speed) * 0.05;
        
        // Apply drag
        this.vx *= this.drag;
        this.vy *= this.drag;
        
        // Apply acceleration in facing direction
        if (this.speed > 1) {
            this.vx += Math.cos(this.rotation) * this.acceleration * deltaTime * (this.speed / effectiveMaxSpeed);
            this.vy += Math.sin(this.rotation) * this.acceleration * deltaTime * (this.speed / effectiveMaxSpeed);
        }
        
        // Update position
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Update weapon cooldowns
        if (this.primaryWeaponCooldown > 0) {
            this.primaryWeaponCooldown -= deltaTime;
        }
        if (this.secondaryWeaponCooldown > 0) {
            this.secondaryWeaponCooldown -= deltaTime;
        }
        
        // Regenerate shields and energy slowly
        if (this.shield < this.maxShield) {
            this.shield = Math.min(this.maxShield, this.shield + 5 * deltaTime);
        }
        if (this.energy < this.maxEnergy) {
            this.energy = Math.min(this.maxEnergy, this.energy + 10 * deltaTime);
        }
        
        // Update cargo mass
        this.cargoMass = this.cargo.reduce((sum, item) => sum + (item.weight || 1), 0);
    }
    
    firePrimary() {
        if (this.primaryWeaponCooldown <= 0 && this.energy >= 5) {
            this.primaryWeaponCooldown = this.primaryWeaponDelay;
            this.energy -= 5;
            return true;
        }
        return false;
    }
    
    fireSecondary() {
        if (this.secondaryWeaponCooldown <= 0 && this.energy >= 15) {
            this.secondaryWeaponCooldown = this.secondaryWeaponDelay;
            this.energy -= 15;
            return true;
        }
        return false;
    }
    
    takeDamage(amount) {
        // Shields absorb damage first
        if (this.shield > 0) {
            const shieldDamage = Math.min(this.shield, amount);
            this.shield -= shieldDamage;
            amount -= shieldDamage;
        }
        
        // Hull takes remaining damage
        this.hull -= amount;
        
        if (this.hull <= 0) {
            this.hull = 0;
            this.destroy();
        }
    }
    
    destroy() {
        this.isDestroyed = true;
        this.visible = false;
    }
    
    repair() {
        this.hull = this.maxHull;
        this.shield = this.maxShield;
        this.energy = this.maxEnergy;
    }
    
    increaseThrottle(amount) {
        this.throttle = Math.min(1, this.throttle + amount);
    }
    
    decreaseThrottle(amount) {
        this.throttle = Math.max(0, this.throttle - amount);
    }
    
    setCruise(cruise) {
        this.isCruising = cruise;
    }
    
    brake() {
        this.throttle = 0;
        this.vx *= 0.5;
        this.vy *= 0.5;
    }
    
    setTargetAngle(angle) {
        this.targetAngle = angle;
    }
    
    draw(ctx) {
        // Draw ship body (triangle shape)
        ctx.save();
        ctx.rotate(this.rotation);
        
        // Main hull
        ctx.fillStyle = '#cccccc';
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(25, 0);      // Nose
        ctx.lineTo(-15, -15);   // Left wing
        ctx.lineTo(-10, 0);    // Back center
        ctx.lineTo(-15, 15);   // Right wing
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Engine glow
        if (this.speed > 10) {
            const glowIntensity = this.speed / this.maxSpeed;
            ctx.fillStyle = `rgba(255, ${100 + Math.random() * 50}, 0, ${glowIntensity})`;
            ctx.beginPath();
            ctx.arc(-15, 0, 5 + glowIntensity * 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    getSaveData() {
        return {
            x: this.x,
            y: this.y,
            hull: this.hull,
            shield: this.shield,
            energy: this.energy,
            throttle: this.throttle,
            cargo: this.cargo
        };
    }
}
