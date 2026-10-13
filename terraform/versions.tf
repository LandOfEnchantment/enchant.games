# Terraform + provider pins and the remote state backend, as in ../merecatholicity.com.
#
# State lives in R2 (S3-compatible), bucket enchant-games-tfstate. That bucket is
# deliberately NOT managed here: a state store managed by the state it holds cannot be
# bootstrapped or recovered. It was created by hand (2026-10-12) and stays that way.
#
# State contains secret material (the Turnstile widget's secret at least) and this
# repository is PUBLIC. Nothing under terraform/ may ever hold a credential: both tokens
# come from the environment. See README.md.

terraform {
  required_version = ">= 1.16.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.24"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.13"
    }
  }

  backend "s3" {
    bucket = "enchant-games-tfstate"
    key    = "enchant.games/terraform.tfstate"
    region = "auto"

    endpoints = {
      s3 = "https://6093bc0889c95a08f0a92a8df6750c66.r2.cloudflarestorage.com"
    }

    # R2 is S3-compatible but is not S3: every AWS-specific preflight has to be
    # skipped, and the default integrity checksums are refused.
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true

    # State locking via a conditional-write lock object, which R2 supports.
    use_lockfile = true
  }
}
