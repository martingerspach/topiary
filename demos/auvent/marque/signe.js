/* Auvent · le signe (v2) : un cercle de pluie, un auvent à festons, un quart sec dessous.
   Références :
   - le modèle de station synoptique de l'OMM : un cercle dont le remplissage dit la nébulosité ; ici, la hachure dit la pluie ;
   - le symbole du front chaud (demi-cercles) lu comme le lambrequin festonné d'un store banne ;
   - la hachure de coupe du dessin de bâtiment, inclinée par le vent (la pluie vient de l'ouest, comme les fronts).
   Le mouvement (1,6 s) :
   - la pluie arrive : des traits courts qui tombent, se rapprochent et s'épaississent jusqu'à la hachure ;
   - le store à projection se relève depuis le mur (bras pendants, pivot à droite hors du cercle) jusqu'à l'horizontale,
     avec un ressort amorti (ζ = 0,7 : 4° de dépassement, le rebond de fin de course d'un vrai store) ;
   - sous lui, la pluie déjà tombée continue de tomber à vitesse constante (vitesse limite des gouttes) : le quart sec se vide ;
   - le lambrequin, souple, se balance après l'arrêt et s'immobilise ;
   - dans le logotype, les lettres arrivent penchées par le vent et se redressent (au vent), une à une.
   Tout est calculé pour un instant donné (figer(ms)) : la même fonction sert l'écran, les captures et les films. */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const NS = 'http://www.w3.org/2000/svg';
  // Le signe canonique, dans un carré de 120 : anneau de 55 (épaisseur 4,2), 8 traits sur le diamètre, pluie à 19,5°.
  const CANON = { a: 0.34, n: 8, wr: 0.42, R: 55, c: 4.2, ya: 56, h: 7, fa: 0.36, nf: 3, phase: 0.5 };
  // Sous 40 px : 5 traits plus gras et un anneau plus épais, sinon la hachure devient un gris.
  const PETIT = { n: 5, wr: 0.46, c: 6.5, h: 8 };
  // Favicon (16 à 24 px) : 4 traits, 2 festons, anneau épais ; dessiné pour la grille de 16.
  const MINI = { n: 4, wr: 0.5, c: 10, h: 11, nf: 2, ya: 54, fa: 0.3, phase: 0.5 };
  const DUREE = 1600;
  const T = { anneau: [0, 420], pluie: [0, 900], front: 0.3, store: 430, vitesse: 0.14, mot: 600, motDuree: 900, motPas: 50, penche: 560 };

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const easeOut3 = (x) => 1 - Math.pow(1 - x, 3);
  const easeOut5 = (x) => 1 - Math.pow(1 - x, 5);
  const easeInOut3 = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  // cubic-bezier(.2, 1.25, .35, 1) : la courbe « cordeau » des tokens, résolue par Newton.
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x; for (let i = 0; i < 8; i++) { const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; } return Y(clamp(t)); };
  }
  const cordeau = bezier(0.2, 1.25, 0.35, 1);
  // Ressort amorti depuis 1 vers 0, vitesse initiale nulle.
  function ressort(tau, zeta = 0.7, w = 0.0098) {
    if (tau <= 0) return 1;
    const wd = w * Math.sqrt(1 - zeta * zeta), e = Math.exp(-zeta * w * tau);
    return e * (Math.cos(wd * tau) + ((zeta * w) / wd) * Math.sin(wd * tau));
  }

  // ---------- Géométrie ----------
  function geo(o = {}) {
    const p = { ...CANON, ...o };
    const cx = 60, cy = 60, r = p.R - p.c;
    const sin = Math.sin(p.a), cos = Math.cos(p.a);
    const pasP = (2 * r) / p.n, pas = pasP / cos, w = pasP * p.wr;
    const yb = p.ya + p.h;
    const xEnd = cx + Math.sqrt(r * r - (yb - cy) ** 2) - 0.4;
    const xL = cx - Math.sqrt(r * r - (p.ya - cy) ** 2);
    const xa = xL + (xEnd - xL) * p.fa;
    const pivot = [cx + p.R + 3, p.ya]; // le mur : hors du cercle, le store replié y reste caché
    const rays = [];
    for (let k = -p.n - 2; k <= p.n + 2; k++) {
      const P = [cx + (k + p.phase) * pas, cy];
      const bx = P[0] - cx, by = P[1] - cy;
      const b = bx * sin + by * cos, cc = bx * bx + by * by - r * r, disc = b * b - cc;
      if (disc <= 0) continue;
      const s0 = -b - Math.sqrt(disc), s1 = -b + Math.sqrt(disc);
      if (s1 - s0 < 0.6) continue;
      rays.push({ k, P, s0, s1 });
    }
    return { p, cx, cy, r, sin, cos, w, xa, xEnd, yb, pivot, L: pivot[0] - xa, rays };
  }
  const pt = (G, ray, s) => [ray.P[0] + G.sin * s, ray.P[1] + G.cos * s];
  // Intersection du rayon avec le dessus de l'auvent tourné de phi (radians, sens horaire de l'écran ; pi/2 = replié vers le haut).
  function touche(G, ray, phi) {
    const [px, py] = G.pivot, fx = px - G.L * Math.cos(phi), fy = py - G.L * Math.sin(phi);
    const ex = fx - px, ey = fy - py, dx = G.sin, dy = G.cos;
    const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) return null;
    const qx = px - ray.P[0], qy = py - ray.P[1];
    const s = (qx * ey - qy * ex) / den, u = (qx * dy - qy * dx) / den;
    return u >= 0 && u <= 1 && s > ray.s0 && s < ray.s1 ? s : null;
  }
  function auventD(G) {
    const { xa, xEnd, yb, pivot } = G, ya = pivot[1], n = G.p.nf, rr = (xEnd - xa) / n / 2;
    const f = (v) => +v.toFixed(3);
    let barre = `M${f(xa)} ${f(ya)}H${f(pivot[0])}V${f(yb)}H${f(xa)}Z`, festons = `M${f(xEnd)} ${f(yb - 0.6)}`;
    festons += `L${f(xEnd)} ${f(yb)}`;
    for (let i = n - 1; i >= 0; i--) { const c = xa + rr * (2 * i + 1); festons += `A${f(rr)} ${f(rr)} 0 0 1 ${f(c - rr)} ${f(yb)}`; }
    festons += `L${f(xa)} ${f(yb - 0.6)}Z`;
    return { barre, festons };
  }

  // ---------- Signe statique (chaîne SVG, utilisable sans DOM) ----------
  let uid = 0;
  function svg(o = {}) {
    const { pluie = 'currentColor', auvent = 'var(--av-marque-auvent, #2340D0)', titre = 'Auvent', petit = false, attrs = '' } = o;
    const G = geo(petit === 'mini' ? MINI : petit ? PETIT : o.geo || {});
    const id = 'av-s' + ++uid, f = (v) => +v.toFixed(3);
    let traits = '';
    for (const ray of G.rays) {
      const hit = touche(G, ray, 0), a = pt(G, ray, ray.s0), b = pt(G, ray, hit ?? ray.s1);
      traits += `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`;
    }
    const d = auventD(G);
    return `<svg viewBox="0 0 120 120" ${attrs} role="img" aria-label="${titre}"><defs><clipPath id="${id}"><circle cx="60" cy="60" r="${f(G.r)}"/></clipPath></defs>` +
      `<g clip-path="url(#${id})"><g stroke="${pluie}" stroke-width="${f(G.w)}">${traits}</g><path d="${d.barre}" fill="${auvent}"/><path d="${d.festons}" fill="${auvent}"/></g>` +
      `<circle cx="60" cy="60" r="${f(G.p.R - G.p.c / 2)}" fill="none" stroke="${pluie}" stroke-width="${G.p.c}"/></svg>`;
  }

  // ---------- Le mot ----------
  const APPROCHE = -22; // interlettrage de la marque, en unités de police
  function motPaths() {
    const M = A.motData; if (!M) return null;
    let x = 0; const out = [];
    M.lettres.forEach((g, i) => { out.push({ ch: g.ch, x, d: g.d, adv: g.adv }); x += g.adv + (i < M.lettres.length - 1 ? APPROCHE : 0); });
    return { lettres: out, largeur: x, xh: M.xHeight, cap: M.capHeight };
  }
  // Logotype : le signe à gauche, centré sur la hauteur d'x ; diamètre de l'anneau = 1,42 hauteur de capitale.
  function logotypeGeo(petit) {
    const mot = motPaths(), D = 1.52 * mot.cap, k = D / 110; // 110 = diamètre extérieur de l'anneau dans le carré de 120
    const cyMot = mot.xh / 2, gap = 0.3 * D;
    const sx = 0, sy = cyMot + 60 * k; // le carré de 120 placé pour que son centre tombe sur le milieu de la hauteur d'x
    const x0 = 120 * k + gap - 5 * k;
    const haut = sy, bas = sy - 120 * k;
    return { mot, k, D, x0, sx, sy, largeur: x0 + mot.largeur, haut, bas, petit };
  }
  function logotype(o = {}) {
    const { pluie = 'currentColor', mot = 'currentColor', auvent = 'var(--av-marque-auvent, #2340D0)', titre = 'Auvent', attrs = '' } = o;
    const L = logotypeGeo(o.petit), f = (v) => +v.toFixed(2);
    const m = 30; // marge de sécurité, en unités de police
    const vb = [-m, -(L.haut + m), L.largeur + 2 * m, L.haut - L.bas + 2 * m];
    const inner = svg({ pluie, auvent, petit: o.petit }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const lettres = L.mot.lettres.map((g) => `<path transform="translate(${f(L.x0 + g.x)} 0) scale(1 -1)" d="${g.d}"/>`).join('');
    return `<svg viewBox="${vb.map(f).join(' ')}" ${attrs} role="img" aria-label="${titre}"><g transform="translate(${f(L.sx)} ${f(-L.sy)}) scale(${f(L.k)})">${inner}</g><g fill="${mot}">${lettres}</g></svg>`;
  }

  // ---------- Animation ----------
  function monter(el, o = {}) {
    const version = o.version || 'signe';
    const reduit = o.anime === false || (o.anime !== true && matchMedia('(prefers-reduced-motion: reduce)').matches);
    const G = geo(o.petit ? PETIT : {});
    const s = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
    const id = 'av-m' + ++uid;
    let root, signeG, L = null;
    if (version === 'logotype') {
      L = logotypeGeo(o.petit);
      const m = 30;
      root = s('svg', { viewBox: [-m, -(L.haut + m), L.largeur + 2 * m, L.haut - L.bas + 2 * m].map((v) => +v.toFixed(2)).join(' '), role: 'img', 'aria-label': o.titre || 'Auvent' });
      signeG = s('g', { transform: `translate(${L.sx} ${-L.sy}) scale(${L.k})` });
      root.appendChild(signeG);
    } else {
      root = s('svg', { viewBox: '0 0 120 120', role: 'img', 'aria-label': o.titre || 'Auvent' });
      signeG = root;
    }
    root.classList.add('av-signe');
    const defs = s('defs'), clip = s('clipPath', { id }); clip.appendChild(s('circle', { cx: 60, cy: 60, r: G.r })); defs.appendChild(clip); signeG.appendChild(defs);
    const anneau = s('g'); anneau.appendChild(s('circle', { cx: 60, cy: 60, r: G.p.R - G.p.c / 2, fill: 'none', stroke: 'var(--av-marque-pluie, currentColor)', 'stroke-width': G.p.c }));
    const zone = s('g', { 'clip-path': `url(#${id})` });
    const pluieG = s('g', { stroke: 'var(--av-marque-pluie, currentColor)', 'stroke-width': G.w, fill: 'none' });
    const d = auventD(G);
    const store = s('g'), barre = s('path', { d: d.barre, fill: 'var(--av-marque-auvent, #2340D0)' }), lamb = s('g'), festons = s('path', { d: d.festons, fill: 'var(--av-marque-auvent, #2340D0)' });
    lamb.appendChild(festons); store.append(barre, lamb);
    zone.append(pluieG, store); signeG.append(zone, anneau);
    const lignes = G.rays.map(() => { const hautL = s('line'), basL = s('line'); pluieG.append(hautL, basL); return { hautL, basL }; });
    let lettres = [];
    if (L) {
      // le mot sort de derrière le signe, poussé par le vent : découpe verticale au bord de l'anneau
      const xc = L.sx + 115 * L.k + 0.5 * (L.x0 - (L.sx + 115 * L.k)); // à mi-chemin entre l'anneau et le mot
      const cm = s('clipPath', { id: id + 'm' }); cm.appendChild(s('rect', { x: xc, y: -L.haut - 400, width: L.largeur + 800, height: L.haut - L.bas + 800 })); defs.appendChild(cm);
      L.xc = xc;
      const mg = s('g', { fill: 'var(--av-marque-mot, currentColor)', 'clip-path': `url(#${id}m)` });
      lettres = L.mot.lettres.map((g) => { const pth = s('path', { d: g.d }); mg.appendChild(pth); return { g, pth }; });
      root.appendChild(mg);
    }
    el.replaceChildren(root);

    // Angle du store dans le temps, et instant où il atteint chaque rayon (calculé une fois, pour que figer(ms) soit exact à tout instant).
    // Replié, il pend le long du mur (−90°) ; les festons sont alors hors du cercle.
    const PHI0 = -Math.PI / 2;
    const phiDe = (ms) => PHI0 * ressort(ms - T.store);
    const qMin = 60 * G.sin + 60 * G.cos - G.r;
    const qFront = (ms) => qMin + T.front * ms;
    const tCut = G.rays.map((ray) => { for (let ms = T.store; ms <= DUREE; ms += 1) { const h = touche(G, ray, phiDe(ms)); if (h !== null) return { ms, s: h }; } return null; });
    // premier passage à l'horizontale : départ du balancement du lambrequin
    let tArr = DUREE; for (let ms = T.store; ms < DUREE; ms++) if (phiDe(ms) >= 0) { tArr = ms; break; }

    const f = (v) => +v.toFixed(3);
    function poser(ms) {
      // anneau
      const qa = easeOut3(clamp((ms - T.anneau[0]) / (T.anneau[1] - T.anneau[0])));
      anneau.setAttribute('opacity', f(qa)); anneau.setAttribute('transform', `translate(60 60) scale(${f(0.94 + 0.06 * qa)}) translate(-60 -60)`);
      // pluie : traits courts qui tombent, se rapprochent et s'épaississent
      const qp = easeInOut3(clamp((ms - T.pluie[0]) / (T.pluie[1] - T.pluie[0])));
      const tiret = 7 + 10 * qp, vide = 20 * (1 - qp), periode = tiret + vide, solide = vide < 0.05;
      pluieG.setAttribute('stroke-width', f(G.w * (0.42 + 0.58 * qp)));
      const chute = T.vitesse * ms;
      const phi = phiDe(ms);
      store.setAttribute('transform', `rotate(${f((phi * 180) / Math.PI)} ${f(G.pivot[0])} ${f(G.pivot[1])})`);
      // balancement du lambrequin : pendule amorti, cisaillement autour du bas de la barre
      const tau = ms - tArr;
      const sway = tau > 0 ? 6 * Math.exp(-tau / 260) * Math.sin(tau / 62) : 0;
      lamb.setAttribute('transform', `translate(0 ${f(G.yb)}) skewX(${f(sway)}) translate(0 ${f(-G.yb)})`);
      G.rays.forEach((ray, i) => {
        const { hautL, basL } = lignes[i];
        const hit = ms >= T.store ? touche(G, ray, phi) : null;
        const fin = hit ?? ray.s1;
        // la pluie arrive : un front perpendiculaire à la chute avance à travers le cercle
        const sLim = qFront(ms) - (ray.P[0] * G.sin + ray.P[1] * G.cos);
        const finV = Math.min(fin, sLim);
        if (finV <= ray.s0 + 0.1) hautL.setAttribute('visibility', 'hidden'); else hautL.removeAttribute('visibility');
        const a = pt(G, ray, ray.s0), b = pt(G, ray, Math.max(ray.s0, finV));
        hautL.setAttribute('x1', f(a[0])); hautL.setAttribute('y1', f(a[1])); hautL.setAttribute('x2', f(b[0])); hautL.setAttribute('y2', f(b[1]));
        const dash = (sStart, el2) => {
          if (solide) { el2.removeAttribute('stroke-dasharray'); el2.removeAttribute('stroke-dashoffset'); return; }
          const graine = ((Math.sin(ray.k * 12.9898 + 4.1) * 43758.5453) % 1 + 1) % 1 * periode; // décalage pseudo-aléatoire propre à chaque trait
          el2.setAttribute('stroke-dasharray', `${f(tiret)} ${f(vide)}`);
          el2.setAttribute('stroke-dashoffset', f((((sStart - chute - graine) % periode) + periode) % periode));
        };
        dash(ray.s0, hautL);
        // sous l'auvent : la pluie déjà tombée s'écoule
        const c = tCut[i];
        if (c && ms >= c.ms) {
          const top = Math.max(hit ?? -Infinity, c.s + T.vitesse * (ms - c.ms));
          if (top < ray.s1 - 0.2) {
            const p0 = pt(G, ray, top), p1 = pt(G, ray, ray.s1);
            basL.setAttribute('x1', f(p0[0])); basL.setAttribute('y1', f(p0[1])); basL.setAttribute('x2', f(p1[0])); basL.setAttribute('y2', f(p1[1]));
            basL.removeAttribute('visibility'); dash(top, basL);
          } else basL.setAttribute('visibility', 'hidden');
        } else basL.setAttribute('visibility', 'hidden');
      });
      // lettres : penchées par le vent, elles se redressent une à une
      // translation : décélération franche, sans rebond (un rebond sur toute la largeur du mot faisait dessin animé)
      const eMot = L ? easeOut5(clamp((ms - T.mot) / T.motDuree)) : 1, dxMot = L ? -(L.mot.largeur + (L.x0 - L.xc) + 40) * (1 - eMot) : 0;
      const nL = lettres.length;
      lettres.forEach(({ g, pth }, i) => {
        // le t sort le premier ; chaque lettre reste penchée par le vent un instant puis se redresse
        const q = clamp((ms - T.mot - 90 - (nL - 1 - i) * T.motPas) / T.penche), sk = -11 * (1 - cordeau(q));
        pth.setAttribute('transform', `translate(${f(L.x0 + g.x + dxMot)} 0) skewX(${f(sk)}) scale(1 -1)`);
      });
    }
    let raf = 0, t0 = 0;
    const fin = DUREE + (L ? T.motPas * 6 : 0);
    function boucle(now) { if (!t0) t0 = now; const ms = now - t0; poser(Math.min(ms, fin)); if (ms < fin) raf = requestAnimationFrame(boucle); }
    const ctl = {
      DUREE: fin, svg: root,
      rejouer() { cancelAnimationFrame(raf); t0 = 0; if (reduit) poser(fin); else raf = requestAnimationFrame(boucle); },
      figer(ms) { cancelAnimationFrame(raf); poser(clamp(ms, 0, fin)); },
      arreter() { cancelAnimationFrame(raf); },
    };
    if (o.fige !== undefined) poser(o.fige); else if (reduit) poser(fin); else ctl.rejouer();
    return ctl;
  }

  A.signe = { CANON, PETIT, MINI, DUREE, geo, svg, logotype, logotypeGeo, monter };
})();
