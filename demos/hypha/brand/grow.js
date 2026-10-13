/* HYPHA — moteur de pousse procédural, v4 (canvas et SVG). Marque fictive, un Original de Topiary.
   La paire : des hyphes guidés par un champ de directions (ils montent dans la tige, filent dans la semelle, longent le contour
   et les coutures), tracés en courbes lissées sur trois plans de profondeur, puis éclairés comme au microscope en fond noir :
   bords et dessus plus lumineux. La paire pousse en blanc ; en fin de pousse, la couleur de la souche monte dans ses fils depuis la
   semelle, comme une encre par capillarité. La pousse se joue dans le temps ou suit le défilement.
   La marque : un H vectoriel. Deux fûts montent, deux demi-barres se rejoignent et fusionnent (une anastomose), puis les poils poussent.
   Le numéro de la paire sert de graine : une même paire repousse toujours à l'identique.
   Couleurs : --hy-color-graphic (fils, marque) et --hy-color-accent-graphic (la teinture), lues dans le thème courant.
   Animations réduites (?rm=1, ?fige=1 ou prefers-reduced-motion) : l'état final, sans pousse.
   Usage : <canvas data-hy-scene="shoe|mark|texture" data-hy-seed="412" [data-hy-layout="right|full|poster"] [data-hy-bare]
           [data-hy-intro] [data-hy-duration="1800"] [data-hy-k="0.4"]>
           HyphaGrow.auto() ; HyphaGrow.play(el) ; HyphaGrow.progress(el, k) ; HyphaGrow.repaint() ; HyphaGrow.markSVG(graine, taille, couleur, nu).
   La marque et le mot-symbole vivent aussi dans brand/mark.js (window.HyphaMark) : quand il fournit scene, svg ou duration,
   ils remplacent ceux d'ici pour les canvas data-hy-scene="mark" et pour markSVG. */
