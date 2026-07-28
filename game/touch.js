"use strict";
/* Redemption's Edge — touch.js
   Mobile controls (M15/M16): twin-stick + action buttons layered onto the
   existing Input abstraction — the touch layer synthesizes the same
   keys/pressed/mouse state the desktop produces, so gameplay code never
   knows the difference.
     Left half   : movement stick (floats to wherever the thumb lands)
     Right half  : aim stick. Two firing modes (toggle on the pause screen):
       ASSISTED (default) — any deflection fires; shots snap to the nearest
         enemy within a cone of the stick direction. Thumb down with no
         direction auto-targets the nearest hostile. A quick tap fires a burst.
       MANUAL — classic twin-stick: deflect past a threshold to fire, with
         hysteresis so thumb drift doesn't stutter the trigger.
     Buttons     : contextual E / DASH / Dead Eye (hold) / tools / pause
   Sticks are radial (direction from the true vector, never per-axis) and the
   base chases the thumb past the rim, so aim tracks reversals instantly.
   Activates on the first touch; pressing any key hands control back to
   the keyboard. Loaded as a classic <script> (order matters). */

const TouchUI = {
  active: false,
  canvas: null,
  STICK_R: 66,           // max thumb travel (canvas px)
  aimMode: 'assist',     // 'assist' | 'manual' — persisted, toggled on pause
  move: { id: null, ox: 0, oy: 0, dx: 0, dy: 0 },
  aim:  { id: null, ox: 0, oy: 0, dx: 0, dy: 0, t0: 0, maxLen: 0 },
  buttons: [],
  assistTarget: null,    // enemy the assisted fire is locked to (reticle brackets)
  _menuTaps: {},         // touch id -> true while a menu tap is held
  _hadMoveKeys: false,
  _firing: false,        // manual-mode hysteresis latch
  _tapFire: 0,           // seconds of fire remaining from a quick tap

  init(canvas) {
    this.canvas = canvas;
    try { const m = localStorage.getItem('re_aimMode'); if (m === 'manual') this.aimMode = 'manual'; } catch (e) {}
    this.moveBase = { x: 170, y: CFG.VIEW_H - 150 };
    this.aimBase  = { x: CFG.VIEW_W - 180, y: CFG.VIEW_H - 150 };
    // Diet layout (Dead Cells model): big contextual + dash under the thumbs,
    // occasional tools tucked in a top-edge row clear of both aim zones.
    this.buttons = [
      { key: 'e',        label: 'E',    x: CFG.VIEW_W - 64,  y: CFG.VIEW_H - 64, r: 42,
        visible: () => !!Game.interactPrompt },              // contextual — only exists when something's usable
      { key: 'shift',    label: 'DASH', x: CFG.VIEW_W - 52,  y: CFG.VIEW_H - 210, r: 34 },
      { key: '_deadeye', label: '\u{1F441}', x: 44, y: CFG.VIEW_H - 330, r: 34, hold: true },
      { key: 'q',        label: '\u{1F9E8}', x: CFG.VIEW_W - 110, y: 36, r: 24 },
      { key: 'f',        label: '\u{1FAA2}', x: CFG.VIEW_W - 176, y: 36, r: 24 },
      { key: 'h',        label: '\u{1F434}', x: CFG.VIEW_W - 242, y: 36, r: 24 },
      { key: 'escape',   label: 'II',   x: CFG.VIEW_W - 44,  y: 36, r: 24 },
    ];
    const opt = { passive: false };
    canvas.addEventListener('touchstart',  e => this._start(e), opt);
    canvas.addEventListener('touchmove',   e => this._move(e),  opt);
    canvas.addEventListener('touchend',    e => this._end(e),   opt);
    canvas.addEventListener('touchcancel', e => this._end(e),   opt);
    addEventListener('keydown', () => { this.active = false; });   // keyboard reclaims
  },

  // Android-only tactile tick (iOS Safari has no vibration API). Guarded so
  // desktop / unsupported browsers no-op.
  buzz(ms) {
    if (this.active && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  },

  _pt(t) {   // client -> LOGICAL canvas coords (independent of the backing-store
    // resolution, which adaptive quality may shrink). Degenerate rect
    // (hidden/headless tab) would divide to NaN — fall back to client coords.
    const r = this.canvas.getBoundingClientRect();
    const sx = r.width  ? CFG.VIEW_W / r.width  : 1;
    const sy = r.height ? CFG.VIEW_H / r.height : 1;
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

  // Radial stick update: direction comes from the true vector (per-axis
  // clamping skewed diagonals), and past the rim the base CHASES the thumb so
  // a reversal registers instantly instead of after a long drag back.
  _stick(s, x, y) {
    let dx = (x - s.ox) / this.STICK_R, dy = (y - s.oy) / this.STICK_R;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len; dy /= len;
      s.ox = x - dx * this.STICK_R;
      s.oy = y - dy * this.STICK_R;
    }
    s.dx = dx; s.dy = dy;
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
      // Buttons win, but only inside their true circle (the old +16px slop ate
      // aim touches), and contextual buttons only while visible.
      const b = this.buttons.find(b => b.id == null && (!b.visible || b.visible())
                                       && dist(x, y, b.x, b.y) < b.r + 4);
      if (b) { b.id = t.identifier; this._press(b.key); continue; }
      // outside PLAY a tap acts as a mouse click (start screen, pause, game over)
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
        this.aim.t0 = performance.now(); this.aim.maxLen = 0;
      }
    }
  },

  _move(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const [x, y] = this._pt(t);
      for (const s of [this.move, this.aim]) {
        if (s.id === t.identifier) this._stick(s, x, y);
      }
      if (this.aim.id === t.identifier) {
        this.aim.maxLen = Math.max(this.aim.maxLen, Math.hypot(this.aim.dx, this.aim.dy));
      }
    }
  },

  _end(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this._menuTaps[t.identifier]) { Input.mouse.down = false; delete this._menuTaps[t.identifier]; }
      if (this.move.id === t.identifier) { this.move.id = null; this.move.dx = this.move.dy = 0; }
      if (this.aim.id === t.identifier) {
        // Quick tap that never really deflected = a fire burst at the assisted
        // target (the instinct every mobile player brings to the right side).
        if (Game.state === STATE.PLAY && performance.now() - this.aim.t0 < 250
            && this.aim.maxLen < 0.3) this._tapFire = 0.14;
        this.aim.id = null; this.aim.dx = this.aim.dy = 0;
        Input.mouse.down = false; this._firing = false;
      }
      for (const b of this.buttons) if (b.id === t.identifier) { b.id = null; this._release(b.key); }
    }
  },

  // Pick the enemy assisted fire should lock onto.
  //   aimAngle == null → nearest hostile in auto range (never an innocent
  //   lawman — auto-aim must not start a wanted spiral the player didn't ask
  //   for). With a stick direction → closest angular match inside the cone,
  //   lawmen included: pointing at the law IS asking for it.
  _pickTarget(aimAngle) {
    const P = Game.player;
    let best = null, bestScore = Infinity;
    for (const en of Game.enemies) {
      if (en.dead) continue;
      const d = dist(P.x, P.y, en.x, en.y);
      if (aimAngle == null) {
        if (d > CFG.TOUCH_AUTO_RANGE) continue;
        if ((en.kind === 'lawman' || en.kind === 'enforcer') && Wanted.level === 0) continue;
        if (d < bestScore) { bestScore = d; best = en; }
      } else {
        if (d > CFG.TOUCH_ASSIST_RANGE) continue;
        const a = angTo(P.x, P.y, en.x, en.y) - aimAngle;
        const diff = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
        if (diff > CFG.TOUCH_ASSIST_CONE) continue;
        const score = diff * 400 + d * 0.25;   // angle rules, distance breaks ties
        if (score < bestScore) { bestScore = score; best = en; }
      }
    }
    return best;
  },

  // Once per frame from the main loop: continuous stick -> Input mapping.
  frame(dt) {
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

    // aim stick -> mouse point + trigger
    this.assistTarget = null;
    if (Game.state !== STATE.PLAY || !Game.player) return;
    if (this._tapFire > 0) this._tapFire -= (dt || 1/60);
    const a = this.aim;
    const len = a.id != null ? Math.hypot(a.dx, a.dy) : 0;
    const P = Game.player;
    const [px, py] = W2S(P.x, P.y);
    const stickPoint = () => {
      Input.mouse.x = px + (a.dx / (len || 1)) * 160;
      Input.mouse.y = py + (a.dy / (len || 1)) * 160;
    };

    if (this.aimMode === 'assist') {
      // Direction intent past a light threshold; below it the thumb is resting.
      let aimAngle = null;
      if (len > 0.25) {
        const mx = px + (a.dx / len) * 160, my = py + (a.dy / len) * 160;
        const [wx, wy] = S2W(mx, my);
        aimAngle = angTo(P.x, P.y, wx, wy);
      }
      const thumbDown = a.id != null;
      const target = (thumbDown || this._tapFire > 0) ? this._pickTarget(aimAngle) : null;
      if (target) {
        this.assistTarget = target;
        const [tx2, ty2] = W2S(target.x, target.y);
        Input.mouse.x = tx2; Input.mouse.y = ty2;
        Input.mouse.down = true;
      } else if (aimAngle != null) {
        stickPoint();                    // deliberate direction, empty desert — fire anyway
        Input.mouse.down = true;
      } else if (this._tapFire > 0) {
        Input.mouse.down = true;         // tap burst rides the last aim point
      } else {
        if (thumbDown && len > 0.12) stickPoint();   // soft aim, no target: hold fire
        Input.mouse.down = false;
      }
    } else {
      // MANUAL: classic deflection-fires twin-stick, with hysteresis so drift
      // across the threshold doesn't stutter the trigger (start .35, stop .15).
      if (a.id != null && len > 0.12) stickPoint();
      if (!this._firing && len > 0.35) this._firing = true;
      if (this._firing && len < 0.15) this._firing = false;
      Input.mouse.down = this._firing || this._tapFire > 0;
    }
  },
};

