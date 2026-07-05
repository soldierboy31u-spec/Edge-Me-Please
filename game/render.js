"use strict";
/* Redemption's Edge — render.js
   Part of the modular build. Loaded as a classic <script> in index.html (order matters).
   See docs/ROADMAP.md for the project map. */

/* ---------------------------------------------------------------------------
   11. RENDERING
   --------------------------------------------------------------------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function render() {
  const ox = Camera.ox, oy = Camera.oy;

  if (CFG.ISO) {
    // --- M8 Tier 2: true isometric. Ground plane squashes through the iso
    // transform; everything upright draws as a billboard at its projected
    // point, y-sorted by projected screen y. Gameplay coords untouched.
    computeIsoView();
    drawGroundIso();
    ctx.save();
    isoTransform();
    drawLandmarkGround(0, 0, true);   // world-coord draw under the transform; chests billboard below
    drawManhunt(0, 0);
    for (const f of FENCES) drawFence(f, 0, 0);
    ctx.restore();

    const D = [];
    // billboard trick: fn(ctx, obj.x - sx, obj.y - sy) makes the object's own
    // `x - ox` land exactly on its projected screen point.
    const at = (x, y) => W2S(x, y);
    for (const s of SCENERY) {
      if (!onScreen(s.x, s.y, 80)) continue;
      const p = at(s.x, s.y); D.push([p[1], () => drawScenery(s, s.x-p[0], s.y-p[1])]);
    }
    for (const b of STRUCTURES) {
      const p = at(b.x + b.w, b.y + b.h);   // south corner = nearest point
      D.push([p[1], () => drawBuildingIso(b)]);
    }
    for (const lm of LANDMARKS) {
      if (!onScreen(lm.x, lm.y, 260)) continue;
      const p = at(lm.x, lm.y); D.push([p[1], () => drawLandmarkStructure(lm, lm.x-p[0], lm.y-p[1])]);
    }
    for (const p0 of PROPS) {
      if (!onScreen(p0.x, p0.y, 60)) continue;
      const p = at(p0.x, p0.y); D.push([p[1] + p0.r*0.3, () => drawProp(p0, p0.x-p[0], p0.y-p[1])]);
    }
    for (const sc of SECRETS) {
      if (!onScreen(sc.x, sc.y, 50)) continue;
      const p = at(sc.x, sc.y); D.push([p[1], () => drawChest(p[0], p[1], sc.found)]);
    }
    { const b=WANTED_BOARD; const p = at(b.x, b.y); D.push([p[1]+16, () => drawWantedBoard(b.x-p[0], b.y-p[1])]); }
    { const p = at(DARRYL.x, DARRYL.y); D.push([p[1]+11, () => drawDarryl(DARRYL.x-p[0], DARRYL.y-p[1])]); }
    { const p = at(CAMPFIRE.x, CAMPFIRE.y); D.push([p[1], () => drawCampfire(CAMPFIRE.x-p[0], CAMPFIRE.y-p[1])]); }
    for (const pk of Game.pickups) { const p = at(pk.x, pk.y); D.push([p[1]+6, () => pk.render(ctx, pk.x-p[0], pk.y-p[1])]); }
    for (const h of Game.horses) if (!h.ridden) { const p = at(h.x, h.y); D.push([p[1]+12, () => h.render(ctx, h.x-p[0], h.y-p[1])]); }
    for (const t of Game.townsfolk) { const p = at(t.x, t.y); D.push([p[1]+10, () => t.render(ctx, t.x-p[0], t.y-p[1])]); }
    for (const e of Game.enemies) { const p = at(e.x, e.y); D.push([p[1]+10, () => e.render(ctx, e.x-p[0], e.y-p[1])]); }
    if (!Game.player.dead || Game.state!==STATE.GAMEOVER) {
      const pl = Game.player, p = at(pl.x, pl.y);
      D.push([p[1] + CFG.SPRITE_FOOT_OFFSET, () => pl.render(ctx, pl.x-p[0], pl.y-p[1])]);
    }
    D.sort((a, b) => a[0] - b[0]);
    for (const d of D) d[1]();

    // airborne / effects above the sorted world, each at its projected point
    for (const dy2 of Game.dynamites) { const p = at(dy2.x, dy2.y); dy2.render(ctx, dy2.x-p[0], dy2.y-p[1]); }
    for (const b of Game.bullets)     { const p = at(b.x, b.y);     b.render(ctx, b.x-p[0], b.y-p[1]); }
    for (const pt of Game.particles)  { const p = at(pt.x, pt.y);   pt.render(ctx, pt.x-p[0], pt.y-p[1]); }
    for (const ex of Game.explosions) { const p = at(ex.x, ex.y);   ex.render(ctx, ex.x-p[0], ex.y-p[1]); }
    for (const f of Game.floats)      { const p = at(f.x, f.y);     f.render(ctx, f.x-p[0], f.y-p[1]); }

    drawMissionMarker(ox, oy);
    drawReticle();
    drawLightingTint();
    drawDeadEye();
    drawHUD();
    drawMinimap();
    drawTitleCard();
    if (Game.state===STATE.START) drawStartScreen();
    if (Game.state===STATE.PAUSE) drawPauseScreen();
    if (Game.state===STATE.GAMEOVER) drawGameOver();
    drawFilmFX();
    return;
  }

  // --- Ground ---
  drawGround(ox, oy);

  // Landmark ground decals (riverbed, ghost trail, shrine pad) + cache mounds
  drawLandmarkGround(ox, oy);

  // Campfire glow sits under everything at ground level
  drawCampfire(ox, oy);
  // Manhunt: search-zone ring + lawman vision cones (ground level, under NPCs)
  drawManhunt(ox, oy);

  if (CFG.DEPTH_SORT) {
    // --- M7 Depth Pass: one y-sorted draw list — anything with a more
    // southern baseline draws in front. Purely visual; collision untouched.
    const D = [];
    for (const s of SCENERY) {
      if (s.x < ox-60 || s.x > ox+CFG.VIEW_W+60 || s.y < oy-60 || s.y > oy+CFG.VIEW_H+60) continue;
      D.push([s.y + s.r*0.5, () => drawScenery(s, ox, oy)]);
    }
    for (const f of FENCES) {
      if (f.x < ox-40 || f.x > ox+CFG.VIEW_W+40 || f.y+f.h < oy-40 || f.y > oy+CFG.VIEW_H+40) continue;
      for (let yy=0; yy<f.h; yy+=28) {
        const railY = yy;
        D.push([f.y + yy + 16, () => drawFenceRail(f, railY, ox, oy)]);
      }
    }
    for (const b of STRUCTURES) D.push([b.y + b.h, () => drawBuilding(b, ox, oy)]);
    for (const lm of LANDMARKS) {
      if (!onScreen(lm.x, lm.y, 200)) continue;
      D.push([lm.y, () => drawLandmarkStructure(lm, ox, oy)]);
    }
    for (const p of PROPS) {
      if (!onScreen(p.x, p.y, 46)) continue;
      D.push([p.y + p.r*0.5, () => drawProp(p, ox, oy)]);
    }
    D.push([WANTED_BOARD.y + 16, () => drawWantedBoard(ox, oy)]);
    D.push([DARRYL.y + 11, () => drawDarryl(ox, oy)]);
    for (const pk of Game.pickups) D.push([pk.y + 6, () => pk.render(ctx, ox, oy)]);
    for (const h of Game.horses) if (!h.ridden) D.push([h.y + 12, () => h.render(ctx, ox, oy)]);
    for (const t of Game.townsfolk) D.push([t.y + 10, () => t.render(ctx, ox, oy)]);
    for (const e of Game.enemies) D.push([e.y + 10, () => e.render(ctx, ox, oy)]);
    if (!Game.player.dead || Game.state!==STATE.GAMEOVER)
      D.push([Game.player.y + CFG.SPRITE_FOOT_OFFSET, () => Game.player.render(ctx, ox, oy)]);
    D.sort((a, b) => a[0] - b[0]);
    for (const d of D) d[1]();
  } else {
    // --- Legacy fixed-layer order (pre-M7) ---
    for (const s of SCENERY) {
      if (s.x < ox-60 || s.x > ox+CFG.VIEW_W+60 || s.y < oy-60 || s.y > oy+CFG.VIEW_H+60) continue;
      drawScenery(s, ox, oy);
    }
    for (const f of FENCES) drawFence(f, ox, oy);
    for (const b of STRUCTURES) drawBuilding(b, ox, oy);
    drawLandmarkStructures(ox, oy);
    drawProps(ox, oy);
    drawWantedBoard(ox, oy);
    drawDarryl(ox, oy);
    for (const pk of Game.pickups) pk.render(ctx, ox, oy);
    for (const h of Game.horses) if (!h.ridden) h.render(ctx, ox, oy);
    for (const t of Game.townsfolk) t.render(ctx, ox, oy);
    for (const e of Game.enemies) e.render(ctx, ox, oy);
    if (!Game.player.dead || Game.state!==STATE.GAMEOVER) Game.player.render(ctx, ox, oy);
  }

  // Live dynamite sticks (under bullets/particles)
  for (const dy of Game.dynamites) dy.render(ctx, ox, oy);

  // Bullets + particles on top
  for (const b of Game.bullets) b.render(ctx, ox, oy);
  for (const pt of Game.particles) pt.render(ctx, ox, oy);
  // Explosion flashes above the smoke
  for (const ex of Game.explosions) ex.render(ctx, ox, oy);
  for (const f of Game.floats) f.render(ctx, ox, oy);

  // Mission objective chevron (world-space, above the scene)
  drawMissionMarker(ox, oy);

  // Aim reticle
  drawReticle();

  // Atmospheric lighting tint (Tier 3 subtle day shift)
  drawLightingTint();

  // Dead Eye overlay (slowed-time tint + target rings)
  drawDeadEye();

  // HUD
  drawHUD();
  drawMinimap();

  // Mission title card (over HUD, under full-screen menus)
  drawTitleCard();

  if (Game.state===STATE.START) drawStartScreen();
  if (Game.state===STATE.PAUSE) drawPauseScreen();
  if (Game.state===STATE.GAMEOVER) drawGameOver();

  // M6: the whole frame — menus included — goes through the "old film" pass.
  drawFilmFX();
}

/* ----- M6 Art Pass: film grain / vignette / sepia (cached offscreen) ----- */
let _vignetteCv = null;
let _grainCvs = null;
function _initFilmFX() {
  // Vignette: radial falloff baked once at view size.
  _vignetteCv = document.createElement('canvas');
  _vignetteCv.width = CFG.VIEW_W; _vignetteCv.height = CFG.VIEW_H;
  const vc = _vignetteCv.getContext('2d');
  const g = vc.createRadialGradient(CFG.VIEW_W/2, CFG.VIEW_H/2, CFG.VIEW_H*0.42,
                                    CFG.VIEW_W/2, CFG.VIEW_H/2, CFG.VIEW_W*0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,6,2,1)');
  vc.fillStyle = g; vc.fillRect(0,0,CFG.VIEW_W,CFG.VIEW_H);
  // Grain: a few noise tiles cycled per frame so the grain "crawls" like film.
  _grainCvs = [];
  for (let n=0;n<3;n++) {
    const cv = document.createElement('canvas');
    cv.width = 192; cv.height = 192;
    const c = cv.getContext('2d');
    const img = c.createImageData(192,192);
    for (let i=0;i<img.data.length;i+=4) {
      const v = 128 + (Math.random()*2-1)*110;
      img.data[i]=v; img.data[i+1]=v; img.data[i+2]=v;
      img.data[i+3] = Math.random()<0.5 ? 255 : 0;   // sparse, punchy grain
    }
    c.putImageData(img,0,0);
    _grainCvs.push(cv);
  }
}
function drawFilmFX() {
  if (!CFG.FX_GRAIN && !CFG.FX_VIGNETTE && !CFG.FX_SEPIA) return;
  if (!_vignetteCv) _initFilmFX();
  ctx.save();
  // Warm sepia wash
  if (CFG.FX_SEPIA > 0) {
    ctx.globalCompositeOperation='multiply';
    ctx.globalAlpha = CFG.FX_SEPIA;
    ctx.fillStyle = '#e0b070';
    ctx.fillRect(0,0,CFG.VIEW_W,CFG.VIEW_H);
    ctx.globalCompositeOperation='source-over';
  }
  // Vignette
  if (CFG.FX_VIGNETTE > 0) {
    ctx.globalAlpha = CFG.FX_VIGNETTE;
    ctx.drawImage(_vignetteCv, 0, 0);
  }
  // Crawling grain — cycle tiles + jitter the offset each frame
  if (CFG.FX_GRAIN > 0) {
    ctx.globalAlpha = CFG.FX_GRAIN;
    ctx.globalCompositeOperation='overlay';
    const cv = _grainCvs[Math.floor(Game.time*24)%3];
    const jx = ((Game.time*97)%1)*192, jy = ((Game.time*61)%1)*192;
    for (let x=-jx; x<CFG.VIEW_W; x+=192)
      for (let y=-jy; y<CFG.VIEW_H; y+=192)
        ctx.drawImage(cv, x, y);
  }
  ctx.restore();
}

