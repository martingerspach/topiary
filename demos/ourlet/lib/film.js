// Ourlet · film « De la tôle à la pièce » (motion design, calculé en direct, sans vidéo) : la découpe laser, le pliage, la peinture.
// Choréographie de métier :
// - découpe : comme sur une machine réelle, les contours intérieurs (trous, fenêtres, ouïes) d'abord, le contour extérieur en dernier,
//   pour que la pièce ne bouge pas dans la tôle ; la tête avance à vitesse constante, un point de tir à chaque amorçage ;
// - dégrappage : le squelette de tôle se lève et s'efface, la pièce reste à plat ;
// - pliage : la caméra passe de la vue de dessus au trois-quarts pendant que les plis se font un par un, dans l'ordre de la gamme ;
// - peinture : la pièce passe de l'acier brut à la teinte RAL, le fond prend la teinte en aplat.
// Tout dépend du seul temps t : seek(t) redonne exactement la même image (captures, films, animatique pour la vidéo IA).
import { fold, mesh, render, camera, hex } from './part.js';
import { gamme } from './stage.js';

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const lerpCol = (a, b, k) => a.map((v, i) => Math.round(lerp(v, b[i], k)));
const plen = (pts, closed = true) => { let L = 0; for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; L += Math.hypot(q[0] - p[0], q[1] - p[1]); } return L; };

export const T = { cut0: 300, cut1: 3300, lift0: 3400, lift1: 4100, fold0: 4200, fold1: 7600, cam1: 6200, paint0: 7700, paint1: 8500, end: 10000 };

