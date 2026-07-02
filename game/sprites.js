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
  init() {
    this.animator = new SpriteAnimator(CHRIS_MANIFEST);
    if (CFG.USE_SPRITES) this.load();
  },
  async load() {
    const m = CHRIS_MANIFEST;
    const jobs = [];
    for (const [name, def] of Object.entries(m.animations)) {
      if (!def.file) continue;
      jobs.push(Assets.loadImage('chris_' + name, m.basePath + def.file).then((img) => {
        if (!img && CFG.SPRITE_PLACEHOLDER && def.fallback === undefined) {
          // Only synthesize placeholders for the core (non-fallback) anims.
          Assets.set('chris_' + name, makePlaceholderSheet(name, def, m), 'placeholder');
        } else if (!img && CFG.SPRITE_PLACEHOLDER && def.fallback === null) {
          // mounted with no art: leave empty so the procedural rider is used.
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
  const m = CHRIS_MANIFEST, scale = CFG.SPRITE_DRAW_SCALE;
  const dirIdx = Math.max(0, m.directions.indexOf(a.dir));
  const frame = Math.min(a.frame, got.def.framesPerDirection - 1);
  const sx = frame * m.frameWidth, sy = dirIdx * m.frameHeight;
  const dx = (player.x - ox) - m.anchor.x * scale;
  const dy = (player.y + (CFG.SPRITE_FOOT_OFFSET||0) - oy) - m.anchor.y * scale;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(got.img, sx, sy, m.frameWidth, m.frameHeight, dx, dy, m.frameWidth*scale, m.frameHeight*scale);
  ctx.imageSmoothingEnabled = prev;
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
