"use strict";
/* Redemption's Edge — chris-manifest.js
   Chris animation manifest (RE-ART-003) as a JS object — NOT a fetched .json,
   so the game still runs by double-clicking index.html (no server needed).
   Frame counts/timing are safe to edit here without touching renderer code.
   Sheet layout: each ROW = a direction (in `directions` order), each COLUMN = a frame.
   See docs/CHARACTER_SPRITE_SPEC.md for the full art contract. */

const CHRIS_MANIFEST = {
  frameWidth: 128,
  frameHeight: 128,
  anchor: { x: 64, y: 122 },          // feet anchor within a 128px cell (delivered art plants boots at y=122)
  basePath: 'assets/characters/chris/',
  directions: ['south','southwest','west','northwest','north','northeast','east','southeast'],
  animations: {
    idle:    { file: 'chris_idle.png',    framesPerDirection: 4, frameDurationMs: 180, loop: true  },
    walk:    { file: 'chris_walk.png',    framesPerDirection: 8, frameDurationMs: 90,  loop: true  },
    aim:     { file: 'chris_aim.png',     framesPerDirection: 1, frameDurationMs: 150, loop: true  },
    shoot:   { file: 'chris_shoot.png',   framesPerDirection: 3, frameDurationMs: 55,  loop: false },
    // Not authored yet — these fall back until dedicated sheets exist.
    dash:    { file: 'chris_dash.png',    framesPerDirection: 2, frameDurationMs: 70,  loop: true,  fallback: 'walk' },
    hurt:    { file: 'chris_hurt.png',    framesPerDirection: 1, frameDurationMs: 120, loop: true,  fallback: 'idle' },
    // mounted fallback:null => keep drawing the existing procedural horse+rider.
    mounted: { file: 'chris_mounted.png', framesPerDirection: 1, frameDurationMs: 150, loop: true,  fallback: null  },
  },
  fallbackAnimation: 'idle',
};
