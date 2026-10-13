// Ourlet · scène du premier écran : le développé en acier brut se plie dans l'ordre de la gamme (l'ourlet d'abord, en deux
// coups), chaque angle s'affiche en direct sur son pli, puis la peinture passe sur la pièce comme un rideau, de gauche à droite.
// Ombre portée calculée sur le sol (projection selon la lumière), cadrage lissé qui suit la pièce sans à-coup.
// Déterministe : seek(t) redonne la même image. Animations réduites : la pièce s'affiche pliée et peinte.
import { fold, mesh, render, hex, apply } from './part.js';
import { gamme } from './stage.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const presse = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const outC = (x) => 1 - Math.pow(1 - x, 3);
const parse = (s) => s.match(/\d+/g).map(Number);
const LIGHT = [-0.45, -0.35, 0.82];
const Ln = (() => { const l = Math.hypot(...LIGHT); return LIGHT.map((v) => v / l); })();

export function mountHero(canvas, part, { cam, order, steel = '#A3AAAE', color = '#B9CEAC', labels = null, onFrame = null, reduced = null, autoplay = true, ink = [29, 33, 35], amb = 0.46, lift = 0.1, pad = 0.12 } = {}) {
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas'), octx = off.getContext('2d');
  const g = gamme(part, order, { stroke: 680, pause: 260, hemPre: 30 });
  const T = { flat: 700 }; T.fold0 = T.flat; T.fold1 = T.fold0 + g.duration; T.paint0 = T.fold1 + 300; T.paint1 = T.paint0 + 1300; T.end = T.paint1;
  const rm = reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  let steelC = hex(steel), from = hex(steel), to = hex(color), wipe = { t0: T.paint0, t1: T.paint1 }, t = T.end, raf = 0, start = 0, playing = false, dead = false;

  const fracAt = (ms) => g.state(Math.max(0, ms - T.fold0));
  const projector = (size, cx, cy) => (p) => { const v = [p[0] - cam.eye[0], p[1] - cam.eye[1], p[2] - cam.eye[2]]; const x = v[0] * cam.r[0] + v[1] * cam.r[1] + v[2] * cam.r[2], y = v[0] * cam.u[0] + v[1] * cam.u[1] + v[2] * cam.u[2], z = v[0] * cam.f[0] + v[1] * cam.f[1] + v[2] * cam.f[2]; return [cx + (x * cam.k / z) * size, cy - (y * cam.k / z) * size]; };
  // ombre : chaque point descend selon la lumière jusqu'au sol (le point le plus bas de la pièce)
  const shadowPolys = (polys) => {
    let z0 = Infinity; for (const p of polys) for (const q of p.pts) z0 = Math.min(z0, q[2]);
    return polys.filter((p) => p.kind === 'face' && p.side === 'bottom').map((p) => p.pts.map((q) => { const k = (q[2] - z0) / Ln[2]; return [q[0] - Ln[0] * k, q[1] - Ln[1] * k, z0]; }));
  };
  // cadrage : boîte de la pièce et de son ombre, échantillonnée sur toute la chronologie puis lissée (enveloppe glissante)
  const boxAt = (ms) => {
    const f = fracAt(ms), polys = mesh(part, fold(part, (k) => f[k])), P = projector(1, 0, 0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (q) => { const p = P(q); x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); };
    for (const p of polys) for (const q of p.pts) add(q);
    for (const s of shadowPolys(polys)) for (const q of s) add(q);
    return [x0, y0, x1, y1];
  };
  const STEP = 50, samples = [];
  for (let ms = 0; ms <= T.fold1 + STEP; ms += STEP) samples.push(boxAt(ms));
  const W = 9; // ± 450 ms
  const env = samples.map((_, i) => { const r = [Infinity, Infinity, -Infinity, -Infinity]; for (let j = Math.max(0, i - W); j <= Math.min(samples.length - 1, i + W); j++) { const b = samples[j]; r[0] = Math.min(r[0], b[0]); r[1] = Math.min(r[1], b[1]); r[2] = Math.max(r[2], b[2]); r[3] = Math.max(r[3], b[3]); } return r; });
  const smooth = env.map((_, i) => { const r = [0, 0, 0, 0]; let n = 0; for (let j = Math.max(0, i - W); j <= Math.min(env.length - 1, i + W); j++) { for (let k = 0; k < 4; k++) r[k] += env[j][k]; n++; } return r.map((v) => v / n); });
  const frameBox = (ms) => { const i = clamp(ms / STEP, 0, smooth.length - 1), a = Math.floor(i), b = Math.min(smooth.length - 1, a + 1), k = i - a; return smooth[a].map((v, j) => v + (smooth[b][j] - v) * k); };

  // étiquettes d'angle (HTML, net à toute taille) : chacune apparaît avec son pli et s'efface peu après, pour ne jamais s'empiler
  const win = part.bends.map((_, k) => { const ss = g.strokes.filter((x) => x.bend === k); return ss.length ? [T.fold0 + ss[0].t0, T.fold0 + ss[ss.length - 1].t1] : null; });
  const tags = labels ? part.bends.map(() => { const s = document.createElement('span'); s.className = 'angle'; s.hidden = true; labels.appendChild(s); return s; }) : [];

  function draw(ms) {
    const Wd = canvas.clientWidth, Hd = canvas.clientHeight; if (!Wd || !Hd) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(Wd * dpr) || canvas.height !== Math.round(Hd * dpr)) { canvas.width = Math.round(Wd * dpr); canvas.height = Math.round(Hd * dpr); off.width = canvas.width; off.height = canvas.height; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, Wd, Hd);
    const f = fracAt(ms), polys = mesh(part, fold(part, (k) => f[k]));
    const [x0, y0, x1, y1] = frameBox(Math.min(ms, T.fold1));
    const s = Math.min(Wd * (1 - 2 * pad) / (x1 - x0), Hd * (1 - 2 * pad) / (y1 - y0));
    const cx = Wd / 2 - ((x0 + x1) / 2) * s, cy = Hd / 2 - ((y0 + y1) / 2) * s;
    const P = projector(s, cx, cy);
    const appear = outC(seg(ms, 0, T.flat * 0.8));
    ctx.globalAlpha = appear;
    // ombres : une large et douce, une de contact plus nette
    octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, Wd, Hd); octx.fillStyle = '#000';
    for (const sp of shadowPolys(polys)) { octx.beginPath(); sp.map(P).forEach((q, i) => (i ? octx.lineTo(q[0], q[1]) : octx.moveTo(q[0], q[1]))); octx.closePath(); octx.fill(); }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if ('filter' in ctx) { ctx.filter = `blur(${Math.round(14 * dpr)}px)`; ctx.globalAlpha = 0.16 * appear; ctx.drawImage(off, 0, Math.round(4 * dpr)); ctx.filter = `blur(${Math.round(3 * dpr)}px)`; ctx.globalAlpha = 0.14 * appear; ctx.drawImage(off, 0, 0); ctx.filter = 'none'; }
    else { ctx.globalAlpha = 0.12 * appear; ctx.drawImage(off, 0, 0); }
    ctx.restore(); ctx.globalAlpha = appear;
    // la pièce : acier brut puis peinture en rideau
    const p = seg(ms, wipe.t0, wipe.t1);
    const rA = render(polys, cam, { size: s, cx, cy, color: from, ink, amb, lift });
    const rB = p > 0 ? render(polys, cam, { size: s, cx, cy, color: to, ink, amb, lift }) : null;
    const bx0 = x0 * s + cx, bw = (x1 - x0) * s;
    for (let i = 0; i < rA.length; i++) {
      const pl = rA[i];
      let fill = pl.fill, k = 0;
      if (rB) { const xm = pl.pr.reduce((a, q) => a + q[0], 0) / pl.pr.length, xn = (xm - bx0) / bw; k = presse(clamp((p * 1.35 - xn) / 0.35)); if (k > 0) { const A = parse(pl.fill), B = parse(rB[i].fill); fill = `rgb(${A.map((v, j) => Math.round(v + (B[j] - v) * k)).join(',')})`; } }
      const base = k > 0.5 ? to : from, line = `rgb(${ink.map((v, j) => Math.round(v + (base[j] - v) * 0.45)).join(',')})`;
      ctx.beginPath(); pl.pr.forEach((q, j) => (j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
      if (pl.holes) for (const H of pl.holes) { H.forEach((q, j) => (j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); }
      ctx.fillStyle = fill; ctx.fill('evenodd'); ctx.lineJoin = 'round'; ctx.lineWidth = 0.6; ctx.strokeStyle = line; ctx.stroke();
    }
    // lignes de pli sur le développé, avant le pliage
    const flatK = 1 - seg(ms, T.fold0 - 150, T.fold0 + 250);
    if (flatK > 0) {
      ctx.save(); ctx.globalAlpha = flatK * appear; ctx.setLineDash([7, 5]); ctx.lineWidth = 1.4; ctx.strokeStyle = `rgb(${ink.join(',')})`;
      for (const b of part.bends) { const a = P([b.a[0], b.a[1], part.t / 2]), c = P([b.b[0], b.b[1], part.t / 2]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // angles en direct, posés sur chaque pli, poussés hors de la pièce
    if (tags.length) {
      const fo = fold(part, (k) => f[k]), ccx = (x0 + x1) / 2 * s + cx, ccy = (y0 + y1) / 2 * s + cy, fade = 1 - seg(ms, T.paint0 - 100, T.paint0 + 400);
      for (const hg of fo.hinges) {
        const k = part.links.findIndex((l) => l.bend.a === hg.a && l.bend.b === hg.b), tag = tags[k];
        if (!tag) continue;
        const ang = Math.abs(part.bends[k].angle) * f[k];
        const w = win[k], vis = w ? Math.min(seg(ms, w[0] - 60, w[0] + 120), 1 - seg(ms, w[1] + 500, w[1] + 800)) * fade : 0;
        if (f[k] <= 0.001 || vis <= 0) { tag.hidden = true; continue; }
        const m = apply(hg.Mp, [(hg.a[0] + hg.b[0]) / 2, (hg.a[1] + hg.b[1]) / 2, hg.sg * part.t / 2]), q = P(m);
        let dx = q[0] - ccx, dy = q[1] - ccy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        tag.hidden = false; tag.textContent = `${Math.round(ang)}°`;
        tag.style.transform = `translate(${(q[0] + dx * 34).toFixed(1)}px, ${(q[1] + dy * 34).toFixed(1)}px) translate(-50%, -50%)`;
        tag.style.opacity = vis.toFixed(3);
      }
    }
    onFrame && onFrame({ ms, f, painted: p, phase: ms < T.fold0 ? 'flat' : ms < T.fold1 ? 'fold' : ms < T.paint1 ? 'paint' : 'done' });
    return true;
  }
  function loop(now) {
    if (dead) return;
    if (!start) start = now - t;
    t = Math.min(wipe.t1, now - start);
    if (!draw(t)) { raf = requestAnimationFrame(loop); return; }
    if (t < wipe.t1) raf = requestAnimationFrame(loop); else playing = false;
  }
  const run = () => { cancelAnimationFrame(raf); playing = true; start = 0; raf = requestAnimationFrame(loop); };
  const api = {
    T, strokes: g.strokes,
    play() { from = steelC; wipe = { t0: T.paint0, t1: T.paint1 }; if (rm) { t = T.end; api.redraw(); return; } t = 0; run(); },
    seek(ms) { cancelAnimationFrame(raf); playing = false; t = clamp(ms, 0, T.end); api.redraw(); },
    // nouvelle teinte : un rideau de peinture repasse sur la pièce pliée
    setColor(c) {
      const next = hex(c);
      if (rm || playing && t < T.paint0) { to = next; if (!playing) api.redraw(); return; }
      if (playing) { to = next; return; }
      from = to; to = next; wipe = { t0: T.end, t1: T.end + 750 }; t = T.end; run();
    },
    redraw() { if (!dead && !draw(t)) requestAnimationFrame(() => api.redraw()); },
    get playing() { return playing; },
    destroy() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); },
  };
  const ro = new ResizeObserver(() => { if (!playing) api.redraw(); }); ro.observe(canvas);
  if (autoplay && !rm) api.play(); else { t = T.end; api.redraw(); }
  return api;
}
