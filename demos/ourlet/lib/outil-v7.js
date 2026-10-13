// Ourlet · outil de pré-chiffrage : déposer un plan (DXF) ou choisir une pièce, régler matière, épaisseur, quantité, finition,
// voir la pièce se plier et lire un prix indicatif, avec la courbe des prix par quantité et le détail du calcul.
// Rien ne quitte le navigateur : le plan est lu sur place. Entreprise fictive : prix inventés.
// États de la carte du prix : prix (succès), vide (pas de quantité), chargement (plan en lecture), erreur (plan illisible,
// quantité hors limites), humain (fichier lu par l'atelier : DWG, STEP, PDF, croquis, photo ; série de plus de 5 000 pièces). Chaque changement est
// annoncé aux lecteurs d'écran par une phrase courte, une fois la saisie posée.
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
import { analyse, chiffrer, paliers, epaisseurs, MATIERES, STOCK, dateDispo, fmtDate, eur, fmtN } from './chiffrage.js';
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
    const h1 = vers ?? el.offsetHeight; if (RM || !h0 || !h1 || Math.abs(h1 - h0) < 1) { fin && fin(); return; }
    el.style.overflow = 'hidden'; el.style.alignContent = 'start';
    const tw = glisser(MOTION.presse.approche.ms, (u) => { el.style.height = `${lerp(h0, h1, EASE.approche(u)).toFixed(1)}px`; }, () => { hauteurs.delete(el); fin && fin(); libre(); });
    tw.fin = fin; hauteurs.set(el, tw);
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
  const etatEl = $('[data-etat]'), prixEl = $('[data-prix]');
  function etat(kind, txt) {
    state.etat = kind;
    const ok = kind === 'prix';
    prixEl.hidden = !ok; $('[data-courbe-wrap]').hidden = !ok; $('[data-detail-wrap]').hidden = !ok;
    etatEl.hidden = ok;
    root.querySelector('.quote').setAttribute('data-mode', kind);
    if (!ok) {
      const ic = { vide: 'info', chargement: 'load', erreur: 'err', humain: 'info' }[kind];
      etatEl.innerHTML = `${ICON[ic]}<p></p>`; etatEl.querySelector('p').textContent = txt;
      etatEl.className = `etat etat--${kind}`;
      if (kind !== 'chargement') dire(txt);
      onPrix && onPrix(null);
    }
    $('[data-ouvrir]').textContent = ok ? 'Recevoir le devis' : 'Être rappelé avec le prix';
    // pas de rappel proposé tant que la quantité est fausse : il suffit de la corriger
    $('[data-ouvrir]').hidden = kind === 'vide' || kind === 'chargement' || state.qInvalide || !$('[data-form]').hidden;
  }

  // le grand prix rejoint sa nouvelle valeur en comptant, sur le geste d'approche (PRIX_MS) : ni saut ni effet ; au repos, le
  // texte est la valeur finale (l'annonce aux lecteurs d'écran, elle, ne dit que cette valeur, une fois : dire())
  let prixVu = null, prixTw = null;
  const ecrirePrix = (v) => { $('[data-pu]').textContent = eur(v); $('[data-ttc]').textContent = `soit ${eur(v * 1.2)} TTC`; };
  function versPrix(ht, direct = false) {
    if (prixTw) { prixTw.stop(); prixTw = null; }
    if (direct || RM || prixVu === null || prixVu === ht) { prixVu = ht; ecrirePrix(ht); return; }
    const de = prixVu;
    prixTw = glisser(PRIX_MS, (u) => { prixVu = Math.round(lerp(de, ht, EASE.approche(u)) * 100) / 100; ecrirePrix(prixVu); }, () => { prixTw = null; prixVu = ht; ecrirePrix(ht); });
  }

  function calcul(prefixe = null) {
    const q = lireQte();
    state.qInvalide = q === 'invalide';
    qte.setAttribute('aria-invalid', String(q === 'invalide'));
    qerr.hidden = q !== 'invalide';
    if (q === 'invalide') { etat('erreur', `Le prix s\u2019affichera avec une quantité entre 1 et 5${NB}000.`); return; }
    if (q === 'vide') { etat('vide', 'Indiquez une quantité pour voir le prix.'); return; }
    if (state.src === 'humain') { etat('humain', `Laissez votre téléphone ou votre e-mail${NB}: nous vous donnons le prix dans la journée.`); return; }
    if (q === 'serie') { etat('humain', `Au-delà de 5${NB}000 pièces, nous calculons le prix de la série nous-mêmes. Laissez votre téléphone ou votre e-mail${NB}: nous répondons dans la journée.`); return; }
    if (!state.part) { etat('vide', 'Déposez un plan ou prenez une de nos pièces.'); return; }
    const an = analyse(state.part);
    const opts = { matiere: state.matiere, ep: state.ep, finition: state.finition, ral: state.ral };
    const c = chiffrer(an, { ...opts, qte: state.qte });
    const avant = state.etat, hPrix = prixEl.hidden ? 0 : prixEl.offsetHeight;
    etat('prix');
    const ht = Math.round(c.unit * 100) / 100, tot = Math.round(ht * c.qte * 100) / 100;
    versPrix(ht, avant !== 'prix');
    $('[data-ml]').hidden = !c.parMetre; if (c.parMetre) $('[data-ml]').textContent = `${eur(c.parMetre)} HT le mètre linéaire, pour une longueur de ${fmtN(an.ml, 2)}${NB}m`;
    $('[data-fourchette]').textContent = `Le total pour ${fmtN(c.qte, 0)} pièce${c.qte > 1 ? 's' : ''} est de ${eur(tot)} HT, soit ${eur(tot * 1.2)} TTC. Le devis peut s\u2019écarter de ce prix de 10${NB}% au plus.`;
    $('[data-date]').textContent = `${c.qte > 1 ? 'Vos pièces peuvent être prêtes' : 'Votre pièce peut être prête'} le ${fmtDate(dateDispo(c.delai[1], new Date()))}.`;
    $('[data-qlabel]').textContent = `Prix indicatif, ${fmtN(c.qte, 0)} pièce${c.qte > 1 ? 's' : ''}`;
    $('[data-detail]').innerHTML = c.lignes.map((l) => `<tr><td><strong></strong><span></span></td><td class="num">${eur(l.unit)}</td><td class="num">${eur(l.total)}</td></tr>`).join('')
      + `<tr class="tot"><td><strong>Total hors taxes</strong></td><td class="num">${eur(ht)}</td><td class="num">${eur(tot)}</td></tr>`;
    $('[data-detail]').querySelectorAll('tr:not(.tot)').forEach((tr, i) => { tr.querySelector('strong').textContent = c.lignes[i].libelle; tr.querySelector('span').textContent = c.lignes[i].detail; });
    glisserHauteur(prixEl, hPrix); // le total passe parfois de deux lignes à trois : la courbe glisse dessous
    courbe(paliers(an, opts, QTES), c.qte, c.unit, avant !== 'prix');
    dire(`${prefixe ? prefixe + ' ' : ''}Prix indicatif${NB}: ${eur(ht)} HT la pièce, pour ${fmtN(c.qte, 0)} pièce${c.qte > 1 ? 's' : ''}.`);
    onPrix && onPrix({ unit: ht, qte: c.qte, total: tot, pu: eur(ht) });
  }

  // ---------- Courbe : prix à la pièce selon la quantité (une série, abscisse logarithmique) ----------
  // Itération 7 : la courbe ne se redessine plus d'un coup. Quand la quantité, la matière, l'épaisseur ou la finition change,
  // ses points glissent vers leur nouvelle valeur, le repère de la quantité choisie suit la ligne, l'étiquette compte avec le
  // grand prix, et l'axe se remet à l'échelle : les graduations glissent, celles qui sortent s'effacent, celles qui entrent
  // apparaissent (jamais une graduation qui surgit). Même geste et même durée que le prix (PRIX_MS, approche).
  const chart = $('[data-courbe]'), tip = $('[data-tip]');
  const LQ = QTES.map((v) => Math.log10(v));
  const CH = 262, CM = { l: 64, r: 22, t: 44, b: 40 };
  let pts = [];
  let cbVu = null, cbCible = null, cbTw = null, cbW = 0, cbN = null; // l'état affiché, l'état visé, le passage en cours, la largeur dessinée, les nœuds
  new ResizeObserver(() => { if (cbCible) courbe(cbCible.data, cbCible.q, cbCible.pu, true); }).observe(chart.parentElement);
  const pasDe = (ymax) => (ymax > 400 ? 100 : ymax > 200 ? 50 : ymax > 80 ? 20 : ymax > 40 ? 10 : 5);
  // les graduations d'un état au repos : valeur → [opacité du filet, opacité du chiffre] (sur un cadre étroit, un chiffre sur deux)
  const gradDe = (ymax, W) => { const g = new Map(), every = W < 360 ? 2 : 1; let n = 0; for (let v = 0, st = pasDe(ymax); v <= ymax; v += st, n++) g.set(v, [1, n % every ? 0 : 1]); return g; };
  // le prix lu sur la ligne brisée à une abscisse (les segments sont droits à l'écran : interpolation en log de la quantité)
  const surLigne = (units, lq) => { let i = 0; while (i < LQ.length - 2 && lq > LQ[i + 1]) i++; return lerp(units[i], units[i + 1], (lq - LQ[i]) / (LQ[i + 1] - LQ[i])); };
  function courbe(data, q, pu, direct = false) {
    // la courbe se dessine à la largeur réelle de son cadre : son texte reste à 15 px, même sur un téléphone de 320 px
    const W = Math.max(200, Math.round(chart.parentElement.clientWidth) || 560);
    const units = data.map((d) => d.unit), lq = Math.log10(Math.min(Math.max(q, 1), 1000)), ymax = Math.max(...units, pu) * 1.08;
    // le prix de la quantité choisie n'est pas sur la corde entre deux paliers : son écart à la ligne s'interpole avec le reste
    const cible = { data, q, pu, units, lq, ymax, ecart: pu - surLigne(units, lq), grad: gradDe(ymax, W) };
    if (cbTw) { cbTw.stop(); cbTw = null; }
    const de = cbVu; cbCible = cible;
    $('[data-courbe-table]').innerHTML = data.map((d) => `<tr><td>${fmtN(d.q, 0)}</td><td class="num">${eur(d.unit)}</td><td class="num">${eur(d.unit * d.q)}</td></tr>`).join('');
    const poser = () => { cbW = W; cbVu = cible; batir(W, cible, cible.grad); rendre(cible, cible, cible, 1); pts = data.map((d) => ({ ...d, x: cbN.xl(Math.log10(d.q)), y: cbN.ys(d.unit, ymax) })); };
    if (direct || RM || !de || W !== cbW || !chart.parentElement.clientWidth) { poser(); return; }
    // toutes les graduations du départ et de l'arrivée existent pendant le passage : les unes s'effacent, les autres apparaissent
    batir(W, cible, new Map([...de.grad, ...cible.grad]));
    cbTw = glisser(PRIX_MS, (u) => {
      const e = EASE.approche(u), grad = new Map();
      for (const v of cbN.grad.keys()) { const x = de.grad.get(v) || [0, 0], y = cible.grad.get(v) || [0, 0]; grad.set(v, [lerp(x[0], y[0], e), lerp(x[1], y[1], e)]); }
      cbVu = { ...cible, units: units.map((v, i) => lerp(de.units[i], v, e)), lq: lerp(de.lq, lq, e), ymax: lerp(de.ymax, ymax, e), ecart: lerp(de.ecart, cible.ecart, e), pu: lerp(de.pu, pu, e), grad };
      rendre(cbVu, de, cible, e);
    }, () => { cbTw = null; poser(); });
  }
  // pose les nœuds de la courbe une fois par passage (ou par largeur) ; rendre() ne touche ensuite qu'à leurs attributs
  function batir(W, B, grad) {
    const m = CM, xl = (v) => m.l + (v / 3) * (W - m.l - m.r), ys = (v, ymax) => m.t + (1 - v / ymax) * (CH - m.t - m.b);
    let g = '';
    for (const v of grad.keys()) g += `<line data-g="${v}" x1="${m.l}" x2="${W - m.r}" stroke="var(--ou-color-border)" stroke-width="1"/><text data-gt="${v}" x="${m.l - 10}" text-anchor="end" font-size="15" fill="var(--ou-color-text-muted)">${fmtN(v, 0)}${NB}€</text>`;
    for (const t of [1, 10, 100, 1000]) g += `<text x="${xl(Math.log10(t))}" y="${CH - 12}" text-anchor="middle" font-size="15" fill="var(--ou-color-text-muted)">${fmtN(t, 0)}</text>`;
    g += `<path data-ligne fill="none" stroke="var(--ou-color-graphic)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    g += LQ.map((v) => `<circle data-pt cx="${xl(v)}" r="4" fill="var(--ou-color-graphic)" stroke="var(--ou-color-surface)" stroke-width="2"/>`).join('');
    g += `<circle data-repere r="7" fill="var(--ou-color-accent)" stroke="var(--ou-color-graphic)" stroke-width="2.5"/>`;
    g += `<line data-fil y2="26" stroke="var(--ou-color-text)" stroke-width="1"/><text data-etiq y="20" text-anchor="middle" font-size="15" font-weight="650" fill="var(--ou-color-text)"></text>`;
    g += `<line data-cross x1="0" x2="0" y1="${m.t}" y2="${CH - m.b}" stroke="var(--ou-color-text)" stroke-width="1" visibility="hidden"/>`;
    chart.setAttribute('viewBox', `0 0 ${W} ${CH}`);
    chart.style.maxWidth = `${W}px`;
    chart.innerHTML = g;
    // étiquette de la quantité choisie : sa largeur est celle du texte final (elle ne tremble pas pendant que le prix compte)
    const texte = (v) => `${fmtN(B.q, 0)} pièce${B.q > 1 ? 's' : ''}${NB}: ${eur(v)}`;
    const ctx2 = (courbe.c ||= document.createElement('canvas').getContext('2d'));
    ctx2.font = "650 15px 'Mona Sans', sans-serif";
    const q = (sel) => chart.querySelector(sel);
    cbN = { W, xl, ys, grad: new Map([...grad.keys()].map((v) => [v, [q(`[data-g="${v}"]`), q(`[data-gt="${v}"]`)]])), ligne: q('[data-ligne]'), pts: [...chart.querySelectorAll('[data-pt]')],
      repere: q('[data-repere]'), fil: q('[data-fil]'), etiq: q('[data-etiq]'), texte, tw: ctx2.measureText(texte(B.pu)).width };
  }
  // dessine l'état S ; e : l'avancement du passage (1 au repos)
  function rendre(S, A, B, e) {
    const N = cbN, m = CM, W = N.W, ys = (v) => N.ys(v, S.ymax), f2 = (v) => v.toFixed(2);
    for (const [v, [ln, tx]] of N.grad) {
      // une graduation qui entre ou sort par le haut du cadre le fait en fondu, sur les 10 px au-dessus du tracé
      const y = ys(v), haut = Math.min(1, Math.max(0, (y - m.t + 10) / 10)), [o, ol] = S.grad.get(v) || [0, 0];
      ln.setAttribute('y1', f2(y)); ln.setAttribute('y2', f2(y)); ln.setAttribute('opacity', f2(o * haut));
      tx.setAttribute('y', f2(y + 5)); tx.setAttribute('opacity', f2(ol * haut));
    }
    N.ligne.setAttribute('d', S.units.map((v, i) => `${i ? 'L' : 'M'}${N.xl(LQ[i]).toFixed(1)},${ys(v).toFixed(1)}`).join(''));
    N.pts.forEach((c, i) => c.setAttribute('cy', f2(ys(S.units[i]))));
    const qx = N.xl(S.lq), qy = ys(surLigne(S.units, S.lq) + S.ecart);
    N.repere.setAttribute('cx', f2(qx)); N.repere.setAttribute('cy', f2(qy));
    // étiquette : au-dessus du tracé, centrée sur le point autant que la largeur le permet, reliée par un filet
    const lx = Math.min(Math.max(qx, m.l + N.tw / 2), W - m.r - N.tw / 2);
    N.fil.setAttribute('x1', f2(qx)); N.fil.setAttribute('x2', f2(qx)); N.fil.setAttribute('y1', f2(qy - 9));
    N.etiq.setAttribute('x', f2(lx)); N.etiq.textContent = N.texte(Math.round(S.pu * 100) / 100);
  }
  function survol(clientX) {
    const r = chart.getBoundingClientRect(), vb = chart.viewBox.baseVal, x = ((clientX - r.left) / r.width) * vb.width;
    const p = pts.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
    const cross = chart.querySelector('[data-cross]'); cross.setAttribute('x1', p.x); cross.setAttribute('x2', p.x); cross.setAttribute('visibility', 'visible');
    tip.hidden = false; tip.textContent = '';
    const s = document.createElement('strong'); s.textContent = eur(p.unit) + ' la pièce';
    const t = document.createElement('span'); t.textContent = `pour ${fmtN(p.q, 0)} pièce${p.q > 1 ? 's' : ''}, ${eur(p.unit * p.q)} au total`;
    tip.append(s, t);
    tip.style.left = `${(p.x / vb.width) * 100}%`; tip.style.top = `${(p.y / vb.height) * 100}%`;
    return p;
  }
  chart.addEventListener('pointermove', (e) => survol(e.clientX));
  chart.addEventListener('pointerleave', () => { tip.hidden = true; const c = chart.querySelector('[data-cross]'); c && c.setAttribute('visibility', 'hidden'); });
  chart.addEventListener('click', (e) => { const p = survol(e.clientX); qte.value = p.q; calcul(); });

  // ---------- Demande de devis (démonstration : rien n'est envoyé) ----------
  const form = $('[data-form]'), envoi = form.querySelector('button[type="submit"]'), ok = $('[data-envoye]');
  $('[data-ouvrir]').addEventListener('click', () => { form.hidden = false; $('[data-ouvrir]').hidden = true; ok.hidden = true; form.querySelector('input').focus(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (envoi.getAttribute('aria-busy') === 'true') return;
    const contact = form.querySelector('[name="contact"]'), err = form.querySelector('[data-err]'), v = contact.value.trim();
    const bon = /@.+\./.test(v) || v.replace(/\D/g, '').length >= 10;
    if (!bon) {
      err.querySelector('span').textContent = v ? 'Ce téléphone ou cet e-mail semble incomplet. Vérifiez-le.' : 'Indiquez un téléphone ou un e-mail pour que nous puissions vous répondre.';
      contact.setAttribute('aria-invalid', 'true'); err.hidden = false; contact.focus(); return;
    }
    contact.removeAttribute('aria-invalid'); err.hidden = true;
    envoi.setAttribute('aria-busy', 'true'); envoi.disabled = true; const lab = envoi.textContent; envoi.textContent = 'Envoi…';
    await wait(MOTION.presse.appui.ms);
    envoi.removeAttribute('aria-busy'); envoi.disabled = false; envoi.textContent = lab;
    const n = 'D-2026-' + String(410 + Math.floor((Date.now() / 1000) % 90)).padStart(4, '0');
    const quoi = state.etat === 'prix' ? 'le devis' : 'le prix';
    ok.hidden = false;
    ok.querySelector('p').textContent = `Demande ${n} enregistrée${state.fileName ? `, avec ${state.fileName}` : ''}. L\u2019atelier vous répondrait dans la journée avec ${quoi}. Ce site est une démonstration${NB}: rien n\u2019a été envoyé.`;
    form.hidden = true; ok.focus();
  });

  // ---------- État initial ----------
  majEpaisseurs();
  choisir(0);
  return {
    choisir, lire,
    setRal(code) { state.finition = 'ral'; root.querySelector('input[name="ou-fin"][value="ral"]').checked = true; $('[data-ral-wrap]').hidden = false; state.ral = code; ralSel.value = code; calcul(); peindre(); },
    get part() { return state.part; }, get fichier() { return state.file; }, get etat() { return state.etat; },
    get scene() { return stage; }, // la scène en cours (banc d'essai : seek, états)
  };
}
