/* HYPHA — la marque et le mot-symbole, v3 (2026-10-07). Marque fictive, un Original de Topiary.
   Séparée de grow.js le 2026-10-06 pour que la marque et la paire évoluent chacune de leur côté. Se charge avec grow.js, avant ou après lui.

   La marque est le H de Bodoni Moda, poussé comme un mycélium. Chaque fût est un rhizomorphe : un cordon d'hyphes parallèles, comme
   en forment les pleurotes pour traverser le substrat. Deux spores éclosent sur la ligne de base ; chacune lance un éventail
   d'hyphes qui montent en faisceau, ondulantes, celles du centre en tête (leurs pointes vives à la couleur de la souche). Au pied,
   des hyphes filent sur le substrat (les pieds) ; contre la ligne de capitale, celles des bords sont déviées et filent le long du
   plafond, comme contre le haut d'un moule (les têtes). À hauteur de barre, une hyphe part de chaque fût : les deux pointes
   ralentissent, se touchent et fusionnent (l'anastomose), ce qui laisse un nœud dans le délié de la barre ; une impulsion passe
   d'un fût à l'autre. Puis le cordon se resserre : les racines s'étalent, les hyphes se tendent et s'épaississent, le centre
   d'abord, jusqu'à se fermer en lettre exacte. Trois interstices restent ouverts dans chaque fût, comme des tailles de gravure :
   c'est la signature de la marque au repos. Pour finir, une hyphe exploratrice quitte un empattement.
   Références : le cordon (rhizomorphe) des pleurotes ; Pentagram et Counterpoint, « Hypha » (des lettres poussées par une
   simulation de mycélium) ; Nervous System, Hyphae ; les capitales gravées (Bodoni, filets en réserve dans les fûts).
   Le squelette est celui du H de Bodoni Moda, mesuré sur la police (unités de 1/1000 em) : hauteur de capitale 750, axes des fûts
   à 425 l'un de l'autre, barre centrée à 370 au-dessus de la ligne de base, empattements de 90 (dehors) et 94 (dedans). La graisse
   donne le fût, la taille optique le délié et les approches. Le numéro de la paire (la graine) ne change jamais le squelette :
   seulement les ondulations des hyphes, leur ordre d'arrivée, la rencontre de la barre, les tailles et l'hyphe exploratrice.
   Rien n'est tiré au hasard à l'affichage. Niveaux de détail du canvas : 112 px et plus, tout (huit hyphes par fût, tailles) ; de
   48 à 111 px, cinq hyphes par fût (les tailles et l'exploratrice à partir de 56 px) ; sous 48 px, la lettre seule. Fûts, ligne de
   base et ligne de capitale sont calés sur les pixels de l'écran à toutes les tailles.
   Dans le mot-symbole (petit), le H se trace en déliés, sa barre fusionne, puis le poids arrive d'un coup sur toute la hauteur
   des fûts, le milieu d'abord.

   HyphaMark.lockup(slot, { intro, t }) : pose dans `slot` le H du mot-symbole, à l'encre du texte (currentColor), et règle sa boîte
     sur la graisse, la taille optique et le corps du mot (lus dans son style calculé) : le H a la hauteur de capitale, la ligne de
     base, le fût, le délié et les approches du H de Bodoni Moda qu'il remplace.
     La page fournit le mot : <span class="hy-wordmark"><span data-lockup aria-hidden="true"></span><span aria-hidden="true">YPHA</span></span>
     intro : le H pousse à l'ouverture (1,9 s) ; t : fige cette ouverture à t millisecondes (captures). La page décide des animations
     réduites ; sous prefers-reduced-motion, le H s'affiche fini. Facultatif : duration, delay (ms) ; boost (px), l'élargissement
     des fûts qui compense le lissage sous-pixel du texte voisin (0,32 px à dpr 1, 0,16 px au-delà), pour les vérifications.
   HyphaMark.scene = { build(w, h, graine, el), render(c, ctx, couleurs) } : la scène des canvas data-hy-scene="mark" que pilote grow.js
     (c.k de 0 à 1, linéaire dans le temps ; couleurs.graphic pour la marque, couleurs.accent pour les spores, les pointes vives et
     l'impulsion). Une image coûte moins d'une milliseconde ; la construction, une dizaine.
   HyphaMark.svg(graine, taille, couleur, nu) : la marque finie, en SVG. HyphaMark.duration : la durée d'une pousse (ms).
   HyphaMark.guides(taille) : les lignes de construction dans son carré (fractions), pour les dessiner autour de la marque.
   HyphaMark.metrics(taille) : ligne de capitale, ligne de base et bords de l'encre dans son carré (fractions), pour la composer. */
