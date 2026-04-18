const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
const configExamplePath = path.join(root, 'kidsmaths-config.example.js');
const publicConfigPath = path.join(root, 'kidsmaths-config.public.js');

assert(fs.existsSync(configExamplePath), 'Expected kidsmaths-config.example.js with ElevenLabs client-side TTS guidance');
assert(fs.existsSync(publicConfigPath), 'Expected tracked kidsmaths-config.public.js for GitHub Pages ElevenLabs client config');

const configExample = fs.readFileSync(configExamplePath, 'utf8');
const publicConfig = fs.readFileSync(publicConfigPath, 'utf8');

assert(html.includes('story-selection-controls'), 'Expected custom story-selection controls in index.html');
assert(html.includes('story-selection-speak-btn'), 'Expected custom Speak button in index.html');
assert(html.includes('story-selection-save-btn'), 'Expected custom Save button in index.html');
assert(html.includes('story-selection-bookmark-btn'), 'Expected story bookmark button in index.html');
assert(html.includes('story-selection-clear-btn'), 'Expected custom Clear button in index.html');
assert(html.includes('story-selection-saved-toggle-btn'), 'Expected saved-words toggle in index.html');
assert(!html.includes('story-stop-audio-btn'), 'Expected stop-audio button to stay removed from index.html');
assert(html.includes('story-voice-source-badge'), 'Expected visible voice-source badge in index.html');
assert(html.includes('story-voice-select'), 'Expected visible story voice select in index.html');
assert(html.includes('kidsmaths-config.js'), 'Expected optional local KidsMaths config script in index.html');
assert(!html.includes('KIDSMATHS_TTS_PROXY_URL'), 'Expected legacy Worker proxy config to be removed from index.html');

assert(css.includes('.story-selection-controls'), 'Expected story-selection controls styling in css');
assert(css.includes('.story-voice-source-badge {'), 'Expected story voice-source badge styling in css');
assert(css.includes('.story-voice-picker {'), 'Expected story voice-picker styling in css');
assert(css.includes('.story-voice-select {'), 'Expected story voice-select styling in css');
assert(css.includes('.story-word-button {'), 'Expected tappable English story word styling in css');
assert(css.includes('.story-word-button.is-selected {'), 'Expected selected English word styling in css');
assert(css.includes('#story-screen.story-custom-selection-mode #story-text {'), 'Expected native text selection to be disabled in custom-selection mode');

assert(gitignore.includes('kidsmaths-config.js'), 'Expected local KidsMaths config override file to stay gitignored');
assert(configExample.includes('window.KIDSMATHS_ELEVENLABS_API_KEY'), 'Expected config example to document ElevenLabs key wiring');
assert(configExample.includes('window.KIDSMATHS_ELEVENLABS_VOICE_ID'), 'Expected config example to document ElevenLabs default voice');
assert(configExample.includes('window.KIDSMATHS_ELEVENLABS_MODEL_ID'), 'Expected config example to document ElevenLabs model');
assert(configExample.includes('window.KIDSMATHS_ELEVENLABS_VOICES'), 'Expected config example to document multiple ElevenLabs voice options');

assert(publicConfig.includes('window.KIDSMATHS_ELEVENLABS_API_KEY'), 'Expected tracked public config to expose ElevenLabs key for GitHub Pages');
assert(publicConfig.includes('window.KIDSMATHS_ELEVENLABS_VOICE_ID'), 'Expected tracked public config to set ElevenLabs default voice');
assert(publicConfig.includes('window.KIDSMATHS_ELEVENLABS_VOICES'), 'Expected tracked public config to list ElevenLabs test voices');

assert(app.includes('window.KIDSMATHS_ELEVENLABS_API_KEY'), 'Expected app.js to support ElevenLabs API key configuration');
assert(app.includes('window.KIDSMATHS_ELEVENLABS_VOICES'), 'Expected app.js to support ElevenLabs voice list configuration');
assert(app.includes('_requestStorySpeechAudioViaElevenLabs'), 'Expected ElevenLabs speech request path in app.js');
assert(app.includes('_bookmarkCurrentStoryFromSelection('), 'Expected story word sheet bookmark action in app.js');
assert(app.includes('This ElevenLabs voice needs a paid plan for direct API use.'), 'Expected honest ElevenLabs paid-plan error copy');
assert(app.includes('ElevenLabs blocked this browser-side request as unusual activity.'), 'Expected honest unusual-activity error copy');
assert(app.includes('_syncStoryVoicePicker'), 'Expected active voice-picker sync helper in app.js');
assert(app.includes('_getStoryVoiceSourceLabel()'), 'Expected story voice-source label helper in app.js');
assert(app.includes('Voice: ElevenLabs ready'), 'Expected ElevenLabs voice badge label');
assert(!app.includes('Voice: Azure'), 'Expected Azure-specific badge labels to be removed');
assert(!app.includes('speechSynthesis'), 'Expected browser speech synthesis fallback support to remain removed');
assert(!app.includes('_handleStoryTextSelection()'), 'Expected native selection-based English TTS handler to remain removed');
assert(!app.includes("document.addEventListener('selectionchange'"), 'Expected native selectionchange listener to stay removed from English selection flow');

assert(pkg.includes('check-english-tts.js'), 'Expected package test script to keep ElevenLabs reading checks wired in');
assert(html.includes('kidsmaths-config.public.js'), 'Expected tracked public ElevenLabs config script in index.html');
assert(html.includes('kidsmaths-config.js'), 'Expected optional local config override script in index.html');

console.log('English TTS checks passed.');
