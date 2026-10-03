/* Platform glue: touch/mobile detection, viewport sizing that survives mobile
   browser chrome, and optional Telegram Mini App integration.

   Nothing here is required for the game to run — if the Telegram SDK is absent
   (or we were opened straight off the filesystem) everything falls back to
   plain browser behaviour. */
window.CS = window.CS || {};
(function (CS) {
  'use strict';

  var listeners = [];

  var P = CS.platform = {
    touch: false,
    mobile: false,     // small screen: use the compact HUD
    coarse: false,     // touch-first input: show the on-screen controls
    tg: null,          // Telegram.WebApp once (and if) it loads
    standalone: false,
    fullscreen: false, // true while Telegram is running us edge-to-edge

    /* The canvas is sized from #app rather than window.innerHeight, because on
       mobile (and inside Telegram) the visual viewport moves around as browser
       chrome and the Telegram header collapse. #app is a fixed, inset:0 box, so
       the layout engine keeps it honest for us. */
    size: function () {
      var host = document.getElementById('app');
      var de = document.documentElement;
      var w = (host && host.clientWidth) || (de && de.clientWidth) || window.innerWidth;
      var h = (host && host.clientHeight) || (de && de.clientHeight) || window.innerHeight;
      return { w: Math.max(1, w), h: Math.max(1, h) };
    },

    /* True once the viewport has real numbers. A Telegram mini app (and a
       backgrounded tab) can report 0x0 for the first few frames. */
    ready: function () {
      var s = P.size();
      return s.w > 1 && s.h > 1;
    },

    onResize: function (fn) { listeners.push(fn); },
    emitResize: function () {
      for (var i = 0; i < listeners.length; i++) listeners[i]();
    },

    haptic: function (style) {
      if (!P.tg || !P.tg.HapticFeedback) return;
      try {
        if (style === 'success' || style === 'error' || style === 'warning') {
          P.tg.HapticFeedback.notificationOccurred(style);
        } else {
          P.tg.HapticFeedback.impactOccurred(style || 'light');
        }
      } catch (e) { /* older Telegram clients */ }
    },

    /* Fullscreen hides Telegram's header but floats the close/menu buttons over
       our canvas, so the HUD has to be pushed clear of them. Telegram reports
       that as two stacked insets: safeAreaInset is the device's own notch and
       home indicator, contentSafeAreaInset is Telegram's chrome inside it.
       We widen the --sa* vars that index.html pads the HUD with, keeping
       whatever the device's env() already claims. */
    applySafeArea: function () {
      var tg = P.tg;
      if (!tg) return;
      var dev = tg.safeAreaInset || {};
      var app = tg.contentSafeAreaInset || {};
      var sides = { sat: 'top', sar: 'right', sab: 'bottom', sal: 'left' };
      for (var k in sides) {
        var side = sides[k];
        var px = (dev[side] || 0) + (app[side] || 0);
        document.documentElement.style.setProperty(
          '--' + k, 'max(env(safe-area-inset-' + side + '), ' + px + 'px)');
      }
    },

    init: function () {
      P.touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
      P.coarse = P.touch && window.matchMedia('(pointer: coarse)').matches;
      // a touch laptop keeps the desktop HUD; phones and small tablets don't
      var minSide = Math.min(window.innerWidth, window.innerHeight);
      P.mobile = P.touch && minSide < 620;
      // let testing force either mode: ?ui=mobile / ?ui=desktop
      var q = (location.search || '');
      if (q.indexOf('ui=mobile') >= 0) { P.mobile = true; P.coarse = true; P.touch = true; }
      if (q.indexOf('ui=desktop') >= 0) { P.mobile = false; P.coarse = false; }

      var b = document.body;
      if (P.touch) b.classList.add('touch');
      if (P.coarse) b.classList.add('coarse');
      if (P.mobile) b.classList.add('mobile');

      // keep the layout glued to the real viewport
      var fire = function () {
        var minS = Math.min(window.innerWidth, window.innerHeight);
        var wantMobile = P.touch && minS < 620;
        if (q.indexOf('ui=') < 0 && wantMobile !== P.mobile) {
          P.mobile = wantMobile;
          b.classList.toggle('mobile', wantMobile);
        }
        P.emitResize();
      };
      window.addEventListener('resize', fire);
      window.addEventListener('orientationchange', function () { setTimeout(fire, 250); });
      window.addEventListener('pageshow', fire);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) setTimeout(fire, 50);
      });
      if (window.visualViewport) window.visualViewport.addEventListener('resize', fire);

      // stop the page itself from scrolling, zooming or long-press-selecting
      document.addEventListener('contextmenu', function (e) {
        if (e.target && e.target.closest && e.target.closest('#screen')) return;
        e.preventDefault();
      });
      document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
      document.addEventListener('dblclick', function (e) { e.preventDefault(); });

      P.initTelegram(fire);
    },

    /* Load the Telegram SDK only when we could plausibly be inside Telegram.
       Opened from the filesystem we never touch the network at all. */
    initTelegram: function (onReady) {
      if (location.protocol === 'file:') return;
      var s = document.createElement('script');
      s.src = 'https://telegram.org/js/telegram-web-app.js';
      s.async = true;
      s.onerror = function () { /* offline or blocked: plain web game */ };
      s.onload = function () {
        var tg = window.Telegram && window.Telegram.WebApp;
        if (!tg || !tg.platform || tg.platform === 'unknown') return;
        P.tg = tg;
        document.body.classList.add('tg');
        try { tg.ready(); } catch (e) {}
        try { tg.expand(); } catch (e) {}
        try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) {}
        try { tg.setHeaderColor && tg.setHeaderColor('#1a1009'); } catch (e) {}
        try { tg.setBackgroundColor && tg.setBackgroundColor('#1a1009'); } catch (e) {}
        try { tg.onEvent('viewportChanged', onReady); } catch (e) {}

        /* Go edge-to-edge. requestFullscreen is Bot API 8.0 and phone-only —
           desktop and web clients answer with fullscreenFailed, where the
           expand() above is already the right answer. The insets move whenever
           the mode changes or the phone rotates, so track them too. */
        var syncFullscreen = function () {
          P.fullscreen = !!tg.isFullscreen;
          document.body.classList.toggle('tg-fullscreen', P.fullscreen);
          P.applySafeArea();
          onReady();
        };
        try { tg.onEvent('fullscreenChanged', syncFullscreen); } catch (e) {}
        try { tg.onEvent('fullscreenFailed', syncFullscreen); } catch (e) {}
        try { tg.onEvent('safeAreaChanged', syncFullscreen); } catch (e) {}
        try { tg.onEvent('contentSafeAreaChanged', syncFullscreen); } catch (e) {}
        P.applySafeArea();

        // Telegram clients are always touch, even on desktop tablets
        var phone = tg.platform === 'android' || tg.platform === 'ios';
        if (phone) {
          document.body.classList.add('touch', 'coarse');
          P.touch = true; P.coarse = true;
        }

        var canFullscreen = phone && tg.requestFullscreen &&
          tg.isVersionAtLeast && tg.isVersionAtLeast('8.0');
        if (canFullscreen && location.search.indexOf('tgfs=0') < 0) {
          try { tg.requestFullscreen(); } catch (e) {}
        }
        onReady();
      };
      document.head.appendChild(s);
    }
  };
})(window.CS);
