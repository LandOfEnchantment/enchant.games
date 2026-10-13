// make run: public/ at http://localhost:3000 (PORT), answered the way GitHub Pages answers
// (a file as it is, a folder by its index.html, a folder asked for without its slash sent
// to it with one, anything else 404.html with a 404), rebuilt as its sources change, and
// every open page reloaded once it is.
//
// A save in pages/, news/, css/, images/, js/, layout.html, redirects.yml, the favicons,
// robots.txt or scripts/build.js runs the build again (all of it: it takes half a second);
// requests wait for it, and then the socket each page keeps open to /__dev says "reload".
// A failed build sends its error instead, shown over the page until the next build works.
// That socket's script is added to the pages as this server answers them: it is never in
// public/, so never on the site.
//
//   node scripts/dev.js            PORT overrides 3000

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const SOCKET = '/__dev';

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.woff2': 'font/woff2',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
};

// What the build reads, besides node_modules.
const WATCHED_DIRS = ['pages', 'news', 'css', 'images', 'js'];
const WATCHED_FILES = ['layout.html', 'redirects.yml', 'favicon.ico', 'favicon.png', 'robots.txt', 'scripts/build.js'];
// Editors' lock files, backups and autosaves.
const scratch = file => /(^|\/)(\.#[^/]*|#[^/]*#|[^/]*~|\.?flycheck_[^/]*|[^/]*\.swp)$/.test(file);

// The build: one at a time; a change during one builds again after it.
let building = null;
let again = false;
let failed = '';

function runBuild() {
    return new Promise(resolve => {
        const child = spawn(process.execPath, ['scripts/build.js'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        child.stdout.on('data', d => { output += d; process.stdout.write(d); });
        child.stderr.on('data', d => { output += d; process.stderr.write(d); });
        child.on('close', code => resolve(code === 0 ? '' : `node scripts/build.js failed:\n${output.trim()}`));
    });
}

async function rebuild() {
    if (building) { again = true; return; }
    building = (async () => {
        do {
            again = false;
            failed = await runBuild();
        } while (again);
    })();
    await building;
    building = null;
    if (failed) {
        console.error(`dev: ${failed.split('\n')[0]}`);
        broadcast({ error: failed });
    } else {
        console.log(`dev: rebuilt, reloading ${clients.size} page(s)`);
        broadcast({ reload: true });
    }
}

let timer;
function changed(file) {
    if (scratch(file)) return;
    clearTimeout(timer);
    // A save is often several events (a backup, a rename, the write): build once, after them.
    timer = setTimeout(rebuild, 100);
}

// The open pages' sockets, and just enough of WebSocket (RFC 6455) to send them a message.
const clients = new Set();

function frame(text) {
    const data = Buffer.from(text);
    const n = data.length;
    let head;
    if (n < 126) head = Buffer.from([0x81, n]);
    else if (n < 65536) head = Buffer.from([0x81, 126, n >> 8, n & 255]);
    else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
    return Buffer.concat([head, data]);
}

function broadcast(message) {
    const f = frame(JSON.stringify(message));
    for (const socket of clients) socket.write(f);
}

// What each page gets: the socket, a reload when told (or when make run comes back after a
// restart), and a build's error over the page.
const CLIENT = `<script>/* make run (scripts/dev.js): not on the site */
(() => {
    let open = false;
    const connect = () => {
        const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '${SOCKET}');
        ws.onopen = () => { if (open === null) location.reload(); open = true; };
        ws.onmessage = e => {
            const m = JSON.parse(e.data);
            if (m.reload) location.reload();
            let box = document.getElementById('dev-error');
            if (m.error) {
                if (!box) {
                    box = document.createElement('pre');
                    box.id = 'dev-error';
                    box.style.cssText = 'position:fixed;inset:auto 1rem 1rem 1rem;z-index:2147483647;max-height:50vh;overflow:auto;margin:0;padding:1rem;background:#300;color:#fdd;font:12px/1.4 monospace;white-space:pre-wrap;border-radius:6px;box-shadow:0 4px 24px #0008';
                    box.onclick = () => box.remove();
                    document.body.append(box);
                }
                box.textContent = 'Build failed (make run; click to hide)\\n\\n' + m.error;
            }
        };
        ws.onclose = () => { if (open) open = null; setTimeout(connect, 1000); };
    };
    connect();
})();
</script>`;

/** The page with the client script before its </body> (or at its end). */
function inject(html) {
    const at = html.lastIndexOf('</body>');
    return at < 0 ? html + CLIENT : html.slice(0, at) + CLIENT + html.slice(at);
}

const isFile = path => stat(path).then(s => s.isFile(), () => false);
const isDir = path => stat(path).then(s => s.isDirectory(), () => false);

const server = createServer(async (req, res) => {
    if (building) await building;
    const url = new URL(req.url, 'http://localhost');
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { path = '/'; }
    let file = normalize(join(OUT, path));
    if (file !== OUT && !file.startsWith(OUT + '/')) file = '';
    let status = 200;
    if (file && await isDir(file)) {
        if (!path.endsWith('/')) {
            res.writeHead(301, { location: `${url.pathname}/${url.search}` });
            res.end();
            return;
        }
        file = join(file, 'index.html');
    }
    if (!file || !await isFile(file)) {
        status = 404;
        file = join(OUT, '404.html');
    }
    let body;
    try {
        body = await readFile(file);
    } catch {
        // No 404.html: the build failed before writing it. A page all the same, so it gets
        // the socket (the error, then the reload once a build works).
        body = Buffer.from(`<!doctype html><title>make run</title><body><p>Nothing here (yet): ${failed ? 'the build failed' : 'no such page'}.</p></body>`);
    }
    const type = status === 404 ? TYPES['.html'] : TYPES[extname(file)] ?? 'application/octet-stream';
    if (type.startsWith('text/html')) body = Buffer.from(inject(body.toString('utf8')));
    res.writeHead(status, { 'content-type': type, 'content-length': body.length, 'cache-control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : body);
    console.log(`${req.method} ${req.url} ${status}`);
});

server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (req.url !== SOCKET || !key) return socket.destroy();
    const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    clients.add(socket);
    if (failed) socket.write(frame(JSON.stringify({ error: failed })));
    // Pages send nothing but a close, which ends it.
    socket.on('data', d => { if ((d[0] & 0x0f) === 0x8) socket.end(); });
    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
});

// PORT first, so a make run already serving it is said before anything is built.
await new Promise(resolve => {
    server.once('error', err => {
        console.error(err.code === 'EADDRINUSE'
            ? `dev: port ${PORT} is taken (another make run? stop it, or PORT=3001 make run)`
            : `dev: can't listen on port ${PORT}: ${err.message}`);
        process.exit(1);
    });
    server.listen(PORT, resolve);
});

// Built once before any request is answered (they wait); a failed build is served all the
// same, and the next save may fix it.
await rebuild();

for (const dir of WATCHED_DIRS) watch(join(ROOT, dir), { recursive: true }, (_, file) => file && changed(`${dir}/${file}`));
// The folders, not the files: an editor that saves by renaming would leave a file's watch behind.
for (const dir of new Set(WATCHED_FILES.map(f => f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : ''))) {
    watch(join(ROOT, dir), (_, file) => {
        const path = dir ? `${dir}/${file}` : String(file);
        if (file && WATCHED_FILES.includes(path)) changed(path);
    });
}

console.log(`\ndev: http://localhost:${PORT}/ (rebuilds on save, reloads open pages; Ctrl-C stops)\n`);
