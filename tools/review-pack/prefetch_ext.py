#!/usr/bin/env python3
"""Prefetch the external resources the site pages need, so the PDF renderer can
serve them to Chromium locally (Chromium has no proxy access in this env).
Produces extdeps/<files> + extdeps/manifest.json mapping URL -> {file, type}.
"""
import json
import os
import re
import struct
import zlib

import requests

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extdeps")
os.makedirs(OUT, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

session = requests.Session()
session.headers["User-Agent"] = UA
VERIFY = True


def get(url):
    global VERIFY
    try:
        r = session.get(url, timeout=(10, 120), verify=VERIFY)
    except requests.exceptions.SSLError:
        VERIFY = CA
        r = session.get(url, timeout=(10, 120), verify=VERIFY)
    r.raise_for_status()
    return r


manifest = {}
counter = [0]


def save(url, content, ctype):
    counter[0] += 1
    ext = {
        "text/css": ".css", "application/javascript": ".js",
        "font/woff2": ".woff2", "image/png": ".png",
    }.get(ctype, ".bin")
    fn = f"dep{counter[0]:03d}{ext}"
    with open(os.path.join(OUT, fn), "wb") as f:
        f.write(content)
    manifest[url] = {"file": fn, "type": ctype}


FONT_CSS = [
    "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap",
    "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,0,400;6..72,0,500;6..72,1,400&display=swap",
]

woff_urls = set()
for url in FONT_CSS:
    try:
        r = get(url)
    except Exception as e:
        print(f"[prefetch] FONT CSS UNAVAILABLE (matches live-site behaviour): {url} -> {e}")
        continue
    save(url, r.content, "text/css")
    woff_urls |= set(re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", r.text))

print(f"[prefetch] font css x{len(FONT_CSS)}, woff2 files: {len(woff_urls)}")
for wu in sorted(woff_urls):
    save(wu, get(wu).content, "font/woff2")

LEAFLET = [
    ("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "application/javascript"),
    ("https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", "image/png"),
    ("https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png", "image/png"),
    ("https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png", "image/png"),
]
for url, ctype in LEAFLET:
    try:
        save(url, get(url).content, ctype)
        print(f"[prefetch] ok {url}")
    except Exception as e:
        print(f"[prefetch] SKIP {url}: {e}")


def solid_png(rgb, size=8):
    """Minimal solid-colour PNG (no PIL needed)."""
    raw = b"".join(b"\x00" + bytes(rgb) * size for _ in range(size))
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


# neutral tile matching Carto "light_all" basemap tone
tile = solid_png((232, 230, 227))
with open(os.path.join(OUT, "tile.png"), "wb") as f:
    f.write(tile)
manifest["__TILE__"] = {"file": "tile.png", "type": "image/png"}

with open(os.path.join(OUT, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=1)
print(f"[prefetch] DONE: {len(manifest)} entries")
