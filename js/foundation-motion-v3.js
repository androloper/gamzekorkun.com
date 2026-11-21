/*!
 * Canvas Foundation Motion v3 · CanvasBuilder
 * Subtle, premium motion wired from markup, for pages built on the Canvas
 * Foundation stylesheet. Load once, after the Canvas bundles:
 *   <script src="https://assets.cnvs.site/js/foundation-motion-v3.js" defer></script>
 *
 * Attributes (data-fx="…"):
 *   reveal    fade + rise as the element enters the viewport
 *   stagger   children reveal one after another (put on the parent)
 *   split     headline words rise in, once (hero headings)
 *   clip      media wipes open from the bottom edge
 *   parallax  media drifts slightly with scroll (data-fx-amount, default 8)
 *   count     a figure counts up from zero when seen ("1,240", "98%", "£3.2m")
 *   magnetic  a button leans toward the pointer (desktop only)
 *   webgl     a quiet Three.js background (data-fx-scene="field|waves|grid")
 * Blocks with behaviour (class hooks, see the block snippets):
 *   .fnd-pan (pinned horizontal gallery), .fnd-stack (stacking cards),
 *   .fnd-story (sticky media story), .fnd-hoverlist (cursor image preview),
 *   .fnd-marquee (duplicates its track for a seamless loop).
 *
 * Contract: content is complete and visible without this file, under
 * prefers-reduced-motion, and in automated browsers (navigator.webdriver),
 * where nothing is ever hidden. Only transform/opacity/clip-path animate.
 * v2: when still, a WebGL hero draws ONE frame (no loop, no pointer), so
 * reduced-motion visitors and screenshots see the designed hero.
 * v3: a clip reveal watches its parent. Chrome never reports an element
 * fully hidden by its own clip-path as intersecting, so v1/v2 left every
 * data-fx="clip" photo hidden.
 * Never throws.
 */
