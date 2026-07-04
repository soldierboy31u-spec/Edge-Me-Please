# Isometric Building Spec — Depth Pass Tier 2 (Redemption's Edge)

Contract for AI-generated isometric building art so PNGs drop into the iso
renderer with only a manifest tweak (like the character sheets). One static
image per building — no animation, so no frame-coherence problems.

## Camera / projection (must match the engine)

- **True 2:1 isometric** ("Diablo / Age of Empires camera"): the world is
  rotated 45° and tilted so a square footprint becomes a **2:1 diamond**
  (twice as wide as tall).
- Each building shows **the roof plus TWO faces**:
  - **front-left face** = the building's south side (most doors live here)
  - **front-right face** = the building's east side
- **Light comes from the LEFT (south-west)** — front-left face is the lit
  one, front-right face is in half-shadow. SAME for every building.

## Delivery format

- **Transparent PNG, one building per file.** Canvas ~**768×768** (we scale
  down in-engine; bigger is fine, keep proportions).
- **No ground, no ground shadow, no background, no vignette** — the engine
  draws terrain and shadows.
- **No text labels** — the engine draws name signs. (A blank painted sign
  board over the door is welcome; leave it empty.)
- Center the footprint diamond horizontally; leave headroom for roof/steeple.
- Filenames: `iso_saloon.png`, `iso_sheriff.png`, `iso_store.png`,
  `iso_bank.png`, `iso_undertaker.png`, `iso_stable.png`, `iso_chapel.png`,
  `iso_tent.png` → deliver to `assets/iso/buildings/`.

## Style (matches the game's art pass)

