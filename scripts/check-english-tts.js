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

assert(html.includes('story-audio-controls'), 'Expected story audio controls in index.html');
assert(html.includes('story-speak-selection-btn'), 'Expected speak-selection button in index.html');
assert(html.includes('story-stop-audio-btn'), 'Expected stop-audio button in index.html');
assert(html.includes('story-audio-status'), 'Expected story audio status label in index.html');

assert(css.includes('.story-audio-controls'), 'Expected story audio controls styling in css');
assert(css.includes('.story-audio-status'), 'Expected story audio status styling in css');
assert(css.includes('#story-screen,\n#story-content,\n#story-text {'), 'Expected story reading surface to explicitly allow text selection');
assert(css.includes('-webkit-touch-callout: default;'), 'Expected iOS text callout support on the story reading surface');

assert(app.includes('_handleStoryTextSelection'), 'Expected story text selection handler in app.js');
assert(app.includes('_queueStoryTextSelectionCheck'), 'Expected debounced selectionchange handling in app.js');
assert(app.includes('_getNormalizedActiveStorySelectionText'), 'Expected helper for active story selection text in app.js');
assert(app.includes("document.addEventListener('selectionchange'"), 'Expected global selectionchange listener for mobile selection reliability');
assert(app.includes('_speakStorySelection'), 'Expected story selection speech method in app.js');
assert(app.includes('_requestStorySpeechAudio'), 'Expected proxy speech request method in app.js');
assert(app.includes('_playStorySelectionWithDeviceVoice'), 'Expected device-voice fallback method in app.js');
assert(app.includes('_stopStoryAudio'), 'Expected audio stop method in app.js');
assert(app.includes('storyAudioSelection'), 'Expected persisted/managed story audio selection state in app.js');
assert(app.includes('storyTtsProxyUrl'), 'Expected configurable TTS proxy URL state in app.js');
assert(app.includes('Cloud voice is temporarily unavailable on the current ElevenLabs plan.'), 'Expected a clear fallback message when ElevenLabs free-tier abuse detection blocks a request');
assert(app.includes('speechSynthesis'), 'Expected browser speech synthesis fallback support in app.js');
assert(app.includes('this._storyTouchStartedInText'), 'Expected swipe navigation to ignore text-selection gestures that start inside story text');

assert(pkg.includes('wrangler'), 'Expected wrangler dependency in package.json');
assert(wrangler.includes('name = "kidsmaths-tts-proxy"'), 'Expected Worker name in wrangler.toml');
assert(worker.includes('api.elevenlabs.io/v1/text-to-speech'), 'Expected Worker to proxy ElevenLabs TTS requests');
assert(worker.includes('Access-Control-Allow-Origin'), 'Expected Worker CORS headers for GitHub Pages app');
assert(worker.includes('ELEVENLABS_API_KEY'), 'Expected Worker to use ElevenLabs secret binding');
assert(worker.includes('DEFAULT_VOICE_ID'), 'Expected Worker to support default British narrator voice binding');

console.log('English TTS checks passed.');
