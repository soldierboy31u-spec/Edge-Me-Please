#!/usr/bin/env python3
"""Stdlib-only fixer for Chris sprite sheets (no Pillow needed).

Usage:  py fix_sheet.py <in.png> <out.png>

Every AI-generated package so far (idle, walk, shoot) has shipped some
east-family frames facing the wrong way, so this:
  1. REBUILDS the east/northeast/southeast rows as exact horizontal mirrors
     of west/northwest/southwest (frame-for-frame) — coherent cycles guaranteed.
  2. Halo cleanup per cell: semi-alpha pixels not within 2px of solid body
     (vignette/matte residue) get alpha=0; true AA edges hugging the body survive.

Grid is inferred from the image size (128px cells, 8 direction rows).
Run docs/tools/validate_sheet.py on the output afterwards.
"""
import sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_sheet import decode_png, DIRS, CELL
import zlib, struct

MIRROR_FROM = {"east": "west", "northeast": "northwest", "southeast": "southwest"}
OPAQUE = 160
NEAR = 2


def encode_png(path, w, h, buf):
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        return c + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    raw = bytearray()
    stride = w*4
    for y in range(h):
        raw.append(0)
        raw += buf[y*stride:(y+1)*stride]
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) \
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    w, h, buf = decode_png(src)
    assert h == 8*CELL and w % CELL == 0, f'unexpected sheet dims {w}x{h}'
    cols = w // CELL

    # 1. rebuild east-family rows from mirrored west-family rows
    for dstd, srcd in MIRROR_FROM.items():
        rd, rs = DIRS.index(dstd), DIRS.index(srcd)
        for c in range(cols):
            for y in range(CELL):
                sbase = ((rs*CELL + y)*w + c*CELL)*4
                dbase = ((rd*CELL + y)*w + c*CELL)*4
                row = bytes(buf[sbase:sbase + CELL*4])
                for x in range(CELL):
                    buf[dbase + x*4: dbase + x*4 + 4] = row[(CELL-1-x)*4:(CELL-1-x)*4+4]
    print('east/northeast/southeast rows rebuilt from mirrored west family')

    # 2. halo cleanup per cell
    removed = 0
    for r in range(8):
        for c in range(cols):
            solid = [[False]*CELL for _ in range(CELL)]
            for y in range(CELL):
                base = ((r*CELL + y)*w + c*CELL)*4
                for x in range(CELL):
                    if buf[base + x*4 + 3] >= OPAQUE: solid[y][x] = True
            near = [row[:] for row in solid]
            for _ in range(NEAR):
                nxt = [row[:] for row in near]
                for y in range(CELL):
                    for x in range(CELL):
                        if near[y][x]: continue
                        for dy in (-1, 0, 1):
                            yy = y+dy
                            if yy < 0 or yy >= CELL: continue
                            for dx in (-1, 0, 1):
                                xx = x+dx
                                if 0 <= xx < CELL and near[yy][xx]:
                                    nxt[y][x] = True; break
                            if nxt[y][x]: break
                near = nxt
            for y in range(CELL):
                base = ((r*CELL + y)*w + c*CELL)*4
                for x in range(CELL):
                    i = base + x*4
                    a = buf[i+3]
                    if 0 < a < OPAQUE and not near[y][x]:
                        buf[i] = buf[i+1] = buf[i+2] = buf[i+3] = 0
                        removed += 1
    print(f'halo pixels removed: {removed}')

    encode_png(dst, w, h, buf)
    print(f'wrote {dst} ({os.path.getsize(dst)//1024} KB)')


if __name__ == '__main__':
    main()
