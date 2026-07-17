#!/usr/bin/env python3
"""Serve the local site mirror, transcoding .webp images to JPEG/PNG on the fly.

Chromium's print-to-PDF cannot embed WebP: it decodes them to lossless bitmaps,
which balloons a single page to ~100 MB. JPEG (and PNG) data passes through
compactly, so we transcode at the HTTP layer; the HTML keeps its .webp URLs.
"""
import io
import os
import sys
import hashlib
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

from PIL import Image

ROOT = "/home/user/propertyflow-website"
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "imgcache")
os.makedirs(CACHE, exist_ok=True)
MAX_DIM = 2000
JPEG_QUALITY = 80


def transcode(fs_path):
    key = hashlib.md5((fs_path + str(os.path.getmtime(fs_path))).encode()).hexdigest()
    for ext, ctype in ((".jpg", "image/jpeg"), (".png", "image/png")):
        c = os.path.join(CACHE, key + ext)
        if os.path.exists(c):
            with open(c, "rb") as f:
                return f.read(), ctype
    im = Image.open(fs_path)
    im.load()
    has_alpha = im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info
    if max(im.size) > MAX_DIM:
        im.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)
    buf = io.BytesIO()
    if has_alpha:
        im.save(buf, "PNG", optimize=True)
        ext, ctype = ".png", "image/png"
    else:
        im.convert("RGB").save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
        ext, ctype = ".jpg", "image/jpeg"
    data = buf.getvalue()
    with open(os.path.join(CACHE, key + ext), "wb") as f:
        f.write(data)
    return data, ctype


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_GET(self):
        clean = self.path.split("?", 1)[0].split("#", 1)[0]
        if clean.lower().endswith(".webp"):
            fs_path = os.path.join(ROOT, clean.lstrip("/"))
            if os.path.isfile(fs_path):
                try:
                    data, ctype = transcode(fs_path)
                    self.send_response(200)
                    self.send_header("Content-Type", ctype)
                    self.send_header("Content-Length", str(len(data)))
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    self.wfile.write(data)
                    return
                except Exception as e:
                    sys.stderr.write(f"transcode failed {clean}: {e}\n")
        return super().do_GET()

    def log_message(self, fmt, *args):
        pass  # quiet


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8124
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
