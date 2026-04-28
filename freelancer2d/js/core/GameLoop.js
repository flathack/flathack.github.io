/**
 * GameLoop - Main game loop with fixed timestep
 */
export class GameLoop {
    constructor(game) {
        this.game = game;
        this.running = false;
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedDeltaTime = 1000 / 60; // 60 FPS fixed timestep
        this.maxFrameTime = 250; // Cap frame time to prevent spiral of death
        this.frameCount = 0;
        this.fps = 0;
        this.fpsTime = 0;
    }
    
    start() {
        this.running = true;
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }
    
    stop() {
        this.running = false;
    }
    
    loop(currentTime) {
        if (!this.running) return;
        
        requestAnimationFrame((t) => this.loop(t));
        
        let deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Cap delta time to prevent huge jumps
        if (deltaTime > this.maxFrameTime) {
            deltaTime = this.maxFrameTime;
        }
        
        // Convert to seconds for game logic
        const dt = deltaTime / 1000;
        
        // Update FPS counter
        this.frameCount++;
        this.fpsTime += deltaTime;
        if (this.fpsTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsTime = 0;
        }
        
        // Fixed timestep update
        this.accumulator += deltaTime;
        
        while (this.accumulator >= this.fixedDeltaTime) {
            this.fixedUpdate(this.fixedDeltaTime / 1000);
            this.accumulator -= this.fixedDeltaTime;
        }
        
        // Variable timestep render
        this.game.update(dt);
        this.game.render();
    }
    
    fixedUpdate(dt) {
        // Physics and simulation at fixed rate
    }
}
