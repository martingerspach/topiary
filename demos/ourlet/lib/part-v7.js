// Ourlet · moteur de pièces en tôle, itération 7 : seul le dessin coté du développé change (flatSVG). Tout le reste est
// celui de part.js, réexporté tel quel : un seul moteur de pliage pour la page.
//
// Ce que le dessin corrige (relevé à la loupe sur le plan de l'outil et sur celui du contact) :
// - le chiffre d'une cote touchait sa ligne (écart fixe de 2 mm, soit un tiers de pixel sur une barre de 3 m), et la cote
//   verticale était écrite sur sa ligne : l'écart suit maintenant le corps du texte (convention : le chiffre au-dessus de la
//   ligne de cote, du côté de la pièce, sans la toucher) ;
// - les lignes d'attache partaient du rectangle englobant, dans le vide : elles partent du sommet du contour qu'elles
//   cotent, avec un petit jeu, et dépassent un peu la ligne de cote (dessin technique, ISO 129) ;
// - les pointes de flèche, épaisses, pesaient plus que le contour sur un téléphone : pointes pleines et fines (1 pour 3).
import { pointInPoly, fmt } from './part.js';
export * from './part.js';

// Renvoie un SVG (en mm, y vers le bas) : contour, trous, lignes de pli en trait mixte, cotes hors tout.
// px : traits d'épaisseur fixe à l'écran (thin et thick en pixels, non-scaling-stroke), pour un dessin affiché à toutes les tailles.
// Renvoie aussi l'origine du dessin (x0, y1, pad) : X = x − x0 + pad, Y = y1 − y + pad, pour qui veut s'y superposer.
export function flatSVG(part, { pad = 26, ink = 'currentColor', thin = 0.35, thick = 0.7, font = 'inherit', fs = 5.2, cotes = true, bendLabels = true, px = false, axe = '7 2 1.4 2' } = {}) {
  const VE = px ? ' vector-effect="non-scaling-stroke"' : '';
  const xs = part.outline.map(p => p[0]), ys = part.outline.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const W = x1 - x0, H = y1 - y0;
  const X = x => x - x0 + pad, Y = y => y1 - y + pad;
  const pts = poly => poly.map(p => X(p[0]).toFixed(2) + ',' + Y(p[1]).toFixed(2)).join(' ');
  let s = `<polygon points="${pts(part.outline)}" fill="none" stroke="${ink}" stroke-width="${thick}" stroke-linejoin="round"${VE}/>`;
  for (const h of part.holes || []) {
    if (h.meta && h.meta.type === 'circle') s += `<circle cx="${X(h.meta.cx)}" cy="${Y(h.meta.cy)}" r="${h.meta.d / 2}" fill="none" stroke="${ink}" stroke-width="${thick}"${VE}/>`;
    else s += `<polygon points="${pts(h)}" fill="none" stroke="${ink}" stroke-width="${thick}"${VE}/>`;
  }
  // libellés de pli : chacun à un endroit libre le long de son pli (ni trou, ni autre pli, ni contour, ni autre libellé),
  // à une distance du trait proportionnelle au corps ; omis s'il n'a pas la place
  const lf = fs * 0.86, placed = [];
  const holeBoxes = (part.holes || []).map((h) => { const hx = h.map((q) => q[0]), hy = h.map((q) => q[1]); return [Math.min(...hx), Math.min(...hy), Math.max(...hx), Math.max(...hy)]; });
  const hit = (a, b, m = 0) => a[0] - m < b[2] && a[2] + m > b[0] && a[1] - m < b[3] && a[3] + m > b[1];
  const inside = (r, m) => [[r[0] - m, r[1] - m], [r[2] + m, r[1] - m], [r[2] + m, r[3] + m], [r[0] - m, r[3] + m]].every((q) => pointInPoly(q, part.outline));
  const nearLine = (r, bd2, m) => { const vx = Math.abs(bd2.a[0] - bd2.b[0]) < 1e-6; if (vx) { const x = bd2.a[0]; return x > r[0] - m && x < r[2] + m && Math.max(bd2.a[1], bd2.b[1]) > r[1] && Math.min(bd2.a[1], bd2.b[1]) < r[3]; } const y = bd2.a[1]; return y > r[1] - m && y < r[3] + m && Math.max(bd2.a[0], bd2.b[0]) > r[0] && Math.min(bd2.a[0], bd2.b[0]) < r[2]; };
  for (const bd of part.bends) {
    s += `<line x1="${X(bd.a[0])}" y1="${Y(bd.a[1])}" x2="${X(bd.b[0])}" y2="${Y(bd.b[1])}" stroke="${ink}" stroke-width="${thin}" stroke-dasharray="${axe}"/>`;
    if (!(bendLabels && bd.label)) continue;
    const vertical = Math.abs(bd.a[0] - bd.b[0]) < 1e-6, len = bd.label.length * lf * 0.56, thk = lf * 1.05, gap = Math.max(2.2, lf * 0.35);
    let best = null;
    for (const k of [0.5, 0.36, 0.64, 0.22, 0.78]) for (const side of [-1, 1]) {
      if (best) break;
      const px0 = bd.a[0] + (bd.b[0] - bd.a[0]) * k, py0 = bd.a[1] + (bd.b[1] - bd.a[1]) * k;
      // rectangle du libellé, en mm de la pièce (y vers le haut)
      const r = vertical ? [px0 + (side < 0 ? -gap - thk : gap), py0 - len / 2, px0 + (side < 0 ? -gap : gap + thk), py0 + len / 2]
        : [px0 - len / 2, py0 + (side < 0 ? gap : -gap - thk), px0 + len / 2, py0 + (side < 0 ? gap + thk : -gap)];
      if (!inside(r, lf * 0.25)) continue;
      if (holeBoxes.some((hb) => hit(r, hb, lf * 0.5))) continue;
      if (part.bends.some((b2) => b2 !== bd && nearLine(r, b2, lf * 0.25))) continue;
      if (placed.some((p2) => hit(r, p2, lf * 0.7))) continue;
      best = r;
    }
    if (!best) continue;
    placed.push(best);
    const cx = (best[0] + best[2]) / 2, cy = (best[1] + best[3]) / 2;
    // texte centré dans son rectangle ; ligne de base décalée du tiers du corps
    if (vertical) s += `<text x="${(X(cx) + lf * 0.34).toFixed(2)}" y="${Y(cy).toFixed(2)}" font-size="${lf.toFixed(2)}" fill="${ink}" font-family="${font}" text-anchor="middle" transform="rotate(-90 ${(X(cx) + lf * 0.34).toFixed(2)} ${Y(cy).toFixed(2)})" dominant-baseline="auto">${bd.label}</text>`;
    else s += `<text x="${X(cx).toFixed(2)}" y="${(Y(cy) + lf * 0.34).toFixed(2)}" font-size="${lf.toFixed(2)}" fill="${ink}" font-family="${font}" text-anchor="middle">${bd.label}</text>`;
  }
  if (cotes) {
    const off = Math.max(12, fs * 2.3), yC = Y(y0) + off, xC = X(x1) + off;
    const al = fs * 0.66, aw = al * 0.17;          // pointe : longueur, demi-largeur (1 pour 3)
    const jeu = fs * 0.22, dep = fs * 0.3;          // lignes d'attache : jeu au départ du contour, dépassement de la ligne de cote
    const ecart = fs * 0.36;                        // du chiffre à sa ligne
    // le sommet du contour qu'une ligne d'attache cote : sur le bord voulu, le plus proche de la ligne de cote
    const sommet = (axe2, val, vers) => part.outline.filter((p) => Math.abs(p[axe2] - val) < 1e-6).reduce((a, b) => ((b[1 - axe2] - a[1 - axe2]) * vers > 0 ? b : a));
    const bx0 = sommet(0, x0, -1), bx1 = sommet(0, x1, -1), by0 = sommet(1, y0, 1), by1 = sommet(1, y1, 1);
    const n = (v) => v.toFixed(2);
    s += `<g stroke="${ink}" stroke-width="${thin}" fill="${ink}">`
      + `<line x1="${n(X(x0))}" y1="${n(Y(bx0[1]) + jeu)}" x2="${n(X(x0))}" y2="${n(yC + dep)}"/><line x1="${n(X(x1))}" y1="${n(Y(bx1[1]) + jeu)}" x2="${n(X(x1))}" y2="${n(yC + dep)}"/>`
      + `<line x1="${n(X(x0))}" y1="${n(yC)}" x2="${n(X(x1))}" y2="${n(yC)}"/>`
      + `<path d="M${n(X(x0))},${n(yC)} l${n(al)},${n(-aw)} v${n(2 * aw)}Z M${n(X(x1))},${n(yC)} l${n(-al)},${n(-aw)} v${n(2 * aw)}Z" stroke="none"/>`
      + `<line x1="${n(X(by1[0]) + jeu)}" y1="${n(Y(y1))}" x2="${n(xC + dep)}" y2="${n(Y(y1))}"/><line x1="${n(X(by0[0]) + jeu)}" y1="${n(Y(y0))}" x2="${n(xC + dep)}" y2="${n(Y(y0))}"/>`
      + `<line x1="${n(xC)}" y1="${n(Y(y1))}" x2="${n(xC)}" y2="${n(Y(y0))}"/>`
      + `<path d="M${n(xC)},${n(Y(y1))} l${n(-aw)},${n(al)} h${n(2 * aw)}Z M${n(xC)},${n(Y(y0))} l${n(-aw)},${n(-al)} h${n(2 * aw)}Z" stroke="none"/></g>`
      + `<text x="${n((X(x0) + X(x1)) / 2)}" y="${n(yC - ecart)}" font-size="${fs}" text-anchor="middle" fill="${ink}" font-family="${font}">${fmt(W)}</text>`
      + `<text x="${n(xC - ecart)}" y="${n((Y(y0) + Y(y1)) / 2)}" font-size="${fs}" text-anchor="middle" fill="${ink}" font-family="${font}" transform="rotate(-90 ${n(xC - ecart)} ${n((Y(y0) + Y(y1)) / 2)})">${fmt(H)}</text>`;
  }
  if (px) s = s.split('<line ').join('<line vector-effect="non-scaling-stroke" ');
  const extra = cotes ? Math.max(12, fs * 2.3) - 12 : 0;
  return { svg: s, w: W + pad * 2 + 6 + extra, h: H + pad * 2 + 6 + extra, x0, y1, pad };
}
