/**
 * CoinManager - Handles coin balance and spending
 * Coins are ONLY earned through 15-minute sessions (effort-based)
 */
import { state } from './StateManager.js';

export class CoinManager {
    constructor() {
        // Ensure coins object exists
        if (!state.get('coins')) {
            state.set('coins', { balance: 0, history: [] });
        }
    }

    /**
     * Get current coin balance
     */
    getBalance() {
        return state.get('coins.balance') || 0;
    }

    /**
     * Spend coins on a reward
     * Returns true if successful, false if insufficient balance
     */
    spend(amount, rewardId, rewardName) {
        const coins = state.get('coins') || { balance: 0, history: [] };

        if (coins.balance < amount) {
            return false;
        }

        coins.balance -= amount;
        coins.history.push({
            date: new Date().toISOString(),
            type: 'spent',
            amount: amount,
            reward: rewardName,
            rewardId: rewardId
        });

        state.set('coins', coins);

        // Track redeemed rewards
        const redeemed = state.get('redeemedRewards') || [];
        if (!redeemed.includes(rewardId)) {
            redeemed.push(rewardId);
            state.set('redeemedRewards', redeemed);
        }

        return true;
    }

    /**
     * Add coins (parent adjustment)
     */
    add(amount, reason = 'Parent adjustment') {
        const coins = state.get('coins') || { balance: 0, history: [] };
        coins.balance += amount;
        coins.history.push({
            date: new Date().toISOString(),
            type: 'earned',
            amount: amount,
            reason: reason
        });
        state.set('coins', coins);
    }

    /**
     * Remove coins (parent adjustment)
     */
    remove(amount, reason = 'Parent adjustment') {
        const coins = state.get('coins') || { balance: 0, history: [] };
        coins.balance = Math.max(0, coins.balance - amount);
        coins.history.push({
            date: new Date().toISOString(),
            type: 'removed',
            amount: amount,
            reason: reason
        });
        state.set('coins', coins);
    }

    /**
     * Check if a reward has been redeemed
     */
    isRedeemed(rewardId) {
        const redeemed = state.get('redeemedRewards') || [];
        return redeemed.includes(rewardId);
    }

    /**
     * Mark a reward as fulfilled (parent confirms they gave the reward)
     */
    markFulfilled(rewardId) {
        // Already tracked in redeemedRewards when spent
        // Could add a separate "fulfilled" tracking if needed
    }

    /**
     * Get coin history
     */
    getHistory() {
        return state.get('coins.history') || [];
    }

    /**
     * Get total coins earned all time
     */
    getTotalEarned() {
        const history = this.getHistory();
        return history
            .filter(entry => entry.type === 'earned')
            .reduce((sum, entry) => sum + entry.amount, 0);
    }

    /**
     * Get total coins spent all time
     */
    getTotalSpent() {
        const history = this.getHistory();
        return history
            .filter(entry => entry.type === 'spent')
            .reduce((sum, entry) => sum + entry.amount, 0);
    }
}
