#!/usr/bin/env python3
"""
Rebuild sitemap.xml from the pages actually in the repo.

Run from the repo root:   python3 tools/build-sitemap.py
Check without writing:    python3 tools/build-sitemap.py --check

Why this exists: the sitemap was maintained by hand, so its <lastmod> dates
drifted (every page read 2026-09-07/08 while the site had been edited on the
16th). Search engines use that date to decide what to re-crawl, so a stale
sitemap quietly delays new content being picked up.

What it includes: every .html page under the repo root, as a clean directory
URL (foo/index.html -> /foo/).

What it deliberately EXCLUDES, and why:
  * tools/ and docs/          - not published (robots.txt disallows both)
  * domain-verification files - Trustpilot/Google drop these at the root; they
                                are not pages and carry no <title>/canonical
  * retired URLs              - a page whose rel="canonical" points at a
                                DIFFERENT address is an old URL kept alive for
                                inbound links (e.g. /for-landlords/ -> /for-hosts/).
                                Listing those asks Google to index a page that
                                itself says "the real one is elsewhere".
                                NOTE: these should really be 301 redirects in
                                Cloudflare; canonical-only is the weaker signal.

<lastmod> comes from git (the last commit that touched the file), not the
filesystem, because a checkout or a bulk find/replace rewrites mtimes without
changing what a reader sees.

<priority> is preserved from the existing sitemap so hand-tuned values survive;
anything new gets a sensible default from its depth.
"""

from __future__ import annotations

import re
import subprocess
import sys
from datetime import date
from pathlib import Path

BASE = "https://www.propertyflow.uk"
ROOT = Path(__file__).resolve().parent.parent
SITEMAP = ROOT / "sitemap.xml"

SKIP_DIRS = {".git", "tools", "docs", "node_modules", ".github"}
# Root-level verification drops: a bare hex/uuid name, or Google's googleXXXX.html
VERIFICATION = re.compile(r"^(google[0-9a-f]+|[0-9a-f-]{16,})\.html$", re.I)

CANONICAL = re.compile(r'<link[^>]+rel="canonical"[^>]*>', re.I)
HREF = re.compile(r'href="([^"]+)"', re.I)


def url_for(path: Path) -> str:
    """Repo path -> public URL. foo/index.html -> /foo/ ; bar.html -> /bar.html"""
    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return f"{BASE}/"
    if rel.endswith("/index.html"):
        return f"{BASE}/{rel[: -len('index.html')]}"
    return f"{BASE}/{rel}"


def canonical_of(html: str) -> str | None:
    tag = CANONICAL.search(html)
    if not tag:
        return None
    href = HREF.search(tag.group(0))
    return href.group(1).rstrip() if href else None


def git_date(path: Path) -> str:
    """Last commit date for the file; today's date if it is not committed yet."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", str(path.relative_to(ROOT))],
            cwd=ROOT, capture_output=True, text=True, timeout=30,
        )
        stamp = out.stdout.strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", stamp):
            return stamp
    except Exception:
        pass
    return date.today().isoformat()


def default_priority(url: str) -> str:
    depth = url[len(BASE):].strip("/").count("/")
    if url == f"{BASE}/":
        return "1.0"
    return "0.7" if depth == 0 else "0.6"


def existing_priorities() -> dict[str, str]:
    if not SITEMAP.exists():
        return {}
    text = SITEMAP.read_text(encoding="utf-8")
    found: dict[str, str] = {}
    for block in re.findall(r"<url>(.*?)</url>", text, re.S):
        loc = re.search(r"<loc>(.*?)</loc>", block)
        pri = re.search(r"<priority>(.*?)</priority>", block)
        if loc and pri:
            found[loc.group(1).strip()] = pri.group(1).strip()
    return found


def collect() -> tuple[list[tuple[str, str, str]], list[tuple[str, str]]]:
    """Returns (entries, skipped) where entries are (url, lastmod, priority)."""
    priors = existing_priorities()
    entries: list[tuple[str, str, str]] = []
    skipped: list[tuple[str, str]] = []

    for path in sorted(ROOT.rglob("*.html")):
        rel = path.relative_to(ROOT)
        if set(rel.parts) & SKIP_DIRS:
            continue
        if len(rel.parts) == 1 and VERIFICATION.match(rel.name):
            skipped.append((rel.as_posix(), "domain-verification file"))
            continue

        url = url_for(path)
        html = path.read_text(encoding="utf-8", errors="replace")
        canon = canonical_of(html)
        if canon and canon.rstrip("/") != url.rstrip("/"):
            skipped.append((rel.as_posix(), f"retired - canonical points to {canon}"))
            continue

        entries.append((url, git_date(path), priors.get(url) or default_priority(url)))

    # Homepage first, then by priority (high to low), then alphabetically.
    entries.sort(key=lambda e: (e[0] != f"{BASE}/", -float(e[2]), e[0]))
    return entries, skipped


def render(entries: list[tuple[str, str, str]]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!-- Generated by tools/build-sitemap.py - do not edit by hand. -->',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for url, lastmod, priority in entries:
        lines += [
            "  <url>",
            f"    <loc>{url}</loc>",
            f"    <lastmod>{lastmod}</lastmod>",
            f"    <priority>{priority}</priority>",
            "  </url>",
        ]
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def main() -> int:
    check_only = "--check" in sys.argv
    entries, skipped = collect()
    new = render(entries)
    old = SITEMAP.read_text(encoding="utf-8") if SITEMAP.exists() else ""

    print(f"{len(entries)} pages listed, {len(skipped)} deliberately excluded:")
    for name, why in skipped:
        print(f"  - {name}  ({why})")

    if new == old:
        print("\nsitemap.xml is already up to date.")
        return 0
    if check_only:
        print("\nsitemap.xml is OUT OF DATE. Run: python3 tools/build-sitemap.py")
        return 1

    SITEMAP.write_text(new, encoding="utf-8")
    print(f"\nWrote {SITEMAP.relative_to(ROOT)} ({len(entries)} urls).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
