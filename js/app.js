/**
 * KidsMaths - Main Application
 * A maths learning app that rewards effort, not performance
 */
import { state } from './managers/StateManager.js';
import { TimerManager } from './managers/TimerManager.js';
import { CoinManager } from './managers/CoinManager.js';
import { ProgressManager } from './managers/ProgressManager.js';
import { ProblemGenerator } from './managers/ProblemGenerator.js';
import { VisualObjects } from './components/VisualObjects.js';
import { Celebration } from './components/Celebration.js';
import { Timer } from './components/Timer.js';

class KidsMathsApp {
    constructor() {
        // Managers
        this.coinManager = new CoinManager();
        this.progressManager = new ProgressManager();
        this.problemGenerator = new ProblemGenerator();

        // Data
        this.modules = [];
        this.rewards = [];
        this.storyLevels = [];
        this.libraryLevels = [];

        // Current state
        this.currentProblem = null;
        this.testProblems = [];
        this.testIndex = 0;
        this.testCorrect = 0;

        // Reading state
        this.currentStory = null;
        this.currentStoryPage = 0;

        // Initialize after DOM ready
        this._init();
    }

    async _init() {
        // Load data files
        await this._loadData();

        // Initialize components
        this.celebration = new Celebration(document.getElementById('app'));

        // Timer with callbacks
        this.timerManager = new TimerManager({
            onTick: (remaining) => this._onTimerTick(remaining),
            onComplete: () => this._onSessionComplete(),
            onWarning: () => this._onTimerWarning()
        });

        this.timerUI = new Timer(this.timerManager);

        // Initialize visual canvas (will be set per screen)
        this.visualCanvas = null;
        this.visualObjects = null;

        // Bind events
        this._bindEvents();

        // History API - trap back button
        this._initHistoryTrapping();

        // Register service worker for PWA
        this._registerServiceWorker();

        // Long-press update button
        this._setupUpdateButton();

        // Render initial screen
        this._renderHomeScreen();
        this._updateCoinDisplay();
    }

