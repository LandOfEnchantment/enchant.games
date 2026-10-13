// Cloudflare Turnstile, for the forms that post to a Worker (js/contact.js, js/signup.js).
// The page is rendered client-side, so the script is loaded once, on the first form that
// needs it, and each freshly mounted form renders its widget explicitly rather than having
// Turnstile scan the page on load.
let turnstileReady = null;
export function loadTurnstile() {
    if (!turnstileReady) {
        turnstileReady = new Promise((resolve, reject) => {
            window.onTurnstileLoad = () => resolve(window.turnstile);
            const s = document.createElement('script');
            s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
            s.async = true;
            s.onerror = () => { turnstileReady = null; reject(new Error('Turnstile failed to load')); };
            document.head.appendChild(s);
        });
    }
    return turnstileReady;
}
