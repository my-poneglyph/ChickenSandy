/* The hired help.

   Every assistant runs one tight loop and refuses to do anything else, which
   is the whole point: you should always be able to glance at the potato and
   know what it is about to do. A hand picks a job only when the ticket rail
   actually calls for one, walks the kitchen with a breadth-first path, works
   a station for a beat, and leaves the result on a prep counter for you to
   build into a plate.

   They never touch the serving window and never assemble a plate. Deciding
   what goes on the plate stays your job -- they just keep you in stock.    */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var scene = null;
  var hands = [];
  var T = CS.TILE;

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

  /* ------------------------------------------------------- the job board
     Demand is read straight off the live tickets and netted against what is
     already in the pipeline, so two hands never cook the same portion of
     fries and nobody fills a counter with cups nobody ordered. */
  function wanted(job) {
    var n = 0;
    CS.orders.list.forEach(function (o) {
      if (o.done) return;
      if (job === 'fries') { if (o.fries) n++; return; }
      if (job === 'chicken') { if (o.sandwich) n++; return; }
      var sauce = job.slice(4);
      o.cups.forEach(function (c) { if (c === sauce) n++; });
    });
    return n;
  }

  /* What a finished unit of `job` looks like sitting on a counter. */
  function isOutput(job, item) {
    if (!item) return false;
    if (job === 'fries') return item.k === 'cookedFries' || item.k === 'rawFries';
    if (job === 'chicken') return item.k === 'friedChicken' || item.k === 'rawChicken';
    return item.k === 'cup' && item.sauce === job.slice(4);
  }

  function inPipeline(job, stations) {
    var n = 0;
    stations.forEach(function (st) { if (isOutput(job, st.item)) n++; });
    hands.forEach(function (h) { if (h.job === job) n++; });
    return n;
  }

  /* ---------------------------------------------------------- stations */
  function pickStation(stations, test) {
    var best = null, bestD = Infinity, hand = pickStation.hand;
    stations.forEach(function (st) {
      if (!test(st)) return;
      if (!adjacentTiles(st).length) return;      // walled in: unusable
      var d = hand ? Math.abs(st.col - hand.col) + Math.abs(st.row - hand.row) : 0;
      if (d < bestD) { bestD = d; best = st; }
    });
    return best;
  }

  function freeCounter(stations, hand) {
    pickStation.hand = hand;
    return pickStation(stations, function (st) { return st.type === 'counter' && !st.item; });
  }
  function crateGiving(give) {
    return function (stations, hand) {
      pickStation.hand = hand;
      return pickStation(stations, function (st) {
        return st.type === 'crate' && st.def.gives === give;
      });
    };
  }
  function freeFryer(stations, hand) {
    pickStation.hand = hand;
    return pickStation(stations, function (st) {
      return st.type === 'fryer' && !st.item && !st.cook;
    });
  }
  function sauceBottle(ing) {
    return function (stations, hand) {
      pickStation.hand = hand;
      return pickStation(stations, function (st) {
        return st.type === 'sauce' && st.def.ing === ing;
      });
    };
  }
  function cupStack(stations, hand) {
    pickStation.hand = hand;
    return pickStation(stations, function (st) { return st.type === 'cups'; });
  }

  /* ------------------------------------------------------------- tasks
     A task is: where to stand, whether to keep waiting once you are there,
     and what to do when you finally act. A job is a list of them. */
  function fryJob(raw) {
    return [
      { at: crateGiving(raw),
        act: function (h) { h.carry = { k: raw }; } },
      { at: freeFryer,
        act: function (h, st) {
          var def = CS.cookDef(h.carry.k);
          CS.game.setStationItem(st, h.carry);
          st.cook = { t: 0, def: def, stage: 'cooking' };
          h.carry = null;
          h.myFryer = st;
          CS.audio.drop();
        } },
      { at: function (s, h) { return h.myFryer; },
        // stand over the basket until it is actually cooked, then lift it out
        // the moment it dings -- which is the whole value of the hire
        wait: function (h, st) { return !!(st.cook && st.cook.stage === 'cooking'); },
        act: function (h, st) {
          h.carry = st.item;
          CS.game.setStationItem(st, null);
          st.cook = null;
          h.myFryer = null;
          CS.audio.pick();
        } },
      { at: function (s, h) {
          // a burnt basket goes straight in the bin, not onto a prep counter
          if (h.carry && CS.isBurnt(h.carry)) {
            pickStation.hand = h;
            return pickStation(s, function (st) { return st.type === 'trash'; });
          }
          return freeCounter(s, h);
        },
        act: function (h, st) {
          if (st.type === 'trash') {
            CS.econ.waste(h.carry);
            CS.audio.trash();
          } else {
            CS.game.setStationItem(st, h.carry);
            CS.audio.place();
          }
          h.carry = null;
        } }
    ];
  }

  function cupJob(sauce) {
    return [
      { at: cupStack, act: function (h) { h.carry = CS.newCup(); } },
      { at: sauceBottle(sauce),
        act: function (h) { h.carry.sauce = sauce; CS.audio.sauce(); } },
      { at: freeCounter,
        act: function (h, st) {
          CS.game.setStationItem(st, h.carry);
          h.carry = null;
          CS.audio.place();
        } }
    ];
  }

  function tasksFor(job) {
    if (job === 'fries') return fryJob('rawFries');
    if (job === 'chicken') return fryJob('rawChicken');
    return cupJob(job.slice(4));
  }

  /* ---------------------------------------------------------- movement */
  function tileCentre(col, row) { return CS.tileToWorld(col, row); }

  function stepToward(h, tx, tz, dt) {
    var dx = tx - h.x, dz = tz - h.z;
    var d = Math.hypot(dx, dz);
    if (d < 0.04) return 0;
    var m = Math.min(d, h.speed * dt);
    h.x += dx / d * m;
    h.z += dz / d * m;
    var want = Math.atan2(dx, dz);
    var diff = ((want - h.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    h.group.rotation.y += diff * Math.min(1, dt * 9);
    return m;
  }

  function animate(h, dt, moved) {
    var p = h.parts;
    h.walk += moved * 5.2;
    h.bob += dt * 2.2;
    h.gait += ((moved > 0.0008 ? 1 : 0) - h.gait) * Math.min(1, dt * 11);
    var sw = Math.sin(h.walk) * 0.75 * h.gait;
    p.legL.rotation.x = sw;
    p.legR.rotation.x = -sw;
    p.armL.rotation.x = -sw * 0.6;
    p.armR.rotation.x = sw * 0.6;
    // working at a station: both arms busy in front
    if (h.state === 'work') {
      var k = Math.sin(h.timer * 18) * 0.3;
      p.armL.rotation.x = -1.1 + k;
      p.armR.rotation.x = -1.1 - k;
    }
    h.group.position.y = Math.abs(Math.sin(h.walk)) * 0.05 * h.gait
      + Math.sin(h.bob) * 0.014 * (1 - h.gait);
    if (p.mark) p.mark.visible = h.state === 'idle';
  }

  /* Whatever they are carrying rides in the hold slot in front of them. */
  function showCarry(h) {
    if (h.carryMesh) { h.parts.hold.remove(h.carryMesh); h.carryMesh = null; }
    if (!h.carry) return;
    var m = CS.models.item(h.carry);
    m.scale.setScalar(0.8);
    h.parts.hold.add(m);
    h.carryMesh = m;
  }

  /* ------------------------------------------------------------- update */
  function abort(h) {
    h.job = null; h.tasks = null; h.ti = 0; h.dest = null; h.path = null;
    h.myFryer = null;
    h.state = 'idle';
  }

  function chooseJob(h, stations) {
    // never take the last free counter: the player needs somewhere to work
    var free = 0;
    stations.forEach(function (st) { if (st.type === 'counter' && !st.item) free++; });
    if (free < 2) return;

    var best = null, bestGap = 0;
    h.jobs.forEach(function (job) {
      var gap = wanted(job) - inPipeline(job, stations);
      if (gap > bestGap) { bestGap = gap; best = job; }
    });
    if (!best) return;
    h.job = best;
    h.tasks = tasksFor(best);
    h.ti = 0;
    h.dest = null;
    h.state = 'walk';
  }

  function updateHand(h, dt, stations) {
    if (!h.job) {
      h.idleFor += dt;
      if (h.idleFor > 0.35) { h.idleFor = 0; chooseJob(h, stations); }
      if (!h.job) {
        // drift back to a home tile so idle hands are not stood in a doorway
        var hm = tileCentre(h.home.col, h.home.row);
        var m0 = stepToward(h, hm.x, hm.z, dt);
        h.state = m0 > 0 ? 'walk' : 'idle';
        return m0;
      }
    }

    var task = h.tasks[h.ti];
    if (!task) { abort(h); return 0; }

    if (!h.dest) {
      var st = task.at(stations, h);
      if (!st) {
        // nothing suitable exists right now; put down whatever we are holding
        // so the hand is not frozen carrying a cup forever
        h.stuck += dt;
        if (h.stuck > 2.5) {
          if (h.carry) {
            var drop = freeCounter(stations, h);
            if (drop) { CS.game.setStationItem(drop, h.carry); h.carry = null; showCarry(h); }
            else { CS.econ.waste(h.carry); h.carry = null; showCarry(h); }
          }
          abort(h); h.stuck = 0;
        }
        return 0;
      }
      h.stuck = 0;
      var path = findPath(h.col, h.row, adjacentTiles(st));
      if (!path) { abort(h); return 0; }
      h.dest = st;
      h.path = path;
      h.state = 'walk';
    }

    // ---- walk the path
    if (h.path && h.path.length) {
      var step = h.path[0];
      var p = tileCentre(step.col, step.row);
      var moved = stepToward(h, p.x, p.z, dt);
      if (moved === 0) {
        h.col = step.col; h.row = step.row;
        h.path.shift();
      }
      return moved;
    }

    // ---- arrived: face the station, then work it
    var d = h.dest;
    var want = Math.atan2(d.x - h.x, d.z - h.z);
    var diff = ((want - h.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    h.group.rotation.y += diff * Math.min(1, dt * 9);

    if (task.wait && task.wait(h, d)) { h.state = 'idle'; h.timer = 0; return 0; }

    h.state = 'work';
    h.timer += dt;
    if (h.timer < h.act) return 0;
    h.timer = 0;

    task.act(h, d);
    showCarry(h);
    h.ti++;
    h.dest = null;
    h.path = null;
    if (h.ti >= h.tasks.length) abort(h);
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
          group: m.group, parts: m.parts,
          col: home.col, row: home.row, x: p.x, z: p.z,
          home: home,
          job: null, tasks: null, ti: 0, dest: null, path: null,
          carry: null, carryMesh: null, myFryer: null,
          state: 'idle', timer: 0, idleFor: 0, stuck: 0,
          walk: 0, bob: Math.random() * 6.28, gait: 0
        };
        h.group.position.set(p.x, 0, p.z);
        h.group.scale.setScalar(1.15);
        scene.add(h.group);
        hands.push(h);
      });
    },

    clear: function () {
      hands.forEach(function (h) { scene.remove(h.group); });
      hands.length = 0;
    },

    /* Drop everything mid-shift (the day ended, or the kitchen was rebuilt
       under them and their path now runs through a wall). */
    reset: function () {
      hands.forEach(function (h) {
        h.carry = null; showCarry(h);
        abort(h);
        var p = tileCentre(h.home.col, h.home.row);
        h.col = h.home.col; h.row = h.home.row;
        h.x = p.x; h.z = p.z;
        h.group.position.set(p.x, 0, p.z);
      });
    },

    update: function (dt, stations) {
      for (var i = 0; i < hands.length; i++) {
        var h = hands[i];
        var moved = updateHand(h, dt, stations);
        h.group.position.x = h.x;
        h.group.position.z = h.z;
        animate(h, dt, moved);
      }
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
