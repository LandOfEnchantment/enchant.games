// The rules of js/version.js, the "a new version of the site is ready" offer (as
// ../merecatholicity.com's tests/js/version_check.test.ts holds its nav.js to them).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(import.meta.dirname, '..', 'js', 'version.js'), 'utf8');

test('it compares what the page LOADED, not a version compiled in', () => {
    assert.match(src, /document\.querySelectorAll\('script\[src\], link\[href\]'\)/);
    assert.doesNotMatch(src, /BUILD_ID|__BUILD__/);
});

test('whether it is current is never answered from a cache', () => {
    assert.match(src, /fetch\('\/version\.json', \{ cache: 'no-store' \}\)/);
});

test('only files the page carries are judged', () => {
    assert.match(src, /served\[k\] && served\[k\] !== have\[k\]/);
});

test('it offers and never acts: the one reload is the button', () => {
    assert.equal(src.match(/location\.reload\(\)/g)?.length, 1);
    assert.match(src, /go\.onclick = \(\) => location\.reload\(\);/);
});

test('never over a half-written message', () => {
    assert.match(src, /if \(bar \|\| typing\(\)\) return;/);
});

test('site.js starts it', () => {
    const site = readFileSync(join(import.meta.dirname, '..', 'js', 'site.js'), 'utf8');
    assert.match(site, /^watchVersion\(\);$/m);
});
