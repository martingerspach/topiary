// Ourlet · outil de pré-chiffrage : déposer un plan (DXF) ou choisir une pièce, régler matière, épaisseur, quantité, finition,
// voir la pièce se plier et lire un prix indicatif, avec la courbe des prix par quantité et le détail du calcul.
// Rien ne quitte le navigateur : le plan est lu sur place. Entreprise fictive : prix inventés.
// États de la carte du prix : prix (succès), vide (pas de quantité), chargement (plan en lecture), erreur (plan illisible,
// quantité hors limites), humain (fichier lu par l'atelier : DWG, STEP, PDF, croquis, photo ; série de plus de 5 000 pièces). Chaque changement est
// annoncé aux lecteurs d'écran par une phrase courte, une fois la saisie posée.
import { CATALOGUE } from './pieces.js';
import { autoCam, flatSVG, partView, hex } from './part.js';
import { mountDeveloppe } from './developpe-v6.js';
import { dxfToPart } from './dxf.js';
import { analyse, chiffrer, paliers, MATIERES, STOCK, dateDispo, fmtDate, eur, fmtN } from './chiffrage.js';
import { TOKENS, ILLU, MOTION, P } from '../tokens/tokens-v2.js';
// la vue de la pièce : la même gravure que le premier écran et le film (une seule langue d'illustration sur la page)
const PAPIER = { fond: P['creme-50'], traitFond: P['creme-50'], trait0: P['taupe-500'], trait1: P.encre };
import { EASE, onceVisible } from './motion.js';

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

  // ---------- Annonces (une phrase courte, une fois la saisie posée) ----------
  const annonce = $('[data-annonce]');
  let annT = 0;
  const dire = (txt, now = false) => { clearTimeout(annT); const go = () => { annonce.textContent = ''; requestAnimationFrame(() => { annonce.textContent = txt; }); }; if (now) go(); else annT = setTimeout(go, 700); };

  // ---------- Pièces d'exemple ----------
  const vignette = (p, r) => { const v = partView(p, { cam: autoCam(p), size: 100, color: hex(r.value), ink: hex(ILLU['trait-piece']), outline: 0.5, amb: 0.42, lift: 0.12, pad: 0.08 }); return `<svg viewBox="${v.viewBox}" aria-hidden="true">${v.inner}</svg>`; };
  const exBtn = (i) => { const c = CATALOGUE[i], p = c.fn(); return `<button type="button" class="ex" data-i="${i}" aria-pressed="${i === 0}"><span class="ex-pic">${vignette(p, ralOf(c.ral))}</span><span class="ex-txt"><strong>${p.name}</strong><span>${c.secteur}</span></span></button>`; };
  $('[data-exemples]').innerHTML = GROUPES.map(([titre, idx], g) => `<div class="ex-grp" role="group" aria-labelledby="ex-g${g}"><span class="ex-titre" id="ex-g${g}">${titre}</span><div class="ex-list">${idx.map(exBtn).join('')}</div></div>`).join('');
  $('[data-exemples]').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) choisir(+b.dataset.i); });

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
      $('[data-exemples]').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      afficherPiece();
    } catch (err) {
      statut([['err', err.message]]);
      etat('erreur', `Nous n\u2019avons pas pu lire ${f.name}. Envoyez-le tel quel, nous le regardons dans la journée.`);
      viewer.setAttribute('data-stale', '');
    }
  }

  // ---------- Matière, épaisseur, quantité, finition ----------
  root.querySelectorAll('input[name="ou-mat"]').forEach((r) => r.addEventListener('change', () => { state.matiere = r.value; majEpaisseurs(); calcul(); peindre(); }));
  function majEpaisseurs() {
    const list = MATIERES[state.matiere].ep.filter((e) => e <= 8);
    if (!list.includes(state.ep)) state.ep = list.reduce((a, b) => (Math.abs(b - state.ep) < Math.abs(a - state.ep) ? b : a));
    $('[data-ep]').innerHTML = `<legend class="ou-label">Épaisseur, en mm</legend>` + list.map((e) => `<label><input type="radio" name="ou-ep" value="${e}"${e === state.ep ? ' checked' : ''}><span>${fmtN(e)}</span></label>`).join('');
    $('[data-ep]').querySelectorAll('input').forEach((r) => r.addEventListener('change', () => { state.ep = +r.value; if (state.part) { state.part.t = state.ep; afficherPiece(false); } calcul(); }));
  }
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
  root.querySelectorAll('input[name="ou-fin"]').forEach((r) => r.addEventListener('change', () => { state.finition = r.value; $('[data-ral-wrap]').hidden = r.value !== 'ral'; calcul(); peindre(); }));
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
  function montrer(v) {
    root.querySelector(`input[name="ou-vue"][value="${v}"]`).checked = true;
    plan.hidden = v !== 'plat'; canvas.hidden = v === 'plat';
    if (v === 'plat') dessinerPlat();
    if (v !== 'plat' && stage) stage.redraw();
  }
  // la vue à plat : dessinée à l'échelle réelle de son cadre (deux passes), cotes et libellés de pli à 15 px au moins
  function dessinerPlat() {
    if (plan.hidden || !state.part) return;
    const p = state.part, an = analyse(p), rot = an.h > an.w * 1.15;
    const cs = getComputedStyle(plan), bw = plan.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), bh = plan.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (bw <= 0 || bh <= 0) return;
    const M = Math.max(an.w, an.h);
    const make = (fs) => flatSVG(p, { ink: ILLU['texte-brut'], font: "'Mona Sans', sans-serif", fs, thin: 1, thick: 2, px: true, axe: '14 3 2 3', pad: Math.max(26, fs * 2.6) });
    const scale = (f) => (rot ? Math.min(bw / f.h, bh / f.w) : Math.min(bw / f.w, bh / f.h));
    let f = make(Math.max(8, M / 24));
    for (let k = 0; k < 3; k++) f = make(15.4 / 0.86 / scale(f));
    plan.innerHTML = rot
      ? `<svg viewBox="0 0 ${f.h} ${f.w}" role="img" aria-label="Développé coté, ${fmtN(an.w, 0)} par ${fmtN(an.h, 0)} mm"><g transform="translate(${f.h},0) rotate(90)">${f.svg}</g></svg>`
      : `<svg viewBox="0 0 ${f.w} ${f.h}" role="img" aria-label="Développé coté, ${fmtN(an.w, 0)} par ${fmtN(an.h, 0)} mm">${f.svg}</svg>`;
  }
  new ResizeObserver(() => dessinerPlat()).observe(plan);
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

  function afficherPiece(replay = true) {
    const p = state.part; p.t = state.ep;
    viewer.removeAttribute('data-stale');
    const an = analyse(p);
    // la gamme de la pièce si elle en a une (profils : de l'extérieur vers l'intérieur) ; sinon l'ourlet d'abord, comme en atelier
    const order = p.gamme || p.bends.map((b, k) => k).sort((a, b) => Math.abs(p.bends[b].angle) - Math.abs(p.bends[a].angle));
    const cam = autoCam(p);
    const c = couleurs();
    if (stage) { stage.destroy(); canvas.textContent = ''; }
    // la pièce se plie quand on la regarde : à la première arrivée sur l'outil, puis à chaque nouvelle pièce
    etatPli(false);
    stage = mountDeveloppe(canvas, p, { order, couleurs: PAPIER, teinte: state.finition === 'ral' ? ralOf(state.ral).value : null, oriente: true, cotes: false, pad: 0.08, autoplay: replay && seen,
      onFrame: ({ phase }) => { if (phase === 'fin' && rbtn.dataset.on) etatPli(false); } });
    if (stage.playing) etatPli(true);
    else if (!(replay && !seen)) stage.seek(stage.T.end);
    dessinerPlat();
    $('[data-nom]').textContent = state.src === 'dxf' ? state.fileName : `${p.name}, réf. ${p.ref}`;
    peindre();
    // Lecture du plan et points d'attention
    const msgs = [['ok', `${state.src === 'dxf' ? 'Nous avons lu votre plan. ' : ''}La pièce mesure ${fmtN(an.w, 0)}${NB}×${NB}${fmtN(an.h, 0)}${NB}mm à plat, ${an.plis || an.ourlets ? `avec ${[an.plis && `${an.plis} pli${an.plis > 1 ? 's' : ''}`, an.ourlets && `${an.ourlets} ourlet${an.ourlets > 1 ? 's' : ''}`].filter(Boolean).join(' et ')}` : 'sans pli'}.`]];
    const petits = (p.holes || []).filter((h) => h.meta && h.meta.type === 'circle' && h.meta.d < state.ep);
    if (petits.length) msgs.push(['warn', `${petits.length} trou${petits.length > 1 ? 's sont' : ' est'} plus petit${petits.length > 1 ? 's' : ''} que l\u2019épaisseur de la tôle. Nous ${petits.length > 1 ? 'les' : 'le'} percerons au foret.`]);
    if (p.source && p.source.plisIgnores) msgs.push(['warn', `${p.source.plisIgnores} ligne${p.source.plisIgnores > 1 ? 's' : ''} de pli ne traverse${p.source.plisIgnores > 1 ? 'nt' : ''} pas la pièce. Nous ${p.source.plisIgnores > 1 ? 'les' : 'la'} vérifierons.`]);
    if (state.src === 'dxf' && !an.plis && !an.ourlets) msgs.push(['warn', 'Nous ne trouvons aucune ligne de pli. Mettez les lignes de pli sur un calque nommé PLI (PLI_120 pour un angle de 120°), ou indiquez-nous les angles.']);
    statut(msgs);
    montrer('plie');
    calcul(state.src === 'dxf' ? msgs[0][1] : null);
    onPart && onPart(p);
  }
  // la première fois, la pièce se plie quand l'acheteur s'arrête sur l'outil : il la voit, et le défilement reste fluide
  const auRepos = (fn) => { let tm = 0; const go = () => { clearTimeout(tm); tm = setTimeout(() => { removeEventListener('scroll', go); fn(); }, MOTION.presse.maintien.ms); }; addEventListener('scroll', go, { passive: true }); go(); };
  onceVisible(viewer, () => auRepos(() => { seen = true; if (stage && !stage.playing) { stage.play(); etatPli(stage.playing); } }), { threshold: 0.4 });

  function statut(list) {
    $('[data-statut]').innerHTML = list.map(([k]) => `<p class="ou-status ${k}">${ICON[k]}<span></span></p>`).join('');
    $('[data-statut]').querySelectorAll('span').forEach((s, i) => { s.textContent = list[i][1]; });
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
    etat('prix');
    const ht = Math.round(c.unit * 100) / 100, tot = Math.round(ht * c.qte * 100) / 100;
    $('[data-pu]').textContent = eur(ht);
    $('[data-ttc]').textContent = `soit ${eur(ht * 1.2)} TTC`;
    $('[data-ml]').hidden = !c.parMetre; if (c.parMetre) $('[data-ml]').textContent = `${eur(c.parMetre)} HT le mètre linéaire, pour une longueur de ${fmtN(an.ml, 2)}${NB}m`;
    $('[data-fourchette]').textContent = `Le total pour ${fmtN(c.qte, 0)} pièce${c.qte > 1 ? 's' : ''} est de ${eur(tot)} HT, soit ${eur(tot * 1.2)} TTC. Le devis peut s\u2019écarter de ce prix de 10${NB}% au plus.`;
    $('[data-date]').textContent = `${c.qte > 1 ? 'Vos pièces peuvent être prêtes' : 'Votre pièce peut être prête'} le ${fmtDate(dateDispo(c.delai[1], new Date()))}.`;
    $('[data-qlabel]').textContent = `Prix indicatif, ${fmtN(c.qte, 0)} pièce${c.qte > 1 ? 's' : ''}`;
    $('[data-detail]').innerHTML = c.lignes.map((l) => `<tr><td><strong></strong><span></span></td><td class="num">${eur(l.unit)}</td><td class="num">${eur(l.total)}</td></tr>`).join('')
      + `<tr class="tot"><td><strong>Total hors taxes</strong></td><td class="num">${eur(ht)}</td><td class="num">${eur(tot)}</td></tr>`;
    $('[data-detail]').querySelectorAll('tr:not(.tot)').forEach((tr, i) => { tr.querySelector('strong').textContent = c.lignes[i].libelle; tr.querySelector('span').textContent = c.lignes[i].detail; });
    courbe(paliers(an, opts, QTES), c.qte, c.unit);
    dire(`${prefixe ? prefixe + ' ' : ''}Prix indicatif${NB}: ${eur(ht)} HT la pièce, pour ${fmtN(c.qte, 0)} pièce${c.qte > 1 ? 's' : ''}.`);
    onPrix && onPrix({ unit: ht, qte: c.qte, total: tot, pu: eur(ht) });
  }

  // ---------- Courbe : prix à la pièce selon la quantité (une série, abscisse logarithmique) ----------
  const chart = $('[data-courbe]'), tip = $('[data-tip]');
  let pts = [];
  let derniere = null;
  new ResizeObserver(() => { if (derniere) courbe(...derniere); }).observe(chart.parentElement);
  function courbe(data, q, pu) {
    derniere = [data, q, pu];
    // la courbe se dessine à la largeur réelle de son cadre : son texte reste à 15 px, même sur un téléphone de 320 px
    const W = Math.max(200, Math.round(chart.parentElement.clientWidth) || 560), H = 262, m = { l: 64, r: 22, t: 44, b: 40 };
    const xs = (v) => m.l + ((Math.log10(v) - 0) / 3) * (W - m.l - m.r);
    const ymax = Math.max(...data.map((d) => d.unit), pu) * 1.08;
    const ys = (v) => m.t + (1 - v / ymax) * (H - m.t - m.b);
    const step = ymax > 400 ? 100 : ymax > 200 ? 50 : ymax > 80 ? 20 : ymax > 40 ? 10 : 5;
    const every = W < 360 ? 2 : 1; // sur un cadre étroit, une graduation sur deux
    let g = '';
    let n = 0;
    for (let v = 0; v <= ymax; v += step, n++) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--ou-color-border)" stroke-width="1"/>` + (n % every ? '' : `<text x="${m.l - 10}" y="${ys(v) + 5}" text-anchor="end" font-size="15" fill="var(--ou-color-text-muted)">${fmtN(v, 0)}${NB}€</text>`);
    for (const t of [1, 10, 100, 1000]) g += `<text x="${xs(t)}" y="${H - 12}" text-anchor="middle" font-size="15" fill="var(--ou-color-text-muted)">${fmtN(t, 0)}</text>`;
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${xs(d.q).toFixed(1)},${ys(d.unit).toFixed(1)}`).join('');
    g += `<path d="${line}" fill="none" stroke="var(--ou-color-graphic)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    g += data.map((d) => `<circle cx="${xs(d.q)}" cy="${ys(d.unit)}" r="4" fill="var(--ou-color-graphic)" stroke="var(--ou-color-surface)" stroke-width="2"/>`).join('');
    const qx = xs(Math.min(Math.max(q, 1), 1000)), qy = ys(pu);
    g += `<circle cx="${qx}" cy="${qy}" r="7" fill="var(--ou-color-accent)" stroke="var(--ou-color-graphic)" stroke-width="2.5"/>`;
    // étiquette de la quantité choisie : au-dessus du tracé, centrée sur le point autant que la largeur le permet, reliée par un filet
    const lbl = `${fmtN(q, 0)} pièce${q > 1 ? 's' : ''}${NB}: ${eur(pu)}`;
    const ctx2 = (courbe.c ||= document.createElement('canvas').getContext('2d'));
    ctx2.font = "650 15px 'Mona Sans', sans-serif";
    const tw = ctx2.measureText(lbl).width;
    const lx = Math.min(Math.max(qx, m.l + tw / 2), W - m.r - tw / 2);
    g += `<line x1="${qx}" y1="${qy - 9}" x2="${qx}" y2="26" stroke="var(--ou-color-text)" stroke-width="1"/><text x="${lx}" y="20" text-anchor="middle" font-size="15" font-weight="650" fill="var(--ou-color-text)">${lbl}</text>`;
    g += `<line data-cross x1="0" x2="0" y1="${m.t}" y2="${H - m.b}" stroke="var(--ou-color-text)" stroke-width="1" visibility="hidden"/>`;
    chart.setAttribute('viewBox', `0 0 ${W} ${H}`);
    chart.style.maxWidth = `${W}px`;
    chart.innerHTML = g;
    pts = data.map((d) => ({ ...d, x: xs(d.q), y: ys(d.unit) }));
    $('[data-courbe-table]').innerHTML = data.map((d) => `<tr><td>${fmtN(d.q, 0)}</td><td class="num">${eur(d.unit)}</td><td class="num">${eur(d.unit * d.q)}</td></tr>`).join('');
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
  };
}
