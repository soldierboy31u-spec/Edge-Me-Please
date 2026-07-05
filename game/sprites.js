"use strict";
/* Redemption's Edge — sprites.js
   Reusable sprite pipeline (RE-ART-004/005/006/007): 8-direction resolver,
   frame-rate-independent SpriteAnimator, the Chris controller, an auto-generated
   placeholder sheet (so the pipeline is visible before real art), and the
   anchored renderer. Purely visual — never touches gameplay/collision. */

/* ---- 8-direction resolver (RE-ART-005) ---------------------------------- */
// Screen space: +x = east, +y = south (down). Angles in radians.
const DIR_ANGLE = {
  east:0, southeast:Math.PI/4, south:Math.PI/2, southwest:3*Math.PI/4,
  west:Math.PI, northwest:-3*Math.PI/4, north:-Math.PI/2, northeast:-Math.PI/4,
};
const _DIR_BY_SECTOR = ['east','southeast','south','southwest','west','northwest','north','northeast'];
function vectorTo8DirName(x, y) {
  const ang = Math.atan2(y, x);
  let s = Math.round(ang / (Math.PI/4));   // -4..4
  s = ((s % 8) + 8) % 8;
  return _DIR_BY_SECTOR[s];
}

/* ---- SpriteAnimator (RE-ART-004) ---------------------------------------- */
class SpriteAnimator {
  constructor(manifest) {
    this.m = manifest;
    this.anim = manifest.fallbackAnimation || 'idle';
    this.dir = 'south';
    this.frame = 0;
    this.t = 0;            // ms accumulator
    this.finished = false;
  }
  setDirection(name) { if (name) this.dir = name; }
  setAnimation(name) {
    if (!this.m.animations[name]) name = this.m.fallbackAnimation;
    if (name !== this.anim) { this.anim = name; this.frame = 0; this.t = 0; this.finished = false; }
  }
  update(dtSec) {
    const def = this.m.animations[this.anim] || this.m.animations[this.m.fallbackAnimation];
    if (!def) return;
    const n = Math.max(1, def.framesPerDirection);
    this.t += dtSec * 1000;
    if (this.t >= def.frameDurationMs) {
      const adv = Math.floor(this.t / def.frameDurationMs);
      this.t -= adv * def.frameDurationMs;
      if (def.loop) { this.frame = (this.frame + adv) % n; }
      else { this.frame = Math.min(this.frame + adv, n - 1); if (this.frame >= n - 1) this.finished = true; }
    }
  }
}

/* ---- Placeholder sheet generator (RE-ART-009 stand-in) -------------------
   Draws a readable directional blob per cell so the animator/resolver/anchor
   are all visible BEFORE real PNGs exist. Real art overrides these automatically. */
function makePlaceholderSheet(name, def, m) {
  const fw = m.frameWidth, fh = m.frameHeight, cols = Math.max(1, def.framesPerDirection), rows = m.directions.length;
  const cv = document.createElement('canvas');
  cv.width = cols * fw; cv.height = rows * fh;
  const c = cv.getContext('2d');
  const tint = { idle:'#6b4a2a', walk:'#7a5230', aim:'#8a5a30', shoot:'#b0662a', dash:'#5a7a8a', hurt:'#b83a2a', mounted:'#4a3a24' }[name] || '#6b4a2a';
  for (let r = 0; r < rows; r++) {
    const ang = DIR_ANGLE[m.directions[r]];
    for (let f = 0; f < cols; f++) {
      const cx = f*fw + fw/2, feet = r*fh + m.anchor.y;
      const bob = Math.sin(f/cols * Math.PI*2) * (name==='walk'?3:1);
      // coat body
      c.fillStyle = tint;
      c.beginPath(); c.ellipse(cx, feet-26+bob, 13, 17, 0, 0, Math.PI*2); c.fill();
      // head + hat brim
      c.fillStyle = '#c89a72'; c.beginPath(); c.arc(cx, feet-46+bob, 8, 0, Math.PI*2); c.fill();
      c.fillStyle = '#2a1d10'; c.beginPath(); c.ellipse(cx, feet-48+bob, 13, 5, 0, 0, Math.PI*2); c.fill();
      // gun arm pointing in this row's facing direction
      c.strokeStyle = '#222'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx, feet-28+bob); c.lineTo(cx+Math.cos(ang)*17, feet-28+bob+Math.sin(ang)*17); c.stroke();
      // muzzle pop on shoot frame 1
      if (name==='shoot' && f===1) { c.fillStyle='#ffd24a'; c.beginPath(); c.arc(cx+Math.cos(ang)*20, feet-28+bob+Math.sin(ang)*20, 5, 0, Math.PI*2); c.fill(); }
      // frame tick so animation is obviously playing
      c.fillStyle = 'rgba(255,240,180,0.7)';
      c.fillRect(cx-12, feet+4, 24*(f+1)/cols, 3);
    }
  }
  return cv;
}

