// Ourlet · pré-chiffrage indicatif d'une pièce en tôle (entreprise fictive : taux et prix inventés, plausibles en 2026).
// Le calcul suit la gamme d'atelier : matière (flan + chute), découpe laser (longueur coupée, perçages), pliage (coups de presse),
// soudure (mètres de cordon, v5), finition (peinture poudre au m²), mise en route (programmation, réglages) répartie sur la série,
// ébavurage et emballage, puis le coefficient de frais et de marge. Le résultat est une fourchette : l'atelier la confirme par un
// devis. v5 : prix au mètre linéaire des profils, date de mise à disposition en jours ouvrés (fériés exclus).

// pli : l'épaisseur la plus forte que nos presses plient (fiche de capacités) ; au-delà, la pièce reste à plat
export const MATIERES = {
  acier: { nom: 'Acier', nuance: 'DC01 / S235', densite: 7.85, eurKg: 1.35, pli: 8, ep: [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20],
    vitesse: [[0.5, 42000], [1, 30000], [2, 12000], [3, 6000], [5, 3500], [8, 2000], [12, 1100], [20, 500]] },
  inox: { nom: 'Inox', nuance: '304L', densite: 7.95, eurKg: 4.6, pli: 6, ep: [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10],
    vitesse: [[0.5, 40000], [1, 28000], [2, 10000], [3, 5500], [5, 2500], [8, 1200], [10, 800]] },
  alu: { nom: 'Aluminium', nuance: '5754 H111', densite: 2.68, eurKg: 5.8, pli: 6, ep: [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10],
    vitesse: [[0.5, 42000], [1, 30000], [2, 14000], [3, 8000], [5, 3500], [8, 1500], [10, 1000]] },
};
// Teintes en stock : les teintes courantes du bâtiment (v5) ; les autres demandent 5 jours ouvrés de plus
export const STOCK = ['7016', '7022', '9005', '9010', '9016', '8019'];
export const TAUX = {
  laser: 180,            // €/h, laser fibre 6 kW avec opérateur
  presse: 85,            // €/h, presse plieuse avec opérateur
  peinture: 18,          // €/m² peint (deux faces), poudre polyester, teinte RAL du nuancier
  peintureMini: 80,      // € par lot (changement de teinte)
  soudure: 62,           // €/h, poste MIG avec soudeur
  soudureV: 4,           // m de cordon par heure, pointage, soudure et meulage des angles compris
  reglageSoudure: 20,    // min de montage du gabarit par lot
  prog: 30,              // min de programmation et d'imbrication par lot
  reglagePliage: 30,     // min de réglage de la presse par lot
  reglageParPli: 5,      // min de plus par pli différent
  chute: 0.8,            // rendement d'imbrication sur la tôle
  ebavurage: 0.6,        // € par pièce
  emballage: 0.5,        // € par pièce
  coef: 1.25,            // frais généraux et marge
  fourchette: [0.9, 1.1],
};

const interp = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return pts[pts.length - 1][1];
};

// Ce que le plan dit de la pièce : encombrement, aire, découpe, amorçages, plis ; soudure et longueur des profils si la pièce les décrit
export function analyse(part) {
  const xs = part.outline.map((p) => p[0]), ys = part.outline.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const plis = part.bends.filter((b) => Math.abs(b.angle) < 170).length;
  const ourlets = part.bends.filter((b) => Math.abs(b.angle) >= 170).length;
  const angles = new Set(part.bends.map((b) => Math.abs(b.angle))).size;
  const sd = part.soudure || null;
  return { w, h, aire: part.flatArea, decoupe: part.cutLength, amorcages: part.pierces, plis, ourlets, coups: plis + 2 * ourlets, angles,
    soudure: sd ? sd.m : 0, anglesSoudes: sd ? sd.angles : 0, ml: part.ml || 0 };
}

