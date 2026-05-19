const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createApp } = require('../app');

async function makeBlogFixture() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soph-api-blog-'));
    const blogRoot = path.join(root, 'openblog');
    await fs.mkdir(path.join(blogRoot, 'Series'), { recursive: true });
    await fs.writeFile(path.join(blogRoot, 'Series', 'Laplacian.md'), '# Laplacian\n\nlaplacian demon theorem theorem', 'utf8');
    await fs.writeFile(path.join(blogRoot, 'Series', 'Demon.md'), '# Demon\n\nlaplacian demon recurrence theorem', 'utf8');
    await fs.writeFile(path.join(blogRoot, 'Series', 'Soup.md'), '# Soup\n\ntomato soup kitchen recipe', 'utf8');
    return { root, blogRoot };
}

async function withServer(app, callback) {
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    try {
        await callback(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

test('GET /api/blog/related returns sorted related post metadata', async (t) => {
    const { root, blogRoot } = await makeBlogFixture();
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    const app = await createApp({ blogRoot, watch: false, store: { memory: true } });
    t.after(() => app.locals.blogService.close());

    await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/blog/related?path=${encodeURIComponent('Series/Laplacian.md')}&count=2`);
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.ok, true);
        assert.deepEqual(body.data.map((post) => post.path), ['Series/Demon.md']);
        assert.equal(body.data[0].title, 'Demon');
        assert.ok(body.data[0].similarity > 0);
    });
});

test('GET /api/blog/hot ranks pageview counts by timeframe', async (t) => {
    const { root, blogRoot } = await makeBlogFixture();
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    const app = await createApp({ blogRoot, watch: false, store: { memory: true } });
    t.after(() => app.locals.blogService.close());

    await withServer(app, async (baseUrl) => {
        await fetch(`${baseUrl}/api/pageview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-session-id': 'session-a' },
            body: JSON.stringify({ path: 'Series/Laplacian.md' })
        });
        await fetch(`${baseUrl}/api/pageview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-session-id': 'session-a' },
            body: JSON.stringify({ path: 'Series/Laplacian.md' })
        });
        await fetch(`${baseUrl}/api/pageview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-session-id': 'session-b' },
            body: JSON.stringify({ path: 'Series/Laplacian.md' })
        });
        await fetch(`${baseUrl}/api/pageview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-session-id': 'session-c' },
            body: JSON.stringify({ path: 'Series/Soup.md' })
        });

        const response = await fetch(`${baseUrl}/api/blog/hot?timeframe=all&count=2`);
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.ok, true);
        assert.deepEqual(body.data.map((post) => [post.path, post.views]), [
            ['Series/Laplacian.md', 2],
            ['Series/Soup.md', 1]
        ]);
    });
});

test('recommendation APIs reject unsafe paths and invalid timeframes', async (t) => {
    const { root, blogRoot } = await makeBlogFixture();
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    const app = await createApp({ blogRoot, watch: false, store: { memory: true } });
    t.after(() => app.locals.blogService.close());

    await withServer(app, async (baseUrl) => {
        const related = await fetch(`${baseUrl}/api/blog/related?path=${encodeURIComponent('../secret.md')}`);
        const hot = await fetch(`${baseUrl}/api/blog/hot?timeframe=century`);

        assert.equal(related.status, 400);
        assert.equal(hot.status, 400);
    });
});

test('embedding refresh from app skips unchanged markdown files', async (t) => {
    const { root, blogRoot } = await makeBlogFixture();
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    const reads = [];
    const app = await createApp({
        blogRoot,
        watch: false,
        store: { memory: true },
        embeddingServiceOptions: {
            readFile: async (absolutePath) => {
                reads.push(absolutePath);
                return fs.readFile(absolutePath, 'utf8');
            }
        }
    });
    t.after(() => app.locals.close());

    assert.equal(reads.length, 3);

    await app.locals.blogService.refresh();

    assert.equal(reads.length, 3);
});
