"use strict";
/* Redemption's Edge — main.js
   Part of the modular build. Loaded as a classic <script> in index.html (order matters).
   See docs/ROADMAP.md for the project map. */

/* ---------------------------------------------------------------------------
   12. STATE TRANSITIONS + MAIN LOOP
   --------------------------------------------------------------------------- */
function handleMeta() {
  // Global key handling for state machine (independent of play update).
  if (Game.state===STATE.START) {
    // 1/2/3 pick difficulty without starting; any other key begins.
    if (Input.hit('1')) { Game.difficulty='easy';   Audio.ensure(); Audio.click(); }
    else if (Input.hit('2')) { Game.difficulty='normal'; Audio.ensure(); Audio.click(); }
    else if (Input.hit('3')) { Game.difficulty='hard';   Audio.ensure(); Audio.click(); }
    else if (Object.keys(Input.pressed).length>0 || Input.mouse.down) {
      Audio.ensure(); Audio.resume();
      Game.reset();              // rebuild the world with the chosen difficulty
      Game.state=STATE.PLAY;
    }
  } else if (Game.state===STATE.PLAY) {
    if (Input.hit('escape') || Input.hit('p')) Game.state=STATE.PAUSE;
  } else if (Game.state===STATE.PAUSE) {
    if (Input.hit('escape') || Input.hit('p')) Game.state=STATE.PLAY;
    if (Input.hit('n')) { Game.reset(); Game.state=STATE.PLAY; }
  } else if (Game.state===STATE.GAMEOVER) {
    if (Input.hit('enter') || Input.hit('r')) { Game.reset(); Game.state=STATE.PLAY; }
    if (Input.mouse.down && GO_BTN) {
      const m=Input.mouse;
      if (m.x>GO_BTN.x&&m.x<GO_BTN.x+GO_BTN.w&&m.y>GO_BTN.y&&m.y<GO_BTN.y+GO_BTN.h) {
        Input.mouse.down=false; Game.reset(); Game.state=STATE.PLAY;
      }
    }
  }
}

let lastT = performance.now();
function loop(now) {
  let dt = (now - lastT) / 1000;
  lastT = now;
  // Clamp dt to avoid huge jumps after tab switches (prevents tunneling / chaos).
  dt = Math.min(dt, 0.05);

  DBG.frame(now);
  handleMeta();
  handleDebugKeys();
  Game.update(dt);
  const _r0 = performance.now();
  render();
  DBG.renderMs = +(performance.now() - _r0).toFixed(1);
  Input.endFrame();

  requestAnimationFrame(loop);
}

// Backtick toggles the profiler; while it's open, number keys flip each system.
function handleDebugKeys() {
  if (Input.hit('`') || Input.hit('~')) DBG.show = !DBG.show;
  if (!DBG.show) return;
  const T = (k, prop) => { if (Input.hit(k)) DBG[prop] = !DBG[prop]; };
  T('1','sand'); T('2','decals'); T('3','road');
  T('4','outline'); T('5','grain'); T('6','sepia');
  T('7','vignette'); T('8','art'); T('9','tint');
  if (Input.hit('o')) DBG.auto = !DBG.auto;   // toggle adaptive quality
  if (Input.hit('0')) {   // 0 = flip ALL cosmetic FX at once
    const v = !DBG.grain; DBG.grain=DBG.sepia=DBG.vignette=DBG.tint=v;
  }
}

/* ---------------------------------------------------------------------------
   BOOTSTRAP
   --------------------------------------------------------------------------- */
Input.init(canvas);
// Initialize audio on first user gesture (browser autoplay policy).
addEventListener('keydown', ()=>{ Audio.ensure(); Audio.resume(); }, { once:true });
addEventListener('mousedown', ()=>{ Audio.ensure(); Audio.resume(); }, { once:true });

// Responsive scaling — keep 16:9, fit window while preserving internal resolution.
function fit() {
  const wrap = document.getElementById('game-wrap');
  const scale = Math.min(wrap.clientWidth / CFG.VIEW_W, wrap.clientHeight / CFG.VIEW_H);
  canvas.style.width  = (CFG.VIEW_W * scale) + 'px';
  canvas.style.height = (CFG.VIEW_H * scale) + 'px';
}
addEventListener('resize', fit);

ChrisSprites.init();   // sets up the animator; loads sheets only if USE_SPRITES is on
HorseSprites.load();   // standalone horse idle sheet (procedural fallback if missing)
IsoBuildings.load();   // M8 iso building art (placeholder diamonds until loaded)
IsoProps.load();       // Tier-1 prop art (procedural scenery until loaded)
IsoLandmarks.load();   // Tier-2 landmark art (procedural landmarks until loaded)
EnemySprites.load();   // bandit/lawman/enforcer sheets (procedural until loaded)
DarrylSprite.load();   // camp NPC single-frame sprite (procedural until loaded)
BossSprite.load();     // Buckshot Benny single-pose sprite (procedural until loaded)
DemonSprite.load();    // desert demon single-pose sprite (procedural until loaded)
FinalBossSprite.load();// OLD HUNGER tar colossus (procedural mass until loaded)
TerrainArt.load();     // Tier-3 sand tile + road + ground decals (iso only)
Game.init();
fit();
requestAnimationFrame(loop);
