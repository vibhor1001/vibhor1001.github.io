# Website review-pack tooling

Regenerates the **content review pack** (a single bookmarked PDF of every site
page, A4 landscape, with part numbers P01…P58) and the **feedback tracker
workbook** used for the marketing → developer review loop. First produced
16 Jul 2026 against the staging redesign (`https://vibhor1001.github.io/`).

## Requirements

- Node 18+ with the `playwright` npm package (`npm i playwright`) and a
  Chromium binary — adjust/remove `executablePath` in `render_pages.js`
  and `render_front.js` for your machine (default Playwright Chromium works).
- Python 3.11+ with `requests`, `pypdf`, `openpyxl`, `Pillow`.

## Steps (run from this directory)

```bash
python3 serve_mirror.py 8124 &      # 1. serve the repo root, transcoding .webp -> JPEG
                                    #    (Chromium PDFs embed webp as huge lossless bitmaps)
python3 prefetch_ext.py             # 2. cache Google Fonts + Leaflet for the offline render
node render_pages.js                # 3. render all pages -> pdf/parts/P*.pdf + manifest
python3 generate_front.py           # 4. build cover / how-to-review / sitemap HTML
node render_front.js                #    ... and render them to PDF
python3 merge_assemble.py           # 5. merge everything + bookmarks -> final PDF
python3 build_tracker.py            # 6. build the feedback tracker .xlsx
```

Outputs land in this directory and are git-ignored — the pack is a review
artefact, not site content.

## Maintenance

- **Adding/removing pages:** update the `GROUPS` list at the top of
  `render_pages.js` (order = reading order = bookmark order).
- `serve_mirror.py` serves `/home/user/propertyflow-website` by default —
  change `ROOT` if the repo lives elsewhere.
- The per-page print fixes (cookie banner suppression, counter finalisation,
  fixed-nav handling, HubSpot form placeholder) live in `preparePage()` in
  `render_pages.js`.
