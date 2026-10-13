// Ourlet · moteur de pièces en tôle
// Une pièce est décrite comme en atelier : un développé (contour à plat, trous) et des lignes de pli.
// Le moteur découpe le développé en faces le long des plis, plie ces faces en 3D (pli vif, arrondi extérieur
// de rayon t/2), donne une épaisseur à la tôle (chants de découpe visibles), puis projette en perspective
// (jamais en isométrie : c'est le langage de Topiary). Sorties : polygones triés (peintre) pour SVG ou canvas,
// et dessin coté du développé.
// Unités : millimètres. Repère du développé : x vers la droite, y vers le haut ; z sort de la face « dessus ».

const EPS = 1e-6;

// ---------- Géométrie 2D ----------
export function circle(cx, cy, d, n = 48) {
  const r = d / 2, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  pts.meta = { type: 'circle', cx, cy, d };
  return pts;
}
// Oblong (trou oblong) centré, longueur L hors tout, largeur w, horizontal
export function slot(cx, cy, L, w, n = 16) {
  const r = w / 2, pts = [], h = L / 2 - r;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI; pts.push([cx + h + r * Math.cos(a), cy + r * Math.sin(a)]); }
  for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + (i / n) * Math.PI; pts.push([cx - h + r * Math.cos(a), cy + r * Math.sin(a)]); }
  pts.meta = { type: 'slot', cx, cy, L, w };
  return pts;
}
export function area(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; s += x1 * y2 - x2 * y1; } return s / 2; }
export function perimeter(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; s += Math.hypot(x2 - x1, y2 - y1); } return s; }
function centroid(poly) { let x = 0, y = 0; for (const p of poly) { x += p[0]; y += p[1]; } return [x / poly.length, y / poly.length]; }
function onSeg(p, a, b, eps = 1e-4) {
  const abx = b[0] - a[0], aby = b[1] - a[1], L = Math.hypot(abx, aby);
  if (L < EPS) return Math.hypot(p[0] - a[0], p[1] - a[1]) < eps;
  const cross = Math.abs((p[0] - a[0]) * aby - (p[1] - a[1]) * abx) / L;
  const t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (L * L);
  return cross < eps && t > -eps / L && t < 1 + eps / L;
}
export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Coupe une boucle par un segment [a,b] dont les extrémités sont sur le contour : renvoie deux boucles ou null
function splitLoop(loop, a, b) {
  let ia = -1, ib = -1;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i], q = loop[(i + 1) % loop.length];
    if (ia < 0 && onSeg(a, p, q)) ia = i;
    if (ib < 0 && onSeg(b, p, q)) ib = i;
  }
  if (ia < 0 || ib < 0 || ia === ib) return null;
  const n = loop.length, L1 = [a], L2 = [b];
  for (let i = (ia + 1) % n; ; i = (i + 1) % n) { if (!same(loop[i], a) && !same(loop[i], b)) L1.push(loop[i]); if (i === ib) break; }
  L1.push(b);
  for (let i = (ib + 1) % n; ; i = (i + 1) % n) { if (!same(loop[i], a) && !same(loop[i], b)) L2.push(loop[i]); if (i === ia) break; }
  L2.push(a);
  return [L1, L2];
}
const same = (p, q) => Math.abs(p[0] - q[0]) < 1e-4 && Math.abs(p[1] - q[1]) < 1e-4;

