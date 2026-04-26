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
const storySelectionPositioningPath = path.join(root, 'js', 'story-selection-positioning.js');
const storySelectionPositioning = fs.existsSync(storySelectionPositioningPath)
  ? fs.readFileSync(storySelectionPositioningPath, 'utf8')
  : '';

assert(html.includes('id="story-selection-controls"'), 'Expected dedicated custom story-selection controls in index.html');
assert(html.includes('id="story-selection-speak-btn"'), 'Expected custom Speak button for selected story words');
assert(html.includes('id="story-selection-bookmark-btn"'), 'Expected bookmark button inside the story word sheet');
assert(html.includes('id="story-selection-save-btn"'), 'Expected Save button inside the story word sheet');
assert(html.includes('aria-label="Speak selected word"'), 'Expected speak icon button to keep an explicit aria-label');
assert(html.includes('aria-label="Save selected word"'), 'Expected save icon button to keep an explicit aria-label');
assert(html.includes('aria-label="Bookmark this place in the story"'), 'Expected bookmark icon button to keep an explicit place-bookmark aria-label');
assert(html.includes('id="story-selection-bookmark-meta"'), 'Expected visible story-word action meta text in the story word sheet');
assert(html.includes('story-selection-btn-label'), 'Expected visible action labels under story selection icons');
assert(html.includes('>Place<'), 'Expected the selection popup to expose an explicit visible place-bookmark action label');
assert(html.includes('>Save<'), 'Expected the selection popup to expose an explicit visible save action label');
assert(html.includes('story-selection-btn-icon'), 'Expected icon-only popup buttons');
assert(html.includes('aria-label="Selected word"'), 'Expected the top chip to expose clear selected-word meaning');
assert(!html.includes('id="story-selection-clear-btn"'), 'Expected Clear to be removed from the popup in favor of dismiss-by-tap-outside');
assert(!html.includes('id="story-selection-more-btn"'), 'Expected More to be removed from the tiny word popup');
assert(!html.includes('id="story-selection-saved-toggle-btn"'), 'Expected saved-words toggle to move out of the tiny word popup');
assert(!html.includes('id="story-selection-saved-panel"'), 'Expected saved-words panel to move out of the tiny word popup');
assert(!html.includes('id="story-voice-source-badge"'), 'Expected voice badge to be removed from the tiny word popup');
assert(!html.includes('id="story-voice-select"'), 'Expected voice picker to be removed from the tiny word popup');
assert(!html.includes('id="story-stop-audio-btn"'), 'Expected stop-audio button to be removed from the story word sheet');
assert(html.includes('id="bookmark-btn"'), 'Expected visible story-header bookmark button for quick bookmark access');
assert(html.includes('id="story-selection-adjusters"'), 'Expected Kindle-style range-adjuster container for multi-word selection');
assert(html.includes('id="story-selection-start-handle"'), 'Expected visible start handle for adjusting selected story text');
assert(html.includes('id="story-selection-end-handle"'), 'Expected visible end handle for adjusting selected story text');

assert(stateManager.includes('storySavedWords: []'), 'Expected persisted storySavedWords state');

