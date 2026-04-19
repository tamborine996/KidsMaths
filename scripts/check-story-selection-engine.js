const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

function makeButton({ text, normalized = text, paragraphIndex = 0, occurrenceIndex = 0, tokenIndex = 0, rect }) {
  return {
    dataset: {
      storyWord: text,
      storyWordNormalized: normalized,
      paragraphIndex: String(paragraphIndex),
      occurrenceIndex: String(occurrenceIndex),
      tokenIndex: String(tokenIndex),
    },
    textContent: text,
    getBoundingClientRect() {
      return rect;
    },
  };
}

(async () => {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'js', 'story-selection-engine.js')).href;
  const { StorySelectionEngine } = await import(moduleUrl);

  const buttons = [
    makeButton({
      text: 'book',
      tokenIndex: 58,
      rect: { left: 120, right: 200, top: 100, bottom: 150, width: 80, height: 50 },
    }),
    makeButton({
      text: 'thought',
      tokenIndex: 102,
      rect: { left: 120, right: 220, top: 280, bottom: 330, width: 100, height: 50 },
    }),
    makeButton({
      text: 'other',
      paragraphIndex: 1,
      tokenIndex: 0,
      rect: { left: 420, right: 500, top: 100, bottom: 150, width: 80, height: 50 },
    }),
  ];

  const storyText = {
    querySelectorAll(selector) {
      if (!selector.includes('.story-word-button')) return [];
      if (selector.includes('[data-paragraph-index="0"]')) {
        return buttons.filter((button) => button.dataset.paragraphIndex === '0');
      }
      if (selector.includes('[data-paragraph-index="1"]')) {
        return buttons.filter((button) => button.dataset.paragraphIndex === '1');
      }
      return buttons;
    },
  };

  global.document = {
    elementsFromPoint() {
      return [];
    },
  };

  const engine = new StorySelectionEngine({
    getStoryText: () => storyText,
    normalizeWord: (word) => String(word || '').trim().toLowerCase(),
  });

  const aboveLineSelection = engine.getSelectionNearPoint(150, 10, 0);
  assert(aboveLineSelection, 'Expected nearest-word fallback to return a selection even when the drag point is well above the previous line');
  assert.strictEqual(aboveLineSelection.tokenIndex, 58, 'Expected upward drag selection to snap to the nearest earlier word in the same paragraph');

  const paragraphScopedSelection = engine.getSelectionNearPoint(450, 120, 0);
  assert.strictEqual(paragraphScopedSelection.tokenIndex, 58, 'Expected paragraph preference to stop handle drag from snapping into another paragraph');

  global.document = {
    elementsFromPoint() {
      return [{ classList: { contains: () => false } }, buttons[1]];
    },
  };

  const directHitSelection = engine.getSelectionNearPoint(160, 300, 0);
  assert.strictEqual(directHitSelection.tokenIndex, 102, 'Expected elementsFromPoint stack to see through overlays and pick the underlying word button');

  console.log('Story selection engine checks passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
