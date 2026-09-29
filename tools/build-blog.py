#!/usr/bin/env python3
"""
Build the blog from content/blog/*.md.

    python3 tools/build-blog.py            # build every post dated today or earlier
    python3 tools/build-blog.py --all      # include future-dated (scheduled) posts, to preview
    python3 tools/build-sitemap.py         # then refresh the sitemap

    Needs: pip install -r tools/requirements.txt   (Markdown, PyYAML)

WHO PRESSES THE BUTTON. Founder, 28 Sep: "they login in admin tab … they post,
our script, live". Marketing writes a post at /admin/ (Decap CMS), which saves
content/blog/<url>.md to main. The GitHub Action .github/workflows/blog.yml runs
this script, commits what it wrote and asks GitHub Pages to rebuild — live in a
minute or two. No approval step: posts are approved before anyone types them in.
A post dated in the future waits; the Action also runs every morning, so it goes
out on the day it is dated. A post marked "draft: true" (the editor's Draft
switch) is saved but kept off the site until the switch is turned off.

A BROKEN POST DOES NOT STOP THE OTHERS. Marketing never sees this script's
output, so a post it cannot build is skipped with a warning and the rest still
go live; the script then exits 2, which fails the Action run so GitHub emails
the repo owner. Anything it can safely fix, it fixes (a heading typed as H1 is
built as H2; the URL is lower-cased).

WHAT IT WRITES (all generated — edit the source or this script, never these):
    blog/index.html                  newest first, 16 per page
    blog/page/N/index.html           further pages, each indexable
    blog/oldest/...                  the same pages oldest first (noindex; canonical to /blog/)
    blog/<slug>/index.html           one per post: hero, contents (TOC), body, share, related

WHY THE NAV AND FOOTER ARE COPIED IN, NOT WRITTEN HERE. The site has no shared
partials: every page carries its own copy of the head scripts, nav and footer.
This script lifts them from REFERENCE (careers/index.html) at build time, so a
site-wide nav/footer/cache-buster edit reaches the blog on the next build
instead of drifting.

A POST SOURCE (content/blog/<slug>.md — the file name is the URL). This is what
Decap writes (admin/config.yml holds the same fields):

    ---
    title: How the 90-night rule works in London
    date: 2026-09-29
    description: One sentence for Google and social cards, under 160 characters.
    thumbnail: /images/blog/90-night-rule.webp
    thumbnail_alt: A row of London terraced houses
    author: PropertyFlow
    category: Compliance
    meta_title: 90-Night Rule London | PropertyFlow     (optional: the browser-tab / Google title)
    ---
    Opening paragraph, in Markdown…

    ## A section

title, date, description, thumbnail and thumbnail_alt are required. The body is
Markdown (tables and inline HTML allowed); its ## and ### headings become the
table of contents. Files starting with "_" are ignored (templates, drafts).
"""

from __future__ import annotations

import html
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from urllib.parse import quote

import markdown
import yaml

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "content" / "blog"
OUT = ROOT / "blog"
REFERENCE = ROOT / "careers" / "index.html"
BASE = "https://www.propertyflow.uk"
PER_PAGE = 16
RELATED = 3
REQUIRED = ("title", "date", "description", "thumbnail", "thumbnail_alt")

e = html.escape  # text and attribute escaping (quote=True by default)


# ─── Posts ────────────────────────────────────────────────────────────────────

@dataclass
class Post:
    slug: str
    title: str
    date: date
    description: str
    thumbnail: str
    thumbnail_alt: str
    author: str = ""
    category: str = ""
    meta_title: str = ""
    draft: bool = False
    body: str = ""
    toc: list[tuple[int, str, str]] = field(default_factory=list)  # (level, id, text)

    @property
    def url(self) -> str:
        return f"/blog/{self.slug}/"

    @property
    def date_label(self) -> str:
        return self.date.strftime("%d %b %Y")  # 28 Sep 2026


