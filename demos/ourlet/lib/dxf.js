// Ourlet · lecture d'un plan DXF de tôlerie (développé à plat), dans le navigateur, sans envoi.
// Lit les entités LINE, ARC, CIRCLE, LWPOLYLINE (avec arrondis « bulge ») et POLYLINE/VERTEX. Les traits posés sur un calque
// dont le nom contient PLI, BEND ou FOLD sont des lignes de pli ; tout le reste est du contour coupé. Les contours sont chaînés
// bout à bout (tolérance 0,05 mm), le plus grand contour fermé devient la pièce, les autres contours fermés des trous.
// Un angle peut être donné dans le nom du calque (« PLI_120 ») ; sinon 90°. Le signe « - » plie vers le bas (« PLI_-90 »).
import { makePart } from './part.js';

const TOL = 0.05;

function pairs(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const out = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push([parseInt(lines[i].trim(), 10), lines[i + 1].trim()]);
  return out;
}

export function parseDXF(text) {
  const P = pairs(text);
  let i = P.findIndex(([c, v]) => c === 2 && v === 'ENTITIES');
  if (i < 0) throw Object.assign(new Error('Nous ne trouvons aucun dessin dans ce fichier.'), { plan: true });
  const ents = [];
  let cur = null, poly = null;
  const units = (() => { const k = P.findIndex(([c, v]) => c === 9 && v === '$INSUNITS'); return k >= 0 ? parseInt(P[k + 1][1], 10) : 4; })();
  for (i = i + 1; i < P.length; i++) {
    const [c, v] = P[i];
    if (c === 0) {
      if (v === 'ENDSEC') break;
      if (cur) { if (cur.type === 'VERTEX' && poly) poly.pts.push(cur); else if (cur.type !== 'VERTEX' && cur.type !== 'SEQEND') ents.push(cur); }
      if (v === 'SEQEND' && poly) { ents.push(poly); poly = null; cur = null; continue; }
      cur = { type: v, layer: '0', pts: [], bulges: [] };
      if (v === 'POLYLINE') { poly = cur; cur = null; poly.type = 'LWPOLYLINE'; poly.closed = false; }
      continue;
    }
    const tgt = cur || poly; if (!tgt) continue;
    const n = parseFloat(v);
    switch (c) {
      case 8: tgt.layer = v; break;
      case 10: if (tgt.type === 'LWPOLYLINE' && tgt === cur) { tgt.pts.push({ x: n, y: 0 }); tgt.bulges.push(0); } else tgt.x = n; break;
      case 20: if (tgt.type === 'LWPOLYLINE' && tgt === cur) tgt.pts[tgt.pts.length - 1].y = n; else tgt.y = n; break;
      case 11: tgt.x2 = n; break;
      case 21: tgt.y2 = n; break;
      case 40: tgt.r = n; break;
      case 42: if (tgt.type === 'LWPOLYLINE' && tgt === cur) tgt.bulges[tgt.bulges.length - 1] = n; else tgt.bulge = n; break;
      case 50: tgt.a0 = n; break;
      case 51: tgt.a1 = n; break;
      case 70: if (tgt.type === 'LWPOLYLINE' || tgt === poly) tgt.closed = (parseInt(v, 10) & 1) === 1; break;
    }
  }
  if (cur && cur.type !== 'VERTEX') ents.push(cur);
  // POLYLINE : convertir les VERTEX
  for (const e of ents) if (e.pts && e.pts.length && e.pts[0].type === 'VERTEX') { e.bulges = e.pts.map((p) => p.bulge || 0); e.pts = e.pts.map((p) => ({ x: p.x, y: p.y })); }
  const scale = units === 1 ? 25.4 : units === 5 ? 10 : units === 6 ? 1000 : 1; // pouces, cm, m → mm
  return { ents, scale };
}

