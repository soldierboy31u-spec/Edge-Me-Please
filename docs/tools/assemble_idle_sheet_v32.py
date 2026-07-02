#!/usr/bin/env python3
"""
Chris Idle Sprite Sheet Assembler v3.2
=======================================
Successor to the user's v3.1. Same pipeline (per-frame isolation, height
normalization, foot anchoring at y=122) plus the fixes found in the
2026-07-01 asset review:

  1. MATTE CLEANUP before the bounding box. The AI key poses carry a
     semi-transparent vignette (alpha residue up to 255 in places). v3.1's
     bbox at ALPHA_THRESH=10 swallowed it, which breaks scale/anchor on
     re-runs. v3.2 zeroes low alpha, then keeps only the largest connected
     alpha component (the character), so re-exports are reproducible.
  2. EAST-FAMILY MIRRORING. The delivered kp_east / kp_northeast /
     kp_southeast face LEFT (same as the west family). MIRROR_DIRECTIONS
     flips them at load so east really faces east. Set it to an empty set
     once you regenerate genuinely right-facing key poses.
  3. Validation now records center/head failures (v3.1 printed them but
     still reported "ALL CELLS PASS").
  4. breathe('fall') no longer overwrites the shifted upper-body row at the
     belt seam (v3.1 lost one row there).
  5. Images are convert('RGBA')-ed on load, wide poses print a warning
     instead of silently clipping at the +/-4 horizontal clamp.

Usage:
  py assemble_idle_sheet_v32.py [input_dir] [output_dir]

input_dir must contain kp_{direction}.png (a key_poses/ subfolder is also
searched). Output: chris_idle.png (512x1024) + frames_128x128_v32/.
"""

from PIL import Image
import numpy as np
import os
import sys
from collections import deque

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------
DIRECTIONS = [
    "south", "southwest", "west", "northwest",
    "north", "northeast", "east", "southeast"
]

# Key poses that were drawn facing LEFT but represent a RIGHT-facing
# direction. Flipped horizontally at load. Empty this set once the source
# art actually faces right.
MIRROR_DIRECTIONS = {"northeast", "east", "southeast"}

CELL_W = 128
CELL_H = 128
COLS = 4
ROWS = 8
SHEET_W = CELL_W * COLS   # 512
SHEET_H = CELL_H * ROWS   # 1024

FOOT_ANCHOR_Y = 122       # Boots land here (matches CHRIS_MANIFEST.anchor.y)
HEAD_PAD = 6              # Pixels to keep above hat
ALPHA_THRESH = 10
MATTE_THRESH = 40         # alpha below this is vignette residue -> zeroed
BREATH_SHIFT = 1

TARGET_CHAR_H = FOOT_ANCHOR_Y - HEAD_PAD  # 116
BREATH_SPLIT_Y = 76


# ---------------------------------------------------------------------------
# STEP 0: MATTE CLEANUP  (new in v3.2)
# ---------------------------------------------------------------------------
def clean_matte(img):
    """Zero faint alpha, then keep only the largest connected alpha
    component. Kills vignette residue and stray blobs so the bbox is the
    character, nothing else."""
    arr = np.array(img)
    alpha = arr[:, :, 3].astype(np.int32)
    alpha[alpha < MATTE_THRESH] = 0

    mask = alpha > 0
    if not mask.any():
        raise ValueError("image is fully transparent after matte threshold")

    # Largest connected component (4-connectivity). scipy if present,
    # otherwise a BFS fallback (a few seconds on 1024x1024, stdlib only).
    try:
        from scipy import ndimage
        labels, n = ndimage.label(mask)
        if n > 1:
            largest = np.argmax(np.bincount(labels.ravel())[1:]) + 1
            mask = labels == largest
    except ImportError:
        labels = np.zeros(mask.shape, dtype=np.int32)
        sizes = {}
        nxt = 0
        h, w = mask.shape
        for sy, sx in zip(*np.where(mask)):
            if labels[sy, sx]:
                continue
            nxt += 1
            q = deque([(sy, sx)])
            labels[sy, sx] = nxt
            size = 0
            while q:
                y, x = q.popleft()
                size += 1
                for yy, xx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not labels[yy, xx]:
                        labels[yy, xx] = nxt
                        q.append((yy, xx))
            sizes[nxt] = size
        if nxt > 1:
            largest = max(sizes, key=sizes.get)
            mask = labels == largest

    alpha[~mask] = 0
    arr[:, :, 3] = alpha.astype(np.uint8)
    arr[~mask] = 0   # also zero RGB so resize can't bleed background color
    return Image.fromarray(arr, 'RGBA')


