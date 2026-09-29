#!/usr/bin/env python3
"""
Turn Word documents uploaded in the blog editor into draft posts.

    python3 tools/docx-to-post.py          # convert every .docx in images/blog/
    python3 tools/docx-to-post.py FILE…    # convert these (to try one out)

    Needs: pip install -r tools/requirements.txt

WHY. Founder, 28 Sep: "add an option to upload a doc and convert that doc into
draft post, since marketing don't hold any tech knowledge". In the editor
(/admin/) they click Media → Upload and pick the Word file. Decap saves it to
images/blog/ (its media folder, the only place its uploads can go). The Blog
Action (.github/workflows/blog.yml) then runs this script. It writes
content/blog/<url>.md with "draft: true" plus the post's pictures, and deletes
the .docx. A minute or two later the draft is in the editor's Blog posts list.
They check it, turn Draft off and press Publish.

WHAT IT READS FROM THE DOCUMENT. Marketing's Word posts start with a few label
lines, as Post 1 did:

    Meta Title: Short Term Rental Management Software UK | PropertyFlow
    Recommended URL: /short-term-rental-management-software-uk/
    Primary Keyword: short term rental management software uk
    <Heading 1 (or Word's "Title" style): the post title>
    Meta Description: Learn what …

Labels are read ONLY in that opening block, up to the first ordinary
paragraph. A line further down that happens to start "Description:" or "URL:"
is text, and stays. Meta Title becomes the Google title, Recommended URL the
web address, Meta Description the Google description. Primary Keyword and
similar notes are dropped. Anything missing is left empty for marketing to
fill in; with no Recommended URL, the web address comes from the title.

THE TEXT IS NOT CHANGED. Headings, bold, italics, links, lists and tables
carry over. Characters that mean something in Markdown or HTML ("*", "#1",
"<guest name>") are escaped, so they show as typed, and nothing typed in Word
can become code on the page. Links other than web, email and phone links are
dropped (the words stay). Each picture becomes a WebP of at most 1600px wide in
images/blog/word/<url>/. Only this script writes in that folder, so replacing
a draft's pictures can never touch anyone else's. The line in brackets under a
picture, if there is one, becomes its description. The first picture is also
the card image. A picture that cannot be converted is left out, and a note at
the top of the draft says so, where marketing will see it.

RE-UPLOADING a corrected document replaces its draft. It never replaces a post
that is already live: that one gets a new web address (…-2) and stays a draft,
so nothing on the site changes by surprise. Decap never renames a file, so if
marketing changes a DRAFT's web address in the editor, this script renames the
file to match (a live post's address never changes).

A document that cannot be read is left where it is and reported, and so is an
upload that is not a .docx (.doc, .pdf …). The script then exits 2, so the
Action run fails and GitHub emails the repo owner.

PICTURES UPLOADED STRAIGHT INTO THE EDITOR (a card image, a picture added to
the text) are shrunk too, so a 5 MB PNG does not slow the page (brief:
"compress hero images"). The picture is first re-saved in place, at most 1600px
wide and only when that makes it clearly smaller, so the same picture is not
recompressed every run. If it is STILL heavy (a photo saved as PNG hardly
shrinks: Post 1's 1.7 MB card image), it becomes a WebP next to it. Every post
that uses the old name is pointed at the new one, and the old file goes.
"""

from __future__ import annotations

import html
import io
import re
import shutil
import sys
import zipfile
from datetime import date
from pathlib import Path

import mammoth
import yaml
from markdownify import MarkdownConverter
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / "images" / "blog"          # Decap's media folder (admin/config.yml)
POSTS = ROOT / "content" / "blog"
IMAGES = ROOT / "images" / "blog" / "word"  # this script's own folder
MAX_WIDTH = 1600
MAX_HEIGHT = 16000                          # WebP cannot go past 16383px
MAX_UNZIPPED = 80 * 1024 * 1024             # a Word post is a few MB; refuse zip bombs
RESERVED = {"oldest", "page"}               # the blog's own list pages (build-blog.py)
NOT_WORD = {".doc", ".odt", ".rtf", ".pages", ".pdf", ".txt"}
SHRINK = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".webp": "WEBP"}  # GIFs may be animated: left alone
BIG_BYTES = 400 * 1024
PICTURE_FORMATS = ["PNG", "JPEG", "GIF", "WEBP", "BMP", "TIFF"]