    async _loadData() {
        try {
            const [modulesRes, rewardsRes, storiesRes, libraryRes] = await Promise.all([
                fetch('data/modules.json'),
                fetch('data/rewards.json'),
                fetch('data/stories.json'),
                fetch('data/library.json')
            ]);
            const modulesData = await modulesRes.json();
            const rewardsData = await rewardsRes.json();
            const storiesData = await storiesRes.json();
            const libraryData = await libraryRes.json();

            this.modules = modulesData.modules;
            this.rewards = rewardsData.rewards;
            this.storyLevels = storiesData.levels;
            this.libraryLevels = libraryData.levels;
            this.libraryAttribution = libraryData.attribution;
        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }

    _bindEvents() {
        // Home screen buttons
        document.getElementById('store-btn').addEventListener('click', () => this._showScreen('store'));
        document.getElementById('parent-btn').addEventListener('click', () => this._showScreen('parent'));

        // Back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.to;
                if (target === 'home') {
                    this.timerManager.stop();
                    this.timerUI.hide();
                }
                this._showScreen(target);
            });
        });

        // Module screen mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this._startMode(mode);
            });
        });

        // Level selector
        document.getElementById('level-select').addEventListener('change', (e) => {
            state.set('currentLevel', e.target.value);
        });

        // Practice screen
        document.getElementById('check-btn').addEventListener('click', () => this._checkAnswer());
        document.getElementById('hint-btn').addEventListener('click', () => this._showHint());
        document.getElementById('answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this._checkAnswer();
        });

        // Learn screen
        document.getElementById('start-practice-btn').addEventListener('click', () => {
            this._startMode('practice');
        });

        // Test screen
        document.getElementById('test-check-btn').addEventListener('click', () => this._checkTestAnswer());
        document.getElementById('test-answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this._checkTestAnswer();
        });
        document.getElementById('test-done-btn').addEventListener('click', () => this._showScreen('module'));

        // Session modal
        document.getElementById('session-continue-btn').addEventListener('click', () => {
            document.getElementById('session-modal').classList.add('hidden');
            this.timerManager.continueSession();
        });
        document.getElementById('session-stop-btn').addEventListener('click', () => {
            document.getElementById('session-modal').classList.add('hidden');
            this.timerManager.stop();
            this.timerUI.hide();
            this._showScreen('home');
        });

        // Parent screen
        this._bindParentEvents();

        // Store screen
        this._bindStoreEvents();

        // Reading screen
        this._bindReadingEvents();
    }

    _bindParentEvents() {
        // PIN handling
        document.getElementById('pin-submit').addEventListener('click', () => this._checkPin());
        document.getElementById('pin-cancel').addEventListener('click', () => this._showScreen('home'));
        document.getElementById('pin-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this._checkPin();
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(`${tab}-tab`).classList.add('active');
            });
        });

        // Coin adjustment
        document.getElementById('coin-plus').addEventListener('click', () => {
            this.coinManager.add(1);
            this._updateCoinDisplay();
        });
        document.getElementById('coin-minus').addEventListener('click', () => {
            this.coinManager.remove(1);
            this._updateCoinDisplay();
        });

        // Reset data
        document.getElementById('reset-data-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
                state.reset();
                this._updateCoinDisplay();
                this._renderParentDashboard();
            }
        });

        // Check for updates (settings tab button)
        document.getElementById('check-update-btn').addEventListener('click', () => {
            this._checkForUpdates(null);
        });

        // Change PIN
        document.getElementById('change-pin-btn').addEventListener('click', () => {
            const newPin = prompt('Enter new 4-digit PIN:');
            if (newPin && /^\d{4}$/.test(newPin)) {
                state.set('parentPin', newPin);
                alert('PIN changed successfully!');
            } else if (newPin) {
                alert('PIN must be exactly 4 digits.');
            }
        });
    }

    _bindStoreEvents() {
        // Delegated event for reward buttons
        document.getElementById('rewards-grid').addEventListener('click', (e) => {
            if (e.target.classList.contains('reward-btn')) {
                const rewardId = e.target.dataset.rewardId;
                this._purchaseReward(rewardId);
            }
        });
    }

    // ===== SCREEN MANAGEMENT =====

    _showScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        // Show target screen
        const screen = document.getElementById(`${screenName}-screen`);
        if (screen) {
            screen.classList.add('active');
        }

        // Screen-specific setup
        switch (screenName) {
            case 'home':
                this._renderHomeScreen();
                break;
            case 'module':
                this._renderModuleScreen();
                break;
            case 'store':
                this._renderStoreScreen();
                break;
            case 'parent':
                this._showParentPinOverlay();
                break;
            case 'reading':
                this._renderReadingScreen();
                break;
            case 'story':
                this._renderStoryPage();
                break;
        }

        // Push history state for back button trapping
        const prevScreen = state.get('currentScreen');
        state.set('currentScreen', screenName);
        if (screenName !== prevScreen) {
            history.pushState({ screen: screenName }, '', '');
        }
    }

    // ===== HOME SCREEN =====

    _renderHomeScreen() {
        const grid = document.getElementById('module-grid');
        grid.innerHTML = '';

        this.modules.forEach(module => {
            const btn = document.createElement('button');
            btn.className = 'module-btn';
            btn.dataset.module = module.id;
            btn.innerHTML = `
                <span class="module-icon">${module.icon}</span>
                <span class="module-name">${module.name}</span>
            `;
            btn.addEventListener('click', () => this._selectModule(module.id));
            grid.appendChild(btn);
        });

        // Add Reading button
        const readingBtn = document.createElement('button');
        readingBtn.className = 'module-btn';
        readingBtn.dataset.module = 'reading';
        readingBtn.innerHTML = `
            <span class="module-icon">\u{1F4D6}</span>
            <span class="module-name">Reading</span>
        `;
        readingBtn.addEventListener('click', () => this._showScreen('reading'));
        grid.appendChild(readingBtn);
    }

    _selectModule(moduleId) {
        state.set('currentModule', moduleId);
        const module = this.modules.find(m => m.id === moduleId);
        if (module && module.levels.length > 0) {
            state.set('currentLevel', module.levels[0].id);
        }
        this._showScreen('module');
    }

    // ===== MODULE SCREEN =====

    _renderModuleScreen() {
        const moduleId = state.get('currentModule');
        const module = this.modules.find(m => m.id === moduleId);
        if (!module) return;

        document.getElementById('module-title').textContent = module.name;

        // Render level selector
        const select = document.getElementById('level-select');
        select.innerHTML = '';
        module.levels.forEach(level => {
            const option = document.createElement('option');
            option.value = level.id;
            option.textContent = level.name;
            select.appendChild(option);
        });

        // Set current level
        const currentLevel = state.get('currentLevel');
        if (currentLevel) {
            select.value = currentLevel;
        }
    }

    // ===== MODE STARTING =====

    _startMode(mode) {
        state.set('currentMode', mode);

        switch (mode) {
            case 'learn':
                this._showScreen('learn');
                this._renderLearnContent();
                break;
            case 'practice':
                this._showScreen('practice');
                this._startPractice();
                break;
            case 'test':
                this._showScreen('test');
                this._startTest();
                break;
        }
    }

    // ===== LEARN SCREEN =====

    _renderLearnContent() {
        const moduleId = state.get('currentModule');
        const levelId = state.get('currentLevel');
        const module = this.modules.find(m => m.id === moduleId);
        const level = module?.levels.find(l => l.id === levelId);

        const content = document.getElementById('learn-content');

        // Generate example problems for learning
        content.innerHTML = `
            <h3>${level?.name || 'Learn'}</h3>
            <p>${level?.description || ''}</p>
            <div class="learn-example">
                <p>Let's see how this works...</p>
            </div>
        `;

        // If visual level, show a canvas with example
        if (level?.config?.visual) {
            const canvas = document.createElement('canvas');
            canvas.className = 'visual-canvas';
            canvas.width = 400;
            canvas.height = 200;
            content.appendChild(canvas);

            const vo = new VisualObjects(canvas);
            // Show example: 3 + 2
            setTimeout(() => {
                vo.drawAddition(3, 2, level.config.visualType || 'apples');
            }, 100);

            const explanation = document.createElement('p');
            explanation.className = 'learn-explanation';
            explanation.textContent = `Count the ${level.config.visualType || 'objects'}! 3 + 2 = 5`;
            content.appendChild(explanation);
        }
    }

    // ===== PRACTICE SCREEN =====

    _startPractice() {
        // Show timer and start it
        this.timerUI.show();
        this.timerManager.start();

        // Setup canvas if visual level
        const canvas = document.getElementById('visual-canvas');
        this.visualObjects = new VisualObjects(canvas);

        // Generate first problem
        this._nextProblem();
    }

    _nextProblem() {
        const moduleId = state.get('currentModule');
        const levelId = state.get('currentLevel');
        const module = this.modules.find(m => m.id === moduleId);
        const level = module?.levels.find(l => l.id === levelId);

        if (!level) return;

        // Generate problem
        this.currentProblem = this.problemGenerator.generate(moduleId, level.config);

        // Update display
        this._renderProblem(this.currentProblem);

        // Clear and focus input
        const input = document.getElementById('answer-input');
        input.value = '';
        input.classList.remove('correct', 'incorrect');
        input.focus();

        // Hide hint
        document.getElementById('hint-area').classList.add('hidden');
    }

    _renderProblem(problem) {
        // Update text display
        if (problem.displayFormat) {
            // Special format (percentages)
            document.getElementById('problem-display').innerHTML = `
                <span class="problem-text">${problem.displayFormat.replace('?', '')}</span>
                <input type="number" id="answer-input" class="answer-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
            `;
            // Re-bind enter key
            document.getElementById('answer-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this._checkAnswer();
            });
        } else {
            document.getElementById('operand1').textContent = problem.operand1;
            document.getElementById('operator').textContent = problem.operator;
            document.getElementById('operand2').textContent = problem.operand2;
        }

        // Update visual canvas
        const canvas = document.getElementById('visual-canvas');
        if (problem.visual) {
            canvas.classList.remove('hidden');
            setTimeout(() => {
                if (problem.operator === '+') {
                    this.visualObjects.drawAddition(problem.operand1, problem.operand2, problem.visualType);
                } else if (problem.operator === '-') {
                    this.visualObjects.drawSubtraction(problem.operand1, problem.operand2, problem.visualType);
                } else if (problem.operator === '×' && problem.visualType === 'groups') {
                    this.visualObjects.drawGroups(problem.operand1, problem.operand2, 'apples');
                }
            }, 50);
        } else {
            canvas.classList.add('hidden');
        }
    }

    _checkAnswer() {
        const input = document.getElementById('answer-input');
        const userAnswer = parseInt(input.value);

        if (isNaN(userAnswer)) {
            input.focus();
            return;
        }

        this.timerManager.incrementProblems();

        if (userAnswer === this.currentProblem.answer) {
            // Correct!
            this.celebration.pulseElement(input);
            this.celebration.trigger();

            // Record for progress
            this.progressManager.recordAttempt(
                state.get('currentModule'),
                state.get('currentLevel'),
                1, 1
            );

            // Next problem after celebration
            setTimeout(() => {
                this._nextProblem();
            }, 1600);
        } else {
            // Incorrect - gentle feedback
            this.celebration.gentleShake(input);

            // Show encouraging feedback
            const feedback = document.getElementById('feedback-display');
            feedback.textContent = "Let's try again! Take your time.";
            feedback.className = 'feedback-display incorrect';
            feedback.classList.remove('hidden');

            // Record attempt
            this.progressManager.recordAttempt(
                state.get('currentModule'),
                state.get('currentLevel'),
                0, 1
            );

            // Hide feedback after a moment
            setTimeout(() => {
                feedback.classList.add('hidden');
            }, 2000);

            // Clear input for retry
            input.value = '';
            input.focus();
        }
    }

    _showHint() {
        const hint = this.problemGenerator.generateHint(this.currentProblem);
        document.getElementById('hint-text').textContent = hint;
        document.getElementById('hint-area').classList.remove('hidden');
    }

    // ===== TEST SCREEN =====

    _startTest() {
        const moduleId = state.get('currentModule');
        const levelId = state.get('currentLevel');
        const module = this.modules.find(m => m.id === moduleId);
        const level = module?.levels.find(l => l.id === levelId);

        if (!level) return;

        // Generate 10 test problems
        this.testProblems = [];
        for (let i = 0; i < 10; i++) {
            this.testProblems.push(this.problemGenerator.generate(moduleId, level.config));
        }

        this.testIndex = 0;
        this.testCorrect = 0;

        // Show timer
        this.timerUI.show();
        this.timerManager.start();

        // Setup canvas
        const canvas = document.getElementById('test-visual-canvas');
        this.testVisualObjects = new VisualObjects(canvas);

        // Hide completion, show test area
        document.getElementById('test-complete').classList.add('hidden');
        document.querySelector('#test-screen .practice-area').style.display = 'flex';
        document.querySelector('#test-screen .test-progress').style.display = 'block';

        this._renderTestProblem();
    }

    _renderTestProblem() {
        const problem = this.testProblems[this.testIndex];

        // Update progress
        document.getElementById('test-progress-text').textContent =
            `Question ${this.testIndex + 1} of ${this.testProblems.length}`;
        document.getElementById('test-progress-fill').style.width =
            `${((this.testIndex) / this.testProblems.length) * 100}%`;

        // Update problem display
        document.getElementById('test-operand1').textContent = problem.operand1;
        document.getElementById('test-operator').textContent = problem.operator;
        document.getElementById('test-operand2').textContent = problem.operand2;

        // Visual
        const canvas = document.getElementById('test-visual-canvas');
        if (problem.visual) {
            canvas.classList.remove('hidden');
            setTimeout(() => {
                if (problem.operator === '+') {
                    this.testVisualObjects.drawAddition(problem.operand1, problem.operand2, problem.visualType);
                } else if (problem.operator === '-') {
                    this.testVisualObjects.drawSubtraction(problem.operand1, problem.operand2, problem.visualType);
                }
            }, 50);
        } else {
            canvas.classList.add('hidden');
        }

        // Clear and focus input
        const input = document.getElementById('test-answer-input');
        input.value = '';
        input.classList.remove('correct', 'incorrect');
        input.focus();
    }

    _checkTestAnswer() {
        const input = document.getElementById('test-answer-input');
        const userAnswer = parseInt(input.value);

        if (isNaN(userAnswer)) {
            input.focus();
            return;
        }

        const problem = this.testProblems[this.testIndex];
        const correct = userAnswer === problem.answer;

        if (correct) {
            this.testCorrect++;
            this.celebration.pulseElement(input);
        } else {
            this.celebration.gentleShake(input);
        }

        this.testIndex++;

        if (this.testIndex >= this.testProblems.length) {
            // Test complete
            this._completeTest();
        } else {
            // Next problem
            setTimeout(() => {
                this._renderTestProblem();
            }, 500);
        }
    }

    _completeTest() {
        // Record test score
        this.progressManager.recordTestScore(
            state.get('currentModule'),
            state.get('currentLevel'),
            this.testCorrect,
            this.testProblems.length
        );

        // Update progress bar to 100%
        document.getElementById('test-progress-fill').style.width = '100%';

        // Show completion
        document.querySelector('#test-screen .practice-area').style.display = 'none';
        document.querySelector('#test-screen .test-progress').style.display = 'none';

        const complete = document.getElementById('test-complete');
        complete.classList.remove('hidden');
        document.getElementById('test-result').textContent =
            `You got ${this.testCorrect} out of ${this.testProblems.length}!`;

        // Celebration
        if (this.testCorrect >= 8) {
            this.celebration.trigger();
        }
    }

    // ===== TIMER CALLBACKS =====

    _onTimerTick(remaining) {
        this.timerUI.update(remaining);
    }

    _onTimerWarning() {
        // Visual warning already handled by CSS
    }

    _onSessionComplete() {
        // Show session complete modal
        document.getElementById('session-modal').classList.remove('hidden');

        // Update coin display
        this._updateCoinDisplay();
        this.timerUI.flashCoinEarned();
    }

    // ===== STORE SCREEN =====

    _renderStoreScreen() {
        const grid = document.getElementById('rewards-grid');
        grid.innerHTML = '';

        this.rewards.forEach(reward => {
            const isRedeemed = this.coinManager.isRedeemed(reward.id);
            const canAfford = this.coinManager.getBalance() >= reward.cost;

            const card = document.createElement('div');
            card.className = `reward-card ${isRedeemed ? 'redeemed' : ''}`;
            card.innerHTML = `
                <span class="reward-icon">${reward.icon}</span>
                <span class="reward-name">${reward.name}</span>
                <span class="reward-cost">
                    <span class="coin-icon"></span>
                    ${reward.cost}
                </span>
                <button class="primary-btn reward-btn"
                        data-reward-id="${reward.id}"
                        ${isRedeemed ? 'disabled' : ''}
                        ${!canAfford && !isRedeemed ? 'disabled' : ''}>
                    ${isRedeemed ? 'Redeemed!' : (canAfford ? 'Get It!' : 'Need more coins')}
                </button>
            `;
            grid.appendChild(card);
        });

        // Update coin display
        document.getElementById('store-coin-count').textContent = this.coinManager.getBalance();
    }

    _purchaseReward(rewardId) {
        const reward = this.rewards.find(r => r.id === rewardId);
        if (!reward) return;

        if (this.coinManager.spend(reward.cost, reward.id, reward.name)) {
            this._updateCoinDisplay();
            this._renderStoreScreen();
            this.celebration.trigger();
        }
    }

    // ===== PARENT SCREEN =====

    _showParentPinOverlay() {
        document.getElementById('pin-overlay').style.display = 'flex';
        document.getElementById('parent-dashboard').classList.add('hidden');
        document.getElementById('pin-input').value = '';
        document.getElementById('pin-input').focus();
    }

    _checkPin() {
        const input = document.getElementById('pin-input');
        const enteredPin = input.value;
        const correctPin = state.get('parentPin') || '1234';

        if (enteredPin === correctPin) {
            document.getElementById('pin-overlay').style.display = 'none';
            document.getElementById('parent-dashboard').classList.remove('hidden');
            this._renderParentDashboard();
        } else {
            input.classList.add('incorrect');
            setTimeout(() => input.classList.remove('incorrect'), 400);
            input.value = '';
        }
    }

    _renderParentDashboard() {
        this._renderProgressTab();
        this._renderSessionsTab();
        this._updateCoinDisplay();
    }

    _renderProgressTab() {
        const container = document.getElementById('progress-overview');
        container.innerHTML = '';

        // Overall stats banner at the top
        const totalTime = this.progressManager.getTotalPracticeTime();
        const streak = this.progressManager.getStreak();
        const totalCoins = this.coinManager.getTotalEarned();

        const stats = document.createElement('div');
        stats.className = 'overall-stats';
        stats.innerHTML = `
            <div class="stat-block">
                <div class="stat-value">${totalTime}</div>
                <div class="stat-label">minutes practiced</div>
            </div>
            <div class="stat-block">
                <div class="stat-value">${streak}</div>
                <div class="stat-label">day${streak !== 1 ? 's' : ''} streak</div>
            </div>
            <div class="stat-block">
                <div class="stat-value">${totalCoins}</div>
                <div class="stat-label">coins earned</div>
            </div>
        `;
        container.appendChild(stats);

        // Progress grid
        const grid = document.createElement('div');
        grid.className = 'progress-grid';

        this.modules.forEach(module => {
            const summary = this.progressManager.getModuleSummary(module.id);
            const totalLevels = module.levels.length;
            const progressPercent = totalLevels > 0 ? Math.round((summary.levelsAttempted / totalLevels) * 100) : 0;

            // SVG ring calculation
            const radius = 32;
            const circumference = 2 * Math.PI * radius;
            const dashOffset = circumference - (progressPercent / 100) * circumference;

            const card = document.createElement('div');
            card.className = `progress-card color-${module.color}`;
            card.innerHTML = `
                <div class="progress-ring">
                    <svg viewBox="0 0 80 80">
                        <circle class="progress-ring-bg" cx="40" cy="40" r="${radius}"/>
                        <circle class="progress-ring-fill color-${module.color}" cx="40" cy="40" r="${radius}"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${dashOffset}"/>
                    </svg>
                    <span class="progress-ring-text">${summary.levelsAttempted}/${totalLevels}</span>
                </div>
                <h5>${module.name}</h5>
                <div class="stat-row">
                    <span>📝 ${summary.totalProblems || 0}</span>
                    <span>🎯 ${summary.averageAccuracy}%</span>
                </div>
                ${summary.lastPracticed ? `<div class="last-practiced">${this._formatLastPracticed(summary.lastPracticed)}</div>` : '<div class="last-practiced">Not started</div>'}
            `;
            grid.appendChild(card);
        });

        container.appendChild(grid);
    }

    _formatLastPracticed(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    }

    _renderSessionsTab() {
        const container = document.getElementById('session-history');
        const sessions = this.progressManager.getSessions().slice(-20).reverse();

        if (sessions.length === 0) {
            container.innerHTML = '<p>No sessions yet!</p>';
            return;
        }

        container.innerHTML = '<h4>Recent Sessions</h4>';

        sessions.forEach(session => {
            const date = new Date(session.startTime);
            const entry = document.createElement('div');
            entry.className = 'session-entry';
            entry.innerHTML = `
                <span class="session-date">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                <span class="session-module">${session.module || 'Mixed'}</span>
                <span class="session-duration">${session.duration} min</span>
                <span class="session-problems">${session.problemsAttempted || 0} problems</span>
            `;
            container.appendChild(entry);
        });
    }

    // ===== READING SECTION =====

    _bindReadingEvents() {
        // Tab switching
        document.querySelectorAll('.reading-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.reading-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                state.set('readingTab', e.currentTarget.dataset.readingTab);
                this._populateLevelSelector();
                this._renderStoryList();
            });
        });

        // Level selector
        document.getElementById('reading-level-select').addEventListener('change', (e) => {
            const tab = state.get('readingTab') || 'library';
            state.set(tab === 'library' ? 'libraryLevel' : 'readingLevel', e.target.value);
            this._renderStoryList();
        });

        // Story navigation
        document.getElementById('story-prev-btn').addEventListener('click', () => this._storyPrevPage());
        document.getElementById('story-next-btn').addEventListener('click', () => this._storyNextPage());

        // Delegated click for story cards
        document.getElementById('story-list').addEventListener('click', (e) => {
            const card = e.target.closest('.story-card');
            if (card) {
                this._startStory(card.dataset.storyId);
            }
        });
    }

    _renderReadingScreen() {
        // Set active tab
        const tab = state.get('readingTab') || 'library';
        document.querySelectorAll('.reading-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.readingTab === tab);
        });

        this._populateLevelSelector();
        this._renderStoryList();
    }

    _populateLevelSelector() {
        const tab = state.get('readingTab') || 'library';
        const levels = tab === 'library' ? this.libraryLevels : this.storyLevels;
        const stateKey = tab === 'library' ? 'libraryLevel' : 'readingLevel';

        const select = document.getElementById('reading-level-select');
        select.innerHTML = '';

        levels.forEach(level => {
            const option = document.createElement('option');
            option.value = level.id;
            option.textContent = tab === 'library'
                ? `${level.name} (Age ${level.ageRange})`
                : `${level.name} (Age ${level.ageRange})`;
            select.appendChild(option);
        });

        const currentLevel = state.get(stateKey) || (levels[0]?.id);
        if (currentLevel) {
            select.value = currentLevel;
            state.set(stateKey, currentLevel);
        }

        // Show/hide attribution
        const attr = document.getElementById('library-attribution');
        if (tab === 'library' && this.libraryAttribution) {
            attr.textContent = this.libraryAttribution;
            attr.classList.remove('hidden');
        } else {
            attr.classList.add('hidden');
        }
    }

    _renderStoryList() {
        const tab = state.get('readingTab') || 'library';
        const stateKey = tab === 'library' ? 'libraryLevel' : 'readingLevel';
        const levels = tab === 'library' ? this.libraryLevels : this.storyLevels;
        const levelId = state.get(stateKey);
        const level = levels.find(l => l.id === levelId);
        const list = document.getElementById('story-list');
        list.innerHTML = '';

        if (!level) return;

        const readStories = state.get('readStories') || [];

        level.stories.forEach(story => {
            const isRead = readStories.includes(story.id);
            const hasImages = story.pages[0]?.image;
            const card = document.createElement('div');
            card.className = 'story-card';
            card.dataset.storyId = story.id;
            card.dataset.source = tab;
            card.innerHTML = `
                <span class="story-card-icon">${hasImages ? '\u{1F5BC}\uFE0F' : '\u{1F4D6}'}</span>
                <div class="story-card-info">
                    <div class="story-card-title">${story.title}</div>
                    <div class="story-card-pages">${story.pages.length} pages${story.author ? ' \u00B7 ' + story.author : ''}</div>
                </div>
                <span class="story-card-status">${isRead ? '\u2705' : ''}</span>
            `;
            list.appendChild(card);
        });
    }

    _startStory(storyId) {
        // Find story across all level sources
        const allLevels = [...this.storyLevels, ...this.libraryLevels];
        for (const level of allLevels) {
            const story = level.stories.find(s => s.id === storyId);
            if (story) {
                this.currentStory = story;
                this.currentStoryPage = 0;

                // Start timer for reading session (only if not already running)
                if (!this.timerManager.isRunning) {
                    this.timerUI.show();
                    this.timerManager.start();

                    // Override session module to 'reading'
                    const session = state.get('currentSession');
                    if (session) {
                        session.module = 'reading';
                        state.set('currentSession', session);
                    }
                }

                this._showScreen('story');
                return;
            }
        }
    }

    _renderStoryPage() {
        if (!this.currentStory) return;

        const story = this.currentStory;
        const page = story.pages[this.currentStoryPage];

        document.getElementById('story-title').textContent = story.title;
        document.getElementById('story-text').textContent = page.text;
        document.getElementById('story-page-text').textContent =
            `Page ${this.currentStoryPage + 1} of ${story.pages.length}`;
        document.getElementById('story-progress-fill').style.width =
            `${((this.currentStoryPage + 1) / story.pages.length) * 100}%`;

        // Show/hide illustration
        const img = document.getElementById('story-image');
        if (page.image) {
            img.src = page.image;
            img.alt = `Illustration for ${story.title}`;
            img.classList.remove('hidden');
        } else {
            img.classList.add('hidden');
            img.src = '';
        }

        // Show/hide nav buttons
        document.getElementById('story-prev-btn').style.visibility =
            this.currentStoryPage > 0 ? 'visible' : 'hidden';

        const nextBtn = document.getElementById('story-next-btn');
        if (this.currentStoryPage >= story.pages.length - 1) {
            nextBtn.textContent = 'Finish \u2713';
        } else {
            nextBtn.innerHTML = 'Next &rarr;';
        }
    }

    _storyPrevPage() {
        if (this.currentStoryPage > 0) {
            this.currentStoryPage--;
            this._renderStoryPage();
        }
    }

    _storyNextPage() {
        if (!this.currentStory) return;

        if (this.currentStoryPage < this.currentStory.pages.length - 1) {
            this.currentStoryPage++;
            this._renderStoryPage();
        } else {
            // Story complete — mark as read
            const readStories = state.get('readStories') || [];
            if (!readStories.includes(this.currentStory.id)) {
                readStories.push(this.currentStory.id);
                state.set('readStories', readStories);
            }

            this.celebration.trigger();

            // Go back to reading level screen (timer keeps running)
            setTimeout(() => {
                this._showScreen('reading');
            }, 1500);
        }
    }

    // ===== HISTORY API - BACK BUTTON TRAPPING =====

    _initHistoryTrapping() {
        // Push initial state
        history.replaceState({ screen: 'home' }, '', '');

        window.addEventListener('popstate', (e) => {
            const targetScreen = e.state?.screen || 'home';
            const currentScreen = state.get('currentScreen');

            if (currentScreen === 'home') {
                // Already on home — push state again to prevent leaving
                history.pushState({ screen: 'home' }, '', '');
                return;
            }

            // Navigate to the screen from history, or go to parent screen
            const parentMap = {
                'story': 'reading',
                'reading': 'home',
                'module': 'home',
                'learn': 'module',
                'practice': 'module',
                'test': 'module',
                'store': 'home',
                'parent': 'home'
            };

            const destination = parentMap[currentScreen] || 'home';

            // Stop timer if going home
            if (destination === 'home') {
                this.timerManager.stop();
                this.timerUI.hide();
            }

            // Navigate without pushing another state (we're already popping)
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const screen = document.getElementById(`${destination}-screen`);
            if (screen) screen.classList.add('active');

            state.set('currentScreen', destination);

            // Re-render destination
            switch (destination) {
                case 'home': this._renderHomeScreen(); break;
                case 'module': this._renderModuleScreen(); break;
                case 'reading': this._renderReadingScreen(); break;
                case 'store': this._renderStoreScreen(); break;
            }
        });
    }

    // ===== SERVICE WORKER REGISTRATION =====

    _registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').then(reg => {
                // Check for updates every 30 minutes
                setInterval(() => reg.update(), 30 * 60 * 1000);
            }).catch(err => {
                console.warn('SW registration failed:', err);
            });

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'SW_UPDATED') {
                    window.location.reload();
                }
                if (event.data?.type === 'BUILD_TIME') {
                    const stamp = document.getElementById('build-stamp');
                    if (stamp) stamp.textContent = event.data.buildTime;
                }
            });

            // Request build time once SW is ready
            navigator.serviceWorker.ready.then(reg => {
                reg.active.postMessage({ type: 'GET_BUILD_TIME' });
            });
        }
    }

    _setupUpdateButton() {
        const btn = document.getElementById('update-btn');
        const HOLD_DURATION = 3000;
        let pressTimer = null;
        let animFrame = null;
        let startTime = 0;

        const startPress = (e) => {
            e.preventDefault();
            startTime = Date.now();
            btn.classList.add('pressing');

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
                btn.style.setProperty('--press-progress', `${progress}%`);
                if (progress < 100) {
                    animFrame = requestAnimationFrame(animate);
                }
            };
            animFrame = requestAnimationFrame(animate);

            pressTimer = setTimeout(() => {
                btn.classList.remove('pressing');
                btn.classList.add('checking');
                this._checkForUpdates(btn);
            }, HOLD_DURATION);
        };

        const cancelPress = () => {
            clearTimeout(pressTimer);
            cancelAnimationFrame(animFrame);
            btn.classList.remove('pressing');
            btn.style.setProperty('--press-progress', '0%');
        };

        btn.addEventListener('pointerdown', startPress);
        btn.addEventListener('pointerup', cancelPress);
        btn.addEventListener('pointercancel', cancelPress);
        btn.addEventListener('pointerleave', cancelPress);
    }

    async _checkForUpdates(indicatorBtn) {
        const statusEl = document.getElementById('update-status');
        const settingsBtn = document.getElementById('check-update-btn');

        if (settingsBtn) {
            settingsBtn.disabled = true;
            statusEl.textContent = 'Checking...';
        }

        try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg) {
                if (indicatorBtn) { indicatorBtn.classList.remove('checking'); }
                if (statusEl) { statusEl.textContent = 'Service worker not found.'; }
                if (settingsBtn) { settingsBtn.disabled = false; }
                return;
            }

            await reg.update();

            if (reg.installing || reg.waiting) {
                if (statusEl) { statusEl.textContent = 'Update found! Applying...'; }
                const worker = reg.installing || reg.waiting;
                worker.addEventListener('statechange', () => {
                    if (worker.state === 'activated') {
                        window.location.reload();
                    }
                });
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            } else {
                if (indicatorBtn) {
                    indicatorBtn.classList.remove('checking');
                    indicatorBtn.classList.add('done');
                    setTimeout(() => indicatorBtn.classList.remove('done'), 2000);
                }
                if (statusEl) { statusEl.textContent = 'You\'re on the latest version.'; }
                if (settingsBtn) { settingsBtn.disabled = false; }
            }
        } catch (err) {
            if (indicatorBtn) { indicatorBtn.classList.remove('checking'); }
            if (statusEl) { statusEl.textContent = 'Update check failed. Are you online?'; }
            if (settingsBtn) { settingsBtn.disabled = false; }
        }
    }

    // ===== UTILITY =====

    _updateCoinDisplay() {
        const balance = this.coinManager.getBalance();
        this.timerUI.updateCoins(balance);
    }
}

// Start the app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new KidsMathsApp();
});
