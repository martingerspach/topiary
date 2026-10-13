// Ourlet · le développé qui se plie (premier écran et outil ; itération 7 : la passe d'exigence).
// La pièce commence comme un plan : vue de dessus, le développé coté (contour, trous, lignes de pli en trait mixte, deux cotes
// hors tout avec leurs lignes d'attache). La caméra bascule de la vue de dessus vers les trois quarts, les cotes s'effacent,
// puis la tôle se plie dans l'ordre de la gamme, au rythme de la presse ; enfin la teinte du client se dépose en poudre.
// Le dessin reste sur le papier, sous la pièce : chaque paroi qui se lève découvre son propre tracé (on voit d'où elle vient).
// Option laser (D2) : avant la bascule, la tête du laser suit le dessin, les trous d'abord, le contour en dernier.
//
// Itération 7, ce qui change (références de métier) :
// - la presse : chaque pli dépasse son angle de 2° sous le poinçon (pliage en l'air : on plie à 88° pour obtenir 90°), tient
//   un court instant sous la charge, puis la tôle revient d'elle-même à son angle quand le poinçon relâche (retour élastique :
//   la durée du geste « retour », sur une courbe à départ doux). Le pli suivant part pendant ce retour, et le premier pendant que la caméra finit de se
//   poser : plus de temps mort entre les gestes, aucune vitesse ne casse aux raccords ;
// - la cote d'angle se lit là où un plieur la mesure, en bout de pli, sur la tranche de la paroi : l'arc entre le fond et la
//   paroi, la valeur à côté, hors de la pièce (elle ne masque plus le pli sur un téléphone) ; elle entre et sort en fondu ;
// - la teinte : plus de rideau qui traverse l'écran. La poudre se dépose par passes de pistolet dans le sens long de la tôle,
//   en allers et retours qui se recouvrent, face après face ; la couche fonce progressivement, par grains fixés à la matière,
//   et les faces en creux se couvrent un peu plus tard (cage de Faraday). Changer de teinte dépose une nouvelle couche de la
//   même façon, plus vite ; « sans peinture » retire la couche d'un geste (trace-dvp-v7.js) ;
// - le sens de la trame suit le sens long de la tôle (le sens de laminage) : sur une barre de 3 m vue en enfilade, les lignes
//   filent vers le point de fuite au lieu de barrer le profil ; le pas de la trame tombe sur un nombre entier de pixels en vue
//   de dessus (lignes toutes de la même épaisseur sur le plan) ;
// - états de l'outil sans saut d'image : « À plat » déplie la pièce pendant que la caméra remonte à la verticale, exactement
//   sur le tracé du plan coté (setVue) ; l'épaisseur s'interpole (setEpaisseur) ; le cadre suit, sans à-coup ;
// - tous les fondus enchaînés passent par l'horloge commune (plus d'animation hors de l'horloge) ;
// - les vignettes des pièces d'exemple sont gravées par le même moteur (vignettes) : une seule langue d'illustration.
// Repli sans WebGL2 : la trame d'écran de la v5 (gravure.js), le dessin vectoriel par-dessus, la teinte en rideau.
// Déterministe : seek(t). Mouvements réduits : la pièce pliée et peinte, le dessin dessous, rien ne bouge.
import { fold, mesh, render, camera, apply, makePart } from './part.js';
import { createGravure, tonPack } from './gravure.js';
import { createTrace } from './trace-dvp-v7.js';
import { MOTION, EASE, ticker, prefersReduced } from './motion.js';

// ---------- valeurs propres à ce fichier ----------
// Les durées reprennent des gestes de la grammaire (MOTION) ; les valeurs nouvelles (surpliage, tenue, dépôt de poudre, part
// du passage, pas au plus proche) sont à verser dans les tokens : voir le rapport de l'itération 7.
const SURPLI = 2;        // degrés de pliage au-delà de l'angle visé, que le retour élastique rend (acier doux de 2 mm : 1 à 2°)
const TENUE = 100;       // ms sous la charge avant que le poinçon relâche
const RACCORD = MOTION.presse.maintien.ms; // le premier coup de presse part pendant que la caméra finit de se poser (260 ms avant)
const RACCORD_POUDRE = MOTION.micro.ms; // le pistolet part pendant que le dernier pli finit son retour élastique (160 ms avant)
const PAS_PROCHE = 1.35;   // le pas de la trame au point le plus proche de l'œil, au plus, en multiple du pas nominal
const COTES_MS = MOTION.presse.approche.ms; // les cotes hors tout s'effacent au départ de la bascule, avant que la perspective les déforme
const VUE_MS = MOTION.presse.appui.ms; // passage « Pliée » ↔ « À plat » de l'outil (dépliage et remontée de la caméra, puis relais du plan)
export const VUE_POSE = 0.84; // part du passage où la pièce bouge ; le reste est le relais entre la trame et le plan coté
const POUDRE = {
  passe: 640,            // ms par passe de pistolet (premier écran)
  duree: [1280, 2400],   // ms : bornes de la durée du dépôt
  change: 0.6,           // un changement de teinte dans l'outil va plus vite (part de la durée)
  k: 5,                  // saturation de la couche : 1 − e^(−k × exposition)
  creux: 0.78,           // part d'exposition des faces intérieures (cage de Faraday)
  grain: 2.3,            // px : taille du grain fin, à l'échelle du cadrage final
  nuage: 15,             // px : taille des volutes du nuage
  mordant: 0.4,          // largeur du seuil de prise du grain (0 : grains durs, 1 : fondu)
};

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
// l'inverse d'une pose de face (rotation et translation) : du monde vers le développé
const versTole = (M, p) => { const x = p[0] - M[9], y = p[1] - M[10], z = p[2] - M[11]; return [M[0] * x + M[3] * y + M[6] * z, M[1] * x + M[4] * y + M[7] * z]; };
const H_VIT = 8; // ms : pas de dérivation des vitesses à l'écran (flou de bougé de la trame)
const EL_PLAN = 89.9; // la vue de dessus : la verticale à 0,1° près (à 90° pile, l'axe de la caméra se confond avec son « haut »)
let NUM = 0;

// ---------- la gamme de pliage : un coup par pli, deux par ourlet ; surpliage, tenue, retour élastique ----------
function gammePresse(part, order) {
  const PR = MOTION.presse, strokes = [];
  for (const k of order) {
    const ang = Math.abs(part.bends[k].angle);
    if (ang >= 170) { // ourlet : pré-pliage aigu à 30°, puis écrasement (aucun retour : la tôle est à plat sur elle-même)
      strokes.push({ bend: k, from: 0, to: 30 / ang, ms: PR.appui.ms * 0.7, sur: 0 });
      strokes.push({ bend: k, from: 30 / ang, to: 1, ms: PR.appui.ms, sur: 0 });
    } else strokes.push({ bend: k, from: 0, to: 1, ms: PR.appui.ms, sur: SURPLI / Math.max(ang, 20) });
  }
  let t = 0;
  for (const s of strokes) { s.t0 = t; s.t1 = t + s.ms; s.t2 = s.t1 + (s.sur ? TENUE : 0); s.t3 = s.t2 + (s.sur ? PR.retour.ms : 0); t = s.t1 + PR.maintien.ms; }
  const duration = strokes.length ? Math.max(...strokes.map((s) => s.t3)) : 0;
  const state = (ms) => {
    const f = new Array(part.bends.length).fill(0);
    for (const s of strokes) {
      if (ms <= s.t0) continue;
      if (ms < s.t1) f[s.bend] = s.from + (s.to + s.sur - s.from) * EASE.appui((ms - s.t0) / s.ms);
      else if (ms < s.t2) f[s.bend] = s.to + s.sur;
      else if (ms < s.t3) f[s.bend] = s.to + s.sur * (1 - EASE.convoyeur((ms - s.t2) / PR.retour.ms)); // le poinçon se retire : départ et arrêt doux
      else f[s.bend] = s.to;
    }
    return f;
  };
  return { strokes, duration, state };
}

