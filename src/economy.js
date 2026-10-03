/* The till, the wallet and the save file.

   Money replaced score, so this is the scoreboard now. One day is one trading
   session: CS.econ.open() clears the ledger, the kitchen rings up sales and
   waste into it as they happen, and CS.econ.settle() takes rent and wages off
   the top and moves what is left into the wallet.

   Everything you have bought also lives here, because every one of those
   purchases is a number some other module needs to ask about: CS.econ.mod()
   is the single place that answers "how fast do fryers cook in this shop?". */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var KEY = 'chickenSandy.shop.v1';

  /* Defaults for every modifier a purchase can move. `how` says what buying a
     second one of something does: 'mul' stacks multiplicatively (two 15% cuts
     to the fryer clock compound), 'add' sums, 'max' takes the best. */
  var MODS = {
    fryCook:  { base: 1, how: 'mul' },
    fryGrace: { base: 1, how: 'mul' },
    patience: { base: 1, how: 'mul' },
    cups:     { base: 3, how: 'max' },
    orders:   { base: 0, how: 'add' }
  };

  function blank() {
    return {
      v: 1,
      wallet: 0,
      day: 1,
      owned: [],        // upgrade ids bought (gear + land)
      stock: {},        // partId -> how many bought but not yet placed
      staff: [],        // [{ kind, training: [id, ...] }]
      layout: null,     // CS.layout.serialize()
      career: { days: 0, served: 0, earned: 0, tips: 0, best: 0 }
    };
  }

  function upgrade(id) {
    for (var i = 0; i < CS.UPGRADES.length; i++) {
      if (CS.UPGRADES[i].id === id) return CS.UPGRADES[i];
    }
    return null;
  }

  var E = CS.econ = {
    state: blank(),
    ledger: null,

    upgrade: upgrade,

    /* ---------------------------------------------------------- the save */
    load: function () {
      var raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
      if (!raw) { E.reset(); return false; }
      var d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      if (!d || d.v !== 1) { E.reset(); return false; }

      var s = blank();
      s.wallet = typeof d.wallet === 'number' && isFinite(d.wallet) ? Math.max(0, d.wallet) : 0;
      s.day = Math.max(1, parseInt(d.day, 10) || 1);
      s.owned = (d.owned || []).filter(upgrade);
      s.stock = d.stock && typeof d.stock === 'object' ? d.stock : {};
      s.staff = (d.staff || []).filter(function (h) { return h && CS.STAFF_DEFS[h.kind]; })
        .map(function (h) { return { kind: h.kind, training: (h.training || []).slice() }; });
      if (d.career) for (var k in s.career) {
        if (typeof d.career[k] === 'number') s.career[k] = d.career[k];
      }
      E.state = s;

      // The layout has the last word on whether a save is usable: if it will
      // not load cleanly, layout.js falls back to the starting kitchen and we
      // keep the wallet rather than throwing the whole save away.
      CS.layout.load(d.layout);
      E.state.layout = CS.layout.serialize();
      return true;
    },

    save: function () {
      E.state.layout = CS.layout.serialize();
      try { localStorage.setItem(KEY, JSON.stringify(E.state)); } catch (e) { /* full or private */ }
    },

    reset: function () {
      E.state = blank();
      CS.layout.reset();
      E.state.layout = CS.layout.serialize();
      try { localStorage.removeItem(KEY); } catch (e) {}
    },

    /* ------------------------------------------------------- modifiers */
    mod: function (key) {
      var def = MODS[key];
      if (!def) return 0;
      var v = def.base;
      E.state.owned.forEach(function (id) {
        var u = upgrade(id);
        if (!u || !u.mod || u.mod[key] === undefined) return;
        var m = u.mod[key];
        if (def.how === 'mul') v *= m;
        else if (def.how === 'add') v += m;
        else v = Math.max(v, m);
      });
      return v;
    },

    has: function (id) { return E.state.owned.indexOf(id) >= 0; },

    /* Can this be bought right now? Covers money, prerequisites and the
       one-of-each rule that gear and land obey but parts do not. */
    canBuy: function (u) {
      if (!u) return { ok: false, why: '' };
      if (u.kind !== 'part' && E.has(u.id)) return { ok: false, why: 'Already fitted' };
      if (u.needs && !E.has(u.needs)) {
        var n = upgrade(u.needs);
        return { ok: false, why: 'Needs ' + (n ? n.name : u.needs) + ' first' };
      }
      if (E.state.wallet < u.cost) return { ok: false, why: 'Not enough money' };
      return { ok: true };
    },

    buy: function (id) {
      var u = upgrade(id);
      var can = E.canBuy(u);
      if (!can.ok) return can;
      E.state.wallet = Math.round((E.state.wallet - u.cost) * 100) / 100;
      if (u.kind === 'part') {
        E.state.stock[u.id] = (E.state.stock[u.id] || 0) + 1;
      } else if (u.kind === 'land') {
        E.state.owned.push(u.id);
        CS.layout.unlock(u.region);
      } else {
        E.state.owned.push(u.id);
      }
      E.save();
      return { ok: true };
    },

    /* -------------------------------------------------------------- staff */
    hire: function (kind) {
      var def = CS.STAFF_DEFS[kind];
      if (!def) return { ok: false, why: '' };
      if (E.hired(kind)) return { ok: false, why: 'Already on the payroll' };
      if (E.state.wallet < def.hire) return { ok: false, why: 'Not enough money' };
      E.state.wallet = Math.round((E.state.wallet - def.hire) * 100) / 100;
      E.state.staff.push({ kind: kind, training: [] });
      E.save();
      return { ok: true };
    },

    hired: function (kind) {
      return E.state.staff.some(function (h) { return h.kind === kind; });
    },

    train: function (kind, id) {
      var hand = E.state.staff.filter(function (h) { return h.kind === kind; })[0];
      if (!hand) return { ok: false, why: 'Nobody to train' };
      var list = CS.TRAINING[kind] || [], t = null;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) t = list[i];
      if (!t) return { ok: false, why: '' };
      if (hand.training.indexOf(id) >= 0) return { ok: false, why: 'Already trained' };
      if (E.state.wallet < t.cost) return { ok: false, why: 'Not enough money' };
      E.state.wallet = Math.round((E.state.wallet - t.cost) * 100) / 100;
      hand.training.push(id);
      E.save();
      return { ok: true };
    },

    /* A hire's live stats, with their training folded in. staff.js reads this
       rather than CS.STAFF_DEFS directly, so a trained hand is quicker and
       knows more jobs without the AI having to care which is which. */
    crew: function () {
      return E.state.staff.map(function (h) {
        var def = CS.STAFF_DEFS[h.kind];
        var out = {
          kind: h.kind, name: def.name, role: def.role, tint: def.tint,
          wage: def.wage, speed: def.speed, act: def.act,
          jobs: def.jobs.slice(), training: h.training.slice()
        };
        (CS.TRAINING[h.kind] || []).forEach(function (t) {
          if (h.training.indexOf(t.id) < 0) return;
          if (t.adds) t.adds.forEach(function (j) {
            if (out.jobs.indexOf(j) < 0) out.jobs.push(j);
          });
          if (t.mult) for (var k in t.mult) out[k] *= t.mult[k];
        });
        return out;
      });
    },

    wages: function () {
      return E.crew().reduce(function (n, c) { return n + c.wage; }, 0);
    },

    /* ------------------------------------------------------- the menu */
    priceOf: function (order) {
      var P = CS.PRICES, n = 0;
      if (order.sandwich) {
        n += P.sandwich;
        n += order.sandwich.toppings.length * P.topping;
        n += order.sandwich.sauces.length * P.sauce;
      }
      if (order.fries) n += P.fries;
      n += order.cups.length * P.cup;
      return Math.round(n * 100) / 100;
    },

    /* --------------------------------------------------------- the day */
    open: function (level) {
      E.ledger = {
        rent: level.rent,
        wages: E.wages(),
        lines: { sandwich: 0, topping: 0, sauce: 0, fries: 0, cup: 0 },
        revenue: { sandwich: 0, topping: 0, sauce: 0, fries: 0, cup: 0 },
        gross: 0, tips: 0, tipCount: 0, waste: 0, wasteCount: 0,
        served: 0, missed: 0, burnt: 0
      };
      return E.ledger;
    },

    /* Ring an order into the till, broken down by line so the end-of-day
       receipt can show where the money actually came from. */
    sale: function (order) {
      var L = E.ledger, P = CS.PRICES;
      if (!L) return 0;
      var total = 0;
      if (order.sandwich) {
        L.lines.sandwich++; L.revenue.sandwich += P.sandwich; total += P.sandwich;
        var nt = order.sandwich.toppings.length, ns = order.sandwich.sauces.length;
        L.lines.topping += nt; L.revenue.topping += nt * P.topping; total += nt * P.topping;
        L.lines.sauce += ns;   L.revenue.sauce += ns * P.sauce;     total += ns * P.sauce;
      }
      if (order.fries) { L.lines.fries++; L.revenue.fries += P.fries; total += P.fries; }
      if (order.cups.length) {
        L.lines.cup += order.cups.length;
        L.revenue.cup += order.cups.length * P.cup;
        total += order.cups.length * P.cup;
      }
      L.gross += total;
      L.served++;
      return Math.round(total * 100) / 100;
    },

    tip: function (n) {
      if (!E.ledger) return;
      E.ledger.tips += n;
      E.ledger.gross += n;
      E.ledger.tipCount++;
    },

    /* What this item cost you to have made. A plate is worth the sum of what
       is stacked on it, so binning a finished order hurts the way it should. */
    costOf: function (item) {
      if (!item) return 0;
      var c = CS.FOOD_COST[item.k] || 0;
      if (item.k === 'plate') {
        // a bun with no chicken on it is a fraction of a wasted sandwich
        if (item.sandwich) c += CS.FOOD_COST.friedChicken * (item.sandwich.chicken ? 1 : 0.3);
        if (item.fries) c += CS.FOOD_COST.cookedFries;
        c += item.cups.length * CS.FOOD_COST.cup;
      }
      return Math.round(c * 100) / 100;
    },

    /* Stock that went in the bin, or was still sitting out at closing time.
       Comes straight off the day's takings. */
    waste: function (item) {
      var c = E.costOf(item);
      if (!E.ledger || c <= 0) return 0;
      E.ledger.waste += c;
      E.ledger.wasteCount++;
      return c;
    },

    walkout: function () {
      if (!E.ledger) return 0;
      E.ledger.waste += CS.WALKOUT_COST;
      E.ledger.missed++;
      return CS.WALKOUT_COST;
    },

    takings: function () {
      var L = E.ledger;
      return L ? Math.max(0, L.gross - L.waste) : 0;
    },

    /* Close the books. You have to clear rent and wages to trade another day;
       a shift that does not is a retry and costs you nothing but the time. */
    settle: function () {
      var L = E.ledger;
      if (!L) return null;
      L.net = L.gross - L.waste;
      L.outgoings = L.rent + L.wages;
      L.profit = Math.round((L.net - L.outgoings) * 100) / 100;
      L.passed = L.profit >= 0;
      if (L.passed) {
        E.state.wallet = Math.round((E.state.wallet + L.profit) * 100) / 100;
        E.state.day++;
        E.state.career.days++;
        E.state.career.served += L.served;
        E.state.career.earned += L.net;
        E.state.career.tips += L.tips;
        E.state.career.best = Math.max(E.state.career.best, L.profit);
        E.save();
      }
      return L;
    },

    stars: function (ledger) {
      if (!ledger || !ledger.passed) return 0;
      var ratio = ledger.net / Math.max(1, ledger.outgoings);
      var n = 0;
      CS.STARS.forEach(function (th) { if (ratio >= th) n++; });
      return n;
    }
  };

  /* The fryer clock, after whatever you have bolted to the fryers. Everything
     that starts a basket goes through here rather than reading CS.COOK, so a
     Vented Basket speeds up the staff's baskets as well as yours. */
  CS.cookDef = function (k) {
    var base = CS.COOK[k];
    if (!base) return null;
    return {
      done: base.done, burnt: base.burnt, label: base.label,
      cook: base.cook * E.mod('fryCook'),
      grace: base.grace * E.mod('fryGrace')
    };
  };

  /* "$4.50" everywhere, so prices never render as 4.5000000001. */
  CS.money = function (n) {
    var neg = n < 0;
    var s = '$' + Math.abs(n).toFixed(2);
    return neg ? '-' + s : s;
  };
})(window.CS);
