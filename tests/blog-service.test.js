const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createBlogService } = require('../blog-service');

async function makeFixture() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soph-blog-'));
    const blogRoot = path.join(root, 'openblog');

    await fs.mkdir(path.join(blogRoot, 'Series', 'Nested'), { recursive: true });
    await fs.mkdir(path.join(blogRoot, '.git'), { recursive: true });
    await fs.mkdir(path.join(blogRoot, '.hidden'), { recursive: true });

    await fs.writeFile(path.join(blogRoot, 'Series', 'Intro.md'), '# Intro Title\n\nHello **world**.\n\n```js\nconsole.log("hi");\n```', 'utf8');
    await fs.writeFile(path.join(blogRoot, 'Series', 'Nested', 'No Heading.md'), 'Body without heading.', 'utf8');
    await fs.writeFile(path.join(blogRoot, 'Series', 'photo.tif'), 'not markdown', 'utf8');
    await fs.writeFile(path.join(blogRoot, '.git', 'ignored.md'), '# Ignored', 'utf8');
    await fs.writeFile(path.join(blogRoot, '.hidden', 'hidden.md'), '# Hidden', 'utf8');
    await fs.writeFile(path.join(blogRoot, '.gitignore'), '*', 'utf8');

    return { root, blogRoot };
}

test('builds a cached tree containing only visible directories and markdown files', async (t) => {
    const { root, blogRoot } = await makeFixture();
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    const service = await createBlogService({ blogRoot, watch: false });
    t.after(() => service.close());

    const tree = service.getTree();

    assert.equal(tree.name, 'openblog');
    assert.equal(tree.type, 'directory');
    assert.deepEqual(tree.children.map((node) => node.name), ['Series']);

    const series = tree.children[0];
    assert.deepEqual(series.children.map((node) => node.name), ['Nested', 'Intro.md']);
    assert.equal(series.children[1].path, 'Series/Intro.md');
});

test('renders markdown with title, breadcrumbs, and highlighted code', async (t) => {
    const { root, blogRoot } = await makeFixture();
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    const service = await createBlogService({ blogRoot, watch: false });
    t.after(() => service.close());

    const post = await service.readPost('Series/Intro.md');

    assert.equal(post.title, 'Intro Title');
    assert.deepEqual(post.breadcrumbs, ['openblog', 'Series', 'Intro.md']);
    assert.match(post.html, /<h1[^>]*>Intro Title<\/h1>/);
    assert.match(post.html, /<strong>world<\/strong>/);
    assert.match(post.html, /hljs/);
});

test('falls back to filename title and rejects unsafe or non-markdown paths', async (t) => {
    const { root, blogRoot } = await makeFixture();
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    const service = await createBlogService({ blogRoot, watch: false });
    t.after(() => service.close());

    const post = await service.readPost('Series/Nested/No Heading.md');
    assert.equal(post.title, 'No Heading');

    await assert.rejects(() => service.readPost('../secret.md'), /Invalid blog path/);
    await assert.rejects(() => service.readPost('Series/photo.tif'), /Markdown files only/);
});

test('returns stable seeded random article metadata', async (t) => {
    const { root, blogRoot } = await makeFixture();
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    await fs.writeFile(path.join(blogRoot, 'Series', 'Second.md'), '# Second\n\nTwo', 'utf8');
    await fs.writeFile(path.join(blogRoot, 'Series', 'Third.md'), '# Third\n\nThree', 'utf8');

    const service = await createBlogService({ blogRoot, watch: false });
    t.after(() => service.close());

    const first = service.getRandomPosts(2, 'session-a');
    const second = service.getRandomPosts(2, 'session-a');

    assert.deepEqual(first, second);
    assert.equal(first.length, 2);
    assert.ok(first.every((post) => post.title && post.path.endsWith('.md')));
    assert.ok(first.some((post) => post.title === 'Intro Title' || post.title === 'Second' || post.title === 'Third'));
});
