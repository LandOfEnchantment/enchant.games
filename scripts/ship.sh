#!/usr/bin/env bash
# The one road to master (2026-10-11, as in ../adamschaefers.com). master takes no direct
# push (the ruleset in terraform/github.tf): every change is a pull request whose
# `check` passes, and its merge is the deploy (deploy.yml). This pushes the checkout's
# commits to a branch, opens its pull request (or finds the open one), arms auto-merge as
# you, and waits for the merge or for the check that failed. owner-merge.yml approves the
# owner's pull request; anyone else's waits for the owner's review.
#
#   scripts/ship.sh                    the current branch; a detached HEAD (a
#                                      worktree) ships as agent/<worktree>
#   scripts/ship.sh --title "…"        default: the newest commit's subject
#   scripts/ship.sh --body-file FILE   default: every commit message on the branch
#   scripts/ship.sh --squash           a squash merge instead of a merge commit
#   scripts/ship.sh --no-wait          arm auto-merge and return
#   scripts/ship.sh --draft            open it as a draft: nothing merges it
#
# A red check leaves auto-merge armed: fix, commit, run this again (the same
# branch, the same pull request).
#
# IT ARMS ONLY ITS OWN PULL REQUEST, AT ITS OWN COMMIT. A fork can open a pull
# request from a branch of any name, and this runs with your write access: found
# by branch name alone, a stranger's pull request could be armed to merge
# itself. So the pull request must come from this repository, and every merge
# it asks for names the exact commit it pushed (--match-head-commit).
set -euo pipefail

title= bodyfile= method=--merge wait=1 draft=
while [ $# -gt 0 ]; do
  case "$1" in
    --title) title=${2:?--title needs text}; shift 2 ;;
    --body-file) bodyfile=${2:?--body-file needs a file}; shift 2 ;;
    --squash) method=--squash; shift ;;
    --no-wait) wait=0; shift ;;
    --draft) draft=--draft; shift ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "ship.sh: unknown argument $1" >&2; exit 64 ;;
  esac
done

git fetch -q origin master
ahead=$(git rev-list --count origin/master..HEAD)
[ "$ahead" -gt 0 ] || { echo "nothing to ship: HEAD is already in origin/master"; exit 1; }
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "note: uncommitted changes stay here; only commits ship"
fi

branch=$(git symbolic-ref -q --short HEAD || true)
if [ "$branch" = master ]; then
  echo "ship.sh: refusing to ship from master: master takes no direct push." >&2
  echo "  \`git switch -c <branch>\` first (your commits come with it), then run this again." >&2
  exit 1
fi
if [ -z "$branch" ]; then
  # a detached HEAD: name it after its worktree, so a fix pushed from the same
  # worktree lands on the same pull request
  wt=$(basename "$(git rev-parse --show-toplevel)")
  branch="agent/$wt"
  remote=$(git ls-remote origin "refs/heads/$branch" | cut -f1)
  if [ -n "$remote" ] && ! git merge-base --is-ancestor "$remote" HEAD 2>/dev/null; then
    taken=$branch
    branch="agent/$wt-$(git rev-parse --short HEAD)"
    echo "note: origin's $taken holds work this HEAD does not carry; shipping as $branch"
  fi
fi

head=$(git rev-parse HEAD)
echo "shipping $ahead commit(s) as $branch"
git push -q origin "HEAD:refs/heads/$branch"

# this repository's own pull request for the branch, never a fork's of the same name
n=$(gh pr list --head "$branch" --state open --json number,isCrossRepository \
      --jq '[.[] | select(.isCrossRepository == false)][0].number // empty')
if [ -z "$n" ]; then
  [ -n "$title" ] || title=$(git log -1 --format=%s)
  if [ -z "$bodyfile" ]; then
    bodyfile=$(mktemp)
    trap 'rm -f "$bodyfile"' EXIT
    git log --reverse --format='### %s%n%n%b' origin/master..HEAD > "$bodyfile"
  fi
  url=$(gh pr create --base master --head "$branch" --title "$title" --body-file "$bodyfile" $draft)
  n=${url##*/}
  echo "opened $url"
else
  echo "updated the open pull request #$n"
fi
if [ -n "$draft" ] || [ "$(gh pr view "$n" --json isDraft --jq .isDraft)" = true ]; then
  echo "#$n is a draft: nothing merges it until it is marked ready (gh pr ready $n)"
  exit 0
fi

# Arm auto-merge as you, so the merge is yours and master gets its deploy run
# (owner-merge.yml arms it only when nobody has). A pull request that is
# already mergeable cannot be armed: merge it outright. A refusal to arm is the
# answer, never a plain merge in its place.
mine=$(gh pr view "$n" --json isCrossRepository,headRefOid --jq '"\(.isCrossRepository) \(.headRefOid)"')
if [ "$mine" != "false $head" ]; then
  echo "ship.sh: #$n is not this repository's pull request at $head ($mine); refusing to merge it" >&2
  exit 1
fi
merge_state() { gh pr view "$n" --json mergeStateStatus --jq .mergeStateStatus; }
armed() { [ -n "$(gh pr view "$n" --json autoMergeRequest --jq '.autoMergeRequest // empty')" ]; }
case "$(merge_state)" in
  CLEAN|UNSTABLE|HAS_HOOKS) gh pr merge "$n" "$method" --match-head-commit "$head" ;;
  *) if ! gh pr merge "$n" --auto "$method" --match-head-commit "$head"; then
       if [ "$(merge_state)" = CLEAN ]; then gh pr merge "$n" "$method" --match-head-commit "$head"
       elif armed; then echo "auto-merge was already armed on #$n"
       else echo "ship.sh: #$n: auto-merge could not be armed (above)" >&2; exit 1
       fi
     fi ;;
esac
[ "$wait" = 1 ] || { echo "auto-merge armed on #$n; not waiting"; exit 0; }

echo "waiting for #$n: the check, an approval, then the merge"
for _ in $(seq 1 180); do
  verdict=$(gh pr view "$n" --json state,mergeCommit,statusCheckRollup,reviewDecision | python3 -c '
import json, sys
p = json.load(sys.stdin)
if p["state"] == "MERGED":
    print("merged " + ((p.get("mergeCommit") or {}).get("oid") or "")); sys.exit()
if p["state"] == "CLOSED":
    print("closed"); sys.exit()
bad = [c for c in p.get("statusCheckRollup") or []
       if (c.get("conclusion") or c.get("state") or "").upper() in
          ("FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED")]
if bad:
    print("failed " + " ".join("%s(%s)" % (c.get("name") or c.get("context"), c.get("detailsUrl") or c.get("targetUrl") or "") for c in bad))
else:
    print("pending " + (p.get("reviewDecision") or ""))
')
  case "$verdict" in
    merged*) sha=${verdict#merged }
             echo "merged #$n as ${sha:0:7}"
             exit 0 ;;
    closed) echo "#$n was closed without merging" >&2; exit 1 ;;
    failed*) echo "#$n: a check failed: ${verdict#failed }" >&2
             echo "auto-merge stays armed: fix, commit, run scripts/ship.sh again (same branch, same PR)" >&2
             exit 1 ;;
  esac
  sleep 20
done
echo "#$n has not merged in an hour (${verdict#pending }); auto-merge stays armed (gh pr checks $n)" >&2
exit 2
