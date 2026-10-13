// Contact form, in the same dress as adamschaefers.com's. It posts to this site's own Worker
// at /api/contact (contact-worker/), which checks Turnstile and emails the message.
// A page opts in with an empty <div id="contact-mount"></div> in its markdown.

import { loadTurnstile } from './turnstile.js';

const ACTION = '/api/contact';
const SITEKEY = '0x4AAAAAAFVRUaFaE_eoc-i-';
const DRAFT_KEY = 'contact-draft';
const FIELDS = ['name', 'email', 'message'];
const DRAFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const FORM_HTML = `
<div class="inquiry-card">
<form id="contact-form" action="${ACTION}" method="POST">
  <div><label for="cf-name">Name</label>
    <input id="cf-name" type="text" name="name" maxlength="200" autocomplete="name"></div>
  <div><label for="cf-email">Email</label>
    <input id="cf-email" type="email" name="email" maxlength="200" autocomplete="email" required></div>
  <div class="wide"><label for="cf-message">Message</label>
    <textarea id="cf-message" name="message" maxlength="5000" rows="6" required></textarea></div>
  <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;">
  <div class="cf-turnstile wide"></div>
  <button type="submit">Send</button>
  <p id="contact-status" class="wide" role="status"></p>
</form>
<div class="inquiry-sent" tabindex="-1" hidden>
  <svg class="sent-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23"/><path d="M15.5 27.5l7 7 14-15"/></svg>
  <div><p class="sent-title">Sent. Thank you!</p><p class="sent-note">We'll get back to you by email.</p></div>
</div>
</div>`;

export function mountContactForms(root) {
    const mount = root.querySelector('#contact-mount');
    if (!mount || mount.dataset.mounted) return;
    mount.dataset.mounted = '1';
    mount.innerHTML = FORM_HTML;

    const card = mount.querySelector('.inquiry-card');
    const form = mount.querySelector('#contact-form');
    const status = form.querySelector('#contact-status');
    const button = form.querySelector('button');
    const sent = card.querySelector('.inquiry-sent');
    let widget = null;

    loadTurnstile()
        .then(turnstile => {
            if (!mount.isConnected) return;
            widget = turnstile.render(form.querySelector('.cf-turnstile'), { sitekey: SITEKEY, action: 'contact', theme: 'dark' });
        })
        .catch(() => { status.textContent = 'Could not load the verification check. Reload the page and try again.'; });

    // Keep an unsent draft in this browser so a failed check, refresh or closed tab doesn't lose it.
    // A successful send resets the form, which clears the draft.
    try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (draft && Date.now() - draft.savedAt < DRAFT_MAX_AGE) {
            FIELDS.forEach(f => { if (draft[f] && !form.elements[f].value) form.elements[f].value = draft[f]; });
        } else if (draft) {
            localStorage.removeItem(DRAFT_KEY);
        }
    } catch (e) {}
    form.addEventListener('input', () => {
        const draft = { savedAt: Date.now() };
        FIELDS.forEach(f => { draft[f] = form.elements[f].value; });
        try {
            if (draft.name || draft.email || draft.message.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            else localStorage.removeItem(DRAFT_KEY);
        } catch (e) {}
    });

    // Post to the worker and show the result inline.
    form.addEventListener('submit', e => {
        e.preventDefault();
        const token = form.querySelector('input[name="cf-turnstile-response"]');
        if (!token || !token.value) {
            status.textContent = 'Please complete the verification check first.';
            return;
        }
        button.disabled = true;
        status.textContent = 'Sending...';
        fetch(form.action, { method: 'POST', body: new FormData(form) })
            .then(r => r.json())
            .then(r => {
                if (r.ok) { form.reset(); status.textContent = 'Sent. Thank you!'; }
                else { status.textContent = r.error || 'Something went wrong. Please try again.'; }
            })
            .catch(() => { status.textContent = 'Could not reach the server. Please try again.'; })
            .finally(() => {
                button.disabled = false;
                if (window.turnstile && widget !== null) window.turnstile.reset(widget);
            });
    });

    // After a successful send, flip the form away and show the sent card in its place.
    function clear() {
        FIELDS.forEach(f => { form.elements[f].value = ''; });
    }
    form.addEventListener('reset', e => {
        try { localStorage.removeItem(DRAFT_KEY); } catch (err) {}
        // Keep the typed text on the card while it flips away; clear it once hidden.
        e.preventDefault();
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            clear();
            form.hidden = true;
            sent.hidden = false;
            sent.focus({ preventScroll: true });
            return;
        }
        card.style.height = card.offsetHeight + 'px';
        form.classList.add('is-leaving');
        form.addEventListener('animationend', () => {
            clear();
            form.hidden = true;
            sent.hidden = false;
            sent.classList.add('is-arriving');
            card.style.height = sent.offsetHeight + 'px';
            card.addEventListener('transitionend', () => { card.style.height = ''; }, { once: true });
            sent.focus({ preventScroll: true });
        }, { once: true });
    });
}
