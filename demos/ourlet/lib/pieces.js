// Ourlet · pièces d'exemple (fictives), décrites par leur développé et leurs plis.
import { makePart, circle, slot } from './part.js';

// Rectangle à coins arrondis (découpe d'écran, de trappe)
export function rect(x0, y0, x1, y1, r = 3, n = 6) {
  const pts = [], c = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= n; i++) { const a = ((a0 + (90 * i) / n) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  pts.meta = { type: 'rect', x0, y0, x1, y1, r };
  return pts;
}

// Support de carte électronique, réf. 2041-B : un fond, deux joues, un dosseret. Acier 2 mm.
export function support() {
  return makePart({
    ref: '2041-B', name: 'Support de carte', matiere: 'Acier DC01', t: 2,
    outline: [[0, 0], [160, 0], [196, 0], [196, 100], [160, 100], [160, 132], [0, 132], [0, 100], [-36, 100], [-36, 0]],
    holes: [circle(15, 15, 6.5), circle(145, 15, 6.5), circle(15, 85, 6.5), circle(145, 85, 6.5), slot(80, 50, 54, 9),
      circle(-18, 50, 10), circle(178, 50, 10), circle(40, 118, 5), circle(120, 118, 5)],
    bends: [
      { a: [0, 0], b: [0, 100], angle: 90, label: 'pli 90° ↑' },
      { a: [160, 0], b: [160, 100], angle: 90, label: 'pli 90° ↑' },
      { a: [0, 100], b: [160, 100], angle: 90, label: 'pli 90° ↑' },
    ],
    base: [80, 50],
  });
}

// Pupitre de commande, réf. 3107-A : un fond, un dos, une face inclinée (fenêtre d'écran, grille d'aération),
// une lèvre avant finie par un ourlet. Acier 2 mm, une seule bande pliée quatre fois.
export function pupitre() {
  const W = 240, holes = [];
  for (const [x, y] of [[20, 20], [220, 20], [20, 110], [220, 110]]) holes.push(circle(x, y, 7));
  holes.push(circle(80, 190, 16), circle(160, 190, 16));
  holes.push(rect(30, 300, 140, 370, 4));
  for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) holes.push(slot(178 + c * 34, 296 + r * 17, 28, 6));
  return makePart({
    ref: '3107-A', name: 'Pupitre de commande', matiere: 'Acier DC01', t: 2,
    outline: [[0, 0], [W, 0], [W, 130], [W, 250], [W, 410], [W, 438], [W, 452], [0, 452], [0, 438], [0, 410], [0, 250], [0, 130]],
    holes,
    bends: [
      { a: [0, 130], b: [W, 130], angle: 90, label: 'pli 90° ↑' },
      { a: [0, 250], b: [W, 250], angle: 120, label: 'pli 120° ↑' },
      { a: [0, 410], b: [W, 410], angle: 60, label: 'pli 60° ↑' },
      { a: [0, 438], b: [W, 438], angle: 180, label: 'ourlet' },
    ],
    base: [120, 60],
  });
}

// Coffret de laboratoire, réf. 5520-A : un développé en croix, quatre parois relevées autour du fond.
export function coffret() {
  const holes = [];
  for (const [x, y] of [[15, 15], [145, 15], [15, 95], [145, 95]]) holes.push(circle(x, y, 6));
  holes.push(rect(30, -48, 110, -18, 3));                         // fenêtre d'afficheur sur la face avant
  holes.push(circle(130, -33, 12));
  for (let i = 0; i < 6; i++) holes.push(slot(-30, 14 + i * 15, 34, 6));   // ouïes sur la paroi gauche
  return makePart({
    ref: '5520-A', name: 'Coffret de laboratoire', matiere: 'Inox 304L', t: 1.5,
    outline: [[0, 0], [0, -60], [160, -60], [160, 0], [220, 0], [220, 110], [160, 110], [160, 170], [0, 170], [0, 110], [-60, 110], [-60, 0]],
    holes,
    bends: [
      { a: [0, 0], b: [160, 0], angle: 90, label: 'pli 90° ↑' },
      { a: [160, 0], b: [160, 110], angle: 90, label: 'pli 90° ↑' },
      { a: [0, 110], b: [160, 110], angle: 90, label: 'pli 90° ↑' },
      { a: [0, 0], b: [0, 110], angle: 90, label: 'pli 90° ↑' },
    ],
    base: [80, 55],
  });
}