export function chiffrer(an, { matiere = 'acier', ep = 2, qte = 1, finition = 'ral', ral = '6019' } = {}) {
  const M = MATIERES[matiere], T = TAUX, q = Math.max(1, Math.round(qte));
  const lignes = [];
  // Matière : flan rectangulaire, divisé par le rendement d'imbrication
  const kg = ((an.w * an.h * ep) / 1e6) * M.densite / T.chute;
  lignes.push({ id: 'matiere', libelle: `Matière\u00a0: ${M.nom.toLowerCase()} ${M.nuance}, ${fmtN(ep)}\u00a0mm`, detail: `${fmtN(kg, 2)}\u00a0kg avec la chute`, unit: kg * M.eurKg });
  // Découpe laser
  const v = interp(M.vitesse, ep), amorce = 0.25 + 0.15 * ep;
  const minLaser = an.decoupe / v + (an.amorcages * amorce) / 60;
  lignes.push({ id: 'laser', libelle: 'Découpe laser', detail: `${fmtN(an.decoupe / 1000, 2)}\u00a0m de coupe, ${fmtN(minLaser * 60, 0)}\u00a0s par pièce`, unit: (minLaser / 60) * T.laser });
  // Pliage : un coup par pli, deux par ourlet ; le temps de manutention croît avec la taille
  if (an.coups) {
    const sCoup = 10 + Math.hypot(an.w, an.h) / 100;
    lignes.push({ id: 'pliage', libelle: 'Pliage', detail: `${an.plis} pli${an.plis > 1 ? 's' : ''}${an.ourlets ? `, ${an.ourlets} ourlet${an.ourlets > 1 ? 's' : ''} (deux coups)` : ''}, ${fmtN(sCoup * an.coups, 0)}\u00a0s par pièce`, unit: ((sCoup * an.coups) / 3600) * T.presse });
  }
  // Soudure : au mètre de cordon
  if (an.soudure) {
    lignes.push({ id: 'soudure', libelle: 'Soudure', detail: `${an.anglesSoudes} angle${an.anglesSoudes > 1 ? 's' : ''} soudé${an.anglesSoudes > 1 ? 's' : ''}, ${fmtN(an.soudure, 1)}\u00a0m de cordon`, unit: (an.soudure / T.soudureV) * T.soudure });
  }
  // Finition
  if (finition === 'ral') {
    const m2 = (2 * an.aire) / 1e6, lot = Math.max(m2 * q * T.peinture, T.peintureMini);
    lignes.push({ id: 'peinture', libelle: `Thermolaquage RAL\u00a0${ral}`, detail: `${fmtN(m2, 3)}\u00a0m² par pièce, deux faces`, unit: lot / q });
  }
  // Mise en route, répartie sur la série
  const minRegl = T.prog + (an.coups ? T.reglagePliage + T.reglageParPli * an.angles : 0);
  const miseEnRoute = (T.prog / 60) * T.laser + (an.coups ? ((minRegl - T.prog) / 60) * T.presse : 0) + (an.soudure ? (T.reglageSoudure / 60) * T.soudure : 0);
  lignes.push({ id: 'reglage', libelle: 'Réglage des machines', detail: `${fmtN(miseEnRoute, 0)}\u00a0€ répartis sur ${q} pièce${q > 1 ? 's' : ''}`, unit: miseEnRoute / q });
  lignes.push({ id: 'finition', libelle: 'Ébavurage et emballage', detail: 'par pièce', unit: T.ebavurage + T.emballage });
  const brut = lignes.reduce((s, l) => s + l.unit, 0);
  const unit = brut * T.coef;
  lignes.forEach((l) => { l.unit *= T.coef; l.total = l.unit * q; });
  const sd = an.soudure ? 2 : 0, hors = finition === 'ral' && !STOCK.includes(String(ral)) ? 5 : 0; // teinte hors stock : poudre commandée
  // délais de la fiche de capacités : découpe seule 3 jours ouvrés, 5 avec pliage (découpe comprise), soudure 2 de plus,
  // peinture 2 de plus en teinte de stock (5 de plus encore pour une autre teinte) ; la borne haute garde 2 à 3 jours de marge
  const base = an.coups ? 5 : 3;
  const delai = [base + sd + hors + (finition === 'ral' ? 2 : 0) + Math.floor(q / 500), base + 2 + sd + hors + (finition === 'ral' ? 3 : 0) + Math.floor(q / 300)];
  return { lignes, unit, total: unit * q, qte: q, fourchette: [unit * T.fourchette[0], unit * T.fourchette[1]], delai, kg: kg * T.chute, parMetre: an.ml ? unit / an.ml : 0 };
}

// Épaisseurs proposées pour une matière : toute la gamme du laser pour une pièce à plat, la limite des presses pour une pièce pliée
export const epaisseurs = (matiere, plie) => MATIERES[matiere].ep.filter((e) => !plie || e <= MATIERES[matiere].pli);

// Prix unitaire selon la quantité : la mise en route s'amortit
export function paliers(an, opts, qtes = [1, 5, 10, 25, 50, 100, 250, 500, 1000]) {
  return qtes.map((q) => ({ q, unit: chiffrer(an, { ...opts, qte: q }).unit }));
}

export const fmtN = (v, d = 1) => v.toLocaleString('fr-FR', { minimumFractionDigits: d === 0 ? 0 : (Math.round(v) === v && d === 1 ? 0 : d), maximumFractionDigits: d }).replace(/\u202f/g, '\u00a0');
export const eur = (v) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f/g, '\u00a0') + ' €';

// Jours fériés en France (métropole) pour une année : fixes, et ceux qui suivent Pâques (calcul de Meeus)
function feries(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  const paques = new Date(y, mo - 1, da), plus = (n) => { const x = new Date(paques); x.setDate(x.getDate() + n); return x; };
  return [new Date(y, 0, 1), plus(1), new Date(y, 4, 1), new Date(y, 4, 8), plus(39), plus(50), new Date(y, 6, 14), new Date(y, 7, 15), new Date(y, 10, 1), new Date(y, 10, 11), new Date(y, 11, 25)]
    .map((x) => `${x.getMonth()}-${x.getDate()}`);
}
const ouvre = (d) => d.getDay() !== 0 && d.getDay() !== 6 && !feries(d.getFullYear()).includes(`${d.getMonth()}-${d.getDate()}`);
// Date de mise à disposition : n jours ouvrés après le jour de réception ; un plan reçu après 11 h (ou un jour non ouvré)
// est compté du jour ouvré suivant.
export function dateDispo(n, from = new Date(), limite = 11) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (!ouvre(d) || from.getHours() >= limite) { do d.setDate(d.getDate() + 1); while (!ouvre(d)); }
  let k = 0;
  while (k < n) { d.setDate(d.getDate() + 1); if (ouvre(d)) k++; }
  return d;
}
export const fmtDate = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
