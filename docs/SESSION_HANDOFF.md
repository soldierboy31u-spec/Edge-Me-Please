# Redemption's Edge — Session Handoff (Art / Asset Integration)

**Written:** 2026-07-01 · **For:** a fresh session that will review uploaded art assets +
the Python imaging code, then integrate Chris's sprites into the game.

> **New session: read this whole doc first, then skim `docs/ROADMAP.md`,
> `docs/CHARACTER_SPRITE_SPEC.md`, `game/sprites.js`, and `game/chris-manifest.js`.**
> The auto-memory (`MEMORY.md`) also loads context automatically.

---

## 0. TL;DR — what you're here to do

The user is uploading a **zip** containing (a) art assets for the game and (b) the **Python
code** they used to generate/process the imaging. Your job:

1. **Unzip** it to the scratchpad (not the project) and **inventory** what's inside.
2. **Analyze whether the assets are in the ideal format** for this engine (see §5–6).
   Run `py docs/tools/inspect_assets.py <path-to-zip-or-folder>` for a fast report.
3. **Review the user's Python imaging code** — understand how assets were produced, and
   whether it outputs (or can be tweaked to output) the format the engine wants.
4. **Recommend**: use as-is, or convert (and how). Then, if good, **integrate Chris** by
   dropping PNGs into `assets/characters/chris/`, flipping `USE_SPRITES`, and tuning 2 numbers.

Do NOT redesign the game or change gameplay. Art is visual-only; collision stays authoritative.

---

## 1. What this project is

- **Redemption's Edge** — a 2D top-down open-world western arcade action game. HTML5 Canvas +
  vanilla JS, **no engine, no build step, no dependencies**.
- Player: **Chris King "Dckslinger"**, an outlaw based at **Darryl's camp** near the crooked
  town of **Hicksville**; the supernatural is real (first threat: desert demons).
