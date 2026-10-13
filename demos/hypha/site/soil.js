/* HYPHA — la coupe du sol du site (« Bury it. »), v5 (2026-10-11).
   v5 : la fructification est refaite. Les pleurotes ne sont plus des vignettes agrandies (un chapeau dessiné une fois, puis
   étiré) : chacun est fait de fils et d'un voile, dans la langue de la planche. Les cordons qui montent percent la surface, se
   dressent en pieds (un faisceau), puis leurs fils s'ouvrent en chapeau : un entonnoir de lames vu d'un peu au-dessus, festonné,
   en console. Deux poses par sommet (le bouton, le chapeau ouvert) que la carte graphique interpole ; les fils ne sont tracés que
   jusqu'à leur front, pointe chaude ; le voile du devant masque ce qui est derrière. La touffe éclaire le sol à son pied.
   v4, tirée de landing/soil.js (v3, que l'ancienne landing garde).
   Ce qui change : la coupe est en fond noir, dans la langue de la chambre (un sol presque noir, piqué de grains clairs, où la paire
   et les fils sont la lumière) ; la paire est en terre dès le jour 0 (rien ne descend) ; sa texture est deux fois plus fine (elle
   vient de la suite agrandie en 2K) ; la planche est faite pour la pleine largeur de l'écran, pilotée par le défilement.
   Le texte d'origine :
   HYPHA — la coupe du sol de la landing (« Bury it. Ninety days to soil. »), v3 (2026-10-08).
   Une coupe du sol vivant, comme vue par la vitre d'un rhizotron, sur 90 jours. Chaque image est une fonction du jour (rien ne dépend
   du temps qui passe) : la lecture et la règle donnent le même dessin, dans les deux sens, et la carte graphique le calcule en une
   fraction de milliseconde.
   Le récit. Le sol vit déjà au jour 0 : un vieux réseau, ténu, le parcourt. La paire s'y enfonce (jours 0 à 10) et soulève une
   butte ; la terre de la fosse reste plus meuble, puis se fond dans le sol. Le réseau s'éveille autour d'elle, et sept cordons
   (des faisceaux de fils torsadés) la rejoignent (6 à 27) : ils s'épaississent derrière leur front, lancent des latérales qui se
   ramifient et fusionnent. À chaque contact, un anneau ; de là, la colonie gagne la paire en vague, dont les fusions règlent la
   densité. Le feutre brunit puis s'efface là où les fils sont passés, et devient humus ; les fils gardent la forme de la paire et
   prennent peu à peu la couleur de la souche. Trois cordons montent vers la surface (53 à 61), des impulsions y portent la sève, les
   primordia percent, et les pleurotes de la souche s'ouvrent en bouquet (63 à 86) ; leurs spores tombent en voile, comme
   l'empreinte de la planche voisine.
   La couleur suit la charte : les fils sont du blanc du mycélium (--hy-color-graphic) ; les pointes qui poussent, les fusions et les
   impulsions prennent la couleur de la souche (--hy-color-accent-graphic), puis refroidissent derrière le front. Le sol (quatre
   horizons), l'humus et le feutre qui brunit prennent leurs tons dans la palette d'HYPHA (neutres et ambres) ; les pleurotes, dans la
   gamme de la souche.
   Références : l'imagerie des réseaux mycorhiziens d'AMOLF (Oyarte Galvez et al., « A travelling-wave strategy for plant–fungal
   trade », Nature, 2025 : croissance en vague, densité réglée par les fusions, « routes principales » plus larges et plus rapides) ;
   les rhizomorphes (cordons d'hyphes parallèles) ; les coupes de rhizotron et les profils de sol (horizons O, A, B, C) des planches de
   pédologie ; les pleurotes en touffe (Pleurotus djamor, citrinopileatus, columbinus : chapeau en éventail, marge enroulée et ondulée,
   lames décurrentes, pied court et latéral).
   HyphaSoil.mount(canvas, { src, strain: () => 'pink'|'gold'|'blue' })
     → { engine, set(day), layout({ W, H, cx, gy, sw, ys, fruit, cap, dpr }), recolor(), ready } (dpr facultatif : plafonne la définition d'une grande planche) ; le réseau est calculé au repos, une fois
     la photo de la paire lue. Sans WebGL 2, un repli en canvas 2D dessine le même réseau, sans lueurs. */
