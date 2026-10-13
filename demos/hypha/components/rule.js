/* HYPHA — deux composants du design system (chantier B1, 2026-10-11) : la règle vivante (.hy-tl) et le compteur à rouleaux
   (.hy-odo). Leurs styles sont dans hypha.css. Ils servent au site (les neuf jours de la chambre, les 90 jours du sol) et à la
   planche du design system (atelier de Juniper, sur le site de Topiary).
   HyphaRule.timeline(el, { n, minor, cells, labels: [{ at, text }], seek(p), say(p) → { now, text }, nudge }) → { set(p) }
     el : <div class="hy-tl" role="slider" tabindex="0" aria-label="…" aria-valuemin aria-valuemax>
            <div class="hy-tl-run"><b class="hy-tl-fill"></b><span class="hy-tl-ghost"></span><span class="hy-tl-head"></span></div>
            <div class="hy-tl-nums" aria-hidden="true"></div></div>
   HyphaRule.odo(el, min, max) → set(valeur)        el : <span class="hy-odo"></span>
   HyphaRule.glide(set, calme) → to(p, d'un coup)   une position qui rejoint sa cible sur un ressort amorti (pour une règle que
     rien d'autre ne pilote) */
(function (root) {
  'use strict';
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // ---------- La règle vivante ----------
  // Une règle d'instrument : des graduations fines (les grandes aux jours), un filet que la souche remplit jusqu'à la tête, et la
  // tête, une pointe de mycélium (une aiguille claire, une perle de la souche sur le filet). Les graduations se lèvent et
  // s'éclairent au passage de la tête, comme une onde : tout est fonction de la position p (de 0 à 1), rien ne dépend du temps qui
  // passe, donc rien ne traîne ni ne saute. On la saisit : un appui ou un glissement mène à l'instant choisi, les flèches avancent
  // d'un pas ; elle est annoncée comme un curseur.
  // o : { n (pas), minor (graduations par pas), cells (les libellés nomment des intervalles, pas des points), labels [{ at, text }],
  //       seek(p), say(p) → { now, text }, nudge }
  function timeline(el, o) {
    var runEl = el.querySelector('.hy-tl-run'), fill = el.querySelector('.hy-tl-fill'), headEl = el.querySelector('.hy-tl-head'), nums = el.querySelector('.hy-tl-nums');
    var total = o.n * o.minor, T = [], L = [], p = -1, want = 0, W = 0, drag = false, said = '', i;
    for (i = 0; i <= total; i++) { var t = document.createElement('i'); if (i % o.minor === 0) t.className = 'is-major'; t.style.left = (i / total * 100).toFixed(4) + '%'; runEl.insertBefore(t, fill); T.push({ el: t, big: i % o.minor === 0, s: '', o: '' }); }
    o.labels.forEach(function (l) { var s = document.createElement('span'); s.textContent = l.text; s.style.left = (l.at * 100).toFixed(4) + '%'; nums.appendChild(s); L.push({ el: s, at: l.at, o: '', now: false }); });
    function set(v) {
      v = want = clamp(v, 0, 1);
      if (!W) W = runEl.clientWidth;
      if (Math.abs(v - p) < 2e-5 || !W) return;
      p = v;
      var x = v * total, j, d, b, s, op;
      fill.style.transform = 'scaleX(' + v.toFixed(5) + ')';
      headEl.style.transform = 'translate3d(' + (v * W).toFixed(2) + 'px,0,0)';
      for (j = 0; j <= total; j++) {
        d = j - x; b = Math.exp(-d * d / 5.5);
        s = (1 + (T[j].big ? 0.55 : 1.15) * b).toFixed(3); op = clamp(0.34 + 0.3 * clamp(0.5 - d, 0, 1) + 0.6 * b, 0, 1).toFixed(3);
        if (s !== T[j].s) { T[j].s = s; T[j].el.style.transform = 'scaleY(' + s + ')'; }
        if (op !== T[j].o) { T[j].o = op; T[j].el.style.opacity = op; }
      }
      L.forEach(function (l) {
        var dist = o.cells ? Math.max(0, Math.abs(v - l.at) * o.n - 0.5) : Math.abs(v - l.at) * o.n, now = dist < (o.cells ? 1e-6 : 0.06);
        var q = lerp(1, v > l.at ? 0.78 : 0.6, smooth(o.cells ? 0 : 0.06, 0.45, dist)).toFixed(3);
        if (q !== l.o) { l.o = q; l.el.style.opacity = q; }
        if (now !== l.now) { l.now = now; l.el.classList.toggle('is-now', now); }
      });
      var a = o.say(v);
      if (a.text !== said) { said = a.text; el.setAttribute('aria-valuenow', String(a.now)); el.setAttribute('aria-valuetext', a.text); }
    }
    function at(e) { var r = runEl.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1); }
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      drag = true; el.classList.add('is-drag');
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* pointeur déjà relâché */ }
      o.seek(at(e));
    });
    el.addEventListener('pointermove', function (e) { var f = at(e); el.style.setProperty('--hx', f.toFixed(4)); if (drag) o.seek(f); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { el.addEventListener(n, function () { drag = false; el.classList.remove('is-drag'); }); });
    el.addEventListener('keydown', function (e) {
      // Les flèches mènent au début du pas suivant, ou du pas en cours (du précédent si l'on vient à peine d'y entrer) ; nudge :
      // un rien après la frontière, pour que la position, une fois posée sur une image entière, soit bien dans le pas
      var k = e.key, cur = Math.max(0, p) * o.n, st = Math.floor(cur + 1e-4), to = null;
      if (k === 'ArrowRight' || k === 'ArrowUp') to = st + 1;
      else if (k === 'ArrowLeft' || k === 'ArrowDown') to = cur - st > 0.25 ? st : st - 1;
      else if (k === 'Home') to = 0; else if (k === 'End') to = o.n;
      if (to == null) return;
      e.preventDefault(); o.seek(to <= 0 ? 0 : to >= o.n ? 1 : to / o.n + (o.nudge || 0));
    });
    if (window.ResizeObserver) new ResizeObserver(function () { var w = runEl.clientWidth; if (w && w !== W) { W = w; p = -1; set(want); } }).observe(runEl);
    return { set: set };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---------- Le compteur à rouleaux ----------
  // Chaque chiffre est une bande qui défile derrière sa fenêtre. La bande des unités porte tous les nombres à la suite (0, 1, … 9,
  // 0, 1, …) : elle avance toujours dans le sens du temps, sans retour d'un 9 à un 0. Le mouvement est une transition (CSS) qui
  // repart de là où elle en est quand la valeur change en route : en défilant vite les chiffres filent, à l'arrêt ils se posent,
  // et le nombre est toujours entier au repos. La colonne des dizaines reste vide, et sans largeur, sous dix.
  function odo(el, min, max) {
    function strip(n, text) {
      var c = document.createElement('span'), s = document.createElement('span'); c.className = 'hy-odo-c';
      for (var i = 0; i < n; i++) { var g = document.createElement('i'); g.textContent = text(i); s.appendChild(g); }
      c.appendChild(s); return { c: c, s: s, n: n };
    }
    var tens = max > 9 ? strip(Math.floor(max / 10) + 1, function (i) { return i ? String(i) : ''; }) : null, ones = strip(max - min + 1, function (i) { return String((min + i) % 10); }), last = null;
    if (tens) { tens.c.classList.add('is-empty'); el.appendChild(tens.c); }
    el.appendChild(ones.c);
    return function (v) {
      v = clamp(Math.round(v), min, max); if (v === last) return; last = v;
      ones.s.style.transform = 'translate3d(0,' + (-(v - min) / ones.n * 100).toFixed(4) + '%,0)';
      if (tens) { var t = Math.floor(v / 10); tens.s.style.transform = 'translate3d(0,' + (-t / tens.n * 100).toFixed(4) + '%,0)'; tens.c.classList.toggle('is-empty', t === 0); }
    };
  }

  // Une position qui rejoint sa cible sur un ressort à amortissement critique (18 rad/s, sans dépassement) ; calme() vrai : d'un coup
  function glide(set, calme) {
    var x = 0, v = 0, goal = 0, raf = 0, last = 0;
    function tick(now) {
      raf = 0;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      var d = x - goal, e = Math.exp(-18 * dt), b = v + 18 * d;
      x = goal + (d + b * dt) * e; v = (v - 18 * b * dt) * e;
      if (Math.abs(x - goal) < 0.0004 && Math.abs(v) < 0.004) { x = goal; v = 0; }
      set(x);
      if (x !== goal) raf = requestAnimationFrame(tick); else last = 0;
    }
    return function (p, now) {
      goal = clamp(p, 0, 1);
      if (now || (calme && calme())) { x = goal; v = 0; set(x); return; }
      if (!raf) raf = requestAnimationFrame(tick);
    };
  }

  root.HyphaRule = { timeline: timeline, odo: odo, glide: glide };
})(window);
