const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

assert(packageJson.includes('check-story-gesture-safety.js'), 'Expected gesture-safety regression checks to be wired into npm test');
assert(app.includes('_shouldTurnStoryPageFromTouch('), 'Expected a dedicated gesture gate for page turns');
assert(app.includes('_cancelActiveStoryTextGestures('), 'Expected a shared canceller for active story text gestures');
assert(app.includes('_cancelActiveStoryTextGestures({ clearSelection: false })'), 'Expected pinch start to cancel pending text gestures without wiping selection');
assert(app.includes('if (!this._shouldTurnStoryPageFromTouch({ deltaX, deltaY, startedInText: this._storyTouchStartedInText })) return;'), 'Expected story swipe turns to respect gesture-gating helper');
assert(!app.includes('if (this._storyTouchStartedInText) return;'), 'Expected text-originating swipes to be gated intelligently, not blocked outright');

console.log('Story gesture safety checks passed.');
