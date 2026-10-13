// Ourlet · le développé qui se plie (premier écran et outil ; itération 6 : trame attachée à la matière).
// La pièce commence comme un plan : vue de dessus, le développé coté (contour, trous, lignes de pli en trait mixte, deux cotes
// hors tout). La caméra bascule de la vue de dessus vers les trois quarts, les cotes s'effacent, puis la tôle se plie dans
// l'ordre de la gamme, au rythme de la presse ; enfin la teinte du client passe en rideau.
// Le dessin reste sur le papier, sous la pièce : chaque paroi qui se lève découvre son propre tracé (on voit d'où elle vient).
// Option laser (D2) : avant la bascule, la tête du laser suit le dessin, les trous d'abord, le contour en dernier, à la vitesse
// de coupe ; le trait coupé passe du trait fin au trait fort.
//
// Itération 6 (le défaut de la v5 : la trame calculée à l'écran restait immobile pendant que la pièce passait dessous, elle
// crénelait et papillotait) :
// - rendu par trace-gl-v6 : la trame suit le grain du développé (hachures le long de son axe x, au pas fixe en mm), filtrée
//   analytiquement, avec le flou de bougé de l'obturation pendant la lecture ; faces rangées par la profondeur ; arêtes vues
//   en GL ; perspective conservée (focale longue) ;
// - le dessin au sol est tracé dans la scène, sous la tôle : la pièce le cache, chaque paroi levée le découvre ; les traits de
//   pli restent tracés sur la tôle jusqu'à ce que la presse prenne leur pli (repère d'atelier : le trait de pliage sur le flan) ;
// - caméra posée : le cadrage bouge seulement pendant la bascule (même courbe que la caméra), puis il tient toute la gamme ;
// - cote d'angle qui apparaît et s'efface (MOTION.micro) au lieu de surgir ;
// - changer de teinte pendant ou après le rideau pose une nouvelle couche qui passe en rideau sur la précédente ;
// - rejouer, arrêter, remplacer la pièce : un fondu enchaîné court (MOTION.presse.approche) depuis l'image en cours, jamais une
//   coupe sèche.
// Repli sans WebGL2 : la trame d'écran de la v5 (gravure.js), le dessin vectoriel par-dessus.
// Déterministe : seek(t). Mouvements réduits : la pièce pliée et peinte, le dessin dessous, rien ne bouge.
import { fold, mesh, render, camera, apply } from './part.js';
import { gamme } from './stage.js';
import { createGravure, tonPack } from './gravure.js';
import { createTrace } from './trace-gl-v6.js';
import { MOTION, EASE, ticker, prefersReduced } from './motion.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => (b > a ? clamp((t - a) / (b - a)) : t >= b ? 1 : 0);
const lerp = (a, b, k) => a + (b - a) * k;
const lisse = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const NS = 'http://www.w3.org/2000/svg';
const fmtMM = (v) => Math.round(v).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const newell = (P) => { let x = 0, y = 0, z = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); } return norm([x, y, z]); };
const H_VIT = 8; // ms : pas de dérivation des vitesses à l'écran (flou de bougé de la trame)
let NUM = 0;

