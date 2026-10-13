# The mailing list's database, as a record that it exists. Its tables are the Worker's
# migrations (signup-worker/migrations, wrangler), its rows nobody's but the list's.

resource "cloudflare_d1_database" "signups" {
  account_id            = var.account_id
  jurisdiction          = null
  name                  = "enchant-games-signups"
  primary_location_hint = null
  read_replication = {
    mode = "disabled"
  }

  lifecycle {
    prevent_destroy = true
  }
}
