const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { scanGalleryDirectory } = require('../app');

test('scans gallery images without relying on HTTP directory indexes', async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soph-gallery-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));

    await fs.mkdir(path.join(root, '啥子'), { recursive: true });
    await fs.writeFile(path.join(root, 'fubuki.jpg'), 'jpg');
    await fs.writeFile(path.join(root, 'notes.txt'), 'text');
    await fs.writeFile(path.join(root, '啥子', 'u=332327085,2477341914&fm=253&app=120&f=JPEG.jpeg'), 'jpeg');

    const tree = await scanGalleryDirectory(root);

    assert.deepEqual(tree.files.map((file) => file.name), ['fubuki.jpg']);
    assert.equal(tree.files[0].url, '/images/gallery/fubuki.jpg');
    assert.equal(tree.folders.length, 1);
    assert.equal(tree.folders[0].name, '啥子');
    assert.equal(tree.folders[0].files[0].name, 'u=332327085,2477341914&fm=253&app=120&f=JPEG.jpeg');
    assert.equal(
        tree.folders[0].files[0].url,
        '/images/gallery/%E5%95%A5%E5%AD%90/u%3D332327085%2C2477341914%26fm%3D253%26app%3D120%26f%3DJPEG.jpeg'
    );
});
