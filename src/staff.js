/* The hired help.

   A hand reads the live ticket rail, works out what the shop is short of,
   walks the kitchen with a breadth-first path and fixes it. In order of
   urgency they will:

     1. pull a basket that has finished frying before it burns, whoever
        dropped it in, and get it onto a plate or a counter
     2. carry anything burnt -- in a pan or on a counter -- to the bin, so a
        fryer is never left blocked by charcoal
     3. make whatever their trade covers that the tickets are asking for:
        fries, chicken, sauce cups, or a plate with the bun already on

   Finished food goes straight onto a plate on a counter when a ticket wants
   it there, and otherwise onto the free counter nearest the serving window,
   so you always know where to look for it.

   The rules that keep them from getting in the way:
     * nothing is ever put down on top of something else, and nothing good is
       ever thrown away. A station is re-checked the moment a hand arrives at
       it, because you may well have used it while they were walking over.
     * a hand only adds to a plate when the result still matches an open
       ticket, so they can fill in a plate but never spoil one.
     * they never take the last free counter for something that is not
       urgent, never touch the serving window, and never put toppings or
       sandwich sauces on. Dressing the sandwich stays your call.          */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var scene = null;
  var hands = [];

  /* -------------------------------------------------------------- paths
     BFS over open floor. Stations are solid, so the goal is never the
     station tile itself but any floor tile touching it; `goals` is that set.
     The kitchen is a few hundred tiles at most, so a fresh flood per request
     is cheaper than keeping a graph in sync with an editable layout. */
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function walkable(col, row) { return CS.charAt(col, row) === '.'; }

  function adjacentTiles(st) {
    var out = [];
    for (var i = 0; i < 4; i++) {
      var c = st.col + DIRS[i][0], r = st.row + DIRS[i][1];
      if (walkable(c, r)) out.push({ col: c, row: r });
    }
    return out;
  }

  function findPath(fromC, fromR, goals) {
    if (!goals.length) return null;
    var want = {};
    goals.forEach(function (g) { want[g.col + ',' + g.row] = true; });
    if (want[fromC + ',' + fromR]) return [];

    var prev = {}, seen = {}, q = [[fromC, fromR]];
    seen[fromC + ',' + fromR] = true;
    var hit = null;
    while (q.length && !hit) {
      var n = q.shift();
      for (var i = 0; i < 4; i++) {
        var c = n[0] + DIRS[i][0], r = n[1] + DIRS[i][1], k = c + ',' + r;
        if (seen[k] || !walkable(c, r)) continue;
        seen[k] = true;
        prev[k] = n;
        if (want[k]) { hit = [c, r]; break; }
        q.push([c, r]);
      }
    }
    if (!hit) return null;
    var path = [], cur = hit;
    while (cur) {
      path.unshift({ col: cur[0], row: cur[1] });
      cur = prev[cur[0] + ',' + cur[1]];
    }
    path.shift();     // drop the tile we are already standing on
    return path;
  }

  /* ------------------------------------------------------------ plates
     A hand may add something to a plate only if the plate still matches
     *some* open ticket afterwards. `fitsOrder` asks whether a plate could
     still become that order: everything on it is something the order wants,
     with cups counted as a multiset (two ketchups is not one ketchup). */
  function within(a, b) {
    var left = b.slice();
    for (var i = 0; i < a.length; i++) {
      var j = left.indexOf(a[i]);
      if (j < 0) return false;
      left.splice(j, 1);
    }
    return true;
  }

  function openOrders() {
    return CS.orders.list.filter(function (o) { return !o.done; });
  }

  function fitsOrder(plate, o) {
    if (plate.sandwich) {
      if (!o.sandwich) return false;
      if (!within(plate.sandwich.toppings, o.sandwich.toppings)) return false;
      if (!within(plate.sandwich.sauces, o.sandwich.sauces)) return false;
    }
    if (plate.fries && !o.fries) return false;
    return within(plate.cups, o.cups);
  }

  function plateWants(plate, item) {
    if (!plate || plate.k !== 'plate' || !item) return false;
    if (!CS.plateAcceptsWhy(plate, item).ok) return false;
    var s = plate.sandwich;
    var next = {
      k: 'plate', fries: plate.fries, cups: plate.cups.slice(),
      sandwich: s ? { chicken: s.chicken, toppings: s.toppings, sauces: s.sauces } : null
    };
    CS.addToPlate(next, item);
    return openOrders().some(function (o) { return fitsOrder(next, o); });
  }

  /* ------------------------------------------------------- the job board
     Demand is read straight off the live tickets and netted against
     everything already in the pipeline -- on a counter, in a fryer, in the
     chef's wings, in a hand's arms, or already sitting on a plate -- so two
     hands never cook the same portion of fries, and nobody makes a second
     one because you plated the first. */
  function lineOf(item) {
    if (!item) return null;
    if (item.k === 'rawFries' || item.k === 'cookedFries') return 'fries';
    if (item.k === 'rawChicken' || item.k === 'friedChicken') return 'chicken';
    if (item.k === 'cup' && item.sauce) return 'cup:' + item.sauce;
    return null;
  }

  function demand(job) {
    var n = 0;
    openOrders().forEach(function (o) {
      if (job === 'fries') { if (o.fries) n++; }
      else if (job === 'chicken' || job === 'plate') { if (o.sandwich) n++; }
      else o.cups.forEach(function (c) { if ('cup:' + c === job) n++; });
    });
    return n;
  }

  function supply(job, stations) {
    var n = 0;
    function count(item) {
      if (!item) return;
      if (item.k === 'plate') {
        if (job === 'plate' && item.sandwich) n++;
        else if (job === 'fries' && item.fries) n++;
        else if (job === 'chicken' && item.sandwich && item.sandwich.chicken) n++;
        else item.cups.forEach(function (c) { if ('cup:' + c === job) n++; });
        return;
      }
      if (lineOf(item) === job) n++;
    }
    stations.forEach(function (st) { count(st.item); });
    count(CS.game.state.held);
    hands.forEach(function (h) {
      // while a hand's basket is in the oil, the fryer is what counts it
      if (h.makes) { if (h.makes === job && !h.myFryer) n++; }
      else count(h.carry);
    });
    return n;
  }

  /* What a finished unit of `job` looks like -- used both to ask whether a
     plate out there wants one, and as the icon in the hand's thought bubble. */
  function outputOf(job) {
    if (job === 'fries') return { k: 'cookedFries' };
    if (job === 'chicken') return { k: 'friedChicken' };
    if (job === 'plate') {
      var p = CS.newPlate();
      p.sandwich = { chicken: false, toppings: [], sauces: [] };
      return p;
    }
    return { k: 'cup', sauce: job.slice(4) };
  }

  /* ---------------------------------------------------------- stations
     Counters and fryers are claimed by whoever is heading for them, so two
     hands never race to the same spot. Crates, bottles and the bin are
     bottomless and can be shared. */
  function claimedBy(st, me) {
    if (st.type !== 'counter' && st.type !== 'fryer') return false;
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (h === me) continue;
      if (h.dest === st || h.claim === st || h.myFryer === st) return true;
    }
    return false;
  }

  function nearest(h, stations, test) {
    var best = null, bestD = Infinity;
    stations.forEach(function (st) {
      if (!test(st) || claimedBy(st, h)) return;
      if (!adjacentTiles(st).length) return;      // walled in: unusable
      var d = Math.abs(st.col - h.col) + Math.abs(st.row - h.row);
      if (d < bestD) { bestD = d; best = st; }
    });
    return best;
  }

  function isFreeFryer(st) { return st.type === 'fryer' && !st.item && !st.cook; }

  function freeCounters(h, stations) {
    return stations.filter(function (st) {
      return st.type === 'counter' && !st.item && !claimedBy(st, h) && adjacentTiles(st).length;
    });
  }

  /* The free counter nearest the serving window -- the pass. Output always
     lands in the same corner of the kitchen, so you know where to look. The
     last free counter is left for the chef unless `lastOk` (the food would
     burn, or has been carried around for a while with nowhere to go). */
  function passCounter(h, stations, lastOk) {
    var free = freeCounters(h, stations);
    if (!free.length || (free.length < 2 && !lastOk)) return null;
    var serve = stations.filter(function (st) { return st.type === 'serve'; });
    function score(st) {
      var d = 99;
      serve.forEach(function (s) { d = Math.min(d, Math.abs(s.col - st.col) + Math.abs(s.row - st.row)); });
      return d * 2 + Math.abs(st.col - h.col) + Math.abs(st.row - h.row);
    }
    free.sort(function (a, b) { return score(a) - score(b); });
    return free[0];
  }

  /* Where whatever the hand is holding should go. */
  function dropSpot(h, stations) {
    var item = h.carry;
    if (!item) return null;
    if (CS.isBurnt(item)) return nearest(h, stations, function (st) { return st.type === 'trash'; });
    var onPlate = nearest(h, stations, function (st) {
      return st.type === 'counter' && plateWants(st.item, item);
    });
    if (onPlate) return onPlate;
    return passCounter(h, stations, h.urgent || h.holdT > 6);
  }

  function dropStillGood(h, st) {
    if (!h.carry) return false;
    if (st.type === 'trash') return true;
    if (st.type !== 'counter') return false;
    return !st.item || plateWants(st.item, h.carry);
  }

  /* ------------------------------------------------------------- tasks
     A task is: where to go (`at`), whether that place is still right once
     the hand gets there (`ok`), whether to stand and wait (`wait`), and what
     to do when they finally act. `pinned` tasks are tied to one station --
     if that station is no longer any good the job is over. The others just
     pick somewhere else. */
  function lift(h, st) {
    h.carry = st.item;
    CS.game.setStationItem(st, null);
    if (st.type === 'fryer') st.cook = null;
    CS.audio.pick();
  }

  var DELIVER = {
    at: dropSpot,
    ok: dropStillGood,
    act: function (h, st) {
      var item = h.carry;
      if (st.type === 'trash') {
        CS.econ.waste(item);
        CS.audio.trash();
        CS.game.puff(st, 0x6a5f55, 8);
      } else if (st.item && st.item.k === 'plate') {
        CS.addToPlate(st.item, item);
        CS.game.setStationItem(st, st.item);
        CS.audio.place();
        CS.game.puff(st, 0xfff2c8, 8);
      } else {
        CS.game.setStationItem(st, item);
        CS.audio.place();
      }
      h.carry = null;
      h.makes = null;
    },
    deliver: true
  };

  function fryJob(raw) {
    return [
      { at: function (h, s) {
          return nearest(h, s, function (st) { return st.type === 'crate' && st.def.gives === raw; });
        },
        act: function (h) { h.carry = { k: raw }; CS.audio.pick(); } },
      { at: function (h, s) { return nearest(h, s, isFreeFryer); },
        ok: function (h, st) { return isFreeFryer(st); },
        act: function (h, st) {
          CS.game.setStationItem(st, h.carry);
          st.cook = { t: 0, def: CS.cookDef(h.carry.k), stage: 'cooking', warned: false };
          h.carry = null;
          h.myFryer = st;
          CS.audio.drop();
          CS.game.puff(st, 0xffd28a, 8);
        } },
      // stand over the basket and lift it the moment it dings
      { at: function (h) { return h.myFryer; },
        pinned: true,
        ok: function (h, st) { return !!(st.cook && st.item); },
        wait: function (h, st) { return st.cook.stage === 'cooking'; },
        act: function (h, st) { lift(h, st); h.myFryer = null; } },
      DELIVER
    ];
  }

  function cupJob(sauce) {
    return [
      { at: function (h, s) { return nearest(h, s, function (st) { return st.type === 'cups'; }); },
        act: function (h) { h.carry = CS.newCup(); CS.audio.pick(); } },
      { at: function (h, s) {
          return nearest(h, s, function (st) { return st.type === 'sauce' && st.def.ing === sauce; });
        },
        act: function (h) { h.carry.sauce = sauce; CS.audio.sauce(); } },
      DELIVER
    ];
  }

  function plateJob() {
    return [
      { at: function (h, s) { return nearest(h, s, function (st) { return st.type === 'plates'; }); },
        act: function (h) { h.carry = CS.newPlate(); CS.audio.pick(); } },
      { at: function (h, s) { return nearest(h, s, function (st) { return st.type === 'buns'; }); },
        act: function (h) {
          h.carry.sandwich = { chicken: false, toppings: [], sauces: [] };
          CS.audio.place();
        } },
      DELIVER
    ];
  }

  /* Somebody's basket has been sitting cooked for a while: get it out. */
  function rescueJob(fryer) {
    return [
      { at: function () { return fryer; },
        pinned: true,
        ok: function (h, st) { return !!(st.cook && st.item && st.cook.stage !== 'cooking'); },
        act: function (h, st) {
          var burnt = st.cook.stage === 'burnt';
          lift(h, st);
          h.makes = burnt ? null : lineOf(h.carry);
          h.urgent = !burnt;
        } },
      DELIVER
    ];
  }

  function tidyJob(st0) {
    return [
      { at: function () { return st0; },
        pinned: true,
        ok: function (h, st) { return !!(st.item && CS.isBurnt(st.item)); },
        act: lift },
      DELIVER
    ];
  }

  /* ---------------------------------------------------------- choosing */
  function startJob(h, job, tasks, icon, claim) {
    h.job = job;
    h.tasks = tasks;
    h.ti = 0;
    h.dest = null;
    h.path = null;
    h.claim = claim || null;
    h.stuck = 0;
    h.icon = icon;
    h.state = 'walk';
  }

  /* Go for a cooked basket a beat after it dings -- the walk over is most of
     the grace period in a big kitchen, so waiting any longer means arriving
     to charcoal. Leave it alone while an empty-winged chef is stood right by
     it, about to take it herself, unless it is seconds from burning. */
  function needsRescue(st, h) {
    if (st.type !== 'fryer' || !st.cook || st.cook.stage !== 'done' || !st.item) return false;
    if (claimedBy(st, h)) return false;
    var c = st.cook, d = c.def;
    if (c.t - d.cook < 0.6) return false;
    var left = d.cook + d.grace - c.t;
    var P = CS.game.player;
    if (P && !CS.game.state.held && left > 2.5) {
      if (Math.hypot(P.x - st.x, P.z - st.z) < 3.2) return false;
    }
    return true;
  }

  /* The cooked basket nearest to burning that somebody ought to pull. */
  function burning(h, stations) {
    var save = null, saveLeft = Infinity;
    for (var i = 0; i < stations.length; i++) {
      var st = stations[i];
      if (!needsRescue(st, h)) continue;
      var left = st.cook.def.cook + st.cook.def.grace - st.cook.t;
      if (left < saveLeft) { saveLeft = left; save = st; }
    }
    return save;
  }

  function chooseJob(h, stations) {
    // 1. a basket about to burn
    var save = burning(h, stations);
    if (save) {
      startJob(h, 'rescue', rescueJob(save), { k: save.item.k }, save);
      return;
    }

    // 2. anything burnt that is blocking a fryer or a counter
    var junk = nearest(h, stations, function (s) {
      if (!s.item || !CS.isBurnt(s.item)) return false;
      return s.type === 'counter' || (s.type === 'fryer' && s.cook && s.cook.stage === 'burnt');
    });
    if (junk) {
      startJob(h, 'tidy', tidyJob(junk), { k: junk.item.k }, junk);
      return;
    }

    // 3. production, biggest shortfall first
    var free = freeCounters(h, stations).length;
    var best = null, bestGap = 0;
    h.jobs.forEach(function (job) {
      var gap = demand(job) - supply(job, stations);
      if (gap <= bestGap) return;
      // somewhere for it to go: a plate that wants it, or a spare counter
      var room = free >= 2;
      if (!room && job !== 'plate') {
        var out = outputOf(job);
        room = stations.some(function (s) { return s.type === 'counter' && plateWants(s.item, out); });
      }
      if (!room) return;
      if ((job === 'fries' || job === 'chicken') && !nearest(h, stations, isFreeFryer)) return;
      bestGap = gap; best = job;
    });
    if (!best) return;

    var tasks = best === 'fries' ? fryJob('rawFries')
      : best === 'chicken' ? fryJob('rawChicken')
      : best === 'plate' ? plateJob()
      : cupJob(best.slice(4));
    startJob(h, best, tasks, outputOf(best));
    h.makes = best;
  }

  /* The job is over -- done, or overtaken by events. Anything still in their
     arms is delivered rather than dropped, so a hand never throws good food
     away just because its plan fell through. */
  function finish(h) {
    h.job = null; h.tasks = null; h.ti = 0; h.dest = null; h.path = null;
    h.claim = null; h.stuck = 0;
    if (h.myFryer) {
      // a basket of ours is still in the oil: whoever is free will rescue it
      h.myFryer = null;
    }
    if (h.carry) {
      startJob(h, 'deliver', [DELIVER], h.carry);
      h.makes = CS.isBurnt(h.carry) ? null : lineOf(h.carry);
      return;
    }
    h.makes = null;
    h.urgent = false;
    h.icon = null;
    h.state = 'idle';
  }

  /* ---------------------------------------------------------- movement */
  function tileCentre(col, row) { return CS.tileToWorld(col, row); }

  function turnToward(h, want, dt) {
    var diff = ((want - h.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    h.group.rotation.y += diff * Math.min(1, dt * 10);
  }

  function stepToward(h, tx, tz, dt) {
    var dx = tx - h.x, dz = tz - h.z;
    var d = Math.hypot(dx, dz);
    if (d < 0.04) return 0;
    var m = Math.min(d, h.speed * dt);
    h.x += dx / d * m;
    h.z += dz / d * m;
    turnToward(h, Math.atan2(dx, dz), dt);
    return m;
  }

  function animate(h, dt, moved) {
    var p = h.parts;
    h.walk += moved * 5.6;
    h.bob += dt * 2.4;
    h.gait += ((moved > 0.0008 ? 1 : 0) - h.gait) * Math.min(1, dt * 11);
    var sw = Math.sin(h.walk) * 0.8 * h.gait;
    p.legL.rotation.x = sw;
    p.legR.rotation.x = -sw;
    var carrying = h.carry ? 1 : 0;
    p.armL.rotation.x = -sw * 0.6 - carrying * 1.2;
    p.armR.rotation.x = sw * 0.6 - carrying * 1.2;
    // working at a station: both arms busy in front
    if (h.state === 'work') {
      var k = Math.sin(h.timer * 18) * 0.3;
      p.armL.rotation.x = -1.1 + k;
      p.armR.rotation.x = -1.1 - k;
    }
    // a bouncy, squashy waddle -- the chibi bit
    var hop = Math.abs(Math.sin(h.walk));
    h.group.position.y = hop * 0.09 * h.gait + Math.sin(h.bob) * 0.016 * (1 - h.gait);
    var sq = 1 + (hop - 0.5) * 0.08 * h.gait + Math.sin(h.bob * 1.3) * 0.02 * (1 - h.gait);
    p.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    p.body.rotation.z = Math.sin(h.walk) * 0.07 * h.gait;
    if (p.mark) p.mark.visible = !h.job && h.state === 'idle';
  }

  /* Whatever they are carrying rides in the hold slot in front of them. */
  function showCarry(h) {
    var key = h.carry ? JSON.stringify(h.carry) : '';
    if (key === h.carryKey) return;
    h.carryKey = key;
    if (h.carryMesh) { h.parts.hold.remove(h.carryMesh); h.carryMesh = null; }
    if (!h.carry) return;
    var m = CS.models.item(h.carry);
    m.scale.setScalar(0.8);
    h.parts.hold.add(m);
    h.carryMesh = m;
  }

  /* A little thought bubble over their head with what they are working on,
     so you can always tell what the help is up to. It turns amber when they
     are stood holding something with nowhere to put it. */
  function showBubble(h, camera) {
    var b = h.bubble;
    var want = h.job && h.icon ? h.icon : null;
    var key = want ? JSON.stringify(want) : '';
    if (key !== h.iconKey) {
      h.iconKey = key;
      while (b.icon.children.length) b.icon.remove(b.icon.children[0]);
      if (want) {
        var m = CS.models.item(want);
        m.scale.setScalar(want.k === 'plate' ? 0.48 : 0.62);
        b.icon.add(m);
      }
    }
    b.group.visible = !!want;
    if (!want) return;
    var alert = h.stuck > 1.2;
    b.setAlert(alert);
    b.pop = Math.min(1, b.pop + 0.08);
    var s = 0.6 + 0.4 * b.pop;
    b.group.scale.setScalar(s);
    b.group.position.set(h.x, 2.35 + Math.sin(h.bob * 1.6) * 0.05 + h.group.position.y, h.z);
    if (camera) b.group.quaternion.copy(camera.quaternion);
    b.icon.rotation.y += 0.02;
  }

  /* ------------------------------------------------------------- update */
  function updateHand(h, dt, stations) {
    if (h.carry) h.holdT += dt; else h.holdT = 0;

    // A basket about to burn outranks any errand an empty-handed hand is on:
    // drop the plan and go and save it. Even a hand minding its own basket
    // will go, if its own still has plenty of time -- that basket is then
    // anybody's to pull when it dings.
    if (h.job && h.job !== 'rescue' && h.job !== 'tidy' && !h.carry) {
      h.scanT += dt;
      var mine = h.myFryer && h.myFryer.cook;
      var slack = mine ? mine.def.cook + mine.def.grace - mine.t : Infinity;
      if (h.scanT > 0.3 && slack > 8) {
        h.scanT = 0;
        var save = burning(h, stations);
        if (save) {
          h.makes = null;
          h.myFryer = null;
          startJob(h, 'rescue', rescueJob(save), { k: save.item.k }, save);
        }
      }
    }

    if (!h.job) {
      h.idleFor += dt;
      if (h.idleFor > 0.25) { h.idleFor = 0; chooseJob(h, stations); }
      if (!h.job) {
        h.bubble.pop = 0;
        // drift back to a home tile so idle hands are not stood in a doorway
        var hm = tileCentre(h.home.col, h.home.row);
        var m0 = stepToward(h, hm.x, hm.z, dt);
        if (m0 === 0) { h.col = h.home.col; h.row = h.home.row; }
        h.state = m0 > 0 ? 'walk' : 'idle';
        return m0;
      }
    }

    var task = h.tasks[h.ti];
    if (!task) { finish(h); return 0; }

    if (!h.dest) {
      var st = task.at(h, stations);
      var path = st ? findPath(h.col, h.row, adjacentTiles(st)) : null;
      if (!st || !path) {
        // nowhere to go right now. A delivery just keeps hold and waits --
        // good food is never binned -- anything else gives up after a bit
        h.stuck += dt;
        h.state = 'idle';
        if (!task.deliver && (task.pinned || h.stuck > 5)) finish(h);
        return 0;
      }
      h.stuck = 0;
      h.dest = st;
      h.path = path;
      h.state = 'walk';
    }

    // ---- walk the path. Re-check pinned targets on the way, so a hand
    // turns back the moment the basket it was going for is taken.
    if (h.path && h.path.length) {
      if (task.pinned && task.ok && !task.ok(h, h.dest)) { finish(h); return 0; }
      var step = h.path[0];
      var p = tileCentre(step.col, step.row);
      var moved = stepToward(h, p.x, p.z, dt);
      if (moved === 0) {
        h.col = step.col; h.row = step.row;
        h.path.shift();
      }
      return moved;
    }

    // ---- arrived. Is the spot still any good? You may have got there first.
    var d = h.dest;
    if (task.ok && !task.ok(h, d)) {
      h.dest = null; h.path = null; h.timer = 0;
      if (task.pinned) finish(h);
      return 0;
    }

    turnToward(h, Math.atan2(d.x - h.x, d.z - h.z), dt);

    if (task.wait && task.wait(h, d)) { h.state = 'idle'; h.timer = 0; return 0; }

    h.state = 'work';
    h.timer += dt;
    if (h.timer < h.act) return 0;
    h.timer = 0;

    task.act(h, d);
    h.ti++;
    h.dest = null;
    h.path = null;
    if (h.ti >= h.tasks.length) finish(h);
    return 0;
  }

  /* ------------------------------------------------------------- module */
  CS.staff = {
    hands: hands,

    init: function (sc) { scene = sc; },

    /* Rebuild the crew from the payroll. Called at the start of every day, so
       a hire made in the shop is on the floor the moment the shift opens. */
    spawn: function () {
      CS.staff.clear();
      var crew = CS.econ.crew();
      crew.forEach(function (c, i) {
        var m = CS.models.assistant(c.kind);
        var home = homeTile(i);
        var p = tileCentre(home.col, home.row);
        var h = {
          kind: c.kind, name: c.name, jobs: c.jobs.slice(),
          speed: c.speed, act: c.act,
          group: m.group, parts: m.parts, bubble: CS.models.thoughtBubble(),
          col: home.col, row: home.row, x: p.x, z: p.z,
          home: home,
          job: null, tasks: null, ti: 0, dest: null, path: null, claim: null,
          carry: null, carryMesh: null, carryKey: '', myFryer: null, makes: null,
          icon: null, iconKey: '', urgent: false, holdT: 0,
          state: 'idle', timer: 0, idleFor: 0, stuck: 0, scanT: 0,
          walk: 0, bob: Math.random() * 6.28, gait: 0
        };
        h.group.position.set(p.x, 0, p.z);
        h.group.scale.setScalar(1.15);
        scene.add(h.group);
        scene.add(h.bubble.group);
        hands.push(h);
      });
    },

    clear: function () {
      hands.forEach(function (h) {
        scene.remove(h.group);
        scene.remove(h.bubble.group);
      });
      hands.length = 0;
    },

    /* Drop everything mid-shift (the day ended, or the kitchen was rebuilt
       under them and their path now runs through a wall). */
    reset: function () {
      hands.forEach(function (h) {
        h.carry = null; showCarry(h);
        h.myFryer = null;
        finish(h);
        var p = tileCentre(h.home.col, h.home.row);
        h.col = h.home.col; h.row = h.home.row;
        h.x = p.x; h.z = p.z;
        h.group.position.set(p.x, 0, p.z);
      });
    },

    update: function (dt, stations, camera) {
      for (var i = 0; i < hands.length; i++) {
        var h = hands[i];
        var moved = updateHand(h, dt, stations);
        h.group.position.x = h.x;
        h.group.position.z = h.z;
        animate(h, dt, moved);
        showCarry(h);
        showBubble(h, camera);
      }
    },

    /* For the steam: every hot thing a hand is carrying, and where it is. */
    carried: function (fn) {
      hands.forEach(function (h) { if (h.carry && h.carryMesh) fn(h.carry, h.carryMesh); });
    }
  };

  /* Idle hands stand just inside the kitchen, spread out along the back so
     they are never blocking the chef's run between the fryers and the window. */
  function homeTile(i) {
    var b = CS.layout.bounds;
    var row = Math.max(b.r0 + 1, b.r1 - 2);
    var col = CS.clamp(b.c0 + 2 + i * 2, b.c0 + 1, b.c1 - 1);
    for (var tries = 0; tries < 24; tries++) {
      if (walkable(col, row)) return { col: col, row: row };
      col++;
      if (col >= b.c1) { col = b.c0 + 1; row--; }
      if (row <= b.r0) break;
    }
    return { col: CS.SPAWN.col, row: CS.SPAWN.row };
  }
})(window.CS);
