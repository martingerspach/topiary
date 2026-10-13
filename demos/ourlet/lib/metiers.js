// Ourlet · les quatre métiers en schémas animés (motion design calculé en code, sans vidéo).
// Chaque schéma est une fonction du seul temps : frame(t) → { svg, read }. Même t, même image : le site les joue en boucle,
// le film les exporte image par image. API : decoupe | pliage | soudure | peinture({ uid, colors, ral }) →
// { id, duration, frame, still, film, label, setView }. setView({ s, dpr, ox, oy }) est facultatif (motion.html et le film
// ne l'appellent pas) : il donne l'échelle d'affichage, pour des traits d'épaisseur fixe à l'écran, calés sur ses pixels.
//
// Conventions du dessin technique, les mêmes dans les quatre schémas :
// - deux épaisseurs de trait, en pixels d'écran : fort (2 px) pour les contours vus et coupés, fin (1 px) pour les hachures,
//   axes, cotes, trajectoires et lignes d'attache ;
// - on ne hachure que ce que le plan de coupe tranche (outils de pliage) ; une tôle mince coupée se dessine pleine ;
//   ce qui est vu de dessus (tôles, torche, pistolet) n'est jamais hachuré ;
// - axes en trait mixte fin, trajectoires programmées en tirets fins, déplacements à vide en pointillés ;
// - cotes en trait fin, pointes pleines, chiffres de 15 px au moins, toujours à l'écart des traits ;
// - une brisure (zigzag fin) là où une pièce est interrompue par le cadre.
// Mouvement : uniquement la grammaire de l'atelier (tokens : presse, laser, convoyeur, soudure). Aucune boucle ne repasse
// par un fondu : chaque cycle s'enchaîne par un geste (palette du laser, pièce retirée de la presse, chaîne de peinture).
import { coffret } from './pieces.js';
import { pointInPoly } from './part.js';
import { MOTION, EASE, ticker, prefersReduced } from './motion.js';

export const VB = [640, 400];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => (b > a ? clamp((t - a) / (b - a)) : t >= b ? 1 : 0);
const smooth = (x) => x * x * (3 - 2 * x);
const n2 = (v) => String(Math.round(v * 100) / 100);
const NB = '\u00a0';
const fr = (v, d = 1) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[\u00a0\u202f ]/g, NB);
const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, k) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * k)); };
// bruit continu (somme de sinus de périodes premières entre elles) : l'arc et les gerbes vibrent sans sauter
const noise = (t, p) => 0.5 + 0.25 * Math.sin((2 * Math.PI * t) / p) + 0.15 * Math.sin((2 * Math.PI * t) / (p * 0.413) + 1.3) + 0.1 * Math.sin((2 * Math.PI * t) / (p * 1.71) + 2.1);

// Couleurs : rôles du thème clair d'Ourlet ; chaque carte du site passe ses propres teintes (colors)
const BASE = {
  ink: 'var(--ou-color-graphic)', soft: 'var(--ou-color-graphic-soft)', bg: 'var(--schema-bg, var(--ou-color-bg))', surface: 'var(--ou-color-surface)',
  steel: 'var(--ou-palette-tole-300)', steelL: 'var(--ou-palette-tole-200)', steelD: 'var(--ou-palette-tole-400)', inox: 'var(--ou-palette-tole-200)',
  hot: 'var(--ou-palette-soufre-50)', spark: 'var(--ou-palette-soufre-200)', spark2: 'var(--ou-palette-amber-400)',
  straw: 'var(--ou-palette-soufre-200)', bronze: 'var(--ou-palette-beige-300)', blue: 'var(--ou-palette-turquoise-300)',
  plaque: 'var(--ou-color-surface)', plaqueInk: 'var(--ou-color-text)',
};
const theme = (o = {}) => ({ ...BASE, ...o });

// ---------- Le trait ----------
const FORT = 2, FIN = 1; // px d'écran
const DASH = { traj: [6, 4], vide: [0.01, 6], axe: [14, 3, 2, 3] }; // px d'écran
const PT = { L: 9, W: 3.2 }; // pointe de cote : longueur et demi-largeur, px d'écran
const TXT = 15; // chiffres de cote, px d'écran
const FONT = "font-family:var(--ou-font-sans,'Mona Sans',sans-serif);font-weight:560";
// largeur d'un chiffre de cote à l'écran : mesurée avec la vraie police quand le navigateur est là, estimée sinon
let MEAS = null;
const measure = (txt) => {
  if (typeof document !== 'undefined') { MEAS ||= document.createElement('canvas').getContext('2d'); MEAS.font = `560 ${TXT}px 'Mona Sans', sans-serif`; return MEAS.measureText(txt).width; }
  return TXT * 0.6 * txt.length;
};
// plaquette : fond clair sous le chiffre, ligne de cote interrompue ; centrée en (x, y) dans le repère du dessin
function plaque(K, C, x, y, txt, op = 1) {
  const w = K.u(measure(txt) + 12), h = K.u(TXT + 7), r = K.u(4);
  return `<g opacity="${n2(op)}"><rect x="${n2(x - w / 2)}" y="${n2(y - h / 2)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(r)}" fill="${C.plaque}"/><text x="${n2(x)}" y="${n2(y + K.u(TXT * 0.36))}" font-size="${n2(K.fs)}" text-anchor="middle" fill="${C.plaqueInk}" style="${FONT}">${txt}</text></g>`;
}
// Échelle d'affichage → outils de tracé. u(px) : une longueur d'écran en unités du dessin. X(v, w), Y(v, w) : une coordonnée
// de trait fixe calée sur la grille des pixels de l'écran (milieu de pixel pour un trait d'épaisseur impaire).
function kit(view) {
  const k = view.s * view.dpr;
  const fx = (view.ox * view.dpr) % 1, fy = (view.oy * view.dpr) % 1;
  const snap = (v, f, w) => { const half = Math.round(w * view.dpr) % 2 ? 0.5 : 0; return (Math.round(v * k + f - half) + half - f) / k; };
  const u = (px) => px / view.s;
  return {
    u, X: (v, w = FIN) => snap(v, fx, w), Y: (v, w = FIN) => snap(v, fy, w),
    w: (px) => n2(u(px)), dash: (a) => a.map((x) => n2(u(x))).join(' '), fs: u(TXT),
  };
}
const DEF_VIEW = { s: 1, dpr: 1, ox: 0, oy: 0 };
const hatch = (id, C, K) => { const g = K.u(7); return `<pattern id="${id}" width="${n2(g)}" height="${n2(g)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${n2(g)}" height="${n2(g)}" fill="${C.surface}"/><path d="M${n2(g / 2)},0V${n2(g)}" stroke="${C.ink}" stroke-width="${K.w(FIN)}"/></pattern>`; };
const P = (pts, close = true) => 'M' + pts.map((p) => n2(p[0]) + ',' + n2(p[1])).join('L') + (close ? 'Z' : '');
const plen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
function partial(pts, L) { // polyligne coupée à la longueur L ; renvoie [chemin, point de fin]
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + d >= L) { const k = d ? (L - acc) / d : 0, e = [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]; out.push(e); return [out, e]; }
    acc += d; out.push(b);
  }
  return [out, pts[pts.length - 1]];
}
function tail(pts, L, len) { // le bout de polyligne entre L - len et L (le trait de coupe encore chaud)
  const [a] = partial(pts, Math.max(0, L - len)), [b] = partial(pts, L);
  return [a[a.length - 1], ...b.slice(a.length - 1)];
}
const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
// pointe de cote pleine, à la position p, pointant dans la direction (dx, dy)
const pointe = (K, p, dx, dy) => { const L = K.u(PT.L), W = K.u(PT.W), n = Math.hypot(dx, dy) || 1, x = dx / n, y = dy / n; return `M${n2(p[0])},${n2(p[1])}L${n2(p[0] - x * L - y * W)},${n2(p[1] - y * L + x * W)}L${n2(p[0] - x * L + y * W)},${n2(p[1] - y * L - x * W)}Z`; };
// cote horizontale entre x1 et x2 à la hauteur y, lignes d'attache depuis ya1 / ya2, chiffre au-dessus (dir -1) ou au-dessous (dir 1)
function coteH(K, C, x1, x2, y, label, { ya1 = null, ya2 = null, dir = 1, op = 1 } = {}) {
  const Y = K.Y(y), X1 = K.X(x1), X2 = K.X(x2), gap = K.u(3), over = K.u(4);
  let g = `<g opacity="${n2(op)}"><path d="`;
  if (ya1 != null) g += `M${n2(X1)},${n2(ya1 + Math.sign(y - ya1) * gap)}V${n2(Y + Math.sign(y - ya1) * over)}`;
  if (ya2 != null) g += `M${n2(X2)},${n2(ya2 + Math.sign(y - ya2) * gap)}V${n2(Y + Math.sign(y - ya2) * over)}`;
  g += `M${n2(X1)},${n2(Y)}H${n2(X2)}" fill="none" stroke="${C.ink}" stroke-width="${K.w(FIN)}"/>`;
  g += `<path d="${pointe(K, [X1, Y], -1, 0)}${pointe(K, [X2, Y], 1, 0)}" fill="${C.ink}"/>`;
  g += plaque(K, C, (X1 + X2) / 2, Y, label) + '</g>';
  return g;
}
// brisure : ligne fine interrompue d'un zigzag
const brisure = (K, x1, x2, y, xm = (x1 + x2) / 2) => { const a = K.u(5), b = K.u(7), Y = K.Y(y); return `M${n2(x1)},${n2(Y)}H${n2(xm - a)}L${n2(xm - a / 2)},${n2(Y - b)}L${n2(xm + a / 2)},${n2(Y + b)}L${n2(xm + a)},${n2(Y)}H${n2(x2)}`; };
// largeur approchée d'un chiffre de cote (Mona Sans 560 : environ 0,6 em par caractère)
const textW = (K, s) => K.u(measure(s) + 12);

