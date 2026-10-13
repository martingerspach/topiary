/* Auvent · logotype vivant (script classique, expose window.Auvent.marque ; requiert marque-data.js et lib/trace.js)
   Signature animée « le front se pose » :
   le mot s'affiche sans la barre du t (« auvenl ») ; un front froid, encore bombé comme sur une carte du temps,
   monte de la ligne de base vers la hauteur d'x, traverse le fût du t et s'aplatit en ralentissant (courbe « front ») ;
   ses dents se forment de gauche à droite, pointées vers où va le front ; il se pose en barre du t (courbe « cordeau » :
   un dépassement de 2 %, comme un cordeau claqué). Le t est complet : « auvent ». Durée 1,4 s.
   Références : les fronts animés des cartes de prévision télévisées (translation et déformation continues, jamais de
   remplissage), le cordeau à tracer bleu des chantiers. En mouvements réduits, le logotype s'affiche fini.
   Usage : Auvent.marque.monter(conteneur, { anime: true, version: 'front' | 'compact', titre: 'Auvent' }) -> { rejouer() } */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const D = () => A.marqueData;
  const NS = 'http://www.w3.org/2000/svg';
  const reduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Courbes de Bézier cubiques (mêmes valeurs que les tokens --av-ease-front et --av-ease-cordeau)
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => { let t = x; for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-5 || !d) break; t -= e / d; } return Y(Math.min(1, Math.max(0, t))); };
  }
  const easeFront = bezier(0.45, 0.05, 0.35, 1), easeCordeau = bezier(0.2, 1.25, 0.35, 1);
  const clamp = (v) => Math.min(1, Math.max(0, v));

  function monter(conteneur, opts = {}) {
    const d = D(), version = opts.version || 'front';
    const b = d.barre, yc = (b.y0 + b.y1) / 2, th = b.y1 - b.y0;
    const x1 = version === 'compact' ? d.tFin + 300 : b.x1;
    const Lf = x1 - b.x0;
    const haut = version === 'compact' ? d.ascendante : Math.max(d.ascendante, b.y1 + 160);
    const vb = [-20, -haut - 30, x1 + 40, haut + 60];
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', vb.join(' '));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', opts.titre || 'Auvent');
    svg.classList.add('av-marque');
    svg.innerHTML = `<g transform="scale(1,-1)"><path class="av-marque-mot" d="${d.mot}"/>` +
      `<path class="av-marque-ligne" fill="none" stroke-width="${th}" stroke-linecap="butt"/><path class="av-marque-dents"/></g>`;
    conteneur.replaceChildren(svg);
    const mot = svg.querySelector('.av-marque-mot'), ligne = svg.querySelector('.av-marque-ligne'), dents = svg.querySelector('.av-marque-dents');
    mot.style.fill = 'var(--av-marque-mot, var(--av-text))';
    ligne.style.stroke = 'var(--av-marque-front, var(--av-accent))';
    dents.style.fill = 'var(--av-marque-front, var(--av-accent))';
    const pasDents = version === 'compact' ? [] : d.dents;

    // État à l'instant u (0..1) : centre de la ligne en arc de cercle (dôme), de longueur constante Lf.
    // La ligne monte de la ligne de base à la hauteur d'x sans quitter le cadre du logotype ; le dôme s'aplatit
    // (courbe « front ») ; la montée finit en « cordeau » (léger dépassement, puis la barre se pose).
    function etat(u) {
      const a = easeFront(clamp(u / 0.8)), r = easeCordeau(u);
      const theta0 = ((22 * Math.PI) / 180) * (1 - a);
      const kappa = (-2 * theta0) / Lf;
      const x0 = b.x0, y0 = yc - 500 * (1 - r) - (Lf / 2) * Math.tan(theta0 / 2) * 0.9;
      const N = 48, pts = [[x0, y0]];
      let x = x0, y = y0;
      for (let i = 1; i <= N; i++) { const ds = Lf / N, ang = theta0 + kappa * (i - 0.5) * ds; x += Math.cos(ang) * ds; y += Math.sin(ang) * ds; pts.push([x, y]); }
      return { pts, opacite: clamp(u / 0.2), croissance: (i, s) => clamp((u - 0.18 - s * 0.35) / 0.32) };
    }
    function peindreFinal() {
      ligne.setAttribute('d', `M${b.x0} ${yc}L${x1} ${yc}`);
      ligne.style.opacity = dents.style.opacity = 1;
      dents.setAttribute('d', pasDents.map((p) => `M${p.x - p.base / 2} ${b.y1}L${p.x} ${b.y1 + p.haut}L${p.x + p.base / 2} ${b.y1}Z`).join(''));
    }
    // Version animée : la base des dents suit le bord haut du trait courbe
    const peindreAnime = (u) => {
      const e = etat(u);
      ligne.setAttribute('d', A.trace.lineD(e.pts));
      ligne.style.opacity = dents.style.opacity = e.opacite;
      const acc = A.trace.measure(e.pts);
      dents.setAttribute('d', pasDents.map((p, i) => {
        const s = p.x - b.x0, g = e.croissance(i, s / Lf);
        if (g <= 0) return '';
        const c = A.trace.at(e.pts, acc, s), nx = -c.ty, ny = c.tx, hb = p.base / 2, o = th / 2;
        const bx = c.x + nx * o, by = c.y + ny * o;
        return `M${(bx - c.tx * hb).toFixed(1)} ${(by - c.ty * hb).toFixed(1)}L${(bx + nx * p.haut * g).toFixed(1)} ${(by + ny * p.haut * g).toFixed(1)}L${(bx + c.tx * hb).toFixed(1)} ${(by + c.ty * hb).toFixed(1)}Z`;
      }).join(''));
    };

    let raf = 0;
    function jouer() {
      cancelAnimationFrame(raf);
      if (opts.anime === false || reduit()) { peindreFinal(); opts.fin && opts.fin(); return; }
      const duree = opts.duree || 1400, t0 = performance.now();
      peindreAnime(0);
      const pas = (now) => {
        const u = Math.min(1, (now - t0) / duree);
        if (u < 1) { peindreAnime(u); raf = requestAnimationFrame(pas); }
        else { peindreFinal(); opts.fin && opts.fin(); }
      };
      raf = requestAnimationFrame(pas);
    }
    // ?t= fige un instant (captures image par image)
    const fige = new URLSearchParams(location.search).get('marque');
    if (fige !== null) { const u = +fige; u >= 1 ? peindreFinal() : peindreAnime(u); }
    else jouer();
    return { rejouer: jouer, figer: (u) => (u >= 1 ? peindreFinal() : peindreAnime(u)), svg };
  }

  A.marque = { monter };
})();