// Arc → points
function arcPts(cx, cy, r, a0, a1, step = 8) {
  let s = a0, e = a1; while (e <= s) e += 360;
  const n = Math.max(2, Math.ceil((e - s) / step)), pts = [];
  for (let k = 0; k <= n; k++) { const a = ((s + ((e - s) * k) / n) * Math.PI) / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
function bulgePts(p, q, b) {
  if (!b) return [[p.x, p.y], [q.x, q.y]];
  const th = 4 * Math.atan(b), dx = q.x - p.x, dy = q.y - p.y, c = Math.hypot(dx, dy), r = c / (2 * Math.sin(th / 2));
  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, h = r * Math.cos(th / 2) * (b > 0 ? 1 : -1);
  const cx = mx - (h * dy) / c, cy = my + (h * dx) / c;
  let a0 = Math.atan2(p.y - cy, p.x - cx), a1 = Math.atan2(q.y - cy, q.x - cx);
  if (b > 0) { while (a1 <= a0) a1 += 2 * Math.PI; } else { while (a1 >= a0) a1 -= 2 * Math.PI; }
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 24))), pts = [];
  for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; pts.push([cx + Math.abs(r) * Math.cos(a), cy + Math.abs(r) * Math.sin(a)]); }
  return pts;
}

const isBend = (layer) => /PLI|BEND|FOLD/i.test(layer || '');
const angleOf = (layer) => { const m = /(-?\d{2,3})/.exec(layer || ''); const a = m ? parseFloat(m[1]) : 90; return Math.abs(a) <= 180 && a !== 0 ? a : 90; };
const areaOf = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * y2 - x2 * y1; } return s / 2; };
const near = (a, b) => Math.abs(a[0] - b[0]) < TOL && Math.abs(a[1] - b[1]) < TOL;

// Chaîne des segments ouverts en contours fermés
function chain(segs) {
  const loops = [], open = segs.slice();
  while (open.length) {
    let cur = open.shift().slice(), grew = true;
    while (grew && !near(cur[0], cur[cur.length - 1])) {
      grew = false;
      for (let k = 0; k < open.length; k++) {
        const s = open[k];
        if (near(cur[cur.length - 1], s[0])) { cur = cur.concat(s.slice(1)); }
        else if (near(cur[cur.length - 1], s[s.length - 1])) { cur = cur.concat(s.slice(0, -1).reverse()); }
        else continue;
        open.splice(k, 1); grew = true; break;
      }
    }
    if (near(cur[0], cur[cur.length - 1]) && cur.length > 3) loops.push(cur.slice(0, -1));
  }
  return loops;
}

// DXF → pièce (développé, trous, plis), dans le repère du plan, en mm
export function dxfToPart(text, { t = 2, name = 'Pièce déposée' } = {}) {
  const { ents, scale } = parseDXF(text);
  const S = (p) => [p[0] * scale, p[1] * scale];
  const segs = [], closed = [], bends = [];
  for (const e of ents) {
    if (e.type === 'LINE') {
      const a = S([e.x, e.y]), b = S([e.x2, e.y2]);
      if (isBend(e.layer)) bends.push({ a, b, angle: angleOf(e.layer), label: 'pli' }); else segs.push([a, b]);
    } else if (e.type === 'ARC' && !isBend(e.layer)) segs.push(arcPts(e.x, e.y, e.r, e.a0, e.a1).map(S));
    else if (e.type === 'CIRCLE' && !isBend(e.layer)) { const c = arcPts(e.x, e.y, e.r, 0, 360, 360 / 48).map(S); c.pop(); c.meta = { type: 'circle', cx: e.x * scale, cy: e.y * scale, d: 2 * e.r * scale }; closed.push(c); }
    else if (e.type === 'LWPOLYLINE' && e.pts.length > 1) {
      if (isBend(e.layer)) { for (let k = 0; k + 1 < e.pts.length; k++) bends.push({ a: S([e.pts[k].x, e.pts[k].y]), b: S([e.pts[k + 1].x, e.pts[k + 1].y]), angle: angleOf(e.layer), label: 'pli' }); continue; }
      const pts = [];
      const N = e.closed ? e.pts.length : e.pts.length - 1;
      for (let k = 0; k < N; k++) { const seg = bulgePts(e.pts[k], e.pts[(k + 1) % e.pts.length], e.bulges[k]); if (pts.length) seg.shift(); pts.push(...seg); }
      const sp = pts.map(S);
      if (e.closed) { if (near(sp[0], sp[sp.length - 1])) sp.pop(); closed.push(sp); } else segs.push(sp);
    }
  }
  const loops = closed.concat(chain(segs)).filter((l) => l.length >= 3);
  if (!loops.length) throw Object.assign(new Error('Nous ne trouvons pas de contour fermé dans ce plan. Dessinez la pièce à plat et vérifiez que ses traits se rejoignent.'), { plan: true });
  loops.sort((a, b) => Math.abs(areaOf(b)) - Math.abs(areaOf(a)));
  let outline = loops[0];
  if (areaOf(outline) < 0) outline = outline.slice().reverse();
  const holes = loops.slice(1);
  // Prolonge chaque pli jusqu'au contour (les dessinateurs l'arrêtent souvent à quelques dixièmes du bord)
  const fixed = bends.map((b) => snapBend(b, outline)).filter(Boolean);
  // Insère les extrémités des plis dans le contour, pour que la découpe en faces les trouve
  for (const b of fixed) { outline = insertPoint(outline, b.a); outline = insertPoint(outline, b.b); }
  const part = makePart({ ref: 'Plan déposé', name, matiere: '', t, outline, holes, bends: fixed });
  part.source = { entites: ents.length, plis: fixed.length, plisIgnores: bends.length - fixed.length, echelle: scale };
  return part;
}

