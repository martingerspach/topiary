// Ourlet · plaque du pied de page (v6) : une enseigne d'acier brossé ; à l'entrée du pied dans l'écran, le laser y découpe le nom.
// Références de métier :
//  - FAO de découpe laser (TruTops Boost, BySoft, Lantek) : contours intérieurs d'une pièce avant son contour extérieur (une pièce
//    libérée bouge), perçage et amorce sur la chute, jamais sur ce qu'on garde ; léger dépassement à la fermeture du contour ;
//    « petits contours » coupés à vitesse réduite ;
//  - commande numérique : vitesse de coupe constante en ligne droite, freinée dans les angles (écart de jonction) et dans les
//    courbes serrées (accélération latérale) ; déplacements à vide limités par l'accélération des axes (5 g, moteurs linéaires) ;
//  - la saignée : bain de fusion blanc-jaune, puis le rouge du corps noir qui refroidit, éteint en moins de deux secondes ;
//  - étincelles : gouttelettes éjectées en couronne au perçage, puis vers l'arrière de la coupe ; freinées par l'air, courbées par
//    la pesanteur, filées par l'obturateur d'une caméra au 1/60 s ;
//  - reflet anisotrope de Ward (G. Ward, « Measuring and modeling anisotropic reflection », 1992) : sur l'acier brossé, le reflet
//    d'une source proche s'étire en travers du brossage ; la tête de coupe en est une, chaude, qui glisse avec elle.
// L'enseigne mesure 42 cm (capitales de 7 cm) ; la machine est celle du film (MOTION.laser, cadrage de référence 0,36 px/mm) :
// le programme dure le même temps à toutes les tailles d'écran. Les lettres ne bougent jamais ; seules les chutes tombent.
// Sous [data-calme], chaque canal est comprimé sous charbon-800 : givre-2 y garde 7,86:1, tête et étincelles comprises.
// Repli (sans WebGL2, mouvements réduits, couleurs forcées, contexte perdu) : img/plaque-repli.jpg et le nom en SVG.
import { LOGO } from './marque.js';
import { MOTION, EASE, ticker, onceVisible } from './motion.js';
import { P, ILLU } from '../tokens/tokens-v2.js';

const [VX, VY, VW] = LOGO.viewBox.split(' ').map(Number);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lisse = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

// ---------- l'enseigne et la machine (unités du logotype, y vers le bas ; temps en ms) ----------
const REF = 0.36;                    // px CSS par mm dans le cadrage de référence des tokens (lib/film-atelier.js)
const MM = 70 / 729;                 // mm par unité : capitales de 7 cm, une plaque de 42 cm
const vit = (pxs) => pxs / REF / MM / 1000; // px/s du cadrage de référence → unités par ms
const VC = vit(MOTION.laser.coupe.v), VV = vit(MOTION.laser.vide.v);
const ACC = (5 * 9.81e-3) / MM;      // 5 g (moteurs linéaires)
const JONC = 0.02 / MM;              // écart de jonction de la commande : 0,02 mm
const GRAV = 9.81e-3 / MM;           // pesanteur, pour les étincelles
const PERC = MOTION.laser.percageMince?.ms ?? 90; // perçage éclair d'une tôle de 1,5 mm (le film perce plus épais : MOTION.laser.percage)
const VIDE_MIN = MOTION.laser.videMin?.ms ?? 90; // déplacement à vide le plus court, pour qu'il se lise (valeur proposée aux tokens)
const CHUTE = MOTION.laser.chute?.ms ?? 420; // la chute libérée tombe sur la contre-plaque (valeur proposée aux tokens)
const FROID = 1800;                  // la saignée est éteinte 1,8 s après le passage de la tête
const AMORCE = 44, DEPASSE = 6;      // amorce depuis le perçage, dépassement à la fermeture
const OBTU = 1000 / 60;              // obturateur de la caméra imaginaire : les étincelles filent sur 1/60 s
const HOME = [-160, 330], PARC = [4600, 330]; // la tête attend à gauche du nom, repart à droite

