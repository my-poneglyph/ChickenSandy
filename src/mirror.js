/* The polished kitchen floor.

   A real planar reflection: once a frame the scene is drawn again from a
   camera mirrored through the floor, into a texture at reduced resolution, and
   that texture is laid over the polished tiles, softened very slightly
   with a small five-tap blur and faded by a Fresnel term, so it shines
   brightest across the room and softest at your feet, the way a real
   polished floor does.

   Anything that should not show up in the floor (plaques, progress bars, the
   chef's blob shadow, the target highlight) is moved onto layer 1 with
   CS.noMirror(): the main camera sees layers 0 and 1, the mirror camera only
   layer 0.

   This is the one piece of the game that costs a second draw of the scene,
   so phones skip it. `?mirror=1` / `?mirror=0` forces it either way. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  CS.noMirror = function (obj) {
    obj.traverse(function (o) { o.layers.set(1); });
    return obj;
  };

  var VERT = [
    'uniform mat4 textureMatrix;',
    'varying vec4 vUv;',
    'varying vec3 vWorld;',
    'void main() {',
    '  vUv = textureMatrix * vec4(position, 1.0);',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorld = wp.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  // The render target is cleared to transparent black, so averaging taps
  // weights colour by coverage; dividing by alpha undoes that, and edges of a
  // reflected object fade out instead of going dark. The Fresnel term is
  // what makes it read as polish rather than haze: looking straight down a
  // polished floor reflects least, and across the room it is nearly a mirror.
  var FRAG = [
    'uniform sampler2D tMirror;',
    'uniform float strength;',
    'uniform vec2 texel;',
    'varying vec4 vUv;',
    'varying vec3 vWorld;',
    'void main() {',
    '  vec2 uv = vUv.xy / vUv.w;',
    '  vec4 c = texture2D(tMirror, uv) * 0.6;',
    '  c += texture2D(tMirror, uv + vec2(0.0, texel.y)) * 0.1;',
    '  c += texture2D(tMirror, uv - vec2(0.0, texel.y)) * 0.1;',
    '  c += texture2D(tMirror, uv + vec2(texel.x, 0.0)) * 0.10;',
    '  c += texture2D(tMirror, uv - vec2(texel.x, 0.0)) * 0.10;',
    '  vec3 col = c.rgb / max(c.a, 0.001);',
    '  float cosV = clamp(normalize(cameraPosition - vWorld).y, 0.0, 1.0);',
    '  float fres = 0.3 + 0.7 * pow(1.0 - cosV, 1.5);',
    '  gl_FragColor = vec4(col * 0.9, c.a * strength * fres);',
    '  #include <encodings_fragment>',
    '}'
  ].join('\n');

  var rt = null, mesh = null, on = true, scale = 0.65;
  var vcam = new THREE.PerspectiveCamera();
  vcam.layers.set(0);

  var plane = new THREE.Plane(), normal = new THREE.Vector3();
  var mirrorPos = new THREE.Vector3(), camPos = new THREE.Vector3();
  var rot = new THREE.Matrix4(), lookAt = new THREE.Vector3();
  var clip = new THREE.Vector4(), view = new THREE.Vector3();
  var target = new THREE.Vector3(), q = new THREE.Vector4();
  var texMatrix = new THREE.Matrix4();
  var size = new THREE.Vector2(), clearCol = new THREE.Color();

  function ensureTarget(renderer) {
    renderer.getDrawingBufferSize(size);
    var w = Math.max(64, Math.floor(size.x * scale));
    var h = Math.max(64, Math.floor(size.y * scale));
    if (!rt) {
      rt = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, generateMipmaps: false
      });
    } else if (rt.width !== w || rt.height !== h) {
      rt.setSize(w, h);
    }
    if (mesh) mesh.material.uniforms.texel.value.set(1 / w, 1 / h);
  }

  CS.mirror = {
    /* Build the reflective sheet for a w x d floor centred on (x, z). The
       world owns it, so it is thrown away with the rest of the shop when the
       kitchen is rebuilt. */
    create: function (w, d, x, z, strength) {
      var mat = new THREE.ShaderMaterial({
        uniforms: {
          tMirror: { value: rt ? rt.texture : null },
          textureMatrix: { value: texMatrix },
          strength: { value: strength == null ? 0.34 : strength },
          texel: { value: new THREE.Vector2(1 / 512, 1 / 512) }
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false
      });
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.006, z);
      mesh.renderOrder = 1;
      mesh.visible = on;
      return mesh;
    },

    setEnabled: function (v) { on = !!v; if (mesh) mesh.visible = on; },
    enabled: function () { return on; },

    /* Draw the mirrored scene. Call once a frame, before the main render. */
    render: function (renderer, scene, camera) {
      if (!on || !mesh || !mesh.parent) return;
      ensureTarget(renderer);
      mesh.material.uniforms.tMirror.value = rt.texture;

      mesh.updateMatrixWorld();
      camera.updateMatrixWorld();
      mirrorPos.setFromMatrixPosition(mesh.matrixWorld);
      camPos.setFromMatrixPosition(camera.matrixWorld);
      rot.extractRotation(mesh.matrixWorld);
      normal.set(0, 0, 1).applyMatrix4(rot);

      view.subVectors(mirrorPos, camPos);
      if (view.dot(normal) > 0) return;          // looking at it from below
      view.reflect(normal).negate().add(mirrorPos);

      rot.extractRotation(camera.matrixWorld);
      lookAt.set(0, 0, -1).applyMatrix4(rot).add(camPos);
      target.subVectors(mirrorPos, lookAt).reflect(normal).negate().add(mirrorPos);

      vcam.position.copy(view);
      vcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
      vcam.lookAt(target);
      vcam.far = camera.far;
      vcam.near = camera.near;
      vcam.updateMatrixWorld();
      vcam.projectionMatrix.copy(camera.projectionMatrix);

      texMatrix.set(0.5, 0.0, 0.0, 0.5,
                    0.0, 0.5, 0.0, 0.5,
                    0.0, 0.0, 0.5, 0.5,
                    0.0, 0.0, 0.0, 1.0);
      texMatrix.multiply(vcam.projectionMatrix);
      texMatrix.multiply(vcam.matrixWorldInverse);
      texMatrix.multiply(mesh.matrixWorld);

      // Oblique near plane: clip everything under the floor out of the
      // mirror camera's view, so the dining room and the porch (which sit a
      // touch lower) never show up in the tiles.
      plane.setFromNormalAndCoplanarPoint(normal, mirrorPos);
      plane.applyMatrix4(vcam.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      var pm = vcam.projectionMatrix.elements;
      q.x = (Math.sign(clip.x) + pm[8]) / pm[0];
      q.y = (Math.sign(clip.y) + pm[9]) / pm[5];
      q.z = -1.0;
      q.w = (1.0 + pm[10]) / pm[14];
      clip.multiplyScalar(2.0 / clip.dot(q));
      pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1.0 - 0.003; pm[14] = clip.w;

      var prevTarget = renderer.getRenderTarget();
      var prevShadow = renderer.shadowMap.autoUpdate;
      var prevAlpha = renderer.getClearAlpha();
      renderer.getClearColor(clearCol);
      var prevFog = scene.fog;

      mesh.visible = false;
      renderer.shadowMap.autoUpdate = false;     // reuse this frame's shadows
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, vcam);

      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(clearCol, prevAlpha);
      renderer.shadowMap.autoUpdate = prevShadow;
      scene.fog = prevFog;
      mesh.visible = true;
    }
  };

  /* Phones skip it by default; the URL can force it either way. Called once
     at startup, after the platform has worked out what it is running on. */
  CS.mirror.auto = function (lowSpec) {
    var forced = null;
    try {
      var m = /[?&]mirror=([01])/.exec(window.location.search);
      if (m) forced = m[1] === '1';
    } catch (e) { /* no location: use the default */ }
    CS.mirror.setEnabled(forced == null ? !lowSpec : forced);
  };
})(window.CS);
