// Checks public/ (make build's output) before it can deploy: every page and article is
// drawn at its address with its title, every link and picture on the site that points at
// the site itself leads to a file that is there (and none still uses an old ?slug=
// address), every cache key is its file's own and every page loads the script and styles
// keyed, version.json names the keys the pages load, and the feed and sitemap escape what
// XML needs escaped and name only pages that are there.
import { load, JSON_SCHEMA } from 'js-yaml';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'public');
const BASE = 'https://enchant.games';
const problems = [];
const fail = msg => problems.push(msg);
const read = (...p) => readFileSync(join(OUT, ...p), 'utf8');

// What the sources say should be served (the top level of pages/ and news/ only).
const sources = dir => readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.yml')).sort()
    .map(file => ({ file, ...(load(readFileSync(join(ROOT, dir, file), 'utf8'), { schema: JSON_SCHEMA }) ?? {}) }));
const expected = [
    ...sources('pages').map(p => ({ src: `pages/${p.file}`, title: String(p.title),
        file: p.slug === 'home' ? 'index.html' : p.slug === 404 || p.slug === '404' ? '404.html' : `${p.slug}/index.html` })),
    { src: 'the journal', title: 'Journal', file: 'journal/index.html' },
    { src: 'the sitemap page', title: 'Sitemap', file: 'sitemap/index.html' },
    ...sources('news').map(n => ({ src: `news/${n.file}`, title: String(n.title), file: `journal/${n.slug}/index.html` })),
];
const unescape = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
for (const { src, title, file } of expected) {
    if (!existsSync(join(OUT, file))) { fail(`${src} isn't drawn at /${file}`); continue; }
    const html = read(file);
    const m = html.match(/<title>([^<]*) - Land of Enchantment Games<\/title>/);
    if (!m || unescape(m[1]) !== title) fail(`/${file}: its <title> isn't ${JSON.stringify(title)}`);
    const left = html.match(/\{\{\w+\}\}/);
    if (left) fail(`/${file}: layout.html's ${left[0]} was never filled`);
}

const walk = dir => readdirSync(join(OUT, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const all = walk('');
const html = all.filter(f => f.endsWith('.html'));
for (const f of html) if (!expected.some(e => e.file === f)) fail(`/${f} is built, but no page or article is drawn there`);

// A reference to the site itself: a path from the root, which must be a file in public/ (or
// a folder with its index.html). The old ?slug= addresses only redirect now; nothing on the
// site may still point at one.
function checkRef(where, ref) {
    if (/^([a-z]+:|\/\/|#)/i.test(ref) || ref.includes('${')) return;
    const url = new URL(ref, `${BASE}/`);
    if (url.searchParams.has('slug')) { fail(`${where}: ${ref}: an old ?slug= address; link the page's own (/<slug>/, /journal/<slug>/)`); return; }
    const path = decodeURIComponent(url.pathname);
    const file = join(OUT, path);
    if (!existsSync(file) || (statSync(file).isDirectory() && !existsSync(join(file, 'index.html'))))
        fail(`${where}: ${ref}: ${path} isn't in public/`);
    else if (statSync(file).isDirectory() && !path.endsWith('/'))
        fail(`${where}: ${ref}: ${path} is a folder; end it with / (GitHub Pages would redirect)`);
}
const refs = text => [...text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)/g)]
    .map(m => m[1] ?? m[2]);
for (const f of [...html, 'css/style.css']) for (const r of refs(read(f))) checkRef(`/${f}`, r);
for (const f of readdirSync(join(ROOT, 'js'))) for (const r of refs(readFileSync(join(ROOT, 'js', f), 'utf8'))) checkRef(`js/${f}`, r);

// Every cache key the build stamped is the file's own (scripts/build.js): one that isn't
// would keep serving old bytes, or new bytes under an old address, until the cache expired.
const key = p => String(parseInt(createHash('sha256').update(readFileSync(join(OUT, p))).digest('hex').slice(0, 8), 16));
const stamped = [...html, 'css/style.css'].flatMap(f =>
    [...read(f).matchAll(/(?:(?:src|href)="|url\(['"]?)(\/[^"'?)]+)\?v=(\d+)/g)].map(m => [f, m[1], m[2]]));
for (const [where, p, k] of stamped) {
    if (!existsSync(join(OUT, p))) fail(`/${where}: keys ${p}, which isn't in public/`);
    else if (key(p) !== k) fail(`/${where}: ${p}?v=${k}, but the file's key is ${key(p)}`);
}
const version = JSON.parse(read('version.json'));
for (const f of html) {
    for (const p of ['/js/site.js', '/css/style.css', '/favicon.png']) {
        const k = stamped.find(([where, q]) => where === f && q === p)?.[2];
        if (!k) fail(`/${f} loads ${p} without a cache key`);
        else if (version.assets?.[p.split('/').pop()] !== k) fail(`version.json says ${p} is ${version.assets?.[p.split('/').pop()]}, /${f} loads ${k}`);
    }
    // An unkeyed local file in a page would sit in caches under one address across deploys.
    for (const m of read(f).matchAll(/\b(?:src|href)="(\/[^"?#]+\.(?:js|css|woff2|png|webp|jpg))"/g)) fail(`/${f}: ${m[1]} has no cache key`);
}

if (!/^Sitemap: https:\/\/enchant\.games\/sitemap\.xml$/m.test(read('robots.txt'))) fail('robots.txt names no Sitemap: https://enchant.games/sitemap.xml');
for (const f of ['rss.xml', 'sitemap.xml']) {
    const text = read(f);
    const bad = text.match(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/);
    if (bad) fail(`${f}: an unescaped & near ${JSON.stringify(text.slice(bad.index - 30, bad.index + 30))}`);
}
for (const [f, re] of [['sitemap.xml', /<loc>([^<]+)<\/loc>/g], ['rss.xml', /<link>([^<]+)<\/link>/g]]) {
    for (const [, url] of read(f).matchAll(re)) {
        if (!url.startsWith(`${BASE}/`)) { fail(`${f}: ${url} isn't on ${BASE}`); continue; }
        const path = unescape(url).slice(BASE.length);
        if (path.includes('?') || !existsSync(join(OUT, path.endsWith('/') ? `${path}index.html` : path))) fail(`${f}: ${url} isn't a page in public/`);
    }
}

if (problems.length) {
    for (const p of problems) console.error(`check-dist: ${p}`);
    process.exit(1);
}
console.log(`check-dist: ok (${html.length} pages drawn, ${stamped.length} cache keys, ${all.length} files, every link on the site leads somewhere)`);
