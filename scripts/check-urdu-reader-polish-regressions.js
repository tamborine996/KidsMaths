#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

assert(
  app.includes("storyScreenEl.addEventListener('scroll', () => this._updateStorySelectionAnchoredUi(), { passive: true });"),
  'selection handles must be repositioned on the actual story-screen scroll container'
);

assert(
  app.includes("window.addEventListener('scroll', () => this._updateStorySelectionAnchoredUi(), { passive: true });"),
  'selection handles must also be repositioned on page/window scroll'
);

assert(
  app.includes("window.visualViewport?.addEventListener?.('scroll', () => this._updateStorySelectionAnchoredUi(), { passive: true });"),
  'selection handles must also track visual viewport scroll on mobile browsers'
);

assert(
  app.includes('const selectionIsVisible = selectionUnits.some(unit =>'),
  'selection handles should hide instead of floating when the highlighted word has scrolled away'
);

assert(
  app.includes('const visibleSelectedButtons = selectedButtons.filter((button) =>'),
  'selected-word popup should also hide/reposition based on the highlighted word viewport position'
);

assert(
  app.includes('const hasUrduSelectionMeaning = Boolean(isUrduSelection && selectedWord && meaningText);'),
  'Urdu word meaning must be able to surface immediately after word selection'
);

assert(
  app.includes('this._getCollapsedStoryTitle(story.title, 5)'),
  'Urdu article reader title should collapse to a five-word headline preview'
);

assert(
  app.includes("'More title'") && app.includes("'Hide title'"),
  'collapsed article titles need an explicit expand/collapse control'
);

console.log('Urdu reader polish regression checks passed.');
