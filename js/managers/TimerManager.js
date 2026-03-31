/**
 * TimerManager - Handles 15-minute session timing
 * Awards coins on session completion
 */
import { state } from './StateManager.js';

export class TimerManager {
    constructor(options = {}) {
        this.sessionDuration = options.duration || 15 * 60; // 15 minutes in seconds
        this.remaining = 0;
        this.isRunning = false;
        this.interval = null;

        // Callbacks
        this.onTick = options.onTick || (() => {});
        this.onComplete = options.onComplete || (() => {});
        this.onWarning = options.onWarning || (() => {});

        // Warning at 2 minutes remaining
        this.warningThreshold = 2 * 60;
        this.warningTriggered = false;
    }

    /**
     * Start a new session timer
     */
    start() {
        if (this.isRunning) return;

        this.remaining = this.sessionDuration;
        this.isRunning = true;
        this.warningTriggered = false;

        // Record session start
        const sessionStart = new Date().toISOString();
        state.set('currentSession', {
            startTime: sessionStart,
            module: state.get('currentModule'),
            mode: state.get('currentMode'),
            problemsAttempted: 0
        });

        this.interval = setInterval(() => this._tick(), 1000);
        this.onTick(this.remaining);
    }

    /**
     * Stop the timer (without completing session)
     */
    stop() {
        if (!this.isRunning) return;

        clearInterval(this.interval);
        this.interval = null;
        this.isRunning = false;
        this.remaining = 0;

        // Clear current session without awarding coin
        state.set('currentSession', null);
    }

    /**
     * Pause the timer
     */
    pause() {
        if (!this.isRunning) return;
        clearInterval(this.interval);
        this.interval = null;
    }

    /**
     * Resume a paused timer
     */
    resume() {
        if (!this.isRunning || this.interval) return;
        this.interval = setInterval(() => this._tick(), 1000);
    }

    /**
     * Handle each second tick
     */
    _tick() {
        this.remaining--;
        this.onTick(this.remaining);

        // Warning at 2 minutes
        if (!this.warningTriggered && this.remaining <= this.warningThreshold) {
            this.warningTriggered = true;
            this.onWarning();
        }

        // Session complete
        if (this.remaining <= 0) {
            this._complete();
        }
    }

    /**
     * Complete the session and award coin
     */
    _complete() {
        clearInterval(this.interval);
        this.interval = null;
        this.isRunning = false;

        // Get current session data
        const currentSession = state.get('currentSession');
        if (currentSession) {
            // Record completed session
            const sessions = state.get('sessions') || [];
            sessions.push({
                ...currentSession,
                endTime: new Date().toISOString(),
                duration: 15,
                coinsEarned: 1
            });
            state.set('sessions', sessions);

            // Award coin
            const coins = state.get('coins') || { balance: 0, history: [] };
            coins.balance += 1;
            coins.history.push({
                date: new Date().toISOString(),
                type: 'earned',
                amount: 1,
                reason: '15-minute session completed'
            });
            state.set('coins', coins);

            // Clear current session
            state.set('currentSession', null);
        }

        this.onComplete();
    }

    /**
     * Get formatted time string (mm:ss)
     */
    getDisplay() {
        const minutes = Math.floor(this.remaining / 60);
        const seconds = this.remaining % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Check if timer is in warning zone
     */
    isWarning() {
        return this.remaining > 0 && this.remaining <= this.warningThreshold;
    }

    /**
     * Increment problems attempted for current session
     */
    incrementProblems() {
        const currentSession = state.get('currentSession');
        if (currentSession) {
            currentSession.problemsAttempted = (currentSession.problemsAttempted || 0) + 1;
            state.set('currentSession', currentSession);
        }
    }

    /**
     * Continue for another session (user clicked "Keep Going")
     */
    continueSession() {
        this.remaining = this.sessionDuration;
        this.isRunning = true;
        this.warningTriggered = false;

        // Start new session tracking
        const sessionStart = new Date().toISOString();
        state.set('currentSession', {
            startTime: sessionStart,
            module: state.get('currentModule'),
            mode: state.get('currentMode'),
            problemsAttempted: 0
        });

        this.interval = setInterval(() => this._tick(), 1000);
        this.onTick(this.remaining);
    }
}
