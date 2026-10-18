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
      career: { days: 0, served: 0, earned: 0, tips: 0, best: 0 },
      bosses: [],       // ids of the castle bosses fed, first time round
      bossDays: [],     // every boss day beaten, so a lap's bosses gate too
      chef: blankChef()
    };
  }

  /* Sandy's own progress: experience, level, unspent points, skill ranks. */
  function blankChef() { return { xp: 0, level: 1, points: 0, skills: {} }; }

  function skillDef(id) {
    for (var i = 0; i < CS.SKILLS.length; i++) if (CS.SKILLS[i].id === id) return CS.SKILLS[i];
    return null;
  }

  function upgrade(id) {
    for (var i = 0; i < CS.UPGRADES.length; i++) {
      if (CS.UPGRADES[i].id === id) return CS.UPGRADES[i];
    }
    // a boss's trophy is owned the same way a piece of gear is
    for (var j = 0; j < CS.TROPHIES.length; j++) {
      if (CS.TROPHIES[j].id === id) return CS.TROPHIES[j];
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
      s.bosses = (d.bosses || []).filter(function (id) { return typeof id === 'string'; });
      s.bossDays = (d.bossDays || []).filter(function (n) { return typeof n === 'number'; });
      s.stock = d.stock && typeof d.stock === 'object' ? d.stock : {};
      s.staff = (d.staff || []).filter(function (h) { return h && CS.STAFF_DEFS[h.kind]; })
        .map(function (h) { return { kind: h.kind, training: (h.training || []).slice() }; });
      if (d.career) for (var k in s.career) {
        if (typeof d.career[k] === 'number') s.career[k] = d.career[k];
      }
      // saves from before the chef could level up simply start her at 1
      if (d.chef && typeof d.chef === 'object') {
        s.chef.xp = Math.max(0, +d.chef.xp || 0);
        s.chef.level = Math.max(1, parseInt(d.chef.level, 10) || 1);
        s.chef.points = Math.max(0, parseInt(d.chef.points, 10) || 0);
        var sk = d.chef.skills || {};
        CS.SKILLS.forEach(function (def) {
          var r = parseInt(sk[def.id], 10) || 0;
          if (r > 0) s.chef.skills[def.id] = Math.min(def.max, r);
        });
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

    /* ------------------------------------------------------------ the chef
       XP lands as it is earned during a shift, but only reaches the disk
       when the day settles -- quitting mid-shift loses it along with the
       till, which keeps the two honest with each other. Returns how many
       levels were gained, so the caller can make a fuss about it. */
    gainXP: function (n) {
      var c = E.state.chef, ups = 0;
      c.xp += Math.max(0, Math.round(n));
      while (c.xp >= CS.xpToNext(c.level)) {
        c.xp -= CS.xpToNext(c.level);
        c.level++;
        c.points++;
        ups++;
      }
      return ups;
    },

    /* The total a skill is worth right now: ranks x its `per`. */
    skill: function (id) {
      var def = skillDef(id);
      return def ? (E.state.chef.skills[id] || 0) * def.per : 0;
    },
    skillRank: function (id) { return E.state.chef.skills[id] || 0; },

    learn: function (id) {
      var def = skillDef(id), c = E.state.chef;
      if (!def) return { ok: false, why: '' };
      var r = c.skills[id] || 0;
      if (r >= def.max) return { ok: false, why: 'Mastered' };
      if (c.points < 1) return { ok: false, why: 'Needs a skill point' };
      c.points--;
      c.skills[id] = r + 1;
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
          wageShare: def.wageShare, wageMin: def.wageMin, wageMax: def.wageMax,
          speed: def.speed, act: def.act,
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

    /* What the crew costs on a day that took `net`. A share of the takings,
       so they cost what the shop can bear -- a quiet day pays the floor, a
       busy one pays properly. */
    wagesFor: function (net) {
      var total = E.crew().reduce(function (n, c) {
        var w = (net || 0) * c.wageShare;
        if (w < c.wageMin) w = c.wageMin;
        if (w > c.wageMax) w = c.wageMax;
        return n + w;
      }, 0);
      return Math.round(total * 100) / 100;
    },

    /* The wage bill as it stands right now, for the HUD and the receipt. */
    wages: function () {
      return E.wagesFor(E.ledger ? Math.max(0, E.ledger.gross - E.ledger.waste) : 0);
    },

    /* The floor and the ceiling, for the shop to show before a day starts. */
    wageRange: function () {
      var crew = E.crew();
      return {
        min: Math.round(crew.reduce(function (n, c) { return n + c.wageMin; }, 0) * 100) / 100,
        max: Math.round(crew.reduce(function (n, c) { return n + c.wageMax; }, 0) * 100) / 100
      };
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
        wages: 0,         // a share of the takings, so only known at close
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

    /* Close the books.

       A shift used to be pass-or-nothing: miss the rent and the whole day's
       takings evaporated. That is a trap -- the player who most needs an
       upgrade is exactly the one who can never bank enough to buy one, so a
       hard day becomes a permanently hard day.

       Now the money is always yours. Whatever is left after rent and wages
       goes in the wallet, and a shift that did not cover them simply banks
       nothing; it never reaches into the wallet to take what is already
       there. `passed` survives only to pick the wording and the stars. The
       day does NOT advance here -- see `advance()`. */
    settle: function () {
      var L = E.ledger;
      if (!L) return null;
      L.net = Math.round((L.gross - L.waste) * 100) / 100;
      L.wages = E.wagesFor(L.net);
      L.outgoings = Math.round((L.rent + L.wages) * 100) / 100;
      L.profit = Math.round((L.net - L.outgoings) * 100) / 100;
      L.passed = L.profit >= 0;
      // a boss's bounty is paid on top, and is nobody's share of the takings
      L.bounty = L.bounty || 0;
      L.banked = Math.max(0, L.profit) + L.bounty;

      E.state.wallet = Math.round((E.state.wallet + L.banked) * 100) / 100;
      E.state.career.days++;
      E.state.career.served += L.served;
      E.state.career.earned += L.net;
      E.state.career.tips += L.tips;
      E.state.career.best = Math.max(E.state.career.best, L.profit);
      E.save();
      return L;
    },

    /* Move to the next day. Split out from settle() so the result screen can
       offer "carry on" and "run that day again" as a real choice: a replay
       keeps the money you already banked and does not skip the day. */
    advance: function () {
      E.state.day++;
      E.save();
      return E.state.day;
    },

    /* ------------------------------------------------------- the bosses
       A fed boss pays its bounty into the day's books (settle() banks it)
       and, the first time round, leaves its trophy. Returns the trophy if
       this was the first time, so the result card can show it off. */
    bossBeaten: function (day) { return E.state.bossDays.indexOf(day) >= 0; },

    beatBoss: function (boss, day) {
      if (E.ledger) E.ledger.bounty = boss.bounty;
      if (E.state.bossDays.indexOf(day) < 0) E.state.bossDays.push(day);
      var first = E.state.bosses.indexOf(boss.id) < 0;
      if (first) E.state.bosses.push(boss.id);
      var trophy = null;
      if (boss.trophy && !E.has(boss.trophy.id)) {
        E.state.owned.push(boss.trophy.id);
        trophy = boss.trophy;
      }
      E.save();
      return trophy;
    },

    trophies: function () {
      return CS.TROPHIES.filter(function (t) { return E.has(t.id); });
    },

    stars: function (ledger) {
      if (!ledger || !ledger.passed) return 0;
      var ratio = ledger.net / Math.max(1, ledger.outgoings);
      var n = 0;
      CS.STARS.forEach(function (th) { if (ratio >= th) n++; });
      return n;
    }
  };

  function bossMod(lv, key) {
    var m = lv && lv.boss && lv.boss.mods;
    return m && m[key] ? m[key] : 1;
  }

  /* The fryer clock, after whatever you have bolted to the fryers. Everything
     that starts a basket goes through here rather than reading CS.COOK, so a
     Vented Basket speeds up the staff's baskets as well as yours. */
  CS.cookDef = function (k) {
    var base = CS.COOK[k];
    if (!base) return null;
    // the early days are forgiving about a basket left in a bit long
    var lv = CS.orders && CS.orders.level;
    var gentle = lv && lv.grace ? lv.grace : 1;
    return {
      done: base.done, burnt: base.burnt, label: base.label,
      // and a boss can bend the fryers for the day (a dragon's breath, say)
      cook: base.cook * E.mod('fryCook') * bossMod(lv, 'fryCook'),
      grace: base.grace * E.mod('fryGrace') * gentle * (1 + E.skill('sizzle')) * bossMod(lv, 'fryGrace')
    };
  };

  /* "$4.50" everywhere, so prices never render as 4.5000000001. */
  CS.money = function (n) {
    var neg = n < 0;
    var s = '$' + Math.abs(n).toFixed(2);
    return neg ? '-' + s : s;
  };
})(window.CS);
