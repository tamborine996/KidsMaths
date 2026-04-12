const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(js.includes('const HOLD_DURATION = 1000;'), 'Expected long-press duration to be 1000ms');
assert(css.includes('min-height: 40px;'), 'Expected larger update bar touch target');
assert(css.includes('width: 20px;') && css.includes('height: 20px;'), 'Expected larger update dot size');
assert(html.includes('class="screen-header-actions"'), 'Expected grouped header navigation controls');
assert((html.match(/class="home-btn"/g) || []).length >= 8, 'Expected Home buttons on each non-home screen header');
assert(js.includes("querySelectorAll('.back-btn, .home-btn')"), 'Expected JS to bind both Back and Home buttons');
assert(css.includes('.home-btn') || css.includes('.back-btn,\n.home-btn'), 'Expected CSS styling for Home buttons');

console.log('Mobile/tablet UX checks passed.');