(function (root) {
  'use strict';

  // ---------- Outils ----------
  function prng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function hex(h, d) { h = String(h || '').trim(); if (!/^#[0-9a-f]{6}$/i.test(h)) h = d; var n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  function mixc(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function css(c) { return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')'; }
  function lum(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }

  // ---------- La scène, en unités de la paire : 1 = sa largeur ; origine au centre, sur la ligne du sol ; y vers le bas ----------
  var SH = 1 / 2.475, T0 = 0.075, PAD = 0.1;
  // La paire dans la photo finale de la chambre (fractions de l'image, tous instants confondus) ; la texture l'entoure de PAD
  var CROP = { x: 0.087, y: 0.215, w: 0.813 };
  var DOM = { x0: -2.3, x1: 2.3, y0: -0.02, y1: 1.12 };
  // XF : l'abscisse du pied de la touffe ; FRUIT_W, FRUIT_H : sa demi-largeur et sa hauteur, pour la mise en page
  var XF = -0.05, FRUIT_W = 0.24, FRUIT_H = 0.29;
  // La touffe (v5) : chaque pleurote est fait de fils, comme le reste de la planche. Les cordons qui montent percent la surface, se
  // dressent en pieds, et leurs fils s'ouvrent en chapeaux. Par pleurote : le décalage du pied, son inclinaison finale (radians,
  // vers la droite), la longueur du pied, le rayon du col, le rayon et la hauteur du chapeau, son excentricité et le côté de son
  // grand lobe (phi0 : 0 à droite, pi/2 vers nous, pi à gauche), le nombre de festons de la marge, le jour de naissance et la durée
  // de la pousse, la teinte (ceux de derrière plus sombres), et gmax (un primordium avorté ne dépasse pas le bouton). Du fond
  // vers l'avant.
  var FRUITS = [
    { bx: 0.004, lean: -0.1, L: 0.168, rn: 0.0125, R: 0.098, h: 0.074, ecc: 0.3, phi0: 1.45, lobes: 5, born: 62.8, dur: 18.5, tint: 0.8, seed: 3 },
    { bx: -0.034, lean: -0.8, L: 0.142, rn: 0.0115, R: 0.086, h: 0.064, ecc: 0.36, phi0: 2.5, lobes: 5, born: 63.9, dur: 18, tint: 0.88, seed: 5 },
    { bx: 0.04, lean: 0.76, L: 0.136, rn: 0.0115, R: 0.09, h: 0.066, ecc: 0.36, phi0: 0.62, lobes: 6, born: 64.5, dur: 18, tint: 0.9, seed: 8 },
    { bx: -0.06, lean: -1.22, L: 0.086, rn: 0.009, R: 0.052, h: 0.04, ecc: 0.4, phi0: 2.9, lobes: 4, born: 67.2, dur: 16, tint: 0.92, seed: 13 },
    { bx: 0.066, lean: 1.2, L: 0.08, rn: 0.009, R: 0.05, h: 0.038, ecc: 0.4, phi0: 0.25, lobes: 4, born: 67.9, dur: 16, tint: 0.92, seed: 17 },
    { bx: -0.014, lean: -0.42, L: 0.078, rn: 0.0105, R: 0.07, h: 0.052, ecc: 0.34, phi0: 2.0, lobes: 5, born: 65.6, dur: 17.5, tint: 1, seed: 21 },
    { bx: 0.022, lean: 0.46, L: 0.07, rn: 0.01, R: 0.066, h: 0.05, ecc: 0.34, phi0: 1.1, lobes: 5, born: 66.4, dur: 17.5, tint: 1, seed: 25 },
    { bx: -0.086, lean: -0.5, L: 0.03, rn: 0.006, R: 0.016, h: 0.014, ecc: 0.2, phi0: 1.6, lobes: 3, born: 64.8, dur: 14, tint: 0.95, seed: 31, gmax: 0.44 },
    { bx: 0.09, lean: 0.4, L: 0.026, rn: 0.006, R: 0.015, h: 0.013, ecc: 0.2, phi0: 1.5, lobes: 3, born: 66.2, dur: 14, tint: 0.95, seed: 33, gmax: 0.42 },
    { bx: 0.003, lean: 0.08, L: 0.022, rn: 0.0065, R: 0.017, h: 0.014, ecc: 0.2, phi0: 1.57, lobes: 3, born: 69.5, dur: 14, tint: 1, seed: 37, gmax: 0.5 }
  ];
  // La pousse d'un pleurote au jour d : g (0 à 1), le front de ses fils (ils montent du sol, par leurs pointes, et sont tous là aux
  // six dixièmes de la pousse) et son ouverture (du bouton fermé au chapeau ouvert)
  function fruitState(m, d) {
    var g = clamp((d - m.born) / m.dur, 0, 1) * (m.gmax || 1), q = clamp(g / 0.6, 0, 1), t = clamp((g - 0.24) / 0.76, 0, 1);
    return { g: g, F: 1.06 * (1 - Math.pow(1 - q, 2.4)), O: t * t * t * (t * (t * 6 - 15) + 10) };
  }
  var STAGE = '';  // l'étape de calcul en cours (diagnostic : la tranche la plus longue)

  // Les fils, par sorte : 0 le vieux réseau du sol, 1 l'âme des cordons, 2 leurs latérales, 3 la colonie dans la paire, 4 l'âme des
  // cordons qui montent, 5 les premiers fils de la colonie, 6 les brins qui torsadent autour de chaque âme. Largeur (px CSS à la
  // taille de référence), intensité, durée de la couleur de la souche derrière la pointe (jours), lueur de la pointe (rayon px,
  // intensité).
  var KW = [0.55, 0.85, 0.65, 0.62, 0.9, 0.95, 0.55], KI = [0.075, 0.62, 0.38, 0.6, 0.72, 0.76, 0.36], KH = [0, 3.4, 2.4, 2.6, 3.8, 3, 3.4],
    KGR = [0, 6.5, 2.8, 2.6, 7, 4, 0], KGI = [0, 0.95, 0.3, 0.34, 1, 0.55, 0];

  // ---------- 1. La paire : la photo, son opacité, et ce qu'en tire la simulation ----------
  function* shoeMaps(img) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = CROP.w * iw;
    var TW = 2048, TH = Math.round(TW * (SH + 2 * PAD) / (1 + 2 * PAD));
    // Lue en quatre bandes, une par tranche de travail
    var B = Math.ceil(TH / 4), c = document.createElement('canvas'); c.width = TW; c.height = B;
    var g = c.getContext('2d', { willReadFrequently: true }), n = TW * TH, A = new Uint8Array(n), L = new Uint8Array(n), sy = (SH + 2 * PAD) * k / TH;
    STAGE = 'photo';
    for (var b0 = 0; b0 < TH; b0 += B) {
      var bh = Math.min(B, TH - b0);
      g.fillStyle = '#000'; g.fillRect(0, 0, TW, B);
      g.drawImage(img, CROP.x * iw - PAD * k, CROP.y * ih - PAD * k + b0 * sy, (1 + 2 * PAD) * k, bh * sy, 0, 0, TW, bh);
      var d = g.getImageData(0, 0, TW, bh).data;
      yield;
      for (var q = 0; q < TW * bh; q++) {
        var p = b0 * TW + q, l = (0.2126 * d[q * 4] + 0.7152 * d[q * 4 + 1] + 0.0722 * d[q * 4 + 2]) / 255, t = clamp((l - 0.08) / 0.25, 0, 1);
        A[p] = Math.round(255 * t * t * (3 - 2 * t)); L[p] = Math.round(255 * clamp(l * 1.25, 0, 1));
        if ((q & 32767) === 32767) yield;
      }
    }
    // Le masque de la simulation, quatre fois plus grossier : la moyenne de l'opacité par bloc
    var MW = TW / 4, MH = Math.floor(TH / 4), M = new Float32Array(MW * MH);
    for (var y = 0; y < MH; y++) for (var x = 0; x < MW; x++) {
      var s = 0; for (var j = 0; j < 4; j++) for (var i = 0; i < 4; i++) s += A[(y * 4 + j) * TW + x * 4 + i];
      M[y * MW + x] = s / (16 * 255);
    }
    M = blur(M, MW, MH, 1);
    yield;
    return { TW: TW, TH: TH, A: A, L: L, MW: MW, MH: MH, M: M };
  }
  // Un flou en boîte, deux passes (lignes puis colonnes)
  function blur(A, w, h, r) {
    var T = new Float32Array(w * h), O = new Float32Array(w * h), x, y, s, n = 2 * r + 1;
    for (y = 0; y < h; y++) { s = 0; for (x = -r; x <= r; x++) s += A[y * w + clamp(x, 0, w - 1)]; for (x = 0; x < w; x++) { T[y * w + x] = s / n; s += A[y * w + Math.min(w - 1, x + r + 1)] - A[y * w + Math.max(0, x - r)]; } }
    for (x = 0; x < w; x++) { s = 0; for (y = -r; y <= r; y++) s += T[clamp(y, 0, h - 1) * w + x]; for (y = 0; y < h; y++) { O[y * w + x] = s / n; s += T[Math.min(h - 1, y + r + 1) * w + x] - T[Math.max(0, y - r) * w + x]; } }
    return O;
  }
  // Coordonnées de la texture de la paire (0..1) pour un point de la scène, la paire posée à sa place finale
  function shoeUV(x, y) { return [(x + 0.5 + PAD) / (1 + 2 * PAD), (y - T0 + PAD) / (SH + 2 * PAD)]; }

  // ---------- 2. Le réseau : une croissance par les pointes, jour après jour ----------
  // Chaque pointe avance à sa vitesse (unités par jour) par pas de DS ; son cap dérive en douceur (deux sinus propres à chaque
  // fil), peut viser un point, contourne les pierres, reste dans la paire ou s'arrête en y entrant. Elle se ramifie derrière elle, et
  // fusionne avec un fil déjà là quand elle le croise (anastomose) : la densité se règle d'elle-même. Chaque point garde son jour.
  function* simulate(maps, stones) {
    var R = prng(90), DS = 0.008, GS = 0.006; STAGE = 'réseau ancien';
    var GW = Math.ceil((DOM.x1 - DOM.x0) / GS), GH = Math.ceil((DOM.y1 - DOM.y0) / GS);
    var own = new Int32Array(GW * GH).fill(-1), ox = new Float32Array(GW * GH), oy = new Float32Array(GW * GH), ot = new Float32Array(GW * GH);
    var MW = maps.MW, MH = maps.MH, MM = maps.M;
    function mval(x, y) { var u = shoeUV(x, y), mx = Math.floor(u[0] * MW), my = Math.floor(u[1] * MH); return mx < 0 || my < 0 || mx >= MW || my >= MH ? 0 : MM[my * MW + mx]; }
    function inside(x, y) { return mval(x, y) > 0.4; }
    function rock(x, y, m) {
      for (var i = 0; i < stones.length; i++) { var s = stones[i], dx = (x - s[0]) / (s[2] * m), dy = (y - s[1]) / (s[3] * m); if (dx * dx + dy * dy < 1) return true; }
      return false;
    }
    function cell(x, y) { var i = Math.floor((x - DOM.x0) / GS), j = Math.floor((y - DOM.y0) / GS); return i < 0 || j < 0 || i >= GW || j >= GH ? -1 : j * GW + i; }
    function claim(x, y, id, t) { var c = cell(x, y); if (c >= 0 && own[c] < 0) { own[c] = id; ox[c] = x; oy[c] = y; ot[c] = t; } }
    // Un fil étranger : ni le sien, ni son parent ou ses enfants, ni (près du départ) un frère de la même touffe
    function foreign(o, h, s) { var H2 = HY[o]; return o !== h.id && o !== h.par && H2.par !== h.id && !(s < 0.05 && h.kind === 5 && H2.kind === 5 && H2.fam === h.fam) && !(H2.kind === 0 && H2.pit); }
    // Un fil étranger déjà là, près du point, posé avant l'instant t
    function meet(x, y, r, h, t, s) {
      var c0 = cell(x, y); if (c0 < 0) return -1;
      var ci = c0 % GW, cj = (c0 / GW) | 0, best = -1, bd = 1e9;
      for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) {
        var a = ci + i, b = cj + j; if (a < 0 || b < 0 || a >= GW || b >= GH) continue;
        var c = b * GW + a, o = own[c];
        if (o < 0 || ot[c] > t || !foreign(o, h, s)) continue;
        var dd = (ox[c] - x) * (ox[c] - x) + (oy[c] - y) * (oy[c] - y); if (dd < bd) { bd = dd; best = c; }
      }
      return best;
    }

    var HY = [], tips = [], pend = [], sparks = [];
    function hypha(o) { var h = { id: HY.length, par: o.par == null ? -1 : o.par, fam: o.fam == null ? -1 : o.fam, kind: o.kind, pts: [], end: 0, start: o.t, pit: 0 }; HY.push(h); return h; }
    // o : { t, x, y, a, kind, v, par, fam, gen, max, tx, ty, gain, ramp, keepIn, stopIn, noIn, fuse, avoid, wander, branch, child }
    function start(o) {
      var h = hypha(o); h.pts.push(o.x, o.y, o.t);
      tips.push({ h: h, o: o, x: o.x, y: o.y, a: o.a, t: o.t, s: 0, f1: 14 + R() * 18, f2: 31 + R() * 22, p1: R() * 6.28, p2: R() * 6.28,
        nb: o.branch ? lerp(o.branch[0], o.branch[1], R()) * 0.6 : 1e9, side: R() < 0.5 ? 1 : -1, live: true });
    }
    function end(tp) { tp.live = false; tp.h.end = tp.t; }
    function rec(tp, x, y, t) { tp.h.pts.push(x, y, t); }
    function step(tp, t) {
      var o = tp.o, a = tp.a, h = tp.h;
      a += (o.wander || 0) * (Math.sin(tp.s * tp.f1 + tp.p1) + 0.6 * Math.sin(tp.s * tp.f2 + tp.p2)) * DS;
      if (o.tx != null) { var g = o.gain * (o.ramp ? clamp(tp.s / o.ramp, 0.25, 1) : 1); a += wrap(Math.atan2(o.ty - tp.y, o.tx - tp.x) - a) * g; }
      if (o.avoid) {
        var la = cell(tp.x + Math.cos(a - 0.5) * 0.024, tp.y + Math.sin(a - 0.5) * 0.024), ra = cell(tp.x + Math.cos(a + 0.5) * 0.024, tp.y + Math.sin(a + 0.5) * 0.024);
        var lo = la >= 0 && own[la] >= 0 && own[la] !== h.id, ro = ra >= 0 && own[ra] >= 0 && own[ra] !== h.id;
        if (lo && !ro) a += 0.09; else if (ro && !lo) a -= 0.09;
      }
      var nx = tp.x + Math.cos(a) * DS, ny = tp.y + Math.sin(a) * DS, k, ok;
      // Les pierres : la pointe les contourne, du côté où elle tournait déjà
      if (rock(nx, ny, 1.12)) {
        ok = false;
        for (k = 1; k <= 10 && !ok; k++) { var a3 = a + tp.side * 0.22 * k; nx = tp.x + Math.cos(a3) * DS; ny = tp.y + Math.sin(a3) * DS; if (!rock(nx, ny, 1.12)) { a = a3; ok = true; } }
        if (!ok) { end(tp); return; }
      }
      if (o.keepIn && !inside(nx, ny)) {
        ok = false;
        for (k = 1; k <= 10 && !ok; k++) {
          var a2 = a + (k % 2 ? 1 : -1) * tp.side * 0.24 * Math.ceil(k / 2), mx = tp.x + Math.cos(a2) * DS, my = tp.y + Math.sin(a2) * DS;
          if (inside(mx, my)) { a = a2; nx = mx; ny = my; ok = true; }
        }
        if (!ok) { end(tp); return; }
      }
      if (!o.keepIn && (nx < DOM.x0 || nx > DOM.x1 || ny > DOM.y1 || ny < (o.ymin == null ? 0.012 : o.ymin))) { end(tp); return; }
      if (o.stopIn && inside(nx, ny)) { rec(tp, nx, ny, t); tp.t = t; end(tp); if (o.onIn) o.onIn(nx, ny, t, a, h); return; }
      if (o.noIn && inside(nx, ny)) { end(tp); return; }
      if (o.fuse && tp.s > 0.04) {
        var c = meet(nx, ny, 1, h, t, tp.s);
        if (c >= 0) { rec(tp, ox[c], oy[c], t); tp.t = t; end(tp); if (o.spark) sparks.push([ox[c], oy[c], t, 1, o.spark]); return; }
      }
      tp.x = nx; tp.y = ny; tp.a = a; tp.s += DS; tp.t = t;
      rec(tp, nx, ny, t); claim(nx, ny, h.id, t);
      if (tp.s >= tp.nb && o.branch) { tp.nb += lerp(o.branch[0], o.branch[1], R()); if (o.child) { tp.side = -tp.side; o.child(tp, t); } }
      if (tp.s >= o.max || (o.tmax && t > o.tmax)) end(tp);
    }
    // La vitesse ralentit un peu avant l'arrêt prévu : la pointe se pose
    function speed(tp) { return tp.o.v * (1 - 0.45 * smooth(0.72, 1, tp.s / tp.o.max)); }

    // a. Le vieux réseau du sol, déjà là au jour 0 : des fils épars, sinueux, peu ramifiés
    (function () {
      var n = 46;
      for (var i = 0; i < n; i++) {
        var x = lerp(DOM.x0 + 0.05, DOM.x1 - 0.05, (i + R()) / n), y = 0.06 + R() * 0.9;
        if (rock(x, y, 1.3)) continue;
        var m = R() < 0.6 ? 2 : 1;
        for (var j = 0; j < m; j++) pend.push({ t: -30, x: x, y: y, a: R() * 6.28, kind: 0, v: 1, gen: 0, max: 0.12 + R() * 0.24, wander: 11, avoid: true, fuse: true, ymin: 0.02, branch: [0.09, 0.18], child: bgChild });
      }
    })();
    function bgChild(tp, t) {
      if (tp.o.gen >= 1) return;
      pend.push({ t: t, x: tp.x, y: tp.y, a: tp.a + tp.side * (0.6 + R() * 0.5), kind: 0, v: 1, gen: 1, par: tp.h.id, max: 0.05 + R() * 0.12, wander: 12, avoid: true, fuse: true, ymin: 0.02 });
    }
    // Il pousse « hors du temps » : chaque fil à son tour, jusqu'au bout
    var nb = 0;
    while (pend.length) {
      var o0 = pend.shift(); start(o0); var tp0 = tips[tips.length - 1];
      while (tp0.live) step(tp0, -29);
      if ((++nb & 3) === 0) yield;
    }
    tips = [];
    // La fosse : les fils du vieux réseau qui la traversent sont déplacés quand la paire descend
    function inPit(x, y) { return Math.abs(x) < 0.64 && y < T0 + SH + 0.07; }
    HY.forEach(function (h) { var p = h.pts, c = 0; for (var i = 0; i < p.length; i += 3) if (inPit(p[i], p[i + 1])) c++; h.pit = c > 0 ? 1 : 0; });

    // b. Les cordons : sept, partis du sol autour de la paire (les côtés, le fond), chacun vers le bord qui lui fait face ; leurs
    // arrivées s'échelonnent, d'un côté puis de l'autre
    var cx = 0, cy = T0 + SH * 0.55;
    var ANCH = [[1.16, 0.16, 12.4], [-1.22, 0.24, 14.2], [0.82, 0.78, 16.2], [-0.74, 0.8, 18.4], [0.16, 0.95, 20.6], [1.3, 0.52, 23.2], [-1.3, 0.56, 26.4]];
    function edgeToward(ang) {
      // Le bord de la paire vu depuis son centre, dans une direction : le dernier point dedans
      var last = null;
      for (var r = 0; r < 0.8; r += 0.004) { var x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * 0.5; if (inside(x, y)) last = [x, y]; }
      return last || [cx, cy];
    }
    ANCH.forEach(function (an, i) {
      var x = an[0] + (R() - 0.5) * 0.08, y = an[1] + (R() - 0.5) * 0.06;
      var tg = edgeToward(Math.atan2((y - cy) * 2, x - cx) + (R() - 0.5) * 0.35), dist = Math.hypot(tg[0] - x, tg[1] - y);
      var t0 = 5.5 + i * 0.7 + R() * 0.6;
      pend.push({ t: t0, x: x, y: y, a: Math.atan2(tg[1] - y, tg[0] - x) + (R() < 0.5 ? -1 : 1) * (0.45 + R() * 0.35), kind: 1, v: dist * 1.22 / (an[2] - t0), gen: 0, max: 3,
        tx: tg[0], ty: tg[1], gain: 0.045, ramp: dist * 0.75, wander: 5, stopIn: true, ymin: 0.03, branch: [0.03, 0.06], child: lateral, onIn: contact });
    });
    function lateral(tp, t) {
      var gen = tp.o.kind === 1 || tp.o.kind === 4 ? 1 : tp.o.gen + 1, rise = tp.o.kind === 4 || tp.o.rise;
      if (gen > 2 || (rise && R() < 0.4)) return;
      pend.push({ t: t + 0.5 + R() * 1.4, x: tp.x, y: tp.y, a: tp.a + tp.side * (gen === 1 ? 0.95 + R() * 0.45 : 0.5 + R() * 0.45), kind: 2, v: 0.022 + R() * 0.012,
        par: tp.h.id, gen: gen, rise: rise, max: rise ? 0.02 + R() * 0.05 : gen === 1 ? 0.05 + R() * 0.13 : 0.03 + R() * 0.06, wander: 9, avoid: true, fuse: true, noIn: !rise, spark: 0.4,
        ymin: rise ? 0.004 : 0.03, branch: gen === 1 ? [0.035, 0.07] : null, child: lateral });
    }
    // Un cordon touche la paire : un anneau, et la colonie part de là, en éventail vers l'intérieur
    var contacts = [];
    function contact(x, y, t, a, h) {
      sparks.push([x, y, t, 0, 1]); contacts.push([x, y, t]);
      var inA = Math.atan2(cy - y, (cx - x) * 0.5), fam = contacts.length;
      inA = Math.atan2(Math.sin(inA) * 0.6 + Math.sin(a) * 0.4, Math.cos(inA) * 0.6 + Math.cos(a) * 0.4);
      [-1.3, -0.78, -0.26, 0.26, 0.78, 1.3].forEach(function (d) {
        pend.push({ t: t + 0.15 + R() * 0.45, x: x, y: y, a: inA + d + (R() - 0.5) * 0.25, kind: 5, v: 0.034 + R() * 0.01, gen: 0, par: h.id, fam: fam, max: 0.45 + R() * 0.4,
          wander: 6, keepIn: true, fuse: true, spark: 0.5, branch: [0.026, 0.046], child: inner, tmax: 56 });
      });
    }
    function inner(tp, t) {
      if (tp.o.gen >= 6) return;
      pend.push({ t: t + 0.2 + R() * 0.5, x: tp.x, y: tp.y, a: tp.a + tp.side * (0.4 + R() * 0.35), kind: 3, v: tp.o.v * (0.88 + R() * 0.1), gen: tp.o.gen + 1, par: tp.h.id, fam: tp.o.fam,
        max: 0.1 + R() * 0.3, wander: 8, keepIn: true, fuse: true, spark: 0.3, branch: [0.032, 0.06], child: inner, tmax: 58 });
    }

    // c. Les cordons qui montent vers la surface : trois, partis du haut de la paire, convergent vers le pied de la touffe
    [[-0.08, 52.6], [0.03, 53.3], [0.1, 54]].forEach(function (r, i) {
      var x = XF + r[0], y = T0 + 0.04, k;
      for (k = 0; k < 60 && !inside(x, y); k++) y += 0.005;
      pend.push({ t: r[1], x: x, y: y + 0.03, a: -Math.PI / 2 + (R() - 0.5) * 0.5, kind: 4, v: 0.02 + R() * 0.004, gen: 0, max: 1,
        tx: XF + (i - 1) * 0.01, ty: -0.01, gain: 0.08, ramp: 0.03, wander: 4, ymin: 0.003, branch: [0.03, 0.06], child: lateral });
    });

    // Le temps : chaque pointe avance jusqu'à la fin de chaque intervalle, toutes ensemble (les premières arrivées prennent la place)
    STAGE = 'croissance';
    var dt = 0.04, CAPK = [1e9, 1e9, 420, 1100, 1e9, 1e9], NK = [0, 0, 0, 0, 0, 0];
    for (var day = 0; day <= 90; day += dt) {
      for (var i = pend.length - 1; i >= 0; i--) if (pend[i].t <= day + dt) { if (NK[pend[i].kind]++ < CAPK[pend[i].kind]) start(pend[i]); pend.splice(i, 1); }
      for (var q = 0; q < tips.length; q++) {
        var tp = tips[q]; if (!tp.live) continue;
        var lim = day + dt;
        while (tp.live && tp.t + DS / speed(tp) <= lim) step(tp, tp.t + DS / speed(tp));
      }
      if (day > 1) tips = tips.filter(function (x) { return x.live; });
      yield;
    }
    tips.forEach(end);
    // Les cordons montants qui touchent la surface : un primordium à chacun
    HY.forEach(function (h) { if (h.kind !== 4) return; var p = h.pts, n = p.length; if (p[n - 2] < 0.02) sparks.push([p[n - 3], p[n - 2], h.end, 2, 1]); });
    return { HY: HY, sparks: sparks, contacts: contacts, inside: inside };
  }

  // L'instant où la colonie atteint chaque point de la paire, propagé à toute la texture (distance de chanfrein), puis le jour où le
  // feutre y disparaît : une dizaine de jours après le passage des fils, sur un bruit lisse. Et l'empreinte de l'humus.
  function* dissolveMaps(maps, sim) {
    var MW = maps.MW, MH = maps.MH, n = MW * MH, T = new Float32Array(n).fill(1e9), cw = (1 + 2 * PAD) / MW, v = 0.03;
    sim.HY.forEach(function (h) {
      if (h.kind !== 3 && h.kind !== 5) return;
      for (var i = 0; i < h.pts.length; i += 3) {
        var u = shoeUV(h.pts[i], h.pts[i + 1]), x = Math.floor(u[0] * MW), y = Math.floor(u[1] * MH);
        if (x >= 0 && y >= 0 && x < MW && y < MH) T[y * MW + x] = Math.min(T[y * MW + x], h.pts[i + 2]);
      }
    });
    var dc = cw / v, dd = dc * Math.SQRT2, x, y, k;
    yield;
    for (var pass = 0; pass < 2; pass++) {
      for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) {
        k = y * MW + x; var m = T[k];
        if (x > 0) m = Math.min(m, T[k - 1] + dc); if (y > 0) m = Math.min(m, T[k - MW] + dc);
        if (x > 0 && y > 0) m = Math.min(m, T[k - MW - 1] + dd); if (x < MW - 1 && y > 0) m = Math.min(m, T[k - MW + 1] + dd);
        T[k] = m;
      }
      for (y = MH - 1; y >= 0; y--) for (x = MW - 1; x >= 0; x--) {
        k = y * MW + x; var m2 = T[k];
        if (x < MW - 1) m2 = Math.min(m2, T[k + 1] + dc); if (y < MH - 1) m2 = Math.min(m2, T[k + MW] + dc);
        if (x < MW - 1 && y < MH - 1) m2 = Math.min(m2, T[k + MW + 1] + dd); if (x > 0 && y < MH - 1) m2 = Math.min(m2, T[k + MW - 1] + dd);
        T[k] = m2;
      }
    }
    yield;
    var R = prng(7), G = new Float32Array(9 * 5); for (k = 0; k < G.length; k++) G[k] = R();
    function nz(u, w) { var X = u * 7, Y = w * 3, i = Math.min(6, Math.floor(X)), j = Math.min(2, Math.floor(Y)), fx = X - i, fy = Y - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      return lerp(lerp(G[j * 9 + i], G[j * 9 + i + 1], fx), lerp(G[(j + 1) * 9 + i], G[(j + 1) * 9 + i + 1], fx), fy); }
    var D = new Float32Array(n);
    for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) { k = y * MW + x; D[k] = clamp(Math.min(T[k], 70) + 9 + 8 * (nz(x / MW, y / MH) - 0.5), 18, 64); }
    D = blur(D, MW, MH, 2);
    yield;
    var E = blur(blur(maps.M, MW, MH, 6), MW, MH, 6);
    for (k = 0; k < n; k++) E[k] = Math.min(1, E[k] * 1.5);
    return { D: D, E: E };
  }

  // Les pierres : peu, surtout dans le sous-sol, jamais dans la fosse ; quelques graviers plus haut
  function makeStones() {
    var R = prng(23), out = [];
    for (var i = 0; i < 60 && out.length < 15; i++) {
      var deep = out.length < 10, x = lerp(DOM.x0 + 0.1, DOM.x1 - 0.1, R()), y = deep ? 0.5 + R() * 0.48 : 0.12 + R() * 0.3;
      var rx = deep ? 0.022 + R() * 0.042 : 0.008 + R() * 0.012, ry = rx * (0.55 + R() * 0.3);
      if (Math.abs(x) < 0.72 && y < T0 + SH + 0.12) continue;
      if (out.some(function (s) { return Math.hypot(s[0] - x, s[1] - y) < s[2] + rx + 0.05; })) continue;
      out.push([x, y, rx, ry, (R() - 0.5) * 0.7]);
    }
    return out;
  }

  // Les miettes du feutre, qui tombent en se mêlant au sol, et les spores sous les chapeaux mûrs
  function particles(maps, dm, sim) {
    var R = prng(41), crumbs = [], tries = 0;
    while (crumbs.length < 300 * 8 && tries++ < 20000) {
      var x = (R() - 0.5) * 1.0, y = T0 + R() * SH;
      if (!sim.inside(x, y)) continue;
      var u = shoeUV(x, y), k = Math.floor(u[1] * maps.MH) * maps.MW + Math.floor(u[0] * maps.MW), d = dm.D[k];
      crumbs.push(x, y, d - 1.5 + R() * 2, 0.5 + R() * 0.7, (R() - 0.5) * 0.004, 0.006 + R() * 0.012, R(), 0.3 + R() * 0.45);
    }
    var spores = [];
    FRUITS.forEach(function (m) {
      if (m.gmax || m.R < 0.06) return;
      var ripe = m.born + m.dur - 2, n = Math.round(520 * m.R);
      for (var i = 0; i < n; i++) {
        var p = rimPoint(m, (0.12 + 0.76 * R()) * Math.PI);
        spores.push(p[0], p[1] + R() * 0.012, lerp(Math.max(78.5, ripe), 89.6, Math.pow(R(), 0.85)), 0.35 + R() * 0.45, (R() - 0.5) * 0.006, 0.005 + R() * 0.007, R(), 0.3 + R() * 0.45);
      }
    });
    return { crumbs: new Float32Array(crumbs), spores: new Float32Array(spores) };
  }

  // ---------- 3. Les pleurotes : des fils et un voile, dans deux poses ----------
  // Un pleurote est un entonnoir de lames vu d'un peu au-dessus : le pied (un faisceau de fils qui s'évase à la base), le col, puis
  // les lames qui s'écartent jusqu'à la marge, festonnée. On voit le dehors de la paroi proche (les lames, qui descendent le long
  // du pied : décurrentes) et, par l'ouverture, le dedans de la paroi du fond. Le grand lobe est d'un côté : le chapeau est en
  // console, pas en parapluie.
  // Chaque point existe dans deux poses : le bouton (pied court et droit, chapeau refermé en bulbe) et le pleurote ouvert. La
  // carte graphique passe de l'une à l'autre (l'ouverture), et ne trace chaque fil que jusqu'à son front (les fils montent du sol
  // par leurs pointes). Pour chaque pleurote, quatre lots, dessinés dans cet ordre : le voile du fond, les fils du fond, le voile
  // du devant (qui masque ce qui est derrière lui), les fils du devant.
  //   fils (16 nombres par segment) : bouton (x0, y0, x1, y1), ouvert (x0, y0, x1, y1), (front au début, front à la fin, sorte,
  //     hasard), (largeur, intensité, part de la souche, halo) ; sorte 1 : n'apparaît qu'à l'ouverture (fond, marge)
  //   voile (8 nombres par sommet) : bouton (x, y), ouvert (x, y), (front, lumière, 0, 0)
  var RHO = 0.36, FS = 0.42;
  function fruitGeo(m) {
    var R = prng(m.seed * 13 + 1), ph = R() * 6.283, hb = 2 * m.rn + 0.3 * m.R, lf = [], ln = [], mf = [], mn = [], i, j;
    function frame(o) {
      var L = m.L * lerp(0.5, 1, o), lean = m.lean * lerp(0.3, 1, o), x0 = XF + m.bx, a = lean * 0.75;
      var P0 = [x0, 0.006], P1 = [x0 + Math.sin(lean) * L * 0.04, -L * 0.5], P2 = [x0 + Math.sin(a) * L, -Math.cos(a) * L];
      var ax = P2[0] - P1[0], ay = P2[1] - P1[1], al = Math.hypot(ax, ay) || 1;
      return { P0: P0, P1: P1, P2: P2, A: [ax / al, ay / al], P: [-ay / al, ax / al] };
    }
    var FR = [frame(0), frame(1)];
    function stemPt(o, t, phi) {
      var f = FR[o], u = 1 - t, x = u * u * f.P0[0] + 2 * u * t * f.P1[0] + t * t * f.P2[0], y = u * u * f.P0[1] + 2 * u * t * f.P1[1] + t * t * f.P2[1];
      var tx = u * (f.P1[0] - f.P0[0]) + t * (f.P2[0] - f.P1[0]), ty = u * (f.P1[1] - f.P0[1]) + t * (f.P2[1] - f.P1[1]), tl = Math.hypot(tx, ty) || 1;
      // (le long du pied, les fils du devant descendent un peu, comme sur le chapeau : aucune cassure au col)
      var rr = m.rn * (1 + 0.6 * Math.pow(1 - t, 2.2)), r = rr * Math.cos(phi), k = -RHO * rr * Math.sin(phi) * t * t;
      return [x - ty / tl * r + tx / tl * k, y + tx / tl * r + ty / tl * k];
    }
    function rimR(phi) { return m.R * (1 - m.ecc * (1 - Math.cos(phi - m.phi0)) / 2) * (1 + 0.06 * Math.sin(m.lobes * phi + ph) + 0.026 * Math.sin(m.lobes * 2.7 * phi + ph * 1.7)); }
    function capPt(o, u, phi) {
      var f = FR[o], rr, s;
      if (o) { rr = m.rn + (rimR(phi) - m.rn) * Math.pow(u, 1.85); s = m.h * (Math.pow(u, 0.9) + 0.11 * Math.sin(m.lobes * phi + ph + 1.3) * u * u * u - 0.1 * smooth(0.82, 1, u)); }
      else { rr = m.rn * (1 + 0.95 * Math.sin(Math.PI * u)) * Math.pow(1 - u * 0.998, 0.42); s = hb * u; }
      var k = s - RHO * rr * Math.sin(phi);
      return [f.P2[0] + f.A[0] * k + f.P[0] * rr * Math.cos(phi), f.P2[1] + f.A[1] * k + f.P[1] * rr * Math.cos(phi)];
    }
    // Un point du pleurote : v de 0 (le sol) à FS (le col) le long du pied, puis jusqu'à 1 (la marge) le long du chapeau
    function at(o, v, phi) { return v < FS ? stemPt(o, v / FS, phi) : capPt(o, (v - FS) / (1 - FS), phi); }
    function line(out, phi, v0, v1, n, kind, w, I, hot, haze) {
      var rnd = R(), a0 = at(0, v0, phi), a1 = at(1, v0, phi);
      for (var k = 1; k <= n; k++) {
        var v = lerp(v0, v1, k / n), b0 = at(0, v, phi), b1 = at(1, v, phi);
        out.push(a0[0], a0[1], b0[0], b0[1], a1[0], a1[1], b1[0], b1[1], lerp(v0, v1, (k - 1) / n), v, kind, rnd, w, I, hot, haze);
        a0 = b0; a1 = b1;
      }
    }
    function quad(out, v0, v1, p0, p1, sh0, sh1) {
      // deux triangles : (v0,p0) (v1,p0) (v1,p1) et (v0,p0) (v1,p1) (v0,p1)
      [[v0, p0, sh0], [v1, p0, sh1], [v1, p1, sh1], [v0, p0, sh0], [v1, p1, sh1], [v0, p1, sh0]].forEach(function (c) {
        var a = at(0, c[0], c[1]), b = at(1, c[0], c[1]); out.push(a[0], a[1], b[0], b[1], c[0], c[2], 0, 0);
      });
    }
    var PA = -0.05 * Math.PI, PB = 1.05 * Math.PI, big = m.R > 0.03;
    // a. Le fond : le dedans de la paroi du fond, vu par l'ouverture (un voile sombre, quelques fibrilles), et la marge du fond
    var NPF = big ? 18 : 8;
    for (j = 0; j < NPF; j++) for (i = 0; i < 5; i++) {
      var p0 = lerp(0.98 * Math.PI, 2.02 * Math.PI, j / NPF), p1 = lerp(0.98 * Math.PI, 2.02 * Math.PI, (j + 1) / NPF), u0 = lerp(0.3, 1, i / 5), u1 = lerp(0.3, 1, (i + 1) / 5);
      quad(mf, FS + (1 - FS) * u0, FS + (1 - FS) * u1, p0, p1, 0.05 + 0.07 * u0, 0.05 + 0.07 * u1);
    }
    var nFar = big ? 15 : 5;
    for (i = 0; i < nFar; i++) line(lf, lerp(1.1, 1.9, (i + 0.2 + R() * 0.6) / nFar) * Math.PI, FS + (1 - FS) * (0.46 + R() * 0.2), 1, 5, 1, 0.5, 0.18 + R() * 0.1, 0.8, 0);
    // b. Le devant : le pied et le dehors de la paroi proche (un voile plus clair vers la marge, où la chair est mince)
    for (i = 0; i < 8; i++) quad(mn, FS * i / 8, FS * (i + 1) / 8, 0, Math.PI, 0.1, 0.1);
    var NPN = big ? 26 : 10, NUN = big ? 10 : 6;
    for (j = 0; j < NPN; j++) for (i = 0; i < NUN; i++) {
      var q0 = lerp(PA, PB, j / NPN), q1 = lerp(PA, PB, (j + 1) / NPN), w0 = i / NUN, w1 = (i + 1) / NUN;
      quad(mn, FS + (1 - FS) * w0, FS + (1 - FS) * w1, q0, q1, 0.14 + 0.26 * w0 * w0, 0.14 + 0.26 * w1 * w1);
    }
    // les fils qui montent du sol jusqu'à la marge (les deux bords du pied, plus vifs, et des lames décurrentes)
    var NF = big ? 9 : 5;
    for (i = 0; i < NF; i++) { var edge = i === 0 || i === NF - 1; line(ln, lerp(-0.02, 1.02, i / (NF - 1)) * Math.PI, 0, 1, 22, 0, edge ? 0.95 : 0.6, edge ? 0.74 : 0.3 + R() * 0.14, 0.32, edge ? 0 : 0.1); }
    // les lames, du col à la marge, une plus vive toutes les trois ; entre elles, des lamellules, de la marge vers le col
    var NG = Math.round(big ? 30 + 330 * m.R : 12);
    for (i = 0; i < NG; i++) {
      var phi = lerp(PA, PB, (i + 0.15 + R() * 0.7) / NG), strong = i % 3 === 0;
      line(ln, phi, FS + (1 - FS) * (0.02 + R() * 0.2), 1, 12, 0, strong ? 0.72 : 0.55, strong ? 0.62 : 0.3 + R() * 0.1, 0.55, 0.14);
      if (big) line(ln, phi + (PB - PA) / NG * 0.5, FS + (1 - FS) * (0.5 + R() * 0.3), 1, 5, 0, 0.5, 0.24 + R() * 0.08, 0.6, 0.1);
    }
    // c. La marge : un liseré vif devant, plus fin au fond
    var NR = big ? 84 : 28;
    for (i = 0; i < NR; i++) {
      var r0 = i / NR * 6.2832, r1 = (i + 1) / NR * 6.2832, near = Math.sin((r0 + r1) / 2) > -0.05, rnd = R();
      var a0 = at(0, 1, r0), b0 = at(0, 1, r1), a1 = at(1, 1, r0), b1 = at(1, 1, r1);
      (near ? ln : lf).push(a0[0], a0[1], b0[0], b0[1], a1[0], a1[1], b1[0], b1[1], 0.97, 1, 1, rnd, near ? 1.1 : 0.7, near ? 0.92 : 0.46, near ? 0.2 : 0.5, 0);
    }
    return { lf: new Float32Array(lf), ln: new Float32Array(ln), mf: new Float32Array(mf), mn: new Float32Array(mn) };
  }
  // Un point de la marge proche d'un pleurote ouvert (les spores en tombent)
  function rimPoint(m, phi) {
    var a = m.lean * 0.75, x2 = XF + m.bx + Math.sin(a) * m.L, y2 = -Math.cos(a) * m.L;
    var x1 = XF + m.bx + Math.sin(m.lean) * m.L * 0.04, y1 = -m.L * 0.5, ax = x2 - x1, ay = y2 - y1, al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
    var rr = m.R * (1 - m.ecc * (1 - Math.cos(phi - m.phi0)) / 2), s = m.h * 0.9 - RHO * rr * Math.sin(phi);
    return [x2 + ax * s - ay * rr * Math.cos(phi), y2 + ay * s + ax * rr * Math.cos(phi)];
  }

  // ---------- 4. Les couleurs : rôles d'HYPHA, et sa palette pour la terre et les pleurotes ----------
  function palette(el, strain) {
    var cs = getComputedStyle(el);
    function v(n, d) { return hex(cs.getPropertyValue(n), d); }
    function hx(n, d) { var x = cs.getPropertyValue(n).trim(); return /^#[0-9a-f]{6}$/i.test(x) ? x : d; }
    var bg = v('--hy-color-bg', '#110F0D'), dark = lum(bg) < 0.35, my = function (k) { return v('--hy-palette-myc-' + k, '#777777'); }, am = function (k) { return v('--hy-palette-amber-' + k, '#8B5B02'); };
    var P = {}; [50, 100, 200, 300, 400, 500, 600, 700, 800].forEach(function (k) { P[k] = hx('--hy-palette-' + strain + '-' + k, '#F07AA2'); });
    var C = { dark: dark, bg: bg, gr: v('--hy-color-graphic', dark ? '#EDE9E1' : '#110F0D'), line: v('--hy-color-border-strong', '#898279'), ac: v('--hy-color-accent-graphic', '#F07AA2'), P: P };
    C.ac2 = hex(P[dark ? 300 : 500]);
    if (dark) {
      // La nuit de la chambre : quatre horizons sombres et chauds, de la litière brune au sous-sol gris cendre ; l'humus plus sombre,
      // d'un brun profond ; le feutre qui pourrit tire vers la terre d'ombre
      // (v4, fond noir : quatre horizons presque noirs, à peine plus clairs et plus froids en profondeur ; les grains de sable
      // sont les points clairs de la planche)
      C.s = [mixc(bg, my(900), 0.55), mixc(my(900), am(950), 0.12), mixc(my(900), my(850), 0.4), mixc(my(850), my(800), 0.22)];
      C.grain = mixc(my(400), am(300), 0.12); C.pore = mixc(bg, [0, 0, 0], 0.6); C.stone = mixc(my(600), my(500), 0.3); C.fleck = mixc(my(700), am(800), 0.3);
      C.hum = mixc(bg, [0, 0, 0], 0.35); C.huml = mixc(my(600), am(700), 0.3);
    } else {
      // Plein jour : un sol clair et chaud, de l'ocre de la litière au sable cendré ; l'humus brun
      C.s = [mixc(my(300), am(300), 0.4), mixc(my(300), am(200), 0.3), mixc(my(200), am(200), 0.38), mixc(my(200), my(300), 0.35)];
      C.grain = mixc(my(500), am(600), 0.25); C.pore = my(600); C.stone = mixc(my(400), am(300), 0.2); C.fleck = mixc(am(600), my(600), 0.3);
      C.hum = mixc(am(500), my(600), 0.55); C.huml = mixc(am(600), my(600), 0.4);
    }
    return C;
  }

  // ---------- 5. Le rendu, en WebGL 2 ----------
  var HEAD = '#version 300 es\nprecision highp float;\n';
  var NOISE = 'float hash(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}' +
    'float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}' +
    'float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s/.9375;}' +
    'vec2 vor(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y),o=vec2(hash(i+g),hash(i+g+31.7));float d=length(g+o-f);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}return vec2(d1,d2);}\n';
  var FULL = HEAD + 'void main(){gl_Position=vec4(float((gl_VertexID&1)<<2)-1.,float((gl_VertexID&2)<<1)-1.,0.,1.);}';
  // Le sol, cuit une fois par taille : horizons aux limites irrégulières, mottes et marbrures, sables, pores, débris, pierres
  var SOIL_FS = HEAD + 'uniform vec3 M;uniform vec2 res;uniform vec3 C0,C1,C2,C3,GRN,PORE,STONE,FLK;uniform vec4 ST[16];uniform vec4 SR[16];uniform int NS;uniform float DK,DPR;out vec4 o;' + NOISE +
    'void main(){vec2 px=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y);vec2 p=(px-M.xy)/M.z;float y=p.y;' +
    'float yy=y+.035*(fbm(p*vec2(3.,7.))-.5);' +
    'float h1=.06+.025*fbm(vec2(p.x*2.6,1.7)),h2=.34+.06*fbm(vec2(p.x*1.4,4.1)),h3=.72+.07*fbm(vec2(p.x*1.1,7.3));' +
    'vec3 c=mix(C0,C1,smoothstep(h1-.02,h1+.025,yy));c=mix(c,C2,smoothstep(h2-.07,h2+.07,yy));c=mix(c,C3,smoothstep(h3-.08,h3+.08,yy));' +
    // la structure : des mottes aux bords flous (cellules déformées), des marbrures, plus nettes dans l'horizon A
    'vec2 w=p+.03*vec2(fbm(p*8.)-.5,fbm(p*8.+5.)-.5);float cl=fbm(w*vec2(15.,19.)+11.);float cl2=fbm(w*vec2(38.,44.)+3.);float am=DK>.5?1.:.42;' +
    'float st=am*mix(.5,1.,smoothstep(.04,.2,y))*(1.-.6*smoothstep(.5,.95,y));c*=mix(1.,mix(.84,1.05,smoothstep(.36,.62,cl))*mix(.92,1.03,smoothstep(.4,.6,cl2)),st);' +
    'c*=1.+am*(.32*fbm(w*7.+3.)-.16);c*=1.+am*(.12*vn(w*60.)-.06);' +
    // grain : sables clairs, plus nombreux en profondeur ; pores sombres ; débris organiques allongés près de la surface
    'vec2 gp=floor(px/max(1.,DPR*.75));float g=hsh(gp),g2=hsh(gp+71.3);float sand=step(1.-(.008+.022*smoothstep(.2,.9,y)),g);' +
    'c=mix(c,GRN,sand*(.25+.35*g2));c=mix(c,PORE,step(g,.008+.014*(1.-smoothstep(.1,.5,y)))*.55);' +
    'vec2 fp=p*vec2(48.,170.);float fl=vn(fp+vec2(0.,floor(fp.x)*.37));float org=(1.-smoothstep(.05,.24,y))*smoothstep(.86,.95,fl);c=mix(c,FLK,org*.32);' +
    // les pierres : un dôme éclairé en haut à gauche, un grain, une ombre autour
    'for(int i=0;i<16;i++){if(i>=NS)break;vec4 s=ST[i];vec2 d=p-s.xy;float cs=SR[i].x,sn=SR[i].y;d=vec2(cs*d.x+sn*d.y,-sn*d.x+cs*d.y);vec2 l=d/s.zw;float r=length(l);' +
    'c*=1.-.4*(1.-smoothstep(1.,1.4,r))*step(1.,r);' +
    'float aa=1./(M.z*min(s.z,s.w));float a=1.-smoothstep(1.-aa,1.+aa,r);if(a>0.){float z=sqrt(max(0.,1.-r*r));vec3 n=normalize(vec3(l*.9,z+.15));' +
    'float lam=max(0.,dot(n,normalize(vec3(-.5,-.65,.6))));vec3 sc=STONE*(.5+.75*lam)*(.86+.28*vn(l*6.+s.xy*40.));sc+=STONE*.45*pow(lam,12.);' +
    'sc*=mix(1.,.7,smoothstep(.75,1.,r));c=mix(c,sc,a);}}' +
    'c*=mix(1.,.8,smoothstep(.55,1.1,y));o=vec4(c,1.);}';
  // Les fils, dans une texture : couverture (r), part de la souche (g), lueurs (b) ; fusion par maximum (aucun nœud aux jointures)
  var SEG_VS = HEAD + 'layout(location=0) in vec2 q;layout(location=1) in vec4 P;layout(location=2) in vec4 T;layout(location=3) in vec4 K;layout(location=4) in vec4 X;' +
    'uniform vec3 M;uniform vec2 res;uniform float day,WS;uniform float KW[7],KI[7],KH[7];' +
    'out vec2 vL;out float vLen,vW,vTA,vTB,vSA,vSB,vI,vHS,vPu,vK,vRn;' +
    'void main(){vL=vec2(0.);vLen=0.;vW=0.;vTA=0.;vTB=0.;vSA=0.;vSB=0.;vI=0.;vHS=1.;vPu=0.;vK=K.y;vRn=X.w;' +
    'if(day<T.x){gl_Position=vec4(2.,2.,0.,1.);return;}int k=int(K.y+.5);float f=clamp((day-T.x)/max(T.y-T.x,1e-4),0.,1.);' +
    'vec2 A=P.xy*M.z+M.xy,B=mix(A,P.zw*M.z+M.xy,f);' +
    'float w=.5*KW[k]*WS;if(k==1||k==4||k==6)w*=mix(.45,1.,smoothstep(0.,6.,day-T.x));' +
    'float I=KI[k];if(k==0){vec2 m=(P.xy+P.zw)*.5;float dist=length((m-vec2(0.,.28))*vec2(1.,1.6));float wake=smoothstep(0.,1.,(day-5.-dist*13.)/6.)*(1.-.5*smoothstep(45.,85.,day));' +
    'I*=(1.+1.2*wake)*(1.-X.x);}' +
    'if(k==0||k==1||k==2||k==6)I*=1.-.38*smoothstep(48.,80.,day);' +
    'float m=max(w,.5)+1.+(K.w>0.?4.*WS:0.);vec2 d=B-A;float L=length(d);vec2 u=L>1e-3?d/L:vec2(1.,0.),n=vec2(-u.y,u.x);' +
    'float al=mix(-m,L+m,q.x),ac=q.y*m;vec2 pos=A+u*al+n*ac;gl_Position=vec4(pos.x/res.x*2.-1.,1.-pos.y/res.y*2.,0.,1.);' +
    'vL=vec2(al,ac);vLen=L;vW=w;vTA=T.x;vTB=mix(T.x,T.y,f);vSA=T.z;vSB=mix(T.z,T.w,f);vI=I;vHS=KH[k];vPu=K.w;}';
  // Les impulsions : des comètes qui filent le long des cordons, une tête vive et une traîne, à intervalles irréguliers
  var SEG_FS = HEAD + 'in vec2 vL;in float vLen,vW,vTA,vTB,vSA,vSB,vI,vHS,vPu,vK,vRn;uniform float day,WS,BL;uniform vec4 PC,PR;out vec4 o;' +
    'void main(){if(vI<=0.)discard;float a=clamp(vL.x,0.,vLen);float dd=length(vec2(vL.x-a,vL.y));float we=max(vW,.5);' +
    'float cov=clamp(we+.5-dd,0.,1.)*(vW/we);float r=vLen>1e-3?a/vLen:1.;float age=day-mix(vTA,vTB,r);' +
    'float hot=vHS>0.?1.-smoothstep(0.,vHS,age):0.;if((vK>2.5&&vK<3.5)||(vK>4.5&&vK<5.5))hot=max(hot,BL);float g=0.;' +
    'if(vPu>0.){vec4 pp=vPu<1.5?PC:PR;float s=mix(vSA,vSB,r);float ph=(s-pp.x*day)/pp.y+vRn*7.31;float cyc=floor(ph);ph-=cyc;' +
    'float on=step(.35,fract(sin(cyc*12.9898+vRn*78.233)*43758.5453));float f2=(ph-.72)*pp.y;' +
    'float pk=(f2>0.?exp(-pow(f2/(pp.w*.3),2.)):exp(-pow(f2/pp.w,2.)))*pp.z*on;' +
    'g=pk*exp(-dd*dd/(5.*WS*WS))*.9;cov=max(cov,pk*clamp(we+1.1-dd,0.,1.));hot=max(hot,pk);}' +
    'o=vec4(cov*vI,cov*vI*hot,g,0.);}';
  // Les lueurs des pointes qui poussent : le bout de chaque fil, tant qu'il avance, puis elle s'éteint
  var TIP_VS = HEAD + 'layout(location=0) in vec2 q;layout(location=1) in vec4 P;layout(location=2) in vec4 T;layout(location=3) in vec4 K;layout(location=4) in vec4 X;' +
    'uniform vec3 M;uniform vec2 res;uniform float day,WS;uniform float KGR[7],KGI[7];out vec2 vQ;out float vI;' +
    'void main(){vQ=q;vI=0.;int k=int(K.y+.5);float ex=X.y>.5?K.z+2.6:T.y;if(KGI[k]<=0.||day<T.x||day>=ex){gl_Position=vec4(2.,2.,0.,1.);return;}' +
    'float f=clamp((day-T.x)/max(T.y-T.x,1e-4),0.,1.);vec2 tip=mix(P.xy,P.zw,f)*M.z+M.xy;' +
    'float life=smoothstep(0.,.7,day-X.z)*(X.y>.5?1.-smoothstep(K.z,K.z+2.6,day):1.);float r=KGR[k]*WS;vI=KGI[k]*life;' +
    'vQ=vec2(q.x*2.-1.,q.y)*2.2;vec2 pos=tip+vQ*r;gl_Position=vec4(pos.x/res.x*2.-1.,1.-pos.y/res.y*2.,0.,1.);}';
  var TIP_FS = HEAD + 'in vec2 vQ;in float vI;out vec4 o;void main(){float d=dot(vQ,vQ);float g=(exp(-d*1.3)+.7*exp(-d*9.))*vI;o=vec4(0.,0.,g,0.);}';
  // Les étincelles : le contact d'un cordon (un anneau qui s'ouvre), une fusion (un éclat bref), un primordium (une lueur qui dure)
  var SPK_VS = HEAD + 'layout(location=0) in vec2 q;layout(location=1) in vec4 A;layout(location=2) in vec4 B;uniform vec3 M;uniform vec2 res;uniform float day,WS;' +
    'out vec2 vQ;out float vK,vAge,vS;void main(){vQ=vec2(0.);vK=A.w;vAge=day-A.z;vS=B.x;float life=A.w<.5?3.2:A.w<1.5?1.2:9.;' +
    'if(vAge<0.||vAge>life){gl_Position=vec4(2.,2.,0.,1.);return;}float R=(A.w<.5?15.:A.w<1.5?4.:9.)*WS*max(.5,B.x);vec2 c=A.xy*M.z+M.xy;vQ=vec2(q.x*2.-1.,q.y);' +
    'vec2 pos=c+vQ*R;gl_Position=vec4(pos.x/res.x*2.-1.,1.-pos.y/res.y*2.,0.,1.);}';
  var SPK_FS = HEAD + 'in vec2 vQ;in float vK,vAge,vS;out vec4 o;void main(){float d=length(vQ),g;' +
    'if(vK<.5){float u=vAge/3.2,rr=1.-pow(1.-min(u*1.25,1.),3.);g=exp(-pow((d-rr*.92)/.06,2.))*pow(1.-u,1.6)*.75+exp(-d*d*30.)*exp(-vAge*2.2)*1.1;}' +
    'else if(vK<1.5){g=exp(-d*d*5.)*exp(-vAge*3.)*.8*vS;}else{g=exp(-d*d*3.)*smoothstep(0.,1.5,vAge)*(1.-smoothstep(4.,9.,vAge))*.8;}o=vec4(0.,0.,g,0.);}';
  // L'image : le sol, la fosse et l'humus, la paire (qui s'enfonce, brunit, s'efface), les fils et leurs lueurs
  var COMP_FS = HEAD + 'uniform sampler2D S,TH,SHO;uniform vec3 M;uniform vec2 res;uniform float day,DPR,DK,BUMP,PV,SHA,AU,FG;uniform vec4 SP;uniform vec2 FB;' +
    'uniform vec3 BG,GR,AC,AC2,HUM,HUML,LINE;out vec4 o;' + NOISE +
    'const float SH=' + SH.toFixed(6) + ',PAD=' + PAD.toFixed(3) + ',T0=' + T0.toFixed(3) + ';' +
    'vec2 suv(vec2 p,float top,float rot){vec2 c=vec2(0.,top+SH*.5),d=p-c;float cs=cos(rot),sn=sin(rot);d=vec2(cs*d.x+sn*d.y,-sn*d.x+cs*d.y);return (d+vec2(.5+PAD,SH*.5+PAD))/vec2(1.+2.*PAD,SH+2.*PAD);}' +
    'float box(vec2 u){return step(0.,u.x)*step(u.x,1.)*step(0.,u.y)*step(u.y,1.);}' +
    'void main(){vec2 px=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y),p=(px-M.xy)/M.z,uv=gl_FragCoord.xy/res;float u1=1./M.z;' +
    'float yg=-BUMP*exp(-p.x*p.x*3.);float soil=smoothstep(-.5*u1,.5*u1,p.y-yg);vec3 s=texture(S,uv).rgb;' +
    // la fosse rebouchée : une terre plus meuble et plus claire, aux bords irréguliers, qui se fond peu à peu dans le sol
    'vec2 pq=abs(p-vec2(0.,.25))-vec2(.56,.29);float dp=length(max(pq,0.))+min(max(pq.x,pq.y),0.)-.05+.06*(fbm(p*5.)-.5);float pin=1.-smoothstep(-.03,.03,dp);' +
    'float ls=hsh(floor(px/max(1.,DPR*.9))+13.);s=mix(s,s*(DK>.5?1.16:.95)+(step(.94,ls)*.04)*(DK>.5?1.:-1.),pin*PV);' +
    // l'humus : là où le feutre est parti, le sol plus sombre et plus brun, un peu au-delà de la paire ; autour, pendant la
    // colonisation, un halo de la souche
    'vec2 fu=suv(p,T0,0.);vec4 fs=texture(SHO,fu)*box(fu);float dz=10.+fs.b*60.;float hum=fs.a*smoothstep(dz-4.,dz+16.,day);' +
    's=mix(s,HUM*(.7+.6*fbm(p*24.)),hum*(DK>.5?.75:.42));' +
    'vec3 c=mix(BG,s,soil);c=DK>.5?c+AC2*fs.a*AU*soil:mix(c,AC,fs.a*AU*soil*.8);' +
    'float ln=1.-smoothstep(.3,1.15,abs(p.y-yg)*M.z/DPR);c=mix(c,LINE,ln*.6);' +
    // la paire
    'vec2 su=suv(p,SP.y,SP.z);if(box(su)>0.){vec4 t=texture(SHO,su);float dz2=10.+t.b*60.;float keep=1.-smoothstep(dz2-2.8,dz2+2.8,day);' +
    'float br=smoothstep(dz2-16.,dz2-1.,day);float a=t.r*keep*mix(1.,SHA,soil);vec3 col=DK>.5?GR*mix(.58,1.,t.g):GR;col=mix(col,HUML,br*.8);' +
    'c=mix(c,col,a);float rim=exp(-pow((day-dz2)/2.6,2.))*t.r*smoothstep(12.,20.,day);c=DK>.5?c+AC2*rim*.32:mix(c,AC,rim*.3);}' +
    // les fils, puis leurs lueurs (dans la nuit, elles éclairent ; en plein jour, elles teintent)
    'vec4 th=texture(TH,uv);float cov=clamp(th.r,0.,1.);vec3 tc=mix(GR,AC,clamp(th.g/max(th.r,.003),0.,1.));c=mix(c,tc,cov);' +
    'float g=th.b;c=DK>.5?c+AC2*g*1.05+vec3(1.)*pow(g,3.)*.3:mix(c,AC,clamp(g*.6,0.,1.));' +
    // la touffe éclaire le sol à son pied (rien dans l'air : sur le noir uni, une lueur aussi faible se verrait en paliers)
    'float fx=(p.x-FB.x)/(.26*FB.y),fl=FG*exp(-fx*fx)*exp(-max(p.y-yg,0.)*6.5)*soil;c=DK>.5?c+AC2*fl*.15:mix(c,AC,fl*.1);' +
    'o=vec4(c,1.);}';
  // Les miettes et les spores : de petits disques, chacun sur sa trajectoire
  var PT_VS = HEAD + 'layout(location=0) in vec2 q;layout(location=1) in vec4 A;layout(location=2) in vec4 B;uniform vec3 M;uniform vec2 res;uniform float day,WS,MODE;uniform vec4 CAP;uniform vec2 FB;' +
    'out vec2 vQ;out float vA,vR;void main(){vQ=vec2(0.);vA=0.;vR=1.;float age=day-A.z;float life=MODE<.5?7.5:10.;' +
    'if(age<0.||age>life){gl_Position=vec4(2.,2.,0.,1.);return;}vec2 p;float al;' +
    'if(MODE<.5){p=A.xy+vec2(B.x*age+.004*sin(age*1.6+B.z*6.28),B.y*(1.-exp(-age*.45))*2.2);al=B.w*smoothstep(0.,.6,age)*(1.-smoothstep(3.,7.5,age));}' +
    'else{p=vec2(FB.x,0.)+(A.xy-vec2(FB.x,0.))*FB.y+vec2(B.x*age+.007*sin(age*.85+B.z*6.28),B.y*age-.004*sin(age*1.3+B.z*3.));al=B.w*smoothstep(0.,.5,age)*(1.-smoothstep(6.5,10.,age))*(1.-smoothstep(-.012,-.002,p.y));}' +
    'vec2 c=p*M.z+M.xy;if(MODE>.5)al*=1.-step(CAP.x,c.x)*step(c.x,CAP.z)*step(CAP.y,c.y)*step(c.y,CAP.w);' +
    'vR=A.w*WS;vA=al;vQ=vec2(q.x*2.-1.,q.y)*(vR+1.);vec2 pos=c+vQ;gl_Position=vec4(pos.x/res.x*2.-1.,1.-pos.y/res.y*2.,0.,1.);}';
  var PT_FS = HEAD + 'in vec2 vQ;in float vA,vR;uniform vec3 COL;out vec4 o;void main(){float d=length(vQ);float a=clamp(vR+.5-d,0.,1.)*min(1.,vR*1.6)*vA;o=vec4(COL*a,a);}';
  // Les pleurotes. Le voile : chaque sommet passe du bouton au chapeau ouvert (O) ; il n'existe que derrière le front des fils (F) ;
  // il écrit sa lumière dans le canal des lueurs et masque ce qui est derrière lui (les pleurotes du fond, la paroi du fond)
  var FM_VS = HEAD + 'layout(location=0) in vec4 P;layout(location=1) in vec4 U;uniform vec3 M;uniform vec2 res,FB;uniform float O;out float vU,vS;' +
    'void main(){vec2 p=mix(P.xy,P.zw,O),c=vec2(FB.x,0.);p=(c+(p-c)*FB.y)*M.z+M.xy;vU=U.x;vS=U.y;gl_Position=vec4(p.x/res.x*2.-1.,1.-p.y/res.y*2.,0.,1.);}';
  var FM_FS = HEAD + 'in float vU,vS;uniform float F,TN,O,FAR;out vec4 o;void main(){float a=(1.-smoothstep(F-.05,F,vU))*mix(1.,smoothstep(.2,.7,O),FAR);if(a<=0.)discard;o=vec4(0.,0.,vS*TN*mix(.6,1.,O)*a,.94*a);}';
  // Les fils des pleurotes : tracés jusqu'à leur front, la pointe chaude tant qu'elle pousse (GROW), un halo léger autour des lames
  var FL_VS = HEAD + 'layout(location=0) in vec2 q;layout(location=1) in vec4 A;layout(location=2) in vec4 B;layout(location=3) in vec4 U;layout(location=4) in vec4 K;' +
    'uniform vec3 M;uniform vec2 res,FB;uniform float WS,F,O,TN;out vec2 vL;out float vLen,vW,vI,vHot,vUa,vUb,vHz,vF;' +
    'void main(){vL=vec2(0.);vLen=0.;vW=0.;vI=0.;vHot=0.;vUa=0.;vUb=0.;vHz=0.;float Fl=F-.1*U.w*(1.-smoothstep(.8,1.06,F));vF=Fl;if(Fl<=U.x){gl_Position=vec4(2.,2.,0.,1.);return;}' +
    'float f=clamp((Fl-U.x)/max(U.y-U.x,1e-4),0.,1.);vec2 a=mix(A.xy,B.xy,O),b=mix(A.zw,B.zw,O),c=vec2(FB.x,0.);a=c+(a-c)*FB.y;b=c+(b-c)*FB.y;' +
    'vec2 pa=a*M.z+M.xy,pb=mix(pa,b*M.z+M.xy,f);float w=.5*K.x*WS,I=K.y*TN;if(U.z>.5)I*=smoothstep(.25,.8,O);' +
    'float m=max(w,.5)+1.+5.*WS;vec2 d=pb-pa;float L=length(d);vec2 u=L>1e-3?d/L:vec2(1.,0.),n=vec2(-u.y,u.x);' +
    'float al=mix(-m,L+m,q.x),ac=q.y*m;vec2 pos=pa+u*al+n*ac;gl_Position=vec4(pos.x/res.x*2.-1.,1.-pos.y/res.y*2.,0.,1.);' +
    'vL=vec2(al,ac);vLen=L;vW=w;vI=I;vHot=K.z;vUa=U.x;vUb=mix(U.x,U.y,f);vHz=K.w*TN*mix(.5,1.,O);}';
  var FL_FS = HEAD + 'in vec2 vL;in float vLen,vW,vI,vHot,vUa,vUb,vHz,vF;uniform float WS,GROW;out vec4 o;' +
    'void main(){if(vI<=0.)discard;float a=clamp(vL.x,0.,vLen);float dd=length(vec2(vL.x-a,vL.y));float we=max(vW,.5);' +
    'float cov=clamp(we+.5-dd,0.,1.)*(vW/we);float r=vLen>1e-3?a/vLen:1.;float u=mix(vUa,vUb,r);float tip=exp(-pow((vF-u)/.05,2.))*GROW;' +
    'float I=min(1.,vI*(1.+.6*tip));float g=tip*.5*exp(-dd*dd/(7.*WS*WS))+vHz*exp(-dd*dd/(30.*WS*WS));o=vec4(cov*I,cov*I*max(vHot,tip),g,0.);}';

  function mountGL(cv) {
    var gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) return null;
    var st = { day: 0, ready: false, lay: null, C: null, sim: null, lost: false, baked: false };
    var P = {}, buf = {}, vao = {}, tex = {}, fbo = {}, dpr = 1, nSeg = 0, nSpk = 0, nCr = 0, nSp = 0, fruit = [];
    // Les shaders se compilent en parallèle (KHR_parallel_shader_compile) : rien ne bloque la page ; on les lit une fois prêts
    var par = gl.getExtension('KHR_parallel_shader_compile');
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    function prog(vs, fs) {
      var p = gl.createProgram(), a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
      return { p: p, u: null, s: [a, b] };
    }
    function compiled() { return !par || Object.keys(P).every(function (k) { return P[k].u || gl.getProgramParameter(P[k].p, par.COMPLETION_STATUS_KHR); }); }
    function finish() {
      Object.keys(P).forEach(function (k) {
        var pr = P[k], p = pr.p; if (pr.u) return;
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(k + ' : ' + (gl.getShaderInfoLog(pr.s[0]) || '') + (gl.getShaderInfoLog(pr.s[1]) || '') + gl.getProgramInfoLog(p));
        var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < n; i++) { var a = gl.getActiveUniform(p, i), nm = a.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, a.name); }
        pr.u = u;
      });
    }
    function texture(w, h, data, mip) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data || null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      return t;
    }
    function canvasTex(c, mip) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      return t;
    }
    function target(name) {
      if (tex[name]) gl.deleteTexture(tex[name]); if (fbo[name]) gl.deleteFramebuffer(fbo[name]);
      tex[name] = texture(Math.max(1, cv.width), Math.max(1, cv.height));
      fbo[name] = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[name]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex[name], 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // Un voile : des triangles, deux attributs par sommet
    function meshVAO(data) {
      var v = gl.createVertexArray(); gl.bindVertexArray(v);
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      for (var i = 0; i < 2; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 32, i * 16); }
      gl.bindVertexArray(null);
      return v;
    }
    function instVAO(data, layout) {
      var v = gl.createVertexArray(); gl.bindVertexArray(v);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.q); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      for (var i = 0; i < layout; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, layout * 16, i * 16); gl.vertexAttribDivisor(1 + i, 1); }
      gl.bindVertexArray(null);
      return v;
    }
    // Les ressources de la carte graphique : refaites telles quelles si le contexte est perdu puis rendu
    function init() {
      P.soil = prog(FULL, SOIL_FS); P.seg = prog(SEG_VS, SEG_FS); P.tip = prog(TIP_VS, TIP_FS); P.spk = prog(SPK_VS, SPK_FS);
      P.comp = prog(FULL, COMP_FS); P.pt = prog(PT_VS, PT_FS); P.fm = prog(FM_VS, FM_FS); P.fl = prog(FL_VS, FL_FS);
      buf.q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf.q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
      vao.empty = gl.createVertexArray();
      tex = {}; fbo = {}; fruit = [];
      if (st.sim) { finish(); upload(); }
    }
    function upload() {
      var D = st.sim;
      vao.seg = instVAO(D.seg, 4); nSeg = D.seg.length / 16;
      vao.spk = instVAO(D.spk, 2); nSpk = D.spk.length / 8;
      vao.cr = instVAO(D.crumbs, 2); nCr = D.crumbs.length / 8;
      vao.sp = instVAO(D.spores, 2); nSp = D.spores.length / 8;
      fruit = D.fruit.map(function (g) { return { lf: instVAO(g.lf, 4), nlf: g.lf.length / 16, ln: instVAO(g.ln, 4), nln: g.ln.length / 16, mf: meshVAO(g.mf), nmf: g.mf.length / 8, mn: meshVAO(g.mn), nmn: g.mn.length / 8 }; });
      tex.shoe = texture(D.TW, D.TH, D.shoe, true);
      sizeTargets();
    }
    function sizeTargets() { target('soil'); target('th'); st.baked = false; }
    function setU(pr, name, v) { var l = pr.u[name]; if (l == null) return; if (typeof v === 'number') gl.uniform1f(l, v); else if (v.length === 2) gl.uniform2fv(l, v); else if (v.length === 3) gl.uniform3fv(l, v); else gl.uniform4fv(l, v); }
    function M() { var l = st.lay; return [l.cx * dpr, l.gy * dpr, l.sw * dpr]; }
    // L'épaisseur des traits suit la taille de la paire, sans tomber trop bas (référence : 257 px)
    function ws() { return dpr * clamp(Math.sqrt(st.lay.sw / 257), 0.62, 1.05); }
    function common(pr) { setU(pr, 'M', M()); setU(pr, 'res', [cv.width, cv.height]); setU(pr, 'day', st.day); setU(pr, 'WS', ws()); setU(pr, 'DPR', dpr); }
    // La légende de la planche (px CSS) : les spores n'y passent pas
    function capPx() { var c = st.lay.cap || [0, 0, 0, 0]; return [c[0] * dpr, c[1] * dpr, c[2] * dpr, c[3] * dpr]; }
    function bake() {
      var C = st.C, pr = P.soil, S = st.stones;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.soil); gl.viewport(0, 0, cv.width, cv.height); gl.disable(gl.BLEND);
      gl.useProgram(pr.p); common(pr);
      setU(pr, 'C0', C.s[0]); setU(pr, 'C1', C.s[1]); setU(pr, 'C2', C.s[2]); setU(pr, 'C3', C.s[3]);
      setU(pr, 'GRN', C.grain); setU(pr, 'PORE', C.pore); setU(pr, 'STONE', C.stone); setU(pr, 'FLK', C.fleck); setU(pr, 'DK', C.dark ? 1 : 0);
      var a = new Float32Array(64), b = new Float32Array(64);
      S.forEach(function (s, i) { a.set([s[0], s[1], s[2], s[3]], i * 4); b.set([Math.cos(s[4]), Math.sin(s[4]), 0, 0], i * 4); });
      gl.uniform4fv(pr.u.ST, a); gl.uniform4fv(pr.u.SR, b); gl.uniform1i(pr.u.NS, S.length);
      gl.bindVertexArray(vao.empty); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); st.baked = true;
    }
    // Les pleurotes, du fond vers l'avant, dans la texture des fils : pour chacun, le voile du fond, ses fils, le voile du devant
    // (il masque ce qui est derrière), ses fils
    function drawFruit(d) {
      var l = st.lay, fm = P.fm, fl = P.fl, FBv = [XF, l.fruit];
      FRUITS.forEach(function (m, i) {
        var f = fruitState(m, d), G = fruit[i]; if (f.g <= 0 || !G) return;
        function veil(v, n, far) {
          gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          gl.useProgram(fm.p); setU(fm, 'M', M()); setU(fm, 'res', [cv.width, cv.height]); setU(fm, 'FB', FBv); setU(fm, 'O', f.O); setU(fm, 'F', f.F); setU(fm, 'TN', m.tint); setU(fm, 'FAR', far);
          gl.bindVertexArray(v); gl.drawArrays(gl.TRIANGLES, 0, n);
        }
        function lines(v, n) {
          gl.blendEquation(gl.MAX); gl.blendFunc(gl.ONE, gl.ONE);
          gl.useProgram(fl.p); setU(fl, 'M', M()); setU(fl, 'res', [cv.width, cv.height]); setU(fl, 'FB', FBv); setU(fl, 'WS', ws()); setU(fl, 'O', f.O); setU(fl, 'F', f.F); setU(fl, 'TN', m.tint);
          setU(fl, 'GROW', 1 - smooth(0.99, 1.06, f.F));
          gl.bindVertexArray(v); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
        }
        veil(G.mf, G.nmf, 1); lines(G.lf, G.nlf); veil(G.mn, G.nmn, 0); lines(G.ln, G.nln);
      });
      gl.blendEquation(gl.FUNC_ADD);
    }
    function render() {
      if (!st.ready || st.lost || !st.lay || !cv.width) return;
      var C = st.C, d = st.day, l = st.lay;
      if (!st.baked) bake();
      // a. Les fils et leurs lueurs, dans leur texture
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.th); gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendEquation(gl.MAX); gl.blendFunc(gl.ONE, gl.ONE);
      var pr = P.seg; gl.useProgram(pr.p); common(pr);
      gl.uniform1fv(pr.u.KW, KW); gl.uniform1fv(pr.u.KI, C.dark ? KI : KI.map(function (v) { return Math.min(1, v * 1.2); })); gl.uniform1fv(pr.u.KH, KH);
      setU(pr, 'BL', 0.42 * smooth(44, 82, d));
      setU(pr, 'PC', [0.04, 0.3, smooth(20, 27, d) * (1 - smooth(44, 54, d)), 0.05]);
      setU(pr, 'PR', [0.022, 0.1, smooth(59, 63, d) * (1 - smooth(83, 88, d)), 0.03]);
      gl.bindVertexArray(vao.seg); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nSeg);
      pr = P.tip; gl.useProgram(pr.p); common(pr); gl.uniform1fv(pr.u.KGR, KGR); gl.uniform1fv(pr.u.KGI, KGI);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nSeg);
      pr = P.spk; gl.useProgram(pr.p); common(pr); gl.bindVertexArray(vao.spk); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nSpk);
      drawFruit(d);
      gl.blendEquation(gl.FUNC_ADD);
      // b. L'image
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height); gl.disable(gl.BLEND);
      pr = P.comp; gl.useProgram(pr.p); common(pr);
      // La paire est en terre dès le jour 0 : rien ne descend, rien ne flotte ; la fosse rebouchée se fond peu à peu dans le sol
      setU(pr, 'SP', [0, T0, 0, 0]);
      setU(pr, 'BUMP', 0);
      setU(pr, 'PV', 1 - smooth(26, 84, d)); setU(pr, 'SHA', 0.92);
      setU(pr, 'AU', (C.dark ? 0.07 : 0.06) * smooth(12, 24, d) * (1 - smooth(46, 66, d)));
      setU(pr, 'DK', C.dark ? 1 : 0); setU(pr, 'FG', smooth(63, 85, d)); setU(pr, 'FB', [XF, l.fruit]);
      setU(pr, 'BG', C.bg); setU(pr, 'GR', C.gr); setU(pr, 'AC', C.ac); setU(pr, 'AC2', C.ac2); setU(pr, 'HUM', C.hum); setU(pr, 'HUML', C.huml); setU(pr, 'LINE', C.line);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.soil); gl.uniform1i(pr.u.S, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex.th); gl.uniform1i(pr.u.TH, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex.shoe); gl.uniform1i(pr.u.SHO, 2);
      gl.bindVertexArray(vao.empty); gl.drawArrays(gl.TRIANGLES, 0, 3);
      // c. Les miettes du feutre
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      pr = P.pt; gl.useProgram(pr.p); common(pr); setU(pr, 'MODE', 0); setU(pr, 'COL', C.huml); setU(pr, 'CAP', capPx()); setU(pr, 'FB', [XF, l.fruit]);
      gl.bindVertexArray(vao.cr); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nCr);
      // d. Les spores
      pr = P.pt; gl.useProgram(pr.p); common(pr); setU(pr, 'MODE', 1); setU(pr, 'COL', hex(C.P[C.dark ? 200 : 500])); setU(pr, 'CAP', capPx()); setU(pr, 'FB', [XF, l.fruit]);
      gl.bindVertexArray(vao.sp); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nSp);
      gl.disable(gl.BLEND); gl.bindVertexArray(null);
    }
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); st.lost = true; });
    cv.addEventListener('webglcontextrestored', function () { st.lost = false; init(); if (st.lay) layout(st.lay); render(); });
    function layout(l) {
      st.lay = l; dpr = l.dpr || Math.min(2, window.devicePixelRatio || 1);
      var w = Math.max(1, Math.round(l.W * dpr)), h = Math.max(1, Math.round(l.H * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; if (st.ready) sizeTargets(); }
      st.baked = false;
      if (st.ready) render();
    }
    init();
    return {
      st: st, gl: true,
      compiled: compiled,
      // Le réseau est prêt : les shaders lus (une erreur lève une exception : le montage passe au repli), les données envoyées ; les
      // chapeaux se dessinent au repos suivant, puis la première image
      prepared: function (sim, C) {
        finish(); st.sim = sim; st.stones = sim.stones; st.C = C; upload(); st.ready = true;
        idle(function () { render(); });
      },
      layout: layout,
      recolor: function (C) { st.C = C; st.baked = false; render(); },
      set: function (d) { st.day = d; render(); }
    };
  }

  // ---------- 6. Le repli, en canvas 2D : le même réseau et la même touffe, sans lueurs ni grain ----------
  function mount2D(cv) {
    var ctx = cv.getContext('2d'); if (!ctx) return null;
    var st = { day: 0, ready: false, lay: null, C: null, sim: null }, dpr = 1, shoeC = null;
    function render() {
      if (!st.ready || !st.lay) return;
      var l = st.lay, C = st.C, d = st.day, s = l.sw;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = css(C.bg); ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var gr = ctx.createLinearGradient(0, l.gy, 0, l.H); gr.addColorStop(0, css(C.s[0])); gr.addColorStop(0.3, css(C.s[1])); gr.addColorStop(1, css(C.s[3]));
      ctx.fillStyle = gr; ctx.fillRect(0, l.gy, l.W, l.H - l.gy);
      ctx.strokeStyle = css(C.line); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, l.gy); ctx.lineTo(l.W, l.gy); ctx.stroke();
      var y0 = T0, q = smooth(18, 62, d);
      if (shoeC && q < 1) { ctx.globalAlpha = 1 - q; ctx.drawImage(shoeC, l.cx - (0.5 + PAD) * s, l.gy + (y0 - PAD) * s, (1 + 2 * PAD) * s, (SH + 2 * PAD) * s); }
      ctx.lineCap = 'round'; ctx.strokeStyle = css(C.gr);
      var seg = st.sim.seg;
      for (var i = 0; i < seg.length; i += 16) {
        var t0 = seg[i + 4], t1 = seg[i + 5], k = seg[i + 9]; if (d < t0) continue;
        var f = clamp((d - t0) / Math.max(1e-4, t1 - t0), 0, 1);
        ctx.globalAlpha = KI[k] * (k === 0 ? 1 - seg[i + 12] : 1); ctx.lineWidth = KW[k] * 0.9;
        var x0 = l.cx + seg[i] * s, yy0 = l.gy + seg[i + 1] * s;
        ctx.beginPath(); ctx.moveTo(x0, yy0); ctx.lineTo(lerp(x0, l.cx + seg[i + 2] * s, f), lerp(yy0, l.gy + seg[i + 3] * s, f)); ctx.stroke();
      }
      // Les pleurotes : leurs fils, tracés jusqu'à leur front, entre le bouton et le chapeau ouvert
      ctx.strokeStyle = css(mixc(C.gr, C.ac, 0.45));
      FRUITS.forEach(function (m, i) {
        var f = fruitState(m, d), G = st.sim.fruit[i]; if (f.g <= 0) return;
        [G.lf, G.ln].forEach(function (a) {
          for (var k = 0; k < a.length; k += 16) {
            if (f.F <= a[k + 8]) continue;
            var fr = clamp((f.F - a[k + 8]) / Math.max(1e-4, a[k + 9] - a[k + 8]), 0, 1), fs = l.fruit;
            var ax = lerp(a[k], a[k + 4], f.O), ay = lerp(a[k + 1], a[k + 5], f.O), bx = lerp(a[k + 2], a[k + 6], f.O), by = lerp(a[k + 3], a[k + 7], f.O);
            ctx.globalAlpha = a[k + 13] * m.tint * (a[k + 10] > 0.5 ? smooth(0.25, 0.8, f.O) : 1); ctx.lineWidth = a[k + 12] * 0.9;
            ctx.beginPath(); ctx.moveTo(l.cx + (XF + (ax - XF) * fs) * s, l.gy + ay * fs * s); ctx.lineTo(l.cx + (XF + (lerp(ax, bx, fr) - XF) * fs) * s, l.gy + lerp(ay, by, fr) * fs * s); ctx.stroke();
          }
        });
      });
      ctx.globalAlpha = 1;
    }
    var api = {
      st: st, gl: false,
      prepared: function (sim, C) {
        st.sim = sim; st.C = C;
        var c = document.createElement('canvas'); c.width = sim.TW; c.height = sim.TH; var g = c.getContext('2d'), im = g.createImageData(sim.TW, sim.TH);
        for (var p = 0; p < sim.TW * sim.TH; p++) { im.data[p * 4] = C.gr[0] * 255; im.data[p * 4 + 1] = C.gr[1] * 255; im.data[p * 4 + 2] = C.gr[2] * 255; im.data[p * 4 + 3] = sim.shoe[p * 4]; }
        g.putImageData(im, 0, 0); shoeC = c;
        st.ready = true; render();
      },
      layout: function (l) { st.lay = l; dpr = l.dpr || Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(1, Math.round(l.W * dpr)); cv.height = Math.max(1, Math.round(l.H * dpr)); render(); },
      recolor: function (C) { if (st.sim) api.prepared(st.sim, C); },
      set: function (d) { st.day = d; render(); }
    };
    return api;
  }

  // ---------- 7. Le montage : la photo lue, le réseau calculé au repos, puis le rendu ----------
  // Le travail est découpé en tranches de quelques millisecondes (des générateurs), chacune dans un moment de repos du navigateur :
  // aucune image de la page ne saute pendant que le réseau se calcule.
  function idle(f) { return (window.requestIdleCallback || function (g) { return setTimeout(function () { g({ timeRemaining: function () { return 8; } }); }, 16); })(f, { timeout: 300 }); }
  function work(gen, done) {
    (function slice(dl) {
      var t0 = performance.now(), budget = clamp(dl && dl.timeRemaining ? dl.timeRemaining() : 8, 4, 10), r;
      do { r = gen.next(); } while (!r.done && performance.now() - t0 < budget);
      if (r.done) done(r.value); else idle(slice);
    })();
  }
  function mount(cv, opts) {
    var eng = null;
    try { eng = mountGL(cv); } catch (e) { if (window.console) console.warn('HyphaSoil, WebGL 2 :', e.message); eng = null; }
    if (!eng) eng = mount2D(cv);
    if (!eng) return null;
    var colors = function () { return palette(cv, opts.strain ? opts.strain() : 'pink'); }, lay = null, day = 0, busy = 0, most = 0, mostAt = '';
    // Des shaders refusés à l'édition des liens (un pilote capricieux) : un canvas neuf, et le repli en 2D
    function fallback(D, e) {
      if (window.console) console.warn('HyphaSoil, WebGL 2 :', e.message);
      var c2 = cv.cloneNode(false); cv.parentNode.replaceChild(c2, cv); cv = c2;
      eng = mount2D(cv); if (opts.onswap) opts.onswap(cv);
      if (lay) eng.layout(lay); eng.set(day); eng.prepared(D, colors());
    }
    function* pipeline(img) {
      var maps = yield* shoeMaps(img), stones = makeStones(), sim = yield* simulate(maps, stones);
      STAGE = 'effacement'; yield; var dm = yield* dissolveMaps(maps, sim);
      STAGE = 'particules'; yield; var pt = particles(maps, dm, sim); yield; STAGE = 'texture';
      // La texture de la paire : opacité, lumière, jour d'effacement, empreinte de l'humus
      var TW = maps.TW, TH = maps.TH, out = new Uint8Array(TW * TH * 4), MW = maps.MW, MH = maps.MH;
      for (var y = 0; y < TH; y++) {
        var fy = clamp((y + 0.5) / TH * MH - 0.5, 0, MH - 1), y0 = Math.floor(fy), y1 = Math.min(MH - 1, y0 + 1), wy = fy - y0;
        for (var x = 0; x < TW; x++) {
          var fx = clamp((x + 0.5) / TW * MW - 0.5, 0, MW - 1), x0 = Math.floor(fx), x1 = Math.min(MW - 1, x0 + 1), wx = fx - x0, p = y * TW + x;
          var a = y0 * MW + x0, b = y0 * MW + x1, c = y1 * MW + x0, dd = y1 * MW + x1;
          var Dv = lerp(lerp(dm.D[a], dm.D[b], wx), lerp(dm.D[c], dm.D[dd], wx), wy), Ev = lerp(lerp(dm.E[a], dm.E[b], wx), lerp(dm.E[c], dm.E[dd], wx), wy);
          out[p * 4] = maps.A[p]; out[p * 4 + 1] = maps.L[p]; out[p * 4 + 2] = Math.round(clamp((Dv - 10) / 60, 0, 1) * 255); out[p * 4 + 3] = Math.round(Ev * 255);
        }
        if ((y & 15) === 15) yield;
      }
      // Les fils, en segments : (x0, y0, x1, y1), (t0, t1, s0, s1), (largeur, sorte, fin du fil, impulsions), (fosse, dernier, début,
      // hasard). Autour de l'âme de chaque cordon, deux brins torsadés la suivent avec un temps de retard : le cordon s'épaissit
      // derrière son front.
      var segs = [], R = prng(3); STAGE = 'segments';
      // (v4) Chaque fil est lissé avant d'être découpé en segments : deux passes de Chaikin, positions et jours ensemble ; ses
      // deux bouts ne bougent pas (les fusions et les départs restent à leur place)
      function chaikin(p, it) {
        for (var k = 0; k < it; k++) {
          var n = p.length / 3; if (n < 3) break;
          var q = [p[0], p[1], p[2]];
          for (var i = 0; i < n - 1; i++) {
            var a = i * 3, b = a + 3;
            q.push(0.75 * p[a] + 0.25 * p[b], 0.75 * p[a + 1] + 0.25 * p[b + 1], 0.75 * p[a + 2] + 0.25 * p[b + 2], 0.25 * p[a] + 0.75 * p[b], 0.25 * p[a + 1] + 0.75 * p[b + 1], 0.25 * p[a + 2] + 0.75 * p[b + 2]);
          }
          q.push(p[n * 3 - 3], p[n * 3 - 2], p[n * 3 - 1]); p = q;
        }
        return p;
      }
      function emit(p, kind, h, pulse, rr, lag, off, ph) {
        var n = p.length / 3, s = 0, bg = kind === 0, px0 = 0, py0 = 0;
        for (var i = 0; i < n; i++) {
          var x = p[i * 3], y = p[i * 3 + 1];
          if (off) {
            var j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1), tx = p[j * 3] - p[k * 3], ty = p[j * 3 + 1] - p[k * 3 + 1], tl = Math.hypot(tx, ty) || 1;
            var o = off * Math.sin(s * 52 + ph) * smooth(0, 0.03, s);
            x += -ty / tl * o; y += tx / tl * o;
          }
          if (i > 0) {
            var l = Math.hypot(p[i * 3] - p[i * 3 - 3], p[i * 3 + 1] - p[i * 3 - 2]);
            segs.push(px0, py0, x, y, bg ? -40 : p[i * 3 - 1] + lag, bg ? -40 : Math.max(p[i * 3 + 2] + lag, p[i * 3 - 1] + lag + 1e-3), s, s + l,
              KW[kind], kind, bg ? -40 : h.end + lag, pulse, h.pit, i === n - 1 ? 1 : 0, bg ? -40 : h.start + lag, rr);
            s += l;
          }
          px0 = x; py0 = y;
        }
      }
      for (var hi = 0; hi < sim.HY.length; hi++) {
        var h = sim.HY[hi]; if (h.pts.length < 6) continue;
        var rr = R(), cord = h.kind === 1 || h.kind === 4, sp = chaikin(h.pts, 2);
        emit(sp, h.kind, h, h.kind === 1 ? 1 : h.kind === 4 ? 2 : 0, rr, 0, 0, 0);
        if (cord) { var ph = R() * 6.28; emit(sp, 6, h, 0, rr, 0.8, 0.0042, ph); emit(sp, 6, h, 0, rr, 1.7, 0.0042, ph + 2.3); }
        if ((hi & 63) === 63) yield;
      }
      var spk = []; sim.sparks.forEach(function (s) { spk.push(s[0], s[1], s[2], s[3], s[4], 0, 0, 0); });
      // Les primordia percent quand le premier cordon montant touche la surface
      var pinT = sim.sparks.reduce(function (m, s) { return s[3] === 2 ? Math.min(m, s[2]) : m; }, 61);
      STAGE = 'pleurotes'; yield;
      var fruit = []; for (var fi = 0; fi < FRUITS.length; fi++) { fruit.push(fruitGeo(FRUITS[fi])); yield; }
      return { seg: new Float32Array(segs), spk: new Float32Array(spk), crumbs: pt.crumbs, spores: pt.spores, shoe: out, TW: TW, TH: TH, stones: stones, pinT: pinT, fruit: fruit };
    }
    function ready(D) {
      // Les shaders compilés en parallèle : on attend qu'ils soient prêts, sans bloquer
      if (eng.compiled && !eng.compiled()) { setTimeout(function () { ready(D); }, 40); return; }
      cv.setAttribute('data-soil-ms', Math.round(busy) + ' (tranche la plus longue : ' + most.toFixed(1) + ', ' + mostAt + ')');
      cv.setAttribute('data-soil-n', String(D.seg.length / 16));
      try { eng.prepared(D, colors()); } catch (e) { fallback(D, e); }
    }
    var img = new Image(); img.src = opts.src;
    // La photo décodée hors du fil principal (une image prête à dessiner), puis le calcul
    (img.decode ? img.decode() : new Promise(function (res) { img.onload = res; })).then(function () {
      return window.createImageBitmap ? createImageBitmap(img).catch(function () { return img; }) : img;
    }).then(function (src) {
      var gen = pipeline(src), timed = { next: function () { var t = performance.now(), st0 = STAGE, r = gen.next(), e = performance.now() - t; busy += e; if (e > most) { most = e; mostAt = st0; } return r; } };
      idle(function () { work(timed, ready); });
    }, function () { if (window.console) console.warn('HyphaSoil : photo de la paire illisible'); });
    return {
      get engine() { return eng.gl ? 'webgl2' : '2d'; },
      set: function (d) { day = d; eng.set(d); },
      layout: function (l) { lay = l; eng.layout(l); },
      recolor: function () { if (eng.st.ready) eng.recolor(colors()); },
      get ready() { return eng.st.ready; }
    };
  }

  // lab : les pièces détachées, pour le banc d'essai (planches des chapeaux)
  root.HyphaSoil = { mount: mount, XF: XF, FRUIT_W: FRUIT_W, FRUIT_H: FRUIT_H, SH: SH, T0: T0, lab: { FRUITS: FRUITS, fruitGeo: fruitGeo, fruitState: fruitState, palette: palette } };
})(window);
