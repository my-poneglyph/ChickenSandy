/* Model builders -- the chef, the customers, the hired help, every food item
   and the signage.

   Everything is built from a handful of smooth primitives: rounded boxes,
   spheres squashed into ellipsoids, cylinders, cones and tori. Shading is
   physically based (MeshStandardMaterial) and the renderer tone-maps the
   result, so the look is soft and rounded -- a storybook kitchen rather than
   a voxel one. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var matCache = {};

  /* Colours are authored as the sRGB hex you would pick in a paint program;
     the renderer works in linear light, so convert on the way in. */
  CS.linear = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };

  /* Material from a small option bag, cached so identical surfaces share one
     material. `rough`/`metal` tune the sheen: food and glaze are glossy,
     feathers and cloth are matte. */
  CS.mat = function (o) {
    o = o || {};
    var rep = o.rep ? (o.rep[0] + 'x' + o.rep[1]) : '-';
    var key = [o.color == null ? 0xffffff : o.color, o.tex || '-', rep, o.emissive || 0,
      o.opacity == null ? 1 : o.opacity, o.basic ? 1 : 0,
      o.rough == null ? '-' : o.rough, o.metal || 0, o.side || 0].join('|');
    if (matCache[key]) return matCache[key];
    var params = {
      color: CS.linear(o.color == null ? 0xffffff : o.color),
      transparent: o.opacity != null && o.opacity < 1,
      opacity: o.opacity == null ? 1 : o.opacity
    };
    if (o.side) params.side = THREE.DoubleSide;
    // `rep` keeps a pattern at a fixed scale on faces of different sizes
    if (o.tex) params.map = o.rep ? CS.texRepeat(o.tex, o.rep[0], o.rep[1]) : CS.tex(o.tex);
    var m;
    if (o.basic) {
      m = new THREE.MeshBasicMaterial(params);
    } else {
      if (o.emissive) params.emissive = CS.linear(o.emissive);
      params.roughness = o.rough == null ? 0.78 : o.rough;
      params.metalness = o.metal || 0;
      m = new THREE.MeshStandardMaterial(params);
    }
    matCache[key] = m;
    return m;
  };

  function toMat(m) {
    if (m && m.isMaterial) return m;
    var o = (typeof m === 'number') ? { color: m } : (m || {});
    return CS.mat(o);
  }

  function finishMesh(mesh, x, y, z) {
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /* --------------------------------------------------------- rounded boxes
     A box whose edges and corners are rounded off with radius `r`. Built
     from a subdivided BoxGeometry whose grid lines are pulled out to the
     edges, then each vertex is projected onto the rounded surface and its
     normal pointed straight out of it -- so the faces stay flat, the edges
     are genuinely curved, and the shading across them is smooth. */
  var geoCache = {};
  var STEPS = 2;                               // grid lines per rounded edge

  function roundedBox(w, h, d, r) {
    var key = 'b' + w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3) + ',' + r.toFixed(3);
    if (geoCache[key]) return geoCache[key];
    var hw = w / 2, hh = h / 2, hd = d / 2;
    r = Math.max(0, Math.min(r, hw * 0.999, hh * 0.999, hd * 0.999));
    var S = STEPS * 2 + 1;
    var geo = new THREE.BoxGeometry(w, h, d, S, S, S);
    var pos = geo.attributes.position, nor = geo.attributes.normal;
    var half = [hw, hh, hd], p = [0, 0, 0], inner = [0, 0, 0], n = [0, 0, 0];

    // pull the grid so all but one division sit inside the rounded edge band
    function remap(v, hl) {
      var step = (hl * 2) / S;
      var i = Math.round((v + hl) / step);
      if (i <= STEPS) return -hl + r * (i / STEPS);
      if (i >= S - STEPS) return hl - r + r * ((i - (S - STEPS)) / STEPS);
      return v;
    }
    for (var k = 0; k < pos.count; k++) {
      p[0] = remap(pos.getX(k), hw); p[1] = remap(pos.getY(k), hh); p[2] = remap(pos.getZ(k), hd);
      var len = 0;
      for (var a = 0; a < 3; a++) {
        inner[a] = Math.max(-half[a] + r, Math.min(half[a] - r, p[a]));
        n[a] = p[a] - inner[a];
        len += n[a] * n[a];
      }
      len = Math.sqrt(len);
      if (r > 0 && len > 1e-6) {
        for (var b = 0; b < 3; b++) { n[b] /= len; p[b] = inner[b] + n[b] * r; }
        nor.setXYZ(k, n[0], n[1], n[2]);
      }
      pos.setXYZ(k, p[0], p[1], p[2]);
    }
    geoCache[key] = geo;
    return geo;
  }

  /* box(w,h,d, material-or-color-or-opts, x,y,z). Corners are rounded by a
     radius in proportion to the smallest side, unless opts.round says
     otherwise. */
  CS.box = function (w, h, d, m, x, y, z) {
    var o = (m && !m.isMaterial && typeof m === 'object') ? m : null;
    var r = (o && o.round != null) ? o.round : Math.min(0.09, Math.min(w, h, d) * 0.22);
    return finishMesh(new THREE.Mesh(roundedBox(w, h, d, r), toMat(m)), x, y, z);
  };

  function cached(key, make) {
    if (!geoCache[key]) geoCache[key] = make();
    return geoCache[key];
  }

  /* An ellipsoid with radii rx, ry, rz. */
  CS.ball = function (rx, ry, rz, m, x, y, z) {
    var g = cached('s', function () { return new THREE.SphereGeometry(1, 24, 16); });
    var mesh = finishMesh(new THREE.Mesh(g, toMat(m)), x, y, z);
    mesh.scale.set(rx, ry, rz);
    return mesh;
  };

  /* Part of a sphere -- for aprons, bun crowns, anything that has to hug a
     round body. Same angle conventions as THREE.SphereGeometry. */
  CS.shell = function (rx, ry, rz, m, phi0, phiLen, th0, thLen) {
    var key = ['sh', phi0, phiLen, th0, thLen].map(function (v) { return typeof v === 'number' ? v.toFixed(3) : v; }).join(',');
    var g = cached(key, function () { return new THREE.SphereGeometry(1, 28, 18, phi0, phiLen, th0, thLen); });
    var mesh = finishMesh(new THREE.Mesh(g, toMat(m)), 0, 0, 0);
    mesh.scale.set(rx, ry, rz);
    return mesh;
  };

  CS.cyl = function (rt, rb, h, m, x, y, z, seg) {
    seg = seg || 20;
    var key = 'c' + rt.toFixed(3) + ',' + rb.toFixed(3) + ',' + h.toFixed(3) + ',' + seg;
    var g = cached(key, function () { return new THREE.CylinderGeometry(rt, rb, h, seg); });
    return finishMesh(new THREE.Mesh(g, toMat(m)), x, y, z);
  };

  CS.cone = function (r, h, m, x, y, z, seg) {
    seg = seg || 14;
    var key = 'k' + r.toFixed(3) + ',' + h.toFixed(3) + ',' + seg;
    var g = cached(key, function () { return new THREE.ConeGeometry(r, h, seg); });
    return finishMesh(new THREE.Mesh(g, toMat(m)), x, y, z);
  };

  /* A ring, or an arc of one: TorusGeometry(R, tube, ..., arc). */
  CS.torus = function (R, tube, arc, m, x, y, z) {
    var key = 't' + R.toFixed(3) + ',' + tube.toFixed(3) + ',' + (arc || 6.2832).toFixed(3);
    var g = cached(key, function () { return new THREE.TorusGeometry(R, tube, 10, 28, arc || Math.PI * 2); });
    return finishMesh(new THREE.Mesh(g, toMat(m)), x, y, z);
  };

  function add(parent, mesh) { parent.add(mesh); return mesh; }

  /* A point on the surface of an ellipsoid, using SphereGeometry's angles:
     phi runs around (PI/2 is straight ahead, +z), theta from the top down. */
  function onShell(rx, ry, rz, phi, theta, out) {
    out = out || new THREE.Vector3();
    return out.set(-rx * Math.cos(phi) * Math.sin(theta), ry * Math.cos(theta), rz * Math.sin(phi) * Math.sin(theta));
  }

  CS.models = {};

  /* ------------------------------------------------------------ the chef
     A round little yellow chick in chef's whites: a tall toque with a blue
     band and crest, a blue neckerchief, a white apron trimmed in blue with
     brass buttons, rosy cheeks and happy closed eyes, and a wooden spoon in
     one wing. Every animated piece has its own pivot; the names in `parts`
     are what game.js drives. */
  CS.models.chef = function () {
    var g = new THREE.Group();
    var parts = {};

    var FEATHER = { color: 0xffcf3a, tex: 'fluff', rough: 0.92 };
    var FEATHER_L = { color: 0xffe07a, tex: 'fluff', rough: 0.92 };
    var LEG = { color: 0x9a6a40, rough: 0.7 };
    var CLAW = { color: 0xeee2c8, rough: 0.45 };
    var BEAK = { color: 0xf59a3c, rough: 0.45 };
    var BEAK_D = { color: 0xe07c2a, rough: 0.5 };
    var WHITE = { color: 0xfbf8f1, rough: 0.85 };
    var BLUE = { color: 0x2f4f96, rough: 0.8 };
    var BRASS = { color: 0xd6a648, rough: 0.3, metal: 0.8 };
    var INK = { color: 0x2a1d1a, rough: 0.5 };

    /* ---- legs: a scaly shin and a big clawed foot, pivoting at the hip ---- */
    var hips = new THREE.Group(); hips.position.y = 0.30; g.add(hips);
    ['legL', 'legR'].forEach(function (id, i) {
      var s = i ? 1 : -1;
      var leg = new THREE.Group();
      leg.position.set(s * 0.17, 0, 0.02);
      hips.add(leg);
      add(leg, CS.cyl(0.055, 0.05, 0.22, LEG, 0, -0.12, 0, 12));
      add(leg, CS.ball(0.10, 0.06, 0.12, LEG, 0, -0.25, 0.03));
      [-0.065, 0, 0.065].forEach(function (tx, k) {
        var toe = add(leg, CS.ball(0.04, 0.035, 0.07, LEG, tx, -0.27, 0.11));
        toe.rotation.y = -tx * 2.2;
        var claw = add(leg, CS.cone(0.026, 0.09, CLAW, tx * 1.3, -0.275, 0.19, 10));
        claw.rotation.x = Math.PI / 2;
        claw.rotation.z = tx * 2.2;
        if (k === 1) claw.scale.setScalar(1.15);
      });
      var spur = add(leg, CS.cone(0.022, 0.07, CLAW, 0, -0.27, -0.09, 10));
      spur.rotation.x = -Math.PI / 2;
      parts[id] = leg;
    });

    /* ---- body: one big round, fluffy belly ---- */
    var body = new THREE.Group(); body.position.y = 0.26; g.add(body);
    parts.body = body;
    var BR = [0.47, 0.44, 0.43], BY = 0.40;
    add(body, CS.ball(BR[0], BR[1], BR[2], FEATHER, 0, BY, 0));
    // fluffy tufts at the sides and the belly so the outline is not a perfect egg
    [[-0.44, 0.30, 0.05, 0.4], [0.44, 0.30, 0.05, -0.4], [-0.36, 0.12, 0.12, 0.7],
     [0.36, 0.12, 0.12, -0.7], [0, 0.0, 0.18, 0]].forEach(function (t) {
      var tuft = add(body, CS.ball(0.11, 0.16, 0.10, FEATHER, t[0], t[1], t[2]));
      tuft.rotation.z = t[3];
    });

    // apron: a skirt and a bib cut from a shell that hugs the belly, with a
    // blue piping round the hem and down the bib, and two pairs of buttons
    var AP = 1.025;
    var skirt = add(body, CS.shell(BR[0] * AP, BR[1] * AP, BR[2] * AP, WHITE, Math.PI / 2 - 0.95, 1.9, 1.45, 0.95));
    skirt.position.y = BY;
    var hem = add(body, CS.shell(BR[0] * 1.03, BR[1] * 1.03, BR[2] * 1.03, BLUE, Math.PI / 2 - 0.96, 1.92, 2.30, 0.07));
    hem.position.y = BY;
    var bib = add(body, CS.shell(BR[0] * AP, BR[1] * AP, BR[2] * AP, WHITE, Math.PI / 2 - 0.55, 1.1, 0.72, 0.8));
    bib.position.y = BY;
    [-0.55, 0.55].forEach(function (edge) {
      var pipe = add(body, CS.shell(BR[0] * 1.03, BR[1] * 1.03, BR[2] * 1.03, BLUE,
        Math.PI / 2 + edge - (edge > 0 ? 0.05 : 0), 0.05, 0.75, 0.75));
      pipe.position.y = BY;
    });
    // apron strings belt and pocket with a little crest
    var belt = add(body, CS.shell(BR[0] * 1.03, BR[1] * 1.03, BR[2] * 1.03, WHITE, Math.PI / 2 - 1.2, 2.4, 1.48, 0.06));
    belt.position.y = BY;
    var v = new THREE.Vector3();
    [[-0.32, 1.02], [0.32, 1.02], [-0.32, 1.3], [0.32, 1.3]].forEach(function (b) {
      onShell(BR[0] * 1.04, BR[1] * 1.04, BR[2] * 1.04, Math.PI / 2 + b[0], b[1], v);
      add(body, CS.ball(0.032, 0.032, 0.02, BRASS, v.x, v.y + BY, v.z)).lookAt(v.x * 3, v.y * 3 + BY, v.z * 3);
    });
    onShell(BR[0] * 1.03, BR[1] * 1.03, BR[2] * 1.03, Math.PI / 2 + 0.3, 1.95, v);
    var pocket = add(body, CS.box(0.15, 0.12, 0.025, WHITE, v.x, v.y + BY, v.z));
    pocket.lookAt(v.x * 3, (v.y + BY) * 1.2, v.z * 3);
    var crest = add(body, CS.ball(0.035, 0.035, 0.012, BLUE, v.x, v.y + BY + 0.01, v.z + 0.016));
    crest.lookAt(v.x * 3, (v.y + BY) * 1.2, v.z * 3);

    /* ---- wings: soft rounded paddles with feather tips, pivot at shoulder ---- */
    ['wingL', 'wingR'].forEach(function (id, i) {
      var s = i ? 1 : -1;
      var w = new THREE.Group();
      w.position.set(s * 0.43, 0.56, 0.02);
      body.add(w);
      var paddle = add(w, CS.ball(0.10, 0.22, 0.17, FEATHER, s * 0.04, -0.16, 0.02));
      paddle.rotation.z = s * 0.25;
      [-0.08, 0, 0.08].forEach(function (fz, k) {
        var tip = add(w, CS.ball(0.05, 0.11, 0.05, FEATHER_L, s * (0.08 + k * 0.01), -0.36 + Math.abs(fz) * 0.4, fz));
        tip.rotation.z = s * (0.35 + k * 0.1);
      });
      parts[id] = w;
    });

    // the wooden spoon, carried in the right wing (hidden while she holds food)
    var spoon = new THREE.Group();
    spoon.position.set(0.10, -0.34, 0.12);
    spoon.rotation.set(-0.35, 0, -0.15);
    parts.wingR.add(spoon);
    var WOOD = { color: 0xa9733f, rough: 0.6 };
    add(spoon, CS.cyl(0.018, 0.022, 0.42, WOOD, 0, 0.12, 0, 10));
    var bowl = add(spoon, CS.ball(0.07, 0.10, 0.03, WOOD, 0, 0.38, 0.0));
    bowl.rotation.x = -0.15;
    parts.spoon = spoon;

    /* ---- tail: a perky little fan off the rump ---- */
    parts.tail = new THREE.Group();
    parts.tail.position.set(0, 0.36, -0.40);
    body.add(parts.tail);
    [-0.35, 0, 0.35].forEach(function (a) {
      var f = add(parts.tail, CS.ball(0.06, 0.15, 0.05, FEATHER, Math.sin(a) * 0.08, 0.10, -0.04));
      f.rotation.set(-0.6, 0, -a);
    });

    /* ---- neckerchief: a blue roll round the neck, knotted at the front ---- */
    var scarf = add(body, CS.torus(0.37, 0.065, 0, BLUE, 0, 0.66, 0.0));
    scarf.rotation.x = Math.PI / 2 + 0.12;
    scarf.scale.set(1, 0.92, 1);
    add(body, CS.ball(0.08, 0.065, 0.07, BLUE, 0, 0.62, 0.42));
    [-1, 1].forEach(function (s) {
      var tailK = add(body, CS.cone(0.08, 0.20, BLUE, s * 0.07, 0.50, 0.44, 3));
      tailK.rotation.set(0.25, 0, Math.PI + s * 0.35);
      tailK.scale.set(1, 1, 0.35);
    });

    /* ---- head: the top of the same round bird, with a big face ---- */
    var head = new THREE.Group(); head.position.set(0, 0.70, 0.02); body.add(head);
    parts.head = head;
    parts.headY = 0.70;
    add(head, CS.ball(0.40, 0.35, 0.37, FEATHER, 0, 0.20, 0));
    // cheek fluff and a couple of stray head feathers
    [-1, 1].forEach(function (s) {
      var c = add(head, CS.ball(0.12, 0.10, 0.10, FEATHER, s * 0.33, 0.10, 0.06));
      c.rotation.z = s * 0.5;
    });
    var cow = add(head, CS.ball(0.04, 0.12, 0.04, FEATHER, -0.05, 0.56, 0.1));
    cow.rotation.z = 0.5;

    // happy closed eyes: two little upward arcs, with rosy cheeks below
    var face = new THREE.Group(); face.position.set(0, 0.25, 0); head.add(face);
    [-1, 1].forEach(function (s) {
      var eye = add(face, CS.torus(0.055, 0.014, Math.PI, INK, s * 0.15, 0, 0.34));
      eye.rotation.y = s * 0.42;
      var blush = add(face, CS.ball(0.065, 0.035, 0.02, { color: 0xff9c8e, rough: 0.9 }, s * 0.24, -0.11, 0.285));
      blush.rotation.y = s * 0.65;
    });
    // blinking means nothing to closed eyes; game.js gets an empty pivot
    parts.eyes = new THREE.Group(); head.add(parts.eyes);

    // the beak, in two halves so it can open a crack when she is out of breath
    var beak = add(head, CS.ball(0.13, 0.075, 0.12, BEAK, 0, 0.13, 0.36));
    beak.rotation.x = 0.15;
    parts.jaw = new THREE.Group(); parts.jaw.position.set(0, 0.09, 0.30); head.add(parts.jaw);
    add(parts.jaw, CS.ball(0.10, 0.045, 0.09, BEAK_D, 0, 0, 0.05));

    // the toque: band with a blue stripe and crest, then a big soft puff
    var hat = new THREE.Group(); hat.position.set(0, 0.47, -0.02); head.add(hat);
    hat.rotation.x = -0.08;
    parts.hat = hat;
    var HAT = { color: 0xfdfbf6, rough: 0.9 };
    add(hat, CS.cyl(0.30, 0.31, 0.24, HAT, 0, 0.08, 0, 28));
    add(hat, CS.cyl(0.312, 0.318, 0.035, BLUE, 0, 0.01, 0, 28));
    var badge = add(hat, CS.cyl(0.06, 0.06, 0.02, BLUE, 0, 0.11, 0.30, 16));
    badge.rotation.x = Math.PI / 2;
    add(hat, CS.ball(0.36, 0.24, 0.34, HAT, 0, 0.36, 0));
    [[0.2, 0.32, 0.12], [-0.2, 0.33, 0.1], [0.08, 0.36, -0.2], [-0.12, 0.38, -0.16], [0, 0.48, 0.02]]
      .forEach(function (p, k) {
        add(hat, CS.ball(0.19 + (k % 2) * 0.03, 0.17, 0.18, HAT, p[0], p[1], p[2]));
      });

    // where a carried item sits, out in front of the belly
    parts.hands = new THREE.Object3D();
    parts.hands.position.set(0, 0.48, 0.56);
    body.add(parts.hands);

    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return { group: g, parts: parts };
  };

  /* -------------------------------------------------------- the customer
     The queue is an assortment of small round animals: a big head on a
     small body, stubby limbs and glossy eyes. Body, arms and legs are the
     same rig for every species -- which is what lets orders.js drive one walk
     cycle for all of them -- and the species table in config.js supplies the
     colours plus the ears, snout and tail bolted on top.

     `parts` is the contract with orders.js: legL, legR, armL, armR, head,
     body, tail and mark. Keep those names if you add a species.             */
  CS.models.customer = function (speciesIdx, seed) {
    var C = CS.CRITTERS[speciesIdx % CS.CRITTERS.length];
    var g = new THREE.Group();
    var parts = { species: C };
    var FUR = { color: C.fur, tex: 'fluff', rough: 0.9 };
    var FUR_D = { color: CS.shade(C.fur, -28), tex: 'fluff', rough: 0.9 };
    var BELLY = { color: C.belly, tex: 'fluff', rough: 0.9 };
    var SNOUT = { color: C.snout, rough: 0.8 };
    var EYE = { color: 0x1e1828, rough: 0.15 };
    var SHINE = { color: 0xffffff, rough: 0.2 };

    /* ---- legs: stubby, with a round paw ---- */
    var hips = new THREE.Group(); hips.position.y = 0.26; g.add(hips);
    ['legL', 'legR'].forEach(function (id, i) {
      var leg = new THREE.Group();
      leg.position.set(i ? 0.13 : -0.13, 0, 0);
      hips.add(leg);
      add(leg, CS.ball(0.085, 0.12, 0.085, FUR, 0, -0.09, 0));
      add(leg, CS.ball(0.10, 0.06, 0.13, FUR_D, 0, -0.20, 0.03));
      parts[id] = leg;
    });

    /* ---- body: a soft pear ---- */
    var body = new THREE.Group(); body.position.y = 0.26; g.add(body); parts.body = body;
    add(body, CS.ball(0.29, 0.29, 0.25, FUR, 0, 0.20, 0));
    add(body, CS.ball(0.19, 0.20, 0.08, BELLY, 0, 0.17, 0.19));
    if (C.patch) add(body, CS.ball(0.12, 0.10, 0.06, FUR_D, -0.16, 0.28, 0.14));

    /* ---- arms ---- */
    [['armL', -1], ['armR', 1]].forEach(function (a) {
      var arm = new THREE.Group();
      arm.position.set(a[1] * 0.26, 0.32, 0);
      body.add(arm);
      var up = add(arm, CS.ball(0.07, 0.15, 0.07, FUR, a[1] * 0.02, -0.12, 0));
      up.rotation.z = a[1] * 0.2;
      add(arm, CS.ball(0.075, 0.07, 0.075, FUR_D, a[1] * 0.04, -0.25, 0.01));
      parts[a[0]] = arm;
    });

    /* ---- tail: on its own pivot, so it can wag ---- */
    parts.tail = new THREE.Group();
    parts.tail.position.set(0, 0.14, -0.22);
    body.add(parts.tail);
    if (C.tail === 'up' || C.tail === 'wag') {
      var t1 = add(parts.tail, CS.ball(0.05, 0.20, 0.05, FUR, 0, 0.16, -0.06));
      t1.rotation.x = -0.5;
      add(parts.tail, CS.ball(0.06, 0.06, 0.06, C.tipped ? { color: 0xf6eadd } : FUR, 0, 0.33, -0.15));
      parts.tail.rotation.x = C.tail === 'wag' ? 0.25 : 0;
    } else if (C.tail === 'bush') {
      var b1 = add(parts.tail, CS.ball(0.14, 0.24, 0.14, FUR, 0, 0.16, -0.12));
      b1.rotation.x = -0.6;
      add(parts.tail, CS.ball(0.10, 0.10, 0.10, { color: 0xf6eadd, tex: 'fluff' }, 0, 0.35, -0.25));
    } else if (C.tail === 'puff') {
      add(parts.tail, CS.ball(0.10, 0.10, 0.10, { color: 0xffffff, tex: 'fluff' }, 0, 0.02, -0.03));
    } else if (C.tail === 'curl') {
      var curl = add(parts.tail, CS.torus(0.06, 0.022, 0, FUR, 0, 0.06, -0.04));
      curl.rotation.y = Math.PI / 2;
    }

    /* ---- head: big and round, the chibi bit ---- */
    var head = new THREE.Group(); head.position.set(0, 0.52, 0.01); body.add(head);
    parts.head = head;
    add(head, CS.ball(0.31, 0.27, 0.28, FUR, 0, 0.20, 0));

    // ears. `eh` tracks how tall this species ends up, so the impatience mark
    // floats clear of a bunny's ears as well as a frog's flat head.
    var eh = 0.48;
    var INNER = { color: 0xf8bccb, rough: 0.9 };
    if (C.ears === 'point') {
      [-1, 1].forEach(function (s) {
        var e = add(head, CS.cone(0.10, 0.20, FUR, s * 0.17, 0.48, -0.02));
        e.rotation.z = -s * 0.3; e.scale.z = 0.55;
        var ei = add(head, CS.cone(0.06, 0.13, C.stripes ? { color: 0xf7cfae } : INNER, s * 0.17, 0.46, 0.02));
        ei.rotation.z = -s * 0.3; ei.scale.z = 0.4;
      });
      eh = 0.62;
    } else if (C.ears === 'tall') {
      [-1, 1].forEach(function (s) {
        var e = add(head, CS.ball(0.075, 0.24, 0.05, FUR, s * 0.12, 0.62, -0.02));
        e.rotation.z = s * -0.15;
        var ei = add(head, CS.ball(0.045, 0.19, 0.02, INNER, s * 0.12, 0.62, 0.025));
        ei.rotation.z = s * -0.15;
      });
      eh = 0.88;
    } else if (C.ears === 'round') {
      var er = C.bigEars ? 0.15 : 0.11, ex = C.bigEars ? 0.23 : 0.20;
      [-1, 1].forEach(function (s) {
        add(head, CS.ball(er, er, 0.05, FUR, s * ex, 0.43, -0.02));
        add(head, CS.ball(er * 0.62, er * 0.62, 0.03, INNER, s * ex, 0.43, 0.02));
      });
      eh = 0.58;
    } else if (C.ears === 'droop') {
      [-1, 1].forEach(function (s) {
        var e = add(head, CS.ball(0.08, 0.17, 0.06, FUR_D, s * 0.30, 0.18, 0));
        e.rotation.z = s * 0.25;
      });
    } else if (C.ears === 'flop') {
      [-1, 1].forEach(function (s) {
        var e = add(head, CS.ball(0.10, 0.08, 0.04, FUR_D, s * 0.18, 0.42, 0.10));
        e.rotation.x = 0.7; e.rotation.z = -s * 0.3;
      });
      eh = 0.54;
    }

    // eyes: big and glossy, each with a catchlight. A frog's bulge off the
    // top of the head; everyone else's sit on the face.
    parts.eyes = new THREE.Group(); head.add(parts.eyes);
    if (C.bigEyes) {
      [-1, 1].forEach(function (s) {
        add(parts.eyes, CS.ball(0.11, 0.11, 0.11, FUR, s * 0.15, 0.42, 0.06));
        add(parts.eyes, CS.ball(0.065, 0.075, 0.04, EYE, s * 0.16, 0.44, 0.15));
        add(parts.eyes, CS.ball(0.02, 0.02, 0.01, SHINE, s * 0.16 - 0.02, 0.47, 0.19));
      });
      eh = 0.58;
    } else {
      [-1, 1].forEach(function (s) {
        add(parts.eyes, CS.ball(0.05, 0.065, 0.03, EYE, s * 0.115, 0.24, 0.255));
        add(parts.eyes, CS.ball(0.02, 0.022, 0.01, SHINE, s * 0.115 - 0.015, 0.27, 0.283));
      });
    }
    [-1, 1].forEach(function (s) {
      var bl = add(head, CS.ball(0.05, 0.028, 0.015, { color: 0xff9db2, rough: 0.9 }, s * 0.19, 0.13, 0.24));
      bl.rotation.y = s * 0.5;
    });

    // snout and nose
    if (C.name === 'Piglet') {
      var sn = add(head, CS.cyl(0.08, 0.085, 0.07, SNOUT, 0, 0.13, 0.28));
      sn.rotation.x = Math.PI / 2;
      add(head, CS.ball(0.015, 0.025, 0.01, { color: C.nose }, -0.03, 0.13, 0.318));
      add(head, CS.ball(0.015, 0.025, 0.01, { color: C.nose }, 0.03, 0.13, 0.318));
    } else if (C.bigEyes) {
      var grin = add(head, CS.torus(0.11, 0.012, Math.PI, { color: CS.shade(C.fur, -60) }, 0, 0.16, 0.26));
      grin.rotation.z = Math.PI;
    } else {
      add(head, CS.ball(0.11, 0.075, 0.07, SNOUT, 0, 0.12, 0.24));
      add(head, CS.ball(0.04, 0.03, 0.03, { color: C.nose, rough: 0.3 }, 0, 0.15, 0.30));
    }
    if (C.stripes) {
      [-0.06, 0, 0.06].forEach(function (x) {
        add(head, CS.ball(0.022, 0.06, 0.03, FUR_D, x, 0.42, 0.14));
      });
    }

    /* A cap on some of them, picked off the seed, so two Bunnies standing in
       the same queue still read as two different customers. */
    if (seed % 5 > 2 && C.ears !== 'tall') {
      var cap = [0x6a4f9c, 0x3f8a6b, 0x2f4f96, 0xc0563f][seed % 4];
      add(head, CS.shell(0.28, 0.20, 0.27, { color: cap }, 0, Math.PI * 2, 0, Math.PI / 2)).position.y = 0.32;
      var brim = add(head, CS.cyl(0.17, 0.17, 0.025, { color: CS.shade(cap, -20) }, 0, 0.33, 0.20));
      brim.scale.z = 0.8;
      eh = Math.max(eh, 0.62);
    }

    // impatience mark, floating clear of whatever this species has on its head
    parts.mark = new THREE.Group();
    parts.mark.position.set(0, 0.26 + 0.52 + eh + 0.30, 0);
    parts.mark.visible = false;
    g.add(parts.mark);
    var RED = CS.mat({ color: 0xff3b2e, basic: true });
    add(parts.mark, CS.ball(0.07, 0.15, 0.07, RED, 0, 0.16, 0));
    add(parts.mark, CS.ball(0.06, 0.06, 0.06, RED, 0, -0.06, 0));
    CS.noMirror(parts.mark);

    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return { group: g, parts: parts, species: C };
  };

  /* A gold tip coin, tossed on the counter when a customer is happy. */
  CS.models.coin = function () {
    var g = new THREE.Group();
    var c = add(g, CS.cyl(0.09, 0.09, 0.025, { color: 0xf2bf3e, rough: 0.25, metal: 0.9 }, 0, 0, 0));
    c.rotation.x = Math.PI / 2;
    var f = add(g, CS.cyl(0.06, 0.06, 0.03, { color: 0xffde7a, rough: 0.3, metal: 0.8 }, 0, 0, 0));
    f.rotation.x = Math.PI / 2;
    return g;
  };

  /* ------------------------------------------------------------ the food
     Food is the thing you are staring at all shift, so it gets the most
     care: plump rounded shapes, craggy golden crusts, glossy sauces, and a
     touch of warm emissive so a fresh piece of chicken still glows a little
     in the shadow of a counter. */
  var WARM = 0x3a1a00;      // emissive lift for anything fresh out of the oil

  var CRUMBS = [
    [-0.13, -0.08, 0.075], [0.12, -0.10, 0.07], [-0.03, 0.12, 0.08], [0.15, 0.07, 0.06],
    [-0.16, 0.06, 0.06], [0.02, -0.01, 0.09], [0.07, 0.15, 0.05], [-0.09, -0.16, 0.05],
    [0.18, -0.02, 0.045], [-0.06, 0.04, 0.06]
  ];

  /* A plump fillet: a squashed ellipsoid with a craggy crust of lumps. */
  function chickenPatty(kind) {
    var g = new THREE.Group();
    var m, lumps = CRUMBS;
    if (kind === 'raw') {
      m = { color: 0xffffff, tex: 'rawMeat', rough: 0.35 };
      lumps = CRUMBS.slice(0, 3);
    } else if (kind === 'burnt') {
      m = { color: 0xffffff, tex: 'charred', rough: 0.9 };
    } else {
      m = { color: 0xffffff, tex: 'breading', emissive: WARM, rough: 0.55 };
    }
    add(g, CS.ball(0.25, 0.085, 0.21, m, 0, 0.08, 0));
    lumps.forEach(function (o, i) {
      add(g, CS.ball(o[2], o[2] * 0.75, o[2], m, o[0], 0.12 + (i % 3) * 0.01, o[1]));
    });
    return g;
  }

  /* A splayed bundle of fries, each a slim rounded stick. */
  function friesBundle(color, count, emissive) {
    var g = new THREE.Group();
    var mb = { color: color, emissive: emissive, rough: 0.5 };
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2;
      var r = 0.055 + (i % 2) * 0.025;
      var h = 0.26 + (i % 3) * 0.04;
      var f = add(g, CS.box(0.05, h, 0.05, mb, Math.cos(a) * r, h / 2, Math.sin(a) * r));
      f.rotation.z = Math.cos(a) * 0.24;
      f.rotation.x = -Math.sin(a) * 0.24;
    }
    return g;
  }

  /* The red carton, tapered, with a gold crest on the front and the fries
     fanned out over the top. */
  function friesCarton(burnt) {
    var g = new THREE.Group();
    var box = add(g, CS.cyl(0.17, 0.12, 0.25, { color: 0xd8382e, rough: 0.5 }, 0, 0.125, 0, 4));
    box.rotation.y = Math.PI / 4;
    var lip = add(g, CS.cyl(0.175, 0.17, 0.03, { color: 0xf0f0e8, rough: 0.6 }, 0, 0.235, 0, 4));
    lip.rotation.y = Math.PI / 4;
    add(g, CS.ball(0.04, 0.04, 0.012, { color: 0xf2c54a, rough: 0.3, metal: 0.6 }, 0, 0.14, 0.105));
    var f = burnt ? friesBundle(0x3a2f26, 10) : friesBundle(0xffc63f, 10, WARM);
    f.position.y = 0.10;
    f.scale.set(1.15, 0.9, 0.9);
    g.add(f);
    return g;
  }

  function sauceCup(sauce) {
    var g = new THREE.Group();
    add(g, CS.cyl(0.115, 0.09, 0.15, { color: 0xffffff, tex: 'plate', rough: 0.35 }, 0, 0.075, 0, 20));
    add(g, CS.torus(0.112, 0.012, 0, { color: 0xf4efe4, rough: 0.35 }, 0, 0.15, 0)).rotation.x = Math.PI / 2;
    if (sauce) {
      var col = CS.ING[sauce].color;
      var S = { color: col, rough: 0.12 };
      add(g, CS.cyl(0.104, 0.104, 0.02, S, 0, 0.148, 0, 20));
      add(g, CS.ball(0.07, 0.04, 0.07, S, 0.01, 0.16, 0));          // a dollop on top
      add(g, CS.ball(0.035, 0.035, 0.035, S, 0.015, 0.19, 0));
    }
    return g;
  }
  CS.models.sauceCup = sauceCup;

  /* Builds the stacked sandwich on a plate. Returns the height it consumed. */
  function buildSandwich(g, s, y) {
    var top = y;
    var BUN = { color: 0xffffff, tex: 'bun', emissive: 0x1a0c00, rough: 0.45 };
    add(g, CS.cyl(0.25, 0.24, 0.09, BUN, 0, top + 0.045, 0, 24));
    top += 0.09;

    s.sauces.forEach(function (id, i) {
      var c = { color: CS.ING[id].color, rough: 0.12 };
      add(g, CS.cyl(0.255, 0.255, 0.025, c, 0, top + 0.012, 0, 24));
      // a drip or two over the edge, so it looks squeezed on
      add(g, CS.ball(0.03, 0.05, 0.03, c, Math.cos(i * 2 + 0.6) * 0.25, top - 0.02, Math.sin(i * 2 + 0.6) * 0.25));
      add(g, CS.ball(0.025, 0.04, 0.025, c, Math.cos(i * 2 + 2.1) * 0.25, top - 0.015, Math.sin(i * 2 + 2.1) * 0.25));
      top += 0.025;
    });

    if (s.chicken) {
      var p = chickenPatty('fried');
      p.position.y = top - 0.02; p.scale.set(1.1, 1, 1.15);
      g.add(p);
      top += 0.17;
    }

    s.toppings.forEach(function (id) {
      var c = CS.ING[id].color;
      if (id === 'lettuce') {
        // a frilly leaf poking out past the bun all the way round
        add(g, CS.cyl(0.27, 0.27, 0.02, { color: c, rough: 0.5 }, 0, top + 0.01, 0, 24));
        for (var i = 0; i < 9; i++) {
          var a = i / 9 * Math.PI * 2;
          add(g, CS.ball(0.065, 0.025, 0.065, { color: i % 2 ? c : CS.shade(c, 22), rough: 0.5 },
            Math.cos(a) * 0.26, top + 0.01 + (i % 2) * 0.012, Math.sin(a) * 0.26));
        }
        top += 0.035;
      } else if (id === 'tomato') {
        [[-0.10, -0.06], [0.11, 0.07], [0.08, -0.12]].forEach(function (p, i) {
          add(g, CS.cyl(0.11, 0.11, 0.035, { color: c, rough: 0.25 }, p[0], top + 0.018 + i * 0.004, p[1], 18));
          add(g, CS.cyl(0.07, 0.07, 0.037, { color: 0xff8c78, rough: 0.3 }, p[0], top + 0.019 + i * 0.004, p[1], 18));
        });
        top += 0.045;
      } else { // pickles
        [[-0.11, 0.09], [0.12, -0.04], [0.02, -0.13], [-0.04, 0.0]].forEach(function (p, i) {
          add(g, CS.cyl(0.07, 0.07, 0.025, { color: i % 2 ? CS.shade(c, -14) : c, rough: 0.3 }, p[0], top + 0.013, p[1], 14));
          add(g, CS.cyl(0.035, 0.035, 0.027, { color: CS.shade(c, 40), rough: 0.3 }, p[0], top + 0.014, p[1], 12));
        });
        top += 0.03;
      }
    });

    // crown bun: a dome with a sheen and sesame seeds
    add(g, CS.cyl(0.26, 0.26, 0.04, BUN, 0, top + 0.02, 0, 24));
    add(g, CS.shell(0.265, 0.17, 0.265, BUN, 0, Math.PI * 2, 0, Math.PI / 2)).position.y = top + 0.035;
    [[-0.12, 0.07], [0.10, -0.10], [0.03, 0.14], [-0.14, -0.07], [0.15, 0.05],
     [-0.03, -0.15], [0.06, 0.03], [-0.06, -0.02]].forEach(function (p, i) {
      var d = Math.sqrt(p[0] * p[0] + p[1] * p[1]) / 0.265;
      var hY = 0.17 * Math.sqrt(Math.max(0, 1 - d * d));
      var seed = add(g, CS.ball(0.022, 0.01, 0.013, { color: 0xfff3d6, rough: 0.6 }, p[0], top + 0.035 + hY, p[1]));
      seed.rotation.y = i * 0.8;
    });
    return top + 0.22;
  }

  /* White glazed plate with a blue rim, like the good crockery. */
  function dish(g) {
    add(g, CS.cyl(0.44, 0.36, 0.05, { color: 0x3a5aa6, rough: 0.3 }, 0, 0.025, 0, 32));
    add(g, CS.cyl(0.40, 0.36, 0.056, { color: 0xffffff, tex: 'plate', rough: 0.25 }, 0, 0.028, 0, 32));
  }
  CS.models.dish = dish;

  /* item -> THREE.Group. `item` is the plain data object from interact.js */
  CS.models.item = function (item) {
    var g = new THREE.Group();
    if (!item) return g;

    switch (item.k) {
      case 'rawChicken':   g.add(chickenPatty('raw')); break;
      case 'friedChicken': g.add(chickenPatty('fried')); break;
      case 'burntChicken': g.add(chickenPatty('burnt')); break;
      case 'rawFries':     g.add(friesBundle(0xfbe9b8, 10)); break;
      case 'cookedFries':  g.add(friesCarton(false)); break;
      case 'burntFries':   g.add(friesCarton(true)); break;
      case 'cup':          g.add(sauceCup(item.sauce)); break;
      case 'plate': {
        dish(g);
        var y = 0.056;
        if (item.sandwich) {
          var sg = new THREE.Group();
          buildSandwich(sg, item.sandwich, 0);
          sg.position.set(item.fries ? -0.10 : 0, y, 0);
          sg.scale.setScalar(item.fries ? 0.86 : 1);
          g.add(sg);
        }
        if (item.fries) {
          var fc = friesCarton(false);
          fc.position.set(item.sandwich ? 0.24 : 0, y, item.sandwich ? 0.16 : 0);
          g.add(fc);
        }
        item.cups.forEach(function (s, i) {
          var c = sauceCup(s);
          var ang = -0.9 + i * 0.9;
          c.position.set(Math.sin(ang) * 0.30, y, -0.26 + Math.cos(ang) * 0.06);
          c.scale.setScalar(0.85);
          g.add(c);
        });
        break;
      }
    }
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return g;
  };

  /* ------------------------------------------------------------ steam
     The soft puff every steam and smoke particle is drawn with. */
  var puffTex = null;
  CS.models.puffTexture = function () {
    if (puffTex) return puffTex;
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d');
    var grd = x.createRadialGradient(32, 32, 0, 32, 32, 31);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.7)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
    puffTex = CS.srgb(new THREE.CanvasTexture(c));
    return puffTex;
  };

  /* -------------------------------------------------- floating progress bar */
  CS.models.bar = function (width) {
    width = width || 0.9;
    var g = new THREE.Group();
    var bg = CS.box(width + 0.10, 0.18, 0.05, CS.mat({ color: 0x1d2442, basic: true }), 0, 0, 0);
    var fill = CS.box(1, 0.10, 0.02, CS.mat({ color: 0x6fbf3a, basic: true }), 0, 0, 0.03);
    fill.scale.x = width;
    g.add(bg); g.add(fill);
    g.userData.set = function (t, color) {
      t = CS.clamp(t, 0, 1);
      fill.scale.x = Math.max(0.0001, width * t);
      fill.position.x = -(width * (1 - t)) / 2;
      fill.material = CS.mat({ color: color, basic: true });
    };
    return CS.noMirror(g);
  };

  /* --------------------------------------------- canvas-drawn signage
     Plaques over each station and boards on the walls. Text is drawn to a
     canvas once and shown on an unlit plane. */
  function textPlane(draw, cw, ch, worldW) {
    var c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    var x = c.getContext('2d');
    draw(x, cw, ch);
    var t = CS.srgb(new THREE.CanvasTexture(c));
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 4;
    return new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldW * ch / cw),
      new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  }

  function roundRect(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  }

  var SERIF = 'Georgia, "Times New Roman", serif';

  /* A parchment plaque with a coloured ribbon edge. */
  CS.models.label = function (text, accent, worldW) {
    var W = 512, H = 128;
    var plaque = textPlane(function (x) {
      roundRect(x, 6, 6, W - 12, H - 12, 34);
      x.fillStyle = accent || '#2f4f96'; x.fill();
      roundRect(x, 18, 18, W - 36, H - 36, 24);
      var g = x.createLinearGradient(0, 18, 0, H - 18);
      g.addColorStop(0, '#fbf3df'); g.addColorStop(1, '#ecdcb8');
      x.fillStyle = g; x.fill();
      x.fillStyle = '#3a2a1e';
      var size = text.length > 8 ? 54 : 66;
      x.font = 'bold ' + size + 'px ' + SERIF;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, W / 2, H / 2 + 4);
    }, W, H, worldW || 2.08);
    return CS.noMirror(plaque);
  };

  /* Pennant banner: royal blue cloth with a gold border and a little gold
     bird crest, cut to a point at the bottom. */
  CS.models.banner = function (worldW) {
    var W = 256, H = 384;
    return textPlane(function (x) {
      x.beginPath();
      x.moveTo(8, 8); x.lineTo(W - 8, 8); x.lineTo(W - 8, H - 90); x.lineTo(W / 2, H - 8);
      x.lineTo(8, H - 90); x.closePath();
      x.fillStyle = '#e2b347'; x.fill();
      x.beginPath();
      x.moveTo(22, 22); x.lineTo(W - 22, 22); x.lineTo(W - 22, H - 100); x.lineTo(W / 2, H - 30);
      x.lineTo(22, H - 100); x.closePath();
      var g = x.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#22397a'); g.addColorStop(0.5, '#2f4f96'); g.addColorStop(1, '#22397a');
      x.fillStyle = g; x.fill();
      // the crest: a plump little bird in gold
      x.fillStyle = '#e8bb4c';
      x.beginPath(); x.ellipse(W / 2, 190, 52, 46, 0, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.ellipse(W / 2 + 6, 126, 34, 32, 0, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.moveTo(W / 2 + 36, 120); x.lineTo(W / 2 + 66, 132); x.lineTo(W / 2 + 36, 140); x.fill();
      x.beginPath(); x.ellipse(W / 2 - 30, 178, 30, 18, -0.6, 0, Math.PI * 2); x.fillStyle = '#c99a32'; x.fill();
      x.fillStyle = '#22397a';
      x.beginPath(); x.arc(W / 2 + 16, 120, 6, 0, Math.PI * 2); x.fill();
    }, W, H, worldW || 1.1);
  };

  CS.models.signBoard = function (lines, worldW) {
    var W = 320, H = 80 + lines.length * 52;
    return textPlane(function (x) {
      roundRect(x, 4, 4, W - 8, H - 8, 22);
      x.fillStyle = '#7a4f2c'; x.fill();
      roundRect(x, 16, 16, W - 32, H - 32, 14);
      x.fillStyle = '#2e3a36'; x.fill();                      // chalkboard
      x.fillStyle = '#f4efe2';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      lines.forEach(function (ln, i) {
        x.font = 'italic bold ' + (ln.length > 9 ? 34 : 40) + 'px ' + SERIF;
        x.fillText(ln, W / 2, 54 + i * 52);
      });
      x.strokeStyle = '#e8bb4c'; x.lineWidth = 4;                // a little leaf flourish
      x.beginPath(); x.moveTo(W / 2 - 40, H - 34); x.quadraticCurveTo(W / 2, H - 52, W / 2 + 40, H - 34); x.stroke();
    }, W, H, worldW || 1.9);
  };

  /* The view through the arched window: a soft sky, distant hills and a
     white castle with blue spires. */
  CS.models.skyPane = function (worldW, worldH) {
    var W = 384, H = Math.round(384 * (worldH || worldW * 0.6) / worldW);
    return textPlane(function (x) {
      var g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#7fb6ea'); g.addColorStop(0.7, '#cfe6f7'); g.addColorStop(1, '#f2eadb');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(255,255,255,0.85)';
      [[60, 60, 40], [100, 52, 30], [290, 80, 44], [330, 70, 30], [200, 40, 24]].forEach(function (c) {
        x.beginPath(); x.arc(c[0], c[1], c[2], 0, Math.PI * 2); x.fill();
      });
      // castle
      var base = H * 0.72;
      x.fillStyle = '#e6e8f2';
      [[150, 70, 14], [182, 110, 18], [222, 92, 16], [250, 60, 12]].forEach(function (t) {
        x.fillRect(t[0] - t[2], base - t[1], t[2] * 2, t[1]);
      });
      x.fillRect(130, base - 46, 140, 46);
      x.fillStyle = '#5a7cc4';
      [[150, 70, 14], [182, 110, 18], [222, 92, 16], [250, 60, 12]].forEach(function (t) {
        x.beginPath(); x.moveTo(t[0] - t[2] - 3, base - t[1]); x.lineTo(t[0], base - t[1] - t[2] * 2.6);
        x.lineTo(t[0] + t[2] + 3, base - t[1]); x.fill();
      });
      x.fillStyle = '#b9c2dc';
      [[160, base - 30], [200, base - 60], [240, base - 40]].forEach(function (w) { x.fillRect(w[0], w[1], 6, 10); });
      // hills
      x.fillStyle = '#8fbf72';
      x.beginPath(); x.moveTo(0, H); x.lineTo(0, base); x.quadraticCurveTo(W * 0.3, base - 30, W * 0.55, base + 4);
      x.quadraticCurveTo(W * 0.8, base - 26, W, base - 6); x.lineTo(W, H); x.fill();
      x.fillStyle = '#6fa45a';
      x.beginPath(); x.moveTo(0, H); x.lineTo(0, base + 24); x.quadraticCurveTo(W * 0.5, base, W, base + 30); x.lineTo(W, H); x.fill();
    }, W, H, worldW || 3.0);
  };

  /* Framed food picture for the wall -- drumstick, tomato or lettuce. */
  CS.models.foodFrame = function (kind, worldW) {
    var W = 128, H = 128;
    return textPlane(function (x) {
      roundRect(x, 2, 2, W - 4, H - 4, 10); x.fillStyle = '#b8862e'; x.fill();
      roundRect(x, 12, 12, W - 24, H - 24, 6); x.fillStyle = '#f6eedc'; x.fill();
      var cx = W / 2, cy = H / 2;
      if (kind === 'drumstick') {
        x.fillStyle = '#f2e6cf';
        x.beginPath(); x.ellipse(cx + 20, cy + 22, 9, 9, 0, 0, Math.PI * 2); x.fill();
        x.fillRect(cx + 4, cy + 6, 14, 10);
        x.fillStyle = '#d9862a';
        x.beginPath(); x.ellipse(cx - 6, cy - 6, 28, 22, -0.7, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#f2b45e';
        x.beginPath(); x.ellipse(cx - 12, cy - 12, 12, 8, -0.7, 0, Math.PI * 2); x.fill();
      } else if (kind === 'tomato') {
        x.fillStyle = '#d6402f';
        x.beginPath(); x.arc(cx, cy + 6, 30, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#ff8a78';
        x.beginPath(); x.ellipse(cx - 12, cy - 4, 8, 5, -0.6, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#4e9634';
        x.beginPath(); x.ellipse(cx, cy - 24, 16, 6, 0, 0, Math.PI * 2); x.fill();
      } else {
        x.fillStyle = '#4e9634';
        x.beginPath(); x.arc(cx, cy, 30, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#8fd065'; x.lineWidth = 3;
        x.beginPath(); x.moveTo(cx, cy + 26); x.lineTo(cx, cy - 22); x.stroke();
      }
    }, W, H, worldW || 0.9);
  };

  /* Soft blob under the chef -- reads much better than a cast shadow alone. */
  CS.models.blobShadow = function () {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d');
    var grd = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, 'rgba(50,34,24,0.45)');
    grd.addColorStop(0.6, 'rgba(50,34,24,0.22)');
    grd.addColorStop(1, 'rgba(50,34,24,0)');
    x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
    var t = CS.srgb(new THREE.CanvasTexture(c));
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 2;
    CS.noMirror(m);
    return m;
  };

  /* ------------------------------------------------------------ the staff
     Your hires are the ingredients themselves, grown legs and an apron:
     round little veggies with big glossy eyes. A tomato is shiny and red
     with a leafy crown; a potato is lumpy and wears a paper cap. `hold` is
     an empty slot their cargo gets parented to, so whatever they are
     carrying rides in front of them. */
  CS.models.assistant = function (kind) {
    var g = new THREE.Group();
    var parts = { kind: kind };

    var spud = kind === 'potato';
    var SKIN = spud ? { color: 0xd9a868, tex: 'fluff', rough: 0.85 } : { color: 0xe8392b, rough: 0.28 };
    var SKIN_D = spud ? { color: 0xb98a4e, rough: 0.85 } : { color: 0xc22a20, rough: 0.3 };
    var EYE = { color: 0x1e1828, rough: 0.15 };
    var SHINE = { color: 0xffffff, rough: 0.2 };

    var body = new THREE.Group();
    body.position.y = 0.30;
    g.add(body);
    parts.body = body;

    var BY = 0.40;
    if (spud) {
      add(body, CS.ball(0.33, 0.39, 0.30, SKIN, 0, BY, 0));
      [[0.22, 0.55, 0.12, 0.10], [-0.25, 0.30, 0.10, 0.11], [0.10, 0.16, 0.20, 0.09]].forEach(function (b) {
        add(body, CS.ball(b[3], b[3] * 0.9, b[3], SKIN, b[0], b[1], b[2] * 0.5));
      });
      [[0.24, 0.24, 0.20], [-0.20, 0.55, 0.18], [0.05, 0.70, 0.17]].forEach(function (s) {
        add(body, CS.ball(0.025, 0.02, 0.02, SKIN_D, s[0], s[1], s[2]));
      });
      // paper cap with a blue band
      add(body, CS.cyl(0.20, 0.22, 0.12, { color: 0xfbf8f1 }, 0, BY + 0.40, -0.02, 20));
      add(body, CS.cyl(0.222, 0.225, 0.025, { color: 0x2f4f96 }, 0, BY + 0.35, -0.02, 20));
      add(body, CS.ball(0.20, 0.08, 0.18, { color: 0xfbf8f1 }, 0, BY + 0.47, -0.02));
    } else {
      add(body, CS.ball(0.38, 0.34, 0.37, SKIN, 0, BY, 0));
      add(body, CS.ball(0.10, 0.06, 0.04, { color: 0xffb9ab, rough: 0.2 }, -0.17, BY + 0.17, 0.30)).rotation.z = 0.5;
      // leafy crown: a star of leaves round a little stalk
      for (var i = 0; i < 5; i++) {
        var a = i / 5 * Math.PI * 2;
        var lf = add(body, CS.ball(0.06, 0.02, 0.13, { color: 0x4fae3a, rough: 0.6 },
          Math.sin(a) * 0.09, BY + 0.33, Math.cos(a) * 0.09));
        lf.rotation.y = a;
        lf.rotation.x = 0.35;
      }
      add(body, CS.cyl(0.02, 0.025, 0.10, { color: 0x3d8a2a }, 0, BY + 0.38, 0, 8));
    }

    // apron bib in white with blue piping, so they read as staff
    var R = spud ? [0.33, 0.39, 0.30] : [0.38, 0.34, 0.37];
    var apron = add(body, CS.shell(R[0] * 1.03, R[1] * 1.03, R[2] * 1.03, { color: 0xfbf8f1 },
      Math.PI / 2 - 0.6, 1.2, 1.55, 0.8));
    apron.position.y = BY;
    var pipe = add(body, CS.shell(R[0] * 1.04, R[1] * 1.04, R[2] * 1.04, { color: 0x2f4f96 },
      Math.PI / 2 - 0.62, 1.24, 2.30, 0.06));
    pipe.position.y = BY;

    // the face: big glossy eyes with catchlights, rosy cheeks, a little smile
    var FZ = R[2] * 0.93;
    [-1, 1].forEach(function (s) {
      add(body, CS.ball(0.06, 0.08, 0.03, EYE, s * 0.12, BY + 0.10, FZ));
      add(body, CS.ball(0.022, 0.026, 0.01, SHINE, s * 0.12 - 0.02, BY + 0.14, FZ + 0.03));
      add(body, CS.ball(0.055, 0.03, 0.015, { color: 0xff9db2, rough: 0.9 }, s * 0.22, BY + 0.0, FZ - 0.04)).rotation.y = s * 0.5;
    });
    var smile = add(body, CS.torus(0.05, 0.012, Math.PI, { color: 0x5a1a1a }, 0, BY + 0.02, FZ + 0.02));
    smile.rotation.z = Math.PI;

    // stubby arms and legs, pivoting at the shoulder and hip
    var LIMB = SKIN_D, GLOVE = { color: 0xfbf8f1 }, BOOT = { color: 0x2f4f96, rough: 0.5 };
    [-1, 1].forEach(function (s, i) {
      var arm = new THREE.Group();
      arm.position.set(s * (R[0] - 0.02), BY - 0.02, 0);
      add(arm, CS.ball(0.05, 0.11, 0.05, LIMB, s * 0.02, -0.09, 0));
      add(arm, CS.ball(0.06, 0.055, 0.06, GLOVE, s * 0.03, -0.20, 0));
      body.add(arm);
      parts[i ? 'armR' : 'armL'] = arm;

      var leg = new THREE.Group();
      leg.position.set(s * 0.13, BY - R[1] + 0.06, 0);
      add(leg, CS.ball(0.05, 0.09, 0.05, LIMB, 0, -0.06, 0));
      add(leg, CS.ball(0.08, 0.05, 0.11, BOOT, 0, -0.15, 0.03));
      body.add(leg);
      parts[i ? 'legR' : 'legL'] = leg;
    });

    // where their cargo rides
    var hold = new THREE.Object3D();
    hold.position.set(0, 0.62, R[2] + 0.16);
    g.add(hold);
    parts.hold = hold;

    // "..." over the head while they have nothing to do, so an idle hire is
    // visibly idle rather than looking broken
    parts.mark = new THREE.Group();
    parts.mark.position.set(0, 1.42, 0);
    parts.mark.visible = false;
    g.add(parts.mark);
    [-0.14, 0, 0.14].forEach(function (x) {
      add(parts.mark, CS.ball(0.05, 0.05, 0.05, CS.mat({ color: 0xffffff, basic: true }), x, 0, 0));
    });
    CS.noMirror(parts.mark);

    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return { group: g, parts: parts };
  };

  /* A round thought bubble that floats over a hand with the thing they are
     working on inside it. The caller billboards `group` to the camera and
     puts the icon in `icon`; setAlert() turns the bubble amber when they are
     stood waiting with nowhere to put something down. */
  function bubbleTexture(fill, edge) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d');
    x.fillStyle = edge;
    x.beginPath(); x.arc(64, 60, 54, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(36, 116, 10, 0, Math.PI * 2); x.fill();
    x.fillStyle = fill;
    x.beginPath(); x.arc(64, 60, 47, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(36, 116, 6, 0, Math.PI * 2); x.fill();
    return CS.srgb(new THREE.CanvasTexture(c));
  }
  var BUBBLE_TEX = null;

  CS.models.thoughtBubble = function () {
    if (!BUBBLE_TEX) {
      BUBBLE_TEX = {
        calm: bubbleTexture('#fffaf0', '#2f4f96'),
        alert: bubbleTexture('#fff3c4', '#e8902a')
      };
    }
    var group = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ map: BUBBLE_TEX.calm, transparent: true, depthWrite: false });
    group.add(new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), mat));
    var icon = new THREE.Group();
    icon.position.set(0, 0.0, 0.3);
    icon.rotation.x = 0.55;
    var inner = new THREE.Group();
    inner.position.y = -0.12;
    icon.add(inner);
    group.add(icon);
    CS.noMirror(group);
    var alert = false;
    return {
      group: group, icon: inner, pop: 0,
      setAlert: function (on) {
        if (on === alert) return;
        alert = on;
        mat.map = on ? BUBBLE_TEX.alert : BUBBLE_TEX.calm;
        mat.needsUpdate = true;
      }
    };
  };

  /* A soft glowing ring that marks the station you are pointing at. */
  CS.models.highlight = function () {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d');
    x.strokeStyle = '#ffd464'; x.lineWidth = 10;
    roundRect(x, 10, 10, 108, 108, 26); x.stroke();
    x.fillStyle = 'rgba(255,212,100,0.22)';
    roundRect(x, 10, 10, 108, 108, 26); x.fill();
    var t = CS.srgb(new THREE.CanvasTexture(c));
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.9, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 5;
    CS.noMirror(m);
    return m;
  };
})(window.CS);
