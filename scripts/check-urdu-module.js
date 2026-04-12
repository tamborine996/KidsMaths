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

assert(indexHtml.includes('data-reading-tab="urdu"'), 'Expected reading screen to have an Urdu tab');
assert(indexHtml.includes('>Urdu<'), 'Expected reading screen or home screen to mention Urdu');

assert(appJs.includes("fetch('data/urdu.json')"), 'Expected app.js to load data/urdu.json');
assert(appJs.includes('this.urduLevels'), 'Expected app.js to track urduLevels');
assert(appJs.includes("tab === 'urdu'"), 'Expected app.js to support Urdu reading tab logic');
assert(appJs.includes("dataset.module = 'urdu'"), 'Expected home screen to include an Urdu button');
assert(appJs.includes('story.direction'), 'Expected story rendering to respect direction metadata');

assert(stateJs.includes("urduLevel: 'U1'"), 'Expected default state to include urduLevel');

console.log('Urdu module checks passed.');
