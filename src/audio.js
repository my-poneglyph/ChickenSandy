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
     Four bars of Am7 - Dm7 - G7 - Cmaj7 at 82bpm, played by four soft voices:
     a swelling pad, a plucked bass that walks into each change, an off-beat
     electric-piano figure and a sparse pentatonic melody. Only the pad and
     bass are on a fixed pattern; the piano and melody are chosen per bar with
     rests, so the loop never lands the same way twice.

     Two deliberate differences from the old loop. It is not a square wave --
     every voice is a sine or triangle with a real attack, which is what makes
     the difference between a tone and a beep. And notes are scheduled ahead
     against ctx.currentTime instead of being fired from setInterval, so the
     timing does not drift, stutter under load, or fire in a clump when a
     backgrounded tab wakes up.                                             */

  var BPM = 82;
  var STEP = 60 / BPM / 4;        // one sixteenth, ~0.183s
  var BAR = STEP * 16;
  // A generous queue: a backgrounded tab throttles setInterval to about once a
  // second, and anything shorter than that would leave audible holes in the
  // loop every time the player switched away and back.
  var AHEAD = 1.4;                // seconds of notes kept queued
  var stepIndex = 0, nextStepTime = 0, loopCount = 0;

  // root, then the voicing the pad and piano draw from
  var PROG = [
    { root: 110.00, notes: [220.00, 261.63, 329.63, 392.00] },   // Am7
    { root: 146.83, notes: [293.66, 349.23, 440.00, 523.25] },   // Dm7
    { root:  98.00, notes: [196.00, 246.94, 293.66, 349.23] },   // G7
    { root: 130.81, notes: [261.63, 329.63, 392.00, 493.88] }    // Cmaj7
  ];
  // C major pentatonic: every note of it is consonant over all four chords,
  // which is why the melody can wander freely without ever needing to resolve
  var PENT = [392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
  var melIdx = 3;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* A plain ADSR on a gain node. linearRamp, not exponentialRamp, because the
     exponential form cannot reach zero and leaves every note buzzing. */
  function shape(g, t, peak, atk, dur, rel) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.setValueAtTime(peak, t + Math.max(atk, dur));
    g.gain.linearRampToValueAtTime(0, t + Math.max(atk, dur) + rel);
  }

  function pad(ch, t) {
    ch.notes.forEach(function (f, i) {
      [-5, 6].forEach(function (cents) {      // two slightly detuned layers
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = i % 2 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = cents;
        shape(g, t, 0.036, 0.85, BAR - 0.55, 0.75);
        o.connect(g); g.connect(padBus);
        o.start(t); o.stop(t + BAR + 0.4);
      });
    });
  }

  function bass(f, t, dur, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    shape(g, t, vol == null ? 0.30 : vol, 0.018, dur * 0.45, dur * 0.55);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.1);
    // a quiet octave up so the bass still reads on a phone speaker
    var o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'triangle'; o2.frequency.value = f * 2;
    shape(g2, t, 0.045, 0.012, dur * 0.25, dur * 0.4);
    o2.connect(g2); g2.connect(musicGain);
    o2.start(t); o2.stop(t + dur + 0.1);
  }

  function keys(f, t, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    shape(g, t, vol, 0.012, 0.06, 0.55);
    o.connect(g); g.connect(leadBus);
    o.start(t); o.stop(t + 0.7);
  }

  function melody(f, t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    shape(g, t, 0.105, 0.02, 0.10, 0.85);
    o.connect(g); g.connect(leadBus);
    o.start(t); o.stop(t + 1.0);
    // a whisper of the octave above gives it a glassy, bell-like edge
    var o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'sine'; o2.frequency.value = f * 2;
    shape(g2, t, 0.024, 0.02, 0.05, 0.45);
    o2.connect(g2); g2.connect(leadBus);
    o2.start(t); o2.stop(t + 0.6);
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
    var bar = (i >> 4) & 3, s = i & 15;
    var ch = PROG[bar], next = PROG[(bar + 1) & 3];

    if (s === 0) { pad(ch, t); bass(ch.root, t, 0.85); }
    if (s === 6) bass(ch.root, t, 0.34, 0.20);
    if (s === 8) bass(ch.root * 1.5, t, 0.62, 0.26);     // the fifth
    // walk a semitone into the next chord on the last eighth of the bar
    if (s === 14) bass(next.root * 0.9439, t, 0.30, 0.19);

    // electric piano on the off-beats, two of the four slots per bar
    if (s === 2 || s === 7 || s === 10 || s === 15) {
      if (Math.random() < 0.55) {
        keys(ch.notes[1 + ((i + bar) % 3)], t, 0.055 + Math.random() * 0.02);
      }
    }

    // the melody sits out the first loop, so the shift opens quietly
    if (loopCount > 0 && (s === 0 || s === 3 || s === 6 || s === 10 || s === 12)) {
      if (Math.random() < 0.38) {
        var jump = Math.random() < 0.72 ? 1 : 2;
        melIdx = clamp(melIdx + (Math.random() < 0.5 ? -jump : jump), 0, PENT.length - 1);
        melody(PENT[melIdx], t);
      }
    }

    if (s === 4 || s === 12) brush(t, s === 12 ? 0.030 : 0.020);

    if (i === 63) loopCount++;
  }

  /* Lookahead scheduler: queue everything that falls inside the next AHEAD
     seconds, then go back to sleep. Called far more often than a note lands. */
  function pump() {
    if (!ctx) return;
    while (nextStepTime < ctx.currentTime + AHEAD) {
      if (nextStepTime < ctx.currentTime) nextStepTime = ctx.currentTime + 0.02;
      if (!muted) scheduleStep(stepIndex, nextStepTime);
      stepIndex = (stepIndex + 1) & 63;
      nextStepTime += STEP;
    }
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
      stepIndex = 0; loopCount = 0; melIdx = 3;
      nextStepTime = ctx.currentTime + 0.08;
      pump();
      musicTimer = setInterval(pump, 40);
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