# Label lines at the top of a Word post → the post field they fill.
LABELS = [
    (re.compile(r"^(meta\s*title|seo\s*title|title\s*tag|page\s*title)$", re.I), "meta_title"),
    (re.compile(r"^(recommended\s*url|url|slug|web\s*address|permalink)$", re.I), "url"),
    (re.compile(r"^(meta\s*description|description|seo\s*description)$", re.I), "description"),
    (re.compile(r"^(primary\s*keyword|secondary\s*keywords?|keywords?|focus\s*keyword|word\s*count|author|category)$", re.I), None),
]
LABEL_LINE = re.compile(r"^\s*([A-Za-z][A-Za-z ]{1,30}?)\s*:\s*(.*)$", re.S)
# Word's own guesses at a picture description ("A screenshot of a computer
# Description automatically generated", "… AI-generated content may be
# incorrect."): the caption, or the title, is better.
AUTO_ALT = re.compile(r"automatically generated|AI-generated content", re.I)
SAFE_HREF = re.compile(r"^(https?:|mailto:|tel:|/|#)", re.I)
STYLE_MAP = "p[style-name='Title'] => h1:fresh\np[style-name='Subtitle'] => p:fresh"


class DocError(Exception):
    """This document cannot be turned into a post; it is left for a person."""


def slugify(text: str) -> str:
    s = html.unescape(re.sub(r"<[^>]+>", "", text)).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80].strip("-")


