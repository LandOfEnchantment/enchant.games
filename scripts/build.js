// Builds public/, exactly what the site serves: every page and journal article drawn into
// its own HTML file at its own address (layout.html around the YAML's markdown), the
// static files as they are, the fonts from npm, js/site.js bundled, and the feed and
// sitemap. None of it is committed: CI builds it on every merge and deploys it. A visitor
// gets the whole page in the first answer; nothing is fetched to draw it.
//
//   /                        pages/home.yml
//   /<slug>/                 every other page in pages/ (404.yml is /404.html, which
//                            GitHub Pages serves for any address it has nothing at)
//   /journal/                the journal, newest first
//   /journal/<slug>/         each article in news/
//   /sitemap/                every page and article, for people (sitemap.xml is for
//                            crawlers, named in robots.txt)
//
// The old addresses (/?slug=games, /?slug=journal&article=<slug>) land on the home page,
// whose head sends them on (and Cloudflare 301s them first: terraform/rulesets.tf).
// An address whose page or article was retired forwards to where redirects.yml says.
//
// Every file a page asks for carries a cache key, ?v=<number from its own content> (as in
// ../merecatholicity.com's stamp_versions.py): a changed file gets a new address, so no
// browser or Cloudflare cache can hand back the old bytes, and an unchanged one keeps its
// key, so a rebuild changes nothing. Nobody bumps a key by hand. Stamped in dependency
// order: the fonts into style.css, then everything into the pages. version.json names the
// keys of what the pages load (js/version.js asks it whether an open tab is behind). The
// pages themselves, version.json, the feed and the sitemap go unkeyed: their addresses are
// the ones people and crawlers ask for.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { load, JSON_SCHEMA } from 'js-yaml';
import { marked } from 'marked';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BASE = 'https://enchant.games';
const SITE_NAME = 'Land of Enchantment Games';
const DESCRIPTION = 'An indie gamedev studio proudly based in New Mexico, the Land of Enchantment, USA.';
const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'public');
const at = (...p) => join(ROOT, ...p);
const FONT = join(ROOT, 'node_modules', 'firacode', 'distr', 'woff2', 'FiraCode-VF.woff2');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of ['favicon.ico', 'favicon.png', 'robots.txt', 'css', 'images']) {
    cpSync(at(f), join(OUT, f), { recursive: true });
}
// Fira Code from npm (firacode): the variable font, every weight and glyph in one woff2.
mkdirSync(join(OUT, 'fonts'));
cpSync(FONT, join(OUT, 'fonts', 'FiraCode-VF.woff2'));

const fail = msg => { throw new Error(`build: ${msg}`); };
const write = (path, text) => {
    mkdirSync(dirname(join(OUT, path)), { recursive: true });
    writeFileSync(join(OUT, path), text);
};

// Only the top level of pages/ and news/: what sits in their disabled/ folders isn't served.
// Parsed with js-yaml's JSON schema, so dates stay strings.
marked.setOptions({ gfm: true, breaks: false });
function collection(dir) {
    const seen = new Map();
    return readdirSync(at(dir)).filter(f => f.endsWith('.yml')).sort().map(file => {
        const y = load(readFileSync(at(dir, file), 'utf8'), { schema: JSON_SCHEMA }) ?? {};
        const field = k => String(y[k] ?? '');
        for (const k of ['title', 'slug', 'body']) if (!field(k)) fail(`${dir}/${file} has no ${k}`);
        const slug = field('slug');
        if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail(`${dir}/${file}: the slug ${slug} isn't lowercase letters, digits and dashes`);
        if (seen.has(slug)) fail(`${dir}/${file} and ${dir}/${seen.get(slug)} share the slug ${slug}`);
        seen.set(slug, file);
        return { file, slug, title: field('title'), date: field('date'), author: field('author'),
                 body: field('body'), html: marked.parse(field('body')) };
    });
}
const pages = collection('pages');
const news = collection('news');
const page = Object.fromEntries(pages.map(p => [p.slug, p]));
for (const s of ['home', '404']) if (!page[s]) fail(`no page has the slug ${s}`);
for (const s of ['journal', 'sitemap', 'fonts', 'css', 'js', 'images']) if (page[s]) fail(`pages/${page[s].file}: the slug ${s} is the build's own`);

