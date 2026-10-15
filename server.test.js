import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from './server.js';

let server;
let baseUrl;

before(async () => {
    server = createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
});

test('serves the existing HTML page at the root path', async () => {
    const response = await fetch(baseUrl);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(html, /<title>API Testing Tool<\/title>/);
});

test('returns 404 for paths other than the root', async () => {
    const response = await fetch(`${baseUrl}/missing`);

    assert.equal(response.status, 404);
});