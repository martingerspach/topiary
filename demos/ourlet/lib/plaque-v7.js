// Ourlet · plaque du pied de page (v7) : une enseigne d'acier brossé où le nom est déjà tracé ; à l'entrée du pied dans l'écran,
// le laser le découpe d'un seul geste, puis un long reflet traverse le nom et la lumière revient au visiteur.
// Références de métier :
//  - marquage avant découpe : la même tête trace d'abord les contours à faible puissance (repères, numéros de pièce) ; sur une
//    tôle sombre, le trait du régleur est une ligne claire, fine comme un cheveu, qui accroche la lumière ;
//  - FAO de découpe laser (TruTops Boost, BySoft, Lantek) : contours intérieurs d'une pièce avant son contour extérieur (une pièce
//    libérée bouge) ; amorce en arc tangent, dans la chute, jamais sur ce qu'on garde ; léger dépassement à la fermeture ;
//    petits contours à avance réduite ; ordre thermique : on ne coupe pas deux contours voisins de suite sur une tôle mince, d'où le
//    L sauté puis repris en dernier (sa fente d'abord, sinon l'îlot partirait avec la chute ; son contour finit par le bord roulé) ;
//  - perçage à la volée d'une tôle mince (1,5 mm, laser à fibre) : la tête ne s'arrête pas, le faisceau s'allume en marche sur
//    l'amorce ; déplacements à vide liés à la coupe, arrondis par la commande (aucun arrêt entre deux contours) ;
//  - commande numérique réglée pour la qualité du bord : avance de 56 m/min, accélération de 1,2 g le long du trajet et de 2 g dans
//    les courbes, à-coup borné (la vitesse passe par deux moyennes glissantes, le filtre des commandes à « profil en S ») ;
//    la tête ralentit dans un angle vif sans s'y arrêter ;
//  - la saignée : bain de fusion blanc-jaune, puis le rouge du corps noir qui refroidit, éteint en moins de deux secondes ;
//  - étincelles : gouttelettes éjectées en couronne au perçage, puis vers l'arrière de la coupe ; la plaque est vue de dessus,
//    l'air les freine et elles s'éteignent en vol ; filées par l'obturateur d'une caméra au 1/60 s (le bain de fusion aussi) ;
//  - la chute : une tôle plane lâchée à quelques millimètres d'une autre descend sur le film d'air qu'elle chasse (amortissement
//    par écrasement du film) : elle part vite, se pose sans rebond ;
//  - reflet anisotrope de Ward (G. Ward, « Measuring and modeling anisotropic reflection », 1992) : sur l'acier brossé, le reflet
//    d'une source s'étire en travers du brossage ; la tête de coupe en est une, chaude, qui glisse avec elle ;
//  - le masque du soudeur : la lumière d'ambiance baisse d'un quart pendant que le faisceau travaille, et revient à la fin, quand
//    la table sort la tôle de sous le portique et que les tubes de l'atelier glissent d'un bout à l'autre de la plaque.
// L'enseigne mesure 42 cm (capitales de 7 cm). Le programme dure le même temps à toutes les tailles d'écran : la tête part à 0 s et ne
// s'arrête plus, dernier contour fermé à 4,4 s, reflet de 4,3 à 5,8 s, saignée éteinte à 6,2 s. Les lettres ne bougent jamais ; seules
// les chutes descendent. Le montage (programme, champ du nom) est réparti en tranches : aucune tâche longue, même au processeur ×4.
// Sous [data-calme], chaque canal est comprimé sous charbon-800 : givre-2 y garde au moins 7,86:1, tête, étincelles et reflet compris.
// Repli (sans WebGL2, mouvements réduits, couleurs forcées, contexte perdu) : img/plaque-repli-v7.jpg et le nom en SVG.
import { LOGO } from './marque.js';
import { MOTION, ticker, onceVisible } from './motion.js';
import { P, ILLU } from '../tokens/tokens-v2.js';

const [VX, VY, VW, VH] = LOGO.viewBox.split(' ').map(Number);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lisse = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const doux = (x) => { const k = clamp(x); return k * k * k * (k * (6 * k - 15) + 10); }; // départ et arrivée sans à-coup

// ---------- l'enseigne et la machine (unités du logotype, y vers le bas ; temps en ms) ----------
const REF = 0.36;                    // px CSS par mm dans le cadrage de référence des tokens (lib/film-atelier.js)
const MM = 70 / 729;                 // mm par unité : capitales de 7 cm, une plaque de 42 cm
const vit = (pxs) => pxs / REF / MM / 1000; // px/s du cadrage de référence → unités par ms
const G1 = 9.81e-3 / MM;             // 1 g
// Valeurs nouvelles de la v7 (à verser dans les tokens, MOTION.laser et MOTION.plaque) :
const QUALITE = 0.48;                // coupe de qualité des petits contours : part de l'avance du film (56 m/min)
const LIE = 1.45;                    // déplacement à vide lié à la coupe : part de l'avance de coupe
const ACC_T = 1.2 * G1, ACC_L = 2.0 * G1; // accélération le long du trajet ; de côté, dans les courbes
const COIN = 0.5;                    // vitesse dans un angle vif : part de l'avance
const LISSAGE = [72, 48];            // ms : les deux moyennes glissantes du profil en S
const AMORCE = { r: 110, ang: 20 };  // amorce en arc tangent : rayon (unités) et angle (degrés) ; le perçage est à 0,6 mm du bord
const DEPASSE = 8;                   // dépassement à la fermeture du contour
const ALLUME = 36, EXTINCTION = 14;  // ms : le faisceau monte en marche (perçage à la volée) ; le bain s'éteint
const POSE = MOTION.laser.chute?.ms ?? 420; // la chute est posée (à 1 % près) après ce temps
const FROID = 1800;                  // la saignée est éteinte 1,8 s après le passage de la tête
const OBTU = 1000 / 60;              // obturateur de la caméra imaginaire : étincelles et bain filent sur 1/60 s
const BAISSE = 0.26;                 // part de la lumière d'ambiance en moins pendant la coupe (le masque du soudeur)
const REFLET = { retard: -140, ms: 1560, marge: 0.2 }; // le reflet final : départ par rapport à la dernière fermeture (il entre pendant que le L descend), durée, débord (part de la largeur)
const VC = vit(MOTION.laser.coupe.v) * QUALITE, VV = VC * LIE;
const HOME = [-190, 44], GARE = [2452, 786]; // la tête entre par la gauche, à hauteur des capitales ; elle se relève sous le L

// Contours de coupe : le tracé du logotype, avec les recouvrements du dessin de la police fondus (R, E, T)
const SOUS = LOGO.d.split(/(?=M)/); // O ext., O int., U, R, L ext., fente du L, E, barre du E, fût du T, barre du T
const [R_EXT, R_INT] = (() => {
  const r = SOUS[3], i0 = r.indexOf('H 1881.57'), i1 = r.lastIndexOf('H 1895.57');
  if (i0 < 0 || i1 < i0) return [r, null];
  return [r.slice(0, i0) + r.slice(i1), 'M 1895.57,333.71 ' + r.slice(r.indexOf('H 2116.43', i0), i1) + 'H 1895.57Z'];
})();
const E_UNI = 'M 3108.14,729 V 0 H 3725.57 V 138.14 H 3282.57 V 296.29 H 3676.14 V 425.29 H 3282.57 V 590.57 H 3727.71 V 729 Z';
const T_UNI = 'M 3770.43,0 H 4431.29 V 139.57 H 4185.72 V 729 H 4012 V 139.57 H 3770.43 Z';
// Le geste : une suite de boucles tournées dans le sens horaire, chacune prise par le haut en allant vers la droite, comme une
// ligne d'écriture ; entre deux boucles la tête passe en guirlande sous la ligne des capitales. Après le T, elle revient d'un
// seul paraphe sous le nom et entre dans l'ourlet du L par son bord roulé : la fente, puis le contour, qui finit par ce bord.
// a : départ (le point du contour le plus proche) ; via : points de passage du déplacement à vide (x, y, direction).
const ORDRE = [
  { d: SOUS[1], l: 0, a: [364, 135.7] },
  { d: SOUS[0], l: 0, a: [603.43, 17.36], ext: 1 },
  { d: SOUS[2], l: 1, a: [992, 0], ext: 1 },
  { d: R_INT, l: 2, a: [1917, 132.43] },
  { d: R_EXT, l: 2, a: [2265.79, 9.07], ext: 1 },
  { d: E_UNI, l: 4, a: [3204, 0], ext: 1 },
  { d: T_UNI, l: 5, a: [3884, 0], ext: 1 },
  { d: SOUS[5], l: 3, a: [2936, 668.77], lent: 0.6, r: 70, ang: 24, via: [[4352, 372, 0, 1], [4010, 792, -1, 0], [3420, 796, -1, 0.02]] },
  { d: SOUS[4], l: 3, a: [2842, 729], ext: 1, r: 70, ang: 24 },
].filter((c) => c.d);
const CONTOURS = ORDRE.map((c) => c.d).join(' ');
const LIMITES = [877, 1670, 2466, 3077, 3749]; // entre les lettres (x), pour savoir quelle chute tombe : O U R L E T