export function mountFilm(canvas, part, { tint = '#7FB0AE', steel = '#A9B0B4', bg = '#F6F7F2', ink = [29, 33, 35], order = null, onFrame = null } = {}) {
  const ctx = canvas.getContext('2d');
  const t2 = part.t / 2 + 0.05;
  // Contours à découper, dans l'ordre d'atelier : intérieurs d'abord (par position), extérieur ensuite
  const holes = (part.holes || []).slice().sort((a, b) => (a[0][1] - b[0][1]) || (a[0][0] - b[0][0]));
  const paths = [...holes, part.outline].map((p) => ({ pts: p, L: plen(p) }));
  const Ltot = paths.reduce((s, p) => s + p.L, 0);
  // Tôle autour de la pièce
  const xs = part.outline.map((p) => p[0]), ys = part.outline.map((p) => p[1]);
  const m = 34, sheet = [[Math.min(...xs) - m, Math.min(...ys) - m], [Math.max(...xs) + m, Math.min(...ys) - m], [Math.max(...xs) + m, Math.max(...ys) + m], [Math.min(...xs) - m, Math.max(...ys) + m]];
  const cxp = (Math.min(...xs) + Math.max(...xs)) / 2, cyp = (Math.min(...ys) + Math.max(...ys)) / 2;
  // Caméras : vue de dessus (légère inclinaison pour lire l'épaisseur) puis trois-quarts
  const D = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const camA = { eye: [cxp - D * 0.06, cyp - D * 0.42, D * 1.9], target: [cxp, cyp + D * 0.02, 0] };
  const camB = { eye: [cxp - D * 0.95, cyp - D * 1.35, D * 1.15], target: [cxp, cyp, D * 0.08] };
  const ord = order || part.bends.map((b, k) => k).sort((a, b) => Math.abs(part.bends[b].angle) - Math.abs(part.bends[a].angle));
  const g = gamme(part, ord, { stroke: 520, pause: 260 });
  const kFold = (T.fold1 - T.fold0) / g.duration;
  const steelC = hex(steel), tintC = hex(tint), bgC = hex(bg);

  function camAt(t) { const k = ease(seg(t, T.fold0 - 200, T.cam1)); return camera({ eye: lerp3(camA.eye, camB.eye, k), target: lerp3(camA.target, camB.target, k), fov: 28 }); }
  function foldAt(t) { return g.state(clamp((t - T.fold0) / kFold, 0, g.duration)); }

  function draw(t) {
    const W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const kp = ease(seg(t, T.paint0, T.paint1));
    const bgNow = lerpCol(bgC, tintC, kp);
    ctx.fillStyle = `rgb(${bgNow})`; ctx.fillRect(0, 0, W, H);
    const cam = camAt(t), f = foldAt(t);
    // Cadrage : interpolé entre la tôle vue de dessus et la pièce pliée en trois-quarts
    const fitOf = (c, fr, withSheet) => { const pol = mesh(part, fold(part, (k) => fr[k])); if (withSheet) pol.push({ pts: sheet.map((p) => [p[0], p[1], 0]) }); const r = render(pol, c, { size: 1 }); let a = [Infinity, Infinity, -Infinity, -Infinity]; for (const p of r) for (const q of p.pr) { a = [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[2], q[0]), Math.max(a[3], q[1])]; } return a; };
    if (!draw.fA) { draw.fA = fitOf(camera({ ...camA, fov: 28 }), new Array(part.bends.length).fill(0), true); draw.fB = fitOf(camera({ ...camB, fov: 28 }), new Array(part.bends.length).fill(1), false); }
    const kc = ease(seg(t, T.fold0 - 200, T.cam1));
    const fb = draw.fA.map((v, i) => lerp(v, draw.fB[i], kc));
    const pad = 0.12, s = Math.min((W * (1 - 2 * pad)) / (fb[2] - fb[0]), (H * (1 - 2 * pad)) / (fb[3] - fb[1]));
    const ox = W / 2 - ((fb[0] + fb[2]) / 2) * s, oy = H / 2 - ((fb[1] + fb[3]) / 2) * s;
    const P = (p) => { const v = [p[0] - cam.eye[0], p[1] - cam.eye[1], p[2] - cam.eye[2]]; const x = v[0] * cam.r[0] + v[1] * cam.r[1] + v[2] * cam.r[2], y = v[0] * cam.u[0] + v[1] * cam.u[1] + v[2] * cam.u[2], z = v[0] * cam.f[0] + v[1] * cam.f[1] + v[2] * cam.f[2]; return [ox + (x * cam.k / z) * s, oy - (y * cam.k / z) * s]; };
    const poly = (pts, close = true) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); if (close) ctx.closePath(); };
    // Squelette de tôle (avant dégrappage) : la tôle percée de la pièce, qui se lève puis s'efface
    const lift = ease(seg(t, T.lift0, T.lift1));
    if (lift < 1) {
      const zl = lift * D * 0.25, a = 1 - lift;
      ctx.globalAlpha = a;
      poly(sheet.map((p) => P([p[0], p[1], zl - part.t / 2])));
      const ins = part.outline.slice().reverse(); ins.forEach((q, i) => { const pp = P([q[0], q[1], zl - part.t / 2]); i ? ctx.lineTo(pp[0], pp[1]) : ctx.moveTo(pp[0], pp[1]); }); ctx.closePath();
      ctx.fillStyle = `rgb(${lerpCol(steelC, [0, 0, 0], 0.12)})`; ctx.fill('evenodd');
      poly(sheet.map((p) => P([p[0], p[1], zl + t2]))); ins.forEach((q, i) => { const pp = P([q[0], q[1], zl + t2]); i ? ctx.lineTo(pp[0], pp[1]) : ctx.moveTo(pp[0], pp[1]); }); ctx.closePath();
      ctx.fillStyle = `rgb(${steelC})`; ctx.fill('evenodd');
      ctx.globalAlpha = 1;
    }
    // La pièce : acier brut, puis peinte
    const col = lerpCol(steelC, tintC, kp);
    const polys = mesh(part, fold(part, (k) => f[k]));
    const r = render(polys, cam, { size: s, cx: ox, cy: oy, color: col, ink, amb: 0.42, lift: 0.12 });
    const line = `rgb(${ink.map((v, i) => Math.round(v + (col[i] - v) * 0.5)).join(',')})`;
    // Trous déjà découpés : chaque chute tombe à la fin de son propre contour
    const doneLen = Ltot * clamp((t - T.cut0) / (T.cut1 - T.cut0));
    const ouverts = new Set(); { let acc = 0; for (const pth of paths) { acc += pth.L; if (acc <= doneLen + 1e-6 && pth.pts !== part.outline) ouverts.add(pth.pts); } }
    const facePath = (p) => {
      ctx.beginPath(); p.pr.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
      if (p.holes) p.holes.forEach((Hh, k) => { if (p.holeRefs && !ouverts.has(p.holeRefs[k])) return; Hh.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); });
    };
    // Tant que la pièce est dans la tôle, seule sa face du dessus se voit, de la couleur exacte de la tôle ; l'ombrage se fond ensuite en 0,5 s
    const mixIn = ease(seg(t, T.lift0, T.lift0 + 500));
    if (mixIn < 1) { // un seul polygone pour la pièce à plat : aucune couture visible entre les faces
      const flat = (pts) => pts.map((q) => P([q[0], q[1], t2]));
      ctx.beginPath(); flat(part.outline).forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
      for (const h of holes) if (ouverts.has(h)) { flat(h).forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); }
      ctx.fillStyle = `rgb(${steelC})`; ctx.fill('evenodd'); ctx.lineWidth = 1; ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
    }
    if (mixIn > 0) {
      ctx.globalAlpha = mixIn;
      for (const p of r) { facePath(p); ctx.fillStyle = p.fill; ctx.fill('evenodd'); ctx.lineJoin = 'round'; ctx.lineWidth = 0.6; ctx.strokeStyle = line; ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // Saignées de découpe et tête laser
    if (t >= T.cut0 && t < T.lift1) {
      const done = Ltot * clamp((t - T.cut0) / (T.cut1 - T.cut0));
      let acc = 0, head = null;
      ctx.lineWidth = 1.6; ctx.strokeStyle = `rgba(${ink.join(',')},${(1 - lift).toFixed(3)})`; ctx.lineJoin = 'round';
      for (const pth of paths) {
        if (acc >= done) break;
        const upto = Math.min(pth.L, done - acc); let run = 0;
        const pts = [P([pth.pts[0][0], pth.pts[0][1], t2])];
        for (let i = 0; i < pth.pts.length; i++) {
          const a = pth.pts[i], b = pth.pts[(i + 1) % pth.pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (run + l >= upto) { const k = (upto - run) / l; const q = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; pts.push(P([q[0], q[1], t2])); head = q; break; }
          run += l; pts.push(P([b[0], b[1], t2]));
        }
        poly(pts, false); ctx.stroke();
        if (upto >= pth.L - 1e-6) head = null;
        acc += pth.L;
      }
      if (head && t < T.cut1) { const hp = P([head[0], head[1], t2]); ctx.fillStyle = '#EEDB3C'; ctx.beginPath(); ctx.arc(hp[0], hp[1], 4.5, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = `rgb(${ink})`; ctx.stroke(); }
    }
    onFrame && onFrame(t, { paint: kp });
    return true;
  }
  let raf = 0, t0 = 0, cur = 0;
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop = (now) => { if (!t0) t0 = now - cur; cur = Math.min(T.end, now - t0); draw(cur); if (cur < T.end) raf = requestAnimationFrame(loop); else api.playing = false; };
  const api = {
    duration: T.end, playing: false, reduced,
    play() { cancelAnimationFrame(raf); if (cur >= T.end) cur = 0; t0 = 0; api.playing = true; raf = requestAnimationFrame(loop); },
    pause() { cancelAnimationFrame(raf); api.playing = false; },
    seek(t) { cancelAnimationFrame(raf); api.playing = false; cur = clamp(t, 0, T.end); if (!draw(cur)) requestAnimationFrame(() => draw(cur)); },
    get t() { return cur; },
  };
  new ResizeObserver(() => { if (!api.playing) draw(cur); }).observe(canvas);
  api.seek(reduced ? T.end : 0);
  return api;
}
