/* The shop screen: where yesterday's profit turns into tomorrow's kitchen.

   Sits between days, so nothing here ever runs while a shift is live. Gear is
   fitted the moment you buy it; parts drop into the tray and you place them
   yourself in the editor; land opens a wing and moves the wall out.         */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var card = null, onOpen = null, onEdit = null;

  /* The price is always on the button, whether or not you can afford it --
     what something costs is how you decide what to save for, so hiding it
     behind "Not enough money" made the whole shop unreadable until you were
     already rich. The reason you cannot buy it goes under the name instead,
     along with how much more you need. */
  function row(id, name, blurb, cost, state) {
    var dis = state.ok ? '' : ' disabled';
    var owned = !state.ok && (state.why === 'FITTED' || state.why === 'OPEN' ||
      state.why === 'TRAINED' || state.why === 'Already fitted');
    var label = owned ? state.why : CS.money(cost);

    /* A prerequisite outranks the price: telling someone they need $123 more
       for a thing they could not buy at any price is worse than saying
       nothing. Money is only the blocker when it is the only blocker. */
    var note = '';
    if (!state.ok && !owned) {
      var why = state.why === 'Not enough money'
        ? CS.money(cost - CS.econ.state.wallet) + ' more needed'
        : state.why;
      note = '<em>' + why + '</em>';
    }
    return '<div class="buyrow' + (state.ok ? '' : ' dim') + '">' +
      '<div class="buyname">' + name +
      (blurb ? '<span>' + blurb + '</span>' : '') + note + '</div>' +
      '<button class="buy' + (state.ok ? '' : ' off') + '" data-buy="' + id + '"' + dis + '>' +
      label + '</button></div>';
  }

  function gearHTML() {
    var out = '';
    CS.UPGRADES.forEach(function (u) {
      if (u.kind !== 'gear') return;
      var owned = CS.econ.has(u.id);
      out += row(u.id, u.name, u.blurb, u.cost,
        owned ? { ok: false, why: 'FITTED' } : CS.econ.canBuy(u));
    });
    return out;
  }

  function partsHTML() {
    var out = '', stock = CS.econ.state.stock;
    CS.UPGRADES.forEach(function (u) {
      if (u.kind !== 'part') return;
      var n = stock[u.id] || 0;
      var where = u.wall ? 'goes against a wall' : 'stands on the floor';
      out += row(u.id, u.name + (n ? ' <b>(' + n + ' in the tray)</b>' : ''),
        where, u.cost, CS.econ.canBuy(u));
    });
    return out;
  }

  function landHTML() {
    var out = '';
    CS.UPGRADES.forEach(function (u) {
      if (u.kind !== 'land') return;
      var owned = CS.econ.has(u.id);
      out += row(u.id, u.name, u.blurb, u.cost,
        owned ? { ok: false, why: 'OPEN' } : CS.econ.canBuy(u));
    });
    return out;
  }

  function staffHTML() {
    var out = '';
    Object.keys(CS.STAFF_DEFS).forEach(function (kind) {
      var def = CS.STAFF_DEFS[kind];
      var hired = CS.econ.hired(kind);
      var pct = Math.round(def.wageShare * 100);
      var terms = pct + '% of the day\'s takings, at least ' + CS.money(def.wageMin);
      if (!hired) {
        var can = CS.econ.state.wallet >= def.hire
          ? { ok: true } : { ok: false, why: 'Not enough money' };
        out += row('hire:' + kind, def.name + ' &#183; ' + def.role,
          def.blurb + ' &#183; ' + terms, def.hire, can);
        return;
      }
      var crew = CS.econ.crew().filter(function (c) { return c.kind === kind; })[0];
      out += '<div class="buyrow hired"><div class="buyname">' +
        def.name + ' &#183; ' + def.role +
        '<span>on ' + terms + ' &#183; makes ' +
        jobWords(crew.jobs) + '</span></div><button class="buy off" disabled>HIRED</button></div>';
      (CS.TRAINING[kind] || []).forEach(function (t) {
        var done = crew.training.indexOf(t.id) >= 0;
        var can = done ? { ok: false, why: 'TRAINED' }
          : (CS.econ.state.wallet >= t.cost ? { ok: true } : { ok: false, why: 'Not enough money' });
        out += row('train:' + kind + ':' + t.id, '&#8627; ' + t.name, t.blurb, t.cost, can);
      });
    });
    return out;
  }

  function jobWords(jobs) {
    return jobs.map(function (j) {
      if (j === 'fries') return 'fries';
      if (j === 'chicken') return 'fried chicken';
      return CS.ING[j.slice(4)].label.toLowerCase() + ' cups';
    }).join(', ');
  }

  function headerHTML() {
    var w = CS.econ.state.wallet;
    var lv = CS.levelFor(CS.econ.state.day);
    var crew = CS.econ.crew();
    var wage = crew.length
      ? CS.money(CS.econ.wageRange().min) + '+'
      : CS.money(0);
    return '<div class="walletbar">' +
      '<div><span>WALLET</span><b>' + CS.money(w) + '</b></div>' +
      '<div><span>DAY ' + CS.econ.state.day + ' RENT</span><b>' + CS.money(lv.rent) + '</b></div>' +
      '<div><span>WAGES</span><b>' + wage + '</b></div>' +
      '</div>';
  }

  function render() {
    if (!card) return;
    card.querySelector('#sHead').innerHTML = headerHTML();
    card.querySelector('#sGear').innerHTML = gearHTML();
    card.querySelector('#sParts').innerHTML = partsHTML();
    card.querySelector('#sLand').innerHTML = landHTML();
    card.querySelector('#sStaff').innerHTML = staffHTML();
    bind();
  }

  function bind() {
    var bs = card.querySelectorAll('[data-buy]');
    for (var i = 0; i < bs.length; i++) {
      bs[i].onclick = function () { buy(this.getAttribute('data-buy')); };
    }
  }

  function buy(key) {
    var res;
    if (key.indexOf('hire:') === 0) res = CS.econ.hire(key.slice(5));
    else if (key.indexOf('train:') === 0) {
      var bits = key.split(':');
      res = CS.econ.train(bits[1], bits[2]);
    } else res = CS.econ.buy(key);

    if (res && res.ok) { CS.audio.cash(); CS.ui.toast('Bought!', 'good'); }
    else { CS.audio.error(); if (res && res.why) CS.ui.toast(res.why, 'bad'); }
    render();
  }

  CS.shop = {
    /* `open` starts the shift, `edit` hands over to the kitchen editor and
       comes back here afterwards. */
    show: function (openDay, editKitchen) {
      onOpen = openDay; onEdit = editKitchen;
      card = CS.ui.showScreen(
        '<h1>THE SHOP</h1>' +
        '<div id="sHead"></div>' +
        '<div class="shopscroll">' +
        '<h3>Equipment</h3><div id="sGear"></div>' +
        '<h3>Kit &#183; buy it, then place it in the kitchen</h3><div id="sParts"></div>' +
        '<h3>The Building</h3><div id="sLand"></div>' +
        '<h3>Staff</h3><div id="sStaff"></div>' +
        '</div>' +
        '<div class="krow">' +
        '<button class="btn" id="sEdit">KITCHEN</button>' +
        '<button class="big" id="sOpen">OPEN UP &#9656;</button>' +
        '</div>', 'wide');

      card.querySelector('#sOpen').onclick = function () { card = null; onOpen(); };
      card.querySelector('#sEdit').onclick = function () { card = null; onEdit(); };
      render();
      CS.ui.setHudVisible(false);
    }
  };
})(window.CS);
