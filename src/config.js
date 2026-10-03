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
     M  mayo          Q  bbq           H  hot sauce     Y  ketchup
     ~  locked        -- floor you have not bought yet

     The grid is always CS.MAP_W x CS.MAP_H, whatever you own. Land you have
     not bought is '~': solid, and drawn as nothing at all, so the world origin
     and therefore every world-space constant below stays put when a wing
     opens up. CS.BASE_MAP is the shop you start with; CS.MAP is the live grid
     that layout.js rewrites as you expand and rearrange, and that world.js
     builds from. */
  CS.BASE_MAP = [
    '###SSS####MQHY#~~~~',
    '#.............#~~~~',
    'F.............L~~~~',
    '#.............O~~~~',
    'F.....CCC.....I~~~~',
    '#.....CCC.....#~~~~',
    'F.............U~~~~',
    '#.............#~~~~',
    '#....PP.BB....#~~~~',
    '#.............#~~~~',
    '##KK#TT###XX###~~~~',
    '~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~'
  ];
  CS.MAP = CS.BASE_MAP.slice();

  CS.SPAWN = { col: 7, row: 7 };          // where the chef starts
  CS.SERVE_COL = 4;                       // queue lines up north of this column
  CS.CAM_PITCH = 0.88;                    // camera angle above the horizon (rad)
  CS.CAM_PITCH_MOBILE = 1.14;             // phones sit higher: a tall screen sees
                                          // far too much floor depth at 0.88

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
      seconds: 120, rent: 12, maxOrders: 2,
      spawn: [10.0, 8.5], limit: [80, 70],
      friesChance: 0, cupChance: 0, twoCupChance: 0, maxTop: 0, maxSauce: 0,
      unlocks: ['Plate', 'Bun', 'Fried chicken'] },

    { name: 'Fries Are Up', tag: 'A second fryer is lit.',
      seconds: 140, rent: 20, maxOrders: 2,
      spawn: [9.5, 8.0], limit: [78, 68],
      friesChance: 0.5, cupChance: 0, twoCupChance: 0, maxTop: 0, maxSauce: 0,
      unlocks: ['French fries'] },

    { name: 'Garden Fresh', tag: 'The topping trays open up.',
      seconds: 150, rent: 28, maxOrders: 3,
      spawn: [9.0, 7.4], limit: [76, 64],
      friesChance: 0.45, cupChance: 0, twoCupChance: 0, maxTop: 1, maxSauce: 0,
      unlocks: ['Lettuce', 'Tomato', 'Pickles'] },

    { name: 'Sauce Boss', tag: 'Squeeze bottles on the back wall.',
      seconds: 160, rent: 37, maxOrders: 3,
      spawn: [8.4, 6.9], limit: [74, 62],
      friesChance: 0.45, cupChance: 0, twoCupChance: 0, maxTop: 1, maxSauce: 1,
      unlocks: ['Mayo', 'BBQ sauce', 'Hot sauce'] },

    { name: 'Sides Please', tag: 'Cups of sauce to go.',
      seconds: 170, rent: 46, maxOrders: 3,
      spawn: [7.8, 6.3], limit: [72, 60],
      friesChance: 0.5, cupChance: 0.45, twoCupChance: 0.12, maxTop: 2, maxSauce: 1,
      unlocks: ['Sauce cups: BBQ, hot sauce, ketchup'] },

    { name: 'Lunch Rush', tag: 'Four tickets on the rail at once.',
      seconds: 180, rent: 57, maxOrders: 4,
      spawn: [6.8, 5.4], limit: [68, 55],
      friesChance: 0.55, cupChance: 0.5, twoCupChance: 0.2, maxTop: 2, maxSauce: 2,
      unlocks: ['A fourth ticket', 'Shorter tempers'] },

    { name: 'The Works', tag: 'Everything on everything.',
      seconds: 190, rent: 68, maxOrders: 4,
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
    l.rent = 68 + over * 11;
    l.spawn = [Math.max(3.2, 6.0 - over * 0.45), Math.max(2.6, 4.6 - over * 0.40)];
    l.limit = [Math.max(44, 64 - over * 3), Math.max(34, 50 - over * 3)];
    l.unlocks = [];
    return l;
  };

  /* Star thresholds as multiples of the day's rent. */
  CS.STARS = [1.0, 2.0, 3.2];

  /* ---------------------------------------------------------- the money
     The till is the score. An item is worth what it says on the menu board,
     every time -- being fast does not make a sandwich cost more. What speed
     buys you is throughput (more customers through the door in one shift) and
     tips, which is where the skill shows up. */
  CS.PRICES = {
    sandwich: 5.50,    // chicken sandwich, plain
    topping: 0.50,     // each
    sauce: 0.40,       // each
    fries: 2.20,
    cup: 1.00
  };

  /* Food that goes in the bin was bought with real money, so burning a basket
     costs you twice: the time, and the stock. This is what makes a better
     fryer worth paying for. */
  CS.FOOD_COST = {
    rawChicken: 0.55, friedChicken: 0.55, burntChicken: 0.55,
    rawFries: 0.30, cookedFries: 0.30, burntFries: 0.30,
    cup: 0.05, plate: 0.00
  };

  CS.WALKOUT_COST = 0.60;   // wasted prep when a customer gives up and leaves

  CS.COMBO = { step: 0.25, max: 4 };

  /* Tips. A customer served with `minLeft` or less of their patience still on
     the clock never tips; above that both the chance and the size scale with
     how early you were, so tipping rewards a shop that stays ahead of its
     queue rather than a lucky one. The combo rides on the tip, not the price. */
  CS.TIP = {
    minLeft: 0.45,
    chance: 0.85,
    share: 0.30,       // tip as a fraction of the order's menu price
    bigTip: 2.50       // at or above this they drop three coins, not one
  };

  /* --------------------------------------------------------------- staff
     Each assistant runs one tight loop and ignores everything else, which is
     what makes them readable: you always know what the potato is going to do.
     `jobs` is what they will make. Training widens it.

     A flat daily wage punished exactly the days you could least afford it: a
     slow shift still owed the full amount. So a wage is a *share of the day's
     takings* instead, between `wageMin` and `wageMax`. They earn their keep
     out of what they helped bring in -- cheap while the shop is small, worth
     real money once it is busy, and never the reason a bad day gets worse. */
  CS.STAFF_DEFS = {
    potato: {
      name: 'Spud', role: 'Fry Cook', hire: 85,
      wageShare: 0.07, wageMin: 1.50, wageMax: 22.00,
      tint: 0xd8a860,
      blurb: 'Cuts, fries and plates chips. Will not touch anything else.',
      jobs: ['fries'],
      speed: 2.0, act: 0.55
    },
    tomato: {
      name: 'Dollop', role: 'Sauce Hand', hire: 65,
      wageShare: 0.05, wageMin: 1.00, wageMax: 16.00,
      tint: 0xd6402f,
      blurb: 'Fills sauce cups and leaves them on a prep counter.',
      jobs: ['cup:ketchup'],
      speed: 2.2, act: 0.45
    }
  };

  /* Per-hire training. `adds` extends the job list, `mult` scales a stat. */
  CS.TRAINING = {
    potato: [
      { id: 'potato-chicken', name: 'Chicken Ticket', cost: 110,
        blurb: 'Spud learns the chicken fryer too.', adds: ['chicken'] },
      { id: 'potato-boots',   name: 'Non-Slip Boots', cost: 70,
        blurb: '+40% walking speed.', mult: { speed: 1.4 } },
      { id: 'potato-hands',   name: 'Asbestos Mitts', cost: 95,
        blurb: 'Works a station 35% faster.', mult: { act: 0.65 } }
    ],
    tomato: [
      { id: 'tomato-sauces', name: 'The Full Range', cost: 90,
        blurb: 'Dollop learns BBQ and hot sauce cups.',
        adds: ['cup:bbq', 'cup:hot'] },
      { id: 'tomato-boots',  name: 'Non-Slip Boots', cost: 70,
        blurb: '+40% walking speed.', mult: { speed: 1.4 } },
      { id: 'tomato-hands',  name: 'Quick Thumbs', cost: 95,
        blurb: 'Works a station 35% faster.', mult: { act: 0.65 } }
    ]
  };

  /* ------------------------------------------------------------ upgrades
     Three kinds, and the kind decides what buying one actually does:
       gear   -- an instant, permanent modifier (see CS.econ.mod)
       part   -- adds a station to your stock, which you then place yourself
       land   -- unlocks a region of '~' into floor                        */
  CS.UPGRADES = [
    { id: 'basket',  kind: 'gear', name: 'Vented Baskets',  cost: 70,
      blurb: 'Everything fries 15% faster.', mod: { fryCook: 0.85 } },
    { id: 'basket2', kind: 'gear', name: 'Twin Burners',    cost: 165, needs: 'basket',
      blurb: 'Another 15% off the fryer clock.', mod: { fryCook: 0.85 } },
    { id: 'thermo',  kind: 'gear', name: 'Thermostat',      cost: 90,
      blurb: 'Half again as long before a basket burns.', mod: { fryGrace: 1.5 } },
    { id: 'bench',   kind: 'gear', name: 'Waiting Bench',   cost: 110,
      blurb: 'Customers wait 12% longer before walking out.', mod: { patience: 1.12 } },
    { id: 'tray',    kind: 'gear', name: 'Deep Trays',      cost: 60,
      blurb: 'Fit a fourth sauce cup on a plate.', mod: { cups: 4 } },
    { id: 'sign',    kind: 'gear', name: 'Roadside Sign',   cost: 180,
      blurb: 'One more customer in the queue at a time.', mod: { orders: 1 } },

    { id: 'fryer',   kind: 'part', name: 'Fryer',           cost: 85,  ch: 'F', wall: true },
    { id: 'counter', kind: 'part', name: 'Prep Counter',    cost: 25,  ch: 'C' },
    { id: 'plates',  kind: 'part', name: 'Plate Stack',     cost: 30,  ch: 'P' },
    { id: 'buns',    kind: 'part', name: 'Bun Crate',       cost: 30,  ch: 'B' },
    { id: 'cups',    kind: 'part', name: 'Cup Dispenser',   cost: 35,  ch: 'U', wall: true },
    { id: 'bin',     kind: 'part', name: 'Trash Can',       cost: 20,  ch: 'X' },
    { id: 'chicken', kind: 'part', name: 'Chicken Crate',   cost: 45,  ch: 'K', wall: true },
    { id: 'spuds',   kind: 'part', name: 'Potato Bin',      cost: 45,  ch: 'T', wall: true },
    { id: 'ketchup', kind: 'part', name: 'Ketchup Bottle',  cost: 40,  ch: 'Y', wall: true },
    { id: 'bbq',     kind: 'part', name: 'BBQ Bottle',      cost: 40,  ch: 'Q', wall: true },
    { id: 'hot',     kind: 'part', name: 'Hot Sauce',       cost: 40,  ch: 'H', wall: true },
    { id: 'mayo',    kind: 'part', name: 'Mayo Bottle',     cost: 40,  ch: 'M', wall: true },
    { id: 'lettuce', kind: 'part', name: 'Lettuce Tray',    cost: 40,  ch: 'L', wall: true },
    { id: 'maters',  kind: 'part', name: 'Tomato Tray',     cost: 40,  ch: 'O', wall: true },
    { id: 'pickles', kind: 'part', name: 'Pickle Tray',     cost: 40,  ch: 'I', wall: true },
    { id: 'window',  kind: 'part', name: 'Serving Window',  cost: 200, ch: 'S', wall: 'north' },

    { id: 'backroom', kind: 'land', name: 'The Back Room', cost: 240,
      blurb: 'Two more rows behind the kitchen.', region: 'south' },
    { id: 'eastwing', kind: 'land', name: 'The East Wing', cost: 300,
      blurb: 'Four more columns of floor.', region: 'east' }
  ];

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

  /* ----------------------------------------------------------- customers
     One entry per species. `fur`/`belly`/`snout` colour the shared chunky
     body; the rest are the features CS.models.customer() bolts on. Ears are
     'point' | 'droop' | 'tall' | 'round' | 'flop' | 'none', tails are
     'up' | 'wag' | 'puff' | 'curl' | 'bush' | 'none'. `tint` is what shows on
     the ticket, so keep the seven readably different from each other. */
  CS.CRITTERS = [
    { name: 'Cat',    fur: 0xf0a24a, belly: 0xfbe6c8, snout: 0xfbe6c8, nose: 0xe0736b,
      ears: 'point', tail: 'up',   stripes: true,  tint: 0xf0a24a },
    { name: 'Pup',    fur: 0xb9834e, belly: 0xf1ddbf, snout: 0xf1ddbf, nose: 0x2a201a,
      ears: 'droop', tail: 'wag',  patch: true,   tint: 0xb9834e },
    { name: 'Bunny',  fur: 0xf2eee6, belly: 0xffffff, snout: 0xffffff, nose: 0xe89aa8,
      ears: 'tall',  tail: 'puff', tint: 0xe6dfd2 },
    { name: 'Bear',   fur: 0x8d6240, belly: 0xc9a179, snout: 0xc9a179, nose: 0x2a201a,
      ears: 'round', tail: 'none', tint: 0x8d6240 },
    { name: 'Piglet', fur: 0xf0a3ae, belly: 0xffd0d6, snout: 0xffb6c1, nose: 0xd4737f,
      ears: 'flop',  tail: 'curl', tint: 0xf0a3ae },
    { name: 'Fox',    fur: 0xd9622c, belly: 0xf6eadd, snout: 0xf6eadd, nose: 0x2a201a,
      ears: 'point', tail: 'bush', tipped: true,  tint: 0xd9622c },
    { name: 'Frog',   fur: 0x74b84a, belly: 0xd3e8a8, snout: 0xd3e8a8, nose: 0x3e6b25,
      ears: 'none',  tail: 'none', bigEyes: true, tint: 0x74b84a },
    { name: 'Mouse',  fur: 0x9aa3ad, belly: 0xdfe4e9, snout: 0xdfe4e9, nose: 0xe08fa0,
      ears: 'round', tail: 'none', bigEars: true, tint: 0x9aa3ad }
  ];

  /* Where the dining room's front door is. world.js cuts the hole here and
     orders.js walks customers through it, so the two must agree. */
  CS.DOOR_X = CS.OX + (CS.SERVE_COL + 0.5) * CS.TILE;   // straight behind the queue
  CS.DOOR_W = 2.8;
  CS.MAX_ORDERS_CAP = 5;       // widest the queue ever gets, Roadside Sign included
})(window.CS);
