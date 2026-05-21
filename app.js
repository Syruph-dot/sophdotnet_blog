const express = require('express');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { createBlogService } = require('./blog-service');
const { createEmbeddingService } = require('./embedding-service');
const { VALID_TIMEFRAMES, createStore, normalizeLimit } = require('./store');

const port = Number(process.env.PORT || 8787);
const defaultSiteRoot = __dirname;
const imageExtensions = new Set(['.avif', '.bmp', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

function requestPoemistRuntime(payload, options = {}) {
    const body = JSON.stringify(payload || {});
    const runtime = {
        host: options.host || process.env.POEMIST_RUNTIME_HOST || '127.0.0.1',
        port: Number(options.port || process.env.POEMIST_RUNTIME_PORT || 5000),
        path: options.path || process.env.POEMIST_RUNTIME_PATH || '/api/generate',
        timeoutMs: Number(options.timeoutMs || process.env.POEMIST_RUNTIME_TIMEOUT_MS || 30000)
    };

    return new Promise((resolve, reject) => {
        const proxyRequest = http.request({
            hostname: runtime.host,
            port: runtime.port,
            path: runtime.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: runtime.timeoutMs
        }, (proxyResponse) => {
            let responseBody = '';
            proxyResponse.setEncoding('utf8');
            proxyResponse.on('data', (chunk) => {
                responseBody += chunk;
            });
            proxyResponse.on('end', () => {
                resolve({
                    statusCode: proxyResponse.statusCode || 502,
                    headers: proxyResponse.headers,
                    body: responseBody
                });
            });
        });

        proxyRequest.on('timeout', () => {
            proxyRequest.destroy(new Error('Poemist runtime timed out'));
        });
        proxyRequest.on('error', reject);
        proxyRequest.end(body);
    });
}

function isHiddenName(name) {
    return name.startsWith('.');
}

function toGalleryUrl(relativeSegments) {
    const encodedPath = relativeSegments.map((segment) => encodeURIComponent(segment)).join('/');
    return `/images/gallery/${encodedPath}`;
}

async function scanGalleryDirectory(directory, relativeSegments = []) {
    let entries;

    try {
        entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { files: [], folders: [] };
        }
        throw error;
    }

    const files = [];
    const folders = [];

    for (const entry of entries) {
        if (isHiddenName(entry.name)) continue;

        const absolutePath = path.join(directory, entry.name);
        const entrySegments = [...relativeSegments, entry.name];

        if (entry.isDirectory()) {
            const childTree = await scanGalleryDirectory(absolutePath, entrySegments);
            folders.push({
                name: entry.name,
                path: entrySegments.join('/'),
                files: childTree.files,
                folders: childTree.folders,
                count: childTree.files.length,
                coverUrl: childTree.files[0]?.url || null
            });
        } else if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) {
            files.push({
                name: entry.name,
                path: entrySegments.join('/'),
                url: toGalleryUrl(entrySegments)
            });
        }
    }

    folders.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
    files.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));

    return { files, folders };
}

async function scanArtifacts(siteRoot = defaultSiteRoot) {
    const artifactsDir = path.join(siteRoot, 'artifacts');
    let entries;
    try {
        entries = await fs.readdir(artifactsDir, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }

    const artifacts = [];
    for (const entry of entries) {
        if (isHiddenName(entry.name) || !entry.isDirectory()) continue;

        const artifactPath = path.join(artifactsDir, entry.name);
        let description = '';

        try {
            const readmeContent = await fs.readFile(path.join(artifactPath, 'README.md'), 'utf-8');
            const lines = readmeContent.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('![') && !trimmed.startsWith('[')) {
                    description = trimmed.substring(0, 200);
                    break;
                }
            }
        } catch { /* README may not exist */ }

        artifacts.push({
            name: entry.name,
            description,
            path: `artifacts/${entry.name}/`
        });
    }

    artifacts.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    return artifacts;
}