def text_of(fragment: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", fragment)).split())


# ─── Word → HTML ──────────────────────────────────────────────────────────────

def read_docx(path: Path) -> tuple[str, list[bytes]]:
    """The document as HTML, with pictures replaced by @@IMG<n>@@ markers."""
    try:
        with zipfile.ZipFile(path) as z:
            if sum(i.file_size for i in z.infolist()) > MAX_UNZIPPED:
                raise DocError("is too large once unpacked (over 80 MB)")
    except zipfile.BadZipFile:
        raise DocError("could not be read as a Word document (.docx)") from None

    images: list[bytes] = []

    def keep(image):
        with image.open() as f:
            images.append(f.read())
        return {"src": f"@@IMG{len(images) - 1}@@", "alt": image.alt_text or ""}

    try:
        with path.open("rb") as f:
            result = mammoth.convert_to_html(
                f, convert_image=mammoth.images.img_element(keep), style_map=STYLE_MAP)
    except Exception as exc:  # corrupt, password-protected …
        raise DocError(f"could not be read as a Word document ({exc.__class__.__name__})") from None
    return result.value, images


def take_header(body: str) -> tuple[str, dict[str, str], str]:
    """Read the opening block: label lines and the Heading 1 title, up to the
    first ordinary paragraph. Returns (the rest, fields, title)."""
    fields: dict[str, str] = {}
    title = ""
    pos = 0
    waiting: str | None = None   # a label whose value is on the next line
    block = re.compile(r"\s*<(p|h1)\b[^>]*>(.*?)</\1>", re.S)
    while True:
        m = block.match(body, pos)
        if not m:
            break
        tag, inner = m.group(1), m.group(2)
        if tag == "h1":
            if title:
                break
            title = text_of(inner)
            pos = m.end()
            continue
        # Shift+Enter puts several labels in one paragraph, split by <br />.
        lines = [text_of(x) for x in re.split(r"<br\s*/?>", inner)]
        lines = [x for x in lines if x]
        if not lines:
            pos = m.end()
            continue
        if waiting and len(lines) == 1 and not LABEL_LINE.match(lines[0]):
            fields.setdefault(waiting, lines[0])
            waiting = None
            pos = m.end()
            continue
        parsed = [label_of(x) for x in lines]
        if not all(p is not None for p in parsed):
            break                    # the first ordinary paragraph: the post begins
        for field, value in parsed:
            if field and value:
                fields.setdefault(field, value)
            waiting = field if (field and not value) else None
        pos = m.end()
    rest = body[pos:]
    if not title:
        # No Heading 1 in the opening block: take the first one further down.
        m = re.search(r"<h1[^>]*>(.*?)</h1>", rest, re.S)
        if m:
            title = text_of(m.group(1))
            rest = rest[:m.start()] + rest[m.end():]
    return rest, fields, title


def label_of(line: str) -> tuple[str | None, str] | None:
    """(field or None to drop, value) for a label line; None for ordinary text."""
    m = LABEL_LINE.match(line)
    if not m:
        return None
    label, value = m.group(1).strip(), m.group(2).strip()
    for pattern, field in LABELS:
        if pattern.match(label):
            return field, value
    return None


def tidy(body: str) -> str:
    body = re.sub(r'<a id="[^"]*"></a>', "", body)           # Word bookmarks
    # "Use<a> Channel Manager</a>" → "Use <a>Channel Manager</a>": Word keeps the
    # space inside the link or bold; Markdown needs it outside.
    for _ in range(3):
        body = re.sub(r"<(a [^>]*|strong|em)>(\s+)", r"\2<\1>", body)
        body = re.sub(r"(\s+)</(a|strong|em)>", r"</\2>\1", body)
    body = re.sub(r"<table>.*?</table>", fix_table, body, flags=re.S)
    # A picture in its own paragraph (not in a table), so it is not glued to
    # the text around it.
    parts = re.split(r"(<table>.*?</table>)", body, flags=re.S)
    for i in range(0, len(parts), 2):
        parts[i] = re.sub(r"(?:<strong>|<em>)*(<img [^>]*/?>)(?:</strong>|</em>)*", r"</p><p>\1</p><p>", parts[i])
    body = "".join(parts)
    body = re.sub(r"<p>\s*</p>", "", body)
    body = re.sub(r"<(strong|em)>\s*</\1>", "", body)
    return body


def fix_table(m: re.Match) -> str:
    """First row is the header; Word often marks every row as one."""
    rows = re.findall(r"<tr>(.*?)</tr>", m.group(0), re.S)
    if not rows:
        return m.group(0)
    out = []
    for i, row in enumerate(rows):
        cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, re.S)
        # Markdown table cells are one line: paragraphs inside a cell join up.
        cells = [re.sub(r"\s*</p>\s*<p>\s*", " ", c) for c in cells]
        cells = [re.sub(r"</?p>", "", c).strip() for c in cells]
        tag = "th" if i == 0 else "td"
        out.append("<tr>" + "".join(f"<{tag}>{c}</{tag}>" for c in cells) + "</tr>")
    return f"<table><thead>{out[0]}</thead><tbody>{''.join(out[1:])}</tbody></table>"


# ─── HTML → Markdown ──────────────────────────────────────────────────────────

class Markdown(MarkdownConverter):
    """markdownify, with Word's words kept as words. build-blog.py lets raw
    HTML through (writers may use it), so text from a document must be escaped
    here: "&lt;script&gt;" typed in Word stays those characters on the page."""

    def escape(self, text, parent_tags):
        text = super().escape(text, parent_tags)   # * and _ (options below)
        text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if parent_tags & {"td", "th"}:
            text = text.replace("|", "\\|")          # would end the table cell
        # Line-start markers that would turn a sentence into a heading or list.
        text = re.sub(r"^(\s*)(#{1,6})(?=\s|\d|$)", r"\1\\\2", text)
        text = re.sub(r"^(\s*)([+-])(?=\s)", r"\1\\\2", text)
        text = re.sub(r"^(\s*\d+)\.(?=\s)", r"\1\\.", text)
        return text

    def convert_a(self, el, text, parent_tags):
        href = (el.get("href") or "").strip()
        if href and not SAFE_HREF.match(href):
            del el["href"]                           # javascript:, data:, file: … keep the words
        return super().convert_a(el, text, parent_tags)


def to_markdown(body: str) -> str:
    md = Markdown(heading_style="ATX", bullets="-", strong_em_symbol="*",
                  escape_asterisks=True, escape_underscores=True, escape_misc=False,
                  keep_inline_images_in=["td", "th"]).convert(body)
    md = re.sub(r"^# ", "## ", md, flags=re.M)      # the title is the only H1
    # markdownify indents nested list items by 2-3 spaces; the site's Markdown
    # needs 4 or they come out flat.
    md = re.sub(r"^( +)(?=(?:[-*+]|\d+\.) )", lambda m: " " * (len(m.group(1)) * 2), md, flags=re.M)
    return re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"


