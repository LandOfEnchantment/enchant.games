# Terraform: the durable infrastructure

The parts of enchant.games that outlive a deploy, as code: the GitHub repository's
settings and the Cloudflare zone's configuration. The same system as
../merecatholicity.com's `terraform/` (its README is the long form) and
../adamschaefers.com's. It is adoption-only: everything here already existed and was
imported on 2026-10-12. Terraform did not create the site.

## What Terraform owns, and what it must not touch

**Terraform owns** (`terraform state list`, 42 resources): the zone, its three deliberate
settings (SSL full, Always Use HTTPS, Browser Cache TTL 0) and bot management; all 16 DNS
records; the two rulesets (the cache rule that keeps keyed files a day in browsers, the
redirects that 301 the old `?slug=` addresses); the two Turnstile widgets (the mailing
list's and the contact form's) and the mailing list's D1 database *as records that they
exist*; the zone's Web Analytics site (beacon
injection off: the privacy policy says no analytics); this state's own R2 bucket and its
r2.dev switch (off); and on GitHub the repository, master's ruleset, the workflow token's
rights (and the LandOfEnchantment organization's, which must allow them first), the
allowed actions, Dependabot alerts and fixes, GitHub Pages, the `github-pages` and
`terraform-production` environments, and the zone id variable.

**wrangler owns** the two Workers (`signup-worker/`, `contact-worker/`): their scripts,
routes, bindings, vars, secrets and D1 migrations. `wrangler deploy` rewrites those on every
deploy; were Terraform to declare them too, the two would fight forever. **deploy.yml
owns** what GitHub Pages serves and Cloudflare's cached copy of it.

**No other project's Terraform owns anything here, and this one owns nothing of
theirs.** The three sites share one Cloudflare account and one owner on GitHub, so this
is the line that keeps an apply in one from becoming drift in another:

- ../merecatholicity.com's: its zone, its repositories, and its own buckets, databases
  and widgets.
- ../adamschaefers.com's: its zone, its repositories, and its own objects. Until
  2026-10-12 the Press page's contact form used its widget and Worker; now this site has
  its own (`contact-worker/`, the widget "enchant.games contact form"), and nothing of one
  site serves the other.
- Nobody's: the account itself, its API tokens, its Email Routing destination address,
  its Zero Trust organization, and every zone and widget of the account's other sites.

Before adopting anything account-wide (a widget, a bucket, a database), make sure no other
project's state holds it (`terraform state list` there).

## Running from CI

`.github/workflows/terraform.yml`, as merecatholicity.com's: every pull request gets
`fmt` and an offline `validate` with no credentials; a merge that changes `terraform/`
(or a run by hand) plans with them, and when the plan has changes, `apply` waits on the
`terraform-production` environment for the owner's review: *Review deployments* on the
run, or `scripts/ci_approve.sh <run-id> --approve`, the same API call. An "Approval
needed" issue names the wait (`scripts/ci_ask_review.sh`), because GitHub tells nobody of
their own run.

This repository is public, so its logs and artifacts are: the workflow never prints a plan
or an apply (both go to files on the runner; a failure shows only its `Error:` lines),
never uploads the plan file (it embeds the prior state), and shows reviewers only
`scripts/tf_plan_summary.py`'s summary: addresses, actions, changed attribute names, and
values only where the provider does not mark them sensitive. It refuses a plan that
destroys or replaces unless run by hand with `allow_destroy=true`, and the apply job
re-plans and refuses if the plan differs from the one reviewed. `scripts/test_workflows.py`
holds the workflow to all of that.

**No pull request ever sees a secret**: a PR's HCL is what `plan` evaluates, and a data
source in it could read the tokens before any gate. Every secret reference is blanked on a
`pull_request` event in its own expression, and a fork's run waits for the owner first.

**Secrets** (repository Actions secrets, set by hand; never managed here):

- `CLOUDFLARE_ROOT_TOKEN`: the account token the three sites share (the owner's choice,
  2026-10-11: one hobby account, one token). Its value is `CLOUDFLARE_ROOT_TOKEN` in
  `~/.config/merecatholicity/ci.env`, and also this repository's `github-pages`
  environment secret `CLOUDFLARE_API_TOKEN` (deploy.yml's purge). The state backend's S3
  pair is derived from it on every run (key = the token's id, secret = SHA-256 of its
  value), so a rotation carries the backend along. Rotate: the new value into `ci.env`,
  then `gh secret set CLOUDFLARE_ROOT_TOKEN` here and in ../adamschaefers.com, and
  `gh secret set CLOUDFLARE_API_TOKEN --env github-pages` here.
- `GH_ROOT_TOKEN`: a classic personal access token, minted by the owner on 2026-10-12, no
  expiry, shared with ../adamschaefers.com's pipeline; its copy is
  `~/.config/hobby/github-token`. merecatholicity.com keeps its own. Rotate: a new token
  into that file, then `gh secret set GH_ROOT_TOKEN < ~/.config/hobby/github-token` in
  both repositories.

## What Terraform cannot hold

- **A fork's workflows waiting for approval every time** (`all_external_contributors`):
  the GitHub provider has no resource for it. It is set, and stays set by hand:
  `gh api -X PUT repos/LandOfEnchantment/enchant.games/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors`.
- **Email Routing's settings object**: provider 5.24.0 cannot read it (merecatholicity.com's
  README has the error). The records it depends on (three MX, SPF, DKIM, DMARC) are here.
- **The state bucket's r2.dev switch cannot be imported**: it was adopted by a create,
  which is a PUT of the switch to the value it already had.

## State

In R2 at `enchant-games-tfstate/enchant.games/terraform.tfstate`. The bucket was made by
hand before the first `init` (a backend cannot create its own store) and is imported here
with `prevent_destroy`; were it ever lost, make it by hand again, then `init` and import.
**State is secret**: it holds the Turnstile widget's secret. `.gitignore` keeps every
`*.tfstate*`, plan and generated file out of git; do not defeat it.

## Working here

```sh
export CLOUDFLARE_API_TOKEN=…                      # ci.env's CLOUDFLARE_ROOT_TOKEN
export GITHUB_TOKEN=$(cat ~/.config/hobby/github-token)
export AWS_ACCESS_KEY_ID=$(curl -fsS https://api.cloudflare.com/client/v4/accounts/6093bc0889c95a08f0a92a8df6750c66/tokens/verify \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq -r .result.id)
export AWS_SECRET_ACCESS_KEY=$(printf %s "$CLOUDFLARE_API_TOKEN" | sha256sum | cut -d' ' -f1)
terraform -chdir=terraform init
terraform -chdir=terraform plan          # expect: No changes
```

A change is a pull request like any other: edit, plan locally, ship; the merge's run plans
again and waits for the owner's review before it applies. Adopting something that exists:
an import block in `imports.tf` with its live id, `plan -generate-config-out=generated.tf`,
fold that into the topic file, delete it, and plan until only the import remains.

**Never apply a plan that shows a destroy or a replace.** A replaced D1 database is the
mailing list, gone; a replaced bucket is this state, gone.
