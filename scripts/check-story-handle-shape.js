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

assert(css.includes('.story-selection-adjuster::before {'), 'Expected a single-piece pseudo-element shape for story selection handles');
assert(css.includes('.story-selection-adjuster-stem {\n    display: none;'), 'Expected old stem element to be hidden');
assert(css.includes('.story-selection-adjuster-dot {\n    display: none;'), 'Expected old dot element to be hidden');
assert(css.includes('.story-selection-adjuster.is-start::before {'), 'Expected start handle pseudo-element styling');
assert(css.includes('.story-selection-adjuster.is-end::before {'), 'Expected end handle pseudo-element styling');
assert(css.includes('background-image: url("data:image/svg+xml') && css.includes("M4 0H10V10") && css.includes("M10 14C10 16 9 18 6 18"), 'Expected flatter native-style mirrored handle contour');
assert(app.includes("closest('.story-selection-unit')"), 'Expected handle positioning to use the actual highlighted selection unit rather than the taller inline button box');
assert(app.includes('selectionRect.bottom - 2'), 'Expected handle top position to sit flush with the highlighted selection unit without obscuring letters');

console.log('Story handle shape checks passed.');
