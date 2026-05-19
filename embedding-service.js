const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');

let nodejieba = null;

if (process.env.SOPH_USE_NODEJIEBA === '1') {
    try {
        const candidate = require('nodejieba');
        const requiredDictionaries = [
            candidate.DEFAULT_DICT,
            candidate.DEFAULT_HMM_DICT,
            candidate.DEFAULT_USER_DICT,
            candidate.DEFAULT_IDF_DICT,
            candidate.DEFAULT_STOP_WORD_DICT
        ];
        nodejieba = requiredDictionaries.every((filename) => filename && fs.existsSync(filename)) ? candidate : null;
    } catch (error) {
        nodejieba = null;
    }
}

const STOP_WORDS = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'for',
    'from',
    'in',
    'is',
    'it',
    'of',
    'on',
    'or',
    'that',
    'the',
    'to',
    'with',
    'theorem',
    '一个',
    '一些',
    '以及',
    '但是',
    '不是',
    '这个',
    '那个',
    '为了',
    '因为',
    '所以',
    '如果',
    '我们',
    '你们',
    '他们',
    '它们',
    '在',
    '的',
    '了',
    '和',
    '与',
    '是',
    '有',
    '为'
]);

function stripMarkdown(markdown) {
    return String(markdown || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]*`/g, ' ')
        .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
        .replace(/\[[^\]]*]\([^)]+\)/g, ' ')
        .replace(/[#>*_\-[\]()`~]/g, ' ');
}

function fallbackSegmentChinese(text) {
    const segments = [];
    const matches = text.match(/[\p{Script=Han}]{2,}/gu) || [];
    for (const match of matches) {
        segments.push(match);
        for (let index = 0; index <= match.length - 2; index += 1) {
            segments.push(match.slice(index, index + 2));
        }
        for (let index = 0; index <= match.length - 3; index += 1) {
            segments.push(match.slice(index, index + 3));
        }
    }
    return segments;
}

function tokenize(text) {
    const clean = stripMarkdown(text).toLowerCase();
    const latinTokens = clean.match(/[a-z0-9][a-z0-9_-]{1,}/g) || [];
    const chineseTokens = nodejieba
        ? nodejieba.cut(clean).filter((token) => /[\p{Script=Han}]/u.test(token))
        : fallbackSegmentChinese(clean);

    return [...latinTokens, ...chineseTokens]
        .map((token) => token.trim())
        .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function cosineSimilarity(vecA, vecB) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const left = weightsOnly(vecA || {});
    const right = weightsOnly(vecB || {});

    for (const value of Object.values(left)) {
        normA += value * value;
    }
    for (const value of Object.values(right)) {
        normB += value * value;
    }
    if (normA === 0 || normB === 0) return 0;

    const [small, large] = Object.keys(left).length < Object.keys(right).length
        ? [left, right]
        : [right, left];
    for (const [term, weight] of Object.entries(small)) {
        if (large[term]) dot += weight * large[term];
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function computeTfidf(tokenLists) {
    const documentCount = tokenLists.length;
    const documentFrequency = new Map();

    for (const tokens of tokenLists) {
        for (const token of new Set(tokens)) {
            documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
        }
    }

    return tokenLists.map((tokens) => {
        const counts = new Map();
        for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
        const total = tokens.length || 1;
        const vector = {};

        for (const [term, count] of counts) {
            const tf = count / total;
            const idf = Math.log((1 + documentCount) / (1 + (documentFrequency.get(term) || 0))) + 1;
            vector[term] = { tf, idf, weight: tf * idf };
        }

        return vector;
    });
}

function weightsOnly(terms) {
    const vector = {};
    for (const [term, value] of Object.entries(terms || {})) {
        vector[term] = typeof value === 'number' ? value : value.weight;
    }
    return vector;
}

function contentHash(markdown) {
    return crypto.createHash('sha256').update(markdown).digest('hex');
}

function createEmbeddingService(options = {}) {
    const store = options.store;
    if (!store) throw new Error('EmbeddingService requires a store');
    const readFile = options.readFile || ((absolutePath) => fsp.readFile(absolutePath, 'utf8'));

    function indexMarkdown(post, markdown, metadata = {}) {
        const tokens = tokenize(markdown);
        const hash = contentHash(markdown);
        store.upsertIndexedDocument(post.path, {
            contentHash: hash,
            size: metadata.size ?? Buffer.byteLength(markdown),
            mtimeMs: metadata.mtimeMs ?? 0,
            tokens
        });
        return { path: post.path, contentHash: hash, tokens };
    }

    async function initialize(allPosts) {
        const posts = allPosts || [];
        const indexed = [];
        for (const post of posts) {
            indexed.push(indexMarkdown(post, post.markdown || post.text || '', post));
        }
        if (typeof store.pruneIndexedPaths === 'function') {
            store.pruneIndexedPaths(posts.map((post) => post.path));
        }
        return indexed;
    }

    async function refreshFromFiles(files) {
        const currentFiles = files || [];
        const indexed = [];

        for (const file of currentFiles) {
            const existing = typeof store.getIndexedDocument === 'function'
                ? store.getIndexedDocument(file.path)
                : null;
            if (existing && existing.size === file.size && existing.mtimeMs === file.mtimeMs) {
                continue;
            }

            const markdown = await readFile(file.absolutePath);
            indexed.push(indexMarkdown(file, markdown, file));
        }

        if (typeof store.pruneIndexedPaths === 'function') {
            store.pruneIndexedPaths(currentFiles.map((file) => file.path));
        }
        return indexed;
    }

    async function onFileChanged(changedPost, allPosts) {
        if (Array.isArray(allPosts)) {
            return initialize(allPosts);
        }
        if (!changedPost) return [];
        return initialize([changedPost]);
    }

    function onFileRemoved(removedPath) {
        if (typeof store.deleteIndexedDocument === 'function') {
            store.deleteIndexedDocument(removedPath);
        } else {
            store.deleteEmbedding(removedPath);
        }
    }

    return {
        initialize,
        refreshFromFiles,
        onFileChanged,
        onFileRemoved,
        tokenize,
        computeTfidf,
        cosineSimilarity
    };
}

module.exports = {
    STOP_WORDS,
    computeTfidf,
    cosineSimilarity,
    createEmbeddingService,
    tokenize
};
