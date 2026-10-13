// Ourlet · le film des quatre postes (itération 5, refonte ; v7 : la ligne de thermolaquage) : la pièce fil rouge, la
// jardinière 8800-J, traverse la découpe, le pliage, la soudure et la peinture, en un plan-séquence calculé en code, gravé en
// trame de lignes.
//
// v7, la peinture refaite comme une vraie ligne de poudrage automatique (références : les cabines de poudrage à élévateurs
// des lignes de thermolaquage industrielles, pistolets corona sur réciprocateurs, détection de pièce qui déclenche la
// pulvérisation ; l'enveloppement électrostatique, « wrap-around », qui fait passer la poudre derrière les bords ; l'effet
// de cage de Faraday, qui poudre moins les faces intérieures ; le four tunnel à lanières) :
// - la pièce entre dans une cabine ouverte côté caméra (écorché de notice : paroi du fond, toit, paroi d'entrée percée) ;
// - deux élévateurs, devant et derrière, portent chacun deux pistolets ; ils montent et descendent à vitesse constante,
//   retournements arrondis, sans arrêt ; les pistolets ne soufflent que quand la pièce passe devant eux ;
// - la poudre : un nuage de grains fins qui part des buses, ralentit, se pose sur la face ou contourne les bords ;
// - le dépôt : chaque point de la matière fonce selon son exposition cumulée aux pistolets (shader, trace-gl-v7), sans
//   front net ; les faces intérieures prennent moins de poudre ;
// - puis la pièce passe sous les lanières du four tunnel.
//
// Références étudiées : les films produit de Teenage Engineering (économie de moyens, un seul mouvement de caméra, un rythme
// réglé sur l'objet) ; les vues des notices techniques (un objet, son outil, rien d'autre) ; les vidéos de procédé des
// fabricants de machines, pour la justesse des gestes seulement (aucun nom dans la page) ; la photogravure en trame de lignes ;
// pour la facture, les rendus « dessin au trait » des films de marque (trame attachée à la matière, flou de bougé, arêtes vues).
//
// La mise en scène :
// - un seul travelling latéral, à vitesse constante (MOTION.camera.travelling) ; caméra axonométrique (projection parallèle),
//   trois quarts, plongée ; la chaîne de peinture avance à la même vitesse ;
// - le monde est périodique : chaque poste est là où se trouve la caméra quand la pièce y arrive ; une nouvelle tôle attend
//   sur la palette du laser une période plus loin. La dernière image d'un cycle est la première du suivant ;
// - la presse de 3 m porte deux postes d'outillage : un poinçon de 800 mm pour les grandes parois, un segment de 294 mm pour
//   les petites, réglé entre les parois déjà levées ; la pièce glisse de l'un à l'autre ;
// - la pièce reste brute jusqu'au rideau de poudre, qui apporte la seule couleur du film (la teinte du client) ;
// - de chaque machine, seul l'outil actif, et ses appuis : la tête du laser sur sa palette ; poinçons, matrice et butées ;
//   deux torches sur leur table ; le pistolet, le convoyeur et la bouche du four. Ni machine entière, ni opérateur, ni lueur.
//   Un outil qui ne travaille pas sort du cadre par son propre chemin (le tablier monte, les torches reculent dans leur axe).
// Les gestes : découpe, les trous d'abord, le contour en dernier, à vitesse de coupe avec mise en vitesse et ralenti dans les
// angles ; le squelette reste sur la palette ; pliage, dans l'ordre de la gamme, retour élastique (92° sous charge, 90° quand le
// poinçon remonte), butées au contact puis reculées ; soudure, deux passes, des écailles bombées vers l'arrière ; peinture, une
// poudre qui enveloppe les bords. Tout départ se fait à vitesse nulle, toute arrivée aussi, sauf l'accrochage à la chaîne qui
// se fait à la vitesse de la chaîne. Durées et courbes : uniquement MOTION (composées entre elles pour les départs arrêtés).
// Aucun texte n'est peint dans le canvas : la ligne de valeurs est du HTML (onValeurs).
import { fold, mesh, render, camera, makePart } from './part.js';
import { jardiniere } from './pieces.js';
import { createGravure, tonPack } from './gravure.js';
import { createTrace } from './trace-gl-v8.js';
import { MOTION, EASE, ticker, prefersReduced } from './motion.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => (b > a ? clamp((t - a) / (b - a)) : t >= b ? 1 : 0);
const lerp = (a, b, k) => a + (b - a) * k;
const wrapA = (d) => ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const lisse = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const REF = 0.36; // px CSS par mm dans le cadrage de référence (1 440 px) : convertit les vitesses d'écran des tokens
const vmm = (pxs) => pxs / REF / 1000; // px/s → mm/ms
const PR = MOTION.presse;
const V = { coupe: vmm(MOTION.laser.coupe.v), vide: vmm(MOTION.laser.vide.v), transfert: vmm(MOTION.convoyeur.v), camera: vmm(MOTION.camera.travelling) };
// départ arrêté : la courbe de MOTION, précédée d'une mise en vitesse tirée de la courbe d'appui (aucun démarrage à pleine vitesse)
const doux = (ease) => (x) => ease((1 - x) * EASE.appui(x) + x * x);
const APP = doux(EASE.approche), RET = doux(EASE.retour);
// raccord d'Hermite : de p0 (vitesse m0) à p1 (vitesse m1), vitesses exprimées sur la durée du raccord
const hermite = (p0, m0, p1, m1, u) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mulS = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const newell = (P) => { let x = 0, y = 0, z = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); } return norm([x, y, z]); };

// ---------- géométrie : boîtes, prismes et cylindres (normales sortantes) ----------
const quad = (a, b, c, d, meta) => ({ kind: 'face', pts: [a, b, c, d], meta });
function box(x0, x1, y0, y1, z0, z1, meta) {
  return [
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], { ...meta, u: [1, 0, 0] }),
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], { ...meta, u: [1, 0, 0] }),
    quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], { ...meta, u: [1, 0, 0] }),
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], { ...meta, u: [0, 0, 1] }),
    quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], { ...meta, u: [0, 0, 1] }),
  ];
}
function prismX(prof, x0, x1, meta) { // un profil [[y, z], …] extrudé le long de x
  let a = 0; for (let i = 0; i < prof.length; i++) { const [y0, z0] = prof[i], [y1, z1] = prof[(i + 1) % prof.length]; a += y0 * z1 - y1 * z0; }
  const pr = a > 0 ? prof.slice().reverse() : prof; // sens horaire dans (y, z) : faces latérales sortantes
  const out = [{ kind: 'face', pts: pr.map(([y, z]) => [x0, y, z]), meta: { ...meta, u: [0, 0, 1] } }, { kind: 'face', pts: pr.map(([y, z]) => [x1, y, z]).reverse(), meta: { ...meta, u: [0, 0, 1] } }];
  for (let i = 0; i < pr.length; i++) { const [y0, z0] = pr[i], [y1, z1] = pr[(i + 1) % pr.length]; out.push(quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], { ...meta, u: [1, 0, 0] })); }
  return out;
}
// cylindre : facettes et deux disques ; trame en anneaux (le tournage), arêtes de facettes tracées seulement en silhouette
function cyl(p0, p1, r, meta, vue, n = 16) {
  const d = sub(p1, p0), L = Math.hypot(...d), w = mulS(d, 1 / L);
  const a = Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(w, a)), v = cross(w, u);
  const ring = (c) => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return add(c, add(mulS(u, r * Math.cos(t)), mulS(v, r * Math.sin(t)))); });
  const A = ring(p0), B = ring(p1);
  const face = Array.from({ length: n }, (_, i) => { const t = ((i + 0.5) / n) * Math.PI * 2; return dot(add(mulS(u, Math.cos(t)), mulS(v, Math.sin(t))), vue) < 0; });
  const out = [{ kind: 'face', pts: A.slice().reverse(), meta: { ...meta, u: [...u] }, n: mulS(w, -1) }, { kind: 'face', pts: B, meta: { ...meta, u: [...u] }, n: w }];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, k = (i + n - 1) % n, s0 = (i / n) * Math.PI * 2 * r, s1 = ((i + 1) / n) * Math.PI * 2 * r;
    out.push({ kind: 'face', pts: [A[i], A[j], B[j], B[i]], uv: [[s0, 0], [s1, 0], [s1, L], [s0, L]], meta: { ...meta, u: [...w] },
      aretes: [face[i], face[i] && !face[j], face[i], face[i] && !face[k]] });
  }
  return out;
}
const moved = (polys, dx, dy = 0, dz = 0) => polys.map((p) => ({ ...p, pts: p.pts.map((q) => [q[0] + dx, q[1] + dy, q[2] + dz]), holes: p.holes ? p.holes.map((H) => H.map((q) => [q[0] + dx, q[1] + dy, q[2] + dz])) : undefined }));
function clipX(pts, xc, sup) { // la partie d'un polygone 3D au-delà (sup) ou en deçà du plan x = xc (repli 2D)
  const inside = (q) => (sup ? q[0] >= xc : q[0] < xc), out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const k = (xc - a[0]) / (b[0] - a[0]); out.push([xc, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]); }
  }
  return out;
}

