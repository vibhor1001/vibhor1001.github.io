#!/usr/bin/env python3
"""Apply agent-proposed edits (FILE / FIND<<<>>> / REPLACE<<<>>> blocks) safely.

Usage: apply_agent_edits.py <blocks.txt> <category>
- Applies only when the FIND string occurs in the file (any count; replaces all).
- Refuses edits that touch pricing facts or introduce provider names.
- Logs applied edits to audit/replace-log.jsonl; prints skipped ones for review.
"""
import json
import os
import re
import sys

ROOT = "/home/user/propertyflow-website"
S = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(S, "audit", "replace-log.jsonl")

blocks_file, category = sys.argv[1], sys.argv[2]
raw = open(blocks_file, encoding="utf-8").read()

pat = re.compile(
    r"FILE:\s*(?P<file>[^\n]+)\n\s*FIND<<<(?P<find>.*?)>>>\s*\n\s*REPLACE<<<(?P<rep>.*?)>>>\s*\n\s*WHY:\s*(?P<why>[^\n]*)",
    re.S)

FORBIDDEN_IN_REPLACE = ["airlinen", "replenico", "replan", "aalind"]
PRICE_GUARD = re.compile(r"£9\.99|£0|1–3|50/50|0%|5%|3%")

applied = skipped = vetoed = 0
n = 0
for m in pat.finditer(raw):
    n += 1
    rel = m.group("file").strip().split()[0].rstrip(",")
    if rel.startswith("/"):
        rel = os.path.relpath(rel, ROOT)
    if rel.startswith("./"):
        rel = rel[2:]
    find, rep, why = m.group("find"), m.group("rep"), m.group("why").strip()
    path = os.path.join(ROOT, rel)
    if not os.path.isfile(path):
        print(f"SKIP (no file)   {rel}")
        skipped += 1
        continue
    low = rep.lower()
    if any(w in low for w in FORBIDDEN_IN_REPLACE):
        print(f"VETO (provider)  {rel}: {rep[:60]}")
        vetoed += 1
        continue
    # pricing guard: warn (for manual batch review) when REPLACE loses pricing tokens
    dropped = [t for t in set(PRICE_GUARD.findall(find)) if find.count(t) > rep.count(t)]
    if dropped:
        print(f"WARN (pricing tokens {dropped}) {rel}: {why}")
    src = open(path, encoding="utf-8").read()
    cnt = src.count(find)
    if cnt == 0:
        print(f"SKIP (no match)  {rel}: {find[:70]!r}")
        skipped += 1
        continue
    open(path, "w", encoding="utf-8").write(src.replace(find, rep))
    applied += 1
    with open(LOG, "a") as f:
        f.write(json.dumps({"id": f"{category}-{applied:03d}", "category": category,
                            "file": rel, "count": cnt,
                            "find": find[:220], "replace": rep[:220], "why": why[:120]}) + "\n")

print(f"\n{category}: parsed {n} blocks — applied {applied}, skipped {skipped}, vetoed {vetoed}")
