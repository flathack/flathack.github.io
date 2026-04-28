/**
 * HUD - Heads-Up Display for player information
 */
export class HUD {
    constructor(game) {
        this.game = game;
        this.logs = [];
        this.maxLogs = 20;
        this.alertFlash = 0;
    }
    
    update() {
        this.updateBars();
        this.updateInfo();
        this.updateTargetPanel();
        this.updateCommsLog();
    }
    
    updateBars() {
        const player = this.game.player;
        if (!player) return;
        
        const hullPercent = (player.hull / player.maxHull) * 100;
        const shieldPercent = (player.shield / player.maxShield) * 100;
        const energyPercent = (player.energy / player.maxEnergy) * 100;
        
        document.getElementById('hull-bar').style.width = hullPercent + '%';
        document.getElementById('shield-bar').style.width = shieldPercent + '%';
        document.getElementById('energy-bar').style.width = energyPercent + '%';
    }
    
    updateInfo() {
        const player = this.game.player;
        if (!player) return;
        
        // Credits
        const creditsEl = document.getElementById('credits');
        if (creditsEl) {
            creditsEl.textContent = `CREDITS: ${this.formatNumber(player.credits)}`;
        }
        
        // Cargo
        const cargoEl = document.getElementById('cargo');
        if (cargoEl) {
            const used = player.cargo.length;
            const total = player.maxCargo;
            cargoEl.textContent = `CARGO: ${used}/${total}`;
        }
        
        // System name
        const systemEl = document.getElementById('system-name');
        if (systemEl) {
            const system = this.game.currentSystem;
            systemEl.textContent = `SYSTEM: ${system?.name || 'Unknown'}`;
        }
        
        // Game time
        const timeEl = document.getElementById('game-time');
        if (timeEl) {
            const time = this.formatGameTime(this.game.gameTime);
            timeEl.textContent = time;
        }
    }
    
    updateTargetPanel() {
        const player = this.game.player;
        const target = player?.target;
        const panel = document.getElementById('target-panel');
        
        if (!target || target.isDestroyed) {
            if (panel) panel.classList.add('hidden');
            return;
        }
        
        panel.classList.remove('hidden');
        
        document.getElementById('target-name').textContent = target.name || 'Unknown';
        document.getElementById('target-type').textContent = target.role || 'Ship';
        document.getElementById('target-faction').textContent = target.faction || 'Unknown';
        
        const distance = Math.sqrt(
            Math.pow(target.x - player.x, 2) + 
            Math.pow(target.y - player.y, 2)
        );
        document.getElementById('target-distance').textContent = Math.round(distance) + 'm';
    }
    
    updateCommsLog() {
        const container = document.getElementById('log-entries');
        if (!container) return;
        
        // Remove old entries beyond max
        while (container.children.length > this.maxLogs) {
            container.removeChild(container.firstChild);
        }
    }
    
    addLog(message, type = 'system') {
        const container = document.getElementById('log-entries');
        if (!container) return;
        
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        
        if (type === 'alert') {
            entry.classList.add('alert');
        }
        
        const time = this.formatGameTime(this.game.gameTime);
        
        entry.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-message ${type}">${message}</span>
        `;
        
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
        
        this.logs.push({ message, type, time: this.game.gameTime });
    }
    
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
    
    formatGameTime(seconds) {
        const hours = Math.floor(seconds / 75); // 75 seconds = 1 hour (1800/24)
        const minutes = Math.floor((seconds % 75) / 1.25);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    showAlert(message) {
        this.alertFlash = 0.5;
        this.addLog(message, 'alert');
    }
}
