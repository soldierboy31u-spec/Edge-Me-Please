"use strict";
/* Redemption's Edge — world.js
   Part of the modular build. Loaded as a classic <script> in index.html (order matters).
   See docs/ROADMAP.md for the project map. */

/* ---------------------------------------------------------------------------
   6. WORLD DATA
   Buildings have a footprint rect (solid) and a door point for interaction.
   --------------------------------------------------------------------------- */
const TOWN_CX = 1500, TOWN_CY = 1500;   // Hicksville town centre
const CAMP_CX = 760,  CAMP_CY = 2120;   // Darryl's outlaw camp (home base, SW of town)

// HICKSVILLE — a crooked frontier town pretending to be respectable.
// Landmarks drawn from the design bible. `action` drives the [E] interaction.
const BUILDINGS = [
  { name: 'The Leaning Saloon',    x: TOWN_CX-330, y: TOWN_CY-300, w: 280, h: 200, color:'#5a3d22', lean:0.04,
    door:{x:TOWN_CX-190,y:TOWN_CY-92}, action:'rest',  label:'Wet your whistle & heal ($10)' },
  { name: "Sheriff Crook's Office",x: TOWN_CX+90,  y: TOWN_CY-300, w: 240, h: 180, color:'#4a3320',
    door:{x:TOWN_CX+210,y:TOWN_CY-112}, action:'sheriff', label:'Pay off your bounty' },
  { name: 'Lucky Tooth Store',     x: TOWN_CX-300, y: TOWN_CY+120, w: 250, h: 190, color:'#54402a',
    door:{x:TOWN_CX-175,y:TOWN_CY+118}, action:'store', label:'Buy ammo (6 for $5)' },
  { name: 'Hicksville Bank',       x: TOWN_CX+140, y: TOWN_CY+150, w: 210, h: 165, color:'#494033',
    door:{x:TOWN_CX+245,y:TOWN_CY+148}, action:'bank', label:'Crack the safe (raises hell)' },
  { name: 'Undertaker & Taxidermy',x: TOWN_CX+430, y: TOWN_CY-260, w: 190, h: 160, color:'#3f3322',
    door:{x:TOWN_CX+525,y:TOWN_CY-104}, action:'lockdoor', label:'Pick the lock' },
  { name: 'Broken Spur Stable',    x: TOWN_CX+420, y: TOWN_CY+40,  w: 220, h: 160, color:'#4f3a24',
    door:{x:TOWN_CX+530,y:TOWN_CY+38}, action:'none', label:'' },
  { name: 'Abandoned Chapel',      x: TOWN_CX-560, y: TOWN_CY+360, w: 200, h: 220, color:'#4a4038', cross:true,
    door:{x:TOWN_CX-460,y:TOWN_CY+582}, action:'chapel', label:'Pick the cellar lock' },
];

// Darryl's camp buildings — the player's home base, separate from judgemental Hicksville.
const CAMP = [
  { name: "Darryl's Tent", x: CAMP_CX-90, y: CAMP_CY-70, w: 180, h: 130, color:'#4a3a24', tent:true,
    door:{x:CAMP_CX, y:CAMP_CY+62}, action:'camp', label:"Rest at camp — full heal & ammo" },
];

// Every solid + drawable structure. Collision / render / interaction iterate this.
const STRUCTURES = BUILDINGS.concat(CAMP);

// Darryl stands by the campfire. Non-combatant anchor NPC (design-bible camp leader).
const DARRYL = { x: CAMP_CX+70, y: CAMP_CY+40, bob:0 };
const CAMPFIRE = { x: CAMP_CX, y: CAMP_CY+40, flick:0 };

// Scenery scatter (rocks, cacti, trees) — generated once at boot.
let SCENERY = [];
function generateScenery() {
  SCENERY = [];
  const types = ['rock', 'cactus', 'tree', 'shrub'];
  for (let i = 0; i < 260; i++) {
    const x = rand(120, CFG.WORLD_W - 120);
    const y = rand(120, CFG.WORLD_H - 120);
    // Keep the town square clearer of large obstacles.
    if (Math.abs(x - TOWN_CX) < 460 && Math.abs(y - TOWN_CY) < 460) {
      if (Math.random() < 0.7) continue;
    }
    const t = types[randInt(0, types.length - 1)];
    const r = t === 'tree' ? rand(26, 40) : t === 'rock' ? rand(16, 30) : t === 'cactus' ? rand(14, 22) : rand(12, 18);
    SCENERY.push({ type: t, x, y, r, seed: Math.random() * 1000, solid: t !== 'shrub' });
  }
}

// Fences flanking the main street (decorative + collidable posts segments).
const FENCES = [
  { x: TOWN_CX-520, y: TOWN_CY-40, w: 14, h: 360 },
  { x: TOWN_CX+506, y: TOWN_CY-40, w: 14, h: 360 },
];

/* ===========================================================================
   MILESTONE 2 — DENSER OVERWORLD
   PROPS      : small circular solids (town clutter + desert structures)
   LANDMARKS  : large atmospheric features (mostly visual; some interactable)
   SECRETS    : buried caches you dig up with [E]
   WANTED_BOARD : readable notice board in the town square
   =========================================================================== */

