/* Procedural pixel-art textures. Nothing is loaded from disk, so the game
   works straight off the filesystem with no server and no image assets. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var cache = {};

  function rngFrom(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function hex(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

  function shade(color, amt) {
    var r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    r = CS.clamp(Math.round(r + amt), 0, 255);
    g = CS.clamp(Math.round(g + amt), 0, 255);
    b = CS.clamp(Math.round(b + amt), 0, 255);
    return (r << 16) | (g << 8) | b;
  }
  CS.shade = shade;

  function canvas(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return { c: c, x: x };
  }

  function finish(c, repeat) {
    var t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat, repeat);
    return t;
  }

  /* Horizontal plank boards with grain -- the workhorse wood look. */
  function planks(size, plankH, base, opts) {
    opts = opts || {};
    var o = canvas(size), x = o.x, rng = rngFrom(opts.seed || 7);
    for (var py = 0; py < size; py++) {
      var row = Math.floor(py / plankH);
      var seam = (py % plankH === 0);
      for (var px = 0; px < size; px++) {
        var tint = Math.floor((rngFrom(row * 131 + 7)() - 0.5) * 22);
        var grain = (rng() < 0.30) ? (rng() < 0.5 ? -13 : 11) : 0;
        var c = shade(base, tint + grain);
        if (seam) c = shade(base, -38);
        // vertical board breaks
        if (opts.breaks && (px + row * 5) % Math.floor(size / 2) === 0) c = shade(base, -32);
        x.fillStyle = hex(c);
        x.fillRect(px, py, 1, 1);
      }
    }
    return o.c;
  }

  function speckle(size, base, spread, density, seed) {
    var o = canvas(size), x = o.x, rng = rngFrom(seed || 3);
    for (var py = 0; py < size; py++) {
      for (var px = 0; px < size; px++) {
        var c = base;
        if (rng() < (density == null ? 0.5 : density)) {
          c = shade(base, Math.floor((rng() - 0.5) * 2 * (spread || 16)));
        }
        x.fillStyle = hex(c);
        x.fillRect(px, py, 1, 1);
      }
    }
    return o;
  }

  var G = {
    /* Kitchen floor: warm planks with a subtle checker of two tones. */
    floor: function () {
      var size = 32, o = canvas(size), x = o.x, rng = rngFrom(21);
      for (var py = 0; py < size; py++) {
        for (var px = 0; px < size; px++) {
          var big = ((Math.floor(px / 16) + Math.floor(py / 16)) % 2 === 0);
          var base = big ? 0xa06c33 : 0x8c5b2a;
          var row = Math.floor(py / 8);
          var tint = Math.floor((rngFrom(row * 17 + (big ? 3 : 9))() - 0.5) * 18);
          var c = shade(base, tint + (rng() < 0.28 ? (rng() < 0.5 ? -12 : 10) : 0));
          if (py % 8 === 0) c = shade(base, -34);
          if (px % 16 === 0) c = shade(base, -26);
          x.fillStyle = hex(c); x.fillRect(px, py, 1, 1);
        }
      }
      return finish(o.c, 1);
    },

    diningFloor: function () { return finish(planks(32, 8, 0x6b4526, { seed: 44 }), 1); },

    wall: function () {
      var size = 32, o = canvas(size), x = o.x, rng = rngFrom(88);
      for (var py = 0; py < size; py++) {
        for (var px = 0; px < size; px++) {
          var col = Math.floor(px / 8);
          var base = 0x6b3f1e;
          var tint = Math.floor((rngFrom(col * 53 + 5)() - 0.5) * 20);
          var c = shade(base, tint + (rng() < 0.25 ? (rng() < 0.5 ? -11 : 9) : 0));
          if (px % 8 === 0) c = shade(base, -36);
          if (py % 16 === 0) c = shade(base, -18);
          x.fillStyle = hex(c); x.fillRect(px, py, 1, 1);
        }
      }
      return finish(o.c, 1);
    },

    counterWood: function () { return finish(planks(16, 4, 0xa8703a, { seed: 12 }), 1); },
    counterTop:  function () { return finish(planks(16, 8, 0xc08f4e, { seed: 31 }), 1); },
    crate:       function () {
      var size = 16, o = speckle(size, 0x8a5a2b, 14, 0.45, 5), x = o.x;
      x.fillStyle = hex(0x5a381c);
      x.fillRect(0, 0, size, 2); x.fillRect(0, size - 2, size, 2);
      x.fillRect(0, 0, 2, size); x.fillRect(size - 2, 0, 2, size);
      x.fillRect(0, 7, size, 2);
      return finish(o.c, 1);
    },

    metal: function () {
      var size = 16, o = speckle(size, 0x3c4048, 14, 0.5, 9), x = o.x;
      x.fillStyle = hex(0x22262c);
      [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(function (p) { x.fillRect(p[0], p[1], 1, 1); });
      return finish(o.c, 1);
    },

    darkMetal: function () { return finish(speckle(16, 0x2a2e34, 12, 0.5, 15).c, 1); },

    oil: function () {
      var size = 16, o = speckle(size, 0xd9821f, 20, 0.6, 23), x = o.x;
      var rng = rngFrom(77);
      for (var i = 0; i < 14; i++) {
        x.fillStyle = hex(0xf5c257);
        x.fillRect(Math.floor(rng() * size), Math.floor(rng() * size), 1, 1);
      }
      return finish(o.c, 1);
    },

    /* Red + white checkered apron, straight off the reference art. */
    checker: function () {
      var size = 16, o = canvas(size), x = o.x;
      for (var py = 0; py < size; py++) {
        for (var px = 0; px < size; px++) {
          // coarse 2x2 checks so they still read on a small apron
          var on = ((Math.floor(px / 8) + Math.floor(py / 8)) % 2 === 0);
          x.fillStyle = on ? hex(0xc23a2c) : hex(0xf3e6d0);
          x.fillRect(px, py, 1, 1);
        }
      }
      return finish(o.c, 1);
    },

    /* Plumage: mostly white, with soft grey barring and a few darker quill
       marks so the chicken is not a flat blob at close range. */
    feathers: function () {
      var size = 16, o = canvas(size), x = o.x, rng = rngFrom(61);
      for (var py = 0; py < size; py++) {
        for (var px = 0; px < size; px++) {
          var base = 0xf7f5ee;
          var band = (py % 5 === 4) ? -10 : 0;               // faint barring
          var n = rng() < 0.30 ? (rng() < 0.5 ? -7 : 5) : 0;
          x.fillStyle = hex(shade(base, band + n));
          x.fillRect(px, py, 1, 1);
        }
      }
      // scattered quill flecks
      var r2 = rngFrom(97);
      for (var i = 0; i < 10; i++) {
        x.fillStyle = hex(0xe2ddcf);
        var qx = Math.floor(r2() * size), qy = Math.floor(r2() * size);
        x.fillRect(qx, qy, 1, 2);
      }
      return finish(o.c, 1);
    },
    breading: function () {
      var size = 16, o = speckle(size, 0xdd8a2a, 26, 0.75, 101), x = o.x;
      var rng = rngFrom(202);
      for (var i = 0; i < 24; i++) {
        x.fillStyle = hex(rng() < 0.5 ? 0xf6b455 : 0xa85b13);
        x.fillRect(Math.floor(rng() * size), Math.floor(rng() * size), 1, 1);
      }
      return finish(o.c, 1);
    },
    stone: function () {
      var size = 16, o = speckle(size, 0x8a8681, 18, 0.6, 191), x = o.x;
      x.fillStyle = hex(0x5e5b57);
      x.fillRect(0, 5, size, 1); x.fillRect(0, 11, size, 1);
      x.fillRect(5, 0, 1, 5); x.fillRect(11, 6, 1, 5); x.fillRect(3, 12, 1, 4);
      return finish(o.c, 1);
    },

    bun:    function () { return finish(speckle(16, 0xdca75a, 16, 0.55, 131).c, 1); },
    plate:  function () { return finish(speckle(16, 0xf2efe6, 7, 0.3, 151).c, 1); },
    charred:function () { return finish(speckle(16, 0x342a22, 14, 0.7, 171).c, 1); }
  };

  CS.tex = function (name) {
    if (!cache[name]) {
      if (!G[name]) throw new Error('unknown texture ' + name);
      cache[name] = G[name]();
    }
    return cache[name];
  };
  CS.texRepeat = function (name, rx, ry) {
    var key = name + ':' + rx + 'x' + ry;
    if (!cache[key]) {
      var t = CS.tex(name).clone();
      t.needsUpdate = true;
      t.repeat.set(rx, ry);
      cache[key] = t;
    }
    return cache[key];
  };
})(window.CS);

