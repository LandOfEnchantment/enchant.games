# The enchant.games zone, the settings whose values are deliberate, and bot management.
# Settings not listed here stay unmanaged and undisturbed.

resource "cloudflare_zone" "main" {
  account = {
    id = var.account_id
  }
  name                = "enchant.games"
  paused              = false
  type                = "full"
  vanity_name_servers = []

  lifecycle {
    prevent_destroy = true
  }
}

# ssl=full, not strict: the origin is GitHub Pages, which Cloudflare reaches on its own name.

resource "cloudflare_zone_setting" "ssl" {
  setting_id = "ssl"
  value      = "full"
  zone_id    = var.zone_id
}

resource "cloudflare_zone_setting" "always_use_https" {
  setting_id = "always_use_https"
  value      = "on"
  zone_id    = var.zone_id
}

# Browser Cache TTL 0, "respect existing headers" (2026-10-11): Cloudflare's default, 4 hours,
# overrode GitHub Pages' ten minutes on every file, and no purge reaches a browser. The ?v=
# keyed files get their day from the cache rule in rulesets.tf instead.

resource "cloudflare_zone_setting" "browser_cache_ttl" {
  setting_id = "browser_cache_ttl"
  value      = 0
  zone_id    = var.zone_id
}

resource "cloudflare_bot_management" "main" {
  ai_bots_protection      = "disabled"
  content_bots_protection = "disabled"
  crawler_protection      = "enabled"
  enable_js               = false
  fight_mode              = false
  is_robots_txt_managed   = false
  zone_id                 = var.zone_id
}
