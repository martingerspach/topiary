// Ourlet · le film des quatre postes (v9 : les bras mécaniques et la chaîne de travail). La pièce fil rouge, la jardinière
// 8800-J, traverse la découpe, le pliage, la soudure et la peinture, en un plan-séquence calculé en code, gravé en trame
// de lignes. Tout est une fonction du temps : seek(t) donne toujours la même image.
//
// v9, étapes A et B (2026-10-10) :
// - un bras articulé de référence (bras-v9.js : robot six axes, cinématique inverse analytique, déplacements articulaires
//   et linéaires, profils en S) et un moteur qui sait tourner des solides (trace-gl-v9.js) ;
// - la découpe sur un vrai portique. Références : les machines de découpe laser à plat à portique mobile (« optique
//   volante ») : une poutre enjambe le petit côté de la table et court sur deux rails, un chariot court le long de la
//   poutre et porte le coulisseau vertical de la tête ; chaînes porte-câbles sur la poutre et le long d'un rail ; la tête
//   se lève en arc pendant les déplacements à vide entre deux contours (saut de tête), descend au perçage, remonte et va
//   se garer en fin de programme, du côté opposé à la sortie des pièces ;
// - la soudure dans une cellule robotisée. Références : les cellules de soudage à l'arc à plateau tournant (positionneur
//   à axe vertical) servies par deux robots six axes ; torches MIG à col de cygne ; l'angle extérieur d'une tôle de 2 mm
//   se soude en descendante, torche dans le secteur des deux faces, de plus en plus inclinée vers le bas du cordon pour
//   dégager la table ; approche, cordon et dégagement en ligne droite, déplacements en articulaire ; chaque robot revient
//   à sa pose de repos, bras replié, par son propre chemin ;
// - la caméra suit le travail : elle s'attarde sur un poste pendant qu'il travaille (une dérive lente), accompagne la
//   pièce d'un poste au suivant, et roule à la vitesse de la chaîne de peinture. Sa trajectoire est une ligne brisée
//   (où regarder, quand) lissée trois fois : position, vitesse et accélération continues, périodique sur le cycle. Le plan
//   de l'atelier est fixe (les postes sont où des bras peuvent se passer la pièce), il ne découle plus de la caméra ;
// - arêtes : celle de la matrice ne transparaît plus à travers la tôle (arêtes couchées dans le plan de leur face) ; le
//   tracé de coupe et les cordons passent dans le moteur (ils sont cachés par ce qui passe devant eux).
// Restent de la v8 jusqu'aux étapes C, D, E : la pièce se déplace encore seule d'un poste à l'autre, la boucle se referme
// encore sur la pièce entrée dans le four.
//
// v7, la peinture comme une vraie ligne de poudrage automatique (références : les cabines de poudrage à élévateurs des
// lignes de thermolaquage industrielles, pistolets corona sur réciprocateurs, détection de pièce qui déclenche la
// pulvérisation ; l'enveloppement électrostatique, qui fait passer la poudre derrière les bords ; l'effet de cage de
// Faraday, qui poudre moins les faces intérieures ; le four tunnel à lanières).
//
// Références étudiées : les films produit de Teenage Engineering (économie de moyens, un rythme réglé sur l'objet) ; les
// vues des notices techniques (un objet, son outil, rien d'autre) ; les vidéos de procédé des fabricants de machines, pour
// la justesse des gestes seulement (aucun nom dans la page) ; la photogravure en trame de lignes ; pour la facture, les
// rendus « dessin au trait » des films de marque (trame attachée à la matière, flou de bougé, arêtes vues).
//
// Les gestes : découpe, les trous d'abord, le contour en dernier, à vitesse de coupe avec mise en vitesse et ralenti dans les
// angles ; le squelette reste sur la palette ; pliage, dans l'ordre de la gamme, retour élastique (92° sous charge, 90° quand le
// poinçon remonte), butées au contact puis reculées ; soudure, deux passes, des écailles bombées vers le départ du cordon ;
// peinture, une poudre qui enveloppe les bords. Tout départ se fait à vitesse nulle, toute arrivée aussi, sauf l'accrochage à
// la chaîne qui se fait à la vitesse de la chaîne. Durées et courbes : MOTION, plus les valeurs nouvelles réunies dans V9.
// Aucun texte n'est peint dans le canvas : la ligne de valeurs est du HTML (onValeurs).
import { fold, mesh, render, camera, makePart } from './part.js';
import { jardiniere } from './pieces.js';
import { createGravure, tonPack } from './gravure.js';
import { createTrace } from './trace-gl-v9.js';
import { MOTION, EASE, ticker, prefersReduced } from './motion.js';
import { P as TOK, ILLU } from '../tokens/tokens-v2.js';
import { clamp, lerp, add, sub, mulS, dot, cross, norm, newell, app3, rotZ, quad, box, prismX, cyl, moved, tramer, faceGL } from './solides-v9.js';
import { creerBras, programme, S5, trapeze } from './bras-v9.js';

const seg = (t, a, b) => (b > a ? clamp((t - a) / (b - a)) : t >= b ? 1 : 0);
const wrapA = (d) => ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const lisse = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const REF = 0.36; // px CSS par mm dans le cadrage de référence (1 440 px) : convertit les vitesses d'écran des tokens
const vmm = (pxs) => pxs / REF / 1000; // px/s → mm/ms
const PR = MOTION.presse;
// chaine : la vitesse de la chaîne de peinture (le jeton MOTION.camera.travelling : la caméra la suit pièce au centre)
const V = { coupe: vmm(MOTION.laser.coupe.v), vide: vmm(MOTION.laser.vide.v), transfert: vmm(MOTION.convoyeur.v), chaine: vmm(MOTION.camera.travelling) };

// ---------- Valeurs nouvelles de la v9, à verser dans les tokens (MOTION) ----------
const V9 = {
  // caméra : largeur (ms) de chacun des trois lissages de sa trajectoire ; pour chaque poste, où regarde la caméra par
  // rapport au poste (mm) à l'arrivée de la pièce puis à son départ (une dérive lente entre les deux) ; arrive : l'instant
  // du cycle où elle a fini de venir de la palette de la commande au laser ; haut : la ligne d'horizon du cadre (part de sa hauteur)
  camera: { lissage: 700, arrive: 1800, laser: [-1000, 100, 250], presse: [300, 480], soudure: [300, 450], chaine: 120, palette: [-500, 100], haut: 0.53 },
  // laser : accélération des déplacements à vide (3 g), saut de tête entre deux contours, hauteur de garage (mm) ; le portique
  // quitte son garage `prepare` ms avant le début du cycle et se pose `pose` ms avant le premier perçage
  laser: { accVide: 0.0294, saut: 34, garage: 120, prepare: 900, pose: 100 },
  // presse : ouverture (mm : le poinçon ouvert laisse passer une paroi de 300 mm levée de 60 mm) ; avance (ms) : le tablier
  // commence à descendre pendant que le robot finit de poser la pièce (approche plus longue, donc plus douce)
  // mi : le retour vif du poinçon (jeton retour) s'arrête à cette hauteur, puis il finit de s'ouvrir doucement (fin, ms)
  presse: { ouverture: 400, avance: 320, mi: 240, fin: 500 },
  // soudure : approche et dégagement de la torche (ms), demi-tour du plateau (ms), retrait de la torche avant l'approche et
  // après le cordon (mm), inclinaison de la torche en haut puis en bas du cordon, retour au repos (ms), délai entre le
  // lâcher de la pièce et l'approche (ms), écailles par cordon, pied des robots (de part et d'autre, derrière le plateau),
  // direction d'approche de la torche
  soudure: { approche: 320, degage: 360, tour: 1150, pret: 190, recul: 210, pente: [0.3, 0.62], retour: 820, attente: 250, ecailles: 10, pied: [860, 380], vers: [0.95, 0.05] },
  // manutention (le robot sur rail) : le rail (y), la hauteur de son chariot ; durées (ms) : délai avant de bouger, venue
  // au-dessus du flan, descente, prise des ventouses, du laser à la presse, retournement sur place, d'un poste de la presse
  // à l'autre, de la presse au plateau, du plateau au convoyeur, accompagnement sur le convoyeur ; attente au laser (pointe
  // de l'outil par rapport au centre de la palette) ; côté : distance du chariot à la pièce le long du rail (au laser et au
  // poste A, au poste B, en attente à la soudure, au convoyeur, en attente au laser) ; recul du préhenseur en attente (y), son écart le long du rail et sa descente pendant la soudure ; degage : après le convoyeur, le robot s'écarte d'abord (mm, ms) pour laisser voir le four, puis revient ; hauteurs (mm) : pièce
  // levée pour être retournée, flan porté, jardinière portée, préhenseur sorti de la pièce ; retour : instant du cycle où
  // le robot est revenu attendre au laser ; palette : instant où le changeur amène une tôle neuve (hors du cadre)
  manutention: { rail: -950, chariot: 70, depart: 120, arrive: 650, descend: 320, ventouse: 160, versPresse: 2500, retourne: 1400, entrePostes: 2200, versSoudure: 2200, versChaine: 1800, tient: 250,
    attente: [700, -830, 450], cote: [650, 750, 400, 300, 450], recul: -750, ecart: 700, baisse: -250, degage: [1900, 1800], leve: 60, porteFlan: 220, porte: 120, haut: 600, retour: 2600, palette: 15000 },
  // la palette de la commande : position (y), hauteur, entraxe des deux jardinières d'un rang ; durées (ms) : respiration
  // sur la commande complète avant la fin du cycle, de la prise à la pose, sortie du four ; hauteur d'attente du
  // préhenseur ; instant où la commande est enlevée (hors du cadre)
  // (x : depuis le bout du convoyeur ; pas : demi-entraxes des quatre places ; porteZ : hauteur de la pièce portée ; robot : x du palettiseur)
  palette: { x: 250, y: 695, h: 144, pas: [430, 165], respire: 1700, porte: 1600, sortie: 3300, haut: 420, porteZ: 260, enleve: 14000, robot: 250 },
  robot: { k: 0.86, manip: 1.4, palettiseur: 1.3 },
  fin: 8300,                    // ms : de la pose sur le convoyeur à la fin du cycle (poudrage, four, palette, respiration)
};
// plan de l'atelier (mm, le long de la ligne) : du laser au premier poste de la presse, d'un poste de la presse à l'autre,
// de la presse au plateau de soudure, du plateau au début du convoyeur, longueur du four, convoyeur de sortie, puis du bout
// du convoyeur au laser de la ligne suivante
const PLAN = { presse: 2150, entrePostes: 1700, soudure: 1700, chaine: 1250, four: 1100, sortie: 900, laserSuivant: 1900 };

// départ arrêté : la courbe de MOTION, précédée d'une mise en vitesse tirée de la courbe d'appui (aucun démarrage à pleine vitesse)
const doux = (ease) => (x) => ease((1 - x) * EASE.appui(x) + x * x);
const APP = doux(EASE.approche), RET = doux(EASE.retour);
// raccord d'Hermite : de p0 (vitesse m0) à p1 (vitesse m1), vitesses exprimées sur la durée du raccord
const hermite = (p0, m0, p1, m1, u) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1; };

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

// ---------- la trajectoire de la caméra : une ligne brisée (instant, position), lissée, périodique ----------
// cles : [[t, x], …] de t = 0 à t = Tc, avec x(Tc) = x(0) + P. Trois moyennes glissantes de largeur `lissage` (une courbe en
// cloche de 3 × lissage de large) : position, vitesse et accélération continues ; la caméra anticipe un départ et se pose
// après une arrivée. Renvoie x(t) pour tout t (monde périodique : x(t + Tc) = x(t) + P).
function trajetCamera(cles, Tc, P, lissage) {
  const N = Math.ceil(Tc / 4), pas = Tc / N, pente = P / Tc;
  const brise = (t) => { let i = 1; while (i < cles.length - 1 && cles[i][0] < t) i++; const [t0, x0] = cles[i - 1], [t1, x1] = cles[i]; return x0 + (x1 - x0) * clamp((t - t0) / ((t1 - t0) || 1)); };
  let a = new Float64Array(N); for (let i = 0; i < N; i++) a[i] = brise(i * pas) - pente * i * pas; // la part périodique
  const h = Math.max(1, Math.round(lissage / pas / 2));
  for (let tour = 0; tour < 3; tour++) {
    const b = new Float64Array(N); let s = 0;
    for (let k = -h; k <= h; k++) s += a[((k % N) + N) % N];
    for (let i = 0; i < N; i++) { b[i] = s / (2 * h + 1); s += a[(i + h + 1) % N] - a[(((i - h) % N) + N) % N]; }
    a = b;
  }
  const at = (i) => a[((i % N) + N) % N];
  return (t) => { // interpolation de Catmull-Rom entre les échantillons : la vitesse reste continue
    const u = t / pas, i = Math.floor(u), f = u - i, p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    return pente * t + 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  };
}

