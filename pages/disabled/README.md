Pages in this folder are disabled: the build only picks up `pages/*.yml`,
so they are not drawn, not in the sitemap, and not in the menu.

To restore one, move it back to `pages/` (it is served at `/<slug>/`), add its
slug to `MENU` in `scripts/build.js` if it belongs in the menu, and run
`make build`.
