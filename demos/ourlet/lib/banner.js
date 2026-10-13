// Ourlet · bandeau « du plan à la pièce » en trame de lignes verticales : le même coffret 5520-A à quatre étapes, de gauche
// à droite : le développé (le plan, plis en trait), la découpe (les ouvertures), le pliage (à mi-course), la pièce peinte.
// Chaque cellule devient un trait centré : plus large et plus clair sur la pièce, fin sur le fond. Le fond suit un dégradé
// de lumière, clair à gauche, taupe à droite ; la dernière étape prend la teinte RAL.
// Entrée : la tête du laser passe une fois de gauche à droite, à la vitesse de coupe des tokens, et grave les pièces dans la
// trame (une ligne chaude sous la tête). L'image est calculée une seule fois par taille, puis seulement composée : le passage
// coûte un dixième de milliseconde par image. Animations réduites : l'image finale directement.
import { makePart, camera } from './part.js';
import { coffret } from './pieces.js';
import { sample, frameOf, hexRgb } from './raster.js';
import { MOTION, ticker, onceVisible, prefersReduced } from './motion.js';
import { P as PAL, ILLU } from '../tokens/tokens-v2.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

export function mountBanner(canvas, { ral = PAL.sauge, cw = 5, ch = 4, onStages = null, reduced = null, layout = () => [4, 1] } = {}) {
  const rm = reduced ?? prefersReduced();
  const full = coffret(), plan = makePart({ ...full, holes: [] });
  // une seule caméra, haute et de trois quarts : les étapes à plat se lisent comme posées sur l'établi
  const D = 560, cam = camera({ eye: [80 - D * 0.62, 55 - D * 0.95, D * 1.05], target: [80, 55, 18], fov: 28 });
  const ones = full.bends.map(() => 1), half = full.bends.map(() => 0.58), zeros = full.bends.map(() => 0);
  const stages = [[plan, zeros], [full, zeros], [full, half], [full, ones]];
  // un cadre commun aux quatre étapes : les pièces gardent la même échelle d'une case à l'autre
  const boxes = stages.map(([p, f]) => frameOf(p, f, cam));
  const ref = boxes.reduce((r, b) => [Math.min(r[0], b[0]), Math.min(r[1], b[1]), Math.max(r[2], b[2]), Math.max(r[3], b[3])]);
  const lineL = hexRgb(PAL['creme-50']), lineR = hexRgb(PAL['creme-100']), paint = hexRgb(ral), HOT = ILLU.chaud, hot = hexRgb(ILLU.chaud);
  let cache = null, prog = rm ? 1 : 0;
  // disposition : 4 × 1 sur grand écran, 2 × 2 sur téléphone ; chaque étape occupe une case de la grille de traits
  function compute(W, H, dpr) {
    const cols = Math.floor(W / cw), rows = Math.floor(H / ch), [gx, gy] = layout(W);
    const qx = Math.floor(cols / gx), qy = Math.floor(rows / gy);
    const lums = stages.map(([p, f], k) => {
      const ix = k % gx, iy = Math.floor(k / gx), w = ix === gx - 1 ? cols - (gx - 1) * qx : qx, h = iy === gy - 1 ? rows - (gy - 1) * qy : qy;
      const b = boxes[k], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, hw = (ref[2] - ref[0]) / 2, hh = (ref[3] - ref[1]) / 2;
      return { x: ix * qx, y: iy * qy, w, h, l: sample(p, f, cam, w, h, [cx - hw, cy - hh, cx + hw, cy + hh], { pad: 0.07, amb: 0.3, light: [-0.55, -0.45, 0.7], aspect: ch / cw, outline: k < 2 ? 0.7 : 0.3 }) };
    });
    // deux images : la trame vide (le fond, traits fins) et la trame gravée (les pièces)
    const mk = () => { const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, x]; };
    const [empty, ex] = mk(), [done, dx] = mk();
    const ox = (W - cols * cw) / 2;
    for (const x of [ex, dx]) { const gr = x.createLinearGradient(0, 0, W, H * 0.4); gr.addColorStop(0, ILLU['greige-450']); gr.addColorStop(0.5, ILLU['taupe-450']); gr.addColorStop(1, ILLU['taupe-550']); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
    for (let i = 0; i < cols; i++) {
      const xk = i / (cols - 1), base = mix(lineL, lineR, xk);
      for (let j = 0; j < rows; j++) {
        let k = -1;
        for (let s2 = 0; s2 < lums.length; s2++) { const L = lums[s2]; if (i >= L.x && i < L.x + L.w && j >= L.y && j < L.y + L.h) { k = s2; break; } }
        const L = lums[k], l = L ? (L.l[(j - L.y) * L.w + (i - L.x)] || 0) : 0, on = l > 0.04;
        const thin = `rgba(${base[0] | 0},${base[1] | 0},${base[2] | 0},0.42)`;
        ex.fillStyle = thin; ex.fillRect(ox + i * cw + (cw - cw * 0.14) / 2, j * ch, cw * 0.14, ch + 0.35);
        const w = on ? cw * (0.28 + 0.6 * l) : cw * 0.14;
        let c = base;
        if (k === 3 && on) c = mix(paint, [255, 255, 255], 0.18 * (1 - l)); // la pièce peinte
        dx.fillStyle = on ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : thin;
        dx.fillRect(ox + i * cw + (cw - w) / 2, j * ch, w, ch + 0.35);
      }
    }
    cache = { W, H, dpr, cols, rows, gx, gy, qx, qy, lums, empty, done };
  }
  function draw() {
    const W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    if (!cache || cache.W !== W || cache.H !== H || cache.dpr !== dpr) compute(W, H, dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const head = prog * (W + 2 * cw) - cw, hx = Math.round(clamp(head, 0, W) * dpr);
    ctx.drawImage(cache.empty, 0, 0);
    if (hx > 0) ctx.drawImage(cache.done, 0, 0, hx, canvas.height, 0, 0, hx, canvas.height);
    if (prog > 0 && prog < 1) { // la tête : une colonne chaude, et sa lueur
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgba(${hot.join(',')},0.18)`; ctx.fillRect(head - cw * 3, 0, cw * 6, H);
      ctx.fillStyle = HOT; ctx.fillRect(head - 1, 0, 2, H);
    }
    onStages && onStages(cache);
    return true;
  }
  const dur = () => (canvas.clientWidth + 2 * cw) / (MOTION.laser.coupe.v / 1000);
  const tk = ticker((dt) => { prog = clamp(prog + dt / dur()); draw(); return prog < 1; }, { el: canvas, margin: '0px' });
  if (!rm) onceVisible(canvas, () => tk.start(), { threshold: 0.25 });
  const ro = new ResizeObserver(() => draw()); ro.observe(canvas);
  draw();
  return { replay() { prog = 0; tk.start(); }, seek(p) { tk.stop(); prog = clamp(p); draw(); }, get duration() { return dur(); }, destroy() { tk.destroy(); ro.disconnect(); } };
}
