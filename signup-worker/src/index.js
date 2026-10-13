/* The Games page's mailing list (js/signup.js), in D1. Two doors, each POST only:

     /api/signup       wants the consent box ticked, then stores the address with what it
                       agreed to (CONSENT; migrations/0002_consent.sql names each wording).
                       Signing up again records the newer consent.
     /api/unsubscribe  deletes the address.

   Both rate limit per IP and verify a Turnstile token solved for their own action, and both
   answer the same whether or not the address was on the list (a signup says ok, an
   unsubscribe says the address was removed), so neither can be used to learn who is on it.
   It sends no email and offers no way to read the list back. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The wording js/signup.js's checkbox shows: news about our games, releases and sales.
const CONSENT = 'games-and-sales';
// Each door's Turnstile action (js/signup.js renders each widget with its own).
const DOORS = { '/api/signup': 'signup', '/api/unsubscribe': 'unsubscribe' };

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    const action = DOORS[new URL(request.url).pathname];
    if (!action) return json({ ok: false, error: 'Not found.' }, 404);
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

    const email = String(form.get('email') || '').trim();
    const done = action === 'signup' ? { ok: true } : { ok: true, email };

    // Honeypot: people never see this field, bots fill it. Pretend success.
    if (form.get('website')) return json(done, 200);

    if (email.length > 254 || !EMAIL.test(email)) {
      return json({ ok: false, error: 'Please enter a valid email address.' }, 400);
    }
    if (action === 'signup' && form.get('consent') !== 'yes') {
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
    if (!verdict.success || verdict.hostname !== env.TURNSTILE_HOSTNAME || verdict.action !== action) {
      return json({ ok: false, error: 'Verification failed. Reload the page and try again.' }, 403);
    }

    try {
      // signups.email is COLLATE NOCASE, so either finds the address however it was typed.
      if (action === 'signup') {
        await env.DB.prepare('INSERT INTO signups (email, consent) VALUES (?1, ?2) '
          + 'ON CONFLICT (email) DO UPDATE SET consent = excluded.consent')
          .bind(email, CONSENT).run();
      } else {
        await env.DB.prepare('DELETE FROM signups WHERE email = ?1').bind(email).run();
      }
    } catch (err) {
      console.log(JSON.stringify({ event: `${action}_failed`, error: String(err) }));
      return json({ ok: false, error: 'Something went wrong on our side. Please try again later.' }, 500);
    }
    return json(done, 200);
  },
};