/* M6: western HUD panel — leather backdrop, double border, brass corner rivets. */
function drawPanel(x, y, w, h) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y+h);
  g.addColorStop(0,'rgba(34,22,10,0.82)'); g.addColorStop(1,'rgba(20,12,5,0.82)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle='rgba(70,48,22,0.95)'; ctx.lineWidth=3; ctx.strokeRect(x+1.5, y+1.5, w-3, h-3);
  ctx.strokeStyle='rgba(190,150,84,0.65)'; ctx.lineWidth=1; ctx.strokeRect(x+4.5, y+4.5, w-9, h-9);
  ctx.fillStyle='#caa14a';
  for (const [rx,ry] of [[x+7,y+7],[x+w-7,y+7],[x+7,y+h-7],[x+w-7,y+h-7]]) {
    ctx.beginPath(); ctx.arc(rx,ry,2.2,0,TAU); ctx.fill();
    ctx.fillStyle='#8a6a2a'; ctx.beginPath(); ctx.arc(rx+0.7,ry+0.7,1,0,TAU); ctx.fill();
    ctx.fillStyle='#caa14a';
  }
  ctx.restore();
}

/* ----- M8 Depth Pass Tier 2: iso projection plumbing ----- */
// Visible world AABB under the iso camera (unprojected screen corners).
let ISO_VIEW = null;
function computeIsoView() {
  const cs = [S2W(0,0), S2W(CFG.VIEW_W,0), S2W(0,CFG.VIEW_H), S2W(CFG.VIEW_W,CFG.VIEW_H)];
  ISO_VIEW = {
    minX: Math.min(cs[0][0],cs[1][0],cs[2][0],cs[3][0]),
    maxX: Math.max(cs[0][0],cs[1][0],cs[2][0],cs[3][0]),
    minY: Math.min(cs[0][1],cs[1][1],cs[2][1],cs[3][1]),
    maxY: Math.max(cs[0][1],cs[1][1],cs[2][1],cs[3][1]),
  };
}
// Set the canvas transform so drawing in WORLD coords lands iso-projected.
function isoTransform() {
  const XS = CFG.ISO_XS, o = W2S(0, 0);
  ctx.setTransform(XS, XS*0.5, -XS, XS*0.5, o[0], o[1]);
}

// Iso ground: base wash in screen space, then patches/streets/border in
// world coords under the iso transform (they squash into the diamond plane).
function drawGroundIso() {
  const g = ctx.createLinearGradient(0,0,0,CFG.VIEW_H);
  g.addColorStop(0,'#5a4a30'); g.addColorStop(1,'#4a3c26');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,CFG.VIEW_W,CFG.VIEW_H);
  ctx.save();
  isoTransform();
  const T = CFG.TILE*2, v = ISO_VIEW;
  const x0 = Math.floor(v.minX/T)*T, y0 = Math.floor(v.minY/T)*T;
  for (let x=x0; x<v.maxX+T; x+=T) {
    for (let y=y0; y<v.maxY+T; y+=T) {
      const h = (Math.sin(x*0.013)+Math.cos(y*0.017))*0.5;
      ctx.fillStyle = h>0 ? 'rgba(120,100,60,0.10)' : 'rgba(60,48,28,0.12)';
      ctx.fillRect(x, y, T, T);
    }
  }
  // Main street
  ctx.fillStyle='rgba(150,124,80,0.35)';
  ctx.fillRect(TOWN_CX-70, 0, 140, CFG.WORLD_H);
  ctx.fillRect(0, TOWN_CY-60, CFG.WORLD_W, 120);
  // No hard border wall: the desert stretches past the playfield and
  // gradually dissolves into darkness (the invisible clamp still stops you).
  const F = 900, W = CFG.WORLD_W, H = CFG.WORLD_H;
  const edges = [
    [0, 0, -F, 0,  -F, -F, F, H + 2*F],   // west band
    [W, 0, W+F, 0,  W, -F, F, H + 2*F],   // east band
    [0, 0, 0, -F,  -F, -F, W + 2*F, F],   // north band
    [0, H, 0, H+F, -F, H,  W + 2*F, F],   // south band
  ];
  for (const [gx0,gy0,gx1,gy1, rx,ry,rw,rh] of edges) {
    const eg = ctx.createLinearGradient(gx0,gy0,gx1,gy1);
    eg.addColorStop(0, 'rgba(20,14,6,0)');
    eg.addColorStop(1, 'rgba(20,14,6,0.96)');
    ctx.fillStyle = eg;
    ctx.fillRect(rx, ry, rw, rh);
  }
  // solid dark beyond the fade so nothing pops at extreme camera positions
  ctx.fillStyle = 'rgba(20,14,6,0.96)';
  if (v.minX < -F) ctx.fillRect(v.minX, v.minY, -F - v.minX, v.maxY - v.minY);
  if (v.maxX > W+F) ctx.fillRect(W+F, v.minY, v.maxX - (W+F), v.maxY - v.minY);
  if (v.minY < -F) ctx.fillRect(v.minX, v.minY, v.maxX - v.minX, -F - v.minY);
  if (v.maxY > H+F) ctx.fillRect(v.minX, H+F, v.maxX - v.minX, v.maxY - (H+F));
  ctx.restore();
}

