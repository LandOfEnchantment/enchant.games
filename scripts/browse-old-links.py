#!/usr/bin/env python3
"""Opens every address the site has ever had in a real browser and says where each lands.

The Chromium under ~/.cloakbrowser, driven over chromedriver's WebDriver API (stdlib only),
so what runs is what a visitor gets: Cloudflare's 301s (terraform/rulesets.tf), the
home page's head sending on what they miss, and a retired page's stub sending on again
(redirects.yml). Every slug any page or article in pages/ or news/ ever had, from the git
history, as the old ?slug= address and the new one; plus the .yml forms the old site
forgave. A good landing is a live page that isn't the 404 page.

    python3 -I scripts/browse-old-links.py [https://enchant.games]

Exits 1 if any address lands on the 404 page or nowhere the build serves.
"""
import glob
import json
import os
import random
import re
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = (sys.argv[1] if len(sys.argv) > 1 else "https://enchant.games").rstrip("/")
PORT = 9515 + random.randrange(400)


def git(*args):
    return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True, check=True).stdout


def slugs(folder):
    """Every slug a top-level YAML file in FOLDER ever carried, from the whole history."""
    out = set()
    for line in git("log", "--all", "-p", "--format=", "--", f"{folder}/*.yml").splitlines():
        m = re.match(r"^[+-]slug:\s*['\"]?([^'\"\s]+)", line)
        if m:
            out.add(m.group(1))
    return sorted(out)


def driver():
    base = sorted(glob.glob(os.path.expanduser("~/.cloakbrowser/chromium-*")))[-1]
    proc = subprocess.Popen([f"{base}/chromedriver", f"--port={PORT}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/status", timeout=1)
            break
        except OSError:
            time.sleep(0.2)
    return base, proc


def call(method, path, body=None):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}{path}", method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["value"]


def main():
    pages, articles = slugs("pages"), slugs("news")
    probe = random.randrange(10**9)
    addresses = []
    for s in [p for p in pages if p != "404"] + ["journal", "news"]:
        addresses.append(f"/?slug={s}")
        if s not in ("journal", "news", "home", "404"):
            addresses.append(f"/{s}/")
    for s in articles:
        addresses.append(f"/?slug=journal&article={s}")
        addresses.append(f"/?slug=news&article={s}")
        if not s.endswith(".yml"):
            addresses.append(f"/?slug=journal&article={s}.yml")
            addresses.append(f"/journal/{s}/")

    base, proc = driver()
    profile = tempfile.mkdtemp(prefix="browse-old-links-")
    session = call("POST", "/session", {"capabilities": {"alwaysMatch": {"goog:chromeOptions": {
        "binary": f"{base}/chrome",
        "args": ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
                 "--window-size=1200,800", f"--user-data-dir={profile}"]}}}})["sessionId"]
    bad = 0
    try:
        for a in addresses:
            url = f"{SITE}{a}{'&' if '?' in a else '?'}probe={probe}"
            call("POST", f"/session/{session}/url", {"url": url})
            # Wait for any redirect the page makes of itself (a head script, a meta refresh).
            last, steady = None, 0
            for _ in range(40):
                href = call("POST", f"/session/{session}/execute/sync", {"script": "return location.href", "args": []})
                steady = steady + 1 if href == last else 0
                if steady >= 3:
                    break
                last = href
                time.sleep(0.15)
            facts = call("POST", f"/session/{session}/execute/sync", {"script": """
                return {href: location.href, title: document.title,
                        missing: !!document.querySelector('blockquote') && /doesn.t exist/.test(document.body.innerText),
                        drawn: !!document.querySelector('#page-body')}""", "args": []})
            landed = re.sub(r"[?&]probe=\d+", "", facts["href"]).replace(SITE, "") or "/"
            ok = facts["drawn"] and not facts["missing"] and "Page Not Found" not in facts["title"]
            bad += not ok
            print(f"{'ok  ' if ok else 'BAD '} {a:<92} -> {landed}  ({facts['title'][:50]})")
    finally:
        call("DELETE", f"/session/{session}")
        proc.terminate()
    print(f"\n{len(addresses) - bad} of {len(addresses)} addresses land on a live page; {bad} don't")
    sys.exit(1 if bad else 0)


main()
