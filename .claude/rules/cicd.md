---
paths:
  - ".github/**"
  - "scripts/**"
  - "package.json"
  - "Makefile"
  - "js/assets.js"
  - "js/version.js"
---

# CI/CD

How a change reaches `master` and the live site (2026-10-11). The same road as ../adamschaefers.com (its `.claude/rules/cicd.md`): the merge is the deploy, CI is the build of record, no secret on a pull request, every deploy checks itself. Before it, GitHub Pages served `master`'s files as they were, a git pre-commit hook built the manifests into commits, and the libraries were vendored under `js/`.

## The road to master

- `master` takes no direct push: the ruleset `.github/rulesets/master.json` wants a pull request, `check` green (from GitHub Actions, app 15368, so a status of that name from anywhere else satisfies nothing), and one approval; a push dismisses a stale approval. No force push, no deletion. Not strict: a pull request need not be on the newest `master` (the merge's own check runs again before it deploys). No bypass actor.
- Auto-merge for the owner and the Claude sessions the owner drives, nobody else. `owner-merge.yml` (`pull_request_target`) approves a pull request whose author and event sender are user id 26800291 (a-schaefers), from this repository, not a draft, at the head it was woken for, then arms auto-merge if nobody has. Anyone else's (other people, other Claudes, Dependabot, forks) waits for the owner's approval by hand; so does the owner's own after someone else pushes to it, until the owner pushes again. A draft holds one back.
- `owner-merge.yml` must never run the pull request's code: no checkout, no `uses:`, nothing from the event in a shell but the number, the head hash, the repository and the token. `scripts/test_workflows.py` (in `make check`) holds it to that.
- Who arms auto-merge decides whether the merge deploys at once: a merge armed with the workflow's token is GitHub Actions' push, which starts no workflow. `scripts/ship.sh` arms it as the owner, so the merge is the owner's and `deploy.yml` runs on it; when `owner-merge.yml` armed it, `deploy.yml`'s hourly run deploys the merge instead.

## Shipping

- Commit on a branch (or in a worktree), then `scripts/ship.sh`: pushes `HEAD` to the branch (a detached `HEAD` ships as `agent/<worktree>`), opens the pull request or finds the open one, arms auto-merge as you with `--match-head-commit`, waits for the merge or names the failing check. It refuses to ship from `master`. `--draft` opens one that waits. A red check leaves auto-merge armed: fix, commit, run it again.
- Never commit `public/` or a manifest (`pages.json`, `news.json`, `rss.xml`, `sitemap.xml`): `make build` writes them, git ignores them, CI builds them.

## Workflows

- `check.yml`, the required check: `npm ci`, then `make check` (`scripts/build.js` builds `public/`; `scripts/check-dist.js` checks the manifests, every page's and article's title and slug, and every link and picture that points at the site itself; `scripts/test_workflows.py`), then uploads `public/` as the `github-pages` artifact. On every pull request, no secret, no path filter (never rename the job without the ruleset).
- `deploy.yml`, on every push to `master` (and hourly, and by hand): `check.yml` again on the merged commit, then in the `github-pages` environment (master only): `actions/deploy-pages` publishes that artifact (the job's OIDC token) and waits until GitHub says it is live; only then `scripts/purge.js` clears Cloudflare's copy of every address the build serves, bare and keyed (`CLOUDFLARE_API_TOKEN`, given to that step alone; a purge before the publish would refill the new keys with the old files); then `scripts/smoke.sh` asks with nonce probes (`?probe=<commit>-<attempt>-<random>`, an address no cache has seen) until the page shell, script, manifests and `version.json` are this build's. It never fetches a keyed address. Deploys never overlap and are never cancelled. The hourly run stops when the newest `github-pages` deployment is already `master`'s.
- `purge-cache.yml`, by hand only: empties Cloudflare's whole cache of the zone without a deploy (`scripts/purge.js --everything`), waiting for any running deploy.
- Every `uses:` names a commit with a `# vX.Y.Z` comment; `.github/dependabot.yml` bumps the action pins and the npm packages weekly, each pull request waiting for the owner.

## Cache busting

As in ../merecatholicity.com (2026-10-11). Every file a page asks for carries `?v=<the first 32 bits of its sha256, as a number>`, stamped by `scripts/build.js` in dependency order (fonts into `style.css`; manifests, pages, articles and pictures into the bundle through `js/assets.js`; the bundle, `style.css` and the icon into `index.html`). Content alone decides a key, so a rebuild changes nothing and nobody bumps one by hand; `scripts/check-dist.js` fails on any key that isn't its file's. Unkeyed on purpose: the pages, `version.json`, `rss.xml`, `sitemap.xml`. `version.json` (`{build, assets}`) names the keys `index.html` loads; `js/version.js` compares it, fetched no-store, with the keys the open page is running (read off its own `<script>`/`<link>` addresses), on returning to the tab and hourly, and offers Reload; it never reloads by itself, nor over a half-written form (`scripts/version.test.js`). Cloudflare: Browser Cache TTL respects the origin (GitHub's ten minutes), and keyed files get a day in the browser (`scripts/cloudflare-settings.sh check|apply`; it was 4 hours on everything before, which no purge could reach).

## Settings

- Kept in `scripts/github-settings.sh` (`check` names any drift; `apply` writes it, needs `gh` as admin): the ruleset; Actions may approve pull requests, default token read only; auto-merge, merge commits, delete branch on merge, update branch; only GitHub-owned and verified actions, each pinned to a commit; a fork's workflows wait for approval every time; secret scanning with push protection; Dependabot alerts and security fixes; GitHub Pages built by Actions at enchant.games, its `github-pages` environment deploying from `master` only and holding `CLOUDFLARE_API_TOKEN`; the zone id as the variable `CLOUDFLARE_ZONE_ID`.
- The token is the account-wide Cloudflare token ../merecatholicity.com's pipeline uses (`CLOUDFLARE_ROOT_TOKEN` in `~/.config/merecatholicity/ci.env`); a hobby account, one token. Rotating it there means `gh secret set CLOUDFLARE_API_TOKEN --env github-pages` here too.
- Actions may approve pull requests only because the owner is the one collaborator: anyone else with write access could approve their own pull request through a workflow on their branch. Revisit before granting anyone write access to LandOfEnchantment (dontNedd, the other member, has read). The organization's own setting must allow it too (2026-10-11: turned on; `github-settings.sh` checks and applies it).
- The emergency door: when `check` itself is broken and its fix cannot pass it, the owner sets the ruleset's enforcement to disabled (Settings, Rules, or the JSON's `"enforcement"` and `apply`), merges the fix, and sets it back (`check` shows the drift if forgotten). Never a bypass actor.

## Done by hand, on purpose

- Cloudflare proxies enchant.games in front of GitHub Pages (DNS, TLS). Its cache settings are `scripts/cloudflare-settings.sh`'s, not clicked.
- The release signup Worker, `enchant-games-signup` (`signup-worker/`, routed at `enchant.games/api/signup`; 2026-10-12): `make signup-deploy` applies its D1 migrations and deploys it, by hand, with the same token. CI only runs its tests (`make test`); a merge doesn't deploy it, so deploy a change to it before (or with) the pages that need it. Its `TURNSTILE_SECRET` belongs to the Turnstile widget "enchant.games release signup" (enchant.games only); the database `enchant-games-signups` holds the addresses and nothing reads them.