function segInter(p, d, a, b) { // intersection de la droite p + s·d avec le segment [a, b] : renvoie s
  const ex = b[0] - a[0], ey = b[1] - a[1], den = d[0] * ey - d[1] * ex;
  if (Math.abs(den) < 1e-12) return null;
  const s = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den, u = ((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) / den;
  return u >= -1e-9 && u <= 1 + 1e-9 ? s : null;
}
function snapBend(b, outline) {
  const d = [b.b[0] - b.a[0], b.b[1] - b.a[1]], L = Math.hypot(d[0], d[1]); if (L < 1e-6) return null;
  const u = [d[0] / L, d[1] / L], ss = [];
  for (let i = 0; i < outline.length; i++) { const s = segInter(b.a, u, outline[i], outline[(i + 1) % outline.length]); if (s !== null) ss.push(s); }
  if (ss.length < 2) return null;
  const mid = L / 2; // les deux intersections qui encadrent le milieu du pli
  const lo = Math.max(...ss.filter((s) => s <= mid + 1e-6)), hi = Math.min(...ss.filter((s) => s >= mid - 1e-6));
  if (!isFinite(lo) || !isFinite(hi) || hi - lo < 1) return null;
  return { ...b, a: [b.a[0] + u[0] * lo, b.a[1] + u[1] * lo], b: [b.a[0] + u[0] * hi, b.a[1] + u[1] * hi] };
}
function insertPoint(loop, p) {
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    if (near(a, p) || near(b, p)) return loop;
    const ex = b[0] - a[0], ey = b[1] - a[1], L2 = ex * ex + ey * ey; if (!L2) continue;
    const t = ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / L2;
    if (t <= 0 || t >= 1) continue;
    const qx = a[0] + t * ex, qy = a[1] + t * ey;
    if (Math.hypot(qx - p[0], qy - p[1]) < 0.02) { const out = loop.slice(); out.splice(i + 1, 0, [qx, qy]); return out; }
  }
  return loop;
}

// Pièce → DXF (sert à fabriquer des plans d'exemple et à tester la lecture)
export function partToDXF(part) {
  const L = [];
  const add = (...kv) => { for (let i = 0; i < kv.length; i += 2) L.push(String(kv[i]), String(kv[i + 1])); };
  add(0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
  const loop = (pts, layer) => { add(0, 'LWPOLYLINE', 8, layer, 90, pts.length, 70, 1); for (const [x, y] of pts) add(10, x.toFixed(3), 20, y.toFixed(3)); };
  loop(part.outline, 'CONTOUR');
  for (const h of part.holes || []) { if (h.meta && h.meta.type === 'circle') add(0, 'CIRCLE', 8, 'CONTOUR', 10, h.meta.cx, 20, h.meta.cy, 40, h.meta.d / 2); else loop(h, 'CONTOUR'); }
  for (const b of part.bends) add(0, 'LINE', 8, `PLI_${b.angle}`, 10, b.a[0], 20, b.a[1], 11, b.b[0], 21, b.b[1]);
  add(0, 'ENDSEC', 0, 'EOF');
  return L.join('\n');
}
