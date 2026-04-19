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
const timer = fs.readFileSync(path.join(root, 'js', 'components', 'Timer.js'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

assert(packageJson.includes('check-story-reader-ui.js'), 'Expected story reader UI regression checks to be wired into npm test');
assert(!html.includes('story-progress-fill'), 'Expected story reader progress bar to be removed from index.html');
assert(!html.includes('story-font-decrease-btn'), 'Expected visible story font decrease control to be removed from index.html');
assert(!html.includes('story-font-increase-btn'), 'Expected visible story font increase control to be removed from index.html');
assert(!html.includes('story-font-reset-btn'), 'Expected visible story font reset control to be removed from index.html');
assert(html.includes('id="bookmark-btn"'), 'Expected a visible story-header bookmark button');
assert(app.includes('_handleStoryHeaderBookmark('), 'Expected dedicated story-header bookmark handler');
assert(app.includes('_goToStoryBookmark('), 'Expected ability to jump back to a saved bookmark');
assert(app.includes('_getOurStoriesBookshelf('), 'Expected dedicated simplified bookshelf helper for Our Stories');
assert(app.includes('homeMathsVisible'), 'Expected a settings-backed home maths visibility flag');
assert(html.includes('Show maths on home'), 'Expected parent settings copy for restoring maths to the home screen');
assert(app.includes("levelSelector.classList.toggle('hidden', hideLevelSelector);"), 'Expected level selector hiding to remain controlled by reading tab state');
assert(app.includes('English'), 'Expected reading IA to expose an English language surface');
assert(app.includes('Urdu'), 'Expected reading IA to expose an Urdu language surface');
assert(!html.includes('Story Library'), 'Expected Story Library tab to be removed from the child-facing reading surface');
assert(!html.includes('Our Stories'), 'Expected Our Stories tab label to be removed from the child-facing reading surface');
assert(app.includes('Last Read'), 'Expected Last Read hero for the English bookshelf');
assert(app.includes('Your collection'), 'Expected collection heading below Last Read');
assert(app.includes('public-domain books'), 'Expected English reading copy to frame the shelf as public-domain books only');
assert(app.includes("const keepIds = new Set(['r5-04', 'r5-05']);"), 'Expected only Alice and A Christmas Carol to remain on the active English shelf');
assert(app.includes("action: 'latest-bookmark'"), 'Expected dedicated latest-bookmark action to exist for bookshelf cards with saved places');
assert(app.includes('data-story-bookshelf-action="open"') || app.includes("action: 'open'"), 'Expected separate open-book action on bookshelf cards');
assert(app.includes('_buildOurStoriesBookshelfRow('), 'Expected dedicated Kindle-style bookshelf row builder for Our Stories');
assert(css.includes('.our-stories-last-read {'), 'Expected dedicated Last Read shelf styling');
assert(css.includes('.our-stories-collection {'), 'Expected dedicated collection styling for the English bookshelf');
assert(css.includes('.our-stories-book-row {'), 'Expected scrollable bookshelf row styling');
assert(!app.includes('story-progress-fill'), 'Expected story page rendering to stop updating a removed progress bar');
assert(css.includes('.timer-bar {'), 'Expected timer bar styling to remain defined');
assert(!html.includes('id="coin-count"'), 'Expected top timer-bar coin display to be removed from index.html');
assert(timer.includes('if (this.coinCount)'), 'Expected Timer coin updates to handle the top coin display being removed');

console.log('Story reader UI checks passed.');