// Contours de coupe : le tracé du logotype, avec les recouvrements du dessin de la police fondus (R, E, T)
const SOUS = LOGO.d.split(/(?=M)/); // O ext., O int., U, R, L ext., fente du L, E, barre du E, fût du T, barre du T
const [R_EXT, R_INT] = (() => {
  const r = SOUS[3], i0 = r.indexOf('H 1881.57'), i1 = r.lastIndexOf('H 1895.57');
  if (i0 < 0 || i1 < i0) return [r, null];
  return [r.slice(0, i0) + r.slice(i1), 'M 1895.57,333.71 ' + r.slice(r.indexOf('H 2116.43', i0), i1) + 'H 1895.57Z'];
})();
const E_UNI = 'M 3108.14,729 V 0 H 3725.57 V 138.14 H 3282.57 V 296.29 H 3676.14 V 425.29 H 3282.57 V 590.57 H 3727.71 V 729 Z';
const T_UNI = 'M 3770.43,0 H 4431.29 V 139.57 H 4185.72 V 729 H 4012 V 139.57 H 3770.43 Z';
// Ordre de la FAO : de gauche à droite, contre-poinçons d'abord ; le L en dernier, sa fente (petit contour, lent) puis son
// contour, qui finit par le bord roulé de l'ourlet : la signature. a : départ (le point du contour le plus proche).
const ORDRE = [
  { d: SOUS[1], l: 0, a: [665, 364] },
  { d: SOUS[0], l: 0, a: [841, 364], ext: 1 },
  { d: SOUS[2], l: 1, a: [1620, 300], ext: 1 },
  { d: R_INT, l: 2, a: [1895.57, 230] },
  { d: R_EXT, l: 2, a: [2425.72, 215], ext: 1 },
  { d: E_UNI, l: 4, a: [3108.14, 400], ext: 1 },
  { d: T_UNI, l: 5, a: [3770.43, 70], ext: 1 },
  { d: SOUS[5], l: 3, a: [2730.38, 657], lent: 0.5 },
  { d: SOUS[4], l: 3, a: [2900, 585.6], ext: 1, am: 30 },
].filter((c) => c.d);
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

// profil de vitesse le long d'un trajet : départ et arrivée arrêtés, vitesse limitée aux sommets (jonction, courbure), accélération ACC
function profil(pts, vmax) {
  const Pp = [pts[0]], lim = [0], ds = [0], seg = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 4));
    for (let k = 1; k <= n; k++) { Pp.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); lim.push(vmax); ds.push(L / n); seg.push(k === n ? L : -1); }
  }
  const N = Pp.length;
  for (let i = 1; i < N - 1; i++) {
    if (seg[i] < 0) continue; // point ajouté au milieu d'un segment
    const ux = Pp[i][0] - Pp[i - 1][0], uy = Pp[i][1] - Pp[i - 1][1], wx = Pp[i + 1][0] - Pp[i][0], wy = Pp[i + 1][1] - Pp[i][1];
    const cs = clamp((ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy) || 1), -1, 1), th = Math.acos(cs);
    if (th < 1e-4) continue;
    const c2 = Math.cos(th / 2);
    let R = c2 > 0.999999 ? Infinity : (JONC * c2) / (1 - c2);
    if (th < 0.35) { let k = i + 1; while (k < N - 1 && seg[k] < 0) k++; R = Math.max(R, (0.5 * (seg[i] + seg[k])) / th); } // courbe aplatie
    lim[i] = Math.min(vmax, Math.sqrt(ACC * R));
  }
  lim[N - 1] = 0;
  const v = lim.slice(); v[0] = 0;
  for (let i = 1; i < N; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * ACC * ds[i]));
  for (let i = N - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * ACC * ds[i + 1]));
  const t = new Float64Array(N);
  for (let i = 1; i < N; i++) t[i] = t[i - 1] + (2 * ds[i]) / Math.max(v[i - 1] + v[i], 1e-6);
  // position au temps τ : accélération constante sur chaque petit segment
  const at = (tau) => {
    if (tau <= 0) return { p: Pp[0], i: 0, v: 0 };
    if (tau >= t[N - 1]) return { p: Pp[N - 1], i: N - 2, v: 0 };
    let lo = 0, hi = N - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= tau) lo = m; else hi = m; }
    const dt = t[hi] - t[lo], a = (v[hi] - v[lo]) / dt, e = tau - t[lo], s = v[lo] * e + 0.5 * a * e * e, k = clamp(s / ds[hi]);
    return { p: [Pp[lo][0] + (Pp[hi][0] - Pp[lo][0]) * k, Pp[lo][1] + (Pp[hi][1] - Pp[lo][1]) * k], i: lo, v: v[lo] + a * e };
  };
  return { P: Pp, t, v, T: t[N - 1], at };
}

