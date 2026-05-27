const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

test('mobile framework is the css topology entrypoint', async () => {
    const root = path.join(__dirname, '..');
    const css = await fs.readFile(path.join(root, 'css', 'mobile-framework.css'), 'utf8');
    const imports = [...css.matchAll(/@import url\('([^']+)'\);/g)].map((match) => match[1]);

    assert.deepEqual(imports, [
        'mobile/reset-base.css',
        'mobile/layout.css',
        'mobile/controls.css',
        'themes/theme-a.css',
        'themes/theme-b.css',
        'themes/theme-c.css',
        'themes/theme-d.css',
        'themes/theme-e.css',
        'themes/aero.css',
        'themes/metro.css',
        'mobile/responsive.css',
        'mobile/accessibility.css',
        'syrretro.css',
    ]);

    for (const importedPath of imports) {
        await fs.access(path.join(root, 'css', importedPath));
    }
});

test('functional css layer does not contain visual theme selectors', async () => {
    const root = path.join(__dirname, '..');
    const functionalFiles = [
        'css/mobile/reset-base.css',
        'css/mobile/layout.css',
        'css/mobile/controls.css',
        'css/mobile/responsive.css',
        'css/mobile/accessibility.css',
    ];

    for (const file of functionalFiles) {
        const css = await fs.readFile(path.join(root, file), 'utf8');
        assert.doesNotMatch(css, /\.(theme-[a-e]|aero|metro)\b/, file);
    }
});
