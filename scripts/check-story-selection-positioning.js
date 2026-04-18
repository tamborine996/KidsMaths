const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const positioning = fs.readFileSync(path.join(root, 'js', 'story-selection-positioning.js'), 'utf8');
const interactionDoc = fs.readFileSync(path.join(root, 'KIDSMATHS_INTERACTION_SYSTEM.md'), 'utf8');
const androidGatesDoc = fs.readFileSync(path.join(root, 'KIDSMATHS_ANDROID_WEB_GATES.md'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

assert(packageJson.includes('check-story-selection-positioning.js'), 'Expected popup-positioning regression checks to be wired into npm test');
assert(css.includes('.story-selection-controls.is-anchored {'), 'Expected anchored popup CSS block');
assert(css.includes('left: auto;'), 'Expected anchored popup CSS to clear legacy left centering');
assert(css.includes('bottom: auto;'), 'Expected anchored popup CSS to clear legacy bottom anchoring');
assert(css.includes('transform: translateY(var(--story-selection-sheet-offset));'), 'Expected anchored popup CSS to remove legacy horizontal translate while keeping drag offset');
assert(positioning.includes("controls.dataset.storySelectionPlacement = placement;"), 'Expected positioning helper to expose chosen placement for debugging');
assert(positioning.includes("controls.dataset.storySelectionAnchor = JSON.stringify"), 'Expected positioning helper to expose anchor geometry for debugging');
assert(app.includes('_updateStorySelectionPopupPosition('), 'Expected app to keep using dedicated popup-positioning refresh path');
assert(interactionDoc.includes('Android / Chrome mobile-web release gates'), 'Expected project interaction doc to define Android/mobile-web release gates');
assert(interactionDoc.includes('VisualViewport'), 'Expected project interaction doc to mention VisualViewport as a first-class mobile constraint');
assert(interactionDoc.includes('top-left'), 'Expected project interaction doc to require edge-case popup checks such as top-left');
assert(androidGatesDoc.includes('Input and gesture gates'), 'Expected Android gates doc to define touch/gesture release gates');
assert(androidGatesDoc.includes('PWA and caching gates'), 'Expected Android gates doc to define cache/version discipline');
assert(androidGatesDoc.includes('phone-width DOM/geometry verification pass'), 'Expected Android gates doc to require phone-width geometry verification before signoff');

console.log('Story selection positioning checks passed.');
