variable "account_id" {
  description = "Cloudflare account. Shared with the other sites' zones — see README.md on blast radius."
  type        = string
  default     = "6093bc0889c95a08f0a92a8df6750c66"
}

variable "zone_id" {
  description = "The enchant.games zone."
  type        = string
  default     = "efb09cd72ebf216e31b520d204b8f54c"
}

variable "github_owner" {
  description = "GitHub organization owning the site's repository."
  type        = string
  default     = "LandOfEnchantment"
}
