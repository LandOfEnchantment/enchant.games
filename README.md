## Structure

- `pages/`               — site pages, YAML+markdown
- `news/`                — news articles, YAML+markdown
- `js/content-loader.js` - browser-side YAML+markdown headless backend
- `js/render.js`         - headless frontend

## Usage

Generate `pages.json` and `news.json` manifests:

    make build

Run locally:

    make run

This builds `pages.json` and `news.json` from the YAML directories, then starts a local server on port 3000.

## License

[Unlicense](UNLICENSE) - public domain.
