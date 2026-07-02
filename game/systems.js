"use strict";
/* Redemption's Edge — systems.js
   Part of the modular build. Loaded as a classic <script> in index.html (order matters).
   See docs/ROADMAP.md for the project map. */

/* ---------------------------------------------------------------------------
   9. WANTED-LEVEL SYSTEM
   Tracks the law's interest in the player. Crimes raise it; lying low lowers it.
   --------------------------------------------------------------------------- */
// THE MANHUNT — a GTA-style two-state wanted system.
//   HUNTED    : a lawman has line of sight → they track your position, no cooldown.
//   SEARCHING : you broke sight → the law sweeps a "search zone" at your last-known
//               spot while your stars tick down. Re-spotted → the timer refills.
// Camp is a safe haven; a bribe token knocks off a star. (Forgiving/arcade tuning.)
const Wanted = {
  level: 0,        // 0..5 (integer shown as stars)
  heat: 0,         // continuous accumulator (level = ceil(heat))
  spawnTimer: 0,
  searching: false,          // true = law lost you, cooling down
  lastSeen: { x:0, y:0 },    // centre of the search zone
  searchRadius: 0,
  inTown(x,y) { return Math.abs(x-TOWN_CX)<700 && Math.abs(y-TOWN_CY)<700; },
  onPlayerShot(x,y) { if (this.inTown(x,y)) this.add(0.18); },
  onCivilianKilled() { this.add(2.2); Game.flashMsg('Witnessed murder! The law wants you.'); },
  onLawmanKilled() { this.add(1.2); },
  add(v) {
    this.heat = clamp(this.heat + v, 0, CFG.WANTED_MAX);
    this.level = Math.ceil(this.heat - 1e-6);
    // Committing a crime blows your cover and re-centres the manhunt on you.
    this.searching = false;
    this.lastSeen.x = Game.player.x; this.lastSeen.y = Game.player.y;
  },
  bribe() {  // spend a bribe token — knock off one star
    this.heat = Math.max(0, Math.ceil(this.heat-1e-6) - 1);
    this.level = Math.ceil(this.heat - 1e-6);
  },
  clear() { this.heat=0; this.level=0; this.searching=false; },

  // Does any living lawman actually have eyes on the player right now?
  lawSeesPlayer(player) {
    return Game.enemies.some(e => e.kind==='lawman' && !e.dead &&
      dist(e.x,e.y,player.x,player.y) < CFG.ENEMY_VIEW &&
      Game.lineOfSight(e.x,e.y,player.x,player.y));
  },

  update(dt, player) {
    if (this.level <= 0) { this.searching = false; return; }
    const inCamp  = Game.playerInCamp();
    const spotted = !inCamp && this.lawSeesPlayer(player);   // camp = safe, counts as unseen
    this.searchRadius = CFG.SEARCH_RADIUS_BASE + (this.level-1)*CFG.SEARCH_RADIUS_PER;

    if (spotted) {
      // HUNTED — no cooldown; the manhunt tracks your live position.
      this.searching = false;
      this.lastSeen.x = player.x; this.lastSeen.y = player.y;
    } else {
      // SEARCHING — stars tick down. Laying low at camp cools much faster.
      this.searching = true;
      const rate = (1/CFG.SEARCH_PER_STAR) * (inCamp ? CFG.CAMP_COOLDOWN_MULT : 1);
      this.heat = Math.max(0, this.heat - rate*dt);
      this.level = Math.ceil(this.heat - 1e-6);
      if (this.level <= 0) { this.searching = false; return; }
    }

    // Send lawmen to sweep the search zone (their patrol home = last-seen spot).
    for (const e of Game.enemies) if (e.kind==='lawman') { e.home.x=this.lastSeen.x; e.home.y=this.lastSeen.y; }

    // Spawn lawmen scaled to level (forgiving ~1.5×), converging on the search zone.
    this.spawnTimer -= dt;
    const lawCount = Game.enemies.filter(e=>e.kind==='lawman').length;
    const desired = Math.ceil(this.level * 1.5);
    if (this.spawnTimer<=0 && lawCount < desired) {
      this.spawnTimer = clamp(4 - this.level*0.4, 1.2, 4);
      Game.spawnLawman(player);
    }
  }
};

