/* Main loop: renderer, camera, the chef, input, station ticking and scoring. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var T = CS.TILE;
  var PLAYER_R = 0.42;
  var SPEED = 6.4;
  var REACH = 2.9;

  var renderer, scene, camera, clock;
  var world, stations, chef, heldMesh = null, highlight, chefShadow;
  var camTarget = new THREE.Vector3(0, 0.6, -1.5);
  var pixelStep = 2;

  var keys = {}, mouse = new THREE.Vector2(), raycaster = new THREE.Raycaster();
  var pendingClick = null;
  var touchX = 0, touchY = 0;      // on-screen thumbstick, -1..1

  /* ---------------------------------------------------------- abilities */
  var GRAVITY = 24;
  var JUMP_V = 7.0;         // ~1.0 units of hop, enough to clear a counter
  var FLAP_V = 5.2;
  var MAX_FLAPS = 2;
  var GLIDE_FALL = 2.3;     // holding jump turns a fall into a flutter
  var DASH_SPEED = 17;
  var DASH_TIME = 0.20;
  var DASH_CD = 0.95;

  var P = {
    x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0,
    yaw: 0, walk: 0, grounded: true,
    flaps: MAX_FLAPS, flapT: 0, flapPhase: 0,
    dashT: 0, dashCd: 0, dashX: 0, dashZ: 0,
    squash: 0, lean: 0, bank: 0, blink: 0, blinkT: 2,
    stepT: 0, airT: 0
  };

  /* ------------------------------------------------------------- cameras
     overview : whole kitchen, fixed. Best for reading the room.
     close    : third-person follow at the same angle — the chef is the star.
     behind   : true over-the-shoulder; movement becomes camera-relative.
     mobile   : the only view on a phone, and the only one framed for a tall
                screen. The desktop three all fit the room by its WIDTH, and a
                portrait viewport has so little horizontal field of view that
                holding that width means retreating to ~53 units — which is
                what shrank every station plaque to an unreadable smudge. This
                one frames the chef and the tiles around her instead and lets
                the kitchen scroll past.                                      */
  var CAMS = {
    // `dist` is recomputed per aspect ratio in onResize; these are safe
    // starting values so nothing is ever undefined before the first fit.
    overview: { pitch: 0.88, fit: true, follow: 0.14, lift: 1.0, name: 'Overview',
                needW: CS.MAP_W * CS.TILE + 9, needD: CS.MAP_H * CS.TILE + 6, pad: 5.5, k: 0.94, dist: 34 },
    close:    { pitch: 0.84, follow: 1.0, lift: 1.15, name: 'Close',
                needW: 21, needD: 17, pad: 3.0, k: 0.97, dist: 19 },
    behind:   { pitch: 0.58, follow: 1.0, lift: 1.35, name: 'Behind', spin: true,
                needW: 15, needD: 12, pad: 2.5, k: 0.97, dist: 11 },
    mobile:   { pitch: CS.CAM_PITCH_MOBILE, follow: 1.0, lift: 0.9, name: 'Kitchen',
                exact: true, needW: 11, needD: 11, pad: 1.6, k: 1.0, dist: 28,
                // how far past the room edge the view may stray, as a fraction
                // of what it can see: a sliver of dark at the very bottom sits
                // behind the thumb buttons, and buying that slack is what lets
                // the camera actually follow the chef up and down the kitchen
                edgeW: 0.78, edgeD: 0.80,
                // nudge the framing forward so the chef rides above the
                // JUMP/DASH/USE cluster instead of behind it
                bias: 1.4 }
  };
  var CAM_ORDER = ['close', 'overview', 'behind'];
  var camMode = 'close';
  var camDist = 36, fitDist = 36, camYaw = 0;

  var S = {
    phase: 'menu',          // menu | intro | play | pause | over
    day: 1, level: null, total: 0,
    time: 120,
    score: 0, combo: 1, bestCombo: 1,
    served: 0, missed: 0, burnt: 0,
    tips: 0, tipCount: 0,
    held: null, target: null
  };

  /* ------------------------------------------------------------- helpers */
  function setPixelStep(n) {
    pixelStep = n;
    renderer.setPixelRatio(1 / n);
    var vp = CS.platform.size();
    renderer.setSize(vp.w, vp.h);
    CS.ui.setPixLabel(n);
  }

  /* Distance at which a needW x needD patch of floor fills the view at this
     aspect ratio. Used for all three camera modes so none of them ever crops
     on a narrow window. */
  function fitFor(cm) {
    var vf = camera.fov * Math.PI / 180;
    var vExtent = cm.needD * Math.sin(cm.pitch) + cm.pad;
    var distV = (vExtent / 2) / Math.tan(vf / 2);
    var hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    var distH = (cm.needW / 2) / Math.tan(hf / 2);
    var d = Math.max(distV, distH) * cm.k;
    // An `exact` camera never retreats so far that it sees past the back of
    // the shop -- on a tall screen that void is most of the picture, and it is
    // what made the phone build look like a letterboxed postage stamp.
    if (cm.exact) {
      var halfDepth = (CS.MAP_H * T + 7.5) / 2;
      d = Math.min(d, halfDepth * Math.sin(cm.pitch) / Math.tan(vf / 2));
    }
    return d;
  }

  var lastW = 0, lastH = 0;

  function onResize() {
    var vp = CS.platform.size();
    if (vp.w < 2 || vp.h < 2) return;      // viewport not measurable yet
    var w = vp.w, h = vp.h;
    lastW = w; lastH = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (var k in CAMS) if (CAMS.hasOwnProperty(k)) CAMS[k].dist = fitFor(CAMS[k]);
    fitDist = CAMS.overview.dist;
    renderer.setSize(w, h);
  }

  function setCamMode(m) {
    camMode = m;
    CS.ui.setCamLabel(CAMS[m].name);
  }

  /* Phones get the single fixed view; anything wider gets the three desktop
     angles back. CS.platform.mobile can flip mid-session on a tablet that is
     rotated or a window that is dragged, so keep the two in step. */
  function syncCamModes() {
    var phone = CS.platform.mobile;
    var want = phone ? ['mobile'] : ['close', 'overview', 'behind'];
    if (want.length === CAM_ORDER.length) return;
    CAM_ORDER = want;
    if (CAM_ORDER.indexOf(camMode) < 0) setCamMode(CAM_ORDER[0]);
  }
  function cycleCam() {
    if (CAM_ORDER.length < 2) return;      // phones have one view and keep it
    setCamMode(CAM_ORDER[(CAM_ORDER.indexOf(camMode) + 1) % CAM_ORDER.length]);
  }

  /* -------------------------------------------------------- the chef rig */
  function placePlayer(col, row) {
    var p = CS.tileToWorld(col, row);
    P.x = p.x; P.z = p.z; P.y = 0;
    P.vx = P.vz = P.vy = 0; P.yaw = 0;
    P.grounded = true; P.flaps = MAX_FLAPS;
    P.dashT = 0; P.dashCd = 0; P.squash = 0;
    chef.group.position.set(P.x, 0, P.z);
  }

  /* Collision height of a tile: 0 for open floor, the station's top surface
     for furniture, effectively infinite for walls. */
  function tileH(col, row) {
    if (row < 0 || row >= CS.MAP_H || col < 0 || col >= CS.MAP_W) return 99;
    return world.heights[row][col];
  }

  /* Highest surface the chef could be standing on right now. */
  function groundUnder() {
    var col = Math.floor((P.x - CS.OX) / T);
    var row = Math.floor((P.z - CS.OZ) / T);
    var best = 0;
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var c = col + dc, r = row + dr;
        var h = tileH(c, r);
        if (h <= 0 || h > 90) continue;       // floor, or a wall you can't stand on
        if (h > P.y + 0.3) continue;          // still below its lip
        var p = CS.tileToWorld(c, r);
        var nx = CS.clamp(P.x, p.x - T / 2, p.x + T / 2);
        var nz = CS.clamp(P.z, p.z - T / 2, p.z + T / 2);
        var ddx = P.x - nx, ddz = P.z - nz;
        if (ddx * ddx + ddz * ddz < PLAYER_R * PLAYER_R) best = Math.max(best, h);
      }
    }
    return best;
  }

  function moveAndCollide(dx, dz) {
    // resolve one axis at a time so sliding along counters feels smooth
    P.x += dx; resolveAxis('x');
    P.z += dz; resolveAxis('z');
  }

  function resolveAxis(axis) {
    var col = Math.floor((P.x - CS.OX) / T);
    var row = Math.floor((P.z - CS.OZ) / T);
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var c = col + dc, r = row + dr;
        // you only collide with things whose top is above your feet
        if (tileH(c, r) <= P.y + 0.06) continue;
        var p = CS.tileToWorld(c, r);
        var minX = p.x - T / 2, maxX = p.x + T / 2;
        var minZ = p.z - T / 2, maxZ = p.z + T / 2;
        var nx = CS.clamp(P.x, minX, maxX);
        var nz = CS.clamp(P.z, minZ, maxZ);
        var ddx = P.x - nx, ddz = P.z - nz;
        var d2 = ddx * ddx + ddz * ddz;
        if (d2 >= PLAYER_R * PLAYER_R) continue;

        if (d2 > 0.000001) {
          var d = Math.sqrt(d2);
          var push = PLAYER_R - d;
          if (axis === 'x') P.x += (ddx / d) * push;
          else P.z += (ddz / d) * push;
        } else {
          // dead centre inside a tile: shove out the shortest way
          if (axis === 'x') P.x += (P.x < p.x ? -1 : 1) * (T / 2 + PLAYER_R);
          else P.z += (P.z < p.z ? -1 : 1) * (T / 2 + PLAYER_R);
        }
      }
    }
  }

  /* ---------------------------------------------------- station targeting */
  function findTarget() {
    var best = null, bestScore = -1e9;
    var fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    for (var i = 0; i < stations.length; i++) {
      var st = stations[i];
      var dx = st.x - P.x, dz = st.z - P.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > REACH) continue;
      var dot = d > 0.001 ? (dx / d) * fx + (dz / d) * fz : 1;
      if (dot < -0.1) continue;
      var score = dot * 2.0 - d * 0.55;
      if (score > bestScore) { bestScore = score; best = st; }
    }
    return best;
  }

  /* ------------------------------------------------------- item rendering */
  function setStationItem(st, item) {
    st.item = item;
    while (st.slot.children.length) st.slot.remove(st.slot.children[0]);
    if (item) {
      var m = CS.models.item(item);
      m.scale.setScalar(1.5);            // oversized so the food reads from here
      if (st.type === 'fryer') m.position.y = -0.09;
      st.slot.add(m);
    }
  }

  function refreshHeld() {
    if (heldMesh) { chef.parts.hands.remove(heldMesh); heldMesh = null; }
    if (S.held) {
      heldMesh = CS.models.item(S.held);
      heldMesh.scale.setScalar(1.15);
      heldMesh.position.set(0, 0, 0.14);
      chef.parts.hands.add(heldMesh);
    }
    CS.ui.setHeld(S.held);
    setInspectItem(S.held);
  }

  /* ------------------------------------------- plate inspector (corner inset)
     A second tiny scene rendered into a scissored viewport, so the player can
     actually see the sandwich they have stacked up. */
  var inspect = { scene: null, cam: null, obj: null, el: null };

  function initInspect() {
    inspect.scene = new THREE.Scene();
    inspect.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    inspect.cam.position.set(0, 1.35, 2.75);
    inspect.cam.lookAt(0, 0.52, 0);
    inspect.scene.add(new THREE.AmbientLight(0xffe6c8, 0.95));
    var key = new THREE.DirectionalLight(0xfff2d8, 0.95); key.position.set(2, 4, 3);
    inspect.scene.add(key);
    var rim = new THREE.DirectionalLight(0xffb060, 0.4); rim.position.set(-3, 1.5, -2);
    inspect.scene.add(rim);
    inspect.el = document.getElementById('plateview');
  }

  function setInspectItem(item) {
    if (!inspect.scene) return;
    if (inspect.obj) { inspect.scene.remove(inspect.obj); inspect.obj = null; }
    if (!item) { inspect.el.classList.add('hidden'); return; }
    inspect.el.classList.remove('hidden');
    var g = CS.models.item(item);
    var box = new THREE.Box3().setFromObject(g);
    var size = new THREE.Vector3();
    box.getSize(size);
    var maxd = Math.max(size.x, size.y, size.z) || 1;
    var s = 1.2 / maxd;
    g.scale.setScalar(s);
    g.position.y = -box.min.y * s;
    var holder = new THREE.Group();
    holder.add(g);
    inspect.scene.add(holder);
    inspect.obj = holder;
  }

  function renderInspect() {
    if (!inspect.obj || inspect.el.classList.contains('hidden')) return;
    var r = inspect.el.getBoundingClientRect();
    var w = r.width - 8, h = r.height - 8;
    if (w < 12 || h < 12) return;
    var vpH = CS.platform.size().h;
    var x = r.left + 4;
    var y = vpH - r.bottom + 4;
    inspect.cam.aspect = w / h;
    inspect.cam.updateProjectionMatrix();
    renderer.setScissorTest(true);
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.render(inspect.scene, inspect.cam);   // clear is scissored to the inset
    renderer.setScissorTest(false);
    var vp = CS.platform.size();
    renderer.setViewport(0, 0, vp.w, vp.h);
  }

  function setHeld(item) { S.held = item; refreshHeld(); }

  /* --------------------------------------------------------------- score */
  function serve(plate) {
    var o = CS.orders.findMatch(plate);
    if (!o) {
      CS.audio.error();
      CS.ui.toast('That is not on any ticket!', 'bad');
      return;
    }
    var left = o.left / o.limit;
    var speed = 1 + CS.SCORE.speedBonus * left;
    var gain = Math.round(o.reward * speed * S.combo);
    S.score += gain;
    S.served++;
    S.combo = Math.min(CS.SCORE.comboMax, S.combo + CS.SCORE.comboStep);
    S.bestCombo = Math.max(S.bestCombo, S.combo);
    setHeld(null);
    CS.orders.complete(o, true);
    CS.audio.cash();
    CS.ui.toast('+' + gain + '   ORDER #' + String(o.id).padStart(2, '0') + ' UP!', 'good');

    var sv = stations.filter(function (s) { return s.type === 'serve'; })[0];
    if (sv) CS.fx.burst(sv.x, sv.topY + 0.5, sv.z, 16, { color: 0xffd464, life: 0.8, vy: 2.2 });

    /* ---- the tip ----
       A customer served with time to spare leaves something on the counter.
       Below TIP.minLeft nobody tips, and the chance and the size both climb
       with how much of their patience was still on the clock -- so tipping is
       the reward for a shop that keeps ahead of its queue, not a lottery. */
    var T = CS.SCORE.tip;
    if (left > T.minLeft && Math.random() < (left - T.minLeft) / (1 - T.minLeft) * T.chance) {
      var tip = Math.max(1, Math.round(o.reward * T.share * left * S.combo));
      var nCoins = tip >= T.bigTip ? 3 : (tip >= T.bigTip / 2 ? 2 : 1);
      S.score += tip;
      S.tips += tip;
      S.tipCount++;
      if (sv) CS.orders.tipBurst(sv.x, sv.topY, sv.z, nCoins);
      setTimeout(function () {
        CS.ui.toast('+' + tip + '   ' + o.critter.name.toUpperCase() + ' LEFT A TIP', 'tip');
      }, 260);
    }
  }

  function onExpire(o) {
    S.score = Math.max(0, S.score - CS.SCORE.missPenalty);
    S.combo = 1;
    S.missed++;
    CS.audio.fail();
    CS.ui.toast('Order #' + String(o.id).padStart(2, '0') + ' walked out!', 'bad');
  }

  function puff(st, color, n) {
    CS.fx.burst(st.x, st.topY + 0.3, st.z, n || 6, { color: color, life: 0.55, vy: 1.4, size: 0.09 });
  }

  /* ------------------------------------------------------------- fryers */
  function updateFryers(dt) {
    for (var i = 0; i < stations.length; i++) {
      var st = stations[i];
      if (st.type !== 'fryer') continue;

      var cooking = !!st.cook;
      if (st.glow) {
        var want = cooking ? (st.cook.stage === 'burnt' ? 0.55 : 0.30 + Math.sin(performance.now() / 160) * 0.10) : 0.0;
        st.glow.material.opacity += (want - st.glow.material.opacity) * Math.min(1, dt * 6);
        st.glow.material.color.setHex(cooking && st.cook.stage === 'burnt' ? 0x3a2a1e : 0xff9a2e);
      }
      if (st.coals) {
        // coals breathe gently, and flare up while the pan is working
        var heat = 0.72 + Math.sin(performance.now() / 220 + st.col) * 0.12 + (cooking ? 0.28 : 0);
        st.coals.material.color.setRGB(Math.min(1, heat), Math.min(1, heat * 0.42), heat * 0.09);
      }
      if (!cooking) { if (st.bar) st.bar.visible = false; continue; }

      var c = st.cook, d = c.def;
      c.t += dt;

      if (c.stage === 'cooking') {
        if (c.t >= d.cook) {
          c.stage = 'done';
          setStationItem(st, { k: d.done });
          CS.audio.ding();
          CS.fx.burst(st.x, st.topY + 0.4, st.z, 10, { color: 0xfff0b0, life: 0.7, vy: 1.8 });
        } else if (Math.random() < dt * 14) {
          CS.fx.spawn(st.x + (Math.random() - 0.5) * 1.2, st.topY + 0.1, st.z + (Math.random() - 0.5) * 1.2,
            { color: 0xffd9a0, life: 0.5, vy: 1.0, size: 0.07, g: -0.4 });
        }
      } else if (c.stage === 'done') {
        if (c.t >= d.cook + d.grace) {
          c.stage = 'burnt';
          setStationItem(st, { k: d.burnt });
          S.burnt++;
          CS.audio.burn();
          CS.ui.toast('Something is burning!', 'bad');
        } else if (Math.random() < dt * 5) {
          CS.fx.spawn(st.x + (Math.random() - 0.5) * 0.9, st.topY + 0.3, st.z + (Math.random() - 0.5) * 0.9,
            { color: 0xdad2c4, life: 0.9, vy: 1.3, size: 0.08, g: -0.2 });
        }
      } else if (Math.random() < dt * 8) {
        CS.fx.spawn(st.x + (Math.random() - 0.5) * 1.0, st.topY + 0.4, st.z + (Math.random() - 0.5) * 1.0,
          { color: 0x4a423a, life: 1.2, vy: 1.6, size: 0.1, g: -0.1 });
      }

      // floating progress bar
      if (!st.bar) {
        st.bar = CS.models.bar(1.1);
        st.bar.position.set(st.x, st.topY + 1.5, st.z);
        scene.add(st.bar);
      }
      st.bar.visible = true;
      st.bar.quaternion.copy(camera.quaternion);
      if (c.stage === 'cooking') st.bar.userData.set(c.t / d.cook, 0x6fbf3a);
      else if (c.stage === 'done') st.bar.userData.set(1 - (c.t - d.cook) / d.grace, 0xf0a63c);
      else st.bar.userData.set(1, 0xc0392b);
    }
  }

  /* --------------------------------------------------------- chef rig
     One place that poses every moving part, blending between standing,
     walking, sprinting, airborne and flapping. */
  function animateChef(dt, speed) {
    var pt = chef.parts;
    var t = clock.elapsedTime;
    var run = CS.clamp(speed / SPEED, 0, 1);
    var dashing = P.dashT > 0;
    var air = !P.grounded;

    P.squash += (0 - P.squash) * Math.min(1, dt * 9);
    P.flapT = Math.max(0, P.flapT - dt);
    if (P.flapT > 0) P.flapPhase += dt * 26;

    // body position: walk bob on the ground, real height in the air
    var bob = air ? 0 : Math.abs(Math.sin(P.walk * 2)) * 0.05;
    chef.group.position.set(P.x, P.y + bob, P.z);
    chef.group.rotation.y = P.yaw;
    chef.group.rotation.z = P.bank;

    // squash on landing, stretch on the way up
    var stretch = air ? CS.clamp(P.vy * 0.018, -0.10, 0.12) : 0;
    var sy = 1 - P.squash + stretch;
    var sxz = 1 + P.squash * 0.55 - stretch * 0.5;
    var base = 1.25;
    chef.group.scale.set(base * sxz, base * sy, base * sxz);

    // shadow sits on the ground and fades with altitude
    var gy = groundUnder();
    chefShadow.position.set(P.x, gy + 0.03, P.z);
    var lift = CS.clamp((P.y - gy) / 2.2, 0, 1);
    chefShadow.material.opacity = 0.9 - lift * 0.65;
    chefShadow.scale.setScalar(1.5 * (1 - lift * 0.35));

    // lean into the run, harder while dashing
    var leanWant = -run * 0.16 - (dashing ? 0.30 : 0) + (air ? 0.10 : 0);
    P.lean += (leanWant - P.lean) * Math.min(1, dt * 10);
    pt.body.rotation.x = P.lean;
    pt.body.rotation.z = air ? 0 : Math.sin(P.walk * 2) * 0.045;

    // legs: swing when walking, tuck when airborne
    var sw = Math.sin(P.walk * 2) * run;
    if (air) {
      var tuck = -0.75 - (P.vy > 0 ? 0.35 : 0);
      pt.legL.rotation.x += (tuck - pt.legL.rotation.x) * Math.min(1, dt * 12);
      pt.legR.rotation.x += (tuck * 0.7 - pt.legR.rotation.x) * Math.min(1, dt * 12);
    } else {
      pt.legL.rotation.x = sw * (dashing ? 1.3 : 0.95);
      pt.legR.rotation.x = -sw * (dashing ? 1.3 : 0.95);
    }

    // wings: flapping, swept back in a dash, otherwise counter-swinging
    var carry = S.held ? 0.75 : 0;
    if (P.flapT > 0) {
      var f = Math.sin(P.flapPhase);
      pt.wingL.rotation.z = 0.35 + f * 1.15;
      pt.wingR.rotation.z = -0.35 - f * 1.15;
      pt.wingL.rotation.x = -0.25; pt.wingR.rotation.x = -0.25;
    } else if (air) {
      var spread = 0.55 + Math.sin(t * 9) * 0.10;     // gliding, held out
      pt.wingL.rotation.z += (spread - pt.wingL.rotation.z) * Math.min(1, dt * 10);
      pt.wingR.rotation.z += (-spread - pt.wingR.rotation.z) * Math.min(1, dt * 10);
      pt.wingL.rotation.x += (-0.15 - pt.wingL.rotation.x) * Math.min(1, dt * 10);
      pt.wingR.rotation.x += (-0.15 - pt.wingR.rotation.x) * Math.min(1, dt * 10);
    } else if (dashing) {
      pt.wingL.rotation.z += (-0.25 - pt.wingL.rotation.z) * Math.min(1, dt * 14);
      pt.wingR.rotation.z += (0.25 - pt.wingR.rotation.z) * Math.min(1, dt * 14);
      pt.wingL.rotation.x = -1.15; pt.wingR.rotation.x = -1.15;
    } else {
      pt.wingL.rotation.z += (0.06 - pt.wingL.rotation.z) * Math.min(1, dt * 10);
      pt.wingR.rotation.z += (-0.06 - pt.wingR.rotation.z) * Math.min(1, dt * 10);
      pt.wingL.rotation.x = -sw * 0.55 - carry;
      pt.wingR.rotation.x = sw * 0.55 - carry;
    }

    // head: bob with the stride, plus a slow idle sway when standing still
    var idle = 1 - run;
    pt.head.rotation.x = Math.sin(P.walk * 4) * 0.06 * run + Math.sin(t * 1.7) * 0.035 * idle - P.lean * 0.8;
    pt.head.rotation.y = Math.sin(t * 0.9) * 0.16 * idle;
    pt.head.position.y = 0.60 + Math.sin(t * 2.3) * 0.012 * idle;

    // tail counter-sways, and lifts in the air
    pt.tail.rotation.x = (air ? -0.35 : 0) + Math.sin(P.walk * 2 + 0.6) * 0.14 * run;
    pt.tail.rotation.y = Math.sin(t * 1.3) * 0.12 * idle;

    // blink
    P.blinkT -= dt;
    if (P.blinkT <= 0) { P.blinkT = 2.4 + Math.random() * 3.2; P.blink = 0.16; }
    P.blink = Math.max(0, P.blink - dt);
    pt.eyes.scale.y = P.blink > 0 ? 0.15 : 1;

    // beak opens a crack while sprinting (out of breath)
    pt.jaw.rotation.x = 0.10 + run * 0.28 + (dashing ? 0.25 : 0);

    // the toque wobbles a beat behind the head
    pt.hat.rotation.z = -P.bank * 0.5 + Math.sin(P.walk * 2 - 0.7) * 0.05 * run;
    pt.hat.rotation.x = -P.lean * 0.35;

    if (heldMesh) {
      heldMesh.rotation.y += dt * 0.6;
      heldMesh.position.y = Math.sin(t * 3.1) * 0.015;
    }
  }

  function tryJump() {
    if (P.grounded) {
      P.vy = JUMP_V;
      P.grounded = false;
      P.flaps = MAX_FLAPS;
      P.squash = -0.10;
      CS.audio.jump();
      CS.fx.burst(P.x, P.y + 0.05, P.z, 5,
        { color: 0xd8c39a, life: 0.35, vy: 1.2, size: 0.08, g: -2 });
    } else if (P.flaps > 0) {
      P.flaps--;
      P.vy = FLAP_V;
      P.flapT = 0.42;
      P.flapPhase = 0;
      CS.audio.flap();
      // shed a couple of feathers
      for (var i = 0; i < 4; i++) {
        CS.fx.spawn(P.x + (Math.random() - 0.5) * 0.7, P.y + 0.5, P.z + (Math.random() - 0.5) * 0.7,
          { color: 0xfaf8f1, life: 1.0, vy: 0.4, size: 0.08, g: -0.8 });
      }
    }
  }

  function tryDash() {
    if (P.dashCd > 0 || P.dashT > 0) return;
    var dx = Math.sin(P.yaw), dz = Math.cos(P.yaw);
    var sp = Math.hypot(P.vx, P.vz);
    if (sp > 0.5) { dx = P.vx / sp; dz = P.vz / sp; }   // dash where you are going
    P.dashX = dx; P.dashZ = dz;
    P.dashT = DASH_TIME;
    P.dashCd = DASH_CD;
    CS.audio.dash();
    CS.fx.burst(P.x - dx * 0.3, P.y + 0.3, P.z - dz * 0.3, 8,
      { color: 0xe8dcc0, life: 0.4, vy: 0.9, size: 0.1, g: -1.5 });
  }

  /* Compact status of every fryer for the HUD strip. */
  function fryerRows() {
    var rows = [];
    for (var i = 0; i < stations.length; i++) {
      var st = stations[i];
      if (st.type !== 'fryer') continue;
      if (!st.cook) {
        rows.push({ label: 'Fryer ' + (rows.length + 1), t: 0, color: '#6fbf3a', empty: true });
        continue;
      }
      var c = st.cook, d = c.def;
      var name = d.label;
      if (c.stage === 'cooking') rows.push({ label: name, t: c.t / d.cook, color: '#6fbf3a' });
      else if (c.stage === 'done') rows.push({ label: name + ' READY', t: 1 - (c.t - d.cook) / d.grace, color: '#f0a63c' });
      else rows.push({ label: 'BURNT', t: 1, color: '#c0392b' });
    }
    return rows;
  }

  /* -------------------------------------------------------------- input */
  function bindInput() {
    window.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) e.preventDefault();
      if (keys[k]) return;    // ignore auto-repeat; jump and dash are on press
      keys[k] = true;

      if (k === 'escape') {
        if (S.phase === 'play') pause();
        else if (S.phase === 'pause') resume();
      }
      if (k === 'm') toggleMute();
      if (k === 'p') setPixelStep(pixelStep % 3 + 1);
      if (k === 'c') cycleCam();
      if (S.phase === 'play') {
        if (k === 'e' || k === 'f' || k === 'enter') interact();
        if (k === ' ') tryJump();
        if (k === 'shift') tryDash();
      }
    });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', function () { keys = {}; });

    // Click-to-use is a mouse convenience; on touch the USE button owns it and
    // stray taps must not fire interactions.
    renderer.domElement.addEventListener('pointerdown', function (e) {
      if (S.phase !== 'play' || CS.platform.coarse || e.pointerType === 'touch') return;
      var r = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      pendingClick = true;
    });

    document.getElementById('btnMute').onclick = toggleMute;
    document.getElementById('btnCam').onclick = cycleCam;
    document.getElementById('btnPix').onclick = function () { setPixelStep(pixelStep % 3 + 1); };
    document.getElementById('btnHelp').onclick = function () {
      if (S.phase === 'play') pause(); else if (S.phase === 'pause') resume();
    };
    window.addEventListener('resize', onResize);
  }

  function toggleMute() {
    CS.audio.setMuted(!CS.audio.isMuted());
    CS.ui.setMuteLabel(CS.audio.isMuted());
  }

  function handleClick() {
    pendingClick = null;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObjects(scene.children, true);
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      while (o && !o.userData.station) o = o.parent;
      if (!o) continue;
      var st = o.userData.station;
      var d = Math.hypot(st.x - P.x, st.z - P.z);
      if (d > REACH + 0.4) { CS.ui.toast('Too far away', 'info'); return; }
      var res = CS.resolve(st, S.held);
      if (res.ok) res.run(); else if (res.text) CS.ui.toast(res.text, 'info');
      return;
    }
  }

  function interact() {
    if (!S.target) return;
    var res = CS.resolve(S.target, S.held);
    if (res.ok) res.run();
    else { CS.audio.error(); if (res.text) CS.ui.toast(res.text, 'info'); }
  }

  /* --------------------------------------------------------- game states */
  function reset() {
    S.level = S.level || CS.levelFor(S.day);
    S.time = S.level.seconds;
    S.score = 0; S.combo = 1; S.bestCombo = 1;
    S.served = 0; S.missed = 0; S.burnt = 0;
    S.tips = 0; S.tipCount = 0;
    S.target = null;
    setHeld(null);
    stations.forEach(function (st) {
      if (st.item) setStationItem(st, null);
      st.cook = null;
      if (st.bar) st.bar.visible = false;
    });
    CS.orders.reset(S.level);
    CS.ui.clearTickets();
    CS.fx.clear();
    placePlayer(CS.SPAWN.col, CS.SPAWN.row);
  }

  /* ----------------------------------------------------- the campaign
     One day = one level. Pass the day's target to move on; miss it and you
     retry the same day. Career total accumulates across the whole run.     */
  function bestDay() {
    try { return parseInt(localStorage.getItem('chickenSandyBestDay') || '1', 10) || 1; }
    catch (e) { return 1; }
  }
  function recordBestDay(d) {
    try {
      if (d > bestDay()) localStorage.setItem('chickenSandyBestDay', String(d));
    } catch (e) {}
  }

  function showIntro(day) {
    S.day = day;
    S.level = CS.levelFor(day);
    S.phase = 'intro';
    CS.audio.stopMusic();
    CS.ui.setLevel(S.level);
    CS.ui.showLevelIntro(S.level, function () { startDay(); });
  }

  function startDay() {
    reset();
    S.phase = 'play';
    CS.ui.hideScreen();
    CS.ui.setHudVisible(true);
    CS.ui.setLevel(S.level);
    CS.audio.resume();
    CS.audio.startMusic();
    CS.ui.toast('DAY ' + S.day + ' -- ' + S.level.name, 'good');
  }

  function pause() {
    S.phase = 'pause';
    CS.touch.release();
    CS.ui.showPause(resume, quitRun);
  }
  function resume() { S.phase = 'play'; CS.ui.hideScreen(); }

  function endDay() {
    S.phase = 'over';
    CS.touch.release();
    CS.audio.stopMusic();
    var passed = S.score >= S.level.target;
    if (passed) {
      S.total += S.score;
      recordBestDay(S.day + 1);
      CS.audio.fanfare();
    } else {
      CS.audio.over();
    }
    CS.ui.showLevelResult(S.level, S, passed, S.total,
      function () { showIntro(S.day + 1); },
      function () { showIntro(S.day); });
  }

  function quitRun() {
    S.phase = 'over';
    CS.audio.stopMusic();
    CS.ui.showQuit(S.day, S.total, function () { S.total = 0; showIntro(1); });
  }

  /* ----------------------------------------------------------- the loop */
  function update(dt) {
    if (S.phase === 'play') {
      // movement
      var ix = 0, iz = 0;
      if (keys['a'] || keys['arrowleft']) ix -= 1;
      if (keys['d'] || keys['arrowright']) ix += 1;
      if (keys['w'] || keys['arrowup']) iz -= 1;
      if (keys['s'] || keys['arrowdown']) iz += 1;
      // the thumbstick is analogue, so its magnitude carries through as speed
      if (ix === 0 && iz === 0 && (touchX || touchY)) { ix = touchX; iz = touchY; }
      var len = Math.hypot(ix, iz);
      if (len > 1) { ix /= len; iz /= len; len = 1; }

      // Movement is relative to the camera. With camYaw 0 (overview/close)
      // this is exactly screen-space WASD; in behind-view it rotates with you.
      var fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw);
      var rgtX = Math.cos(camYaw), rgtZ = -Math.sin(camYaw);
      var mx = rgtX * ix + fwdX * (-iz);
      var mz = rgtZ * ix + fwdZ * (-iz);

      // ---- dash overrides steering for its short burst
      P.dashCd = Math.max(0, P.dashCd - dt);
      if (P.dashT > 0) {
        P.dashT -= dt;
        P.vx = P.dashX * DASH_SPEED;
        P.vz = P.dashZ * DASH_SPEED;
        if (Math.random() < dt * 60) {
          CS.fx.spawn(P.x + (Math.random() - 0.5) * 0.5, P.y + 0.1, P.z + (Math.random() - 0.5) * 0.5,
            { color: 0xd8c39a, life: 0.35, vy: 0.8, size: 0.09, g: -1.2 });
        }
      } else {
        var targetVx = mx * SPEED, targetVz = mz * SPEED;
        var airK = P.grounded ? 1 : 0.55;        // less bite in the air
        var accel = (len > 0 ? 18 : 22) * airK;
        P.vx += (targetVx - P.vx) * Math.min(1, dt * accel);
        P.vz += (targetVz - P.vz) * Math.min(1, dt * accel);
      }
      moveAndCollide(P.vx * dt, P.vz * dt);

      // ---- vertical: gravity, gliding, landing
      var wasAir = !P.grounded;
      P.vy -= GRAVITY * dt;
      if (!P.grounded && keys[' '] && P.vy < -GLIDE_FALL) P.vy = -GLIDE_FALL;
      P.y += P.vy * dt;

      var g = groundUnder();
      if (P.y <= g && P.vy <= 0) {
        P.y = g;
        if (wasAir) {
          P.squash = Math.min(0.55, 0.12 + Math.abs(P.vy) * 0.05);
          CS.audio.land();
          CS.fx.burst(P.x, g + 0.05, P.z, 5,
            { color: 0xd8c39a, life: 0.35, vy: 1.1, size: 0.08, g: -2 });
        }
        P.vy = 0;
        P.grounded = true;
        P.flaps = MAX_FLAPS;
        P.airT = 0;
      } else {
        P.grounded = false;
        P.airT += dt;
      }

      var speed = Math.hypot(P.vx, P.vz);
      if (speed > 0.4) {
        var want = Math.atan2(P.vx, P.vz);
        var diff = ((want - P.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        P.yaw += diff * Math.min(1, dt * 14);
        P.bank += (CS.clamp(-diff * 2.2, -0.35, 0.35) - P.bank) * Math.min(1, dt * 8);
      } else {
        P.bank += (0 - P.bank) * Math.min(1, dt * 8);
      }
      P.walk += dt * speed * 1.9;

      // footstep puffs while running on the ground
      if (P.grounded && speed > 2.5) {
        P.stepT -= dt * speed;
        if (P.stepT <= 0) {
          P.stepT = 3.2;
          CS.fx.spawn(P.x - P.vx * 0.05, P.y + 0.04, P.z - P.vz * 0.05,
            { color: 0xcfb894, life: 0.3, vy: 0.7, size: 0.07, g: -1.6 });
        }
      }

      animateChef(dt, speed);

      // targeting + hint
      S.target = findTarget();
      if (S.target) {
        highlight.visible = true;
        highlight.position.set(S.target.x, S.target.topY + 0.04, S.target.z);
        highlight.scale.setScalar(T * 1.0 + Math.sin(performance.now() / 220) * 0.05);
        CS.ui.setHint(CS.resolve(S.target, S.held));
      } else {
        highlight.visible = false;
        CS.ui.setHint(null);
      }

      if (pendingClick) handleClick();

      updateFryers(dt);

      var progress = 1 - S.time / S.level.seconds;
      CS.orders.update(dt, progress, onExpire);
      CS.ui.renderTickets(CS.orders.list);

      S.time -= dt;
      CS.ui.setClock(S.time);
      CS.ui.setScore(S.score);
      CS.ui.setCombo(S.combo);
      CS.ui.setTarget(S.score, S.level.target);
      CS.ui.setFryers(fryerRows());
      CS.ui.setMoves(1 - P.dashCd / DASH_CD, P.grounded ? MAX_FLAPS : P.flaps, MAX_FLAPS, !P.grounded);
      if (S.time <= 0) endDay();
    } else {
      // keep the kitchen alive behind menus
      CS.orders.update(0, 0, function () {});
    }

    CS.fx.update(dt);
    CS.world.tick(clock.elapsedTime);

    // ---- camera
    var cm = CAMS[camMode];
    var tx, tz;
    if (cm.fit) {
      // whole-kitchen framing, nudged gently toward the chef
      tx = 0.0 + P.x * cm.follow;
      tz = -3.0 + P.z * (cm.follow * 0.64);
    } else {
      tx = P.x; tz = P.z;
    }
    // belt and braces: never let a bad frame poison the camera with NaN
    if (!isFinite(camDist)) camDist = cm.dist;
    camDist += (cm.dist - camDist) * Math.min(1, dt * 4);
    if (!isFinite(camTarget.x) || !isFinite(camTarget.z)) camTarget.set(0, 0.6, -1.5);

    var wantYaw = cm.spin ? P.yaw + Math.PI : 0;
    var dyaw = ((wantYaw - camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    camYaw += dyaw * Math.min(1, dt * 4.5);

    // Keep the framing inside the shop so a close camera never drifts off
    // into empty space when the chef works a wall.
    var vfv = camera.fov * Math.PI / 180;
    var hfv = 2 * Math.atan(Math.tan(vfv / 2) * camera.aspect);
    // Overview frames the room, so it keeps a full margin. The follow cameras
    // care about the chef first: a tall phone screen sees only a slice of the
    // kitchen, and a full margin would shove her into the corner of the frame.
    var marg = cm.fit ? 1 : 0.5;
    var hw = camDist * Math.tan(hfv / 2) * 0.80 * marg;
    var hd = camDist * Math.tan(vfv / 2) / Math.max(0.35, Math.sin(cm.pitch)) * 0.62 * marg;
    // The phone camera uses the real visible rectangle rather than the tuned
    // fractions above, so the kitchen always fills the screen edge to edge.
    if (cm.exact) {
      hw = camDist * Math.tan(hfv / 2) * cm.edgeW;
      hd = camDist * Math.tan(vfv / 2) / Math.sin(cm.pitch) * cm.edgeD;
    }
    if (cm.spin) { hw = hd = Math.max(hw, hd); }
    var x0 = CS.OX, x1 = CS.OX + CS.MAP_W * T;
    var z0 = CS.OZ - 7.5, z1 = CS.OZ + CS.MAP_H * T;
    tx = (x1 - x0 > hw * 2) ? CS.clamp(tx, x0 + hw, x1 - hw) : (x0 + x1) / 2;
    tz = (z1 - z0 > hd * 2) ? CS.clamp(tz, z0 + hd, z1 - hd) : (z0 + z1) / 2;
    if (cm.bias) tz += cm.bias;

    var lerpK = Math.min(1, dt * (cm.fit ? 2.2 : 6.5));
    camTarget.x += (tx - camTarget.x) * lerpK;
    camTarget.z += (tz - camTarget.z) * lerpK;

    var pitch = cm.pitch;
    var horiz = Math.cos(pitch) * camDist;
    camera.position.set(
      camTarget.x + Math.sin(camYaw) * horiz,
      camTarget.y + Math.sin(pitch) * camDist,
      camTarget.z + Math.cos(camYaw) * horiz
    );
    camera.lookAt(camTarget.x, camTarget.y + cm.lift, camTarget.z);
  }

  function loop() {
    requestAnimationFrame(loop);
    // Self-healing viewport: Telegram expands the webview after load, and a
    // backgrounded tab reports 0x0, so re-fit whenever the size really changes.
    var vp = CS.platform.size();
    if (vp.w > 1 && (vp.w !== lastW || vp.h !== lastH)) {
      onResize();
      renderer.setSize(vp.w, vp.h);
    }
    var dt = Math.min(0.05, clock.getDelta());
    update(dt);
    if (inspect.obj) inspect.obj.rotation.y += dt * 0.7;
    renderer.render(scene, camera);
    renderInspect();
  }

  /* ------------------------------------------------------------- startup */
  function init() {
    var host = document.getElementById('app');
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    // No sRGB output encode: colours are authored as they should appear, and
    // re-encoding them was washing every red and orange out to pastel.
    var lowSpec = CS.platform.mobile;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = lowSpec ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x1a1009);
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.5, 140);
    clock = new THREE.Clock();

    world = CS.world.build(scene, { lowSpec: lowSpec });
    stations = world.stations;
    stations.forEach(function (st) { st.group.userData.station = st; });

    CS.fx.init(scene);
    CS.orders.init(scene);

    chef = CS.models.chef();
    chef.group.scale.setScalar(1.25);
    scene.add(chef.group);

    chefShadow = CS.models.blobShadow();
    scene.add(chefShadow);

    highlight = CS.models.highlight();
    highlight.visible = false;
    scene.add(highlight);

    CS.ui.init();
    initInspect();
    CS.ui.setMuteLabel(false);
    bindInput();
    // Phones used to render at half resolution, which on a 3x screen meant a
    // 6x upscale and station plaques you could not read. Render at CSS
    // resolution like the desktop; PIXEL in the pause menu still backs it off
    // for a phone that cannot keep up.
    setPixelStep(1);
    onResize();
    placePlayer(CS.SPAWN.col, CS.SPAWN.row);
    refreshHeld();

    // One fixed perspective on a phone: the desktop angles are framed for a
    // wide screen, and cycling them on a portrait viewport only ever made the
    // kitchen smaller.
    if (CS.platform.mobile) { CAM_ORDER = ['mobile']; camMode = 'mobile'; }
    setCamMode(camMode);
    CS.touch.init();
    CS.platform.onResize(function () { syncCamModes(); onResize(); });
    S.level = CS.levelFor(1);
    CS.ui.setLevel(S.level);

    CS.ui.hideLoading();
    CS.ui.showStart(function () { showIntro(1); }, bestDay());
    loop();
  }

  CS.game = {
    setHeld: setHeld,
    refreshHeld: refreshHeld,
    setStationItem: setStationItem,
    serve: serve,
    puff: puff,
    toast: function (m, t) { CS.ui.toast(m, t); },
    state: S,

    /* ---- entry points shared by the keyboard and the on-screen controls ---- */
    setMoveAxis: function (x, y) { touchX = x; touchY = y; },
    setJumpHeld: function (down) { keys[' '] = !!down; },
    press: function (what) {
      // settings work from any screen; actions only while the shift is running
      if (what === 'pause') {
        if (S.phase === 'play') pause();
        else if (S.phase === 'pause') resume();
        return;
      }
      if (what === 'cam') { cycleCam(); return; }
      if (what === 'mute') { toggleMute(); return; }
      if (what === 'pixel') { setPixelStep(pixelStep % 3 + 1); return; }
      if (S.phase !== 'play') return;
      if (what === 'use') interact();
      else if (what === 'jump') tryJump();
      else if (what === 'dash') tryDash();
    },
    /* debug helpers: CS.game.teleport(col, row) drops the chef on a tile,
       CS.game.debug exposes the three.js objects for poking from the console */
    teleport: placePlayer,
    debug: function () { return { scene: scene, camera: camera, chef: chef, player: P, cams: CAMS }; }
  };

  window.addEventListener('DOMContentLoaded', function () {
    try {
      CS.platform.init();
      init();
    } catch (err) {
      document.getElementById('loading').innerHTML =
        '<div style="max-width:600px;text-align:center;line-height:1.8">COULD NOT START<br><br>' +
        String(err && err.message ? err.message : err) + '</div>';
      document.getElementById('loading').classList.remove('hidden');
      throw err;
    }
  });
})(window.CS);


