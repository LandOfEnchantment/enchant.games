// The contact form Worker against stand-ins for its bindings (the email sender, the rate
// limiter) and for Turnstile's siteverify. Offline: make test runs it.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const ORIGIN = 'https://enchant.games';
let sent, limited, verdict, siteverifyBody, sendFails, realFetch;

function env() {
    return {
        ALLOWED_ORIGIN: ORIGIN,
        TURNSTILE_HOSTNAME: 'enchant.games',
        TURNSTILE_SECRET: 'secret',
        CONTACT_TO: 'owner@example.com',
        SEND_LIMIT: { limit: async () => ({ success: !limited }) },
        EMAIL: { send: async msg => { if (sendFails) throw new Error('no route'); sent.push(msg); } },
    };
}

function post(fields, { origin = ORIGIN, method = 'POST' } = {}) {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.append(k, v);
    const headers = { 'CF-Connecting-IP': '203.0.113.7' };
    if (origin) headers.Origin = origin;
    return new Request('https://enchant.games/api/contact', method === 'POST' ? { method, body, headers } : { method, headers });
}

async function call(req) {
    const res = await worker.fetch(req, env());
    return { status: res.status, body: await res.json(), headers: res.headers };
}

beforeEach(() => {
    sent = [];
    limited = false;
    sendFails = false;
    verdict = { success: true, hostname: 'enchant.games', action: 'contact' };
    siteverifyBody = null;
    realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
        assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
        siteverifyBody = init.body;
        return new Response(JSON.stringify(verdict));
    };
});
afterEach(() => { globalThis.fetch = realFetch; });

const good = { name: 'A Player', email: ' player@example.com ', message: '  Hello there.  ', 'cf-turnstile-response': 'tok' };

test('emails a verified message to the owner, replying to the sender', async () => {
    const r = await call(post(good));
    assert.deepEqual([r.status, r.body], [200, { ok: true }]);
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.equal(sent.length, 1);
    const m = sent[0];
    assert.equal(m.to, 'owner@example.com');
    assert.deepEqual(m.from, { email: 'contact-form@enchant.games', name: 'enchant.games contact form' });
    assert.deepEqual(m.replyTo, { email: 'player@example.com', name: 'A Player' });
    assert.equal(m.subject, 'enchant.games: message from A Player');
    assert.equal(m.text, 'Name: A Player\nEmail: player@example.com\n\nHello there.\n');
    assert.equal(siteverifyBody.get('secret'), 'secret');
    assert.equal(siteverifyBody.get('remoteip'), '203.0.113.7');
});

test('a name or address can carry no line breaks into the headers', async () => {
    await call(post({ ...good, name: 'A\r\nBcc: x@evil.example', email: 'p@example.com\r\nBcc: y@evil.example' }));
    assert.equal(sent.length, 0, 'the broken-up address is no address');
    await call(post({ ...good, name: 'A\r\nBcc: x@evil.example' }));
    assert.equal(sent[0].replyTo.name, 'A Bcc: x@evil.example');
    assert.doesNotMatch(sent[0].subject, /[\r\n]/);
});

test('anonymous when no name is given', async () => {
    await call(post({ ...good, name: '' }));
    assert.equal(sent[0].subject, 'enchant.games: message from anonymous');
    assert.equal(sent[0].replyTo.name, undefined);
});

test('refuses anything but POST, and another origin or none', async () => {
    assert.equal((await call(post({}, { method: 'GET' }))).status, 405);
    assert.equal((await call(post(good, { origin: 'https://adamschaefers.com' }))).status, 403);
    assert.equal((await call(post(good, { origin: null }))).status, 403);
    assert.equal(sent.length, 0);
});

test('the rate limit comes before Turnstile and the send', async () => {
    limited = true;
    assert.equal((await call(post(good))).status, 429);
    assert.equal(siteverifyBody, null);
    assert.equal(sent.length, 0);
});

test('a filled honeypot looks like success and sends nothing', async () => {
    const r = await call(post({ ...good, website: 'spam.example' }));
    assert.deepEqual([r.status, r.body], [200, { ok: true }]);
    assert.equal(siteverifyBody, null);
    assert.equal(sent.length, 0);
});

test('refuses an empty message or a bad address before Turnstile', async () => {
    assert.equal((await call(post({ ...good, message: '   ' }))).status, 400);
    for (const email of ['', 'nobody', 'a@b', 'a b@c.d']) assert.equal((await call(post({ ...good, email }))).status, 400, email);
    assert.equal(siteverifyBody, null);
    assert.equal(sent.length, 0);
});

test('refuses a failed, foreign or other-purpose Turnstile token', async () => {
    for (const v of [
        { success: false },
        { success: true, hostname: 'adamschaefers.com', action: 'contact' },
        { success: true, hostname: 'enchant.games', action: 'signup' },
    ]) {
        verdict = v;
        assert.equal((await call(post(good))).status, 403, JSON.stringify(v));
    }
    assert.equal(sent.length, 0);
});

test('says so when siteverify or the send fails', async () => {
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal((await call(post(good))).status, 502);
    globalThis.fetch = async () => new Response(JSON.stringify(verdict));
    sendFails = true;
    const r = await call(post(good));
    assert.equal(r.status, 502);
    assert.match(r.body.error, /Could not deliver/);
});