async function createApp(options = {}) {
    const app = express();
    const siteRoot = path.resolve(options.siteRoot || defaultSiteRoot);
    const blogRoot = options.blogRoot || path.join(siteRoot, 'openblog');
    const galleryRoot = path.resolve(options.galleryRoot || path.join(siteRoot, 'images', 'gallery'));
    const store = options.store && typeof options.store.incrementPageview === 'function'
        ? options.store
        : createStore(options.store || { filename: path.join(siteRoot, 'data', 'blog.db') });
    const ownsStore = !(options.store && typeof options.store.incrementPageview === 'function');
    const embeddingService = options.embeddingService || createEmbeddingService({
        ...(options.embeddingServiceOptions || {}),
        store
    });

    app.use(express.json());

    const blogService = options.blogService || await createBlogService({
        blogRoot,
        watch: options.watch
    });

    app.locals.blogService = blogService;
    app.locals.store = store;
    app.locals.embeddingService = embeddingService;
    app.locals.close = () => {
        blogService.close();
        if (ownsStore) store.close();
    };

    async function refreshEmbeddingIndex() {
        await embeddingService.refreshFromFiles(await blogService.getPostFileRecords());
    }

    blogService.setAfterRefresh(() => refreshEmbeddingIndex());
    await refreshEmbeddingIndex();

    function postMetadata(postPath) {
        return blogService.getPostMetadata(postPath) || {
            title: path.posix.basename(postPath, '.md'),
            path: postPath
        };
    }

    function decoratePosts(rows) {
        return rows
            .map((row) => ({
                ...postMetadata(row.path),
                ...row
            }))
            .filter((post) => post.path);
    }

    app.get('/api/blog/tree', (request, response) => {
        response.json(blogService.getTree());
    });

    app.get('/api/blog/read', async (request, response, next) => {
        try {
            const post = await blogService.readPost(request.query.path);
            response.json(post);
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/blog/random', (request, response) => {
        const count = request.query.count || 5;
        const seed = request.query.seed || request.get('x-session-id') || 'default';
        response.json(blogService.getRandomPosts(count, seed));
    });

    app.get('/api/blog/related', (request, response, next) => {
        try {
            const postPath = request.query.path;
            const count = normalizeLimit(request.query.count || 5);
            blogService.resolvePostPath(postPath);
            response.json({
                ok: true,
                data: decoratePosts(store.findSimilar(postPath, count))
            });
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/blog/hot', (request, response, next) => {
        try {
            const timeframe = request.query.timeframe || 'all';
            if (!VALID_TIMEFRAMES.has(timeframe)) {
                throw Object.assign(new Error('Invalid timeframe'), { statusCode: 400 });
            }
            response.json({
                ok: true,
                data: decoratePosts(store.getTopPosts(request.query.count || 5, timeframe))
            });
        } catch (error) {
            next(error);
        }
    });

    app.post('/api/pageview', (request, response) => {
        const pagePath = request.body?.path || request.get('referer') || null;
        const sessionId = request.body?.sessionId || request.get('x-session-id') || null;
        const result = store.incrementPageview(pagePath, sessionId);
        response.json({
            ok: true,
            path: pagePath,
            inserted: result.inserted,
            recordedAt: new Date().toISOString()
        });
    });

    app.get('/api/gallery/tree', async (request, response, next) => {
        try {
            response.json(await scanGalleryDirectory(galleryRoot));
        } catch (error) {
            next(error);
        }
    });

    app.get('/api/artifacts', async (request, response, next) => {
        try {
            response.json(await scanArtifacts(siteRoot));
        } catch (error) {
            next(error);
        }
    });

    app.post('/poemist/api/generate', async (request, response) => {
        try {
            const runtimeResponse = await requestPoemistRuntime(request.body, options.poemistRuntime || {});
            response.status(runtimeResponse.statusCode);
            response.type(runtimeResponse.headers['content-type'] || 'application/json');
            response.send(runtimeResponse.body);
        } catch (error) {
            response.status(503).json({
                error: 'Poemist runtime is unavailable. Please retry later.'
            });
        }
    });

    app.get('/artifacts', (request, response) => {
        response.sendFile(path.join(siteRoot, 'artifacts.html'));
    });

    app.use(express.static(siteRoot, {
        extensions: ['html']
    }));

    app.use((error, request, response, next) => {
        if (response.headersSent) {
            next(error);
            return;
        }

        const statusCode = error.statusCode || 500;
        response.status(statusCode).json({
            error: error.message || 'Internal server error'
        });
    });

    return app;
}

if (require.main === module) {
    createApp({ watch: true })
        .then((serverApp) => {
            serverApp.listen(port, () => {
                console.log(`Soph Dot Net listening on http://localhost:${port}`);
            });
        })
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    createApp,
    requestPoemistRuntime,
    scanArtifacts,
    scanGalleryDirectory
};
