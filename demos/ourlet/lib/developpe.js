// Ourlet · le développé qui se plie (premier écran v5, directions D1 « Le bon de travail » et D2 « Le développé »).
// La pièce commence comme un plan : vue de dessus, le développé coté (contour, trous, lignes de pli en trait mixte, deux cotes
// hors tout), tracé en vecteur sur la tôle gravée. La caméra bascule de la vue de dessus vers les trois quarts, les cotes
// s'effacent, puis la tôle se plie dans l'ordre de la gamme, au rythme de la presse ; enfin la teinte du client passe en rideau.
// Le dessin reste sur le papier, sous la pièce : on voit d'où elle vient.
// Option laser (D2) : avant la bascule, la tête du laser suit le dessin, les trous d'abord, le contour en dernier, à la vitesse
// de coupe ; le trait coupé passe du trait fin au trait fort.
// Rendu : moteur 3D (part.js) → canvas des tons → gravure WebGL2 (gravure.js) ; le dessin vectoriel en SVG par-dessus.
// Déterministe : seek(t). Mouvements réduits : la pièce pliée et peinte, le dessin dessous, rien ne bouge.
import { fold, mesh, render, camera, apply } from './part.js';
import { gamme } from './stage.js';
import { createGravure, tonPack } from './gravure.js';
import { MOTION, EASE, ticker, prefersReduced } from './motion.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => (b > a ? clamp((t - a) / (b - a)) : t >= b ? 1 : 0);
const lerp = (a, b, k) => a + (b - a) * k;
const NS = 'http://www.w3.org/2000/svg';
const fmtMM = (v) => Math.round(v).toLocaleString('fr-FR').replace(/[  ]/g, ' ');

