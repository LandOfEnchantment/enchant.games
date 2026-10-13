// The mailing list: a visitor leaves an email address, and ticks the box agreeing to hear
// about our games (releases and sales promotions); below, folded away, a form takes an
// address off the list. Each posts to the Worker (signup-worker/: /api/signup,
// /api/unsubscribe) with a Turnstile token solved for its own action; nothing is sent yet.
// An unsubscribe always says the address was removed, on the list or not, so the form can't
// tell anyone who is. A page opts in with an empty <div id="signup-mount"></div> in its
// markdown. Change the box's wording and the Worker's CONSENT (and a migration naming the
// new wording) together.

import { loadTurnstile } from './turnstile.js';

const SITEKEY = '0x4AAAAAAFVLgGBnejf8bKWT';

const FORM_HTML = `
<div class="inquiry-card">
<form id="signup-form" action="/api/signup" method="POST">
  <label for="su-email">Email</label>
  <input id="su-email" type="email" name="email" maxlength="254" autocomplete="email" required>
  <label class="signup-consent">
    <input type="checkbox" name="consent" value="yes" required>
    <span>I agree to receive emails from Land of Enchantment Games about our games, including release announcements and sales promotions, under our <a href="/privacy-policy/">Privacy Policy</a>. I can unsubscribe at any time.</span>
  </label>
  <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;">
  <div class="cf-turnstile"></div>
  <button type="submit">Notify me</button>
  <p class="signup-status" role="status"></p>
</form>
<div class="inquiry-sent" tabindex="-1" hidden>
  <svg class="sent-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23"/><path d="M15.5 27.5l7 7 14-15"/></svg>
  <div><p class="sent-title">You're on the list.</p><p class="sent-note">We'll email you news about our games.</p></div>
</div>
</div>
<details class="unsubscribe">
  <summary>Unsubscribe</summary>
  <form id="unsubscribe-form" action="/api/unsubscribe" method="POST">
    <label for="un-email">Email to remove from the list</label>
    <input id="un-email" type="email" name="email" maxlength="254" autocomplete="email" required>
    <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;">
    <div class="cf-turnstile"></div>
    <button type="submit">Unsubscribe</button>
    <p class="signup-status" role="status"></p>
  </form>
</details>`;

// Wire one form to its Worker door: a Turnstile widget for ACTION (rendered once READY
// resolves), a post, and ONDONE with the Worker's answer when it says ok.
function wire(form, action, ready, onDone) {
    const status = form.querySelector('.signup-status');
    const button = form.querySelector('button');
    let widget = null;
    ready
        .then(() => loadTurnstile())
        .then(turnstile => {
            if (!form.isConnected) return;
            widget = turnstile.render(form.querySelector('.cf-turnstile'), { sitekey: SITEKEY, action, theme: 'dark' });
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
        status.textContent = 'One moment...';
        fetch(form.action, { method: 'POST', body: new FormData(form) })
            .then(r => r.json())
            .then(r => {
                if (r.ok) onDone(r);
                else status.textContent = r.error || 'Something went wrong. Please try again.';
            })
            .catch(() => { status.textContent = 'Could not reach the server. Please try again.'; })
            .finally(() => {
                button.disabled = false;
                if (window.turnstile && widget !== null) window.turnstile.reset(widget);
            });
    });
}

export function mountSignupForms(root) {
    const mount = root.querySelector('#signup-mount');
    if (!mount || mount.dataset.mounted) return;
    mount.dataset.mounted = '1';
    mount.innerHTML = FORM_HTML;

    const signup = mount.querySelector('#signup-form');
    const sent = mount.querySelector('.inquiry-sent');
    wire(signup, 'signup', Promise.resolve(), () => {
        signup.hidden = true;
        sent.hidden = false;
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) sent.classList.add('is-arriving');
        sent.focus({ preventScroll: true });
    });

    // The unsubscribe form's bot check loads only when someone opens it.
    const fold = mount.querySelector('details.unsubscribe');
    const unsubscribe = fold.querySelector('#unsubscribe-form');
    const opened = new Promise(resolve => fold.addEventListener('toggle', () => { if (fold.open) resolve(); }));
    wire(unsubscribe, 'unsubscribe', opened, r => {
        unsubscribe.reset();
        unsubscribe.querySelector('.signup-status').textContent = `${r.email} has been removed from the list.`;
    });
}