// le programme de la machine : une liste d'étapes datées, les chutes, les étincelles. Pur, déterministe, sans écran.
let PROG = null;
export function programme() {
  if (PROG) return PROG;
  const polys = ORDRE.map((c) => polyligne(c.d));
  const dedans = (x, y) => { // pair-impair sur les contours fondus : vrai dans le nom (la chute)
    let k = false;
    for (const q of polys) for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      if ((q[i][1] > y) !== (q[j][1] > y) && x < ((q[j][0] - q[i][0]) * (y - q[i][1])) / (q[j][1] - q[i][1]) + q[i][0]) k = !k;
    }
    return k;
  };
  let seed = 7;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let r = Math.imul(seed ^ (seed >>> 15), 1 | seed); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  const steps = [], chutes = [], sparks = [], coupes = [];
  let t = 0, pos = HOME;
  const vide = (to) => {
    const d = Math.hypot(to[0] - pos[0], to[1] - pos[1]), T = Math.max(VIDE_MIN, 2 * Math.sqrt(d / ACC), d / VV);
    steps.push({ k: 'vide', t0: t, t1: t + T, a: pos, b: to }); t += T; pos = to;
  };
  t = MOTION.presse.approche.ms; // la lampe de la tête s'allume au repos, puis la tête part
  ORDRE.forEach((c, ci) => {
    let q = polys[ci];
    let bi = 0, bu = 0, bd = Infinity;
    for (let i = 0; i < q.length; i++) {
      const a = q[i], b = q[(i + 1) % q.length], dx = b[0] - a[0], dy = b[1] - a[1];
      const u = clamp(((c.a[0] - a[0]) * dx + (c.a[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)), d = Math.hypot(a[0] + u * dx - c.a[0], a[1] + u * dy - c.a[1]);
      if (d < bd) { bd = d; bi = i; bu = u; }
    }
    const a = q[bi], b = q[(bi + 1) % q.length], s = [a[0] + (b[0] - a[0]) * bu, a[1] + (b[1] - a[1]) * bu];
    const tour = [s, ...q.slice(bi + 1), ...q.slice(0, bi + 1), s].filter((p, i, arr) => !i || Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) > 1e-3);
    const ferme = tour.length - 1;
    let reste = DEPASSE; // dépassement : la tête repasse sur le début du contour
    for (let i = 1; i < tour.length && reste > 0; i++) {
      const p0 = tour[i - 1], p1 = tour[i], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), k = Math.min(1, reste / L);
      tour.push([p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k]); reste -= L * k;
      if (k < 1) break;
    }
    const tx = tour[1][0] - s[0], ty = tour[1][1] - s[1], tl = Math.hypot(tx, ty);
    let nx = -ty / tl, ny = tx / tl;
    if (!dedans(s[0] + nx * 3, s[1] + ny * 3)) { nx = -nx; ny = -ny; }
    const am = c.am || AMORCE, perce = [s[0] + nx * am, s[1] + ny * am];
    vide(perce);
    steps.push({ k: 'percage', t0: t, t1: t + PERC, at: perce });
    for (let k = 0; k < 6; k++) { // couronne de projections au perçage
      const th = rnd() * Math.PI * 2, v0 = 1.6 + 2.4 * rnd();
      sparks.push({ te: t + 30 + (k * PERC * 0.7) / 6 + 12 * rnd(), p: perce, v: [Math.cos(th) * v0, Math.sin(th) * v0], life: 70 + 90 * rnd(), w: 0.7 + 0.5 * rnd() });
    }
    t += PERC;
    const pr = profil([perce, ...tour], VC * (c.lent || 1));
    const tFerme = t + pr.t[pr.P.findIndex((p, i) => i > 4 && Math.hypot(p[0] - s[0], p[1] - s[1]) < 1e-3 && pr.t[i] > pr.T * 0.5)];
    steps.push({ k: 'coupe', t0: t, t1: t + pr.T, pr, c: ci });
    coupes.push({ t0: t, pr, ferme });
    // étincelles de coupe : vers l'arrière, à la cadence de la vitesse
    for (let tau = 25; tau < pr.T - 10; tau += (34 + 40 * rnd()) / Math.max(0.35, Math.sqrt((pr.at(tau).v || 0) / VC))) {
      const h = pr.at(tau), h2 = pr.at(tau + 4), dx = h2.p[0] - h.p[0], dy = h2.p[1] - h.p[1], dl = Math.hypot(dx, dy);
      if (dl < 1e-3 || h.v < 0.12 * VC) continue;
      const th = Math.atan2(-dy, -dx) + (rnd() - 0.5) * 1.3, v0 = (1.1 + 1.7 * rnd()) * Math.sqrt(h.v / VC);
      sparks.push({ te: t + tau, p: h.p, v: [Math.cos(th) * v0, Math.sin(th) * v0], life: 45 + 65 * rnd(), w: 0.55 + 0.4 * rnd() });
    }
    if (c.ext) chutes.push({ l: c.l, t0: (Number.isFinite(tFerme) ? tFerme : t + pr.T) + 40 });
    t += pr.T; pos = pr.P.at(-1);
  });
  const tFin = t;
  vide(PARC);
  const fin = Math.max(tFin + FROID, ...chutes.map((c) => c.t0 + CHUTE), t);
  sparks.sort((a, b) => a.te - b.te);
  PROG = { steps, chutes, sparks, coupes, fin, tFin, dedans, polys };
  return PROG;
}

