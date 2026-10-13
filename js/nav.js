// Moving between pages without waiting. Every page arrives drawn (scripts/build.js), so the
// first one paints from its own HTML; once it has and the browser is idle, this fetches every
// other page the site has (sitemap.xml names them) in the background, a few at a time. A
// click on a link to one of them then swaps it in place: no request, no blank moment. Back
// and forward do the same, each page returning to where it was scrolled.
//
// Anything it can't swap goes the ordinary way, a page load: another site, a file, a page
// from a newer deploy (its script or styles carry other keys, so js/version.js's rules
// hold), a 404, a retired address's forwarding page, or any fetch that fails.

const FRESH = 10 * 60 * 1000;   // as long as GitHub Pages lets a browser keep a page
const pages = new Map();        // path -> { at, page: Promise<{ title, description, main }> }
let onSwap = () => {};

// The keyed addresses a page loads (its script, styles, icon, font): pages that share them
// can share this script.
const shell = doc => [...doc.querySelectorAll('head script[src], head link[rel=stylesheet], head link[rel=icon]')]
    .map(el => el.getAttribute('src') || el.getAttribute('href')).join(' ');

function snapshot(doc) {
    const main = doc.querySelector('main.container');
    if (!main || shell(doc) !== shell(document)) return null;
    return {
        title: doc.title,
        description: doc.querySelector('meta[name=description]')?.content ?? '',
        canonical: doc.querySelector('link[rel=canonical]')?.href ?? '',
        main: main.innerHTML,
    };
}

function load(path) {
    const hit = pages.get(path);
    if (hit && Date.now() - hit.at < FRESH) return hit.page;
    const page = fetch(path)
        .then(r => (r.ok && !r.redirected ? r.text() : Promise.reject(new Error(`${path}: ${r.status}`))))
        .then(text => snapshot(new DOMParser().parseFromString(text, 'text/html')) ?? Promise.reject(new Error(`${path}: not swappable`)));
    page.catch(() => pages.delete(path));
    pages.set(path, { at: Date.now(), page });
    return page;
}

// A link this can follow in place: this site, a page's address (they end in /), not one
// opened elsewhere or saved.
function pageUrl(a) {
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
    const url = new URL(a.href, location.href);
    return url.origin === location.origin && url.pathname.endsWith('/') && !url.search ? url : null;
}

async function go(url, { push = true, y = 0 } = {}) {
    let page;
    try {
        page = await load(url.pathname);
    } catch {
        location.assign(url.href);
        return;
    }
    if (push) {
        history.replaceState({ y: scrollY }, '');
        history.pushState({ y: 0 }, '', url.href);
    }
    document.querySelector('main.container').innerHTML = page.main;
    document.title = page.title;
    document.querySelector('meta[name=description]')?.setAttribute('content', page.description);
    document.querySelector('link[rel=canonical]')?.setAttribute('href', page.canonical);
    const target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (target) target.scrollIntoView();
    else scrollTo(0, y);
    // Say where we are to whoever reads the page aloud, as a page load would.
    const h1 = document.querySelector('main.container h1');
    if (h1) {
        h1.tabIndex = -1;
        h1.focus({ preventScroll: true });
    }
    onSwap();
}

function prefetchAll() {
    if (navigator.connection?.saveData) return;
    fetch('/sitemap.xml')
        .then(r => (r.ok ? r.text() : ''))
        .then(xml => {
            const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname)
                .filter(p => !pages.has(p));
            const next = () => { if (paths.length) load(paths.shift()).catch(() => {}).finally(next); };
            for (let i = 0; i < 3; i++) next();
        })
        .catch(() => {});
}

// Call before anything changes the page (the forms mount into it), so a return here draws it
// as it arrived. SWAPPED runs after each swap, as the page's own setup ran after its load.
export function startNav(swapped) {
    onSwap = swapped;
    const first = snapshot(document);
    if (first) pages.set(location.pathname, { at: Date.now(), page: Promise.resolve(first) });
    history.scrollRestoration = 'manual';
    history.replaceState({ y: scrollY }, '');

    document.addEventListener('click', e => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const url = pageUrl(e.target.closest('a[href]'));
        if (!url) return;
        if (url.pathname === location.pathname && url.hash) return;   // an anchor on this page
        e.preventDefault();
        go(url);
    });
    // A page not fetched yet starts as the pointer reaches its link.
    document.addEventListener('pointerover', e => {
        const url = pageUrl(e.target.closest?.('a[href]'));
        if (url) load(url.pathname).catch(() => {});
    });
    addEventListener('popstate', e => go(new URL(location.href), { push: false, y: e.state?.y ?? 0 }));
    addEventListener('pagehide', () => history.replaceState({ y: scrollY }, ''));

    const idle = () => (window.requestIdleCallback ?? setTimeout)(prefetchAll);
    if (document.readyState === 'complete') idle();
    else addEventListener('load', idle, { once: true });
}
