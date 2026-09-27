/* Voxel model builders — the chef, the customers, every food item.
   Everything is boxes so it reads as chunky pixel art like the reference. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var matCache = {};
  var BOX = new THREE.BoxGeometry(1, 1, 1);

  /* Bake Minecraft-style directional face shading straight into the shared box
     geometry: top faces bright, bottom dark, sides in between. Every block in
     the game picks this up for free, which is most of what gives voxel art its
     readable, chunky look. Face order is +x, -x, +y, -y, +z, -z. */
  (function shadeBoxFaces() {
    var shades = [0.80, 0.66, 1.0, 0.50, 0.92, 0.74];
    var colors = [];
    for (var f = 0; f < 6; f++) {
      for (var v = 0; v < 4; v++) colors.push(shades[f], shades[f], shades[f]);
    }
    BOX.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  })();

  CS.mat = function (o) {
    o = o || {};
    var key = [o.color || 0xffffff, o.tex || '-', o.emissive || 0,
      o.opacity == null ? 1 : o.opacity, o.basic ? 1 : 0, o.vc ? 1 : 0].join('|');
    if (matCache[key]) return matCache[key];
    var params = {
      color: o.color == null ? 0xffffff : o.color,
      transparent: o.opacity != null && o.opacity < 1,
      opacity: o.opacity == null ? 1 : o.opacity
    };
    if (o.tex) params.map = CS.tex(o.tex);
    if (o.emissive) params.emissive = o.emissive;
    if (o.vc) params.vertexColors = true;
    var m = o.basic ? new THREE.MeshBasicMaterial(params) : new THREE.MeshLambertMaterial(params);
    matCache[key] = m;
    return m;
  };

  /* box(w,h,d, material-or-color-or-opts, x,y,z)
     Colour/option forms get the face-shaded material; a material passed in
     directly is used as-is (particles, glows, anything deliberately flat). */
  CS.box = function (w, h, d, m, x, y, z) {
    var mat;
    if (m && m.isMaterial) {
      mat = m;
    } else {
      var o = (typeof m === 'number') ? { color: m } : (m || {});
      mat = CS.mat({ color: o.color, tex: o.tex, emissive: o.emissive, opacity: o.opacity, basic: o.basic, vc: true });
    }
    var mesh = new THREE.Mesh(BOX, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  function add(parent, mesh) { parent.add(mesh); return mesh; }

  CS.models = {};

  /* ------------------------------------------------------------ the chef
     Built from a lot of small blocks rather than a few big ones, so the face
     shading has edges to work with and the silhouette reads at a distance.
     Every animated piece gets its own pivot group. */
  CS.models.chef = function () {
    var g = new THREE.Group();
    var parts = {};

    var PLUME = { color: 0xfaf8f1, tex: 'feathers' };   // body feathers
    var PLUME_D = { color: 0xe4e0d4, tex: 'feathers' }; // shaded underside
    var QUILL = { color: 0xd6d1c2, tex: 'feathers' };   // wing + tail tips
    var SHIN = 0xe8a134, FOOT = 0xd08418, CLAW = 0xb86f10;
    var COMB = 0xc9302a, BEAK = 0xf0a52c, BEAK_D = 0xd4821a;

    /* ---- legs: thigh + shin + three-toed foot, pivoting at the hip ---- */
    var hips = new THREE.Group(); hips.position.y = 0.32; g.add(hips);
    ['legL', 'legR'].forEach(function (id, i) {
      var s = i ? 1 : -1;
      var leg = new THREE.Group();
      leg.position.set(s * 0.13, 0, 0);
      hips.add(leg);
      add(leg, CS.box(0.15, 0.13, 0.15, PLUME_D, 0, -0.05, 0));      // feathered thigh
      add(leg, CS.box(0.10, 0.20, 0.10, SHIN, 0, -0.21, 0));          // scaly shin
      add(leg, CS.box(0.12, 0.06, 0.12, FOOT, 0, -0.33, 0));          // ankle
      add(leg, CS.box(0.07, 0.05, 0.20, FOOT, 0, -0.35, 0.09));       // middle toe
      var t1 = add(leg, CS.box(0.06, 0.05, 0.15, FOOT, -0.06, -0.35, 0.06));
      var t2 = add(leg, CS.box(0.06, 0.05, 0.15, FOOT, 0.06, -0.35, 0.06));
      t1.rotation.y = 0.45; t2.rotation.y = -0.45;
      add(leg, CS.box(0.06, 0.05, 0.11, CLAW, 0, -0.35, -0.07));      // back spur
      parts[id] = leg;
    });

    /* ---- body ---- */
    var body = new THREE.Group(); body.position.y = 0.28; g.add(body);
    parts.body = body;
    add(body, CS.box(0.58, 0.52, 0.42, PLUME, 0, 0.28, 0));           // torso
    add(body, CS.box(0.52, 0.17, 0.38, PLUME_D, 0, 0.04, 0));         // belly
    add(body, CS.box(0.46, 0.13, 0.10, PLUME, 0, 0.45, 0.19));        // collar ruff
    add(body, CS.box(0.30, 0.22, 0.08, PLUME_D, 0, 0.44, -0.20));     // shoulder hump

    // tail: three fanned quills on their own pivot so they can sway
    parts.tail = new THREE.Group();
    parts.tail.position.set(0, 0.32, -0.19);
    body.add(parts.tail);
    [[-0.11, 0.05, -0.30], [0, 0.11, 0], [0.11, 0.05, 0.30]].forEach(function (q, i) {
      var f = add(parts.tail, CS.box(0.13, 0.26, 0.10, i === 1 ? PLUME : QUILL, q[0], q[1], -0.06));
      f.rotation.x = -0.55;
      f.rotation.z = q[2];
    });

    // apron: bib, waist band and two ties
    add(body, CS.box(0.46, 0.36, 0.03, { color: 0xffffff, tex: 'checker' }, 0, 0.24, 0.252));
    add(body, CS.box(0.54, 0.10, 0.05, { color: 0xc23a2c }, 0, 0.06, 0.245));
    add(body, CS.box(0.06, 0.22, 0.03, { color: 0xc23a2c }, -0.17, 0.49, 0.235));
    add(body, CS.box(0.06, 0.22, 0.03, { color: 0xc23a2c }, 0.17, 0.49, 0.235));
    add(body, CS.box(0.07, 0.12, 0.03, { color: 0xa82e22 }, -0.25, 0.04, 0.10));
    add(body, CS.box(0.07, 0.12, 0.03, { color: 0xa82e22 }, 0.25, 0.04, 0.10));

    /* ---- wings: upper arm + primary feathers, pivot at the shoulder ---- */
    ['wingL', 'wingR'].forEach(function (id, i) {
      var s = i ? 1 : -1;
      var w = new THREE.Group();
      w.position.set(s * 0.31, 0.46, 0);
      body.add(w);
      add(w, CS.box(0.11, 0.28, 0.26, PLUME, s * 0.04, -0.13, 0.01));
      add(w, CS.box(0.09, 0.16, 0.30, QUILL, s * 0.06, -0.31, -0.02));   // primaries
      add(w, CS.box(0.08, 0.07, 0.12, QUILL, s * 0.07, -0.40, -0.10));   // tip
      parts[id] = w;
    });

    /* ---- head ---- */
    var head = new THREE.Group(); head.position.set(0, 0.60, 0.02); body.add(head);
    parts.head = head;
    add(head, CS.box(0.30, 0.16, 0.28, PLUME_D, 0, 0.02, 0));         // neck
    add(head, CS.box(0.44, 0.38, 0.40, PLUME, 0, 0.22, 0));           // skull
    add(head, CS.box(0.34, 0.10, 0.32, PLUME_D, 0, 0.06, 0.01));      // jaw shadow
    add(head, CS.box(0.14, 0.12, 0.14, PLUME, -0.14, 0.24, -0.10));   // cheek tufts
    add(head, CS.box(0.14, 0.12, 0.14, PLUME, 0.14, 0.24, -0.10));

    // eyes on their own group so they can blink
    parts.eyes = new THREE.Group();
    head.add(parts.eyes);
    [-1, 1].forEach(function (s) {
      add(parts.eyes, CS.box(0.11, 0.12, 0.02, { color: 0xf6f3ea }, s * 0.11, 0.25, 0.181));
      add(parts.eyes, CS.box(0.07, 0.09, 0.02, { color: 0x161210 }, s * 0.115, 0.25, 0.191));
      add(parts.eyes, CS.box(0.03, 0.03, 0.02, { color: 0xffffff }, s * 0.09, 0.28, 0.20));
    });

    // beak in two halves, with the lower one able to open
    add(head, CS.box(0.19, 0.09, 0.16, BEAK, 0, 0.165, 0.235));
    add(head, CS.box(0.13, 0.04, 0.12, BEAK_D, 0, 0.215, 0.27));      // ridge
    parts.jaw = new THREE.Group(); parts.jaw.position.set(0, 0.12, 0.17); head.add(parts.jaw);
    add(parts.jaw, CS.box(0.16, 0.05, 0.13, BEAK_D, 0, 0, 0.07));
    // wattle under the beak
    add(head, CS.box(0.09, 0.14, 0.07, COMB, -0.04, 0.02, 0.20));
    add(head, CS.box(0.07, 0.10, 0.06, 0xb02a24, 0.05, 0.04, 0.20));

    // the toque: band, stalk, puff, crown, plus a couple of fold ridges
    var hat = new THREE.Group(); hat.position.set(0, 0.40, 0); head.add(hat);
    parts.hat = hat;
    add(hat, CS.box(0.50, 0.11, 0.46, { color: 0xeae7dc }, 0, 0.03, 0));   // brim band
    add(hat, CS.box(0.44, 0.15, 0.41, { color: 0xf7f5ee }, 0, 0.15, 0));   // stalk
    add(hat, CS.box(0.64, 0.26, 0.58, { color: 0xfdfcf8 }, 0, 0.35, 0));   // wide puff
    add(hat, CS.box(0.54, 0.12, 0.50, { color: 0xffffff }, 0, 0.53, 0));   // crown
    [-0.20, 0.0, 0.20].forEach(function (fx) {                             // fold ridges
      add(hat, CS.box(0.06, 0.26, 0.03, { color: 0xe6e2d5 }, fx, 0.35, 0.30));
    });

    // where a carried item sits
    parts.hands = new THREE.Object3D();
    parts.hands.position.set(0, 0.42, 0.40);
    body.add(parts.hands);

    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    return { group: g, parts: parts };
  };

  /* -------------------------------------------------------- the customer */
  CS.models.customer = function (shirt, seed) {
    var g = new THREE.Group();
    var parts = {};
    var skin = [0xe0b48a, 0xc08a5e, 0x8d5f3c, 0xf0cba6][seed % 4];

    var hips = new THREE.Group(); hips.position.y = 0.34; g.add(hips);
    ['legL', 'legR'].forEach(function (id, i) {
      var leg = new THREE.Group();
      leg.position.set(i ? 0.12 : -0.12, 0, 0);
      hips.add(leg);
      add(leg, CS.box(0.16, 0.34, 0.16, 0x3c3a52, 0, -0.17, 0));
      parts[id] = leg;
    });

    var body = new THREE.Group(); body.position.y = 0.34; g.add(body); parts.body = body;
    add(body, CS.box(0.46, 0.52, 0.30, shirt, 0, 0.26, 0));
    add(body, CS.box(0.46, 0.10, 0.31, CS.shade(shirt, -40), 0, 0.06, 0));
    parts.armL = new THREE.Group(); parts.armL.position.set(-0.30, 0.46, 0); body.add(parts.armL);
    add(parts.armL, CS.box(0.13, 0.40, 0.15, shirt, 0, -0.18, 0));
    add(parts.armL, CS.box(0.14, 0.12, 0.16, skin, 0, -0.42, 0));
    parts.armR = new THREE.Group(); parts.armR.position.set(0.30, 0.46, 0); body.add(parts.armR);
    add(parts.armR, CS.box(0.13, 0.40, 0.15, shirt, 0, -0.18, 0));
    add(parts.armR, CS.box(0.14, 0.12, 0.16, skin, 0, -0.42, 0));

    var head = new THREE.Group(); head.position.set(0, 0.56, 0); body.add(head); parts.head = head;
    add(head, CS.box(0.38, 0.38, 0.34, skin, 0, 0.19, 0));
    add(head, CS.box(0.40, 0.12, 0.36, [0x3a2a1c, 0x6b4a2a, 0x2b2b2b, 0xa8712f][seed % 4], 0, 0.36, 0));
    add(head, CS.box(0.08, 0.09, 0.02, 0x1a1512, -0.09, 0.22, 0.171));
    add(head, CS.box(0.08, 0.09, 0.02, 0x1a1512, 0.09, 0.22, 0.171));
    add(head, CS.box(0.10, 0.12, 0.09, CS.shade(skin, -18), 0, 0.13, 0.19));  // nose

    // impatience mark, shown when the ticket is nearly out of time
    parts.mark = new THREE.Group(); parts.mark.position.set(0, 1.55, 0); parts.mark.visible = false; g.add(parts.mark);
    add(parts.mark, CS.box(0.10, 0.26, 0.10, CS.mat({ color: 0xff3b2e, basic: true }), 0, 0.16, 0));
    add(parts.mark, CS.box(0.10, 0.10, 0.10, CS.mat({ color: 0xff3b2e, basic: true }), 0, -0.04, 0));

    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return { group: g, parts: parts };
  };

  /* ------------------------------------------------------------ the food */
  var CHUNK_OFFSETS = [
    [-0.14, 0.0, -0.10], [0.13, 0.01, -0.12], [-0.05, 0.02, 0.12],
    [0.16, 0.0, 0.09], [-0.17, 0.01, 0.06], [0.03, 0.03, -0.02]
  ];

  function chickenPatty(texName, tint) {
    var g = new THREE.Group();
    var m = { color: tint, tex: texName };
    g.add(CS.box(0.46, 0.13, 0.42, m, 0, 0.065, 0));
    CHUNK_OFFSETS.forEach(function (o, i) {
      var s = 0.11 + (i % 3) * 0.03;
      g.add(CS.box(s, 0.08, s, m, o[0] * 0.85, 0.12 + o[1], o[2] * 0.85));
    });
    return g;
  }

  function friesBundle(color, count) {
    var g = new THREE.Group();
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2;
      var f = CS.box(0.055, 0.30, 0.055, color,
        Math.cos(a) * 0.075 + (i % 2) * 0.015, 0.16, Math.sin(a) * 0.075);
      f.rotation.z = (i % 3 - 1) * 0.16;
      f.rotation.x = ((i + 1) % 3 - 1) * 0.16;
      g.add(f);
    }
    return g;
  }

  function friesCarton(color) {
    var g = new THREE.Group();
    g.add(CS.box(0.26, 0.24, 0.20, 0xc0392b, 0, 0.12, 0));
    g.add(CS.box(0.28, 0.06, 0.22, 0xe05a45, 0, 0.21, 0));
    var f = friesBundle(color, 7); f.position.y = 0.12; f.scale.set(0.62, 0.72, 0.62);
    g.add(f);
    return g;
  }

  function sauceCup(sauce) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.09, 0.15, 8),
      CS.mat({ color: 0xf6f3ea, tex: 'plate' }));
    body.position.y = 0.075; body.castShadow = true; g.add(body);
    if (sauce) {
      var top = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.03, 8),
        CS.mat({ color: CS.ING[sauce].color }));
      top.position.y = 0.145; g.add(top);
    }
    return g;
  }
  CS.models.sauceCup = sauceCup;

  /* Builds the stacked sandwich on a plate. Returns the height it consumed. */
  function buildSandwich(g, s, y) {
    var top = y;
    g.add(CS.box(0.50, 0.10, 0.50, { color: 0xc78f47, tex: 'bun' }, 0, top + 0.05, 0));
    top += 0.10;

    s.sauces.forEach(function (id) {
      g.add(CS.box(0.47, 0.035, 0.47, { color: CS.ING[id].color }, 0, top + 0.017, 0));
      top += 0.035;
    });

    if (s.chicken) {
      var p = chickenPatty('breading', 0xffffff);
      p.position.y = top; p.scale.set(1.02, 1, 1.02);
      g.add(p);
      top += 0.20;
    }

    s.toppings.forEach(function (id) {
      var c = CS.ING[id].color;
      if (id === 'lettuce') {
        for (var i = 0; i < 4; i++) {
          var lf = CS.box(0.30, 0.035, 0.22, { color: i % 2 ? c : CS.shade(c, 22) },
            (i % 2 ? 0.10 : -0.10), top + 0.02, (i < 2 ? 0.11 : -0.11));
          lf.rotation.y = i * 0.5; g.add(lf);
        }
        top += 0.05;
      } else if (id === 'tomato') {
        g.add(CS.box(0.22, 0.05, 0.22, { color: c }, -0.11, top + 0.025, -0.08));
        g.add(CS.box(0.22, 0.05, 0.22, { color: CS.shade(c, 18) }, 0.11, top + 0.025, 0.08));
        top += 0.05;
      } else { // pickles
        g.add(CS.box(0.16, 0.04, 0.16, { color: c }, -0.12, top + 0.02, 0.10));
        g.add(CS.box(0.16, 0.04, 0.16, { color: CS.shade(c, -20) }, 0.13, top + 0.02, -0.05));
        g.add(CS.box(0.16, 0.04, 0.16, { color: c }, 0.02, top + 0.02, -0.14));
        top += 0.04;
      }
    });

    // crown bun with sesame
    g.add(CS.box(0.50, 0.14, 0.50, { color: 0xd9a458, tex: 'bun' }, 0, top + 0.07, 0));
    g.add(CS.box(0.42, 0.06, 0.42, { color: 0xe2b268 }, 0, top + 0.16, 0));
    [[-0.12, 0.07], [0.10, -0.09], [0.02, 0.13], [-0.14, -0.10]].forEach(function (p) {
      g.add(CS.box(0.045, 0.02, 0.045, 0xf6e8c8, p[0], top + 0.195, p[1]));
    });
    return top + 0.21;
  }

  /* item -> THREE.Group. `item` is the plain data object from interact.js */
  CS.models.item = function (item) {
    var g = new THREE.Group();
    if (!item) return g;

    switch (item.k) {
      case 'rawChicken':   g.add(chickenPatty('feathers', 0xe7a99e)); break;
      case 'friedChicken': g.add(chickenPatty('breading', 0xffffff)); break;
      case 'burntChicken': g.add(chickenPatty('charred', 0xffffff)); break;
      case 'rawFries':     g.add(friesBundle({ color: 0xf0e2ad }, 8)); break;
      case 'cookedFries':  g.add(friesCarton({ color: 0xf0b53c })); break;
      case 'burntFries':   g.add(friesCarton({ color: 0x3a2f26 })); break;
      case 'cup':          g.add(sauceCup(item.sauce)); break;
      case 'plate': {
        var dish = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.38, 0.055, 12),
          CS.mat({ color: 0xf2efe6, tex: 'plate' }));
        dish.position.y = 0.028; dish.castShadow = true; dish.receiveShadow = true;
        g.add(dish);
        var y = 0.055;
        if (item.sandwich) {
          var sg = new THREE.Group();
          buildSandwich(sg, item.sandwich, 0);
          sg.position.set(item.fries ? -0.10 : 0, y, 0);
          sg.scale.setScalar(item.fries ? 0.86 : 1);
          g.add(sg);
        }
        if (item.fries) {
          var fc = friesCarton({ color: 0xf0b53c });
          fc.position.set(item.sandwich ? 0.26 : 0, y, item.sandwich ? 0.16 : 0);
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

  /* -------------------------------------------------- floating progress bar */
  CS.models.bar = function (width) {
    width = width || 0.9;
    var g = new THREE.Group();
    var bg = CS.box(width + 0.08, 0.16, 0.05, CS.mat({ color: 0x1a120b, basic: true }), 0, 0, 0);
    var fill = CS.box(width, 0.10, 0.02, CS.mat({ color: 0x6fbf3a, basic: true }), 0, 0, 0.03);
    fill.scale.x = width;
    g.add(bg); g.add(fill);
    g.userData.set = function (t, color) {
      t = CS.clamp(t, 0, 1);
      fill.scale.x = Math.max(0.0001, width * t);
      fill.position.x = -(width * (1 - t)) / 2;
      fill.material = CS.mat({ color: color, basic: true });
    };
    return g;
  };

  /* --------------------------------------------- canvas-drawn signage
     Small plaques over each station and bigger boards on the walls. Text is
     drawn to a canvas and sampled with NearestFilter so it stays pixel-crisp. */
  function textPlane(draw, cw, ch, worldW) {
    var c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    draw(x, cw, ch);
    var t = new THREE.CanvasTexture(c);
    // text stays legible at this camera distance with linear sampling
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    var m = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldW * ch / cw),
      new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    return m;
  }

  CS.models.label = function (text, accent) {
    var W = 256, H = 64;
    return textPlane(function (x) {
      x.fillStyle = '#f4e4c1'; x.fillRect(0, 0, W, H);
      x.fillStyle = accent || '#8a5a2b';
      x.fillRect(0, 0, W, 7); x.fillRect(0, H - 7, W, 7);
      x.fillRect(0, 0, 7, H); x.fillRect(W - 7, 0, 7, H);
      x.fillStyle = '#2c1c10';
      var size = text.length > 8 ? 30 : 38;
      x.font = 'bold ' + size + 'px "Courier New", monospace';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text.toUpperCase(), W / 2, H / 2 + 2);
    }, W, H, 2.08);
  };

  CS.models.signBoard = function (lines, worldW) {
    var W = 300, H = 72 + lines.length * 51;
    return textPlane(function (x) {
      x.fillStyle = '#c99a5c'; x.fillRect(0, 0, W, H);
      for (var i = 0; i < H; i += 12) {                      // plank grain
        x.fillStyle = i % 24 === 0 ? '#bd8e51' : '#c4955a';
        x.fillRect(0, i, W, 6);
      }
      x.fillStyle = '#7a4a26';
      x.fillRect(0, 0, W, 9); x.fillRect(0, H - 9, W, 9);
      x.fillRect(0, 0, 9, H); x.fillRect(W - 9, 0, 9, H);
      x.fillStyle = '#2c1c10';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      lines.forEach(function (ln, i) {
        x.font = 'bold ' + (ln.length > 9 ? 33 : 40) + 'px "Courier New", monospace';
        x.fillText(ln.toUpperCase(), W / 2, 50 + i * 51);
      });
      x.fillStyle = '#c0392b';                                // little pixel heart
      var hx = W / 2 - 15, hy = H - 42;
      [[0, 0], [6, 0], [18, 0], [24, 0], [0, 6], [6, 6], [12, 6], [18, 6], [24, 6],
       [6, 12], [12, 12], [18, 12], [12, 18]].forEach(function (p) {
        x.fillRect(hx + p[0], hy + p[1], 6, 6);
      });
    }, W, H, worldW || 1.9);
  };

  /* A pixel view of the outdoors, straight off the reference art: blue sky,
     blocky clouds, a grass horizon and a chunky tree. */
  CS.models.skyPane = function (worldW) {
    var W = 96, H = 72;
    return textPlane(function (x) {
      x.fillStyle = '#74b8ea'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#8fcbf2'; x.fillRect(0, 0, W, 14);
      // clouds
      x.fillStyle = '#ffffff';
      [[8, 10, 18, 6], [14, 6, 10, 4], [58, 16, 22, 6], [64, 12, 12, 4], [36, 6, 12, 5]]
        .forEach(function (r) { x.fillRect(r[0], r[1], r[2], r[3]); });
      // ground
      x.fillStyle = '#4e8f34'; x.fillRect(0, 48, W, H - 48);
      x.fillStyle = '#5faa3d'; x.fillRect(0, 48, W, 6);
      x.fillStyle = '#69ba45';
      for (var i = 0; i < W; i += 6) x.fillRect(i, 48, 3, 3);
      // tree
      x.fillStyle = '#6b4526'; x.fillRect(22, 34, 8, 18);
      x.fillStyle = '#3f7d2b'; x.fillRect(10, 16, 32, 20);
      x.fillStyle = '#4e9634'; x.fillRect(14, 12, 24, 8);
      x.fillStyle = '#5faa3d'; x.fillRect(18, 18, 8, 6); x.fillRect(30, 24, 8, 6);
      // distant hill
      x.fillStyle = '#457f30'; x.fillRect(66, 40, 26, 10);
    }, W, H, worldW || 3.0);
  };

  /* Framed food picture for the wall — drumstick, tomato or lettuce. */
  CS.models.foodFrame = function (kind, worldW) {
    var W = 48, H = 48;
    return textPlane(function (x) {
      x.fillStyle = '#5a3a1c'; x.fillRect(0, 0, W, H);          // frame
      x.fillStyle = '#7a4f26'; x.fillRect(3, 3, W - 6, H - 6);
      x.fillStyle = '#2a1d14'; x.fillRect(7, 7, W - 14, H - 14); // mount
      function px(c, cells) {
        x.fillStyle = c;
        cells.forEach(function (p) { x.fillRect(12 + p[0] * 4, 12 + p[1] * 4, 4, 4); });
      }
      if (kind === 'drumstick') {
        px('#d9862a', [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [1, 3], [2, 3]]);
        px('#f0b45c', [[1, 0], [1, 1]]);
        px('#f2e6cf', [[3, 4], [2, 4], [3, 5]]);
      } else if (kind === 'tomato') {
        px('#c8342a', [[1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
                       [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [1, 4], [2, 4], [3, 4]]);
        px('#e05a45', [[1, 1], [1, 2]]);
        px('#4e9634', [[2, 0], [1, 0], [3, 0]]);
      } else {
        px('#4e9634', [[1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
                       [1, 3], [2, 3], [3, 3]]);
        px('#6fbf3a', [[2, 1], [1, 2], [3, 2], [2, 3]]);
      }
    }, W, H, worldW || 0.9);
  };

  /* Soft blob under the chef — reads much better than a cast shadow alone. */
  CS.models.blobShadow = function () {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d');
    var grd = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, 'rgba(30,18,8,0.55)');
    grd.addColorStop(0.6, 'rgba(30,18,8,0.28)');
    grd.addColorStop(1, 'rgba(30,18,8,0)');
    x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(c);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 2;
    return m;
  };

  /* Outlined square that marks the station you are pointing at. */
  CS.models.highlight = function () {
    var c = document.createElement('canvas'); c.width = c.height = 16;
    var x = c.getContext('2d');
    x.fillStyle = '#ffd464'; x.fillRect(0, 0, 16, 16);
    x.clearRect(2, 2, 12, 12);
    x.fillStyle = '#ffd46466'; x.fillRect(2, 2, 12, 12);
    var t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.85, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 5;
    return m;
  };
})(window.CS);
