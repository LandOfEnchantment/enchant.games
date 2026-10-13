#!/usr/bin/env bash
# The enchant.games zone's cache settings, kept in git (2026-10-11, as ../merecatholicity.com
# keeps its in Terraform). Cloudflare proxies the site in front of GitHub Pages.
#
#   scripts/cloudflare-settings.sh check    say what differs from this file (read only)
#   scripts/cloudflare-settings.sh apply    make Cloudflare match it
#
# Needs CLOUDFLARE_API_TOKEN (an account token that can edit the zone's settings, cache
# rules and redirect rules; the same one deploy.yml purges with).
#
# What it holds:
#   - Browser Cache TTL: respect the origin's headers (0). Cloudflare's default, 4 hours,
#     overrode GitHub Pages' max-age=600 on every script, style and picture, so a returning
#     visitor's browser kept an old render.js for hours after a deploy, and no purge reaches
#     a browser. Unkeyed files now live ten minutes, as GitHub says.
#   - One cache rule: a keyed address (?v=<its content's key>, scripts/build.js) is kept by
#     browsers for a day, since its address changes whenever its bytes do. A day, not a
#     year and not immutable: a browser cache can't be purged, so a key that ever went wrong
#     must expire on its own. Never the pages, version.json, the feed or the sitemap. The
#     edge keeps GitHub's ten minutes; deploy.yml purges it.
#   - The old addresses, 301'd to the pages' own (2026-10-12, when the build began drawing
#     every page at its address): /?slug=<page> to /<page>/, /?slug=home to /, /?slug=journal
#     (or news) to /journal/, and /?slug=journal&article=<slug> to /journal/<slug>/. What
#     these miss (an article named with its .yml, which the old site forgave) lands on the
#     home page, whose head sends it on (scripts/build.js). www already 301s to the bare
#     domain with its query, so these see it too.
set -euo pipefail

zone=efb09cd72ebf216e31b520d204b8f54c   # enchant.games (an id, not a secret)
api=https://api.cloudflare.com/client/v4/zones/$zone
mode=${1:-}
case "$mode" in
  check|apply) ;;
  *) sed -n '2,9p' "$0"; exit 64 ;;
esac
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
cf() { curl -fsS -X "$1" "$api$2" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' ${3:+--data "$3"}; }

rule='{
  "description": "Keyed scripts, styles, fonts and pictures (?v=<content key>, scripts/build.js): a day in the browser. Never a page, version.json, the feed or the sitemap.",
  "expression": "(http.request.uri.query contains \"v=\" and (ends_with(http.request.uri.path, \".js\") or ends_with(http.request.uri.path, \".css\") or ends_with(http.request.uri.path, \".woff2\") or ends_with(http.request.uri.path, \".webp\") or ends_with(http.request.uri.path, \".png\") or ends_with(http.request.uri.path, \".jpg\")))",
  "action": "set_cache_settings",
  "action_parameters": { "browser_ttl": { "mode": "override_origin", "default": 86400 } },
  "enabled": true
}'

slug='http.request.uri.args["slug"]'
article='http.request.uri.args["article"]'
old='http.host eq "enchant.games" and http.request.uri.path eq "/"'
journal="any($slug[*] in {\"journal\" \"news\"})"
redirect() {  # description, expression, value|expression, the target URL or an expression making it
  jq -n --arg d "$1" --arg e "$2" --arg k "$3" --arg t "$4" '{description: $d, expression: $e, action: "redirect",
    action_parameters: {from_value: {status_code: 301, preserve_query_string: false, target_url: {($k): $t}}}, enabled: true}'
}
redirects=$(jq -s . <<<"$(
  redirect "An old article address (/?slug=journal&article=<slug>) to /journal/<slug>/" \
    "$old and $journal and len($article[0]) gt 0 and not ends_with($article[0], \".yml\")" \
    expression "concat(\"https://enchant.games/journal/\", $article[0], \"/\")"
  redirect "The old journal address (/?slug=journal, or news) to /journal/" \
    "$old and $journal and not len($article) ge 0" value https://enchant.games/journal/
  redirect "The old home address (/?slug=home) to /" \
    "$old and any($slug[*] eq \"home\")" value https://enchant.games/
  redirect "An old page address (/?slug=<page>) to /<page>/" \
    "$old and len($slug[0]) gt 0 and not any($slug[*] in {\"home\" \"journal\" \"news\"})" \
    expression "concat(\"https://enchant.games/\", $slug[0], \"/\")"
)")

drift=0
ttl=$(cf GET /settings/browser_cache_ttl | jq .result.value)
if [ "$ttl" = 0 ]; then echo "ok     browser cache ttl: respect the origin"
else echo "DRIFT  browser cache ttl is $ttl, not 0 (respect the origin)"; drift=1; fi

# The zone's one ruleset in the cache settings phase (none until the first apply).
entry=$(curl -sS "$api/rulesets/phases/http_request_cache_settings/entrypoint" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
want=$(jq -cS '{description, expression, action, action_parameters, enabled}' <<<"$rule")
have=$(jq -cS '[.result.rules[]? | {description, expression, action, action_parameters, enabled}]' <<<"$entry")
if [ "$have" = "[$want]" ]; then echo "ok     cache rule: keyed files a day in the browser"
else echo "DRIFT  cache rules"; echo "       want [$want]"; echo "       have $have"; drift=1; fi

# The zone's one ruleset in the redirect phase.
entry=$(curl -sS "$api/rulesets/phases/http_request_dynamic_redirect/entrypoint" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
want=$(jq -cS '[.[] | {description, expression, action, action_parameters, enabled}]' <<<"$redirects")
have=$(jq -cS '[.result.rules[]? | {description, expression, action, action_parameters, enabled}]' <<<"$entry")
if [ "$have" = "$want" ]; then echo "ok     redirect rules: the old ?slug= addresses 301 to the pages' own"
else echo "DRIFT  redirect rules"; echo "       want $want"; echo "       have $have"; drift=1; fi

if [ "$mode" = check ]; then
  [ "$drift" = 0 ] && echo "Cloudflare matches $0" || echo "Cloudflare differs: scripts/cloudflare-settings.sh apply"
  exit "$drift"
fi
cf PATCH /settings/browser_cache_ttl '{"value": 0}' >/dev/null && echo "set    browser cache ttl 0"
cf PUT /rulesets/phases/http_request_cache_settings/entrypoint "$(jq -c '{rules: [.]}' <<<"$rule")" >/dev/null && echo "set    cache rule"
cf PUT /rulesets/phases/http_request_dynamic_redirect/entrypoint "$(jq -c '{rules: .}' <<<"$redirects")" >/dev/null && echo "set    redirect rules"
echo "applied; scripts/cloudflare-settings.sh check reads it back"
