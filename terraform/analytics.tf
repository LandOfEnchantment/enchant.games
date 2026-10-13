# Cloudflare Web Analytics for the zone. The privacy policy says this website has no
# analytics; the site's beacon injection is off.

resource "cloudflare_web_analytics_site" "main" {
  account_id   = var.account_id
  auto_install = true
  enabled      = null
  host         = null
  lite         = null
  zone_tag     = var.zone_id
}
