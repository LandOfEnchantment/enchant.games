# Cloudflare Web Analytics for the zone: OFF (the owner, 2026-10-12). The privacy policy says
# this website has no analytics, so the edge must never inject the beacon. Its injection rule
# was already paused; automatic install was still on, so a click could have woken it.

resource "cloudflare_web_analytics_site" "main" {
  account_id   = var.account_id
  auto_install = false
  enabled      = null
  host         = null
  lite         = null
  zone_tag     = var.zone_id
}