- **This folder (`RDR22dversion`) is CLAUDE'S build.** The user is running a **bake-off**:
  Codex builds its own version in `Desktop/CodexRDR2/`. **Do not pull Codex's code in or
  consolidate them.** (The two ChatGPT docs — `DESIGNER_HANDOFF.md`,
  `redemptions-edge-chris-sprite-remodel-plan.md` — were written for the *Codex* build; their
  controls/town-names/missions DON'T match this build. Use them for art *direction* only.)
- **Run it:** double-click `index.html` (no server needed). Works on `file://` and GitHub Pages.

## 2. Where things live

```
RDR22dversion/
├─ index.html                 entry: canvas + ordered <script> tags
├─ game/                      the modular codebase (classic scripts, shared global scope)
│   config.js utils.js input.js audio.js camera.js world.js
│   assets.js chris-manifest.js sprites.js       ← sprite pipeline (NEW)
│   entities.js systems.js game.js render.js main.js
├─ assets/characters/chris/   ← DROP CHRIS PNGs HERE (README inside)
├─ docs/
│   ROADMAP.md                milestone tracker + "YOU ARE HERE" + idea parking lot
│   CHARACTER_SPRITE_SPEC.md  the art contract (frame size, direction order, anchor…)
│   SESSION_HANDOFF.md        this file
│   DESIGN_BIBLE.md           overall design north star
│   tools/inspect_assets.py   asset-format analyzer (run on the uploaded zip)
├─ dist/index.html            single-file bundle for sharing (rebuilt from modules)
├─ redemptions-edge.html      pre-split single-file backup (ignore)
└─ RedemptionsEdge_playtest.zip  old share zip (Windows backslash paths — see §8)
```

Load order in `index.html`: config → utils → input → audio → camera → world → **assets →
chris-manifest → sprites** → entities → systems → game → render → main.

## 3. Architecture notes that matter for art

- **Classic `<script>` tags, one shared global scope** — chosen so the game runs by
  double-clicking (no server). Consequence: **no `fetch()` and no ES modules** (both break on
  `file://`). That's why the sprite manifest is a **JS object** (`chris-manifest.js`), not a
  fetched `.json`. **Images via `Image()` DO work on `file://`**, so PNG sheets are fine.
- **Single-file share build** (`dist/index.html`): a bundler inlines all modules into one
  `<script>`. When we add real image assets, the bundler must **base64-inline the PNGs** and
  include the 3 new sprite modules in its order array (not done yet — do it when art lands).
- **Collision is authoritative, never derived from art.** Player radius = 15 at `(x,y)`.
  Sprites are visual only, anchored at the feet.

## 4. What's already built (so you don't re-do it)

Milestones M0–M3.5 complete (see `ROADMAP.md`): modular split, Hicksville reskin, arcade-feel
(dash+i-frames, dynamite, enemy attack tells, difficulty modes), overworld (props, wanted board,
treasure strongboxes, desert landmarks), tools (lasso, lockpick, horse whistle, Dead Eye), and
the **GTA-style Manhunt** (search-zone wanted cooldown, camp safehouse, bribe tokens).

**Controls (THIS build):** WASD move · Mouse aim · Click/Space fire · **Right-Mouse Dead Eye** ·
Shift dash · **Q dynamite** · F lasso · H whistle · R reload · E interact · ESC pause.
*(Note these differ from the Codex handoff doc, which says Q=Dead Eye, G=dynamite. Ignore that.)*

## 5. The sprite pipeline — how art plugs in

Already scaffolded and **flag-OFF** (game currently uses procedural `drawGunslinger`). Files:

- **`game/assets.js`** — `Assets.loadImage(key, src)` (promise, cached, fails safe).
- **`game/chris-manifest.js`** — `CHRIS_MANIFEST`: frame size, anchor, per-animation file +
  `framesPerDirection` + `frameDurationMs` + `loop`, direction order, fallbacks.
- **`game/sprites.js`** — `vectorTo8DirName()`, `SpriteAnimator`, `ChrisSprites` (loads sheets;
  synthesizes a **placeholder sheet** if a PNG is missing), `drawChrisSprite()` (anchored
  renderer), `drawSpriteDebug()`.
- **`config.js` flags:** `USE_SPRITES` (master, off), `SPRITE_PLACEHOLDER` (on),
  `SPRITE_DRAW_SCALE` (0.5), `SPRITE_FOOT_OFFSET` (12), `SPRITE_DEBUG` (off).
- **`entities.js`** — `Player.updateSpriteAnim()` maps state→anim (hurt>mounted>shoot>dash>
  walk>aim) & facing from aim; `Player.render()` draws sprite when `USE_SPRITES` && ready &&
  on-foot, else `drawGunslinger`.

**To see the pipeline live right now:** set `USE_SPRITES:true` (and `SPRITE_DEBUG:true`) in
`config.js`, reload → animated 8-direction placeholder Chris. Set back to `false` after.

**Verified:** all modules pass `node --check`; 16/16 sprite logic tests pass (see git/history).

## 6. THE ASSET REVIEW — required format + procedure

### 6a. The format the engine wants (from `CHARACTER_SPRITE_SPEC.md`)

Locked art direction: **three-quarter top-down, 8-direction, full-body** (gun reads toward
facing; bullets still fire at the exact cursor — gameplay unchanged).

| Requirement | Value |
|---|---|
| File type | transparent **PNG** (RGBA / color-type 6). WebP ok later; PSD/Procreate = source only |
| Cell size | **128 × 128 px** |
| Sheet layout | **each ROW = a direction**, **each COLUMN = a frame** |
| Direction order (top→bottom) | south, southwest, west, northwest, north, northeast, east, southeast |
| Frames/dir | idle 4 · walk 8 · aim 1 · shoot 3 (editable in the manifest) |
| Sheet dims | `(frames×128)` wide × `(8×128=1024)` tall |
| Alignment | feet on a consistent baseline (~y=108 in cell), horizontally centered |
| Must NOT contain | baked shadow, background, labels, borders |
| Filenames | `chris_idle.png`, `chris_walk.png`, `chris_aim.png`, `chris_shoot.png` |

### 6b. How to analyze the upload

1. Unzip to scratchpad: `.../scratchpad/asset_review/`.
2. Run the inspector: `py docs/tools/inspect_assets.py <zip-or-folder>`
   - Reports per file: format, dimensions, **alpha present?**, inferred **grid @128**, whether
     rows==8, frames/dir vs expected, and (if Pillow is installed) **per-cell feet-baseline
     consistency**.
3. Read the user's **Python imaging code** in the zip. Determine:
   - What it inputs/outputs (individual frames? one big sheet? per-direction sheets?).
   - Whether it emits transparent PNG at 128px cells in the right row/col order.
   - Whether feet are anchored consistently, or if it bakes shadows/backgrounds.
   - The smallest change to make its output match §6a (prefer fixing the generator over
     hand-editing exported files, so re-exports stay compatible).

### 6c. Decision tree

- **Matches §6a** → integrate (§7).
- **Close but off** (wrong cell size / row order / has baked shadow / frames packed as columns-
  as-directions / separate files per frame) → write a small converter (Pillow) that re-slices/
  re-packs/trims/re-orders into compliant sheets, OR adjust the user's Python generator. Keep
  the manifest flexible: `framesPerDirection`, `frameDurationMs`, `anchor`, `drawScale` are all
  editable without touching renderer code.
- **Fundamentally different** (e.g. not a spritesheet, or a single hero illustration, or 4-dir
  only) → tell the user plainly, propose options (commission the missing views, start with a
  4-direction MVP by editing the manifest, or use as concept art not in-engine).

### 6d. Things to explicitly check / flag

- Alpha is REAL transparency (not white/checker background baked in).
- No premultiplied-alpha halos / matte fringing around edges.
- Consistent cell size across all sheets; no off-by-one padding.
- Direction row order matches (south first). If the artist used a different order, either
  re-order the sheet or change `CHRIS_MANIFEST.directions` (but keep it consistent everywhere).
- Reasonable file sizes (these get base64-inlined into the single-file share; multi-MB sheets
  bloat it — note it, maybe downscale/optimize).
- Color palette reads against the game's warm/dusty backgrounds; Chris needs the strongest
  silhouette on screen.

## 7. Integration steps (once assets pass)

1. Put the PNGs in `assets/characters/chris/` with the exact names in §6a.
2. If frame counts differ from the defaults, update `CHRIS_MANIFEST.animations[*].framesPerDirection`.
3. Set `CFG.USE_SPRITES = true` in `config.js`.
4. Reload; turn on `SPRITE_DEBUG` to see the anchor vs collision. Tune **two numbers**:
   `SPRITE_DRAW_SCALE` (target ~52px tall) and `SPRITE_FOOT_OFFSET` (feet plant on the shadow).
5. Smoke-test: move/aim in 8 dirs, fire (shoot anim one-shots), dash, take damage, mount/dismount
   (should fall back to procedural rider), enter camp. Confirm NOTHING gameplay changed.
6. `node --check` all modules + the concatenation. Turn `SPRITE_DEBUG` off.
7. When ready to re-share: rebuild `dist/index.html` with the sprite modules added to the
   bundler order AND the PNGs base64-inlined (so the single-file share still works).

## 8. Constraints & gotchas (learned the hard way)

- **`git push` from the agent works fine** (confirmed 2026-07-02) — outbound network access to
  GitHub is available here, so pushes can be run directly instead of deferring to the user.
  Current remote: `origin` → `github.com/soldierboy31u-spec/Edge-Me-Please.git` (the earlier
  `redemptions-edge-claude` repo returned "Repository not found" — never existed on GitHub;
  the user redirected to Edge-Me-Please instead, which pushed successfully).
- **`file://` forbids `fetch` + ES modules** → keep manifests as JS, load images via `Image()`.
- **Windows `Compress-Archive` writes backslash paths** in zips, which break on Linux hosts
  (Netlify) — the `game/` folder 404s. For sharing, prefer the **single-file `dist/index.html`**
  (base64-inlined) or make zips with forward slashes.
- **Pillow may not be installed** in the agent env (and can't be pip-installed offline). The
  inspector script degrades gracefully to a stdlib-only PNG header parse; deep per-cell checks
  need Pillow (the user's machine has it).
- Keep the old `drawGunslinger` fallback — never delete it; it's the safety net behind the flag.

## 9. Confirm with the user (quick questions for the new session)

- Are the assets **spritesheets** (rows=dirs, cols=frames) or **individual frames**/other layout?
- What tool/pipeline generated them (the Python code)? Procedural? AI-generated? Hand-drawn scans?
- 8-direction or fewer? Which animations are included (idle/walk/aim/shoot/others)?
- Is there a signature Chris feature to preserve (e.g. red scarf) for silhouette tracking?

## 10. Suggested kickoff prompt (paste into the new session)

> "Continuing Redemption's Edge (the `RDR22dversion` / Claude build). Read
> `docs/SESSION_HANDOFF.md` first. I've uploaded a zip with art assets and the Python imaging
> code I used. Analyze whether the assets are in the ideal format for the sprite pipeline
> (per `docs/CHARACTER_SPRITE_SPEC.md`), review my Python code, and tell me what to fix or
> convert before we integrate Chris. Don't change gameplay."
