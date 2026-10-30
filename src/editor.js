/* The kitchen editor: rearrange the shop between shifts.

   A flat DOM grid rather than dragging things around in 3D, because the thing
   you actually need while laying out a kitchen is to see the whole floor at
   once and know instantly which tiles are legal -- and because tapping a tile
   works the same on a phone as it does with a mouse.

   Anything you lift off the floor goes into the tray at the top, alongside
   whatever you have bought and not yet placed. Nothing is written to the save
   until you hit DONE, and DONE stays locked while the layout is unplayable
   (see CS.layout.validate), so you cannot wall yourself away from the fryers
   and then have to start a new shop.                                       */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  /* How each tile reads in the grid. Short labels: at 19 columns on a phone a
     cell is about 18px, which is two characters and no more. */
  var GLYPH = {
    '#': { t: '',    c: 'wall' },
    '~': { t: '',    c: 'void' },
    '.': { t: '',    c: 'floor' },
    'F': { t: 'FRY', c: 'st fryer' },
    'S': { t: 'WIN', c: 'st serve' },
    'X': { t: 'BIN', c: 'st bin' },
    'C': { t: 'PRP', c: 'st prep' },
    'K': { t: 'CHK', c: 'st crate' },
    'T': { t: 'SPD', c: 'st crate' },
    'P': { t: 'PLT', c: 'st stack' },
    'B': { t: 'BUN', c: 'st stack' },
    'L': { t: 'LET', c: 'st top-let' },
    'O': { t: 'TOM', c: 'st top-tom' },
    'I': { t: 'PIC', c: 'st top-pic' },
    'M': { t: 'MAY', c: 'st sau-may' },
    'Q': { t: 'BBQ', c: 'st sau-bbq' },
    'H': { t: 'HOT', c: 'st sau-hot' },
    'Y': { t: 'KET', c: 'st sau-ket' },
    'U': { t: 'CUP', c: 'st stack' }
  };

  /* ------------------------------------------------------ tile pictures
     The grid used to be flat colour squares with three-letter codes in a
     5px font, which read as a blur of pixels next to the painted 3D
     kitchen. Now every station tile is a little picture of the real model,
     rendered once (per season, since the November menu dresses the stations
     differently) by a throwaway renderer and kept as an image. If WebGL
     will not give us a second context the grid falls back to the codes. */
  var thumbs = null;

  function makeThumbs() {
    if (thumbs) return thumbs;
    thumbs = {};
    var r = null;
    try {
      var size = 112;
      r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1);
      r.setSize(size, size, false);
      r.setClearColor(0x000000, 0);
      r.outputEncoding = THREE.sRGBEncoding;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.0;
      var sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(CS.linear(0xffeedd), CS.linear(0x6a4e3a), 0.9));
      var key = new THREE.DirectionalLight(CS.linear(0xffdcb0), 1.4);
      key.position.set(-3, 7, 5);
      sc.add(key);
      var cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
      var box = new THREE.Box3(), mid = new THREE.Vector3();
      var pitch = 0.85;
      var out = document.createElement('canvas');
      out.width = out.height = size;
      var x2 = out.getContext('2d');
      Object.keys(GLYPH).forEach(function (ch) {
        var m = CS.world.stationModel(ch);
        if (!m) return;
        sc.add(m);
        box.setFromObject(m);
        // one scale for every tile, centred on the tile itself, so a long
        // handle or a tall awning does not make its station look smaller
        mid.set(0, Math.min(box.max.y, 1.8) * 0.42, 0.1);
        var d = 1.75 / Math.sin(cam.fov * Math.PI / 360);
        cam.position.set(mid.x, mid.y + Math.sin(pitch) * d, mid.z + Math.cos(pitch) * d);
        cam.lookAt(mid);
        r.render(sc, cam);
        // a soft drop shadow lifts pale stone and limestone off the cream floor
        x2.clearRect(0, 0, size, size);
        x2.shadowColor = 'rgba(40,24,10,0.55)';
        x2.shadowBlur = 7;
        x2.shadowOffsetY = 4;
        x2.drawImage(r.domElement, 0, 0);
        thumbs[ch] = out.toDataURL('image/png');
        sc.remove(m);
      });
    } catch (e) {
      thumbs = {};
    }
    if (r) { r.dispose(); if (r.forceContextLoss) r.forceContextLoss(); }
    // one stylesheet rule per picture, so re-rendering the grid on every tap
    // does not rebuild a few hundred KB of image data in the markup
    var css = '';
    for (var ch in thumbs) {
      css += '.kgrid i.pic-' + ch + ',.tray .pic-' + ch + '{background-image:url(' + thumbs[ch] + ')}\n';
    }
    var tag = document.createElement('style');
    tag.textContent = css;
    document.head.appendChild(tag);
    return thumbs;
  }

  function charToPart(ch) {
    for (var i = 0; i < CS.UPGRADES.length; i++) {
      var u = CS.UPGRADES[i];
      if (u.kind === 'part' && u.ch === ch) return u;
    }
    return null;
  }

  var snapshot = null;   // grid + stock as they were when the editor opened
  var placed = [];       // live list of {col,row,ch}
  var stock = {};        // partId -> count sitting in the tray
  var sel = null;        // {ch, id} currently in hand, or null
  var card = null;
  var onClose = null;

  function stockTotal() {
    var n = 0;
    for (var k in stock) n += stock[k];
    return n;
  }

  function apply() { CS.layout.rebuild(placed); }

  function addStock(id, n) { stock[id] = (stock[id] || 0) + n; }

  /* ----------------------------------------------------------- rendering */
  function stationName(ch) {
    var d = CS.STATION_DEFS[ch];
    return d ? d.name : '';
  }

  function gridHTML() {
    var b = CS.layout.bounds, h = '', pics = makeThumbs();
    for (var r = 0; r < CS.MAP_H; r++) {
      for (var c = 0; c < CS.MAP_W; c++) {
        var ch = CS.charAt(c, r);
        var g = GLYPH[ch] || GLYPH['.'];
        var cls = 'cell ' + g.c + ((c + r) % 2 ? ' alt' : '');
        var pic = pics[ch], name = stationName(ch);
        if (sel) {
          var can = CS.layout.canPlace(c, r, sel.ch);
          cls += can.ok ? ' ok' : ' no';
        } else if (CS.layout.isStation(ch)) {
          cls += ' lift';
        }
        if (c === CS.SPAWN.col && r === CS.SPAWN.row) cls += ' spawn';
        if (!CS.layout.inBounds(c, r)) cls += ' locked';
        if (pic) cls += ' pic pic-' + ch;
        h += '<i class="' + cls + '" data-c="' + c + '" data-r="' + r + '"' +
          (name ? ' title="' + name + '" aria-label="' + name + '"' : '') +
          '>' +
          (pic ? '' : g.t) + '</i>';
      }
    }
    return '<div class="kgrid" style="grid-template-columns:repeat(' + CS.MAP_W + ',1fr)">'
      + h + '</div>'
      + '<div class="khint">' + (b.c1 - b.c0 + 1) + ' x ' + (b.r1 - b.r0 + 1)
      + ' &#183; buy a wing in the shop to grow the floor</div>';
  }

  function trayHTML() {
    var items = [];
    for (var id in stock) {
      if (!stock[id]) continue;
      var u = CS.econ.upgrade(id);
      if (!u) continue;
      var on = sel && sel.id === id;
      var tp = makeThumbs()[u.ch];
      items.push('<button class="tray' + (on ? ' on' : '') + '" data-id="' + id + '">' +
        (tp ? '<span class="tpic pic-' + u.ch + '"></span>' : '') +
        u.name + ' <b>x' + stock[id] + '</b></button>');
    }
    if (!items.length) {
      items.push('<span class="khint" style="margin:0">' +
        'Tap anything in the kitchen to pick it up and move it.</span>');
    }
    return '<div class="trayrow">' + items.join('') + '</div>';
  }

  function statusHTML() {
    var v = CS.layout.validate();
    if (!v.ok) return '<div class="kbad">&#9888; ' + v.why + '</div>';
    if (sel) {
      var u = CS.econ.upgrade(sel.id);
      return '<div class="kok">Holding ' + (u ? u.name : sel.ch) +
        ' &#183; tap a green tile to set it down</div>';
    }
    return '<div class="kok">Looking good. Tap a station to move it.</div>';
  }

  function render() {
    if (!card) return;
    card.querySelector('#kTray').innerHTML = trayHTML();
    card.querySelector('#kGrid').innerHTML = gridHTML();
    card.querySelector('#kStatus').innerHTML = statusHTML();
    var ok = CS.layout.validate().ok;
    var done = card.querySelector('#kDone');
    done.disabled = !ok;
    done.classList.toggle('off', !ok);
    bindCells();
  }

  /* ------------------------------------------------------- interaction */
  function selectStock(id) {
    if (sel) returnToTray();
    if (!stock[id]) return;
    var u = CS.econ.upgrade(id);
    stock[id]--;
    if (!stock[id]) delete stock[id];
    sel = { id: id, ch: u.ch };
    render();
  }

  function returnToTray() {
    if (!sel) return;
    addStock(sel.id, 1);
    sel = null;
  }

  function tapCell(c, r) {
    if (sel) {
      var can = CS.layout.canPlace(c, r, sel.ch);
      if (!can.ok) {
        if (can.why) flash(can.why);
        return;
      }
      placed.push({ col: c, row: r, ch: sel.ch });
      sel = null;
      apply();
      CS.audio.place();
      render();
      return;
    }
    // nothing in hand: lift whatever is on this tile
    var ch = CS.charAt(c, r);
    if (!CS.layout.isStation(ch)) return;
    var part = charToPart(ch);
    if (!part) { flash('That is built in'); return; }
    for (var i = 0; i < placed.length; i++) {
      if (placed[i].col === c && placed[i].row === r) { placed.splice(i, 1); break; }
    }
    sel = { id: part.id, ch: ch };
    apply();
    CS.audio.pick();
    render();
  }

  var flashT = null;
  function flash(msg) {
    var s = card && card.querySelector('#kStatus');
    if (!s) return;
    s.innerHTML = '<div class="kbad">' + msg + '</div>';
    CS.audio.error();
    clearTimeout(flashT);
    flashT = setTimeout(function () {
      if (card) card.querySelector('#kStatus').innerHTML = statusHTML();
    }, 1400);
  }

  function bindCells() {
    var cells = card.querySelectorAll('.cell');
    for (var i = 0; i < cells.length; i++) {
      cells[i].onclick = function () {
        tapCell(parseInt(this.getAttribute('data-c'), 10),
          parseInt(this.getAttribute('data-r'), 10));
      };
    }
    var trays = card.querySelectorAll('.tray');
    for (var j = 0; j < trays.length; j++) {
      trays[j].onclick = function () { selectStock(this.getAttribute('data-id')); };
    }
  }

  /* -------------------------------------------------------------- module */
  CS.editor = {
    open: function (done) {
      onClose = done;
      snapshot = { grid: CS.MAP.slice(), stock: JSON.parse(JSON.stringify(CS.econ.state.stock)) };
      placed = CS.layout.stations();
      stock = JSON.parse(JSON.stringify(CS.econ.state.stock));
      sel = null;

      card = CS.ui.showScreen(
        '<h1>THE KITCHEN</h1>' +
        '<div id="kTray"></div>' +
        '<div id="kGrid"></div>' +
        '<div id="kStatus"></div>' +
        '<div class="krow">' +
        '<button class="btn" id="kReset">START OVER</button>' +
        '<button class="btn" id="kCancel">CANCEL</button>' +
        '<button class="big" id="kDone">DONE</button>' +
        '</div>', 'wide');

      card.querySelector('#kDone').onclick = function () {
        if (!CS.layout.validate().ok) return;
        if (sel) returnToTray();
        CS.econ.state.stock = stock;
        CS.econ.save();
        CS.ui.hideScreen();
        card = null;
        if (onClose) onClose(true);
      };
      card.querySelector('#kCancel').onclick = function () {
        CS.MAP = snapshot.grid.slice();
        CS.layout.refreshDerived();
        CS.econ.state.stock = snapshot.stock;
        CS.ui.hideScreen();
        card = null;
        if (onClose) onClose(false);
      };
      card.querySelector('#kReset').onclick = function () {
        // back to the kitchen you started the session with, with everything
        // you have ever bought sitting in the tray
        if (sel) returnToTray();
        var all = CS.layout.stations();
        placed = [];
        stock = JSON.parse(JSON.stringify(CS.econ.state.stock));
        all.forEach(function (p) {
          var u = charToPart(p.ch);
          if (u) addStock(u.id, 1);
        });
        apply();
        render();
      };

      render();
    }
  };
})(window.CS);
