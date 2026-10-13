/* Auvent · la frise du temps : un météogramme qui sert de curseur. Expose window.Auvent.frise(hôte, options).
   La pluie heure par heure de la ville choisie (barres hachurées à l'angle de la pluie du signe), le seuil de la tâche,
   les créneaux de travail de chaque jour cotés comme sur un plan (traits d'attache et cote), et la tête de lecture.
   C'est un vrai curseur (role="slider") : souris ou doigt, flèches (1 h), Page haut et bas (6 h), Début et Fin.
   Quand la ville change, les barres passent à leur nouvelle hauteur en vague, de gauche à droite. */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const NS = 'http://www.w3.org/2000/svg', NB = ' ';
  const JOURS = ['mardi 13', 'mercredi 14', 'jeudi 15', 'vendredi 16'], JC = ['mar. 13', 'mer. 14', 'jeu. 15', 'ven. 16', 'sam. 17'];
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const nombre = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const heure = (t) => { const h = ((Math.round(t) + 6) % 24 + 24) % 24; return `${h}${NB}h`; };
  const jourDe = (t) => Math.floor((Math.round(t) + 6) / 24);
  let uid = 0;

  function frise(host, o) {
    const T = o.heures || 90, MAX = 4; // mm/h en haut de l'échelle
    const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = 'av-fr' + ++uid;
    let W = 0, t = o.t ?? 0, serie = o.serie, taches = o.taches || [], seuil = o.seuil ?? 1;
    host.classList.add('av-frise');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'av-frise-svg'); svg.setAttribute('tabindex', '0'); svg.setAttribute('role', 'slider');
    svg.setAttribute('aria-label', o.label || 'Heure de la prévision'); svg.setAttribute('aria-valuemin', '0'); svg.setAttribute('aria-valuemax', String(T));
    host.appendChild(svg);
    const el = (n, a = {}, parent = svg) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); parent.appendChild(e); return e; };
    const defs = el('defs');
    // hachures de pluie : traits fins à 19,5°, écart 3 px
    const pat = (pid, cls) => { const p = el('pattern', { id: pid, width: 3.2, height: 12, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(19.5)' }, defs); el('rect', { width: 1.25, height: 12, class: cls }, p); };
    pat(id + 'p', 'av-frise-h'); pat(id + 'b', 'av-frise-hb');
    const gJours = el('g', { class: 'av-frise-jours' }), gBarres = el('g', { class: 'av-frise-barres' }), gSeuil = el('g', { class: 'av-frise-seuil' });
    const gCotes = el('g', { class: 'av-frise-cotes' }), gTete = el('g', { class: 'av-frise-tete' });
    const ligneTete = el('line', { y1: 0, class: 'av-frise-tete-ligne' }, gTete), poignee = el('rect', { width: 12, height: 12, x: -6, class: 'av-frise-poignee' }, gTete);
    const etiq = el('g', { class: 'av-frise-etiq' }, gTete), etiqFond = el('rect', { height: 26, y: 0, class: 'av-frise-etiq-fond' }, etiq), etiqTxt = el('text', { y: 18, class: 'av-frise-etiq-txt' }, etiq);
    let barres = [], geo = null;

    function mise() {
      W = Math.max(280, Math.round(host.getBoundingClientRect().width));
      const H = W < 640 ? 118 : 132, top = 34, bas = H - 34, gx = 0;
      geo = { H, top, bas, X: (h) => gx + (h / T) * (W - gx), Yv: (v) => bas - (clamp(v, 0, MAX) / MAX) * (bas - top) };
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
      ligneTete.setAttribute('y2', geo.bas + 4); poignee.setAttribute('y', geo.bas - 1);
      dessinerFixe(); dessinerBarres(false); poserTete();
    }
    function dessinerFixe() {
      const { X, top, bas, H } = geo;
      gJours.replaceChildren(); gSeuil.replaceChildren(); gCotes.replaceChildren();
      // jours : séparateurs à minuit, nom en haut ; graduations toutes les 3 h, heures écrites toutes les 6 h si la place le permet
      const pasTxt = W >= 900 ? 6 : W >= 560 ? 12 : 0;
      for (let h = 0; h <= T; h++) {
        const hd = (h + 6) % 24;
        if (hd === 0) el('line', { x1: X(h), x2: X(h), y1: 0, y2: bas, class: 'av-frise-minuit' }, gJours);
        else if (hd % 3 === 0) el('line', { x1: X(h), x2: X(h), y1: bas, y2: bas + (hd % 6 ? 4 : 7), class: 'av-frise-grad' }, gJours);
        if (pasTxt && hd % pasTxt === 0 && hd !== 0 && X(h) > 24 && X(h) < W - 24) { const tx = el('text', { x: X(h), y: bas + 24, class: 'av-frise-heure' }, gJours); tx.textContent = `${hd}${NB}h`; }
      }
      for (let j = 0; j < 4; j++) { const h0 = j === 0 ? 0 : j * 24 - 6; const tx = el('text', { x: X(h0) + (j === 0 ? 0 : 8), y: 16, class: 'av-frise-jour' }, gJours); tx.textContent = W < 560 ? JC[j] : JOURS[j]; }
      el('line', { x1: 0, x2: W, y1: bas, y2: bas, class: 'av-frise-base' }, gJours);
      // seuil
      if (seuil > 0) {
        el('line', { x1: 0, x2: W, y1: geo.Yv(seuil), y2: geo.Yv(seuil), class: 'av-frise-seuil-ligne' }, gSeuil);
      }
      // cotes des créneaux : traits d'attache et ligne de cote, comme sur un plan
      for (const c of taches) {
        const x0 = X(c.de), x1 = X(c.a), y = top - 8;
        const g = el('g', { class: 'av-frise-cote' + (c.etat ? ' est-' + c.etat : '') }, gCotes);
        el('line', { x1: x0, x2: x0, y1: y - 5, y2: bas, class: 'av-frise-attache' }, g);
        el('line', { x1: x1, x2: x1, y1: y - 5, y2: bas, class: 'av-frise-attache' }, g);
        el('line', { x1: x0, x2: x1, y1: y, y2: y, class: 'av-frise-cote-ligne' }, g);
        for (const xx of [x0, x1]) el('line', { x1: xx - 3, x2: xx + 3, y1: y + 3, y2: y - 3, class: 'av-frise-cote-tic' }, g);
      }
    }
    let vues = null, tween = 0; // hauteurs affichées (mm/h), animées vers les nouvelles valeurs
    function dessinerBarres(anime) {
      const { X, bas } = geo;
      if (barres.length !== T) {
        gBarres.replaceChildren(); barres = [];
        for (let h = 0; h < T; h++) { const r = el('rect', { class: 'av-frise-barre' }, gBarres), cap = el('line', { class: 'av-frise-cap' }, gBarres); barres.push({ r, cap }); }
      }
      const cible = Array.from({ length: T }, (_, h) => (serie ? serie[h].pluie : 0));
      const bloque = cible.map((v, h) => taches.some((c) => h >= c.de && h < c.a && c.etat === 'bloquee') && v > seuil);
      barres.forEach((b, h) => {
        const x = X(h) + 0.5, w = Math.max(1, X(h + 1) - X(h) - 1.5);
        b.r.setAttribute('x', x); b.r.setAttribute('width', w); b.cap.setAttribute('x1', x); b.cap.setAttribute('x2', x + w);
        b.r.setAttribute('fill', `url(#${id}${bloque[h] ? 'b' : 'p'})`); b.r.classList.toggle('est-bloquee', bloque[h]); b.cap.classList.toggle('est-bloquee', bloque[h]);
      });
      const poser = (vals) => barres.forEach((b, h) => {
        const y = geo.Yv(vals[h]); b.r.setAttribute('y', y.toFixed(2)); b.r.setAttribute('height', Math.max(0, bas - y).toFixed(2));
        b.cap.setAttribute('y1', y.toFixed(2)); b.cap.setAttribute('y2', y.toFixed(2)); b.cap.style.opacity = vals[h] < 0.05 ? 0 : 1;
      });
      cancelAnimationFrame(tween);
      if (!anime || reduit || !vues) { vues = cible.slice(); poser(vues); return; }
      const de = vues.slice(), t0 = performance.now(), D = 520, ETAL = 360;
      const pas = (now) => {
        let fini = true;
        for (let h = 0; h < T; h++) {
          const q = clamp((now - t0 - (h / T) * ETAL) / D, 0, 1), e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
          vues[h] = de[h] + (cible[h] - de[h]) * e; if (q < 1) fini = false;
        }
        poser(vues); if (!fini) tween = requestAnimationFrame(pas);
      };
      tween = requestAnimationFrame(pas);
    }
    function poserTete() {
      const x = geo.X(t);
      gTete.setAttribute('transform', `translate(${x.toFixed(2)} 0)`);
      const j = jourDe(t), txt = `${JC[Math.min(j, 4)]} · ${heure(t)}`;
      etiqTxt.textContent = txt;
      const w = Math.max(96, txt.length * 8.4 + 22);
      const dx = clamp(-w / 2, -x, W - x - w);
      etiqFond.setAttribute('x', dx); etiqFond.setAttribute('width', w); etiqTxt.setAttribute('x', dx + w / 2);
      // le nom du jour que l'étiquette recouvre s'efface (et revient quand elle passe)
      const g0 = x + dx - 6, g1 = x + dx + w + 6;
      gJours.querySelectorAll('.av-frise-jour').forEach((tj) => { const bx = tj.getBBox(); tj.style.opacity = bx.x < g1 && bx.x + bx.width > g0 ? 0 : 1; });
      const v = serie ? serie[Math.min(T, Math.round(t))] : null;
      svg.setAttribute('aria-valuenow', String(Math.round(t)));
      svg.setAttribute('aria-valuetext', `${JOURS[Math.min(j, 3)] || 'samedi 17'}, ${heure(t)}` + (v ? ` : pluie ${nombre(v.pluie)} mm/h, rafales ${Math.round(v.rafales)} km/h` : ''));
    }
    // ---------- Interaction ----------
    let drag = false;
    const depuisX = (cx) => { const r = svg.getBoundingClientRect(); return clamp(((cx - r.left) / r.width) * T, 0, T); };
    svg.addEventListener('pointerdown', (e) => { drag = true; svg.setPointerCapture(e.pointerId); host.classList.add('est-saisie'); changer(depuisX(e.clientX), 'pointeur'); });
    svg.addEventListener('pointermove', (e) => { if (drag) changer(depuisX(e.clientX), 'pointeur'); });
    const lacher = () => { if (!drag) return; drag = false; host.classList.remove('est-saisie'); o.onFin && o.onFin(t); };
    svg.addEventListener('pointerup', lacher); svg.addEventListener('pointercancel', lacher);
    svg.addEventListener('keydown', (e) => {
      const pas = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1, PageDown: -6, PageUp: 6 }[e.key];
      if (pas) { e.preventDefault(); changer(clamp(Math.round(t) + pas, 0, T), 'clavier'); }
      else if (e.key === 'Home') { e.preventDefault(); changer(0, 'clavier'); }
      else if (e.key === 'End') { e.preventDefault(); changer(T, 'clavier'); }
    });
    function changer(v, source) { t = v; poserTete(); o.onChange && o.onChange(t, source); }

    const ro = new ResizeObserver(() => mise()); ro.observe(host);
    mise();
    return {
      set(v) { t = clamp(v, 0, T); poserTete(); },
      donnees(d) { if (d.serie) serie = d.serie; if (d.taches) taches = d.taches; if (d.seuil !== undefined) seuil = d.seuil; dessinerFixe(); dessinerBarres(true); poserTete(); },
      get t() { return t; }, get saisie() { return drag; },
      detruire() { ro.disconnect(); host.replaceChildren(); },
    };
  }
  A.frise = frise;
})();
