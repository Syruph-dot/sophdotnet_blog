const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

const { scanArtifacts } = require('../app');

test('artifacts page falls back to a static manifest when the API is unavailable', async () => {
    const html = await fs.readFile(path.join(__dirname, '..', 'artifacts.html'), 'utf8');

    assert.match(html, /\/api\/artifacts/);
    assert.match(html, /\/data\/artifacts\.json/);
});

test('static artifact manifest matches scanned artifact directories', async () => {
    const siteRoot = path.join(__dirname, '..');
    const scanned = await scanArtifacts(siteRoot);
    const manifest = JSON.parse(
        await fs.readFile(path.join(siteRoot, 'data', 'artifacts.json'), 'utf8')
    );

    assert.deepEqual(manifest, scanned);
});
