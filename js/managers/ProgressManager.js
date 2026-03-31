/**
 * ProgressManager - Tracks mastery and progress per module/level
 * This is for PARENT tracking only - child never sees pressure from this
 */
import { state } from './StateManager.js';

export class ProgressManager {
    constructor() {
        // Ensure moduleProgress exists
        if (!state.get('moduleProgress')) {
            state.set('moduleProgress', {
                addition: {},
                subtraction: {},
                'times-tables': {},
                multiplication: {},
                division: {},
                percentages: {}
            });
        }
    }

    /**
     * Record a practice/test attempt
     */
    recordAttempt(module, level, correct, total) {
        const progress = state.get('moduleProgress') || {};

        if (!progress[module]) {
            progress[module] = {};
        }

        if (!progress[module][level]) {
            progress[module][level] = {
                attempts: 0,
                totalCorrect: 0,
                totalProblems: 0,
                lastPracticed: null,
                testScores: []
            };
        }

        const levelProgress = progress[module][level];
        levelProgress.attempts++;
        levelProgress.totalCorrect += correct;
        levelProgress.totalProblems += total;
        levelProgress.lastPracticed = new Date().toISOString();

        state.set('moduleProgress', progress);
    }

    /**
     * Record a test score
     */
    recordTestScore(module, level, score, total) {
        const progress = state.get('moduleProgress') || {};

        if (!progress[module]) {
            progress[module] = {};
        }

        if (!progress[module][level]) {
            progress[module][level] = {
                attempts: 0,
                totalCorrect: 0,
                totalProblems: 0,
                lastPracticed: null,
                testScores: []
            };
        }

        progress[module][level].testScores.push({
            date: new Date().toISOString(),
            score: score,
            total: total,
            percentage: Math.round((score / total) * 100)
        });

        state.set('moduleProgress', progress);
    }

    /**
     * Get progress for a specific module/level
     */
    getProgress(module, level) {
        const progress = state.get('moduleProgress') || {};
        return progress[module]?.[level] || null;
    }

    /**
     * Get overall module progress summary
     */
    getModuleSummary(module) {
        const progress = state.get('moduleProgress') || {};
        const moduleData = progress[module] || {};

        const levels = Object.keys(moduleData);
        if (levels.length === 0) {
            return {
                levelsAttempted: 0,
                averageAccuracy: 0,
                lastPracticed: null
            };
        }

        let totalCorrect = 0;
        let totalProblems = 0;
        let lastPracticed = null;

        for (const level of levels) {
            const levelData = moduleData[level];
            totalCorrect += levelData.totalCorrect || 0;
            totalProblems += levelData.totalProblems || 0;

            if (levelData.lastPracticed) {
                if (!lastPracticed || levelData.lastPracticed > lastPracticed) {
                    lastPracticed = levelData.lastPracticed;
                }
            }
        }

        return {
            levelsAttempted: levels.length,
            averageAccuracy: totalProblems > 0 ? Math.round((totalCorrect / totalProblems) * 100) : 0,
            totalProblems: totalProblems,
            lastPracticed: lastPracticed
        };
    }

    /**
     * Check if a level is considered "mastered" (for parent info only)
     * Mastery = at least one test with 80%+ score
     */
    isMastered(module, level) {
        const progress = this.getProgress(module, level);
        if (!progress || !progress.testScores || progress.testScores.length === 0) {
            return false;
        }

        return progress.testScores.some(test => test.percentage >= 80);
    }

    /**
     * Get all session history
     */
    getSessions() {
        return state.get('sessions') || [];
    }

    /**
     * Get sessions for today
     */
    getTodaySessions() {
        const sessions = this.getSessions();
        const today = new Date().toDateString();

        return sessions.filter(session => {
            const sessionDate = new Date(session.startTime).toDateString();
            return sessionDate === today;
        });
    }

    /**
     * Get total practice time (in minutes)
     */
    getTotalPracticeTime() {
        const sessions = this.getSessions();
        return sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    }

    /**
     * Get practice streak (consecutive days)
     */
    getStreak() {
        const sessions = this.getSessions();
        if (sessions.length === 0) return 0;

        // Get unique practice days
        const practiceDays = new Set();
        sessions.forEach(session => {
            const date = new Date(session.startTime).toDateString();
            practiceDays.add(date);
        });

        // Check consecutive days from today
        let streak = 0;
        const today = new Date();

        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toDateString();

            if (practiceDays.has(dateStr)) {
                streak++;
            } else if (i > 0) {
                // Allow skipping today (might not have practiced yet)
                break;
            }
        }

        return streak;
    }
}
