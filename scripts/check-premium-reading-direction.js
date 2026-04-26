const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(html.includes('KidMaths Reading'), 'Home should present a reading-first product frame, not only the old KidMaths label');
assert(html.includes('Choose your shelf'), 'Home should use direct shelf choice language');
assert(!js.includes('Browse shelves'), 'Home hero CTA should not use the generic Browse shelves abstraction');
assert(js.includes('Continue reading — or choose a shelf'), 'Empty/returning home hero should truthfully frame continue vs shelf choice');
assert(js.includes('Open English shelf'), 'English home card should point directly to the shelf');
assert(js.includes('Open Urdu shelf'), 'Urdu home card should point directly to the shelf');
assert(js.includes('Next Urdu read'), 'Unread Urdu hero should be Next Urdu read, not Last Read');
assert(js.includes('Continue Urdu read'), 'In-progress Urdu hero should have a resume-specific label');
assert(js.includes('English support is tucked away until requested'), 'Urdu reader should hide English support by default with calm wording');
assert(css.includes('--premium-ink'), 'Premium reading design tokens should exist');
assert(css.includes('.reading-premium-shell'), 'Reading shelves should use a premium shell class');
assert(css.includes('.story-screen.is-article-reader'), 'Article reader should have a dedicated premium article-reader mode');
assert(css.includes('.update-bar:not(.pressing):not(.checking):not(.done)'), 'Build/update chip should be visually demoted unless active');
assert(css.includes('font-family: var(--font-urdu)'), 'Urdu surfaces should use a deliberate Urdu font stack');

console.log('Premium reading direction checks passed.');