// l'intérieur d'un pli : la face intérieure d'une paroi relevée, et le fond entre les parois. Renvoie (poly, f) → part de
// pliage de la face si elle est en creux, 0 sinon (moins de lumière, et moins de poudre)
function creuxDe(part) {
  const faceFold = {};
  for (const ln of part.links) {
    const other = ln.faces[0] === part.baseId ? ln.faces[1] : ln.faces[1] === part.baseId ? ln.faces[0] : null;
    const sign = Math.sign(ln.bend.angle) || 1, kk = ln.k;
    if (other !== null && other !== undefined) faceFold[other] = { sign, amount: (ff) => Math.min(1, ff[kk]) };
  }
  { const sg = Math.sign(part.bends.reduce((a, b) => a + Math.sign(b.angle), 0)) || 1; faceFold[part.baseId] = { sign: sg, amount: (ff) => Math.min(1, Math.max(0, ...ff)) }; }
  return (p, f) => {
    if (p.kind !== 'face' || p.face === undefined) return 0;
    const fi = faceFold[p.face]; if (!fi) return 0;
    return p.side === (fi.sign > 0 ? 'top' : 'bottom') ? fi.amount(f) : 0;
  };
}

// écrit la pièce dans le moteur : faces (trame le long du sens long de la tôle), chants et arrondis en ton plein, arêtes vues
function tracerPiece(tr, part, fo, polys, { cam, f, creux, Ln, amb, encre, gammaTon, arete, cle, uvDe, vits = null, trouMin = 0 }) {
  polys.forEach((p, i) => {
    const n = newell(p.pts), vis = dot(n, sub(cam.eye, p.pts[0])) > 0;
    let ndl = dot(n, Ln); if (!vis) ndl = -ndl;
    const shade = (amb + (1 - amb) * Math.max(0, ndl)) * ((p.kind === 'edge' || p.kind === 'bore') ? 0.82 : 1);
    const cr = creux(p, f), sh = shade * (1 - 0.42 * cr), ton = Math.pow(encre ? 1 - sh : sh, gammaTon);
    let uv, trous = null, k2 = null, plein = false;
    if (p.kind === 'face') {
      const F = part.faces[p.face], loop = p.side === 'top' ? F.loop : F.loop.slice().reverse();
      uv = loop.map(uvDe);
      if (p.holes && p.holes.length) trous = p.holes.map((Hh, j) => ({ pts: Hh, uv: p.holeRefs[j].map(uvDe) }));
      k2 = `${cle}:${p.face}:${p.side}`;
    } else { // chants, alésages, arrondis de pli : plus fins qu'une ligne, mais la poudre s'y dépose à leur place dans la tôle
      plein = true; const M = fo.M.get(p.face); uv = p.pts.map((q) => (M ? uvDe(versTole(M, q)) : [0, 0]));
    }
    tr.face(p.pts, uv, ton, { trous, cle: k2, plein, peint: 1, creux: 1 - (1 - POUDRE.creux) * cr, vits: vits ? vits(p, i) : null });
    // arêtes vues : le contour de chaque face tournée vers l'œil, trous compris, à l'encre
    if (p.kind === 'face' && vis) {
      const ring = (Rg) => { for (let j = 0; j < Rg.length; j++) tr.arete(Rg[j], Rg[(j + 1) % Rg.length], arete, 0, n); };
      // (vignettes : un trou de quelques pixels garde son jour, pas son contour, qui le boucherait d'encre)
      ring(p.pts); for (const Hh of p.holes || []) if (!trouMin || Math.hypot(Hh[0][0] - Hh[Hh.length >> 1][0], Hh[0][1] - Hh[Hh.length >> 1][1], Hh[0][2] - Hh[Hh.length >> 1][2]) >= trouMin) ring(Hh);
    }
  });
}

// les passes du pistolet dans la matière : le sens long (u), l'écart en travers (v), la largeur du nuage ; la dernière passe
// est celle de la bande la plus proche de l'œil (la couche se ferme sur la face que l'on regarde)
function passesDe(part, grainY, uvDe, fo, cam) {
  const xs = part.outline.map((p) => uvDe(p)[0]), ys = part.outline.map((p) => uvDe(p)[1]);
  const u0 = Math.min(...xs), u1 = Math.max(...xs), v0 = Math.min(...ys), v1 = Math.max(...ys);
  const n = clamp(Math.round(((v1 - v0) / Math.max(1, u1 - u0)) * 4.6), 2, 4), dv = (v1 - v0) / n, sv = 0.62 * dv, su = 0.6 * sv;
  // profondeur moyenne d'une bande à l'état plié : des points le long de sa ligne, ramenés sur leur face
  const inPoly = (p, poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };
  const off = uvDe([0, 0]);
  const prof = (v) => {
    let s = 0, c = 0;
    for (let i = 0; i < 9; i++) {
      const u = u0 + ((i + 0.5) / 9) * (u1 - u0), q = grainY ? [v - off[1], u - off[0]] : [u - off[0], v - off[1]];
      const F = part.faces.find((fc) => inPoly(q, fc.loop)); if (!F || !fo.M.get(F.id)) continue;
      s += dot(sub(apply(fo.M.get(F.id), [q[0], q[1], 0]), cam.eye), cam.f); c++;
    }
    return c ? s / c : Infinity;
  };
  const inverse = prof(v0 + dv / 2) < prof(v1 - dv / 2);
  return { n, v0: inverse ? v1 - dv / 2 : v0 + dv / 2, dv: inverse ? -dv : dv, sv, su, u0, u1, k: POUDRE.k };
}

// ---------- les fondus enchaînés : des images figées qui s'effacent, sur l'horloge commune (une seule pour le module) ----------
const fondus = new Set();
let tkFondus = null;
function fonduSuivi(el, ms) {
  fondus.add({ el, age: 0, ms });
  tkFondus ||= ticker((dt) => {
    for (const f of fondus) { f.age += dt; if (f.age >= f.ms || !f.el.isConnected) { f.el.remove(); fondus.delete(f); } else f.el.style.opacity = String(1 - f.age / f.ms); }
    return fondus.size > 0;
  });
  tkFondus.start();
}

