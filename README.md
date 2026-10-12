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

## License

[Unlicense](UNLICENSE) - public domain.
