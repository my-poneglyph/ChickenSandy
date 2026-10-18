/* The castle bosses.

   Every tenth day one of the castle's great and terrible residents comes
   down to the shop to be fed (see CS.BOSSES in config.js for who they are
   and what they want). This file is everything about the one standing in
   the dining room: the five models, how they arrive, breathe, watch the
   chef, chomp a course, roar when one goes cold and celebrate when they
   are full; the hunger meter in the HUD; the Shadow Rooster's stone glare;
   and the camera work for the reveal and the victory.

   Like everything else the models are built in code from smooth
   primitives, then baked so a boss costs a few dozen draw calls rather
   than a few hundred. Each is about five and a half units tall -- around
   five times a customer -- so it stands head and shoulders over the
   kitchen's back wall, watching you cook.                                 */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var scene = null, light = null, hud = null;
  var B = null;                 // the boss on the floor, or null
  var flights = [];             // plates arcing from the window into its mouth
  var stones = [];              // stations under the Shadow Rooster's glare
  var beams = [];               // and the glare itself, fading
  var cine = { on: false };     // the reveal / victory camera

  function add(p, m) { p.add(m); return m; }

  /* A material of its own (not from the shared cache), for glowing parts
     whose colour or strength is animated per boss. */
  function glow(hex) { return new THREE.MeshBasicMaterial({ color: CS.linear(hex) }); }

  /* A cylinder from point a to point b: bones, struts, staves. */
  var UP = new THREE.Vector3(0, 1, 0);
  function strut(parent, a, b, r0, r1, m) {
    var va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
    var dir = vb.clone().sub(va), len = dir.length();
    var mesh = CS.cyl(r1, r0, len, m, 0, 0, 0, 10);
    mesh.position.copy(va).add(vb).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
    parent.add(mesh);
    return mesh;
  }

  /* A flat membrane through a fan of points -- a dragon's wing. */
  function membrane(parent, pts, m) {
    var pos = [];
    for (var i = 1; i < pts.length - 1; i++) {
      pos.push(pts[0][0], pts[0][1], pts[0][2], pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, CS.mat(m));
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /* Giant cutlery, for the bosses who brought their own. Built standing up
     along +y from the fist that holds it. */
  var SILVER = { color: 0xd8dde6, rough: 0.2, metal: 0.9 };
  function fork(parent) {
    var g = add(parent, new THREE.Group());
    add(g, CS.cyl(0.07, 0.08, 1.5, SILVER, 0, 0.55, 0, 10));
    add(g, CS.box(0.42, 0.14, 0.08, SILVER, 0, 1.33, 0));
    [-0.15, 0, 0.15].forEach(function (x) { add(g, CS.box(0.06, 0.55, 0.06, SILVER, x, 1.65, 0)); });
    return g;
  }
  function knife(parent) {
    var g = add(parent, new THREE.Group());
    add(g, CS.cyl(0.08, 0.09, 0.9, { color: 0x5a3a22, rough: 0.7 }, 0, 0.3, 0, 10));
    add(g, CS.box(0.08, 1.15, 0.3, SILVER, 0, 1.3, 0.04));
    return g;
  }
  /* A napkin tucked in at the neck. Every one of them wears one. */
  function napkin(parent, w, h, x, y, z, tilt) {
    var g = add(parent, new THREE.Group());
    g.position.set(x, y, z);
    g.rotation.x = tilt;
    // a triangle of linen, point down, with a red-checked border
    [[1, 0xc8402e, 0], [0.84, 0xf6f0e2, 0.012]].forEach(function (l) {
      var t = add(g, CS.cone(w * 0.58 * l[0], h * l[0], { color: l[1], rough: 0.9 }, 0, -h * l[0] / 2, l[2], 3));
      t.rotation.x = Math.PI; t.scale.z = 0.08;
    });
    for (var c = 0; c < 5; c++) {
      add(g, CS.box(w * 0.07, w * 0.07, 0.02, { color: 0xc8402e, rough: 0.9 }, (c - 2) * w * 0.14, -h * 0.12, 0.03));
    }
    [-1, 1].forEach(function (s) { add(g, CS.ball(0.13, 0.1, 0.1, { color: 0xf6f0e2, rough: 0.9 }, s * 0.12, 0.02, 0.02)); });
    return g;
  }

  /* An arm on a shoulder pivot, hanging down -y. `parts` gets the pivot. */
  function pivot(parent, x, y, z) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  /* ================================================================ OGRE */
  function ogre() {
    var g = new THREE.Group(), P = {};
    var SKIN = { color: 0x86a35c, rough: 0.75 }, SKIN_D = { color: 0x627d42, rough: 0.8 };
    var BELLY = { color: 0xb1c283, rough: 0.8 };
    var LEATHER = { color: 0x6a4528, rough: 0.85 }, IRON = { color: 0x70757f, rough: 0.35, metal: 0.8 };
    var IVORY = { color: 0xf1e6c8, rough: 0.4 }, CAPE = { color: 0x8a2c2c, rough: 0.9, side: true };
    var GOLD = { color: 0xf2bf3e, rough: 0.3, metal: 0.8 }, DARK = { color: 0x1e1828, rough: 0.2 };
    P.eyeMat = glow(0xffe27a);

    [-1, 1].forEach(function (s) {
      add(g, CS.ball(0.44, 0.64, 0.46, SKIN, s * 0.62, 0.62, 0));
      add(g, CS.ball(0.52, 0.25, 0.68, SKIN_D, s * 0.66, 0.16, 0.18));
      for (var i = -1; i <= 1; i++) add(g, CS.ball(0.12, 0.09, 0.1, IVORY, s * 0.66 + i * 0.2, 0.12, 0.8));
    });
    add(g, CS.cyl(1.05, 1.25, 0.8, LEATHER, 0, 1.25, 0, 20));

    var body = P.body = pivot(g, 0, 1.5, 0);
    add(body, CS.ball(1.38, 1.25, 1.12, SKIN, 0, 0.95, 0));
    add(body, CS.ball(1.02, 0.95, 0.55, BELLY, 0, 0.72, 0.64));
    var belt = add(body, CS.torus(1.2, 0.12, 0, LEATHER, 0, 0.2, 0));
    belt.rotation.x = Math.PI / 2; belt.scale.y = 0.9;
    add(body, CS.box(0.46, 0.34, 0.12, GOLD, 0, 0.2, 1.06));
    napkin(body, 1.15, 0.95, 0, 2.02, 0.92, -0.32);
    var cape = add(body, CS.shell(1.46, 1.55, 1.25, CAPE, Math.PI, Math.PI, 0.25, 1.6));
    cape.position.set(0, 1.0, -0.08);
    [-1, 1].forEach(function (s) {
      add(body, CS.ball(0.64, 0.42, 0.64, IRON, s * 1.24, 1.86, 0));
      for (var r = 0; r < 3; r++) add(body, CS.ball(0.06, 0.06, 0.06, GOLD, s * (1.0 + r * 0.22), 2.18, 0.3));
    });

    ['armL', 'armR'].forEach(function (id, i) {
      var s = i ? 1 : -1;
      var a = P[id] = pivot(body, s * 1.4, 1.72, 0);
      add(a, CS.ball(0.42, 0.74, 0.42, SKIN, 0, -0.6, 0));
      add(a, CS.cyl(0.45, 0.45, 0.42, LEATHER, 0, -1.48, 0.05, 16));
      add(a, CS.ball(0.4, 0.62, 0.4, SKIN, 0, -1.42, 0.05));
      add(a, CS.ball(0.5, 0.45, 0.5, SKIN_D, 0, -2.02, 0.12));
      var tool = i ? knife(a) : fork(a);
      tool.position.set(0, -2.0, 0.2);
      tool.rotation.x = 1.1;
    });

    var head = P.head = pivot(body, 0, 2.45, 0.15);
    add(head, CS.ball(0.84, 0.76, 0.8, SKIN, 0, 0.35, 0));
    var brow = add(head, CS.box(1.2, 0.22, 0.35, SKIN_D, 0, 0.64, 0.56)); brow.rotation.x = 0.25;
    [-1, 1].forEach(function (s) {
      add(head, new THREE.Mesh(CS.ball(1, 1, 1).geometry, P.eyeMat)).position.set(s * 0.3, 0.45, 0.72);
      head.children[head.children.length - 1].scale.set(0.15, 0.12, 0.08);
      add(head, CS.ball(0.06, 0.07, 0.04, DARK, s * 0.3, 0.45, 0.79));
      var ear = add(head, CS.cone(0.2, 0.55, SKIN, s * 0.86, 0.42, -0.05, 8));
      ear.rotation.z = -s * 1.25;
      var horn = add(head, CS.cone(0.13, 0.7, IVORY, s * 0.62, 1.02, 0.05, 10));
      horn.rotation.z = -s * 0.65;
    });
    add(head, CS.ball(0.25, 0.2, 0.22, SKIN_D, 0, 0.28, 0.86));
    add(head, CS.shell(0.88, 0.62, 0.84, IRON, 0, Math.PI * 2, 0, Math.PI * 0.42)).position.y = 0.5;
    var band = add(head, CS.torus(0.85, 0.06, 0, IRON, 0, 0.66, 0)); band.rotation.x = Math.PI / 2;
    add(head, CS.box(0.14, 0.45, 0.1, IRON, 0, 0.66, 0.84));
    add(head, CS.ball(0.5, 0.12, 0.38, DARK, 0, 0.04, 0.45));      // the inside of the mouth
    var jaw = P.jaw = pivot(head, 0, 0.12, 0.22);
    add(jaw, CS.ball(0.7, 0.32, 0.62, SKIN, 0, -0.12, 0.25));
    [-1, 1].forEach(function (s) {
      add(jaw, CS.cone(0.09, 0.42, IVORY, s * 0.34, 0.12, 0.72, 8));
    });
    P.mouth = pivot(head, 0, 0.12, 0.85);
    return { group: g, parts: P, scale: 1.12, arrive: 'drop', lightColor: 0xffd27a, lightY: 3.4 };
  }

  /* ============================================================== DRAGON */
  function dragon() {
    var g = new THREE.Group(), P = {};
    var SCALE = { color: 0xc23a22, rough: 0.45, metal: 0.1 }, SCALE_D = { color: 0x8f2414, rough: 0.5 };
    var BELLY = { color: 0xf0b44a, rough: 0.5 }, HORN = { color: 0xefe3c2, rough: 0.4 };
    var WING = { color: 0xa3281c, rough: 0.6, side: true }, CLAW = { color: 0x2a1e1a, rough: 0.3 };
    var DARK = { color: 0x1e1010, rough: 0.3 };
    P.eyeMat = glow(0xffb21e);

    [-1, 1].forEach(function (s) {
      add(g, CS.ball(0.78, 0.72, 0.98, SCALE, s * 0.86, 0.72, -0.1));
      add(g, CS.ball(0.4, 0.22, 0.72, SCALE_D, s * 0.92, 0.18, 0.55));
      [-0.18, 0, 0.18].forEach(function (x) {
        var c = add(g, CS.cone(0.07, 0.28, CLAW, s * 0.92 + x, 0.14, 1.25, 8));
        c.rotation.x = Math.PI / 2;
      });
    });

    // the tail curls round the right side on the floor
    var tail = P.tail = pivot(g, 0.2, 0, -0.9);
    var tp = [[0, 0.5, 0], [0.7, 0.4, -0.45], [1.45, 0.34, -0.45], [2.05, 0.3, -0.05], [2.35, 0.27, 0.6], [2.25, 0.25, 1.25]];
    tp.forEach(function (p, i) {
      var r = 0.5 * (1 - i * 0.13);
      add(tail, CS.ball(r, r * 0.85, r, SCALE, p[0], p[1], p[2]));
      if (i < tp.length - 1) {
        var sp = add(tail, CS.cone(0.09, 0.3, SCALE_D, p[0], p[1] + r * 0.8, p[2], 6));
        sp.rotation.z = -0.3;
      }
    });
    var spade = add(tail, CS.cone(0.32, 0.6, SCALE_D, 2.2, 0.25, 1.75, 4));
    spade.rotation.x = Math.PI / 2; spade.scale.z = 0.3;

    var body = P.body = pivot(g, 0, 1.0, 0);
    add(body, CS.ball(1.15, 1.45, 1.05, SCALE, 0, 1.2, 0));
    for (var i = 0; i < 6; i++) {
      var y = 0.35 + i * 0.32, k = (y - 1.2) / 1.45;
      var zr = 1.05 * Math.sqrt(Math.max(0, 1 - k * k));
      add(body, CS.ball(0.72 - Math.abs(k) * 0.3, 0.17, 0.28, BELLY, 0, y, zr - 0.12));
    }
    for (var j = 0; j < 6; j++) {
      var sy = 0.5 + j * 0.42, sk = (sy - 1.2) / 1.45;
      var bz = -1.05 * Math.sqrt(Math.max(0, 1 - sk * sk));
      var spine = add(body, CS.cone(0.13, 0.42, SCALE_D, 0, sy, bz - 0.05, 6));
      spine.rotation.x = -1.1;
    }
    napkin(body, 0.95, 0.75, 0, 2.3, 0.82, -0.45);

    ['armL', 'armR'].forEach(function (id, i) {
      var s = i ? 1 : -1;
      var a = P[id] = pivot(body, s * 0.82, 1.9, 0.55);
      add(a, CS.ball(0.2, 0.42, 0.2, SCALE, 0, -0.34, 0.05));
      add(a, CS.ball(0.17, 0.36, 0.17, SCALE, 0, -0.8, 0.18));
      add(a, CS.ball(0.2, 0.15, 0.22, SCALE_D, 0, -1.12, 0.26));
      if (i) { var f = fork(a); f.position.set(0, -1.12, 0.3); f.rotation.x = 0.9; f.scale.setScalar(0.75); }
    });

    // wings: an arm bone to the elbow, three fingers fanning out, and the
    // membrane stretched between them
    ['wingL', 'wingR'].forEach(function (id, i) {
      var s = i ? 1 : -1;
      var w = P[id] = pivot(body, s * 0.6, 2.25, -0.75);
      var elbow = [s * 1.6, 1.05, -0.3];
      var tips = [[s * 3.0, 2.1, -0.6], [s * 3.35, 0.7, -0.7], [s * 2.7, -0.55, -0.6]];
      strut(w, [0, 0, 0], elbow, 0.12, 0.09, SCALE_D);
      tips.forEach(function (t) { strut(w, elbow, t, 0.07, 0.03, SCALE_D); });
      membrane(w, [elbow, [0, 0, 0], tips[0], tips[1], tips[2], [s * 0.4, -0.85, -0.3]], WING);
      add(w, CS.cone(0.08, 0.3, HORN, elbow[0], elbow[1] + 0.2, elbow[2], 6));
    });

    var neck = pivot(body, 0, 2.45, 0.2);
    add(neck, CS.ball(0.52, 0.55, 0.5, SCALE, 0, 0.2, 0.05));
    add(neck, CS.ball(0.46, 0.5, 0.45, SCALE, 0, 0.7, 0.3));
    add(neck, CS.ball(0.3, 0.42, 0.22, BELLY, 0, 0.5, 0.42));
    var head = P.head = pivot(neck, 0, 1.25, 0.55);
    add(head, CS.ball(0.62, 0.5, 0.66, SCALE, 0, 0, 0));
    add(head, CS.ball(0.42, 0.32, 0.62, SCALE, 0, -0.08, 0.62));
    [-1, 1].forEach(function (s) {
      add(head, CS.ball(0.05, 0.04, 0.03, DARK, s * 0.14, 0.06, 1.18));
      var eye = add(head, new THREE.Mesh(CS.ball(1, 1, 1).geometry, P.eyeMat));
      eye.position.set(s * 0.34, 0.17, 0.44); eye.scale.set(0.13, 0.1, 0.08);
      add(head, CS.box(0.03, 0.14, 0.02, DARK, s * 0.34, 0.17, 0.52));
      var brow = add(head, CS.box(0.3, 0.1, 0.3, SCALE_D, s * 0.32, 0.32, 0.4)); brow.rotation.z = s * 0.35;
      var horn = add(head, CS.cone(0.13, 0.95, HORN, s * 0.3, 0.42, -0.35, 10));
      horn.rotation.x = -1.05; horn.rotation.z = -s * 0.2;
      var frill = add(head, CS.cone(0.1, 0.42, SCALE_D, s * 0.6, 0.0, -0.2, 6));
      frill.rotation.z = -s * 1.4;
    });
    add(head, CS.ball(0.3, 0.1, 0.48, { color: 0x5a1010, rough: 0.6 }, 0, -0.24, 0.55));
    var jaw = P.jaw = pivot(head, 0, -0.22, 0.12);
    add(jaw, CS.ball(0.38, 0.13, 0.62, SCALE_D, 0, -0.06, 0.45));
    for (var t = 0; t < 5; t++) {
      [-1, 1].forEach(function (s) {
        add(jaw, CS.cone(0.035, 0.12, HORN, s * (0.24 - t * 0.03), 0.06, 0.25 + t * 0.17, 5));
      });
    }
    P.mouth = pivot(head, 0, -0.2, 0.95);
    P.nose = pivot(head, 0, 0.06, 1.2);
    return { group: g, parts: P, scale: 1.08, arrive: 'fly', lightColor: 0xff8a3a, lightY: 3.0 };
  }

  /* ================================================================ LICH */
  function lich() {
    var g = new THREE.Group(), P = {};
    var ROBE = { color: 0x3a2858, rough: 0.85 }, ROBE_D = { color: 0x271a3e, rough: 0.9, side: true };
    var GOLD = { color: 0xe6b84a, rough: 0.3, metal: 0.8 }, BONE = { color: 0xe9e1c9, rough: 0.6 };
    var HAT = { color: 0xdedad0, rough: 0.95 }, WOOD = { color: 0x3d2a1e, rough: 0.8 };
    var DARK = { color: 0x0e0a14, rough: 0.5 };
    P.eyeMat = glow(0x6ff0ff);
    P.lampMat = glow(0x9ff8ff);

    // the whole lich floats, so everything hangs off one pivot that bobs
    var body = P.body = pivot(g, 0, 0.55, 0);
    add(body, CS.cyl(0.78, 1.55, 3.0, ROBE, 0, 1.5, 0, 24));
    for (var i = 0; i < 16; i++) {
      var a = i / 16 * Math.PI * 2;
      var tat = add(body, CS.cone(0.24, 0.6, ROBE_D, Math.sin(a) * 1.42, -0.1, Math.cos(a) * 1.42, 5));
      tat.rotation.x = Math.PI;
    }
    var hem = add(body, CS.torus(1.5, 0.05, 0, GOLD, 0, 0.18, 0)); hem.rotation.x = Math.PI / 2;
    [-1, 1].forEach(function (s) {
      var stole = add(body, CS.box(0.24, 2.3, 0.08, GOLD, s * 0.32, 1.75, 1.08));
      stole.rotation.x = -0.26;
    });
    add(body, CS.ball(0.98, 0.72, 0.78, ROBE, 0, 3.1, 0));
    var col = add(body, CS.torus(0.62, 0.08, 0, GOLD, 0, 3.55, 0.05)); col.rotation.x = Math.PI / 2;
    add(body, new THREE.Mesh(CS.ball(1, 1, 1).geometry, P.eyeMat)).position.set(0, 3.15, 0.8);
    body.children[body.children.length - 1].scale.set(0.13, 0.16, 0.08);
    // a ragged chef's apron over the robe: he was the royal cook once
    var apron = add(body, CS.box(0.72, 1.05, 0.05, { color: 0xcfc6b0, rough: 0.95 }, 0, 1.95, 1.04)); apron.rotation.x = -0.26;
    napkin(body, 0.8, 0.55, 0, 3.4, 0.72, -0.5);

    ['armL', 'armR'].forEach(function (id, i) {
      var s = i ? 1 : -1;
      var a = P[id] = pivot(body, s * 1.0, 3.3, 0);
      add(a, CS.cyl(0.24, 0.44, 1.5, ROBE, 0, -0.72, 0, 16));
      add(a, CS.box(0.26, 0.22, 0.16, BONE, 0, -1.58, 0.05));
      for (var f = 0; f < 4; f++) {
        strut(a, [-0.09 + f * 0.06, -1.66, 0.08], [-0.1 + f * 0.065, -1.95, 0.16], 0.025, 0.02, BONE);
      }
      if (!i) {
        // the lantern staff
        strut(a, [0, -3.4, 0.15], [0, 1.25, 0.15], 0.07, 0.06, WOOD);
        var lamp = P.lantern = pivot(a, 0, 1.55, 0.15);
        add(lamp, CS.box(0.42, 0.06, 0.42, GOLD, 0, 0.28, 0));
        add(lamp, CS.box(0.42, 0.06, 0.42, GOLD, 0, -0.28, 0));
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (c) {
          add(lamp, CS.box(0.04, 0.56, 0.04, GOLD, c[0] * 0.19, 0, c[1] * 0.19));
        });
        add(lamp, new THREE.Mesh(CS.ball(1, 1, 1).geometry, P.lampMat)).scale.set(0.16, 0.2, 0.16);
        add(lamp, CS.cone(0.26, 0.24, GOLD, 0, 0.42, 0, 4)).rotation.y = Math.PI / 4;
      } else {
        // a tasting ladle, for finding everything wanting
        var ladle = pivot(a, 0, -1.7, 0.2);
        ladle.rotation.x = 1.0;
        add(ladle, CS.cyl(0.04, 0.04, 1.3, SILVER, 0, 0.6, 0, 8));
        add(ladle, CS.shell(0.22, 0.16, 0.22, SILVER, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)).position.y = 1.3;
      }
    });

    var head = P.head = pivot(body, 0, 3.85, 0.1);
    add(head, CS.shell(0.78, 0.86, 0.78, ROBE_D, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.72)).position.y = 0.12;
    add(head, CS.ball(0.48, 0.52, 0.5, BONE, 0, 0.1, 0));
    [-1, 1].forEach(function (s) {
      add(head, CS.ball(0.14, 0.13, 0.07, DARK, s * 0.18, 0.18, 0.41));
      var e = add(head, new THREE.Mesh(CS.ball(1, 1, 1).geometry, P.eyeMat));
      e.position.set(s * 0.18, 0.18, 0.45); e.scale.set(0.065, 0.065, 0.04);
      add(head, CS.ball(0.12, 0.08, 0.1, BONE, s * 0.3, -0.02, 0.32));
    });
    var nose = add(head, CS.cone(0.06, 0.12, DARK, 0, 0.0, 0.48, 3)); nose.rotation.x = Math.PI;
    for (var u = 0; u < 6; u++) add(head, CS.box(0.05, 0.08, 0.05, BONE, -0.13 + u * 0.052, -0.14, 0.42));
    add(head, CS.ball(0.28, 0.08, 0.2, DARK, 0, -0.2, 0.3));
    var jaw = P.jaw = pivot(head, 0, -0.18, 0.1);
    add(jaw, CS.box(0.46, 0.14, 0.36, BONE, 0, -0.1, 0.18));
    for (var d = 0; d < 6; d++) add(jaw, CS.box(0.05, 0.07, 0.05, BONE, -0.13 + d * 0.052, -0.01, 0.33));
    var hat = pivot(head, 0.04, 0.55, -0.04);
    hat.rotation.z = -0.14;
    add(hat, CS.cyl(0.44, 0.4, 0.75, HAT, 0, 0.36, 0, 18));
    add(hat, CS.ball(0.62, 0.36, 0.6, HAT, 0, 0.82, 0));
    add(hat, CS.ball(0.18, 0.16, 0.18, { color: 0xb8b2a6, rough: 0.95 }, 0.3, 0.75, 0.35));   // a moth hole, patched
    P.mouth = pivot(head, 0, -0.12, 0.5);
    return { group: g, parts: P, scale: 1.15, arrive: 'rise', pose: { lx: -0.7, lz: -0.35 }, lightColor: 0x7ff4ff, lightY: 4.2, float: true };
  }

  /* ============================================================ COLOSSUS */
  function colossus() {
    var g = new THREE.Group(), P = {};
    var BRASS = { color: 0xc8963c, rough: 0.35, metal: 0.85 }, BRASS_D = { color: 0x8a6426, rough: 0.4, metal: 0.85 };
    var IRON = { color: 0x3a3f48, rough: 0.5, metal: 0.7 }, RIVET = { color: 0xf2cf6a, rough: 0.3, metal: 0.9 };
    P.eyeMat = glow(0xff9a3a);
    P.fireMat = glow(0xff6a1a);
    P.beaconMat = glow(0xff3030);

    [-1, 1].forEach(function (s) {
      add(g, CS.box(1.0, 0.26, 1.35, IRON, s * 0.72, 0.13, 0.2));
      add(g, CS.box(0.86, 0.92, 0.96, BRASS_D, s * 0.72, 0.68, 0.05));
      add(g, CS.ball(0.32, 0.32, 0.32, IRON, s * 0.72, 1.22, 0.05));
      add(g, CS.box(0.76, 0.9, 0.82, BRASS, s * 0.72, 1.6, 0));
    });
    add(g, CS.box(1.9, 0.5, 1.1, IRON, 0, 2.05, 0));

    var body = P.body = pivot(g, 0, 2.2, 0);
    add(body, CS.box(2.7, 2.1, 1.7, { color: 0xc8963c, rough: 0.35, metal: 0.85, round: 0.32 }, 0, 1.15, 0));
    add(body, CS.box(2.0, 1.5, 0.12, BRASS_D, 0, 1.2, 0.86));
    for (var r = 0; r < 8; r++) {
      add(body, CS.ball(0.06, 0.06, 0.04, RIVET, -0.9 + r * 0.257, 1.9, 0.93));
      add(body, CS.ball(0.06, 0.06, 0.04, RIVET, -0.9 + r * 0.257, 0.5, 0.93));
    }
    add(body, CS.torus(0.56, 0.11, 0, BRASS, 0, 1.15, 0.94));
    add(body, new THREE.Mesh(CS.cyl(0.5, 0.5, 0.04, IRON).geometry, P.fireMat)).position.set(0, 1.15, 0.9);
    body.children[body.children.length - 1].rotation.x = Math.PI / 2;
    // the furnace door is its mouth: it swings open to take a course
    var jaw = P.jaw = pivot(body, 0, 0.6, 1.0);
    var door = add(jaw, CS.cyl(0.55, 0.55, 0.08, IRON, 0, 0.55, 0.02, 24)); door.rotation.x = Math.PI / 2;
    for (var b = 0; b < 4; b++) add(jaw, CS.box(0.06, 0.8, 0.06, BRASS_D, -0.27 + b * 0.18, 0.55, 0.08));
    add(jaw, CS.ball(0.08, 0.08, 0.08, RIVET, 0.42, 0.55, 0.1));
    P.mouth = pivot(body, 0, 1.15, 1.0);
    napkin(body, 1.0, 0.5, 0, 2.18, 0.86, -0.1);

    P.chimneys = [];
    [-1, 1].forEach(function (s) {
      add(body, CS.cyl(0.2, 0.24, 1.2, IRON, s * 0.8, 2.55, -0.55, 12));
      add(body, CS.cyl(0.28, 0.28, 0.12, BRASS_D, s * 0.8, 3.16, -0.55, 12));
      P.chimneys.push(pivot(body, s * 0.8, 3.25, -0.55));
    });

    P.gears = [];
    ['armL', 'armR'].forEach(function (id, i) {
      var s = i ? 1 : -1;
      var gear = pivot(body, s * 1.42, 1.75, 0);
      var wheel = add(gear, CS.cyl(0.52, 0.52, 0.16, BRASS_D, 0, 0, 0, 20)); wheel.rotation.z = Math.PI / 2;
      for (var t = 0; t < 10; t++) {
        var ta = t / 10 * Math.PI * 2;
        add(gear, CS.box(0.18, 0.18, 0.16, BRASS_D, 0, Math.cos(ta) * 0.58, Math.sin(ta) * 0.58)).rotation.x = ta;
      }
      add(gear, CS.ball(0.14, 0.14, 0.14, RIVET, s * 0.1, 0, 0));
      P.gears.push(gear);

      var a = P[id] = pivot(body, s * 1.62, 1.75, 0);
      add(a, CS.ball(0.42, 0.42, 0.42, IRON, 0, 0, 0));
      add(a, CS.cyl(0.28, 0.28, 1.0, BRASS, 0, -0.62, 0, 14));
      add(a, CS.ball(0.3, 0.3, 0.3, IRON, 0, -1.15, 0));
      add(a, CS.cyl(0.33, 0.26, 0.9, BRASS_D, 0, -1.62, 0.02, 14));
      add(a, CS.box(0.5, 0.36, 0.42, IRON, 0, -2.18, 0.05));
      [-0.16, 0, 0.16].forEach(function (x) { add(a, CS.box(0.11, 0.3, 0.11, IRON, x, -2.48, 0.12)); });
      if (i) { var f = fork(a); f.position.set(0, -2.25, 0.18); f.rotation.x = 1.15; f.scale.setScalar(1.1); }
    });

    var head = P.head = pivot(body, 0, 2.38, 0.05);
    add(head, CS.cyl(0.6, 0.64, 0.36, IRON, 0, 0.1, 0, 20));
    add(head, CS.shell(0.62, 0.58, 0.6, BRASS, 0, Math.PI * 2, 0, Math.PI / 2)).position.y = 0.28;
    add(head, new THREE.Mesh(CS.box(0.86, 0.13, 0.06).geometry, P.eyeMat)).position.set(0, 0.42, 0.54);
    add(head, CS.cyl(0.03, 0.03, 0.6, IRON, 0, 1.1, 0, 6));
    add(head, new THREE.Mesh(CS.ball(1, 1, 1).geometry, P.beaconMat)).position.set(0, 1.45, 0);
    head.children[head.children.length - 1].scale.setScalar(0.1);
    return { group: g, parts: P, scale: 1.08, arrive: 'drop', lightColor: 0xff8a3a, lightY: 3.4 };
  }

  /* ============================================================= ROOSTER */
  function rooster() {
    var g = new THREE.Group(), P = {};
    var PLUME = { color: 0x2b2340, rough: 0.4, metal: 0.35 }, PLUME_L = { color: 0x46386a, rough: 0.45, metal: 0.25 };
    var IRID = { color: 0x2f8a5e, rough: 0.3, metal: 0.55 }, COMB = { color: 0xd8283a, rough: 0.5 };
    var BEAK = { color: 0xf0b030, rough: 0.35 }, LEG = { color: 0xc9b26a, rough: 0.6 };
    var CAPE_OUT = { color: 0x1a1422, rough: 0.7, side: true }, CAPE_IN = { color: 0x8a1424, rough: 0.7, side: true };
    var GOLD = { color: 0xf2bf3e, rough: 0.3, metal: 0.85 };
    P.eyeMat = glow(0x7dff6a);

    [-1, 1].forEach(function (s) {
      strut(g, [s * 0.45, 1.2, 0], [s * 0.5, 0.15, 0.1], 0.12, 0.1, LEG);
      [-0.45, 0, 0.45].forEach(function (a) {
        strut(g, [s * 0.5, 0.1, 0.1], [s * 0.5 + Math.sin(a) * 0.5, 0.05, 0.1 + Math.cos(a) * 0.5], 0.06, 0.04, LEG);
      });
      strut(g, [s * 0.5, 0.35, 0.05], [s * 0.5, 0.3, -0.3], 0.05, 0.02, LEG);
    });

    var body = P.body = pivot(g, 0, 1.1, 0);
    add(body, CS.ball(1.15, 1.2, 1.05, PLUME, 0, 1.05, -0.1));
    add(body, CS.ball(0.9, 0.95, 0.72, PLUME_L, 0, 1.2, 0.45));
    var tail = P.tail = pivot(body, 0, 1.3, -0.95);
    for (var i = 0; i < 7; i++) {
      var f = pivot(tail, 0, 0, 0);
      f.rotation.z = (i - 3) * 0.3;
      f.rotation.x = -0.55;
      add(f, CS.ball(0.17, 1.45, 0.07, i % 2 ? IRID : PLUME, 0, 1.25, 0));
      add(f, CS.ball(0.12, 0.3, 0.05, i % 2 ? PLUME_L : IRID, 0, 2.55, 0.02));
    }
    var cape = add(body, CS.shell(1.32, 1.5, 1.2, CAPE_OUT, Math.PI, Math.PI, 0.25, 1.35));
    cape.position.set(0, 1.25, -0.05);
    var lining = add(body, CS.shell(1.26, 1.44, 1.14, CAPE_IN, Math.PI, Math.PI, 0.25, 1.35));
    lining.position.set(0, 1.25, -0.05);
    [-1, 1].forEach(function (s) {
      var c = add(body, CS.cone(0.3, 1.0, CAPE_IN, s * 0.62, 2.4, -0.3, 4));
      c.rotation.z = -s * 0.35; c.rotation.x = -0.2; c.scale.z = 0.25;
    });
    napkin(body, 0.85, 0.65, 0, 2.05, 0.92, -0.4);

    ['armL', 'armR'].forEach(function (id, i) {
      var s = i ? 1 : -1;
      var w = P[id] = pivot(body, s * 1.02, 1.6, -0.05);
      add(w, CS.ball(0.32, 0.85, 0.85, PLUME, 0, -0.38, -0.1));
      for (var k = 0; k < 4; k++) {
        add(w, CS.ball(0.08, 0.42, 0.18, IRID, 0, -1.0 - k * 0.04, 0.3 - k * 0.3));
      }
    });

    add(body, CS.ball(0.55, 0.62, 0.5, PLUME_L, 0, 2.3, 0.25));
    var head = P.head = pivot(body, 0, 2.95, 0.42);
    add(head, CS.ball(0.52, 0.5, 0.5, PLUME, 0, 0, 0));
    [[-0.28, 0.42, 0.16], [-0.1, 0.55, 0.2], [0.08, 0.62, 0.22], [0.25, 0.55, 0.2], [0.4, 0.4, 0.15]].forEach(function (c) {
      add(head, CS.ball(c[2], c[2] * 1.15, 0.1, COMB, 0, c[1], c[0]));
    });
    var crown = add(head, CS.torus(0.32, 0.05, 0, GOLD, 0, 0.38, -0.28)); crown.rotation.x = Math.PI / 2 - 0.3;
    for (var cpt = 0; cpt < 5; cpt++) {
      var ca = cpt / 5 * Math.PI * 2;
      add(head, CS.cone(0.05, 0.16, GOLD, Math.sin(ca) * 0.3, 0.5, -0.28 + Math.cos(ca) * 0.3, 4));
    }
    [-1, 1].forEach(function (s) {
      var e = add(head, new THREE.Mesh(CS.ball(1, 1, 1).geometry, P.eyeMat));
      e.position.set(s * 0.28, 0.12, 0.36); e.scale.set(0.1, 0.09, 0.06);
      var lid = add(head, CS.box(0.22, 0.06, 0.12, PLUME, s * 0.28, 0.22, 0.38)); lid.rotation.z = s * 0.4;
    });
    add(head, CS.torus(0.13, 0.025, 0, GOLD, 0.28, 0.12, 0.43));        // a monocle
    strut(head, [0.4, 0.05, 0.42], [0.55, -0.6, 0.35], 0.01, 0.01, GOLD);
    var beak = add(head, CS.cone(0.17, 0.52, BEAK, 0, -0.02, 0.66, 10)); beak.rotation.x = Math.PI / 2;
    var jaw = P.jaw = pivot(head, 0, -0.1, 0.36);
    var low = add(jaw, CS.cone(0.12, 0.38, BEAK, 0, -0.02, 0.2, 10)); low.rotation.x = Math.PI / 2; low.scale.y = 0.6;
    [-1, 1].forEach(function (s) { add(head, CS.ball(0.1, 0.18, 0.08, COMB, s * 0.08, -0.38, 0.42)); });
    P.mouth = pivot(head, 0, -0.06, 0.8);
    P.eyes = pivot(head, 0, 0.12, 0.42);
    return { group: g, parts: P, scale: 1.14, arrive: 'drop', lightColor: 0x9dff8a, lightY: 3.8 };
  }

  var LOOKS = { ogre: ogre, dragon: dragon, lich: lich, colossus: colossus, rooster: rooster };

  /* ----------------------------------------------------------- the HUD */
  function buildHud() {
    if (hud) return hud;
    var el = document.createElement('div');
    el.id = 'bossHud';
    el.className = 'hidden';
    // the cam is a clear window onto the canvas underneath: the portrait is
    // drawn there, so only the meter below it gets a panel's background
    el.innerHTML = '<div class="bcam"></div><div class="binfo panel"><div class="bname"></div>' +
      '<div class="bmeter"><i></i></div><div class="bcount"></div></div>';
    document.getElementById('hud').appendChild(el);
    hud = { el: el, cam: el.querySelector('.bcam'), name: el.querySelector('.bname'), fill: el.querySelector('.bmeter i'),
      count: el.querySelector('.bcount'), meter: el.querySelector('.bmeter') };
    return hud;
  }

  function showHud() {
    var h = buildHud();
    if (!B) { h.el.classList.add('hidden'); return; }
    h.el.classList.remove('hidden');
    h.name.textContent = B.def.fullName.toUpperCase() + ' · HUNGER';
    h.el.style.setProperty('--boss', B.def.css);
    var f = B.fed / B.need;
    h.fill.style.width = (Math.min(1, f) * 100).toFixed(1) + '%';
    h.count.textContent = B.full ? 'FULL!' : B.fed + ' / ' + B.need + ' COURSES';
  }

  function bumpHud(cls) {
    if (!hud) return;
    hud.el.classList.remove('fed', 'angry');
    void hud.el.offsetWidth;          // restart the animation
    hud.el.classList.add(cls);
  }

  /* --------------------------------------------------------- reactions */
  function say(lines, kind) {
    if (!lines || !lines.length) return;
    CS.ui.toast(B.def.name.toUpperCase() + ': "' + CS.pick(lines) + '"', kind);
  }

  function setState(s, dur) { B.state = s; B.st = 0; B.dur = dur || 0; }

  function worldOf(obj) { return obj.getWorldPosition(new THREE.Vector3()); }

  /* A burst of big soft puffs: dust on landing, smoke, fire, wisps. */
  function cloud(x, y, z, n, o) {
    for (var i = 0; i < n; i++) {
      CS.steam.puff(x + (Math.random() - 0.5) * (o.spread || 1), y + Math.random() * (o.lift || 0.3),
        z + (Math.random() - 0.5) * (o.spread || 1),
        { color: o.color, size: o.size || 0.8, life: o.life || 1.4, rise: o.rise == null ? 0.6 : o.rise,
          opacity: o.opacity || 0.7, grow: o.grow || 2.2, drift: 0.4 });
    }
  }

  function landed() {
    var p = B.g.position;
    B.shake = Math.max(B.shake, 1.0);
    cloud(p.x, 0.2, p.z + 0.6, 14, { color: 0xb8a68a, size: 1.0, spread: 4.5, life: 1.6, rise: 0.4 });
    CS.audio.bossStomp();
    setTimeout(function () { if (B) { CS.audio.bossRoar(B.def.look); setState('roar', 1.6); B.shake = Math.max(B.shake, 0.6); } }, 380);
  }

  /* ------------------------------------------------------------ module */
  CS.bosses = {
    init: function (sc, opts) {
      scene = sc;
      // one light for whichever boss is in, made once and never removed:
      // adding or taking away a light recompiles every material in the scene
      if (!(opts && opts.lowSpec)) {
        light = new THREE.PointLight(0xffffff, 0, 14, 2);
        scene.add(light);
      }
    },

    /* Bring the boss for a boss day in. It arrives at once, during the
       reveal on the day card, so you meet it before you have to feed it. */
    spawn: function (def) {
      CS.bosses.clear();
      var m = LOOKS[def.look]();
      CS.bake(m.group);
      var root = new THREE.Group();
      root.add(m.group);
      m.group.scale.setScalar(m.scale);
      var shadow = CS.models.blobShadow();
      shadow.scale.set(5.5, 1, 4.2);
      shadow.position.y = 0.02;
      root.add(shadow);
      CS.noMirror(root);
      // layer 2 is the boss cam's: it sees the boss and nothing else, lit by
      // the same lights as the kitchen so it looks the same in both
      root.traverse(function (o) { o.layers.enable(2); });
      scene.traverse(function (o) { if (o.isLight) o.layers.enable(2); });
      var top = new THREE.Box3().setFromObject(m.group).max.y;
      var x = CS.DOOR_X, z = CS.OZ - 5.0;
      root.position.set(x, 0, z);
      scene.add(root);
      B = {
        def: def, g: root, model: m.group, m: m, parts: m.parts, shadow: shadow,
        state: 'arrive', st: 0, dur: 0, t: 0, y: 0, vy: 0,
        fed: 0, need: def.courses, full: false, shake: 0, top: top,
        yaw: 0, jaw: 0, glareT: def.glare ? 9 : 0, impatient: 0
      };
      // where it starts from depends on how it travels
      if (m.arrive === 'rise') B.y = -6.5;
      else B.y = m.arrive === 'fly' ? 13 : 16;
      m.group.position.y = B.y;
      if (light) { light.color.copy(CS.linear(m.lightColor)); light.position.set(x, m.lightY, z + 1.6); }
      showHud();
    },

    clear: function () {
      if (B) { scene.remove(B.g); CS.dispose(B.g); }
      B = null;
      flights.forEach(function (f) { scene.remove(f.m); CS.dispose(f.m); });
      flights.length = 0;
      CS.bosses.unstone();
      beams.forEach(function (b) { scene.remove(b.m); });
      beams.length = 0;
      if (light) light.intensity = 0;
      cine.on = false;
      showHud();
    },

    active: function () { return !!B; },
    boss: function () { return B ? B.def : null; },
    full: function () { return !!(B && B.full); },
    fed: function () { return B ? B.fed : 0; },
    need: function () { return B ? B.need : 0; },

    /* How many more courses the rail may ask for: plates already flying
       through the window count as eaten. */
    remaining: function () { return B ? B.need - B.fed - flights.length : 0; },

    ordered: function () {
      if (B && B.state === 'idle' && Math.random() < 0.5) { setState('point', 0.9); }
    },

    /* A course went out of the window: the plate arcs over the counter and
       into the boss's mouth, and only counts once it lands. */
    feed: function (order, plate, from) {
      if (!B) return;
      var m = CS.models.item(plate);
      m.scale.setScalar(1.6);
      CS.noMirror(m);
      var a = from ? new THREE.Vector3(from.x, from.topY + 0.5, from.z) : worldOf(B.parts.mouth);
      m.position.copy(a);
      scene.add(m);
      flights.push({ m: m, a: a, t: 0, dur: 0.75 });
      if (B.state === 'idle' || B.state === 'point') setState('gape', 0.75);
    },

    /* A course went cold on the rail. */
    anger: function () {
      if (!B || B.full) return;
      B.fed = Math.max(0, B.fed - 1);
      setState('roar', 1.6);
      B.shake = Math.max(B.shake, 0.85);
      CS.audio.bossRoar(B.def.look);
      say(B.def.roars, 'bad');
      bumpHud('angry');
      showHud();
    },

    /* The camera for the reveal (on the day card) and the victory lap: a
       slow sway in front of the boss from high in the kitchen, looking up
       at it over the back wall. null when the normal cameras are in charge. */
    showcase: function (on) { cine.on = !!on && !!B; },

    /* Closing time and it is still hungry. */
    sulk: function () { if (B && !B.full) { setState('sulk'); CS.audio.bossRoar(B.def.look); } },

    /* Framed so the whole boss sits in the top half of the screen, clear of
       the card along the bottom: high enough that its feet just show over
       the kitchen's back wall, looking down past them. */
    cinematic: function (time) {
      if (!cine.on || !B) return null;
      var p = B.g.position, a = Math.sin(time * 0.3) * 0.32;
      var r = 19;
      return {
        x: p.x + Math.sin(a) * r, y: 8.5, z: p.z + Math.cos(a) * r,
        lx: p.x, ly: -2.0, lz: p.z
      };
    },

    /* How hard to shake the camera this frame. */
    shake: function () { return B ? B.shake : 0; },

    /* The boss cam in the hunger panel: from the play camera the boss is
       behind the kitchen's back wall, so the HUD carries a live portrait of
       its head and shoulders -- chomping, roaring, glaring -- drawn by
       game.js with a camera that sees only layer 2. */
    portrait: function () {
      if (!B || !hud || hud.el.classList.contains('hidden')) return null;
      var p = B.g.position, ly = B.top - 1.7 + Math.max(0, B.model.position.y);
      return { el: hud.cam, x: p.x, y: ly + 0.35, z: p.z + 8.5, lx: p.x, ly: ly, lz: p.z };
    },

    isStoned: function (st) { return !!st.stoned; },

    unstone: function () {
      stones.forEach(function (s) { s.st.stoned = 0; scene.remove(s.m); });
      stones.length = 0;
    },

    /* `ctx`: stations, the chef (player), and whether the shift is running.
       Runs every frame, behind menus too, so the boss is alive on the day
       card and the result screen. */
    update: function (dt, ctx) {
      updateBeams(dt);
      if (!B) return;
      B.t += dt; B.st += dt;
      B.shake = Math.max(0, B.shake - dt * 1.8);
      var P = B.parts, def = B.def, m = B.m;

      /* ---- arriving ---- */
      if (B.state === 'arrive') {
        if (m.arrive === 'rise') {
          B.y = Math.min(0, B.y + dt * 4.2);
          if (Math.random() < dt * 30) cloud(B.g.position.x, 0.1, B.g.position.z, 1, { color: 0x6ff0ff, size: 0.9, spread: 3, opacity: 0.5, rise: 1.4 });
          if (B.y >= 0) { B.y = 0; B.shake = 0.5; CS.audio.bossRoar(def.look); setState('roar', 1.6); }
        } else {
          var gr = m.arrive === 'fly' ? 9 : 34;
          B.vy -= gr * dt;
          if (m.arrive === 'fly') B.vy = Math.max(B.vy, -7);       // wings out, coming in to land
          B.y += B.vy * dt;
          if (B.y <= 0) { B.y = 0; B.vy = 0; setState('idle'); landed(); }
        }
      } else if (B.dur && B.st >= B.dur) {
        setState(B.full ? 'happy' : 'idle');
      }

      /* ---- watching the chef: the head turns to follow her round the kitchen ---- */
      var want = 0;
      if (ctx.player) {
        want = Math.atan2(ctx.player.x - B.g.position.x, ctx.player.z - B.g.position.z);
        want = CS.clamp(want, -0.75, 0.75);
      }
      if (B.state === 'happy') want = Math.sin(B.t * 2) * 0.5;
      if (B.state === 'sulk') want = -0.55;
      B.yaw += (want - B.yaw) * Math.min(1, dt * 2.5);
      P.head.rotation.y = B.yaw;
      P.head.rotation.x = 0.18 + (B.state === 'roar' ? -0.35 : 0);

      /* ---- breathing ---- */
      var br = Math.sin(B.t * 1.6);
      P.body.scale.set(1 - br * 0.012, 1 + br * 0.022, 1 - br * 0.012);

      /* ---- impatience: a course on the rail is about to go cold ---- */
      var urgent = 0;
      CS.orders.list.forEach(function (o) { if (o.boss && o.left / o.limit < 0.3) urgent = 1; });
      B.impatient += (urgent - B.impatient) * Math.min(1, dt * 3);

      /* ---- jaw, arms and the whole body, by state ---- */
      var jaw = 0.04 + Math.max(0, Math.sin(B.t * 0.7)) * 0.04;
      var lx = Math.sin(B.t * 1.1) * 0.08, rx = -Math.sin(B.t * 1.1) * 0.08;
      var lz = -0.12, rz = 0.12, bounce = 0, spin = 0;
      if (B.impatient > 0.1 && B.state === 'idle') {
        // drumming on its belly, glaring at the window
        rx = -0.9 - Math.abs(Math.sin(B.t * 7)) * 0.5 * B.impatient;
        lx = -0.9 - Math.abs(Math.cos(B.t * 7)) * 0.5 * B.impatient;
      }
      switch (B.state) {
        case 'arrive':
          lx = rx = -2.2; lz = -0.6; rz = 0.6;
          break;
        case 'point':
          rx = -1.6 + Math.sin(B.st * 8) * 0.1;
          break;
        case 'gape':
          jaw = 0.65; lx = rx = -1.2;
          break;
        case 'eat':
          jaw = Math.abs(Math.sin(B.st * 15)) * 0.55;
          lx = -1.4 - Math.sin(B.st * 15) * 0.2; rx = -1.4 + Math.sin(B.st * 15) * 0.2;
          bounce = Math.abs(Math.sin(B.st * 7.5)) * 0.08;
          break;
        case 'roar':
          var k = Math.min(1, B.st * 5) * Math.min(1, (B.dur - B.st) * 3);
          jaw = 0.9 * k; lx = rx = -2.5 * k; lz = -0.7 * k; rz = 0.7 * k;
          if (Math.random() < dt * 14) {
            var mp = worldOf(P.mouth);
            if (def.look === 'dragon') {
              cloud(mp.x, mp.y + 0.2, mp.z + 0.4, 1, { color: CS.pick([0xff7a1e, 0xffb23a, 0xff4a1a]), size: 0.6, spread: 0.5, rise: 3.2, life: 0.9, opacity: 0.9 });
            } else if (def.look === 'colossus') {
              P.chimneys.forEach(function (c) { var w = worldOf(c); cloud(w.x, w.y, w.z, 1, { color: 0xe8e4dc, size: 0.7, spread: 0.3, rise: 2.4 }); });
            } else {
              cloud(mp.x, mp.y, mp.z + 0.3, 1, { color: def.look === 'lich' ? 0x6ff0ff : 0xf4efe4, size: 0.4, spread: 0.6, rise: 1.6, life: 0.7, opacity: 0.45 });
            }
          }
          break;
        case 'sulk':
          // arms folded, looking away: it is not leaving, and it is not impressed
          lx = rx = -1.35; lz = 0.55; rz = -0.55; jaw = 0.02;
          break;
        case 'glare':
          jaw = 0.2; P.head.rotation.x = 0.3;
          break;
        case 'happy':
          bounce = Math.abs(Math.sin(B.st * 5)) * 0.45;
          lx = rx = -2.6 + Math.sin(B.st * 10) * 0.3; lz = -0.5; rz = 0.5;
          jaw = 0.35 + Math.sin(B.st * 10) * 0.2;
          spin = Math.sin(B.st * 2.5) * 0.25;
          if (Math.random() < dt * 8) {
            var hp = B.g.position;
            CS.fx.burst(hp.x + (Math.random() - 0.5) * 4, 4 + Math.random() * 2, hp.z + 1, 3,
              { color: CS.pick([0xffd464, 0xff9db2, 0xfff2c8]), life: 1.2, vy: 2.5, g: -2 });
          }
          break;
      }
      B.jaw += (jaw - B.jaw) * Math.min(1, dt * 14);
      P.jaw.rotation.x = B.jaw;
      function ease(o, k, v) { o.rotation[k] += (v - o.rotation[k]) * Math.min(1, dt * 9); }
      var pose = m.pose || {};
      ease(P.armL, 'x', lx + (pose.lx || 0)); ease(P.armR, 'x', rx + (pose.rx || 0));
      ease(P.armL, 'z', lz + (pose.lz || 0)); ease(P.armR, 'z', rz + (pose.rz || 0));

      var hover = m.float ? 0.25 + Math.sin(B.t * 1.4) * 0.18 : 0;
      B.model.position.y = B.y + bounce + hover;
      B.model.rotation.y = spin;
      var sh = Math.max(0.25, 1 - Math.max(0, B.y + hover) / 12);
      B.shadow.scale.set(5.5 * sh, 1, 4.2 * sh);

      /* ---- the look's own details ---- */
      var eyeK = 0.85 + Math.sin(B.t * 3) * 0.15;
      if (def.look === 'dragon') {
        var flap = B.state === 'arrive' ? Math.sin(B.t * 9) * 0.7 : (B.state === 'roar' || B.state === 'happy' ? Math.sin(B.t * 6) * 0.45 : Math.sin(B.t * 0.9) * 0.08);
        P.wingL.rotation.z = -0.15 + flap; P.wingR.rotation.z = 0.15 - flap;
        P.wingL.rotation.y = 0.35; P.wingR.rotation.y = -0.35;
        P.tail.rotation.y = Math.sin(B.t * 0.8) * 0.12;
        if (Math.random() < dt * 1.2) {
          var n = worldOf(P.nose);
          cloud(n.x, n.y, n.z, 1, { color: 0x4a4048, size: 0.35, spread: 0.2, rise: 1.0, life: 1.6, opacity: 0.5 });
        }
      } else if (def.look === 'lich') {
        P.lantern.rotation.z = Math.sin(B.t * 1.3) * 0.12;
        var fl = 0.8 + Math.sin(B.t * 11) * 0.1 + Math.sin(B.t * 17) * 0.1;
        P.lampMat.color.copy(CS.linear(0x9ff8ff)).multiplyScalar(fl);
        if (Math.random() < dt * 3) {
          var lp = worldOf(P.lantern);
          CS.fx.spawn(lp.x, lp.y, lp.z, { color: 0x6ff0ff, life: 1.4, vy: 0.6, g: 0.3 });
        }
        if (light) light.intensity = 0.9 * fl;
      } else if (def.look === 'colossus') {
        P.gears[0].rotation.x += dt * 1.6; P.gears[1].rotation.x -= dt * 1.6;
        P.beaconMat.color.setRGB(Math.sin(B.t * 4) > 0 ? 1 : 0.15, 0.05, 0.05);
        P.fireMat.color.copy(CS.linear(0xff6a1a)).multiplyScalar(0.75 + Math.sin(B.t * 5) * 0.25);
        if (Math.random() < dt * 2.5) {
          var c = worldOf(CS.pick(P.chimneys));
          cloud(c.x, c.y, c.z, 1, { color: 0xd8d4cc, size: 0.5, spread: 0.2, rise: 1.4, life: 1.8, opacity: 0.6 });
        }
      } else if (def.look === 'rooster') {
        P.tail.rotation.y = Math.sin(B.t * 0.7) * 0.1;
        if (B.state === 'glare') eyeK = 2.2;
      }
      P.eyeMat.color.copy(CS.linear(def.look === 'rooster' ? 0x7dff6a : def.look === 'lich' ? 0x6ff0ff : def.look === 'dragon' ? 0xffb21e : def.look === 'colossus' ? 0xff9a3a : 0xffe27a)).multiplyScalar(eyeK);
      if (light && def.look !== 'lich') light.intensity = B.state === 'roar' ? 1.4 : 0.55;

      /* ---- courses flying in through the window ---- */
      for (var i = flights.length - 1; i >= 0; i--) {
        var f = flights[i];
        f.t += dt;
        var u = Math.min(1, f.t / f.dur), to = worldOf(P.mouth);
        f.m.position.lerpVectors(f.a, to, u);
        f.m.position.y += Math.sin(u * Math.PI) * 2.6;
        f.m.rotation.y += dt * 9;
        f.m.scale.setScalar(1.6 * (1 - u * 0.55));
        if (u >= 1) {
          scene.remove(f.m); CS.dispose(f.m);
          flights.splice(i, 1);
          B.fed++;
          CS.fx.burst(to.x, to.y, to.z + 0.3, 14, { color: CS.pick([0xf0b53c, 0xd99a4e, 0x6fbf3a]), life: 0.7, vy: 1.6 });
          CS.audio.bossChomp();
          if (B.fed >= B.need) {
            B.full = true;
            setState('happy');
            CS.audio.bossRoar(def.look);
            B.shake = 0.5;
          } else {
            setState('eat', 1.1);
            if (Math.random() < 0.6) say(def.cheers, 'tip');
          }
          bumpHud('fed');
          showHud();
        }
      }

      /* ---- the Shadow Rooster's stone glare ---- */
      if (def.glare && ctx.playing && !B.full && B.state !== 'arrive') {
        B.glareT -= dt;
        if (B.glareT <= 0) {
          B.glareT = def.glare.every * (0.85 + Math.random() * 0.3);
          glare(ctx.stations);
        }
      }
      for (var s = stones.length - 1; s >= 0; s--) {
        var stn = stones[s];
        stn.st.stoned -= dt;
        // the stone shivers as it is about to crack
        stn.m.position.x = stn.st.x + (stn.st.stoned < 1.2 ? Math.sin(B.t * 60) * 0.03 : 0);
        if (stn.st.stoned <= 0 || !ctx.playing) {
          stn.st.stoned = 0;
          scene.remove(stn.m);
          CS.fx.burst(stn.st.x, stn.st.topY + 0.3, stn.st.z, 16, { color: 0x9a948c, life: 0.7, vy: 2.0 });
          CS.audio.stoneCrack();
          stones.splice(s, 1);
        }
      }
    }
  };

  /* Turn one station to stone: never the window or the bin, and never a
     fryer with something in it -- burning a basket you could not reach
     would be cruel, not hard. */
  var GLARE_TYPES = ['counter', 'crate', 'plates', 'buns', 'topping', 'sauce', 'cups', 'fryer'];
  function glare(stations) {
    var pick = stations.filter(function (st) {
      if (GLARE_TYPES.indexOf(st.type) < 0 || st.stoned) return false;
      if (st.type === 'fryer' && (st.item || st.cook)) return false;
      return true;
    });
    if (!pick.length) return;
    var st = CS.pick(pick);
    setState('glare', 0.9);
    CS.audio.glare();
    var eye = worldOf(B.parts.eyes || B.parts.mouth);
    var to = new THREE.Vector3(st.x, st.topY + 0.3, st.z);
    var dir = to.clone().sub(eye), len = dir.length();
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, len, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: CS.linear(0x7dff6a), transparent: true, opacity: 0.85, depthWrite: false }));
    beam.position.copy(eye).add(to).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(UP, dir.normalize());
    CS.noMirror(beam);
    scene.add(beam);
    beams.push({ m: beam, t: 0 });

    var h = Math.max(0.6, st.topY + 0.12);
    var rock = CS.box(CS.TILE * 0.98, h, CS.TILE * 0.98, { color: 0x8f8a85, rough: 1.0, opacity: 0.88 }, st.x, h / 2, st.z);
    rock.castShadow = false;
    scene.add(rock);
    st.stoned = B.def.glare.dur;
    stones.push({ st: st, m: rock });
    CS.fx.burst(st.x, st.topY + 0.4, st.z, 18, { color: 0x7dff6a, life: 0.6, vy: 2.2 });
    var nm = st.def && st.def.name ? st.def.name : st.type;
    CS.ui.toast(B.def.name.toUpperCase() + ' TURNED THE ' + nm.toUpperCase() + ' TO STONE!', 'bad');
  }

  function updateBeams(dt) {
    for (var i = beams.length - 1; i >= 0; i--) {
      var b = beams[i];
      b.t += dt;
      b.m.material.opacity = Math.max(0, 0.85 * (1 - b.t / 0.6));
      if (b.t >= 0.6) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); beams.splice(i, 1); }
    }
  }
})(window.CS);
