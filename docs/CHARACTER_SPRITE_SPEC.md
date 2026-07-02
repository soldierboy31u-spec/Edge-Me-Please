# Character Sprite Spec — Redemption's Edge (Claude build)

The technical contract for character art so PNGs drop into the game with **no code rewrite**.
Follow this exactly and the same sheets also work in the Codex build (shared standard).

Locked art direction (decided 2026-07-01):
- **Perspective:** three-quarter top-down (camera tilted ~30–45°; you see the face/hat, feet at bottom)
- **Facing:** 8 directions
- **Aim:** full-body per direction; the drawn gun points toward the facing direction.
  (Bullets still fire at the exact cursor — gameplay is unchanged; only the *drawn* gun snaps to 8-way.)

---

## Frame & sheet format

- **Cell size:** 128 × 128 px, transparent PNG (WebP ok later)
- **One sheet per animation.** Layout = a grid:
  - **Each ROW = one direction**, top→bottom, in this exact order:

    | Row | Direction |
    |----|-----------|
    | 0 | south (facing camera / toward viewer) |
    | 1 | southwest |
    | 2 | west (facing left) |
    | 3 | northwest |
    | 4 | north (facing away) |
    | 5 | northeast |
    | 6 | east (facing right) |
    | 7 | southeast |

  - **Each COLUMN = one animation frame**, left→right.
- So a sheet is `(frames × 128)` wide by `(8 × 128 = 1024)` tall.

### Sheets needed first (recommended frame counts — easy to change later, just tell me)

| File | Frames/dir | Sheet size | Notes |
|------|-----------|-----------|-------|
| `chris_idle.png`  | 4 | 512×1024  | subtle breathing/sway, gun lowered-ready |
| `chris_walk.png`  | 8 | 1024×1024 | full walk cycle |
| `chris_aim.png`   | 1 | 128×1024  | standing, gun raised toward facing dir |
| `chris_shoot.png` | 3 | 384×1024  | raise → muzzle kick → settle (one-shot) |

Later (fallbacks used until they exist): `chris_dash.png`, `chris_hurt.png`, `chris_mounted.png`.

---

## Alignment (critical — this is what makes it "just work")

- **Feet on a consistent baseline** across every frame and every direction. Chris's
  feet sit at **y = 122** in the 128px cell (the idle assembler anchors boots there;
  keep every future sheet on the same baseline).
- **Horizontally centered** at **x = 64**.
- Anchor point = the feet (x 64, y 122). The engine plants that point on Chris's
  world position; the collision circle (radius 15) stays there regardless of art.
- Hat and coat **may** extend outside the collision area — that's expected and fine.
- **Do NOT** bake in: a ground shadow (engine draws it), a background, labels,
  borders, or a parchment card. Pure character on transparency.

## In-game size

- Target on-screen height ≈ **50–56 px** (Chris reads a bit taller than enemies).
- Engine scales the 128px art down (`drawScale` ≈ 0.5, tuned live once art lands).
- **Collision never comes from the PNG.** Draw scale is cosmetic only.

## Silhouette / readability rules

- Chris must be **instantly findable** — strongest, most distinct silhouette on screen.
- Keep the **hat + coat + gun-arm** shape clear from every direction (aim reads at a glance).
- If Chris has a signature color (e.g. a red scarf), keep it consistent across all sheets —
  it's how players track him in a chaotic fight.
- Snappy arcade animation first; old-cartoon smear frames on walk/dash welcome.

## Naming & delivery

- Lowercase snake_case, exactly as the filenames above.
- Deliver into: `assets/characters/chris/`
- Source files (Procreate/Krita/PSD/layered PNG) welcome in a `src/` subfolder, versioned.

## Test checklist (before we call a sheet "in")

- [ ] All 8 rows present, correct order (south is row 0)
- [ ] Feet share the same baseline in every cell
- [ ] Transparent, no baked shadow/background
- [ ] Reads clearly at ~52px tall
- [ ] Aim direction obvious in `aim`/`shoot`
- [ ] Doesn't obscure nearby interact prompts

---

## Engine notes (for the developer / future me)

- Manifest lives as a **JS object** (`game/chris-manifest.js`), NOT a fetched `.json`
  — so the game still runs by double-clicking `index.html` (no local server needed).
- Images load via `Image()` (works on `file://` and on GitHub Pages).
- For the single-file share build, the bundler base64-inlines these PNGs into `dist/index.html`.
- Feature flag `USE_SPRITES` in `config.js`; if off or art missing → falls back to the
  current procedural `drawGunslinger()`. Collision/gameplay untouched either way.
