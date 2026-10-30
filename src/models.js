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
      o.rough == null ? '-' : o.rough, o.metal || 0, o.side || 0, o.vc ? 1 : 0].join('|');
    if (matCache[key]) return matCache[key];
    var params = {
      color: CS.linear(o.color == null ? 0xffffff : o.color),
      transparent: o.opacity != null && o.opacity < 1,
      opacity: o.opacity == null ? 1 : o.opacity
    };
    if (o.side) params.side = THREE.DoubleSide;
    if (o.vc) params.vertexColors = true;          // per-piece tints, see CS.merge
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

  /* Bake a list of loose meshes into one mesh, so a wall of a few dozen
     stones costs one draw call instead of a few dozen. Each piece keeps its
     own transform, and can carry a tint in `userData.tint` (a linear
     THREE.Color) that becomes its vertex colour -- give the result a
     material made with `vc: true` to see the tints. */
  CS.merge = function (meshes, material) {
    var pos = [], nor = [], uv = [], col = [], idx = [], base = 0;
    var v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
    var white = new THREE.Color(1, 1, 1);
    meshes.forEach(function (m) {
      m.updateMatrix();
      nm.getNormalMatrix(m.matrix);
      var g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      var C = g.attributes.color;            // an already-merged piece keeps its tints
      var c = m.userData.tint || white;
      for (var i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m.matrix);
        n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
        pos.push(v.x, v.y, v.z);
        nor.push(n.x, n.y, n.z);
        uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
        if (C) col.push(C.getX(i) * c.r, C.getY(i) * c.g, C.getZ(i) * c.b);
        else col.push(c.r, c.g, c.b);
      }
      if (g.index) {
        for (var j = 0; j < g.index.count; j++) idx.push(g.index.getX(j) + base);
      } else {
        for (var k = 0; k < P.count; k++) idx.push(k + base);
      }
      base += P.count;
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return finishMesh(new THREE.Mesh(geo, material), 0, 0, 0);
  };

  /* Draw-call diet. Every distinct mesh is a draw call, and another one in
     the shadow pass if it casts a shadow, which is what phones choke on.

     CS.bake(rig) merges meshes that share a parent AND a material into one,
     in place. Pivots stay where they are and so does every material, so a
     baked chef, customer or sandwich looks and animates exactly as before --
     it just costs a fraction of the draw calls.

     CS.batchStatic(root, skip) goes further for things that never move: it
     merges every opaque mesh under `root` that shares a material, wherever
     it sits in the tree, into one mesh in root space. `skip` is a list of
     objects (and everything under them) to leave alone because something
     animates them. */
  function bakeKey(o) {
    var m = o.material;
    if (!o.isMesh || !m || Array.isArray(m) || m.isShaderMaterial || o.isInstancedMesh) return null;
    if (!o.geometry.attributes.normal || o.userData.noBake) return null;
    return m.uuid + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + o.layers.mask;
  }

  function mergeGroup(list, into) {
    var first = list[0];
    var merged = CS.merge(list, first.material);
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.layers.mask = first.layers.mask;
    merged.geometry.userData.baked = true;
    into.add(merged);
    return merged;
  }

  /* Baked geometry is made fresh rather than shared out of the cache, so
     whatever throws a baked model away (a plate served, a customer gone)
     must hand it back to the GPU or a long session slowly fills memory. */
  CS.dispose = function (obj) {
    if (!obj) return;
    obj.traverse(function (o) {
      if (o.isMesh && o.geometry && o.geometry.userData.baked) o.geometry.dispose();
    });
  };

  CS.bake = function (rig) {
    var groups = {}, order = [];
    rig.traverse(function (o) {
      var k = bakeKey(o);
      if (!k || !o.visible || !o.parent) return;
      k = o.parent.uuid + '|' + k;
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(o);
    });
    order.forEach(function (k) {
      var list = groups[k];
      if (list.length < 2) return;
      var parent = list[0].parent;
      list.forEach(function (m) { parent.remove(m); });
      mergeGroup(list, parent);
    });
    return rig;
  };

  CS.batchStatic = function (root, skip) {
    var skipSet = {};
    (skip || []).forEach(function (o) { if (o) skipSet[o.uuid] = true; });
    root.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    var groups = {}, order = [];
    (function walk(o) {
      if (skipSet[o.uuid] || !o.visible) return;
      var k = o !== root ? bakeKey(o) : null;
      if (k && !o.material.transparent) {
        if (!groups[k]) { groups[k] = []; order.push(k); }
        groups[k].push(o);
      }
      o.children.slice().forEach(walk);
    })(root);
    var merged = 0;
    order.forEach(function (k) {
      var list = groups[k];
      if (list.length < 2) return;
      list.forEach(function (m) {
        m.matrix.multiplyMatrices(inv, m.matrixWorld);
        m.matrix.decompose(m.position, m.quaternion, m.scale);
        m.parent.remove(m);
      });
      mergeGroup(list, root);
      merged += list.length;
    });
    return merged;
  };

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
    CS.bake(g);                 // same look, a fraction of the draw calls
    return { group: g, parts: parts };
  };

  /* -------------------------------------------------------- the customer
     The queue is a parade of fantasy-RPG regulars on their lunch break:
     moogles, chocobos, cactuars, tonberries, bombs, mages and the rest. All
     of them are built on the same chibi rig -- a big head on a small body,
     stubby limbs -- which is what lets orders.js drive one walk cycle for
     every one of them. `C.look` picks the costume bolted on top.

     `parts` is the contract with orders.js: legL, legR, armL, armR, head,
     body, tail and mark. Keep those names if you add a look.               */
  CS.models.customer = function (speciesIdx, seed) {
    var C = CS.CRITTERS[speciesIdx % CS.CRITTERS.length];
    var look = C.look;
    var g = new THREE.Group();
    var parts = { species: C };
    var FUR = { color: C.fur, tex: 'fluff', rough: 0.9 };
    var FUR_D = { color: CS.shade(C.fur, -28), tex: 'fluff', rough: 0.9 };
    var BELLY = { color: C.belly, tex: 'fluff', rough: 0.9 };
    var TRIM = { color: C.trim, rough: 0.7 };
    var EYE = { color: 0x1e1828, rough: 0.15 };
    var SHINE = { color: 0xffffff, rough: 0.2 };
    var BLUSH = { color: 0xff9db2, rough: 0.9 };
    var GLOW = CS.mat({ color: 0xffe04a, basic: true });
    var GOLD = { color: 0xf2bf3e, rough: 0.3, metal: 0.8 };

    var robed = look === 'blackmage' || look === 'whitemage' || look === 'tonberry';
    var smooth = look === 'cactuar' || look === 'bomb' || look === 'mandragora';

    // what each part of the rig is made of, before the costume goes on
    var BODY = smooth ? { color: C.fur, rough: 0.55 } : FUR;
    var HEAD = BODY, LEG = BODY, FOOT = FUR_D, ARM = BODY, PAW = FUR_D;
    if (look === 'blackmage') {
      BODY = ARM = { color: C.fur, rough: 0.85 };
      HEAD = { color: 0x15111c, rough: 0.95 };
      LEG = FOOT = PAW = { color: 0x5a3a22, rough: 0.8 };
    } else if (look === 'whitemage') {
      BODY = ARM = { color: C.fur, rough: 0.85 };
      HEAD = PAW = { color: C.skin, rough: 0.8 };
      LEG = FOOT = { color: 0xb08a5a, rough: 0.8 };
    } else if (look === 'tonberry') {
      BODY = ARM = { color: C.trim, tex: 'fluff', rough: 0.95 };
      HEAD = LEG = FOOT = PAW = FUR;
    } else if (look === 'chocobo') {
      LEG = FOOT = TRIM;
    } else if (smooth) {
      FOOT = PAW = { color: CS.shade(C.fur, -30), rough: 0.6 };
    }

    /* ---- legs ---- */
    var hips = new THREE.Group(); hips.position.y = 0.26; g.add(hips);
    ['legL', 'legR'].forEach(function (id, i) {
      var leg = new THREE.Group();
      leg.position.set(i ? 0.13 : -0.13, 0, 0);
      hips.add(leg);
      if (look === 'chocobo') {
        add(leg, CS.ball(0.045, 0.13, 0.045, LEG, 0, -0.09, 0));
        [-0.05, 0, 0.05].forEach(function (tx) {
          add(leg, CS.ball(0.025, 0.02, 0.09, FOOT, tx, -0.21, 0.06));
        });
      } else {
        add(leg, CS.ball(0.085, 0.12, 0.085, LEG, 0, -0.09, 0));
        add(leg, CS.ball(0.10, 0.06, 0.13, FOOT, 0, -0.20, 0.03));
      }
      parts[id] = leg;
    });

    /* ---- body ---- */
    var body = new THREE.Group(); body.position.y = 0.26; g.add(body); parts.body = body;
    if (robed) {
      // a long robe flaring out over the boots
      add(body, CS.cyl(0.17, 0.34, 0.54, BODY, 0, 0.15, 0, 20));
      if (look === 'whitemage') {
        // the red triangle trim round the hem
        for (var hi = 0; hi < 10; hi++) {
          var ha = hi / 10 * Math.PI * 2;
          var tri = add(body, CS.cone(0.07, 0.13, TRIM, Math.sin(ha) * 0.315, -0.05, Math.cos(ha) * 0.315, 3));
          tri.rotation.y = ha; tri.scale.z = 0.3;
        }
      } else if (look === 'blackmage') {
        add(body, CS.cyl(0.215, 0.225, 0.05, { color: 0x5a3a22 }, 0, 0.30, 0, 18));
      } else {
        // a tonberry's cloak has a pale belly showing at the front
        add(body, CS.ball(0.13, 0.16, 0.06, BELLY, 0, 0.16, 0.22));
      }
    } else if (look === 'bomb') {
      add(body, CS.ball(0.20, 0.18, 0.19, BODY, 0, 0.12, 0));
    } else if (look === 'cactuar') {
      add(body, CS.ball(0.24, 0.38, 0.21, BODY, 0, 0.26, 0));
      // ridges and a scatter of little spines
      [-0.12, 0, 0.12].forEach(function (rx) {
        add(body, CS.ball(0.035, 0.32, 0.03, { color: CS.shade(C.fur, -18), rough: 0.6 }, rx, 0.26, 0.19));
      });
      [[0.18, 0.4], [-0.2, 0.18], [0.16, 0.05], [-0.1, 0.5]].forEach(function (p) {
        var sp = add(body, CS.cone(0.012, 0.06, { color: 0xf3ecc8 }, p[0], p[1], 0.17, 5));
        sp.rotation.x = Math.PI / 2;
      });
    } else {
      add(body, CS.ball(0.29, 0.29, 0.25, BODY, 0, 0.20, 0));
      add(body, CS.ball(0.19, 0.20, 0.08, BELLY, 0, 0.17, 0.19));
    }

    // things worn on the back
    if (look === 'moogle') {
      // little purple bat wings
      [-1, 1].forEach(function (s) {
        var w = add(body, CS.cone(0.12, 0.22, TRIM, s * 0.14, 0.40, -0.22, 3));
        w.rotation.z = -s * 1.1; w.rotation.y = s * 0.4; w.scale.z = 0.25;
      });
    } else if (look === 'caitsith') {
      var cape = add(body, CS.shell(0.33, 0.36, 0.30, { color: C.trim, rough: 0.8, side: true },
        Math.PI * 1.1, Math.PI * 0.8, 0.5, 1.6));
      cape.position.y = 0.22;
    }

    /* ---- arms ---- */
    [['armL', -1], ['armR', 1]].forEach(function (a) {
      var s = a[1];
      var arm = new THREE.Group();
      arm.position.set(s * (look === 'bomb' ? 0.19 : (look === 'cactuar' ? 0.22 : 0.26)), 0.32, 0);
      body.add(arm);
      if (look === 'chocobo') {
        // stubby wings rather than arms
        var wg = add(arm, CS.ball(0.06, 0.16, 0.13, FUR, s * 0.03, -0.10, -0.02));
        wg.rotation.z = s * 0.35;
      } else if (look === 'cactuar') {
        // the famous pose: one arm up, one arm down
        var pose = new THREE.Group();
        pose.rotation.z = s > 0 ? 2.5 : -0.25;
        arm.add(pose);
        add(pose, CS.ball(0.06, 0.16, 0.06, BODY, 0, -0.13, 0));
      } else {
        var up = add(arm, CS.ball(0.07, 0.15, 0.07, ARM, s * 0.02, -0.12, 0));
        up.rotation.z = s * 0.2;
        add(arm, CS.ball(0.065, 0.06, 0.065, PAW, s * 0.04, -0.25, 0.01));
      }
      parts[a[0]] = arm;
    });

    // a tonberry never goes anywhere without its lantern and its little knife
    if (look === 'tonberry') {
      var lantern = new THREE.Group();
      lantern.position.set(0.05, -0.33, 0.06);
      parts.armR.add(lantern);
      add(lantern, CS.cyl(0.05, 0.05, 0.10, { color: 0x3a3330, rough: 0.5, metal: 0.6 }, 0, 0, 0, 6));
      add(lantern, CS.ball(0.04, 0.05, 0.04, GLOW, 0, 0, 0));
      add(lantern, CS.torus(0.03, 0.006, Math.PI, { color: 0x3a3330 }, 0, 0.06, 0));
      var knife = add(parts.armL, CS.cone(0.02, 0.14, { color: 0xdfe4ea, rough: 0.2, metal: 0.9 }, -0.04, -0.30, 0.10, 4));
      knife.rotation.x = Math.PI / 2;
    }

    /* ---- tail: on its own pivot, so it can sway ---- */
    parts.tail = new THREE.Group();
    parts.tail.position.set(0, 0.14, -0.22);
    body.add(parts.tail);
    if (look === 'chocobo') {
      [-0.5, 0, 0.5].forEach(function (a) {
        var f = add(parts.tail, CS.cone(0.05, 0.24, FUR, a * 0.12, 0.10, -0.08));
        f.rotation.x = -1.0; f.rotation.z = a;
      });
    } else if (look === 'caitsith') {
      var t1 = add(parts.tail, CS.ball(0.04, 0.22, 0.04, FUR, 0, 0.16, -0.06));
      t1.rotation.x = -0.5;
      add(parts.tail, CS.ball(0.045, 0.05, 0.045, BELLY, 0, 0.34, -0.15));
    } else if (look === 'tonberry') {
      var tt = add(parts.tail, CS.cone(0.06, 0.18, FUR, 0, -0.04, -0.06));
      tt.rotation.x = -2.2;
    }

    /* ---- head: big and round, the chibi bit ---- */
    var head = new THREE.Group(); head.position.set(0, 0.52, 0.01); body.add(head);
    parts.head = head;
    parts.eyes = new THREE.Group(); head.add(parts.eyes);
    var eh = 0.48;      // how far up this head's tallest feature reaches

    function glossyEyes(y, z, sp) {
      [-1, 1].forEach(function (s) {
        add(parts.eyes, CS.ball(0.05, 0.065, 0.03, EYE, s * sp, y, z));
        add(parts.eyes, CS.ball(0.02, 0.022, 0.01, SHINE, s * sp - 0.015, y + 0.03, z + 0.028));
      });
    }
    function cheeks(y, z) {
      [-1, 1].forEach(function (s) {
        add(head, CS.ball(0.05, 0.028, 0.015, BLUSH, s * 0.19, y, z)).rotation.y = s * 0.5;
      });
    }

    if (look === 'moogle') {
      add(head, CS.ball(0.31, 0.27, 0.28, HEAD, 0, 0.20, 0));
      // happy closed eyes, a big red nose, little ears and the pompom
      [-1, 1].forEach(function (s) {
        add(parts.eyes, CS.torus(0.04, 0.011, Math.PI, EYE, s * 0.11, 0.22, 0.262));
        var e = add(head, CS.cone(0.07, 0.12, HEAD, s * 0.2, 0.44, -0.02));
        e.rotation.z = -s * 0.35; e.scale.z = 0.6;
      });
      add(head, CS.ball(0.065, 0.06, 0.06, { color: C.nose, rough: 0.35 }, 0, 0.13, 0.27));
      cheeks(0.12, 0.24);
      add(head, CS.cyl(0.012, 0.012, 0.22, { color: 0x2a2028 }, 0, 0.55, -0.02, 6));
      add(head, CS.ball(0.08, 0.08, 0.08, { color: 0xd8263a, tex: 'fluff', rough: 0.9 }, 0, 0.70, -0.02));
      eh = 0.80;
    } else if (look === 'chocobo') {
      add(head, CS.ball(0.27, 0.27, 0.27, HEAD, 0, 0.22, 0.03));
      var beak = add(head, CS.cone(0.085, 0.22, TRIM, 0, 0.15, 0.36));
      beak.rotation.x = Math.PI / 2; beak.scale.x = 1.2;
      glossyEyes(0.27, 0.25, 0.13);
      cheeks(0.14, 0.23);
      [-0.08, 0, 0.08].forEach(function (x, i) {
        var cr = add(head, CS.cone(0.045, 0.24, HEAD, x, 0.50, -0.06 - i % 2 * 0.03));
        cr.rotation.x = -0.7; cr.rotation.z = -x * 2.5;
      });
      eh = 0.66;
    } else if (look === 'cactuar') {
      // the head is just the top of the cactus; the face is three dark holes
      add(head, CS.ball(0.22, 0.20, 0.20, HEAD, 0, 0.06, 0));
      var HOLE = { color: 0x203018, rough: 0.9 };
      [-1, 1].forEach(function (s) { add(parts.eyes, CS.ball(0.035, 0.05, 0.02, HOLE, s * 0.08, 0.12, 0.19)); });
      add(head, CS.ball(0.04, 0.055, 0.02, HOLE, 0, 0.0, 0.195));
      [-0.07, 0, 0.07].forEach(function (x) {
        var sp = add(head, CS.cone(0.03, 0.10, { color: CS.shade(C.fur, 20), rough: 0.6 }, x, 0.28, 0));
        sp.rotation.z = -x * 4;
      });
      eh = 0.36;
    } else if (look === 'tonberry') {
      add(head, CS.ball(0.29, 0.26, 0.27, HEAD, 0, 0.18, 0.02));
      // a brown hood over the top and back, and two lamp-yellow eyes
      var hood = add(head, CS.shell(0.33, 0.31, 0.32, { color: C.trim, tex: 'fluff', rough: 0.95, side: true },
        Math.PI / 2 + 1.0, Math.PI * 2 - 2.0, 0, 2.0));
      hood.position.y = 0.19;
      var hp = add(head, CS.cone(0.10, 0.22, { color: C.trim, tex: 'fluff', rough: 0.95 }, 0, 0.36, -0.20));
      hp.rotation.x = -1.2;
      [-1, 1].forEach(function (s) { add(parts.eyes, CS.ball(0.045, 0.055, 0.02, GLOW, s * 0.1, 0.22, 0.27)); });
      add(head, CS.ball(0.10, 0.06, 0.07, { color: CS.shade(C.fur, 15), rough: 0.7 }, 0, 0.10, 0.25));
      eh = 0.52;
    } else if (look === 'bomb') {
      // a bomb is mostly head: a glowing ball with a fire on top and a grin
      add(head, CS.ball(0.36, 0.34, 0.34, { color: C.fur, rough: 0.45, emissive: 0x5a1a00 }, 0, 0.10, 0));
      var WHITE = { color: 0xfff6e6, rough: 0.3 };
      [-1, 1].forEach(function (s) {
        add(parts.eyes, CS.ball(0.075, 0.07, 0.03, WHITE, s * 0.13, 0.18, 0.30));
        add(parts.eyes, CS.ball(0.035, 0.04, 0.02, EYE, s * 0.12, 0.17, 0.325));
        var brow = add(head, CS.box(0.13, 0.03, 0.03, EYE, s * 0.13, 0.28, 0.31));
        brow.rotation.z = s * 0.35;
      });
      var grin = add(head, CS.torus(0.13, 0.022, Math.PI, EYE, 0, 0.04, 0.30));
      grin.rotation.z = Math.PI;
      [[0, 0.52, 0xffd23c, 0.11, 0.30], [-0.10, 0.46, 0xff8a1e, 0.08, 0.22], [0.10, 0.46, 0xff6a14, 0.08, 0.22]]
        .forEach(function (f) {
          add(head, CS.cone(f[3], f[4], CS.mat({ color: f[2], basic: true }), f[0], f[1], 0));
        });
      eh = 0.62;
    } else if (look === 'blackmage') {
      // a face that is only shadow and two glowing eyes, under a big straw hat
      add(head, CS.ball(0.26, 0.25, 0.25, HEAD, 0, 0.18, 0));
      [-1, 1].forEach(function (s) { add(parts.eyes, CS.ball(0.05, 0.065, 0.02, GLOW, s * 0.1, 0.20, 0.245)); });
      add(head, CS.cyl(0.30, 0.31, 0.10, BODY, 0, 0.02, 0, 18));       // high collar
      var STRAW = { color: C.trim, tex: 'fluff', rough: 0.9 };
      add(head, CS.cyl(0.44, 0.44, 0.03, STRAW, 0, 0.36, 0, 24));
      add(head, CS.cyl(0.25, 0.26, 0.06, { color: 0x5a3a22 }, 0, 0.40, 0, 20));
      var hat = add(head, CS.cone(0.25, 0.56, STRAW, 0, 0.66, -0.04, 16));
      hat.rotation.x = -0.22;
      eh = 0.95;
    } else if (look === 'whitemage') {
      add(head, CS.ball(0.27, 0.25, 0.25, HEAD, 0, 0.18, 0.02));
      glossyEyes(0.20, 0.255, 0.1);
      cheeks(0.10, 0.23);
      var HOOD = { color: C.fur, rough: 0.85, side: true };
      var wh = add(head, CS.shell(0.31, 0.30, 0.30, HOOD, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, 2.1));
      wh.position.y = 0.19;
      // the hood's little cat ears, and the red trim round its face
      [-1, 1].forEach(function (s) {
        var e = add(head, CS.cone(0.08, 0.17, { color: C.fur, rough: 0.85 }, s * 0.17, 0.48, -0.02));
        e.rotation.z = -s * 0.3; e.scale.z = 0.6;
        var t = add(head, CS.cone(0.05, 0.09, TRIM, s * 0.25, 0.04, 0.17, 3));
        t.rotation.x = Math.PI; t.scale.z = 0.3;
      });
      eh = 0.66;
    } else if (look === 'caitsith') {
      add(head, CS.ball(0.31, 0.27, 0.28, HEAD, 0, 0.20, 0));
      add(head, CS.ball(0.17, 0.12, 0.08, BELLY, 0, 0.12, 0.23));
      glossyEyes(0.24, 0.255, 0.115);
      add(head, CS.ball(0.03, 0.022, 0.02, { color: 0xe0736b }, 0, 0.16, 0.30));
      cheeks(0.12, 0.24);
      [-1, 1].forEach(function (s) {
        var e = add(head, CS.cone(0.10, 0.20, HEAD, s * 0.19, 0.46, -0.02));
        e.rotation.z = -s * 0.35; e.scale.z = 0.55;
      });
      // a little gold crown, and the megaphone-free version of the cape
      add(head, CS.cyl(0.11, 0.12, 0.07, GOLD, 0, 0.47, 0, 12));
      for (var ci = 0; ci < 5; ci++) {
        var ca = ci / 5 * Math.PI * 2;
        add(head, CS.cone(0.025, 0.07, GOLD, Math.sin(ca) * 0.1, 0.54, Math.cos(ca) * 0.1, 5));
      }
      eh = 0.66;
    } else if (look === 'mandragora') {
      add(head, CS.ball(0.29, 0.27, 0.27, HEAD, 0, 0.18, 0));
      glossyEyes(0.22, 0.25, 0.11);
      add(head, CS.ball(0.05, 0.035, 0.02, { color: 0x5a1a1a }, 0, 0.10, 0.26));
      cheeks(0.12, 0.23);
      // a tuft of leaves bursting out of the top
      for (var li = 0; li < 5; li++) {
        var la = li / 5 * Math.PI * 2;
        var lf = add(head, CS.ball(0.06, 0.20, 0.025, TRIM, Math.sin(la) * 0.08, 0.58, Math.cos(la) * 0.08));
        lf.rotation.x = Math.cos(la) * 0.5; lf.rotation.z = -Math.sin(la) * 0.5;
      }
      eh = 0.76;
    } else {
      add(head, CS.ball(0.31, 0.27, 0.28, HEAD, 0, 0.20, 0));
      glossyEyes(0.24, 0.255, 0.115);
    }

    // impatience mark, floating clear of whatever this one has on its head
    parts.mark = new THREE.Group();
    parts.mark.position.set(0, 0.26 + 0.52 + eh + 0.30, 0);
    parts.mark.visible = false;
    g.add(parts.mark);
    var RED = CS.mat({ color: 0xff3b2e, basic: true });
    add(parts.mark, CS.ball(0.07, 0.15, 0.07, RED, 0, 0.16, 0));
    add(parts.mark, CS.ball(0.06, 0.06, 0.06, RED, 0, -0.06, 0));
    CS.noMirror(parts.mark);

    // a touch of variety, so two moogles in one queue are not twins
    var sz = 0.94 + (seed % 7) * 0.02;
    g.scale.setScalar(sz);

    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    CS.bake(g);                 // same look, a fraction of the draw calls
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
    if (CS.isThanksgiving) return turkeyLeg(kind);
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

  /* The November special's fried turkey: a plump drumstick with a crackling
     golden-brown skin and the bone end poking out, lying on its side. */
  function turkeyLeg(kind) {
    var g = new THREE.Group();
    var m;
    if (kind === 'raw') m = { color: 0xffffff, tex: 'rawMeat', rough: 0.35 };
    else if (kind === 'burnt') m = { color: 0xffffff, tex: 'charred', rough: 0.9 };
    else m = { color: 0xc77a3a, tex: 'breading', emissive: WARM, rough: 0.5 };
    var BONE = { color: 0xf3ead6, rough: 0.5 };
    add(g, CS.ball(0.21, 0.12, 0.17, m, -0.06, 0.11, 0));                    // the meaty end
    add(g, CS.ball(0.13, 0.085, 0.11, m, 0.1, 0.1, 0));
    add(g, CS.cyl(0.03, 0.03, 0.16, BONE, 0.24, 0.1, 0, 10)).rotation.z = Math.PI / 2;
    add(g, CS.ball(0.04, 0.035, 0.04, BONE, 0.33, 0.11, 0.025));            // knuckle
    add(g, CS.ball(0.04, 0.035, 0.04, BONE, 0.33, 0.11, -0.025));
    if (kind !== 'raw' && kind !== 'burnt') {
      CRUMBS.slice(0, 5).forEach(function (o) {
        add(g, CS.ball(o[2] * 0.8, o[2] * 0.55, o[2] * 0.8, m, o[0] * 0.8 - 0.06, 0.2, o[1] * 0.7));
      });
    }
    return g;
  }

  /* Mashed potatoes: a soft scoop with a well of gravy-butter on top, or
     whole spuds before they cook. */
  function mashScoop(burnt) {
    var g = new THREE.Group();
    var M = burnt ? { color: 0x4a3a2c, rough: 0.9 } : { color: 0xf6ead0, rough: 0.7 };
    add(g, CS.ball(0.17, 0.11, 0.17, M, 0, 0.08, 0));
    add(g, CS.ball(0.11, 0.08, 0.11, M, 0.03, 0.15, -0.02));
    add(g, CS.ball(0.07, 0.05, 0.07, M, -0.07, 0.13, 0.06));
    if (!burnt) add(g, CS.box(0.06, 0.03, 0.06, { color: 0xf8d86a, rough: 0.3 }, 0.02, 0.22, 0));   // a pat of butter
    return g;
  }
  function mashBowl(burnt) {
    var g = new THREE.Group();
    add(g, CS.cyl(0.19, 0.13, 0.11, { color: 0xffffff, tex: 'plate', rough: 0.3 }, 0, 0.055, 0, 20));
    var s = mashScoop(burnt);
    s.position.y = 0.05;
    g.add(s);
    return g;
  }
  function wholeSpuds(inPan) {
    var g = new THREE.Group();
    var SP = { color: 0xc49a62, tex: 'fluff', rough: 0.85 };
    [[-0.1, -0.05], [0.1, 0.02], [0.0, 0.11], inPan ? [-0.02, -0.16] : null, inPan ? [0.17, -0.12] : null]
      .forEach(function (p, i) {
        if (!p) return;
        add(g, CS.ball(0.1, 0.075, 0.08, SP, p[0], 0.07, p[1])).rotation.y = i;
      });
    return g;
  }
  function mashInPan(burnt) {
    var g = new THREE.Group();
    var M = burnt ? { color: 0x3a2f26, rough: 0.9 } : { color: 0xf3e3c0, emissive: WARM, rough: 0.6 };
    add(g, CS.ball(0.3, 0.07, 0.3, M, 0, 0.04, 0));
    add(g, CS.ball(0.14, 0.06, 0.14, M, 0.08, 0.08, -0.05));
    return g;
  }

  /* A slice of pumpkin pie's worth, served whole: a fluted crust in a tin,
     the orange custard, and a swirl of whipped cream. Empty, it is just the
     crust waiting to be filled. */
  function pumpkinPie(sauce) {
    var g = new THREE.Group();
    var CRUST = { color: 0xd9a35a, tex: 'bun', rough: 0.6 };
    add(g, CS.cyl(0.14, 0.11, 0.07, { color: 0xb9b4ac, rough: 0.35, metal: 0.6 }, 0, 0.035, 0, 20));
    add(g, CS.torus(0.135, 0.028, 0, CRUST, 0, 0.075, 0)).rotation.x = Math.PI / 2;
    add(g, CS.cyl(0.12, 0.12, 0.02, CRUST, 0, 0.05, 0, 20));
    if (sauce) {
      var col = CS.ING[sauce].color;
      add(g, CS.cyl(0.118, 0.118, 0.03, { color: col, rough: 0.35 }, 0, 0.075, 0, 20));
      add(g, CS.ball(0.045, 0.03, 0.045, { color: 0xfffaf0, rough: 0.5 }, 0, 0.1, 0));
      add(g, CS.cone(0.025, 0.04, { color: 0xfffaf0, rough: 0.5 }, 0, 0.13, 0, 8));
    }
    g.scale.setScalar(1.2);
    return g;
  }

  /* A cheap, repeatable "random" for laying out fries, so the same item
     always looks the same and a re-rendered carton does not jump about. */
  function jitter(i, k) {
    var s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  /* A bundle of slim fries standing on end and splaying outward: a filled
     disc of sticks, the outer ones leaning further, each a little different
     in length and with a lighter crisp tip. */
  function friesBundle(body, tip, count, emissive, tight) {
    var g = new THREE.Group();
    var mb = { color: body, emissive: emissive, rough: 0.5 };
    var mt = { color: tip, emissive: emissive, rough: 0.5 };
    for (var i = 0; i < count; i++) {
      var ring = i === 0 ? 0 : (i < 7 ? 1 : 2);
      var a = i * 2.39996 + jitter(i, 1) * 0.4;                // golden-angle spread
      var r = ring * (tight ? 0.028 : 0.04) + jitter(i, 2) * 0.01;
      var h = 0.30 + jitter(i, 3) * 0.10;
      var stick = new THREE.Group();
      stick.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * (tight ? 0.75 : 1));
      stick.add(CS.box(0.036, h, 0.036, mb, 0, h / 2, 0));
      stick.add(CS.box(0.038, 0.03, 0.038, mt, 0, h - 0.01, 0));
      var lean = tight ? 0.04 + ring * 0.07 : 0.06 + ring * 0.13;
      stick.rotation.z = -Math.cos(a) * lean;
      stick.rotation.x = Math.sin(a) * lean * (tight ? 0.6 : 1);   // the carton is shallower front to back
      g.add(stick);
    }
    return g;
  }

  /* Loose fries tumbled in the pan: sticks lying every which way, a couple
     of layers deep, so a basket of fries reads as fries and not a carton. */
  function friesPile(body, count, emissive) {
    var g = new THREE.Group();
    var m = { color: body, emissive: emissive, rough: 0.45 };
    for (var i = 0; i < count; i++) {
      var a = jitter(i, 4) * Math.PI * 2, r = jitter(i, 5) * 0.22;
      var f = add(g, CS.box(0.30, 0.036, 0.036, m, Math.cos(a) * r, 0.03 + (i % 3) * 0.03, Math.sin(a) * r));
      f.rotation.y = jitter(i, 6) * Math.PI;
      f.rotation.z = (jitter(i, 7) - 0.5) * 0.3;
    }
    return g;
  }

  /* The red carton: an open-topped box built from its four walls and a
     floor, with a white band round the rim and a gold crest on the front,
     and the fries standing up out of it. No two faces share a plane, so
     nothing can flicker. */
  function friesCarton(burnt) {
    var g = new THREE.Group();
    var RED = { color: 0xd8382e, rough: 0.5 };
    var BAND = { color: 0xf4efe4, rough: 0.6 };
    var W = 0.26, D = 0.20, H = 0.24, t = 0.022;
    g.add(CS.box(W - 0.02, 0.02, D - 0.02, RED, 0, 0.01, 0));
    [-1, 1].forEach(function (s) {
      g.add(CS.box(W, H, t, RED, 0, H / 2, s * (D / 2 - t / 2)));                  // front, back
      g.add(CS.box(t, H, D - t * 2, RED, s * (W / 2 - t / 2), H / 2, 0));           // sides
      g.add(CS.box(W + 0.014, 0.045, t + 0.014, BAND, 0, H - 0.055, s * (D / 2 - t / 2)));
      g.add(CS.box(t + 0.014, 0.045, D - t * 2, BAND, s * (W / 2 - t / 2), H - 0.055, 0));
    });
    var crest = add(g, CS.cyl(0.035, 0.035, 0.012, { color: 0xf2c54a, rough: 0.3, metal: 0.6 },
      0, 0.11, D / 2 + 0.006, 16));
    crest.rotation.x = Math.PI / 2;
    var f = burnt ? friesBundle(0x3a2f26, 0x2a221c, 16, null, true)
      : friesBundle(0xffc63f, 0xffe18a, 16, WARM, true);
    f.position.y = 0.03;
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
    if (CS.isThanksgiving) return buildDinner(g, s, y);
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

  /* The Thanksgiving plate: a dinner roll at the back, the fried turkey in
     the middle with gravy or cranberry spooned over it, and kale and corn
     heaped beside. Same data as a sandwich, laid out as a dinner. */
  function buildDinner(g, s, y) {
    var BUN = { color: 0xffffff, tex: 'bun', emissive: 0x1a0c00, rough: 0.45 };
    add(g, CS.shell(0.14, 0.11, 0.13, BUN, 0, Math.PI * 2, 0, Math.PI / 2)).position.set(-0.17, y, -0.14);
    add(g, CS.cyl(0.14, 0.14, 0.02, BUN, -0.17, y + 0.01, -0.14, 16)).scale.set(1, 1, 0.93);
    var top = y + 0.02;
    if (s.chicken) {
      var p = turkeyLeg('fried');
      p.position.set(0, y - 0.02, 0.04);
      p.rotation.y = -0.5;
      g.add(p);
      top = y + 0.2;
    }
    s.sauces.forEach(function (id, i) {
      var c = { color: CS.ING[id].color, rough: 0.15 };
      var sy = s.chicken ? y + 0.19 : y + 0.03;
      add(g, CS.ball(0.13, 0.03, 0.11, c, -0.04 + i * 0.06, sy, 0.04));
      add(g, CS.ball(0.03, 0.05, 0.03, c, 0.06 + i * 0.05, sy - 0.05, 0.1));   // a drip
    });
    s.toppings.forEach(function (id, i) {
      var c = CS.ING[id].color, px = i ? 0.0 : -0.2, pz = i ? 0.25 : 0.17;   // clear of the mash
      if (id === 'pickle') {
        // a spoonful of golden corn kernels
        for (var k = 0; k < 10; k++) {
          var a = k * 2.4, r = (k % 4) * 0.025;
          add(g, CS.ball(0.022, 0.018, 0.022, { color: k % 2 ? c : CS.shade(c, 18), rough: 0.35 },
            px + Math.cos(a) * r, y + 0.02 + (k > 6 ? 0.03 : 0), pz + Math.sin(a) * r));
        }
      } else {
        // a heap of curly kale (or whatever leafy green this is)
        for (var j = 0; j < 6; j++) {
          var b = j / 6 * Math.PI * 2;
          add(g, CS.ball(0.06, 0.035, 0.06, { color: j % 2 ? c : CS.shade(c, 22), rough: 0.6 },
            px + Math.cos(b) * 0.05, y + 0.03 + (j % 2) * 0.02, pz + Math.sin(b) * 0.05));
        }
      }
    });
    return top + 0.05;
  }

  /* White glazed plate with a blue rim, like the good crockery. */
  function dish(g) {
    add(g, CS.cyl(0.44, 0.36, 0.05, { color: 0x3a5aa6, rough: 0.3 }, 0, 0.025, 0, 32));
    add(g, CS.cyl(0.40, 0.36, 0.056, { color: 0xffffff, tex: 'plate', rough: 0.25 }, 0, 0.028, 0, 32));
  }
  CS.models.dish = dish;

  /* item -> THREE.Group. `item` is the plain data object from interact.js.
     opts.inPan draws fries as they look frying: loose in the oil, not boxed. */
  CS.models.item = function (item, opts) {
    var inPan = !!(opts && opts.inPan);
    var TG = CS.isThanksgiving;
    var g = new THREE.Group();
    if (!item) return g;

    switch (item.k) {
      case 'rawChicken':   g.add(chickenPatty('raw')); break;
      case 'friedChicken': g.add(chickenPatty('fried')); break;
      case 'burntChicken': g.add(chickenPatty('burnt')); break;
      case 'rawFries':     g.add(TG ? wholeSpuds(inPan) : inPan ? friesPile(0xfbe9b8, 16) : friesBundle(0xfbe9b8, 0xfff6dc, 12)); break;
      case 'cookedFries':  g.add(TG ? (inPan ? mashInPan(false) : mashBowl(false)) : inPan ? friesPile(0xffc63f, 16, WARM) : friesCarton(false)); break;
      case 'burntFries':   g.add(TG ? (inPan ? mashInPan(true) : mashBowl(true)) : inPan ? friesPile(0x3a2f26, 16) : friesCarton(true)); break;
      case 'cup':          g.add(TG ? pumpkinPie(item.sauce) : sauceCup(item.sauce)); break;
      case 'garnish': {
        // a pinch of topping or a dollop of sauce on its way to a sandwich
        var ing = CS.ING[item.ing];
        var gm = { color: ing ? ing.color : 0xffffff, rough: ing && ing.kind === 'sauce' ? 0.25 : 0.7 };
        [[0, 0.06, 0], [0.07, 0.05, 0.03], [-0.06, 0.05, 0.04], [0.01, 0.1, -0.03]].forEach(function (p) {
          g.add(CS.ball(0.07, 0.05, 0.07, gm, p[0], p[1], p[2]));
        });
        break;
      }
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
          var fc = TG ? mashBowl(false) : friesCarton(false);
          if (TG) fc.scale.setScalar(0.82);
          fc.position.set(item.sandwich ? 0.24 : 0, y, item.sandwich ? 0.16 : 0);
          g.add(fc);
        }
        item.cups.forEach(function (s, i) {
          var c = TG ? pumpkinPie(s) : sauceCup(s);
          var ang = -0.9 + i * 0.9;
          c.position.set(Math.sin(ang) * 0.30, y, -0.26 + Math.cos(ang) * 0.06);
          c.scale.setScalar(0.85);
          g.add(c);
        });
        break;
      }
    }
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    CS.bake(g);                 // same look, a fraction of the draw calls
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
     white castle with blue spires. Painted three ways -- 'day', 'dusk' and
     'night' -- and the real clock (daylight.js) swaps between them. At
     night the castle windows are lit and there is a moon over the keep; in
     November the hills turn to autumn colours. */
  var SKIES = {
    day:   { sky: ['#7fb6ea', '#cfe6f7', '#f2eadb'], cloud: 'rgba(255,255,255,0.85)',
             wall: '#e6e8f2', roof: '#5a7cc4', win: '#b9c2dc', hill: ['#8fbf72', '#6fa45a'] },
    dusk:  { sky: ['#4a4f8f', '#e88a5a', '#f6c37a'], cloud: 'rgba(255,196,160,0.75)',
             wall: '#d8b8b0', roof: '#5a4c8a', win: '#ffd27a', hill: ['#6f7f5a', '#56684a'] },
    night: { sky: ['#0b1030', '#1c2a5a', '#3a3f6a'], cloud: 'rgba(120,130,180,0.25)',
             wall: '#6a7090', roof: '#2a3466', win: '#ffd27a', hill: ['#2c3b34', '#22302a'] }
  };
  function drawSky(x, W, H, mode) {
    var P = SKIES[mode] || SKIES.day;
    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, P.sky[0]); g.addColorStop(0.7, P.sky[1]); g.addColorStop(1, P.sky[2]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    if (mode === 'night') {
      for (var i = 0; i < 60; i++) {
        var sx = (Math.sin(i * 91.7) * 0.5 + 0.5) * W, sy = (Math.sin(i * 47.3) * 0.5 + 0.5) * H * 0.6;
        x.fillStyle = 'rgba(255,255,240,' + (0.4 + (i % 3) * 0.2) + ')';
        x.fillRect(sx, sy, i % 5 ? 1.5 : 2.5, i % 5 ? 1.5 : 2.5);
      }
      x.fillStyle = '#fff6d8';
      x.beginPath(); x.arc(300, 54, 22, 0, Math.PI * 2); x.fill();
      x.fillStyle = P.sky[0];
      x.beginPath(); x.arc(311, 47, 19, 0, Math.PI * 2); x.fill();      // a crescent
    } else if (mode === 'dusk') {
      var sun = x.createRadialGradient(80, H * 0.68, 4, 80, H * 0.68, 70);
      sun.addColorStop(0, 'rgba(255,236,170,1)'); sun.addColorStop(1, 'rgba(255,180,110,0)');
      x.fillStyle = sun; x.fillRect(0, 0, W, H);
    }
    x.fillStyle = P.cloud;
    [[60, 60, 40], [100, 52, 30], [290, 80, 44], [330, 70, 30], [200, 40, 24]].forEach(function (c) {
      x.beginPath(); x.arc(c[0], c[1], c[2], 0, Math.PI * 2); x.fill();
    });
    // castle
    var base = H * 0.72;
    var TOWERS = [[150, 70, 14], [182, 110, 18], [222, 92, 16], [250, 60, 12]];
    x.fillStyle = P.wall;
    TOWERS.forEach(function (t) { x.fillRect(t[0] - t[2], base - t[1], t[2] * 2, t[1]); });
    x.fillRect(130, base - 46, 140, 46);
    x.fillStyle = P.roof;
    TOWERS.forEach(function (t) {
      x.beginPath(); x.moveTo(t[0] - t[2] - 3, base - t[1]); x.lineTo(t[0], base - t[1] - t[2] * 2.6);
      x.lineTo(t[0] + t[2] + 3, base - t[1]); x.fill();
    });
    x.fillStyle = P.win;
    [[160, base - 30], [200, base - 60], [240, base - 40], [176, base - 88], [218, base - 74]].forEach(function (w, i) {
      if (i > 2 && mode === 'day') return;
      x.fillRect(w[0], w[1], 6, 10);
    });
    // hills, turned to russet and gold for the November special
    var hills = CS.isThanksgiving
      ? (mode === 'night' ? ['#3a3228', '#2c261e'] : mode === 'dusk' ? ['#9a6a3a', '#7a5230'] : ['#d09a48', '#b8742e'])
      : P.hill;
    x.fillStyle = hills[0];
    x.beginPath(); x.moveTo(0, H); x.lineTo(0, base); x.quadraticCurveTo(W * 0.3, base - 30, W * 0.55, base + 4);
    x.quadraticCurveTo(W * 0.8, base - 26, W, base - 6); x.lineTo(W, H); x.fill();
    x.fillStyle = hills[1];
    x.beginPath(); x.moveTo(0, H); x.lineTo(0, base + 24); x.quadraticCurveTo(W * 0.5, base, W, base + 30); x.lineTo(W, H); x.fill();
    if (CS.isThanksgiving && mode !== 'night') {
      // little autumn trees along the ridge
      [[40, base + 2, '#c8461f'], [86, base - 8, '#e0861f'], [330, base - 4, '#c8461f'], [360, base - 2, '#f2b53a']]
        .forEach(function (t) { x.fillStyle = t[2]; x.beginPath(); x.arc(t[0], t[1], 11, 0, Math.PI * 2); x.fill(); });
    }
  }

  function skySize(worldW, worldH) {
    return { W: 384, H: Math.round(384 * (worldH || worldW * 0.6) / worldW) };
  }

  CS.models.skyPane = function (worldW, worldH) {
    var s = skySize(worldW, worldH);
    var m = textPlane(function (x) { drawSky(x, s.W, s.H, 'day'); }, s.W, s.H, worldW || 3.0);
    m.userData.sky = { worldW: worldW, worldH: worldH, mode: 'day' };
    return m;
  };

  /* A painted sky for an existing pane, cached per size and mode. */
  var skyCache = {};
  CS.models.skyTexture = function (worldW, worldH, mode) {
    var s = skySize(worldW, worldH), key = s.W + 'x' + s.H + mode;
    if (skyCache[key]) return skyCache[key];
    var c = document.createElement('canvas');
    c.width = s.W; c.height = s.H;
    drawSky(c.getContext('2d'), s.W, s.H, mode);
    var t = CS.srgb(new THREE.CanvasTexture(c));
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 4;
    return (skyCache[key] = t);
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
    var LOOKS = {
      potato:   [{ color: 0xd9a868, tex: 'fluff', rough: 0.85 }, { color: 0xb98a4e, rough: 0.85 }],
      tomato:   [{ color: 0xe8392b, rough: 0.28 }, { color: 0xc22a20, rough: 0.3 }],
      egg:      [{ color: 0xf6efe0, rough: 0.4 }, { color: 0xe8dcc0, rough: 0.5 }],
      lettuce:  [{ color: 0x7fcc48, tex: 'fluff', rough: 0.75 }, { color: 0x4f9a2e, rough: 0.7 }],
      mushroom: [{ color: 0xf3e6cf, rough: 0.8 }, { color: 0xd9c6a4, rough: 0.8 }]
    };
    var look = LOOKS[kind] || LOOKS.tomato;
    var SKIN = look[0], SKIN_D = look[1];
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
    } else if (kind === 'egg') {
      // a tall egg with a zig-zag of cracked shell still sat on top as a hat
      add(body, CS.ball(0.31, 0.40, 0.30, SKIN, 0, BY + 0.02, 0));
      for (var ei = 0; ei < 8; ei++) {
        var ea = ei / 8 * Math.PI * 2;
        var sh = add(body, CS.cone(0.07, 0.12, { color: 0xfffaf0, rough: 0.35 },
          Math.sin(ea) * 0.2, BY + 0.38, Math.cos(ea) * 0.2, 4));
        sh.rotation.y = ea;
      }
      add(body, CS.ball(0.21, 0.07, 0.21, { color: 0xfffaf0, rough: 0.35 }, 0, BY + 0.34, 0));
      add(body, CS.ball(0.10, 0.10, 0.04, { color: 0xffc83a, rough: 0.3 }, 0.19, BY + 0.22, 0.20));
    } else if (kind === 'lettuce') {
      // a round head of lettuce, frilly leaves curling up round it
      add(body, CS.ball(0.36, 0.34, 0.34, SKIN, 0, BY, 0));
      for (var li = 0; li < 7; li++) {
        var la = li / 7 * Math.PI * 2;
        if (Math.abs(Math.sin(la / 2)) < 0.5) continue;      // keep the face clear
        var lf = add(body, CS.ball(0.17, 0.22, 0.05, SKIN_D,
          Math.sin(la) * 0.3, BY + 0.06, Math.cos(la) * 0.3));
        lf.rotation.y = la; lf.rotation.x = -0.25;
      }
      add(body, CS.ball(0.20, 0.10, 0.20, { color: 0xb6e384, rough: 0.7 }, 0, BY + 0.30, 0));
    } else if (kind === 'mushroom') {
      // a pale stalk under a big red cap with white spots
      add(body, CS.ball(0.29, 0.34, 0.28, SKIN, 0, BY - 0.04, 0));
      var CAP = { color: 0xd8423a, rough: 0.35 };
      add(body, CS.shell(0.46, 0.34, 0.46, CAP, 0, Math.PI * 2, 0, Math.PI / 2)).position.y = BY + 0.22;
      add(body, CS.cyl(0.46, 0.40, 0.04, { color: 0xf3e6cf }, 0, BY + 0.21, 0, 24));
      [[0, 0.30, 0.10], [0.25, 0.16, 0.14], [-0.24, 0.18, 0.12], [0.1, 0.22, -0.3], [-0.2, 0.12, -0.3]]
        .forEach(function (p) {
          var dy = Math.sqrt(Math.max(0, 1 - (p[0] * p[0] + p[2] * p[2]) / 0.21)) * 0.34;
          add(body, CS.ball(0.07, 0.03, 0.07, { color: 0xfffaf0 }, p[0], BY + 0.22 + dy * 0.95, p[2]));
        });
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
    var R = { potato: [0.33, 0.39, 0.30], egg: [0.31, 0.40, 0.30], lettuce: [0.36, 0.34, 0.34],
      mushroom: [0.29, 0.34, 0.28] }[kind] || [0.38, 0.34, 0.37];
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
    CS.bake(g);                 // same look, a fraction of the draw calls
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