// enfoncement d'une chute (0 → 1) : chute libre jusqu'à la contre-plaque, un rebond (restitution 0,25), repos
const E_REB = 0.25, T_TOMBE = CHUTE / (1 + 2 * E_REB);
function enfoncement(tau) {
  if (tau <= 0) return 0;
  if (tau < T_TOMBE) { const u = tau / T_TOMBE; return u * u; }
  const w = (tau - T_TOMBE) / (2 * E_REB * T_TOMBE);
  return w < 1 ? 1 - E_REB * E_REB * 4 * w * (1 - w) : 1;
}
// scintillement du procédé : bruit continu (somme de sinus incommensurables), jamais par sauts
const scint = (t) => 0.9 + 0.035 * Math.sin(t * 0.071) + 0.035 * Math.sin(t * 0.1733 + 1.3) + 0.03 * Math.sin(t * 0.389 + 0.4);

// état de la machine à l'instant t (ms) : tête (unités), éclat du procédé, lampe de veille, enfoncement des six chutes, étincelles
export function etat(t) {
  const G = programme();
  let head = HOME, proc = 0, dir = [1, 0];
  let st = null;
  for (const s of G.steps) { if (t >= s.t0) st = s; else break; }
  let derniere = -Infinity; // fin de la dernière coupe (le bain de fusion s'éteint)
  for (const s of G.steps) if (s.k === 'coupe' && s.t1 <= t) derniere = s.t1;
  if (st) {
    const u = clamp((t - st.t0) / (st.t1 - st.t0));
    if (st.k === 'vide') { const k = t >= st.t1 ? 1 : EASE.vide(u); head = [st.a[0] + (st.b[0] - st.a[0]) * k, st.a[1] + (st.b[1] - st.a[1]) * k]; }
    else if (st.k === 'percage') { head = st.at; proc = t < st.t1 ? lisse(0, 1, u) : 1; }
    else { const h = st.pr.at(t - st.t0); head = h.p; proc = t < st.t1 ? 1 : 0; const h2 = st.pr.at(t - st.t0 + 4); const dx = h2.p[0] - h.p[0], dy = h2.p[1] - h.p[1], l = Math.hypot(dx, dy); if (l > 1e-4) dir = [dx / l, dy / l]; }
  }
  if (!(st && st.k !== 'vide' && t < st.t1)) proc = Math.max(proc, Number.isFinite(derniere) ? Math.exp(-(t - derniere) / 45) * (t >= derniere ? 1 : 0) : 0);
  proc *= scint(t);
  const allume = lisse(0, MOTION.presse.approche.ms, t), last = G.steps.at(-1);
  const veille = allume * (1 - lisse(last.t0, last.t1 + MOTION.rideau.ms * 0.3, t));
  const z = [0, 0, 0, 0, 0, 0];
  for (const c of G.chutes) z[c.l] = enfoncement(t - c.t0);
  const sp = [];
  for (let i = G.sparks.length - 1; i >= 0 && sp.length < 12; i--) {
    const s = G.sparks[i];
    if (s.te < t - 400) break; // triées : les plus anciennes sont éteintes
    const tau = t - s.te;
    if (tau < 0 || tau >= s.life) continue;
    const pos = (x) => { const td = 32, vt = GRAV * td, e = td * (1 - Math.exp(-x / td)); return [s.p[0] + s.v[0] * e, s.p[1] + vt * x + (s.v[1] - vt) * e]; };
    sp.push({ a: pos(Math.max(0, tau - OBTU)), b: pos(tau), age: tau / s.life, w: s.w });
  }
  return { head, proc, veille, dir, z, sp };
}