function polyligne(d) {
  const T = d.match(/[MLHVQAZ]|-?[\d.]+/g), pts = [];
  let i = 0, c = '', x = 0, y = 0;
  const n = () => +T[i++];
  while (i < T.length) {
    if (/[A-Z]/.test(T[i])) c = T[i++];
    if (c === 'Z') break;
    if (c === 'M' || c === 'L') { x = n(); y = n(); pts.push([x, y]); c = 'L'; }
    else if (c === 'H') { x = n(); pts.push([x, y]); }
    else if (c === 'V') { y = n(); pts.push([x, y]); }
    else if (c === 'Q') { const qx = n(), qy = n(), ex = n(), ey = n();
      for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t; pts.push([u * u * x + 2 * u * t * qx + t * t * ex, u * u * y + 2 * u * t * qy + t * t * ey]); }
      x = ex; y = ey; }
    else if (c === 'A') { // les arcs du logotype sont des demi-cercles (l'ourlet et le bout de la fente)
      const r = n(); n(); n(); n(); const sw = n(), ex = n(), ey = n(), mx = (x + ex) / 2, my = (y + ey) / 2, a0 = Math.atan2(y - my, x - mx);
      for (let k = 1; k <= 24; k++) { const a = a0 + ((sw ? 1 : -1) * Math.PI * k) / 24; pts.push([mx + r * Math.cos(a), my + r * Math.sin(a)]); }
      x = ex; y = ey; }
    else i++;
  }
  const out = [];
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-3) out.push(p); }
  if (Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) < 1e-3) out.pop();
  return out;
}
const aire = (q) => { let a = 0; for (let i = 0, j = q.length - 1; i < q.length; j = i++) a += q[j][0] * q[i][1] - q[i][0] * q[j][1]; return a; }; // > 0 : sens horaire à l'écran
// courbe d'Hermite entre deux points et deux directions : le déplacement à vide part et arrive dans l'axe des coupes qu'il relie
function hermite(p0, d0, p1, d1, pas = 9) {
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.max(8, Math.ceil(L / pas)), out = [];
  for (let i = 1; i <= n; i++) {
    const u = i / n, u2 = u * u, u3 = u2 * u, a = 2 * u3 - 3 * u2 + 1, b = (u3 - 2 * u2 + u) * L, c = 3 * u2 - 2 * u3, e = (u3 - u2) * L;
    out.push([a * p0[0] + b * d0[0] + c * p1[0] + e * d1[0], a * p0[1] + b * d0[1] + c * p1[1] + e * d1[1]]);
  }
  return out;
}