FRONT = re.compile(r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)", re.S)
SLUG_OK = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
# /blog/oldest/ and /blog/page/N/ are the list pages; a post there would overwrite them.
RESERVED = {"oldest", "page"}


class PostError(Exception):
    """A post that cannot be built. It is skipped; the others still go live."""


def fail(msg: str) -> None:
    sys.exit(f"build-blog: {msg}")


def as_date(value: object) -> date:
    """YAML reads 2026-09-29 as a date; Decap may also write a full timestamp."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value).strip()[:10], "%Y-%m-%d").date()
    except ValueError:
        raise PostError(f"date must be YYYY-MM-DD, got {value!r}") from None


def to_html(body_md: str) -> str:
    html_body = markdown.markdown(body_md, extensions=["extra", "sane_lists"], output_format="html")
    # The post title is the page's only H1. Decap's toolbar offers "Heading 1",
    # so demote rather than refuse: refusing would silently keep the post off
    # the site, and whoever typed it never sees this script's output.
    html_body = re.sub(r"<(/?)h1(\s|>)", r"<\1h2\2", html_body, flags=re.I)
    return re.sub(r"<img(?![^>]*\bloading=)", '<img loading="lazy" decoding="async"', html_body)


def parse_post(path: Path) -> Post:
    text = path.read_text(encoding="utf-8")
    m = FRONT.match(text)
    if not m:
        raise PostError("must start with a --- details block (title, date, description, thumbnail, thumbnail_alt)")
    try:
        raw = yaml.safe_load(m.group(1)) or {}
    except Exception as exc:  # YAMLError, or ValueError for a date like 2026-02-30
        raise PostError(f"the --- details block is not valid YAML ({exc})") from None
    if not isinstance(raw, dict):
        raise PostError("the --- details block must be a list of name: value lines")
    meta = {str(k).strip().lower(): v for k, v in raw.items()}

    def field_text(k: str) -> str:
        v = meta.get(k)
        return "" if v is None else str(v).strip()

    # A draft may still be half-filled (a Word import with no image yet): it is
    # not built, so nothing else about it needs to be valid.
    if meta.get("draft") is True or field_text("draft").lower() == "true":
        return Post(slug=slugify(path.stem), title=field_text("title"), date=date.today(),
                    description="", thumbnail="", thumbnail_alt="", draft=True)

    missing = [k for k in REQUIRED if not field_text(k)]
    if missing:
        raise PostError(f"missing {', '.join(missing)}")
    slug = slugify(path.stem)
    if not SLUG_OK.match(slug):
        raise PostError("the file name is the URL — use letters, numbers and hyphens")
    if slug in RESERVED:
        raise PostError(f"/blog/{slug}/ is taken by the blog's own list pages — choose another web address")
    thumb = field_text("thumbnail")
    if thumb.startswith("/") and not (ROOT / thumb.lstrip("/")).is_file():
        raise PostError(f"thumbnail {thumb} does not exist")
    post = Post(
        slug=slug, title=field_text("title"), date=as_date(meta["date"]),
        description=field_text("description"), thumbnail=thumb,
        thumbnail_alt=field_text("thumbnail_alt"), author=field_text("author"),
        category=field_text("category"), meta_title=field_text("meta_title"),
    )
    post.body, post.toc = add_heading_ids(to_html(text[m.end():]).strip())
    return post


def slugify(text: str) -> str:
    s = re.sub(r"<[^>]+>", "", text)
    s = html.unescape(s).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "section"


def add_heading_ids(body: str) -> tuple[str, list[tuple[int, str, str]]]:
    """Give every <h2>/<h3> an id (keeping one already set) and collect the TOC."""
    toc: list[tuple[int, str, str]] = []
    used: set[str] = set()

    def repl(m: re.Match) -> str:
        level, attrs, inner = int(m.group(1)), m.group(2) or "", m.group(3)
        existing = re.search(r'\bid="([^"]+)"', attrs)
        hid = existing.group(1) if existing else slugify(inner)
        base, n = hid, 2
        while hid in used:
            hid, n = f"{base}-{n}", n + 1
        used.add(hid)
        text = html.unescape(re.sub(r"<[^>]+>", "", inner)).strip()
        toc.append((level, hid, text))
        if existing:
            attrs = attrs.replace(existing.group(0), f'id="{hid}"')
        else:
            attrs = f' id="{hid}"{attrs}'
        return f"<h{level}{attrs}>{inner}</h{level}>"

    body = re.sub(r"<h([23])(\s[^>]*)?>(.*?)</h\1>", repl, body, flags=re.S | re.I)
    return body, toc


def load_posts(include_future: bool, problems: list[tuple[str, str]]) -> list[Post]:
    """Every post dated today or earlier. A post that cannot be built goes in
    `problems` instead (its URL, what is wrong), so one bad file never keeps
    the rest off the site."""
    if not SOURCE.is_dir():
        return []
    today = date.today()  # the Action sets TZ=Europe/London
    posts: dict[str, Post] = {}
    for path in sorted(SOURCE.glob("*.md")):
        if path.name.startswith("_"):
            continue
        try:
            post = parse_post(path)
        except PostError as exc:
            problems.append((slugify(path.stem), f"{path.name}: {exc}"))
            continue
        if post.slug in posts:
            problems.append((post.slug, f"{path.name}: another post already uses the URL /blog/{post.slug}/"))
            continue
        if post.draft:
            # Saved in the editor but not published: off the site (a live
            # post switched back to draft comes down on this build).
            print(f"  draft, not built: {post.slug}")
            continue
        if post.date > today and not include_future:
            print(f"  scheduled, not built yet: {post.slug} ({post.date.isoformat()})")
            continue
        posts[post.slug] = post
    return sorted(posts.values(), key=lambda p: (p.date, p.slug), reverse=True)


# ─── Site shell, lifted from the reference page ───────────────────────────────

@dataclass
class Shell:
    tracking: str   # GTM + GA4 consent-gated loaders
    icons: str
    styles: str     # fonts + the design-system stylesheets, with their current ?v=
    nav: str
    footer: str
    scripts: str


def cut(src: str, start: str, end: str, *, include_end: bool = True) -> str:
    i = src.find(start)
    j = src.find(end, i)
    if i < 0 or j < 0:
        fail(f"could not find {start!r} … {end!r} in {REFERENCE.relative_to(ROOT)}")
    return src[i:j + len(end)] if include_end else src[i:j]


def load_shell() -> Shell:
    src = REFERENCE.read_text(encoding="utf-8")
    tracking = cut(src, "<!-- Google Tag Manager", '<meta name="viewport"', include_end=False).rstrip()
    icons = "\n".join(l.strip() for l in src.splitlines()
                      if re.search(r'rel="(icon|apple-touch-icon|manifest)"', l))
    fonts = cut(src, "<!-- Google Fonts -->", "</head>", include_end=False)
    styles = "\n".join(l.strip() for l in fonts.splitlines()
                       if 'fonts.g' in l or re.search(r'href="/css/(home-ds|site-ds|pf-nav)\.css', l))
    nav = cut(src, '<nav id="ds-nav"', "</nav>")
    footer = cut(src, '<footer class="hd-footer">', "</footer>")
    after = src[src.find("</footer>") + len("</footer>"):]
    scripts = after[:after.find("</body>")].strip()
    return Shell(tracking, icons, styles, nav, footer, scripts)


def ld_json(data: dict) -> str:
    """JSON for a <script> block. A title such as "</script><script>…" must
    stay text, so <, > and & are written as JSON escapes."""
    text = json.dumps(data, indent=2, ensure_ascii=False)
    return text.replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e")


def page(shell: Shell, *, title: str, description: str, canonical: str, og_type: str,
         image: str, image_alt: str, main: str, extra_head: str = "", robots: str = "",
         jsonld: list[dict] | None = None, body_script: str = "") -> str:
    abs_image = image if image.startswith("http") else BASE + image
    ld = "\n".join(
        f'    <script type="application/ld+json">\n{ld_json(d)}\n    </script>'
        for d in (jsonld or []))
    return f"""<!DOCTYPE html>
