// Builds public/, exactly what the site serves: the static files as they are, the YAML
// pages and journal articles, js/render.js bundled with lit-html, marked and js-yaml (from
// npm), and the manifests the site and crawlers read (pages.json, news.json, sitemap.xml,
// rss.xml). None of it is committed: CI builds it on every merge and deploys it.
import { build } from 'esbuild';
import { load, JSON_SCHEMA } from 'js-yaml';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://enchant.games';
const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'public');
const at = (...p) => join(ROOT, ...p);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

for (const f of ['index.html', 'favicon.ico', 'favicon.png', 'css', 'fonts', 'images']) {
    cpSync(at(f), join(OUT, f), { recursive: true });
}

// Only the top level of pages/ and news/: what sits in their disabled/ folders isn't served.
// Parsed with the schema the browser's loader uses (dates stay strings).
function collection(dir) {
    mkdirSync(join(OUT, dir));
    return readdirSync(at(dir)).filter(f => f.endsWith('.yml')).sort().map(file => {
        const text = readFileSync(at(dir, file), 'utf8');
        writeFileSync(join(OUT, dir, file), text);
        const y = load(text, { schema: JSON_SCHEMA });
        const field = k => String(y?.[k] ?? '');
        return { file, title: field('title'), slug: field('slug'), date: field('date'),
                 author: field('author'), body: field('body') };
    });
}
const pages = collection('pages');
const news = collection('news');

const json = (name, value) => writeFileSync(join(OUT, name), JSON.stringify(value) + '\n');
json('pages.json', pages.map(p => p.file));
json('news.json', news.map(({ title, slug, date, author, file }) => ({ title, slug, date, author, file })));

const xml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const articleUrl = slug => `${BASE}/?slug=journal&article=${encodeURIComponent(slug)}`;

writeFileSync(join(OUT, 'sitemap.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.filter(p => !['404', '500'].includes(p.slug))
        .map(p => `  <url><loc>${xml(`${BASE}/?slug=${encodeURIComponent(p.slug)}`)}</loc></url>`),
    ...news.map(n => `  <url><loc>${xml(articleUrl(n.slug))}</loc></url>`),
    '</urlset>', '',
].join('\n'));

// Newest first (the file names start with the date); each item's description is the start
// of its text, markup dropped.
const rfc822 = d => new Date(`${d}T00:00:00Z`).toUTCString().replace('GMT', '+0000');
const newest = [...news].reverse();
const excerpt = body => body.replace(/<[^>]*>/g, '').replace(/#/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
writeFileSync(join(OUT, 'rss.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>Land of Enchantment Games - Journal</title>',
    `    <link>${BASE}/?slug=journal</link>`,
    '    <description>Updates from Land of Enchantment Games</description>',
    newest.length ? `    <lastBuildDate>${rfc822(newest[0].date)}</lastBuildDate>` : null,
    ...newest.map(n => [
        '    <item>',
        `      <title>${xml(n.title)}</title>`,
        `      <link>${xml(articleUrl(n.slug))}</link>`,
        `      <guid>${xml(articleUrl(n.slug))}</guid>`,
        `      <pubDate>${rfc822(n.date)}</pubDate>`,
        `      <description>${xml(excerpt(n.body))}</description>`,
        '    </item>',
    ].join('\n')),
    '  </channel>',
    '</rss>', '',
].filter(l => l !== null).join('\n'));

await build({
    entryPoints: [at('js/render.js')],
    outfile: join(OUT, 'js/render.js'),
    bundle: true,
    format: 'esm',
    minify: true,
    sourcemap: true,
    target: 'es2022',
    logLevel: 'warning',
});

console.log(`built public/: ${pages.length} pages, ${news.length} articles`);
