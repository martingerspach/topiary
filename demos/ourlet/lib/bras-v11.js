// Ourlet · le bras articulé du film (v9) : un robot industriel à six axes, sa géométrie, sa cinématique, ses profils de
// mouvement. Un seul bras de référence, réutilisé à chaque poste, à l'échelle et avec l'outil du poste : la torche MIG des
// deux robots de soudure, le préhenseur à ventouses du robot de manutention (sur son rail) et du palettiseur.
//
// Références de métier (aucune marque n'est affichée à l'image) :
// - l'architecture des robots anthropomorphes à six axes et poignet sphérique : socle, tourelle (axe 1, vertical), bras
//   (axe 2), avant-bras (axe 3), puis le poignet, roulis, tangage, roulis (axes 4, 5, 6), dont les trois axes se coupent en
//   un point. La cinématique inverse se découple alors (Pieper, 1968) : les trois premiers axes placent le centre du
//   poignet (deux segments dans le plan vertical de la tourelle), les trois derniers orientent l'outil. Une seule
//   configuration du début à la fin, « coude en haut, poignet non retourné » : aucun basculement ;
// - les deux mouvements d'un programme de robot : articulaire (d'une pose à l'autre, tous les axes suivent le même profil,
//   l'outil décrit un arc : les déplacements) et linéaire (l'outil suit une droite, son orientation tourne régulièrement :
//   approche, cordon, dégagement) ;
// - le profil en S des générateurs de trajectoire : polynôme de degré 5, vitesse et accélération nulles aux deux bouts ;
//   un cordon se soude à vitesse constante, entre deux rampes courtes ;
// - la torche MIG d'un robot de soudage : boîtier anticollision sur la bride, corps, col de cygne (35°), buse, fil sorti
//   de 12 mm ; le dévidoir est porté par l'avant-bras ;
// - le préhenseur à ventouses des robots de manutention de tôlerie : un mât sur la bride, un cadre, six ventouses à
//   soufflet ; il prend la pièce par le dessus, sur son fond ; le mât est plus haut que les parois de la pièce pliée ;
// - les butées articulaires d'un petit porteur (LIMITES) : le banc vérifie qu'aucune pose du film ne les dépasse.
//
// Dessin : la langue du film. Chaque articulation est un cylindre couché sur son axe (on lit l'axe à son disque), les
// segments sont des flasques et des tubes ; trame de lignes le long de chaque segment, en anneaux sur les cylindres.
import { add, sub, mulS, dot, cross, norm, clamp, mul3, app3, tr3, rotX, rotY, rotZ, base3, box, prismY, cyl, tramer } from './solides-v11.js';

const RAD = Math.PI / 180;
// Valeurs à verser dans les tokens (MOTION.robot) : le col de cygne de la torche (degrés), la rampe d'un cordon (part de sa durée)
export const ROBOT = { col: 35, rampe: 0.1 };
// le préhenseur à ventouses : hauteur du mât (de la bride au plan des ventouses), cadre (long, large), en mm
export const VENTOUSES = { mat: 300, cadre: [560, 170] };
// butées articulaires (degrés) : axe 1, axe 2 (0 : bras à l'horizontale vers l'avant, 90 : vertical), axe 3 (angle de
// l'avant-bras par rapport au bras : −90 à l'équerre, jamais tendu ni refermé), axes 4, 5, 6
export const LIMITES = [[-170, 170], [-5, 150], [-165, -12], [-190, 190], [-125, 125], [-360, 360]];

// ---------- profils ----------
// profil en S : position 0 → 1, vitesse et accélération nulles aux deux bouts (polynôme de degré 5)
export const S5 = (u) => { u = clamp(u); return u * u * u * (10 + u * (-15 + 6 * u)); };
// course à vitesse constante entre deux rampes douces (r : part de la durée pour chaque rampe) ; position 0 → 1
export function trapeze(u, r = ROBOT.rampe) {
  u = clamp(u);
  const g = (x) => x * x * x - 0.5 * x * x * x * x; // intégrale de la rampe 3x² − 2x³
  const tot = 1 - r;
  if (u < r) return (r * g(u / r)) / tot;
  if (u > 1 - r) return 1 - (r * g((1 - u) / r)) / tot;
  return (r / 2 + (u - r)) / tot;
}
export const melange = (qa, qb, k) => qa.map((v, i) => v + (qb[i] - v) * k);

