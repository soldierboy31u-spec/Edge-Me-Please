# Redemption's Edge — Roadmap & Project Anchor

> **Read this first, every session.** It is the map. When your mind wanders, the
> idea goes in the **Idea Parking Lot** at the bottom — not into the build. You
> finish the current milestone, *then* pull from the lot. That's the whole trick.

This is **Claude's build** of Redemption's Edge (the `RDR22dversion` folder).
Codex is building its own version in a separate folder — that's intentional, a
bake-off. Don't cross the streams; this repo only contains Claude's version.

---

## ⮕ YOU ARE HERE

**Milestone 0 — Project structure: ✅ DONE** (single file split into `game/*.js`)
**Hicksville reskin: ✅ DONE** (town, camp, Darryl, lore)
**Milestone 1 — Arcade Feel: ✅ DONE** (dash+i-frames, dynamite, enemy tells, knockback, bigger gangs, difficulty modes)
**Milestone 2 — Hicksville Overworld: ✅ DONE** (town props/alleys, wanted board, dig caches, desert landmarks)
**Milestone 3 — Tools Pass: ✅ DONE** (lasso, lockpick, horse whistle, Dead Eye)
**M3.5 — The Manhunt: ✅ DONE** (GTA search-zone wanted cooldown; camp safehouse; bribe tokens)
**Milestone 4 — Mission Slice: ✅ DONE** (Missions I–III via Darryl, title cards, objective HUD + markers)
**Milestone 5 — Boss Slice: ✅ DONE** (Mission IV: Buckshot Benny at the Rattlebone hideout, 3-phase fight)
**Milestone 6 — Art Pass: ✅ DONE** (film grain/vignette/sepia, ink outlines, cartoon impacts, western HUD panels)