# ─── Pictures ─────────────────────────────────────────────────────────────────

def save_images(body: str, images: list[bytes], slug: str, fallback_alt: str) -> tuple[str, list[tuple[str, str]], int]:
    """Write each picture as WebP; return the body pointing at them,
    [(path, alt)] in order, and how many pictures had to be left out."""
    folder = IMAGES / slug
    saved: list[tuple[str, str]] = []
    dropped = 0
    for n, data in enumerate(images):
        marker = f"@@IMG{n}@@"
        tag = re.search(r'<img [^>]*src="' + re.escape(marker) + r'"[^>]*/?>', body)
        if not tag:
            continue
        try:
            img = Image.open(io.BytesIO(data), formats=PICTURE_FORMATS)
            img.load()
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA" if ("A" in img.getbands() or img.mode == "P") else "RGB")
            img.thumbnail((MAX_WIDTH, MAX_HEIGHT), Image.LANCZOS)   # only ever shrinks
            folder.mkdir(parents=True, exist_ok=True)
            name = f"{len(saved) + 1}.webp"
            img.save(folder / name, "WEBP", quality=82, method=6)
        except Exception as exc:
            # A picture WebP cannot take (a Windows metafile chart, a huge or
            # broken image): leave it out rather than lose the whole post.
            body = body[:tag.start()] + body[tag.end():]
            dropped += 1
            print(f"  picture {n + 1} left out ({exc.__class__.__name__})")
            continue
        src = f"/images/blog/word/{slug}/{name}"

        own = re.search(r'alt="([^"]*)"', tag.group(0))
        alt = " ".join(html.unescape(own.group(1)).split()) if own else ""
        if AUTO_ALT.search(alt):
            alt = ""
        # tidy() leaves a picture in its own paragraph; a caption is the
        # italic paragraph straight after it.
        cap = re.match(r"\s*</p>\s*<p>\s*<em>(.*?)</em>\s*</p>", body[tag.end():tag.end() + 800], re.S)
        if cap and not alt:
            alt = text_of(cap.group(1)).strip("() ").rstrip(".")
        # One line, and no square brackets: they would end the Markdown ![alt](…).
        alt = " ".join((alt or fallback_alt).split()).replace("[", "(").replace("]", ")")
        body = body[:tag.start()] + f'<img alt="{html.escape(alt, quote=True)}" src="{src}" />' + body[tag.end():]
        saved.append((src, alt))
    # Anything left is a picture linked from outside the document: not ours.
    body = re.sub(r'<img (?![^>]*src="/images/blog/word/)[^>]*/?>', "", body)
    return body, saved, dropped


# ─── One document ─────────────────────────────────────────────────────────────

def front_matter(path: Path) -> dict | None:
    """The post's fields; None if there is no such post. Unreadable → {} (live)."""
    if not path.exists():
        return None
    m = re.match(r"\A---\s*\n(.*?)\n---", path.read_text(encoding="utf-8"), re.S)
    try:
        meta = yaml.safe_load(m.group(1)) if m else {}
    except Exception:
        meta = {}
    return meta if isinstance(meta, dict) else {}


def is_draft(meta: dict | None) -> bool:
    return bool(meta) and (meta.get("draft") is True or str(meta.get("draft")).lower() == "true")


def choose_slug(wanted: str) -> str:
    """The wanted web address, unless a live post has it (then -2, -3 …)."""
    base = wanted if wanted not in RESERVED else f"{wanted}-post"
    slug, n = base, 2
    while True:
        meta = front_matter(POSTS / f"{slug}.md")
        if meta is None or is_draft(meta):
            return slug
        slug, n = f"{base}-{n}", n + 1