// Drawn at the end of the HUD pass (render.js) — sticks fade in under the
// thumbs, buttons sit at the edges, [E] appears only when something's usable,
// and assisted fire brackets its locked target.
function drawTouchControls() {
  if (!TouchUI.active || Game.state === STATE.START) return;
  if (Game.state !== STATE.PLAY && Game.state !== STATE.PAUSE) return;
  ctx.save();
  // assisted-fire lock — golden corner brackets, pulsing gently
  const t = TouchUI.assistTarget;
  if (t && !t.dead && Game.state === STATE.PLAY) {
    const [tx, ty] = W2S(t.x, t.y);
    const r = t.r + 10 + Math.sin(Game.time * 8) * 2;
    ctx.strokeStyle = 'rgba(255,222,122,0.95)'; ctx.lineWidth = 2.5;
    for (const [cx2, cy2] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      ctx.beginPath();
      ctx.moveTo(tx + cx2*r, ty + cy2*r - cy2*8);
      ctx.lineTo(tx + cx2*r, ty + cy2*r);
      ctx.lineTo(tx + cx2*r - cx2*8, ty + cy2*r);
      ctx.stroke();
    }
  }
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
    if (b.visible && !b.visible()) continue;
    const interactGlow = b.key === 'e';   // the contextual button always glows when shown
    ctx.globalAlpha = b.id != null ? 0.75 : interactGlow ? 0.85 : 0.3;
    ctx.fillStyle = 'rgba(30,20,10,0.85)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = interactGlow ? '#ffde7a' : '#e8d5a8';
    ctx.lineWidth = interactGlow ? 3 : 2;
    ctx.stroke();
    ctx.fillStyle = interactGlow ? '#ffde7a' : '#e8d5a8';
    ctx.font = 'bold ' + (b.r >= 34 ? 16 : 14) + 'px Georgia';
    ctx.fillText(b.label, b.x, b.y + 1);
  }
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}
