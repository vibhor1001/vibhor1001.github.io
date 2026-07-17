#!/usr/bin/env python3
"""Extract a plain-text corpus + head metadata from every page for the audit."""
import glob
import html as htmllib
import json
import os
import re

ROOT = "/home/user/propertyflow-website"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audit")
os.makedirs(os.path.join(OUT, "text"), exist_ok=True)

pages = sorted(glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True))
pages = [p for p in pages if "/tools/" not in p and "googled" not in p]

meta_rows = []
edi_rows = []

def clean(s):
    return htmllib.unescape(re.sub(r"\s+", " ", s or "")).strip()

for p in pages:
    rel = os.path.relpath(p, ROOT)
    src = open(p, encoding="utf-8", errors="ignore").read()

    title = clean((re.search(r"<title>(.*?)</title>", src, re.S) or [None, ""])[1])
    desc = clean((re.search(r'name="description"\s+content="([^"]*)"', src) or [None, ""])[1])
    kw = clean((re.search(r'name="keywords"\s+content="([^"]*)"', src) or [None, ""])[1])
    ogt = clean((re.search(r'property="og:title"\s+content="([^"]*)"', src) or [None, ""])[1])

    body = re.sub(r"<script.*?</script>", " ", src, flags=re.S)
    body = re.sub(r"<style.*?</style>", " ", body, flags=re.S)
    body = re.sub(r"<[^>]+>", "\n", body)
    body = htmllib.unescape(body)
    body = re.sub(r"[ \t]+", " ", body)
    body = re.sub(r"\n\s*\n+", "\n", body).strip()

    slug = rel.replace("/index.html", "").replace(".html", "").replace("/", "__") or "home"
    with open(os.path.join(OUT, "text", slug + ".txt"), "w") as f:
        f.write(f"### {rel}\nTITLE: {title}\nDESC: {desc}\nKEYWORDS: {kw}\nOG: {ogt}\n---\n{body}\n")

    n_head = len(re.findall(r"[Ee]dinburgh", title + " " + desc + " " + kw + " " + ogt))
    n_all = len(re.findall(r"[Ee]dinburgh", src))
    n_body = len(re.findall(r"[Ee]dinburgh", body))
    edi_rows.append((rel, n_all, n_head, n_body))
    meta_rows.append((rel, title, desc, kw))

with open(os.path.join(OUT, "meta.tsv"), "w") as f:
    for r in meta_rows:
        f.write("\t".join(r) + "\n")
with open(os.path.join(OUT, "edinburgh-counts.tsv"), "w") as f:
    f.write("file\ttotal_in_html\tin_head_meta\tin_body_text\n")
    for r in sorted(edi_rows, key=lambda x: -x[1]):
        f.write(f"{r[0]}\t{r[1]}\t{r[2]}\t{r[3]}\n")

# pricing-related lines across the corpus
pat = re.compile(r"£|\b\d+(\.\d+)?%|\bfree\b|\bFree\b|propert|Airbnb|OTA|50/50|50-50|per month|/month|booking revenue", re.I)
with open(os.path.join(OUT, "pricing-lines.txt"), "w") as f:
    for p in sorted(glob.glob(os.path.join(OUT, "text", "*.txt"))):
        rel = os.path.basename(p)
        for i, line in enumerate(open(p), 1):
            line = line.strip()
            if line and pat.search(line) and len(line) < 400:
                f.write(f"{rel}:{i}: {line}\n")

print(f"pages: {len(pages)}")
print("top Edinburgh-mention pages (total/head/body):")
for r in sorted(edi_rows, key=lambda x: -x[1])[:12]:
    print(f"  {r[1]:3d} {r[2]:2d} {r[3]:3d}  {r[0]}")
tot = sum(r[1] for r in edi_rows)
print("total Edinburgh mentions in HTML:", tot)
