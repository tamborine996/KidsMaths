const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(js.includes("Pick up again"), 'Expected current Urdu hero kicker');
assert(js.includes("Continue your Urdu reading"), 'Expected current Urdu hero heading');
assert(js.includes("Your reading shelf"), 'Expected Urdu library shelf framing');
assert(js.includes("Add a fresh BBC Urdu article"), 'Expected softened BBC import framing');
assert(js.includes("For grown-ups"), 'Expected parent-facing BBC import framing');
assert(js.includes("Choose article"), 'Expected quieter BBC import CTA');
assert(js.includes("list.classList.toggle('urdu-story-list', tab === 'urdu');"), 'Expected dedicated Urdu story-list class toggle');
assert(js.includes("activeStories[0]"), 'Expected Urdu hero fallback to first active item');
assert(js.includes('urdu-library-lower-grid'), 'Expected lower-grid layout wrapper for shelf and import surfaces');
assert(js.includes('urdu-item-progress-copy'), 'Expected stronger progress summary copy');
assert(css.includes('.urdu-dashboard-top {'), 'Expected top-level Urdu dashboard layout');
assert(css.includes('.story-list.urdu-story-list {'), 'Expected Urdu story list layout override');
assert(css.includes('.urdu-library-lower-grid {'), 'Expected shelf and import split layout');
assert(css.includes('.urdu-library-card-list {'), 'Expected card-grid library layout');
assert(css.includes('.urdu-item-row.is-featured {'), 'Expected featured Urdu hero card styling');
assert(css.includes('.urdu-item-progress-copy {'), 'Expected stronger progress summary styling');
assert(css.includes('.urdu-current-section,'), 'Expected grouped Urdu section styling');

console.log('Urdu library layout checks passed.');
