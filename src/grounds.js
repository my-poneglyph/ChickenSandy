/* The castle grounds around the shop.

   The kitchen and dining room used to float in a dark void, which a phone's
   tall screen shows a lot of. Out here is a lawn with a cobbled path running
   round the building, hedges and lamp posts against the walls, market stalls,
   a fountain, trees, and the castle's own curtain wall and keep in the
   distance -- and a handful of off-duty customers strolling the path.

   Built ONCE, outside the kitchen's root group, because none of it depends on
   what you have bought: everything sits outside the full CS.MAP_W x MAP_H
   grid, so buying a wing never puts the shop on top of a tree.

   Kept cheap enough for a phone:
     * every static piece is baked into a few merged meshes -- one for plain
       painted things, one for stonework, one for glowing lamps -- so the
       whole landscape is about a dozen draw calls;
     * the strollers are the real customer models with each limb's meshes
       baked together, ~10 draw calls apiece instead of ~40, and there are
       fewer of them on a phone;
     * all of it lives on layer 1 (CS.noMirror), so it is skipped by the
       floor reflection and by the shadow pass.                            */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var T = CS.TILE;
  var root = null;
  var walkers = [];
  var pts = [], segs = [], loopLen = 0;

  /* The full grid -- owned or not -- and the dining room north of it. */
  var X1 = CS.OX + CS.MAP_W * T;          // the map is centred, so X0 = -X1
  var Z0 = CS.OZ, Z1 = CS.OZ + CS.MAP_H * T;

  /* The path loop, clockwise seen from above, starting at the south-west
     corner. It hugs the kitchen's sides, then jogs out round the dining
     room's back corners and passes behind the porch. */
  var PS = Z1 + 3.2, PE = X1 + 3.5, PEO = X1 + 8, PJ = Z0 + 1, PJ2 = Z0 - 2, PN = Z0 - 15;
  var PATH_W = 2.3;

  function hash(n) { var s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }
  function tint(mesh, hex) { mesh.userData.tint = CS.linear(hex); return mesh; }

  var MAT = {};
  function mats() {
    if (MAT.paint) return MAT;
    // a shade under full brightness, so the lit kitchen is what the eye goes to
    MAT.paint = CS.mat({ color: 0xdcdcdc, rough: 0.82, vc: true });
    MAT.stone = CS.mat({ color: 0xcfcfcf, tex: 'grain', rough: 0.88, vc: true });
    MAT.glow = CS.mat({ color: 0xffd27a, basic: true });
    return MAT;
  }

  /* ------------------------------------------------------------- pieces
     Each helper pushes loose meshes into one of three buckets; build()
     merges each bucket into a single mesh at the end. */
  var P, S, G;      // paint, stone, glow buckets

  function tree(x, z, s) {
    s = s || 1;
    P.push(tint(CS.cyl(0.16 * s, 0.24 * s, 1.5 * s, {}, x, 0.75 * s, z, 8), 0x7a5232));
    var greens = [0x4f8a34, 0x5c9a3c, 0x447a2e];
    [[0, 2.1, 0, 1.0], [0.55, 1.75, 0.2, 0.75], [-0.5, 1.8, -0.15, 0.8], [0.05, 2.65, -0.1, 0.7]]
      .forEach(function (b, i) {
        P.push(tint(CS.ball(b[3] * s, b[3] * 0.9 * s, b[3] * s, {}, x + b[0] * s, b[1] * s, z + b[2] * s),
          greens[(i + Math.floor(hash(x * 3 + z) * 3)) % 3]));
      });
  }

  function pine(x, z, s) {
    s = s || 1;
    P.push(tint(CS.cyl(0.13 * s, 0.18 * s, 0.9 * s, {}, x, 0.45 * s, z, 8), 0x6a4428));
    [[1.1, 1.3, 1.2], [0.85, 1.1, 2.0], [0.55, 0.9, 2.7]].forEach(function (c) {
      P.push(tint(CS.cone(c[0] * s, c[1] * s, {}, x, c[2] * s, z, 9), 0x3f6e3a));
    });
  }

  function bush(x, z, s) {
    s = s || 1;
    var c = [0x5a9640, 0x4c8436, 0x66a648][Math.floor(hash(x * 7.3 + z * 1.7) * 3)];
    P.push(tint(CS.ball(0.62 * s, 0.48 * s, 0.55 * s, {}, x, 0.36 * s, z), c));
    P.push(tint(CS.ball(0.4 * s, 0.34 * s, 0.4 * s, {}, x + 0.42 * s, 0.28 * s, z + 0.1), c));
  }

  /* A little raised bed of flowers. */
  function flowerBed(x, z, w, d, alongX) {
    var bw = alongX ? w : d, bd = alongX ? d : w;
    S.push(tint(CS.box(bw, 0.24, bd, { round: 0.05 }, x, 0.12, z), 0x9e968c));
    P.push(tint(CS.box(bw - 0.2, 0.06, bd - 0.2, { round: 0 }, x, 0.25, z), 0x5a3e2a));
    var cols = [0xe8546a, 0xf3c33c, 0xffffff, 0xb07ae0, 0xff8a3c];
    var n = Math.round(Math.max(bw, bd) * 2.2);
    for (var i = 0; i < n; i++) {
      var f = (i + 0.5) / n - 0.5;
      var fx = x + (alongX ? f * (bw - 0.4) : (hash(i + x) - 0.5) * (bw - 0.4));
      var fz = z + (alongX ? (hash(i + z) - 0.5) * (bd - 0.4) : f * (bd - 0.4));
      P.push(tint(CS.ball(0.12, 0.12, 0.12, {}, fx, 0.4, fz), 0x4f8a34));
      P.push(tint(CS.ball(0.09, 0.07, 0.09, {}, fx, 0.52, fz), cols[i % cols.length]));
    }
  }

  function lampPost(x, z) {
    P.push(tint(CS.cyl(0.07, 0.1, 2.6, {}, x, 1.3, z, 8), 0x2c2a30));
    P.push(tint(CS.cyl(0.22, 0.26, 0.12, {}, x, 0.06, z, 8), 0x2c2a30));
    P.push(tint(CS.cone(0.26, 0.2, {}, x, 2.98, z, 6), 0x2c2a30));
    G.push(CS.ball(0.17, 0.2, 0.17, {}, x, 2.75, z));
  }

  function bench(x, z, rotY) {
    var g = new THREE.Group();
    g.add(tint(CS.box(1.5, 0.1, 0.45, {}, 0, 0.46, 0), 0x9a6a3c));
    g.add(tint(CS.box(1.5, 0.35, 0.08, {}, 0, 0.75, -0.2), 0x9a6a3c));
    [-0.6, 0.6].forEach(function (lx) { g.add(tint(CS.box(0.1, 0.46, 0.4, {}, lx, 0.23, 0), 0x2c2a30)); });
    flatten(g, x, z, rotY, P);
  }

  /* Bake a small group's children into a bucket at a world position. */
  function flatten(g, x, z, rotY, bucket) {
    g.position.set(x, 0, z);
    g.rotation.y = rotY || 0;
    g.updateMatrixWorld(true);
    g.children.slice().forEach(function (m) {
      m.matrix.copy(m.matrixWorld);
      m.matrix.decompose(m.position, m.quaternion, m.scale);
      bucket.push(m);
    });
  }

  /* A market stall with a striped awning and a counter of produce. */
  function stall(x, z, rotY, stripe) {
    var g = new THREE.Group();
    [[-1.3, -0.7], [1.3, -0.7], [-1.3, 0.7], [1.3, 0.7]].forEach(function (p) {
      g.add(tint(CS.box(0.14, 2.3, 0.14, {}, p[0], 1.15, p[1]), 0x7a5232));
    });
    g.add(tint(CS.box(2.8, 0.9, 1.0, {}, 0, 0.45, 0.4), 0x9a6a3c));
    for (var i = 0; i < 6; i++) {
      var slat = tint(CS.box(0.48, 0.08, 1.9, { round: 0.02 }, -1.2 + i * 0.48, 2.35, 0.1),
        i % 2 ? 0xfaf3e6 : stripe);
      slat.rotation.x = 0.18;
      g.add(slat);
    }
    var fruit = [0xd6402f, 0xf3c33c, 0x6fbf3a, 0xe8892a];
    for (var k = 0; k < 9; k++) {
      g.add(tint(CS.ball(0.13, 0.13, 0.13, {}, -1.0 + (k % 9) * 0.25, 0.98, 0.25 + (k % 2) * 0.2),
        fruit[k % fruit.length]));
    }
    flatten(g, x, z, rotY, P);
  }

  function hay(x, z) {
    var h = CS.cyl(0.55, 0.55, 1.0, {}, x, 0.55, z, 14);
    h.rotation.z = Math.PI / 2;
    P.push(tint(h, 0xe0c060));
  }

  function well(x, z) {
    S.push(tint(CS.cyl(0.9, 0.95, 0.8, {}, x, 0.4, z, 16), 0xa9a4a0));
    P.push(tint(CS.cyl(0.75, 0.75, 0.05, {}, x, 0.78, z, 16), 0x2f5a7a));
    [-0.8, 0.8].forEach(function (o) { P.push(tint(CS.box(0.12, 1.8, 0.12, {}, x + o, 1.3, z), 0x7a5232)); });
    var roof = CS.cone(1.2, 0.7, {}, x, 2.45, z, 4);
    roof.rotation.y = Math.PI / 4;
    P.push(tint(roof, 0xb5482f));
  }

  function fountain(x, z) {
    S.push(tint(CS.cyl(2.0, 2.1, 0.55, {}, x, 0.27, z, 24), 0xb3aea8));
    P.push(tint(CS.cyl(1.8, 1.8, 0.06, {}, x, 0.5, z, 24), 0x4a8ec0));
    S.push(tint(CS.cyl(0.25, 0.32, 1.0, {}, x, 0.9, z, 12), 0xa9a4a0));
    S.push(tint(CS.cyl(0.7, 0.4, 0.2, {}, x, 1.4, z, 16), 0xb3aea8));
    P.push(tint(CS.cyl(0.6, 0.6, 0.04, {}, x, 1.5, z, 16), 0x5aa0d0));
    P.push(tint(CS.ball(0.14, 0.3, 0.14, {}, x, 1.7, z), 0x9fd0f0));
  }

  /* A run of curtain wall from (x0,z0) to (x1,z1), with a walkway lip and
     merlons along the top. Thick and plain: from in here it is scenery. */
  function curtain(x0, z0, x1, z1) {
    var dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    var ux = dx / len, uz = dz / len, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rot = Math.atan2(-dz, dx);
    var H = 4.2;
    var w = CS.box(len, H, 1.6, { round: 0 }, cx, H / 2, cz);
    w.rotation.y = rot;
    S.push(tint(w, 0xa9a4a0));
    var lip = CS.box(len, 0.25, 1.9, { round: 0.04 }, cx, H, cz);
    lip.rotation.y = rot;
    S.push(tint(lip, 0xc4beb5));
    var n = Math.floor(len / 1.4);
    for (var i = 0; i < n; i++) {
      var f = (i + 0.5) / n * len - len / 2;
      var m = CS.box(0.7, 0.7, 1.6, { round: 0.04 }, cx + ux * f, H + 0.45, cz + uz * f);
      m.rotation.y = rot;
      S.push(tint(m, [0xb3aea8, 0xa8a39d, 0xbcb6ae][i % 3]));
    }
  }

  function tower(x, z, r, h, roof) {
    S.push(tint(CS.cyl(r, r * 1.08, h, {}, x, h / 2, z, 18), 0xb0aba5));
    S.push(tint(CS.cyl(r * 1.15, r * 1.15, 0.4, {}, x, h + 0.2, z, 18), 0xc4beb5));
    P.push(tint(CS.cone(r * 1.25, r * 1.6, {}, x, h + 0.4 + r * 0.8, z, 18), roof));
    P.push(tint(CS.cyl(0.03, 0.03, 1.2, {}, x, h + 0.4 + r * 1.6 + 0.5, z, 6), 0x2c2a30));
    var flag = CS.box(0.7, 0.4, 0.04, { round: 0 }, x + 0.36, h + 0.4 + r * 1.6 + 0.9, z);
    P.push(tint(flag, 0x2f4f96));
    // a couple of glowing windows
    G.push(CS.box(0.35, 0.6, 0.1, { round: 0 }, x, h * 0.62, z + r * 1.02));
    G.push(CS.box(0.35, 0.6, 0.1, { round: 0 }, x + r * 0.7, h * 0.4, z + r * 0.74));
  }

  /* ------------------------------------------------------- the plots
     Land you have not bought yet is the lawn inside the map's edge. Rather
     than leave it bare, each plot gets dressed -- a vegetable garden where
     the Back Room will go, a little orchard where the East Wing will -- and
     sync() hides a plot's dressing the moment the land is yours. Each plot
     is its own merged mesh, so hiding one is a single `visible` flip. */
  var plots = [];

  function cabbage(x, z) {
    P.push(tint(CS.ball(0.32, 0.26, 0.32, {}, x, 0.24, z), 0x7fbf4a));
    P.push(tint(CS.ball(0.22, 0.2, 0.22, {}, x, 0.34, z), 0xa6d66e));
  }
  function carrot(x, z) {
    P.push(tint(CS.ball(0.09, 0.05, 0.09, {}, x, 0.14, z), 0xe8892a));
    [-0.05, 0.05].forEach(function (o) {
      P.push(tint(CS.ball(0.04, 0.16, 0.04, {}, x + o, 0.3, z), 0x4f9a2e));
    });
  }
  function pumpkin(x, z, s) {
    P.push(tint(CS.ball(0.42 * s, 0.32 * s, 0.42 * s, {}, x, 0.3 * s, z), 0xe8842a));
    P.push(tint(CS.cyl(0.04, 0.05, 0.16, {}, x, 0.66 * s, z, 6), 0x5a7a2a));
  }
  function fence(x0, z0, x1, z1) {
    var len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.1));
    var rot = Math.atan2(-(z1 - z0), x1 - x0);
    for (var i = 0; i <= n; i++) {
      var f = i / n;
      P.push(tint(CS.box(0.14, 0.8, 0.14, {}, x0 + (x1 - x0) * f, 0.4, z0 + (z1 - z0) * f), 0xe8dcc4));
    }
    [0.3, 0.6].forEach(function (y) {
      var rail = CS.box(len, 0.08, 0.06, { round: 0 }, (x0 + x1) / 2, y, (z0 + z1) / 2);
      rail.rotation.y = rot;
      P.push(tint(rail, 0xe8dcc4));
    });
  }
  function scarecrow(x, z) {
    P.push(tint(CS.box(0.1, 1.9, 0.1, {}, x, 0.95, z), 0x7a5232));
    P.push(tint(CS.box(1.3, 0.1, 0.1, {}, x, 1.45, z), 0x7a5232));
    P.push(tint(CS.ball(0.32, 0.36, 0.22, {}, x, 1.3, z), 0x3f6ea8));
    P.push(tint(CS.ball(0.22, 0.22, 0.22, {}, x, 1.9, z), 0xe8d4a0));
    P.push(tint(CS.cyl(0.42, 0.42, 0.04, {}, x, 2.08, z, 14), 0xd4b25a));
    P.push(tint(CS.cone(0.2, 0.32, {}, x, 2.26, z, 10), 0xd4b25a));
  }

  /* `test(bounds)` says whether the plot is still unbought. */
  function plot(test, dress) {
    var keep = P;
    P = [];
    dress();
    var m = CS.merge(P, MAT.paint);
    m.castShadow = false;
    root.add(m);
    plots.push({ mesh: m, test: test });
    P = keep;
  }

  function buildPlots() {
    var eX0 = CS.OX + 15 * T, sZ0 = CS.OZ + 11 * T;    // where each wing starts
    // the Back Room: rows of vegetables behind a picket fence
    plot(function (b) { return b.r1 < 11; }, function () {
      var x0 = -X1 + 0.6, x1 = eX0 - 0.4;
      fence(x0, sZ0 + 0.4, x0, Z1 - 0.3);
      fence(x0, Z1 - 0.3, x1, Z1 - 0.3);
      for (var r = 0; r < 3; r++) {
        var rz = sZ0 + 0.9 + r * 1.2;
        P.push(tint(CS.box(x1 - x0 - 5, 0.12, 0.8, { round: 0.04 }, (x0 + x1) / 2 - 1.5, 0.06, rz), 0x6a4a30));
        for (var x = x0 + 1; x < x1 - 4.5; x += 0.9) (r === 1 ? carrot : cabbage)(x, rz);
      }
      scarecrow(x1 - 2.2, sZ0 + 2.2);
    });
    // the East Wing: a little orchard
    plot(function (b) { return b.c1 < 15; }, function () {
      fence(eX0 + 0.5, CS.OZ + 0.4, X1 - 0.3, CS.OZ + 0.4);
      fence(X1 - 0.3, CS.OZ + 0.4, X1 - 0.3, sZ0 - 0.3);
      for (var z = CS.OZ + 3; z < sZ0 - 2; z += 4.6) {
        tree(eX0 + 2.6, z, 0.75);
        tree(eX0 + 6.4, z + 2.3, 0.7);
      }
      [[0.8, 0.5], [-0.4, 1.4], [1.6, 2.6]].forEach(function (a, i) {
        P.push(tint(CS.ball(0.12, 0.12, 0.12, {}, eX0 + 2.6 + a[0], 0.12, CS.OZ + 3 + a[1]), 0xd6402f));
      });
    });
    // the corner where both wings meet: a pumpkin patch
    plot(function (b) { return b.c1 < 15 || b.r1 < 11; }, function () {
      for (var i = 0; i < 7; i++) {
        pumpkin(eX0 + 1.2 + (i % 4) * 2.0, sZ0 + 1.0 + Math.floor(i / 4) * 1.8 + (i % 2) * 0.4, 0.8 + hash(i) * 0.5);
      }
    });
  }

  /* ------------------------------------------------------------ the path */
  function buildLoop() {
    pts = [[-PE, PS], [PE, PS], [PE, PJ], [PEO, PJ2], [PEO, PN], [-PEO, PN], [-PEO, PJ2], [-PE, PJ]];
    segs = []; loopLen = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segs.push({ a: a, b: b, len: len, s0: loopLen });
      loopLen += len;
    }
  }

  /* Point at distance s round the loop, and the inward normal there. */
  function pointAt(s, out) {
    s = ((s % loopLen) + loopLen) % loopLen;
    for (var i = 0; i < segs.length; i++) {
      var g = segs[i];
      if (s <= g.s0 + g.len || i === segs.length - 1) {
        var f = (s - g.s0) / g.len;
        var dx = (g.b[0] - g.a[0]) / g.len, dz = (g.b[1] - g.a[1]) / g.len;
        out.x = g.a[0] + (g.b[0] - g.a[0]) * f;
        out.z = g.a[1] + (g.b[1] - g.a[1]) * f;
        out.nx = dz; out.nz = -dx;           // left of travel = towards the shop
        return out;
      }
    }
    return out;
  }

  function pathMeshes(scene) {
    segs.forEach(function (g, i) {
      var L = g.len + PATH_W;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(L, PATH_W),
        CS.mat({ color: 0xb3a692, rough: 0.9 }));
      m.material = m.material.clone();
      m.material.map = CS.tex('stone').clone();
      m.material.map.needsUpdate = true;
      m.material.map.repeat.set(L / 2.2, PATH_W / 2.2);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]) * -1;
      m.position.set((g.a[0] + g.b[0]) / 2, -0.03 - i * 0.002, (g.a[1] + g.b[1]) / 2);
      m.receiveShadow = true;
      scene.add(m);
    });
    // and a spur from the north path up to the porch, where the queue comes in
    var spur = new THREE.Mesh(new THREE.PlaneGeometry(PATH_W, Math.abs(PN - (Z0 - 12.4)) + PATH_W),
      CS.mat({ color: 0xb3a692, tex: 'stone', rep: [1, Math.round(Math.abs(PN - Z0 + 12.4) / 2.2)], rough: 0.9 }));
    spur.rotation.x = -Math.PI / 2;
    spur.position.set(CS.DOOR_X, -0.045, (PN + Z0 - 12.4) / 2);
    scene.add(spur);
  }

  /* ---------------------------------------------------------- strollers
     Off-duty customers walking the path. Each limb's meshes are baked into
     one, in place, so the walk cycle still swings the same pivots. */
  function bake(g, mat) {
    var groups = [];
    g.traverse(function (o) {
      if (!o.isMesh) return;
      var hit = null;
      for (var i = 0; i < groups.length; i++) if (groups[i].p === o.parent) hit = groups[i];
      if (!hit) { hit = { p: o.parent, list: [] }; groups.push(hit); }
      hit.list.push(o);
    });
    groups.forEach(function (gr) {
      gr.list.forEach(function (m) {
        m.userData.tint = m.material.color.clone();
        gr.p.remove(m);
      });
      var merged = CS.merge(gr.list, mat);
      merged.castShadow = false;
      merged.receiveShadow = false;
      gr.p.add(merged);
    });
  }

  function addWalker(i, n, pace) {
    var species = i % CS.CRITTERS.length;
    var c = CS.models.customer(species, 11 + i * 7);
    bake(c.group, mats().paint);
    if (c.parts.mark) c.parts.mark.visible = false;
    var shadow = CS.models.blobShadow();
    shadow.scale.setScalar(0.9);
    var dir = i % 2 ? 1 : -1;
    var w = {
      group: c.group, parts: c.parts, shadow: shadow,
      s: pace ? hash(i) * pace.len : loopLen * i / n + hash(i) * 6,
      pace: pace || null,
      dir: dir,
      lane: pace ? 0 : (dir > 0 ? 0.45 : -0.45),
      speed: 1.1 + hash(i * 3.1) * 0.7,
      pause: 0, nextPause: 5 + hash(i * 5.7) * 14,
      walk: hash(i) * 6, bob: hash(i * 2) * 6, gait: 1,
      ox: 0, oz: 0, x: 0, z: 0, yaw: 0
    };
    root.add(c.group);
    root.add(shadow);
    walkers.push(w);
  }

  var tmp = { x: 0, z: 0, nx: 0, nz: 0 };

  /* Where a walker is: round the loop, or -- for one pottering about in a
     plot -- back and forth along its own short beat, facing the camera
     whenever it stops. */
  function placeOf(w, out) {
    if (!w.pace) return pointAt(w.s, out);
    var p = w.pace, L = p.len, s = ((w.s % (2 * L)) + 2 * L) % (2 * L);
    var f = s < L ? s / L : 2 - s / L;
    out.x = p.a[0] + (p.b[0] - p.a[0]) * f;
    out.z = p.a[1] + (p.b[1] - p.a[1]) * f;
    out.nx = 0; out.nz = 1;
    return out;
  }

  var ear = null;      // the camera, for how loud a stroller sounds

  /* A stroller who stops to wave says hello in their own voice, quieter
     the further they are from where the camera is looking. */
  function greet(w) {
    if (!ear) return;
    var d = Math.hypot(w.x - ear.position.x, w.z - ear.position.z);
    var v = CS.clamp(1 - (d - 14) / 32, 0, 1) * 0.75;
    if (v > 0.08) CS.audio.voice(w.parts.species.look, v);
  }

  function updateWalkers(dt) {
    var i, w;
    for (i = 0; i < walkers.length; i++) {
      w = walkers[i];
      // a plot you have bought takes its gardener with it
      var here = !w.pace || !w.pace.plot || w.pace.plot.mesh.visible;
      w.group.visible = w.shadow.visible = here;
      if (!here) continue;
      var moving = true;
      if (w.pause > 0) {
        w.pause -= dt;
        moving = false;
        if (w.pause <= 0) w.nextPause = 8 + Math.random() * 16;
      } else {
        w.s += w.dir * w.speed * dt;
        w.nextPause -= dt;
        if (w.nextPause <= 0) { w.pause = 2 + Math.random() * 4; greet(w); }
      }
      placeOf(w, tmp);
      // pushes from bumping into someone fade back to the lane
      w.ox *= Math.max(0, 1 - dt * 1.5);
      w.oz *= Math.max(0, 1 - dt * 1.5);
      var nx = tmp.x + tmp.nx * w.lane + w.ox, nz = tmp.z + tmp.nz * w.lane + w.oz;
      var mx = nx - w.x, mz = nz - w.z, moved = Math.hypot(mx, mz);
      w.x = nx; w.z = nz;

      // face the way they are going; stood still, turn to look at the shop
      var want = moving && moved > 0.0005 ? Math.atan2(mx, mz) : Math.atan2(tmp.nx, tmp.nz);
      var diff = ((want - w.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      w.yaw += diff * Math.min(1, dt * 6);

      w.gait += ((moving ? 1 : 0) - w.gait) * Math.min(1, dt * 8);
      w.walk += moved * 4.4;
      w.bob += dt * 1.9;
      var p = w.parts, sw = Math.sin(w.walk) * 0.8 * w.gait;
      p.legL.rotation.x = sw;
      p.legR.rotation.x = -sw;
      p.armL.rotation.x = -sw * 0.7;
      p.armR.rotation.x = sw * 0.7 - (w.pause > 0 && w.pause < 1.2 ? 1.6 : 0);   // a wave
      if (p.tail && p.species.tail !== 'none') p.tail.rotation.y = Math.sin(w.bob * 1.2) * 0.2;
      w.group.position.set(w.x, Math.abs(Math.sin(w.walk)) * 0.06 * w.gait + Math.sin(w.bob) * 0.015, w.z);
      w.group.rotation.y = w.yaw;
      w.shadow.position.set(w.x, -0.01, w.z);
    }

    // strollers are solid to one another too
    for (i = 0; i < walkers.length; i++) {
      for (var j = i + 1; j < walkers.length; j++) {
        var a = walkers[i], b = walkers[j];
        if (!a.group.visible || !b.group.visible) continue;
        var dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d >= 0.75 || d < 1e-4) continue;
        var over = (0.75 - d) * 0.5, ux = dx / d, uz = dz / d;
        a.ox -= (ux + uz * 0.5) * over; a.oz -= (uz - ux * 0.5) * over;
        b.ox += (ux + uz * 0.5) * over; b.oz += (uz - ux * 0.5) * over;
      }
    }
  }

  /* ------------------------------------------------------------- module */
  CS.grounds = {
    build: function (scene, opts) {
      var lowSpec = !!(opts && opts.lowSpec);
      mats();
      root = new THREE.Group();
      scene.add(root);
      P = []; S = []; G = [];
      buildLoop();

      // ---- the lawn: one big plane under everything, unbought land included
      var lawn = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), CS.mat({ color: 0xd8d8d8, rough: 0.95 }));
      lawn.material = lawn.material.clone();
      lawn.material.map = CS.texRepeat('grass', 240 / 6, 240 / 6);
      lawn.rotation.x = -Math.PI / 2;
      lawn.position.set(0, -0.08, 0);
      lawn.receiveShadow = true;
      root.add(lawn);
      pathMeshes(root);

      // ---- hedges, flower beds and lamps right against the shop's walls,
      // which is the strip a phone's camera actually sees past the edge
      var ex = X1 + 1.4, sz = Z1 + 1.3, z;
      for (z = Z0 + 2; z < Z1 - 1; z += 4.4) {
        bush(ex, z, 0.9); bush(-ex, z + 2.2, 0.9);
        lampPost(ex + 0.3, z + 2.2); lampPost(-ex - 0.3, z);
      }
      for (var x = -X1 + 3; x < X1 - 2; x += 6.6) {
        flowerBed(x, sz, 3.2, 0.9, true);
        bush(x + 3.6, sz, 0.75);
      }
      for (x = -X1 + 6; x < X1; x += 13) lampPost(x, PS + PATH_W / 2 + 0.6);

      // benches facing the path
      bench(PE + PATH_W / 2 + 0.8, -2, -Math.PI / 2);
      bench(-PE - PATH_W / 2 - 0.8, 4, Math.PI / 2);
      bench(-8, PS + PATH_W / 2 + 0.8, Math.PI);
      bench(10, PS + PATH_W / 2 + 0.8, Math.PI);

      // ---- beyond the path: the fountain, market stalls, a well, hay
      fountain(0, PS + 6.5);
      flowerBed(-6, PS + 6.5, 3, 1, false);
      flowerBed(6, PS + 6.5, 3, 1, false);
      stall(PEO + 4, -8, -Math.PI / 2, 0xc8302e);
      stall(PEO + 4, 2, -Math.PI / 2, 0x2f4f96);
      stall(-PEO - 4, -4, Math.PI / 2, 0x3f8a3a);
      stall(-PEO - 4, 6, Math.PI / 2, 0xe8892a);
      well(-PE - 6, PS + 4);
      hay(PE + 6, PS + 3.5); hay(PE + 7.3, PS + 4.4); hay(PE + 6.6, PS + 5.6);
      lampPost(PEO + 1.8, -13); lampPost(-PEO - 1.8, -13);

      // ---- trees: a few near, a band towards the walls, pines behind
      [[PE + 6, 10], [PE + 9, -16], [-PE - 7, -12], [-PE - 9, 14], [-14, PS + 9], [15, PS + 10],
       [PEO + 9, 8], [-PEO - 9, -2], [PEO + 8, -24], [-PEO - 8, -26], [24, PS + 12], [-26, PS + 13]]
        .forEach(function (t, i) { tree(t[0], t[1], 0.95 + hash(i * 1.7) * 0.4); });
      for (var k = 0; k < 14; k++) {
        var px = -40 + k * 6.2 + hash(k) * 2, pz = PN - 6 - hash(k * 3) * 6;
        if (Math.abs(px - CS.DOOR_X) < 3) continue;
        pine(px, pz, 1.0 + hash(k * 9) * 0.5);
      }

      // ---- the castle: curtain walls, corner towers and the keep behind
      var WX = 46, WN = Z0 - 32, WS = Z1 + 30;
      curtain(-WX, WN, WX, WN);
      curtain(WX, WN, WX, WS);
      curtain(WX, WS, 4, WS);
      curtain(-4, WS, -WX, WS);
      curtain(-WX, WS, -WX, WN);
      tower(-WX, WN, 3.0, 9, 0x2f4f96);
      tower(WX, WN, 3.0, 9, 0x2f4f96);
      tower(-WX, WS, 2.6, 7.5, 0xb5482f);
      tower(WX, WS, 2.6, 7.5, 0xb5482f);
      tower(-4.5, WS, 2.2, 6.5, 0xb5482f);
      tower(4.5, WS, 2.2, 6.5, 0xb5482f);
      // the keep: a big square block with three towers, over the north wall
      S.push(tint(CS.box(22, 13, 9, { round: 0 }, 0, 6.5, WN - 8), 0xaaa5a0));
      tower(-11, WN - 8, 3.4, 17, 0x2f4f96);
      tower(11, WN - 8, 3.4, 17, 0x2f4f96);
      tower(0, WN - 12, 4.0, 22, 0x2f4f96);

      buildPlots();

      // ---- bake the buckets
      var paint = CS.merge(P, MAT.paint);
      var stone = CS.merge(S, MAT.stone);
      var glow = CS.merge(G, MAT.glow);
      [paint, stone, glow].forEach(function (m) { m.castShadow = false; m.receiveShadow = !lowSpec; root.add(m); });
      P = S = G = null;

      // ---- the strollers
      var n = lowSpec ? 5 : 9;
      for (var w = 0; w < n; w++) addWalker(w, n);
      // and two pottering about the unbought plots, right where a phone looks
      var eX0 = CS.OX + 15 * T, sZ0 = CS.OZ + 11 * T;
      function beat(a, b, plotIdx) {
        return { a: a, b: b, len: Math.hypot(b[0] - a[0], b[1] - a[1]), plot: plots[plotIdx] };
      }
      addWalker(n, n, beat([-X1 + 3, sZ0 + 1.5], [eX0 - 6.5, sZ0 + 1.5], 0));
      addWalker(n + 1, n, beat([eX0 + 4.5, CS.OZ + 2], [eX0 + 4.5, sZ0 - 1.5], 1));

      CS.noMirror(root);
      CS.grounds.sync();
      return root;
    },

    /* Hide the dressing on any plot you have since bought. Called whenever
       the kitchen is rebuilt, which is what buying a wing does. */
    sync: function () {
      var b = CS.layout.bounds;
      plots.forEach(function (p) { p.mesh.visible = p.test(b); });
    },

    update: function (dt, camera) {
      ear = camera || ear;
      if (!root) return;
      updateWalkers(dt);
    }
  };
})(window.CS);
