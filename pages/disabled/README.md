Pages in this folder are disabled: the build only picks up `pages/*.yml`,
so they are not in `pages.json`, the sitemap, or the nav.

To restore one, move it back to `pages/`, add its slug to `menuOrder` in
`js/render.js`, and run `make build`.
