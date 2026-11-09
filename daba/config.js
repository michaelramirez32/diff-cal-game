/* =========================================================
   EDIT THIS FILE to change the loading screen AND the menu page - loading lang toooo
   ========================================================= */
const CONFIG = {
  gameName: "DABADABIDO",

  // CHARACTER
  //  type "stickman" = your stickman with REAL walking legs and swinging arms
  //  type "image"    = use your own picture (bobs while walking) or a sprite sheet (see `image`)
  character: {
    type: "image",      // now using the KING sprite sheet
    height: 200,        // how tall the character is, in pixels
    walkSpeed: 1,       // only used when type is "stickman"
    image: {
      src: "king-run.png",
      frames: 5,        // number of poses in the sheet (one horizontal row)
      fps: 9,           // how fast the poses change (higher = faster running)
      idleFrame: 0,     // which pose to show when loading is finished
      groundSeconds: 0.35  // speed of the sliding ground lines (smaller = faster)
    }
  },

  // BACKGROUND — leave image empty to use the paper-grid placeholder.
  // Example: image: "my-background.png"
  background: {
    image: "",
    color: "#f6f1e4"
  },

  edgePadding: 24,        // margin (px) on the left/right where the walk starts and ends
  fakeLoadSeconds: 8,     // fake loading time; ignored once you call setLoadProgress()

  // AFTER LOADING: the menu page (menu.html) with Start + How to play
  menuUrl: "menu.html",   // the page the loading screen opens when it finishes
  startUrl: "game.html",  // page opened by the Start button
  howToPlay: [            // lines shown in the "How to play" window. Edit freely!
    "Move: arrow keys or A / D.",
    "Jump: Up arrow, W or Space.",
    "Attack: J, X, or click / tap the screen.",
    "Defeat monsters to drop coins, then walk over them to collect.",
    "Jump over monsters so they can’t hit you!",
    "Defeat ALL the monsters to clear the map."
  ],

  // MAPS — played in order. A map is finished ONLY when ALL of its monsters are defeated.
  //  bg        = picture file for the map
  //  ground    = how far down the screen the floor is (0 = top, 540 = bottom). Move it if the king floats or sinks.
  //  enemies   = how many monsters the map sends in total
  //  maxAtOnce = how many can be on screen together
  //  (optional) enemyHP, enemySpeed: [min, max], spawnEvery: [min, max]  -> make a map harder
  // To add a new map: copy a block, change the values, and save the picture in the same folder.
  maps: [
    { name: "Grass Plains", bg: "map1.jpg", ground: 362, enemies: 10, maxAtOnce: 3 },
    { name: "Night Forest", bg: "bg.jpg",   ground: 500, enemies: 14, maxAtOnce: 4, enemyHP: 40, enemySpeed: [65, 105] }
  ],

  // Messages shown as the bar fills: [percent to start showing at, text]
  stages: [
  [0,   "Initializing..."],
  [2,   "WOW GUMAGALAW"],
  [4,  "PWEDE NA"],
  [6,  "WALANG ULO"],
  [20,  "WALANG KANIN BUSENG"],
  [22,  "Preparing game..."],
  [24,  "Loading assets..."],
  [26,  "Almost there..."],
  [28,  "MALAPIT NA ERP"],
  [34,  "MALAPIT NA ERP"],
  [36,  "MALAPIT NA ERP"],
  [38,  "Finalizing..."],
  [95,  "Ready na ba?"],
  [100, "Ready!"]
  ]
};
