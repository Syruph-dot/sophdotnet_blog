const express = require('express');
const path = require('node:path');
const { createBlogService } = require('./blog-service');

const app = express();
const port = Number(process.env.PORT || 80);
const siteRoot = __dirname;
const blogRoot = path.join(siteRoot, 'openblog');

app.use(express.json());

async function createApp(options = {}) {
    const blogService = options.blogService || await createBlogService({
        blogRoot: options.blogRoot || blogRoot,
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
    createApp
};
