.PHONY: build run check check-dist test signup-deploy contact-deploy old-links

# public/, exactly what the site serves (scripts/build.js: the static files, the YAML pages and
# articles, the bundled script and the manifests). Never committed: CI builds and deploys it.
build:
	node scripts/build.js

# public/ at http://localhost:3000, answered as GitHub Pages answers (an unknown address
# gets 404.html).
run: build
	python3 serve.py

# What CI's required check runs: the build, every link and cache key on it, the update
# offer's rules, the two Workers (offline), the workflows' rules.
check: build check-dist test

check-dist:
	node scripts/check-dist.js

test:
	node --test scripts/*.test.js signup-worker/test/*.test.js contact-worker/test/*.test.js
	python3 scripts/test_workflows.py

# Every address the site has ever had (the git history's slugs, old and new forms), opened
# in a real browser (~/.cloakbrowser) against the live site: each must land on a live page.
# By hand, after a deploy that moves or retires anything. URL=http://localhost:3000 for make run.
old-links:
	python3 -I scripts/browse-old-links.py $(or $(URL),https://enchant.games)

# The Games page's release signup Worker (signup-worker/), by hand, never from CI: its table
# migrations, then its code. Needs CLOUDFLARE_API_TOKEN. Its one secret, TURNSTILE_SECRET,
# is set apart (cd signup-worker && npx wrangler secret put TURNSTILE_SECRET).
signup-deploy:
	cd signup-worker && npm ci && npx wrangler d1 migrations apply enchant-games-signups --remote && npx wrangler deploy

# The Press page's contact form Worker (contact-worker/), by hand, never from CI. Needs
# CLOUDFLARE_API_TOKEN. Its one secret, TURNSTILE_SECRET, is set apart
# (cd contact-worker && npx wrangler secret put TURNSTILE_SECRET).
contact-deploy:
	cd contact-worker && npm ci && npx wrangler deploy
