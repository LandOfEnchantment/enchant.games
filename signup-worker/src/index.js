/* The release-announcement signup for enchant.games (POST /api/signup, from js/signup.js).
   Rate limits per IP, wants the consent box ticked, verifies the Turnstile token, then stores
   the address in D1 with what it agreed to (CONSENT; migrations/0002_consent.sql names each
   wording). An address already on the list answers the same as a new one, so the form can't
   be used to learn who signed up; signing up again records the newer consent. It sends no
   email and offers no way to read the list back. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TURNSTILE_ACTION = 'signup';
// The wording js/signup.js's checkbox shows: news about our games, releases and sales.
const CONSENT = 'games-and-sales';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
    if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return json({ ok: false, error: 'Bad origin.' }, 403);

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const { success } = await env.SIGNUP_LIMIT.limit({ key: ip });
    if (!success) return json({ ok: false, error: 'Too many tries. Wait a minute and try again.' }, 429);

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: 'Bad request.' }, 400);
    }

    // Honeypot: people never see this field, bots fill it. Pretend success.
    if (form.get('website')) return json({ ok: true }, 200);

    const email = String(form.get('email') || '').trim();
    if (email.length > 254 || !EMAIL.test(email)) {
      return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
    }
    if (form.get('consent') !== 'yes') {
      return json({ ok: false, error: 'Please tick the box to agree to the emails.' }, 400);
    }

    let verdict;
    try {
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: String(form.get('cf-turnstile-response') || ''),
          remoteip: ip,
        }),
      });
      verdict = await verify.json();
    } catch (err) {
      console.log(JSON.stringify({ event: 'siteverify_failed', error: String(err) }));
      return json({ ok: false, error: 'Could not check the verification. Please try again.' }, 502);
    }
    if (!verdict.success || verdict.hostname !== env.TURNSTILE_HOSTNAME || verdict.action !== TURNSTILE_ACTION) {
      return json({ ok: false, error: 'Verification failed. Reload the page and try again.' }, 403);
    }

    try {
      await env.DB.prepare('INSERT INTO signups (email, consent) VALUES (?1, ?2) '
        + 'ON CONFLICT (email) DO UPDATE SET consent = excluded.consent')
        .bind(email, CONSENT).run();
    } catch (err) {
      console.log(JSON.stringify({ event: 'insert_failed', error: String(err) }));
      return json({ ok: false, error: 'Could not save your address. Please try again later.' }, 500);
    }
    return json({ ok: true }, 200);
  },
};
