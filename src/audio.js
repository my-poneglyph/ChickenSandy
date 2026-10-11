/* Tiny WebAudio chiptune kit — no asset files, everything is synthesised. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var ctx = null, master = null, musicGain = null, sizzleGain = null;
  var muted = false, started = false, noiseBuf = null, musicTimer = null;
  var padBus = null, padFilter = null, leadBus = null;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.45; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.20; musicGain.connect(master);

    /* ---- music buses ----
       The pad goes through its own slowly-breathing lowpass so the chords
       swell rather than sit there; the two lead voices share a dotted-eighth
       delay, which is what turns a handful of sparse notes into something
       that sounds like a room rather than a beep. */
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass'; padFilter.frequency.value = 820; padFilter.Q.value = 0.4;
    padBus = ctx.createGain(); padBus.gain.value = 1;
    padBus.connect(padFilter); padFilter.connect(musicGain);

    var lfo = ctx.createOscillator(), lfoAmt = ctx.createGain();
    lfo.frequency.value = 0.055;            // one slow breath every ~18s
    lfoAmt.gain.value = 260;
    lfo.connect(lfoAmt); lfoAmt.connect(padFilter.frequency);
    lfo.start();

    leadBus = ctx.createGain(); leadBus.gain.value = 1;
    leadBus.connect(musicGain);
    var delay = ctx.createDelay(1.0), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = STEP * 3;       // dotted eighth
    fb.gain.value = 0.30; wet.gain.value = 0.30;
    leadBus.connect(delay); delay.connect(fb); fb.connect(delay);
    var damp = ctx.createBiquadFilter();    // each repeat a little darker
    damp.type = 'lowpass'; damp.frequency.value = 2200;
    delay.connect(damp); damp.connect(wet); wet.connect(musicGain);

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

  /* ======================================================== music =========
     "Castle Town" -- an original eight-bar piece in the manner of a 16-bit
     fantasy RPG town theme. The ingredients are the genre's, the tune is our
     own:

       * a harp running rising arpeggios across two octaves, the texture
         every crystal-and-castle soundtrack opens with;
       * a breathy flute carrying the melody, with a touch of vibrato;
       * pizzicato bass and a soft string pad underneath;
       * a progression that leans on the major-seventh and the Lydian colour
         of IV(add9), and turns home through the bVI - bVII - I cadence that
         makes anything sound like a victory;
       * a glockenspiel doubling the melody an octave up on alternate passes.

     Two moods share one score. 'calm' (the shop, menus, between days) drops
     the brushes and lets the flute sit out every other pass; 'shift' plays
     the lot. Switching mood never restarts the music.

     Notes are scheduled ahead against ctx.currentTime rather than fired from
     setInterval, so the timing does not drift, stutter under load, or fire in
     a clump when a backgrounded tab wakes up.                              */

  var BPM = 92;
  var STEP = 60 / BPM / 4;        // one sixteenth
  var BAR = STEP * 16;
  var BARS = 8;
  // A generous queue: a backgrounded tab throttles setInterval to about once a
  // second, and anything shorter than that would leave audible holes.
  var AHEAD = 1.4;
  var stepIndex = 0, nextStepTime = 0, loopCount = 0;
  var mood = 'calm';

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // bass root, then the chord the pad and harp draw from (MIDI notes)
  var PROG = [
    { root: 48, notes: [60, 64, 67, 71] },   // Cmaj7
    { root: 41, notes: [57, 60, 65, 67] },   // F(add9)
    { root: 40, notes: [59, 62, 64, 67] },   // Em7
    { root: 45, notes: [57, 60, 64, 67] },   // Am7
    { root: 50, notes: [57, 60, 62, 65] },   // Dm7
    { root: 43, notes: [59, 62, 65, 67] },   // G7
    { root: 44, notes: [56, 60, 63, 67] },   // Abmaj7  (bVI)
    { root: 46, notes: [58, 62, 65, 69] }    // Bbmaj7  (bVII) -> home
  ];

  // the flute: [step in bar, MIDI note, length in sixteenths]
  var TUNE = [
    [[0, 76, 6], [6, 74, 2], [8, 76, 4], [12, 79, 4]],
    [[0, 81, 8], [8, 79, 4], [12, 77, 2], [14, 79, 2]],
    [[0, 79, 6], [6, 77, 2], [8, 76, 4], [12, 74, 4]],
    [[0, 76, 12], [12, 72, 4]],
    [[0, 74, 4], [4, 77, 4], [8, 81, 6], [14, 79, 2]],
    [[0, 77, 4], [4, 76, 4], [8, 74, 8]],
    [[0, 75, 4], [4, 72, 4], [8, 75, 4], [12, 79, 4]],
    [[0, 77, 4], [4, 74, 4], [8, 77, 2], [10, 79, 2], [12, 81, 4]]
  ];

  /* A plain ADSR on a gain node. linearRamp, not exponentialRamp, because the
     exponential form cannot reach zero and leaves every note buzzing. */
  function shape(g, t, peak, atk, dur, rel) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.setValueAtTime(peak, t + Math.max(atk, dur));
    g.gain.linearRampToValueAtTime(0, t + Math.max(atk, dur) + rel);
  }

  function voice(type, f, t, peak, atk, dur, rel, bus, detune) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    if (detune) o.detune.value = detune;
    shape(g, t, peak, atk, dur, rel);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + atk + dur + rel + 0.05);
    return o;
  }

  /* Strings: the chord, two detuned layers, swelling in over the bar. */
  function strings(ch, t) {
    ch.notes.forEach(function (m, i) {
      [-6, 7].forEach(function (c) {
        voice(i % 2 ? 'sine' : 'triangle', mtof(m), t, 0.026, 0.7, BAR - 0.5, 0.7, padBus, c);
      });
    });
  }

  /* Harp: a bright pluck that rings and fades. */
  function harp(m, t, vol) {
    var f = mtof(m);
    voice('triangle', f, t, vol, 0.004, 0.02, 0.9, leadBus);
    voice('sine', f * 2, t, vol * 0.35, 0.004, 0.01, 0.4, leadBus);
  }

  /* Pizzicato bass: short, round, with a quiet octave so it reads on a phone. */
  function pizz(m, t, vol) {
    var f = mtof(m);
    voice('sine', f, t, vol, 0.01, 0.06, 0.32, musicGain);
    voice('triangle', f * 2, t, vol * 0.18, 0.008, 0.03, 0.2, musicGain);
  }

  /* Flute: a sine with a slow-onset vibrato and a puff of breath at the
     start of each note. */
  function flute(m, t, len) {
    var f = mtof(m), dur = Math.max(0.12, len * STEP - 0.05);
    var o = voice('sine', f, t, 0.085, 0.07, dur, 0.22, leadBus);
    var vib = ctx.createOscillator(), amt = ctx.createGain();
    vib.frequency.value = 5.2;
    amt.gain.setValueAtTime(0, t);
    amt.gain.linearRampToValueAtTime(9, t + Math.min(0.5, dur));   // cents
    vib.connect(amt); amt.connect(o.detune);
    vib.start(t); vib.stop(t + dur + 0.35);
    voice('triangle', f * 2, t, 0.010, 0.07, dur, 0.2, leadBus);
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2.2; bp.Q.value = 2.5;
    var g = ctx.createGain();
    shape(g, t, 0.022, 0.03, 0.03, 0.12);
    s.connect(bp); bp.connect(g); g.connect(leadBus);
    s.start(t, Math.random() * 0.5); s.stop(t + 0.25);
  }

  /* Glockenspiel: a struck bar with its inharmonic overtone. */
  function glock(m, t, vol) {
    var f = mtof(m);
    voice('sine', f, t, vol, 0.003, 0.01, 0.9, leadBus);
    voice('sine', f * 2.76, t, vol * 0.3, 0.003, 0.01, 0.3, leadBus);
  }

  /* Brushed backbeat: filtered noise, nowhere near a drum machine. */
  function brush(t, vol) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 1.8;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    s.connect(f); f.connect(g); g.connect(musicGain);
    s.start(t); s.stop(t + 0.12);
  }

  function scheduleStep(i, t) {
    var bar = Math.floor(i / 16) % BARS, s = i % 16;
    var ch = PROG[bar];
    var shift = mood === 'shift';

    if (s === 0) strings(ch, t);

    // harp: up through the chord and over the top, then a second run that
    // starts a note higher, so each bar climbs rather than repeats
    var n = ch.notes, k = s % 8, base = s < 8 ? 0 : 1;
    var idx = (base + k) % 4, oct = Math.floor((base + k) / 4) * 12;
    harp(n[idx] + oct, t, (k === 0 ? 0.060 : 0.042) * (shift ? 1 : 0.85));

    // pizzicato bass on 1 and 3, the fifth on the "and" of 3 in the shift
    if (s === 0) pizz(ch.root, t, 0.30);
    if (s === 8) pizz(ch.root + 7, t, 0.22);
    if (shift && s === 12) pizz(ch.root + 12, t, 0.14);

    // the flute: every pass in the shift, every other pass in calm
    var sing = shift || (loopCount % 2 === 1);
    if (loopCount > 0 && sing) {
      TUNE[bar].forEach(function (nt) {
        if (nt[0] !== s) return;
        flute(nt[1], t, nt[2]);
        if (loopCount % 2 === 0) glock(nt[1] + 12, t, 0.028);
      });
    }

    if (shift && (s === 4 || s === 12)) brush(t, s === 12 ? 0.028 : 0.018);

    if (i === BARS * 16 - 1) loopCount++;
  }

  /* Lookahead scheduler: queue everything that falls inside the next AHEAD
     seconds, then go back to sleep. Called far more often than a note lands. */
  function pump() {
    if (!ctx) return;
    while (nextStepTime < ctx.currentTime + AHEAD) {
      if (nextStepTime < ctx.currentTime) nextStepTime = ctx.currentTime + 0.02;
      if (!muted) scheduleStep(stepIndex, nextStepTime);
      stepIndex = (stepIndex + 1) % (BARS * 16);
      nextStepTime += STEP;
    }
  }

  /* ===================================================== the grounds ======
     Out in the castle grounds: a fountain that never stops trickling, the
     odd droplet, and birds in the trees. All of it on its own quiet bus
     under the music, started on the first tap (browsers will not make a
     sound before one) and silenced with everything else by the mute. */
  var ambBus = null, ambTimer = null, nextBirds = 0, nextDrip = 0, lastVoice = 0;

  function startAmbience() {
    if (ambBus || !ctx) return;
    ambBus = ctx.createGain(); ambBus.gain.value = 0.55; ambBus.connect(master);

    // the fountain: looped noise, band-limited to a splashy hiss, breathing
    var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.6;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    var g = ctx.createGain(); g.gain.value = 0.022;
    var lfo = ctx.createOscillator(), amt = ctx.createGain();
    lfo.frequency.value = 0.31; amt.gain.value = 0.007;
    lfo.connect(amt); amt.connect(g.gain); lfo.start();
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(ambBus);
    src.start();

    nextBirds = ctx.currentTime + 2;
    nextDrip = ctx.currentTime + 1;
    ambTimer = setInterval(ambience, 200);
  }

  function chirp(t, f0, f1, dur, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    shape(g, t, vol, 0.008, dur * 0.4, dur * 0.6);
    o.connect(g); g.connect(ambBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function ambience() {
    if (!ctx || muted) return;
    var now = ctx.currentTime;
    if (now >= nextBirds) {
      // a little phrase of two to five chirps from somewhere in the trees
      var n = 2 + Math.floor(Math.random() * 4), f = 2600 + Math.random() * 1800, t = now + 0.05;
      for (var i = 0; i < n; i++) {
        var up = Math.random() < 0.5;
        chirp(t, up ? f * 0.8 : f * 1.15, up ? f * 1.2 : f * 0.75, 0.06 + Math.random() * 0.05, 0.022);
        t += 0.09 + Math.random() * 0.08;
      }
      nextBirds = now + 3 + Math.random() * 7;
    }
    if (now >= nextDrip) {
      chirp(now + 0.02, 700 + Math.random() * 500, 1500 + Math.random() * 600, 0.05, 0.012);
      nextDrip = now + 0.6 + Math.random() * 2.2;
    }
  }

  /* -------------------------------------------------------- the voices
     Each kind of customer has a little call: a chocobo's "kweh!", a
     moogle's "kupo", a black mage's crackle of fire... `vol` is 0..1, so the
     grounds can make far-off strollers quieter than the queue. */
  function at(dt, fn) { setTimeout(fn, dt); }

  function call(type, f0, f1, dur, vol, filt) {
    if (muted || !ensure() || !ambBus) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    shape(g, t, vol, 0.012, dur * 0.5, dur * 0.5);
    if (filt) {
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = filt; bp.Q.value = 1.4;
      o.connect(bp); bp.connect(g);
    } else o.connect(g);
    g.connect(ambBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function hiss(dur, freq, vol) {
    if (muted || !ctx || !ambBus) return;
    var t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    var g = ctx.createGain(); shape(g, t, vol, 0.02, dur * 0.4, dur * 0.6);
    s.connect(f); f.connect(g); g.connect(ambBus);
    s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.05);
  }

  var VOICES = {
    chocobo: function (v) {
      call('sawtooth', 520, 980, 0.11, 0.10 * v, 1300);
      at(110, function () { call('sawtooth', 980, 560, 0.17, 0.10 * v, 1200); });
    },
    moogle: function (v) {
      call('triangle', 980, 900, 0.08, 0.16 * v);
      at(115, function () { call('triangle', 760, 620, 0.14, 0.15 * v); });
    },
    cactuar: function (v) {
      call('square', 1500, 500, 0.08, 0.05 * v);
      at(100, function () { call('square', 1500, 500, 0.08, 0.05 * v); });
    },
    tonberry: function (v) {
      hiss(0.16, 6500, 0.05 * v);
      call('sine', 2600, 2500, 0.3, 0.035 * v);
    },
    bomb: function (v) {
      hiss(0.45, 3200, 0.07 * v);
      call('sawtooth', 160, 90, 0.3, 0.05 * v, 500);
    },
    blackmage: function (v) {
      [0, 60, 120].forEach(function (d, i) {
        at(d, function () { call('sine', 880 * (1 + i * 0.26), 1760 * (1 + i * 0.26), 0.12, 0.06 * v); });
      });
      at(150, function () { hiss(0.35, 900, 0.08 * v); });
    },
    whitemage: function (v) {
      [1568, 1319, 1175, 1568].forEach(function (f, i) {
        at(i * 90, function () { call('sine', f, f, 0.5, 0.05 * v); });
      });
    },
    caitsith: function (v) {
      call('sine', 640, 980, 0.12, 0.09 * v);
      at(110, function () { call('sine', 980, 560, 0.22, 0.09 * v); });
    },
    mandragora: function (v) {
      call('square', 1300, 1900, 0.07, 0.05 * v);
      at(80, function () { call('square', 1700, 1250, 0.09, 0.045 * v); });
    }
  };

  CS.audio = {
    resume: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      started = true;
      startAmbience();
    },
    /* `m` is 'calm' (menus, the shop) or 'shift'. If the music is already
       playing this only changes the mood, so it carries on from the same
       bar rather than starting over. */
    startMusic: function (m) {
      this.resume();
      if (m) mood = m;
      if (musicTimer || !ctx) return;
      stepIndex = 0; loopCount = 0;
      nextStepTime = ctx.currentTime + 0.08;
      pump();
      musicTimer = setInterval(pump, 40);
    },

    /* A customer's call, by their `look`; 0..1 volume. Rate-limited so a
       crowd does not turn into a choir. */
    voice: function (look, vol) {
      if (muted || !ctx || !VOICES[look]) return;
      var now = ctx.currentTime;
      if (now - lastVoice < 0.7) return;
      lastVoice = now;
      VOICES[look](CS.clamp(vol == null ? 1 : vol, 0, 1));
    },
    // the timer stops, but notes already queued are left to ring out
    stopMusic: function () { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    setMuted: function (m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.45;
    },
    isMuted: function () { return muted; },

    /* Matches CS.game.debug(): hands the console the live nodes so the mix can
       be metered with an AnalyserNode rather than judged by ear. */
    debug: function () { return { ctx: ctx, master: master, music: musicGain, step: stepIndex }; },

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

    /* The brass bell over the shop door, rung by a customer coming in. Two
       sines a fifth apart with a long tail, so it rings rather than blips. */
    doorbell: function () {
      tone(1318.5, 0.85, 'sine', 0.13);
      tone(1976.0, 0.70, 'sine', 0.07);
      setTimeout(function () {
        tone(1318.5, 0.55, 'sine', 0.07);
        tone(1976.0, 0.45, 'sine', 0.04);
      }, 115);
    },

    /* The till: the clunk of the drawer, the ring of the bell inside it, and
       the rattle of change. Played when a customer pays. */
    cash: function () {
      noise(0.07, 2300, 0.16, 1.2);                   // key press
      tone(1567.98, 0.55, 'sine', 0.20);              // the bell
      tone(2349.32, 0.40, 'sine', 0.10);
      setTimeout(function () {
        noise(0.16, 420, 0.22, 0.7);                  // drawer sliding open
        tone(130, 0.14, 'sine', 0.12, 96);            // and hitting the stop
      }, 120);
      setTimeout(function () {
        noise(0.09, 5200, 0.10, 2.2);                 // change rattling in
        noise(0.07, 3800, 0.07, 2.4);
      }, 245);
    },

    /* Loose coins landing on a wooden counter -- the tip. */
    coins: function () {
      for (var i = 0; i < 3; i++) {
        (function (d) {
          setTimeout(function () {
            noise(0.05, 4200 + Math.random() * 2600, 0.09, 3.0);
            tone(1760 + Math.random() * 700, 0.10, 'sine', 0.07);
          }, d);
        })(i * 85 + Math.random() * 40);
      }
    },
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
    },

    /* The end-of-day victory fanfare: a quick climb, a held chord, then the
       bVII - I turn home that every RPG battle win ends on. */
    victory: function () {
      function chord(fs, dur, vol) {
        fs.forEach(function (f) { tone(f, dur, 'square', vol); tone(f, dur, 'triangle', vol * 0.8); });
      }
      [392, 523.25, 659.25, 783.99].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.12, 'square', 0.13); }, i * 75);
      });
      setTimeout(function () { chord([523.25, 659.25, 783.99, 1046.5], 0.55, 0.06); }, 300);
      setTimeout(function () { chord([466.16, 587.33, 698.46], 0.26, 0.065); }, 900);
      setTimeout(function () { chord([523.25, 659.25, 783.99, 1046.5], 1.1, 0.07); }, 1180);
    },

    /* Level up: a harp glissando up the pentatonic and a bright bell on top. */
    levelUp: function () {
      [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.35, 'triangle', 0.11); }, i * 38);
      });
      setTimeout(function () {
        tone(2093, 0.9, 'sine', 0.12); tone(2637, 0.8, 'sine', 0.07); tone(3136, 0.7, 'sine', 0.05);
      }, 360);
    },

    /* Feather Frenzy: a rising rush of air under a shimmer of bells, like a
       haste spell being cast. */
    spell: function () {
      if (muted || !ensure()) return;
      var t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noiseBuf;
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5;
      f.frequency.setValueAtTime(400, t);
      f.frequency.exponentialRampToValueAtTime(5000, t + 0.6);
      var g = ctx.createGain(); shape(g, t, 0.22, 0.1, 0.35, 0.35);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t); s.stop(t + 0.85);
      [1318.51, 1567.98, 2093, 2637.02, 3135.96].forEach(function (fq, i) {
        setTimeout(function () { tone(fq, 0.5, 'sine', 0.07); }, 120 + i * 60);
      });
    }
  };
})(window.CS);