// ---------- Matrices 3x4 ----------
const I = () => [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
function mul(A, B) { // A·B
  const r = new Array(12);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  for (let i = 0; i < 3; i++) r[9 + i] = A[i * 3] * B[9] + A[i * 3 + 1] * B[10] + A[i * 3 + 2] * B[11] + A[9 + i];
  return r;
}
export function apply(M, p) { const [x, y, z] = p; return [M[0] * x + M[1] * y + M[2] * z + M[9], M[3] * x + M[4] * y + M[5] * z + M[10], M[6] * x + M[7] * y + M[8] * z + M[11]]; }
function rotAxis(p0, d, th) { // rotation d'angle th autour de l'axe (p0, d), d unitaire dans le plan z = 0
  const c = Math.cos(th), s = Math.sin(th), C = 1 - c, [x, y, z] = d;
  const R = [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C, 0, 0, 0];
  const T = [1, 0, 0, 0, 1, 0, 0, 0, 1, p0[0], p0[1], p0[2] || 0], Ti = [1, 0, 0, 0, 1, 0, 0, 0, 1, -p0[0], -p0[1], -(p0[2] || 0)];
  return mul(T, mul(R, Ti));
}

// ---------- La pièce ----------
// def : { t, outline, holes:[poly], bends:[{a, b, angle, label?}], base?:[x,y] }
export function makePart(def) {
  const part = { ...def, t: def.t ?? 2 };
  let faces = [{ loop: def.outline.slice() }];
  for (const bd of def.bends) {
    const mid = centroid([bd.a, bd.b]);
    const fi = faces.findIndex(f => pointInPoly(mid, f.loop) && splitLoop(f.loop, bd.a, bd.b));
    if (fi < 0) throw Object.assign(new Error('Une ligne de pli ne traverse pas la pièce de bord à bord. Vérifiez le calque PLI.'), { plan: true });
    const [L1, L2] = splitLoop(faces[fi].loop, bd.a, bd.b);
    faces.splice(fi, 1, { loop: L1 }, { loop: L2 });
  }
  faces.forEach((f, i) => { f.id = i; f.holes = []; f.area = Math.abs(area(f.loop)); });
  for (const h of def.holes || []) { const c = h.meta && h.meta.cx !== undefined ? [h.meta.cx, h.meta.cy] : centroid(h); const f = faces.find(f => pointInPoly(c, f.loop)); if (f) f.holes.push(h); }
  // adjacences : un pli borde exactement deux faces
  part.links = def.bends.map((bd, k) => {
    const m = centroid([bd.a, bd.b]);
    const fs = faces.filter(f => onBoundary(f.loop, m));
    return { k, bend: bd, faces: fs.map(f => f.id) };
  });
  part.faces = faces;
  const baseFace = def.base ? faces.find(f => pointInPoly(def.base, f.loop)) : faces.reduce((a, b) => (b.area > a.area ? b : a));
  part.baseId = baseFace.id;
  part.flatArea = Math.abs(area(def.outline)) - (def.holes || []).reduce((s, h) => s + Math.abs(area(h)), 0);
  part.cutLength = perimeter(def.outline) + (def.holes || []).reduce((s, h) => s + perimeter(h), 0);
  part.pierces = 1 + (def.holes || []).length;
  return part;
}
function onBoundary(loop, p) { for (let i = 0; i < loop.length; i++) if (onSeg(p, loop[i], loop[(i + 1) % loop.length])) return true; return false; }

// Plie la pièce. amount : 0 (à plat) → 1 (plié) ou fonction (indice du pli) → fraction. Renvoie les transformations par face.
export function fold(part, amount = 1) {
  const frac = typeof amount === 'function' ? amount : () => amount;
  const M = new Map([[part.baseId, I()]]);
  const hinges = []; // pour l'arrondi extérieur et les joues de pli
  const queue = [part.baseId];
  while (queue.length) {
    const fid = queue.shift();
    for (const ln of part.links) {
      if (!ln.faces.includes(fid)) continue;
      const other = ln.faces.find(x => x !== fid);
      if (other === undefined || M.has(other)) continue;
      const { a, b, angle } = ln.bend;
      let d = [b[0] - a[0], b[1] - a[1], 0]; const L = Math.hypot(d[0], d[1]); d = [d[0] / L, d[1] / L, 0];
      const c = centroid(part.faces[other].loop), n = [-d[1], d[0]];
      if ((c[0] - a[0]) * n[0] + (c[1] - a[1]) * n[1] < 0) { d = [-d[0], -d[1], 0]; }
      // L'axe du pli passe par la face intérieure (rayon intérieur nul) : les faces intérieures se rejoignent net,
      // l'extérieur s'arrondit au rayon t, et un ourlet à 180° se pose à plat sur la tôle, sans la traverser.
      const sg = Math.sign(angle) || 1, p0 = [a[0], a[1], sg * part.t / 2];
      const th = (angle * Math.PI / 180) * frac(ln.k);
      M.set(other, mul(M.get(fid), rotAxis(p0, d, th)));
      hinges.push({ parent: fid, child: other, a, b, d, th, sg, p0, Mp: M.get(fid) });
      queue.push(other);
    }
  }
  return { M, hinges };
}

// Maillage avec épaisseur : dessus, dessous, chants de découpe, arrondi extérieur des plis, joues des plis
export function mesh(part, folded) {
  const t = part.t, h = t / 2, polys = [];
  const isBendEdge = (p, q) => part.bends.some(bd => onSeg(p, bd.a, bd.b) && onSeg(q, bd.a, bd.b));
  for (const f of part.faces) {
    const Mf = folded.M.get(f.id); if (!Mf) continue;
    const top = f.loop.map(p => apply(Mf, [p[0], p[1], h])), bot = f.loop.map(p => apply(Mf, [p[0], p[1], -h]));
    const holesTop = f.holes.map(H => H.map(p => apply(Mf, [p[0], p[1], h]))), holesBot = f.holes.map(H => H.map(p => apply(Mf, [p[0], p[1], -h])));
    polys.push({ kind: 'face', side: 'top', pts: top, holes: holesTop, holeRefs: f.holes, face: f.id });
    polys.push({ kind: 'face', side: 'bottom', pts: bot.slice().reverse(), holes: holesBot, holeRefs: f.holes, face: f.id });
    for (let i = 0; i < f.loop.length; i++) {
      const j = (i + 1) % f.loop.length;
      if (isBendEdge(f.loop[i], f.loop[j])) continue;
      polys.push({ kind: 'edge', pts: [top[i], top[j], bot[j], bot[i]], face: f.id });
    }
    for (let k = 0; k < f.holes.length; k++) {
      const H = f.holes[k];
      for (let i = 0; i < H.length; i++) { const j = (i + 1) % H.length; polys.push({ kind: 'bore', pts: [holesTop[k][i], holesTop[k][j], holesBot[k][j], holesBot[k][i]], face: f.id }); }
    }
  }
  // arrondi extérieur : balayage de rayon t autour de l'axe (posé sur la face intérieure), du côté convexe
  for (const hg of folded.hinges) {
    if (Math.abs(hg.th) < 1e-4) continue;
    const steps = Math.max(2, Math.ceil(Math.abs(hg.th) / (Math.PI / 12)));
    const side = -hg.sg * h; // pli vers le haut : l'extérieur est le dessous
    const ring = (p, s) => { const R = mul(hg.Mp, rotAxis(hg.p0, hg.d, hg.th * s)); return apply(R, [p[0], p[1], side]); };
    const ringC = (p, s) => { const R = mul(hg.Mp, rotAxis(hg.p0, hg.d, hg.th * s)); return apply(R, [p[0], p[1], hg.sg * h]); };
    for (let i = 0; i < steps; i++) {
      const s0 = i / steps, s1 = (i + 1) / steps;
      polys.push({ kind: 'round', pts: [ring(hg.a, s0), ring(hg.b, s0), ring(hg.b, s1), ring(hg.a, s1)], face: hg.child });
    }
    for (const e of [hg.a, hg.b]) { // joues : secteur entre l'axe et l'arc
      const pts = [ringC(e, 0)]; for (let i = 0; i <= steps; i++) pts.push(ring(e, i / steps));
      polys.push({ kind: 'cheek', pts, face: hg.child });
    }
  }
  return polys;
}

// ---------- Caméra et projection ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export function camera({ eye, target = [0, 0, 0], up = [0, 0, 1], fov = 30 }) {
  const f = norm(sub(target, eye)), r = norm(cross(f, up)), u = cross(r, f);
  return { eye, f, r, u, k: 1 / Math.tan((fov * Math.PI) / 360) };
}
function toCam(cam, p) { const v = sub(p, cam.eye); return [dot(v, cam.r), dot(v, cam.u), dot(v, cam.f)]; }
// Projette et ombre. Renvoie [{d (chemin SVG), fill, stroke, depth}] dans un cadre [-1,1] mis à l'échelle par size
// paths = false : pas de chemin SVG (les trames n'utilisent que les points projetés), plus rapide à chaque image
export function render(polys, cam, { size = 500, color = [185, 207, 172], edge = null, light = [-0.45, -0.35, 0.82], ink = [35, 41, 43], amb = 0.62, lift = 0, cx = 0, cy = 0, paths = true } = {}) {
  const L = norm(light), out = [];
  const P = p => { const c = toCam(cam, p); return [cx + (c[0] * cam.k / c[2]) * size, cy - (c[1] * cam.k / c[2]) * size, c[2]]; };
  for (const pl of polys) {
    const w = pl.pts;
    if (w.length < 3) continue;
    let nrm = norm(cross(sub(w[1], w[0]), sub(w[2], w[0])));
    if (pl.kind === 'cheek' || pl.kind === 'round') { const k2 = Math.floor(w.length / 2); nrm = norm(cross(sub(w[1], w[0]), sub(w[k2 + 1] || w[2], w[0]))); }
    const toEye = norm(sub(cam.eye, w[0]));
    let ndl = dot(nrm, L); if (dot(nrm, toEye) < 0) ndl = -ndl; // deux faces peintes
    const shade = amb + (1 - amb) * Math.max(0, ndl);
    const base = (pl.kind === 'edge' || pl.kind === 'bore') && edge ? edge : color;
    const k = (pl.kind === 'edge' || pl.kind === 'bore') ? shade * 0.82 : shade;
    // lift > 0 : les faces les mieux éclairées passent un peu au-dessus de la teinte (pièce ton sur ton sur son aplat)
    const kk = lift ? k * (1 + lift) : k;
    const fill = kk > 1 ? mix(base, [255, 255, 255], Math.min(1, kk - 1)) : mix(ink, base, kk);
    const pr = w.map(P), depth = pr.reduce((s, p) => s + p[2], 0) / pr.length;
    const holes = pl.holes ? pl.holes.map(H => H.map(P)) : null;
    let d = '';
    if (paths) { d = 'M' + pr.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join('L') + 'Z'; if (holes) for (const H of holes) d += 'M' + H.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join('L') + 'Z'; }
    out.push({ d, fill, depth, kind: pl.kind, side: pl.side, face: pl.face, meta: pl.meta, pr, holes, holeRefs: pl.holeRefs || null });
  }
  out.sort((a, b) => b.depth - a.depth);
  return out;
}
export function mix(a, b, k) { // de a (k = 0) à b (k = 1)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export function hex(h) { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

// Rendu SVG complet d'une pièce pliée
export function svgPart(part, { amount = 1, cam, size, color, edge, ink, stroke = null, strokeWidth = 0.6, cx, cy } = {}) {
  const fo = fold(part, amount), polys = mesh(part, fo);
  const r = render(polys, cam, { size, color, edge, ink, cx, cy });
  return r.map(p => `<path d="${p.d}" fill="${p.fill}" fill-rule="evenodd"${stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"` : ` stroke="${p.fill}" stroke-width="0.4" stroke-linejoin="round"`}/>`).join('');
}
// Rendu canvas (animations)
export function drawPart(ctx, part, opts) {
  const fo = fold(part, opts.amount ?? 1), polys = mesh(part, fo);
  const r = render(polys, opts.cam, opts);
  for (const p of r) {
    ctx.beginPath();
    p.pr.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
    if (p.holes) for (const H of p.holes) { H.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); }
    ctx.fillStyle = p.fill; ctx.fill('evenodd');
    ctx.strokeStyle = opts.stroke || p.fill; ctx.lineWidth = opts.strokeWidth || 0.5; ctx.lineJoin = 'round'; ctx.stroke();
  }
}

// ---------- Dessin du développé ----------
// Renvoie un SVG (en mm, y vers le bas) : contour, trous, lignes de pli en trait mixte, cotes hors tout.
// px : traits d'épaisseur fixe à l'écran (thin et thick en pixels, non-scaling-stroke), pour un dessin affiché à toutes les tailles.
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
    const off = Math.max(12, fs * 2.3), yC = Y(y0) + off, xC = X(x1) + off, ar = Math.max(2.4, fs * 0.42);
    s += `<g stroke="${ink}" stroke-width="${thin}" fill="${ink}">`
      + `<line x1="${X(x0)}" y1="${Y(y0) + 2}" x2="${X(x0)}" y2="${yC + 2}"/><line x1="${X(x1)}" y1="${Y(y0) + 2}" x2="${X(x1)}" y2="${yC + 2}"/>`
      + `<line x1="${X(x0)}" y1="${yC}" x2="${X(x1)}" y2="${yC}"/>`
      + `<path d="M${X(x0)},${yC} l${ar * 2},-${ar * 0.6} v${ar * 1.2}Z M${X(x1)},${yC} l-${ar * 2},-${ar * 0.6} v${ar * 1.2}Z" stroke="none"/>`
      + `<line x1="${X(x1) + 2}" y1="${Y(y1)}" x2="${xC + 2}" y2="${Y(y1)}"/><line x1="${X(x1) + 2}" y1="${Y(y0)}" x2="${xC + 2}" y2="${Y(y0)}"/>`
      + `<line x1="${xC}" y1="${Y(y1)}" x2="${xC}" y2="${Y(y0)}"/>`
      + `<path d="M${xC},${Y(y1)} l-${ar * 0.6},${ar * 2} h${ar * 1.2}Z M${xC},${Y(y0)} l-${ar * 0.6},-${ar * 2} h${ar * 1.2}Z" stroke="none"/></g>`
      + `<text x="${(X(x0) + X(x1)) / 2}" y="${yC - 2}" font-size="${fs}" text-anchor="middle" fill="${ink}" font-family="${font}">${fmt(W)}</text>`
      + `<text x="${xC - 2}" y="${(Y(y0) + Y(y1)) / 2}" font-size="${fs}" text-anchor="middle" fill="${ink}" font-family="${font}" transform="rotate(-90 ${xC - 2} ${(Y(y0) + Y(y1)) / 2})">${fmt(H)}</text>`;
  }
  if (px) s = s.split('<line ').join('<line vector-effect="non-scaling-stroke" ');
  const extra = cotes ? Math.max(12, fs * 2.3) - 12 : 0;
  return { svg: s, w: W + pad * 2 + 6 + extra, h: H + pad * 2 + 6 + extra };
}
export const fmt = v => (Math.round(v * 10) / 10).toLocaleString('fr-FR');

// Rendu SVG cadré : renvoie le contenu, la boîte englobante projetée et un viewBox avec marge
export function partView(part, { amount = 1, cam, size = 100, color, edge, ink = [29, 33, 35], outline = 0.5, pad = 0.06, ...rest } = {}) {
  const fo = fold(part, amount), polys = mesh(part, fo);
  const r = render(polys, cam, { size, color, edge, ink, ...rest });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of r) for (const q of p.pr) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const line = mix(ink, color, 0.42);
  const inner = r.map(p => `<path d="${p.d}" fill="${p.fill}" fill-rule="evenodd" stroke="${outline ? line : p.fill}" stroke-width="${outline || 0.4}" stroke-linejoin="round"/>`).join('');
  const w = x1 - x0, h = y1 - y0, m = Math.max(w, h) * pad;
  return { inner, box: [x0, y0, x1, y1], viewBox: `${(x0 - m).toFixed(1)} ${(y0 - m).toFixed(1)} ${(w + 2 * m).toFixed(1)} ${(h + 2 * m).toFixed(1)}` };
}

// Filet ourlé : une barre de hauteur h de x0 à x1, finie par un ourlet (bout arrondi, fente) du côté `end` ('right' ou 'left')
export function filetPath(x0, x1, y, h, end = 'right', { g = 0.16, L = 1.7 } = {}) {
  const r = h / 2, gy = g * h, ri = gy / 2, cyy = y + r;
  if (end === 'right') {
    const cx = x1 - r, xs = cx - L * h;
    return `M${x0},${y} L${cx},${y} A${r},${r} 0 0 1 ${cx},${y + h} L${x0},${y + h} Z M${xs},${cyy - ri} L${cx},${cyy - ri} A${ri},${ri} 0 0 1 ${cx},${cyy + ri} L${xs},${cyy + ri} Z`;
  }
  const cx = x0 + r, xs = cx + L * h;
  return `M${x1},${y} L${cx},${y} A${r},${r} 0 0 0 ${cx},${y + h} L${x1},${y + h} Z M${xs},${cyy - ri} L${cx},${cyy - ri} A${ri},${ri} 0 0 0 ${cx},${cyy + ri} L${xs},${cyy + ri} Z`;
}

// Caméra automatique : regarde le centre de la pièce pliée, de trois quarts avant gauche, en plongée
export function autoCam(part, { dir = [-0.62, -0.9, 0.78], fov = 30, dist = 2.1, amount = 1 } = {}) {
  const pts = mesh(part, fold(part, amount)).flatMap((p) => p.pts);
  const mn = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i]))), mx = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  const c = mn.map((v, i) => (v + mx[i]) / 2), D = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  const n = Math.hypot(...dir), eye = c.map((v, i) => v + (dir[i] / n) * D * dist);
  return camera({ eye, target: c, fov });
}
