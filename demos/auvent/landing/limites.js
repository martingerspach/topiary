/* Auvent · « C'est vous qui fixez les limites » : la fonction, jouable (script classique ; requiert scenario.js,
   expose window.Auvent.limites pour les vérifications).
   Une question, une réponse : « avec cette limite, quels jours la tâche s'arrête-t-elle ? »
   - On choisit une tâche (nacelle, grue à tour, coulage) et l'on règle sa limite au curseur : le seul réglage.
   - La semaine du chantier des Bateliers, à Nantes (celui du bulletin et du téléphone plus haut), se lit jour par jour :
     une carte par jour, avec la prévision de 7 h à 17 h, la limite en tirets, ce qui la dépasse hachuré, et un verdict
     écrit (« Possible », ou « Arrêt » et ses heures). Les jours d'arrêt sont teintés : la semaine se lit d'un coup d'œil.
   - Une phrase dit le résultat en clair. La v17 montrait une courbe continue sans axe ni verdict : on ne comprenait pas.
   - Données : celles de la page (scenario.js) ; limites habituelles de S.TYPES (nacelle 45 km/h, grue 72 km/h, coulage
     1 mm/h de pluie). Le froid ne joue pas cette semaine à Nantes : le coulage se règle sur la pluie, comme le bulletin.
   - Mouvement : la limite glisse avec le curseur (transform), la hachure suit (un attribut de clip), les cartes changent
     d'état en fondu ; au changement de tâche, les courbes se transforment (540 ms, sans dépassement) ; une entrée, une
     fois. En mouvements réduits, tout est posé.
   - Lecteur d'écran : le curseur dit sa valeur en clair, chaque jour a son verdict en texte, la phrase est annoncée une
     fois le geste fini.
   Paramètres de revue : ?rm=1 ou ?fige=1 (rien ne bouge), ?tache=grue|nacelle|coulage, ?limite=55. */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const S = A.scenario;
  if (!S) return;
  const NB = ' ';
  const q = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
  const reduit = () => q.has('rm') || q.has('fige') || matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Données : la semaine des Bateliers, heures de chantier ----------
  const serie = S.meteo('bateliers', 0).serie;
  const H0 = S.DEBUT, H1 = S.FIN;                                  // 7 h et 17 h : l'heure h couvre h à h + 1
  const NH = H1 - H0, NJ = S.JOURS.length;                         // dix heures, de mardi à vendredi
  const valeur = (g, j, h) => serie[S.tDe(j, h)][g];

  const virgule = (v, d) => v.toFixed(d).replace('.', ',');
  const GRANDEURS = {
    rafales: { unite: 'km/h', d: 0, courbe: `Vent prévu de ${H0}${NB}h à ${H1}${NB}h, en km/h`, plancher: 20,
      clair: (v) => `${v} kilomètres par heure` },
    pluie: { unite: 'mm/h', d: 1, courbe: `Pluie prévue de ${H0}${NB}h à ${H1}${NB}h, en mm/h`, plancher: 0,
      clair: (v) => `${virgule(v, Number.isInteger(v) ? 0 : 1)} millimètre${v >= 2 ? 's' : ''} de pluie par heure` },
  };
  const seuilDe = (type, g, i = 0) => S.TYPES[type].seuils.filter((s) => s.g === g)[i].max;
  // Les tâches : grandeur, plage du curseur (ce qu'une entreprise règle réellement), limite habituelle, phrases
  const TACHES = {
    nacelle: { g: 'rafales', min: 30, max: 60, pas: 1, habituelle: seuilDe('nacelle', 'rafales'), etiquette: 'Vent maximal pour la nacelle',
      libre: 'La nacelle ne s’arrête pas de la semaine.',
      arret: (quand) => `La nacelle reste au sol ${quand}.` },
    grue: { g: 'rafales', min: 40, max: 80, pas: 1, habituelle: seuilDe('levage', 'rafales', 1), etiquette: 'Vent maximal pour la grue',
      libre: 'La grue ne s’arrête pas de la semaine.',
      arret: (quand, entiers) => (entiers ? `La grue reste à l’arrêt ${quand}.` : `La grue s’arrête ${quand}.`) },
    coulage: { g: 'pluie', min: 0.5, max: 3, pas: 0.1, habituelle: seuilDe('coulage', 'pluie'), etiquette: 'Pluie maximale pour couler',
      libre: 'Vous pouvez couler toute la semaine.',
      arret: (quand) => `Vous ne pouvez pas couler ${quand}.` },
  };
  const texteValeur = (id, v) => { const G = GRANDEURS[TACHES[id].g]; return `${virgule(v, Number.isInteger(v) ? 0 : G.d)}${NB}${G.unite}`; };
  const crans = (id) => { const T = TACHES[id], n = Math.round((T.max - T.min) / T.pas); return Array.from({ length: n + 1 }, (_, k) => +(T.min + k * T.pas).toFixed(2)); };

  // ---------- Le calcul : les heures qui dépassent, la phrase, le verdict de chaque jour ----------
  // Une heure bloque si la valeur prévue dépasse la limite (strictement, comme depasse() de scenario.js).
  function arrets(id, limite) {
    const T = TACHES[id], out = [];
    for (let j = 0; j < NJ; j++) {
      const plages = []; let debut = null;
      for (let h = H0; h < H1; h++) {
        const x = valeur(T.g, j, h) > limite;
        if (x && debut === null) debut = h;
        if (!x && debut !== null) { plages.push([debut, h]); debut = null; }
      }
      if (debut !== null) plages.push([debut, H1]);
      if (plages.length) out.push({ j, plages, entier: plages.length === 1 && plages[0][0] === H0 && plages[0][1] === H1 });
    }
    return out;
  }
  const liste = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1]);
  const plage = ([a, b]) => `de ${a}${NB}h à ${b}${NB}h`;
  function phrase(id, limite) {
    const T = TACHES[id], a = arrets(id, limite);
    if (!a.length) return T.libre;
    const entiers = a.every((x) => x.entier);
    const quand = entiers
      ? `${liste(a.map((x) => S.JOURS[x.j].nom))} toute la journée`
      : liste(a.map((x) => `${S.JOURS[x.j].nom} ${x.entier ? 'toute la journée' : x.plages.map(plage).join(' et ')}`));
    return T.arret(quand, entiers);
  }
  // Le verdict d'un jour : ce qu'on lit dans sa carte (heures en long et en court) et ce que dit le lecteur d'écran
  function verdict(id, limite, j) {
    const a = arrets(id, limite).find((x) => x.j === j);
    if (!a) return { arret: false, cle: '', lu: `${S.JOURS[j].long}${NB}: possible` };
    return { arret: true, cle: a.plages.join('|'), plages: a.plages,
      lu: `${S.JOURS[j].long}${NB}: arrêt ${a.entier ? 'toute la journée' : a.plages.map(plage).join(' et ')}` };
  }
  // Description du graphique pour le lecteur d'écran : le plus fort de chaque jour
  function decrire(g) {
    const G = GRANDEURS[g];
    const jours = S.JOURS.map((J, j) => {
      let m = -Infinity, hm = H0;
      for (let h = H0; h < H1; h++) { const v = valeur(g, j, h); if (v > m) { m = v; hm = h; } }
      if (g === 'pluie' && m < 0.05) return `${J.nom} sans pluie`;
      return `${J.nom} jusqu’à ${virgule(m, G.d)}${NB}${G.unite} vers ${hm}${NB}h`;
    });
    return `${G.courbe}, aux Bateliers à Nantes${NB}: ${liste(jours)}.`;
  }

  A.limites = { TACHES, GRANDEURS, arrets, phrase, verdict, decrire, texteValeur, crans, H0, H1 };

  // ---------- La page ----------
  if (typeof document === 'undefined') return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $('#lim-app'); if (!app) return;
  const radios = $$('input[name="lim-tache"]');
  const curseur = $('#lim-curseur'), piste = $('.lim-piste'), zone = $('#lim-zone'), semaine = $('#lim-semaine');
  const resultat = $('#lim-resultat'), annonce = $('#lim-annonce'), retablir = $('#lim-retablir');
  const etiquette = $('#lim-etiquette'), sortie = $('#lim-valeur'), habituelle = $('#lim-habituelle');
  const borneMin = $('#lim-min'), borneMax = $('#lim-max'), cleCourbe = $('#lim-cle-courbe');
  const valeurs = {};                                              // la limite réglée de chaque tâche
  for (const id in TACHES) valeurs[id] = TACHES[id].habituelle;
  let tache = TACHES[q.get('tache')] ? q.get('tache') : 'nacelle';
  if (q.has('limite')) { const T = TACHES[tache], v = +q.get('limite'); if (isFinite(v)) valeurs[tache] = +(Math.round(Math.min(T.max, Math.max(T.min, v)) / T.pas) * T.pas).toFixed(2); }

  // ---------- La semaine : une carte par jour (nom, tracé, verdict) ----------
  semaine.innerHTML = S.JOURS.map((J, j) => `<li class="lim-jour" data-j="${j}"><span class="sr"></span>
    <div aria-hidden="true"><p class="lim-jour-nom"><span class="lim-long">${J.court.replace(' ', NB)}</span><span class="lim-court">${J.court.split(' ')[0]}</span><span class="lim-max"></span></p>
    <div class="lim-trace"></div><p class="lim-heures"><span>${H0}${NB}h</span><span>${H1}${NB}h</span></p><p class="lim-verdict"></p></div></li>`).join('');
  const cartes = $$('.lim-jour', semaine).map((li) => ({ li, lu: $('.sr', li), v: $('.lim-verdict', li), trace: $('.lim-trace', li), max: $('.lim-max', li), cle: null }));
  // la case du verdict garde la hauteur du plus long (« Arrêt » et le plus grand nombre de plages) : rien ne saute
  let lignes = 2;
  for (const id in TACHES) for (const v of crans(id)) for (const a of arrets(id, v)) lignes = Math.max(lignes, 1 + a.plages.length);
  semaine.style.setProperty('--lim-lignes', lignes);
  zone.insertAdjacentHTML('beforeend', '<svg class="lim-svg" aria-hidden="true" focusable="false"></svg>');
  // le sommet de chaque jour (valeur la plus forte et son heure) : annoté sur la courbe
  function sommets(id) {
    const T = TACHES[id], out = [];
    for (let j = 0; j < NJ; j++) { let m = -Infinity, k = 0; for (let h = 0; h < NH; h++) { const v = valeur(T.g, j, H0 + h); if (v > m) { m = v; k = h; } } out.push({ v: m, k }); }
    return out;
  }

  // ---------- Le tracé : une courbe monotone par jour, l'aire dessous, ce qui dépasse hachuré ----------
  // Un seul SVG posé sur la rangée des quatre tracés (même échelle pour les quatre jours : la limite est une seule
  // ligne). Ce qui dépasse la limite est la même aire, découpée par un rectangle de clip dont seule la hauteur change
  // pendant le geste ; la ligne bouge par transform. L'échelle suit la tâche : son plancher, et sa plage × 1,1.
  const echelle = (id) => TACHES[id].max * 1.1;
  const plancher = (id) => GRANDEURS[TACHES[id].g].plancher;
  const serieDe = (id) => { const out = []; for (let j = 0; j < NJ; j++) for (let h = H0; h < H1; h++) out.push(valeur(TACHES[id].g, j, h)); return out; };
  const vu = { vals: serieDe(tache), vmax: echelle(tache), vmin: plancher(tache), lim: valeurs[tache] };    // l'état dessiné (interpolé)
  let geo = null, els = null;
  // Courbe monotone de Fritsch et Carlson : passe par chaque point, sans bosse inventée
  function monotone(P) {
    const n = P.length, d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    const f = (v) => v.toFixed(2);
    let s = '';
    for (let i = 0; i < n - 1; i++) {
      const h = (P[i + 1][0] - P[i][0]) / 3;
      s += `C${f(P[i][0] + h)} ${f(P[i][1] + m[i] * h)} ${f(P[i + 1][0] - h)} ${f(P[i + 1][1] - m[i + 1] * h)} ${f(P[i + 1][0])} ${f(P[i + 1][1])}`;
    }
    return s;
  }
  const yDe = (v) => geo.base - (Math.max(0, v - vu.vmin) / (vu.vmax - vu.vmin)) * (geo.base - geo.haut);
  function dessiner() {
    const Z = zone.getBoundingClientRect();
    if (!Z.width) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const net = (v) => Math.round(v * dpr) / dpr, f = (v) => (+v.toFixed(2)).toString();
    const t0 = cartes[0].trace.getBoundingClientRect();
    const W = Z.width, H = t0.height, top = net(t0.top - Z.top);
    geo = { W, H, top, base: H - 1, haut: 8, net, xs: cartes.map((c) => { const r = c.trace.getBoundingClientRect(); return [net(r.left - Z.left), net(r.width)]; }) };
    const svg = $('.lim-svg', zone);
    svg.style.top = top + 'px'; svg.style.height = H + 'px';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // repères d'heures sous la base (7 h, midi, 17 h), limite en tirets dans chaque carte, sommet annoté
    let reperes = '', limites = '', aires = '', notes = '';
    geo.xs.forEach(([x0, w], j) => {
      for (const h of [H0, 12, H1]) { const x = net(x0 + ((h - H0) / NH) * w) + (h === H1 ? -0.5 : 0.5) / dpr; reperes += `M${f(x)} ${H}v4`; }
      limites += `<line x1="${f(x0)}" x2="${f(x0 + w)}" y1="0" y2="0"/>`;
      aires += `<path class="lim-aire"/>`;
      notes += `<g class="lim-sommet" data-j="${j}"><text text-anchor="middle"></text><circle r="3"/></g>`;
    });
    svg.innerHTML = `<defs>
        <linearGradient id="lim-aire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCE6FA" stop-opacity=".3"/><stop offset=".65" stop-color="#DCE6FA" stop-opacity=".07"/><stop offset="1" stop-color="#DCE6FA" stop-opacity="0"/></linearGradient>
        <pattern id="lim-hachure" patternUnits="userSpaceOnUse" width="5" height="10" patternTransform="rotate(-19.5)"><rect width="5" height="10" fill="rgb(127 166 255 / 0.2)"/><line x1="1" y1="0" x2="1" y2="10" stroke="#A9C1FF" stroke-width="1.1"/></pattern>
        <clipPath id="lim-clip" clipPathUnits="userSpaceOnUse"><rect id="lim-clip-r" x="0" y="-2000" width="${W}" height="2000"/></clipPath>
      </defs>
      ${aires}<path class="lim-hach" clip-path="url(#lim-clip)"/>
      <path class="lim-courbe"/><path class="lim-courbe lim-courbe--haut" clip-path="url(#lim-clip)"/>
      <g class="lim-limites">${limites}</g><path class="lim-reperes" d="${reperes}"/>${notes}`;
    els = { aires: $$('.lim-aire', svg), hach: $('.lim-hach', svg), courbes: $$('.lim-courbe', svg), clip: $('#lim-clip-r', svg), limites: $('.lim-limites', svg),
      notes: $$('.lim-sommet', svg).map((g) => ({ g, t: $('text', g), c: $('circle', g), l: 0, y: 0, dy: 0 })) };
    noter(); tracer(); poserLimite();
  }
  // Le texte des sommets (avec l'unité quand la carte est assez large) et leur largeur, mesurée une fois
  let pics = sommets(tache);
  function noter() {
    if (!geo) return;
    const T = TACHES[tache], G = GRANDEURS[T.g];
    pics = sommets(tache);
    els.notes.forEach((n, j) => {
      const large = geo.xs[j][1] >= 104, r = +pics[j].v.toFixed(G.d), nombre = Number.isInteger(r) ? String(r) : virgule(r, G.d);
      // un jour sans pluie : pas de sommet à montrer, on le dit (au centre de la carte, sans point)
      pics[j].nul = T.g === 'pluie' && r === 0;
      n.t.textContent = pics[j].nul ? (large ? 'Pas de pluie' : '0') : large ? `${nombre}${NB}${G.unite}` : nombre;
      n.g.classList.toggle('nul', pics[j].nul);
      n.l = n.t.getComputedTextLength();
      cartes[j].max.textContent = nombre;                        // cartes étroites : la valeur passe dans l'en-tête
    });
    // cartes étroites (téléphone) : le tracé est trop bas pour porter les valeurs sans toucher le trait de limite
    zone.classList.toggle('etroit', geo.xs[0][1] < 104);
    marquer();
  }
  // un sommet au-dessus de la limite passe au bleu du signal ; son liseré prend le fond de sa carte (teintée ou non)
  function marquer() {
    if (!els) return;
    els.notes.forEach((n, j) => { n.g.classList.toggle('haut', pics[j].v > valeurs[tache]); n.g.classList.toggle('teinte', cartes[j].li.classList.contains('arret')); });
  }
  // Les chemins des courbes et des aires, et la place des sommets, à partir de vu.vals et de l'échelle
  function tracer() {
    if (!geo) return;
    const f = (v) => v.toFixed(2), base = geo.base;
    let c = '', h = '';
    for (let j = 0; j < NJ; j++) {
      const [x0, w] = geo.xs[j], pas = w / NH, P = [];
      for (let k = 0; k < NH; k++) P.push([x0 + (k + 0.5) * pas, yDe(vu.vals[j * NH + k])]);
      const pic = P[pics[j].k];
      P.unshift([x0, P[0][1]]); P.push([x0 + w, P[P.length - 1][1]]);          // les bords du jour, à plat
      const corps = monotone(P), a = `M${f(x0)} ${f(base)}L${f(x0)} ${f(P[0][1])}${corps}L${f(x0 + w)} ${f(base)}Z`;
      c += `M${f(P[0][0])} ${f(P[0][1])}${corps}`; h += a;
      els.aires[j].setAttribute('d', a);
      // le sommet : un point sur la courbe, sa valeur au-dessus, gardée dans la carte
      const n = els.notes[j], tx = pics[j].nul ? x0 + w / 2 : Math.min(x0 + w - n.l / 2 - 1, Math.max(x0 + n.l / 2 + 1, pic[0]));
      n.c.setAttribute('cx', f(pic[0])); n.c.setAttribute('cy', f(pic[1]));
      n.t.setAttribute('x', f(tx)); n.t.setAttribute('y', f(pic[1] - 11)); n.y = pic[1];
    }
    els.hach.setAttribute('d', h);
    els.courbes.forEach((p) => p.setAttribute('d', c));
  }
  // La limite : ses quatre traits et le rectangle de clip de la hachure, chacun par un transform
  function poserLimite() {
    if (!geo) return;
    const y = geo.net(yDe(vu.lim));
    els.limites.style.transform = `translateY(${y}px)`;
    els.clip.style.transform = `translateY(${y}px)`;             // le rectangle de clip finit à la limite : rien à remettre en page
    // Une valeur ne se pose jamais sur le trait de limite (on lirait « la limite vaut 29 ») : s'il manque de la place
    // entre la courbe et le trait, elle passe au-dessus du trait (un saut court, par transform).
    for (const n of els.notes) {
      const place = n.y - y;                                     // > 0 : la courbe est sous la limite
      let dy = place > 0 && place < 28 ? (y - 9) - (n.y - 11) : 0;
      dy = Math.max(dy, 13 - (n.y - 11));                        // jamais plus haut que le tracé
      if (dy !== n.dy) { n.dy = dy; n.t.style.transform = dy ? `translateY(${dy.toFixed(1)}px)` : ''; }
    }
  }

  // ---------- Transitions : une seule horloge pour les courbes, l'échelle et la limite ----------
  // Changement de tâche : les points glissent de l'ancienne courbe à la nouvelle, l'échelle et la limite avec eux
  // (540 ms, sortie douce, sans dépassement). Au clavier, la limite glisse d'un cran (140 ms). Sous le doigt : direct.
  let anim = 0;
  const doux = (t) => 1 - Math.pow(1 - t, 3);
  function aller(cible, duree) {
    cancelAnimationFrame(anim); anim = 0;
    // sous le doigt, seule la limite bouge : on ne retrace pas des courbes qui n'ont pas changé
    const memeCourbe = vu.vmax === cible.vmax && vu.vmin === cible.vmin && vu.vals.every((v, i) => v === cible.vals[i]);
    if (!duree || reduit()) {
      vu.lim = cible.lim;
      if (!memeCourbe) { Object.assign(vu, { vals: cible.vals.slice(), vmax: cible.vmax, vmin: cible.vmin }); tracer(); }
      poserLimite(); return;
    }
    const de = { vals: vu.vals.slice(), vmax: vu.vmax, vmin: vu.vmin, lim: vu.lim }, t0 = performance.now();
    const pas = (now) => {
      const k = Math.min(1, (now - t0) / duree), e = doux(k);
      vu.lim = de.lim + (cible.lim - de.lim) * e;
      if (!memeCourbe) { vu.vmax = de.vmax + (cible.vmax - de.vmax) * e; vu.vmin = de.vmin + (cible.vmin - de.vmin) * e; vu.vals = de.vals.map((v, i) => v + (cible.vals[i] - v) * e); tracer(); }
      poserLimite();
      anim = k < 1 ? requestAnimationFrame(pas) : 0;
    };
    anim = requestAnimationFrame(pas);
  }

  // ---------- La phrase : toutes celles des trois tâches, empilées ; une seule visible, en fondu ----------
  const phrases = new Map();
  for (const id in TACHES) for (const v of crans(id)) {
    const p = phrase(id, v);
    if (!phrases.has(p)) { const s = document.createElement('span'); s.textContent = p; resultat.appendChild(s); phrases.set(p, s); }
  }

  // ---------- L'état ----------
  let derniere = '', annoncee = '', minuterie = 0, tachePosee = null;
  const heures = ([a, b]) => `<span><span class="lim-long">${a}${NB}h${NB}–${NB}${b}${NB}h</span><span class="lim-court">${a}–${b}${NB}h</span></span>`;
  function poser({ mode = 'pas', annoncer = false } = {}) {
    const T = TACHES[tache], G = GRANDEURS[T.g], v = valeurs[tache];
    if (tachePosee !== tache) {
      tachePosee = tache;
      curseur.min = T.min; curseur.max = T.max; curseur.step = T.pas;
      piste.style.setProperty('--p', ((T.habituelle - T.min) / (T.max - T.min)).toFixed(4));
      etiquette.textContent = T.etiquette;
      habituelle.textContent = `Limite habituelle${NB}: ${texteValeur(tache, T.habituelle)}`;
      borneMin.textContent = texteValeur(tache, T.min); borneMax.textContent = texteValeur(tache, T.max);
      cleCourbe.textContent = G.courbe;
      zone.setAttribute('aria-label', decrire(T.g));
      cartes.forEach((c) => { c.cle = null; });
      if (els) noter();
    }
    if (+curseur.value !== v) curseur.value = v;
    curseur.setAttribute('aria-valuetext', G.clair(v));
    piste.style.setProperty('--v', ((v - T.min) / (T.max - T.min)).toFixed(4));
    const txt = texteValeur(tache, v);
    if (sortie.textContent !== txt) sortie.textContent = txt;
    retablir.hidden = Math.abs(v - T.habituelle) < 1e-9;
    aller({ vals: serieDe(tache), vmax: echelle(tache), vmin: plancher(tache), lim: v }, mode === 'tache' ? 540 : mode === 'pas' ? 140 : 0);
    // les cartes : on ne touche qu'à celles dont le verdict change
    cartes.forEach((c, j) => {
      const V = verdict(tache, v, j), cle = V.arret ? V.cle : 'libre';
      if (cle === c.cle) return;
      c.cle = cle;
      c.li.classList.toggle('arret', V.arret);
      c.v.innerHTML = V.arret ? `<b>Arrêt</b>${V.plages.map(heures).join('')}` : '<span class="lim-libre"><span class="lim-v-long">Possible</span><span class="lim-v-court">OK</span></span>';
      c.lu.textContent = V.lu;
    });
    marquer();
    const p = phrase(tache, v);
    if (p !== derniere) {
      const avant = phrases.get(derniere), apres = phrases.get(p);
      if (avant) avant.classList.remove('vue');
      if (apres) apres.classList.add('vue');
      derniere = p;
    }
    clearTimeout(minuterie);
    if (annoncer) minuterie = setTimeout(() => { if (derniere !== annoncee) { annonce.textContent = derniere; annoncee = derniere; } }, 650);
  }

  // ---------- Commandes ----------
  radios.forEach((r) => {
    r.checked = r.value === tache;
    r.addEventListener('change', () => { if (!r.checked) return; tache = r.value; poser({ mode: 'tache', annoncer: true }); });
  });
  let tenu = false;
  // sous le doigt (ou la souris tenue), la phrase change net ; elle se fond partout ailleurs (clavier, tâche, Rétablir)
  const tenir = (oui) => { tenu = oui; resultat.classList.toggle('glisse', oui); };
  curseur.addEventListener('pointerdown', () => tenir(true));
  addEventListener('pointerup', () => tenir(false));
  addEventListener('pointercancel', () => tenir(false));
  function regler(v, mode) {
    const T = TACHES[tache];
    valeurs[tache] = +(Math.round(Math.min(T.max, Math.max(T.min, v)) / T.pas) * T.pas).toFixed(2);
    poser({ mode, annoncer: true });
  }
  curseur.addEventListener('input', () => regler(+curseur.value, tenu ? 'glisse' : 'pas'));
  retablir.addEventListener('click', () => { regler(TACHES[tache].habituelle, 'tache'); curseur.focus(); });

  // ---------- Démarrage ----------
  // Entrée, une fois, à la première vue : les courbes montent de l'axe à la prévision, puis la limite et les verdicts
  // se posent (les cartes restent neutres jusque-là : on voit Auvent lire la semaine, puis conclure).
  const attendre = !reduit() && 'IntersectionObserver' in window;
  zone.classList.toggle('attente', attendre);
  poser({ mode: 'pose' });
  if (attendre) vu.vals = vu.vals.map(() => vu.vmin);      // les courbes partent de l'axe
  new ResizeObserver(() => dessiner()).observe(zone);
  document.fonts && document.fonts.ready.then(() => dessiner());
  if (attendre) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || !geo) return;
      io.disconnect();
      aller({ vals: serieDe(tache), vmax: echelle(tache), vmin: plancher(tache), lim: valeurs[tache] }, 900);
      setTimeout(() => zone.classList.remove('attente'), 620);
    }, { threshold: 0.4 });
    io.observe(zone);
  }
})();