export function mountDeveloppe(host, part, {
  order = part.gamme || part.bends.map((_, k) => k), az = (part.vue && part.vue.az) || [-90, -128], el = (part.vue && part.vue.el) || [88, 31],
  dist = (part.vue && part.vue.dist) || 2.6, fov = (part.vue && part.vue.fov) || 24,
  teinte = null, couleurs, pas = 3, ep = [0.1, 0.92], laser = false, cotes = true, pad = 0.1, aplat = 0.85, gammaTon = 1,
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
  const tr = createTrace(canvas, { couleurs, aplat, ep });
  let grav = null, ink = null;
  if (!tr) {
    // repli : un canvas neuf (celui-ci a peut-être déjà un contexte WebGL2 refusé), la trame d'écran et l'encre en 2D
    const c2 = document.createElement('canvas'); c2.setAttribute('aria-hidden', 'true'); canvas.replaceWith(c2); canvas = c2;
    ink = document.createElement('canvas'); ink.setAttribute('aria-hidden', 'true'); ink.className = 'dvp-aretes'; poser(ink);
    // mode groupé : ton, peinture et angle des hachures dans un seul canvas (un remplissage et un envoi par image)
    grav = createGravure(canvas, { pas, ep: [0.06, 0.94], epFond: 0, teinte, aplat, oriente, packed: true, ...couleurs });
  }
  poser(svg);
  const ENCRE_2D = couleurArete || couleurs.trait1;

  // ---------- géométrie ----------
  // la vue travaille sur un calque de la pièce : son épaisseur s'interpole sans toucher à la pièce de l'appelant
  const pv = Object.create(part); pv.t = part.t;
  const xs = part.outline.map((p) => p[0]), ys = part.outline.map((p) => p[1]);
  const X0 = Math.min(...xs), X1 = Math.max(...xs), Y0 = Math.min(...ys), Y1 = Math.max(...ys);
  const ctr = [(X0 + X1) / 2, (Y0 + Y1) / 2];
  // la trame suit le sens long de la tôle (sens de laminage) ; uvDe : du développé vers (le long des lignes, en travers)
  const grainY = (Y1 - Y0) > (X1 - X0) * 1.15;
  let uvOff = 0;
  const uvDe = grainY ? (q) => [q[1], q[0] + uvOff] : (q) => [q[0], q[1] + uvOff];
  const D = Math.hypot(X1 - X0, Y1 - Y0) * dist;
  const el0 = Math.max(el[0], EL_PLAN);
  const camDe = (a, e, tz) => {
    const ar = (a * Math.PI) / 180, er = (e * Math.PI) / 180, tgt = [ctr[0], ctr[1], tz];
    return camera({ eye: [tgt[0] + D * Math.cos(er) * Math.cos(ar), tgt[1] + D * Math.cos(er) * Math.sin(ar), tgt[2] + D * Math.sin(er)], target: tgt, fov });
  };
  const KCAM = 1 / Math.tan((fov * Math.PI) / 360);
  const projV = (v, cam, p) => { const q = [p[0] - cam.eye[0], p[1] - cam.eye[1], p[2] - cam.eye[2]]; const x = q[0] * cam.r[0] + q[1] * cam.r[1] + q[2] * cam.r[2], y = q[0] * cam.u[0] + q[1] * cam.u[1] + q[2] * cam.u[2], z = q[0] * cam.f[0] + q[1] * cam.f[1] + q[2] * cam.f[2]; return [v.cx + (x * cam.k / z) * v.s, v.cy - (y * cam.k / z) * v.s]; };
  const UNITE = { s: 1, cx: 0, cy: 0 };

  // ---------- chronologie (durées tirées de la grammaire : laser, presse, caméra ; le dépôt de poudre : POUDRE) ----------
  const g = gammePresse(part, order);
  const loops = [...(part.holes || []).map((h) => h), part.outline]; // les trous d'abord, le contour en dernier
  const perim = (pl) => pl.reduce((s, p, i) => s + Math.hypot(pl[(i + 1) % pl.length][0] - p[0], pl[(i + 1) % pl.length][1] - p[1]), 0);
  // les passes du pistolet se règlent sur la pose pliée, vue de trois quarts (elles ne dépendent pas de l'épaisseur)
  const PASSES = passesDe(part, grainY, (q) => (grainY ? [q[1], q[0]] : [q[0], q[1]]), fold(pv, 1), camDe(az[1], el[1], 0));
  // la dernière passe s'arrête quand le nuage a quitté la tôle (0,2 passe avant son terme) : pas de temps mort en fin de dépôt
  const NPASSES = PASSES.n - 0.2, dureePoudre = clamp(NPASSES * POUDRE.passe, POUDRE.duree[0], POUDRE.duree[1]);
  const T = {};
  let teinteC = teinte; // la teinte que le dépôt de la chronologie apporte
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
    // le premier coup de presse part pendant que la caméra finit de se poser (elle a fait 97 % de son chemin)
    const f0 = g.duration ? t - RACCORD : t;
    // la poudre part pendant le dernier retour élastique : le nuage met de lui-même un instant à atteindre la tôle
    T.fold = [f0, f0 + g.duration]; t = Math.max(t, T.fold[1] - (teinteC && g.duration ? RACCORD_POUDRE : 0));
    T.paint = [t, t + (teinteC ? dureePoudre : 0)];
    T.end = T.paint[1];
  }
  timeline(0.4);

  // ---------- cadrage ----------
  // caméra posée : le cadre glisse du plan (vue de dessus, cotes comprises) vers la pièce pendant la bascule seulement, sur la
  // courbe de la caméra ; ensuite il tient toute la gamme (l'enveloppe de toutes les poses du pliage, dessin au sol compris)
  const stateAt = (ms) => ({ k: EASE.camera(seg(ms, T.tilt[0], T.tilt[1])), f: g.state(ms - T.fold[0]) });
  const camK = (k, zMax) => camDe(lerp(az[0], az[1], k), lerp(el0, el[1], k), zMax * 0.35 * k);
  function geoDe(tEp) {
    const t0 = pv.t; pv.t = tEp;
    const h = tEp / 2, zMax = Math.max(...mesh(pv, fold(pv, 1)).flatMap((p) => p.pts).map((p) => p[2]));
    // la boîte d'une pose : les sommets des faces (dessus et dessous) et le dessin au sol, projetés sans échelle
    const boxOf = (ms) => {
      const { k, f } = stateAt(ms), cam = camK(k, zMax), fo = fold(pv, (i) => f[i]);
      let b = [Infinity, Infinity, -Infinity, -Infinity];
      const voir = (p3) => { const q = projV(UNITE, cam, p3); b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])]; };
      for (const F of part.faces) { const M = fo.M.get(F.id); if (!M) continue; for (const p of F.loop) { voir(apply(M, [p[0], p[1], h])); voir(apply(M, [p[0], p[1], -h])); } }
      for (const p of part.outline) voir([p[0], p[1], 0]);
      return b;
    };
    const B0 = boxOf(0); let B1 = [Infinity, Infinity, -Infinity, -Infinity];
    for (let ms = T.fold[0]; ms <= T.end + 60; ms += 60) { const b = boxOf(Math.min(ms, T.end)); B1 = [Math.min(B1[0], b[0]), Math.min(B1[1], b[1]), Math.max(B1[2], b[2]), Math.max(B1[3], b[3])]; }
    // pendant la bascule, la pièce doit rester dans le cadre interpolé : sinon le cadre s'élargit d'une bosse douce
    let mx = 1;
    for (let ms = T.tilt[0]; ms <= T.tilt[1]; ms += 40) {
      const e = EASE.camera(seg(ms, T.tilt[0], T.tilt[1])), F = B0.map((v, j) => v + (B1[j] - v) * e), a = boxOf(ms);
      const cx = (F[0] + F[2]) / 2, cy = (F[1] + F[3]) / 2, hw = (F[2] - F[0]) / 2, hh = (F[3] - F[1]) / 2;
      mx = Math.max(mx, (cx - a[0]) / hw, (a[2] - cx) / hw, (cy - a[1]) / hh, (a[3] - cy) / hh);
    }
    pv.t = t0;
    return { t: tEp, zMax, B0, B1, gonfle: mx };
  }
  // l'épaisseur en cours : entre deux géométries (cadres compris), sur le geste d'approche
  let geoA = geoDe(part.t), geoB = geoA, epU = 1;
  const melGeo = () => {
    if (epU >= 1 || geoA === geoB) return geoB;
    const e = EASE.approche(epU), m = (a, b) => a.map((v, j) => lerp(v, b[j], e));
    return { t: lerp(geoA.t, geoB.t, e), zMax: lerp(geoA.zMax, geoB.zMax, e), B0: m(geoA.B0, geoB.B0), B1: m(geoA.B1, geoB.B1), gonfle: lerp(geoA.gonfle, geoB.gonfle, e) };
  };
  let geo = geoA;
  const boxAt = (ms) => {
    const u = seg(ms, T.tilt[0], T.tilt[1]), e = EASE.camera(u), F = geo.B0.map((v, j) => v + (geo.B1[j] - v) * e);
    if (geo.gonfle <= 1.0001) return F;
    const kk = 1 + (geo.gonfle - 1) * Math.sin(Math.PI * u) ** 2, cx = (F[0] + F[2]) / 2, cy = (F[1] + F[3]) / 2;
    return [cx + (F[0] - cx) * kk, cy + (F[1] - cy) * kk, cx + (F[2] - cx) * kk, cy + (F[3] - cy) * kk];
  };
  // ---------- « À plat » : la pièce se déplie et la caméra remonte à la verticale, sur le tracé du plan coté ----------
  // vu : avancement (0 = la chronologie, 1 = à plat) ; plan : { echelle (px par mm), cx, cy (le centre du développé), rot }
  let vu = 0, vuCible = 0, plan = null;
  const NB = part.bends.length, rangPli = new Array(NB).fill(0);
  { const ord = [...order].reverse(); const vus = new Set(); let r = 0; for (const k of ord) if (!vus.has(k)) { vus.add(k); rangPli[k] = r++; } }
  const depli = (i, u) => { // les plis faits en dernier s'ouvrent en premier, en se chevauchant
    const span = 0.62, st = NB > 1 ? (1 - span) / (NB - 1) : 0;
    return EASE.convoyeur(seg(u, rangPli[i] * st, rangPli[i] * st + span));
  };
  const vueBrute = (ms, W, H, vu) => {
    const st = stateAt(ms), b = boxAt(ms);
    const mc = cotes ? 46 * (1 - st.k) : 0; // la place des cotes, rendue quand elles s'effacent
    let s = Math.min((W * (1 - 2 * pad) - mc) / (b[2] - b[0]), (H * (1 - 2 * pad) - mc) / (b[3] - b[1]));
    let cx = (W - mc) / 2 - ((b[0] + b[2]) / 2) * s, cy = (H - mc) / 2 - ((b[1] + b[3]) / 2) * s;
    let a = lerp(az[0], az[1], st.k), e = lerp(el0, el[1], st.k), tz = geo.zMax * 0.35 * st.k, f = st.f, k = st.k;
    if (vu > 0 && plan) {
      const up = seg(vu, 0, VUE_POSE), m = EASE.camera(up), sP = (plan.echelle * D) / KCAM;
      a = lerp(a, plan.rot ? 0 : -90, m); e = lerp(e, EL_PLAN, m); tz *= 1 - m;
      s *= Math.pow(sP / s, m); cx = lerp(cx, plan.cx, m); cy = lerp(cy, plan.cy, m);
      f = f.map((x, i) => x * (1 - depli(i, up))); k *= 1 - m;
      return { k, f, cam: camDe(a, e, tz), s, cx, cy, up };
    }
    return { k, f, cam: camDe(a, e, tz), s, cx, cy, up: 0 };
  };
  // en chemin vers le plan, une longue pièce vue en enfilade sortirait du cadre pendant que la caméra tourne : le cadre recule
  // d'une bosse douce (calculée une fois par passage : la plus petite qui garde toute la pièce dans la vue)
  let bosse = null, vuMs = 0;
  const bosseDe = (W, H) => {
    const cle = `${W}x${H}:${plan.echelle}:${plan.cx}:${plan.cy}:${plan.rot}:${vuMs}:${geoB.t}`;
    if (bosse && bosse.cle === cle) return bosse.b;
    let b = 0; const h = geo.t / 2, M = 6;
    for (let u = 0.06; u < VUE_POSE; u += 0.06) {
      const v = vueBrute(vuMs, W, H, u), fo = fold(pv, (i) => v.f[i]), sn = Math.sin(Math.PI * v.up) ** 2; let kr = 1;
      for (const F of part.faces) { const Mf = fo.M.get(F.id); if (!Mf) continue;
        for (const q of F.loop) for (const z of [h, -h]) { const p = projV(v, v.cam, apply(Mf, [q[0], q[1], z])), dx = p[0] - v.cx, dy = p[1] - v.cy;
          if (dx > 1) kr = Math.min(kr, (W - M - v.cx) / dx); else if (dx < -1) kr = Math.min(kr, (v.cx - M) / -dx);
          if (dy > 1) kr = Math.min(kr, (H - M - v.cy) / dy); else if (dy < -1) kr = Math.min(kr, (v.cy - M) / -dy); } }
      if (sn > 0.04 && kr < 1 && kr > 0) b = Math.max(b, (1 - kr) / sn);
    }
    bosse = { cle, b: Math.min(0.7, b) };
    return bosse.b;
  };
  const vueA = (ms, W, H) => {
    const v = vueBrute(ms, W, H, vu);
    if (v.up > 0 && v.up < 1 && plan) v.s *= 1 - bosseDe(W, H) * Math.sin(Math.PI * v.up) ** 2;
    return v;
  };
  // pas de la trame dans la matière : `pas` px pour une face de face au cadrage final, arrondi pour tomber sur un nombre
  // entier de pixels en vue de dessus (toutes les lignes du plan ont la même épaisseur) ; fixé par taille (il ne glisse jamais)
  let lay = null;
  const pasMM = (W, H) => {
    if (lay && lay.W === W && lay.H === H) return lay.p;
    const B1 = geoB.B1, s1 = Math.min((W * (1 - 2 * pad)) / (B1[2] - B1[0]), (H * (1 - 2 * pad)) / (B1[3] - B1[1]));
    // une barre vue en enfilade passe très près de l'œil : le pas se règle alors sur son bout le plus proche (4 px au plus),
    // sinon ses lignes y deviennent des bandes ; au loin, elles se fondent d'elles-mêmes en ton
    const camF = camK(1, geoB.zMax), foF = fold(pv, 1); let zMin = Infinity;
    for (const F of part.faces) { const M = foF.M.get(F.id); if (M) for (const q of F.loop) zMin = Math.min(zMin, dot(sub(apply(M, [q[0], q[1], 0]), camF.eye), camF.f)); }
    const e1 = Math.max((s1 * KCAM) / D, (s1 * KCAM) / Math.max(zMin, D * 0.05) / PAS_PROCHE), dpr = Math.min(2, window.devicePixelRatio || 1);
    // l'échelle du plan (px par mm) et la position d'une ligne à l'écran, lues sur la vue de dessus de la chronologie
    const g0 = geo; geo = geoB; const vu0 = vu; vu = 0; const v0 = vueA(0, W, H); vu = vu0; geo = g0;
    const zt = geoB.t / 2, c0 = projV(v0, v0.cam, [ctr[0], ctr[1], zt]), c1 = projV(v0, v0.cam, grainY ? [ctr[0] + 100, ctr[1], zt] : [ctr[0], ctr[1] + 100, zt]);
    const ax = grainY ? 0 : 1, e0 = Math.abs(c1[ax] - c0[ax]) / 100, sg = Math.sign(c1[ax] - c0[ax]) || 1;
    const n = Math.max(2, Math.round((pas * dpr * e0) / e1)), p = n / (dpr * e0);
    // phase : le milieu d'une ligne tombe au milieu d'un pixel (n impair) ou entre deux (n pair)
    uvOff = 0;
    const vc = grainY ? ctr[0] : ctr[1], cible = n % 2 ? 0 : 0.5;
    uvOff = (sg * (dpr * c0[ax] - cible)) / (dpr * e0) - vc;
    uvOff = ((uvOff % p) + p) % p;
    lay = { W, H, p, e1 };
    return lay.p;
  };

  // ---------- le dessin vectoriel (SVG, par-dessus) ----------
  // tracés : contours (trait fort), cotes (trait fin, lignes d'attache, pointes, chiffres à 15 px) ; en repli, aussi les lignes de pli
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
  // cote d'angle du pli en cours : un arc entre le fond et la paroi qui se lève, en bout de pli, et la valeur lue par le plieur.
  // Deux jeux d'éléments : la cote d'un pli s'efface pendant que celle du pli suivant apparaît.
  const mkTop = (gp, tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); gp.append(e); return e; };
  const angEls = coteAngle ? [0, 1].map(() => { const gp = document.createElementNS(NS, 'g'); svg.append(gp); gp.style.visibility = 'hidden';
    return { g: gp, arc: mkTop(gp, 'path', { class: 'dvp-cote', fill: 'none' }), plaque: mkTop(gp, 'rect', { class: 'dvp-plaque', rx: 4 }), txt: mkTop(gp, 'text', { class: 'dvp-chiffre', 'text-anchor': 'middle' }) }; }) : null;
  const coteEls = cotes ? [0, 1].map(() => ({ line: mk('path', { class: 'dvp-cote', fill: 'none' }), arrows: mk('path', { class: 'dvp-pointe' }), txt: mk('text', { class: 'dvp-chiffre', 'text-anchor': 'middle' }) })) : [];
  if (cotes) { coteEls[0].txt.textContent = fmtMM(X1 - X0); coteEls[1].txt.textContent = fmtMM(Y1 - Y0); }
  // lignes d'attache : du sommet du contour le plus proche de la cote jusqu'un peu au-delà de sa ligne
  const sommet = (axe, val, vers) => part.outline.filter((p) => Math.abs(p[axe] - val) < 1e-6).reduce((a, b) => ((b[1 - axe] - a[1 - axe]) * vers > 0 ? b : a));

  // ---------- projection ----------
  let view = null; // { s, cx, cy } projection → px CSS
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
  const creux = creuxDe(part);
  const occlF = (p, f) => 1 - 0.42 * creux(p, f);
  const Ln = norm(light);

  // ---------- la peinture : le dépôt de la chronologie, puis les couches posées par setTeinte ----------
  // une couche : { teinte, debut (horloge), ms, mode : 1 = passes du pistolet, 2 = retirée d'un geste }
  let couchesUI = [], horloge = 0, depotFini = false;
  const avance = (c) => seg(horloge - c.debut, 0, c.ms);
  const progDe = (mode, u) => (mode === 2 ? EASE.appui(u) : NPASSES * EASE.rideau(u));
  function couchesA(ms) {
    const out = [{ teinte: null, mode: 0, prog: 0, u: 1 }];
    if (teinteC) {
      if (T.paint[1] > T.paint[0] && !depotFini) { const u = seg(ms, T.paint[0], T.paint[1]); if (u > 0) out.push(u >= 1 ? { teinte: teinteC, mode: 0, prog: 0, u: 1 } : { teinte: teinteC, mode: 1, prog: progDe(1, u), u }); }
      else if (depotFini || ms >= T.paint[0]) out.push({ teinte: teinteC, mode: 0, prog: 0, u: 1 });
    }
    for (const c of couchesUI) { const u = avance(c); out.push({ teinte: c.teinte, mode: c.mode, prog: progDe(c.mode, u), u, de: c.de, mel: c.de === undefined ? 1 : seg(horloge - c.retint, 0, PR.approche.ms) }); }
    return out;
  }
  // une couche entièrement déposée recouvre tout ce qui est dessous : elle devient la teinte de la pièce
  function finirCouches(toutes = false) {
    while (couchesUI.length && (toutes || avance(couchesUI[0]) >= 1)) {
      const c = couchesUI.shift(); teinteC = c.teinte; depotFini = true; if (grav) grav.setTeinte(teinteC);
    }
  }

  // ---------- le dessin au sol (sous la tôle), en GL ----------
  let mSol = null;
  if (tr) {
    const zP = -part.t / 2 - 0.5, segs = [];
    for (const pl of loops) for (let i = 0; i < pl.length; i++) { const a = pl[i], b = pl[(i + 1) % pl.length]; segs.push([[a[0], a[1], zP], [b[0], b[1], zP], 1.5, 0, 0, fantome]); }
    mSol = tr.maille([{ pts: [], uv: [], ton: 0, aretes: segs, n: [0, 0, 0] }]);
  }

  // ---------- dessin d'une image ----------
  let t = rm ? T.end : 0, playing = false, dead = false, dtImg = 0;
  function drawGL(ms, W, H) {
    const pM = pasMM(W, H); // fixe aussi la phase de la trame (uvOff), avant toute écriture de face
    const v = vueA(ms, W, H); view = v;
    const { f, cam } = v;
    const fo = fold(pv, (i) => f[i]), polys = mesh(pv, fo);
    let prev = null;
    if (dtImg > 0) { const v2 = vueA(ms - H_VIT, W, H), p2 = mesh(pv, fold(pv, (i) => v2.f[i])); if (p2.length === polys.length) prev = { v: v2, polys: p2 }; }
    tr.begin({ W, H, cam, persp: true, nf: [Math.max(1, D - RAY * 1.6), D + RAY * 1.6], s: v.s, cx: v.cx, cy: v.cy, pas: pM, dt: dtImg, vitEcran: true,
      couches: couchesA(ms), depot: { ...PASSES, v0: PASSES.v0 + uvOff }, grain: [POUDRE.grain / lay.e1, POUDRE.nuage / lay.e1, POUDRE.mordant] });
    tr.instance(mSol, [0, 0, 0]);
    const vits = prev ? (p, i) => {
      const q = prev.polys[i];
      if (q.kind !== p.kind || q.pts.length !== p.pts.length || (q.holes || []).length !== (p.holes || []).length) return null;
      const vel = (a, b) => { const A = projV(v, v.cam, a), B = projV(prev.v, prev.v.cam, b); return [(A[0] - B[0]) / H_VIT, (A[1] - B[1]) / H_VIT]; };
      const out = p.pts.map((a, j) => vel(a, q.pts[j]));
      (p.holes || []).forEach((Hh, j) => Hh.forEach((a, c) => out.push(vel(a, q.holes[j][c]))));
      return out;
    } : null;
    tracerPiece(tr, part, fo, polys, { cam, f, creux, Ln, amb, encre, gammaTon, arete, cle: `d${id}`, uvDe, vits });
    // les traits de pli sur la tôle : trait mixte sur liseré papier, effacés quand la presse prend le pli
    for (const hg of fo.hinges) {
      const bi = part.bends.findIndex((bd) => bd.a === hg.a && bd.b === hg.b); if (bi < 0) continue;
      const al = 1 - lisse(0, 0.1, f[bi]); if (al <= 0.003) continue;
      const z = pv.t / 2 + 0.2, A = apply(hg.Mp, [hg.a[0], hg.a[1], z]), B = apply(hg.Mp, [hg.b[0], hg.b[1], z]);
      const nz = apply(hg.Mp, [0, 0, 1]), o0 = apply(hg.Mp, [0, 0, 0]), nn = sub(nz, o0);
      tr.arete(A, B, 3.5, 2, nn, 30, 0, al); tr.arete(A, B, 1.25, 0, nn, 30, 1, al);
    }
    tr.end();
    v.fo = fo;
    return v;
  }
  function draw2d(ms, W, H) {
    const v = vueA(ms, W, H); view = v;
    const { k, f, cam } = v, s = v.s;
    // la pièce : tons en niveaux de gris (ombrage de part.js), encre ∝ ombre ; la teinte passe derrière le rideau
    const fo = fold(pv, (i) => f[i]);
    const meshNow = mesh(pv, fo);
    const polys = render(meshNow, cam, { size: s, cx: v.cx, cy: v.cy, color: [255, 255, 255], ink: [0, 0, 0], amb, light, paths: false });
    // repli : la couche du dessus avance en rideau (la trame d'écran ne connaît pas la matière)
    const cs = couchesA(ms), top = cs[cs.length - 1], sous = cs.length > 1 ? cs[cs.length - 2] : cs[0];
    if (top.mode) grav.setTeinte(top.teinte || sous.teinte); else grav.setTeinte(top.teinte);
    const xf = EASE.rideau(top.u) * (W + 40) - 20;
    // l'état de la pièce : peinte, nue, en cours de dépôt (la teinte à gauche du front) ou de retrait (la tôle nue à gauche)
    const etat = !top.mode ? (top.teinte ? 'peinte' : 'nue') : top.teinte ? 'depot' : sous.teinte ? 'retrait' : 'nue';
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
      fill(etat === 'peinte' || etat === 'retrait' ? 1 : 0);
      if ((etat === 'depot' || etat === 'retrait') && xf > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, xf, H); ctx.clip(); fill(etat === 'depot' ? 1 : 0); ctx.restore(); }
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
  // profondeur utile (mm) : une sphère autour du développé et de la pièce pliée
  let RAY = Math.hypot(X1 - X0, Y1 - Y0) / 2 + geoA.zMax + 50;

  // la cote d'angle : en bout de pli (le bout le plus proche de l'œil dans la pose finale), valeur posée hors de la pièce
  const boutDe = new Map();
  function boutPli(st, W, H) {
    const cle = `${st.bend}:${W}x${H}`; if (boutDe.has(cle)) return boutDe.get(cle);
    const bd = part.bends[st.bend], camF = camK(1, geoB.zMax);
    const da = dot(sub([bd.a[0], bd.a[1], 0], camF.eye), camF.f), db = dot(sub([bd.b[0], bd.b[1], 0], camF.eye), camF.f);
    const r = da <= db ? 0 : 1; boutDe.set(cle, r); return r;
  }
  function dessinerAngles(ms, v, W, H) {
    const tau = ms - T.fold[0], MI = MOTION.micro.ms, cam = v.cam;
    const vus = [false, false];
    g.strokes.forEach((st, si) => {
      const E = angEls[si % 2], fin = st.sur ? st.t3 + 80 : st.t1 + PR.maintien.ms;
      if (tau < st.t0 || tau >= fin || Math.abs(part.bends[st.bend].angle) >= 170) return;
      const opa = Math.min(lisse(st.t0, st.t0 + MI, tau), 1 - lisse(fin - MI, fin, tau)) * (1 - lisse(0, 0.25, vu));
      const bd = part.bends[st.bend], hg = v.fo.hinges.find((h) => h.a === bd.a && h.b === bd.b);
      if (!hg || opa <= 0.002) return;
      const b = boutPli(st, W, H), o2 = b ? bd.b : bd.a, autre = b ? bd.a : bd.b;
      const dx = bd.b[0] - bd.a[0], dy = bd.b[1] - bd.a[1], L2 = Math.hypot(dx, dy), n = [-dy / L2, dx / L2];
      const m2 = [(bd.a[0] + bd.b[0]) / 2, (bd.a[1] + bd.b[1]) / 2];
      const pc = part.faces[hg.parent].loop.reduce((a, q) => [a[0] + q[0], a[1] + q[1]], [0, 0]).map((q) => q / part.faces[hg.parent].loop.length);
      const sgn = (pc[0] - m2[0]) * n[0] + (pc[1] - m2[1]) * n[1] > 0 ? 1 : -1;
      const Mp = v.fo.M.get(hg.parent), Mc = v.fo.M.get(hg.child), z = Math.sign(bd.angle) * pv.t / 2;
      const O = apply(Mp, [o2[0], o2[1], z]);
      // rayon de l'arc : une vingtaine de pixels à l'écran, là où il est tracé
      const ePx = (v.s * cam.k) / dot(sub(O, cam.eye), cam.f), Rr = (W < 420 ? 15 : 22) / ePx;
      const A = apply(Mp, [o2[0] + sgn * n[0] * Rr, o2[1] + sgn * n[1] * Rr, z]), B = apply(Mc, [o2[0] - sgn * n[0] * Rr, o2[1] - sgn * n[1] * Rr, z]);
      const va = sub(A, O), vb = sub(B, O);
      const om = Math.acos(clamp(dot(va, vb) / (Rr * Rr), -1, 1));
      const pts = [];
      for (let i = 0; i <= 16; i++) { const tt = i / 16, s0 = Math.sin((1 - tt) * om) / Math.sin(om || 1e-6), s1 = Math.sin(tt * om) / Math.sin(om || 1e-6); pts.push(proj(cam, [O[0] + va[0] * s0 + vb[0] * s1, O[1] + va[1] * s0 + vb[1] * s1, O[2] + va[2] * s0 + vb[2] * s1])); }
      const pO = proj(cam, O), pA = proj(cam, A), pB = proj(cam, B);
      E.arc.setAttribute('d', `M${pA[0].toFixed(1)},${pA[1].toFixed(1)}L${pO[0].toFixed(1)},${pO[1].toFixed(1)}L${pB[0].toFixed(1)},${pB[1].toFixed(1)}M` + pts.map((q) => q.map((w) => w.toFixed(1)).join(',')).join('L'));
      const val = Math.round((om * 180) / Math.PI), txt = `${val}°`; E.txt.textContent = txt;
      // la valeur : dans le prolongement du pli, hors de la pièce (direction fixe pendant le coup : celle du pli à l'écran)
      const pAutre = proj(cam, apply(Mp, [autre[0], autre[1], z]));
      let ux = pO[0] - pAutre[0], uy = pO[1] - pAutre[1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      const tw = 15 * 0.62 * 4 + 12, th = 24, ecart = (W < 420 ? 15 : 22) + 6;
      let lx = pO[0] + ux * (ecart + tw / 2 * Math.abs(ux) + th / 2 * Math.abs(uy)), ly = pO[1] + uy * (ecart + tw / 2 * Math.abs(ux) + th / 2 * Math.abs(uy));
      lx = clamp(lx, tw / 2 + 3, W - tw / 2 - 3); ly = clamp(ly, th / 2 + 3, H - th / 2 - 3);
      if (lx > W - tw / 2 - 52 && ly > H - th / 2 - 52) ly = H - th / 2 - 54; // la place du bouton « Rejouer »
      E.plaque.setAttribute('x', (lx - tw / 2).toFixed(1)); E.plaque.setAttribute('y', (ly - th / 2).toFixed(1)); E.plaque.setAttribute('width', tw.toFixed(1)); E.plaque.setAttribute('height', th);
      E.txt.setAttribute('x', lx.toFixed(1)); E.txt.setAttribute('y', (ly + 5.4).toFixed(1));
      E.g.style.opacity = String(opa); E.g.style.visibility = 'visible'; vus[si % 2] = true;
    });
    angEls.forEach((E, j) => { if (!vus[j]) E.g.style.visibility = 'hidden'; });
  }

  function draw(ms) {
    const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return false;
    if (svg.dataset.wh !== `${W}x${H}`) { svg.dataset.wh = `${W}x${H}`; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H); }
    geo = melGeo(); pv.t = geo.t;
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
      // cotes hors tout, posées sur le papier à 22 px du contour (dessous et à droite), avec leurs lignes d'attache ;
      // elles s'effacent au départ de la bascule (COTES_MS), avant que la perspective les déforme
      const opc = (1 - lisse(T.tilt[0], T.tilt[0] + COTES_MS, ms)) * (vu > 0 ? 0 : 1);
      for (const E of coteEls) for (const el2 of [E.line, E.arrows, E.txt]) { el2.style.opacity = String(opc); el2.style.visibility = opc > 0.002 ? '' : 'hidden'; }
      if (opc > 0.002) {
        const mmPx = 1 / (s * (cam.k / D)), off = 22 * mmPx, ar = 8, jeu = 3 * mmPx, depasse = 5 * mmPx;
        const a = proj(cam, [X0, Y0 - off, 0]), bb = proj(cam, [X1, Y0 - off, 0]), c = proj(cam, [X1 + off, Y0, 0]), d = proj(cam, [X1 + off, Y1, 0]);
        const L = (p, q) => `M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}`;
        const cote = (E, p, q, txtAt, rot, attaches) => {
          const ang = Math.atan2(q[1] - p[1], q[0] - p[0]), ux = Math.cos(ang), uy = Math.sin(ang);
          E.line.setAttribute('d', L(p, q) + attaches);
          const tip = (P, sgn) => `M${P[0].toFixed(1)},${P[1].toFixed(1)}l${(sgn * ux * ar - uy * 2.5).toFixed(1)},${(sgn * uy * ar + ux * 2.5).toFixed(1)}l${(uy * 5).toFixed(1)},${(-ux * 5).toFixed(1)}Z`;
          E.arrows.setAttribute('d', tip(p, 1) + tip(q, -1));
          E.txt.setAttribute('x', txtAt[0].toFixed(1)); E.txt.setAttribute('y', txtAt[1].toFixed(1));
          E.txt.setAttribute('transform', rot ? `rotate(-90 ${txtAt[0].toFixed(1)} ${txtAt[1].toFixed(1)})` : '');
        };
        const sx0 = sommet(0, X0, -1), sx1 = sommet(0, X1, -1), sy0 = sommet(1, Y0, 1), sy1 = sommet(1, Y1, 1);
        const att = (p0, p1) => L(proj(cam, [p0[0], p0[1], 0]), proj(cam, [p1[0], p1[1], 0]));
        cote(coteEls[0], a, bb, [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2 + 20], false,
          att([X0, sx0[1] - jeu], [X0, Y0 - off - depasse]) + att([X1, sx1[1] - jeu], [X1, Y0 - off - depasse]));
        cote(coteEls[1], c, d, [(c[0] + d[0]) / 2 + 20, (c[1] + d[1]) / 2], true,
          att([sy0[0] + jeu, Y0], [X1 + off + depasse, Y0]) + att([sy1[0] + jeu, Y1], [X1 + off + depasse, Y1]));
      }
    }
    if (angEls) dessinerAngles(ms, v, W, H);
    onFrame && onFrame({ ms, k, f: v.f, T, plat: vu, phase: ms < T.tilt[0] ? (laser ? 'coupe' : 'plan') : ms < T.fold[0] ? 'bascule' : ms < T.fold[1] ? 'pli' : ms < T.paint[0] ? 'plie' : ms < T.paint[1] ? 'peinture' : 'fin' });
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
    fonduSuivi(wrap, ms);
  }

  const mouvant = () => playing || couchesUI.length > 0 || vu !== vuCible || epU < 1;
  const tk = ticker((dt) => {
    if (dead) return false;
    horloge += dt;
    if (playing) { t = Math.min(T.end, t + dt); dtImg = dt; } else dtImg = 0;
    if (vu !== vuCible) { const d = dt / VUE_MS; vu = vuCible > vu ? Math.min(vuCible, vu + d) : Math.max(vuCible, vu - d); }
    if (epU < 1) epU = Math.min(1, epU + dt / PR.approche.ms);
    finirCouches();
    if (playing && t >= T.end) { playing = false; dtImg = 0; }
    if (!draw(t)) return true;
    return mouvant();
  }, { el: host, margin: '0px' });
  const api = {
    T, grav,
    get moteur() { return tr ? tr.mode : 'repli'; },
    play() {
      if (rm) { t = T.end; api.redraw(); return; }
      if (t > 0) fondu();
      finirCouches(true); depotFini = false;
      // la teinte a pu changer depuis le dernier passage : le dépôt entre dans la chronologie ou en sort
      if ((T.paint[1] > T.paint[0]) !== !!teinteC) { timeline(0.4); geoA = geoB = geoDe(geoB.t); epU = 1; lay = null; }
      t = 0; dtImg = 0; playing = true; api.redraw(); tk.start();
    },
    stop() { if (playing) fondu(); playing = false; finirCouches(true); t = T.end; dtImg = 0; api.redraw(); if (!mouvant()) tk.stop(); },
    // dt : durée d'image simulée (banc d'essai du flou de bougé)
    seek(ms, dt = 0) { tk.stop(); playing = false; finirCouches(true); depotFini = false; vu = vuCible; epU = 1; t = clamp(ms, 0, T.end); dtImg = dt; api.redraw(); dtImg = 0; },
    // nouvelle teinte : avant le dépôt de la chronologie, c'est lui qui l'apportera ; pendant ou après, une couche de plus se
    // dépose par passes (une teinte) ou se retire d'un geste (null : sans peinture)
    setTeinte(hex) {
      const avant = t < T.paint[0] && !depotFini && !couchesUI.length;
      if (rm || avant || !host.clientWidth) {
        couchesUI = []; teinteC = hex; if (grav) grav.setTeinte(hex);
        if (avant && !rm && (T.paint[1] > T.paint[0]) !== !!hex) { timeline(0.4); geoA = geoB = geoDe(geoB.t); lay = null; } // le dépôt apparaît ou disparaît de la chronologie
        if (rm) { t = T.end; depotFini = true; }
        if (!playing) api.redraw();
        return;
      }
      if (hex === (couchesUI.length ? couchesUI[couchesUI.length - 1].teinte : teinteC)) return;
      // le dépôt de la chronologie en cours devient une couche comme les autres (elle finit de se déposer dessous)
      if (!depotFini && t < T.paint[1] && T.paint[1] > T.paint[0]) { couchesUI.push({ teinte: teinteC, debut: horloge - (t - T.paint[0]), ms: dureePoudre, mode: 1 }); teinteC = null; depotFini = true; }
      // des clics rapprochés : la couche qui commence à peine à se déposer prend la nouvelle teinte (fondu court) au lieu d'en
      // recevoir une autre par-dessus ; au-delà, une couche de plus (cinq en cours au plus, la plus ancienne se ferme)
      const der = couchesUI[couchesUI.length - 1];
      if (hex && der && der.mode === 1 && der.teinte && avance(der) < 0.35) { const mel = der.de === undefined ? 1 : seg(horloge - der.retint, 0, PR.approche.ms); der.de = mel >= 1 ? der.teinte : { a: der.de, b: der.teinte, m: mel }; der.teinte = hex; der.retint = horloge; tk.start(); return; }
      couchesUI.push(hex ? { teinte: hex, debut: horloge, ms: dureePoudre * POUDRE.change, mode: 1 } : { teinte: null, debut: horloge, ms: PR.retour.ms, mode: 2 });
      if (couchesUI.length > 5) { const c = couchesUI.shift(); teinteC = c.teinte; depotFini = true; }
      tk.start();
    },
    // « plat » : la pièce se déplie sous une caméra verticale, sur le tracé du plan (cible : { echelle, cx, cy, rot }) ; « plie » : retour
    setVue(nom, cible = null, { direct = false } = {}) {
      if (cible) plan = cible;
      vuCible = nom === 'plat' && plan ? 1 : 0; vuMs = Math.round(t);
      if (rm || direct || !host.clientWidth) { vu = vuCible; if (!playing) api.redraw(); return; }
      if (vu !== vuCible) tk.start();
    },
    get vue() { return vu; },
    // l'épaisseur de la tôle s'interpole (les chants épaississent, le cadre suit) : jamais de vue remontée
    setEpaisseur(e) {
      if (e === geoB.t) return;
      const ici = melGeo(); geoA = { ...ici }; geoB = geoDe(e); epU = rm || !host.clientWidth ? 1 : 0;
      RAY = Math.hypot(X1 - X0, Y1 - Y0) / 2 + Math.max(geoA.zMax, geoB.zMax) + 50;
      if (epU < 1) tk.start(); else if (!playing) api.redraw();
    },
    redraw() { if (!dead && !draw(t)) requestAnimationFrame(() => { if (!dead && host.isConnected) draw(t); }); },
    get playing() { return playing; }, get t() { return t; }, get mouvant() { return mouvant(); },
    // remplacer la pièce : l'image en cours s'efface au-dessus de la suivante, puis la scène se retire
    sortie() { fondu(); api.destroy(); canvas.remove(); svg.remove(); if (ink) ink.remove(); },
    destroy() { if (dead) return; dead = true; tk.destroy(); ro.disconnect(); tr ? tr.destroy() : grav.destroy(); },
  };
  const ro = new ResizeObserver(() => { if (!playing) api.redraw(); });
  ro.observe(host);
  if (autoplay && !rm) api.play(); else api.redraw();
  return api;
}

