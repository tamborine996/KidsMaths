/**
 * Celebration - Celebratory animations for correct answers
 * Designed to be encouraging without being overwhelming
 */
export class Celebration {
    constructor(container) {
        this.container = container;
        this.overlay = document.getElementById('celebration-overlay');
        this.starsContainer = document.getElementById('celebration-stars');
        this.textElement = document.getElementById('celebration-text');

        this.messages = [
            'Well done!',
            'Great job!',
            'Fantastic!',
            'Awesome!',
            'You got it!',
            'Brilliant!',
            'Super!',
            'Amazing!',
            'Perfect!',
            'Excellent!'
        ];

        this.colors = [
            '#FF6B6B', // coral
            '#4ECDC4', // teal
            '#FFE66D', // yellow
            '#95E1D3', // mint
            '#F38181', // salmon
            '#AA96DA', // lavender
            '#FCBAD3', // pink
            '#A8D8EA', // sky blue
        ];
    }

    /**
     * Trigger celebration animation
     */
    trigger() {
        // Show overlay
        this.overlay.classList.remove('hidden');

        // Set random message
        const message = this.messages[Math.floor(Math.random() * this.messages.length)];
        this.textElement.textContent = message;

        // Create confetti
        this._createConfetti(20);

        // Create stars burst
        this._createStars(8);

        // Hide after animation
        setTimeout(() => {
            this.hide();
        }, 1500);
    }

    /**
     * Hide celebration overlay
     */
    hide() {
        this.overlay.classList.add('hidden');
        this.starsContainer.innerHTML = '';
    }

    /**
     * Create confetti pieces
     */
    _createConfetti(count) {
        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.backgroundColor = this.colors[Math.floor(Math.random() * this.colors.length)];
            confetti.style.animationDuration = `${Math.random() * 2 + 1}s`;
            confetti.style.animationDelay = `${Math.random() * 0.5}s`;

            // Random shapes
            if (Math.random() > 0.5) {
                confetti.style.borderRadius = '50%';
            }

            this.starsContainer.appendChild(confetti);
        }
    }

    /**
     * Create star burst effect
     */
    _createStars(count) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        for (let i = 0; i < count; i++) {
            const star = document.createElement('div');
            star.innerHTML = '★';
            star.style.cssText = `
                position: absolute;
                font-size: 24px;
                color: ${this.colors[Math.floor(Math.random() * this.colors.length)]};
                left: ${centerX}px;
                top: ${centerY}px;
                pointer-events: none;
                animation: starBurst 0.8s ease-out forwards;
                --angle: ${(i / count) * 360}deg;
                --distance: ${80 + Math.random() * 40}px;
            `;

            // Add custom animation
            star.animate([
                {
                    transform: 'translate(-50%, -50%) scale(0)',
                    opacity: 1
                },
                {
                    transform: `translate(
                        calc(-50% + ${Math.cos((i / count) * Math.PI * 2) * (80 + Math.random() * 40)}px),
                        calc(-50% + ${Math.sin((i / count) * Math.PI * 2) * (80 + Math.random() * 40)}px)
                    ) scale(1.2)`,
                    opacity: 1,
                    offset: 0.5
                },
                {
                    transform: `translate(
                        calc(-50% + ${Math.cos((i / count) * Math.PI * 2) * (100 + Math.random() * 60)}px),
                        calc(-50% + ${Math.sin((i / count) * Math.PI * 2) * (100 + Math.random() * 60)}px)
                    ) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: 800,
                easing: 'ease-out',
                fill: 'forwards'
            });

            this.starsContainer.appendChild(star);
        }
    }

    /**
     * Quick pulse animation on an element (for correct answer input)
     */
    pulseElement(element) {
        element.classList.add('correct');
        setTimeout(() => {
            element.classList.remove('correct');
        }, 500);
    }

    /**
     * Gentle shake animation (for incorrect - encouraging, not punishing)
     */
    gentleShake(element) {
        element.classList.add('incorrect');
        setTimeout(() => {
            element.classList.remove('incorrect');
        }, 400);
    }
}