// Placeholder iso building: footprint diamond + two upright faces + flat
// roof, drawn from the collision rect. Swapped for generated art per
// docs/ISO_BUILDING_SPEC.md as the PNGs land.
function drawBuildingIso(b) {
  if (drawIsoBuildingArt(b)) return;   // generated art when available
  const H = CFG.ISO_WALL_H;
  const A=W2S(b.x,b.y), B=W2S(b.x+b.w,b.y), C=W2S(b.x+b.w,b.y+b.h), D=W2S(b.x,b.y+b.h);
  const up = p => [p[0], p[1]-H];
  const uA=up(A), uB=up(B), uC=up(C), uD=up(D);
  const poly = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]); ctx.closePath(); };
  ctx.save();
  // drop shadow on the ground, cast north-east (light from SW)
  poly([A,B,C,D].map(p=>[p[0]+10,p[1]-4])); ctx.fillStyle='rgba(0,0,0,0.28)'; ctx.fill();
  // south-west face (lit)
  poly([D,C,uC,uD]); ctx.fillStyle=b.color; ctx.fill();
  poly([D,C,uC,uD]); ctx.fillStyle='rgba(255,225,170,0.14)'; ctx.fill();
  // south-east face (shaded)
  poly([C,B,uB,uC]); ctx.fillStyle=b.color; ctx.fill();
  poly([C,B,uB,uC]); ctx.fillStyle='rgba(0,0,0,0.38)'; ctx.fill();
  // vertical siding seams on the lit face
  ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=1;
  for (let t=0.12; t<1; t+=0.12) {
    const bx0=lerp(D[0],C[0],t), by0=lerp(D[1],C[1],t);
    ctx.beginPath(); ctx.moveTo(bx0,by0); ctx.lineTo(bx0,by0-H); ctx.stroke();
  }
  // roof
  poly([uA,uB,uC,uD]); ctx.fillStyle=b.color; ctx.fill();
  poly([uA,uB,uC,uD]); ctx.fillStyle='rgba(255,244,214,0.07)'; ctx.fill();
  ctx.strokeStyle='rgba(20,12,4,0.5)'; ctx.lineWidth=2; poly([uA,uB,uC,uD]); ctx.stroke();
  // roof planks parallel to the north edge
  ctx.strokeStyle='rgba(0,0,0,0.16)'; ctx.lineWidth=1;
  for (let t=0.15; t<1; t+=0.15) {
    ctx.beginPath();
    ctx.moveTo(lerp(uA[0],uD[0],t), lerp(uA[1],uD[1],t));
    ctx.lineTo(lerp(uB[0],uC[0],t), lerp(uB[1],uC[1],t));
    ctx.stroke();
  }
  // door
  const t = clamp((b.door.x - b.x) / b.w, 0.08, 0.92);
  if (b.door.y > b.y + b.h/2) {
    const px=lerp(D[0],C[0],t), py=lerp(D[1],C[1],t);
    ctx.fillStyle='#1e140a'; ctx.fillRect(px-10, py-28, 20, 28);
    ctx.fillStyle='#2e2012'; ctx.fillRect(px-12, py-31, 24, 4);
  } else {
    const px=lerp(uA[0],uB[0],t), py=lerp(uA[1],uB[1],t);
    ctx.fillStyle='#1e140a'; ctx.fillRect(px-9, py-2, 18, 10);
  }
  // sign on the roof
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.font='bold 14px Georgia'; ctx.textAlign='center';
  const mx=(uA[0]+uC[0])/2, my=(uA[1]+uC[1])/2;
  const lw = ctx.measureText(b.name).width + 14;
  ctx.fillRect(mx-lw/2, my-12, lw, 20);
  ctx.fillStyle='#e8d5a8'; ctx.fillText(b.name, mx, my+3);
  // flourishes
  if (b.cross) {
    const cx=(uA[0]+uB[0])/2, cy=(uA[1]+uB[1])/2;
    ctx.fillStyle='#2a2218';
    ctx.fillRect(cx-3, cy-30, 6, 30); ctx.fillRect(cx-10, cy-22, 20, 5);
  }
  if (b.tent) {
    ctx.fillStyle='#3a2c1a';
    ctx.beginPath(); ctx.moveTo(uA[0],uA[1]); ctx.lineTo(mx, my-30); ctx.lineTo(uC[0],uC[1]);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawGround(ox, oy) {
  // Base prairie wash
  const g = ctx.createLinearGradient(0,0,0,CFG.VIEW_H);
  g.addColorStop(0,'#5a4a30'); g.addColorStop(1,'#4a3c26');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,CFG.VIEW_W,CFG.VIEW_H);

  // Subtle tile texture using offset grid of dusty patches
  const T = CFG.TILE*2;
  const startX = Math.floor(ox/T)*T;
  const startY = Math.floor(oy/T)*T;
  ctx.save();
  for (let x=startX; x<ox+CFG.VIEW_W+T; x+=T) {
    for (let y=startY; y<oy+CFG.VIEW_H+T; y+=T) {
      const h = (Math.sin(x*0.013)+Math.cos(y*0.017))*0.5;
      ctx.fillStyle = h>0 ? 'rgba(120,100,60,0.10)' : 'rgba(60,48,28,0.12)';
      ctx.fillRect(x-ox, y-oy, T, T);
    }
  }
  ctx.restore();

  // Main street (lighter dirt road through town)
  ctx.fillStyle='rgba(150,124,80,0.35)';
  ctx.fillRect(TOWN_CX-70-ox, 0-oy, 140, CFG.WORLD_H);
  ctx.fillRect(0-ox, TOWN_CY-60-oy, CFG.WORLD_W, 120);

  // World border posts
  ctx.strokeStyle='rgba(30,22,12,0.8)'; ctx.lineWidth=8;
  ctx.strokeRect(-ox, -oy, CFG.WORLD_W, CFG.WORLD_H);
}