(function (root) {
  'use strict';
  var Q = new URLSearchParams(root.location.search);
  function reduced() { return Q.has('rm') || Q.has('fige') || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // ---------- Hasard reproductible et bruit de valeur ----------
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise2(seed) {
    var R = prng(seed), p = new Uint16Array(512), v = new Float32Array(256), i;
    for (i = 0; i < 256; i++) { p[i] = i; v[i] = R() * 2 - 1; }
    for (i = 255; i > 0; i--) { var j = Math.floor(R() * (i + 1)), t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 256; i++) p[i + 256] = p[i];
    function h(x, y) { return v[p[p[x & 255] + (y & 255)]]; }
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      var a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    };
  }
  // Courbes d'accélération des tokens --hy-ease-grow et --hy-ease-out
  function bezier(x1, y1, x2, y2) {
    function at(t, a, b) { return 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t; }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var lo = 0, hi = 1, t = x;
      for (var i = 0; i < 26; i++) { t = (lo + hi) / 2; if (at(t, x1, x2) < x) lo = t; else hi = t; }
      return at(t, y1, y2);
    };
  }
  var easeGrow = bezier(0.45, 0, 0.2, 1), easeOut = bezier(0.16, 1, 0.3, 1);

  // ---------- La basket : silhouette de profil dans une boîte de 400 × 200, pointe à droite ----------
  var SHOE = 'M30 182C16 182 10 172 11 160C12 128 16 98 28 76C34 66 42 60 54 58C72 56 88 66 104 76C118 84 134 88 150 86C166 84 176 74 186 64C192 58 200 55 210 55C222 55 232 61 244 70C268 88 296 106 324 120C352 132 380 138 390 152C396 162 394 176 382 180C372 183 360 184 340 184L50 184C40 184 34 183 30 182Z';
  var SOLE = [[11, 160], [120, 164], [280, 166], [393, 162]];
  // Coutures : ligne de semelle, bout, contrefort, œillets
  var SEAMS = 'M11 160C120 164 280 166 393 162M332 125C338 142 350 156 368 164M28 80C48 96 56 128 54 160M212 58C242 80 282 104 318 119';
  var BOX = { x: 10, y: 50, w: 386, h: 134 };
  function fit(r, pad) {
    var s = Math.min((r.w - 2 * pad) / BOX.w, (r.h - 2 * pad) / BOX.h);
    var ox = r.x + (r.w - BOX.w * s) / 2 - BOX.x * s, oy = r.y + (r.h - BOX.h * s) / 2 - BOX.y * s;
    return { s: s, m: new DOMMatrix([s, 0, 0, s, ox, oy]), X: function (u) { return ox + u * s; }, Y: function (v) { return oy + v * s; } };
  }
  function shape(d, f) { var p = new Path2D(); p.addPath(new Path2D(d), f.m); return p; }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

  // ---------- Champs : masque binaire et distances (chanfrein) ----------
  function raster(W, H, paint) {
    var c = canvas(W, H), x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#000'; x.strokeStyle = '#000'; paint(x);
    var d = x.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
    for (var i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    return m;
  }
  function invert(m) { var o = new Uint8Array(m.length); for (var i = 0; i < m.length; i++) o[i] = m[i] ? 0 : 1; return o; }
  // Distance de chaque pixel marqué au pixel non marqué le plus proche
  function dist(m, W, H) {
    var d = new Float32Array(W * H), A = 1, B = 1.4142, x, y, i, v;
    for (i = 0; i < d.length; i++) d[i] = m[i] ? 1e6 : 0;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      i = y * W + x; v = d[i]; if (!v) continue;
      if (x > 0 && d[i - 1] + A < v) v = d[i - 1] + A;
      if (y > 0) { if (d[i - W] + A < v) v = d[i - W] + A; if (x > 0 && d[i - W - 1] + B < v) v = d[i - W - 1] + B; if (x < W - 1 && d[i - W + 1] + B < v) v = d[i - W + 1] + B; }
      d[i] = v;
    }
    for (y = H - 1; y >= 0; y--) for (x = W - 1; x >= 0; x--) {
      i = y * W + x; v = d[i]; if (!v) continue;
      if (x < W - 1 && d[i + 1] + A < v) v = d[i + 1] + A;
      if (y < H - 1) { if (d[i + W] + A < v) v = d[i + W] + A; if (x < W - 1 && d[i + W + 1] + B < v) v = d[i + W + 1] + B; if (x > 0 && d[i + W - 1] + B < v) v = d[i + W - 1] + B; }
      d[i] = v;
    }
    return d;
  }

  // ---------- Croissance : les pointes avancent, s'orientent selon le champ, se ramifient, meurent dans une zone saturée ----------
  // Chaque hyphe garde ses points [x, y, instant de naissance] : on peut l'afficher à n'importe quel instant de la pousse.
  function simulate(o) {
    var R = prng(o.seed), W = o.W, H = o.H, cell = o.cell, cols = Math.ceil(W / cell) + 1, occ = new Uint8Array(cols * (Math.ceil(H / cell) + 1));
    var hyphae = [], tips = [], iter, i;
    function spawn(x, y, a, gen, start, speed, life, key, c) {
      var hy = { pts: [x, y, start], gen: gen, key: key, layer: o.layerOf(gen, R) };
      hyphae.push(hy);
      tips.push({ x: x, y: y, a: a, gen: gen, start: start, speed: speed, acc: 0, life: life, hy: hy, c: c == null ? -1 : c });
    }
    o.roots.forEach(function (r) { spawn(r.x, r.y, r.a, 0, r.start, r.speed, o.life, r.key); });
    for (iter = 0; iter < o.maxIter && tips.length; iter++) {
      var next = [];
      for (i = 0; i < tips.length; i++) {
        var t = tips[i];
        if (iter < t.start) { next.push(t); continue; }
        t.acc += t.speed; if (t.acc < 1) { next.push(t); continue; } t.acc -= 1;
        var want = o.flow(t.x, t.y, t.a, t.hy.key);
        if (want != null) { var df = Math.atan2(Math.sin(want - t.a), Math.cos(want - t.a)); t.a += df * o.steer; }
        t.a += (R() - 0.5) * o.jitter;
        var nx = t.x + Math.cos(t.a) * o.step, ny = t.y + Math.sin(t.a) * o.step;
        if (!o.inside(nx, ny, t.hy.key)) {
          var sl = o.slide ? o.slide(t.x, t.y, t.a) : null;
          if (sl == null) continue;
          t.a = sl; nx = t.x + Math.cos(t.a) * o.step; ny = t.y + Math.sin(t.a) * o.step;
          if (!o.inside(nx, ny, t.hy.key)) continue;
        }
        var ci = Math.floor(ny / cell) * cols + Math.floor(nx / cell);
        if (ci !== t.c) { if (occ[ci] >= o.crowd(t.hy.key)) continue; occ[ci]++; t.c = ci; }
        t.x = nx; t.y = ny; t.hy.pts.push(nx, ny, iter); t.life--;
        if (t.life > 0) next.push(t);
        if (R() < o.branch(t.hy.key) && next.length < o.maxTips) {
          spawn(nx, ny, t.a + (R() < 0.5 ? 1 : -1) * o.spread * (0.6 + R() * 0.8), t.gen + 1, iter, t.speed * (0.82 + R() * 0.28),
            Math.round(o.branchLife * (0.45 + R() * 0.55)), t.hy.key, t.c);
        }
      }
      tips = next;
    }
    var out = [];
    hyphae.forEach(function (h) { if (h.pts.length >= 6) out.push({ pts: new Float32Array(h.pts), gen: h.gen, key: h.key, layer: h.layer }); });
    return { hyphae: out, tmax: Math.max(1, iter) };
  }

  // Le temps de la pousse suit la quantité de fils : chaque instant ajoute la même part de matière.
  // L'instant de naissance de chaque point devient son rang parmi tous les points, ramené entre offset et offset + span.
  function remap(list, offset, span) {
    var births = [], i;
    list.forEach(function (hy) { for (i = 2; i < hy.pts.length; i += 3) births.push(hy.pts[i]); });
    births.sort(function (a, b) { return a - b; });
    var n = births.length || 1;
    list.forEach(function (hy) {
      var p = hy.pts;
      for (i = 2; i < p.length; i += 3) {
        var v = p[i], lo = 0, hi = births.length;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (births[mid] < v) lo = mid + 1; else hi = mid; }
        p[i] = offset + span * (lo / n);
      }
    });
  }

  // ---------- La paire ----------
  // [largeur, opacité] par plan : loin, milieu, près
  var STYLE = {
    upper: [[0.36, 0.24], [0.62, 0.62], [0.95, 1]],
    sole: [[0.5, 0.5], [0.8, 0.78], [1.1, 0.98]],
    aerial: [[0.5, 0.16], [0.58, 0.3], [0.7, 0.52]],
    felt: [[0.3, 0.12], [0.3, 0.12], [0.3, 0.12]],
    texture: [[0.45, 0.3], [0.7, 0.5], [0.95, 0.72]]
  };
  // fo : un cadrage imposé (la chambre de la landing) ; le modèle garde alors ses champs pour la peau
  function shoeModel(w, h, seed, el, fo) {
    var layout = fo ? 'full' : el.getAttribute('data-hy-layout') || (getComputedStyle(el).position === 'absolute' ? 'right' : 'full');
    var reg = layout === 'right' ? { x: w * 0.44, y: h * 0.04, w: w * 0.54, h: h * 0.92 }
      : layout === 'poster' ? { x: w * 0.04, y: h * 0.4, w: w * 0.92, h: h * 0.34 } : { x: 0, y: 0, w: w, h: h };
    var f = fo || fit(reg, Math.max(12, reg.w * 0.05)), s = f.s, W = Math.ceil(w), H = Math.ceil(h), minX = layout === 'right' ? w * 0.42 : 0;
    var path = shape(SHOE, f);
    var inside = raster(W, H, function (x) { x.fill(path); });
    var Din = dist(inside, W, H), Dout = dist(invert(inside), W, H);
    var seams = raster(W, H, function (x) { x.lineWidth = Math.max(1, 1.1 * s); x.stroke(shape(SEAMS, f)); });
    var Dg = dist(invert(seams), W, H);
    // Hauteur de la ligne de semelle pour chaque colonne
    var soleAt = new Float32Array(W).fill(H), P = SOLE.map(function (p) { return [f.X(p[0]), f.Y(p[1])]; }), q, c0;
    for (q = 0; q <= 600; q++) {
      var u = q / 600, a = 1 - u, sx = a * a * a * P[0][0] + 3 * a * a * u * P[1][0] + 3 * a * u * u * P[2][0] + u * u * u * P[3][0];
      var sy = a * a * a * P[0][1] + 3 * a * a * u * P[1][1] + 3 * a * u * u * P[2][1] + u * u * u * P[3][1], xi = Math.round(sx);
      if (xi >= 0 && xi < W) soleAt[xi] = Math.min(soleAt[xi], sy);
    }
    for (c0 = 1; c0 < W; c0++) if (soleAt[c0] === H && soleAt[c0 - 1] !== H) soleAt[c0] = soleAt[c0 - 1];
    for (c0 = W - 2; c0 >= 0; c0--) if (soleAt[c0] === H && soleAt[c0 + 1] !== H) soleAt[c0] = soleAt[c0 + 1];
    function at(x, y) { return clamp(y | 0, 1, H - 2) * W + clamp(x | 0, 1, W - 2); }
    function tangent(D, i, a) {
      var gx = D[i + 1] - D[i - 1], gy = D[i + W] - D[i - W], tx = -gy, ty = gx, l = Math.sqrt(tx * tx + ty * ty);
      if (!l || l > 1e5) return null;
      tx /= l; ty /= l;
      if (tx * Math.cos(a) + ty * Math.sin(a) < 0) { tx = -tx; ty = -ty; }
      return [tx, ty];
    }
    var N = noise2(seed * 7 + 1), N2 = noise2(seed * 11 + 5), fq = 1 / (36 * s);
    // Dans la masse, chaque pointe garde son cap : les colonies poussent en rond. Près du bord et des coutures, elles les longent.
    function flow(x, y, a, key) {
      if (key === 'aerial') return -Math.PI / 2 + N(x * fq * 0.8, y * fq * 0.8) * 1.2;
      var i = at(x, y), bx = Math.cos(a), by = Math.sin(a);
      if (key === 'sole') { var hd = bx >= 0 ? 1 : -1, n = N2(x * fq * 2, y * fq * 2) * 0.25; bx += (Math.cos(n) * hd - bx) * 0.35; by += (Math.sin(n) - by) * 0.35; }
      var we = Math.exp(-Din[i] / (3.2 * s));
      if (we > 0.03) { var t = tangent(Din, i, a); if (t) { bx += (t[0] - bx) * we; by += (t[1] - by) * we; } }
      var wg = Math.exp(-Dg[i] / (2.2 * s)) * 0.6;
      if (wg > 0.03) { var g = tangent(Dg, i, a); if (g) { bx += (g[0] - bx) * wg; by += (g[1] - by) * wg; } }
      return Math.atan2(by, bx);
    }
    function slide(x, y, a) { var t = tangent(Din, at(x, y), a); return t ? Math.atan2(t[1], t[0]) : null; }
    var R = prng(seed * 13 + 5), roots = [], plugs = [], soleSeeds = [], k, j;
    // Semelle : des fils horizontaux, partis de points répartis le long de la bande
    for (k = 0; k < 15; k++) {
      var rx = f.X(20 + k * 25 + R() * 10), ry = (soleAt[rx | 0] + f.Y(182)) / 2;
      if (inside[at(rx, ry)]) { soleSeeds.push([rx, ry]); for (j = 0; j < 2; j++) roots.push({ x: rx, y: ry, a: j ? Math.PI : 0, start: R() * 16, speed: 0.78 + R() * 0.22, key: 'sole' }); }
    }
    // Tige : des points d'inoculation sur une grille irrégulière, dans tout le moule ; chaque colonie pousse en rond, puis fusionne
    for (var gy = 0; gy < 5; gy++) for (var gx = 0; gx < 11; gx++) {
      var px = f.X(22 + gx * 35 + (R() - 0.5) * 18), py = f.Y(68 + gy * 20 + (R() - 0.5) * 12), pi = at(px, py);
      if (inside[pi] && Din[pi] > 4 * s && py < soleAt[px | 0] - 4 * s) plugs.push([px, py]);
    }
    plugs.forEach(function (p) {
      var st = R() * 26;
      for (j = 0; j < 5; j++) roots.push({ x: p[0], y: p[1], a: (j / 5) * Math.PI * 2 + R() * 0.9, start: st, speed: 0.72 + R() * 0.28, key: 'upper' });
    });
    var main = simulate({
      seed: seed, W: W, H: H, roots: roots, cell: 2.3 * s, step: 1.9 * s, steer: 0.3, jitter: 0.3, spread: 0.7, life: 600, branchLife: 90,
      maxIter: 900, maxTips: 14000, flow: flow, slide: slide,
      crowd: function (key) { return key === 'sole' ? 6 : 5; },
      branch: function (key) { return key === 'sole' ? 0.035 : 0.085; },
      inside: function (x, y, key) {
        if (x < 1 || y < 1 || x > W - 2 || y > H - 2 || !inside[at(x, y)]) return false;
        return key === 'sole' ? y > soleAt[x | 0] - 0.6 : y < soleAt[x | 0] + 0.6;
      },
      layerOf: function (gen, Rr) { return gen === 0 ? (Rr() < 0.62 ? 2 : 1) : (Rr() < 0.55 ? 1 : 0); }
    });
    // Duvet : des fils très courts et très fins, au fond, qui donnent du corps à la matière
    var froots = [];
    for (k = 0; k < 4000 && froots.length < 900; k++) {
      var fx = f.X(14 + R() * 372), fy = f.Y(56 + R() * 126), fi = at(fx, fy);
      if (inside[fi] && fy < soleAt[fx | 0] + 0.6) froots.push({ x: fx, y: fy, a: R() * Math.PI * 2, start: R() * 60, speed: 0.6 + R() * 0.4, key: 'felt' });
    }
    var felt = simulate({
      seed: seed + 7, W: W, H: H, roots: froots, cell: 1.7 * s, step: 1.3 * s, steer: 0.3, jitter: 0.6, spread: 0.9, life: 22, branchLife: 9,
      maxIter: 120, maxTips: 8000, flow: function (x, y, a) { return flow(x, y, a, 'upper'); }, slide: slide,
      crowd: function () { return 2; }, branch: function () { return 0.12; },
      inside: function (x, y) { if (x < 1 || y < 1 || x > W - 2 || y > H - 2) return false; var i = at(x, y); return inside[i] && y < soleAt[x | 0] + 0.6; },
      layerOf: function () { return 0; }
    });
    // Fils aériens : quelques hyphes quittent la paire par le haut, à la fin de la pousse
    var aroots = [];
    for (k = 0; k < 9; k++) {
      var ax = f.X(40 + k * 38 + R() * 16), ay = 0;
      while (ay < H - 1 && !inside[at(ax, ay)]) ay++;
      if (ay < H - 1 && ay > 2) aroots.push({ x: ax, y: ay - 1.5, a: -Math.PI / 2 + (R() - 0.5) * 0.9, start: R() * 20, speed: 0.65 + R() * 0.35, key: 'aerial' });
    }
    var aer = simulate({
      seed: seed + 3, W: W, H: H, roots: aroots, cell: 6 * s, step: 2 * s, steer: 0.1, jitter: 0.32, spread: 0.7, life: 20 + Math.round(R() * 26), branchLife: 12,
      maxIter: 90, maxTips: 60, flow: flow, slide: null,
      crowd: function () { return 255; }, branch: function () { return 0.02; },
      inside: function (x, y) { if (x < minX + 2 || x > W - 2 || y < 2 || y > H - 2) return false; var i = at(x, y); return !inside[i] && Dout[i] < 42 * s; },
      layerOf: function () { return 2; }
    });
    // La paire pousse sur toute la durée ; les fils aériens naissent à la fin, et pâlissent vers leur pointe
    remap(main.hyphae, 0, 1); remap(felt.hyphae, 0.1, 0.88); remap(aer.hyphae, 0.7, 0.28);
    // Pigment : en fin de pousse, la couleur de la souche monte dans les fils depuis la semelle, comme une encre par capillarité.
    // Chaque point reçoit son seuil d'apparition (0 = tout de suite, au-delà de 1 = jamais) : la semelle d'abord, puis un front
    // qui monte dans la tige jusqu'à mi-hauteur environ. Son bord ondule le long de la paire et s'effrange en doigts.
    var N3 = noise2(seed * 17 + 3), topAt = new Float32Array(W).fill(H), cx, cy;
    for (cx = 0; cx < W; cx++) for (cy = 0; cy < H; cy++) if (inside[cy * W + cx]) { topAt[cx] = cy; break; }
    function pigment(pts, key) {
      var n = pts.length / 3, out = new Float32Array(n), i;
      for (i = 0; i < n; i++) {
        var x = pts[i * 3], y = pts[i * 3 + 1], h2 = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        if (key === 'sole') { out[i] = 0.02 + 0.16 * h2; continue; }
        var xi = clamp(x | 0, 0, W - 1), hgt = clamp((soleAt[xi] - y) / Math.max(1, soleAt[xi] - topAt[xi]), 0, 1);
        var lim = 0.55 + 0.12 * N3(x * fq * 0.7, 2.5) + 0.06 * N3(x * fq * 3.2, y * fq * 3.2) + 0.04 * (h2 - 0.5);
        out[i] = hgt < lim ? 0.16 + 0.82 * Math.pow(hgt / lim, 0.9) : 2;
      }
      return out;
    }
    var T = 1, groups = {};
    function add(key, layer, pts, pg) { var g = groups[key + layer] || (groups[key + layer] = { key: key, layer: layer, list: [], pg: [] }); g.list.push(pts); g.pg.push(pg || null); }
    main.hyphae.forEach(function (hy) { add(hy.key, hy.layer, hy.pts, pigment(hy.pts, hy.key)); });
    felt.hyphae.forEach(function (hy) { add('felt', 0, hy.pts, pigment(hy.pts, 'upper')); });
    aer.hyphae.forEach(function (hy) {
      var p = hy.pts, n = p.length / 3;
      var c1 = Math.max(2, Math.floor(n * 0.42)), c2 = Math.max(c1 + 1, Math.floor(n * 0.74));
      add('aerial', 2, p.slice(0, c1 * 3 + 3));
      if (n > c1 + 1) add('aerial', 1, p.slice(c1 * 3, c2 * 3 + 3));
      if (n > c2 + 1) add('aerial', 0, p.slice(c2 * 3));
    });
    // Lumière : bords et dessus plus clairs, coutures qui accrochent la lumière ; dehors, les fils aériens s'éteignent avec la distance
    var light = canvas(W, H), lx = light.getContext('2d'), img = lx.createImageData(W, H), d = img.data, top = f.Y(BOX.y), bot = f.Y(BOX.y + BOX.h);
    for (var y = 0; y < H; y++) {
      var yt = clamp((bot - y) / (bot - top), 0, 1), topl = yt * yt;
      for (var x = 0; x < W; x++) {
        var i2 = y * W + x, L;
        if (inside[i2]) L = 0.5 + 0.42 * Math.exp(-Din[i2] / (4.6 * s)) + 0.2 * topl + 0.14 * Math.exp(-Dg[i2] / (2.2 * s)) + (y > soleAt[x] ? 0.14 : 0);
        else L = 0.95 * Math.exp(-Dout[i2] / (85 * s));
        d[i2 * 4 + 3] = clamp(L, 0, 1) * 255;
      }
    }
    lx.putImageData(img, 0, 0);
    var out = { W: w, H: h, groups: groups, tmax: T, light: light, outline: path, plugs: plugs, styleScale: clamp(s / 1.6, 0.75, 1.3) };
    if (fo) { out.f = f; out.soleSeeds = soleSeeds; out.Din = Din; }
    return out;
  }

  // ---------- La trame : des colonies éparses qui se rejoignent ----------
  function textureModel(w, h, seed) {
    var W = Math.ceil(w), H = Math.ceil(h), R = prng(seed * 7 + 3), N = noise2(seed * 5 + 9), fq = 1 / 70, roots = [], i, n = Math.max(6, Math.round(w * h / 11000));
    for (i = 0; i < n; i++) { var x0 = R() * w, y0 = R() * h, st = R() * 40; for (var k = 0; k < 5; k++) roots.push({ x: x0, y: y0, a: k / 5 * Math.PI * 2 + R(), start: st, speed: 0.7 + R() * 0.3, key: 'texture' }); }
    var sim = simulate({
      seed: seed, W: W, H: H, roots: roots, cell: 4.4, step: 2.2, steer: 0.12, jitter: 0.22, spread: 0.75, life: 260, branchLife: 70, maxIter: 340, maxTips: 4000,
      flow: function (x, y) { return N(x * fq, y * fq) * Math.PI * 1.4; }, slide: null,
      crowd: function () { return 2; }, branch: function () { return 0.05; },
      inside: function (x, y) { return x > 1 && y > 1 && x < W - 2 && y < H - 2; },
      layerOf: function (gen, Rr) { return gen === 0 ? 2 : (Rr() < 0.5 ? 1 : 0); }
    });
    remap(sim.hyphae, 0, 1);
    var groups = {};
    sim.hyphae.forEach(function (hy) { var g = groups['texture' + hy.layer] || (groups['texture' + hy.layer] = { key: 'texture', layer: hy.layer, list: [] }); g.list.push(hy.pts); });
    var light = canvas(W, H), lx = light.getContext('2d'), img = lx.createImageData(W, H), d = img.data, edge = Math.min(70, Math.min(W, H) / 3);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      d[(y * W + x) * 4 + 3] = clamp(0.2 + 0.8 * smooth(0, 1, Math.min(x, y, W - 1 - x, H - 1 - y) / edge), 0, 1) * 255;
    }
    lx.putImageData(img, 0, 0);
    return { W: w, H: h, groups: groups, tmax: 1, light: light, outline: null, plugs: [], styleScale: 1 };
  }

  function rgba(hex, al) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + al + ')'; }
  // Nombre de points visibles d'un hyphe à l'instant tk
  function visible(a, tk) { var n = a.length / 3, m = 1; if (a[2] > tk) return 0; while (m < n && a[m * 3 + 2] <= tk) m++; return m; }
  // Tronçon [s0, e0] d'un hyphe, sur la même courbe que appendPieces (milieux et points de contrôle)
  function appendSpan(p, a, s0, e0, m, ex, ey) {
    p.moveTo(s0 === 0 ? a[0] : (a[(s0 - 1) * 3] + a[s0 * 3]) / 2, s0 === 0 ? a[1] : (a[(s0 - 1) * 3 + 1] + a[s0 * 3 + 1]) / 2);
    for (var j = Math.max(1, s0); j <= e0; j++) {
      var x = a[j * 3], y = a[j * 3 + 1], nx = x, ny = y;
      if (j < m - 1) { nx = a[(j + 1) * 3]; ny = a[(j + 1) * 3 + 1]; } else if (ex != null) { nx = ex; ny = ey; }
      p.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
    if (ex != null && e0 === m - 1) p.lineTo(ex, ey);
  }
  // Le tronçon né entre tk - hi et tk - lo ; le palier le plus jeune finit sur la pointe qui pousse
  function appendBand(p, a, tk, lo, hi) {
    var n = a.length / 3, m = visible(a, tk);
    if (!m) return;
    var s0 = -1, e0 = -1, i, tHi = tk - lo, tLo = tk - hi;
    for (i = m - 1; i >= 0; i--) { var ti = a[i * 3 + 2]; if (ti < tLo) break; if (ti <= tHi) { if (e0 < 0) e0 = i; s0 = i; } }
    if (s0 < 0) return;
    var ex = null, ey = null;
    if (lo === 0 && e0 === m - 1 && m < n) {
      var t0 = a[(m - 1) * 3 + 2], t1 = a[m * 3 + 2], fr = t1 > t0 ? (tk - t0) / (t1 - t0) : 1;
      ex = a[(m - 1) * 3] + (a[m * 3] - a[(m - 1) * 3]) * fr; ey = a[(m - 1) * 3 + 1] + (a[m * 3 + 1] - a[(m - 1) * 3 + 1]) * fr;
    }
    if (e0 > s0 || ex != null) appendSpan(p, a, s0, e0, m, ex, ey);
  }

  // Paliers du front de pousse : [âge mini, âge maxi, opacité] ; l'éclat décroît avec l'âge, sans saut
  var BANDS = [[0, 0.012, 0.8], [0.012, 0.024, 0.5], [0.024, 0.036, 0.26], [0.036, 0.05, 0.1]];
  // Seuil de la teinture franche : en dessous (le bas de la tige et la semelle), la couleur couvre le fil ; au-dessus, elle le teinte à peine
  var DEEP = 0.6;
  // ---------- Rendu des fils, par accumulation ----------
  // Un tronçon d'hyphe (du milieu d'un segment au milieu du suivant, autour d'un point) a sa forme définitive dès que le point
  // suivant est né. On le trace alors une fois pour toutes sur un calque qui s'accumule, en couleur opaque mêlée d'avance au fond,
  // en mode lighten (darken sur fond clair) : ce mélange ne dépend ni de l'ordre ni du nombre de passes, et la pousse tracée en cent
  // fois donne la même image qu'en une seule. Chaque image ne trace donc que ce qui vient de naître ; les pointes qui poussent encore
  // sont redessinées à chaque image. Si la pousse recule, on repart de zéro.
  function hexRgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function cssRgb(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
  // Les tronçons i0 à i1 d'un hyphe de n points : chacun va du milieu d'un segment au milieu du suivant, autour de son point
  function appendPieces(p, a, i0, i1, n) {
    p.moveTo(i0 === 1 ? a[0] : (a[(i0 - 1) * 3] + a[i0 * 3]) / 2, i0 === 1 ? a[1] : (a[(i0 - 1) * 3 + 1] + a[i0 * 3 + 1]) / 2);
    for (var i = i0; i <= i1; i++) {
      var x = a[i * 3], y = a[i * 3 + 1];
      if (i < n - 1) p.quadraticCurveTo(x, y, (x + a[(i + 1) * 3]) / 2, (y + a[(i + 1) * 3 + 1]) / 2); else p.quadraticCurveTo(x, y, x, y);
    }
  }
  // La pointe d'un hyphe qui pousse (mv points visibles sur n) : son dernier tronçon, jusqu'à la pointe interpolée
  function appendTip(p, a, tk, mv, n) {
    var t0 = a[(mv - 1) * 3 + 2], t1 = a[mv * 3 + 2], fr = t1 > t0 ? (tk - t0) / (t1 - t0) : 1, px = a[(mv - 1) * 3], py = a[(mv - 1) * 3 + 1];
    var ex = px + (a[mv * 3] - px) * fr, ey = py + (a[mv * 3 + 1] - py) * fr;
    if (mv === 1) { p.moveTo(a[0], a[1]); p.lineTo(ex, ey); return; }
    p.moveTo(mv === 2 ? a[0] : (a[(mv - 2) * 3] + px) / 2, mv === 2 ? a[1] : (a[(mv - 2) * 3 + 1] + py) / 2);
    p.quadraticCurveTo(px, py, (px + ex) / 2, (py + ey) / 2); p.lineTo(ex, ey);
  }
  function layer2d(w, h, dpr, half) {
    var sc = half ? dpr / 2 : dpr, x = canvas(Math.max(1, Math.round(w * sc)), Math.max(1, Math.round(h * sc))).getContext('2d');
    x.setTransform(sc, 0, 0, sc, 0, 0); x.lineCap = 'round'; x.lineJoin = 'round';
    return x;
  }
  function wipe(x) { x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, x.canvas.width, x.canvas.height); x.restore(); }
  // Les calques : fils et teinture, nets et flous (le plan du fond et le duvet, à demi-résolution), et leur composition floue
  function accumulator(c, col) {
    var m = c.model, w = m.W, h = m.H, dpr = c.dpr, gr = hexRgb(col.graphic), ac = hexRgb(col.accent);
    var keys = Object.keys(m.groups).sort(function (a, b) { return m.groups[a].layer - m.groups[b].layer; });
    var A = { key: col.key, tk: -1, pk: -1, keys: keys, done: [], mv: [], tone: [],
      w: layer2d(w, h, dpr), d: layer2d(w, h, dpr), sw: layer2d(w, h, dpr, true), sd: layer2d(w, h, dpr, true), sc: layer2d(w, h, dpr, true) };
    keys.forEach(function (key) {
      var g = m.groups[key], st = STYLE[g.key][g.layer], soft = g.layer === 0 && g.key !== 'aerial', a = st[1], white = mixRgb(col.bg, gr, a);
      A.done.push(new Int32Array(g.list.length)); A.mv.push(new Int32Array(g.list.length));
      A.tone.push({ soft: soft, lw: st[0] * m.styleScale * (soft ? 1.2 : 1), white: cssRgb(white),
        deep: cssRgb(mixRgb(white, ac, a * 0.94)), pale: cssRgb(mixRgb(white, ac, a * 0.72)), dye: !!g.pg && g.key !== 'aerial' });
    });
    return A;
  }
  function restart(A) { [A.w, A.d, A.sw, A.sd].forEach(wipe); A.done.forEach(function (d) { d.fill(0); }); A.tk = -1; A.pk = -1; }
  // Des instantanés de la pousse (la chambre en garde trois) : quand on remonte le temps, on repart du plus proche plutôt que de zéro.
  // Sans teinture des fils : seuls les calques des fils blancs (net et flou) et l'avancée de chaque hyphe sont gardés.
  function snapshot(A, i, cp) {
    var sn = (A.snaps || (A.snaps = []))[i] = A.snaps[i] || { w: canvas(A.w.canvas.width, A.w.canvas.height), sw: canvas(A.sw.canvas.width, A.sw.canvas.height) };
    [['w', A.w], ['sw', A.sw]].forEach(function (p) { var x = sn[p[0]].getContext('2d'); x.globalCompositeOperation = 'copy'; x.drawImage(p[1].canvas, 0, 0); });
    sn.done = A.done.map(function (d) { return d.slice(); }); sn.mv = A.mv.map(function (d) { return d.slice(); }); sn.tk = cp;
  }
  function rewind(A, tk, pk) {
    if (pk || A.pk > 0 || !A.snaps) return false;
    var best = null;
    A.snaps.forEach(function (sn) { if (sn && sn.tk <= tk && (!best || sn.tk > best.tk)) best = sn; });
    if (!best) return false;
    [['w', A.w], ['sw', A.sw]].forEach(function (p) { var x = p[1]; x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'copy'; x.drawImage(best[p[0]], 0, 0); x.restore(); });
    A.done.forEach(function (d, i) { d.set(best.done[i]); }); A.mv.forEach(function (d, i) { d.set(best.mv[i]); });
    A.tk = best.tk; A.pk = 0;
    return true;
  }
  // Trace ce qui s'est posé depuis la dernière image : les tronçons dont la forme est désormais définitive, et leur teinture
  function accumulate(A, m, tk, pk, blend) {
    A.keys.forEach(function (key, gi) {
      var g = m.groups[key], tone = A.tone[gi], done = A.done[gi], dyeOn = tone.dye && pk > 0, dyeNew = dyeOn && pk > A.pk, pw = null, pd = null, pp = null;
      for (var j = 0; j < g.list.length; j++) {
        var a = g.list[j], n = a.length / 3, s0 = done[j];
        if (s0 === n - 1 && !dyeNew) continue;
        var mv = visible(a, tk), sN = mv === n ? n - 1 : Math.max(0, mv - 2);
        A.mv[gi][j] = mv;
        if (sN > s0) { appendPieces(pw || (pw = new Path2D()), a, s0 + 1, sN, n); done[j] = sN; }
        var pg = g.pg && g.pg[j];
        if (!dyeOn || !sN || !pg || (!dyeNew && sN === s0)) continue;
        // Les tronçons qui viennent de se poser, si leur seuil est passé ; ceux déjà posés, si leur seuil vient de passer
        var run = 0, deep = false;
        for (var i = dyeNew ? 1 : s0 + 1; i <= sN + 1; i++) {
          var on = false, dp = false;
          if (i <= sN) { var v = pg[i]; on = i > s0 ? v <= pk : v > A.pk && v <= pk; dp = v <= DEEP; }
          if (run && (!on || dp !== deep)) { appendPieces(deep ? (pd || (pd = new Path2D())) : (pp || (pp = new Path2D())), a, run, i - 1, n); run = 0; }
          if (on && !run) { run = i; deep = dp; }
        }
      }
      var cw = tone.soft ? A.sw : A.w, cd = tone.soft ? A.sd : A.d;
      if (pw) { cw.globalCompositeOperation = blend; cw.strokeStyle = tone.white; cw.lineWidth = tone.lw; cw.stroke(pw); }
      if (pd) { cd.globalCompositeOperation = blend; cd.strokeStyle = tone.deep; cd.lineWidth = tone.lw * 1.06; cd.stroke(pd); }
      if (pp) { cd.globalCompositeOperation = blend; cd.strokeStyle = tone.pale; cd.lineWidth = tone.lw * 1.06; cd.stroke(pp); }
    });
    A.tk = tk; A.pk = pk;
  }
  function strokeTips(x, list, soft, part, blend) {
    list.forEach(function (t) {
      if (t.tone.soft !== soft || !t[part]) return;
      x.globalCompositeOperation = part === 'w' ? blend : 'source-over';
      x.strokeStyle = part === 'w' ? t.tone.white : part === 'd' ? t.tone.deep : t.tone.pale; x.lineWidth = t.tone.lw * (part === 'w' ? 1 : 1.06); x.stroke(t[part]);
    });
  }
  function renderThreads(c, ctx, col) { threads(c, ctx, col, c.k, clamp((c.k - 0.66) / 0.34, 0, 1), c.live && c.k < 1, true); }
  // Les fils à l'instant k (teinture pk), pointes et front de pousse si live, points d'inoculation si plugs
  function threads(c, ctx, col, k, pk, live, plugs) {
    var m = c.model, w = m.W, h = m.H, tk = k * m.tmax, blend = col.glow ? 'lighten' : 'darken', A = c.acc;
    if (!A || A.key !== col.key) A = c.acc = accumulator(c, col);
    else if (tk < A.tk || pk < A.pk) { if (!(m.snaps && rewind(A, tk, pk))) restart(A); }
    // 1. Ce qui vient de naître rejoint les calques : les fils blancs, puis la teinture de la souche (franche en bas, pâle vers le front)
    if (m.snaps && !pk) m.snaps.forEach(function (cp, i) { if (A.tk < cp && tk >= cp) { accumulate(A, m, cp, 0, blend); snapshot(A, i, cp); } });
    accumulate(A, m, tk, pk, blend);
    // 2. Les pointes qui poussent encore, redessinées à chaque image
    var tips = [];
    if (live) A.keys.forEach(function (key, gi) {
      var g = m.groups[key], tone = A.tone[gi], t = { tone: tone, w: null, d: null, p: null };
      for (var j = 0; j < g.list.length; j++) {
        var a = g.list[j], n = a.length / 3, mv = A.mv[gi][j];
        if (A.done[gi][j] === n - 1 || mv < 1 || mv >= n) continue;
        appendTip(t.w || (t.w = new Path2D()), a, tk, mv, n);
        var pg = tone.dye && pk > 0 && g.pg[j];
        if (pg && pg[mv - 1] <= pk) appendTip(pg[mv - 1] <= DEEP ? (t.d || (t.d = new Path2D())) : (t.p || (t.p = new Path2D())), a, tk, mv, n);
      }
      if (t.w) tips.push(t);
    });
    // 3. Composition : le flou du fond, les fils nets par-dessus, la teinture, puis la lumière de fond noir
    var sc = A.sc;
    wipe(sc); sc.drawImage(A.sw.canvas, 0, 0, w, h); strokeTips(sc, tips, true, 'w', blend);
    sc.globalCompositeOperation = 'source-over'; sc.drawImage(A.sd.canvas, 0, 0, w, h); strokeTips(sc, tips, true, 'd', blend); strokeTips(sc, tips, true, 'p', blend);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(sc.canvas, 0, 0, w, h);
    ctx.globalCompositeOperation = blend; ctx.drawImage(A.w.canvas, 0, 0, w, h); strokeTips(ctx, tips, false, 'w', blend);
    ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(A.d.canvas, 0, 0, w, h); strokeTips(ctx, tips, false, 'd', blend); strokeTips(ctx, tips, false, 'p', blend);
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(m.light, 0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
    // 4. Le front de pousse : les fils les plus jeunes sont plus clairs, et s'assombrissent en mûrissant
    if (live) {
      ctx.strokeStyle = col.fresh; ctx.lineWidth = STYLE.upper[2][0] * m.styleScale * 1.1;
      BANDS.forEach(function (b) {
        var p = new Path2D();
        A.keys.forEach(function (key) { var g = m.groups[key]; if (g.layer === 0 || (g.key !== 'upper' && g.key !== 'sole')) return; for (var i = 0; i < g.list.length; i++) appendBand(p, g.list[i], tk, b[0], b[1]); });
        ctx.globalAlpha = b[2]; ctx.stroke(p);
      });
      ctx.globalAlpha = 1;
    }
    // 5. Points d'inoculation, au tout début de la pousse
    if (plugs && m.plugs.length && live && k < 0.22) {
      var al = smooth(0, 0.035, k) * (1 - smooth(0.1, 0.22, k));
      if (al > 0.01) { var pp = new Path2D(), pr = 1.6 * m.styleScale; m.plugs.forEach(function (q) { pp.moveTo(q[0] + pr, q[1]); pp.arc(q[0], q[1], pr, 0, Math.PI * 2); }); ctx.fillStyle = rgba(col.fresh, 0.85 * al); ctx.fill(pp); }
    }
  }

  // ---------- La chambre de pousse (landing) : du semis à la photo de produit ----------
  // Une scène pilotée par k, de 0 à 1 : les neuf jours, un neuvième chacun. Les fils poussent dans le creux d'un moule (jours 1 à 5) ;
  // la paire sort du moule et lance quelques fils dans l'air (jour 6) ; elle se referme en un feutre dense (jour 7) ; elle boit la
  // teinture de la souche depuis la semelle (jour 8) ; puis la lumière de la chambre s'allume : une seule lumière douce et rasante,
  // le feutre en relief, l'ombre de la paire sur le sol (jour 9).
  // Le cadre CHBOX (unités de la silhouette) remplit le canvas, qui en garde les proportions : la page le place, et pose son sol
  // (un aplat) à la ligne d'horizon, derrière la paire. La peau, ses deux lumières et l'ombre sont cuites une fois, pendant les temps
  // morts du navigateur ; chaque image ne fait que composer des calques.
  var CHBOX = { x: -14, y: -8, w: 428, h: 204 }, HORIZON = 175, CONTACT = 184;
  var MOLD = { x0: -1, x1: 405, y0: 33, r: 18 };
  // La semelle (sous la ligne de semelle) et les coutures de la tige, sans la ligne de semelle
  var SOLE_REGION = 'M11 160C120 164 280 166 393 162C395 170 391 178 382 180C372 183 360 184 340 184L50 184C40 184 34 183 30 182C16 182 10 172 11 160Z';
  var SEAMS_UP = 'M332 125C338 142 350 156 368 164M28 80C48 96 56 128 54 160M212 58C242 80 282 104 318 119';
  // Ce que la silhouette ne dit pas, et que la peau montre : l'ouverture du col (on voit l'intérieur du bord opposé, entre le bord
  // du col le plus loin, qui fait la silhouette, et le bord le plus proche), les pièces moulées en surépaisseur (contrefort du talon,
  // bout, bande des œillets) et la jonction de la semelle d'usure
  var LINING = 'M54 58C72 56 88 66 104 76C118 84 134 88 150 86C166 84 176 74 186 64C190 61 193 60 196 60C194 63 192 66 190 70C180 82 168 92 152 94C136 96 120 92 106 84C90 72 76 62 60 62Z';
  var PANELS = 'M28 80C48 96 56 128 54 160L2 160L2 80ZM332 125C338 142 350 156 368 164L406 164L406 96L332 96ZM212 58C242 80 282 104 318 119L334 98L232 36L204 42Z';
  var OUTSOLE = 177.5;
  // Les œillets, le long du cou-de-pied, et le lacet de chanvre brut : un brin par œillet qui passe par-dessus la languette, et le nœud
  // près de la languette (comme sur la fiche de la paire). Le lacet n'est pas teint ; il apparaît avec la peau.
  var EYELETS = [[222, 65.5], [237, 75], [252.5, 85.5], [268, 95.5], [283.5, 105.5], [298.5, 114.5]];
  var BOW = { knot: [226, 58.5], loops: ['M226 58.5C222 52 211 45 207 48C204 51 214 57 226 58.5Z', 'M226 58.5C231 51 241 42 245 45C248 48 238 56 226 58.5Z'],
    ends: ['M226 58.5C224 64 219 70 215 77', 'M226 58.5C229 65 233 71 238 76'] };
  // La ligne du dessus, du sommet de la languette au bout (les deux segments du profil), pour poser chaque brin sur le bord
  function instepY(x) {
    var segs = [[[210, 55], [222, 55], [232, 61], [244, 70]], [[244, 70], [268, 88], [296, 106], [324, 120]]], best = 55, bd = 1e9;
    segs.forEach(function (sg) {
      for (var i = 0; i <= 40; i++) {
        var t = i / 40, u = 1 - t, px = u * u * u * sg[0][0] + 3 * u * u * t * sg[1][0] + 3 * u * t * t * sg[2][0] + t * t * t * sg[3][0];
        var py = u * u * u * sg[0][1] + 3 * u * u * t * sg[1][1] + 3 * u * t * t * sg[2][1] + t * t * t * sg[3][1];
        if (Math.abs(px - x) < bd) { bd = Math.abs(px - x); best = py; }
      }
    });
    return best;
  }
  function span(a, b, v) { return clamp((v - a) / (b - a), 0, 1); }
  // Le calendrier : chaque grandeur va de 0 à 1 dans sa fenêtre
  function chamberPhase(k) {
    return {
      day: Math.min(9, 1 + Math.floor(k * 9 + 1e-6)),
      seeds: span(0.004, 0.046, k),                                // le semis, point par point, du talon vers la pointe
      seedFade: 1 - span(0.2, 0.3, k),                             // les points se perdent dans leurs colonies
      tk: span(0.035, 0.548, k),                                   // la pousse des fils : le moule est plein à la fin du jour 5
      lift: span(0.566, 0.632, k),                                 // jour 6 : le moule se lève
      air: span(0.6, 0.664, k) * (1 - span(0.69, 0.75, k)),       // des fils partent dans l'air, puis rentrent dans la peau
      haze: span(0.33, 0.556, k),                                  // jours 4 et 5 : le réseau s'épaissit, cotonneux
      felt: span(0.672, 0.762, k),                                 // jour 7 : le feutre se referme
      floor: span(0.779, 0.802, k),                                // jour 8 : la teinture remplit le bac (le sol, côté page)
      dye: span(0.815, 0.89, k),                                   // un temps, puis elle monte dans la paire, depuis la semelle
      light: span(0.893, 0.968, k),                                // jour 9 : la lumière s'allume
      title: span(0.93, 0.985, k)
    };
  }
  function chamberFit(w, h) {
    var s = Math.min(w / CHBOX.w, h / CHBOX.h), ox = (w - CHBOX.w * s) / 2 - CHBOX.x * s, oy = (h - CHBOX.h * s) / 2 - CHBOX.y * s;
    return { s: s, m: new DOMMatrix([s, 0, 0, s, ox, oy]), X: function (u) { return ox + u * s; }, Y: function (v) { return oy + v * s; } };
  }
  // Le moule : un bloc aux angles du haut arrondis, posé sur le sol ; la paire pousse dans son creux
  function moldPath(f) {
    var x0 = f.X(MOLD.x0), x1 = f.X(MOLD.x1), y0 = f.Y(MOLD.y0), y1 = f.Y(CONTACT), r = MOLD.r * f.s, p = new Path2D();
    p.moveTo(x0, y1); p.lineTo(x0, y0 + r); p.arcTo(x0, y0, x0 + r, y0, r); p.lineTo(x1 - r, y0); p.arcTo(x1, y0, x1, y0 + r, r); p.lineTo(x1, y1); p.closePath();
    return p;
  }
  function chamberModel(w, h, seed, el) {
    var f = chamberFit(w, h), m = shoeModel(w, h, seed, el, f), s = f.s;
    // Les fils gardent du corps quand la scène est petite (téléphone) : ils se lisent dans le noir
    m.styleScale = clamp(s / 1.6, 0.95, 1.3);
    // Les instantanés de la pousse des fils, pour remonter le temps sans tout retracer
    m.snaps = [0.12, 0.25, 0.5, 0.75];
    // Les fils aériens quittent le calque cumulé : ils poussent après le démoulage, puis rentrent dans la peau
    m.aerial = [];
    Object.keys(m.groups).forEach(function (key) { if (m.groups[key].key === 'aerial') { m.aerial.push(m.groups[key]); delete m.groups[key]; } });
    // Le semis : les points d'inoculation de la tige et de la semelle, posés du talon vers la pointe
    m.seeds = m.plugs.concat(m.soleSeeds).sort(function (a, b) { return a[0] - b[0]; });
    // Le feutre se referme en taches qui partent de chaque colonie et se rejoignent
    var R = prng(seed * 29 + 11);
    m.patches = m.seeds.map(function (p) { return { x: p[0], y: p[1], t0: R() * 0.5, R: (27 + R() * 9) * s, a: R() * 6.283, b: R() * 6.283, c: R() * 6.283 }; });
    m.mold = moldPath(f);
    m.sole = shape(SOLE_REGION, f);
    m.nz = noise2(seed * 31 + 7); m.nz2 = noise2(seed * 37 + 3);
    m.job = null;
    return m;
  }

  // ---------- La peau : le feutre cuit une fois, en relief, sous deux lumières ----------
  // Relief : le biseau arrondi de la tige et de la semelle (distances exactes au bord), le galbe de la tige, les rainures des coutures
  // moulées, et les fils de la paire eux-mêmes, en très léger relief. Deux éclairages : celui de la chambre (fond noir : bords et fils
  // diffusent) et celui du studio (une lumière douce et rasante en haut à gauche, un débouchage, le reflet de la souche du sol).
  function prof(t) { return t >= 1 ? 1 : Math.sqrt(1 - (1 - t) * (1 - t)); }
  // Distance euclidienne exacte de chaque pixel marqué au pixel non marqué le plus proche (Felzenszwalb et Huttenlocher)
  function edt(mask, W, H) {
    var N = Math.max(W, H), f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1), g = new Float32Array(W * H), INF = 1e20, x, y;
    function line(n) {
      var k = 0, q, s;
      v[0] = 0; z[0] = -INF; z[1] = INF;
      for (q = 1; q < n; q++) {
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      for (k = 0, q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    }
    for (x = 0; x < W; x++) { for (y = 0; y < H; y++) f[y] = mask[y * W + x] ? INF : 0; line(H); for (y = 0; y < H; y++) g[y * W + x] = d[y]; }
    for (y = 0; y < H; y++) { var o = y * W; for (x = 0; x < W; x++) f[x] = g[o + x]; line(W); for (x = 0; x < W; x++) g[o + x] = Math.sqrt(d[x]); }
    return g;
  }
  function boxBlur(src, W, H, r) {
    var tmp = new Float32Array(W * H), out = new Float32Array(W * H), n = 2 * r + 1, x, y, acc;
    for (y = 0; y < H; y++) {
      var o = y * W; acc = 0;
      for (x = -r; x <= r; x++) acc += src[o + clamp(x, 0, W - 1)];
      for (x = 0; x < W; x++) { tmp[o + x] = acc / n; acc += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; }
    }
    for (x = 0; x < W; x++) {
      acc = 0;
      for (y = -r; y <= r; y++) acc += tmp[clamp(y, 0, H - 1) * W + x];
      for (y = 0; y < H; y++) { out[y * W + x] = acc / n; acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; }
    }
    return out;
  }
  var LIN = new Float32Array(256), SRGB = new Uint8ClampedArray(4096);
  (function () {
    for (var i = 0; i < 256; i++) { var c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    for (var j = 0; j < 4096; j++) { var l = j / 4095; SRGB[j] = Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)); }
  })();
  function srgb(l) { return SRGB[l <= 0 ? 0 : l >= 1 ? 4095 : (l * 4095 + 0.5) | 0]; }
  function nrm(x, y, z) { var l = Math.sqrt(x * x + y * y + z * z); return [x / l, y / l, z / l]; }
  // La cuisson, en étapes courtes : elle avance pendant les temps morts, ou d'un trait si la scène en a besoin tout de suite
  function skinJob(c, col) {
    var m = c.model, f = m.f, s = f.s, r = clamp(c.dpr, 0.5, 1.5), bw = Math.max(2, Math.round(m.W * r)), bh = Math.max(2, Math.round(m.H * r)), N = bw * bh, S = s * r;
    var ch = col.ch, J = { key: col.key, i: 0, row: 0, bh: bh, done: false, out: null }, yOut = f.Y(OUTSOLE) * r, yCon = f.Y(CONTACT) * r;
    var cov, sole, upper, lin, pan, Du, Ds, Dg, F, Fb, Hh, top, sl, dimI, litI, seamM;
    function alpha(paint) {
      var x = canvas(bw, bh).getContext('2d', { willReadFrequently: true });
      x.setTransform(r, 0, 0, r, 0, 0); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round'; paint(x);
      var d = x.getImageData(0, 0, bw, bh).data, o = new Uint8Array(N);
      for (var i = 0; i < N; i++) o[i] = d[i * 4 + 3];
      return o;
    }
    // Lumières : clé en haut à gauche, rasante ; débouchage à droite ; reflet du sol sur les faces tournées vers le bas
    var glow = col.glow, L = nrm(-0.46, -0.8, 0.4), Lf = nrm(0.62, -0.12, 0.78), Hv = nrm(L[0], L[1], L[2] + 1);
    var AMB = glow ? 0.12 : 0.4, KEY = glow ? 1.08 : 0.72, FILL = glow ? 0.28 : 0.3, SPEC = glow ? 0.06 : 0.045, BOUNCE = glow ? 0.4 : 0.24;
    var alb = [LIN[ch.skin[0]], LIN[ch.skin[1]], LIN[ch.skin[2]]], flo = [LIN[ch.floor[0]], LIN[ch.floor[1]], LIN[ch.floor[2]]];
    J.steps = [
      function () {
        cov = alpha(function (x) { x.fill(m.outline); });
        var so = alpha(function (x) { x.fill(m.sole); }), li = alpha(function (x) { x.fill(shape(LINING, f)); }), pa = alpha(function (x) { x.fill(shape(PANELS, f)); });
        var se = alpha(function (x) { x.lineWidth = 1.1 * s; x.stroke(shape(SEAMS_UP, f)); });
        sole = new Uint8Array(N); upper = new Uint8Array(N); lin = new Uint8Array(N); seamM = new Uint8Array(N); pan = new Float32Array(N);
        for (var i = 0; i < N; i++) {
          var inn = cov[i] > 127;
          sole[i] = inn && so[i] > 127 ? 1 : 0;
          lin[i] = inn && !sole[i] && li[i] > 127 ? 1 : 0;
          upper[i] = inn && !sole[i] && !lin[i] ? 1 : 0;
          seamM[i] = se[i] > 100 ? 0 : 1;
          pan[i] = pa[i] / 255;
        }
        top = new Float32Array(bw); sl = new Float32Array(bw);
        for (var x = 0; x < bw; x++) { var y = 0; while (y < bh && cov[y * bw + x] <= 127) y++; top[x] = y; while (y < bh && !sole[y * bw + x]) y++; sl[x] = y; }
      },
      // Distances exactes au bord de la tige (l'ouverture du col en fait partie : le col s'y arrondit), de la semelle et des coutures
      function () { Du = edt(upper, bw, bh); },
      function () { Ds = edt(sole, bw, bh); },
      function () { Dg = edt(seamM, bw, bh); },
      function () {
        // Les fibres : tous les fils de la paire, tracés une fois à plat
        var x = canvas(bw, bh).getContext('2d', { willReadFrequently: true });
        x.setTransform(r, 0, 0, r, 0, 0); x.lineCap = 'round'; x.lineJoin = 'round'; x.globalCompositeOperation = 'lighter';
        Object.keys(m.groups).forEach(function (key) {
          var g = m.groups[key], st = STYLE[g.key][g.layer], p = new Path2D();
          g.list.forEach(function (a) { var n = a.length / 3; if (n > 1) appendPieces(p, a, 1, n - 1, n); });
          x.strokeStyle = 'rgba(255,255,255,' + (0.3 + 0.45 * st[1]).toFixed(2) + ')'; x.lineWidth = st[0] * m.styleScale; x.stroke(p);
        });
        var d = x.getImageData(0, 0, bw, bh).data;
        F = new Float32Array(N);
        for (var i = 0; i < N; i++) F[i] = d[i * 4] / 255;
      },
      function () { feltMap(m); },
      function () {
        // Le relief, en px de cuisson : biseaux de la tige (le col roulé compris) et de la semelle, léger galbe, pièces en surépaisseur
        // (bords adoucis), rainures des coutures et de la semelle d'usure, intérieur du col en retrait
        Hh = new Float32Array(N);
        var Ru = 6 * S, Rs = 2.6 * S, Rb = 42 * S, A = 10 * S, G = 0.5 * S, wg2 = 1.6 * S * 1.6 * S, up = 1.6 * S, P = 1.1 * S, Gs = 0.7 * S, ws2 = 0.75 * S * 0.75 * S;
        var panB = boxBlur(pan, bw, bh, Math.max(1, Math.round(0.9 * S))), dome = new Float32Array(N), y, x, i;
        for (y = 0; y < bh; y++) for (x = 0; x < bw; x++) {
          i = y * bw + x;
          if (sole[i]) Hh[i] = Rs * prof(Ds[i] / Rs) + up - Gs * Math.exp(-(y - yOut) * (y - yOut) / ws2) - (y > yOut ? 0.4 * S : 0);
          else if (lin[i]) Hh[i] = -1.5 * S;
          else if (upper[i]) {
            // Un bord arrondi serré, sur un galbe large et doux : la tige est bombée dans les deux sens
            var db = 1 - Math.min(1, Du[i] / Rb);
            dome[i] = A * (1 - db * db);
            Hh[i] = Ru * prof(Du[i] / Ru) + P * panB[i] - G * Math.exp(-Dg[i] * Dg[i] / wg2);
          }
        }
        // Le galbe, lissé large (trois flous de boîte, presque une gaussienne) : plus d'arête le long de l'axe médian de la forme
        var rd = Math.max(2, Math.round(7 * S));
        dome = boxBlur(boxBlur(boxBlur(dome, bw, bh, rd), bw, bh, rd), bw, bh, rd);
        for (i = 0; i < N; i++) if (upper[i]) Hh[i] += dome[i];
        Hh = boxBlur(Hh, bw, bh, Math.max(1, Math.round(r)));
        Fb = boxBlur(F, bw, bh, Math.max(1, Math.round(1.6 * r)));
        var Af = 0.16 * S;
        for (var j = 0; j < N; j++) if (cov[j]) Hh[j] += Af * Fb[j];
        dimI = new ImageData(bw, bh); litI = new ImageData(bw, bh);
      },
      'rows',
      function () {
        var dimC = canvas(bw, bh), litC = canvas(bw, bh), dx = dimC.getContext('2d'), lx = litC.getContext('2d');
        dx.putImageData(dimI, 0, 0); lx.putImageData(litI, 0, 0);
        fuzz(dx, lx);
        laces(dx, false); laces(lx, true);
        J.out = { dim: dimC, lit: litC, shadow: shadowOf(m, ch.shade), shadowN: shadowOf(m, ch.shadeN) };
        warm(c, m, ch, J.out);
        setTimeout(function () { prewarm(c, col); }, 0);
        dimI = litI = Hh = F = Fb = Du = Ds = Dg = cov = sole = upper = lin = pan = seamM = null;
      }
    ];
    // L'éclairage, par bandes de lignes
    J.rows = function (y0, y1) {
      var dd = dimI.data, ld = litI.data, nz = m.nz, nz2 = m.nz2;
      for (var y = y0; y < y1; y++) for (var x = 0; x < bw; x++) {
        var i = y * bw + x, a = cov[i];
        if (!a) continue;
        var nx = (Hh[x > 0 ? i - 1 : i] - Hh[x < bw - 1 ? i + 1 : i]) * 0.5, ny = (Hh[y > 0 ? i - bw : i] - Hh[y < bh - 1 ? i + bw : i]) * 0.5, nl = 1 / Math.sqrt(nx * nx + ny * ny + 1);
        nx *= nl; ny *= nl; var nzz = nl;
        var isSole = sole[i], isLin = lin[i], fib = Fb[i], o = i * 4, q;
        var mot = (1 + 0.035 * nz(x / (12 * S), y / (12 * S))) * (1 + 0.025 * nz2(x / (1.6 * S), y / (1.6 * S)));
        var ch2 = sl[x] - top[x], v = isSole ? 1 : ch2 > 0 ? clamp((y - top[x]) / ch2, 0, 1) : 0.5;
        // Occlusion : dans les rainures, sous la tige au-dessus de la semelle, au contact du sol, au fond de l'ouverture du col
        var ao = 1 - 0.1 * Math.exp(-Dg[i] * Dg[i] / (1.4 * S * 1.4 * S));
        if (isSole) ao *= (1 - 0.3 * Math.exp(-Math.max(0, yCon - y) / (1.4 * S))) * (1 - 0.35 * Math.exp(-(y - yOut) * (y - yOut) / (0.8 * S * 0.8 * S)));
        else if (!isLin) ao *= 1 - 0.45 * Math.exp(-Math.max(0, sl[x] - y) / (2.2 * S));
        var albK = (0.95 + 0.07 * fib) * mot * (isSole ? (y > yOut ? 0.86 : 0.95) : 1);
        if (isLin) {
          // L'intérieur : dans l'ombre du bord le plus proche ; le haut du bord opposé, roulé, accroche un filet de lumière
          var dl = clamp((y - top[x]) / (6 * S), 0, 1), lip = Math.exp(-(y - top[x]) / (0.9 * S)), sh = (1 - dl) * (1 - dl);
          var Li = glow ? 0.012 + 0.09 * sh + 0.55 * lip : 0.05 + 0.16 * sh + 0.5 * lip, Di = glow ? 0.1 + 0.18 * sh + 0.5 * lip : 0.45 + 0.2 * sh + 0.3 * lip;
          for (q = 0; q < 3; q++) { ld[o + q] = srgb(alb[q] * albK * Li); dd[o + q] = Math.min(255, ch.skin[q] * Di); }
          ld[o + 3] = dd[o + 3] = a;
          continue;
        }
        // Studio : clé enveloppante, débouchage, reflet du sol, brillance douce du feutre
        var dk = (nx * L[0] + ny * L[1] + nzz * L[2] + 0.22) / 1.22, df = nx * Lf[0] + ny * Lf[1] + nzz * Lf[2], hv = nx * Hv[0] + ny * Hv[1] + nzz * Hv[2];
        dk = dk > 0 ? dk : 0; df = df > 0 ? df : 0;
        // La lumière d'une boîte à lumière décroît un peu vers le bas et la pointe
        var fall = 1 - 0.16 * clamp(0.6 * x / bw + 0.4 * v, 0, 1);
        var Lt = (AMB + KEY * dk * fall + FILL * df) * ao, sp = hv > 0 ? Math.pow(hv, 26) * SPEC * ao : 0, bo = ny > 0 ? ny * BOUNCE * ao : 0;
        for (q = 0; q < 3; q++) ld[o + q] = srgb(alb[q] * albK * (Lt + flo[q] * bo) + sp);
        ld[o + 3] = a;
        // Chambre : fond noir (le feutre diffuse, ses bords davantage) ; plein jour : une lumière diffuse, plus forte par le haut
        var rim = Math.exp(-(isSole ? Ds[i] : Du[i]) / (3.4 * S)), Ld, mo = 1 + (mot - 1) * 0.4;
        if (glow) Ld = (0.8 + 0.2 * rim + 0.05 * fib + 0.05 * (1 - v)) * (0.82 + 0.18 * ao);
        else Ld = (0.93 + 0.1 * (1 - v) + 0.02 * fib) * (0.8 + 0.2 * ao);
        for (q = 0; q < 3; q++) dd[o + q] = Math.min(255, ch.skin[q] * Ld * mo);
        dd[o + 3] = a;
      }
    };
    // Les œillets et le lacet, dessinés en unités de la silhouette : un tube (son ombre portée sur le feutre, un bord sombre, le corps,
    // un reflet du côté de la lumière) ; des trous moulés au bord doux. Sous la lumière du studio, ou dans celle de la chambre.
    function laces(cx, lit) {
      var U = f.s * r, sk = ch.skin, hemp = [216, 206, 186];
      var tone = function (c, k) { return 'rgb(' + c.map(function (v) { return Math.round(Math.min(255, v * k)); }).join(',') + ')'; };
      var base = lit ? tone(hemp, glow ? 0.96 : 0.98) : tone(sk, glow ? 0.86 : 0.95), hi = lit ? tone(sk, 1.06) : tone(sk, glow ? 1.04 : 1.02);
      var lo = lit ? tone(hemp, 0.42) : tone(sk, glow ? 0.38 : 0.62), cast = lit ? 'rgba(40,32,24,0.22)' : (glow ? 'rgba(0,0,0,0.25)' : 'rgba(40,32,24,0.12)');
      cx.save(); cx.setTransform(U, 0, 0, U, f.X(0) * r, f.Y(0) * r); cx.lineCap = 'round'; cx.lineJoin = 'round';
      function tube(p, w) {
        cx.save(); cx.translate(0.55, 0.85); cx.strokeStyle = cast; cx.lineWidth = w + 0.6; cx.stroke(p); cx.restore();
        cx.strokeStyle = lo; cx.lineWidth = w + 0.5; cx.stroke(p);
        cx.strokeStyle = base; cx.lineWidth = w; cx.stroke(p);
        cx.save(); cx.translate(-0.22, -0.32); cx.strokeStyle = hi; cx.lineWidth = w * 0.32; cx.stroke(p); cx.restore();
      }
      // Les œillets : des trous dans le feutre, couchés dans la pente du cou-de-pied
      EYELETS.forEach(function (e) {
        var a = Math.atan2(instepY(e[0] + 2) - instepY(e[0] - 2), 4);
        cx.save(); cx.translate(e[0], e[1]); cx.rotate(a);
        cx.fillStyle = lo; cx.beginPath(); cx.ellipse(0, 0, 1.7, 1.3, 0, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = hi; cx.globalAlpha = 0.75; cx.lineWidth = 0.4; cx.beginPath(); cx.ellipse(0, 0.15, 1.95, 1.55, 0, 0.12 * Math.PI, 0.88 * Math.PI); cx.stroke(); cx.globalAlpha = 1;
        cx.restore();
      });
      // Un brin par œillet : il sort du trou et passe par-dessus la languette, vers le talon
      var st = new Path2D();
      EYELETS.forEach(function (e) { var tx = e[0] - 4.5, ty = instepY(tx) + 0.4; st.moveTo(e[0] - 0.2, e[1] - 0.6); st.quadraticCurveTo(e[0] - 1.2, (e[1] + ty) / 2 - 1.2, tx, ty); });
      tube(st, 1.8);
      // Le nœud : deux boucles qui se dressent au-dessus du cou-de-pied, deux bouts qui retombent, ferrés au bout
      var lp = new Path2D(); BOW.loops.forEach(function (d) { lp.addPath(new Path2D(d)); });
      tube(lp, 1.7);
      var en = new Path2D(); BOW.ends.forEach(function (d) { en.addPath(new Path2D(d)); });
      tube(en, 1.7);
      cx.fillStyle = lo; cx.beginPath(); cx.ellipse(BOW.knot[0], BOW.knot[1], 2.1, 1.7, -0.3, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = base; cx.beginPath(); cx.ellipse(BOW.knot[0] - 0.15, BOW.knot[1] - 0.2, 1.7, 1.3, -0.3, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = lo; cx.lineWidth = 2.1;
      cx.beginPath(); cx.moveTo(216.2, 75.2); cx.lineTo(215, 77); cx.moveTo(236.8, 74.5); cx.lineTo(238, 76); cx.stroke();
      cx.restore();
    }
    // Le duvet : de très courts fils qui dépassent du bord de la tige et accrochent la lumière
    function fuzz(dx, lx) {
      var R = prng(f.s * 1000 | 0), lim = f.Y(CONTACT - 58) * r, out = [];
      for (var y = 1; y < bh - 1; y++) for (var x = 1; x < bw - 1; x++) {
        var i = y * bw + x;
        if (!upper[i] || y > lim || (cov[i - 1] > 127 && cov[i + 1] > 127 && cov[i - bw] > 127 && cov[i + bw] > 127)) continue;
        if (R() > 0.4 / Math.max(1, r)) continue;
        var gx = Du[i + 1] - Du[i - 1], gy = Du[i + bw] - Du[i - bw], gl = Math.sqrt(gx * gx + gy * gy) || 1;
        out.push([x, y, -gx / gl, -gy / gl]);
      }
      [dx, lx].forEach(function (cx, li) {
        cx.lineCap = 'round'; cx.lineWidth = 0.5 * r;
        out.forEach(function (p) {
          var an = Math.atan2(p[3], p[2]) + (R() - 0.5) * 1.3, len = (0.35 + R() * 1.1) * S, cu = (R() - 0.5) * 0.9;
          var ex = p[0] + Math.cos(an) * len, ey = p[1] + Math.sin(an) * len, mx = p[0] + Math.cos(an + cu) * len * 0.55, my = p[1] + Math.sin(an + cu) * len * 0.55;
          var lit = li ? 0.45 + 0.75 * Math.max(0, -(Math.cos(an) * 0.5 + Math.sin(an) * 0.86)) : 0.85;
          var al = li ? (glow ? 0.55 : 0.35) : (glow ? 0.42 : 0.25), cc = glow || li ? ch.skin.map(function (v) { return Math.round(Math.min(255, v * lit)); }) : ch.skin;
          cx.strokeStyle = 'rgba(' + cc[0] + ',' + cc[1] + ',' + cc[2] + ',' + al + ')';
          cx.beginPath(); cx.moveTo(p[0], p[1]); cx.quadraticCurveTo(mx, my, ex, ey); cx.stroke();
        });
      });
    }
    return J;
  }
  // L'ombre de contact : une ellipse douce, plus une ligne serrée là où la semelle touche le sol (à mi-résolution, sans filtre)
  function shadowOf(m, color) {
    var f = m.f, s = f.s, w = Math.max(2, Math.round(m.W / 2)), h = Math.max(2, Math.round(m.H / 2)), x = canvas(w, h).getContext('2d');
    x.setTransform(0.5, 0, 0, 0.5, 0, 0); x.fillStyle = color;
    var cy = f.Y(CONTACT), x0 = f.X(24), x1 = f.X(392), i, t;
    for (i = 0; i < 16; i++) { t = i / 15; x.globalAlpha = 0.05; x.beginPath(); x.ellipse((x0 + x1) / 2 + 5 * s, cy + 1.6 * s, (x1 - x0) / 2 * (1.08 - 0.15 * t), (11 - 9.4 * t) * s, 0, 0, Math.PI * 2); x.fill(); }
    x0 = f.X(46); x1 = f.X(344);
    for (i = 0; i < 6; i++) { x.globalAlpha = 0.1; x.beginPath(); x.ellipse((x0 + x1) / 2, cy + 0.4 * s, (x1 - x0) / 2 * (1.03 - 0.035 * i), (2.6 - 0.36 * i) * s, 0, 0, Math.PI * 2); x.fill(); }
    return x.canvas;
  }
  // Les modes de composition de la scène (multiplication découpée, masques, dégradé) servent une première fois hors écran, pendant un
  // temps mort : le navigateur prépare ses programmes de dessin avant que la teinture ou la lumière n'arrivent sous les yeux
  function warm(c, m, ch, sk) {
    var x = m.work || (m.work = layer2d(m.W, m.H, c.dpr)), g = x.createLinearGradient(0, 0, m.W, m.H);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    wipe(x); x.drawImage(sk.dim, 0, 0, m.W, m.H); dyeShoe(x, m, ch, 0.5);
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, m.W, m.H);
    x.globalCompositeOperation = 'destination-over'; x.globalAlpha = 0.5; x.drawImage(sk.shadow, 0, 0, m.W, m.H);
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    canvas(1, 1).getContext('2d').drawImage(x.canvas, 0, 0, 1, 1);
    wipe(x);
  }
  // Puis une image cachée de la fin (feutre, teinture, lumière, ombre) sur le canvas même, aussitôt remplacée par l'instant courant :
  // ses ressources de dessin (découpes, mélanges) sont prêtes avant que la scène n'y arrive. Les fils n'y sont pas touchés.
  function prewarm(c, col) {
    var el = c.el;
    if (!el || !c.model || !c.model.job || !c.model.job.done || c.model.warmed) return;
    c.model.warmed = true;
    // Le navigateur abandonne les dessins qu'un effacement complet recouvre : chaque image cachée est donc lue (copiée dans un pixel)
    // avant la suivante, pour qu'elle soit vraiment tracée
    var ctx = el.getContext('2d'), k0 = c.k, sink = canvas(1, 1).getContext('2d');
    ctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);
    [0.84, 0.95].forEach(function (k) { c.k = k; renderChamber(c, ctx, col); sink.drawImage(el, 0, 0, 1, 1); });
    c.k = k0; renderChamber(c, ctx, col);
  }
  function runJob(J, budget) {
    var t0 = performance.now();
    while (!J.done && performance.now() - t0 < budget) {
      var st = J.steps[J.i];
      if (st === 'rows') { var y1 = Math.min(J.bh, J.row + 16); J.rows(J.row, y1); J.row = y1; if (J.row >= J.bh) J.i++; }
      else { st(); J.i++; }
      if (J.i >= J.steps.length) J.done = true;
    }
  }
  // La peau de la scène : cuite pendant les temps morts dès que le modèle existe, ou tout de suite si la scène en a besoin
  function skinOf(c, col, now) {
    var m = c.model, J = m.job;
    if (!J || J.key !== col.key) {
      J = m.job = skinJob(c, col);
      var idle = root.requestIdleCallback ? function (fn) { root.requestIdleCallback(fn, { timeout: 400 }); } : function (fn) { setTimeout(function () { fn(null); }, 30); };
      var tick = function (dl) { if (J.done || m.job !== J) return; runJob(J, dl && dl.timeRemaining ? clamp(dl.timeRemaining(), 4, 14) : 8); if (!J.done) idle(tick); };
      idle(tick);
    }
    if (!J.done && now) runJob(J, Infinity);
    return J.done ? J.out : null;
  }

  // Le feutre qui se referme : les fils s'épaississent jusqu'à se rejoindre, et les plus grandes mailles se ferment en dernier.
  // Chaque point a son heure : sa distance au fil le plus proche, rapportée à la plus grande maille, avancée ou retardée par un
  // bruit doux. La carte est faite une fois (à mi-résolution) ; chaque image n'en fait qu'un seuil, lissé par l'agrandissement.
  function feltMap(m) {
    if (m.feltT) return;
    var q = 0.5, mw = Math.max(2, Math.ceil(m.W * q)), mh = Math.max(2, Math.ceil(m.H * q)), n = mw * mh, s = m.f.s, i, x, y;
    var cx = canvas(mw, mh).getContext('2d', { willReadFrequently: true });
    cx.setTransform(q, 0, 0, q, 0, 0); cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#fff';
    Object.keys(m.groups).forEach(function (key) {
      var g = m.groups[key], p = new Path2D();
      g.list.forEach(function (a) { var k = a.length / 3; if (k > 1) appendPieces(p, a, 1, k - 1, k); });
      cx.lineWidth = Math.max(1 / q, STYLE[g.key][g.layer][0] * m.styleScale); cx.stroke(p);
    });
    var d = cx.getImageData(0, 0, mw, mh).data, gaps = new Uint8Array(n);
    for (i = 0; i < n; i++) gaps[i] = d[i * 4 + 3] > 60 ? 0 : 1;
    var D = edt(gaps, mw, mh), W = Math.ceil(m.W), hi = 0, T = new Float32Array(n);
    for (y = 0; y < mh; y++) for (x = 0; x < mw; x++) {
      i = y * mw + x;
      if (D[i] > hi && m.Din[clamp((y / q) | 0, 0, m.H - 1) * W + clamp((x / q) | 0, 0, W - 1)] > 0) hi = D[i];
    }
    for (y = 0; y < mh; y++) for (x = 0; x < mw; x++) {
      i = y * mw + x;
      T[i] = clamp(D[i] / Math.max(1, hi) * (0.8 + 0.3 * m.nz(x / (9 * s * q), y / (9 * s * q))), 0, 1) * 0.9;
    }
    // Une maille ne se ferme pas beaucoup plus tard que son voisinage : pas de trou isolé qui traîne
    var Tb = boxBlur(T, mw, mh, Math.max(2, Math.round(6 * s * q)));
    for (i = 0; i < n; i++) T[i] = Math.min(T[i], Tb[i] + 0.1);
    cx.setTransform(1, 0, 0, 1, 0, 0);
    m.feltT = T; m.feltX = cx; m.feltI = cx.createImageData(mw, mh);
    for (i = 0; i < n; i++) m.feltI.data[i * 4] = m.feltI.data[i * 4 + 1] = m.feltI.data[i * 4 + 2] = 255;
  }
  function feltMask(m, p) {
    feltMap(m);
    var d = m.feltI.data, T = m.feltT, n = T.length, i;
    for (i = 0; i < n; i++) { var a = (p - T[i]) * 9 + 0.5; d[i * 4 + 3] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255; }
    m.feltX.putImageData(m.feltI, 0, 0);
    return m.feltX.canvas;
  }
  // La teinture : un front qui monte depuis le sol, vite d'abord puis de plus en plus lentement (comme une encre par capillarité),
  // effrangé en doigts ; quelques doigts, plus pâles, courent devant. kf : l'ampleur des doigts (1 pour le front franc).
  function dyeRise(p) { return 42 * (1 - (1 - p) * (1 - p)); }
  function dyeFront(m, p, lead) {
    var f = m.f, s = f.s, rise = dyeRise(p) + (lead || 0), amp = 5.5 * smooth(0, 0.6, p), x0 = f.X(6), x1 = f.X(400), n = Math.max(32, Math.round((x1 - x0) / 2.5)), pts = [];
    for (var i = 0; i <= n; i++) {
      var x = x0 + (x1 - x0) * i / n, u = (x - f.X(0)) / s;
      // Des lobes doux, comme le bord d'une tache d'encre dans un tissu
      var fr = amp * (0.5 + 0.55 * m.nz(u / 34, 1.7) + 0.35 * m.nz2(u / 11, 3.3) + 0.12 * m.nz(u / 3.6 + 40, 8.5));
      pts.push(x, f.Y(CONTACT - rise - fr));
    }
    return pts;
  }
  function dyeShoe(ctx, m, ch, p) {
    var f = m.f, yb = f.Y(CONTACT + 6), main = dyeFront(m, p), halo = dyeFront(m, p, 1.1), area = new Path2D(), soft = new Path2D(), line = new Path2D(), i;
    area.moveTo(main[0], yb); soft.moveTo(halo[0], yb);
    for (i = 0; i < main.length; i += 2) { area.lineTo(main[i], main[i + 1]); soft.lineTo(halo[i], halo[i + 1]); if (i) line.lineTo(main[i], main[i + 1]); else line.moveTo(main[i], main[i + 1]); }
    area.lineTo(main[main.length - 2], yb); area.closePath(); soft.lineTo(halo[halo.length - 2], yb); soft.closePath();
    // Un peu plus soutenue au pied, là où la teinture est entrée d'abord ; une ligne de marée un peu plus sombre au front
    var gr = ctx.createLinearGradient(0, f.Y(CONTACT), 0, f.Y(CONTACT - dyeRise(p) - 4));
    gr.addColorStop(0, ch.dyeLow); gr.addColorStop(1, ch.dye);
    ctx.save(); ctx.clip(m.outline); ctx.globalCompositeOperation = 'multiply';
    // Le bord du front, à peine fondu : la teinture gagne le feutre fibre à fibre
    ctx.globalAlpha = 0.3; ctx.fillStyle = ch.dye; ctx.fill(soft); ctx.globalAlpha = 1;
    ctx.fillStyle = gr; ctx.fill(area);
    ctx.save(); ctx.clip(m.sole); ctx.fillStyle = ch.dyeDeep; ctx.fill(area); ctx.restore();
    ctx.strokeStyle = ch.tide; ctx.lineWidth = 1.3 * m.styleScale; ctx.globalAlpha = 0.32; ctx.stroke(line);
    ctx.restore();
  }
  // Les fils aériens à l'instant t de leur pousse (ils rentrent quand t redescend)
  function drawAir(ctx, m, col, t) {
    var ta = 0.7 + 0.28 * t;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    m.aerial.forEach(function (g) {
      var st = STYLE.aerial[g.layer], p = new Path2D(), any = false;
      g.list.forEach(function (a) {
        var n = a.length / 3, mv = visible(a, ta), ex = null, ey = null;
        if (mv < 1) return;
        if (mv < n) { var t0 = a[(mv - 1) * 3 + 2], t1 = a[mv * 3 + 2], fr = t1 > t0 ? (ta - t0) / (t1 - t0) : 1; ex = a[(mv - 1) * 3] + (a[mv * 3] - a[(mv - 1) * 3]) * fr; ey = a[(mv - 1) * 3 + 1] + (a[mv * 3 + 1] - a[(mv - 1) * 3 + 1]) * fr; }
        if (mv < 2 && ex == null) return;
        appendSpan(p, a, 0, mv - 1, mv, ex, ey); any = true;
      });
      if (any) { ctx.strokeStyle = rgba(col.graphic, st[1] * 1.15); ctx.lineWidth = st[0] * m.styleScale; ctx.stroke(p); }
    });
  }
  function drawSeeds(ctx, m, col, P) {
    var n = m.seeds.length, shown = P.seeds * (n + 3), pr = 1.7 * m.styleScale, p = new Path2D();
    for (var i = 0; i < n; i++) {
      var a = clamp((shown - i) / 3, 0, 1), q = m.seeds[i];
      if (a <= 0) break;
      var rr = pr * easeOut(a);
      p.moveTo(q[0] + rr, q[1]); p.arc(q[0], q[1], rr, 0, Math.PI * 2);
    }
    ctx.fillStyle = col.fresh; ctx.globalAlpha = P.seedFade; ctx.fill(p); ctx.globalAlpha = 1;
  }
  // Le moule, dessiné comme une coupe : un bloc hachuré, son creux au profil de la paire. Calque cuit une fois par couleurs.
  function moldLayer(c, m, col) {
    if (m.moldL && m.moldL.key === col.key) return m.moldL.c;
    var ch = col.ch, x = layer2d(m.W, m.H, c.dpr), body = new Path2D(), s = m.f.s, sp = clamp(7 * s / 2.8, 4, 9), W = m.W, H = m.H;
    body.addPath(m.mold); body.addPath(m.outline);
    x.fillStyle = ch.mold; x.fill(body, 'evenodd');
    x.save(); x.clip(body, 'evenodd'); x.beginPath();
    for (var t = -H; t < W; t += sp) { x.moveTo(t, H); x.lineTo(t + H, 0); }
    x.strokeStyle = ch.hatch; x.lineWidth = 1; x.stroke(); x.restore();
    x.lineWidth = 1; x.strokeStyle = ch.moldLine; x.stroke(m.mold);
    x.strokeStyle = ch.cavity; x.stroke(m.outline);
    m.moldL = { key: col.key, c: x.canvas };
    return x.canvas;
  }
  // Le moule se lève : lentement d'abord (il se décolle), puis il s'en va en s'effaçant, derrière la paire qui tient seule
  function drawMold(ctx, c, m, col, q) {
    var al = 1 - span(0.3, 1, q);
    if (al <= 0) return;
    var mc = moldLayer(c, m, col), dy = -q * q * 44 * m.f.s;
    ctx.save();
    if (q > 0) { var cl = new Path2D(); cl.rect(0, 0, m.W, m.H); cl.addPath(m.outline); ctx.clip(cl, 'evenodd'); }
    ctx.globalAlpha = al; ctx.drawImage(mc, 0, dy, m.W, m.H);
    ctx.restore();
  }
  function renderChamber(c, ctx, col) {
    var m = c.model, w = m.W, h = m.H, P = chamberPhase(c.k), ch = col.ch, sk = skinOf(c, col, P.haze > 0);
    // 1. Les fils, jusqu'à ce que le feutre les recouvre entièrement
    if (P.felt < 1 || !sk) threads(c, ctx, col, P.tk, 0, c.live && P.tk > 0 && P.tk < 1, false);
    else ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // 2. Le feutre : les fils s'épaississent, cotonneux, pendant qu'ils remplissent le moule (jours 4 et 5), puis se rejoignent en une
    // peau fermée (jour 7) ; enfin la lumière du studio remplace celle de la chambre
    if (P.haze > 0 && sk) {
      if (P.felt < 1) {
        var wc = m.work || (m.work = layer2d(w, h, c.dpr));
        wipe(wc); wc.globalCompositeOperation = 'source-over'; wc.drawImage(sk.dim, 0, 0, w, h);
        wc.globalCompositeOperation = 'destination-in'; wc.drawImage(feltMask(m, 0.4 * P.haze + 0.6 * P.felt), 0, 0, w, h); wc.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.2 * P.haze + 0.8 * P.felt; ctx.drawImage(wc.canvas, 0, 0, w, h); ctx.globalAlpha = 1;
      } else if (P.light <= 0) ctx.drawImage(sk.dim, 0, 0, w, h);
      else if (P.light >= 1) ctx.drawImage(sk.lit, 0, 0, w, h);
      else {
        // La lumière s'allume : elle arrive d'en haut à gauche et gagne la paire jusqu'à la pointe
        var lc = m.work || (m.work = layer2d(w, h, c.dpr)), f = m.f, band = 0.45, t = P.light * (1 + band) - band;
        var g = lc.createLinearGradient(f.X(0), f.Y(40), f.X(400), f.Y(190));
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(clamp(t, 0, 1), 'rgba(0,0,0,1)'); g.addColorStop(clamp(t + band, 0, 1), 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.drawImage(sk.dim, 0, 0, w, h);
        wipe(lc); lc.globalCompositeOperation = 'source-over'; lc.drawImage(sk.lit, 0, 0, w, h);
        lc.globalCompositeOperation = 'destination-in'; lc.fillStyle = g; lc.fillRect(0, 0, w, h); lc.globalCompositeOperation = 'source-over';
        ctx.drawImage(lc.canvas, 0, 0, w, h);
      }
    }
    // 3. La teinture monte depuis la semelle
    if (P.dye > 0 && sk) dyeShoe(ctx, m, ch, P.dye);
    // 4. Les fils aériens, 5. le semis, 6. le moule
    if (P.air > 0) drawAir(ctx, m, col, P.air);
    if (P.seeds > 0 && P.seedFade > 0) drawSeeds(ctx, m, col, P);
    if (P.lift < 1) drawMold(ctx, c, m, col, P.lift);
    // 7. L'ombre de contact, sous la paire, avec la lumière ; en plein jour, la pièce est déjà éclairée : une ombre douce dès le feutre
    // Sa couleur suit le sol : neutre sur le sol nu, dans le ton profond de la souche sur la teinture
    var sh = col.glow ? P.light : Math.max(0.55 * P.felt, P.light);
    if (sh > 0 && sk) {
      ctx.globalCompositeOperation = 'destination-over';
      if (P.floor > 0) { ctx.globalAlpha = sh * P.floor; ctx.drawImage(sk.shadow, 0, 0, w, h); }
      if (P.floor < 1) { ctx.globalAlpha = sh * (1 - P.floor); ctx.drawImage(sk.shadowN, 0, 0, w, h); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ---------- La marque : un H vectoriel ----------
  function cubic(p0, p1, p2, p3) { return function (t) { var u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; }; }
  function quad(p0, p1, p2) { return function (t) { var u = 1 - t; return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]; }; }
  function sample(fn, n) { var pts = []; for (var i = 0; i <= n; i++) pts.push(fn(i / n)); return pts; }
  // Contour d'un trait à épaisseur variable, tracé jusqu'à prog (0 à 1), aux extrémités arrondies : une liste de points
  function ribbon(pts, wf, prog) {
    if (prog <= 0) return null;
    var n = pts.length - 1, m = prog * n, mi = Math.floor(m), fr = m - mi, P = pts.slice(0, mi + 1), i, j;
    if (mi < n && fr > 1e-4) { var a = pts[mi], b = pts[mi + 1]; P.push([a[0] + (b[0] - a[0]) * fr, a[1] + (b[1] - a[1]) * fr]); }
    if (P.length < 2) return null;
    var L = [], Rt = [], k = P.length, last = 0, first = 0, wl = 0, w0 = 0;
    for (i = 0; i < k; i++) {
      var p0 = P[Math.max(0, i - 1)], p1 = P[Math.min(k - 1, i + 1)], tx = p1[0] - p0[0], ty = p1[1] - p0[1], l = Math.sqrt(tx * tx + ty * ty) || 1;
      var nx = -ty / l, ny = tx / l, w = wf((i / (k - 1)) * prog) / 2 * smooth(0, 0.14, prog);
      L.push([P[i][0] + nx * w, P[i][1] + ny * w]); Rt.push([P[i][0] - nx * w, P[i][1] - ny * w]);
      if (i === 0) { first = Math.atan2(ny, nx); w0 = w; }
      if (i === k - 1) { last = Math.atan2(ny, nx); wl = w; }
    }
    var out = L.slice(), e = P[k - 1], s0 = P[0];
    for (j = 1; j < 10; j++) { var ae = last - Math.PI * j / 10; out.push([e[0] + Math.cos(ae) * wl, e[1] + Math.sin(ae) * wl]); }
    for (i = k - 1; i >= 0; i--) out.push(Rt[i]);
    for (j = 1; j < 10; j++) { var as = first + Math.PI - Math.PI * j / 10; out.push([s0[0] + Math.cos(as) * w0, s0[1] + Math.sin(as) * w0]); }
    return out;
  }
  function markModel(S, seed, bare) {
    var R = prng(seed * 23 + 9), W = bare ? Math.max(1.6, S * 0.078) : Math.max(1.8, S * 0.03);
    var xl = S * 0.31, xr = S * 0.69, yt = S * 0.12, yb = S * 0.88, Hh = yb - yt, ym = S * (0.47 + (R() - 0.5) * 0.05), amp = bare ? 0.006 : 0.05;
    // Un fût : une S très légère, plus épaisse à la base, d'où l'hyphe est parti
    function stem(x) {
      var dir = R() < 0.5 ? 1 : -1, a1 = (0.5 + R() * 0.5) * amp * S * dir, a2 = -(0.5 + R() * 0.5) * amp * S * dir * 0.8, top = (R() - 0.5) * amp * S * 0.5;
      return cubic([x, yb], [x + a1, yb - Hh * 0.36], [x + a2, yb - Hh * 0.7], [x + top, yt]);
    }
    function atY(fn, y) { var best = 0, bd = 1e9; for (var i = 0; i <= 240; i++) { var dd = Math.abs(fn(i / 240)[1] - y); if (dd < bd) { bd = dd; best = i / 240; } } return best; }
    var sl = stem(xl), sr = stem(xr), ul = atY(sl, ym), ur = atY(sr, ym), pl = sl(ul), pr = sr(ur);
    var meet = [(pl[0] + pr[0]) / 2 + (R() - 0.5) * S * 0.01, ym + (R() - 0.5) * S * 0.01], arch = (R() - 0.5) * S * (bare ? 0.003 : 0.018);
    var bl = quad(pl, [(pl[0] + meet[0]) / 2, (pl[1] + meet[1]) / 2 + arch], meet), br = quad(pr, [(pr[0] + meet[0]) / 2, (pr[1] + meet[1]) / 2 + arch], meet);
    var stemW = bare ? function () { return W; } : function (u) { return W * (1.12 - 0.5 * Math.pow(u, 1.4)); };
    var barW = function (u) { return W * (0.76 + 0.2 * u * u); };
    var els = [
      { pts: sample(sl, 56), w: stemW, t0: 0, t1: 0.5 },
      { pts: sample(sr, 56), w: stemW, t0: 0.05, t1: 0.55 },
      { pts: sample(bl, 28), w: barW, t0: 0.44, t1: 0.76 },
      { pts: sample(br, 28), w: barW, t0: 0.47, t1: 0.76 }
    ];
    var knot = { x: meet[0], y: meet[1], rx: W * (bare ? 0.52 : 0.7), ry: W * (bare ? 0.48 : 0.58), a: Math.atan2(pr[1] - pl[1], pr[0] - pl[0]), t0: 0.74, t1: 0.88 };
    if (!bare) {
      var n = 10 + Math.floor(R() * 7), cx = S / 2;
      for (var k = 0; k < n; k++) {
        var right = R() < 0.5, fn = right ? sr : sl, u = 0.06 + R() * 0.88, P = fn(u);
        if (Math.abs(P[1] - ym) < S * 0.08) continue;
        var P2 = fn(Math.min(1, u + 0.01)), tx = P2[0] - P[0], ty = P2[1] - P[1], tl = Math.sqrt(tx * tx + ty * ty) || 1; tx /= tl; ty /= tl;
        var out = (P[0] < cx ? -1 : 1), side = R() < 0.75 ? out : -out, len = S * (0.05 + R() * 0.11) * (u > 0.7 ? 1.1 : 1);
        var rot = function (ax, ay, an) { return [ax * Math.cos(an) - ay * Math.sin(an), ax * Math.sin(an) + ay * Math.cos(an)]; };
        // Le poil part dans l'axe du fût, s'en écarte, puis se recourbe un peu vers le haut
        var d1 = rot(tx, ty, side * (0.32 + R() * 0.28)), d2 = rot(d1[0], d1[1], side * (0.3 + R() * 0.4));
        var p1 = [P[0] + tx * len * 0.3, P[1] + ty * len * 0.3], p2 = [P[0] + d1[0] * len * 0.68, P[1] + d1[1] * len * 0.68], p3 = [P[0] + d2[0] * len, P[1] + d2[1] * len - len * 0.12];
        var st = (right ? 0.05 : 0) + u * 0.5 + 0.03 + R() * 0.06, hc = cubic(P, p1, p2, p3);
        els.push({ pts: sample(hc, 18), w: function (q) { return Math.max(0.25, W * 0.3 * Math.pow(1 - q, 0.85)); }, t0: st, t1: Math.min(0.98, st + 0.12 + R() * 0.1) });
        if (R() < 0.35) {
          var q0 = 0.45 + R() * 0.15, m0 = hc(q0), m1 = hc(q0 + 0.02), sx = m1[0] - m0[0], sy = m1[1] - m0[1], sll = Math.sqrt(sx * sx + sy * sy) || 1;
          var sd = rot(sx / sll, sy / sll, side * (0.4 + R() * 0.3)), sl2 = len * (0.32 + R() * 0.16), sst = st + 0.07;
          els.push({ pts: sample(quad(m0, [m0[0] + sd[0] * sl2 * 0.55, m0[1] + sd[1] * sl2 * 0.55], [m0[0] + sd[0] * sl2, m0[1] + sd[1] * sl2 - sl2 * 0.15]), 12),
            w: function (q) { return Math.max(0.2, W * 0.19 * Math.pow(1 - q, 0.85)); }, t0: sst, t1: Math.min(1, sst + 0.1) });
        }
      }
    }
    return { S: S, els: els, knot: knot };
  }
  function polyPath(pts, p) { p.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); }
  function renderMark(c, ctx, col) {
    var m = c.model, t = c.k, p = new Path2D();
    ctx.clearRect(0, 0, m.W, m.H);
    ctx.save(); ctx.translate((m.W - m.S) / 2, (m.H - m.S) / 2);
    m.els.forEach(function (e) {
      var q = clamp((t - e.t0) / (e.t1 - e.t0), 0, 1); if (q <= 0) return;
      var r = ribbon(e.pts, e.w, easeGrow(q)); if (r) polyPath(r, p);
    });
    ctx.fillStyle = col.graphic; ctx.fill(p, 'nonzero');
    var kq = clamp((t - m.knot.t0) / (m.knot.t1 - m.knot.t0), 0, 1);
    if (kq > 0) { var s = easeOut(kq), kp = new Path2D(); kp.ellipse(m.knot.x, m.knot.y, m.knot.rx * s, m.knot.ry * s, m.knot.a, 0, Math.PI * 2); ctx.fill(kp); }
    ctx.restore();
  }
  function markSVG(seed, size, color, bare) {
    var m = markModel(size, seed, !!bare), r2 = function (v) { return Math.round(v * 100) / 100; }, d = '', k = m.knot;
    m.els.forEach(function (e) { var pts = ribbon(e.pts, e.w, 1); if (pts) d += 'M' + pts.map(function (q) { return r2(q[0]) + ' ' + r2(q[1]); }).join('L') + 'Z'; });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '"><title>HYPHA, pair ' + String(seed).padStart(4, '0') + '</title>' +
      '<g fill="' + (color || '#EDE9E1') + '"><path d="' + d + '"/><ellipse cx="' + r2(k.x) + '" cy="' + r2(k.y) + '" rx="' + r2(k.rx) + '" ry="' + r2(k.ry) + '" transform="rotate(' + r2(k.a * 180 / Math.PI) + ' ' + r2(k.x) + ' ' + r2(k.y) + ')"/></g></svg>';
  }

  // ---------- Pilotage des canvas ----------
  var SCENES = {
    shoe: { build: shoeModel, render: renderThreads },
    chamber: { build: chamberModel, render: renderChamber },
    texture: { build: textureModel, render: renderThreads },
    mark: { build: function (w, h, seed, el) { var S = Math.min(w, h), m = markModel(S, seed, el.hasAttribute('data-hy-bare') || S < 48); m.W = w; m.H = h; return m; }, render: renderMark }
  };
  // La marque peut venir de brand/mark.js (window.HyphaMark) : s'il fournit une scène, un SVG ou une durée, ils remplacent ceux d'ici
  function delegate() { var M = root.HyphaMark; return M && M.scene ? M : null; }
  function sceneOf(el) { var n = el.getAttribute('data-hy-scene'); return n === 'mark' && delegate() ? delegate().scene : SCENES[n]; }
  function ctl(el) {
    if (!el.__hy) { var k0 = parseFloat(el.getAttribute('data-hy-k')); el.__hy = { k: isFinite(k0) ? clamp(k0, 0, 1) : 1, live: false, key: '', raf: 0, pending: 0 }; }
    return el.__hy;
  }
  // Couleur du fond derrière le canvas : celle du premier ancêtre au fond opaque
  function backdrop(el) {
    for (var e = el.parentElement; e; e = e.parentElement) {
      var v = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(getComputedStyle(e).backgroundColor);
      if (v && (v[4] == null || +v[4] >= 0.99)) return [+v[1], +v[2], +v[3]];
    }
    return null;
  }
  function colors(el) {
    var cs = getComputedStyle(el), g = cs.getPropertyValue('--hy-color-graphic').trim(), a = cs.getPropertyValue('--hy-color-accent-graphic').trim();
    var ok = function (v, d) { return /^#[0-9a-f]{6}$/i.test(v) ? v : d; };
    var gr = ok(g, '#EDE9E1'), n = parseInt(gr.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255, light = (r * 299 + gg * 587 + b * 114) / 1000 > 128;
    var mix = function (v) { return Math.round(light ? v + (255 - v) * 0.65 : v * 0.5); }, hx = function (v) { return ('0' + v.toString(16)).slice(-2); };
    var bg = backdrop(el) || hexRgb(ok(cs.getPropertyValue('--hy-color-bg').trim(), light ? '#110F0D' : '#F4F1EB')), ac = ok(a, gr);
    var out = { graphic: gr, accent: ac, fresh: '#' + hx(mix(r)) + hx(mix(gg)) + hx(mix(b)), bg: bg, glow: light, key: gr + ac + bg.join(',') };
    // La chambre : le moule (surface et filets), la peau (le mycélium naturel), la teinture et le sol (l'aplat de la souche)
    if (el.getAttribute('data-hy-scene') === 'chamber') {
      var v = function (n, d) { return ok(cs.getPropertyValue(n).trim(), d); };
      var surf = v('--hy-color-surface', light ? '#1D1A17' : '#F9F6F1'), bs = hexRgb(v('--hy-color-border-strong', light ? '#898279' : '#6B655D'));
      var apl = v('--hy-color-accent', ac), A = hexRgb(apl), A2 = A.map(function (u) { return u * u / 255; });
      out.ch = { mold: surf, hatch: cssRgb(mixRgb(hexRgb(surf), bs, light ? 0.2 : 0.28)), moldLine: cssRgb(mixRgb(bg, bs, light ? 0.42 : 0.5)), cavity: cssRgb(mixRgb(bg, bs, light ? 0.8 : 0.85)),
        // Le mycélium naturel ; en plein jour, le plus clair des neutres, pour que la paire reste plus blanche que le mur
        skin: hexRgb(light ? v('--hy-palette-myc-100', '#EDE9E1') : v('--hy-palette-myc-50', '#F9F6F1')), floor: A, dye: apl, dyeLow: cssRgb(mixRgb(A, A2, 0.18)), dyeDeep: cssRgb(mixRgb([255, 255, 255], A, 0.28)), tide: cssRgb(A2), shade: cssRgb(mixRgb(A2, [0, 0, 0], 0.45)), shadeN: 'rgb(60,52,44)' };
      out.key += surf + apl;
    }
    return out;
  }
  function ensure(el) {
    var c = ctl(el), w = el.clientWidth, h = el.clientHeight;
    c.el = el;
    if (!w || !h) return null;
    // data-hy-dpr plafonne la résolution (une page montrée réduite, comme dans l'atelier de Clover, n'a pas besoin de plus)
    var seed = +el.getAttribute('data-hy-seed') || 412, dpr = Math.min(2, root.devicePixelRatio || 1), cap = parseFloat(el.getAttribute('data-hy-dpr'));
    if (cap > 0) dpr = clamp(Math.min(dpr, cap), 0.25, 2);
    var key = [w, h, seed, el.getAttribute('data-hy-layout') || '', el.hasAttribute('data-hy-bare') ? 1 : 0, getComputedStyle(el).position, dpr, delegate() ? 1 : 0].join(':');
    if (c.key !== key) {
      c.model = sceneOf(el).build(w, h, seed, el);
      c.key = key; c.dpr = dpr; c.acc = null;
      el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
    }
    return c;
  }
  function draw(el) {
    var c = ensure(el); if (!c) return;
    var ctx = el.getContext('2d'); ctx.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);
    sceneOf(el).render(c, ctx, c.col || (c.col = colors(el)));
  }
  function duration(el) {
    if (el.getAttribute('data-hy-scene') === 'mark' && delegate() && delegate().duration > 1) return delegate().duration;
    var v = parseFloat(el.getAttribute('data-hy-duration')) || parseFloat(getComputedStyle(el).getPropertyValue('--hy-duration-grow'));
    return isFinite(v) && v > 1 ? v : 2600;
  }
  function play(el, opts) {
    opts = opts || {};
    var c = ensure(el); if (!c) return;
    cancelAnimationFrame(c.raf);
    c.col = colors(el);
    if (reduced()) { c.k = 1; c.live = false; draw(el); if (opts.done) opts.done(); return; }
    var dur = opts.duration || duration(el), t0 = performance.now() + (opts.delay || 0), mark = el.getAttribute('data-hy-scene') === 'mark';
    c.live = true; c.k = 0; draw(el);
    (function frame(now) {
      var q = clamp((now - t0) / dur, 0, 1);
      c.k = mark ? q : easeGrow(q);
      draw(el);
      if (q < 1) c.raf = requestAnimationFrame(frame); else { c.live = false; draw(el); if (opts.done) opts.done(); }
    })(performance.now());
  }
  function progress(el, k) {
    var c = ctl(el); c.k = clamp(k, 0, 1); c.live = c.k > 0 && c.k < 1;
    if (c.pending) return;
    c.pending = requestAnimationFrame(function () { c.pending = 0; draw(el); });
  }
  var ro = root.ResizeObserver ? new ResizeObserver(function (entries) {
    entries.forEach(function (en) {
      var el = en.target, c = ctl(el), first = !c.key;
      clearTimeout(c.t);
      c.t = setTimeout(function () {
        if (first && el.hasAttribute('data-hy-intro') && !reduced()) { play(el, { delay: 120, duration: +el.getAttribute('data-hy-duration') || 0 }); return; }
        c.col = colors(el); draw(el);
      }, first ? 0 : 80);
    });
  }) : null;
  function list(scope) {
    if (scope && scope.matches && scope.matches('canvas[data-hy-scene]')) return [scope];
    return Array.prototype.slice.call((scope || document).querySelectorAll('canvas[data-hy-scene]'));
  }
  root.HyphaGrow = {
    auto: function (scope) { list(scope).forEach(function (el) { if (el.__hyObs) return; el.__hyObs = true; if (ro) ro.observe(el); else draw(el); }); },
    repaint: function (scope) { list(scope).forEach(function (el) { var c = ctl(el); c.col = colors(el); draw(el); }); },
    play: function (scope, opts) { list(scope).forEach(function (el) { play(el, opts); }); },
    grow: function (scope, opts) { list(scope).forEach(function (el) { play(el, opts); }); },
    progress: progress,
    // Dessine l'ouverture telle qu'elle est ms millisecondes après son départ (même délai et même courbe que l'ouverture)
    at: function (el, ms) {
      var c = ctl(el), q = clamp((ms - 120) / duration(el), 0, 1), mark = el.getAttribute('data-hy-scene') === 'mark';
      c.k = mark ? q : easeGrow(q); c.live = q > 0 && q < 1; c.col = colors(el); draw(el);
    },
    // Dessine tout de suite l'instant k (0 à 1) : pour les captures et les vérifications
    frame: function (el, k, live) { var c = ctl(el); c.k = clamp(k, 0, 1); c.live = live == null ? (c.k > 0 && c.k < 1) : !!live; c.col = colors(el); draw(el); },
    markSVG: function () { var M = root.HyphaMark; return M && M.svg ? M.svg.apply(null, arguments) : markSVG.apply(null, arguments); },
    reduced: reduced,
    // La chambre de la landing : son cadre (proportions, horizon, contact et haut du moule en fractions de la hauteur) et son calendrier
    chamber: { ratio: CHBOX.w / CHBOX.h, horizon: (HORIZON - CHBOX.y) / CHBOX.h, contact: (CONTACT - CHBOX.y) / CHBOX.h, moldTop: (MOLD.y0 - CHBOX.y) / CHBOX.h,
      air: (10 - CHBOX.y) / CHBOX.h,
      shoe: { x0: (11 - CHBOX.x) / CHBOX.w, x1: (393 - CHBOX.x) / CHBOX.w, top: (55 - CHBOX.y) / CHBOX.h }, phase: chamberPhase }
  };
})(window);