// ---------- la découpe : vitesse le long du tracé, mise en vitesse au départ et ralenti dans les angles ----------
// pts : boucle fermée ; vmax en mm/ms ; acc en mm/ms². Renvoie la durée et la position à un instant (tracé parcouru, longueur)
function profilCoupe(pts, vmax, acc) {
  const P = [...pts, pts[0]], cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1], ds = 1, n = Math.max(2, Math.ceil(L / ds)) + 1;
  const vl = new Float64Array(n).fill(vmax);
  // vitesse d'angle : pleine en ligne droite, réduite selon la déviation (90° : 40 % de la vitesse de coupe)
  for (let i = 1; i < P.length - 1; i++) {
    const a = [P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]], b = [P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]];
    const th = Math.acos(clamp((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) || 1), -1, 1));
    const k = Math.round((cum[i] / L) * (n - 1)); vl[k] = Math.min(vl[k], vmax * Math.max(0.4, Math.cos(Math.min(th, Math.PI / 2))));
  }
  vl[0] = 0; vl[n - 1] = 0;
  const h = L / (n - 1);
  for (let i = 1; i < n; i++) vl[i] = Math.min(vl[i], Math.sqrt(vl[i - 1] ** 2 + 2 * acc * h));
  for (let i = n - 2; i >= 0; i--) vl[i] = Math.min(vl[i], Math.sqrt(vl[i + 1] ** 2 + 2 * acc * h));
  const ts = new Float64Array(n);
  for (let i = 1; i < n; i++) ts[i] = ts[i - 1] + (2 * h) / Math.max(1e-6, vl[i - 1] + vl[i]);
  const T = ts[n - 1];
  const sA = (t) => { // longueur parcourue au temps t
    if (t <= 0) return 0; if (t >= T) return L;
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
    return (lo + (t - ts[lo]) / (ts[hi] - ts[lo])) * h;
  };
  const point = (s) => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const k = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return { p: [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * k, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * k], i }; };
  return { L, T, sA, point, P };
}

