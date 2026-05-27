const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

test('retro card page contains the requested profile and 2013-style constraints', async () => {
    const html = await fs.readFile(path.join(__dirname, '..', 'card.html'), 'utf8');
    const css = await fs.readFile(path.join(__dirname, '..', 'css', 'syrretro.css'), 'utf8');

    assert.match(html, /Syruph_dot/);
    assert.match(html, /东方Project、BA/);
    assert.match(html, /电气工程及其自动化/);
    assert.match(html, /想玩硬件，设计电路焊电路，但是完全没空（笑/);
    assert.match(html, /data-rgb-grid="16x16x16"/);
    assert.match(html, /href="css\/mobile-framework\.css/);
    assert.doesNotMatch(html, /href="css\/syrretro\.css/);
    assert.doesNotMatch(html, /<style\b/i);
    assert.match(css, /FangSong/);
    assert.match(css, /linear-gradient/);
});

test('shared navigation links to the retro card page', async () => {
    const headerHtml = await fs.readFile(path.join(__dirname, '..', 'include', 'header.html'), 'utf8');
    const sharedHeaderJs = await fs.readFile(path.join(__dirname, '..', 'js', 'shared-header.js'), 'utf8');

    assert.match(headerHtml, /href="card\.html">名片/);
    assert.match(sharedHeaderJs, /href="card\.html">名片/);
});

test('retro card page keeps CSS colors on the 16-step RGB grid', async () => {
    const css = await fs.readFile(path.join(__dirname, '..', 'css', 'syrretro.css'), 'utf8');
    const hexColors = css.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
    const alphaValues = [...css.matchAll(/rgba\([^,]+,[^,]+,[^,]+,([0-9.]+)\)/g)]
        .map((match) => Number(match[1]));
    const isGridHex = (color) => {
        const hex = color.slice(1).toLowerCase();
        if (hex.length === 3) return true;
        return hex.length === 6
            && hex[0] === hex[1]
            && hex[2] === hex[3]
            && hex[4] === hex[5];
    };
    const isGridAlpha = (alpha) => Math.abs(Math.round(alpha * 15) / 15 - alpha) < 0.005;

    assert.deepEqual(hexColors.filter((color) => !isGridHex(color)), []);
    assert.deepEqual(alphaValues.filter((alpha) => !isGridAlpha(alpha)), []);
});
