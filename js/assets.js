// The cache keys of every file the site fetches at runtime (the manifests, the pages and
// articles, the pictures), stamped in by scripts/build.js: each is a number taken from the
// file's own content, so a changed file has a new address and no cache can hand back the
// old one. A file the build didn't key is asked for as it is.
const KEYS = typeof __ASSET_KEYS__ === 'object' ? __ASSET_KEYS__ : {};

export function asset(path) {
    const key = KEYS[path];
    return key ? `${path}?v=${key}` : path;
}

// The same for every local src= and href= in rendered markup (a page's or article's HTML).
export function keyLinks(markup) {
    return markup.replace(/\b(src|href)=(["'])(\/[^"'?#]+)\2/g,
        (all, attr, q, path) => KEYS[path] ? `${attr}=${q}${path}?v=${KEYS[path]}${q}` : all);
}
