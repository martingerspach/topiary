// Ourlet · scène de pliage : dessine une pièce sur un canvas et la plie dans l'ordre d'atelier.
// Choréographie : comme sur une presse plieuse, un pli à la fois, dans l'ordre de gamme ; un ourlet se fait en deux coups
// (pré-pliage aigu à 30°, puis écrasement), d'où la pause entre les deux. Le cadrage glisse du développé à plat
// vers la pièce pliée. Tout est déterministe : seek(t) donne la même image à chaque fois (captures, films).
// Animations réduites : la pièce s'affiche directement pliée.
import { fold, mesh, render, hex } from './part.js';
import { ticker } from './motion.js';

const presse = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // l'easing --ou-ease-presse, en code

// Gamme de pliage : liste de coups { bend, from, to } ; un ourlet donne deux coups.
// stroke, pause et ease sont facultatifs : la landing v3 passe la grammaire des tokens (presse), les anciennes pages gardent ces valeurs.
export function gamme(part, order, { stroke = 560, pause = 220, hemPre = 30, ease = presse } = {}) {
  const strokes = [];
  for (const k of order) {
    const ang = part.bends[k].angle;
    if (Math.abs(ang) >= 170) {
      strokes.push({ bend: k, from: 0, to: hemPre / Math.abs(ang), ms: stroke * 0.7 });
      strokes.push({ bend: k, from: hemPre / Math.abs(ang), to: 1, ms: stroke });
    } else strokes.push({ bend: k, from: 0, to: 1, ms: stroke });
  }
  let t = 0;
  for (const s of strokes) { s.t0 = t; t += s.ms; s.t1 = t; t += pause; }
  const duration = t - pause;
  const state = (ms) => {
    const f = new Array(part.bends.length).fill(0);
    for (const s of strokes) {
      if (ms >= s.t1) f[s.bend] = s.to;
      else if (ms > s.t0) f[s.bend] = s.from + (s.to - s.from) * ease((ms - s.t0) / s.ms);
      else if (f[s.bend] < s.from) f[s.bend] = Math.max(f[s.bend], 0);
    }
    return f;
  };
  return { strokes, duration, state };
}

// Boîte projetée d'un état (pour cadrer)
function bbox(part, f, cam) {
  const polys = mesh(part, fold(part, (k) => f[k]));
  const r = render(polys, cam, { size: 1 });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of r) for (const q of p.pr) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  return [x0, y0, x1, y1];
}

export function mountStage(canvas, part, { cam, order, color = '#B9CEAC', edge = null, outline = 0.42, pad = 0.1, amb = 0.5, lift = 0.1, ink = [29, 33, 35], reduced = null, onDone = null, onStart = null, autoplay = true, frameFlat = true, timing = {}, frameEase = presse } = {}) {
  const ctx = canvas.getContext('2d');
  const g = gamme(part, order, timing);
  const ones = new Array(part.bends.length).fill(1), zeros = new Array(part.bends.length).fill(0);
  const bFold = bbox(part, ones, cam), bFlat = frameFlat ? bbox(part, zeros, cam) : bFold;
  let col = hex(color), edg = edge ? hex(edge) : null, t = g.duration, playing = false, dead = false;
  const rm = reduced ?? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function fit(p) { // interpole le cadrage entre le développé et la pièce pliée
    const e = frameEase(Math.min(1, Math.max(0, p)));
    return bFlat.map((v, i) => v + (bFold[i] - v) * e);
  }
  function draw(ms) {
    const W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const f = g.state(ms);
    const [x0, y0, x1, y1] = fit(g.duration ? ms / g.duration : 1);
    const bw = x1 - x0, bh = y1 - y0, s = Math.min(W * (1 - 2 * pad) / bw, H * (1 - 2 * pad) / bh);
    const cx = W / 2 - ((x0 + x1) / 2) * s, cy = H / 2 - ((y0 + y1) / 2) * s;
    const polys = mesh(part, fold(part, (k) => f[k]));
    const r = render(polys, cam, { size: s, cx, cy, color: col, edge: edg, ink, amb, lift, paths: false });
    const line = `rgb(${ink.map((v, i) => Math.round(v + (col[i] - v) * 0.5)).join(',')})`;
    for (const p of r) {
      ctx.beginPath();
      p.pr.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
      if (p.holes) for (const Hh of p.holes) { Hh.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); }
      ctx.fillStyle = p.fill; ctx.fill('evenodd');
      ctx.lineJoin = 'round'; ctx.lineWidth = outline; ctx.strokeStyle = outline ? line : p.fill; ctx.stroke();
    }
    return true;
  }
  // horloge commune (motion.js) : pas plafonné, arrêt quand l'onglet est masqué ou la pièce hors écran, reprise sans saut
  const tk = ticker((dt) => {
    if (dead) return false;
    t = Math.min(g.duration, t + dt);
    if (!draw(t)) return true; // taille nulle (caché) : attendre, ne jamais s'arrêter
    if (t >= g.duration) { playing = false; onDone && onDone(); return false; }
    return true;
  }, { el: canvas, margin: '0px' });
  const api = {
    duration: g.duration, gamme: g,
    play() { tk.stop(); if (rm) { t = g.duration; api.redraw(); onDone && onDone(); return; } t = 0; playing = true; onStart && onStart(); tk.start(); },
    stop() { tk.stop(); const was = playing; playing = false; t = g.duration; api.redraw(); if (was) onDone && onDone(); },
    seek(ms) { tk.stop(); playing = false; t = Math.max(0, Math.min(g.duration, ms)); api.redraw(); },
    setColor(c, e) { col = hex(c); if (e) edg = hex(e); if (!playing) api.redraw(); },
    redraw() { if (dead) return; if (!draw(t)) requestAnimationFrame(() => api.redraw()); },
    get playing() { return playing; },
  };
  const ro = new ResizeObserver(() => { if (!playing && !dead) api.redraw(); }); ro.observe(canvas);
  api.destroy = () => { dead = true; tk.destroy(); ro.disconnect(); };
  if (autoplay && !rm) { t = 0; api.redraw(); api.play(); } else { t = g.duration; api.redraw(); }
  return api;
}
