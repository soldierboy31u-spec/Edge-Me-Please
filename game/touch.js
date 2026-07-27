"use strict";
/* Redemption's Edge — touch.js
   Mobile controls (M15): twin-stick + action buttons layered onto the
   existing Input abstraction — the touch layer synthesizes the same
   keys/pressed/mouse state the desktop produces, so gameplay code never
   knows the difference.
     Left half   : movement stick (appears where the thumb lands)
     Right half  : aim stick — deflect past the deadzone to fire
     Buttons     : E / DASH / dynamite / lasso / whistle / Dead Eye (hold) / pause
   Activates on the first touch; pressing any key hands control back to
   the keyboard. Loaded as a classic <script> (order matters). */

const TouchUI = {
  active: false,
  canvas: null,
  STICK_R: 66,          // max thumb travel (canvas px)
  FIRE_DEADZONE: 0.35,  // aim deflection that pulls the trigger
  move: { id: null, ox: 0, oy: 0, dx: 0, dy: 0 },
  aim:  { id: null, ox: 0, oy: 0, dx: 0, dy: 0 },
  buttons: [],
  _menuTaps: {},        // touch id -> true while a menu tap is held
  _hadMoveKeys: false,

  init(canvas) {
    this.canvas = canvas;
    this.moveBase = { x: 170, y: CFG.VIEW_H - 150 };
    this.aimBase  = { x: CFG.VIEW_W - 180, y: CFG.VIEW_H - 150 };
    this.buttons = [
      { key: 'e',        label: 'E',    x: CFG.VIEW_W - 330, y: CFG.VIEW_H - 72,  r: 40 },
      { key: 'shift',    label: 'DASH', x: CFG.VIEW_W - 320, y: CFG.VIEW_H - 190, r: 34 },
      { key: 'q',        label: '\u{1F9E8}', x: CFG.VIEW_W - 236, y: CFG.VIEW_H - 268, r: 30 },
      { key: 'f',        label: '\u{1FAA2}', x: CFG.VIEW_W - 138, y: CFG.VIEW_H - 292, r: 30 },
      { key: 'h',        label: '\u{1F434}', x: CFG.VIEW_W - 52,  y: CFG.VIEW_H - 268, r: 30 },
      { key: '_deadeye', label: '\u{1F441}', x: 64, y: CFG.VIEW_H - 268, r: 34, hold: true },
      { key: 'escape',   label: 'II',   x: CFG.VIEW_W - 250, y: 36, r: 26 },
    ];
    const opt = { passive: false };
    canvas.addEventListener('touchstart',  e => this._start(e), opt);
    canvas.addEventListener('touchmove',   e => this._move(e),  opt);
    canvas.addEventListener('touchend',    e => this._end(e),   opt);
    canvas.addEventListener('touchcancel', e => this._end(e),   opt);
    addEventListener('keydown', () => { this.active = false; });   // keyboard reclaims
  },

  _pt(t) {   // client -> canvas coords (same mapping as the mouse handler)
    const r = this.canvas.getBoundingClientRect();
    // Degenerate rect (hidden/headless tab) would divide to NaN — fall back
    // to treating client coords as canvas coords.
    const sx = r.width  ? this.canvas.width  / r.width  : 1;
    const sy = r.height ? this.canvas.height / r.height : 1;
    return [ (t.clientX - r.left) * sx, (t.clientY - r.top) * sy ];
  },
  _press(key) {
    if (key === '_deadeye') { Input.mouse.rdown = true; return; }
    if (!Input.keys[key]) Input.pressed[key] = true;
    Input.keys[key] = true;
  },
  _release(key) {
    if (key === '_deadeye') { Input.mouse.rdown = false; return; }
    Input.keys[key] = false;
  },

  _start(e) {
    e.preventDefault();
    if (!this.active) {
      this.active = true;
      const hint = document.getElementById('hint');
      if (hint) hint.style.display = 'none';
    }
    Audio.ensure(); Audio.resume();
    for (const t of e.changedTouches) {
      const [x, y] = this._pt(t);
      // buttons win everywhere (the pause button must work while paused)
      const b = this.buttons.find(b => b.id == null && dist(x, y, b.x, b.y) < b.r + 16);
      if (b) { b.id = t.identifier; this._press(b.key); continue; }
      // outside PLAY a tap acts as a mouse click (start screen, game over)
      if (Game.state !== STATE.PLAY) {
        Input.mouse.x = x; Input.mouse.y = y; Input.mouse.down = true;
        this._menuTaps[t.identifier] = true;
        continue;
      }
      // sticks: left half moves, right half aims — origin where the thumb lands
      if (x < CFG.VIEW_W / 2 && this.move.id == null) {
        this.move.id = t.identifier; this.move.ox = x; this.move.oy = y;
        this.move.dx = 0; this.move.dy = 0;
      } else if (this.aim.id == null) {
        this.aim.id = t.identifier; this.aim.ox = x; this.aim.oy = y;
        this.aim.dx = 0; this.aim.dy = 0;
      }
    }
  },

  _move(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const [x, y] = this._pt(t);
      for (const s of [this.move, this.aim]) {
        if (s.id === t.identifier) {
          s.dx = clamp((x - s.ox) / this.STICK_R, -1, 1);
          s.dy = clamp((y - s.oy) / this.STICK_R, -1, 1);
        }
      }
    }
  },

  _end(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this._menuTaps[t.identifier]) { Input.mouse.down = false; delete this._menuTaps[t.identifier]; }
      if (this.move.id === t.identifier) { this.move.id = null; this.move.dx = this.move.dy = 0; }
      if (this.aim.id === t.identifier)  { this.aim.id = null;  this.aim.dx = this.aim.dy = 0; Input.mouse.down = false; }
      for (const b of this.buttons) if (b.id === t.identifier) { b.id = null; this._release(b.key); }
    }
  },

  // Once per frame from the main loop: continuous stick -> Input mapping.
  frame() {
    if (!this.active) return;
    // movement stick -> WASD (same 8-way space the keyboard lives in)
    const m = this.move;
    const on = (k, v) => { if (v && !Input.keys[k]) Input.pressed[k] = true; Input.keys[k] = v; };
    if (m.id != null) {
      on('w', m.dy < -0.25); on('s', m.dy > 0.25);
      on('a', m.dx < -0.25); on('d', m.dx > 0.25);
      this._hadMoveKeys = true;
    } else if (this._hadMoveKeys) {
      on('w', false); on('s', false); on('a', false); on('d', false);
      this._hadMoveKeys = false;
    }
    // aim stick -> a mouse point out along the thumb direction from Chris,
    // firing while deflected past the deadzone
    const a = this.aim;
    if (Game.state === STATE.PLAY && Game.player && a.id != null) {
      const len = Math.hypot(a.dx, a.dy);
      if (len > 0.12) {
        const [px, py] = W2S(Game.player.x, Game.player.y);
        Input.mouse.x = px + (a.dx / len) * 160;
        Input.mouse.y = py + (a.dy / len) * 160;
      }
      Input.mouse.down = len > this.FIRE_DEADZONE;
    }
  },
};

