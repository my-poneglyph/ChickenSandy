/* Builds the kitchen: floor, walls, every station, decor and lighting.
   Also owns the little particle pool used for sparks and spatter, and the
   soft steam and smoke puffs.

   The look is a storybook castle kitchen: sandstone flags underfoot, pale
   dressed-stone walls, honey-oak cabinets with limestone tops, stone stoves
   with iron skillets over glowing coals, royal-blue banners, copper pans on
   the wall and an arched window onto a castle on the hill. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var T = CS.TILE;

  var OAK = { color: 0xffffff, tex: 'counterWood', rough: 0.7 };
  var OAK_D = { color: 0x7c5434, rough: 0.75 };
  var LIME = { color: 0xffffff, tex: 'counterTop', rough: 0.45 };
  var STONE = { color: 0xffffff, tex: 'stone', rough: 0.9 };
  var IRON = { color: 0x34353b, rough: 0.45, metal: 0.7 };
  var BRASS = { color: 0xd6a648, rough: 0.3, metal: 0.85 };
  var COPPER = { color: 0xc8744a, rough: 0.32, metal: 0.85 };
  var ROYAL = { color: 0x2f4f96, rough: 0.8 };
  var CREAM = { color: 0xf4ead6, rough: 0.8 };

  function glow(color) { return CS.mat({ color: color, basic: true }); }
  function put(parent, mesh) { parent.add(mesh); return mesh; }

  /* An oak cabinet with a limestone top, a recessed door and a brass knob.
     Returns the height of the worktop. */
  function counterBase(g, h) {
    h = h || 0.88;
    g.add(CS.box(T * 0.90, 0.10, T * 0.90, OAK_D, 0, 0.05, 0));                 // kick plinth
    g.add(CS.box(T * 0.94, h - 0.08, T * 0.94, OAK, 0, 0.08 + (h - 0.08) / 2, 0));
    g.add(CS.box(T * 0.70, (h - 0.08) * 0.62, 0.04, OAK_D, 0, 0.08 + (h - 0.08) * 0.5, T * 0.47));
    g.add(CS.box(T * 0.62, (h - 0.08) * 0.52, 0.05, OAK, 0, 0.08 + (h - 0.08) * 0.5, T * 0.475));
    g.add(CS.ball(0.045, 0.045, 0.035, BRASS, T * 0.24, 0.08 + (h - 0.08) * 0.55, T * 0.50));
    g.add(CS.box(T * 0.99, 0.12, T * 0.99, LIME, 0, h + 0.06, 0));
    return h + 0.12;
  }

  var BUILD = {
    counter: function (g) {
      var y = counterBase(g);
      g.add(CS.box(T * 0.60, 0.05, T * 0.48, { color: 0xd9a868, rough: 0.6 }, 0, y + 0.025, 0)); // board
      return y + 0.05;
    },

    crate: function (g, st) {
      var y = counterBase(g, 0.52);
      var C = { color: 0xffffff, tex: 'crate', rough: 0.8 };
      g.add(CS.box(T * 0.84, 0.50, T * 0.84, C, 0, y + 0.25, 0));
      g.add(CS.box(T * 0.86, 0.07, T * 0.86, OAK_D, 0, y + 0.47, 0));           // rim
      var top = y + 0.50;
      if (st.def.gives === 'rawChicken') {
        var RAW = { color: 0xffffff, tex: 'rawMeat', rough: 0.35 };
        [[-0.34, -0.2], [0.3, -0.26], [-0.1, 0.3], [0.32, 0.26], [0.02, -0.02]].forEach(function (p, i) {
          var m = CS.ball(0.26, 0.09, 0.2, RAW, p[0], top + 0.02 + (i === 4 ? 0.08 : 0), p[1]);
          m.rotation.y = i * 1.1;
          g.add(m);
        });
      } else {
        var SPUD = { color: 0xcf9f62, tex: 'fluff', rough: 0.85 };
        [[-0.4, -0.3], [0.05, -0.38], [0.42, -0.25], [-0.32, 0.12], [0.1, 0.05],
         [0.4, 0.22], [-0.12, 0.38], [0.2, 0.4], [-0.05, -0.12]].forEach(function (p, i) {
          var m = CS.ball(0.17, 0.13, 0.13, SPUD, p[0], top + 0.04 + (i > 6 ? 0.08 : 0), p[1]);
          m.rotation.y = i * 0.9;
          g.add(m);
        });
      }
      st.topY = top + 0.12;
      return st.topY;
    },

    plates: function (g, st) {
      var y = counterBase(g);
      for (var i = 0; i < 6; i++) {
        var d = new THREE.Group();
        CS.models.dish(d);
        d.position.y = y + i * 0.06;
        g.add(d);
      }
      st.topY = y + 0.36;
      return st.topY;
    },

    buns: function (g, st) {
      var y = counterBase(g, 0.62);
      // a woven basket of rolls
      var WICKER = { color: 0xc99a5c, rough: 0.85 };
      g.add(CS.cyl(T * 0.42, T * 0.36, 0.34, WICKER, 0, y + 0.17, 0, 24));
      put(g, CS.torus(T * 0.42, 0.04, 0, WICKER, 0, y + 0.34, 0)).rotation.x = Math.PI / 2;
      put(g, CS.box(T * 0.6, 0.04, T * 0.6, CREAM, 0, y + 0.33, 0, 0)).rotation.y = 0.5;   // cloth
      var BUN = { color: 0xffffff, tex: 'bun', emissive: 0x1a0c00, rough: 0.45 };
      var top = y + 0.34;
      [[-0.3, -0.22], [0.28, -0.24], [-0.24, 0.28], [0.3, 0.26], [0.0, 0.0]].forEach(function (p, i) {
        var b = CS.shell(0.24, 0.17, 0.24, BUN, 0, Math.PI * 2, 0, Math.PI / 2);
        b.position.set(p[0], top + (i === 4 ? 0.1 : 0), p[1]);
        g.add(b);
      });
      st.topY = top + 0.26;
      return st.topY;
    },

    topping: function (g, st) {
      var y = counterBase(g, 0.62);
      var c = CS.ING[st.def.ing].color;
      // an open wooden tray of fresh produce
      g.add(CS.box(T * 0.86, 0.30, T * 0.86, { color: 0xffffff, tex: 'crate', rough: 0.8 }, 0, y + 0.15, 0));
      g.add(CS.box(T * 0.74, 0.04, T * 0.74, OAK_D, 0, y + 0.29, 0));
      var top = y + 0.31;
      if (st.def.ing === 'lettuce') {
        [[-0.3, -0.25], [0.3, -0.2], [-0.25, 0.3], [0.3, 0.3], [0, 0.02]].forEach(function (p, i) {
          g.add(CS.ball(0.26, 0.19, 0.26, { color: CS.shade(c, -16), rough: 0.6 }, p[0], top + 0.12, p[1]));
          g.add(CS.ball(0.18, 0.15, 0.18, { color: CS.shade(c, 18), rough: 0.6 }, p[0], top + 0.2 + (i === 4 ? 0.06 : 0), p[1]));
        });
      } else if (st.def.ing === 'tomato') {
        [[-0.34, -0.3], [0.0, -0.34], [0.34, -0.28], [-0.32, 0.05], [0.04, 0.04],
         [0.36, 0.08], [-0.22, 0.36], [0.2, 0.36]].forEach(function (p, i) {
          g.add(CS.ball(0.16, 0.14, 0.16, { color: c, rough: 0.25 }, p[0], top + 0.12, p[1]));
          put(g, CS.cone(0.05, 0.03, { color: 0x3f8f2a }, p[0], top + 0.27, p[1], 5)).rotation.y = i;
        });
      } else {
        // pickles in a big glass jar
        g.add(CS.cyl(0.36, 0.36, 0.55, { color: 0xcfe8d0, rough: 0.1, opacity: 0.55 }, 0, top + 0.28, 0, 24));
        for (var k = 0; k < 9; k++) {
          var a = k * 2.4;
          var pk = CS.ball(0.07, 0.16, 0.07, { color: k % 2 ? c : CS.shade(c, -20), rough: 0.4 },
            Math.cos(a) * 0.18, top + 0.18 + (k % 3) * 0.1, Math.sin(a) * 0.18);
          pk.rotation.z = (k % 3 - 1) * 0.4;
          g.add(pk);
        }
        g.add(CS.cyl(0.38, 0.38, 0.07, BRASS, 0, top + 0.59, 0, 24));
      }
      st.topY = top + 0.3;
      return st.topY;
    },

    sauce: function (g, st) {
      var y = counterBase(g, 0.80);
      var c = CS.ING[st.def.ing].color;
      var GLAZE = { color: c, rough: 0.2 };
      g.add(CS.cyl(0.22, 0.24, 0.44, GLAZE, 0, y + 0.22, 0, 24));               // bottle
      g.add(CS.ball(0.22, 0.12, 0.22, GLAZE, 0, y + 0.44, 0));                  // shoulder
      g.add(CS.cyl(0.245, 0.245, 0.16, { color: 0xf4ead6, rough: 0.7 }, 0, y + 0.22, 0, 24)); // label
      g.add(CS.cyl(0.09, 0.11, 0.12, { color: 0xfbf8f1, rough: 0.4 }, 0, y + 0.58, 0, 16));  // cap
      g.add(CS.cone(0.07, 0.16, { color: 0xfbf8f1, rough: 0.4 }, 0, y + 0.72, 0, 16));        // nozzle
      st.topY = y + 0.8;
      return st.topY;
    },

    cups: function (g, st) {
      var y = counterBase(g);
      g.add(CS.box(0.55, 0.06, 0.55, OAK_D, 0, y + 0.03, 0));
      [-0.12, 0.12].forEach(function (x) {
        g.add(CS.cyl(0.025, 0.025, 0.8, BRASS, x * 1.6, y + 0.4, 0, 8));
      });
      for (var i = 0; i < 5; i++) {
        g.add(CS.cyl(0.15, 0.12, 0.14, { color: 0xffffff, tex: 'plate', rough: 0.35 }, 0, y + 0.13 + i * 0.12, 0, 20));
      }
      st.topY = y + 0.8;
      return st.topY;
    },

    /* A stone stove with an iron skillet over glowing coals. */
    fryer: function (outer, st) {
      // Stand the stove proud of the wall line so the pan stays readable even
      // when the camera is looking along the wall.
      var g = new THREE.Group();
      g.position.z = 0.26;
      outer.add(g);

      g.add(CS.box(T * 0.94, 0.66, T * 0.94, STONE, 0, 0.33, 0));
      g.add(CS.box(T * 0.98, 0.08, T * 0.98, { color: 0xd8cbb4, rough: 0.8 }, 0, 0.68, 0));  // hearth slab
      // the fire mouth: a dark arch with the coals glowing inside
      g.add(CS.box(T * 0.58, 0.32, 0.08, glow(0x1a120d), 0, 0.30, T * 0.46, 0));
      put(g, CS.torus(T * 0.29, 0.05, Math.PI, STONE, 0, 0.46, T * 0.47)).scale.set(1, 0.6, 1);
      st.coals = CS.box(T * 0.5, 0.14, 0.06, CS.mat({ color: 0xff7a14, basic: true }), 0, 0.22, T * 0.48);
      st.coals.material = st.coals.material.clone();
      g.add(st.coals);

      // the skillet: a shallow iron dish -- base, two stacked rings for the
      // flared wall, a rolled rim -- with golden oil sitting low inside it,
      // so whatever is frying sits *in* the pan and stays in view
      g.add(CS.cyl(T * 0.36, T * 0.33, 0.08, IRON, 0, 0.76, 0, 32));
      put(g, CS.torus(T * 0.37, 0.05, 0, IRON, 0, 0.82, 0)).rotation.x = Math.PI / 2;
      put(g, CS.torus(T * 0.40, 0.045, 0, IRON, 0, 0.88, 0)).rotation.x = Math.PI / 2;
      g.add(CS.cyl(T * 0.36, T * 0.36, 0.02, { color: 0xffffff, tex: 'oil', emissive: 0x6a3406, rough: 0.12 }, 0, 0.815, 0, 32));
      var arm = CS.box(0.10, 0.07, 0.60, IRON, 0, 0.86, T * 0.62);
      g.add(arm);
      put(g, CS.cyl(0.06, 0.06, 0.34, { color: 0x8a5a33, rough: 0.6 }, 0, 0.86, T * 0.88, 14)).rotation.x = Math.PI / 2;

      // warm glow that pulses while something is in the oil
      st.glow = CS.cyl(T * 0.35, T * 0.35, 0.01, CS.mat({ color: 0xff9a2e, basic: true, opacity: 0.0 }), 0, 0.83, 0, 32);
      st.glow.material = st.glow.material.clone();
      st.glow.material.transparent = true;
      st.glow.castShadow = false;
      g.add(st.glow);
      st.topY = 0.92;
      return 0.92;
    },

    serve: function (g, st) {
      var y = counterBase(g, 0.78);
      // the pass: two oak posts, a beam, and a blue-and-cream awning
      g.add(CS.box(0.16, 1.5, 0.16, OAK, -T * 0.45, y + 0.75, -T * 0.3));
      g.add(CS.box(0.16, 1.5, 0.16, OAK, T * 0.45, y + 0.75, -T * 0.3));
      g.add(CS.box(T, 0.18, 0.22, OAK, 0, y + 1.55, -T * 0.3));
      for (var i = 0; i < 4; i++) {
        var a = CS.box(T * 0.25, 0.04, 0.55, i % 2 ? CREAM : ROYAL, -T * 0.375 + i * T * 0.25, y + 1.62, -T * 0.08, 0);
        a.rotation.x = 0.35;
        g.add(a);
      }
      // the bell you ding when a plate goes out
      put(g, CS.shell(0.09, 0.09, 0.09, BRASS, 0, Math.PI * 2, 0, Math.PI / 2)).position.set(T * 0.32, y + 0.01, 0.3);
      st.topY = y;
      return y;
    },

    /* A banded oak barrel with a dark mouth. */
    trash: function (g, st) {
      g.add(CS.cyl(T * 0.38, T * 0.34, 0.95, { color: 0xffffff, tex: 'counterWood', rough: 0.7 }, 0, 0.475, 0, 24));
      [0.12, 0.8].forEach(function (yy) {
        g.add(CS.cyl(T * 0.385, T * 0.385, 0.06, IRON, 0, yy, 0, 24));
      });
      put(g, CS.torus(T * 0.37, 0.04, 0, IRON, 0, 0.95, 0)).rotation.x = Math.PI / 2;
      g.add(CS.cyl(T * 0.34, T * 0.34, 0.02, glow(0x1a1410), 0, 0.93, 0, 24));
      st.topY = 1.0;
      return 1.0;
    }
  };

  /* ------------------------------------------------------- stonework
     Walls are built, not painted: a dark mortar core with real dressed
     stones standing proud of it in running courses, a heavy plinth along
     the floor and an overhanging coping on top. Every piece of a wall is
     baked into one mesh (CS.merge) with its own tint, so all that relief
     costs a single draw call per wall tile. */
  var STONE_TINTS = [0xb3aea8, 0xa9a4a0, 0xbcb6ae, 0x9f9b99, 0xb7ab9a, 0xa8a6ab, 0xc0b8aa];
  var MORTAR_TINT = 0x57535c, PLINTH_TINT = 0x7d7873, COPING_TINT = 0xc4beb5;
  var stoneMat = null;

  function hash(n) { var s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }
  function tinted(mesh, hex) { mesh.userData.tint = CS.linear(hex); return mesh; }

  /* Courses of stones across one face of a wall. (cx, cz) is the middle of
     the face, on its surface; (nx, nz) is its outward normal; it is w wide
     and the stones fill y0..y1. Joints are laid out along the wall in world
     coordinates, so courses run on unbroken from one wall tile to the next,
     and a stone cut in two at a tile edge keeps one tint and one depth. */
  function stoneCourses(out, cx, cz, nx, nz, w, y0, y1, o) {
    o = o || {};
    var L = o.len || 0.7, rowH = o.rowH || 0.46, gap = 0.05, depth = 0.18;
    var tx = Math.abs(nz), tz = Math.abs(nx);          // the face runs along x or z
    var g0 = cx * tx + cz * tz;                          // where this face sits along it
    var line = Math.round((tx ? cz : cx) * 10);          // which wall this is
    var rows = Math.max(1, Math.round((y1 - y0) / rowH)), rh = (y1 - y0) / rows;
    function edge(k, r) { return k * L + (r % 2) * L * 0.5 + (hash(k * 7.1 + r * 131.3 + line * 17.7) - 0.5) * L * 0.35; }
    for (var r = 0; r < rows; r++) {
      var k0 = Math.floor((g0 - w / 2) / L) - 2, k1 = Math.ceil((g0 + w / 2) / L) + 1;
      for (var k = k0; k <= k1; k++) {
        var A = edge(k, r), Bk = edge(k + 1, r);
        var a = Math.max(A - g0, -w / 2), b = Math.min(Bk - g0, w / 2);
        if (b - a < 0.08) continue;
        // only real joints get a gap; a cut at the tile edge butts up flush
        var ga = (A - g0 > -w / 2) ? gap / 2 : 0, gb = (Bk - g0 < w / 2) ? gap / 2 : 0;
        var len = b - a - ga - gb, mid = (a + ga + b - gb) / 2;
        var seed = k * 3.7 + r * 91.1 + line * 5.3;
        var proud = 0.03 + hash(seed) * 0.05, off = proud - depth / 2;
        var y = y0 + r * rh + rh / 2 + (hash(seed + 2) - 0.5) * 0.02;
        var m = CS.box(tx ? len : depth, rh - gap, tz ? len : depth, {},
          cx + nx * off + tx * mid, y, cz + nz * off + tz * mid);
        out.push(tinted(m, STONE_TINTS[Math.floor(hash(seed + 1) * STONE_TINTS.length)]));
      }
    }
  }

  /* A strip along the foot or the top of a face: the plinth and the coping
     lip. It stands `proud` out from the face. */
  function band(out, cx, cz, nx, nz, w, y, h, proud, tint) {
    var tx = Math.abs(nz), tz = Math.abs(nx), d = 0.3;
    var m = CS.box(tx ? w : d, h, tz ? w : d, { round: 0.035 },
      cx + nx * (proud - d / 2), y + h / 2, cz + nz * (proud - d / 2));
    out.push(tinted(m, tint));
  }

  function stoneMesh(parts) {
    if (!stoneMat) stoneMat = CS.mat({ color: 0xffffff, tex: 'grain', rough: 0.85, vc: true });
    return CS.merge(parts, stoneMat);
  }

  /* One wall tile: core, then for each face that can be seen, stones from
     wherever it becomes visible (the floor, or the top of a lower wall next
     to it) up to the coping. */
  function wallTile(scene, x, z, h, faces) {
    var parts = [];
    parts.push(tinted(CS.box(T, h, T, { round: 0 }, x, h / 2, z), MORTAR_TINT));
    faces.forEach(function (f) {
      var nx = f[0], nz = f[1], from = f[2];
      var cx = x + nx * T / 2, cz = z + nz * T / 2;
      if (from === 0) band(parts, cx, cz, nx, nz, T, 0, 0.26, 0.13, PLINTH_TINT);
      stoneCourses(parts, cx, cz, nx, nz, T, from === 0 ? 0.26 : from, h);
      band(parts, cx, cz, nx, nz, T, h, 0.15, 0.12, COPING_TINT);
    });
    parts.push(tinted(CS.box(T, 0.15, T, { round: 0.035 }, x, h + 0.075, z), COPING_TINT));
    scene.add(stoneMesh(parts));
  }

  var LABELS = {
    F: 'Fryer', S: 'Serve', X: 'Trash', K: 'Chicken', T: 'Potatoes',
    P: 'Plates', B: 'Buns', L: 'Lettuce', O: 'Tomato', I: 'Pickles',
    M: 'Mayo', Q: 'BBQ', H: 'Hot Sauce', Y: 'Ketchup', U: 'Cups'
  };
  var LABEL_ACCENT = {
    F: '#c8592b', S: '#3f8a3a', X: '#5a5048', L: '#4f9b3a', O: '#c8392b',
    I: '#7d9a2c', M: '#b9a272', Q: '#7d3417', H: '#d0431f', Y: '#b81f14'
  };

  /* One plaque per station group, tilted to face the fixed camera. */
  function addLabel(scene, st) {
    var ch = st.char;
    if (!LABELS[ch]) return;
    if (CS.charAt(st.col - 1, st.row) === ch) return;   // continuation of a run
    if (CS.charAt(st.col, st.row - 1) === ch) return;

    var runW = 1, runH = 1;
    while (CS.charAt(st.col + runW, st.row) === ch) runW++;
    while (CS.charAt(st.col, st.row + runH) === ch) runH++;

    // Phones get a larger board, tilted to the phone camera's steeper pitch.
    var phone = CS.platform.mobile;
    var m = CS.models.label(LABELS[ch], LABEL_ACCENT[ch], phone ? 2.85 : 2.08);
    var ox = (runW - 1) * T / 2, oz = (runH - 1) * T / 2;
    if (st.row === CS.layout.bounds.r0) oz += T * 0.42;
    else if (st.row === CS.layout.bounds.r1) oz -= T * 0.42;
    if (st.col === CS.layout.bounds.c0) ox += T * 0.42;
    else if (st.col === CS.layout.bounds.c1) ox -= T * 0.42;

    m.position.set(st.x + ox, st.topY + (phone ? 0.98 : 0.8), st.z + oz);
    m.rotation.x = -(Math.PI / 2 - (phone ? CS.CAM_PITCH_MOBILE : CS.CAM_PITCH));
    scene.add(m);
  }

  /* The shop's front door: an oak frame, two leaves propped open, a strip of
     porch so arrivals are not walking on nothing, and a lantern outside.
     Customers spawn out there in the dusk and the wall hides them until they
     step through, which is what sells them as having come in off the street. */
  function doorway(scene, x, z, w, h) {
    var post = 0.18;
    [-1, 1].forEach(function (s) {
      scene.add(CS.box(post, h, 0.36, OAK, x + s * (w / 2 - post / 2), h / 2, z));
    });
    scene.add(CS.box(w + post, 0.22, 0.36, OAK, x, h - 0.11, z));
    scene.add(CS.box(w + post * 2.4, 0.16, 0.50, { color: 0xe8dcc4 }, x, h + 0.10, z));

    // two leaves, hinged on the posts and propped open into the room
    [-1, 1].forEach(function (s) {
      var hinge = new THREE.Group();
      hinge.position.set(x + s * (w / 2 - post), 0, z + 0.06);
      // ~66 deg: wide enough to walk through, shallow enough that the leaves
      // still catch the light instead of vanishing edge-on into the doorway
      hinge.rotation.y = s * 1.15;
      scene.add(hinge);
      var leafW = w / 2 - post * 0.5;
      hinge.add(CS.box(leafW, h - 0.22, 0.10, ROYAL, -s * leafW / 2, (h - 0.22) / 2, 0));
      hinge.add(CS.box(leafW * 0.86, 0.10, 0.12, IRON, -s * leafW / 2, h * 0.62, 0.02));
      hinge.add(CS.box(leafW * 0.86, 0.10, 0.12, IRON, -s * leafW / 2, h * 0.28, 0.02));
      hinge.add(CS.ball(0.05, 0.05, 0.05, BRASS, -s * (leafW - 0.16), h * 0.45, 0.09));
    });

    // the little brass bell the door knocks on the way in
    put(scene, CS.shell(0.08, 0.1, 0.08, BRASS, 0, Math.PI * 2, 0, Math.PI / 2)).position.set(x, h - 0.32, z + 0.22);

    // porch: paving outside, and a dusk backdrop so the doorway is an
    // opening onto somewhere rather than a hole into the void
    var porch = CS.box(w + 3.0, 0.08, 4.0, { color: 0xffffff, tex: 'diningFloor' }, x, -0.05, z - 2.2);
    porch.receiveShadow = true;
    scene.add(porch);
    var DUSK = { color: 0x3c4a7a, rough: 1 };
    scene.add(CS.box(w + 4.4, 3.4, 0.4, DUSK, x, 1.7, z - 4.3));
    scene.add(CS.box(0.4, 3.4, 4.4, DUSK, x - (w + 4.0) / 2, 1.7, z - 2.2));
    scene.add(CS.box(0.4, 3.4, 4.4, DUSK, x + (w + 4.0) / 2, 1.7, z - 2.2));

    lantern(scene, x - (w / 2 + 0.75), 2.15, z - 0.55);
  }

  function lantern(scene, x, y, z) {
    var g = new THREE.Group();
    g.add(CS.cyl(0.02, 0.02, 0.7, IRON, 0, 0.62, 0, 8));
    g.add(CS.cone(0.24, 0.16, IRON, 0, 0.28, 0, 6));
    g.add(CS.ball(0.15, 0.17, 0.15, glow(0xffc46a), 0, 0.02, 0));
    [0, 1, 2, 3, 4, 5].forEach(function (i) {
      var a = i / 6 * Math.PI * 2;
      g.add(CS.cyl(0.014, 0.014, 0.4, IRON, Math.cos(a) * 0.18, 0.02, Math.sin(a) * 0.18, 6));
    });
    g.add(CS.cyl(0.2, 0.22, 0.06, IRON, 0, -0.2, 0, 6));
    g.position.set(x, y, z);
    g.traverse(function (o) { o.castShadow = false; });
    scene.add(g);
    return g;
  }

  var flames = [];

  /* Stone hearth with a live fire. */
  function fireplace(scene, x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(CS.box(3.0, 2.7, 0.42, STONE, 0, 1.35, 0));
    g.add(CS.box(3.3, 0.24, 0.62, { color: 0xe0d4be, rough: 0.8 }, 0, 2.74, 0.06));       // mantel
    g.add(CS.box(1.9, 1.5, 0.26, glow(0x140f0b), 0, 0.80, 0.16, 0));                       // firebox
    put(g, CS.torus(0.95, 0.12, Math.PI, STONE, 0, 1.45, 0.24));
    // logs
    put(g, CS.cyl(0.11, 0.11, 1.3, { color: 0x6a4428 }, 0, 0.22, 0.32, 10)).rotation.z = Math.PI / 2;
    put(g, CS.cyl(0.10, 0.10, 1.0, { color: 0x7a5232 }, 0.06, 0.40, 0.30, 10)).rotation.set(0, 0.3, Math.PI / 2);
    // flames (animated in tick): unit cones scaled to size every frame
    [[-0.45, 0.6, 0xff8a1e], [0.0, 0.85, 0xffc23c], [0.42, 0.6, 0xff6a14]].forEach(function (f) {
      var m = CS.cone(0.5, 1, glow(f[2]), f[0], 0.30 + f[1] / 2, 0.30, 10);
      m.scale.set(0.42, f[1], 0.3);
      m.castShadow = false;
      g.add(m);
      flames.push({ m: m, base: f[1], y0: 0.30, ph: Math.random() * 6.28 });
    });
    var light = new THREE.PointLight(0xff9a3c, 1.0, 12, 2);
    light.position.set(x, 1.1, z + 1.2);
    scene.add(light);
    flames.push({ light: light, ph: Math.random() * 6.28 });
    scene.add(g);
  }

  /* Arched window onto the castle on the hill. */
  function kitchenWindow(scene, x, y, z, w, h) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    var archR = w / 2;
    var pane = CS.models.skyPane(w - 0.2, h + archR - 0.1);
    pane.position.set(0, archR / 2 - 0.05, 0.04);
    g.add(pane);
    // mask the square top corners of the view with stone
    var cornerW = archR * 0.32;
    [-1, 1].forEach(function (s) {
      g.add(CS.box(cornerW, archR * 0.62, 0.06, { color: 0xb0aba6, tex: 'grain', rough: 0.9 }, s * (w / 2 - cornerW / 2), h / 2 + archR * 0.66, 0.06, 0));
    });
    var F = { color: 0xe8dcc4, rough: 0.8 };
    g.add(CS.box(0.22, h, 0.24, F, -w / 2, 0, 0.08));
    g.add(CS.box(0.22, h, 0.24, F, w / 2, 0, 0.08));
    g.add(CS.torus(archR, 0.13, Math.PI, F, 0, h / 2, 0.08));
    g.add(CS.box(w + 0.3, 0.2, 0.42, F, 0, -h / 2 - 0.08, 0.14));                     // sill
    g.add(CS.box(0.06, h + archR * 0.9, 0.08, IRON, 0, archR * 0.45 - 0.02, 0.1));   // glazing bars
    g.add(CS.box(w, 0.06, 0.08, IRON, 0, 0.2, 0.1));
    // a pot of herbs on the sill
    g.add(CS.cyl(0.18, 0.13, 0.26, { color: 0xc06a3a, rough: 0.7 }, w * 0.3, -h / 2 + 0.15, 0.2, 16));
    [[0, 0.22, 0], [0.1, 0.18, 0.05], [-0.1, 0.2, -0.03], [0.02, 0.3, 0.06]].forEach(function (p) {
      g.add(CS.ball(0.11, 0.1, 0.11, { color: 0x5c9e3e, rough: 0.7 }, w * 0.3 + p[0], -h / 2 + 0.15 + p[1], 0.2 + p[2]));
    });
    scene.add(g);
  }

  function wallPicture(scene, x, y, z, kind) {
    var f = CS.models.foodFrame(kind, 0.86);
    f.position.set(x, y, z + 0.05);
    scene.add(f);
  }

  /* A royal-blue pennant on a little brass rod. */
  function banner(scene, x, y, z, w) {
    var b = CS.models.banner(w || 1.1);
    b.position.set(x, y, z + 0.04);
    scene.add(b);
    var rodY = y + (w || 1.1) * 0.75 + 0.02;
    put(scene, CS.cyl(0.03, 0.03, (w || 1.1) + 0.3, BRASS, x, rodY, z + 0.06, 8)).rotation.z = Math.PI / 2;
    [-1, 1].forEach(function (s) {
      scene.add(CS.ball(0.05, 0.05, 0.05, BRASS, x + s * ((w || 1.1) / 2 + 0.15), rodY, z + 0.06));
    });
  }

  /* Copper pans hanging off an iron rail. */
  function panRail(scene, x, y, z, n) {
    put(scene, CS.cyl(0.025, 0.025, n * 0.62 + 0.3, IRON, x, y, z + 0.08, 8)).rotation.z = Math.PI / 2;
    for (var i = 0; i < n; i++) {
      var px = x - (n - 1) * 0.31 + i * 0.62;
      var r = 0.2 + (i % 2) * 0.06;
      var g = new THREE.Group();
      g.position.set(px, y, z + 0.1);
      g.add(CS.cyl(0.015, 0.015, 0.12, IRON, 0, -0.06, 0, 6));
      g.add(CS.box(0.06, 0.34, 0.03, i % 3 === 1 ? IRON : COPPER, 0, -0.28, 0));       // handle
      var pan = CS.cyl(r, r * 0.9, 0.08, i % 3 === 1 ? IRON : COPPER, 0, -0.45 - r, 0.03, 24);
      pan.rotation.x = Math.PI / 2;
      g.add(pan);
      g.rotation.z = (i % 2 ? 1 : -1) * 0.04;
      scene.add(g);
    }
  }

  /* Barrel of the kind stacked round the dining room. */
  function barrel(scene, x, z, s) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s || 1);
    g.add(CS.cyl(0.46, 0.42, 1.05, { color: 0xffffff, tex: 'counterWood', rough: 0.7 }, 0, 0.52, 0, 20));
    [0.2, 0.84].forEach(function (yy) {
      g.add(CS.cyl(0.47, 0.47, 0.07, IRON, 0, yy, 0, 20));
    });
    g.add(CS.cyl(0.42, 0.42, 0.04, OAK_D, 0, 1.06, 0, 20));
    scene.add(g);
  }

  function chest(scene, x, z, rot) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot || 0;
    g.add(CS.box(1.25, 0.62, 0.85, OAK, 0, 0.31, 0));
    g.add(CS.box(1.28, 0.3, 0.88, ROYAL, 0, 0.77, 0));
    g.add(CS.box(0.08, 0.95, 0.9, BRASS, -0.4, 0.47, 0));
    g.add(CS.box(0.08, 0.95, 0.9, BRASS, 0.4, 0.47, 0));
    g.add(CS.box(0.18, 0.22, 0.08, BRASS, 0, 0.6, 0.45));                  // latch
    scene.add(g);
  }

  /* Oak shelf with a row of jars -- the busy background of a real kitchen. */
  function shelf(scene, x, y, z, w) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    g.add(CS.box(w, 0.1, 0.42, OAK, 0, 0, 0.18));
    [-w / 2 + 0.2, w / 2 - 0.2].forEach(function (bx) {
      g.add(CS.box(0.08, 0.3, 0.3, OAK_D, bx, -0.18, 0.12));
    });
    var cols = [0xd6402f, 0x5c9e3e, 0xe0a13a, 0xf3e6d0, 0x7d3417, 0x2f4f96];
    var n = Math.floor(w / 0.5);
    for (var i = 0; i < n; i++) {
      var jx = -w / 2 + 0.3 + i * 0.5;
      var h = 0.26 + (i % 3) * 0.06;
      g.add(CS.cyl(0.13, 0.13, h, { color: cols[i % cols.length], rough: 0.25 }, jx, 0.05 + h / 2, 0.18, 16));
      g.add(CS.cyl(0.14, 0.14, 0.05, i % 2 ? BRASS : CREAM, jx, 0.08 + h, 0.18, 16));
    }
    scene.add(g);
  }

  CS.world = {
    /* Everything goes into one root group rather than straight onto the
       scene, so the whole shop can be thrown away and rebuilt when you move a
       fryer or buy a wing. The helpers below all just call `.add()`, so
       handing them the root instead of the scene is enough. */
    build: function (parent, opts) {
      opts = opts || {};
      var lowSpec = !!opts.lowSpec;
      var stations = [];
      var solids = [];
      var scene = new THREE.Group();
      parent.add(scene);

      /* The floor you actually own. Everything outside it is '~': solid, and
         drawn as nothing, so the room ends at the wall rather than trailing
         off into unbought tiles. */
      var B = CS.layout.bounds;
      var bw = (B.c1 - B.c0 + 1), bh = (B.r1 - B.r0 + 1);
      // Collision heights per tile. Walls are effectively infinite so the chef
      // can never flutter out of the shop; stations use their real top surface
      // so a well-timed hop can put you on the counter.
      var heights = [];
      for (var hr = 0; hr < CS.MAP_H; hr++) {
        heights.push([]);
        for (var hc = 0; hc < CS.MAP_W; hc++) heights[hr].push(0);
      }

      // ---- kitchen floor
      var fw = bw * T, fh = bh * T;
      var fx = CS.OX + (B.c0 * T) + fw / 2, fz = CS.OZ + (B.r0 * T) + fh / 2;
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh),
        CS.mat({ color: 0xffffff, tex: 'floor', rough: 0.2 }));
      floor.material = floor.material.clone();
      floor.material.map = CS.texRepeat('floor', bw / 2, bh / 2);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(fx, 0, fz);
      floor.receiveShadow = true;
      scene.add(floor);
      // and the reflection on top of the polish: see mirror.js
      scene.add(CS.mirror.create(fw, fh, fx, fz, 0.8));

      // ---- dining floor beyond the serving window
      var dine = new THREE.Mesh(new THREE.PlaneGeometry(fw + 10, 10),
        CS.mat({ color: 0xffffff, tex: 'diningFloor', rough: 0.7 }));
      dine.material = dine.material.clone();
      dine.material.map = CS.texRepeat('diningFloor', (fw + 10) / 4.4, 10 / 4.4);
      dine.rotation.x = -Math.PI / 2;
      dine.position.set(fx, -0.02, CS.OZ - 5);
      dine.receiveShadow = true;
      scene.add(dine);

      // ---- tiles
      // The back wall stands tall behind everything. The side walls are low,
      // like the front one, or they would stand in front of the stoves and
      // trays mounted along them and hide them from the camera.
      function wallHeight(col, row) {
        if (row === B.r1) return CS.LOW_WALL_H;
        if (row > B.r0 && (col === B.c0 || col === B.c1)) return CS.SIDE_WALL_H;
        return CS.WALL_H;
      }
      // Which faces of a wall tile can be seen, and from what height: open
      // floor next to it shows the whole face; a lower wall next to it shows
      // the part above that wall; the front wall shows its outside face too.
      function wallFaces(col, row, h) {
        var out = [];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var c = col + d[0], r = row + d[1];
          var nb = CS.charAt(c, r);
          if (row === B.r1 && d[1] === 1) out.push([0, 1, 0]);      // faces the camera
          else if (nb === '.') out.push([d[0], d[1], 0]);
          else if (CS.STATION_DEFS[nb]) out.push([d[0], d[1], 0.85]);  // shows above the kit
          else if (nb === '#' && c >= B.c0 && c <= B.c1 && r >= B.r0 && r <= B.r1) {
            var nh = wallHeight(c, r);
            if (nh < h - 0.3) out.push([d[0], d[1], nh + 0.15]);
          }
        });
        return out;
      }

      for (var row = 0; row < CS.MAP_H; row++) {
        for (var col = 0; col < CS.MAP_W; col++) {
          var ch = CS.MAP[row][col];
          if (ch === '.') continue;
          var p = CS.tileToWorld(col, row);
          solids.push({ col: col, row: row, x: p.x, z: p.z });

          // land you do not own: solid, but there is nothing there to draw
          if (ch === '~') { heights[row][col] = 99; continue; }

          if (ch === '#') {
            heights[row][col] = 99;
            var h = wallHeight(col, row);
            wallTile(scene, p.x, p.z, h, wallFaces(col, row, h));
            continue;
          }

          var def = CS.STATION_DEFS[ch];
          if (!def) continue;
          var g = new THREE.Group();
          g.position.set(p.x, 0, p.z);
          var st = {
            char: ch, type: def.type, def: def, name: def.name,
            col: col, row: row, x: p.x, z: p.z,
            group: g, item: null, topY: 1.02
          };
          st.topY = BUILD[def.type](g, st) || 1.02;
          heights[row][col] = st.topY;

          // stations on a wall face inward
          if (row === B.r0) g.rotation.y = Math.PI;
          else if (col === B.c0) g.rotation.y = Math.PI / 2;
          else if (col === B.c1) g.rotation.y = -Math.PI / 2;

          // fryers sit forward of the wall, so their item slot follows them out
          var ry = g.rotation.y;
          var off = (def.type === 'fryer') ? 0.26 : 0;
          st.slot = new THREE.Object3D();
          st.slot.position.set(p.x + Math.sin(ry) * off, st.topY, p.z + Math.cos(ry) * off);
          scene.add(st.slot);

          scene.add(g);
          addLabel(scene, st);
          stations.push(st);
        }
      }

      /* ---- dining room back wall, with the front door cut into it ----
         The wall is two segments and a lintel rather than one box, so there
         is a real opening for customers to walk through. The gap lines up
         with CS.DOOR_X, which is directly behind the queue, so an arrival
         walks in and straight down the line without a detour. */
      var backZ = CS.OZ - 9.5;
      var wallW = fw + 10, wallCx = fx;
      var wallX0 = wallCx - wallW / 2, wallX1 = wallCx + wallW / 2;
      var dx = CS.DOOR_X, dw = CS.DOOR_W, dh = 2.5;
      var gap0 = dx - dw / 2, gap1 = dx + dw / 2;

      // the same stonework as the kitchen, in bigger blocks, on the face
      // that looks back at the kitchen
      var face = backZ + 0.3, dining = [];
      [[wallX0, gap0], [gap1, wallX1]].forEach(function (seg) {
        var w = seg[1] - seg[0];
        if (w <= 0.01) return;
        var cx = (seg[0] + seg[1]) / 2;
        dining.push(tinted(CS.box(w, 3.6, 0.6, { round: 0 }, cx, 1.8, backZ), MORTAR_TINT));
        band(dining, cx, face, 0, 1, w, 0, 0.3, 0.14, PLINTH_TINT);
        stoneCourses(dining, cx, face, 0, 1, w, 0.3, 3.55, { len: 1.0, rowH: 0.54 });
      });
      // lintel over the opening, then the cornice runs unbroken above it all
      dining.push(tinted(CS.box(dw, 3.6 - dh, 0.6, { round: 0 }, dx, dh + (3.6 - dh) / 2, backZ), MORTAR_TINT));
      stoneCourses(dining, dx, face, 0, 1, dw, dh + 0.2, 3.55, { len: 1.0, rowH: 0.54 });
      dining.push(tinted(CS.box(wallW, 0.3, 0.9, { round: 0.05 }, wallCx, 3.7, backZ), COPING_TINT));
      scene.add(stoneMesh(dining));

      doorway(scene, dx, backZ, dw, dh);

      var s1 = CS.models.signBoard(['Good Food', 'Happy', 'Chicken'], 3.4);
      s1.position.set(fx - fw * 0.40, 2.0, backZ + 0.45);
      scene.add(s1);
      var s2 = CS.models.signBoard(['Chicken', 'Sandwich', '= Happiness'], 3.4);
      s2.position.set(fx + fw * 0.24, 2.0, backZ + 0.45);
      scene.add(s2);
      banner(scene, fx - fw * 0.16, 2.0, backZ + 0.42, 1.0);
      banner(scene, fx + fw * 0.44, 2.0, backZ + 0.42, 1.0);

      // ---- decor on the north wall (the face the camera always sees)
      // Row 0 spans z = [OZ, OZ+T], so the face the camera sees is at OZ+T.
      var wallZ = CS.OZ + T + 0.12;          // clear of the stones standing proud of it

      kitchenWindow(scene, CS.OX + T * 7.0, 1.55, wallZ, 3.4, 1.6);
      fireplace(scene, CS.OX + T * 9.0, wallZ + 0.12);
      wallPicture(scene, CS.OX + T * 1.1, 2.2, wallZ, 'drumstick');
      wallPicture(scene, CS.OX + T * 1.9, 2.2, wallZ, 'tomato');
      wallPicture(scene, CS.OX + T * 2.7, 2.2, wallZ, 'lettuce');
      shelf(scene, CS.OX + T * 1.9, 1.4, wallZ, 2.4);
      panRail(scene, CS.OX + T * 11.6, 2.55, wallZ, 3);
      banner(scene, CS.OX + T * 5.2, 1.7, wallZ, 0.9);

      lantern(scene, CS.OX + T * 2.0, 2.45, CS.OZ + T * 2.2);
      lantern(scene, CS.OX + T * 12.0, 2.45, CS.OZ + T * 2.2);
      lantern(scene, CS.OX + T * 7.0, 2.45, CS.OZ + T * 6.6);
      lantern(scene, CS.OX + T * 3.2, 2.45, CS.OZ + T * 4.4);
      // clear of CS.DOOR_X: these used to hang straight down the sight line
      // between the queue and the front door
      lantern(scene, CS.OX + T * 2.6, 2.6, CS.OZ - 3.0);
      lantern(scene, CS.OX + T * 10.5, 2.6, CS.OZ - 3.0);

      // ---- dining room dressing, visible over the serving counter
      barrel(scene, CS.OX + 1.6, CS.OZ - 7.6, 1.0);
      barrel(scene, CS.OX + 2.9, CS.OZ - 8.2, 0.82);
      chest(scene, CS.OX + fw - 2.2, CS.OZ - 7.8, -0.25);
      barrel(scene, CS.OX + fw - 4.0, CS.OZ - 8.1, 0.9);
      shelf(scene, fx, 2.75, backZ + 0.42, 3.4);

      // ---- lighting: a warm key from the window side, a soft sky/bounce
      // fill, and pools of lantern light. The renderer tone-maps all of it.
      scene.add(new THREE.HemisphereLight(CS.linear(0xffe9cc), CS.linear(0x6a4e3a), 0.55));

      var sun = new THREE.DirectionalLight(CS.linear(0xffdcb0), 1.25);
      sun.position.set(-12, 22, 16);
      sun.castShadow = true;
      sun.shadow.mapSize.width = sun.shadow.mapSize.height = lowSpec ? 1024 : 2048;
      var d = 24;
      sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
      sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.03;
      scene.add(sun);
      scene.add(sun.target);
      sun.target.position.set(0, 0, 0);

      var warm = new THREE.PointLight(CS.linear(0xffb46a), 0.8, 16, 2);
      warm.position.set(CS.OX + T * 1.5, 3.0, CS.OZ + T * 3.5);
      scene.add(warm);

      var warm2 = new THREE.PointLight(CS.linear(0xffc27a), 0.7, 18, 2);
      warm2.position.set(CS.OX + T * 7, 3.4, CS.OZ + T * 6);
      scene.add(warm2);

      // one fewer light on phones; the dining room reads fine without it
      if (!lowSpec) {
        var warm3 = new THREE.PointLight(CS.linear(0xffb45c), 0.7, 18, 2);
        warm3.position.set(fx, 3.2, CS.OZ - 4);
        scene.add(warm3);
      }

      scene.fog = new THREE.Fog(CS.linear(0x3a3550), 55, 100);

      return { root: scene, stations: stations, solids: solids, floor: floor, heights: heights };
    },

    /* Throw the shop away and build it again from the current CS.MAP. Called
       between days, after the editor or a wing purchase has moved the walls.
       Geometry and materials are shared out of the caches in models.js, so
       what actually has to go is the flame list -- otherwise tick() keeps
       animating hearths that are no longer in the scene. */
    rebuild: function (parent, old, opts) {
      if (old && old.root) parent.remove(old.root);
      flames.length = 0;
      return CS.world.build(parent, opts);
    },

    /* Flicker the hearth. Called every frame from the main loop. */
    tick: function (t) {
      for (var i = 0; i < flames.length; i++) {
        var f = flames[i];
        var w = 0.78 + Math.sin(t * 7.3 + f.ph) * 0.14 + Math.sin(t * 13.1 + f.ph) * 0.08;
        if (f.light) { f.light.intensity = 0.8 + w * 0.5; continue; }
        f.m.scale.y = f.base * w;
        f.m.position.y = f.y0 + (f.base * w) / 2;
        f.m.scale.x = 0.42 * (0.9 + w * 0.12);
      }
    }
  };

  /* --------------------------------------------------------- particle pool
     Little bright beads for sparks, spatter and celebrations. */
  CS.fx = (function () {
    var pool = [], live = [], root = null;

    function get() {
      if (pool.length) return pool.pop();
      var m = CS.ball(1, 1, 1, CS.mat({ color: 0xffffff, basic: true }));
      m.castShadow = false; m.receiveShadow = false;
      root.add(m);
      return m;
    }

    return {
      init: function (scene) { root = new THREE.Group(); scene.add(root); CS.noMirror(root); },
      spawn: function (x, y, z, o) {
        if (!root) return;
        o = o || {};
        var m = get();
        m.visible = true;
        m.material = CS.mat({ color: o.color == null ? 0xffffff : o.color, basic: true });
        m.scale.setScalar((o.size || 0.1) * 0.55);
        m.position.set(x, y, z);
        m.layers.set(1);
        live.push({
          m: m, life: o.life || 0.7, t: 0,
          vx: (o.vx == null ? (Math.random() - 0.5) * 0.8 : o.vx),
          vy: (o.vy == null ? 1.2 + Math.random() : o.vy),
          vz: (o.vz == null ? (Math.random() - 0.5) * 0.8 : o.vz),
          g: o.g == null ? -1.4 : o.g
        });
      },
      burst: function (x, y, z, n, o) {
        for (var i = 0; i < n; i++) this.spawn(x, y, z, o);
      },
      update: function (dt) {
        for (var i = live.length - 1; i >= 0; i--) {
          var p = live[i];
          p.t += dt;
          if (p.t >= p.life) {
            p.m.visible = false; pool.push(p.m); live.splice(i, 1); continue;
          }
          p.vy += p.g * dt;
          p.m.position.x += p.vx * dt;
          p.m.position.y += p.vy * dt;
          p.m.position.z += p.vz * dt;
          var k = 1 - p.t / p.life;
          p.m.scale.setScalar((0.03 + k * 0.1) * 0.55);
        }
      },
      clear: function () {
        live.forEach(function (p) { p.m.visible = false; pool.push(p.m); });
        live.length = 0;
      }
    };
  })();

  /* ------------------------------------------------------------ steam
     Soft, camera-facing puffs that rise, swell, sway and fade: steam off a
     working pan and off anything fresh out of the oil, and smoke off a
     basket that has burnt. Each puff owns its own material so it can fade on
     its own; the pool is capped so a busy kitchen can never run away with it. */
  CS.steam = (function () {
    var pool = [], live = [], root = null, MAX = 140;

    function get() {
      if (pool.length) return pool.pop();
      var s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: CS.models.puffTexture(), transparent: true, depthWrite: false, opacity: 0
      }));
      s.layers.set(1);
      root.add(s);
      return s;
    }

    return {
      init: function (scene) { root = new THREE.Group(); scene.add(root); },

      /* o: color, size, grow, life, rise, opacity, drift */
      puff: function (x, y, z, o) {
        if (!root || live.length >= MAX) return;
        o = o || {};
        var s = get();
        s.visible = true;
        s.material.color.copy(CS.linear(o.color == null ? 0xffffff : o.color));
        var size = o.size || 0.32;
        s.scale.set(size, size, 1);
        s.position.set(x, y, z);
        live.push({
          s: s, t: 0, life: o.life || 1.6, size: size, grow: o.grow == null ? 2.2 : o.grow,
          rise: o.rise == null ? 0.9 : o.rise, alpha: o.opacity == null ? 0.55 : o.opacity,
          drift: o.drift == null ? 0.18 : o.drift, ph: Math.random() * 6.28,
          vx: (Math.random() - 0.5) * 0.12, vz: (Math.random() - 0.5) * 0.12
        });
      },

      update: function (dt) {
        for (var i = live.length - 1; i >= 0; i--) {
          var p = live[i];
          p.t += dt;
          if (p.t >= p.life) {
            p.s.visible = false; pool.push(p.s); live.splice(i, 1); continue;
          }
          var k = p.t / p.life;
          // ease up and out: fast at first, then lazily hanging in the air
          p.s.position.y += p.rise * (1 - k * 0.7) * dt;
          p.s.position.x += (p.vx + Math.sin(p.t * 2.6 + p.ph) * p.drift) * dt;
          p.s.position.z += p.vz * dt;
          var sz = p.size * (1 + p.grow * k);
          p.s.scale.set(sz, sz, 1);
          // fade in quickly, out slowly
          p.s.material.opacity = p.alpha * Math.min(1, k * 6) * (1 - k) * (1 - k * 0.3);
          p.s.material.rotation = p.ph + p.t * 0.4;
        }
      },

      clear: function () {
        live.forEach(function (p) { p.s.visible = false; pool.push(p.s); });
        live.length = 0;
      }
    };
  })();
})(window.CS);
