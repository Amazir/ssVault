const { run, get } = require('./db');

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

class LoginAttemptsManager {
    constructor(db) {
        this.db = db;
    }
    
    async checkLockout() {
        try {
            const row = await get(this.db, 
                'SELECT * FROM login_attempts WHERE id = 1'
            );
            
            if (!row) {
                await this.initializeRecord();
                return { locked: false, attemptsRemaining: MAX_ATTEMPTS };
            }
            
            const now = Date.now();
            
            if (row.locked_until && row.locked_until > now) {
                const remainingMs = row.locked_until - now;
                return { 
                    locked: true, 
                    remainingSeconds: Math.ceil(remainingMs / 1000)
                };
            }
            
            if (row.last_attempt_time && 
                (now - row.last_attempt_time) > ATTEMPT_WINDOW_MS) {
                await run(this.db, 
                    'UPDATE login_attempts SET failed_count = 0, locked_until = 0 WHERE id = 1'
                );
                return { locked: false, attemptsRemaining: MAX_ATTEMPTS };
            }
            
            return { 
                locked: false, 
                attemptsRemaining: Math.max(0, MAX_ATTEMPTS - row.failed_count)
            };
        } catch (err) {
            console.error('Error checking lockout:', err);
            return { locked: false, attemptsRemaining: MAX_ATTEMPTS };
        }
    }
    
    async recordFailedAttempt() {
        try {
            const now = Date.now();
            
            await run(this.db, `
                UPDATE login_attempts 
                SET failed_count = failed_count + 1,
                    last_attempt_time = ?
                WHERE id = 1
            `, [now]);
            
            const row = await get(this.db, 
                'SELECT failed_count FROM login_attempts WHERE id = 1'
            );
            
            if (row && row.failed_count >= MAX_ATTEMPTS) {
                const lockUntil = now + LOCKOUT_DURATION_MS;
                await run(this.db, 
                    'UPDATE login_attempts SET locked_until = ? WHERE id = 1',
                    [lockUntil]
                );
                return { 
                    locked: true, 
                    remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000)
                };
            }
            
            return { 
                locked: false, 
                attemptsRemaining: Math.max(0, MAX_ATTEMPTS - (row ? row.failed_count : 0))
            };
        } catch (err) {
            console.error('Error recording failed attempt:', err);
            return { locked: false, attemptsRemaining: 0 };
        }
    }
    
    async resetAttempts() {
        try {
            await run(this.db, 
                'UPDATE login_attempts SET failed_count = 0, locked_until = 0, last_attempt_time = ? WHERE id = 1',
                [Date.now()]
            );
        } catch (err) {
            console.error('Error resetting attempts:', err);
        }
    }
    
    async initializeRecord() {
        try {
            await run(this.db, 
                'INSERT OR IGNORE INTO login_attempts (id, failed_count, last_attempt_time, locked_until) VALUES (1, 0, 0, 0)'
            );
        } catch (err) {
            console.error('Error initializing login attempts record:', err);
        }
    }
    
    async getStats() {
        try {
            const row = await get(this.db, 
                'SELECT * FROM login_attempts WHERE id = 1'
            );
            if (!row) return null;
            
            const now = Date.now();
            const locked = row.locked_until && row.locked_until > now;
            
            return {
                failedCount: row.failed_count,
                attemptsRemaining: Math.max(0, MAX_ATTEMPTS - row.failed_count),
                locked,
                lockedUntil: locked ? new Date(row.locked_until).toISOString() : null,
                lastAttempt: row.last_attempt_time ? new Date(row.last_attempt_time).toISOString() : null
            };
        } catch (err) {
            console.error('Error getting stats:', err);
            return null;
        }
    }
}

module.exports = LoginAttemptsManager;