# ---------------------------------------------------------------------------
# STEP 1: EXTRACT & SCALE A SINGLE POSE INTO A CELL
# ---------------------------------------------------------------------------
def pose_to_cell(img_path, mirror=False):
    """
    Full pipeline for one key pose:
      1. Load key pose (any size), force RGBA, clean matte
      2. Optionally mirror (left-facing source for a right-facing direction)
      3. Find character bounding box
      4. Crop to bbox + padding, scale so character height = TARGET_CHAR_H
      5. Place into 128x128 cell: feet at y=122, centered x=64
    Returns: 128x128 RGBA Image, info dict
    """
    img = Image.open(img_path).convert('RGBA')
    img = clean_matte(img)
    if mirror:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)

    arr = np.array(img)
    h, w = arr.shape[:2]
    alpha = arr[:, :, 3]

    ys, xs = np.where(alpha > ALPHA_THRESH)
    if len(xs) == 0:
        raise ValueError(f"No character found in {img_path}")

    src_min_x, src_max_x = xs.min(), xs.max()
    src_min_y, src_max_y = ys.min(), ys.max()
    src_char_h = src_max_y - src_min_y + 1

    pad = 12
    cx1 = max(0, src_min_x - pad)
    cy1 = max(0, src_min_y - pad)
    cx2 = min(w, src_max_x + pad + 1)
    cy2 = min(h, src_max_y + pad + 1)
    cropped = img.crop((cx1, cy1, cx2, cy2))

    char_top_in_crop = src_min_y - cy1
    char_bottom_in_crop = src_max_y - cy1
    char_h_in_crop = char_bottom_in_crop - char_top_in_crop + 1

    scale = TARGET_CHAR_H / char_h_in_crop
    new_w = int(round(cropped.width * scale))
    new_h = int(round(cropped.height * scale))
    scaled = cropped.resize((new_w, new_h), Image.LANCZOS)

    s_arr = np.array(scaled)
    s_alpha = s_arr[:, :, 3]
    s_ys, s_xs = np.where(s_alpha > ALPHA_THRESH)
    s_char_top = s_ys.min()
    s_char_bottom = s_ys.max()
    s_char_left = s_xs.min()
    s_char_right = s_xs.max()
    s_char_w = s_char_right - s_char_left + 1

    if s_char_w > CELL_W:
        print(f"  WARNING: {os.path.basename(img_path)} scales to {s_char_w}px wide "
              f"(cell is {CELL_W}) — pose will be clipped. Widen the cell or "
              f"reduce TARGET_CHAR_H for this animation.")

    cell = Image.new('RGBA', (CELL_W, CELL_H), (0, 0, 0, 0))

    paste_y = FOOT_ANCHOR_Y - s_char_bottom
    head_y_in_cell = paste_y + s_char_top
    if head_y_in_cell < HEAD_PAD:
        paste_y = HEAD_PAD - s_char_top
    feet_y_in_cell = paste_y + s_char_bottom
    if feet_y_in_cell >= CELL_H:
        paste_y = CELL_H - 1 - s_char_bottom

    char_center_x = (s_char_left + s_char_right) // 2
    paste_x = (CELL_W // 2) - char_center_x
    paste_x = max(-4, min(CELL_W - scaled.width + 4, paste_x))

    cell.paste(scaled, (paste_x, paste_y), scaled)

    final_arr = np.array(cell)
    f_ys, _ = np.where(final_arr[:, :, 3] > ALPHA_THRESH)
    return cell, {
        'src_char_h': src_char_h,
        'scale': scale,
        'new_size': (new_w, new_h),
        's_char_h': s_char_bottom - s_char_top + 1,
        'paste': (paste_x, paste_y),
        'final_head': int(f_ys.min()) if len(f_ys) else -1,
        'final_foot': int(f_ys.max()) if len(f_ys) else -1,
    }


# ---------------------------------------------------------------------------
# STEP 2: BREATHING VARIANTS
# ---------------------------------------------------------------------------
def breathe(cell_frame, variant, split_y=BREATH_SPLIT_Y, shift=BREATH_SHIFT):
    """Upper-body-only shift. Feet (below split_y) stay locked."""
    if variant == 'neutral':
        return cell_frame.copy()

    arr = np.array(cell_frame)
    result = np.zeros_like(arr)

    if variant == 'rise':
        result[:split_y - shift, :, :] = arr[shift:split_y, :, :]
        result[split_y:, :, :] = arr[split_y:, :, :]
        if split_y - shift >= 0:
            result[split_y - shift, :, :] = (
                arr[split_y - 1, :, :] * 0.6 + arr[split_y, :, :] * 0.4
            ).astype(np.uint8)

    elif variant == 'fall':
        # Lower body first, then shifted upper body ONLY above the seam
        # (v3.1 wrote the upper body over row split_y and then lost it).
        result[split_y:, :, :] = arr[split_y:, :, :]
        result[shift:split_y, :, :] = arr[:split_y - shift, :, :]
        if shift > 0:
            result[:shift, :, :] = arr[:shift, :, :]

    return Image.fromarray(result, 'RGBA')


# ---------------------------------------------------------------------------
# STEP 3: ASSEMBLE
# ---------------------------------------------------------------------------
def find_pose(input_dir, direction):
    for cand in (os.path.join(input_dir, f"kp_{direction}.png"),
                 os.path.join(input_dir, "key_poses", f"kp_{direction}.png")):
        if os.path.isfile(cand):
            return cand
    raise FileNotFoundError(f"kp_{direction}.png not found in {input_dir} (or key_poses/)")


def main():
    input_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "."

    print("Chris Idle Sprite Sheet Assembler v3.2")
    print("=" * 60)

    print("\n--- Processing key poses into cells ---\n")
    all_frames = {}

    for direction in DIRECTIONS:
        path = find_pose(input_dir, direction)
        mirror = direction in MIRROR_DIRECTIONS
        neutral, info = pose_to_cell(path, mirror=mirror)

        print(f"  {direction:12s}{' (mirrored)' if mirror else '':11s}: "
              f"src_h={info['src_char_h']:4d} | scale={info['scale']:.4f} | "
              f"cell_h={info['s_char_h']:3d} | paste={info['paste']} | "
              f"head={info['final_head']:2d} | foot={info['final_foot']:3d}")

        f1 = breathe(neutral, 'neutral')
        f2 = breathe(neutral, 'rise')
        f3 = breathe(neutral, 'neutral')
        f4 = breathe(neutral, 'fall')
        all_frames[direction] = [f1, f2, f3, f4]

    print("\n--- Assembling sheet ---\n")
    sheet = Image.new('RGBA', (SHEET_W, SHEET_H), (0, 0, 0, 0))
    for row, direction in enumerate(DIRECTIONS):
        y = row * CELL_H
        for col, frame in enumerate(all_frames[direction]):
            sheet.paste(frame, (col * CELL_W, y))
        print(f"  Row {row}: {direction:12s} | y={y:4d}")

    out_path = os.path.join(output_dir, "chris_idle.png")
    sheet.save(out_path)
    print(f"\n  Saved: {out_path}")

    # Validation: every failed check lands in `issues` (v3.1 only counted foot)
    print("\n--- Validation (frame-by-frame) ---\n")
    sheet_arr = np.array(sheet)
    issues = []

    for row, direction in enumerate(DIRECTIONS):
        for col in range(COLS):
            cell = sheet_arr[row*CELL_H:(row+1)*CELL_H, col*CELL_W:(col+1)*CELL_W, :]
            ys, xs = np.where(cell[:, :, 3] > ALPHA_THRESH)
            if len(xs) == 0:
                issues.append(f"{direction}[{col}]: EMPTY")
                continue

            foot_y = ys.max()
            head_y = ys.min()
            com_x = int(xs.mean())

            status = "OK"
            if abs(foot_y - FOOT_ANCHOR_Y) > 4:
                status = f"FOOT({foot_y})"
                issues.append(f"{direction}[{col}]: foot at y={foot_y}, want ~{FOOT_ANCHOR_Y}")
            if abs(com_x - CELL_W // 2) > 12:
                status = f"CENTER({com_x})"
                issues.append(f"{direction}[{col}]: center of mass x={com_x}, want ~{CELL_W//2}")
            if head_y < 2:
                status = f"HEAD({head_y})"
                issues.append(f"{direction}[{col}]: head clipped at y={head_y}")

            print(f"  {direction:12s}[{col}]: head={head_y:2d} foot={foot_y:3d} com_x={com_x:2d} | {status}")

    if issues:
        print(f"\n  ISSUES ({len(issues)}):")
        for issue in issues:
            print(f"    - {issue}")
    else:
        print("\n  ALL CELLS PASS")

    frames_dir = os.path.join(output_dir, "frames_128x128_v32")
    os.makedirs(frames_dir, exist_ok=True)
    for direction in DIRECTIONS:
        for i, frame in enumerate(all_frames[direction], 1):
            frame.save(os.path.join(frames_dir, f"frame_{direction}_{i:02d}.png"))
    print(f"\n  Frames saved to: {frames_dir}/")
    print("\nDone.")


if __name__ == "__main__":
    main()