export const pageAddress = slug => (slug === 'home' ? '/' : `/${slug}/`);
export const articleAddress = slug => `/journal/${slug}/`;
const fileFor = address => (address.endsWith('/') ? `${address}index.html` : address).slice(1);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const plain = html => html.replace(/<[^>]*>/g, '').replace(/#/g, '').replace(/\s+/g, ' ').trim();
const excerpt = (html, n) => {
    const text = plain(html);
    return text.length <= n ? text : text.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
};

// The menu, in the header and in the phone's tab bar (24x24 icons drawn with currentColor).
const MENU = ['home', 'games', 'values', 'journal', 'press'];
const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    games: '<rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r="0.6"/><circle cx="18" cy="13.5" r="0.6"/>',
    values: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    journal: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h6M8 11h6"/>',
    press: '<path d="M3 10v4h3l7 4V6L6 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
};
const label = key => key.charAt(0).toUpperCase() + key.slice(1);
const menuAddress = key => (key === 'journal' ? '/journal/' : pageAddress(key));
for (const key of MENU) if (key !== 'journal' && !page[key]) fail(`the menu names ${key}, which no page has`);

// The old addresses were queries on the home page; this sends one on before anything draws.
const REDIRECT = `  <script>
  // An old address (/?slug=games, /?slug=journal&article=<slug>) goes to the page's own.
  (function () {
    var q = new URLSearchParams(location.search), slug = q.get('slug'), article = q.get('article');
    if (!slug) return;
    var to = slug === 'journal' || slug === 'news'
      ? '/journal/' + (article ? encodeURIComponent(article.replace(/\\.yml$/, '')) + '/' : '')
      : slug === 'home' ? '/' : '/' + encodeURIComponent(slug) + '/';
    location.replace(to + location.hash);
  })();
  </script>`;

const layout = readFileSync(at('layout.html'), 'utf8');
const year = String(new Date().getFullYear());
const served = [];
function render({ address, heading, title, body, description = DESCRIPTION, type = 'website', active, redirect = false }) {
    const nav = MENU.map(key => `<a href="${menuAddress(key)}">[${label(key)}]</a>`).join('');
    const tabs = MENU.map(key => `<a href="${menuAddress(key)}"${key === active ? ' class="active" aria-current="page"' : ''}>`
        + `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>`
        + `<span>${label(key)}</span></a>`).join('\n    ');
    const fill = {
        redirect: redirect ? REDIRECT : '',
        title: esc(`${title} - ${SITE_NAME}`),
        heading: esc(heading),
        description: esc(description),
        url: esc(BASE + address),
        type,
        nav,
        tabs,
        year,
        body,
    };
    const html = layout.replace(/\{\{(\w+)\}\}/g, (all, k) => (k in fill ? fill[k] : fail(`layout.html names {{${k}}}, which nothing fills`)));
    const file = fileFor(address);
    write(file, html);
    served.push(file);
}

for (const p of pages) {
    const address = p.slug === '404' ? '/404.html' : pageAddress(p.slug);
    render({ address, heading: p.title, title: p.title, body: p.html, active: p.slug, redirect: p.slug === 'home' });
}

// The journal: newest first, grouped by year and month, each shown once where it starts.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const newest = [...news].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
for (const n of news) if (!/^\d{4}-\d{2}-\d{2}$/.test(n.date)) fail(`news/${n.file}: the date ${n.date} isn't YYYY-MM-DD`);
let lastYear = null, lastMonth = null;
const rows = newest.map((n, i) => {
    const [yr, mo, day] = n.date.split('-');
    const showYear = yr !== lastYear;
    const showMonth = showYear || mo !== lastMonth;
    lastYear = yr;
    lastMonth = mo;
    return `
    <a href="${articleAddress(n.slug)}" class="journal-row ${i % 2 === 0 ? 'journal-row-even' : 'journal-row-odd'}">
        <span class="journal-year">${showYear ? yr : ''}</span>
        <span class="journal-month">${showMonth ? MONTHS[Number(mo) - 1] : ''}</span>
        <span class="journal-day">${day}</span>
        <span class="journal-title">${esc(n.title)}</span>
        <span class="journal-author">${esc(n.author)}</span>
    </a>`;
}).join('');
render({
    address: '/journal/', heading: 'Journal', title: 'Journal', active: 'journal',
    description: `Updates from ${SITE_NAME}.`,
    body: `
<hr>
<h2>Journal</h2>
<p><a href="/rss.xml" class="nav-btn">[rss]</a></p>
<div class="journal-list">
    <div class="journal-row journal-header">
        <span class="journal-year">Date</span>
        <span class="journal-month"></span>
        <span class="journal-day"></span>
        <span class="journal-title">Title</span>
        <span class="journal-author">Author</span>
    </div>${rows}
</div>`,
});

