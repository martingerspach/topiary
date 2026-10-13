// Ourlet · gabarits que l'équipe modifie seule : fiche pièce, devis, offre d'emploi.
// Chaque gabarit = un modèle de données + un formulaire + un document A4 (794 × 1123 px à 96 dpi) qui se recompose à chaque saisie.
// Le formulaire est généré depuis le modèle : ajouter un champ, c'est ajouter une ligne au modèle.
import { LOGO, SIGNE } from './marque.js';
import { pupitre, support } from './pieces.js';
import { partView, camera, flatSVG, hex } from './part.js';
import { analyse, chiffrer, MATIERES, eur, fmtN } from './chiffrage.js';
import { TOKENS } from '../tokens/tokens.js';

const RAL = TOKENS.ral;
const ralOf = (code) => RAL.find((r) => r.code === code) || RAL.find((r) => r.code === '6019');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const logo = (w, fill = 'currentColor') => `<svg viewBox="${LOGO.viewBox}" width="${w}" height="${(w / LOGO.ratio).toFixed(1)}" aria-hidden="true"><path d="${LOGO.d}" fill="${fill}"/></svg>`;
const signe = (h, fill = 'currentColor') => `<svg viewBox="${SIGNE.viewBox}" width="${(h * SIGNE.ratio).toFixed(1)}" height="${h}" aria-hidden="true"><path d="${SIGNE.d}" fill="${fill}"/></svg>`;
const PIECES = { '3107-A': { fn: pupitre, nom: 'Pupitre de commande' }, '2041-B': { fn: support, nom: 'Support de carte' } };
const today = () => new Date(2026, 9, 8).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// ---------- Modèles ----------
export const MODELES = {
  fiche: {
    titre: 'Fiche pièce',
    aide: 'Pour l\'atelier et le client : la pièce, sa matière, sa finition et ses cotes à contrôler.',
    champs: [
      { id: 'piece', label: 'Pièce', type: 'select', options: Object.entries(PIECES).map(([k, v]) => [k, `${k}, ${v.nom.toLowerCase()}`]), val: '3107-A' },
      { id: 'designation', label: 'Désignation', type: 'text', val: 'Pupitre de commande' },
      { id: 'client', label: 'Client', type: 'text', val: 'Constructeur de machines agricoles' },
      { id: 'matiere', label: 'Matière', type: 'select', options: Object.entries(MATIERES).map(([k, m]) => [k, `${m.nom} ${m.nuance}`]), val: 'acier' },
      { id: 'ep', label: 'Épaisseur', type: 'number', unit: 'mm', val: 2, step: 0.5, min: 0.5, max: 20 },
      { id: 'ral', label: 'Finition RAL', type: 'select', options: RAL.map((r) => [r.code, `RAL ${r.code} ${r.name}`]), val: '6019' },
      { id: 'serie', label: 'Série habituelle', type: 'number', unit: 'pièces', val: 24, step: 1, min: 1 },
      { id: 'note', label: 'Remarque pour l\'atelier', type: 'text', val: 'Ourlet côté opérateur, sans marque de pliage visible.' },
    ],
  },
  devis: {
    titre: 'Devis',
    aide: 'Calculé par le même moteur que l\'outil du site ; le chargé d\'affaires relit et signe.',
    champs: [
      { id: 'numero', label: 'Numéro', type: 'text', val: 'D-2026-0412' },
      { id: 'client', label: 'Client', type: 'text', val: 'Atelier client, service achats' },
      { id: 'piece', label: 'Pièce', type: 'select', options: Object.entries(PIECES).map(([k, v]) => [k, `${k}, ${v.nom.toLowerCase()}`]), val: '3107-A' },
      { id: 'qte', label: 'Quantité', type: 'number', unit: 'pièces', val: 24, step: 1, min: 1, max: 5000 },
      { id: 'matiere', label: 'Matière', type: 'select', options: Object.entries(MATIERES).map(([k, m]) => [k, `${m.nom} ${m.nuance}`]), val: 'acier' },
      { id: 'ep', label: 'Épaisseur', type: 'number', unit: 'mm', val: 2, step: 0.5, min: 0.5, max: 20 },
      { id: 'finition', label: 'Finition', type: 'select', options: [['ral', 'Peinture poudre RAL'], ['brut', 'Brut, ébavuré']], val: 'ral' },
      { id: 'ral', label: 'Teinte', type: 'select', options: RAL.map((r) => [r.code, `RAL ${r.code} ${r.name}`]), val: '6019' },
      { id: 'validite', label: 'Validité', type: 'number', unit: 'jours', val: 30, step: 1, min: 1 },
    ],
  },
  emploi: {
    titre: 'Offre d\'emploi',
    aide: 'À afficher à l\'atelier, à publier sur le site et sur les sites d\'emploi : le métier, la paie, les horaires, la formation.',
    champs: [
      { id: 'metier', label: 'Métier', type: 'select', options: [['pliage', 'Plieur ou plieuse sur presse CN'], ['soudure', 'Soudeur ou soudeuse TIG / MIG'], ['laser', 'Opérateur ou opératrice laser'], ['peinture', 'Peintre poudre']], val: 'pliage' },
      { id: 'contrat', label: 'Contrat', type: 'select', options: [['CDI', 'CDI'], ['CDD', 'CDD de 6 mois'], ['Apprentissage', 'Apprentissage']], val: 'CDI' },
      { id: 'horaires', label: 'Horaires', type: 'select', options: [['2x8', 'En 2 × 8 : 5 h – 13 h ou 13 h – 21 h'], ['journee', 'En journée : 7 h 30 – 16 h']], val: '2x8' },
      { id: 'smin', label: 'Salaire de départ', type: 'number', unit: '€ brut', val: 2150, step: 50, min: 1800 },
      { id: 'smax', label: 'Salaire confirmé', type: 'number', unit: '€ brut', val: 2700, step: 50, min: 1800 },
      { id: 'tuteur', label: 'Qui vous forme', type: 'text', val: 'Le chef d\'équipe pliage, 22 ans de maison' },
      { id: 'visite', label: 'Essai sur machine', type: 'text', val: 'Le vendredi à 14 h, sans rendez-vous' },
    ],
  },
};
const METIERS = {
  pliage: { titre: 'Plieur ou plieuse sur presse CN', ral: '6019', missions: ['Lire le plan et la gamme de pliage', 'Régler la presse : outils, butées, angles', 'Plier les séries, contrôler au rapporteur et au pied à coulisse', 'Signaler un plan à corriger avant de lancer'], apprendre: ['Les ourlets, les pliages à plusieurs étapes', 'La programmation de la presse sur poste', 'Les tolérances de la tôlerie fine'] },
  soudure: { titre: 'Soudeur ou soudeuse TIG / MIG', ral: '6034', missions: ['Pointer et souder des ensembles en acier, inox et aluminium', 'Préparer les montages et les gabarits', 'Contrôler à l\'œil et au calibre, reprendre si besoin'], apprendre: ['Le TIG sur inox fin sans déformation', 'Le soudage robotisé, réglages et programmes', 'La lecture des symboles de soudure'] },
  laser: { titre: 'Opérateur ou opératrice laser', ral: '1016', missions: ['Charger les tôles, lancer les imbrications', 'Trier et marquer les pièces à la sortie de la machine', 'Surveiller la qualité de coupe et les consommables'], apprendre: ['L\'imbrication et la programmation', 'Les réglages par matière et par épaisseur', 'La maintenance de premier niveau'] },
  peinture: { titre: 'Peintre poudre', ral: '7016', missions: ['Accrocher les pièces, préparer et dégraisser', 'Appliquer la poudre au pistolet, cuire au four', 'Contrôler la teinte et l\'épaisseur de couche'], apprendre: ['Les changements de teinte rapides', 'Les retouches et les masquages', 'Le contrôle colorimétrique'] },
};