export function mountDeveloppe(host, part, {
  order = part.gamme || part.bends.map((_, k) => k), az = (part.vue && part.vue.az) || [-90, -128], el = (part.vue && part.vue.el) || [88, 31],
  dist = (part.vue && part.vue.dist) || 2.6, fov = (part.vue && part.vue.fov) || 24,
  teinte = null, couleurs, pas = 3, ep = [0.06, 0.94], laser = false, cotes = true, pad = 0.1, aplat = 0.85, gammaTon = 1,
  onFrame = null, autoplay = true, reduced = null, amb = 0.22, light = [-0.85, -0.3, 0.5], encre = true,
  ombre = 0, arete = 1.25, couleurArete = null, fantome = (part.vue && part.vue.fantome !== undefined) ? part.vue.fantome : 0.22, oriente = false, coteAngle = true,
} = {}) {
  const rm = reduced ?? prefersReduced();
  const PR = MOTION.presse, id = ++NUM;
  host.classList.add('dvp');
  // les fondus enchaînés en cours (une image qui s'efface) restent au-dessus de la scène qui arrive
  const poser = (el2) => host.insertBefore(el2, host.querySelector(':scope > .dvp-fondu'));
  let canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true');
  poser(canvas);
  const tr = createTrace(canvas, { couleurs, teinte, aplat, ep });
  let grav = null, ink = null;
  if (!tr) {
    // repli : un canvas neuf (celui-ci a peut-être déjà un contexte WebGL2 refusé), la trame d'écran et l'encre en 2D
    const c2 = document.createElement('canvas'); c2.setAttribute('aria-hidden', 'true'); canvas.replaceWith(c2); canvas = c2;
    ink = document.createElement('canvas'); ink.setAttribute('aria-hidden', 'true'); ink.className = 'dvp-aretes'; poser(ink);
    // mode groupé : ton, peinture et angle des hachures dans un seul canvas (un remplissage et un envoi par image)
    grav = createGravure(canvas, { pas, ep, epFond: 0, teinte, aplat, oriente, packed: true, ...couleurs });
  }
  poser(svg);
  const ENCRE_2D = couleurArete || couleurs.trait1;

  // ---------- géométrie ----------
  const xs = part.outline.map((p) => p[0]), ys = part.outline.map((p) => p[1]);
  const X0 = Math.min(...xs), X1 = Math.max(...xs), Y0 = Math.min(...ys), Y1 = Math.max(...ys);
  const ctr = [(X0 + X1) / 2, (Y0 + Y1) / 2];
  // centre et taille de la pièce pliée (la caméra la regarde) ; la distance suit la diagonale du développé
  const pts1 = mesh(part, fold(part, 1)).flatMap((p) => p.pts);
  const zMax = Math.max(...pts1.map((p) => p[2]));
  const D = Math.hypot(X1 - X0, Y1 - Y0) * dist;
  const camAt = (k) => {
    const a = (lerp(az[0], az[1], k) * Math.PI) / 180, e = (lerp(el[0], el[1], k) * Math.PI) / 180;
    const tgt = [ctr[0], ctr[1], zMax * 0.35 * k];
    return camera({ eye: [tgt[0] + D * Math.cos(e) * Math.cos(a), tgt[1] + D * Math.cos(e) * Math.sin(a), tgt[2] + D * Math.sin(e)], target: tgt, fov });
  };
  // profondeur utile (mm) : une sphère autour du développé et de la pièce pliée
  const R = Math.hypot(X1 - X0, Y1 - Y0) / 2 + zMax + 50;
  const NF = [Math.max(1, D - R * 1.6), D + R * 1.6];

  // ---------- chronologie (durées tirées de la grammaire : laser, presse, rideau, convoyeur) ----------
  const g = gamme(part, order, { stroke: PR.appui.ms, pause: PR.maintien.ms, hemPre: 30, ease: EASE.appui });
  const loops = [...(part.holes || []).map((h) => h), part.outline]; // les trous d'abord, le contour en dernier
  const perim = (pl) => pl.reduce((s, p, i) => s + Math.hypot(pl[(i + 1) % pl.length][0] - p[0], pl[(i + 1) % pl.length][1] - p[1]), 0);
  const T = {};
  let teinteC = teinte; // la teinte que le rideau de la chronologie apporte
  function timeline(sPlan) {
    // le laser avance à la vitesse de coupe à l'écran (px/s) ; les déplacements à vide entre deux contours, plus vifs
    let t = PR.maintien.ms;
    T.cut = [];
    if (laser) {
      let prev = null;
      for (const pl of loops) {
        const L = perim(pl) * sPlan;
        if (prev) { const d = Math.hypot(pl[0][0] - prev[0], pl[0][1] - prev[1]) * sPlan; t += Math.max(MOTION.laser.percage.ms, (d / MOTION.laser.vide.v) * 1000); }
        t += MOTION.laser.percage.ms;
        T.cut.push([t, t + (L / MOTION.laser.coupe.v) * 1000]); t = T.cut[T.cut.length - 1][1]; prev = pl[0];
      }
      t += PR.maintien.ms;
    }
    T.tilt = [t, t + MOTION.camera.ms]; t = T.tilt[1];
    T.fold = [t, t + g.duration]; t = T.fold[1] + PR.maintien.ms * 2;
    T.paint = [t, t + (teinteC ? MOTION.rideau.ms : 0)];
    T.end = T.paint[1];
  }
  timeline(0.4);

  // ---------- cadrage ----------
  // caméra posée : le cadre glisse du plan (vue de dessus, cotes comprises) vers la pièce pendant la bascule seulement, sur la
  // courbe de la caméra ; ensuite il tient toute la gamme (l'enveloppe de toutes les poses du pliage, dessin au sol compris)
  const stateAt = (ms) => ({ k: EASE.camera(seg(ms, T.tilt[0], T.tilt[1])), f: g.state(Math.max(0, ms - T.fold[0])) });
  function boxOf(ms) {
    const { k, f } = stateAt(ms), cam = camAt(k);
    const r = render(mesh(part, fold(part, (i) => f[i])), cam, { size: 1, paths: false });
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of r) for (const q of p.pr) b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])];
    // le dessin au sol compte aussi (il reste sous la pièce)
    const flat = render([{ kind: 'face', pts: part.outline.map((p) => [p[0], p[1], 0]) }], cam, { size: 1, paths: false })[0];
    for (const q of flat.pr) b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])];
    return b;
  }
  let B0 = null, B1 = null, gonfle = [];
  function cadrage() {
    B0 = boxOf(0); B1 = [Infinity, Infinity, -Infinity, -Infinity];
    for (let ms = T.tilt[1]; ms <= T.end + 60; ms += 60) { const b = boxOf(Math.min(ms, T.end)); B1 = [Math.min(B1[0], b[0]), Math.min(B1[1], b[1]), Math.max(B1[2], b[2]), Math.max(B1[3], b[3])]; }
    // pendant la bascule, la pièce doit rester dans le cadre interpolé : sinon le cadre s'élargit d'une bosse douce
    let mx = 1;
    for (let ms = T.tilt[0]; ms <= T.tilt[1]; ms += 40) {
      const e = EASE.camera(seg(ms, T.tilt[0], T.tilt[1])), F = B0.map((v, j) => v + (B1[j] - v) * e), a = boxOf(ms);
      const cx = (F[0] + F[2]) / 2, cy = (F[1] + F[3]) / 2, hw = (F[2] - F[0]) / 2, hh = (F[3] - F[1]) / 2;
      mx = Math.max(mx, (cx - a[0]) / hw, (a[2] - cx) / hw, (cy - a[1]) / hh, (a[3] - cy) / hh);
    }
    gonfle = mx;
  }
  cadrage();
  const boxAt = (ms) => {
    const u = seg(ms, T.tilt[0], T.tilt[1]), e = EASE.camera(u), F = B0.map((v, j) => v + (B1[j] - v) * e);
    if (gonfle <= 1.0001) return F;
    const kk = 1 + (gonfle - 1) * Math.sin(Math.PI * u) ** 2, cx = (F[0] + F[2]) / 2, cy = (F[1] + F[3]) / 2;
    return [cx + (F[0] - cx) * kk, cy + (F[1] - cy) * kk, cx + (F[2] - cx) * kk, cy + (F[3] - cy) * kk];
  };
  const vueA = (ms, W, H) => {
    const { k, f } = stateAt(ms), cam = camAt(k), b = boxAt(ms);
    const mc = cotes ? 46 * (1 - k) : 0; // la place des cotes, rendue quand elles s'effacent
    const s = Math.min((W * (1 - 2 * pad) - mc) / (b[2] - b[0]), (H * (1 - 2 * pad) - mc) / (b[3] - b[1]));
    return { k, f, cam, s, cx: (W - mc) / 2 - ((b[0] + b[2]) / 2) * s, cy: (H - mc) / 2 - ((b[1] + b[3]) / 2) * s };
  };
  // pas de la trame dans la matière : `pas` px pour une face de face au cadrage final ; fixé par taille (il ne glisse jamais)
  let lay = null;
  const pasMM = (W, H) => {
    if (lay && lay.W === W && lay.H === H) return lay.p;
    const s1 = Math.min((W * (1 - 2 * pad)) / (B1[2] - B1[0]), (H * (1 - 2 * pad)) / (B1[3] - B1[1]));
    lay = { W, H, p: pas / ((s1 * camAt(1).k) / D) };
    return lay.p;
  };

  // ---------- le dessin vectoriel (SVG, par-dessus) ----------
  // tracés : contours (trait fort), cotes (trait fin, pointes, chiffres à 15 px) ; en repli, aussi les lignes de pli
  svg.innerHTML = '';
  const gDraw = document.createElementNS(NS, 'g'); svg.append(gDraw);
  const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); gDraw.append(e); return e; };
  // liseré couleur papier sous les traits fins : sur la trame, un trait mixte se confond sinon avec une ligne de la hachure
  const haloEls = tr ? [] : part.bends.map(() => mk('path', { class: 'dvp-liseré', fill: 'none' }));
  const cutEls = loops.map(() => mk('path', { class: 'dvp-coupe', fill: 'none' }));
  const doneEls = loops.map(() => mk('path', { class: 'dvp-coupe-faite', fill: 'none' }));
  const bendEls = tr ? [] : part.bends.map(() => mk('path', { class: 'dvp-pli', fill: 'none' }));
  // la tête du laser : un anneau et sa croix de visée, comme sur l'écran de la machine
  const head = mk('path', { class: 'dvp-tete', fill: 'none' });
  // cote d'angle du pli en cours : un arc entre la base et la paroi qui se lève, et la valeur lue par l'opérateur
  // (dans son propre groupe : elle ne s'efface pas avec le dessin au sol)
  const gTop = document.createElementNS(NS, 'g'); svg.append(gTop);
  const mkTop = (tag, attrs) => { const e = mk(tag, attrs); gTop.append(e); return e; };
  const angEl = coteAngle ? { arc: mkTop('path', { class: 'dvp-cote', fill: 'none' }), plaque: mkTop('rect', { class: 'dvp-plaque', rx: 4 }), txt: mkTop('text', { class: 'dvp-chiffre', 'text-anchor': 'middle' }) } : null;
  const coteEls = cotes ? [0, 1].map(() => ({ line: mk('path', { class: 'dvp-cote', fill: 'none' }), arrows: mk('path', { class: 'dvp-pointe' }), txt: mk('text', { class: 'dvp-chiffre', 'text-anchor': 'middle' }) })) : [];
  if (cotes) { coteEls[0].txt.textContent = fmtMM(X1 - X0); coteEls[1].txt.textContent = fmtMM(Y1 - Y0); }

  // ---------- projection ----------
  let view = null; // { s, cx, cy } projection → px CSS
  const projV = (v, cam, p) => { const q = [p[0] - cam.eye[0], p[1] - cam.eye[1], p[2] - cam.eye[2]]; const x = q[0] * cam.r[0] + q[1] * cam.r[1] + q[2] * cam.r[2], y = q[0] * cam.u[0] + q[1] * cam.u[1] + q[2] * cam.u[2], z = q[0] * cam.f[0] + q[1] * cam.f[1] + q[2] * cam.f[2]; return [v.cx + (x * cam.k / z) * v.s, v.cy - (y * cam.k / z) * v.s]; };
  const proj = (cam, p) => projV(view, cam, p);
  const pathOf = (cam, pl, close = true, upto = Infinity) => {
    let d = '', acc = 0;
    for (let i = 0; i < pl.length + (close ? 1 : 0); i++) {
      const p = pl[i % pl.length];
      if (i > 0) { const q = pl[(i - 1) % pl.length], L = Math.hypot(p[0] - q[0], p[1] - q[1]); if (acc + L > upto) { const k = (upto - acc) / L; const m = [q[0] + (p[0] - q[0]) * k, q[1] + (p[1] - q[1]) * k]; const s = proj(cam, [m[0], m[1], 0]); d += `L${s[0].toFixed(1)},${s[1].toFixed(1)}`; return { d, end: m }; } acc += L; }
      const s = proj(cam, [p[0], p[1], 0]); d += `${i ? 'L' : 'M'}${s[0].toFixed(1)},${s[1].toFixed(1)}`;
    }
    return { d: d + (close ? 'Z' : ''), end: null };
  };
  // pour chaque face : le sens de son pli (le côté intérieur) et sa part de pliage, pour l'occlusion
  const faceFold = {};
  for (const ln of part.links) {
    const other = ln.faces[0] === part.baseId ? ln.faces[1] : ln.faces[1] === part.baseId ? ln.faces[0] : null;
    const sign = Math.sign(ln.bend.angle) || 1, kk = ln.k;
    if (other !== null && other !== undefined) faceFold[other] = { sign, amount: (ff) => ff[kk] };
  }
  { const sg = Math.sign(part.bends.reduce((a, b) => a + Math.sign(b.angle), 0)) || 1; faceFold[part.baseId] = { sign: sg, amount: (ff) => Math.max(0, ...ff) }; }
  // l'intérieur d'un pli reçoit moins de lumière : la face intérieure d'une paroi relevée, et le fond entre les parois,
  // foncent avec le pliage (une occlusion simple, par face) ; le volume se lit ouvert, pas comme un bloc plein
  const occlF = (p, f) => {
    if (p.kind !== 'face' || p.face === undefined) return 1;
    const fi = faceFold[p.face]; if (!fi) return 1;
    const inner = p.side === (fi.sign > 0 ? 'top' : 'bottom');
    return inner ? 1 - 0.42 * fi.amount(f) : 1;
  };
  const Ln = norm(light);

  // ---------- la peinture : le rideau de la chronologie, puis les couches posées par setTeinte ----------
  let couchesUI = [], horloge = 0, rideauFini = false;
  const frontA = (u, W) => EASE.rideau(u) * (W + 40) - 20;
  function couchesA(ms, W) {
    const out = [{ front: 1e6, teinte: null }];
    if (T.paint[1] > T.paint[0]) out.push({ front: rideauFini ? 1e6 : frontA(seg(ms, T.paint[0], T.paint[1]), W), teinte: teinteC });
    else if (teinteC && ms >= T.paint[0]) out.push({ front: 1e6, teinte: teinteC });
    for (const c of couchesUI) out.push({ front: frontA(seg(horloge - c.debut, 0, MOTION.rideau.ms), W), teinte: c.teinte });
    return out;
  }
  // une couche entièrement passée recouvre tout ce qui est dessous : elle devient la teinte de la pièce
  function finirCouches(toutes = false) {
    while (couchesUI.length && (toutes || horloge - couchesUI[0].debut >= MOTION.rideau.ms)) {
      const c = couchesUI.shift(); teinteC = c.teinte; rideauFini = true; if (tr) tr.setTeinte(teinteC); else grav.setTeinte(teinteC);
    }
  }

  // ---------- le dessin au sol (sous la tôle) et les traits de pli (sur la tôle), en GL ----------
  let mSol = null;
  if (tr) {
    const zP = -part.t / 2 - 0.5, segs = [];
    for (const pl of loops) for (let i = 0; i < pl.length; i++) { const a = pl[i], b = pl[(i + 1) % pl.length]; segs.push([[a[0], a[1], zP], [b[0], b[1], zP], 1.5, 0, 0, fantome]); }
    mSol = tr.maille([{ pts: [], uv: [], ton: 0, aretes: segs, n: [0, 0, 0] }]);
  }

  // ---------- dessin d'une image ----------
  let t = rm ? T.end : 0, playing = false, dead = false, dtImg = 0;
  const projTr = (v, a) => projV(v, v.cam, a);
  function drawGL(ms, W, H) {
    const v = vueA(ms, W, H); view = v;
    const { k, f, cam } = v;
    const fo = fold(part, (i) => f[i]), polys = mesh(part, fo);
    let prev = null;
    if (dtImg > 0) { const v2 = vueA(ms - H_VIT, W, H), p2 = mesh(part, fold(part, (i) => v2.f[i])); if (p2.length === polys.length) prev = { v: v2, polys: p2 }; }
    tr.begin({ W, H, cam, persp: true, nf: NF, s: v.s, cx: v.cx, cy: v.cy, pas: pasMM(W, H), dt: dtImg, vitEcran: true, couches: couchesA(ms, W) });
    tr.instance(mSol, [0, 0, 0]);
    polys.forEach((p, i) => {
      const n = newell(p.pts), vis = dot(n, sub(cam.eye, p.pts[0])) > 0;
      let ndl = dot(n, Ln); if (!vis) ndl = -ndl;
      const shade = (amb + (1 - amb) * Math.max(0, ndl)) * ((p.kind === 'edge' || p.kind === 'bore') ? 0.82 : 1);
      const sh = shade * occlF(p, f), ton = Math.pow(encre ? 1 - sh : sh, gammaTon);
      let uv, trous = null, cle = null, plein = false;
      if (p.kind === 'face') {
        const F = part.faces[p.face], loop = p.side === 'top' ? F.loop : F.loop.slice().reverse();
        uv = loop.map((q) => [q[0], q[1]]);
        if (p.holes && p.holes.length) trous = p.holes.map((Hh, j) => ({ pts: Hh, uv: p.holeRefs[j].map((q) => [q[0], q[1]]) }));
        cle = `d${id}:${p.face}:${p.side}`;
      } else { plein = true; uv = p.pts.map(() => [0, 0]); }
      let vits = null;
      if (prev) {
        const q = prev.polys[i];
        if (q.kind === p.kind && q.pts.length === p.pts.length && (q.holes || []).length === (p.holes || []).length) {
          const vel = (a, b) => { const A = projTr(v, a), B = projTr(prev.v, b); return [(A[0] - B[0]) / H_VIT, (A[1] - B[1]) / H_VIT]; };
          vits = p.pts.map((a, j) => vel(a, q.pts[j]));
          (p.holes || []).forEach((Hh, j) => Hh.forEach((a, c) => vits.push(vel(a, q.holes[j][c]))));
        }
      }
      tr.face(p.pts, uv, ton, { trous, cle, plein, peint: 1, vits });
      // arêtes vues : le contour de chaque face tournée vers l'œil, trous compris, à l'encre
      if (p.kind === 'face' && vis) {
        const ring = (Rg) => { for (let j = 0; j < Rg.length; j++) tr.arete(Rg[j], Rg[(j + 1) % Rg.length], arete, 0, n); };
        ring(p.pts); for (const Hh of p.holes || []) ring(Hh);
      }
    });
    // les traits de pli sur la tôle : trait mixte sur liseré papier, effacés quand la presse prend le pli
    for (const hg of fo.hinges) {
      const bi = part.bends.findIndex((bd) => bd.a === hg.a && bd.b === hg.b); if (bi < 0) continue;
      const al = 1 - lisse(0, 0.1, f[bi]); if (al <= 0.003) continue;
      const z = part.t / 2 + 0.2, A = apply(hg.Mp, [hg.a[0], hg.a[1], z]), B = apply(hg.Mp, [hg.b[0], hg.b[1], z]);
      const nz = apply(hg.Mp, [0, 0, 1]), o0 = apply(hg.Mp, [0, 0, 0]), nn = sub(nz, o0);
      tr.arete(A, B, 3, 2, nn, 1e9, 0, al); tr.arete(A, B, 1, 0, nn, 1e9, 1, al);
    }
    tr.end();
    v.fo = fo;
    return v;
  }
  function draw2d(ms, W, H) {
    const v = vueA(ms, W, H); view = v;
    const { k, f, cam } = v, s = v.s;
    // la pièce : tons en niveaux de gris (ombrage de part.js), encre ∝ ombre ; la teinte passe derrière le rideau
    const fo = fold(part, (i) => f[i]);
    const meshNow = mesh(part, fo);
    const polys = render(meshNow, cam, { size: s, cx: v.cx, cy: v.cy, color: [255, 255, 255], ink: [0, 0, 0], amb, light, paths: false });
    const cs = couchesA(ms, W), top = cs[cs.length - 1];
    const front = top.teinte ? top.front : -1;
    const tonOf = (p) => { const sh = (parseInt(p.fill.slice(4), 10) / 255) * occlF(p, f); return Math.pow(encre ? 1 - sh : sh, gammaTon); };
    const trace = (ctx, p) => { ctx.beginPath(); p.pr.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
      if (p.holes) for (const Hh of p.holes) { Hh.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); } };
    // l'ombre portée sur le papier, projetée selon la lumière : elle pose la pièce sur son dessin
    const shadow = [];
    if (ombre > 0 && k > 0.02) for (const pl of meshNow) { if (pl.kind !== 'face' || pl.side !== 'top') continue; shadow.push(pl.pts.map((p3) => proj(cam, [p3[0] - (Ln[0] * p3[2]) / Ln[2], p3[1] - (Ln[1] * p3[2]) / Ln[2], 0]))); }
    // trame orientée : les hachures de chaque face suivent l'axe x de son développé, tel qu'il se projette à l'écran
    const angOf = {};
    if (oriente) for (const fc of part.faces) {
      const M = fo.M.get(fc.id); if (!M) continue;
      const c = fc.loop.reduce((a, q) => [a[0] + q[0] / fc.loop.length, a[1] + q[1] / fc.loop.length], [0, 0]);
      const p0 = proj(cam, apply(M, [c[0], c[1], 0]));
      let p1 = proj(cam, apply(M, [c[0] + 400, c[1], 0]));
      if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 2) p1 = proj(cam, apply(M, [c[0], c[1] + 400, 0]));
      angOf[fc.id] = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    }
    grav.frame((ctx) => {
      if (shadow.length) { ctx.fillStyle = tonPack(ombre * Math.min(1, k * 1.5)); for (const sp of shadow) { ctx.beginPath(); sp.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fill(); } }
      const fill = (peint) => { for (const p of polys) { trace(ctx, p); ctx.fillStyle = tonPack(tonOf(p), peint, angOf[p.face] || 0); ctx.fill('evenodd'); } };
      fill(0);
      if (front > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, front, H); ctx.clip(); fill(1); ctx.restore(); }
    });
    v.fo = fo;
    // les arêtes : un trait d'encre net, en vecteur, par-dessus la trame ; seules les arêtes vues restent
    const dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (ink.width !== cw || ink.height !== ch) { ink.width = cw; ink.height = ch; }
    const ic = ink.getContext('2d'); ic.setTransform(dpr, 0, 0, dpr, 0, 0); ic.clearRect(0, 0, W, H);
    ic.lineJoin = 'round'; ic.lineWidth = arete; ic.strokeStyle = ENCRE_2D;
    for (const p of polys) {
      trace(ic, p); ic.globalCompositeOperation = 'destination-out'; ic.fill('evenodd'); ic.globalCompositeOperation = 'source-over';
      if (p.kind === 'face') ic.stroke();
    }
    return v;
  }
  function draw(ms) {
    const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return false;
    if (svg.dataset.wh !== `${W}x${H}`) { svg.dataset.wh = `${W}x${H}`; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H); }
    const v = tr ? drawGL(ms, W, H) : draw2d(ms, W, H);
    const { k, cam } = v, s = v.s;
    // le plan (contours coupés ou à couper, cotes) : tracé par-dessus la tôle en vue de dessus ; il s'efface pendant la bascule
    // (en GL, le dessin reste sous la pièce, tracé dans la scène ; en repli, il reste par-dessus, à moitié effacé)
    const flatK = 1 - k, op = tr ? flatK : fantome + (1 - fantome) * flatK;
    gDraw.style.opacity = String(op);
    gDraw.style.display = op > 0.002 ? '' : 'none';
    if (op > 0.002) {
      let headAt = null;
      loops.forEach((pl, i) => {
        const full = pathOf(cam, pl).d;
        if (!laser) { cutEls[i].setAttribute('d', ''); doneEls[i].setAttribute('d', full); return; }
        const [a0, a1] = T.cut[i], L = perim(pl), p = seg(ms, a0, a1);
        cutEls[i].setAttribute('d', p < 1 ? full : '');
        const part2 = p > 0 ? pathOf(cam, pl, true, p * L) : { d: '' };
        doneEls[i].setAttribute('d', p >= 1 ? full : part2.d);
        if (p > 0 && p < 1 && part2.end) headAt = proj(cam, [part2.end[0], part2.end[1], 0]);
      });
      head.setAttribute('visibility', headAt ? 'visible' : 'hidden');
      if (headAt) { const [hx, hy] = headAt.map((q) => Math.round(q) + 0.5); head.setAttribute('d', `M${hx - 11},${hy}h7M${hx + 4},${hy}h7M${hx},${hy - 11}v7M${hx},${hy + 4}v7M${hx + 6},${hy}a6,6 0 1 1 -12,0a6,6 0 1 1 12,0`); }
      part.bends.forEach((bd, i) => { if (!bendEls[i]) return; const d = `M${proj(cam, [bd.a[0], bd.a[1], 0]).map((q) => q.toFixed(1)).join(',')}L${proj(cam, [bd.b[0], bd.b[1], 0]).map((q) => q.toFixed(1)).join(',')}`; bendEls[i].setAttribute('d', d); haloEls[i].setAttribute('d', d); });
    } else { for (const e2 of [...cutEls, ...doneEls]) e2.setAttribute('d', ''); head.setAttribute('visibility', 'hidden'); }
    for (const e2 of [...cutEls, ...doneEls, head, ...bendEls, ...haloEls]) e2.style.visibility = op > 0.002 ? '' : 'hidden';
    if (cotes) {
      // cotes hors tout, posées sur le papier à 22 px du contour (dessous et à droite), lisibles en vue de dessus seulement
      const opc = clamp(1 - k * 2.2);
      for (const E of coteEls) for (const el2 of [E.line, E.arrows, E.txt]) { el2.style.opacity = String(opc); el2.style.visibility = opc > 0.002 ? '' : 'hidden'; }
      if (opc > 0.002) {
        const off = 22 / s / (cam.k / D) * 1, ar = 8;
        const a = proj(cam, [X0, Y0 - off, 0]), bb = proj(cam, [X1, Y0 - off, 0]), c = proj(cam, [X1 + off, Y0, 0]), d = proj(cam, [X1 + off, Y1, 0]);
        const cote = (E, p, q, txtAt, rot) => {
          const ang = Math.atan2(q[1] - p[1], q[0] - p[0]), ux = Math.cos(ang), uy = Math.sin(ang);
          E.line.setAttribute('d', `M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}`);
          const tip = (P, sgn) => `M${P[0].toFixed(1)},${P[1].toFixed(1)}l${(sgn * ux * ar - uy * 3).toFixed(1)},${(sgn * uy * ar + ux * 3).toFixed(1)}l${(uy * 6).toFixed(1)},${(-ux * 6).toFixed(1)}Z`;
          E.arrows.setAttribute('d', tip(p, 1) + tip(q, -1));
          E.txt.setAttribute('x', txtAt[0].toFixed(1)); E.txt.setAttribute('y', txtAt[1].toFixed(1));
          E.txt.setAttribute('transform', rot ? `rotate(-90 ${txtAt[0].toFixed(1)} ${txtAt[1].toFixed(1)})` : '');
        };
        cote(coteEls[0], a, bb, [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2 + 20], false);
        cote(coteEls[1], c, d, [(c[0] + d[0]) / 2 + 20, (c[1] + d[1]) / 2], true);
      }
    }
    if (angEl) {
      // le coup en cours (ou celui qui vient de finir, pendant le maintien) ; la cote apparaît et s'efface en MOTION.micro
      const tau = ms - T.fold[0], MI = MOTION.micro.ms;
      const st = g.strokes.find((x) => tau >= x.t0 && tau < x.t1 + PR.maintien.ms);
      const fo2 = st ? v.fo : null;
      const hg = st && fo2.hinges.find((h) => { const bd = part.bends[st.bend]; return h.a === bd.a && h.b === bd.b; });
      const opa = st ? Math.min(lisse(st.t0, st.t0 + MI, tau), 1 - lisse(st.t1 + PR.maintien.ms - MI, st.t1 + PR.maintien.ms, tau)) : 0;
      if (st && hg && Math.abs(part.bends[st.bend].angle) < 170 && opa > 0.002) {
        const bd = part.bends[st.bend], m2 = [(bd.a[0] + bd.b[0]) / 2, (bd.a[1] + bd.b[1]) / 2];
        const dx = bd.b[0] - bd.a[0], dy = bd.b[1] - bd.a[1], L2 = Math.hypot(dx, dy), n = [-dy / L2, dx / L2];
        const pc = part.faces[hg.parent].loop.reduce((a, q) => [a[0] + q[0], a[1] + q[1]], [0, 0]).map((q) => q / part.faces[hg.parent].loop.length);
        const sgn = (pc[0] - m2[0]) * n[0] + (pc[1] - m2[1]) * n[1] > 0 ? 1 : -1, Rr = 70;
        const Mp = fo2.M.get(hg.parent), Mc = fo2.M.get(hg.child), z = Math.sign(bd.angle) * part.t / 2;
        const O = apply(Mp, [m2[0], m2[1], z]), A = apply(Mp, [m2[0] + sgn * n[0] * Rr, m2[1] + sgn * n[1] * Rr, z]), B = apply(Mc, [m2[0] - sgn * n[0] * Rr, m2[1] - sgn * n[1] * Rr, z]);
        const va = [A[0] - O[0], A[1] - O[1], A[2] - O[2]], vb = [B[0] - O[0], B[1] - O[1], B[2] - O[2]];
        const dt2 = (va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]) / (Rr * Rr), om = Math.acos(Math.max(-1, Math.min(1, dt2)));
        const pts = [];
        for (let i = 0; i <= 16; i++) { const tt = i / 16, s0 = Math.sin((1 - tt) * om) / Math.sin(om || 1e-6), s1 = Math.sin(tt * om) / Math.sin(om || 1e-6); pts.push(proj(cam, [O[0] + va[0] * s0 + vb[0] * s1, O[1] + va[1] * s0 + vb[1] * s1, O[2] + va[2] * s0 + vb[2] * s1])); }
        angEl.arc.setAttribute('d', 'M' + pts.map((q) => q.map((w) => w.toFixed(1)).join(',')).join('L'));
        const mid = pts[8], val = Math.round((om * 180) / Math.PI);
        const txt = `${val}°`; angEl.txt.textContent = txt;
        const tw = 15 * 0.62 * txt.length + 12;
        angEl.plaque.setAttribute('x', (mid[0] - tw / 2).toFixed(1)); angEl.plaque.setAttribute('y', (mid[1] - 13).toFixed(1)); angEl.plaque.setAttribute('width', tw.toFixed(1)); angEl.plaque.setAttribute('height', 24);
        angEl.txt.setAttribute('x', mid[0].toFixed(1)); angEl.txt.setAttribute('y', (mid[1] + 5).toFixed(1));
        gTop.style.opacity = String(opa);
        for (const e2 of [angEl.arc, angEl.plaque, angEl.txt]) e2.style.visibility = 'visible';
      } else for (const e2 of [angEl.arc, angEl.plaque, angEl.txt]) e2.style.visibility = 'hidden';
    }
    onFrame && onFrame({ ms, k, f: v.f, T, phase: ms < T.tilt[0] ? (laser ? 'coupe' : 'plan') : ms < T.fold[0] ? 'bascule' : ms < T.fold[1] ? 'pli' : ms < T.paint[0] ? 'plie' : ms < T.paint[1] ? 'peinture' : 'fin' });
    return true;
  }

  // ---------- fondu enchaîné : l'image en cours, figée, s'efface au-dessus de la suivante (jamais une coupe sèche) ----------
  function fondu(ms = PR.approche.ms) {
    if (rm || dead || !host.isConnected || !canvas.width || !host.clientWidth) return;
    const wrap = document.createElement('div'); wrap.className = 'dvp-fondu'; wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    const snap = document.createElement('canvas'); snap.width = canvas.width; snap.height = canvas.height;
    const sc = snap.getContext('2d'); sc.drawImage(canvas, 0, 0); if (ink) sc.drawImage(ink, 0, 0, snap.width, snap.height);
    wrap.append(snap, svg.cloneNode(true));
    host.append(wrap);
    const an = wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'linear', fill: 'forwards' });
    const fin = () => wrap.remove(); an.finished.then(fin, fin);
  }

  const tk = ticker((dt) => {
    if (dead) return false;
    horloge += dt;
    if (playing) { t = Math.min(T.end, t + dt); dtImg = dt; } else dtImg = 0;
    finirCouches();
    if (playing && t >= T.end) { playing = false; dtImg = 0; }
    if (!draw(t)) return true;
    return playing || couchesUI.length > 0;
  }, { el: host, margin: '0px' });
  const api = {
    T, grav,
    get moteur() { return tr ? tr.mode : 'repli'; },
    play() {
      if (rm) { t = T.end; api.redraw(); return; }
      if (t > 0) fondu();
      finirCouches(true); rideauFini = false; t = 0; dtImg = 0; playing = true; api.redraw(); tk.start();
    },
    stop() { if (playing) fondu(); tk.stop(); playing = false; finirCouches(true); t = T.end; dtImg = 0; api.redraw(); },
    // dt : durée d'image simulée (banc d'essai du flou de bougé)
    seek(ms, dt = 0) { tk.stop(); playing = false; finirCouches(true); rideauFini = false; t = clamp(ms, 0, T.end); dtImg = dt; api.redraw(); dtImg = 0; },
    // nouvelle teinte : avant le rideau, c'est lui qui l'apportera ; pendant ou après, une couche de plus passe en rideau
    setTeinte(hex) {
      const avant = t < T.paint[0] && !rideauFini && !couchesUI.length;
      if (rm || avant || !host.clientWidth) {
        couchesUI = []; teinteC = hex; if (tr) tr.setTeinte(hex); else grav.setTeinte(hex);
        if (avant && !rm && (T.paint[1] > T.paint[0]) !== !!hex) { timeline(0.4); cadrage(); lay = null; } // le rideau apparaît ou disparaît de la chronologie
        if (rm) t = T.end;
        if (!playing) api.redraw();
        return;
      }
      if (hex === (couchesUI.length ? couchesUI[couchesUI.length - 1].teinte : teinteC)) return;
      couchesUI.push({ teinte: hex, debut: horloge });
      if (couchesUI.length > 3) { const c = couchesUI.shift(); teinteC = c.teinte; rideauFini = true; }
      tk.start();
    },
    redraw() { if (!dead && !draw(t)) requestAnimationFrame(() => { if (!dead && host.isConnected) draw(t); }); },
    get playing() { return playing; }, get t() { return t; },
    // remplacer la pièce : l'image en cours s'efface au-dessus de la suivante, puis la scène se retire
    sortie() { fondu(); api.destroy(); canvas.remove(); svg.remove(); if (ink) ink.remove(); },
    destroy() { if (dead) return; dead = true; tk.destroy(); ro.disconnect(); tr ? tr.destroy() : grav.destroy(); },
  };
  const ro = new ResizeObserver(() => { if (!playing) api.redraw(); });
  ro.observe(host);
  if (autoplay && !rm) api.play(); else api.redraw();
  return api;
}
