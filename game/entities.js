"use strict";
/* Redemption's Edge — entities.js
   Part of the modular build. Loaded as a classic <script> in index.html (order matters).
   See docs/ROADMAP.md for the project map. */

/* ---------------------------------------------------------------------------
   7. ENTITY CLASSES
   --------------------------------------------------------------------------- */
class Bullet {
  constructor(x, y, ang, speed, dmg, friendly) {
    this.x = x; this.y = y;
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;
    this.life = CFG.BULLET_LIFE;
    this.dmg = dmg;
    this.friendly = friendly;    // true = fired by player
    this.dead = false;
    this.r = 3;
  }
  update(dt) {
    const px = this.x, py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.x < 0 || this.y < 0 || this.x > CFG.WORLD_W || this.y > CFG.WORLD_H) { this.dead = true; return; }
    // Collide with solid world objects (buildings + solid scenery).
    if (Game.hitsSolid(this.x, this.y)) {
      this.dead = true;
      Game.spawnImpact(px, py, 'dirt');
    }
  }
  render(ctx, ox, oy) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const tx = this.x - ox, ty = this.y - oy;
    // Tracer streak
    ctx.strokeStyle = this.friendly ? 'rgba(255,224,150,0.9)' : 'rgba(255,150,120,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - this.vx * 0.012, ty - this.vy * 0.012);
    ctx.stroke();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(tx, ty, this.r, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, vx, vy, life, color, size, gravity) {
    this.x=x; this.y=y; this.vx=vx; this.vy=vy;
    this.life=life; this.maxLife=life; this.color=color; this.size=size;
    this.gravity = gravity || 0;
    this.dead=false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.92; this.vy *= 0.92;
    this.vy += this.gravity * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  render(ctx, ox, oy) {
    const a = clamp(this.life / this.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    const s = this.size * (0.4 + a * 0.6);
    ctx.fillRect(this.x - ox - s/2, this.y - oy - s/2, s, s);
    ctx.globalAlpha = 1;
  }
}

class FloatText {
  constructor(x, y, text, color) {
    this.x=x; this.y=y; this.text=text; this.color=color||'#fff';
    this.life=0.9; this.maxLife=0.9; this.vy=-40; this.dead=false;
  }
  update(dt){ this.y += this.vy*dt; this.vy*=0.96; this.life-=dt; if(this.life<=0)this.dead=true; }
  render(ctx, ox, oy){
    const a = clamp(this.life/this.maxLife,0,1);
    ctx.globalAlpha=a; ctx.fillStyle=this.color;
    ctx.font='bold 18px Georgia'; ctx.textAlign='center';
    ctx.fillText(this.text, this.x-ox, this.y-oy);
    ctx.globalAlpha=1;
  }
}

class Pickup {
  constructor(x, y, kind) {
    this.x=x; this.y=y; this.kind=kind;  // 'ammo' | 'money'
    this.r=11; this.dead=false; this.bob=Math.random()*TAU;
    this.value = kind==='ammo' ? randInt(2,6) : kind==='dynamite' ? randInt(1,2) : kind==='bribe' ? 1 : randInt(5,25);
  }
  update(dt){ this.bob += dt*4; }
  render(ctx, ox, oy){
    const tx=this.x-ox, ty=this.y-oy + Math.sin(this.bob)*3;
    ctx.save();
    if (this.kind==='ammo') {
      ctx.fillStyle='#caa14a';
      ctx.strokeStyle='#5a3d1a'; ctx.lineWidth=2;
      ctx.fillRect(tx-7, ty-6, 14, 12);
      ctx.strokeRect(tx-7, ty-6, 14, 12);
      ctx.fillStyle='#3a2a14';
      ctx.fillRect(tx-4, ty-3, 3, 6); ctx.fillRect(tx+1, ty-3, 3, 6);
    } else if (this.kind==='dynamite') {
      ctx.fillStyle='#a02a1a'; ctx.strokeStyle='#5a160c'; ctx.lineWidth=2;
      ctx.fillRect(tx-7,ty-5,14,10); ctx.strokeRect(tx-7,ty-5,14,10);
      ctx.strokeStyle='#caa14a'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(tx+5,ty-5); ctx.lineTo(tx+8,ty-10); ctx.stroke();
      ctx.fillStyle='#ffd25a'; ctx.beginPath(); ctx.arc(tx+8,ty-10,2,0,TAU); ctx.fill();
    } else if (this.kind==='bribe') {
      // tin sheriff's-star badge
      ctx.fillStyle='#cfd6dd'; ctx.strokeStyle='#6a7078'; ctx.lineWidth=1.5;
      ctx.beginPath();
      for (let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=i%2?3.5:8.5; ctx.lineTo(tx+Math.cos(a)*rr, ty+Math.sin(a)*rr); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#6a7078'; ctx.beginPath(); ctx.arc(tx,ty,1.6,0,TAU); ctx.fill();
    } else {
      ctx.fillStyle='#d8c463'; ctx.strokeStyle='#7a6420'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(tx,ty,8,0,TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#7a6420'; ctx.font='bold 10px Georgia'; ctx.textAlign='center';
      ctx.fillText('$', tx, ty+3.5);
    }
    ctx.restore();
  }
}

// A thrown stick of dynamite — slides, fuses down, then asks Game to detonate.
class Dynamite {
  constructor(x, y, ang, speed) {
    this.x=x; this.y=y;
    this.vx=Math.cos(ang)*speed; this.vy=Math.sin(ang)*speed;
    this.fuse=CFG.DYN_FUSE; this.spin=rand(0,TAU); this.r=6; this.dead=false;
  }
  update(dt) {
    const nx=this.x+this.vx*dt, ny=this.y+this.vy*dt;
    if (Game.hitsSolid(nx,ny)) { this.vx*=-0.35; this.vy*=-0.35; }   // bounce off walls
    else { this.x=nx; this.y=ny; }
    const f=Math.exp(-3.2*dt); this.vx*=f; this.vy*=f;               // slide to a stop
    this.spin += dt*12;
    this.fuse -= dt;
    if (Math.random()<0.6) Game.particles.push(new Particle(this.x,this.y-4,rand(-12,12),rand(-40,-12),0.4,'rgba(140,140,140,0.6)',3));
    if (this.fuse<=0) { this.dead=true; Game.spawnExplosion(this.x,this.y); }
  }
  render(ctx, ox, oy) {
    const tx=this.x-ox, ty=this.y-oy;
    ctx.save(); ctx.translate(tx,ty); ctx.rotate(this.spin);
    ctx.fillStyle='#a02a1a'; ctx.fillRect(-9,-4,18,8);     // red stick
    ctx.fillStyle='#2a1a10'; ctx.fillRect(-9,-4,3,8);
    ctx.restore();
    // Sparking fuse — blinks faster as it nears zero
    const blink = (this.fuse < 0.4) ? (Math.floor(this.fuse*20)%2===0) : true;
    if (blink) { ctx.fillStyle='#ffd25a'; ctx.beginPath(); ctx.arc(tx, ty-7, 2.5, 0, TAU); ctx.fill(); }
  }
}

// Purely-visual blast (damage is applied once by Game.spawnExplosion).
class Explosion {
  constructor(x,y){ this.x=x; this.y=y; this.t=0; this.life=0.42; this.r=CFG.DYN_RADIUS; this.dead=false; }
  update(dt){ this.t+=dt; if(this.t>=this.life) this.dead=true; }
  render(ctx, ox, oy){
    const tx=this.x-ox, ty=this.y-oy;
    const p=this.t/this.life;
    ctx.save(); ctx.globalCompositeOperation='lighter';
    // expanding shockwave ring
    ctx.globalAlpha=(1-p)*0.9; ctx.strokeStyle='#ffb347'; ctx.lineWidth=6*(1-p)+1;
    ctx.beginPath(); ctx.arc(tx,ty,this.r*p,0,TAU); ctx.stroke();
    // bright core flash
    ctx.globalAlpha=(1-p)*0.8; ctx.fillStyle='#fff0c0';
    ctx.beginPath(); ctx.arc(tx,ty,this.r*0.5*(1-p)+6,0,TAU); ctx.fill();
    ctx.restore();
  }
}

class Player {
  constructor(x, y) {
    this.x=x; this.y=y; this.vx=0; this.vy=0;
    this.r=CFG.PLAYER_RADIUS;
    this.hp=CFG.PLAYER_MAX_HP;
    this.ammo=CFG.CYLINDER;
    this.money=35;
    this.aim=0;
    this.fireTimer=0;
    this.reloading=false;
    this.reloadTimer=0;
    this.recoil=0;       // visual kick
    this.mounted=null;   // Horse reference when riding
    this.hurtFlash=0;
    this.dead=false;
    this.facing=1;
    this.walkCycle=0;
    // Milestone 1 — dash / dodge
    this.dashTimer=0;    // >0 while the burst is active
    this.dashCool=0;     // cooldown remaining
    this.invuln=0;       // i-frames remaining (damage ignored while >0)
    this.dashDX=1; this.dashDY=0;
    this.trail=[];       // afterimage samples {x,y,a}
    // Milestone 1 — dynamite
    this.dynamite=CFG.DYN_START;
    // Milestone 3 — tools (Chris rides in already carrying his kit)
    this.hasLasso=true; this.hasLockpick=true; this.hasWhistle=true;
    this.lassoTimer=0;
    this.lassoAnim=null;                 // transient rope visual {tx,ty,t}
    this.deadeye=CFG.DEADEYE_MAX*0.5;    // meter, starts half-charged
    this.deadeyeActive=false;
  }
  get dashing() { return this.dashTimer > 0; }
  get speed() { return this.mounted ? CFG.HORSE_MAX_SPEED : CFG.PLAYER_MAX_SPEED; }
  get accel() { return this.mounted ? CFG.HORSE_ACCEL : CFG.PLAYER_ACCEL; }

  update(dt) {
    // --- Aim toward mouse (world-space) ---
    const mwx = Input.mouse.x + Camera.x;
    const mwy = Input.mouse.y + Camera.y;
    this.aim = angTo(this.x, this.y, mwx, mwy);
    if (Math.cos(this.aim) < 0) this.facing = -1; else this.facing = 1;

    // --- Movement input with acceleration & friction (weighty feel) ---
    let ix=0, iy=0;
    if (Input.keys['w'] || Input.keys['arrowup'])    iy -= 1;
    if (Input.keys['s'] || Input.keys['arrowdown'])  iy += 1;
    if (Input.keys['a'] || Input.keys['arrowleft'])  ix -= 1;
    if (Input.keys['d'] || Input.keys['arrowright'])  ix += 1;
    const ilen = Math.hypot(ix, iy);
    const il = ilen || 1;
    ix/=il; iy/=il;

    // --- Dash trigger (Shift) — on foot only; horse is already fast ---
    if (this.dashCool>0) this.dashCool -= dt;
    if (Input.hit('shift') && this.dashCool<=0 && this.dashTimer<=0 && !this.mounted) {
      // Dash in the movement direction, or toward the aim if standing still.
      if (ilen>0) { this.dashDX=ix; this.dashDY=iy; }
      else { this.dashDX=Math.cos(this.aim); this.dashDY=Math.sin(this.aim); }
      this.dashTimer=CFG.DASH_TIME; this.invuln=CFG.DASH_IFRAMES; this.dashCool=CFG.DASH_COOLDOWN;
      Audio.dash();
    }

    if (this.dashTimer>0) {
      // Velocity is overridden by the dash burst.
      this.dashTimer -= dt;
      this.vx = this.dashDX * CFG.DASH_SPEED;
      this.vy = this.dashDY * CFG.DASH_SPEED;
      // Leave afterimages
      this.trail.push({x:this.x, y:this.y, a:1});
    } else {
      this.vx += ix * this.accel * dt;
      this.vy += iy * this.accel * dt;
      // Friction when no input
      const fr = Math.exp(-CFG.PLAYER_FRICTION * dt);
      if (ix===0) this.vx *= fr;
      if (iy===0) this.vy *= fr;
      // Clamp to max speed
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > this.speed) { this.vx = this.vx/sp*this.speed; this.vy = this.vy/sp*this.speed; }
    }
    // Fade afterimage trail
    for (const t of this.trail) t.a -= dt*3.5;
    this.trail = this.trail.filter(t=>t.a>0);
    if (this.invuln>0) this.invuln -= dt;

    const moving = Math.hypot(ix,iy) > 0;
    if (moving) this.walkCycle += dt * (this.mounted ? 14 : 9);

    // Integrate + resolve collisions
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.resolveCollisions();
    this.x = clamp(this.x, this.r, CFG.WORLD_W - this.r);
    this.y = clamp(this.y, this.r, CFG.WORLD_H - this.r);
    if (this.mounted) { this.mounted.x = this.x; this.mounted.y = this.y; this.mounted.aim = this.aim; }

    // --- Weapon timers ---
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt*6);
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.reloading=false; this.ammo=CFG.CYLINDER; }
    }
    if (this.hurtFlash > 0) this.hurtFlash -= dt;

    // --- Actions ---
    const wantFire = (Input.mouse.down || Input.keys[' ']);
    if (wantFire && this.fireTimer<=0 && !this.reloading && this.ammo>0) this.fire();
    if (Input.hit('r') && !this.reloading && this.ammo < CFG.CYLINDER) {
      this.reloading=true; this.reloadTimer=CFG.RELOAD_TIME; Audio.reload();
    }
    // Auto-reload on empty trigger pull
    if (wantFire && this.ammo===0 && !this.reloading) {
      this.reloading=true; this.reloadTimer=CFG.RELOAD_TIME; Audio.reload();
    }
    // Throw dynamite (Q)
    if (Input.hit('q') && this.dynamite>0) this.throwDynamite();

    // --- Milestone 3 tools ---
    // Lasso (F)
    if (this.lassoTimer>0) this.lassoTimer -= dt;
    if (Input.hit('f') && this.hasLasso && this.lassoTimer<=0) this.throwLasso();
    if (this.lassoAnim) { this.lassoAnim.t -= dt; if (this.lassoAnim.t<=0) this.lassoAnim=null; }
    // Horse whistle (H)
    if (Input.hit('h') && this.hasWhistle && !this.mounted) this.summonHorse();
    // Dead Eye (hold Right Mouse) — drains meter, regens slowly otherwise
    const wantDeadeye = Input.mouse.rdown;
    if (wantDeadeye && !this.deadeyeActive && this.deadeye>=CFG.DEADEYE_MIN) { this.deadeyeActive=true; Audio.deadeye(); }
    if (this.deadeyeActive) {
      this.deadeye = Math.max(0, this.deadeye - CFG.DEADEYE_DRAIN*dt);
      if (!wantDeadeye || this.deadeye<=0) this.deadeyeActive=false;
    } else {
      this.deadeye = Math.min(CFG.DEADEYE_MAX, this.deadeye + CFG.DEADEYE_REGEN*dt);
    }

    // --- Sprite animation state (visual only; reads state, never changes it) ---
    if (CFG.USE_SPRITES && typeof ChrisSprites !== 'undefined' && ChrisSprites.ready) this.updateSpriteAnim(dt);
  }

  // Map existing gameplay state -> animation name + facing direction (RE-ART-006).
  updateSpriteAnim(dt) {
    const a = ChrisSprites.animator;
    // Chris's gun always tracks the mouse, so face the aim direction.
    a.setDirection(vectorTo8DirName(Math.cos(this.aim), Math.sin(this.aim)));
    const speed = Math.hypot(this.vx, this.vy);
    // Priority (low -> high): aim < walk < dash < shoot < mounted < hurt
    let state = 'aim';
    if (speed > 25) state = 'walk';
    if (this.dashTimer > 0) state = 'dash';
    if (this.recoil > 0.5 || (a.anim === 'shoot' && !a.finished)) state = 'shoot';  // let the one-shot finish
    if (this.mounted) state = 'mounted';
    if (this.hurtFlash > 0) state = 'hurt';
    a.setAnimation(state);
    a.update(dt);
  }

  throwLasso() {
    this.lassoTimer = CFG.LASSO_COOLDOWN;
    Audio.lasso();
    const R = CFG.LASSO_RANGE, ca=Math.cos(this.aim), sa=Math.sin(this.aim);
    // Catch the first enemy lying along the rope line.
    let caught=null, bestT=1.01;
    for (const e of Game.enemies) {
      if (e.dead) continue;
      const t = clamp(((e.x-this.x)*ca + (e.y-this.y)*sa)/R, 0, 1);
      const px=this.x+ca*R*t, py=this.y+sa*R*t;
      if (dist(px,py,e.x,e.y) < e.r+18 && t<bestT) { bestT=t; caught=e; }
    }
    let tipX=this.x+ca*R, tipY=this.y+sa*R;
    if (caught) {
      tipX=caught.x; tipY=caught.y;
      caught.stun = CFG.LASSO_STUN;
      caught.applyKnockback(angTo(caught.x,caught.y,this.x,this.y), CFG.LASSO_PULL);
      Game.floats.push(new FloatText(caught.x, caught.y-18, 'ROPED!', '#e8d56a'));
    } else {
      // No enemy — vacuum any loot near the rope toward you (auto-collected next frame).
      for (const pk of Game.pickups) {
        const t = clamp(((pk.x-this.x)*ca + (pk.y-this.y)*sa)/R, 0, 1);
        const px=this.x+ca*R*t, py=this.y+sa*R*t;
        if (dist(px,py,pk.x,pk.y) < CFG.LASSO_GRAB) { pk.x=this.x; pk.y=this.y; }
      }
    }
    this.lassoAnim = { tx:tipX, ty:tipY, t:0.22 };
  }

  summonHorse() {
    let best=null, bd=1e9;
    for (const h of Game.horses) { if (h.ridden) continue; const d=dist(this.x,this.y,h.x,h.y); if (d<bd){bd=d;best=h;} }
    if (best) { best.summoning=true; Audio.whistle(); Game.flashMsg('You whistle sharp — your horse comes running.'); }
    else Game.flashMsg('No loose horse to call.');
  }

  throwDynamite() {
    this.dynamite--;
    const sx = this.x + Math.cos(this.aim)*22;
    const sy = this.y + Math.sin(this.aim)*22;
    Game.dynamites.push(new Dynamite(sx, sy, this.aim, CFG.DYN_THROW_SPEED));
    Audio.click();
    Wanted.onPlayerShot(this.x, this.y);   // lighting a fuse in town draws eyes too
  }

  resolveCollisions() {
    // Buildings + camp structures
    for (const b of STRUCTURES) {
      const c = circleRect(this.x, this.y, this.r, b.x, b.y, b.w, b.h);
      if (c.hit) { this.x += c.nx*c.pen; this.y += c.ny*c.pen; this.vx*=0.3; this.vy*=0.3; }
    }
    for (const f of FENCES) {
      const c = circleRect(this.x, this.y, this.r, f.x, f.y, f.w, f.h);
      if (c.hit) { this.x += c.nx*c.pen; this.y += c.ny*c.pen; }
    }
    // Solid scenery + props (circular obstacles)
    for (const arr of [SCENERY, PROPS]) {
      for (const s of arr) {
        if (!s.solid) continue;
        const sr = (arr===PROPS) ? s.r*0.8 : s.r*0.7;
        const rr = this.r + sr;
        if (dist2(this.x,this.y,s.x,s.y) < rr*rr) {
          const a = angTo(s.x, s.y, this.x, this.y);
          const d = dist(this.x,this.y,s.x,s.y) || 0.001;
          const pen = rr - d;
          this.x += Math.cos(a)*pen; this.y += Math.sin(a)*pen;
        }
      }
    }
  }

  fire() {
    this.ammo--;
    this.fireTimer = CFG.FIRE_COOLDOWN;
    this.recoil = 1;
    const muzzleX = this.x + Math.cos(this.aim) * 26;
    const muzzleY = this.y + Math.sin(this.aim) * 26;
    const spread = (Math.random()-0.5) * CFG.BULLET_SPREAD_PLAYER * 2;
    const dmg = CFG.BULLET_DMG * (this.deadeyeActive ? CFG.DEADEYE_DMG : 1);
    Game.bullets.push(new Bullet(muzzleX, muzzleY, this.aim + spread, CFG.BULLET_SPEED, dmg, true));
    Game.spawnMuzzle(muzzleX, muzzleY, this.aim);
    Camera.addShake(4);
    Audio.shot();
    // Knockback / recoil push
    this.vx -= Math.cos(this.aim) * 40;
    this.vy -= Math.sin(this.aim) * 40;
    Wanted.onPlayerShot(this.x, this.y);
  }

  takeDamage(d) {
    if (this.invuln>0) return;          // dodged it — i-frames
    this.hp -= d;
    this.hurtFlash = 0.35;
    Camera.addShake(6);
    Audio.hurt();
    if (this.hp <= 0) { this.hp=0; this.dead=true; }
  }

  render(ctx, ox, oy) {
    const tx=this.x-ox, ty=this.y-oy;
    // Dash afterimages (drawn under the player)
    for (const t of this.trail) {
      ctx.globalAlpha = t.a*0.4;
      ctx.fillStyle = '#e8d5a8';
      ctx.beginPath(); ctx.ellipse(t.x-ox, t.y-oy, 12, 14, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(tx, ty+12, 16, 7, 0, 0, TAU); ctx.fill();

    if (this.mounted) this.mounted.renderBody(ctx, tx, ty);

    // Character art: sprite pipeline when enabled/ready/on-foot, else procedural fallback.
    let drew = false;
    if (CFG.USE_SPRITES && typeof ChrisSprites !== 'undefined' && ChrisSprites.ready && !this.mounted) {
      if (this.invuln>0 && Math.floor(this.invuln*30)%2===0) ctx.globalAlpha = 0.5;  // dash i-frame flicker
      drew = drawChrisSprite(ctx, this, ox, oy);
      ctx.globalAlpha = 1;
    }
    if (!drew) {
      // Flicker while invulnerable (skip some frames) so the dodge reads visually.
      if (this.invuln>0 && Math.floor(this.invuln*30)%2===0) ctx.globalAlpha = 0.5;
      drawGunslinger(ctx, tx, ty, this.aim, this.recoil, this.walkCycle,
                     this.hurtFlash>0, this.mounted!=null);
      ctx.globalAlpha = 1;
    }
    if (CFG.SPRITE_DEBUG && CFG.USE_SPRITES && typeof drawSpriteDebug !== 'undefined') drawSpriteDebug(ctx, this, ox, oy);

    // Lasso rope (transient)
    if (this.lassoAnim) {
      const a = clamp(this.lassoAnim.t/0.22, 0, 1);
      const lx = this.lassoAnim.tx-ox, ly = this.lassoAnim.ty-oy;
      ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle='#d8b483'; ctx.lineWidth=2.5; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(tx,ty-2); ctx.lineTo(lx,ly); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(lx,ly,8,5,this.aim,0,TAU); ctx.stroke();
      ctx.restore();
    }
  }
}

// Generic AI gunman (bandit / enforcer / lawman share this class with params).
class Enemy {
  constructor(x, y, kind) {
    this.x=x; this.y=y; this.vx=0; this.vy=0;
    this.kind=kind; // 'bandit' | 'enforcer' | 'lawman'
    this.r=CFG.ENEMY_RADIUS;
    if (kind==='enforcer') { this.hp=CFG.ENFORCER_HP; this.maxhp=CFG.ENFORCER_HP; this.speed=CFG.ENFORCER_SPEED; this.dmg=CFG.ENFORCER_DMG; this.r=16; }
    else if (kind==='lawman') { this.hp=CFG.LAWMAN_HP; this.maxhp=CFG.LAWMAN_HP; this.speed=CFG.LAWMAN_SPEED; this.dmg=CFG.ENEMY_BULLET_DMG+3; }
    else { this.hp=CFG.ENEMY_HP; this.maxhp=CFG.ENEMY_HP; this.speed=CFG.ENEMY_SPEED; this.dmg=CFG.ENEMY_BULLET_DMG; }
    // Apply difficulty scaling (Easy = ×1, the original M1 feel).
    const D = DIFFICULTY[Game.difficulty];
    this.hp *= D.hp; this.maxhp = this.hp; this.dmg *= D.dmg;
    this.fireMul = D.fireRate;   // multiplies fire cooldown (lower = shoots more)
    this.windupMul = D.windup;   // multiplies the attack-tell length (lower = harder)
    this.aim=rand(0,TAU);
    this.state='idle';    // AI states: idle | patrol | chase | attack
    this.fireTimer=rand(0,CFG.ENEMY_FIRE_COOLDOWN);
    this.patrolT=0; this.patrolDir=rand(0,TAU);
    this.dead=false; this.recoil=0; this.hurtFlash=0; this.walkCycle=0;
    this.windup=0;             // >0 = telegraphing a shot (attack tell)
    this.knockVX=0; this.knockVY=0;  // explosion/bullet knockback impulse
    this.stun=0;               // >0 = roped/stunned, can't act (lasso)
    this.home={x,y};
  }
  applyKnockback(ang, force) { this.knockVX += Math.cos(ang)*force; this.knockVY += Math.sin(ang)*force; }

  update(dt, player) {
    // Roped/stunned: can't steer or shoot, but the yank (knockback) still drags them.
    if (this.stun>0) {
      this.stun -= dt;
      this.vx *= Math.exp(-6*dt); this.vy *= Math.exp(-6*dt);
      this.x += this.knockVX*dt; this.y += this.knockVY*dt;
      const kd=Math.exp(-9*dt); this.knockVX*=kd; this.knockVY*=kd;
      this.resolveCollisions();
      this.x = clamp(this.x, this.r, CFG.WORLD_W-this.r);
      this.y = clamp(this.y, this.r, CFG.WORLD_H-this.r);
      if (this.recoil>0) this.recoil=Math.max(0,this.recoil-dt*6);
      if (this.hurtFlash>0) this.hurtFlash-=dt;
      this.windup=0;
      return;
    }
    const dToPlayer = dist(this.x,this.y,player.x,player.y);
    // Lawmen won't hunt you inside the camp safe haven — they give up at the edge.
    const campSafe = this.kind==='lawman' && Game.playerInCamp();
    const canSee = !campSafe && dToPlayer < CFG.ENEMY_VIEW && Game.lineOfSight(this.x,this.y,player.x,player.y);

    // ---- AI STATE MACHINE ----
    // idle/patrol → wander near home. chase → close distance. attack → shoot.
    if (player.dead) { this.state='idle'; }
    else if (canSee) {
      this.state = dToPlayer < CFG.ENEMY_SHOOT_RANGE ? 'attack' : 'chase';
      this.aim = angTo(this.x,this.y,player.x,player.y);
    } else if (this.state==='chase' || this.state==='attack') {
      // Lost sight → brief pursuit toward last seen, then back to patrol.
      this.state='patrol'; this.patrolT=0; this.patrolDir=this.aim;
    }

    let mx=0, my=0;
    switch(this.state) {
      case 'idle':
        this.patrolT -= dt;
        if (this.patrolT <= 0) { this.state='patrol'; this.patrolT=rand(1.5,3.5); this.patrolDir=rand(0,TAU); }
        break;
      case 'patrol':
        this.patrolT -= dt;
        mx=Math.cos(this.patrolDir); my=Math.sin(this.patrolDir);
        // Stay near home territory
        if (dist(this.x,this.y,this.home.x,this.home.y) > 320) {
          this.patrolDir = angTo(this.x,this.y,this.home.x,this.home.y);
        }
        if (this.patrolT<=0) { this.state='idle'; this.patrolT=rand(1,2.5); }
        break;
      case 'chase':
        mx=Math.cos(this.aim); my=Math.sin(this.aim);
        break;
      case 'attack': {
        // Maintain a firing distance: strafe if too close, advance if far.
        const ideal = CFG.ENEMY_SHOOT_RANGE * 0.6;
        if (dToPlayer > ideal+40) { mx=Math.cos(this.aim); my=Math.sin(this.aim); }
        else if (dToPlayer < ideal-60) { mx=-Math.cos(this.aim); my=-Math.sin(this.aim); }
        else { // strafe
          mx=Math.cos(this.aim+Math.PI/2)*0.6; my=Math.sin(this.aim+Math.PI/2)*0.6;
        }
        // Attack tell: wind up (brace, aim line shows) before the shot lands — fair, readable.
        if (this.windup>0) {
          this.windup -= dt;
          mx*=0.25; my*=0.25;            // plant feet while aiming
          if (this.windup<=0) { this.shoot(player); this.fireTimer = CFG.ENEMY_FIRE_COOLDOWN * this.fireMul * rand(0.85,1.3); }
        } else {
          this.fireTimer -= dt;
          if (this.fireTimer<=0) this.windup = CFG.ENEMY_WINDUP * this.windupMul;
        }
        break;
      }
    }

    const spd = this.speed * (this.state==='patrol'?0.5:1);
    this.vx = lerp(this.vx, mx*spd, 1-Math.exp(-8*dt));
    this.vy = lerp(this.vy, my*spd, 1-Math.exp(-8*dt));
    this.x += this.vx*dt; this.y += this.vy*dt;
    // Knockback impulse rides on top of AI steering, then decays fast.
    this.x += this.knockVX*dt; this.y += this.knockVY*dt;
    const kd = Math.exp(-9*dt);
    this.knockVX *= kd; this.knockVY *= kd;
    if (Math.hypot(mx,my)>0.1) this.walkCycle += dt*8;

    this.resolveCollisions();
    this.x = clamp(this.x, this.r, CFG.WORLD_W-this.r);
    this.y = clamp(this.y, this.r, CFG.WORLD_H-this.r);

    if (this.recoil>0) this.recoil=Math.max(0,this.recoil-dt*6);
    if (this.hurtFlash>0) this.hurtFlash-=dt;
  }

  resolveCollisions() {
    for (const b of STRUCTURES) {
      const c = circleRect(this.x,this.y,this.r,b.x,b.y,b.w,b.h);
      if (c.hit) { this.x+=c.nx*c.pen; this.y+=c.ny*c.pen; }
    }
    for (const arr of [SCENERY, PROPS]) {
      for (const s of arr) {
        if (!s.solid) continue;
        const rr=this.r+((arr===PROPS)?s.r*0.8:s.r*0.7);
        if (dist2(this.x,this.y,s.x,s.y) < rr*rr) {
          const a=angTo(s.x,s.y,this.x,this.y);
          const pen=rr-(dist(this.x,this.y,s.x,s.y)||0.001);
          this.x+=Math.cos(a)*pen; this.y+=Math.sin(a)*pen;
        }
      }
    }
  }

  shoot(player) {
    this.recoil=1;
    const mx=this.x+Math.cos(this.aim)*22, my=this.y+Math.sin(this.aim)*22;
    const spread=(Math.random()-0.5)*CFG.ENEMY_SPREAD*2;
    Game.bullets.push(new Bullet(mx,my,this.aim+spread,CFG.ENEMY_BULLET_SPEED,this.dmg,false));
    Game.spawnMuzzle(mx,my,this.aim);
    Audio.enemyShot();
  }

  takeDamage(d) {
    this.hp-=d; this.hurtFlash=0.25;
    Game.spawnImpact(this.x,this.y,'blood');
    Audio.hit();
    if (this.hp<=0 && !this.dead) { this.dead=true; Game.onEnemyKilled(this); }
  }

  render(ctx, ox, oy) {
    const tx=this.x-ox, ty=this.y-oy;
    ctx.fillStyle='rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(tx,ty+11,14,6,0,0,TAU); ctx.fill();
    const palette = this.kind==='lawman'
      ? {coat:'#3a4a6a', hat:'#1c2436', skin:'#caa07a'}
      : this.kind==='enforcer'
      ? {coat:'#5a2a2a', hat:'#2a1414', skin:'#b89070'}
      : {coat:'#4a3a28', hat:'#241a10', skin:'#c0a080'};
    // Attack tell — a charging aim line the player can read and dodge.
    if (this.windup>0) {
      const charge = 1 - this.windup/CFG.ENEMY_WINDUP;   // 0→1 as it builds
      const len = 40 + charge*CFG.ENEMY_SHOOT_RANGE*0.5;
      ctx.save();
      ctx.globalAlpha = 0.35 + charge*0.45;
      ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 1.5;
      ctx.setLineDash([6,5]);
      ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx+Math.cos(this.aim)*len, ty+Math.sin(this.aim)*len); ctx.stroke();
      ctx.setLineDash([]);
      // muzzle "charge" dot that brightens
      ctx.globalAlpha = charge;
      ctx.fillStyle='#ffd25a';
      ctx.beginPath(); ctx.arc(tx+Math.cos(this.aim)*22, ty+Math.sin(this.aim)*22, 2+charge*2, 0, TAU); ctx.fill();
      ctx.restore();
    }
    drawBandit(ctx, tx, ty, this.aim, this.recoil, this.walkCycle, this.hurtFlash>0, palette);
    // Roped/stunned — spinning stars over the head
    if (this.stun>0) {
      ctx.save(); ctx.fillStyle='#e8d56a'; ctx.font='11px Georgia'; ctx.textAlign='center';
      for (let i=0;i<3;i++){ const a=Game.time*6 + i*TAU/3; ctx.fillText('★', tx+Math.cos(a)*9, ty-30+Math.sin(a)*4); }
      ctx.restore();
    }
    // HP bar when damaged
    if (this.hp < this.maxhp) {
      const w=30, h=4;
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(tx-w/2, ty-26, w, h);
      ctx.fillStyle = this.kind==='lawman'?'#6a86c8':'#b54';
      ctx.fillRect(tx-w/2, ty-26, w*(this.hp/this.maxhp), h);
    }
    // Star badge for lawmen
    if (this.kind==='lawman') {
      ctx.fillStyle='#e8d56a'; ctx.font='10px Georgia'; ctx.textAlign='center';
      ctx.fillText('★', tx, ty-30);
    }
  }
}

