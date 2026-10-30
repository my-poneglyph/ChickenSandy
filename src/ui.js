/* All DOM work: ticket rail, held-item card, hint line, toasts and screens. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var el = {}, ticketEls = {}, lastRailH = -1;

  function $(id) { return document.getElementById(id); }
  function chip(id) {
    var i = CS.ING[id];
    return '<span class="chip"><span class="sw" style="background:' + i.css + '"></span>' + i.label + '</span>';
  }

  function ticketHTML(o) {
    var h = '<div class="thead"><span class="face" style="background:' + o.css + '"></span>' +
      (o.boss ? '&#9819; COURSE ' + o.course : 'ORDER #' + String(o.id).padStart(2, '0')) +
      '</div><div class="tbody">';

    if (o.sandwich) {
      h += '<div class="line"><span class="bullet">&#9656;</span><span>' + CS.WORDS.main + '</span></div>';
      var extras = o.sandwich.toppings.concat(o.sandwich.sauces);
      h += '<div class="sub">' + (extras.length ? extras.map(chip).join('') : '<i>plain</i>') + '</div>';
    }
    if (o.fries) h += '<div class="line"><span class="bullet">&#9656;</span><span>' + CS.WORDS.side + '</span></div>';
    if (o.cups.length) {
      h += '<div class="line"><span class="bullet">&#9656;</span><span>' + o.cups.length +
        ' ' + (o.cups.length > 1 ? CS.WORDS.cups : CS.WORDS.cup) + '</span></div>';
      h += '<div class="sub">' + o.cups.map(chip).join('') + '</div>';
    }
    h += '</div><div class="bar"><i style="width:100%"></i></div>';
    return h;
  }

  CS.ui = {
    init: function () {
      ['clock', 'score', 'combo', 'day', 'dayName', 'tgtBar', 'tgtLabel', 'fryers',
        'dashBar', 'flapPips', 'tDash', 'tJump',
        'tickets', 'heldName', 'heldDetail', 'hint', 'hintText',
        'toasts', 'screen', 'btnMute', 'btnPix', 'btnHelp', 'btnCam',
        'loading', 'hud', 'chefLv', 'xpBar', 'powerWrap', 'powerBar', 'tPower']
        .forEach(function (id) { el[id] = $(id); });
    },

    /* Sandy's level and how far she is through it. */
    setChef: function (c) {
      if (!el.chefLv) return;
      el.chefLv.textContent = 'Lv ' + c.level;
      var f = CS.clamp(c.xp / CS.xpToNext(c.level), 0, 1);
      el.xpBar.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
    },

    /* Feather Frenzy: hidden until learnt, then a meter that drains while it
       runs and refills while it recharges. */
    setPower: function (known, frac, live) {
      if (el.powerWrap) el.powerWrap.classList.toggle('hidden', !known);
      if (el.tPower) {
        el.tPower.classList.toggle('hidden', !known);
        el.tPower.classList.toggle('live', live);
        el.tPower.classList.toggle('cool', !live && frac < 1);
      }
      if (!known || !el.powerBar) return;
      el.powerBar.className = 'm' + (live ? ' live' : (frac >= 1 ? ' ready' : ''));
      el.powerBar.firstElementChild.style.width = (CS.clamp(frac, 0, 1) * 100).toFixed(0) + '%';
    },

    setLevel: function (lv) {
      el.day.textContent = lv.day;
      el.dayName.textContent = lv.name;
      el.tgtLabel.textContent = 'rent ' + CS.money(lv.rent);
    },

    /* The till bar fills as the day's takings close on what the day costs --
       rent plus wages. Full means you are trading at a profit. */
    setTarget: function (took, owed) {
      var f = CS.clamp(took / Math.max(0.01, owed), 0, 1);
      el.tgtBar.firstElementChild.style.width = (f * 100).toFixed(1) + '%';
      el.tgtBar.className = 'tgt' + (took >= owed ? ' done' : '');
      el.tgtLabel.textContent = took >= owed
        ? 'in profit'
        : 'owes ' + CS.money(owed - took);
    },

    setMoves: function (dashReady, flaps, maxFlaps, airborne) {
      // on-screen buttons double as the readout on phones
      if (el.tDash) el.tDash.classList.toggle('cool', dashReady < 1);
      if (el.tJump) {
        var label = !airborne ? 'JUMP'
          : (flaps > 0 ? 'FLAP ' + new Array(flaps + 1).join('•') : 'GLIDE');
        if (el.tJump.textContent !== label) el.tJump.textContent = label;
      }
      el.dashBar.className = 'm' + (dashReady >= 1 ? ' ready' : '');
      el.dashBar.firstElementChild.style.width = (dashReady * 100).toFixed(0) + '%';
      if (el.flapPips.children.length !== maxFlaps) {
        var h = '';
        for (var i = 0; i < maxFlaps; i++) h += '<div class="pip"></div>';
        el.flapPips.innerHTML = h;
      }
      for (var j = 0; j < maxFlaps; j++) {
        el.flapPips.children[j].className = 'pip' + (j < flaps ? ' on' : '');
      }
    },

    /* Live read-out of each fryer, so the oil is never a surprise. */
    setFryers: function (rows) {
      if (!rows.length) { el.fryers.classList.add('hidden'); return; }
      el.fryers.classList.remove('hidden');
      var html = '';
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        html += '<div class="fry' + (r.empty ? ' idle' : '') + '">' +
          '<div class="n">' + r.label + '</div>' +
          '<div class="m"><i style="width:' + (r.t * 100).toFixed(0) + '%;background:' + r.color + '"></i></div>' +
          '</div>';
      }
      el.fryers.innerHTML = html;
    },

    setClock: function (sec) {
      sec = Math.max(0, Math.ceil(sec));
      var m = Math.floor(sec / 60), s = sec % 60;
      el.clock.textContent = m + ':' + (s < 10 ? '0' : '') + s;
      el.clock.className = 'v' + (sec <= 30 ? ' hot' : '');
    },
    setScore: function (n) { el.score.textContent = CS.money(n); },
    setCombo: function (c) {
      el.combo.textContent = 'x' + (Math.round(c * 100) / 100);
      el.combo.className = 'v' + (c > 1.01 ? ' gold' : '');
    },

    setHeld: function (item) {
      el.heldName.textContent = CS.itemLabel(item);
      var d = '';
      if (item && item.k === 'plate') {
        if (item.sandwich) {
          d += item.sandwich.chicken ? CS.WORDS.mainDone : CS.WORDS.mainBare;
          var ex = item.sandwich.toppings.concat(item.sandwich.sauces);
          if (ex.length) d += '<br>' + ex.map(chip).join('');
        }
        if (item.fries) d += (d ? '<br>' : '') + CS.WORDS.sideOn;
        if (item.cups.length) d += (d ? '<br>' : '') + item.cups.map(chip).join('');
      } else if (item && item.k === 'cup' && item.sauce) {
        d = chip(item.sauce);
      }
      el.heldDetail.innerHTML = d;
    },

    setHint: function (res) {
      if (!res) { el.hint.classList.add('hidden'); return; }
      el.hint.classList.remove('hidden');
      el.hint.className = 'panel' + (res.ok ? '' : ' blocked');
      el.hintText.textContent = res.text;
    },

    renderTickets: function (list) {
      var seen = {};
      list.forEach(function (o, i) {
        seen[o.id] = true;
        var t = ticketEls[o.id];
        if (!t) {
          var d = document.createElement('div');
          d.className = 'ticket' + (o.boss ? ' boss' : '');
          d.innerHTML = ticketHTML(o);
          el.tickets.appendChild(d);
          t = ticketEls[o.id] = { root: d, fill: d.querySelector('.bar i'), bar: d.querySelector('.bar') };
        }
        if (t.root.parentNode !== el.tickets) el.tickets.appendChild(t.root);
        // keep DOM order matching queue order
        var want = el.tickets.children[i];
        if (want !== t.root) el.tickets.insertBefore(t.root, want || null);

        var f = CS.clamp(o.left / o.limit, 0, 1);
        t.fill.style.width = (f * 100).toFixed(1) + '%';
        t.bar.className = 'bar' + (f < 0.3 ? ' bad' : (f < 0.6 ? ' warn' : ''));
        t.root.classList.toggle('urgent', f < 0.16);
      });

      Object.keys(ticketEls).forEach(function (id) {
        if (!seen[id]) {
          var t = ticketEls[id];
          t.root.classList.add('dying');
          setTimeout(function () { if (t.root.parentNode) t.root.parentNode.removeChild(t.root); }, 300);
          delete ticketEls[id];
        }
      });

      // phone layout stacks the next HUD row directly under the rail, and the
      // rail's height depends on how fussy the current tickets are
      var h = el.tickets.offsetHeight;
      if (h !== lastRailH) {
        lastRailH = h;
        document.documentElement.style.setProperty('--ticketH', h + 'px');
      }
    },

    clearTickets: function () {
      el.tickets.innerHTML = '';
      ticketEls = {};
      lastRailH = -1;
    },

    toast: function (msg, type) {
      var d = document.createElement('div');
      d.className = 'toast ' + (type || 'info');
      d.textContent = msg;
      el.toasts.appendChild(d);
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1750);
    },

    setHudVisible: function (v) { el.hud.style.display = v ? '' : 'none'; },
    hideLoading: function () { el.loading.classList.add('hidden'); },
    setMuteLabel: function (m) { el.btnMute.textContent = 'SOUND: ' + (m ? 'OFF' : 'ON'); },
    setPixLabel: function (n) { el.btnPix.textContent = 'PIXEL: ' + n + 'X'; },
    setCamLabel: function (n) { el.btnCam.textContent = 'VIEW: ' + n.toUpperCase(); },

    /* ------------------------------------------------------------ screens */
    showScreen: function (html, extra) {
      el.screen.innerHTML = '<div class="card' + (extra ? ' ' + extra : '') + '">' + html + '</div>';
      el.screen.classList.remove('hidden');
      // a boss card sits low, over a clear backdrop, so you can see the boss
      el.screen.classList.toggle('cine', !!extra && extra.indexOf('bosscard') >= 0);
      return el.screen.querySelector('.card');
    },
    hideScreen: function () { el.screen.classList.add('hidden'); el.screen.classList.remove('cine'); el.screen.innerHTML = ''; },

    howToHTML: function () {
      var touch = CS.platform && CS.platform.coarse;
      var controls = touch
        ? '<li>Drag the <b>left half</b> — waddle</li>' +
          '<li><b>USE</b> — work the station you are next to</li>' +
          '<li><b>JUMP</b> — hop; tap again to <b>flap</b></li>' +
          '<li>Hold <b>JUMP</b> falling — glide</li>' +
          '<li><b>DASH</b> — burst forward</li>' +
          '<li><b>POWER</b> — Feather Frenzy, once learnt</li>'
        : '<li><b>WASD</b> / arrows — waddle</li>' +
          '<li><b>E</b> — use station</li>' +
          '<li><b>Space</b> — jump, then again to <b>flap</b></li>' +
          '<li><b>Hold Space</b> falling — glide</li>' +
          '<li><b>Shift</b> — dash</li>' +
          '<li><b>Q</b> — Feather Frenzy, once learnt</li>' +
          '<li><b>C</b> — switch camera view</li>' +
          '<li><b>ESC</b> — pause</li>' +
          '<li><b>M</b> mute &nbsp; <b>P</b> pixel size</li>';
      return '' +
        '<div class="cols">' +
        '<div class="col"><h3>CONTROLS</h3><ul>' + controls + '</ul></div>' +
        '<div class="col"><h3>THE LINE</h3><ul>' +
        (CS.isThanksgiving
          ? '<li>Grab a <b>plate</b>, add a <b>dinner roll</b></li>' +
            '<li>Fry <b>turkey</b>, cook <b>mashed potatoes</b></li>' +
            '<li>Spoon on <b>kale</b> &amp; <b>corn</b></li>' +
            '<li>Pour <b>gravy</b> or <b>cranberry</b></li>' +
            '<li>Fill <b>pie crusts</b> for <b>pumpkin pie</b></li>'
          : '<li>Grab a <b>plate</b>, add a <b>bun</b></li>' +
            '<li>Fry <b>chicken</b> &amp; <b>potatoes</b></li>' +
            '<li>Stack <b>toppings</b> &amp; <b>sauces</b></li>' +
            '<li>Fill <b>cups</b> at the sauce bottles</li>') +
        '<li>Hand it through the <b>window</b></li>' +
        '</ul></div>' +
        '<div class="col"><h3>WATCH OUT</h3><ul>' +
        '<li>Leave food frying and it <b>burns</b></li>' +
        '<li>Bin mistakes in the <b>trash</b></li>' +
        '<li>Ticket must match <b>exactly</b></li>' +
        '<li>Fast serves build a <b>combo</b></li>' +
        '</ul></div>' +
        '<div class="col"><h3>GROWING</h3><ul>' +
        '<li>New foods arrive <b>day by day</b></li>' +
        '<li>Orders earn Sandy <b>XP</b></li>' +
        '<li>Level up, spend <b>skill points</b></li>' +
        '<li>Hire <b>helpers</b> in the shop</li>' +
        '</ul></div>' +
        '</div>';
    },

    /* `saved` is the shop on disk, if there is one, so the front page can
       offer to carry on rather than silently resuming or silently wiping. */
    showStart: function (onStart, onFresh, saved) {
      var c = this.showScreen(
        (CS.isThanksgiving
          ? '<h1 class="tgtitle"><small>THANKSGIVING</small>CHICKEN SANDY</h1>' +
            '<h2>&#127810; NOVEMBER SPECIAL &#183; GOBBLE GOBBLE &#127810;</h2>' +
            '<p>Fried turkey, mashed potatoes, kale, corn, gravy or cranberry, and pumpkin pie. ' +
            'You are still a chicken. The turkeys are relieved.</p>'
          : '<h1>CHICKEN SANDY</h1>' +
            '<h2>&#9829; GOOD FOOD &#183; HAPPY CHICKEN &#9829;</h2>' +
            '<p>You are the chef. You are also a chicken. Try not to think about the menu.</p>') +
        (CS.daylight ? '<p class="timeofday">' + CS.daylight.greeting() + '</p>' : '') +
        (saved
          ? '<p style="color:var(--gold)">Your shop is on Day ' + saved.day +
            ' with ' + CS.money(saved.wallet) + ' in the till.</p>'
          : '') +
        this.howToHTML() +
        '<button class="big" id="startBtn">' +
          (saved ? 'CARRY ON &#9656;' : 'START DAY 1') + '</button>' +
        (saved ? '<button class="btn" id="freshBtn" style="margin-left:10px">NEW SHOP</button>' : ''));
      c.querySelector('#startBtn').onclick = onStart;
      var f = c.querySelector('#freshBtn');
      if (f) f.onclick = onFresh;
      this.setHudVisible(false);
    },

    /* Shown before every day: what is new, how long, and what it takes to pass. */
    showLevelIntro: function (lv, onStart) {
      var unlocks = (lv.unlocks && lv.unlocks.length)
        ? '<div class="col" style="flex:1 1 100%"><h3>' +
          (lv.day > CS.CHAPTER_LEN ? 'A NEW CHAPTER &#183; TOUGHER FROM TODAY' : 'NEW TODAY') + '</h3><ul>' +
          lv.unlocks.map(function (u) { return '<li>&#9656; <b>' + u + '</b></li>'; }).join('') +
          '</ul></div>'
        : '';
      var howto = lv.howto
        ? '<div class="col" style="flex:1 1 100%"><h3>HOW TO</h3><ul><li>' + lv.howto + '</li></ul></div>'
        : '';
      var crew = CS.econ.crew();
      var crewLine = crew.length
        ? '<p style="color:var(--gold)">On shift: ' + crew.map(function (h) {
            return h.name + ' the ' + h.role;
          }).join(', ') + '</p>'
        : '';
      var mins = Math.floor(lv.seconds / 60), secs = lv.seconds % 60;
      // how long until the castle sends someone down to be fed
      var bossDay = Math.ceil(lv.day / CS.CHAPTER_LEN) * CS.CHAPTER_LEN;
      var nb = CS.bossFor(bossDay), left = bossDay - lv.day;
      var bossLine = '<p class="nextboss">&#9819; Castle boss in <b>' + left + ' day' + (left > 1 ? 's' : '') +
        '</b> (Day ' + bossDay + '): ' + nb.fullName + ', ' + nb.title + '</p>';
      var c = this.showScreen(
        '<h1>DAY ' + lv.day + '</h1>' +
        '<h2>' + lv.name.toUpperCase() + '</h2>' +
        '<p>' + lv.tag + '</p>' + crewLine + bossLine +
        '<div class="cols">' + unlocks + howto +
        '<div class="col"><h3>THE SHIFT</h3><ul>' +
        '<li>Length: <b>' + mins + ':' + (secs < 10 ? '0' : '') + secs + '</b></li>' +
        '<li>Rent: <b>' + CS.money(lv.rent) + '</b></li>' +
        (CS.econ.crew().length
          ? '<li>Wages: <b>' + CS.money(CS.econ.wageRange().min) + '+</b>, a share of takings</li>'
          : '') +
        '<li>Tickets at once: <b>' +
          Math.min(CS.MAX_ORDERS_CAP, lv.maxOrders + CS.econ.mod('orders')) + '</b></li>' +
        '</ul></div>' +
        '<div class="col"><h3>REMINDERS</h3><ul>' +
        (CS.platform && CS.platform.coarse
          ? '<li><b>USE</b> works the highlighted station</li>' +
            '<li>Drag the <b>left half</b> to waddle</li>'
          : '<li><b>E</b> uses the highlighted station</li>' +
            '<li><b>C</b> switches camera</li>') +
        '<li>Fast serves build the <b>combo</b></li>' +
        '</ul></div>' +
        '</div>' +
        '<button class="big" id="goBtn">OPEN UP</button>');
      c.querySelector('#goBtn').onclick = onStart;
      this.setHudVisible(false);
    },

    /* End of trading: the day's receipt. Sales are itemised because where the
       money came from is the thing that tells you what to buy next -- a day
       carried by sauce cups wants a Dollop, not another fryer. */
    showLevelResult: function (lv, L, onNext, onRetry) {
      var stars = CS.econ.stars(L);
      var starRow = '';
      for (var j = 0; j < 3; j++) {
        starRow += '<span style="color:' + (j < stars ? 'var(--gold)' : '#4a5068') + '">&#9733;</span>';
      }

      function line(label, n, cls) {
        return '<div class="scoreline"><span>' + label + '</span><span' +
          (cls ? ' class="' + cls + '"' : '') + '>' + n + '</span></div>';
      }
      function sale(label, count, money) {
        if (!count) return '';
        return line(count + ' &#215; ' + label, CS.money(money));
      }

      var body =
        sale(CS.WORDS.mainLine, L.lines.sandwich, L.revenue.sandwich) +
        sale(CS.isThanksgiving ? 'side' : 'topping', L.lines.topping, L.revenue.topping) +
        sale(CS.isThanksgiving ? 'gravy &amp; cranberry' : 'sauce', L.lines.sauce, L.revenue.sauce) +
        sale(CS.WORDS.sideLine, L.lines.fries, L.revenue.fries) +
        sale(CS.WORDS.cupLine, L.lines.cup, L.revenue.cup) +
        (L.tipCount ? line('tips (' + L.tipCount + ')', CS.money(L.tips), 'tipval') : '') +
        (L.waste > 0 ? line('waste &amp; walkouts', '-' + CS.money(L.waste), 'badval') : '') +
        '<div class="scoreline rule"><span>TAKINGS</span><span>' + CS.money(L.net) + '</span></div>' +
        line('rent', '-' + CS.money(L.rent)) +
        (L.wages > 0 ? line('wages', '-' + CS.money(L.wages)) : '') +
        '<div class="scoreline rule big-line"><span>PROFIT</span><span class="' +
          (L.passed ? 'tipval' : 'badval') + '">' + CS.money(L.profit) + '</span></div>' +
        line(L.passed ? 'banked' : 'banked (never less than nothing)',
          CS.money(L.banked)) +
        line('in the wallet', CS.money(CS.econ.state.wallet));

      /* Both ways forward are always offered. Carrying on is the default even
         after a bad day -- the shop is yours and nobody is taking it off you
         -- but replaying the same day is there if you would rather bank a bit
         more before the rent goes up again. */
      var c = this.showScreen(
        '<h1>' + (L.passed ? 'DAY ' + lv.day + ' DONE' : 'A SLOW DAY') + '</h1>' +
        '<div class="rank" style="letter-spacing:8px">' + starRow + '</div>' +
        '<h2>' + (L.passed
          ? (stars === 3 ? 'The queue is singing your name.'
            : stars === 2 ? 'Solid shift. Barely a burnt nugget.'
              : 'Scraped through. The rent is rising.')
          : 'You took ' + CS.money(L.net) + ' and owed ' + CS.money(L.outgoings) +
            '. The shop is still yours.') + '</h2>' +
        '<div class="receipt">' + body + '</div>' +
        '<div class="scoreline small"><span>' + L.served + ' served, ' +
          L.missed + ' walked out, ' + L.burnt + ' burnt</span></div>' +
        '<div class="krow">' +
        '<button class="btn" id="retryBtn">RUN DAY ' + lv.day + ' AGAIN</button>' +
        '<button class="big" id="nextBtn">DAY ' + (lv.day + 1) + ' &#9656;</button>' +
        '</div>');
      c.querySelector('#nextBtn').onclick = onNext;
      c.querySelector('#retryBtn').onclick = onRetry;
      this.setHudVisible(false);
    },

    /* A boss day's card: who is coming down from the castle, why, and what
       it wants. It sits low over a clear backdrop, so the boss landing in
       the dining room is in view the whole time you read it. */
    showBossIntro: function (lv, onStart) {
      var b = lv.boss;
      var mins = Math.floor(lv.seconds / 60), secs = lv.seconds % 60;
      var him = { ogre: 'HIM', dragon: 'HER', lich: 'HIM', colossus: 'IT', rooster: 'HIM' }[b.look] || 'IT';
      var c = this.showScreen(
        '<div class="bossflag" style="--boss:' + b.css + '">&#9819; CASTLE BOSS &#183; DAY ' + lv.day + '</div>' +
        '<h1>' + b.fullName.toUpperCase() + '</h1>' +
        '<h2>' + b.title.toUpperCase() + '</h2>' +
        '<div class="story">' + b.story.map(function (s) { return '<p>' + s + '</p>'; }).join('') + '</div>' +
        '<div class="cols">' +
        '<div class="col"><h3>' + b.quirk.name.toUpperCase() + '</h3><ul><li>' + b.quirk.text + '</li></ul></div>' +
        '<div class="col"><h3>THE FEAST</h3><ul>' +
        '<li>Courses to serve: <b>' + b.courses + '</b></li>' +
        '<li>On the rail at once: <b>' + b.atOnce + '</b></li>' +
        '<li>Time: <b>' + mins + ':' + (secs < 10 ? '0' : '') + secs + '</b> &#183; no rent today</li>' +
        '<li>A cold course makes ' + him.toLowerCase() + ' <b>hungrier</b></li>' +
        '<li>Bounty: <b>' + CS.money(b.bounty) + '</b>' +
          (CS.econ.has(b.trophy.id) ? '' : ' + <b>' + b.trophy.name + '</b>') + '</li>' +
        '</ul></div>' +
        '</div>' +
        '<button class="big" id="goBtn">FEED ' + him + '</button>', 'bosscard');
      c.querySelector('#goBtn').onclick = onStart;
      this.setHudVisible(false);
    },

    /* The end of a boss day. Fed: the bounty, the trophy, and on to the next
       chapter. Still hungry: you keep every penny you took, and go back to
       the shop to get stronger and try again -- the way on is to feed it. */
    showBossResult: function (lv, L, r, onNext, onRetry) {
      var b = lv.boss;
      function line(label, n, cls) {
        return '<div class="scoreline"><span>' + label + '</span><span' +
          (cls ? ' class="' + cls + '"' : '') + '>' + n + '</span></div>';
      }
      var body =
        line(L.served + ' course' + (L.served === 1 ? '' : 's') + ' served', CS.money(L.gross - L.tips)) +
        (L.tipCount ? line('tips (' + L.tipCount + ')', CS.money(L.tips), 'tipval') : '') +
        (L.waste > 0 ? line('waste &amp; cold courses', '-' + CS.money(L.waste), 'badval') : '') +
        (L.wages > 0 ? line('wages', '-' + CS.money(L.wages)) : '') +
        (L.bounty ? line('&#9819; bounty', CS.money(L.bounty), 'tipval') : '') +
        '<div class="scoreline rule big-line"><span>BANKED</span><span class="tipval">' + CS.money(L.banked) + '</span></div>' +
        line('in the wallet', CS.money(CS.econ.state.wallet));
      var trophy = r.trophy
        ? '<div class="trophy"><h3>&#127942; TROPHY WON &#183; ' + r.trophy.name.toUpperCase() + '</h3><p>' + r.trophy.blurb + '</p></div>'
        : '';
      var who = b.fullName.toUpperCase();
      var c = this.showScreen(
        '<div class="bossflag" style="--boss:' + b.css + '">&#9819; CASTLE BOSS &#183; DAY ' + lv.day + '</div>' +
        '<h1>' + (r.won ? who + ' IS FULL!' : who + ' IS STILL HUNGRY') + '</h1>' +
        '<h2>' + (r.won
          ? 'Every course eaten. ' + b.cheers[b.cheers.length - 1]
          : 'Ate ' + r.ate + ' of ' + r.need + ' courses before closing. Get stronger in the shop and try again.') + '</h2>' +
        trophy +
        '<div class="receipt">' + body + '</div>' +
        '<div class="krow">' +
        (r.won
          ? '<button class="big" id="nextBtn">DAY ' + (lv.day + 1) + ' &#183; NEXT CHAPTER &#9656;</button>'
          : '<button class="big" id="retryBtn">BACK TO THE SHOP</button>') +
        '</div>', 'bosscard');
      var n = c.querySelector('#nextBtn'), t = c.querySelector('#retryBtn');
      if (n) n.onclick = onNext;
      if (t) t.onclick = onRetry;
      this.setHudVisible(false);
    },

    showPause: function (onResume, onQuit) {
      var c = this.showScreen(
        '<h1>PAUSED</h1>' +
        (CS.daylight ? '<p class="timeofday">' + CS.daylight.greeting() + '</p>' : '') +
        this.howToHTML() +
        '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:12px">' +
        // phones run one fixed camera, so VIEW would be a button that does nothing
        (CS.platform.mobile ? '' : '<button class="btn" id="pCam">VIEW</button>') +
        '<button class="btn" id="pMute">SOUND</button>' +
        '<button class="btn" id="pPix">PIXEL</button>' +
        '</div>' +
        '<button class="big" id="resumeBtn">RESUME</button>' +
        '<button class="big" id="quitBtn" style="margin-left:10px;background:#23345e;border-color:#14203d;box-shadow:inset 0 3px 0 #3f5a96,0 5px 0 #14203d">END RUN</button>');
      c.querySelector('#resumeBtn').onclick = onResume;
      c.querySelector('#quitBtn').onclick = onQuit;
      // settings live here on phones, where the corner buttons are hidden
      var cam = c.querySelector('#pCam');
      var sync = function () {
        if (cam) cam.textContent = document.getElementById('btnCam').textContent;
        c.querySelector('#pMute').textContent = document.getElementById('btnMute').textContent;
        c.querySelector('#pPix').textContent = document.getElementById('btnPix').textContent;
      };
      if (cam) cam.onclick = function () { CS.game.press('cam'); sync(); };
      c.querySelector('#pMute').onclick = function () { CS.game.press('mute'); sync(); };
      c.querySelector('#pPix').onclick = function () { CS.game.press('pixel'); sync(); };
      sync();
    },

    /* Ending a run does not wipe the shop -- it just shuts the doors. The
       save is still there, so CARRY ON picks it straight back up. */
    showQuit: function (onAgain, onWipe) {
      var st = CS.econ.state, cr = st.career;
      var c = this.showScreen(
        '<h1>SHOP CLOSED</h1>' +
        '<h2>Day ' + st.day + ' &#183; ' + CS.money(st.wallet) + ' in the till</h2>' +
        '<div class="receipt">' +
        '<div class="scoreline"><span>Days traded</span><span>' + cr.days + '</span></div>' +
        '<div class="scoreline"><span>Orders served</span><span>' + cr.served + '</span></div>' +
        '<div class="scoreline"><span>Tips taken</span><span class="tipval">' + CS.money(cr.tips) + '</span></div>' +
        '<div class="scoreline"><span>Best day</span><span>' + CS.money(cr.best) + '</span></div>' +
        '<div class="scoreline rule"><span>LIFETIME TAKINGS</span><span>' + CS.money(cr.earned) + '</span></div>' +
        '</div>' +
        '<button class="big" id="againBtn">BACK TO THE SHOP</button>' +
        '<button class="btn" id="wipeBtn" style="margin-left:10px">START A NEW SHOP</button>');
      c.querySelector('#againBtn').onclick = onAgain;
      c.querySelector('#wipeBtn').onclick = onWipe;
      this.setHudVisible(false);
    }
  };
})(window.CS);
