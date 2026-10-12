// Checks public/ (make build's output) before it can deploy: every manifest names files
// that are there, every page and article has its title and a unique slug, every link and
// picture on the site that points at the site itself (a file, a ?slug= page or a journal
// article) leads somewhere, every cache key is its file's own, and the feed and sitemap
// escape what XML needs escaped.
import { load, JSON_SCHEMA } from 'js-yaml';
import { marked } from 'marked';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'public');
const SRC = join(import.meta.dirname, '..');
const problems = [];
const fail = msg => problems.push(msg);
const read = (...p) => readFileSync(join(OUT, ...p), 'utf8');

function entries(dir, manifest) {
    const seen = new Map();
    return manifest.map(file => {
        if (!existsSync(join(OUT, dir, file))) { fail(`${dir}.json names ${dir}/${file}, which isn't built`); return null; }
        const y = load(read(dir, file), { schema: JSON_SCHEMA }) ?? {};
        for (const k of ['title', 'slug', 'body']) if (!y[k]) fail(`${dir}/${file} has no ${k}`);
        if (seen.has(y.slug)) fail(`${dir}/${file} and ${dir}/${seen.get(y.slug)} share the slug ${y.slug}`);
        seen.set(y.slug, file);
        return { where: `${dir}/${file}`, slug: String(y.slug), html: marked.parse(String(y.body ?? '')) };
    }).filter(Boolean);
}
const pages = entries('pages', JSON.parse(read('pages.json')));
const news = entries('news', JSON.parse(read('news.json')).map(n => n.file));
const pageSlugs = new Set(pages.map(p => p.slug));
const newsSlugs = new Set(news.map(n => n.slug));
for (const s of ['home', '404']) if (!pageSlugs.has(s)) fail(`no page has the slug ${s}`);

// A reference to the site itself: a path from the root, or a ?query (render.js's links).
function checkRef(where, ref) {
    if (/^([a-z]+:|\/\/|#)/i.test(ref) || ref.includes('${')) return;
    const url = new URL(ref, 'https://enchant.games/');
    const path = decodeURIComponent(url.pathname);
    if (path !== '/') {
        const file = join(OUT, path);
        if (!existsSync(file) || (statSync(file).isDirectory() && !existsSync(join(file, 'index.html'))))
            fail(`${where}: ${ref}: ${path} isn't in public/`);
        return;
    }
    const slug = url.searchParams.get('slug');
    const article = url.searchParams.get('article');
    if (slug && slug !== 'journal' && slug !== 'news' && !pageSlugs.has(slug)) fail(`${where}: ${ref}: no page has the slug ${slug}`);
    if (article && !newsSlugs.has(article.replace(/\.yml$/, ''))) fail(`${where}: ${ref}: no article has the slug ${article}`);
}
const refs = text => [...text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)/g)]
    .map(m => m[1] ?? m[2]);
for (const { where, html } of [...pages, ...news]) for (const r of refs(html)) checkRef(where, r);
for (const f of ['index.html', 'css/style.css']) for (const r of refs(read(f))) checkRef(f, r);
for (const f of ['js/render.js', 'js/contact.js']) {
    for (const r of refs(readFileSync(join(SRC, f), 'utf8'))) checkRef(f, r);
}

// Every cache key the build stamped is the file's own (scripts/build.js): one that isn't
// would keep serving old bytes, or new bytes under an old address, until the cache expired.
const key = p => String(parseInt(createHash('sha256').update(readFileSync(join(OUT, p))).digest('hex').slice(0, 8), 16));
const stamped = [
    ...[...read('index.html').matchAll(/(?:src|href)="(\/[^"?]+)\?v=(\d+)"/g)].map(m => ['index.html', m[1], m[2]]),
    ...[...read('css/style.css').matchAll(/url\(['"]?(\/[^'")?]+)\?v=(\d+)/g)].map(m => ['css/style.css', m[1], m[2]]),
    ...[...read('js/render.js').matchAll(/"(\/[^"?]+)":"(\d+)"/g)].map(m => ['js/render.js', m[1], m[2]]),
];
for (const [where, p, k] of stamped) {
    if (!existsSync(join(OUT, p))) fail(`${where}: keys ${p}, which isn't in public/`);
    else if (key(p) !== k) fail(`${where}: ${p}?v=${k}, but the file's key is ${key(p)}`);
}
for (const p of ['/js/render.js', '/css/style.css']) {
    if (!stamped.some(([where, q]) => where === 'index.html' && q === p)) fail(`index.html loads ${p} without a cache key`);
}
for (const p of ['/pages.json', '/news.json']) {
    if (!stamped.some(([where, q]) => where === 'js/render.js' && q === p)) fail(`js/render.js has no cache key for ${p}`);
}
const version = JSON.parse(read('version.json'));
for (const [, p, k] of stamped.filter(([where]) => where === 'index.html')) {
    const name = p.split('/').pop();
    if (version.assets?.[name] !== k) fail(`version.json says ${name} is ${version.assets?.[name]}, index.html loads ${k}`);
}

for (const f of ['rss.xml', 'sitemap.xml']) {
    const bad = read(f).match(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/);
    if (bad) fail(`${f}: an unescaped & near ${JSON.stringify(read(f).slice(bad.index - 30, bad.index + 30))}`);
}

if (problems.length) {
    for (const p of problems) console.error(`check-dist: ${p}`);
    process.exit(1);
}
console.log(`check-dist: ok (${pages.length} pages, ${news.length} articles, ${stamped.length} cache keys, every link on the site leads somewhere)`);
