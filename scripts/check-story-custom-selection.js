const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
const stateManager = fs.readFileSync(path.join(root, 'js', 'managers', 'StateManager.js'), 'utf8');

assert(html.includes('id="story-selection-controls"'), 'Expected dedicated custom story-selection controls in index.html');
assert(html.includes('id="story-selection-speak-btn"'), 'Expected custom Speak button for selected story words');
assert(html.includes('id="story-selection-save-btn"'), 'Expected custom Save button for selected story words');
assert(html.includes('id="story-selection-bookmark-btn"'), 'Expected bookmark button inside the story word sheet');
assert(html.includes('id="story-selection-clear-btn"'), 'Expected custom Clear button for selected story words');
assert(html.includes('id="story-selection-saved-toggle-btn"'), 'Expected saved-words toggle for story reader');
assert(html.includes('id="story-selection-saved-panel"'), 'Expected saved-words panel for story reader');
assert(!html.includes('id="story-stop-audio-btn"'), 'Expected stop-audio button to be removed from the story word sheet');
assert(!html.includes('id="bookmark-btn"'), 'Expected standalone story-header bookmark button to be removed');

assert(stateManager.includes('storySavedWords: []'), 'Expected persisted storySavedWords state');

assert(app.includes('_renderInteractiveEnglishStoryText('), 'Expected English reader text to render into app-owned selectable word units');
assert(app.includes('_selectStoryWord('), 'Expected custom English story word selection handler');
assert(app.includes('_selectStoryWordRange('), 'Expected phrase-range selection handler for story reader');
assert(app.includes('_beginStoryWordDragSelection('), 'Expected drag selection start handler for story reader');
assert(app.includes('_updateStoryWordDragSelection('), 'Expected drag selection update handler for story reader');
assert(app.includes('_clearStoryWordSelection('), 'Expected custom English story word clearing handler');
assert(app.includes('_saveSelectedStoryWord('), 'Expected save action for selected story words');
assert(app.includes('_bookmarkCurrentStoryFromSelection('), 'Expected bookmark action sourced from the story word sheet');
assert(app.includes('_renderStorySelectionControls('), 'Expected dedicated render path for story selection controls');
assert(app.includes('_getStorySavedWords('), 'Expected saved-story-word accessor');
assert(app.includes("meta.classList.toggle('is-compact'"), 'Expected compact word-sheet mode when a selection is active');
assert(app.includes('Tap a word or drag across a phrase to hear it, save it, bookmark it, or clear it.'), 'Expected calm custom-selection helper copy with bookmark support');
assert(app.includes('Selected phrase:'), 'Expected explicit phrase-selection status copy');
assert(app.includes('Saved ✓'), 'Expected saved-state feedback for selected story words');
assert(app.includes('Bookmarked ✓'), 'Expected subtle bookmarked-state feedback for reading position');
assert(app.includes('story-word-button'), 'Expected custom button class for selectable English story words');
assert(app.includes('data-token-index'), 'Expected token index markers for phrase range selection');
assert(!app.includes('_handleStoryTextSelection()'), 'Expected native selection-based English TTS handler to be removed');
assert(!app.includes("document.addEventListener('selectionchange'"), 'Expected global selectionchange listener to be removed from story selection flow');

assert(css.includes('.story-selection-controls {'), 'Expected styling for custom story-selection controls');
assert(css.includes('.story-word-button {'), 'Expected styling for selectable English story words');
assert(css.includes('.story-word-button.is-selected {'), 'Expected visible selected-state styling for story words');
assert(css.includes('.story-word-button.is-range-edge {'), 'Expected visible edge styling for phrase selection');
assert(css.includes('.story-selection-meta.is-compact {'), 'Expected compact story-sheet meta styling for active selections');
assert(css.includes('#story-screen.story-selection-sheet-open .story-content {'), 'Expected extra reading-space padding when the story sheet is open');
assert(css.includes('#story-screen.story-custom-selection-mode #story-text {'), 'Expected native text selection to be disabled in custom-selection story mode');

console.log('Custom story-selection checks passed.');
