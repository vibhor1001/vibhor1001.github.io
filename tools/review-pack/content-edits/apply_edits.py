#!/usr/bin/env python3
"""Literal-string replacement engine with logging for the content corrections.

Each spec: id, category, find, replace, files (None = all site pages), expect (min,max).
Appends an entry per file-change to audit/replace-log.jsonl for the change log.
Run: python3 apply_edits.py <specs_module>   (module must define SPECS list)
"""
import glob
import importlib.util
import json
import os
import sys

ROOT = "/home/user/propertyflow-website"
SCRATCH = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(SCRATCH, "audit", "replace-log.jsonl")

spec_path = sys.argv[1]
spec_mod = importlib.util.spec_from_file_location("specs", spec_path)
m = importlib.util.module_from_spec(spec_mod)
spec_mod.loader.exec_module(m)
SPECS = m.SPECS

all_pages = sorted(
    p for p in glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True)
    if "/tools/" not in p and "googled" not in p
)

log_f = open(LOG, "a")
errors = 0
for spec in SPECS:
    targets = all_pages if spec.get("files") is None else [os.path.join(ROOT, f) for f in spec["files"]]
    total = 0
    files_changed = []
    for path in targets:
        src = open(path, encoding="utf-8").read()
        n = src.count(spec["find"])
        if n:
            open(path, "w", encoding="utf-8").write(src.replace(spec["find"], spec["replace"]))
            total += n
            files_changed.append(os.path.relpath(path, ROOT))
            log_f.write(json.dumps({
                "id": spec["id"], "category": spec["category"],
                "file": os.path.relpath(path, ROOT), "count": n,
                "find": spec["find"][:220], "replace": spec["replace"][:220],
            }) + "\n")
    lo, hi = spec.get("expect", (1, 10**9))
    status = "OK " if lo <= total <= hi else "!!EXPECT"
    if status != "OK ":
        errors += 1
    print(f"{status} {spec['id']:28s} {total:3d} hits in {len(files_changed):2d} files")

log_f.close()
print(f"\ndone, {errors} spec(s) outside expectation")
sys.exit(1 if errors else 0)
