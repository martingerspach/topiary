/* Auvent · landing v3 « Ciel » : orchestration de la page (script classique ; requiert carte.js, scenario.js, ville.js,
   verre.js, logo-ciel.js, dessins.js, planning.js).
   Paramètres de revue : ?rm=1 force les mouvements réduits (captures) ; ?ville=lille choisit la ville ; ?etape=0..3 fige le
   planning ; ?fige=1 coupe la pluie et pose tout à l'état final. */
(function () {
  const A = window.Auvent, S = A.scenario, V = A.ville, C = A.carte;
  const NB = ' ';
  const q = new URLSearchParams(location.search);
  const FIGE = q.has('fige');
  const reduit = () => q.has('rm') || FIGE || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const nombre = (v, d = 0) => v.toFixed(d).replace('.', ',').replace('-', '−');
  const hh = (t) => `${((t + 6) % 24 + 24) % 24}${NB}h`;           // heure du modèle -> « 9 h »
  const JOURS = ['mardi', 'mercredi', 'jeudi', 'vendredi'];
  const DATES = ['mardi 13', 'mercredi 14', 'jeudi 15', 'vendredi 16'];
  const maj = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  document.documentElement.classList.add('js');
  // le squelette de l'artefact pose <html> sans langue : sans elle, un lecteur d'écran lit la page avec une voix anglaise
  document.documentElement.lang = 'fr';
  if (q.has('rm') || FIGE) document.documentElement.classList.add('rm');

  // ---------- Logo ----------
  const logoTete = $('.tete-marque [data-logo]');
  const ctlLogo = A.logo.monter(logoTete, { rafale: !reduit() });
  $('.tete-marque').addEventListener('mouseenter', () => ctlLogo.souffle());
  // Le mot géant du pied prend le vent (marque/vent-pied.js, direction « champ ») : rafales à l'entrée à l'écran, au
  // passage rapide du pointeur sur le mot, au défilement rapide ; au repos en moins de 5 s ; posé en mouvements réduits.
  A.ventPied.pied = A.ventPied.monter($('.pied-mot [data-logo]'), { direction: 'champ', id: 'pied', zone: $('.pied-mot'), anime: !reduit() });

  // ---------- Héros : la ville ----------
  const VILLES = C.VILLES.map((v) => ({ id: v.id, nom: v.nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const choixVille = $('#ville'), choixEssai = $('#essai-ville');
  for (const sel of [choixVille, choixEssai]) sel.innerHTML = VILLES.map((v) => `<option value="${v.id}">${v.nom}</option>`).join('');
  const villeInit = VILLES.some((v) => v.id === q.get('ville')) ? q.get('ville') : 'nantes';
  choixVille.value = choixEssai.value = villeInit;

  function bulletinDe(b) {
    const J = maj(JOURS[b.jour]);
    const serie = b.serie;
    const plage = (hs) => `de ${hh(hs[0])} à ${hh(hs[hs.length - 1] + 1)}`;
    if (!b.cle) return { chantier: `Votre chantier, ${b.nom}`, texte: `Rien à décaler cette semaine. Le bulletin vous prévient la veille en cas de changement.` };
    const T = b.types[b.cle][b.jour], hs = T.heures, suite = b.prochain(b.cle);
    const quand = suite !== null ? JOURS[suite] : 'la semaine prochaine';
    const coule = suite !== null ? `On coule ${quand} à 7${NB}h.` : 'On coule la semaine prochaine.';
    // Le bulletin parle comme un chef de chantier : la tâche, la raison en mots, la reprise. Une plage horaire au plus,
    // aucune mesure (ni km/h ni °C) : la mesure reste dans l'appli, pas dans la consigne.
    if (b.cle === 'coulage') {
      const pluie = hs.filter((t) => serie[t].pluie > 1);
      if (pluie.length) return { chantier: b.id === 'nantes' ? 'Les Bateliers, Nantes' : `Votre chantier, ${b.nom}`, texte: `Pas de coulage ${JOURS[b.jour]}${NB}: il pleut ${plage(pluie)}. ${coule}` };
      return { chantier: `Votre chantier, ${b.nom}`, texte: `Pas de coulage ${JOURS[b.jour]}${NB}: il fera trop froid le matin. ${coule}` };
    }
    if (b.cle === 'nacelle') return { chantier: `Votre chantier, ${b.nom}`, texte: `Pas de nacelle ${JOURS[b.jour]}${NB}: trop de vent en hauteur. Reprise ${quand}.` };
    if (b.cle === 'couverture') {
      // cause dominante : le vent si toutes les heures bloquées dépassent 40 km/h, sinon la pluie (seuil de 0,2 mm/h)
      const vent = hs.every((t) => serie[t].rafales > 40);
      return { chantier: `Votre chantier, ${b.nom}`, texte: `Pas de toiture ${JOURS[b.jour]}${NB}: ${vent ? 'trop de vent' : 'il pleut'} ${plage(hs)}. Reprise ${quand}.` };
    }
    return { chantier: `Votre chantier, ${b.nom}`, texte: `Pas de levage ${JOURS[b.jour]}${NB}: trop de vent ${plage(hs)}. Reprise ${quand}.` };
  }
  // Le verdict du héros : celui de ville.js, sauf le cas du froid (dit sans température) et la semaine sans blocage
  function verdictDe(b) {
    if (!b.cle) return 'Cette semaine, la météo ne bloque rien sur vos chantiers.';
    if (b.cle === 'coulage' && !b.types.coulage[b.jour].heures.some((t) => b.serie[t].pluie > 1)) {
      const suite = b.prochain('coulage');
      return `${maj(JOURS[b.jour])}, trop froid pour couler${NB}: le béton attendra ${suite !== null ? JOURS[suite] : 'la semaine prochaine'}.`;
    }
    return b.titre.replace(/ :/g, NB + ':').replace(/(\d) /g, '$1' + NB);
  }
  function titreEnLignes(el, texte) {
    el.textContent = '';
    texte.split(' ').forEach((mot, i, arr) => {
      const s = document.createElement('span'); s.className = 'ligne'; s.style.setProperty('--i', i); s.textContent = mot;
      el.appendChild(s); if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }
  // Le titre du héros est la promesse (fixe) ; la ville change le verdict dessous, ses faits, le bulletin et les cotes.
  titreEnLignes($('#titre'), $('#titre').textContent);
  let villeCourante = null;
  function choisirVille(id, anime = true) {
    villeCourante = id;
    const b = V.bilan(id);
    const verdict = $('.heros-verdict');
    $('#verdict').textContent = verdictDe(b);
    if (anime && !reduit()) { verdict.classList.remove('rejoue'); void verdict.offsetWidth; verdict.classList.add('rejoue'); }
    const bu = bulletinDe(b);
    $('#bulletin-chantier').textContent = bu.chantier;
    $('#bulletin-texte').textContent = bu.texte;
    $('#cote-ville').textContent = `${b.nom}, ${JOURS[b.jour]}`;
    $('#cote-mm').textContent = `${nombre(b.mm)}${NB}mm`;
    choixEssai.value = id;
    cotes();
    if (anime && averse) averse(3500);
  }
  choixVille.addEventListener('change', () => choisirVille(choixVille.value));
  choixEssai.addEventListener('change', () => { $('#essai-retour').textContent = ''; });

  // ---------- Héros : les cotes de l'instrument (coordonnées de l'image 1360 × 2048) ----------
  // Relevées au pixel sur le rendu (canal alpha) : bord de l'entonnoir le plus large à y 82 (x 265 à 1095), bague sous
  // l'entonnoir de y 390 à 440, éprouvette de y 450 à 1515 (x 501 à 858), ménisque y 1110, axe x 680.
  const IMG = { w: 1360, h: 2048, axe: 680, bordG: 265, bordD: 1095, bordY: 82, tubeG: 501, tubeD: 858, tubeH: 450, tubeB: 1515, eau: 1110 };
  function cotes() {
    const fig = $('#objet'), svg = $('#cotes');
    const w = fig.clientWidth, h = fig.clientHeight;
    if (!w || !h) return;
    const s = Math.min(w / IMG.w, h / IMG.h), ox = (w - IMG.w * s) / 2, oy = (h - IMG.h * s) / 2;
    const X = (x) => ox + x * s, Y = (y) => oy + y * s;
    const r = (v) => Math.round(v) + 0.5;           // traits de 1 px posés sur le pixel
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    let d = '';
    // axe de symétrie (trait mixte fin), du dessus de l'entonnoir au pied
    const axe = `<line class="cote-axe" x1="${r(X(IMG.axe))}" y1="${Y(26) - 22}" x2="${r(X(IMG.axe))}" y2="${Y(2030) + 14}" stroke-dasharray="14 4 2 4"/>`;
    // cadre de construction autour de l'éprouvette
    const cadre = `<path class="cote-cadre" d="M${r(X(IMG.tubeG - 34))} ${r(Y(IMG.tubeH))}H${r(X(IMG.tubeD + 34))}V${r(Y(IMG.tubeB))}H${r(X(IMG.tubeG - 34))}Z"/>`;
    // Étiquettes : ligne de rappel horizontale vers la droite, sinon vers la gauche ; une position est retenue si
    // l'étiquette reste dans la fenêtre et ne touche ni le texte du héros ni le bulletin (marge de 12 px).
    const F = fig.getBoundingClientRect();
    const obstacles = ['.heros-titre .ligne', '.heros-chapeau', '.heros-ville label', '.heros-ville .choix', '.heros-verdict-titre', '.heros-actions > *', '#bulletin', '.tete-nav', '.tete-marque'].flatMap((q) => [...document.querySelectorAll(q)]).map((e) => e.getBoundingClientRect());
    const libre = (x0, y0, x1, y1) => x0 >= 16 - F.left && x1 <= innerWidth - 16 - F.left && !obstacles.some((o) => x1 + F.left > o.left - 12 && x0 + F.left < o.right + 12 && y1 + F.top > o.top - 8 && y0 + F.top < o.bottom + 8);
    function placer(el, yImg, xG, xD, classe, lien) {
      el.style.display = '';
      const y = r(Y(yImg)), lw = el.offsetWidth, lh = el.offsetHeight, L = Math.max(34, 130 * s);
      const cands = [
        { x0: X(xD) + 6, x1: X(xD) + L, lx: X(xD) + L + 12, cote: 'droite' },
        { x0: X(xG) - 6, x1: X(xG) - L, lx: X(xG) - L - 12 - lw, cote: 'gauche' },
      ];
      for (const c of cands) {
        if (!libre(c.lx, y - lh / 2, c.lx + lw, y + lh / 2)) continue;
        Object.assign(el.style, { left: c.lx + 'px', top: y - lh / 2 + 'px', right: 'auto', textAlign: c.cote === 'droite' ? 'left' : 'right' });
        return `<path class="${classe}" d="${lien}M${r(c.x0)} ${y}H${r(c.x1)}"/><circle class="cote-point${classe ? '' : ' cote-point--clair'}" cx="${r(c.x1)}" cy="${y}" r="${classe ? 2.5 : 2}"/>`;
      }
      el.style.display = 'none';
      return '';
    }
    const yE = r(Y(IMG.eau));
    const niv = placer($('#cote-niveau'), IMG.eau, IMG.tubeG, IMG.tubeD, 'cote-niveau', `M${r(X(IMG.tubeG) + 2)} ${yE}H${r(X(IMG.tubeD) - 2)}`);
    svg.innerHTML = axe + cadre + `<g>${d}</g>` + niv;
  }

  // ---------- Héros : l'averse (canvas, 19,5° depuis la verticale) ----------
  // Une averse dure 4 s, puis passe : les gouttes ne renaissent plus et s'effacent en 0,9 s. Elle revient à chaque
  // changement de ville. Aucun mouvement automatique ne dépasse donc 5 s (WCAG 2.2.2 ; défaut P1-3 de la v10, où la pluie
  // tombait sans fin) et plus rien ne bouge sous le bulletin en verre une fois l'averse passée.
  let averse = null;
  function pluie() {
    const cv = $('#pluie'), ctx = cv.getContext('2d');
    const ang = (19.5 * Math.PI) / 180, sx = Math.sin(ang), sy = Math.cos(ang);
    let W = 0, H = 0, dpr = 1, gouttes = [], raf = 0, visible = true, t0 = 0, fin = 0;
    const EFFACE = 900;
    const N = () => Math.round(clamp((W * H) / 9000, 60, 220));
    function taille() {
      dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      gouttes = Array.from({ length: N() }, () => ({ x: rnd() * (W + H * 0.4) - H * 0.35, y: rnd() * H, l: 26 + rnd() * 70, v: 700 + rnd() * 600, a: 0.035 + rnd() * 0.1 }));
      dessiner(0);
    }
    function dessiner(dt, now = 0) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1; ctx.lineCap = 'round';
      const k = now ? clamp(1 - (now - fin) / EFFACE) : 1;      // 1 pendant l'averse, puis vers 0
      for (const g of gouttes) {
        if (g.mort) continue;
        g.y += g.v * dt; g.x += g.v * dt * (sx / sy);
        if (g.y - g.l > H) {
          if (now && now > fin) { g.mort = true; continue; }
          g.y = -g.l * sy; g.x -= H * (sx / sy) + g.l * sx;
        }
        const x1 = g.x, y1 = g.y, x0 = x1 - sx * g.l, y0 = y1 - sy * g.l;
        const gr = ctx.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, 'rgba(188,205,232,0)'); gr.addColorStop(1, `rgba(220,228,239,${(g.a * k).toFixed(4)})`);
        ctx.strokeStyle = gr; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
    function boucle(now) {
      const dt = t0 ? Math.min(0.05, (now - t0) / 1000) : 0; t0 = now; dessiner(dt, now);
      if (now > fin + EFFACE) { ctx.clearRect(0, 0, W, H); raf = 0; return; }
      raf = visible ? requestAnimationFrame(boucle) : 0;
    }
    new ResizeObserver(() => { taille(); if (!reduit() && !raf) ctx.clearRect(0, 0, W, H); }).observe(cv);
    if (reduit()) return;
    averse = (ms) => {
      fin = performance.now() + ms; gouttes.forEach((g) => (g.mort = false));
      if (!raf && visible) { t0 = 0; raf = requestAnimationFrame(boucle); }
    };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting; cancelAnimationFrame(raf); raf = 0; t0 = 0;
      if (visible && performance.now() < fin + EFFACE) raf = requestAnimationFrame(boucle);
    }).observe(cv);
    averse(4000);
  }

  // ---------- En-tête : contexte de la section survolée, curseur de navigation ----------
  const tete = $('#tete');
  const sections = $$('[data-contexte]').filter((e) => e !== tete);
  function contexte() {
    const y = 36;
    let ctx = 'nuit';
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) {
        ctx = s.dataset.contexte;
        // « nuit@-230 » : le fond devient sombre à 230 px du bas ; « jour@150 » : clair à partir de 150 px du haut
        const b = s.dataset.bascule;
        if (b) { const [c, v] = b.split('@'); const seuil = +v < 0 ? r.height + +v : +v; if (y - r.top >= seuil) ctx = c; }
        break;
      }
    }
    if (tete.dataset.contexte !== ctx) {
      tete.dataset.contexte = ctx;
      tete.classList.toggle('av-nuit', ctx === 'nuit'); tete.classList.toggle('av-jour', ctx === 'jour');
      ['.tete-liens', '.tete-fond'].forEach((q) => A.verre.peindre($(q)));
    }
  }
  tete.classList.add('av-nuit');
  const curseur = $('.tete-curseur');
  // L'indicateur se pose au sous-pixel près (offsetLeft et offsetWidth arrondis le décalaient jusqu'à 0,45 px vers la
  // droite). Quand il est invisible, il se pose sans glisser : à l'entrée dans la barre, il apparaît sous le lien visé au
  // lieu de partir du dernier lien survolé.
  const liens = $('.tete-liens');
  let entree = true;
  const viser = (a) => {
    const R = liens.getBoundingClientRect(), r = a.getBoundingClientRect();
    if (entree) curseur.style.transition = 'none';
    curseur.style.width = r.width + 'px';
    curseur.style.transform = `translateX(${r.left - R.left - liens.clientLeft}px)`;
    if (entree) { void curseur.offsetWidth; curseur.style.transition = ''; entree = false; }
  };
  liens.addEventListener('pointerenter', () => { if (!liens.matches(':focus-within')) entree = true; });
  liens.addEventListener('focusin', (e) => { if (!liens.contains(e.relatedTarget) && !liens.matches(':hover')) entree = true; });
  $$('.tete-liens a').forEach((a) => { a.addEventListener('pointerenter', () => viser(a)); a.addEventListener('focus', () => viser(a)); });
  viser($('.tete-liens a'));

  // ---------- Énoncé : les mots s'éclairent au fil de la lecture ----------
  const enonce = $('#enonce');
  (function decouper() {
    const mots = enonce.textContent.split(/ +/);
    enonce.innerHTML = mots.map((m) => `<span class="mot">${m}</span>`).join(' ');
  })();
  const motsEnonce = $$('.mot', enonce);
  function lireEnonce() {
    if (reduit()) { motsEnonce.forEach((m) => m.classList.add('lu')); return; }
    const r = enonce.getBoundingClientRect(), vh = innerHeight;
    const p = clamp((vh * 0.78 - r.top) / (r.height + vh * 0.22));
    const n = Math.round(p * motsEnonce.length);
    motsEnonce.forEach((m, i) => m.classList.toggle('lu', i < n));
  }

  // ---------- Comment ça marche : la pluie de mercredi, à côté du bulletin qui en découle ----------
  // Un seul rang (la pluie) et une seule tâche (le coulage, celle du bulletin) : les barres heure par heure, le créneau
  // prévu, la limite du coulage en tirets. Les heures du créneau au-dessus de la limite reçoivent la hachure de pluie et
  // une accolade qui dit la conséquence : ce sont exactement les heures que le téléphone annonce (9 h à 13 h).
  const MER = 1;
  const meteoNantes = S.meteo('bateliers', 0).serie;
  const HEURES = Array.from({ length: 15 }, (_, i) => 6 + i);                // 6 h à 20 h
  const serieH = HEURES.map((h) => meteoNantes[S.tDe(MER, h)]);
  const COULAGE = { debut: 7, fin: 13, limite: 1 };                         // créneau du bulletin, limite en mm/h
  function releve() {
    const hote = $('#releve-graphe');
    const W = hote.clientWidth, H = hote.clientHeight;
    if (!W || !H) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const net = (v) => Math.round(v * dpr) / dpr;                           // calé sur le pixel de l'écran
    const r1 = (v) => (+v.toFixed(2)).toString();
    const g = 2, dr = 2, bas = 34, pas = (W - g - dr) / 15;
    const x = (h) => g + (h - 6 + 0.5) * pas;                               // centre de l'heure h
    const xb = (h) => net(g + (h - 6) * pas);                               // bord de l'heure h
    const base = net(H - bas) + 0.5 / dpr;
    const PMAX = 2.8, hautBarres = 112;                                     // place gardée au-dessus pour le créneau et l'accolade
    const yP = (p) => base - (p / PMAX) * (base - hautBarres);
    const bw = net(Math.max(6, Math.min(22, pas * 0.56))), rr = Math.min(3, bw / 2);
    const barre = (h, p) => {
      const x0 = net(x(h) - bw / 2), y = net(Math.min(base - 2, yP(p)));
      return `M${r1(x0)} ${r1(base)}V${r1(y + rr)}a${rr} ${rr} 0 0 1 ${rr} ${-rr}h${r1(bw - 2 * rr)}a${rr} ${rr} 0 0 1 ${rr} ${rr}V${r1(base)}Z`;
    };
    const depasse = (h, p) => h >= COULAGE.debut && h < COULAGE.fin && p > COULAGE.limite;
    const barres = serieH.map((v, i) => `<path class="b-pluie${depasse(HEURES[i], v.pluie) ? ' b-pluie--depasse' : ''}" data-h="${HEURES[i]}" d="${barre(HEURES[i], v.pluie)}"/>`).join('');
    const bloques = serieH.map((v, i) => ({ h: HEURES[i], p: v.pluie })).filter((b) => depasse(b.h, b.p));
    const hachures = bloques.map((b) => `<path class="b-depasse" data-h="${b.h}" d="${barre(b.h, b.p)}"/>`).join('');
    let ticks = '';
    for (let h = 6; h <= 21; h++) ticks += `<line class="g-tick" x1="${r1(xb(h) + 0.5 / dpr)}" x2="${r1(xb(h) + 0.5 / dpr)}" y1="${r1(base)}" y2="${r1(base + (h % 2 ? 4 : 7))}"/>`;
    // une étiquette toutes les 2 h, toutes les 4 h si la place manque (étiquette de 15 px : environ 34 px de large)
    const tous = pas * 2 >= 44 ? 2 : 4;
    const axes = HEURES.filter((h) => (h - 6) % tous === 0).map((h) => `<text class="g-heure" x="${r1(x(h))}" y="${H - 8}" text-anchor="middle">${h}${NB}h</text>`).join('');
    const yL = net(yP(COULAGE.limite)) + 0.5 / dpr, xa = xb(COULAGE.debut), xf = xb(COULAGE.fin);
    // accolade au-dessus des heures bloquées, son libellé centré dessus (gardé dans le cadre)
    let accolade = '';
    if (bloques.length) {
      const a0 = xb(bloques[0].h) + 3, a1 = xb(bloques[bloques.length - 1].h + 1) - 3;
      const ya = net(Math.min(...bloques.map((b) => yP(b.p))) - 16) + 0.5 / dpr;
      accolade = `<g class="g-accolade"><path d="M${r1(a0)} ${r1(ya + 6)}V${r1(ya)}H${r1(a1)}V${r1(ya + 6)}M${r1((a0 + a1) / 2)} ${r1(ya)}v-5"/>`
        + `<text class="g-accolade-txt" x="${r1((a0 + a1) / 2)}" y="${r1(ya - 12)}" text-anchor="middle">Trop de pluie pour couler</text></g>`;
    }
    hote.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <defs>
        <pattern id="hachure-depasse" patternUnits="userSpaceOnUse" width="5" height="10" patternTransform="rotate(-19.5)"><line x1="1" y1="0" x2="1" y2="10" stroke="#A9C1FF" stroke-width="1.1"/></pattern>
        <linearGradient id="barre-pluie" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2F5FA" stop-opacity=".42"/><stop offset="1" stop-color="#F2F5FA" stop-opacity=".16"/></linearGradient>
      </defs>
      <rect class="g-fenetre" x="${r1(xa)}" y="0" width="${r1(xf - xa)}" height="${r1(base)}" rx="8"/>
      <text class="g-fenetre-txt" x="${r1(xa + 10)}" y="22">Coulage prévu</text>
      <g class="g-pluie">${barres}</g>
      <g class="g-pluie-depasse">${hachures}</g>
      <g class="g-limite"><line class="g-seuil" x1="${g}" x2="${W - dr}" y1="${r1(yL)}" y2="${r1(yL)}"/></g>
      ${accolade}
      <line class="g-base" x1="${g}" x2="${W - dr}" y1="${r1(base)}" y2="${r1(base)}"/>
      ${ticks}${axes}
    </svg>`;
    // la limite a sa légende sous le titre de la carte (hors du tracé : aucune barre ne peut la couper) ; le libellé de
    // l'accolade reste dans le cadre quand le graphique est étroit
    const t = hote.querySelector('.g-accolade-txt');
    if (t) { const l = t.getComputedTextLength(), cx = +t.getAttribute('x'); t.setAttribute('x', r1(Math.min(W - dr - l / 2, Math.max(g + l / 2, cx)))); }
  }
  // Entrée, une fois, en quatre temps qui racontent la lecture : les heures de pluie montent, le créneau et la limite se
  // posent, les heures bloquées se hachurent l'une après l'autre, puis l'accolade dit pourquoi. Le téléphone reçoit
  // ensuite le bulletin (arriveeBulletin, décalé d'autant). Transform et opacité seulement ; rien en mouvements réduits.
  let releveVu = false, releveT0 = -1e9;
  const RELEVE_DUREE = 1900;
  function entreeReleve() {
    const svg = $('#releve-graphe svg'); if (!svg || reduit()) return;
    releveT0 = performance.now();
    const doux = 'cubic-bezier(.16,1,.3,1)';
    $$('.b-pluie', svg).forEach((b) => b.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 760, delay: 28 * (+b.dataset.h - 6), easing: doux, fill: 'backwards' }));
    $$('.g-fenetre, .g-fenetre-txt', svg).forEach((e) => e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 420, easing: 'linear', fill: 'backwards' }));
    svg.querySelector('.g-limite').animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 640, easing: doux, fill: 'backwards' });
    $$('.b-depasse', svg).forEach((b, i) => b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: 1040 + 110 * i, easing: 'linear', fill: 'backwards' }));
    const acc = svg.querySelector('.g-accolade');
    if (acc) acc.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 1420, easing: doux, fill: 'backwards' });
  }

  // ---------- Planning ----------
  // Au-delà de 1 100 px, l'étape suit la lecture : elle change quand le haut d'une étape passe la mi-hauteur de l'écran,
  // avec une hystérésis (bande de ± 2 % de la hauteur d'écran, 12 px au moins) : un léger va-et-vient sur le seuil ne la
  // fait pas basculer. La position décide, jamais l'inverse : le défilement reste natif. Un défilement rapide qui franchit
  // plusieurs seuils dans la même image va droit à l'étape atteinte, et planning.js y va sans repasser par les autres.
  const plan = A.planning.monter($('#app-grille'), { emis: $('#app-emis'), texte: $('#app-etat'), vu: $('#app-etat-vu') });
  const etapes = $$('.etape');
  const onglets = $$('.onglet');
  const listeEtapes = $('#etapes');
  const appPlan = $('#app');
  // le filet de progression est lié au défilement par le navigateur (landing.css) ; sinon, ou en mouvements réduits, ici
  const railNatif = !!(window.CSS && CSS.supports('animation-timeline: view()'));
  function allerEtape(i, o) {
    etapes.forEach((e) => e.classList.toggle('actif', +e.dataset.etape === i));
    etapes.forEach((e) => e.querySelector('.etape-bouton').setAttribute('aria-current', +e.dataset.etape === i ? 'step' : 'false'));
    onglets.forEach((b) => b.setAttribute('aria-pressed', +b.dataset.etape === i));
    const e = etapes[i];
    $('#onglet-texte').innerHTML = `<b>${e.querySelector('.etape-titre').textContent}</b>${e.querySelector('.etape-texte').innerHTML}`;
    plan.aller(i, o);
  }
  onglets.forEach((b) => b.addEventListener('click', () => allerEtape(+b.dataset.etape)));
  // Sur écran étroit, la grille défile : on l'ouvre sur mercredi, le jour du front (colonne des chantiers collée à gauche)
  function ouvrirSurMercredi() {
    const d = $('.app-defile'); if (d.scrollWidth <= d.clientWidth) return;
    const c = $('.pg-jour:nth-of-type(3)'), site = $('.pg-coin');
    if (c && site) d.scrollLeft = c.offsetLeft - site.offsetWidth;
  }
  // Un clic (ou Entrée) sur une étape amène son texte sur la ligne de lecture : la page y défile, et le planning passe
  // directement à cette étape. Pendant ce défilement, la position ne décide plus ; elle reprend la main dès qu'il finit
  // ou que le lecteur défile lui-même.
  let modeManuel = false;                            // revue : ?etape=n fige le planning (posé au démarrage)
  let verrou = false, finVerrou = 0, premier = true;
  const lever = () => { if (!verrou) return; verrou = false; clearTimeout(finVerrou); etapeParDefilement(); };
  etapes.forEach((e) => e.querySelector('.etape-bouton').addEventListener('click', () => {
    const i = +e.dataset.etape;
    if (modeManuel || innerWidth < 1100) { allerEtape(i); return; }
    const y = scrollY + e.getBoundingClientRect().top - innerHeight * 0.5 + Math.max(48, innerHeight * 0.06);
    allerEtape(i);
    if (Math.abs(y - scrollY) < 2) return;
    verrou = true; clearTimeout(finVerrou); finVerrou = setTimeout(lever, 1600);
    scrollTo({ top: y, behavior: reduit() ? 'instant' : 'smooth' });
  }));
  addEventListener('scrollend', lever);
  ['wheel', 'touchstart'].forEach((t) => addEventListener(t, lever, { passive: true }));
  addEventListener('keydown', (ev) => { if (!ev.target.closest || !ev.target.closest('.etape-bouton')) lever(); });
  function etapeParDefilement() {
    if (innerWidth < 1100) return;
    const mid = innerHeight * 0.5, bande = Math.max(12, innerHeight * 0.02);
    const tops = etapes.map((e) => e.getBoundingClientRect().top);
    if (!modeManuel && !verrou) {
      let c = Math.max(0, plan.etape);
      while (c < etapes.length - 1 && tops[c + 1] < mid - bande) c++;
      while (c > 0 && tops[c] > mid + bande) c--;
      if (c !== plan.etape) {
        // au chargement au milieu de la section, ou fenêtre hors de l'écran : l'étape se pose sans passage
        const r = appPlan.getBoundingClientRect();
        allerEtape(c, { anime: !premier && r.bottom > 0 && r.top < innerHeight });
      }
    }
    premier = false;
    if (railNatif && !reduit()) return;
    const H = listeEtapes.offsetHeight || 1, c = Math.max(0, plan.etape);
    const v = reduit() ? (c >= etapes.length - 1 ? 1 : (tops[c + 1] - tops[0]) / H) : clamp((mid - tops[0]) / H);
    listeEtapes.style.setProperty('--rail', v.toFixed(4));
  }

  // ---------- Comment ça marche : le téléphone du chef de chantier ----------
  function fondTelephone() {
    // Fond d'écran : une carte de surface en traits fins (isobares autour d'une dépression hors champ, front froid à dents)
    const W = 320, H = 690;
    let d = '';
    for (let k = 0; k < 9; k++) {
      const r = 210 + k * 62, cx = -80, cy = 60;
      let p = '';
      for (let a = -10; a <= 100; a += 2) {
        const t = (a * Math.PI) / 180, w = 1 + 0.06 * Math.sin(3 * t + k);
        p += (a === -10 ? 'M' : 'L') + (cx + Math.cos(t) * r * w * 1.25).toFixed(1) + ' ' + (cy + Math.sin(t) * r * w).toFixed(1);
      }
      d += `<path d="${p}" fill="none" stroke="rgba(220,228,239,.16)" stroke-width="1"/>`;
    }
    let front = 'M300 0 C 250 160, 210 300, 150 420 S 60 610, 30 690';
    d += `<path id="f" d="${front}" fill="none" stroke="rgba(127,166,255,.75)" stroke-width="2"/>`;
    const svgTxt = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${d}</svg>`;
    $('#tel-ecran').style.setProperty('--fond-tel', `url("data:image/svg+xml,${encodeURIComponent(svgTxt)}")`);
    const icone = A.logo.monogramme({ attrs: 'xmlns="http://www.w3.org/2000/svg"' });
    document.documentElement.style.setProperty('--icone-app', `url("data:image/svg+xml,${encodeURIComponent(icone)}")`);
  }
  // Arrivée du bulletin : sa place s'ouvre en ressort dans la pile (la notification de la veille reste en bas, la
  // nouvelle se pose au-dessus), la bannière se condense dedans, l'île respire. Transformation, opacité et hauteur
  // d'une enveloppe sans verre : le verre n'est pas recalculé pendant le mouvement.
  const VERRE_EASE = getComputedStyle(document.documentElement).getPropertyValue('--av-ease-verre').trim() || 'ease-out';
  function arriveeBulletin(apres = 0) {
    if (reduit()) return;
    const place = $('#notif-place'), n = $('#notif'), ile = $('#tel-ile');
    const h = n.offsetHeight;
    place.getAnimations().concat(n.getAnimations()).forEach((x) => x.cancel());
    place.style.overflow = 'visible';
    place.animate([{ height: '0px', marginBottom: '-8px' }, { height: h + 'px', marginBottom: '0px' }], { duration: 760, delay: 140 + apres, easing: VERRE_EASE, fill: 'backwards' });
    n.animate([{ opacity: 0, transform: 'translateY(-18px) scale(0.92)' }, { opacity: 1, transform: 'none' }], { duration: 820, delay: 220 + apres, easing: VERRE_EASE, fill: 'backwards' });
    ile.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(1.16) scaleY(1.06)', offset: 0.4 }, { transform: 'scaleX(1)' }], { duration: 560, delay: apres, easing: 'cubic-bezier(.3,0,.2,1)' });
  }
  const retour = $('#tel-retour');
  function repondre(id, texte) {
    const b = $(id), autre = $(id === '#notif-ok' ? '#notif-pb' : '#notif-ok');
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on); autre.setAttribute('aria-pressed', 'false');
    retour.textContent = on ? texte : ''; retour.classList.toggle('visible', on);
  }
  $('#notif-ok').addEventListener('click', () => repondre('#notif-ok', `Lu à 6${NB}h${NB}04${NB}: le bureau est prévenu.`));
  $('#notif-pb').addEventListener('click', () => repondre('#notif-pb', `Le conducteur de travaux vous rappelle.`));

  // ---------- Limites : la démonstration jouable est dans landing/limites.js ----------

  // ---------- Questions : l'ouverture est native (::details-content dans landing.css), plus de script ----------

  // ---------- Essai ----------
  $('#essai-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const nom = VILLES.find((v) => v.id === choixEssai.value).nom;
    $('#essai-retour').textContent = `Démonstration${NB}: rien n’est envoyé. Votre premier bulletin pour ${nom} arriverait demain à 6${NB}h.`;
  });

  // ---------- Défilement : une seule boucle pour tout ce qui suit la lecture ----------
  let rafDefile = 0;
  function surDefilement() {
    cancelAnimationFrame(rafDefile);
    rafDefile = requestAnimationFrame(() => { contexte(); tete.classList.toggle('defile', scrollY > 40); lireEnonce(); etapeParDefilement(); });
  }
  addEventListener('scroll', surDefilement, { passive: true });
  addEventListener('resize', () => { cotes(); releve(); surDefilement(); });

  // ---------- Démarrage ----------
  choisirVille(villeInit, false);
  fondTelephone();
  pluie();
  // les cotes évitent le texte du héros : on les replace dès que ce texte change de taille (chargement des polices, ville)
  const roCotes = new ResizeObserver(() => cotes());
  ['#objet', '.heros-texte', '#bulletin'].forEach((q) => roCotes.observe($(q)));
  addEventListener('load', cotes);
  new ResizeObserver(() => releve()).observe($('#releve-graphe'));
  const etapeInit = q.has('etape') ? clamp(+q.get('etape'), 0, 3) : 0;
  if (q.has('etape')) modeManuel = true;
  allerEtape(etapeInit, { anime: false });
  ouvrirSurMercredi();
  A.verre.monter();
  surDefilement();
  // Entrées au premier passage : le météogramme, le téléphone
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    if (e.target.id === 'releve' && !releveVu) { releveVu = true; entreeReleve(); }
    // le bulletin arrive quand le graphique a fini de dire pourquoi (s'il est en train de le dire)
    if (e.target.id === 'tel') arriveeBulletin(Math.max(0, releveT0 + RELEVE_DUREE - performance.now()));
  }), { threshold: 0.35 });
  io.observe($('#releve')); io.observe($('#tel'));
  document.fonts && document.fonts.ready.then(() => { cotes(); releve(); A.verre.monter(); });
})();
