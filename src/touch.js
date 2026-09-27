/* On-screen controls for phones and Telegram: a floating thumbstick on the
   left, action buttons on the right. Everything routes through the same
   CS.game entry points the keyboard uses, so there is only one code path for
   movement, jumping and interacting. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var STICK_R = 52;          // px of travel before the stick is at full tilt
  var stick, nub, zone;
  var active = null;         // pointerId currently driving the stick
  var ox = 0, oy = 0;

  function showStick(x, y) {
    ox = x; oy = y;
    stick.style.left = x + 'px';
    stick.style.top = y + 'px';
    stick.style.opacity = '1';
    nub.style.transform = 'translate(-50%,-50%)';
  }

  function moveStick(x, y) {
    var dx = x - ox, dy = y - oy;
    var len = Math.hypot(dx, dy);
    if (len > STICK_R) { dx = dx / len * STICK_R; dy = dy / len * STICK_R; len = STICK_R; }
    nub.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    // dead zone stops the chef drifting when a thumb just rests on the glass
    var mag = len / STICK_R;
    if (mag < 0.16) { CS.game.setMoveAxis(0, 0); return; }
    CS.game.setMoveAxis(dx / STICK_R, dy / STICK_R);
  }

  function endStick() {
    active = null;
    stick.style.opacity = '0';
    CS.game.setMoveAxis(0, 0);
  }

  /* A button that fires on press, optionally reporting hold state too. */
  function bindButton(el, onDown, onUp) {
    if (!el) return;
    var held = null;
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (held !== null) return;
      held = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      el.classList.add('down');
      onDown();
    });
    function release(e) {
      if (held === null || (e && e.pointerId !== held)) return;
      held = null;
      el.classList.remove('down');
      if (onUp) onUp();
    }
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  CS.touch = {
    init: function () {
      zone = document.getElementById('stickZone');
      stick = document.getElementById('stick');
      nub = document.getElementById('nub');
      if (!zone) return;

      zone.addEventListener('pointerdown', function (e) {
        if (active !== null) return;
        e.preventDefault();
        active = e.pointerId;
        try { zone.setPointerCapture(e.pointerId); } catch (err) {}
        showStick(e.clientX, e.clientY);
        moveStick(e.clientX, e.clientY);
      });
      zone.addEventListener('pointermove', function (e) {
        if (e.pointerId !== active) return;
        e.preventDefault();
        moveStick(e.clientX, e.clientY);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (evt) {
        zone.addEventListener(evt, function (e) {
          if (e.pointerId !== active) return;
          endStick();
        });
      });

      bindButton(document.getElementById('tUse'), function () {
        CS.game.press('use');
        CS.platform.haptic('light');
      });
      // hold to glide, so jump behaves exactly like the space bar
      bindButton(document.getElementById('tJump'), function () {
        CS.game.setJumpHeld(true);
        CS.game.press('jump');
        CS.platform.haptic('light');
      }, function () {
        CS.game.setJumpHeld(false);
      });
      bindButton(document.getElementById('tDash'), function () {
        CS.game.press('dash');
        CS.platform.haptic('medium');
      });
      bindButton(document.getElementById('tPause'), function () { CS.game.press('pause'); });
    },

    /* Let go of everything when the game is paused or a screen opens. */
    release: function () {
      if (active !== null) endStick();
      CS.game.setJumpHeld(false);
    }
  };
})(window.CS);