def convert(path: Path) -> str:
    body, images = read_docx(path)
    body, fields, title = take_header(body)
    meta_title = fields.get("meta_title", "")
    if not title:
        title = re.sub(r"\s*[|–—-]\s*PropertyFlow\s*$", "", meta_title, flags=re.I) or path.stem.replace("-", " ").strip()
    if not text_of(body) and "@@IMG" not in body:
        raise DocError("has no text to turn into a post")

    wanted = slugify(fields.get("url", "").strip("/ ").split("/")[-1]) or slugify(title) or slugify(path.stem)
    if not wanted:
        raise DocError("gives no web address and has no title to make one from")
    slug = choose_slug(wanted)

    # This draft's earlier pictures (only this script writes in word/<slug>/).
    shutil.rmtree(IMAGES / slug, ignore_errors=True)

    body = tidy(body)
    body, saved, dropped = save_images(body, images, slug, title)
    markdown = to_markdown(body)
    if dropped:
        many = "pictures" if dropped > 1 else "picture"
        markdown = (f"> **Note from the Word upload:** {dropped} {many} from the document could not be "
                    f"converted and {'were' if dropped > 1 else 'was'} left out. Add {'them' if dropped > 1 else 'it'} "
                    "again with the image button, then delete this note.\n\n" + markdown)

    front = {
        "title": title,
        "url": slug,
        "draft": True,
        "date": date.today().isoformat(),
        "description": fields.get("description", ""),
        "meta_title": meta_title,
        "thumbnail": saved[0][0] if saved else "",
        "thumbnail_alt": saved[0][1] if saved else "",
        "author": "PropertyFlow",
    }
    text = "---\n" + yaml.safe_dump(front, sort_keys=False, allow_unicode=True, width=10_000) + "---\n" + markdown
    (POSTS / f"{slug}.md").write_text(text, encoding="utf-8")
    return slug


def rename_drafts() -> None:
    """Decap never renames a file, and the file name is the URL. So a draft
    whose Web address field was changed in the editor is renamed to match.
    Live posts are left alone: their address must not change under them."""
    for path in sorted(POSTS.glob("*.md")):
        meta = front_matter(path)
        if not is_draft(meta):
            continue
        want = slugify(str(meta.get("url") or ""))
        if not want or want == path.stem or want in RESERVED:
            continue
        target = POSTS / f"{want}.md"
        if target.exists():
            print(f"::warning::docx-to-post: the draft {path.name} asks for the web address {want}, which another post has")
            continue
        path.rename(target)
        print(f"docx-to-post: draft {path.name} renamed to {target.name} (its web address was changed)")


def shrink_uploads() -> None:
    """Editor uploads in images/blog/ (not word/, which is already small):
    shrink the large ones in place, same name and format."""
    for path in sorted(p for p in INBOX.iterdir() if p.is_file() and p.suffix.lower() in SHRINK):
        size = path.stat().st_size
        try:
            with Image.open(path, formats=PICTURE_FORMATS) as img:
                img.load()
                if getattr(img, "is_animated", False):
                    continue                  # an animation would come out as one still frame
                if img.width <= MAX_WIDTH and size <= BIG_BYTES:
                    continue
                fmt = SHRINK[path.suffix.lower()]
                icc = img.info.get("icc_profile")
                # A phone photo stores "rotate me" in EXIF; re-saving drops the
                # EXIF, so turn the pixels the right way up first.
                out = ImageOps.exif_transpose(img)
                if out.mode == "P":
                    out = out.convert("RGBA")  # smooth resizing, not nearest-neighbour
                out.thumbnail((MAX_WIDTH, MAX_HEIGHT), Image.LANCZOS)
                if fmt == "JPEG" and out.mode not in ("RGB", "L", "CMYK"):
                    out = out.convert("RGB")
                buf = io.BytesIO()
                options = {"PNG": {"optimize": True}, "JPEG": {"quality": 82, "optimize": True, "progressive": True},
                           "WEBP": {"quality": 82, "method": 6}}[fmt]
                if icc:
                    options["icc_profile"] = icc      # keep the colours (Display-P3 photos, CMYK)
                out.save(buf, fmt, **options)
        except Exception as exc:
            print("::warning::" + one_line(f"docx-to-post: the picture {path.name} could not be checked ({exc.__class__.__name__})"))
            continue
        # Only when clearly lighter. The point is page speed, and a wide
        # picture that is already light gains nothing. Re-saving a JPEG that
        # is already small would lose quality on every run.
        if buf.tell() < size * 0.9:
            path.write_bytes(buf.getvalue())
            print(one_line(f"docx-to-post: shrank {path.name} from {size // 1024} KB to {buf.tell() // 1024} KB"))
        if fmt != "WEBP" and path.stat().st_size > BIG_BYTES:
            to_webp(path)


