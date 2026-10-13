A static website with headless backend decoupling

## Structure

- `pages/`           - site pages, YAML files with markdown, each served at `/<slug>/` (home at `/`)
- `news/`            - journal articles, YAML files with markdown, each served at `/journal/<slug>/`
- `layout.html`      - the frame every page is drawn into: head, header, menu, footer
- `scripts/build.js` - builds `public/`: every page and article as its own HTML file, the journal, `rss.xml`, `sitemap.xml`, the font from npm, `js/site.js` bundled, and a `?v=` cache key on every file a page asks for
- `js/site.js`       - the one script a page loads: the contact and signup forms (`js/contact.js`, `js/signup.js`) and the update offer (`js/version.js`)

Everything is drawn once, at build time (in CI on every merge), so a visitor
gets the whole page in the first answer and nothing is fetched to draw it.
The old addresses (`/?slug=games`, `/?slug=journal&article=<slug>`) 301 to the
new ones.

## Usage

Install the pinned build tools and font (Node 24):

    npm ci

Build `public/` (what the site serves; never committed):

    make build

Run locally at http://localhost:3000:

    make run

Check it the way CI does:

    make check

## Shipping

`master` takes pull requests only, and the merge is the deploy: CI builds the
site and publishes it to GitHub Pages. Commit on a branch, then:

    scripts/ship.sh

See `.claude/rules/cicd.md` for the whole pipeline.

## Mailing list

The Games page asks visitors for an email address, with a box they must tick
agreeing to emails about our games, release announcements and sales promotions
included (`js/signup.js`). It posts to a Cloudflare Worker at
`enchant.games/api/signup` (`signup-worker/`), which wants the box ticked,
checks Turnstile and stores the address in the D1 database
`enchant-games-signups` (table `signups`: `email`, `created_at`, `consent`).
It sends nothing to anyone, and nothing on the site reads the list back.

`consent` is the wording an address agreed to
(`signup-worker/migrations/0002_consent.sql`): `games-and-sales` for the
checkbox, `releases` for the few who signed up before it, when the form
promised release announcements only. Send those no promotions. Every
marketing email needs a way to unsubscribe (the privacy policy promises one,
and the law wants it).

The Worker is deployed by hand, not by CI (needs `CLOUDFLARE_API_TOKEN`):

    make signup-deploy

Its Turnstile secret is a Worker secret, set once:
`cd signup-worker && npx wrangler secret put TURNSTILE_SECRET`. To look at the
list:

    cd signup-worker && npx wrangler d1 execute enchant-games-signups --remote \
      --command "SELECT * FROM signups ORDER BY created_at"

## License

[Unlicense](UNLICENSE) - public domain.
