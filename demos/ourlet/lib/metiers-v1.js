// Ourlet · les quatre métiers en schémas animés (motion design calculé en code, sans vidéo).
// Chaque schéma est une fonction du seul temps : frame(t) → { svg, read }. Même t, même image : le site les joue en boucle,
// le film les exporte image par image.
// Conventions du dessin technique : pièces coupées hachurées à 45°, tôle mince en coupe pleine, trajectoires programmées
// en tirets, déplacements à vide en pointillés. Les valeurs affichées suivent la géométrie dessinée.
import { coffret } from './pieces.js';
import { pointInPoly } from './part.js';

export const VB = [640, 400];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const presse = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const outC = (x) => 1 - Math.pow(1 - x, 3);
const seg = (t, a, b) => clamp((t - a) / (b - a));
const n1 = (v) => v.toFixed(1);
const NB = ' ';
const fr = (v, d = 1) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, NB);
const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixArr = (a, b, k) => rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * k));
const toHex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, k) => toHex(mixArr(a, b, k));

// Couleurs : rôles du thème clair d'Ourlet ; les teintes de matière viennent de la palette (illustration)
const C = {
  ink: 'var(--ou-color-graphic)', soft: 'var(--ou-color-graphic-soft)', bg: 'var(--schema-bg, var(--ou-color-bg))', surface: 'var(--ou-color-surface)',
  steel: 'var(--ou-palette-tole-300)', steelL: 'var(--ou-palette-tole-200)', steelD: 'var(--ou-palette-tole-400)', inox: 'var(--ou-palette-tole-200)',
  hot: 'var(--ou-palette-soufre-50)', spark: 'var(--ou-palette-soufre-200)', spark2: 'var(--ou-palette-amber-400)',
  straw: 'var(--ou-palette-soufre-200)', bronze: 'var(--ou-palette-beige-300)', blue: 'var(--ou-palette-turquoise-300)',
};
const hatch = (id, ang = 45, gap = 7) => `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${ang})"><rect width="${gap}" height="${gap}" fill="${C.surface}"/><line x1="0" y1="0" x2="0" y2="${gap}" stroke="${C.ink}" stroke-width="1.15"/></pattern>`;
const P = (pts, close = true) => 'M' + pts.map((p) => n1(p[0]) + ',' + n1(p[1])).join('L') + (close ? 'Z' : '');
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
const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

