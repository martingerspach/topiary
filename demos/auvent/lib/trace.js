/* Auvent · tracés (script classique, expose window.Auvent.trace)
   Les signes de la carte synoptique, dessinés comme sur une carte du temps :
   - front froid : dents triangulaires du côté où il avance ;
   - front chaud : demi-cercles ;
   - occlusion : triangles et demi-cercles alternés, du même côté ;
   - hachures : la probabilité ou l'intensité en densité de traits, jamais en dégradé.
   Rendu en SVG (chaînes « d ») ou sur canvas, à partir des mêmes formes. */
(function () {
  const A = (window.Auvent = window.Auvent || {});

  // Longueurs cumulées d'une polyligne
  function measure(pts) {
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return acc;
  }
  // Point et tangente à l'abscisse curviligne s
  function at(pts, acc, s) {
    let i = 1;
    while (i < acc.length - 1 && acc[i] < s) i++;
    const seg = acc[i] - acc[i - 1] || 1, u = (s - acc[i - 1]) / seg;
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    return { x: ax + u * dx, y: ay + u * dy, tx: dx / L, ty: dy / L };
  }

  /* Formes des dents le long d'une polyligne (coordonnées écran, y vers le bas).
     opts : type 'froid' | 'chaud' | 'occlus', pas (écart entre dents), taille (base), depart (décalage),
     cote (+1 ou -1 : à gauche ou à droite du sens de tracé), hauteur (rapport hauteur/base, 0,8 par défaut),
     croissance : fonction (i, s) -> 0..1 pour faire naître les dents une à une. */
  function dents(pts, opts = {}) {
    const { type = 'froid', pas = 40, taille = 14, depart = pas / 2, cote = 1, hauteur = 0.8, croissance } = opts;
    const acc = measure(pts), total = acc[acc.length - 1], out = [];
    let i = 0;
    for (let s = depart; s <= total - taille / 2; s += pas, i++) {
      const g = croissance ? croissance(i, s / total) : 1;
      if (g <= 0) continue;
      const kind = type === 'occlus' ? (i % 2 ? 'demi' : 'tri') : type === 'chaud' ? 'demi' : 'tri';
      const c = at(pts, acc, s);
      const nx = -c.ty * cote, ny = c.tx * cote, b = taille / 2;
      if (kind === 'tri') {
        const h = taille * hauteur * g;
        out.push({ kind, pts: [[c.x - c.tx * b, c.y - c.ty * b], [c.x + nx * h, c.y + ny * h], [c.x + c.tx * b, c.y + c.ty * b]] });
      } else {
        out.push({ kind, cx: c.x, cy: c.y, r: b * Math.max(0.001, g), ang: Math.atan2(c.ty, c.tx), cote });
      }
    }
    return out;
  }

  const f = (v) => (Math.round(v * 10) / 10).toString();
  function lineD(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join(''); }
  function dentsD(shapes) {
    return shapes.map((s) => {
      if (s.kind === 'tri') return 'M' + s.pts.map((p) => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
      const { cx, cy, r, ang, cote } = s;
      const ax = cx - Math.cos(ang) * r, ay = cy - Math.sin(ang) * r, bx = cx + Math.cos(ang) * r, by = cy + Math.sin(ang) * r;
      return `M${f(ax)} ${f(ay)}A${f(r)} ${f(r)} 0 0 ${cote > 0 ? 1 : 0} ${f(bx)} ${f(by)}Z`;
    }).join('');
  }
  function dentsCanvas(ctx, shapes) {
    ctx.beginPath();
    for (const s of shapes) {
      if (s.kind === 'tri') { ctx.moveTo(s.pts[0][0], s.pts[0][1]); ctx.lineTo(s.pts[1][0], s.pts[1][1]); ctx.lineTo(s.pts[2][0], s.pts[2][1]); ctx.closePath(); }
      else { ctx.moveTo(s.cx + Math.cos(s.ang) * s.r, s.cy + Math.sin(s.ang) * s.r); ctx.arc(s.cx, s.cy, s.r, s.ang, s.ang + Math.PI, s.cote > 0); ctx.closePath(); }
    }
    ctx.fill();
  }
  function polyCanvas(ctx, pts, close) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    if (close) ctx.closePath();
  }
  // Courbe lissée (Catmull-Rom échantillonnée) : les fronts sont des courbes, pas des lignes brisées
  function lisse(pts, sub = 6) {
    if (pts.length < 3) return pts;
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < sub; k++) {
        const t = k / sub, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // Hachures à 45° sur tout le canvas (à composer avec un masque)
  function hachures(ctx, w, h, gap, width, color, cross) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    for (let x = -h; x < w; x += gap) { ctx.moveTo(x, h); ctx.lineTo(x + h, 0); }
    if (cross) for (let x = 0; x < w + h; x += gap) { ctx.moveTo(x, h); ctx.lineTo(x - h, 0); }
    ctx.stroke(); ctx.restore();
  }
  // Motif SVG de hachures (pour les composants du design system)
  function motifSVG(id, gap, color, width = 1.25, cross = false) {
    const g = gap;
    return `<pattern id="${id}" width="${g}" height="${g}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
      `<line x1="0" y1="0" x2="0" y2="${g}" stroke="${color}" stroke-width="${width}"/>` +
      (cross ? `<line x1="0" y1="${g / 2}" x2="${g}" y2="${g / 2}" stroke="${color}" stroke-width="${width}"/>` : '') + `</pattern>`;
  }

  A.trace = { measure, at, dents, lineD, dentsD, dentsCanvas, polyCanvas, lisse, hachures, motifSVG };
})();
