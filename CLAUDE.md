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

Every change reaches `master` through a pull request (`scripts/ship.sh`), and
the merge is the deploy: `.claude/rules/cicd.md` is the pipeline.
