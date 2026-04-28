/**
 * Renderer - Canvas 2D rendering system
 */
export class Renderer {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        this.ctx = game.ctx;
        
        this.cameraX = 0;
        this.cameraY = 0;
        this.cameraScale = 1;
        
        this.minimapCanvas = null;
        this.minimapCtx = null;
        
        this.initMinimap();
    }
    
    initMinimap() {
        this.minimapCanvas = document.getElementById('minimap');
        if (this.minimapCanvas) {
            this.minimapCtx = this.minimapCanvas.getContext('2d');
        }
    }
    
    clear() {
        this.ctx.fillStyle = '#0a0a15';
        this.ctx.fillRect(0, 0, this.game.width, this.game.height);
    }
    
    drawBackground() {
        const system = this.game.currentSystem;
        const color = system?.ambientColor || [30, 50, 80];
        
        // Create gradient for space feel
        const gradient = this.ctx.createRadialGradient(
            this.game.width / 2, this.game.height / 2, 0,
            this.game.width / 2, this.game.height / 2, this.game.width
        );
        
        gradient.addColorStop(0, `rgb(${color[0] + 20}, ${color[1] + 30}, ${color[2] + 50})`);
        gradient.addColorStop(1, '#0a0a15');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.game.width, this.game.height);
        
        // Draw stars
        this.drawStars();
        
        // Draw nebula effect if any
        this.drawNebula();
    }
    
    drawStars() {
        const starSeed = 12345;
        const starCount = 200;
        
        this.ctx.fillStyle = '#ffffff';
        
        for (let i = 0; i < starCount; i++) {
            const x = ((starSeed * (i + 1) * 9301 + 49297) % 233280) / 233280 * this.game.width;
            const y = ((starSeed * (i + 1) * 7919 + 13257) % 259459) / 259459 * this.game.height;
            const size = ((i * 17) % 3) + 0.5;
            const alpha = 0.3 + (((i * 13) % 70) / 100);
            
            this.ctx.globalAlpha = alpha;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.globalAlpha = 1;
    }
    
    drawNebula() {
        // Draw nebula clouds based on system
        const system = this.game.currentSystem;
        if (!system?.background) return;
        
        this.ctx.globalAlpha = 0.1;
        
        // Draw colored patches
        const patches = [
            { x: 0.3, y: 0.4, r: 200, color: '#440044' },
            { x: 0.7, y: 0.6, r: 150, color: '#004444' },
            { x: 0.5, y: 0.3, r: 180, color: '#220044' }
        ];
        
        for (const patch of patches) {
            const gradient = this.ctx.createRadialGradient(
                patch.x * this.game.width, patch.y * this.game.height, 0,
                patch.x * this.game.width, patch.y * this.game.height, patch.r
            );
            gradient.addColorStop(0, patch.color);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(
                patch.x * this.game.width - patch.r,
                patch.y * this.game.height - patch.r,
                patch.r * 2, patch.r * 2
            );
        }
        
        this.ctx.globalAlpha = 1;
    }
    
    worldToScreen(x, y) {
        return {
            x: (x - this.cameraX) * this.cameraScale + this.game.width / 2,
            y: (y - this.cameraY) * this.cameraScale + this.game.height / 2
        };
    }
    
    screenToWorld(x, y) {
        return {
            x: (x - this.game.width / 2) / this.cameraScale + this.cameraX,
            y: (y - this.game.height / 2) / this.cameraScale + this.cameraY
        };
    }
    
    centerOn(x, y) {
        this.cameraX = x;
        this.cameraY = y;
    }
    
    setCameraPosition(x, y) {
        this.cameraX = x;
        this.cameraY = y;
    }
    
    drawEntity(entity) {
        if (!entity.visible) return;
        
        const pos = this.worldToScreen(entity.x, entity.y);
        
        this.ctx.save();
        this.ctx.translate(pos.x, pos.y);
        this.ctx.rotate(entity.rotation || 0);
        
        if (entity.draw) {
            entity.draw(this.ctx);
        }
        
        this.ctx.restore();
        
        // Draw name label if entity has one and is in view
        if (entity.name && this.isInView(entity.x, entity.y, 100)) {
            this.drawEntityLabel(entity, pos);
        }
    }
    
    drawEntityLabel(entity, screenPos) {
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '10px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(entity.name, screenPos.x, screenPos.y + entity.radius + 15);
    }
    
    isInView(x, y, margin = 0) {
        const pos = this.worldToScreen(x, y);
        return (
            pos.x >= -margin &&
            pos.x <= this.game.width + margin &&
            pos.y >= -margin &&
            pos.y <= this.game.height + margin
        );
    }
    
    drawMinimap() {
        if (!this.minimapCtx) return;
        
        const ctx = this.minimapCtx;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;
        const scale = 0.015; // Map scale
        const centerX = w / 2;
        const centerY = h / 2;
        
        // Clear
        ctx.fillStyle = 'rgba(0, 0, 20, 0.8)';
        ctx.fillRect(0, 0, w, h);
        
        // Draw border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, w, h);
        
        // Draw entities
        for (const entity of this.game.entities) {
            if (!entity.visible) continue;
            
            const mapX = centerX + entity.x * scale;
            const mapY = centerY + entity.y * scale;
            
            if (mapX < 0 || mapX > w || mapY < 0 || mapY > h) continue;
            
            ctx.fillStyle = entity.minimapColor || '#00ff00';
            ctx.beginPath();
            ctx.arc(mapX, mapY, entity.minimapSize || 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw NPCs
        for (const npc of this.game.npcs) {
            const mapX = centerX + npc.x * scale;
            const mapY = centerY + npc.y * scale;
            
            if (mapX < 0 || mapX > w || mapY < 0 || mapY > h) continue;
            
            ctx.fillStyle = npc.minimapColor || '#888888';
            ctx.beginPath();
            ctx.arc(mapX, mapY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw player
        const playerMapX = centerX + this.game.player.x * scale;
        const playerMapY = centerY + this.game.player.y * scale;
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(playerMapX, playerMapY, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Player direction indicator
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playerMapX, playerMapY);
        ctx.lineTo(
            playerMapX + Math.cos(this.game.player.targetAngle) * 10,
            playerMapY + Math.sin(this.game.player.targetAngle) * 10
        );
        ctx.stroke();
    }
    
    drawGalaxyMap() {
        const mapCanvas = document.getElementById('map-canvas');
        if (!mapCanvas) return;
        
        const ctx = mapCanvas.getContext('2d');
        const w = mapCanvas.width;
        const h = mapCanvas.height;
        const padding = 50;
        
        // Clear
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, w, h);
        
        // Draw grid
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1;
        for (let x = padding; x < w - padding; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, h - padding);
            ctx.stroke();
        }
        for (let y = padding; y < h - padding; y += 50) {
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(w - padding, y);
            ctx.stroke();
        }
        
        // Draw systems as nodes
        const systems = this.game.data?.systems || [];
        const nodePositions = {};
        
        // Simple grid layout
        const cols = Math.ceil(Math.sqrt(systems.length));
        
        for (let i = 0; i < systems.length; i++) {
            const system = systems[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = padding + (col + 0.5) * (w - padding * 2) / cols;
            const y = padding + (row + 0.5) * (h - padding * 2) / Math.ceil(systems.length / cols);
            
            nodePositions[system.id] = { x, y };
            
            // Draw node
            ctx.fillStyle = system.id === this.game.currentSystem?.id ? '#ffffff' : '#00aa00';
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw name
            ctx.fillStyle = '#00ff00';
            ctx.font = '10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(system.name, x, y + 20);
        }
        
        // Draw connections
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        for (const system of systems) {
            const from = nodePositions[system.id];
            if (!from) continue;
            
            for (const conn of system.connectedSystems || []) {
                const to = nodePositions[conn.system];
                if (!to) continue;
                
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }
        }
        
        // Click to travel
        mapCanvas.onclick = (e) => {
            const rect = mapCanvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            for (const system of systems) {
                const pos = nodePositions[system.id];
                const dx = clickX - pos.x;
                const dy = clickY - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 15) {
                    // Check if connected to current system
                    const current = this.game.currentSystem;
                    const connected = current?.connectedSystems?.some(c => c.system === system.id);
                    
                    if (connected || system.id === current?.id) {
                        if (system.id !== current?.id) {
                            this.game.travelToSystem(system.id);
                        }
                        this.game.closeGalaxyMap();
                    } else {
                        this.game.hud.addLog('Not connected to current system', 'alert');
                    }
                    break;
                }
            }
        };
    }
    
    drawLine(x1, y1, x2, y2, color = '#00ff00', width = 1) {
        const p1 = this.worldToScreen(x1, y1);
        const p2 = this.worldToScreen(x2, y2);
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
    }
    
    drawCircle(x, y, radius, color, fill = false, alpha = 1) {
        const pos = this.worldToScreen(x, y);
        const scaledRadius = radius * this.cameraScale;
        
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = color;
        
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, scaledRadius, 0, Math.PI * 2);
        
        if (fill) {
            this.ctx.fill();
        } else {
            this.ctx.stroke();
        }
        
        this.ctx.globalAlpha = 1;
    }
}