<html lang="en-GB">
<head>
    <meta charset="UTF-8">
    <!-- Generated by tools/build-blog.py from content/blog/. Do not edit by hand. -->

    {shell.tracking}
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{e(title)}</title>
    <meta name="description" content="{e(description)}">
    {robots}<link rel="canonical" href="{e(canonical)}">
    <meta property="og:site_name" content="PropertyFlow">
    <meta property="og:type" content="{og_type}">
    <meta property="og:title" content="{e(title)}">
    <meta property="og:description" content="{e(description)}">
    <meta property="og:url" content="{e(canonical)}">
    <meta property="og:image" content="{e(abs_image)}">
    <meta property="og:image:alt" content="{e(image_alt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{e(title)}">
    <meta name="twitter:description" content="{e(description)}">
    <meta name="twitter:image" content="{e(abs_image)}">
{extra_head}
{shell.icons}
{shell.styles}
    <link rel="stylesheet" href="/css/blog.css?v=3">
    <link rel="preconnect" href="https://js-eu1.hs-scripts.com" crossorigin>
{ld}
</head>
<body class="ds-page ds-grain">
    {shell.nav}
    <div class="ds-nav-spacer" aria-hidden="true"></div>

{main}

{shell.footer}
{shell.scripts}
{body_script}
</body>
</html>
"""


# ─── Index ────────────────────────────────────────────────────────────────────

def card(p: Post, *, heading: str = "h2") -> str:
    return f"""<li>
            <a class="pf-card" href="{p.url}">
                <span class="pf-card__thumb"><img src="{e(p.thumbnail)}" alt="{e(p.thumbnail_alt)}" loading="lazy" decoding="async" width="640" height="360"></span>
                <{heading} class="pf-card__title">{e(p.title)}</{heading}>
                <time class="pf-card__date" datetime="{p.date.isoformat()}">{p.date_label}</time>
            </a>
        </li>"""


def index_url(order: str, n: int) -> str:
    base = "/blog/" if order == "newest" else "/blog/oldest/"
    return base if n == 1 else f"{base}page/{n}/"


def pagination(order: str, n: int, pages: int) -> str:
    if pages <= 1:
        return ""
    items = []
    if n > 1:
        items.append(f'<a class="pf-pager__step" href="{index_url(order, n - 1)}" rel="prev">Previous</a>')
    for i in range(1, pages + 1):
        if i == n:
            items.append(f'<span class="pf-pager__num" aria-current="page">{i}</span>')
        else:
            items.append(f'<a class="pf-pager__num" href="{index_url(order, i)}">{i}</a>')
    if n < pages:
        items.append(f'<a class="pf-pager__step" href="{index_url(order, n + 1)}" rel="next">Next</a>')
    return f'<nav class="pf-pager" aria-label="Blog pages">{"".join(items)}</nav>'


def build_index(shell: Shell, posts: list[Post], order: str) -> list[tuple[Path, str]]:
    ordered = posts if order == "newest" else list(reversed(posts))
    pages = max(1, -(-len(ordered) // PER_PAGE))
    out = []
    for n in range(1, pages + 1):
        chunk = ordered[(n - 1) * PER_PAGE:n * PER_PAGE]
        url = index_url(order, n)
        sort = "".join(
            f'<a href="{index_url(o, 1)}"{" aria-current=\"true\"" if o == order else ""}>{label}</a>'
            for o, label in (("newest", "Newest"), ("oldest", "Oldest")))
        grid = (f'<ul class="pf-cards">\n        {"".join(card(p) for p in chunk)}\n    </ul>' if chunk
                else '<p class="pf-blog__empty">The first posts are on their way.</p>')
        main = f"""<main class="pf-blog">
    <section class="ds-phero pf-blog__head">
        <div class="pf-blog__headrow">
            <h1 class="ds-phero__title">Blog</h1>
            <nav class="pf-sort" aria-label="Sort posts">{sort}</nav>
        </div>
        <p class="ds-phero__lead">Guides for UK short-term let hosts: compliance, pricing, channels and running more than one property.</p>
    </section>
    <section class="pf-blog__list">
        {grid}
        {pagination(order, n, pages)}
    </section>
