# CLAUDE.md

The site is the YAML pages (`pages/`) and journal articles (`news/`), each of
which `scripts/build.js` draws into its own HTML file (`layout.html` around
the markdown) at its own address: `/` for home, `/<slug>/` for a page,
`/journal/` and `/journal/<slug>/`, and `/404.html`. What sits in a
`disabled/` folder isn't served, and its old address must forward somewhere:
`redirects.yml` maps each retired address to a live one (the build fails on a
disabled page without an entry; add one too when deleting a page or article).
The browser gets the page it asked for whole; then its one script
(`js/site.js`) fetches every other page in the background (`js/nav.js`) and
swaps them in place on a click, so moving around is instant.
`README.md` covers the layout and the make targets. After editing, build and
look with:

    make build      # or make run: http://localhost:3000, rebuilt on save

`make run` (`scripts/dev.js`) serves `public/` the way GitHub Pages does, builds
it again on every save in the sources, and reloads every open page over a
WebSocket (`/__dev`) whose script the dev server adds to the pages it answers;
it is never in `public/`, so never on the site. A failed build shows its error
over the page. `PORT=` changes the port.

`public/` (every page, `rss.xml`, `sitemap.xml`, `version.json`) is build
output: git ignores it, and CI builds and deploys it on every merge. marked,
js-yaml, esbuild and the font (`firacode`) come from npm (`package.json`,
pinned, with its lockfile); nothing is vendored. Link a page as `/<slug>/` and
an article as `/journal/<slug>/` (with the slash); `make check` fails on a
link that leads nowhere in `public/`, and on an old `/?slug=` address. Those
old addresses still work for visitors: Cloudflare 301s them
(`terraform/rulesets.tf`), and the home page sends on any it misses.
After a deploy that moves or retires anything, `make old-links` opens every
address the site has ever had (from the git history) in a real browser
(`~/.cloakbrowser`) against the live site; each must land on a live page.

Every file a page asks for carries a cache key, `?v=<number from its
content>`, stamped by the build (`scripts/build.js`); never write or bump one
by hand. In markup (`layout.html`, a page, an article) write the bare address
(`/images/x.webp`); the build keys every local `src=`/`href=` it draws.
`version.json` names the keys the pages load, and `js/version.js` offers an
open tab "Reload" when they've moved on. Each deploy purges Cloudflare's
copy of the site after GitHub Pages publishes. When checking the live site,
add a throwaway query (`?probe=$RANDOM`) and never fetch a fresh `?v=` address
during a deploy: it could cache the old file under the new key.

Every change reaches `master` through a pull request (`scripts/ship.sh`), and
the merge is the deploy: `.claude/rules/cicd.md` is the pipeline. The
repository's GitHub settings and the zone's Cloudflare configuration are
Terraform (`terraform/`, its README): change them there, never by hand; the
merge plans in CI and applies after the owner's review.