def to_webp(path: Path) -> None:
    """A picture still over BIG_BYTES after shrinking becomes <name>.webp, and
    every post that uses it is pointed at the new file. Skipped if that name is
    taken, or if the WebP would not be lighter."""
    target = path.with_suffix(".webp")
    if target.exists():
        return
    try:
        with Image.open(path, formats=PICTURE_FORMATS) as img:
            img.load()
            # Modes that convert to WebP faithfully. CMYK and 16-bit greyscale
            # come out with the wrong colours (and the original is deleted), so
            # those keep their in-place shrink only.
            if img.mode not in ("RGB", "RGBA", "L", "LA", "P"):
                return
            out = ImageOps.exif_transpose(img)
            if out.mode not in ("RGB", "RGBA"):
                out = out.convert("RGBA" if ("A" in out.getbands() or out.mode == "P") else "RGB")
            out.thumbnail((MAX_WIDTH, MAX_HEIGHT), Image.LANCZOS)
            buf = io.BytesIO()
            icc = img.info.get("icc_profile")
            out.save(buf, "WEBP", quality=82, method=6, **({"icc_profile": icc} if icc else {}))
    except Exception as exc:
        print("::warning::" + one_line(f"docx-to-post: could not convert {path.name} to WebP ({exc.__class__.__name__})"))
        return
    if buf.tell() >= path.stat().st_size * 0.9:
        return
    old_url, new_url = f"/images/blog/{path.name}", f"/images/blog/{target.name}"
    target.write_bytes(buf.getvalue())
    # Whole names only: /images/blog/a.png, never inside a.png.bak or xa.png.
    ref = re.compile(re.escape(old_url) + r"(?![A-Za-z0-9._~/-])")
    for post in sorted(POSTS.glob("*.md")):
        text = post.read_text(encoding="utf-8")
        new_text = ref.sub(new_url, text)
        if new_text != text:
            post.write_text(new_text, encoding="utf-8")
            print(one_line(f"docx-to-post: {post.name} now uses {target.name}"))
    before = path.stat().st_size
    path.unlink()
    print(one_line(f"docx-to-post: converted {path.name} ({before // 1024} KB) to {target.name} ({buf.tell() // 1024} KB)"))


def one_line(text: str) -> str:
    """A message for the Action log: one line, so no file name or document
    text can start a workflow command of its own."""
    return " ".join(text.split())


def main() -> int:
    POSTS.mkdir(parents=True, exist_ok=True)
    explicit = [Path(a) for a in sys.argv[1:]]
    docs = explicit or sorted(INBOX.glob("*.docx"))
    problems = 0
    for doc in docs:
        try:
            slug = convert(doc)
        except DocError as exc:
            problems += 1
            print("::warning::" + one_line(f"docx-to-post: {doc.name} {exc}. It was left in images/blog/."))
            continue
        except Exception as exc:  # a bug here must not block every later upload
            problems += 1
            print("::warning::" + one_line(f"docx-to-post: {doc.name} could not be converted "
                                           f"({exc.__class__.__name__}: {exc}). It was left in images/blog/."))
            continue
        if not explicit:
            doc.unlink()  # the upload has done its job; the draft replaces it
        print(one_line(f"docx-to-post: {doc.name} → draft content/blog/{slug}.md"))
    if not explicit:
        for other in sorted(p for p in INBOX.iterdir() if p.is_file() and p.suffix.lower() in NOT_WORD):
            problems += 1
            print("::warning::" + one_line(f"docx-to-post: {other.name} is not a Word .docx file, so it was not "
                                           "turned into a post. Open it in Word, Save As .docx, and upload that."))
        rename_drafts()
        shrink_uploads()
    if not docs:
        print("docx-to-post: no Word documents to convert")
    return 2 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
