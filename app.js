const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createBlogService } = require('./blog-service');
const { createEmbeddingService } = require('./embedding-service');
const { VALID_TIMEFRAMES, createStore, normalizeLimit } = require('./store');

const port = Number(process.env.PORT || 8787);
const defaultSiteRoot = __dirname;
const imageExtensions = new Set(['.avif', '.bmp', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

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
    scanGalleryDirectory
};
