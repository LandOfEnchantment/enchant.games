A static website with headless backend decoupling

## Structure

- `pages/`               - site pages, YAML files with markdown
- `news/`                - news articles, YAML files with markdown
- `js/content-loader.js` - YAML+markdown processor / simulated headless backend / technically frontend
- `js/render.js`         - SPA shell / client-side router / frontend renderer
- `pages.json`           - page manifest
- `news.json`            - news manifest

## Usage

Generate `pages.json` and `news.json` manifests:

    make build

Run locally:

    make run

This builds `pages.json` and `news.json` from the YAML directories, then starts a local server on port 3000.

## License

[Unlicense](UNLICENSE) - public domain.
