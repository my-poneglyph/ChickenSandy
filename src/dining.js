/* The dining room: everything you buy for the front of house.

   The kitchen stays compact -- every step there costs time -- so the shop
   grows out here instead. Decor raises the room's happiness (CS.econ
   .happiness), which makes every customer wait longer and tip more; this
   module draws all of it and runs the two things in it that move:

     * the slushie server, who walks a free slushie out to whoever in the
       queue is closest to giving up -- more patience and a bigger tip for
       that order -- and walks back to the bar for the next one;
     * the seats. A happy customer whose order went out sits down at a free
       table to eat before heading home (orders.js asks claimSeat()).

   world.js calls build() every time it rebuilds the shop, inside the
   shop's own root group, so it is torn down and put back with everything
   else. Things are laid out round the door: whatever lane the queue walks
   down (it follows the serving window) is always kept clear.             */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var T = CS.TILE;
  var BACK_Z = CS.OZ - 9.5;            // the dining room's back wall (orders.js agrees)
  var ROW_BACK = CS.OZ - 8.2;          // against the back wall
  var ROW_A = CS.OZ - 5.5;             // the far row of tables
  var ROW_B = CS.OZ - 2.5;             // the near row, just over the kitchen wall
  var AISLE = CS.OZ - 4.0;             // the walkway between the two rows
  var BASE_X1 = CS.OX + 38;            // east end of the room before the Grand Hall
  var HALL_X1 = CS.OX + 44;            // ...and after (the path outside is just past it)

  function has(id) { return CS.econ && CS.econ.has(id); }

  var D = CS.dining = {
    seats: [],
    dynamic: [],          // meshes world.js must not merge (they move)
    server: null,

    extent: function () {
      return { x0: CS.OX - 5, x1: has('hall') ? HALL_X1 : BASE_X1, back: BACK_Z };
    },

    /* The queue's lane and the lane served customers leave by. */
    lane: function () { return [CS.DOOR_X - 2.4, CS.DOOR_X + 2.3 + 1.5]; },

    /* A free seat east of the exit lane, so the walk to it never cuts
       across the people still queueing. */
    claimSeat: function () {
      var free = D.seats.filter(function (s) { return !s.busy && s.x > CS.DOOR_X + 3.4; });
      if (!free.length) return null;
      var s = CS.pick(free);
      s.busy = true;
      return s;
    },
    releaseAll: function () { D.seats.forEach(function (s) { s.busy = false; }); },

    build: function (scene, opts) { build(scene, opts || {}); },
    update: function (dt, playing) { update(dt, playing); }
  };

  /* ------------------------------------------------------------ layout
     A row is a list of taken [x0, x1] spans; place() finds the nearest
     clear spot to where an item would like to stand. */
  function Row(ext) {
    this.x0 = ext.x0 + 0.4; this.x1 = ext.x1 - 0.4;
    this.taken = [D.lane()];
  }
  Row.prototype.place = function (pref, w) {
    for (var step = 0; step < 120; step++) {
      var off = (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 0.5;
      var x = pref + off;
      if (x - w / 2 < this.x0 || x + w / 2 > this.x1) continue;
      var clash = this.taken.some(function (t) { return x + w / 2 > t[0] && x - w / 2 < t[1]; });
      if (clash) continue;
      this.taken.push([x - w / 2, x + w / 2]);
      return x;
    }
    return null;
  };

  /* --------------------------------------------------------- materials */
  var OAK = { color: 0xffffff, tex: 'counterWood', rough: 0.7 };
  var OAK_D = { color: 0x7c5434, rough: 0.75 };
  // no environment map to reflect, so a fully metallic gold reads as bronze:
  // keep it half metal with a warm glow of its own
  var GOLD = { color: 0xf2c14e, rough: 0.3, metal: 0.45, emissive: 0x4a3000 };
  var MARBLE = { color: 0xf2eee6, rough: 0.3 };
  var BRASS = { color: 0xd6a648, rough: 0.3, metal: 0.85 };
  function put(p, m) { p.add(m); return m; }

  /* ------------------------------------------------------------- pieces */
  function table(scene, x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(CS.box(1.5, 0.08, 1.1, OAK, 0, 0.78, 0));
    [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]].forEach(function (p) {
      g.add(CS.box(0.08, 0.76, 0.08, OAK_D, p[0], 0.38, p[1]));
    });
    if (has('cloths')) {
      var CLOTH = { color: 0xffffff, tex: CS.isThanksgiving ? 'carpet' : 'counterTop', rough: 0.8 };
      g.add(CS.box(1.66, 0.03, 1.26, CLOTH, 0, 0.835, 0));
      g.add(CS.box(1.66, 0.22, 0.02, CLOTH, 0, 0.73, 0.63));
      g.add(CS.box(1.66, 0.22, 0.02, CLOTH, 0, 0.73, -0.63));
    }
    // a candle, and a little vase of flowers
    g.add(CS.cyl(0.05, 0.05, 0.18, { color: 0xfbf4e2, rough: 0.6 }, 0.3, 0.94, 0, 10));
    g.add(CS.ball(0.035, 0.05, 0.035, CS.mat({ color: 0xffc46a, basic: true }), 0.3, 1.07, 0));
    g.add(CS.cyl(0.07, 0.05, 0.16, { color: 0x3a5aa6, rough: 0.3 }, -0.25, 0.92, 0.05, 10));
    g.add(CS.ball(0.06, 0.06, 0.06, { color: 0xe8546a, rough: 0.6 }, -0.25, 1.04, 0.05));
    [-1, 1].forEach(function (s) {
      chair(g, s * 1.0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      D.seats.push({ x: x + s * 1.0, z: z, face: s > 0 ? -Math.PI / 2 : Math.PI / 2, busy: false });
    });
    scene.add(g);
  }

  function chair(g, x, z, rot) {
    var c = new THREE.Group();
    c.position.set(x, 0, z);
    c.rotation.y = rot;
    c.add(CS.box(0.5, 0.06, 0.5, OAK, 0, 0.46, 0));
    [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(function (p) {
      c.add(CS.box(0.06, 0.46, 0.06, OAK_D, p[0], 0.23, p[1]));
    });
    c.add(CS.box(0.5, 0.55, 0.06, OAK, 0, 0.76, -0.23));       // back
    if (has('chairs')) {
      c.add(CS.box(0.46, 0.07, 0.46, { color: 0x2f4f96, rough: 0.9 }, 0, 0.52, 0));
      c.add(CS.box(0.44, 0.4, 0.05, { color: 0x2f4f96, rough: 0.9 }, 0, 0.78, -0.2));
    }
    g.add(c);
  }

  function plant(scene, x, z, kind) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(CS.cyl(0.3, 0.22, 0.5, { color: kind ? 0x3a5aa6 : 0xc06a3a, rough: 0.4 }, 0, 0.25, 0, 16));
    g.add(CS.cyl(0.31, 0.31, 0.06, { color: 0xf4ead6, rough: 0.4 }, 0, 0.5, 0, 16));
    if (kind) {
      // a little lemon tree
      g.add(CS.cyl(0.04, 0.05, 0.7, OAK_D, 0, 0.85, 0, 8));
      g.add(CS.ball(0.42, 0.4, 0.42, { color: 0x4f8a34, rough: 0.7 }, 0, 1.35, 0));
      [[0.25, 1.3, 0.25], [-0.3, 1.45, 0.1], [0.05, 1.2, -0.35], [0.2, 1.6, -0.1]].forEach(function (p) {
        g.add(CS.ball(0.07, 0.08, 0.07, { color: 0xf2d43a, rough: 0.4 }, p[0], p[1], p[2]));
      });
    } else {
      // a fern
      for (var i = 0; i < 9; i++) {
        var a = i / 9 * Math.PI * 2;
        var f = put(g, CS.ball(0.09, 0.42, 0.05, { color: i % 2 ? 0x4f9a3a : 0x3f7e2e, rough: 0.7 },
          Math.cos(a) * 0.18, 0.85, Math.sin(a) * 0.18));
        f.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
      }
    }
    scene.add(g);
  }

  /* The Golden Chocobo: a big round golden bird with a crest and tail
     plumes, on a marble plinth. */
  function statue(scene, x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(CS.box(1.3, 0.7, 1.0, MARBLE, 0, 0.35, 0));
    g.add(CS.box(1.45, 0.1, 1.15, MARBLE, 0, 0.73, 0));
    g.add(CS.box(0.7, 0.12, 0.04, GOLD, 0, 0.42, 0.51));                 // nameplate
    var b = new THREE.Group();
    b.position.set(0, 0.78, 0);
    b.add(CS.cyl(0.06, 0.07, 0.4, GOLD, -0.16, 0.2, 0, 8));
    b.add(CS.cyl(0.06, 0.07, 0.4, GOLD, 0.16, 0.2, 0, 8));
    b.add(CS.ball(0.42, 0.38, 0.5, GOLD, 0, 0.72, -0.04));               // body
    put(b, CS.cyl(0.13, 0.17, 0.5, GOLD, 0, 1.15, 0.22, 12)).rotation.x = -0.3;   // neck
    b.add(CS.ball(0.24, 0.22, 0.26, GOLD, 0, 1.45, 0.3));                // head
    put(b, CS.cone(0.08, 0.28, GOLD, 0, 1.42, 0.62, 10)).rotation.x = Math.PI / 2;  // beak
    [-0.1, 0, 0.1].forEach(function (cx, i) {                            // crest
      put(b, CS.cone(0.05, 0.3, GOLD, cx, 1.68, 0.2 - i * 0.04, 6)).rotation.x = -0.5;
    });
    [-0.22, 0, 0.22].forEach(function (tx) {                             // tail plumes
      put(b, CS.cone(0.08, 0.55, GOLD, tx, 0.95, -0.55, 6)).rotation.x = -1.0;
    });
    [-1, 1].forEach(function (s) {                                       // folded wings
      put(b, CS.ball(0.12, 0.26, 0.36, GOLD, s * 0.38, 0.75, -0.05)).rotation.z = s * 0.25;
    });
    g.add(b);
    var shine = new THREE.PointLight(CS.linear(0xffd77a), 0.5, 4, 2);
    shine.position.set(x, 2.4, z + 0.8);
    scene.add(shine);
    scene.add(g);
  }

  /* Every castle boss you have fed, on its own little stand. */
  var TROPHY_LOOK = {
    'trophy-ogre': function (g) {                                        // the Gatehouse Key
      put(g, CS.torus(0.12, 0.035, 0, GOLD, 0, 0.5, 0));
      g.add(CS.box(0.05, 0.36, 0.05, GOLD, 0, 0.26, 0));
      g.add(CS.box(0.12, 0.05, 0.05, GOLD, 0.06, 0.12, 0));
    },
    'trophy-dragon': function (g) {                                     // an Ember Scale
      put(g, CS.cone(0.16, 0.4, { color: 0xc23a22, rough: 0.2, metal: 0.4, emissive: 0x401000 }, 0, 0.32, 0, 6))
        .rotation.z = Math.PI;
    },
    'trophy-lich': function (g) {                                       // the Hourglass
      g.add(CS.cyl(0.14, 0.14, 0.04, BRASS, 0, 0.12, 0, 12));
      g.add(CS.cyl(0.14, 0.14, 0.04, BRASS, 0, 0.56, 0, 12));
      g.add(CS.cone(0.11, 0.2, { color: 0x9fe8f0, opacity: 0.6, rough: 0.05 }, 0, 0.44, 0, 12));
      put(g, CS.cone(0.11, 0.2, { color: 0x9fe8f0, opacity: 0.6, rough: 0.05 }, 0, 0.24, 0, 12)).rotation.z = Math.PI;
    },
    'trophy-colossus': function (g) {                                   // the Clockwork Heart
      put(g, CS.torus(0.15, 0.05, 0, BRASS, 0, 0.36, 0));
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2;
        g.add(CS.box(0.06, 0.06, 0.06, BRASS, Math.cos(a) * 0.21, 0.36 + Math.sin(a) * 0.21, 0));
      }
      g.add(CS.ball(0.08, 0.08, 0.08, { color: 0xc8302e, rough: 0.3 }, 0, 0.36, 0));
    },
    'trophy-rooster': function (g) {                                    // the Golden Comb
      [-0.1, 0, 0.1].forEach(function (cx, i) {
        g.add(CS.ball(0.07, 0.15 + (i === 1 ? 0.05 : 0), 0.04, GOLD, cx, 0.32, 0));
      });
      g.add(CS.box(0.32, 0.06, 0.06, GOLD, 0, 0.16, 0));
    }
  };

  function trophyCase(scene, x, z, list) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var w = list.length * 1.0 + 0.4;
    g.add(CS.box(w, 0.9, 0.8, OAK, 0, 0.45, 0));
    g.add(CS.box(w + 0.1, 0.06, 0.9, OAK_D, 0, 0.92, 0));
    list.forEach(function (t, i) {
      var s = new THREE.Group();
      s.position.set(-w / 2 + 0.7 + i * 1.0, 0.95, 0);
      s.add(CS.cyl(0.2, 0.24, 0.1, { color: 0x2f4f96, rough: 0.8 }, 0, 0.05, 0, 14));
      if (TROPHY_LOOK[t.id]) TROPHY_LOOK[t.id](s);
      g.add(s);
    });
    scene.add(g);
  }

  /* The slushie bar: an oak counter with three swirling tanks. */
  var tanks = [];
  function slushBar(scene, x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(CS.box(4.0, 1.0, 1.0, OAK, 0, 0.5, 0));
    g.add(CS.box(4.15, 0.08, 1.12, { color: 0x3a5aa6, rough: 0.3 }, 0, 1.04, 0));
    g.add(CS.box(3.4, 0.5, 0.04, { color: 0xf4ead6, rough: 0.6 }, 0, 0.6, 0.52));   // sign band
    [0xe8546a, 0x5fb0e8, 0x9fd84a].forEach(function (c, i) {
      var tx = -1.2 + i * 1.2;
      g.add(CS.box(0.7, 0.3, 0.6, { color: 0xd8dde6, rough: 0.3, metal: 0.5 }, tx, 1.23, 0));
      var liquid = CS.cyl(0.26, 0.24, 0.62, { color: c, rough: 0.15, emissive: CS.shade(c, -110) }, tx, 1.72, 0, 16);
      g.add(liquid);
      g.add(CS.cyl(0.29, 0.29, 0.66, { color: 0xeaf6ff, opacity: 0.35, rough: 0.05 }, tx, 1.72, 0, 16));
      // a white swirl that turns inside the tank
      var swirl = CS.box(0.4, 0.05, 0.05, { color: 0xffffff, rough: 0.3 }, tx, 1.72, 0);
      g.add(swirl);
      tanks.push(swirl);
      D.dynamic.push(swirl);
      put(g, CS.cyl(0.1, 0.1, 0.08, { color: 0x34353b, rough: 0.4 }, tx, 1.45, 0.32, 8)).rotation.x = Math.PI / 2;
    });
    // a stack of cups
    for (var i = 0; i < 4; i++) g.add(CS.cyl(0.12, 0.09, 0.16, { color: 0xffffff, rough: 0.4 }, 1.75, 1.15 + i * 0.07, 0.2, 12));
    scene.add(g);
    return g;
  }

  function slushieCup(color) {
    var g = new THREE.Group();
    g.add(CS.cyl(0.11, 0.08, 0.26, { color: 0xffffff, rough: 0.4 }, 0, 0.13, 0, 12));
    g.add(CS.ball(0.11, 0.08, 0.11, { color: color, rough: 0.2 }, 0, 0.27, 0));
    put(g, CS.cyl(0.015, 0.015, 0.3, { color: 0xe8546a, rough: 0.4 }, 0.04, 0.38, 0, 6)).rotation.z = -0.25;
    return g;
  }
  D.slushieCup = slushieCup;

  /* Pom, the moogle behind the bar, in a little red waistcoat. */
  function makeServer(scene, x, z) {
    var idx = 0;
    for (var i = 0; i < CS.CRITTERS.length; i++) if (CS.CRITTERS[i].look === 'moogle') idx = i;
    var c = CS.models.customer(idx, 7);
    if (c.parts.mark) c.parts.mark.visible = false;
    c.group.add(CS.box(0.5, 0.3, 0.06, { color: 0xc8302e, rough: 0.7 }, 0, 0.5, 0.27));   // waistcoat
    var tray = slushieCup(0x9fd84a);
    tray.visible = false;
    tray.position.set(0.3, 0.55, 0.3);
    c.group.add(tray);
    c.group.position.set(x, 0, z);
    scene.add(c.group);
    D.dynamic.push(c.group);
    D.server = { cust: c, home: { x: x, z: z }, state: 'idle', t: 2.0, target: null, carry: tray,
      walk: 0, bob: 0, gait: 0 };
  }

  /* ------------------------------------------------------------- build */
  var FLOORS = { floorOak: 'parquet', floorRug: 'carpet', floorMarble: 'floor' };
  var WALLS = { wallDamask: 'wallDamask', wallStripe: 'wallStripe', wallRose: 'wallRose' };

  function build(scene, opts) {
    D.seats = [];
    D.dynamic = [];
    D.server = null;
    tanks = [];
    var ext = D.extent(), W = ext.x1 - ext.x0, cx = (ext.x0 + ext.x1) / 2;
    var decor = CS.econ ? CS.econ.state.decor : {};

    // ---- the floor
    var ftex = FLOORS[decor.floor] || 'diningFloor';
    var scale = ftex === 'floor' ? 4.4 : (ftex === 'carpet' ? 8 : 4.4);
    var dine = new THREE.Mesh(new THREE.PlaneGeometry(W, 10),
      CS.mat({ color: 0xffffff, tex: ftex, rough: ftex === 'floor' ? 0.25 : 0.7 }));
    dine.material = dine.material.clone();
    dine.material.map = CS.texRepeat(ftex, W / scale, 10 / scale);
    dine.rotation.x = -Math.PI / 2;
    dine.position.set(cx, -0.02, CS.OZ - 5);
    dine.receiveShadow = true;
    scene.add(dine);

    // ---- wallpaper on the back wall, either side of the door
    var wtex = WALLS[decor.wall];
    if (wtex && opts.door) {
      var gap0 = opts.door.x - opts.door.w / 2 - 0.15, gap1 = opts.door.x + opts.door.w / 2 + 0.15;
      [[ext.x0, gap0], [gap1, ext.x1]].forEach(function (seg) {
        var w = seg[1] - seg[0];
        if (w < 0.3) return;
        var m = CS.mat({ color: 0xffffff, tex: wtex, rough: 0.8 });
        var p = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.9), m.clone());
        p.material.map = CS.texRepeat(wtex, w / 1.6, 2.9 / 1.6);
        p.position.set((seg[0] + seg[1]) / 2, 1.85, BACK_Z + 0.40);   // in front of the stones
        scene.add(p);
        // a dado rail along the bottom of the paper
        scene.add(CS.box(w, 0.1, 0.08, OAK_D, (seg[0] + seg[1]) / 2, 0.42, BACK_Z + 0.43));
      });
    }

    // ---- against the back wall
    var back = new Row(ext);
    var x;
    var won = CS.econ ? CS.econ.trophies() : [];
    if (has('slushBar')) {
      x = back.place(ext.x1 - 3.4, 4.4);
      if (x !== null) {
        slushBar(scene, x, ROW_BACK);
        if (has('slushServer')) makeServer(scene, x - 0.6, ROW_BACK + 1.1);
      }
    }
    if (has('statue')) {
      x = back.place(CS.OX + 28.3, 2.0);
      if (x !== null) statue(scene, x, ROW_BACK + 0.1);
    }
    if (won.length) {
      x = back.place(CS.OX + 18.5, won.length + 0.6);
      if (x !== null) trophyCase(scene, x, ROW_BACK, won);
    }
    // the November special's pumpkin piles
    if (CS.isThanksgiving && opts.pumpkin) {
      [[CS.OX + 4.4, [[0, 0, 1.1, 0], [0.9, -0.4, 0.75, 0xf2a03a], [-0.5, 0.9, 0.6, 0xeee0c4]]],
       [ext.x1 - 6, [[0, 0, 1.0, 0], [-0.9, -0.3, 0.6, 0xc9661a]]]].forEach(function (pile) {
        var px = back.place(pile[0], 2.2);
        if (px === null) return;
        pile[1].forEach(function (p) {
          opts.pumpkin(scene, px + p[0], 0, ROW_BACK - 0.2 + p[1], p[2], p[3] || undefined);
        });
      });
    }
    // the barrels and the old chest fill whatever is left
    x = back.place(CS.OX + 2.2, 2.6);
    if (x !== null) { opts.barrel(scene, x - 0.6, CS.OZ - 7.6, 1.0); opts.barrel(scene, x + 0.7, CS.OZ - 8.2, 0.82); }
    x = back.place(CS.OX + 31, 1.6);
    if (x !== null) opts.chest(scene, x, CS.OZ - 7.8, -0.25);

    // ---- tables, near row and far row, never in the queue's lane
    var rowA = new Row(ext), rowB = new Row(ext);
    var want = [];
    if (has('tables')) want.push([rowA, 17], [rowA, 21.6], [rowB, 17], [rowB, 21.6]);
    if (has('tables2')) want.push([rowA, 41], [rowB, 41], [rowA, 26.2], [rowB, 26.2]);
    want.forEach(function (w) {
      var tx = w[0].place(CS.OX + w[1], 3.3);
      if (tx !== null) table(scene, tx, w[0] === rowA ? ROW_A : ROW_B);
    });

    // ---- plants in the corners, and either side of the door
    if (has('plants')) {
      var px = back.place(ext.x0 + 0.8, 0.9); if (px !== null) plant(scene, px, ROW_BACK + 0.2, 1);
      px = back.place(ext.x1 - 0.8, 0.9); if (px !== null) plant(scene, px, ROW_BACK + 0.2, 0);
      px = rowB.place(ext.x0 + 0.8, 0.9); if (px !== null) plant(scene, px, CS.OZ - 1.2, 0);
      px = rowB.place(ext.x1 - 0.8, 0.9); if (px !== null) plant(scene, px, CS.OZ - 1.2, 1);
    }
  }

  /* -------------------------------------------------------- the server */
  function stepTo(g, tx, tz, speed, dt) {
    var dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return 0;
    var m = Math.min(d, speed * dt);
    g.position.x += dx / d * m;
    g.position.z += dz / d * m;
    var want = Math.atan2(dx, dz);
    var diff = ((want - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.rotation.y += diff * Math.min(1, dt * 8);
    return m;
  }

  /* Whoever in the queue is nearest to walking out, and has no slushie. */
  function pickTarget() {
    var best = null;
    CS.orders.list.forEach(function (o) {
      if (o.done || o.slushie || !o.cust || o.cust.state !== 'queue') return;
      if (!best || o.left / o.limit < best.left / best.limit) best = o;
    });
    return best;
  }

  function update(dt, playing) {
    var t = performance.now() / 1000;
    for (var i = 0; i < tanks.length; i++) tanks[i].rotation.y = t * (1.4 + i * 0.3);

    var s = D.server;
    if (!s) return;
    var g = s.cust.group, moved = 0;
    if (!playing) s.state = s.state === 'idle' ? 'idle' : 'back';

    if (s.state === 'idle') {
      s.t -= dt;
      var diff = ((0 - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      g.rotation.y += diff * Math.min(1, dt * 5);
      if (playing && s.t <= 0) {
        var o = pickTarget();
        if (o) { s.target = o; s.state = 'go'; s.carry.visible = true; }
        else s.t = 1.0;
      }
    } else if (s.state === 'go') {
      var o2 = s.target;
      if (!o2 || o2.done || !o2.cust) { s.state = 'back'; }
      else {
        var cp = o2.cust.group.position;
        moved = stepTo(g, cp.x + 0.75, cp.z, 3.4, dt);
        if (Math.hypot(cp.x + 0.75 - g.position.x, cp.z - g.position.z) < 0.12) give(o2);
      }
    } else if (s.state === 'back') {
      moved = stepTo(g, s.home.x, s.home.z, 3.0, dt);
      if (moved === 0) { s.state = 'idle'; s.t = CS.SLUSHIE.every; s.carry.visible = false; }
    }

    // the same waddle the customers use
    var p = s.cust.parts;
    s.walk += moved * 4.4;
    s.bob += dt * 1.9;
    s.gait += ((moved > 0.0008 ? 1 : 0) - s.gait) * Math.min(1, dt * 11);
    var sw = Math.sin(s.walk) * 0.8 * s.gait;
    p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
    p.armL.rotation.x = -sw * 0.7;
    p.armR.rotation.x = s.carry.visible ? -1.2 : sw * 0.7;
    g.position.y = Math.abs(Math.sin(s.walk)) * 0.06 * s.gait + Math.sin(s.bob) * 0.016 * (1 - s.gait);
  }

  /* Hand it over: the order gets back a good slice of its patience, the
     customer holds a slushie, and its tip will be bigger. */
  function give(o) {
    var s = D.server;
    o.slushie = true;
    o.left = Math.min(o.limit, o.left + o.limit * CS.SLUSHIE.patience);
    o.beeped = false;
    var cup = slushieCup([0xe8546a, 0x5fb0e8, 0x9fd84a][o.id % 3]);
    cup.position.set(0.32, 0.5, 0.22);
    o.cust.group.add(cup);
    var cp = o.cust.group.position;
    if (CS.fx) CS.fx.burst(cp.x, 1.6, cp.z, 10, { color: 0xff8ab0, life: 0.8, vy: 1.8 });
    if (CS.audio && CS.audio.voice) CS.audio.voice(o.critter.look, 0.5);
    s.state = 'back';
    s.carry.visible = false;
    s.target = null;
  }
})(window.CS);
