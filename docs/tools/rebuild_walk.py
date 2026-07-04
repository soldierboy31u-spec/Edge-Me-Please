#!/usr/bin/env python3
"""Rebuild chris_walk.png from the pristine AI-generated sheet.

The walk sheet's frames were each generated independently, so build/cape/
lighting vary frame to frame ("shape-shifting" shimmer in game). This tool
encodes the frame-quality audit of 2026-07-04 (session: horse/hurt/aim sheets):

  1. Per row, keep only the coherent frame cluster (KEEP below), looped to
     8 frames in gait order (contact-pass-contact-pass where possible).
  2. The original "northwest" art actually faces up-RIGHT, so the north
     diagonals are crossed: northeast shows the original NW frames, and
     northwest shows their mirror. (Playtested + approved.)
  3. East-family rows are rebuilt as mirrors of the cleaned west family.
  4. Every row is luminance-normalized to its median frame so no frame
     pops bright/dark (clamped 0.75-1.35x).

Usage: py rebuild_walk.py <pristine_in.png> <out.png>
Pristine sheet = git show 057296f:assets/characters/chris/chris_walk.png
"""
import sys, os, zlib, struct

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_sheet import decode_png, DIRS, CELL

# Per-row keep-lists (frame indices into the PRISTINE sheet, gait order).
# Rows not listed keep all 8 original frames.
KEEP = {
    'southwest': [0, 2, 3, 7],      # slim cluster (4-6 are a bulkier torso crop)
    'northwest': [0, 2, 3, 7],      # coherent slim subset (1,4,5,6 vary in bulk/light)
}
# Front/back rows are near-symmetric, so a full alternating gait is synthesized
# from ONE stride + ONE passing frame:
#   [stride-L, pass, stride-R(mirror), pass]
# Only the stride is mirrored (that's what alternates the legs); the passing
# frame stays identical so one-sided details (cape/holster) don't ping-pong.
# Guarantees identical appearance across phases (a mirror can't change
# palette/lighting). Stride frames picked for near-symmetry (centered cape,
# both arms visible) so even the mirrored stride barely differs.
# Pairs chosen by stance-width (wide=stride, narrow=pass) + closest histogram.
SYNTH = {
    'south': (1, 3),
    'north': (1, 6),
}
# North diagonals are crossed (see docstring point 2).
MIRROR_PAIRS = [('southeast', 'southwest'), ('east', 'west'), ('northwest', 'northwest')]
NE_FROM_NW_UNMIRRORED = True

LUM_CLAMP = (0.75, 1.35)


def encode_png(path, w, h, buf):
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        return c + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += buf[y*w*4:(y+1)*w*4]
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) \
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def get_cell(buf, w, r, f):
    cell = bytearray(CELL*CELL*4)
    for y in range(CELL):
        s = ((r*CELL+y)*w + f*CELL)*4
        cell[y*CELL*4:(y+1)*CELL*4] = buf[s:s+CELL*4]
    return cell


def put_cell(buf, w, r, f, cell):
    for y in range(CELL):
        d = ((r*CELL+y)*w + f*CELL)*4
        buf[d:d+CELL*4] = cell[y*CELL*4:(y+1)*CELL*4]


def mirror(cell):
    out = bytearray(CELL*CELL*4)
    for y in range(CELL):
        for x in range(CELL):
            out[(y*CELL+x)*4:(y*CELL+x)*4+4] = \
                cell[(y*CELL+(CELL-1-x))*4:(y*CELL+(CELL-1-x))*4+4]
    return out


def normalize_row(buf, w, r, cols):
    def lum(f):
        tot = n = 0
        for y in range(CELL):
            for x in range(CELL):
                i = ((r*CELL+y)*w + f*CELL + x)*4
                if buf[i+3] > 160:
                    tot += 0.299*buf[i] + 0.587*buf[i+1] + 0.114*buf[i+2]
                    n += 1
        return tot/max(n, 1)
    lums = [lum(f) for f in range(cols)]
    target = sorted(lums)[cols//2]
    for f in range(cols):
        k = max(LUM_CLAMP[0], min(LUM_CLAMP[1], target/lums[f]))
        if abs(k-1) < 0.02:
            continue
        for y in range(CELL):
            for x in range(CELL):
                i = ((r*CELL+y)*w + f*CELL + x)*4
                if buf[i+3] > 0:
                    for c in range(3):
                        buf[i+c] = min(255, round(buf[i+c]*k))


def main():
    src, dst = sys.argv[1], sys.argv[2]
    w, h, orig = decode_png(src)
    assert h == 8*CELL and w % CELL == 0, f'unexpected dims {w}x{h}'
    cols = w // CELL
    orig = bytes(orig)
    out = bytearray(orig)

    # 1a. coherent-cluster rebuild for the diagonal rows
    for d, keep in KEEP.items():
        r = DIRS.index(d)
        frames = [get_cell(orig, w, r, f) for f in keep]
        for f in range(cols):
            put_cell(out, w, r, f, frames[f % len(frames)])

    # 1b. mirror-synthesized gait for the front/back rows
    for d, (stride, passing) in SYNTH.items():
        r = DIRS.index(d)
        st, pa = get_cell(orig, w, r, stride), get_cell(orig, w, r, passing)
        cycle = [st, pa, mirror(st), pa]
        for f in range(cols):
            put_cell(out, w, r, f, cycle[f % 4])

    # 2+3. mirrors: SE<-SW, E<-W; north diagonals crossed:
    #      NE gets the (up-right-facing) original NW cluster, NW its mirror
    nw_frames = [get_cell(orig, w, DIRS.index('northwest'), f) for f in KEEP['northwest']]
    for f in range(cols):
        put_cell(out, w, DIRS.index('northeast'), f, nw_frames[f % len(nw_frames)])
        put_cell(out, w, DIRS.index('northwest'), f, mirror(nw_frames[f % len(nw_frames)]))
    for dstd, srcd in (('southeast', 'southwest'), ('east', 'west')):
        rs, rd = DIRS.index(srcd), DIRS.index(dstd)
        for f in range(cols):
            put_cell(out, w, rd, f, mirror(get_cell(out, w, rs, f)))

    # 4. per-row luminance normalization
    for r in range(len(DIRS)):
        normalize_row(out, w, r, cols)

    encode_png(dst, w, h, out)
    print(f'wrote {dst}')


if __name__ == '__main__':
    main()