/* ---- Chris controller (owns the animator, loads sheets) ------------------ */
const ChrisSprites = {
  ready: false,
  animator: null,
  ink: {},        // anim name -> black-silhouette copy of its sheet (M6 outlines)
  init() {
    this.animator = new SpriteAnimator(CHRIS_MANIFEST);
    if (CFG.USE_SPRITES) this.load();
  },
  // Build the ink silhouette for a sheet once; drawn at ±1px under the real
  // frame to give Chris a hand-drawn contour. Cheap: 4 extra draws per frame.
  _buildInk(name, img) {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#1a120a';
    c.fillRect(0, 0, cv.width, cv.height);
    this.ink[name] = cv;
  },
  async load() {
    const m = CHRIS_MANIFEST;
    const jobs = [];
    for (const [name, def] of Object.entries(m.animations)) {
      if (!def.file) continue;
      jobs.push(Assets.loadImage('chris_' + name, m.basePath + def.file).then((img) => {
        if (!img && CFG.SPRITE_PLACEHOLDER && def.fallback === undefined) {
          // Only synthesize placeholders for the core (non-fallback) anims.
          const ph = makePlaceholderSheet(name, def, m);
          Assets.set('chris_' + name, ph, 'placeholder');
          if (CFG.FX_OUTLINE) this._buildInk(name, ph);
        } else if (!img && CFG.SPRITE_PLACEHOLDER && def.fallback === null) {
          // mounted with no art: leave empty so the procedural rider is used.
        } else if (img && CFG.FX_OUTLINE) {
          this._buildInk(name, img);
        }
      }));
    }
    await Promise.all(jobs);
    this.ready = true;
    const kinds = Object.keys(m.animations).map(k => Assets.status('chris_' + k));
    console.log('[sprites] Chris pipeline ready — ' + (kinds.includes('ok') ? 'using real art' : 'using placeholders'));
  },
  // Resolve the image for an animation, following the fallback chain.
  resolve(anim) {
    const m = CHRIS_MANIFEST; let name = anim, guard = 0;
    while (guard++ < 5) {
      const def = m.animations[name];
      if (!def) return { img: null, name, def: null };
      const img = Assets.getImage('chris_' + name);
      if (img) return { img, name, def };
      if (def.fallback) { name = def.fallback; continue; }
      return { img: null, name, def };   // fallback null/undefined -> no image (use procedural)
    }
    return { img: null, name, def: m.animations[name] };
  },
};

/* ---- Anchored renderer (RE-ART-007) -------------------------------------
   Draws Chris's current frame with his FEET planted on the world position.
   Returns false if there's no image (caller then draws procedural fallback). */