// ---------- le rendu ----------
const FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform vec2 uRes;
uniform float uDpr, uFade, uBevel, uT, uKerf, uHalo, uBand, uZmax;
uniform vec3 uLight;      // pointeur : position sur la plaque (px CSS, y vers le bas) et hauteur
uniform vec4 uHead;       // tête : position (px CSS), éclat du procédé, lampe de veille
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
float ward(vec3 l, float b) {
  vec3 h = normalize(l + vec3(0, 0, 1));
  float ax = .1 + .06 * b, ay = .7, hn = max(h.z, .05), ht = h.x / ax, hb = h.y / ay;
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
  float b = brush(p);
  vec3 alb = uCol[0] * (.8 + .4 * b), reflet = mix(uCol[1], uCol[9], .45);
  // la lampe du pointeur
  vec3 lv = uLight - vec3(p, 0); vec3 l = normalize(lv);
  float I = uLight.z * uLight.z / dot(lv, lv), E = I * l.z;
  vec3 plaque = alb * (.78 + .32 * E) + reflet * ward(l, b) * E * (.4 + 1.2 * b) * .07;
  // la tête : le bain de fusion à fleur de tôle (éclat), la lampe de la tête (veille) ; leur reflet glisse avec elle
  vec3 hv = vec3(uHead.xy - p, uHs.x); float hd = dot(hv, hv); vec3 hl = hv * inversesqrt(hd);
  float Ih = uHs.y * uHs.y / (uHs.y * uHs.y + hd), Ph = uHead.z + .16 * uHead.w;
  vec3 hcol = mix(uCol[6], uCol[5], .35);
  plaque += hcol * Ph * Ih * hl.z * (alb * .9 + ward(hl, b) * (.4 + 1.2 * b) * .3);
  vec3 c = plaque;
  ivec2 ip = ivec2(fc) - uBox.xy;
  if (all(greaterThanEqual(ip, ivec2(0))) && all(lessThan(ip, uBox.zw))) {
    uvec2 f = texelFetch(uField, ip, 0).rg;
    float sd = (float(f.r) - 32768.) / 256., tc = float(f.g), ink = texture(uMask, (vec2(ip) + .5) / vec2(uBox.zw)).r;
    int li = int(p.x > uLx[0]) + int(p.x > uLx[1]) + int(p.x > uLx[2]) + int(p.x > uLx[3]) + int(p.x > uLx[4]);
    float z = uZ[li], zp = uZmax * z, cut = step(tc, uT);
    // la chute s'enfonce : l'ombre portée du bord grandit, la contre-plaque apparaît (le pointeur et la tête éclairent le fond)
    if (ink > 0.) {
      float s = 1. - tole(p + (uLight.xy - p) * (zp / (uLight.z + zp)));
      // (la tête est posée sur la tôle : elle n'éclaire pas le fond des lettres déjà tombées à travers le nom encore plein)
      vec3 fond = uCol[2] * (.55 + .9 * s * E);
      vec3 chute = plaque * mix(1., .25 + .75 * s, smoothstep(0., .35, z));
      c = mix(c, mix(chute, fond, smoothstep(.12, 1., z)), ink);
    }
    // chanfrein du bord coupé : la pente tournée vers le haut reçoit le ciel, la lumière accroche le côté qui lui fait face
    if (cut > 0. && z > 0. && abs(sd) < uBevel + 2.) {
      vec2 g = vec2(tole(p + vec2(uBevel, 0)) - tole(p - vec2(uBevel, 0)), tole(p + vec2(0, uBevel)) - tole(p - vec2(0, uBevel)));
      float e = length(g);
      if (e > .01) {
        vec2 dh = -g / e;
        float fl = max(dot(dh, normalize(uLight.xy - p + 1e-3)), 0.), Eb = I * max(dot(normalize(vec3(dh, 1.1)), l), 0.);
        float fh = max(dot(dh, normalize(uHead.xy - p + 1e-3)), 0.) * Ph * Ih * 3.;
        vec3 ch = uCol[3] * (.015 + .2 * pow(max(-dh.y, 0.), 1.5) + fl * (.1 * Eb + 1.2 * Eb * Eb)) + hcol * fh * .25;
        c = mix(c, ch, (1. - ink) * smoothstep(.1, .6, e) * smoothstep(0., .5, z));
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
        c += chaleur(a) * (core + .45 * exp(-dk / sg) * smoothstep(uBand, .55 * uBand, dk));
      }
    }
  }
  // le bain de fusion et son halo
  float r = length(p - uHead.xy);
  c += mix(uCol[6], uCol[5], .7) * uHead.z * (3.2 * exp(-r * r / (uHs.z * uHs.z)) + .22 * exp(-r / uHs.w));
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
const UNIFORMES = ['uRes', 'uDpr', 'uFade', 'uBevel', 'uT', 'uKerf', 'uHalo', 'uBand', 'uZmax', 'uLight', 'uHead', 'uHs', 'uBox', 'uLx', 'uZ',
  'uCalm', 'uN', 'uNS', 'uSpk', 'uSpkC', 'uSpkBox', 'uCol', 'uMask', 'uField'];
const lineaire = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2);
// rouge sombre : l'ambre filtré comme le spectre d'un corps noir qui refroidit (le vert et le bleu s'éteignent les premiers)
const couleurs = () => {
  const ambre = lineaire(P.ambre);
  return [lineaire(P['charbon-850']), lineaire(P['greige-400']), lineaire(P['charbon-900']), lineaire(P['greige-300']), lineaire(P['charbon-800']),
    lineaire(ILLU.chaud), lineaire(ILLU.etincelle), ambre, [ambre[0], ambre[1] * 0.28, ambre[2] * 0.12], lineaire(ILLU.bronze)].flat();
};
const CPU_REF = 0.31; // px CSS par unité du logotype à 1 440 px de large (le nom fait 1 368 px)
const BANDE = 6;      // px CSS autour du trajet où la chaleur et la saignée sont calculées
const REPOS = 3 * MOTION.rideau.ms; // sans survol : la lumière dérive tant qu'on fait défiler, puis se pose
const plusTard = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 300 }) : setTimeout(fn, 32));

