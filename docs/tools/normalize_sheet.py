#!/usr/bin/env python3
"""Per-row tone consistency for character sheets (stdlib-only).

Every frame's RGB histogram is quantile-matched onto its row's reference
frame (the median-luminance one), so lighting can't flicker frame-to-frame.
Pose/shape untouched. Same technique as rebuild_walk.py, generalized.

Usage: py normalize_sheet.py <in.png> <out.png> <framesPerDirection>
"""
import sys, os, zlib, struct

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_sheet import decode_png, DIRS, CELL

HIST_STRENGTH = 0.85


def encode_png(path, w, h, buf):
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        return c + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += buf[y*w*4:(y+1)*w*4]
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))


def opaque_px(buf, w, r, f):
    out = []
    for y in range(CELL):
        for x in range(CELL):
            i = ((r*CELL+y)*w + f*CELL + x)*4
            if buf[i+3] > 160:
                out.append(i)
    return out


def normalize_row(buf, w, r, cols):
    px = [opaque_px(buf, w, r, f) for f in range(cols)]
    lums = []
    for f in range(cols):
        tot = sum(0.299*buf[i] + 0.587*buf[i+1] + 0.114*buf[i+2] for i in px[f])
        lums.append(tot/max(len(px[f]), 1))
    ref = sorted(range(cols), key=lambda f: lums[f])[cols//2]
    ref_sorted = [sorted(buf[i+c] for i in px[ref]) for c in range(3)]
    for f in range(cols):
        if f == ref or not px[f]:
            continue
        n = len(px[f])
        for c in range(3):
            order = sorted(range(n), key=lambda k: buf[px[f][k]+c])
            rs = ref_sorted[c]; m = len(rs)
            for rank, k in enumerate(order):
                i = px[f][k] + c
                target = rs[min(m-1, rank*m//n)]
                buf[i] = round(buf[i] + HIST_STRENGTH*(target - buf[i]))


def main():
    src, dst, cols = sys.argv[1], sys.argv[2], int(sys.argv[3])
    w, h, buf = decode_png(src)
    assert h == 8*CELL and w == cols*CELL, f'unexpected dims {w}x{h} for {cols} frames'
    buf = bytearray(buf)
    for r in range(len(DIRS)):
        normalize_row(buf, w, r, cols)
    encode_png(dst, w, h, buf)
    print(f'wrote {dst} (tone-normalized, {cols} frames/dir)')


if __name__ == '__main__':
    main()
