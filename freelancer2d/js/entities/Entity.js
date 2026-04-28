/**
 * Entity - Base class for all game objects
 */
export class Entity {
    constructor(game, data) {
        this.game = game;
        
        this.id = data.id || 'entity-' + Math.random().toString(36).substr(2, 9);
        this.name = data.name || 'Unknown';
        
        this.x = data.position?.x || 0;
        this.y = data.position?.y || 0;
        
        this.rotation = 0;
        this.visible = true;
        
        this.radius = data.radius || 50;
        this.minimapColor = '#00ff00';
        this.minimapSize = 3;
        
        this.faction = data.faction || 'neutral';
    }
    
    update(deltaTime) {
        // Base update - override in subclasses
    }
    
    render(renderer) {
        renderer.drawEntity(this);
    }
    
    containsPoint(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }
    
    getDistanceTo(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getAngleTo(other) {
        return Math.atan2(other.y - this.y, other.x - this.x);
    }
    
    draw(ctx) {
        // Default circle draw - override for specific shapes
        ctx.fillStyle = this.minimapColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}