function drawChrisSprite(ctx, player, ox, oy) {
  const a = ChrisSprites.animator; if (!a) return false;
  const got = ChrisSprites.resolve(a.anim);
  if (!got.img || !got.def) return false;
  const m = CHRIS_MANIFEST;
  // Per-animation overrides let sheets with a different baseline/height coexist
  // (idle predates the y=108 contract) without resampling the art.
  const scale = CFG.SPRITE_DRAW_SCALE * (got.def.scaleMul || 1);
  const anchor = got.def.anchor || m.anchor;
  const dirIdx = Math.max(0, m.directions.indexOf(a.dir));
  const frame = Math.min(a.frame, got.def.framesPerDirection - 1);
  const sx = frame * m.frameWidth, sy = dirIdx * m.frameHeight;
  // Procedural step-bob while walking — the front/back walk rows are a single
  // frozen frame (see docs/tools/rebuild_walk.py), so code supplies the motion.
  const bob = (a.anim === 'walk' && CFG.WALK_BOB_PX)
    ? Math.abs(Math.sin(Game.time * Math.PI * (CFG.WALK_BOB_HZ||5))) * -CFG.WALK_BOB_PX : 0;
  const dx = (player.x - ox) - anchor.x * scale;
  const dy = (player.y + (CFG.SPRITE_FOOT_OFFSET||0) - oy) - anchor.y * scale + bob;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  // M6 ink outline: the frame's silhouette at ±1px in four directions.
  const inkCv = CFG.FX_OUTLINE && ChrisSprites.ink[got.name];
  if (inkCv) {
    ctx.save(); ctx.globalAlpha = 0.85;
    for (const [ix,iy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      ctx.drawImage(inkCv, sx, sy, m.frameWidth, m.frameHeight,
                    dx+ix, dy+iy, m.frameWidth*scale, m.frameHeight*scale);
    }
    ctx.restore();
  }
  ctx.drawImage(got.img, sx, sy, m.frameWidth, m.frameHeight, dx, dy, m.frameWidth*scale, m.frameHeight*scale);
  ctx.imageSmoothingEnabled = prev;
  return true;
}

/* ---- Horse controller (standalone idle horse sprite) ---------------------
   Riderless horse only — the mounted horse+rider combo is chris_mounted.png,
   owned by ChrisSprites. Single static frame per direction, so no animator
   needed, just a loader + anchored draw. */
const HorseSprites = {
  ready: false,
  ink: null,
  async load() {
    if (!CFG.USE_SPRITES) return;
    const m = HORSE_MANIFEST, def = m.animations.idle;
    const img = await Assets.loadImage('horse_idle', m.basePath + def.file);
    if (img && CFG.FX_OUTLINE) {
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const c = cv.getContext('2d');
      c.drawImage(img, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = '#1a120a';
      c.fillRect(0, 0, cv.width, cv.height);
      this.ink = cv;
    }
    this.ready = true;
  },
};

/* ---- Anchored renderer for the standalone horse (RE-ART-007 analog) ------
   Returns false if there's no image (caller then draws the procedural horse). */
function drawHorseSprite(ctx, horse, ox, oy) {
  const img = Assets.getImage('horse_idle');
  if (!img) return false;
  const m = HORSE_MANIFEST;
  // Ground shadow (the procedural horse bakes one into renderBody).
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(horse.x - ox, horse.y - oy + 8, 26, 11, 0, 0, TAU); ctx.fill();
  const hv = isoScreenVec(Math.cos(horse.aim), Math.sin(horse.aim));   // aim is world-space
  const dirName = vectorTo8DirName(hv[0], hv[1]);
  const dirIdx = Math.max(0, m.directions.indexOf(dirName));
  const scale = CFG.SPRITE_DRAW_SCALE * (m.animations.idle.scaleMul || 1);
  const anchor = m.anchor;
  const sx = 0, sy = dirIdx * m.frameHeight;
  const dx = (horse.x - ox) - anchor.x * scale;
  const dy = (horse.y - oy) - anchor.y * scale;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  if (CFG.FX_OUTLINE && HorseSprites.ink) {
    ctx.save(); ctx.globalAlpha = 0.85;
    for (const [ix,iy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      ctx.drawImage(HorseSprites.ink, sx, sy, m.frameWidth, m.frameHeight,
                    dx+ix, dy+iy, m.frameWidth*scale, m.frameHeight*scale);
    }
    ctx.restore();
  }
  ctx.drawImage(img, sx, sy, m.frameWidth, m.frameHeight, dx, dy, m.frameWidth*scale, m.frameHeight*scale);
  ctx.imageSmoothingEnabled = prev;
  return true;
}

/* ---- Bandit sprites (shared sheets, one SpriteAnimator per enemy) --------
   Same 8-dir contract as Chris (docs/CHARACTER_SPRITE_SPEC.md). Used for
   kind==='bandit' only; enforcers/lawmen/boss stay procedural until they
   get their own sheets (see docs/ART_TICKETS.md). */
const BANDIT_MANIFEST = {
  frameWidth: 128,
  frameHeight: 128,
  anchor: { x: 64, y: 108 },
  basePath: 'assets/characters/bandit/',
  directions: ['south','southwest','west','northwest','north','northeast','east','southeast'],
  animations: {
    idle: { file: 'bandit_idle.png', framesPerDirection: 4, frameDurationMs: 190, loop: true },
    walk: { file: 'bandit_walk.png', framesPerDirection: 8, frameDurationMs: 95,  loop: true, fallback: 'idle' },
  },
  fallbackAnimation: 'idle',
};
const BanditSprites = {
  ready: false,
  ink: {},      // anim -> black silhouette sheet (M6 outlines)
  red: {},      // anim -> red silhouette sheet (hurt flash tint)
  _tint(img, color) {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, cv.width, cv.height);
    return cv;
  },
  load() {
    if (!CFG.USE_SPRITES) return;
    const jobs = [];
    for (const [name, def] of Object.entries(BANDIT_MANIFEST.animations)) {
      jobs.push(Assets.loadImage('bandit_' + name, BANDIT_MANIFEST.basePath + def.file).then((img) => {
        if (img) {
          if (CFG.FX_OUTLINE) this.ink[name] = this._tint(img, '#1a120a');
          this.red[name] = this._tint(img, '#e04030');
        }
      }));
    }
    Promise.all(jobs).then(() => {
      // Only flip on when the core idle sheet actually loaded.
      this.ready = !!Assets.getImage('bandit_idle');
      if (this.ready) console.log('[sprites] bandit sheets in — procedural bandits retired');
    });
  },
};
// Draw an enemy's bandit sprite anchored at its feet. Returns false when the
// sheets aren't in (caller falls back to the procedural drawBandit art).
function drawBanditSprite(ctx, e, ox, oy) {
  if (!BanditSprites.ready || !e.spriteAnim) return false;
  const m = BANDIT_MANIFEST, a = e.spriteAnim;
  let name = a.anim, def = m.animations[name], img = Assets.getImage('bandit_' + name);
  if (!img) { name = 'idle'; def = m.animations.idle; img = Assets.getImage('bandit_idle'); }
  if (!img) return false;
  const scale = CFG.SPRITE_DRAW_SCALE * 0.88;   // bandits read a touch smaller than Chris
  const dirIdx = Math.max(0, m.directions.indexOf(a.dir));
  const frame = Math.min(a.frame, def.framesPerDirection - 1);
  const sx = frame * m.frameWidth, sy = dirIdx * m.frameHeight;
  const dx = (e.x - ox) - m.anchor.x * scale;
  const dy = (e.y + (CFG.SPRITE_FOOT_OFFSET||0) - oy) - m.anchor.y * scale;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  const inkCv = CFG.FX_OUTLINE && BanditSprites.ink[name];
  if (inkCv) {
    ctx.save(); ctx.globalAlpha = 0.85;
    for (const [ix,iy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      ctx.drawImage(inkCv, sx, sy, m.frameWidth, m.frameHeight,
                    dx+ix, dy+iy, m.frameWidth*scale, m.frameHeight*scale);
    }
    ctx.restore();
  }
  ctx.drawImage(img, sx, sy, m.frameWidth, m.frameHeight, dx, dy, m.frameWidth*scale, m.frameHeight*scale);
  // hurt flash: red silhouette pulse over the frame
  if (e.hurtFlash > 0 && BanditSprites.red[name]) {
    ctx.save(); ctx.globalAlpha = 0.5;
    ctx.drawImage(BanditSprites.red[name], sx, sy, m.frameWidth, m.frameHeight,
                  dx, dy, m.frameWidth*scale, m.frameHeight*scale);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = prev;
  return true;
}

/* ---- Iso building art (M8 Tier 2) ---------------------------------------
   Generated iso PNGs (docs/ISO_BUILDING_SPEC.md) replace the placeholder
   diamonds. Each entry anchors the art's ground-footprint centre onto the
   projected centre of the building's collision rect.
     anchorX/anchorY : 0..1 point in the image that sits on that screen point
     footScale       : image draw-width as a multiple of the projected
                       footprint width (w+h)*ISO_XS  */
const ISO_BUILDING_ART = {
  saloon: { file: 'iso_saloon.png', anchorX: 0.49, anchorY: 0.66, footScale: 0.82 },
  bank:   { file: 'iso_bank.png',   anchorX: 0.50, anchorY: 0.62, footScale: 0.92 },
  sheriff:{ file: 'iso_sheriff.png',anchorX: 0.50, anchorY: 0.57, footScale: 0.92 },
  store:  { file: 'iso_store.png',  anchorX: 0.50, anchorY: 0.58, footScale: 0.90 },
  undertaker: { file: 'iso_undertaker.png', anchorX: 0.50, anchorY: 0.57, footScale: 0.90 },
  stable: { file: 'iso_stable.png', anchorX: 0.50, anchorY: 0.55, footScale: 0.92 },
  chapel: { file: 'iso_chapel.png', anchorX: 0.48, anchorY: 0.71, footScale: 0.90 },
  // wide guy-lines make the image span > tent body, so footScale runs high
  tent:   { file: 'iso_tent.png',   anchorX: 0.42, anchorY: 0.66, footScale: 1.25 },
};
const IsoBuildings = {
  loaded: {},   // key -> HTMLImageElement
  load() {
    if (!CFG.ISO) return;
    for (const [key, def] of Object.entries(ISO_BUILDING_ART)) {
      Assets.loadImage('iso_' + key, 'assets/iso/buildings/' + def.file)
        .then(img => { if (img) this.loaded[key] = img; });
    }
  },
};
// Draw a building's iso art if loaded; returns false so the caller falls back
// to the placeholder diamond when the PNG isn't available yet.
function drawIsoBuildingArt(b) {
  if (!b.iso) return false;
  const def = ISO_BUILDING_ART[b.iso];
  const img = def && IsoBuildings.loaded[b.iso];
  if (!def || !img) return false;
  const footW = (b.w + b.h) * CFG.ISO_XS;             // projected diamond width
  const drawW = footW * def.footScale;
  const drawH = drawW * img.height / img.width;
  const c = W2S(b.x + b.w/2, b.y + b.h/2);            // footprint centre on screen
  const dx = c[0] - def.anchorX * drawW;
  const dy = c[1] - def.anchorY * drawH;
  const prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.imageSmoothingEnabled = prev;
  // name sign floats just above the roof
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.font='bold 14px Georgia'; ctx.textAlign='center';
  const lw = ctx.measureText(b.name).width + 14;
  const sy = dy + drawH*0.14;
  ctx.fillRect(c[0]-lw/2, sy-14, lw, 20);
  ctx.fillStyle='#e8d5a8'; ctx.fillText(b.name, c[0], sy);
  return true;
}

/* ---- Iso prop art (Tier 1 art tickets — docs/ART_TICKETS.md) -------------
   Generated PNGs replace the procedural scenery shapes. Keyed by SCENERY
   type; a type can hold several look variants, picked stably per item from
   its seed. hScale: draw height in px per unit of the item's collision
   radius (so bigger obstacles get bigger art). */
const ISO_PROP_ART = {
  cactus: [ { file: 'prop_cactus_saguaro.png', hScale: 5.2 } ],
};
const IsoProps = {
  loaded: {},   // file -> HTMLImageElement
  load() {
    if (!CFG.ISO) return;
    for (const variants of Object.values(ISO_PROP_ART))
      for (const def of variants)
        Assets.loadImage('prop_' + def.file, 'assets/iso/props/' + def.file)
          .then(img => { if (img) this.loaded[def.file] = img; });
  },
};
// Draw a scenery item's generated art; false -> caller draws the procedural
// fallback shape instead (art missing or type has no ticket delivered yet).
function drawIsoPropArt(s, ox, oy) {
  const variants = ISO_PROP_ART[s.type];
  if (!variants) return false;
  const def = variants[Math.floor(s.seed) % variants.length];
  const img = IsoProps.loaded[def.file];
  if (!img) return false;
  const tx = s.x - ox, ty = s.y - oy;
  const drawH = s.r * def.hScale;
  const drawW = drawH * img.width / img.height;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(tx, ty + s.r*0.35, s.r*1.05, s.r*0.42, 0, 0, TAU); ctx.fill();
  const prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, tx - drawW/2, ty + s.r*0.5 - drawH, drawW, drawH);
  ctx.imageSmoothingEnabled = prev;
  ctx.restore();
  return true;
}

/* ---- Debug overlay (RE-ART-014) — off by default ------------------------ */
function drawSpriteDebug(ctx, player, ox, oy) {
  const a = ChrisSprites.animator; if (!a) return;
  const tx = player.x - ox, ty = player.y - oy;
  ctx.save();
  ctx.strokeStyle = '#0f0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(tx, ty, player.r, 0, Math.PI*2); ctx.stroke();           // collision
  ctx.fillStyle = '#ff00ff';
  ctx.beginPath(); ctx.arc(tx, ty + (CFG.SPRITE_FOOT_OFFSET||0), 3, 0, Math.PI*2); ctx.fill();  // feet anchor
  ctx.fillStyle = '#0f0'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`${a.anim}/${a.dir} f${a.frame} [${Assets.status('chris_'+a.anim)}]`, tx + 18, ty - 22);
  ctx.restore();
}
