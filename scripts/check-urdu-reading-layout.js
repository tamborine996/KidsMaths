const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(html.includes('id="urdu-save-word-btn"'), 'Expected legacy Urdu save-word control element to remain in the DOM for compatibility');
assert(html.includes('id="urdu-clear-selection-btn"'), 'Expected legacy Urdu clear-word control element to remain in the DOM for compatibility');
assert(js.includes('_renderStorySelectionControls()'), 'Expected Urdu reader to use the shared anchored story selection popup');
assert(js.includes("this._storySelectionActionsOpen = true;"), 'Expected Urdu word selection to open the shared popup actions');
assert(js.includes("tools.classList.add('hidden');"), 'Expected old Urdu support panel to stay hidden now that the shared popup owns word actions');
assert(js.includes("Only the two live article reads stay on the main shelf; everything else is archived out of the way."), 'Expected Urdu library shelf to be simplified around live article reads');
assert(js.includes('_getUrduSavedWordKey('), 'Expected Urdu saved words to use exact coordinate keys for persistent highlights');
assert(js.includes('_isUrduWordBookmarked('), 'Expected Urdu reader to detect persistent bookmarked words on rerender');
assert(js.includes('_renderUrduArticleText(text = \'\')'), 'Expected a dedicated Urdu article reader render path');
assert(js.includes('_isUrduArticleStory(story = this.currentStory)'), 'Expected Urdu article stories to have their own mode detection');

console.log('Urdu reading layout checks passed.');
