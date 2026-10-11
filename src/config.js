/* Chicken Sandy — configuration, map and recipe data.
   Everything tunable lives here. No imports: classic script, global CS namespace. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  CS.TILE = 2.2;          // world units per map tile
  CS.WALL_H = 2.9;        // height of a plain wall block
  CS.LOW_WALL_H = 1.05;   // south wall is short so it never hides the kitchen
  CS.SIDE_WALL_H = 1.35;  // so are the side walls, or they hide the stoves on them

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
  CS.FIRST_SPAWN = 4.0;        // grace before the first customer of a day

  /* The menu grows one idea at a time, so the early days are about learning
     to cook rather than surviving. `tops`, `sauces` and `cups` say which
     ingredients a ticket may ask for today -- lettuce arrives before tomato,
     ketchup before the other dips -- and `grace` stretches how long a cooked
     basket sits before it burns, easing back to 1 as you settle in. Each day
     also carries a `howto`: one line on how to make whatever is new. */
  var ALL_TOPS = ['lettuce', 'tomato', 'pickle'];
  var ALL_SAUCES = ['mayo', 'bbq', 'hot'];
  var ALL_CUPS = ['bbq', 'hot', 'ketchup'];

  CS.LEVELS = [
    { name: 'Opening Day', tag: 'One customer at a time. Enjoy the sizzle.',
      seconds: 150, rent: 4, maxOrders: 1, grace: 2.0,
      spawn: [13.0, 12.0], limit: [120, 110],
      friesChance: 0, cupChance: 0, twoCupChance: 0, maxTop: 0, maxSauce: 0,
      tops: [], sauces: [], cups: [],
      howto: 'Plate, then bun, then fried chicken. Carry it to the window.',
      unlocks: ['Plain chicken sandwiches'] },

    { name: 'Finding Your Feet', tag: 'Two tickets on the rail now.',
      seconds: 150, rent: 6, maxOrders: 2, grace: 1.8,
      spawn: [12.0, 10.5], limit: [110, 100],
      friesChance: 0, cupChance: 0, twoCupChance: 0, maxTop: 0, maxSauce: 0,
      tops: [], sauces: [], cups: [],
      howto: 'Drop the next chicken in the fryer while you plate the last one.',
      unlocks: ['A second ticket'] },

    { name: 'Fries Are Up', tag: 'A basket of golden fries on the side.',
      seconds: 160, rent: 8, maxOrders: 2, grace: 1.6,
      spawn: [11.5, 10.0], limit: [105, 95],
      friesChance: 0.45, cupChance: 0, twoCupChance: 0, maxTop: 0, maxSauce: 0,
      tops: [], sauces: [], cups: [],
      howto: 'Potatoes from the bin fry too. Add the fries to the plate.',
      unlocks: ['French fries'] },

    { name: 'Garden Fresh', tag: 'The lettuce tray opens up.',
      seconds: 160, rent: 10, maxOrders: 2, grace: 1.5,
      spawn: [11.0, 9.5], limit: [100, 92],
      friesChance: 0.4, cupChance: 0, twoCupChance: 0, maxTop: 1, maxSauce: 0,
      tops: ['lettuce'], sauces: [], cups: [],
      howto: 'Hold a plate with a bun on it at the lettuce tray and USE it.',
      unlocks: ['Lettuce'] },

    { name: 'Salad Days', tag: 'Tomato and pickles join the lettuce.',
      seconds: 165, rent: 12, maxOrders: 3, grace: 1.4,
      spawn: [10.5, 9.0], limit: [96, 88],
      friesChance: 0.4, cupChance: 0, twoCupChance: 0, maxTop: 2, maxSauce: 0,
      tops: ALL_TOPS, sauces: [], cups: [],
      howto: 'Toppings go on in any order. Just match the ticket.',
      unlocks: ['Tomato', 'Pickles', 'A third ticket'] },

    { name: 'Sauce Boss', tag: 'Mayo and BBQ bottles on the back wall.',
      seconds: 170, rent: 14, maxOrders: 3, grace: 1.3,
      spawn: [10.0, 8.6], limit: [92, 84],
      friesChance: 0.45, cupChance: 0, twoCupChance: 0, maxTop: 2, maxSauce: 1,
      tops: ALL_TOPS, sauces: ['mayo', 'bbq'], cups: [],
      howto: 'Squeeze a bottle onto a sandwich just like adding a topping.',
      unlocks: ['Mayo', 'BBQ sauce'] },

    { name: 'Turn Up the Heat', tag: 'Hot sauce, for the brave.',
      seconds: 170, rent: 16, maxOrders: 3, grace: 1.2,
      spawn: [9.5, 8.2], limit: [90, 80],
      friesChance: 0.45, cupChance: 0, twoCupChance: 0, maxTop: 2, maxSauce: 2,
      tops: ALL_TOPS, sauces: ALL_SAUCES, cups: [],
      howto: 'Some sandwiches want two sauces now. Read the ticket twice.',
      unlocks: ['Hot sauce'] },

    { name: 'Sides Please', tag: 'Ketchup cups to go.',
      seconds: 175, rent: 18, maxOrders: 3, grace: 1.1,
      spawn: [9.0, 7.8], limit: [88, 78],
      friesChance: 0.5, cupChance: 0.4, twoCupChance: 0, maxTop: 2, maxSauce: 2,
      tops: ALL_TOPS, sauces: ALL_SAUCES, cups: ['ketchup'],
      howto: 'Take a cup, fill it at the ketchup bottle, add it to the plate.',
      unlocks: ['Ketchup cups'] },

    { name: 'Dip Into It', tag: 'BBQ and hot sauce come in cups too.',
      seconds: 180, rent: 21, maxOrders: 3, grace: 1.0,
      spawn: [8.4, 7.2], limit: [84, 74],
      friesChance: 0.5, cupChance: 0.5, twoCupChance: 0.15, maxTop: 2, maxSauce: 2,
      tops: ALL_TOPS, sauces: ALL_SAUCES, cups: ALL_CUPS,
      howto: 'Some tickets want two cups. Two of the same counts as two.',
      unlocks: ['BBQ and hot sauce cups'] },

    { name: 'Lunch Rush', tag: 'Four tickets on the rail at once.',
      seconds: 185, rent: 25, maxOrders: 4, grace: 1.0,
      spawn: [7.4, 6.0], limit: [76, 64],
      friesChance: 0.55, cupChance: 0.5, twoCupChance: 0.2, maxTop: 2, maxSauce: 2,
      tops: ALL_TOPS, sauces: ALL_SAUCES, cups: ALL_CUPS,
      howto: 'Helpers earn their keep now. Hire some in the shop.',
      unlocks: ['A fourth ticket', 'Shorter tempers'] },

    { name: 'The Works', tag: 'Everything on everything.',
      seconds: 190, rent: 30, maxOrders: 4, grace: 1.0,
      spawn: [6.6, 5.0], limit: [70, 56],
      friesChance: 0.6, cupChance: 0.55, twoCupChance: 0.3, maxTop: 3, maxSauce: 3,
      tops: ALL_TOPS, sauces: ALL_SAUCES, cups: ALL_CUPS,
      howto: 'Fully loaded sandwiches. Save Feather Frenzy for a full rail.',
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
    l.rent = 30 + over * 4;
    l.spawn = [Math.max(3.4, 6.6 - over * 0.40), Math.max(2.8, 5.0 - over * 0.35)];
    l.limit = [Math.max(46, 70 - over * 3), Math.max(36, 56 - over * 3)];
    l.unlocks = [];
    l.howto = '';
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
     `jobs` is what each hand will *make* when the tickets call for it, and
     training widens it. On top of their trade every hand will also pull a
     basket before it burns and bin anything burnt (see staff.js), and they
     put finished food straight onto a plate when a ticket wants it there.

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
      blurb: 'Fries chips and drops them straight onto your plates. Pulls any basket before it burns.',
      jobs: ['fries'],
      speed: 4.2, act: 0.38
    },
    tomato: {
      name: 'Dollop', role: 'Prep Hand', hire: 65,
      wageShare: 0.05, wageMin: 1.00, wageMax: 16.00,
      tint: 0xd6402f,
      blurb: 'Sets out plates with the bun on, fills ketchup cups and adds them to your plates.',
      jobs: ['plate', 'cup:ketchup'],
      speed: 4.4, act: 0.32
    },
    egg: {
      name: 'Clucky', role: 'Grill Cook', hire: 95,
      wageShare: 0.07, wageMin: 1.50, wageMax: 22.00,
      tint: 0xf4ead2,
      blurb: 'Fries chicken and lays it on any bun that is waiting for it.',
      jobs: ['chicken'],
      speed: 4.3, act: 0.36
    },
    lettuce: {
      name: 'Sprout', role: 'Garnish Hand', hire: 120,
      wageShare: 0.06, wageMin: 1.25, wageMax: 18.00,
      tint: 0x6fbf3a,
      blurb: 'Dresses plated sandwiches with whatever toppings the ticket asks for.',
      jobs: ['dress:top'],
      speed: 4.4, act: 0.34
    },
    mushroom: {
      name: 'Button', role: 'Runner', hire: 150,
      wageShare: 0.08, wageMin: 2.00, wageMax: 24.00,
      tint: 0xd8423a,
      blurb: 'Carries any finished plate that matches a ticket out through the window.',
      jobs: ['serve'],
      speed: 4.6, act: 0.30
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
    ],
    egg: [
      { id: 'egg-fries', name: 'Two Baskets', cost: 100,
        blurb: 'Clucky learns to fry potatoes too.', adds: ['fries'] },
      { id: 'egg-boots', name: 'Non-Slip Boots', cost: 70,
        blurb: '+40% walking speed.', mult: { speed: 1.4 } },
      { id: 'egg-hands', name: 'Heatproof Shell', cost: 95,
        blurb: 'Works a station 35% faster.', mult: { act: 0.65 } }
    ],
    lettuce: [
      { id: 'lettuce-sauce', name: 'Squeeze Bottle Licence', cost: 110,
        blurb: 'Sprout learns to sauce sandwiches as well.', adds: ['dress:sauce'] },
      { id: 'lettuce-boots', name: 'Non-Slip Boots', cost: 70,
        blurb: '+40% walking speed.', mult: { speed: 1.4 } },
      { id: 'lettuce-hands', name: 'Nimble Leaves', cost: 95,
        blurb: 'Works a station 35% faster.', mult: { act: 0.65 } }
    ],
    mushroom: [
      { id: 'mushroom-boots', name: 'Roller Skates', cost: 90,
        blurb: '+50% walking speed.', mult: { speed: 1.5 } },
      { id: 'mushroom-hands', name: 'Steady Tray', cost: 80,
        blurb: 'Picks up and hands over 35% faster.', mult: { act: 0.65 } }
    ]
  };

  /* ---------------------------------------------------------- the chef
     Sandy levels up as she cooks. Every order served is experience, a level
     is a skill point, and points buy ranks in the skills below from the shop.
     `per` is what one rank is worth; game.js and orders.js read the totals
     through CS.econ.skill(id). Feather Frenzy is the one active power: press
     Q (or the POWER button) for a burst of speed while the queue's patience
     stops draining.                                                        */
  CS.XP = { perOrder: 10, perExtra: 2, perTip: 3, perDay: 25 };
  CS.xpToNext = function (level) { return 60 + (level - 1) * 45; };

  CS.SKILLS = [
    { id: 'feet',   name: 'Quick Feet',     max: 3, per: 0.08,
      blurb: '+8% waddle speed per rank.' },
    { id: 'dash',   name: 'Hot Wings',      max: 3, per: 0.18,
      blurb: 'Dash recharges 18% faster per rank.' },
    { id: 'flap',   name: 'Extra Flap',     max: 2, per: 1,
      blurb: 'One more flap in the air per rank.' },
    { id: 'reach',  name: 'Long Neck',      max: 2, per: 0.45,
      blurb: 'Reach stations from a little further away.' },
    { id: 'sizzle', name: 'Sizzle Sense',   max: 3, per: 0.12,
      blurb: 'Food sits 12% longer in the oil before it burns, per rank.' },
    { id: 'charm',  name: 'Charming Cluck', max: 3, per: 0.06,
      blurb: 'Customers wait 6% longer per rank.' },
    { id: 'tips',   name: 'Golden Feathers', max: 3, per: 0.15,
      blurb: '+15% on every tip per rank.' },
    { id: 'frenzy', name: 'Feather Frenzy', max: 3, per: 2.5,
      blurb: 'Active power (Q): a burst of speed and the queue stops getting impatient. Each rank lasts longer.' }
  ];
  CS.FRENZY = { base: 4.5, speed: 1.45, cooldown: 50 };

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
     The queue is a parade of fantasy-RPG regulars: moogles, chocobos, mages
     and monsters on their lunch break. `look` picks the build in
     CS.models.customer(); `fur`/`belly` colour the shared chunky body and
     `trim` is a second accent (robe hem, wings, crown...). Tails are
     'up' | 'wag' | 'none' and only steer how orders.js sways them. `tint` is
     what shows on the ticket, so keep them readably different. */
  CS.CRITTERS = [
    { name: 'Moogle',      look: 'moogle',   fur: 0xf6f1ea, belly: 0xffffff, trim: 0x7a5aa8,
      nose: 0xd8455e, tail: 'none', tint: 0xd8455e },
    { name: 'Chocobo',     look: 'chocobo',  fur: 0xf5cf3a, belly: 0xfbe38a, trim: 0xe8892a,
      tail: 'wag', tint: 0xf5cf3a },
    { name: 'Cactuar',     look: 'cactuar',  fur: 0x74b84a, belly: 0x8fcf5e, trim: 0xf0d860,
      tail: 'none', tint: 0x74b84a },
    { name: 'Tonberry',    look: 'tonberry', fur: 0x6aa35a, belly: 0xa6cc8a, trim: 0x7a5534,
      tail: 'up', tint: 0x8a6440 },
    { name: 'Bomb',        look: 'bomb',     fur: 0xe8642a, belly: 0xf08a3a, trim: 0xffd23c,
      tail: 'none', tint: 0xf08a24 },
    { name: 'Black Mage',  look: 'blackmage', fur: 0x2f4a9a, belly: 0x3a5ab0, trim: 0xc9a35a,
      tail: 'none', tint: 0x3a5ab0 },
    { name: 'White Mage',  look: 'whitemage', fur: 0xf4f0ea, belly: 0xffffff, trim: 0xc8302e,
      skin: 0xf2cfae, tail: 'none', tint: 0xeee6da },
    { name: 'Cait Sith',   look: 'caitsith', fur: 0x3c3744, belly: 0xf2efe8, trim: 0xc8302e,
      tail: 'up', tint: 0x9a7bc8 },
    { name: 'Mandragora',  look: 'mandragora', fur: 0xe2b98a, belly: 0xf0d2a8, trim: 0x4fae3a,
      tail: 'none', tint: 0xd9a066 }
  ];

  /* Where the dining room's front door is. world.js cuts the hole here and
     orders.js walks customers through it, so the two must agree. */
  CS.DOOR_X = CS.OX + (CS.SERVE_COL + 0.5) * CS.TILE;   // straight behind the queue
  CS.DOOR_W = 2.8;
  CS.MAX_ORDERS_CAP = 5;       // widest the queue ever gets, Roadside Sign included
})(window.CS);
