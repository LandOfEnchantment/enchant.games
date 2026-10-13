// The one script every page loads (scripts/build.js bundles it into public/js/site.js).
// The page arrives drawn; this makes moving to the next one instant (js/nav.js), brings its
// forms to life, shows Back to Top when there is somewhere to go back to, and offers a
// Reload when the site has moved on.
import { mountContactForms } from './contact.js';
import { mountSignupForms } from './signup.js';
import { startNav } from './nav.js';
import { watchVersion } from './version.js';

// What a page needs once it is on screen, after its load or after nav.js swaps it in.
function setUp() {
    mountContactForms(document);
    mountSignupForms(document);
    const top = document.querySelector('.back-to-top');
    if (top) top.classList.toggle('visible', document.documentElement.scrollHeight > window.innerHeight);
}

startNav(setUp);   // first, while the page is as it arrived
setUp();
watchVersion();