(function (root) {
  'use strict';
  var doc = root.document;
  // Le H de Bodoni Moda (unités de 1/1000 em)
  var CAP = 750, AXIS = 425, BAR = 370, OUT = 90, INN = 94;
  // Fût selon la graisse ; délié et approche selon la taille optique (mesurés à 1000 px de corps, police locale et Google Fonts)
  var STEM = [[400, 95], [500, 112], [600, 131], [700, 155], [900, 203]];
  var HAIR = [[6, 31], [9, 26], [12, 18], [32, 6], [48, 4], [74, 2.5], [96, 2]];
  var SIDE = [[6, 36], [9, 33.25], [12, 28], [32, 20.75], [48, 18.75], [74, 18.5], [96, 18.25]];
  var DURATION = 3400, WORD_MS = 1900;

  // ---------- Outils ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function table(tb, x) {
    if (x <= tb[0][0]) return tb[0][1] + (x - tb[0][0]) * (tb[1][1] - tb[0][1]) / (tb[1][0] - tb[0][0]);
    for (var i = 1; i < tb.length; i++) if (x <= tb[i][0]) return lerp(tb[i - 1][1], tb[i][1], (x - tb[i - 1][0]) / (tb[i][0] - tb[i - 1][0]));
    return tb[tb.length - 1][1];
  }
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Une courbe cubic-bezier, tabulée une fois (1024 pas) puis lue par interpolation : exacte à l'œil, et rapide
  function bezier(x1, y1, x2, y2) {
    function at(t, a, b) { return 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t; }
    var N = 1024, tab = new Float64Array(N + 1);
    for (var j = 0; j <= N; j++) {
      var x = j / N, lo = 0, hi = 1, t = x;
      for (var i = 0; i < 30; i++) { t = (lo + hi) / 2; if (at(t, x1, x2) < x) lo = t; else hi = t; }
      tab[j] = at(t, y1, y2);
    }
    tab[0] = 0; tab[N] = 1;
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var u = x * N, k = Math.floor(u);
      return tab[k] + (tab[k + 1] - tab[k]) * (u - k);
    };
  }
  // Les courbes d'HYPHA (--hy-ease-grow, -out, -standard), lues dans ses tokens au premier usage
  var E = null;
  function eases() {
    if (E) return E;
    var cs = doc && doc.documentElement && root.getComputedStyle ? root.getComputedStyle(doc.documentElement) : null;
    function read(name, d) {
      var v = cs ? cs.getPropertyValue('--hy-ease-' + name) : '', m = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(v || '');
      var p = m ? [+m[1], +m[2], +m[3], +m[4]] : d;
      return bezier(p[0], p[1], p[2], p[3]);
    }
    E = { grow: read('grow', [0.45, 0, 0.2, 1]), out: read('out', [0.16, 1, 0.3, 1]), std: read('standard', [0.2, 0.7, 0.2, 1]) };
    return E;
  }
  function cub(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
  }
  function cubicPts(p0, p1, p2, p3, ds) {
    var L = 0, i, prev = p0;
    for (i = 1; i <= 40; i++) { var q = cub(p0, p1, p2, p3, i / 40); L += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; }
    var n = Math.max(2, Math.ceil(L / ds)), out = [];
    for (i = 0; i <= n; i++) out.push(cub(p0, p1, p2, p3, i / n));
    return out;
  }
  function linePts(a, b, ds) { var L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / ds)), out = []; for (var i = 0; i <= n; i++) out.push([lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)]); return out; }

  // ---------- Une hyphe : ligne médiane, épaisseur finale, calendrier de pousse ----------
  // La pointe avance le long de la ligne (croissance par l'apex) ; derrière elle, l'hyphe mûrit : son épaisseur passe de `thin`
  // à 1 (fraction de l'épaisseur finale) en `mat` (unités de k). Chaque point garde l'instant où la pointe l'a dépassé.
  function hypha(o) {
    var pts = o.pts, n = pts.length, h = {
      n: n, X: new Float64Array(n), Y: new Float64Array(n), S: new Float64Array(n), W: new Float64Array(n), TX: new Float64Array(n), TY: new Float64Array(n), K: new Float64Array(n),
      born: o.born, done: o.done, ease: o.ease, thin: o.thin == null ? 1 : o.thin, mat: o.mat || 0.1, end: o.end || 'round', start: o.start || 'flat',
      edge: o.edge || 0, edgeY: o.edgeY || 0, dot: !!o.dot, swell: o.swell || null, kind: o.kind || ''
    }, i, L = 0;
    for (i = 0; i < n; i++) { h.X[i] = pts[i][0]; h.Y[i] = pts[i][1]; if (i) L += Math.hypot(h.X[i] - h.X[i - 1], h.Y[i] - h.Y[i - 1]); h.S[i] = L; }
    for (i = 0; i < n; i++) {
      var a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = h.X[b] - h.X[a], dy = h.Y[b] - h.Y[a], d = Math.hypot(dx, dy) || 1;
      h.TX[i] = dx / d; h.TY[i] = dy / d; h.W[i] = o.width(h.S[i], L);
    }
    h.L = L;
    h.lenAt = o.lenAt || function (k) { if (k <= h.born) return 0; if (k >= h.done) return L; return L * h.ease((k - h.born) / (h.done - h.born)); };
    for (i = 0; i < n; i++) h.K[i] = timeAt(h, h.S[i]);
    return h;
  }
  function timeAt(h, s) {
    if (s <= 0) return h.born;
    var lo = h.born, hi = h.done;
    for (var j = 0; j < 32; j++) { var m = (lo + hi) / 2; if (h.lenAt(m) < s) lo = m; else hi = m; }
    return hi;
  }
  function matOf(h, kAt, k) { if (h.thin >= 1) return 1; var a = clamp((k - kAt) / h.mat, 0, 1); return h.thin + (1 - h.thin) * a * a * (3 - 2 * a); }
  // Un point de l'hyphe en s (abscisse curviligne) à l'instant k : [x, y, tx, ty, épaisseur]
  function pointAt(h, s, k) {
    var S = h.S, n = h.n, lo = 0, hi = n - 1;
    if (s <= 0) { hi = 1; } else if (s >= h.L) { lo = n - 2; } else { while (hi - lo > 1) { var m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; } }
    var f = clamp((s - S[lo]) / ((S[hi] - S[lo]) || 1), 0, 1);
    var x = lerp(h.X[lo], h.X[hi], f), y = lerp(h.Y[lo], h.Y[hi], f), tx = lerp(h.TX[lo], h.TX[hi], f), ty = lerp(h.TY[lo], h.TY[hi], f), tl = Math.hypot(tx, ty) || 1;
    var w = lerp(h.W[lo], h.W[hi], f) * matOf(h, lerp(h.K[lo], h.K[hi], f), k);
    if (h.swell) w *= h.swell(s, k);
    if (h.edge) y = h.edgeY - h.edge * w / 2;
    return [x, y, tx / tl, ty / tl, w];
  }
  // Le contour du tronçon [sA, sB] à l'instant k, avec ses bouts : 'flat', 'round', ou 'dome' (apex aplati de h.domeNow)
  function strip(h, k, sA, sB, capA, capB, out, res) {
    if (sB - sA < 1e-3) return;
    var P = [pointAt(h, sA, k)], i;
    for (i = 0; i < h.n; i++) if (h.S[i] > sA + 1e-3 && h.S[i] < sB - 1e-3) P.push(pointAt(h, h.S[i], k));
    P.push(pointAt(h, sB, k));
    var m = P.length, poly = [], p;
    for (i = 0; i < m; i++) { p = P[i]; poly.push(p[0] - p[3] * p[4] / 2, p[1] + p[2] * p[4] / 2); }
    p = P[m - 1]; cap(poly, p, -p[3], p[2], p[4] / 2, capB, h, res, 1);
    for (i = m - 1; i >= 0; i--) { p = P[i]; poly.push(p[0] + p[3] * p[4] / 2, p[1] - p[2] * p[4] / 2); }
    p = P[0]; cap(poly, p, p[3], -p[2], p[4] / 2, capA, h, res, -1);
    out.push(poly);
  }
  // Un bout rond ou en dôme : de +n vers -n en passant par l'avant (dir = 1) ou par l'arrière (dir = -1)
  function cap(poly, p, nx, ny, r, type, h, res, dir) {
    if (type !== 'round' && type !== 'dome') return;
    var tx = p[2] * dir, ty = p[3] * dir, depth = type === 'dome' ? Math.min(r, h.domeNow != null ? h.domeNow : r) : r, N = clamp(Math.ceil(Math.max(r, depth) / res * 0.9), 4, 28);
    for (var j = 1; j < N; j++) { var a = Math.PI * j / N; poly.push(p[0] + nx * r * Math.cos(a) + tx * depth * Math.sin(a), p[1] + ny * r * Math.cos(a) + ty * depth * Math.sin(a)); }
  }
  // Congé entre deux bords à angle droit : le coin, et un quart de cercle concave de rayon r
  function fillet(out, cx, cy, d1x, d1y, d2x, d2y, r, res) {
    if (r <= 0.05) return;
    var ox = cx + (d1x + d2x) * r, oy = cy + (d1y + d2y) * r, N = clamp(Math.ceil(r / res), 3, 14), poly = [cx, cy];
    for (var j = 0; j <= N; j++) { var a = Math.PI / 2 * j / N; poly.push(ox - (d2x * Math.cos(a) + d1x * Math.sin(a)) * r, oy - (d2y * Math.cos(a) + d1y * Math.sin(a)) * r); }
    out.push(orient(poly));
  }
  // Toutes les formes tournent dans le même sens que les rubans (aire signée négative) : remplies ensemble, elles s'unissent
  function orient(poly) {
    var a = 0, n = poly.length / 2;
    for (var i = 0; i < n; i++) { var j = (i + 1) % n; a += poly[i * 2] * poly[j * 2 + 1] - poly[j * 2] * poly[i * 2 + 1]; }
    if (a > 0) { var r = []; for (var q = n - 1; q >= 0; q--) r.push(poly[q * 2], poly[q * 2 + 1]); return r; }
    return poly;
  }
  function ellipse(out, cx, cy, rx, ry, res) {
    if (rx <= 0.05 || ry <= 0.05) return;
    var N = clamp(Math.ceil(Math.max(rx, ry) / res * 1.6), 8, 48), poly = [];
    for (var j = 0; j < N; j++) { var a = Math.PI * 2 * j / N; poly.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); }
    out.push(orient(poly));
  }

  // ---------- Le modèle ----------
  // P : { seed, stem, hair, lod ('full' | 'simple' | 'bare' | 'skel'), word (calendrier du mot-symbole), res (pas d'échantillonnage,
  //       en unités), px (unités par pixel CSS), axis, bar, out, inn, cap (valeurs calées au pixel), box (le carré, en unités) }
  // Coordonnées : x depuis la pointe gauche du pied gauche, y = 0 sur la ligne de base, vers le bas.
  function model(P) {
    var R = prng((P.seed | 0) * 7919 + 17), ez = eases(), px = P.px || 1;
    var stem = P.stem, hair = P.hair, ax = P.axis || AXIS, barY = -(P.bar || BAR), out = P.out || OUT, inn = P.inn || INN, cap = P.cap || CAP;
    var lod = P.lod, full = lod === 'full', skel = lod === 'skel', word = !!P.word;
    var xL = out + stem / 2, xR = xL + ax, M = { parts: [], spores: [], aerial: [], P: P, xL: xL, xR: xR, stem: stem, hair: hair, inkW: 2 * out + ax + stem, cap: cap, barY: barY };
    // Le calendrier (k de 0 à 1). D'abord le squelette en déliés : spores (sp), hyphes de tête (ld), pieds (ft), têtes à l'arrivée
    // de l'apex (hd), barre jusqu'au contact (kc) et nœud (nd). Puis le poids : le cordon remplit chaque fût depuis le pied (cd).
    // Enfin, les pointes qui continuent (ar).
    var T = word
      ? { sp: [0, 0.07, 0.03, 0.1], ld: [0.05, 0.36, 0.08, 0.39], ft: 0.08, hd: 0.16, kc: 0.56, nd: 0.1, cd: [0.5, 0.92, 0.54, 0.96], ar: 1 }
      : { sp: [0, 0.055, 0.02, 0.075], ld: [0.04, 0.31, 0.065, 0.335], ft: 0.06, hd: 0.15, kc: 0.5, nd: 0.08, cd: [0.5, 0.96, 0.53, 0.99], ar: 0.7 };
    M.T = T;
    var leadW = skel ? stem : word ? Math.max(hair, stem * 0.16) : Math.max(hair * 1.35, cap * 0.02);
    var tipR = skel ? 1 : 0.5, rf = skel ? 0 : (word ? 0.45 * hair + 5 : 0.9 * hair + 4), rfb = skel ? 0 : rf * 0.7;
    var dome = skel ? 0 : (word ? 6 : cap * 0.006), fl = cap * 0.03;
    M.dome = dome; M.rf = rf; M.rfb = rfb; M.leadW = leadW;
    [xL, xR].forEach(function (x, si) {
      // L'hyphe de tête : elle sort de la spore et monte jusqu'à la ligne de capitale, sa pointe ronde juste sous la ligne
      var ld = hypha({ kind: 'leader', pts: linePts([x, 0], [x, -(cap - leadW / 2)], 5), born: T.ld[si * 2], done: T.ld[si * 2 + 1], ease: ez.grow,
        width: function () { return leadW; }, thin: word ? 1 : 0.85, mat: 0.06, end: 'round', start: 'flat', dot: !skel && !word });
      ld.si = si;
      M.parts.push(ld);
      M['lead' + si] = ld;
      // Le cordon : il remplit le fût depuis le pied ; son front, à peine bombé, s'aplatit contre la ligne de capitale
      var f0 = T.cd[si * 2], f1 = T.cd[si * 2 + 1], Lt = cap + fl;
      var Fk = function (k) { return k <= f0 ? 0 : k >= f1 ? Lt : Lt * ez.grow((k - f0) / (f1 - f0)); };
      var cord = hypha({ kind: 'stem', pts: linePts([x, 0], [x, -cap], 5), born: f0, done: f1, ease: ez.grow, width: function () { return stem; }, thin: 1, end: 'dome', start: 'flat' });
      cord.si = si;
      cord.lenAt = function (k) { return Math.min(cap, Fk(k)); };
      cord.swell = skel ? null : function (s, k) { var u = (Fk(k) - s) / fl; return u >= 1 ? 1 : u <= 0 ? 0 : Math.sqrt(u * (2 - u)); };
      // Dans le mot-symbole, le poids arrive d'un coup sur toute la hauteur : le fût s'élargit depuis le délié, le milieu d'abord
      if (word) {
        cord.end = 'flat';
        cord.lenAt = function (k) { return k > f0 ? cap : 0; };
        cord.swell = function (s, k) { var lag = 0.09 * Math.pow(Math.abs(s / cap - 0.5) * 2, 1.6), q = clamp((k - f0 - lag) / Math.max(0.05, f1 - f0 - 0.09), 0, 1); return (leadW + (stem - leadW) * ez.out(q)) / stem; };
      }
      M.parts.push(cord);
      M['stem' + si] = cord;
      // La spore, couchée sur la ligne de base, d'où partent l'hyphe de tête et les deux pieds
      if (!skel) M.spores.push({ x: x, w: leadW * 2.9, h: leadW * 1.3, k0: T.sp[si * 2], k1: T.sp[si * 2 + 1] });
      // Le cordon se forme : d'autres hyphes montent à côté de l'hyphe de tête, parallèles et régulièrement espacées (le fût
      // se lit alors en traits, comme un fût gravé), en V derrière elle : celles du centre la suivent de près, celles des bords
      // plus tard. Puis les intervalles se comblent depuis le pied.
      var nT = full ? 6 : lod === 'simple' ? 4 : 0, tw = Math.max(hair * 0.62, px * 0.7);
      for (var t = 0; t < nT; t++) {
        var c = (t + 0.5) / nT - 0.5, lane = c * stem * 0.84, wob = stem * 0.02 * (R() - 0.5), ph = R() * 6.28, tp = [];
        for (var yy = 0; yy <= cap - hair * 1.5; yy += 5) tp.push([x + lane + wob * Math.sin(yy / cap * Math.PI * 2 + ph) * sstep(0, cap * 0.1, yy), -yy]);
        var tb = T.ld[si * 2] + 0.035 + Math.abs(c) * 0.11 + (R() - 0.5) * 0.012, td = (T.ld[si * 2 + 1] - T.ld[si * 2]) * (1.04 + Math.abs(c) * 0.25);
        M.parts.push(hypha({ kind: 'thread', pts: tp, born: tb, done: tb + td, ease: ez.grow, width: function () { return tw; }, thin: 1, end: 'round', start: 'flat' }));
      }
      // Grand format : l'hyphe de tête porte ses cloisons, à intervalles réguliers sous l'apex, et une anse à une cloison sur deux,
      // d'un côté puis de l'autre. Le cordon les enveloppe en montant.
      if (full) {
        var y = cap * (0.08 + R() * 0.03), side = R() < 0.5 ? -1 : 1, list = [];
        while (y < cap * 0.9) {
          var kf = timeAt(ld, Math.min(ld.L, y + cap * 0.035));
          list.push({ s: y, k0: kf, k1: kf + 0.03, side: side });
          side = -side; y += cap * (0.07 + R() * 0.03);
        }
        ld.young = list;
        list.forEach(function (sp, j) {
          if (j % 2) return;
          var edge = x + sp.side * leadW / 2, yy2 = -sp.s, hc = leadW * 0.45, e = leadW * 0.3, inX = edge - sp.side * leadW * 0.12, cw = Math.max(leadW * 0.17, px * 0.7);
          var pts = cubicPts([inX, yy2 - hc], [edge + sp.side * e * 1.35, yy2 - hc * 1.05], [edge + sp.side * e * 1.35, yy2 + hc * 0.85], [inX, yy2 + hc], 1.2);
          var cl = hypha({ kind: 'clamp', pts: pts, born: sp.k0 + 0.004, done: sp.k1 + 0.02, ease: ez.std, thin: 1, end: 'round', start: 'flat', width: function () { return cw; } });
          cl.host = cord; cl.at = sp.s; cl.reach = leadW / 2 + e * 1.35 + cw;
          M.parts.push(cl);
        });
      }
    });
    // Les pointes qui continueront de pousser (dès 72 px) : la graine choisit les coins, une tête d'un côté et, le plus souvent,
    // le pied de l'autre, en diagonale
    var hs = R() < 0.5 ? 0 : 1, diag = R() < 0.7;
    M.cont = {};
    if ((lod === 'full' || lod === 'simple') && !P.noAerial) { M.cont['headO' + hs] = true; if (diag) M.cont['footO' + (1 - hs)] = true; }
    // Les empattements : des hyphes qui s'étalent sur la ligne de base (pieds) et se ramifient sous la ligne de capitale (têtes).
    // Le bord extérieur reste sur la ligne ; le délié s'effile vers sa pointe ronde. Une pointe qui continuera ne s'effile pas :
    // elle garde tout son délié, et c'est l'hyphe qui la prolonge qui s'effilera.
    function serif(x, dir, reach, foot, born, done, si, cont) {
      var half = stem / 2, r0 = cont ? hair / 2 : hair * tipR / 2, len = half + reach - (skel ? 0 : r0);
      var h = hypha({ kind: foot ? 'foot' : 'head', pts: linePts([x, 0], [x + dir * len, 0], 4), born: born, done: done, ease: foot ? ez.out : ez.std,
        width: function (s) { return s <= half || cont ? hair : hair * (1 - (1 - tipR) * Math.pow(sstep(half, len, s), 1.2)); },
        thin: word ? 0.8 : 0.7, mat: 0.08, end: skel ? 'flat' : 'round', edge: foot ? 1 : -1, edgeY: foot ? 0 : -cap });
      h.dir = dir; h.foot = foot; h.si = si;
      M.parts.push(h);
      return h;
    }
    [0, 1].forEach(function (si) {
      var x = si ? xR : xL, sd = si ? 1 : -1, ld = M['lead' + si], o0 = T.ft + si * 0.025;
      M['footO' + si] = serif(x, sd, out, true, o0, o0 + (word ? 0.26 : 0.24), si, M.cont['footO' + si]);
      M['footI' + si] = serif(x, -sd, inn, true, o0 + 0.012, o0 + (word ? 0.24 : 0.22), si);
      M['headO' + si] = serif(x, sd, out, false, ld.done - 0.012, ld.done - 0.012 + T.hd, si, M.cont['headO' + si]);
      M['headI' + si] = serif(x, -sd, inn, false, ld.done - 0.004, ld.done - 0.004 + T.hd * 0.92, si);
    });
    // La barre : une branche part de chaque hyphe de tête, sous sa pointe, à hauteur de barre ; les deux pointes se cherchent
    // et fusionnent. La graine décale un peu leur rencontre et leur inclinaison.
    var gap = ax - stem, xm = (xL + xR) / 2 + (skel ? 0 : (R() - 0.5) * gap * 0.1), sgn = R() < 0.5 ? -1 : 1, slope = skel ? 0 : sgn * (word ? 1 + R() * 3 : 1.5 + R() * 4);
    M.meet = [xm, barY];
    [0, 1].forEach(function (si) {
      var x = si ? xR : xL, d = si ? -1 : 1, y0 = barY + (si ? -slope : slope), e = x + d * (stem / 2 + hair * 1.5);
      var pts = linePts([x, y0], [e, y0], 5).concat(cubicPts([e, y0], [lerp(e, xm, 0.45), y0], [lerp(e, xm, 0.55), barY], [xm, barY], 4).slice(1));
      var ld = M['lead' + si], born = timeAt(ld, Math.min(ld.L, -barY + cap * 0.08)), kc = T.kc;
      // Approche : la pointe ralentit en arrivant ; sur la fin, les deux pointes avancent tour à tour (le dialogue qui précède la fusion)
      var tab = new Float64Array(257), run = 0;
      for (var q = 0; q <= 256; q++) {
        var u = q / 256, w0 = 0.52, g = u;
        if (!skel && u > w0) { var v = (u - w0) / (1 - w0), amp = sstep(0, 0.25, v); g = w0 + (u - w0) - amp * (si ? -1 : 1) * Math.sin(Math.PI * 3 * v) * (1 - w0) / (Math.PI * 3); }
        run = Math.max(run, 1 - Math.pow(1 - clamp(g, 0, 1), 1.65)); tab[q] = run;
      }
      tab[256] = 1;
      var h = hypha({ kind: 'bar', pts: pts, born: born, done: kc, ease: null, thin: 0.75, mat: 0.08, end: 'round', start: 'flat', dot: !skel && !word,
        width: function () { return hair; },
        lenAt: function (k) { if (k <= born) return 0; if (k >= kc) return this.L; var w = (k - born) / (kc - born) * 256, i = Math.floor(w); return this.L * lerp(tab[i], tab[Math.min(256, i + 1)], w - i); } });
      // Les pointes gonflent un peu en se rapprochant, puis le nœud de fusion prend le relais
      if (!skel) h.swell = function (s, k) { var near = sstep(this.L - hair * 3, this.L, s); return 1 + 0.45 * near * sstep(kc - 0.12, kc, k) * (1 - sstep(kc + 0.02, kc + 0.09, k)); };
      for (var ii = 0; ii < h.n; ii++) h.K[ii] = timeAt(h, h.S[ii]);
      h.si = si; h.y0 = y0;
      M.parts.push(h);
      M['bar' + si] = h;
    });
    M.node = skel ? null : { x: xm, y: barY, a: cap * (word ? 0.05 : 0.046), t: hair * (word ? 1.05 : 1.15), k0: T.kc - 0.012, k1: T.kc + T.nd };
    // Les pointes qui continuent
    if ((lod === 'full' || lod === 'simple') && !P.noAerial) aerials(M, R, P, ez);
    return M;
  }

  // Les pointes qui continuent. Passé la lettre, certaines hyphes des empattements continuent de pousser : elles filent le long de
  // leur ligne (la ligne de capitale en tête, la ligne de base au pied, sur le substrat), puis la pointe de tête quitte la ligne et
  // se relève vers l'air (géotropisme négatif), où elle se ramifie : une ou deux branches partent sous la pointe, à angle aigu,
  // dans le sens de la pousse. La graine choisit les coins (en diagonale le plus souvent : une tête d'un côté, un pied de l'autre),
  // les longueurs, la levée et les branches. La courbure naît progressivement, sans coude ; les fils évitent la lettre, ses
  // contreformes et les autres fils.
  function aerials(M, R, P, ez) {
    var cap = M.cap, stem = M.stem, hair = M.hair, xL = M.xL, xR = M.xR, full = P.lod === 'full', box = P.box, px = P.px || 1, UP = -Math.PI / 2;
    var m = cap * 0.028, left = xL - stem / 2 - OUT, right = xR + stem / 2 + OUT, all = [];
    function forbidden(x, y, deep) {
      if (y > cap * (deep ? 0.12 : 0.03)) return true;                    // sous la ligne de base (le substrat, pour les pieds)
      if (x > left - m && x < right + m && y > -cap - m && y < m) {
        if (x > xL - stem / 2 - m && x < xR + stem / 2 + m) return true;   // la lettre et ses contreformes
        if (y > -cap + hair * 2 + m && y < -hair * 2 - m) return false;    // le long des flancs, entre pied et tête
        return true;                                                       // les empattements
      }
      return false;
    }
    function crowded(x, y, own, gap) {
      for (var i = 0; i < all.length; i++) { var o = all[i]; if (o === own) continue; for (var j = 0; j < o.length; j += 2) if (Math.abs(o[j] - x) < gap && Math.abs(o[j + 1] - y) < gap) return true; }
      return false;
    }
    // La direction rejoint la direction visée ; la courbure monte progressivement sur `ramp` ; une inflexion lente l'anime
    function trace(x, y, th, len, target, rate, ramp, free, own, sway, gap, deep) {
      var pts = [[x, y]], ds = 3, s = 0, flat = [x, y], ph = R() * Math.PI * 2, waves = Math.max(1, len / (cap * 0.16));
      while (s < len) {
        var diff = Math.atan2(Math.sin(target - th), Math.cos(target - th));
        th += diff * (1 - Math.exp(-rate * ds)) * sstep(0, ramp, s) + sway * Math.sin(ph + s / len * Math.PI * 2 * waves) * ds / len * waves;
        var nx = x + Math.cos(th) * ds, ny = y + Math.sin(th) * ds;
        if (box && (nx < box[0] || nx > box[2] || ny < box[1] || ny > box[3])) break;
        if (s > free && (forbidden(nx, ny, deep) || crowded(nx, ny, own, gap || cap * 0.045))) break;
        x = nx; y = ny; s += ds; pts.push([x, y]); flat.push(x, y);
      }
      all.push(flat);
      return { pts: pts, flat: flat };
    }
    function rnd(a, b) { return a + R() * (b - a); }
    function grow(pts, born, w0, minW) {
      var L = (pts.length - 1) * 3, dur = clamp(L / (cap * 1.7), 0.07, 0.26);
      born = Math.min(born, 0.98 - dur);
      var h = hypha({ kind: 'aerial', pts: pts, born: born, done: born + dur, ease: ez.std, thin: 0.85, mat: 0.05, end: 'round', start: 'flat', dot: px < cap / 50,
        width: function (s, Lh) { return Math.max(minW, w0 * (1 - 0.68 * Math.pow(s / Lh, 0.85))); } });
      M.parts.push(h); M.aerial.push(h);
      return h;
    }
    // Les coins ont été choisis avec les empattements (M.cont) : la tête se relève vers l'air, le pied plonge doucement dans le
    // substrat ; en diagonale, les deux gestes se répondent
    Object.keys(M.cont).sort().forEach(function (key) {
      var head = key.indexOf('head') === 0, from = M[key], dir = from.dir, tip = pointAt(from, from.L, 1);
      var len = cap * (head ? rnd(0.36, 0.62) : rnd(0.28, 0.46)) * (full ? 1 : 0.5), lift = head ? UP + dir * rnd(0.62, 1.12) : (dir > 0 ? 1 : -1) * rnd(0.12, 0.22) + (dir > 0 ? 0 : Math.PI);
      var tr = trace(tip[0] - dir * hair * 0.5, tip[1], dir > 0 ? 0 : Math.PI, len, lift,
        (head ? rnd(3.5, 7) : 2.2) / len, len * (head ? rnd(0.3, 0.7) : rnd(0.45, 0.6)), m * 1.8 + hair * 2, null, head || !full ? 0 : rnd(-0.2, 0.2), 0, !head);
      if (tr.pts.length < 12) { all.pop(); return; }
      var w0 = Math.max(tip[4], px * 0.85), h = grow(tr.pts, Math.max(from.done - 0.012, M.T.ar + (head ? 0.02 : 0)), w0, px * 0.7), L = h.L;
      if (!full || !head) return;
      // Le front de pousse, là où la pointe a quitté la ligne : une ou deux branches, de longueurs différentes
      var nb = R() < 0.15 ? 0 : R() < 0.55 ? 1 : 2, side = -dir;
      for (var b = 0; b < nb; b++) {
        var s = L * (b ? rnd(0.78, 0.86) : rnd(0.6, 0.72)), pt = pointAt(h, s, 1), th = Math.atan2(pt[3], pt[2]), bl = (L - s) * (b ? rnd(0.5, 0.7) : rnd(0.6, 0.85)) + cap * 0.04;
        var br = trace(pt[0], pt[1], th + side * rnd(0.44, 0.6), bl, UP + side * rnd(0.05, 0.3), 2.6 / bl, bl * 0.3, cap * 0.04, tr.flat, 0, cap * 0.03);
        side = -side;
        if ((br.pts.length - 1) * 3 < cap * 0.07) { all.pop(); continue; }
        grow(br.pts, Math.min(0.95, timeAt(h, Math.min(L, s + cap * 0.04))), pt[4] * 0.85, px * 0.65);
      }
    });
  }

  // ---------- La géométrie à l'instant k ----------
  // Les contours (en unités, remplis ensemble), les cloisons (en réserve), les pointes vives et l'impulsion qui suit la fusion
  // o.aerial === false : sans les pointes qui continuent ; o.node === false : sans le nœud de fusion ni son impulsion
  function frame(M, k, o) {
    var polys = [], dots = [], pulse = [], cuts = [], res = M.P.res, cap = M.cap, stem = M.stem, hair = M.hair, px = M.P.px || 1;
    M.parts.forEach(function (h) {
      if (o && o.aerial === false && h.kind === 'aerial') return;
      var l = h.lenAt(k);
      if (l <= 1e-3) return;
      // Le cordon bute contre la ligne de capitale, comme contre le haut d'un moule : son front s'y aplatit
      if (h.kind === 'stem') h.domeNow = M.dome;
      // Les anses vivent sur la jeune hyphe : quand le cordon les recouvre, on ne les trace plus
      if (h.kind === 'clamp' && pointAt(h.host, h.at, k)[4] / 2 > h.reach) return;
      strip(h, k, 0, l, h.start, h.end, polys, res);
      // Les cloisons de la jeune hyphe : une paroi percée d'un pore, qui se forme des bords vers le centre et se voit tant que
      // le fût est mince ; le cordon l'enveloppe
      if (h.young) h.young.forEach(function (sp) {
        if (k <= sp.k0 || sp.s > l) return;
        var lw = M.leadW, f = sstep(sp.k0, sp.k1, k), cw = pointAt(M['stem' + h.si], sp.s, k)[4], v = f * (1 - clamp((cw - lw) / (lw * 0.8), 0, 1));
        if (v > 0.02) cuts.push([h.X[0], -sp.s, lw * Math.min(1, f * 1.4), lw * 0.2, Math.max(lw * 0.11, px * 0.55), v]);
      });
      // Pointe vive : tant que l'hyphe pousse, un point à la couleur de la souche dans son apex ; il s'éteint quand elle s'arrête.
      // Pendant l'approche, les deux pointes de la barre battent l'une après l'autre (deux fois par seconde au plus).
      if (h.dot && k < h.done + 0.035) {
        var grown = l >= h.L, al = grown ? 1 - sstep(h.done, h.done + 0.035, k) : sstep(h.born, h.born + 0.02, k);
        if (h.kind === 'bar' && !grown) al *= 0.62 + 0.38 * Math.max(0, Math.cos((k - M.T.kc) * 40 + (h.si ? Math.PI : 0)));
        var p2 = pointAt(h, grown ? h.L : l, k), rr = Math.max(p2[4] * 0.34, px * 0.75), back = Math.min(p2[4] * 0.45, rr * 1.4);
        if (al > 0.01) dots.push([p2[0] - p2[2] * back, p2[1] - p2[3] * back, rr, al]);
      }
    });
    // Les spores : elles gonflent, puis le fût les absorbe
    M.spores.forEach(function (sp) { var f = eases().out(clamp((k - sp.k0) / (sp.k1 - sp.k0), 0, 1)); if (f > 0) ellipse(polys, sp.x, -sp.h / 2 * f, sp.w / 2 * f, sp.h / 2 * f, res); });
    // Les congés : quand le fût et l'empattement (ou la barre) sont là tous les deux, ils se raccordent
    fillets(M, k, polys);
    // Le nœud de fusion
    var nd = o && o.node === false ? null : M.node;
    if (nd && k > nd.k0) {
      var f = eases().out(clamp((k - nd.k0) / (nd.k1 - nd.k0), 0, 1)), poly = [], N = clamp(Math.ceil(nd.a / res), 8, 40), ht = nd.t * f + hair / 2 * (1 - f), j, u, b;
      for (j = 0; j <= N; j++) { u = -1 + 2 * j / N; b = Math.pow(1 - u * u, 1.5); poly.push(nd.x + u * nd.a * (0.55 + 0.45 * f), nd.y + (hair / 2 + (ht - hair / 2) * b)); }
      for (j = N; j >= 0; j--) { u = -1 + 2 * j / N; b = Math.pow(1 - u * u, 1.5); poly.push(nd.x + u * nd.a * (0.55 + 0.45 * f), nd.y - (hair / 2 + (ht - hair / 2) * b)); }
      polys.push(orient(poly));
      // L'impulsion : le cytoplasme passe d'un fût à l'autre ; un trait de la couleur de la souche file du nœud vers les deux fûts
      if (!M.P.word && k > M.T.kc + 0.03 && k < M.T.kc + 0.17) {
        var q = clamp((k - M.T.kc - 0.03) / 0.14, 0, 1), pe = eases().std(q);
        [M.bar0, M.bar1].forEach(function (h) {
          var se = stem / 2 + hair, s1 = h.L - pe * (h.L - se), s0 = Math.max(se, s1 - cap * 0.07);
          if (s1 - s0 > hair * 0.5) pulse.push({ h: h, s0: s0, s1: s1, a: 1 - sstep(0.7, 1, q) });
        });
      }
    }
    return { polys: polys, dots: dots, pulse: pulse, cuts: cuts };
  }
  function fillets(M, k, polys) {
    var res = M.P.res, cap = M.cap, stem = M.stem, hair = M.hair;
    if (!M.rf) return;
    [0, 1].forEach(function (si) {
      var st = M['stem' + si], x = si ? M.xR : M.xL, sl = st.lenAt(k);
      // Pieds et têtes
      [['footO', 1], ['footI', 1], ['headO', -1], ['headI', -1]].forEach(function (d) {
        var h = M[d[0] + si], l = h.lenAt(k), foot = d[1] > 0, sy = foot ? hair * 1.2 : cap - hair * 1.2;
        if (!l || sl < sy) return;
        var ps = pointAt(st, sy, k), half = ps[4] / 2, ext = l - half;
        if (ext <= 0) return;
        var pw = pointAt(h, half, k), r = M.rf * Math.min(1, ext / (M.rf * 2.5)) * clamp((ps[4] - M.leadW) / (stem - M.leadW), 0, 1);
        fillet(polys, x + h.dir * half, foot ? -pw[4] : -cap + pw[4], 0, foot ? -1 : 1, h.dir, 0, r, res);
      });
      // Barre : au-dessus et au-dessous de la branche, côté contreforme
      var b = M['bar' + si], lb = b.lenAt(k);
      if (!lb) return;
      var pb = pointAt(st, -b.y0, k), halfb = pb[4] / 2, extb = lb - halfb;
      if (extb <= 0) return;
      var dir = si ? -1 : 1, pw2 = pointAt(b, halfb, k), r2 = M.rfb * Math.min(1, extb / (M.rfb * 2.5)) * clamp((pb[4] - M.leadW) / (stem - M.leadW), 0, 1);
      fillet(polys, x + dir * halfb, b.y0 - pw2[4] / 2, 0, -1, dir, 0, r2, res);
      fillet(polys, x + dir * halfb, b.y0 + pw2[4] / 2, 0, 1, dir, 0, r2, res);
    });
  }

  // ---------- Mise en page dans un carré ----------
  function lodOf(S, bare) { return S < 48 ? 'skel' : bare ? 'bare' : S < 112 ? 'simple' : 'full'; }
  // Hauteur de capitale et ligne de base, en fraction du carré, selon le niveau de détail
  var LAY = { full: [0.5, 0.8], simple: [0.6, 0.81], bare: [0.64, 0.82], skel: [0.7, 0.85] };
  function place(S, seed, bare, dpr) {
    var lod = lodOf(S, bare), L = LAY[lod], d = dpr || 1, skel = lod === 'skel', P = { seed: seed, lod: lod, noAerial: lod === 'simple' && S < 56 };
    // Calé sur les pixels de l'écran : hauteur de capitale, ligne de base, fûts et écart des fûts en pixels entiers ;
    // dans le squelette, les déliés et la barre aussi. Les fûts restent ainsi nets à toutes les tailles.
    var capD = Math.round(L[0] * S * d), sc = capD / d / CAP, u = 1 / (d * sc);
    var stemD = Math.max(1, Math.round((lod === 'simple' ? 0.17 : 0.165) * capD)), axD = Math.round(AXIS / CAP * capD);
    P.stem = stemD * u; P.axis = axD * u; P.cap = capD * u;
    if (skel) {
      var hairD = Math.max(1, Math.round(0.016 * capD)), outD = Math.max(1, Math.round(OUT / CAP * capD)), barTop = Math.round(BAR / CAP * capD + hairD / 2);
      P.hair = hairD * u; P.out = outD * u; P.inn = outD * u; P.bar = (barTop - hairD / 2) * u;
    } else {
      P.hair = Math.max(CAP * (lod === 'full' ? 0.0145 : 0.019), 1.05 * d * u);
    }
    var outU = P.out || OUT, inkU = 2 * outU + P.axis + P.stem, edge = Math.round(((S - inkU * sc) / 2 + outU * sc) * d);
    P.sc = sc; P.ox = edge / d - outU * sc; P.oy = Math.round(L[1] * S * d) / d;
    P.res = u * (skel ? 0.67 : 0.8); P.px = 1 / sc; P.capPx = capD / d;
    if (!skel) {
      // Le carré, en unités, pour les pointes qui continuent (avec une marge)
      var pad = S * 0.05;
      P.box = [(pad - P.ox) / sc, (pad - P.oy) / sc, (S - pad - P.ox) / sc, (S - pad - P.oy) / sc];
    }
    return P;
  }

  // ---------- La pousse (v3) : un cordon d'hyphes, qui se resserre en lettre ----------
  // Un fût de la marque est un rhizomorphe : un cordon d'hyphes parallèles, comme en forment les pleurotes pour traverser le
  // substrat. Le calendrier, en k (de 0 à 1, linéaire dans le temps ; grow.js le fait avancer à vitesse constante) :
  //   spore : les deux spores éclosent sur la ligne de base ;
  //   rise : chaque spore lance un éventail d'hyphes qui montent en faisceau, celles du centre en tête ; au pied, deux hyphes
  //          filent sur le substrat de chaque côté (les pieds) ; contre la ligne de capitale, les hyphes des bords sont déviées et
  //          filent le long du plafond (les têtes) ; à hauteur de barre, une hyphe part de chaque fût, les deux se cherchent,
  //          se touchent et fusionnent (le nœud, puis une impulsion qui file vers les deux fûts) ;
  //   cond : le cordon se resserre, les hyphes se tendent (elles se redressent) et s'épaississent, le centre d'abord ;
  //   body : la lettre, exacte, prend le relais ; trois interstices restent ouverts dans chaque fût, comme des tailles de gravure ;
  //   aer : une hyphe exploratrice quitte un empattement.
  var TL = { spore: [0, 0.07], rise: [0.05, 0.43], cond: [0.4, 0.8], body: [0.72, 0.83], aer: [0.78, 0.995], pop: 0.11 };
  // Un ressort qui dépasse un peu sa cible, puis s'y pose (sans rebond)
  function backOut(t) { var c = 1.55; t = clamp(t, 0, 1) - 1; return 1 + (c + 1) * t * t * t + c * t * t; }
  // Un bruit de valeur lisse, en deux dimensions, tiré de la graine
  function vnoise(seed) {
    var R = prng(seed), T = new Float32Array(256), Pm = new Uint8Array(512), i;
    for (i = 0; i < 256; i++) { T[i] = R(); Pm[i] = i; }
    for (i = 255; i > 0; i--) { var j = Math.floor(R() * (i + 1)), t = Pm[i]; Pm[i] = Pm[j]; Pm[j] = t; }
    for (i = 0; i < 256; i++) Pm[i + 256] = Pm[i];
    function v(x, y) { return T[Pm[Pm[x & 255] + (y & 255)]]; }
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return lerp(lerp(v(xi, yi), v(xi + 1, yi), sx), lerp(v(xi, yi + 1), v(xi + 1, yi + 1), sx), sy);
    };
  }
  // Une hyphe du cordon : ses points (unités), l'ondulation de chacun (qui se tend pendant le resserrement), son calendrier
  // (b, e : la pointe part et arrive ; ease), son épaisseur (en px : du fil au plein, de c0 à c1)
  // fan : ce qu'il reste à l'éventail pour s'ouvrir en plein (il s'ouvre pendant le resserrement : les racines s'étalent)
  function fiber(pts, wav, b, e, ease, w0, w1, c0, c1, fan) {
    var n = pts.length, f = { X: new Float64Array(n), Y: new Float64Array(n), V: new Float64Array(n), F: new Float64Array(n), S: new Float64Array(n), n: n, b: b, e: e, ease: ease, w0: w0, w1: w1, c0: c0, c1: c1 }, L = 0;
    for (var i = 0; i < n; i++) { f.X[i] = pts[i][0]; f.Y[i] = pts[i][1]; f.V[i] = wav ? wav[i] : 0; f.F[i] = fan ? fan[i] : 0; if (i) L += Math.hypot(f.X[i] - f.X[i - 1], f.Y[i] - f.Y[i - 1]); f.S[i] = L; }
    f.L = L;
    return f;
  }
  function fiberLen(f, k) { return k <= f.b ? 0 : k >= f.e ? f.L : f.L * f.ease((k - f.b) / (f.e - f.b)); }
  // L'instant où la pointe atteint l'abscisse s
  function fiberAt(f, s) { var lo = f.b, hi = f.e; for (var j = 0; j < 30; j++) { var m = (lo + hi) / 2; if (fiberLen(f, m) < s) lo = m; else hi = m; } return hi; }
  // Le tracé de l'hyphe jusqu'à l, en px (ondulation tendue de `tense`, de 0 à 1) ; rend la pointe
  function fiberTo(path, f, l, tense, open, ox, oy, sc) {
    var tip = null, wv = 1 - tense;
    for (var i = 0; i < f.n; i++) {
      var x = ox + (f.X[i] + f.V[i] * wv + f.F[i] * open) * sc, y = oy + f.Y[i] * sc;
      if (f.S[i] > l) {
        if (i === 0) break;
        var px = ox + (f.X[i - 1] + f.V[i - 1] * wv + f.F[i - 1] * open) * sc, py = oy + f.Y[i - 1] * sc, q = (l - f.S[i - 1]) / ((f.S[i] - f.S[i - 1]) || 1);
        x = px + (x - px) * q; y = py + (y - py) * q;
        path.lineTo(x, y); tip = [x, y];
        break;
      }
      if (i) path.lineTo(x, y); else path.moveTo(x, y);
      tip = [x, y];
    }
    return tip;
  }
  // Le nœud de fusion fini : une lentille dans le délié de la barre (unités)
  function lensPoly(nd, hair, res) {
    var poly = [], N = clamp(Math.ceil(nd.a / res), 8, 40), j, u, b, hh = hair / 2;
    for (j = 0; j <= N; j++) { u = -1 + 2 * j / N; b = Math.pow(1 - u * u, 1.5); poly.push(nd.x + u * nd.a, nd.y + (hh + (nd.t - hh) * b)); }
    for (j = N; j >= 0; j--) { u = -1 + 2 * j / N; b = Math.pow(1 - u * u, 1.5); poly.push(nd.x + u * nd.a, nd.y - (hh + (nd.t - hh) * b)); }
    return orient(poly);
  }
  // Tout ce que la pousse précalcule pour un canvas : la lettre finie, le cordon de chaque fût, les tailles de gravure
  function culture(M) {
    var P = M.P, S = M.S, lod = P.lod, sc = M.sc, ox = M.ox, oy = M.oy, R = prng(((P.seed | 0) + 1) * 48271 + 11), ez = eases();
    var cap = M.cap, stem = M.stem, hair = M.hair, outU = P.out || OUT, innU = P.inn || INN;
    var G = { fibers: [], cuts: [], spores: [], kf: 0.44, wHair: Math.max(0.55, S / 430) };
    // La lettre finie, sans le nœud ni les pointes qui continuent
    var F = frame(M, 1, { aerial: false, node: false });
    G.bodyPolys = F.polys; G.body = toPath(F.polys, ox, oy, sc);
    G.node = M.node ? lensPoly(M.node, hair, P.res) : null;
    G.meet = [ox + M.meet[0] * sc, oy + M.meet[1] * sc];
    if (lod === 'skel') return G;
    var N = lod === 'full' ? 8 : 5, sp = stem / N, nz = vnoise((P.seed | 0) * 131 + 7), rise = bezier(0.4, 0, 0.22, 1), u1 = 1 / sc;
    var wH = G.wHair, wLane = sp * sc * 1.08, wSerif = Math.max(wH, hair * sc * 0.62), step = cap / 140;
    G.sporeR = Math.max(1.1, stem * sc * 0.13);
    [M.xL, M.xR].forEach(function (xc, si) {
      var out = si ? 1 : -1, lanes = [];
      G.spores.push([ox + xc * sc, oy - hair * 1.2 * sc]);
      // Le faisceau : N hyphes, réparties sur le fût ; l'éventail s'ouvre depuis la spore sur les premiers 7 % de la hauteur
      for (var j = 0; j < N; j++) {
        var u = (-0.5 + (j + 0.5) / N) * stem, c = Math.abs(u) / (stem / 2), A = sp * (0.85 - 0.6 * c), lam = cap * (0.22 + R() * 0.2), ph = R() * 60;
        var pts = [], wav = [], fan = [], fanH = cap * 0.065;
        // Les bouts ronds des hyphes, une fois épaissies, ne dépassent ni la ligne de base ni la ligne de capitale
        var yA = sp * 0.56, yB = cap - sp * 0.56;
        for (var y = yA; y <= yB + 1e-6; y += step) {
          var fo = sstep(0, fanH, y), damp = sstep(cap * 0.03, cap * 0.16, y) * (1 - sstep(cap * 0.86, cap * 0.97, y));
          pts.push([xc + u * (0.55 + 0.45 * fo), -y]); fan.push(u * 0.45 * (1 - fo));
          wav.push(A * (nz(y / lam + ph, j * 7.3 + si * 31) - 0.5) * 2 * damp);
        }
        var b = TL.rise[0] + 0.05 * c + R() * 0.012 + si * 0.014, e = TL.rise[1] - 0.075 + 0.055 * c + R() * 0.012 + si * 0.01;
        var c0 = TL.cond[0] + 0.08 * c + R() * 0.02, c1 = c0 + 0.28;
        var f = fiber(pts, wav, b, e, rise, wH, wLane, c0, c1, fan);
        f.u = u; lanes.push(f); G.fibers.push(f);
      }
      // Les têtes : arrivées contre la ligne de capitale, les deux hyphes de chaque bord sont déviées et filent le long du plafond
      [[0, out, outU], [N - 1, -out, innU]].forEach(function (t, side) {
        var jj = si ? N - 1 - t[0] : t[0], dir = t[1], reach = t[2];
        [0, 1].forEach(function (rank) {
          var src = lanes[rank ? (jj + (jj === 0 ? 1 : -1)) : jj], y0 = -(cap - hair * (0.35 + 0.3 * rank)), x0 = xc + src.u, x1 = xc + dir * (stem / 2 + reach * (rank ? 0.62 : 1) - hair * 0.5);
          var k0 = src.e - 0.006 + rank * 0.012, pts = [[x0, src.Y[src.n - 1]]].concat(linePts([x0, y0], [x1, y0], step));
          G.fibers.push(fiber(pts, null, k0, k0 + 0.1 + 0.03 * rank, ez.out, wH, wSerif, TL.cond[0] + 0.1, TL.cond[0] + 0.38));
        });
      });
      // Les pieds : deux hyphes filent sur le substrat, de part et d'autre de la spore
      [-1, 1].forEach(function (dir) {
        var reach = dir === out ? outU : innU;
        [0, 1].forEach(function (rank) {
          var y0 = -hair * (0.35 + 0.3 * rank), x1 = xc + dir * (stem / 2 + reach * (rank ? 0.6 : 1) - hair * 0.5), k0 = TL.rise[0] + 0.02 + rank * 0.03 + si * 0.014;
          G.fibers.push(fiber(linePts([xc, y0], [x1, y0], step), null, k0, k0 + 0.2, ez.out, wH, wSerif, TL.cond[0] + 0.06, TL.cond[0] + 0.34));
        });
      });
      G['lanes' + si] = lanes;
    });
    // La barre : une hyphe part du bord intérieur de chaque fût quand le faisceau passe à sa hauteur ; les deux pointes
    // ralentissent en s'approchant et se touchent au point de rencontre, au même instant
    var bars = [0, 1].map(function (si) {
      var h = M['bar' + si], xc = si ? M.xR : M.xL, edge = stem / 2 - sp * 0.5, pts = [];
      for (var i = 0; i < h.n; i++) if (Math.abs(h.X[i] - xc) >= edge) pts.push([h.X[i], h.Y[i]]);
      var inner = G['lanes' + si][si ? 0 : N - 1];
      return { pts: pts, born: fiberAt(inner, -pts[0][1]) + 0.01 };
    });
    var kf = Math.min(0.47, Math.max(bars[0].born, bars[1].born) + 0.15);
    G.kf = kf;
    bars.forEach(function (bb) {
      var f = fiber(bb.pts, null, bb.born, kf, bezier(0.25, 0.6, 0.3, 1), wH, Math.max(wH, hair * sc * 0.9), TL.cond[0] + 0.1, TL.cond[0] + 0.36);
      G.fibers.push(f);
    });
    // Les tailles de gravure : trois interstices de chaque fût restent ouverts (la graine les choisit), effilés aux deux bouts
    if (lod === 'full' || (lod === 'simple' && S >= 56)) {
      [0, 1].forEach(function (si) {
        var lanes = G['lanes' + si], PAT = N === 8 ? [[1, 3, 5], [2, 4], [1, 4], [2, 5], [1, 3, 5], [3, 5], [1, 3]] : [[1, 3], [1], [2], [1, 2], [2, 3]], pick = PAT[Math.floor(R() * PAT.length)];
        pick.forEach(function (g) {
          var a = lanes[g], b = lanes[g + 1], y0 = cap * (0.05 + R() * 0.07), y1 = cap * (0.95 - R() * 0.08), pts = [];
          for (var i = 0; i < a.n; i++) { var yy = -a.Y[i]; if (yy < y0 || yy > y1) continue; pts.push([(a.X[i] + a.V[i] * 0.35 + a.F[i] + b.X[i] + b.V[i] * 0.35 + b.F[i]) / 2, a.Y[i]]); }
          if (pts.length > 4) G.cuts.push({ pts: pts, w: Math.max(0.6, stem * sc * 0.042) });
        });
      });
      G.cutPath = cutPath(G.cuts, ox, oy, sc);
    }
    // Les pointes qui continuent : leur pousse vient en dernier
    if (M.aerial.length) {
      var b0 = Infinity, d1 = 0;
      M.aerial.forEach(function (h) { b0 = Math.min(b0, h.born); d1 = Math.max(d1, h.done); });
      var span = Math.max(d1 - b0, 1e-6), A0 = TL.aer[0], A1 = TL.aer[1];
      M.aerial.forEach(function (h) {
        var nb = A0 + (h.born - b0) / span * (A1 - A0), ne = A0 + (h.done - b0) / span * (A1 - A0);
        h.born = nb; h.done = Math.max(nb + 0.05, ne); h.ease = ez.std;
        for (var q = 0; q < h.n; q++) h.K[q] = timeAt(h, h.S[q]);
      });
    }
    return G;
  }
  // Les tailles : un ruban effilé le long de chaque interstice (px)
  function cutPath(cuts, ox, oy, sc) {
    var p = new Path2D();
    cuts.forEach(function (c) {
      var n = c.pts.length, L = [], tot = 0, i;
      for (i = 0; i < n; i++) { if (i) tot += Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1]); L.push(tot); }
      var left = [], right = [];
      for (i = 0; i < n; i++) {
        var a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), tx = c.pts[b][0] - c.pts[a][0], ty = c.pts[b][1] - c.pts[a][1], tl = Math.hypot(tx, ty) || 1;
        var t = L[i] / (tot || 1), w = c.w / 2 * Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.45), nx = -ty / tl, ny = tx / tl;
        var x = ox + c.pts[i][0] * sc, y = oy + c.pts[i][1] * sc;
        left.push([x + nx * w, y + ny * w]); right.push([x - nx * w, y - ny * w]);
      }
      left.forEach(function (q, j) { if (j) p.lineTo(q[0], q[1]); else p.moveTo(q[0], q[1]); });
      for (i = n - 1; i >= 0; i--) p.lineTo(right[i][0], right[i][1]);
      p.closePath();
    });
    return p;
  }

  // ---------- Canvas (scène pilotée par grow.js) ----------
  function build(w, h, seed, el, o) {
    o = o || {};
    // La même résolution que le canvas de grow.js (data-hy-dpr la plafonne), pour caler les fûts sur ses pixels
    var S = Math.min(w, h), dpr = o.dpr || Math.min(2, root.devicePixelRatio || 1), capD = el && el.getAttribute ? parseFloat(el.getAttribute('data-hy-dpr')) : NaN;
    if (capD > 0) dpr = clamp(Math.min(dpr, capD), 0.25, 2);
    var P = place(S, seed, o.bare != null ? o.bare : !!(el && el.hasAttribute && el.hasAttribute('data-hy-bare')), dpr);
    var M = model(P);
    M.W = w; M.H = h; M.S = S; M.dpr = dpr; M.ox = P.ox + Math.round((w - S) / 2 * dpr) / dpr; M.oy = P.oy + Math.round((h - S) / 2 * dpr) / dpr; M.sc = P.sc;
    M.G = culture(M);
    return M;
  }
  function toPath(polys, ox, oy, sc) {
    var p = new Path2D();
    polys.forEach(function (q) { p.moveTo(ox + q[0] * sc, oy + q[1] * sc); for (var i = 2; i < q.length; i += 2) p.lineTo(ox + q[i] * sc, oy + q[i + 1] * sc); p.closePath(); });
    return p;
  }
  function nodePath(M, s) {
    var G = M.G, q = G.node, mx = G.meet[0], my = G.meet[1], p = new Path2D();
    for (var i = 0; i < q.length; i += 2) { var x = mx + (M.ox + q[i] * M.sc - mx) * s, y = my + (M.oy + q[i + 1] * M.sc - my) * s; if (i) p.lineTo(x, y); else p.moveTo(x, y); }
    p.closePath();
    return p;
  }
  function aerialPolys(M, k) {
    var out = [];
    M.aerial.forEach(function (h) { var l = h.lenAt(k); if (l > 1e-3) strip(h, k, 0, l, h.start, h.end, out, M.P.res); });
    return out;
  }
  // La lettre, son nœud et ses tailles (le nœud à l'échelle s, les tailles à l'opacité a)
  function letter(M, ctx, col, alpha, s, cutA) {
    var G = M.G;
    ctx.globalAlpha = alpha; ctx.fillStyle = col.graphic;
    ctx.fill(G.body);
    ctx.globalAlpha = 1;
    if (G.node && s > 0) ctx.fill(nodePath(M, s));
    if (G.cutPath && cutA > 0) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = cutA; ctx.fill(G.cutPath); ctx.restore(); }
  }
  // La marque finie (mise en cache)
  function still(M, ctx, col) {
    var G = M.G;
    letter(M, ctx, col, 1, 1, 1);
    if (M.aerial.length) { if (!G.aer) G.aer = toPath(aerialPolys(M, 1), M.ox, M.oy, M.sc); ctx.fillStyle = col.graphic; ctx.fill(G.aer); }
  }
  function render(c, ctx, col) {
    var M = c.model, G = M.G, k = clamp(c.k == null ? 1 : c.k, 0, 1), ac = col.accent || col.graphic, j;
    ctx.clearRect(0, 0, M.W, M.H);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (k >= 1) { still(M, ctx, col); return; }
    var tense = eases().std(sstep(TL.cond[0], TL.cond[1], k)) * 0.65, open = eases().std(sstep(TL.cond[0], TL.cond[0] + 0.26, k)), tips = [], bodyA = sstep(TL.body[0], TL.body[1], k);
    // Squelette seul (sous 48 px) : la lettre apparaît
    if (!G.fibers.length) { letter(M, ctx, col, eases().std(sstep(0.05, 0.6, k)), 1, 0); return; }
    // 1. Le cordon : chaque hyphe pousse, puis se tend et s'épaissit ; la lettre exacte prend le relais
    if (bodyA < 1) {
      ctx.save(); ctx.strokeStyle = col.graphic; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      G.fibers.forEach(function (f) {
        var l = fiberLen(f, k); if (l <= 0) return;
        ctx.lineWidth = f.w0 + (f.w1 - f.w0) * eases().grow(clamp((k - f.c0) / (f.c1 - f.c0), 0, 1));
        ctx.beginPath();
        var tip = fiberTo(ctx, f, l, tense, open, M.ox, M.oy, M.sc);
        ctx.stroke();
        if (tip && l < f.L) tips.push(tip[0], tip[1], sstep(0, 0.12, l / f.L) * (1 - sstep(TL.cond[0] + 0.05, TL.cond[0] + 0.15, k)));
      });
      ctx.restore();
    }
    // 2. La lettre exacte, le nœud et les tailles
    var pop = G.node && k > G.kf ? backOut((k - G.kf) / TL.pop) : 0;
    if (bodyA > 0) letter(M, ctx, col, bodyA, pop, bodyA);
    else if (pop > 0) { ctx.fillStyle = col.graphic; ctx.fill(nodePath(M, pop)); }
    // 3. L'impulsion après la fusion : le cytoplasme passe d'un fût à l'autre
    var q2 = (k - G.kf - 0.012) / 0.13;
    if (G.node && q2 > 0 && q2 < 1) {
      var pe = eases().std(q2), o = [];
      [M.bar0, M.bar1].forEach(function (h) { var se = M.stem / 2 + M.hair, s1 = h.L - pe * (h.L - se), s0 = Math.max(se, s1 - M.cap * 0.07); if (s1 - s0 > M.hair * 0.5) strip(h, 1, s0, s1, 'round', 'round', o, M.P.res); });
      ctx.globalAlpha = 1 - sstep(0.65, 1, q2); ctx.fillStyle = ac; ctx.fill(toPath(o, M.ox, M.oy, M.sc)); ctx.globalAlpha = 1;
    }
    // 4. Les spores et les pointes vives, à la couleur de la souche
    ctx.fillStyle = ac;
    var sg = backOut((k - TL.spore[0]) / (TL.spore[1] - TL.spore[0])), sa = 1 - sstep(0.1, 0.24, k);
    if (sa > 0) { ctx.globalAlpha = sa; G.spores.forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], G.sporeR * sg, 0, Math.PI * 2); ctx.fill(); }); }
    var rt = Math.max(0.8, G.wHair * 1.25);
    for (j = 0; j < tips.length; j += 3) { if (tips[j + 2] <= 0.01) continue; ctx.globalAlpha = tips[j + 2]; ctx.beginPath(); ctx.arc(tips[j], tips[j + 1], rt, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    // 5. Les pointes qui continuent, leur pointe vive tant qu'elles poussent
    if (M.aerial.length && k > TL.aer[0]) {
      ctx.fillStyle = col.graphic;
      ctx.fill(toPath(aerialPolys(M, k), M.ox, M.oy, M.sc));
      ctx.fillStyle = ac;
      M.aerial.forEach(function (h) {
        var l = h.lenAt(k); if (l <= 0 || l >= h.L) return;
        var p = pointAt(h, l, k), rr = Math.max(p[4] * 0.42, 0.8 / M.sc), back = Math.min(p[4] * 0.4, rr);
        ctx.beginPath(); ctx.arc(M.ox + (p[0] - p[2] * back) * M.sc, M.oy + (p[1] - p[3] * back) * M.sc, rr * M.sc, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  // ---------- SVG ----------
  function r2(v) { return Math.round(v * 100) / 100; }
  // Douglas-Peucker sur un polygone fermé (tolérance en unités)
  function simplify(q, tol) {
    var n = q.length / 2;
    if (n < 6 || tol <= 0) return q;
    var keep = new Uint8Array(n); keep[0] = 1; keep[n - 1] = 1;
    (function dp(a, b) {
      var ax = q[a * 2], ay = q[a * 2 + 1], dx = q[b * 2] - ax, dy = q[b * 2 + 1] - ay, L = Math.hypot(dx, dy) || 1e-9, best = -1, bd = tol;
      for (var i = a + 1; i < b; i++) { var dd = Math.abs((q[i * 2] - ax) * dy - (q[i * 2 + 1] - ay) * dx) / L; if (dd > bd) { bd = dd; best = i; } }
      if (best >= 0) { keep[best] = 1; dp(a, best); dp(best, b); }
    })(0, n - 1);
    var out = []; for (var i = 0; i < n; i++) if (keep[i]) out.push(q[i * 2], q[i * 2 + 1]);
    return out;
  }
  function svgPath(polys, ox, oy, sc, tol) {
    var d = '';
    polys.forEach(function (q) {
      var pts = simplify(q, tol / sc);
      for (var i = 0; i < pts.length; i += 2) d += (i ? 'L' : 'M') + r2(ox + pts[i] * sc) + ' ' + r2(oy + pts[i + 1] * sc);
      d += 'Z';
    });
    return d;
  }
  // Les tailles en SVG : les mêmes rubans effilés que sur le canvas
  function cutSVG(cuts, ox, oy, sc) {
    var d = '';
    cuts.forEach(function (c) {
      var n = c.pts.length, L = [], tot = 0, i, left = [], right = [];
      for (i = 0; i < n; i++) { if (i) tot += Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1]); L.push(tot); }
      for (i = 0; i < n; i += 2) {
        var a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), tx = c.pts[b][0] - c.pts[a][0], ty = c.pts[b][1] - c.pts[a][1], tl = Math.hypot(tx, ty) || 1;
        var w = c.w / 2 * Math.pow(Math.sin(Math.PI * clamp(L[i] / (tot || 1), 0, 1)), 0.45), x = ox + c.pts[i][0] * sc, y = oy + c.pts[i][1] * sc;
        left.push(r2(x - ty / tl * w) + ' ' + r2(y + tx / tl * w)); right.push(r2(x + ty / tl * w) + ' ' + r2(y - tx / tl * w));
      }
      d += 'M' + left.join('L') + 'L' + right.reverse().join('L') + 'Z';
    });
    return d;
  }
  // La marque finie, en SVG : la lettre et son nœud (les tailles y sont creusées par un masque), les pointes qui continuent
  var svgId = 0;
  function svg(seed, size, color, bare) {
    seed = +seed || 412; size = size || 240;
    var M = build(size, size, seed, null, { dpr: 1, bare: !!bare }), G = M.G, fill = color || '#EDE9E1', id = 'hy-cut-' + (++svgId) + '-' + seed;
    var body = svgPath(G.bodyPolys, M.ox, M.oy, M.sc, 0.04) + (G.node ? svgPath([G.node], M.ox, M.oy, M.sc, 0.04) : ''), mask = '', use = '';
    if (G.cuts.length) {
      mask = '<defs><mask id="' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="' + size + '" height="' + size + '"><rect width="' + size + '" height="' + size + '" fill="#fff"/>' +
        '<path fill="#000" d="' + cutSVG(G.cuts, M.ox, M.oy, M.sc) + '"/></mask></defs>';
      use = ' mask="url(#' + id + ')"';
    }
    var aer = M.aerial.length ? '<path fill="' + fill + '" d="' + svgPath(aerialPolys(M, 1), M.ox, M.oy, M.sc, 0.04) + '"/>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '"><title>HYPHA, pair ' + String(seed).padStart(4, '0') + '</title>' +
      mask + '<path fill="' + fill + '"' + use + ' d="' + body + '"/>' + aer + '</svg>';
  }

  // Les lignes de construction de la marque dans un carré de `size` pixels : axes des fûts, ligne de capitale, barre, ligne de base
  function guides(size) {
    size = size || 224;
    var P = place(size, 412, false, 1), f = function (v) { return v / size; }, xL = P.ox + ((P.out || OUT) + P.stem / 2) * P.sc;
    return { stems: [f(xL), f(xL + P.axis * P.sc)], cap: f(P.oy - P.cap * P.sc), bar: f(P.oy - (P.bar || BAR) * P.sc), base: f(P.oy) };
  }

  // ---------- Le mot-symbole ----------
  var CSS = '.hy-mark-h{display:inline-block;position:relative;height:0.75em;margin-right:var(--hy-tracking-wordmark);vertical-align:baseline}' +
    '.hy-mark-h svg{position:absolute;display:block;max-width:none;max-height:none;overflow:visible;fill:currentColor}';
  function style() {
    if (!doc || doc.getElementById('hy-mark-css')) return;
    var s = doc.createElement('style');
    s.id = 'hy-mark-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }
  // Le H se règle sur le mot : graisse (fût), taille optique (délié, approches), corps (un délié jamais sous 0,3 px)
  function wordParams(slot) {
    var cs = root.getComputedStyle(slot), wt = parseFloat(cs.fontWeight) || 500, fs = parseFloat(cs.fontSize) || 16;
    var m = /opsz["']?\s+([\d.]+)/.exec(cs.fontVariationSettings || ''), op = clamp(m ? +m[1] : (cs.fontOpticalSizing === 'none' ? 12 : fs), 6, 96);
    var side = table(SIDE, op) - (wt - 500) / 100 * 3.6 * clamp((table(SIDE, op) - 18) / 15.25, 0, 1);
    return { stem: table(STEM, wt), hair: Math.max(table(HAIR, op), 0.3 / fs * 1000), side: side, fs: fs };
  }
  var uid = 0;
  function lockup(slot, o) {
    o = o || {};
    style();
    var W = wordParams(slot), dpr = root.devicePixelRatio || 1;
    // Le texte voisin est lissé au sous-pixel, ce qui assombrit ses fûts en petit : les fûts du H s'élargissent d'autant
    // (mesuré contre le H composé, de 15 à 48 px de corps), sans toucher à la hauteur, à la ligne de base ni aux déliés
    var boost = (o.boost != null ? o.boost : dpr >= 2 ? 0.16 : 0.32) * clamp((64 - W.fs) / 40, 0, 1) * 1000 / W.fs;
    var M = model({ seed: 412, lod: 'bare', word: true, stem: W.stem + boost, hair: W.hair, res: 1000 / W.fs / 3, px: 1000 / W.fs, capPx: W.fs * 0.75 });
    // Approches : celles de Bodoni ; à droite, un peu moins, car les pointes effilées allègent le bord du H
    var lsb = W.side - boost / 2, rsb = Math.max(4, W.side - 3 - boost / 2), adv = lsb + M.inkW + rsb, pad = 60, top = CAP + 60;
    var vb = [-lsb - pad, -top, adv + 2 * pad, top + pad];
    slot.classList.add('hy-mark-h');
    slot.style.width = (adv / 1000) + 'em';
    slot.innerHTML = '<svg viewBox="' + vb.join(' ') + '" aria-hidden="true" focusable="false" style="left:' + (-pad / 1000) + 'em;bottom:' + (-pad / 1000) + 'em;width:' +
      (vb[2] / 1000) + 'em;height:' + (vb[3] / 1000) + 'em"><path/></svg>';
    var path = slot.querySelector('path'), svgEl = slot.firstChild, still = null;
    // Le navigateur cale la boîte d'un SVG sur les pixels CSS entiers quand il le peint (le dessin glisse alors d'une fraction de
    // pixel), et pose la ligne de base du texte sur un pixel CSS entier, puis sur la grille de l'écran. On reproduit ce calage,
    // en coordonnées du document : le H tombe exactement sur la ligne de base de YPHA, à sa place dans l'interlettrage
    // (mesuré à dpr 1, 1,25, 1,5 et 2, pour des lignes de base fractionnaires).
    // Ces règles de calage sont celles de Chromium, mesurées : ailleurs, on garde la mise en page telle quelle.
    var blink = !!(root.navigator && root.navigator.userAgentData);
    function snap() {
      var d = root.devicePixelRatio || 1;
      svgEl.style.transform = '';
      if (!blink) return;
      var r = svgEl.getBoundingClientRect();
      if (!r.width) return;
      var sx = root.pageXOffset || 0, sy = root.pageYOffset || 0, m = svgEl.getScreenCTM && svgEl.getScreenCTM();
      var y0 = (m ? m.f : r.bottom) + sy, t0 = r.top + sy, l0 = r.left + sx;
      var base = Math.round(Math.round(slot.getBoundingClientRect().bottom + sy) * d) / d;
      var dy = base - y0 - (Math.round(t0) - t0), dx = -(Math.round(l0) - l0);
      if (Math.abs(dx) > 0.004 || Math.abs(dy) > 0.004) svgEl.style.transform = 'translate(' + dx.toFixed(3) + 'px,' + dy.toFixed(3) + 'px)';
    }
    slot._hySnapFn = snap;
    if (!slot._hySnap) {
      // Recalé quand la page change de taille, quand les polices arrivent et quand le mot réapparaît (un panneau qu'on rouvre)
      slot._hySnap = true;
      var again = function () { if (slot._hySnapFn) slot._hySnapFn(); };
      if (root.ResizeObserver) new ResizeObserver(again).observe(doc.documentElement);
      if (root.IntersectionObserver) new IntersectionObserver(function (es) { if (es[es.length - 1].isIntersecting) again(); }).observe(slot);
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(again);
    }
    snap();
    function draw(k) {
      if (k >= 1) { if (!still) still = svgPath(frame(M, 1).polys, 0, 0, 1, 0.6); path.setAttribute('d', still); return; }
      path.setAttribute('d', svgPath(frame(M, k).polys, 0, 0, 1, 0.6));
    }
    var calm = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    slot._hyAnim = ++uid;
    if (slot._hyGhost) { slot._hyGhost.cancel(); slot._hyGhost = null; }
    if (!o.intro || (calm && o.t == null) || !slot.animate) { draw(1); return; }
    // Une animation fantôme porte le temps : la page (ou un outil de revue) peut la figer ; t la fige à un instant
    var ghost = slot._hyGhost = slot.animate([{ opacity: 1 }, { opacity: 1 }], { duration: o.duration || WORD_MS, delay: o.delay == null ? 120 : o.delay, fill: 'both' });
    if (o.t != null) { ghost.pause(); ghost.currentTime = o.t; }
    var id = slot._hyAnim, t1 = performance.now();
    (function tick() {
      if (slot._hyAnim !== id) return;
      var p = ghost.effect.getComputedTiming().progress, st = ghost.playState;
      draw(p == null ? (st === 'finished' ? 1 : 0) : p);
      if (st === 'finished' || (st !== 'running' && performance.now() - t1 > 20000)) { draw(1); ghost.cancel(); slot._hyGhost = null; return; }
      if (o.t != null && st === 'paused' && performance.now() - t1 > 4000) return;
      root.requestAnimationFrame(tick);
    })();
  }

  // Les repères de la marque dans un carré de `size` pixels (fractions) : ligne de capitale, ligne de base, bords gauche et droit
  // de l'encre (pointes des empattements). Pour composer la marque avec du texte (un mot-symbole en très grand).
  function metrics(size) {
    size = size || 240;
    var P = place(size, 412, false, 1), f = function (v) { return v / size; }, outU = P.out || OUT;
    return { cap: f(P.oy - P.cap * P.sc), base: f(P.oy), left: f(P.ox), right: f(P.ox + (2 * outU + P.axis + P.stem) * P.sc) };
  }

  root.HyphaMark = { lockup: lockup, scene: { build: build, render: render }, svg: svg, duration: DURATION, guides: guides, metrics: metrics };
})(window);
