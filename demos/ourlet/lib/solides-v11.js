// Ourlet · solides du film (v9) : vecteurs, rotations, boîtes, prismes et cylindres, chacun dans le repère de son objet.
// Le film (film-atelier-v9.js) et le bras articulé (bras-v9.js) partagent ces briques ; le moteur (trace-gl-v9.js) les pose
// par un décalage (décor fixe) ou par une rotation et un décalage (solides articulés), et calcule leur ton selon la normale.
// Une face : { kind: 'face', pts, holes?, uv?, huv?, n?, nrms?, aretes?, sil?, meta: { g, u } }
//   n : normale sortante (calculée si absente) ; nrms : normales par sommet (cylindres : le ton tourne avec la surface) ;
//   aretes : masque des arêtes du contour à tracer ; sil : arêtes tracées seulement en silhouette, [a, b, normale voisine] ;
//   traits : traits dessinés sur la face, [a, b].

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mulS = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const newell = (P) => { let x = 0, y = 0, z = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); } return norm([x, y, z]); };

// ---------- rotations : matrices 3 × 3 rangées par lignes ----------
export const mul3 = (A, B) => { const r = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return r; };
export const app3 = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
export const tr3 = (M) => [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];
export const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
export const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
export const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
// la base dont les colonnes sont x, y, z
export const base3 = (x, y, z) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];

// ---------- solides (normales sortantes) ----------
export const quad = (a, b, c, d, meta) => ({ kind: 'face', pts: [a, b, c, d], meta });
// boîte : dessus, quatre côtés, et le dessous si fond (un solide qui tourne montre toutes ses faces)
export function box(x0, x1, y0, y1, z0, z1, meta, fond = false) {
  const out = [
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], { ...meta, u: [1, 0, 0] }),
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], { ...meta, u: [1, 0, 0] }),
    quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], { ...meta, u: [1, 0, 0] }),
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], { ...meta, u: [0, 0, 1] }),
    quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], { ...meta, u: [0, 0, 1] }),
  ];
  if (fond) out.push(quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], { ...meta, u: [1, 0, 0] }));
  return out;
}
// un profil [[y, z], …] extrudé le long de x
export function prismX(prof, x0, x1, meta) {
  let a = 0; for (let i = 0; i < prof.length; i++) { const [y0, z0] = prof[i], [y1, z1] = prof[(i + 1) % prof.length]; a += y0 * z1 - y1 * z0; }
  const pr = a > 0 ? prof.slice().reverse() : prof; // sens horaire dans (y, z) : faces latérales sortantes
  const out = [{ kind: 'face', pts: pr.map(([y, z]) => [x0, y, z]), meta: { ...meta, u: [0, 0, 1] } }, { kind: 'face', pts: pr.map(([y, z]) => [x1, y, z]).reverse(), meta: { ...meta, u: [0, 0, 1] } }];
  for (let i = 0; i < pr.length; i++) { const [y0, z0] = pr[i], [y1, z1] = pr[(i + 1) % pr.length]; out.push(quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z1], [x0, y1, z1], { ...meta, u: [1, 0, 0] })); }
  return out;
}
// un profil [[x, z], …] extrudé le long de y (les flasques d'un bras : le profil est sa vue de côté)
export function prismY(prof, y0, y1, meta) {
  let a = 0; for (let i = 0; i < prof.length; i++) { const [x0, z0] = prof[i], [x1, z1] = prof[(i + 1) % prof.length]; a += x0 * z1 - x1 * z0; }
  const pr = a < 0 ? prof.slice().reverse() : prof; // sens direct dans (x, z)
  const out = [{ kind: 'face', pts: pr.map(([x, z]) => [x, y0, z]), meta: { ...meta, u: [1, 0, 0] } }, { kind: 'face', pts: pr.map(([x, z]) => [x, y1, z]).reverse(), meta: { ...meta, u: [1, 0, 0] } }];
  for (let i = 0; i < pr.length; i++) { const [xa, za] = pr[i], [xb, zb] = pr[(i + 1) % pr.length]; out.push(quad([xa, y0, za], [xa, y1, za], [xb, y1, zb], [xb, y0, zb], { ...meta, u: [xb - xa, 0, zb - za] })); }
  return out;
}
// cylindre (ou tronc de cône, r1 ≠ r) : facettes et deux disques ; trame en anneaux (le tournage) ; le ton suit la normale de
// chaque sommet (la surface tourne sans facettes) ; les génératrices ne sont tracées qu'en silhouette (sil)
export function cyl(p0, p1, r, meta, n = 16, r1 = r) {
  const d = sub(p1, p0), L = Math.hypot(...d), w = mulS(d, 1 / L);
  const a = Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(w, a)), v = cross(w, u), pente = (r - r1) / L;
  const rad = (i) => { const t = (i / n) * Math.PI * 2; return add(mulS(u, Math.cos(t)), mulS(v, Math.sin(t))); };
  const nrm = (i) => norm(add(rad(i), mulS(w, pente)));
  const A = Array.from({ length: n }, (_, i) => add(p0, mulS(rad(i), r))), B = Array.from({ length: n }, (_, i) => add(p1, mulS(rad(i), r1)));
  const out = [{ kind: 'face', pts: A.slice().reverse(), meta: { ...meta, u: [...u] }, n: mulS(w, -1) }, { kind: 'face', pts: B, meta: { ...meta, u: [...u] }, n: w }];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, s0 = (i / n) * Math.PI * 2 * r, s1 = ((i + 1) / n) * Math.PI * 2 * r;
    out.push({ kind: 'face', pts: [A[i], A[j], B[j], B[i]], uv: [[s0, 0], [s1, 0], [s1, L], [s0, L]], n: nrm(i + 0.5), nrms: [nrm(i), nrm(i + 1), nrm(i + 1), nrm(i)], meta: { ...meta, u: [...w] },
      aretes: [true, false, true, false], sil: [[A[j], B[j], nrm(i + 1.5)], [B[i], A[i], nrm(i - 0.5)]] });
  }
  return out;
}
export const moved = (polys, dx, dy = 0, dz = 0) => { const mv = (q) => [q[0] + dx, q[1] + dy, q[2] + dz]; return polys.map((p) => ({ ...p, pts: p.pts.map(mv), holes: p.holes ? p.holes.map((H) => H.map(mv)) : undefined, sil: p.sil ? p.sil.map(([a, b, n]) => [mv(a), mv(b), n]) : undefined })); };