export function mountDeveloppe(host, part, {
  order = part.gamme || part.bends.map((_, k) => k), az = (part.vue && part.vue.az) || [-90, -128], el = (part.vue && part.vue.el) || [88, 31],
  dist = (part.vue && part.vue.dist) || 2.6, fov = (part.vue && part.vue.fov) || 24,
  teinte = null, couleurs, pas = 3, ep = [0.06, 0.94], laser = false, cotes = true, pad = 0.1, aplat = 0.85, gammaTon = 1,
  onFrame = null, autoplay = true, reduced = null, amb = 0.22, light = [-0.85, -0.3, 0.5], encre = true,
  ombre = 0, arete = 1.25, couleurArete = '#191615', fantome = (part.vue && part.vue.fantome !== undefined) ? part.vue.fantome : 0.22, oriente = false, coteAngle = true,
} = {}) {
  const rm = reduced ?? prefersReduced();
  const PR = MOTION.presse;
  host.classList.add('dvp');
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true');
  const ink = document.createElement('canvas'); ink.setAttribute('aria-hidden', 'true'); ink.className = 'dvp-aretes';
  host.append(canvas, ink, svg);
  // mode groupé : ton, peinture et angle des hachures dans un seul canvas (un remplissage et un envoi par image)
  const grav = createGravure(canvas, { pas, ep, epFond: 0, teinte, aplat, oriente, packed: true, ...couleurs });

  // ---------- géométrie ----------
  const xs = part.outline.map((p) => p[0]), ys = part.outline.map((p) => p[1]);
  const X0 = Math.min(...xs), X1 = Math.max(...xs), Y0 = Math.min(...ys), Y1 = Math.max(...ys);
  const ctr = [(X0 + X1) / 2, (Y0 + Y1) / 2];
  const ones = part.bends.map(() => 1), zeros = part.bends.map(() => 0);
  // centre et taille de la pièce pliée (la caméra la regarde) ; la distance suit la diagonale du développé
  const pts1 = mesh(part, fold(part, 1)).flatMap((p) => p.pts);
  const zMax = Math.max(...pts1.map((p) => p[2]));
  const D = Math.hypot(X1 - X0, Y1 - Y0) * dist;
  const camAt = (k) => {
    const a = (lerp(az[0], az[1], k) * Math.PI) / 180, e = (lerp(el[0], el[1], k) * Math.PI) / 180;
    const tgt = [ctr[0], ctr[1], zMax * 0.35 * k];
    return camera({ eye: [tgt[0] + D * Math.cos(e) * Math.cos(a), tgt[1] + D * Math.cos(e) * Math.sin(a), tgt[2] + D * Math.sin(e)], target: tgt, fov });
  };

  // ---------- chronologie (durées tirées de la grammaire : laser, presse, rideau, convoyeur) ----------
  const g = gamme(part, order, { stroke: PR.appui.ms, pause: PR.maintien.ms, hemPre: 30, ease: EASE.appui });
  const loops = [...(part.holes || []).map((h) => h), part.outline]; // les trous d'abord, le contour en dernier
  const perim = (pl) => pl.reduce((s, p, i) => s + Math.hypot(pl[(i + 1) % pl.length][0] - p[0], pl[(i + 1) % pl.length][1] - p[1]), 0);
  const T = {};
  function timeline(sPlan) {
    // le laser avance à la vitesse de coupe à l'écran (px/s) ; les déplacements à vide entre deux contours, plus vifs
    let t = PR.maintien.ms;
    T.cut = [];
    if (laser) {
      let prev = null;
      for (const pl of loops) {
        const L = perim(pl) * sPlan;
        if (prev) { const d = Math.hypot(pl[0][0] - prev[0], pl[0][1] - prev[1]) * sPlan; t += Math.max(MOTION.laser.percage.ms, (d / MOTION.laser.vide.v) * 1000); }
        t += MOTION.laser.percage.ms;
        T.cut.push([t, t + (L / MOTION.laser.coupe.v) * 1000]); t = T.cut[T.cut.length - 1][1]; prev = pl[0];
      }
      t += PR.maintien.ms;
    }
    T.tilt = [t, t + MOTION.camera.ms]; t = T.tilt[1];
    T.fold = [t, t + g.duration]; t = T.fold[1] + PR.maintien.ms * 2;
    T.paint = [t, t + (teinte ? MOTION.rideau.ms : 0)];
    T.end = T.paint[1];
  }
  timeline(0.4);

  // ---------- cadrage : boîte projetée sur toute la chronologie, enveloppe glissante puis moyenne (pas de respiration) ----------
  const stateAt = (ms) => ({ k: EASE.camera(seg(ms, T.tilt[0], T.tilt[1])), f: g.state(Math.max(0, ms - T.fold[0])) });
  function boxOf(ms) {
    const { k, f } = stateAt(ms), cam = camAt(k);
    const r = render(mesh(part, fold(part, (i) => f[i])), cam, { size: 1, paths: false });
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of r) for (const q of p.pr) b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])];
    // le dessin au sol compte aussi (il reste sous la pièce)
    const flat = render([{ kind: 'face', pts: part.outline.map((p) => [p[0], p[1], 0]) }], cam, { size: 1, paths: false })[0];
    for (const q of flat.pr) b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])];
    return b;
  }
  let frames = null;
  function frameBoxes() {
    const STEP = 60, raw = [];
    for (let ms = 0; ms <= T.end + STEP; ms += STEP) raw.push(boxOf(ms));
    const Wn = 8;
    const env = raw.map((_, i) => { const r = [Infinity, Infinity, -Infinity, -Infinity]; for (let j = Math.max(0, i - Wn); j <= Math.min(raw.length - 1, i + Wn); j++) { const b = raw[j]; r[0] = Math.min(r[0], b[0]); r[1] = Math.min(r[1], b[1]); r[2] = Math.max(r[2], b[2]); r[3] = Math.max(r[3], b[3]); } return r; });
    frames = env.map((_, i) => { const r = [0, 0, 0, 0]; let n = 0; for (let j = Math.max(0, i - Wn); j <= Math.min(env.length - 1, i + Wn); j++) { for (let q = 0; q < 4; q++) r[q] += env[j][q]; n++; } return r.map((v) => v / n); });
    frames.step = STEP;
  }
  frameBoxes();
  const boxAt = (ms) => { const x = clamp(ms / frames.step, 0, frames.length - 1), a = Math.floor(x), b = Math.min(frames.length - 1, a + 1), k = x - a; return frames[a].map((v, j) => v + (frames[b][j] - v) * k); };

  // ---------- le dessin vectoriel ----------
  // tracés : contours (trait fort), lignes de pli (trait mixte fin), cotes (trait fin, pointes, chiffres à 15 px)
  svg.innerHTML = '';
  const gDraw = document.createElementNS(NS, 'g'); svg.append(gDraw);
  const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); gDraw.append(e); return e; };
  // liseré couleur papier sous les traits fins : sur la trame, un trait mixte se confond sinon avec une ligne de la hachure
  const haloEls = part.bends.map(() => mk('path', { class: 'dvp-liseré', fill: 'none' }));
  const cutEls = loops.map(() => mk('path', { class: 'dvp-coupe', fill: 'none' }));
  const doneEls = loops.map(() => mk('path', { class: 'dvp-coupe-faite', fill: 'none' }));
  const bendEls = part.bends.map(() => mk('path', { class: 'dvp-pli', fill: 'none' }));
  // la tête du laser : un anneau et sa croix de visée, comme sur l'écran de la machine
  const head = mk('path', { class: 'dvp-tete', fill: 'none' });
  // cote d'angle du pli en cours : un arc entre la base et la paroi qui se lève, et la valeur lue par l'opérateur
  // (dans son propre groupe : elle ne s'efface pas avec le dessin au sol)
  const gTop = document.createElementNS(NS, 'g'); svg.append(gTop);
  const mkTop = (tag, attrs) => { const e = mk(tag, attrs); gTop.append(e); return e; };
  const angEl = coteAngle ? { arc: mkTop('path', { class: 'dvp-cote', fill: 'none' }), plaque: mkTop('rect', { class: 'dvp-plaque', rx: 4 }), txt: mkTop('text', { class: 'dvp-chiffre', 'text-anchor': 'middle' }) } : null;
  const coteEls = cotes ? [0, 1].map(() => ({ line: mk('path', { class: 'dvp-cote', fill: 'none' }), arrows: mk('path', { class: 'dvp-pointe' }), txt: mk('text', { class: 'dvp-chiffre', 'text-anchor': 'middle' }) })) : [];
  if (cotes) { coteEls[0].txt.textContent = fmtMM(X1 - X0); coteEls[1].txt.textContent = fmtMM(Y1 - Y0); }

  // ---------- dessin d'une image ----------
  let view = null; // { s, cx, cy } projection → px CSS
  const proj = (cam, p) => { const v = [p[0] - cam.eye[0], p[1] - cam.eye[1], p[2] - cam.eye[2]]; const x = v[0] * cam.r[0] + v[1] * cam.r[1] + v[2] * cam.r[2], y = v[0] * cam.u[0] + v[1] * cam.u[1] + v[2] * cam.u[2], z = v[0] * cam.f[0] + v[1] * cam.f[1] + v[2] * cam.f[2]; return [view.cx + (x * cam.k / z) * view.s, view.cy - (y * cam.k / z) * view.s]; };
  const pathOf = (cam, pl, close = true, upto = Infinity) => {
    let d = '', acc = 0;
    for (let i = 0; i < pl.length + (close ? 1 : 0); i++) {
      const p = pl[i % pl.length];
      if (i > 0) { const q = pl[(i - 1) % pl.length], L = Math.hypot(p[0] - q[0], p[1] - q[1]); if (acc + L > upto) { const k = (upto - acc) / L; const m = [q[0] + (p[0] - q[0]) * k, q[1] + (p[1] - q[1]) * k]; const s = proj(cam, [m[0], m[1], 0]); d += `L${s[0].toFixed(1)},${s[1].toFixed(1)}`; return { d, end: m }; } acc += L; }
      const s = proj(cam, [p[0], p[1], 0]); d += `${i ? 'L' : 'M'}${s[0].toFixed(1)},${s[1].toFixed(1)}`;
    }
    return { d: d + (close ? 'Z' : ''), end: null };
  };
  const projS = (cam, p) => proj(cam, p);
  // pour chaque face : le sens de son pli (le côté intérieur) et sa part de pliage, pour l'occlusion
  const faceFold = {};
  for (const ln of part.links) {
    const other = ln.faces[0] === part.baseId ? ln.faces[1] : ln.faces[1] === part.baseId ? ln.faces[0] : null;
    const sign = Math.sign(ln.bend.angle) || 1, kk = ln.k;
    if (other !== null && other !== undefined) faceFold[other] = { sign, amount: (ff) => ff[kk] };
  }
  { const sg = Math.sign(part.bends.reduce((a, b) => a + Math.sign(b.angle), 0)) || 1; faceFold[part.baseId] = { sign: sg, amount: (ff) => Math.max(0, ...ff) }; }
  let t = rm ? T.end : 0, playing = false, dead = false;
  function draw(ms) {
    const W = host.clientWidth, H = host.clientHeight; if (!W || !H) return false;
    if (svg.dataset.wh !== `${W}x${H}`) { svg.dataset.wh = `${W}x${H}`; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H); }
    const { k, f } = stateAt(ms), cam = camAt(k), b = boxAt(ms);
    const mc = cotes ? 46 * (1 - EASE.camera(seg(ms, T.tilt[0], T.tilt[1]))) : 0; // la place des cotes, rendue quand elles s'effacent
    const s = Math.min((W * (1 - 2 * pad) - mc) / (b[2] - b[0]), (H * (1 - 2 * pad) - mc) / (b[3] - b[1]));
    view = { s, cx: (W - mc) / 2 - ((b[0] + b[2]) / 2) * s, cy: (H - mc) / 2 - ((b[1] + b[3]) / 2) * s };
    // la pièce : tons en niveaux de gris (ombrage de part.js), encre ∝ ombre ; la teinte passe derrière le rideau
    const fo = fold(part, (i) => f[i]);
    const meshNow = mesh(part, fo);
    const polys = render(meshNow, cam, { size: s, cx: view.cx, cy: view.cy, color: [255, 255, 255], ink: [0, 0, 0], amb, light, paths: false });
    const front = teinte ? EASE.rideau(seg(ms, T.paint[0], T.paint[1])) * (W + 40) - 20 : -1;
    // l'intérieur d'un pli reçoit moins de lumière : la face intérieure d'une paroi relevée, et le fond entre les parois,
    // foncent avec le pliage (une occlusion simple, par face) ; le volume se lit ouvert, pas comme un bloc plein
    const occl = (p) => {
      if (p.kind !== 'face' || p.face === undefined) return 1;
      const fi = faceFold[p.face]; if (!fi) return 1;
      const inner = p.side === (fi.sign > 0 ? 'top' : 'bottom');
      return inner ? 1 - 0.42 * fi.amount(f) : 1;
    };
    const tonOf = (p) => { const sh = (parseInt(p.fill.slice(4), 10) / 255) * occl(p); return Math.pow(encre ? 1 - sh : sh, gammaTon); };
    const trace = (ctx, p) => { ctx.beginPath(); p.pr.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
      if (p.holes) for (const Hh of p.holes) { Hh.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); } };
    // l'ombre portée sur le papier, projetée selon la lumière : elle pose la pièce sur son dessin
    const Ln = (() => { const n = Math.hypot(...light); return light.map((v) => v / n); })();
    const shadow = [];
    if (ombre > 0 && k > 0.02) for (const pl of meshNow) { if (pl.kind !== 'face' || pl.side !== 'top') continue; shadow.push(pl.pts.map((p3) => projS(cam, [p3[0] - (Ln[0] * p3[2]) / Ln[2], p3[1] - (Ln[1] * p3[2]) / Ln[2], 0]))); }
    // trame orientée : les hachures de chaque face suivent l'axe x de son développé, tel qu'il se projette à l'écran
    const angOf = {};
    if (oriente) for (const fc of part.faces) {
      const M = fo.M.get(fc.id); if (!M) continue;
      const c = fc.loop.reduce((a, q) => [a[0] + q[0] / fc.loop.length, a[1] + q[1] / fc.loop.length], [0, 0]);
      const p0 = proj(cam, apply(M, [c[0], c[1], 0]));
      // un pas long (400 mm) : l'angle reste juste à toutes les échelles ; si l'axe x fuit vers l'œil, l'axe y prend le relais
      let p1 = proj(cam, apply(M, [c[0] + 400, c[1], 0]));
      if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 2) p1 = proj(cam, apply(M, [c[0], c[1] + 400, 0]));
      angOf[fc.id] = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    }
    grav.frame((ctx, g2, sctx) => {
      if (shadow.length) { ctx.fillStyle = tonPack(ombre * Math.min(1, k * 1.5)); for (const sp of shadow) { ctx.beginPath(); sp.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fill(); } }
      const fill = (peint) => { for (const p of polys) { trace(ctx, p); ctx.fillStyle = tonPack(tonOf(p), peint, angOf[p.face] || 0); ctx.fill('evenodd'); } };
      fill(0);
      if (front > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, front, H); ctx.clip(); fill(1); ctx.restore(); }
    });
    // les arêtes : un trait d'encre net, en vecteur, par-dessus la trame ; seules les arêtes vues restent (chaque face efface,
    // dans l'ordre du peintre, les traits qu'elle cache)
    {
      const dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (ink.width !== cw || ink.height !== ch) { ink.width = cw; ink.height = ch; }
      const ic = ink.getContext('2d'); ic.setTransform(dpr, 0, 0, dpr, 0, 0); ic.clearRect(0, 0, W, H);
      ic.lineJoin = 'round'; ic.lineWidth = arete; ic.strokeStyle = couleurArete;
      for (const p of polys) {
        trace(ic, p); ic.globalCompositeOperation = 'destination-out'; ic.fill('evenodd'); ic.globalCompositeOperation = 'source-over';
        if (p.kind === 'face') ic.stroke();
      }
    }
    // le dessin : contours coupés (ou à couper), plis, cotes ; il s'efface à moitié quand la caméra bascule
    const flatK = 1 - k;
    gDraw.style.opacity = String(fantome + (1 - fantome) * flatK);
    let headAt = null;
    loops.forEach((pl, i) => {
      const full = pathOf(cam, pl).d;
      if (!laser) { cutEls[i].setAttribute('d', ''); doneEls[i].setAttribute('d', full); return; }
      const [a0, a1] = T.cut[i], L = perim(pl), p = seg(ms, a0, a1);
      cutEls[i].setAttribute('d', p < 1 ? full : '');
      const part2 = p > 0 ? pathOf(cam, pl, true, p * L) : { d: '' };
      doneEls[i].setAttribute('d', p >= 1 ? full : part2.d);
      if (p > 0 && p < 1 && part2.end) headAt = proj(cam, [part2.end[0], part2.end[1], 0]);
    });
    head.setAttribute('visibility', headAt ? 'visible' : 'hidden');
    if (headAt) { const [hx, hy] = headAt.map((v) => Math.round(v) + 0.5); head.setAttribute('d', `M${hx - 11},${hy}h7M${hx + 4},${hy}h7M${hx},${hy - 11}v7M${hx},${hy + 4}v7M${hx + 6},${hy}a6,6 0 1 1 -12,0a6,6 0 1 1 12,0`); }
    part.bends.forEach((bd, i) => { const d = `M${proj(cam, [bd.a[0], bd.a[1], 0]).map((v) => v.toFixed(1)).join(',')}L${proj(cam, [bd.b[0], bd.b[1], 0]).map((v) => v.toFixed(1)).join(',')}`; bendEls[i].setAttribute('d', d); haloEls[i].setAttribute('d', d); });
    if (cotes) {
      // cotes hors tout, posées sur le papier à 22 px du contour (dessous et à droite), lisibles en vue de dessus seulement
      const off = 22 / s / (cam.k / D) * 1, ar = 8;
      const a = proj(cam, [X0, Y0 - off, 0]), bb = proj(cam, [X1, Y0 - off, 0]), c = proj(cam, [X1 + off, Y0, 0]), d = proj(cam, [X1 + off, Y1, 0]);
      const op = String(clamp(1 - k * 2.2));
      const cote = (E, p, q, txtAt, rot) => {
        const ang = Math.atan2(q[1] - p[1], q[0] - p[0]), ux = Math.cos(ang), uy = Math.sin(ang);
        E.line.setAttribute('d', `M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}`);
        const tip = (P, sgn) => `M${P[0].toFixed(1)},${P[1].toFixed(1)}l${(sgn * ux * ar - uy * 3).toFixed(1)},${(sgn * uy * ar + ux * 3).toFixed(1)}l${(uy * 6).toFixed(1)},${(-ux * 6).toFixed(1)}Z`;
        E.arrows.setAttribute('d', tip(p, 1) + tip(q, -1));
        E.txt.setAttribute('x', txtAt[0].toFixed(1)); E.txt.setAttribute('y', txtAt[1].toFixed(1));
        E.txt.setAttribute('transform', rot ? `rotate(-90 ${txtAt[0].toFixed(1)} ${txtAt[1].toFixed(1)})` : '');
        for (const el2 of [E.line, E.arrows, E.txt]) el2.style.opacity = op;
      };
      cote(coteEls[0], a, bb, [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2 + 20], false);
      cote(coteEls[1], c, d, [(c[0] + d[0]) / 2 + 20, (c[1] + d[1]) / 2], true);
    }
    if (angEl) {
      // le coup en cours (ou celui qui vient de finir, pendant le maintien)
      const tau = ms - T.fold[0];
      const st = g.strokes.find((x) => tau >= x.t0 && tau < x.t1 + MOTION.presse.maintien.ms);
      const hg = st && fo.hinges.find((h) => { const bd = part.bends[st.bend]; return h.a === bd.a && h.b === bd.b; });
      if (st && hg && Math.abs(part.bends[st.bend].angle) < 170) {
        const bd = part.bends[st.bend], m2 = [(bd.a[0] + bd.b[0]) / 2, (bd.a[1] + bd.b[1]) / 2];
        const dx = bd.b[0] - bd.a[0], dy = bd.b[1] - bd.a[1], L2 = Math.hypot(dx, dy), n = [-dy / L2, dx / L2];
        const pc = part.faces[hg.parent].loop.reduce((a, q) => [a[0] + q[0], a[1] + q[1]], [0, 0]).map((v) => v / part.faces[hg.parent].loop.length);
        const sgn = (pc[0] - m2[0]) * n[0] + (pc[1] - m2[1]) * n[1] > 0 ? 1 : -1, R = 70;
        const Mp = fo.M.get(hg.parent), Mc = fo.M.get(hg.child), z = Math.sign(bd.angle) * part.t / 2;
        const O = apply(Mp, [m2[0], m2[1], z]), A = apply(Mp, [m2[0] + sgn * n[0] * R, m2[1] + sgn * n[1] * R, z]), B = apply(Mc, [m2[0] - sgn * n[0] * R, m2[1] - sgn * n[1] * R, z]);
        const va = [A[0] - O[0], A[1] - O[1], A[2] - O[2]], vb = [B[0] - O[0], B[1] - O[1], B[2] - O[2]];
        const dot = (va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]) / (R * R), om = Math.acos(Math.max(-1, Math.min(1, dot)));
        const pts = [];
        for (let i = 0; i <= 16; i++) { const tt = i / 16, s0 = Math.sin((1 - tt) * om) / Math.sin(om || 1e-6), s1 = Math.sin(tt * om) / Math.sin(om || 1e-6); pts.push(proj(cam, [O[0] + va[0] * s0 + vb[0] * s1, O[1] + va[1] * s0 + vb[1] * s1, O[2] + va[2] * s0 + vb[2] * s1])); }
        angEl.arc.setAttribute('d', 'M' + pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join('L'));
        const mid = pts[8], val = Math.round((om * 180) / Math.PI);
        const txt = `${val}\u00b0`; angEl.txt.textContent = txt;
        const tw = 15 * 0.62 * txt.length + 12;
        angEl.plaque.setAttribute('x', (mid[0] - tw / 2).toFixed(1)); angEl.plaque.setAttribute('y', (mid[1] - 13).toFixed(1)); angEl.plaque.setAttribute('width', tw.toFixed(1)); angEl.plaque.setAttribute('height', 24);
        angEl.txt.setAttribute('x', mid[0].toFixed(1)); angEl.txt.setAttribute('y', (mid[1] + 5).toFixed(1));
        for (const e2 of [angEl.arc, angEl.plaque, angEl.txt]) e2.style.visibility = 'visible';
      } else for (const e2 of [angEl.arc, angEl.plaque, angEl.txt]) e2.style.visibility = 'hidden';
    }
    onFrame && onFrame({ ms, k, f, T, phase: ms < T.tilt[0] ? (laser ? 'coupe' : 'plan') : ms < T.fold[0] ? 'bascule' : ms < T.fold[1] ? 'pli' : ms < T.paint[0] ? 'plie' : ms < T.paint[1] ? 'peinture' : 'fin' });
    return true;
  }

  const tk = ticker((dt) => { if (dead) return false; t = Math.min(T.end, t + dt); if (!draw(t)) return true; if (t >= T.end) { playing = false; return false; } return true; }, { el: host, margin: '0px' });
  const api = {
    T, grav,
    play() { if (rm) { t = T.end; api.redraw(); return; } t = 0; playing = true; tk.start(); },
    stop() { tk.stop(); playing = false; t = T.end; api.redraw(); },
    seek(ms) { tk.stop(); playing = false; t = clamp(ms, 0, T.end); api.redraw(); },
    setTeinte(hex) { grav.setTeinte(hex); api.redraw(); },
    redraw() { if (!dead && !draw(t)) requestAnimationFrame(() => api.redraw()); },
    get playing() { return playing; }, get t() { return t; },
    destroy() { dead = true; tk.destroy(); ro.disconnect(); grav.destroy(); },
  };
  const ro = new ResizeObserver(() => { if (!playing) api.redraw(); });
  ro.observe(host);
  if (autoplay && !rm) api.play(); else api.redraw();
  return api;
}
