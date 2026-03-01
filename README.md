A static website with headless backend decoupling

## Structure

- `pages/`               - site pages, YAML files with markdown
- `news/`                - news articles, YAML files with markdown
- `js/content-loader.js` - YAML+markdown processor / simulated headless backend / technically frontend
- `js/render.js`         - SPA shell / client-side router / frontend renderer

## Usage

Generate `pages.json`, `news.json`, `rss.xml` and `sitemap.xml` manifests:

    make build

Run locally:

    make run

Install the git hook to auto-build manifests on commit:

    cp scripts/pre-commit .git/hooks/pre-commit

## License

[Unlicense](UNLICENSE) - public domain.
