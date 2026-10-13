// Release announcements: a visitor leaves an email address to hear when a game is out. It
// posts to the Worker at /api/signup (signup-worker/), which checks Turnstile and stores the
// address; nothing is sent yet. A page opts in with an empty <div id="signup-mount"></div>
// in its markdown.

import { loadTurnstile } from './turnstile.js';

const ACTION = '/api/signup';
const SITEKEY = '0x4AAAAAAFVLgGBnejf8bKWT';

const FORM_HTML = `
<div class="inquiry-card">
<form id="signup-form" action="${ACTION}" method="POST">
  <label for="su-email">Email</label>
  <div class="signup-row">
    <input id="su-email" type="email" name="email" maxlength="254" autocomplete="email" required>
    <button type="submit">Notify me</button>
  </div>
  <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;">
  <div class="cf-turnstile"></div>
  <p id="signup-status" role="status"></p>
</form>
<div class="inquiry-sent" tabindex="-1" hidden>
  <svg class="sent-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23"/><path d="M15.5 27.5l7 7 14-15"/></svg>
  <div><p class="sent-title">You're on the list.</p><p class="sent-note">We'll email you when a game is released.</p></div>
</div>
</div>`;

export function mountSignupForms(root) {
    const mount = root.querySelector('#signup-mount');
    if (!mount || mount.dataset.mounted) return;
    mount.dataset.mounted = '1';
    mount.innerHTML = FORM_HTML;

    const form = mount.querySelector('#signup-form');
    const status = form.querySelector('#signup-status');
    const button = form.querySelector('button');
    const sent = mount.querySelector('.inquiry-sent');
    let widget = null;

    loadTurnstile()
        .then(turnstile => {
            if (!mount.isConnected) return;
            widget = turnstile.render(form.querySelector('.cf-turnstile'), { sitekey: SITEKEY, action: 'signup', theme: 'dark' });
        })
        .catch(() => { status.textContent = 'Could not load the verification check. Reload the page and try again.'; });

    form.addEventListener('submit', e => {
        e.preventDefault();
        const token = form.querySelector('input[name="cf-turnstile-response"]');
        if (!token || !token.value) {
            status.textContent = 'Please complete the verification check first.';
            return;
        }
        button.disabled = true;
        status.textContent = 'Signing you up...';
        fetch(form.action, { method: 'POST', body: new FormData(form) })
            .then(r => r.json())
            .then(r => {
                if (!r.ok) { status.textContent = r.error || 'Something went wrong. Please try again.'; return; }
                form.hidden = true;
                sent.hidden = false;
                if (!matchMedia('(prefers-reduced-motion: reduce)').matches) sent.classList.add('is-arriving');
                sent.focus({ preventScroll: true });
            })
            .catch(() => { status.textContent = 'Could not reach the server. Please try again.'; })
            .finally(() => {
                button.disabled = false;
                if (window.turnstile && widget !== null) window.turnstile.reset(widget);
            });
    });
}