// champ du nom, en px de l'écran : distance signée au trajet de la tête et instant de coupe du point le plus proche
// (« le plus tôt » à égalité : la fermeture et le dépassement ne repassent pas sur un trait déjà coupé)
export function champ(G, box, D, toDev, masque) {
  const [, , w, h] = box, N = w * h, BD = BANDE * D, EPS = 0.75;
  const best = new Float32Array(N).fill(BD), tcut = new Float32Array(N).fill(65535);
  for (const cp of G.coupes) {
    const { P: Pp, t } = cp.pr;
    let prev = null;
    for (let i = 0; i < Pp.length; i++) {
      if (i % 3 && i < Pp.length - 1) { const a = Pp[i - 1], b = Pp[i], c = Pp[i + 1]; if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-6) continue; }
      const q = toDev(Pp[i]), tq = cp.t0 + t[i];
      if (prev) {
        const [ax, ay, ta] = prev, bx = q[0], by = q[1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - BD)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + BD));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by) - BD)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + BD));
        for (let y = y0; y <= y1; y++) {
          const py = y + 0.5 - ay;
          for (let x = x0, k = y * w + x0; x <= x1; x++, k++) {
            const px = x + 0.5 - ax;
            let u = (px * dx + py * dy) / l2; u = u < 0 ? 0 : u > 1 ? 1 : u;
            const ex = px - u * dx, ey = py - u * dy, d = Math.sqrt(ex * ex + ey * ey);
            if (d >= best[k] + EPS) continue;
            const tt = ta + u * (tq - ta);
            if (d < best[k] - EPS) { best[k] = d; tcut[k] = tt; }
            else if (tt < tcut[k]) { tcut[k] = tt; if (d < best[k]) best[k] = d; }
            else if (d < best[k]) best[k] = d;
          }
        }
      }
      prev = [q[0], q[1], tq];
    }
  }
  const out = new Uint16Array(N * 2);
  for (let k = 0; k < N; k++) {
    const sd = (masque[k * 4] >= 128 ? 1 : -1) * best[k] / D;
    out[2 * k] = Math.round(clamp(32768 + sd * 256, 0, 65535));
    out[2 * k + 1] = Math.round(Math.min(tcut[k], 65535));
  }
  return out;
}

