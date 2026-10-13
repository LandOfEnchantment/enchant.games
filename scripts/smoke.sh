#!/bin/sh
# After a deploy (and the purge), ask the live site what a visitor gets: this build's home
# page, journal, script and version.json; a page, an article, the feed and the sitemap
# answering; an unknown address answering 404; and an old ?slug= address 301ing to its
# page's own. Run by deploy.yml; anyone can run it after make build (it compares against
# public/).
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

# A page is judged by its title and the keyed addresses it loads, not its bytes: Cloudflare
# writes a hidden link of its own into every page it serves (its AI Labyrinth).
fingerprint() {
  case "$1" in
    *.html) grep -o '<title>[^<]*</title>\|\(src\|href\)="[^"]*?v=[0-9]*"' | sort | sum ;;
    *) sum ;;
  esac
}

# GitHub Pages reaches every edge within a minute or two of publishing; give it five.
for f in index.html journal/index.html version.json js/site.js; do
  want=$(fingerprint "$f" < "public/$f")
  for i in $(seq 1 30); do
    got=$(curl -fsS "$site/${f%index.html}?probe=$nonce-$i" | fingerprint "$f" || true)
    [ "$got" = "$want" ] && break
    [ "$i" = 30 ] && fail "/$f is not this build's"
    sleep 10
  done
done

article=$(ls public/journal | grep -v '^index.html$' | head -1)
for path in /press/ "/journal/$article/" /rss.xml /sitemap.xml; do
  curl -fsS -o /dev/null "$site$path?probe=$nonce" || fail "$path doesn't answer"
done
code=$(curl -sS -o /dev/null -w '%{http_code}' "$site/no-such-page-$nonce/")
[ "$code" = 404 ] || fail "an unknown address answered $code, not 404"
# The old addresses: Cloudflare's redirect rules (scripts/cloudflare-settings.sh).
for pair in "slug=press /press/" "slug=journal /journal/" "slug=journal&article=$article /journal/$article/"; do
  to=$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' "$site/?${pair% *}&probe=$nonce")
  [ "$to" = "301 $site${pair#* }" ] || fail "/?${pair% *} answered \"$to\", not a 301 to ${pair#* }"
done
build=$(sed 's/.*"build":"\([0-9a-f]*\)".*/\1/' public/version.json)
echo "smoke: ok (build $build is live: its pages, script and version.json; a page, an article, the feed and the sitemap answer, a stranger gets 404, and the old addresses 301 to the new)"