// Le programme de la machine : un seul trajet, de l'entrée à la gare, parcouru sans arrêt ; ses instants, les chutes, les
// étincelles. Pur, déterministe, sans écran. En trois temps (la géométrie, les instants, les étincelles) que le montage répartit.
let GEO = null, TRAJ = null, PROG = null;
function geometrie() {
  if (GEO) return GEO;
  const polys = ORDRE.map((c) => { const q = polyligne(c.d); return aire(q) < 0 ? q.reverse() : q; });
  const dedans = (x, y) => { // pair-impair sur les contours fondus : vrai dans le nom (la chute)
    let k = false;
    for (const q of polys) for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      if ((q[i][1] > y) !== (q[j][1] > y) && x < ((q[j][0] - q[i][0]) * (y - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) k = !k;
    }
    return k;
  };

  // 1. la géométrie : nœuds du trajet ; vm est le plafond de vitesse du segment qui arrive au nœud, c le contour coupé (-1 : à vide)
  const nd = [{ p: HOME, vm: VV, c: -1 }], rep = [];
  let pos = HOME, dir = [1, 0];
  const vide = (to, dTo, via = []) => {
    for (const w of [...via, [to[0], to[1], dTo[0], dTo[1]]]) {
      const b = [w[0], w[1]], l = Math.hypot(w[2], w[3]), db = [w[2] / l, w[3] / l];
      for (const q of hermite(pos, dir, b, db)) nd.push({ p: q, vm: VV, c: -1 });
      pos = b; dir = db;
    }
  };
  ORDRE.forEach((c, ci) => {
    const q = polys[ci];
    let bi = 0, bu = 0, bd = Infinity;
    for (let i = 0; i < q.length; i++) {
      const a = q[i], b = q[(i + 1) % q.length], dx = b[0] - a[0], dy = b[1] - a[1];
      const u = clamp(((c.a[0] - a[0]) * dx + (c.a[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)), d = Math.hypot(a[0] + u * dx - c.a[0], a[1] + u * dy - c.a[1]);
      if (d < bd) { bd = d; bi = i; bu = u; }
    }
    const a = q[bi], b = q[(bi + 1) % q.length], s = [a[0] + (b[0] - a[0]) * bu, a[1] + (b[1] - a[1]) * bu];
    const tour = [s, ...q.slice(bi + 1), ...q.slice(0, bi + 1), s].filter((p, i, arr) => !i || Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) > 1e-3);
    const tl = Math.hypot(tour[1][0] - s[0], tour[1][1] - s[1]), d = [(tour[1][0] - s[0]) / tl, (tour[1][1] - s[1]) / tl];
    let n = [-d[1], d[0]]; // vers la chute
    if (!dedans(s[0] + n[0] * 3, s[1] + n[1] * 3)) n = [d[1], -d[0]];
    // amorce : un arc tangent au contour, dans la chute ; le faisceau s'allume à son début, la tête déjà lancée
    const r = c.r || AMORCE.r, ang = ((c.ang || AMORCE.ang) * Math.PI) / 180, na = Math.max(5, Math.ceil((r * ang) / 5)), arc = [];
    for (let i = 0; i <= na; i++) { const al = ang * (1 - i / na), k = r * (1 - Math.cos(al)), m = r * Math.sin(al); arc.push([s[0] + n[0] * k - d[0] * m, s[1] + n[1] * k - d[1] * m]); }
    vide(arc[0], [d[0] * Math.cos(ang) - n[0] * Math.sin(ang), d[1] * Math.cos(ang) - n[1] * Math.sin(ang)], c.via);
    const vm = VC * (c.lent || 1), iOn = nd.length - 1;
    for (let i = 1; i < arc.length; i++) nd.push({ p: i === arc.length - 1 ? s : arc[i], vm, c: ci });
    const iS = nd.length - 1;
    for (let i = 1; i < tour.length; i++) nd.push({ p: tour[i], vm, c: ci });
    const iFerme = nd.length - 1;
    let reste = DEPASSE; // dépassement : la tête repasse sur le début du contour
    for (let i = 1; i < tour.length && reste > 0; i++) {
      const p0 = tour[i - 1], p1 = tour[i], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), k = Math.min(1, reste / L);
      nd.push({ p: [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k], vm, c: ci }); reste -= L * k;
      if (k < 1) break;
    }
    const e1 = nd.at(-1).p, e0 = nd.at(-2).p, el = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
    pos = e1; dir = [(e1[0] - e0[0]) / el, (e1[1] - e0[1]) / el];
    rep.push({ iOn, iS, iFerme, iOff: nd.length - 1, l: c.l, ext: !!c.ext });
  });
  vide(GARE, [-1, 0.1]);

  // 2. plafond de vitesse à chaque nœud : avance du segment, accélération de côté dans les courbes, ralenti dans les angles vifs
  const NN = nd.length, plaf = new Float64Array(NN);
  for (let i = 1; i < NN - 1; i++) {
    const p = nd[i].p, a = nd[i - 1].p, b = nd[i + 1].p, ux = p[0] - a[0], uy = p[1] - a[1], wx = b[0] - p[0], wy = b[1] - p[1], lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
    const th = Math.acos(clamp((ux * wx + uy * wy) / (lu * lw || 1), -1, 1));
    let v = Math.min(nd[i].vm, nd[i + 1].vm);
    if (th > 0.6) v = Math.min(v, COIN * VC);
    else if (th > 1e-4) v = Math.min(v, Math.sqrt((ACC_L * Math.min(lu, lw)) / th));
    plaf[i] = v;
  }
  // 3. le trajet, par pas de 4 unités
  const X = [], Y = [], S = [], C = [], lim = [], ou = new Int32Array(NN);
  X.push(HOME[0]); Y.push(HOME[1]); S.push(0); C.push(-1); lim.push(0);
  for (let i = 1; i < NN; i++) {
    const a = nd[i - 1].p, b = nd[i].p, L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 4)), s0 = S[S.length - 1];
    for (let k = 1; k <= n; k++) { X.push(a[0] + ((b[0] - a[0]) * k) / n); Y.push(a[1] + ((b[1] - a[1]) * k) / n); S.push(s0 + (L * k) / n); C.push(nd[i].c); lim.push(k === n ? plaf[i] : nd[i].vm); }
    ou[i] = X.length - 1;
  }
  return (GEO = { X, Y, S, C, lim, ou, rep, polys, dedans });
}
function trajet() {
  if (TRAJ) return TRAJ;
  const { X, Y, S, C, lim, ou, rep, polys, dedans } = geometrie(), N = X.length, long = S[N - 1];
  // 4. profil en trapèze (accélération bornée), puis lissage de la vitesse dans le temps : la distance est gardée, l'à-coup borné
  const v = Float64Array.from(lim); v[0] = 0; v[N - 1] = 0;
  for (let i = 1; i < N; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * ACC_T * (S[i] - S[i - 1])));
  for (let i = N - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * ACC_T * (S[i + 1] - S[i])));
  const tt = new Float64Array(N);
  for (let i = 1; i < N; i++) tt[i] = tt[i - 1] + (2 * (S[i] - S[i - 1])) / Math.max(v[i - 1] + v[i], 1e-6);
  const M = Math.ceil(tt[N - 1]) + LISSAGE[0] + LISSAGE[1] + 2;
  let vs = new Float64Array(M + 1);
  for (let k = 0, i = 0; k <= M && k < tt[N - 1]; k++) { while (i < N - 2 && tt[i + 1] <= k) i++; vs[k] = v[i] + ((v[i + 1] - v[i]) * (k - tt[i])) / (tt[i + 1] - tt[i]); }
  for (const w of LISSAGE) { const o = new Float64Array(M + 1); let acc = 0; for (let k = 0; k <= M; k++) { acc += vs[k]; if (k >= w) acc -= vs[k - w]; o[k] = acc / w; } vs = o; }
  const sT = new Float64Array(M + 1);
  for (let k = 1; k <= M; k++) sT[k] = sT[k - 1] + 0.5 * (vs[k - 1] + vs[k]);
  const ech = long / sT[M];
  for (let k = 0; k <= M; k++) sT[k] *= ech;
  const tArret = M;
  // instant de passage à chaque point du trajet
  const tp = new Float64Array(N);
  for (let i = 0, k = 0; i < N; i++) { while (k < M - 1 && sT[k + 1] < S[i]) k++; const ds = sT[k + 1] - sT[k]; tp[i] = ds > 1e-9 ? k + clamp((S[i] - sT[k]) / ds) : k; }
  tp[N - 1] = M;
  // la tête à l'instant t
  const tete = (t) => {
    if (t <= 0) return [X[0], Y[0]];
    if (t >= M) return [X[N - 1], Y[N - 1]];
    const k = Math.floor(t), s = sT[k] + (sT[k + 1] - sT[k]) * (t - k);
    let lo = 0, hi = N - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const u = (s - S[lo]) / (S[hi] - S[lo] || 1);
    return [X[lo] + (X[hi] - X[lo]) * u, Y[lo] + (Y[hi] - Y[lo]) * u];
  };

  // 5. les coupes (faisceau allumé de l'amorce au dépassement), les chutes
  const cuts = rep.map((r) => ({ l: r.l, ext: r.ext, i0: ou[r.iOn], i1: ou[r.iOff], tOn: tp[ou[r.iOn]], tS: tp[ou[r.iS]], tFerme: tp[ou[r.iFerme]], tOff: tp[ou[r.iOff]] }));
  const chutes = cuts.filter((c) => c.ext).map((c) => ({ l: c.l, t0: c.tFerme + 40 }));
  const tFin = cuts.at(-1).tOff, r0 = tFin + REFLET.retard;
  const fin = Math.max(tFin + FROID, r0 + REFLET.ms, tArret, ...chutes.map((c) => c.t0 + 3 * POSE));
  TRAJ = { X, Y, S, C, tp, sT, cuts, chutes, fin, tFin, tArret, r0, long, tete, dedans, polys };
  return TRAJ;
}
export function programme() {
  if (PROG) return PROG;
  const G = trajet(), { X, Y, cuts, tete } = G, sparks = [];
  let seed = 7;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let r = Math.imul(seed ^ (seed >>> 15), 1 | seed); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  for (const c of cuts) {
    const pc = [X[c.i0], Y[c.i0]];
    for (let k = 0; k < 4; k++) { // projections du perçage : quelques gouttes, l'une après l'autre, d'allures très inégales
      const th = rnd() * Math.PI * 2, q = rnd(), v0 = 1 + 3.4 * q * q;
      sparks.push({ te: c.tOn + 2 + k * 14 + 10 * rnd(), p: pc, v: [Math.cos(th) * v0, Math.sin(th) * v0], life: 50 + 100 * rnd(), w: 0.45 + 0.4 * rnd() });
    }
    // étincelles de coupe : vers l'arrière, à la cadence de la vitesse
    for (let t = c.tOn + 60; t < c.tOff - 10;) {
      const te = t, h = tete(t), h2 = tete(t + 4), dx = h2[0] - h[0], dy = h2[1] - h[1], dl = Math.hypot(dx, dy), al = dl / 4 / VC;
      t += (52 + 60 * rnd()) / Math.max(0.5, Math.sqrt(al));
      if (dl < 1e-3 || al < 0.2) continue;
      const th = Math.atan2(-dy, -dx) + (rnd() - 0.5) * 1.1, v0 = (1.1 + 2.1 * rnd()) * Math.sqrt(al);
      sparks.push({ te, p: h, v: [Math.cos(th) * v0, Math.sin(th) * v0], life: 45 + 65 * rnd(), w: 0.4 + 0.4 * rnd() });
    }
  }
  sparks.sort((a, b) => a.te - b.te);
  return (PROG = { ...G, sparks });
}

// enfoncement d'une chute (0 → 1) : elle part sous son poids et se pose sur le film d'air, sans rebond (réponse amortie critique)
const T_POSE = POSE / 6.64; // 1 - (1 + x) e^-x vaut 0,99 à x = 6,64
function enfoncement(tau) {
  if (tau <= 0) return 0;
  const x = tau / T_POSE;
  return x > 24 ? 1 : 1 - (1 + x) * Math.exp(-x);
}
// scintillement du procédé : bruit continu (somme de sinus incommensurables), jamais par sauts
const scint = (t) => 0.9 + 0.035 * Math.sin(t * 0.071) + 0.035 * Math.sin(t * 0.1733 + 1.3) + 0.03 * Math.sin(t * 0.389 + 0.4);