</main>"""
        head = []
        if n > 1:
            head.append(f'    <link rel="prev" href="{BASE}{index_url(order, n - 1)}">')
        if n < pages:
            head.append(f'    <link rel="next" href="{BASE}{index_url(order, n + 1)}">')
        # Oldest-first is the same posts in another order: not a page of its own
        # for search, so noindex and point at the newest-first equivalent.
        canonical = BASE + (url if order == "newest" else index_url("newest", n))
        robots = '<meta name="robots" content="noindex, follow">\n    ' if order == "oldest" else ""
        title = "Blog | PropertyFlow" if n == 1 else f"Blog, page {n} | PropertyFlow"
        # Each page its own description (brief: unique meta per page).
        page_note = "" if n == 1 else f" Page {n}."
        jsonld = [{
            "@context": "https://schema.org", "@type": "Blog", "name": "PropertyFlow Blog",
            "url": f"{BASE}/blog/", "publisher": {"@type": "Organization", "name": "PropertyFlow"},
        }, breadcrumbs([("Home", "/"), ("Blog", "/blog/")])]
        out.append((ROOT / url.lstrip("/") / "index.html", page(
            shell, title=title,
            description="Guides for UK short-term let hosts from PropertyFlow: compliance, pricing, channels and managing more than one property." + page_note,
            canonical=canonical, og_type="website", image="/images/og-default.webp",
            image_alt="PropertyFlow", main=main, extra_head="\n".join(head), robots=robots, jsonld=jsonld)))
    return out


def breadcrumbs(items: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": name, "item": BASE + url}
                            for i, (name, url) in enumerate(items)],
    }


# ─── Article ──────────────────────────────────────────────────────────────────

SHARE_ICON = {
    "linkedin": '<path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8h4.56v14H.22V8zm7.44 0h4.37v1.92h.06c.61-1.15 2.1-2.37 4.32-2.37 4.62 0 5.47 3.04 5.47 7v7.45h-4.56v-6.6c0-1.58-.03-3.6-2.2-3.6-2.2 0-2.53 1.72-2.53 3.49V22H7.66V8z"/>',
    "x": '<path d="M17.75 2h3.37l-7.36 8.41L22.5 22h-6.78l-5.31-6.94L4.33 22H.96l7.87-9L.5 2h6.95l4.8 6.35L17.75 2zm-1.18 18h1.87L6.5 3.9H4.5L16.57 20z"/>',
    "facebook": '<path d="M13.5 22v-8.2h2.77l.41-3.2H13.5V8.56c0-.93.26-1.56 1.59-1.56h1.7V4.13A22.8 22.8 0 0 0 14.31 4c-2.45 0-4.13 1.5-4.13 4.25v2.35H7.4v3.2h2.78V22h3.32z"/>',
    "email": '<path d="M2 5h20v14H2V5zm2 2v.4l8 5.2 8-5.2V7H4zm16 2.8-8 5.2-8-5.2V17h16V9.8z"/>',
    "copy": '<path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/>',
}


def svg(name: str) -> str:
    return f'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">{SHARE_ICON[name]}</svg>'


def share_row(p: Post) -> str:
    u = quote(BASE + p.url, safe="")
    t = quote(p.title, safe="")
    links = [
        ("linkedin", "LinkedIn", f"https://www.linkedin.com/sharing/share-offsite/?url={u}"),
        ("x", "X", f"https://twitter.com/intent/tweet?url={u}&amp;text={t}"),
        ("facebook", "Facebook", f"https://www.facebook.com/sharer/sharer.php?u={u}"),
    ]
    items = [f'<a class="pf-share__btn" href="{href}" target="_blank" rel="noopener noreferrer" aria-label="Share on {label}">{svg(k)}</a>'
             for k, label, href in links]
    items.append(f'<a class="pf-share__btn" href="mailto:?subject={t}&amp;body={u}" aria-label="Share by email">{svg("email")}</a>')
    items.append(f'<button type="button" class="pf-share__btn pf-share__copy" data-url="{e(BASE + p.url)}" aria-label="Copy link">{svg("copy")}<span class="pf-share__copied" aria-live="polite"></span></button>')
    return f"""<section class="pf-share" aria-label="Share this post">
            <p class="pf-share__label">Share this post</p>
            <div class="pf-share__row">{"".join(items)}</div>
        </section>"""


def toc_sections(toc: list[tuple[int, str, str]]) -> list[tuple[str, str]]:
    """The contents list shows the post's sections (its ## headings) only.
    Marketing, 29 Sep: "Show only the subheadings and hide the other headings.
    Keep the section clean". Every FAQ question as its own line is what made
    the list long enough to need a scrollbar."""
    return [(hid, text) for level, hid, text in toc if level == 2]


def toc_html(toc: list[tuple[int, str, str]]) -> str:
    sections = toc_sections(toc)
    if not sections:
        return ""
    parts = ["<ol>"] + [f'<li><a href="#{hid}">{e(text)}</a></li>' for hid, text in sections] + ["</ol>"]
    return f"""<aside class="pf-toc">
            <details class="pf-toc__box" open>
                <summary class="pf-toc__title">On this page</summary>
                <nav aria-label="Table of contents">{"".join(parts)}</nav>
            </details>
        </aside>"""


def related_for(p: Post, posts: list[Post]) -> list[Post]:
    """Same category first, then most recent — the brief's "recently added"."""
    others = [q for q in posts if q.slug != p.slug]
    same = [q for q in others if p.category and q.category == p.category]
    rest = [q for q in others if q not in same]
    return (same + rest)[:RELATED]


