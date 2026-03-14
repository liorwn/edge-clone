/**
 * Andale Optimizer Snippet
 * Add to any site: <script src="https://andale.sh/o.js?s=SITE_ID" async></script>
 * ~2KB minified, ES5-compatible, zero dependencies, never throws.
 */
(function (w, d) {
  'use strict';

  // ─── Config ─────────────────────────────────────────────────────────────────

  var BEACON_URL = 'https://andale.sh/api/beacon';
  var DEFER_TIMEOUT_MS = 15000;
  var ABOVE_FOLD_COUNT = 3;

  var VENDORS = {
    gtm: /googletagmanager\.com/,
    ga: /google-analytics\.com|gtag\/js/,
    fbPixel: /facebook\.com\/tr|fbevents\.js|connect\.facebook\.net/,
    hotjar: /hotjar\.com/,
    amplitude: /cdn\.amplitude\.com/,
    onetrust: /cdn\.cookielaw\.org/,
    hubspot: /hs-scripts\.com|hs-analytics\.net/,
    segment: /cdn\.segment\.com/,
    intercom: /widget\.intercom\.io/,
    drift: /js\.driftt\.com/,
    clarity: /clarity\.ms/,
    linkedin: /snap\.licdn\.com/,
    tiktok: /analytics\.tiktok\.com/,
  };

  var FONT_CDN_PRECONNECTS = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://use.typekit.net',
    'https://p.typekit.net',
  ];

  // ─── Utilities ───────────────────────────────────────────────────────────────

  /**
   * Extract siteId from current script tag's ?s= param.
   * Falls back to window._andale_site if pre-injected by snippet server.
   */
  function getSiteId() {
    if (w._andale_site) return w._andale_site;
    try {
      var scripts = d.querySelectorAll('script[src*="o.js"]');
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].getAttribute('src') || '';
        var match = src.match(/[?&]s=([^&]+)/);
        if (match) return match[1];
      }
    } catch (e) { /* silent */ }
    return 'unknown';
  }

  function idle(fn) {
    if (w.requestIdleCallback) {
      w.requestIdleCallback(fn);
    } else {
      setTimeout(fn, 0);
    }
  }

  function matchVendor(src) {
    for (var key in VENDORS) {
      if (VENDORS[key].test(src)) return key;
    }
    return null;
  }

  function sendBeacon(payload) {
    try {
      // Prefer navigator.sendBeacon for reliability on page unload
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(BEACON_URL, new Blob([body], { type: 'application/json' }));
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', BEACON_URL, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(body);
      }
    } catch (e) { /* silent — beacon failure must never affect page */ }
  }

  // ─── 1. Defer Tracking Scripts ───────────────────────────────────────────────

  var _deferred = [];
  var _scriptsFound = [];
  var _scriptsDeferred = [];
  var _deferFired = false;

  function fireDeferred() {
    if (_deferFired) return;
    _deferFired = true;

    for (var i = 0; i < _deferred.length; i++) {
      try {
        var el = _deferred[i];
        var realSrc = el.getAttribute('data-andale-src');
        if (!realSrc) continue;
        var s = d.createElement('script');
        // Copy any original attributes except the ones we mutated
        var attrs = el.attributes;
        for (var j = 0; j < attrs.length; j++) {
          var name = attrs[j].name;
          if (name === 'data-andale-src' || name === 'type') continue;
          s.setAttribute(name, attrs[j].value);
        }
        s.src = realSrc;
        s.async = true;
        d.head.appendChild(s);
      } catch (e) { /* silent */ }
    }
  }

  function setupDeferTriggers() {
    var events = ['click', 'touchstart', 'mousemove', 'keydown', 'scroll'];
    function onInteraction() {
      fireDeferred();
      for (var i = 0; i < events.length; i++) {
        d.removeEventListener(events[i], onInteraction, { passive: true });
      }
    }
    for (var i = 0; i < events.length; i++) {
      d.addEventListener(events[i], onInteraction, { passive: true });
    }
    // Fallback: fire after 15s regardless
    setTimeout(fireDeferred, DEFER_TIMEOUT_MS);
  }

  function deferTrackingScripts() {
    var scripts = d.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        var el = scripts[i];
        var src = el.getAttribute('src') || '';
        var vendor = matchVendor(src);
        if (!vendor) continue;

        _scriptsFound.push(vendor);

        // Already deferred by server-side andale — skip
        if (el.getAttribute('type') === 'text/andale-deferred' || el.getAttribute('data-andale-src')) {
          _scriptsDeferred.push(vendor);
          _deferred.push(el);
          continue;
        }

        // Defer this script client-side
        el.setAttribute('data-andale-src', src);
        el.setAttribute('type', 'text/andale-deferred');
        // Nullify the src to prevent browser from executing it
        el.removeAttribute('src');
        _scriptsDeferred.push(vendor);
        _deferred.push(el);
      } catch (e) { /* silent */ }
    }

    if (_deferred.length > 0) {
      setupDeferTriggers();
    }
  }

  // ─── 2. Lazy Load Images ─────────────────────────────────────────────────────

  function optimizeImages() {
    var images = d.querySelectorAll('img');
    var viewportHeight = w.innerHeight || 768;
    var aboveFoldCount = 0;

    for (var i = 0; i < images.length; i++) {
      try {
        var img = images[i];

        // Add async decoding to all images
        if (!img.getAttribute('decoding')) {
          img.setAttribute('decoding', 'async');
        }

        var rect = img.getBoundingClientRect();
        var isAboveFold = rect.top < viewportHeight;

        if (isAboveFold && aboveFoldCount < ABOVE_FOLD_COUNT) {
          // Hero/LCP images — eager load with high priority
          img.setAttribute('loading', 'eager');
          img.setAttribute('fetchpriority', 'high');
          aboveFoldCount++;
        } else if (!isAboveFold) {
          // Below fold — lazy load
          if (!img.getAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
          }
        }
      } catch (e) { /* silent */ }
    }
  }

  // ─── 3. Font Optimization ────────────────────────────────────────────────────

  function optimizeFonts() {
    // Inject preconnect hints for known font CDNs
    for (var i = 0; i < FONT_CDN_PRECONNECTS.length; i++) {
      try {
        var origin = FONT_CDN_PRECONNECTS[i];
        // Check if preconnect already exists
        if (d.querySelector('link[rel="preconnect"][href="' + origin + '"]')) continue;

        var link = d.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        if (origin.indexOf('gstatic') !== -1) {
          link.crossOrigin = 'anonymous';
        }
        d.head.insertBefore(link, d.head.firstChild);
      } catch (e) { /* silent */ }
    }

    // Apply font-display: swap to inline @font-face rules
    try {
      var sheets = d.styleSheets;
      for (var s = 0; s < sheets.length; s++) {
        try {
          // Only inline stylesheets — cross-origin stylesheets will throw SecurityError
          if (sheets[s].href) continue;
          var rules = sheets[s].cssRules || sheets[s].rules;
          if (!rules) continue;
          for (var r = 0; r < rules.length; r++) {
            var rule = rules[r];
            // CSSFontFaceRule type = 5
            if (rule.type === 5 && rule.style) {
              var display = rule.style.getPropertyValue('font-display');
              if (!display || display === 'auto' || display === 'block') {
                rule.style.setProperty('font-display', 'swap');
              }
            }
          }
        } catch (e) { /* cross-origin stylesheet — skip */ }
      }
    } catch (e) { /* silent */ }
  }

  // ─── 4. Performance Beacon ───────────────────────────────────────────────────

  function collectAndSendMetrics(siteId) {
    var metrics = {};

    // Collect via PerformanceObserver if available
    if (!w.PerformanceObserver) {
      sendBeacon({
        siteId: siteId,
        url: w.location.href,
        metrics: metrics,
        scriptsFound: _scriptsFound,
        scriptsDeferred: _scriptsDeferred,
      });
      return;
    }

    var pending = 2; // lcp + cls
    var done = false;

    function maybeSend() {
      pending--;
      if (pending <= 0 && !done) {
        done = true;
        sendBeacon({
          siteId: siteId,
          url: w.location.href,
          metrics: metrics,
          scriptsFound: _scriptsFound,
          scriptsDeferred: _scriptsDeferred,
        });
      }
    }

    // LCP
    try {
      var lcpObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        if (entries.length > 0) {
          metrics.lcp = Math.round(entries[entries.length - 1].startTime);
        }
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) { pending--; }

    // CLS
    try {
      var clsValue = 0;
      var clsObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].hadRecentInput) {
            clsValue += entries[i].value;
          }
        }
        metrics.cls = Math.round(clsValue * 1000) / 1000;
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
    } catch (e) { pending--; }

    // FCP from paint entries
    try {
      var navEntry = performance.getEntriesByType('navigation')[0];
      var paintEntries = performance.getEntriesByType('paint');
      for (var p = 0; p < paintEntries.length; p++) {
        if (paintEntries[p].name === 'first-contentful-paint') {
          metrics.fcp = Math.round(paintEntries[p].startTime);
        }
      }
      // TBT estimate: sum of long task durations > 50ms (blocking time)
      if (navEntry) {
        metrics.ttfb = Math.round(navEntry.responseStart - navEntry.requestStart);
      }
    } catch (e) { /* silent */ }

    // Long Tasks for TBT estimate
    try {
      var tbt = 0;
      var ltObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          var blockingTime = entries[i].duration - 50;
          if (blockingTime > 0) tbt += blockingTime;
        }
        metrics.tbt = Math.round(tbt);
      });
      ltObs.observe({ type: 'longtask', buffered: true });
    } catch (e) { /* silent */ }

    // Send after page is fully loaded (give observers time to fire)
    setTimeout(maybeSend, 0);
    // Safety: always send within 5s
    setTimeout(function () {
      if (!done) {
        done = true;
        sendBeacon({
          siteId: siteId,
          url: w.location.href,
          metrics: metrics,
          scriptsFound: _scriptsFound,
          scriptsDeferred: _scriptsDeferred,
        });
      }
    }, 5000);
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────────

  function run() {
    try {
      var siteId = getSiteId();

      // Run optimizations synchronously (fast, DOM manipulation only)
      deferTrackingScripts();
      optimizeImages();
      optimizeFonts();

      // Beacon is non-critical — defer to idle
      idle(function () {
        if (d.readyState === 'complete') {
          collectAndSendMetrics(siteId);
        } else {
          w.addEventListener('load', function () {
            collectAndSendMetrics(siteId);
          });
        }
      });
    } catch (e) { /* never let the snippet break the page */ }
  }

  // Respect DOMContentLoaded
  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', run);
  } else {
    // DOM already ready (script loaded late / async)
    run();
  }

})(window, document);
