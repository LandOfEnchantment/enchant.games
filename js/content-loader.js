import { load, JSON_SCHEMA } from '/js/js-yaml/dist/js-yaml.mjs';
import { marked } from '/js/marked/lib/marked.esm.js';

marked.setOptions({
    gfm: true,
    breaks: false,
});

function toHTML(markdown) {
    return marked.parse(markdown || '');
}

function toEntry(raw) {
    return {
        Title:  String(raw.title  || ''),
        Slug:   String(raw.slug   || ''),
        Date:   String(raw.date   || ''),
        Author: String(raw.author || ''),
        Body:   toHTML(raw.body),
    };
}

async function fetchYAML(path) {
    const res = await fetch(path);
    const text = await res.text();
    return load(text, { schema: JSON_SCHEMA });
}

export async function loadData() {
    const manifest = await (await fetch('/pages.json')).json();
    const entries = await Promise.all(
        manifest.map(f => fetchYAML('/pages/' + f))
    );
    const pages = {};
    for (const raw of entries) {
        const entry = toEntry(raw);
        pages[entry.Slug] = entry;
    }
    return {
        pages,
        meta: { generated: new Date().toISOString() },
    };
}

export async function loadNews() {
    const manifest = await (await fetch('/news.json')).json();
    const news = manifest.map(m => ({
        Title:  String(m.title  || ''),
        Slug:   String(m.slug   || ''),
        Date:   String(m.date   || ''),
        Author: String(m.author || ''),
        File:   String(m.file   || ''),
    }));
    news.sort((a, b) => (a.Date > b.Date ? -1 : a.Date < b.Date ? 1 : 0));
    return news;
}

export async function loadArticle(filename) {
    const raw = await fetchYAML('/news/' + filename);
    return toEntry(raw);
}
