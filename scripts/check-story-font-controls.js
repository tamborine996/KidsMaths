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
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const stateManager = fs.readFileSync(path.join(root, 'js', 'managers', 'StateManager.js'), 'utf8');

assert(!html.includes('story-font-decrease-btn'), 'Expected story reader font decrease button to be removed from index.html');
assert(!html.includes('story-font-increase-btn'), 'Expected story reader font increase button to be removed from index.html');
assert(!html.includes('story-font-reset-btn'), 'Expected story reader font reset button to be removed from index.html');
assert(html.includes('story-font-label'), 'Expected visible story reader font size label in index.html');

assert(css.includes('--story-font-size-base'), 'Expected shared story font size CSS variable');
assert(css.includes('--story-font-scale'), 'Expected story font scale CSS variable');
assert(css.includes('font-size: calc(var(--story-font-size-base) * var(--story-font-scale));'), 'Expected base story text to use scalable CSS formula');
assert(css.includes('font-size: calc(var(--story-font-size-urdu) * var(--story-font-scale));'), 'Expected Urdu story text to use scalable CSS formula');
assert(css.includes('font-size: calc(var(--story-font-size-article) * var(--story-font-scale));'), 'Expected article story text to use scalable CSS formula');

assert(app.includes("storyFontScale"), 'Expected story font scale state handling in app.js');
assert(app.includes('_changeStoryFontScale'), 'Expected story font scale change method in app.js');
assert(app.includes('_applyStoryFontScale'), 'Expected story font scale application method in app.js');
assert(app.includes('_applyStoryFontScaleToCurrentStoryText'), 'Expected story text scaling to be applied directly after rendering');
assert(app.includes('_updateStoryFontControls'), 'Expected story font controls UI refresh method in app.js');
assert(app.includes('_beginStoryPinchResize('), 'Expected pinch-to-resize start handler in app.js');
assert(app.includes('_updateStoryPinchResize('), 'Expected pinch-to-resize update handler in app.js');
assert(app.includes('_endStoryPinchResize('), 'Expected pinch-to-resize end handler in app.js');
assert(app.includes('Pinch to resize story text'), 'Expected explicit pinch helper/status copy in app.js');

assert(stateManager.includes('storyFontScale'), 'Expected story font scale persisted in StateManager defaults');

console.log('Story font controls checks passed.');
