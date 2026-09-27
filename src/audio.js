/* Tiny WebAudio chiptune kit — no asset files, everything is synthesised. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var ctx = null, master = null, musicGain = null, sizzleGain = null;
  var muted = false, started = false, noiseBuf = null, musicTimer = null, step = 0;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.45; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);

    // white-noise buffer reused by the fryer sizzle and the trash thunk
    var n = ctx.sampleRate * 1.2;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol == null ? 0.25 : vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, freq, vol, q) {
    if (muted || !ensure()) return;
    var t = ctx.currentTime;
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = freq || 1400; f.Q.value = q || 1.0;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol == null ? 0.2 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur);
  }

  /* ---------------------------------------------------------- music loop */
  // Two-bar warm shuffle in A minor pentatonic. Low and unobtrusive.
  var BASS = [110, 110, 146.8, 146.8, 164.8, 164.8, 130.8, 130.8];
  var LEAD = [440, 523.3, 440, 392, 349.2, 392, 440, 523.3];

  function musicStep() {
    if (muted || !ctx) return;
    var t = ctx.currentTime, i = step % 8;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = BASS[i];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.36);

    if (i % 2 === 0) {
      var o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = 'square'; o2.frequency.value = LEAD[i];
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o2.connect(g2); g2.connect(musicGain); o2.start(t); o2.stop(t + 0.26);
    }
    step++;
  }

  CS.audio = {
    resume: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      started = true;
    },
    startMusic: function () {
      this.resume();
      if (musicTimer || !ctx) return;
      step = 0;
      musicStep();
      musicTimer = setInterval(musicStep, 340);
    },
    stopMusic: function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    setMuted: function (m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.45;
    },
    isMuted: function () { return muted; },

    /* one-shots */
    pick:    function () { tone(520, 0.07, 'square', 0.16, 720); },
    place:   function () { tone(300, 0.08, 'square', 0.16, 210); },
    drop:    function () { noise(0.35, 2600, 0.30, 0.7); tone(180, 0.12, 'sawtooth', 0.08, 120); },
    topping: function () { tone(660, 0.05, 'square', 0.13); tone(880, 0.05, 'square', 0.10); },
    sauce:   function () { noise(0.16, 700, 0.16, 3.0); tone(240, 0.1, 'sine', 0.1, 340); },
    ding:    function () { tone(1046, 0.12, 'sine', 0.28); tone(1568, 0.22, 'sine', 0.2); },
    burn:    function () { tone(150, 0.4, 'sawtooth', 0.16, 70); noise(0.4, 400, 0.12, 0.8); },
    serve:   function () {
      tone(660, 0.09, 'square', 0.22);
      setTimeout(function () { tone(880, 0.09, 'square', 0.22); }, 80);
      setTimeout(function () { tone(1320, 0.18, 'square', 0.22); }, 165);
    },
    error:   function () { tone(200, 0.14, 'square', 0.2, 120); setTimeout(function () { tone(150, 0.2, 'square', 0.18, 90); }, 120); },
    trash:   function () { noise(0.22, 300, 0.26, 0.6); },
    newOrder:function () { tone(784, 0.07, 'triangle', 0.2); setTimeout(function () { tone(1046, 0.1, 'triangle', 0.2); }, 70); },
    warn:    function () { tone(880, 0.06, 'square', 0.13); },

    /* movement */
    jump:    function () { tone(420, 0.11, 'square', 0.14, 760); },
    land:    function () { noise(0.10, 220, 0.16, 0.8); tone(150, 0.07, 'sine', 0.10, 95); },
    flap:    function () {
      noise(0.13, 900, 0.16, 1.4);
      setTimeout(function () { noise(0.10, 620, 0.11, 1.4); }, 85);
      tone(520, 0.09, 'triangle', 0.10, 700);
    },
    dash:    function () { noise(0.22, 2000, 0.20, 0.9); tone(300, 0.16, 'sawtooth', 0.09, 900); },
    fail:    function () { tone(330, 0.16, 'sawtooth', 0.2, 160); setTimeout(function () { tone(196, 0.3, 'sawtooth', 0.18, 90); }, 150); },
    over:    function () {
      var n = [523, 440, 349, 262];
      n.forEach(function (f, i) { setTimeout(function () { tone(f, 0.3, 'triangle', 0.22); }, i * 180); });
    },
    fanfare: function () {
      var n = [523, 659, 784, 1046];
      n.forEach(function (f, i) { setTimeout(function () { tone(f, 0.22, 'square', 0.2); }, i * 110); });
    }
  };
})(window.CS);
