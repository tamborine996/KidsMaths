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
        this._storyFontScaleMin = 0.85;
        this._storyFontScaleMax = 1.65;
        this._storyFontScaleStep = 0.1;
        this.storyElevenLabsApiKey = window.KIDSMATHS_ELEVENLABS_API_KEY || '';
        this.storyElevenLabsModelId = window.KIDSMATHS_ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
        this.storyVoiceOptions = this._normalizeStoryVoiceOptions(window.KIDSMATHS_ELEVENLABS_VOICES);
        this.storySelectedVoiceId = window.KIDSMATHS_ELEVENLABS_VOICE_ID || this.storyVoiceOptions[0]?.id || 'JBFqnCBsd6RMkjVDRZzb';
        this._selectedStoryWord = null;
        this._showStorySavedWords = false;
        this._showStorySelectionExtras = false;
        this._storyAudioElement = null;
        this._storyAudioObjectUrl = '';
        this._storyAudioAbortController = null;
        this._storyAudioLoading = false;
        this._storyAudioStatusOverride = '';
        this._storyAudioSource = '';
        this._storyPinchState = null;
        this._storyPinchResizeHint = 'Pinch to resize story text.';
        this._storyWordDragState = null;
        this._suppressStoryWordClick = false;
        this._storySelectionSheetDrag = null;

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
        this.mathWorlds = [];

        // Current state
        this.currentProblem = null;
        this.currentMathMission = null;
        this.currentMathMissionQuestions = [];
        this.currentMathMissionIndex = 0;
        this.currentMathMissionCorrect = 0;
        this.currentMathMissionAttempts = 0;
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
        this._showStoryTitleTranslation = false;
        this._pendingUrduSelectionText = '';
        this._urduParagraphTranslations = {};
        this._urduParagraphLoadingKey = '';
        this._baseUrduLevels = [];
        this._bbcFeedItems = [];
        this._bbcFeedExpanded = false;
        this._bbcFeedLoading = false;
        this._bbcFeedError = '';
        this._bbcFeedFetchedAt = '';
        this._bbcImportingUrl = '';
        this._activeBuildInfo = null;
        this._latestBuildInfo = null;

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

        // Apply persisted story typography settings
        this._applyStoryFontScale();

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
            const [modulesRes, rewardsRes, storiesRes, libraryRes, urduRes, mathWorldsRes] = await Promise.all([
                fetch('data/modules.json'),
                fetch('data/rewards.json'),
                fetch('data/stories.json'),
                fetch('data/library.json'),
                fetch('data/urdu.json'),
                fetch('data/math-worlds.json')
            ]);
            const modulesData = await modulesRes.json();
            const rewardsData = await rewardsRes.json();
            const storiesData = await storiesRes.json();
            const libraryData = await libraryRes.json();
            const urduData = await urduRes.json();
            const mathWorldsData = mathWorldsRes.ok
                ? await mathWorldsRes.json()
                : this._getFallbackMathWorlds();

            this.modules = modulesData.modules;
            this.rewards = rewardsData.rewards;
            this.storyLevels = storiesData.levels;
            this.libraryLevels = libraryData.levels;
            this._baseUrduLevels = urduData.levels || [];
            this.mathWorlds = mathWorldsData.worlds || this._getFallbackMathWorlds().worlds || [];
            this.libraryAttribution = libraryData.attribution;
            this.urduAttribution = urduData.attribution;
            this._hydrateUrduLevels();
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

    _getFallbackMathWorlds() {
        return {
            worlds: [
                {
                    id: 'number-adventure',
                    name: 'Number Adventure',
                    coachName: 'Pip',
                    subtitle: 'Tiny number missions that help you get stronger every day.',
                    gardenLabel: 'Number Garden',
                    missionGroups: [
                        { id: 'make-5', title: 'Make 5', subtitle: 'See tiny number friends that snap together to make 5.', power: 'Make 5', operation: 'addition', levelId: 'L1', questionCount: 6, strategy: 'make-5', visual: true, parentPrompt: 'If she hesitates, cover one part and ask: what friend does this number need to make 5?', coachLine: 'Let’s spot tiny number friends that belong together.', celebration: 'You spotted number friends that make 5.' },
                        { id: 'make-10', title: 'Make 10', subtitle: 'Build a full ten with friendly pairs you know.', power: 'Make 10', operation: 'addition', levelId: 'L2', questionCount: 6, strategy: 'make-10', visual: true, parentPrompt: 'Prompt gently: what friend does this number need to make 10?', coachLine: 'Making 10 gives us a strong landing place for bigger sums.', celebration: 'Making 10 is starting to feel natural.' },
                        { id: 'count-on', title: 'Count On', subtitle: 'Start at the bigger number, then hop forward.', power: 'Count On', operation: 'addition', levelId: 'L1', questionCount: 6, strategy: 'count-on', visual: true, parentPrompt: 'Encourage her to say the bigger number first, then tap or hop forward for the small add-on.', coachLine: 'We don’t need to count everything — we can start big and hop on.', celebration: 'You counted on from the bigger number like a quick mathematician.' },
                        { id: 'doubles', title: 'Doubles', subtitle: 'Use easy twin facts.', power: 'Doubles', operation: 'addition', levelId: 'L2', questionCount: 6, strategy: 'doubles', visual: false, parentPrompt: 'Prompt: do you know this double straight away?', coachLine: 'Doubles are fast facts we can remember.', celebration: 'Those doubles are getting quicker.' },
                        { id: 'near-doubles', title: 'Near Doubles', subtitle: 'Use a double, then one more or less.', power: 'Near Doubles', operation: 'addition', levelId: 'L2', questionCount: 6, strategy: 'near-doubles', visual: false, parentPrompt: 'Prompt: what double is close to this one?', coachLine: 'A near double is just a double with a tiny change.', celebration: 'You used a clever near-double strategy.' },
                        { id: 'bridge-10', title: 'Hop Through 10', subtitle: 'Make 10 first, then finish the sum.', power: 'Hop Through 10', operation: 'addition', levelId: 'L3', questionCount: 6, strategy: 'bridge-10', visual: true, parentPrompt: 'Prompt: what does the first number need to reach 10?', coachLine: 'Let’s hop through 10 because 10 is a friendly place.', celebration: 'You can now hop through 10.' },
                        { id: 'subtraction-within-10', title: 'Take Away', subtitle: 'Use little subtraction facts within 10.', power: 'Take Away', operation: 'subtraction', levelId: 'L1', questionCount: 6, strategy: 'subtraction-within-10', visual: true, parentPrompt: 'Prompt: start with the whole amount, then take some away.', coachLine: 'We start with the whole and take some away.', celebration: 'You are getting steadier with take-away facts.' },
                        { id: 'missing-part', title: 'Missing Part', subtitle: 'Find what number is hiding.', power: 'Missing Part', operation: 'subtraction', levelId: 'L2', questionCount: 6, strategy: 'missing-part', visual: false, parentPrompt: 'Prompt: what goes with the first number to make the total?', coachLine: 'Sometimes subtraction is really a missing-part puzzle.', celebration: 'You found the missing parts like a number detective.' },
                        { id: 'bridge-back-10', title: 'Back Through 10', subtitle: 'Step back to 10, then keep going.', power: 'Back Through 10', operation: 'subtraction', levelId: 'L2', questionCount: 6, strategy: 'bridge-back-10', visual: true, parentPrompt: 'Prompt: can we step back to 10 first?', coachLine: 'Ten is a friendly stop when we jump backwards too.', celebration: 'You can jump back through 10 now.' }
                    ]
                }
            ]
        };
    }

    _bindEvents() {
        // Home screen buttons
        document.getElementById('store-btn').addEventListener('click', () => this._showScreen('store'));
        document.getElementById('parent-btn').addEventListener('click', () => this._showScreen('parent'));
        document.getElementById('home-reading-hub').addEventListener('click', () => {
            state.set('readingTab', 'library');
            this._showScreen('reading');
        });
        document.getElementById('home-urdu-hub').addEventListener('click', () => {
            state.set('readingTab', 'urdu');
            this._showScreen('reading');
        });
        document.getElementById('home-maths-hub').addEventListener('click', () => this._showScreen('maths'));
        document.getElementById('home-next-up').addEventListener('click', (e) => this._handleHomeShortcutClick(e));
        document.getElementById('home-resume').addEventListener('click', (e) => this._handleHomeShortcutClick(e));
        document.getElementById('maths-screen').addEventListener('click', (e) => this._handleMathsHubClick(e));
        document.getElementById('math-parent-screen').addEventListener('click', (e) => this._handleMathParentClick(e));
        document.getElementById('math-mission-start-btn').addEventListener('click', () => this._beginCurrentMathMission());
        document.getElementById('math-mission-done-btn').addEventListener('click', () => this._showScreen('maths'));
        document.getElementById('math-mission-next-btn').addEventListener('click', () => this._startNextRecommendedMathMission());

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
        document.getElementById('strategy-btn').addEventListener('click', () => this._showStrategyPrompt());
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
            case 'maths':
                this._renderMathsScreen();
                break;
            case 'math-parent':
                this._renderMathParentScreen();
                break;
            case 'math-mission-intro':
                this._renderMathMissionIntroScreen();
                break;
            case 'math-mission-complete':
                this._renderMathMissionCompleteScreen();
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
        const homeDashboard = document.getElementById('home-dashboard');

        if (homeDashboard) {
            homeDashboard.classList.remove('hidden');
        }

        this._renderHomeNextUp();
        this._renderHomeResume();
        this._renderHomeLearningAreas();
    }

    _renderMathsScreen() {
        const world = this._getActiveMathWorld();
        const recommended = this._getRecommendedMathMission();
        const continueMission = this._getContinueMathMission();
        const intro = document.getElementById('maths-screen-intro');
        const summary = document.getElementById('maths-adventure-summary');
        const launchGrid = document.getElementById('maths-launch-grid');
        const progressStrip = document.getElementById('maths-progress-strip');
        if (!world || !intro || !summary || !launchGrid || !progressStrip) return;

        const completedCount = this._getCompletedMathMissionIds().length;
        const gardenCount = this._getMathGardenCount();
        const totalMissions = world.missionGroups.length;

        intro.innerHTML = `
            <h3>${this._escapeHtml(world.name)}</h3>
            <p>${this._escapeHtml(world.subtitle || 'Tiny number missions that help you get stronger every day.')}</p>
        `;

        summary.innerHTML = `
            <div class="maths-summary-card">
                <div>
                    <div class="maths-summary-kicker">Today’s maths journey</div>
                    <div class="maths-summary-title">${this._escapeHtml(recommended?.title || 'Start your number mission')}</div>
                    <div class="maths-summary-copy">${this._escapeHtml(recommended?.subtitle || 'One calm mission at a time.')}</div>
                </div>
                <div class="maths-summary-stats">
                    <span>${completedCount}/${totalMissions} powers explored</span>
                    <span>${gardenCount} garden piece${gardenCount === 1 ? '' : 's'}</span>
                </div>
            </div>
        `;

        const continueSession = continueMission ? this._getMathMissionSessionMeta(continueMission.id) : null;
        const continueCopy = continueSession
            ? `Resume at question ${continueSession.nextQuestionNumber} of ${continueSession.questionTotal}. ${continueSession.correct} correct so far.`
            : continueMission
                ? 'Open the most recent power you finished or visited.'
                : 'Finish one mission and your quickest return path will show here.';
        const continueFoot = continueSession
            ? `Resume question ${continueSession.nextQuestionNumber} →`
            : continueMission
                ? 'Open recent mission →'
                : 'Start one mission first';

        launchGrid.innerHTML = `
            <button class="maths-launch-card maths-launch-primary" type="button" data-maths-action="start-mission" data-mission-id="${recommended?.id || ''}">
                <div class="maths-launch-kicker">Start today’s mission</div>
                <div class="maths-launch-title">${this._escapeHtml(recommended?.title || 'Number Adventure')}</div>
                <div class="maths-launch-copy">${this._escapeHtml(recommended?.subtitle || 'Tiny number steps with a coach by your side.')}</div>
                <div class="maths-launch-foot">About ${recommended?.questionCount || 6} quick questions →</div>
            </button>
            <button class="maths-launch-card" type="button" data-maths-action="continue-mission" ${continueMission ? `data-mission-id="${continueMission.id}"` : ''} ${continueMission ? '' : 'disabled'}>
                <div class="maths-launch-kicker">Continue your path</div>
                <div class="maths-launch-title">${this._escapeHtml(continueSession ? `Resume ${continueMission?.title}` : continueMission?.title || 'No mission started yet')}</div>
                <div class="maths-launch-copy">${this._escapeHtml(continueCopy)}</div>
                <div class="maths-launch-foot">${this._escapeHtml(continueFoot)}</div>
            </button>
            <button class="maths-launch-card" type="button" data-maths-action="open-parent-pick">
                <div class="maths-launch-kicker">Parent pick</div>
                <div class="maths-launch-title">Choose the next power together</div>
                <div class="maths-launch-copy">See every mission, parent prompts, and the legacy module picker.</div>
                <div class="maths-launch-foot">Open parent tools →</div>
            </button>
        `;

        progressStrip.innerHTML = world.missionGroups.map(mission => {
            const unlocked = this._isMathMissionUnlocked(mission.id);
            const completed = this._isMathMissionCompleted(mission.id);
            const current = recommended?.id === mission.id;
            return `
                <div class="maths-power-chip ${completed ? 'is-complete' : unlocked ? 'is-unlocked' : 'is-locked'} ${current ? 'is-current' : ''}">
                    <div class="maths-power-name">${this._escapeHtml(mission.power || mission.title)}</div>
                    <div class="maths-power-state">${completed ? 'Done' : unlocked ? 'Next' : 'Later'}</div>
                </div>
            `;
        }).join('');
    }

    _getActiveMathWorld() {
        const worldId = state.get('currentMathWorld') || this.mathWorlds[0]?.id;
        return this.mathWorlds.find(world => world.id === worldId) || this.mathWorlds[0] || null;
    }

    _getMathMissions() {
        return this._getActiveMathWorld()?.missionGroups || [];
    }

    _getMathMissionById(missionId) {
        return this._getMathMissions().find(mission => mission.id === missionId) || null;
    }

    _getMathMissionProgress() {
        const progress = state.get('mathMissionProgress');
        return progress && typeof progress === 'object'
            ? { completed: progress.completed || [], sessions: progress.sessions || {} }
            : { completed: [], sessions: {} };
    }

    _getCurrentMathMissionSession() {
        const session = state.get('currentMathMissionSession');
        if (!session || typeof session !== 'object' || !session.missionId || !Array.isArray(session.questions)) {
            return null;
        }
        return {
            missionId: session.missionId,
            questions: session.questions,
            index: Number.isFinite(session.index) ? session.index : 0,
            correct: Number.isFinite(session.correct) ? session.correct : 0,
            attempts: Number.isFinite(session.attempts) ? session.attempts : 0,
            updatedAt: session.updatedAt || null
        };
    }

    _saveCurrentMathMissionSession() {
        if (!this.currentMathMission || !this.currentMathMissionQuestions.length) return;
        state.set('currentMathMissionSession', {
            missionId: this.currentMathMission.id,
            questions: this.currentMathMissionQuestions,
            index: this.currentMathMissionIndex,
            correct: this.currentMathMissionCorrect,
            attempts: this.currentMathMissionAttempts,
            updatedAt: new Date().toISOString()
        });
    }

    _restoreMathMissionSession(session = this._getCurrentMathMissionSession()) {
        if (!session) return false;
        const mission = this._getMathMissionById(session.missionId);
        if (!mission) {
            state.set('currentMathMissionSession', null);
            return false;
        }
        this.currentMathMission = mission;
        this.currentMathMissionQuestions = session.questions;
        this.currentMathMissionIndex = Math.max(0, Math.min(session.index || 0, Math.max(session.questions.length - 1, 0)));
        this.currentMathMissionCorrect = Math.max(0, session.correct || 0);
        this.currentMathMissionAttempts = Math.max(this.currentMathMissionCorrect, session.attempts || 0);
        state.set('currentMathMissionId', mission.id);
        state.set('currentModule', mission.operation);
        state.set('currentLevel', mission.levelId);
        state.set('currentMode', 'practice');
        return true;
    }

    _getMathMissionSessionMeta(missionId) {
        const session = this._getCurrentMathMissionSession();
        if (!session || session.missionId !== missionId) return null;
        const questionTotal = session.questions.length || this._getMathMissionById(missionId)?.questionCount || 0;
        return {
            ...session,
            questionTotal,
            nextQuestionNumber: Math.min((session.index || 0) + 1, questionTotal || 1)
        };
    }

    _getMathGardenCount() {
        const completedCount = this._getCompletedMathMissionIds().length;
        if (state.get('mathGardenCount') !== completedCount) {
            state.set('mathGardenCount', completedCount);
        }
        return completedCount;
    }

    _getMathMissionTheme(mission) {
        const missionId = mission?.id || '';
        if (missionId === 'make-5') {
            return {
                icon: '🍎',
                label: 'Number friends',
                className: 'mission-theme-friends'
            };
        }
        if (missionId === 'make-10') {
            return {
                icon: '🌟',
                label: 'Make a full ten',
                className: 'mission-theme-ten'
            };
        }
        if (missionId === 'count-on') {
            return {
                icon: '🐸',
                label: 'Big start, small hops',
                className: 'mission-theme-hops'
            };
        }
        return {
            icon: '🧮',
            label: 'Number power',
            className: 'mission-theme-default'
        };
    }

    _getMathMissionStats(missionId) {
        const info = this._getMathMissionProgress().sessions[missionId] || {};
        const session = this._getMathMissionSessionMeta(missionId);
        return {
            completions: info.completions || 0,
            lastAccuracy: info.lastAccuracy || 0,
            inProgress: !!session,
            progressLabel: session ? `Q${session.nextQuestionNumber}/${session.questionTotal}` : null,
            correctSoFar: session ? session.correct || 0 : 0
        };
    }

    _buildMathMissionQuestions(mission) {
        const count = mission.questionCount || 6;
        const shuffle = (items) => {
            const copy = [...items];
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
            return copy;
        };

        const takeSequence = (items) => {
            const shuffled = shuffle(items);
            const results = [];
            while (results.length < count) {
                results.push(...shuffled.map(item => ({ ...item })));
            }
            return results.slice(0, count);
        };

        switch (mission.strategy) {
            case 'make-5':
                return takeSequence([
                    { operand1: 1, operand2: 4, operator: '+', answer: 5, visual: true, visualType: 'apples', pairKey: '1+4', customHint: 'What number goes with 1 to make 5?', stepHints: ['Look for the number friend that joins 1 to make 5.', 'Say: 1 and what makes 5?', 'Try 1, 2, 3, 4 — which one lands on 5 with 1?'] },
                    { operand1: 4, operand2: 1, operator: '+', answer: 5, visual: true, visualType: 'apples', pairKey: '4+1', customHint: 'What number goes with 4 to make 5?', stepHints: ['4 is nearly 5 already.', 'Ask: what is one more than 4?', '4 needs 1 more to make 5.'] },
                    { operand1: 2, operand2: 3, operator: '+', answer: 5, visual: true, visualType: 'apples', pairKey: '2+3', customHint: 'What number goes with 2 to make 5?', stepHints: ['2 needs a number friend to reach 5.', 'Count on from 2: 3, 4, 5.', '2 and 3 make 5.'] },
                    { operand1: 3, operand2: 2, operator: '+', answer: 5, visual: true, visualType: 'apples', pairKey: '3+2', customHint: 'What number goes with 3 to make 5?', stepHints: ['3 is part of 5. What friend joins it?', 'Count on from 3: 4, 5.', '3 and 2 make 5.'] }
                ]);
            case 'make-10': {
                const candidates = [];
                for (let a = 1; a <= 9; a++) {
                    const b = 10 - a;
                    candidates.push({ operand1: a, operand2: b, operator: '+', answer: 10, visual: true, visualType: 'stars', pairKey: `${a}+${b}`, customHint: `What number goes with ${a} to make 10?`, stepHints: [`Think of 10 as a full bundle. What friend does ${a} need?`, `Count on from ${a} until you reach 10.`, `${a} needs ${b} to make 10.`] });
                }
                return takeSequence(candidates);
            }
            case 'count-on': {
                const candidates = [];
                for (let start = 4; start <= 10; start++) {
                    for (let hop = 1; hop <= 3; hop++) {
                        candidates.push({ operand1: start, operand2: hop, operator: '+', answer: start + hop, visual: true, visualType: 'blocks', pairKey: `${start}+${hop}`, customHint: `Start at ${start} and hop on ${hop} more.`, stepHints: [`Say ${start} first. Don't start from 1.`, `Now hop forward ${hop} small step${hop === 1 ? '' : 's'}.`, `${start} then ${hop} more lands on ${start + hop}.`] });
                    }
                }
                return takeSequence(candidates);
            }
            default:
                return Array.from({ length: count }, () => this._buildMathMissionQuestion(mission));
        }
    }

    _getCompletedMathMissionIds() {
        return this._getMathMissionProgress().completed || [];
    }

    _isMathMissionCompleted(missionId) {
        return this._getCompletedMathMissionIds().includes(missionId);
    }

    _isMathMissionUnlocked(missionId) {
        const missions = this._getMathMissions();
        const index = missions.findIndex(mission => mission.id === missionId);
        if (index <= 0) return true;
        return this._isMathMissionCompleted(missions[index - 1].id);
    }

    _getRecommendedMathMission() {
        const missions = this._getMathMissions();
        return missions.find(mission => this._isMathMissionUnlocked(mission.id) && !this._isMathMissionCompleted(mission.id))
            || this._getMathMissionById(state.get('lastMathMissionId'))
            || missions[0]
            || null;
    }

    _getContinueMathMission() {
        const session = this._getCurrentMathMissionSession();
        if (session) {
            return this._getMathMissionById(session.missionId) || null;
        }
        return this._getMathMissionById(state.get('lastMathMissionId')) || null;
    }

    _handleMathsHubClick(e) {
        const actionEl = e.target.closest('[data-maths-action]');
        if (!actionEl) return;
        const action = actionEl.dataset.mathsAction;
        if (action === 'open-parent-pick') {
            this._showScreen('math-parent');
            return;
        }
        if (action === 'start-mission') {
            const missionId = actionEl.dataset.missionId || this._getRecommendedMathMission()?.id;
            if (missionId) {
                this._startMathMission(missionId);
            }
            return;
        }

        if (action === 'continue-mission') {
            const missionId = actionEl.dataset.missionId || this._getContinueMathMission()?.id;
            const session = missionId ? this._getMathMissionSessionMeta(missionId) : null;
            if (session) {
                this._resumeCurrentMathMission(missionId);
            } else if (missionId) {
                this._startMathMission(missionId);
            }
        }
    }

    _handleMathParentClick(e) {
        const legacyBtn = e.target.closest('[data-legacy-module]');
        if (legacyBtn) {
            this._selectModule(legacyBtn.dataset.legacyModule);
            return;
        }

        const missionBtn = e.target.closest('[data-parent-mission]');
        if (missionBtn) {
            this._startMathMission(missionBtn.dataset.parentMission);
        }
    }

    _renderMathParentScreen() {
        const summary = document.getElementById('math-parent-summary');
        const missionsContainer = document.getElementById('math-parent-missions');
        const legacyGrid = document.getElementById('math-parent-legacy-grid');
        const world = this._getActiveMathWorld();
        if (!summary || !missionsContainer || !legacyGrid || !world) return;

        const completed = this._getCompletedMathMissionIds().length;
        const garden = this._getMathGardenCount();
        summary.innerHTML = `
            <div class="math-parent-summary-card">
                <div>
                    <div class="maths-summary-kicker">Parent-led overview</div>
                    <div class="maths-summary-title">${this._escapeHtml(world.name)}</div>
                    <div class="maths-summary-copy">Use missions for the main path. Use the legacy module grid only when you want broader free practice.</div>
                </div>
                <div class="maths-summary-stats">
                    <span>${completed}/${world.missionGroups.length} powers completed</span>
                    <span>${garden} Number Garden piece${garden === 1 ? '' : 's'}</span>
                </div>
            </div>
        `;

        missionsContainer.innerHTML = world.missionGroups.map(mission => {
            const completedMission = this._isMathMissionCompleted(mission.id);
            const unlocked = this._isMathMissionUnlocked(mission.id);
            const theme = this._getMathMissionTheme(mission);
            const stats = this._getMathMissionStats(mission.id);
            const stateLabel = stats.inProgress
                ? `Resume ${stats.progressLabel}`
                : completedMission
                    ? 'Done'
                    : unlocked
                        ? 'Ready'
                        : 'Locked';
            return `
                <button class="math-parent-mission-card ${theme.className} ${completedMission ? 'is-complete' : unlocked ? 'is-unlocked' : 'is-locked'}" type="button" data-parent-mission="${mission.id}" ${unlocked ? '' : 'disabled'}>
                    <div class="math-parent-mission-top">
                        <span class="math-parent-mission-power">${this._escapeHtml(`${theme.icon} ${mission.power}`)}</span>
                        <span class="math-parent-mission-state">${this._escapeHtml(stateLabel)}</span>
                    </div>
                    <div class="math-parent-mission-title">${this._escapeHtml(mission.title)}</div>
                    <div class="math-parent-mission-copy">${this._escapeHtml(mission.subtitle)}</div>
                    <div class="math-parent-mission-note">${this._escapeHtml(mission.parentPrompt)}</div>
                    <div class="math-parent-mission-metrics">
                        <span>${stats.completions} completion${stats.completions === 1 ? '' : 's'}</span>
                        <span>${stats.lastAccuracy ? `${stats.lastAccuracy}% accuracy` : 'No accuracy yet'}</span>
                        <span>${stats.inProgress ? `${stats.correctSoFar} correct so far` : theme.label}</span>
                    </div>
                </button>
            `;
        }).join('');

        this._renderModuleGrid(legacyGrid);
        legacyGrid.querySelectorAll('.module-btn').forEach(btn => {
            btn.dataset.legacyModule = btn.dataset.module;
        });
    }

    _startMathMission(missionId) {
        const mission = this._getMathMissionById(missionId);
        if (!mission) return;
        this.currentMathMission = mission;
        state.set('currentMathMissionId', mission.id);
        state.set('currentModule', mission.operation);
        state.set('currentLevel', mission.levelId);
        this._showScreen('math-mission-intro');
    }

    _resumeCurrentMathMission(missionId = state.get('currentMathMissionId')) {
        const session = this._getMathMissionSessionMeta(missionId);
        if (!session || !this._restoreMathMissionSession(session)) {
            if (missionId) this._startMathMission(missionId);
            return;
        }
        state.set('lastMathMissionId', missionId);
        this._recordRecentItem(this._buildMathMissionResumeItem(missionId, session.updatedAt));
        document.querySelector('#practice-screen .back-btn').dataset.to = 'maths';
        document.getElementById('practice-title').textContent = this.currentMathMission.title;
        document.getElementById('hint-btn').textContent = 'Hint';
        document.getElementById('strategy-btn').textContent = 'Break it up';
        this._showScreen('practice');
        this._startPractice();
    }

    _resetMathMissionState({ clearLast = false } = {}) {
        this.currentMathMission = null;
        this.currentMathMissionQuestions = [];
        this.currentMathMissionIndex = 0;
        this.currentMathMissionCorrect = 0;
        this.currentMathMissionAttempts = 0;
        state.set('currentMathMissionId', null);
        state.set('currentMathMissionSession', null);
        if (clearLast) {
            state.set('lastMathMissionId', null);
        }
    }

    _beginCurrentMathMission() {
        const mission = this.currentMathMission || this._getMathMissionById(state.get('currentMathMissionId'));
        if (!mission) return;
        this.currentMathMission = mission;
        this.currentMathMissionIndex = 0;
        this.currentMathMissionCorrect = 0;
        this.currentMathMissionAttempts = 0;
        this.currentMathMissionQuestions = this._buildMathMissionQuestions(mission);
        state.set('currentMode', 'practice');
        state.set('lastMathMissionId', mission.id);
        this._saveCurrentMathMissionSession();
        this._recordRecentItem(this._buildMathMissionResumeItem(mission.id));
        document.querySelector('#practice-screen .back-btn').dataset.to = 'maths';
        document.getElementById('practice-title').textContent = mission.title;
        document.getElementById('hint-btn').textContent = 'Hint';
        document.getElementById('strategy-btn').textContent = 'Break it up';
        this._showScreen('practice');
        this._startPractice();
    }

    _renderMathMissionIntroScreen() {
        const card = document.getElementById('math-mission-intro-card');
        const mission = this.currentMathMission || this._getMathMissionById(state.get('currentMathMissionId'));
        if (!card || !mission) return;
        this.currentMathMission = mission;
        const gardenCount = this._getMathGardenCount();
        const nextMission = this._getRecommendedMathMission();
        const theme = this._getMathMissionTheme(mission);
        card.innerHTML = `
            <div class="math-mission-intro-kicker">${this._escapeHtml(`${theme.icon} ${theme.label}`)}</div>
            <h3>${this._escapeHtml(mission.title)}</h3>
            <p class="math-mission-intro-copy">${this._escapeHtml(mission.subtitle)}</p>
            <div class="math-mission-intro-stats">
                <span class="math-mission-pill">${mission.questionCount || 6} quick questions</span>
                <span class="math-mission-pill">${gardenCount} garden piece${gardenCount === 1 ? '' : 's'}</span>
                <span class="math-mission-pill">${this._escapeHtml(mission.power)}</span>
            </div>
            <p class="math-mission-intro-coach">${this._escapeHtml(mission.coachLine)}</p>
            <div class="math-mission-intro-note"><strong>Parent note:</strong> ${this._escapeHtml(mission.parentPrompt)}</div>
            <div class="math-mission-intro-foot">${nextMission && nextMission.id !== mission.id ? `After this: ${this._escapeHtml(nextMission.title)}` : 'One calm mission at a time.'}</div>
        `;
    }

    _renderMathMissionCompleteScreen() {
        const card = document.getElementById('math-mission-complete-card');
        const mission = this.currentMathMission || this._getMathMissionById(state.get('lastMathMissionId'));
        if (!card || !mission) return;
        const gardenCount = this._getMathGardenCount();
        const nextMission = this._getRecommendedMathMission();
        const progress = this._getMathMissionProgress();
        const sessionInfo = progress.sessions[mission.id] || { lastAccuracy: 0, completions: 0 };
        const accuracyLabel = sessionInfo.lastAccuracy ? `${sessionInfo.lastAccuracy}% accuracy` : 'Finished today';
        const isFirstCompletion = sessionInfo.completions === 1;
        const theme = this._getMathMissionTheme(mission);
        card.innerHTML = `
            <div class="math-mission-complete-kicker">${this._escapeHtml(`${theme.icon} ${mission.power} unlocked`)}</div>
            <h3>${this._escapeHtml(mission.title)}</h3>
            <p>${this._escapeHtml(mission.celebration || 'You finished today’s number mission.')}</p>
            <div class="math-mission-intro-stats">
                <span class="math-mission-pill">${this._escapeHtml(accuracyLabel)}</span>
                <span class="math-mission-pill">${gardenCount} piece${gardenCount === 1 ? '' : 's'} in your Number Garden</span>
                <span class="math-mission-pill">${isFirstCompletion ? 'New power grown' : 'Replay counted as practice'}</span>
            </div>
            <div class="math-mission-complete-garden">${isFirstCompletion ? 'A new Number Garden piece appeared for this power.' : 'Garden growth only happens the first time each power is completed.'}</div>
            <div class="math-mission-complete-next">${nextMission && nextMission.id !== mission.id ? `Next up: ${this._escapeHtml(nextMission.title)}` : 'You can replay this mission or return to Maths.'}</div>
        `;
    }

    _startNextRecommendedMathMission() {
        const nextMission = this._getRecommendedMathMission();
        if (!nextMission) {
            this._showScreen('maths');
            return;
        }
        this._startMathMission(nextMission.id);
    }

    _buildMathMissionQuestion(mission) {
        const randomInRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const shuffleAddends = (a, b) => Math.random() > 0.5 ? [a, b] : [b, a];
        switch (mission.strategy) {
            case 'make-5': {
                const a = randomInRange(1, 4);
                const b = 5 - a;
                const [operand1, operand2] = shuffleAddends(a, b);
                return { operand1, operand2, operator: '+', answer: 5, visual: true, visualType: 'apples', pairKey: `${operand1}+${operand2}`, customHint: 'What number goes with the first one to make 5?' };
            }
            case 'make-10': {
                const a = randomInRange(1, 9);
                const b = 10 - a;
                const [operand1, operand2] = shuffleAddends(a, b);
                return { operand1, operand2, operator: '+', answer: 10, visual: true, visualType: 'stars', pairKey: `${operand1}+${operand2}`, customHint: 'Can you see the pair that makes 10?' };
            }
            case 'count-on': {
                const operand1 = randomInRange(4, 10);
                const operand2 = randomInRange(1, 3);
                return { operand1, operand2, operator: '+', answer: operand1 + operand2, visual: true, visualType: 'blocks', pairKey: `${operand1}+${operand2}`, customHint: `Start at ${operand1} and hop on ${operand2} more.` };
            }
            case 'doubles': {
                const operand1 = randomInRange(1, 8);
                return { operand1, operand2: operand1, operator: '+', answer: operand1 * 2, visual: false, pairKey: `${operand1}+${operand1}`, customHint: `This is a double. What is ${operand1} and ${operand1}?` };
            }
            case 'near-doubles': {
                const base = randomInRange(2, 8);
                const delta = Math.random() > 0.5 ? 1 : -1;
                const other = base + delta;
                const [operand1, operand2] = shuffleAddends(base, other);
                return { operand1, operand2, operator: '+', answer: operand1 + operand2, visual: false, pairKey: `${operand1}+${operand2}`, customHint: `Think of the close double first, then one more or one less.` };
            }
            case 'bridge-10': {
                const operand1 = randomInRange(6, 9);
                const needed = 10 - operand1;
                const operand2 = needed + randomInRange(1, 3);
                return { operand1, operand2, operator: '+', answer: operand1 + operand2, visual: true, visualType: 'apples', pairKey: `${operand1}+${operand2}`, customHint: `What does ${operand1} need to make 10 first?` };
            }
            case 'subtraction-within-10': {
                const operand1 = randomInRange(4, 10);
                const operand2 = randomInRange(1, Math.min(5, operand1 - 1));
                return { operand1, operand2, operator: '-', answer: operand1 - operand2, visual: true, visualType: 'apples', customHint: `Start with ${operand1}, then take away ${operand2}.` };
            }
            case 'missing-part': {
                const total = randomInRange(5, 10);
                const known = randomInRange(1, total - 1);
                return { operand1: known, operand2: total, operator: '+', answer: total - known, visual: false, displayFormat: `${known} + ? = ${total}`, customHint: `What number goes with ${known} to make ${total}?` };
            }
            case 'bridge-back-10': {
                const operand1 = randomInRange(11, 15);
                const toTen = operand1 - 10;
                const operand2 = toTen + randomInRange(1, 3);
                return { operand1, operand2, operator: '-', answer: operand1 - operand2, visual: true, visualType: 'blocks', customHint: `Can you jump back to 10 first, then keep going?` };
            }
            default:
                return this.problemGenerator.generate(mission.operation, { operand1: { min: 1, max: 5 }, operand2: { min: 1, max: 5 }, visual: true, visualType: 'apples' });
        }
    }

    _renderPracticeMissionStatus() {
        const wrapper = document.getElementById('practice-mission-status');
        const mission = this.currentMathMission || this._getMathMissionById(state.get('currentMathMissionId'));
        if (!wrapper || !mission || !state.get('currentMathMissionId')) {
            wrapper?.classList.add('hidden');
            return;
        }
        const theme = this._getMathMissionTheme(mission);
        wrapper.className = `practice-mission-status ${theme.className}`;
        document.getElementById('practice-mission-kicker').textContent = `${theme.icon} ${mission.power || 'Today’s mission'}`;
        document.getElementById('practice-mission-name').textContent = mission.title;
        document.getElementById('practice-mission-progress').textContent = `${Math.min(this.currentMathMissionIndex + 1, mission.questionCount || 6)} of ${mission.questionCount || 6}`;
        document.getElementById('practice-mission-coach').textContent = theme.label === 'Number power'
            ? mission.coachLine
            : `${theme.label} • ${mission.coachLine}`;
        wrapper.classList.remove('hidden');
    }

    _showStrategyPrompt() {
        const mission = this.currentMathMission || this._getMathMissionById(state.get('currentMathMissionId'));
        const feedback = document.getElementById('feedback-display');
        const strategies = {
            'make-5': 'See the two parts that join to make 5.',
            'make-10': 'Look for the pair that makes 10 first.',
            'count-on': 'Start from the bigger number and hop on.',
            'doubles': 'This is a twin fact. Say the double you know.',
            'near-doubles': 'Use the nearby double, then one more or one less.',
            'bridge-10': 'Hop to 10 first, then finish the sum.',
            'subtraction-within-10': 'Start with the whole amount, then take some away.',
            'missing-part': 'Ask what number is hiding to make the whole.',
            'bridge-back-10': 'Step back to 10 first, then keep going.'
        };
        if (!feedback || !mission) return;
        feedback.textContent = strategies[mission.strategy] || mission.coachLine || 'Try a calm number strategy.';
        feedback.className = 'feedback-display';
        feedback.classList.remove('hidden');
    }

    _getNextHintText(problem = this.currentProblem) {
        if (!problem) return 'Take a calm look and try one small step.';
        const hints = Array.isArray(problem.stepHints) && problem.stepHints.length
            ? problem.stepHints
            : [this.problemGenerator.generateHint(problem)];
        const nextIndex = Math.min(problem.hintLevel || 0, hints.length - 1);
        problem.hintLevel = nextIndex + 1;
        return hints[nextIndex];
    }

    _updateHintButtonLabel(problem = this.currentProblem) {
        const hintBtn = document.getElementById('hint-btn');
        if (!hintBtn) return;
        const hints = Array.isArray(problem?.stepHints) && problem.stepHints.length
            ? problem.stepHints
            : ['Hint'];
        const nextStep = Math.min((problem?.hintLevel || 0) + 1, hints.length);
        hintBtn.textContent = hints.length > 1 ? `Hint ${nextStep}` : 'Hint';
    }

    _showHint() {
        const hint = this._getNextHintText(this.currentProblem);
        document.getElementById('hint-text').textContent = hint;
        document.getElementById('hint-area').classList.remove('hidden');
        this._updateHintButtonLabel(this.currentProblem);
        if (state.get('currentMathMissionId')) {
            this._saveCurrentMathMissionSession();
        }
    }

    _completeCurrentMathMission() {
        const mission = this.currentMathMission;
        if (!mission) return;
        const progress = this._getMathMissionProgress();
        const sessionInfo = progress.sessions[mission.id] || { plays: 0, completions: 0, lastPlayed: null, lastAccuracy: 0 };
        const wasAlreadyCompleted = progress.completed.includes(mission.id);
        const accuracy = this.currentMathMissionAttempts
            ? Math.round((this.currentMathMissionCorrect / this.currentMathMissionAttempts) * 100)
            : 100;
        sessionInfo.plays += 1;
        sessionInfo.completions += 1;
        sessionInfo.lastPlayed = new Date().toISOString();
        sessionInfo.lastAccuracy = accuracy;
        progress.sessions[mission.id] = sessionInfo;
        if (!wasAlreadyCompleted) {
            progress.completed.push(mission.id);
        }
        state.set('mathMissionProgress', progress);
        state.set('lastMathMissionId', mission.id);
        state.set('mathGardenCount', progress.completed.length);
        this._resetMathMissionState();
        document.getElementById('feedback-display').classList.add('hidden');
        this.currentMathMission = mission;
        this._recordRecentItem(this._buildMathMissionResumeItem(mission.id, sessionInfo.lastPlayed));
        this._renderMathMissionCompleteScreen();
        this._showScreen('math-mission-complete');
    }

    _renderHomeNextUp() {
        const container = document.getElementById('home-next-up');
        const nextItem = this._getPrimaryNextUp();

        if (!nextItem) {
            container.innerHTML = `
                <button class="next-up-card" data-kind="screen" data-screen="maths">
                    <div class="next-up-label">Today’s next step</div>
                    <div class="next-up-title">Start today’s maths mission</div>
                    <div class="next-up-meta">A quick, confident first step into Number Adventure.</div>
                    <div class="next-up-cta next-up-cta-primary">Start maths mission</div>
                </button>
            `;
            return;
        }

        const icon = nextItem.type === 'story' ? '📖' : (nextItem.icon || '➕');
        const dataAttrs = nextItem.type === 'story'
            ? `data-kind="story" data-story-id="${nextItem.storyId}" data-page="${nextItem.page}"`
            : nextItem.type === 'math-mission'
                ? `data-kind="math-mission" data-mission-id="${nextItem.missionId}"`
                : `data-kind="module" data-module-id="${nextItem.moduleId}" data-level-id="${nextItem.levelId || ''}" data-mode="${nextItem.mode || ''}"`;
        const meta = nextItem.type === 'story'
            ? `Page ${nextItem.page + 1} of ${nextItem.totalPages}`
            : nextItem.type === 'math-mission'
                ? `${nextItem.levelName || 'Mission ready'}${nextItem.progressLabel ? ' · ' + nextItem.progressLabel : ''}`
                : `${nextItem.levelName || 'Ready to continue'}${nextItem.modeLabel ? ' · ' + nextItem.modeLabel : ''}`;
        const kicker = nextItem.type === 'story'
            ? 'Story time'
            : nextItem.type === 'math-mission'
                ? 'Maths mission'
                : 'Maths practice';

        container.innerHTML = `
            <button class="next-up-card" ${dataAttrs}>
                <div class="next-up-label">${this._escapeHtml(kicker)}</div>
                <div class="next-up-main">
                    <span class="next-up-icon">${icon}</span>
                    <div class="next-up-copy">
                        <div class="next-up-title">${this._escapeHtml(nextItem.title)}</div>
                        <div class="next-up-meta">${this._escapeHtml(meta)}</div>
                    </div>
                </div>
                <div class="next-up-cta next-up-cta-primary">${this._escapeHtml(nextItem.cta)}</div>
            </button>
        `;
    }

    _renderHomeResume() {
        const container = document.getElementById('home-resume');
        const section = container?.closest('.home-section');
        const heading = section?.querySelector('.section-heading h3');
        const helper = section?.querySelector('.section-heading p');
        const primaryKey = this._getPrimaryNextUp()?.key;
        const items = this._getResumeItems()
            .filter(item => item.key !== primaryKey)
            .slice(0, 2);

        if (!container || !section) return;

        if (items.length === 0) {
            section.classList.add('hidden');
            container.innerHTML = '';
            return;
        }

        section.classList.remove('hidden');
        if (heading) heading.textContent = 'Pick up again';
        if (helper) helper.textContent = 'Favourite stories and missions stay close by.';

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

            if (item.type === 'math-mission') {
                return `
                    <button class="home-resume-card" data-kind="math-mission" data-mission-id="${item.missionId}">
                        <div class="home-resume-top">
                            <span class="home-resume-icon">🧮</span>
                            <span class="home-resume-chip">Maths</span>
                        </div>
                        <div class="home-resume-title">${item.title}</div>
                        <div class="home-resume-meta">${item.levelName}${item.progressLabel ? ' · ' + item.progressLabel : ''}</div>
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
        const urduBookmarks = Object.keys(state.get('bookmarks') || {}).filter(storyId => this._isUrduStory(storyId)).length;
        const mathsCopy = recentMaths
            ? 'Little number missions with a confident, playful feel.'
            : 'Quick number missions with a calm coach and a clear first step.';
        const mathsStats = totalTime > 0
            ? `${totalTime} min practised · ${streak} day${streak !== 1 ? 's' : ''} streak`
            : 'Ready for your first quick mission';
        const readingCopy = bookmarks.length > 0 || readStories.length > 0
            ? 'Cozy reads, bookmarks, and longer adventures.'
            : 'Cosy stories with big type, gentle pacing, and easy returns.';
        const readingStats = bookmarks.length > 0 || readStories.length > 0
            ? `${bookmarks.length} bookmarked · ${readStories.length} finished`
            : 'Pick your first cosy story';
        const urduCopy = urduBookmarks > 0
            ? 'A gentle place for Urdu stories, bookmarks, and practice.'
            : 'A calm Urdu corner for short stories and parent-guided practice.';
        const urduStats = urduBookmarks > 0
            ? `${urduBookmarks} bookmarked · ${this.urduLevels.length} level${this.urduLevels.length !== 1 ? 's' : ''}`
            : 'Start with one gentle Urdu page';

        mathsHub.innerHTML = `
            <div class="learning-area-top">
                <span class="learning-area-icon">🧮</span>
                <span class="learning-area-badge">Maths</span>
            </div>
            <div class="learning-area-title">Number Adventure</div>
            <div class="learning-area-copy">${this._escapeHtml(mathsCopy)}</div>
            <div class="learning-area-stats">${this._escapeHtml(mathsStats)}</div>
            <div class="learning-area-foot">${recentMaths ? 'Continue maths' : 'Start maths'}</div>
        `;

        readingHub.innerHTML = `
            <div class="learning-area-top">
                <span class="learning-area-icon">📚</span>
                <span class="learning-area-badge">Reading</span>
            </div>
            <div class="learning-area-title">Stories</div>
            <div class="learning-area-copy">${this._escapeHtml(readingCopy)}</div>
            <div class="learning-area-stats">${this._escapeHtml(readingStats)}</div>
            <div class="learning-area-foot">Open stories</div>
        `;

        urduHub.innerHTML = `
            <div class="learning-area-top">
                <span class="learning-area-icon">اُ</span>
                <span class="learning-area-badge">Urdu</span>
            </div>
            <div class="learning-area-title">Urdu reading</div>
            <div class="learning-area-copy">${this._escapeHtml(urduCopy)}</div>
            <div class="learning-area-stats">${this._escapeHtml(urduStats)}</div>
            <div class="learning-area-foot">Open Urdu</div>
        `;
    }

    _renderModuleGrid(grid = document.getElementById('module-grid')) {
        if (!grid) return;

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
        const activeMission = this._getCurrentMathMissionSession();
        if (activeMission) {
            return this._buildMathMissionResumeItem(activeMission.missionId, activeMission.updatedAt);
        }
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
            } else if (raw.type === 'math-mission') {
                item = this._buildMathMissionResumeItem(raw.missionId, raw.updatedAt);
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
        return this._getResumeItems().find(item => item.type === 'math-mission' || item.type === 'module') || null;
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

    _buildMathMissionResumeItem(missionId, updatedAt = null) {
        const mission = this._getMathMissionById(missionId);
        if (!mission) return null;
        const session = this._getMathMissionSessionMeta(missionId);
        const questionTotal = session?.questionTotal || mission.questionCount || 6;
        const nextQuestionNumber = session?.nextQuestionNumber || 1;
        return {
            key: `math-mission:${missionId}`,
            type: 'math-mission',
            missionId,
            moduleId: mission.operation,
            levelId: mission.levelId,
            title: mission.title,
            icon: '🧮',
            levelName: session
                ? `Question ${nextQuestionNumber} of ${questionTotal}`
                : mission.subtitle,
            updatedAt: updatedAt || session?.updatedAt || new Date().toISOString(),
            cta: session ? 'Resume mission' : 'Open mission',
            power: mission.power,
            progressLabel: session
                ? `${session.correct} correct so far`
                : 'Mission ready'
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

        if (kind === 'math-mission') {
            this._resumeCurrentMathMission(target.dataset.missionId);
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
        this._resetMathMissionState();
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
        this._resetMathMissionState();
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
        this._resetMathMissionState();
        state.set('currentMode', mode);
        document.querySelector('#practice-screen .back-btn').dataset.to = 'module';
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
        if (!this.timerManager.isRunning) {
            this.timerManager.start();
        }

        // Setup canvas if visual level
        const canvas = document.getElementById('visual-canvas');
        this.visualObjects = new VisualObjects(canvas);

        // Generate first problem
        this._nextProblem();
    }

    _nextProblem() {
        const activeMissionId = state.get('currentMathMissionId');
        if (activeMissionId && this.currentMathMissionQuestions.length) {
            const mission = this.currentMathMission || this._getMathMissionById(activeMissionId);
            if (!mission) return;
            if (this.currentMathMissionIndex >= this.currentMathMissionQuestions.length) {
                this._completeCurrentMathMission();
                return;
            }

            this.currentMathMission = mission;
            this.currentProblem = this.currentMathMissionQuestions[this.currentMathMissionIndex];
            this._renderProblem(this.currentProblem);
            this._renderPracticeMissionStatus();

            const input = document.getElementById('answer-input');
            input.value = '';
            input.classList.remove('correct', 'incorrect');
            input.focus();
            this._updateHintButtonLabel(this.currentProblem);
            document.getElementById('hint-area').classList.add('hidden');
            document.getElementById('feedback-display').classList.add('hidden');
            return;
        }

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
        document.getElementById('practice-mission-status').classList.add('hidden');

        // Clear and focus input
        const input = document.getElementById('answer-input');
        input.value = '';
        input.classList.remove('correct', 'incorrect');
        input.focus();
        this._updateHintButtonLabel(this.currentProblem);

        // Hide hint
        document.getElementById('hint-area').classList.add('hidden');
    }

    _renderProblem(problem) {
        // Update text display
        const problemDisplay = document.getElementById('problem-display');
        if (problem.displayFormat) {
            const [before, after] = String(problem.displayFormat).split('?');
            problemDisplay.innerHTML = `
                <span class="problem-text">${before || ''}</span>
                <input type="number" id="answer-input" class="answer-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
                <span class="problem-text">${after || ''}</span>
            `;
        } else {
            problemDisplay.innerHTML = `
                <span class="operand" id="operand1">${problem.operand1}</span>
                <span class="operator" id="operator">${problem.operator}</span>
                <span class="operand" id="operand2">${problem.operand2}</span>
                <span class="equals">=</span>
                <input type="number" id="answer-input" class="answer-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
            `;
        }

        // Re-bind enter key after rebuilding the problem display
        document.getElementById('answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this._checkAnswer();
        });

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

        const feedback = document.getElementById('feedback-display');
        const isMathMission = !!state.get('currentMathMissionId');
        if (isMathMission) {
            this.currentMathMissionAttempts++;
        }

        if (userAnswer === this.currentProblem.answer) {
            this.celebration.pulseElement(input);
            this.celebration.trigger();
            this.progressManager.recordAttempt(
                state.get('currentModule'),
                state.get('currentLevel'),
                1, 1
            );

            if (isMathMission) {
                this.currentMathMissionCorrect++;
                this.currentMathMissionIndex++;
                if (this.currentMathMissionIndex < this.currentMathMissionQuestions.length) {
                    this._saveCurrentMathMissionSession();
                }
                feedback.textContent = 'Nice noticing. Let’s keep going.';
                feedback.className = 'feedback-display';
                feedback.classList.remove('hidden');
                setTimeout(() => {
                    if (this.currentMathMissionIndex >= this.currentMathMissionQuestions.length) {
                        this._completeCurrentMathMission();
                    } else {
                        this._nextProblem();
                    }
                }, 900);
                return;
            }

            setTimeout(() => {
                this._nextProblem();
            }, 1600);
        } else {
            this.celebration.gentleShake(input);
            feedback.textContent = isMathMission
                ? 'Not a big deal — use the hint and try the number step again.'
                : "Let's try again! Take your time.";
            feedback.className = 'feedback-display incorrect';
            feedback.classList.remove('hidden');
            this.progressManager.recordAttempt(
                state.get('currentModule'),
                state.get('currentLevel'),
                0, 1
            );

            if (isMathMission) {
                document.getElementById('hint-text').textContent = this._getNextHintText(this.currentProblem);
                document.getElementById('hint-area').classList.remove('hidden');
                this._updateHintButtonLabel(this.currentProblem);
                this._saveCurrentMathMissionSession();
            } else {
                setTimeout(() => {
                    feedback.classList.add('hidden');
                }, 2000);
            }

            input.value = '';
            input.focus();
        }
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
                state.set('readingTab', e.currentTarget.dataset.readingTab);
                if (e.currentTarget.dataset.readingTab === 'urdu') {
                    this._setReadingSearchOpen(false, { clear: true });
                }
                this._renderReadingScreen();
            });
        });

        // Level selector
        document.getElementById('reading-level-select').addEventListener('change', (e) => {
            const { stateKey } = this._getReadingSourceConfig();
            state.set(stateKey, e.target.value);
            this._renderReadingScreen();
        });

        document.getElementById('reading-search-toggle').addEventListener('click', () => {
            const nextOpen = !this._isReadingSearchOpen();
            this._setReadingSearchOpen(nextOpen, { focus: nextOpen, clear: !nextOpen });
            this._renderReadingScreen();
        });

        // Story navigation
        document.getElementById('story-prev-btn').addEventListener('click', () => this._storyPrevPage());
        document.getElementById('story-next-btn').addEventListener('click', () => this._storyNextPage());
        document.getElementById('story-font-decrease-btn').addEventListener('click', () => this._changeStoryFontScale(-this._storyFontScaleStep));
        document.getElementById('story-font-increase-btn').addEventListener('click', () => this._changeStoryFontScale(this._storyFontScaleStep));
        document.getElementById('story-font-reset-btn').addEventListener('click', () => this._resetStoryFontScale());
        document.getElementById('story-selection-speak-btn').addEventListener('click', () => this._speakStorySelection());
        document.getElementById('story-selection-save-btn').addEventListener('click', () => this._saveSelectedStoryWord());
        document.getElementById('story-selection-clear-btn').addEventListener('click', () => this._clearStoryWordSelection());
        document.getElementById('story-selection-more-btn').addEventListener('click', () => {
            this._showStorySelectionExtras = !this._showStorySelectionExtras;
            this._renderStorySelectionControls();
        });
        document.getElementById('story-selection-backdrop').addEventListener('click', () => this._dismissStorySelectionSheet());
        document.getElementById('story-selection-saved-toggle-btn').addEventListener('click', () => {
            this._showStorySavedWords = !this._showStorySavedWords;
            this._renderStorySelectionControls();
        });
        document.getElementById('story-stop-audio-btn').addEventListener('click', () => this._stopStoryAudio());
        document.getElementById('story-voice-select').addEventListener('change', (e) => this._setStoryVoiceId(e.target.value));
        document.getElementById('story-selection-saved-panel').addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-remove-story-word]');
            if (removeBtn) {
                this._removeStorySavedWord(removeBtn.dataset.removeStoryWord);
            }
        });

        this._bindStorySelectionSheetDismiss();

        // Story swipe navigation (storybook-style page turns)
        const storyContent = document.getElementById('story-content');
        storyContent.addEventListener('touchstart', (e) => {
            if (!this.currentStory) return;
            if (e.touches.length === 2) {
                this._beginStoryPinchResize(e.touches);
                this._storyTouchStartedInText = false;
                return;
            }
            if (e.touches.length !== 1) return;
            if (this._storyPinchState) return;
            this._storyTouchStartX = e.touches[0].clientX;
            this._storyTouchStartY = e.touches[0].clientY;
            this._storyTouchStartedInText = Boolean(e.target.closest('#story-text'));
        }, { passive: true });

        storyContent.addEventListener('touchmove', (e) => {
            if (!this.currentStory || !this._storyPinchState) return;
            if (e.touches.length < 2) return;
            this._updateStoryPinchResize(e.touches);
        }, { passive: true });

        storyContent.addEventListener('touchend', (e) => {
            if (!this.currentStory) return;
            if (this._storyPinchState) {
                this._endStoryPinchResize(e.touches);
                return;
            }
            if (e.changedTouches.length !== 1) return;
            if (this._storyTouchStartedInText) return;

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

        storyContent.addEventListener('touchcancel', () => {
            if (this._storyPinchState) {
                this._endStoryPinchResize([]);
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

        document.getElementById('story-text').addEventListener('pointerdown', (e) => {
            if (!this.currentStory || !this._storySupportsCustomWordSelection()) return;
            const storyWordBtn = e.target.closest('.story-word-button');
            if (!storyWordBtn) return;
            this._beginStoryWordDragSelection(storyWordBtn, e.pointerId);
        });

        document.addEventListener('pointermove', (e) => {
            if (!this._storyWordDragState || !this._storySupportsCustomWordSelection()) return;
            this._updateStoryWordDragSelection(e.clientX, e.clientY, e.pointerId);
        });

        document.addEventListener('pointerup', (e) => {
            if (!this._storyWordDragState) return;
            this._endStoryWordDragSelection(e.pointerId);
        });

        document.addEventListener('pointercancel', (e) => {
            if (!this._storyWordDragState) return;
            this._endStoryWordDragSelection(e.pointerId, { cancelled: true });
        });

        document.getElementById('story-text').addEventListener('click', async (e) => {
            if (!this.currentStory) return;

            const storyWordBtn = e.target.closest('.story-word-button');
            if (storyWordBtn && this._storySupportsCustomWordSelection()) {
                if (this._suppressStoryWordClick) {
                    this._suppressStoryWordClick = false;
                    return;
                }
                this._selectStoryWord(
                    storyWordBtn.dataset.storyWordNormalized || storyWordBtn.dataset.storyWord,
                    Number(storyWordBtn.dataset.paragraphIndex),
                    Number(storyWordBtn.dataset.occurrenceIndex),
                    Number(storyWordBtn.dataset.tokenIndex)
                );
                return;
            }

            if (!this._storySupportsUrduTools()) {
                if (this._getSelectedStoryWord() && this._storySupportsCustomWordSelection()) {
                    this._clearStoryWordSelection();
                }
                return;
            }

            const paragraphBtn = e.target.closest('[data-paragraph-translate]');
            if (paragraphBtn) {
                await this._toggleUrduParagraphTranslation(Number(paragraphBtn.dataset.paragraphTranslate));
                return;
            }

            const wordBtn = e.target.closest('.urdu-word-button');
            if (wordBtn) {
                const nextWord = wordBtn.dataset.word;
                const nextMeaning = wordBtn.dataset.meaning;
                const nextParagraphIndex = Number(wordBtn.dataset.paragraphIndex);
                const nextOccurrenceIndex = Number(wordBtn.dataset.occurrenceIndex);
                const isSameWord = this._selectedUrduWord
                    && this._selectedUrduWord.word === nextWord
                    && Number(this._selectedUrduWord.paragraphIndex ?? -1) === nextParagraphIndex
                    && Number(this._selectedUrduWord.occurrenceIndex ?? -1) === nextOccurrenceIndex;

                if (isSameWord) {
                    this._clearSelectedUrduWord();
                } else {
                    this._selectUrduWord(
                        nextWord,
                        nextMeaning,
                        nextParagraphIndex,
                        nextOccurrenceIndex
                    );
                }
                return;
            }

            const tappedWord = this._getTappedUrduWord(e);
            if (tappedWord) {
                const isSameTappedWord = this._selectedUrduWord
                    && this._selectedUrduWord.word === tappedWord.word
                    && Number(this._selectedUrduWord.paragraphIndex ?? -1) === Number(tappedWord.paragraphIndex ?? -1)
                    && Number(this._selectedUrduWord.occurrenceIndex ?? -1) === Number(tappedWord.occurrenceIndex ?? -1);
                if (isSameTappedWord) {
                    this._clearSelectedUrduWord();
                    return;
                }
                await this._translateTappedUrduText(tappedWord);
                return;
            }

            if (this._selectedUrduWord) {
                this._clearSelectedUrduWord();
            }
        });

        document.getElementById('urdu-translation-toggle-btn').addEventListener('click', () => {
            this._showUrduTranslation = !this._showUrduTranslation;
            this._renderUrduSupportPanel();
        });

        document.getElementById('urdu-saved-toggle-btn').addEventListener('click', () => {
            this._showUrduSavedWords = !this._showUrduSavedWords;
            this._renderUrduSupportPanel();
        });

        document.getElementById('urdu-clear-selection-btn').addEventListener('click', () => {
            this._clearSelectedUrduWord();
        });

        document.getElementById('story-screen').addEventListener('click', (e) => {
            if (e.target.closest('.urdu-save-word-btn')) {
                this._saveSelectedUrduWord();
            }
        });

        document.getElementById('story-title-translation-toggle').addEventListener('click', () => {
            this._showStoryTitleTranslation = !this._showStoryTitleTranslation;
            this._renderStoryPage();
        });

        document.getElementById('urdu-saved-words-panel').addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-remove-urdu-word]');
            if (removeBtn) {
                this._removeUrduSavedWord(removeBtn.dataset.removeUrduWord);
            }
        });

        // Delegated click for story cards
        document.getElementById('story-list').addEventListener('click', (e) => {
            const bbcBtn = e.target.closest('[data-bbc-feed-action]');
            if (bbcBtn) {
                const action = bbcBtn.dataset.bbcFeedAction;
                const url = bbcBtn.dataset.url;

                if (action === 'toggle') {
                    this._bbcFeedExpanded = !this._bbcFeedExpanded;
                    this._renderStoryList();
                    if (this._bbcFeedExpanded && !this._bbcFeedItems.length && !this._bbcFeedLoading) {
                        this._loadBbcFeed();
                    }
                } else if (action === 'refresh') {
                    this._loadBbcFeed({ force: true });
                } else if (action === 'add' && url) {
                    this._importBbcFeedItem(url);
                }
                return;
            }

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

            const card = e.target.closest('.reading-featured-card, .reading-quick-card, .story-card');
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

    _getCustomUrduStories() {
        return state.get('customUrduStories') || [];
    }

    _setCustomUrduStories(stories) {
        state.set('customUrduStories', stories);
        this._hydrateUrduLevels();
        this._buildStoryIndex();
    }

    _hydrateUrduLevels() {
        const importedStories = this._getCustomUrduStories();
        const importedLevel = importedStories.length ? [{
            id: 'U_IMPORTED',
            name: 'Imported Urdu',
            ageRange: 'Family',
            description: 'Articles and stories you added yourself.',
            stories: importedStories
        }] : [];
        this.urduLevels = [...this._baseUrduLevels, ...importedLevel];
    }

    _normalizeBbcUrl(url = '') {
        return String(url || '')
            .trim()
            .replace(/[?#].*$/, '')
            .replace(/\.lite$/, '')
            .replace(/\/$/, '');
    }

    _isExistingUrduSourceUrl(url) {
        const normalized = this._normalizeBbcUrl(url);
        if (!normalized) return false;
        return this._getAllUrduStories().some(story => this._normalizeBbcUrl(story.originalUrl) === normalized);
    }

    _proxyUrlsFor(url, kind = 'html') {
        const encoded = encodeURIComponent(url);
        const feedProxy = `https://api.allorigins.win/raw?url=${encoded}`;
        const codeTabsProxy = `https://api.codetabs.com/v1/proxy?quest=${encoded}`;
        return kind === 'feed'
            ? [feedProxy, codeTabsProxy]
            : [codeTabsProxy, feedProxy];
    }

    async _fetchTextWithProxy(url, kind = 'html') {
        let lastError = null;

        for (const proxyUrl of this._proxyUrlsFor(url, kind)) {
            try {
                const response = await fetch(proxyUrl, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const text = await response.text();
                if (!text || text.length < 50) {
                    throw new Error('Empty response');
                }

                return text;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Unable to fetch remote content');
    }

    _extractBbcArticleId(url = '') {
        const match = String(url).match(/\/articles\/([a-z0-9]+)/i);
        return match ? match[1].toLowerCase() : null;
    }

    _buildBbcStoryId(url = '') {
        const articleId = this._extractBbcArticleId(url);
        return articleId ? `bbc-urdu-${articleId}` : `bbc-urdu-${Date.now()}`;
    }

    _cleanBbcFeedTitle(text = '') {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    _formatFeedFetchedAt() {
        if (!this._bbcFeedFetchedAt) return '';
        const date = new Date(this._bbcFeedFetchedAt);
        if (Number.isNaN(date.getTime())) return '';
        return `Updated ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }

    async _translateUrduHeadline(text = '') {
        const cleanText = this._cleanBbcFeedTitle(text);
        if (!cleanText) return '';

        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ur&tl=en&dt=t&q=${encodeURIComponent(cleanText)}`;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const translated = (data?.[0] || []).map(part => part?.[0] || '').join('').trim();
            return translated;
        } catch (error) {
            console.warn('Failed to translate BBC Urdu headline:', error);
            return '';
        }
    }

    _buildBbcFeedSelectionSection() {
        const feedHint = this._formatFeedFetchedAt();
        const buttonLabel = this._bbcFeedExpanded ? 'Hide choices' : 'Choose article';

        let panel = '';
        if (this._bbcFeedExpanded) {
            let body = '';
            if (this._bbcFeedLoading) {
                body = '<div class="urdu-bbc-empty">Loading the latest BBC Urdu articles…</div>';
            } else if (this._bbcFeedError) {
                body = `<div class="urdu-bbc-empty urdu-bbc-error">${this._escapeHtml(this._bbcFeedError)}</div>`;
            } else if (!this._bbcFeedItems.length) {
                body = '<div class="urdu-bbc-empty">No BBC Urdu article choices are ready yet.</div>';
            } else {
                body = this._bbcFeedItems.map(item => {
                    const alreadyAdded = this._isExistingUrduSourceUrl(item.url);
                    const isImporting = this._bbcImportingUrl === item.url;
                    const buttonText = alreadyAdded ? 'Added' : isImporting ? 'Adding…' : 'Add';
                    return `
                        <div class="urdu-bbc-feed-row">
                            <div class="urdu-bbc-feed-main">
                                <div class="urdu-bbc-feed-title" dir="rtl">${this._escapeHtml(item.title)}</div>
                                ${item.titleEnglish ? `<div class="urdu-bbc-feed-title-english">${this._escapeHtml(item.titleEnglish)}</div>` : ''}
                                <div class="urdu-bbc-feed-meta">BBC News Urdu • ${this._escapeHtml(this._formatUrduPublishedDate({ publishedAt: item.publishedAt, sourceType: 'news' }) || 'Latest')}</div>
                                ${item.summary ? `<div class="urdu-bbc-feed-summary" dir="rtl">${this._escapeHtml(item.summary)}</div>` : ''}
                            </div>
                            <button class="primary-btn urdu-bbc-feed-add" type="button" data-bbc-feed-action="add" data-url="${this._escapeHtml(item.url)}" ${alreadyAdded || isImporting ? 'disabled' : ''}>${buttonText}</button>
                        </div>
                    `;
                }).join('');
            }

            panel = `
                <div class="urdu-bbc-panel">
                    <div class="urdu-bbc-panel-head">
                        <div>
                            <div class="urdu-library-kicker">Fresh BBC choices</div>
                            <div class="urdu-bbc-panel-copy">Pick one recent BBC Urdu article to place on the shelf.</div>
                        </div>
                        <button class="secondary-btn urdu-bbc-refresh" type="button" data-bbc-feed-action="refresh">Refresh</button>
                    </div>
                    ${feedHint ? `<div class="urdu-bbc-feed-hint">${this._escapeHtml(feedHint)}</div>` : ''}
                    <div class="urdu-bbc-feed-list">${body}</div>
                </div>
            `;
        }

        return `
            <section class="urdu-library-section urdu-bbc-section">
                <div class="urdu-library-heading-row">
                    <div>
                        <div class="urdu-library-kicker">For grown-ups</div>
                        <h3 class="urdu-library-heading">Add a fresh BBC Urdu article</h3>
                    </div>
                    <button class="secondary-btn urdu-bbc-toggle" type="button" data-bbc-feed-action="toggle">${buttonLabel}</button>
                </div>
                <div class="urdu-bbc-feed-hint">When you want something new, choose one recent BBC Urdu article and place it on the shelf.</div>
                ${panel}
            </section>
        `;
    }

    async _loadBbcFeed({ force = false } = {}) {
        if (this._bbcFeedLoading) return;
        if (this._bbcFeedItems.length && !force) return;

        this._bbcFeedLoading = true;
        this._bbcFeedError = '';
        this._renderStoryList();

        try {
            const xml = await this._fetchTextWithProxy('https://feeds.bbci.co.uk/urdu/rss.xml', 'feed');
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const items = [...doc.querySelectorAll('item')]
                .map(item => ({
                    title: this._cleanBbcFeedTitle(item.querySelector('title')?.textContent || ''),
                    url: this._normalizeBbcUrl(item.querySelector('link')?.textContent || ''),
                    publishedAt: item.querySelector('pubDate')?.textContent || '',
                    summary: this._cleanBbcFeedTitle(item.querySelector('description')?.textContent || '')
                }))
                .filter(item => item.title && /\/articles\//.test(item.url))
                .slice(0, 10);

            this._bbcFeedItems = await Promise.all(items.map(async item => ({
                ...item,
                titleEnglish: await this._translateUrduHeadline(item.title)
            })));
            this._bbcFeedFetchedAt = new Date().toISOString();
        } catch (error) {
            console.error('Failed to load BBC Urdu feed:', error);
            this._bbcFeedError = 'Could not load the BBC Urdu article list just now.';
        } finally {
            this._bbcFeedLoading = false;
            this._renderStoryList();
        }
    }

    _looksLikeUrduText(text = '') {
        const matches = String(text).match(/[؀-ۿ]/g) || [];
        return matches.length >= 10;
    }

    _extractBbcLiteBlocks(doc) {
        const main = doc.querySelector('main');
        const title = this._cleanBbcFeedTitle(doc.querySelector('h1')?.textContent || '');
        if (!main) return [];

        return [...main.children]
            .map(node => this._cleanBbcFeedTitle(node.textContent || ''))
            .filter(text => {
                if (!text) return false;
                if (text === title) return false;
                if (!this._looksLikeUrduText(text)) return false;
                if (text.startsWith('آپ اس وقت اس ویب سائٹ')) return false;
                if (text.startsWith('مجھے مرکزی ویب سائٹ')) return false;
                if (text.startsWith('کم ڈیٹا استعمال کرنے والے ورژن')) return false;
                if (text.startsWith('مضمون کی تفصیل')) return false;
                if (text.startsWith('Skip ')) return false;
                if (text.includes('سب سے زیادہ پڑھی جانے والی')) return false;
                if (text.includes('Skip content and continue reading')) return false;
                return true;
            });
    }

    _chunkUrduArticleBlocks(blocks = []) {
        const pages = [];
        let current = [];
        let currentChars = 0;

        const pushCurrent = () => {
            if (!current.length) return;
            pages.push({ text: current.join('\n\n') });
            current = [];
            currentChars = 0;
        };

        blocks.forEach(block => {
            const nextChars = currentChars + block.length;
            if (current.length && (current.length >= 3 || nextChars > 900)) {
                pushCurrent();
            }
            current.push(block);
            currentChars += block.length;
        });

        pushCurrent();
        return pages;
    }

    _createBbcStoryFromHtml(item, html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const title = this._cleanBbcFeedTitle(doc.querySelector('h1')?.textContent || item.title);
        const blocks = this._extractBbcLiteBlocks(doc);
        const pages = this._chunkUrduArticleBlocks(blocks);

        if (!pages.length) {
            throw new Error('No readable article paragraphs were found.');
        }

        return {
            id: this._buildBbcStoryId(item.url),
            title,
            titleEnglish: item.titleEnglish || '',
            source: 'BBC News Urdu',
            sourceType: 'news',
            direction: 'rtl',
            publishedAt: item.publishedAt || new Date().toISOString(),
            originalUrl: item.url,
            importSource: 'bbc-rss',
            addedAt: new Date().toISOString(),
            pages
        };
    }

    async _importBbcFeedItem(url) {
        const normalizedUrl = this._normalizeBbcUrl(url);
        if (!normalizedUrl || this._bbcImportingUrl === normalizedUrl || this._isExistingUrduSourceUrl(normalizedUrl)) {
            return;
        }

        const item = this._bbcFeedItems.find(feedItem => feedItem.url === normalizedUrl);
        if (!item) return;

        this._bbcImportingUrl = normalizedUrl;
        this._bbcFeedError = '';
        this._renderStoryList();

        try {
            const articleUrl = `${normalizedUrl}.lite`;
            const html = await this._fetchTextWithProxy(articleUrl, 'html');
            const story = this._createBbcStoryFromHtml(item, html);
            const existing = this._getCustomUrduStories().filter(existingStory => this._normalizeBbcUrl(existingStory.originalUrl) !== normalizedUrl);
            this._setCustomUrduStories([story, ...existing].slice(0, 40));
            state.set('currentUrduStoryId', story.id);
            state.set('archivedUrduStoryIds', (state.get('archivedUrduStoryIds') || []).filter(id => id !== story.id));
        } catch (error) {
            console.error('Failed to import BBC Urdu article:', error);
            this._bbcFeedError = 'The article list loaded, but this article could not be brought in.';
        } finally {
            this._bbcImportingUrl = '';
            this._renderStoryList();
        }
    }

    _renderReadingScreen() {
        // Set active tab
        const tab = state.get('readingTab') || 'library';
        document.querySelectorAll('.reading-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.readingTab === tab);
        });

        this._populateLevelSelector();
        this._renderStoryList();
        this._syncReadingSearchUi(tab);

        const input = document.getElementById('search-input');
        const results = document.getElementById('search-results');
        const storyList = document.getElementById('story-list');
        if (!input || !results || !storyList) return;

        if (tab === 'urdu') {
            this._resetSearchSurface();
            return;
        }

        const query = input.value.trim().toLowerCase();
        if (this._isReadingSearchOpen() && query.length >= 2) {
            this._renderSearchResults(query);
        } else {
            this._resetSearchSurface();
        }
    }

    _isReadingSearchOpen() {
        return !!state.get('readingSearchOpen');
    }

    _setReadingSearchOpen(open, { clear = false, focus = false } = {}) {
        state.set('readingSearchOpen', !!open);

        const input = document.getElementById('search-input');
        if (clear && input) {
            input.value = '';
        }

        if (clear) {
            this._resetSearchSurface();
        }

        if (focus && input) {
            requestAnimationFrame(() => input.focus());
        }
    }

    _syncReadingSearchUi(tab = state.get('readingTab') || 'library') {
        const searchSection = document.getElementById('reading-search-section');
        const searchToggle = document.getElementById('reading-search-toggle');
        const searchToggleLabel = document.getElementById('reading-search-toggle-label');
        const levelSelector = document.querySelector('#reading-screen .reading-level-selector');
        const isUrdu = tab === 'urdu';
        const isOpen = this._isReadingSearchOpen() && !isUrdu;

        if (levelSelector) {
            levelSelector.classList.toggle('hidden', isUrdu);
        }

        if (searchSection) {
            searchSection.classList.toggle('hidden', !isOpen);
        }

        if (searchToggle) {
            searchToggle.classList.toggle('hidden', isUrdu);
            searchToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            searchToggle.classList.toggle('is-open', isOpen);
        }

        if (searchToggleLabel) {
            searchToggleLabel.textContent = isOpen ? 'Hide search' : 'Search';
        }
    }

    _populateLevelSelector() {
        const tab = state.get('readingTab') || 'library';
        const { levels, stateKey, attribution } = this._getReadingSourceConfig(tab);

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

    _getUrduStoryPreparationState(story) {
        const isBbc = /BBC/i.test(story?.source || '') || story?.importSource === 'bbc-rss';
        if (!isBbc) return null;
        if (story.analysisState === 'smartened') {
            return { label: 'Reading-ready', className: 'is-smartened' };
        }
        return { label: 'Needs smoothing', className: 'is-basic' };
    }

    _buildUrduStoryRow(story, { archived = false, current = false, featured = false } = {}) {
        const progress = this._getUrduStoryProgress(story);
        const resumePage = progress.bookmark?.page;
        const sourceLine = [story.source, this._formatUrduPublishedDate(story)].filter(Boolean).join(' • ');
        const progressLine = `${progress.percent}% complete • ${progress.currentPage || 0}/${progress.totalPages} pages`;
        const status = current ? 'Current' : archived ? 'Archived' : progress.status;
        const actionLabel = archived ? 'Restore to shelf' : featured ? 'Put away for now' : 'Archive';
        const preparationState = this._getUrduStoryPreparationState(story);
        const primaryLabel = archived
            ? 'Restore item'
            : progress.isFinished
                ? 'Read again'
                : progress.status === 'New'
                    ? featured ? 'Start reading' : 'Open'
                    : current || featured
                        ? 'Continue reading'
                        : 'Continue';
        const progressSummary = progress.isFinished
            ? `Finished • ${progress.totalPages} pages`
            : progress.currentPage > 0
                ? `Page ${progress.currentPage} of ${progress.totalPages}`
                : `Start with page 1 of ${progress.totalPages}`;
        const showStatusPill = !(current && featured);
        const showDetailLine = !featured;
        const rowClasses = [
            'urdu-item-row',
            current ? 'is-current' : '',
            featured ? 'is-featured' : '',
            archived ? 'is-archived' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${rowClasses}" data-story-id="${story.id}" ${resumePage !== undefined ? `data-resume-page="${resumePage}"` : ''}>
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
                    <div class="urdu-item-progress-copy">${this._escapeHtml(progressSummary)}</div>
                    ${(showStatusPill || preparationState) ? `
                        <div class="urdu-item-status-row">
                            ${showStatusPill ? `<div class="urdu-item-status-pill">${this._escapeHtml(status)}</div>` : ''}
                            ${preparationState ? `<div class="urdu-item-analysis-chip ${preparationState.className}">${this._escapeHtml(preparationState.label)}</div>` : ''}
                        </div>
                    ` : ''}
                    ${showDetailLine ? `<div class="urdu-item-meta urdu-item-progress-line">${this._escapeHtml(progressLine)}</div>` : ''}
                </div>
                <div class="urdu-item-actions ${featured ? 'is-featured-actions' : ''}">
                    <button class="primary-btn urdu-item-action" type="button" data-urdu-story-action="open" data-story-id="${story.id}">${primaryLabel}</button>
                    <button class="secondary-btn urdu-item-action ${featured && !archived ? 'is-soft' : ''}" type="button" data-urdu-story-action="${archived ? 'restore' : 'archive'}" data-story-id="${story.id}">${actionLabel}</button>
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
        const currentStory = activeStories.find(story => story.id === currentId)
            || activeStories.find(story => this._getUrduStoryProgress(story).status === 'In progress')
            || activeStories[0]
            || null;
        const activeList = activeStories.filter(story => story.id !== currentStory?.id);

        list.innerHTML = `
            <div class="urdu-reading-dashboard">
                <section class="urdu-library-section urdu-current-section ${currentStory ? '' : 'hidden'}">
                    <div class="urdu-library-heading-row urdu-hero-heading-row">
                        <div>
                            <div class="urdu-library-kicker">Pick up again</div>
                            <h3 class="urdu-library-heading urdu-hero-heading">Continue your Urdu reading</h3>
                            <div class="urdu-library-copy">Your current piece stays here so returning to reading feels like one calm tap.</div>
                        </div>
                    </div>
                    ${currentStory ? this._buildUrduStoryRow(currentStory, { current: true, featured: true }) : ''}
                </section>

                <div class="urdu-library-lower-grid">
                    <section class="urdu-library-section urdu-library-main-section">
                        <div class="urdu-library-heading-row">
                            <div>
                                <div class="urdu-library-kicker">Your reading shelf</div>
                                <h3 class="urdu-library-heading">Urdu library</h3>
                                <div class="urdu-library-copy">Choose another story, revisit a finished favourite, or keep the shelf feeling alive.</div>
                            </div>
                            <div class="urdu-library-count">${activeStories.length} on your shelf</div>
                        </div>
                        <div class="urdu-library-list urdu-library-card-list">
                            ${activeList.length
                                ? activeList.map(story => this._buildUrduStoryRow(story)).join('')
                                : '<div class="urdu-library-empty">No other active Urdu items yet.</div>'}
                        </div>
                    </section>

                    ${this._buildBbcFeedSelectionSection()}
                </div>

                <section class="urdu-library-section urdu-archive-section ${archivedStories.length ? '' : 'hidden'}">
                    <div class="urdu-library-heading-row">
                        <div>
                            <div class="urdu-library-kicker">Archive</div>
                            <h3 class="urdu-library-heading">Older items, tucked away</h3>
                            <div class="urdu-library-copy">Keep the live shelf focused while older pieces stay easy to retrieve.</div>
                        </div>
                        <button class="secondary-btn urdu-archive-toggle" type="button" data-urdu-story-action="toggle-archive">${showArchived ? 'Hide older items' : `See older items (${archivedStories.length})`}</button>
                    </div>
                    <div class="urdu-library-list urdu-library-card-list ${showArchived ? '' : 'hidden'}" id="urdu-archive-list">
                        ${archivedStories.map(story => this._buildUrduStoryRow(story, { archived: true })).join('')}
                    </div>
                </section>
            </div>
        `;
    }

    _renderStoryList() {
        const tab = state.get('readingTab') || 'library';
        const { stateKey, levels } = this._getReadingSourceConfig(tab);
        const levelId = state.get(stateKey);
        const level = levels.find(l => l.id === levelId);
        const list = document.getElementById('story-list');
        list.classList.toggle('urdu-story-list', tab === 'urdu');
        list.innerHTML = '';

        if (tab === 'urdu') {
            this._renderUrduStoryList(list);
            return;
        }

        if (!level) return;

        const readStories = state.get('readStories') || [];
        const bookmarks = state.get('bookmarks') || {};
        const rankedStories = level.stories.map((story, index) => ({
            story,
            index,
            isRead: readStories.includes(story.id),
            bookmark: bookmarks[story.id],
            totalPages: story.pages.length,
            hasImage: Boolean(story.pages[0]?.image)
        }));

        const priorityStories = [...rankedStories].sort((a, b) => {
            const aScore = a.bookmark ? 3 : a.isRead ? 1 : 2;
            const bScore = b.bookmark ? 3 : b.isRead ? 1 : 2;
            if (bScore !== aScore) return bScore - aScore;
            if (!!b.bookmark !== !!a.bookmark) return Number(!!b.bookmark) - Number(!!a.bookmark);
            return a.index - b.index;
        });

        const featured = priorityStories[0];
        const quickPicks = priorityStories.slice(1, 3);
        const shelfIds = new Set([featured?.story.id, ...quickPicks.map(item => item.story.id)].filter(Boolean));
        const gridStories = rankedStories.filter(entry => !shelfIds.has(entry.story.id));

        list.innerHTML = `
            ${featured ? this._buildReadingShelfMarkup({ tab, level, featured, quickPicks }) : ''}
            ${gridStories.length ? `
            <section class="reading-library-section">
                <div class="reading-library-header">
                    <div>
                        <h3 class="reading-library-title">${tab === 'library' ? 'More books in this level' : 'More stories in this level'}</h3>
                        <p class="reading-library-copy">Pick a book-sized card and jump straight in.</p>
                    </div>
                </div>
                <div class="story-grid">
                    ${gridStories.map(entry => this._buildStoryCardMarkup(entry.story, { tab, isRead: entry.isRead, bookmark: entry.bookmark, hasImage: entry.hasImage })).join('')}
                </div>
            </section>` : ''}
        `;
    }

    _buildReadingShelfMarkup({ level, featured, quickPicks }) {
        const featureStory = featured.story;
        const bookmark = featured.bookmark;
        const statusLabel = bookmark ? 'Continue reading' : featured.isRead ? 'Read again' : 'Start here';
        const progressLine = bookmark
            ? `Resume on page ${bookmark.page + 1} of ${featured.totalPages}`
            : featured.isRead
                ? `${featured.totalPages} pages · finished already`
                : `${featured.totalPages} pages ready to read`;
        const featuredCta = bookmark ? 'Resume this book' : featured.isRead ? 'Open again' : 'Open this book';

        return `
            <section class="reading-shelf">
                <button class="reading-featured-card" type="button" data-story-id="${featureStory.id}" ${bookmark ? `data-resume-page="${bookmark.page}"` : ''}>
                    <div class="reading-featured-copy">
                        <div class="reading-featured-kicker">${this._escapeHtml(statusLabel)} • ${this._escapeHtml(level.name)}</div>
                        <div class="reading-featured-title" dir="${featureStory.direction || 'ltr'}">${this._escapeHtml(featureStory.title)}</div>
                        ${featureStory.titleEnglish ? `<div class="reading-featured-subtitle">${this._escapeHtml(featureStory.titleEnglish)}</div>` : ''}
                        <div class="reading-featured-meta">${this._escapeHtml(progressLine)}</div>
                        <div class="reading-featured-cta">${this._escapeHtml(featuredCta)} →</div>
                    </div>
                    <div class="reading-featured-cover">${this._buildStoryCoverBadge(featureStory, featured.hasImage)}</div>
                </button>
                ${quickPicks.length ? `
                    <div class="reading-quick-row">
                        ${quickPicks.map(item => {
                            const quickStatus = item.bookmark
                                ? `Page ${item.bookmark.page + 1} of ${item.totalPages}`
                                : item.isRead
                                    ? 'Finished'
                                    : `${item.totalPages} pages`;
                            return `
                                <button class="reading-quick-card" type="button" data-story-id="${item.story.id}" ${item.bookmark ? `data-resume-page="${item.bookmark.page}"` : ''}>
                                    <div class="reading-quick-cover">${this._buildStoryCoverBadge(item.story, item.hasImage)}</div>
                                    <div>
                                        <div class="reading-quick-title" dir="${item.story.direction || 'ltr'}">${this._escapeHtml(item.story.title)}</div>
                                        <div class="reading-quick-meta">${this._escapeHtml(quickStatus)}</div>
                                    </div>
                                </button>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </section>
        `;
    }

    _buildStoryCardMarkup(story, { tab = 'library', isRead = false, bookmark = null, hasImage = false } = {}) {
        const dir = story.direction || 'ltr';
        const sourceLine = tab === 'library'
            ? [story.author, story.source].filter(Boolean).join(' · ')
            : [story.author, story.illustrator].filter(Boolean).join(' · ');
        const progressLabel = bookmark
            ? `Continue from page ${bookmark.page + 1}`
            : isRead
                ? 'Read again'
                : 'Open book';
        const statusChip = bookmark ? 'In progress' : isRead ? 'Finished' : 'Ready';
        const pagesLabel = `${story.pages.length} page${story.pages.length === 1 ? '' : 's'}`;

        return `
            <button class="story-card" type="button" data-story-id="${story.id}" data-source="${tab}" ${bookmark ? `data-resume-page="${bookmark.page}"` : ''}>
                <div class="story-card-cover">${this._buildStoryCoverBadge(story, hasImage)}</div>
                <div class="story-card-info">
                    <div class="story-card-topline">
                        <span class="story-card-chip">${this._escapeHtml(statusChip)}</span>
                        <span class="story-card-pages">${this._escapeHtml(pagesLabel)}</span>
                    </div>
                    <div class="story-card-title" dir="${dir}">${this._escapeHtml(story.title)}</div>
                    ${story.titleEnglish ? `<div class="story-card-subtitle">${this._escapeHtml(story.titleEnglish)}</div>` : ''}
                    ${sourceLine ? `<div class="story-card-byline">${this._escapeHtml(sourceLine)}</div>` : ''}
                    <div class="story-card-foot">${this._escapeHtml(progressLabel)}</div>
                </div>
                <span class="story-card-status">${isRead ? '✓' : '→'}</span>
            </button>
        `;
    }

    _buildStoryCoverBadge(story, hasImage = false) {
        if (hasImage) return '🖼️';
        const label = String(story.titleEnglish || story.title || 'B').trim().charAt(0).toUpperCase();
        return this._escapeHtml(label || 'B');
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

                this._showStoryTitleTranslation = false;
                this._recordRecentItem(this._buildStoryResumeItem(storyId, this.currentStoryPage));
                this._selectedStoryWord = null;
                this._showStorySavedWords = false;
                this._storyAudioStatusOverride = '';
                this._stopStoryAudio();

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
        if (this._selectedStoryWord && (this._selectedStoryWord.storyId !== story.id || Number(this._selectedStoryWord.page) !== Number(this.currentStoryPage))) {
            this._selectedStoryWord = null;
            this._storyAudioStatusOverride = '';
        }
        const direction = story.direction || 'ltr';
        const isInteractiveUrdu = this._storySupportsUrduTools(story);
        const isUrduArticle = this._isUrduArticleStory(story);

        const storyTitle = document.getElementById('story-title');
        const storyTitleSubtitle = document.getElementById('story-title-subtitle');
        const storyTitleTranslationToggle = document.getElementById('story-title-translation-toggle');
        const storyText = document.getElementById('story-text');
        const storyScreen = document.getElementById('story-screen');

        storyTitle.textContent = story.title;
        storyTitle.dir = direction;
        const shouldCollapseEnglishTitle = isUrduArticle || (isInteractiveUrdu && window.matchMedia?.('(max-width: 720px)').matches);
        if (story.titleEnglish) {
            storyTitleSubtitle.textContent = story.titleEnglish;
            if (shouldCollapseEnglishTitle) {
                storyTitleTranslationToggle.classList.remove('hidden');
                storyTitleTranslationToggle.textContent = this._showStoryTitleTranslation ? 'Hide English title' : 'Show English title';
                storyTitleTranslationToggle.setAttribute('aria-expanded', this._showStoryTitleTranslation ? 'true' : 'false');
                storyTitleSubtitle.classList.toggle('hidden', !this._showStoryTitleTranslation);
            } else {
                storyTitleTranslationToggle.classList.add('hidden');
                storyTitleTranslationToggle.textContent = '';
                storyTitleTranslationToggle.setAttribute('aria-expanded', 'false');
                storyTitleSubtitle.classList.remove('hidden');
            }
        } else {
            storyTitleSubtitle.textContent = '';
            storyTitleSubtitle.classList.add('hidden');
            storyTitleTranslationToggle.classList.add('hidden');
            storyTitleTranslationToggle.textContent = '';
            storyTitleTranslationToggle.setAttribute('aria-expanded', 'false');
        }
        this._renderCurrentStoryText();
        document.getElementById('story-page-text').textContent =
            `Page ${this.currentStoryPage + 1} of ${story.pages.length}`;
        document.getElementById('story-progress-fill').style.width =
            `${((this.currentStoryPage + 1) / story.pages.length) * 100}%`;
        this._updateStoryFontControls();
        this._renderStorySelectionControls();

        const storyContent = document.getElementById('story-content');
        storyScreen.classList.toggle('article-reader-mode', isUrduArticle);
        storyScreen.classList.toggle('story-custom-selection-mode', this._storySupportsCustomWordSelection(story));
        storyContent.classList.toggle('urdu-story-layout', isInteractiveUrdu);
        storyContent.classList.toggle('urdu-article-reader-layout', isUrduArticle);

        // Reset scroll position so each new page starts at the top
        storyContent.scrollTop = 0;

        if (!isInteractiveUrdu) {
            this._selectedUrduWord = null;
            this._pendingUrduSelectionText = '';
            this._showUrduTranslation = false;
            this._showUrduSavedWords = false;
            this._showStoryTitleTranslation = false;
        }
        if (!this._storySupportsCustomWordSelection(story)) {
            this._selectedStoryWord = null;
            this._showStorySavedWords = false;
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

    _getStoryFontScale() {
        const rawScale = Number(state.get('storyFontScale'));
        if (!Number.isFinite(rawScale)) {
            return 1;
        }
        return Math.min(this._storyFontScaleMax, Math.max(this._storyFontScaleMin, rawScale));
    }

    _getTouchDistance(touches = []) {
        if (!touches || touches.length < 2) return 0;
        const [firstTouch, secondTouch] = touches;
        const deltaX = Number(secondTouch.clientX) - Number(firstTouch.clientX);
        const deltaY = Number(secondTouch.clientY) - Number(firstTouch.clientY);
        return Math.hypot(deltaX, deltaY);
    }

    _beginStoryPinchResize(touches = []) {
        const distance = this._getTouchDistance(touches);
        if (!distance) return;
        this._storyPinchState = {
            initialDistance: distance,
            initialScale: this._getStoryFontScale()
        };
        this._storyAudioStatusOverride = this._storyPinchResizeHint;
        this._renderStorySelectionControls();
    }

    _updateStoryPinchResize(touches = []) {
        if (!this._storyPinchState) return;
        const distance = this._getTouchDistance(touches);
        if (!distance || !this._storyPinchState.initialDistance) return;
        const pinchRatio = distance / this._storyPinchState.initialDistance;
        const rawScale = this._storyPinchState.initialScale * pinchRatio;
        const nextScale = Math.min(this._storyFontScaleMax, Math.max(this._storyFontScaleMin, Number(rawScale.toFixed(2))));
        if (Math.abs(nextScale - this._getStoryFontScale()) < 0.01) return;
        state.set('storyFontScale', nextScale);
        this._applyStoryFontScale(nextScale);
        this._storyAudioStatusOverride = `${this._storyPinchResizeHint} Text size ${Math.round(nextScale * 100)}%.`;
        this._renderStorySelectionControls();
    }

    _endStoryPinchResize(touches = []) {
        if (!this._storyPinchState) return;
        if (touches && touches.length >= 2) {
            this._beginStoryPinchResize(touches);
            return;
        }
        this._storyPinchState = null;
        if (this._storyAudioStatusOverride?.includes(this._storyPinchResizeHint)) {
            this._storyAudioStatusOverride = '';
        }
        this._renderStorySelectionControls();
    }

    _applyStoryFontScale(scale = this._getStoryFontScale()) {
        const safeScale = Math.min(this._storyFontScaleMax, Math.max(this._storyFontScaleMin, Number(scale) || 1));
        document.documentElement.style.setProperty('--story-font-scale', safeScale.toFixed(2));
        this._applyStoryFontScaleToCurrentStoryText(safeScale);
        this._updateStoryFontControls(safeScale);
    }

    _changeStoryFontScale(delta = 0) {
        const currentScale = this._getStoryFontScale();
        const nextScale = Math.min(
            this._storyFontScaleMax,
            Math.max(this._storyFontScaleMin, Number((currentScale + delta).toFixed(2)))
        );

        state.set('storyFontScale', nextScale);
        this._applyStoryFontScale(nextScale);
    }

    _resetStoryFontScale() {
        state.set('storyFontScale', 1);
        this._applyStoryFontScale(1);
    }

    _updateStoryFontControls(scale = this._getStoryFontScale()) {
        const storyFontLabel = document.getElementById('story-font-label');
        const decreaseBtn = document.getElementById('story-font-decrease-btn');
        const increaseBtn = document.getElementById('story-font-increase-btn');
        const resetBtn = document.getElementById('story-font-reset-btn');
        if (!storyFontLabel || !decreaseBtn || !increaseBtn || !resetBtn) return;

        const percent = Math.round(scale * 100);
        storyFontLabel.textContent = `Text size ${percent}%`;
        decreaseBtn.disabled = scale <= this._storyFontScaleMin + 0.001;
        increaseBtn.disabled = scale >= this._storyFontScaleMax - 0.001;
        resetBtn.disabled = Math.abs(scale - 1) < 0.001;
    }

    _storySupportsEnglishTts(story = this.currentStory) {
        return this._storySupportsCustomWordSelection(story);
    }

    _storySupportsCustomWordSelection(story = this.currentStory) {
        if (!story) return false;
        if ((story.direction || 'ltr') !== 'ltr') return false;
        const text = story.pages?.[this.currentStoryPage]?.text || '';
        return Boolean(String(text).trim());
    }

    _splitStoryParagraphs(text = '') {
        return String(text || '')
            .split(/\n\s*\n/g)
            .map(paragraph => paragraph.trim())
            .filter(Boolean);
    }

    _normalizeStoryWordText(text = '') {
        return String(text || '')
            .replace(/^[^\p{L}\p{N}'’-]+|[^\p{L}\p{N}'’-]+$/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    _getSelectedStoryWord() {
        if (!this._selectedStoryWord) return null;
        if (this._selectedStoryWord.storyId !== this.currentStory?.id) return null;
        if (Number(this._selectedStoryWord.page) !== Number(this.currentStoryPage)) return null;
        return this._selectedStoryWord;
    }

    _extractStoryWordSelectionData(button) {
        if (!button) return null;
        const word = this._normalizeStoryWordText(button.dataset.storyWordNormalized || button.dataset.storyWord || button.textContent || '');
        const paragraphIndex = Number(button.dataset.paragraphIndex);
        const occurrenceIndex = Number(button.dataset.occurrenceIndex);
        const tokenIndex = Number(button.dataset.tokenIndex);
        if (!word || Number.isNaN(paragraphIndex) || Number.isNaN(occurrenceIndex) || Number.isNaN(tokenIndex)) {
            return null;
        }
        return { word, paragraphIndex, occurrenceIndex, tokenIndex };
    }

    _beginStoryWordDragSelection(button, pointerId = null) {
        const anchor = this._extractStoryWordSelectionData(button);
        if (!anchor) return;
        this._storyWordDragState = {
            pointerId,
            anchor,
            lastTokenIndex: anchor.tokenIndex,
            hasDragged: false
        };
        this._suppressStoryWordClick = false;
    }

    _updateStoryWordDragSelection(clientX, clientY, pointerId = null) {
        if (!this._storyWordDragState) return;
        if (this._storyWordDragState.pointerId !== null && pointerId !== null && this._storyWordDragState.pointerId !== pointerId) {
            return;
        }
        const hovered = document.elementFromPoint(clientX, clientY)?.closest?.('.story-word-button');
        const nextSelection = this._extractStoryWordSelectionData(hovered);
        if (!nextSelection) return;
        if (Number(nextSelection.paragraphIndex) !== Number(this._storyWordDragState.anchor.paragraphIndex)) return;
        if (Number(nextSelection.tokenIndex) === Number(this._storyWordDragState.lastTokenIndex)) return;
        this._storyWordDragState.lastTokenIndex = Number(nextSelection.tokenIndex);
        this._storyWordDragState.hasDragged = true;
        this._suppressStoryWordClick = true;
        this._selectStoryWordRange(this._storyWordDragState.anchor, nextSelection);
    }

    _endStoryWordDragSelection(pointerId = null, { cancelled = false } = {}) {
        if (!this._storyWordDragState) return;
        if (this._storyWordDragState.pointerId !== null && pointerId !== null && this._storyWordDragState.pointerId !== pointerId) {
            return;
        }
        if (cancelled && this._storyWordDragState.hasDragged) {
            this._clearStoryWordSelection({ preserveStatus: true });
        }
        this._storyWordDragState = null;
    }

    _buildStorySelectionTextFromRange(paragraphIndex, startTokenIndex, endTokenIndex) {
        const storyText = document.getElementById('story-text');
        if (!storyText) return '';
        const buttons = Array.from(storyText.querySelectorAll(`.story-word-button[data-paragraph-index="${paragraphIndex}"]`));
        const selectedButtons = buttons.filter((button) => {
            const tokenIndex = Number(button.dataset.tokenIndex);
            return tokenIndex >= Number(startTokenIndex) && tokenIndex <= Number(endTokenIndex);
        });
        return selectedButtons
            .map(button => this._normalizeStoryWordText(button.dataset.storyWordNormalized || button.dataset.storyWord || button.textContent || ''))
            .filter(Boolean)
            .join(' ')
            .trim();
    }

    _selectionIsSingleWord(selection = this._getSelectedStoryWord()) {
        if (!selection) return false;
        return Number(selection.startTokenIndex ?? selection.tokenIndex ?? -1) === Number(selection.endTokenIndex ?? selection.tokenIndex ?? -1);
    }

    _clearStoryWordSelection({ preserveStatus = false } = {}) {
        this._selectedStoryWord = null;
        this._storyWordDragState = null;
        this._suppressStoryWordClick = false;
        this._showStorySavedWords = false;
        this._showStorySelectionExtras = false;
        if (!preserveStatus) {
            this._storyAudioStatusOverride = '';
        }
        this._renderCurrentStoryText();
        this._renderStorySelectionControls();
    }

    _dismissStorySelectionSheet() {
        this._showStorySavedWords = false;
        this._showStorySelectionExtras = false;
        this._storySelectionSheetDrag = null;
        this._setStorySelectionSheetOffset(0);
        this._stopStoryAudio({ preserveStatus: false });
        this._clearStoryWordSelection();
    }

    _setStorySelectionSheetOffset(offset = 0) {
        const controls = document.getElementById('story-selection-controls');
        if (!controls) return;
        const safeOffset = Math.max(0, Number(offset) || 0);
        controls.style.setProperty('--story-selection-sheet-offset', `${safeOffset}px`);
    }

    _bindStorySelectionSheetDismiss() {
        const handle = document.getElementById('story-selection-sheet-handle');
        const controls = document.getElementById('story-selection-controls');
        if (!handle || !controls) return;

        const startDrag = (clientY) => {
            this._storySelectionSheetDrag = {
                startY: Number(clientY) || 0,
                currentOffset: 0
            };
            controls.classList.add('is-dragging');
            this._setStorySelectionSheetOffset(0);
        };

        const updateDrag = (clientY) => {
            if (!this._storySelectionSheetDrag) return;
            const nextOffset = Math.max(0, Number(clientY) - this._storySelectionSheetDrag.startY);
            this._storySelectionSheetDrag.currentOffset = nextOffset;
            this._setStorySelectionSheetOffset(nextOffset);
        };

        const endDrag = () => {
            if (!this._storySelectionSheetDrag) return;
            const dragDistance = this._storySelectionSheetDrag.currentOffset;
            const shouldDismiss = dragDistance > 72 || dragDistance < 8;
            controls.classList.remove('is-dragging');
            this._storySelectionSheetDrag = null;
            this._setStorySelectionSheetOffset(0);
            if (shouldDismiss) {
                this._dismissStorySelectionSheet();
            }
        };

        handle.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            handle.setPointerCapture?.(e.pointerId);
            startDrag(e.clientY);
        });

        handle.addEventListener('pointermove', (e) => {
            if (!this._storySelectionSheetDrag) return;
            updateDrag(e.clientY);
        });

        const releaseDrag = (e) => {
            handle.releasePointerCapture?.(e.pointerId);
            endDrag();
        };

        handle.addEventListener('pointerup', releaseDrag);
        handle.addEventListener('pointercancel', releaseDrag);

        handle.addEventListener('touchstart', (e) => {
            if (!e.touches.length) return;
            startDrag(e.touches[0].clientY);
        }, { passive: true });

        handle.addEventListener('touchmove', (e) => {
            if (!this._storySelectionSheetDrag || !e.touches.length) return;
            updateDrag(e.touches[0].clientY);
        }, { passive: true });

        handle.addEventListener('touchend', () => {
            endDrag();
        });
    }

    _selectStoryWord(word, paragraphIndex = -1, occurrenceIndex = -1, tokenIndex = occurrenceIndex) {
        const cleanWord = this._normalizeStoryWordText(word);
        if (!cleanWord || !this.currentStory) {
            this._clearStoryWordSelection();
            return;
        }

        const active = this._getSelectedStoryWord();
        const resolvedTokenIndex = Number(tokenIndex);
        const isSameWord = active
            && this._selectionIsSingleWord(active)
            && active.word === cleanWord
            && Number(active.paragraphIndex ?? -1) === Number(paragraphIndex)
            && Number(active.occurrenceIndex ?? -1) === Number(occurrenceIndex)
            && Number(active.startTokenIndex ?? -1) === resolvedTokenIndex;
        if (isSameWord) {
            this._clearStoryWordSelection();
            return;
        }

        this._selectStoryWordRange(
            {
                word: cleanWord,
                paragraphIndex: Number(paragraphIndex),
                occurrenceIndex: Number(occurrenceIndex),
                tokenIndex: Number.isNaN(resolvedTokenIndex) ? Number(occurrenceIndex) : resolvedTokenIndex
            },
            {
                word: cleanWord,
                paragraphIndex: Number(paragraphIndex),
                occurrenceIndex: Number(occurrenceIndex),
                tokenIndex: Number.isNaN(resolvedTokenIndex) ? Number(occurrenceIndex) : resolvedTokenIndex
            }
        );
    }

    _selectStoryWordRange(startSelection, endSelection = startSelection) {
        if (!this.currentStory || !startSelection || !endSelection) {
            this._clearStoryWordSelection();
            return;
        }
        if (Number(startSelection.paragraphIndex) !== Number(endSelection.paragraphIndex)) {
            endSelection = startSelection;
        }

        const startTokenIndex = Math.min(Number(startSelection.tokenIndex), Number(endSelection.tokenIndex));
        const endTokenIndex = Math.max(Number(startSelection.tokenIndex), Number(endSelection.tokenIndex));
        const startOccurrenceIndex = Number(startSelection.tokenIndex) <= Number(endSelection.tokenIndex)
            ? Number(startSelection.occurrenceIndex)
            : Number(endSelection.occurrenceIndex);
        const endOccurrenceIndex = Number(startSelection.tokenIndex) <= Number(endSelection.tokenIndex)
            ? Number(endSelection.occurrenceIndex)
            : Number(startSelection.occurrenceIndex);
        const text = this._buildStorySelectionTextFromRange(Number(startSelection.paragraphIndex), startTokenIndex, endTokenIndex)
            || this._normalizeStoryWordText(startSelection.word)
            || this._normalizeStoryWordText(endSelection.word);
        if (!text) {
            this._clearStoryWordSelection();
            return;
        }

        this._selectedStoryWord = {
            text,
            word: text,
            paragraphIndex: Number(startSelection.paragraphIndex),
            occurrenceIndex: startOccurrenceIndex,
            startOccurrenceIndex,
            endOccurrenceIndex,
            startTokenIndex,
            endTokenIndex,
            storyId: this.currentStory.id,
            page: this.currentStoryPage
        };
        this._showStorySavedWords = false;
        this._showStorySelectionExtras = false;
        this._storyAudioStatusOverride = '';
        this._renderCurrentStoryText();
        this._renderStorySelectionControls();
    }

    _renderInteractiveEnglishStoryText(text = '') {
        const paragraphs = this._splitStoryParagraphs(text);
        const selectedWord = this._getSelectedStoryWord();
        const wordPattern = /^([^\p{L}\p{N}'’-]*)([\p{L}\p{N}][\p{L}\p{N}'’-]*)([^\p{L}\p{N}'’-]*)$/u;

        return paragraphs.map((paragraph, paragraphIndex) => {
            const occurrenceCounts = new Map();
            const tokens = paragraph.split(/(\s+)/);
            const renderedTokens = tokens.map((token, tokenIndex) => {
                if (!token) return '';
                if (/^\s+$/u.test(token)) {
                    return token.replace(/ /g, '&nbsp;');
                }

                const match = token.match(wordPattern);
                if (!match) {
                    return this._escapeHtml(token);
                }

                const [, prefix = '', rawWord = '', suffix = ''] = match;
                const normalizedWord = this._normalizeStoryWordText(rawWord);
                if (!normalizedWord) {
                    return this._escapeHtml(token);
                }

                const occurrenceIndex = occurrenceCounts.get(normalizedWord) || 0;
                occurrenceCounts.set(normalizedWord, occurrenceIndex + 1);

                const isSelected = selectedWord
                    && Number(selectedWord.paragraphIndex ?? -1) === paragraphIndex
                    && Number(selectedWord.startTokenIndex ?? -1) <= tokenIndex
                    && Number(selectedWord.endTokenIndex ?? -1) >= tokenIndex;
                const isRangeEdge = isSelected && (
                    Number(selectedWord.startTokenIndex ?? -1) === tokenIndex
                    || Number(selectedWord.endTokenIndex ?? -1) === tokenIndex
                );

                return `${this._escapeHtml(prefix)}<button class="story-word-button${isSelected ? ' is-selected' : ''}${isRangeEdge ? ' is-range-edge' : ''}" data-story-word="${this._escapeHtml(rawWord)}" data-story-word-normalized="${this._escapeHtml(normalizedWord)}" data-paragraph-index="${paragraphIndex}" data-occurrence-index="${occurrenceIndex}" data-token-index="${tokenIndex}" type="button">${this._escapeHtml(rawWord)}</button>${this._escapeHtml(suffix)}`;
            }).join('');

            return `<p class="story-text-paragraph" data-story-paragraph="${paragraphIndex}">${renderedTokens}</p>`;
        }).join('');
    }

    _getStorySavedWords() {
        return state.get('storySavedWords') || [];
    }

    _isSelectedStoryWordSaved(savedWords = this._getStorySavedWords()) {
        const selectedWord = this._getSelectedStoryWord();
        if (!selectedWord || !this.currentStory || !this._selectionIsSingleWord(selectedWord)) return false;
        const key = `${selectedWord.word.toLowerCase()}::${this.currentStory.id}`;
        return savedWords.some(item => item.key === key);
    }

    _saveSelectedStoryWord() {
        const selectedWord = this._getSelectedStoryWord();
        if (!selectedWord || !this.currentStory || !this._selectionIsSingleWord(selectedWord)) return;

        const existing = this._getStorySavedWords();
        const key = `${selectedWord.word.toLowerCase()}::${this.currentStory.id}`;
        if (existing.some(item => item.key === key)) {
            this._showStorySavedWords = true;
            this._showStorySelectionExtras = true;
            this._renderStorySelectionControls();
            return;
        }

        state.set('storySavedWords', [
            {
                key,
                word: selectedWord.word,
                storyId: this.currentStory.id,
                storyTitle: this.currentStory.title
            },
            ...existing
        ].slice(0, 80));
        this._showStorySavedWords = true;
        this._showStorySelectionExtras = true;
        this._renderStorySelectionControls();
    }

    _removeStorySavedWord(key) {
        state.set('storySavedWords', this._getStorySavedWords().filter(item => item.key !== key));
        this._renderStorySelectionControls();
    }

    _renderStorySelectionControls() {
        const controls = document.getElementById('story-selection-controls');
        const backdrop = document.getElementById('story-selection-backdrop');
        const storyScreen = document.getElementById('story-screen');
        const speakBtn = document.getElementById('story-selection-speak-btn');
        const saveBtn = document.getElementById('story-selection-save-btn');
        const clearBtn = document.getElementById('story-selection-clear-btn');
        const moreBtn = document.getElementById('story-selection-more-btn');
        const secondaryWrap = document.getElementById('story-selection-secondary');
        const stopBtn = document.getElementById('story-stop-audio-btn');
        const savedToggleBtn = document.getElementById('story-selection-saved-toggle-btn');
        const savedPanel = document.getElementById('story-selection-saved-panel');
        const status = document.getElementById('story-selection-status');
        const voiceBadge = document.getElementById('story-voice-source-badge');
        const voicePickerWrap = document.getElementById('story-voice-picker-wrap');
        const voiceSelect = document.getElementById('story-voice-select');
        if (!controls || !backdrop || !storyScreen || !speakBtn || !saveBtn || !clearBtn || !moreBtn || !secondaryWrap || !stopBtn || !savedToggleBtn || !savedPanel || !status || !voiceBadge || !voicePickerWrap || !voiceSelect) return;

        const enabled = this._storySupportsCustomWordSelection();
        if (!enabled) {
            controls.classList.add('hidden');
            backdrop.classList.add('hidden');
            storyScreen.classList.remove('story-selection-sheet-open');
            secondaryWrap.classList.add('hidden');
            savedPanel.classList.add('hidden');
            savedPanel.innerHTML = '';
            this._setStorySelectionSheetOffset(0);
            return;
        }

        const selectedWord = this._getSelectedStoryWord();
        const savedWords = this._getStorySavedWords();
        const isSingleWordSelection = this._selectionIsSingleWord(selectedWord);
        const wordAlreadySaved = this._isSelectedStoryWordSaved(savedWords);
        const canSpeak = Boolean(selectedWord && !this._storyAudioLoading && this._storyHasAnySpeechPath());
        const hasNonPinchStatus = Boolean(this._storyAudioStatusOverride && !this._storyAudioStatusOverride.includes(this._storyPinchResizeHint));
        const hasAudioControls = Boolean(this._storyAudioElement || this._storyAudioLoading);
        const hasExtrasAvailable = Boolean(this.storyVoiceOptions.length > 1 || savedWords.length || hasAudioControls);
        const shouldShowSecondary = Boolean(this._showStorySelectionExtras || this._showStorySavedWords || hasAudioControls);
        const showSavedWordsPanel = Boolean(this._showStorySavedWords && savedWords.length);
        const trayVisible = Boolean(selectedWord || showSavedWordsPanel || this._storyAudioLoading || this._storyAudioElement || hasNonPinchStatus);

        controls.classList.toggle('hidden', !trayVisible);
        backdrop.classList.toggle('hidden', !trayVisible);
        storyScreen.classList.toggle('story-selection-sheet-open', trayVisible);
        if (!trayVisible) {
            controls.classList.remove('is-dragging');
            secondaryWrap.classList.add('hidden');
            savedPanel.classList.add('hidden');
            savedPanel.innerHTML = '';
            this._setStorySelectionSheetOffset(0);
            return;
        }

        speakBtn.disabled = !canSpeak;
        saveBtn.disabled = !selectedWord || !isSingleWordSelection || wordAlreadySaved;
        clearBtn.disabled = !selectedWord;
        stopBtn.disabled = !hasAudioControls;
        stopBtn.classList.toggle('hidden', !hasAudioControls);
        moreBtn.classList.toggle('hidden', !hasExtrasAvailable);
        moreBtn.setAttribute('aria-expanded', shouldShowSecondary ? 'true' : 'false');
        moreBtn.textContent = shouldShowSecondary ? 'Less' : 'More';
        secondaryWrap.classList.toggle('hidden', !shouldShowSecondary);
        savedToggleBtn.textContent = `Saved words (${savedWords.length})`;
        savedToggleBtn.setAttribute('aria-pressed', this._showStorySavedWords ? 'true' : 'false');
        voiceBadge.textContent = this._getStoryVoiceSourceLabel();
        voicePickerWrap.classList.toggle('hidden', !(shouldShowSecondary && this.storyVoiceOptions.length > 1));
        this._syncStoryVoicePicker(voicePickerWrap, voiceSelect);

        if (this._storyAudioLoading) {
            status.textContent = 'Generating narration for your selection…';
        } else if (this._storyAudioStatusOverride) {
            status.textContent = this._storyAudioStatusOverride;
        } else if (selectedWord && !isSingleWordSelection) {
            status.textContent = `Selected phrase: “${selectedWord.text}”`;
        } else if (selectedWord) {
            status.textContent = `Selected word: “${selectedWord.word}”`;
        } else {
            status.textContent = `Tap a word or drag across a phrase to hear it, save it, or clear it. ${this._storyPinchResizeHint}`;
        }

        if (selectedWord && isSingleWordSelection) {
            saveBtn.textContent = wordAlreadySaved ? 'Saved ✓' : 'Save';
        } else if (selectedWord) {
            saveBtn.textContent = 'Save word only';
        } else {
            saveBtn.textContent = 'Save';
        }

        if (this._showStorySavedWords) {
            savedPanel.classList.remove('hidden');
            savedPanel.innerHTML = savedWords.length
                ? `<div class="story-selection-saved-panel-label">Saved words</div>${savedWords.map(item => `
                    <div class="story-saved-word-row">
                        <div>
                            <div class="story-saved-word-text">${this._escapeHtml(item.word)}</div>
                            <div class="story-saved-word-story">${this._escapeHtml(item.storyTitle)}</div>
                        </div>
                        <button class="secondary-btn" type="button" data-remove-story-word="${this._escapeHtml(item.key)}">Remove</button>
                    </div>
                `).join('')}`
                : '<div class="story-selection-saved-panel-label">Saved words</div><div class="story-empty-state">Save a few words from a story and they will appear here.</div>';
        } else {
            savedPanel.classList.add('hidden');
            savedPanel.innerHTML = '';
        }
    }

    _getStoryVoiceSourceLabel() {
        if (this._storyAudioSource === 'elevenlabs-direct') return `Voice: ${this._getActiveStoryVoiceLabel()}`;
        if (this.storyElevenLabsApiKey) return 'Voice: ElevenLabs ready';
        return 'Voice: unavailable';
    }

    _storyHasAnySpeechPath() {
        return Boolean(this.storyElevenLabsApiKey && this._getActiveStoryVoiceId());
    }

    _normalizeStoryVoiceOptions(rawVoices) {
        const fallbackVoices = [
            { id: 'JBFqnCBsd6RMkjVDRZzb', label: 'George (male, British)' },
            { id: 'Xb7hH8MSUJpSbSDYk0k2', label: 'Alice (female, British)' }
        ];
        if (!Array.isArray(rawVoices) || rawVoices.length === 0) {
            return fallbackVoices;
        }
        const normalized = rawVoices
            .map(voice => {
                if (!voice || typeof voice !== 'object') return null;
                const id = String(voice.id || voice.voice_id || '').trim();
                const label = String(voice.label || voice.name || '').trim();
                if (!id) return null;
                return {
                    id,
                    label: label || id
                };
            })
            .filter(Boolean);
        return normalized.length ? normalized : fallbackVoices;
    }

    _getActiveStoryVoiceId() {
        return this.storySelectedVoiceId || this.storyVoiceOptions[0]?.id || '';
    }

    _getActiveStoryVoiceLabel() {
        return this.storyVoiceOptions.find(voice => voice.id === this._getActiveStoryVoiceId())?.label || 'ElevenLabs';
    }

    _setStoryVoiceId(voiceId = '') {
        const requestedId = String(voiceId || '').trim();
        if (!requestedId) return;
        if (!this.storyVoiceOptions.some(voice => voice.id === requestedId)) return;
        this.storySelectedVoiceId = requestedId;
        this._storyAudioStatusOverride = `Voice changed to ${this._getActiveStoryVoiceLabel()}.`;
        this._renderStorySelectionControls();
    }

    _syncStoryVoicePicker(voicePickerWrap, voiceSelect) {
        const showPicker = this.storyVoiceOptions.length > 1;
        if (!showPicker) return;
        const selectedId = this._getActiveStoryVoiceId();
        const currentSignature = Array.from(voiceSelect.options).map(option => `${option.value}:${option.textContent}`).join('|');
        const expectedSignature = this.storyVoiceOptions.map(voice => `${voice.id}:${voice.label}`).join('|');
        if (currentSignature !== expectedSignature) {
            voiceSelect.innerHTML = this.storyVoiceOptions.map(voice => `<option value="${this._escapeHtml(voice.id)}">${this._escapeHtml(voice.label)}</option>`).join('');
        }
        voiceSelect.value = selectedId;
    }

    async _requestStorySpeechAudioViaElevenLabs(text) {
        if (!this.storyElevenLabsApiKey) {
            throw new Error('Client-side ElevenLabs key is not configured.');
        }
        const voiceId = this._getActiveStoryVoiceId();
        if (!voiceId) {
            throw new Error('No ElevenLabs voice is selected.');
        }

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
            method: 'POST',
            headers: {
                'xi-api-key': this.storyElevenLabsApiKey,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            body: JSON.stringify({
                text,
                model_id: this.storyElevenLabsModelId,
                voice_settings: {
                    stability: 0.45,
                    similarity_boost: 0.8,
                    style: 0.2,
                    use_speaker_boost: true
                }
            }),
            signal: this._storyAudioAbortController?.signal
        });

        if (!response.ok) {
            let errorMessage = `Direct ElevenLabs request failed (${response.status})`;
            try {
                const data = await response.json();
                const status = data?.detail?.status || data?.detail?.code || '';
                const message = data?.detail?.message || data?.error || '';
                if (status === 'payment_required' || status === 'paid_plan_required') {
                    errorMessage = 'This ElevenLabs voice needs a paid plan for direct API use.';
                } else if (status === 'detected_unusual_activity') {
                    errorMessage = 'ElevenLabs blocked this browser-side request as unusual activity.';
                } else {
                    errorMessage = message || errorMessage;
                }
            } catch {
                // keep generic message
            }
            throw new Error(errorMessage);
        }

        return response.blob();
    }

    async _requestStorySpeechAudio(text) {
        if (this.storyElevenLabsApiKey) {
            this._storyAudioSource = 'elevenlabs-direct';
            return this._requestStorySpeechAudioViaElevenLabs(text);
        }
        throw new Error('ElevenLabs is not configured yet on this device.');
    }

    async _speakStorySelection() {
        const selection = this._getSelectedStoryWord();
        if (!selection) {
            this._renderStorySelectionControls();
            return;
        }

        this._stopStoryAudio({ preserveStatus: true });
        this._storyAudioLoading = true;
        this._storyAudioStatusOverride = '';
        this._storyAudioSource = '';
        this._storyAudioAbortController = new AbortController();
        if (this.storyElevenLabsApiKey) {
            this._storyAudioStatusOverride = `Trying ElevenLabs directly in this browser with ${this._getActiveStoryVoiceLabel()}…`;
        }
        this._renderStorySelectionControls();

        try {
            const audioBlob = await this._requestStorySpeechAudio(selection.text);
            this._storyAudioObjectUrl = URL.createObjectURL(audioBlob);
            this._storyAudioElement = new Audio(this._storyAudioObjectUrl);
            this._storyAudioElement.addEventListener('ended', () => {
                this._stopStoryAudio({ preserveStatus: true });
                this._storyAudioStatusOverride = `Finished with ${this._getActiveStoryVoiceLabel()}: “${selection.text}”`;
                this._renderStorySelectionControls();
            }, { once: true });
            await this._storyAudioElement.play();
            this._storyAudioStatusOverride = `Playing with ${this._getActiveStoryVoiceLabel()}: “${selection.text}”`;
        } catch (error) {
            console.error('Story TTS failed:', error);
            this._storyAudioStatusOverride = error?.message || 'ElevenLabs audio playback failed.';
        } finally {
            this._storyAudioLoading = false;
            this._storyAudioAbortController = null;
            this._renderStorySelectionControls();
        }
    }

    _stopStoryAudio({ preserveStatus = false } = {}) {
        if (this._storyAudioAbortController) {
            this._storyAudioAbortController.abort();
            this._storyAudioAbortController = null;
        }
        if (this._storyAudioElement) {
            this._storyAudioElement.pause();
            this._storyAudioElement.currentTime = 0;
            this._storyAudioElement.src = '';
            this._storyAudioElement = null;
        }
        if (this._storyAudioObjectUrl) {
            URL.revokeObjectURL(this._storyAudioObjectUrl);
            this._storyAudioObjectUrl = '';
        }
        this._storyAudioLoading = false;
        if (!preserveStatus) {
            this._storyAudioStatusOverride = '';
        }
        this._renderStorySelectionControls();
    }

    _applyStoryFontScaleToCurrentStoryText(scale = this._getStoryFontScale()) {
        const storyText = document.getElementById('story-text');
        if (!storyText) return;

        const previousInlineFontSize = storyText.style.fontSize;
        storyText.style.fontSize = '';

        const root = document.documentElement;
        const previousScale = root.style.getPropertyValue('--story-font-scale');
        root.style.setProperty('--story-font-scale', '1');
        const baseFontSizePx = parseFloat(getComputedStyle(storyText).fontSize);
        root.style.setProperty('--story-font-scale', previousScale || '1');

        if (!Number.isFinite(baseFontSizePx) || baseFontSizePx <= 0) {
            storyText.style.fontSize = previousInlineFontSize;
            return;
        }

        storyText.style.fontSize = `${(baseFontSizePx * scale).toFixed(2)}px`;
    }

    _storySupportsUrduTools(story = this.currentStory) {
        if (!story || story.direction !== 'rtl') return false;
        const currentPageText = story.pages?.[this.currentStoryPage]?.text || '';
        return Boolean(String(currentPageText || '').trim());
    }

    _isUrduArticleStory(story = this.currentStory) {
        return Boolean(story && story.direction === 'rtl' && story.sourceType === 'news');
    }

    _renderCurrentStoryText() {
        if (!this.currentStory) return;

        const story = this.currentStory;
        const page = story.pages?.[this.currentStoryPage] || {};
        const storyText = document.getElementById('story-text');
        const isInteractiveUrdu = this._storySupportsUrduTools(story);
        const pageVocabulary = this._getEffectiveUrduVocabularyForPage(page.text || '', story);
        const isUrduArticle = this._isUrduArticleStory(story);

        if (isInteractiveUrdu) {
            storyText.innerHTML = isUrduArticle
                ? this._renderUrduArticleText(page.text || '')
                : this._renderInteractiveUrduText(page.text || '', pageVocabulary);
        } else if (this._storySupportsCustomWordSelection(story)) {
            storyText.innerHTML = this._renderInteractiveEnglishStoryText(page.text || '');
        } else {
            storyText.textContent = page.text || '';
        }

        storyText.dir = story.direction || 'ltr';
        this._applyStoryFontScaleToCurrentStoryText();
    }

    _splitUrduParagraphs(text = '') {
        return String(text || '')
            .split(/\n\s*\n/g)
            .map(paragraph => paragraph.trim())
            .filter(Boolean);
    }

    _getUrduParagraphCacheKey(index) {
        return `${this.currentStory?.id || 'story'}::${this.currentStoryPage}::${index}`;
    }

    _getUrduVocabExclusionSets() {
        return {
            urdu: new Set([
                'بی بی سی', 'بی بی سی اردو'
            ]),
            english: new Set([
                'BBC', 'BBC Urdu'
            ])
        };
    }

    _isTrivialUrduVocabCandidate(word = '', meaning = '', story = this.currentStory) {
        const cleanWord = String(word || '').trim();
        const cleanMeaning = String(meaning || '').trim();
        if (!cleanWord || !cleanMeaning) return true;

        const { urdu, english } = this._getUrduVocabExclusionSets();
        if (urdu.has(cleanWord) || english.has(cleanMeaning)) return true;

        if (cleanWord.length <= 1) return true;
        if (story?.sourceType === 'news' && cleanMeaning.replace(/\s+/g, '').toLowerCase() === cleanWord.replace(/\s+/g, '').toLowerCase()) {
            return true;
        }

        return false;
    }

    _pageContainsUrduWord(text = '', word = '') {
        return String(text || '').includes(String(word || '').trim());
    }

    _scoreUrduVocabCandidate(word = '', meaning = '') {
        let score = word.length;
        if (/\s/.test(word)) score += 20;
        if (/\//.test(meaning)) score += 2;
        if (word.length >= 8) score += 4;
        return score;
    }

    _getEffectiveUrduVocabularyForPage(text = '', story = this.currentStory) {
        const vocabulary = story?.vocabulary || {};
        const maxItems = story?.sourceType === 'news' ? 12 : 10;
        const selected = Object.entries(vocabulary)
            .filter(([word, meaning]) => this._pageContainsUrduWord(text, word) && !this._isTrivialUrduVocabCandidate(word, meaning, story))
            .sort((a, b) => this._scoreUrduVocabCandidate(b[0], b[1]) - this._scoreUrduVocabCandidate(a[0], a[1]))
            .slice(0, maxItems);

        return Object.fromEntries(selected);
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
        const paragraphs = this._splitUrduParagraphs(text);

        return paragraphs.map((paragraph, index) => {
            const key = this._getUrduParagraphCacheKey(index);
            const translation = this._urduParagraphTranslations[key] || '';
            const isLoading = this._urduParagraphLoadingKey === key;
            const hasInlineSelection = Number(this._selectedUrduWord?.paragraphIndex ?? -1) === index;
            const translationHtml = isLoading
                ? '<div class="urdu-page-translation-label">English for this paragraph</div><p>Translating paragraph…</p>'
                : `<div class="urdu-page-translation-label">English for this paragraph</div><p>${this._escapeHtml(translation).replace(/\n/g, '<br>')}</p>`;

            return `
                <div class="urdu-paragraph-block${hasInlineSelection ? ' has-selection' : ''}" data-paragraph-index="${index}">
                    <div class="urdu-paragraph-row">
                        <button class="urdu-paragraph-translate-btn${translation ? ' is-active' : ''}" type="button" data-paragraph-translate="${index}" aria-label="Translate paragraph ${index + 1}">EN</button>
                        <div class="urdu-paragraph-text">${this._renderInteractiveUrduParagraph(paragraph, vocabulary, index)}</div>
                    </div>
                    <div class="urdu-paragraph-translation${translation || isLoading ? '' : ' hidden'}">${translationHtml}</div>
                </div>
            `;
        }).join('');
    }

    _renderUrduArticleText(text = '') {
        const paragraphs = this._splitUrduParagraphs(text);

        return paragraphs.map((paragraph, index) => {
            const key = this._getUrduParagraphCacheKey(index);
            const translation = this._urduParagraphTranslations[key] || '';
            const isLoading = this._urduParagraphLoadingKey === key;
            const hasInlineSelection = Number(this._selectedUrduWord?.paragraphIndex ?? -1) === index;
            const translationHtml = isLoading
                ? '<div class="urdu-page-translation-label">English for this paragraph</div><p>Translating paragraph…</p>'
                : `<div class="urdu-page-translation-label">English for this paragraph</div><p>${this._escapeHtml(translation).replace(/\n/g, '<br>')}</p>`;

            return `
                <div class="urdu-paragraph-block urdu-article-paragraph${hasInlineSelection ? ' has-selection' : ''}" data-paragraph-index="${index}">
                    <div class="urdu-paragraph-row urdu-article-paragraph-row">
                        <button class="urdu-paragraph-translate-btn urdu-article-translate-btn${translation ? ' is-active' : ''}" type="button" data-paragraph-translate="${index}" aria-label="Translate paragraph ${index + 1}">EN</button>
                        <div class="urdu-paragraph-text urdu-article-paragraph-text">${this._renderInteractiveUrduParagraph(paragraph, {}, index)}</div>
                    </div>
                    <div class="urdu-paragraph-translation${translation || isLoading ? '' : ' hidden'}">${translationHtml}</div>
                </div>
            `;
        }).join('');
    }

    _renderInlineUrduWordHelper(paragraphIndex) {
        return '';
    }

    _renderActiveUrduMeaningBadge() {
        const meaning = String(this._selectedUrduWord?.meaning || '').trim();
        if (!meaning) return '';
        return `<span class="urdu-inline-meaning-badge">${this._escapeHtml(meaning)}</span>`;
    }

    _renderInteractiveUrduParagraph(text, vocabulary, paragraphIndex) {
        const escapedText = this._escapeHtml(text || '');
        const sortedWords = Object.keys(vocabulary || {}).sort((a, b) => b.length - a.length);
        const placeholders = [];
        let rendered = escapedText;
        const selectedWord = String(this._selectedUrduWord?.word || '').trim();
        const selectedParagraphIndex = Number(this._selectedUrduWord?.paragraphIndex ?? -1);
        const selectedOccurrenceIndex = Number(this._selectedUrduWord?.occurrenceIndex ?? -1);
        const selectedWordIsVocabulary = selectedWord && Object.prototype.hasOwnProperty.call(vocabulary || {}, selectedWord);

        if (selectedWord && !selectedWordIsVocabulary && selectedParagraphIndex === paragraphIndex) {
            const escapedSelectedWord = selectedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let selectedMatchIndex = 0;
            rendered = rendered.replace(new RegExp(escapedSelectedWord, 'g'), match => {
                if (selectedMatchIndex === selectedOccurrenceIndex) {
                    const placeholder = `__URDU_ACTIVE_WORD_${paragraphIndex}_${selectedMatchIndex}__`;
                    const selectedHtml = `<span class="urdu-inline-selection active">${this._renderActiveUrduMeaningBadge()}${this._escapeHtml(selectedWord)}</span>`;
                    placeholders.push({ placeholder, html: selectedHtml });
                    selectedMatchIndex += 1;
                    return placeholder;
                }

                selectedMatchIndex += 1;
                return match;
            });
        }

        sortedWords.forEach((word, index) => {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const safeWord = this._escapeHtml(word);
            const safeMeaning = this._escapeHtml(vocabulary[word]);
            let wordOccurrenceIndex = 0;

            rendered = rendered.replace(new RegExp(escapedWord, 'g'), () => {
                const placeholder = `__URDU_WORD_${paragraphIndex}_${index}_${wordOccurrenceIndex}__`;
                const isActive = selectedWord === word && selectedParagraphIndex === paragraphIndex && selectedOccurrenceIndex === wordOccurrenceIndex;
                const meaningBadge = isActive ? this._renderActiveUrduMeaningBadge() : '';
                const buttonHtml = `<button class="urdu-word-button${isActive ? ' active' : ''}" data-word="${safeWord}" data-meaning="${safeMeaning}" data-paragraph-index="${paragraphIndex}" data-occurrence-index="${wordOccurrenceIndex}" type="button">${meaningBadge}${safeWord}</button>`;
                placeholders.push({ placeholder, html: buttonHtml });
                wordOccurrenceIndex += 1;
                return placeholder;
            });
        });

        placeholders.forEach(({ placeholder, html }) => {
            rendered = rendered.replaceAll(placeholder, html);
        });

        return rendered.replace(/\n/g, '<br>');
    }

    _selectUrduWord(word, meaning, paragraphIndex = -1, occurrenceIndex = -1) {
        this._selectedUrduWord = { word, meaning, paragraphIndex, occurrenceIndex };
        this._pendingUrduSelectionText = word;
        this._renderCurrentStoryText();
        this._renderUrduSupportPanel();
    }

    _clearSelectedUrduWord() {
        this._selectedUrduWord = null;
        this._pendingUrduSelectionText = '';
        this._renderCurrentStoryText();
        this._renderUrduSupportPanel();
        window.getSelection?.()?.removeAllRanges?.();
    }

    _getCurrentUrduSelectionText() {
        return (this._pendingUrduSelectionText || '').trim();
    }

    _getTappedUrduWord(event) {
        const pointX = event.clientX ?? event?.touches?.[0]?.clientX ?? event?.changedTouches?.[0]?.clientX;
        const pointY = event.clientY ?? event?.touches?.[0]?.clientY ?? event?.changedTouches?.[0]?.clientY;
        if (typeof pointX !== 'number' || typeof pointY !== 'number') return null;

        let range = null;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(pointX, pointY);
        } else if (document.caretPositionFromPoint) {
            const position = document.caretPositionFromPoint(pointX, pointY);
            if (position) {
                range = document.createRange();
                range.setStart(position.offsetNode, position.offset);
                range.setEnd(position.offsetNode, position.offset);
            }
        }

        const textNode = range?.startContainer;
        const offset = range?.startOffset ?? 0;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;

        const text = textNode.textContent || '';
        if (!text.trim()) return null;

        const urduChar = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
        let index = Math.min(offset, Math.max(text.length - 1, 0));
        if (!urduChar.test(text[index] || '') && index > 0 && urduChar.test(text[index - 1] || '')) {
            index -= 1;
        }
        if (!urduChar.test(text[index] || '')) return null;

        let start = index;
        let end = index;
        while (start > 0 && urduChar.test(text[start - 1] || '')) start -= 1;
        while (end < text.length && urduChar.test(text[end] || '')) end += 1;

        const word = text.slice(start, end).trim();
        if (!word) return null;

        const paragraphBlock = textNode.parentElement?.closest('.urdu-paragraph-block');
        const paragraphText = textNode.parentElement?.closest('.urdu-paragraph-text');
        const paragraphIndex = Number(paragraphBlock?.dataset.paragraphIndex ?? -1);
        if (!paragraphText || paragraphIndex < 0) {
            return { word, paragraphIndex: -1, occurrenceIndex: -1 };
        }

        const walker = document.createTreeWalker(paragraphText, NodeFilter.SHOW_TEXT);
        let combinedText = '';
        let currentNode;
        while ((currentNode = walker.nextNode())) {
            if (currentNode === textNode) {
                combinedText += (currentNode.textContent || '').slice(0, start);
                break;
            }
            combinedText += currentNode.textContent || '';
        }

        const occurrenceIndex = (combinedText.match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        return { word, paragraphIndex, occurrenceIndex };
    }

    async _translateWithGoogle(text = '') {
        const cleanText = String(text || '').trim();
        if (!cleanText) return '';
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ur&tl=en&dt=t&q=${encodeURIComponent(cleanText)}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Translation failed: ${response.status}`);
        const data = await response.json();
        return (data?.[0] || []).map(part => part?.[0] || '').join('').trim();
    }

    async _translateTappedUrduText(selection = null) {
        const tappedWord = typeof selection === 'string'
            ? { word: selection.trim(), paragraphIndex: -1, occurrenceIndex: -1 }
            : (selection || {});
        const cleanText = String(tappedWord.word || '').trim();
        if (!cleanText) {
            this._pendingUrduSelectionText = '';
            this._selectedUrduWord = null;
            this._renderCurrentStoryText();
            this._renderUrduSupportPanel();
            return;
        }

        this._pendingUrduSelectionText = cleanText;
        this._selectedUrduWord = {
            word: cleanText,
            meaning: 'Translating…',
            paragraphIndex: Number(tappedWord.paragraphIndex ?? -1),
            occurrenceIndex: Number(tappedWord.occurrenceIndex ?? -1)
        };
        this._renderCurrentStoryText();
        this._renderUrduSupportPanel();
        window.getSelection?.()?.removeAllRanges?.();

        try {
            const translation = await this._translateWithGoogle(cleanText);
            this._selectedUrduWord = {
                word: cleanText,
                meaning: translation || 'No translation found',
                paragraphIndex: Number(tappedWord.paragraphIndex ?? -1),
                occurrenceIndex: Number(tappedWord.occurrenceIndex ?? -1)
            };
        } catch (error) {
            console.error('Tapped word translation failed:', error);
            this._selectedUrduWord = {
                word: cleanText,
                meaning: 'Translation failed. Try again.',
                paragraphIndex: Number(tappedWord.paragraphIndex ?? -1),
                occurrenceIndex: Number(tappedWord.occurrenceIndex ?? -1)
            };
        } finally {
            this._renderCurrentStoryText();
            this._renderUrduSupportPanel();
        }
    }

    async _toggleUrduParagraphTranslation(index) {
        if (!this.currentStory) return;

        const page = this.currentStory.pages?.[this.currentStoryPage] || {};
        const paragraphs = this._splitUrduParagraphs(page.text || '');
        const paragraphText = paragraphs[index] || '';
        const key = this._getUrduParagraphCacheKey(index);

        if (!paragraphText) return;

        if (this._urduParagraphTranslations[key]) {
            delete this._urduParagraphTranslations[key];
            this._renderCurrentStoryText();
            return;
        }

        this._urduParagraphLoadingKey = key;
        this._renderCurrentStoryText();

        try {
            const translation = await this._translateWithGoogle(paragraphText);
            this._urduParagraphTranslations[key] = translation || 'No translation found';
        } catch (error) {
            console.error('Paragraph translation failed:', error);
            this._urduParagraphTranslations[key] = 'Translation failed. Try again.';
        } finally {
            if (this._urduParagraphLoadingKey === key) {
                this._urduParagraphLoadingKey = '';
            }
            this._renderCurrentStoryText();
        }
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
        const translation = document.getElementById('urdu-page-translation');
        const savedPanel = document.getElementById('urdu-saved-words-panel');
        const translationBtn = document.getElementById('urdu-translation-toggle-btn');
        const savedBtn = document.getElementById('urdu-saved-toggle-btn');
        const clearBtn = document.getElementById('urdu-clear-selection-btn');
        const saveBtn = document.getElementById('urdu-save-word-btn');
        const supportTitle = document.getElementById('urdu-support-title');
        const supportStatus = document.getElementById('urdu-support-status');
        const supportCard = document.querySelector('#urdu-story-tools .urdu-support-card');
        const isUrduArticle = this._isUrduArticleStory();

        if (!this._storySupportsUrduTools()) {
            tools.classList.add('hidden');
            tools.classList.remove('urdu-article-tools', 'is-article-idle');
            supportCard?.classList.remove('is-article-idle');
            translation.classList.add('hidden');
            savedPanel.classList.add('hidden');
            translationBtn.classList.remove('is-active');
            savedBtn.classList.remove('is-active');
            clearBtn.classList.add('hidden');
            saveBtn.classList.add('hidden');
            translationBtn.setAttribute('aria-pressed', 'false');
            savedBtn.setAttribute('aria-pressed', 'false');
            document.querySelectorAll('.urdu-word-button.active').forEach(btn => btn.classList.remove('active'));
            return;
        }

        const page = this.currentStory.pages[this.currentStoryPage] || {};
        const savedWords = this._getUrduSavedWords();
        const wordAlreadySaved = this._isSelectedUrduWordSaved(savedWords);
        const articleIdle = isUrduArticle && !this._selectedUrduWord && !this._showUrduTranslation && !this._showUrduSavedWords;
        tools.classList.remove('hidden');
        tools.classList.toggle('urdu-article-tools', isUrduArticle);
        tools.classList.toggle('is-article-idle', articleIdle);
        supportCard?.classList.toggle('is-article-idle', articleIdle);
        const currentSelectionText = this._getCurrentUrduSelectionText();
        translationBtn.textContent = this._showUrduTranslation ? 'Hide English help' : 'Show English help';
        savedBtn.textContent = `Saved words (${savedWords.length})`;
        translationBtn.classList.toggle('is-active', this._showUrduTranslation);
        savedBtn.classList.toggle('is-active', this._showUrduSavedWords);
        translationBtn.setAttribute('aria-pressed', this._showUrduTranslation ? 'true' : 'false');
        savedBtn.setAttribute('aria-pressed', this._showUrduSavedWords ? 'true' : 'false');

        if (this._selectedUrduWord) {
            supportTitle.textContent = 'English sits beside the line so the reading stays open.';
            supportStatus.textContent = wordAlreadySaved ? `Saved: ${this._selectedUrduWord.word}` : `Selected: ${this._selectedUrduWord.word}`;
            clearBtn.classList.remove('hidden');
            saveBtn.classList.remove('hidden');
            saveBtn.disabled = wordAlreadySaved;
            saveBtn.textContent = wordAlreadySaved ? 'Saved ✓' : 'Save word';
        } else {
            supportTitle.textContent = isUrduArticle
                ? 'Tap any Urdu word and keep reading in place.'
                : 'Tap a word and its English appears beside the text, not on top of it.';
            supportStatus.textContent = isUrduArticle
                ? (currentSelectionText ? `Last word: ${currentSelectionText}` : 'Tap any Urdu word')
                : (currentSelectionText ? `Last word: ${currentSelectionText}` : 'Tap any highlighted word');
            clearBtn.classList.add('hidden');
            saveBtn.classList.add('hidden');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Save word';
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

        input.addEventListener('input', () => {
            const query = input.value.trim().toLowerCase();
            if (query.length < 2) {
                this._resetSearchSurface();
                return;
            }
            this._renderSearchResults(query);
        });

        input.addEventListener('focus', () => {
            if (input.value.trim().length >= 2) {
                this._renderSearchResults(input.value.trim().toLowerCase());
            }
        });

        results.addEventListener('click', (e) => {
            const card = e.target.closest('.search-result-card');
            if (card) {
                const storyId = card.dataset.storyId;
                const resumePage = card.dataset.resumePage;
                input.value = '';
                this._setReadingSearchOpen(false, { clear: true });
                this._renderReadingScreen();
                this._startStory(storyId, resumePage ? parseInt(resumePage) : undefined);
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this._setReadingSearchOpen(false, { clear: true });
                this._renderReadingScreen();
            }
        });
    }

    _resetSearchSurface() {
        const results = document.getElementById('search-results');
        const storyList = document.getElementById('story-list');
        const libraryAttribution = document.getElementById('library-attribution');
        if (!results || !storyList || !libraryAttribution) return;

        results.classList.add('hidden');
        results.innerHTML = '';
        storyList.classList.remove('hidden');
        if (libraryAttribution.textContent) {
            libraryAttribution.classList.remove('hidden');
        } else {
            libraryAttribution.classList.add('hidden');
        }
    }

    _renderSearchResults(query) {
        const results = document.getElementById('search-results');
        const storyList = document.getElementById('story-list');
        const libraryAttribution = document.getElementById('library-attribution');
        const bookmarks = state.get('bookmarks') || {};
        const matches = this._storyIndex.filter(s =>
            s.title.toLowerCase().includes(query) ||
            s.author.toLowerCase().includes(query)
        );

        storyList.classList.add('hidden');
        libraryAttribution.classList.add('hidden');

        if (matches.length === 0) {
            results.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:var(--spacing-md);">No stories found</div>';
            results.classList.remove('hidden');
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
            const currentScreen = state.get('currentScreen');

            if (currentScreen === 'home') {
                // Already on home — push state again to prevent leaving
                history.pushState({ screen: 'home' }, '', '');
                return;
            }

            let destination;
            if (currentScreen === 'practice' && (state.get('currentMathMissionId') || this.currentMathMission)) {
                destination = 'math-mission-intro';
            } else {
                const parentMap = {
                    'story': 'reading',
                    'reading': 'home',
                    'maths': 'home',
                    'math-parent': 'maths',
                    'math-mission-intro': 'maths',
                    'math-mission-complete': 'maths',
                    'module': 'maths',
                    'learn': 'module',
                    'practice': 'module',
                    'test': 'module',
                    'store': 'home',
                    'parent': 'home'
                };
                destination = parentMap[currentScreen] || 'home';
            }

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
                case 'maths': this._renderMathsScreen(); break;
                case 'math-parent': this._renderMathParentScreen(); break;
                case 'math-mission-intro': this._renderMathMissionIntroScreen(); break;
                case 'math-mission-complete': this._renderMathMissionCompleteScreen(); break;
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
                if (event.data?.type === 'BUILD_INFO') {
                    this._activeBuildInfo = {
                        buildTime: event.data.buildTime,
                        cacheName: event.data.cacheName
                    };
                    this._renderBuildIndicator();
                    this._fetchLatestBuildInfo();
                }
            });

            // Request build time once SW is ready
            navigator.serviceWorker.ready.then(reg => {
                reg.active?.postMessage({ type: 'GET_BUILD_INFO' });
            });
        }
    }

    _formatBuildStamp(info) {
        if (!info) return 'Checking build…';
        const buildTime = info.buildTime || 'Unknown build';
        const cacheName = info.cacheName || 'app';
        return `${cacheName} · ${buildTime}`;
    }

    _setBuildSyncState(text, stateClass = '') {
        const syncEl = document.getElementById('build-sync');
        if (!syncEl) return;
        syncEl.textContent = text;
        syncEl.classList.remove('is-synced', 'is-update', 'is-error');
        if (stateClass) syncEl.classList.add(stateClass);
    }

    _renderBuildIndicator() {
        const stamp = document.getElementById('build-stamp');
        if (stamp) {
            stamp.textContent = this._formatBuildStamp(this._activeBuildInfo);
        }

        if (!this._activeBuildInfo) {
            this._setBuildSyncState('Checking active build…');
            return;
        }

        if (!this._latestBuildInfo) {
            this._setBuildSyncState('Checking live version…');
            return;
        }

        const active = `${this._activeBuildInfo.cacheName || ''}|${this._activeBuildInfo.buildTime || ''}`;
        const latest = `${this._latestBuildInfo.cacheName || ''}|${this._latestBuildInfo.buildTime || ''}`;
        if (active === latest) {
            this._setBuildSyncState('Live: synced', 'is-synced');
        } else {
            this._setBuildSyncState(`Live: update available (${this._latestBuildInfo.cacheName})`, 'is-update');
        }
    }

    async _fetchLatestBuildInfo() {
        try {
            const response = await fetch(`version.json?ts=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this._latestBuildInfo = await response.json();
            this._renderBuildIndicator();
        } catch (error) {
            console.warn('Latest version check failed:', error);
            this._latestBuildInfo = null;
            this._setBuildSyncState('Live: cannot verify', 'is-error');
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
                this._setBuildSyncState('Live: cannot verify', 'is-error');
                return;
            }

            await reg.update();
            if (reg.active) {
                reg.active.postMessage({ type: 'GET_BUILD_INFO' });
            }
            await this._fetchLatestBuildInfo();

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
                const active = `${this._activeBuildInfo?.cacheName || ''}|${this._activeBuildInfo?.buildTime || ''}`;
                const latest = `${this._latestBuildInfo?.cacheName || ''}|${this._latestBuildInfo?.buildTime || ''}`;
                if (statusEl) {
                    statusEl.textContent = active && latest && active === latest
                        ? 'You\'re on the latest version.'
                        : 'Update check finished. If the top-left label still says update available, reopen the app once the new version activates.';
                }
                if (settingsBtn) { settingsBtn.disabled = false; }
            }
        } catch (err) {
            if (indicatorBtn) { indicatorBtn.classList.remove('checking'); }
            if (statusEl) { statusEl.textContent = 'Update check failed. Are you online?'; }
            if (settingsBtn) { settingsBtn.disabled = false; }
            this._setBuildSyncState('Live: cannot verify', 'is-error');
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
