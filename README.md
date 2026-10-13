A static website with headless backend decoupling

## Structure

- `pages/`               - site pages, YAML files with markdown
- `news/`                - news articles, YAML files with markdown
- `js/content-loader.js` - YAML+markdown processor / simulated headless backend / technically frontend
- `js/render.js`         - SPA shell / client-side router / frontend renderer
- `scripts/build.js`     - builds `public/`: the bundled script, the pages, the `pages.json`, `news.json`, `rss.xml` and `sitemap.xml` manifests, and a `?v=` cache key on every file a page asks for
- `js/version.js`        - offers an open tab "Reload" when a newer version of the site is live

## Usage

Install the pinned libraries and toolchain (Node 24):

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

## Release signup

The Games page asks visitors for an email address to hear when a game is out
(`js/signup.js`). It posts to a Cloudflare Worker at `enchant.games/api/signup`
(`signup-worker/`), which checks Turnstile and stores the address in the D1
database `enchant-games-signups` (table `signups`: `email`, `created_at`). It
sends nothing to anyone, and nothing on the site reads the list back.

The Worker is deployed by hand, not by CI (needs `CLOUDFLARE_API_TOKEN`):

    make signup-deploy

Its Turnstile secret is a Worker secret, set once:
`cd signup-worker && npx wrangler secret put TURNSTILE_SECRET`. To look at the
list:

    cd signup-worker && npx wrangler d1 execute enchant-games-signups --remote \
      --command "SELECT * FROM signups ORDER BY created_at"

## License

[Unlicense](UNLICENSE) - public domain.
