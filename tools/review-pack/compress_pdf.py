#!/usr/bin/env python3
"""Shrink the review pack: re-encode large Flate (lossless) raster images to JPEG.
Chromium print rasterises CSS blur/shadow effects as huge lossless bitmaps."""
import io
import sys

import pikepdf
from PIL import Image

SRC = sys.argv[1]
DST = sys.argv[2]
MIN_BYTES = 40 * 1024
QUALITY = 78

pdf = pikepdf.open(SRC)
converted = saved = skipped = 0

for obj in list(pdf.objects):
    try:
        if not isinstance(obj, pikepdf.Stream) or obj.get("/Subtype") != "/Image":
            continue
        filt = obj.get("/Filter")
        filts = [str(f) for f in filt] if isinstance(filt, pikepdf.Array) else [str(filt)] if filt else []
        if "/DCTDecode" in filts or "/JPXDecode" in filts:
            continue
        if int(obj.get("/BitsPerComponent", 8)) != 8:
            continue
        raw_len = len(obj.read_raw_bytes())
        if raw_len < MIN_BYTES:
            continue
        pimg = pikepdf.PdfImage(obj)
        pil = pimg.as_pil_image()
        if pil.mode not in ("RGB", "L"):
            if pil.mode in ("P", "RGBA", "LA", "CMYK", "1"):
                skipped += 1
                continue
            pil = pil.convert("RGB")
        buf = io.BytesIO()
        pil.save(buf, "JPEG", quality=QUALITY, optimize=True)
        data = buf.getvalue()
        if len(data) >= raw_len * 0.9:
            skipped += 1
            continue
        smask = obj.get("/SMask")
        obj.write(data, filter=pikepdf.Name("/DCTDecode"))
        obj["/ColorSpace"] = pikepdf.Name("/DeviceRGB") if pil.mode == "RGB" else pikepdf.Name("/DeviceGray")
        if "/DecodeParms" in obj:
            del obj["/DecodeParms"]
        if smask is not None:
            obj["/SMask"] = smask  # keep the alpha mask reference intact
        converted += 1
        saved += raw_len - len(data)
    except Exception:
        skipped += 1

pdf.save(DST, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
import os
print(f"converted {converted} images, skipped {skipped}, stream bytes saved ~{saved/1e6:.1f} MB")
print(f"{os.path.getsize(SRC)/1e6:.1f} MB -> {os.path.getsize(DST)/1e6:.1f} MB")