def lift_cover(body: str, thumbnail: str) -> tuple[str, str]:
    """Take the card image's first appearance out of the text, with the italic
    caption line straight after it if there is one. Returns (text, caption
    HTML or "")."""
    # The caption is a paragraph that is ONE italic run and nothing else; the
    # match may not cross a </p> or another <em>, or it could swallow sections.
    m = re.search(r'<p>\s*<img [^>]*src="' + re.escape(e(thumbnail)) + r'"[^>]*>\s*</p>'
                  r'(?:\s*<p>\s*<em>((?:(?!</?em\b|</p>).)*)</em>\s*</p>)?', body, re.S)
    if not m:
        return body, ""
    return body[:m.start()] + body[m.end():], m.group(1) or ""


# The heading must BE the FAQ ("FAQs", "Frequently Asked Questions: …"), not
# merely mention one ("Why FAQs matter for SEO").
FAQ_HEADING = re.compile(r"^\s*(faqs?|frequently asked questions)\b", re.I)
BLOCK_START = re.compile(r"\s*<([a-z][a-z0-9]*)\b[^>]*>", re.I)


def first_block(html_text: str) -> tuple[str, str]:
    """Split off the first top-level element (a <p>, a whole <ul> with any
    nested lists, a <table> …). Returns (block, rest)."""
    lead = re.match(r"(?:\s*<!--.*?-->)*", html_text, re.S).end()   # comments are not blocks
    m = BLOCK_START.match(html_text, lead)
    if not m:
        return html_text, ""
    tag = m.group(1).lower()
    if tag in ("hr", "img", "br"):
        return html_text[:m.end()], html_text[m.end():]
    depth = 0
    for t in re.finditer(r"<(/?)" + tag + r"\b[^>]*>", html_text[m.start():], re.I):
        depth += -1 if t.group(1) else 1
        if depth == 0:
            end = m.start() + t.end()
            return html_text[:end], html_text[end:]
    return html_text, ""