/* ---------------------------------------------------------------------------
   M5 — BUCKSHOT BENNY (boss). Reuses the Enemy AI/collision/knockback core;
   overrides the gun (shotgun fan) and layers phased behavior on top:
     Phase 1 (>2/3 hp): shotgun blasts, keeps mid distance.
     Phase 2 (>1/3 hp): + lobs dynamite when you kite him, + reinforcements.
     Phase 3 (<1/3 hp): demon-touched — telegraphed shoulder charges, faster.
   --------------------------------------------------------------------------- */
class Boss extends Enemy {
  constructor(x, y) {
    super(x, y, 'bandit');
    this.kind = 'boss';
    const D = DIFFICULTY[Game.difficulty];
    this.hp = CFG.BOSS_HP * D.hp; this.maxhp = this.hp;
    this.speed = CFG.BOSS_SPEED; this.r = CFG.BOSS_RADIUS;
    this.dmg = CFG.BOSS_PELLET_DMG * D.dmg;
    this.phase = 1;
    this.dynTimer = CFG.BOSS_DYN_COOLDOWN * 0.6;
    this.chargeTimer = CFG.BOSS_CHARGE_COOLDOWN * 0.5;
    this.chargeWind = 0;      // >0 = stomping, about to charge (readable tell)
    this.charging = 0;        // >0 = mid-charge
    this.chargeAng = 0;
    this.chargeHit = false;   // one contact hit per charge
  }
  // Too big to juggle, too stubborn to stay roped.
  applyKnockback(ang, force) { super.applyKnockback(ang, force*0.35); }