// État de la machine à l'instant t (ms) : tête, bain de fusion (sa position et les deux d'avant : le filé de l'obturateur), éclat du
// procédé, lampe de la tête, enfoncement des six chutes, étincelles, lumière d'ambiance (gain), reflet final (position en unités, force)
export function etat(t) {
  const G = programme();
  const head = G.tete(t), av = G.tete(t + 2), dl = Math.hypot(av[0] - head[0], av[1] - head[1]);
  const dir = dl > 1e-4 ? [(av[0] - head[0]) / dl, (av[1] - head[1]) / dl] : [1, 0];
  // le faisceau monte en marche (un éclat au perçage) et s'éteint net à la fin du contour ; le bain ne suit pas la tête qui
  // repart : il reste où le faisceau l'a laissé, et c'est la saignée qui garde sa chaleur
  let proc = 0, bain = [head, head, head];
  for (const c of G.cuts) {
    if (t < c.tOn) break;
    const k = lisse(c.tOn, c.tOn + ALLUME, t) * (1 + 0.35 * Math.exp(-(t - c.tOn) / 70)) * (t < c.tOff ? 1 : Math.exp(-(t - c.tOff) / EXTINCTION));
    if (k >= proc) { proc = k; const tb = Math.min(t, c.tOff); bain = [G.tete(tb), G.tete(Math.max(c.tOn, tb - OBTU / 2)), G.tete(Math.max(c.tOn, tb - OBTU))]; }
  }
  proc *= scint(t);
  const veille = lisse(0, MOTION.presse.approche.ms, t) * (1 - lisse(G.tFin, G.tArret, t));
  const z = [0, 0, 0, 0, 0, 0];
  for (const c of G.chutes) z[c.l] = enfoncement(t - c.t0);
  const sp = [];
  for (let i = G.sparks.length - 1; i >= 0 && sp.length < 12; i--) {
    const s = G.sparks[i];
    if (s.te < t - 400) break; // triées : les plus anciennes sont éteintes
    const tau = t - s.te;
    if (tau < 0 || tau >= s.life) continue;
    const pos = (x) => { const e = 32 * (1 - Math.exp(-x / 32)); return [s.p[0] + s.v[0] * e, s.p[1] + s.v[1] * e]; }; // vue de dessus : l'air freine, rien ne retombe à l'écran
    sp.push({ a: pos(Math.max(0, tau - OBTU)), b: pos(tau), age: tau / s.life, w: s.w });
  }
  // la lumière d'ambiance baisse quand le faisceau s'allume, revient pendant que le reflet traverse le nom
  const gain = 1 - BAISSE * (lisse(0, 700, t) - lisse(G.r0, G.r0 + REFLET.ms, t));
  const u = (t - G.r0) / REFLET.ms, m = REFLET.marge * VW;
  const reflet = { x: VX - m + (VW + 2 * m) * doux(u), y: VY + VH / 2, k: lisse(0, 0.2, u) * (1 - lisse(0.72, 1, u)) };
  return { head, bain, proc, veille, dir, z, sp, gain, reflet };
}

// ---------- le rendu ----------
const FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform vec2 uRes;
uniform float uDpr, uFade, uBevel, uT, uKerf, uHalo, uBand, uZmax, uGain, uTrace;
uniform vec3 uLight;      // la lampe du visiteur : position sur la plaque (px CSS, y vers le bas) et hauteur
uniform vec4 uSheen;      // le reflet final : position, hauteur, force
uniform vec4 uHead;       // tête : position (px CSS), éclat du procédé, lampe de la tête
uniform vec2 uBain;       // bain de fusion : position (px CSS)
uniform vec4 uTrail;      // bain : ses positions un demi-obturateur et un obturateur plus tôt
uniform vec4 uHs;         // tête : hauteur de la source, portée, rayon du bain, rayon du halo (px CSS)
uniform ivec4 uBox;       // champ du nom, en px de l'écran (x, y, largeur, hauteur)
uniform float uLx[5];     // frontières entre les lettres (px CSS)
uniform float uZ[6];      // enfoncement des chutes O U R L E T
uniform vec4 uCalm[6];    // zones calmes (x0, y0, x1, y1)
uniform int uN, uNS;
uniform vec4 uSpk[12];    // étincelles : trait filé (x0, y0, x1, y1)
uniform vec2 uSpkC[12];   // âge relatif, demi-épaisseur (px CSS)
uniform vec4 uSpkBox;
uniform vec3 uCol[10];    // plaque, reflet, contre-plaque, chanfrein, plafond, chaud, étincelle, ambre, rouge sombre, bronze (linéaires)
uniform sampler2D uMask;  // le nom : couverture, filtrée
uniform usampler2D uField;// r : distance signée au trajet (px CSS × 256, décalée), g : instant de coupe (ms ; 65535 jamais)
out vec4 outColor;

float hash(vec2 p) { uvec2 q = uvec2(ivec2(p) + 8192) * uvec2(1597334673u, 3812015801u); return float((q.x ^ q.y) * 1597334673u) * 2.328306e-10; }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f *= f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y); }
float brush(vec2 p) { return .55 * noise(p / vec2(260, 1.2)) + .3 * noise(p / vec2(44, .6)) + .15 * noise(p / vec2(700, 11)); }
float tole(vec2 p) { vec2 u = (p * uDpr - vec2(uBox.xy)) / vec2(uBox.zw); return u == clamp(u, 0., 1.) ? 1. - texture(uMask, u).r : 1.; }
// Ward anisotrope, plaque à plat brossée le long de x : le reflet s'étire en travers
float ward(vec3 l, float b, float k) {
  vec3 h = normalize(l + vec3(0, 0, 1));
  float ax = (.1 + .06 * b) * k, ay = .7, hn = max(h.z, .05), ht = h.x / ax, hb = h.y / ay;
  return exp(-(ht * ht + hb * hb) / (hn * hn)) / (12.57 * ax * ay * sqrt(max(l.z, .02)));
}
// rayonnement d'un acier qui refroidit (a en ms) : bain blanc-jaune, étincelle, ambre, rouge sombre, éteint
vec3 chaleur(float a) {
  vec3 c = mix(uCol[5], uCol[6], smoothstep(0., 70., a));
  c = mix(c, uCol[7], smoothstep(50., 320., a));
  c = mix(c, uCol[8], smoothstep(280., 800., a));
  return c * 2.4 * exp(-a / 420.) * (1. - smoothstep(1200., 1800., a));
}
float segd(vec2 p, vec2 a, vec2 b, out float u) { vec2 ab = b - a, ap = p - a; u = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-6), 0., 1.); return length(ap - ab * u); }