export function mountPlaque(foot, opts = {}) {
  const mark = foot.querySelector('[data-plaque-logo]'), sig = mark && mark.querySelector('svg'), ds = foot.dataset;
  const G = programme(), END = G.fin;
  const mqReduit = matchMedia('(prefers-reduced-motion: reduce)'), mqForce = matchMedia('(forced-colors: active)');
  const mode = opts.light ? 0 : matchMedia('(hover: hover) and (pointer: fine)').matches ? 1 : 2; // fixe, pointeur, dérive
  let reduit = mqReduit.matches, force = mqForce.matches, dead = false, joue = false, veut = false;
  let t = opts.t ?? (reduit || opts.still ? END : 0);
  let cv, gl, prog, U = {}, ready = false, lost = false, essaye = false, mc, mctx, tk, ro, io, stopSig, texM, texF;
  let W = 0, H = 0, D = 1, cpu = 1, z = 300, ox = 0, oy = 0, box = [0, 0, 1, 1], calm = [], cle = '';
  let x = 0, y = 0, tx = 0, ty = 0, place = false, px = null, py = null, horloge = 0, defile = 0, nomGL = null;
  const ac = new AbortController(), on = { passive: true, signal: ac.signal };
  const spk = new Float32Array(48), spkC = new Float32Array(24);

  const enGL = () => ready && !lost && ds.plaque === 'gl';
  const vivant = () => !dead && !reduit && !force && !opts.still;
  const wake = () => tk && vivant() && tk.start();
  // la couche SVG : le nom visible en repli ; transparente quand la plaque le dessine
  const nom = () => { const g = ds.plaque === 'gl'; if (!sig || nomGL === g) return; nomGL = g; sig.innerHTML = `<path d="${LOGO.d}" fill="${g ? 'none' : 'currentColor'}"/>`; };
  const repli = () => { ds.plaque = 'repli'; joue = false; nom(); };
  sig?.setAttribute('viewBox', LOGO.viewBox);
  nom();

  function creerGL() {
    essaye = true;
    cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) { cv = gl = null; return repli(); }
    mctx = (mc = document.createElement('canvas')).getContext('2d', { willReadFrequently: true });
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; ready = false; repli(); }, { signal: ac.signal });
    cv.addEventListener('webglcontextrestored', () => { lost = false; compiler(); }, { signal: ac.signal });
    foot.prepend(cv); // caché par le CSS tant que data-plaque n'est pas « gl »
    (ro = new ResizeObserver(resize)).observe(foot);
    document.fonts?.ready.then(resize);
    compiler();
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
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('plaque :', gl.getProgramInfoLog(prog)); cv.remove(); cv = gl = null; return repli(); }
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
      cle = ''; ready = true;
      if (!mesurer()) return; // taille nulle : le ResizeObserver dessinera
      // préchauffe hors écran : une image en pleine découpe (étincelles, chaleur, chutes), puis l'état courant
      const t0 = t; t = G.tFin * 0.6; dessiner(); t = t0; dessiner();
      if (veut && vivant()) joue = t < END;
      wake();
    };
    plusTard(attendre);
  }

  function mesurer() {
    const r = foot.getBoundingClientRect(), rel = (b, m) => [b.left - r.left - m, b.top - r.top - m, b.right - r.left + m, b.bottom - r.top + m];
    W = r.width; H = r.height;
    if (!W || !H) return (W = 0);
    D = Math.min(devicePixelRatio || 1, opts.densiteMax || 1.5);
    cv.width = Math.round(W * D); cv.height = Math.round(H * D); D = cv.width / W;
    calm = [...foot.querySelectorAll('[data-calme]')].slice(0, 6).map((e) => rel(e.getBoundingClientRect(), 12));
    if (mark) {
      const b = mark.getBoundingClientRect(); cpu = b.width / VW; ox = b.left - r.left - VX * cpu; oy = b.top - r.top - VY * cpu;
      const m = BANDE + 4, bx = Math.floor((b.left - r.left - m) * D), by = Math.floor((b.top - r.top - m) * D);
      box = [bx, by, Math.ceil((b.right - r.left + m) * D) - bx, Math.ceil((b.bottom - r.top + m) * D) - by];
      const k = box.join(',') + '|' + D.toFixed(4);
      if (k !== cle) { cle = k; tramer(); }
    }
    z = Math.min(420, Math.max(W * 0.3, Math.min(W * 0.6, 360))); // téléphone : lumière plus haute, plus large
    if (opts.light) { x = tx = opts.light.x * W; y = ty = opts.light.y * H; }
    else if (!place) { x = tx = W * 0.3; y = ty = H * 0.68; place = true; }
    return true;
  }
  const css = (q) => [ox + q[0] * cpu, oy + q[1] * cpu];

  // le nom dans deux textures, une fois par taille : sa couverture (filtrée), et le champ de la découpe (distance, instant)
  function tramer() {
    const [bx, by, w, h] = box;
    mc.width = w; mc.height = h;
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.fillStyle = '#000'; mctx.fillRect(0, 0, w, h);
    mctx.setTransform(cpu * D, 0, 0, cpu * D, ox * D - bx, oy * D - by); mctx.fillStyle = '#fff'; mctx.fill(new Path2D(LOGO.d));
    const masque = mctx.getImageData(0, 0, w, h).data;
    const f = champ(G, box, D, (q) => [(ox + q[0] * cpu) * D - bx, (oy + q[1] * cpu) * D - by], masque);
    const T = gl.TEXTURE_2D;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(T, texM);
    gl.texImage2D(T, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, mc);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(T, texF);
    gl.texImage2D(T, 0, gl.RG16UI, w, h, 0, gl.RG_INTEGER, gl.UNSIGNED_SHORT, f);
    gl.activeTexture(gl.TEXTURE0);
  }

  function dessiner() {
    if (!ready || lost || !W || reduit || force || dead) return;
    const e = etat(t), sc = cpu / CPU_REF, hp = css(e.head);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uDpr, D); gl.uniform1f(U.uFade, Math.min(72, Math.max(20, W / 20)));
    gl.uniform1f(U.uBevel, Math.min(2.5, Math.max(1.2, cpu * 8))); gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uKerf, Math.max(0.6, 3.4 * cpu)); gl.uniform1f(U.uHalo, Math.max(0.7, 1.5 * sc)); gl.uniform1f(U.uBand, BANDE);
    gl.uniform1f(U.uZmax, 10 * clamp(sc, 0.45, 1));
    gl.uniform3f(U.uLight, x, y, z);
    gl.uniform4f(U.uHead, hp[0], hp[1], e.proc, e.veille);
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

  function tick(dt, now) {
    let bouge = false;
    if (joue) { t = Math.min(END, t + dt); joue = t < END; bouge = true; }
    if (!enGL()) return false; // repli : le nom est fixe
    if (!W) return false; // taille nulle : le ResizeObserver relancera la boucle
    const r = foot.getBoundingClientRect();
    let actif = false;
    if (mode === 2) { // dérive ; descend avec le défilement, lu seulement ; se pose REPOS ms après le dernier défilement
      actif = now - defile < REPOS;
      if (actif) {
        horloge += dt;
        tx = W * (0.5 + 0.36 * Math.sin((horloge / (MOTION.rideau.ms * 8)) * 2 * Math.PI));
        ty = H * (0.08 + 0.62 * Math.min(1, Math.max(0, (innerHeight - r.top) / Math.min(H, innerHeight))));
      }
    } else if (mode === 1 && px != null) { tx = px - r.left; ty = Math.min(Math.max(py - r.top, -H / 4), H * 1.1); }
    const a = 1 - Math.exp(-dt / MOTION.presse.retour.ms), dx = (tx - x) * a, dy = (ty - y) * a; // la lampe suit avec inertie
    bouge ||= dx * dx + dy * dy > 1e-3;
    x += dx; y += dy;
    if (bouge || !dt) dessiner();
    return actif || bouge || !dt;
  }

  // réglages changés pendant la visite : mouvements réduits → image fixe, nom découpé ; couleurs forcées → couleurs du système
  function reglages() {
    reduit = mqReduit.matches; force = mqForce.matches;
    if (reduit || force) { tk?.stop(); joue = false; if (reduit) t = END; repli(); }
    else if (ready && !lost) { ds.plaque = ''; nom(); if (mesurer()) { dessiner(); wake(); } }
    else if (!essaye) creerGL();
  }
  const resize = () => { if (ready && !lost && mesurer()) { dessiner(); wake(); } };

  function monter() {
    io.disconnect();
    if (dead) return;
    tk = ticker(tick, { el: foot, margin: '0px', fps: 60 });
    mqReduit.addEventListener('change', reglages, { signal: ac.signal });
    mqForce.addEventListener('change', reglages, { signal: ac.signal });
    if (mode === 1) {
      addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; wake(); }, on);
      addEventListener('scroll', wake, on);
    } else if (mode === 2) {
      defile = performance.now();
      addEventListener('scroll', () => { defile = performance.now(); wake(); }, on);
    }
    if (reduit || force) repli(); else creerGL();
    // une fois par visite, quand le nom est aux trois cinquièmes à l'écran ; la découpe attend la plaque si elle compile encore
    if (!reduit && !opts.still && opts.t == null && mark) stopSig = onceVisible(mark, () => { veut = true; if (vivant() && enGL()) { joue = t < END; wake(); } }, { threshold: 0.6 });
  }
  // montage à un écran du pied de page ; root: document pour que la marge compte aussi dans un iframe d'une autre origine
  const cb = (es) => es.at(-1).isIntersecting && monter();
  try { io = new IntersectionObserver(cb, { root: document, rootMargin: '100% 0px' }); } catch { io = new IntersectionObserver(cb, { rootMargin: '100% 0px' }); }
  io.observe(foot);

  return {
    seek(v) { t = clamp(+v, 0, END); joue = false; if (enGL()) dessiner(); },
    light(a, b) { x = tx = a; y = ty = b; dessiner(); },
    get fin() { return END; },
    destroy() {
      dead = true; ac.abort(); io.disconnect(); ro?.disconnect(); tk?.destroy(); stopSig?.();
      gl?.getExtension('WEBGL_lose_context')?.loseContext(); cv?.remove(); delete ds.plaque; nomGL = null; nom();
    },
  };
}
