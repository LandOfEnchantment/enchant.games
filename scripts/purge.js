// After a deploy, clear Cloudflare's copy of every address this build serves that a cache
// might hold from before it (as merecatholicity.com's deploy job does): each file's bare
// address (the pages, by their folders too, version.json, the feed and the sitemap can't
// carry a key, and a tab from an older build may ask for any file without one) and every
// keyed address the build stamped (in case one was fetched in the moments before GitHub Pages published, when a
// new key could have been filled with old bytes). Run by deploy.yml only once deploy-pages
// says the site is published: a purge before that would re-cache the old files.
//
//   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ZONE_ID=… node scripts/purge.js
//   node scripts/purge.js --list      the addresses, and nothing purged
//   node scripts/purge.js --everything everything Cloudflare holds for the zone (purge-cache.yml)
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SITE = 'https://enchant.games';
const OUT = join(import.meta.dirname, '..', 'public');
const everything = process.argv.includes('--everything');
const urls = new Set([`${SITE}/`]);
for (const f of everything ? [] : readdirSync(OUT, { recursive: true, withFileTypes: true })) {
    if (!f.isFile()) continue;
    const path = '/' + relative(OUT, join(f.parentPath, f.name)).split('\\').join('/');
    urls.add(SITE + path);
    // a page is asked for by its folder (/games/), not its file
    if (path.endsWith('/index.html')) urls.add(SITE + path.slice(0, -'index.html'.length));
    if (/\.(html|css)$/.test(path)) {
        const text = readFileSync(join(OUT, path), 'utf8');
        for (const m of text.matchAll(/(\/[\w./-]+\?v=\d+)/g)) urls.add(SITE + m[1]);
    }
}
const all = [...urls].sort();
if (process.argv.includes('--list')) {
    console.log(all.join('\n'));
    process.exit(0);
}

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ZONE_ID: zone } = process.env;
if (!token || !zone) {
    console.error('purge: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are needed; nothing was purged');
    process.exit(1);
}

// A purge request takes at most 100 addresses (the free plan's limit).
const requests = everything ? [{ purge_everything: true }] : [];
for (let i = 0; !everything && i < all.length; i += 100) requests.push({ files: all.slice(i, i + 100) });
for (const body of requests) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const answer = await res.json().catch(() => ({}));
    if (!answer.success) {
        console.error(`purge: Cloudflare refused (${res.status}): ${JSON.stringify(answer.errors ?? answer)}`);
        process.exit(1);
    }
}
console.log(everything ? "purge: everything cleared from Cloudflare's cache of the zone"
    : `purge: ${all.length} addresses cleared from Cloudflare's cache`);
