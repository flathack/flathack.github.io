/**
 * Scheduler - Daily rhythm and NPC schedules
 */
export class Scheduler {
    constructor(game) {
        this.game = game;
        this.currentTime = 0;
        this.secondsPerDay = 1800;
        
        this.scheduleTypes = {
            trader: {
                peakHours: [[6, 9], [18, 21]],
                restHours: [[2, 5]],
                activityMultiplier: 1.5
            },
            pirate: {
                peakHours: [[0, 4], [21, 24]],
                restHours: [[10, 15]],
                activityMultiplier: 0.8
            },
            police: {
                peakHours: [[8, 22]],
                restHours: [[23, 7]],
                activityMultiplier: 1.2
            },
            miner: {
                peakHours: [[4, 20]],
                restHours: [[21, 3]],
                activityMultiplier: 1.0
            },
            civilian: {
                peakHours: [[7, 19]],
                restHours: [[0, 6]],
                activityMultiplier: 1.0
            }
        };
        
        this.eventCallbacks = [];
    }
    
    update(gameTime) {
        const oldTime = this.currentTime;
        this.currentTime = gameTime;
        
        // Check for time-based events
        this.checkTimeEvents(oldTime, gameTime);
    }
    
    getHour(gameTime = this.currentTime) {
        return Math.floor((gameTime / this.secondsPerDay) * 24);
    }
    
    getMinute(gameTime = this.currentTime) {
        return Math.floor(((gameTime / this.secondsPerDay) * 24 * 60) % 60);
    }
    
    isInPeakHours(role, hour = this.getHour()) {
        const schedule = this.scheduleTypes[role];
        if (!schedule) return true;
        
        for (const [start, end] of schedule.peakHours) {
            if (hour >= start && hour < end) return true;
        }
        return false;
    }
    
    isInRestHours(role, hour = this.getHour()) {
        const schedule = this.scheduleTypes[role];
        if (!schedule) return false;
        
        for (const [start, end] of schedule.restHours) {
            if (hour >= start && hour < end) return true;
        }
        return false;
    }
    
    getActivityLevel(role) {
        const schedule = this.scheduleTypes[role];
        if (!schedule) return 1.0;
        
        const hour = this.getHour();
        
        if (this.isInPeakHours(role, hour)) {
            return schedule.activityMultiplier;
        }
        
        if (this.isInRestHours(role, hour)) {
            return 0.2;
        }
        
        return 0.5;
    }
    
    shouldSpawn(role) {
        const level = this.getActivityLevel(role);
        return Math.random() < level;
    }
    
    checkTimeEvents(oldTime, newTime) {
        const oldHour = Math.floor((oldTime / this.secondsPerDay) * 24);
        const newHour = Math.floor((newTime / this.secondsPerDay) * 24);
        
        if (oldHour !== newHour) {
            // Hour changed - trigger events
            this.triggerHourEvents(newHour);
        }
    }
    
    triggerHourEvents(hour) {
        // Morning rush
        if (hour === 6) {
            this.emitEvent('morning_rush');
        }
        
        // Evening calm
        if (hour === 21) {
            this.emitEvent('evening_calm');
        }
        
        // Night patrol increase
        if (hour === 0) {
            this.emitEvent('night_fall');
        }
        
        // Dawn
        if (hour === 5) {
            this.emitEvent('dawn');
        }
    }
    
    onEvent(callback) {
        this.eventCallbacks.push(callback);
    }
    
    emitEvent(eventType) {
        for (const callback of this.eventCallbacks) {
            callback(eventType, this.currentTime);
        }
    }
    
    formatTime(gameTime = this.currentTime) {
        const hour = this.getHour(gameTime);
        const minute = this.getMinute(gameTime);
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
}
