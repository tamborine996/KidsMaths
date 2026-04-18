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

assert(fs.existsSync(configExamplePath), 'Expected kidsmaths-config.example.js with Azure client-side TTS guidance');
assert(fs.existsSync(publicConfigPath), 'Expected tracked kidsmaths-config.public.js for GitHub Pages Azure client config');

const configExample = fs.readFileSync(configExamplePath, 'utf8');
const publicConfig = fs.readFileSync(publicConfigPath, 'utf8');

assert(html.includes('story-selection-controls'), 'Expected custom story-selection controls in index.html');
assert(html.includes('story-selection-speak-btn'), 'Expected custom Speak button in index.html');
assert(html.includes('story-selection-save-btn'), 'Expected custom Save button in index.html');
assert(html.includes('story-selection-clear-btn'), 'Expected custom Clear button in index.html');
assert(html.includes('story-selection-saved-toggle-btn'), 'Expected saved-words toggle in index.html');
assert(html.includes('story-stop-audio-btn'), 'Expected stop-audio button in index.html');
assert(html.includes('story-voice-source-badge'), 'Expected visible voice-source badge in index.html');
assert(html.includes('kidsmaths-config.js'), 'Expected optional local KidsMaths config script in index.html');
assert(!html.includes('KIDSMATHS_TTS_PROXY_URL'), 'Expected legacy Worker proxy config to be removed from index.html');

assert(css.includes('.story-selection-controls'), 'Expected story-selection controls styling in css');
assert(css.includes('.story-voice-source-badge {'), 'Expected story voice-source badge styling in css');
assert(css.includes('.story-word-button {'), 'Expected tappable English story word styling in css');
assert(css.includes('.story-word-button.is-selected {'), 'Expected selected English word styling in css');
assert(css.includes('#story-screen.story-custom-selection-mode #story-text {'), 'Expected native text selection to be disabled in custom-selection mode');

assert(gitignore.includes('kidsmaths-config.js'), 'Expected local KidsMaths config override file to stay gitignored');
assert(configExample.includes('window.KIDSMATHS_AZURE_SPEECH_API_KEY'), 'Expected config example to document Azure speech key wiring');
assert(configExample.includes('window.KIDSMATHS_AZURE_TRANSLATOR_API_KEY'), 'Expected config example to document Azure translator-key fallback');
assert(configExample.includes("window.KIDSMATHS_AZURE_REGION = 'uksouth'"), 'Expected config example to default Azure region to uksouth');
assert(configExample.includes("window.KIDSMATHS_AZURE_URDU_TTS_VOICE = 'ur-PK-UzmaNeural'"), 'Expected config example to document Urdu Azure voice');
assert(configExample.includes("window.KIDSMATHS_AZURE_ENGLISH_TTS_VOICE = 'en-GB-SoniaNeural'"), 'Expected config example to document English Azure voice');
assert(!configExample.includes('window.KIDSMATHS_GEMINI_API_KEY'), 'Expected config example to stop steering toward Gemini');

assert(publicConfig.includes('window.KIDSMATHS_AZURE_SPEECH_API_KEY'), 'Expected tracked public config to expose Azure speech key for GitHub Pages');
assert(publicConfig.includes('window.KIDSMATHS_AZURE_TRANSLATOR_API_KEY'), 'Expected tracked public config to expose Azure translator fallback key');
assert(publicConfig.includes("window.KIDSMATHS_AZURE_REGION = 'uksouth'"), 'Expected tracked public config to set Azure region');

assert(app.includes('window.KIDSMATHS_AZURE_SPEECH_API_KEY'), 'Expected app.js to support Azure speech key configuration');
assert(app.includes('window.KIDSMATHS_AZURE_TRANSLATOR_API_KEY'), 'Expected app.js to support Azure translator fallback key');
assert(app.includes('window.KIDSMATHS_AZURE_REGION'), 'Expected app.js to support Azure region configuration');
assert(app.includes('ur-PK-UzmaNeural'), 'Expected app.js to include Azure Urdu voice default');
assert(app.includes('en-GB-SoniaNeural'), 'Expected app.js to include Azure English voice default');
assert(app.includes('_requestStorySpeechAudioViaAzure'), 'Expected Azure speech request path in app.js');
assert(app.includes('Trying Azure voice directly in this browser'), 'Expected explicit Azure status');
assert(app.includes('Playing with Azure voice'), 'Expected explicit Azure playback status');
assert(app.includes('CORS blocked the direct Azure speech request'), 'Expected honest Azure CORS failure copy');
assert(app.includes('_getStoryVoiceSourceLabel()'), 'Expected story voice-source label helper in app.js');
assert(app.includes('Voice: Azure'), 'Expected Azure voice badge label');
assert(!app.includes('Voice: Gemini'), 'Expected Gemini-specific badge labels to be removed');
assert(!app.includes('speechSynthesis'), 'Expected browser speech synthesis fallback support to remain removed');
assert(!app.includes('Trying Gemini voice directly in this browser'), 'Expected Gemini-specific reader status to be removed');
assert(!app.includes('Voice: ElevenLabs direct'), 'Expected ElevenLabs-specific badge labels to remain removed');
assert(!app.includes('_handleStoryTextSelection()'), 'Expected native selection-based English TTS handler to remain removed');
assert(!app.includes("document.addEventListener('selectionchange'"), 'Expected native selectionchange listener to stay removed from English selection flow');

assert(pkg.includes('check-english-tts.js'), 'Expected package test script to keep Azure reading checks wired in');
assert(html.includes('kidsmaths-config.public.js'), 'Expected tracked public Azure config script in index.html');
assert(html.includes('kidsmaths-config.js'), 'Expected optional local config override script in index.html');

console.log('English TTS checks passed.');
