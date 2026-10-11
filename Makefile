.PHONY: build run check check-dist test

# public/, exactly what the site serves (scripts/build.js: the static files, the YAML pages and
# articles, the bundled script and the manifests). Never committed: CI builds and deploys it.
build:
	node scripts/build.js

# public/ at http://localhost:3000, unknown paths falling back to index.html.
run: build
	python3 serve.py

# What CI's required check runs: the build, every link on it, the workflows' rules.
check: build check-dist test

check-dist:
	node scripts/check-dist.js

test:
	python3 scripts/test_workflows.py
