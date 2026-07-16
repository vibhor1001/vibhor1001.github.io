#!/usr/bin/env python3
"""Merge front matter + all page parts into the final review PDF with bookmarks."""
import json
import os

from pypdf import PdfReader, PdfWriter

SCRATCH = os.path.dirname(os.path.abspath(__file__))
PARTS = os.path.join(SCRATCH, "pdf", "parts")
FRONT = os.path.join(SCRATCH, "front")
OUT = os.path.join(SCRATCH, "PropertyFlow-Website-Review-Pack-2026-07-16.pdf")

with open(os.path.join(SCRATCH, "pdf", "manifest.json")) as f:
    manifest = json.load(f)
pages = manifest["pages"]
missing = [p["part"] for p in pages if not p.get("file")]
if missing:
    raise SystemExit(f"ABORT: parts missing from render: {missing}")

writer = PdfWriter()
offsets = {}
cursor = 0

def append(pdf_path, key):
    global cursor
    r = PdfReader(pdf_path)
    writer.append(r, import_outline=False)
    offsets[key] = (cursor, len(r.pages))
    cursor += len(r.pages)

append(os.path.join(FRONT, "cover.pdf"), "cover")
append(os.path.join(FRONT, "guide.pdf"), "guide")
append(os.path.join(FRONT, "sitemap.pdf"), "sitemap")
for p in pages:
    append(os.path.join(PARTS, p["file"]), p["part"])

# outline
writer.add_outline_item("Cover", offsets["cover"][0])
writer.add_outline_item("How to review & give feedback", offsets["guide"][0])
writer.add_outline_item("Sitemap & reading order", offsets["sitemap"][0])
current_group = None
group_item = None
for p in pages:
    if p["group"] != current_group:
        current_group = p["group"]
        group_item = writer.add_outline_item(current_group, offsets[p["part"]][0])
    writer.add_outline_item(f'{p["part"]} · {p["label"]}', offsets[p["part"]][0], parent=group_item)

writer.add_metadata({
    "/Title": "PropertyFlow Website Content Review Pack — staging vibhor1001.github.io (16 Jul 2026)",
    "/Author": "PropertyFlow",
    "/Subject": "Line-by-line content, wording and terminology review of the new website (58 pages)",
})

writer.compress_identical_objects(remove_identicals=True, remove_orphans=True)
with open(OUT, "wb") as f:
    writer.write(f)

sheets = {k: v for k, v in offsets.items()}
with open(os.path.join(SCRATCH, "pdf", "sheets.json"), "w") as f:
    json.dump({"offsets": sheets, "total_sheets": cursor}, f, indent=1)

mb = os.path.getsize(OUT) / 1e6
print(f"MERGED: {OUT}")
print(f"  total sheets: {cursor}  |  size: {mb:.1f} MB")
for p in pages[:5]:
    off, n = offsets[p["part"]]
    print(f"  {p['part']} starts at PDF page {off+1} ({n} sheets)")