def top_level(html_text: str, pos: int) -> bool:
    """True if nothing is left open at pos among list, table and quote tags."""
    before = html_text[:pos]
    return all(
        len(re.findall(rf"<{t}\b", before, re.I)) == len(re.findall(rf"</{t}>", before, re.I))
        for t in ("ul", "ol", "table", "blockquote", "details")
    )


def faq_accordion(body: str) -> str:
    """Turn the post's FAQ section into click-to-open questions (marketing,
    29 Sep: "Users should be able to click a question to expand or collapse its
    answer"). The FAQ section is the ## heading that says FAQ / Frequently
    Asked Questions; each ### under it is a question; its answer is everything
    up to the next ### (or the next ##).

    THE LAST QUESTION. When nothing follows the FAQ but the end of the post, as
    in Post 1, what comes after the last answer is usually the post's closing
    paragraph and call to action, not more answer. There is no marker for where
    the answer stops, so the last answer is its FIRST paragraph (or list or
    table) and the rest stays visible below the accordion. Getting that wrong
    this way shows a paragraph outside a question; the other way would hide the
    call to action inside one. Native <details>, so it works without JS;
    js/blog.js opens a question when a link points at it."""
    h2s = list(re.finditer(r"<h2\b[^>]*>(.*?)</h2>", body, re.S | re.I))
    for i, h in enumerate(h2s):
        if not FAQ_HEADING.search(re.sub(r"<[^>]+>", "", h.group(1))):
            continue
        start = h.end()
        end = h2s[i + 1].start() if i + 1 < len(h2s) else len(body)
        section = body[start:end]
        # Questions are top-level ### headings only: one inside a list, table
        # or quote is part of an answer, and splitting there breaks the HTML.
        qs = [q for q in re.finditer(r"<h3\b[^>]*>.*?</h3>", section, re.S | re.I)
              if top_level(section, q.start())]
        if not qs:
            continue
        items, tail = [], ""
        for j, q in enumerate(qs):
            answer = section[q.end():qs[j + 1].start() if j + 1 < len(qs) else len(section)]
            if j + 1 == len(qs) and i + 1 == len(h2s):
                answer, tail = first_block(answer)
            items.append(f'<details class="pf-faq__item"><summary>{q.group(0)}</summary>'
                         f'<div class="pf-faq__answer">{answer.strip()}</div></details>')
        new_section = section[:qs[0].start()] + '<div class="pf-faq">' + "".join(items) + "</div>" + tail
        return body[:start] + new_section + body[end:]
    return body


