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
assert(js.includes("Supportive Urdu reads stay first. Older or parent-managed items stay further out of the way."), 'Expected Urdu library shelf to emphasize learner-first progression over parent-managed items');
assert(js.includes('_getStorySavedWordKey('), 'Expected unified saved-word key builder to remain available for Urdu highlights via the shared store');
assert(js.includes('_isUrduWordBookmarked('), 'Expected Urdu reader to detect persistent bookmarked words on rerender');
assert(js.includes("_selectStoryWord(word, paragraphIndex = -1, occurrenceIndex = -1, tokenIndex = occurrenceIndex, { localMeaning = '' } = {})"), 'Expected shared word selection to accept a trusted local Urdu meaning');
assert(js.includes("this._selectStoryWord(word, paragraphIndex, occurrenceIndex, occurrenceIndex, { localMeaning: meaning });"), 'Expected _selectUrduWord to pass trusted local meanings into the shared selection flow');
assert(js.includes("if (this.currentStory.direction === 'rtl' && this._selectionIsSingleWord(nextSelection) && !trustedMeaning)"), 'Expected shared Urdu selection flow to skip Google translation when a trusted local meaning already exists');
assert(js.includes('_renderUrduArticleText(text = \'\')'), 'Expected a dedicated Urdu article reader render path');
assert(js.includes('_isUrduArticleStory(story = this.currentStory)'), 'Expected Urdu article stories to have their own mode detection');

console.log('Urdu reading layout checks passed.');