// Drawn at the end of the HUD pass (render.js) — sticks fade in under the
// thumbs, buttons sit in fixed arcs, [E] glows when something's interactable.
function drawTouchControls() {
  if (!TouchUI.active || Game.state === STATE.START) return;
  if (Game.state !== STATE.PLAY && Game.state !== STATE.PAUSE) return;
  ctx.save();
  const stick = (s, base) => {
    const bx = s.id != null ? s.ox : base.x, by = s.id != null ? s.oy : base.y;
    ctx.globalAlpha = s.id != null ? 0.5 : 0.22;
    ctx.strokeStyle = '#e8d5a8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(bx, by, TouchUI.STICK_R, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(232,213,168,0.55)';
    ctx.beginPath();
    ctx.arc(bx + s.dx * TouchUI.STICK_R, by + s.dy * TouchUI.STICK_R, 26, 0, TAU);
    ctx.fill();
  };
  stick(TouchUI.move, TouchUI.moveBase);
  stick(TouchUI.aim,  TouchUI.aimBase);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const b of TouchUI.buttons) {
    const interactGlow = b.key === 'e' && Game.interactPrompt;
    ctx.globalAlpha = b.id != null ? 0.75 : interactGlow ? 0.85 : 0.3;
    ctx.fillStyle = 'rgba(30,20,10,0.85)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = interactGlow ? '#ffde7a' : '#e8d5a8';
    ctx.lineWidth = interactGlow ? 3 : 2;
    ctx.stroke();
    ctx.fillStyle = interactGlow ? '#ffde7a' : '#e8d5a8';
    ctx.font = 'bold ' + (b.r >= 34 ? 16 : 15) + 'px Georgia';
    ctx.fillText(b.label, b.x, b.y + 1);
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}
