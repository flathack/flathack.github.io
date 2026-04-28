/**
 * Input - Mouse and keyboard input handling
 */
export class Input {
    constructor(game) {
        this.game = game;
        
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
        this.rightMouseDown = false;
        
        this.keys = {};
        this.keysJustPressed = {};
        this.keysJustReleased = {};
        
        this.setupListeners();
    }
    
    setupListeners() {
        // Mouse events
        this.game.canvas.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
        
        this.game.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouseDown = true;
            if (e.button === 2) this.rightMouseDown = true;
        });
        
        this.game.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseDown = false;
            if (e.button === 2) this.rightMouseDown = false;
        });
        
        this.game.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Mouse wheel for throttle
        this.game.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (this.game.isDocked) return;
            
            if (e.deltaY < 0) {
                this.game.player.increaseThrottle(0.1);
            } else {
                this.game.player.decreaseThrottle(0.1);
            }
        });
        
        // Keyboard events
        window.addEventListener('keydown', (e) => {
            if (this.keys[e.code]) return; // Ignore repeat
            
            this.keys[e.code] = true;
            this.keysJustPressed[e.code] = true;
            
            this.handleKeyDown(e.code);
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.keysJustReleased[e.code] = true;
        });
    }
    
    handleKeyDown(code) {
        if (this.game.isDocked) {
            if (code === 'Escape') {
                this.game.closeStationMenu();
            }
            return;
        }
        
        switch (code) {
            case 'KeyW':
            case 'ArrowUp':
                this.game.player.increaseThrottle(0.1);
                break;
                
            case 'KeyS':
            case 'ArrowDown':
                this.game.player.decreaseThrottle(0.1);
                break;
                
            case 'ShiftLeft':
            case 'ShiftRight':
                this.game.player.setCruise(true);
                break;
                
            case 'Space':
                this.game.player.brake();
                break;
                
            case 'KeyD':
                this.tryDock();
                break;
                
            case 'KeyG':
                this.tryGateTravel();
                break;
                
            case 'KeyM':
                if (document.getElementById('galaxy-map').classList.contains('hidden')) {
                    this.game.openGalaxyMap();
                } else {
                    this.game.closeGalaxyMap();
                }
                break;
                
            case 'Tab':
                e.preventDefault();
                this.game.player.nextTarget();
                break;
                
            case 'KeyT':
                this.game.player.toggleTargetMode();
                break;
                
            case 'Escape':
                // Open menu or undock
                break;
        }
    }
    
    tryDock() {
        const player = this.game.player;
        const nearby = this.game.getNearbyEntities(player, 500);
        
        for (const item of nearby) {
            const entity = item.entity;
            if (entity instanceof Station && item.distance <= entity.dockRadius) {
                this.game.openStationMenu(entity);
                return;
            }
        }
        
        this.game.hud.addLog('No station in range to dock', 'alert');
    }
    
    tryGateTravel() {
        const player = this.game.player;
        const nearby = this.game.getNearbyEntities(player, 300);
        
        for (const item of nearby) {
            const entity = item.entity;
            if (entity instanceof Gate && item.distance <= entity.travelRadius) {
                this.game.travelToSystem(entity.targetSystem);
                return;
            }
        }
        
        this.game.hud.addLog('No gate in range', 'alert');
    }
    
    isKeyDown(code) {
        return !!this.keys[code];
    }
    
    isKeyJustPressed(code) {
        const pressed = !!this.keysJustPressed[code];
        this.keysJustPressed[code] = false;
        return pressed;
    }
    
    isKeyJustReleased(code) {
        const released = !!this.keysJustReleased[code];
        this.keysJustReleased[code] = false;
        return released;
    }
    
    getWorldMousePosition() {
        return this.game.renderer.screenToWorld(this.mouseX, this.mouseY);
    }
    
    clearFrameInputs() {
        this.keysJustPressed = {};
        this.keysJustReleased = {};
    }
}

// Need to import Station and Gate for type checking
import { Station } from '../entities/Station.js';
import { Gate } from '../entities/Gate.js';
