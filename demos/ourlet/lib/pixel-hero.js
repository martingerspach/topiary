// Ourlet · premier écran : la pièce en mosaïque de pixels. La tête du laser balaie l'écran de bas en haut à vitesse constante
// et allume la mosaïque ; le développé se plie dans l'ordre de la gamme (l'ourlet d'abord, en deux coups), au rythme de la
// presse ; puis la peinture le traverse en rideau, colonne par colonne. Toutes les durées et courbes viennent des tokens.
// Rendu : moteur 3D (part.js) → luminance sur-échantillonnée (raster.js) → une image d'un pixel par cellule, agrandie sans
// lissage, puis la grille d'un pixel posée par-dessus : quelques dixièmes de milliseconde au lieu de 9 000 rectangles.
// Les tons sont réduits à quelques niveaux (affiche) avec un tramage ordonné : quand une face tourne, ses cellules changent
// de niveau une à une, jamais toutes d'un coup. Cadrage fixe, calculé sur toute la chronologie. Déterministe : seek(t).
// Changer de teinte pose une nouvelle couche de peinture, qui passe en rideau par-dessus la précédente, à tout instant.
import { gamme } from './stage.js';
import { sample, ramp, frameOf, hexRgb } from './raster.js';
import { MOTION, EASE, ticker, prefersReduced } from './motion.js';
import { P as PAL, ILLU } from '../tokens/tokens-v2.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const mixRgb = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
// matrice de Bayer 4 × 4, normalisée sur ]0, 1[
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export function mountPixelHero(canvas, part, { cam, order, color = PAL.sauge, bg = PAL['charbon-900'], cell: cellOpt = 'auto', levels = 9, onFrame = null, reduced = null, autoplay = true, light = [-0.62, -0.5, 0.6], amb = 0.2, outline = 0.5, gamma = 1, pad = 0.1, falloff = 0.32 } = {}) {
  const PR = MOTION.presse;
  const g = gamme(part, order, { stroke: PR.appui.ms, pause: PR.maintien.ms, hemPre: 30, ease: EASE.appui });
  const rm = reduced ?? prefersReduced();
  // chronologie : le balayage dure le temps que met la tête à parcourir la hauteur, à la vitesse de coupe (px par seconde)
  const T = { flat: 0 };
  const scanMs = (H) => H / (MOTION.laser.coupe.v / 1000);
  function timeline(H) {
    T.scan = scanMs(H); T.fold0 = T.scan + PR.maintien.ms; T.fold1 = T.fold0 + g.duration; T.paint0 = T.fold1 + PR.maintien.ms * 2; T.paint1 = T.paint0 + MOTION.rideau.ms; T.end = T.paint1;
    T.flat = T.fold0;
  }
  timeline(canvas.clientHeight || 600);
  const fracAt = (ms) => g.state(Math.max(0, ms - T.fold0));
  // cadrage : boîte échantillonnée sur la chronologie du pliage, enveloppe glissante (± 600 ms) puis moyenne
  const STEP = 60, raw = [];
  for (let ms = 0; ms <= g.duration + 1500; ms += STEP) raw.push(frameOf(part, g.state(ms), cam));
  const Wn = 10;
  const env = raw.map((_, i) => { const r = [Infinity, Infinity, -Infinity, -Infinity]; for (let j = Math.max(0, i - Wn); j <= Math.min(raw.length - 1, i + Wn); j++) { const b = raw[j]; r[0] = Math.min(r[0], b[0]); r[1] = Math.min(r[1], b[1]); r[2] = Math.max(r[2], b[2]); r[3] = Math.max(r[3], b[3]); } return r; });
  const smooth = env.map((_, i) => { const r = [0, 0, 0, 0]; let n = 0; for (let j = Math.max(0, i - Wn); j <= Math.min(env.length - 1, i + Wn); j++) { for (let k = 0; k < 4; k++) r[k] += env[j][k]; n++; } return r.map((v) => v / n); });
  const boxAt = (ms) => { const x = clamp((ms - T.fold0) / STEP, 0, smooth.length - 1), a = Math.floor(x), b = Math.min(smooth.length - 1, a + 1), k = x - a; return smooth[a].map((v, j) => v + (smooth[b][j] - v) * k); };
  // rampes : l'acier brut (grège) et la pièce peinte (vers la teinte RAL)
  const steel = ramp([[0, PAL['charbon-800']], [0.22, ILLU['taupe-550']], [0.55, ILLU['acier-500']], [0.82, ILLU['acier-200']], [1, PAL.givre]]);
  const LITE = hexRgb(PAL['creme-50']);
  const makePaint = (hex) => { const c = hexRgb(hex), dark = hexRgb(PAL['charbon-900']), lite = LITE;
    return (l) => (l < 0.6 ? mixRgb(mixRgb(dark, c, 0.25), c, l / 0.6) : mixRgb(c, lite, ((l - 0.6) / 0.4) * 0.55)); };
  const HOT = hexRgb(ILLU.chaud);
  // couches de peinture : { ramp, t0 } ; une cellule prend la dernière couche dont le rideau l'a dépassée
  const base = () => [{ ramp: makePaint(color), t0: T.paint0 }];
  let layers = base(), paintHex = color, t = T.end, dead = false, playing = false;
  const off = document.createElement('canvas'), pix = document.createElement('canvas');
  let pctx = null, img = null, grid = null, gridKey = '';
  function draw(ms) {
    const W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d');
    // taille de cellule : environ 90 colonnes quelle que soit la largeur, entre 5 et 9 px, en pixels entiers de l'écran
    const cell = cellOpt === 'auto' ? Math.max(5, Math.min(9, Math.round(Math.min(W, H * 1.1) / 88))) : cellOpt;
    const cols = Math.floor(W / cell), rows = Math.floor(H / cell);
    const ox = Math.round(((W - cols * cell) / 2) * dpr) / dpr, oy = Math.round(((H - rows * cell) / 2) * dpr) / dpr;
    const f = fracAt(ms);
    const lum = sample(part, f, cam, cols, rows, boxAt(Math.min(ms, T.fold1 + 1500)), { pad, amb, light, off, outline, gamma, falloff, lite: true });
    if (pix.width !== cols || pix.height !== rows) { pix.width = cols; pix.height = rows; pctx = pix.getContext('2d'); img = pctx.createImageData(cols, rows); }
    const d = img.data;
    // balayage du laser : la tête monte à vitesse constante ; derrière elle, la mosaïque est allumée
    const scan = rm ? 1 : seg(ms, 0, T.scan), headRow = rows - scan * (rows + 2);
    // rideaux de peinture : position du front pour chaque couche
    const fronts = layers.map((L) => { const p = EASE.rideau(seg(ms, L.t0, L.t0 + MOTION.rideau.ms)); return p * (cols + 6) - 3; });
    for (let j = 0; j < rows; j++) {
      const dj = j - headRow; // > 0 : déjà balayé
      for (let i = 0; i < cols; i++) {
        const o = (j * cols + i) * 4;
        let l = lum[j * cols + i];
        if (l < 0.02 || dj < 0) { d[o + 3] = 0; continue; }
        // niveaux d'affiche, tramage ordonné
        l = Math.min(levels, Math.floor(l * levels + BAYER[(j & 3) * 4 + (i & 3)])) / levels;
        let c = steel(l), edge = 0;
        for (let k = layers.length - 1; k >= 0; k--) {
          const dd = fronts[k] - i;
          if (dd > 2) { c = layers[k].ramp(l); break; }
          if (dd > -1) { edge = 1; c = mixRgb(layers[k].ramp(Math.min(1, l + 0.25)), LITE, 0.35); break; }
        }
        if (dj < 1.5) c = mixRgb(c, HOT, 0.6 * (1 - dj / 1.5)); // la ligne chaude sous la tête
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    pctx.putImageData(img, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pix, ox, oy, cols * cell, rows * cell);
    // la grille : un trait de la couleur du fond entre les cellules, en pixels entiers de l'écran
    const gap = Math.max(1, Math.round(1.5 * dpr)) / dpr, key = `${cell}|${dpr}|${ox}|${oy}`;
    if (key !== gridKey) {
      gridKey = key; const tile = document.createElement('canvas'), n = Math.round(cell * dpr), gd = Math.round(gap * dpr);
      tile.width = n; tile.height = n; const tc = tile.getContext('2d'); tc.fillStyle = bg; tc.fillRect(0, 0, n, gd); tc.fillRect(0, 0, gd, n);
      grid = ctx.createPattern(tile, 'repeat');
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    grid.setTransform(new DOMMatrix().translate(Math.round(ox * dpr) - Math.round(gap * dpr / 2), Math.round(oy * dpr) - Math.round(gap * dpr / 2)));
    ctx.fillStyle = grid; ctx.fillRect(Math.round(ox * dpr) - 1, Math.round(oy * dpr) - 1, Math.round(cols * cell * dpr) + 2, Math.round(rows * cell * dpr) + 2);
    const lastL = layers[layers.length - 1];
    const pEnd = lastL.t0 + MOTION.rideau.ms;
    onFrame && onFrame({ ms, f, painted: seg(ms, lastL.t0, pEnd), phase: ms < T.fold0 ? 'flat' : ms < T.paint0 ? 'fold' : ms < pEnd ? 'paint' : 'done' });
    return true;
  }
  const endOf = () => Math.max(T.end, layers[layers.length - 1].t0 + MOTION.rideau.ms);
  const tk = ticker((dt) => {
    if (dead) return false;
    t = Math.min(endOf(), t + dt);
    if (!draw(t)) return true;
    if (t >= endOf()) { playing = false; layers = [layers[layers.length - 1]]; return false; }
    return true;
  }, { el: canvas, margin: '0px' });
  const api = {
    T,
    get strokes() { return g.strokes; },
    play() { layers = base(); layers[0].ramp = makePaint(paintHex); if (rm) { t = T.end; api.redraw(); return; } t = 0; playing = true; tk.start(); },
    seek(ms) { tk.stop(); playing = false; layers = base(); layers[0].ramp = makePaint(paintHex); t = clamp(ms, 0, T.end); api.redraw(); },
    setColor(hex) {
      paintHex = hex;
      if (rm) { layers = [{ ramp: makePaint(hex), t0: -1e9 }]; t = Math.max(t, T.end); api.redraw(); return; }
      if (t < T.paint0 && playing) { layers[0].ramp = makePaint(hex); return; } // le rideau n'est pas encore passé : on change la peinture prévue
      // sinon, une nouvelle couche passe par-dessus, dès maintenant (même si le rideau précédent n'a pas fini)
      layers.push({ ramp: makePaint(hex), t0: t });
      if (layers.length > 4) layers.splice(0, layers.length - 4);
      playing = true; tk.start();
    },
    // arrêter : la scène saute à son état final (pliée, peinte), comme en mouvements réduits
    stop() { tk.stop(); playing = false; layers = [{ ramp: makePaint(paintHex), t0: -1e9 }]; t = Math.max(t, T.end); api.redraw(); },
    redraw() { if (!dead && !draw(t)) requestAnimationFrame(() => api.redraw()); },
    get playing() { return playing; },
    get t() { return t; },
    destroy() { dead = true; tk.destroy(); ro.disconnect(); },
  };
  const ro = new ResizeObserver(() => { const H = canvas.clientHeight; if (H && !playing && t >= T.end) { timeline(H); t = T.end; layers = [{ ramp: makePaint(paintHex), t0: -1e9 }]; } if (!playing) api.redraw(); });
  ro.observe(canvas);
  if (autoplay && !rm) api.play(); else { t = T.end; layers = [{ ramp: makePaint(paintHex), t0: -1e9 }]; api.redraw(); }
  return api;
}
