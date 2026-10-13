// The signup Worker against stand-ins for its bindings (D1, the rate limiter) and for
// Turnstile's siteverify. Offline: node --test signup-worker/test/ (make test runs it).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const ORIGIN = 'https://enchant.games';
let saved, limited, verdict, siteverifyBody, realFetch;

function env() {
    return {
        ALLOWED_ORIGIN: ORIGIN,
        TURNSTILE_HOSTNAME: 'enchant.games',
        TURNSTILE_SECRET: 'secret',
        SIGNUP_LIMIT: { limit: async () => ({ success: !limited }) },
        DB: {
            prepare: sql => ({
                bind: (...args) => ({
                    run: async () => {
                        assert.match(sql, /^INSERT INTO signups \(email, consent\) VALUES \(\?1, \?2\) ON CONFLICT \(email\) DO UPDATE SET consent = excluded\.consent$/);
                        saved.push(args);
                        return { success: true };
                    },
                }),
            }),
        },
    };
}

function post(fields, { origin = ORIGIN, method = 'POST' } = {}) {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.append(k, v);
    const headers = { 'CF-Connecting-IP': '203.0.113.7' };
    if (origin) headers.Origin = origin;
    return new Request('https://enchant.games/api/signup', method === 'POST' ? { method, body, headers } : { method, headers });
}

async function call(req) {
    const res = await worker.fetch(req, env());
    return { status: res.status, body: await res.json(), headers: res.headers };
}

beforeEach(() => {
    saved = [];
    limited = false;
    verdict = { success: true, hostname: 'enchant.games', action: 'signup' };
    siteverifyBody = null;
    realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
        assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
        siteverifyBody = init.body;
        return new Response(JSON.stringify(verdict));
    };
});
afterEach(() => { globalThis.fetch = realFetch; });

const good = { email: '  Player@Example.com ', consent: 'yes', 'cf-turnstile-response': 'tok' };

test('stores a verified address, trimmed and as typed, with what it agreed to', async () => {
    const r = await call(post(good));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true });
    assert.deepEqual(saved, [['Player@Example.com', 'games-and-sales']]);
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.equal(siteverifyBody.get('secret'), 'secret');
    assert.equal(siteverifyBody.get('response'), 'tok');
    assert.equal(siteverifyBody.get('remoteip'), '203.0.113.7');
});

test('refuses anything but POST', async () => {
    assert.equal((await call(post({}, { method: 'GET' }))).status, 405);
    assert.deepEqual(saved, []);
});

test('refuses another origin, or none', async () => {
    assert.equal((await call(post(good, { origin: 'https://evil.example' }))).status, 403);
    assert.equal((await call(post(good, { origin: null }))).status, 403);
    assert.deepEqual(saved, []);
});

test('the rate limit comes before Turnstile', async () => {
    limited = true;
    const r = await call(post(good));
    assert.equal(r.status, 429);
    assert.equal(siteverifyBody, null);
    assert.deepEqual(saved, []);
});

test('a filled honeypot looks like success and stores nothing', async () => {
    const r = await call(post({ ...good, website: 'spam.example' }));
    assert.deepEqual([r.status, r.body], [200, { ok: true }]);
    assert.equal(siteverifyBody, null);
    assert.deepEqual(saved, []);
});

test('refuses a malformed or overlong address before Turnstile', async () => {
    for (const email of ['', 'nobody', 'a@b', 'a b@c.d', `${'a'.repeat(250)}@b.co`]) {
        const r = await call(post({ ...good, email }));
        assert.equal(r.status, 400, email);
    }
    assert.equal(siteverifyBody, null);
    assert.deepEqual(saved, []);
});

test('refuses an address whose box is not ticked, before Turnstile', async () => {
    for (const consent of [undefined, '', 'no', 'on']) {
        const fields = { ...good };
        if (consent === undefined) delete fields.consent; else fields.consent = consent;
        const r = await call(post(fields));
        assert.equal(r.status, 400, String(consent));
        assert.match(r.body.error, /tick the box/);
    }
    assert.equal(siteverifyBody, null);
    assert.deepEqual(saved, []);
});

test('refuses a failed, foreign or other-purpose Turnstile token', async () => {
    for (const v of [
        { success: false },
        { success: true, hostname: 'elsewhere.example', action: 'signup' },
        { success: true, hostname: 'enchant.games', action: 'contact' },
    ]) {
        verdict = v;
        assert.equal((await call(post(good))).status, 403, JSON.stringify(v));
    }
    assert.deepEqual(saved, []);
});

test('says so when siteverify cannot be reached', async () => {
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal((await call(post(good))).status, 502);
    assert.deepEqual(saved, []);
});

test('says so when the database refuses', async () => {
    const e = env();
    e.DB = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1 down'); } }) }) };
    const res = await worker.fetch(post(good), e);
    assert.equal(res.status, 500);
    assert.equal((await res.json()).ok, false);
});