for (const n of news) {
    const [yr, mo, da] = n.date.split('-');
    render({
        address: articleAddress(n.slug), heading: 'Journal', title: n.title, active: 'journal', type: 'article',
        description: excerpt(n.html, 160),
        body: `
<hr>
<h2>${esc(n.title)}</h2>
<p><em>${mo}-${da}-${yr} — ${esc(n.author)}</em></p>
<p><a href="/journal/">&lt;- Back</a></p>

${n.html}

<p><a href="/journal/">&lt;- Back</a></p>`,
    });
}

// The sitemap for people: the menu's pages, then the rest, then every article, newest first.
const others = pages.filter(p => !MENU.includes(p.slug) && p.slug !== '404');
render({
    address: '/sitemap/', heading: 'Sitemap', title: 'Sitemap',
    description: `Every page and journal article on ${SITE_NAME}.`,
    body: `
<hr>
<h2>Sitemap</h2>
<h3>Pages</h3>
<ul>
${[...MENU.map(key => `<li><a href="${menuAddress(key)}">${label(key)}</a></li>`),
   ...others.map(p => `<li><a href="${pageAddress(p.slug)}">${esc(p.title)}</a></li>`)].join('\n')}
</ul>
<h3>Journal</h3>
<ul>
${newest.map(n => `<li><a href="${articleAddress(n.slug)}">${esc(n.title)}</a> <span class="text-muted">${n.date}</span></li>`).join('\n')}
</ul>
<p><a href="/rss.xml">RSS feed</a> · <a href="/sitemap.xml">sitemap.xml</a></p>`,
});

const xml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

write('sitemap.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...[...MENU.filter(k => k !== 'journal'), ...others.map(p => p.slug)].map(pageAddress),
    '/journal/',
    ...news.map(n => articleAddress(n.slug)),
    '/sitemap/',
].map(l => (l.startsWith('/') ? `  <url><loc>${xml(BASE + l)}</loc></url>` : l)).concat('</urlset>', '').join('\n'));

// Each item's guid is the address it had when it was first published (/?slug=journal&
// article=<slug>, which still leads to it), so no feed reader takes an old article for a
// new one; its link is the article's own address.
const rfc822 = d => new Date(`${d}T00:00:00Z`).toUTCString().replace('GMT', '+0000');
write('rss.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${SITE_NAME} - Journal</title>`,
    `    <link>${BASE}/journal/</link>`,
    `    <description>Updates from ${SITE_NAME}</description>`,
    newest.length ? `    <lastBuildDate>${rfc822(newest[0].date)}</lastBuildDate>` : null,
    ...newest.map(n => [
        '    <item>',
        `      <title>${xml(n.title)}</title>`,
        `      <link>${xml(BASE + articleAddress(n.slug))}</link>`,
        `      <guid>${xml(`${BASE}/?slug=journal&article=${encodeURIComponent(n.slug)}`)}</guid>`,
        `      <pubDate>${rfc822(n.date)}</pubDate>`,
        `      <description>${xml(excerpt(n.html, 300))}</description>`,
        '    </item>',
    ].join('\n')),
    '  </channel>',
    '</rss>', '',
].filter(l => l !== null).join('\n'));

await build({
    entryPoints: [at('js/site.js')],
    outfile: join(OUT, 'js/site.js'),
    bundle: true,
    format: 'esm',
    minify: true,
    sourcemap: true,
    target: 'es2022',
    logLevel: 'warning',
});

