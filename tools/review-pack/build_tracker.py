#!/usr/bin/env python3
"""Build PropertyFlow-Feedback-Tracker.xlsx — the master feedback log for the
marketing coordinator -> developer loop."""
import json
import os

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.workbook.defined_name import DefinedName

SCRATCH = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SCRATCH, "PropertyFlow-Feedback-Tracker.xlsx")

with open(os.path.join(SCRATCH, "pdf", "manifest.json")) as f:
    manifest = json.load(f)
with open(os.path.join(SCRATCH, "pdf", "sheets.json")) as f:
    sheets = json.load(f)
pages = manifest["pages"]
offsets = sheets["offsets"]

CHARCOAL = "141A23"
ORANGE = "E65A38"
CREAM = "FAF8F5"
GREY = "8A92A0"

wb = Workbook()

thin = Side(style="thin", color="D9D4CC")
border = Border(left=thin, right=thin, top=thin, bottom=thin)


def style_header(ws, ncols, row=1):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.fill = PatternFill("solid", fgColor=CHARCOAL)
        cell.font = Font(color="FFFFFF", bold=True, size=11)
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 30


# ── Sheet: How to use ────────────────────────────────────────────────
ws = wb.active
ws.title = "How to use"
ws.sheet_view.showGridLines = False
ws.column_dimensions["A"].width = 4
ws.column_dimensions["B"].width = 130
rows = [
    ("t", "PropertyFlow website feedback tracker"),
    ("p", "Reviewing: https://vibhor1001.github.io/  (staging site, 58 pages) — use together with the PDF review pack "
          "'PropertyFlow-Website-Review-Pack-2026-07-16.pdf'."),
    ("s", ""),
    ("h", "Marketing coordinator — how to log feedback"),
    ("p", "1.  Read the PDF pack page by page (or browse the staging link side-by-side)."),
    ("p", "2.  For every issue, add ONE row on the 'Feedback log' sheet. Use the next FB-number."),
    ("p", "3.  'Page' + 'Sheet' come from the PDF: the dark banner gives the part number (e.g. P07), the grey footer "
          "gives the sheet number within that part."),
    ("p", "4.  Copy the EXACT current text from the PDF (text is selectable) into column E, and write your proposed "
          "replacement in column G. If it applies everywhere, choose page 'Global'."),
    ("p", "5.  Set an Issue type and a Priority. Leave Status = 'New' and Developer notes empty."),
    ("p", "6.  Decide preferred wording for recurring terms on the 'Terminology' sheet — the developer applies these "
          "site-wide."),
    ("p", "7.  When done, send this file + your annotated PDF back by email / shared drive (not GitHub)."),
    ("s", ""),
    ("h", "Developer — how to close the loop"),
    ("p", "•  Work rows in priority order; set Status = 'In progress' → 'Implemented' with any notes in column K."),
    ("p", "•  All changes stay LOCAL (no push, no deploy). When a batch is implemented, export a fresh v2 PDF pack and "
          "return it for verification."),
    ("p", "•  The coordinator re-checks each row and sets 'Verified' (or reopens). Publishing only happens after every "
          "row is Verified / Rejected — final sign-off."),
    ("s", ""),
    ("h", "Status meanings"),
    ("p", "New (logged) → Agreed (dev accepts) → In progress → Implemented (changed locally) → Verified (coordinator "
          "confirmed in v2 pack).  Rejected = will not change (reason in Developer notes)."),
]
r = 1
for kind, text in rows:
    cell = ws.cell(row=r, column=2, value=text)
    if kind == "t":
        cell.font = Font(size=18, bold=True, color=CHARCOAL)
        ws.row_dimensions[r].height = 30
    elif kind == "h":
        cell.font = Font(size=13, bold=True, color=ORANGE)
        ws.row_dimensions[r].height = 22
    else:
        cell.font = Font(size=11, color="333333")
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        if len(text) > 110:
            ws.row_dimensions[r].height = 30
    r += 1

# ── Sheet: Feedback log ──────────────────────────────────────────────
ws = wb.create_sheet("Feedback log")
headers = [
    ("Ref", 8), ("Page\n(part)", 10), ("Sheet\n#", 7), ("Where on the page", 26),
    ("Exact current text", 44), ("Issue type", 18), ("Proposed text", 44),
    ("Why / notes", 30), ("Priority", 12), ("Status", 13), ("Developer notes", 30),
]
for i, (h, w) in enumerate(headers, 1):
    ws.cell(row=1, column=i, value=h.replace("\n", " "))
    ws.column_dimensions[get_column_letter(i)].width = w
style_header(ws, len(headers))
ws.freeze_panes = "A2"

N_ROWS = 300
for rr in range(2, N_ROWS + 2):
    for cc in range(1, len(headers) + 1):
        cell = ws.cell(row=rr, column=cc)
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        cell.border = border

