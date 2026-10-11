#!/bin/sh
# After a deploy, ask the live site what a visitor gets: this build's script and manifests,
# the page shell at / and at a ?slug= address, the feed and the sitemap. Run by deploy.yml
# after every deploy; anyone can run it after make build (it compares against public/).
# Every request names this build in its query, so no cache answers with an older file.
set -eu
cd "$(dirname "$0")/.."
site=https://enchant.games
v=${GITHUB_SHA:-$(date +%s)}
fail() { echo "smoke: $*" >&2; exit 1; }
sum() { sha256sum | cut -d' ' -f1; }

# A new GitHub Pages deployment reaches every edge within a minute or two; give it five.
for f in js/render.js news.json pages.json; do
  want=$(sum < "public/$f")
  for i in $(seq 1 30); do
    got=$(curl -fsS "$site/$f?smoke=$v" | sum || true)
    [ "$got" = "$want" ] && break
    [ "$i" = 30 ] && fail "/$f is not this build's"
    sleep 10
  done
done

for path in "/?slug=press&" "/rss.xml?" "/sitemap.xml?"; do
  curl -fsS -o /dev/null "$site${path}smoke=$v" || fail "$path doesn't answer"
done
curl -fsS "$site/?smoke=$v" | grep -q '/js/render.js' || fail "/ isn't the site's page"
echo "smoke: ok (this build's script and manifests are live; /, a page, the feed and the sitemap answer)"
