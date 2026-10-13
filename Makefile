.PHONY: build run check check-dist test signup-deploy

# public/, exactly what the site serves (scripts/build.js: the static files, the YAML pages and
# articles, the bundled script and the manifests). Never committed: CI builds and deploys it.
build:
	node scripts/build.js

# public/ at http://localhost:3000, unknown paths falling back to index.html.
run: build
	python3 serve.py

# What CI's required check runs: the build, every link and cache key on it, the update
# offer's rules, the signup Worker (offline), the workflows' rules.
check: build check-dist test

check-dist:
	node scripts/check-dist.js

test:
	node --test scripts/*.test.js signup-worker/test/*.test.js
	python3 scripts/test_workflows.py

# The Games page's release signup Worker (signup-worker/), by hand, never from CI: its table
# migrations, then its code. Needs CLOUDFLARE_API_TOKEN. Its one secret, TURNSTILE_SECRET,
# is set apart (cd signup-worker && npx wrangler secret put TURNSTILE_SECRET).
signup-deploy:
	cd signup-worker && npm ci && npx wrangler d1 migrations apply enchant-games-signups --remote && npx wrangler deploy
