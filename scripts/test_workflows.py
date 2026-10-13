#!/usr/bin/env python3
"""Holds the pipeline to what .claude/rules/cicd.md says it is (as in ../adamschaefers.com).

Plain text checks (no YAML library): every action pinned to a commit, every
workflow with its own permissions, `check` never path-filtered and required by
master's ruleset (terraform/github.tf), owner-merge.yml approving only the owner's
pull requests without ever running their code, the right to publish the site and
the Cloudflare token for the purge only where a pull request can never reach them:
deploy.yml's job in the github-pages environment, which runs on master only, purging
only after GitHub Pages has published; and terraform.yml (as ../merecatholicity.com's)
blanking every secret on a pull request, printing no plan, uploading no plan or
state, refusing a destroy, and applying only from master behind the owner's review.
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS = ROOT / ".github" / "workflows"
TERRAFORM = ROOT / "terraform"
OWNER_ID = "26800291"  # a-schaefers
GITHUB_ACTIONS_APP = 15368


def text(name: str) -> str:
    return (WORKFLOWS / name).read_text()


def resource(kind: str, name: str) -> str:
    """One resource block of terraform/*.tf, as text (blocks end at a closing brace in
    column 0, as terraform fmt writes them)."""
    for path in sorted(TERRAFORM.glob("*.tf")):
        m = re.search(rf'(?ms)^resource "{kind}" "{name}" {{\n.*?^}}', path.read_text())
        if m:
            return m.group(0)
    raise AssertionError(f"no resource {kind}.{name} in terraform/")


class Pins(unittest.TestCase):
    def test_every_action_is_pinned_to_a_commit(self):
        for path in sorted(WORKFLOWS.glob("*.yml")):
            for line in path.read_text().splitlines():
                m = re.search(r"\buses:\s*(\S+)(.*)", line)
                if not m or line.lstrip().startswith("#"):
                    continue
                ref = m.group(1)
                if ref.startswith("./.github/workflows/"):
                    continue  # this repository's own workflow, at the same commit
                with self.subTest(file=path.name, uses=ref):
                    self.assertRegex(ref, r"^[\w.-]+/[\w./-]+@[0-9a-f]{40}$", "pin a commit, not a tag")
                    self.assertRegex(m.group(2), r"#\s*v\d", "say which version the commit is")

    def test_every_workflow_sets_its_permissions(self):
        for path in sorted(WORKFLOWS.glob("*.yml")):
            with self.subTest(file=path.name):
                self.assertRegex(path.read_text(), r"(?m)^permissions:")


class RequiredCheck(unittest.TestCase):
    def test_check_runs_on_every_pull_request(self):
        on = text("check.yml").split("\njobs:")[0]
        self.assertIn("pull_request:", on)
        self.assertNotRegex(on, r"paths(-ignore)?:", "a required check must report on every pull request")
        self.assertRegex(text("check.yml"), r"(?m)^  check:$")

    def test_ruleset_requires_it_from_github_actions(self):
        ruleset = resource("github_repository_ruleset", "master")
        self.assertRegex(ruleset, rf'required_check {{\s+context\s+= "check"\s+integration_id = {GITHUB_ACTIONS_APP}\s+}}')

    def test_terraforms_plan_is_required_too_and_reports_on_every_pull_request(self):
        ruleset = resource("github_repository_ruleset", "master")
        self.assertRegex(ruleset, rf'required_check {{\s+context\s+= "plan"\s+integration_id = {GITHUB_ACTIONS_APP}\s+}}')
        on = text("terraform.yml").split("\njobs:")[0]
        self.assertNotRegex(on.split("push:")[0], r"paths(-ignore)?:", "a required check must report on every pull request")


class Ruleset(unittest.TestCase):
    def test_master_takes_pull_requests_only_with_an_approval(self):
        ruleset = resource("github_repository_ruleset", "master")
        self.assertRegex(ruleset, r'enforcement\s+= "active"')
        self.assertRegex(ruleset, r'include = \["~DEFAULT_BRANCH"\]')
        self.assertNotIn("bypass_actors", ruleset, "no bypass: the owner and every agent alike")
        self.assertRegex(ruleset, r"deletion\s+= true")
        self.assertRegex(ruleset, r"non_fast_forward\s+= true")
        self.assertRegex(ruleset, r"required_approving_review_count\s+= 1")
        self.assertRegex(ruleset, r"dismiss_stale_reviews_on_push\s+= true")


class OwnerMerge(unittest.TestCase):
    def setUp(self):
        self.text = text("owner-merge.yml")
        self.code = "\n".join(l for l in self.text.splitlines() if not l.lstrip().startswith("#"))

    def test_runs_masters_copy_and_never_the_pull_requests_code(self):
        self.assertIn("pull_request_target:", self.code)
        self.assertNotRegex(self.code, r"\buses:", "no checkout, no action: nothing from the branch runs")
        self.assertNotRegex(self.code, r"\bgit\b|\bnpm\b|\bnode\b|python", "no code from the branch")

    def test_reads_nothing_from_the_event_but_numbers_hashes_and_ids(self):
        used = set(re.findall(r"\$\{\{\s*([^}]+?)\s*\}\}", self.code))
        allowed = {
            "github.event.pull_request.number",
            "github.event.pull_request.head.sha",
            "github.repository",
            "github.token",
        }
        self.assertLessEqual(used, allowed, "event text (a title, a branch name) must never reach a shell")

    def test_approves_only_the_owners_own_pull_request(self):
        cond = re.search(r"if: >-\n((?:\s{6}.+\n)+)", self.code).group(1)
        self.assertIn(f"github.event.pull_request.user.id == {OWNER_ID}", cond)
        self.assertIn(f"github.event.sender.id == {OWNER_ID}", cond)
        self.assertIn("github.event.pull_request.head.repo.full_name == github.repository", cond)
        self.assertIn("!github.event.pull_request.draft", cond)
        self.assertEqual(cond.count("&&"), 3, "every condition must hold")

    def test_approves_and_merges_only_the_head_it_was_woken_for(self):
        self.assertIn('commit_id="$HEAD"', self.code)
        for merge in re.findall(r"gh pr merge [^\n]*--merge[^\n]*", self.code):
            self.assertIn('--match-head-commit "$HEAD"', merge)


    def test_dispatches_the_deploy_its_own_merge_cannot_start(self):
        self.assertIn("actions: write", self.code)
        self.assertIn('gh workflow run deploy.yml --repo "$REPO" --ref master', self.code)


class Secrets(unittest.TestCase):
    """A pull request's code runs in check.yml: nothing it can reach may publish the site."""

    def test_only_the_deploy_the_purge_and_terraform_name_a_secret(self):
        for path in sorted(WORKFLOWS.glob("*.yml")):
            if path.name in ("deploy.yml", "purge-cache.yml", "terraform.yml"):
                continue
            with self.subTest(file=path.name):
                self.assertNotIn("secrets.", path.read_text())

    def test_the_purge_button_runs_on_master_in_github_pages_only(self):
        purge = text("purge-cache.yml")
        on = purge.split("\njobs:")[0]
        self.assertRegex(on, r"on:\n  workflow_dispatch:\n\n", "a button, nothing else")
        self.assertIn("environment: github-pages", purge)
        self.assertNotIn("pages: write", purge)

    def test_check_only_reads(self):
        check = text("check.yml")
        self.assertRegex(check, r"(?m)^permissions:\n  contents: read\n\n")
        self.assertNotRegex(check, r"(?m)^[ \t]+permissions:", "no job in check.yml asks for more")

    def test_deploy_runs_on_master_only_and_publishes_from_github_pages(self):
        deploy = text("deploy.yml")
        on = deploy.split("\njobs:")[0]
        self.assertNotIn("pull_request", on)
        self.assertRegex(on, r"push:\n\s+branches: \[master\]")
        jobs = re.split(r"(?m)^  (?=[\w-]+:$)", deploy.split("\njobs:\n", 1)[1])
        for job in jobs:
            if "pages: write" in job or "id-token: write" in job or "secrets." in job:
                with self.subTest(job=job.split(":")[0]):
                    self.assertRegex(job, r"environment:\n\s+name: github-pages")
        for path in sorted(WORKFLOWS.glob("*.yml")):
            if path.name != "deploy.yml":
                with self.subTest(file=path.name):
                    self.assertNotIn("pages: write", path.read_text())
                    self.assertNotIn("id-token: write", path.read_text())

    def test_the_purge_follows_the_publish(self):
        """A purge before GitHub Pages has published lets Cloudflare fill the new keys with
        the old files; deploy-pages returns only once the deployment succeeded."""
        deploy = text("deploy.yml")
        self.assertLess(deploy.index("actions/deploy-pages@"), deploy.index("node scripts/purge.js"))
        self.assertLess(deploy.index("node scripts/purge.js"), deploy.index("sh scripts/smoke.sh"))
        step = deploy[deploy.index("- name: Purge"):deploy.index("node scripts/purge.js")]
        self.assertIn("secrets.CLOUDFLARE_API_TOKEN", step, "the token goes to the purge step alone")
        self.assertEqual(deploy.count("secrets."), 1)

    def test_deploys_never_overlap_or_cancel(self):
        self.assertRegex(text("deploy.yml"), r"concurrency:\n\s+group: deploy\n\s+cancel-in-progress: false")


class Terraform(unittest.TestCase):
    """terraform.yml, as ../merecatholicity.com's: everything it prints or uploads is
    public, state and the binary plan hold secrets, and a pull request's HCL must never
    meet a credential."""

    def setUp(self):
        self.text = text("terraform.yml")
        self.code = "\n".join(l for l in self.text.splitlines() if not l.lstrip().startswith("#"))

    def test_runs_on_every_pull_request_and_on_master(self):
        on = self.text.split("\njobs:")[0]
        self.assertRegex(on, r"on:\n  pull_request:\n  push:\n    branches: \[master\]")
        self.assertRegex(self.text, r"(?m)^  plan:$")

    def test_no_pull_request_ever_sees_a_secret(self):
        refs = re.findall(r"\$\{\{([^}]*secrets\.[^}]*)\}\}", self.code)
        self.assertTrue(refs)
        for ref in refs:
            with self.subTest(ref=ref.strip()):
                self.assertRegex(ref.strip(), r"^github\.event_name != 'pull_request' && secrets\.(CLOUDFLARE_ROOT_TOKEN|GH_ROOT_TOKEN) \|\| ''$")

    def test_prints_no_plan_and_uploads_no_plan_or_state(self):
        self.assertIn("-out=tfplan > /tmp/plan.txt 2>&1", self.code)
        self.assertIn("tfplan > /tmp/apply.txt 2>&1", self.code)
        self.assertNotRegex(self.code, r"cat /tmp/(plan|apply)\.txt")
        self.assertNotRegex(self.code, r"terraform -chdir=terraform show(?! -json tfplan > /tmp/plan\.json)")
        self.assertEqual(re.findall(r"(?m)^\s+path: (.+)$", self.code), ["/tmp/summary/plan.md"], "only the summary is uploaded")
        self.assertNotRegex(self.code, r"tfstate|\.tfplan\b")
        for m in re.finditer(r"grep -E '\^([^']*)' /tmp/(plan|apply)\.txt", self.code):
            self.assertIn(m.group(1), ("Error:", "(Apply complete|Error)", "Apply complete"), "only the summary lines")

    def test_masks_the_derived_state_credentials(self):
        self.assertIn('echo "::add-mask::$key"; echo "::add-mask::$secret"', self.code)

    def test_refuses_a_destroy_unless_dispatched_to(self):
        self.assertEqual(self.code.count("--fail-on-destroy $ALLOW"), 2, "the plan job and the apply job")
        for allow in re.findall(r"ALLOW: (.+)", self.code):
            self.assertEqual(allow.strip(), "${{ github.event_name == 'workflow_dispatch' && inputs.allow_destroy && '--allow-destroy' || '' }}")

    def test_applies_only_from_master_behind_the_owners_review(self):
        apply = self.code.split("\n  apply:\n", 1)[1]
        self.assertIn("(github.event_name == 'push' && github.ref == 'refs/heads/master')", apply)
        self.assertIn("(github.event_name == 'workflow_dispatch' && inputs.apply)", apply)
        self.assertRegex(apply, r"environment:\n\s+name: terraform-production")
        self.assertIn('if [ "$now" != "$REVIEWED" ]', apply, "the reviewed plan, or nothing")
        gate = resource("github_repository_environment", "terraform_production")
        self.assertRegex(gate, r"can_admins_bypass\s+= false")
        self.assertRegex(gate, rf"users = \[{OWNER_ID}\]")
        policy = resource("github_repository_environment_deployment_policy", "terraform_production_master")
        self.assertRegex(policy, r'branch_pattern = "master"')

    def test_git_never_holds_state_or_a_plan(self):
        ignored = (TERRAFORM / ".gitignore").read_text().split()
        for pattern in ("*.tfstate", "*.tfstate.*", ".terraform/", "generated.tf", "*.tfplan", "*.auto.tfvars", ".env"):
            self.assertIn(pattern, ignored)


if __name__ == "__main__":
    unittest.main()
