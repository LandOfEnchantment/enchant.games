# CLAUDE.md

The site is `index.html` plus the YAML pages (`pages/`) and journal articles
(`news/`) that `js/render.js` renders in the browser; what sits in a
`disabled/` folder isn't served. `README.md` covers the layout and the make
targets. After editing, build and look with:

    make build      # make run serves public/ at http://localhost:3000

`public/` and the manifests in it (`pages.json`, `news.json`, `rss.xml`,
`sitemap.xml`) are build output: git ignores them, and CI builds and deploys
them on every merge. lit-html, marked and js-yaml come from npm
(`package.json`, pinned) and esbuild bundles them into `public/js/render.js`;
nothing is vendored. Link a page as `/?slug=<slug>` and an article as
`/?slug=journal&article=<slug>`; `make check` fails on a link to either that
doesn't exist, or to a file that isn't in `public/`.

Every file a page asks for carries a cache key, `?v=<number from its
content>`, stamped by the build (`scripts/build.js`); never write or bump one
by hand. In markup the build serves, write the bare address (`/images/x.webp`);
a page's or article's local `src=`/`href=` is keyed as it renders
(`js/assets.js`), and anything `js/` fetches goes through `asset()`.
`version.json` names the keys `index.html` loads, and `js/version.js` offers
an open tab "Reload" when they've moved on. Each deploy purges Cloudflare's
copy of the site after GitHub Pages publishes. When checking the live site,
add a throwaway query (`?probe=$RANDOM`) and never fetch a fresh `?v=` address
during a deploy: it could cache the old file under the new key.

Every change reaches `master` through a pull request (`scripts/ship.sh`), and
the merge is the deploy: `.claude/rules/cicd.md` is the pipeline.
