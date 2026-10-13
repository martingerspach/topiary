// Ourlet · outil de pré-chiffrage : déposer un plan (DXF) ou choisir une pièce, régler matière, épaisseur, quantité, finition,
// voir la pièce se plier et lire un prix indicatif, avec la courbe des prix par quantité et le détail du calcul.
// Rien ne quitte le navigateur : le plan est lu sur place. Entreprise fictive : prix inventés.
// États de la carte du prix : prix (succès), vide (pas de quantité), chargement (plan en lecture), erreur (plan illisible,
// quantité hors limites), humain (fichier lu par l'atelier : DWG, STEP, PDF, croquis, photo ; série de plus de 5 000 pièces). Chaque changement est
// annoncé aux lecteurs d'écran par une phrase courte, une fois la saisie posée.
//
// Itération 8 : la carte du prix devient un outil de chiffrage dessiné (voir « un seul état affiché » et « Courbe » plus bas).
// - le prix reste collé en tête de carte pendant que le reste défile ; sa fourchette de 10 % est une zone hachurée entre deux bornes ;
// - la date s'explique par une frise des jours ouvrés, poste par poste (ceux de la fiche de capacités) ;
// - le prix se décompose poste par poste : chaque poste porte sa part sur son filet, à la suite du précédent (une gamme) ;
//   quand la quantité monte, la part du réglage se replie et les autres glissent : on voit pourquoi le prix baisse ;
// - la courbe est un graphique d'atelier : règle logarithmique, vraie courbe (interpolée en 1 / q entre les quantités chiffrées),
//   aire hachurée, repère, palier suivant, exploration au pointeur, au doigt et au clavier ; elle se trace comme une coupe laser ;
// - prix, fourchette, parts, jours, courbe et tableaux ouverts rejoignent leur nouvelle valeur ensemble, sur l'horloge commune.
// Références de métier : la règle à calcul et le papier semi-logarithmique (abscisse), les hachures de coupe du dessin
// technique (zones), le diagramme de Gantt du planning d'atelier (frise), la gamme de fabrication (ordre des postes),
// le perçage puis la coupe à vitesse constante d'un laser (tracé d'entrée). Aucune marque de fabricant.
//
// Itération 7 : plus aucun changement d'état ne saute d'une image à l'autre.
// - « Pliée / À plat » : la pièce se déplie pendant que la caméra remonte à la verticale, exactement sur le tracé du plan
//   coté, qui prend le relais (la trame s'efface, les cotes arrivent) ; le retour rejoue le geste à l'envers ;
// - l'épaisseur s'interpole dans la vue (les chants épaississent), la liste des épaisseurs d'une matière se met à jour sur
//   place (les pastilles en trop s'effacent, la hauteur glisse) ; la teinte se dépose en poudre (developpe-v7.js) ;
// - le prix passe d'une valeur à l'autre en comptant, sur le geste d'approche ; la courbe glisse : points, repère,
//   étiquette et graduations (l'axe se remet à l'échelle sans que rien n'apparaisse d'un coup) ;
// - les vignettes des pièces d'exemple sont gravées par le moteur de la vue (une seule langue d'illustration) ;
// - tout passe par l'horloge commune (motion.js) : rien ne bouge en mouvements réduits, l'annonce aux lecteurs d'écran reste
//   la même, une seule fois, à la valeur finale.
import { CATALOGUE } from './pieces.js';
import { autoCam, flatSVG, partView, hex } from './part-v7.js';
import { mountDeveloppe, vignettes } from './developpe-v7.js';
import { dxfToPart } from './dxf.js';
import { analyse, chiffrer, epaisseurs, MATIERES, STOCK, dateDispo, fmtDate, eur, fmtN } from './chiffrage.js';
import { TOKENS, ILLU, MOTION, P } from '../tokens/tokens-v2.js';
// la vue de la pièce : la même gravure que le premier écran et le film (une seule langue d'illustration sur la page)
const PAPIER = { fond: P['creme-50'], traitFond: P['creme-50'], trait0: P['taupe-500'], trait1: P.encre };
import { EASE, onceVisible, ticker, prefersReduced, observateur } from './motion.js';

// le prix et la courbe rejoignent leur nouvelle valeur dans la durée du geste « retour » de la presse, sur la courbe d'approche
const PRIX_MS = MOTION.presse.retour.ms;
const lisse = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
// une interpolation sur l'horloge commune : fn(u de 0 à 1), puis fin() ; renvoie de quoi l'arrêter
function glisser(ms, fn, fin = null) {
  let age = 0, mort = false;
  const tk = ticker((dt) => { if (mort) return false; age += dt; const u = Math.min(1, age / ms); fn(u); if (u >= 1) { mort = true; tk.destroy(); fin && fin(); return false; } return true; });
  fn(0); tk.start();
  return { stop() { mort = true; tk.destroy(); }, get fini() { return mort; } };
}