/* ---------------------------------------------------------------------------
   9b. MISSIONS (M4 — Mission Slice)
   Three-story vertical slice, offered in order by Darryl at camp.
   State machine: talk to Darryl → stages advance via proximity triggers,
   kill counts, and interaction hooks called from Game. Title cards + the
   objective line + the gold marker are drawn in render.js.
   Missions never gate the sandbox — everything stays playable around them.
   --------------------------------------------------------------------------- */
const Missions = {
  active: null,       // mission id or null
  stage: 0,
  completed: {},      // id -> true
  card: null,         // {kicker, title, sub, t} — cinematic title card
  objective: '',      // HUD objective line
  marker: null,       // {x,y} world-space objective marker (minimap + chevron)
  m2Supplies: false,  // carrying the recovered supplies (Bone-Dry Job)

  order: ['m1','m2','m3'],
  defs: {
    m1: { num:'I',   title:'WELCOME TO HICKSVILLE' },
    m2: { num:'II',  title:'THE BONE-DRY JOB' },
    m3: { num:'III', title:'TROUBLE UNDER THE CHAPEL' },
  },
  // Where the Bone-Dry ambush happens (the dry riverbed landmark).
  m2Site: { x: TOWN_CX-200, y: TOWN_CY-1250 },

  reset() {
    this.active=null; this.stage=0; this.completed={};
    this.card=null; this.objective=''; this.marker=null; this.m2Supplies=false;
  },
  next() { return this.order.find(id => !this.completed[id]) || null; },
  isDone(id) { return !!this.completed[id]; },

  showCard(kicker, title, sub) { this.card = { kicker, title, sub, t: 0 }; },
  setObjective(txt, x, y) {
    this.objective = txt;
    this.marker = (x!==undefined) ? {x, y} : null;
  },

  aliveTagged(id) { return Game.enemies.filter(e => e.missionTag===id && !e.dead).length; },
  spawnTagged(id, x, y, n, kind) {
    for (let i=0;i<n;i++) {
      const e = new Enemy(clamp(x+rand(-70,70),100,CFG.WORLD_W-100),
                          clamp(y+rand(-70,70),100,CFG.WORLD_H-100), kind||'bandit');
      e.missionTag = id;
      Game.enemies.push(e);
    }
  },

  start(id) {
    this.active = id; this.stage = 0;
    const d = this.defs[id];
    this.showCard('MISSION ' + d.num, d.title, null);
    Audio.click();
    if (id==='m1') {
      Game.flashMsg('Darryl: "Supplies run. Hicksville. In, out, NO incidents. I mean it, Chris."');
      this.setObjective('Head into Hicksville', TOWN_CX, TOWN_CY);
    } else if (id==='m2') {
      Game.flashMsg('Darryl: "A supply wagon went quiet in the dry riverbed. Go see. Take the rope."');
      this.setObjective('Investigate the wagon ambush in the dry riverbed', this.m2Site.x, this.m2Site.y);
    } else if (id==='m3') {
      Game.flashMsg('Darryl: "Folks hear scratchin\' under the chapel. Probably rats. Big, blasphemous rats."');
      const chapel = STRUCTURES.find(b=>b.action==='chapel');
      if (chapel && chapel.looted) {  // cellar already open from sandbox play
        this.stage = 1;
        this._m3AfterCellar();
      } else {
        this.setObjective('Check under the Abandoned Chapel (pick the cellar lock)', chapel.door.x, chapel.door.y);
      }
    }
  },

  complete(id, msg, reward) {
    this.completed[id] = true;
    this.active = null; this.stage = 0;
    this.setObjective('');
    if (reward) { Game.player.money += reward; Game.score += reward; }
    this.showCard('MISSION COMPLETE', this.defs[id].title, reward ? ('+$'+reward) : null);
    if (msg) Game.flashMsg(msg);
    Audio.money();
  },

  // --- Interaction points (checked FIRST in Game.checkInteraction) ---------
  getInteract(p) {
    // Darryl — mission giver / turn-ins
    if (dist(p.x, p.y, DARRYL.x, DARRYL.y) < 48) {
      if (this.active==='m1' && this.stage===3)
        return { label:'Report back to Darryl', act:()=> this.complete('m1',
          'Darryl: "Missing travelers, fake bounties... Somethin\'s rotten in that town. Good work — mostly."', CFG.M1_REWARD) };
      if (this.active==='m2' && this.stage===3)
        return { label:'Hand Darryl the supplies', act:()=>{ this.m2Supplies=false; this.complete('m2',
          'Darryl: "Honest work. Don\'t let it become a habit." He eyes the claw marks on the crate and says nothin\'.', CFG.M2_RETURN_REWARD); } };
      if (this.active==='m3' && this.stage===3)
        return { label:'Tell Darryl what you saw', act:()=> this.complete('m3',
          'Darryl goes quiet a long moment. "Ritual chamber. Right. Chris — some holes are dug from the inside."', CFG.M3_REWARD) };
      if (!this.active) {
        const nid = this.next();
        if (nid) return { label:'Talk to Darryl', act:()=> this.start(nid) };
        return { label:'Talk to Darryl', act:()=>{ Audio.click();
          Game.flashMsg('Darryl: "No work today. Try not to burn the territory down for fun."'); } };
      }
      // Mission active but not at a Darryl stage — repeat the objective.
      return { label:'Talk to Darryl', act:()=>{ Audio.click(); Game.flashMsg('Darryl: "' + this.objective + '. Git."'); } };
    }
    // Bone-Dry Job: search the wrecked wagon
    if (this.active==='m2' && this.stage===2 && dist(p.x,p.y,this.m2Site.x,this.m2Site.y) < 80) {
      return { label:'Search the wrecked wagon', act:()=> this._m2SearchWagon() };
    }
    // Bone-Dry Job: fence the supplies at the Lucky Tooth instead of returning them
    if (this.active==='m2' && this.stage===3) {
      const store = STRUCTURES.find(b=>b.action==='store');
      if (store && dist(p.x,p.y,store.door.x,store.door.y) < 55)
        return { label:'Fence the supplies ($'+CFG.M2_FENCE_REWARD+')', act:()=>{ this.m2Supplies=false; this.complete('m2',
          'The clerk doesn\'t ask where the crate came from. Nobody in Hicksville ever does.', CFG.M2_FENCE_REWARD); } };
    }
    // Chapel job: descend into the opened mine
    if (this.active==='m3' && this.stage===2) {
      const mine = LANDMARKS.find(lm=>lm.type==='mine');
      if (mine && mine.opened && dist(p.x,p.y,mine.x,mine.y) < 80)
        return { label:'Descend into the mine', act:()=> this._m3RitualChamber() };
    }
    return null;
  },

  // --- Stage internals ------------------------------------------------------
  _m2SearchWagon() {
    Audio.click();
    this.m2Supplies = true;
    this.stage = 3;
    Game.flashMsg('Camp supplies — and claw marks on the crate no animal made. The demon rumors just got teeth.');
    this.setObjective('Return the supplies to Darryl — or fence them at the Lucky Tooth', DARRYL.x, DARRYL.y);
  },
  _m3AfterCellar() {
    const mine = LANDMARK_POS.mine;
    Game.flashMsg('The cellar tunnel runs deep — dead toward the old collapsed mine.');
    const lm = LANDMARKS.find(l=>l.type==='mine');
    if (lm && lm.opened) { this.stage = 2; this.setObjective('Descend into the mine', mine.x, mine.y); }
    else this.setObjective('Blast the Collapsed Mine open (throw dynamite at it)', mine.x, mine.y);
  },
  _m3RitualChamber() {
    Audio.click();
    this.stage = 3;
    const p = Game.player;
    p.deadeye = CFG.DEADEYE_MAX;   // the chamber sharpens something in Chris
    Camera.addShake(6);
    Game.flashMsg('A ritual chamber — bone-chalk circles, candle stubs... Your senses snap razor-sharp. (Dead Eye full)');
    this.setObjective('Tell Darryl what you saw', DARRYL.x, DARRYL.y);
  },

  // --- Event hooks (called from Game) ---------------------------------------
  onEnemyKilled(e) {
    if (!e.missionTag || e.missionTag!==this.active) return;
    const left = this.aliveTagged(this.active);
    if (this.active==='m1' && this.stage===1) {
      if (left>0) { this.setObjective('Put down the troublemakers ('+left+' left)', e.x, e.y); return; }
      this.stage = 2;
      Game.flashMsg('Quiet again. That wanted board across the square might explain a few things...');
      this.setObjective('Read the wanted board', WANTED_BOARD.x, WANTED_BOARD.y);
    } else if (this.active==='m2' && this.stage===1) {
      if (left>0) { this.setObjective('Clear the ambushers ('+left+' left) — lasso [F] stuns \'em', e.x, e.y); return; }
      this.stage = 2;
      Game.flashMsg('Last one drops. The wrecked wagon sits dead ahead.');
      this.setObjective('Search the wrecked wagon', this.m2Site.x, this.m2Site.y);
    }
  },
  onBoardRead() {
    if (this.active==='m1' && this.stage===2) {
      this.stage = 3;
      Game.flashMsg('Missing travelers. Bounties on men nobody\'s ever met. These numbers don\'t add up...');
      this.setObjective('Report back to Darryl', DARRYL.x, DARRYL.y);
    }
  },
  onChapelOpened() {
    if (this.active==='m3' && this.stage===0) { this.stage = 1; this._m3AfterCellar(); }
  },
  onMineOpened() {
    if (this.active==='m3' && this.stage===1) {
      this.stage = 2;
      this.setObjective('Descend into the mine', LANDMARK_POS.mine.x, LANDMARK_POS.mine.y);
    }
  },

  // --- Per-frame: proximity triggers + marker upkeep -------------------------
  update(dt, p) {
    if (this.card) { this.card.t += dt; if (this.card.t > CFG.TITLE_CARD_TIME) this.card = null; }
    if (!this.active) return;

    if (this.active==='m1' && this.stage===0) {
      if (dist(p.x,p.y,TOWN_CX,TOWN_CY) < CFG.MISSION_ARRIVE_DIST + 120) {
        this.stage = 1;
        const sal = STRUCTURES.find(b=>b.action==='rest');
        this.spawnTagged('m1', sal.door.x+40, sal.door.y+60, 3, 'bandit');
        Game.flashMsg('A "staged" argument outside the Leaning Saloon turns to gunfire!');
        this.setObjective('Put down the troublemakers (3 left)', sal.door.x, sal.door.y);
        Camera.addShake(5);
      }
    } else if (this.active==='m2' && this.stage===0) {
      if (dist(p.x,p.y,this.m2Site.x,this.m2Site.y) < CFG.MISSION_ARRIVE_DIST) {
        this.stage = 1;
        this.spawnTagged('m2', this.m2Site.x, this.m2Site.y, 4, 'bandit');
        Game.flashMsg('The wagon\'s been ransacked — and its ambushers are still here!');
        this.setObjective('Clear the ambushers (4 left) — lasso [F] stuns \'em', this.m2Site.x, this.m2Site.y);
      }
    }

    // Kill-stage markers track the nearest surviving target.
    if ((this.active==='m1'||this.active==='m2') && this.stage===1) {
      let best=null, bd=Infinity;
      for (const e of Game.enemies) {
        if (e.missionTag!==this.active || e.dead) continue;
        const d = dist2(p.x,p.y,e.x,e.y);
        if (d<bd) { bd=d; best=e; }
      }
      if (best) this.marker = { x: best.x, y: best.y };
    }
  },
};