// Capot de borne de recharge, réf. 4410-C : un profil en oméga, ouïes de ventilation sur le dessus.
export function capot() {
  const holes = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) holes.push(slot(48 + c * 34, 100 + r * 30, 24, 7));
  for (const x of [30, 150, 270]) { holes.push(circle(x, 10, 6)); holes.push(circle(x, 250, 6)); }
  return makePart({
    ref: '4410-C', name: 'Capot de borne', matiere: 'Acier DC01', t: 1.5,
    outline: [[0, 0], [300, 0], [300, 20], [300, 70], [300, 190], [300, 240], [300, 260], [0, 260], [0, 240], [0, 190], [0, 70], [0, 20]],
    holes,
    bends: [
      { a: [0, 70], b: [300, 70], angle: -90, label: 'pli 90° ↓' },
      { a: [0, 20], b: [300, 20], angle: 90, label: 'pli 90° ↑' },
      { a: [0, 190], b: [300, 190], angle: -90, label: 'pli 90° ↓' },
      { a: [0, 240], b: [300, 240], angle: 90, label: 'pli 90° ↑' },
    ],
    base: [150, 130],
  });
}

// Équerre de banc public, réf. 1180-D : une aile percée, une aile oblongue, le haut fini par un ourlet.
export function equerre() {
  return makePart({
    ref: '1180-D', name: 'Équerre de banc', matiere: 'Acier S235', t: 4,
    outline: [[0, 0], [120, 0], [120, 90], [120, 180], [120, 196], [0, 196], [0, 180], [0, 90]],
    holes: [slot(35, 40, 36, 11), slot(85, 40, 36, 11), circle(35, 135, 11), circle(85, 135, 11)],
    bends: [
      { a: [0, 90], b: [120, 90], angle: 90, label: 'pli 90° ↑' },
      { a: [0, 180], b: [120, 180], angle: 180, label: 'ourlet' },
    ],
    base: [60, 45],
  });
}

// Platine d'agencement, réf. 6025-B : une tôle plane, découpée seulement, coins chanfreinés.
export function platine() {
  const holes = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) if ((r + c) % 2 === 0) holes.push(circle(30 + c * 28, 28 + r * 28, 9));
  holes.push(slot(100, 125, 120, 10));
  return makePart({
    ref: '6025-B', name: 'Platine d’agencement', matiere: 'Aluminium 5754', t: 3,
    outline: [[12, 0], [188, 0], [200, 12], [200, 138], [188, 150], [12, 150], [0, 138], [0, 12]],
    holes, bends: [], base: [100, 75],
  });
}

// ---------- Pièces du bâtiment (itération 5) ----------
// gamme : ordre des plis à la presse, quand il ne suit pas la règle « l'angle le plus fermé d'abord » de l'outil.
// Les profils se plient de l'extérieur vers l'intérieur : d'abord les petits retours des bords, tant que la tôle est à plat.

// Couvertine d'acrotère, réf. 8240-A : dessus de 240 mm en pente de 5 % vers la toiture, retombée de 80 mm côté façade,
// de 60 mm côté toiture, un larmier à 45° au bas de chaque retombée. Barre de 3 m, aluminium 2 mm thermolaqué.
// Pente : le dessus descend de 3° vers la toiture ; pour des retombées verticales, le pli côté façade fait 93°, côté toiture 87°.
export function couvertine() {
  const L = 3000;
  return makePart({
    ref: '8240-A', name: 'Couvertine d’acrotère', matiere: 'Aluminium 5754', t: 2,
    outline: [[0, 0], [15, 0], [75, 0], [315, 0], [395, 0], [410, 0], [410, L], [395, L], [315, L], [75, L], [15, L], [0, L]],
    holes: [],
    bends: [
      { a: [75, 0], b: [75, L], angle: -87, label: 'pli 87° ↓' },
      { a: [315, 0], b: [315, L], angle: -93, label: 'pli 93° ↓' },
      { a: [15, 0], b: [15, L], angle: 45, label: 'larmier 45°' },
      { a: [395, 0], b: [395, L], angle: 45, label: 'larmier 45°' },
    ],
    gamme: [2, 3, 0, 1],
    base: [195, L / 2],
    ml: L / 1000,
    vue: { az: [-90, -101], el: [88, 21], dist: 0.62, fov: 48, fantome: 0 }, // en enfilade : la section devant, la barre qui file
  });
}

