/* Real-world time of day.

   The shop keeps the player's own clock. In the morning sun pours in through
   the window; towards evening the light turns gold and the window shows a
   sunset; after dark the sky is navy and starry, the castle windows are lit,
   the sun becomes a cool moonlight and the lanterns do the work. Sunrise and
   sunset move with the calendar, so a November evening draws in early and a
   June one lingers.

   world.js hands over its lights and window panes (bind) every time it
   builds the kitchen; world.tick() calls tick() every frame, which eases the
   lighting towards the clock and only does real work a couple of times a
   second. Nothing here changes how the game plays -- it is all light.

   ?hour=21.5 in the URL pins the clock, for testing.                        */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var pinned = (function () {
    var m = /[?&]hour=([\d.]+)/.exec(location.search);
    return m ? CS.clamp(parseFloat(m[1]), 0, 23.99) : null;
  })();

  function now() { return new Date(); }

  function hourOf(d) {
    return pinned !== null ? pinned : d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  /* Day length over the year at a temperate latitude: about 9h20m at the
     winter solstice, 15h at midsummer. Good enough for a castle kitchen. */
  function sunTimes(d) {
    var start = new Date(d.getFullYear(), 0, 0);
    var doy = Math.floor((d - start) / 86400000);
    var len = 12.15 + 2.85 * Math.sin(2 * Math.PI * (doy - 80) / 365);
    var noon = 12.9;                                  // roughly, with summer time
    if (d.getMonth() < 2 || d.getMonth() > 9) noon = 12.1;
    return { rise: noon - len / 2, set: noon + len / 2 };
  }

  function smooth(e0, e1, x) {
    var t = CS.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /* sun 0..1 (night..full day); dusk 0..1, peaking as the sun crosses the
     horizon, morning or evening. */
  function sample() {
    var d = now(), h = hourOf(d), st = sunTimes(d);
    var up = smooth(st.rise - 0.6, st.rise + 0.9, h) * (1 - smooth(st.set - 0.9, st.set + 0.6, h));
    var dusk = Math.max(
      1 - Math.min(1, Math.abs(h - st.rise) / 1.1),
      1 - Math.min(1, Math.abs(h - st.set) / 1.1));
    var phase = up > 0.75 ? 'day' : (up < 0.2 ? 'night' : 'dusk');
    var part;
    if (h < 5) part = 'night';
    else if (h < 12) part = 'morning';
    else if (h < 17) part = 'afternoon';
    else if (h < 21) part = 'evening';
    else part = 'night';
    if (part === 'evening' && phase === 'night') part = 'night';
    return { hour: h, sun: up, dusk: dusk, phase: phase, part: part, rise: st.rise, set: st.set };
  }

  function mix(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t); }

  var rig = null;
  var cur = null;           // eased {sun, dusk}
  var last = 0, lastPhase = null, lastClock = '';

  function clockText(h) {
    var hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    var ap = hh < 12 ? 'AM' : 'PM', h12 = hh % 12 || 12;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  }

  function apply(s) {
    if (!rig) return;
    var day = s.sun, dusk = s.dusk * (1 - Math.abs(day - 0.5) * 0.8);
    // sky fill: warm cream by day, a cool blue at night
    var sky = mix(0x8090c8, 0xffe9cc, day).lerp(new THREE.Color(0xffb58a), dusk * 0.5);
    rig.hemi.color.copy(sky).convertSRGBToLinear();
    rig.hemi.groundColor.copy(mix(0x2a2440, 0x6a4e3a, day)).convertSRGBToLinear();
    rig.hemi.intensity = CS.lerp(0.34, 0.55, day);
    // the key light through the window: sun, then sunset gold, then moon
    var key = mix(0x9fb2ff, 0xffdcb0, day).lerp(new THREE.Color(0xff9a55), dusk * 0.8);
    rig.sun.color.copy(key).convertSRGBToLinear();
    rig.sun.intensity = CS.lerp(0.42, 1.25, day);
    // the lanterns come up as the light goes
    rig.lamps.forEach(function (l, i) { l.intensity = rig.lampBase[i] * CS.lerp(1.9, 1.0, day); });
    if (CS.daylight.renderer) CS.daylight.renderer.setClearColor(mix(0x0b0d1e, 0x2a2638, day));
  }

  function paintSkies(phase) {
    if (!rig) return;
    rig.skies.forEach(function (p) {
      var u = p.userData.sky;
      if (!u || u.mode === phase) return;
      u.mode = phase;
      p.material.map = CS.models.skyTexture(u.worldW, u.worldH, phase);
      p.material.needsUpdate = true;
    });
  }

  CS.daylight = {
    renderer: null,

    /* Called by world.build() with the lights it just made. */
    bind: function (o) {
      rig = {
        hemi: o.hemi, sun: o.sun, lamps: o.lamps || [], skies: o.skies || [],
        lampBase: (o.lamps || []).map(function (l) { return l.intensity; })
      };
      var s = sample();
      cur = { sun: s.sun, dusk: s.dusk };
      apply(cur);
      paintSkies(s.phase);
    },

    now: sample,

    greeting: function () {
      var s = sample();
      var hi = s.part === 'morning' ? 'Good morning' : s.part === 'afternoon' ? 'Good afternoon'
        : s.part === 'evening' ? 'Good evening' : 'Burning the midnight oil';
      var what = s.phase === 'day' ? 'The sun is up over the castle.'
        : s.phase === 'dusk' ? (s.hour < 12 ? 'Dawn is breaking over the keep.' : 'The sun is setting behind the keep.')
        : 'The lanterns are lit and the stars are out.';
      return '&#' + (s.phase === 'night' ? '127769' : s.phase === 'dusk' ? '127751' : '9728') + '; ' +
        hi + ', chef. It is ' + clockText(s.hour) + '. ' + what;
    },

    clockText: function () { return clockText(sample().hour); },
    icon: function () {
      var p = sample().phase;
      return p === 'night' ? '\u{1F319}' : p === 'dusk' ? '\u{1F307}' : '☀';
    },

    tick: function (t) {
      if (!rig || !cur) return;
      if (t - last < 0.5) return;
      var dt = Math.min(2, t - last);
      last = t;
      var s = sample();
      // ease so a phase change on a running shift is a slow fade, not a cut
      var k = Math.min(1, dt * 0.25);
      cur.sun += (s.sun - cur.sun) * k;
      cur.dusk += (s.dusk - cur.dusk) * k;
      apply(cur);
      paintSkies(s.phase);
      var txt = (s.phase === 'night' ? '\u{1F319} ' : s.phase === 'dusk' ? '\u{1F307} ' : '☀ ') + clockText(s.hour);
      if (txt !== lastClock) {
        lastClock = txt;
        var el = document.getElementById('realClock');
        if (el) el.textContent = txt;
      }
      if (lastPhase && s.phase !== lastPhase && CS.ui && CS.game && CS.game.state && CS.game.state.phase === 'play') {
        CS.ui.toast(s.phase === 'night' ? 'Night has fallen. Lanterns lit!'
          : s.phase === 'day' ? 'The sun is up!'
          : (s.hour < 12 ? 'Dawn over the castle' : 'The sun is setting'), 'info');
      }
      lastPhase = s.phase;
    }
  };
})(window.CS);
