/* The Press page's contact form (POST /api/contact, from js/contact.js). Rate limits per IP,
   verifies the Turnstile token, then emails the message to CONTACT_TO (a verified Email
   Routing destination), with the sender's address to reply to. TURNSTILE_SECRET is a Worker
   secret; everything else is in wrangler.jsonc. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TURNSTILE_ACTION = 'contact';
const FROM = { email: 'contact-form@enchant.games', name: 'enchant.games contact form' };

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

    // Throttle before Turnstile and the send so a flood can't burn either quota.
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const { success } = await env.SEND_LIMIT.limit({ key: ip });
    if (!success) return json({ ok: false, error: 'Too many messages. Wait a minute and try again.' }, 429);

    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ ok: false, error: 'Bad request.' }, 400);
    }

    // Honeypot: people never see this field, bots fill it. Pretend success.
    if (form.get('website')) return json({ ok: true }, 200);

    // No line breaks in a header's worth of text: a name or address can't add headers.
    const name = String(form.get('name') || '').replace(/[\r\n\t]+/g, ' ').slice(0, 200).trim();
    const email = String(form.get('email') || '').replace(/[\r\n\t]+/g, '').slice(0, 254).trim();
    const message = String(form.get('message') || '').slice(0, 5000).trim();
    if (!message) return json({ ok: false, error: 'The message is empty.' }, 400);
    if (!EMAIL.test(email)) return json({ ok: false, error: 'Please enter a valid email address.' }, 400);

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
      await env.EMAIL.send({
        to: env.CONTACT_TO,
        from: FROM,
        replyTo: { email, name: name || undefined },
        subject: 'enchant.games: message from ' + (name || 'anonymous'),
        text: 'Name: ' + (name || '(none given)') + '\nEmail: ' + email + '\n\n' + message + '\n',
      });
    } catch (err) {
      console.log(JSON.stringify({ event: 'send_failed', error: String(err) }));
      return json({ ok: false, error: 'Could not deliver the message. Please try again later.' }, 502);
    }
    return json({ ok: true }, 200);
  },
};
