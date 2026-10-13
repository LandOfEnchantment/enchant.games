# The mailing list's widget (js/signup.js; signup-worker/ holds its secret as a Worker
# secret). The contact form on the Press page uses the "adamschaefers contact form" widget,
# which ../adamschaefers.com's Terraform owns: its domains name enchant.games too.

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
