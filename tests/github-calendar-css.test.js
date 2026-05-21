const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

function extractRule(css, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));
    return match ? match[1] : '';
}

test('calendar brightness transition is defined on the base day cell for hover-out easing', async () => {
    const css = await fs.readFile(path.join(__dirname, '..', 'css', 'github-calendar.css'), 'utf8');
    const baseRule = extractRule(css, 'td.ContributionCalendar-day');
    const hoverRule = extractRule(css, 'td.ContributionCalendar-day:hover');

    assert.match(baseRule, /filter:\s*brightness\(1\)/);
    assert.match(baseRule, /transition:[^;}]*filter\s+1000ms[^;}]*ease-out/);
    assert.doesNotMatch(hoverRule, /transition:\s*filter/);
    assert.match(hoverRule, /filter:\s*brightness\(1\.52\)/);
});
