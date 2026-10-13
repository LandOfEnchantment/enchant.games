# The bucket this configuration's own state lives in (versions.tf). It was made by hand before
# the first init (a backend can't create its own store) and imported here, never to be
# created or destroyed by Terraform: prevent_destroy, and the pipeline refuses any destroy.

resource "cloudflare_r2_bucket" "tfstate" {
  account_id    = var.account_id
  jurisdiction  = "default"
  location      = "WNAM"
  name          = "enchant-games-tfstate"
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

# Its public r2.dev URL: OFF, and declared so a door opened by hand shows as drift. State
# holds secrets. Provider 5.24.0 cannot import this resource: its create is a PUT of the
# switch, so adoption is a create (a no-op: the bucket was made without one).
resource "cloudflare_r2_managed_domain" "tfstate_dev_url" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.tfstate.name
  enabled     = false
}
