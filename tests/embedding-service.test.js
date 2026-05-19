const assert = require('node:assert/strict');
const test = require('node:test');

const { createEmbeddingService, cosineSimilarity, tokenize } = require('../embedding-service');
const { createStore } = require('../store');

test('tokenize keeps meaningful English and Chinese terms while removing stop words', () => {
    const tokens = tokenize('The Laplacian demon 在 千年 科学学院 walks through a theorem.');

    assert.ok(tokens.includes('laplacian'));
    assert.ok(tokens.includes('demon'));
    assert.ok(tokens.includes('科学学院'));
    assert.ok(!tokens.includes('the'));
    assert.ok(!tokens.includes('在'));
});

test('cosineSimilarity is symmetric and handles zero vectors', () => {
    const left = { laplacian: 0.8, demon: 0.6 };
    const right = { laplacian: 0.4, demon: 0.3 };

    assert.equal(cosineSimilarity(left, right), cosineSimilarity(right, left));
    assert.ok(cosineSimilarity(left, right) > 0.99);
    assert.equal(cosineSimilarity(left, {}), 0);
});

test('initialize indexes documents so related posts rank above unrelated posts', async (t) => {
    const store = createStore({ memory: true });
    t.after(() => store.close());
    const service = createEmbeddingService({ store });

    await service.initialize([
        { path: 'math/a.md', markdown: '# A\n\nlaplacian demon theorem theorem' },
        { path: 'math/b.md', markdown: '# B\n\nlaplacian demon recurrence theorem' },
        { path: 'food/c.md', markdown: '# C\n\ntomato soup kitchen recipe' }
    ]);

    const similar = store.findSimilar('math/a.md', 2);

    assert.deepEqual(similar.map((post) => post.path), ['math/b.md']);
    assert.ok(similar[0].similarity > 0);
});

test('refreshFromFiles only reads changed files and reuses cached tokens', async (t) => {
    const store = createStore({ memory: true });
    t.after(() => store.close());

    const files = new Map([
        ['a', '# A\n\nlaplacian demon theorem'],
        ['b', '# B\n\nlaplacian demon recurrence']
    ]);
    let reads = 0;
    const service = createEmbeddingService({
        store,
        readFile: async (absolutePath) => {
            reads += 1;
            return files.get(absolutePath);
        }
    });

    await service.refreshFromFiles([
        { path: 'math/a.md', absolutePath: 'a', size: files.get('a').length, mtimeMs: 1 },
        { path: 'math/b.md', absolutePath: 'b', size: files.get('b').length, mtimeMs: 1 }
    ]);

    assert.equal(reads, 2);
    assert.equal(store.findSimilar('math/a.md', 1)[0].path, 'math/b.md');

    await service.refreshFromFiles([
        { path: 'math/a.md', absolutePath: 'a', size: files.get('a').length, mtimeMs: 1 },
        { path: 'math/b.md', absolutePath: 'b', size: files.get('b').length, mtimeMs: 1 }
    ]);

    assert.equal(reads, 2);

    files.set('b', '# B\n\ntomato soup kitchen');
    await service.refreshFromFiles([
        { path: 'math/a.md', absolutePath: 'a', size: files.get('a').length, mtimeMs: 1 },
        { path: 'math/b.md', absolutePath: 'b', size: files.get('b').length, mtimeMs: 2 }
    ]);

    assert.equal(reads, 3);
    assert.deepEqual(store.findSimilar('math/a.md', 5), []);
});
