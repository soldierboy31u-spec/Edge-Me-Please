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
