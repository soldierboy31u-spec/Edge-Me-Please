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

> Isometric video game building sprite, true 2:1 isometric projection like
> Diablo, single building on a fully transparent background, no ground plane,
> no shadow on the ground, no text. Hand-drawn cartoon western style with ink
> outlines, weathered wood, warm sepia palette. Shows the roof and two walls:
> the lit front-left wall and the shaded front-right wall, light from the
> south-west. **[BUILDING-SPECIFIC LINE]** Footprint is a 2:1 diamond with a
> width-to-depth ratio of about **[RATIO]**. One storey with a tall western
> false-front parapet.

Building-specific lines:
- Saloon: "A crooked frontier saloon with swinging batwing doors and a porch overhang on the front-left wall; the whole building leans slightly."
- Sheriff: "A sheriff's office with a barred window and a tin star nailed above the door on the front-left wall."
- Store: "A general store with a large display window and crates of goods along the front-left wall; no door visible."
- Bank: "A small-town bank with stone trim, heavy shuttered windows, and an air of smug security; no door visible."
- Undertaker: "An undertaker & taxidermy parlor with a coffin leaning beside the door and a crooked chimney."
- Stable: "A horse stable with wide barn doors on the front-left wall and hay spilling out."
- Chapel: "An abandoned desert chapel with a steeple and cross, boarded windows, deeper than it is wide."
- Tent: "A large patched canvas outlaw tent with rope stays and a smoke-stained peak."

## Checklist before we call a building "in"

- [ ] 2:1 diamond footprint, correct w:h ratio
- [ ] Roof + exactly two visible faces (front-left lit, front-right shaded)
- [ ] Transparent background, no baked ground/shadow/text
- [ ] Light from the south-west (matches every other building)
- [ ] Reads at ~40% scale (squint test)
