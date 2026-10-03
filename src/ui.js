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
    var h = '<div class="thead"><span class="face" style="background:' + o.css + '"></span>ORDER #' +
      String(o.id).padStart(2, '0') + '</div><div class="tbody">';

    if (o.sandwich) {
      h += '<div class="line"><span class="bullet">&#9656;</span><span>Chicken Sandwich</span></div>';
      var extras = o.sandwich.toppings.concat(o.sandwich.sauces);
      h += '<div class="sub">' + (extras.length ? extras.map(chip).join('') : '<i>plain</i>') + '</div>';
    }
    if (o.fries) h += '<div class="line"><span class="bullet">&#9656;</span><span>French Fries</span></div>';
    if (o.cups.length) {
      h += '<div class="line"><span class="bullet">&#9656;</span><span>' + o.cups.length +
        ' Sauce Cup' + (o.cups.length > 1 ? 's' : '') + '</span></div>';
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
        'loading', 'hud'].forEach(function (id) { el[id] = $(id); });
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
          d += item.sandwich.chicken ? 'Sandwich: chicken' : 'Bun only — needs chicken';
          var ex = item.sandwich.toppings.concat(item.sandwich.sauces);
          if (ex.length) d += '<br>' + ex.map(chip).join('');
        }
        if (item.fries) d += (d ? '<br>' : '') + 'Fries on the side';
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
          d.className = 'ticket';
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
      return el.screen.querySelector('.card');
    },
    hideScreen: function () { el.screen.classList.add('hidden'); el.screen.innerHTML = ''; },

    howToHTML: function () {
      var touch = CS.platform && CS.platform.coarse;
      var controls = touch
        ? '<li>Drag the <b>left half</b> — waddle</li>' +
          '<li><b>USE</b> — work the station you are next to</li>' +
          '<li><b>JUMP</b> — hop; tap again to <b>flap</b></li>' +
          '<li>Hold <b>JUMP</b> falling — glide</li>' +
          '<li><b>DASH</b> — burst forward</li>'
        : '<li><b>WASD</b> / arrows — waddle</li>' +
          '<li><b>E</b> — use station</li>' +
          '<li><b>Space</b> — jump, then again to <b>flap</b></li>' +
          '<li><b>Hold Space</b> falling — glide</li>' +
          '<li><b>Shift</b> — dash</li>' +
          '<li><b>C</b> — switch camera view</li>' +
          '<li><b>ESC</b> — pause</li>' +
          '<li><b>M</b> mute &nbsp; <b>P</b> pixel size</li>';
      return '' +
        '<div class="cols">' +
        '<div class="col"><h3>CONTROLS</h3><ul>' + controls + '</ul></div>' +
        '<div class="col"><h3>THE LINE</h3><ul>' +
        '<li>Grab a <b>plate</b>, add a <b>bun</b></li>' +
        '<li>Fry <b>chicken</b> &amp; <b>potatoes</b></li>' +
        '<li>Stack <b>toppings</b> &amp; <b>sauces</b></li>' +
        '<li>Fill <b>cups</b> at the sauce bottles</li>' +
        '<li>Hand it through the <b>window</b></li>' +
        '</ul></div>' +
        '<div class="col"><h3>WATCH OUT</h3><ul>' +
        '<li>Leave food frying and it <b>burns</b></li>' +
        '<li>Bin mistakes in the <b>trash</b></li>' +
        '<li>Ticket must match <b>exactly</b></li>' +
        '<li>Fast serves build a <b>combo</b></li>' +
        '</ul></div>' +
        '</div>';
    },

    /* `saved` is the shop on disk, if there is one, so the front page can
       offer to carry on rather than silently resuming or silently wiping. */
    showStart: function (onStart, onFresh, saved) {
      var c = this.showScreen(
        '<h1>CHICKEN SANDY</h1>' +
        '<h2>&#9829; GOOD FOOD &#183; HAPPY CHICKEN &#9829;</h2>' +
        '<p>You are the chef. You are also a chicken. Try not to think about the menu.</p>' +
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
        ? '<div class="col" style="flex:1 1 100%"><h3>NEW TODAY</h3><ul>' +
          lv.unlocks.map(function (u) { return '<li>&#9656; <b>' + u + '</b></li>'; }).join('') +
          '</ul></div>'
        : '';
      var mins = Math.floor(lv.seconds / 60), secs = lv.seconds % 60;
      var c = this.showScreen(
        '<h1>DAY ' + lv.day + '</h1>' +
        '<h2>' + lv.name.toUpperCase() + '</h2>' +
        '<p>' + lv.tag + '</p>' +
        '<div class="cols">' + unlocks +
        '<div class="col"><h3>THE SHIFT</h3><ul>' +
        '<li>Length: <b>' + mins + ':' + (secs < 10 ? '0' : '') + secs + '</b></li>' +
        '<li>Rent: <b>' + CS.money(lv.rent) + '</b></li>' +
        (CS.econ.wages() > 0 ? '<li>Wages: <b>' + CS.money(CS.econ.wages()) + '</b></li>' : '') +
        '<li>Tickets at once: <b>' + CS.orders.cap() + '</b></li>' +
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
        starRow += '<span style="color:' + (j < stars ? 'var(--gold)' : '#5a4630') + '">&#9733;</span>';
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
        sale('sandwich', L.lines.sandwich, L.revenue.sandwich) +
        sale('topping', L.lines.topping, L.revenue.topping) +
        sale('sauce', L.lines.sauce, L.revenue.sauce) +
        sale('fries', L.lines.fries, L.revenue.fries) +
        sale('sauce cup', L.lines.cup, L.revenue.cup) +
        (L.tipCount ? line('tips (' + L.tipCount + ')', CS.money(L.tips), 'tipval') : '') +
        (L.waste > 0 ? line('waste &amp; walkouts', '-' + CS.money(L.waste), 'badval') : '') +
        '<div class="scoreline rule"><span>TAKINGS</span><span>' + CS.money(L.net) + '</span></div>' +
        line('rent', '-' + CS.money(L.rent)) +
        (L.wages > 0 ? line('wages', '-' + CS.money(L.wages)) : '') +
        '<div class="scoreline rule big-line"><span>PROFIT</span><span class="' +
          (L.passed ? 'tipval' : 'badval') + '">' + CS.money(L.profit) + '</span></div>' +
        (L.passed ? line('in the wallet', CS.money(CS.econ.state.wallet)) : '');

      var c = this.showScreen(
        '<h1>' + (L.passed ? 'DAY ' + lv.day + ' DONE' : 'IN THE RED') + '</h1>' +
        '<div class="rank" style="letter-spacing:8px">' + starRow + '</div>' +
        '<h2>' + (L.passed
          ? (stars === 3 ? 'The queue is singing your name.'
            : stars === 2 ? 'Solid shift. Barely a burnt nugget.'
              : 'Scraped through. The rent is rising.')
          : 'You took ' + CS.money(L.net) + ' and owed ' + CS.money(L.outgoings) +
            '. Nothing lost but the day.') + '</h2>' +
        '<div class="receipt">' + body + '</div>' +
        '<div class="scoreline small"><span>' + L.served + ' served, ' +
          L.missed + ' walked out, ' + L.burnt + ' burnt</span></div>' +
        '<button class="big" id="nextBtn">' +
        (L.passed ? 'TO THE SHOP &#9656;' : 'TRY DAY ' + lv.day + ' AGAIN') + '</button>');
      c.querySelector('#nextBtn').onclick = L.passed ? onNext : onRetry;
      this.setHudVisible(false);
    },

    showPause: function (onResume, onQuit) {
      var c = this.showScreen(
        '<h1>PAUSED</h1>' + this.howToHTML() +
        '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:12px">' +
        // phones run one fixed camera, so VIEW would be a button that does nothing
        (CS.platform.mobile ? '' : '<button class="btn" id="pCam">VIEW</button>') +
        '<button class="btn" id="pMute">SOUND</button>' +
        '<button class="btn" id="pPix">PIXEL</button>' +
        '</div>' +
        '<button class="big" id="resumeBtn">RESUME</button>' +
        '<button class="big" id="quitBtn" style="margin-left:10px;background:#5a381c;border-color:#2e1c0f;box-shadow:inset 0 3px 0 #8a5a2b,0 5px 0 #2e1c0f">END RUN</button>');
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
