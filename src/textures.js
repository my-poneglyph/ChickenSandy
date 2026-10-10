/* Procedural painted textures. Nothing is loaded from disk, so the game
   works straight off the filesystem with no server and no image assets.

   These are soft, hand-painted-looking surfaces -- sandstone flags, dressed
   stone, honey-coloured wood, golden breading -- drawn once into a canvas at
   load time, then sampled smoothly with mipmaps. They are authored in sRGB
   and tagged as such, so the renderer's colour management handles them the
   same way as every material colour. */
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
    return { c: c, x: c.getContext('2d') };
  }

  function finish(c, repeat) {
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat, repeat);
    return t;
  }

  /* Soft per-pixel grain over whatever is already drawn: a little value
     noise so flat paint reads as a real surface up close. */
  function grain(x, size, amount, seed) {
    var img = x.getImageData(0, 0, size, size), d = img.data, rng = rngFrom(seed || 9);
    for (var i = 0; i < d.length; i += 4) {
      var n = (rng() - 0.5) * amount;
      d[i] = CS.clamp(d[i] + n, 0, 255);
      d[i + 1] = CS.clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = CS.clamp(d[i + 2] + n, 0, 255);
    }
    x.putImageData(img, 0, 0);
  }

  function rgba(c, a) {
    return 'rgba(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ',' + a + ')';
  }

  /* Big, soft, low-contrast blotches -- the "painted" variation that keeps a
     large surface from looking like flat plastic. Wraps at the edges so the
     texture still tiles. */
  function blotches(x, size, colors, n, rMin, rMax, alpha, seed) {
    var rng = rngFrom(seed);
    for (var i = 0; i < n; i++) {
      var cx = rng() * size, cy = rng() * size, r = rMin + rng() * (rMax - rMin);
      var col = colors[Math.floor(rng() * colors.length)];
      for (var ox = -1; ox <= 1; ox++) {
        for (var oy = -1; oy <= 1; oy++) {
          var px = cx + ox * size, py = cy + oy * size;
          if (px + r < 0 || px - r > size || py + r < 0 || py - r > size) continue;
          var g = x.createRadialGradient(px, py, 0, px, py, r);
          g.addColorStop(0, rgba(col, alpha));
          g.addColorStop(1, rgba(col, 0));
          x.fillStyle = g;
          x.fillRect(px - r, py - r, r * 2, r * 2);
        }
      }
    }
  }

  function roundRect(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py);
    x.lineTo(px + w - r, py); x.quadraticCurveTo(px + w, py, px + w, py + r);
    x.lineTo(px + w, py + h - r); x.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
    x.lineTo(px + r, py + h); x.quadraticCurveTo(px, py + h, px, py + h - r);
    x.lineTo(px, py + r); x.quadraticCurveTo(px, py, px + r, py);
    x.closePath();
  }

  /* Courses of dressed stones with soft bevels: the shared recipe behind the
     floor flags, the walls and the hearth. Every course sums to exactly the
     canvas width and a stone that runs off the right edge is drawn again on
     the left, so the result tiles in both directions. */
  function masonry(o) {
    var size = o.size, c = canvas(size), x = c.x, rng = rngFrom(o.seed);
    x.fillStyle = hex(o.grout);
    x.fillRect(0, 0, size, size);
    var rows = Math.round(size / o.rowH);
    var lip = Math.max(1, size / 128), foot = Math.max(2, size / 96);
    for (var r = 0; r < rows; r++) {
      var y = r * o.rowH;
      var start = Math.floor(rng() * o.minW), xx = start;
      while (xx < start + size) {
        var w = Math.min(o.minW + Math.floor(rng() * (o.maxW - o.minW)), start + size - xx);
        if (start + size - xx - w < o.minW * 0.6) w = start + size - xx;
        var col = shade(o.base, (rng() - 0.5) * o.vary);
        [xx, xx - size].forEach(function (sx) {
          if (sx + w < 0 || sx > size) return;
          var g = o.gap;
          roundRect(x, sx + g, y + g, w - g * 2, o.rowH - g * 2, o.round);
          var grd = x.createLinearGradient(sx, y, sx + w * 0.3, y + o.rowH);
          grd.addColorStop(0, hex(shade(col, 14)));
          grd.addColorStop(1, hex(shade(col, -10)));
          x.fillStyle = grd;
          x.fill();
          // a lighter lip along the top edge and a soft shadow along the bottom
          x.fillStyle = rgba(0xffffff, 0.16);
          x.fillRect(sx + g + o.round, y + g, w - g * 2 - o.round * 2, lip);
          x.fillStyle = rgba(0x000000, 0.10);
          x.fillRect(sx + g + o.round, y + o.rowH - g - foot, w - g * 2 - o.round * 2, foot);
        });
        xx += w;
      }
    }
    if (o.blot) blotches(x, size, o.blot, 14, size * 0.06, size * 0.18, 0.12, o.seed + 1);
    grain(x, size, o.grain || 10, o.seed + 2);
    return c.c;
  }

  /* Boards running across the face, with long wavy grain and a dark seam. */
  function wood(o) {
    var size = o.size, c = canvas(size), x = c.x, rng = rngFrom(o.seed);
    var n = Math.round(size / o.board), seam = Math.max(1, size / 96);
    for (var i = 0; i < n; i++) {
      var col = shade(o.base, (rng() - 0.5) * o.vary);
      var y0 = i * o.board;
      var grd = x.createLinearGradient(0, y0, 0, y0 + o.board);
      grd.addColorStop(0, hex(shade(col, 10)));
      grd.addColorStop(1, hex(shade(col, -8)));
      x.fillStyle = grd;
      x.fillRect(0, y0, size, o.board);
      for (var s = 0; s < o.streaks; s++) {
        var sy = y0 + 2 + rng() * (o.board - 4), amp = 0.6 + rng() * 1.6, ph = rng() * 6.28;
        x.strokeStyle = rgba(shade(col, -30), 0.22 + rng() * 0.2);
        x.lineWidth = 0.6 + rng() * 1.1;
        x.beginPath();
        for (var px = 0; px <= size; px += 4) {
          var yy = sy + Math.sin(px / size * Math.PI * 2 * (1 + (s % 2)) + ph) * amp;
          if (px === 0) x.moveTo(px, yy); else x.lineTo(px, yy);
        }
        x.stroke();
      }
      x.fillStyle = rgba(shade(o.base, -55), 0.75);
      x.fillRect(0, y0, size, seam);
      x.fillStyle = rgba(0xffffff, 0.10);
      x.fillRect(0, y0 + seam, size, 1);
    }
    grain(x, size, 8, o.seed + 3);
    return c.c;
  }

  var G = {
    /* Kitchen floor: big warm sandstone flags, two map tiles per repeat. */
    floor: function () {
      return finish(masonry({ size: 256, seed: 21, rowH: 64, minW: 70, maxW: 140,
        base: 0xc6a77c, vary: 22, grout: 0x7e6548, gap: 2.5, round: 7, grain: 9,
        blot: [0xd8bd92, 0xae8e64, 0xcfae80] }), 1);
    },

    /* Dining room: smaller, rosier pavers so the two rooms read apart. */
    diningFloor: function () {
      return finish(masonry({ size: 256, seed: 44, rowH: 64, minW: 48, maxW: 96,
        base: 0xae7f64, vary: 26, grout: 0x6e5242, gap: 2.5, round: 6, grain: 9,
        blot: [0xc2937a, 0x946a52] }), 1);
    },

    /* Walls: cool grey castle stone, so the warm floor and the oak and
       brass in front of it stand out. */
    wall: function () {
      return finish(masonry({ size: 256, seed: 88, rowH: 64, minW: 60, maxW: 120,
        base: 0xaaa6a4, vary: 22, grout: 0x6c6870, gap: 2, round: 5, grain: 8,
        blot: [0xbcb8b2, 0x8e8b96] }), 1);
    },

    /* Hearth and stove stone: a cooler grey so the fire glows against it. */
    stone: function () {
      return finish(masonry({ size: 128, seed: 191, rowH: 32, minW: 34, maxW: 64,
        base: 0xb5ada3, vary: 20, grout: 0x81786e, gap: 1.5, round: 4, grain: 10 }), 1);
    },

    /* Cabinet and furniture wood: warm honey oak. */
    counterWood: function () {
      return finish(wood({ size: 128, seed: 12, board: 32, base: 0xbd8550, vary: 18, streaks: 5 }), 1);
    },

    /* Worktops: glazed blue-and-white tiles, four to a side, each with a
       little painted flower. Food reads clearly against them, and they put
       the castle blue into every counter. */
    counterTop: function () {
      var size = 256, n = 4, t = size / n, c = canvas(size), x = c.x;
      x.fillStyle = '#c9c4b8'; x.fillRect(0, 0, size, size);
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          var px = i * t, py = j * t;
          roundRect(x, px + 2, py + 2, t - 4, t - 4, 6);
          var g = x.createLinearGradient(px, py, px + t, py + t);
          g.addColorStop(0, '#f7f3ea'); g.addColorStop(1, '#e2dccd');
          x.fillStyle = g; x.fill();
          x.strokeStyle = '#3f62ad'; x.lineWidth = 3;
          roundRect(x, px + 8, py + 8, t - 16, t - 16, 5); x.stroke();
          var cx = px + t / 2, cy = py + t / 2;
          x.fillStyle = '#3f62ad';
          for (var k = 0; k < 4; k++) {
            var a = k * Math.PI / 2 + Math.PI / 4;
            x.beginPath(); x.ellipse(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 7, 4, a, 0, Math.PI * 2); x.fill();
          }
          x.fillStyle = '#e8b54a';
          x.beginPath(); x.arc(cx, cy, 4, 0, Math.PI * 2); x.fill();
          x.fillStyle = 'rgba(255,255,255,0.5)';
          x.fillRect(px + 10, py + 5, t * 0.35, 2);
        }
      }
      grain(x, size, 5, 33);
      return finish(c.c, 1);
    },

    /* Produce crates: lighter slatted pine. */
    crate: function () {
      return finish(wood({ size: 128, seed: 5, board: 32, base: 0xd0a06a, vary: 22, streaks: 3 }), 1);
    },

    oil: function () {
      var size = 128, c = canvas(size), x = c.x;
      var g = x.createRadialGradient(64, 64, 4, 64, 64, 90);
      g.addColorStop(0, '#ffd877'); g.addColorStop(0.6, '#f0a52c'); g.addColorStop(1, '#c97a16');
      x.fillStyle = g; x.fillRect(0, 0, size, size);
      var rng = rngFrom(77);
      for (var i = 0; i < 40; i++) {
        x.strokeStyle = rgba(0xfff3c0, 0.35 + rng() * 0.4);
        x.lineWidth = 1;
        x.beginPath(); x.arc(rng() * size, rng() * size, 1.5 + rng() * 5, 0, Math.PI * 2); x.stroke();
      }
      return finish(c.c, 1);
    },

    /* Downy plumage: almost white, with soft lighter and darker tufts, so a
       material colour tints it to whatever bird or animal it is on. */
    fluff: function () {
      var size = 128, c = canvas(size), x = c.x;
      x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, size, size);
      blotches(x, size, [0xffffff, 0xdadada], 40, 6, 18, 0.45, 61);
      var rng = rngFrom(62);
      for (var i = 0; i < 260; i++) {
        var px = rng() * size, py = rng() * size, l = 3 + rng() * 6, a = -1.2 + rng() * 0.6;
        x.strokeStyle = rgba(rng() < 0.5 ? 0xffffff : 0xd0d0d0, 0.5);
        x.lineWidth = 1;
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
      }
      return finish(c.c, 1);
    },

    /* Raw chicken: pink, with pale marbling. */
    rawMeat: function () {
      var size = 64, c = canvas(size), x = c.x;
      x.fillStyle = '#f7a59a'; x.fillRect(0, 0, size, size);
      blotches(x, size, [0xffcdc4, 0xe9857c], 14, 4, 12, 0.6, 63);
      var rng = rngFrom(64);
      for (var i = 0; i < 9; i++) {
        x.strokeStyle = rgba(0xfff0ea, 0.6); x.lineWidth = 1.5;
        x.beginPath();
        var sx = rng() * size, sy = rng() * size;
        x.moveTo(sx, sy); x.quadraticCurveTo(sx + 8, sy + rng() * 10 - 5, sx + 16, sy + rng() * 6 - 3);
        x.stroke();
      }
      return finish(c.c, 1);
    },

    /* Crunchy golden breading: a warm base covered in craggy crumbs, so it
       reads as crisp rather than flat orange. */
    breading: function () {
      var size = 128, c = canvas(size), x = c.x, rng = rngFrom(101);
      x.fillStyle = '#d9862c'; x.fillRect(0, 0, size, size);
      for (var i = 0; i < 520; i++) {
        var t = rng();
        x.fillStyle = t < 0.18 ? '#a95a14' : t < 0.6 ? '#f0a83e' : t < 0.9 ? '#ffc964' : '#ffe3a0';
        x.beginPath(); x.arc(rng() * size, rng() * size, 1.2 + rng() * 3.6, 0, Math.PI * 2); x.fill();
      }
      grain(x, size, 10, 102);
      return finish(c.c, 1);
    },

    /* Glossy bun crust: deep gold, lighter towards the crown. */
    bun: function () {
      var size = 64, c = canvas(size), x = c.x;
      var g = x.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, '#f2b45e'); g.addColorStop(1, '#d48a3a');
      x.fillStyle = g; x.fillRect(0, 0, size, size);
      blotches(x, size, [0xffd28a, 0xc07a30], 10, 6, 14, 0.4, 131);
      grain(x, size, 6, 132);
      return finish(c.c, 1);
    },

    plate: function () {
      var size = 64, c = canvas(size), x = c.x;
      x.fillStyle = '#fbf8f2'; x.fillRect(0, 0, size, size);
      grain(x, size, 4, 151);
      return finish(c.c, 1);
    },

    charred: function () {
      var size = 64, c = canvas(size), x = c.x, rng = rngFrom(171);
      x.fillStyle = '#2d2420'; x.fillRect(0, 0, size, size);
      for (var i = 0; i < 90; i++) {
        x.fillStyle = rng() < 0.85 ? '#1a1412' : '#7a3a16';
        x.beginPath(); x.arc(rng() * size, rng() * size, 1 + rng() * 2.5, 0, Math.PI * 2); x.fill();
      }
      return finish(c.c, 1);
    }
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

  /* Canvas-drawn signage and sprites are authored in sRGB like everything
     else; this tags them so they are not washed out by the output encode. */
  CS.srgb = function (t) { t.encoding = THREE.sRGBEncoding; return t; };
})(window.CS);
