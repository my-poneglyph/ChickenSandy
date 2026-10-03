/* Item data helpers and the single source of truth for "what does E do here?".
   resolve() is used both to draw the hint line and to actually run the action,
   so the prompt can never lie about what will happen. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  CS.newPlate = function () { return { k: 'plate', sandwich: null, fries: false, cups: [] }; };
  CS.newCup = function () { return { k: 'cup', sauce: null }; };

  CS.isRaw = function (item) { return !!(item && CS.COOK[item.k]); };
  CS.isBurnt = function (item) { return !!(item && (item.k === 'burntChicken' || item.k === 'burntFries')); };

  CS.itemLabel = function (item) {
    if (!item) return 'Nothing';
    if (item.k === 'cup') return item.sauce ? CS.ING[item.sauce].label + ' Cup' : 'Empty Cup';
    if (item.k === 'plate') {
      var bits = [];
      if (item.sandwich) bits.push(item.sandwich.chicken ? 'Sandwich' : 'Bun');
      if (item.fries) bits.push('Fries');
      if (item.cups.length) bits.push(item.cups.length + ' Cup' + (item.cups.length > 1 ? 's' : ''));
      return bits.length ? 'Plate: ' + bits.join(' + ') : 'Empty Plate';
    }
    return CS.ITEMS[item.k].label;
  };

  /* Short form for the one-line action hint, so it never runs off screen. */
  CS.itemShort = function (item) {
    if (!item) return 'Nothing';
    if (item.k === 'plate') return 'Plate';
    if (item.k === 'cup') return item.sauce ? CS.ING[item.sauce].label + ' Cup' : 'Cup';
    return CS.ITEMS[item.k].label;
  };

  CS.plateIsEmpty = function (p) { return !p.sandwich && !p.fries && p.cups.length === 0; };

  /* What slot on a plate would this item fill? null if it does not fit. */
  CS.plateAcceptsWhy = function (plate, item) {
    if (!plate || plate.k !== 'plate' || !item) return { ok: false, why: '' };
    if (item.k === 'friedChicken') {
      if (!plate.sandwich) return { ok: false, why: 'Needs a bun first' };
      if (plate.sandwich.chicken) return { ok: false, why: 'Already has chicken' };
      return { ok: true, what: 'chicken' };
    }
    if (item.k === 'cookedFries') {
      if (plate.fries) return { ok: false, why: 'Already has fries' };
      return { ok: true, what: 'fries' };
    }
    if (item.k === 'cup') {
      if (!item.sauce) return { ok: false, why: 'Fill the cup first' };
      if (plate.cups.length >= CS.econ.mod('cups')) return { ok: false, why: 'No room for more cups' };
      return { ok: true, what: 'cup' };
    }
    if (CS.isBurnt(item)) return { ok: false, why: 'That is burnt — bin it' };
    if (CS.isRaw(item)) return { ok: false, why: 'Fry it first' };
    return { ok: false, why: '' };
  };

  CS.addToPlate = function (plate, item) {
    var r = CS.plateAcceptsWhy(plate, item);
    if (!r.ok) return false;
    if (r.what === 'chicken') plate.sandwich.chicken = true;
    else if (r.what === 'fries') plate.fries = true;
    else plate.cups.push(item.sauce);
    return true;
  };

  function blocked(text) { return { ok: false, text: text }; }
  function action(text, run) { return { ok: true, text: text, run: run }; }

  /* st: station, held: current item (or null). Returns {ok, text, run}. */
  CS.resolve = function (st, held) {
    var G = CS.game;

    switch (st.type) {
      /* ---------------------------------------------------------- crates */
      case 'crate': {
        if (held) return blocked('Wings full');
        var gives = st.def.gives;
        return action('Take ' + CS.ITEMS[gives].label, function () {
          G.setHeld({ k: gives });
          CS.audio.pick();
        });
      }

      case 'plates': {
        if (!held) return action('Take a Plate', function () { G.setHeld(CS.newPlate()); CS.audio.pick(); });
        if (held.k === 'plate' && CS.plateIsEmpty(held)) {
          return action('Put the Plate back', function () { G.setHeld(null); CS.audio.place(); });
        }
        return blocked(held.k === 'plate' ? 'Plate is not empty' : 'Wings full');
      }

      case 'buns': {
        if (!held || held.k !== 'plate') return blocked('Grab a plate first');
        if (held.sandwich) return blocked('Bun is already on');
        return action('Add a Bun', function () {
          held.sandwich = { chicken: false, toppings: [], sauces: [] };
          G.refreshHeld(); CS.audio.place();
        });
      }

      /* ------------------------------------------------------- toppings */
      case 'topping': {
        var ing = st.def.ing;
        if (!held || held.k !== 'plate') return blocked('Needs a plate with a bun');
        if (!held.sandwich) return blocked('Add a bun first');
        if (held.sandwich.toppings.indexOf(ing) >= 0) return blocked(CS.ING[ing].label + ' already on');
        return action('Add ' + CS.ING[ing].label, function () {
          held.sandwich.toppings.push(ing);
          G.refreshHeld(); CS.audio.topping();
          G.puff(st, CS.ING[ing].color);
        });
      }

      /* --------------------------------------------------------- sauces */
      case 'sauce': {
        var s = st.def.ing;
        if (held && held.k === 'cup') {
          if (held.sauce) return blocked('Cup is already full');
          if (CS.CUP_SAUCES.indexOf(s) < 0) return blocked('Mayo does not come in cups');
          return action('Fill Cup with ' + CS.ING[s].label, function () {
            held.sauce = s; G.refreshHeld(); CS.audio.sauce();
          });
        }
        if (held && held.k === 'plate') {
          if (!held.sandwich) return blocked('Add a bun first');
          if (CS.SANDWICH_SAUCES.indexOf(s) < 0) return blocked('Ketchup only goes in cups');
          if (held.sandwich.sauces.indexOf(s) >= 0) return blocked(CS.ING[s].label + ' already on');
          return action('Squeeze ' + CS.ING[s].label, function () {
            held.sandwich.sauces.push(s);
            G.refreshHeld(); CS.audio.sauce();
            G.puff(st, CS.ING[s].color);
          });
        }
        return blocked('Hold a plate or a cup');
      }

      case 'cups': {
        if (!held) return action('Take an Empty Cup', function () { G.setHeld(CS.newCup()); CS.audio.pick(); });
        return blocked('Wings full');
      }

      /* --------------------------------------------------------- fryer */
      case 'fryer': {
        if (st.item) {
          if (held) return blocked('Fryer is busy');
          var name = CS.ITEMS[st.item.k].label;
          return action('Lift out ' + name, function () {
            G.setHeld(st.item);
            G.setStationItem(st, null);
            st.cook = null;
            CS.audio.pick();
          });
        }
        if (!held) return blocked('Drop in chicken or potatoes');
        if (!CS.COOK[held.k]) return blocked('That does not go in the fryer');
        return action('Fry the ' + CS.ITEMS[held.k].label, function () {
          var def = CS.cookDef(held.k);
          G.setStationItem(st, held);
          st.cook = { t: 0, def: def, stage: 'cooking', warned: false };
          G.setHeld(null);
          CS.audio.drop();
          G.puff(st, 0xffd28a, 10);
        });
      }

      /* ------------------------------------------------------- counter */
      case 'counter': {
        if (held && st.item) {
          // plate on the counter, ingredient in hand
          if (st.item.k === 'plate') {
            var r1 = CS.plateAcceptsWhy(st.item, held);
            if (r1.ok) return action('Add ' + CS.itemShort(held) + ' to the Plate', function () {
              CS.addToPlate(st.item, held);
              G.setHeld(null); G.setStationItem(st, st.item);
              CS.audio.place();
            });
            if (r1.why) return blocked(r1.why);
          }
          // plate in hand, ingredient on the counter
          if (held.k === 'plate') {
            var r2 = CS.plateAcceptsWhy(held, st.item);
            if (r2.ok) return action('Pick up the ' + CS.itemShort(st.item), function () {
              CS.addToPlate(held, st.item);
              G.setStationItem(st, null); G.refreshHeld();
              CS.audio.place();
            });
            if (r2.why) return blocked(r2.why);
          }
          return blocked('Counter is taken');
        }
        if (held) return action('Set down the ' + CS.itemShort(held), function () {
          G.setStationItem(st, held); G.setHeld(null); CS.audio.place();
        });
        if (st.item) return action('Pick up the ' + CS.itemShort(st.item), function () {
          G.setHeld(st.item); G.setStationItem(st, null); CS.audio.pick();
        });
        return blocked('Empty counter');
      }

      /* --------------------------------------------------------- serve */
      case 'serve': {
        if (!held) return blocked('Bring a finished plate');
        if (held.k !== 'plate') return blocked('Plate it up first');
        if (CS.plateIsEmpty(held)) return blocked('That plate is empty');
        return action('Serve this Plate', function () { G.serve(held); });
      }

      /* --------------------------------------------------------- trash */
      case 'trash': {
        if (!held) return blocked('Nothing to bin');
        // what you bin, you bought: the cost comes off the day's takings
        var loss = CS.econ.ledger ? CS.econ.costOf(held) : 0;
        return action('Bin the ' + CS.itemShort(held) +
          (loss > 0 ? ' (-' + CS.money(loss) + ')' : ''), function () {
          CS.econ.waste(held);
          G.setHeld(null);
          CS.audio.trash();
          G.puff(st, 0x6a5f55, 8);
        });
      }
    }
    return blocked('');
  };
})(window.CS);
