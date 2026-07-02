Drop Chris's sprite sheets here:

  chris_idle.png    (4 frames/direction)
  chris_walk.png    (8 frames/direction)
  chris_aim.png     (1 frame/direction)
  chris_shoot.png   (3 frames/direction)

Later: chris_dash.png, chris_hurt.png, chris_mounted.png

FORMAT (see docs/CHARACTER_SPRITE_SPEC.md for the full contract):
- 128 x 128 px cells, transparent PNG
- Each ROW = one direction, top to bottom, in this order:
    south, southwest, west, northwest, north, northeast, east, southeast
- Each COLUMN = one animation frame, left to right
- Feet on a consistent baseline (~y=108 in the cell), horizontally centered
- No baked shadow, background, labels, or borders

Once these files exist, set USE_SPRITES: true in game/config.js and the game
uses them automatically (no code changes). Until then, the game either uses the
current procedural art (flag off) or auto-generated placeholders (flag on).