// Retired addresses (redirects.yml): a page at each that forwards at once. Never one a page
// is drawn at, and never to an address nothing is drawn at.
const redirects = load(readFileSync(at('redirects.yml'), 'utf8'), { schema: JSON_SCHEMA }) ?? {};
// A page or article set aside in a disabled/ folder was served once, so its address needs
// somewhere to go.
for (const [dir, address] of [['pages', pageAddress], ['news', articleAddress]]) {
    for (const file of readdirSync(at(dir, 'disabled')).filter(f => f.endsWith('.yml'))) {
        const slug = String(load(readFileSync(at(dir, 'disabled', file), 'utf8'), { schema: JSON_SCHEMA })?.slug ?? '');
        if (slug && !(address(slug) in redirects)) fail(`${dir}/disabled/${file} was served at ${address(slug)}; say in redirects.yml where that address goes now`);
    }
}
const drawn = new Set(served.map(f => '/' + f.replace(/(^|\/)index\.html$/, '$1')));
for (const [from, to] of Object.entries(redirects)) {
    if (!/^\/[\w./-]+\/$/.test(from)) fail(`redirects.yml: ${from} isn't a folder address (/<path>/)`);
    if (drawn.has(from)) fail(`redirects.yml: ${from} is a page the build draws`);
    if (!drawn.has(String(to))) fail(`redirects.yml: ${from} forwards to ${to}, which the build doesn't draw`);
    const target = esc(BASE + to);
    write(fileFor(from), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Moved - ${SITE_NAME}</title>
  <link rel="canonical" href="${target}">
  <meta http-equiv="refresh" content="0; url=${esc(to)}">
  <script>location.replace(${JSON.stringify(String(to))} + location.hash);</script>
</head>
<body><p>This page has moved: <a href="${esc(to)}">${target}</a>.</p></body>
</html>
`);
}

// The first 32 bits of the file's sha256, as a number.
const key = file => String(parseInt(createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8), 16));
const files = dir => readdirSync(join(OUT, dir)).filter(f => !f.startsWith('.')).map(f => `/${dir}/${f}`);
const keysOf = paths => Object.fromEntries(paths.sort().map(p => [p, key(join(OUT, p))]));

// Every reference in FILE to a path in KEYS (an src=, an href= or a CSS url(); not a bare
// mention of the name) gets that path's key. With EVERY, each path must be referenced: a
// path FILE never names is a mistake in this script.
const literally = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function stamp(file, keys, every = false) {
    const path = join(OUT, file);
    let text = readFileSync(path, 'utf8');
    for (const [p, k] of Object.entries(keys)) {
        const ref = new RegExp(String.raw`((?:\b(?:src|href)\s*=\s*|url\(\s*)["']?)` + literally(p)
            + String.raw`(?:\?v=[0-9a-z]+)?(?=["')\s>])`, 'g');
        const out = text.replace(ref, `$1${p}?v=${k}`);
        if (every && out === text && !text.includes(`${p}?v=${k}`)) fail(`${file} names no ${p} to stamp`);
        text = out;
    }
    writeFileSync(path, text);
}

stamp('css/style.css', keysOf(files('fonts')), true);
const keys = keysOf(['/css/style.css', '/js/site.js', '/favicon.png', ...files('fonts'), ...files('images')]);
for (const file of served) stamp(file, keys);

// What every page loads, by file name (js/version.js reads the same names off the page).
const shell = ['/js/site.js', '/css/style.css', '/favicon.png'];
const assets = Object.fromEntries(shell.map(p => [p.split('/').pop(), keys[p]]));
const buildId = createHash('sha256')
    .update(served.sort().map(f => readFileSync(join(OUT, f))).join('\0'))
    .digest('hex').slice(0, 12);
write('version.json', JSON.stringify({ build: buildId, assets }) + '\n');

console.log(`built public/ ${buildId}: ${pages.length} pages, ${news.length} articles, ${served.length} HTML files, ${Object.keys(redirects).length} retired addresses forwarded, ${Object.keys(keys).length} keyed files`);
