const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { marked } = require('marked');
const hljs = require('highlight.js');

const DEFAULT_RANDOM_COUNT = 5;

function toPosixPath(filePath) {
    return filePath.split(path.sep).join('/');
}

function withoutMarkdownExtension(name) {
    return name.replace(/\.md$/i, '');
}

function isHiddenName(name) {
    return name.startsWith('.');
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function hashString(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function seededRandom(seed) {
    let state = seed >>> 0;
    return function nextRandom() {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createMarkdownRenderer(basePath = '') {
    const renderer = new marked.Renderer();

    renderer.code = function renderCode(token) {
        const language = typeof token.lang === 'string' ? token.lang.trim().split(/\s+/)[0] : '';

        // Mermaid 图：原文输出，客户端 mermaid.js 渲染为 SVG
        if (language === 'mermaid') {
            return `<pre class="mermaid">${escapeHtml(token.text)}</pre>\n`;
        }

        const highlighted = language && hljs.getLanguage(language)
            ? hljs.highlight(token.text, { language }).value
            : hljs.highlightAuto(token.text).value;
        const languageClass = language ? ` language-${escapeHtml(language)}` : '';
        return `<pre><code class="hljs${languageClass}">${highlighted}</code></pre>\n`;
    };

    renderer.image = function renderImage(token) {
        const src = normalizeMarkdownUrl(token.href, basePath);
        const alt = token.text || '';
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${title}>`;
    };

    renderer.link = function renderLink(token) {
        const href = normalizeMarkdownUrl(token.href, basePath);
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
        const text = this.parser.parseInline(token.tokens);
        return `<a href="${escapeHtml(href)}"${title}>${text}</a>`;
    };

    return {
        async: false,
        breaks: false,
        gfm: true,
        renderer
    };
}

marked.setOptions(createMarkdownRenderer());

function normalizeMarkdownUrl(href, basePath) {
    if (!href || /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) {
        return href || '';
    }

    const normalizedBase = basePath ? basePath.replace(/\\/g, '/') : '';
    const joined = path.posix.normalize(path.posix.join('/openblog', normalizedBase, href));
    if (!joined.startsWith('/openblog/')) return '#';
    return encodeURI(joined);
}

class BlogService {
    constructor(options = {}) {
        this.blogRoot = path.resolve(options.blogRoot || path.join(process.cwd(), 'openblog'));
        this.watch = options.watch !== false;
        this.tree = { name: 'openblog', type: 'directory', children: [] };
        this.posts = [];
        this.watcher = null;
        this.refreshTimer = null;
        this.isRefreshing = false;
        this.afterRefresh = typeof options.afterRefresh === 'function' ? options.afterRefresh : null;
        this.readFile = options.readFile || ((...args) => fsp.readFile(...args));
        this.titleCache = new Map();
    }

    async init() {
        await this.refresh();
        if (this.watch) {
            this.startWatcher();
        }
        return this;
    }

    async refresh() {
        if (this.isRefreshing) return;
        this.isRefreshing = true;
        try {
            await fsp.mkdir(this.blogRoot, { recursive: true });
            const tree = await this.scanDirectory(this.blogRoot, '');
            this.tree = {
                name: 'openblog',
                type: 'directory',
                children: tree.children
            };
            this.posts = await this.collectPosts(this.tree);
            if (this.afterRefresh) {
                await this.afterRefresh(this.getAllPosts());
            }
        } finally {
            this.isRefreshing = false;
        }
    }

    async scanDirectory(absoluteDirectory, relativeDirectory) {
        const entries = await fsp.readdir(absoluteDirectory, { withFileTypes: true });
        const directories = [];
        const files = [];

        for (const entry of entries) {
            if (isHiddenName(entry.name)) continue;

            const absoluteEntry = path.join(absoluteDirectory, entry.name);
            const relativeEntry = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                const child = await this.scanDirectory(absoluteEntry, relativeEntry);
                directories.push({
                    name: entry.name,
                    type: 'directory',
                    children: child.children
                });
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
                files.push({
                    name: entry.name,
                    type: 'file',
                    path: relativeEntry
                });
            }
        }

        directories.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
        files.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));

        return {
            type: 'directory',
            children: [...directories, ...files]
        };
    }

    async collectPosts(node, posts = []) {
        if (!node || !Array.isArray(node.children)) return posts;

        for (const child of node.children) {
            if (child.type === 'file') {
                posts.push({
                    title: await this.readTitleFromFile(child.path, child.name),
                    name: child.name,
                    path: child.path
                });
            } else {
                await this.collectPosts(child, posts);
            }
        }
        return posts;
    }

    async readTitleFromFile(relativePath, fileName) {
        try {
            const { absolutePath } = this.resolvePostPath(relativePath);
            const stat = await fsp.stat(absolutePath);
            const cached = this.titleCache.get(relativePath);
            if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
                return cached.title;
            }
            const markdown = await this.readFile(absolutePath, 'utf8');
            const title = this.extractTitle(markdown, fileName);
            this.titleCache.set(relativePath, {
                size: stat.size,
                mtimeMs: stat.mtimeMs,
                title
            });
            return title;
        } catch (error) {
            return withoutMarkdownExtension(fileName);
        }
    }

    getTree() {
        return cloneJson(this.tree);
    }

    getAllPosts() {
        return cloneJson(this.posts);
    }

    getPostMetadata(relativePath) {
        const normalized = this.resolvePostPath(relativePath).normalizedPath;
        return cloneJson(this.posts.find((post) => post.path === normalized) || null);
    }

    async getPostsWithMarkdown() {
        const posts = [];
        for (const post of this.posts) {
            try {
                const { absolutePath, normalizedPath } = this.resolvePostPath(post.path);
                const markdown = await fsp.readFile(absolutePath, 'utf8');
                posts.push({
                    ...post,
                    path: normalizedPath,
                    markdown
                });
            } catch (error) {
                if (error.statusCode !== 400 && error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }
        return posts;
    }

    async getPostFileRecords() {
        const records = [];
        for (const post of this.posts) {
            try {
                const { absolutePath, normalizedPath } = this.resolvePostPath(post.path);
                const stat = await fsp.stat(absolutePath);
                records.push({
                    ...post,
                    path: normalizedPath,
                    absolutePath,
                    size: stat.size,
                    mtimeMs: stat.mtimeMs
                });
            } catch (error) {
                if (error.statusCode !== 400 && error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }
        return records;
    }

    setAfterRefresh(callback) {
        this.afterRefresh = typeof callback === 'function' ? callback : null;
    }

    getRandomPosts(count = DEFAULT_RANDOM_COUNT, seed = 'default') {
        const limit = Number.isFinite(Number(count)) ? Math.max(0, Math.min(Number(count), 50)) : DEFAULT_RANDOM_COUNT;
        const random = seededRandom(hashString(String(seed || 'default')));
        const shuffled = [...this.posts];

        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(random() * (index + 1));
            [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
        }

        return cloneJson(shuffled.slice(0, limit));
    }

    resolvePostPath(relativePath) {
        if (!relativePath || typeof relativePath !== 'string') {
            throw Object.assign(new Error('Invalid blog path'), { statusCode: 400 });
        }

        const normalized = relativePath.replace(/\\/g, '/');
        if (!normalized.toLowerCase().endsWith('.md')) {
            throw Object.assign(new Error('Markdown files only'), { statusCode: 400 });
        }

        const absolutePath = path.resolve(this.blogRoot, normalized);
        const relativeFromRoot = path.relative(this.blogRoot, absolutePath);
        if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot) || relativeFromRoot === '') {
            throw Object.assign(new Error('Invalid blog path'), { statusCode: 400 });
        }

        const segments = toPosixPath(relativeFromRoot).split('/');
        if (segments.some(isHiddenName)) {
            throw Object.assign(new Error('Invalid blog path'), { statusCode: 400 });
        }

        return {
            absolutePath,
            normalizedPath: toPosixPath(relativeFromRoot)
        };
    }

    async readPost(relativePath) {
        const { absolutePath, normalizedPath } = this.resolvePostPath(relativePath);
        let markdown;

        try {
            markdown = await fsp.readFile(absolutePath, 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw Object.assign(new Error('Blog post not found'), { statusCode: 404 });
            }
            throw error;
        }

        const fileName = path.posix.basename(normalizedPath);
        const title = this.extractTitle(markdown, fileName);
        const basePath = path.posix.dirname(normalizedPath);
        const html = marked.parse(markdown, createMarkdownRenderer(basePath === '.' ? '' : basePath));

        return {
            title,
            path: normalizedPath,
            breadcrumbs: ['openblog', ...normalizedPath.split('/')],
            html
        };
    }

    extractTitle(markdown, fileName) {
        const lines = markdown.split(/\r?\n/);
        for (const line of lines) {
            const match = line.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/);
            if (match) return match[1].trim();
        }
        return withoutMarkdownExtension(fileName);
    }

    startWatcher() {
        if (this.watcher || !fs.existsSync(this.blogRoot)) return;

        try {
            this.watcher = fs.watch(this.blogRoot, { recursive: true }, () => {
                this.scheduleRefresh();
            });
        } catch (error) {
            console.warn('[blog] file watching unavailable:', error.message);
        }
    }

    scheduleRefresh() {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => {
            this.refresh().catch((error) => {
                console.error('[blog] failed to refresh tree:', error);
            });
        }, 150);
    }

    close() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
}

async function createBlogService(options) {
    const service = new BlogService(options);
    return service.init();
}

module.exports = {
    BlogService,
    createBlogService
};
