"use strict";
/* Redemption's Edge — camera.js
   Part of the modular build. Loaded as a classic <script> in index.html (order matters).
   See docs/ROADMAP.md for the project map. */

/* ---------------------------------------------------------------------------
   5. CAMERA
   --------------------------------------------------------------------------- */
const Camera = {
  x: 0, y: 0,
  shake: 0,
  follow(tx, ty, dt) {
    // Smooth critically-damped follow toward target centre.
    const targetX = clamp(tx - CFG.VIEW_W / 2, 0, CFG.WORLD_W - CFG.VIEW_W);
    const targetY = clamp(ty - CFG.VIEW_H / 2, 0, CFG.WORLD_H - CFG.VIEW_H);
    const k = 1 - Math.exp(-7 * dt);
    this.x = lerp(this.x, targetX, k);
    this.y = lerp(this.y, targetY, k);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 28);
  },
  addShake(v) { this.shake = Math.min(16, this.shake + v); },
  get ox() { return this.x + (this.shake ? rand(-this.shake, this.shake) : 0); },
  get oy() { return this.y + (this.shake ? rand(-this.shake, this.shake) : 0); },
};
