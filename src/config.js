/* Chicken Sandy — configuration, map and recipe data.
   Everything tunable lives here. No imports: classic script, global CS namespace. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  CS.TILE = 2.2;          // world units per map tile
  CS.WALL_H = 2.9;        // height of a plain wall block
  CS.LOW_WALL_H = 1.05;   // south wall is short so it never hides the kitchen

  /* Kitchen layout.
     #  wall          .  floor         C  counter (free slot)
     F  fryer         S  serve window  X  trash
     K  raw chicken   T  potato bin    P  plate stack   B  bun crate
     L  lettuce       O  tomato        I  pickles       U  cup dispenser
     M  mayo          Q  bbq           H  hot sauce     Y  ketchup           */
  CS.MAP = [
    '###SSS####MQHY#',
    '#.............#',
    'F.............L',
    '#.............O',
    'F.....CCC.....I',
    '#.....CCC.....#',
    'F.............U',
    '#.............#',
    '#....PP.BB....#',
    '#.............#',
    '##KK#TT###XX###'
  ];

  CS.SPAWN = { col: 7, row: 7 };          // where the chef starts
  CS.SERVE_COL = 4;                       // queue lines up north of this column
  CS.CAM_PITCH = 0.88;                    // camera angle above the horizon (rad)

  /* ---------------------------------------------------------------- items */
  CS.ITEMS = {
    rawChicken:   { label: 'Raw Chicken',   short: 'Raw Chicken',   color: 0xe7a99e },
    friedChicken: { label: 'Fried Chicken', short: 'Fried Chicken', color: 0xe08a2a },
    burntChicken: { label: 'Burnt Chicken', short: 'Burnt!',        color: 0x36291f },
    rawFries:     { label: 'Cut Potatoes',  short: 'Raw Fries',     color: 0xf0e2ad },
    cookedFries:  { label: 'Golden Fries',  short: 'Fries',         color: 0xf0b53c },
    burntFries:   { label: 'Burnt Fries',   short: 'Burnt!',        color: 0x36291f },
    plate:        { label: 'Plate',         short: 'Plate',         color: 0xf2efe6 },
    cup:          { label: 'Sauce Cup',     short: 'Cup',           color: 0xf2efe6 }
  };

  /* Toppings + sauces. `css` drives the ticket swatches, `color` the 3D art. */
  CS.ING = {
    lettuce: { label: 'Lettuce',   color: 0x6fbf3a, css: '#6fbf3a', kind: 'topping' },
    tomato:  { label: 'Tomato',    color: 0xd6402f, css: '#d6402f', kind: 'topping' },
    pickle:  { label: 'Pickles',   color: 0x93ad36, css: '#93ad36', kind: 'topping' },
    mayo:    { label: 'Mayo',      color: 0xf6edd3, css: '#f6edd3', kind: 'sauce'   },
    bbq:     { label: 'BBQ Sauce', color: 0x7d3417, css: '#7d3417', kind: 'sauce'   },
    hot:     { label: 'Hot Sauce', color: 0xe0431f, css: '#e0431f', kind: 'sauce'   },
    ketchup: { label: 'Ketchup',   color: 0xc01f14, css: '#c01f14', kind: 'sauce'   }
  };

  CS.SANDWICH_TOPPINGS = ['lettuce', 'tomato', 'pickle'];
  CS.SANDWICH_SAUCES   = ['mayo', 'bbq', 'hot'];
  CS.CUP_SAUCES        = ['bbq', 'hot', 'ketchup'];

  /* ------------------------------------------------------------- stations */
  /* solid: blocks movement. Every station tile is solid; floor is not. */
  CS.STATION_DEFS = {
    F: { type: 'fryer',   name: 'Fryer' },
    S: { type: 'serve',   name: 'Serving Window' },
    X: { type: 'trash',   name: 'Trash' },
    C: { type: 'counter', name: 'Counter' },
    K: { type: 'crate',   name: 'Chicken Crate', gives: 'rawChicken' },
    T: { type: 'crate',   name: 'Potato Bin',    gives: 'rawFries' },
    P: { type: 'plates',  name: 'Plate Stack' },
    B: { type: 'buns',    name: 'Bun Crate' },
    L: { type: 'topping', name: 'Lettuce Tray',  ing: 'lettuce' },
    O: { type: 'topping', name: 'Tomato Tray',   ing: 'tomato'  },
    I: { type: 'topping', name: 'Pickle Tray',   ing: 'pickle'  },
    M: { type: 'sauce',   name: 'Mayo',          ing: 'mayo'    },
    Q: { type: 'sauce',   name: 'BBQ Sauce',     ing: 'bbq'     },
    H: { type: 'sauce',   name: 'Hot Sauce',     ing: 'hot'     },
    Y: { type: 'sauce',   name: 'Ketchup',       ing: 'ketchup' },
    U: { type: 'cups',    name: 'Cup Dispenser' }
  };

  /* --------------------------------------------------------------- frying */
  CS.COOK = {
    rawChicken: { done: 'friedChicken', burnt: 'burntChicken', cook: 7.5, grace: 7.0, label: 'Chicken' },
    rawFries:   { done: 'cookedFries',  burnt: 'burntFries',   cook: 5.5, grace: 6.0, label: 'Fries' }
  };

  /* ----------------------------------------------------------- difficulty
     The campaign is a run of days. Each day introduces exactly one new idea,
     runs a little longer, pays a little better and asks for a little more.
     Inside a day the pressure also ramps: `spawn` and `limit` are [start, end]
     pairs interpolated across the shift, and ticket complexity grows with it.
     So it gets harder both as the clock runs AND as the days go by.         */
  CS.FIRST_SPAWN = 2.5;        // grace before the first customer of a day

  CS.LEVELS = [
    { name: 'Opening Day', tag: 'Plain sandwiches. Find your feet.',
      seconds: 120, target: 400, maxOrders: 2,
      spawn: [10.0, 8.5], limit: [80, 70],
      friesChance: 0, cupChance: 0, twoCupChance: 0, maxTop: 0, maxSauce: 0,
      unlocks: ['Plate', 'Bun', 'Fried chicken'] },

    { name: 'Fries Are Up', tag: 'A second fryer is lit.',
      seconds: 140, target: 750, maxOrders: 2,
      spawn: [9.5, 8.0], limit: [78, 68],
      friesChance: 0.5, cupChance: 0, twoCupChance: 0, maxTop: 0, maxSauce: 0,
      unlocks: ['French fries'] },

    { name: 'Garden Fresh', tag: 'The topping trays open up.',
      seconds: 150, target: 1050, maxOrders: 3,
      spawn: [9.0, 7.4], limit: [76, 64],
      friesChance: 0.45, cupChance: 0, twoCupChance: 0, maxTop: 1, maxSauce: 0,
      unlocks: ['Lettuce', 'Tomato', 'Pickles'] },

    { name: 'Sauce Boss', tag: 'Squeeze bottles on the back wall.',
      seconds: 160, target: 1350, maxOrders: 3,
      spawn: [8.4, 6.9], limit: [74, 62],
      friesChance: 0.45, cupChance: 0, twoCupChance: 0, maxTop: 1, maxSauce: 1,
      unlocks: ['Mayo', 'BBQ sauce', 'Hot sauce'] },

    { name: 'Sides Please', tag: 'Cups of sauce to go.',
      seconds: 170, target: 1650, maxOrders: 3,
      spawn: [7.8, 6.3], limit: [72, 60],
      friesChance: 0.5, cupChance: 0.45, twoCupChance: 0.12, maxTop: 2, maxSauce: 1,
      unlocks: ['Sauce cups: BBQ, hot sauce, ketchup'] },

    { name: 'Lunch Rush', tag: 'Four tickets on the rail at once.',
      seconds: 180, target: 2050, maxOrders: 4,
      spawn: [6.8, 5.4], limit: [68, 55],
      friesChance: 0.55, cupChance: 0.5, twoCupChance: 0.2, maxTop: 2, maxSauce: 2,
      unlocks: ['A fourth ticket', 'Shorter tempers'] },

    { name: 'The Works', tag: 'Everything on everything.',
      seconds: 190, target: 2500, maxOrders: 4,
      spawn: [6.0, 4.6], limit: [64, 50],
      friesChance: 0.6, cupChance: 0.55, twoCupChance: 0.3, maxTop: 3, maxSauce: 3,
      unlocks: ['Fully loaded sandwiches'] }
  ];

  function cloneLevel(l) {
    var o = {}, k;
    for (k in l) if (l.hasOwnProperty(k)) o[k] = (l[k] instanceof Array) ? l[k].slice() : l[k];
    return o;
  }

  /* Past the hand-built days the shop just keeps getting busier, forever. */
  CS.levelFor = function (day) {
    if (day <= CS.LEVELS.length) {
      var lv = cloneLevel(CS.LEVELS[day - 1]);
      lv.day = day;
      return lv;
    }
    var over = day - CS.LEVELS.length;
    var l = cloneLevel(CS.LEVELS[CS.LEVELS.length - 1]);
    l.day = day;
    l.name = 'Overtime ' + over;
    l.tag = 'No end in sight. Keep frying.';
    l.target = 2500 + over * 520;
    l.spawn = [Math.max(3.2, 6.0 - over * 0.45), Math.max(2.6, 4.6 - over * 0.40)];
    l.limit = [Math.max(44, 64 - over * 3), Math.max(34, 50 - over * 3)];
    l.unlocks = [];
    return l;
  };

  /* Star thresholds as multiples of the day's target. */
  CS.STARS = [1.0, 1.35, 1.75];

  CS.SCORE = {
    sandwich: 60, extra: 12, fries: 30, cup: 16,
    speedBonus: 0.6,     // up to +60% of base for a fast serve
    comboStep: 0.25, comboMax: 4,
    missPenalty: 40
  };

  /* ---------------------------------------------------------------- utils */
  CS.MAP_W = CS.MAP[0].length;
  CS.MAP_H = CS.MAP.length;
  CS.OX = -(CS.MAP_W * CS.TILE) / 2;   // world-space origin offset
  CS.OZ = -(CS.MAP_H * CS.TILE) / 2;

  CS.tileToWorld = function (col, row) {
    return { x: CS.OX + (col + 0.5) * CS.TILE, z: CS.OZ + (row + 0.5) * CS.TILE };
  };
  CS.charAt = function (col, row) {
    if (row < 0 || row >= CS.MAP_H || col < 0 || col >= CS.MAP_W) return '#';
    return CS.MAP[row][col];
  };
  CS.isSolid = function (col, row) { return CS.charAt(col, row) !== '.'; };
  CS.lerp = function (a, b, t) { return a + (b - a) * t; };
  CS.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  CS.pick = function (arr, rng) { return arr[Math.floor((rng || Math.random)() * arr.length)]; };
  CS.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  /* Customer shirt colours — one per villager in the queue. */
  CS.CUSTOMER_COLORS = [0x4f7fc4, 0xb5543f, 0x6a4f9c, 0x3f8a6b, 0xc08a30, 0x9c4f7a, 0x4f8ea0];
})(window.CS);
