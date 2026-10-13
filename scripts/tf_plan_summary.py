#!/usr/bin/env python3
"""Render `terraform show -json <plan>` for a PUBLIC repository's CI.

Why this exists: everything a workflow prints or uploads in this repository is
world-readable — the logs, the job summary, the artifacts. A Terraform plan is
not. The binary plan file embeds the prior state (Turnstile secret keys among
other things), and the text plan can echo values the provider never marked
sensitive. So the CI never prints `terraform plan` output and never uploads the
plan file. It prints THIS instead: one row per changing resource — address,
action, and the names of the attributes that change — with values shown only
for attributes the provider's own schema does NOT mark sensitive, and only when
they are short scalars. Enough to review; nothing to leak.

It also carries the repository's standing law for infrastructure: NEVER apply a
plan that destroys or replaces (a replaced D1 database is the mailing list,
gone). `--fail-on-destroy` turns any delete action into a non-zero exit unless
`--allow-destroy` is passed — which the workflow only passes from a deliberate
workflow_dispatch input.

Usage:
  terraform show -json tfplan > plan.json
  python3 scripts/tf_plan_summary.py plan.json --markdown      # for the job summary / PR comment
  python3 scripts/tf_plan_summary.py plan.json --fingerprint   # one line per change, for the
                                                              # apply job to compare against
  python3 scripts/tf_plan_summary.py plan.json --fail-on-destroy [--allow-destroy]

Exit codes: 0 ok · 3 destructive plan refused · 1 bad input.
"""
import argparse
import json
import sys

NOISE = ('no-op', 'read')
MAX_VALUE = 60


def load(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    out = []
    for c in data.get('resource_changes', []):
        ch = c.get('change', {})
        if not ch.get('actions'):
            continue
        # An adoption (`import` block) plans as a no-op with an `importing`
        # marker. It is exactly the kind of change a reviewer wants to see.
        if ch.get('importing'):
            out.append(c)
        elif ch['actions'] not in (['no-op'], ['read']):
            out.append(c)
    return out


def actions_of(c):
    a = c['change']['actions']
    if c['change'].get('importing'):
        return 'import' if a == ['no-op'] else 'import+' + '+'.join(a)
    if a == ['delete', 'create'] or a == ['create', 'delete']:
        return 'replace'
    return '+'.join(a)


def is_destructive(c):
    return 'delete' in c['change']['actions']


def _has_true_leaf(v):
    if v is True:
        return True
    if isinstance(v, dict):
        return any(_has_true_leaf(x) for x in v.values())
    if isinstance(v, list):
        return any(_has_true_leaf(x) for x in v)
    return False


def sensitive_keys(mark):
    """The *_sensitive maps mirror the value shape; a `true` LEAF means secret.
    A nested block shows up here as an empty container even when nothing in it
    is sensitive, so only a true somewhere inside counts."""
    if isinstance(mark, dict):
        return {k for k, v in mark.items() if _has_true_leaf(v)}
    return set()


def fmt(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        s = json.dumps(v)
        return s if len(s) <= MAX_VALUE else s[:MAX_VALUE - 1] + '…"'
    return '(complex)'


def attribute_lines(c):
    ch = c['change']
    before, after = ch.get('before') or {}, ch.get('after') or {}
    secret = sensitive_keys(ch.get('before_sensitive')) | sensitive_keys(ch.get('after_sensitive'))
    unknown = set((ch.get('after_unknown') or {}).keys()) if isinstance(ch.get('after_unknown'), dict) else set()
    act = actions_of(c)
    lines = []
    if act.startswith('import'):
        lines.append('(adopted into state; no change to the live resource)' if act == 'import' else '(adopted, then changed as below)')
        if act == 'import':
            return lines
        act = act.split('+', 1)[1]
    if act == 'create':
        keys = [k for k, v in after.items() if v not in (None, [], {})]
        for k in sorted(keys):
            lines.append(f'{k} = (sensitive)' if k in secret else f'{k} = {fmt(after[k])}')
    elif act == 'delete':
        lines.append('(resource removed)')
    else:
        for k in sorted(set(before) | set(after) | unknown):
            b, a = before.get(k), after.get(k)
            if k in unknown and b is not None and k not in after:
                lines.append(f'{k}: {fmt(b) if k not in secret else "(sensitive)"} → (known after apply)')
            elif b != a:
                if k in secret:
                    lines.append(f'{k}: (sensitive) → (sensitive)')
                elif isinstance(b, (dict, list)) or isinstance(a, (dict, list)):
                    lines.append(f'{k}: (changed)')
                else:
                    lines.append(f'{k}: {fmt(b)} → {fmt(a)}')
    return lines


def markdown(changes):
    if not changes:
        return '**Terraform plan: no changes.** Infrastructure matches the configuration.\n'
    n_destr = sum(1 for c in changes if is_destructive(c))
    out = [f'**Terraform plan: {len(changes)} change(s)**'
           + (f' — **{n_destr} DESTRUCTIVE** (delete/replace)' if n_destr else '') + '\n',
           '| Resource | Action | What changes |', '|---|---|---|']
    for c in changes:
        act = actions_of(c)
        flag = ' ⚠️' if is_destructive(c) else ''
        attrs = attribute_lines(c)
        cell = '<br>'.join(a.replace('|', '\\|') for a in attrs[:25])
        if len(attrs) > 25:
            cell += f'<br>… {len(attrs) - 25} more'
        out.append(f'| `{c["address"]}` | **{act}**{flag} | {cell} |')
    out.append('')
    out.append('_Values are shown only for attributes the provider does not mark sensitive; '
               'the plan file itself is never published (this repository is public)._')
    return '\n'.join(out) + '\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('plan_json')
    ap.add_argument('--markdown', action='store_true')
    ap.add_argument('--fingerprint', action='store_true')
    ap.add_argument('--fail-on-destroy', action='store_true')
    ap.add_argument('--allow-destroy', action='store_true')
    args = ap.parse_args()
    try:
        changes = load(args.plan_json)
    except (OSError, ValueError, KeyError) as e:
        print(f'tf_plan_summary: cannot read {args.plan_json}: {e}', file=sys.stderr)
        return 1
    changes.sort(key=lambda c: c['address'])
    if args.fingerprint:
        for c in changes:
            print(f'{c["address"]} {actions_of(c)}')
    if args.markdown:
        sys.stdout.write(markdown(changes))
    if args.fail_on_destroy:
        bad = [c['address'] for c in changes if is_destructive(c)]
        if bad and not args.allow_destroy:
            print('tf_plan_summary: REFUSED — the plan would destroy or replace:', file=sys.stderr)
            for b in bad:
                print('  ' + b, file=sys.stderr)
            print('A destroy is never applied from CI by default. If it is genuinely intended, '
                  'run the Terraform workflow by hand with allow_destroy=true.', file=sys.stderr)
            return 3
    return 0


if __name__ == '__main__':
    sys.exit(main())
