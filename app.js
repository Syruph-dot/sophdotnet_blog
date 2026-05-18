const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createBlogService } = require('./blog-service');

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

    app.use(express.json());

    const blogService = options.blogService || await createBlogService({
        blogRoot,
        watch: options.watch
    });

    app.locals.blogService = blogService;

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

    app.post('/api/pageview', (request, response) => {
        response.json({
            ok: true,
            path: request.body?.path || request.get('referer') || null,
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
