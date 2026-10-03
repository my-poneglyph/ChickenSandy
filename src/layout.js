/* The kitchen you own: a live, editable grid.

   config.js ships CS.BASE_MAP, the shop you start with. Everything after that
   -- a fryer you bought and dropped on the west wall, the back room opening
   up -- is a change to CS.MAP, which this module owns and which world.js
   rebuilds from between days.

   The grid is always the same CS.MAP_W x CS.MAP_H, however much of it you
   have paid for. Land you do not own yet is '~', drawn as nothing; that keeps
   CS.OX/CS.OZ and every world-space constant derived from them constant, so
   buying a wing never moves the shop out from under the camera.           */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  /* Which of the two expansions touch which edge. The base kitchen is the
     rectangle you start inside; each region pushes one edge outward. */
  var REGIONS = {
    south: { edge: 'row', to: 12 },
    east:  { edge: 'col', to: 18 }
  };
  var BASE = { c0: 0, c1: 14, r0: 0, r1: 10 };

  var WALL_STATIONS = 'FSKTLOIUMQHY';   // must sit on a boundary wall
  var FLOOR_STATIONS = 'CPB';           // must sit on open floor
  var ANY_STATIONS = 'X';               // a bin is happy either way, and the
                                        // starting kitchen has its two set
                                        // into the south wall

  function rowsToArr(map) { return map.map(function (r) { return r.split(''); }); }
  function arrToRows(g) { return g.map(function (r) { return r.join(''); }); }

  var L = CS.layout = {
    owned: [],                 // region ids bought so far
    bounds: { c0: 0, c1: 14, r0: 0, r1: 10 },

    isWallChar:  function (ch) { return WALL_STATIONS.indexOf(ch) >= 0; },
    isFloorChar: function (ch) { return FLOOR_STATIONS.indexOf(ch) >= 0; },
    isAnyChar:   function (ch) { return ANY_STATIONS.indexOf(ch) >= 0; },
    isStation:   function (ch) { return !!CS.STATION_DEFS[ch]; },

    /* ------------------------------------------------------------ bounds */
    computeBounds: function (owned) {
      var b = { c0: BASE.c0, c1: BASE.c1, r0: BASE.r0, r1: BASE.r1 };
      owned.forEach(function (id) {
        var r = REGIONS[id];
        if (!r) return;
        if (r.edge === 'row') b.r1 = Math.max(b.r1, r.to);
        if (r.edge === 'col') b.c1 = Math.max(b.c1, r.to);
      });
      return b;
    },

    inBounds: function (col, row) {
      var b = L.bounds;
      return col >= b.c0 && col <= b.c1 && row >= b.r0 && row <= b.r1;
    },

    /* A tile on the rectangle's edge: where wall-mounted kit can live. */
    isBorder: function (col, row) {
      var b = L.bounds;
      if (!L.inBounds(col, row)) return false;
      return col === b.c0 || col === b.c1 || row === b.r0 || row === b.r1;
    },

    /* ------------------------------------------------------------ rebuild
       Redraw the whole grid from a list of stations. The border ring is wall,
       the inside is floor, everything outside the rectangle is '~'. Stations
       are then stamped back on top. Doing it this way (rather than patching
       tiles in place) means an expansion cannot leave a stray wall behind in
       the middle of the room. */
    rebuild: function (placed) {
      var b = L.bounds;
      var g = [];
      for (var r = 0; r < CS.MAP_H; r++) {
        var row = [];
        for (var c = 0; c < CS.MAP_W; c++) {
          if (c < b.c0 || c > b.c1 || r < b.r0 || r > b.r1) row.push('~');
          else if (L.isBorder(c, r)) row.push('#');
          else row.push('.');
        }
        g.push(row);
      }
      placed.forEach(function (p) {
        if (p.col < 0 || p.col >= CS.MAP_W || p.row < 0 || p.row >= CS.MAP_H) return;
        if (!L.inBounds(p.col, p.row)) return;
        g[p.row][p.col] = p.ch;
      });
      CS.MAP = arrToRows(g);
      L.refreshDerived();
      return CS.MAP;
    },

    /* Everything downstream that is computed from where things are. The serve
       window drives the queue and the front door, so if you move it the
       customers move with it. */
    refreshDerived: function () {
      var cols = [];
      for (var r = 0; r <= L.bounds.r1; r++) {
        for (var c = 0; c <= L.bounds.c1; c++) {
          if (CS.charAt(c, r) === 'S') cols.push(c);
        }
      }
      if (cols.length) {
        cols.sort(function (a, z) { return a - z; });
        CS.SERVE_COL = cols[Math.floor(cols.length / 2)];
      }
      CS.DOOR_X = CS.OX + (CS.SERVE_COL + 0.5) * CS.TILE;
    },

    /* Every station currently on the grid, as {col,row,ch}. */
    stations: function () {
      var out = [];
      for (var r = 0; r < CS.MAP_H; r++) {
        for (var c = 0; c < CS.MAP_W; c++) {
          var ch = CS.charAt(c, r);
          if (L.isStation(ch)) out.push({ col: c, row: r, ch: ch });
        }
      }
      return out;
    },

    /* ------------------------------------------------------------- expand
       Buying a wing moves one wall outward. Anything mounted on the wall that
       just became interior floor slides out to the new wall in the same lane,
       so a fryer you had on the east wall is still a fryer on the east wall
       rather than an obstacle stranded in the middle of the kitchen. */
    unlock: function (region) {
      if (L.owned.indexOf(region) >= 0) return false;
      var def = REGIONS[region];
      if (!def) return false;

      var old = L.bounds;
      var oldEdge = def.edge === 'row' ? old.r1 : old.c1;
      var placed = L.stations();

      L.owned.push(region);
      L.bounds = L.computeBounds(L.owned);
      var nu = def.edge === 'row' ? L.bounds.r1 : L.bounds.c1;

      placed.forEach(function (p) {
        var on = def.edge === 'row' ? p.row : p.col;
        if (on !== oldEdge) return;
        // floor kit stays put -- the wall it was beside is just floor now,
        // which is a perfectly good place for a prep counter to stand
        if (!L.isWallChar(p.ch) && !L.isAnyChar(p.ch)) return;
        if (def.edge === 'row') p.row = nu; else p.col = nu;
      });

      L.rebuild(placed);
      return true;
    },

    /* --------------------------------------------------------- placement */
    tileFree: function (col, row) {
      var ch = CS.charAt(col, row);
      return ch === '.' || ch === '#';
    },

    /* Can `ch` go at (col,row)? Returns {ok, why}. The editor shows `why`
       straight back to the player, so each one is written to be read. */
    canPlace: function (col, row, ch) {
      if (!L.inBounds(col, row)) return { ok: false, why: 'You do not own that land' };
      var cur = CS.charAt(col, row);
      if (L.isStation(cur)) return { ok: false, why: 'Something is already there' };

      if (L.isAnyChar(ch)) {
        if (L.isBorder(col, row)) return { ok: true };
        if (col === CS.SPAWN.col && row === CS.SPAWN.row) {
          return { ok: false, why: 'You stand there at opening time' };
        }
        return { ok: true };
      }
      if (L.isWallChar(ch)) {
        if (!L.isBorder(col, row)) return { ok: false, why: 'That has to go against a wall' };
        if (ch === 'S' && row !== L.bounds.r0) {
          return { ok: false, why: 'The window has to face the dining room' };
        }
        return { ok: true };
      }
      if (L.isFloorChar(ch)) {
        if (L.isBorder(col, row)) return { ok: false, why: 'That needs floor, not a wall' };
        if (col === CS.SPAWN.col && row === CS.SPAWN.row) {
          return { ok: false, why: 'You stand there at opening time' };
        }
        return { ok: true };
      }
      return { ok: false, why: '' };
    },

    /* ------------------------------------------------------------ reachability
       A kitchen you cannot walk around is not a kitchen. Flood the floor from
       the spawn tile and insist that every other floor tile is in the flood,
       and that every station has at least one flooded tile beside it -- a
       fryer walled in behind a row of counters is unusable, so the editor
       refuses to leave you in that state. */
    reachable: function () {
      var seen = {}, q = [], key = function (c, r) { return c + ',' + r; };
      var start = CS.SPAWN;
      if (CS.charAt(start.col, start.row) !== '.') return seen;
      seen[key(start.col, start.row)] = true;
      q.push([start.col, start.row]);
      var D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      while (q.length) {
        var n = q.shift();
        for (var i = 0; i < 4; i++) {
          var c = n[0] + D[i][0], r = n[1] + D[i][1], k = key(c, r);
          if (seen[k]) continue;
          if (CS.charAt(c, r) !== '.') continue;
          seen[k] = true;
          q.push([c, r]);
        }
      }
      return seen;
    },

    validate: function () {
      var seen = L.reachable(), k;
      var orphanFloor = 0, orphanSt = [];
      for (var r = 0; r < CS.MAP_H; r++) {
        for (var c = 0; c < CS.MAP_W; c++) {
          var ch = CS.charAt(c, r);
          if (ch === '.' && !seen[c + ',' + r]) orphanFloor++;
          if (L.isStation(ch)) {
            var touch = false;
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
              if (seen[(c + d[0]) + ',' + (r + d[1])]) touch = true;
            });
            if (!touch) orphanSt.push(CS.STATION_DEFS[ch].name);
          }
        }
      }
      if (orphanFloor) {
        return { ok: false, why: orphanFloor + ' tile' + (orphanFloor > 1 ? 's are' : ' is') +
          ' walled off from the rest of the kitchen' };
      }
      if (orphanSt.length) {
        return { ok: false, why: 'You cannot reach the ' + orphanSt[0] };
      }
      var need = [['S', 'serving window'], ['P', 'plate stack'], ['X', 'trash']];
      for (var i = 0; i < need.length; i++) {
        if (!L.count(need[i][0])) return { ok: false, why: 'A kitchen needs a ' + need[i][1] };
      }
      return { ok: true };
    },

    count: function (ch) {
      var n = 0;
      for (var r = 0; r < CS.MAP_H; r++) {
        for (var c = 0; c < CS.MAP_W; c++) if (CS.charAt(c, r) === ch) n++;
      }
      return n;
    },

    /* ------------------------------------------------------- save / load */
    reset: function () {
      L.owned = [];
      L.bounds = L.computeBounds(L.owned);
      CS.MAP = CS.BASE_MAP.slice();
      L.refreshDerived();
    },

    serialize: function () { return { owned: L.owned.slice(), grid: CS.MAP.slice() }; },

    load: function (data) {
      if (!data || !data.grid || data.grid.length !== CS.MAP_H) { L.reset(); return false; }
      for (var i = 0; i < data.grid.length; i++) {
        if (typeof data.grid[i] !== 'string' || data.grid[i].length !== CS.MAP_W) {
          L.reset(); return false;
        }
      }
      L.owned = (data.owned || []).filter(function (r) { return !!REGIONS[r]; });
      L.bounds = L.computeBounds(L.owned);
      CS.MAP = data.grid.slice();
      L.refreshDerived();
      // a save from an older build, or one hand-edited into a corner, should
      // not strand the player in an unplayable shop
      if (!L.validate().ok) { L.reset(); return false; }
      return true;
    }
  };

  L.bounds = L.computeBounds(L.owned);
})(window.CS);
