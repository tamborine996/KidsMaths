const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

assert(!css.includes('border-bottom: 2px dotted #8C6A9E;'), 'Expected Urdu reader default words to stop using the always-on dotted underline treatment');
assert(js.includes('_storySelectionEngine.createRangeSelection('), 'Expected codebase to support range selection as the parity target');

console.log('Urdu reader parity style checks passed.');
