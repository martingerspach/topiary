/* HYPHA — le site, v12 (chantier B1, 2026-10-11). Marque fictive, un Original de Topiary.
   Ce script pilote : la barre (elle prend le fond de la section survolée) ; la chambre (la suite d'images que le défilement fait
   avancer sur un ressort, fondue d'une image à l'autre, posée sur une image nette à l'arrêt ; sa règle des neuf jours, que l'on
   saisit ; son aperçu d'ouverture, sa poussière, son reflet final) ; l'affiche du drop (son arrivée, la loupe) et son
   étiquette (démonstration : rien n'est envoyé) ; l'empreinte et la marque de chaque paire, que l'on parcourt à la règle ; la coupe
   du sol (soil.js), que le défilement fait passer en 90 jours, et sa règle ; le pied de page (../brand/mark.js,
   ../landing/network.js).
   En animations réduites (.is-calm), tout s'affiche fini et rien ne joue : les deux règles restent jouables, et mènent d'un coup
   au jour choisi. */
(function () {
  'use strict';
  var html = document.documentElement, Q = new URLSearchParams(location.search), calm = html.classList.contains('is-calm');
  // ?mini=1 : la page se sait montrée réduite (l'atelier de Clover, sur le site de Topiary) : elle dessine à la définition où on la
  // voit, et part de la toute première image (pas d'aperçu à l'ouverture, pas de poussière)
  var mini = Q.has('mini');
  var STRAINS = {
    pink: { drop: '004', name: 'Pink Oyster', latin: 'Pleurotus djamor', next: 'Golden Oyster' },
    gold: { drop: '005', name: 'Golden Oyster', latin: 'Pleurotus citrinopileatus', next: 'Blue Oyster' },
    blue: { drop: '006', name: 'Blue Oyster', latin: 'Pleurotus columbinus', next: 'Pink Oyster' }
  };
  // Le drop : 500 paires par souche ; les paires sont numérotées dans l'ordre des réservations
  var TOTAL = 500, taken = 412, grown = taken;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function prng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function role(el, name, d) { var v = getComputedStyle(el).getPropertyValue('--hy-color-' + name).trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : d; }
  function pad4(n) { return String(n).padStart(4, '0'); }
  function idle(f, ms) { (window.requestIdleCallback || function (g) { return setTimeout(g, 300); })(f, { timeout: ms || 3000 }); }
  function ticksIn(el, n) { var out = []; for (var d = 0; d <= n; d++) { var t = document.createElement('i'); t.style.left = (d / n * 100) + '%'; el.appendChild(t); out.push(t); } return out; }
  // Une animation portée par le temps, interrompue en posant on à false
  function run(dur, step, done) {
    var t0 = performance.now(), id = { on: true };
    (function f(now) { if (!id.on) return; var q = clamp((now - t0) / dur, 0, 1); step(q); if (q < 1) requestAnimationFrame(f); else { id.on = false; if (done) done(); } })(performance.now());
    return id;
  }
  // Une courbe monotone par des points (Fritsch-Carlson) : aucune valeur ne recule, départ et arrivée en douceur
  function monotone(X, Y) {
    var n = X.length, s = [], M = [], k;
    for (k = 0; k < n - 1; k++) s.push((Y[k + 1] - Y[k]) / (X[k + 1] - X[k]));
    M[0] = 0; M[n - 1] = 0;
    for (k = 1; k < n - 1; k++) { var h0 = X[k] - X[k - 1], h1 = X[k + 1] - X[k]; M[k] = s[k - 1] * s[k] <= 0 ? 0 : 3 * (h0 + h1) / ((2 * h1 + h0) / s[k - 1] + (h1 + 2 * h0) / s[k]); }
    return function (q) {
      var i = 0; while (i < n - 2 && q >= X[i + 1]) i++;
      var h = X[i + 1] - X[i], u = clamp((q - X[i]) / h, 0, 1), u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * Y[i] + (u3 - 2 * u2 + u) * h * M[i] + (-2 * u3 + 3 * u2) * Y[i + 1] + (u3 - u2) * h * M[i + 1];
    };
  }

  if (Q.get('seul')) $$('main > section').forEach(function (s) { s.classList.toggle('is-seul', s.id === Q.get('seul')); });

  // ---------- Souche courante : le drop affiché suit la souche ----------
  function currentStrain() { return Object.keys(STRAINS).filter(function (s) { return html.classList.contains('hy-strain-' + s); })[0] || 'pink'; }
  function applyStrain() {
    var st = currentStrain(), d = STRAINS[st];
    $$('[data-strain-drop]').forEach(function (e) { e.textContent = d.drop; });
    $$('[data-strain-name]').forEach(function (e) { e.textContent = d.name; });
    $$('[data-strain-latin]').forEach(function (e) { e.textContent = d.latin; });
    $$('[data-strain-next]').forEach(function (e) { e.textContent = d.next; });
    $$('[data-strain-scope]').forEach(function (e) { Object.keys(STRAINS).forEach(function (s) { e.classList.toggle('hy-strain-' + s, s === st); }); });
  }
  applyStrain();

  // ---------- La barre : le fond de la section qu'elle survole ; l'ancre de la section lue ----------
  var head = $('#head'), grounds = [['#top', 'chamber'], ['#drop', 'strain'], ['#pairs', 'chamber'], ['#yours', 'daylight'], ['#return', 'chamber'], ['#foot', 'chamber']]
    .map(function (g) { return { el: $(g[0]), ground: g[1] }; }), links = $$('.hs-nav a'), lastGround = '', lastCur = '';
  function ground() {
    var mid = head.offsetHeight / 2, read = window.innerHeight * 0.4, g = grounds[0], cur = '';
    grounds.forEach(function (s) { var t = s.el.getBoundingClientRect().top; if (t <= mid) g = s; if (t <= read) cur = s.el.id; });
    var key = g.ground + currentStrain();
    if (key !== lastGround) {
      lastGround = key;
      head.className = 'hs-head ' + (g.ground === 'strain' ? 'hy-on-strain' : (g.ground === 'daylight' ? 'hy-theme-daylight' : 'hy-theme-chamber') + ' hy-strain-' + currentStrain());
    }
    if (cur !== lastCur) { lastCur = cur; links.forEach(function (a) { if (a.getAttribute('href') === '#' + cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }
  }
  var gRaf = 0;
  function groundSoon() { if (!gRaf) gRaf = requestAnimationFrame(function () { gRaf = 0; ground(); }); }
  window.addEventListener('scroll', groundSoon, { passive: true });
  window.addEventListener('resize', groundSoon);
  ground();

  // Le bouton : la souche le gagne depuis le point où le pointeur entre (le centre au clavier)
  document.addEventListener('pointerover', function (e) {
    var b = e.target.closest && e.target.closest('.hs-btn'); if (!b || (e.relatedTarget && b.contains(e.relatedTarget))) return;
    var r = b.getBoundingClientRect();
    b.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    b.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  }, { passive: true });

  // ---------- Une scène tenue : le défilement donne une cible, la scène la suit ----------
  // Une scène « tenue » reste à l'écran pendant que le défilement natif la fait avancer (k de 0 à 1). La cible vient de la position
  // de défilement, lue sans mise en page (les repères sont mesurés à part, quand la page change de taille). k la suit sur un ressort
  // à amortissement critique : sa vitesse est continue au départ comme à l'arrivée, et bornée, si bien qu'un saut (un appui sur la
  // règle) se voit comme une avance rapide, pas comme une coupe.
  // o : { el, pin, tail (hauteurs d'écran tenues après la fin), map(brut) → k, unmap(k) → brut, snap(k) → k (au repos),
  //       draw(k, vitesse), rest() (une fois posée), busy() (il reste quelque chose à animer) }
  function Scrub(o) {
    var x = 0, v = 0, raf = 0, last = 0, moved = 0, top = 0, span = 1, W0 = 18, VMAX = 1.15, rested = false;
    function measure() {
      var r = o.el.getBoundingClientRect(); if (!r.height) return;
      top = r.top + window.scrollY - head.offsetHeight; span = Math.max(1, r.height - (o.tail || 1) * o.pin.offsetHeight);
    }
    function tick(now) {
      raf = 0;
      var idleNow = now - moved > 140, goal = o.map(clamp((window.scrollY - top) / span, 0, 1));
      if (idleNow && o.snap) goal = o.snap(goal);
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      var d = x - goal, e = Math.exp(-W0 * dt), b = v + W0 * d, nx = goal + (d + b * dt) * e, lim = VMAX * dt;
      v = (v - W0 * b * dt) * e;
      if (Math.abs(nx - x) > lim) { v = nx > x ? VMAX : -VMAX; nx = x + (nx > x ? lim : -lim); }
      x = nx;
      var still = Math.abs(x - goal) < 0.0003 && Math.abs(v) < 0.003;
      if (still) { x = goal; v = 0; }
      o.draw(x, v);
      if (still && idleNow) { if (!rested) { rested = true; if (o.rest) o.rest(); } } else rested = false;
      if (!still || !idleNow || (o.busy && o.busy())) raf = requestAnimationFrame(tick); else last = 0;
    }
    function poke() { if (!raf) raf = requestAnimationFrame(tick); }
    function kick() { moved = performance.now(); poke(); }
    measure();
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', function () { measure(); kick(); });
    // La page change de hauteur (une question s'ouvre, les polices arrivent) : les repères sont repris
    if (window.ResizeObserver) new ResizeObserver(function () { measure(); poke(); }).observe(document.body);
    return { kick: kick, poke: poke, measure: measure, k: function () { return x; },
      seek: function (k) { window.scrollTo({ top: top + o.unmap(clamp(k, 0, 1)) * span, behavior: 'instant' }); kick(); } };
  }
  // L'antécédent d'une valeur par une fonction croissante sur [0, 1] (dichotomie)
  function invert(f, y) { var a = 0, b = 1; for (var i = 0; i < 28; i++) { var m = (a + b) / 2; if (f(m) < y) a = m; else b = m; } return (a + b) / 2; }

  // La règle vivante et le compteur à rouleaux : deux composants du design system (../components/rule.js, styles dans hypha.css)
  var Timeline = HyphaRule.timeline, Odo = HyphaRule.odo;

  // ---------- La marque (brand/mark.js) : son canvas, piloté ici (k de 0 à 1, linéaire dans le temps) ----------
  function Mark(cv, seed) {
    var st = { k: calm ? 1 : 0, model: null, key: '', dpr: 1, raf: 0 };
    function colors() { return { graphic: role(cv, 'graphic', '#EDE9E1'), accent: role(cv, 'accent-graphic', '#F07AA2') }; }
    function ensure() {
      var w = cv.clientWidth, h = cv.clientHeight; if (!w || !h || !window.HyphaMark) return false;
      var dpr = Math.min(2, window.devicePixelRatio || 1), key = [w, h, seed, dpr].join(':');
      if (key !== st.key) { st.key = key; st.dpr = dpr; st.model = HyphaMark.scene.build(w, h, seed, cv); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      return true;
    }
    function draw() {
      if (!ensure()) return;
      var ctx = cv.getContext('2d'); ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      HyphaMark.scene.render({ model: st.model, k: st.k, dpr: st.dpr, el: cv, live: st.k > 0 && st.k < 1 }, ctx, colors());
    }
    function play(delay) {
      cancelAnimationFrame(st.raf);
      if (calm) { st.k = 1; draw(); return; }
      var t0 = performance.now() + (delay || 0), dur = (window.HyphaMark && HyphaMark.duration) || 3400;
      st.k = 0; draw();
      (function f(now) { st.k = clamp((now - t0) / dur, 0, 1); draw(); if (st.k < 1) st.raf = requestAnimationFrame(f); })(performance.now());
    }
    var rq = 0;
    if (window.ResizeObserver) new ResizeObserver(function () { if (!rq) rq = requestAnimationFrame(function () { rq = 0; draw(); }); }).observe(cv);
    return { draw: draw, play: play, set: function (k) { cancelAnimationFrame(st.raf); st.k = clamp(k, 0, 1); draw(); }, seed: function (s) { seed = s; st.key = ''; } };
  }
  // Le mot-symbole de la barre : la marque tient lieu de premier H ; elle pousse à l'ouverture (?t=<ms> la fige, pour les captures)
  $$('[data-lockup]').forEach(function (el) {
    if (window.HyphaMark) HyphaMark.lockup(el, { intro: el.getAttribute('data-lockup') === 'intro' && (!calm || Q.has('t')), t: Q.has('t') ? parseFloat(Q.get('t')) || 0 : null });
  });

  // ---------- 1. La chambre : une suite d'images sur un canvas, que le défilement fait avancer ----------
  // k va de 0 à 1 : les neuf jours. L'encombrement de la paire dans l'image (fractions, tous instants confondus) : la scène se cadre
  // sur lui, le reste est du noir.
  var BOX = { x0: 0.087, x1: 0.9, y0: 0.215, y1: 0.799 }, IR = 16 / 9, RATIO = (BOX.x1 - BOX.x0) * IR / (BOX.y1 - BOX.y0), MAXW = 1400;
  var scene = $('#top'), pin = $('#pin'), setEl = $('#set'), cv = $('#pair'), still = $('#still'), cap = $('#cap'), copy = $('#copy'), end = $('#end'), cue = $('#cue'),
    caps = $$('#cap .hs-cap-lines > p'), introL = $$('.hs-intro .hs-l > span'), titleL = $$('.hs-title .hs-l > span'), dayOdo = Odo($('#day-odo'), 1, 9),
    lastCap = -1, lastOff = null, lastEnd = null, phone = false, fixedK = Q.has('k') ? clamp(parseFloat(Q.get('k')) || 0, 0, 1) : null;
  // Le relevé change tous les deux jours : 1, 3, 5, 7, puis le jour 9, celui où l'on arrête la pousse
  var CAPS = [0, 2 / 9, 4 / 9, 6 / 9, 8 / 9];

  // La suite (agrandie en 2K), 150 images. Pour le mouvement : un seul fichier (media/chambre-960.txt ou -1600.txt, fabriqué par
  // tools/build-packs.py), lu au fil de l'eau ; les images y sont rangées du grossier au fin, si bien que toute la pousse est
  // jouable, à grands pas, dès les premiers octets. Chaque image est décodée à sa taille, hors du fil principal, autour de la
  // position courante et d'autant plus loin devant que le défilement va vite ; rien n'est redimensionné au décodage (c'était la
  // cause des saccades : 40 à 70 ms de blocage par image). Entre deux images prêtes, un fondu : la pousse reste continue, même
  // quand il n'y en a encore qu'une sur seize. À l'arrêt, sur un écran dense, l'image fine (media/chambre-2560) vient se fondre
  // par-dessus.
  var SEQ = (function () {
    var N = 150, ctx = cv.getContext('2d', { alpha: false }), blobs = [], loaded = 0, cache = new Map(), busy = {}, pos = 0, want = 0, dir = 1, vel = 0, drawn = '',
      started = false, wanted = false, first = null, W = 0, HI = 0, AH = 14, hi = null, hiBusy = false, onHi = null;
    function near(i) {
      i = clamp(i, 0, N - 1);
      if (blobs[i] || loaded === N) return blobs[i] ? i : -1;
      for (var s = 1; s < N; s++) { if (i - s >= 0 && blobs[i - s]) return i - s; if (i + s < N && blobs[i + s]) return i + s; }
      return -1;
    }
    function trim() {
      while (cache.size > AH + 10) {
        var far = -1, fd = -1;
        cache.forEach(function (_, i) { var dd = Math.abs(i - want); if (dd > fd) { fd = dd; far = i; } });
        var bm = cache.get(far); if (bm && bm.close) bm.close(); cache.delete(far);
      }
    }
    function decode(i) {
      if (i < 0 || cache.has(i) || busy[i] || !blobs[i]) return;
      busy[i] = true;
      var p = window.createImageBitmap ? createImageBitmap(blobs[i])
        : new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = URL.createObjectURL(blobs[i]); });
      p.then(function (bm) { delete busy[i]; cache.set(i, bm); trim(); paint(); if (first && drawn) { first(); first = null; } }, function () { delete busy[i]; });
    }
    function prefetch() {
      var ahead = clamp(Math.ceil(Math.abs(vel) * 0.14) + 4, 5, AH);
      decode(near(want));
      for (var s = 1; s <= ahead; s++) { decode(near(want + s * dir)); if (s <= 3) decode(near(want - s * dir)); }
    }
    // On dessine l'image prête juste avant la position et l'image prête juste après, fondues selon la distance
    function paint() {
      if (!cv.width || !cache.size) return;
      var lo = -1, up = -1;
      cache.forEach(function (_, i) { if (i <= pos && i > lo) lo = i; if (i >= pos && (up < 0 || i < up)) up = i; });
      if (lo < 0) lo = up; if (up < 0) up = lo;
      var a = up > lo ? (pos - lo) / (up - lo) : 0;
      if (a < 0.012) a = 0; else if (a > 0.988) { a = 0; lo = up; }
      var h = hi && a === 0 && hi.i === lo ? smooth(0, 1, (performance.now() - hi.t) / 320) : 0, key = lo + ':' + up + ':' + Math.round(a * 64) + ':' + h.toFixed(3);
      if (key === drawn) return;
      ctx.globalAlpha = 1; ctx.drawImage(cache.get(lo), 0, 0, cv.width, cv.height);
      if (a > 0) { ctx.globalAlpha = a; ctx.drawImage(cache.get(up), 0, 0, cv.width, cv.height); }
      if (h > 0) { ctx.globalAlpha = h; ctx.drawImage(hi.bm, 0, 0, cv.width, cv.height); }
      ctx.globalAlpha = 1; drawn = key;
      // Banc de fluidité (diagnostic) : l'instant, la position voulue, la position dessinée
      if (window.__hsLog) window.__hsLog.push([performance.now(), pos, lo + (up - lo) * a]);
      if (still) still.classList.add('is-gone');
    }
    // Le fichier de la suite, du texte lu au fil de l'eau : une première ligne (« HYSQ », le nombre d'images, l'image rangée à chaque
    // place), puis une ligne par place, son image WebP en base64. Il est lu en octets, ligne par ligne, sans jamais devenir une
    // grande chaîne ; les lignes arrivées sont décodées par petites tranches (5 ms au plus) : même servi d'un coup par le cache, le
    // fichier ne bloque aucune image de la page.
    var B64 = new Uint8Array(128);
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach(function (c, i) { B64[c.charCodeAt(0)] = i; });
    function unb64(a) {
      var n = a.length; while (n && a[n - 1] === 61) n--;
      var out = new Uint8Array(Math.floor(n * 3 / 4)), o = 0, i = 0, full = n - (n % 4);
      for (; i < full; i += 4) { var v = (B64[a[i]] << 18) | (B64[a[i + 1]] << 12) | (B64[a[i + 2]] << 6) | B64[a[i + 3]]; out[o++] = v >> 16; out[o++] = (v >> 8) & 255; out[o++] = v & 255; }
      if (n - i === 3) { v = (B64[a[i]] << 18) | (B64[a[i + 1]] << 12) | (B64[a[i + 2]] << 6); out[o++] = v >> 16; out[o++] = (v >> 8) & 255; }
      else if (n - i === 2) { v = (B64[a[i]] << 18) | (B64[a[i + 1]] << 12); out[o++] = v >> 16; }
      return out;
    }
    function load() {
      fetch('media/chambre-' + W + '.txt').then(function (r) {
        if (!r.ok) throw new Error('suite : ' + r.status);
        var parts = [], slots = null, done = 0, queue = [], busyQ = false;
        function drain() {
          var t0 = performance.now();
          while (queue.length && performance.now() - t0 < 5) {
            var i = slots[done++];
            blobs[i] = new Blob([unb64(queue.shift())], { type: 'image/webp' }); loaded++;
            if (Math.abs(i - want) <= AH || !cache.size) decode(i);
          }
          if (queue.length) setTimeout(drain, 0); else busyQ = false;
        }
        function line(a) {
          if (!a.length) return;
          if (!slots) {
            var h = String.fromCharCode.apply(null, a).split(' ');
            if (h[0] !== 'HYSQ') throw new Error('suite : format inconnu');
            slots = h.slice(2, 2 + (+h[1])).map(Number); return;
          }
          if (done + queue.length < slots.length) queue.push(a);
        }
        function feed(chunk) {
          var from = 0, nl;
          while ((nl = chunk.indexOf(10, from)) >= 0) {
            var piece = chunk.subarray(from, nl);
            if (parts.length) { parts.push(piece); var len = 0; parts.forEach(function (q) { len += q.length; }); var all = new Uint8Array(len), o = 0; parts.forEach(function (q) { all.set(q, o); o += q.length; }); parts = []; line(all); }
            else line(piece);
            from = nl + 1;
          }
          if (from < chunk.length) parts.push(chunk.slice(from));
          if (queue.length && !busyQ) { busyQ = true; drain(); }
        }
        if (!r.body || !r.body.getReader) return r.arrayBuffer().then(function (b) { feed(new Uint8Array(b)); });
        var rd = r.body.getReader();
        return (function pump() { return rd.read().then(function (x) { if (x.done) return; feed(x.value); return pump(); }); })();
      }).catch(function (e) { if (window.console) console.warn('HYPHA, la suite de la chambre :', e.message); });
    }
    // À l'arrêt, l'image fine de la position courante, si l'écran la demande
    function settle() {
      var i = Math.round(pos);
      if (!HI || hiBusy || Math.abs(pos - i) > 0.001 || (hi && hi.i === i) || !window.createImageBitmap) return;
      hiBusy = true;
      fetch('media/chambre-' + HI + '/' + ('00' + i).slice(-3) + '.webp').then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(function (b) { return createImageBitmap(b); })
        .then(function (bm) {
          hiBusy = false;
          if (Math.abs(pos - i) > 0.001) { bm.close(); return; }
          if (hi) hi.bm.close();
          hi = { i: i, bm: bm, t: performance.now() }; paint(); if (onHi) onHi();
        }, function () { hiBusy = false; });
    }
    // La taille du canvas : celle de l'image à l'écran, sans dépasser la définition de ce qu'on y dessine
    function size(cssW) {
      var need = mini ? Math.min(cssW, 1000) : cssW * Math.min(2, window.devicePixelRatio || 1);
      if (!W) { W = need <= 1050 ? 960 : 1600; AH = (navigator.deviceMemory || 8) <= 4 ? 8 : W > 1000 ? 14 : 18; if (wanted && !started) { started = true; load(); } }
      HI = W === 1600 && need > 1760 ? 2560 : 0;
      var px = Math.round(Math.min(HI || W, need));
      if (cv.width === px) return;
      cv.width = px; cv.height = Math.round(px / IR); drawn = ''; ctx.imageSmoothingQuality = 'high'; paint();
    }
    // k : la position (0 à 1) ; v : la vitesse (images par seconde), pour décoder d'autant plus loin devant
    function to(k, v) {
      pos = clamp(k, 0, 1) * (N - 1); vel = v || 0;
      var i = Math.round(pos);
      if (i !== want) { dir = i > want ? 1 : -1; want = i; }
      if (hi && Math.abs(pos - hi.i) > 0.001) { hi.bm.close(); hi = null; }
      prefetch(); paint();
    }
    return { to: to, size: size, settle: settle, n: N, start: function () { wanted = true; if (!started && W) { started = true; load(); } }, first: function (f) { first = f; },
      fading: function () { return !!hi && performance.now() - hi.t < 340; }, onHi: function (f) { onHi = f; }, small: function () { return W === 960; } };
  })();

  // La paire tient entre le haut de la scène et ce qui est posé en bas (sur téléphone : le relevé, juste sous elle) ; l'image entière
  // l'entoure, son encombrement tombe exactement sur la scène. Sur ordinateur, elle ne dépasse pas 1 400 px ; sur téléphone, elle
  // déborde un peu de l'écran (les pointes du duvet), pour garder du corps.
  function layout() {
    var Wp = pin.clientWidth, cs = getComputedStyle(pin), gap = 20, gut = parseFloat(cs.paddingLeft) || 16;
    if (!Wp) return;
    phone = Wp < 768;
    var top = parseFloat(cs.paddingTop) || 16, bottom = (phone ? cap.offsetTop : Math.min(copy.offsetTop, cap.offsetTop, end.offsetTop)) - gap;
    var maxW = phone ? Wp * 1.06 : Math.min(Wp - 2 * gut, MAXW), band = Math.max(60, bottom - top);
    var h = Math.min(maxW / RATIO, band * (phone ? 1 : 0.96)), w = Math.round(h * RATIO), y = Math.round(top + (band - h) * (phone ? 0.8 : 0.5));
    h = Math.round(w / RATIO);
    pin.style.setProperty('--set-x', Math.round((Wp - w) / 2) + 'px');
    pin.style.setProperty('--set-y', y + 'px');
    pin.style.setProperty('--set-w', w + 'px');
    pin.style.setProperty('--set-h', h + 'px');
    var iw = w / (BOX.x1 - BOX.x0), ih = iw / IR, css = { width: iw.toFixed(1) + 'px', height: ih.toFixed(1) + 'px', left: (-BOX.x0 * iw).toFixed(1) + 'px', top: (-BOX.y0 * ih).toFixed(1) + 'px' };
    [cv, still].forEach(function (el) { Object.keys(css).forEach(function (p) { el.style[p] = css[p]; }); });
    SEQ.size(iw);
  }

  // La règle des neuf jours : quatre graduations par jour (toutes les six heures), le chiffre de chaque jour au milieu de sa case
  var seekTop = function () {};
  var TL = Timeline($('#ruler'), {
    n: 9, minor: 4, cells: true, nudge: 0.004, labels: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (d) { return { at: (d - 0.5) / 9, text: String(d) }; }),
    seek: function (p) { seekTop(p); },
    say: function (p) { var d = Math.min(9, 1 + Math.floor(p * 9 + 1e-6)); return { now: d, text: 'Day ' + d + ' of 9' }; }
  });
  // Un style posé seulement quand il change
  var styled = new Map();
  function style(el, prop, v) { var m = styled.get(el); if (!m) styled.set(el, m = {}); if (m[prop] !== v) { m[prop] = v; el.style[prop] = v; } }

  var kShown = 0;
  function render(k, v) {
    kShown = k;
    SEQ.to(k, (v || 0) * (SEQ.n - 1));
    var d = k * 9, ci = 0;
    TL.set(k); dayOdo(1 + Math.floor(d + 1e-6));
    CAPS.forEach(function (c, i) { if (k >= c - 1e-6) ci = i; });
    if (ci !== lastCap) { caps.forEach(function (e, i) { e.classList.toggle('is-on', i === ci); e.classList.toggle('is-past', i < ci); }); lastCap = ci; }
    // Sur ordinateur, le relevé du jour 9 laisse sa place à l'appel final
    var off = k >= 0.975, on = k >= 0.985;
    if (off !== lastOff) { cap.classList.toggle('is-off', off); lastOff = off; }
    if (on !== lastEnd) { end.classList.toggle('is-on', on); scene.classList.toggle('is-done', on); lastEnd = on; }
    // Le titre : « Nine days in the dark. » tient toute la pousse ; au neuvième jour, ses lignes montent derrière leur cache et
    // celles de « Grown, not made. » prennent leur place, au fil du défilement
    introL.forEach(function (e, j) { var q = smooth(0.875 + 0.02 * j, 0.945 + 0.02 * j, k); style(e, 'transform', q > 0 ? 'translate3d(0,' + (-q * 135).toFixed(2) + '%,0)' : ''); });
    titleL.forEach(function (e, j) { var q = 1 - smooth(0.9 + 0.02 * j, 0.97 + 0.02 * j, k); style(e, 'transform', 'translate3d(0,' + (q * 135).toFixed(2) + '%,0)'); });
    // L'invitation à défiler s'efface dès que la pousse part
    style(cue, 'opacity', (1 - smooth(0.06, 0.1, k)).toFixed(3));
    // La caméra : un lent travelling arrière, de la culture vue de près à la paire entière
    style(setEl, 'transform', phone ? '' : 'scale(' + (1.06 - 0.06 * smooth(0, 0.9, k)).toFixed(4) + ')');
  }
  layout();
  window.addEventListener('resize', function () { layout(); render(kShown); });
  if (calm) {
    // Animations réduites ou état figé : l'image finale. La règle reste jouable : un appui, une flèche, et la chambre montre le jour
    // choisi, sans mouvement. ?k= (captures) se place à l'instant demandé.
    still.src = SEQ.small() ? 'media/chambre-960/149.webp' : 'media/paire.webp';
    var showFrames = function () { SEQ.start(); cv.style.visibility = ''; };
    if (fixedK != null && fixedK < 1) SEQ.start(); else cv.style.visibility = 'hidden';
    seekTop = function (p) { showFrames(); render(p); };
    render(fixedK != null ? fixedK : 1);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); render(kShown); });
  } else {
    // La pousse suit le défilement. Elle occupe la scène moins sa dernière hauteur d'écran, pendant laquelle le drop monte par-dessus
    // la chambre ; le dernier dix-septième du parcours tient le jour 9, le temps de le voir. À l'ouverture, un aperçu : la pousse
    // part d'elle-même jusqu'au troisième jour, puis revient au premier (la culture reste éveillée). Le défilement la reprend là.
    SEQ.start();
    var END = 0.94, WAKE = 0.045, PEAK = 0.3, wake = 0;
    var S = Scrub({
      el: scene, pin: pin, tail: 2,
      map: function (r) { return wake + (1 - wake) * clamp(r / END, 0, 1); },
      unmap: function (k) { return clamp((k - wake) / (1 - wake), 0, 1) * END; },
      // À l'arrêt du défilement, la pousse se pose sur une image entière : jamais deux images fondues à l'écran au repos
      snap: function (k) { return Math.round(k * (SEQ.n - 1)) / (SEQ.n - 1); },
      draw: render, rest: SEQ.settle, busy: SEQ.fading
    });
    SEQ.onHi(S.poke);
    seekTop = S.seek;
    render(0);
    S.kick();
    // L'ouverture part quand les polices et la première image sont là (au plus tard après 1,4 s)
    var opened = false, open = function () {
      if (opened) return; opened = true; layout(); S.measure(); render(kShown); scene.classList.add('is-in');
      // Déjà plus bas dans la page (rechargement) : pas d'aperçu
      if (mini) return;
      if (window.scrollY > 40) { wake = WAKE; S.poke(); return; }
      setTimeout(function () { run(3300, function (q) { wake = PEAK * smooth(0, 0.44, q) - (PEAK - WAKE) * smooth(0.5, 1, q); S.poke(); }); }, 500);
    };
    var fontsIn = false, frameIn = false, both = function () { if (fontsIn && frameIn) open(); };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { fontsIn = true; both(); });
    SEQ.first(function () { frameIn = true; both(); });
    setTimeout(open, 1400);
  }

  // La poussière de la chambre : quelques spores en suspension devant la paire. Elles dérivent lentement, scintillent à peine, et
  // suivent un peu le pointeur (les plus proches davantage) ; elles se font plus présentes à mesure que la paire pousse. Un détail
  // d'atmosphère, dessiné à la définition de l'écran divisée (des points flous), arrêté dès que la chambre sort de l'écran.
  var DUST = (function () {
    var dc = $('#dust'); if (calm || mini || !dc) return { recolor: function () {} };
    var g = dc.getContext('2d'), Rd = prng(11), P = [], W = 0, H = 0, on = false, raf = 0, mx = 0, my = 0, ox = 0, oy = 0, t0 = performance.now(), col = '', hot = '';
    for (var i = 0; i < 60; i++) P.push({ x: Rd(), y: Rd(), z: 0.25 + 0.75 * Math.pow(Rd(), 1.6), a: 0.3 + 0.7 * Rd(), f: 0.2 + Rd() * 0.5, p: Rd() * 6.283, hot: Rd() < 0.18 });
    function recolor() { col = role(pin, 'text', '#EDE9E1'); hot = role(pin, 'accent-graphic', '#F07AA2'); }
    function size() { W = pin.clientWidth; H = pin.clientHeight; if (W && H) { dc.width = W; dc.height = H; } }
    function frame(now) {
      raf = 0; if (!on || !W) return;
      var t = (now - t0) / 1000;
      ox += (mx - ox) * 0.035; oy += (my - oy) * 0.035;
      g.clearRect(0, 0, W, H);
      for (var i = 0; i < P.length; i++) {
        var p = P[i], x = (p.x + 0.012 * Math.sin(t * p.f * 0.6 + p.p) + t * 0.003 * p.z) % 1 * W - ox * p.z * 30, y = ((p.y - t * 0.005 * p.z * (0.6 + p.f)) % 1 + 1) % 1 * H - oy * p.z * 20;
        g.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(t * p.f * 1.7 + p.p * 2)) * (0.1 + 0.3 * p.z) * (0.4 + 0.6 * kShown); g.fillStyle = p.hot ? hot : col;
        g.beginPath(); g.arc(x, y, 0.5 + 1.1 * p.z, 0, 6.283); g.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    recolor(); size();
    window.addEventListener('resize', size);
    pin.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch' || !W) return; mx = e.clientX / W - 0.5; my = (e.clientY - head.offsetHeight) / H - 0.5; }, { passive: true });
    if (window.IntersectionObserver) new IntersectionObserver(function (en) { on = en[en.length - 1].isIntersecting && !document.hidden; if (on && !raf) raf = requestAnimationFrame(frame); }).observe(pin);
    document.addEventListener('visibilitychange', function () { if (document.hidden) on = false; });
    return { recolor: recolor };
  })();

  // ---------- 2. L'affiche du drop : la loupe ----------
  // Sous le pointeur, un rond de l'affiche agrandi ; au survol, au focus ou à l'appui d'un des trois détails, il se pose dessus.
  var plate = $('#plate'), loupe = $('#loupe'), details = $$('.hs-detail'), pts = $$('.hs-pt');
  function loupeAt(fx, fy) {
    var r = plate.getBoundingClientRect();
    plate.style.setProperty('--pw', r.width.toFixed(1) + 'px'); plate.style.setProperty('--ph', r.height.toFixed(1) + 'px');
    plate.style.setProperty('--fx', fx.toFixed(4)); plate.style.setProperty('--fy', fy.toFixed(4));
    plate.style.setProperty('--lx', (fx * r.width).toFixed(1) + 'px'); plate.style.setProperty('--ly', (fy * r.height).toFixed(1) + 'px');
    loupe.classList.add('is-on');
  }
  function loupeOff() { loupe.classList.remove('is-on'); details.forEach(function (d) { d.classList.remove('is-on'); }); pts.forEach(function (q) { q.classList.remove('is-on'); }); }
  plate.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var r = plate.getBoundingClientRect();
    details.forEach(function (d) { d.classList.remove('is-on'); });
    loupeAt(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1));
  }, { passive: true });
  plate.addEventListener('pointerleave', loupeOff);
  details.forEach(function (d) {
    var show = function () { details.forEach(function (o, k) { o.classList.toggle('is-on', o === d); if (pts[k]) pts[k].classList.toggle('is-on', o === d); }); loupeAt(+d.getAttribute('data-x'), +d.getAttribute('data-y')); };
    d.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') show(); });
    d.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch' && document.activeElement !== d) loupeOff(); });
    d.addEventListener('focus', show);
    d.addEventListener('blur', loupeOff);
    d.addEventListener('click', function () { if (d.classList.contains('is-on') && loupe.classList.contains('is-on') && d.dataset.held) { d.dataset.held = ''; loupeOff(); d.blur(); } else { d.dataset.held = '1'; show(); } });
  });

  // ---------- 2. L'étiquette : la réservation (démonstration : rien n'est envoyé) ----------
  var edition = $('#edition'); ticksIn(edition, 10);
  function counts() {
    $$('[data-taken]').forEach(function (e) { e.textContent = String(taken); });
    $$('[data-left]').forEach(function (e) { e.textContent = String(TOTAL - taken); });
    $$('[data-next]').forEach(function (e) { e.textContent = pad4(taken + 1); });
    edition.style.setProperty('--p', (taken / TOTAL).toFixed(4));
    $$('#edition > i').forEach(function (t, i) { t.classList.toggle('is-past', i * 50 <= taken); });
  }
  counts();
  var buy = $('#buy'), go = $('#buy-go'), buyStatus = $('#buy-status'), done = 0;
  buy.addEventListener('change', function () {
    var s = buy.querySelector('input[name="size"]:checked');
    buy.classList.remove('is-error');
    if (s) { go.textContent = (done ? 'Reserve another, size ' : 'Reserve size ') + s.value; if (!done) buyStatus.textContent = ''; }
  });
  buy.addEventListener('submit', function (e) {
    e.preventDefault();
    var s = buy.querySelector('input[name="size"]:checked');
    if (!s) { buy.classList.add('is-error'); buyStatus.textContent = 'Choose a size first.'; buy.querySelector('input[name="size"]:not(:disabled)').focus(); return; }
    if (taken >= TOTAL) { buyStatus.textContent = 'This drop is fully reserved.'; return; }
    buyStatus.textContent = 'Pair ' + pad4(taken + 1) + ' is yours, in size ' + s.value + '. We seed it tomorrow at 09:00. This is a demonstration: nothing was sent.';
    taken++; done++;
    s.checked = false; go.textContent = 'Reserve another pair';
    counts(); PAIRS.goto(taken);
  });

  // ---------- 3. Chaque paire : son empreinte et sa marque ----------
  // L'empreinte : la sporée que la souche de la paire a laissée, sur papier noir. Des lames rayonnent depuis le pied (les longues,
  // puis des plus courtes entre elles, comme sous un chapeau) ; la poussière y est dense près du pied et s'éclaircit vers le bord,
  // qui ondule ; entre les lames, une poussière plus fine. La graine de la paire règle le nombre de lames, leur départ et le
  // bord : deux paires n'ont jamais la même empreinte. Elle se dépose comme une vraie sporée : partout à la fois, grain après
  // grain, un peu plus tôt près du pied.
  function sporePrint(seed, W) {
    var R = prng(seed * 9301 + 49297), c = W / 2, Rr = W / 2 * 0.965, G = 190 + Math.floor(R() * 60);
    var ph = R() * 6.283, lobes = 3 + Math.floor(R() * 3), amp = 0.022 + R() * 0.032, ph2 = R() * 6.283, pts = [], gi, j, n;
    function edgeAt(th) { return 0.94 + amp * Math.sin(th * lobes + ph2); }
    for (gi = 0; gi < G; gi++) {
      var th = ph + gi / G * Math.PI * 2, lvl = gi % 8 === 0 ? 0 : gi % 4 === 0 ? 1 : gi % 2 === 0 ? 2 : 3;
      var edge = edgeAt(th) + (R() - 0.5) * 0.012, r0 = [0.36, 0.5, 0.62, 0.74][lvl] + R() * 0.02, r1 = edge - lvl * 0.012;
      n = Math.round((r1 - r0) * Rr / 0.7);
      for (j = 0; j < n; j++) {
        var u = j / n; if (R() > 0.94 - 0.6 * u) continue;
        var tj = th + (R() - 0.5) * 0.007, rr = (r0 + (r1 - r0) * u) * Rr + (R() - 0.5) * 0.7;
        pts.push({ x: c + Math.cos(tj) * rr, y: c + Math.sin(tj) * rr, a: [0.85, 0.6, 0.4, 0.24][Math.min(3, Math.floor((u + R() * 0.3) * 3))], s: 1, b: 0.72 * R() + 0.28 * u });
      }
    }
    // La poussière fine, entre les lames : plus rare, plus pâle, jusqu'un peu au-delà du bord
    n = Math.round(W * W * 0.022);
    for (j = 0; j < n; j++) {
      var t2 = R() * 6.283, e2 = edgeAt(t2), q = 0.36 + (e2 + 0.03 - 0.36) * Math.pow(R(), 0.8);
      pts.push({ x: c + Math.cos(t2) * q * Rr, y: c + Math.sin(t2) * q * Rr, a: 0.07 + 0.13 * R() * (1 - smooth(e2 - 0.08, e2 + 0.03, q)), s: 0.8 + R() * 0.9, b: 0.25 + 0.75 * R() });
    }
    pts.sort(function (p, q2) { return p.b - q2.b; });
    return { pts: pts, gills: G, c: c, scar: 0.335 * Rr };
  }
  // Le nombre de lames d'une paire, lu dans sa graine (le même tirage que l'empreinte, sans la dessiner)
  function gillsOf(seed) { return 190 + Math.floor(prng(seed * 9301 + 49297)() * 60); }
  var PAIRS = (function () {
    var cv = $('#print'), noEl = $('#pair-no b'), stateEl = $('#pair-state'), range = $('#pair-n'), wrap = $('#pair-wrap'), rule = $('#pair-rule'), disc = cv.parentNode;
    var n = taken, mark = Mark($('#one-mark'), n), W = 0, dpr = 1, P = null, at = 0, anim = null, shown = calm, scarOn = false;
    var tk = ticksIn(rule, 10);
    // Le halo : une copie de l'empreinte, floue, posée dessous ; la poussière dense éclaire le papier noir
    var halo = document.createElement('canvas'); halo.setAttribute('aria-hidden', 'true'); halo.style.opacity = '0.6'; disc.insertBefore(halo, cv);
    function seeded() { return n <= grown; }
    function begin() {
      W = cv.clientWidth; if (!W) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = cv.height = Math.round(W * dpr); halo.width = halo.height = Math.max(2, Math.round(W / 3));
      halo.style.filter = 'blur(' + (W * 0.012).toFixed(1) + 'px)';
      P = sporePrint(n, W); at = 0; scarOn = false;
      return true;
    }
    // Dessine les grains nés jusqu'à q (de 0 à 1), sans effacer ceux d'avant ; la lumière s'additionne là où ils se recouvrent
    function upto(q) {
      if (!P) return;
      var ctx = cv.getContext('2d'), col = role(cv, 'accent-graphic', '#F07AA2'), d = Math.max(0.6, 1.15 / dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col;
      while (at < P.pts.length && P.pts[at].b <= q) { var p = P.pts[at++], s = d * p.s; ctx.globalAlpha = p.a; ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); }
      // La cicatrice du pied, un cercle fin autour de la marque
      if (!scarOn && q >= 0.12) { scarOn = true; ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 0.75; ctx.beginPath(); ctx.arc(P.c, P.c, P.scar, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      var h = halo.getContext('2d'); h.clearRect(0, 0, halo.width, halo.height); h.drawImage(cv, 0, 0, halo.width, halo.height);
    }
    function full() { if (begin()) upto(1); }
    function play() {
      if (anim) anim.on = false;
      if (calm) { full(); return; }
      if (!begin()) return;
      anim = run(2600, function (q) { upto(1 - Math.pow(1 - q, 2.2)); });
    }
    // Ce que dit la paire : semée (avec son nombre de lames), la prochaine, ou pas encore semée (son empreinte reste pâle :
    // sa marque, elle, est déjà écrite dans son numéro)
    function say() {
      // (grown : les paires semées à l'ouverture de la page ; celles réservées pendant la visite sont « à vous », semées demain)
      var name = STRAINS[currentStrain()].name, t = n < grown ? 'Seeded. ' + name + ', ' + gillsOf(n) + ' gills.' : n === grown ? 'Seeded this morning. ' + name + ', ' + gillsOf(n) + ' gills.'
        : n <= taken ? 'Yours. We seed it tomorrow at 09:00.' : n === taken + 1 ? 'Next to be seeded. It could be yours.' : 'Not seeded yet. Its mark is already written.';
      noEl.textContent = pad4(n); stateEl.textContent = t;
      disc.style.setProperty('--dust', seeded() ? '1' : '0.2'); cv.style.opacity = seeded() ? '1' : '0.22'; halo.style.opacity = seeded() ? '0.6' : '0.1';
      cv.setAttribute('aria-label', 'The spore print of pair ' + pad4(n) + (seeded() ? ': the spores of its strain, fallen in fine radiating gills, with the mark of the pair at its centre.' : ', not seeded yet: a faint outline, with the mark of the pair at its centre.'));
      range.setAttribute('aria-valuetext', 'Pair ' + pad4(n) + '. ' + t);
      wrap.style.setProperty('--h', ((n - 1) / (TOTAL - 1)).toFixed(5));
      rule.style.setProperty('--p', ((taken - 1) / (TOTAL - 1)).toFixed(5));
      tk.forEach(function (t2, i) { t2.classList.toggle('is-past', i * 50 <= taken); });
      noEl.parentNode.classList.toggle('is-mine', n > grown && n <= taken);
    }
    function set(v, animate) {
      n = clamp(Math.round(v), 1, TOTAL);
      if (String(n) !== range.value) range.value = String(n);
      mark.seed(n);
      if (animate && !calm) { play(); mark.play(250); } else { if (anim) anim.on = false; full(); mark.set(1); }
      say();
    }
    var rq = 0, pending = null;
    range.addEventListener('input', function () { pending = +range.value; shown = true; if (!rq) rq = requestAnimationFrame(function () { rq = 0; set(pending, false); }); });
    $('#regrow').addEventListener('click', function () { shown = true; set(n, true); });
    if (window.ResizeObserver) { var ro = 0; new ResizeObserver(function () { if (!ro) ro = requestAnimationFrame(function () { ro = 0; if (shown && cv.clientWidth !== W) { full(); say(); } }); }).observe(cv); }
    say();
    if (shown) set(n, false);
    return { arrive: function () { shown = true; set(n, true); }, show: function () { shown = true; set(n, false); }, refresh: function () { say(); }, goto: function (v) { if (shown) set(v, false); else { n = v; range.value = String(v); mark.seed(v); say(); } }, recolor: function () { if (shown) { full(); mark.draw(); say(); } } };
  })();

  // ---------- 5. La coupe du sol : 90 jours (le dessin : soil.js, en WebGL 2), que le défilement fait passer ----------
  // La paire est en terre au jour 0 ; le vieux réseau du sol s'éveille et ses cordons la rejoignent (6 à 30) ; la colonie la gagne,
  // le feutre s'efface là où les fils sont passés et les fils gardent sa forme (20 à 64) ; des cordons montent, la souche
  // fructifie (62 à 88). Chaque image est une fonction du jour : le défilement va dans les deux sens.
  var GROUND = (function () {
    var sec = $('#return'), gp = $('#ground-pin'), cv = $('#soil-c'), copyEl = $('#ground-copy'), side = $('#ground-side'), capsS = $$('#soil-cap .hs-cap-lines > p'),
      endEl = $('#soil-end'), odo = Odo($('#soil-odo'), 0, 90), eng = null, day = -1, lastC = -1, lastE = null, seekDay = function () {};
    var fixedJ = Q.has('j') ? clamp(parseFloat(Q.get('j')) || 0, 0, 90) : null;
    // Le défilement donne à chaque étape sa durée : le jour 0 se tient un instant ; le sol s'éveille vite ; la colonisation et
    // l'effacement prennent leur temps ; la fructification a le plus long parcours ; le jour 90 se tient, le temps de le voir
    var dayOf = monotone([0, 0.03, 0.1, 0.32, 0.54, 0.64, 0.92, 1], [0, 0, 6, 30, 56, 64, 90, 90]);
    // La règle des 90 jours : une graduation tous les deux jours, un nombre tous les dix
    var TG = Timeline($('#soil-rule'), {
      n: 9, minor: 5, cells: false, labels: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(function (d) { return { at: d / 90, text: String(d) }; }),
      seek: function (p) { seekDay(p * 90); },
      say: function (p) { var d = Math.round(p * 90); return { now: d, text: 'Day ' + d + ' of 90' }; }
    });
    // La mise en page (px CSS du canvas) : la ligne du sol passe sous le texte ; si un texte surplombe la touffe de pleurotes, elle
    // descend pour lui faire place. La définition est plafonnée à 3,2 millions de pixels : la planche couvre l'écran.
    function layout() {
      var W = gp.clientWidth, H = gp.clientHeight; if (!W || !H || !window.HyphaSoil) return null;
      var S = HyphaSoil, pr = gp.getBoundingClientRect(), ph = W < 768, cx = W / 2;
      var boxes = [copyEl, side].map(function (e) { var b = e.getBoundingClientRect(); return [b.left - pr.left, b.top - pr.top, b.right - pr.left, b.bottom - pr.top]; });
      // La touffe est un peu agrandie, davantage sur téléphone où la paire est petite
      var gy = H * (ph ? 0.4 : 0.38), sw = 0, fk = ph ? 1.3 : 1.15;
      for (var i = 0; i < 4; i++) {
        sw = Math.min(W * (ph ? 0.92 : 0.5), (H - gy) / 0.62, 880);
        var cl = cx + (S.XF - S.FRUIT_W * fk) * sw, cr = cx + (S.XF + S.FRUIT_W * fk) * sw, fh = S.FRUIT_H * fk * sw, need = 0;
        boxes.forEach(function (b) { if (b[2] > cl && b[0] < cr) need = Math.max(need, b[3] + 12 + fh); });
        if (need <= gy + 0.5) break;
        gy = Math.min(need, H * 0.6);
      }
      var dpr = mini ? 1 : clamp(Math.sqrt(3.2e6 / (W * H)), 1, Math.min(2, window.devicePixelRatio || 1));
      return { W: W, H: H, cx: cx, gy: Math.round(gy), sw: sw, ys: S.T0, fruit: fk, cap: [0, 0, 0, 0], dpr: dpr };
    }
    function build() { var l = layout(); if (l && eng) eng.layout(l); }
    function show(d) {
      d = clamp(d, 0, 90);
      if (Math.abs(d - day) < 0.002) return;
      day = d;
      TG.set(d / 90); odo(d);
      var ci = d < 8 ? 0 : d < 38 ? 1 : d < 64 ? 2 : 3, on = d >= 89.2;
      if (ci !== lastC) { capsS.forEach(function (e, i) { e.classList.toggle('is-on', i === ci); e.classList.toggle('is-past', i < ci); }); lastC = ci; }
      if (on !== lastE) { endEl.classList.toggle('is-on', on); lastE = on; }
      if (eng) eng.set(d);
    }
    function mount() {
      if (eng || !window.HyphaSoil) return;
      var rq = 0, ro = window.ResizeObserver ? new ResizeObserver(function () { if (!rq) rq = requestAnimationFrame(function () { rq = 0; build(); }); }) : null;
      eng = HyphaSoil.mount(cv, { src: 'media/paire.webp', strain: currentStrain, onswap: function (c) { cv = c; c.setAttribute('data-soil', '2d'); } });
      if (!eng) return;
      cv.setAttribute('data-soil', eng.engine);
      build(); eng.set(Math.max(0, day));
      if (ro) ro.observe(gp);
    }
    if (calm) {
      // Animations réduites : le jour 90 ; la règle mène à n'importe quel jour, sans mouvement
      seekDay = show;
      show(fixedJ != null ? fixedJ : 90);
    } else {
      var S = Scrub({ el: sec, pin: gp, tail: 1, map: function (r) { return r; }, unmap: function (k) { return k; }, draw: function (k) { show(dayOf(k)); } });
      seekDay = function (d) { S.seek(invert(dayOf, clamp(d, 0, 90))); };
      show(0);
      S.kick();
    }
    return { mount: mount, again: function () { if (eng) { build(); eng.recolor(); eng.set(Math.max(0, day)); } } };
  })();

  // ---------- 6. Le pied de page : le mot-symbole en très grand ; le H est la marque vivante ----------
  var footCv = $('#foot-h'), fword = $('.hs-foot-word'), fslot = $('.hs-foot-slot'), footEl = $('#foot'), footMark = Mark(footCv, 44);
  function fitFoot() {
    if (!window.HyphaMark || !HyphaMark.metrics) return;
    var Wc = fword.clientWidth, ypha = fslot.nextElementSibling, m = HyphaMark.metrics(600), cf = m.base - m.cap;
    if (!Wc) return;
    fword.style.setProperty('--fw', '100px');
    var r = ypha.getBoundingClientRect().width / 100, F = Wc / ((m.right - m.left) * 0.75 / cf + 0.035 + r) * 0.995, S = Math.round(0.75 * F / cf);
    m = HyphaMark.metrics(S);
    fword.style.setProperty('--fw', F.toFixed(2) + 'px');
    fslot.style.width = ((m.right - m.left) * S).toFixed(1) + 'px';
    footCv.style.width = S + 'px'; footCv.style.height = S + 'px';
    footCv.style.left = (-m.left * S).toFixed(1) + 'px';
    // La boîte du H va de la ligne de capitale à la ligne de base du mot (0,75 em) : la ligne de capitale de la marque y tombe
    footCv.style.top = (-m.cap * S + (0.75 * F - (m.base - m.cap) * S)).toFixed(1) + 'px';
    footMark.draw();
  }
  fitFoot();
  window.addEventListener('resize', fitFoot);
  $('#news').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('#news-mail').value.trim(), ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    $('#news-status').textContent = ok ? 'Thank you. We will write the morning the next strain seeds. This is a demonstration: nothing was sent.' : 'Enter an email address, like name@example.com.';
    if (!ok) $('#news-mail').focus();
  });
  // Le réseau (../landing/network.js). Monté au repos (polices prêtes), animé tant qu'il est à l'écran ; en animations réduites, il
  // pousse d'un coup puis reste figé. Les lettres du mot-symbole sont ce qu'il contourne. Sans taille (page masquée), il attend.
  var net = null, netWait = null;
  function mountNet() {
    if (net || !window.HyphaNetwork) return;
    var nc = $('.hs-net');
    if (!nc.clientWidth || !nc.clientHeight) {
      if (!netWait && window.ResizeObserver) {
        netWait = new ResizeObserver(function () { if (!nc.clientWidth || !nc.clientHeight) return; netWait.disconnect(); netWait = null; idle(function () { fitFoot(); mountNet(); }, 2000); });
        netWait.observe(nc);
      }
      return;
    }
    net = HyphaNetwork.mount(nc, {
      still: calm, scale: mini ? 0.75 : 0,
      food: function (g) {
        var fr = footEl.getBoundingClientRect(), sr = fslot.getBoundingClientRect(), yr = fslot.nextElementSibling.getBoundingClientRect(), F = parseFloat(getComputedStyle(fword).fontSize);
        g.font = '560 ' + F + 'px "Bodoni Moda"';
        if ('letterSpacing' in g) g.letterSpacing = (0.01 * F).toFixed(2) + 'px';
        var y = sr.bottom - fr.top;
        g.lineJoin = 'round'; g.lineWidth = Math.max(2, F * 0.035);
        [['H', sr.left - fr.left], ['YPHA', yr.left - fr.left]].forEach(function (w) { g.fillStyle = '#000'; g.fillText(w[0], w[1], y); g.strokeStyle = '#000'; g.strokeText(w[0], w[1], y); });
      },
      mask: function () { return $('.hs-foot-grid').getBoundingClientRect().top - footEl.getBoundingClientRect().top; },
      colors: function () { return { bg: role(footEl, 'bg', '#110F0D'), vein: role(footEl, 'text-muted', '#A8A197'), cap: role(footEl, 'border-strong', '#898279'), accent: role(footEl, 'accent-graphic', '#F07AA2'), dim: 0.14 }; }
    });
    if (!net) return;
    if (calm) { net.still(600); return; }
    var seen = false;
    new IntersectionObserver(function (en) { seen = en[0].isIntersecting; if (seen && !document.hidden) net.start(); else net.stop(); }).observe(footEl);
    document.addEventListener('visibilitychange', function () { if (document.hidden) net.stop(); else if (seen) net.start(); });
    // La main éclaire le réseau : il s'en écarte
    footEl.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; var r = footEl.getBoundingClientRect(); net.light(e.clientX - r.left, e.clientY - r.top, 120); }, { passive: true });
    footEl.addEventListener('pointerleave', function () { net.light(0, 0, 0); });
    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { net.resize(); }, 200); });
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
    fitFoot();
    idle(function () { fitFoot(); GROUND.mount(); mountNet(); }, 4000);
  });

  // ---------- À l'arrivée à l'écran, une fois : l'affiche se compose ; l'empreinte se dépose et la marque pousse ; le H du pied
  // de page pousse ----------
  var poster = $('#poster');
  if (!calm && window.IntersectionObserver) {
    var watch = function (el, f, th) {
      var io = new IntersectionObserver(function (en) { if (en[en.length - 1].intersectionRatio >= th - 0.001) { io.disconnect(); f(); } }, { threshold: [0, th] });
      io.observe(el);
    };
    watch(poster, function () { poster.classList.add('is-in'); }, 0.22);
    watch($('.hs-disc'), function () { PAIRS.arrive(); }, 0.45);
    watch(fword, function () { footMark.play(); }, 0.5);
  } else { poster.classList.add('is-in'); PAIRS.show(); footMark.set(1); }

  // ---------- La souche change (page parente : { type: 'hypha:set', strain }) : les dessins reprennent leurs couleurs ----------
  function setStrain(st) {
    if (!STRAINS[st]) return;
    Object.keys(STRAINS).forEach(function (s) { html.classList.toggle('hy-strain-' + s, s === st); });
    applyStrain(); lastGround = ''; ground();
    PAIRS.recolor(); footMark.draw(); GROUND.again(); DUST.recolor(); if (net) net.redraw();
  }
  window.addEventListener('message', function (e) { if (e.source !== window.parent || !e.data || e.data.type !== 'hypha:set') return; if (e.data.strain) setStrain(e.data.strain); });
})();
