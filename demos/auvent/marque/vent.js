/* Auvent · le logotype « au vent » (v3, 2026-10-09).
   Idée : le mot se plie lui-même. « au » reste droit ; « vent » ploie de plus en plus, lettre après lettre, comme des tiges
   sous une rafale. Pied ancré, haut qui fléchit (déformation x' = x + k·H·(y/H)^1,8, H = hauteur d'x) : une flexion,
   pas un faux italique. Les pentes 0 · 0 · 4 · 9 · 14 · 19,5° finissent à l'angle de la pluie du système (19,5°).
   Références :
   - Neue (Oslo), Visit Nordkyn (2010) et l'Institut météorologique norvégien (2013) : des logos qui changent avec
     la météo réelle ; ici, la flexion suit le vent du chantier (mode vivant) ;
   - la typographie variable mise en mouvement (identités cinétiques), réduite à un seul paramètre lisible : le vent.
   Mouvement : une rafale traverse le mot de gauche à droite ; chaque lettre ploie avec un ressort amorti (ζ = 0,45 :
   elle dépasse sa pente, revient, se pose), décalée de 55 ms de la précédente, comme une onde dans un champ de blé.
   Mouvements réduits : le mot est posé d'emblée. Tout instant est calculable (figer(ms)) pour les captures et les films.
   Dessin : Archivo wght 620 wdth 112 (Omnibus-Type, OFL), contours extraits avec fontkit (marque/mot-data.js). */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const NS = 'http://www.w3.org/2000/svg';
  const H = 526, P = 1.8, APP = -24, COMP = 0.8;
  const PENTES = [0, 0, 4, 9, 14, 19.5];
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

  // ---------- Contours ----------
  function parse(d) {
    const t = d.match(/[MLQZ]|-?\d*\.?\d+(?:e-?\d+)?/g), out = []; let i = 0, c;
    while (i < t.length) { if (/[MLQZ]/.test(t[i])) c = t[i++]; const n = { M: 2, L: 2, Q: 4, Z: 0 }[c]; out.push([c, t.slice(i, i + n).map(Number)]); i += n; }
    return out;
  }
  let LETTRES = null;
  function lettres() {
    if (LETTRES) return LETTRES;
    const M = A.motData; let x = 0;
    LETTRES = M.lettres.map((g, i) => { const l = { ch: g.ch, x, adv: g.adv, cmds: parse(g.d) }; x += g.adv + (i < M.lettres.length - 1 ? APP : 0); return l; });
    LETTRES.largeur = x; return LETTRES;
  }
  // Déformation d'un contour (courbes subdivisées en 4 : précision sous le dixième d'unité à ces flexions)
  function plier(cmds, k) {
    if (Math.abs(k) < 1e-6) return cmds.map(([c, v]) => c + v.map((n) => +n.toFixed(1)).join(' ')).join('');
    const f = (x, y) => [x + k * H * Math.sign(y) * Math.pow(Math.abs(y) / H, P), y];
    let d = '', cx = 0, cy = 0;
    const r = (v) => v.toFixed(1);
    for (const [c, v] of cmds) {
      if (c === 'M' || c === 'L') { const [a, b] = f(v[0], v[1]); d += c + r(a) + ' ' + r(b); cx = v[0]; cy = v[1]; }
      else if (c === 'Q') {
        const [qx, qy, x, y] = v, N = 4, B = (t) => [(1 - t) ** 2 * cx + 2 * (1 - t) * t * qx + t * t * x, (1 - t) ** 2 * cy + 2 * (1 - t) * t * qy + t * t * y];
        for (let j = 1; j <= N; j++) {
          const t0 = (j - 1) / N, t1 = j / N, F0 = f(...B(t0)), F1 = f(...B(t1)), Fm = f(...B((t0 + t1) / 2));
          d += `Q${r(2 * Fm[0] - (F0[0] + F1[0]) / 2)} ${r(2 * Fm[1] - (F0[1] + F1[1]) / 2)} ${r(F1[0])} ${r(F1[1])}`;
        }
        cx = x; cy = y;
      } else d += 'Z';
    }
    return d;
  }
  // Placement : pentes (degrés) -> chemins et décalages (compensation optique des blancs à 60 % de la hauteur d'x)
  function poser(pentes) {
    const L = lettres(); let dx = 0, kPrev = 0;
    const depl = (k) => k * H * Math.pow(0.6, P);
    return L.map((l, i) => {
      const k = Math.tan((pentes[i] * Math.PI) / 180);
      dx -= (depl(k) - depl(kPrev)) * COMP; kPrev = k;
      return { x: l.x + dx, d: plier(l.cmds, k) };
    });
  }
  const BOITE = (() => { const m = 40; return { x: -m, y: -(720 + m), w: 3600 + 2 * m, h: 720 + 30 + 2 * m }; })();
  function largeurPosee() { const p = poser(PENTES); return lettres().largeur + (p[5].x - lettres()[5].x) + 260; }

  // ---------- Statique ----------
  function logotype(o = {}) {
    const { couleur = 'currentColor', titre = 'Auvent', attrs = '', pentes = PENTES } = o;
    const p = poser(pentes), w = largeurPosee();
    return `<svg viewBox="-30 -750 ${(w + 60).toFixed(0)} 800" ${attrs} role="img" aria-label="${titre}"><g transform="scale(1 -1)" fill="${couleur}">` +
      p.map((q) => `<path transform="translate(${q.x.toFixed(1)} 0)" d="${q.d}"/>`).join('') + '</g></svg>';
  }
  // Monogramme : le a, dont le fût ploie à l'angle de la pluie, dans un carré cobalt (favicon, icône d'app)
  function monogramme(o = {}) {
    const { fond = '#2340D0', encre = '#FBF9F4', titre = 'Auvent', attrs = '', carre = true } = o;
    const a = lettres()[0], d = plier(a.cmds, Math.tan((19.5 * Math.PI) / 180));
    // le a fait 648 d'approche ; centré dans un carré de 1000
    const g = `<g transform="translate(${(500 - 340).toFixed(0)} 768) scale(1 -1)"><path d="${d}" fill="${carre ? encre : 'currentColor'}"/></g>`;
    return `<svg viewBox="0 0 1000 1000" ${attrs} role="img" aria-label="${titre}">${carre ? `<rect width="1000" height="1000" fill="${fond}"/>` : ''}${g}</svg>`;
  }

  // ---------- Animation et mode vivant ----------
  // Ressort amorti de 0 vers 1 (position), vitesse initiale nulle.
  function ressort(tau, zeta = 0.45, w = 0.0165) {
    if (tau <= 0) return 0;
    const wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * tau) * (Math.cos(wd * tau) + ((zeta * w) / wd) * Math.sin(wd * tau));
  }
  const DUREE = 1500, DECALE = 55, DEPART = 40;
  // la rafale touche tout le mot : une impulsion amortie s'ajoute à chaque lettre (« au » ploie puis se redresse)
  const coup = (tau) => (tau <= 0 ? 0 : 7 * Math.exp(-tau / 210) * Math.sin(tau / 95));
  function monter(el, o = {}) {
    const reduit = o.anime === false || (o.anime !== true && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const svg = document.createElementNS(NS, 'svg'), w = largeurPosee();
    svg.setAttribute('viewBox', `-30 -750 ${(w + 60).toFixed(0)} 800`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', o.titre || 'Auvent');
    svg.classList.add('av-vent');
    const g = document.createElementNS(NS, 'g'); g.setAttribute('transform', 'scale(1 -1)'); g.setAttribute('fill', 'currentColor'); svg.appendChild(g);
    const paths = lettres().map(() => { const p = document.createElementNS(NS, 'path'); g.appendChild(p); return p; });
    el.replaceChildren(svg);
    let cible = (o.pentes || PENTES).slice(), base = cible.map(() => 0), t0 = 0, raf = 0;
    const dessiner = (pentes) => poser(pentes).forEach((q, i) => { paths[i].setAttribute('transform', `translate(${q.x.toFixed(1)} 0)`); paths[i].setAttribute('d', q.d); });
    // pentes à l'instant ms d'une rafale qui mène de « base » à « cible »
    let coupAmp = 1;
    const a = (ms) => cible.map((c, i) => { const tau = ms - DEPART - i * DECALE; return base[i] + (c - base[i]) * ressort(tau) + coupAmp * coup(tau); });
    function poserMs(ms) { dessiner(a(ms)); }
    function boucle(now) { if (!t0) t0 = now; const ms = now - t0; poserMs(ms); if (ms < DUREE) raf = requestAnimationFrame(boucle); else dessiner(cible); }
    const ctl = {
      svg, DUREE,
      rafale(nouvelle = null, depuis = null, force = 1) { // rejoue une rafale ; « nouvelle » : pentes d'arrivée (mode vivant)
        cancelAnimationFrame(raf); coupAmp = force; base = depuis || (nouvelle ? cible.slice() : cible.map(() => 0)); if (nouvelle) cible = nouvelle.slice();
        if (reduit) { dessiner(cible); return; } t0 = 0; raf = requestAnimationFrame(boucle);
      },
      // vent du chantier (km/h) -> pentes : calme sous 10 km/h, pente maximale de la marque à 57 km/h et au-delà
      vent(kmh, anime = true) { const s = clamp((kmh - 10) / 47); const p = PENTES.map((v) => v * s); if (anime) ctl.rafale(p, cible.slice(), 0.35); else { cible = p; dessiner(p); } },
      // petite rafale (survol) : le mot ploie un peu plus et revient
      souffle() { if (reduit) return; ctl.rafale(cible.slice(), cible.slice(), 0.55); },
      figer(ms) { cancelAnimationFrame(raf); coupAmp = 1; base = cible.map(() => 0); poserMs(ms); },
      arreter() { cancelAnimationFrame(raf); },
    };
    if (o.fige !== undefined) ctl.figer(o.fige); else if (reduit || o.anime === false) dessiner(cible); else ctl.rafale();
    return ctl;
  }

  A.vent = { PENTES, DUREE, logotype, monogramme, monter, poser };
})();
