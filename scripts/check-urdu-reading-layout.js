const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(html.includes('id="urdu-save-word-btn"'), 'Expected a dedicated save-word action in the Urdu reading controls');
assert(html.includes('id="urdu-clear-selection-btn"'), 'Expected a dedicated clear-word action in the Urdu reading controls');
assert(js.includes('English sits beside the line so the reading stays open.'), 'Expected updated Urdu reading helper copy for side-by-side English support');
assert(js.includes('Tap a word and its English appears beside the text, not on top of it.'), 'Expected default Urdu helper copy to describe non-overlay English help');
assert(js.includes('_renderActiveUrduMeaningBadge()'), 'Expected inline meaning badge renderer for selected Urdu words');
assert(js.includes('_clearSelectedUrduWord()'), 'Expected Urdu reading flow to support clearing a selected word');
assert(js.includes('this._clearSelectedUrduWord();'), 'Expected selected Urdu words to be clearable from the interaction flow');
assert(js.includes('const isSameWord = this._selectedUrduWord'), 'Expected tapping the same Urdu word to toggle selection off');
assert(js.includes('urdu-inline-meaning-badge'), 'Expected selected Urdu words to render an inline meaning badge');
assert(css.includes('.urdu-inline-meaning-badge {'), 'Expected styling for inline English meaning badges');
assert(css.includes('font-size: clamp(2.2rem, 6vw, 2.7rem);'), 'Expected much larger Urdu reading text sizing');
assert(!css.includes('.urdu-paragraph-row.has-inline-help'), 'Expected Urdu reading layout to stop using an extra helper column that narrows the text row');
assert(!css.includes('margin-bottom: calc(var(--spacing-lg) + 84px);'), 'Expected large reserved bottom gap in Urdu story tools to be removed');
assert(css.includes('.urdu-story-actions .secondary-btn {'), 'Expected compact flexible action-row styling for Urdu reading controls');

console.log('Urdu reading layout checks passed.');
