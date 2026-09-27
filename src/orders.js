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

  function queueSpot(i) {
    var p = CS.tileToWorld(CS.SERVE_COL, 0);
    return { x: p.x + (i % 2 ? 0.55 : -0.35), z: CS.OZ - 1.5 - i * 1.75 };
  }

  var O = CS.orders = {
    list: [],
    leaving: [],
    spawnTimer: 0,
    level: null,

    init: function (sc) { scene = sc; this.level = CS.levelFor(1); },

    reset: function (level) {
      this.list.forEach(function (o) { scene.remove(o.cust.group); });
      this.leaving.forEach(function (c) { scene.remove(c.group); });
      this.list.length = 0;
      this.leaving.length = 0;
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

    spawn: function (progress) {
      if (this.list.length >= this.level.maxOrders) return null;
      var t = this.makeTicket(progress);
      var idx = this.list.length;
      var seed = ri(1000);
      var shirt = CS.CUSTOMER_COLORS[seed % CS.CUSTOMER_COLORS.length];
      var cust = CS.models.customer(shirt, seed);
      var spot = queueSpot(idx);
      var back = queueSpot(CS.MAX_ORDERS_CAP + 2);
      cust.group.position.set(spot.x, 0, back.z);
      cust.group.rotation.y = 0;
      scene.add(cust.group);

      t.cust = cust;
      t.shirt = shirt;
      t.css = '#' + ('000000' + shirt.toString(16)).slice(-6);
      t.tx = spot.x; t.tz = spot.z;
      t.bob = Math.random() * 6.28;
      this.list.push(t);
      CS.audio.newOrder();
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

    complete: function (order, happy) {
      var i = this.list.indexOf(order);
      if (i >= 0) this.list.splice(i, 1);
      order.done = true;
      var c = order.cust;
      c.happy = happy;
      c.t = 0;
      c.exitX = c.group.position.x + (happy ? 5.5 : -5.5);
      if (!happy) {
        c.group.traverse(function (o) {
          if (o.isMesh && o.material && o.material.color) { /* leave colours alone */ }
        });
      }
      this.leaving.push(c);
      this.relayout();
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

      for (var i = this.list.length - 1; i >= 0; i--) {
        var o = this.list[i];
        o.left -= dt;

        var frac = o.left / o.limit;
        if (frac < 0.3 && !o.beeped) { o.beeped = true; CS.audio.warn(); }
        o.cust.parts.mark.visible = frac < 0.3;

        // walk to place, idle bob
        var g = o.cust.group;
        g.position.x += (o.tx - g.position.x) * Math.min(1, dt * 4);
        g.position.z += (o.tz - g.position.z) * Math.min(1, dt * 3);
        var moving = Math.abs(o.tz - g.position.z) > 0.05;
        o.bob += dt * (moving ? 9 : 2.2);
        g.position.y = moving ? Math.abs(Math.sin(o.bob)) * 0.08 : Math.sin(o.bob) * 0.02;
        var swing = moving ? Math.sin(o.bob) * 0.7 : 0;
        o.cust.parts.legL.rotation.x = swing;
        o.cust.parts.legR.rotation.x = -swing;
        o.cust.parts.armL.rotation.x = -swing * 0.6;
        o.cust.parts.armR.rotation.x = swing * 0.6;
        if (frac < 0.3) {
          o.cust.parts.mark.rotation.y += dt * 4;
          o.cust.parts.head.rotation.z = Math.sin(o.bob * 3) * 0.12;
        } else {
          o.cust.parts.head.rotation.z *= 0.9;
        }

        if (o.left <= 0) {
          this.complete(o, false);
          onExpire(o);
        }
      }

      // customers walking off
      for (var j = this.leaving.length - 1; j >= 0; j--) {
        var c = this.leaving[j];
        c.t += dt;
        var gg = c.group;
        if (c.happy && c.t < 0.55) {
          gg.position.y = Math.abs(Math.sin(c.t * 11)) * 0.32;   // little celebration hop
          gg.rotation.y += dt * 7;
        } else {
          gg.rotation.y = CS.lerp(gg.rotation.y, c.happy ? Math.PI / 2 : -Math.PI / 2, dt * 6);
          gg.position.x += (c.exitX - gg.position.x) * Math.min(1, dt * 1.6);
          gg.position.z -= dt * 0.6;
          gg.position.y = Math.abs(Math.sin(c.t * 9)) * 0.07;
          c.parts.legL.rotation.x = Math.sin(c.t * 9) * 0.7;
          c.parts.legR.rotation.x = -Math.sin(c.t * 9) * 0.7;
        }
        if (c.t > 3.2) { scene.remove(gg); this.leaving.splice(j, 1); }
      }
    }
  };
})(window.CS);
