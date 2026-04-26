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
assert(html.includes('A calm bilingual reading room for English books and Urdu articles'), 'Expected reading-first subtitle copy in the home header');
assert(html.includes('Choose your shelf'), 'Expected direct shelf-choice learning-area heading');
assert(html.includes('home-section-grownups'), 'Expected grown-ups tools to live inside the home content flow rather than a pushed footer');
assert(!html.includes('class="home-footer"'), 'Expected old footer-style grown-ups block to be removed from the homepage shell');
assert(js.includes("Ready for your first quick mission") || js.includes("Pick your first cosy story") || js.includes("Start with one gentle Urdu page"), 'Expected homepage learning cards to use encouraging zero-state copy instead of flat 0-count summaries');
assert(css.includes('.home-kicker {'), 'Expected dedicated home kicker styling');
assert(css.includes('.home-grownups-actions {'), 'Expected compact grown-ups action group styling');
assert(css.includes('grid-template-columns: 1fr;'), 'Expected one-column home grid rules');
assert(!css.includes('.learning-area-grid {\n        grid-template-columns: repeat(3, minmax(0, 1fr));'), 'Expected learning areas to stop switching to 3 columns on wide home layouts');
assert(!css.includes('.learning-area-grid {\n        grid-template-columns: repeat(3, 1fr);'), 'Expected learning areas to stop switching to 3 columns in later responsive overrides');
assert(!css.includes('.home-resume-list {\n        grid-template-columns: repeat(2, minmax(0, 1fr));'), 'Expected resume cards to stop switching to 2 columns on wide home layouts');
assert(!css.includes('.home-resume-list {\n        grid-template-columns: repeat(2, 1fr);'), 'Expected resume cards to stop switching to 2 columns in later responsive overrides');
assert(css.includes('@media (max-width: 560px) {'), 'Expected phone-specific homepage refinement breakpoint');
assert(css.includes('.subtitle {') && !css.includes('background: rgba(255, 255, 255, 0.55);'), 'Expected subtitle styling to stop looking like a fake input pill');
assert(!css.includes('.home-footer {'), 'Expected footer-style home spacing rules to be removed');

console.log('Homepage refresh checks passed.');
