const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('Poemist runtime loads the committed model bundle by default', () => {
    const script = fs.readFileSync(path.join(root, 'poemist-runtime', 'scripts', 'run_runtime.py'), 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const bundlePath = path.join(root, 'data', 'poemist', 'poemist.poemist');

    assert.ok(fs.statSync(bundlePath).isFile());
    assert.match(script, /DEFAULT_BUNDLE = ROOT \/ "data" \/ "poemist" \/ "poemist\.poemist"/);
    assert.match(script, /bundle_path=generator\.bundle_path/);
    assert.equal(packageJson.scripts['poemist:runtime'], 'python poemist-runtime/scripts/run_runtime.py');
});

test('Poemist model bundle is allowed through the data ignore rule', () => {
    const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

    assert.match(gitignore, /^data\/\*$/m);
    assert.match(gitignore, /^!data\/poemist\/$/m);
    assert.match(gitignore, /^!data\/poemist\/\*\.poemist$/m);
});
