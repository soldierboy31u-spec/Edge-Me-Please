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
# NO mirror-synthesized frames: playtests showed a mirrored stride reads as
# the whole body flip-flopping left/right, even from a near-symmetric source.
# Frame-to-frame lighting differences are handled by histogram matching below.
KEEP = {
    # south/north: SINGLE frozen mid-stride frame. Playtests showed every
    # multi-frame combination for the front/back views still shimmered (the
    # frames are independent generations); the engine adds a procedural
    # step-bob (CFG.WALK_BOB_*) so movement still reads as walking.
    'south':     [1],               # bulky-cape build, mid-stride
    'north':     [2],               # slim back view, mid-stride
    'southwest': [0, 2, 3, 7],      # slim cluster (4-6 are a bulkier torso crop)
    'northwest': [0, 2, 3, 7],      # coherent slim subset (1,4,5,6 vary in bulk/light)
}

# Tone consistency: every frame's per-channel histogram is remapped onto the
# row's reference frame (median-luminance one), so lighting can't flicker.
# 1.0 = full match; lower blends toward the original.
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


def _opaque_px(buf, w, r, f):
    """Indices of body pixels (alpha>160) in a cell."""
    out = []
    for y in range(CELL):
        for x in range(CELL):
            i = ((r*CELL+y)*w + f*CELL + x)*4
            if buf[i+3] > 160:
                out.append(i)
    return out


def normalize_row(buf, w, r, cols):
    """Histogram-match every frame's RGB onto the row's reference frame.

    Quantile-to-quantile per channel over body pixels: pixel at the k-th
    percentile of its frame's channel distribution takes the reference's
    k-th percentile value (blended by HIST_STRENGTH). Kills frame-to-frame
    lighting/contrast differences; pose is untouched.
    """
    px = [_opaque_px(buf, w, r, f) for f in range(cols)]
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
            rs = ref_sorted[c]
            m = len(rs)
            for rank, k in enumerate(order):
                i = px[f][k] + c
                target = rs[min(m-1, rank*m//n)]
                buf[i] = round(buf[i] + HIST_STRENGTH*(target - buf[i]))


def main():
    src, dst = sys.argv[1], sys.argv[2]
    w, h, orig = decode_png(src)
    assert h == 8*CELL and w % CELL == 0, f'unexpected dims {w}x{h}'
    cols = w // CELL
    orig = bytes(orig)
    out = bytearray(orig)

    # 1. coherent-cluster rebuild for the straight + diagonal source rows
    for d, keep in KEEP.items():
        r = DIRS.index(d)
        frames = [get_cell(orig, w, r, f) for f in keep]
        for f in range(cols):
            put_cell(out, w, r, f, frames[f % len(frames)])

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

    # 4. per-row tone consistency (histogram matching onto the reference frame)
    for r in range(len(DIRS)):
        normalize_row(out, w, r, cols)

    encode_png(dst, w, h, out)
    print(f'wrote {dst}')


if __name__ == '__main__':
    main()