// ---------- vignettes : les pièces d'exemple gravées par le même moteur (images fixes, nettes au pixel de l'écran) ----------
// Une barre de 3 m ne se lit pas dans 52 px : la vignette d'un profil en montre un tronçon, la section vers l'œil.
function troncon(part) {
  const xs = part.outline.map((p) => p[0]), ys = part.outline.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  if (h < w * 2.2 || (part.holes && part.holes.length)) return part;
  const y0 = Math.min(...ys), k = (w * 1.25) / h, sc = (p) => [p[0], y0 + (p[1] - y0) * k];
  return makePart({ ...part, outline: part.outline.map(sc), holes: [], bends: part.bends.map((b) => ({ ...b, a: sc(b.a), b: sc(b.b) })), base: part.base ? sc(part.base) : undefined });
}
// liste : [{ canvas, part, teinte }] ; chaque canvas est rempli à sa taille CSS × dpr. Renvoie false sans WebGL2.
// Le pas de la trame et l'épaisseur des arêtes se règlent en pixels physiques : quatre pixels au moins entre deux lignes (en
// dessous, des lignes obliques se changent en damier sur un écran à 1×), une arête d'un pixel et demi environ.
export function vignettes(liste, { couleurs, dpr = Math.min(3, window.devicePixelRatio || 1), pas = Math.max(2.5, 4 / dpr), arete = Math.max(0.8, 1 / dpr), aplat = 0.85, ep = [0.16, 0.9], az = -128, el = 30, fov = 24, dist = 2.6, marge = 3.5, amb = 0.22, light = [-0.85, -0.3, 0.5] } = {}) {
  const cv = document.createElement('canvas'), tr = createTrace(cv, { couleurs, aplat, ep, dprMax: 3 });
  if (!tr) return false;
  const Ln = norm(light), id = ++NUM;
  liste.forEach(({ canvas, part, teinte = null }, n) => {
    const W = canvas.clientWidth || parseFloat(canvas.style.width) || 52, H = canvas.clientHeight || parseFloat(canvas.style.height) || 44;
    const p = troncon(part), fo = fold(p, 1), polys = mesh(p, fo), f = p.bends.map(() => 1);
    const pts = polys.flatMap((q) => q.pts), mn = [0, 1, 2].map((i) => Math.min(...pts.map((q) => q[i]))), mx = [0, 1, 2].map((i) => Math.max(...pts.map((q) => q[i])));
    const c = mn.map((v, i) => (v + mx[i]) / 2), Dg = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) * dist;
    const ar = (az * Math.PI) / 180, er = (el * Math.PI) / 180;
    const cam = camera({ eye: [c[0] + Dg * Math.cos(er) * Math.cos(ar), c[1] + Dg * Math.cos(er) * Math.sin(ar), c[2] + Dg * Math.sin(er)], target: c, fov });
    const pr = (q) => { const d = sub(q, cam.eye), z = dot(d, cam.f); return [(dot(d, cam.r) * cam.k) / z, (-dot(d, cam.u) * cam.k) / z]; };
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const q of pts) { const s2 = pr(q); b = [Math.min(b[0], s2[0]), Math.min(b[1], s2[1]), Math.max(b[2], s2[0]), Math.max(b[3], s2[1])]; }
    const s = Math.min((W - 2 * marge) / (b[2] - b[0]), (H - 2 * marge) / (b[3] - b[1]));
    // centre calé sur le demi-pixel physique : les arêtes d'aplomb restent nettes
    const cale = (v) => Math.round(v * dpr) / dpr;
    const cx = cale(W / 2 - ((b[0] + b[2]) / 2) * s), cy = cale(H / 2 - ((b[1] + b[3]) / 2) * s);
    const xs = p.outline.map((q) => q[0]), ys = p.outline.map((q) => q[1]);
    const gY = (Math.max(...ys) - Math.min(...ys)) > (Math.max(...xs) - Math.min(...xs)) * 1.15, uvDe = gY ? (q) => [q[1], q[0]] : (q) => [q[0], q[1]];
    const R = Dg / dist;
    tr.begin({ W, H, dpr, cam, persp: true, nf: [Math.max(1, Dg - R * 1.6), Dg + R * 1.6], s, cx, cy, pas: pas / ((s * cam.k) / Dg), dt: 0, vitEcran: true, couches: [{ teinte, mode: 0 }] });
    tracerPiece(tr, p, fo, polys, { cam, f, creux: creuxDe(p), Ln, amb, encre: true, gammaTon: 1, arete, cle: `v${id}-${n}`, uvDe, trouMin: 7 / ((s * cam.k) / Dg) });
    tr.end();
    canvas.width = cv.width; canvas.height = cv.height;
    canvas.getContext('2d').drawImage(cv, 0, 0);
  });
  tr.destroy();
  return true;
}