// ---------- Formulaire ----------
export function formHTML(key, prefix = 'g') {
  const m = MODELES[key];
  return m.champs.map((c) => {
    const id = `${prefix}-${key}-${c.id}`;
    let ctl;
    if (c.type === 'select') ctl = `<div class="ou-select-wrap"><select class="ou-select" id="${id}" data-k="${c.id}">${c.options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(c.val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
    else if (c.type === 'number') ctl = `<div class="ou-unit"><input class="ou-input" id="${id}" data-k="${c.id}" type="number" inputmode="decimal" value="${c.val}" step="${c.step}"${c.min != null ? ` min="${c.min}"` : ''}${c.max != null ? ` max="${c.max}"` : ''}><span>${c.unit}</span></div>`;
    else ctl = `<input class="ou-input" id="${id}" data-k="${c.id}" type="text" value="${esc(c.val)}">`;
    return `<div class="ou-field"><label class="ou-label" for="${id}">${c.label}</label>${ctl}</div>`;
  }).join('');
}
export function readForm(root) {
  const d = {};
  root.querySelectorAll('[data-k]').forEach((el) => { d[el.dataset.k] = el.type === 'number' ? Math.max(+el.min || 0, +el.value || 0) : el.value; });
  return d;
}

// ---------- Rendus ----------
const camFiche = camera({ eye: [-300, -260, 300], target: [120, 70, 70], fov: 30 });
function vue3d(code, ral) {
  const p = PIECES[code].fn();
  const cam = code === '3107-A' ? camFiche : camera({ eye: [-120, -300, 230], target: [80, 55, 25], fov: 26 });
  return partView(p, { cam, size: 100, color: hex(ral.value), ink: [29, 33, 35], outline: 0.4, amb: 0.4, lift: 0.14 });
}

export function fiche(d) {
  const ral = ralOf(d.ral), P = PIECES[d.piece], part = P.fn(), an = analyse(part), M = MATIERES[d.matiere];
  const v = vue3d(d.piece, ral), f = flatSVG(part, { ink: '#23292B', font: "'Hubot Sans', sans-serif", fs: 7, thin: 0.45, thick: 0.9 });
  const kg = (an.aire * d.ep / 1e6) * M.densite;
  return `<article class="doc">
  <header class="d-band" style="background:${ral.value};color:${ral.onText}"><span>${logo(150)}</span><span class="d-code">RAL ${ral.code}<small>${esc(ral.name)}</small></span></header>
  <div class="d-body">
    <div class="d-title"><h3>${esc(d.designation)}</h3><p class="d-ref">Réf. ${esc(d.piece)} · ${esc(d.client)}</p></div>
    <div class="d-views">
      <figure style="background:${ral.value}"><svg viewBox="${v.viewBox}" role="img" aria-label="${esc(d.designation)}, vue en volume, RAL ${ral.code}">${v.inner}</svg><figcaption style="color:${ral.onText}">Vue en volume</figcaption></figure>
      <figure><svg viewBox="0 0 ${f.w} ${f.h}" role="img" aria-label="Développé coté">${f.svg}</svg><figcaption>Développé, ${fmtN(an.w, 0)} × ${fmtN(an.h, 0)} mm</figcaption></figure>
    </div>
    <dl class="d-spec">
      <dt>Matière</dt><dd>${M.nom} ${M.nuance}, ép. ${fmtN(+d.ep)} mm</dd>
      <dt>Finition</dt><dd>Peinture poudre RAL ${ral.code} ${esc(ral.name)}</dd>
      <dt>Poids</dt><dd>${fmtN(kg, 2)} kg par pièce</dd>
      <dt>Découpe</dt><dd>${fmtN(an.decoupe / 1000, 2)} m, ${an.amorcages} amorçages</dd>
      <dt>Plis</dt><dd>${an.plis} pli${an.plis > 1 ? 's' : ''}${an.ourlets ? `, ${an.ourlets} ourlet` : ''}, dans l'ordre de la gamme</dd>
      <dt>Série</dt><dd>${fmtN(+d.serie, 0)} pièces</dd>
    </dl>
    <table class="ou-table d-ctrl"><thead><tr><th>Cote à contrôler</th><th class="num">Nominal</th><th class="num">Tolérance</th></tr></thead><tbody>
      <tr><td>Longueur développée</td><td class="num">${fmtN(an.h, 0)} mm</td><td class="num">± 0,1 mm</td></tr>
      <tr><td>Largeur</td><td class="num">${fmtN(an.w, 0)} mm</td><td class="num">± 0,1 mm</td></tr>
      <tr><td>Angles de pli</td><td class="num">${[...new Set(part.bends.map((b) => Math.abs(b.angle)))].map((a) => a + '°').join(', ')}</td><td class="num">± 0,5°</td></tr>
    </tbody></table>
    <p class="d-note"><strong>Pour l'atelier :</strong> ${esc(d.note)}</p>
  </div>
  <footer class="d-foot"><span>${signe(11)} Ourlet · Baume-les-Dames (25) · 03 53 01 47 20</span><span>Fiche du ${today()} · page 1/1</span></footer>
</article>`;
}

export function devis(d) {
  const P = PIECES[d.piece], part = P.fn(), an = analyse(part), M = MATIERES[d.matiere];
  const c = chiffrer(an, { matiere: d.matiere, ep: +d.ep, qte: +d.qte, finition: d.finition, ral: d.ral });
  const ht = c.total, tva = ht * 0.2;
  const ral = ralOf(d.ral);
  return `<article class="doc">
  <header class="d-head"><span>${logo(150)}</span><div class="d-who"><strong>Ourlet</strong><span>Tôlerie fine, Baume-les-Dames (25)</span><span>03 53 01 47 20</span></div></header>
  <div class="d-body">
    <div class="d-title"><h3>Devis ${esc(d.numero)}</h3><p class="d-ref">Pour ${esc(d.client)} · du ${today()} · valable ${fmtN(+d.validite, 0)} jours</p></div>
    <p class="d-lead">${fmtN(c.qte, 0)} × ${P.nom.toLowerCase()} réf. ${esc(d.piece)}, ${M.nom.toLowerCase()} ${M.nuance} ép. ${fmtN(+d.ep)} mm${d.finition === 'ral' ? `, peint RAL ${ral.code} ${esc(ral.name)}` : ', brut ébavuré'}.</p>
    <table class="ou-table d-lines"><thead><tr><th>Poste</th><th class="num">Par pièce</th><th class="num">Total</th></tr></thead><tbody>
      ${c.lignes.map((l) => `<tr><td><strong>${esc(l.libelle)}</strong><span>${esc(l.detail)}</span></td><td class="num">${eur(l.unit)}</td><td class="num">${eur(l.total)}</td></tr>`).join('')}
    </tbody><tfoot>
      <tr><td>Total hors taxes</td><td class="num">${eur(c.unit)}</td><td class="num">${eur(ht)}</td></tr>
      <tr class="sub"><td>TVA 20 %</td><td></td><td class="num">${eur(tva)}</td></tr>
      <tr><td>Total toutes taxes comprises</td><td></td><td class="num">${eur(ht + tva)}</td></tr>
    </tfoot></table>
    <div class="d-cols">
      <div><h4>Délai</h4><p>Expédition ${c.delai[0]} à ${c.delai[1]} jours ouvrés après votre accord et la validation du plan.</p></div>
      <div><h4>Conditions</h4><p>Départ atelier, emballage compris. Paiement à 45 jours fin de mois. Prix établis sur le plan reçu : toute modification fait l'objet d'un avenant.</p></div>
    </div>
    <div class="d-sign"><div><h4>Le chargé d'affaires</h4><p>Relu et validé</p></div><div><h4>Bon pour accord</h4><p>Date, nom, signature</p></div></div>
  </div>
  <footer class="d-foot"><span>${signe(11)} Ourlet SAS · Baume-les-Dames (25)</span><span>Devis ${esc(d.numero)} · page 1/1</span></footer>
</article>`;
}

export function emploi(d) {
  const m = METIERS[d.metier], ral = ralOf(m.ral);
  const hor = d.horaires === '2x8' ? ['En 2 × 8', 'une semaine 5 h – 13 h, une semaine 13 h – 21 h, prime d\'équipe en plus'] : ['En journée', '7 h 30 – 16 h, du lundi au vendredi'];
  return `<article class="doc">
  <header class="d-poster" style="background:${ral.value};color:${ral.onText}">
    <div class="d-poster-top"><span>${logo(130)}</span><span class="d-code">RAL ${ral.code}</span></div>
    <p class="d-kicker">${esc(d.contrat)} à Baume-les-Dames (Doubs)</p>
    <h3>${esc(m.titre)}</h3>
  </header>
  <div class="d-body">
    <div class="d-pay"><div><span>Au départ</span><strong>${fmtN(+d.smin, 0)} €</strong></div><div><span>Confirmé</span><strong>${fmtN(+d.smax, 0)} €</strong></div><p>Brut par mois, 35 heures, treizième mois après un an.</p></div>
    <div class="d-cols">
      <div><h4>${hor[0]}</h4><p>${hor[1]}.</p></div>
      <div><h4>Qui vous forme</h4><p>${esc(d.tuteur)}. Trois semaines en binôme avant de travailler seul.</p></div>
    </div>
    <div class="d-cols">
      <div><h4>Ce que vous ferez</h4><ul>${m.missions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div><h4>Ce que vous apprendrez</h4><ul>${m.apprendre.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
    <div class="d-visit" style="background:${ral.value};color:${ral.onText}"><h4>Venez essayer la machine</h4><p>${esc(d.visite)}. Pas de CV à préparer : vous voyez l'atelier, vous pliez une pièce, on en parle.</p></div>
  </div>
  <footer class="d-foot"><span>${signe(11)} Ourlet · Baume-les-Dames (25) · 03 53 01 47 20</span><span>Offre du ${today()}</span></footer>
</article>`;
}

export const RENDUS = { fiche, devis, emploi };

// Feuille de style des documents (A4, 794 px de large) — injectée une fois
export const DOC_CSS = `
.doc { width: 794px; min-height: 1123px; background: #FFFFFF; color: #23292B; display: grid; grid-template-rows: auto 1fr auto; font-family: var(--ou-font-sans); font-size: 15px; line-height: 1.5; box-shadow: 0 1px 0 rgb(0 0 0 / .06), 0 0 0 1px rgb(0 0 0 / .08); }
.doc h3 { margin: 0; font-size: 34px; line-height: 1.05; font-weight: 700; font-stretch: 112%; letter-spacing: -0.02em; }
.doc h4 { margin: 0 0 4px; font-size: 16px; font-weight: 650; }
.doc p { margin: 0; }
.doc ul { margin: 0; padding-left: 18px; }
.d-band { display: flex; justify-content: space-between; align-items: center; padding: 26px 48px; }
.d-code { font-family: var(--ou-font-code); font-size: 26px; font-weight: 560; display: grid; text-align: right; line-height: 1.1; }
.d-code small { font-family: var(--ou-font-sans); font-size: 15px; font-weight: 560; }
.d-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 40px 48px 24px; border-bottom: 2px solid #23292B; margin: 0 48px; padding-inline: 0; }
.d-who { display: grid; text-align: right; }
.d-body { padding: 32px 48px; display: grid; gap: 24px; align-content: start; }
.d-title { display: grid; gap: 6px; }
.d-ref { color: #52595C; }
.d-lead { font-size: 17px; }
.d-views { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.d-views figure { margin: 0; display: grid; gap: 6px; padding: 12px; background: #F6F7F2; }
.d-views svg { width: 100%; height: 230px; display: block; }
.d-views figcaption { font-size: 15px; color: #52595C; }
.d-spec { display: grid; grid-template-columns: 9em 1fr; gap: 6px 20px; margin: 0; }
.d-spec dt { color: #52595C; } .d-spec dd { margin: 0; font-weight: 560; }
.d-ctrl th, .d-ctrl td, .d-lines th, .d-lines td { font-size: 15px; padding-top: 9px; padding-bottom: 9px; }
.d-lines td span { display: block; color: #52595C; }
.d-lines tfoot tr.sub td { font-weight: 450; color: #52595C; }
.d-lines tfoot tr:last-child td { border-top: 2px solid #23292B; font-size: 17px; }
.d-note { padding: 12px 16px; background: #F6F7F2; }
.d-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.d-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 8px; }
.d-sign > div { border-top: 1px solid #C3C5BD; padding-top: 8px; min-height: 90px; }
.d-sign p { color: #52595C; }
.d-foot { display: flex; justify-content: space-between; gap: 16px; padding: 18px 48px 26px; color: #52595C; font-size: 15px; border-top: 1px solid #DCDED5; margin-inline: 48px; padding-inline: 0; }
.d-foot svg { vertical-align: -1px; margin-right: 6px; }
.d-poster { padding: 30px 48px 40px; display: grid; gap: 14px; }
.d-poster-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 36px; }
.d-poster h3 { font-size: 54px; line-height: 0.98; max-width: 12ch; }
.d-kicker { font-size: 18px; font-weight: 560; }
.d-pay { display: grid; grid-template-columns: auto auto 1fr; gap: 8px 36px; align-items: end; padding-bottom: 20px; border-bottom: 2px solid #23292B; }
.d-pay div { display: grid; }
.d-pay span { color: #52595C; }
.d-pay strong { font-size: 52px; line-height: 1; font-weight: 720; font-stretch: 112%; letter-spacing: -0.02em; }
.d-pay p { grid-column: 1 / -1; color: #52595C; }
.d-visit { padding: 18px 22px; }
`;