def build_article(shell: Shell, p: Post, posts: list[Post]) -> tuple[Path, str]:
    related = related_for(p, posts)
    # Category, date and author on one line under the title (marketing, 29 Sep).
    meta = ([f'<span class="pf-post__cat">{e(p.category)}</span>'] if p.category else []) \
        + [f'<time datetime="{p.date.isoformat()}">{p.date_label}</time>'] \
        + ([f'<span>{e(p.author)}</span>'] if p.author else [])
    meta_html = '<span class="pf-post__sep" aria-hidden="true">·</span>'.join(meta)
    related_html = "" if not related else f"""
    <section class="pf-related" aria-labelledby="related-title">
        <h2 id="related-title" class="pf-related__title">Related posts</h2>
        <ul class="pf-cards pf-cards--related">
        {"".join(card(q, heading="h3") for q in related)}
        </ul>
    </section>"""
    # The card image is always the picture under the title (brief: "Post
    # title (H1) and thumbnail/hero image at the top of the page"). If the text
    # also shows it (a Word post's first diagram doubles as its card image), it
    # moves up rather than showing twice, and its caption comes with it.
    body, caption = lift_cover(p.body, p.thumbnail)
    body = faq_accordion(body)
    figcaption = f"<figcaption>{caption}</figcaption>" if caption else ""
    cover = (f'<figure class="pf-post__cover"><img src="{e(p.thumbnail)}" alt="{e(p.thumbnail_alt)}" '
             f'width="1600" height="900" fetchpriority="high" decoding="async">{figcaption}</figure>')
    main = f"""<main class="pf-blog">
    <article class="pf-post">
        <header class="ds-phero pf-post__hero">
            <a class="pf-post__back" href="/blog/">&larr; All posts</a>
            <h1 class="ds-phero__title pf-post__title">{e(p.title)}</h1>
            <p class="pf-post__meta">{meta_html}</p>
            {cover}
        </header>
        <div class="pf-post__layout{"" if toc_sections(p.toc) else " pf-post__layout--notoc"}">
        {toc_html(p.toc)}
            <div class="pf-post__body">
{body}
            </div>
        </div>
        {share_row(p)}
    </article>{related_html}
</main>"""
    jsonld = [{
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": p.title, "description": p.description,
        "image": [BASE + p.thumbnail if p.thumbnail.startswith("/") else p.thumbnail],
        "datePublished": p.date.isoformat(), "dateModified": p.date.isoformat(),
        "author": {"@type": "Organization" if not p.author or p.author == "PropertyFlow" else "Person",
                   "name": p.author or "PropertyFlow"},
        "publisher": {"@type": "Organization", "name": "PropertyFlow",
                      "logo": {"@type": "ImageObject", "url": f"{BASE}/images/design/pf-logo-dark.svg"}},
        "mainEntityOfPage": BASE + p.url,
    }, breadcrumbs([("Home", "/"), ("Blog", "/blog/"), (p.title, p.url)])]
    extra = f'    <meta property="article:published_time" content="{p.date.isoformat()}">'
    return ROOT / "blog" / p.slug / "index.html", page(
        shell, title=p.meta_title or f"{p.title} | PropertyFlow Blog", description=p.description,
        canonical=BASE + p.url, og_type="article", image=p.thumbnail, image_alt=p.thumbnail_alt,
        main=main, extra_head=extra, jsonld=jsonld,
        body_script='<script src="/js/blog.js?v=2"></script>')