// trame d'un solide articulé : les lignes suivent l'axe donné (le sens de la pièce mécanique), projeté dans chaque face ;
// une face perpendiculaire à cet axe prend le second axe. Coordonnées dans le repère de l'objet : la trame tourne avec lui.
export function tramer(polys, axe = [1, 0, 0], second = [0, 0, 1]) {
  for (const p of polys) {
    p.n = p.n || newell(p.pts);
    if (p.uv) continue;
    let d = sub(axe, mulS(p.n, dot(axe, p.n))); if (Math.hypot(...d) < 0.2) d = sub(second, mulS(p.n, dot(second, p.n)));
    d = norm(d); const e = cross(p.n, d), uv = (q) => [dot(q, d), dot(q, e)];
    p.uv = p.pts.map(uv); if (p.holes) p.huv = p.holes.map((H) => H.map(uv));
  }
  return polys;
}

// une face prête pour tr.maille (trace-gl-v9) : sa part de ton (ton), sa normale (le ton final est calculé dans le shader ;
// cuit : le ton donné est le ton final), ses arêtes vues (contour selon le masque, trous, silhouettes) de largeur w et de
// couleur c (0 : encre, 1 : trait clair)
export function faceGL(f, { ton = 0.6, cuit = false, w = 1, c = 1, aretes = true, peint = 0 } = {}) {
  const n = f.n || newell(f.pts), ar = [];
  if (aretes) {
    f.pts.forEach((a, i) => { if (!f.aretes || f.aretes[i]) ar.push([a, f.pts[(i + 1) % f.pts.length], w, c]); });
    for (const h of f.holes || []) h.forEach((a, i) => ar.push([a, h[(i + 1) % h.length], w, c]));
    for (const [a, b, n2] of f.sil || []) ar.push([a, b, w, c, 0, 1, n2]);
    for (const [a, b, ti = 0, al = 1] of f.traits || []) ar.push([a, b, w, c, ti, al]); // traits dessinés sur la face (rainures, marquages) : [a, b, tirets?, opacité?]
  }
  return { pts: f.pts, uv: f.uv, ton, n: cuit ? null : n, na: n, nrms: cuit ? null : f.nrms, trous: f.holes && f.holes.length ? f.holes.map((h, i) => ({ pts: h, uv: f.huv[i] })) : null, cle: f.cle, plein: f.plein, peint, aretes: ar };
}
