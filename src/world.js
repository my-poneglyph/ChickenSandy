/* Builds the kitchen: floor, walls, every station, decor and lighting.
   Also owns the little particle pool used for bubbles, steam and smoke. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var T = CS.TILE;

  function counterBase(g, h) {
    h = h || 0.88;
    g.add(CS.box(T * 0.94, h, T * 0.94, { color: 0xffffff, tex: 'counterWood' }, 0, h / 2, 0));
    g.add(CS.box(T * 0.99, 0.14, T * 0.99, { color: 0xffffff, tex: 'counterTop' }, 0, h + 0.07, 0));
    return h + 0.14;
  }

  var BUILD = {
    counter: function (g) {
      var y = counterBase(g);
      g.add(CS.box(T * 0.62, 0.05, T * 0.62, { color: 0xb07a3e }, 0, y + 0.02, 0)); // cutting board
      return y + 0.05;
    },

    crate: function (g, st) {
      var y = counterBase(g, 0.52);
      g.add(CS.box(T * 0.82, 0.62, T * 0.82, { color: 0xffffff, tex: 'crate' }, 0, y + 0.31, 0));
      var top = y + 0.62;
      if (st.def.gives === 'rawChicken') {
        for (var i = 0; i < 3; i++) {
          g.add(CS.box(0.40, 0.12, 0.34, { color: 0xe7a99e, tex: 'feathers' },
            (i - 1) * 0.36, top - 0.02 + i * 0.03, (i % 2) * 0.22 - 0.11));
        }
      } else {
        for (var j = 0; j < 5; j++) {
          var a = j * 1.3;
          g.add(CS.box(0.28, 0.20, 0.24, { color: 0xc09a5e },
            Math.cos(a) * 0.42, top - 0.04, Math.sin(a) * 0.42));
        }
      }
      st.topY = top;
      return top;
    },

    plates: function (g, st) {
      var y = counterBase(g);
      for (var i = 0; i < 6; i++) {
        var d = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.05, 12),
          CS.mat({ color: 0xf2efe6, tex: 'plate' }));
        d.position.y = y + 0.03 + i * 0.055;
        d.castShadow = true; g.add(d);
      }
      st.topY = y + 0.36;
      return st.topY;
    },

    buns: function (g, st) {
      var y = counterBase(g, 0.52);
      g.add(CS.box(T * 0.82, 0.5, T * 0.82, { color: 0xffffff, tex: 'crate' }, 0, y + 0.25, 0));
      var top = y + 0.5;
      [[-0.34, -0.3], [0.32, -0.28], [-0.3, 0.32], [0.3, 0.3], [0, 0.02]].forEach(function (p, i) {
        g.add(CS.box(0.44, 0.22, 0.44, { color: 0xd9a458, tex: 'bun' }, p[0], top + 0.11 + (i === 4 ? 0.2 : 0), p[1]));
      });
      st.topY = top + 0.24;
      return st.topY;
    },

    topping: function (g, st) {
      var y = counterBase(g, 0.62);
      var c = CS.ING[st.def.ing].color;
      // open wooden box, exactly like the ingredient trays in the reference
      g.add(CS.box(T * 0.86, 0.40, T * 0.86, { color: 0xffffff, tex: 'crate' }, 0, y + 0.20, 0));
      g.add(CS.box(T * 0.70, 0.08, T * 0.70, { color: 0x503018 }, 0, y + 0.38, 0));
      var top = y + 0.40;
      if (st.def.ing === 'lettuce') {
        for (var i = 0; i < 5; i++) {
          var lf = CS.box(0.44, 0.10, 0.36, { color: i % 2 ? c : CS.shade(c, 26) },
            (i % 3 - 1) * 0.38, top + 0.05 + (i > 2 ? 0.08 : 0), (i < 2 ? 0.3 : -0.25));
          lf.rotation.y = i * 0.7; g.add(lf);
        }
      } else if (st.def.ing === 'tomato') {
        for (var j = 0; j < 6; j++) {
          g.add(CS.box(0.34, 0.07, 0.34, { color: j % 2 ? c : CS.shade(c, 20) },
            (j % 3 - 1) * 0.42, top + 0.035 + Math.floor(j / 3) * 0.075, j < 3 ? 0.26 : -0.26));
        }
      } else {
        for (var k = 0; k < 7; k++) {
          var a = k * 0.9;
          g.add(CS.box(0.24, 0.06, 0.24, { color: k % 2 ? c : CS.shade(c, -22) },
            Math.cos(a) * 0.38, top + 0.03 + (k % 3) * 0.06, Math.sin(a) * 0.38));
        }
      }
      st.topY = top + 0.2;
      return st.topY;
    },

    sauce: function (g, st) {
      var y = counterBase(g, 0.80);
      var c = CS.ING[st.def.ing].color;
      g.add(CS.box(0.40, 0.46, 0.34, { color: c }, 0, y + 0.23, 0));            // bottle body
      g.add(CS.box(0.44, 0.08, 0.38, { color: CS.shade(c, -34) }, 0, y + 0.30, 0)); // label band
      g.add(CS.box(0.18, 0.14, 0.16, { color: CS.shade(c, 30) }, 0, y + 0.53, 0));  // neck
      g.add(CS.box(0.24, 0.10, 0.22, { color: 0x2e2a26 }, 0, y + 0.64, 0));         // cap
      st.topY = y + 0.7;
      return st.topY;
    },

    cups: function (g, st) {
      var y = counterBase(g);
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.78, 8),
        CS.mat({ color: 0x9aa0a8, tex: 'metal', opacity: 0.85 }));
      tube.position.y = y + 0.39; g.add(tube);
      for (var i = 0; i < 4; i++) {
        var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.14, 8),
          CS.mat({ color: 0xf6f3ea, tex: 'plate' }));
        cup.position.y = y + 0.12 + i * 0.15; g.add(cup);
      }
      st.topY = y + 0.8;
      return st.topY;
    },

    /* A black skillet sitting over glowing coals — the centrepiece of the
       reference picture, rather than a commercial deep-fryer basket. */
    fryer: function (outer, st) {
      // Stand the stove proud of the wall line so the pan stays readable even
      // when the camera is looking along the wall.
      var g = new THREE.Group();
      g.position.z = 0.26;
      outer.add(g);

      // stone-and-iron stove block
      g.add(CS.box(T * 0.94, 0.62, T * 0.94, { color: 0xffffff, tex: 'stone' }, 0, 0.31, 0));
      g.add(CS.box(T * 0.98, 0.10, T * 0.98, { color: 0x3a3d42, tex: 'darkMetal' }, 0, 0.67, 0));
      // burning coals in the mouth of the stove
      g.add(CS.box(T * 0.60, 0.26, 0.06, CS.mat({ color: 0x1a120b, basic: true }), 0, 0.34, T * 0.48));
      st.coals = CS.box(T * 0.52, 0.16, 0.05, CS.mat({ color: 0xff7a14, basic: true }), 0, 0.32, T * 0.49);
      st.coals.material = st.coals.material.clone();
      g.add(st.coals);

      // the pan
      g.add(CS.box(T * 0.88, 0.20, T * 0.88, { color: 0x26282c, tex: 'darkMetal' }, 0, 0.82, 0));
      var r = T * 0.86, w = 0.11;
      [[0, (r / 2)], [0, -(r / 2)]].forEach(function (p) {
        g.add(CS.box(r + w, 0.20, w, { color: 0x34373c, tex: 'darkMetal' }, p[0], 0.98, p[1]));
      });
      [[(r / 2), 0], [-(r / 2), 0]].forEach(function (p) {
        g.add(CS.box(w, 0.20, r + w, { color: 0x34373c, tex: 'darkMetal' }, p[0], 0.98, p[1]));
      });
      // shimmering oil
      g.add(CS.box(T * 0.68, 0.09, T * 0.68, { color: 0xffffff, tex: 'oil', emissive: 0x6a3505 }, 0, 0.94, 0));
      // pan handle with a wooden grip, poking out into the aisle
      g.add(CS.box(0.15, 0.10, 0.80, { color: 0x2a2c30 }, 0, 0.92, T * 0.72));
      g.add(CS.box(0.21, 0.15, 0.30, { color: 0x7a4f26, tex: 'counterWood' }, 0, 0.92, T * 0.98));

      // warm glow that pulses while something is in the oil
      st.glow = CS.box(T * 0.66, 0.02, T * 0.66, CS.mat({ color: 0xff9a2e, basic: true, opacity: 0.0 }), 0, 1.0, 0);
      st.glow.material = st.glow.material.clone();
      st.glow.material.transparent = true;
      g.add(st.glow);
      st.topY = 1.0;
      return 1.0;
    },

    serve: function (g, st) {
      var y = counterBase(g, 0.78);
      // window frame posts, kept thin so they never hide the kitchen
      g.add(CS.box(0.16, 1.5, 0.16, { color: 0xffffff, tex: 'counterWood' }, -T * 0.45, y + 0.75, -T * 0.3));
      g.add(CS.box(0.16, 1.5, 0.16, { color: 0xffffff, tex: 'counterWood' }, T * 0.45, y + 0.75, -T * 0.3));
      g.add(CS.box(T, 0.22, 0.24, { color: 0xffffff, tex: 'counterWood' }, 0, y + 1.6, -T * 0.3));
      st.topY = y;
      return y;
    },

    trash: function (g, st) {
      g.add(CS.box(T * 0.80, 0.90, T * 0.80, { color: 0xffffff, tex: 'darkMetal' }, 0, 0.45, 0));
      g.add(CS.box(T * 0.88, 0.10, T * 0.88, { color: 0x4a4038 }, 0, 0.95, 0));
      g.add(CS.box(T * 0.50, 0.06, T * 0.50, { color: 0x1a1613 }, 0, 1.01, 0));
      g.add(CS.box(0.30, 0.10, 0.10, { color: 0x6a5f55 }, 0, 1.06, -T * 0.3));
      st.topY = 1.02;
      return 1.02;
    }
  };

  var LABELS = {
    F: 'Fryer', S: 'Serve', X: 'Trash', K: 'Chicken', T: 'Potatoes',
    P: 'Plates', B: 'Buns', L: 'Lettuce', O: 'Tomato', I: 'Pickles',
    M: 'Mayo', Q: 'BBQ', H: 'Hot Sauce', Y: 'Ketchup', U: 'Cups'
  };
  var LABEL_ACCENT = {
    F: '#c0392b', S: '#6fbf3a', X: '#4a4038', L: '#6fbf3a', O: '#d6402f',
    I: '#93ad36', M: '#e0cfa6', Q: '#7d3417', H: '#e0431f', Y: '#c01f14'
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

    var m = CS.models.label(LABELS[ch], LABEL_ACCENT[ch]);
    var ox = (runW - 1) * T / 2, oz = (runH - 1) * T / 2;
    if (st.row === 0) oz += T * 0.42;
    else if (st.row === CS.MAP_H - 1) oz -= T * 0.42;
    if (st.col === 0) ox += T * 0.42;
    else if (st.col === CS.MAP_W - 1) ox -= T * 0.42;

    m.position.set(st.x + ox, st.topY + 0.8, st.z + oz);
    m.rotation.x = -(Math.PI / 2 - CS.CAM_PITCH);
    scene.add(m);
  }

  function lantern(scene, x, y, z) {
    var g = new THREE.Group();
    g.add(CS.box(0.08, 0.7, 0.08, { color: 0x2e2a26 }, 0, 0.62, 0));
    g.add(CS.box(0.30, 0.10, 0.30, { color: 0x4a3a28 }, 0, 0.28, 0));
    g.add(CS.box(0.34, 0.34, 0.34, CS.mat({ color: 0xff9a22, basic: true }), 0, 0, 0));
    // dark iron frame around the glow so it reads as a lantern, not a blob
    [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(function (p) {
      g.add(CS.box(0.07, 0.38, 0.07, { color: 0x2e2a26 }, p[0], 0, p[1]));
    });
    g.add(CS.box(0.40, 0.09, 0.40, { color: 0x4a3a28 }, 0, 0.21, 0));
    g.add(CS.box(0.42, 0.09, 0.42, { color: 0x4a3a28 }, 0, -0.21, 0));
    g.position.set(x, y, z);
    scene.add(g);
    return g;
  }

  var flames = [];

  /* Stone hearth with a live fire, like the one behind the chef. */
  function fireplace(scene, x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(CS.box(3.0, 2.7, 0.42, { color: 0xffffff, tex: 'stone' }, 0, 1.35, 0));
    g.add(CS.box(3.3, 0.24, 0.62, { color: 0x6a6660, tex: 'stone' }, 0, 2.74, 0.06));
    g.add(CS.box(1.9, 1.5, 0.26, { color: 0x140f0b }, 0, 0.80, 0.16));      // firebox
    g.add(CS.box(2.1, 0.20, 0.48, { color: 0x5e5b57, tex: 'stone' }, 0, 1.62, 0.12));
    // logs
    g.add(CS.box(1.3, 0.20, 0.22, { color: 0x5a3a1e }, 0, 0.22, 0.32));
    g.add(CS.box(1.0, 0.18, 0.20, { color: 0x6b4526 }, 0.06, 0.40, 0.30));
    // flames (animated in tick)
    [[-0.45, 0.55, 0xff8a1e], [0.0, 0.75, 0xffb43c], [0.42, 0.55, 0xff6a14]].forEach(function (f) {
      var m = CS.box(0.42, f[1], 0.24, CS.mat({ color: f[2], basic: true }), f[0], 0.30 + f[1] / 2, 0.30);
      m.castShadow = false;
      g.add(m);
      flames.push({ m: m, base: f[1], y0: 0.30, ph: Math.random() * 6.28 });
    });
    var light = new THREE.PointLight(0xff8a2e, 0.85, 12, 2);
    light.position.set(x, 1.1, z + 1.2);
    scene.add(light);
    flames.push({ light: light, ph: Math.random() * 6.28 });
    scene.add(g);
  }

  /* Window onto a bright blocky outdoors. */
  function kitchenWindow(scene, x, y, z, w, h) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    var pane = CS.models.skyPane(w - 0.3);
    pane.position.z = 0.06;
    g.add(pane);
    var fw = 0.18;
    g.add(CS.box(w, fw, 0.16, { color: 0x6b4526, tex: 'counterWood' }, 0, h / 2, 0.02));
    g.add(CS.box(w, fw, 0.16, { color: 0x6b4526, tex: 'counterWood' }, 0, -h / 2, 0.02));
    g.add(CS.box(fw, h, 0.16, { color: 0x6b4526, tex: 'counterWood' }, -w / 2, 0, 0.02));
    g.add(CS.box(fw, h, 0.16, { color: 0x6b4526, tex: 'counterWood' }, w / 2, 0, 0.02));
    g.add(CS.box(0.12, h, 0.12, { color: 0x7a4f26 }, 0, 0, 0.05));          // mullion
    g.add(CS.box(w, 0.22, 0.34, { color: 0x8a5a2b, tex: 'counterWood' }, 0, -h / 2 - 0.12, 0.10));
    scene.add(g);
  }

  function wallPicture(scene, x, y, z, kind) {
    var f = CS.models.foodFrame(kind, 0.86);
    f.position.set(x, y, z + 0.05);
    scene.add(f);
  }

  /* Barrel of the kind stacked around the shop in the reference. */
  function barrel(scene, x, z, s) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    s = s || 1;
    g.scale.setScalar(s);
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.42, 1.05, 10),
      CS.mat({ color: 0xffffff, tex: 'counterWood' }));
    body.position.y = 0.52; body.castShadow = true; g.add(body);
    [0.22, 0.82].forEach(function (yy) {
      var b = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.11, 10),
        CS.mat({ color: 0x4a3524 }));
      b.position.y = yy; g.add(b);
    });
    g.add(CS.box(0.86, 0.08, 0.86, { color: 0x6b4526 }, 0, 1.06, 0));
    scene.add(g);
  }

  function chest(scene, x, z, rot) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot || 0;
    g.add(CS.box(1.25, 0.62, 0.85, { color: 0xffffff, tex: 'crate' }, 0, 0.31, 0));
    g.add(CS.box(1.28, 0.34, 0.88, { color: 0x8a5a2b, tex: 'counterWood' }, 0, 0.78, 0));
    g.add(CS.box(0.20, 0.26, 0.10, { color: 0xc9a04a }, 0, 0.62, 0.46));    // latch
    scene.add(g);
  }

  /* Plank shelf with a row of jars — the busy background of the reference. */
  function shelf(scene, x, y, z, w) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    g.add(CS.box(w, 0.14, 0.42, { color: 0xffffff, tex: 'counterWood' }, 0, 0, 0.16));
    var cols = [0xd6402f, 0x6fbf3a, 0xe0a13a, 0xf3e6d0, 0x7d3417];
    var n = Math.floor(w / 0.52);
    for (var i = 0; i < n; i++) {
      var jx = -w / 2 + 0.32 + i * 0.52;
      g.add(CS.box(0.30, 0.34, 0.26, { color: cols[i % cols.length] }, jx, 0.24, 0.16));
      g.add(CS.box(0.22, 0.07, 0.20, { color: 0x4a3524 }, jx, 0.44, 0.16));
    }
    scene.add(g);
  }

  CS.world = {
    build: function (scene, opts) {
      opts = opts || {};
      var lowSpec = !!opts.lowSpec;
      var stations = [];
      var solids = [];
      // Collision heights per tile. Walls are effectively infinite so the chef
      // can never flutter out of the shop; stations use their real top surface
      // so a well-timed hop can put you on the counter.
      var heights = [];
      for (var hr = 0; hr < CS.MAP_H; hr++) {
        heights.push([]);
        for (var hc = 0; hc < CS.MAP_W; hc++) heights[hr].push(0);
      }

      // ---- kitchen floor
      var fw = CS.MAP_W * T, fh = CS.MAP_H * T;
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh),
        CS.mat({ color: 0xffffff, tex: 'floor' }));
      floor.material = floor.material.clone();
      floor.material.map = CS.texRepeat('floor', CS.MAP_W / 2, CS.MAP_H / 2);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(CS.OX + fw / 2, 0, CS.OZ + fh / 2);
      floor.receiveShadow = true;
      scene.add(floor);

      // ---- dining floor beyond the serving window
      var dine = new THREE.Mesh(new THREE.PlaneGeometry(fw + 10, 10),
        CS.mat({ color: 0xffffff, tex: 'diningFloor' }));
      dine.material = dine.material.clone();
      dine.material.map = CS.texRepeat('diningFloor', (fw + 10) / 4, 10 / 4);
      dine.rotation.x = -Math.PI / 2;
      dine.position.set(CS.OX + fw / 2, -0.02, CS.OZ - 5);
      dine.receiveShadow = true;
      scene.add(dine);

      // ---- tiles
      for (var row = 0; row < CS.MAP_H; row++) {
        for (var col = 0; col < CS.MAP_W; col++) {
          var ch = CS.MAP[row][col];
          if (ch === '.') continue;
          var p = CS.tileToWorld(col, row);
          solids.push({ col: col, row: row, x: p.x, z: p.z });

          if (ch === '#') {
            heights[row][col] = 99;
            var south = (row === CS.MAP_H - 1);
            var h = south ? CS.LOW_WALL_H : CS.WALL_H;
            var w = CS.box(T, h, T, { color: 0xffffff, tex: 'wall' }, p.x, h / 2, p.z);
            w.receiveShadow = true;
            scene.add(w);
            if (!south && row === 0) {
              // a chunkier cornice on the far wall to frame the scene
              scene.add(CS.box(T, 0.22, T * 0.4, { color: 0x5a381c }, p.x, h + 0.11, p.z + T * 0.3));
            }
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
          if (row === 0) g.rotation.y = Math.PI;
          else if (col === 0) g.rotation.y = Math.PI / 2;
          else if (col === CS.MAP_W - 1) g.rotation.y = -Math.PI / 2;

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

      // ---- dining room back wall, so the queue is not standing in a void
      var backZ = CS.OZ - 9.5;
      var bw = CS.box(fw + 10, 3.6, 0.6, { color: 0xffffff, tex: 'wall' },
        CS.OX + fw / 2, 1.8, backZ);
      bw.receiveShadow = true;
      scene.add(bw);
      scene.add(CS.box(fw + 10, 0.3, 0.9, { color: 0x5a381c }, CS.OX + fw / 2, 3.7, backZ));

      var s1 = CS.models.signBoard(['Good Food', 'Happy', 'Chicken'], 4.4);
      s1.position.set(CS.OX + fw * 0.26, 2.0, backZ + 0.35);
      scene.add(s1);
      var s2 = CS.models.signBoard(['Chicken', 'Sandwich', '= Happiness'], 4.4);
      s2.position.set(CS.OX + fw * 0.74, 2.0, backZ + 0.35);
      scene.add(s2);

      // ---- decor on the north wall (the face the camera always sees)
      // Row 0 spans z = [OZ, OZ+T], so the face the camera sees is at OZ+T.
      var wallZ = CS.OZ + T + 0.02;

      kitchenWindow(scene, CS.OX + T * 7.0, 1.80, wallZ, 3.8, 2.1);
      fireplace(scene, CS.OX + T * 9.0, wallZ + 0.12);
      wallPicture(scene, CS.OX + T * 1.1, 2.15, wallZ, 'drumstick');
      wallPicture(scene, CS.OX + T * 1.9, 2.15, wallZ, 'tomato');
      wallPicture(scene, CS.OX + T * 2.7, 2.15, wallZ, 'lettuce');
      shelf(scene, CS.OX + T * 1.9, 1.35, wallZ, 2.4);

      lantern(scene, CS.OX + T * 2.0, 2.45, CS.OZ + T * 2.2);
      lantern(scene, CS.OX + T * 12.0, 2.45, CS.OZ + T * 2.2);
      lantern(scene, CS.OX + T * 7.0, 2.45, CS.OZ + T * 6.6);
      lantern(scene, CS.OX + T * 3.2, 2.45, CS.OZ + T * 4.4);
      lantern(scene, CS.OX + T * 4.5, 2.6, CS.OZ - 3.0);
      lantern(scene, CS.OX + T * 10.5, 2.6, CS.OZ - 3.0);

      // ---- dining room dressing, visible over the serving counter
      barrel(scene, CS.OX + 1.6, CS.OZ - 7.6, 1.0);
      barrel(scene, CS.OX + 2.9, CS.OZ - 8.2, 0.82);
      chest(scene, CS.OX + fw - 2.2, CS.OZ - 7.8, -0.25);
      barrel(scene, CS.OX + fw - 4.0, CS.OZ - 8.1, 0.9);
      shelf(scene, CS.OX + fw * 0.5, 2.55, backZ + 0.32, 3.4);

      // ---- lighting
      scene.add(new THREE.AmbientLight(0xffdcae, 0.50));
      scene.add(new THREE.HemisphereLight(0xffe0bc, 0x5a3418, 0.44));

      var sun = new THREE.DirectionalLight(0xfff0d0, 0.90);
      sun.position.set(-12, 22, 16);
      sun.castShadow = true;
      sun.shadow.mapSize.width = sun.shadow.mapSize.height = lowSpec ? 1024 : 2048;
      var d = 24;
      sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
      sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
      sun.shadow.bias = -0.0012;
      scene.add(sun);
      scene.add(sun.target);
      sun.target.position.set(0, 0, 0);

      var warm = new THREE.PointLight(0xff9a3c, 0.70, 16, 2);
      warm.position.set(CS.OX + T * 1.5, 3.0, CS.OZ + T * 3.5);
      scene.add(warm);

      var warm2 = new THREE.PointLight(0xffc46a, 0.55, 18, 2);
      warm2.position.set(CS.OX + T * 7, 3.4, CS.OZ + T * 6);
      scene.add(warm2);

      // one fewer light on phones; the dining room reads fine without it
      if (!lowSpec) {
        var warm3 = new THREE.PointLight(0xffb45c, 0.48, 18, 2);
        warm3.position.set(CS.OX + fw / 2, 3.2, CS.OZ - 4);
        scene.add(warm3);
      }

      scene.fog = new THREE.Fog(0x3a2413, 46, 86);

      return { stations: stations, solids: solids, floor: floor, heights: heights };
    },

    /* Flicker the hearth. Called every frame from the main loop. */
    tick: function (t) {
      for (var i = 0; i < flames.length; i++) {
        var f = flames[i];
        var w = 0.78 + Math.sin(t * 7.3 + f.ph) * 0.14 + Math.sin(t * 13.1 + f.ph) * 0.08;
        if (f.light) { f.light.intensity = 0.85 + w * 0.5; continue; }
        f.m.scale.y = f.base * w;
        f.m.position.y = f.y0 + (f.base * w) / 2;
        f.m.scale.x = 0.42 * (0.9 + w * 0.12);
      }
    }
  };

  /* --------------------------------------------------------- particle pool */
  CS.fx = (function () {
    var pool = [], live = [], root = null;

    function get() {
      if (pool.length) return pool.pop();
      var m = CS.box(0.1, 0.1, 0.1, CS.mat({ color: 0xffffff, basic: true }));
      m.castShadow = false; m.receiveShadow = false;
      root.add(m);
      return m;
    }

    return {
      init: function (scene) { root = new THREE.Group(); scene.add(root); },
      spawn: function (x, y, z, o) {
        if (!root) return;
        o = o || {};
        var m = get();
        m.visible = true;
        m.material = CS.mat({ color: o.color == null ? 0xffffff : o.color, basic: true });
        var s = o.size || 0.1;
        m.scale.set(s, s, s);
        m.position.set(x, y, z);
        live.push({
          m: m, life: o.life || 0.7, t: 0,
          vx: (o.vx == null ? (Math.random() - 0.5) * 0.8 : o.vx),
          vy: (o.vy == null ? 1.2 + Math.random() : o.vy),
          vz: (o.vz == null ? (Math.random() - 0.5) * 0.8 : o.vz),
          g: o.g == null ? -1.4 : o.g,
          spin: (Math.random() - 0.5) * 6
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
          p.m.rotation.y += p.spin * dt;
          var k = 1 - p.t / p.life;
          p.m.scale.setScalar(Math.max(0.01, p.m.scale.x * 0.995) * 1 + 0.0);
          p.m.scale.setScalar(0.03 + k * 0.1);
        }
      },
      clear: function () {
        live.forEach(function (p) { p.m.visible = false; pool.push(p.m); });
        live.length = 0;
      }
    };
  })();
})(window.CS);

