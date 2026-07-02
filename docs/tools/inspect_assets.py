#!/usr/bin/env python3
"""
Redemption's Edge — sprite asset format inspector.

Checks whether uploaded art matches the engine's contract (docs/CHARACTER_SPRITE_SPEC.md):
  - transparent PNG (RGBA)
  - 128 x 128 px cells
  - each ROW = a direction (8 rows: S, SW, W, NW, N, NE, E, SE)
  - each COLUMN = an animation frame
  - feet on a consistent baseline (~y=108), centered

Runs on the stdlib alone (parses PNG headers directly). If Pillow is installed it ALSO does
per-cell alpha analysis to verify the feet baseline is consistent across every frame/direction.

Usage:
    py inspect_assets.py <folder-or-zip>
"""
import sys, os, struct, zipfile, io

TARGET_CELL = 128
DIRECTIONS  = ['south', 'southwest', 'west', 'northwest', 'north', 'northeast', 'east', 'southeast']
EXPECTED_FRAMES = {'chris_idle': 4, 'chris_walk': 8, 'chris_aim': 1, 'chris_shoot': 3}
COLORTYPE = {0: 'grayscale', 2: 'RGB', 3: 'palette', 4: 'gray+alpha', 6: 'RGBA'}
IMG_EXT = ('.png', '.webp', '.psd', '.jpg', '.jpeg', '.gif', '.bmp', '.tga')


def png_header(data):
    """Return (w, h, bit_depth, color_type) from a PNG's IHDR, or None."""
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    # bytes 8-16 = length + 'IHDR'; 16-26 = width, height, bitdepth, colortype
    try:
        w, h, bd, ct = struct.unpack('>IIBB', data[16:26])
        return w, h, bd, ct
    except struct.error:
        return None


def iter_images(path):
    """Yield (name, bytes) for every image in a folder or zip."""
    if path.lower().endswith('.zip'):
        with zipfile.ZipFile(path) as z:
            for n in z.namelist():
                if n.lower().endswith(IMG_EXT) and not n.endswith('/'):
                    yield n, z.read(n)
    elif os.path.isdir(path):
        for root, _, files in os.walk(path):
            for f in files:
                if f.lower().endswith(IMG_EXT):
                    p = os.path.join(root, f)
                    with open(p, 'rb') as fh:
                        yield os.path.relpath(p, path), fh.read()
    elif os.path.isfile(path):
        with open(path, 'rb') as fh:
            yield os.path.basename(path), fh.read()


def list_other_files(path):
    """List non-image files (e.g. the Python imaging code) so they get reviewed too."""
    out = []
    if path.lower().endswith('.zip'):
        with zipfile.ZipFile(path) as z:
            out = [n for n in z.namelist() if not n.lower().endswith(IMG_EXT) and not n.endswith('/')]
    elif os.path.isdir(path):
        for root, _, files in os.walk(path):
            for f in files:
                if not f.lower().endswith(IMG_EXT):
                    out.append(os.path.relpath(os.path.join(root, f), path))
    return out


def deep_alpha_check(data):
    """With Pillow: report the feet baseline (content bottom) consistency across cells."""
    try:
        from PIL import Image
    except Exception:
        return None
    try:
        im = Image.open(io.BytesIO(data)).convert('RGBA')
        w, h = im.size
        if w % TARGET_CELL or h % TARGET_CELL:
            return "cells not 128-aligned; skipping per-cell check"
        cols, rows = w // TARGET_CELL, h // TARGET_CELL
        alpha = im.split()[3]
        bottoms, empties = [], 0
        for r in range(rows):
            for c in range(cols):
                cell = alpha.crop((c * 128, r * 128, c * 128 + 128, r * 128 + 128))
                bbox = cell.getbbox()          # (l, t, r, b) of non-transparent content
                if bbox:
                    bottoms.append(bbox[3])
                else:
                    empties += 1
        if not bottoms:
            return "every cell is fully transparent (empty sheet?)"
        spread = max(bottoms) - min(bottoms)
        msg = f"feet baseline y: min {min(bottoms)}, max {max(bottoms)} (target ~108), spread {spread}px"
        if spread > 12:
            msg += "  !! >12px — feet not aligned across cells"
        if empties:
            msg += f"; {empties} empty cell(s)"
        return msg
    except Exception as e:
        return f"pillow check failed: {e}"


def analyze(path):
    have_pil = False
    try:
        import PIL  # noqa
        have_pil = True
    except Exception:
        pass
    print(f"Inspecting: {path}")
    print(f"Pillow (deep checks) available: {have_pil}\n")

    n_img = 0
    for name, data in iter_images(path):
        n_img += 1
        ext = name.lower().rsplit('.', 1)[-1]
        print(f"== {name}  ({len(data) // 1024} KB) ==")
        if ext == 'png':
            info = png_header(data)
            if not info:
                print("   !! not a valid PNG header")
            else:
                w, h, bd, ct = info
                alpha = 'YES' if ct in (4, 6) else 'NO'
                print(f"   PNG {w}x{h}  {bd}-bit  {COLORTYPE.get(ct, ct)}  alpha={alpha}")
                if alpha == 'NO':
                    print("   !! no alpha channel — engine needs transparent RGBA PNG")
                if w % TARGET_CELL == 0 and h % TARGET_CELL == 0:
                    cols, rows = w // TARGET_CELL, h // TARGET_CELL
                    print(f"   grid @128: {cols} col(s) x {rows} row(s)")
                    if rows != 8:
                        print(f"   !! {rows} rows — expected 8 (one per direction)")
                    base = os.path.basename(name).rsplit('.', 1)[0]
                    if base in EXPECTED_FRAMES:
                        exp, got = EXPECTED_FRAMES[base], cols
                        flag = "OK" if got == exp else "!! mismatch"
                        print(f"   frames/dir: got {got}, expected {exp}  {flag}")
                else:
                    print(f"   !! {w}x{h} is not a clean multiple of {TARGET_CELL} — cell size differs or padded")
                deep = deep_alpha_check(data)
                if deep:
                    print(f"   {deep}")
        else:
            print(f"   format .{ext} — SOURCE/insufficient; engine needs transparent PNG (convert)")
        print()

    others = list_other_files(path)
    if others:
        print("Non-image files (review these — likely the Python imaging code):")
        for o in others:
            print(f"   - {o}")
    if n_img == 0:
        print("No images found. If this is a zip, check the path; if source-only, note formats.")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    analyze(sys.argv[1])