// Bavette d'appui de fenêtre, réf. 8180-B : relevé de 30 mm contre la menuiserie, plateau de 180 mm en pente de 10 %,
// nez de 40 mm, larmier de 12 mm à 45°. Longueur 1 200 mm, aluminium 2 mm thermolaqué. Embouts posés à part.
// Pente : le plateau descend de 6° vers l'extérieur ; relevé et nez verticaux, donc deux plis de 84°.
export function bavette() {
  const L = 1200;
  return makePart({
    ref: '8180-B', name: 'Bavette d’appui', matiere: 'Aluminium 5754', t: 2,
    outline: [[0, 0], [30, 0], [210, 0], [250, 0], [262, 0], [262, L], [250, L], [210, L], [30, L], [0, L]],
    holes: [],
    bends: [
      { a: [30, 0], b: [30, L], angle: 84, label: 'relevé 84° ↑' },
      { a: [210, 0], b: [210, L], angle: -84, label: 'nez 84° ↓' },
      { a: [250, 0], b: [250, L], angle: 45, label: 'larmier 45°' },
    ],
    gamme: [2, 1, 0],
    base: [120, L / 2],
    ml: L / 1000,
    vue: { az: [-90, -103], el: [88, 22], dist: 0.7, fov: 46, fantome: 0 },
  });
}

// Habillage de poteau, réf. 8150-C : un fourreau carré de 200 mm intérieur, haut de 2 500 mm, plié trois fois ;
// le quatrième angle se ferme bord à bord et se soude sur toute la hauteur. Acier 2 mm.
export function habillage() {
  const H = 2500;
  return makePart({
    ref: '8150-C', name: 'Habillage de poteau', matiere: 'Acier S235', t: 2,
    outline: [[0, 0], [200, 0], [400, 0], [600, 0], [800, 0], [800, H], [600, H], [400, H], [200, H], [0, H]],
    holes: [],
    bends: [
      { a: [200, 0], b: [200, H], angle: 90, label: 'pli 90° ↑' },
      { a: [400, 0], b: [400, H], angle: 90, label: 'pli 90° ↑' },
      { a: [600, 0], b: [600, H], angle: 90, label: 'pli 90° ↑' },
    ],
    gamme: [0, 2, 1],
    base: [300, H / 2],
    ml: H / 1000,
    vue: { az: [-90, -104], el: [88, 24], dist: 0.7, fov: 46, fantome: 0 },
    soudure: { m: H / 1000, angles: 1 },
  });
}

// Jardinière, réf. 8800-J : un fond de 800 × 300 mm percé de trois trous d'écoulement, quatre parois de 300 mm relevées
// autour (développé en croix), les quatre angles soudés sur toute la hauteur. Acier 2 mm, peint.
// Gamme : les deux grandes parois, puis les deux petites, avec un poinçon à segments réglé à 300 mm entre les parois levées.
export function jardiniere() {
  const A = 800, B = 300, Hh = 300;
  return makePart({
    ref: '8800-J', name: 'Jardinière', matiere: 'Acier S235', t: 2,
    outline: [[0, 0], [0, -Hh], [A, -Hh], [A, 0], [A + Hh, 0], [A + Hh, B], [A, B], [A, B + Hh], [0, B + Hh], [0, B], [-Hh, B], [-Hh, 0]],
    holes: [circle(200, 150, 14), circle(400, 150, 14), circle(600, 150, 14)],
    bends: [
      { a: [0, 0], b: [A, 0], angle: 90, label: 'pli 90° ↑' },
      { a: [A, 0], b: [A, B], angle: 90, label: 'pli 90° ↑' },
      { a: [0, B], b: [A, B], angle: 90, label: 'pli 90° ↑' },
      { a: [0, 0], b: [0, B], angle: 90, label: 'pli 90° ↑' },
    ],
    gamme: [0, 2, 1, 3],
    base: [A / 2, B / 2],
    soudure: { m: (4 * Hh) / 1000, angles: 4 },
  });
}

export const CATALOGUE = [
  { fn: () => jardiniere(), secteur: 'Aménagement extérieur', ral: '7016' },
  { fn: () => couvertine(), secteur: 'Toiture-terrasse', ral: '7016' },
  { fn: () => bavette(), secteur: 'Menuiserie', ral: '7016' },
  { fn: () => habillage(), secteur: 'Façade', ral: '7016' },
  { fn: () => pupitre(), secteur: 'Machines agricoles', ral: '6019' },
  { fn: () => support(), secteur: 'Ferroviaire', ral: '7016' },
  { fn: () => capot(), secteur: 'Bornes de recharge', ral: '1016' },
  { fn: () => coffret(), secteur: 'Laboratoires', ral: '9016' },
  { fn: () => equerre(), secteur: 'Mobilier urbain', ral: '6034' },
  { fn: () => platine(), secteur: 'Agencement de magasins', ral: '3012' },
];
