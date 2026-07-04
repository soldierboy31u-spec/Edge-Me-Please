"use strict";
/* Redemption's Edge — horse-manifest.js
   Manifest for the standalone (unridden/procedural-replacement) horse sprite.
   Same 8-direction grid contract as chris-manifest.js — see
   docs/CHARACTER_SPRITE_SPEC.md. Mounted (horse+rider) is a separate sheet
   (chris_mounted.png) owned by the Chris pipeline; this is just the idle,
   riderless horse standing in the world. */

const HORSE_MANIFEST = {
  frameWidth: 128,
  frameHeight: 128,
  anchor: { x: 64, y: 112 },   // hooves anchor within the 128px cell
  basePath: 'assets/characters/horse/',
  directions: ['south','southwest','west','northwest','north','northeast','east','southeast'],
  animations: {
    // scaleMul matches chris_mounted (1.4) so the horse doesn't change size
    // when Chris hops on/off.
    idle: { file: 'horse_idle.png', framesPerDirection: 1, frameDurationMs: 200, loop: true, scaleMul: 1.4 },
  },
  fallbackAnimation: 'idle',
};
