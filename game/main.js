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

  handleMeta();
  Game.update(dt);
  render();
  Input.endFrame();

  requestAnimationFrame(loop);
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
Game.init();
fit();
requestAnimationFrame(loop);
