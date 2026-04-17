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
const wranglerPath = path.join(root, 'wrangler.toml');
const workerPath = path.join(root, 'worker', 'src', 'index.js');

assert(fs.existsSync(wranglerPath), 'Expected wrangler.toml for Cloudflare Worker proxy');
assert(fs.existsSync(workerPath), 'Expected Cloudflare Worker source file at worker/src/index.js');

const wrangler = fs.readFileSync(wranglerPath, 'utf8');
const worker = fs.readFileSync(workerPath, 'utf8');

assert(html.includes('story-selection-controls'), 'Expected custom story-selection controls in index.html');
assert(html.includes('story-selection-speak-btn'), 'Expected custom Speak button in index.html');
assert(html.includes('story-selection-save-btn'), 'Expected custom Save button in index.html');
assert(html.includes('story-selection-clear-btn'), 'Expected custom Clear button in index.html');
assert(html.includes('story-selection-saved-toggle-btn'), 'Expected saved-words toggle in index.html');
assert(html.includes('story-stop-audio-btn'), 'Expected stop-audio button in index.html');

assert(css.includes('.story-selection-controls'), 'Expected story-selection controls styling in css');
assert(css.includes('.story-word-button {'), 'Expected tappable English story word styling in css');
assert(css.includes('.story-word-button.is-selected {'), 'Expected selected English word styling in css');
assert(css.includes('#story-screen.story-custom-selection-mode #story-text {'), 'Expected native text selection to be disabled in custom-selection mode');

assert(app.includes('_renderInteractiveEnglishStoryText('), 'Expected English story text to render into tappable word units');
assert(app.includes('_storySupportsCustomWordSelection('), 'Expected dedicated custom-selection mode detection in app.js');
assert(app.includes('_selectStoryWord('), 'Expected custom story-word selection handler in app.js');
assert(app.includes('_clearStoryWordSelection('), 'Expected custom story-word clear handler in app.js');
assert(app.includes('_saveSelectedStoryWord('), 'Expected save action for selected English story words');
assert(app.includes('_renderStorySelectionControls('), 'Expected dedicated story-selection controls renderer in app.js');
assert(app.includes('Tap a word to hear it, save it, or clear it.'), 'Expected calm helper copy for custom story selection');
assert(app.includes('Saved ✓'), 'Expected saved feedback for selected story words');
assert(app.includes('_requestStorySpeechAudio'), 'Expected proxy speech request method in app.js');
assert(app.includes('_playStorySelectionWithDeviceVoice'), 'Expected device-voice fallback method in app.js');
assert(app.includes('_stopStoryAudio'), 'Expected audio stop method in app.js');
assert(app.includes('storyTtsProxyUrl'), 'Expected configurable TTS proxy URL state in app.js');
assert(app.includes('Cloud voice is temporarily unavailable on the current ElevenLabs plan.'), 'Expected a clear fallback message when ElevenLabs free-tier abuse detection blocks a request');
assert(app.includes('speechSynthesis'), 'Expected browser speech synthesis fallback support in app.js');
assert(!app.includes('_handleStoryTextSelection()'), 'Expected native selection-based English TTS handler to be removed');
assert(!app.includes("document.addEventListener('selectionchange'"), 'Expected native selectionchange listener to be removed from English selection flow');

assert(pkg.includes('wrangler'), 'Expected wrangler dependency in package.json');
assert(wrangler.includes('name = "kidsmaths-tts-proxy"'), 'Expected Worker name in wrangler.toml');
assert(worker.includes('api.elevenlabs.io/v1/text-to-speech'), 'Expected Worker to proxy ElevenLabs TTS requests');
assert(worker.includes('Access-Control-Allow-Origin'), 'Expected Worker CORS headers for GitHub Pages app');
assert(worker.includes('ELEVENLABS_API_KEY'), 'Expected Worker to use ElevenLabs secret binding');
assert(worker.includes('DEFAULT_VOICE_ID'), 'Expected Worker to support default British narrator voice binding');

console.log('English TTS checks passed.');