const RAL = TOKENS.ral;
const ralOf = (c) => RAL.find((r) => r.code === c) || RAL.find((r) => r.code === '7016');
// v5 : les pièces du bâtiment d'abord (Julien), puis deux pièces d'industrie (Sophie) ; indices dans CATALOGUE
const GROUPES = [['Pièces pour le bâtiment', [0, 1, 2, 3]], ['Pièces pour l\u2019industrie', [4, 7]]];
const BRUT = { acier: ILLU['brut-acier'], inox: ILLU['brut-inox'], alu: ILLU['brut-alu'] };
const QTES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
const QMAX = 5000;
const NB = '\u00a0';
// --- Itération 8 : constantes de la carte du prix (valeurs à verser dans les tokens, voir le rapport) ---
const NS = 61;                 // échantillons de la courbe (un tous les 1/20 de décade)
const ORDRE = ['matiere', 'laser', 'pliage', 'soudure', 'peinture', 'reglage', 'finition']; // les postes du prix, dans l'ordre de la gamme
// les postes de la frise des jours ouvrés, dans l'ordre de l'atelier, et leur durée (fiche de capacités : 3 jours pour la découpe,
// 5 avec le pliage, 2 de plus pour la soudure, 2 de plus pour la peinture en teinte de stock, 5 de plus encore pour une autre teinte)
const JOURS = [['decoupe', 'Découpe'], ['pliage', 'Pliage'], ['soudure', 'Soudure'], ['peinture', 'Peinture'], ['serie', 'Grande série'], ['imprevus', 'Imprévus']];
const DELAIS = { decoupe: 3, pliage: 2, soudure: 2, peinture: 2, horsStock: 5 };
const MINCE = 0.006;           // part minimale dessinée d'un poste (2 px sur une carte de téléphone) : aucun poste n'est invisible
const ACCROCHE = 12;           // px : en deçà, le pointeur s'accroche au palier voisin
const SONDE_MS = 45;           // constante de temps de la sonde, qui glisse vers la quantité survolée
const ENTREE = { repere: 120, chute: 5 }; // tracé d'entrée : attente du repère après la coupe (ms), hauteur de pose de la zone hachurée (px)
const SORTIE_MS = 90;          // un texte ou un état qui s'efface avant d'être remplacé (le fondu d'arrivée dure MOTION.micro)
const ROULE = 0.86;            // em : course d'un signe du grand prix quand il roule vers sa nouvelle valeur (une hauteur de chiffre)
const VOILE = 0.32;            // opacité de la carte en attente (quantité à corriger, plan en lecture) : visible, mais hors jeu
const ICON = {
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/></svg>',
  load: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" class="tourne"><path d="M12 3a9 9 0 1 1-9 9"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
};
const matOf = (s) => (/inox/i.test(s || '') ? 'inox' : /alu/i.test(s || '') ? 'alu' : 'acier');
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function mountOutil(root, { onPart = null, onPrix = null } = {}) {
  const $ = (s) => root.querySelector(s);
  const state = { idx: 0, part: null, src: 'exemple', fileName: '', file: null, matiere: 'acier', ep: 2, qte: 4, qteTxt: '4', finition: 'ral', ral: '7016', etat: 'prix' };
  let stage = null, seen = false;
  const RM = prefersReduced();

  // ---------- Annonces (une phrase courte, une fois la saisie posée) ----------
  const annonce = $('[data-annonce]');
  let annT = 0;
  const dire = (txt, now = false) => { clearTimeout(annT); const go = () => { annonce.textContent = ''; requestAnimationFrame(() => { annonce.textContent = txt; }); }; if (now) go(); else annT = setTimeout(go, 700); };

  // ---------- Pièces d'exemple ----------
  // les vignettes : la pièce gravée par le moteur de la vue, à la taille exacte de l'écran (52 × 44 px, nette à 1× comme à 2×),
  // dans sa teinte d'exemple ; un profil de 3 m y montre un tronçon, la section vers l'œil. Sans WebGL2 : un dessin au trait.
  const exBtn = (i) => { const c = CATALOGUE[i], p = c.fn(); return `<button type="button" class="ex" data-i="${i}" aria-pressed="${i === 0}"><span class="ex-pic"><canvas data-vig="${i}" aria-hidden="true" style="width:100%;height:100%;display:block"></canvas></span><span class="ex-txt"><strong>${p.name}</strong><span>${c.secteur}</span></span></button>`; };
  $('[data-exemples]').innerHTML = GROUPES.map(([titre, idx], g) => `<div class="ex-grp" role="group" aria-labelledby="ex-g${g}"><span class="ex-titre" id="ex-g${g}">${titre}</span><div class="ex-list">${idx.map(exBtn).join('')}</div></div>`).join('');
  $('[data-exemples]').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) choisir(+b.dataset.i); });
  function graverVignettes() {
    const cvs = [...$('[data-exemples]').querySelectorAll('canvas[data-vig]')]; if (!cvs.length || !cvs[0].clientWidth) return false;
    const ok = vignettes(cvs.map((cv) => { const c = CATALOGUE[+cv.dataset.vig]; return { canvas: cv, part: c.fn(), teinte: ralOf(c.ral).value }; }), { couleurs: PAPIER });
    if (!ok) for (const cv of cvs) { // repli : la pièce au trait, tons du papier
      const c = CATALOGUE[+cv.dataset.vig], p = c.fn(), v = partView(p, { cam: autoCam(p), size: 100, color: hex(P['greige-300']), ink: hex(P.encre), outline: 1.6, amb: 0.5, lift: 0.1, pad: 0.08 });
      cv.outerHTML = `<svg viewBox="${v.viewBox}" aria-hidden="true">${v.inner}</svg>`;
    }
    return true;
  }
  // gravées à l'approche de l'outil (la page s'affiche sans les attendre), puis regravées si la densité de l'écran change
  { const io = observateur((es) => { if (es.some((e) => e.isIntersecting) && graverVignettes()) io.disconnect(); }, { rootMargin: '100% 0px' }); io.observe($('[data-exemples]'));
    const veille = () => { const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`); mq.addEventListener('change', () => { graverVignettes(); veille(); }, { once: true }); }; veille(); }

  // ---------- Dépôt de plan ----------
  const drop = $('[data-drop]'), file = $('[data-file]');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.setAttribute('data-over', ''); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.removeAttribute('data-over'); }));
  drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) lire(f); });
  file.addEventListener('change', () => { if (file.files[0]) lire(file.files[0]); });
  async function lire(f) {
    state.fileName = f.name; state.file = f;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!['dxf', 'dwg', 'step', 'stp', 'pdf', 'jpg', 'jpeg', 'png', 'heic'].includes(ext)) {
      statut([['err', `Nous ne lisons pas ce type de fichier (${f.name}).`]]);
      etat('erreur', 'Envoyez plutôt un DXF, un DWG, un STEP, un PDF ou une photo de votre croquis.');
      return;
    }
    if (ext !== 'dxf') {
      statut([['info', `Nous chiffrerons ${f.name} nous-mêmes. Indiquez la quantité et la matière.`]]);
      state.src = 'humain'; calcul(); return;
    }
    // chargement : visible le temps d'un geste d'approche au moins, même pour un petit fichier
    statut([['load', `Lecture de ${f.name}…`]]); etat('chargement', `Lecture de ${f.name}…`); dire(`Lecture de ${f.name}.`, true);
    try {
      const [text] = await Promise.all([f.text(), wait(MOTION.presse.approche.ms)]);
      await frame();
      const part = dxfToPart(text, { t: state.ep, name: f.name.replace(/\.dxf$/i, '') });
      state.part = part; state.src = 'dxf'; state.idx = -1;
      majEpaisseurs();
      $('[data-exemples]').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      afficherPiece();
    } catch (err) {
      statut([['err', err.plan ? err.message : 'Nous n\u2019arrivons pas à lire ce plan.']]);
      etat('erreur', `Nous n\u2019avons pas pu lire ${f.name}. Envoyez-le tel quel, nous le regardons dans la journée.`);
      viewer.setAttribute('data-stale', '');
    }
  }

  // ---------- Matière, épaisseur, quantité, finition ----------
  root.querySelectorAll('input[name="ou-mat"]').forEach((r) => r.addEventListener('change', () => { state.matiere = r.value; majEpaisseurs(); if (state.part && state.part.t !== state.ep) { state.part.t = state.ep; majEpaisseurVue(); } calcul(); peindre(); }));
  // la liste des épaisseurs se met à jour sur place : les pastilles qui sortent s'effacent, celles qui entrent apparaissent,
  // et la hauteur du bloc glisse si la liste change de nombre de rangées (plus de liste réécrite d'un coup)
  const epBox = $('[data-ep]');
  let epTk = null;
  const onEp = (ev) => { state.ep = +ev.currentTarget.value; if (state.part) { state.part.t = state.ep; majEpaisseurVue(); } calcul(); };
  function majEpaisseurs() {
    // une pièce pliée ne dépasse pas ce que plient nos presses (acier 8 mm, inox et aluminium 6 mm) ; une pièce à plat a toute la gamme du laser
    const list = epaisseurs(state.matiere, !!(state.part && state.part.bends && state.part.bends.length));
    if (!list.includes(state.ep)) state.ep = list.reduce((a, b) => (Math.abs(b - state.ep) < Math.abs(a - state.ep) ? b : a));
    if (!epBox.firstElementChild) epBox.innerHTML = `<legend class="ou-label">Épaisseur, en mm</legend>`;
    const labs = new Map([...epBox.querySelectorAll('label')].map((l) => [+l.dataset.e, l]));
    const direct = RM || !labs.size || !epBox.offsetHeight, h0 = epBox.offsetHeight;
    for (const e of list) if (!labs.has(e)) {
      const l = document.createElement('label'); l.dataset.e = e; l.innerHTML = `<input type="radio" name="ou-ep" value="${e}"><span>${fmtN(e)}</span>`;
      l.querySelector('input').addEventListener('change', onEp); l._o = direct ? 1 : 0; if (!direct) l.style.opacity = '0';
      epBox.append(l); labs.set(e, l);
    }
    for (const [e, l] of labs) { const r = l.querySelector('input'); l._o ??= 1; l._cible = list.includes(e) ? 1 : 0; r.disabled = !l._cible; r.checked = e === state.ep; }
    if (direct) { for (const l of labs.values()) if (!l._cible) l.remove(); else { l._o = 1; l.style.opacity = ''; } return; }
    glisserHauteur(epBox, h0);
    epTk ||= ticker((dt) => {
      let reste = false, sortis = [];
      for (const l of epBox.querySelectorAll('label')) {
        if (l._o !== l._cible) { const d = dt / MOTION.micro.ms; l._o = l._cible > l._o ? Math.min(1, l._o + d) : Math.max(0, l._o - d); l.style.opacity = l._o >= 1 ? '' : String(l._o); }
        if (l._o !== l._cible) reste = true; else if (!l._cible) sortis.push(l);
      }
      if (sortis.length) { const h = epBox.offsetHeight; sortis.forEach((l) => l.remove()); glisserHauteur(epBox, h); }
      return reste;
    });
    epTk.start();
  }
  // un bloc dont le contenu vient de changer rejoint sa hauteur naturelle depuis h0 (geste d'approche), puis se libère :
  // ce qui est dessous glisse au lieu de sauter (liste des épaisseurs, texte du prix qui passe de deux lignes à trois, messages)
  const hauteurs = new Map();
  function glisserHauteur(el, h0, vers = null, fin = null) {
    const enCours = hauteurs.get(el); if (enCours) { enCours.stop(); hauteurs.delete(el); enCours.fin && enCours.fin(); }
    const libre = () => { el.style.height = ''; el.style.overflow = ''; el.style.alignContent = ''; };
    libre();
    const h1 = vers ?? el.getBoundingClientRect().height; if (RM || !h0 || !h1 || Math.abs(h1 - h0) < 0.5) { fin && fin(); return; }
    el.style.overflow = 'clip'; el.style.alignContent = 'start';
    const tw = glisser(MOTION.presse.approche.ms, (u) => { el.style.height = `${lerp(h0, h1, EASE.approche(u)).toFixed(3)}px`; }, () => { hauteurs.delete(el); fin && fin(); libre(); });
    tw.fin = fin; hauteurs.set(el, tw);
  }
  // plusieurs blocs d'un coup : on libère tout, on lit toutes les hauteurs en une seule mise en page, puis on fait glisser
  function glisserHauteurs(els, h0s) {
    for (const el of els) { const enCours = hauteurs.get(el); if (enCours) { enCours.stop(); hauteurs.delete(el); enCours.fin && enCours.fin(); } el.style.height = ''; el.style.overflow = ''; el.style.alignContent = ''; }
    const h1s = els.map((el) => el.getBoundingClientRect().height);
    els.forEach((el, i) => {
      const h0 = h0s[i], h1 = h1s[i]; if (RM || !h0 || !h1 || Math.abs(h1 - h0) < 0.5) return;
      // (une rangée de poste garde son libellé en haut et sa barre en bas pendant que sa hauteur glisse)
      el.style.overflow = 'clip'; el.style.alignContent = el.classList.contains('poste') ? 'space-between' : 'start'; el.style.height = `${h0.toFixed(3)}px`;
      const tw = glisser(MOTION.presse.approche.ms, (u) => { el.style.height = `${lerp(h0, h1, EASE.approche(u)).toFixed(3)}px`; }, () => { hauteurs.delete(el); el.style.height = ''; el.style.overflow = ''; el.style.alignContent = ''; });
      hauteurs.set(el, tw);
    });
  }
  // l'épaisseur change : la vue l'interpole (les chants épaississent), les messages se remettent à jour, rien n'est remonté
  function majEpaisseurVue() { if (stage) stage.setEpaisseur(state.ep); if (state.part) statut(messages()); }
  const qte = $('[data-qte]'), qerr = $('[data-qerr]');
  function lireQte() {
    const raw = qte.value.replace(/[\s  ]/g, '');
    state.qteTxt = raw;
    if (raw === '') return 'vide';
    if (!/^\d+$/.test(raw) || +raw < 1) return 'invalide';
    state.qte = +raw;
    return +raw > QMAX ? 'serie' : 'ok';
  }
  qte.addEventListener('input', () => calcul());
  root.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { qte.value = b.dataset.q; calcul(); }));
  root.querySelectorAll('input[name="ou-fin"]').forEach((r) => r.addEventListener('change', () => { state.finition = r.value; montrerRal(r.value === 'ral'); calcul(); peindre(); }));
  // le nuancier se replie et se déplie (la fiche glisse au lieu de perdre 200 px d'un coup) ; replié, il sort de la page (hidden)
  function montrerRal(oui) {
    const wrap = $('[data-ral-wrap]'), bloc = wrap.parentElement, h0 = bloc.offsetHeight;
    if (RM || !h0 || wrap.hidden === !oui) { wrap.hidden = !oui; return; }
    wrap.hidden = !oui;
    if (oui) { glisserHauteur(bloc, h0); return; }
    // pour le repli, le nuancier reste dessiné pendant que le bloc se referme sur lui
    const h1 = bloc.offsetHeight; wrap.hidden = false; glisserHauteur(bloc, h0, h1, () => { if (state.finition !== 'ral') wrap.hidden = true; });
  }
  const ralSel = $('[data-ral]'), stock = $('[data-stock]');
  ralSel.innerHTML = `<option value="">Choisir une autre teinte</option>` + RAL.filter((r) => !STOCK.includes(r.code)).map((r) => `<option value="${r.code}">RAL ${r.code} ${r.name}</option>`).join('');
  stock.innerHTML = STOCK.map((c) => { const r = ralOf(c); return `<button type="button" role="radio" style="--c:${r.value}" data-ral-code="${c}" aria-label="RAL ${c} ${r.name}" title="RAL ${c} ${r.name}"></button>`; }).join('');
  const pastilles = [...stock.querySelectorAll('button')];
  const majTeinte = () => { pastilles.forEach((b, i) => { const on = b.dataset.ralCode === state.ral; b.setAttribute('aria-checked', String(on)); b.tabIndex = on || (!STOCK.includes(state.ral) && i === 0) ? 0 : -1; }); ralSel.value = STOCK.includes(state.ral) ? '' : state.ral; };
  const choisirTeinte = (code, focus) => { state.ral = code; majTeinte(); if (focus) pastilles.find((b) => b.dataset.ralCode === code).focus(); calcul(); peindre(); };
  pastilles.forEach((b, i) => { b.addEventListener('click', () => choisirTeinte(b.dataset.ralCode)); b.addEventListener('keydown', (e) => { const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (k) { e.preventDefault(); choisirTeinte(pastilles[(i + k + pastilles.length) % pastilles.length].dataset.ralCode, true); } }); });
  ralSel.addEventListener('change', () => { if (ralSel.value) choisirTeinte(ralSel.value); });

  // ---------- Vue ----------
  const viewer = $('[data-viewer]'), canvas = $('[data-canvas]'), plan = $('[data-plan]');
  // le bouton du pliage : « Arrêter » pendant qu'il joue (la pièce saute à son état plié), « Rejouer » sinon
  const rbtn = $('[data-replay]'), ICON_REJOUER = rbtn.innerHTML, ICON_ARRET = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>';
  const etatPli = (on) => { if (on) rbtn.dataset.on = '1'; else delete rbtn.dataset.on; rbtn.innerHTML = on ? ICON_ARRET : ICON_REJOUER; rbtn.setAttribute('aria-label', on ? 'Arrêter le pliage' : 'Rejouer le pliage'); };
  rbtn.addEventListener('click', () => { if (stage && stage.playing) { stage.stop(); etatPli(false); } else { montrer('plie'); if (stage) { stage.play(); etatPli(stage.playing); } } });
  root.querySelectorAll('input[name="ou-vue"]').forEach((r) => r.addEventListener('change', () => montrer(r.value)));
  // la vue pliée et le plan coté occupent la même case de la fiche : pendant le passage de l'une à l'autre, ils se superposent
  canvas.style.gridArea = plan.style.gridArea = '2 / 1 / 3 / 2';
  plan.style.position = 'relative'; plan.style.zIndex = '1'; // le plan passe toujours au-dessus de la trame (elle s'efface dessous)
  // « Pliée » ↔ « À plat » : la pièce se déplie sous une caméra qui remonte à la verticale, jusqu'à se poser sur le tracé du
  // plan coté (même échelle, même place, au pixel) ; le plan arrive alors par-dessus (cotes, libellés de pli), puis la trame
  // s'efface. Au repos, une seule des deux vues existe pour les lecteurs d'écran (attribut hidden), comme avant.
  let vueNom = 'plie', vueTw = null;
  const poserVue = (u) => { // u : 0 = pliée, 1 = à plat (l'avancement que donne la scène, image par image)
    const cible = vueNom === 'plat' ? 1 : 0, repos = u === cible;
    canvas.style.transition = plan.style.transition = repos ? '' : 'none';
    if (repos) {
      plan.style.opacity = canvas.style.opacity = ''; plan.hidden = !cible; canvas.hidden = !!cible;
      // arrivé à plat pendant un pliage : la scène, cachée, n'a plus à jouer (le bouton redevient « Rejouer »)
      if (cible && stage && stage.playing) queueMicrotask(() => { if (stage && stage.playing && vueNom === 'plat') { stage.stop(); etatPli(false); } });
      return;
    }
    // en chemin : la pièce bouge d'abord (trame seule), puis le plan arrive par-dessus et la trame s'efface dessous
    plan.hidden = canvas.hidden = false;
    plan.style.opacity = String(lisse(0.7, 0.9, u)); canvas.style.opacity = String(1 - lisse(0.82, 1, u));
  };
  function montrer(v, direct = false) {
    root.querySelector(`input[name="ou-vue"][value="${v}"]`).checked = true;
    if (vueTw) { vueTw.stop(); vueTw = null; }
    const plat = v === 'plat'; vueNom = v;
    if (!stage) { poserVue(plat ? 1 : 0); if (plat) dessinerPlat(); return; }
    if (plat && plan.hidden) { plan.style.transition = 'none'; plan.style.opacity = '0'; plan.hidden = false; }
    if (plat) dessinerPlat();
    if (direct || RM) { stage.setVue(v, plat ? ciblePlan() : null, { direct: true }); poserVue(plat ? 1 : 0); if (!plat) stage.redraw(); return; }
    // les deux vues présentes le temps du passage ; la scène rend son avancement à chaque image (onFrame → poserVue)
    canvas.style.transition = plan.style.transition = 'none';
    if (canvas.hidden) { canvas.style.opacity = '0'; canvas.hidden = false; }
    if (plan.hidden) { plan.style.opacity = '0'; plan.hidden = false; }
    stage.setVue(v, plat ? ciblePlan() : null);
    if (stage.vue === (plat ? 1 : 0)) poserVue(stage.vue);
  }
  // la vue à plat : dessinée à l'échelle réelle de son cadre (deux passes), cotes et libellés de pli à 15 px au moins
  let platInfo = null;
  const FORCES = matchMedia('(forced-colors: active)'); FORCES.addEventListener('change', () => dessinerPlat());
  function dessinerPlat() {
    if (plan.hidden || !state.part) return;
    const p = state.part, an = analyse(p), rot = an.h > an.w * 1.15;
    const cs = getComputedStyle(plan), bw = plan.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), bh = plan.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (bw <= 0 || bh <= 0) return;
    const M = Math.max(an.w, an.h);
    // en couleurs forcées, le fond de la fiche devient celui du système : le plan se trace dans sa couleur de texte
    const make = (fs) => flatSVG(p, { ink: FORCES.matches ? 'CanvasText' : ILLU['texte-brut'], font: "'Mona Sans', sans-serif", fs, thin: 1, thick: 2, px: true, axe: '14 3 2 3', pad: Math.max(26, fs * 2.6) });
    const scale = (f) => (rot ? Math.min(bw / f.h, bh / f.w) : Math.min(bw / f.w, bh / f.h));
    let f = make(Math.max(8, M / 24));
    for (let k = 0; k < 3; k++) f = make(15.4 / 0.86 / scale(f));
    plan.innerHTML = rot
      ? `<svg viewBox="0 0 ${f.h} ${f.w}" role="img" aria-label="Développé coté, ${fmtN(an.w, 0)} par ${fmtN(an.h, 0)} mm"><g transform="translate(${f.h},0) rotate(90)">${f.svg}</g></svg>`
      : `<svg viewBox="0 0 ${f.w} ${f.h}" role="img" aria-label="Développé coté, ${fmtN(an.w, 0)} par ${fmtN(an.h, 0)} mm">${f.svg}</svg>`;
    platInfo = { f, rot, sc: scale(f), bw, bh, pl: parseFloat(cs.paddingLeft), pt: parseFloat(cs.paddingTop), an };
  }
  // où le plan pose le développé, dans le repère de la vue pliée : l'échelle (px par mm) et le centre du développé
  function ciblePlan() {
    if (!platInfo) return null;
    const { f, rot, sc, bw, bh, pl, pt, an } = platInfo;
    const X = an.w / 2 + f.pad, Y = an.h / 2 + f.pad;                     // le centre du développé dans le dessin (mm, y vers le bas)
    const [vx, vy, vw, vh] = rot ? [f.h - Y, X, f.h, f.w] : [X, Y, f.w, f.h]; // après la rotation d'un quart de tour des pièces hautes
    const rp = plan.getBoundingClientRect(), rc = canvas.getBoundingClientRect();
    return { echelle: sc, rot, cx: rp.left - rc.left + pl + (bw - vw * sc) / 2 + vx * sc, cy: rp.top - rc.top + pt + (bh - vh * sc) / 2 + vy * sc };
  }
  new ResizeObserver(() => { dessinerPlat(); if (vueNom === 'plat' && stage && !plan.hidden) stage.setVue('plat', ciblePlan(), { direct: stage.vue === 1 }); }).observe(plan);
  function couleurs() {
    if (state.finition === 'ral') { const r = ralOf(state.ral); return { tint: r.value, on: r.onText, piece: r.value, nom: `RAL ${r.code} ${r.name}` }; }
    return { tint: ILLU['fond-brut'], on: ILLU['texte-brut'], piece: BRUT[state.matiere], nom: `${MATIERES[state.matiere].nom.toLowerCase()} brut` };
  }
  function peindre() {
    const c = couleurs();
    viewer.style.setProperty('--tint', c.tint); viewer.style.setProperty('--on', c.on);
    $('[data-teinte]').textContent = c.nom;
    if (stage) stage.setTeinte(state.finition === 'ral' ? ralOf(state.ral).value : null);
  }

  function choisir(i) {
    state.idx = i; state.src = 'exemple'; state.fileName = ''; state.file = null;
    const c = CATALOGUE[i]; state.part = c.fn();
    state.matiere = matOf(state.part.matiere); state.ep = state.part.t; state.ral = c.ral;
    root.querySelector(`input[name="ou-mat"][value="${state.matiere}"]`).checked = true;
    majTeinte();
    $('[data-exemples]').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
    majEpaisseurs();
    afficherPiece();
  }

  // Lecture du plan et points d'attention (ils dépendent de la pièce et de l'épaisseur)
  function messages() {
    const p = state.part, an = analyse(p);
    const msgs = [['ok', `${state.src === 'dxf' ? 'Nous avons lu votre plan. ' : ''}La pièce mesure ${fmtN(an.w, 0)}${NB}×${NB}${fmtN(an.h, 0)}${NB}mm à plat, ${an.plis || an.ourlets ? `avec ${[an.plis && `${an.plis} pli${an.plis > 1 ? 's' : ''}`, an.ourlets && `${an.ourlets} ourlet${an.ourlets > 1 ? 's' : ''}`].filter(Boolean).join(' et ')}` : 'sans pli'}.`]];
    const petits = (p.holes || []).filter((h) => h.meta && h.meta.type === 'circle' && h.meta.d < state.ep);
    if (petits.length) msgs.push(['warn', `${petits.length} trou${petits.length > 1 ? 's sont' : ' est'} plus petit${petits.length > 1 ? 's' : ''} que l\u2019épaisseur de la tôle. Nous ${petits.length > 1 ? 'les' : 'le'} percerons au foret.`]);
    if (p.source && p.source.plisIgnores) msgs.push(['warn', `${p.source.plisIgnores} ligne${p.source.plisIgnores > 1 ? 's' : ''} de pli ne traverse${p.source.plisIgnores > 1 ? 'nt' : ''} pas la pièce. Nous ${p.source.plisIgnores > 1 ? 'les' : 'la'} vérifierons.`]);
    if (state.src === 'dxf' && !an.plis && !an.ourlets) msgs.push(['warn', 'Nous ne trouvons aucune ligne de pli. Mettez les lignes de pli sur un calque nommé PLI (PLI_120 pour un angle de 120°), ou indiquez-nous les angles.']);
    return msgs;
  }

  function afficherPiece(replay = true) {
    const p = state.part; p.t = state.ep;
    viewer.removeAttribute('data-stale');
    // la gamme de la pièce si elle en a une (profils : de l'extérieur vers l'intérieur) ; sinon l'ourlet d'abord, comme en atelier
    const order = p.gamme || p.bends.map((b, k) => k).sort((a, b) => Math.abs(p.bends[b].angle) - Math.abs(p.bends[a].angle));
    // la nouvelle pièce arrive en vue pliée. Si le plan de l'ancienne était affiché, il s'efface pendant qu'elle apparaît ;
    // sinon l'image en cours s'efface au-dessus d'elle (fondu enchaîné de la scène).
    const depuisPlat = vueNom === 'plat' && !plan.hidden && !!stage;
    if (vueTw) { vueTw.stop(); vueTw = null; }
    if (stage) { if (depuisPlat) { stage.destroy(); canvas.replaceChildren(); } else stage.sortie(); }
    // la pièce se plie quand on la regarde : à la première arrivée sur l'outil, puis à chaque nouvelle pièce
    etatPli(false);
    vueNom = 'plie'; root.querySelector('input[name="ou-vue"][value="plie"]').checked = true;
    if (depuisPlat && !RM) {
      canvas.style.transition = plan.style.transition = 'none'; canvas.style.opacity = '0'; canvas.hidden = false;
      vueTw = glisser(MOTION.presse.approche.ms, (u) => { canvas.style.opacity = String(u); plan.style.opacity = String(1 - u); }, () => { vueTw = null; poserVue(0); });
    } else poserVue(0);
    stage = mountDeveloppe(canvas, p, { order, couleurs: PAPIER, teinte: state.finition === 'ral' ? ralOf(state.ral).value : null, oriente: true, cotes: false, pad: 0.08, autoplay: replay && seen,
      onFrame: ({ phase, plat }) => { if (phase === 'fin' && rbtn.dataset.on) etatPli(false); if (!vueTw) poserVue(plat); } });
    if (stage.playing) etatPli(true);
    else if (!(replay && !seen)) stage.seek(stage.T.end);
    $('[data-nom]').textContent = state.src === 'dxf' ? state.fileName : `${p.name}, réf. ${p.ref}`;
    peindre();
    const msgs = messages();
    statut(msgs);
    calcul(state.src === 'dxf' ? msgs[0][1] : null);
    onPart && onPart(p);
  }
  // la première fois, la pièce se plie quand l'acheteur s'arrête sur l'outil : il la voit, et le défilement reste fluide
  const auRepos = (fn) => { let tm = 0; const go = () => { clearTimeout(tm); tm = setTimeout(() => { removeEventListener('scroll', go); fn(); }, MOTION.presse.maintien.ms); }; addEventListener('scroll', go, { passive: true }); go(); };
  onceVisible(viewer, () => auRepos(() => { seen = true; if (stage && !stage.playing) { stage.play(); etatPli(stage.playing); } }), { threshold: 0.4 });

  function statut(list) {
    const h0 = $('[data-statut]').offsetHeight;
    $('[data-statut]').innerHTML = list.map(([k]) => `<p class="ou-status ${k}">${ICON[k]}<span></span></p>`).join('');
    $('[data-statut]').querySelectorAll('span').forEach((s, i) => { s.textContent = list[i][1]; });
    glisserHauteur($('[data-statut]'), h0);
  }

  // ---------- La carte du prix : un état à la fois ----------
  // Trois familles d'état :
  // - « prix » : le prix, sa date, sa courbe, ses postes ;
  // - « attente » : la quantité est vide ou fausse, ou un plan est en lecture. Le prix d'avant n'est plus valable, mais il va
  //   revenir : l'en-tête laisse la place au message, le reste de la carte reste à sa place, voilé et inerte. Rien ne se replie
  //   pendant qu'on corrige une frappe (la carte ne passe plus de 1 600 px à 110, puis l'inverse) ; au retour, les montants
  //   glissent depuis ce qui est resté à l'écran ;
  // - « message » : l'atelier chiffrera lui-même (PDF, croquis, plus de 5 000 pièces) ou le fichier est illisible : il n'y a
  //   plus de prix. Tout s'efface, la carte glisse à sa nouvelle hauteur, le message arrive en fondu.
  const carte = root.querySelector('.quote'), tete = $('[data-tete]'), etatEl = $('[data-etat]'), prixEl = $('[data-prix]'), corps = $('[data-corps]'), postesWrap = $('[data-postes-wrap]'), courbeWrap = $('[data-courbe-wrap]'), agirEl = carte.querySelector('.agir');
  const suiteCarte = [corps, agirEl, courbeWrap, postesWrap]; // ce qui suit l'en-tête
  let pret = false, fam = 'prix'; // pret : après le premier calcul, la carte passe d'un état à l'autre en mouvement
  // ce qui arrive monte en fondu, jusqu'à l'opacité pleine, ou jusqu'au voile si la carte est en attente
  const apparaitre = (els) => glisser(MOTION.micro.ms, (u) => { for (const el of els) { const o = u * (suiteCarte.includes(el) ? voile : 1); el.style.opacity = o >= 1 ? '' : o.toFixed(3); } });
  const familleDe = (k) => (k === 'prix' ? 'prix' : k === 'vide' || k === 'chargement' || (k === 'erreur' && state.qInvalide) ? 'attente' : 'message');
  // le voile de l'attente : la suite de la carte passe à VOILE d'opacité (et revient), sans changer de place
  let voile = 1, voileTw = null;
  function voiler(vers) {
    if (voileTw) { voileTw.stop(); voileTw = null; }
    const poser = (v) => { voile = v; for (const el of suiteCarte) el.style.opacity = v >= 1 ? '' : v.toFixed(3); };
    const de = voile; if (RM || !pret || de === vers) { poser(vers); return; }
    voileTw = glisser(MOTION.micro.ms, (u) => poser(lerp(de, vers, u)), () => { voileTw = null; });
  }
  let bascule = null;
  function finirBascule() { if (!bascule) return; const b = bascule; bascule = null; b.tw.stop(); for (const el of b.els) el.style.opacity = ''; b.faire(); }
  // la carte entière : un long trajet (jusqu'à 1 500 px), départ et arrêt doux comme un changement de pièce sur le convoyeur
  function glisserLent(el, h0) {
    const enCours = hauteurs.get(el); if (enCours) { enCours.stop(); hauteurs.delete(el); }
    el.style.height = ''; el.style.overflow = '';
    const h1 = el.getBoundingClientRect().height; if (RM || Math.abs(h1 - h0) < 0.5) return;
    el.style.overflow = 'clip'; el.style.height = `${h0}px`;
    const tw = glisser(MOTION.presse.retour.ms, (u) => { el.style.height = `${lerp(h0, h1, EASE.convoyeur(u)).toFixed(3)}px`; }, () => { hauteurs.delete(el); el.style.height = ''; el.style.overflow = ''; });
    hauteurs.set(el, tw);
  }
  // ce qui est affiché dans « els » s'efface (SORTIE_MS), puis faire() pose le nouvel état, « bloc » glisse à sa nouvelle hauteur
  // et ce qui vient d'arriver monte en fondu. Un calcul qui survient pendant l'effacement applique d'abord ce qui attendait.
  function basculer(faire, bloc, lister, lent = false) {
    finirBascule();
    if (!pret || RM) { faire(); return; }
    const els = lister(), h0 = bloc.getBoundingClientRect().height, b = { els, faire, tw: null };
    bascule = b;
    b.tw = glisser(SORTIE_MS, (u) => { for (const el of els) el.style.opacity = (1 - u).toFixed(3); }, () => {
      if (bascule !== b) return; bascule = null;
      for (const el of els) el.style.opacity = '';
      faire(); (lent ? glisserLent : glisserHauteur)(bloc, h0); apparaitre(lister());
    });
  }
  function etat(kind, txt, suite = null) {
    finirBascule(); // un changement d'état encore en attente d'effacement s'applique d'abord (frappe rapide)
    const avant = fam, f = familleDe(kind), ok = kind === 'prix';
    state.etat = kind; fam = f;
    if (!ok) { if (kind !== 'chargement') dire(txt); onPrix && onPrix(null); }
    const faire = () => {
      prixEl.hidden = !ok; etatEl.hidden = ok;
      for (const el of suiteCarte.filter((x) => x !== agirEl)) el.hidden = f === 'message';
      for (const el of suiteCarte) { el.inert = f === 'attente'; if (f === 'attente') el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden'); }
      carte.setAttribute('data-mode', kind); carte.setAttribute('data-famille', f);
      if (!ok) {
        const ic = { vide: 'info', chargement: 'load', erreur: 'err', humain: 'info' }[kind];
        etatEl.innerHTML = `${ICON[ic]}<p></p>`; etatEl.querySelector('p').textContent = txt;
        etatEl.className = `etat etat--${kind}`;
      }
      // en attente, le bouton reste à sa place sous le voile (inerte) ; sinon il propose le devis, ou le rappel quand l'atelier chiffre lui-même
      if (f !== 'attente') { $('[data-ouvrir]').textContent = ok ? 'Recevoir le devis' : 'Être rappelé avec le prix'; $('[data-ouvrir]').hidden = !$('[data-form]').hidden; }
      suite && suite();
    };
    if (f === avant) { finirBascule(); faire(); return; }
    if (f === 'message' || avant === 'message') {
      // tout change : la carte entière s'efface et glisse ; le voile éventuel tombe sous le fondu
      basculer(() => { if (voileTw) { voileTw.stop(); voileTw = null; } voile = f === 'attente' ? VOILE : 1; for (const el of suiteCarte) el.style.opacity = voile >= 1 ? '' : String(voile); faire(); }, carte, () => [tete, ...suiteCarte].filter((el) => !el.hidden), true);
      return;
    }
    // prix ↔ attente : seul l'en-tête change de contenu (et de hauteur) ; la suite se voile ou se dévoile sur place
    voiler(f === 'attente' ? VOILE : 1);
    basculer(faire, tete.firstElementChild, () => [prixEl, etatEl].filter((el) => !el.hidden));
  }

  function calcul(prefixe = null) {
    const q = lireQte();
    state.qInvalide = q === 'invalide';
    qte.setAttribute('aria-invalid', String(q === 'invalide'));
    qerr.hidden = q !== 'invalide';
    if (q === 'invalide') { etat('erreur', `Le prix s’affichera avec une quantité entre 1 et 5${NB}000.`); return; }
    if (q === 'vide') { etat('vide', 'Indiquez une quantité pour voir le prix.'); return; }
    if (state.src === 'humain') { etat('humain', `Laissez votre téléphone ou votre e-mail${NB}: nous vous donnons le prix dans la journée.`); return; }
    if (q === 'serie') { etat('humain', `Au-delà de 5${NB}000 pièces, nous calculons le prix de la série nous-mêmes. Laissez votre téléphone ou votre e-mail${NB}: nous répondons dans la journée.`); return; }
    if (!state.part) { etat('vide', 'Déposez un plan ou prenez une de nos pièces.'); return; }
    const an = analyse(state.part);
    const opts = { matiere: state.matiere, ep: state.ep, finition: state.finition, ral: state.ral };
    const c = chiffrer(an, { ...opts, qte: state.qte });
    const avant = fam, C = viser(an, opts, c);
    // depuis un message, le prix se pose d'un coup sous le fondu d'arrivée ; depuis un prix ou une attente, il glisse
    etat('prix', null, () => versCible(C, avant === 'message'));
    pret = true;
    dire(`${prefixe ? prefixe + ' ' : ''}Prix indicatif${NB}: ${eur(C.ht)} HT la pièce, pour ${fmtN(c.qte, 0)} pièce${c.qte > 1 ? 's' : ''}.`);
    onPrix && onPrix({ unit: C.ht, qte: c.qte, total: C.tot, pu: eur(C.ht) });
  }

  // ---------- Itération 8 : un seul état affiché, qui rejoint l'état visé ----------
  // Le prix, la fourchette, la part de chaque poste, la frise des jours et la courbe se lisent dans un même état chiffré (S).
  // Quand une option change, l'état affiché (vu) glisse vers l'état visé (cible) sur l'horloge commune, dans la durée du geste
  // « retour » de la presse et sur sa courbe d'approche : les montants comptent, les parts et les jours glissent sur leur
  // filet, la courbe se déforme, son repère la suit, l'axe se remet à l'échelle. Un passage interrompu repart de ce qui est
  // à l'écran. Les phrases, elles, ne comptent pas (un chiffre qui compte dans une phrase ferait trembler ses retours à la
  // ligne) : elles s'effacent, changent au creux du fondu, puis reviennent, et leur bloc glisse à sa nouvelle hauteur.
  const r2 = (v) => Math.round(v * 100) / 100, clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ecrire = (el, txt) => { if (el._t !== txt) { el.textContent = txt; el._t = txt; return true; } return false; };
  // un attribut ou un style qui ne change pas n'est pas réécrit (une image d'un passage ne touche que ce qui bouge)
  const attr = (el, nom, v) => { const k = '_a' + nom; if (el[k] !== v) { el.setAttribute(nom, v); el[k] = v; } };
  const style = (el, nom, v) => { const k = '_s' + nom; if (el[k] !== v) { el.style[nom] = v; el[k] = v; } };
  // le format des montants qui comptent à chaque image : le même que eur(), sans recréer un formateur à chaque appel
  const NF2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const eurVite = (v) => NF2.format(v).replace(/\u202f/g, NB) + NB + '€';
  const eurC = [0.04, 9.995, 161.67, 1051.07, 208638.28].every((v) => eurVite(v) === eur(v)) ? eurVite : eur;
  const pieces = (n) => `${fmtN(n, 0)} pièce${n > 1 ? 's' : ''}`;
  const jours = (n) => `${fmtN(n, 0)}${NB}jour${n > 1 ? 's' : ''}`;
  const pct = (k) => { const p = k * 100; return `${p >= 0.95 ? Math.round(p) : p >= 0.05 ? fmtN(p, 1) : 0}${NB}%`; };
  const LQ = QTES.map((v) => Math.log10(v));
  const XS = Array.from({ length: NS }, (_, k) => (3 * k) / (NS - 1)); // les abscisses de la courbe, en log10 de la quantité
  // le prix lu sur la courbe à une abscisse (entre deux échantillons, la ligne est droite à l'écran)
  const surCourbe = (ys, lq) => { const f = clamp(lq / 3) * (NS - 1), i = Math.min(NS - 2, Math.floor(f)); return lerp(ys[i], ys[i + 1], f - i); };
  // un pas rond pour les graduations de prix : quatre ou cinq filets, jamais quinze
  const pasDe = (ymax) => { const brut = ymax / 4.4, p = 10 ** Math.floor(Math.log10(brut)), m = brut / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
  // les graduations d'un état au repos : valeur → [opacité du filet, opacité du chiffre] (sur un cadre étroit, un chiffre sur deux)
  const gradDe = (ymax, W) => { const g = new Map(), every = W < 300 ? 2 : 1; let n = 0; for (let v = 0, st = pasDe(ymax); v <= ymax; v += st, n++) g.set(r2(v), [1, n % every ? 0 : 1]); return g; };
  // les jours ouvrés de chaque poste : ceux de la fiche de capacités ; le moteur de prix ne rend que les deux bornes du délai.
  // La grande série et les imprévus se déduisent des bornes ; si le compte ne tombe pas juste, pas de frise plutôt qu'une frise fausse.
  function joursDe(an, opts, c) {
    const j = { decoupe: DELAIS.decoupe, pliage: an.coups ? DELAIS.pliage : 0, soudure: an.soudure ? DELAIS.soudure : 0,
      peinture: opts.finition === 'ral' ? DELAIS.peinture + (STOCK.includes(String(opts.ral)) ? 0 : DELAIS.horsStock) : 0 };
    j.serie = c.delai[0] - (j.decoupe + j.pliage + j.soudure + j.peinture); j.imprevus = c.delai[1] - c.delai[0];
    return j.serie >= 0 && j.imprevus >= 0 ? j : null;
  }

  // l'état visé : tout ce que la carte montre, en nombres
  function viser(an, opts, c) {
    const pal = QTES.map((q) => (q === c.qte ? c : chiffrer(an, { ...opts, qte: q })));
    const units = pal.map((p) => p.unit), ht = r2(c.unit), tot = r2(ht * c.qte);
    // la courbe : le prix à la pièce est un coût fixe plus un coût de lot partagé (a + b / q) ; entre deux quantités chiffrées,
    // elle s'interpole donc en 1 / q, et passe par la quantité choisie elle-même
    const noeuds = QTES.map((q, i) => [q, units[i]]);
    if (c.qte < 1000 && !QTES.includes(c.qte)) { noeuds.push([c.qte, c.unit]); noeuds.sort((a, b) => a[0] - b[0]); }
    const ys = XS.map((x) => { const q = 10 ** x; let i = 0; while (i < noeuds.length - 2 && q > noeuds[i + 1][0]) i++; const [a, ua] = noeuds[i], [b, ub] = noeuds[i + 1]; return ua + (ub - ua) * ((1 / q - 1 / a) / (1 / b - 1 / a)); });
    const lq = Math.log10(clamp(c.qte, 1, 1000)), ymax = Math.max(...units, c.unit) * 1.08;
    // les postes, dans l'ordre de la gamme ; un poste absent garde sa place avec une part nulle (il peut ainsi entrer et sortir en glissant)
    const postes = new Map(); let cum = 0;
    for (const id of ORDRE) { const l = c.lignes.find((x) => x.id === id), k = l ? l.unit / c.unit : 0; postes.set(id, { x: cum, k, unit: l ? l.unit : 0, total: l ? l.total : 0, pres: l ? 1 : 0, libelle: l ? l.libelle : '', detail: l ? l.detail : '' }); cum += k; }
    const jd = joursDe(an, opts, c), frise = new Map(); let jc = 0;
    for (const [id] of JOURS) { const j = jd ? jd[id] : 0; frise.set(id, { x: jc, j, pres: j > 0 ? 1 : 0 }); jc += j; }
    const iSuiv = QTES.findIndex((v) => v > c.qte), gain = iSuiv < 0 ? 0 : r2(ht - r2(units[iSuiv])), grad = gradDe(ymax, cbW || largeurCourbe());
    return { an, opts, c, q: c.qte, ht, tot, pu: c.unit, n: eur(ht).length, tolMin: r2(c.fourchette[0]), tolMax: r2(c.fourchette[1]), ml: c.parMetre ? r2(c.parMetre) : 0,
      noeuds, units, ys, lq, ymax, ecart: c.unit - surCourbe(ys, lq), grad, gy: new Map([...grad.keys()].map((v) => { const y = CM.t + (1 - v / ymax) * (CH - CM.b - CM.t); return [v, Math.round(y - 0.5) + 0.5 - y]; })),
      postes, frise, jt: jc, friseOk: !!jd, iSuiv, suivO: iSuiv >= 0 && gain >= 0.01 ? 1 : 0, gain,
      textes: {
        qlabel: `Prix indicatif, ${pieces(c.qte)}`,
        ml: c.parMetre ? `${eur(c.parMetre)} HT le mètre linéaire, pour une longueur de ${fmtN(an.ml, 2)}${NB}m` : '',
        fourchette: `Le total pour ${pieces(c.qte)} est de ${eur(tot)} HT, soit ${eur(tot * 1.2)} TTC. Le devis peut s’écarter de ce prix de 10${NB}% au plus.`,
        date: `${c.qte > 1 ? 'Vos pièces peuvent être prêtes' : 'Votre pièce peut être prête'} le ${fmtDate(dateDispo(c.delai[1], new Date()))}.`,
        gain: iSuiv >= 0 && gain >= 0.01 ? `À ${pieces(QTES[iSuiv])}, chacune coûte ${eur(gain)} de moins.` : `Au-delà de 1${NB}000 pièces, le prix à la pièce ne baisse presque plus.`,
        etiq: `${pieces(c.qte)}${NB}: `,
      } };
  }
  // l'état entre deux états (e : 0 = A, 1 = B) ; ce qui ne se compte pas (textes, structure) est celui de B
  function melange(A, B, e) {
    const S = { ...B };
    for (const k of ['ht', 'tot', 'pu', 'n', 'tolMin', 'tolMax', 'lq', 'ymax', 'ecart', 'jt']) S[k] = lerp(A[k], B[k], e);
    S.ys = B.ys.map((v, i) => lerp(A.ys[i], v, e)); S.units = B.units.map((v, i) => lerp(A.units[i], v, e));
    S.grad = new Map(); S.gy = new Map();
    for (const v of new Set([...A.grad.keys(), ...B.grad.keys()])) { const x = A.grad.get(v) || [0, 0], y = B.grad.get(v) || [0, 0]; S.grad.set(v, [lerp(x[0], y[0], e), lerp(x[1], y[1], e)]); S.gy.set(v, lerp(A.gy.get(v) || 0, B.gy.get(v) || 0, e)); }
    S.postes = new Map(); for (const [id, b] of B.postes) { const a = A.postes.get(id); S.postes.set(id, { ...b, x: lerp(a.x, b.x, e), k: lerp(a.k, b.k, e), unit: lerp(a.unit, b.unit, e), total: lerp(a.total, b.total, e), pres: lerp(a.pres, b.pres, e) }); }
    S.frise = new Map(); for (const [id, b] of B.frise) { const a = A.frise.get(id); S.frise.set(id, { x: lerp(a.x, b.x, e), j: lerp(a.j, b.j, e), pres: lerp(a.pres, b.pres, e) }); }
    // le palier suivant change de point : l'anneau s'efface sur l'ancien, reparaît sur le nouveau
    if (A.iSuiv !== B.iSuiv) { S.iSuiv = e < 0.5 ? A.iSuiv : B.iSuiv; S.suivO = (e < 0.5 ? A.suivO : B.suivO) * Math.abs(1 - 2 * e); } else S.suivO = lerp(A.suivO, B.suivO, e);
    return S;
  }

  // ----- les rangées : une par poste (gamme du prix) et une par poste (frise des jours), gardées d'un état à l'autre -----
  const gamme = $('[data-postes]'), friseEl = $('[data-frise]'), tolEl = $('[data-tol]');
  const rangs = new Map(), jrs = new Map();
  gamme.innerHTML = `<div class="poste poste--tot" role="listitem"><span class="lib">Total hors taxes</span><span class="part" aria-hidden="true"></span><span class="val num" data-tot></span><span class="piste" aria-hidden="true"></span></div>`;
  const totEl = gamme.firstElementChild, totPiste = totEl.querySelector('.piste');
  friseEl.innerHTML = `<div class="fr-grille" aria-hidden="true"></div><div class="jr jr--tot" role="listitem"><span class="lib">Total</span><span class="val" data-jt></span></div>`;
  const grille = friseEl.firstElementChild, jtEl = friseEl.lastElementChild;
  let grilleW = 0, gammeW = 0, nLignes = 0;
  function rangee(id) {
    let r = rangs.get(id); if (r) return r;
    const el = document.createElement('div'); el.className = 'poste'; el.setAttribute('role', 'listitem'); el.dataset.id = id;
    el.innerHTML = '<span class="lib"></span><span class="part num"></span><span class="val num"></span><span class="piste" aria-hidden="true"></span>';
    const apres = ORDRE.slice(ORDRE.indexOf(id) + 1).map((x) => rangs.get(x)).find(Boolean);
    gamme.insertBefore(el, apres ? apres.el : totEl);
    r = { el, lib: el.children[0], part: el.children[1], val: el.children[2], barre: el.querySelector('.piste'), h: 0, vu: -1 }; r.barre._filet = true;
    rangs.set(id, r); return r;
  }
  function rangeeJ(id, nom) {
    let r = jrs.get(id); if (r) return r;
    const el = document.createElement('div'); el.className = 'jr'; el.setAttribute('role', 'listitem'); el.dataset.id = id;
    el.innerHTML = '<span class="lib"></span><span class="piste" aria-hidden="true"></span><span class="val"></span>';
    el.firstElementChild.textContent = nom;
    const ids = JOURS.map((x) => x[0]), apres = ids.slice(ids.indexOf(id) + 1).map((x) => jrs.get(x)).find(Boolean);
    friseEl.insertBefore(el, apres ? apres.el : jtEl);
    r = { el, val: el.lastElementChild, barre: el.querySelector('.piste'), h: 0, vu: -1 }; r.barre._hach = id === 'imprevus';
    jrs.set(id, r); return r;
  }
  // une rangée entre ou sort : sa hauteur et son opacité suivent sa présence (0 à 1) ; présente, elle est libre ; absente, elle sort de la page
  function presence(r, p) {
    if (r.vu === p) return; r.vu = p;
    if (p <= 0) { r.el.hidden = true; r.el.style.height = r.el.style.opacity = ''; return; }
    r.el.hidden = false;
    if (p >= 1) { r.el.style.height = r.el.style.opacity = ''; return; }
    r.el.style.height = `${(p * r.h).toFixed(3)}px`; r.el.style.opacity = p.toFixed(3);
  }
  // une barre est un fond de sa piste, posé et dimensionné en pixels : elle se repeint sans mise en page, sans transformation, sans couche
  // (les jours d'imprévus : une hachure entre quatre filets, cinq fonds posés de la même façon)
  const px = (v) => `${v.toFixed(2)}px`;
  function barre(el, x, k, W) {
    const kk = k > 0 ? Math.max(k, MINCE) : 0, w = kk * W, xx = Math.min(x, 1 - kk) * W;
    if (el._filet) { style(el, 'backgroundSize', `${px(w)} 100%, 100% 1px`); style(el, 'backgroundPosition', `${px(xx)} 0, 0 100%`); return; }
    if (!el._hach) { style(el, 'backgroundSize', `${px(w)} 100%`); style(el, 'backgroundPosition', `${px(xx)} 0`); return; }
    const f = w >= 1 ? '1px' : '0';
    style(el, 'backgroundSize', `${px(w)} ${f}, ${px(w)} ${f}, ${f} 100%, ${f} 100%, ${px(w)} 100%`);
    style(el, 'backgroundPosition', `${px(xx)} 0, ${px(xx)} 100%, ${px(xx)} 0, ${px(xx + Math.max(0, w - 1))} 0, ${px(xx)} 0`);
  }
  let friseW = 0;
  { const ro = new ResizeObserver(() => { const w = gamme.clientWidth; if (!w || w === friseW) return; friseW = w; for (const r of [...rangs.values(), ...jrs.values()]) r.h = 0; grilleW = grille.clientWidth; gammeW = w; if (vu && !carteTw) rendreRangs(vu); }); ro.observe(gamme); ro.observe(friseEl); }

  // ----- les montants qui comptent : chaque élément garde la valeur qu'il affiche et rejoint la suivante -----
  // Trois écritures. En colonnes (postes, tableaux, frise), les chiffres sont tabulaires : le montant compte sur place, rien
  // ne bouge autour. Les bornes de la fourchette comptent de même, dans une largeur qui glisse (« compte »). Le grand prix,
  // en chiffres proportionnels, est « en cases » : ses signes roulent (voir plus bas).
  const compteurs = new Map();
  function compter(el, a, fmt, anim, enCases = false) {
    const c = compteurs.get(el), de = c && anim ? c.v : a;
    compteurs.set(el, { de, a, fmt, v: de, enCases });
    if (enCases === 'compte') viserCompte(el, fmt(de), fmt(a), de === a);
    else if (enCases) viserCases(el, fmt(a), anim && c ? Math.sign(a - c.a) || 1 : 0); else ecrire(el, fmt(de));
  }
  // Le grand prix est en chiffres proportionnels (un « 1 » y est deux fois plus étroit qu'un « 0 ») : compté tel quel, son « € »
  // danserait à chaque image. Chaque signe a donc sa case. Quand le montant change, les signes qui changent roulent comme les
  // molettes d'un compteur de coups de presse (le nouveau signe arrive par le bas si le prix monte, par le haut s'il baisse,
  // l'ancien sort de l'autre côté), et la largeur de chaque case glisse de celle de l'ancien signe à celle du nouveau : le
  // « € » glisse, il ne saute pas ; les signes qui ne changent pas ne bougent pas. Au repos, chaque case a la largeur exacte
  // de son signe devant son voisin (avance, approche et crénage de la paire, mesurés une fois) : le montant est composé comme
  // du texte courant, au dixième de pixel. Les cases sont alignées à droite : un chiffre de plus arrive par la gauche.
  // Un nouveau montant qui arrive en plein roulement repart de ce qui est à l'écran (chaque signe continue d'où il est).
  // Pour les lecteurs d'écran, le montant est une image de texte qui porte la valeur finale.
  const cz = new Map();
  const SIGNES = [...'0123456789,', NB, '€'];
  function mesurerSignes(el, k) {
    // 13 signes et leurs 169 paires, posés dans une sonde cachée : une mise en page pour tous (au lieu de deux par paire au fil des clics)
    if (!k.sonde) { k.sonde = document.createElement('span'); k.sonde.className = `cz-sonde ${el.className}`; k.sonde.setAttribute('aria-hidden', 'true'); el.parentNode.append(k.sonde); }
    const textes = [...SIGNES, ...SIGNES.flatMap((a) => SIGNES.map((b) => a + b))];
    k.sonde.innerHTML = textes.map(() => '<i></i>').join(''); [...k.sonde.children].forEach((i, n) => { i.textContent = textes[n]; });
    const fs = parseFloat(getComputedStyle(k.sonde).fontSize), w = [...k.sonde.children].map((i) => i.getBoundingClientRect().width / fs);
    k.sonde.textContent = '';
    SIGNES.forEach((a, i) => { k.em.set(a, w[i]); SIGNES.forEach((b, j) => k.em.set(a + b, w[SIGNES.length * (i + 1) + j] - w[j])); });
  }
  const etatCases = (el) => { let k = cz.get(el); if (!k) { el.textContent = ''; el.setAttribute('role', 'img'); k = { em: new Map(), cases: [], txt: null, sonde: null, roule: false }; cz.set(el, k); mesurerSignes(el, k); } return k; };
  function largeurSigne(el, k, ch, suiv = '') {
    let w = k.em.get(ch + suiv);
    if (w === undefined) {
      const mes = (t) => { k.sonde.textContent = t; return k.sonde.getBoundingClientRect().width; }; // un signe imprévu : mesuré à la demande
      w = (mes(ch + suiv) - (suiv ? mes(suiv) : 0)) / parseFloat(getComputedStyle(k.sonde).fontSize); k.sonde.textContent = ''; k.em.set(ch + suiv, w);
    }
    return w;
  }
  // pose le montant visé (sens : +1 le prix monte, -1 il baisse, 0 d'un coup)
  function viserCases(el, txt, sens) {
    const k = etatCases(el), avant = k.txt ?? txt, n = Math.max(avant.length, txt.length);
    while (k.cases.length < n) {
      const sp = document.createElement('span'); sp.className = 'cz'; sp.setAttribute('aria-hidden', 'true'); sp.innerHTML = '<span class="cz-a"></span><span class="cz-b"></span>';
      el.prepend(sp); k.cases.push({ el: sp, a: sp.firstChild, b: sp.lastChild, ch: '', y: 0, o: 1, yb: 0, ob: 0, ya0: 0, oa0: 1, yb0: 0, ob0: 0, bOn: false, sens: 1, wDe: 0, wA: 0 });
    }
    k.cases.forEach((c, j) => { // j : rang depuis la droite
      const cd = avant[avant.length - 1 - j] || '', ca = txt[txt.length - 1 - j] || '';
      c.wDe = c.wVu ?? (cd ? largeurSigne(el, k, cd, avant[avant.length - j]) : 0); c.wA = ca ? largeurSigne(el, k, ca, txt[txt.length - j]) : 0;
      if (!sens) { c.ya0 = 0; c.oa0 = 1; c.wDe = c.wA; c.bOn = false; ecrire(c.b, ''); style(c.b, 'top', ''); style(c.b, 'color', ''); c.yb = c.ob = 0; }
      // le signe change : celui qui est à l'écran devient le sortant, là où il est ; le nouveau entre par le bas ou par le haut
      else if (ca !== c.ch) { ecrire(c.b, c.ch); c.bOn = !!c.ch; c.yb0 = c.y; c.ob0 = c.o; c.ya0 = sens * ROULE; c.oa0 = 0; c.sens = sens; }
      else { c.ya0 = c.y; c.oa0 = c.o; c.yb0 = c.yb; c.ob0 = c.ob; } // le même signe : il continue d'où il est
      ecrire(c.a, ca); c.ch = ca;
    });
    k.txt = txt; el.setAttribute('aria-label', txt);
    k.roule = k.cases.some((c) => c.ya0 !== 0 || c.oa0 !== 1 || c.bOn || c.wDe !== c.wA);
    if (k.roule) el.setAttribute('data-roule', ''); // les cases deviennent des fenêtres le temps du roulement
    rendreCases(el, k.roule ? 0 : 1);
  }
  function rendreCases(el, e) {
    const k = cz.get(el); if (!k) return;
    const fin = e >= 1;
    for (const c of k.cases) {
      const w = fin ? c.wA : lerp(c.wDe, c.wA, e), ws = w.toFixed(4);
      c.wVu = fin ? undefined : w;
      if (c._w !== ws) { c.el.style.width = `${ws}em`; c._w = ws; }
      c.y = fin ? 0 : lerp(c.ya0, 0, e); c.o = fin ? 1 : lerp(c.oa0, 1, e);
      style(c.a, 'top', c.y ? `${c.y.toFixed(4)}em` : ''); style(c.a, 'color', c.o >= 1 ? '' : encre(c.o));
      if (!c.bOn) continue;
      if (fin) { c.bOn = false; ecrire(c.b, ''); style(c.b, 'top', ''); style(c.b, 'color', ''); c.yb = c.ob = 0; continue; }
      c.yb = lerp(c.yb0, -c.sens * ROULE, e); c.ob = lerp(c.ob0, 0, e);
      style(c.b, 'top', `${c.yb.toFixed(4)}em`); style(c.b, 'color', encre(c.ob));
    }
    if (fin) { k.roule = false; el.removeAttribute('data-roule'); }
  }
  // les bornes de la fourchette, en chiffres tabulaires : elles comptent sur place, dans une largeur qui glisse de celle du
  // montant de départ à celle du montant d'arrivée (quand il gagne ou perd un chiffre, le bord de la zone hachurée ne saute plus)
  const largeurTexte = (el, k, t) => { let w = 0; for (let i = 0; i < t.length; i++) w += largeurSigne(el, k, t[i], t[i + 1]); return w; };
  function viserCompte(el, tDe, tA, direct) {
    let k = cz.get(el); if (!k) { k = { em: new Map(), cases: [], txt: null, sonde: null, roule: false, compte: true }; cz.set(el, k); mesurerSignes(el, k); }
    k.wA = largeurTexte(el, k, tA); k.wDe = direct ? k.wA : k.wVu ?? largeurTexte(el, k, tDe);
    k.txt = tA; k.roule = !direct;
    rendreCompte(el, direct ? tA : tDe, direct ? 1 : 0);
  }
  function rendreCompte(el, txt, e) {
    const k = cz.get(el), fin = e >= 1, w = fin ? k.wA : lerp(k.wDe, k.wA, e);
    k.wVu = fin ? undefined : w; style(el, 'width', fin ? '' : `${w.toFixed(4)}em`); ecrire(el, txt);
    if (fin) k.roule = false;
  }
  // l'encre d'un texte qui s'efface : sa couleur, plus ou moins transparente (se repeint sans toucher aux arbres de propriétés)
  const GIVRE = [1, 3, 5].map((i) => parseInt(P.givre.slice(i, i + 2), 16)).join(' ');
  const encre = (o) => (FORCES.matches ? '' : `rgb(${GIVRE} / ${clamp(o).toFixed(3)})`); // en couleurs forcées, le texte garde la couleur du système
  // une police arrivée après coup : les largeurs des signes se remesurent
  const remesurer = () => { for (const [el, k] of cz) { k.em.clear(); mesurerSignes(el, k); if (k.txt !== null) { k.wVu = undefined; for (const c of k.cases) c.wVu = undefined; if (k.compte) viserCompte(el, k.txt, k.txt, true); else viserCases(el, k.txt, 0); } } };
  document.fonts && document.fonts.ready.then(remesurer);

  let vu = null, cible = null, carteTw = null; // l'état affiché, l'état visé, le passage en cours
  const blocs = [$('[data-somme]'), $('[data-date]'), $('[data-gain]')], mlEl = $('[data-ml]');
  // les changements de texte et de structure qui attendent le creux du fondu : { els, faire, fait }
  let creux = null;
  const fondre = (el, o) => (el.tagName === 'TBODY' ? style(el, 'opacity', o >= 1 ? '' : o.toFixed(3)) : style(el, 'color', o >= 1 ? '' : encre(o)));
  function finirCreux() { const D = creux; creux = null; if (!D) return; if (!D.fait) { if (RM) { D.fait = true; for (const f of D.faire) f(); } else faireCreux(D); } for (const el of D.els) fondre(el, 1); }
  function faireCreux(D) {
    // (et les rangées dont le libellé change : sur un téléphone, il peut passer de deux lignes à une)
    const els = [...blocs, ...D.rangs, ...[depV, depD].filter((d) => d.open).map((d) => d.querySelector('.dep-in'))], h0 = els.map((b) => b.getBoundingClientRect().height);
    for (const r of rangs.values()) if (D.rangs.includes(r.el)) r.h = 0; // sa hauteur naturelle sera relue
    D.fait = true; for (const f of D.faire) f();
    glisserHauteurs(els, h0);
  }
  function versCible(C, direct = false) {
    if (carteTw) { carteTw.stop(); carteTw = null; }
    finirCreux();
    const de = vu, anim = !(direct || RM || !de);
    cible = C;
    // 1. les textes de l'état visé : ceux qui changent attendent le creux du fondu
    const D = { els: new Set(), faire: [], rangs: [], fait: false }, T = C.textes;
    const texte = (el, txt) => { if (el._t === txt) return; if (anim && el._t !== undefined) { D.els.add(el); D.faire.push(() => ecrire(el, txt)); } else ecrire(el, txt); };
    texte($('[data-qlabel]'), T.qlabel); texte($('[data-fourchette]'), T.fourchette); texte($('[data-date]'), T.date); texte(gainEl, T.gain);
    if (mlEl.hidden !== !T.ml || (T.ml && mlEl._t !== T.ml)) { const f = () => { mlEl.hidden = !T.ml; if (T.ml) ecrire(mlEl, T.ml); }; if (anim) { D.els.add(mlEl); D.faire.push(f); } else f(); }
    // 2. les montants et les rangées
    compter($('[data-pu]'), C.ht, eur, anim, true); texte($('[data-ttc]'), `soit ${eur(C.ht * 1.2)} TTC`);
    compter($('[data-tol-min]'), C.tolMin, eurC, anim, 'compte'); compter($('[data-tol-max]'), C.tolMax, eurC, anim, 'compte');
    compter(totEl.querySelector('[data-tot]'), C.ht, eurC, anim);
    const entrants = [];
    for (const [id, b] of C.postes) {
      const a = de && de.postes.get(id); if (!b.pres && !(a && a.pres > 0)) continue;
      const r = rangee(id);
      if (b.pres) { if (a && a.pres >= 1) { if (anim && r.lib._t !== b.libelle) D.rangs.push(r.el); texte(r.lib, b.libelle); } else ecrire(r.lib, b.libelle); if (!(a && a.pres > 0)) { r.el.hidden = false; r.el.style.height = ''; r.vu = -1; } }
      compter(r.val, b.unit, eurC, anim); compter(r.part, b.k, pct, anim);
      entrants.push(r);
    }
    friseEl.hidden = !C.friseOk;
    for (const [id, nom] of JOURS) {
      const b = C.frise.get(id), a = de && de.frise.get(id); if (!b.pres && !(a && a.pres > 0)) continue;
      const r = rangeeJ(id, nom);
      if (b.pres && !(a && a.pres > 0)) { r.el.hidden = false; r.el.style.height = ''; r.vu = -1; }
      compter(r.val, b.j, (v) => jours(Math.round(v)), anim);
      entrants.push(r);
    }
    compter(jtEl.lastElementChild, C.jt, (v) => `${jours(Math.round(v))} ouvrés`, anim);
    const nJ = Math.ceil(Math.max(C.jt, de ? de.jt : 0)) + 1;
    if (nJ !== nLignes) { nLignes = nJ; grille.style.backgroundImage = Array(nJ).fill('var(--q-jour)').join(', '); }
    tables(C, anim, D, texte);
    // 3. la courbe : ses graduations de départ et d'arrivée existent toutes pendant le passage
    const W = largeurCourbe();
    if (W !== cbW || !cbN) batir(W);
    batirGrad(new Set([...(anim ? de.grad.keys() : []), ...C.grad.keys()]));
    ecrire(cbN.etiq, C.textes.etiq + eur(C.ht)); cbN.tw = largeurEtiq(C.textes.etiq + eur(C.ht));
    // 4. ce qui se lit après avoir écrit, en une fois : la hauteur naturelle des rangées
    for (const r of entrants) if (!r.h) r.h = r.el.getBoundingClientRect().height;
    if (!grilleW) grilleW = grille.clientWidth;
    if (!gammeW) gammeW = gamme.clientWidth;
    if (!anim) { vu = C; rendre(C, 1); repos(C); return; }
    const aCreux = D.faire.length > 0; if (aCreux) creux = D;
    carteTw = glisser(PRIX_MS, (u) => {
      const e = EASE.approche(u), t = u * PRIX_MS; vu = melange(de, C, e); rendre(vu, e);
      if (!aCreux || creux !== D) return;
      if (t < SORTIE_MS) { for (const el of D.els) fondre(el, 1 - t / SORTIE_MS); return; }
      if (!D.fait) faireCreux(D);
      const o = clamp((t - SORTIE_MS) / MOTION.micro.ms); for (const el of D.els) fondre(el, o);
    }, () => { carteTw = null; if (creux === D) finirCreux(); vu = C; rendre(C, 1); repos(C); });
  }
  function rendre(S, e) {
    for (const [el, c] of compteurs) {
      if (c.enCases === 'compte') { if (cz.get(el).roule) { c.v = e >= 1 ? c.a : lerp(c.de, c.a, e); rendreCompte(el, c.fmt(c.v), e); if (e >= 1) c.de = c.a; } continue; }
      if (c.enCases) { if (cz.get(el).roule) rendreCases(el, e); c.v = c.a; continue; }
      if (c.de === c.a) continue;
      c.v = e >= 1 ? c.a : lerp(c.de, c.a, e); ecrire(el, c.fmt(c.v));
      if (e >= 1) c.de = c.a;
    }
    const n = S.n.toFixed(2); if (prixEl._n !== n) { prixEl._n = n; prixEl.style.setProperty('--n', n); }
    rendreRangs(S);
    rendreCourbe(S);
  }
  function rendreRangs(S) {
    // le total : la barre pleine, entaillée de 2 px à chaque limite de poste (l'entaille se referme avec le poste qui sort)
    let i = 0, tailles = '', places = '';
    for (const [id, p] of S.postes) {
      const r = rangs.get(id);
      if (r) { presence(r, p.pres); barre(r.barre, p.x, p.k, gammeW); }
      if (i) { const l = p.k > 0 && p.x > 0.001 ? 2 * clamp(p.k / MINCE) : 0; tailles += `${px(l)} 100%, `; places += `${px(p.x * gammeW - l / 2)} 0, `; }
      i++;
    }
    style(totPiste, 'backgroundSize', `${tailles}100% 100%`); style(totPiste, 'backgroundPosition', `${places}0 0`);
    const jt = Math.max(S.jt, 1);
    for (const [id, p] of S.frise) { const r = jrs.get(id); if (r) { presence(r, p.pres); barre(r.barre, p.x / jt, p.j / jt, grilleW); } }
    // la grille des jours : un filet par jour, posé au pixel ; elle s'efface quand un jour fait moins de 6 px
    const pasJ = grilleW / jt, oJ = clamp((pasJ - 4) / 3);
    let tj = '', pj = ''; for (let k = 0; k < nLignes; k++) { tj += `${k ? ', ' : ''}${k <= jt + 0.02 ? '1px' : '0'} 100%`; pj += `${k ? ', ' : ''}${Math.min(grilleW - 1, Math.round(k * pasJ))}px 0`; }
    style(grille, 'backgroundSize', tj); style(grille, 'backgroundPosition', pj); style(grille, 'opacity', oJ >= 1 ? '' : oJ.toFixed(2));
  }
  // au repos : ce que lisent les lecteurs d'écran et le clavier, une fois les valeurs arrivées
  function repos(C) {
    tolEl.setAttribute('aria-label', `Le devis se situera entre ${eur(C.tolMin)} et ${eur(C.tolMax)} HT la pièce.`);
    const i = QTES.reduce((b, v, k) => (Math.abs(Math.log(v / C.q)) < Math.abs(Math.log(QTES[b] / C.q)) ? k : b), 0);
    clavier.value = String(i); clavier.setAttribute('aria-valuetext', `${pieces(C.q)}${NB}: ${eur(C.ht)} la pièce`);
    if (!vue) entree();
  }

  // ----- les deux tableaux : les mêmes valeurs, pour qui veut les chiffres ; la ligne de la quantité en cours y est repérée -----
  const tV = $('[data-courbe-table]'), tD = $('[data-detail]'), depV = $('[data-valeurs-wrap]'), depD = $('[data-detail-wrap]');
  const lignesV = new Map(), lignesD = new Map();
  function tables(C, anim, D = null, texte = ecrire) {
    const qs = C.noeuds.map((n) => n[0]), idsD = [...C.postes].filter(([, p]) => p.pres).map(([id]) => id);
    // ouvert, un tableau dont les lignes changent (une quantité hors palier entre ou sort, un poste apparaît) change au creux du fondu
    const memes = (m, cles) => m.size === cles.length && cles.every((k) => m.has(k));
    const courantV = [...lignesV].find(([, l]) => l.tr.hasAttribute('aria-current'));
    const diffV = anim && depV.open && (!memes(lignesV, qs) || !courantV || courantV[0] !== C.q), diffD = anim && depD.open && !memes(lignesD, [...idsD, 'tot']);
    // fermé, un tableau n'est pas réécrit à chaque calcul (trente montants pour rien) : il se met à jour à l'ouverture
    if (!depV.open && lignesV.size) perimeV = true; else if (diffV) { D.els.add(tV); D.faire.push(() => tableV(C, false, ecrire)); } else tableV(C, anim && depV.open, texte);
    if (!depD.open && lignesD.size) perimeD = true; else if (diffD) { D.els.add(tD); D.faire.push(() => tableD(C, false, ecrire)); } else tableD(C, anim && depD.open, texte);
  }
  let perimeV = false, perimeD = false;
  const aJour = () => { if (!cible) return; if (perimeV) { perimeV = false; tableV(cible, false, ecrire); } if (perimeD) { perimeD = false; tableD(cible, false, ecrire); } };
  // au clic sur le titre du dépliant (avant qu'il s'ouvre), et à toute autre ouverture (recherche dans la page, script)
  for (const d of [depV, depD]) { d.querySelector('summary').addEventListener('click', aJour); d.addEventListener('toggle', () => { if (d.open) aJour(); }); }
  function tableV(C, av, texte) {
    const qs = C.noeuds.map((n) => n[0]), courant = () => { for (const [q, l] of lignesV) if (q === C.q) l.tr.setAttribute('aria-current', 'true'); else l.tr.removeAttribute('aria-current'); };
    for (const [q, l] of lignesV) if (!qs.includes(q)) { l.tr.remove(); lignesV.delete(q); compteurs.delete(l.u); compteurs.delete(l.t); }
    C.noeuds.forEach(([q, unit], k) => {
      let l = lignesV.get(q);
      if (!l) { const tr = document.createElement('tr'); tr.innerHTML = '<th scope="row"></th><td class="num"></td><td class="num"></td>'; tr.firstChild.textContent = fmtN(q, 0); l = { tr, u: tr.children[1], t: tr.children[2] }; lignesV.set(q, l); const suiv = qs.slice(k + 1).map((x) => lignesV.get(x)).find(Boolean); tV.insertBefore(tr, suiv ? suiv.tr : null); }
      compter(l.u, unit, eur, av); compter(l.t, r2(unit) * q, eur, av);
    });
    courant();
  }
  function tableD(C, ad, texte) {
    for (const [id, l] of lignesD) if (!(C.postes.get(id) || {}).pres && id !== 'tot') { l.tr.remove(); lignesD.delete(id); compteurs.delete(l.u); compteurs.delete(l.t); }
    const ligneD = (id, avant) => { let l = lignesD.get(id); if (!l) { const tr = document.createElement('tr'); tr.setAttribute('role', 'row'); tr.innerHTML = '<td role="cell"><strong></strong><span></span></td><td role="cell" class="num"></td><td role="cell" class="num"></td>'; l = { tr, lib: tr.querySelector('strong'), det: tr.querySelector('span'), u: tr.children[1], t: tr.children[2] }; lignesD.set(id, l); tD.insertBefore(tr, avant); } return l; };
    const tot = ligneD('tot', null); tot.tr.className = 'tot'; ecrire(tot.lib, 'Total hors taxes'); tot.det.hidden = true;
    compter(tot.u, C.ht, eur, ad); compter(tot.t, C.tot, eur, ad);
    const ids = [...C.postes.keys()];
    for (const [id, p] of C.postes) { if (!p.pres) continue; const suiv = ids.slice(ids.indexOf(id) + 1).map((x) => lignesD.get(x)).find(Boolean); const l = ligneD(id, suiv ? suiv.tr : tot.tr); texte(l.lib, p.libelle); texte(l.det, p.detail); compter(l.u, p.unit, eur, ad); compter(l.t, p.total, eur, ad); }
  }

  // ---------- Courbe : le prix à la pièce selon la quantité (une série, abscisse logarithmique) ----------
  // Itération 8 : un graphique d'atelier. L'abscisse est une règle logarithmique (une graduation par unité de chaque décade,
  // plus longue aux paliers chiffrés) ; la courbe est la vraie courbe du prix, pas une ligne brisée entre neuf points ; l'aire
  // sous elle est hachurée à 45° comme une zone de dessin technique ; le repère de la quantité choisie porte sa valeur, un
  // anneau marque le palier suivant et une phrase dit ce qu'il fait gagner. À la première apparition, la courbe se trace comme
  // une coupe au laser (un perçage, puis la tête à vitesse constante, les paliers percés à son passage), la zone hachurée se
  // pose, puis le repère descend sur la courbe au geste d'approche de la presse. On explore au survol ou au doigt (accrochage
  // aux paliers), un clic choisit la quantité, les flèches du clavier passent d'un palier à l'autre.
  const chart = $('[data-courbe]'), plot = chart.parentElement, tip = $('[data-tip]'), clavier = $('[data-courbe-clavier]'), gainEl = $('[data-gain]');
  const CH = 252, CM = { l: 62, r: 22, t: 44, b: 38 };
  let cbW = 0, cbN = null; // la largeur dessinée, les nœuds du dessin
  const largeurCourbe = () => Math.max(200, Math.round(plot.clientWidth) || 512);
  const f2 = (v) => v.toFixed(2);
  new ResizeObserver(() => { if (cible && plot.clientWidth && largeurCourbe() !== cbW) { finEntree(); versCible(viser(cible.an, cible.opts, cible.c), true); } }).observe(plot);
  const mesure = document.createElement('canvas').getContext('2d');
  const largeurEtiq = (t) => { mesure.font = "650 15px 'Mona Sans', sans-serif"; return mesure.measureText(t).width; };
  document.fonts && document.fonts.ready.then(() => { if (cbN && cible) { cbN.tw = largeurEtiq(cbN.etiq.textContent); rendreCourbe(vu || cible); } });
  tip.hidden = false; tip.setAttribute('aria-hidden', 'true');
  // le squelette du dessin, une fois par largeur : la règle des quantités, puis les marques que rendreCourbe() déplace
  function batir(W) {
    const m = CM, x0 = m.l, x1 = W - m.r, yb = CH - m.b, xl = (v) => x0 + (v / 3) * (x1 - x0), ys = (v, ymax) => m.t + (1 - v / ymax) * (yb - m.t);
    const px = (v) => Math.round(xl(v)) + 0.5, lib = (x1 - x0) * Math.log10(2) / 3 >= 40; // la place d'écrire les neuf paliers, ou seulement les décades
    let g = '<defs><pattern id="ou-trame-courbe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="c-trame" x1="0.5" y1="0" x2="0.5" y2="6"/></pattern></defs><g data-grads></g>';
    g += `<line class="c-regle" x1="${x0}" x2="${x1 + 1}" y1="${yb + 0.5}" y2="${yb + 0.5}"/>`;
    for (let d = 0; d < 3; d++) for (let k = 2; k <= 9; k++) if (!QTES.includes(k * 10 ** d)) g += `<line class="c-tic" x1="${px(d + Math.log10(k))}" x2="${px(d + Math.log10(k))}" y1="${yb}" y2="${yb + 4}"/>`;
    QTES.forEach((q, i) => {
      const dec = Number.isInteger(LQ[i]), x = px(LQ[i]);
      g += `<line class="c-tic ${dec ? 'c-tic--dec' : 'c-tic--pal'}" x1="${x}" x2="${x}" y1="${yb}" y2="${yb + (dec ? 9 : 7)}"/>`;
      if (dec || lib) g += `<text class="${dec ? 'c-dec' : 'c-pal'}" x="${f2(xl(LQ[i]))}" y="${yb + 26}" text-anchor="middle">${fmtN(q, 0)}</text>`;
    });
    g += '<path data-aire class="c-aire" fill="url(#ou-trame-courbe)"/><path data-ligne class="c-ligne"/>';
    g += LQ.map((v) => `<circle data-pt class="c-pt" cx="${f2(xl(v))}" r="3"/>`).join('');
    g += '<circle data-suivant class="c-suivant" r="4.5"/>';
    g += `<g data-repere><line data-fil class="c-fil" y1="${m.t - 16}" y2="${yb + 9}"/><circle data-halo class="c-halo" r="10.5"/><circle data-anneau class="c-anneau" r="6.5"/><text data-etiq class="c-etiq" y="${m.t - 24}" text-anchor="middle"></text></g>`;
    g += `<g data-sonde visibility="hidden"><line data-cross class="c-cross" y1="${m.t - 6}" y2="${yb}"/><circle data-sonde-pt class="c-sonde" r="5"/></g>`;
    g += '<circle data-tete class="c-tete" r="3.5" visibility="hidden"/>';
    chart.setAttribute('viewBox', `0 0 ${W} ${CH}`); chart.style.maxWidth = `${W}px`; chart.innerHTML = g;
    const q = (sel) => chart.querySelector(sel);
    cbW = W;
    cbN = { W, xl, ys, x0, x1, yb, xs: XS.map((v) => xl(v).toFixed(1)), grads: q('[data-grads]'), grad: new Map(), aire: q('[data-aire]'), ligne: q('[data-ligne]'), pts: [...chart.querySelectorAll('[data-pt]')], suivant: q('[data-suivant]'),
      repere: q('[data-repere]'), fil: q('[data-fil]'), halo: q('[data-halo]'), anneau: q('[data-anneau]'), etiq: q('[data-etiq]'), sonde: q('[data-sonde]'), cross: q('[data-cross]'), sondePt: q('[data-sonde-pt]'), tete: q('[data-tete]'), tw: 0 };
    if (!vue) marques(false);
  }
  function batirGrad(vals) {
    const N = cbN; let g = '';
    for (const v of vals) g += `<line data-g="${v}" class="c-grad" x1="${N.x0}" x2="${N.x1}"/><text data-gt="${v}" x="${N.x0 - 10}" text-anchor="end">${fmtN(v, 0)}${NB}€</text>`;
    N.grads.innerHTML = g; N.grad = new Map([...vals].map((v) => [v, [N.grads.querySelector(`[data-g="${v}"]`), N.grads.querySelector(`[data-gt="${v}"]`)]]));
  }
  // dessine l'état S
  function rendreCourbe(S) {
    const N = cbN, m = CM, ys = (v) => N.ys(v, S.ymax);
    for (const [v, [ln, tx]] of N.grad) {
      // une graduation qui entre ou sort par le haut du cadre le fait en fondu, sur les 10 px au-dessus du tracé
      const y = ys(v) + (S.gy.get(v) || 0), haut = clamp((y - m.t + 10) / 10), [o, ol] = S.grad.get(v) || [0, 0];
      attr(ln, 'y1', f2(y)); attr(ln, 'y2', f2(y)); attr(ln, 'opacity', f2(v === 0 ? 0 : o * haut));
      attr(tx, 'y', f2(y + 5)); attr(tx, 'opacity', f2(ol * haut));
    }
    let d = ''; for (let i = 0; i < NS; i++) d += `${i ? 'L' : 'M'}${N.xs[i]},${ys(S.ys[i]).toFixed(1)}`;
    if (N.ligne._d !== d) { N.ligne._d = d; N.ligne.setAttribute('d', d); N.aire.setAttribute('d', `${d}L${N.xs[NS - 1]},${N.yb}L${N.xs[0]},${N.yb}Z`); }
    N.pts.forEach((c, i) => attr(c, 'cy', f2(ys(S.units[i]))));
    const qx = N.xl(S.lq), qy = ys(surCourbe(S.ys, S.lq) + S.ecart);
    attr(N.halo, 'cx', f2(qx)); attr(N.halo, 'cy', f2(qy)); attr(N.anneau, 'cx', f2(qx)); attr(N.anneau, 'cy', f2(qy));
    attr(N.fil, 'x1', f2(qx)); attr(N.fil, 'x2', f2(qx));
    // étiquette : au-dessus du tracé, centrée sur le repère autant que la largeur le permet ; sa largeur est celle du texte final
    attr(N.etiq, 'x', f2(clamp(qx, N.tw / 2, N.W - N.tw / 2))); ecrire(N.etiq, S.textes.etiq + eurC(r2(S.pu)));
    // le palier suivant : un point ouvert, la cible ; collé au repère (4 et 5 pièces sont à 13 px), il s'efface
    if (S.iSuiv >= 0) { attr(N.suivant, 'cx', f2(N.xl(LQ[S.iSuiv]))); attr(N.suivant, 'cy', f2(ys(S.units[S.iSuiv]))); }
    attr(N.suivant, 'opacity', f2(S.iSuiv >= 0 ? S.suivO * clamp((N.xl(LQ[S.iSuiv]) - qx - 15) / 6) : 0));
    if (sonde.on) poserSonde();
  }

  // ----- la première apparition : la courbe se trace comme une coupe au laser -----
  let vue = RM, entreeTw = null; // la courbe a été vue (son tracé est fait ou en cours)
  const marques = (on) => { const N = cbN; for (const el of [N.aire, N.ligne, N.repere, N.suivant, ...N.pts]) el.style.opacity = on ? '' : '0'; };
  function finEntree() {
    if (!entreeTw) return; entreeTw.stop(); entreeTw = null;
    const N = cbN; marques(true);
    N.ligne.style.strokeDasharray = N.ligne.style.strokeDashoffset = N.aire.style.transform = N.etiq.style.opacity = ''; N.tete.setAttribute('visibility', 'hidden');
    N.pts.forEach((c) => c.setAttribute('r', '3')); N.anneau.setAttribute('r', '6.5'); N.halo.setAttribute('r', '10.5'); N.fil.setAttribute('y2', N.yb + 9);
  }
  function entree() {
    if (vue || !cbN || !vu || !plot.clientWidth) return;
    if (!plotVu) return; // elle attend d'être à l'écran
    vue = true;
    const N = cbN, L = N.ligne.getTotalLength(), tP = MOTION.laser.percage.ms, tC = (L / MOTION.laser.coupe.v) * 1000, tF = tP + tC;
    // l'instant où la tête passe sur chaque palier (longueur parcourue jusqu'à son abscisse)
    const seuils = LQ.map((lq) => { const x = N.xl(lq); let a = 0, b = L; for (let k = 0; k < 14; k++) { const mi = (a + b) / 2; if (N.ligne.getPointAtLength(mi).x < x) a = mi; else b = mi; } return tP + (a / L) * tC; });
    const tR = tF + ENTREE.repere, T = tR + MOTION.presse.approche.ms * 0.5 + MOTION.presse.retour.ms, y0 = CM.t - 16;
    const oSuiv = +N.suivant.getAttribute('opacity') || 0;
    N.ligne.style.strokeDasharray = `${L.toFixed(1)} ${(L + 20).toFixed(1)}`;
    entreeTw = glisser(T, (u) => {
      const t = u * T, p = clamp((t - tP) / tC), pt = N.ligne.getPointAtLength(L * p);
      N.ligne.style.opacity = t > 0 ? '' : '0'; N.ligne.style.strokeDashoffset = (L * (1 - p)).toFixed(1);
      // la tête : elle perce (le point grossit), coupe à vitesse constante, puis se lève
      N.tete.setAttribute('visibility', t < tF + MOTION.micro.ms ? 'visible' : 'hidden'); N.tete.setAttribute('cx', f2(pt.x)); N.tete.setAttribute('cy', f2(pt.y));
      N.tete.setAttribute('r', f2(3.5 * EASE.approche(clamp(t / tP)))); N.tete.setAttribute('opacity', f2(1 - clamp((t - tF) / MOTION.micro.ms)));
      N.pts.forEach((c, i) => { const s = clamp((t - seuils[i]) / tP); c.style.opacity = s > 0 ? '' : '0'; c.setAttribute('r', f2(3 * EASE.retour(s))); });
      // la zone découpée se pose (la chute d'une pièce coupée), puis le repère descend et l'anneau se pose avec le retour élastique
      const a = clamp((t - tF) / MOTION.laser.chute.ms); N.aire.style.opacity = a >= 1 ? '' : a.toFixed(3); N.aire.style.transform = a >= 1 ? '' : `translateY(${(-ENTREE.chute * (1 - EASE.approche(a))).toFixed(2)}px)`;
      const f = clamp((t - tR) / MOTION.presse.approche.ms), r = clamp((t - tR - MOTION.presse.approche.ms * 0.5) / MOTION.presse.retour.ms), k = EASE.retour(r);
      N.repere.style.opacity = f > 0 ? '' : '0'; N.etiq.style.opacity = f >= 1 ? '' : f.toFixed(3);
      N.fil.setAttribute('y2', f2(lerp(y0, N.yb + 9, EASE.approche(f)))); N.anneau.setAttribute('r', f2(6.5 * k)); N.halo.setAttribute('r', f2(10.5 * k));
      N.suivant.style.opacity = r >= 1 ? '' : (r * oSuiv).toFixed(3);
    }, () => { finEntree(); });
  }
  let plotVu = false;
  onceVisible(plot, () => { plotVu = true; if (vu && !carteTw) entree(); }, { threshold: 0.55 });

  // ----- explorer : au survol, au doigt ; un clic choisit -----
  const sonde = { on: false, q: 0, unit: 0, lq: 0, vlq: 0, o: 0, tk: null };
  function quantiteA(clientX) {
    const N = cbN, r = chart.getBoundingClientRect(), x = ((clientX - r.left) / r.width) * N.W;
    // accrochage aux paliers : à moins de 12 px d'un palier, c'est lui ; sinon la quantité entière sous le pointeur
    let pres = 0; LQ.forEach((v, i) => { if (Math.abs(N.xl(v) - x) < Math.abs(N.xl(LQ[pres]) - x)) pres = i; });
    if (Math.abs(N.xl(LQ[pres]) - x) <= ACCROCHE) return QTES[pres];
    return Math.round(clamp(10 ** (((x - N.x0) / (N.x1 - N.x0)) * 3), 1, 1000));
  }
  function sonder(clientX) {
    if (!cible || !cbN) return 0;
    finEntree(); if (!vue) { vue = true; marques(true); }
    const q = quantiteA(clientX), i = QTES.indexOf(q);
    if (q !== sonde.q || !sonde.on) {
      sonde.q = q; sonde.unit = q === cible.q ? cible.pu : i >= 0 ? cible.units[i] : chiffrer(cible.an, { ...cible.opts, qte: q }).unit; sonde.lq = Math.log10(q);
      tip.textContent = '';
      const s = document.createElement('strong'); s.textContent = eur(sonde.unit) + ' la pièce';
      const t = document.createElement('span'); t.textContent = `pour ${pieces(q)}, ${eur(r2(sonde.unit) * q)} au total`;
      tip.append(s, t); sonde.tw = tip.offsetWidth; sonde.th = tip.offsetHeight;
      sonde.plafond = plot.getBoundingClientRect().top; sonde.teteBas = getComputedStyle(tete).position === 'sticky' ? tete.getBoundingClientRect().bottom : -1e4;
    }
    if (!sonde.on) { sonde.on = true; if (sonde.o <= 0) sonde.vlq = sonde.lq; cbN.sonde.setAttribute('visibility', 'visible'); tip.setAttribute('data-on', ''); }
    animerSonde();
    return q;
  }
  // la sonde glisse vers sa cible (elle ne saute pas d'une quantité à l'autre) ; elle arrive et se retire en fondu (MOTION.micro),
  // et le repère de la quantité choisie s'estompe d'autant
  function animerSonde() {
    if (RM) { sonde.vlq = sonde.lq; sonde.o = sonde.on ? 1 : 0; poserSonde(); return; }
    sonde.tk ||= ticker((dt) => {
      const d = sonde.lq - sonde.vlq, but = sonde.on ? 1 : 0, pas = dt / MOTION.micro.ms;
      sonde.o = but > sonde.o ? Math.min(1, sonde.o + pas) : Math.max(0, sonde.o - pas);
      if (Math.abs(d) < 0.0005) sonde.vlq = sonde.lq; else sonde.vlq += d * (1 - Math.exp(-dt / SONDE_MS));
      poserSonde();
      return sonde.o !== but || sonde.vlq !== sonde.lq;
    });
    sonde.tk.start(); poserSonde();
  }
  function poserSonde() {
    const N = cbN, S = vu || cible, x = N.xl(sonde.vlq), o = sonde.o;
    attr(N.sonde, 'opacity', o.toFixed(3)); style(tip, 'opacity', o.toFixed(3)); N.repere.style.opacity = o <= 0 ? '' : (1 - 0.65 * o).toFixed(3);
    if (o <= 0 && !sonde.on) { N.sonde.setAttribute('visibility', 'hidden'); tip.removeAttribute('data-on'); return; }
    // sur la courbe pendant qu'elle glisse (ou que la carte change) ; sur son prix exact une fois arrivée
    const arrivee = S === cible && Math.abs(sonde.vlq - sonde.lq) < 0.0005, y = N.ys(arrivee ? sonde.unit : surCourbe(S.ys, sonde.vlq), S.ymax);
    N.cross.setAttribute('x1', f2(x)); N.cross.setAttribute('x2', f2(x)); N.sondePt.setAttribute('cx', f2(x)); N.sondePt.setAttribute('cy', f2(y));
    // la bulle : au-dessus du point ; s'il n'y a pas la place (haut du dessin, ou en-tête collé juste au-dessus), elle passe dessous
    const haut = y - sonde.th - 14, dessous = haut < -24 || sonde.plafond + haut < sonde.teteBas + 6;
    tip.style.transform = `translate(${clamp(x - sonde.tw / 2, 0, N.W - sonde.tw).toFixed(1)}px, ${(dessous ? y + 16 : haut).toFixed(1)}px)`;
  }
  function quitterSonde() { if (!sonde.on) return; sonde.on = false; animerSonde(); }
  const choisirQte = (q) => { if (!q) return; qte.value = String(q); calcul(); };
  let tactile = false;
  chart.addEventListener('pointerdown', (e) => { tactile = e.pointerType !== 'mouse'; if (tactile) sonder(e.clientX); });
  // après un clic, la sonde se retire (on voit la quantité choisie) ; elle revient dès que le pointeur repart
  chart.addEventListener('pointermove', (e) => { if (sonde.gel) { if (Math.hypot(e.clientX - sonde.gel[0], e.clientY - sonde.gel[1]) < 6) return; sonde.gel = null; } if (e.pointerType === 'mouse' || sonde.on) sonder(e.clientX); });
  chart.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') quitterSonde(); });
  chart.addEventListener('pointercancel', quitterSonde);
  // au doigt : on glisse pour lire, on lève pour choisir ; à la souris : le clic choisit
  chart.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' || !sonde.on) return; const q = sonder(e.clientX); quitterSonde(); choisirQte(q); });
  chart.addEventListener('click', (e) => { if (tactile) { tactile = false; return; } const q = sonder(e.clientX); quitterSonde(); sonde.gel = [e.clientX, e.clientY]; choisirQte(q); });
  // au clavier : un curseur natif, d'un palier à l'autre (les lecteurs d'écran lisent la quantité et son prix)
  clavier.addEventListener('keydown', (e) => {
    if (!cible) return;
    const q = cible.q, k = e.key;
    const vers = k === 'ArrowRight' || k === 'ArrowUp' || k === 'PageUp' ? QTES.find((v) => v > q) : k === 'ArrowLeft' || k === 'ArrowDown' || k === 'PageDown' ? [...QTES].reverse().find((v) => v < q) : k === 'Home' ? 1 : k === 'End' ? 1000 : null;
    if (vers === null) return;
    e.preventDefault(); if (vers && vers !== q) choisirQte(vers);
  });
  clavier.addEventListener('input', () => { const v = QTES[+clavier.value]; if (cible && v && v !== cible.q) choisirQte(v); });

  // ---------- Demande de devis (démonstration : rien n'est envoyé) ----------
  const form = $('[data-form]'), envoi = form.querySelector('button[type="submit"]'), ok = $('[data-envoye]');
  // le bouton s'efface, le formulaire prend sa place en fondu pendant que le bloc glisse à sa hauteur (même geste que les états de la carte)
  const agir = form.parentElement, dansAgir = () => [...agir.children].filter((el) => !el.hidden);
  $('[data-ouvrir]').addEventListener('click', () => basculer(() => { form.hidden = false; $('[data-ouvrir]').hidden = true; ok.hidden = true; form.querySelector('input').focus({ preventScroll: true }); }, agir, dansAgir));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (envoi.getAttribute('aria-busy') === 'true') return;
    const contact = form.querySelector('[name="contact"]'), err = form.querySelector('[data-err]'), v = contact.value.trim();
    const bon = /@.+\./.test(v) || v.replace(/\D/g, '').length >= 10;
    if (!bon) {
      err.querySelector('span').textContent = v ? 'Ce téléphone ou cet e-mail semble incomplet. Vérifiez-le.' : 'Indiquez un téléphone ou un e-mail pour que nous puissions vous répondre.';
      const h0 = agir.getBoundingClientRect().height; contact.setAttribute('aria-invalid', 'true'); err.hidden = false; glisserHauteur(agir, h0); contact.focus(); return;
    }
    contact.removeAttribute('aria-invalid'); err.hidden = true;
    envoi.setAttribute('aria-busy', 'true'); envoi.disabled = true; const lab = envoi.textContent; envoi.textContent = 'Envoi…';
    await wait(MOTION.presse.appui.ms);
    envoi.removeAttribute('aria-busy'); envoi.disabled = false; envoi.textContent = lab;
    const n = 'D-2026-' + String(410 + Math.floor((Date.now() / 1000) % 90)).padStart(4, '0');
    const quoi = state.etat === 'prix' ? 'le devis' : 'le prix';
    basculer(() => { ok.hidden = false; form.hidden = true; ok.focus({ preventScroll: true }); }, agir, dansAgir);
    ok.querySelector('p').textContent = `Demande ${n} enregistrée${state.fileName ? `, avec ${state.fileName}` : ''}. L\u2019atelier vous répondrait dans la journée avec ${quoi}. Ce site est une démonstration${NB}: rien n\u2019a été envoyé.`;
  });

  // ---------- État initial ----------
  majEpaisseurs();
  choisir(0);
  return {
    choisir, lire,
    setRal(code) { state.finition = 'ral'; root.querySelector('input[name="ou-fin"][value="ral"]').checked = true; $('[data-ral-wrap]').hidden = false; state.ral = code; ralSel.value = code; calcul(); peindre(); },
    get part() { return state.part; }, get fichier() { return state.file; }, get etat() { return state.etat; },
    get scene() { return stage; }, // la scène en cours (banc d'essai : seek, états)
    // banc d'essai : l'état de la carte, et de quoi rejouer le tracé d'entrée de la courbe en deux temps (la cacher, puis la tracer)
    get carte() { return { vu, cible, mouvant: !!carteTw || !!entreeTw || !!bascule, vue, cacherCourbe() { finEntree(); vue = false; if (cbN) marques(false); }, tracerCourbe() { plotVu = true; entree(); } }; },
  };
}
