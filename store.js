const path = require('node:path');
const fs = require('node:fs');

const Database = require('better-sqlite3');

const VALID_TIMEFRAMES = new Set(['today', 'week', 'all']);

function normalizeLimit(limit, fallback = 5) {
    const numeric = Number(limit);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(Math.trunc(numeric), 50));
}

function normalizeDate(value = new Date()) {
    if (value instanceof Date) return value.toISOString();
    return new Date(value).toISOString();
}

function createStore(options = {}) {
    const filename = options.memory
        ? ':memory:'
        : path.resolve(options.filename || path.join(process.cwd(), 'data', 'blog.db'));
    if (filename !== ':memory:') {
        fs.mkdirSync(path.dirname(filename), { recursive: true });
    }
    const db = new Database(filename);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS pageviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL,
            session_id TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_pageviews_path_session
            ON pageviews(path, session_id)
            WHERE session_id IS NOT NULL AND session_id <> '';
        CREATE INDEX IF NOT EXISTS idx_pageviews_path ON pageviews(path);
        CREATE INDEX IF NOT EXISTS idx_pageviews_created ON pageviews(created_at);

        CREATE TABLE IF NOT EXISTS embeddings (
            path TEXT PRIMARY KEY,
            vector BLOB NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tfidf_terms (
            term TEXT NOT NULL,
            path TEXT NOT NULL,
            tf REAL NOT NULL,
            idf REAL NOT NULL,
            PRIMARY KEY (term, path)
        );
        CREATE INDEX IF NOT EXISTS idx_tfidf_terms_path ON tfidf_terms(path);

        CREATE TABLE IF NOT EXISTS indexed_documents (
            path TEXT PRIMARY KEY,
            content_hash TEXT NOT NULL,
            size INTEGER NOT NULL,
            mtime_ms REAL NOT NULL,
            token_count INTEGER NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS postings (
            term TEXT NOT NULL,
            path TEXT NOT NULL,
            term_count INTEGER NOT NULL,
            tf REAL NOT NULL,
            PRIMARY KEY (term, path)
        );
        CREATE INDEX IF NOT EXISTS idx_postings_path ON postings(path);
        CREATE INDEX IF NOT EXISTS idx_postings_term ON postings(term);

        CREATE TABLE IF NOT EXISTS term_stats (
            term TEXT PRIMARY KEY,
            df INTEGER NOT NULL
        );
    `);

    const insertPageview = db.prepare(`
        INSERT OR IGNORE INTO pageviews (path, session_id, created_at)
        VALUES (@path, @sessionId, @createdAt)
    `);
    const insertAnonymousPageview = db.prepare(`
        INSERT INTO pageviews (path, session_id, created_at)
        VALUES (@path, NULL, @createdAt)
    `);
    const deleteOldPageviews = db.prepare('DELETE FROM pageviews WHERE created_at < ?');
    const deleteTermsForPath = db.prepare('DELETE FROM tfidf_terms WHERE path = ?');
    const insertTerm = db.prepare(`
        INSERT INTO tfidf_terms (term, path, tf, idf)
        VALUES (@term, @path, @tf, @idf)
    `);
    const deleteEmbeddingStatement = db.prepare('DELETE FROM embeddings WHERE path = ?');
    const getTfidfPathsStatement = db.prepare('SELECT DISTINCT path FROM tfidf_terms ORDER BY path ASC');
    const getDocumentStatement = db.prepare(`
        SELECT path, content_hash AS contentHash, size, mtime_ms AS mtimeMs, token_count AS tokenCount
        FROM indexed_documents
        WHERE path = ?
    `);
    const getDocumentPathsStatement = db.prepare('SELECT path FROM indexed_documents ORDER BY path ASC');
    const getDocumentCountStatement = db.prepare('SELECT COUNT(*) AS count FROM indexed_documents');
    const getPostingsForPathStatement = db.prepare('SELECT term, path, term_count AS termCount, tf FROM postings WHERE path = ? ORDER BY term ASC');
    const getTermStatsStatement = db.prepare('SELECT term, df FROM term_stats WHERE term = ?');
    const insertDocumentStatement = db.prepare(`
        INSERT INTO indexed_documents (path, content_hash, size, mtime_ms, token_count, updated_at)
        VALUES (@path, @contentHash, @size, @mtimeMs, @tokenCount, @updatedAt)
        ON CONFLICT(path) DO UPDATE SET
            content_hash = excluded.content_hash,
            size = excluded.size,
            mtime_ms = excluded.mtime_ms,
            token_count = excluded.token_count,
            updated_at = excluded.updated_at
    `);
    const deleteDocumentStatement = db.prepare('DELETE FROM indexed_documents WHERE path = ?');
    const deletePostingsForPathStatement = db.prepare('DELETE FROM postings WHERE path = ?');
    const insertPostingStatement = db.prepare(`
        INSERT INTO postings (term, path, term_count, tf)
        VALUES (@term, @path, @termCount, @tf)
    `);
    const incrementDfStatement = db.prepare(`
        INSERT INTO term_stats (term, df)
        VALUES (?, 1)
        ON CONFLICT(term) DO UPDATE SET df = df + 1
    `);
    const decrementDfStatement = db.prepare('UPDATE term_stats SET df = df - 1 WHERE term = ?');
    const deleteZeroDfStatement = db.prepare('DELETE FROM term_stats WHERE df <= 0');
    const deletePathStatement = db.transaction((postPath) => {
        deleteTermsForPath.run(postPath);
        deleteEmbeddingStatement.run(postPath);
    });
    const removeIndexedDocumentTransaction = db.transaction((postPath) => {
        const existingDocument = getDocumentStatement.get(postPath);
        const existingTerms = getPostingsForPathStatement.all(postPath).map((row) => row.term);
        deletePostingsForPathStatement.run(postPath);
        deleteDocumentStatement.run(postPath);
        for (const term of existingTerms) {
            decrementDfStatement.run(term);
        }
        deleteZeroDfStatement.run();
        deletePathStatement(postPath);
        return existingTerms.length > 0 || Boolean(existingDocument);
    });
    const upsertIndexedDocumentTransaction = db.transaction((postPath, fingerprint) => {
        const existingTerms = getPostingsForPathStatement.all(postPath).map((row) => row.term);
        deletePostingsForPathStatement.run(postPath);
        for (const term of existingTerms) {
            decrementDfStatement.run(term);
        }
        deleteZeroDfStatement.run();

        const counts = new Map();
        for (const token of fingerprint.tokens || []) {
            if (!token) continue;
            counts.set(token, (counts.get(token) || 0) + 1);
        }
        const tokenCount = [...counts.values()].reduce((sum, count) => sum + count, 0);
        insertDocumentStatement.run({
            path: postPath,
            contentHash: fingerprint.contentHash,
            size: fingerprint.size,
            mtimeMs: fingerprint.mtimeMs,
            tokenCount,
            updatedAt: new Date().toISOString()
        });
        for (const [term, termCount] of counts) {
            insertPostingStatement.run({
                term,
                path: postPath,
                termCount,
                tf: tokenCount > 0 ? termCount / tokenCount : 0
            });
            incrementDfStatement.run(term);
        }
        return tokenCount;
    });
    const upsertTermsTransaction = db.transaction((postPath, terms) => {
        deleteTermsForPath.run(postPath);
        for (const [term, value] of Object.entries(terms || {})) {
            const weight = typeof value === 'number' ? value : value.weight;
            const tf = typeof value === 'number' ? value : value.tf ?? value.weight ?? 0;
            const idf = typeof value === 'number' ? 1 : value.idf ?? 1;
            if (!term || !Number.isFinite(weight) || weight <= 0) continue;
            insertTerm.run({ term, path: postPath, tf, idf });
        }
    });
    const upsertEmbeddingStatement = db.prepare(`
        INSERT INTO embeddings (path, vector, updated_at)
        VALUES (@path, @vector, @updatedAt)
        ON CONFLICT(path) DO UPDATE SET
            vector = excluded.vector,
            updated_at = excluded.updated_at
    `);

    function getTopPosts(limit = 5, timeframe = 'all', now = new Date()) {
        if (!VALID_TIMEFRAMES.has(timeframe)) {
            throw Object.assign(new Error('Invalid timeframe'), { statusCode: 400 });
        }

        const cappedLimit = normalizeLimit(limit);
        const parameters = { limit: cappedLimit };
        let where = '';

        if (timeframe !== 'all') {
            const current = new Date(now);
            const start = new Date(current);
            if (timeframe === 'today') {
                start.setUTCHours(0, 0, 0, 0);
            } else {
                start.setUTCDate(start.getUTCDate() - 7);
            }
            where = 'WHERE created_at >= @start';
            parameters.start = start.toISOString();
        }

        return db.prepare(`
            SELECT path, COUNT(*) AS views
            FROM pageviews
            ${where}
            GROUP BY path
            ORDER BY views DESC, path ASC
            LIMIT @limit
        `).all(parameters);
    }

    function incrementPageview(postPath, sessionId = null, createdAt = new Date()) {
        if (!postPath || typeof postPath !== 'string') {
            throw Object.assign(new Error('Invalid pageview path'), { statusCode: 400 });
        }

        const timestamp = normalizeDate(createdAt);
        if (sessionId) {
            const result = insertPageview.run({ path: postPath, sessionId: String(sessionId), createdAt: timestamp });
            return { inserted: result.changes > 0 };
        }

        const result = insertAnonymousPageview.run({ path: postPath, createdAt: timestamp });
        return { inserted: result.changes > 0 };
    }

    function clearPageviewsBefore(date) {
        return deleteOldPageviews.run(normalizeDate(date)).changes;
    }

    function upsertEmbedding(postPath, vector) {
        const bytes = Buffer.from(new Float32Array(vector).buffer);
        upsertEmbeddingStatement.run({
            path: postPath,
            vector: bytes,
            updatedAt: new Date().toISOString()
        });
    }

    function deleteEmbedding(postPath) {
        deletePathStatement(postPath);
    }

    function upsertTfidfTerms(postPath, terms) {
        upsertTermsTransaction(postPath, terms);
    }

    function getTfidfVector(postPath) {
        const postingRows = getPostingsForPathStatement.all(postPath);
        if (postingRows.length) {
            const documentCount = getDocumentCountStatement.get().count;
            const vector = {};
            for (const row of postingRows) {
                const stat = getTermStatsStatement.get(row.term);
                const idf = stat ? computeIdf(documentCount, stat.df) : 0;
                vector[row.term] = row.tf * idf;
            }
            return vector;
        }

        const rows = db.prepare('SELECT term, tf, idf FROM tfidf_terms WHERE path = ? ORDER BY term ASC').all(postPath);
        const vector = {};
        for (const row of rows) {
            vector[row.term] = row.tf * row.idf;
        }
        return vector;
    }

    function pruneTfidfPaths(currentPaths) {
        const keep = new Set(currentPaths || []);
        let removed = 0;
        for (const row of getTfidfPathsStatement.all()) {
            if (!keep.has(row.path)) {
                deletePathStatement(row.path);
                removed += 1;
            }
        }
        return removed;
    }

    function getIndexedDocument(postPath) {
        return getDocumentStatement.get(postPath) || null;
    }

    function getTermStats(term) {
        return getTermStatsStatement.get(term) || null;
    }

    function upsertIndexedDocument(postPath, fingerprint) {
        if (!fingerprint || typeof fingerprint.contentHash !== 'string') {
            throw Object.assign(new Error('Invalid indexed document fingerprint'), { statusCode: 400 });
        }
        return upsertIndexedDocumentTransaction(postPath, fingerprint);
    }

    function deleteIndexedDocument(postPath) {
        return removeIndexedDocumentTransaction(postPath);
    }

    function pruneIndexedPaths(currentPaths) {
        const keep = new Set(currentPaths || []);
        const removed = [];
        for (const row of getDocumentPathsStatement.all()) {
            if (!keep.has(row.path)) {
                removed.push({ path: row.path });
                removeIndexedDocumentTransaction(row.path);
            }
        }
        return removed;
    }

    function computeIdf(documentCount, documentFrequency) {
        return Math.log((documentCount + 1) / (documentFrequency + 1)) + 1;
    }

    function cosineSimilarity(left, right) {
        let dot = 0;
        let leftNorm = 0;
        let rightNorm = 0;

        for (const value of Object.values(left)) {
            leftNorm += value * value;
        }
        for (const value of Object.values(right)) {
            rightNorm += value * value;
        }
        if (leftNorm === 0 || rightNorm === 0) return 0;

        const [small, large] = Object.keys(left).length < Object.keys(right).length ? [left, right] : [right, left];
        for (const [term, value] of Object.entries(small)) {
            if (large[term]) dot += value * large[term];
        }

        return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
    }

    function findSimilar(postPath, limit = 5) {
        if (getDocumentStatement.get(postPath)) {
            return findSimilarByPostings(postPath, limit);
        }
        const target = getTfidfVector(postPath);
        return findSimilarToVector(target, limit, postPath);
    }

    function findSimilarToVector(vector, limit = 5, excludePath = null) {
        const cappedLimit = normalizeLimit(limit);
        if (!vector || !Object.keys(vector).length || cappedLimit === 0) return [];

        const rows = db.prepare('SELECT term, path, tf, idf FROM tfidf_terms ORDER BY path ASC').all();
        const vectors = new Map();
        for (const row of rows) {
            if (excludePath && row.path === excludePath) continue;
            if (!vectors.has(row.path)) vectors.set(row.path, {});
            vectors.get(row.path)[row.term] = row.tf * row.idf;
        }

        return [...vectors.entries()]
            .map(([candidatePath, candidateVector]) => ({
                path: candidatePath,
                similarity: cosineSimilarity(vector, candidateVector)
            }))
            .filter((candidate) => candidate.similarity > 0)
            .sort((left, right) => right.similarity - left.similarity || left.path.localeCompare(right.path, 'zh-Hans-CN'))
            .slice(0, cappedLimit);
    }

    function findSimilarByPostings(postPath, limit = 5) {
        const cappedLimit = normalizeLimit(limit);
        if (cappedLimit === 0) return [];

        const targetDocument = getDocumentStatement.get(postPath);
        if (!targetDocument || targetDocument.tokenCount === 0) return [];

        const targetPostings = getPostingsForPathStatement.all(postPath);
        if (!targetPostings.length) return [];

        const documentCount = getDocumentCountStatement.get().count;
        const candidates = new Map();
        let targetNorm = 0;

        for (const target of targetPostings) {
            const stat = getTermStatsStatement.get(target.term);
            if (!stat) continue;
            const idf = computeIdf(documentCount, stat.df);
            const targetWeight = target.tf * idf;
            targetNorm += targetWeight * targetWeight;

            const rows = db.prepare('SELECT path, tf FROM postings WHERE term = ? AND path <> ?').all(target.term, postPath);
            for (const row of rows) {
                if (!candidates.has(row.path)) {
                    candidates.set(row.path, { path: row.path, dot: 0, norm: null });
                }
                candidates.get(row.path).dot += targetWeight * row.tf * idf;
            }
        }

        if (targetNorm === 0) return [];

        const results = [];
        for (const candidate of candidates.values()) {
            const candidateVector = getTfidfVector(candidate.path);
            let candidateNorm = 0;
            for (const value of Object.values(candidateVector)) {
                candidateNorm += value * value;
            }
            if (candidateNorm === 0) continue;
            const similarity = candidate.dot / (Math.sqrt(targetNorm) * Math.sqrt(candidateNorm));
            if (similarity > 0) {
                results.push({ path: candidate.path, similarity });
            }
        }

        return results
            .sort((left, right) => right.similarity - left.similarity || left.path.localeCompare(right.path, 'zh-Hans-CN'))
            .slice(0, cappedLimit);
    }

    return {
        db,
        incrementPageview,
        getTopPosts,
        clearPageviewsBefore,
        upsertEmbedding,
        deleteEmbedding,
        findSimilar,
        findSimilarToVector,
        upsertTfidfTerms,
        getTfidfVector,
        pruneTfidfPaths,
        upsertIndexedDocument,
        deleteIndexedDocument,
        pruneIndexedPaths,
        getIndexedDocument,
        getTermStats,
        close() {
            db.close();
        }
    };
}

module.exports = {
    VALID_TIMEFRAMES,
    createStore,
    normalizeLimit
};
