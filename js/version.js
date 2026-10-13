// Is this tab running the site that is live? (as in ../merecatholicity.com's nav.js)
//
// The build writes /version.json, the cache key of each file the page loads (site.js,
// style.css). This compares it against the keys THIS PAGE IS RUNNING, read off its own
// <script> and <link> addresses rather than a constant compiled in: a page cached from an
// older build carries older keys, and the addresses can't lie about that.
//
// It prompts and never acts: a tab left open over a deploy gets a small "Reload" offer,
// never a reload out from under its reader, and never while they're typing in a form.

function running() {
    const out = {};
    for (const el of document.querySelectorAll('script[src], link[href]')) {
        const m = /([^/?#]+)\?v=([0-9a-z]+)/.exec(el.getAttribute('src') || el.getAttribute('href') || '');
        if (m) out[m[1]] = m[2];
    }
    return out;
}

// What this page carries that the server has moved on from; only files on both sides count.
function behind(served) {
    const have = running();
    return Object.keys(have).filter(k => served[k] && served[k] !== have[k]);
}

function typing() {
    return [...document.querySelectorAll('textarea, input[type=text], input[type=email]')].some(el => el.value);
}

let bar = null;
function offer(build) {
    try { if (sessionStorage.getItem('version-later') === build) return; } catch { /* private mode */ }
    if (bar || typing()) return;   // offered again at the next check
    bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.setAttribute('role', 'status');
    const msg = document.createElement('span');
    msg.textContent = 'A new version of the site is ready.';
    const go = document.createElement('button');
    go.type = 'button';
    go.textContent = 'Reload';
    go.onclick = () => location.reload();
    const later = document.createElement('button');
    later.type = 'button';
    later.className = 'update-later';
    later.textContent = 'Later';
    later.onclick = () => {
        try { sessionStorage.setItem('version-later', build); } catch { /* private mode */ }
        bar.remove();
        bar = null;
    };
    bar.append(msg, go, later);
    document.body.append(bar);
}

// no-store: whether a cache is stale is never a question to ask that cache.
function check() {
    return fetch('/version.json', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d?.assets && behind(d.assets).length) offer(d.build); })
        .catch(() => {});   // offline: silence
}

// On coming back to the tab, on a page restored from the back-forward cache, and hourly;
// never more than once in five minutes.
export function watchVersion() {
    let last = 0;
    const paced = () => {
        if (Date.now() - last < 300000) return;
        last = Date.now();
        check();
    };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') paced(); });
    addEventListener('pageshow', e => { if (e.persisted) paced(); });
    setInterval(paced, 3600000);
    setTimeout(paced, 4000);
}