  currentPhase() {
    const f = this.hp / this.maxhp;
    return f > 2/3 ? 1 : f > 1/3 ? 2 : 3;
  }

  shoot(player) {
    // Shotgun fan replaces the single revolver shot.
    this.recoil = 1;
    const mx = this.x+Math.cos(this.aim)*26, my = this.y+Math.sin(this.aim)*26;
    const n = CFG.BOSS_PELLETS + (this.phase===3 ? 2 : 0);
    for (let i=0;i<n;i++) {
      const a = this.aim + (i/(n-1) - 0.5) * CFG.BOSS_SPREAD_ARC;
      Game.bullets.push(new Bullet(mx,my,a,CFG.ENEMY_BULLET_SPEED*0.92,this.dmg,false));
    }
    Game.spawnMuzzle(mx,my,this.aim);
    Camera.addShake(3);
    Audio.enemyShot();
    this._blastCd = true;     // stretch the follow-up cooldown (set after shoot in Enemy.update)
  }

  update(dt, player) {
    // Lasso barely holds him.
    if (this.stun > 0.45) this.stun = 0.45;

    // Phase transitions — roar, shake, call Rattlebone reinforcements.
    const ph = this.currentPhase();
    if (ph !== this.phase) {
      this.phase = ph;
      Camera.addShake(10);
      Audio.explosion();
      for (let i=0;i<CFG.BOSS_SUMMON_N;i++) {
        const e = new Enemy(clamp(this.x+rand(-120,120),100,CFG.WORLD_W-100),
                            clamp(this.y+rand(-120,120),100,CFG.WORLD_H-100), 'bandit');
        e.missionTag = this.missionTag;
        Game.enemies.push(e);
      }
      Game.flashMsg(ph===2
        ? 'Benny: "RATTLEBONES! Earn your damn keep!"'
        : 'Benny\'s eyes go black as tar. That ain\'t just Benny anymore.');
    }

    // Mid-charge: barrel along, contact hit, ignore normal AI.
    if (this.charging > 0) {
      this.charging -= dt;
      this.vx = Math.cos(this.chargeAng)*CFG.BOSS_CHARGE_SPEED;
      this.vy = Math.sin(this.chargeAng)*CFG.BOSS_CHARGE_SPEED;
      this.x += this.vx*dt; this.y += this.vy*dt;
      this.walkCycle += dt*16;
      if (Math.random()<0.7) Game.particles.push(new Particle(this.x,this.y+8,rand(-30,30),rand(-50,-10),0.35,'rgba(150,120,80,0.5)',5));
      if (!this.chargeHit && !player.dead && dist(this.x,this.y,player.x,player.y) < this.r+player.r+4) {
        this.chargeHit = true;
        player.takeDamage(CFG.BOSS_CHARGE_DMG * DIFFICULTY[Game.difficulty].dmg);
        player.vx += Math.cos(this.chargeAng)*520; player.vy += Math.sin(this.chargeAng)*520;
        Camera.addShake(8);
      }
      this.resolveCollisions();
      this.x = clamp(this.x, this.r, CFG.WORLD_W-this.r);
      this.y = clamp(this.y, this.r, CFG.WORLD_H-this.r);
      if (this.recoil>0) this.recoil=Math.max(0,this.recoil-dt*6);
      if (this.hurtFlash>0) this.hurtFlash-=dt;
      return;
    }
    // Charge windup: plant feet and stomp — the player's cue to sidestep.
    if (this.chargeWind > 0) {
      this.chargeWind -= dt;
      this.aim = angTo(this.x,this.y,player.x,player.y);   // tracks until launch
      this.vx *= Math.exp(-8*dt); this.vy *= Math.exp(-8*dt);
      if (Math.floor(this.chargeWind*10)%2===0) Camera.addShake(1.5);
      if (this.chargeWind <= 0) {
        this.charging = CFG.BOSS_CHARGE_TIME;
        this.chargeAng = this.aim;
        this.chargeHit = false;
        Audio.lasso();
      }
      if (this.hurtFlash>0) this.hurtFlash-=dt;
      return;
    }

    super.update(dt, player);
    if (this._blastCd) { this.fireTimer *= CFG.BOSS_FIRE_MULT; this._blastCd = false; }

    const engaged = this.state==='attack' || this.state==='chase';
    const dP = dist(this.x,this.y,player.x,player.y);

    // Phase 2+: dynamite lob when the player keeps their distance.
    if (this.phase >= 2 && engaged && !player.dead) {
      this.dynTimer -= dt;
      if (this.dynTimer <= 0 && dP > CFG.BOSS_DYN_MIN_DIST) {
        this.dynTimer = CFG.BOSS_DYN_COOLDOWN;
        const a = angTo(this.x,this.y,player.x,player.y);
        Game.dynamites.push(new Dynamite(this.x,this.y,a,clamp(dP*1.55,240,CFG.DYN_THROW_SPEED+80)));
        Game.flashMsg('Benny hurls a hissing stick of dynamite!');
      }
    }
    // Phase 3: shoulder charge on cooldown.
    if (this.phase === 3 && engaged && !player.dead && this.stun<=0) {
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0 && dP > 90 && dP < 520) {
        this.chargeTimer = CFG.BOSS_CHARGE_COOLDOWN;
        this.chargeWind = CFG.BOSS_CHARGE_WINDUP;
      }
    }
  }

  render(ctx, ox, oy) {
    const tx=this.x-ox, ty=this.y-oy;
    // Big shadow
    ctx.fillStyle='rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(tx,ty+14,19,8,0,0,TAU); ctx.fill();
    // Phase-3 demon aura
    if (this.phase===3) {
      ctx.save(); ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha = 0.28 + 0.14*Math.sin(Game.time*7);
      const g=ctx.createRadialGradient(tx,ty,4,tx,ty,42);
      g.addColorStop(0,'#a02a2a'); g.addColorStop(1,'rgba(120,20,20,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(tx,ty,42,0,TAU); ctx.fill();
      ctx.restore();
    }
    // Charge tell — stomping dust + a warning line along the charge path
    if (this.chargeWind>0) {
      const c = 1 - this.chargeWind/CFG.BOSS_CHARGE_WINDUP;
      ctx.save();
      ctx.globalAlpha = 0.3 + c*0.5;
      ctx.strokeStyle='#ff7a3a'; ctx.lineWidth=3; ctx.setLineDash([10,7]);
      ctx.beginPath(); ctx.moveTo(tx,ty);
      ctx.lineTo(tx+Math.cos(this.aim)*(120+c*260), ty+Math.sin(this.aim)*(120+c*260)); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
    // The man himself — a bandit drawn 1.45× with a bone-white duster.
    ctx.save();
    ctx.translate(tx,ty); ctx.scale(1.45,1.45); ctx.translate(-tx,-ty);
    drawBandit(ctx, tx, ty, this.aim, this.recoil, this.walkCycle, this.hurtFlash>0,
      this.phase===3 ? {coat:'#6a2020', hat:'#141010', skin:'#c8b8a8'}
                     : {coat:'#5a4a3a', hat:'#1a1410', skin:'#c0a080'});
    ctx.restore();
    // Bone bandolier + skull pin (reads "Rattlebone king" at a glance)
    ctx.save();
    ctx.strokeStyle='#ddd2b0'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(tx-12,ty-8); ctx.lineTo(tx+12,ty+10); ctx.stroke();
    ctx.fillStyle='#e8dec0'; ctx.beginPath(); ctx.arc(tx+9,ty-16,4,0,TAU); ctx.fill();
    ctx.restore();
    // Windup aim tell (same language as regular enemies, thicker)
    if (this.windup>0) {
      const charge = 1 - this.windup/CFG.ENEMY_WINDUP;
      ctx.save();
      ctx.globalAlpha = 0.35 + charge*0.45;
      ctx.strokeStyle='#ff5a3a'; ctx.lineWidth=2.5; ctx.setLineDash([6,5]);
      const len = 40 + charge*CFG.ENEMY_SHOOT_RANGE*0.5;
      ctx.beginPath(); ctx.moveTo(tx,ty);
      ctx.lineTo(tx+Math.cos(this.aim)*len, ty+Math.sin(this.aim)*len); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
    // Roped/stunned stars (briefly — he shrugs the rope fast)
    if (this.stun>0) {
      ctx.save(); ctx.fillStyle='#e8d56a'; ctx.font='12px Georgia'; ctx.textAlign='center';
      for (let i=0;i<3;i++){ const a=Game.time*6 + i*TAU/3; ctx.fillText('★', tx+Math.cos(a)*11, ty-38+Math.sin(a)*4); }
      ctx.restore();
    }
    // Name tag (big HP bar lives in the HUD)
    ctx.fillStyle='rgba(20,10,6,0.75)'; ctx.font='bold 11px Georgia'; ctx.textAlign='center';
    const w=ctx.measureText('BUCKSHOT BENNY').width+10;
    ctx.fillRect(tx-w/2, ty-52, w, 15);
    ctx.fillStyle='#e8c8a0'; ctx.fillText('BUCKSHOT BENNY', tx, ty-41);
  }
}

class Townsfolk {
  constructor(x,y) {
    this.x=x; this.y=y; this.r=12; this.dead=false;
    this.path=[]; this.t=0; this.target={x,y};
    this.color = ['#6a5a45','#5a4a3a','#7a6a55','#4a5a4a'][randInt(0,3)];
    this.walkCycle=0; this.aim=0; this.fleeing=false;
  }
  newTarget() {
    this.target = { x: clamp(this.x+rand(-200,200),TOWN_CX-420,TOWN_CX+420),
                    y: clamp(this.y+rand(-200,200),TOWN_CY-420,TOWN_CY+420) };
  }
  update(dt, player) {
    if (this.fleeing) {
      this.aim = angTo(player.x,player.y,this.x,this.y);
    } else {
      this.t -= dt;
      if (this.t<=0 || dist(this.x,this.y,this.target.x,this.target.y)<20) { this.newTarget(); this.t=rand(2,5); }
      this.aim = angTo(this.x,this.y,this.target.x,this.target.y);
    }
    const spd = this.fleeing?150:48;
    this.x += Math.cos(this.aim)*spd*dt;
    this.y += Math.sin(this.aim)*spd*dt;
    this.walkCycle += dt*7;
  }
  takeDamage(d){ this.dead=true; Game.spawnImpact(this.x,this.y,'blood'); Wanted.onCivilianKilled(); Audio.hit(); }
  render(ctx,ox,oy){
    const tx=this.x-ox,ty=this.y-oy;
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(tx,ty+10,11,5,0,0,TAU); ctx.fill();
    drawTownsfolk(ctx,tx,ty,this.aim,this.walkCycle,this.color);
  }
}

class Horse {
  constructor(x,y) { this.x=x; this.y=y; this.aim=0; this.ridden=false; this.summoning=false; }
  update(dt) {
    // Horse-whistle: gallop toward the player until close, kicking up dust.
    if (this.ridden || !this.summoning) return;
    const p = Game.player;
    if (dist(this.x,this.y,p.x,p.y) < 46) { this.summoning=false; return; }   // stops within mount range
    const a = angTo(this.x,this.y,p.x,p.y); this.aim=a;
    this.x += Math.cos(a)*CFG.WHISTLE_GALLOP*dt;
    this.y += Math.sin(a)*CFG.WHISTLE_GALLOP*dt;
    if (Math.random()<0.6) Game.particles.push(new Particle(this.x,this.y+6,rand(-25,25),rand(-8,8),0.4,'rgba(150,130,90,0.5)',4));
  }
  renderBody(ctx, tx, ty) {
    // Drawn beneath the rider when mounted, or standalone when idle.
    ctx.save();
    ctx.translate(tx,ty);
    ctx.rotate(this.aim);
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0,8,30,12,0,0,TAU); ctx.fill();
    ctx.fillStyle='#3a2817';
    ctx.beginPath(); ctx.ellipse(0,0,30,15,0,0,TAU); ctx.fill();    // body
    ctx.fillStyle='#2e2012';
    ctx.beginPath(); ctx.ellipse(26,-2,12,8,0,0,TAU); ctx.fill();   // head/neck
    ctx.fillStyle='#1c130a';
    ctx.fillRect(-26,-2,8,4);  // tail base
    ctx.restore();
  }
  render(ctx,ox,oy){ // standalone idle horse
    if (this.ridden) return;
    const tx=this.x-ox, ty=this.y-oy;
    this.renderBody(ctx,tx,ty);
    // Saddle marker
    ctx.fillStyle='#6a4a28';
    ctx.beginPath(); ctx.arc(tx,ty,6,0,TAU); ctx.fill();
  }
}

/* ---------------------------------------------------------------------------
   PROCEDURAL CHARACTER ART
   --------------------------------------------------------------------------- */
function drawGunslinger(ctx, x, y, aim, recoil, walk, hurt, mounted) {
  ctx.save();
  ctx.translate(x, y);
  const bob = mounted ? 0 : Math.sin(walk)*1.5;
  ctx.translate(0, bob);

  // Long coat (body)
  ctx.fillStyle = hurt ? '#b86a4a' : '#6b4a2a';
  ctx.beginPath(); ctx.ellipse(0, 2, 13, 16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = hurt ? '#a85a3a' : '#553a20';
  ctx.beginPath(); ctx.ellipse(0, 6, 11, 12, 0, 0, TAU); ctx.fill();

  // Arm + revolver pointing toward aim
  const recoilKick = recoil * 4;
  const gx = Math.cos(aim) * (20 - recoilKick);
  const gy = Math.sin(aim) * (20 - recoilKick);
  ctx.strokeStyle = hurt ? '#b86a4a' : '#4a3320';
  ctx.lineWidth = 7; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(0,2); ctx.lineTo(gx,gy); ctx.stroke();
  // Revolver
  ctx.save();
  ctx.translate(gx, gy); ctx.rotate(aim);
  ctx.fillStyle='#2a2a2e';
  ctx.fillRect(0,-2.5,14,5);
  ctx.fillStyle='#1a1a1e';
  ctx.fillRect(-2,1,5,7);  // grip
  ctx.restore();

  // Head + hat
  ctx.fillStyle = hurt ? '#e0a080' : '#c89a72';
  ctx.beginPath(); ctx.arc(0,-2,8,0,TAU); ctx.fill();
  // Hat brim
  ctx.fillStyle='#2a1d10';
  ctx.beginPath(); ctx.ellipse(0,-4,14,6,0,0,TAU); ctx.fill();
  ctx.fillStyle='#3a2a18';
  ctx.beginPath(); ctx.ellipse(0,-7,8,6,0,0,TAU); ctx.fill();
  ctx.restore();
}

function drawBandit(ctx, x, y, aim, recoil, walk, hurt, pal) {
  ctx.save();
  ctx.translate(x,y);
  ctx.translate(0, Math.sin(walk)*1.5);
  ctx.fillStyle = hurt ? '#d88' : pal.coat;
  ctx.beginPath(); ctx.ellipse(0,2,12,15,0,0,TAU); ctx.fill();
  // arm + gun
  const gx=Math.cos(aim)*(18-recoil*3), gy=Math.sin(aim)*(18-recoil*3);
  ctx.strokeStyle = hurt? '#d88' : pal.coat;
  ctx.lineWidth=6; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(0,2); ctx.lineTo(gx,gy); ctx.stroke();
  ctx.save(); ctx.translate(gx,gy); ctx.rotate(aim);
  ctx.fillStyle='#222'; ctx.fillRect(0,-2,11,4); ctx.restore();
  // head + hat
  ctx.fillStyle = hurt ? '#f0b090' : pal.skin;
  ctx.beginPath(); ctx.arc(0,-2,7,0,TAU); ctx.fill();
  ctx.fillStyle = pal.hat;
  ctx.beginPath(); ctx.ellipse(0,-4,12,5,0,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,-7,7,5,0,0,TAU); ctx.fill();
  ctx.restore();
}

function drawTownsfolk(ctx, x, y, aim, walk, color) {
  ctx.save(); ctx.translate(x,y);
  ctx.translate(0, Math.sin(walk)*1.2);
  ctx.fillStyle=color;
  ctx.beginPath(); ctx.ellipse(0,2,10,13,0,0,TAU); ctx.fill();
  ctx.fillStyle='#c89a72';
  ctx.beginPath(); ctx.arc(0,-3,6,0,TAU); ctx.fill();
  ctx.fillStyle='#3a2a1a';
  ctx.beginPath(); ctx.ellipse(0,-5,8,4,0,0,TAU); ctx.fill();
  ctx.restore();
}

/* ---------------------------------------------------------------------------
   8. COLLISION HELPERS  (used by Game / bullets / AI line of sight)
   --------------------------------------------------------------------------- */
// (circleRect defined above; Game.hitsSolid + lineOfSight below.)
