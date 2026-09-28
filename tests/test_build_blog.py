"""
tools/build-blog.py — what marketing's posts turn into.

HOW TO RUN   pip install -r tools/requirements.txt
             python3 -m unittest tests/test_build_blog.py

Marketing never sees the build output (it runs in a GitHub Action), so the
tests that matter most are the forgiving ones: one bad post must not keep the
others off the site, and a bad edit must not take a live post down.
"""
import importlib.util
import io
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("build_blog", REPO / "tools" / "build-blog.py")
bb = importlib.util.module_from_spec(spec)
sys.modules["build_blog"] = bb  # dataclasses look the module up by name
spec.loader.exec_module(bb)

TODAY = date.today()


def post(title="A post", when=TODAY, body="Hello.\n\n## First\n\nText.", extra="", thumb="/images/blog/a.webp"):
    return f"""---
title: "{title}"
date: {when.isoformat()}
description: A description.
thumbnail: {thumb}
thumbnail_alt: An image
{extra}---
{body}
"""


class BuildBlog(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        (self.root / "careers").mkdir()
        shutil.copy(REPO / "careers" / "index.html", self.root / "careers" / "index.html")
        (self.root / "content" / "blog").mkdir(parents=True)
        (self.root / "images" / "blog").mkdir(parents=True)
        (self.root / "images" / "blog" / "a.webp").write_bytes(b"x")
        self.saved = (bb.ROOT, bb.SOURCE, bb.OUT, bb.REFERENCE)
        bb.ROOT, bb.SOURCE, bb.OUT, bb.REFERENCE = (
            self.root, self.root / "content" / "blog", self.root / "blog", self.root / "careers" / "index.html")

    def tearDown(self):
        bb.ROOT, bb.SOURCE, bb.OUT, bb.REFERENCE = self.saved
        shutil.rmtree(self.root)

    def write(self, name, text):
        (self.root / "content" / "blog" / name).write_text(text, encoding="utf-8")

    def build(self, *args):
        old = sys.argv
        sys.argv = ["build-blog.py", *args]
        out = io.StringIO()
        try:
            with redirect_stdout(out):
                code = bb.main()
        finally:
            sys.argv = old
        return code, out.getvalue()

    def page(self, slug):
        return (self.root / "blog" / slug / "index.html").read_text(encoding="utf-8")

    # ─── The happy path ──────────────────────────────────────────────────────

    def test_a_decap_post_becomes_a_page_with_the_site_nav_and_footer(self):
        self.write("my-post.md", post(body="Intro **bold**.\n\n## Section one\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n"))
        code, _ = self.build()
        self.assertEqual(code, 0)
        html = self.page("my-post")
        self.assertIn("<strong>bold</strong>", html)
        self.assertIn("<table>", html)
        self.assertIn('id="section-one"', html)
        self.assertIn('href="#section-one"', html)           # contents list
        self.assertIn('class="hd-footer"', html)              # lifted from careers/
        self.assertIn('href="/blog/">Blog</a>', html)
        self.assertIn('href="/blog/my-post/"', (self.root / "blog" / "index.html").read_text())

    def test_google_title_overrides_the_tab_title(self):
        self.write("p.md", post(extra="meta_title: Short Term Rental Software UK | PropertyFlow\n"))
        self.build()
        self.assertIn("<title>Short Term Rental Software UK | PropertyFlow</title>", self.page("p"))

    def test_without_a_google_title_the_post_title_is_used(self):
        self.write("p.md", post(title="Hello there"))
        self.build()
        self.assertIn("<title>Hello there | PropertyFlow Blog</title>", self.page("p"))

    def test_decap_dates_as_text_or_timestamp_both_work(self):
        self.write("a.md", post().replace(f"date: {TODAY.isoformat()}", f'date: "{TODAY.isoformat()}"'))
        self.write("b.md", post().replace(f"date: {TODAY.isoformat()}", f"date: {TODAY.isoformat()}T09:00:00.000Z"))
        code, _ = self.build()
        self.assertEqual(code, 0)
        self.assertTrue((self.root / "blog" / "a" / "index.html").exists())
        self.assertTrue((self.root / "blog" / "b" / "index.html").exists())

    # ─── Forgiving ───────────────────────────────────────────────────────────

    def test_a_heading_1_in_the_body_is_built_as_heading_2(self):
        self.write("p.md", post(body="# Big heading\n\nText."))
        code, _ = self.build()
        self.assertEqual(code, 0)
        body = self.page("p").split('class="pf-post__body"')[1]
        self.assertNotIn("<h1", body)
        self.assertIn('<h2 id="big-heading">Big heading</h2>', body)

    def test_a_capitalised_file_name_still_gets_a_clean_url(self):
        self.write("My-Post.md", post())
        self.build()
        self.assertTrue((self.root / "blog" / "my-post" / "index.html").exists())

    def test_one_broken_post_does_not_stop_the_others_and_the_run_fails_loudly(self):
        self.write("good.md", post())
        self.write("bad.md", post().replace("description: A description.\n", ""))
        code, out = self.build()
        self.assertEqual(code, 2)                                   # fails the Action → email
        self.assertIn("::warning::build-blog skipped bad.md: missing description", out)
        self.assertTrue((self.root / "blog" / "good" / "index.html").exists())
        self.assertFalse((self.root / "blog" / "bad" / "index.html").exists())

    def test_a_bad_edit_to_a_live_post_keeps_the_live_page(self):
        self.write("live.md", post(title="Live"))
        self.build()
        self.write("live.md", post(title="Live").replace("thumbnail: /images/blog/a.webp", "thumbnail: /images/blog/missing.webp"))
        code, _ = self.build()
        self.assertEqual(code, 2)
        self.assertIn("Live", self.page("live"))

    def test_a_bad_edit_to_a_capitalised_file_keeps_its_live_page_too(self):
        self.write("My-Post.md", post())
        self.build()
        self.write("My-Post.md", post().replace("description: A description.\n", ""))
        code, _ = self.build()
        self.assertEqual(code, 2)
        self.assertTrue((self.root / "blog" / "my-post" / "index.html").exists())

    def test_a_hand_written_page_under_blog_is_never_deleted(self):
        mine = self.root / "blog" / "hand-made" / "index.html"
        mine.parent.mkdir(parents=True)
        mine.write_text("<!DOCTYPE html><title>Mine</title>", encoding="utf-8")
        self.write("p.md", post())
        self.build()
        self.assertTrue(mine.exists())

    def test_underscore_files_are_ignored_even_when_broken(self):
        self.write("_draft.md", "not a post at all")
        self.write("p.md", post())
        code, _ = self.build()
        self.assertEqual(code, 0)
        self.assertFalse((self.root / "blog" / "_draft").exists())

    def test_body_images_load_lazily_and_titles_are_escaped(self):
        (self.root / "images" / "blog" / "chart.webp").write_bytes(b"x")  # not the card image, so it stays in the text
        self.write("p.md", post(title="Fees & <Costs>", body="![A chart](/images/blog/chart.webp)\n\nText."))
        self.build()
        html = self.page("p")
        self.assertIn('<img loading="lazy" decoding="async" alt="A chart"', html)
        self.assertIn("Fees &amp; &lt;Costs&gt;", html)
        self.assertNotIn("<Costs>", html)          # nor in the JSON-LD block

    def test_a_title_cannot_break_out_of_the_json_ld_script(self):
        self.write("p.md", post(title="</script><script>alert(1)</script>"))
        self.build()
        html = self.page("p")
        self.assertNotIn("<script>alert(1)", html)
        import json, re
        for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
            json.loads(block)                       # still valid JSON

    def test_a_deleted_post_is_removed_from_the_site(self):
        self.write("gone.md", post())
        self.build()
        self.assertTrue((self.root / "blog" / "gone" / "index.html").exists())
        (self.root / "content" / "blog" / "gone.md").unlink()
        self.build()
        self.assertFalse((self.root / "blog" / "gone" / "index.html").exists())

    def test_two_files_with_the_same_url_build_one_and_warn(self):
        self.write("same.md", post(title="First"))
        self.write("same_.md", post(title="Second"))  # not "Same.md": macOS file names ignore case
        code, out = self.build()
        self.assertEqual(code, 2)
        self.assertIn("already uses the URL /blog/same/", out)
        self.assertTrue((self.root / "blog" / "same" / "index.html").exists())

    def test_broken_yaml_is_reported_not_crashed_on(self):
        self.write("p.md", '---\ntitle: "unclosed\n---\nBody')
        code, out = self.build()
        self.assertEqual(code, 2)
        self.assertIn("not valid YAML", out)

    def test_an_impossible_date_skips_that_post_only(self):
        self.write("good.md", post())
        self.write("bad.md", post().replace(f"date: {TODAY.isoformat()}", "date: 2026-02-30"))
        code, _ = self.build()
        self.assertEqual(code, 2)
        self.assertTrue((self.root / "blog" / "good" / "index.html").exists())

    def test_a_post_cannot_take_the_list_pages_addresses(self):
        self.write("good.md", post())
        self.write("oldest.md", post(title="Clash"))
        self.write("page.md", post(title="Clash"))
        code, out = self.build()
        self.assertEqual(code, 2)
        self.assertIn("taken by the blog's own list pages", out)
        self.assertNotIn("Clash", (self.root / "blog" / "oldest" / "index.html").read_text())

    def test_a_draft_stays_off_the_site_and_a_live_post_switched_to_draft_comes_down(self):
        self.write("d.md", post(extra="draft: true\n"))
        code, out = self.build()
        self.assertEqual(code, 0)
        self.assertIn("draft, not built: d", out)
        self.assertFalse((self.root / "blog" / "d").exists())
        self.write("d.md", post(extra="draft: false\n"))
        self.build()
        self.assertTrue((self.root / "blog" / "d" / "index.html").exists())
        self.write("d.md", post(extra="draft: true\n"))
        self.build()
        self.assertFalse((self.root / "blog" / "d" / "index.html").exists())

    # ─── Scheduling ──────────────────────────────────────────────────────────

    def test_a_future_post_waits_for_its_day(self):
        self.write("later.md", post(when=TODAY + timedelta(days=1)))
        code, _ = self.build()
        self.assertEqual(code, 0)
        self.assertFalse((self.root / "blog" / "later").exists())
        self.build("--all")
        self.assertTrue((self.root / "blog" / "later" / "index.html").exists())

    # ─── Cover image ─────────────────────────────────────────────────────────

    def test_the_card_image_is_always_the_picture_under_the_title(self):
        self.write("a.md", post())
        self.build()
        self.assertIn('<figure class="pf-post__cover"><img src="/images/blog/a.webp"', self.page("a"))

    def test_a_card_image_also_in_the_text_moves_up_with_its_caption_and_shows_once(self):
        self.write("b.md", post(body="Intro.\n\n![A chart](/images/blog/a.webp)\n\n*(Bookings by channel)*\n\n## Next\n\nText."))
        self.build()
        html = self.page("b")
        self.assertEqual(html.count('src="/images/blog/a.webp"'), 1)
        self.assertIn("<figcaption>(Bookings by channel)</figcaption>", html)
        body = html.split('class="pf-post__body"')[1]
        self.assertNotIn("Bookings by channel", body)
        self.assertIn("Intro.", body)

    def test_an_italic_line_that_is_not_just_a_caption_is_never_swallowed(self):
        self.write("c.md", post(body="![A chart](/images/blog/a.webp)\n\n*Tip:* connect your channels first.\n\n"
                                     "## Costs\n\nSome text.\n\n*(Figure 2)*\n"))
        self.build()
        html = self.page("c")
        body = html.split('class="pf-post__body"')[1]
        for kept in ("Tip:", "connect your channels first.", 'id="costs"', "Some text.", "(Figure 2)"):
            self.assertIn(kept, body)
        self.assertNotIn("<figcaption>", html)

    def test_a_card_image_path_with_an_ampersand_still_moves_up(self):
        (self.root / "images" / "blog" / "a&b.webp").write_bytes(b"x")
        self.write("d.md", post(thumb="/images/blog/a&b.webp", body="![A](/images/blog/a&b.webp)\n\nText."))
        self.build()
        self.assertEqual(self.page("d").count('src="/images/blog/a&amp;b.webp"'), 1)

    def test_the_list_is_4_across_2_on_tablets_1_on_phones(self):
        css = (REPO / "css" / "blog.css").read_text()
        self.assertRegex(css, r"\.pf-cards \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)")
        self.assertRegex(css, r"@media \(max-width: 1024px\) \{\s*\.pf-cards[^}]*repeat\(2, minmax\(0, 1fr\)\)")
        self.assertRegex(css, r"@media \(max-width: 640px\) \{\s*\.pf-cards[^}]*grid-template-columns: minmax\(0, 1fr\)")
        # A cache-buster the pages actually use, so the new grid reaches visitors.
        self.assertIn("/css/blog.css?v=2", (REPO / "tools" / "build-blog.py").read_text())

    def test_each_list_page_has_its_own_description(self):
        for i in range(17):
            self.write(f"p{i}.md", post(title=f"Post {i}"))
        self.build()
        one = (self.root / "blog" / "index.html").read_text()
        two = (self.root / "blog" / "page" / "2" / "index.html").read_text()
        desc = lambda h: h.split('<meta name="description" content="')[1].split('"')[0]
        self.assertNotEqual(desc(one), desc(two))
        self.assertIn("Page 2.", desc(two))


if __name__ == "__main__":
    unittest.main()