const proche = (a, r) => a + Math.round((r - a) / (2 * Math.PI)) * 2 * Math.PI; // l'angle a, au tour le plus proche de r

// ---------- le bras ----------
// k : échelle du bras (1 : 900 mm d'épaule à poignet) ; l'outil garde sa taille réelle ; outil : 'torche', 'ventouses' ou
// null ; g : groupe de ton
export function creerBras({ k = 1, outil = 'torche', g = 'outil' } = {}) {
  const D = { h1: 380 * k, a1: 70 * k, L2: 460 * k, L3: 440 * k, d6: 82 * k };
  const m = { g }, P = {}, K = (...v) => v.map((x) => x * k);
  const bx = (x0, x1, y0, y1, z0, z1, fond) => box(...K(x0, x1, y0, y1, z0, z1), m, fond);
  const cy = (p0, p1, r, n, r1 = r) => cyl(K(...p0), K(...p1), r * k, m, n, r1 * k);
  // socle : une platine boulonnée au sol, une colonne
  P.socle = tramer([...bx(-150, 150, -150, 150, 0, 16), ...cy([0, 0, 16], [0, 0, 150], 104, 24)], [1, 0, 0]);
  // tourelle (axe 1) : un tambour, un corps, le moyeu de l'épaule couché sur l'axe 2, son moteur de l'autre côté
  P.tourelle = tramer([
    ...cy([0, 0, 150], [0, 0, 204], 114, 24),
    ...bx(-84, 124, -94, 30, 204, 352),
    ...cy([70, -102, 380], [70, 34, 380], 88, 24),
    ...cy([70, -138, 380], [70, -102, 380], 52, 16),
  ], [0, 0, 1], [1, 0, 0]);
  // bras (axe 2) : un flasque entre deux bossages, sur le côté de la tourelle
  P.bras = tramer([
    ...prismY([K(0, -70), K(460, -52), K(460, 52), K(0, 70)], 40 * k, 92 * k, m),
    ...cy([0, 34, 0], [0, 102, 0], 80, 24),
    ...cy([460, 34, 0], [460, 102, 0], 62, 20),
  ], [1, 0, 0]);
  // avant-bras (axe 3) : le moyeu du coude et son moteur, un carter, le tube de l'axe 4 ; le dévidoir de fil sur le dessus
  P.avant = tramer([
    ...cy([0, -58, 0], [0, 34, 0], 66, 20),
    ...cy([0, -90, 0], [0, -58, 0], 42, 16),
    ...bx(-24, 136, -50, 32, -48, 48, true),
    ...cy([136, 0, 0], [440 - 78, 0, 0], 39, 20),
    ...(outil === 'torche' ? bx(-12, 108, -40, 22, 48, 108) : []),
  ], [1, 0, 0]);
  // poignet (axe 4) : une bague sur le tube, une chape, le moyeu de l'axe 5
  P.poignet = tramer([
    ...cy([-78, 0, 0], [-42, 0, 0], 44, 20),
    ...bx(-42, 4, -40, 40, -34, 34, true),
    ...cy([0, -47, 0], [0, 47, 0], 35, 16),
  ], [1, 0, 0]);
  // main (axe 5) et bride (axe 6)
  P.main = tramer([...cy([12, 0, 0], [70, 0, 0], 29, 16), ...cy([70, 0, 0], [82, 0, 0], 36, 16)], [1, 0, 0]);
  // l'outil, dans le repère de la bride (x : l'axe de la bride) ; T : la pointe de l'outil dans ce repère et son orientation
  let T = { t: [0, 0, 0], R: rotY(0) };
  P.outil = [];
  if (outil === 'torche') {
    const b = ROBOT.col * RAD, Rn = 90, pts = [[44, 0, 0], [146, 0, 0]];
    for (let i = 1; i <= 3; i++) { const a = (b * i) / 3; pts.push([146 + Rn * Math.sin(a), 0, -Rn * (1 - Math.cos(a))]); }
    const dir = [Math.cos(b), 0, -Math.sin(b)], fin = pts[pts.length - 1];
    const col = add(fin, mulS(dir, 34)), buse = add(col, mulS(dir, 62)), fil = add(buse, mulS(dir, 12));
    P.outil = tramer([
      ...cyl([0, 0, 0], pts[0], 28, m, 16),                              // boîtier anticollision
      ...cyl(pts[0], pts[1], 18, m, 12),                                 // corps
      ...cyl(pts[1], pts[2], 11.5, m, 10), ...cyl(pts[2], pts[3], 11.5, m, 10), ...cyl(pts[3], pts[4], 11.5, m, 10), // col de cygne
      ...cyl(fin, col, 11.5, m, 10),
      ...cyl(col, buse, 13.5, m, 12, 10.5),                              // buse
    ], [1, 0, 0]);
    T = { t: fil, R: rotY(b), buse, dir, arriere: pts[0] };
  }
  if (outil === 'ventouses') {
    // l'axe de la bride est celui des ventouses ; le cadre s'allonge le long de l'axe z de la bride (le grand côté de la pièce)
    const Lm = VENTOUSES.mat, [cz, cyy] = VENTOUSES.cadre, v = [];
    for (const z of [-0.39, 0, 0.39]) for (const y of [-0.3, 0.3]) v.push(...cyl([Lm - 26, y * cyy, z * cz], [Lm, y * cyy, z * cz], 20, m, 10, 27));
    P.outil = tramer([
      ...cyl([0, 0, 0], [26, 0, 0], 38, m, 16),
      ...cyl([26, 0, 0], [Lm - 50, 0, 0], 21, m, 12),                                  // le mât
      ...box(Lm - 50, Lm - 26, -cyy / 2, cyy / 2, -cz / 2, cz / 2, m, true),           // le cadre
      ...v,                                                                            // les ventouses
    ], [0, 0, 1], [0, 1, 0]);
    T = { t: [Lm, 0, 0], R: rotY(0) };
  }

  // cinématique directe : q (six angles, radians), base { p, lacet } → la pose { R, p } de chaque solide, et celle de l'outil
  function fk(q, base) {
    const R0 = rotZ(base.lacet || 0), R1 = mul3(R0, rotZ(q[0]));
    const S = add(base.p, app3(R1, [D.a1, 0, D.h1]));
    const R2 = mul3(R1, rotY(-q[1])), E = add(S, app3(R2, [D.L2, 0, 0]));
    const R3 = mul3(R1, rotY(-(q[1] + q[2]))), W = add(E, app3(R3, [D.L3, 0, 0]));
    const R4 = mul3(R3, rotX(q[3])), R5 = mul3(R4, rotY(q[4])), B = add(W, app3(R5, [D.d6, 0, 0])), R6 = mul3(R5, rotX(q[5]));
    return {
      socle: { R: R0, p: base.p }, tourelle: { R: R1, p: base.p }, bras: { R: R2, p: S }, avant: { R: R3, p: E },
      poignet: { R: R4, p: W }, main: { R: R5, p: W }, outil: { R: R6, p: B },
      pointe: { R: mul3(R6, T.R), p: add(B, app3(R6, T.t)) }, S, E, W,
    };
  }
  // la pose de l'outil demandée : p (la pointe), a (direction d'approche, unitaire), h (vers où regarde l'axe z de l'outil ;
  // pour la torche, le col de cygne se cambre à l'opposé de h : h vers le bas, le corps de la torche remonte vers le poignet)
  const repere = (c) => { const x = norm(c.a), z = norm(sub(c.h, mulS(x, dot(c.h, x)))), y = cross(z, x); return base3(x, y, z); };
  // cinématique inverse analytique. ref : les angles d'une pose voisine (le poignet reste du même côté qu'elle, les roulis
  // au même tour). Renvoie null hors d'atteinte.
  function ik(c, base, ref = [0, 0, 0, 0, 0, 0]) {
    const R6 = mul3(repere(c), tr3(T.R)), B = sub(c.p, app3(R6, T.t)), W = sub(B, mulS([R6[0], R6[3], R6[6]], D.d6));
    const R0 = rotZ(base.lacet || 0), w = app3(tr3(R0), sub(W, base.p));
    const q1 = proche(Math.atan2(w[1], w[0]), ref[0]);
    const r = Math.hypot(w[0], w[1]) - D.a1, s = w[2] - D.h1;
    const c3 = (r * r + s * s - D.L2 * D.L2 - D.L3 * D.L3) / (2 * D.L2 * D.L3);
    if (c3 > 1 || c3 < -1) return null;
    const th = Math.acos(c3), q3 = -th, q2 = Math.atan2(s, r) + Math.atan2(D.L3 * Math.sin(th), D.L2 + D.L3 * Math.cos(th));
    const R3 = mul3(mul3(R0, rotZ(q1)), rotY(-(q2 + q3))), M = mul3(tr3(R3), R6); // = Rx(q4) · Ry(q5) · Rx(q6)
    const sb = Math.hypot(M[1], M[2]);
    let q4, q5, q6;
    if (sb < 1e-6) { q5 = 0; q4 = ref[3]; q6 = proche(Math.atan2(M[7], M[4]) - q4, ref[5]); } // poignet tendu : seule la somme des roulis compte
    else {
      const A = [proche(Math.atan2(M[3], -M[6]), ref[3]), Math.atan2(sb, M[0]), proche(Math.atan2(M[1], M[2]), ref[5])];
      const Bq = [proche(Math.atan2(-M[3], M[6]), ref[3]), -Math.atan2(sb, M[0]), proche(Math.atan2(-M[1], -M[2]), ref[5])];
      const cout = (X) => Math.abs(X[0] - ref[3]) + Math.abs(X[1] - ref[4]) + Math.abs(X[2] - ref[5]);
      [q4, q5, q6] = cout(A) <= cout(Bq) ? A : Bq;
    }
    return [q1, q2, q3, q4, q5, q6];
  }
  // une pose respecte-t-elle les butées ? Renvoie la liste des axes en défaut (vide : tout va bien)
  const butees = (q) => q.map((v, i) => (v < LIMITES[i][0] * RAD - 1e-9 || v > LIMITES[i][1] * RAD + 1e-9 ? i + 1 : 0)).filter(Boolean);
  return { D, T, pieces: P, noms: ['socle', 'tourelle', 'bras', 'avant', 'poignet', 'main', 'outil'], fk, ik, butees };
}
// interpolation d'une pose d'outil à une autre (mouvement linéaire) : la pointe suit la droite, les directions tournent
export const entre = (c0, c1, k) => ({ p: add(c0.p, mulS(sub(c1.p, c0.p), k)), a: norm(add(mulS(c0.a, 1 - k), mulS(c1.a, k))), h: norm(add(mulS(c0.h, 1 - k), mulS(c1.h, k))) });

