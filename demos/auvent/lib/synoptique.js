/* Auvent · rendu de la carte synoptique sur canvas (script classique, expose window.Auvent.synoptique)
   Usage : const carte = Auvent.synoptique(canvas, { vue: [x0, y0, x1, y1] (km), ville: 'nantes' });
           carte.set(heures); carte.ville('lyon'); carte.redessiner();
   Couleurs lues dans les variables CSS --av-* de l'élément (thème jour ou nuit).
   Ordre de dessin, comme une carte du temps imprimée : mer, isobares, terre, pluie hachurée, fronts, repères. */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const { carte: C, trace: T } = A;

  A.synoptique = function (canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const etat = { t: opts.t ?? 0, ville: opts.ville ?? null, vue: opts.vue ?? [-760, -640, 640, 600], echelle: 1, ox: 0, oy: 0, w: 0, h: 0, dpr: 1 };
    const css = (n) => getComputedStyle(canvas).getPropertyValue(n).trim();
    // Calques réutilisés d'une image à l'autre (l'animation de la landing redessine la carte à chaque image)
    const champ = document.createElement('canvas'), calque = document.createElement('canvas');
    let motifs = {}, terre = null, couleurs = null, tampons = null;
    function lireCouleurs() {
      couleurs = {
        mer: css('--av-bg'), terre: css('--av-surface'), trait: css('--av-line-strong'), filet: css('--av-line'),
        texte: css('--av-text'), doux: css('--av-text-muted'), froid: css('--av-accent'), occlus: css('--av-storm'),
        pluie: css('--av-accent'), fond: css('--av-surface'), police: css('--av-font') || 'sans-serif',
      };
      motifs = {};
    }
    // Hachures plein cadre, dessinées une fois par taille et par thème
    function motif(gap) {
      if (motifs[gap]) return motifs[gap];
      const m = document.createElement('canvas'); m.width = Math.round(etat.w * etat.dpr); m.height = Math.round(etat.h * etat.dpr);
      const mc = m.getContext('2d'); mc.setTransform(etat.dpr, 0, 0, etat.dpr, 0, 0);
      T.hachures(mc, etat.w, etat.h, gap, 1.15, couleurs.pluie, false);
      return (motifs[gap] = m);
    }

    function cadrer() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      etat.dpr = Math.min(opts.dprMax || 2, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * etat.dpr); canvas.height = Math.round(r.height * etat.dpr);
      etat.w = r.width; etat.h = r.height;
      const [x0, y0, x1, y1] = etat.vue;
      // « cover » : la vue remplit le cadre ; le centre de la vue reste au centre
      etat.echelle = Math.max(r.width / (x1 - x0), r.height / (y1 - y0));
      etat.ox = r.width / 2 - ((x0 + x1) / 2) * etat.echelle;
      etat.oy = r.height / 2 + ((y0 + y1) / 2) * etat.echelle;
      lireCouleurs();
      // La terre en coordonnées écran, une fois par cadrage
      terre = new Path2D();
      for (const poly of [C.FRANCE, C.CORSE]) poly.forEach(([la, lo], i) => { const [x, y] = ecran(C.project(la, lo)); i ? terre.lineTo(x, y) : terre.moveTo(x, y); });
      terre.closePath();
      calque.width = Math.round(r.width * etat.dpr); calque.height = Math.round(r.height * etat.dpr);
      return true;
    }
    const ecran = ([x, y]) => [etat.ox + x * etat.echelle, etat.oy - y * etat.echelle];
    const km = ([sx, sy]) => [(sx - etat.ox) / etat.echelle, (etat.oy - sy) / etat.echelle];

    function dessiner() {
      if (!etat.w && !cadrer()) return;
      const { w, h, dpr, t } = etat;
      const c = couleurs || (lireCouleurs(), couleurs);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = c.mer; ctx.fillRect(0, 0, w, h);

      // Isobares (tous les 4 hPa), fines ; la valeur est écrite sur une sur deux
      const vb = [km([0, h])[0] - 60, km([0, h])[1] - 60, km([w, 0])[0] + 60, km([w, 0])[1] + 60];
      const iso = C.isobares(t, vb, 4, opts.isoRes || 30);
      ctx.lineWidth = 1; ctx.strokeStyle = c.trait; ctx.globalAlpha = 0.55;
      for (const lv of iso) for (const ln of lv.lignes) { T.polyCanvas(ctx, ln.map(ecran)); ctx.stroke(); }
      ctx.globalAlpha = 1;

      // Terre : France et Corse, papier, contour fin
      ctx.fillStyle = c.terre; ctx.strokeStyle = c.doux; ctx.lineWidth = 1;
      ctx.fill(terre); ctx.stroke(terre);
      // Isobares redessinées très légèrement sur la terre (la carte reste lisible comme un tout)
      ctx.save(); ctx.clip(terre); ctx.strokeStyle = c.trait; ctx.globalAlpha = 0.35;
      for (const lv of iso) for (const ln of lv.lignes) { T.polyCanvas(ctx, ln.map(ecran)); ctx.stroke(); }
      ctx.restore(); ctx.globalAlpha = 1;
      // Étiquettes de pression
      ctx.font = `400 15px ${c.police}`; ctx.fillStyle = c.doux; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const lv of iso) {
        if (lv.niveau % 8) continue;
        const ln = lv.lignes.sort((a, b) => b.length - a.length)[0];
        if (!ln) continue;
        const q = ln[Math.floor(ln.length * 0.62)], p = ecran(q);
        if (p[0] < 30 || p[0] > w - 30 || p[1] < 20 || p[1] > h - 20) continue;
        ctx.fillStyle = C.surTerre(q[0], q[1]) ? c.terre : c.mer; ctx.fillRect(p[0] - 22, p[1] - 10, 44, 20); ctx.fillStyle = c.doux;
        ctx.fillText(String(lv.niveau), p[0], p[1]);
      }

      // Pluie : champ calculé sur une grille grossière, interpolé, seuillé à 0,4 et 1,6 mm/h, puis hachuré
      pluieHachuree(c);

      // Fronts
      const st = (pts) => T.lisse(pts.map(ecran), 5);
      const lw = Math.max(2, 2.5 * Math.min(1.4, etat.echelle / 0.55));
      const taille = 12 * Math.min(1.5, Math.max(0.8, etat.echelle / 0.6)), pas = taille * 2.6;
      dessinerFront(st(C.occlus(t)), 'occlus', c.occlus, lw, taille, pas, 1);
      dessinerFront(st(C.chaud(t)), 'chaud', c.doux, lw, taille, pas, -1);
      dessinerFront(st(C.froid(t)), 'froid', c.froid, lw, taille, pas, -1);

      // Centres d'action : D (dépression), A (anticyclone), en capitales de 26 px
      ctx.font = `600 26px ${c.police}`; ctx.fillStyle = c.texte;
      const L = ecran(C.low(t)); if (L[0] > 20 && L[0] < w - 20 && L[1] > 20 && L[1] < h - 20) ctx.fillText('D', L[0], L[1]);
      const H = ecran([300, -950]); if (H[0] > 20 && H[0] < w - 20 && H[1] > 20 && H[1] < h - 20) ctx.fillText('A', H[0], H[1]);

      // Repères des villes : petit carré (un chantier), plein pour la ville choisie
      for (const v of opts.villes === false ? [] : C.VILLES) {
        const [x, y] = ecran(v.xy), sel = v.id === etat.ville, s = sel ? 11 : 5;
        if (x < 0 || x > w || y < 0 || y > h) continue;
        ctx.fillStyle = sel ? c.texte : c.doux;
        if (sel) { ctx.fillStyle = c.fond; ctx.fillRect(x - s / 2 - 3, y - s / 2 - 3, s + 6, s + 6); ctx.fillStyle = c.texte; }
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      // Nom de la ville choisie, sur un cartouche papier, à droite du repère (à gauche si le bord est proche)
      const vs = C.VILLES.find((v) => v.id === etat.ville);
      if (vs && opts.etiquette !== false) {
        const [x, y] = ecran(vs.xy);
        ctx.font = `560 16px ${c.police}`; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(vs.nom).width, droite = x + 14 + tw + 12 < w;
        const bx = droite ? x + 12 : x - 12 - tw - 12;
        ctx.fillStyle = c.fond; ctx.fillRect(bx, y - 13, tw + 12, 26);
        ctx.strokeStyle = c.texte; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, y - 12.5, tw + 11, 25);
        ctx.fillStyle = c.texte; ctx.textAlign = 'left'; ctx.fillText(vs.nom, bx + 6, y + 1);
      }
      if (opts.apres) opts.apres(ctx, { ecran, etat, couleurs: c });
    }

    function dessinerFront(pts, type, couleur, lw, taille, pas, cote) {
      ctx.strokeStyle = couleur; ctx.fillStyle = couleur; ctx.lineWidth = lw; ctx.lineJoin = 'round';
      T.polyCanvas(ctx, pts); ctx.stroke();
      T.dentsCanvas(ctx, T.dents(pts, { type, pas, taille, cote, depart: pas * 0.6 }));
    }

    function pluieHachuree(c) {
      const { w, h, t, dpr } = etat, pasG = 12;
      const gx = Math.ceil(w / pasG) + 2, gy = Math.ceil(h / pasG) + 2, g = new Float32Array(gx * gy);
      for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { const [x, y] = km([i * pasG, j * pasG]); g[j * gx + i] = C.pluie(x, y, t); }
      const W = Math.ceil(w / 2), H = Math.ceil(h / 2);
      if (champ.width !== W || champ.height !== H) { champ.width = W; champ.height = H; }
      const cc = champ.getContext('2d');
      // tampons réutilisés d'une image à l'autre (en créer deux par image provoquait des pauses du ramasse-miettes)
      if (!tampons || tampons.W !== W || tampons.H !== H) tampons = { W, H, faible: cc.createImageData(W, H), forte: cc.createImageData(W, H) };
      const { faible, forte } = tampons; faible.data.fill(0); forte.data.fill(0);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const fx = (x * 2) / pasG, fy = (y * 2) / pasG, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
        const a = g[j * gx + i], b = g[j * gx + i + 1], e = g[(j + 1) * gx + i], f2 = g[(j + 1) * gx + i + 1];
        const val = (a * (1 - u) + b * u) * (1 - v) + (e * (1 - u) + f2 * u) * v, k = (y * W + x) * 4 + 3;
        if (val >= 2) forte.data[k] = 255; else if (val >= 0.5) faible.data[k] = 255;
      }
      // Pluie faible : traits espacés de 8 px ; forte : 4 px. Les deux trames partagent la même origine,
      // un trait sur deux de la forte prolonge exactement la faible (aucun moiré à la frontière).
      const oc = calque.getContext('2d');
      for (const [masque, gap, alpha] of [[faible, 8, 0.75], [forte, 4, 0.9]]) {
        cc.putImageData(masque, 0, 0);
        oc.globalCompositeOperation = 'copy'; oc.drawImage(motif(gap), 0, 0);
        oc.globalCompositeOperation = 'destination-in'; oc.imageSmoothingEnabled = true; oc.drawImage(champ, 0, 0, calque.width, calque.height);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(calque, 0, 0); ctx.restore();
      }
      oc.globalCompositeOperation = 'source-over';
    }

    const ro = new ResizeObserver(() => { if (cadrer()) dessiner(); });
    ro.observe(canvas);
    return {
      set(t) { etat.t = t; dessiner(); },
      ville(id) { etat.ville = id; dessiner(); },
      vue(v) { etat.vue = v; cadrer(); dessiner(); },
      redessiner() { cadrer(); dessiner(); },
      theme() { lireCouleurs(); dessiner(); },
      ecran, km, etat,
    };
  };
})();
