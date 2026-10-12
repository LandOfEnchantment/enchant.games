#!/bin/sh
# After a deploy (and the purge), ask the live site what a visitor gets: this build's page
# shell, version.json and manifests, and a page, the feed and the sitemap answering. Run by
# deploy.yml; anyone can run it after make build (it compares against public/).
#
# Every request carries a nonce, ?probe=<commit>-<attempt>-<random>, an address no cache
# has seen, so the answer is the origin's. And it never asks for a keyed address
# (style.css?v=N): fetched while GitHub Pages is still publishing, the old file would be
# cached under the new key (as ../merecatholicity.com learned); the shell carrying this
# build's keys is the proof that those files are live.
set -eu
cd "$(dirname "$0")/.."
site=https://enchant.games
nonce="${GITHUB_SHA:-local}-${GITHUB_RUN_ATTEMPT:-0}-$(od -An -N4 -tu4 /dev/urandom | tr -d ' ')"
fail() { echo "smoke: $*" >&2; exit 1; }
sum() { sha256sum | cut -d' ' -f1; }

# The page shell is judged by the keyed addresses it loads, not its bytes: Cloudflare
# writes a hidden link of its own into every page it serves (its AI Labyrinth).
fingerprint() {
  if [ "$1" = index.html ]; then grep -o '\(src\|href\)="[^"]*?v=[0-9]*"' | sort | sum; else sum; fi
}

# GitHub Pages reaches every edge within a minute or two of publishing; give it five.
for f in index.html version.json news.json pages.json js/render.js; do
  want=$(fingerprint "$f" < "public/$f")
  for i in $(seq 1 30); do
    got=$(curl -fsS "$site/$f?probe=$nonce-$i" | fingerprint "$f" || true)
    [ "$got" = "$want" ] && break
    [ "$i" = 30 ] && fail "/$f is not this build's"
    sleep 10
  done
done

for path in "/?slug=press&" "/rss.xml?" "/sitemap.xml?"; do
  curl -fsS -o /dev/null "$site${path}probe=$nonce" || fail "$path doesn't answer"
done
build=$(sed 's/.*"build":"\([0-9a-f]*\)".*/\1/' public/version.json)
echo "smoke: ok (build $build is live: its page, script, manifests and version.json; a page, the feed and the sitemap answer)"
