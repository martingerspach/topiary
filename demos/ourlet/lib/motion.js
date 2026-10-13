// Ourlet · la grammaire de mouvement côté JS. Courbes, durées et vitesses viennent de tokens-v2.js (build-tokens-v2.mjs) ;
// ce module ne fait que les rendre utilisables : une courbe de Bézier évaluée comme le fait le navigateur, et une horloge
// d'animation commune (pas plafonné, arrêt quand l'onglet est masqué ou que la scène sort de l'écran, reprise sans saut).
import { MOTION } from '../tokens/tokens-v2.js';
export { MOTION };

// cubic-bezier(x1, y1, x2, y2) : x ∈ [0, 1] → y (Newton, puis dichotomie si la pente s'annule)
export function bezier([x1, y1, x2, y2]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t, dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-7) return sy(t); const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 40; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-7) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}

export const EASE = {
  approche: bezier(MOTION.presse.approche.ease), appui: bezier(MOTION.presse.appui.ease), retour: bezier(MOTION.presse.retour.ease),
  vide: bezier(MOTION.laser.vide.ease), rideau: bezier(MOTION.rideau.ease), convoyeur: bezier(MOTION.convoyeur.ease), camera: bezier(MOTION.camera.ease), lineaire: (x) => x,
};

export const prefersReduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// IntersectionObserver rapporté au document : dans l'iframe d'un artefact (autre origine), rootMargin est ignoré
// quand la racine est implicite ; avec root: document, il s'applique à la fenêtre de l'iframe (repli sans root si refusé)
export function observateur(cb, opts = {}) {
  try { return new IntersectionObserver(cb, { root: document, ...opts }); } catch { return new IntersectionObserver(cb, opts); }
}

// Horloge d'animation. onFrame(dt, now) est appelé à chaque image tant que la scène est voulue, visible et l'onglet affiché ;
// dt est plafonné (une image perdue ralentit la scène au lieu de la faire sauter) ; renvoyer false arrête l'horloge.
// fps : cadence visée, ramenée au diviseur entier de l’écran le plus proche (un écran rapide ne fait pas travailler la page deux fois plus pour rien).
export function ticker(onFrame, { el = null, margin = '120px', maxStep = 1000 / 30, fps = 60 } = {}) {
  // la cadence est un diviseur entier de l'écran, pour un pas régulier : 60, 75 et 90 Hz chaque image, 120 Hz une sur deux (60 i/s),
  // 144 Hz une sur deux (72 i/s), 165 Hz une sur trois (55 i/s), 240 Hz une sur quatre (60 i/s).
  // Le seuil fixe de 90 % (v5) donnait 37,5 i/s à 75 Hz et 45 i/s à 90 Hz (relevé par la revue du pied de page).
  const cible = 1000 / fps;
  let raf = 0, last = 0, prev = 0, iv = 0, saut = 0, running = false, wanted = false, visible = !el, shown = typeof document === 'undefined' || !document.hidden;
  const loop = (now) => {
    raf = 0;
    if (!running) return;
    if (prev) { const d = now - prev; if (d > 3 && d < 50) iv = iv ? iv + (d - iv) * 0.1 : d; } // l'intervalle de l'écran, lissé
    prev = now;
    const n = iv ? Math.max(1, Math.floor(cible / iv + 0.25)) : 1;
    if (last && ++saut < n) { raf = requestAnimationFrame(loop); return; } // une image d'écran sur n
    saut = 0;
    const dt = last ? Math.min(maxStep, Math.max(0, now - last)) : 0;
    last = now;
    if (onFrame(dt, now) === false) { wanted = false; running = false; return; }
    raf = requestAnimationFrame(loop);
  };
  const sync = () => {
    const should = wanted && visible && shown;
    if (should && !running) { running = true; last = 0; prev = 0; saut = 0; raf = requestAnimationFrame(loop); }
    else if (!should && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  };
  const onVis = () => { shown = !document.hidden; sync(); };
  document.addEventListener('visibilitychange', onVis);
  let io = null;
  if (el) { io = observateur((es) => { visible = es[es.length - 1].isIntersecting; sync(); }, { rootMargin: margin }); io.observe(el); }
  return {
    start() { wanted = true; sync(); },
    stop() { wanted = false; sync(); },
    get running() { return running; }, get wanted() { return wanted; }, get visible() { return visible; },
    destroy() { wanted = false; sync(); document.removeEventListener('visibilitychange', onVis); io && io.disconnect(); },
  };
}

// Appelle fn une seule fois, quand el est visible à la proportion voulue
export function onceVisible(el, fn, { threshold = 0.3 } = {}) {
  const io = observateur((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold });
  io.observe(el);
  return () => io.disconnect();
}
