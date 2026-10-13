# This site's two widgets: the mailing list's (js/signup.js) and the Press page's contact
# form's (js/contact.js), each Worker holding its widget's secret as a Worker secret. Until
# 2026-10-12 the contact form used ../adamschaefers.com's widget and Worker; now each site
# has its own.

resource "cloudflare_turnstile_widget" "signup" {
  account_id      = var.account_id
  bot_fight_mode  = false
  clearance_level = "no_clearance"
  domains         = ["enchant.games"]
  ephemeral_id    = false
  mode            = "managed"
  name            = "enchant.games release signup"
  offlabel        = false
  region          = "world"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_turnstile_widget" "contact" {
  account_id      = var.account_id
  bot_fight_mode  = false
  clearance_level = "no_clearance"
  domains         = ["enchant.games"]
  ephemeral_id    = false
  mode            = "managed"
  name            = "enchant.games contact form"
  offlabel        = false
  region          = "world"

  lifecycle {
    prevent_destroy = true
  }
}