**Next up →** pick from the Idea Parking Lot (demon-arc finale is the natural M7 —
Darryl's "Benny was a symptom" hook is live). Remaining art (optional): the hurt sheet only.
*(Sprite status: idle + walk + shoot + dash + mounted IN, `USE_SPRITES` ON. Mounted =
horse+rider in one 128px cell, scaleMul 1.4; unridden horses stay procedural.)*

---

## What the game is (one paragraph)

A top-down, open-world Wild-West arcade action game. You play **Chris King
("Dckslinger")**, an outlaw based out of **Darryl's camp**, near the crooked
town of **Hicksville**, on a haunted desert frontier where the supernatural
(first threat: **desert demons**) is real. Be a folk hero, rob the place blind,
or stumble into redemption — the world reacts with a wanted system and honor.
Tone: heroic, chaotic, funny, rugged, dark. Look: hand-drawn cartoon western.

## Locked decisions (don't relitigate these)

- Title: **Redemption's Edge**. Player: **Chris King / "Dckslinger"**.
- The supernatural is **real**. First threat: **desert demons**.
- Player starts with an **outlaw camp**, run by **Darryl**.
- Civilians are **killable & robbable** — strong consequences, never hard-blocked.
- Codebase: **multi-file, classic `<script>` tags** (double-click to play, no
  build step, GitHub Pages works). Not ES modules, not one giant file.
- Scope discipline: **strict milestone order + parking lot.**

---

## How to run it

- **Play:** double-click `index.html`. That's it — no server needed.
- **Old single-file backup:** `redemptions-edge.html` (pre-split snapshot; keep it).
- **Deploy:** push the folder to GitHub Pages; `index.html` is the entry point.

## Architecture map (where does code live?)

Files load in this order (set in `index.html`). Classic scripts share one global
scope, so `CFG`, `Game`, `class Player`, etc. are visible everywhere.

| File | Owns |
|---|---|
| `game/config.js`   | `CFG` tuning constants, `STATE` enum |
| `game/utils.js`    | math helpers, `circleRect` collision |
| `game/input.js`    | keyboard + mouse manager |
| `game/audio.js`    | synthesized Web Audio SFX |
| `game/camera.js`   | follow camera + screen shake |
| `game/world.js`    | Hicksville buildings, Darryl's camp, scenery, world data |
| `game/entities.js` | Player, Enemy, Bullet, Particle, Pickup, Horse, Townsfolk + procedural art |
| `game/systems.js`  | `Wanted` system (honor, missions, dialogue go here later) |
| `game/game.js`     | `Game` controller: state machine, spawning, update loop, world queries |
| `game/render.js`   | all drawing — world, HUD, minimap, screens, camp |
| `game/main.js`     | bootstrap + requestAnimationFrame loop |

**Rule of thumb for new work:** a new *system* (honor, missions) → `systems.js`.
A new *entity* → `entities.js`. New *tuning* → `config.js`. New *drawing* →
`render.js`. If a file crosses ~600 lines, split it (e.g. `entities/` folder).

---

## Milestones (the spine — do them roughly in order)

- [x] **M0 — Structure.** Split single file → modules. ✅
- [x] **Reskin — Hicksville.** Town, camp, Darryl, lore. ✅
- [x] **M1 — Arcade Feel.** ✅ Dash/dodge (Shift, i-frames), faster move, dynamite
      (Q, throw+fuse+blast), enemy attack tells (windup aim line), bullet+blast
      knockback, dynamite pickups, bigger gangs. **Difficulty modes** (Easy/Normal/Hard,
      picked 1/2/3 on start screen) — Easy = the original M1 feel. All tuning in
      `config.js` (`CFG` + `DIFFICULTY` table). Dash cooldown bumped to 0.95s per playtest.
- [x] **M2 — Hicksville Overworld.** ✅ Shaded town clutter (barrels/crates/posts/troughs)
      forming alleys; readable **wanted board** (bounty + rumors); **treasure strongboxes**
      you open with E (closed→open art); desert **landmarks** — bone arch, wagon-circle ambush, desert
      shrine (heal), collapsed **mine you can blast open with dynamite** (M3 bridge),
      dry riverbed, night-only **ghost-lantern trail**. Landmarks + caches on minimap.
- [x] **M3.5 — The Manhunt.** ✅ GTA-style two-state wanted cooldown: HUNTED (lawman has
      line of sight, no cooldown) vs SEARCHING (broke sight → law sweeps a search zone at
      your last-seen spot, stars flash + tick down ~4s each). Camp = safe haven (3× cooldown,
      law won't enter). Bribe tokens (lawmen drop them) knock off a star. Search-zone ring +
      lawman vision cones in-world & on minimap. Forgiving/arcade tuning in `config.js`.
      Supernatural-flats escape route deferred → parking lot.
- [x] **M3 — Tools.** ✅ **Lasso** (F — ropes+stuns enemies, yanks loot), **Lockpick**
      (opens chapel cellar + undertaker for loot), **Horse whistle** (H — gallops your
      horse to you), **Dead Eye** (hold Right-Mouse — world slows, your shots fly full
      speed +1.7× dmg, meter fills from kills). Dynamite was done in M1. Tuning in `config.js`.
      NOTE: tools are granted from the start for now; gating to unlock-order is deferred to M4/M5.
- [x] **M4 — Mission Slice.** ✅ `Missions` state machine in `systems.js`; Darryl offers
      the three missions in order (talk with E at camp). Cinematic **title cards**
      (letterboxed, fade in/out), **objective line** top-centre, **gold marker** on the
      minimap + bouncing chevron in-world (kill stages track the nearest target). Missions
      never gate the sandbox; pre-completed steps (chapel looted / mine blasted) auto-skip.
      Rewards tuned in `config.js` (`M1_REWARD` etc.).
      - M1: *Welcome to Hicksville* — saloon "staged argument" shootout → wanted-board
        clue (missing travelers, fake bounties) → report to Darryl.
      - M2: *The Bone-Dry Job* — riverbed wagon ambush (lasso hint) → claw-mark demon
        clue → CHOICE: return supplies to Darryl ($30) or fence at the Lucky Tooth ($60).
      - M3: *Trouble Under the Chapel* — lockpick cellar → dynamite the collapsed mine →
        ritual-chamber clue + Dead Eye refill ("setup") → Darryl's ominous close (M5 hook).
- [x] **M5 — Boss Slice.** ✅ Mission IV *The Rattlebone Gang* (Darryl, after M3): ride east
      past the Bone Arch to the **Rattlebone Hideout** (new landmark — spire-walled bowl,
      crate cover, bone throne) → wipe out 4 guards → **BUCKSHOT BENNY** (intro title card,
      HUD boss bar with phase notches, big minimap blip). `class Boss extends Enemy`
      (entities.js): shotgun fan (5–7 pellets), 3 phases by HP — P2 summons Rattlebones +
      lobs dynamite when kited, P3 demon-touched (red aura, telegraphed shoulder charge,
      contact dmg + knockback). Lasso only briefly holds him; knockback resistance 0.35×.
      Death: black-ichor story beat, +1000 score, money/dynamite burst → report to Darryl
      ($150, M6 demon-arc hook). Tuning in `config.js` (`BOSS_*`, `M4_REWARD`).
- [~] **Art remodel — Chris sprite pipeline (LIVE, flag-ON).** ✅ `game/assets.js`
      (loader), `game/chris-manifest.js` (anim defs as JS, not fetched JSON), `game/sprites.js`
      (8-dir resolver + `SpriteAnimator` + `ChrisSprites` + anchored renderer + auto placeholder
      + debug overlay). `Player.render` uses sprites when `USE_SPRITES` on + on-foot, else the
      untouched `drawGunslinger` fallback. Contract: `docs/CHARACTER_SPRITE_SPEC.md`. Art locked:
      three-quarter top-down, 8-direction, full-body (gun snaps to facing; bullets fire at cursor).
      IN: `chris_idle.png` (4f), `chris_walk.png` (8f), `chris_shoot.png` (3f) — every package so
      far shipped wrong-facing east-family frames; `docs/tools/fix_sheet.py` rebuilds those rows as
      west-family mirrors + cleans halo residue, and `docs/tools/validate_sheet.py` checks a sheet
      in one command. Contract baseline = feet y=108; idle is legacy y=122 via per-anim
      `anchor`/`scaleMul` manifest overrides (lossless, no resample). `USE_SPRITES: true`,
      `SPRITE_DRAW_SCALE: 0.51`. Missing sheets fall back: aim→idle art, dash→walk,
      hurt→idle, mounted→procedural rider. STILL TO COME: aim (then dash/hurt/mounted).
- [x] **M6 — Art Pass.** ✅ All code-side, tunable in `config.js` (`FX_*`, 0/false disables):
      **film pass** over the whole frame incl. menus — animated crawling grain (3 cached
      noise tiles), baked radial vignette, warm sepia multiply wash; **ink outlines** —
      Chris sprites get an auto-built black-silhouette sheet drawn at ±1px (built once per
      sheet at load), procedural bandits/townsfolk get contour strokes; **cartoon impacts** —
      `HitSpark` 6-point starburst on bullet hits, bigger gold KO burst on kills (huge for
      the boss), dash speed-line smears; **western HUD panels** — `drawPanel()` leather +
      double border + brass rivets on the HP panel, money box, boss bar, minimap.
      (Title cards were already done in M4; sprite placeholders in the art-remodel track.)

**Definition of "done" for a milestone:** it's playable, it doesn't break the
core loop, and the change is committed/backed up before starting the next one.

---

## Systems that must agree (decide before they collide)

These five all read/write shared reactive state — sketch interactions *before*
building, not after they break:
`wanted level` ↔ `honor` ↔ `bounty hunters` ↔ `lawmen` ↔ `shop access`.
Open question already noted: what happens to honor-gated shop access while wanted
is active? (Answer when M3/M4 makes it real.)

---

## Idea Parking Lot 🅿️

*Capture stray ideas here so they stop nagging — then get back to the milestone.
Nothing here is a commitment.*

- Buckshot Benny boss + Rattlebone Gang hideout (→ M5)
- Desert demons' first visual form — TBD (shadow gunslingers? cartoon devils?)
- Fishing economy + "impossible" haunted desert fish
- Black-market dealer at low honor / secret shop discount at high honor
- Ghost-lantern trail at night (day/night already has a tint hook in render.js)
- **Supernatural-flats escape route** (deferred from M3.5): lawmen fear the haunted desert —
  won't chase past the bone arch / hesitate at night. Western-supernatural twist on the manhunt.
- Undertaker & Taxidermy: something knocking inside (demon hook)
- Bank robbery already in — could grow into a timed heist with a posse chase

---

## Open questions (answer when the relevant milestone arrives)

1. Darryl: older mentor / shady uncle / ex-preacher / failed outlaw boss?
2. First boss: rival outlaw / corrupt sheriff / demon vessel / blend?
3. What does "redemption" mean for Chris — clear his name / break a curse / protect the camp / just not get worse?
4. Desert demons' first visual form?
5. Dark humor: cartoon-violent, or genuine western horror?