assert(app.includes('_renderInteractiveEnglishStoryText('), 'Expected English reader text to render into app-owned selectable word units');
assert(app.includes('_selectStoryWord('), 'Expected custom English story word selection handler');
assert(app.includes('_selectStoryWordRange('), 'Expected phrase-range selection handler for story reader');
assert(app.includes('_beginStoryWordHoldSelection('), 'Expected long-hold selection start handler for story reader');
assert(app.includes('_activateStoryWordHoldSelection('), 'Expected long-hold activation handler for story reader');
assert(app.includes('_updateStoryWordHoldSelection('), 'Expected long-hold selection update handler for story reader');
assert(app.includes('_cancelStoryWordHoldSelection('), 'Expected long-hold cancellation handler for story reader');
assert(app.includes('_clearStoryWordSelection('), 'Expected custom English story word clearing handler');
assert(app.includes('_saveSelectedStoryWord('), 'Expected save action for selected story words');
assert(app.includes('_bookmarkCurrentStoryFromSelection('), 'Expected anchored story bookmark action helper to remain available');
assert(app.includes('_buildStoryBookmarkAnchor('), 'Expected bookmark anchor builder for exact story location restore');
assert(app.includes('_selectionFromBookmarkAnchor('), 'Expected bookmark anchor rehydration helper');
assert(app.includes('_restoreStoryBookmarkAnchor('), 'Expected bookmark restore path to reselect the anchored word or range');
assert(app.includes('_handleStoryHeaderBookmark('), 'Expected visible story-header bookmark access handler');
assert(app.includes('_beginStorySelectionHandleDrag('), 'Expected Kindle-style selection handle drag start handler');
assert(app.includes('_updateStorySelectionHandleDrag('), 'Expected Kindle-style selection handle drag update handler');
assert(app.includes('_getStoryPreviewSelection('), 'Expected subtle pre-hold preview selection helper for first-press handles');
assert(app.includes('_ensureStoryPreviewSelection('), 'Expected first-press preview selection bootstrap for subtle handles');
assert(app.includes('_storySelectionActionsOpen'), 'Expected story reader to track popup/actions separately from selection');
assert(app.includes('_openStorySelectionActions('), 'Expected explicit long-hold popup opener for selected story text');
assert(app.includes('_selectStoryWord('), 'Expected single-press story word selection path to remain available');
assert(app.includes('rect.right - 18'), 'Expected visible start-handle graphic to sit flush to the selected word boundary instead of leaving a wide outside gap');
assert(app.includes('rect.left - 10'), 'Expected visible end-handle graphic to sit flush to the selected word boundary instead of leaving a wide outside gap');
assert(app.includes("closest('.story-selection-unit')"), 'Expected handle positioning to anchor vertically to the actual highlighted selection unit');
assert(app.includes('selectionRect.bottom - 2'), 'Expected the current Urdu handle review build to pin the visible handles to the bottom edge of the highlighted selection unit');
assert(app.includes('_getStoryWordSelectionNearPoint('), 'Expected nearest-word fallback for selection-handle dragging');
assert(app.includes('setPointerCapture?.(pointerEvent.pointerId)'), 'Expected pointer capture on selection handles during drag');
assert(app.includes('releasePointerCapture?.(pointerEvent.pointerId)'), 'Expected pointer capture release after handle drag');
assert(!app.includes('if (distance > 56) return;'), 'Expected nearest-word fallback to avoid fragile hard cutoff distance');
assert(app.includes('if (startedInText && this._getSelectedStoryWord()) return false;'), 'Expected page-turn swipe to yield when story text is already selected');
assert(app.includes('_updateStorySelectionHandles('), 'Expected selection handles to reposition with the active range');
assert(app.includes("from './story-selection-positioning.js'"), 'Expected app.js to import dedicated story selection positioning helper');
assert(app.includes('_updateStorySelectionPopupPosition('), 'Expected app.js to refresh anchored story popup positioning');
assert(app.includes('_renderStorySelectionControls('), 'Expected dedicated render path for story selection controls');
assert(app.includes('_getStorySavedWords('), 'Expected saved-story-word accessor');
assert(app.includes('_getStorySavedWordKey('), 'Expected exact saved-word key builder for persistent word bookmarks');
assert(app.includes('_storySavedWordMatchesToken('), 'Expected exact saved-word token matching for persistent pink highlights');
assert(app.includes("status.textContent = selectionLabel;"), 'Expected the top chip value to show only the selected word text');
assert(storySelectionPositioning.includes('floating-ui.dom.bundle.mjs'), 'Expected story selection positioning helper to use Floating UI');
assert(storySelectionPositioning.includes('computePosition'), 'Expected Floating UI computePosition usage for story selection popup');
assert(storySelectionPositioning.includes('getClientRects'), 'Expected story selection positioning helper to account for multi-rect selections');
assert(storySelectionPositioning.includes('visualViewport'), 'Expected story selection positioning helper to respect the visual viewport');
assert(app.includes("status.textContent = 'hold one';"), 'Expected calm top-chip fallback copy for the long-hold icon popup');
assert(!app.includes('Tap a word or drag across a phrase to hear it, save it, bookmark it, or clear it.'), 'Expected old save-heavy helper copy to be removed');
assert(app.includes("bookmarkMeta.textContent = activeFeedback === 'bookmarked' ? 'Bookmarked place' : saveMetaLabel;"), 'Expected popup meta text to distinguish saved-word vs bookmarked-place feedback');
assert(app.includes('story-word-button'), 'Expected custom button class for selectable English story words');
assert(app.includes('data-token-index'), 'Expected token index markers for phrase range selection');
assert(!app.includes('_handleStoryTextSelection()'), 'Expected native selection-based English TTS handler to be removed');
assert(!app.includes("document.addEventListener('selectionchange'"), 'Expected global selectionchange listener to be removed from story selection flow');

assert(css.includes('.story-selection-controls {'), 'Expected styling for custom story-selection controls');
assert(css.includes('.story-word-button {'), 'Expected styling for selectable English story words');
assert(css.includes('.story-selection-unit.is-selected,'), 'Expected continuous selected-range styling wrapper for story words');
assert(css.includes('.story-selection-fragment.is-selected {'), 'Expected selected spaces/punctuation styling for continuous story highlights');
assert(css.includes('.story-word-button.is-selected {'), 'Expected visible selected-state styling for story words');
assert(css.includes('.story-word-button.is-range-edge {'), 'Expected visible edge styling for phrase selection');
assert(css.includes('.story-selection-bookmark-meta {'), 'Expected visible word-bookmark clarification styling in the story word sheet');
assert(css.includes('.story-selection-unit.is-bookmarked-word:not(.is-selected) {'), 'Expected persistent light-pink bookmarked-word styling');
assert(css.includes('.story-word-button.is-bookmarked-word:not(.is-selected) {'), 'Expected bookmarked word text styling');
assert(css.includes('.story-selection-btn-label {'), 'Expected visible action-label styling under story selection icons');
assert(css.includes('.story-selection-context-value {'), 'Expected selected-word value styling inside the top chip');
assert(css.includes('.story-selection-btn-icon {'), 'Expected dedicated icon styling for popup buttons');
assert(css.includes('#story-screen.story-selection-sheet-open:not(.story-selection-popup-anchored) .story-content {'), 'Expected extra reading-space padding when the story sheet is open');
assert(css.includes('.story-selection-controls.is-anchored {'), 'Expected anchored popup styling for story selection controls');
assert(css.includes('.story-selection-adjusters {'), 'Expected Kindle-style selection handle container styling');
assert(css.includes('.story-selection-adjuster {'), 'Expected visible handle styling for multi-word adjustment');
assert(css.includes('width: 38px;'), 'Expected larger handle touch target width for easier backward dragging');
assert(css.includes('.story-selection-adjusters.is-preview .story-selection-adjuster {'), 'Expected subtle first-press preview styling for range handles');
assert(css.includes('#story-screen.story-custom-selection-mode #story-text {'), 'Expected native text selection to be disabled in custom-selection story mode');

console.log('Custom story-selection checks passed.');
