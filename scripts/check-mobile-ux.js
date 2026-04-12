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
assert(html.includes('<h3>Start here</h3>'), 'Expected Start here section to lead the home screen');
assert(html.includes('<h3>Maths skills</h3>'), 'Expected maths section to be labelled as skills');
assert(html.includes('home-search-section'), 'Expected search to live in its own lower-priority section');
assert(html.includes('home-footer-label">Grown-ups</div>'), 'Expected grown-ups label above admin buttons');
assert(html.includes('id="home-urdu-hub"'), 'Expected Urdu to exist as its own top-level home hub');
assert(!js.includes("readingBtn.className = 'module-btn';"), 'Expected Reading to be removed from the maths module grid');
assert(!js.includes("urduBtn.className = 'module-btn';"), 'Expected Urdu to be removed from the maths module grid');
assert(js.includes("filter(item => item.key !== primaryKey)"), 'Expected Next Up item to be removed from the resume list');
assert(js.includes("document.getElementById('home-urdu-hub')"), 'Expected JS to bind the Urdu home hub');
assert(js.includes("const urduHub = document.getElementById('home-urdu-hub');"), 'Expected Urdu home hub rendering');
assert(js.includes("<div class=\"learning-area-title\">Urdu</div>"), 'Expected Urdu title in home hub rendering');
assert(js.includes("_getRecentUrduItem()"), 'Expected Urdu to have separate recent-item logic');
assert(js.includes("_isUrduStory(storyId)"), 'Expected Urdu stories to be identified separately from reading stories');
assert(js.includes("cta: 'Resume'"), 'Expected simpler resume CTA copy');
assert(js.includes('Continue ${mode}') || js.includes('Continue '), 'Expected simpler module CTA copy');
assert(css.includes('.next-up-cta,\n.home-resume-foot,\n.learning-area-foot {'), 'Expected pill CTA styling for larger tap targets');
assert(css.includes('.home-search-section {'), 'Expected lower-priority search section styling');
assert(css.includes('.home-footer-label {'), 'Expected styled grown-ups label');
assert(css.includes('.learning-area-urdu {'), 'Expected dedicated Urdu hub styling');
assert(html.includes('id="urdu-story-tools"'), 'Expected Urdu support tools to exist in the story view');
assert(html.includes('id="urdu-page-translation"'), 'Expected Urdu page translation area');
assert(js.includes("document.getElementById('story-text').addEventListener('click'"), 'Expected tap-to-help binding for Urdu words');
assert(js.includes("Saved words (${savedWords.length})"), 'Expected saved words counter UI');
assert(css.includes('.urdu-word-button {'), 'Expected tappable Urdu word styling');
assert(css.includes('.urdu-story-tools {'), 'Expected Urdu support panel styling');
assert(css.includes('.urdu-saved-word-row {'), 'Expected saved word rows styling');
assert(css.includes('.home-resume-meta,\n    .learning-area-stats,\n    .module-card-bottom .module-secondary:last-child {'), 'Expected mobile metadata reduction');

console.log('Mobile/tablet UX checks passed.');
