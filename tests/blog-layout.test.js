const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const blogHtml = fs.readFileSync(path.join(__dirname, '..', 'blog.html'), 'utf8');

test('blog page uses full-width reader layout with drawer navigation and recommendations below article', () => {
    assert.match(blogHtml, /max-width:\s*none/);
    assert.match(blogHtml, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.doesNotMatch(blogHtml, /grid-template-columns:\s*260px\s+minmax\(0,\s*1fr\)/);
    assert.doesNotMatch(blogHtml, /grid-template-columns:\s*260px\s+minmax\(0,\s*1fr\)\s+280px/);
    assert.match(blogHtml, /class="reader-workspace"/);
    assert.match(blogHtml, /class="reader-article-wrap"/);
    assert.match(blogHtml, /<aside class="blog-side-panel"/);
    assert.match(blogHtml, /<article class="markdown-body" id="markdown-body"[\s\S]*<\/article>\s*<aside class="blog-side-panel"/);
    assert.match(blogHtml, /\.blog-tree-panel\s*\{[\s\S]*position:\s*fixed/);
    assert.match(blogHtml, /\.mobile-tree-button\s*\{[\s\S]*display:\s*inline-flex/);
    assert.equal((blogHtml.match(/id="random-list"/g) || []).length, 1);
    assert.equal((blogHtml.match(/id="tree-backdrop"/g) || []).length, 1);
    assert.equal((blogHtml.match(/const state = /g) || []).length, 1);
});