(function () {
  "use strict";
  var w = window, d = document;
  if (w.__fndMotion) return;
  w.__fndMotion = true;

  var reduce = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var automated = !!(navigator && navigator.webdriver);
  var finePointer = w.matchMedia && w.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var STILL = reduce || automated;

  var GSAP = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
  var ST = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js";
  var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";

  function $all(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function safe(fn) { try { fn(); } catch (e) { /* motion must never break a page */ } }

  var loading = {};
  function load(src) {
    if (loading[src]) return loading[src];
    loading[src] = new Promise(function (ok, fail) {
      var s = d.createElement("script");
      s.src = src; s.async = true;
      s.onload = function () { ok(); }; s.onerror = function () { fail(); };
      d.head.appendChild(s);
    });
    return loading[src];
  }
  function gsapReady() {
    if (w.gsap && w.ScrollTrigger) return Promise.resolve();
    return load(GSAP).then(function () { return load(ST); }).then(function () { w.gsap.registerPlugin(w.ScrollTrigger); });
  }

  function belowFold(el) { return el.getBoundingClientRect().top > w.innerHeight * 0.92; }

  // ---- reveal / stagger / clip (no library) ----
  function armReveals() {
    var targets = new Map();  // watched element -> elements it reveals
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        (targets.get(e.target) || []).forEach(function (t) { t.classList.add("fx-in"); });
        targets.delete(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    $all('[data-fx="reveal"], [data-fx="clip"]').forEach(function (el) {
      if (!belowFold(el)) return;
      el.classList.add("fx-armed");
      var watch = el.getAttribute("data-fx") === "clip" && el.parentElement ? el.parentElement : el;
      targets.set(watch, (targets.get(watch) || []).concat(el));
      io.observe(watch);
    });
    $all('[data-fx="stagger"]').forEach(function (parent) {
      if (!belowFold(parent)) return;
      Array.prototype.forEach.call(parent.children, function (c, i) {
        c.classList.add("fx-armed");
        c.style.setProperty("--fx-delay", Math.min(i, 8) * 80 + "ms");
      });
      var po = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          Array.prototype.forEach.call(e.target.children, function (c) { c.classList.add("fx-in"); });
          po.unobserve(e.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
      po.observe(parent);
    });
  }

  // ---- split headline (words rise once) ----
  function splitHeadlines() {
    $all('[data-fx="split"]').forEach(function (el) {
      if (el.dataset.fxDone) return;
      el.dataset.fxDone = "1";
      var text = el.textContent;
      if (!text || el.children.length > 2) return; // keep rich headings intact
      el.setAttribute("aria-label", text.replace(/\s+/g, " ").trim());
      var frag = d.createDocumentFragment();
      var i = 0;
      Array.prototype.slice.call(el.childNodes).forEach(function (node) {
        var isEm = node.nodeType === 1;
        var words = (node.textContent || "").split(/(\s+)/);
        words.forEach(function (word) {
          if (!word) return;
          if (/^\s+$/.test(word)) { frag.appendChild(d.createTextNode(" ")); return; }
          var outer = d.createElement("span");
          // "nocolor": Canvas tints every span directly inside a heading with
          // the accent colour unless it carries this class.
          outer.className = "fx-word nocolor";
          outer.setAttribute("aria-hidden", "true");
          var inner = d.createElement(isEm ? node.tagName.toLowerCase() : "span");
          inner.className = "fx-word-in";
          inner.textContent = word;
          inner.style.setProperty("--fx-delay", Math.min(i++, 14) * 55 + "ms");
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
      });
      el.textContent = "";
      el.appendChild(frag);
      el.classList.add("fx-split");
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("fx-in"); }); });
    });
  }

  // ---- count up ----
  function counters() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target, raw = el.textContent;
        var m = raw.match(/-?[\d.,]*\d/);
        if (!m) return;
        var numStr = m[0], decimals = (numStr.split(".")[1] || "").length;
        var target = parseFloat(numStr.replace(/,/g, ""));
        if (!isFinite(target)) return;
        var pre = raw.slice(0, m.index), post = raw.slice(m.index + numStr.length);
        var useComma = numStr.indexOf(",") !== -1, t0 = null, dur = 1400;
        function fmt(v) {
          var s = v.toFixed(decimals);
          if (useComma) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          return pre + s + post;
        }
        function step(ts) {
          if (!t0) t0 = ts;
          var p = Math.min(1, (ts - t0) / dur), eased = 1 - Math.pow(1 - p, 4);
          el.textContent = fmt(target * eased);
          if (p < 1) requestAnimationFrame(step); else el.textContent = raw;
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    $all('[data-fx="count"]').forEach(function (el) { if (belowFold(el)) io.observe(el); });
  }

  // ---- magnetic buttons ----
  function magnetic() {
    if (!finePointer) return;
    $all('[data-fx="magnetic"]').forEach(function (el) {
      el.classList.add("fx-magnetic");
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
        el.style.transform = "translate(" + (x * 8).toFixed(2) + "px," + (y * 6).toFixed(2) + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  // ---- marquee (seamless loop) ----
  function marquees() {
    $all(".fnd-marquee-track").forEach(function (track) {
      if (track.dataset.fxDone) return;
      track.dataset.fxDone = "1";
      var copy = track.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      copy.classList.add("fnd-marquee-copy");
      track.parentNode.appendChild(copy);
      track.parentNode.classList.add("fx-running");
    });
  }

  // ---- hover list (cursor image preview) ----
  function hoverLists() {
    if (!finePointer) return;
    $all(".fnd-hoverlist").forEach(function (list) {
      var preview = d.createElement("div");
      preview.className = "fnd-hoverlist-preview";
      preview.setAttribute("aria-hidden", "true");
      var img = d.createElement("img");
      img.alt = "";
      preview.appendChild(img);
      list.appendChild(preview);
      var x = 0, y = 0, tx = 0, ty = 0, raf = 0, on = false;
      function tick() {
        x += (tx - x) * 0.18; y += (ty - y) * 0.18;
        preview.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
        raf = on ? requestAnimationFrame(tick) : 0;
      }
      $all(".fnd-hoverlist-item", list).forEach(function (item) {
        var src = item.getAttribute("data-fx-img");
        if (!src) return;
        new Image().src = src;
        item.addEventListener("pointerenter", function () {
          img.src = src; preview.classList.add("is-on"); on = true;
          if (!raf) raf = requestAnimationFrame(tick);
        });
        item.addEventListener("pointerleave", function () { preview.classList.remove("is-on"); on = false; });
      });
      list.addEventListener("pointermove", function (e) {
        var r = list.getBoundingClientRect();
        tx = e.clientX - r.left + 24; ty = e.clientY - r.top - 120;
      });
    });
  }

  // ---- sticky story (swap the sticky media per chapter) ----
  function stories() {
    $all(".fnd-story").forEach(function (story) {
      var media = $all(".fnd-story-media .fnd-story-frame", story);
      var steps = $all(".fnd-story-step", story);
      if (media.length < 2 || !steps.length) return;
      media[0].classList.add("is-active");
      steps[0].classList.add("is-active");
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var i = steps.indexOf(e.target);
          media.forEach(function (m, j) { m.classList.toggle("is-active", j === Math.min(i, media.length - 1)); });
          steps.forEach(function (s, j) { s.classList.toggle("is-active", j === i); });
        });
      }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
      steps.forEach(function (s) { io.observe(s); });
    });
  }

  // ---- GSAP-driven: parallax, pinned pan gallery, stacking cards ----
  function gsapEffects() {
    var needs = d.querySelector('[data-fx="parallax"], .fnd-pan, .fnd-stack');
    if (!needs) return;
    gsapReady().then(function () {
      var gsap = w.gsap, ST = w.ScrollTrigger, mm = gsap.matchMedia();
      $all('[data-fx="parallax"]').forEach(function (el) {
        var amt = parseFloat(el.getAttribute("data-fx-amount") || "8");
        var target = el.querySelector("img") || el;
        target.classList.add("fx-parallax");
        gsap.fromTo(target, { yPercent: -amt / 2 }, { yPercent: amt / 2, ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 } });
      });
      mm.add("(min-width: 992px)", function () {
        $all(".fnd-pan").forEach(function (wrap) {
          var track = wrap.querySelector(".fnd-pan-track");
          if (!track) return;
          wrap.classList.add("fx-pinned");
          var dist = function () { return Math.max(0, track.scrollWidth - wrap.clientWidth); };
          gsap.to(track, { x: function () { return -dist(); }, ease: "none",
            scrollTrigger: { trigger: wrap, start: "top top", end: function () { return "+=" + dist(); },
              pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 } });
          return function () { wrap.classList.remove("fx-pinned"); };
        });
        $all(".fnd-stack").forEach(function (stack) {
          var cards = $all(".fnd-stack-card", stack);
          cards.forEach(function (card, i) {
            if (i === cards.length - 1) return;
            gsap.to(card, { scale: 0.94, opacity: 0.6, ease: "none",
              scrollTrigger: { trigger: cards[i + 1], start: "top bottom", end: "top 20%", scrub: true } });
          });
        });
      });
      w.addEventListener("load", function () { ST.refresh(); });
    }).catch(function () { /* CDN blocked: the static layout stands */ });
  }

  // ---- Three.js background (one per page) ----
  // Seeded random: every render of a page draws the same field.
  function seeded(n) { return function () { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646; }; }

  function webgl(still) {
    var host = d.querySelector('[data-fx="webgl"]');
    if (!host) return;
    var probe = d.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;
    load(THREE_URL).then(function () {
      var T = w.THREE;
      if (!T) return;
      var canvas = d.createElement("canvas");
      canvas.className = "fnd-webgl";
      canvas.setAttribute("aria-hidden", "true");
      if (still) canvas.style.transition = "none";
      host.insertBefore(canvas, host.firstChild);
      var renderer;
      try { renderer = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: "low-power" }); } catch (e) { canvas.remove(); return; }
      renderer.setPixelRatio(Math.min(w.devicePixelRatio || 1, 1.75));
      var scene = new T.Scene(), camera = new T.PerspectiveCamera(55, 1, 0.1, 100);
      var accent = getComputedStyle(d.documentElement).getPropertyValue("--cnvs-themecolor").trim() || "#7aa2ff";
      var color = new T.Color(accent);
      var kind = host.getAttribute("data-fx-scene") || "field";
      var geo, mat, obj, base;
      if (kind === "waves" || kind === "grid") {
        var seg = kind === "grid" ? 48 : 70;
        geo = new T.PlaneGeometry(22, 12, seg, Math.round(seg * 0.55));
        base = geo.attributes.position.array.slice();
        mat = kind === "grid"
          ? new T.MeshBasicMaterial({ color: color, wireframe: true, transparent: true, opacity: 0.22 })
          : new T.PointsMaterial({ color: color, size: 0.045, transparent: true, opacity: 0.75 });
        obj = kind === "grid" ? new T.Mesh(geo, mat) : new T.Points(geo, mat);
        obj.rotation.x = -1.05;
        obj.position.y = -1.4;
        camera.position.set(0, 1.2, 7);
      } else {
        var N = 1400, pos = new Float32Array(N * 3), rnd = seeded(20261011);
        for (var i = 0; i < N * 3; i++) pos[i] = (rnd() - 0.5) * 14;
        geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.BufferAttribute(pos, 3));
        mat = new T.PointsMaterial({ color: color, size: 0.04, transparent: true, opacity: 0.6 });
        obj = new T.Points(geo, mat);
        camera.position.z = 7;
      }
      scene.add(obj);
      function size() {
        var cw = host.clientWidth, ch = host.clientHeight;
        renderer.setSize(cw, ch, false);
        camera.aspect = cw / Math.max(1, ch); camera.updateProjectionMatrix();
      }
      size(); w.addEventListener("resize", size);
      if (still) {
        // One frame, posed as the loop would pose it a few seconds in.
        if (base) {
          var sp = geo.attributes.position.array;
          for (var q = 0; q < sp.length; q += 3) sp[q + 2] = Math.sin(base[q] * 0.55 + 0.6) * 0.35 + Math.cos(base[q + 1] * 0.7 + 0.5) * 0.25;
          geo.attributes.position.needsUpdate = true;
        } else {
          obj.rotation.y = 0.35;
        }
        renderer.render(scene, camera);
        w.addEventListener("resize", function () { renderer.render(scene, camera); });
        host.classList.add("fx-webgl-on");
        return;
      }
      var mx = 0, my = 0;
      host.addEventListener("pointermove", function (e) {
        var r = host.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5;
      });
      var visible = true, raf = 0, t = 0;
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf) loop(); }).observe(host);
      d.addEventListener("visibilitychange", function () { if (!d.hidden && visible && !raf) loop(); });
      function loop() {
        if (!visible || d.hidden) { raf = 0; return; }
        t += 0.006;
        if (base) {
          var p = geo.attributes.position.array;
          for (var k = 0; k < p.length; k += 3) {
            var x = base[k], y = base[k + 1];
            p[k + 2] = Math.sin(x * 0.55 + t * 2) * 0.35 + Math.cos(y * 0.7 + t * 1.6) * 0.25;
          }
          geo.attributes.position.needsUpdate = true;
          obj.rotation.z = mx * 0.08;
        } else {
          obj.rotation.y = t * 0.3 + mx * 0.25;
          obj.rotation.x = my * 0.15;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      }
      host.classList.add("fx-webgl-on");
      loop();
    }).catch(function () { /* no Three.js: static hero */ });
  }

  function init() {
    d.documentElement.classList.add("fx-ready");
    safe(marquees);           // seamless loop works even when still (CSS pauses it)
    if (STILL) {              // reduced motion / automated browser: nothing moves or hides
      safe(function () { webgl(true); });
      return;
    }
    d.documentElement.classList.add("fx-motion");
    safe(splitHeadlines);
    safe(armReveals);
    safe(counters);
    safe(magnetic);
    safe(hoverLists);
    safe(stories);
    safe(gsapEffects);
    safe(function () { webgl(false); });
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init); else init();
})();
