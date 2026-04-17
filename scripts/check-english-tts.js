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
const wranglerPath = path.join(root, 'wrangler.toml');
const workerPath = path.join(root, 'worker', 'src', 'index.js');

assert(fs.existsSync(wranglerPath), 'Expected wrangler.toml for Cloudflare Worker proxy');
assert(fs.existsSync(workerPath), 'Expected Cloudflare Worker source file at worker/src/index.js');
assert(fs.existsSync(configExamplePath), 'Expected kidsmaths-config.example.js with client-side TTS guidance');

const configExample = fs.readFileSync(configExamplePath, 'utf8');
const wrangler = fs.readFileSync(wranglerPath, 'utf8');
const worker = fs.readFileSync(workerPath, 'utf8');

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

assert(gitignore.includes('kidsmaths-config.js'), 'Expected local KidsMaths config file to be gitignored');
assert(configExample.includes('window.KIDSMATHS_GEMINI_API_KEY'), 'Expected config example to document Gemini TTS key wiring');
assert(configExample.includes('window.KIDSMATHS_GEMINI_TTS_VOICE'), 'Expected config example to document Gemini TTS voice override');
assert(configExample.includes("'gemini-3.1-flash-tts-preview'"), 'Expected config example to default to Gemini 3.1 Flash TTS Preview');
assert(!configExample.includes('window.KIDSMATHS_ELEVENLABS_API_KEY'), 'Expected config example to stop steering toward ElevenLabs');

assert(app.includes('window.KIDSMATHS_GEMINI_API_KEY'), 'Expected app.js to support Gemini API key configuration');
assert(app.includes('window.KIDSMATHS_GEMINI_TTS_VOICE'), 'Expected app.js to support Gemini TTS voice configuration');
assert(app.includes("'gemini-3.1-flash-tts-preview'"), 'Expected app.js to default to Gemini 3.1 Flash TTS Preview');
assert(app.includes('_requestStorySpeechAudioViaGemini'), 'Expected Gemini speech request path in app.js');
assert(app.includes('Trying Gemini voice directly in this browser'), 'Expected explicit Gemini status');
assert(app.includes('Playing with Gemini voice'), 'Expected explicit Gemini playback status');
assert(app.includes('_getStoryVoiceSourceLabel()'), 'Expected story voice-source label helper in app.js');
assert(app.includes('Voice: Gemini'), 'Expected Gemini voice badge label');
assert(!app.includes('Voice: device fallback'), 'Expected device fallback labels to be removed');
assert(!app.includes('speechSynthesis'), 'Expected browser speech synthesis fallback support to be removed');
assert(!app.includes('allowDeviceFallback'), 'Expected Gemini-only path to avoid fallback flags');
assert(!app.includes('Playing on this device'), 'Expected device fallback playback copy to be removed');
assert(!app.includes('This device does not offer a built-in voice fallback.'), 'Expected built-in fallback error copy to be removed');
assert(!app.includes('Trying ElevenLabs directly in this browser'), 'Expected ElevenLabs-specific reader status to be removed');
assert(!app.includes('Voice: ElevenLabs direct'), 'Expected ElevenLabs-specific badge labels to be removed');
assert(!app.includes('Voice: ElevenLabs via Worker'), 'Expected Worker-specific badge labels to be removed');
assert(!app.includes('Cloud voice via Worker is blocked right now'), 'Expected Worker-blocked copy to be removed from normal reader flow');
assert(!app.includes('_handleStoryTextSelection()'), 'Expected native selection-based English TTS handler to be removed');
assert(!app.includes("document.addEventListener('selectionchange'"), 'Expected native selectionchange listener to be removed from English selection flow');

assert(pkg.includes('wrangler'), 'Expected wrangler dependency in package.json');
assert(wrangler.includes('name = "kidsmaths-tts-proxy"'), 'Expected Worker name in wrangler.toml');
assert(worker.includes('api.elevenlabs.io/v1/text-to-speech'), 'Expected Worker to proxy ElevenLabs TTS requests');
assert(worker.includes('Access-Control-Allow-Origin'), 'Expected Worker CORS headers for GitHub Pages app');
assert(worker.includes('ELEVENLABS_API_KEY'), 'Expected Worker to use ElevenLabs secret binding');
assert(worker.includes('DEFAULT_VOICE_ID'), 'Expected Worker to support default British narrator voice binding');

console.log('English TTS checks passed.');
