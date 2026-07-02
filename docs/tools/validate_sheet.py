#!/usr/bin/env python3
"""Stdlib-only validator for ANY Chris sprite sheet (no Pillow needed).

Usage:  py validate_sheet.py <sheet.png> <framesPerDirection>
        py validate_sheet.py chris_shoot.png 3

Checks against docs/CHARACTER_SPRITE_SPEC.md:
  - sheet is (frames*128) x 1024, 8-bit RGBA
  - every cell: feet baseline y=108 (+/-2), centred x=64 (+/-8), no top clip,
    nothing touching the side edges
  - east/northeast/southeast rows actually face opposite their west-family
    partner (per frame, alpha-mask mirror similarity) — catches the
    wrong-facing defect both the idle and walk packages shipped with
  - halo/residue: isolated alpha specks disconnected from the body

Exit code 0 = pass, 1 = issues found.
"""
import zlib, struct, sys, os

CELL = 128
BASELINE = 108           # spec feet baseline (idle predates this; see spec doc)
DIRS = ["south","southwest","west","northwest","north","northeast","east","southeast"]
MIRROR_PAIRS = [("west","east"), ("northwest","northeast"), ("southwest","southeast")]


def decode_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'not a png'
    pos = 8; idat = b''; w = h = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]; chunk = data[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, depth, ctype = struct.unpack('>IIBB', chunk[:10])
            assert depth == 8 and ctype == 6, f'need 8-bit RGBA, got depth={depth} ctype={ctype}'
        elif typ == b'IDAT': idat += chunk
        elif typ == b'IEND': break
        pos += 12 + ln
    raw = zlib.decompress(idat)
    stride = w*4; out = bytearray(w*h*4); prev = bytearray(stride); pos = 0
    for y in range(h):
        filt = raw[pos]; pos += 1
        line = bytearray(raw[pos:pos+stride]); pos += stride
        if filt == 1:
            for i in range(4, stride): line[i] = (line[i] + line[i-4]) & 0xff
        elif filt == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 0xff
        elif filt == 3:
            for i in range(stride):
                a = line[i-4] if i >= 4 else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xff
        elif filt == 4:
            for i in range(stride):
                a = line[i-4] if i >= 4 else 0
                b = prev[i]; c = prev[i-4] if i >= 4 else 0
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xff
        out[y*stride:(y+1)*stride] = line; prev = line
    return w, h, out


def cell_bbox(buf, W, x0, y0, thresh=10):
    minx = miny = 10**9; maxx = maxy = -1
    for y in range(y0, y0+CELL):
        base = (y*W)*4
        for x in range(x0, x0+CELL):
            if buf[base + x*4 + 3] > thresh:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx < 0: return None
    return (minx-x0, miny-y0, maxx-x0, maxy-y0)


def mask(buf, W, r, c):
    return [[1 if buf[((r*CELL+y)*W+(c*CELL+x))*4+3] > 40 else 0
             for x in range(CELL)] for y in range(CELL)]


def sim(a, b, flip=False):
    inter = union = 0
    for y in range(CELL):
        for x in range(CELL):
            va = a[y][x]; vb = b[y][CELL-1-x] if flip else b[y][x]
            if va or vb: union += 1
            if va and vb: inter += 1
    return inter/union if union else 0


def specks(buf, W, r, c):
    n = 0
    for y in range(1, CELL-1):
        for x in range(1, CELL-1):
            if buf[((r*CELL+y)*W+(c*CELL+x))*4+3] > 10:
                nb = sum(buf[((r*CELL+y+dy)*W+(c*CELL+x+dx))*4+3] > 10
                         for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)))
                if nb == 0: n += 1
    return n


def main():
    path, frames = sys.argv[1], int(sys.argv[2])
    w, h, buf = decode_png(path)
    issues = []
    print(f'{os.path.basename(path)}: {w}x{h}, expecting {frames}x8 grid of {CELL}px cells')
    if (w, h) != (frames*CELL, 8*CELL):
        issues.append(f'sheet is {w}x{h}, expected {frames*CELL}x{8*CELL}')

    for r, d in enumerate(DIRS):
        for c in range(frames):
            bx = cell_bbox(buf, w, c*CELL, r*CELL)
            if bx is None:
                issues.append(f'{d}[{c}] EMPTY'); continue
            cx = (bx[0]+bx[2])/2
            if abs(bx[3]-BASELINE) > 2: issues.append(f'{d}[{c}] foot={bx[3]} (want {BASELINE})')
            if abs(cx-64) > 8: issues.append(f'{d}[{c}] cx={cx:.0f} (want ~64)')
            if bx[1] < 2: issues.append(f'{d}[{c}] head={bx[1]} (top clip?)')
            if bx[0] < 1 or bx[2] > CELL-2: issues.append(f'{d}[{c}] touches side edge')
            sp = specks(buf, w, r, c)
            if sp > 8: issues.append(f'{d}[{c}] {sp} isolated alpha specks')

    for L, R in MIRROR_PAIRS:
        li, ri = DIRS.index(L), DIRS.index(R)
        for c in range(frames):
            ml, mr = mask(buf, w, li, c), mask(buf, w, ri, c)
            s_same, s_flip = sim(ml, mr), sim(ml, mr, flip=True)
            if s_same >= s_flip:
                issues.append(f'{R}[{c}] faces the same way as {L}[{c}] '
                              f'(same={s_same:.2f} > flipped={s_flip:.2f}) — wrong facing')

    print()
    if issues:
        print(f'ISSUES ({len(issues)}):')
        for i in issues: print('  ' + i)
        sys.exit(1)
    print('ALL CELLS PASS')


if __name__ == '__main__':
    main()
