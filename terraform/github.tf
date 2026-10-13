# The repository's GitHub settings (was scripts/github-settings.sh, 2026-10-11). etag and fork
# are dropped from the generated config: both are read-only, and etag changes on every
# repository write, which would show as permanent drift. A fork's workflows waiting for
# approval every time is the one setting the provider cannot hold (README.md).

# Auto-merge, merge commits, a branch deleted when merged, an out-of-date branch updatable
# from its pull request; secret scanning with push protection.

resource "github_repository" "site" {
  allow_auto_merge            = true
  allow_forking               = true
  allow_merge_commit          = true
  allow_rebase_merge          = true
  allow_squash_merge          = true
  allow_update_branch         = true
  archive_on_destroy          = null
  archived                    = false
  auto_init                   = false
  delete_branch_on_merge      = true
  description                 = "https://enchant.games"
  gitignore_template          = null
  has_discussions             = false
  has_issues                  = true
  has_projects                = true
  has_wiki                    = false
  homepage_url                = null
  is_template                 = false
  license_template            = null
  merge_commit_message        = "PR_TITLE"
  merge_commit_title          = "MERGE_MESSAGE"
  name                        = "enchant.games"
  squash_merge_commit_message = "COMMIT_MESSAGES"
  squash_merge_commit_title   = "COMMIT_OR_PR_TITLE"
  topics                      = []
  visibility                  = "public"
  web_commit_signoff_required = false
  security_and_analysis {
    secret_scanning {
      status = "enabled"
    }
    secret_scanning_push_protection {
      status = "enabled"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

# master takes no direct push: a pull request with `check` and Terraform's `plan` green (from
# GitHub Actions only, app 15368, so a status of that name from anywhere else satisfies
# nothing; both run on every pull request, neither path-filtered) and one
# approval, stale approvals dismissed. No force push, no deletion. No bypass actor: the
# owner and every agent get the same rule; owner-merge.yml approves the owner's pull
# requests, anyone else's waits for the owner. The emergency door, when `check` itself is
# broken and its fix cannot pass it: set enforcement to "disabled" here (or in Settings),
# merge the fix, set it back.

resource "github_repository_ruleset" "master" {
  enforcement = "active"
  name        = "master: pull requests only, check green, approved"
  repository  = github_repository.site.name
  target      = "branch"
  conditions {
    ref_name {
      exclude = []
      include = ["~DEFAULT_BRANCH"]
    }
  }
  rules {
    creation                      = false
    deletion                      = true
    non_fast_forward              = true
    required_linear_history       = false
    required_signatures           = false
    update                        = false
    update_allows_fetch_and_merge = false
    pull_request {
      allowed_merge_methods             = ["merge", "squash", "rebase"]
      dismiss_stale_reviews_on_push     = true
      require_code_owner_review         = false
      require_last_push_approval        = false
      required_approving_review_count   = 1
      required_review_thread_resolution = false
    }
    required_status_checks {
      do_not_enforce_on_create             = false
      strict_required_status_checks_policy = false
      required_check {
        context        = "check"
        integration_id = 15368
      }
      required_check {
        context        = "plan"
        integration_id = 15368
      }
    }
  }
}

# The default workflow token is read only (each workflow asks for what it needs), and it may
# approve pull requests: owner-merge.yml's approval. Only because the owner is the one
# collaborator: anyone else with write access could approve their own pull request through
# a workflow on their branch. Revisit before granting anyone write access.

resource "github_workflow_repository_permissions" "site" {
  can_approve_pull_request_reviews = true
  default_workflow_permissions     = "read"
  repository                       = github_repository.site.name
}

# The organization must allow its repositories that approval first (2026-10-11). Only this
# repository opts in. Nothing else in the organization is managed anywhere.

resource "github_actions_organization_workflow_permissions" "org" {
  can_approve_pull_request_reviews = true
  default_workflow_permissions     = "read"
  organization_slug                = var.github_owner
}

# Only GitHub-owned and verified actions run, each pinned to a commit.

resource "github_actions_repository_permissions" "site" {
  allowed_actions      = "selected"
  enabled              = true
  repository           = github_repository.site.name
  sha_pinning_required = true
  allowed_actions_config {
    github_owned_allowed = true
    patterns_allowed     = []
    verified_allowed     = true
  }
}

# Dependabot alerts on the repository's dependencies, and its security fixes.
resource "github_repository_vulnerability_alerts" "site" {
  repository = github_repository.site.name
  enabled    = true
}

resource "github_repository_dependabot_security_updates" "site" {
  enabled    = true
  repository = github_repository.site.name
}

# GitHub Pages built by GitHub Actions (deploy.yml), not from a branch, at enchant.games.
# https_enforced stays false: Cloudflare fronts the origin and enforces HTTPS at the edge.

resource "github_repository_pages" "site" {
  build_type     = "workflow"
  cname          = "enchant.games"
  https_enforced = false
  public         = true
  repository     = github_repository.site.name
}

# Pages' environment: master only. It holds the Cloudflare token deploy.yml purges with
# (CLOUDFLARE_API_TOKEN, an environment secret; secrets are never managed here).

resource "github_repository_environment" "github_pages" {
  can_admins_bypass   = true
  environment         = "github-pages"
  prevent_self_review = null
  repository          = github_repository.site.name
  wait_timer          = 0
  deployment_branch_policy {
    custom_branch_policies = true
    protected_branches     = false
  }
}

resource "github_repository_environment_deployment_policy" "github_pages_master" {
  branch_pattern = "master"
  environment    = github_repository_environment.github_pages.environment
  repository     = github_repository.site.name
  tag_pattern    = null
}

# The approval gate for applies from CI (.github/workflows/terraform.yml): a job naming it
# waits for the owner's review (the browser, or scripts/ci_approve.sh: the same API call).
# master only. Created through the API on 2026-10-12 BEFORE any workflow named it: GitHub
# makes a named environment it has never seen with no protection at all.

resource "github_repository_environment" "terraform_production" {
  can_admins_bypass   = false
  environment         = "terraform-production"
  prevent_self_review = false
  repository          = github_repository.site.name
  wait_timer          = 0
  deployment_branch_policy {
    custom_branch_policies = true
    protected_branches     = false
  }
  reviewers {
    teams = []
    users = [26800291]
  }
}

resource "github_repository_environment_deployment_policy" "terraform_production_master" {
  branch_pattern = "master"
  environment    = github_repository_environment.terraform_production.environment
  repository     = github_repository.site.name
  tag_pattern    = null
}

# The zone id the workflows read as vars.CLOUDFLARE_ZONE_ID (an id, not a secret).

resource "github_actions_variable" "cloudflare_zone_id" {
  repository    = github_repository.site.name
  value         = var.zone_id
  variable_name = "CLOUDFLARE_ZONE_ID"
}
