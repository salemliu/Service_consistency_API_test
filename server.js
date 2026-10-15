import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pagePath = join(dirname(fileURLToPath(import.meta.url)), 'index_en.html');

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let data = '';
        request.on('data', (chunk) => { data += chunk; });
        request.on('end', () => resolve(data));
        request.on('error', reject);
    });
}

async function handleProxy(request, response) {
    let payload;
    try {
        payload = JSON.parse((await readRequestBody(request)) || '{}');
    } catch {
        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'Invalid request body' }));
        return;
    }

    const { url, grant_type, client_id, client_secret } = payload;

    if (!url) {
        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'Auth API URL is required' }));
        return;
    }

    const body = new URLSearchParams({ grant_type, client_id, client_secret }).toString();
    const start = Date.now();

    try {
        const upstream = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });

        const raw = await upstream.text();

        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({
            status: upstream.status,
            statusText: upstream.statusText,
            body: raw,
            elapsed: Date.now() - start,
        }));
    } catch (err) {
        response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({
            error: err.message,
            elapsed: Date.now() - start,
        }));
    }
}

async function handleApiCall(request, response) {
    let payload;
    try {
        payload = JSON.parse((await readRequestBody(request)) || '{}');
    } catch {
        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'Invalid request body' }));
        return;
    }

    console.log(payload);

    const { url, method = 'POST', headers = {}, body = {}, access_token } = payload;

    if (!url) {
        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'API URL is required' }));
        return;
    }

    const methodUpper = String(method).toUpperCase();
    const searchParams = new URLSearchParams(body);
    if (access_token) {
        searchParams.append('access_token', access_token);
    }

    let targetUrl = url;
    if (methodUpper === 'GET') {
        const query = searchParams.toString();
        if (query) {
            targetUrl += (url.includes('?') ? '&' : '?') + query;
        }
    }

    const fetchHeaders = { ...headers };

    let fetchBody;
    if (methodUpper === 'POST') {
        fetchBody = searchParams.toString();
        if (!Object.keys(fetchHeaders).some((key) => key.toLowerCase() === 'content-type')) {
            fetchHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        }
    }

    const start = Date.now();

    try {
        const upstream = await fetch(targetUrl, {
            method: methodUpper,
            headers: fetchHeaders,
            body: fetchBody,
        });

        const raw = await upstream.text();

        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({
            status: upstream.status,
            statusText: upstream.statusText,
            body: raw,
            elapsed: Date.now() - start,
        }));
    } catch (err) {
        response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({
            error: err.message,
            elapsed: Date.now() - start,
        }));
    }
}

export function createServer() {
    return createHttpServer(async (request, response) => {
        const pathname = new URL(request.url, 'http://127.0.0.1').pathname;

        if (request.method === 'POST' && pathname === '/proxy') {
            await handleProxy(request, response);
            return;
        }

        if (request.method === 'POST' && pathname === '/api') {
            await handleApiCall(request, response);
            return;
        }

        if (request.method !== 'GET' || pathname !== '/') {
            response.writeHead(404);
            response.end('Not Found');
            return;
        }

        try {
            const html = await readFile(pagePath);
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(html);
        } catch {
            response.writeHead(500);
            response.end('Internal Server Error');
        }
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const port = Number(process.argv[2] ?? 8765);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error('Port must be a number between 1 and 65535.');
        process.exitCode = 1;
    } else {
        createServer().listen(port, '127.0.0.1', () => {
            console.log(`Server running at http://127.0.0.1:${port}`);
            console.log(`Press Ctrl+C to close this window and stop the server.`);
        });
    }
}