// ---------- la chronologie et le plan de l'atelier (déterministes, sans écran) ----------
// La ligne tourne en flux continu : une pièce part à chaque cycle (Tc). Chaque poste est une fonction périodique de
// l'instant du cycle ; une pièce est une fonction de son âge, qui dépasse un cycle (elle sort du four pendant que la
// suivante est déjà à la soudure). Toutes les lignes de l'atelier sont identiques : la caméra passe de l'une à la suivante.
export function filmAtelier({ piece = jardiniere } = {}) {
  const full = piece();
  const t = full.t, A = 800, B = 300, Hh = 300, C0 = [A / 2, B / 2], SOL = -46;
  const variants = [0, 1, 2, 3].map((n) => makePart({ ...full, holes: full.holes.slice(0, n) }));
  const gam = full.gamme || full.bends.map((_, k) => k);
  const M = V9.manutention, SO = V9.soudure, LAS = V9.laser, PAL = V9.palette;

  // ----- 1. découpe : programme de la tête (repère du développé) -----
  // garage du portique : au fond à gauche, du côté opposé à la sortie des pièces. Il s'en va préparer la coupe avant le
  // début du cycle (il glisse jusqu'au premier perçage pendant que la caméra arrive), puis coupe.
  const SHEET = [-340, 1140, -340, 640], HOME = [-380, 700];
  const ACC = V.coupe / (MOTION.micro.ms * 0.6); // la tête atteint sa vitesse de coupe en 60 % de MOTION.micro (environ 2 g)
  const steps = []; let tt = LAS.pose, pos = HOME;
  // déplacement à vide : durée bornée par la vitesse et par l'accélération du portique ; la tête saute entre deux contours,
  // remonte au garage pendant le dernier (z0, z1, saut : hauteurs au-dessus de la coupe)
  const rapid = (to, z0 = 0, z1 = 0, saut = LAS.saut) => {
    const d = Math.hypot(to[0] - pos[0], to[1] - pos[1]);
    steps.push({ k: 'vide', t0: tt, t1: tt + Math.max(MOTION.micro.ms, d / V.vide, 2 * Math.sqrt(d / LAS.accVide)), a: pos, b: to, z0, z1, saut }); tt = steps[steps.length - 1].t1; pos = to;
  };
  const cutLoop = (pts, idx, premier) => {
    const prof = profilCoupe(pts, V.coupe, ACC);
    if (premier) { steps.push({ k: 'vide', doux: true, t0: -LAS.prepare, t1: -LAS.pose, a: HOME, b: pts[0], z0: LAS.garage, z1: 0, saut: 0 }); pos = pts[0]; } else rapid(pts[0]);
    steps.push({ k: 'percage', t0: tt, t1: tt + MOTION.laser.percage.ms, at: pts[0], idx }); tt += MOTION.laser.percage.ms;
    steps.push({ k: 'coupe', t0: tt, t1: tt + prof.T, pts, L: prof.L, prof, idx }); tt += prof.T; pos = pts[0];
  };
  [...full.holes.keys()].sort((i, j) => Math.hypot(full.holes[i].meta.cx - HOME[0], full.holes[i].meta.cy - HOME[1]) - Math.hypot(full.holes[j].meta.cx - HOME[0], full.holes[j].meta.cy - HOME[1]))
    .forEach((i, n) => cutLoop(full.holes[i], i, n === 0));
  const ol = full.outline;
  let best = 0, bl = 0; ol.forEach((p, i) => { const q = ol[(i + 1) % ol.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > bl) { bl = l; best = i; } });
  const mid = [(ol[best][0] + ol[(best + 1) % ol.length][0]) / 2, (ol[best][1] + ol[(best + 1) % ol.length][1]) / 2];
  cutLoop([mid, ...ol.slice(best + 1), ...ol.slice(0, best + 1)], 'contour', false);
  const tCoupe = tt; rapid(HOME, 0, LAS.garage, 0);
  const tGare = tt;
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
  const BEAM = PLAN.entrePostes; // entre les deux postes d'outillage de la presse de 3 m

  // ----- le plan de l'atelier (fixe) -----
  // la peinture : cabine, élévateurs, four tunnel (la pièce y disparaît entièrement), convoyeur de sortie où elle refroidit ;
  // au bout, le palettiseur et la palette de la commande, puis le laser de la ligne suivante
  const GUN = 760, OVEN = 1250, CABINE = [430, 1090];
  const S = { laser: 0 };
  S.presseA = S.laser + PLAN.presse; S.presseB = S.presseA + BEAM; S.soudure = S.presseB + PLAN.soudure; S.chaine = S.soudure + PLAN.chaine;
  S.rideau = S.chaine + GUN; S.four = S.chaine + OVEN; S.cabine = CABINE.map((x) => S.chaine + x);
  S.sortie = S.four + PLAN.four; S.bout = S.sortie + PLAN.sortie; S.prise = S.bout - 480; S.palettiseur = S.bout + PAL.robot; S.palette = [S.bout + PAL.x, PAL.y];
  const P = S.bout + PLAN.laserSuivant - S.laser;
  const station = (ps) => (ps.poste === 'A' ? S.presseA : S.presseB);

  // ----- la chronologie d'un cycle (ms) -----
  const T = { coupe: [0, tCoupe] };
  T.prise = [tCoupe + M.depart, tCoupe + M.depart + M.arrive + M.descend];      // le préhenseur vient au-dessus du flan, descend
  let k = T.prise[1] + M.ventouse;                                              // les ventouses ont pris : il lève
  T.versPresse = [k, k + M.versPresse]; k = T.versPresse[1];
  T.coups = [];
  poses.forEach((ps, i) => {
    if (i > 0) {
      const prev = poses[i - 1], d2 = ps.poste !== prev.poste ? M.entrePostes : M.retourne;   // d'un poste à l'autre, ou retournée sur place
      T.coups.push({ k: 'repos', t0: k, t1: k + d2, from: prev, to: ps }); k += d2;
    }
    const c = { k: 'coup', ps, i, t0: k }; c.app = [k, k + PR.approche.ms]; c.appui = [c.app[1], c.app[1] + PR.appui.ms]; c.maint = [c.appui[1], c.appui[1] + PR.maintien.ms]; c.ret = [c.maint[1], c.maint[1] + PR.retour.ms]; c.t1 = c.ret[1];
    T.coups.push(c); k = c.t1;
  });
  T.presse = [T.versPresse[1], k];
  const last = poses[poses.length - 1], COUPS = T.coups.filter((s) => s.k === 'coup'), REPOS = T.coups.filter((s) => s.k === 'repos');
  T.versSoudure = [k, k + M.versSoudure]; k = T.versSoudure[1];
  T.lache = k + M.ventouse;                                                     // la pièce est posée sur le plateau, les ventouses lâchent
  // soudure : la torche approche, soude l'angle de haut en bas, se dégage ; le plateau fait demi-tour ; seconde passe
  const PASS = SO.ecailles * MOTION.soudure.ecaille; // une écaille par trempage
  k = T.lache + SO.attente; T.soudure = [k];
  T.approche1 = [k, k + SO.approche]; T.passe1 = [T.approche1[1], T.approche1[1] + PASS]; T.degage1 = [T.passe1[1], T.passe1[1] + SO.degage];
  T.tour = [T.degage1[1] - 140, T.degage1[1] - 140 + SO.tour];   // le plateau démarre quand les torches sont déjà à l'écart
  T.approche2 = [T.tour[1], T.tour[1] + SO.approche]; T.passe2 = [T.approche2[1], T.approche2[1] + PASS]; T.degage2 = [T.passe2[1], T.passe2[1] + SO.degage];
  T.soudure.push(T.degage2[1]); T.ecailles = SO.ecailles;
  T.reprise = T.degage2[1] + M.depart;                                          // le préhenseur a repris la pièce
  k = T.reprise + M.ventouse;
  T.versChaine = [k, k + M.versChaine]; k = T.versChaine[1];
  T.chaine = [k, k + (OVEN + A / 2) / V.chaine];                                // posée sur le convoyeur ; entièrement entrée dans le four
  T.lacheChaine = k + M.tient;                                                  // le préhenseur l'accompagne un instant, puis lâche
  // la fin : la jardinière du cycle d'avant sort du four, le palettiseur la pose sur la palette, un temps de respiration
  const Tc = T.chaine[0] + V9.fin;
  T.pose = Tc - PAL.respire;                                                    // la quatrième jardinière est posée : la commande est complète
  T.prisePal = T.pose - PAL.porte;                                              // le palettiseur la prend au bout du convoyeur
  T.sortie = [T.prisePal - PAL.sortie, T.prisePal - 300];                       // elle sort du four et s'arrête au bout du convoyeur
  // l'âge d'une pièce : attente dans le four jusqu'à sa sortie, un cycle plus tard ; elle reste sur la palette jusqu'à ce
  // que la commande soit enlevée, hors du cadre (la caméra est alors à la presse)
  const AT = S.four + PLAN.four - A / 2 - 20, LIFE = 2 * Tc + PAL.enleve;

  // ----- le robot de manutention, sur son rail (septième axe) -----
  // Il prend le flan par le dessus, sur son fond, et ne le lâche plus jusqu'au plateau de soudure ; il le reprend pour le
  // convoyeur, puis revient le long du rail attendre le flan suivant. Sa trajectoire : la pointe de l'outil (x, y, z, lacet)
  // et le chariot sont des sommes de rampes en S qui se recouvrent (lever, avancer, tourner, poser : les coins sont arrondis,
  // rien ne s'arrête entre deux gestes) ; le bras s'en déduit à chaque instant par cinématique inverse.
  const BM = creerBras({ k: V9.robot.manip, outil: 'ventouses' }), RAD = Math.PI / 180;
  const rampes = (v0, L) => (u) => { let v = v0; for (const [t0, t1, d] of L) v += d * S5(seg(u, t0, t1)); return v; };
  const U0 = M.retour;                                           // le robot est revenu attendre au laser à cet instant du cycle
  const dep = (a) => (a < U0 ? a + Tc : a);                      // temps du robot, déroulé d'une attente au laser à la suivante
  const tA = T.prise[0], tV = T.versPresse, tS = T.versSoudure, tC = T.versChaine, p0 = poses[0], AT_ = M.attente;
  const xLache = S.chaine + V.chaine * M.tient, xArret = xLache + V.chaine * 250, tRet = T.lacheChaine + 500, tRet1 = U0 + Tc - 300;
  // le retour, en deux temps : le robot s'écarte d'abord (il laisse voir la bouche du four), puis, quand la caméra l'a
  // laissé derrière elle, il revient attendre au laser
  const tPart = T.prisePal - 300, xDeg = xArret - M.degage[0];
  const gxAvant = rampes(S.laser + AT_[0], [
    [tA, tA + M.arrive, -AT_[0]],
    [tV[0] + 150, tV[1] - 200, S.presseA + p0.c[0] - S.laser],
    ...REPOS.map((r) => [r.t0 + 150, r.t1 - 200, station(r.to) + r.to.c[0] - station(r.from) - r.from.c[0]]),
    [tS[0] + 150, tS[1] - 250, S.soudure - station(last) - last.c[0]],
    [T.lache + 150, T.lache + 900, M.ecart], [T.reprise - 900, T.reprise - 200, -M.ecart],   // il s'écarte pendant la soudure
  ]);
  const gx = (u) => {
    if (u < tC[0]) return gxAvant(u);
    if (u < tC[1]) return hermite(S.soudure, 0, S.chaine, V.chaine * (tC[1] - tC[0]), seg(u, tC[0], tC[1]));   // elle arrive à la vitesse du convoyeur
    if (u < T.lacheChaine) return S.chaine + V.chaine * (u - tC[1]);
    if (u < tRet) { const w = (u - T.lacheChaine) / 500; return xLache + V.chaine * 500 * (w - w * w / 2); }     // le préhenseur freine
    return xArret - M.degage[0] * S5(seg(u, tRet, tRet + M.degage[1])) + (S.laser + AT_[0] - xDeg) * S5(seg(u, tPart, tRet1));                                 // retour le long du rail
  };
  const gy = rampes(AT_[1], [
    [tA, tA + M.arrive, -AT_[1]], [tV[0] + 150, tV[1] - 200, p0.c[1]],
    ...REPOS.map((r) => [r.t0 + 150, r.t1 - 200, r.to.c[1] - r.from.c[1]]),
    [tS[0] + 150, tS[1] - 250, -last.c[1]],
    [T.lache + 150, T.lache + 650, M.recul], [T.reprise - 650, T.reprise - 200, -M.recul],
    [T.lacheChaine + 200, T.lacheChaine + 900, M.recul], [tRet, tRet + 1400, AT_[1] - M.recul],
  ]);
  const gz = rampes(AT_[2], [
    [tA + 200, tA + M.arrive, 150 - AT_[2]], [tA + M.arrive, T.prise[1], 1 - 150],
    [tV[0], tV[0] + 450, M.porteFlan], [tV[1] - 450, tV[1], -M.porteFlan],
    ...REPOS.flatMap((r) => [[r.t0, r.t0 + 350, M.leve], [r.t1 - 350, r.t1, -M.leve]]),
    [tS[0], tS[0] + 450, M.porte], [tS[1] - 450, tS[1], -M.porte],
    [T.lache, T.lache + 450, M.haut], [T.lache + 700, T.lache + 1150, M.baisse], [T.reprise - 1050, T.reprise - 650, -M.baisse], [T.reprise - 420, T.reprise, -M.haut],
    [tC[0], tC[0] + 400, M.porte], [tC[1] - 400, tC[1], -M.porte],
    [T.lacheChaine, T.lacheChaine + 400, M.haut], [tRet, tRet + 1400, AT_[2] - 1 - M.haut],
  ]);
  // les retournements : un demi-tour se fait dans le sens qui ramène le poignet vers son tour de départ (aucun enroulement)
  let cumul = 0; const tourne = (d) => { let w = wrapA(d); if (Math.abs(Math.abs(w) - Math.PI) < 1e-6) w = cumul > 0 ? -Math.PI : Math.PI; cumul += w; return w; };
  const lacet = rampes(0, [
    [tV[0] + 350, tV[1] - 350, tourne(p0.rz)],
    ...REPOS.map((r) => [r.t0 + 200, r.t1 - 200, tourne(r.to.rz - r.from.rz)]),
    [tS[0] + 250, tS[1] - 500, tourne(-last.rz)],
  ]);
  // le chariot, par rapport à la pointe : le robot travaille à droite de la pièce (il ne la cache pas à la caméra)
  const dxo = rampes(M.cote[4], [
    [tA, tA + M.arrive, M.cote[0] - M.cote[4]],
    ...REPOS.filter((r) => r.to.poste !== r.from.poste).map((r) => [r.t0 + 150, r.t1 - 200, M.cote[1] - M.cote[0]]),
    [tS[0] + 150, tS[1] - 250, M.cote[0] - M.cote[1]],
    [T.lache + 150, T.lache + 900, M.cote[2] - M.cote[0]], [T.reprise - 900, T.reprise - 200, M.cote[0] - M.cote[2]],
    [tC[0] + 200, tC[1] - 200, M.cote[3] - M.cote[0]], [tPart, tRet1, M.cote[4] - M.cote[3]],
  ]);
  const ZM = SOL + M.chariot;                                    // le dessus du chariot, où le robot est boulonné
  const tenue = (a) => (a >= T.prise[1] && a < T.lache) || (a >= T.reprise && a < T.lacheChaine);
  function manip(a) {
    const u = dep(a), p = [gx(u), gy(u), gz(u)], lc = lacet(u), x7 = p[0] + dxo(u);
    const base = { p: [x7, M.rail, ZM], lacet: Math.PI / 2 };
    // le roulis de la bride suit le lacet de la pièce : q6 = q1 + 90° − lacet (outil vertical), au même tour d'un instant à l'autre
    const q1 = Math.atan2(p[1] - M.rail, p[0] - x7) - Math.PI / 2;
    const q = BM.ik({ p, a: [0, 0, -1], h: [Math.cos(lc), Math.sin(lc), 0] }, base, [q1, 1.2, -1.6, 0, 0.9, q1 + Math.PI / 2 - lc]);
    return { p, lacet: lc, x7, base, q };
  }

  // ----- le palettiseur, au bout du convoyeur de sortie : il prend la jardinière refroidie et la pose sur la pile -----
  const BP = creerBras({ k: V9.robot.palettiseur, outil: 'ventouses' });
  const baseP = { p: [S.palettiseur, 0, SOL], lacet: Math.PI };
  const zPal = SOL + PAL.h, CASES = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([kx, ky]) => [S.palette[0] + kx * PAL.pas[0], S.palette[1] + ky * PAL.pas[1], zPal + t / 2]);
  const DER = CASES[3];                                          // la dernière place : devant, du côté du convoyeur
  const UP = T.prisePal - 2200, depP = (a) => (a < UP ? a + Tc : a);
  const hx = rampes(S.prise, [[T.prisePal + 300, T.pose - 300, DER[0] - S.prise], [T.pose + 500, T.pose + 1900, S.prise - DER[0]]]);
  const hy = rampes(0, [[T.prisePal + 300, T.pose - 300, DER[1]], [T.pose + 500, T.pose + 1900, -DER[1]]]);
  const hz = rampes(PAL.haut, [
    [T.prisePal - 450, T.prisePal, 1 - PAL.haut], [T.prisePal + M.ventouse, T.prisePal + 600, PAL.porteZ - 1],
    [T.pose - 450, T.pose, DER[2] + 1 - PAL.porteZ], [T.pose + 120, T.pose + 520, 420], [T.pose + 500, T.pose + 1900, PAL.haut - DER[2] - 421],
  ]);
  function palet(a) {
    const u = depP(a), p = [hx(u), hy(u), hz(u)];
    const q1 = Math.atan2(p[1], p[0] - S.palettiseur) - Math.PI;
    const q = BP.ik({ p, a: [0, 0, -1], h: [1, 0, 0] }, baseP, [wrapA(q1), 1.2, -1.6, 0, 0.9, wrapA(q1) + Math.PI]);
    return { p, q };
  }

  // ----- la caméra : elle suit le robot de manutention et sa pièce, puis la jardinière sur le convoyeur ; elle passe le
  // four, s'attarde sur la commande complète, et repart vers le laser de la ligne suivante -----
  const CA = V9.camera, enChaine = (dt) => S.chaine + V.chaine * dt;
  const cles = [
    [0, S.laser + CA.laser[0]], [CA.arrive, S.laser + CA.laser[1]], [T.prise[1] - 300, S.laser + CA.laser[2]],
    [tV[1] + 400, S.presseA + CA.presse[0]], [COUPS[1].t1, S.presseA + CA.presse[1]],
    [COUPS[2].t0 + 500, S.presseB + CA.presse[0]], [T.presse[1], S.presseB + CA.presse[1]],
    [tS[1] + 400, S.soudure + CA.soudure[0]], [T.soudure[1], S.soudure + CA.soudure[1]],
    [tC[1] + 500, enChaine(500) + CA.chaine],
    [T.prisePal - 300, S.bout + CA.palette[0]], [T.pose, S.bout + CA.palette[1]],
    [Tc, P + S.laser + CA.laser[0]],
  ];
  const camX = trajetCamera(cles, Tc, P, CA.lissage), camV = (tm) => (camX(tm + 2) - camX(tm - 2)) / 4;
  const CH = [
    { id: 'decoupe', t: 0 },
    { id: 'pliage', t: tV[0] + (tV[1] - tV[0]) * 0.6 },
    { id: 'soudure', t: tS[0] + (tS[1] - tS[0]) * 0.6 },
    { id: 'peinture', t: tC[0] + (tC[1] - tC[0]) * 0.6 },
  ];

  // le plateau de soudure : il fait demi-tour entre les deux passes (profil en S) ; un demi-tour le ramène à son dessin de départ
  const plateau = (a) => Math.PI * S5(seg(a, T.tour[0], T.tour[1]));

  // État d'une pièce à son âge
  function etat(age) {
    const f = full.bends.map(() => 0);
    let variant = 0; for (let i = 0; i < full.holes.length; i++) if (holeCut(i, age)) variant = i + 1;
    let rz = 0, c = [S.laser, 0], z = 0, punch = null, peinte = 0;
    if (age >= T.prise[1] && age < T.lache) { const u = age; c = [gx(u), gy(u)]; z = gz(u) - 1; rz = lacet(u); }   // tenue par le robot
    if (age >= T.presse[0]) {
      for (const st of T.coups) {
        if (age < st.t0) break;
        if (st.k === 'repos') continue;
        const over = 92 / 90;
        let fv = 0;
        if (age >= st.appui[0]) fv = over * EASE.appui(seg(age, st.appui[0], st.appui[1]));
        if (age >= st.ret[0]) fv = lerp(over, 1, EASE.retour(seg(age, st.ret[0], st.ret[1])));
        f[st.ps.bi] = fv;
        if (age < st.t1) {
          const open = V9.presse.ouverture, contact = t / 2, low = contact - 4;
          let zp;
          if (age < st.app[1]) zp = lerp(open, contact, APP(seg(age, st.app[0] - V9.presse.avance, st.app[1])));
          else if (age < st.maint[1]) zp = lerp(contact, low, EASE.appui(seg(age, st.appui[0], st.appui[1])));
          else zp = lerp(low, V9.presse.mi, RET(seg(age, st.ret[0], st.ret[1])));
          punch = { z: zp, poste: st.ps.poste };
        }
      }
      for (const st of T.coups) if (st.k === 'coup' && age >= st.t1) f[st.ps.bi] = 1;
    }
    if (age >= T.lache) { c = [S.soudure, 0]; z = 0; rz = plateau(age); }                                           // sur le plateau
    if (age >= T.reprise) { const u = age; c = [gx(u), gy(u)]; z = gz(u) - 1; rz = Math.PI + lacet(u); }             // reprise par le robot
    if (age >= T.lacheChaine) {
      // sur le convoyeur, à sa vitesse ; dans le four, elle ralentit et attend, cachée ; un cycle plus tard, elle sort,
      // cuite, et s'arrête au bout du convoyeur de sortie
      rz = Math.PI; z = 0;
      const xv = enChaine(age - tC[1]), sortie = S5(seg(age, Tc + T.sortie[0], Tc + T.sortie[1]));
      c = [(xv < S.four + 300 ? xv : S.four + 300 + (AT - S.four - 300) * (1 - Math.exp(-(xv - S.four - 300) / (AT - S.four - 300)))) + (S.prise - AT) * sortie, 0];
      if (age > T.chaine[1] + 2500) peinte = 1;                 // cuite : cachée dans le four à cet instant
    }
    if (age >= Tc + T.prisePal) { const p = palet(age - Tc).p; c = [p[0], p[1]]; z = p[2] - 1; peinte = 1; }         // prise par le palettiseur
    if (age >= Tc + T.pose) { c = [DER[0], DER[1]]; z = DER[2]; peinte = 1; }                                // sur la pile
    return { f, variant, rz, c, z, punch, peinte, posee: age >= Tc + T.pose, vis: age >= tCoupe && age < LIFE };
  }
  // le tablier de la presse : garé au-dessus du cadre hors de son travail ; il descend pendant que la pièce arrive et s'arrête
  // ouvert avant le premier coup, remonte pendant qu'elle repart vers la soudure
  const PARK_T = 1600;
  const tablier = (a, e) => {
    if (e && e.punch) return e.punch.z;
    // l'approche commence avant le coup, pendant que la pièce finit de se poser
    for (const st of COUPS) if (a >= st.app[0] - V9.presse.avance && a < st.app[0]) return lerp(V9.presse.ouverture, t / 2, APP(seg(a, st.app[0] - V9.presse.avance, st.app[1])));
    // après un coup, le poinçon est à mi-ouverture : il finit de s'ouvrir doucement
    let ouvert = V9.presse.ouverture; for (const st of COUPS) if (a >= st.t1 && a < st.t1 + V9.presse.fin) ouvert = lerp(V9.presse.mi, V9.presse.ouverture, S5(seg(a, st.t1, st.t1 + V9.presse.fin)));
    const dv = tV[1] - tV[0];
    return ouvert + PARK_T * (1 - APP(seg(a, tV[0], tV[0] + dv * 0.75))) + PARK_T * EASE.convoyeur(seg(a, tS[0] + 300, tS[1] + 400));
  };
  // les butées arrière d'un poste : reculées (120 mm), elles viennent au contact pendant que la pièce se pose, reculent dès
  // que le poinçon appuie (la paroi qui se lève les dégage)
  const butee = (a, poste) => {
    for (const st of T.coups) {
      if (st.k !== 'coup' || st.ps.poste !== poste) continue;
      if (a >= st.app[0] - PR.approche.ms && a < st.app[0]) return 120 * (1 - APP(seg(a, st.app[0] - PR.approche.ms, st.app[0])));
      if (a >= st.app[0] && a < st.appui[0]) return 0;
      if (a >= st.appui[0] && a < st.appui[0] + PR.retour.ms) return 120 * RET(seg(a, st.appui[0], st.appui[0] + PR.retour.ms));
    }
    return 120;
  };

  // ----- la cellule de soudure -----
  // avancement de chaque angle (passe 1 : les deux angles avant ; passe 2 : les deux autres, venus devant) : celui de la
  // torche, à vitesse constante entre deux rampes
  const ANGLES = [[0, 0], [A, 0], [A, B], [0, B]];
  const cordons = (age) => { const p1 = trapeze(seg(age, T.passe1[0], T.passe1[1])), p2 = trapeze(seg(age, T.passe2[0], T.passe2[1])); return [p1, p1, p2, p2]; };
  const arc = (a) => (a >= T.passe1[0] && a < T.passe1[1]) || (a >= T.passe2[0] && a < T.passe2[1]);
  // deux robots derrière le plateau, de part et d'autre (le robot de manutention sert le plateau par-devant) ; chacun soude
  // l'angle avant de son côté, en contournant le bout de la pièce. pied : position du socle par rapport à l'axe du plateau ;
  // repos : pose de repos (bras replié, torche vers le bas) ; vers : direction horizontale d'approche de la torche, dans
  // le secteur des deux faces de l'angle
  const BR = creerBras({ k: V9.robot.k });
  const robots = [-1, 1].map((cote) => {
    const pied = [cote * SO.pied[0], SO.pied[1]], vers = [-cote * SO.vers[0], SO.vers[1]];
    const base = { p: [S.soudure + pied[0], pied[1], SOL], lacet: Math.atan2(-pied[1], -pied[0]) }, repos = [cote * 12, 132, -148, 0, 60, 180].map((d) => d * RAD);
    // la pointe du fil, 2 mm hors de l'angle ; h vers le bas : le col de cygne se cambre vers le haut, le poignet est au-dessus
    const coin = (z, pente) => ({ p: [S.soudure + cote * (A / 2 + 2), -B / 2 - 2, z], a: norm([vers[0], vers[1], -pente]), h: [0, 0, -1] });
    const hors = (c, d) => ({ ...c, p: sub(c.p, mulS(c.a, d)) });
    const haut = coin(Hh - 8, SO.pente[0]), bas = coin(8, SO.pente[1]), pret = hors(haut, SO.pret), degage = hors(bas, SO.recul);
    const prog = programme(BR, base, repos, [
      { t: [T.lache - 300, T.soudure[0]], art: pret },                                         // le bras se présente quand la pièce est posée
      { t: T.approche1, lin: haut },
      { t: T.passe1, lin: bas, profil: trapeze },
      { t: T.degage1, lin: degage },
      { t: [T.degage1[1] + 40, T.tour[1] - 60], art: pret },                                   // il remonte pendant le demi-tour
      { t: T.approche2, lin: haut },
      { t: T.passe2, lin: bas, profil: trapeze },
      { t: T.degage2, lin: degage },
      { t: [T.degage2[1], T.degage2[1] + SO.retour], art: repos },
    ]);
    return { base, prog, cote };
  });

  // la tête du laser à l'instant a du cycle : position (repère du développé), hauteur au-dessus de la coupe, en coupe ou
  // non, perçage en cours, tracé du contour
  function tete(a) {
    const tau = a > Tc - LAS.prepare - 1 ? a - Tc : a;
    let hp = HOME, coupe = false, perce = false, trace = null, hz = LAS.garage;
    if (tau > tGare) return { hp, coupe, perce, trace, hz };
    for (const s of steps) {
      if (tau < s.t0) break;
      if (s.k === 'vide') { const u = seg(tau, s.t0, s.t1), kk = s.doux ? S5(u) : EASE.vide(u), sn = Math.sin(Math.PI * u); hp = [lerp(s.a[0], s.b[0], kk), lerp(s.a[1], s.b[1], kk)]; hz = lerp(s.z0, s.z1, S5(u)) + s.saut * sn * sn; }
      else if (s.k === 'percage') { hp = s.at; hz = 0; perce = tau < s.t1; }
      else if (s.k === 'coupe') {
        hz = 0;
        if (tau < s.t1) {
          const L = s.prof.sA(tau - s.t0), at = s.prof.point(L);
          hp = at.p; coupe = true;
          if (s.idx === 'contour') trace = [...s.prof.P.slice(0, at.i), at.p];
        } else hp = s.pts[0];
      }
    }
    return { hp, coupe, perce, trace, hz };
  }
  // la tôle sur la palette du laser : neuve au début du cycle ; le squelette reste après la prise du flan, puis le changeur
  // de palettes en amène une neuve, hors du cadre
  const toleNeuve = (a) => a < tCoupe || a >= M.palette;
  return { full, variants, steps, T, LIFE, Tc, P, S, CH, LONG, COUPS, etat, cordons, arc, plateau, robots, BR, BM, BP, baseP, manip, palet, tenue, CASES, zPal, toleNeuve, tete, tablier, butee, coupe, ANGLES, C0, A, B, Hh, t, SOL, SHEET, HOME, tCoupe, BEAM, GUN, poses, camX, camV, cles, V: V.chaine, M, PLAN };
}
﻿
// ---------- montage : trame, arêtes, valeurs ----------
export function mountFilm(host, { couleurs, teinte, pas = 3, oriente = true, onValeurs = null, onChapitre = null, reduced = null, autoplay = true, el = 27, az = -121 } = {}) {
  const rm = reduced ?? prefersReduced();
  const F = filmAtelier();
  const { T, S, P, Tc, A, B, Hh, BR } = F;
  const canvas = document.createElement('canvas'), ink = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true'); ink.setAttribute('aria-hidden', 'true'); canvas.className = 'film-trame'; ink.className = 'film-encre';
  host.prepend(canvas, ink);
  const LUM = norm([-0.8, -0.35, 0.55]), AMB = 0.24;
  // moteur : WebGL2 (trame attachée à la matière) ; sinon, l'ancienne trame d'écran en 2D (repli)
  const tr = createTrace(canvas, { couleurs, teinte, aplat: 0.85, ep: [0.05, 0.92], lum: LUM, amb: AMB, chauds: [ILLU.chaud, ILLU.etincelle, TOK.ambre] });
  const grav = tr ? null : createGravure(canvas, { pas, ep: [0.05, 0.92], epFond: 0, teinte, aplat: 0.85, oriente, packed: true, colx: 2, ...couleurs });
  const ENCRE = couleurs.trait1, TRAIT2 = couleurs.trait0, PAPIER = couleurs.fond, POUDRE = teinte || couleurs.trait1;

  // caméra : trois quarts, plongée, de loin ; elle regarde un point qui glisse le long de x (F.camX)
  const DIST = 16000, FOV = 11;
  const camAt = (x) => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, tg = [x, 140, 170]; const c = camera({ eye: [tg[0] + DIST * Math.cos(e) * Math.cos(a), tg[1] + DIST * Math.cos(e) * Math.sin(a), tg[2] + DIST * Math.sin(e)], target: tg, fov: FOV }); c.t = tg; return c; };
  const CAM0 = camAt(0), VUE = CAM0.f; // l'orientation ne change pas pendant le travelling
  // la poudre (à verser dans MOTION.poudre) : élévateur à 1,3 s l'aller-retour (course 160 mm, environ 0,25 m/s), deux pistolets
  // à 160 mm l'un de l'autre, empreinte de 110 mm (en x) sur 55 mm (en z) à la face, saturation 6 ; grains : un toutes les
  // 7 ms par buse, 260 ms de vol ; la période est ajustée pour diviser le cycle (les élévateurs bouclent avec lui)
  const PDR = { per: Tc / Math.round(Tc / 1300), course: 80, zc: 70, ecart: 160, sx: 110, sz: 55, k: 6, dte: 7, vol: 260 };
  const ASIN98 = Math.asin(0.98);
  const zPistolet = (tau, ph = 0) => PDR.zc + PDR.course * Math.asin(0.98 * Math.sin((2 * Math.PI * tau) / PDR.per + ph)) / ASIN98;
  const W_MONDE = () => (host.clientWidth >= 900 ? 3300 : 2900);
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
  // ton d'une face : l'éclairage (Lambert, deux faces), puis la part de son groupe ; l'intérieur du four reste sombre.
  // Les maillages envoyés une fois font ce calcul dans le shader (ils peuvent tourner) ; la pièce, recalculée à chaque image, ici.
  const FACT = { piece: 1, piecePeinte: 1, tole: 1, sol: 0.5, outil: 0.6, four: 0.6, cabine: 0.42 };
  const tonDe = (n, g) => {
    if (g === 'dedans') return 0.9;
    let ndl = dot(n, LUM); if (dot(n, VUE) > 0) ndl = -ndl;
    return clamp((1 - (AMB + (1 - AMB) * Math.max(0, ndl))) * (FACT[g] ?? 0.6));
  };
  const gOf = (p) => p.g || (p.meta && p.meta.g);

  // ----- la bibliothèque du décor : chaque objet dans son repère, posé à son poste par un décalage (ou une rotation) -----
  const RAIL = F.M.rail, XR = [S.laser + 350, S.chaine + 800], XM = (XR[0] + XR[1]) / 2, zPal = F.zPal;
  const OU = { g: 'outil' }, DX_TETE = 160; // la tête est portée devant la poutre, côté caméra, à 160 mm de son axe
  const MAILLES = {
    palette: decor(box(-760, 760, -560, 560, -46, -6, { g: 'sol' })),
    // le portique du laser : deux rails et leurs glissières ; la poutre sur ses deux sommiers ; le chariot (une platine devant
    // la poutre, une potence qui tient la chaîne porte-câbles au-dessus d'elle) ; le coulisseau vertical et la tête (corps,
    // optique, buse)
    rails: decor([...box(-760, 990, -664, -604, -46, 26, OU), ...box(-760, 990, 604, 664, -46, 26, OU), ...box(-750, 980, -644, -624, 26, 36, OU), ...box(-750, 980, 624, 644, 26, 36, OU)]),
    traverse: decor([...box(-92, 92, -684, -584, 36, 250, OU), ...box(-92, 92, 584, 684, 36, 250, OU), ...box(-70, 70, -684, 684, 250, 390, OU)]),
    chariotLaser: decor([...box(-120, -70, -96, 96, 206, 412, OU), ...box(-120, 47, -12, 12, 412, 478, OU)]),
    teteLaser: decor([...box(-40, 40, -46, 46, 170, 452, OU), ...cyl([0, 0, 96], [0, 0, 170], 34, OU, 16), ...cyl([0, 0, 50], [0, 0, 96], 22, OU, 12), ...cyl([0, 0, 9], [0, 0, 50], 6, OU, 12, 19)]),
    // le sol de la ligne : les marquages de zones autour de chaque poste (un trait continu), l'allée de circulation derrière
    // la ligne (deux traits, parallèles au travelling : ils glissent sur eux-mêmes) ; rien n'est peint, seuls des traits clairs
    sol: (() => {
      const z = F.SOL + 0.5, cadre = (x0, x1, y0, y1) => [[[x0, y0, z], [x1, y0, z]], [[x1, y0, z], [x1, y1, z]], [[x1, y1, z], [x0, y1, z]], [[x0, y1, z], [x0, y0, z]]];
      const traits = [
        ...cadre(S.laser - 900, S.laser + 1100, -740, 760), ...cadre(S.presseA - 620, S.presseB + 620, -110, 520),
        ...cadre(S.soudure - 1080, S.soudure + 1080, -560, 600), ...cadre(S.chaine - 700, S.sortie + 60, -1250, 760), ...cadre(S.sortie + 120, S.bout + 1180, -330, 1100),
      ].map(([a, b]) => [a, b, 0, 0.55]);
      for (const y of [1320, 1700]) traits.push([[S.laser - 1000, y, z], [S.laser - 1000 + P, y, z], 0, 0.55]);
      return [{ kind: 'face', meta: { g: 'sol', u: [1, 0, 0] }, n: [0, 0, 1], pts: [[S.laser, 0, z], [S.laser + 4, 0, z], [S.laser + 4, 4, z]], uv: [[0, 0], [4, 0], [4, 4]], traits, aretes: [false, false, false] }];
    })(),
    // le rail au sol qui longe la ligne, du laser au convoyeur (le septième axe du robot de manutention) : une semelle, deux
    // rails, deux butées de fin de course ; son chariot, avec le bras qui tient la chaîne porte-câbles
    railManip: decor([...box(XR[0], XR[1], RAIL - 130, RAIL + 130, F.SOL, F.SOL + 12, { g: 'sol' }), ...box(XR[0], XR[1], RAIL - 105, RAIL - 75, F.SOL + 12, F.SOL + 40, OU), ...box(XR[0], XR[1], RAIL + 75, RAIL + 105, F.SOL + 12, F.SOL + 40, OU),
      ...box(XR[0] - 30, XR[0], RAIL - 130, RAIL + 130, F.SOL, F.SOL + 70, OU), ...box(XR[1], XR[1] + 30, RAIL - 130, RAIL + 130, F.SOL, F.SOL + 70, OU)]),
    chariotManip: decor([...box(-215, 215, RAIL - 165, RAIL + 165, F.SOL + 40, F.SOL + F.M.chariot, OU), ...box(-60, 60, RAIL - 285, RAIL - 165, F.SOL + 56, F.SOL + 88, OU)]),
    // la palette de la commande (un plancher sur trois semelles, quatre places en carré), et une jardinière finie, peinte et cuite
    palette4: decor([...box(-860, 860, -340, 340, zPal - 22, zPal, OU), ...[-290, 0, 290].flatMap((y) => box(-860, 860, y - 50, y + 50, F.SOL, zPal - 22, OU))]),
    jardiniere: (() => {
      const pt = F.variants[3], fo = fold(pt, 1), ctr = (q) => [q[0] - F.C0[0], q[1] - F.C0[1], q[2]];
      return mesh(pt, fo).filter((p) => p.kind !== 'bore').map((p) => {
        const M = fo.M.get(p.face), cx = [M[0], M[3], M[6]], cy = [M[1], M[4], M[7]], Tm = [M[9], M[10], M[11]];
        const uvL = (q) => { const d = sub(q, Tm); return [dot(d, cx) - F.C0[0], dot(d, cy) - F.C0[1]]; };
        const trous = p.holes && p.holes.length ? p.holes : null;
        return { kind: p.kind, pts: p.pts.map(ctr), uv: p.pts.map(uvL), holes: trous ? trous.map((H) => H.map(ctr)) : undefined, huv: trous ? trous.map((H) => H.map(uvL)) : undefined, meta: { g: 'piecePeinte', u: [1, 0, 0] }, peint: (p.kind === 'face' && p.side === 'top' ? 0.72 : 1) + 2 };
      });
    })(),
    matrice: decor(prismX([[-40, -150], [40, -150], [40, -1], [9, -1], [0, -11], [-9, -1], [-40, -1]], -1500, 1500, OU)),
    // le tablier de la presse et ses deux postes d'outillage, autour du milieu de la presse ; poinçons en col de cygne :
    // le profil se creuse du côté de la paroi qui se lève, pour la dégager (sinon elle traverse le corps du poinçon)
    outillage: decor([
      ...box(-1500, 1500, -46, 46, 320, 410, OU),
      ...moved(prismX([[-74, 320], [-12, 320], [-12, 64], [3, 10], [0, 0], [-6, 12], [-74, 96]], -400, 400, OU), -F.BEAM / 2),
      ...moved(prismX([[-74, 320], [-12, 320], [-12, 64], [3, 10], [0, 0], [-6, 12], [-74, 96]], -(B - 2 * F.t - 2) / 2, (B - 2 * F.t - 2) / 2, OU), F.BEAM / 2),
    ]),
    // la butée arrière d'un poste : une traverse posée au sol derrière la matrice, deux doigts qui viennent toucher le bord
    // de la paroi à plier
    buteeA: decor([...box(-300, 300, 40, 90, -40, 24, OU), ...box(-276, -244, 0, 40, 0, 24, OU), ...box(244, 276, 0, 40, 0, 24, OU)]),
    buteeB: decor([...box(-120, 120, 40, 90, -40, 24, OU), ...box(-106, -74, 0, 40, 0, 24, OU), ...box(74, 106, 0, 40, 0, 24, OU)]),
    // le plateau tournant de la cellule de soudure : un pied fixe, un plateau à quatre rainures (on le voit tourner)
    piedPlateau: decor(cyl([0, 0, F.SOL], [0, 0, -28], 300, { g: 'sol' }, 32)),
    plateau: (() => {
      const p = tramer(cyl([0, 0, -28], [0, 0, -2], 470, OU, 48), [1, 0, 0], [0, 1, 0]);
      p[1].traits = [0, 1, 2, 3].map((k) => { const a = Math.PI / 4 + (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a); return [[90 * c, 90 * s, -2], [440 * c, 440 * s, -2]]; });
      return p;
    })(),
    // la cabine, en écorché (origine : l'axe des pistolets) : seule la paroi du fond reste, avec son chant
    cabine: (() => {
      const xa = F.S.cabine[0] - F.S.rideau, xb = F.S.cabine[1] - F.S.rideau, y1 = 620, z1 = 640, e = 24;
      return decor([
        { ...quad([xa, y1, -40], [xb, y1, -40], [xb, y1, z1], [xa, y1, z1], { g: 'cabine' }), holes: [[[-30, y1, -16], [30, y1, -16], [30, y1, PDR.zc + PDR.ecart + PDR.course + 34], [-30, y1, PDR.zc + PDR.ecart + PDR.course + 34]]] },   // paroi du fond, fendue pour les pistolets
        quad([xa, y1, z1], [xb, y1, z1], [xb, y1 + e, z1], [xa, y1 + e, z1], { g: 'cabine' }),              // chant du haut
      ]);
    })(),
    // un élévateur (réciprocateur) devant la cabine : colonne et pied ; le chariot et ses deux pistolets glissent sur la colonne
    elevateur: decor([...box(-46, 46, -1130, -1050, -40, 470, OU), ...box(-120, 120, -1170, -1010, -46, -30, OU)]),
    chariot: (() => {
      const out = decor(box(-58, 58, -1046, -1010, -36, PDR.ecart + 36, OU));
      for (const dz of [0, PDR.ecart]) {
        out.push(...decor(cyl([0, -1030, dz], [0, -B / 2 - 296, dz], 15, OU, 12), [0, 0, dz]));      // le corps du pistolet
        out.push(...decor(cyl([0, -B / 2 - 300, dz], [0, -B / 2 - 236, dz], 22, OU, 12), [0, 0, dz])); // la buse
      }
      return out;
    })(),
    // l'élévateur du fond : les pistolets passent par une fente de la paroi (le chariot est derrière elle)
    chariotArr: (() => {
      const out = [];
      for (const dz of [0, PDR.ecart]) {
        out.push(...decor(cyl([0, 640, dz], [0, B / 2 + 296, dz], 15, OU, 12), [0, 0, dz]));
        out.push(...decor(cyl([0, B / 2 + 300, dz], [0, B / 2 + 236, dz], 22, OU, 12), [0, 0, dz]));
      }
      return out;
    })(),
    // le convoyeur : un bâti et des rouleaux, du point de pose jusqu'au bout de la ligne, à travers le four
    convoyeur: (() => {
      const x0 = -620, x1 = S.bout - S.chaine, out = decor(box(x0, x1, -230, 230, -46, -24, { g: 'sol' }));
      for (let x = x0 + 70; x < x1 - 20; x += 160) out.push(...decor(cyl([x, -230, -18], [x, 230, -18], 16, OU, 10), [x, 0, -18]));
      return out;
    })(),
    // le four tunnel : la pièce y entre par la bouche, s'enfonce dans le noir (un fond sombre à 260 mm), en ressort au bout
    four: (() => {
      const x0 = 0, x1 = F.PLAN.four, xr = 260, y0 = -360, y1 = 360, z1 = 560, oy = 250, oz = 420, e = 26;
      return decor([
        quad([x0 + e, y1 - e, -40], [xr, y1 - e, -40], [xr, y1 - e, z1 - e], [x0 + e, y1 - e, z1 - e], { g: 'dedans' }),
        quad([xr, y0 + e, -40], [xr, y0 + e, z1 - e], [xr, y1 - e, z1 - e], [xr, y1 - e, -40], { g: 'dedans' }),
        quad([x0 + e, y0 + e, -40], [xr, y0 + e, -40], [xr, y1 - e, -40], [x0 + e, y1 - e, -40], { g: 'dedans' }),
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
  // les solides du bras articulé (leur trame et leurs normales sont déjà dans leur repère)
  for (const n of BR.noms) { MAILLES[`bras:${n}`] = BR.pieces[n]; MAILLES[`manip:${n}`] = F.BM.pieces[n]; MAILLES[`pal:${n}`] = F.BP.pieces[n]; }
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
  // un maillage sur la carte : ton selon la normale (dans le shader), arêtes vues décidées dans le shader ; la tôle ne trace
  // que ses découpes, à l'encre ; le sol et l'intérieur du four n'ont pas d'arêtes ; outils, robots et four en trait clair
  const mGL = new Map();
  const mailleGL = (nom) => {
    let m = mGL.get(nom);
    if (!m) {
      m = tr.maille(MAILLES[nom].map((f) => {
        const g = gOf(f);
        if (g === 'dedans') return faceGL(f, { ton: 0.9, cuit: true, aretes: false });
        if (g === 'tole') return faceGL({ ...f, aretes: f.pts.map(() => false) }, { ton: FACT.tole, w: 1.25, c: 0 });
        if (g === 'piecePeinte') return faceGL(f, { ton: FACT.piece, w: 1.25, c: 0, aretes: f.kind === 'face', peint: f.peint });
        return faceGL(f, { ton: FACT[g] ?? 0.6, aretes: g !== 'sol' || !!f.traits });
      }));
      mGL.set(nom, m);
    }
    return m;
  };

  // tout le décor part sur la carte au montage (tôle dans ses cinq états compris) : aucune construction pendant la lecture
  const trousA = (tau) => (tau >= F.M.palette ? [] : tau >= F.tCoupe ? [F.full.outline] : F.full.holes.filter((_, i) => { const s = F.steps.find((x) => x.k === 'coupe' && x.idx === i); return s && tau >= s.t1; }));
  if (tr) {
    for (const tau of [0, ...F.steps.filter((x) => x.k === 'coupe').map((x) => x.t1), F.tCoupe]) tole(trousA(tau), tau >= F.tCoupe);
    for (const nom of Object.keys(MAILLES)) mailleGL(nom);
  }

  const surPli = (p, q, bd) => [p, q].every((r) => { const abx = bd.b[0] - bd.a[0], aby = bd.b[1] - bd.a[1], L = Math.hypot(abx, aby), k = ((r[0] - bd.a[0]) * abx + (r[1] - bd.a[1]) * aby) / (L * L); return Math.abs((r[0] - bd.a[0]) * aby - (r[1] - bd.a[1]) * abx) / L < 1e-3 && k > -1e-6 && k < 1 + 1e-6; });
  const PLIS = F.variants.map((v) => v.faces.map((f) => f.loop.map((p, i) => v.bends.findIndex((bd) => surPli(p, f.loop[(i + 1) % f.loop.length], bd)))));
  // le faisceau de la torche : du dévidoir (sur l'avant-bras) à l'arrière du corps de torche
  const CABLE = [[108 * BR.D.L3 / 440, -9, 104 * BR.D.L3 / 440], [44, 0, 0]];

  let view = null, cam = CAM0, ortho = !!tr;
  const proj = (p) => {
    const v = sub(p, ortho ? cam.t : cam.eye), x = dot(v, cam.r), y = dot(v, cam.u);
    if (ortho) return [view.cx + x * view.s, view.cy - y * view.s];
    const z = dot(v, cam.f); return [view.cx + (x * cam.k / z) * view.s, view.cy - (y * cam.k / z) * view.s];
  };

  // ----- une chaîne porte-câbles : un ruban couché sur son appui, qui remonte en demi-cercle et revient vers ce qu'il
  // alimente. O : un point de l'appui sur l'axe du ruban ; d : le sens du ruban (la boucle est du côté +d) ; l : le travers ;
  // sf, sm : le bout fixe (en bas) et le bout mobile (en haut), le long de d ; vm : la vitesse du bout mobile ; L : la somme
  // des deux brins droits. La trame suit la longueur du ruban (une ligne par maillon, en travers) : elle court avec lui.
  const CPC = { R: 44, larg: 62, ep: 16, n: 4 };
  function chaine(out, O, d, l, sf, sm, vm, L) {
    const { R, larg, ep, n } = CPC, sb = (L + sf + sm) / 2, l1 = sb - sf, w = larg / 2, e = ep / 2;
    // sections de la fibre neutre : [position le long de d, hauteur, abscisse le long du ruban, part de la vitesse, normale extérieure (d, z)]
    const sec = [[sf, e, 0, 0, [0, -1]], [sb, e, l1, 0, [0, -1]]];
    for (let j = 1; j <= n; j++) { const th = (Math.PI * j) / n; sec.push([sb + R * Math.sin(th), e + R * (1 - Math.cos(th)), l1 + R * th, j / n, [Math.sin(th), -Math.cos(th)]]); }
    sec.push([sm, e + 2 * R, l1 + Math.PI * R + (sb - sm), 1, [0, 1]]);
    const pt = (c, ke, kw) => add(O, add(mulS(d, c[0] + c[4][0] * e * ke), add(mulS(l, w * kw), [0, 0, c[1] + c[4][1] * e * ke])));
    const face = (pts, uv, nrm, kv, ar) => {
      if (dot(newell(pts), nrm) < 0) { pts.reverse(); uv.reverse(); kv.reverse(); }
      out.faces.push({ kind: 'face', g: 'outil', pts, uv, vits: kv.map((x) => mulS(d, x * vm)), ar, meta: { g: 'outil', u: [...d] } });
    };
    for (let i = 0; i + 1 < sec.length; i++) {
      const a = sec[i], b = sec[i + 1], nm = norm([a[4][0] + b[4][0], a[4][1] + b[4][1]]), ext = add(mulS(d, nm[0]), [0, 0, nm[1]]);
      for (const ke of i === 0 ? [-1] : [1, -1]) { // face extérieure (sauf sous le brin posé), face intérieure
        const p = [pt(a, ke, -1), pt(a, ke, 1), pt(b, ke, 1), pt(b, ke, -1)];
        face(p, [[-w, a[2]], [w, a[2]], [w, b[2]], [-w, b[2]]], mulS(ext, ke), [a[3], a[3], b[3], b[3]], [[p[0], p[3]], [p[1], p[2]]]);
      }
      for (const kw of [-1, 1]) { // les deux chants
        const p = [pt(a, -1, kw), pt(a, 1, kw), pt(b, 1, kw), pt(b, -1, kw)];
        face(p, [[-e, a[2]], [e, a[2]], [e, b[2]], [-e, b[2]]], mulS(l, kw), [a[3], a[3], b[3], b[3]], [[p[0], p[3]], [p[1], p[2]]]);
      }
    }
  }

  // ----- la scène à l'instant tm : le décor posé à ses postes (instances), les solides articulés, les pièces et leur ombre
  // (faces), les tracés. Toutes les lignes de l'atelier sont au même instant a du cycle ; chaque ligne porte une pièce par
  // cycle écoulé depuis sa découpe (âges a, a + Tc, a + 2 Tc) -----
  const H_VIT = 8; // ms : pas de dérivation des vitesses
  function robot(out, B, prefixe, q, q0, base, base0) {
    const f = B.fk(q, base), f0 = B.fk(q0, base0);
    for (const n of B.noms) out.sol.push([`${prefixe}:${n}`, f[n], f0[n]]);
    return f;
  }
  // la pièce pliée (ses faces dans le repère du développé) : gardée tant qu'aucun pli n'est en cours (à plat, entre deux
  // coups de presse, finie) ; recalculée à chaque image seulement pendant qu'un pli se forme
  const PLIEES = new Map();
  function pliee(st) {
    const fige = st.f.every((x) => x === 0 || x === 1), cle = fige ? `${st.variant}:${st.f.join('')}` : null;
    let r = cle && PLIEES.get(cle);
    if (!r) { const pt = F.variants[st.variant], fo = fold(pt, (i) => st.f[i]); r = { fo, list: mesh(pt, fo).filter((p) => p.kind !== 'bore') }; if (cle) PLIEES.set(cle, r); }
    return r;
  }
  // une pièce à son âge, sur la ligne décalée de o
  function dessinerPiece(out, age, o) {
    const e = F.etat(age);
    if (!e.vis) return;
    if (e.posee) { out.inst.push(['jardiniere', [e.c[0] + o, e.c[1], e.z], null]); return; }   // sur la palette : un maillage fixe
    const pieceA = (st) => {
      const cs2 = Math.cos(st.rz), sn2 = Math.sin(st.rz);
      const trp = (q) => { const x = q[0] - F.C0[0], y = q[1] - F.C0[1]; return [st.c[0] + o + cs2 * x - sn2 * y, st.c[1] + sn2 * x + cs2 * y, q[2] + st.z]; };
      return { ...pliee(st), trp };
    };
    const cur = pieceA(e), prev = pieceA(F.etat(age - H_VIT));
    const memes = prev.list.length === cur.list.length;
    const enChaine = age >= T.chaine[0], cut = enChaine ? [S.rideau + o, 1e9] : null;
    const expo = (p) => (p.kind === 'face' && p.side === 'top' ? 0.72 : 1); // cage de Faraday : l'intérieur se poudre moins
    const lever = e.peinte ? 0 : lisse(0.5, 14, e.z);
    const plis = PLIS[e.variant];
    cur.list.forEach((p, i) => {
      const M = cur.fo.M.get(p.face) || [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
      const cx = [M[0], M[3], M[6]], cy = [M[1], M[4], M[7]], Tm = [M[9], M[10], M[11]];
      const uvL = (q) => { const d = sub(q, Tm); return [dot(d, cx) - F.C0[0], dot(d, cy) - F.C0[1]]; }; // le grain du développé
      const pts = p.pts.map(cur.trp), q2 = memes && prev.list[i].pts.length === p.pts.length ? prev.list[i].pts.map(prev.trp) : null;
      const holes = p.holes && p.holes.length ? p.holes.map((H) => H.map(cur.trp)) : undefined;
      let vits = q2 ? pts.map((q, j) => mulS(sub(q, q2[j]), 1 / H_VIT)) : null;
      if (vits && holes) {
        const ph = prev.list[i].holes;
        if (ph && ph.length === holes.length && ph.every((H, k) => H.length === holes[k].length)) { const h2 = ph.map((H) => H.map(prev.trp)); holes.forEach((H, k) => H.forEach((q, c) => vits.push(mulS(sub(q, h2[k][c]), 1 / H_VIT)))); }
        else vits = null;
      }
      const ax = [cx[0] * Math.cos(e.rz) - cx[1] * Math.sin(e.rz), cx[0] * Math.sin(e.rz) + cx[1] * Math.cos(e.rz), cx[2]];
      // les arêtes du contour qui sont des lignes de pli, et l'avancement de leur pli (trait mixte fin tant que le pli est à plat)
      let lp = null;
      if (p.kind === 'face') { const n = p.pts.length, mk = plis[p.face]; lp = p.pts.map((_, j) => { const b = mk[p.side === 'top' ? j : (2 * n - 2 - j) % n]; return b < 0 ? -1 : e.f[b]; }); }
      out.faces.push({ kind: p.kind, side: p.side, g: 'piece', pts, uv: p.pts.map(uvL), holes, huv: p.holes && p.holes.length ? p.holes.map((H) => H.map(uvL)) : undefined, vits, cut, peint: e.peinte ? expo(p) + 2 : enChaine ? expo(p) : 0, plis: lp,
        cle: p.kind === 'face' ? `p:${e.variant}:${p.face}:${p.side}` : null, meta: { g: 'piece', u: ax } });
      // ombre portée : la pièce levée pose une ombre douce sur le sol (plus claire avec la hauteur) ; posée, rien
      if (lever > 0 && p.kind === 'face' && p.side === 'top') {
        const tons = pts.map((q) => 0.5 * lever * (1 - lisse(0, 520, q[2] - F.SOL)));
        out.faces.push({ kind: 'face', g: 'ombre', pts: pts.map((q, j) => [q[0], q[1], F.SOL + 1 + tons[j]]), uv: pts.map((q) => [q[0], q[1]]), n: [0, 0, 1], tons, holes: holes && holes.map((H) => H.map((q) => [q[0], q[1], F.SOL + 1])), huv: holes && holes.map((H) => H.map((q) => [q[0], q[1]])), vits: vits && vits.map((v) => [v[0], v[1], 0]), cle: `o:${e.variant}:${p.face}` });
      }
    });
    // les cordons de soudure, de haut en bas le long de chaque angle ; n : la bissectrice sortante de l'angle (le cordon
    // s'efface quand son angle se détourne de la caméra), t : le travers du cordon ; chaud : le bout encore chaud
    const cord = F.cordons(age), cr = Math.cos(e.rz), sr = Math.sin(e.rz), passe = age < T.tour[0] ? T.passe1 : T.passe2;
    const sousPoudre = e.peinte ? 0 : 1 - lisse(S.rideau - 250, S.rideau + 450, e.c[0]);   // la poudre couvre les cordons
    if (sousPoudre <= 0) return;
    F.ANGLES.forEach((q, i) => {
      if (cord[i] <= 0) return;
      const w = cur.trp([q[0], q[1], 0]), bx = Math.sign(q[0] - F.C0[0]), by = Math.sign(q[1] - F.C0[1]);
      const n = norm([cr * bx - sr * by, sr * bx + cr * by, 0]), a = [w[0] + n[0] * 2, w[1] + n[1] * 2, e.z + Hh - 2];
      out.vect.push({ k: 'cordon', a, b: [a[0], a[1], a[2] - (Hh - 4) * cord[i]], n, t: [-n[1], n[0], 0], p: cord[i], face: clamp(-dot(n, VUE) / 0.12) * sousPoudre, arriere: w[1] > e.c[1] + 1, chaud: (i < 2) === (passe === T.passe1) ? age - passe[1] : 1e9, peinte: enChaine });
    });
  }
  function scene(tm, xcam = null) {
    const out = { inst: [], sol: [], faces: [], vect: [] };
    const pose = (nom, off, vit) => out.inst.push([nom, off, vit || null]);
    // ce qui peut être vu : la demi-largeur du cadre le long de x, plus une marge (un objet en avant ou en arrière du plan de
    // travail se décale à l'écran)
    const xc = xcam ?? F.camX(tm), half = W_MONDE() * 0.6 + 900;
    const inView = (x0, x1 = x0, marge = 450) => x1 > xc - W_MONDE() * 0.6 - marge && x0 < xc + W_MONDE() * 0.6 + marge;
    const a = ((tm % Tc) + Tc) % Tc, a0 = a - H_VIT;
    const mMin = Math.floor((xc - half - S.palettiseur - 600) / P) - 1, mMax = Math.ceil((xc + half - S.laser + 800) / P) + 1;
    for (let m = mMin; m <= mMax; m++) {
      const o = m * P;
      pose('sol', [o, 0, 0]);
      // laser : palette, tôle (entière, puis squelette), portique (rails, poutre, chariot, tête), chaîne porte-câbles
      if (inView(S.laser + o - 800, S.laser + o + 1000)) {
        const xl = S.laser + o;
        pose('palette', [xl, 0, 0]); pose('rails', [xl, 0, 0]);
        pose(tole(trousA(a), a >= F.tCoupe && a < F.M.palette), [xl, 0, 0]);
        const hd = F.tete(a), h2 = F.tete(a0);
        const hx = xl + hd.hp[0] - F.C0[0], hy = hd.hp[1] - F.C0[1], vx = (hd.hp[0] - h2.hp[0]) / H_VIT, vy = (hd.hp[1] - h2.hp[1]) / H_VIT, vz = (hd.hz - h2.hz) / H_VIT;
        pose('traverse', [hx + DX_TETE, 0, 0], [vx, 0, 0]);
        pose('chariotLaser', [hx + DX_TETE, hy, 0], [vx, vy, 0]);
        pose('teteLaser', [hx, hy, hd.hz], [vx, vy, vz]);
        // la chaîne porte-câbles du chariot, sur la poutre (celle de la poutre court derrière le rail du fond, hors de vue)
        if (inView(xl - 800, xl + 1000, 300)) chaine(out, [hx + DX_TETE + 16, 0, 390], [0, 1, 0], [1, 0, 0], -60, hy, vy, 630);
        if (hd.coupe || hd.perce) out.vect.push({ k: 'faisceau', a: [hx, hy, 9], b: [hx, hy, 0], tm: a, v: [vx, vy], coupe: hd.coupe });
        if (hd.trace) out.vect.push({ k: 'trait', pts: hd.trace.map((q) => [xl + q[0] - F.C0[0], q[1] - F.C0[1], 0]) });
      }
      // presse : la matrice, les butées, le tablier et ses deux poinçons (descendus d'un bloc)
      if (inView(S.presseA + o - 700, S.presseB + o + 700)) {
        const xm = (S.presseA + S.presseB) / 2 + o, e = a >= T.presse[0] && a < T.presse[1] ? F.etat(a) : null, e2 = a0 >= T.presse[0] && a0 < T.presse[1] ? F.etat(a0) : null;
        pose('matrice', [xm, 0, 0]);
        const zT = F.tablier(a, e), zT2 = F.tablier(a0, e2);
        pose('outillage', [xm, 0, zT], [0, 0, (zT - zT2) / H_VIT]);
        for (const [poste, xP] of [['A', S.presseA + o], ['B', S.presseB + o]]) {
          const yb = F.butee(a, poste), yb2 = F.butee(a0, poste);
          pose(poste === 'A' ? 'buteeA' : 'buteeB', [xP, Hh + 8 + yb, 0], [0, (yb - yb2) / H_VIT, 0]);
        }
      }
      // le rail qui longe la ligne, son chariot et le robot de manutention, la chaîne porte-câbles du chariot
      if (inView(XR[0] + o, XR[1] + o, 700)) {
        pose('railManip', [o, 0, 0]);
        const mn = F.manip(a), m0 = F.manip(a0), x7 = mn.x7 + o, v7 = (mn.x7 - m0.x7) / H_VIT;
        chaine(out, [o, RAIL - 250, F.SOL], [1, 0, 0], [0, 1, 0], XM, mn.x7, v7, XR[1] - XM);
        if (inView(x7 - 1500, x7 + 1500, 700) && mn.q && m0.q) {
          pose('chariotManip', [x7, 0, 0], [v7, 0, 0]);
          robot(out, F.BM, 'manip', mn.q, m0.q, { p: [x7, RAIL, mn.base.p[2]], lacet: mn.base.lacet }, { p: [m0.x7 + o, RAIL, mn.base.p[2]], lacet: mn.base.lacet });
        }
      }
      // soudure : le plateau tournant, les deux robots et leurs torches
      if (inView(S.soudure + o - 1100, S.soudure + o + 1100)) {
        const xs = S.soudure + o, ctr = [xs, 0, 0];
        pose('piedPlateau', ctr);
        out.sol.push(['plateau', { R: rotZ(F.plateau(a)), p: ctr }, { R: rotZ(F.plateau(a0)), p: ctr }]);
        for (const rb of F.robots) {
          const base = { p: [rb.base.p[0] + o, rb.base.p[1], rb.base.p[2]], lacet: rb.base.lacet };
          const f = robot(out, BR, 'bras', rb.prog.q(a), rb.prog.q(a0), base, base);
          out.vect.push({ k: 'cable', a: add(f.avant.p, app3(f.avant.R, CABLE[0])), b: add(f.outil.p, app3(f.outil.R, CABLE[1])), d: app3(f.outil.R, [-1, 0, 0]) });
          if (F.arc(a)) out.vect.push({ k: 'arc', at: f.pointe.p, tm: a, n: app3(f.pointe.R, [-1, 0, 0]) });
        }
      }
      // peinture : le convoyeur, la cabine et ses deux élévateurs, le four tunnel ; le dépôt et le nuage de poudre
      if (inView(S.chaine + o - 700, S.bout + o + 100)) {
        const xg = S.rideau + o, zg = zPistolet(a), zg2 = zPistolet(a, Math.PI);
        const vz = (zg - zPistolet(a0)) / H_VIT, vz2 = (zg2 - zPistolet(a0, Math.PI)) / H_VIT;
        pose('convoyeur', [S.chaine + o, 0, 0]); pose('cabine', [xg, 0, 0]); pose('four', [S.four + o, 0, 0]);
        pose('elevateur', [xg, 0, 0]); pose('chariot', [xg, 0, zg], [0, 0, vz]); pose('chariotArr', [xg, 0, zg2], [0, 0, vz2]);
        if (a >= T.chaine[0] && a < T.chaine[1] + 600) {
          out.depot = { v: F.V, t: a, sx: PDR.sx, zc: PDR.zc, course: PDR.course, per: PDR.per, sz: PDR.sz, ecart: PDR.ecart, k: PDR.k };
          out.vect.push({ k: 'poudre', xg, c: S.chaine + o + F.V * (a - T.chaine[0]), tau: a });
        }
      }
      // la fin de la ligne : le palettiseur, la palette de la commande et ses trois jardinières
      if (inView(S.bout + o - 300, S.palettiseur + o + 900, 700)) {
        pose('palette4', [S.palette[0] + o, S.palette[1], 0]);
        for (const c of F.CASES.slice(0, 3)) pose('jardiniere', [c[0] + o, c[1], c[2]]);
        const base = { p: [F.baseP.p[0] + o, F.baseP.p[1], F.baseP.p[2]], lacet: F.baseP.lacet };
        robot(out, F.BP, 'pal', F.palet(a).q, F.palet(a0).q, base, base);
      }
      // les pièces de cette ligne
      for (let g = 0; g < 3; g++) {
        const age = a + g * Tc;
        if (age < F.tCoupe || age >= F.LIFE || (age > T.chaine[1] + 2600 && age < Tc + T.sortie[0] - 60)) continue;   // pas encore coupée, enlevée, ou cachée dans le four
        const xp = F.etat(age).c[0] + o;
        if (inView(xp - 900, xp + 900, 500)) dessinerPiece(out, age, o);
      }
    }
    return out;
  }

  // préchauffe : les triangulations de la pièce et de son ombre, calculées une fois pour chaque état (à plat, levée, pliée,
  // retournée, peinte) avant la lecture ; aucun calcul nouveau ne tombe pendant le film
  if (tr) {
    const mi = (a) => (a[0] + a[1]) / 2, chauffe = [F.tCoupe + 1, T.prise[1] + 400, mi(T.versPresse), ...T.coups.map((c) => (c.k === 'coup' ? c.t1 - 1 : mi([c.t0, c.t1]))), mi(T.versSoudure), mi(T.tour), mi(T.versChaine), mi(T.chaine), T.prisePal + 500, T.pose + 100];
    tr.begin({});
    for (const tt of chauffe) for (const f of scene(tt).faces) { f.n = f.n || newell(f.pts); tr.face(f.pts, f.uv, 0, { trous: f.holes ? f.holes.map((h, i) => ({ pts: h, uv: f.huv[i] })) : null, cle: f.cle }); }
  }

  let t = 0, playing = false, dead = false, lastVal = '', lastCh = '', dtImg = 0;
  // vitesse de lecture (0 à 1) : la pause freine et la reprise repart sur une courbe courte, jamais d'arrêt sec
  let vitesse = 0, horloge = 0, rampe = null, raccord = null;
  const HAUT = [0, 0, 1], NUL = [0, 0, 0];
  // un cordon dans le moteur : un trait épais à l'encre, et ses écailles (deux traits de papier en chevron, bombés vers le
  // départ du cordon), au pas des trempages ; tailles en px d'écran (s : px par mm)
  function cordonGL(v, s) {
    if (v.face <= 0) return;
    tr.arete(v.a, v.b, 3.2, 0, v.n, 1e9, 0, v.face);
    const L = v.a[2] - v.b[2], pasE = (Hh - 4) / F.T.ecailles, d1 = 1.9 / s, d2 = 2.2 / s;
    for (let d = pasE; d < L - 1 / s; d += pasE) {
      const c = [v.a[0], v.a[1], v.a[2] - d], m = [c[0], c[1], c[2] + d2];
      tr.arete(add(c, mulS(v.t, d1)), m, 1, 2, v.n, 1e9, 0, v.face); tr.arete(m, sub(c, mulS(v.t, d1)), 1, 2, v.n, 1e9, 0, v.face);
    }
    // le bout du cordon encore chaud : il suit la torche, puis s'éteint (REFROIDIT ms)
    if (v.chaud < REFROIDIT) {
      const al = (v.chaud < 0 ? 1 : 1 - v.chaud / REFROIDIT) * v.face;
      tr.arete([v.b[0], v.b[1], v.b[2] + Math.min(L, 46)], v.b, 3.2, 5, v.n, 1e9, 0, 0.8 * al); tr.arete([v.b[0], v.b[1], v.b[2] + Math.min(L, 14)], v.b, 3.2, 4, v.n, 1e9, 0, 0.9 * al);
    }
  }
  // ----- les lumières chaudes (teintes ILLU.chaud, ILLU.etincelle, P.ambre), prises dans la profondeur de la scène -----
  const REFROIDIT = 900, ETI = { pas: 70, vie: 260 };   // à verser dans MOTION.soudure : refroidissement du cordon, étincelles
  const RC = CAM0.r, UC = CAM0.u;
  // un point lumineux : deux traits croisés dans le plan de l'image (largeur en px, couleur, opacité)
  const point = (p, w, c, al, s) => { const d = w / (4 * s); tr.arete(sub(p, mulS(RC, d)), add(p, mulS(RC, d)), w, c, NUL, 1e9, 0, al); tr.arete(sub(p, mulS(UC, d)), add(p, mulS(UC, d)), w, c, NUL, 1e9, 0, al); };
  // le point chaud d'un arc ou d'une coupe : un cœur, un halo court ; il vibre sans à-coup (deux sinus, jamais par sauts)
  const pointChaud = (p, tm, k, s) => { const f = 0.5 + 0.25 * Math.sin(tm / 23) + 0.25 * Math.sin(tm / 9.7 + 1.3); point(p, (9 + 4 * f) * k, 5, 0.3, s); point(p, (5 + 2 * f) * k, 4, 0.75, s); point(p, (2.4 + 1.1 * f) * k, 3, 1, s); };
  // quelques étincelles : au plus une tous les ETI.pas ms (une sur deux part), lancée vers `dir`, freinée par l'air, courbée
  // par la pesanteur ; un trait court qui s'éteint en ETI.vie ms
  function etincelles(p, tm, dir, force) {
    for (let n = Math.ceil((tm - ETI.vie) / ETI.pas); n <= Math.floor(tm / ETI.pas); n++) {
      const h1 = hache(n * 3 + 1), h2 = hache(n * 3 + 2), h3 = hache(n * 3 + 3);
      if (h1 > 0.55) continue;
      const age = tm - n * ETI.pas, v0 = add(mulS(dir, (500 + 700 * h2) * force), [(h3 - 0.5) * 500, (h2 - 0.5) * 500, 250 + 600 * h3]);
      const pos = (sd) => { const k = (1 - Math.exp(-3 * sd)) / 3; return [p[0] + v0[0] * k, p[1] + v0[1] * k, p[2] + v0[2] * k - 4905 * sd * sd]; };
      tr.arete(pos(Math.max(0, age / 1000 - 0.022)), pos(age / 1000), 1.3, 4, NUL, 1e9, 0, 0.9 * (1 - age / ETI.vie));
    }
  }
  // le faisceau d'une torche : une courbe souple du dévidoir à l'arrière de la torche
  function cableGL(v) {
    const Q = add(v.b, mulS(v.d, 170)); let p0 = v.a;
    for (let i = 1; i <= 7; i++) { const k = i / 7, q = 1 - k, p1 = [0, 1, 2].map((j) => q * q * v.a[j] + 2 * q * k * Q[j] + k * k * v.b[j]); tr.arete(p0, p1, 2.4, 1, NUL); p0 = p1; }
  }
  // saut : { x (caméra, mm), flou (déplacement de la caméra pendant l'obturation, mm), vx (mm/ms) } pendant un raccord de chapitre
  function draw(tm, saut = null) {
    const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return false;
    cam = camAt(saut ? saut.x : F.camX(tm));
    const PF = window.__filmProf, n0 = PF ? performance.now() : 0;
    const sc = scene(tm, saut ? saut.x : null);
    const n1 = PF ? performance.now() : 0;
    if (tr) {
      const s = W / W_MONDE();
      view = { s, cx: W / 2, cy: H * V9.camera.haut };
      // pas de la trame dans la matière : environ `pas` px à l'écran pour une face vue de trois quarts
      const fl = saut ? S2([saut.flou * s, 0, 0]) : [0, 0];
      tr.begin({ W, H, cam: { t: cam.t, r: cam.r, u: cam.u, f: cam.f }, s, cx: view.cx, cy: view.cy, pas: pas / (s * 0.75), dt: dtImg, vcam: saut ? [saut.vx, 0, 0] : dtImg > 0 ? [F.camV(tm) * vitesse, 0, 0] : [0, 0, 0], flou: fl, depot: sc.depot || null });
      // obturation sur toute la durée de l'image : le filtre temporel juste pour une trame fine (une ligne qui avance d'un
      // demi-pas par image se fond au lieu de papillonner) ; à l'arrêt, aucune durée, l'image est nette
      for (const [nom, off, vit] of sc.inst) tr.instance(mailleGL(nom), off, vit);
      for (const [nom, p1, p0] of sc.sol) tr.solide(mailleGL(nom), p1, p0, H_VIT);
      for (const f of sc.faces) {
        f.n = f.n || newell(f.pts);
        tr.face(f.pts, f.uv, tonDe(f.n, f.g), { trous: f.holes ? f.holes.map((h, i) => ({ pts: h, uv: f.huv[i] })) : null, tons: f.tons || null, peint: f.peint || 0, cut: f.cut, vits: f.vits, cle: f.cle });
        if (f.ar) { for (const [a, b] of f.ar) tr.arete(a, b, 1, 1, f.n); continue; }                     // chaînes porte-câbles : leurs deux rives, en trait clair
        if (f.g !== 'piece' || f.kind !== 'face' || dot(f.n, VUE) >= 0) continue; // arêtes vues de la pièce, à l'encre
        const R = f.pts;
        for (let i = 0; i < R.length; i++) {
          const pl = f.plis ? f.plis[i] : -1, a = R[i], b = R[(i + 1) % R.length];
          if (pl < 0) { tr.arete(a, b, 1.25, 0, f.n); continue; }
          // une ligne de pli : trait mixte fin sur la tôle à plat (elle n'est pas coupée), arête pleine dès que le pli se forme
          const kk = lisse(0, 0.12, pl);
          if (kk < 1) tr.arete(a, b, 0.9, 0, f.n, 1e9, 1, 0.8 * (1 - kk));
          if (kk > 0) tr.arete(a, b, 1.25, 0, f.n, 1e9, 0, kk);
        }
        for (const h of f.holes || []) for (let i = 0; i < h.length; i++) tr.arete(h[i], h[(i + 1) % h.length], 1.25, 0, f.n);
      }
      // tracés pris dans la profondeur de la scène (ils sont cachés par ce qui passe devant eux) : le faisceau du laser et
      // son point chaud, le trait de coupe en cours, les cordons, les arcs, les étincelles, les faisceaux de torche
      for (const v of sc.vect) {
        if (v.k === 'faisceau') { tr.arete(v.a, v.b, 2, 0, NUL); pointChaud(v.b, v.tm, 0.7, s); if (v.coupe) etincelles(v.b, v.tm, norm([-v.v[0], -v.v[1], 0.4]), 0.6); }
        else if (v.k === 'trait') {
          for (let i = 0; i + 1 < v.pts.length; i++) tr.arete(v.pts[i], v.pts[i + 1], 1.25, 0, HAUT);
          // le trait encore chaud derrière la tête : 60 mm d'ambre, qui s'éteint avec la distance
          let reste = 60;
          for (let i = v.pts.length - 1; i > 0 && reste > 0; i--) { const b = v.pts[i], a0 = v.pts[i - 1], L = Math.hypot(b[0] - a0[0], b[1] - a0[1]) || 1, k = Math.min(1, reste / L); tr.arete([b[0] + (a0[0] - b[0]) * k, b[1] + (a0[1] - b[1]) * k, 0], b, 1.6, 5, HAUT, 1e9, 0, 0.9 * reste / 60); reste -= L; }
        } else if (v.k === 'cordon') cordonGL(v, s);
        else if (v.k === 'cable') cableGL(v);
        else if (v.k === 'arc') { pointChaud(v.at, v.tm, 1, s); etincelles(v.at, v.tm, v.n, 1); }
      }
      tr.end();
    } else dessin2d(sc, W, H);
    const n2 = PF ? performance.now() : 0;
    // les tracés vectoriels par-dessus (la poudre ; en repli : faisceau, tracé de coupe, cordons, arc)
    const dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (ink.width !== cw || ink.height !== ch) { ink.width = cw; ink.height = ch; }
    const ic = ink.getContext('2d'); ic.setTransform(dpr, 0, 0, dpr, 0, 0); ic.clearRect(0, 0, W, H);
    ic.lineJoin = 'round'; ic.lineCap = 'round';
    // pendant le raccord, les tracés fins (arc, poudre) s'effacent avec la vitesse : le filé les emporterait
    ic.globalAlpha = saut && tr ? clamp(1 - Math.abs(saut.flou * (W / W_MONDE())) / 24) : 1;
    if (!tr) encre2d(ic);
    for (const v of sc.vect) {
      if (!tr && v.k === 'faisceau') { const a = proj(v.a), b = proj(v.b); ic.strokeStyle = ENCRE; ic.lineWidth = 2; ic.beginPath(); ic.moveTo(a[0], a[1]); ic.lineTo(b[0], b[1]); ic.stroke(); }
      if (!tr && v.k === 'trait') { ic.strokeStyle = ENCRE; ic.lineWidth = 1.25; ic.beginPath(); v.pts.forEach((q, i) => { const a = proj(q); i ? ic.lineTo(a[0], a[1]) : ic.moveTo(a[0], a[1]); }); ic.stroke(); }
      if (!tr && v.k === 'cordon' && !v.arriere) {
        const a = proj(v.a), b = proj(v.b), L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
        const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux;
        ic.strokeStyle = ENCRE; ic.lineWidth = 3.2; ic.beginPath(); ic.moveTo(a[0], a[1]); ic.lineTo(b[0], b[1]); ic.stroke();
        // écailles : des arcs bombés vers le départ du cordon, au pas des trempages
        const pitch = Math.max(3.5, L / Math.max(1, F.T.ecailles * v.p)); ic.lineWidth = 1; ic.strokeStyle = PAPIER;
        for (let d = pitch; d < L - 1; d += pitch) { const cx = a[0] + ux * d, cy = a[1] + uy * d; ic.beginPath(); ic.moveTo(cx + nx * 1.9, cy + ny * 1.9); ic.quadraticCurveTo(cx - ux * 2.2, cy - uy * 2.2, cx - nx * 1.9, cy - ny * 1.9); ic.stroke(); }
      }
      if (!tr && v.k === 'arc') { const a = proj(v.at), r = 2.6 + 1.4 * (0.5 + 0.25 * Math.sin(v.tm / 23) + 0.25 * Math.sin(v.tm / 9.7 + 1.3)); ic.fillStyle = PAPIER; ic.strokeStyle = ENCRE; ic.lineWidth = 1.25; ic.beginPath(); ic.arc(a[0], a[1], r, 0, Math.PI * 2); ic.fill(); ic.stroke(); }
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
    ic.lineWidth = 1.6; ic.lineCap = 'round'; // v8 : grains un peu plus présents (ils ne se lisaient pas à 1 440 px)
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
        ic.globalAlpha = a0 * al * (0.55 + 0.35 * h3); ic.strokeStyle = POUDRE;
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
    view = { s, cx: W / 2, cy: H * V9.camera.haut };
    const L = { sol: [], piece: [], outil: [], four: [] };
    const range = (g, poly) => (g === 'piece' ? L.piece : g === 'four' || g === 'dedans' ? L.four : g === 'sol' || g === 'tole' ? L.sol : L.outil).push(poly);
    const poser = (nom, mv, rv) => {
      for (const f of MAILLES[nom]) {
        const g = gOf(f);
        // les appuis (convoyeur et ses rouleaux, plateau) passent sous la pièce dans l'ordre du peintre
        const poly = { kind: 'face', pts: f.pts.map(mv), holes: f.holes && f.holes.length ? f.holes.map((Hx) => Hx.map(mv)) : undefined, meta: { g, u: rv((f.meta && f.meta.u) || [1, 0, 0]) } };
        if (nom === 'convoyeur' || nom === 'plateau' || nom === 'piedPlateau' || nom === 'rails' || nom === 'railManip' || nom === 'palette4') L.sol.push(poly); else range(g, poly);
      }
    };
    for (const [nom, off] of sc.inst) poser(nom, (q) => [q[0] + off[0], q[1] + off[1], q[2] + off[2]], (u) => u);
    for (const [nom, p1] of sc.sol) poser(nom, (q) => add(app3(p1.R, q), p1.p), (u) => app3(p1.R, u));
    for (const f of sc.faces) {
      if (f.g === 'ombre') continue;
      const meta = { g: f.g, u: f.meta.u }, poly = { kind: 'face', pts: f.pts, holes: f.holes, meta };
      if (f.g !== 'piece') { L.outil.push(poly); continue; }
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
  const NB = ' ';
  const NF1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fr = (v) => NF1.format(v).replace(/[  ]/g, NB);
  const chapitreA = (c) => { let id = F.CH[0].id; for (const ch of F.CH) if (c >= ch.t - 0.5) id = ch.id; return id; }; // tolérance : le modulo flottant d'un saut de chapitre
  const COUPS = F.COUPS;
  // onValeurs(phrase, phrase courte, chapitre) : la phrase courte tient sur une ligne à 390 px (la page l'emploie sous 480 px)
  function valeurs(tm) {
    const a = ((tm % Tc) + Tc) % Tc, id = chapitreA(a);
    let txt = '', court = null;
    if (a >= T.prisePal - 400) { txt = 'La quatrième jardinière rejoint la commande sur sa palette'; court = `La commande de 4${NB}pièces est prête`; }
    else if (id === 'decoupe') txt = `Le laser a coupé ${fr(F.coupe(a) / 1000)}${NB}m sur ${fr(F.LONG / 1000)}`;
    else if (id === 'pliage') {
      // le pli en cours (ou le prochain) et son angle intérieur mesuré : 180° à plat, 88° sous charge, 90° au retour
      const cur = COUPS.find((c) => a < c.t1) || COUPS[COUPS.length - 1], fv = F.etat(a).f[cur.ps.bi];
      txt = `Le pli ${cur.i + 1} sur 4 est à ${fr(180 - 90 * fv)}°`;
    } else if (id === 'soudure') {
      const cd = F.cordons(a), n = cd.filter((x) => x >= 1).length, enCours = cd.some((x) => x > 0 && x < 1);
      if (enCours) { txt = `Les torches MIG soudent les angles ${n + 1} et ${n + 2}`; court = `Les torches soudent les angles ${n + 1} et ${n + 2}`; }
      else if (n === 0) { txt = 'Les torches MIG vont souder les quatre angles'; court = 'Les torches MIG vont souder'; }
      else txt = n >= 4 ? 'Les quatre angles sont soudés' : `${n} angles sur 4 sont soudés`;
    } else { txt = `La jardinière est poudrée en RAL${NB}7016, puis cuite à 180${NB}°C`; court = `La poudre RAL${NB}7016 cuit à 180${NB}°C`; }
    if (txt !== lastVal) { lastVal = txt; onValeurs && onValeurs(txt, court || txt, id); }
    if (id !== lastCh) { lastCh = id; onChapitre && onChapitre(id); }
  }

  // Une image : la rampe de vitesse (pause, reprise), puis le raccord de chapitre s'il y en a un, sinon la lecture.
  // Raccord de chapitre : la caméra file le long de l'atelier jusqu'au poste demandé (un panoramique filé, « whip pan », qui
  // masque le raccord dans son flou) ; à mi-course, au plus fort du filé, le temps de la scène passe de l'instant quitté à
  // celui du chapitre. Durée : deux gestes d'approche (partir, freiner) ; position en raccord d'Hermite, à la vitesse de la
  // caméra aux deux bouts (celle qu'elle a à l'instant quitté, celle qu'elle a à l'instant rejoint) : le film repart sans à-coup.
  const RAMPE = PR.approche.ms, DUREE_RACCORD = 2 * PR.approche.ms;
  function avancer(dt) {
    horloge += dt;
    if (rampe) { const u = seg(horloge - rampe.debut, 0, RAMPE); vitesse = lerp(rampe.v0, rampe.v1, EASE.convoyeur(u)); if (u >= 1) rampe = null; }
    const av = dt * vitesse;
    if (raccord) {
      const R = raccord, e = horloge - R.debut, u = clamp(e / R.dur);
      R.av += av;
      const x = hermite(R.x0, R.v0 * R.vit * R.dur, R.x1, R.v1 * R.vit * R.dur, u);
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
    peinture: T.chaine[0] + 2400,
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
      const de = raccord ? raccord.vers - raccord.dur * raccord.vit : t, x0 = raccord ? raccord.xp : F.camX(t);
      let vers = ch.t; for (const n of [-1, 1]) if (Math.abs(F.camX(ch.t + n * Tc) - x0) < Math.abs(F.camX(vers) - x0)) vers = ch.t + n * Tc;
      raccord = { de, vers, x0, x1: F.camX(vers), v0: F.camV(de), v1: F.camV(vers), xp: x0, debut: horloge, dur: DUREE_RACCORD, av: 0, vit: playing ? 1 : 0 };
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