function drawScenery(s, ox, oy) {
  if (typeof drawIsoPropArt !== 'undefined' && drawIsoPropArt(s, ox, oy)) return;
  const tx=s.x-ox, ty=s.y-oy;
  ctx.save();
  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(tx, ty+s.r*0.5, s.r*0.9, s.r*0.4, 0, 0, TAU); ctx.fill();
  if (s.type==='rock') {
    ctx.fillStyle='#6b6256';
    ctx.beginPath();
    for (let i=0;i<6;i++){ const a=i/6*TAU + s.seed; const rr=s.r*(0.8+0.2*Math.sin(s.seed+i)); ctx.lineTo(tx+Math.cos(a)*rr, ty+Math.sin(a)*rr*0.8); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#565049'; ctx.beginPath(); ctx.ellipse(tx-s.r*0.2,ty-s.r*0.2,s.r*0.4,s.r*0.3,0,0,TAU); ctx.fill();
  } else if (s.type==='cactus') {
    ctx.fillStyle='#4a6a3a';
    ctx.fillRect(tx-s.r*0.3, ty-s.r, s.r*0.6, s.r*2);
    ctx.fillRect(tx-s.r*0.3, ty-s.r*0.4, -s.r*0.7, s.r*0.4);
    ctx.fillRect(tx+s.r*0.3, ty-s.r*0.2, s.r*0.7, s.r*0.4);
    ctx.fillStyle='#3a5a2c';
    ctx.fillRect(tx-s.r*0.9, ty-s.r*0.6, s.r*0.4, s.r*0.6);
    ctx.fillRect(tx+s.r*0.5, ty-s.r*0.4, s.r*0.4, s.r*0.6);
  } else if (s.type==='tree') {
    ctx.fillStyle='#3a2a18';
    ctx.fillRect(tx-3, ty-2, 6, s.r*0.7);
    ctx.fillStyle='#3c5230';
    ctx.beginPath(); ctx.arc(tx, ty-s.r*0.5, s.r, 0, TAU); ctx.fill();
    ctx.fillStyle='#46603a';
    ctx.beginPath(); ctx.arc(tx-s.r*0.3, ty-s.r*0.7, s.r*0.6, 0, TAU); ctx.fill();
  } else { // shrub
    ctx.fillStyle='#5a5230';
    ctx.beginPath(); ctx.arc(tx, ty, s.r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawFence(f, ox, oy) {           // legacy unsorted path (DEPTH_SORT off)
  for (let yy=0; yy<f.h; yy+=28) drawFenceRail(f, yy, ox, oy);
}
// One fence rail + its stretch of connecting post — sortable by its own y.
function drawFenceRail(f, yy, ox, oy) {
  const tx=f.x-ox, ty=f.y-oy;
  ctx.fillStyle='#3a2a18';
  ctx.fillRect(tx, ty+yy, f.w, 18);
  ctx.fillRect(tx+2, ty+yy, 3, Math.min(28, f.h-yy));
}

function drawBuilding(b, ox, oy) {
  const tx=b.x-ox, ty=b.y-oy;
  const wallH = CFG.DEPTH_WALL_H;                   // M7: 0 = flat pre-depth look
  const southDoor = b.door.y > b.y + b.h/2;
  ctx.save();
  // Drop shadow (covers roof + wall face)
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.fillRect(tx+8, ty+10, b.w, b.h+wallH);
  // Roof slab
  ctx.fillStyle=b.color;
  ctx.fillRect(tx, ty, b.w, b.h);
  // Plank texture
  ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1;
  for (let yy=8; yy<b.h; yy+=14) { ctx.beginPath(); ctx.moveTo(tx,ty+yy); ctx.lineTo(tx+b.w,ty+yy); ctx.stroke(); }
  // Roof band
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.fillRect(tx, ty, b.w, 16);
  const dx=b.door.x-ox, dy=b.door.y-oy;
  if (wallH > 0) {
    // M7 south wall face below the roof slab — vertical siding in shade
    const wy = ty + b.h;
    ctx.fillStyle = b.color;             ctx.fillRect(tx, wy, b.w, wallH);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';  ctx.fillRect(tx, wy, b.w, wallH);   // shaded face
    ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=1;
    for (let xx=12; xx<b.w; xx+=18) { ctx.beginPath(); ctx.moveTo(tx+xx,wy); ctx.lineTo(tx+xx,wy+wallH); ctx.stroke(); }
    // eave line where roof meets the face + ground contact shadow
    ctx.fillStyle='rgba(0,0,0,0.4)';  ctx.fillRect(tx, wy, b.w, 3);
    ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(tx, wy+wallH-2, b.w, 2);
    if (southDoor) {
      // door set into the wall face
      ctx.fillStyle='#1e140a'; ctx.fillRect(dx-13, wy+wallH-28, 26, 28);
      ctx.fillStyle='#2e2012'; ctx.fillRect(dx-15, wy+wallH-32, 30, 5);   // lintel
      // small windows flanking wider storefronts
      if (b.w >= 200) {
        ctx.fillStyle='rgba(255,220,140,0.18)';
        ctx.fillRect(tx+b.w*0.18-8, wy+8, 16, 12); ctx.fillRect(tx+b.w*0.82-8, wy+8, 16, 12);
        ctx.strokeStyle='#241808'; ctx.lineWidth=2;
        ctx.strokeRect(tx+b.w*0.18-8, wy+8, 16, 12); ctx.strokeRect(tx+b.w*0.82-8, wy+8, 16, 12);
      }
    } else {
      // north-door building: recessed entry notch on the roof's north edge
      ctx.fillStyle='#1e140a'; ctx.fillRect(dx-13, ty, 26, 13);
      ctx.fillStyle='#2e2012'; ctx.fillRect(dx-15, ty+13, 30, 4);        // doorstep
    }
  } else {
    // legacy flat door
    ctx.fillStyle='#1e140a'; ctx.fillRect(dx-13, dy-30, 26, 32);
    ctx.fillStyle='#2e2012'; ctx.fillRect(dx-15, dy-34, 30, 6);
  }
  // Sign
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.font='bold 15px Georgia'; ctx.textAlign='center';
  const lw = ctx.measureText(b.name).width + 16;
  ctx.fillRect(tx+b.w/2 - lw/2, ty+20, lw, 22);
  ctx.fillStyle='#e8d5a8';
  ctx.fillText(b.name, tx+b.w/2, ty+36);
  // Landmark flourishes
  if (b.cross) {           // chapel steeple cross
    ctx.fillStyle='#2a2218';
    ctx.fillRect(tx+b.w/2-3, ty-26, 6, 26);
    ctx.fillRect(tx+b.w/2-11, ty-18, 22, 6);
  }
  if (b.tent) {            // tent roof peak over Darryl's tent
    ctx.fillStyle='#3a2c1a';
    ctx.beginPath();
    ctx.moveTo(tx-10, ty); ctx.lineTo(tx+b.w/2, ty-34); ctx.lineTo(tx+b.w+10, ty);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Animated campfire at the heart of Darryl's camp.
function drawCampfire(ox, oy) {
  const tx=CAMPFIRE.x-ox, ty=CAMPFIRE.y-oy;
  if (tx<-80||tx>CFG.VIEW_W+80||ty<-80||ty>CFG.VIEW_H+80) return;
  CAMPFIRE.flick += 0.3;
  ctx.save();
  // warm ground glow
  const g=ctx.createRadialGradient(tx,ty,4,tx,ty,90);
  g.addColorStop(0,'rgba(255,170,70,0.35)'); g.addColorStop(1,'rgba(255,170,70,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(tx,ty,90,0,TAU); ctx.fill();
  // logs
  ctx.strokeStyle='#3a2614'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(tx-12,ty+5); ctx.lineTo(tx+12,ty+8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx-10,ty+9); ctx.lineTo(tx+11,ty+2); ctx.stroke();
  // flame
  const f = 1 + Math.sin(CAMPFIRE.flick)*0.18;
  ctx.fillStyle='#ff7a1c';
  ctx.beginPath(); ctx.moveTo(tx,ty-22*f); ctx.quadraticCurveTo(tx+10,ty-4,tx,ty+2); ctx.quadraticCurveTo(tx-10,ty-4,tx,ty-22*f); ctx.fill();
  ctx.fillStyle='#ffd24a';
  ctx.beginPath(); ctx.moveTo(tx,ty-13*f); ctx.quadraticCurveTo(tx+5,ty-3,tx,ty+1); ctx.quadraticCurveTo(tx-5,ty-3,tx,ty-13*f); ctx.fill();
  ctx.restore();
}

// Darryl — camp leader, stands by the fire. Purely decorative anchor NPC.
function drawDarryl(ox, oy) {
  const tx=DARRYL.x-ox, ty=DARRYL.y-oy;
  if (tx<-60||tx>CFG.VIEW_W+60||ty<-60||ty>CFG.VIEW_H+60) return;
  DARRYL.bob += 0.04;
  ctx.save();
  ctx.translate(tx, ty + Math.sin(DARRYL.bob)*1.2);
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0,11,12,5,0,0,TAU); ctx.fill();
  ctx.fillStyle='#6a5236';                 // heavyset coat
  ctx.beginPath(); ctx.ellipse(0,2,14,16,0,0,TAU); ctx.fill();
  ctx.fillStyle='#caa078';                 // head
  ctx.beginPath(); ctx.arc(0,-3,8,0,TAU); ctx.fill();
  ctx.fillStyle='#cfc6b4';                 // grey beard
  ctx.beginPath(); ctx.arc(0,1,6,0,Math.PI); ctx.fill();
  ctx.fillStyle='#2a1d10';                 // wide hat
  ctx.beginPath(); ctx.ellipse(0,-6,15,6,0,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,-9,8,6,0,0,TAU); ctx.fill();
  ctx.restore();
  // Name tag
  ctx.fillStyle='rgba(20,14,6,0.7)'; ctx.font='11px Georgia'; ctx.textAlign='center';
  const w=ctx.measureText('DARRYL').width+10;
  ctx.fillRect(tx-w/2, ty-34, w, 15);
  ctx.fillStyle='#d8c08a'; ctx.fillText('DARRYL', tx, ty-23);
}

/* ----- MILESTONE 2: overworld props & landmarks ----- */
function onScreen(x,y,m){
  if (CFG.ISO && ISO_VIEW) return !(x<ISO_VIEW.minX-m||x>ISO_VIEW.maxX+m||y<ISO_VIEW.minY-m||y>ISO_VIEW.maxY+m);
  const ox=Camera.x,oy=Camera.y; return !(x<ox-m||x>ox+CFG.VIEW_W+m||y<oy-m||y>oy+CFG.VIEW_H+m);
}

// Ground-level decals: dry riverbed, ghost-lantern trail, shrine pad, cache mounds.
// skipChests: the iso path billboards strongboxes instead (they're upright).
function drawLandmarkGround(ox, oy, skipChests) {
  for (const lm of LANDMARKS) {
    if (lm.type==='riverbed') {
      // winding pale channel
      ctx.save(); ctx.strokeStyle='rgba(170,150,100,0.30)'; ctx.lineWidth=70; ctx.lineCap='round';
      ctx.beginPath();
      for (let i=0;i<=8;i++){ const px=lm.x+Math.sin(i*0.9)*160, py=lm.y+i*150; i?ctx.lineTo(px-ox,py-oy):ctx.moveTo(px-ox,py-oy); }
      ctx.stroke();
      ctx.strokeStyle='rgba(120,100,64,0.25)'; ctx.lineWidth=40; ctx.stroke();
      ctx.restore();
    } else if (lm.type==='shrine') {
      if (!onScreen(lm.x,lm.y,160)) continue;
      ctx.save(); ctx.fillStyle='rgba(70,60,80,0.4)';
      ctx.beginPath(); ctx.ellipse(lm.x-ox,lm.y-oy,70,46,0,0,TAU); ctx.fill();
      ctx.restore();
    } else if (lm.type==='wagons') {
      if (!onScreen(lm.x,lm.y,220)) continue;
      ctx.save(); ctx.fillStyle='rgba(40,30,18,0.25)';
      ctx.beginPath(); ctx.arc(lm.x-ox,lm.y-oy,120,0,TAU); ctx.fill(); ctx.restore();
    } else if (lm.type==='hideout') {
      // scorched, trampled bowl inside the spire ring
      if (!onScreen(lm.x,lm.y,320)) continue;
      ctx.save(); ctx.fillStyle='rgba(50,36,24,0.30)';
      ctx.beginPath(); ctx.arc(lm.x-ox,lm.y-oy,230,0,TAU); ctx.fill();
      ctx.fillStyle='rgba(30,22,14,0.25)';
      ctx.beginPath(); ctx.ellipse(lm.x-ox+150,lm.y-oy,60,40,0,0,TAU); ctx.fill();  // throne shadow
      ctx.restore();
    } else if (lm.type==='ghosttrail') {
      // Only visible at night — alpha tracks the lighting cycle.
      const night = clamp(1-(Math.sin(Game.dayPhase*TAU)*0.5+0.5), 0, 1);
      if (night<0.15) continue;
      const endX=TOWN_CX+760, endY=TOWN_CY+1720;
      for (let i=0;i<=8;i++){
        const t=i/8, gx=lerp(lm.x,endX,t), gy=lerp(lm.y,endY,t);
        if (!onScreen(gx,gy,40)) continue;
        const fl=0.6+0.4*Math.sin(Game.time*3+i);
        ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=night*0.8*fl;
        const g=ctx.createRadialGradient(gx-ox,gy-oy,1,gx-ox,gy-oy,26);
        g.addColorStop(0,'#aef0ff'); g.addColorStop(1,'rgba(120,200,255,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(gx-ox,gy-oy,26,0,TAU); ctx.fill(); ctx.restore();
      }
    }
  }
  // Treasure strongboxes — closed if not yet looted, lid-open once taken.
  if (skipChests) return;
  for (const sc of SECRETS) {
    if (!onScreen(sc.x,sc.y,40)) continue;
    drawChest(sc.x-ox, sc.y-oy, sc.found);
  }
}

// A western iron-banded strongbox. `open` draws it looted (lid up, empty).
function drawChest(tx, ty, open) {
  ctx.save();
  // soft shadow
  ctx.fillStyle='rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(tx, ty+8, 18, 6, 0, 0, TAU); ctx.fill();
  const w=15, h=11;
  // body
  const g=ctx.createLinearGradient(tx-w, ty, tx+w, ty);
  g.addColorStop(0,'#6a4423'); g.addColorStop(0.5,'#86592e'); g.addColorStop(1,'#5a3a1e');
  ctx.fillStyle=g; ctx.fillRect(tx-w, ty-2, w*2, h);
  ctx.strokeStyle='#2e1d0e'; ctx.lineWidth=2; ctx.strokeRect(tx-w, ty-2, w*2, h);
  // iron bands
  ctx.fillStyle='#2a2620';
  ctx.fillRect(tx-w+3, ty-2, 4, h); ctx.fillRect(tx+w-7, ty-2, 4, h);
  if (!open) {
    // domed lid
    ctx.fillStyle='#7a5128';
    ctx.beginPath(); ctx.moveTo(tx-w,ty-2); ctx.quadraticCurveTo(tx,ty-15,tx+w,ty-2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#2e1d0e'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#2a2620'; ctx.fillRect(tx-w+3,ty-8,4,7); ctx.fillRect(tx+w-7,ty-8,4,7);
    // brass lock + keyhole
    ctx.fillStyle='#e8c45a'; ctx.fillRect(tx-3, ty-1, 6, 6);
    ctx.fillStyle='#3a2a10'; ctx.beginPath(); ctx.arc(tx,ty+1,1.3,0,TAU); ctx.fill();
    // inviting glint
    const tw=0.5+0.5*Math.sin(Game.time*4 + tx);
    ctx.globalAlpha=tw*0.8; ctx.fillStyle='#fff6d0';
    ctx.beginPath(); ctx.arc(tx-w+6, ty-9, 1.6, 0, TAU); ctx.fill();
    ctx.globalAlpha=1;
  } else {
    // opened — lid hinged back, dark empty interior
    ctx.fillStyle='#1c140a'; ctx.fillRect(tx-w+2, ty-1, w*2-4, h-3);
    ctx.fillStyle='#6a4423';
    ctx.beginPath(); ctx.moveTo(tx-w,ty-2); ctx.quadraticCurveTo(tx,ty-20,tx+w,ty-9); ctx.lineTo(tx+w,ty-6); ctx.quadraticCurveTo(tx,ty-16,tx-w,ty-2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#2e1d0e'; ctx.lineWidth=1.5; ctx.stroke();
  }
  ctx.restore();
}

// Big standing structures: bone arch span, mine entrance, shrine totem.
function drawLandmarkStructures(ox, oy) {  // legacy unsorted path (DEPTH_SORT off)
  for (const lm of LANDMARKS) {
    if (!onScreen(lm.x,lm.y,200)) continue;
    drawLandmarkStructure(lm, ox, oy);
  }
}
function drawLandmarkStructure(lm, ox, oy) {
  {
    const tx=lm.x-ox, ty=lm.y-oy;
    if (lm.type==='arch') {
      // span of bone between the two leg props
      ctx.save(); ctx.strokeStyle='#d8cdb0'; ctx.lineWidth=16; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(tx-70,ty-30); ctx.quadraticCurveTo(tx,ty-120,tx+70,ty-30); ctx.stroke();
      ctx.strokeStyle='#b8ad90'; ctx.lineWidth=6;
      ctx.beginPath(); ctx.moveTo(tx-70,ty-30); ctx.quadraticCurveTo(tx,ty-120,tx+70,ty-30); ctx.stroke();
      // skull keystone
      ctx.fillStyle='#e8dec0'; ctx.beginPath(); ctx.arc(tx,ty-104,12,0,TAU); ctx.fill();
      ctx.fillStyle='#3a3020'; ctx.beginPath(); ctx.arc(tx-4,ty-106,2.5,0,TAU); ctx.arc(tx+4,ty-106,2.5,0,TAU); ctx.fill();
      ctx.restore();
    } else if (lm.type==='hideout') {
      // Benny's bone throne — a longhorn-skull seat on a rib-cage dais.
      const bx=tx+150, by=ty;
      ctx.save();
      // rib arcs behind the seat
      ctx.strokeStyle='#cfc4a2'; ctx.lineWidth=5; ctx.lineCap='round';
      for (let i=-2;i<=2;i++) {
        ctx.beginPath(); ctx.moveTo(bx+18, by+i*16);
        ctx.quadraticCurveTo(bx+46, by+i*16 - 8, bx+58, by+i*16 + 4); ctx.stroke();
      }
      // seat block
      ctx.fillStyle='#5a4630'; ctx.fillRect(bx-18,by-20,36,44);
      ctx.strokeStyle='#2e2314'; ctx.lineWidth=2; ctx.strokeRect(bx-18,by-20,36,44);
      // longhorn skull crowning it
      ctx.fillStyle='#e8dec0'; ctx.beginPath(); ctx.arc(bx,by-32,13,0,TAU); ctx.fill();
      ctx.strokeStyle='#e8dec0'; ctx.lineWidth=6;
      ctx.beginPath(); ctx.moveTo(bx-11,by-36); ctx.quadraticCurveTo(bx-34,by-44,bx-42,by-58); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx+11,by-36); ctx.quadraticCurveTo(bx+34,by-44,bx+42,by-58); ctx.stroke();
      ctx.fillStyle='#3a3020';
      ctx.beginPath(); ctx.arc(bx-5,by-34,2.6,0,TAU); ctx.arc(bx+5,by-34,2.6,0,TAU); ctx.fill();
      ctx.restore();
    } else if (lm.type==='mine') {
      ctx.save();
      // timber frame
      ctx.fillStyle='#3a2a18'; ctx.fillRect(tx-34,ty-44,10,52); ctx.fillRect(tx+24,ty-44,10,52); ctx.fillRect(tx-34,ty-50,68,12);
      // dark mouth (open) or boarded (collapsed)
      ctx.fillStyle='#0c0a07'; ctx.beginPath(); ctx.ellipse(tx,ty-12,24,30,0,0,TAU); ctx.fill();
      if (!lm.opened) {
        ctx.strokeStyle='#5a4226'; ctx.lineWidth=7;
        for (let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(tx-24,ty-22+i*14); ctx.lineTo(tx+24,ty-18+i*14); ctx.stroke(); }
        ctx.fillStyle='#7a6038'; ctx.fillRect(tx-30,ty-2,60,8); // rubble pile
      } else {
        // faint cold draft from the opened shaft
        ctx.globalAlpha=0.35; ctx.fillStyle='#2a3a4a'; ctx.beginPath(); ctx.ellipse(tx,ty-12,18,24,0,0,TAU); ctx.fill();
      }
      ctx.restore();
    } else if (lm.type==='shrine') {
      ctx.save();
      // stacked bone totem
      ctx.fillStyle='#cdbf9c'; ctx.fillRect(tx-6,ty-46,12,46);
      ctx.fillStyle='#e0d4b2'; ctx.beginPath(); ctx.arc(tx,ty-52,11,0,TAU); ctx.fill();
      ctx.fillStyle='#2a2418'; ctx.beginPath(); ctx.arc(tx-4,ty-54,2,0,TAU); ctx.arc(tx+4,ty-54,2,0,TAU); ctx.fill();
      ctx.strokeStyle='#b8a06a'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(tx-16,ty-30); ctx.lineTo(tx+16,ty-26); ctx.stroke();
      ctx.restore();
    }
    // name plate when the player is near a landmark
    if (dist(Game.player.x,Game.player.y,lm.x,lm.y) < 200) {
      ctx.fillStyle='rgba(20,14,6,0.6)'; ctx.font='12px Georgia'; ctx.textAlign='center';
      const w=ctx.measureText(lm.name).width+12;
      ctx.fillRect(tx-w/2, ty+14, w, 16);
      ctx.fillStyle='#cdbf9c'; ctx.fillText(lm.name, tx, ty+26);
    }
  }
}

// Town clutter + desert solids — shaded for a hand-drawn, readable look.
function drawProps(ox, oy) {          // legacy unsorted path (DEPTH_SORT off)
  for (const p of PROPS) {
    if (!onScreen(p.x,p.y,46)) continue;
    drawProp(p, ox, oy);
  }
}
function drawProp(p, ox, oy) {
  if (typeof drawIsoPropArt !== 'undefined' && drawIsoPropArt(p, ox, oy)) return;
  {
    const tx=p.x-ox, ty=p.y-oy;
    // soft contact shadow
    ctx.fillStyle='rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(tx,ty+p.r*0.55,p.r*0.95,p.r*0.42,0,0,TAU); ctx.fill();
    switch(p.type){
      case 'barrel': {
        const r=p.r;
        // staved body with a left-lit gradient
        const g=ctx.createLinearGradient(tx-r,0,tx+r,0);
        g.addColorStop(0,'#8a5e30'); g.addColorStop(0.45,'#6a4626'); g.addColorStop(1,'#4a2f18');
        ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(tx,ty,r*0.82,r,0,0,TAU); ctx.fill();
        // vertical staves
        ctx.strokeStyle='rgba(40,26,12,0.5)'; ctx.lineWidth=1;
        for (let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(tx+i*r*0.3, ty-r*0.92); ctx.lineTo(tx+i*r*0.3, ty+r*0.92); ctx.stroke(); }
        // iron hoops
        ctx.strokeStyle='#2a211a'; ctx.lineWidth=2.5;
        for (const yy of [-0.55,0.55]){ ctx.beginPath(); ctx.ellipse(tx,ty+yy*r,r*0.82,r*0.3,0,0,TAU); ctx.stroke(); }
        // lid
        ctx.fillStyle='#7a5630'; ctx.beginPath(); ctx.ellipse(tx,ty-r*0.86,r*0.7,r*0.26,0,0,TAU); ctx.fill();
        ctx.strokeStyle='#3a2814'; ctx.lineWidth=1.5; ctx.stroke();
        ctx.fillStyle='rgba(255,235,190,0.25)'; ctx.beginPath(); ctx.ellipse(tx-r*0.2,ty-r*0.9,r*0.28,r*0.1,0,0,TAU); ctx.fill();
        break;
      }
      case 'crate': {
        const r=p.r;
        // front face
        ctx.fillStyle='#7a5630'; ctx.fillRect(tx-r,ty-r*0.7,r*2,r*1.7);
        // lighter top face (fake 3/4 view)
        ctx.fillStyle='#946a3a';
        ctx.beginPath(); ctx.moveTo(tx-r,ty-r*0.7); ctx.lineTo(tx-r*0.7,ty-r*1.05); ctx.lineTo(tx+r*1.3,ty-r*1.05); ctx.lineTo(tx+r,ty-r*0.7); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#2e1d0e'; ctx.lineWidth=2; ctx.strokeRect(tx-r,ty-r*0.7,r*2,r*1.7);
        ctx.stroke();
        // plank seams + diagonal brace
        ctx.strokeStyle='rgba(40,26,12,0.5)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(tx-r,ty); ctx.lineTo(tx+r,ty); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx-r,ty+r*1.0); ctx.lineTo(tx+r,ty-r*0.7); ctx.stroke();
        // corner brackets
        ctx.fillStyle='#2a2620';
        ctx.fillRect(tx-r,ty-r*0.7,3,3); ctx.fillRect(tx+r-3,ty-r*0.7,3,3);
        ctx.fillRect(tx-r,ty+r-3,3,3); ctx.fillRect(tx+r-3,ty+r-3,3,3);
        break;
      }
      case 'post':
        // hitching post: rounded cap, rail, rope loop
        ctx.fillStyle='#5a3f24'; ctx.fillRect(tx-3,ty-16,6,22);
        ctx.fillStyle='#6a4a2a'; ctx.fillRect(tx-3,ty-16,2.5,22);   // lit edge
        ctx.fillStyle='#4a3320'; ctx.beginPath(); ctx.arc(tx,ty-16,4,0,TAU); ctx.fill();
        ctx.fillStyle='#3a2a18'; ctx.fillRect(tx-7,ty-12,14,3.5);   // rail
        ctx.strokeStyle='#caa877'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(tx+5,ty-9,2.4,0,TAU); ctx.stroke(); // rope loop
        break;
      case 'trough': {
        const r=p.r;
        ctx.fillStyle='#5a4026'; ctx.fillRect(tx-r,ty-8,r*2,16);     // wood box
        ctx.strokeStyle='#2e1d0e'; ctx.lineWidth=2; ctx.strokeRect(tx-r,ty-8,r*2,16);
        ctx.fillStyle='#3a2a18'; ctx.fillRect(tx-r,ty-8,4,16); ctx.fillRect(tx+r-4,ty-8,4,16); // end planks
        // water with a glint
        const wg=ctx.createLinearGradient(0,ty-5,0,ty+4); wg.addColorStop(0,'#5a8a9a'); wg.addColorStop(1,'#2f5564');
        ctx.fillStyle=wg; ctx.fillRect(tx-r+4,ty-5,r*2-8,8);
        ctx.fillStyle='rgba(220,245,255,0.5)'; ctx.fillRect(tx-r+7,ty-4,r*0.7,1.5);
        break;
      }
      case 'wagon': {
        ctx.save(); ctx.translate(tx,ty); ctx.rotate(p.seed);
        // wheels behind
        ctx.fillStyle='#3a2a18'; ctx.strokeStyle='#caa877'; ctx.lineWidth=2;
        for (const wx of [-20,20]){ ctx.beginPath(); ctx.arc(wx,16,8,0,TAU); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(wx-6,16); ctx.lineTo(wx+6,16); ctx.moveTo(wx,10); ctx.lineTo(wx,22); ctx.stroke(); }
        // bed
        ctx.fillStyle='#5a4026'; ctx.fillRect(-22,-12,44,24);
        ctx.strokeStyle='#2e2012'; ctx.lineWidth=3; ctx.strokeRect(-22,-12,44,24);
        ctx.strokeStyle='rgba(40,26,12,0.5)'; ctx.lineWidth=1;
        for (let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(-22,i*8); ctx.lineTo(22,i*8); ctx.stroke(); }
        // tattered canvas cover arch
        ctx.fillStyle='rgba(225,215,190,0.85)';
        ctx.beginPath(); ctx.moveTo(-20,-12); ctx.quadraticCurveTo(0,-34,20,-12); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#9a8e72'; ctx.lineWidth=1.5; ctx.stroke();
        ctx.restore(); break;
      }
      case 'boneleg':
        // weathered bone with knobby ends
        ctx.fillStyle='#e2d8bc'; ctx.fillRect(tx-6,ty-34,12,44);
        ctx.fillStyle='#c8bd9c'; ctx.fillRect(tx-6,ty-34,4,44);
        ctx.fillStyle='#e8dec2';
        ctx.beginPath(); ctx.arc(tx-4,ty-34,6,0,TAU); ctx.arc(tx+4,ty-34,6,0,TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(tx-4,ty+8,6,0,TAU); ctx.arc(tx+4,ty+8,6,0,TAU); ctx.fill();
        break;
      case 'spire': {
        const r=p.r;
        ctx.fillStyle='#6a5c44'; ctx.beginPath();
        ctx.moveTo(tx-r*0.6,ty+r); ctx.lineTo(tx,ty-r*1.4); ctx.lineTo(tx+r*0.6,ty+r); ctx.closePath(); ctx.fill();
        // shaded right face
        ctx.fillStyle='#4e4332'; ctx.beginPath();
        ctx.moveTo(tx,ty-r*1.4); ctx.lineTo(tx+r*0.6,ty+r); ctx.lineTo(tx+r*0.15,ty+r); ctx.closePath(); ctx.fill();
        // strata lines
        ctx.strokeStyle='rgba(40,32,20,0.4)'; ctx.lineWidth=1;
        for (let i=1;i<=3;i++){ const yy=ty+r - i*r*0.55; ctx.beginPath(); ctx.moveTo(tx-r*0.45+i*2,yy); ctx.lineTo(tx+r*0.45-i*2,yy); ctx.stroke(); }
        break;
      }
    }
  }
}


function drawWantedBoard(ox, oy) {
  const b=WANTED_BOARD; if (!onScreen(b.x,b.y,60)) return;
  const tx=b.x-ox, ty=b.y-oy;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(tx,ty+18,22,7,0,0,TAU); ctx.fill();
  ctx.fillStyle='#4a3320'; ctx.fillRect(tx-22,ty-30,44,40);   // board
  ctx.strokeStyle='#2a1d10'; ctx.lineWidth=3; ctx.strokeRect(tx-22,ty-30,44,40);
  ctx.fillStyle='#2a1d10'; ctx.fillRect(tx-3,ty+8,6,12);                   // post
  // pinned papers
  ctx.fillStyle='#cdbf9c'; ctx.fillRect(tx-16,ty-24,14,16); ctx.fillRect(tx+3,ty-22,13,15);
  ctx.fillStyle='#7a1818'; ctx.font='6px Georgia'; ctx.textAlign='center';
  ctx.fillText('WANTED', tx-9, ty-16);
  ctx.restore();
}

// The Manhunt: search-zone ring at your last-seen spot + faint lawman vision cones.
function drawManhunt(ox, oy) {
  if (Wanted.level<=0) return;
  ctx.save();
  if (Wanted.searching) {
    const lx=Wanted.lastSeen.x-ox, ly=Wanted.lastSeen.y-oy, R=Wanted.searchRadius;
    const fl=0.35+0.25*Math.sin(Game.time*5);
    ctx.globalAlpha=fl*0.14; ctx.fillStyle='#e8c45a';
    ctx.beginPath(); ctx.arc(lx,ly,R,0,TAU); ctx.fill();
    ctx.globalAlpha=fl; ctx.strokeStyle='#e8c45a'; ctx.lineWidth=2; ctx.setLineDash([14,10]);
    ctx.beginPath(); ctx.arc(lx,ly,R,0,TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  // Faint vision cones on lawmen so you can slip between their sightlines
  ctx.globalAlpha=0.10; ctx.fillStyle='#ffcf6a';
  for (const e of Game.enemies) {
    if (e.kind!=='lawman'||e.dead) continue;
    if (!onScreen(e.x, e.y, CFG.ENEMY_VIEW)) continue;
    const tx=e.x-ox, ty=e.y-oy;
    ctx.beginPath(); ctx.moveTo(tx,ty);
    ctx.arc(tx,ty,CFG.ENEMY_VIEW*0.85, e.aim-0.42, e.aim+0.42); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Dead Eye: desaturating red vignette + pulsing target rings on enemies.
function drawDeadEye() {
  const p = Game.player;
  if (!p.deadeyeActive) return;
  const ox=Camera.ox, oy=Camera.oy;
  ctx.save();
  ctx.fillStyle='rgba(70,20,20,0.20)'; ctx.fillRect(0,0,CFG.VIEW_W,CFG.VIEW_H);
  const g=ctx.createRadialGradient(CFG.VIEW_W/2,CFG.VIEW_H/2,120,CFG.VIEW_W/2,CFG.VIEW_H/2,CFG.VIEW_W*0.62);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(24,0,0,0.6)');
  ctx.fillStyle=g; ctx.fillRect(0,0,CFG.VIEW_W,CFG.VIEW_H);
  // Target rings on on-screen enemies
  for (const e of Game.enemies) {
    if (e.dead) continue;
    const [tx, ty] = W2S(e.x, e.y);
    if (tx<-30||tx>CFG.VIEW_W+30||ty<-30||ty>CFG.VIEW_H+30) continue;
    ctx.strokeStyle='rgba(255,70,70,0.9)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(tx,ty,e.r+8+2*Math.sin(Game.time*10),0,TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx-e.r-13,ty); ctx.lineTo(tx-e.r-4,ty); ctx.moveTo(tx+e.r+4,ty); ctx.lineTo(tx+e.r+13,ty);
    ctx.moveTo(tx,ty-e.r-13); ctx.lineTo(tx,ty-e.r-4); ctx.moveTo(tx,ty+e.r+4); ctx.lineTo(tx,ty+e.r+13);
    ctx.stroke();
  }
  ctx.restore();
}

/* ----- M4: mission objective marker + title cards ----- */
function drawMissionMarker(ox, oy) {
  if (Game.state!==STATE.PLAY || !Missions.marker) return;
  const m = Missions.marker;
  const [tx, ty] = W2S(m.x, m.y);   // identity offset when ISO off
  if (tx<-40||tx>CFG.VIEW_W+40||ty<-60||ty>CFG.VIEW_H+40) return;   // off-screen: minimap handles it
  // Don't crowd the player when standing on the objective.
  if (dist(Game.player.x, Game.player.y, m.x, m.y) < 70) return;
  const bob = Math.sin(Game.time*4)*4;
  const y = ty - 46 + bob;
  ctx.save();
  ctx.fillStyle='rgba(232,196,90,0.95)';
  ctx.strokeStyle='rgba(40,26,8,0.9)'; ctx.lineWidth=2;
  ctx.beginPath();                       // downward chevron
  ctx.moveTo(tx, y+12); ctx.lineTo(tx-9, y); ctx.lineTo(tx-4, y);
  ctx.lineTo(tx, y+5);  ctx.lineTo(tx+4, y); ctx.lineTo(tx+9, y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawTitleCard() {
  const c = Missions.card;
  if (!c) return;
  const dur = CFG.TITLE_CARD_TIME;
  // Fade in fast, hold, fade out.
  const a = clamp(Math.min(c.t/0.35, (dur-c.t)/0.7), 0, 1);
  if (a<=0) return;
  ctx.save();
  ctx.globalAlpha = a;
  // Letterbox bars
  ctx.fillStyle='rgba(8,5,2,0.85)';
  ctx.fillRect(0, 0, CFG.VIEW_W, 64);
  ctx.fillRect(0, CFG.VIEW_H-64, CFG.VIEW_W, 64);
  // Card text block
  const cy = CFG.VIEW_H*0.30;
  ctx.textAlign='center';
  ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=10;
  ctx.fillStyle='#c9a45a'; ctx.font='bold 17px Georgia';
  ctx.fillText(c.kicker, CFG.VIEW_W/2, cy-34);
  ctx.fillStyle='#f0dca8'; ctx.font='bold 44px Georgia';
  ctx.fillText(c.title, CFG.VIEW_W/2, cy+10);
  // Ornamental rule
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(201,164,90,0.9)'; ctx.lineWidth=2;
  const rw = Math.min(420, ctx.measureText(c.title).width);
  ctx.beginPath(); ctx.moveTo(CFG.VIEW_W/2-rw/2, cy+28); ctx.lineTo(CFG.VIEW_W/2+rw/2, cy+28); ctx.stroke();
  ctx.fillStyle='#c9a45a';
  ctx.beginPath(); ctx.arc(CFG.VIEW_W/2, cy+28, 3.5, 0, TAU); ctx.fill();
  if (c.sub) { ctx.fillStyle='#e8d56a'; ctx.font='bold 20px Georgia'; ctx.fillText(c.sub, CFG.VIEW_W/2, cy+56); }
  ctx.restore();
}

function drawReticle() {
  if (Game.state!==STATE.PLAY) return;
  const mx=Input.mouse.x, my=Input.mouse.y;
  ctx.save();
  ctx.strokeStyle = Game.player.reloading ? 'rgba(200,120,80,0.9)' : 'rgba(230,210,160,0.9)';
  ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(mx,my,11,0,TAU); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mx-18,my); ctx.lineTo(mx-6,my);
  ctx.moveTo(mx+6,my); ctx.lineTo(mx+18,my);
  ctx.moveTo(mx,my-18); ctx.lineTo(mx,my-6);
  ctx.moveTo(mx,my+6); ctx.lineTo(mx,my+18);
  ctx.stroke();
  ctx.fillStyle=ctx.strokeStyle; ctx.fillRect(mx-1,my-1,2,2);
  ctx.restore();
}

function drawLightingTint() {
  // Gentle warm/cool wash that drifts over time — purely atmospheric.
  const warm = (Math.sin(Game.dayPhase*TAU)*0.5+0.5);
  ctx.save();
  ctx.globalCompositeOperation='overlay';
  ctx.globalAlpha=0.12;
  ctx.fillStyle = warm>0.5 ? '#ffb060' : '#3050a0';
  ctx.fillRect(0,0,CFG.VIEW_W,CFG.VIEW_H);
  ctx.restore();
  // Player hurt red flash
  if (Game.player.hurtFlash>0) {
    ctx.save();
    ctx.globalAlpha = clamp(Game.player.hurtFlash,0,0.5);
    ctx.fillStyle='#8a1010';
    ctx.fillRect(0,0,CFG.VIEW_W,CFG.VIEW_H);
    ctx.restore();
  }
}

/* ----- HUD ----- */
function drawHUD() {
  if (Game.state===STATE.START) return;
  const p = Game.player;
  ctx.save();
  ctx.textAlign='left';

  // Panel backdrop
  drawPanel(16, 16, 250, 166);

  // Health bar
  ctx.fillStyle='#3a1010'; ctx.fillRect(28, 30, 200, 18);
  const hpw = 200 * clamp(p.hp/CFG.PLAYER_MAX_HP,0,1);
  const hg = ctx.createLinearGradient(28,0,228,0);
  hg.addColorStop(0,'#b52020'); hg.addColorStop(1,'#e85a3a');
  ctx.fillStyle=hg; ctx.fillRect(28,30,hpw,18);
  ctx.strokeStyle='#1a0a0a'; ctx.lineWidth=2; ctx.strokeRect(28,30,200,18);
  ctx.fillStyle='#f0d8a8'; ctx.font='bold 13px Georgia';
  ctx.fillText('HP ' + Math.ceil(p.hp), 32, 44);

  // Ammo cylinder (6 chambers)
  ctx.fillStyle='#e8d5a8'; ctx.font='13px Georgia';
  ctx.fillText(p.reloading ? 'RELOADING…' : 'REVOLVER', 28, 66);
  for (let i=0;i<CFG.CYLINDER;i++) {
    const cx=34+i*22, cy=82;
    ctx.beginPath(); ctx.arc(cx,cy,8,0,TAU);
    ctx.fillStyle = i<p.ammo ? '#e8c45a' : '#3a2e1a';
    ctx.fill();
    ctx.strokeStyle='#1a120a'; ctx.lineWidth=2; ctx.stroke();
  }

  // Dynamite count + dash readiness row
  ctx.textAlign='left';
  ctx.fillStyle='#e88a3a'; ctx.font='13px Georgia';
  ctx.fillText('🧨 Dynamite ×' + p.dynamite + '  [Q]', 28, 104);
  // Dash pip: lit when ready, dim + shrinking while on cooldown
  const ready = p.dashCool<=0;
  const frac = ready ? 1 : 1 - clamp(p.dashCool/CFG.DASH_COOLDOWN,0,1);
  ctx.fillStyle = ready ? '#7fd0e8' : 'rgba(120,150,170,0.4)';
  ctx.fillRect(28, 112, 90*frac, 8);
  ctx.strokeStyle='#1a120a'; ctx.lineWidth=1.5; ctx.strokeRect(28,112,90,8);
  ctx.fillStyle = ready ? '#bfeaf5' : '#6a7a82'; ctx.font='12px Georgia';
  ctx.fillText(ready ? 'DASH ready [Shift]' : 'Dash…', 124, 120);

  // Dead Eye meter (hold Right Mouse)
  const de = clamp(p.deadeye/CFG.DEADEYE_MAX,0,1);
  ctx.fillStyle='#2a1414'; ctx.fillRect(28,130,210,10);
  const deg = ctx.createLinearGradient(28,0,238,0);
  deg.addColorStop(0,'#a01818'); deg.addColorStop(1,'#e8b23a');
  ctx.fillStyle = p.deadeyeActive ? '#ffde7a' : deg; ctx.fillRect(28,130,210*de,10);
  ctx.strokeStyle='#1a0a0a'; ctx.lineWidth=1.5; ctx.strokeRect(28,130,210,10);
  ctx.fillStyle='#e0c088'; ctx.font='11px Georgia'; ctx.textAlign='left';
  ctx.fillText(p.deadeyeActive ? 'DEAD EYE ACTIVE' : 'Dead Eye [Right Mouse]', 30, 139);

  // Tools row
  ctx.fillStyle='#b8a880'; ctx.font='12px Georgia';
  ctx.fillText('Lasso [F]   Whistle [H]   Lockpick', 28, 158);

  // Money / score (top-right)
  ctx.textAlign='right';
  drawPanel(CFG.VIEW_W-210, 16, 194, 76);
  ctx.fillStyle='#e8d56a'; ctx.font='bold 20px Georgia';
  ctx.fillText('$' + p.money, CFG.VIEW_W-26, 42);
  ctx.fillStyle='#c8b890'; ctx.font='13px Georgia';
  ctx.fillText('Score ' + Game.score + '   Kills ' + Game.kills, CFG.VIEW_W-26, 62);
  ctx.fillStyle='#9a8a6a'; ctx.font='12px Georgia';
  ctx.fillText('Trouble: ' + Game.diff().label, CFG.VIEW_W-26, 80);

  // Wanted stars (top-centre) — flash while the law is searching for you
  ctx.textAlign='center';
  const stars = Wanted.level;
  const flashOn = !Wanted.searching || (Math.floor(Game.time*6)%2===0);
  ctx.font='22px Georgia';
  for (let i=0;i<CFG.WANTED_MAX;i++) {
    ctx.fillStyle = (i<stars && flashOn) ? '#e8c45a' : 'rgba(80,66,40,0.6)';
    ctx.fillText('★', CFG.VIEW_W/2 - 56 + i*28, 40);
  }
  if (stars>0) {
    const tag = Game.playerInCamp() ? 'LAYING LOW' : (Wanted.searching ? 'SEARCHING…' : 'WANTED');
    ctx.fillStyle = Wanted.searching ? '#e8c45a' : '#c89060'; ctx.font='11px Georgia';
    ctx.fillText(tag, CFG.VIEW_W/2, 56);
  }

  // Mission objective (top-centre, under the wanted stars)
  if (Missions.objective && !Missions.card) {
    const txt = '◆ ' + Missions.objective;
    ctx.font='bold 14px Georgia'; ctx.textAlign='center';
    const w = ctx.measureText(txt).width + 28;
    ctx.fillStyle='rgba(20,14,6,0.62)';
    ctx.fillRect(CFG.VIEW_W/2-w/2, 66, w, 24);
    ctx.strokeStyle='rgba(160,120,60,0.55)'; ctx.lineWidth=1.5;
    ctx.strokeRect(CFG.VIEW_W/2-w/2, 66, w, 24);
    ctx.fillStyle='#e8c45a';
    ctx.fillText(txt, CFG.VIEW_W/2, 83);
  }

  // Boss HP bar (bottom-centre) — phase notches at 2/3 and 1/3
  const boss = Game.enemies.find(e=>e.kind==='boss' && !e.dead);
  if (boss) {
    const bw=420, bh=14, bx=CFG.VIEW_W/2-bw/2, by=CFG.VIEW_H-44;
    drawPanel(bx-6, by-24, bw+12, bh+32);
    ctx.fillStyle='#e8c8a0'; ctx.font='bold 12px Georgia'; ctx.textAlign='center';
    ctx.fillText('☠  BUCKSHOT BENNY' + (boss.phase===3?'  —  DEMON-TOUCHED':''), CFG.VIEW_W/2, by-9);
    ctx.fillStyle='#2a1414'; ctx.fillRect(bx,by,bw,bh);
    const f = clamp(boss.hp/boss.maxhp,0,1);
    const bg = ctx.createLinearGradient(bx,0,bx+bw,0);
    bg.addColorStop(0,'#7a1a1a'); bg.addColorStop(1,'#c85a2a');
    ctx.fillStyle = boss.phase===3 ? '#a01818' : bg;
    ctx.fillRect(bx,by,bw*f,bh);
    // phase notches
    ctx.fillStyle='rgba(240,220,180,0.7)';
    ctx.fillRect(bx+bw*(2/3)-1, by, 2, bh); ctx.fillRect(bx+bw*(1/3)-1, by, 2, bh);
    ctx.strokeStyle='#1a0a0a'; ctx.strokeRect(bx,by,bw,bh);
  }

  // Interaction prompt
  if (Game.interactPrompt) {
    let txt='';
    const ipt = Game.interactPrompt;
    if (ipt.mount) txt='[E] Mount horse';
    else if (ipt.dismount) txt='[E] Dismount';
    else txt='[E] ' + (ipt.label || ipt.name);
    ctx.fillStyle='rgba(20,14,6,0.8)';
    const w=ctx.measureText(txt).width+30;
    ctx.font='16px Georgia';
    ctx.fillRect(CFG.VIEW_W/2-w/2, CFG.VIEW_H-110, w, 30);
    ctx.strokeStyle='rgba(160,120,60,0.8)'; ctx.strokeRect(CFG.VIEW_W/2-w/2, CFG.VIEW_H-110, w, 30);
    ctx.fillStyle='#f0d8a8'; ctx.textAlign='center';
    ctx.fillText(txt, CFG.VIEW_W/2, CFG.VIEW_H-90);
  }

  // Toast message
  if (Game.msgTimer>0) {
    ctx.globalAlpha = clamp(Game.msgTimer,0,1);
    ctx.fillStyle='rgba(20,14,6,0.85)';
    ctx.font='17px Georgia'; ctx.textAlign='center';
    const w=ctx.measureText(Game.msg).width+40;
    ctx.fillRect(CFG.VIEW_W/2-w/2, CFG.VIEW_H-150, w, 34);
    ctx.strokeStyle='rgba(160,120,60,0.8)'; ctx.strokeRect(CFG.VIEW_W/2-w/2, CFG.VIEW_H-150, w, 34);
    ctx.fillStyle='#f0d8a8';
    ctx.fillText(Game.msg, CFG.VIEW_W/2, CFG.VIEW_H-128);
    ctx.globalAlpha=1;
  }
  ctx.restore();
}

function drawMinimap() {
  if (Game.state===STATE.START) return;
  const MW=180, MH=180, MX=CFG.VIEW_W-MW-20, MY=CFG.VIEW_H-MH-20;
  const sx=MW/CFG.WORLD_W, sy=MH/CFG.WORLD_H;
  ctx.save();
  ctx.globalAlpha=0.9;
  drawPanel(MX-2, MY-2, MW+4, MH+4);
  // Buildings + camp
  ctx.fillStyle='#7a5a34';
  for (const b of BUILDINGS) ctx.fillRect(MX+b.x*sx, MY+b.y*sy, Math.max(2,b.w*sx), Math.max(2,b.h*sy));
  // Camp marked in fire-orange so home base is easy to find
  ctx.fillStyle='#d8893a';
  for (const b of CAMP) ctx.fillRect(MX+b.x*sx-1, MY+b.y*sy-1, Math.max(3,b.w*sx), Math.max(3,b.h*sy));
  // Roads
  ctx.fillStyle='rgba(150,124,80,0.4)';
  ctx.fillRect(MX+(TOWN_CX-70)*sx, MY, 140*sx, MH);
  ctx.fillRect(MX, MY+(TOWN_CY-60)*sy, MW, 120*sy);
  // Landmarks (pale diamonds) — give the wilderness navigation targets
  ctx.fillStyle='#bcae86';
  for (const lm of LANDMARKS) {
    if (lm.type==='riverbed'||lm.type==='ghosttrail') continue;
    const mx=MX+lm.x*sx, my=MY+lm.y*sy;
    ctx.beginPath(); ctx.moveTo(mx,my-2.5); ctx.lineTo(mx+2.5,my); ctx.lineTo(mx,my+2.5); ctx.lineTo(mx-2.5,my); ctx.closePath(); ctx.fill();
  }
  // Undug caches (faint specks) once you're roughly near them
  ctx.fillStyle='rgba(232,213,106,0.5)';
  for (const sc of SECRETS) { if (!sc.found && dist(Game.player.x,Game.player.y,sc.x,sc.y)<700) ctx.fillRect(MX+sc.x*sx-1, MY+sc.y*sy-1, 2, 2); }
  // Manhunt search zone
  if (Wanted.level>0) {
    const mzx=MX+Wanted.lastSeen.x*sx, mzy=MY+Wanted.lastSeen.y*sy, mzr=Math.max(3,Wanted.searchRadius*sx);
    ctx.setLineDash([4,3]); ctx.lineWidth=1.5;
    ctx.strokeStyle = Wanted.searching ? `rgba(232,196,90,${(0.5+0.4*Math.sin(Game.time*5)).toFixed(2)})` : 'rgba(232,90,58,0.85)';
    ctx.beginPath(); ctx.arc(mzx,mzy,mzr,0,TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  // Enemies (the boss shows as a fat bone-white blip)
  for (const e of Game.enemies) {
    if (e.kind==='boss') {
      ctx.fillStyle='#f0e8d0';
      ctx.fillRect(MX+e.x*sx-2.5, MY+e.y*sy-2.5, 5, 5);
      continue;
    }
    ctx.fillStyle = e.kind==='lawman' ? '#6a9ae8' : '#e85a3a';
    ctx.fillRect(MX+e.x*sx-1.5, MY+e.y*sy-1.5, 3, 3);
  }
  // Pickups
  ctx.fillStyle='#e8d56a';
  for (const pk of Game.pickups) ctx.fillRect(MX+pk.x*sx-1, MY+pk.y*sy-1, 2, 2);
  // Mission objective — pulsing gold diamond
  if (Missions.marker) {
    const mx=MX+Missions.marker.x*sx, my=MY+Missions.marker.y*sy;
    const r = 3.5 + Math.sin(Game.time*5)*1.2;
    ctx.fillStyle='rgba(255,214,90,0.95)';
    ctx.beginPath(); ctx.moveTo(mx,my-r); ctx.lineTo(mx+r,my); ctx.lineTo(mx,my+r); ctx.lineTo(mx-r,my); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(60,40,10,0.9)'; ctx.lineWidth=1; ctx.stroke();
  }
  // Player
  ctx.fillStyle='#fff';
  const px=MX+Game.player.x*sx, py=MY+Game.player.y*sy;
  ctx.beginPath(); ctx.arc(px,py,3,0,TAU); ctx.fill();
  // Player facing
  ctx.strokeStyle='#fff'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+Math.cos(Game.player.aim)*7, py+Math.sin(Game.player.aim)*7); ctx.stroke();
  ctx.restore();
}

/* ----- Full-screen menus ----- */
function panelBG() {
  ctx.fillStyle='rgba(10,7,3,0.82)';
  ctx.fillRect(0,0,CFG.VIEW_W,CFG.VIEW_H);
}
function titleText(t, y, size, color) {
  ctx.fillStyle=color||'#e8d5a8'; ctx.textAlign='center';
  ctx.font='bold '+size+'px Georgia';
  ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=8;
  ctx.fillText(t, CFG.VIEW_W/2, y);
  ctx.shadowBlur=0;
}

function drawStartScreen() {
  panelBG();
  // Sun on horizon flourish
  ctx.save();
  const g=ctx.createRadialGradient(CFG.VIEW_W/2,210,20,CFG.VIEW_W/2,210,260);
  g.addColorStop(0,'rgba(220,150,70,0.5)'); g.addColorStop(1,'rgba(220,150,70,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,CFG.VIEW_W,460);
  ctx.restore();

  titleText("REDEMPTION'S EDGE", 200, 64, '#e8c45a');
  ctx.fillStyle='#c8a878'; ctx.font='italic 20px Georgia'; ctx.textAlign='center';
  ctx.fillText('A Haunted Frontier Outlaw Tale', CFG.VIEW_W/2, 240);

  const lore = [
    "You are Chris King — “Dckslinger” — outlaw, and Darryl's biggest headache.",
    "Hicksville is crooked, broke, and pretending the desert demons are just a rumor.",
    "Six in the cylinder, a camp at your back, nothing to lose but your soul.",
    "Be a folk hero, rob the place blind, or stumble into redemption the hard way.",
  ];
  ctx.fillStyle='#d8c4a0'; ctx.font='16px Georgia';
  lore.forEach((l,i)=> ctx.fillText(l, CFG.VIEW_W/2, 300+i*26));

  ctx.fillStyle='#9a8460'; ctx.font='14px Georgia';
  ctx.fillText("WASD move · Mouse aim · Click fire · RMB Dead Eye · Shift dash · Q dynamite", CFG.VIEW_W/2, 444);
  ctx.fillText("F lasso · H whistle · R reload · E interact/mount · ESC pause", CFG.VIEW_W/2, 462);

  // --- Difficulty selector (1 / 2 / 3) ---
  ctx.fillStyle='#c8a878'; ctx.font='15px Georgia';
  ctx.fillText('CHOOSE YOUR TROUBLE — press 1 · 2 · 3', CFG.VIEW_W/2, 498);
  const pills = [
    { key:'1', id:'easy',   name:'Easy',   note:'the gentle ride' },
    { key:'2', id:'normal', name:'Normal', note:'a fair fight' },
    { key:'3', id:'hard',   name:'Hard',   note:'a short life' },
  ];
  const pw=190, ph=46, gap=18, total=pills.length*pw+(pills.length-1)*gap;
  let px = CFG.VIEW_W/2 - total/2;
  pills.forEach(p=>{
    const sel = Game.difficulty===p.id;
    ctx.fillStyle = sel ? 'rgba(180,110,40,0.55)' : 'rgba(40,28,14,0.6)';
    ctx.fillRect(px, 512, pw, ph);
    ctx.strokeStyle = sel ? '#e8c45a' : 'rgba(120,90,50,0.7)';
    ctx.lineWidth = sel ? 3 : 1.5; ctx.strokeRect(px, 512, pw, ph);
    ctx.fillStyle = sel ? '#fff0c0' : '#c8b890';
    ctx.font='bold 18px Georgia'; ctx.textAlign='center';
    ctx.fillText(`[${p.key}] ${p.name}`, px+pw/2, 535);
    ctx.fillStyle = sel ? '#e8d5a8' : '#8a7a5a'; ctx.font='italic 12px Georgia';
    ctx.fillText(p.note, px+pw/2, 551);
    px += pw+gap;
  });

  // Blinking prompt
  if (Math.floor(Game.time*2)%2===0 || Game.time===0) {
    titleText('Press any other key to ride', 600, 26, '#e8c45a');
  }
}

function drawPauseScreen() {
  panelBG();
  titleText('PAUSED', 320, 56, '#e8c45a');
  ctx.fillStyle='#d8c4a0'; ctx.font='18px Georgia'; ctx.textAlign='center';
  ctx.fillText('Press ESC or P to resume', CFG.VIEW_W/2, 380);
  ctx.fillText('Press N to abandon and start over', CFG.VIEW_W/2, 410);
}

function drawGameOver() {
  panelBG();
  titleText('YOU DIED', 280, 64, '#b52020');
  ctx.fillStyle='#d8c4a0'; ctx.font='20px Georgia'; ctx.textAlign='center';
  ctx.fillText('The frontier claims another soul.', CFG.VIEW_W/2, 330);
  ctx.fillStyle='#e8d56a'; ctx.font='22px Georgia';
  ctx.fillText(`Final Score ${Game.score}   •   Kills ${Game.kills}   •   $${Game.player.money}`, CFG.VIEW_W/2, 380);

  // Restart button
  const bw=260, bh=56, bx=CFG.VIEW_W/2-bw/2, by=440;
  GO_BTN = {x:bx,y:by,w:bw,h:bh};
  const hover = Input.mouse.x>bx&&Input.mouse.x<bx+bw&&Input.mouse.y>by&&Input.mouse.y<by+bh;
  ctx.fillStyle = hover ? '#7a4a22' : '#5a3618';
  ctx.fillRect(bx,by,bw,bh);
  ctx.strokeStyle='#c89050'; ctx.lineWidth=3; ctx.strokeRect(bx,by,bw,bh);
  ctx.fillStyle='#f0d8a8'; ctx.font='bold 24px Georgia';
  ctx.fillText('RIDE AGAIN', CFG.VIEW_W/2, by+37);
  ctx.fillStyle='#9a8460'; ctx.font='14px Georgia';
  ctx.fillText('(or press Enter / R)', CFG.VIEW_W/2, by+82);
}
let GO_BTN = null;