Hand-drawn cartoon western, inky outlines, weathered wood siding, warm
sepia-leaning palette (browns #5a3d22–#54402a, sun-bleached planks), slightly
crooked/leaning silhouettes — Hicksville is a crooked town. Think "Darkest
Dungeon meets Lucky Luke storefronts".

## Footprint proportions per building

The footprint diamond's width:depth ratio must match the collision rect
(w × h below). Wall height ≈ 55–75 px at the scale where the diamond is
~440 px wide (one storey + parapet; chapel and saloon read taller).

| File | Building | Footprint w×h | Diamond ratio (w:h) | Door face | Extras |
|---|---|---|---|---|---|
| `iso_saloon.png`     | The Leaning Saloon     | 280×200 | 1.40 | front-left | swinging doors, porch overhang, leaning parapet |
| `iso_sheriff.png`    | Sheriff Crook's Office | 240×180 | 1.33 | front-left | barred window, star above door |
| `iso_store.png`      | Lucky Tooth Store      | 250×190 | 1.32 | **rear** (north) | big display window on front-left face |
| `iso_bank.png`       | Hicksville Bank        | 210×165 | 1.27 | **rear** (north) | stone trim, heavy shutters |
| `iso_undertaker.png` | Undertaker & Taxidermy | 190×160 | 1.19 | front-left | coffin leaned by the door, crooked chimney |
| `iso_stable.png`     | Broken Spur Stable     | 220×160 | 1.38 | **rear** (north) | wide barn doors on front-left face, hay |
| `iso_chapel.png`     | Abandoned Chapel       | 200×220 | 0.91 (deeper than wide) | front-left | steeple + cross, boarded windows |
| `iso_tent.png`       | Darryl's Tent          | 180×130 | 1.38 | front-left | canvas tent, patched, rope stays |

"Door face: rear" buildings face the town square (north side, hidden in iso);
their front-left face gets windows instead of a door — still draw it lived-in.

## Ready-to-paste generation prompt (template)

**Generate ONE building per image** (not several in one) — higher quality, correct
framing, and it matches our one-PNG-per-file pipeline. **Attach `iso_saloon.png` as a
reference image** on every generation and say "match the art style, camera angle,
scale, and lighting of this reference" — that single step is the biggest lever for
keeping all 8 buildings consistent.

### SHARED HEADER — paste this identically before every building's line

> Isometric video-game building sprite in the exact style of the attached reference
> image. TRUE 2:1 isometric projection (dimetric, like Diablo or Age of Empires) —
> parallel projection, NO perspective vanishing, NO camera tilt change. One single
> building, centered, entire structure inside the frame with even margin on all sides.
>
> The camera looks down at the building from the south-west at a fixed 2:1 iso angle
> and shows exactly THREE surfaces: the flat top roof, the front-LEFT wall (brightly
> sunlit), and the front-RIGHT wall (in cool shadow). Light source is up-and-to-the-
> left (south-west), so the left wall is warm and pale and the right wall is clearly
> darker — identical lighting to the reference.
>
> Art style: hand-drawn 2D cartoon western, bold dark ink outlines on every edge,
> weathered sun-bleached plank wood, warm sepia palette of dusty browns (pale cream
> #d8c49a highlights, mid browns #7a5a34, dark #3a2818 shadows and outlines).
> Slightly exaggerated storybook proportions, a little crooked and rickety —
> Darkest Dungeon meets Lucky Luke. One storey with a tall flat western false-front.
>
> BACKGROUND: fully transparent (alpha). If transparency is not possible, use a
> FLAT SOLID PURE-MAGENTA (#FF00FF) background with hard edges — never white, never a
> gradient, never a checkerboard, never a drop shadow. Do NOT draw any ground, dirt,
> grass, base plate, or cast shadow under the building. Do NOT write any text, letters,
> numbers, labels, or a signboard with writing — leave sign boards blank.

### PER-BUILDING LINE — append ONE of these after the shared header

- **Sheriff's Office** (`iso_sheriff.png`): "The building is a small-town SHERIFF'S OFFICE. The front-left sunlit wall has a plank door with a small barred jail window beside it and a blank wooden sign board above the door. Footprint slightly wider than deep (about 4:3). Sturdier and squarer than the saloon, flat false-front, a short stovepipe chimney on the roof."
- **Lucky Tooth Store** (`iso_store.png`): "The building is a frontier GENERAL STORE. The front-left sunlit wall has a large multi-pane display window and a couple of wooden crates and a barrel against it — NO door on this wall (the entrance faces away). Blank sign board above the window. Footprint about 4:3, wider than deep. Tall false-front with a small awning over the window."
- **Hicksville Bank** (`iso_bank.png`): "The building is a small-town BANK, a touch grander and more solid than its neighbors. Front-left sunlit wall has stone-block trim at the base, two heavy shuttered windows with iron bars, and a blank stone sign panel — NO door on this wall. Footprint about 5:4. Flat parapet roof, an air of smug security."
- **Undertaker & Taxidermy** (`iso_undertaker.png`): "The building is a gloomy UNDERTAKER & TAXIDERMY parlor. Front-left sunlit wall has a narrow plank door with a plain wooden coffin leaning upright beside it and a small dark window; a crooked brick chimney leans off the roof. Footprint about 6:5. Darker, more weathered wood than the others, slightly sinister."
- **Broken Spur Stable** (`iso_stable.png`): "The building is a horse STABLE / barn. The front-left sunlit wall has WIDE double barn doors (one ajar) with loose hay spilling out onto the boards — this is the main opening. Blank sign board above. Footprint about 4:3, wider than deep. Low gambrel barn roof, a hay-loft hatch high on the false-front."
- **Abandoned Chapel** (`iso_chapel.png`): "The building is an ABANDONED desert CHAPEL, DEEPER than it is wide (footprint about 10:11, taller/longer than the others). Front-left sunlit wall has tall boarded-up windows and a weathered double door. A pitched roof with a small bell STEEPLE topped by a simple wooden CROSS. Faded, holy, forsaken."
- **Darryl's Tent** (`iso_tent.png`): "The structure is a large patched CANVAS OUTLAW TENT (not a wood building). A frayed off-white/tan canvas A-frame tent with rope guy-lines and stakes, a smoke-stained peak, and an open flap doorway on the front-left side facing the viewer. Footprint about 4:3. Rugged, lived-in, a couple of patches sewn on."

## Export & transparency (this is where the last one broke)

- Export **PNG-24 with an alpha channel** ("save transparent PNG" / "keep transparency").
  The saloon came back as RGB-with-baked-white — recoverable, but it costs a cleanup pass.
- If the tool cannot keep alpha, the **flat pure-magenta (#FF00FF) background** from the
  prompt is the fallback — it keys out perfectly (nothing in a wooden building is magenta),
  unlike white which shares tones with the pale wood.
- Deliver the raw file to Downloads (zip or bare PNG). The engine cleanup handles crop,
  key-out, de-fringe, and anchor calibration — the art just needs correct content + a
  clean, flat, keyable background.

## Checklist before we call a building "in"

- [ ] Parallel 2:1 iso, roof + exactly two walls (front-left lit, front-right shaded)
- [ ] Correct footprint ratio + door/window on the wall named above
- [ ] Transparent OR flat pure-magenta background — no white, gradient, shadow, or ground
- [ ] No text/letters anywhere; sign boards blank
- [ ] Style/scale/lighting match the saloon reference (squint test at ~40%)