// Town clutter + desert solids. Most are solid; together they form alleys & cover.
let PROPS = [];
function generateProps() {
  PROPS = [];
  const add = (type,x,y,r,solid=true,seed=0)=>PROPS.push({type,x,y,r,solid,seed:seed||Math.random()*9});

  // --- Town: barrels/crates clustered by buildings to carve alleys & cover ---
  const clusters = [
    [TOWN_CX-470, TOWN_CY-150], [TOWN_CX-150, TOWN_CY-40], [TOWN_CX+60, TOWN_CY+40],
    [TOWN_CX+360, TOWN_CY-120], [TOWN_CX-60, TOWN_CY+300], [TOWN_CX+300, TOWN_CY+320],
    [TOWN_CX-360, TOWN_CY+360], [TOWN_CX+520, TOWN_CY-360],
  ];
  for (const [cx,cy] of clusters) {
    const n = randInt(2,4);
    for (let i=0;i<n;i++) {
      const t = Math.random()<0.5?'barrel':'crate';
      add(t, cx+rand(-34,34), cy+rand(-26,26), t==='barrel'?13:15);
    }
  }
  // Hitching posts + troughs lining the main street
  for (let i=0;i<6;i++) add('post', TOWN_CX-92, TOWN_CY-260+i*92, 6);
  for (let i=0;i<6;i++) add('post', TOWN_CX+92, TOWN_CY-260+i*92, 6);
  add('trough', TOWN_CX-150, TOWN_CY+180, 18);
  add('trough', TOWN_CX+150, TOWN_CY-180, 18);

  // --- Desert: abandoned wagon circle (ambush zone) ---
  const wc = LANDMARK_POS.wagons;
  for (let i=0;i<6;i++){ const a=i/6*TAU; add('wagon', wc.x+Math.cos(a)*120, wc.y+Math.sin(a)*120, 24, true, a); }
  // Bone arch legs (the span is drawn as a landmark)
  const ar = LANDMARK_POS.arch;
  add('boneleg', ar.x-70, ar.y, 16); add('boneleg', ar.x+70, ar.y, 16);
  // Rock spires scattered near the badlands
  add('spire', TOWN_CX+900, TOWN_CY-1250, 30);
  add('spire', TOWN_CX+960, TOWN_CY-1180, 22);
  add('spire', TOWN_CX-1250, TOWN_CY-300, 28);
}

// Fixed positions shared by props + landmarks so the two stay aligned.
const LANDMARK_POS = {
  arch:   { x: TOWN_CX+1500, y: TOWN_CY-1150 },
  wagons: { x: TOWN_CX-1150, y: TOWN_CY+900  },
  shrine: { x: TOWN_CX+1350, y: TOWN_CY+1250 },
  mine:   { x: TOWN_CX-1250, y: TOWN_CY-1050 },
};

// Large atmospheric features. `action` (if set) makes them [E]-interactable.
const LANDMARKS = [
  { type:'arch',     x:LANDMARK_POS.arch.x,   y:LANDMARK_POS.arch.y,   name:'The Bone Arch' },
  { type:'wagons',   x:LANDMARK_POS.wagons.x, y:LANDMARK_POS.wagons.y, name:'Wagon Circle' },
  { type:'shrine',   x:LANDMARK_POS.shrine.x, y:LANDMARK_POS.shrine.y, name:'Desert Shrine',
    action:'shrine', label:'Lay a coin at the bone shrine' },
  { type:'mine',     x:LANDMARK_POS.mine.x,   y:LANDMARK_POS.mine.y,   name:'Collapsed Mine',
    action:'mine',   label:'Mine entrance — caved in (needs dynamite)' },
  // Dry riverbed: a winding lighter channel (drawn as a ground decal).
  { type:'riverbed', x:TOWN_CX-200, y:TOWN_CY-1250, name:'Dry Riverbed' },
  // Ghost-lantern trail: floating lanterns, only visible at night. Leads to a secret.
  { type:'ghosttrail', x:TOWN_CX+700, y:TOWN_CY+1500, name:'Ghost-Lantern Trail' },
];

// Buried caches — walk over the disturbed mound and press [E] to dig.
let SECRETS = [];
function resetSecrets() {
  SECRETS = [
    { x:LANDMARK_POS.arch.x,   y:LANDMARK_POS.arch.y+90,   found:false },
    { x:LANDMARK_POS.wagons.x, y:LANDMARK_POS.wagons.y,    found:false },
    { x:LANDMARK_POS.shrine.x+40, y:LANDMARK_POS.shrine.y+30, found:false },
    { x:TOWN_CX+760, y:TOWN_CY+1720, found:false },   // end of the ghost-lantern trail
    { x:TOWN_CX-430, y:TOWN_CY+250,  found:false },   // behind the chapel
    { x:TOWN_CX+1900, y:TOWN_CY+200, found:false },   // out in the flats
    { x:TOWN_CX-90,  y:TOWN_CY-1100, found:false },   // in the dry riverbed
  ];
  for (const lm of LANDMARKS) lm.opened = false;       // re-seal the mine etc.
}

// The town notice board — read bounties & rumors.
const WANTED_BOARD = { x: TOWN_CX+30, y: TOWN_CY-150 };
const RUMORS = [
  "“They say the Bone Arch out east marks a dead man's stash.”",
  "“Somethin' moans under the old chapel after dark. Demons, I tell ya.”",
  "“Prospector buried his life savings by the dry riverbed and never came back.”",
  "“The wagon circle? Ambush. Bandits picked those folks clean.”",
  "“Follow the ghost lanterns south at night... if you got the nerve.”",
];