// ======================================================================================================
// 1. Découpe laser, vue de dessus : le coffret 5520-A découpé dans la tôle, dans l'ordre réel de la machine.
// Les contours intérieurs d'abord, du plus proche au plus proche, le contour extérieur en dernier (la pièce ne bouge pas
// dans la tôle) ; une amorce dans la chute avant chaque contour ; déplacements à vide en pointillés.
// ======================================================================================================
export function decoupe({ uid = 'dl' } = {}) {
  const part = coffret();
  const xs = part.outline.map((q) => q[0]), ys = part.outline.map((q) => q[1]);
  const s = 1.45, ox = 320 - ((Math.min(...xs) + Math.max(...xs)) / 2) * s, oy = 200 - ((Math.min(...ys) + Math.max(...ys)) / 2) * s;
  const T = (q) => [ox + q[0] * s, oy + q[1] * s];
  const outline0 = part.outline.map(T);
  // contour extérieur : départ au milieu de son plus long côté, amorce par l'extérieur (dans la chute)
  let best = 0, bl = 0;
  outline0.forEach((p, i) => { const q = outline0[(i + 1) % outline0.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > bl) { bl = l; best = i; } });
  const a = outline0[best], b = outline0[(best + 1) % outline0.length], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const outline = [mid, ...outline0.slice(best + 1), ...outline0.slice(0, best + 1)];
  let nrm = [b[1] - a[1], -(b[0] - a[0])]; const nl = Math.hypot(...nrm); nrm = [nrm[0] / nl, nrm[1] / nl];
  if (pointInPoly([mid[0] + nrm[0] * 3, mid[1] + nrm[1] * 3], outline0)) nrm = [-nrm[0], -nrm[1]];
  const oLead = [mid[0] + nrm[0] * 14, mid[1] + nrm[1] * 14];
  // contours intérieurs, au plus proche voisin depuis le coin haut gauche
  const H = part.holes.map((h) => { const pts = h.map(T); return { pts, c: centroid(pts) }; });
  const ordered = []; let cur = [ox - 40, oy - 40];
  while (H.length) { let k = 0, d = Infinity; H.forEach((h, i) => { const dd = Math.hypot(h.c[0] - cur[0], h.c[1] - cur[1]); if (dd < d) { d = dd; k = i; } }); const h = H.splice(k, 1)[0]; ordered.push(h); cur = h.c; }
  const leadIn = (h) => { const p0 = h.pts[0], d = Math.hypot(h.c[0] - p0[0], h.c[1] - p0[1]) || 1, k = Math.min(1, 9 / d); return [[p0[0] + (h.c[0] - p0[0]) * k, p0[1] + (h.c[1] - p0[1]) * k], p0]; };
  const contours = [...ordered.map((h) => ({ pts: [...h.pts, h.pts[0]], lead: leadIn(h), hole: true })), { pts: [...outline, outline[0]], lead: [oLead, outline[0]], hole: false }];
  // chronologie (ms) : vitesses de coupe et de déplacement à vide, temps de perçage
  const VC = 0.72, VR = 1.9, PIERCE = 130, T0 = 350;
  const steps = []; let t = T0, pos = [600, 30];
  for (const [i, c] of contours.entries()) {
    const dR = Math.hypot(c.lead[0][0] - pos[0], c.lead[0][1] - pos[1]);
    steps.push({ k: 'rapid', i, t0: t, t1: t + Math.max(120, dR / VR), from: pos, to: c.lead[0] }); t = steps[steps.length - 1].t1;
    steps.push({ k: 'pierce', i, t0: t, t1: t + PIERCE, at: c.lead[0] }); t += PIERCE;
    const ll = plen(c.lead); steps.push({ k: 'lead', i, t0: t, t1: t + ll / VC, pts: c.lead, L: ll }); t = steps[steps.length - 1].t1;
    const cl = plen(c.pts); steps.push({ k: 'cut', i, t0: t, t1: t + cl / VC, pts: c.pts, L: cl }); t = steps[steps.length - 1].t1;
    pos = c.pts[c.pts.length - 1];
  }
  const tCut = t, tLift = tCut + 200, tHold = tLift + 650, tFade = tHold + 1100, duration = tFade + 450;
  const mmTot = contours.reduce((sum, c) => sum + plen(c.pts), 0) / s;
  const sheet = [[28, 24], [612, 24], [612, 376], [28, 376]];
  const partPath = P(outline0) + ordered.map((h) => P(h.pts)).join('');

  function frame(tt) {
    const tm = ((tt % duration) + duration) % duration;
    const fade = 1 - seg(tm, tFade, duration), fadeIn = seg(tm, 0, T0);
    const op = Math.min(fade, fadeIn);
    let g = `<defs>${hatch(uid + '-h')}</defs><g opacity="${n1(op)}">`;
    // la tôle, et son bord
    g += `<path d="${P(sheet)}" fill="${C.steel}"/><path d="${P(sheet)}" fill="none" stroke="${C.soft}" stroke-width="1"/>`;
    let cutMm = 0, pierces = 0, idx = 0, head = null, cutting = false, flash = null, rapid = null;
    const lift = outC(seg(tm, tCut, tLift + 350));
    for (const [i, c] of contours.entries()) {
      const st = steps.find((x) => x.k === 'cut' && x.i === i), ld = steps.find((x) => x.k === 'lead' && x.i === i), pc = steps.find((x) => x.k === 'pierce' && x.i === i);
      const done = tm >= st.t1, started = tm >= st.t0;
      if (tm >= pc.t0) { pierces++; idx = i + 1; }
      if (done) {
        cutMm += st.L / s;
        if (c.hole) g += `<path d="${P(c.pts)}" fill="${C.bg}" fill-opacity="${seg(tm, st.t1, st.t1 + 220).toFixed(3)}"/>`;
        if (!c.hole && lift >= 1) continue;
        g += `<path d="${P(c.pts, false)}" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
      } else {
        g += `<path d="${P(c.pts, false)}" fill="none" stroke="${C.soft}" stroke-width="1" stroke-dasharray="5 4"/>`;
        if (tm >= ld.t0) { const [lp, le] = partial(ld.pts, ld.L * seg(tm, ld.t0, ld.t1)); g += `<path d="${P(lp, false)}" fill="none" stroke="${C.ink}" stroke-width="2"/>`; if (tm < ld.t1) { head = le; cutting = true; } }
        if (started) { const L = st.L * seg(tm, st.t0, st.t1); cutMm += L / s; const [cp, ce] = partial(c.pts, L); g += `<path d="${P(cp, false)}" fill="none" stroke="${C.ink}" stroke-width="2"/>`; head = ce; cutting = true; }
      }
      if (tm >= ld.t1 && tm < st.t0) head = c.pts[0];
      if (tm >= pc.t0 && tm < pc.t1 + 120) flash = { at: pc.at, k: seg(tm, pc.t0, pc.t1 + 120) };
    }
    for (const r of steps) if (r.k === 'rapid' && tm >= r.t0 && tm < r.t1) { const k = presse(seg(tm, r.t0, r.t1)); head = [lerp(r.from[0], r.to[0], k), lerp(r.from[1], r.to[1], k)]; rapid = r; }
    for (const r of steps) if (r.k === 'pierce' && tm >= r.t0 && tm < r.t1) head = r.at;
    if (!head) head = tm < T0 ? [600, 30] : contours[contours.length - 1].pts[0];
    if (rapid) g += `<path d="M${n1(rapid.from[0])},${n1(rapid.from[1])}L${n1(rapid.to[0])},${n1(rapid.to[1])}" stroke="${C.ink}" stroke-width="1.2" stroke-dasharray="1.5 5" stroke-linecap="round" opacity="0.7"/>`;
    // la pièce se détache : ombre portée, puis la pièce, légèrement soulevée
    if (lift > 0) {
      const dx = -3 * lift, dy = -6 * lift;
      g += `<path d="${P(outline0)}" fill="${C.bg}" opacity="${n1(0.9 * lift)}"/>`;
      g += `<path d="${partPath}" fill="${C.ink}" fill-rule="evenodd" opacity="${(0.16 * lift).toFixed(3)}" transform="translate(${n1(5 * lift)},${n1(7 * lift)})"/>`;
      g += `<path d="${partPath}" fill="${C.steelL}" fill-opacity="${lift.toFixed(3)}" fill-rule="evenodd" stroke="${C.ink}" stroke-width="2" stroke-opacity="${lift.toFixed(3)}" transform="translate(${n1(dx)},${n1(dy)})"/>`;
    }
    // tête de coupe : buse, réticule ; tir et gerbe pendant la coupe
    const [hx, hy] = head, fi = Math.floor(tm / 45);
    if (cutting && !rapid) {
      let sp = '';
      for (let k = 0; k < 9; k++) { const an = hash(fi, k) * Math.PI * 2, L = 7 + hash(k, fi) * 15; sp += `M${n1(hx + Math.cos(an) * 5)},${n1(hy + Math.sin(an) * 5)}l${n1(Math.cos(an) * L)},${n1(Math.sin(an) * L)}`; }
      g += `<path d="${sp}" stroke="${C.spark2}" stroke-width="1.4" stroke-linecap="round"/><circle cx="${n1(hx)}" cy="${n1(hy)}" r="${n1(7 + hash(fi, 9) * 2)}" fill="${C.spark}" opacity="0.55"/><circle cx="${n1(hx)}" cy="${n1(hy)}" r="3.2" fill="${C.hot}"/>`;
    }
    if (flash) g += `<circle cx="${n1(flash.at[0])}" cy="${n1(flash.at[1])}" r="${n1(4 + 14 * outC(flash.k))}" fill="none" stroke="${C.spark2}" stroke-width="2" opacity="${n1(1 - flash.k)}"/>`;
    const headOp = 1 - seg(tm, tCut, tCut + 300);
    g += `<g opacity="${n1(headOp)}"><circle cx="${n1(hx)}" cy="${n1(hy)}" r="13" fill="none" stroke="${C.ink}" stroke-width="2"/><path d="M${n1(hx - 21)},${n1(hy)}h8M${n1(hx + 13)},${n1(hy)}h8M${n1(hx)},${n1(hy - 21)}v8M${n1(hx)},${n1(hy + 13)}v8" stroke="${C.ink}" stroke-width="2"/></g>`;
    g += '</g>';
    const read = [['Contour', `${Math.max(1, Math.min(idx, contours.length))} sur ${contours.length}`], ['Découpé', `${fr(Math.min(cutMm, mmTot) / 1000, 2)}${NB}m`], ['Amorçages', String(pierces)]];
    return { svg: g, read };
  }
  return { id: 'decoupe', duration, frame, still: tCut + 900, film: [T0, tHold + 250], label: 'Découpe laser du coffret 5520-A : les ouvertures d\'abord, le contour en dernier.' };
}

// ======================================================================================================
// 2. Pliage, en coupe : poinçon et matrice en V (hachurés), tôle de 2 mm en coupe pleine, butée arrière.
// Pliage en l'air : le poinçon descend jusqu'à 88°, remonte, la tôle revient à 90° (retour élastique compensé).
// ======================================================================================================
export function pliage({ uid = 'pl' } = {}) {
  const PX = 5, t = 2 * PX, V = 16 * PX, cx = 320, top = 262, L = 230; // 1 mm = 5 px ; V de 16 mm ; ailes de 46 mm
  const dieW = 64, apexY = top + (V / 2) * Math.tan((52 * Math.PI) / 180);
  const die = `M${cx - V / 2 - dieW * 1.6},${top}H${cx - V / 2 - 6}Q${cx - V / 2},${top} ${cx - V / 2 + 4},${top + 5}L${cx - 6},${apexY - 7}h12L${cx + V / 2 - 4},${top + 5}Q${cx + V / 2},${top} ${cx + V / 2 + 6},${top}H${cx + V / 2 + dieW * 1.6}V392H${cx - V / 2 - dieW * 1.6}Z`;
  // poinçon droit : pointe à 88°, rayon de pointe, corps de 52 px, tenon pris dans le tablier
  const punch = (tipY) => { const r = 4, w1 = 30, h1 = w1 / Math.tan((44 * Math.PI) / 180); return `M${cx - r},${tipY - 2}Q${cx},${tipY + 2} ${cx + r},${tipY - 2}L${cx + w1},${tipY - h1}V${tipY - h1 - 120}H${cx + 18}V-10H${cx - 18}V${tipY - h1 - 120}H${cx - w1}V${tipY - h1}Z`; };
  const T = { in0: 0, in1: 500, app1: 1050, bend1: 2650, dwell: 2950, rel1: 3450, up1: 4150, hold: 4950, out1: 5550 };
  const duration = T.out1, Bmax = 46, Bfin = 45;
  function geo(beta) { // beta : relevé de chaque aile au-dessus de l'horizontale, en degrés
    const b = (beta * Math.PI) / 180, vx = cx, vy = top + (V / 2) * Math.tan(b); // pied du pli sur la face extérieure
    const c = Math.cos(b), s = Math.sin(b);
    const off = (t / 2) / Math.max(0.3, Math.cos(b)); // fibre neutre, au-dessus du pied
    const mY = vy - off;
    const left = [vx - c * L, mY - s * L], right = [vx + c * L, mY - s * L];
    return { vx, vy, mY, left, right, tipY: vy - t / Math.max(0.3, Math.cos(b)), b };
  }
  function frame(tt) {
    const tm = ((tt % duration) + duration) % duration;
    let beta = 0, tipY = 120, slide = 0, lift = 0, op = 1;
    const contactTip = top - t;
    if (tm < T.in1) { slide = -70 * (1 - outC(seg(tm, 0, T.in1))); op = seg(tm, 0, T.in1); }
    else if (tm < T.app1) tipY = lerp(120, contactTip, presse(seg(tm, T.in1, T.app1)));
    else if (tm < T.bend1) { beta = Bmax * presse(seg(tm, T.app1, T.bend1)); tipY = geo(beta).tipY; }
    else if (tm < T.dwell) { beta = Bmax; tipY = geo(beta).tipY; }
    else if (tm < T.rel1) { const k = presse(seg(tm, T.dwell, T.rel1)); beta = lerp(Bmax, Bfin, k); tipY = lerp(geo(Bmax).tipY, geo(Bfin).tipY - 26, k); }
    else if (tm < T.up1) { beta = Bfin; tipY = lerp(geo(Bfin).tipY - 26, 120, presse(seg(tm, T.rel1, T.up1))); }
    else if (tm < T.hold) { beta = Bfin; tipY = 120; }
    else { beta = Bfin; tipY = 120; const k = presse(seg(tm, T.hold, T.out1)); lift = -80 * k; op = 1 - k; }
    if (tm < T.in1) tipY = 120;
    const G = geo(beta);
    let g = `<defs>${hatch(uid + '-h')}</defs>`;
    // matrice et poinçon, en coupe
    g += `<path d="${die}" fill="url(#${uid}-h)" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>`;
    // butée arrière
    const bx = cx + L;
    g += `<path d="M${bx},${top - 44}h26v44h-26z" fill="${C.surface}" stroke="${C.ink}" stroke-width="2"/><path d="M${bx + 34},${top - 22}h40" stroke="${C.soft}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    // la tôle, en coupe pleine
    const sheet = beta === 0 && tm < T.app1
      ? `M${cx - L + slide},${top - t / 2}H${cx + L + slide}`
      : `M${n1(G.left[0])},${n1(G.left[1])}L${n1(G.vx)},${n1(G.mY)}L${n1(G.right[0])},${n1(G.right[1])}`;
    g += `<g opacity="${n1(op)}" transform="translate(0,${n1(lift)})"><path d="${sheet}" fill="none" stroke="${C.ink}" stroke-width="${t}" stroke-linejoin="round" stroke-linecap="butt"/>`;
    // arc de l'angle, à l'intérieur du pli
    if (beta > 0.5) {
      const r = 58, a1 = [G.vx - Math.cos(G.b) * r, G.mY - t / 2 - Math.sin(G.b) * r], a2 = [G.vx + Math.cos(G.b) * r, G.mY - t / 2 - Math.sin(G.b) * r];
      const ok = tm >= T.rel1;
      g += `<path d="M${n1(a1[0])},${n1(a1[1])}A${r},${r} 0 0 1 ${n1(a2[0])},${n1(a2[1])}" fill="none" stroke="${ok ? C.ink : C.soft}" stroke-width="${ok ? 2 : 1.5}"/>`;
      g += `<path d="M${n1(a1[0] - Math.cos(G.b) * 10)},${n1(a1[1] - Math.sin(G.b) * 10)}L${n1(a1[0] + Math.cos(G.b) * 6)},${n1(a1[1] + Math.sin(G.b) * 6)}M${n1(a2[0] + Math.cos(G.b) * 10)},${n1(a2[1] - Math.sin(G.b) * 10)}L${n1(a2[0] - Math.cos(G.b) * 6)},${n1(a2[1] + Math.sin(G.b) * 6)}" stroke="${C.soft}" stroke-width="1.5"/>`;
    }
    g += '</g>';
    g += `<path d="${punch(tipY)}" fill="url(#${uid}-h)" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/>`;
    // axe de symétrie (trait mixte)
    g += `<path d="M${cx},8V${apexY + 30}" stroke="${C.soft}" stroke-width="1" stroke-dasharray="18 4 3 4"/>`;
    const ang = 180 - 2 * beta, released = tm >= T.rel1;
    const read = [['Angle', tm < T.app1 ? '180,0°' : `${fr(ang)}°`], ['Visé', `90°${NB}±${NB}0,5°`], ['Retour élastique', released ? `+${fr(2 * (Bmax - Bfin))}°, compensé` : 'en attente']];
    return { svg: g, read };
  }
  return { id: 'pliage', duration, frame, still: T.hold - 200, film: [T.in1 - 250, T.hold], label: 'Pliage en l\'air dans une matrice en V : le poinçon descend à 88°, la tôle revient à 90° après la remontée.' };
}

// ======================================================================================================
// 3. Soudure TIG, vue de dessus : deux tôles d'inox bout à bout, la torche avance, la baguette d'apport trempe dans le bain
// à chaque écaille du cordon ; derrière la torche, les couleurs de revenu de l'inox (paille, bronze, bleu).
// ======================================================================================================
export function soudure({ uid = 'sd' } = {}) {
  const y = 200, x0 = 92, x1 = 560, DIP = 125, PITCH = 13;
  const T = { strike: 450, end: 450 + ((x1 - x0) / PITCH) * DIP, };
  T.off = T.end + 350; T.hold = T.off + 1300; T.fade = T.hold + 500;
  const duration = T.fade;
  const nR = Math.floor((x1 - x0) / PITCH);
  const BW = 14; // demi-largeur du cordon
  const ripples = Array.from({ length: nR }, (_, i) => ({ x: x0 + i * PITCH + 7, w: BW - 1.5 + hash(i, 2) * 1.8, j: (hash(i, 5) - 0.5) * 1.4 }));
  function frame(tt) {
    const tm = ((tt % duration) + duration) % duration;
    const op = 1 - seg(tm, T.hold, T.fade);
    const prog = seg(tm, T.strike, T.end), tx = lerp(x0, x1, prog);
    const arc = tm >= T.strike - 120 && tm < T.off, poolK = 1 - seg(tm, T.end, T.off);
    let g = `<defs>${hatch(uid + '-h')}</defs><g opacity="${n1(op)}">`;
    // deux tôles, bout à bout ; le joint
    g += `<rect x="28" y="64" width="584" height="${y - 3 - 64}" fill="${C.inox}" stroke="${C.ink}" stroke-width="2"/><rect x="28" y="${y + 3}" width="584" height="${336 - y - 3}" fill="${C.inox}" stroke="${C.ink}" stroke-width="2"/>`;
    g += `<path d="M28,${y}H612" stroke="${C.ink}" stroke-width="1.5"/>`;
    // couleurs de revenu, de part et d'autre du cordon déjà fait
    const done = Math.max(x0, tx - 6);
    if (done > x0 + 2) {
      for (const [off, col, o] of [[40, C.blue, 0.5], [30, C.bronze, 0.6], [21, C.straw, 0.7]]) {
        g += `<path d="M${x0},${y - off}H${n1(done)}Q${n1(done + off * 0.9)},${y} ${n1(done)},${y + off}H${x0}Q${x0 - off * 0.6},${y} ${x0},${y - off}Z" fill="${col}" opacity="${o}"/>`;
      }
    }
    // le cordon : écailles déposées une à une
    if (done > x0) g += `<path d="M${x0},${y - BW}H${n1(done)}V${y + BW}H${x0}Z" fill="${C.steelL}"/>`;
    let rp = '';
    for (const [i, r] of ripples.entries()) {
      const tr = T.strike + i * DIP; if (tm < tr) break;
      const w = r.w;
      rp += `M${n1(r.x - 9)},${n1(y - w + r.j)}Q${n1(r.x + 7)},${n1(y + r.j)} ${n1(r.x - 9)},${n1(y + w + r.j)}`;
    }
    g += `<path d="${rp}" fill="none" stroke="${C.soft}" stroke-width="1.5"/>`;
    if (done > x0) g += `<path d="M${x0},${y - BW}H${n1(done)}M${x0},${y + BW}H${n1(done)}" stroke="${C.ink}" stroke-width="1.5"/>`;
    // bain de fusion, lueur de l'arc
    if (arc || poolK > 0) {
      const fl = 0.85 + hash(Math.floor(tm / 50), 3) * 0.3, k = arc ? 1 : poolK;
      g += `<circle cx="${n1(tx + 4)}" cy="${y}" r="${n1(62 * fl * k)}" fill="${C.straw}" opacity="${n1(0.2 * k)}"/><circle cx="${n1(tx + 4)}" cy="${y}" r="${n1(36 * fl * k)}" fill="${C.straw}" opacity="${n1(0.25 * k)}"/><ellipse cx="${n1(tx + 8)}" cy="${y}" rx="${n1(14 * k)}" ry="${n1(15 * k)}" fill="${C.hot}" stroke="${C.spark}" stroke-width="2"/>`;
    }
    // baguette d'apport : elle trempe dans l'avant du bain à chaque écaille
    if (tm >= T.strike && tm < T.end) {
      const ph = ((tm - T.strike) % DIP) / DIP, dip = ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI) : 0;
      // la baguette arrive de l'avant, par en dessous ; elle avance dans le bain puis se retire
      const ux = 0.62, uy = 0.78, back = 12 - 14 * dip, tipX = tx + 20 + ux * back, tipY = y + 8 + uy * back;
      g += `<path d="M${n1(tipX)},${n1(tipY)}L${n1(tipX + ux * 190)},${n1(tipY + uy * 190)}" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/><path d="M${n1(tipX)},${n1(tipY)}L${n1(tipX + ux * 190)},${n1(tipY + uy * 190)}" stroke="${C.steelD}" stroke-width="5" stroke-linecap="round"/>`;
    }
    // torche (vue de dessus) : buse céramique, électrode
    const thx = tm < T.strike ? x0 - 20 + 20 * outC(seg(tm, 0, T.strike)) : tm < T.off ? tx : lerp(x1, x1 + 40, presse(seg(tm, T.off, T.hold)));
    // torche vue de dessus, inclinée vers l'avant : le corps part en arrière, au-dessus du cordon déjà fait
    g += `<g transform="translate(${n1(thx)},${y})"><path d="M-9,-14L-96,-118L-80,-131L6,-26Z" fill="url(#${uid}-h)" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/><circle r="24" fill="${C.surface}" stroke="${C.ink}" stroke-width="2"/><circle r="13" fill="none" stroke="${C.ink}" stroke-width="1.5"/><circle r="3.5" fill="${arc ? C.hot : C.ink}" stroke="${C.ink}" stroke-width="1"/></g>`;
    g += '</g>';
    const mm = Math.max(0, done - x0) / 3.6;
    const read = [['Procédé', 'TIG, inox 304L'], ['Cordon', `${fr(mm, 0)}${NB}mm`], ['Arc', arc ? 'amorcé' : tm >= T.off ? 'coupé' : 'en attente']];
    return { svg: g, read };
  }
  return { id: 'soudure', duration, frame, still: T.off + 400, film: [T.strike - 300, T.off + 800], label: 'Soudure TIG bout à bout : la baguette trempe dans le bain à chaque écaille du cordon.' };
}

// ======================================================================================================
// 4. Peinture poudre, en coupe : un profilé en U suspendu au convoyeur. Le pistolet électrostatique projette la poudre,
// qui contourne les bords et couvre aussi la face cachée (effet d'enveloppement). Puis la cuisson : la poudre fond et prend
// sa teinte. La couche grandit jusqu'à 80 µm.
// ======================================================================================================
export function peinture({ uid = 'pt', ral = { code: '6034', value: '#7FB0AE' } } = {}) {
  const T = { spray0: 400, spray1: 3900, cure0: 4100, cure1: 5600, hold: 6600, fade: 7150 };
  const duration = T.fade;
  // profilé en U renversé : âme en haut, deux ailes ; épaisseur 10 px
  const th = 12, X0 = 200, X1 = 392, Y0 = 104, Y1 = 330;
  const sect = `M${X0},${Y0}H${X1}V${Y1}H${X1 - th}V${Y0 + th}H${X0 + th}V${Y1}H${X0}Z`;
  // faces à couvrir : [x, y, w, h, côté de croissance, part de couche (enveloppement)]
  const faces = [
    { d: (k) => `M${X1},${Y0 - 0}h${k}V${Y1 + k}h${-k}Z`, w: 1 },                 // face extérieure droite (face au pistolet)
    { d: (k) => `M${X0 - 0},${Y0}V${Y0 - k}H${X1 + k}V${Y0}Z`, w: 0.92 },         // dessus de l'âme
    { d: (k) => `M${X1 - th},${Y1}v${k}h${th + k}V${Y1}Z`, w: 0.9 },              // chant bas droit
    { d: (k) => `M${X0},${Y1}v${k}h${th}V${Y1}Z`, w: 0.75 },                      // chant bas gauche
    { d: (k) => `M${X0},${Y0 - k}h${-k}V${Y1 + k}h${k}Z`, w: 0.72 },              // face cachée (gauche) : enveloppement
    { d: (k) => `M${X1 - th},${Y0 + th}h${-k}V${Y1}h${k}Z`, w: 0.6 },             // intérieur droit
    { d: (k) => `M${X0 + th},${Y0 + th}h${k}V${Y1}h${-k}Z`, w: 0.45 },            // intérieur gauche (cage de Faraday)
    { d: (k) => `M${X0 + th},${Y0 + th}V${Y0 + th + k}H${X1 - th}V${Y0 + th}Z`, w: 0.4 },
  ];
  // particules : départ à la buse, arrivée sur une face ; les trajectoires contournent les bords (lignes de champ)
  const R = rng(17), N = 340, gun = [548, 214];
  const targets = [
    () => [X1 + 3, lerp(Y0, Y1, R())], () => [lerp(X0, X1, R()), Y0 - 3], () => [X0 - 3, lerp(Y0, Y1, R())], () => [lerp(X1 - th, X1, R()), Y1 + 3],
  ];
  const parts = Array.from({ length: N }, (_, i) => {
    const r = R(), tg = r < 0.5 ? 0 : r < 0.7 ? 1 : r < 0.9 ? 2 : 3, to = targets[tg]();
    const from = [gun[0] - 6, gun[1] + (R() - 0.5) * 10];
    let c;
    if (tg === 0) c = [lerp(from[0], to[0], 0.5), lerp(from[1], to[1], 0.5) + (R() - 0.5) * 40];
    else if (tg === 1) c = [X1 + 40 + R() * 40, Y0 - 50 - R() * 40];
    else if (tg === 2) { const up = R() < 0.5; c = [lerp(X0, X1, R()), up ? Y0 - 70 - R() * 40 : Y1 + 70 + R() * 40]; }
    else c = [X1 + 30, Y1 + 40 + R() * 30];
    const t0 = T.spray0 + R() * (T.spray1 - T.spray0 - 700), fl = 520 + R() * 380;
    return { from, to, c, t0, t1: t0 + fl, r: 2 + R() * 1.8 };
  });
  const pale = mixHex(ral.value, '#FFFFFF', 0.5);
  function frame(tt) {
    const tm = ((tt % duration) + duration) % duration;
    const op = 1 - seg(tm, T.hold, T.fade) * 0.999;
    const cover = presse(seg(tm, T.spray0 + 300, T.spray1 + 200)), cure = presse(seg(tm, T.cure0, T.cure1));
    const coat = cure > 0 ? mixHex(pale, ral.value, cure) : pale;
    let g = `<defs>${hatch(uid + '-h')}</defs>`;
    // convoyeur et crochet
    g += `<path d="M0,40H640" stroke="${C.ink}" stroke-width="3"/><path d="M${(X0 + X1) / 2},40V${Y0 - 22}q0,10 -10,10" fill="none" stroke="${C.ink}" stroke-width="2"/><rect x="${(X0 + X1) / 2 - 10}" y="33" width="20" height="14" fill="${C.surface}" stroke="${C.ink}" stroke-width="2"/>`;
    // cuisson : le fond chauffe, des ondes de chaleur montent autour de la pièce
    const ov = seg(tm, T.cure0 - 200, T.cure0 + 300) * (1 - seg(tm, T.cure1, T.cure1 + 500));
    if (ov > 0) {
      g += `<rect width="640" height="400" fill="${C.spark2}" opacity="${(0.13 * ov).toFixed(3)}"/>`;
      // chaque onde monte, naît et s'éteint en fondu (pas de saut quand elle repart d'en bas)
      for (let i = 0; i < 7; i++) {
        const x = X0 - 60 + i * ((X1 - X0 + 120) / 6), ph = (tm / 900 + i * 0.37) % 1, yb = Y1 + 30 - ph * 260;
        g += `<path d="M${n1(x)},${n1(yb)}c8,-14 -8,-28 0,-42s-8,-28 0,-42" fill="none" stroke="${C.spark2}" stroke-width="2.2" stroke-linecap="round" opacity="${(0.75 * ov * Math.sin(ph * Math.PI)).toFixed(3)}"/>`;
      }
    }
    // couche : elle s'épaissit avec la projection, plus mince là où la poudre arrive en contournant
    g += `<g opacity="${n1(op)}">`;
    for (const f of faces) { const k = 11 * f.w * cover; if (k > 0.05) g += `<path d="${f.d(k)}" fill="${coat}" stroke="${C.soft}" stroke-width="${k > 2 ? 1 : 0}"/>`; }
    g += `<path d="${sect}" fill="${C.ink}"/>`;
    g += '</g>';
    // pistolet : corps, électrode, déflecteur conique
    g += `<g transform="translate(${gun[0]},${gun[1]})"><path d="M8,-11H96V11H8Z" fill="url(#${uid}-h)" stroke="${C.ink}" stroke-width="2"/><path d="M8,-7L-6,-13V13L8,7" fill="${C.surface}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round"/><path d="M-6,0H-16" stroke="${C.ink}" stroke-width="2"/></g>`;
    // nuage et particules
    const spraying = tm >= T.spray0 && tm < T.spray1;
    if (spraying) { const k = Math.min(1, seg(tm, T.spray0, T.spray0 + 300), 1 - seg(tm, T.spray1 - 300, T.spray1)); g += `<ellipse cx="${gun[0] - 60}" cy="${gun[1]}" rx="58" ry="34" fill="${pale}" opacity="${(0.35 * k).toFixed(3)}"/>`; }
    let dots = '';
    for (const p of parts) {
      if (tm < p.t0 || tm > p.t1) continue;
      const u = outC(seg(tm, p.t0, p.t1)), a = 1 - u;
      const x = a * a * p.from[0] + 2 * a * u * p.c[0] + u * u * p.to[0], y = a * a * p.from[1] + 2 * a * u * p.c[1] + u * u * p.to[1];
      dots += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${p.r.toFixed(1)}"/>`;
    }
    if (dots) g += `<g fill="${pale}" stroke="${C.soft}" stroke-width="0.6">${dots}</g>`;
    const um = 80 * cover, temp = tm < T.cure0 ? 20 : Math.round(lerp(20, 180, presse(seg(tm, T.cure0, T.cure0 + 700))));
    const read = [['Couche', `${fr(um, 0)}${NB}µm`], ['Four', tm < T.cure0 - 200 ? 'en attente' : `${temp}${NB}°C${tm >= T.cure1 ? ', cuit' : ''}`], ['Teinte', `RAL ${ral.code}`]];
    return { svg: g, read };
  }
  return { id: 'peinture', duration, frame, still: T.hold - 100, film: [T.spray0 - 300, T.hold - 50], label: `Peinture poudre électrostatique : la poudre contourne les bords et couvre la face cachée, puis cuit à 180${NB}°C.` };
}

// ======================================================================================================
// Lecture : joue un schéma dans un <svg>, en boucle, seulement quand il est visible ; pause, mouvements réduits.
// ======================================================================================================
export function mountSchema(svgEl, def, { readEl = null, reduced = null, autoplay = true } = {}) {
  svgEl.setAttribute('viewBox', `0 0 ${VB[0]} ${VB[1]}`);
  const rm = reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  // avant la première lecture (ou en mouvements réduits), le schéma montre son image clé, pas une image vide
  let t = def.still, fresh = true, raf = 0, last = 0, playing = false, visible = false, wanted = autoplay && !rm, lastRead = '';
  const cells = [];
  if (readEl) {
    readEl.innerHTML = def.frame(def.still).read.map(([k]) => `<div><dt>${k}</dt><dd></dd></div>`).join('');
    readEl.querySelectorAll('dd').forEach((d) => cells.push(d));
  }
  function draw() {
    const f = def.frame(t);
    svgEl.innerHTML = f.svg;
    const key = f.read.map((r) => r[1]).join('|');
    if (key !== lastRead) { lastRead = key; f.read.forEach((r, i) => { if (cells[i]) cells[i].textContent = r[1]; }); }
  }
  function loop(now) { if (!playing) return; if (last) t = (t + (now - last)) % def.duration; last = now; draw(); raf = requestAnimationFrame(loop); }
  function sync() { const should = wanted && visible; if (should && !playing) { if (fresh && !rm) { t = 0; } fresh = false; playing = true; last = 0; raf = requestAnimationFrame(loop); } else if (!should && playing) { playing = false; cancelAnimationFrame(raf); } }
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; sync(); }, { rootMargin: '80px' });
  io.observe(svgEl);
  draw();
  return {
    get playing() { return wanted; },
    play() { wanted = true; sync(); }, pause() { wanted = false; sync(); },
    toggle() { wanted = !wanted; sync(); return wanted; },
    seek(ms) { t = ms; draw(); },
    destroy() { io.disconnect(); playing = false; cancelAnimationFrame(raf); },
  };
}
