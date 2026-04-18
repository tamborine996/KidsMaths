/**
 * Timer - UI component for displaying session timer
 */
export class Timer {
    constructor(timerManager) {
        this.timerManager = timerManager;
        this.timerBar = document.getElementById('timer-bar');
        this.timerText = document.getElementById('timer-text');
        this.coinCount = document.getElementById('coin-count');

        this._bindEvents();
    }

    /**
     * Bind timer manager events
     */
    _bindEvents() {
        // These will be set by app.js when timer is configured
    }

    /**
     * Show the timer bar
     */
    show() {
        this.timerBar.classList.remove('hidden');
    }

    /**
     * Hide the timer bar
     */
    hide() {
        this.timerBar.classList.add('hidden');
    }

    /**
     * Update timer display
     */
    update(remainingSeconds) {
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        this.timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Add warning class if under 2 minutes
        if (remainingSeconds <= 120 && remainingSeconds > 0) {
            this.timerBar.classList.add('timer-warning');
        } else {
            this.timerBar.classList.remove('timer-warning');
        }
    }

    /**
     * Update coin display
     */
    updateCoins(count) {
        if (this.coinCount) {
            this.coinCount.textContent = count;
        }

        // Also update store coin count if visible
        const storeCoinCount = document.getElementById('store-coin-count');
        if (storeCoinCount) {
            storeCoinCount.textContent = count;
        }

        // Update parent dashboard coin count if visible
        const parentCoinBalance = document.getElementById('parent-coin-balance');
        if (parentCoinBalance) {
            parentCoinBalance.textContent = count;
        }
    }

    /**
     * Flash coin animation when coin is earned
     */
    flashCoinEarned() {
        const coinDisplay = this.timerBar.querySelector('.coin-display');
        if (!coinDisplay) return;
        coinDisplay.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.3)' },
            { transform: 'scale(1)' }
        ], {
            duration: 300,
            easing: 'ease-out'
        });
    }
}
