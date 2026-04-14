/**
 * StateManager - Reactive state management using Proxy
 * Handles all app state with localStorage persistence
 */
export class StateManager {
    constructor() {
        this._state = {};
        this._listeners = new Map();
        this._storageKey = 'kidsmaths_state';
        this._load();
    }

    /**
     * Load state from localStorage
     */
    _load() {
        try {
            const stored = localStorage.getItem(this._storageKey);
            if (stored) {
                this._state = JSON.parse(stored);
            } else {
                this._initDefaults();
            }
        } catch (e) {
            console.warn('Failed to load state, using defaults:', e);
            this._initDefaults();
        }
    }

    /**
     * Initialize default state for new users
     */
    _initDefaults() {
        this._state = {
            // Coins
            coins: {
                balance: 0,
                history: []
            },
            // Sessions
            sessions: [],
            currentSession: null,
            // Module progress
            moduleProgress: {
                addition: {},
                subtraction: {},
                'times-tables': {},
                multiplication: {},
                division: {},
                percentages: {},
                reading: {}
            },
            // Redeemed rewards
            redeemedRewards: [],
            // Addition mastery tracking: { "3+5": { correct: 2, attempts: 4 }, ... }
            additionMastery: {},
            // Reading
            readStories: [],
            bookmarks: {},
            urduSavedWords: [],
            archivedUrduStoryIds: [],
            showArchivedUrdu: false,
            currentUrduStoryId: null,
            readingLevel: 'R1',
            libraryLevel: 'L1',
            urduLevel: 'U1',
            readingTab: 'library',
            readingSearchOpen: false,
            currentMathWorld: 'number-adventure',
            currentMathMissionId: null,
            currentMathMissionSession: null,
            lastMathMissionId: null,
            mathMissionProgress: { completed: [], sessions: {} },
            mathGardenCount: 0,
            // Home shortcuts / recent activity
            recentItems: [],
            // Parent PIN (default: 1234)
            parentPin: '1234',
            // Current screen state
            currentScreen: 'home',
            currentModule: null,
            currentLevel: null,
            currentMode: null
        };
        this._save();
    }

    /**
     * Save state to localStorage
     */
    _save() {
        try {
            localStorage.setItem(this._storageKey, JSON.stringify(this._state));
        } catch (e) {
            console.warn('Failed to save state:', e);
        }
    }

    /**
     * Get a value from state (supports dot notation: 'coins.balance')
     */
    get(path) {
        const keys = path.split('.');
        let value = this._state;
        for (const key of keys) {
            if (value === undefined || value === null) return undefined;
            value = value[key];
        }
        return value;
    }

    /**
     * Set a value in state (supports dot notation)
     */
    set(path, value) {
        const keys = path.split('.');
        let obj = this._state;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in obj) || typeof obj[key] !== 'object') {
                obj[key] = {};
            }
            obj = obj[key];
        }

        const finalKey = keys[keys.length - 1];
        obj[finalKey] = value;

        this._save();
        this._notify(path, value);
    }

    /**
     * Subscribe to changes on a path
     */
    subscribe(path, callback) {
        if (!this._listeners.has(path)) {
            this._listeners.set(path, []);
        }
        this._listeners.get(path).push(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this._listeners.get(path);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Notify listeners of a change
     */
    _notify(path, value) {
        // Notify exact path listeners
        if (this._listeners.has(path)) {
            this._listeners.get(path).forEach(cb => cb(value));
        }

        // Notify parent path listeners (e.g., 'coins' when 'coins.balance' changes)
        const parts = path.split('.');
        for (let i = parts.length - 1; i > 0; i--) {
            const parentPath = parts.slice(0, i).join('.');
            if (this._listeners.has(parentPath)) {
                this._listeners.get(parentPath).forEach(cb => cb(this.get(parentPath)));
            }
        }
    }

    /**
     * Get entire state (for debugging)
     */
    getAll() {
        return { ...this._state };
    }

    /**
     * Reset all state to defaults
     */
    reset() {
        this._initDefaults();
        this._notify('*', this._state);
    }
}

// Singleton instance
export const state = new StateManager();
