const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(js.includes("Last Read"), 'Expected Urdu shelf to reuse Last Read reading-first hero framing');
assert(js.includes("Best next Urdu read"), 'Expected Urdu hero heading to frame the next guided read');
assert(js.includes("Your collection"), 'Expected Urdu shelf to mirror the English collection framing');
assert(js.includes("Supportive Urdu reads stay first"), 'Expected Urdu collection copy to emphasize learner-appropriate progression');
assert(js.includes("Add a fresh BBC Urdu article"), 'Expected softened BBC import framing');
assert(js.includes("Choose article"), 'Expected quieter BBC import CTA');
assert(!js.includes("Put away for now"), 'Expected workflow-first Put away for now CTA to be removed from the active Urdu shelf');
assert(js.includes("list.classList.toggle('urdu-story-list', tab === 'urdu');"), 'Expected dedicated Urdu story-list class toggle');
assert(js.includes("activeStories[0]"), 'Expected Urdu hero fallback to first active item');
assert(js.includes('urdu-library-lower-grid'), 'Expected lower-grid layout wrapper for shelf and import surfaces');
assert(js.includes('urdu-item-progress-copy'), 'Expected stronger progress summary copy');
assert(js.includes('urdu-item-support-line'), 'Expected learner-support cue on Urdu shelf rows');
assert(css.includes('.urdu-dashboard-top {'), 'Expected top-level Urdu dashboard layout');
assert(css.includes('.story-list.urdu-story-list {'), 'Expected Urdu story list layout override');
assert(css.includes('.urdu-library-lower-grid {'), 'Expected shelf and import split layout');
assert(css.includes('.urdu-library-card-list {'), 'Expected card-grid library layout');
assert(css.includes('.urdu-item-row.is-featured {'), 'Expected featured Urdu hero card styling');
assert(css.includes('.urdu-item-progress-copy {'), 'Expected stronger progress summary styling');
assert(css.includes('.urdu-current-section,'), 'Expected grouped Urdu section styling');

console.log('Urdu library layout checks passed.');