// ======================================================================================================
// 1. Découpe laser, vue de dessus : le coffret 5520-A découpé dans une tôle posée sur la palette de la machine.
// Ordre réel de la machine : les contours intérieurs d'abord, au plus proche voisin, le contour extérieur en dernier (la pièce
// ne bouge pas dans la tôle) ; une amorce dans la chute avant chaque contour ; coupe à vitesse constante, déplacements à vide
// plus vifs ; la chute de chaque trou tombe sous la tôle. Puis le changeur de palette sort la tôle découpée et rentre une
// tôle neuve : la dernière image est la première. Cote hors tout de la pièce sous la tôle.
// ======================================================================================================
export function decoupe({ uid = 'dl', colors = {} } = {}) {
  const C = theme(colors);
  const part = coffret();
  const xs = part.outline.map((q) => q[0]), ys = part.outline.map((q) => q[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const M = 14, S = 284 / (maxY - minY + 2 * M); // 14 mm de squelette autour de la pièce ; la tôle fait 284 unités de haut
  const shH = 284, sy0 = 22, shW = 584, sx0 = 28; // la tôle occupe la largeur de la palette ; la pièce est imbriquée au milieu
  const pw = (maxX - minX) * S;
  const T = (q) => [320 - pw / 2 + (q[0] - minX) * S, sy0 + (q[1] - minY + M) * S];
  const outline0 = part.outline.map(T);
  // contour extérieur : départ au milieu de son plus long côté, amorce dans le squelette
  let best = 0, bl = 0;
  outline0.forEach((p, i) => { const q = outline0[(i + 1) % outline0.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > bl) { bl = l; best = i; } });
  const a = outline0[best], b = outline0[(best + 1) % outline0.length], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const outline = [mid, ...outline0.slice(best + 1), ...outline0.slice(0, best + 1)];
  let nrm = [b[1] - a[1], -(b[0] - a[0])]; const nl = Math.hypot(...nrm); nrm = [nrm[0] / nl, nrm[1] / nl];
  if (pointInPoly([mid[0] + nrm[0] * 3, mid[1] + nrm[1] * 3], outline0)) nrm = [-nrm[0], -nrm[1]];
  const oLead = [mid[0] + nrm[0] * M * S * 0.6, mid[1] + nrm[1] * M * S * 0.6];
  const HOME = [592, 52];
  const H = part.holes.map((h) => { const pts = h.map(T); return { pts, c: centroid(pts) }; });
  const ordered = []; let cur = HOME;
  while (H.length) { let k = 0, d = Infinity; H.forEach((h, i) => { const dd = Math.hypot(h.c[0] - cur[0], h.c[1] - cur[1]); if (dd < d) { d = dd; k = i; } }); const h = H.splice(k, 1)[0]; ordered.push(h); cur = h.c; }
  const leadIn = (h) => { const p0 = h.pts[0], d = Math.hypot(h.c[0] - p0[0], h.c[1] - p0[1]) || 1, k = Math.min(1, 8 / d); return [[p0[0] + (h.c[0] - p0[0]) * k, p0[1] + (h.c[1] - p0[1]) * k], p0]; };
  const contours = [...ordered.map((h) => ({ pts: [...h.pts, h.pts[0]], lead: leadIn(h), hole: true, L0: plen([...h.pts, h.pts[0]]) })), { pts: [...outline, outline[0]], lead: [oLead, outline[0]], hole: false, L0: 1e9 }];
  // chronologie : la grammaire du laser (tokens)
  const VC = MOTION.laser.coupe.v / 1000, VR = MOTION.laser.vide.v / 1000, PIERCE = MOTION.laser.percage.ms, HOLD = MOTION.presse.maintien.ms, FALL = MOTION.micro.ms;
  const steps = []; let t = HOLD, pos = HOME;
  const rapid = (to, i) => { const d = Math.hypot(to[0] - pos[0], to[1] - pos[1]); steps.push({ k: 'rapid', i, t0: t, t1: t + Math.max(FALL, d / VR), from: pos, to }); t = steps[steps.length - 1].t1; pos = to; };
  for (const [i, c] of contours.entries()) {
    rapid(c.lead[0], i);
    steps.push({ k: 'pierce', i, t0: t, t1: t + PIERCE, at: c.lead[0] }); t += PIERCE;
    const ll = plen(c.lead); steps.push({ k: 'lead', i, t0: t, t1: t + ll / VC, pts: c.lead, L: ll }); t = steps[steps.length - 1].t1;
    const cl = plen(c.pts); steps.push({ k: 'cut', i, t0: t, t1: t + cl / VC, pts: c.pts, L: cl }); t = steps[steps.length - 1].t1;
    pos = c.pts[c.pts.length - 1];
  }
  const tCut = t;
  rapid(HOME, contours.length);
  const tHome = t, tSwap0 = tHome + HOLD, SWAP = 640, tSwap1 = tSwap0 + SWAP / (MOTION.convoyeur.v / 1000), duration = tSwap1;
  const mmTot = contours.reduce((sum, c) => sum + plen(c.pts), 0) / S;
  const byI = contours.map((_, i) => ({ cut: steps.find((x) => x.k === 'cut' && x.i === i), lead: steps.find((x) => x.k === 'lead' && x.i === i), pierce: steps.find((x) => x.k === 'pierce' && x.i === i) }));
  const partPath = P(outline0) + ordered.map((h) => P(h.pts)).join('');
  const label = `${fr(maxX - minX, 0)}`;
  let view = DEF_VIEW, K = kit(view), G = null;
  const geom = () => { // géométrie fixe, calée sur les pixels de l'écran
    const x0 = K.X(sx0, FIN), x1 = K.X(sx0 + shW, FIN), y0 = K.Y(sy0, FIN), y1 = K.Y(sy0 + shH, FIN);
    return { sheet: `M${n2(x0)},${n2(y0)}H${n2(x1)}V${n2(y1)}H${n2(x0)}Z`, px0: outline0.reduce((m, p) => Math.min(m, p[0]), 1e9), px1: outline0.reduce((m, p) => Math.max(m, p[0]), -1e9), py1: outline0.reduce((m, p) => Math.max(m, p[1]), -1e9) };
  };
  G = geom();
  // une tôle : la tôle, les trajectoires programmées, et selon l'instant ce qui est déjà découpé
  function sheetLayer(tm, raw) {
    let g = `<path d="${G.sheet}" fill="${C.steel}" stroke="${C.soft}" stroke-width="${K.w(FIN)}"/>`;
    let head = null, cutting = false, hot = null, sep = 0;
    for (const [i, c] of contours.entries()) {
      const { cut: st, lead: ld } = byI[i];
      const done = !raw && tm >= st.t1, started = !raw && tm >= st.t0;
      if (done) {
        if (c.hole) g += `<path d="${P(c.pts)}" fill="${C.bg}" fill-opacity="${n2(seg(tm, st.t1, st.t1 + FALL))}"/>`;
        else sep = seg(tm, st.t1, st.t1 + FALL);
        g += `<path d="${P(c.pts, false)}" fill="none" stroke="${C.ink}" stroke-width="${K.w(FORT)}" stroke-linejoin="round"/>`;
        if (!raw && tm < st.t1 + 260) hot = { pts: c.pts, L: st.L, k: seg(tm, st.t1, st.t1 + 260) };
      } else {
        g += `<path d="${P(c.pts, false)}" fill="none" stroke="${C.soft}" stroke-width="${K.w(FIN)}" stroke-dasharray="${K.dash(c.L0 < 90 ? [2, 2.5] : DASH.traj)}"/>`;
        if (!raw && tm >= ld.t0) { const L = ld.L * seg(tm, ld.t0, ld.t1); const [lp, le] = partial(ld.pts, L); g += `<path d="${P(lp, false)}" fill="none" stroke="${C.ink}" stroke-width="${K.w(FORT)}"/>`; if (tm < ld.t1) { head = le; cutting = true; hot = { pts: ld.pts, L, k: 0 }; } }
        if (started) { const L = st.L * seg(tm, st.t0, st.t1); const [cp, ce] = partial(c.pts, L); g += `<path d="${P(cp, false)}" fill="none" stroke="${C.ink}" stroke-width="${K.w(FORT)}" stroke-linejoin="round"/>`; head = ce; cutting = true; hot = { pts: c.pts, L, k: 0 }; }
      }
    }
    // la pièce détachée du squelette prend sa teinte de tôle propre
    if (sep > 0) g += `<path d="${partPath}" fill="${C.steelL}" fill-opacity="${n2(0.55 * sep)}" fill-rule="evenodd"/><path d="${P(outline0)}" fill="none" stroke="${C.ink}" stroke-width="${K.w(FORT)}"/>`;
    // le trait de coupe encore chaud derrière le faisceau : blanc, puis ambre, puis il refroidit
    if (hot) { const len = K.u(26) * (1 - hot.k); if (len > 0.5) { const tp = tail(hot.pts, hot.L, len); g += `<path d="${P(tp, false)}" fill="none" stroke="${C.spark2}" stroke-width="${K.w(FORT)}" stroke-linecap="round" opacity="${n2(1 - hot.k)}"/>`; } }
    // cote hors tout de la pièce
    g += coteH(K, C, G.px0, G.px1, sy0 + shH + K.u(TXT + 9), label, { ya1: sy0 + shH, ya2: sy0 + shH, dir: 1 });
    return { g, head, cutting };
  }
  function frame(tt) {
    const tm = ((tt % duration) + duration) % duration;
    let g = '';
    // changeur de palette : la tôle découpée sort à gauche, la neuve entre par la droite, d'un même mouvement
    const sw = EASE.convoyeur(seg(tm, tSwap0, tSwap1)), dxOut = -SWAP * sw, dxIn = SWAP * (1 - sw);
    const L1 = sheetLayer(tm, false);
    g += `<g transform="translate(${n2(dxOut)},0)">${L1.g}</g>`;
    if (tm >= tSwap0) g += `<g transform="translate(${n2(dxIn)},0)">${sheetLayer(0, true).g}</g>`;
    // tête de coupe
    let head = L1.head, rapidStep = null, flash = null, pierces = 0, idx = 0;
    for (const s of steps) {
      if (s.k === 'rapid' && tm >= s.t0 && tm < s.t1) { const k = EASE.vide(seg(tm, s.t0, s.t1)); head = [lerp(s.from[0], s.to[0], k), lerp(s.from[1], s.to[1], k)]; rapidStep = s; }
      if (s.k === 'pierce') { if (tm >= s.t0) { pierces++; idx = s.i + 1; } if (tm >= s.t0 && tm < s.t1) head = s.at; if (tm >= s.t0 && tm < s.t1 + 160) flash = { at: s.at, k: seg(tm, s.t0, s.t1 + 160) }; }
      if (s.k === 'lead' && tm >= s.t1 && tm < byI[s.i].cut.t0) head = byI[s.i].cut.pts[0];
    }
    if (!head) head = HOME;
    if (rapidStep) g += `<path d="M${n2(rapidStep.from[0])},${n2(rapidStep.from[1])}L${n2(rapidStep.to[0])},${n2(rapidStep.to[1])}" stroke="${C.ink}" stroke-width="${K.w(FORT)}" stroke-dasharray="${K.dash(DASH.vide)}" stroke-linecap="round" opacity="0.6"/>`;
    if (flash) g += `<circle cx="${n2(flash.at[0])}" cy="${n2(flash.at[1])}" r="${n2(K.u(4 + 12 * EASE.approche(flash.k)))}" fill="none" stroke="${C.spark2}" stroke-width="${K.w(FORT)}" opacity="${n2(1 - flash.k)}"/>`;
    const [hx, hy] = head;
    const cutting = L1.cutting && !rapidStep && tm < tCut;
    if (cutting) { const f = noise(tm, MOTION.soudure.arc); g += `<circle cx="${n2(hx)}" cy="${n2(hy)}" r="${n2(K.u(7 + 2.5 * f))}" fill="${C.spark}" opacity="${n2(0.4 + 0.25 * f)}"/><circle cx="${n2(hx)}" cy="${n2(hy)}" r="${n2(K.u(3))}" fill="${C.hot}"/>`; }
    const R = K.u(12), A = K.u(8), B = K.u(20);
    g += `<g fill="none" stroke="${C.ink}" stroke-width="${K.w(FORT)}"><circle cx="${n2(hx)}" cy="${n2(hy)}" r="${n2(R)}"/><path d="M${n2(hx - B)},${n2(hy)}h${n2(A)}M${n2(hx + R)},${n2(hy)}h${n2(A)}M${n2(hx)},${n2(hy - B)}v${n2(A)}M${n2(hx)},${n2(hy + R)}v${n2(A)}"/></g>`;
    let cutMm = 0;
    if (tm < tSwap1) for (const [i] of contours.entries()) { const st = byI[i].cut; if (tm >= st.t1) cutMm += st.L / S; else if (tm >= st.t0) cutMm += (st.L * seg(tm, st.t0, st.t1)) / S; }
    const read = [['Contour', `${Math.max(0, Math.min(idx, contours.length))} sur ${contours.length}`], ['Longueur coupée', `${fr(Math.min(cutMm, mmTot) / 1000, 2)}${NB}m`], ['Amorçages', String(pierces)]];
    return { svg: g, read };
  }
  const still = byI[Math.floor(contours.length * 0.62)].cut.t0 + 260;
  return { id: 'decoupe', duration, frame, still, film: [HOLD, tHome + 200], setView(v) { view = v; K = kit(v); G = geom(); },
    label: `Découpe laser du coffret 5520-A${NB}: les trous d'abord, le contour en dernier, puis la palette sort la tôle découpée. La pièce mesure ${label} mm.` };
}

// ======================================================================================================
// 2. Pliage en l'air, en coupe : poinçon et matrice en V coupés (hachurés), tôle de 2 mm coupée (pleine), butée arrière.
// La presse : approche rapide jusqu'au contact, appui lent jusqu'à 88°, maintien, retour élastique (le poinçon remonte, la
// tôle revient à 90°). La cote d'angle se pose une fois le poinçon remonté. L'opérateur sort la pièce (elle se dégage du V,
// puis glisse vers l'avant), et pousse le flan suivant contre la butée : la dernière image est la première.
// ======================================================================================================
export function pliage({ uid = 'pl', colors = {} } = {}) {
  const C = theme(colors);
  const PX = 5, th = 2 * PX, V = 16 * PX, cx = 320, top = 262, L = 230; // 1 mm = 5 unités ; V de 16 mm ; ailes de 46 mm
  const dieW = 64, apexY = top + (V / 2) * Math.tan((52 * Math.PI) / 180), dieBot = 378;
  const OPEN = 60, contact = top - th, Bmax = 46, Bfin = 45, LIFT = 48;
  const punchPath = (tipY) => { const r = 4, w1 = 30, h1 = w1 / Math.tan((44 * Math.PI) / 180); return `M${cx - r},${tipY - 2}Q${cx},${tipY + 2} ${cx + r},${tipY - 2}L${cx + w1},${tipY - h1}V${tipY - h1 - 120}H${cx + 18}V-40H${cx - 18}V${tipY - h1 - 120}H${cx - w1}V${tipY - h1}Z`; };
  function geo(beta) { // beta : relevé de chaque aile au-dessus de l'horizontale, en degrés
    const b = (beta * Math.PI) / 180, vy = top + (V / 2) * Math.tan(b), c = Math.cos(b), s = Math.sin(b);
    const off = (th / 2) / Math.max(0.3, c), mY = vy - off;
    return { vx: cx, vy, mY, b, c, s, left: [cx - c * L, mY - s * L], right: [cx + c * L, mY - s * L], tipY: vy - th / Math.max(0.3, c) };
  }
  // chronologie : la presse (tokens), puis le changement de pièce au pas du convoyeur
  const PR = MOTION.presse, VCV = MOTION.convoyeur.v / 1000;
  const T = {}; T.app0 = PR.maintien.ms; T.app1 = T.app0 + PR.approche.ms; T.bend1 = T.app1 + PR.appui.ms; T.dwell = T.bend1 + PR.maintien.ms;
  T.ret1 = T.dwell + PR.retour.ms; T.cote1 = T.ret1 + MOTION.micro.ms; T.out0 = T.cote1 + PR.maintien.ms * 3;
  const DOUT = cx + L * Math.cos(Math.PI / 4) + 60, DIN = cx + L + 40;
  T.lift1 = T.out0 + PR.approche.ms; T.out1 = T.lift1 + DOUT / VCV; T.in1 = T.out1 + DIN / VCV;
  const duration = T.in1;
  let view = DEF_VIEW, K = kit(view), G = null;
  const geom = () => {
    const X = (v) => K.X(v, FORT), Y = (v) => K.Y(v, FORT);
    const L0 = X(cx - V / 2 - dieW * 1.6), R0 = X(cx + V / 2 + dieW * 1.6), T0 = Y(top), B0 = K.Y(dieBot, FIN);
    // matrice : bloc, V avec rayons d'épaule et dégagement au fond ; bas interrompu par une brisure
    const die = `M${n2(L0)},${n2(B0)}V${n2(T0)}H${cx - V / 2 - 6}Q${cx - V / 2},${n2(T0)} ${cx - V / 2 + 4},${n2(T0 + 5)}L${cx - 6},${apexY - 7}h12L${cx + V / 2 - 4},${n2(T0 + 5)}Q${cx + V / 2},${n2(T0)} ${cx + V / 2 + 6},${n2(T0)}H${n2(R0)}V${n2(B0)}`;
    const gx = X(cx + L), gT = Y(top - 44), gB = Y(top);
    return { die, dieFill: die + 'Z', brk: brisure(K, L0, R0, dieBot, lerp(L0, R0, 0.22)), gauge: `M${n2(gx)},${n2(gB)}V${n2(gT)}H${n2(gx + 26)}V${n2(Y(top - 30))}H660V${n2(Y(top - 14))}H${n2(gx + 26)}V${n2(gB)}Z`, axis: K.X(cx, FIN), open: K.Y(OPEN, FORT) };
  };
  G = geom();
  // cote d'angle : arc au rayon r dans le pli, pointes contre les ailes, chiffre au-dessus
  function coteAngle(Gb, ang, op, dx, dy) {
    const iy = Gb.mY - (th / 2) / Math.max(0.3, Gb.c), ix = Gb.vx, r = 64, b = Gb.b;
    const a1 = [ix + Math.cos(b) * r, iy - Math.sin(b) * r], a2 = [ix - Math.cos(b) * r, iy - Math.sin(b) * r];
    const t1 = [-Math.sin(b), -Math.cos(b)], t2 = [Math.sin(b), -Math.cos(b)]; // tangentes, vers les ailes
    let g = `<g opacity="${n2(op)}" transform="translate(${n2(dx)},${n2(dy)})"><path d="M${n2(a2[0])},${n2(a2[1])}A${r},${r} 0 0 1 ${n2(a1[0])},${n2(a1[1])}" fill="none" stroke="${C.ink}" stroke-width="${K.w(FIN)}"/>`;
    g += `<path d="${pointe(K, a1, -t1[0], -t1[1])}${pointe(K, a2, -t2[0], -t2[1])}" fill="${C.ink}"/>`;
    g += plaque(K, C, ix, iy - r, `${fr(ang)}°`) + '</g>';
    return g;
  }
  function frame(tt) {
    const tm = ((tt % duration) + duration) % duration;
    let beta = 0, tipY = G.open, dx = 0, dy = 0, flatX = 0, released = false;
    if (tm < T.app0) tipY = G.open;
    else if (tm < T.app1) tipY = lerp(G.open, contact, EASE.approche(seg(tm, T.app0, T.app1)));
    else if (tm < T.bend1) { beta = Bmax * EASE.appui(seg(tm, T.app1, T.bend1)); tipY = geo(beta).tipY; }
    else if (tm < T.dwell) { beta = Bmax; tipY = geo(beta).tipY; }
    else if (tm < T.ret1) { const k = EASE.retour(seg(tm, T.dwell, T.ret1)); beta = lerp(Bmax, Bfin, k); tipY = lerp(geo(Bmax).tipY, G.open, k); released = true; }
    else { beta = Bfin; tipY = G.open; released = true; }
    if (tm >= T.out0 && tm < T.out1) { dy = -LIFT * EASE.approche(seg(tm, T.out0, T.lift1)); dx = -DOUT * EASE.convoyeur(seg(tm, T.lift1, T.out1)); }
    const entering = tm >= T.out1;
    if (entering) flatX = -DIN * (1 - EASE.convoyeur(seg(tm, T.out1, T.in1)));
    const Gb = geo(beta);
    let g = `<defs>${hatch(uid + '-h', C, K)}</defs>`;
    // matrice coupée, brisure en bas
    g += `<path d="${G.dieFill}" fill="url(#${uid}-h)"/><path d="${G.die}" fill="none" stroke="${C.ink}" stroke-width="${K.w(FORT)}" stroke-linejoin="round"/><path d="${G.brk}" fill="none" stroke="${C.ink}" stroke-width="${K.w(FIN)}"/>`;
    // butée arrière : le doigt et son bras, qui sort du cadre
    g += `<path d="${G.gauge}" fill="${C.surface}" stroke="${C.ink}" stroke-width="${K.w(FORT)}" stroke-linejoin="round"/>`;
    // la tôle, en coupe pleine
    if (!entering) {
      const sheet = beta === 0 && tm < T.app1 ? `M${cx - L},${top - th / 2}H${cx + L}` : `M${n2(Gb.left[0])},${n2(Gb.left[1])}L${n2(Gb.vx)},${n2(Gb.mY)}L${n2(Gb.right[0])},${n2(Gb.right[1])}`;
      g += `<path d="${sheet}" fill="none" stroke="${C.ink}" stroke-width="${th}" stroke-linejoin="round" stroke-linecap="butt" transform="translate(${n2(dx)},${n2(dy)})"/>`;
      if (released) g += coteAngle(Gb, 180 - 2 * beta, seg(tm, T.ret1, T.cote1), dx, dy);
    }
    if (entering) g += `<path d="M${n2(cx - L + flatX)},${top - th / 2}H${n2(cx + L + flatX)}" stroke="${C.ink}" stroke-width="${th}"/>`;
    // poinçon coupé (au-dessus de la tôle)
    g += `<path d="${punchPath(tipY)}" fill="url(#${uid}-h)" stroke="${C.ink}" stroke-width="${K.w(FORT)}" stroke-linejoin="round"/>`;
    // axe de symétrie de l'outillage (trait mixte fin), sur le poinçon et sur la matrice, sans traverser la cote
    g += `<path d="M${n2(G.axis)},4V${n2(tipY + K.u(10))}M${n2(G.axis)},${n2(top - K.u(10))}V${n2(dieBot - K.u(12))}" stroke="${C.soft}" stroke-width="${K.w(FIN)}" stroke-dasharray="${K.dash(DASH.axe)}"/>`;
    const ang = 180 - 2 * beta;
    const read = [['Angle', tm < T.app1 || entering ? '180,0°' : `${fr(ang)}°`], ['Tolérance', `90°${NB}±${NB}0,5°`], ['Retour élastique', released && !entering ? `+${fr(2 * (Bmax - Bfin))}°, compensé` : 'en attente']];
    return { svg: g, read };
  }
  return { id: 'pliage', duration, frame, still: T.cote1 + 200, film: [0, T.out0 + 200], setView(v) { view = v; K = kit(v); G = geom(); },
    label: `Pliage en l'air dans une matrice en V${NB}: le poinçon descend à 88°, la tôle revient à 90° quand il remonte.` };
}

// ======================================================================================================
// 3. Soudure TIG bout à bout, vue de dessus : deux tôles d'inox, la torche avance à vitesse constante, la baguette trempe
// dans l'avant du bain à chaque écaille. Le cordon garde la forme du bord de fuite du bain : des écailles bombées vers
// l'arrière. Autour, les couleurs de revenu de l'inox. L'arc vibre (bruit continu). En fin de cordon, le cratère se remplit,
// l'arc se coupe, la torche revient au départ pendant que les tôles soudées sortent et que les suivantes entrent.
// Cote : la longueur du cordon, qui grandit avec lui.
// ======================================================================================================
export function soudure({ uid = 'sd', colors = {} } = {}) {
  const C = theme(colors);
  const y = 200, x0 = 96, x1 = 544, PITCH = 13, BW = 14, PL = [48, 592], PT0 = 72, PB1 = 328, GAP = 3;
  const DIP = MOTION.soudure.ecaille, V = PITCH / DIP; // une écaille par trempage : vitesse d'avance constante
  const T = {}; T.strike = MOTION.presse.maintien.ms; T.on = T.strike + MOTION.micro.ms; T.end = T.on + (x1 - x0) / V; T.off = T.end + MOTION.presse.maintien.ms;
  T.swap0 = T.off; T.swap1 = T.swap0 + 640 / (MOTION.convoyeur.v / 1000); T.back1 = T.off + Math.max(MOTION.micro.ms, (x1 - x0) / (MOTION.laser.vide.v / 1000));
  const duration = T.swap1;
  const nR = Math.floor((x1 - x0) / PITCH);
  const ripples = Array.from({ length: nR }, (_, i) => ({ x: x0 + i * PITCH + 8, w: BW - 1.5 + hash(i, 2) * 1.8, j: (hash(i, 5) - 0.5) * 1.2 }));
  let view = DEF_VIEW, K = kit(view), G = null;
  const geom = () => {
    const X = (v) => K.X(v, FORT), Y = (v) => K.Y(v, FORT);
    const a = X(PL[0]), b = X(PL[1]);
    return { top: `M${n2(a)},${n2(Y(PT0))}H${n2(b)}V${n2(Y(y - GAP))}H${n2(a)}Z`, bot: `M${n2(a)},${n2(Y(y + GAP))}H${n2(b)}V${n2(Y(PB1))}H${n2(a)}Z` };
  };
  G = geom();
  // une paire de tôles, et le cordon fait jusqu'à x = done
  function plates(done, tm) {
    let g = `<path d="${G.top}" fill="${C.inox}" stroke="${C.ink}" stroke-width="${K.w(FORT)}"/><path d="${G.bot}" fill="${C.inox}" stroke="${C.ink}" stroke-width="${K.w(FORT)}"/>`;
    // axe du joint en avant du cordon (trait mixte fin)
    if (done < x1) g += `<path d="M${n2(Math.max(x0 - 24, done + 30))},${n2(K.Y(y))}H${n2(PL[1] - 8)}" stroke="${C.soft}" stroke-width="${K.w(FIN)}" stroke-dasharray="${K.dash(DASH.axe)}"/>`;
    if (done > x0 + 2) {
      // couleurs de revenu de l'inox, de part et d'autre du cordon déjà fait
      for (const [off, col, o] of [[40, C.blue, 0.5], [30, C.bronze, 0.6], [21, C.straw, 0.7]]) g += `<path d="M${x0},${y - off}H${n2(done)}Q${n2(done + off * 0.9)},${y} ${n2(done)},${y + off}H${x0}Q${x0 - off * 0.6},${y} ${x0},${y - off}Z" fill="${col}" opacity="${o}"/>`;
      g += `<path d="M${x0},${y - BW}H${n2(done)}V${y + BW}H${x0}Z" fill="${C.steelL}"/>`;
      let rp = '';
      for (const r of ripples) { if (r.x + 8 > done + 2) break; rp += `M${n2(r.x + 6)},${n2(y - r.w + r.j)}Q${n2(r.x - 10)},${n2(y + r.j)} ${n2(r.x + 6)},${n2(y + r.w + r.j)}`; }
      g += `<path d="${rp}" fill="none" stroke="${C.soft}" stroke-width="${K.w(FIN)}"/>`;
      g += `<path d="M${x0},${y - BW}H${n2(done)}M${x0},${y + BW}H${n2(done)}" stroke="${C.ink}" stroke-width="${K.w(FIN)}"/>`;
      // cote de la longueur du cordon, sous le joint, une fois qu'elle a la place de son chiffre
      const mm = (done - x0) / 3.6, lab = `${fr(mm, 0)}${NB}mm`, room = done - x0 - textW(K, lab) - 2 * K.u(PT.L);
      if (room > 0) g += coteH(K, C, x0, done, y + BW + K.u(TXT + 9), lab, { ya1: y + BW, ya2: y + BW, dir: 1, op: clamp(room / K.u(24)) });
    }
    return g;
  }
  function frame(tt) {
    const tm = ((tt % duration) + duration) % duration;
    const prog = seg(tm, T.on, T.end), tx = lerp(x0, x1, prog);
    const arcK = tm < T.strike ? 0 : tm < T.on ? EASE.approche(seg(tm, T.strike, T.on)) : tm < T.end ? 1 : 1 - EASE.approche(seg(tm, T.end, T.off));
    const done = tm < T.on ? x0 : Math.max(x0, tx - 6);
    const sw = EASE.convoyeur(seg(tm, T.swap0, T.swap1));
    let g = '';
    g += `<g transform="translate(${n2(-640 * sw)},0)">${plates(tm >= T.end ? x1 - 6 : done, tm)}</g>`;
    if (tm >= T.swap0) g += `<g transform="translate(${n2(640 * (1 - sw))},0)">${plates(x0, 0)}</g>`;
    // bain de fusion et lueur de l'arc (vibration continue)
    if (arcK > 0.001) {
      const f = noise(tm, MOTION.soudure.arc), px = Math.min(tx, x1);
      g += `<circle cx="${n2(px + 4)}" cy="${y}" r="${n2((50 + 18 * f) * arcK)}" fill="${C.straw}" opacity="${n2(0.18 * arcK)}"/><circle cx="${n2(px + 4)}" cy="${y}" r="${n2((28 + 10 * f) * arcK)}" fill="${C.straw}" opacity="${n2(0.24 * arcK)}"/>`;
      g += `<ellipse cx="${n2(px + 8)}" cy="${y}" rx="${n2(15 * arcK)}" ry="${n2(15 * arcK)}" fill="${C.hot}" stroke="${C.spark}" stroke-width="${K.w(FORT)}"/>`;
    }
    // baguette d'apport : elle arrive de l'avant, trempe dans le bain à chaque écaille, se retire
    if (tm >= T.on && tm < T.end) {
      const ph = ((tm - T.on) % DIP) / DIP, dip = ph < 0.4 ? Math.sin((ph / 0.4) * Math.PI) : 0;
      const ux = 0.62, uy = 0.78, back = 12 - 14 * dip, tipX = tx + 20 + ux * back, tipY = y + 8 + uy * back;
      g += `<path d="M${n2(tipX)},${n2(tipY)}L${n2(tipX + ux * 220)},${n2(tipY + uy * 220)}" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/><path d="M${n2(tipX)},${n2(tipY)}L${n2(tipX + ux * 220)},${n2(tipY + uy * 220)}" stroke="${C.steelD}" stroke-width="5" stroke-linecap="round"/>`;
    }
    // torche, vue de dessus, inclinée vers l'avant : le corps part en arrière ; elle revient au départ à vide
    const thx = tm < T.off ? Math.min(tx, x1) : lerp(x1, x0, EASE.vide(seg(tm, T.off, T.back1)));
    g += `<g transform="translate(${n2(thx)},${y})"><path d="M-9,-14L-96,-118L-80,-131L6,-26Z" fill="${C.surface}" stroke="${C.ink}" stroke-width="${K.w(FORT)}" stroke-linejoin="round"/><circle r="24" fill="${C.surface}" stroke="${C.ink}" stroke-width="${K.w(FORT)}"/><circle r="13" fill="none" stroke="${C.ink}" stroke-width="${K.w(FIN)}"/><circle r="3.5" fill="${arcK > 0.5 ? C.hot : C.ink}"/></g>`;
    const mm = Math.max(0, (tm >= T.end ? x1 - 6 : done) - x0) / 3.6;
    const read = [['Procédé', 'TIG, inox 304L'], ['Cordon', `${fr(tm >= T.swap0 && sw > 0.5 ? 0 : mm, 0)}${NB}mm`], ['Arc', arcK > 0.5 ? 'amorcé' : tm >= T.end ? 'coupé' : 'en attente']];
    return { svg: g, read };
  }
  return { id: 'soudure', duration, frame, still: lerp(T.on, T.end, 0.66), film: [T.strike, T.off + 400], setView(v) { view = v; K = kit(v); G = geom(); },
    label: 'Soudure TIG bout à bout : la baguette trempe dans le bain à chaque écaille du cordon, puis les tôles soudées sortent.' };
}

// ======================================================================================================
// 4. Peinture poudre, en coupe : des profilés en U accrochés à la chaîne, qui avance à vitesse constante. Devant le pistolet
// électrostatique, la poudre chargée suit les lignes de champ : elle contourne les bords et couvre aussi la face cachée,
// moins les angles intérieurs (cage de Faraday). Puis le profilé entre au four, où la poudre fond et prend sa teinte.
// La chaîne est périodique : une pièce prend la place de la précédente, la boucle n'a pas de début.
// ======================================================================================================
export function peinture({ uid = 'pt', ral = { code: '6034', value: '#7FB0AE' }, colors = {} } = {}) {
  const C = theme(colors);
  const RAIL = 34, HOOK = 30, W = 132, Hh = 176, TH = 10, D = 300, AIM = 170, OVEN = 420, FLOOR = 362;
  const v = MOTION.convoyeur.chaine / 1000, duration = D / v;
  const Y0 = RAIL + HOOK, Y1 = Y0 + Hh;
  const xAt = (t, k) => AIM - D + v * t + k * D; // centre de la pièce k ; à t = 0 la pièce 1 est devant le pistolet
  const ZONE = 96, cover = (x) => smooth(clamp((x - (AIM - ZONE)) / (2 * ZONE))), cure = (x) => smooth(clamp((x - (OVEN + 10)) / 140));
  // faces à couvrir, relatives au coin haut gauche : [chemin(k), part de couche]
  const faces = [
    { d: (X, k) => `M${X + W},${Y0}h${k}V${Y1 + k}h${-k}Z`, w: 1 }, // face extérieure droite, côté pistolet
    { d: (X, k) => `M${X + W - TH},${Y1}v${k}h${TH + k}V${Y1}Z`, w: 0.95 }, // chant bas droit
    { d: (X, k) => `M${X},${Y1}v${k}h${TH}V${Y1}Z`, w: 0.8 }, // chant bas gauche
    { d: (X, k) => `M${X},${Y0}V${Y0 - k}H${X + W + k}V${Y0}Z`, w: 0.85 }, // dessus de l'âme
    { d: (X, k) => `M${X},${Y0 - k}h${-k}V${Y1 + k}h${k}Z`, w: 0.7 }, // face cachée : enveloppement
    { d: (X, k) => `M${X + W - TH},${Y0 + TH}h${-k}V${Y1}h${k}Z`, w: 0.6 }, // intérieur droit
    { d: (X, k) => `M${X + TH},${Y0 + TH}h${k}V${Y1}h${-k}Z`, w: 0.42 }, // intérieur gauche (cage de Faraday)
    { d: (X, k) => `M${X + TH},${Y0 + TH}V${Y0 + TH + k}H${X + W - TH}V${Y0 + TH}Z`, w: 0.36 },
  ];
  // particules : elles partent de la buse et visent la pièce qui sera devant le pistolet quand elles arrivent
  const R = rng(17), N = 260, gun = [AIM + 130, 324];
  const parts = Array.from({ length: N }, () => {
    const r = R(), tg = r < 0.42 ? 0 : r < 0.62 ? 1 : r < 0.78 ? 2 : r < 0.9 ? 3 : 4;
    const t0 = R() * duration, fl = 520 + R() * 420;
    return { tg, t0, fl, u: R(), v2: R(), c: R(), r: 1.3 + R() * 1.1, from: [gun[0] - 20, gun[1] - 14 + (R() - 0.5) * 6] };
  });
  const pale = mixHex(ral.value, '#FFFFFF', 0.6);
  let view = DEF_VIEW, K = kit(view), G = null;
  const geom = () => ({ rail: K.Y(RAIL, FORT), floor: K.Y(FLOOR, FORT), wall: K.X(OVEN, FORT), roof: K.Y(RAIL - 18, FORT) });
  G = geom();
  function target(p, X) { // point d'arrivée sur la pièce dont le coin gauche est en X
    if (p.tg === 0) return [X + W + 2, lerp(Y0 + 10, Y1, p.u)];
    if (p.tg === 1) return [lerp(X + W - TH, X + W, p.u), Y1 + 2];
    if (p.tg === 2) return [lerp(X, X + TH, p.u), Y1 + 2];
    if (p.tg === 3) return [X - 2, lerp(Y0 + 20, Y1, p.u)];
    return [lerp(X + TH + 4, X + W - TH - 4, p.u), Y1 - 6 - p.v2 * 40]; // vers l'intérieur
  }
  function ctrl(p, a, b, X) { // les lignes de champ : par le bas, autour du chant pour la face cachée, par l'ouverture du U
    if (p.tg === 3) return [X - 44 - p.c * 16, Y1 + 60 + p.c * 20];
    if (p.tg === 4) return [b[0] + 10, Y1 + 40 + p.c * 16];
    if (p.tg === 2) return [lerp(a[0], b[0], 0.5), Y1 + 40 + p.c * 20];
    return [lerp(a[0], b[0], 0.55) + (p.c - 0.5) * 30, lerp(a[1], b[1], 0.35) + 30 + p.c * 20];
  }
  function frame(tt) {
    const tm = ((tt % duration) + duration) % duration;
    let g = '';
    // four : toit, sol, paroi d'entrée basse ; l'air chaud monte (vagues périodiques, deux par cycle)
    g += `<path d="M660,${n2(G.roof)}H${n2(G.wall)}V${n2(K.Y(RAIL - 9, FORT))}M${n2(G.wall)},${n2(K.Y(Y1 + 24, FORT))}V${n2(G.floor)}H660" fill="none" stroke="${C.ink}" stroke-width="${K.w(FORT)}" stroke-linejoin="round"/>`;
    g += `<rect x="${n2(G.wall)}" y="${n2(G.roof)}" width="${n2(660 - G.wall)}" height="${n2(G.floor - G.roof)}" fill="${C.spark2}" opacity="0.1"/>`;
    for (let i = 0; i < 5; i++) {
      const x = OVEN + 34 + i * 42, ph = ((tm / duration) * 2 + i * 0.37) % 1, yb = FLOOR - 16 - ph * 180;
      g += `<path d="M${n2(x)},${n2(yb)}c7,-12 -7,-24 0,-36s-7,-24 0,-36" fill="none" stroke="${C.spark2}" stroke-width="${K.w(FORT)}" stroke-linecap="round" opacity="${n2(0.7 * Math.sin(ph * Math.PI))}"/>`;
    }
    // chaîne : le rail et ses chariots
    g += `<path d="M0,${n2(G.rail)}H640" stroke="${C.ink}" stroke-width="${K.w(FORT)}"/>`;
    let um = 0, umX = Infinity;
    for (let k = 0; k <= 3; k++) {
      const xc = xAt(tm, k), X = xc - W / 2;
      if (X > 650 || X + W < -20) continue;
      const cv = cover(xc), cu = cure(xc);
      if (xc >= AIM - ZONE && xc < OVEN && xc < umX) { umX = xc; um = 80 * cv; } // la pièce la plus récemment passée devant le pistolet
      const coat = cu > 0 ? mixHex(pale, ral.value, cu) : pale;
      g += `<rect x="${n2(xc - 9)}" y="${RAIL - 7}" width="18" height="12" rx="2" fill="${C.surface}" stroke="${C.ink}" stroke-width="${K.w(FIN)}"/><path d="M${n2(xc)},${RAIL + 5}V${Y0 - 10}q0,10 -10,10" fill="none" stroke="${C.ink}" stroke-width="${K.w(FORT)}"/>`;
      for (const f of faces) { const kk = 9 * f.w * cv; if (kk > 0.05) g += `<path d="${f.d(X, kk)}" fill="${coat}" stroke="${C.soft}" stroke-width="${kk > 2 ? K.w(FIN) : 0}"/>`; }
      g += `<path d="M${n2(X)},${Y0}H${n2(X + W)}V${Y1}H${n2(X + W - TH)}V${Y0 + TH}H${n2(X + TH)}V${Y1}H${n2(X)}Z" fill="${C.ink}"/>`;
    }
    // pistolet : corps et buse, sous la chaîne, incliné vers la pièce (vu, donc non hachuré)
    const xn = xAt(tm, Math.round(1 - (v * tm) / D)), on = smooth(clamp(Math.min((xn - (AIM - ZONE)) / 40, ((AIM + ZONE) - xn) / 40)));
    g += `<g transform="translate(${gun[0]},${gun[1]}) rotate(36)"><path d="M10,-11H118V11H10Z" fill="${C.surface}" stroke="${C.ink}" stroke-width="${K.w(FORT)}" stroke-linejoin="round"/><path d="M10,-7L-6,-13V13L10,7" fill="${C.surface}" stroke="${C.ink}" stroke-width="${K.w(FORT)}" stroke-linejoin="round"/><path d="M-6,0H-18" stroke="${C.ink}" stroke-width="${K.w(FORT)}"/></g>`;
    if (on > 0.01) g += `<ellipse cx="${gun[0] - 64}" cy="${gun[1] - 47}" rx="50" ry="26" transform="rotate(36 ${gun[0] - 64} ${gun[1] - 47})" fill="${pale}" opacity="${n2(0.32 * on)}"/>`;
    let dots = '';
    for (const p of parts) {
      for (const cyc of [0, -duration]) {
        const t0 = p.t0 + cyc, k = (tm - t0) / p.fl;
        if (k < 0 || k > 1) continue;
        const tl = t0 + p.fl, kk = Math.round(1 - (v * tl) / D), xl = xAt(tl, kk); // la pièce qui sera devant le pistolet à l'arrivée
        if (xl < AIM - ZONE + 10 || xl > AIM + ZONE - 10) continue; // le pistolet ne tire que sur une pièce présente
        const land = xl - W / 2, b = target(p, land), c = ctrl(p, p.from, b, land), uu = EASE.approche(k), a = 1 - uu;
        // la pièce avance pendant le vol : la cible la suit
        const shift = v * (tm - (t0 + p.fl));
        const x = a * a * p.from[0] + 2 * a * uu * c[0] + uu * uu * (b[0] + shift), yy = a * a * p.from[1] + 2 * a * uu * c[1] + uu * uu * b[1];
        dots += `<circle cx="${n2(x)}" cy="${n2(yy)}" r="${n2(Math.max(K.u(1.2), p.r))}"/>`;
      }
    }
    if (dots) g += `<g fill="${pale}" stroke="${C.soft}" stroke-width="${K.w(FIN)}">${dots}</g>`;
    const read = [['Couche', `${fr(um, 0)}${NB}µm`], ['Four', `180${NB}°C`], ['Teinte', `RAL ${ral.code}`]];
    return { svg: g, read };
  }
  return { id: 'peinture', duration, frame, still: 40 / v, film: [0, duration * 1.5], setView(v) { view = v; K = kit(v); G = geom(); },
    label: `Peinture poudre${NB}: sur la chaîne, la poudre électrostatique contourne les bords et couvre aussi la face cachée, puis le profilé cuit au four à 180${NB}°C.` };
}

// ======================================================================================================
// Lecture : joue un schéma dans un <svg>, en boucle, seulement visible et onglet affiché ; pause ; mouvements réduits.
// L'échelle d'affichage est relue à chaque redimensionnement : traits de 1 et 2 px, calés sur les pixels de l'écran.
// ======================================================================================================
export function mountSchema(svgEl, def, { readEl = null, reduced = null, autoplay = true } = {}) {
  svgEl.setAttribute('viewBox', `0 0 ${VB[0]} ${VB[1]}`);
  const rm = reduced ?? prefersReduced();
  // avant la première lecture (ou en mouvements réduits), le schéma montre son image clé, pas une image vide
  let t = def.still, fresh = true, wanted = autoplay && !rm, lastRead = '';
  const cells = [];
  if (readEl) {
    readEl.innerHTML = def.frame(def.still).read.map(([k]) => `<div><dt>${k}</dt><dd></dd></div>`).join('');
    readEl.querySelectorAll('dd').forEach((d) => cells.push(d));
  }
  // les motifs (hachures, lattes) ne changent qu'avec l'échelle : gardés d'une image à l'autre, seul le dessin est réécrit
  let defsKey = null, dyn = null;
  function draw() {
    const f = def.frame(t);
    let body = f.svg, defs = '';
    if (body.startsWith('<defs>')) { const e = body.indexOf('</defs>') + 7; defs = body.slice(0, e); body = body.slice(e); }
    if (defs !== defsKey || !dyn || !dyn.isConnected) { defsKey = defs; svgEl.innerHTML = `${defs}<g></g>`; dyn = svgEl.lastChild; }
    dyn.innerHTML = body;
    const key = f.read.map((r) => r[1]).join('|');
    if (key !== lastRead) { lastRead = key; f.read.forEach((r, i) => { if (cells[i]) cells[i].textContent = r[1]; }); }
  }
  const measure = () => {
    const r = svgEl.getBoundingClientRect(); if (!r.width) return;
    if (def.setView) def.setView({ s: r.width / VB[0], dpr: Math.min(2, window.devicePixelRatio || 1), ox: r.left + window.scrollX, oy: r.top + window.scrollY });
    draw();
  };
  const tk = ticker((dt) => { if (fresh) { fresh = false; t = 0; } else t = (t + dt) % def.duration; draw(); }, { el: svgEl, margin: '80px' });
  const ro = new ResizeObserver(measure); ro.observe(svgEl);
  measure();
  if (wanted) tk.start();
  const api = {
    get playing() { return wanted; },
    play() { wanted = true; tk.start(); }, pause() { wanted = false; tk.stop(); },
    toggle() { if (wanted) api.pause(); else api.play(); return wanted; },
    seek(ms) { t = ms; fresh = false; draw(); },
    get t() { return t; },
    destroy() { tk.destroy(); ro.disconnect(); },
  };
  return api;
}
