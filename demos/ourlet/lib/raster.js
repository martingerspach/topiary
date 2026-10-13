// Ourlet · trames : une pièce rendue par le moteur 3D (part.js), puis traduite en pixels, en lignes ou en points.
// Étape 1 : la scène est dessinée en niveaux de gris dans un petit canvas hors écran, sur-échantillonné (3 × 3 par cellule)
// pour que les bords restent stables quand la pièce bouge (pas de scintillement de trame).
// Étape 2 : chaque cellule devient un carré (mosaïque), un trait vertical d'épaisseur variable (trame de lignes) ou un point
// de rayon variable (demi-teinte). Les tons suivent une rampe de couleurs (charbon → givre, ou vers une teinte RAL).
import { fold, mesh, render } from './part.js';

const SS = 3; // sur-échantillonnage par cellule
const lerp = (a, b, k) => a + (b - a) * k;
export const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// Rampe : liste de [position 0..1, '#hex'] → fonction l (0..1) → [r, g, b]
export function ramp(stops) {
  const s = stops.map(([p, c]) => [p, hexRgb(c)]);
  return (l) => {
    if (l <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) if (l <= s[i][0]) { const k = (l - s[i - 1][0]) / (s[i][0] - s[i - 1][0]); return s[i - 1][1].map((v, j) => lerp(v, s[i][1][j], k)); }
    return s[s.length - 1][1];
  };
}

// Projection et cadrage d'une pièce (même convention que render)
export function frameOf(part, f, cam) {
  const polys = mesh(part, fold(part, (k) => f[k]));
  const r = render(polys, cam, { size: 1 });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of r) for (const q of p.pr) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  return [x0, y0, x1, y1];
}

// Luminance de la scène à la résolution de la grille : renvoie Float32Array (cols × rows), 0 = fond, 1 = face la plus claire.
// box : cadre projeté [x0, y0, x1, y1] à tenir dans la grille (avec la marge pad).
// lite : sans les parois des trous (invisibles à la taille d'une cellule) ni chemins SVG : le premier écran le rend à chaque image
export function sample(part, f, cam, cols, rows, box, { pad = 0.08, amb = 0.28, light = [-0.45, -0.35, 0.82], cell = 1, aspect = 1, off = null, outline = 0, gamma = 1, falloff = 0, lite = false } = {}) {
  const W = cols * SS, H = rows * SS;
  const cv = off || (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H }));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  // la grille peut avoir des cellules non carrées à l'écran (aspect = hauteur / largeur d'une cellule)
  const [x0, y0, x1, y1] = box, bw = x1 - x0, bh = (y1 - y0) / aspect;
  const s = Math.min(W * (1 - 2 * pad) / bw, H * (1 - 2 * pad) / bh);
  const cx = W / 2 - ((x0 + x1) / 2) * s, cy = H / 2 - ((y0 + y1) / 2) * s / aspect;
  let polys = mesh(part, fold(part, (k) => f[k]));
  if (lite) polys = polys.filter((p) => p.kind !== 'bore');
  const r = render(polys, cam, { size: s, cx: 0, cy: 0, color: [255, 255, 255], ink: [0, 0, 0], amb, light, paths: !lite });
  ctx.lineJoin = 'round';
  for (const p of r) {
    ctx.beginPath();
    p.pr.forEach((q, i) => { const X = cx + q[0], Y = cy + q[1] / aspect; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath();
    if (p.holes) for (const Hh of p.holes) { Hh.forEach((q, i) => { const X = cx + q[0], Y = cy + q[1] / aspect; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath(); }
    ctx.fillStyle = p.fill; ctx.fill('evenodd');
    // contour de face (comme le trait du pixel art) : il sépare deux faces de tons voisins
    if (outline) { ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = outline * SS; ctx.stroke(); } else { ctx.strokeStyle = p.fill; ctx.lineWidth = 0.6; ctx.stroke(); }
  }
  // chute de lumière sur l'ensemble de la pièce : plus claire en haut à gauche, plus sombre en bas à droite
  if (falloff) { ctx.globalCompositeOperation = 'multiply'; const gr = ctx.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, `rgb(${Math.round(255 * (1 - falloff))},${Math.round(255 * (1 - falloff))},${Math.round(255 * (1 - falloff))})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  const d = ctx.getImageData(0, 0, W, H).data, out = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let acc = 0;
    for (let v = 0; v < SS; v++) for (let u = 0; u < SS; u++) acc += d[((j * SS + v) * W + (i * SS + u)) * 4];
    out[j * cols + i] = gamma === 1 ? acc / (SS * SS * 255) : Math.pow(acc / (SS * SS * 255), gamma);
  }
  return out;
}

// Mosaïque : carrés légèrement espacés ; levels > 0 quantifie les tons (affiche posterisée), 0 = tons continus
export function drawPixels(ctx, lum, cols, rows, { x = 0, y = 0, cell = 8, gap = 1, ramp: rp, bg = null, levels = 0, floor = 0.02 } = {}) {
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(x, y, cols * cell, rows * cell); }
  const sz = cell - gap;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let l = lum[j * cols + i]; if (l < floor) continue;
    if (levels) l = Math.round(l * levels) / levels;
    const c = rp(l); ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    ctx.fillRect(x + i * cell + gap / 2, y + j * cell + gap / 2, sz, sz);
  }
}

// Trame de lignes verticales : dans chaque cellule, un trait centré dont la largeur suit le ton (clair = large)
export function drawLines(ctx, lum, cols, rows, { x = 0, y = 0, cw = 6, ch = 6, ramp: rp, min = 0.12, max = 0.86, color = null } = {}) {
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const l = lum[j * cols + i], w = cw * lerp(min, max, l);
      if (w < 0.25) continue;
      const c = color || rp(l);
      ctx.fillStyle = typeof c === 'string' ? c : `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
      ctx.fillRect(x + i * cw + (cw - w) / 2, y + j * ch, w, ch + 0.4);
    }
  }
}

// Demi-teinte : un point par cellule, de rayon proportionnel au ton
export function drawDots(ctx, lum, cols, rows, { x = 0, y = 0, cell = 8, ramp: rp, rmin = 0, rmax = 0.5, floor = 0.03 } = {}) {
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const l = lum[j * cols + i]; if (l < floor) continue;
    const r = cell * lerp(rmin, rmax, Math.sqrt(l)); if (r < 0.3) continue;
    const c = rp(l); ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    ctx.beginPath(); ctx.arc(x + (i + 0.5) * cell, y + (j + 0.5) * cell, r, 0, Math.PI * 2); ctx.fill();
  }
}

// Canvas net à la densité de l'écran ; renvoie le contexte et la taille CSS
export function fit(canvas) {
  const W = canvas.clientWidth, H = canvas.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  return { ctx, W, H, dpr };
}
