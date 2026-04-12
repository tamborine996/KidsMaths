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
        this.urduLevels = [];

        // Current state
        this.currentProblem = null;
        this.testProblems = [];
        this.testIndex = 0;
        this.testCorrect = 0;

        // Reading state
        this.currentStory = null;
        this.currentStoryPage = 0;
        this._storyTouchStartX = 0;
        this._storyTouchStartY = 0;
        this._selectedUrduWord = null;
        this._showUrduTranslation = false;
        this._showUrduSavedWords = false;

        // Search index (built after data loads)
        this._storyIndex = [];

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

        // Prefer portrait so small hand movements don't rotate the app
        this._lockPortraitOrientation();

        // Long-press update button
        this._setupUpdateButton();

        // Render initial screen
        this._renderHomeScreen();
        this._updateCoinDisplay();
    }

    async _loadData() {
        try {
            const [modulesRes, rewardsRes, storiesRes, libraryRes, urduRes] = await Promise.all([
                fetch('data/modules.json'),
                fetch('data/rewards.json'),
                fetch('data/stories.json'),
                fetch('data/library.json'),
                fetch('data/urdu.json')
            ]);
            const modulesData = await modulesRes.json();
            const rewardsData = await rewardsRes.json();
            const storiesData = await storiesRes.json();
            const libraryData = await libraryRes.json();
            const urduData = await urduRes.json();

            this.modules = modulesData.modules;
            this.rewards = rewardsData.rewards;
            this.storyLevels = storiesData.levels;
            this.libraryLevels = libraryData.levels;
            this.urduLevels = urduData.levels;
            this.libraryAttribution = libraryData.attribution;
            this.urduAttribution = urduData.attribution;
            this._buildStoryIndex();
        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }

    _buildStoryIndex() {
        this._storyIndex = [];
        const addLevel = (levels, source) => {
            for (const level of levels) {
                for (const story of level.stories) {
                    this._storyIndex.push({
                        id: story.id,
                        title: story.title,
                        author: story.author || '',
                        pages: story.pages.length,
                        level: level.name,
                        source
                    });
                }
            }
        };
        addLevel(this.storyLevels, 'ours');
        addLevel(this.libraryLevels, 'library');
        addLevel(this.urduLevels, 'urdu');
    }

    _getReadingSourceConfig(tab = state.get('readingTab') || 'library') {
        if (tab === 'urdu') {
            return {
                levels: this.urduLevels,
                stateKey: 'urduLevel',
                attribution: this.urduAttribution || ''
            };
        }

        if (tab === 'ours') {
            return {
                levels: this.storyLevels,
                stateKey: 'readingLevel',
                attribution: ''
            };
        }

        return {
            levels: this.libraryLevels,
            stateKey: 'libraryLevel',
            attribution: this.libraryAttribution || ''
        };
    }

    _bindEvents() {
        // Home screen buttons
        document.getElementById('store-btn').addEventListener('click', () => this._showScreen('store'));
        document.getElementById('parent-btn').addEventListener('click', () => this._showScreen('parent'));
        document.getElementById('home-reading-hub').addEventListener('click', () => this._showScreen('reading'));
        document.getElementById('home-urdu-hub').addEventListener('click', () => {
            state.set('readingTab', 'urdu');
            this._showScreen('reading');
        });
        document.getElementById('home-maths-hub').addEventListener('click', () => {
            document.getElementById('module-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        document.getElementById('home-next-up').addEventListener('click', (e) => this._handleHomeShortcutClick(e));
        document.getElementById('home-resume').addEventListener('click', (e) => this._handleHomeShortcutClick(e));

        // Back + Home buttons
        document.querySelectorAll('.back-btn, .home-btn').forEach(btn => {
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

        // Search
        this._bindSearchEvents();
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
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        const homeDashboard = document.getElementById('home-dashboard');

        if (searchInput) searchInput.value = '';
        if (searchResults) {
            searchResults.classList.add('hidden');
            searchResults.innerHTML = '';
        }
        if (homeDashboard) {
            homeDashboard.classList.remove('hidden');
        }

        this._renderHomeNextUp();
        this._renderHomeResume();
        this._renderHomeLearningAreas();
        this._renderHomeModules();
    }

    _renderHomeNextUp() {
        const container = document.getElementById('home-next-up');
        const nextItem = this._getPrimaryNextUp();

        if (!nextItem) {
            container.innerHTML = `
                <button class="next-up-card" data-kind="screen" data-screen="reading">
                    <div class="next-up-label">Next up</div>
                    <div class="next-up-title">Start a story or pick a maths module</div>
                    <div class="next-up-meta">Reading and maths now each have their own space on the home screen.</div>
                    <div class="next-up-cta">Open Reading &rarr;</div>
                </button>
            `;
            return;
        }

        const icon = nextItem.type === 'story' ? '📖' : (nextItem.icon || '➕');
        const dataAttrs = nextItem.type === 'story'
            ? `data-kind="story" data-story-id="${nextItem.storyId}" data-page="${nextItem.page}"`
            : `data-kind="module" data-module-id="${nextItem.moduleId}" data-level-id="${nextItem.levelId || ''}" data-mode="${nextItem.mode || ''}"`;
        const meta = nextItem.type === 'story'
            ? `Page ${nextItem.page + 1} of ${nextItem.totalPages} · ${nextItem.levelName}`
            : `${nextItem.levelName || 'Pick up where you left off'}${nextItem.modeLabel ? ' · ' + nextItem.modeLabel : ''}`;

        container.innerHTML = `
            <button class="next-up-card" ${dataAttrs}>
                <div class="next-up-label">Next up</div>
                <div class="next-up-main">
                    <span class="next-up-icon">${icon}</span>
                    <div>
                        <div class="next-up-title">${nextItem.title}</div>
                        <div class="next-up-meta">${meta}</div>
                    </div>
                </div>
                <div class="next-up-cta">${nextItem.cta}</div>
            </button>
        `;
    }

    _renderHomeResume() {
        const container = document.getElementById('home-resume');
        const primaryKey = this._getPrimaryNextUp()?.key;
        const items = this._getResumeItems()
            .filter(item => item.key !== primaryKey)
            .slice(0, 3);

        if (items.length === 0) {
            container.innerHTML = `
                <div class="home-empty-state">
                    <div class="home-empty-title">No recent activity yet</div>
                    <div class="home-empty-copy">Start with Reading or choose a maths module below, and shortcuts will appear here automatically.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => {
            if (item.type === 'story') {
                return `
                    <button class="home-resume-card" data-kind="story" data-story-id="${item.storyId}" data-page="${item.page}">
                        <div class="home-resume-top">
                            <span class="home-resume-icon">📖</span>
                            <span class="home-resume-chip">Reading</span>
                        </div>
                        <div class="home-resume-title">${item.title}</div>
                        <div class="home-resume-meta">Page ${item.page + 1} of ${item.totalPages} · ${item.levelName}</div>
                        <div class="home-resume-foot">${item.cta}</div>
                    </button>
                `;
            }

            return `
                <button class="home-resume-card" data-kind="module" data-module-id="${item.moduleId}" data-level-id="${item.levelId || ''}" data-mode="${item.mode || ''}">
                    <div class="home-resume-top">
                        <span class="home-resume-icon">${item.icon || '➕'}</span>
                        <span class="home-resume-chip">Maths</span>
                    </div>
                    <div class="home-resume-title">${item.title}</div>
                    <div class="home-resume-meta">${item.levelName || 'Start here'}${item.modeLabel ? ' · ' + item.modeLabel : ''}</div>
                    <div class="home-resume-foot">${item.cta}</div>
                </button>
            `;
        }).join('');
    }

    _renderHomeLearningAreas() {
        const mathsHub = document.getElementById('home-maths-hub');
        const readingHub = document.getElementById('home-reading-hub');
        const urduHub = document.getElementById('home-urdu-hub');
        const bookmarks = Object.values(state.get('bookmarks') || {});
        const readStories = state.get('readStories') || [];
        const totalTime = this.progressManager.getTotalPracticeTime();
        const streak = this.progressManager.getStreak();
        const recentMaths = this._getRecentMathsItem();
        const recentStory = this._getRecentStoryItem();
        const recentUrdu = this._getRecentUrduItem();
        const urduBookmarks = Object.keys(state.get('bookmarks') || {}).filter(storyId => this._isUrduStory(storyId)).length;

        mathsHub.innerHTML = `
            <div class="learning-area-top">
                <span class="learning-area-icon">🧮</span>
                <span class="learning-area-badge">Main area</span>
            </div>
            <div class="learning-area-title">Maths</div>
            <div class="learning-area-copy">Six maths skills with gentle practice and tests.</div>
            <div class="learning-area-stats">${totalTime} minutes practised · ${streak} day${streak !== 1 ? 's' : ''} streak</div>
            <div class="learning-area-foot">${recentMaths ? 'Continue ' + recentMaths.title : 'Choose a maths skill'} </div>
        `;

        readingHub.innerHTML = `
            <div class="learning-area-top">
                <span class="learning-area-icon">📚</span>
                <span class="learning-area-badge">Stories</span>
            </div>
            <div class="learning-area-title">Reading</div>
            <div class="learning-area-copy">Story library, bookmarks, and longer books.</div>
            <div class="learning-area-stats">${bookmarks.length} bookmarked · ${readStories.length} finished</div>
            <div class="learning-area-foot">${recentStory ? 'Continue ' + recentStory.title : 'Open the reading library'} </div>
        `;

        urduHub.innerHTML = `
            <div class="learning-area-top">
                <span class="learning-area-icon">اُ</span>
                <span class="learning-area-badge">Language</span>
            </div>
            <div class="learning-area-title">Urdu</div>
            <div class="learning-area-copy">Urdu stories and reading practice in a dedicated space.</div>
            <div class="learning-area-stats">${urduBookmarks} bookmarked · ${this.urduLevels.length} level${this.urduLevels.length !== 1 ? 's' : ''}</div>
            <div class="learning-area-foot">${recentUrdu ? 'Continue ' + recentUrdu.title : 'Open Urdu reading'} </div>
        `;
    }

    _renderHomeModules() {
        const grid = document.getElementById('module-grid');
        grid.classList.remove('hidden');
        grid.innerHTML = '';

        this.modules.forEach(module => {
            const summary = this.progressManager.getModuleSummary(module.id);
            const recentLevel = this._getMostRecentLevelInfo(module.id);
            const totalLevels = module.levels.length;
            const progressPercent = totalLevels > 0 ? Math.round((summary.levelsAttempted / totalLevels) * 100) : 0;
            const statusLine = recentLevel ? `Continue ${recentLevel.levelName}` : 'Start here';
            const secondaryLine = summary.lastPracticed
                ? `Last practised ${this._formatLastPracticed(summary.lastPracticed)}`
                : `${totalLevels} levels ready`;

            const btn = document.createElement('button');
            btn.className = 'module-btn';
            btn.dataset.module = module.id;
            btn.innerHTML = `
                <div class="module-card-top">
                    <span class="module-icon">${module.icon}</span>
                    <div class="module-copy">
                        <span class="module-name">${module.name}</span>
                        <span class="module-meta">${statusLine}</span>
                    </div>
                </div>
                <div class="module-progress-track">
                    <div class="module-progress-fill" style="width:${progressPercent}%"></div>
                </div>
                <div class="module-card-bottom">
                    <span class="module-secondary">${secondaryLine}</span>
                    <span class="module-secondary">${summary.totalProblems || 0} problems</span>
                </div>
            `;
            btn.addEventListener('click', () => this._selectModule(module.id));
            grid.appendChild(btn);
        });

    }

    _getPrimaryNextUp() {
        const currentSession = state.get('currentSession');
        if (currentSession?.module === 'reading') {
            return this._getRecentStoryItem() || this._getResumeItems()[0] || null;
        }
        if (currentSession?.module) {
            return this._buildModuleResumeItem(currentSession.module, state.get('currentLevel'), currentSession.mode, currentSession.startTime);
        }
        return this._getResumeItems()[0] || null;
    }

    _getResumeItems() {
        const items = [];
        const seen = new Set();
        const bookmarks = state.get('bookmarks') || {};

        Object.entries(bookmarks)
            .sort((a, b) => (b[1].date || '').localeCompare(a[1].date || ''))
            .forEach(([storyId, bm]) => {
                const item = this._buildStoryResumeItem(storyId, bm.page, bm.date);
                if (item && !seen.has(item.key)) {
                    seen.add(item.key);
                    items.push(item);
                }
            });

        (state.get('recentItems') || []).forEach(raw => {
            let item = null;
            if (raw.type === 'story') {
                const page = bookmarks[raw.storyId]?.page ?? raw.page ?? 0;
                item = this._buildStoryResumeItem(raw.storyId, page, raw.updatedAt);
            } else if (raw.type === 'module') {
                item = this._buildModuleResumeItem(raw.moduleId, raw.levelId, raw.mode, raw.updatedAt);
            }

            if (item && !seen.has(item.key) && items.length < 4) {
                seen.add(item.key);
                items.push(item);
            }
        });

        return items.slice(0, 4);
    }

    _getRecentStoryItem() {
        return this._getResumeItems().find(item => item.type === 'story' && !this._isUrduStory(item.storyId)) || null;
    }

    _getRecentMathsItem() {
        return this._getResumeItems().find(item => item.type === 'module') || null;
    }

    _getRecentUrduItem() {
        return this._getResumeItems().find(item => item.type === 'story' && this._isUrduStory(item.storyId)) || null;
    }

    _isUrduStory(storyId) {
        return this.urduLevels.some(level => level.stories.some(story => story.id === storyId));
    }

    _buildStoryResumeItem(storyId, page = 0, date = null) {
        const storyMatch = this._findStoryById(storyId);
        if (!storyMatch) return null;

        return {
            key: `story:${storyId}`,
            type: 'story',
            storyId,
            page: Math.max(0, Math.min(page || 0, storyMatch.story.pages.length - 1)),
            totalPages: storyMatch.story.pages.length,
            title: storyMatch.story.title,
            levelName: storyMatch.level.name,
            updatedAt: date || new Date().toISOString(),
            cta: 'Resume'
        };
    }

    _buildModuleResumeItem(moduleId, levelId, mode = null, updatedAt = null) {
        const module = this.modules.find(m => m.id === moduleId);
        if (!module) return null;

        const fallbackLevel = this._getMostRecentLevelInfo(moduleId)?.levelId || module.levels[0]?.id || null;
        const resolvedLevelId = levelId || fallbackLevel;
        const level = module.levels.find(l => l.id === resolvedLevelId) || module.levels[0];

        return {
            key: `module:${moduleId}`,
            type: 'module',
            moduleId,
            levelId: level?.id || null,
            mode,
            modeLabel: mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : '',
            title: module.name,
            icon: module.icon,
            levelName: level?.name || 'Choose level',
            updatedAt: updatedAt || new Date().toISOString(),
            cta: mode ? `Continue ${mode}` : 'Open module'
        };
    }

    _getMostRecentLevelInfo(moduleId) {
        const moduleProgress = state.get(`moduleProgress.${moduleId}`) || {};
        let best = null;

        Object.entries(moduleProgress).forEach(([levelId, info]) => {
            if (!info?.lastPracticed) return;
            if (!best || info.lastPracticed > best.lastPracticed) {
                const module = this.modules.find(m => m.id === moduleId);
                const level = module?.levels.find(l => l.id === levelId);
                best = {
                    levelId,
                    levelName: level?.name || levelId,
                    lastPracticed: info.lastPracticed
                };
            }
        });

        return best;
    }

    _findStoryById(storyId) {
        const allLevels = [...this.storyLevels, ...this.libraryLevels, ...this.urduLevels];
        for (const level of allLevels) {
            const story = level.stories.find(s => s.id === storyId);
            if (story) {
                return { story, level };
            }
        }
        return null;
    }

    _recordRecentItem(item) {
        if (!item?.key) return;
        const existing = state.get('recentItems') || [];
        const next = [
            { ...item, updatedAt: new Date().toISOString() },
            ...existing.filter(entry => entry.key !== item.key)
        ].slice(0, 8);
        state.set('recentItems', next);
    }

    _handleHomeShortcutClick(e) {
        const target = e.target.closest('[data-kind]');
        if (!target) return;

        const kind = target.dataset.kind;
        if (kind === 'story') {
            this._startStory(target.dataset.storyId, parseInt(target.dataset.page || '0', 10));
            return;
        }

        if (kind === 'module') {
            this._launchModule(target.dataset.moduleId, target.dataset.levelId || null, target.dataset.mode || null);
            return;
        }

        if (kind === 'screen' && target.dataset.screen) {
            this._showScreen(target.dataset.screen);
        }
    }

    _launchModule(moduleId, levelId = null, mode = null) {
        state.set('currentModule', moduleId);
        if (levelId) {
            state.set('currentLevel', levelId);
        } else {
            const module = this.modules.find(m => m.id === moduleId);
            if (module?.levels?.length) {
                state.set('currentLevel', module.levels[0].id);
            }
        }

        if (mode) {
            this._startMode(mode);
        } else {
            this._showScreen('module');
        }
    }

    _selectModule(moduleId) {
        this._recordRecentItem(this._buildModuleResumeItem(moduleId, null, null));
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

        const additionContent = document.getElementById('addition-content');
        const levelSelector = document.querySelector('#module-screen .level-selector');
        const modeButtons = document.querySelector('#module-screen .mode-buttons');

        if (moduleId === 'addition') {
            // Show addition-specific layout
            levelSelector.classList.add('hidden');
            modeButtons.classList.add('hidden');
            additionContent.classList.remove('hidden');
            this._renderAdditionModuleScreen(module);
            return;
        }

        // Standard module layout
        additionContent.classList.add('hidden');
        levelSelector.classList.remove('hidden');
        modeButtons.classList.remove('hidden');

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

    _renderAdditionModuleScreen(module) {
        const mastery = state.get('additionMastery') || {};
        const gridContainer = document.getElementById('addition-grid-container');
        const diffContainer = document.getElementById('addition-difficulty');

        // Build 20x20 grid
        let gridHTML = '<div class="child-mastery-wrapper"><table class="child-mastery-grid">';

        // Header row
        gridHTML += '<tr><th class="grid-corner">+</th>';
        for (let b = 1; b <= 20; b++) {
            gridHTML += `<th>${b}</th>`;
        }
        gridHTML += '</tr>';

        // Data rows
        for (let a = 1; a <= 20; a++) {
            gridHTML += `<tr><th>${a}</th>`;
            for (let b = 1; b <= 20; b++) {
                const key = `${a}+${b}`;
                const data = mastery[key];
                let cls = 'cell-unseen';
                if (data && data.correct >= 3) cls = 'cell-mastered';
                else if (data && data.attempts > 0) cls = 'cell-attempted';
                gridHTML += `<td class="${cls}"></td>`;
            }
            gridHTML += '</tr>';
        }
        gridHTML += '</table></div>';

        // Summary
        let total = 0, masteredCount = 0;
        for (let a = 1; a <= 20; a++) {
            for (let b = 1; b <= 20; b++) {
                total++;
                const d = mastery[`${a}+${b}`];
                if (d && d.correct >= 3) masteredCount++;
            }
        }
        gridHTML += `<p class="grid-summary">${masteredCount} of ${total} mastered</p>`;

        gridContainer.innerHTML = gridHTML;

        // Difficulty buttons
        diffContainer.innerHTML = '';
        const difficulties = [
            { level: 'L1', name: 'Easy', range: '1 to 5', max: 5, color: 'easy' },
            { level: 'L2', name: 'Medium', range: '1 to 10', max: 10, color: 'medium' },
            { level: 'L3', name: 'Hard', range: '1 to 20', max: 20, color: 'hard' }
        ];

        difficulties.forEach(diff => {
            // Count mastered in this range
            let rangeTotal = diff.max * diff.max;
            let rangeMastered = 0;
            for (let a = 1; a <= diff.max; a++) {
                for (let b = 1; b <= diff.max; b++) {
                    const d = mastery[`${a}+${b}`];
                    if (d && d.correct >= 3) rangeMastered++;
                }
            }

            const btn = document.createElement('button');
            btn.className = `difficulty-btn difficulty-${diff.color}`;
            btn.innerHTML = `
                <span class="diff-name">${diff.name}</span>
                <span class="diff-range">${diff.range}</span>
                <span class="diff-progress">${rangeMastered}/${rangeTotal}</span>
            `;
            btn.addEventListener('click', () => {
                state.set('currentLevel', diff.level);
                this._startMode('practice');
            });
            diffContainer.appendChild(btn);
        });
    }

    // ===== MODE STARTING =====

    _startMode(mode) {
        state.set('currentMode', mode);
        this._recordRecentItem(this._buildModuleResumeItem(
            state.get('currentModule'),
            state.get('currentLevel'),
            mode
        ));

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

        // Generate problem (pass mastery data for addition)
        const mastery = moduleId === 'addition' ? (state.get('additionMastery') || {}) : null;
        this.currentProblem = this.problemGenerator.generate(moduleId, level.config, mastery);

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

        // Track addition mastery
        if (this.currentProblem.pairKey) {
            const mastery = state.get('additionMastery') || {};
            const key = this.currentProblem.pairKey;
            if (!mastery[key]) {
                mastery[key] = { correct: 0, attempts: 0 };
            }
            mastery[key].attempts++;
            if (userAnswer === this.currentProblem.answer) {
                mastery[key].correct++;
            }
            state.set('additionMastery', mastery);
        }

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
        const mastery = moduleId === 'addition' ? (state.get('additionMastery') || {}) : null;
        this.testProblems = [];
        for (let i = 0; i < 10; i++) {
            this.testProblems.push(this.problemGenerator.generate(moduleId, level.config, mastery));
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

        // Track addition mastery
        if (problem.pairKey) {
            const mastery = state.get('additionMastery') || {};
            const key = problem.pairKey;
            if (!mastery[key]) {
                mastery[key] = { correct: 0, attempts: 0 };
            }
            mastery[key].attempts++;
            if (correct) {
                mastery[key].correct++;
            }
            state.set('additionMastery', mastery);
        }

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

        // Addition mastery grid
        this._renderMasteryGrid(container);
    }

    _renderMasteryGrid(container) {
        const mastery = state.get('additionMastery') || {};

        // Count stats for full 20x20
        let totalPairs = 0;
        let masteredCount = 0;
        let attemptedCount = 0;

        for (let a = 1; a <= 20; a++) {
            for (let b = 1; b <= 20; b++) {
                totalPairs++;
                const data = mastery[`${a}+${b}`];
                if (data && data.correct >= 3) {
                    masteredCount++;
                } else if (data && data.attempts > 0) {
                    attemptedCount++;
                }
            }
        }

        const section = document.createElement('div');
        section.className = 'mastery-section';

        const header = document.createElement('h4');
        header.textContent = 'Addition Mastery';
        section.appendChild(header);

        const summary = document.createElement('div');
        summary.className = 'mastery-summary';
        summary.innerHTML = `
            <span class="mastery-stat mastery-green">${masteredCount} mastered</span>
            <span class="mastery-stat mastery-amber">${attemptedCount} in progress</span>
            <span class="mastery-stat mastery-grey">${totalPairs - masteredCount - attemptedCount} unseen</span>
            <span class="mastery-stat">${masteredCount} / ${totalPairs}</span>
        `;
        section.appendChild(summary);

        // Build 20x20 grid table
        const wrapper = document.createElement('div');
        wrapper.className = 'mastery-grid-wrapper';

        const table = document.createElement('table');
        table.className = 'mastery-grid';

        // Header row with + and column numbers
        const thead = document.createElement('tr');
        thead.innerHTML = '<th>+</th>';
        for (let b = 1; b <= 20; b++) {
            thead.innerHTML += `<th>${b}</th>`;
        }
        table.appendChild(thead);

        // Data rows
        for (let a = 1; a <= 20; a++) {
            const row = document.createElement('tr');
            row.innerHTML = `<th>${a}</th>`;

            for (let b = 1; b <= 20; b++) {
                const key = `${a}+${b}`;
                const data = mastery[key];
                let cls = 'mastery-unseen';

                if (data && data.correct >= 3) {
                    cls = 'mastery-mastered';
                } else if (data && data.attempts > 0) {
                    cls = 'mastery-attempted';
                }

                row.innerHTML += `<td class="${cls}" title="${a}+${b}=${a + b}"></td>`;
            }

            table.appendChild(row);
        }

        wrapper.appendChild(table);
        section.appendChild(wrapper);
        container.appendChild(section);
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
            const { stateKey } = this._getReadingSourceConfig();
            state.set(stateKey, e.target.value);
            this._renderStoryList();
        });

        // Story navigation
        document.getElementById('story-prev-btn').addEventListener('click', () => this._storyPrevPage());
        document.getElementById('story-next-btn').addEventListener('click', () => this._storyNextPage());

        // Story swipe navigation (storybook-style page turns)
        const storyContent = document.getElementById('story-content');
        storyContent.addEventListener('touchstart', (e) => {
            if (!this.currentStory || e.touches.length !== 1) return;
            this._storyTouchStartX = e.touches[0].clientX;
            this._storyTouchStartY = e.touches[0].clientY;
        }, { passive: true });

        storyContent.addEventListener('touchend', (e) => {
            if (!this.currentStory || e.changedTouches.length !== 1) return;

            const deltaX = e.changedTouches[0].clientX - this._storyTouchStartX;
            const deltaY = e.changedTouches[0].clientY - this._storyTouchStartY;
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);

            // Only trigger when the gesture is clearly horizontal
            if (absX < 50 || absX <= absY * 1.25) return;

            if (deltaX < 0) {
                this._storyNextPage();
            } else {
                this._storyPrevPage();
            }
        }, { passive: true });

        // Bookmark button
        document.getElementById('bookmark-btn').addEventListener('click', () => {
            if (!this.currentStory) return;
            const bookmarks = state.get('bookmarks') || {};
            if (bookmarks[this.currentStory.id]) {
                this._removeBookmark();
            } else {
                this._saveBookmark();
            }
        });

        document.getElementById('story-text').addEventListener('click', (e) => {
            const wordBtn = e.target.closest('.urdu-word-button');
            if (!wordBtn || !this.currentStory) return;
            this._selectUrduWord(wordBtn.dataset.word, wordBtn.dataset.meaning);
        });

        document.getElementById('urdu-translation-toggle-btn').addEventListener('click', () => {
            this._showUrduTranslation = !this._showUrduTranslation;
            this._renderUrduSupportPanel();
        });

        document.getElementById('urdu-saved-toggle-btn').addEventListener('click', () => {
            this._showUrduSavedWords = !this._showUrduSavedWords;
            this._renderUrduSupportPanel();
        });

        document.getElementById('urdu-save-word-btn').addEventListener('click', () => {
            this._saveSelectedUrduWord();
        });

        document.getElementById('urdu-saved-words-panel').addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-remove-urdu-word]');
            if (removeBtn) {
                this._removeUrduSavedWord(removeBtn.dataset.removeUrduWord);
            }
        });

        // Delegated click for story cards
        document.getElementById('story-list').addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-urdu-story-action]');
            if (actionBtn) {
                const storyId = actionBtn.dataset.storyId;
                const action = actionBtn.dataset.urduStoryAction;

                if (action === 'open' && storyId) {
                    const row = actionBtn.closest('[data-story-id]');
                    const resumePage = row?.dataset.resumePage;
                    this._startStory(storyId, resumePage ? parseInt(resumePage) : undefined);
                } else if (action === 'archive' && storyId) {
                    this._archiveUrduStory(storyId);
                } else if (action === 'restore' && storyId) {
                    this._restoreUrduStory(storyId);
                } else if (action === 'toggle-archive') {
                    state.set('showArchivedUrdu', !state.get('showArchivedUrdu'));
                    this._renderStoryList();
                }
                return;
            }

            const card = e.target.closest('.story-card');
            if (card) {
                const resumePage = card.dataset.resumePage;
                this._startStory(card.dataset.storyId, resumePage ? parseInt(resumePage) : undefined);
            }

            const urduRow = e.target.closest('.urdu-item-row');
            if (urduRow) {
                const resumePage = urduRow.dataset.resumePage;
                this._startStory(urduRow.dataset.storyId, resumePage ? parseInt(resumePage) : undefined);
            }
        });
    }

    _archiveUrduStory(storyId) {
        const archived = new Set(state.get('archivedUrduStoryIds') || []);
        archived.add(storyId);
        state.set('archivedUrduStoryIds', Array.from(archived));
        if (state.get('currentUrduStoryId') === storyId) {
            state.set('currentUrduStoryId', null);
        }
        this._renderStoryList();
    }

    _restoreUrduStory(storyId) {
        const archived = (state.get('archivedUrduStoryIds') || []).filter(id => id !== storyId);
        state.set('archivedUrduStoryIds', archived);
        state.set('showArchivedUrdu', true);
        this._renderStoryList();
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
        const { levels, stateKey, attribution } = this._getReadingSourceConfig(tab);

        const select = document.getElementById('reading-level-select');
        const levelSelector = document.querySelector('#reading-screen .level-selector');

        if (tab === 'urdu') {
            levelSelector.classList.add('hidden');
        } else {
            levelSelector.classList.remove('hidden');
        }

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
        if (attribution) {
            attr.textContent = attribution;
            attr.classList.remove('hidden');
        } else {
            attr.classList.add('hidden');
        }
    }

    _getAllUrduStories() {
        return this.urduLevels.flatMap(level =>
            level.stories.map(story => ({
                ...story,
                _levelName: level.name
            }))
        );
    }

    _getUrduStoryProgress(story) {
        const bookmarks = state.get('bookmarks') || {};
        const readStories = state.get('readStories') || [];
        const bookmark = bookmarks[story.id];
        const totalPages = Math.max(story.pages?.length || 1, 1);
        const isFinished = readStories.includes(story.id);
        const currentPage = isFinished ? totalPages : ((bookmark?.page ?? -1) + 1);
        const percent = isFinished
            ? 100
            : bookmark
                ? Math.max(1, Math.min(99, Math.round(((bookmark.page + 1) / totalPages) * 100)))
                : 0;
        const status = isFinished ? 'Finished' : bookmark ? 'In progress' : 'New';

        return {
            bookmark,
            currentPage: Math.max(0, Math.min(currentPage, totalPages)),
            totalPages,
            percent,
            status,
            isFinished
        };
    }

    _formatUrduPublishedDate(story) {
        if (story.publishedAt) {
            const date = new Date(story.publishedAt);
            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
            }
        }

        if (story.sourceType === 'news') return 'Undated article';
        if (story.sourceType === 'poem') return 'Classic poem';
        if (story.sourceType === 'fairy-tale') return 'Classic tale';
        if (story.sourceType === 'folk-tale') return 'Classic folk tale';
        return story._levelName || 'Library item';
    }

    _buildUrduStoryRow(story, { archived = false, current = false } = {}) {
        const progress = this._getUrduStoryProgress(story);
        const resumePage = progress.bookmark?.page;
        const sourceLine = [story.source, this._formatUrduPublishedDate(story)].filter(Boolean).join(' • ');
        const progressLine = `${progress.percent}% complete • ${progress.currentPage || 0}/${progress.totalPages} pages`;
        const status = current ? 'Current' : archived ? 'Archived' : progress.status;
        const actionLabel = archived ? 'Restore' : 'Archive';

        return `
            <div class="urdu-item-row ${current ? 'is-current' : ''}" data-story-id="${story.id}" ${resumePage !== undefined ? `data-resume-page="${resumePage}"` : ''}>
                <div class="urdu-item-progress" aria-hidden="true">
                    <div class="urdu-item-progress-ring" style="--urdu-progress:${progress.percent}%">
                        <span>${progress.percent}%</span>
                    </div>
                </div>
                <div class="urdu-item-main">
                    <div class="urdu-item-title-wrap">
                        <div class="urdu-item-title" dir="rtl">${this._escapeHtml(story.title)}</div>
                        ${story.titleEnglish ? `<div class="urdu-item-subtitle">${this._escapeHtml(story.titleEnglish)}</div>` : ''}
                    </div>
                    <div class="urdu-item-meta">${this._escapeHtml(sourceLine)}</div>
                    <div class="urdu-item-meta urdu-item-progress-line">${this._escapeHtml(progressLine)} • ${this._escapeHtml(status)}</div>
                </div>
                <div class="urdu-item-actions">
                    <button class="primary-btn urdu-item-action" type="button" data-urdu-story-action="open" data-story-id="${story.id}">${progress.status === 'New' ? 'Open' : 'Continue'}</button>
                    <button class="secondary-btn urdu-item-action" type="button" data-urdu-story-action="${archived ? 'restore' : 'archive'}" data-story-id="${story.id}">${actionLabel}</button>
                </div>
            </div>
        `;
    }

    _renderUrduStoryList(list) {
        const archivedIds = new Set(state.get('archivedUrduStoryIds') || []);
        const currentId = state.get('currentUrduStoryId');
        const showArchived = !!state.get('showArchivedUrdu');
        const stories = this._getAllUrduStories();

        const ranked = stories.map(story => {
            const progress = this._getUrduStoryProgress(story);
            const updatedAt = progress.bookmark?.date || story.publishedAt || '';
            return { story, progress, updatedAt };
        }).sort((a, b) => {
            const aCurrent = a.story.id === currentId ? 1 : 0;
            const bCurrent = b.story.id === currentId ? 1 : 0;
            if (bCurrent !== aCurrent) return bCurrent - aCurrent;
            if (b.progress.percent !== a.progress.percent) return b.progress.percent - a.progress.percent;
            return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        });

        const activeStories = ranked.filter(item => !archivedIds.has(item.story.id)).map(item => item.story);
        const archivedStories = ranked.filter(item => archivedIds.has(item.story.id)).map(item => item.story);
        const currentStory = activeStories.find(story => story.id === currentId) || activeStories.find(story => this._getUrduStoryProgress(story).status === 'In progress') || null;
        const activeList = activeStories.filter(story => story.id !== currentStory?.id);

        list.innerHTML = `
            <section class="urdu-library-section urdu-current-section ${currentStory ? '' : 'hidden'}">
                <div class="urdu-library-heading-row">
                    <div>
                        <div class="urdu-library-kicker">Current item</div>
                        <h3 class="urdu-library-heading">Currently reading</h3>
                    </div>
                </div>
                ${currentStory ? this._buildUrduStoryRow(currentStory, { current: true }) : ''}
            </section>

            <section class="urdu-library-section">
                <div class="urdu-library-heading-row">
                    <div>
                        <div class="urdu-library-kicker">Active Urdu items</div>
                        <h3 class="urdu-library-heading">Urdu library</h3>
                    </div>
                    <div class="urdu-library-count">${activeStories.length} items</div>
                </div>
                <div class="urdu-library-list">
                    ${activeList.length
                        ? activeList.map(story => this._buildUrduStoryRow(story)).join('')
                        : '<div class="urdu-library-empty">No other active Urdu items yet.</div>'}
                </div>
            </section>

            <section class="urdu-library-section ${archivedStories.length ? '' : 'hidden'}">
                <div class="urdu-library-heading-row">
                    <div>
                        <div class="urdu-library-kicker">Archive</div>
                        <h3 class="urdu-library-heading">Older items kept out of the way</h3>
                    </div>
                    <button class="secondary-btn urdu-archive-toggle" type="button" data-urdu-story-action="toggle-archive">${showArchived ? 'Hide archive' : `Show archive (${archivedStories.length})`}</button>
                </div>
                <div class="urdu-library-list ${showArchived ? '' : 'hidden'}" id="urdu-archive-list">
                    ${archivedStories.map(story => this._buildUrduStoryRow(story, { archived: true })).join('')}
                </div>
            </section>
        `;
    }

    _renderStoryList() {
        const tab = state.get('readingTab') || 'library';
        const { stateKey, levels } = this._getReadingSourceConfig(tab);
        const levelId = state.get(stateKey);
        const level = levels.find(l => l.id === levelId);
        const list = document.getElementById('story-list');
        list.innerHTML = '';

        if (tab === 'urdu') {
            this._renderUrduStoryList(list);
            return;
        }

        if (!level) return;

        const readStories = state.get('readStories') || [];
        const bookmarks = state.get('bookmarks') || {};

        level.stories.forEach(story => {
            const isRead = readStories.includes(story.id);
            const hasImages = story.pages[0]?.image;
            const bm = bookmarks[story.id];
            const card = document.createElement('div');
            card.className = 'story-card';
            card.dataset.storyId = story.id;
            card.dataset.source = tab;
            if (bm) card.dataset.resumePage = bm.page;
            const dir = story.direction || 'ltr';
            const metaLine = tab === 'urdu'
                ? `${story.pages.length} pages${story.source ? ' · ' + story.source : ''}${story.ageHint ? ' · ' + story.ageHint : ''}`
                : `${story.pages.length} pages${story.author ? ' · ' + story.author : ''}`;
            card.innerHTML = `
                <span class="story-card-icon">${hasImages ? '\u{1F5BC}\uFE0F' : '\u{1F4D6}'}</span>
                <div class="story-card-info">
                    <div class="story-card-title" dir="${dir}">${story.title}</div>
                    ${story.titleEnglish ? `<div class="story-card-subtitle">${story.titleEnglish}</div>` : ''}
                    <div class="story-card-pages">${metaLine}</div>
                    ${bm ? `<div class="story-card-bookmark">\u{1F516} Page ${bm.page + 1} of ${bm.total}</div>` : ''}
                </div>
                <span class="story-card-status">${isRead ? '\u2705' : ''}</span>
            `;
            list.appendChild(card);
        });
    }

    _startStory(storyId, resumePage) {
        // Find story across all level sources
        const allLevels = [...this.storyLevels, ...this.libraryLevels, ...this.urduLevels];
        for (const level of allLevels) {
            const story = level.stories.find(s => s.id === storyId);
            if (story) {
                this.currentStory = story;
                // Resume from bookmark if available
                if (resumePage !== undefined) {
                    this.currentStoryPage = resumePage;
                } else {
                    const bookmarks = state.get('bookmarks') || {};
                    const bm = bookmarks[storyId];
                    this.currentStoryPage = bm ? bm.page : 0;
                }

                this._recordRecentItem(this._buildStoryResumeItem(storyId, this.currentStoryPage));

                if (this._isUrduStory(storyId)) {
                    state.set('currentUrduStoryId', storyId);
                    state.set('archivedUrduStoryIds', (state.get('archivedUrduStoryIds') || []).filter(id => id !== storyId));
                }

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
        const direction = story.direction || 'ltr';
        const isInteractiveUrdu = this._storySupportsUrduTools(story);

        const storyTitle = document.getElementById('story-title');
        const storyTitleSubtitle = document.getElementById('story-title-subtitle');
        const storyText = document.getElementById('story-text');

        storyTitle.textContent = story.title;
        storyTitle.dir = direction;
        if (story.titleEnglish) {
            storyTitleSubtitle.textContent = story.titleEnglish;
            storyTitleSubtitle.classList.remove('hidden');
        } else {
            storyTitleSubtitle.textContent = '';
            storyTitleSubtitle.classList.add('hidden');
        }
        if (isInteractiveUrdu) {
            storyText.innerHTML = this._renderInteractiveUrduText(page.text, story.vocabulary || {});
        } else {
            storyText.textContent = page.text;
        }
        storyText.dir = direction;
        document.getElementById('story-page-text').textContent =
            `Page ${this.currentStoryPage + 1} of ${story.pages.length}`;
        document.getElementById('story-progress-fill').style.width =
            `${((this.currentStoryPage + 1) / story.pages.length) * 100}%`;

        // Show/hide illustration
        const img = document.getElementById('story-image');
        const storyContent = document.getElementById('story-content');
        storyContent.classList.toggle('urdu-story-layout', isInteractiveUrdu);
        if (page.image) {
            img.src = page.image;
            img.alt = page.imageAlt || `Illustration for ${story.title}`;
            img.classList.remove('hidden');
            storyContent.classList.add('has-image');
            storyContent.classList.toggle('side-image-layout', page.imageLayout === 'side');
        } else {
            img.classList.add('hidden');
            img.src = '';
            img.alt = '';
            storyContent.classList.remove('has-image');
            storyContent.classList.remove('side-image-layout');
        }

        // Reset scroll position so each new page starts at the top
        storyContent.scrollTop = 0;

        if (!isInteractiveUrdu) {
            this._selectedUrduWord = null;
            this._showUrduTranslation = false;
            this._showUrduSavedWords = false;
        }
        this._renderUrduSupportPanel();

        // Show/hide nav buttons
        document.getElementById('story-prev-btn').style.visibility =
            this.currentStoryPage > 0 ? 'visible' : 'hidden';

        const nextBtn = document.getElementById('story-next-btn');
        if (this.currentStoryPage >= story.pages.length - 1) {
            nextBtn.textContent = 'Finish \u2713';
        } else {
            nextBtn.innerHTML = 'Next &rarr;';
        }

        // Update bookmark button state
        this._updateBookmarkButton();
    }

    _storySupportsUrduTools(story = this.currentStory) {
        return !!(story && story.direction === 'rtl' && story.vocabulary && Object.keys(story.vocabulary).length > 0);
    }

    _escapeHtml(text = '') {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _renderInteractiveUrduText(text, vocabulary) {
        const escapedText = this._escapeHtml(text || '');
        const sortedWords = Object.keys(vocabulary || {}).sort((a, b) => b.length - a.length);
        const placeholders = [];
        let rendered = escapedText;

        sortedWords.forEach((word, index) => {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const placeholder = `__URDU_WORD_${index}__`;
            const safeWord = this._escapeHtml(word);
            const safeMeaning = this._escapeHtml(vocabulary[word]);
            const buttonHtml = `<button class="urdu-word-button" data-word="${safeWord}" data-meaning="${safeMeaning}" type="button">${safeWord}</button>`;
            placeholders.push({ placeholder, buttonHtml });
            rendered = rendered.replace(new RegExp(escapedWord, 'g'), placeholder);
        });

        placeholders.forEach(({ placeholder, buttonHtml }) => {
            rendered = rendered.replaceAll(placeholder, buttonHtml);
        });

        return rendered.replace(/\n/g, '<br>');
    }

    _selectUrduWord(word, meaning) {
        this._selectedUrduWord = { word, meaning };
        this._renderUrduSupportPanel();
        document.querySelectorAll('.urdu-word-button.active').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll(`.urdu-word-button[data-word="${CSS.escape(word)}"]`).forEach(btn => btn.classList.add('active'));
    }

    _getUrduSavedWords() {
        return state.get('urduSavedWords') || [];
    }

    _isSelectedUrduWordSaved(savedWords = this._getUrduSavedWords()) {
        if (!this._selectedUrduWord) return false;
        const key = `${this._selectedUrduWord.word}::${this._selectedUrduWord.meaning}`;
        return savedWords.some(item => item.key === key);
    }

    _saveSelectedUrduWord() {
        if (!this._selectedUrduWord || !this.currentStory) return;
        const existing = this._getUrduSavedWords();
        const key = `${this._selectedUrduWord.word}::${this._selectedUrduWord.meaning}`;
        if (existing.some(item => item.key === key)) {
            this._showUrduSavedWords = true;
            this._renderUrduSupportPanel();
            return;
        }
        state.set('urduSavedWords', [
            {
                key,
                word: this._selectedUrduWord.word,
                meaning: this._selectedUrduWord.meaning,
                storyId: this.currentStory.id,
                storyTitle: this.currentStory.title
            },
            ...existing
        ].slice(0, 60));
        this._showUrduSavedWords = true;
        this._renderUrduSupportPanel();
    }

    _removeUrduSavedWord(key) {
        state.set('urduSavedWords', this._getUrduSavedWords().filter(item => item.key !== key));
        this._renderUrduSupportPanel();
    }

    _renderUrduSupportPanel() {
        const tools = document.getElementById('urdu-story-tools');
        const helper = document.getElementById('urdu-word-helper');
        const translation = document.getElementById('urdu-page-translation');
        const savedPanel = document.getElementById('urdu-saved-words-panel');
        const translationBtn = document.getElementById('urdu-translation-toggle-btn');
        const savedBtn = document.getElementById('urdu-saved-toggle-btn');
        const supportTitle = document.getElementById('urdu-support-title');
        const supportStatus = document.getElementById('urdu-support-status');
        const saveWordBtn = document.getElementById('urdu-save-word-btn');

        if (!this._storySupportsUrduTools()) {
            tools.classList.add('hidden');
            helper.classList.add('hidden');
            translation.classList.add('hidden');
            savedPanel.classList.add('hidden');
            translationBtn.classList.remove('is-active');
            savedBtn.classList.remove('is-active');
            translationBtn.setAttribute('aria-pressed', 'false');
            savedBtn.setAttribute('aria-pressed', 'false');
            document.querySelectorAll('.urdu-word-button.active').forEach(btn => btn.classList.remove('active'));
            return;
        }

        const page = this.currentStory.pages[this.currentStoryPage] || {};
        const savedWords = this._getUrduSavedWords();
        const wordAlreadySaved = this._isSelectedUrduWordSaved(savedWords);
        tools.classList.remove('hidden');
        translationBtn.textContent = this._showUrduTranslation ? 'Hide English help' : 'Show English help';
        savedBtn.textContent = `Saved words (${savedWords.length})`;
        translationBtn.classList.toggle('is-active', this._showUrduTranslation);
        savedBtn.classList.toggle('is-active', this._showUrduSavedWords);
        translationBtn.setAttribute('aria-pressed', this._showUrduTranslation ? 'true' : 'false');
        savedBtn.setAttribute('aria-pressed', this._showUrduSavedWords ? 'true' : 'false');

        if (this._selectedUrduWord) {
            helper.classList.remove('hidden');
            document.getElementById('urdu-word-helper-urdu').textContent = this._selectedUrduWord.word;
            document.getElementById('urdu-word-helper-english').textContent = this._selectedUrduWord.meaning;
            supportTitle.textContent = 'Selected word and meaning';
            supportStatus.textContent = `Selected: ${this._selectedUrduWord.word}`;
            saveWordBtn.disabled = wordAlreadySaved;
            saveWordBtn.textContent = wordAlreadySaved ? 'Saved ✓' : 'Save this word';
        } else {
            helper.classList.add('hidden');
            supportTitle.textContent = 'Tap a purple word for quick help.';
            supportStatus.textContent = 'No word selected yet';
            saveWordBtn.disabled = false;
            saveWordBtn.textContent = 'Save this word';
        }

        if (this._showUrduTranslation && page.translation) {
            translation.classList.remove('hidden');
            translation.innerHTML = `<div class="urdu-page-translation-label">English help for this page</div><p>${this._escapeHtml(page.translation).replace(/\n/g, '<br>')}</p>`;
        } else {
            translation.classList.add('hidden');
            translation.innerHTML = '';
        }

        if (this._showUrduSavedWords) {
            savedPanel.classList.remove('hidden');
            savedPanel.innerHTML = savedWords.length
                ? `<div class="urdu-saved-words-panel-label">Saved words</div>${savedWords.map(item => `
                    <div class="urdu-saved-word-row">
                        <div>
                            <div class="urdu-saved-word-urdu">${this._escapeHtml(item.word)}</div>
                            <div class="urdu-saved-word-english">${this._escapeHtml(item.meaning)}</div>
                            <div class="urdu-saved-word-story">${this._escapeHtml(item.storyTitle)}</div>
                        </div>
                        <button class="secondary-btn urdu-remove-word-btn" type="button" data-remove-urdu-word="${this._escapeHtml(item.key)}">Remove</button>
                    </div>
                `).join('')}`
                : '<div class="urdu-saved-words-panel-label">Saved words</div><div class="urdu-empty-state">Save a few words from a story and they will appear here.</div>';
        } else {
            savedPanel.classList.add('hidden');
            savedPanel.innerHTML = '';
        }
    }

    _storyPrevPage() {
        if (this.currentStoryPage > 0) {
            this.currentStoryPage--;
            this._renderStoryPage();
            this._autoSaveBookmark();
        }
    }

    _storyNextPage() {
        if (!this.currentStory) return;

        if (this.currentStoryPage < this.currentStory.pages.length - 1) {
            this.currentStoryPage++;
            this._renderStoryPage();
            this._autoSaveBookmark();
        } else {
            // Story complete — mark as read and clear bookmark
            const readStories = state.get('readStories') || [];
            if (!readStories.includes(this.currentStory.id)) {
                readStories.push(this.currentStory.id);
                state.set('readStories', readStories);
            }
            // Remove bookmark since story is finished
            const bookmarks = state.get('bookmarks') || {};
            if (bookmarks[this.currentStory.id]) {
                delete bookmarks[this.currentStory.id];
                state.set('bookmarks', bookmarks);
            }

            this.celebration.trigger();

            // Go back to reading level screen (timer keeps running)
            setTimeout(() => {
                this._showScreen('reading');
            }, 1500);
        }
    }

    // ===== SEARCH =====

    _bindSearchEvents() {
        const input = document.getElementById('search-input');
        const results = document.getElementById('search-results');
        const homeDashboard = document.getElementById('home-dashboard');

        input.addEventListener('input', () => {
            const query = input.value.trim().toLowerCase();
            if (query.length < 2) {
                results.classList.add('hidden');
                results.innerHTML = '';
                document.getElementById('module-grid').classList.remove('hidden');
                if (homeDashboard) homeDashboard.classList.remove('hidden');
                return;
            }
            this._renderSearchResults(query);
        });

        // Clear search when leaving home screen
        input.addEventListener('focus', () => {
            if (input.value.trim().length >= 2) {
                this._renderSearchResults(input.value.trim().toLowerCase());
            }
        });

        // Delegated click on search results
        results.addEventListener('click', (e) => {
            const card = e.target.closest('.search-result-card');
            if (card) {
                const storyId = card.dataset.storyId;
                const resumePage = card.dataset.resumePage;
                input.value = '';
                results.classList.add('hidden');
                results.innerHTML = '';
                document.getElementById('module-grid').classList.remove('hidden');
                if (homeDashboard) homeDashboard.classList.remove('hidden');
                this._startStory(storyId, resumePage ? parseInt(resumePage) : undefined);
            }
        });
    }

    _renderSearchResults(query) {
        const results = document.getElementById('search-results');
        const homeDashboard = document.getElementById('home-dashboard');
        const bookmarks = state.get('bookmarks') || {};
        const matches = this._storyIndex.filter(s =>
            s.title.toLowerCase().includes(query) ||
            s.author.toLowerCase().includes(query)
        );

        if (matches.length === 0) {
            results.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:var(--spacing-md);">No stories found</div>';
            results.classList.remove('hidden');
            document.getElementById('module-grid').classList.add('hidden');
            if (homeDashboard) homeDashboard.classList.add('hidden');
            return;
        }

        results.innerHTML = matches.map(s => {
            const bm = bookmarks[s.id];
            const bmText = bm ? `Page ${bm.page + 1} of ${s.pages}` : '';
            return `
                <div class="search-result-card" data-story-id="${s.id}" ${bm ? `data-resume-page="${bm.page}"` : ''}>
                    <span class="story-card-icon">\u{1F4D6}</span>
                    <div class="search-result-info">
                        <div class="search-result-title">${s.title}</div>
                        <div class="search-result-meta">${s.author ? s.author + ' \u00B7 ' : ''}${s.level} \u00B7 ${s.pages} pages</div>
                        ${bmText ? `<div class="search-result-bookmark">\u{1F516} ${bmText}</div>` : ''}
                    </div>
                </div>`;
        }).join('');

        results.classList.remove('hidden');
        if (homeDashboard) homeDashboard.classList.add('hidden');
        document.getElementById('module-grid').classList.add('hidden');
    }

    // ===== BOOKMARKS =====

    _saveBookmark() {
        if (!this.currentStory) return;
        const bookmarks = state.get('bookmarks') || {};
        bookmarks[this.currentStory.id] = {
            page: this.currentStoryPage,
            title: this.currentStory.title,
            total: this.currentStory.pages.length,
            date: new Date().toISOString()
        };
        state.set('bookmarks', bookmarks);
        this._updateBookmarkButton();
    }

    _removeBookmark() {
        if (!this.currentStory) return;
        const bookmarks = state.get('bookmarks') || {};
        delete bookmarks[this.currentStory.id];
        state.set('bookmarks', bookmarks);
        this._updateBookmarkButton();
    }

    _updateBookmarkButton() {
        const btn = document.getElementById('bookmark-btn');
        if (!this.currentStory) return;
        const bookmarks = state.get('bookmarks') || {};
        const hasBookmark = bookmarks[this.currentStory.id] !== undefined;
        btn.classList.toggle('active', hasBookmark);
        btn.title = hasBookmark ? 'Remove bookmark' : 'Bookmark this page';
    }

    _autoSaveBookmark() {
        if (!this.currentStory) return;
        const bookmarks = state.get('bookmarks') || {};
        // Auto-save if bookmark exists OR story has 20+ pages (long stories)
        if (bookmarks[this.currentStory.id] || this.currentStory.pages.length >= 20) {
            this._saveBookmark();
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
        const bar = document.getElementById('update-btn');
        const dot = bar.querySelector('.update-dot');
        const HOLD_DURATION = 1000;
        let pressTimer = null;
        let animFrame = null;
        let startTime = 0;

        const startPress = (e) => {
            e.preventDefault();
            startTime = Date.now();
            bar.classList.add('pressing');

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
                dot.style.setProperty('--press-progress', `${progress}%`);
                if (progress < 100) {
                    animFrame = requestAnimationFrame(animate);
                }
            };
            animFrame = requestAnimationFrame(animate);

            pressTimer = setTimeout(() => {
                bar.classList.remove('pressing');
                bar.classList.add('checking');
                this._checkForUpdates(bar);
            }, HOLD_DURATION);
        };

        const cancelPress = () => {
            clearTimeout(pressTimer);
            cancelAnimationFrame(animFrame);
            bar.classList.remove('pressing');
            dot.style.setProperty('--press-progress', '0%');
        };

        bar.addEventListener('pointerdown', startPress);
        bar.addEventListener('pointerup', cancelPress);
        bar.addEventListener('pointercancel', cancelPress);
        bar.addEventListener('pointerleave', cancelPress);
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

    _lockPortraitOrientation() {
        try {
            if (screen.orientation?.lock) {
                screen.orientation.lock('portrait-primary').catch(() => {});
            }
        } catch (_) {
            // Ignore unsupported browsers/platforms
        }
    }

    // ===== UTILITY =====

    _updateCoinDisplay() {
        const balance = this.coinManager.getBalance();
        this.timerUI.updateCoins(balance);
    }
}

// Initialize app
new KidsMathsApp();
