"use strict";
/* Redemption's Edge — utils.js
   Part of the modular build. Loaded as a classic <script> in index.html (order matters).
   See docs/ROADMAP.md for the project map. */

/* ---------------------------------------------------------------------------
   2. UTILITY / MATH HELPERS
   --------------------------------------------------------------------------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const dist2 = (ax, ay, bx, by) => { const dx = ax-bx, dy = ay-by; return dx*dx + dy*dy; };
const dist  = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const TAU = Math.PI * 2;

/* ---------------------------------------------------------------------------
   ISO PROJECTION (Depth Pass Tier 2). Gameplay lives in flat world coords;
   only the render layer (and mouse/input mapping) goes through these.
   Classic 2:1 diamond: screenX=(x-y)*XS, screenY=(x+y)*XS/2.
   All helpers collapse to identity when CFG.ISO is off.
   --------------------------------------------------------------------------- */
// world point -> screen point (camera + view centre + shake included)
function W2S(x, y) {
  if (!CFG.ISO) return [x - Camera.ox, y - Camera.oy];
  const cx = Camera.ox + CFG.VIEW_W/2, cy = Camera.oy + CFG.VIEW_H/2;
  return [(x - y - (cx - cy)) * CFG.ISO_XS + CFG.VIEW_W/2,
          (x + y - (cx + cy)) * CFG.ISO_XS * 0.5 + CFG.VIEW_H/2];
}
// screen point -> world point (inverse of W2S)
function S2W(sx, sy) {
  if (!CFG.ISO) return [sx + Camera.ox, sy + Camera.oy];
  const cx = Camera.ox + CFG.VIEW_W/2, cy = Camera.oy + CFG.VIEW_H/2;
  const a = (sx - CFG.VIEW_W/2) / CFG.ISO_XS + (cx - cy);          // x - y
  const b = (sy - CFG.VIEW_H/2) / (CFG.ISO_XS * 0.5) + (cx + cy);  // x + y
  return [(a + b) / 2, (b - a) / 2];
}
// screen-space direction vector -> world-space direction (normalized-ish)
function isoWorldVec(sx, sy) {
  if (!CFG.ISO) return [sx, sy];
  const x = sx / CFG.ISO_XS + sy / (CFG.ISO_XS * 0.5);   // 2*(x)
  const y = sy / (CFG.ISO_XS * 0.5) - sx / CFG.ISO_XS;   // 2*(y)
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}
// world-space direction -> screen-space direction (normalized-ish)
function isoScreenVec(wx, wy) {
  if (!CFG.ISO) return [wx, wy];
  const sx = (wx - wy) * CFG.ISO_XS, sy = (wx + wy) * CFG.ISO_XS * 0.5;
  const l = Math.hypot(sx, sy) || 1;
  return [sx / l, sy / l];
}
// world angle -> the angle it appears at on screen
function isoScreenAngle(a) {
  if (!CFG.ISO) return a;
  const c = Math.cos(a), s = Math.sin(a);
  return Math.atan2((c + s) * 0.5, c - s);
}

// Axis-aligned circle-vs-rect overlap test, returns penetration resolution.
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  // Centre fully inside the rect: the clamp trick degenerates to a zero push
  // vector, so eject through the nearest face instead (a fast dash on a slow
  // frame can step the centre straight past a wall in one tick).
  if (cx > rx && cx < rx + rw && cy > ry && cy < ry + rh) {
    const dl = cx - rx, dr = rx + rw - cx, dt = cy - ry, db = ry + rh - cy;
    const m = Math.min(dl, dr, dt, db);
    if (m === dl) return { hit: true, nx: -1, ny: 0, pen: dl + r };
    if (m === dr) return { hit: true, nx: 1, ny: 0, pen: dr + r };
    if (m === dt) return { hit: true, nx: 0, ny: -1, pen: dt + r };
    return { hit: true, nx: 0, ny: 1, pen: db + r };
  }
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  const d2 = dx*dx + dy*dy;
  if (d2 < r*r) {
    const d = Math.sqrt(d2) || 0.0001;
    return { hit: true, nx: dx / d, ny: dy / d, pen: r - d };
  }
  return { hit: false };
}

// Does the segment (x1,y1)-(x2,y2) pass within r of (cx,cy)? Swept version of
// a point-vs-circle test — fast bullets cover 30-50px per frame on slow
// machines and tunnel straight through point checks.
function segCircleHit(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx*dx + dy*dy;
  let t = len2 ? ((cx - x1)*dx + (cy - y1)*dy) / len2 : 0;
  t = clamp(t, 0, 1);
  const px = x1 + dx*t, py = y1 + dy*t;
  return dist2(px, py, cx, cy) <= r*r;
}
