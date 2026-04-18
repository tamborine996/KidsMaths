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
assert(!app.includes('story-progress-fill'), 'Expected story page rendering to stop updating a removed progress bar');
assert(css.includes('.timer-bar {'), 'Expected timer bar styling to remain defined');
assert(!html.includes('id="coin-count"'), 'Expected top timer-bar coin display to be removed from index.html');
assert(timer.includes('if (this.coinCount)'), 'Expected Timer coin updates to handle the top coin display being removed');

console.log('Story reader UI checks passed.');