// ---------- le programme d'un bras ----------
// etapes : [{ t: [début, fin] (ms), art: angles ou pose d'outil (déplacement articulaire) | lin: pose d'outil (déplacement
// linéaire depuis la pose atteinte), profil? (S5 par défaut) }], dans l'ordre du temps. Entre deux étapes, le bras garde
// sa pose. Tout est résolu à la construction : q(t) est une fonction pure du temps (lecture à rebours, saut, boucle).
export function programme(bras, base, q0, etapes) {
  let q = q0; const segs = [];
  for (const e of etapes) {
    const [t0, t1] = e.t, qa = q, profil = e.profil || S5;
    let qb, f;
    if (e.lin) {
      const o = bras.fk(qa, base).pointe, R = o.R, c0 = { p: o.p, a: [R[0], R[3], R[6]], h: [R[2], R[5], R[8]] }, c1 = e.lin;
      qb = bras.ik(c1, base, qa);
      f = (u) => bras.ik(entre(c0, c1, profil(u)), base, qa) || qa;
    } else {
      qb = Array.isArray(e.art) ? e.art : bras.ik(e.art, base, qa);
      // les roulis d'une pose visée restent au tour de la pose de repos (aucun enroulement d'un déplacement à l'autre)
      if (qb && !Array.isArray(e.art)) { qb[3] = proche(qb[3], q0[3]); qb[5] = proche(qb[5], q0[5]); }
      f = (u) => melange(qa, qb, profil(u));
    }
    if (!qb) throw new Error(`bras : pose hors d'atteinte (étape à ${Math.round(t0)} ms)`);
    segs.push({ t0, t1, f, qb, lin: !!e.lin }); q = qb;
  }
  return {
    q0, segs, fin: q,
    q(t) { let cur = q0; for (const s of segs) { if (t < s.t0) break; if (t < s.t1) return s.f((t - s.t0) / (s.t1 - s.t0)); cur = s.qb; } return cur; },
  };
}
