const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { createApp } = require('../app');

async function withServer(app, callback) {
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    try {
        await callback(`http://127.0.0.1:${port}`, port);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

async function withRuntime(handler, callback) {
    const server = http.createServer(handler);
    await withServer(server, callback);
}

test('POST /poemist/api/generate proxies JSON to configured Poemist runtime', async (t) => {
    await withRuntime((request, response) => {
        assert.equal(request.url, '/api/generate');
        assert.equal(request.method, 'POST');
        let body = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
            body += chunk;
        });
        request.on('end', () => {
            assert.deepEqual(JSON.parse(body), {
                prompt: '春风',
                mode: 'single',
                history: []
            });
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ completion: '又起' }));
        });
    }, async (_runtimeBaseUrl, runtimePort) => {
        const app = await createApp({
            watch: false,
            store: { memory: true },
            poemistRuntime: { host: '127.0.0.1', port: runtimePort }
        });
        t.after(() => app.locals.close());

        await withServer(app, async (baseUrl) => {
            const response = await fetch(`${baseUrl}/poemist/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: '春风', mode: 'single', history: [] })
            });
            const body = await response.json();

            assert.equal(response.status, 200);
            assert.deepEqual(body, { completion: '又起' });
        });
    });
});

test('POST /poemist/api/generate returns 503 when runtime is unavailable', async (t) => {
    const app = await createApp({
        watch: false,
        store: { memory: true },
        poemistRuntime: { host: '127.0.0.1', port: 9, timeoutMs: 200 }
    });
    t.after(() => app.locals.close());

    await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/poemist/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: '春风' })
        });
        const body = await response.json();

        assert.equal(response.status, 503);
        assert.match(body.error, /Poemist runtime is unavailable/);
    });
});

test('poemist page and navigation use the Sophdotnet route and shared header', () => {
    const root = path.join(__dirname, '..');
    const poemistHtml = fs.readFileSync(path.join(root, 'poemist.html'), 'utf8');
    const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const headerHtml = fs.readFileSync(path.join(root, 'include', 'header.html'), 'utf8');
    const sharedHeaderJs = fs.readFileSync(path.join(root, 'js', 'shared-header.js'), 'utf8');

    assert.match(poemistHtml, /id="topbar-placeholder"/);
    assert.match(poemistHtml, /js\/shared-header\.js/);
    assert.match(poemistHtml, /fetch\('\/poemist\/api\/generate'/);
    assert.doesNotMatch(poemistHtml, /fetch\('\/api\/generate'/);
    assert.match(indexHtml, /href="poemist\.html"[^>]*>[^<]*诗雾[^<]*<\/a>/);
    assert.match(headerHtml, /href="poemist\.html">诗雾<\/a>/);
    assert.match(sharedHeaderJs, /href="poemist\.html">诗雾<\/a>/);
});