# ─── Write ────────────────────────────────────────────────────────────────────

def main() -> int:
    include_future = "--all" in sys.argv
    shell = load_shell()
    problems: list[tuple[str, str]] = []
    posts = load_posts(include_future, problems)
    files = build_index(shell, posts, "newest") + build_index(shell, posts, "oldest")
    files += [build_article(shell, p, posts) for p in posts]

    # Remove generated pages that no longer have a source (a post deleted or
    # renamed, a page count that shrank). Only index.html files under blog/,
    # and only ones this script wrote. A post that failed to build keeps the
    # page it already has: a bad edit to a live post must not take it down.
    keep = {path for path, _ in files} | {OUT / slug / "index.html" for slug, _ in problems}
    for old in OUT.rglob("index.html") if OUT.is_dir() else []:
        if old not in keep and "tools/build-blog.py" in old.read_text(encoding="utf-8")[:400]:
            old.unlink()
            try:
                old.parent.rmdir()
            except OSError:
                pass

    for path, text in files:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    print(f"build-blog: {len(posts)} post(s), {len(files)} page(s) written under blog/")
    for _, msg in problems:
        # ::warning:: shows on the Action run's summary page. One line only: a
        # newline in a file name must not start a workflow command of its own.
        print("::warning::build-blog skipped " + " ".join(msg.split()))
    return 2 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
