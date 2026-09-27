/* Customers, tickets and order matching. Owns the 3D queue outside the window. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var scene = null;
  var nextId = 1;

  function ri(n) { return Math.floor(Math.random() * n); }
  function sample(arr, n) { return CS.shuffle(arr.slice()).slice(0, n); }

  function setEq(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) < 0) return false;
    return true;
  }
  function multisetEq(a, b) {
    if (a.length !== b.length) return false;
    var x = a.slice().sort(), y = b.slice().sort();
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  /* ------------------------------------------------- where people stand
     The queue runs from the serving window back towards the front door, so
     an arrival joins the end of it the moment they are through the frame. */
  function queueSpot(i) {
    var p = CS.tileToWorld(CS.SERVE_COL, 0);
    return { x: p.x + (i % 2 ? 0.55 : -0.35), z: CS.OZ - 1.5 - i * 1.75 };
  }

  var WALL_Z = CS.OZ - 9.5;              // the dining room's back wall
  var OUTSIDE_Z = WALL_Z - 2.9;          // out on the porch, hidden by the wall
  var THRESHOLD_Z = WALL_Z + 0.15;       // in the door frame
  var INSIDE_Z = WALL_Z + 1.7;           // one step inside
  var EXIT_X = CS.DOOR_X + 2.3;          // served customers leave down their own
                                         // lane, rather than back through the queue
  var WALK = 2.1, HURRY = 3.4;

  /* Move `g` towards (tx,tz) at a constant speed, turning to face the way it
     is going. Returns the distance actually covered, which is what drives the
     walk cycle -- animating off a timer instead leaves legs paddling while a
     customer stands still. */
  function stepToward(g, tx, tz, speed, dt) {
    var dx = tx - g.position.x, dz = tz - g.position.z;
    var d = Math.hypot(dx, dz);
    if (d < 0.015) return 0;
    var m = Math.min(d, speed * dt);
    g.position.x += dx / d * m;
    g.position.z += dz / d * m;
    var want = Math.atan2(dx, dz);
    var diff = ((want - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.rotation.y += diff * Math.min(1, dt * 8);
    return m;
  }

  /* Turn back to face the serving window once they have stopped. */
  function faceCounter(g, dt) {
    var diff = ((0 - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.rotation.y += diff * Math.min(1, dt * 6);
  }

  function animateCust(c, dt, moved) {
    var p = c.parts, sp = p.species;
    c.walk += moved * 4.4;
    c.bob += dt * 1.9;
    // gait eases between standing and walking so nothing snaps
    c.gait += ((moved > 0.0008 ? 1 : 0) - c.gait) * Math.min(1, dt * 11);
    var sw = Math.sin(c.walk) * 0.8 * c.gait;
    p.legL.rotation.x = sw;
    p.legR.rotation.x = -sw;
    p.armL.rotation.x = -sw * 0.7;
    p.armR.rotation.x = sw * 0.7;
    c.group.position.y = Math.abs(Math.sin(c.walk)) * 0.06 * c.gait
      + Math.sin(c.bob) * 0.016 * (1 - c.gait);
    if (sp.tail === 'wag') {
      // a pup wags hard while walking and idles with a slow sweep
      p.tail.rotation.y = Math.sin(c.walk * 1.6 + c.bob * 4) * (0.25 + 0.45 * c.gait);
    } else if (sp.tail !== 'none') {
      p.tail.rotation.y = Math.sin(c.bob * 1.15) * 0.16;
    }
  }

  var O = CS.orders = {
    list: [],
    leaving: [],
    coins: [],
    spawnTimer: 0,
    level: null,

    init: function (sc) { scene = sc; this.level = CS.levelFor(1); },

    reset: function (level) {
      this.list.forEach(function (o) { scene.remove(o.cust.group); });
      this.leaving.forEach(function (c) { scene.remove(c.group); });
      this.coins.forEach(function (c) { scene.remove(c.m); });
      this.list.length = 0;
      this.leaving.length = 0;
      this.coins.length = 0;
      this.level = level || CS.levelFor(1);
      this.spawnTimer = CS.FIRST_SPAWN;
      nextId = 1;
    },

    /* ------------------------------------------------------- generation
       `progress` is 0..1 through the current day, so tickets that arrive late
       in a shift are fussier than the ones that opened it. */
    makeTicket: function (progress) {
      var lv = this.level;
      var cx = CS.clamp(progress, 0, 1);
      var ramp = 0.6 + 0.4 * cx;

      var sideOnly = lv.friesChance > 0 || lv.cupChance > 0;
      var wantsSandwich = !sideOnly || Math.random() < 0.84;
      var wantsFries = Math.random() < lv.friesChance * ramp;
      var nCups = 0;
      if (Math.random() < lv.cupChance * ramp) {
        nCups = 1;
        if (Math.random() < lv.twoCupChance) nCups = 2;
      }
      if (!wantsSandwich && !wantsFries && !nCups) wantsSandwich = true;

      var sandwich = null;
      if (wantsSandwich) {
        var topCap = lv.maxTop ? Math.max(1, Math.round(lv.maxTop * (0.4 + 0.6 * cx))) : 0;
        var sauceCap = lv.maxSauce ? Math.max(1, Math.round(lv.maxSauce * (0.4 + 0.6 * cx))) : 0;
        sandwich = {
          toppings: sample(CS.SANDWICH_TOPPINGS, topCap ? ri(topCap + 1) : 0),
          sauces: sample(CS.SANDWICH_SAUCES, sauceCap ? ri(sauceCap + 1) : 0)
        };
      }

      var cups = [];
      for (var i = 0; i < nCups; i++) cups.push(CS.pick(CS.CUP_SAUCES));

      var S = CS.SCORE;
      var reward = 0, extra = 0;
      if (sandwich) {
        reward += S.sandwich;
        extra = sandwich.toppings.length + sandwich.sauces.length;
        reward += extra * S.extra;
      }
      if (wantsFries) reward += S.fries;
      reward += cups.length * S.cup;

      var limit = CS.lerp(lv.limit[0], lv.limit[1], progress)
        + extra * 5.0 + (wantsFries ? 9 : 0) + cups.length * 5.0;

      return {
        id: nextId++,
        sandwich: sandwich,
        fries: wantsFries,
        cups: cups,
        limit: limit,
        left: limit,
        reward: Math.round(reward)
      };
    },

    /* Pick a species nobody in the queue is currently wearing, so the ticket
       colours stay tellable apart. Falls back to any species once the shop is
       busier than the roster is long. */
    pickSpecies: function () {
      var taken = this.list.map(function (o) { return o.species; });
      var free = [];
      for (var i = 0; i < CS.CRITTERS.length; i++) if (taken.indexOf(i) < 0) free.push(i);
      return free.length ? CS.pick(free) : ri(CS.CRITTERS.length);
    },

    spawn: function (progress) {
      if (this.list.length >= this.level.maxOrders) return null;
      var t = this.makeTicket(progress);
      var idx = this.list.length;
      var seed = ri(1000);
      var species = this.pickSpecies();
      var cust = CS.models.customer(species, seed);
      var spot = queueSpot(idx);

      // Start out on the porch, behind the wall, and walk in through the door.
      // Staggered by queue position so two arrivals in the same second are not
      // standing inside each other out there.
      cust.group.position.set(CS.DOOR_X, 0, OUTSIDE_Z - idx * 1.15);
      cust.group.rotation.y = 0;
      cust.state = 'enter';
      cust.path = [
        { x: CS.DOOR_X, z: THRESHOLD_Z },
        { x: CS.DOOR_X, z: INSIDE_Z }
      ];
      cust.walk = 0; cust.bob = Math.random() * 6.28; cust.gait = 0; cust.t = 0;
      scene.add(cust.group);

      t.cust = cust;
      t.species = species;
      t.critter = cust.species;
      t.css = '#' + ('000000' + cust.species.tint.toString(16)).slice(-6);
      t.tx = spot.x; t.tz = spot.z;
      this.list.push(t);
      CS.audio.doorbell();
      return t;
    },

    /* --------------------------------------------------------- matching */
    matches: function (plate, order) {
      if (!!plate.sandwich !== !!order.sandwich) return false;
      if (order.sandwich) {
        if (!plate.sandwich.chicken) return false;
        if (!setEq(plate.sandwich.toppings, order.sandwich.toppings)) return false;
        if (!setEq(plate.sandwich.sauces, order.sandwich.sauces)) return false;
      }
      if (plate.fries !== order.fries) return false;
      if (!multisetEq(plate.cups, order.cups)) return false;
      return true;
    },

    /* Best match = the one closest to running out, so nothing expires needlessly. */
    findMatch: function (plate) {
      var best = null;
      for (var i = 0; i < this.list.length; i++) {
        var o = this.list[i];
        if (o.done) continue;
        if (this.matches(plate, o) && (!best || o.left < best.left)) best = o;
      }
      return best;
    },

    /* Served or walked out, they take the same route home: step sideways out
       of the line, back down the exit lane, and out through the front door.
       A happy one celebrates on the spot first; an unhappy one just goes. */
    complete: function (order, happy) {
      var i = this.list.indexOf(order);
      if (i >= 0) this.list.splice(i, 1);
      order.done = true;
      var c = order.cust;
      c.happy = happy;
      c.t = 0;
      c.state = 'leave';
      c.cheer = happy ? 0.6 : 0;
      c.speed = happy ? WALK : HURRY;
      c.path = [
        { x: EXIT_X, z: c.group.position.z },
        { x: EXIT_X, z: INSIDE_Z },
        { x: CS.DOOR_X, z: THRESHOLD_Z },
        { x: CS.DOOR_X, z: OUTSIDE_Z }
      ];
      this.leaving.push(c);
      this.relayout();
    },

    /* --------------------------------------------------------------- tips
       A happy customer who was served briskly drops a coin or two on the
       counter. Purely cosmetic here -- game.js owns what they are worth. */
    tipBurst: function (x, y, z, n) {
      for (var i = 0; i < n; i++) {
        var m = CS.models.coin();
        m.position.set(x + (Math.random() - 0.5) * 0.5, y + 0.25, z + (Math.random() - 0.5) * 0.4);
        m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        scene.add(m);
        this.coins.push({
          m: m, t: 0,
          vy: 2.6 + Math.random() * 1.1,
          vx: (Math.random() - 0.5) * 0.9,
          vz: (Math.random() - 0.5) * 0.7,
          spin: 6 + Math.random() * 6,
          rest: y + 0.06
        });
      }
      CS.audio.coins();
    },

    relayout: function () {
      for (var i = 0; i < this.list.length; i++) {
        var spot = queueSpot(i);
        this.list[i].tx = spot.x;
        this.list[i].tz = spot.z;
      }
    },

    /* ----------------------------------------------------------- update */
    update: function (dt, progress, onExpire) {
      var lv = this.level;

      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (this.list.length < lv.maxOrders) {
          this.spawn(progress);
          this.spawnTimer = CS.lerp(lv.spawn[0], lv.spawn[1], progress) * (0.85 + Math.random() * 0.3);
        } else {
          this.spawnTimer = 1.2;   // queue is full, check again shortly
        }
      }

      /* ---- everyone in the queue: walk in, shuffle up, wait, fidget ---- */
      for (var i = this.list.length - 1; i >= 0; i--) {
        var o = this.list[i];
        o.left -= dt;
        var c = o.cust, g = c.group, moved = 0;
        c.t += dt;

        if (c.state === 'enter') {
          // follow the doorway waypoints, then join the back of the line
          var wp = c.path[0];
          moved = stepToward(g, wp.x, wp.z, WALK, dt);
          if (moved === 0) {
            c.path.shift();
            if (!c.path.length) c.state = 'queue';
          }
        } else {
          moved = stepToward(g, o.tx, o.tz, WALK, dt);
          if (moved === 0) faceCounter(g, dt);
        }
        animateCust(c, dt, moved);

        var frac = o.left / o.limit;
        if (frac < 0.3 && !o.beeped) { o.beeped = true; CS.audio.warn(); }
        c.parts.mark.visible = frac < 0.3;
        if (frac < 0.3) {
          c.parts.mark.rotation.y += dt * 4;
          c.parts.head.rotation.z = Math.sin(c.bob * 5) * 0.14;   // tapping a foot
        } else {
          c.parts.head.rotation.z *= 0.9;
        }

        if (o.left <= 0) {
          this.complete(o, false);
          onExpire(o);
        }
      }

      /* ---- customers on their way out ---- */
      for (var j = this.leaving.length - 1; j >= 0; j--) {
        var lc = this.leaving[j];
        lc.t += dt;
        var lg = lc.group;

        if (lc.cheer > 0) {
          // a happy hop on the spot before they set off
          lc.cheer -= dt;
          lg.position.y = Math.abs(Math.sin(lc.t * 12)) * 0.30;
          lg.rotation.y += dt * 7;
          lc.parts.armL.rotation.x = -1.9;
          lc.parts.armR.rotation.x = -1.9;
          if (lc.parts.species.tail === 'wag') lc.parts.tail.rotation.y = Math.sin(lc.t * 22) * 0.8;
        } else {
          var wp2 = lc.path[0];
          var m2 = wp2 ? stepToward(lg, wp2.x, wp2.z, lc.speed, dt) : 0;
          if (wp2 && m2 === 0) lc.path.shift();
          animateCust(lc, dt, m2);
          if (!lc.happy) lc.parts.head.rotation.y = Math.sin(lc.t * 7) * 0.22;
        }

        // gone through the door, or stuck long enough that something is wrong
        if (!lc.path.length || lc.t > 14) {
          scene.remove(lg);
          this.leaving.splice(j, 1);
        }
      }

      /* ---- tip coins arcing onto the counter ---- */
      for (var k = this.coins.length - 1; k >= 0; k--) {
        var co = this.coins[k];
        co.t += dt;
        co.vy -= 11 * dt;
        co.m.position.x += co.vx * dt;
        co.m.position.z += co.vz * dt;
        co.m.position.y += co.vy * dt;
        co.m.rotation.y += co.spin * dt;
        co.m.rotation.x += co.spin * 0.5 * dt;
        if (co.m.position.y < co.rest) {       // land flat and settle
          co.m.position.y = co.rest;
          co.vy = 0; co.vx *= 0.3; co.vz *= 0.3; co.spin *= 0.6;
          co.m.rotation.x = Math.PI / 2;
        }
        if (co.t > 1.9) {
          co.m.scale.setScalar(Math.max(0.001, 1 - (co.t - 1.9) / 0.5));
        }
        if (co.t > 2.4) { scene.remove(co.m); this.coins.splice(k, 1); }
      }
    }
  };
})(window.CS);
