"use strict";
/* Redemption's Edge — input.js
   Part of the modular build. Loaded as a classic <script> in index.html (order matters).
   See docs/ROADMAP.md for the project map. */

/* ---------------------------------------------------------------------------
   3. INPUT MANAGER
   --------------------------------------------------------------------------- */
const Input = {
  keys: {},
  mouse: { x: CFG.VIEW_W / 2, y: CFG.VIEW_H / 2, down: false, rdown: false },
  pressed: {},        // edge-triggered this frame
  _consumed: {},
  init(canvas) {
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
      // Prevent page scroll on space / arrows
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) { this.mouse.rdown = true; e.preventDefault(); }
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },
  // Was the key pressed this frame (consumed once).
  hit(k) {
    if (this.pressed[k] && !this._consumed[k]) { this._consumed[k] = true; return true; }
    return false;
  },
  endFrame() { this.pressed = {}; this._consumed = {}; },
};
