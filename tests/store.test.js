const assert = require('node:assert/strict');
const test = require('node:test');

const { createStore } = require('../store');

test('pageviews are deduplicated per path and session and ranked by timeframe', (t) => {
    const store = createStore({ memory: true });
    t.after(() => store.close());

    store.incrementPageview('Series/Intro.md', 'session-a', '2026-05-19T01:00:00.000Z');
    store.incrementPageview('Series/Intro.md', 'session-a', '2026-05-19T01:05:00.000Z');
    store.incrementPageview('Series/Intro.md', 'session-b', '2026-05-19T02:00:00.000Z');
    store.incrementPageview('Series/Older.md', 'session-c', '2026-05-10T02:00:00.000Z');
    store.incrementPageview('Series/Week.md', 'session-d', '2026-05-17T02:00:00.000Z');

    assert.deepEqual(store.getTopPosts(5, 'today', '2026-05-19T12:00:00.000Z'), [
        { path: 'Series/Intro.md', views: 2 }
    ]);
    assert.deepEqual(store.getTopPosts(5, 'week', '2026-05-19T12:00:00.000Z'), [
        { path: 'Series/Intro.md', views: 2 },
        { path: 'Series/Week.md', views: 1 }
    ]);
    assert.deepEqual(store.getTopPosts(2, 'all', '2026-05-19T12:00:00.000Z'), [
        { path: 'Series/Intro.md', views: 2 },
        { path: 'Series/Older.md', views: 1 }
    ]);
});

test('inverted index updates document postings and term document frequencies incrementally', (t) => {
    const store = createStore({ memory: true });
    t.after(() => store.close());

    store.upsertIndexedDocument('math/a.md', {
        contentHash: 'hash-a',
        size: 10,
        mtimeMs: 1,
        tokens: ['laplacian', 'demon', 'demon']
    });
    store.upsertIndexedDocument('math/b.md', {
        contentHash: 'hash-b',
        size: 10,
        mtimeMs: 1,
        tokens: ['laplacian', 'demon', 'recurrence']
    });
    store.upsertIndexedDocument('cooking/c.md', {
        contentHash: 'hash-c',
        size: 10,
        mtimeMs: 1,
        tokens: ['tomato', 'soup']
    });

    const similar = store.findSimilar('math/a.md', 2);

    assert.equal(similar.length, 1);
    assert.equal(similar[0].path, 'math/b.md');
    assert.ok(similar[0].similarity > 0);
    assert.equal(store.getTermStats('laplacian').df, 2);

    store.upsertIndexedDocument('math/b.md', {
        contentHash: 'hash-b2',
        size: 12,
        mtimeMs: 2,
        tokens: ['tomato', 'soup']
    });

    assert.equal(store.getTermStats('laplacian').df, 1);
    assert.equal(store.getTermStats('tomato').df, 2);
    assert.deepEqual(store.findSimilar('math/a.md', 5), []);
});

test('document fingerprints are persisted and stale indexed documents are pruned', (t) => {
    const store = createStore({ memory: true });
    t.after(() => store.close());

    store.upsertIndexedDocument('math/a.md', {
        contentHash: 'hash-a',
        size: 42,
        mtimeMs: 123,
        tokens: ['laplacian', 'demon']
    });
    store.upsertIndexedDocument('stale/deleted.md', {
        contentHash: 'hash-deleted',
        size: 12,
        mtimeMs: 99,
        tokens: ['deleted']
    });

    assert.deepEqual(store.getIndexedDocument('math/a.md'), {
        path: 'math/a.md',
        contentHash: 'hash-a',
        size: 42,
        mtimeMs: 123,
        tokenCount: 2
    });

    const removed = store.pruneIndexedPaths(['math/a.md']);

    assert.deepEqual(removed.map((entry) => entry.path), ['stale/deleted.md']);
    assert.equal(store.getIndexedDocument('stale/deleted.md'), null);
    assert.equal(store.getTermStats('deleted'), null);
});
