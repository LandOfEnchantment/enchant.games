#!/usr/bin/env bash
# The enchant.games zone's cache settings, kept in git (2026-10-11, as ../merecatholicity.com
# keeps its in Terraform). Cloudflare proxies the site in front of GitHub Pages.
#
#   scripts/cloudflare-settings.sh check    say what differs from this file (read only)
#   scripts/cloudflare-settings.sh apply    make Cloudflare match it
#
# Needs CLOUDFLARE_API_TOKEN (an account token that can edit the zone's settings and cache
# rules; the same one deploy.yml purges with).
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
  "expression": "(http.request.uri.query contains \"v=\" and (ends_with(http.request.uri.path, \".js\") or ends_with(http.request.uri.path, \".css\") or ends_with(http.request.uri.path, \".ttf\") or ends_with(http.request.uri.path, \".webp\") or ends_with(http.request.uri.path, \".png\") or ends_with(http.request.uri.path, \".jpg\")))",
  "action": "set_cache_settings",
  "action_parameters": { "browser_ttl": { "mode": "override_origin", "default": 86400 } },
  "enabled": true
}'

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

if [ "$mode" = check ]; then
  [ "$drift" = 0 ] && echo "Cloudflare matches $0" || echo "Cloudflare differs: scripts/cloudflare-settings.sh apply"
  exit "$drift"
fi
cf PATCH /settings/browser_cache_ttl '{"value": 0}' >/dev/null && echo "set    browser cache ttl 0"
cf PUT /rulesets/phases/http_request_cache_settings/entrypoint "$(jq -c '{rules: [.]}' <<<"$rule")" >/dev/null && echo "set    cache rule"
echo "applied; scripts/cloudflare-settings.sh check reads it back"
