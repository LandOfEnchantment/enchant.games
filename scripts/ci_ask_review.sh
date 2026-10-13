#!/usr/bin/env bash
# (As in ../merecatholicity.com, without its pull request pipeline report.)
# Ask the reviewer, by name, to review a run that waits on an environment gate;
# with `close`, settle the ask once the run has moved on.
#
# GitHub notifies an environment's required reviewers that a deployment waits —
# except a reviewer who is the run's own actor: nobody is notified of their own
# activity, and every run here is the owner's (the pushes and the dispatches
# ride their credentials). So the gate went unannounced. Each gated workflow
# runs this in a job beside the gated one, under that job's GITHUB_TOKEN: the
# issue is github-actions[bot]'s, and its @mention reaches the reviewer as
# anyone else's would (the web inbox, email, GitHub Mobile).
#
# The ask is an ISSUE titled "Approval needed: …" (2026-10-09), so the
# notification says what it wants and opens onto the review link. It was a
# commit comment, and GitHub titles those with the commit's subject and opens
# them below the whole diff. A job after the gated one runs `close`: it records
# the outcome in the body and the title and closes the issue — an edit and a
# close, never a comment: the outcome is on the page, not a second ping.
# The reviewer is read from the gate itself; the run's triggering actor stands
# in if GitHub will not say.
#
# Env: GH_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SERVER_URL (Actions
# sets the last three), TRIGGERING_ACTOR; GITHUB_OUTPUT receives `issue`.
# `close` reads ISSUE (the ask's number) and RESULT (the gated job's result).
set -euo pipefail

: "${GH_TOKEN:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_RUN_ID:?}"
repo=$GITHUB_REPOSITORY
run=$GITHUB_RUN_ID
url="${GITHUB_SERVER_URL:-https://github.com}/$repo/actions/runs/$run"

if [ "${1:-}" = close ]; then
  : "${ISSUE:?}"
  approvals=$(gh api "repos/$repo/actions/runs/$run/approvals" 2>/dev/null || echo '[]')
  issue=$(gh api "repos/$repo/issues/$ISSUE")
  patch=$(APPROVALS="$approvals" ISSUE_JSON="$issue" RESULT="${RESULT:-}" python3 -c '
import json, os
a = json.loads(os.environ["APPROVALS"] or "[]")
i = json.loads(os.environ["ISSUE_JSON"])
result = os.environ["RESULT"] or "unknown"
last = a[-1] if a else None
who = last["user"]["login"] if last else ""
if last and last.get("state") == "approved":
    head, reason = "Approved", "completed"
    line = f"**Approved** by {who}; the job ended `{result}`."
elif last:
    head, reason = "Rejected", "not_planned"
    line = f"**Rejected** by {who}."
else:
    head, reason = "Not reviewed", "not_planned"
    line = f"**Not reviewed**: the run moved on without a review (`{result}`)."
if last and (last.get("comment") or "").strip():
    # a mention added by an edit notifies, so an @ in the reason is defused
    line += "\n\n> " + last["comment"].strip().replace("@", "@​").replace("\n", "\n> ")
title = i["title"].replace("Approval needed:", head + ":", 1)
print(json.dumps({"title": title, "body": i["body"] + "\n\n---\n" + line,
                  "state": "closed", "state_reason": reason}))
')
  printf %s "$patch" | gh api -X PATCH "repos/$repo/issues/$ISSUE" --input - --jq '.html_url + " " + .state'
  exit 0
fi

# This job and the gated one start together; wait until the gate holds the run.
# A run the gate never holds (a refused branch, a job skipped) is asked of nobody.
pending='[]'
for _ in $(seq 1 "${ASK_TRIES:-30}"); do
  if pending=$(gh api "repos/$repo/actions/runs/$run/pending_deployments" 2>/dev/null); then
    [ "$(printf %s "$pending" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')" != 0 ] && break
  else
    pending='unreadable'
  fi
  sleep 10
done
if [ "$pending" = '[]' ]; then
  echo "no gate holds this run — nobody to ask"
  exit 0
fi

IFS=$'\t' read -r gates who < <(printf %s "$pending" | ACTOR="${TRIGGERING_ACTOR:-}" python3 -c '
import json, os, sys
try:
    p = json.load(sys.stdin)
except ValueError:
    p = []
gates = sorted({d["environment"]["name"] for d in p}) or ["an environment gate"]
who = sorted({r["reviewer"]["login"] for d in p for r in d.get("reviewers", [])
              if r.get("type") == "User"})
if not who and os.environ["ACTOR"]:
    who = [os.environ["ACTOR"]]
print(", ".join(gates) + "\t" + " ".join("@" + w for w in who))
')
if [ -z "$who" ]; then
  echo "::error::the gate names no reviewer and the run no actor — nobody to ask"
  exit 1
fi

# a dispatch's title is the workflow's name again, so the commit's subject says what waits
IFS=$'\t' read -r sha name < <(gh api "repos/$repo/actions/runs/$run" \
  --jq '.head_sha + "\t" + .name + " · " + (.head_commit.message | split("\n")[0])')

title="Approval needed: $name"
[ ${#title} -le 200 ] || title="${title:0:199}…"
# the pull request the change came from, when there is one (every merge to master)
pr=$(gh api "repos/$repo/commits/$sha/pulls" --jq '[.[] | select(.base.repo.full_name == "'"$repo"'")][0].number // empty' 2>/dev/null || true)
body="$who — **$name** is waiting for your review at \`$gates\`.

### [Review deployments →]($url)

or \`scripts/ci_approve.sh $run\` · commit $sha${pr:+ · from #$pr}"
issue=$(gh api "repos/$repo/issues" -f title="$title" -f body="$body" --jq '.number')
echo "asked in ${GITHUB_SERVER_URL:-https://github.com}/$repo/issues/$issue"
echo "issue=$issue" >> "${GITHUB_OUTPUT:-/dev/null}"
