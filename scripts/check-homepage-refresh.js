const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(html.includes('class="home-kicker"'), 'Expected homepage header kicker for stronger mobile hierarchy');
assert(html.includes('One calm next step into maths, stories, or Urdu.'), 'Expected plainer subtitle copy in the home header');
assert(html.includes('Choose your next adventure'), 'Expected launcher-style learning-area heading');
assert(html.includes('home-section-grownups'), 'Expected grown-ups tools to live inside the home content flow rather than a pushed footer');
assert(!html.includes('class="home-footer"'), 'Expected old footer-style grown-ups block to be removed from the homepage shell');
assert(js.includes("Ready for your first quick mission") || js.includes("Pick your first cosy story") || js.includes("Start with one gentle Urdu page"), 'Expected homepage learning cards to use encouraging zero-state copy instead of flat 0-count summaries');
assert(css.includes('.home-kicker {'), 'Expected dedicated home kicker styling');
assert(css.includes('.home-grownups-actions {'), 'Expected compact grown-ups action group styling');
assert(css.includes('@media (max-width: 560px) {'), 'Expected phone-specific homepage refinement breakpoint');
assert(css.includes('.subtitle {') && !css.includes('background: rgba(255, 255, 255, 0.55);'), 'Expected subtitle styling to stop looking like a fake input pill');
assert(!css.includes('.home-footer {'), 'Expected footer-style home spacing rules to be removed');

console.log('Homepage refresh checks passed.');
