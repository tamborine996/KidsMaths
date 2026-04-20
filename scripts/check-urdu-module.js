const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const stateJs = fs.readFileSync(path.join(root, 'js', 'managers', 'StateManager.js'), 'utf8');
const urduPath = path.join(root, 'data', 'urdu.json');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(fs.existsSync(urduPath), 'Expected data/urdu.json to exist');

const urduData = JSON.parse(fs.readFileSync(urduPath, 'utf8'));
assert(Array.isArray(urduData.levels) && urduData.levels.length > 0, 'Expected Urdu data to contain at least one level');
assert(urduData.levels[0].stories?.length > 0, 'Expected Urdu level to contain at least one story/item');
assert(urduData.levels[0].stories[0].title, 'Expected first Urdu item to have a title');
assert(urduData.levels[0].stories[0].pages?.length > 0, 'Expected first Urdu item to contain pages');
assert(urduData.levels[0].stories[0].direction === 'rtl', 'Expected first Urdu item to be marked rtl');
assert(urduData.levels[0].stories.length >= 3, 'Expected Urdu library to include multiple items');
assert(urduData.levels[0].stories.some(story => story.id === 'urdu-reader-lion-mouse'), 'Expected Urdu Reader lion and mouse import');
assert(urduData.levels[0].stories.some(story => story.id === 'urdu-reader-akbar-birbal'), 'Expected Urdu Reader Akbar and Birbal import');
assert(urduData.levels[0].stories.some(story => story.source === 'Urdu Reader'), 'Expected imported Urdu Reader sources');
assert(urduData.levels[0].stories.some(story => story.vocabulary && Object.keys(story.vocabulary).length > 20), 'Expected at least one Urdu story with vocabulary support');
assert(urduData.levels[0].stories.some(story => story.pages.some(page => page.translation)), 'Expected at least one Urdu story with English help text');

assert(indexHtml.includes('data-reading-tab="urdu"'), 'Expected reading screen to have an Urdu tab');
assert(indexHtml.includes('>Urdu<'), 'Expected reading screen or home screen to mention Urdu');
assert(indexHtml.includes('id="urdu-story-tools"'), 'Expected story screen to include Urdu support tools');
assert(indexHtml.includes('id="urdu-save-word-btn"'), 'Expected explicit save-word button for Urdu stories');

assert(appJs.includes("fetch('data/urdu.json')"), 'Expected app.js to load data/urdu.json');
assert(appJs.includes('this.urduLevels'), 'Expected app.js to track urduLevels');
assert(appJs.includes("tab === 'urdu'"), 'Expected app.js to support Urdu reading tab logic');
assert(appJs.includes('home-urdu-hub'), 'Expected Urdu hub wiring in app.js');
assert(appJs.includes('A calm Urdu corner') || appJs.includes('A gentle place for Urdu stories'), 'Expected Urdu hub copy in app.js');
assert(appJs.includes('_storySupportsUrduTools'), 'Expected dedicated Urdu story enhancement logic');
assert(appJs.includes('_renderInteractiveUrduText'), 'Expected Urdu text highlighting renderer');
assert(appJs.includes('_saveSelectedUrduWord'), 'Expected saved-word workflow for Urdu');
assert(appJs.includes('story.direction'), 'Expected story rendering to respect direction metadata');

assert(stateJs.includes("urduLevel: 'U1'"), 'Expected default state to include urduLevel');
assert(!stateJs.includes('urduSavedWords: []'), 'Expected legacy standalone urduSavedWords default state to be removed after saved-word unification');
assert(stateJs.includes('storySavedWords'), 'Expected unified storySavedWords state to remain the shared saved-word store');

console.log('Urdu module checks passed.');
