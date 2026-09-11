#!/usr/bin/env bash
# Deploy the current working tree to the STAGING preview site (a GitHub Pages user site).
# Usage: tools/staging/deploy-staging.sh            (run from anywhere; uses the repo this file lives in)
# Env:   STAGING_REPO  (default rgprince84-prog/rgprince84-prog.github.io)
#        STAGING_DIR   (default <repo>/../.staging-site, a clone of STAGING_REPO)
# What it does: copies the site (minus CNAME, tools/, verification stubs, sitemap), injects a
# noindex meta tag + a STAGING ribbon into every page, blocks robots, commits and pushes.
# Production is untouched: this never writes to simu13/propertyflow-website.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAGING_REPO="${STAGING_REPO:-rgprince84-prog/rgprince84-prog.github.io}"
STAGING_DIR="${STAGING_DIR:-$ROOT/../.staging-site}"

if [ ! -d "$STAGING_DIR/.git" ]; then
  if ! git clone -q "https://github.com/$STAGING_REPO.git" "$STAGING_DIR" 2>/dev/null; then
    mkdir -p "$STAGING_DIR"
    git -C "$STAGING_DIR" init -q -b main
    git -C "$STAGING_DIR" remote add origin "https://github.com/$STAGING_REPO.git"
  fi
fi

rsync -a --delete \
  --exclude '.git' --exclude 'tools/' --exclude '.claude/' --exclude 'CNAME' \
  --exclude 'googled34803605d6d7a43.html' --exclude '584d4803-cd03-48f9-af0e-b0f09f064cc9.html' \
  --exclude 'sitemap.xml' \
  "$ROOT/" "$STAGING_DIR/"

python3 - "$STAGING_DIR" <<'PY'
import os, re, sys
root = sys.argv[1]
META = '<meta name="robots" content="noindex, nofollow">'
RIBBON = ('<div id="pf-staging-ribbon" style="position:fixed;left:12px;bottom:12px;z-index:2147483647;'
          'background:#E65A38;color:#fff;font:600 12px/1 Inter,system-ui,sans-serif;padding:6px 10px;'
          'border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.3);pointer-events:none">STAGING PREVIEW</div>')
n = 0
for dp, _, fs in os.walk(root):
    if '/.git' in dp:
        continue
    for f in fs:
        if not f.endswith('.html'):
            continue
        p = os.path.join(dp, f)
        s = open(p, encoding='utf-8').read()
        if META not in s:
            s = re.sub(r'(<head[^>]*>)', r'\1\n    ' + META, s, count=1)
        if 'pf-staging-ribbon' not in s:
            s = re.sub(r'</body>', RIBBON + '\n</body>', s, count=1)
        open(p, 'w', encoding='utf-8').write(s)
        n += 1
open(os.path.join(root, 'robots.txt'), 'w').write("User-agent: *\nDisallow: /\n")
open(os.path.join(root, '.nojekyll'), 'a').close()
print(f"injected noindex + ribbon into {n} pages")
PY

SRC_HASH="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo worktree)"
git -C "$STAGING_DIR" add -A
if git -C "$STAGING_DIR" diff --cached --quiet; then
  echo "staging: nothing to deploy"
  exit 0
fi
git -C "$STAGING_DIR" -c user.name="PropertyFlow staging" -c user.email="info@propertyflow.uk" \
  commit -q -m "staging deploy from $SRC_HASH"
git -C "$STAGING_DIR" push -q -u origin main
echo "staging deployed: https://${STAGING_REPO%%/*}.github.io/  (source $SRC_HASH)"