# seeded rows
seed = [
    ["FB-001", "Global", "", "Page <head> — Google Fonts link",
     "fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,0,400;…",
     "Technical (dev)",
     "family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400",
     "The Newsreader font URL returns HTTP 400 on every page, so the serif/italic accent font never loads "
     "and browsers fall back to a default serif. Axis tuples are malformed.",
     "Must fix", "New", ""],
    ["FB-002", "Global", "", "Site-wide terminology",
     "“short-term let” (Home hero) vs “short-let” (Contact hero) vs “STL”",
     "Terminology",
     "(coordinator to decide — record the ruling on the Terminology sheet)",
     "The same concept is spelled three ways across pages. Pick one primary form + allowed abbreviation.",
     "Should fix", "New", ""],
    ["EX-01", "P02", "2", "‘Full Management’ pricing card — first bullet",
     "5% of booking revenue", "Wording & tone", "5% + VAT of booking revenue",
     "EXAMPLE ROW — shows how to fill the log. Delete or overwrite it.",
     "Nice to have", "Rejected", "Example only — not a real change."],
]
for i, row in enumerate(seed):
    for j, val in enumerate(row, 1):
        ws.cell(row=2 + i, column=j, value=val)
    if row[0] == "EX-01":
        for j in range(1, len(headers) + 1):
            ws.cell(row=2 + i, column=j).font = Font(italic=True, color=GREY)

dv_part = DataValidation(type="list", formula1="PartList", allow_blank=True,
                         promptTitle="Page part", prompt="Pick the part number from the PDF banner (or Global).")
dv_type = DataValidation(type="list", allow_blank=True, formula1=
    '"Content accuracy,Wording & tone,Terminology,Spelling & grammar,CTA / button copy,Legal / compliance,Technical (dev),Other"')
dv_prio = DataValidation(type="list", allow_blank=True, formula1='"Must fix,Should fix,Nice to have"')
dv_stat = DataValidation(type="list", allow_blank=True, formula1='"New,Agreed,In progress,Implemented,Verified,Rejected"')
for dv, col in [(dv_part, "B"), (dv_type, "F"), (dv_prio, "I"), (dv_stat, "J")]:
    ws.add_data_validation(dv)
    dv.add(f"{col}2:{col}{N_ROWS + 1}")
ws.auto_filter.ref = f"A1:K{N_ROWS + 1}"

# ── Sheet: Pages ─────────────────────────────────────────────────────
ws = wb.create_sheet("Pages")
headers = [("Part", 8), ("Section", 18), ("Page", 30), ("Path", 40),
           ("Staging URL", 52), ("Starts at PDF page", 17), ("Sheets", 8), ("<title> tag", 60)]
for i, (h, w) in enumerate(headers, 1):
    ws.cell(row=1, column=i, value=h)
    ws.column_dimensions[get_column_letter(i)].width = w
style_header(ws, len(headers))
ws.freeze_panes = "A2"
ws.append(["Global", "—", "Applies site-wide", "—", "https://vibhor1001.github.io/", "", "", ""])
for p in pages:
    off, n = offsets[p["part"]]
    ws.append([p["part"], p["group"], p["label"], p["path"],
               "https://vibhor1001.github.io" + p["path"], off + 1, n, p.get("title", "")])
for rr in range(2, ws.max_row + 1):
    for cc in range(1, len(headers) + 1):
        ws.cell(row=rr, column=cc).border = border
last = ws.max_row
wb.defined_names.add(DefinedName("PartList", attr_text=f"Pages!$A$2:$A${last}"))

# ── Sheet: Terminology ───────────────────────────────────────────────
ws = wb.create_sheet("Terminology")
headers = [("Preferred term (use this)", 34), ("Variants seen on the site", 44),
           ("Where noticed", 26), ("Ruling / notes", 44)]
for i, (h, w) in enumerate(headers, 1):
    ws.cell(row=1, column=i, value=h)
    ws.column_dimensions[get_column_letter(i)].width = w
style_header(ws, len(headers))
ws.freeze_panes = "A2"
seed_terms = [
    ["", "short-term let / short-let / STL", "P01 hero vs P40 hero, various", "Coordinator to decide"],
    ["", "landlord / host / user / owner", "For Landlords section, nav", "Coordinator to decide"],
    ["", "Full Management / Hands-Free / Managed", "Pricing, Platform pages", "Coordinator to decide"],
]
for row in seed_terms:
    ws.append(row)
for rr in range(2, 32):
    for cc in range(1, len(headers) + 1):
        cell = ws.cell(row=rr, column=cc)
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        cell.border = border

wb.save(OUT)
print("wrote", OUT, f"({os.path.getsize(OUT)/1024:.0f} KB)")
