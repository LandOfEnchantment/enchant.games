# Adoption of existing infrastructure (2026-10-12), as in ../merecatholicity.com. Every id
# below was read from the live Cloudflare and GitHub APIs that day; none is guessed.
#
# The loop:
#   terraform plan -generate-config-out=generated.tf
#   (fold generated.tf into the topic files, then delete it)
#   terraform plan          # iterate until it shows only the imports
#   terraform apply         # writes state only; changes nothing live
#
# NOTHING here may be applied while the plan shows a destroy or a replace. A replaced
# cloudflare_d1_database destroys the mailing list; a replaced r2_bucket destroys the state.
# Stateful resources carry prevent_destroy in their own files as a second line of defence.

############################  zone  ############################

import {
  to = cloudflare_zone.main
  id = "efb09cd72ebf216e31b520d204b8f54c"
}

import {
  to = cloudflare_zone_setting.ssl
  id = "efb09cd72ebf216e31b520d204b8f54c/ssl"
}

import {
  to = cloudflare_zone_setting.always_use_https
  id = "efb09cd72ebf216e31b520d204b8f54c/always_use_https"
}

import {
  to = cloudflare_zone_setting.browser_cache_ttl
  id = "efb09cd72ebf216e31b520d204b8f54c/browser_cache_ttl"
}

import {
  to = cloudflare_bot_management.main
  id = "efb09cd72ebf216e31b520d204b8f54c"
}

############################  dns  #############################

import {
  to = cloudflare_dns_record.pages_a_111
  id = "efb09cd72ebf216e31b520d204b8f54c/8df42d76fd8049550d114dd6f84b0ac7"
}

import {
  to = cloudflare_dns_record.pages_a_110
  id = "efb09cd72ebf216e31b520d204b8f54c/88f1695d4cd4078a381ecb30a0c758de"
}

import {
  to = cloudflare_dns_record.pages_a_109
  id = "efb09cd72ebf216e31b520d204b8f54c/c887daa95619992d3c9e92a38446e5c9"
}

import {
  to = cloudflare_dns_record.pages_a_108
  id = "efb09cd72ebf216e31b520d204b8f54c/414119c76a3f9dc9aeffaf98699e19d8"
}

import {
  to = cloudflare_dns_record.pages_aaaa_8003
  id = "efb09cd72ebf216e31b520d204b8f54c/e43d75174f072a864c2de75e425853f7"
}

import {
  to = cloudflare_dns_record.pages_aaaa_8002
  id = "efb09cd72ebf216e31b520d204b8f54c/abc5f5fb97b2cd3f7810ab4fa89b855c"
}

import {
  to = cloudflare_dns_record.pages_aaaa_8001
  id = "efb09cd72ebf216e31b520d204b8f54c/58a9351dbb11ce3b2281fc3e0afecf6f"
}

import {
  to = cloudflare_dns_record.pages_aaaa_8000
  id = "efb09cd72ebf216e31b520d204b8f54c/a120c54fd9c03cf704f684e7dca87c1f"
}

import {
  to = cloudflare_dns_record.www
  id = "efb09cd72ebf216e31b520d204b8f54c/a2fce9184477b3ecb50a5fe9d49a50d2"
}

import {
  to = cloudflare_dns_record.mx_route3
  id = "efb09cd72ebf216e31b520d204b8f54c/a584c5824e09f5bf4822f75bb9157940"
}

import {
  to = cloudflare_dns_record.mx_route2
  id = "efb09cd72ebf216e31b520d204b8f54c/4fe9cb57b548f06c7b9d64bf192fcf09"
}

import {
  to = cloudflare_dns_record.mx_route1
  id = "efb09cd72ebf216e31b520d204b8f54c/6b6dad7a622f270623bad883dbc8a3fe"
}

import {
  to = cloudflare_dns_record.dkim_cf2024
  id = "efb09cd72ebf216e31b520d204b8f54c/a0b8bd9cd51b5c774f43105891f493e5"
}

import {
  to = cloudflare_dns_record.dmarc
  id = "efb09cd72ebf216e31b520d204b8f54c/21400fca04cd0bb10b5ad34a07e3eee5"
}

import {
  to = cloudflare_dns_record.spf
  id = "efb09cd72ebf216e31b520d204b8f54c/8faa19c208c52a623eb027d54ceac9d0"
}

import {
  to = cloudflare_dns_record.google_site_verification
  id = "efb09cd72ebf216e31b520d204b8f54c/91717a256d9be6b5fc130aa325b6b7b6"
}

##########################  rulesets  ##########################

import {
  to = cloudflare_ruleset.cache_settings
  id = "zones/efb09cd72ebf216e31b520d204b8f54c/1458275464ae4ad18983e78a35e586a4"
}

import {
  to = cloudflare_ruleset.redirects
  id = "zones/efb09cd72ebf216e31b520d204b8f54c/fba0214e26f44717bacb5929283f952f"
}

#####################  account-scoped objects  #####################

import {
  to = cloudflare_turnstile_widget.signup
  id = "6093bc0889c95a08f0a92a8df6750c66/0x4AAAAAAFVLgGBnejf8bKWT"
}

# The contact form's own widget, made through the API on 2026-10-12 (its secret went straight
# to the Worker) and adopted here.
import {
  to = cloudflare_turnstile_widget.contact
  id = "6093bc0889c95a08f0a92a8df6750c66/0x4AAAAAAFVRUaFaE_eoc-i-"
}

import {
  to = cloudflare_d1_database.signups
  id = "6093bc0889c95a08f0a92a8df6750c66/a1fdf1f6-ba08-48b4-b3c7-a84518413668"
}

import {
  to = cloudflare_web_analytics_site.main
  id = "6093bc0889c95a08f0a92a8df6750c66/993e9be195ed4e748eb9b00de9935dac"
}

import {
  to = cloudflare_r2_bucket.tfstate
  id = "6093bc0889c95a08f0a92a8df6750c66/enchant-games-tfstate/default"
}

###########################  github  ###########################

import {
  to = github_repository.site
  id = "enchant.games"
}

import {
  to = github_repository_ruleset.master
  id = "enchant.games:24898432"
}

import {
  to = github_repository_environment.github_pages
  id = "enchant.games:github-pages"
}

import {
  to = github_repository_environment_deployment_policy.github_pages_master
  id = "enchant.games:github-pages:43937423"
}

import {
  to = github_repository_environment.terraform_production
  id = "enchant.games:terraform-production"
}

import {
  to = github_repository_environment_deployment_policy.terraform_production_master
  id = "enchant.games:terraform-production:62860441"
}

import {
  to = github_repository_pages.site
  id = "enchant.games"
}

import {
  to = github_repository_vulnerability_alerts.site
  id = "enchant.games"
}

import {
  to = github_repository_dependabot_security_updates.site
  id = "enchant.games"
}

import {
  to = github_actions_repository_permissions.site
  id = "enchant.games"
}

import {
  to = github_workflow_repository_permissions.site
  id = "enchant.games"
}

import {
  to = github_actions_variable.cloudflare_zone_id
  id = "enchant.games:CLOUDFLARE_ZONE_ID"
}

import {
  to = github_actions_organization_workflow_permissions.org
  id = "LandOfEnchantment"
}