// ---------- la chronologie et le plan de l'atelier (déterministes, sans écran) ----------
export function filmAtelier({ piece = jardiniere } = {}) {
  const full = piece();
  const t = full.t, A = 800, B = 300, Hh = 300, C0 = [A / 2, B / 2];
  const variants = [0, 1, 2, 3].map((n) => makePart({ ...full, holes: full.holes.slice(0, n) }));
  const gam = full.gamme || full.bends.map((_, k) => k);
  const camX = (tm) => V.camera * tm;

  // ----- 1. découpe : programme de la tête (repère du développé) -----
  const SHEET = [-340, 1140, -340, 640], HOME = [1180, 700];
  const ACC = V.coupe / (MOTION.micro.ms * 0.6); // la tête atteint sa vitesse de coupe en 60 % de MOTION.micro (environ 2 g)
  const steps = []; let tt = PR.maintien.ms, pos = HOME;
  const rapid = (to) => { const d = Math.hypot(to[0] - pos[0], to[1] - pos[1]); steps.push({ k: 'vide', t0: tt, t1: tt + Math.max(MOTION.micro.ms, d / V.vide), a: pos, b: to }); tt = steps[steps.length - 1].t1; pos = to; };
  const cutLoop = (pts, idx) => {
    const prof = profilCoupe(pts, V.coupe, ACC);
    rapid(pts[0]);
    steps.push({ k: 'percage', t0: tt, t1: tt + MOTION.laser.percage.ms, at: pts[0], idx }); tt += MOTION.laser.percage.ms;
    steps.push({ k: 'coupe', t0: tt, t1: tt + prof.T, pts, L: prof.L, prof, idx }); tt += prof.T; pos = pts[0];
  };
  [...full.holes.keys()].sort((i, j) => Math.hypot(full.holes[j].meta.cx - HOME[0], full.holes[j].meta.cy - HOME[1]) - Math.hypot(full.holes[i].meta.cx - HOME[0], full.holes[i].meta.cy - HOME[1])).reverse()
    .forEach((i) => cutLoop(full.holes[i], i));
  const ol = full.outline;
  let best = 0, bl = 0; ol.forEach((p, i) => { const q = ol[(i + 1) % ol.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > bl) { bl = l; best = i; } });
  const mid = [(ol[best][0] + ol[(best + 1) % ol.length][0]) / 2, (ol[best][1] + ol[(best + 1) % ol.length][1]) / 2];
  cutLoop([mid, ...ol.slice(best + 1), ...ol.slice(0, best + 1)], 'contour');
  const tCoupe = tt; rapid(HOME);
  const LONG = steps.filter((s) => s.k === 'coupe').reduce((s, x) => s + x.L, 0);
  const holeCut = (i, tau) => { const s = steps.find((x) => x.k === 'coupe' && x.idx === i); return s && tau >= s.t1; };
  const coupe = (tau) => { let L = 0; for (const s of steps) if (s.k === 'coupe') L += tau >= s.t1 ? s.L : tau > s.t0 ? s.prof.sA(tau - s.t0) : 0; return L; };

  // ----- les poses de la presse : le pli sur la ligne de la matrice (y = 0), la paroi derrière (+y) -----
  const poses = gam.map((bi, i) => {
    const bd = full.bends[bi], dx = bd.b[0] - bd.a[0], dy = bd.b[1] - bd.a[1], L = Math.hypot(dx, dy);
    let n = [-dy / L, dx / L];
    const child = full.faces[full.links[bi].faces.find((f) => f !== full.baseId)];
    const cc = child.loop.reduce((s, q) => [s[0] + q[0] / child.loop.length, s[1] + q[1] / child.loop.length], [0, 0]);
    const m = [(bd.a[0] + bd.b[0]) / 2, (bd.a[1] + bd.b[1]) / 2];
    if ((cc[0] - m[0]) * n[0] + (cc[1] - m[1]) * n[1] < 0) n = [-n[0], -n[1]];
    const rz = Math.PI / 2 - Math.atan2(n[1], n[0]);
    const off = [C0[0] - m[0], C0[1] - m[1]];
    return { bi, i, rz, c: [Math.cos(rz) * off[0] - Math.sin(rz) * off[1], Math.sin(rz) * off[0] + Math.cos(rz) * off[1]], L, poste: L > 500 ? 'A' : 'B' };
  });
  const BEAM = 1900; // entre les deux postes d'outillage de la presse de 3 m

  // ----- chronologie de la vie d'une pièce (ms) -----
  const T = { coupe: [0, tCoupe] };
  let k = tt + PR.maintien.ms;
  T.leve = [k, k + PR.approche.ms]; k = T.leve[1];
  const S = { laser: 700 };
  // le chemin de la palette à la presse se règle sur le point d'arrivée : la presse arrive à 650 mm à droite du centre
  const ANC = { presse: 650, soudure: 850, chaine: 0 };
  const dTrans = (dist) => Math.max(PR.approche.ms * 2, Math.abs(dist) / V.transfert);
  let dur = 1600; for (let i = 0; i < 4; i++) { const xA = camX(k + dur) + ANC.presse; dur = dTrans(xA + poses[0].c[0] - S.laser); }
  T.versPresse = [k, k + dur]; k += dur; S.presseA = camX(k) + ANC.presse; S.presseB = S.presseA + BEAM;
  const station = (ps) => (ps.poste === 'A' ? S.presseA : S.presseB);
  T.coups = [];
  poses.forEach((ps, i) => {
    if (i > 0) {
      const prev = poses[i - 1], a = Math.abs(wrapA(ps.rz - prev.rz));
      // l'opérateur retourne la pièce sur place (rotation comptée sur un rayon de 250 mm), ou la glisse au poste suivant
      const dist = Math.hypot(station(ps) + ps.c[0] - station(prev) - prev.c[0], ps.c[1] - prev.c[1]) + a * 250;
      const d2 = dTrans(dist); T.coups.push({ k: 'repos', t0: k, t1: k + d2, from: prev, to: ps }); k += d2;
    }
    const c = { k: 'coup', ps, i, t0: k }; c.app = [k, k + PR.approche.ms]; c.appui = [c.app[1], c.app[1] + PR.appui.ms]; c.maint = [c.appui[1], c.appui[1] + PR.maintien.ms]; c.ret = [c.maint[1], c.maint[1] + PR.retour.ms]; c.t1 = c.ret[1];
    T.coups.push(c); k = c.t1;
  });
  T.presse = [T.versPresse[1], k];
  const last = poses[poses.length - 1];
  dur = 1400; for (let i = 0; i < 4; i++) { const xs = camX(k + dur) + ANC.soudure; dur = dTrans(xs - station(last) - last.c[0]) + Math.abs(wrapA(last.rz)) * 420 / V.transfert * 0.3; }
  T.versSoudure = [k, k + dur]; k += dur; S.soudure = camX(k) + ANC.soudure;
  const PASS = 12 * MOTION.soudure.ecaille; // douze écailles par angle, une par trempage
  T.soudure = [k];
  T.passe1 = [k + PR.approche.ms, k + PR.approche.ms + PASS];
  T.tour = [T.passe1[1] + PR.retour.ms, T.passe1[1] + PR.retour.ms + dTrans(Math.PI * 250)];
  T.passe2 = [T.tour[1] + PR.approche.ms, T.tour[1] + PR.approche.ms + PASS];
  k = T.passe2[1] + PR.retour.ms; T.soudure.push(k);
  dur = 1200; for (let i = 0; i < 4; i++) { const xc = camX(k + dur) + ANC.chaine; dur = dTrans(xc - S.soudure); }
  T.versChaine = [k, k + dur]; k += dur; S.chaine = camX(k) + ANC.chaine;
  // la bouche du four, puis un vide avant la palette suivante ; le four (900 mm) est plus long que la pièce (800 mm)
  // v7 : la cabine (entrée à 460 mm, après la pièce posée), les élévateurs à 850 mm, le four à 1 400 mm (580 mm de tunnel vu) ;
  // la somme four + longueur ne change pas : la période de l'atelier et la durée du cycle restent les mêmes
  const GUN = 850, OVEN = 1400, OVENLEN = 580, ECART = 140, CABINE = [460, 1240];
  S.rideau = S.chaine + GUN; S.four = S.chaine + OVEN; S.cabine = CABINE.map((x) => S.chaine + x);
  T.chaine = [k];
  const LIFE = k + (OVEN + A / 2 + 10) / V.camera;            // la pièce entière a passé la bouche du four
  const Tc = Math.max(LIFE + 300, (S.four + OVENLEN + ECART + 760 - S.laser) / V.camera);
  T.chaine.push(LIFE);
  const P = V.camera * Tc;
  const CH = [
    { id: 'decoupe', t: 0 },
    { id: 'pliage', t: T.versPresse[0] + (T.versPresse[1] - T.versPresse[0]) * 0.6 },
    { id: 'soudure', t: T.versSoudure[0] + (T.versSoudure[1] - T.versSoudure[0]) * 0.6 },
    { id: 'peinture', t: T.versChaine[0] + (T.versChaine[1] - T.versChaine[0]) * 0.6 },
  ];

  // État de la pièce à son âge τ
  function etat(tau) {
    const f = full.bends.map(() => 0);
    let variant = 0; for (let i = 0; i < full.holes.length; i++) if (holeCut(i, tau)) variant = i + 1;
    let rz = 0, c = [S.laser, 0], z = 0, punch = null;
    if (tau >= T.leve[0]) z = 40 * EASE.convoyeur(seg(tau, T.leve[0], T.leve[1]));
    if (tau >= T.versPresse[0]) {
      const kk = EASE.convoyeur(seg(tau, T.versPresse[0], T.versPresse[1])), p0 = poses[0];
      rz = p0.rz * kk; c = [lerp(S.laser, S.presseA + p0.c[0], kk), lerp(0, p0.c[1], kk)]; z = 40 * (1 - kk) + 30 * Math.sin(Math.PI * kk);
    }
    if (tau >= T.presse[0]) {
      for (const st of T.coups) {
        if (tau < st.t0) break;
        if (st.k === 'repos') {
          const kk = EASE.convoyeur(seg(tau, st.t0, st.t1)), d = wrapA(st.to.rz - st.from.rz);
          rz = st.from.rz + d * kk; c = [lerp(station(st.from) + st.from.c[0], station(st.to) + st.to.c[0], kk), lerp(st.from.c[1], st.to.c[1], kk)]; z = 30 * Math.sin(Math.PI * kk);
          continue;
        }
        rz = st.ps.rz; c = [station(st.ps) + st.ps.c[0], st.ps.c[1]]; z = 0;
        const over = 92 / 90;
        let fv = 0;
        if (tau >= st.appui[0]) fv = over * EASE.appui(seg(tau, st.appui[0], st.appui[1]));
        if (tau >= st.ret[0]) fv = lerp(over, 1, EASE.retour(seg(tau, st.ret[0], st.ret[1])));
        f[st.ps.bi] = fv;
        if (tau < st.t1) {
          const open = 240, contact = t / 2, low = contact - 4;
          let zp;
          if (tau < st.app[1]) zp = lerp(open, contact, APP(seg(tau, st.app[0], st.app[1])));
          else if (tau < st.maint[1]) zp = lerp(contact, low, EASE.appui(seg(tau, st.appui[0], st.appui[1])));
          else zp = lerp(low, open, RET(seg(tau, st.ret[0], st.ret[1])));
          punch = { z: zp, poste: st.ps.poste };
        }
      }
      for (const st of T.coups) if (st.k === 'coup' && tau >= st.t1) f[st.ps.bi] = 1;
    }
    if (tau >= T.versSoudure[0]) {
      for (let i = 0; i < f.length; i++) f[i] = 1;
      const kk = EASE.convoyeur(seg(tau, T.versSoudure[0], T.versSoudure[1])), d = wrapA(0 - last.rz);
      rz = last.rz + d * kk; c = [lerp(station(last) + last.c[0], S.soudure, kk), lerp(last.c[1], 0, kk)]; z = 40 * Math.sin(Math.PI * kk);
    }
    if (tau >= T.versSoudure[1]) { c = [S.soudure, 0]; z = 0; rz = tau >= T.tour[0] ? Math.PI * EASE.convoyeur(seg(tau, T.tour[0], T.tour[1])) : 0; }
    if (tau >= T.versChaine[0]) {
      // accrochage : la pièce quitte la table à l'arrêt et se pose sur le convoyeur à sa vitesse (aucun à-coup à l'arrivée)
      const u = seg(tau, T.versChaine[0], T.versChaine[1]), kk = EASE.convoyeur(u), D = T.versChaine[1] - T.versChaine[0];
      rz = Math.PI * (1 + kk); c = [hermite(S.soudure, 0, S.chaine, V.camera * D, u), 0]; z = 40 * Math.sin(Math.PI * kk);
    }
    if (tau >= T.chaine[0]) { rz = 0; z = 0; c = [S.chaine + V.camera * (tau - T.chaine[0]), 0]; }
    return { f, variant, rz, c, z, punch, vis: tau >= tCoupe && tau < LIFE };
  }
  // le tablier de la presse : garé au-dessus du cadre hors de son travail ; il descend pendant que la pièce arrive et s'arrête
  // ouvert avant le premier coup, remonte pendant qu'elle repart vers la soudure
  const PARK_T = 1600;
  const tablier = (tau, e) => {
    if (e && e.punch) return e.punch.z;
    const dv = T.versPresse[1] - T.versPresse[0];
    return 240 + PARK_T * (1 - APP(seg(tau, T.versPresse[0], T.versPresse[0] + dv * 0.75))) + PARK_T * EASE.convoyeur(seg(tau, T.versSoudure[0], T.versSoudure[1]));
  };
  // les butées arrière d'un poste : reculées (120 mm), elles viennent au contact pendant que la pièce se pose, reculent dès
  // que le poinçon appuie (la paroi qui se lève les dégage)
  const butee = (tau, poste) => {
    for (const st of T.coups) {
      if (st.k !== 'coup' || st.ps.poste !== poste) continue;
      if (tau >= st.app[0] - PR.approche.ms && tau < st.app[0]) return 120 * (1 - APP(seg(tau, st.app[0] - PR.approche.ms, st.app[0])));
      if (tau >= st.app[0] && tau < st.appui[0]) return 0;
      if (tau >= st.appui[0] && tau < st.appui[0] + PR.retour.ms) return 120 * RET(seg(tau, st.appui[0], st.appui[0] + PR.retour.ms));
    }
    return 120;
  };
  // soudure : avancement de chaque angle (passe 1 : les deux angles avant ; passe 2 : les deux autres, venus devant)
  const ANGLES = [[0, 0], [A, 0], [A, B], [0, B]];
  const cordons = (tau) => { const p1 = seg(tau, T.passe1[0], T.passe1[1]), p2 = seg(tau, T.passe2[0], T.passe2[1]); return [p1, p1, p2, p2]; };
  // une torche (sx = −1 à gauche, +1 à droite) : entrée par son axe pendant que la pièce arrive, approche, passe montante,
  // recul et descente pendant que la pièce tourne, seconde passe, recul, sortie par son axe pendant que la pièce repart
  const RECUL = 420, PARK_S = 2600; // hors du cadre, dans l'axe de la torche
  function torche(tau, sx) {
    if (tau < T.versSoudure[0] || tau >= T.versChaine[1]) return null;
    const axe = norm([sx * 250, -250, 370]), zb = 10, zh = Hh - 10;
    let recul = RECUL, zt = zb, park = 0, arc = false;
    if (tau < T.soudure[0]) park = 1 - EASE.convoyeur(seg(tau, lerp(T.versSoudure[0], T.versSoudure[1], 0.45), T.versSoudure[1])); // elles entrent quand la pièce approche
    else if (tau < T.passe1[0]) recul = RECUL * (1 - APP(seg(tau, T.soudure[0], T.passe1[0])));
    else if (tau < T.passe1[1]) { recul = 0; zt = lerp(zb, zh, seg(tau, T.passe1[0], T.passe1[1])); arc = true; }
    else if (tau < T.tour[0]) { recul = 90 * RET(seg(tau, T.passe1[1], T.tour[0])); zt = zh; }
    else if (tau < T.tour[1]) { recul = 90; zt = lerp(zh, zb, EASE.convoyeur(seg(tau, T.tour[0], T.tour[1]))); }
    else if (tau < T.passe2[0]) { recul = 90 * (1 - APP(seg(tau, T.tour[1], T.passe2[0]))); }
    else if (tau < T.passe2[1]) { recul = 0; zt = lerp(zb, zh, seg(tau, T.passe2[0], T.passe2[1])); arc = true; }
    else if (tau < T.soudure[1]) { recul = RECUL * RET(seg(tau, T.passe2[1], T.soudure[1])); zt = zh; }
    else { zt = zh; park = EASE.convoyeur(seg(tau, T.versChaine[0], T.versChaine[1])); }
    const tip = [S.soudure + sx * (A / 2 + 6 + recul), -B / 2 - 6 - recul, zt];
    return { tip: add(tip, mulS(axe, park * PARK_S)), axe, arc };
  }
  // la tête du laser à l'âge τ : position (repère du développé), en coupe ou non, perçage en cours, tracé du contour
  function tete(tau) {
    let hp = HOME, coupe = false, perce = false, trace = null;
    if (tau < 0 || tau > T.leve[0]) return { hp, coupe, perce, trace };
    for (const s of steps) {
      if (tau < s.t0) break;
      if (s.k === 'vide') { const kk = EASE.vide(seg(tau, s.t0, s.t1)); hp = [lerp(s.a[0], s.b[0], kk), lerp(s.a[1], s.b[1], kk)]; }
      else if (s.k === 'percage') { hp = s.at; perce = tau < s.t1; }
      else if (s.k === 'coupe') {
        if (tau < s.t1) {
          const L = s.prof.sA(tau - s.t0), at = s.prof.point(L);
          hp = at.p; coupe = true;
          if (s.idx === 'contour') trace = [...s.prof.P.slice(0, at.i), at.p];
        } else hp = s.pts[0];
      }
    }
    return { hp, coupe, perce, trace };
  }
  return { full, variants, steps, T, LIFE, Tc, P, S, CH, LONG, etat, cordons, tete, torche, tablier, butee, coupe, ANGLES, C0, A, B, Hh, t, SHEET, HOME, tCoupe, BEAM, OVENLEN, GUN, poses, camX, V: V.camera };
}

