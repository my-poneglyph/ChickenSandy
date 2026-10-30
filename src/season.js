/* Seasonal menus. Loaded straight after config.js.

   Through November the shop becomes THANKSGIVING CHICKEN SANDY: fried
   turkey on a dinner roll, kale and corn on the side, gravy or cranberry
   sauce poured over, a scoop of mashed potatoes and a slice of pumpkin pie.

   It is a relabelling of the kitchen you already own, not a second kitchen.
   Every station keeps its tile and its job -- the chicken crate hands out
   turkey, the potato bin's potatoes cook down into mash, the cup dispenser
   holds pie crusts that you fill at the pumpkin station -- so a save, a
   trained crew and a laid-out kitchen all carry straight on into the
   special and back out of it on the 1st of December.

   Which menu is up, first match wins:
     ?season=thanksgiving | ?season=classic     in the URL, for testing
     window.CS_SEASON                            set by a page that pins one
                                                 (the standalone builds do)
     the real calendar                           November = Thanksgiving     */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  function pick() {
    var m = /[?&]season=(\w+)/.exec(location.search);
    if (m && (m[1] === 'thanksgiving' || m[1] === 'classic')) return m[1];
    if (window.CS_SEASON === 'thanksgiving' || window.CS_SEASON === 'classic') return window.CS_SEASON;
    return new Date().getMonth() === 10 ? 'thanksgiving' : 'classic';
  }

  CS.SEASON = pick();
  CS.isThanksgiving = CS.SEASON === 'thanksgiving';
  if (!CS.isThanksgiving) return;

  CS.TITLE = 'Thanksgiving Chicken Sandy';
  document.title = 'Thanksgiving Chicken Sandy — Turkey Shift';

  function set(obj, patch) { for (var k in patch) if (patch.hasOwnProperty(k)) obj[k] = patch[k]; }

  /* ------------------------------------------------------- the food */
  set(CS.ITEMS.rawChicken,   { label: 'Raw Turkey',      short: 'Raw Turkey', color: 0xe9b1a2 });
  set(CS.ITEMS.friedChicken, { label: 'Fried Turkey',    short: 'Turkey',     color: 0xb8672a });
  set(CS.ITEMS.burntChicken, { label: 'Burnt Turkey',    short: 'Burnt!' });
  set(CS.ITEMS.rawFries,     { label: 'Potatoes',        short: 'Potatoes',   color: 0xc49a62 });
  set(CS.ITEMS.cookedFries,  { label: 'Mashed Potatoes', short: 'Mash',       color: 0xf3e6c4 });
  set(CS.ITEMS.burntFries,   { label: 'Scorched Mash',   short: 'Burnt!' });
  set(CS.ITEMS.cup,          { label: 'Pie Crust',       short: 'Pie' });
  CS.COOK.rawChicken.label = 'Turkey';
  CS.COOK.rawFries.label = 'Mash';

  set(CS.ING.lettuce, { label: 'Kale',      color: 0x2f7a3e, css: '#2f7a3e' });
  set(CS.ING.pickle,  { label: 'Corn',      color: 0xf2c230, css: '#f2c230' });
  set(CS.ING.mayo,    { label: 'Gravy',     color: 0x8a5428, css: '#8a5428' });
  set(CS.ING.bbq,     { label: 'Cranberry', color: 0xa8143c, css: '#a8143c' });
  set(CS.ING.ketchup, { label: 'Pumpkin',   color: 0xe07b22, css: '#e07b22' });

  // Gravy or cranberry goes over the turkey, never both. Pie is the only
  // thing that comes in a crust, and nothing else does.
  CS.SANDWICH_SAUCES = ['mayo', 'bbq', 'hot'];
  CS.CUP_SAUCES = ['ketchup'];
  CS.MENU = { tops: ['lettuce', 'pickle'], sauces: ['mayo', 'bbq'], cups: ['ketchup'], maxSauce: 1 };

  set(CS.WORDS, {
    main: 'Fried Turkey', mainShort: 'Turkey', base: 'Dinner Roll', protein: 'turkey',
    mainDone: 'Fried turkey on a roll', mainBare: 'Roll only — needs turkey',
    side: 'Mashed Potatoes', sideShort: 'Mash', sideOn: 'Mashed potatoes on the side',
    cup: 'Pumpkin Pie', cups: 'Pumpkin Pies', cupShort: 'Pie', cupEmpty: 'Pie Crust',
    cupFilled: function (ing) { return ing === 'ketchup' ? 'Pumpkin Pie' : CS.ING[ing].label + ' Pie'; },
    cupTake: 'Take a Pie Crust', cupFill: 'Fill the Crust with ', cupNoun: 'pie crust', cupFull: 'That pie is already filled',
    mainLine: 'fried turkey', sideLine: 'mashed potatoes', cupLine: 'pumpkin pie',
    dressings: 'gravy and cranberry', basePlates: 'roll plates', toppings: 'sides', sauces: 'gravy or cranberry',
    fryWhat: 'Drop in turkey or potatoes', fryNot: 'That does not go on the stove',
    fryer: 'Stove', pour: 'Pour ', fryVerb: 'Cook the '
  });

  /* ---------------------------------------------------- the stations */
  set(CS.STATION_DEFS.F, { name: 'Stove' });
  set(CS.STATION_DEFS.K, { name: 'Turkey Crate' });
  set(CS.STATION_DEFS.B, { name: 'Roll Basket' });
  set(CS.STATION_DEFS.L, { name: 'Kale Tray' });
  set(CS.STATION_DEFS.I, { name: 'Corn Tray' });
  set(CS.STATION_DEFS.M, { name: 'Gravy Boat' });
  set(CS.STATION_DEFS.Q, { name: 'Cranberry Sauce' });
  set(CS.STATION_DEFS.Y, { name: 'Pumpkin Filling' });
  set(CS.STATION_DEFS.U, { name: 'Pie Crusts' });

  set(CS.STATION_LABELS, {
    F: 'Stove', K: 'Turkey', B: 'Rolls', L: 'Kale', I: 'Corn',
    M: 'Gravy', Q: 'Cranberry', Y: 'Pumpkin', U: 'Pie Crusts'
  });
  set(CS.LABEL_ACCENT, {
    F: '#b5531f', L: '#2f7a3e', I: '#c99a1c', M: '#8a5428', Q: '#a8143c', Y: '#d0661a', U: '#b5862e'
  });

  var PART_NAMES = {
    fryer: 'Stove', chicken: 'Turkey Crate', buns: 'Roll Basket', cups: 'Pie Crusts',
    ketchup: 'Pumpkin Filling', bbq: 'Cranberry Sauce', mayo: 'Gravy Boat',
    lettuce: 'Kale Tray', pickles: 'Corn Tray'
  };
  CS.UPGRADES.forEach(function (u) {
    if (PART_NAMES[u.id]) u.name = PART_NAMES[u.id];
    if (u.id === 'basket') u.blurb = 'Everything on the stove cooks 15% faster.';
    if (u.id === 'basket2') u.blurb = 'Another 15% off the stove clock.';
    if (u.id === 'thermo') u.blurb = 'Half again as long before the stove burns anything.';
    if (u.id === 'tray') u.blurb = 'Fit a fourth pie on a plate.';
  });

  /* ------------------------------------------------------- the crew */
  CS.STAFF_DEFS.potato.blurb = 'Mashes potatoes and spoons them onto your plates. Pulls anything off the stove before it burns.';
  CS.STAFF_DEFS.tomato.blurb = 'Sets out plates with a roll on, fills pumpkin pies and adds them to your plates.';
  CS.STAFF_DEFS.egg.blurb = 'Fries turkey and lays it on any roll that is waiting for it.';
  CS.STAFF_DEFS.lettuce.blurb = 'Spoons kale and corn onto plated turkey, whatever the ticket asks for.';
  CS.TRAINING.potato[0].name = 'Turkey Ticket';
  CS.TRAINING.potato[0].blurb = 'Spud learns to fry turkey too.';
  CS.TRAINING.egg[0].name = 'Two Pots';
  CS.TRAINING.egg[0].blurb = 'Clucky learns to mash potatoes too.';
  CS.TRAINING.lettuce[0].name = 'Gravy Ladle';
  CS.TRAINING.lettuce[0].blurb = 'Sprout learns to pour gravy and cranberry as well.';
  CS.TRAINING.tomato[0].blurb = 'Dollop learns the rest of the pantry. (Only pumpkin pie is on this month\'s menu.)';

  /* ---------------------------------------------- the learning days
     The same nine days and the same pacing, one Thanksgiving idea at a time. */
  var DAYS = [
    { name: 'Opening Day', tag: 'One guest at a time. The whole castle smells like November.',
      howto: 'Plate, then a dinner roll, then fried turkey. Carry it to the window.',
      unlocks: ['Fried turkey on a roll'] },
    { name: 'Finding Your Feet', tag: 'Two tickets on the rail now.',
      howto: 'Drop the next turkey on the stove while you plate the last one.',
      unlocks: ['A second ticket'] },
    { name: 'Mash It Up', tag: 'A scoop of creamy mashed potatoes on the side.',
      howto: 'Potatoes from the bin cook down to mash on the stove. Add it to the plate.',
      unlocks: ['Mashed potatoes'] },
    { name: 'Leafy Greens', tag: 'The kale tray opens up.',
      howto: 'Hold a plate with a roll on it at the kale tray and USE it.',
      unlocks: ['Kale'] },
    { name: 'Harvest Corn', tag: 'Sweet corn joins the kale.',
      howto: 'Sides go on in any order. Just match the ticket.',
      unlocks: ['Corn', 'A third ticket'] },
    { name: 'Gravy Train', tag: 'Gravy and cranberry sauce on the back wall.',
      howto: 'Pour gravy OR cranberry over the turkey, just like adding a side. Never both.',
      unlocks: ['Gravy', 'Cranberry sauce'] },
    { name: 'Full Plates', tag: 'Hungrier guests: sides and sauce on nearly everything.',
      howto: 'Read the ticket twice: kale, corn, and which sauce.',
      unlocks: ['Fully loaded turkey plates'] },
    { name: 'Pie Time', tag: 'Pumpkin pie for dessert.',
      howto: 'Take a pie crust, fill it at the pumpkin filling, add it to the plate.',
      unlocks: ['Pumpkin pie'] },
    { name: 'Seconds on Pie', tag: 'Some guests want a pie to take home as well.',
      howto: 'Two pies on a ticket means two crusts to fill.',
      unlocks: ['Two pies per plate'] }
  ];

  function onMenu(want, menu) {
    return (want || []).filter(function (id) { return menu.indexOf(id) >= 0; });
  }

  CS.LEVELS.forEach(function (lv, i) {
    var d = DAYS[i];
    if (d) { lv.name = d.name; lv.tag = d.tag; lv.howto = d.howto; lv.unlocks = d.unlocks; }
    lv.tops = onMenu(lv.tops, CS.MENU.tops);
    lv.sauces = onMenu(lv.sauces, CS.MENU.sauces);
    lv.cups = onMenu(lv.cups, CS.MENU.cups);
    lv.maxTop = Math.min(lv.maxTop, lv.tops.length);
    lv.maxSauce = Math.min(lv.maxSauce, CS.MENU.maxSauce);
  });
  // "Full Plates" is the day the old menu brought in hot sauce: here it just
  // asks for the whole plate, so give it a touch more patience
  CS.LEVELS[6].limit = [CS.LEVELS[6].limit[0] + 4, CS.LEVELS[6].limit[1] + 4];

  if (CS.CHAPTERS[1]) {
    CS.CHAPTERS[1].season = 'Harvest Market';
    CS.CHAPTERS[1].tag = 'The harvest is in, and the whole town is coming to dinner.';
  }
  if (CS.CHAPTERS[2]) {
    CS.CHAPTERS[2].season = 'Feast Season';
    CS.CHAPTERS[2].tag = 'Knights home for the holiday, every one of them starving.';
    CS.CHAPTERS[2].howto = 'Fully loaded plates. Save Feather Frenzy for a full rail.';
    CS.CHAPTERS[2].harder = ['Fully loaded plates', 'Faster arrivals'];
  }

  // a fried chicken who fries turkey: the customers have noticed
  CS.THANKS_SIGNS = [['Happy', 'Thanksgiving', '♥'], ['Fried Turkey', '& Pumpkin Pie', '= Thankful']];
})(window.CS);
