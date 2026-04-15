const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(html.includes('id="story-title-translation-toggle"'), 'Expected story title translation toggle in story header');
assert(js.includes('this._showStoryTitleTranslation = false;'), 'Expected story title translation state reset');
assert(js.includes("window.matchMedia?.('(max-width: 720px)').matches"), 'Expected phone-specific English title collapse logic');
assert(js.includes('_renderInlineUrduWordHelper(index)'), 'Expected inline Urdu word helper rendering per paragraph');
assert(js.includes('Word help stays close to the line so you can keep your place.'), 'Expected support copy to reinforce near-line help');
assert(js.includes('class="secondary-btn urdu-save-word-btn"'), 'Expected save button inside inline word helper');
assert(css.includes('.urdu-inline-word-helper {'), 'Expected inline Urdu helper styling');
assert(css.includes('.urdu-paragraph-block.has-selection {'), 'Expected selected paragraph layout for wide screens');
assert(css.includes('margin-bottom: calc(var(--spacing-lg) + 84px);'), 'Expected extra space above sticky story nav');
assert(css.includes('.story-title-translation-toggle {'), 'Expected translation toggle styling');

console.log('Urdu reading page checks passed.');
