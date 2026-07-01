"use strict";
/* Redemption's Edge — config.js
   Part of the modular build. Loaded as a classic <script> in index.html (order matters).
   See docs/ROADMAP.md for the project map. */

/* ---------------------------------------------------------------------------
   1. CONFIG / CONSTANTS
   --------------------------------------------------------------------------- */
const CFG = {
  VIEW_W: 1280,
  VIEW_H: 720,
  WORLD_W: 4600,
  WORLD_H: 4600,

  // Player tuning — weighty & smooth. Lower accel = gentler ramp-up,
  // lower top speed = less twitchy, slightly lower friction = a touch of glide.
  PLAYER_ACCEL: 1650,        // px/s^2  (was 2200 — eases in more smoothly)
  PLAYER_MAX_SPEED: 200,     // px/s on foot (was 262 — noticeably calmer)
  PLAYER_FRICTION: 8.0,      // higher = stops quicker
  PLAYER_RADIUS: 15,
  PLAYER_MAX_HP: 100,

  // Dash / dodge (Shift) — burst of speed + brief invulnerability.
  DASH_SPEED: 760,           // px/s during the dash
  DASH_TIME: 0.17,           // s the burst lasts
  DASH_IFRAMES: 0.27,        // s of invulnerability (slightly longer than the burst)
  DASH_COOLDOWN: 0.95,       // s before you can dash again (bumped per playtest)

  // Dynamite (Q) — the chaos tool.
  DYN_START: 3,              // sticks you spawn with
  DYN_MAX: 8,                // carry cap
  DYN_THROW_SPEED: 430,      // initial throw velocity (slides + slows)
  DYN_FUSE: 1.15,            // s before it blows
  DYN_RADIUS: 135,           // blast radius
  DYN_DMG: 95,               // peak damage at the centre
  DYN_KNOCKBACK: 560,        // peak knockback impulse

  // --- Milestone 3 tools ---
  // Lasso (F)
  LASSO_RANGE: 255,          // reach of the throw
  LASSO_COOLDOWN: 1.1,       // s between throws
  LASSO_STUN: 1.5,           // s a roped enemy is stunned
  LASSO_PULL: 1000,          // impulse yanking a roped enemy toward you
  LASSO_GRAB: 70,            // radius of loot vacuumed in along the rope

  // Horse whistle (H)
  WHISTLE_GALLOP: 640,       // px/s a summoned horse runs to you

  // Dead Eye (hold Right Mouse)
  DEADEYE_MAX: 100,
  DEADEYE_DRAIN: 26,         // meter/s spent while active
  DEADEYE_GAIN_KILL: 24,     // meter gained per kill
  DEADEYE_REGEN: 2.5,        // slow passive meter/s
  DEADEYE_TIMESCALE: 0.32,   // world slowdown while active
  DEADEYE_DMG: 1.7,          // player bullet damage multiplier while active
  DEADEYE_MIN: 12,           // need at least this much meter to trigger

  HORSE_MAX_SPEED: 470,      // px/s mounted
  HORSE_ACCEL: 2400,

  // Revolver
  CYLINDER: 6,
  FIRE_COOLDOWN: 0.34,       // s between shots
  RELOAD_TIME: 1.7,          // s for full reload
  BULLET_SPEED: 980,         // px/s
  BULLET_LIFE: 0.95,         // s
  BULLET_DMG: 34,
  BULLET_SPREAD_PLAYER: 0.02,

  // Enemies
  ENEMY_RADIUS: 14,
  ENEMY_HP: 70,
  ENEMY_VIEW: 460,           // detection range
  ENEMY_SHOOT_RANGE: 430,
  ENEMY_SPEED: 130,
  ENEMY_FIRE_COOLDOWN: 1.25,
  ENEMY_WINDUP: 0.42,        // telegraph time — enemy "tells" before firing (arcade fairness)
  ENEMY_SPREAD: 0.12,
  ENEMY_BULLET_SPEED: 720,
  ENEMY_BULLET_DMG: 11,
  BULLET_KNOCKBACK: 120,     // shove enemies take per bullet hit

  ENFORCER_HP: 150,
  ENFORCER_SPEED: 150,
  ENFORCER_DMG: 16,

  // Lawmen (spawned by wanted level)
  LAWMAN_HP: 90,
  LAWMAN_SPEED: 165,

  WANTED_MAX: 5,
  WANTED_DECAY: 0.012,       // (legacy — superseded by the manhunt search model)
  // --- The Manhunt (GTA-style cooldown, forgiving/arcade) ---
  SEARCH_PER_STAR: 4.0,      // seconds unseen to shed one star
  CAMP_COOLDOWN_MULT: 3.0,   // laying low at Darryl's camp cools this much faster
  CAMP_SAFE_RADIUS: 300,     // lawmen won't hunt you inside this ring around camp
  SEARCH_RADIUS_BASE: 250,   // search-zone size at 1 star
  SEARCH_RADIUS_PER: 90,     // + per additional star
  TILE: 64,
};

const STATE = { START: 0, PLAY: 1, PAUSE: 2, GAMEOVER: 3 };

// Difficulty modes. Multipliers scale enemy stats off the base CFG values.
//   hp/dmg   : enemy toughness & damage          (higher = harder)
//   fireRate : multiplies fire cooldown          (LOWER = shoots more often = harder)
//   windup   : multiplies the attack-tell length (LOWER = less warning = harder)
//   count    : scales gang sizes / respawn cap   (higher = more enemies)
// 'easy' is the exact feel from the first M1 playtest — preserved on purpose.
const DIFFICULTY = {
  easy:   { label:'Easy',   hp:1.00, dmg:1.00, fireRate:1.00, windup:1.00, count:1.00 },
  normal: { label:'Normal', hp:1.30, dmg:1.45, fireRate:0.80, windup:0.70, count:1.15 },
  hard:   { label:'Hard',   hp:1.65, dmg:1.90, fireRate:0.62, windup:0.50, count:1.35 },
};
const DIFFICULTY_ORDER = ['easy','normal','hard'];
