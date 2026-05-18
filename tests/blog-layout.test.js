const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const blogHtml = fs.readFileSync(path.join(__dirname, '..', 'blog.html'), 'utf8');

test('blog page uses workspace reader layout with recommendations inside reader panel', () => {
    assert.match(blogHtml, /grid-template-columns:\s*260px\s+minmax\(0,\s*1fr\)/);
    assert.doesNotMatch(blogHtml, /grid-template-columns:\s*260px\s+minmax\(0,\s*1fr\)\s+280px/);
    assert.match(blogHtml, /class="reader-workspace"/);
    assert.match(blogHtml, /class="reader-article-wrap"/);
    assert.match(blogHtml, /<aside class="blog-side-panel"/);
    assert.match(blogHtml, /<section class="blog-panel blog-reader-panel"[\s\S]*<aside class="blog-side-panel"/);
    assert.equal((blogHtml.match(/id="random-list"/g) || []).length, 1);
    assert.equal((blogHtml.match(/id="tree-backdrop"/g) || []).length, 1);
    assert.equal((blogHtml.match(/const state = /g) || []).length, 1);
});
