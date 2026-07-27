"use strict";
/* Redemption's Edge — game.js
   Part of the modular build. Loaded as a classic <script> in index.html (order matters).
   See docs/ROADMAP.md for the project map. */

/* ---------------------------------------------------------------------------
   10. GAME CONTROLLER
   --------------------------------------------------------------------------- */
const Game = {
  state: STATE.START,
  player: null,
  enemies: [], bullets: [], particles: [], pickups: [], floats: [], townsfolk: [], horses: [],
  dynamites: [], explosions: [],
  time: 0,
  dayPhase: 0,        // 0..1 cycles for subtle lighting shift
  nightForce: 0,      // 0..1 eased override pulling the sky to night (M9 missions)
  nightTarget: 0,     // where nightForce is easing toward
  demonTimer: 0,      // cooldown between wild demon spawns
  msg: '', msgTimer: 0,
  interactPrompt: null,
  score: 0, kills: 0,
  difficulty: 'normal',   // 'easy' | 'normal' | 'hard' — chosen on the start screen
  diff() { return DIFFICULTY[this.difficulty]; },

  init() {
    generateScenery();
    generateProps();
    generateDecals();
    this.reset();
  },

  reset() {
    resetSecrets();   // re-hide buried caches for a fresh run
    for (const b of STRUCTURES) b.looted = false;   // re-lock pickable doors
    this._hadLaw = false;                            // manhunt bookkeeping
    this.nightForce = 0; this.nightTarget = 0; this.demonTimer = 0;
    // M13: heist state — idle | cracking | carrying (+ restock cooldown)
    this.heist = { state:'idle', t:0, take:0, cooldown:0, stalled:false };
    // Chris King starts at Darryl's camp — somewhere to belong before Hicksville judges him.
    this.player = new Player(CAMP_CX, CAMP_CY + 130);
    this.enemies = []; this.bullets = []; this.particles = [];
    this.pickups = []; this.floats = []; this.townsfolk = []; this.horses = [];
    this.dynamites = []; this.explosions = [];
    this.kills = 0; this.score = 0; this.time = 0;
    Wanted.clear();
    Honor.reset();
    Missions.reset();
    Camera.x = clamp(this.player.x - CFG.VIEW_W/2, 0, CFG.WORLD_W-CFG.VIEW_W);
    Camera.y = clamp(this.player.y - CFG.VIEW_H/2, 0, CFG.WORLD_H-CFG.VIEW_H);

    // Spawn bandits in the badlands around the town (Tier 1: 5–8 + a couple enforcers).
    const spots = [
      [TOWN_CX+900, TOWN_CY-300], [TOWN_CX+1200, TOWN_CY+400],
      [TOWN_CX-1000, TOWN_CY+200], [TOWN_CX-700, TOWN_CY-900],
      [TOWN_CX+500, TOWN_CY+1100], [TOWN_CX-1300, TOWN_CY-300],
      [TOWN_CX+1500, TOWN_CY-700], [TOWN_CX-400, TOWN_CY+1400],
    ];
    spots.forEach((s,i) => {
      const kind = (i % 4 === 3) ? 'enforcer' : 'bandit';
      this.enemies.push(new Enemy(clamp(s[0],100,CFG.WORLD_W-100), clamp(s[1],100,CFG.WORLD_H-100), kind));
    });

    // Wagon circle ambush — a couple of bandits holed up out in the flats.
    for (let i=0;i<2;i++) this.enemies.push(new Enemy(LANDMARK_POS.wagons.x+rand(-90,90), LANDMARK_POS.wagons.y+rand(-90,90), 'bandit'));

    // M9: demons are night creatures now — the wild packs rise via
    // updateNightDemons() when the light goes cool, and ash out at dawn.

    // Townsfolk wandering the square.
    for (let i=0;i<5;i++) this.townsfolk.push(new Townsfolk(TOWN_CX+rand(-300,300), TOWN_CY+rand(-300,300)));

    // Horses near the stable + one in the wild.
    this.horses.push(new Horse(CAMP_CX+170, CAMP_CY+30));   // saddled at camp
    this.horses.push(new Horse(TOWN_CX+520, TOWN_CY+150));  // hitched at the Broken Spur stable
  },

  // --- World queries -------------------------------------------------------
  hitsSolid(x,y) {
    for (const b of STRUCTURES) if (x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h) return true;
    for (const f of FENCES) if (x>f.x&&x<f.x+f.w&&y>f.y&&y<f.y+f.h) return true;
    for (const s of SCENERY) { if (s.solid && dist2(x,y,s.x,s.y) < (s.r*0.7)*(s.r*0.7)) return true; }
    for (const p of PROPS) { if (p.solid && dist2(x,y,p.x,p.y) < (p.r*0.8)*(p.r*0.8)) return true; }
    return false;
  },
  // Sample a few points along the segment to approximate line of sight.
  lineOfSight(x1,y1,x2,y2) {
    const steps = 14;
    for (let i=1;i<steps;i++) {
      const t=i/steps;
      if (this.hitsSolid(lerp(x1,x2,t), lerp(y1,y2,t))) return false;
    }
    return true;
  },
  // Is the player laying low at Darryl's camp? (Manhunt safe haven.)
  playerInCamp() { return dist(this.player.x, this.player.y, CAMP_CX, CAMP_CY) < CFG.CAMP_SAFE_RADIUS; },
  // The haunted flats — everything beyond the town's reach. The law won't follow. (M9)
  playerInHauntedFlats() { return dist(this.player.x, this.player.y, TOWN_CX, TOWN_CY) > CFG.HAUNTED_RADIUS; },
  // Single source of day/night truth: the natural cycle, blended toward forced
  // night when a mission pulls the sky dark (nightTarget eases, never snaps).
  warmth() {
    const nat = Math.sin(this.dayPhase*TAU)*0.5+0.5;
    return lerp(nat, 0.06, this.nightForce);
  },
  isNight() { return this.warmth() < 0.30; },

  // --- Spawners / FX -------------------------------------------------------
  spawnMuzzle(x,y,ang) {
    for (let i=0;i<6;i++) {
      const a = ang + rand(-0.4,0.4);
      const sp = rand(60,220);
      this.particles.push(new Particle(x,y,Math.cos(a)*sp,Math.sin(a)*sp,rand(0.05,0.15),
        i<3?'#fff3b0':'#ff9a3c', rand(2,5)));
    }
    // Brief flash sprite handled at render via particle; add light puff smoke.
    this.particles.push(new Particle(x,y,Math.cos(ang)*30,Math.sin(ang)*30,0.3,'rgba(120,110,90,0.5)',7));
  },
  spawnImpact(x,y,kind) {
    const col = kind==='blood' ? ['#9a1a1a','#6a1010'] : ['#9a8050','#6a5230'];
    for (let i=0;i<8;i++) {
      const a=rand(0,TAU), sp=rand(40,180);
      this.particles.push(new Particle(x,y,Math.cos(a)*sp,Math.sin(a)*sp,rand(0.2,0.5),
        col[randInt(0,1)], rand(2,5), 60));
    }
    // M6: cartoon hit-pop
    if (CFG.FX_IMPACT) this.particles.push(new HitSpark(x, y, 10, kind==='blood' ? '#ffd8a0' : '#fff0c0'));
  },
  // Dynamite detonation — radial damage + knockback, applied once. (Milestone 1)
  spawnExplosion(x,y) {
    this.explosions.push(new Explosion(x,y));
    Camera.addShake(15);
    Audio.explosion();
    const R = CFG.DYN_RADIUS;
    // Fire + dirt burst
    for (let i=0;i<26;i++) {
      const a=rand(0,TAU), sp=rand(80,420);
      this.particles.push(new Particle(x,y,Math.cos(a)*sp,Math.sin(a)*sp,rand(0.25,0.7),
        i<14?(i<7?'#fff0c0':'#ff8a2c'):'#7a5230', rand(3,7), 40));
    }
    // Enemies in range
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist(x,y,e.x,e.y);
      if (d < R + e.r) {
        const f = clamp(1 - d/R, 0.15, 1);
        e.applyKnockback(angTo(x,y,e.x,e.y), CFG.DYN_KNOCKBACK*f);
        e.takeDamage(CFG.DYN_DMG*f + 15);
        this.floats.push(new FloatText(e.x, e.y-16, ''+Math.round(CFG.DYN_DMG*f), '#ff8a3a'));
      }
    }
    // Townsfolk in range (lethal — big honor/wanted hit)
    for (const t of this.townsfolk) {
      if (!t.dead && dist(x,y,t.x,t.y) < R) t.takeDamage(999);
    }
    // The player isn't immune to their own dynamite (unless mid-dodge).
    const p = this.player;
    if (!p.dead) {
      const dp = dist(x,y,p.x,p.y);
      if (dp < R) {
        const f = clamp(1 - dp/R, 0, 1);
        p.takeDamage(f*55);
        p.vx += Math.cos(angTo(x,y,p.x,p.y))*CFG.DYN_KNOCKBACK*f;
        p.vy += Math.sin(angTo(x,y,p.x,p.y))*CFG.DYN_KNOCKBACK*f;
      }
    }
    // Dynamite can blast the collapsed mine open (M2→M3 bridge).
    for (const lm of LANDMARKS) {
      if (lm.type==='mine' && !lm.opened && dist(x,y,lm.x,lm.y) < R+30) {
        lm.opened = true;
        this.pickups.push(new Pickup(lm.x+rand(-20,20), lm.y+40, 'money'));
        this.pickups.push(new Pickup(lm.x+rand(-20,20), lm.y+40, 'dynamite'));
        this.flashMsg('You blast the mine open! Old tunnels yawn into the dark...');
        Missions.onMineOpened();
      }
    }
    // Loud crime if it goes off in town.
    if (Wanted.inTown(x,y)) Wanted.add(0.6);
  },

  spawnLawman(player) {
    // Lawmen converge from off-screen on the search zone (or on you, if you're in the open).
    const c = Wanted.searching ? Wanted.lastSeen : player;
    const a = rand(0,TAU), d = 740;
    let sx = clamp(c.x + Math.cos(a)*d, 80, CFG.WORLD_W-80);
    let sy = clamp(c.y + Math.sin(a)*d, 80, CFG.WORLD_H-80);
    const law = new Enemy(sx, sy, 'lawman');
    law.state='chase'; law.home={x:Wanted.lastSeen.x, y:Wanted.lastSeen.y};
    this.enemies.push(law);
  },

  // --- M9: wild demons rise in the haunted flats at night, ash at dawn -----
  updateNightDemons(dt) {
    this.demonTimer -= dt;
    if (this.isNight()) {
      const wild = this.enemies.filter(e => e.kind==='demon' && !e.dead && !e.missionTag).length;
      if (this.demonTimer <= 0 && wild < CFG.DEMON_NIGHT_MAX) {
        this.demonTimer = CFG.DEMON_SPAWN_COOLDOWN;
        this.spawnNightDemon();
      }
    } else {
      // Dawn takes them back — no loot, no score, just a puff of ash.
      for (const e of this.enemies) {
        if (e.kind!=='demon' || e.dead || e.missionTag) continue;
        e.dead = true;
        for (let i=0;i<10;i++) this.particles.push(new Particle(e.x+rand(-8,8), e.y+rand(-10,4),
          rand(-30,30), rand(-60,-10), rand(0.4,0.9), 'rgba(120,70,40,0.6)', rand(2,5)));
      }
    }
  },
  spawnNightDemon() {
    for (let tries=0; tries<12; tries++) {
      const x = rand(150, CFG.WORLD_W-150), y = rand(150, CFG.WORLD_H-150);
      if (dist(x,y,TOWN_CX,TOWN_CY) < CFG.HAUNTED_RADIUS) continue;   // the flats only
      if (dist(x,y,CAMP_CX,CAMP_CY) < 620) continue;                  // camp stays safe
      if (dist(x,y,this.player.x,this.player.y) < 520) continue;      // never on top of Chris
      if (this.hitsSolid(x,y)) continue;
      this.enemies.push(new Enemy(x, y, 'demon'));
      return;
    }
  },

  onEnemyKilled(e) {
    this.kills++;
    // M6: KO starburst — bigger for bigger folk
    if (CFG.FX_IMPACT) this.particles.push(new HitSpark(e.x, e.y, e.kind==='boss'?34:18, '#ffe89a'));
    this.score += e.kind==='boss'?1000 : e.kind==='enforcer'?250 : e.kind==='demon'?150 : e.kind==='lawman'?150 : 100;
    this.player.deadeye = Math.min(CFG.DEADEYE_MAX, this.player.deadeye + CFG.DEADEYE_GAIN_KILL);  // fills Dead Eye
    if (e.kind==='lawman') { Wanted.onLawmanKilled(); Honor.onLawmanKilled(); }
    if (e.kind==='demon') Honor.onDemonKilled();
    Missions.onEnemyKilled(e);
    // A boss goes out with a bang — money burst + dynamite, and a proper blast.
    if (e.kind==='boss') {
      Camera.addShake(12);
      for (let i=0;i<4;i++) this.pickups.push(new Pickup(e.x+rand(-40,40), e.y+rand(-40,40), 'money'));
      for (let i=0;i<2;i++) this.pickups.push(new Pickup(e.x+rand(-30,30), e.y+rand(-30,30), 'dynamite'));
      this.floats.push(new FloatText(e.x, e.y-26, '+1000', '#ffde7a'));
      return;
    }
    // Loot drops
    if (Math.random()<0.78) this.pickups.push(new Pickup(e.x+rand(-10,10), e.y+rand(-10,10), Math.random()<0.5?'ammo':'money'));
    if (e.kind==='enforcer') this.pickups.push(new Pickup(e.x+rand(-14,14), e.y+rand(-14,14), 'money'));
    if (Math.random()<0.22) this.pickups.push(new Pickup(e.x+rand(-12,12), e.y+rand(-12,12), 'dynamite'));  // occasional sticks
    if (e.kind==='lawman' && Math.random()<0.55) this.pickups.push(new Pickup(e.x+rand(-12,12), e.y+rand(-12,12), 'bribe'));  // lawmen drop bribe tokens
    this.floats.push(new FloatText(e.x, e.y-20, e.kind==='enforcer'?'+250':e.kind==='demon'?'+150':'+100', '#e8d56a'));
    // Spawn a fresh bandit elsewhere occasionally to keep the world alive.
    // Gang cap scales with difficulty (more enemies on Normal/Hard).
    // (Demons don't count — the night spawner owns their numbers.)
    const cap = Math.round(9 * this.diff().count);
    if (e.kind!=='lawman' && e.kind!=='demon' && this.enemies.filter(x=>x.kind!=='lawman').length < cap && Math.random()<0.65) {
      const a=rand(0,TAU), d=rand(1100,1600);
      const nx=clamp(this.player.x+Math.cos(a)*d,100,CFG.WORLD_W-100);
      const ny=clamp(this.player.y+Math.sin(a)*d,100,CFG.WORLD_H-100);
      this.enemies.push(new Enemy(nx,ny, Math.random()<0.25?'enforcer':'bandit'));
    }
  },

  flashMsg(t) { this.msg=t; this.msgTimer=2.5; },

  // --- Interaction at building doors --------------------------------------
  checkInteraction() {
    this.interactPrompt = null;
    const p = this.player;
    // Mission interactions take priority (Darryl talk, wagon search, mine descent…)
    const mi = Missions.getInteract(p);
    if (mi) {
      this.interactPrompt = { label: mi.label };
      if (Input.hit('e')) mi.act();
      return;
    }
    for (const b of STRUCTURES) {
      if (b.action==='none') continue;
      if (dist(p.x,p.y,b.door.x,b.door.y) < 55) {
        this.interactPrompt = b;
        if (Input.hit('e')) this.doInteraction(b);
        return;
      }
    }
    // Interactable landmarks (shrine, mine)
    for (const lm of LANDMARKS) {
      if (!lm.action) continue;
      if (dist(p.x,p.y,lm.x,lm.y) < 72) {
        this.interactPrompt = { label: (lm.action==='mine'&&lm.opened) ? 'Mine shaft — dark and deep (more soon)' : lm.label };
        if (Input.hit('e')) this.doLandmark(lm);
        return;
      }
    }
    // Buried caches — dig with [E]
    for (const sc of SECRETS) {
      if (sc.found) continue;
      if (dist(p.x,p.y,sc.x,sc.y) < 46) {
        this.interactPrompt = { label:'Open the strongbox' };
        if (Input.hit('e')) this.digSecret(sc);
        return;
      }
    }
    // Wanted board
    if (dist(p.x,p.y,WANTED_BOARD.x,WANTED_BOARD.y) < 56) {
      this.interactPrompt = { label:'Read the wanted board' };
      if (Input.hit('e')) this.readBoard();
      return;
    }
    // Horse mounting
    if (!p.mounted) {
      for (const h of this.horses) {
        if (!h.ridden && dist(p.x,p.y,h.x,h.y) < 55) {
          this.interactPrompt = { mount:true };
          if (Input.hit('e')) { p.mounted=h; h.ridden=true; Audio.click(); this.flashMsg('Mounted horse — press E to dismount'); }
          return;
        }
      }
    } else {
      // Allow dismount anywhere
      this.interactPrompt = { dismount:true };
      if (Input.hit('e')) {
        p.mounted.ridden=false; p.mounted.x=p.x+30; p.mounted.y=p.y;
        p.mounted=null; Audio.click();
      }
    }
  },

  doInteraction(b) {
    const p = this.player;
    Audio.click();
    if (b.action==='rest') {
      if (p.money>=10 && p.hp<CFG.PLAYER_MAX_HP) { p.money-=10; p.hp=CFG.PLAYER_MAX_HP; this.flashMsg('Whiskey and a bunk at the Leaning Saloon. Patched up.'); }
      else if (p.hp>=CFG.PLAYER_MAX_HP) this.flashMsg('You ain’t hurt. Barkeep waves you off.');
      else this.flashMsg('Barkeep: "No coin, no cot." ($10)');
    } else if (b.action==='camp') {
      // M13: carrying the strongbox? Darryl fences it first, questions never.
      if (this.heist.state==='carrying') {
        const take = this.heist.take;
        p.money += take; this.score += take;
        Honor.add(CFG.HEIST_HONOR, true);
        this.heist.state='idle'; this.heist.t=0; this.heist.cooldown=CFG.HEIST_COOLDOWN;
        this.floats.push(new FloatText(p.x, p.y-30, '+$'+take, '#ffde7a'));
        Audio.money();
        this.flashMsg(`Darryl pries the strongbox open: +$${take}. "The BANK, Chris?! The whole— ...that's a real nice haul."`);
        return;
      }
      // Darryl's camp — free full heal + ammo top-up. Your home base.
      p.hp=CFG.PLAYER_MAX_HP; this.giveAmmo(CFG.CYLINDER);
      this.flashMsg('Darryl: "Sit by the fire, ya idiot. Patched and loaded."');
    } else if (b.action==='store') {
      // M11: prices follow your name. Outlaws get the door.
      if (Honor.tier()==='OUTLAW') {
        this.flashMsg('The clerk backs into the shelves: "W-we don\'t serve your kind. T-try the undertaker..."');
      } else {
        const cost = Honor.ammoPrice();
        if (p.money>=cost) { p.money-=cost; this.giveAmmo(6); this.flashMsg(`Lucky Tooth: bought 6 rounds ($${cost}).`); }
        else this.flashMsg(`Lucky Tooth clerk: "${cost} dollars or get out." ($${cost})`);
      }
    } else if (b.action==='sheriff') {
      const cost = Wanted.level*40;
      if (Wanted.level===0) this.flashMsg('Sheriff Crook: "Nothin’ on you... yet."');
      else if (p.money>=cost) { p.money-=cost; Wanted.clear(); this.flashMsg('Bounty paid off. Crook pockets it and looks away.'); }
      else this.flashMsg(`Crook: "Your bounty's $${cost}. Come back with it."`);
    } else if (b.action==='bank') {
      // M13: THE HICKSVILLE HEIST — a timed vault crack, not a smash-and-grab.
      const H = this.heist;
      if (H.state==='carrying') { this.flashMsg('The strongbox is under your arm. RIDE — Darryl\'s camp, before the county arrives!'); return; }
      if (H.cooldown>0) { this.flashMsg('The vault sits empty behind a shiny new lock. Give the bank time to restock.'); return; }
      if (H.state==='cracking') { this.flashMsg('The drill\'s already chewing. Keep the law off it!'); return; }
      H.state='cracking'; H.t=0; H.stalled=false;
      Wanted.add(2);
      for (let i=0;i<2;i++) this.spawnLawman(p);
      Camera.addShake(6);
      this.flashMsg('You put the drill to the vault — the alarm bell ROARS. Hold the lobby while it chews!');
    } else if (b.action==='chapel' || b.action==='lockdoor') {
      // Lockpick tool opens these for loot (M3).
      if (b.looted) {
        // M11: once the undertaker's been burgled, an OUTLAW finds him... flexible.
        if (b.action==='lockdoor' && Honor.tier()==='OUTLAW') {
          if (p.money>=6) { p.money-=6; this.giveAmmo(6);
            this.flashMsg('The undertaker slides a box of shells across a coffin lid. No questions asked. ($6)'); }
          else this.flashMsg('Undertaker: "Six dollars. Even the damned pay up front."');
          return;
        }
        this.flashMsg(b.action==='chapel' ? 'The cellar yawns open below.' : 'Already cleaned this one out.'); return;
      }
      if (!this.player.hasLockpick) { this.flashMsg('Locked tight. You’d need a lockpick.'); return; }
      b.looted = true;
      if (b.action==='lockdoor') Honor.add(-4, true);   // burgling the undertaker has witnesses somewhere
      const money = randInt(30,80);
      this.player.money += money; this.score += money; this.giveAmmo(4);
      let extra=''; if (Math.random()<0.6) { this.player.dynamite = Math.min(CFG.DYN_MAX, this.player.dynamite+2); extra=' + dynamite'; }
      this.pickups.push(new Pickup(b.door.x+rand(-14,14), b.door.y-20, 'money'));
      if (b.action==='chapel') {
        this.enemies.push(new Enemy(b.door.x, b.door.y-34, 'bandit'));   // something was hiding down there
        this.flashMsg(`Lockpicked the chapel cellar! +$${money}${extra} — and something lunges from the dark!`);
        Missions.onChapelOpened();
      } else {
        this.flashMsg(`Picked the lock: +$${money}, +4 ammo${extra}.`);
      }
    }
  },

  giveAmmo(n) {
    // Reserve ammo is abstracted: top up cylinder; surplus reloads instantly handled by R.
    this.player.ammo = Math.min(CFG.CYLINDER, this.player.ammo + n);
  },

  // --- M13: the heist clock -------------------------------------------------
  updateHeist(dt) {
    const H = this.heist, p = this.player;
    if (H.cooldown > 0) H.cooldown -= dt;
    const bank = STRUCTURES.find(b=>b.action==='bank');
    // The [E] prompt tells the truth about the vault's state.
    bank.label = H.state==='cracking' ? 'The drill is chewing — hold the lobby!'
               : H.state==='carrying' ? 'RIDE! Get the take to Darryl'
               : H.cooldown>0        ? 'Vault empty — restocking'
                                     : 'Crack the vault (raises HELL)';
    if (H.state !== 'cracking') return;

    const near = dist(p.x,p.y,bank.door.x,bank.door.y) < 110;
    if (near) {
      H.t += dt; H.stalled = false;
      // The alarm ratchets the county: heat climbs to 5 stars and the manhunt
      // pins to the bank — the existing spawner scales the waves off level.
      Wanted.heat = clamp(Wanted.heat + dt*CFG.HEIST_HEAT_RAMP, 0, CFG.WANTED_MAX);
      Wanted.level = Math.ceil(Wanted.heat - 1e-6);
      Wanted.searching = false;
      Wanted.lastSeen.x = p.x; Wanted.lastSeen.y = p.y;
    } else if (!H.stalled) {
      H.stalled = true;
      this.flashMsg('The drill stalls without a hand on it!');
    }
    if (H.t >= CFG.HEIST_CRACK_TIME) {
      H.state = 'carrying';
      H.take = randInt(CFG.HEIST_TAKE_MIN, CFG.HEIST_TAKE_MAX);
      Camera.addShake(8);
      Audio.money();
      this.flashMsg(`The vault swings open — $${H.take} in the strongbox! Ride it to Darryl\'s camp!`);
    }
  },

  // --- Milestone 2 interactions -------------------------------------------
  digSecret(sc) {
    sc.found = true;
    const p = this.player;
    const money = randInt(20,70), ammo = randInt(2,6);
    p.money += money; this.score += money; this.giveAmmo(ammo);
    let extra = '';
    if (Math.random()<0.5) { p.dynamite = Math.min(CFG.DYN_MAX, p.dynamite+2); extra = ' + 2 dynamite'; }
    Audio.money();
    // golden burst of coins/sparkle
    for (let i=0;i<14;i++){ const a=rand(0,TAU), s=rand(40,170); this.particles.push(new Particle(sc.x,sc.y-4,Math.cos(a)*s,Math.sin(a)*s,rand(0.3,0.7),i<8?'#ffe07a':'#caa14a',rand(3,6),140)); }
    this.floats.push(new FloatText(sc.x, sc.y-16, `Loot! +$${money}`, '#ffe07a'));
    this.flashMsg(`Cracked open a strongbox: +$${money}, +${ammo} ammo${extra}.`);
  },

  doLandmark(lm) {
    const p = this.player;
    Audio.click();
    if (lm.action==='shrine') {
      if (p.money>=5) { p.money-=5; p.hp=CFG.PLAYER_MAX_HP; Honor.add(2, true);
        this.flashMsg('You lay a coin on the bone shrine. The aches fade. (Healed)'); }
      else this.flashMsg('The bone shrine wants a coin ($5) for its blessing.');
    } else if (lm.action==='mine') {
      if (lm.opened) this.flashMsg('The shaft goes deep into the dark. (More to come.)');
      else this.flashMsg('Caved in solid. A stick of dynamite might clear it...');
    }
  },

  readBoard() {
    Audio.click();
    const b = Wanted.level>0 ? `Your bounty: $${Wanted.level*40} (${Wanted.level}★).  ` : 'No bounty on you — yet.  ';
    this.flashMsg(b + RUMORS[randInt(0,RUMORS.length-1)]);
    Missions.onBoardRead();
  },

  // --- Main update ---------------------------------------------------------
  update(dt) {
    if (this.state !== STATE.PLAY) return;
    this.time += dt;
    this.dayPhase = (this.time * 0.01) % 1;   // very slow cycle
    // Forced night (Mission V) eases in/out so the lighting never snaps.
    this.nightForce += clamp(this.nightTarget - this.nightForce, -dt*0.4, dt*0.4);
    this.updateNightDemons(dt);

    const p = this.player;
    p.update(dt);   // player always runs at real time (stays responsive)

    // Dead Eye slows the WORLD: enemies, their bullets & thrown dynamite crawl,
    // while the player and their shots stay at full speed.
    const sdt = dt * (p.deadeyeActive ? CFG.DEADEYE_TIMESCALE : 1);

    // Camera target = player, lead slightly toward aim/mouse for situational awareness.
    const leadX = p.x + Math.cos(p.aim)*60;
    const leadY = p.y + Math.sin(p.aim)*60;
    Camera.follow(lerp(p.x,leadX,0.4), lerp(p.y,leadY,0.4), dt);

    // Enemies + townsfolk run on slowed time during Dead Eye
    for (const e of this.enemies) e.update(sdt, p);
    for (const t of this.townsfolk) t.update(sdt, p);
    for (const h of this.horses) h.update(dt);   // summoned horse gallops in real time

    // Bullets + hit resolution (your shots fly at full speed; enemy lead crawls in Dead Eye)
    for (const b of this.bullets) {
      b.update(b.friendly ? dt : sdt);
      if (b.dead) continue;
      // All hit tests sweep the bullet's full frame travel (px,py -> x,y) so
      // fast shots can't skip over a target between frames on slow machines.
      if (b.friendly) {
        for (const e of this.enemies) {
          if (e.dead || e.submerged > 0) continue;   // can't shoot what's under the floor
          const rr = e.r + b.r;
          // Iso body forgiveness: the sprite's torso stands up-screen from the
          // feet circle, which in world space is the north-west diagonal. A
          // second circle up that diagonal makes visible body shots register.
          const k = CFG.ISO ? e.r * 1.7 : 0;
          if (segCircleHit(b.px,b.py,b.x,b.y,e.x,e.y,rr) ||
              (k && segCircleHit(b.px,b.py,b.x,b.y,e.x-k,e.y-k,rr*0.9))) {
            e.takeDamage(b.dmg);
            e.applyKnockback(Math.atan2(b.vy,b.vx), CFG.BULLET_KNOCKBACK);  // shove on hit
            b.dead=true;
            this.floats.push(new FloatText(e.x, e.y-14, ''+b.dmg, '#ffce5a'));
            break;
          }
        }
        if (!b.dead) for (const t of this.townsfolk) {
          if (t.dead) continue;
          if (segCircleHit(b.px,b.py,b.x,b.y,t.x,t.y,t.r+b.r)) { t.takeDamage(b.dmg); b.dead=true; break; }
        }
      } else {
        if (!p.dead && segCircleHit(b.px,b.py,b.x,b.y,p.x,p.y,p.r+b.r)) {
          p.takeDamage(b.dmg); b.dead=true;
        }
      }
    }

    // Dynamites + explosions (dynamite fuse also slows during Dead Eye)
    for (const dy of this.dynamites) dy.update(sdt);
    for (const ex of this.explosions) ex.update(dt);

    // Pickups
    for (const pk of this.pickups) {
      pk.update(dt);
      if (dist2(p.x,p.y,pk.x,pk.y) < (p.r+pk.r)*(p.r+pk.r)) {
        pk.dead=true;
        if (pk.kind==='ammo') { this.giveAmmo(pk.value); this.floats.push(new FloatText(p.x,p.y-24,`+${pk.value} ammo`,'#caa14a')); Audio.pickup(); }
        else if (pk.kind==='dynamite') { p.dynamite=Math.min(CFG.DYN_MAX, p.dynamite+pk.value); this.floats.push(new FloatText(p.x,p.y-24,`+${pk.value} dynamite`,'#e88a3a')); Audio.pickup(); }
        else if (pk.kind==='bribe') { Wanted.bribe(); this.floats.push(new FloatText(p.x,p.y-24,'Bribe — 1★ off','#e8c45a')); Audio.money(); }
        else { p.money+=pk.value; this.score+=pk.value; this.floats.push(new FloatText(p.x,p.y-24,`+$${pk.value}`,'#e8d56a')); Audio.money(); }
      }
    }

    // Townsfolk flee if player shooting nearby or wanted.
    for (const t of this.townsfolk) {
      t.fleeing = (Wanted.level>0 && dist(t.x,t.y,p.x,p.y)<300) || (p.fireTimer>0.25 && dist(t.x,t.y,p.x,p.y)<260);
    }

    for (const pt of this.particles) pt.update(dt);
    for (const f of this.floats) f.update(dt);

    Wanted.update(dt, p);
    this.updateHeist(dt);   // after Wanted so the alarm out-shouts the cooldown
    Missions.update(dt, p);
    // When the manhunt fully ends, the law gives up and clears out.
    if (Wanted.level>0) this._hadLaw = true;
    else if (this._hadLaw) {
      this.enemies = this.enemies.filter(e=>e.kind!=='lawman');
      this._hadLaw = false;
      this.flashMsg('The law calls off the hunt. You slipped the noose.');
    }
    this.checkInteraction();

    // Cull dead entities
    this.bullets = this.bullets.filter(b=>!b.dead);
    this.enemies = this.enemies.filter(e=>!e.dead);
    this.particles = this.particles.filter(p=>!p.dead);
    this.pickups = this.pickups.filter(p=>!p.dead);
    this.floats = this.floats.filter(f=>!f.dead);
    this.townsfolk = this.townsfolk.filter(t=>!t.dead);
    this.dynamites = this.dynamites.filter(d=>!d.dead);
    this.explosions = this.explosions.filter(e=>!e.dead);

    if (this.msgTimer>0) this.msgTimer-=dt;

    if (p.dead) { this.state = STATE.GAMEOVER; }
  },
};