// ---------- montage : trame, arêtes, valeurs ----------
export function mountFilm(host, { couleurs, teinte, pas = 3, oriente = true, onValeurs = null, onChapitre = null, reduced = null, autoplay = true, el = 27, az = -121 } = {}) {
  const rm = reduced ?? prefersReduced();
  const F = filmAtelier();
  const { T, S, P, Tc, A, B, Hh } = F;
  const canvas = document.createElement('canvas'), ink = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true'); ink.setAttribute('aria-hidden', 'true'); canvas.className = 'film-trame'; ink.className = 'film-encre';
  host.prepend(canvas, ink);
  // moteur : WebGL2 (trame attachée à la matière) ; sinon, l'ancienne trame d'écran en 2D (repli)
  const tr = createTrace(canvas, { couleurs, teinte, aplat: 0.85, ep: [0.05, 0.92] });
  const grav = tr ? null : createGravure(canvas, { pas, ep: [0.05, 0.92], epFond: 0, teinte, aplat: 0.85, oriente, packed: true, colx: 2, ...couleurs });
  const ENCRE = couleurs.trait1, TRAIT2 = couleurs.trait0, PAPIER = couleurs.fond, POUDRE = teinte || couleurs.trait1;

  // caméra : trois quarts, plongée, de loin ; elle regarde un point qui glisse le long de x à vitesse constante
  const DIST = 16000, FOV = 11;
  const camAt = (x) => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, tg = [x, 140, 170]; const c = camera({ eye: [tg[0] + DIST * Math.cos(e) * Math.cos(a), tg[1] + DIST * Math.cos(e) * Math.sin(a), tg[2] + DIST * Math.sin(e)], target: tg, fov: FOV }); c.t = tg; return c; };
  const CAM0 = camAt(0), VUE = CAM0.f; // l'orientation ne change pas pendant le travelling
  const LUM = norm([-0.8, -0.35, 0.55]), AMB = 0.24;
  // la poudre (à verser dans MOTION.poudre) : élévateur à 1,3 s l'aller-retour (course 160 mm, environ 0,25 m/s), deux pistolets
  // à 160 mm l'un de l'autre, empreinte de 110 mm (en x) sur 55 mm (en z) à la face, saturation 6 ; grains : un toutes les
  // 7 ms par buse, 260 ms de vol
  const PDR = { per: 1300, course: 80, zc: 70, ecart: 160, sx: 110, sz: 55, k: 6, dte: 7, vol: 260 };
  const ASIN98 = Math.asin(0.98);
  const zPistolet = (tau, ph = 0) => PDR.zc + PDR.course * Math.asin(0.98 * Math.sin((2 * Math.PI * tau) / PDR.per + ph)) / ASIN98;
  const W_MONDE = () => (host.clientWidth >= 900 ? 3100 : 2700);
  // trame du décor : dans le plan de chaque face, les lignes vont dans la direction dont l'image à l'écran est parallèle au
  // travelling ; le décor glisse alors le long de ses propres lignes (ni vitre, ni stroboscope) ; ancrage au repère de l'objet
  const S2 = (v) => [dot(v, CAM0.r), -dot(v, CAM0.u)], X2 = S2([1, 0, 0]), cr2 = (a, b) => a[0] * b[1] - a[1] * b[0];
  function axeDecor(n) {
    const e1 = norm(Math.abs(n[2]) < 0.9 ? cross(n, [0, 0, 1]) : cross(n, [1, 0, 0])), e2 = cross(n, e1);
    const c1 = cr2(S2(e1), X2), c2 = cr2(S2(e2), X2);
    let d = add(mulS(e1, c2), mulS(e2, -c1)); if (Math.hypot(...d) < 1e-6) d = e1; d = norm(d);
    if (dot(S2(d), X2) < 0) d = mulS(d, -1);
    return d;
  }
  function decor(polys, o = [0, 0, 0]) { // uv dans le repère de l'objet (origine o), normale gardée
    for (const p of polys) {
      p.n = p.n || newell(p.pts);
      if (p.uv) continue;
      const d = axeDecor(p.n), e = cross(p.n, d), uv = (q) => { const r = sub(q, o); return [dot(r, d), dot(r, e)]; };
      p.uv = p.pts.map(uv); if (p.holes) p.huv = p.holes.map((H) => H.map(uv));
    }
    return polys;
  }
  // ton d'une face : l'éclairage (Lambert, deux faces), puis la part de son groupe ; l'intérieur du four reste sombre
  const FACT = { piece: 1, tole: 1, sol: 0.5, outil: 0.6, four: 0.6, cabine: 0.42 };
  const tonDe = (n, g) => {
    if (g === 'dedans') return 0.9;
    let ndl = dot(n, LUM); if (dot(n, VUE) > 0) ndl = -ndl;
    return clamp((1 - (AMB + (1 - AMB) * Math.max(0, ndl))) * (FACT[g] ?? 0.6));
  };
  const gOf = (p) => p.g || (p.meta && p.meta.g);

  // ----- la bibliothèque du décor : chaque objet dans son repère, posé à son poste par un décalage -----
  const torcheGeo = (sx) => { // pointe à l'origine, corps dans l'axe de la torche, coude vers le haut
    const axe = norm([sx * 250, -250, 370]), at = (k) => mulS(axe, k), coude = add(at(200), [0, 0, 60]);
    return decor([...cyl([0, 0, 0], at(60), 20, { g: 'outil' }, VUE), ...cyl(at(60), coude, 15, { g: 'outil' }, VUE), ...cyl(coude, add(at(460), [0, 0, 60]), 30, { g: 'outil' }, VUE)]);
  };
  const MAILLES = {
    palette: decor(box(-760, 760, -560, 560, -46, -6, { g: 'sol' })),
    table: decor(box(-540, 540, -270, 270, -46, -6, { g: 'sol' })),
    matrice: decor(prismX([[-40, -150], [40, -150], [40, -1], [9, -1], [0, -11], [-9, -1], [-40, -1]], -1500, 1500, { g: 'outil' })),
    // le tablier de la presse et ses deux postes d'outillage, autour du milieu de la presse ; poinçons en col de cygne :
    // le profil se creuse du côté de la paroi qui se lève, pour la dégager (sinon elle traverse le corps du poinçon)
    outillage: decor([
      ...box(-1500, 1500, -46, 46, 320, 410, { g: 'outil' }),
      ...moved(prismX([[-74, 320], [-12, 320], [-12, 64], [3, 10], [0, 0], [-6, 12], [-74, 96]], -400, 400, { g: 'outil' }), -F.BEAM / 2),
      ...moved(prismX([[-74, 320], [-12, 320], [-12, 64], [3, 10], [0, 0], [-6, 12], [-74, 96]], -(B - 2 * F.t - 2) / 2, (B - 2 * F.t - 2) / 2, { g: 'outil' }), F.BEAM / 2),
    ]),
    // la butée arrière d'un poste : une traverse posée au sol derrière la matrice, deux doigts qui viennent toucher le bord
    // de la paroi à plier
    buteeA: decor([...box(-300, 300, 40, 90, -40, 24, { g: 'outil' }), ...box(-276, -244, 0, 40, 0, 24, { g: 'outil' }), ...box(244, 276, 0, 40, 0, 24, { g: 'outil' })]),
    buteeB: decor([...box(-120, 120, 40, 90, -40, 24, { g: 'outil' }), ...box(-106, -74, 0, 40, 0, 24, { g: 'outil' }), ...box(74, 106, 0, 40, 0, 24, { g: 'outil' })]),
    tete: decor([...cyl([0, 0, 150], [0, 0, 520], 64, { g: 'outil' }, VUE), ...cyl([0, 0, 60], [0, 0, 150], 34, { g: 'outil' }, VUE), ...cyl([0, 0, 10], [0, 0, 60], 16, { g: 'outil' }, VUE)]),
    'torche-1': torcheGeo(-1), torche1: torcheGeo(1),
    // la cabine, en écorché (origine : l'axe des pistolets) : paroi du fond, toit, paroi d'entrée percée à la taille du passage
    cabine: (() => {
      const xa = F.S.cabine[0] - F.S.rideau, xb = F.S.cabine[1] - F.S.rideau, y0 = -620, y1 = 620, z1 = 640, oy = 250, oz = 430, e = 24;
      return decor([
        // v8 : écorché franc, comme sur une notice : seule la paroi du fond reste, avec son chant ; la paroi d'entrée et le toit
        // cachaient la pièce et les pistolets pendant le poudrage
        quad([xa, y1, -40], [xb, y1, -40], [xb, y1, z1], [xa, y1, z1], { g: 'cabine' }),                    // paroi du fond (vue de face)
        quad([xa, y1, z1], [xb, y1, z1], [xb, y1 + e, z1], [xa, y1 + e, z1], { g: 'cabine' }),              // chant du haut
      ]);
    })(),
    // un élévateur (réciprocateur) devant la cabine : colonne et pied ; le chariot et ses deux pistolets glissent sur la colonne
    elevateur: decor([...box(-46, 46, -1130, -1050, -40, 470, { g: 'outil' }), ...box(-120, 120, -1170, -1010, -46, -30, { g: 'outil' })]),
    chariot: (() => {
      const out = decor(box(-58, 58, -1046, -1010, -36, PDR.ecart + 36, { g: 'outil' }));
      for (const dz of [0, PDR.ecart]) {
        out.push(...decor(cyl([0, -1030, dz], [0, -B / 2 - 296, dz], 15, { g: 'outil' }, VUE, 12), [0, 0, dz]));      // le corps du pistolet
        out.push(...decor(cyl([0, -B / 2 - 300, dz], [0, -B / 2 - 236, dz], 22, { g: 'outil' }, VUE, 12), [0, 0, dz])); // la buse
      }
      return out;
    })(),
    // l'élévateur du fond : les pistolets passent par une fente de la paroi (le chariot est derrière elle)
    chariotArr: (() => {
      const out = [];
      for (const dz of [0, PDR.ecart]) {
        out.push(...decor(cyl([0, 640, dz], [0, B / 2 + 296, dz], 15, { g: 'outil' }, VUE, 12), [0, 0, dz]));
        out.push(...decor(cyl([0, B / 2 + 300, dz], [0, B / 2 + 236, dz], 22, { g: 'outil' }, VUE, 12), [0, 0, dz]));
      }
      return out;
    })(),
    // le convoyeur de la chaîne : un bâti et des rouleaux, du point d'accrochage jusque dans le four
    convoyeur: (() => {
      const x0 = -620, x1 = (S.four - S.chaine) + F.OVENLEN - 60, out = decor(box(x0, x1, -230, 230, -46, -24, { g: 'sol' }));
      for (let x = x0 + 70; x < x1 - 20; x += 160) out.push(...decor(cyl([x, -230, -18], [x, 230, -18], 16, { g: 'outil' }, VUE, 10), [x, 0, -18]));
      return out;
    })(),
    four: (() => {
      const x0 = 0, x1 = F.OVENLEN, y0 = -360, y1 = 360, z1 = 560, oy = 250, oz = 420, e = 26;
      return decor([
        quad([x0 + e, y1 - e, -40], [x1 - e, y1 - e, -40], [x1 - e, y1 - e, z1 - e], [x0 + e, y1 - e, z1 - e], { g: 'dedans' }),
        quad([x1 - e, y0 + e, -40], [x1 - e, y0 + e, z1 - e], [x1 - e, y1 - e, z1 - e], [x1 - e, y1 - e, -40], { g: 'dedans' }),
        quad([x0 + e, y0 + e, -40], [x1 - e, y0 + e, -40], [x1 - e, y1 - e, -40], [x0 + e, y1 - e, -40], { g: 'dedans' }),
        // la façade : un U (la bouche descend jusqu'au sol), tournée vers −x
        { kind: 'face', pts: [[x0, y0, -40], [x0, y0, z1], [x0, y1, z1], [x0, y1, -40], [x0, oy, -40], [x0, oy, oz], [x0, -oy, oz], [x0, -oy, -40]], meta: { g: 'four' } },
        quad([x0, y0, -40], [x1, y0, -40], [x1, y0, z1], [x0, y0, z1], { g: 'four' }),
        quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], { g: 'four' }),
        quad([x0, oy, -40], [x0 + e, oy, -40], [x0 + e, oy, oz], [x0, oy, oz], { g: 'four' }),     // tableau droit de la bouche
        quad([x0, oy, oz], [x0 + e, oy, oz], [x0 + e, -oy, oz], [x0, -oy, oz], { g: 'four' }),     // linteau
        // les lanières de la bouche : elles retiennent la chaleur et s'arrêtent au-dessus de la pièce (300 mm)
        ...Array.from({ length: 10 }, (_, i) => { const ya = -oy + 6 + i * 49.6, yb = ya + 44; return quad([x0 - 4, ya, 340], [x0 - 4, yb, 340], [x0 - 4, yb, oz], [x0 - 4, ya, oz], { g: 'four' }); }).map((f) => ({ ...f, pts: f.pts.slice().reverse() })),
      ]);
    })(),
  };
  // la tôle sur sa palette, dans le repère de la palette ; elle porte la trame de la pièce qui en sera découpée (uv du
  // développé ramené au centre) : rien ne saute quand la pièce prend sa place
  const uvD = (q) => [q[0] - F.C0[0], q[1] - F.C0[1]];
  const tole = (trous, apres) => {
    const nom = `tole:${trous.length}:${apres}`;
    if (!MAILLES[nom]) {
      const cs = (q) => [q[0] - F.C0[0], q[1] - F.C0[1], 0], [x0, x1, y0, y1] = F.SHEET, ct = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      MAILLES[nom] = [{ kind: 'face', meta: { g: 'tole' }, pts: ct.map(cs), uv: ct.map(uvD), n: [0, 0, 1], holes: trous.map((h) => h.map(cs)), huv: trous.map((h) => h.map(uvD)), cle: nom }];
    }
    return nom;
  };
  // arêtes vues d'une face fixe (l'orientation de la caméra ne change pas) : pièce et tôle à l'encre, outils et four en trait clair
  const aretesDe = (f) => {
    const g = gOf(f), out = [];
    if (dot(f.n, VUE) >= 0 || g === 'sol' || g === 'dedans' || g === 'ombre') return out;
    if (g === 'tole') { for (const h of f.holes || []) for (let i = 0; i < h.length; i++) out.push([h[i], h[(i + 1) % h.length], 1.25, 0]); return out; }
    const w = g === 'piece' ? 1.25 : 1, c = g === 'piece' ? 0 : 1;
    const ring = (R, mask) => { for (let i = 0; i < R.length; i++) if (!mask || mask[i]) out.push([R[i], R[(i + 1) % R.length], w, c]); };
    ring(f.pts, f.aretes); for (const h of f.holes || []) ring(h);
    return out;
  };
  const mGL = new Map();
  const mailleGL = (nom) => {
    let m = mGL.get(nom);
    if (!m) {
      m = tr.maille(MAILLES[nom].map((f) => ({ pts: f.pts, uv: f.uv, ton: tonDe(f.n, gOf(f)), trous: f.holes && f.holes.length ? f.holes.map((h, i) => ({ pts: h, uv: f.huv[i] })) : null, cle: f.cle, n: f.n, aretes: aretesDe(f) })));
      mGL.set(nom, m);
    }
    return m;
  };

  // tout le décor part sur la carte au montage (tôle dans ses cinq états compris) : aucune construction pendant la lecture
  const trousA = (tau) => (tau >= F.tCoupe ? [F.full.outline] : F.full.holes.filter((_, i) => { const s = F.steps.find((x) => x.k === 'coupe' && x.idx === i); return s && tau >= s.t1; }));
  if (tr) {
    for (const tau of [0, ...F.steps.filter((x) => x.k === 'coupe').map((x) => x.t1), F.tCoupe]) tole(trousA(tau), tau >= F.tCoupe);
    for (const nom of Object.keys(MAILLES)) mailleGL(nom);
  }

  let view = null, cam = CAM0, ortho = !!tr;
  const proj = (p) => {
    const v = sub(p, ortho ? cam.t : cam.eye), x = dot(v, cam.r), y = dot(v, cam.u);
    if (ortho) return [view.cx + x * view.s, view.cy - y * view.s];
    const z = dot(v, cam.f); return [view.cx + (x * cam.k / z) * view.s, view.cy - (y * cam.k / z) * view.s];
  };

  // ----- la scène à l'instant tm : le décor posé à ses postes (instances), la pièce et son ombre (faces), les tracés -----
  const H_VIT = 8; // ms : pas de dérivation des vitesses
  let etatCourant = null;
  function scene(tm, xcam = null) {
    const out = { inst: [], faces: [], vect: [] };
    const pose = (nom, off, vit) => out.inst.push([nom, off, vit || null]);
    const xc = xcam ?? F.camX(tm), half = W_MONDE() * 0.6 + 900;
    const inView = (x0, x1 = x0) => x1 > xc - half && x0 < xc + half;
    const mMin = Math.floor((xc - half - S.four - F.OVENLEN) / P) - 1, mMax = Math.ceil((xc + half - S.laser + 800) / P) + 1;
    for (let m = mMin; m <= mMax; m++) {
      const o = m * P, tau = tm - m * Tc;      // la pièce m travaille aux postes de la période m
      // laser : palette, tôle (entière, puis squelette), tête
      if (inView(S.laser + o - 760, S.laser + o + 760)) {
        pose('palette', [S.laser + o, 0, 0]);
        pose(tole(trousA(tau), tau >= F.tCoupe), [S.laser + o, 0, 0]);
        const hp = (h) => [S.laser + o + h.hp[0] - F.C0[0], h.hp[1] - F.C0[1]];
        const hd = F.tete(tau), [hx, hy] = hp(hd), h2 = hp(F.tete(tau - H_VIT));
        pose('tete', [hx, hy, 0], [(hx - h2[0]) / H_VIT, (hy - h2[1]) / H_VIT, 0]);
        if (hd.coupe || hd.perce) out.vect.push({ k: 'faisceau', a: [hx, hy, 10], b: [hx, hy, 0] });
        if (hd.trace) out.vect.push({ k: 'trait', pts: hd.trace.map((q) => [S.laser + o + q[0] - F.C0[0], q[1] - F.C0[1], 0]) });
      }
      const e = (tau >= F.tCoupe && tau < F.LIFE) ? F.etat(tau) : null;
      if (e && Math.abs(tau - (((tm % Tc) + Tc) % Tc)) < 1) etatCourant = e;
      // presse : la matrice, les butées, le tablier et ses deux poinçons (descendus d'un bloc)
      if (inView(S.presseA + o - 1500, S.presseB + o + 1500)) {
        const xm = (S.presseA + S.presseB) / 2 + o;
        pose('matrice', [xm, 0, 0]);
        const zT = F.tablier(tau, e), zT2 = F.tablier(tau - H_VIT, F.etat(tau - H_VIT));
        pose('outillage', [xm, 0, zT], [0, 0, (zT - zT2) / H_VIT]);
        for (const [poste, xP] of [['A', S.presseA + o], ['B', S.presseB + o]]) {
          const yb = F.butee(tau, poste), yb2 = F.butee(tau - H_VIT, poste);
          pose(poste === 'A' ? 'buteeA' : 'buteeB', [xP, Hh + 8 + yb, 0], [0, (yb - yb2) / H_VIT, 0]);
        }
      }
      // soudure : la table, deux torches aux angles avant de la pièce
      if (inView(S.soudure + o - 1200, S.soudure + o + 1200)) {
        pose('table', [S.soudure + o, 0, 0]);
        for (const sx of [-1, 1]) {
          const th = F.torche(tau, sx); if (!th) continue;
          const t2 = F.torche(tau - H_VIT, sx), vit = t2 ? mulS(sub(th.tip, t2.tip), 1 / H_VIT) : [0, 0, 0];
          const tip = [th.tip[0] + o, th.tip[1], th.tip[2]];
          pose(sx < 0 ? 'torche-1' : 'torche1', tip, vit);
          if (th.arc) out.vect.push({ k: 'arc', at: tip, tm: tau });
        }
      }
      // peinture : le convoyeur, la cabine et ses deux élévateurs, le four ; le dépôt et le nuage de poudre
      if (inView(S.chaine + o - 700, S.four + o + F.OVENLEN)) {
        const xg = S.rideau + o, zg = zPistolet(tau), zg2 = zPistolet(tau, Math.PI);
        const vz = (zg - zPistolet(tau - H_VIT)) / H_VIT, vz2 = (zg2 - zPistolet(tau - H_VIT, Math.PI)) / H_VIT;
        pose('convoyeur', [S.chaine + o, 0, 0]); pose('cabine', [xg, 0, 0]); pose('four', [S.four + o, 0, 0]);
        pose('elevateur', [xg, 0, 0]); pose('chariot', [xg, 0, zg], [0, 0, vz]); pose('chariotArr', [xg, 0, zg2], [0, 0, vz2]);
        if (e && tau >= T.chaine[0]) {
          out.depot = { v: F.V, t: tau, sx: PDR.sx, zc: PDR.zc, course: PDR.course, per: PDR.per, sz: PDR.sz, ecart: PDR.ecart, k: PDR.k };
          out.vect.push({ k: 'poudre', xg, c: e.c[0], tau });
        }
      }
      // la pièce
      if (!e || !e.vis) continue;
      const pieceA = (st) => {
        const pt = F.variants[st.variant], fo = fold(pt, (i) => st.f[i]);
        const cs2 = Math.cos(st.rz), sn2 = Math.sin(st.rz);
        const trp = (q) => { const x = q[0] - F.C0[0], y = q[1] - F.C0[1]; return [st.c[0] + cs2 * x - sn2 * y, st.c[1] + sn2 * x + cs2 * y, q[2] + st.z]; };
        return { fo, list: mesh(pt, fo).filter((p) => p.kind !== 'bore'), trp };
      };
      const cur = pieceA(e), prev = pieceA(F.etat(tau - H_VIT));
      const memes = prev.list.length === cur.list.length;
      const enChaine = tau >= T.chaine[0], cut = enChaine ? [S.rideau + o, S.four + o] : null;
      const expo = (p) => (p.kind === 'face' && p.side === 'top' ? 0.72 : 1); // cage de Faraday : l'intérieur se poudre moins
      const lever = lisse(0.5, 14, e.z);
      cur.list.forEach((p, i) => {
        const M = cur.fo.M.get(p.face) || [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
        const cx = [M[0], M[3], M[6]], cy = [M[1], M[4], M[7]], Tm = [M[9], M[10], M[11]];
        const uvL = (q) => { const d = sub(q, Tm); return [dot(d, cx) - F.C0[0], dot(d, cy) - F.C0[1]]; }; // le grain du développé
        const pts = p.pts.map(cur.trp), q2 = memes && prev.list[i].pts.length === p.pts.length ? prev.list[i].pts.map(prev.trp) : null;
        const holes = p.holes && p.holes.length ? p.holes.map((H) => H.map(cur.trp)) : undefined;
        let vits = q2 ? pts.map((q, j) => mulS(sub(q, q2[j]), 1 / H_VIT)) : null;
        if (vits && holes) {
          const ph = prev.list[i].holes;
          if (ph && ph.length === holes.length && ph.every((H, a) => H.length === holes[a].length)) { const h2 = ph.map((H) => H.map(prev.trp)); holes.forEach((H, a) => H.forEach((q, c) => vits.push(mulS(sub(q, h2[a][c]), 1 / H_VIT)))); }
          else vits = null;
        }
        const ax = [cx[0] * Math.cos(e.rz) - cx[1] * Math.sin(e.rz), cx[0] * Math.sin(e.rz) + cx[1] * Math.cos(e.rz), cx[2]];
        out.faces.push({ kind: p.kind, side: p.side, g: 'piece', pts, uv: p.pts.map(uvL), holes, huv: p.holes && p.holes.length ? p.holes.map((H) => H.map(uvL)) : undefined, vits, cut, peint: enChaine ? expo(p) : 0,
          cle: p.kind === 'face' ? `p:${e.variant}:${p.face}:${p.side}` : null, meta: { g: 'piece', u: ax } });
        // ombre de contact : la pièce levée pose une ombre douce sous elle (plus claire avec la hauteur) ; à plat, rien
        if (lever > 0 && p.kind === 'face' && p.side === 'top') {
          const tons = pts.map((q) => 0.5 * lever * (1 - lisse(0, 380, q[2])));
          out.faces.push({ kind: 'face', g: 'ombre', pts: pts.map((q, j) => [q[0], q[1], 0.4 + tons[j]]), uv: pts.map((q) => [q[0], q[1]]), n: [0, 0, 1], tons, holes: holes && holes.map((H) => H.map((q) => [q[0], q[1], 0.4])), huv: holes && holes.map((H) => H.map((q) => [q[0], q[1]])), vits: vits && vits.map((v) => [v[0], v[1], 0]), cle: `o:${e.variant}:${p.face}` });
        }
      });
      // les cordons de soudure : sur les angles vus de face
      const cord = F.cordons(tau);
      F.ANGLES.forEach((q, i) => {
        if (cord[i] <= 0) return;
        const w = cur.trp([q[0], q[1], 0]);
        if (w[1] > e.c[1] + 1) return; // angle à l'arrière : caché par la pièce
        const ox = Math.sign(w[0] - e.c[0]) * 1.5;
        out.vect.push({ k: 'cordon', a: [w[0] + ox, w[1] - 1.5, e.z + 2], b: [w[0] + ox, w[1] - 1.5, e.z + 2 + (Hh - 4) * cord[i]], p: cord[i], dansFour: w[0] > S.four + o });
      });
    }
    return out;
  }

  // préchauffe : les triangulations de la pièce et de son ombre, calculées une fois pour chaque état (à plat, levée, pliée,
  // retournée, peinte) avant la lecture ; aucun calcul nouveau ne tombe pendant le film
  if (tr) {
    const mi = (a) => (a[0] + a[1]) / 2, chauffe = [F.tCoupe + 1, T.leve[1] + 40, mi(T.versPresse), ...T.coups.map((c) => (c.k === 'coup' ? c.t1 - 1 : mi([c.t0, c.t1]))), mi(T.versSoudure), mi(T.tour), mi(T.versChaine), mi(T.chaine)];
    tr.begin({});
    for (const tt of chauffe) for (const f of scene(tt).faces) { f.n = f.n || newell(f.pts); tr.face(f.pts, f.uv, 0, { trous: f.holes ? f.holes.map((h, i) => ({ pts: h, uv: f.huv[i] })) : null, cle: f.cle }); }
  }

  let t = 0, playing = false, dead = false, lastVal = '', lastCh = '', dtImg = 0;
  // vitesse de lecture (0 à 1) : la pause freine et la reprise repart sur une courbe courte, jamais d'arrêt sec
  let vitesse = 0, horloge = 0, rampe = null, raccord = null;
  // saut : { x (caméra, mm), flou (déplacement de la caméra pendant l'obturation, mm), vx (mm/ms) } pendant un raccord de chapitre
  function draw(tm, saut = null) {
    const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return false;
    cam = camAt(saut ? saut.x : F.camX(tm));
    const PF = window.__filmProf, n0 = PF ? performance.now() : 0;
    const sc = scene(tm, saut ? saut.x : null);
    const n1 = PF ? performance.now() : 0;
    if (tr) {
      const s = W / W_MONDE();
      view = { s, cx: W / 2, cy: H * 0.5 };
      // pas de la trame dans la matière : environ `pas` px à l'écran pour une face vue de trois quarts
      const fl = saut ? S2([saut.flou * s, 0, 0]) : [0, 0];
      tr.begin({ W, H, cam: { t: cam.t, r: cam.r, u: cam.u, f: cam.f }, s, cx: view.cx, cy: view.cy, pas: pas / (s * 0.75), dt: dtImg, vcam: saut ? [saut.vx, 0, 0] : dtImg > 0 ? [F.V * vitesse, 0, 0] : [0, 0, 0], flou: fl, depot: sc.depot || null });
      // obturation sur toute la durée de l'image : le filtre temporel juste pour une trame fine (une ligne qui avance d'un
      // demi-pas par image se fond au lieu de papillonner) ; à l'arrêt, aucune durée, l'image est nette
      for (const [nom, off, vit] of sc.inst) tr.instance(mailleGL(nom), off, vit);
      for (const f of sc.faces) {
        f.n = f.n || newell(f.pts);
        tr.face(f.pts, f.uv, tonDe(f.n, f.g), { trous: f.holes ? f.holes.map((h, i) => ({ pts: h, uv: f.huv[i] })) : null, tons: f.tons || null, peint: f.peint || 0, cut: f.cut, vits: f.vits, cle: f.cle });
        if (f.g !== 'piece' || f.kind !== 'face' || dot(f.n, VUE) >= 0) continue; // arêtes vues de la pièce, à l'encre
        const cx = f.cut ? f.cut[1] : 1e9;
        const ring = (R) => { for (let i = 0; i < R.length; i++) tr.arete(R[i], R[(i + 1) % R.length], 1.25, 0, f.n, cx); };
        ring(f.pts); for (const h of f.holes || []) ring(h);
      }
      tr.end();
    } else dessin2d(sc, W, H);
    const n2 = PF ? performance.now() : 0;
    // les tracés vectoriels (faisceau, tracé de coupe, cordons, arc, poudre), par-dessus
    const dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (ink.width !== cw || ink.height !== ch) { ink.width = cw; ink.height = ch; }
    const ic = ink.getContext('2d'); ic.setTransform(dpr, 0, 0, dpr, 0, 0); ic.clearRect(0, 0, W, H);
    ic.lineJoin = 'round'; ic.lineCap = 'round';
    // pendant le raccord, les tracés fins (faisceau, cordons, poudre) s'effacent avec la vitesse : le filé les emporterait
    ic.globalAlpha = saut && tr ? clamp(1 - Math.abs(saut.flou * (W / W_MONDE())) / 24) : 1;
    if (!tr) encre2d(ic);
    for (const v of sc.vect) {
      if (v.k === 'faisceau') { const a = proj(v.a), b = proj(v.b); ic.strokeStyle = ENCRE; ic.lineWidth = 2; ic.beginPath(); ic.moveTo(a[0], a[1]); ic.lineTo(b[0], b[1]); ic.stroke(); }
      if (v.k === 'trait') { ic.strokeStyle = ENCRE; ic.lineWidth = 1.25; ic.beginPath(); v.pts.forEach((q, i) => { const a = proj(q); i ? ic.lineTo(a[0], a[1]) : ic.moveTo(a[0], a[1]); }); ic.stroke(); }
      if (v.k === 'cordon' && !v.dansFour) {
        const a = proj(v.a), b = proj(v.b), L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
        const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux;
        ic.strokeStyle = ENCRE; ic.lineWidth = 3.2; ic.beginPath(); ic.moveTo(a[0], a[1]); ic.lineTo(b[0], b[1]); ic.stroke();
        // écailles : des arcs bombés vers l'arrière (vers le départ du cordon), au pas des trempages
        const pitch = Math.max(3.5, (L / Math.max(1, 12 * v.p)) * 1); ic.lineWidth = 1; ic.strokeStyle = PAPIER;
        for (let d = pitch; d < L - 1; d += pitch) { const cx = a[0] + ux * d, cy = a[1] + uy * d; ic.beginPath(); ic.moveTo(cx + nx * 1.9, cy + ny * 1.9); ic.quadraticCurveTo(cx - ux * 2.2, cy - uy * 2.2, cx - nx * 1.9, cy - ny * 1.9); ic.stroke(); }
      }
      if (v.k === 'arc') { const a = proj(v.at), r = 2.6 + 1.4 * (0.5 + 0.25 * Math.sin(v.tm / 23) + 0.25 * Math.sin(v.tm / 9.7 + 1.3)); ic.fillStyle = PAPIER; ic.strokeStyle = ENCRE; ic.lineWidth = 1.25; ic.beginPath(); ic.arc(a[0], a[1], r, 0, Math.PI * 2); ic.fill(); ic.stroke(); }
      if (v.k === 'poudre') poudre(ic, v);
    }
    if (!saut) valeurs(tm);
    if (PF) { const n3 = performance.now(); PF.push([n1 - n0, n2 - n1, 0, n3 - n2, sc.faces.length, tm]); }
    return true;
  }

  // ----- le nuage de poudre (v7) : chaque grain part d'une buse à un instant fixé (un toutes les PDR.dte ms), vole PDR.vol ms en
  // ralentissant, se pose sur la face avant, ou contourne le bord voisin (enveloppement électrostatique) et passe derrière.
  // Les pistolets ne soufflent que pendant que la pièce est devant eux (détection de pièce), avec une montée et une coupure douces.
  const hache = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  const YF = -B / 2, YB = -B / 2 - 236; // la face avant, la sortie des buses
  function poudre(ic, v) {
    const { xg, c, tau } = v, Lp = PDR.vol;
    ic.lineWidth = 1.4; ic.lineCap = 'round'; // v8 : grains un peu plus présents (ils ne se lisaient pas à 1 440 px)
    const a0 = ic.globalAlpha;
    for (let j = 0; j < 2; j++) {
      for (let n = Math.ceil((tau - Lp) / PDR.dte); n <= Math.floor(tau / PDR.dte); n++) {
        const te = n * PDR.dte, s = (tau - te) / Lp, ce = c - F.V * (tau - te);       // âge du grain, pièce à son départ
        const rel = xg - ce, on = lisse(-A / 2 - 70, -A / 2 - 10, rel) * (1 - lisse(A / 2 + 10, A / 2 + 70, rel));
        if (on <= 0) continue;
        const h1 = hache(n * 2 + j * 7919), h2 = hache(n * 2 + 1 + j * 7919), h3 = hache(n * 5 + 3 + j * 104729);
        const zN = zPistolet(te) + j * PDR.ecart, D = YF - YB;
        const xa = xg + (h1 - 0.5) * 2 * D * 0.62, za = zN + (h2 - 0.5) * 2 * D * 0.42; // le cône de la buse à la face
        const ca = ce + F.V * Lp, x0 = ca - A / 2, x1 = ca + A / 2;                         // la pièce à l'arrivée du grain
        const N = [xg, YB, zN];
        let C1, E;
        if (za > Hh + 4) { C1 = [xa, YF - 30, Hh + 24 + (za - Hh) * 0.3]; E = [xa + 10, YF + 70, Hh - 40]; }        // par-dessus le bord
        else if (xa < x0) { C1 = [x0 - 24 - (x0 - xa) * 0.3, YF - 10, za]; E = [x0 - 1, YF + 40 + (x0 - xa) * 0.8, za]; } // autour du bout gauche
        else if (xa > x1) { C1 = [x1 + 24, YF - 10, za]; E = [x1 + 30, YF + 80, za]; }                           // autour du bout droit (caché)
        else { C1 = [lerp(xg, xa, 0.6), YF - D * 0.35, lerp(zN, za, 0.6)]; E = [xa, YF - 1, Math.max(4, za)]; }    // sur la face
        const pos = (u) => { const k = 1 - (1 - u) ** 1.7, q = 1 - k; return [q * q * N[0] + 2 * q * k * C1[0] + k * k * E[0], q * q * N[1] + 2 * q * k * C1[1] + k * k * E[1], q * q * N[2] + 2 * q * k * C1[2] + k * k * E[2]]; };
        const p1 = pos(s), p0 = pos(Math.max(0, s - 0.07));
        // grain caché quand il passe derrière la face avant ou le bout droit ; il se fond dans le dépôt en se posant
        let al = on * lisse(0, 0.12, s) * (1 - lisse(0.78, 1, s)) * (1 - lisse(YF - 2, YF + 12, p1[1]) * (p1[0] < x0 - 2 ? 0 : 1));
        if (p1[0] > x1 + 2) al *= 1 - lisse(x1 + 2, x1 + 16, p1[0]);
        if (al <= 0.01) continue;
        const a = proj(p0), b = proj(p1);
        ic.globalAlpha = a0 * al * (0.45 + 0.3 * h3); ic.strokeStyle = POUDRE;
        ic.beginPath(); ic.moveTo(a[0], a[1]); ic.lineTo(b[0] + 0.01, b[1]); ic.stroke();
      }
    }
    ic.globalAlpha = a0;
  }

  // ----- repli sans WebGL2 : l'ancienne trame d'écran (gravure.js), peintre par couches, projection en perspective -----
  let couches = null;
  const traceP = (ctx, p) => { ctx.beginPath(); p.pr.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); if (p.holes) for (const Hx of p.holes) { Hx.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); } };
  function dessin2d(sc, W, H) {
    const camP = camera({ eye: cam.eye, target: cam.t, fov: FOV }); cam = Object.assign(camP, { t: cam.t });
    const s = (W / W_MONDE()) * DIST / camP.k;
    view = { s, cx: W / 2, cy: H * 0.5 };
    const L = { sol: [], piece: [], outil: [], four: [] };
    const range = (g, poly) => (g === 'piece' ? L.piece : g === 'four' || g === 'dedans' ? L.four : g === 'sol' || g === 'tole' ? L.sol : L.outil).push(poly);
    for (const [nom, off] of sc.inst) for (const f of MAILLES[nom]) {
      const g = gOf(f), mv = (q) => [q[0] + off[0], q[1] + off[1], q[2] + off[2]];
      // les appuis (convoyeur et ses rouleaux, table) passent sous la pièce dans l'ordre du peintre
      const poly = { kind: 'face', pts: f.pts.map(mv), holes: f.holes && f.holes.length ? f.holes.map((H) => H.map(mv)) : undefined, meta: { g, u: (f.meta && f.meta.u) || [1, 0, 0] } };
      if (nom === 'convoyeur' || nom === 'table') L.sol.push(poly); else range(g, poly);
    }
    for (const f of sc.faces) {
      if (f.g === 'ombre') continue;
      const meta = { g: 'piece', u: f.meta.u }, poly = { kind: 'face', pts: f.pts, holes: f.holes, meta };
      if (f.cut) {
        const [xr, xf] = f.cut, a = clipX(clipX(f.pts, xr, true), xf, false), b = clipX(f.pts, xr, false);
        if (a.length > 2) L.piece.push({ ...poly, pts: a, holes: undefined, meta: { ...meta, peint: 1 } });
        if (b.length > 2) L.piece.push({ ...poly, pts: b, holes: undefined });
      } else L.piece.push(poly);
    }
    for (const list of Object.values(L)) for (const p of list) {
      const u = p.meta.u, q = p.pts[0], a = proj(q), b = proj([q[0] + u[0] * 60, q[1] + u[1] * 60, q[2] + u[2] * 60]);
      p.meta.ang = Math.hypot(b[0] - a[0], b[1] - a[1]) < 3 ? 0 : Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
    const R = (list) => render(list, camP, { size: s, cx: view.cx, cy: view.cy, color: [255, 255, 255], ink: [0, 0, 0], amb: AMB, light: [-0.8, -0.35, 0.55], paths: false });
    couches = [R(L.sol), R(L.piece), R(L.outil), R(L.four)];
    const tonOf = (p) => { const sh = parseInt(p.fill.slice(4), 10) / 255, g = p.meta && p.meta.g; if (g === 'dedans') return 0.9; return clamp((1 - sh) * (FACT[g] ?? 0.6)); };
    grav.frame((ctx) => { for (const Lc of couches) for (const p of Lc) { traceP(ctx, p); ctx.fillStyle = tonPack(tonOf(p), (p.meta && p.meta.peint) || 0, (p.meta && p.meta.ang) || 0); ctx.fill('evenodd'); } });
  }
  function encre2d(ic) {
    if (!couches) return;
    for (const [li, Lc] of couches.entries()) for (const p of Lc) {
      traceP(ic, p);
      if (li > 0) { ic.globalCompositeOperation = 'destination-out'; ic.fill('evenodd'); ic.globalCompositeOperation = 'source-over'; }
      const g = p.meta && p.meta.g;
      if (g !== 'dedans' && g !== 'sol') { ic.lineWidth = g === 'piece' ? 1.25 : 1; ic.strokeStyle = g === 'piece' ? ENCRE : TRAIT2; ic.stroke(); }
    }
  }

  // ----- la ligne de valeurs, en HTML (onValeurs), et le chapitre en cours (onChapitre) -----
  const NB = '\u00a0';
  const NF1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fr = (v) => NF1.format(v).replace(/[\u00a0\u202f]/g, NB);
  const chapitreA = (c) => { let id = F.CH[0].id; for (const ch of F.CH) if (c >= ch.t - 0.5) id = ch.id; return id; }; // tolérance : le modulo flottant d'un saut de chapitre
  const COUPS = T.coups.filter((s) => s.k === 'coup');
  function valeurs(tm) {
    const tau = ((tm % Tc) + Tc) % Tc, id = chapitreA(tau);
    let txt = '';
    if (id === 'decoupe') txt = `Le laser a coupé ${fr(F.coupe(tau) / 1000)}${NB}m sur ${fr(F.LONG / 1000)}`;
    else if (id === 'pliage') {
      // le pli en cours (ou le prochain) et son angle intérieur mesuré : 180° à plat, 88° sous charge, 90° au retour
      const cur = COUPS.find((s) => tau < s.t1) || COUPS[COUPS.length - 1];
      const e = etatCourant || F.etat(tau), fv = e.f[cur.ps.bi];
      txt = `Le pli ${cur.i + 1} sur 4 est à ${fr(180 - 90 * fv)}°`;
    } else if (id === 'soudure') { const cd = F.cordons(tau), n = cd.filter((x) => x >= 1).length, enCours = cd.some((x) => x > 0 && x < 1); txt = enCours ? `Les torches MIG soudent les angles ${n + 1} et ${n + 2}` : n === 0 ? 'Les torches MIG vont souder les quatre angles' : n >= 4 ? 'Les quatre angles sont soudés' : `${n} angles sur 4 sont soudés`; }
    else txt = `La jardinière est poudrée en RAL${NB}7016, puis cuite à 180${NB}°C`;
    if (txt !== lastVal) { lastVal = txt; onValeurs && onValeurs(txt, id); }
    if (id !== lastCh) { lastCh = id; onChapitre && onChapitre(id); }
  }

  // horloge : jusqu'à 120 i/s avec le moteur GL (un écran rapide montre un travelling plus fin), 60 en repli
  // Une image : la rampe de vitesse (pause, reprise), puis le raccord de chapitre s'il y en a un, sinon la lecture.
  // Raccord de chapitre : la caméra file le long de l'atelier jusqu'au poste demandé (un panoramique filé, « whip pan », qui
  // masque le raccord dans son flou) ; à mi-course, au plus fort du filé, le temps de la scène passe de l'instant quitté à
  // celui du chapitre. Durée : deux gestes d'approche (partir, freiner) ; position en raccord d'Hermite, à la vitesse du
  // travelling aux deux bouts : le film repart sans à-coup.
  const RAMPE = PR.approche.ms, DUREE_RACCORD = 2 * PR.approche.ms;
  function avancer(dt) {
    horloge += dt;
    if (rampe) { const u = seg(horloge - rampe.debut, 0, RAMPE); vitesse = lerp(rampe.v0, rampe.v1, EASE.convoyeur(u)); if (u >= 1) rampe = null; }
    const av = dt * vitesse;
    if (raccord) {
      const R = raccord, e = horloge - R.debut, u = clamp(e / R.dur);
      R.av += av;
      const v0 = F.V * R.vit * R.dur, x = hermite(R.x0, v0, R.x1, v0, u);
      const tm = u < 0.5 ? R.de + R.av : R.vers - (R.dur - e) * R.vit;
      if (u >= 1) { raccord = null; t = ((R.vers % Tc) + Tc) % Tc; dtImg = av; draw(t); }
      else { dtImg = dt; draw(tm, { x, flou: x - R.xp, vx: (x - R.xp) / Math.max(dt, 1) }); R.xp = x; }
    } else { t += av; if (t >= Tc) t -= Tc; dtImg = av; draw(t); }
    if (!playing && !rampe && !raccord) { vitesse = 0; dtImg = 0; draw(t); return false; }
    return true;
  }
  // horloge : jusqu'à 120 i/s avec le moteur GL (un écran rapide montre un travelling plus fin), 60 en repli
  const tk = ticker((dt) => (dead ? false : avancer(dt)), { el: host, margin: '0px', fps: tr ? 120 : 60 });
  // le pliage se montre au poste B : la paroi courte se lève à côté du segment (au poste A, le poinçon de 800 mm la cache)
  const contour = F.steps.find((s) => s.k === 'coupe' && s.idx === 'contour'), coup0 = COUPS.find((c) => c.ps.poste === 'B') || COUPS[0];
  // images clés (mouvements réduits) : un instant parlant par poste
  const KEYS = {
    decoupe: contour.t0 + (contour.t1 - contour.t0) * 0.6,
    pliage: coup0.appui[0] + PR.appui.ms * 0.72,
    soudure: T.passe1[0] + (T.passe1[1] - T.passe1[0]) * 0.65,
    peinture: T.chaine[0] + (S.rideau - S.chaine - A * 0.08) / F.camX(1),
  };
  const api = {
    F, T, Tc, KEYS, CH: F.CH,
    get moteur() { return tr ? tr.mode : 'repli'; },
    play() { if (rm) return; playing = true; rampe = { v0: vitesse, v1: 1, debut: horloge }; tk.start(); },
    // la pause freine sur une courbe courte (MOTION.presse.approche, départ et arrêt doux) ; l'image finale est nette
    pause() { playing = false; if (rm) { dtImg = 0; api.redraw(); return; } rampe = { v0: vitesse, v1: 0, debut: horloge }; tk.start(); },
    get playing() { return playing; },
    seek(ms, dt = 0) { raccord = null; rampe = null; t = ((ms % Tc) + Tc) % Tc; dtImg = dt; api.redraw(); }, // dt : durée d'image simulée (banc d'essai du flou)
    chapitre(id) {
      const ch = F.CH.find((c) => c.id === id); if (!ch) return;
      if (rm || !tr || !host.clientWidth) { raccord = null; t = rm ? KEYS[id] : ch.t; dtImg = 0; api.redraw(); return; }
      // le poste demandé, à la période la plus proche (le monde est périodique : même image à (x + P, t + Tc))
      const de = raccord ? raccord.vers : t, x0 = raccord ? raccord.xp : F.camX(t);
      let vers = ch.t; for (const n of [-1, 1]) if (Math.abs(F.camX(ch.t + n * Tc) - x0) < Math.abs(F.camX(vers) - x0)) vers = ch.t + n * Tc;
      raccord = { de: raccord ? raccord.vers - raccord.dur * raccord.vit : t, vers, x0, x1: F.camX(vers), xp: x0, debut: horloge, dur: DUREE_RACCORD, av: 0, vit: playing ? 1 : 0 };
      valeurs(((vers % Tc) + Tc) % Tc); // la ligne de valeurs et le chapitre suivent le clic tout de suite
      tk.start();
    },
    // banc d'essai : avance l'horloge d'une image, sans l'horloge du navigateur (images exactes)
    pas(dt) { tk.stop(); return avancer(dt); },
    redraw() { if (!dead && !draw(t)) requestAnimationFrame(() => api.redraw()); },
    get t() { return t; },
    destroy() { dead = true; tk.destroy(); ro.disconnect(); tr ? tr.destroy() : grav.destroy(); },
  };
  const ro = new ResizeObserver(() => { if (!playing) api.redraw(); });
  ro.observe(host);
  if (rm) { t = KEYS.decoupe; api.redraw(); } else { api.redraw(); if (autoplay) { vitesse = 1; api.play(); } }
  return api;
}
