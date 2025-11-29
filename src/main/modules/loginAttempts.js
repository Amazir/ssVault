const fs = require('fs');
const path = require('path');

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

class LoginAttemptsManager {
    constructor(vaultPath) {
        // Store attempts data next to the vault file with .attempts extension
        this.attemptsFilePath = `${vaultPath}.attempts`;
        this.ensureAttemptsFile();
    }
    
    ensureAttemptsFile() {
        if (!fs.existsSync(this.attemptsFilePath)) {
            this.saveAttempts({
                failedCount: 0,
                lastAttemptTime: 0,
                lockedUntil: 0
            });
        }
    }
    
    loadAttempts() {
        try {
            if (!fs.existsSync(this.attemptsFilePath)) {
                return {
                    failedCount: 0,
                    lastAttemptTime: 0,
                    lockedUntil: 0
                };
            }
            
            const data = fs.readFileSync(this.attemptsFilePath, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            console.error('Error loading attempts file:', err);
            return {
                failedCount: 0,
                lastAttemptTime: 0,
                lockedUntil: 0
            };
        }
    }
    
    saveAttempts(data) {
        try {
            fs.writeFileSync(this.attemptsFilePath, JSON.stringify(data, null, 2), 'utf8');
        } catch (err) {
            console.error('Error saving attempts file:', err);
        }
    }
    
    checkLockout() {
        const data = this.loadAttempts();
        const now = Date.now();
        
        // Check if currently locked
        if (data.lockedUntil && data.lockedUntil > now) {
            const remainingMs = data.lockedUntil - now;
            return {
                locked: true,
                remainingSeconds: Math.ceil(remainingMs / 1000)
            };
        }
        
        // Check if attempt window expired - reset counter
        if (data.lastAttemptTime && (now - data.lastAttemptTime) > ATTEMPT_WINDOW_MS) {
            this.saveAttempts({
                failedCount: 0,
                lastAttemptTime: 0,
                lockedUntil: 0
            });
            return {
                locked: false,
                attemptsRemaining: MAX_ATTEMPTS
            };
        }
        
        return {
            locked: false,
            attemptsRemaining: Math.max(0, MAX_ATTEMPTS - data.failedCount)
        };
    }
    
    recordFailedAttempt() {
        const data = this.loadAttempts();
        const now = Date.now();
        
        data.failedCount += 1;
        data.lastAttemptTime = now;
        
        // Check if we should lock
        if (data.failedCount >= MAX_ATTEMPTS) {
            data.lockedUntil = now + LOCKOUT_DURATION_MS;
            this.saveAttempts(data);
            
            return {
                locked: true,
                remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000)
            };
        }
        
        this.saveAttempts(data);
        
        return {
            locked: false,
            attemptsRemaining: Math.max(0, MAX_ATTEMPTS - data.failedCount)
        };
    }
    
    resetAttempts() {
        this.saveAttempts({
            failedCount: 0,
            lastAttemptTime: Date.now(),
            lockedUntil: 0
        });
    }
    
    getStats() {
        const data = this.loadAttempts();
        const now = Date.now();
        const locked = data.lockedUntil && data.lockedUntil > now;
        
        return {
            failedCount: data.failedCount,
            attemptsRemaining: Math.max(0, MAX_ATTEMPTS - data.failedCount),
            locked,
            lockedUntil: locked ? new Date(data.lockedUntil).toISOString() : null,
            lastAttempt: data.lastAttemptTime ? new Date(data.lastAttemptTime).toISOString() : null
        };
    }
    
    /**
     * Remove attempts file (useful when vault is deleted)
     */
    cleanup() {
        try {
            if (fs.existsSync(this.attemptsFilePath)) {
                fs.unlinkSync(this.attemptsFilePath);
            }
        } catch (err) {
            console.error('Error cleaning up attempts file:', err);
        }
    }
}

module.exports = LoginAttemptsManager;