void main() {
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y), p = fc / uDpr;
  float b = brush(p), gr = .4 + 1.2 * b;
  vec3 alb = uCol[0] * (.8 + .4 * b), reflet = mix(uCol[1], uCol[9], .45);
  // la lampe du visiteur, et le reflet final (les tubes de l'atelier), plus haut, plus large, teinté de bronze
  vec3 lv = uLight - vec3(p, 0); vec3 l = normalize(lv);
  float I = uLight.z * uLight.z / dot(lv, lv), E = I * l.z, wl = ward(l, b, 1.) * E * .07;
  vec3 sv = uSheen.xyz - vec3(p, 0); vec3 sl = normalize(sv);
  float wy = (p.y - uSheen.y) * uDpr / (.85 * float(uBox.w)); // un tube court : le reflet ne déborde guère de la hauteur du nom
  float Is = uSheen.w * exp(-wy * wy * wy * wy) * uSheen.z * uSheen.z / dot(sv, sv), Es = Is * sl.z, ws = uSheen.w > 0. ? (.6 * ward(sl, b, .3) + .28 * ward(sl, b, 1.4)) * Es * .16 : 0.; // un cœur étroit, une jupe large
  vec3 refS = mix(uCol[1], uCol[9], .7);
  // la tête : le bain de fusion à fleur de tôle (éclat), la lampe de la tête ; leur reflet glisse avec elle
  vec3 hv = vec3(uHead.xy - p, uHs.x); float hd = dot(hv, hv); vec3 hl = hv * inversesqrt(hd);
  vec3 bv = vec3(uBain - p, uHs.x); float bd = dot(bv, bv); vec3 bl = bv * inversesqrt(bd);
  float Ih = .3 * uHead.w * uHs.y * uHs.y / (uHs.y * uHs.y + hd), Ib = uHead.z * uHs.y * uHs.y / (uHs.y * uHs.y + bd);
  vec3 hcol = mix(uCol[6], uCol[5], .35);
  vec3 tete = hcol * (Ih * hl.z * (alb * .9 + ward(hl, b, 1.) * gr * .3) + Ib * bl.z * (alb * .9 + ward(bl, b, 1.) * gr * .3));
  vec3 c = uGain * (alb * (.78 + .32 * E) + reflet * wl * gr) + alb * .08 * Es + refS * ws * gr + tete;
  ivec2 ip = ivec2(fc) - uBox.xy;
  if (all(greaterThanEqual(ip, ivec2(0))) && all(lessThan(ip, uBox.zw))) {
    uvec2 f = texelFetch(uField, ip, 0).rg;
    float sd = (float(f.r) - 32768.) / 256., tc = float(f.g), ink = texture(uMask, (vec2(ip) + .5) / vec2(uBox.zw)).r;
    int li = int(p.x > uLx[0]) + int(p.x > uLx[1]) + int(p.x > uLx[2]) + int(p.x > uLx[3]) + int(p.x > uLx[4]);
    float z = uZ[li], zp = uZmax * z, cut = step(tc, uT);
    // la chute descend : c'est la même tôle brossée, plus bas ; les parois lui prennent le ciel (plus sombre près des bords),
    // le bord de la plaque y porte une ombre à pénombre, du côté de la lampe
    if (ink > 0. && z > 0.) {
      vec2 o = (uLight.xy - p) * (zp / (uLight.z + zp));
      float s = 1. - (tole(p + o * .55) + tole(p + o) + tole(p + o * 1.5)) / 3.;
      float ra = max(1.2, zp * .85);
      float ao = 1. - .25 * (tole(p + vec2(ra, 0)) + tole(p - vec2(ra, 0)) + tole(p + vec2(0, ra)) + tole(p - vec2(0, ra)));
      float ss = uSheen.w > 0. ? 1. - tole(p + (uSheen.xy - p) * (zp / (uSheen.z + zp))) : 0.;
      float zk = smoothstep(0., 1., z);
      // (la tête est posée sur la tôle : elle n'éclaire pas le fond des lettres déjà descendues)
      vec3 piece = uGain * (alb * (.78 * mix(1., .2 + .3 * ao, zk) + .32 * E * mix(1., .9 * s, zk)) + reflet * wl * gr * mix(1., .55 * s, zk))
        + alb * .08 * Es * mix(1., ss, zk) + refS * ws * gr * mix(1., .6 * ss, zk) + tete * (1. - zk);
      c = mix(c, piece, ink);
    }
    // le bord : avant la coupe, le trait du régleur (une ligne claire qui accroche la lumière de son côté) ; après la chute, le
    // chanfrein du bord coupé (la pente tournée vers le haut reçoit le ciel, la lumière accroche le côté qui lui fait face)
    float bord = cut > 0. ? uBevel : uTrace;
    if (abs(sd) < bord + 2. && (cut < 1. || z > 0.)) {
      vec2 g = vec2(tole(p + vec2(bord, 0)) - tole(p - vec2(bord, 0)), tole(p + vec2(0, bord)) - tole(p - vec2(0, bord)));
      float e = length(g);
      if (e > .01) {
        vec2 dh = -g / e;
        float fl = max(dot(dh, normalize(uLight.xy - p + 1e-3)), 0.), Eb = uGain * I * max(dot(normalize(vec3(dh, 1.1)), l), 0.);
        float fs = max(dot(dh, normalize(uSheen.xy - p + 1e-3)), 0.), Ebs = Is * max(dot(normalize(vec3(dh, 1.1)), sl), 0.);
        float fh = 3. * (max(dot(dh, normalize(uHead.xy - p + 1e-3)), 0.) * Ih + max(dot(dh, normalize(uBain - p + 1e-3)), 0.) * Ib);
        if (cut > 0.) {
          vec3 ch = uCol[3] * (.05 * uGain + .2 * uGain * pow(max(-dh.y, 0.), 1.5) + fl * (.1 * Eb + 1.2 * Eb * Eb) + fs * (.2 * Ebs + 1.6 * Ebs * Ebs)) + hcol * fh * .25;
          c = mix(c, ch, (1. - ink) * smoothstep(.1, .6, e) * smoothstep(0., .5, z));
        } else {
          vec3 tr = uCol[3] * (uGain * (.11 + .5 * E * (.35 + .65 * fl))) + hcol * ((Ih + Ib) * .5 + fh * .2);
          c = mix(c, tr, smoothstep(.2, .9, e) * .78);
        }
      }
    }
    // la saignée : une fente de 0,2 mm du côté de la chute, presque noire, et le métal qui rougeoie puis refroidit
    if (cut > 0.) {
      float a = uT - tc, h = .5 / uDpr, kw = uKerf;
      float k = clamp((min(sd + h, kw) - max(sd - h, 0.)) / (2. * h), 0., 1.);
      c = mix(c, uCol[2] * .08, k * (1. - z));
      if (a < 1800.) {
        float dk = abs(sd - .5 * kw), sg = uHalo * mix(1.7, .55, smoothstep(0., 700., a));
        float core = clamp((.5 * kw + h - dk) / (2. * h), 0., 1.);
        // le cœur au ton du bain ; autour, le métal chauffé par conduction, d'autant moins chaud qu'il est loin de la fente
        c += chaleur(a) * core + chaleur(a + 240. * dk / sg) * .5 * exp(-dk / sg) * smoothstep(uBand, .55 * uBand, dk);
      }
    }
  }
  // le bain de fusion, filé sur un demi-obturateur le long du trajet, et son halo
  float u1, u2, d1 = segd(p, uBain, uTrail.xy, u1), d2 = segd(p, uTrail.xy, uTrail.zw, u2), r = length(p - uBain);
  // (une goutte : pleine à la tête, elle s'affine et s'éteint vers l'arrière)
  float du = d1 < d2 ? d1 : d2, uu = d1 < d2 ? .5 * u1 : .5 + .5 * u2, rb = uHs.z * (1. - .65 * uu), bain = exp(-du * du / (rb * rb)) * (1. - uu) * (1. - uu);
  c += mix(uCol[6], uCol[5], .7) * uHead.z * (3.2 * bain + .22 * exp(-r / uHs.w));
  // étincelles : traits filés, du blanc-jaune au rouge
  if (uNS > 0 && p.x > uSpkBox.x && p.y > uSpkBox.y && p.x < uSpkBox.z && p.y < uSpkBox.w) {
    float h = .5 / uDpr;
    for (int i = 0; i < 12; i++) {
      if (i >= uNS) break;
      float u, d = segd(p, uSpk[i].xy, uSpk[i].zw, u), w = uSpkC[i].y, ag = uSpkC[i].x;
      float cov = clamp((w + h - d) / (2. * h), 0., 1.) + .25 * exp(-d / (1.5 * w + h));
      c += chaleur(ag * 900.) * 1.3 * cov * (1. - ag) * (.55 + .45 * u);
    }
  }
  // zones calmes : genou doux, chaque canal reste sous le plafond (charbon-800)
  float zc = 0.;
  for (int i = 0; i < 6; i++) { if (i >= uN) break; vec2 e = max(uCalm[i].xy - p, p - uCalm[i].zw); zc = max(zc, 1. - smoothstep(0., uFade, length(max(e, 0.)))); }
  vec3 cap = uCol[4], j = .6 * cap;
  c = max(c, 0.);
  c = mix(c, min(c, j) + .4 * cap * (1. - exp(-max(c - j, 0.) / (.4 * cap))), zc);
  outColor = vec4(pow(c, vec3(1. / 2.2)), 1);
}`;
const VERT = '#version 300 es\nvoid main() { gl_Position = vec4(vec2(gl_VertexID & 1, gl_VertexID >> 1) * 2. - 1., 0, 1); }';
const UNIFORMES = ['uRes', 'uDpr', 'uFade', 'uBevel', 'uT', 'uKerf', 'uHalo', 'uBand', 'uZmax', 'uGain', 'uTrace', 'uLight', 'uSheen', 'uHead', 'uBain', 'uTrail', 'uHs', 'uBox',
  'uLx', 'uZ', 'uCalm', 'uN', 'uNS', 'uSpk', 'uSpkC', 'uSpkBox', 'uCol', 'uMask', 'uField'];
const lineaire = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2);
// rouge sombre : l'ambre filtré comme le spectre d'un corps noir qui refroidit (le vert et le bleu s'éteignent les premiers)
const couleurs = () => {
  const ambre = lineaire(P.ambre);
  return [lineaire(P['charbon-850']), lineaire(P['greige-400']), lineaire(P['charbon-900']), lineaire(P['greige-300']), lineaire(P['charbon-800']),
    lineaire(ILLU.chaud), lineaire(ILLU.etincelle), ambre, [ambre[0], ambre[1] * 0.28, ambre[2] * 0.12], lineaire(ILLU.bronze)].flat();
};
const CPU_REF = 0.31; // px CSS par unité du logotype à 1 440 px de large (le nom fait 1 368 px)
const BANDE = 6;      // px CSS autour du trajet où la chaleur et la saignée sont calculées
const REPOS = 3 * MOTION.rideau.ms; // écran tactile : la lumière dérive tant qu'on fait défiler, puis se pose
const SUIVI = 1 / 76, RETOUR = 1 / 230; // pulsations (par ms) du ressort amorti critique : la lampe suit le pointeur, revient au repos
const TRANCHE = 6;    // ms : part de travail du montage entre deux retours à la main (aucune tâche longue, même sur un processeur lent)
const plusTard = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 100 }) : setTimeout(fn, 16));

// Champ du nom, en px de l'écran : distance signée au trajet de coupe et instant de coupe du point le plus proche
// (« le plus tôt » à égalité : la fermeture et le dépassement ne repassent pas sur un trait déjà coupé).
// Calculé par tranches : avance(budget) travaille au plus budget ms et rend vrai quand le champ est prêt.
export function tramage(G, box, D, toDev, masque) {
  const [, , w, h] = box, N = w * h, BD = BANDE * D, EPS = 0.75, { X, Y, tp } = G;
  const best = new Float32Array(N).fill(BD), tcut = new Float32Array(N).fill(65535), segs = [];
  for (const cp of G.cuts) { // un segment par tronçon droit, recoupé toutes les 36 unités (l'instant de coupe y est interpolé)
    let a = cp.i0, pa = toDev([X[a], Y[a]]);
    for (let i = a + 1; i <= cp.i1; i++) {
      if (i < cp.i1 && Math.abs(X[i] - X[a]) + Math.abs(Y[i] - Y[a]) < 36 && Math.abs((X[i] - X[i - 1]) * (Y[i + 1] - Y[i]) - (Y[i] - Y[i - 1]) * (X[i + 1] - X[i])) < 1e-6) continue;
      const pb = toDev([X[i], Y[i]]); segs.push(pa[0], pa[1], tp[a], pb[0], pb[1], tp[i]); a = i; pa = pb;
    }
  }
  let k = 0, m = 0, out = null;
  return {
    avance(budget = Infinity) {
      const t0 = performance.now();
      while (k < segs.length) {
        for (const stop = Math.min(segs.length, k + 72); k < stop; k += 6) {
          const ax = segs[k], ay = segs[k + 1], ta = segs[k + 2], bx = segs[k + 3], by = segs[k + 4], dt = segs[k + 5] - ta, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
          const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - BD)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + BD));
          const y0 = Math.max(0, Math.floor(Math.min(ay, by) - BD)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + BD));
          for (let y = y0; y <= y1; y++) {
            const py = y + 0.5 - ay;
            for (let x = x0, i = y * w + x0; x <= x1; x++, i++) {
              const px = x + 0.5 - ax;
              let u = (px * dx + py * dy) / l2; u = u < 0 ? 0 : u > 1 ? 1 : u;
              const ex = px - u * dx, ey = py - u * dy, d2 = ex * ex + ey * ey, lim = best[i] + EPS;
              if (d2 >= lim * lim) continue;
              const d = Math.sqrt(d2), tt = ta + u * dt;
              if (d < best[i] - EPS) { best[i] = d; tcut[i] = tt; }
              else if (tt < tcut[i]) { tcut[i] = tt; if (d < best[i]) best[i] = d; }
              else if (d < best[i]) best[i] = d;
            }
          }
        }
        if (performance.now() - t0 > budget) return false;
      }
      if (!out) out = new Uint16Array(N * 2);
      while (m < N) {
        for (const stop = Math.min(N, m + 60000); m < stop; m++) {
          const v = 32768 + ((masque[m * 4] >= 128 ? 256 : -256) * best[m]) / D, c = tcut[m];
          out[2 * m] = v < 0 ? 0 : v > 65535 ? 65535 : v + 0.5; out[2 * m + 1] = c > 65535 ? 65535 : c + 0.5;
        }
        if (performance.now() - t0 > budget) return m >= N;
      }
      return true;
    },
    get champ() { return out; },
  };
}
export function champ(G, box, D, toDev, masque) { const j = tramage(G, box, D, toDev, masque); j.avance(); return j.champ; }

// opts : t (instant fixe, ?t=), light ({ x, y } en parts du pied : lampe fixe), still (état final fixe, ?fige=1),
// nu (la plaque sans le nom : sert à exporter l'image de repli), densiteMax
export function mountPlaque(foot, opts = {}) {
  const mark = foot.querySelector('[data-plaque-logo]'), sig = mark && mark.querySelector('svg'), ds = foot.dataset;
  const mqReduit = matchMedia('(prefers-reduced-motion: reduce)'), mqForce = matchMedia('(forced-colors: active)');
  const mode = opts.light ? 0 : matchMedia('(hover: hover) and (pointer: fine)').matches ? 1 : 2; // fixe, pointeur, dérive
  let reduit = mqReduit.matches, force = mqForce.matches, dead = false, joue = false, veut = false;
  let G = null, END = Infinity, t = opts.t ?? (reduit || opts.still ? END : 0); // le programme est calculé au montage du pied, pas au chargement de la page
  let cv, gl, prog, U = {}, lie = false, ready = false, lost = false, essaye = false, mc, mctx, tk, ro, io, stopSig, texM, texF;
  let tour = 0, enCours = '', fini = null; // tramage : numéro du dernier lancé, sa clé, celui qui attend d'être posé
  let W = 0, H = 0, D = 1, cpu = 1, z = 300, ox = 0, oy = 0, box = [0, 0, 1, 1], calm = [], cle = '';
  let x = 0, y = 0, vx = 0, vy = 0, tx = 0, ty = 0, rx = 0, ry = 0, place = false, cale = false, px = null, py = null, horloge = 0, elan = 0, defile = -1e9, nomGL = null;
  const ac = new AbortController(), on = { passive: true, signal: ac.signal };
  const spk = new Float32Array(48), spkC = new Float32Array(24);

  const enGL = () => ready && !lost && ds.plaque === 'gl';
  const vivant = () => !dead && !reduit && !force && !opts.still;
  const wake = () => tk && vivant() && tk.start();
  const programmer = () => { if (!G) { G = programme(); END = G.fin; t = Math.min(t, END); } return G; };
  // la couche SVG : transparente quand la plaque dessine le nom ; en repli, le nom en creux et le filet clair de son chanfrein
  // (tracé sur les contours de coupe, sans les recouvrements du dessin de la police)
  const nom = () => {
    const g = ds.plaque === 'gl';
    if (!sig || nomGL === g) return;
    nomGL = g;
    sig.innerHTML = `<path d="${LOGO.d}" fill="${g ? 'none' : 'currentColor'}"/>` + (g ? '' : `<path d="${CONTOURS}" fill="none" stroke="${P['greige-300']}" stroke-opacity=".3" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
  };
  const repli = () => { ds.plaque = 'repli'; joue = false; nom(); };
  sig?.setAttribute('viewBox', LOGO.viewBox);
  nom();

  function creerGL() {
    essaye = true;
    cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) { cv = gl = null; return repli(); }
    mctx = (mc = document.createElement('canvas')).getContext('2d', { willReadFrequently: true });
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; ready = lie = false; tour++; enCours = ''; fini = null; repli(); }, { signal: ac.signal });
    cv.addEventListener('webglcontextrestored', () => { lost = false; compiler(); }, { signal: ac.signal });
    foot.prepend(cv); // caché par le CSS tant que data-plaque n'est pas « gl »
    (ro = new ResizeObserver(mesurer)).observe(foot);
    document.fonts?.ready.then(mesurer);
    compiler();
    mesurer(); // le tramage commence pendant que le shader compile
  }

  // compilation sans bloquer : hors du fil avec KHR_parallel_shader_compile, sinon dans un temps mort
  function compiler() {
    const par = gl.getExtension('KHR_parallel_shader_compile');
    prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    const attendre = () => {
      if (dead || lost) return;
      if (par && !gl.getProgramParameter(prog, par.COMPLETION_STATUS_KHR)) return void plusTard(attendre);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('plaque :', gl.getProgramInfoLog(prog)); tour++; ro?.disconnect(); cv.remove(); cv = gl = null; return repli(); }
      gl.useProgram(prog);
      for (const n of UNIFORMES) U[n] = gl.getUniformLocation(prog, n);
      gl.uniform3fv(U.uCol, couleurs());
      gl.uniform1i(U.uMask, 0); gl.uniform1i(U.uField, 1);
      const T = gl.TEXTURE_2D;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(T, texF = gl.createTexture());
      for (const a of ['MIN_FILTER', 'MAG_FILTER']) gl.texParameteri(T, gl['TEXTURE_' + a], gl.NEAREST);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(T, texM = gl.createTexture());
      for (const a of ['MIN_FILTER', 'MAG_FILTER']) gl.texParameteri(T, gl['TEXTURE_' + a], gl.LINEAR);
      for (const tex of [texF, texM]) { gl.bindTexture(T, tex); for (const a of ['WRAP_S', 'WRAP_T']) gl.texParameteri(T, gl['TEXTURE_' + a], gl.CLAMP_TO_EDGE); }
      cle = ''; lie = true;
      if (fini) poser(); else if (!enCours) mesurer(); // le tramage, lancé en même temps, a pu finir avant l'édition de liens
    };
    plusTard(attendre);
  }

  // la géométrie du pied, lue dans la page : taille, densité, zones calmes, place du nom, repos de la lampe
  function lire(r) {
    const rel = (b, m) => [b.left - r.left - m, b.top - r.top - m, b.right - r.left + m, b.bottom - r.top + m];
    const g = { W: r.width, H: r.height, cpu: 1, ox: 0, oy: 0, box: [0, 0, 1, 1], rx: r.width * 0.3, ry: r.height * 0.68 };
    g.D = Math.min(devicePixelRatio || 1, opts.densiteMax || 1.5);
    g.cw = Math.round(g.W * g.D); g.ch = Math.round(g.H * g.D); g.D = g.cw / g.W;
    g.calm = [...foot.querySelectorAll('[data-calme]')].slice(0, 6).map((e) => rel(e.getBoundingClientRect(), 12));
    if (mark) {
      const b = mark.getBoundingClientRect(), m = BANDE + 4, bx = Math.floor((b.left - r.left - m) * g.D), by = Math.floor((b.top - r.top - m) * g.D);
      g.cpu = b.width / VW; g.ox = b.left - r.left - VX * g.cpu; g.oy = b.top - r.top - VY * g.cpu;
      g.box = [bx, by, Math.ceil((b.right - r.left + m) * g.D) - bx, Math.ceil((b.bottom - r.top + m) * g.D) - by];
      g.rx = b.left - r.left + b.width * 0.36; g.ry = b.top - r.top + b.height * 1.08; // le repos : sous le nom, entre le U et le R
    }
    g.cle = g.box.join(',') + '|' + g.D.toFixed(4);
    g.z = Math.min(420, Math.max(g.W * 0.3, Math.min(g.W * 0.6, 360))); // téléphone : lumière plus haute, plus large
    return g;
  }
  function adopter(g) {
    ({ W, H, D, cpu, ox, oy, box, calm, z, rx, ry } = g);
    if (cv.width !== g.cw || cv.height !== g.ch) { cv.width = g.cw; cv.height = g.ch; }
    if (opts.light) { x = tx = opts.light.x * W; y = ty = opts.light.y * H; vx = vy = 0; }
    else if (!place) { x = tx = rx; y = ty = ry; place = true; }
  }
  // appelé par l'observateur de taille, les polices et les réglages : repart d'un tramage si le nom a changé de place ou de taille
  function mesurer() {
    if (dead || lost || !cv) return;
    const r = foot.getBoundingClientRect();
    if (!r.width || !r.height) { W = 0; return; } // taille nulle : rien à dessiner, l'observateur rappellera
    const g = lire(r), k = g.cle + '|' + g.cw + 'x' + g.ch;
    if (ready && g.cle === cle) { tour++; enCours = ''; fini = null; adopter(g); dessiner(); wake(); } // même nom : seul le pied a changé
    else if (k !== enCours) lancer(g, k);
  }
  const css = (q) => [ox + q[0] * cpu, oy + q[1] * cpu];

  // Le nom dans deux textures, une fois par taille : sa couverture (filtrée), et le champ de la découpe (distance, instant).
  // Le travail est réparti en tranches (programme, étincelles, couverture, champ) ; pendant ce temps la plaque garde son image
  // (étirée par le CSS si le pied vient de changer de taille) ; le dernier tramage demandé l'emporte.
  function lancer(g, k) {
    const id = ++tour;
    enCours = k; fini = null;
    let job = null;
    const etapes = [
      () => { geometrie(); },
      () => { trajet(); },
      () => { programmer(); },
      () => {
        const [bx, by, w, h] = g.box;
        mc.width = w; mc.height = h;
        mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.fillStyle = '#000'; mctx.fillRect(0, 0, w, h);
        if (!opts.nu) { mctx.setTransform(g.cpu * g.D, 0, 0, g.cpu * g.D, g.ox * g.D - bx, g.oy * g.D - by); mctx.fillStyle = '#fff'; mctx.fill(new Path2D(LOGO.d)); }
        job = tramage(G, g.box, g.D, (q) => [(g.ox + q[0] * g.cpu) * g.D - bx, (g.oy + q[1] * g.cpu) * g.D - by], mctx.getImageData(0, 0, w, h).data);
      },
      () => job.avance(TRANCHE),
      () => { fini = { g, f: job.champ }; if (lie) poser(); },
    ];
    const pas = () => { if (dead || lost || id !== tour) return; if (etapes[0]() !== false) etapes.shift(); if (etapes.length) plusTard(pas); };
    plusTard(pas);
  }
  function poser() {
    const { g, f } = fini, T = gl.TEXTURE_2D, premier = !ready;
    fini = null; enCours = '';
    adopter(g); cle = g.cle;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(T, texM);
    gl.texImage2D(T, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, mc);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(T, texF);
    gl.texImage2D(T, 0, gl.RG16UI, g.box[2], g.box[3], 0, gl.RG_INTEGER, gl.UNSIGNED_SHORT, f);
    gl.activeTexture(gl.TEXTURE0);
    ready = true;
    // préchauffe hors écran : une image en pleine découpe (étincelles, chaleur, chutes), une du reflet final, puis l'état courant
    if (premier) { const t0 = t; t = G.tFin * 0.6; dessiner(); t = G.r0 + 500; dessiner(); t = t0; }
    dessiner();
    if (veut && vivant()) joue = t < END;
    wake();
  }

  function dessiner() {
    if (!ready || lost || !W || reduit || force || dead) return;
    const e = etat(opts.nu ? 0 : t), sc = cpu / CPU_REF, hp = css(e.head), b0 = css(e.bain[0]), b1 = css(e.bain[1]), b2 = css(e.bain[2]), rf = css([e.reflet.x, e.reflet.y]);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uDpr, D); gl.uniform1f(U.uFade, Math.min(72, Math.max(20, W / 20)));
    gl.uniform1f(U.uBevel, Math.min(2.5, Math.max(1.2, cpu * 8))); gl.uniform1f(U.uTrace, Math.max(0.75, 0.7 / D + 0.25)); gl.uniform1f(U.uT, opts.nu ? 0 : t);
    gl.uniform1f(U.uKerf, Math.max(0.6, 3.4 * cpu)); gl.uniform1f(U.uHalo, Math.max(0.7, 1.5 * sc)); gl.uniform1f(U.uBand, BANDE);
    gl.uniform1f(U.uZmax, 10 * clamp(sc, 0.45, 1)); gl.uniform1f(U.uGain, e.gain);
    gl.uniform3f(U.uLight, x, y, z);
    gl.uniform4f(U.uSheen, rf[0], rf[1], z * 1.25, e.reflet.k);
    gl.uniform4f(U.uHead, hp[0], hp[1], e.proc, opts.nu ? 0 : e.veille);
    gl.uniform2f(U.uBain, b0[0], b0[1]); gl.uniform4f(U.uTrail, b1[0], b1[1], b2[0], b2[1]);
    gl.uniform4f(U.uHs, Math.max(2, 9 * sc), Math.max(14, 70 * sc), Math.max(1.1, 2.4 * sc), Math.max(3, 11 * sc));
    gl.uniform4iv(U.uBox, box);
    gl.uniform1fv(U.uLx, LIMITES.map((v) => ox + v * cpu));
    gl.uniform1fv(U.uZ, e.z);
    gl.uniform1i(U.uN, calm.length);
    if (calm.length) gl.uniform4fv(U.uCalm, calm.flat());
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of e.sp) {
      const a = css(s.a), b = css(s.b), w = Math.max(0.45, s.w * sc) * 0.5 + 0.25;
      spk.set([a[0], a[1], b[0], b[1]], n * 4); spkC.set([s.age, w], n * 2); n++;
      x0 = Math.min(x0, a[0], b[0]); y0 = Math.min(y0, a[1], b[1]); x1 = Math.max(x1, a[0], b[0]); y1 = Math.max(y1, a[1], b[1]);
    }
    gl.uniform1i(U.uNS, n);
    if (n) { gl.uniform4fv(U.uSpk, spk); gl.uniform2fv(U.uSpkC, spkC); gl.uniform4f(U.uSpkBox, x0 - 8, y0 - 8, x1 + 8, y1 + 8); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (ds.plaque !== 'gl') { ds.plaque = 'gl'; nom(); }
  }

  // la lampe : un ressort amorti critique vers sa cible (solution exacte sur le pas : ni retard mou, ni à-coup, ni dépassement)
  function ressort(dt, w) {
    const e = Math.exp(-w * dt), dx = x - tx, dy = y - ty, ax = vx + w * dx, ay = vy + w * dy;
    x = tx + (dx + ax * dt) * e; vx = (vx - ax * w * dt) * e;
    y = ty + (dy + ay * dt) * e; vy = (vy - ay * w * dt) * e;
  }

  function tick(dt, now) {
    let bouge = false;
    if (joue) { t = Math.min(END, t + dt); joue = t < END; bouge = true; }
    if (!enGL()) return false; // repli, ou plaque pas encore prête : poser() relancera la boucle
    if (!W) return false; // taille nulle : l'observateur relancera la boucle
    const r = foot.getBoundingClientRect();
    let w = RETOUR;
    if (mode === 2) { // écran tactile : la lumière dérive pendant le défilement ; son élan monte et retombe en douceur, puis elle se pose
      elan += ((now - defile < REPOS ? 1 : 0) - elan) * (1 - Math.exp(-dt / 600));
      horloge += dt * elan;
      tx = W * (0.5 + 0.36 * Math.sin((horloge / (MOTION.rideau.ms * 8)) * 2 * Math.PI));
      ty = H * (0.08 + 0.62 * clamp((innerHeight - r.top) / Math.min(H, innerHeight)));
      w = SUIVI / 3;
      if (!cale) { x = tx; y = ty; vx = vy = 0; cale = true; }
      bouge ||= elan > 0.004;
    } else if (mode === 1) {
      // sur le pied (et un peu au-dessus), la lampe suit le pointeur ; ailleurs, elle revient à son repos, plus lentement
      const sur = px != null && py > r.top - H * 0.2 && py < r.bottom + 4 && px >= r.left && px <= r.right;
      if (sur) { tx = px - r.left; ty = py - r.top; w = SUIVI; } else { tx = rx; ty = ry; }
    }
    if (mode) {
      ressort(dt, w);
      const ex = x - tx, ey = y - ty;
      if (ex * ex + ey * ey < 0.01 && vx * vx + vy * vy < 1e-8) { x = tx; y = ty; vx = vy = 0; } else bouge = true;
    }
    if (bouge || !dt) dessiner();
    return bouge || !dt;
  }

  // réglages changés pendant la visite : mouvements réduits → image fixe, nom découpé ; couleurs forcées → couleurs du système
  function reglages() {
    reduit = mqReduit.matches; force = mqForce.matches;
    if (reduit || force) { tk?.stop(); joue = false; if (reduit) t = END; repli(); }
    else if (ready && !lost) { ds.plaque = ''; nom(); mesurer(); }
    else if (!essaye) creerGL();
  }

  function monter() {
    io.disconnect();
    if (dead) return;
    tk = ticker(tick, { el: foot, margin: '0px', fps: 60 });
    mqReduit.addEventListener('change', reglages, { signal: ac.signal });
    mqForce.addEventListener('change', reglages, { signal: ac.signal });
    if (mode === 1) {
      addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; wake(); }, on);
      document.documentElement.addEventListener('pointerleave', () => { px = py = null; wake(); }, on);
      addEventListener('scroll', wake, on);
    } else if (mode === 2) {
      defile = performance.now();
      addEventListener('scroll', () => { defile = performance.now(); wake(); }, on);
    }
    if (reduit || force) repli(); else creerGL();
    // une fois par visite, quand le nom est aux trois cinquièmes à l'écran ; la découpe attend la plaque si elle n'est pas prête
    if (!reduit && !opts.still && !opts.nu && opts.t == null && mark) stopSig = onceVisible(mark, () => { veut = true; if (vivant() && enGL()) { joue = t < END; wake(); } }, { threshold: 0.6 });
  }
  // montage à un écran du pied de page ; root: document pour que la marge compte aussi dans un iframe d'une autre origine
  const cb = (es) => es.at(-1).isIntersecting && monter();
  try { io = new IntersectionObserver(cb, { root: document, rootMargin: '100% 0px' }); } catch { io = new IntersectionObserver(cb, { rootMargin: '100% 0px' }); }
  io.observe(foot);

  return {
    seek(v) { programmer(); t = clamp(+v, 0, END); joue = false; if (enGL()) dessiner(); },
    light(a, b) { x = tx = a; y = ty = b; vx = vy = 0; dessiner(); },
    get fin() { return programmer().fin; },
    destroy() {
      dead = true; tour++; ac.abort(); io.disconnect(); ro?.disconnect(); tk?.destroy(); stopSig?.();
      gl?.getExtension('WEBGL_lose_context')?.loseContext(); cv?.remove(); delete ds.plaque; nomGL = null; nom();
    },
  };
}
