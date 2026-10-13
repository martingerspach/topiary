/* Auvent · la carte vivante (v2). Expose window.Auvent.ciel(hôte, options).
   Quatre couches superposées, toutes calculées pour un instant t (heures depuis mardi 6 h) :
   1. le fond (canvas 2D, redessiné seulement quand la vue change) : papier, graticule de Lambert, terres d'Europe
      (Natural Earth 1:50m, lib/fond.js), traits de côte et frontières ;
   2. les champs (WebGL, un seul triangle plein écran) : la pression et la pluie de lib/carte.js réécrites en GLSL et
      évaluées par pixel. Les isobares sont des lignes de niveau tracées par le shader (fwidth), donc parfaitement lisses
      à tout instant : plus de grille ni de marching squares qui tremblent d'une image à l'autre. La pluie est une hachure
      en quatre classes (0,2 · 1 · 2 · 4 mm/h), à l'angle de la pluie du signe ; les écarts sont des sous-multiples d'un
      même pas, si bien que les traits restent continus d'une classe à l'autre ;
   3. le vent (canvas 2D) : des particules portées par le vent géostrophique (dérivé de la pression, dévié de 20° vers
      la dépression par le frottement), avec leur traîne, comme sur les cartes de vent animées ;
   4. le trait (canvas 2D) : fronts avec leurs symboles, centres de pression, cotes des isobares ; et, en DOM,
      les stations : le modèle de station de l'OMM (cercle de pluie, barbule du vent moyen en nœuds).
   Mouvements réduits : pas de particules, pas de lecture automatique ; la carte reste entièrement lisible. */
(function () {
  const A = (window.Auvent = window.Auvent || {});
  const C = A.carte, FOND = A.fond;
  const ANGLE = 0.34; // angle de la pluie du signe, depuis la verticale (radians)
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

  // ---------- Shader des champs ----------
  const VS = 'attribute vec2 aP; void main(){ gl_Position = vec4(aP, 0.0, 1.0); }';
  const FS = `#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uO; uniform float uK, uDpr, uH;
uniform vec2 uLow; uniform vec2 uFr[15]; uniform float uFrAcc[15]; uniform float uFrTot;
uniform vec2 uCh[11]; uniform float uChAcc[11]; uniform float uChTot;
uniform vec3 uInk, uRain, uAcc; uniform float uAIso, uARain, uSeuil, uAngle;
vec3 dFroid(vec2 p){
  float best = 1e9; float side = 1.0; float along = 0.0;
  for (int i = 1; i < 15; i++) {
    vec2 a = uFr[i - 1]; vec2 e = uFr[i] - a; float L2 = dot(e, e); float L = sqrt(L2);
    float u = clamp(dot(p - a, e) / L2, 0.0, 1.0); float d = length(p - (a + u * e));
    if (d < best) { best = d; side = (e.x * (p.y - a.y) - e.y * (p.x - a.x)) >= 0.0 ? 1.0 : -1.0; along = (uFrAcc[i - 1] + u * L) / uFrTot; }
  }
  return vec3(best, -side, along);
}
vec3 dChaud(vec2 p){
  float best = 1e9; float side = 1.0; float along = 0.0;
  for (int i = 1; i < 11; i++) {
    vec2 a = uCh[i - 1]; vec2 e = uCh[i] - a; float L2 = dot(e, e); float L = sqrt(L2);
    float u = clamp(dot(p - a, e) / L2, 0.0, 1.0); float d = length(p - (a + u * e));
    if (d < best) { best = d; side = (e.x * (p.y - a.y) - e.y * (p.x - a.x)) >= 0.0 ? 1.0 : -1.0; along = (uChAcc[i - 1] + u * L) / uChTot; }
  }
  return vec3(best, -side, along);
}
void main(){
  vec2 css = vec2(gl_FragCoord.x, uH - gl_FragCoord.y) / uDpr;
  vec2 p = vec2(uO.x + css.x * uK, uO.y - css.y * uK);
  vec3 f = dFroid(p);
  vec2 dl = p - uLow;
  float pr = 1017.0 - 27.0 * exp(-dot(dl, dl) / (2.0 * 560.0 * 560.0))
           + 9.0 * exp(-((p.x - 300.0) * (p.x - 300.0) + (p.y + 950.0) * (p.y + 950.0)) / (2.0 * 700.0 * 700.0));
  pr -= 5.5 * exp(-(f.x * f.x) / (2.0 * 48.0 * 48.0)) * (1.0 - 0.55 * f.z);
  float w = f.y > 0.0 ? 46.0 : 26.0;
  float mm = 3.2 * exp(-(f.x * f.x) / (2.0 * w * w)) * (1.0 - 0.75 * f.z);
  vec3 c = dChaud(p);
  if (c.y > 0.0) mm += 0.9 * exp(-(c.x * c.x) / (2.0 * 95.0 * 95.0)) * (1.0 - 0.7 * c.z);
  mm = max(0.0, mm);
  // pluie : hachure en classes, écarts 8 / 4 / 2,7 / 2 px (sous-multiples d'un même pas)
  float k = mm < 0.2 ? 0.0 : mm < 1.0 ? 1.0 : mm < 2.0 ? 2.0 : mm < 4.0 ? 3.0 : 4.0;
  vec2 n = vec2(cos(uAngle), sin(uAngle));
  float u = dot(css, n) / 8.0 * k;
  float hd = abs(fract(u) - 0.5) * (8.0 / max(k, 1.0)) * uDpr;
  float hw = 1.25 * uDpr;
  float hatch = k > 0.0 ? 1.0 - smoothstep(hw * 0.5 - 0.6, hw * 0.5 + 0.6, hd) : 0.0;
  // isobares tous les 4 hPa ; celles des multiples de 20 un peu plus fortes
  float lv = pr / 4.0; float dlv = max(fwidth(lv), 1e-6);
  float near = floor(lv + 0.5) * 4.0;
  float major = abs(mod(near + 0.5, 20.0) - 0.5) < 0.75 ? 1.0 : 0.0;
  float iw = (0.9 + 0.55 * major) * uDpr;
  float dist = abs(fract(lv + 0.5) - 0.5) / dlv;
  float iso = 1.0 - smoothstep(iw * 0.5 - 0.6, iw * 0.5 + 0.6, dist);
  // contour du seuil de la tâche (pluie), au cobalt
  float sc = 0.0;
  if (uSeuil > 0.0) { float g = (mm - uSeuil) / max(fwidth(mm), 1e-6); float sw = 1.6 * uDpr; sc = 1.0 - smoothstep(sw * 0.5 - 0.6, sw * 0.5 + 0.6, abs(g)); }
  // composition (alpha prémultiplié)
  vec4 col = vec4(uRain * hatch * uARain, hatch * uARain);
  float ai = iso * uAIso; col = vec4(uInk * ai, ai) + col * (1.0 - ai);
  float as = sc * 0.95; col = vec4(uAcc * as, as) + col * (1.0 - as);
  gl_FragColor = col;
}`;

  function couleur(v) { // '#RRGGBB' ou 'rgb(r, g, b)' -> [r, g, b] entre 0 et 1
    v = v.trim();
    if (v[0] === '#') { const n = parseInt(v.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255); }
    const m = v.match(/[\d.]+/g) || [0, 0, 0]; return m.slice(0, 3).map((x) => +x / 255);
  }
  const rgba = (c, a) => `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${a})`;

  function ciel(host, o = {}) {
    const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const etat = { t: o.t ?? 0, ville: o.ville || null, seuil: o.seuil ?? 0, vue: (o.vue || [-1500, -700, 700, 1000]).slice(), marge: o.marge || { g: 0, d: 0, h: 0, b: 0 },
      particules: o.particules !== false && (!reduit || !!o.manuel), villes: o.villes !== false };
    host.classList.add('av-ciel');
    const mk = (cls) => { const c = document.createElement('canvas'); c.className = 'av-ciel-' + cls; c.setAttribute('aria-hidden', 'true'); host.appendChild(c); return c; };
    const cFond = mk('fond'), cGl = mk('champs'), cVent = mk('vent'), cTrait = mk('trait');
    const couche = document.createElement('div'); couche.className = 'av-ciel-stations'; host.appendChild(couche);
    const xF = cFond.getContext('2d'), xV = cVent.getContext('2d'), xT = cTrait.getContext('2d');
    let W = 0, H = 0, dpr = 1, cam = null, camAnim = null;
    let col = {};

    // ---------- Couleurs (tokens) ----------
    function lireCouleurs() {
      const cs = getComputedStyle(host), g = (n) => couleur(cs.getPropertyValue('--av-' + n) || '#000');
      col = { mer: g('map-sea'), terre: g('map-land'), cote: g('map-coast'), encre: g('map-ink'), accent: g('accent'), orage: g('storm'), texte: g('text'), sourd: g('text-muted'), fond: g('bg') };
      col.nuit = (0.2126 * col.mer[0] + 0.7152 * col.mer[1] + 0.0722 * col.mer[2]) < 0.3;
    }

    // ---------- Vue : km <-> px ----------
    function cadrer(vue) {
      const [x0, y0, x1, y1] = vue, m = etat.marge;
      const w = Math.max(50, W - m.g - m.d), h = Math.max(50, H - m.h - m.b);
      const s = Math.min(w / (x1 - x0), h / (y1 - y0));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      return { s, cx, cy, px: m.g + w / 2, py: m.h + h / 2 };
    }
    const X = (x) => cam.px + (x - cam.cx) * cam.s, Y = (y) => cam.py - (y - cam.cy) * cam.s;
    const kmX = (px) => cam.cx + (px - cam.px) / cam.s, kmY = (py) => cam.cy - (py - cam.py) / cam.s;

    // ---------- 1. Fond ----------
    function dessinerFond() {
      const x = xF; x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.fillStyle = rgba(col.mer, 1); x.fillRect(0, 0, W, H);
      // graticule : méridiens et parallèles tous les 5°, courbes de la projection de Lambert
      x.beginPath();
      for (let lon = -25; lon <= 30; lon += 5) { for (let lat = 32; lat <= 64; lat += 0.5) { const [a, b] = C.project(lat, lon); lat === 32 ? x.moveTo(X(a), Y(b)) : x.lineTo(X(a), Y(b)); } }
      for (let lat = 35; lat <= 60; lat += 5) { for (let lon = -25; lon <= 30; lon += 0.5) { const [a, b] = C.project(lat, lon); lon === -25 ? x.moveTo(X(a), Y(b)) : x.lineTo(X(a), Y(b)); } }
      x.strokeStyle = rgba(col.cote, col.nuit ? 0.22 : 0.16); x.lineWidth = 1; x.stroke();
      // terres
      const chemin = (pts, ferme) => { x.moveTo(X(pts[0]), Y(pts[1])); for (let i = 2; i < pts.length; i += 2) x.lineTo(X(pts[i]), Y(pts[i + 1])); if (ferme) x.closePath(); };
      x.beginPath(); for (const t of FOND.terres) chemin(t, true);
      x.fillStyle = rgba(col.terre, 1); x.fill();
      x.strokeStyle = rgba(col.cote, col.nuit ? 0.7 : 0.62); x.lineWidth = 0.8; x.lineJoin = 'round'; x.stroke();
      // frontières, en pointillé
      x.beginPath(); for (const f of FOND.frontieres) chemin(f, false);
      x.setLineDash([3, 3]); x.strokeStyle = rgba(col.cote, 0.45); x.lineWidth = 0.75; x.stroke(); x.setLineDash([]);
      // la France : son trait de côte un peu plus appuyé
      x.beginPath(); for (const f of FOND.france) chemin(f, true);
      x.strokeStyle = rgba(col.cote, col.nuit ? 0.9 : 0.85); x.lineWidth = 1.1; x.stroke();
    }

    // ---------- 2. Champs (WebGL) ----------
    const gl = cGl.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
    let prog = null, U = {};
    if (gl && gl.getExtension('OES_standard_derivatives')) {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aP'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['uO', 'uK', 'uDpr', 'uH', 'uLow', 'uFr', 'uFrAcc', 'uFrTot', 'uCh', 'uChAcc', 'uChTot', 'uInk', 'uRain', 'uAcc', 'uAIso', 'uARain', 'uSeuil', 'uAngle']) U[n] = gl.getUniformLocation(prog, n);
    }
    const cumul = (pts) => { const acc = [0]; for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return acc; };
    function dessinerChamps() {
      if (!prog) return;
      const t = etat.t, fr = C.froid(t), ch = C.chaud(t), fa = cumul(fr), ca = cumul(ch);
      gl.viewport(0, 0, cGl.width, cGl.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uO, kmX(0), kmY(0)); gl.uniform1f(U.uK, 1 / cam.s); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uH, cGl.height);
      gl.uniform2fv(U.uLow, C.low(t)); gl.uniform2fv(U.uFr, fr.flat()); gl.uniform1fv(U.uFrAcc, fa); gl.uniform1f(U.uFrTot, fa[fa.length - 1]);
      gl.uniform2fv(U.uCh, ch.flat()); gl.uniform1fv(U.uChAcc, ca); gl.uniform1f(U.uChTot, ca[ca.length - 1]);
      gl.uniform3fv(U.uInk, col.encre); gl.uniform3fv(U.uRain, col.encre); gl.uniform3fv(U.uAcc, col.accent);
      gl.uniform1f(U.uAIso, col.nuit ? 0.42 : 0.5); gl.uniform1f(U.uARain, col.nuit ? 0.78 : 0.86); gl.uniform1f(U.uSeuil, etat.seuil); gl.uniform1f(U.uAngle, ANGLE);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // ---------- 3. Vent ----------
    const PAS = 26; let grille = null, gT = NaN, gCam = null;
    function calculerVent() {
      const nx = Math.ceil(W / PAS) + 3, ny = Math.ceil(H / PAS) + 3, p = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) p[j * nx + i] = C.pression(kmX((i - 1) * PAS), kmY((j - 1) * PAS), etat.t);
      const u = new Float32Array(nx * ny), v = new Float32Array(nx * ny), hk = PAS / cam.s;
      for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
        const gx = (p[j * nx + i + 1] - p[j * nx + i - 1]) / (2 * hk), gy = -(p[(j + 1) * nx + i] - p[(j - 1) * nx + i]) / (2 * hk); // hPa/km, y vers le haut
        const gn = Math.hypot(gx, gy) || 1e-9;
        // géostrophique (hémisphère nord) : la dépression à gauche ; frottement : 20° vers la dépression
        let wx = -gy, wy = gx; wx -= 0.36 * gn * (gx / gn); wy -= 0.36 * gn * (gy / gn);
        const vit = Math.min(3.2, (gn / 0.02) * 1.05) / gn; // px par image à 60 i/s
        u[j * nx + i] = wx * vit; v[j * nx + i] = -wy * vit; // écran : y vers le bas
      }
      grille = { nx, ny, u, v }; gT = etat.t; gCam = cam;
    }
    function ventEn(px, py) {
      const g = grille, fx = px / PAS + 1, fy = py / PAS + 1, i = Math.floor(fx), j = Math.floor(fy);
      if (i < 1 || j < 1 || i >= g.nx - 2 || j >= g.ny - 2) return [0, 0];
      const a = fx - i, b = fy - j, k = j * g.nx + i;
      const lerp = (arr) => (arr[k] * (1 - a) + arr[k + 1] * a) * (1 - b) + (arr[k + g.nx] * (1 - a) + arr[k + g.nx + 1] * a) * b;
      return [lerp(g.u), lerp(g.v)];
    }
    let parts = [];
    let graine = 12345; const rnd = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    function semer() {
      const n = Math.round((W * H) / 2400);
      parts = Array.from({ length: n }, () => ({ x: rnd() * W, y: rnd() * H, age: Math.floor(rnd() * 160), vie: 110 + Math.floor(rnd() * 120) }));
    }
    function pasVent(dt) {
      const x = xV; x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.globalCompositeOperation = 'destination-out'; x.fillStyle = `rgba(0,0,0,${clamp(0.028 * dt, 0.012, 0.4)})`; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'source-over';
      x.beginPath();
      for (const q of parts) {
        const [u, v] = ventEn(q.x, q.y), nx = q.x + u * dt, ny = q.y + v * dt;
        if (++q.age > q.vie || nx < -4 || ny < -4 || nx > W + 4 || ny > H + 4 || (u === 0 && v === 0)) { q.x = rnd() * W; q.y = rnd() * H; q.age = 0; continue; }
        x.moveTo(q.x, q.y); x.lineTo(nx, ny); q.x = nx; q.y = ny;
      }
      x.strokeStyle = rgba(col.encre, col.nuit ? 0.22 : 0.15); x.lineWidth = 0.85; x.lineCap = 'round'; x.stroke();
    }

    // ---------- 4. Trait : fronts, centres, cotes ----------
    function lisse(pts, sub = 8) { // Catmull-Rom centripète
      const out = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        for (let k = 0; k < sub; k++) {
          const t = k / sub, t2 = t * t, t3 = t2 * t;
          out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
        }
      }
      out.push(pts[pts.length - 1]); return out;
    }
    function front(pts, type, couleurF, cote) {
      const x = xT, P = lisse(pts.map(([a, b]) => [X(a), Y(b)]));
      x.beginPath(); P.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
      x.strokeStyle = couleurF; x.fillStyle = couleurF; x.lineWidth = 2.4; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke();
      // symboles régulièrement espacés le long de l'abscisse curviligne
      const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const pas = 30; let n = 0;
      for (let s = 16, i = 1; s < L[L.length - 1] - 8; s += pas, n++) {
        while (i < L.length - 1 && L[i] < s) i++;
        const u = (s - L[i - 1]) / (L[i] - L[i - 1] || 1), px = P[i - 1][0] + u * (P[i][0] - P[i - 1][0]), py = P[i - 1][1] + u * (P[i][1] - P[i - 1][1]);
        let tx = P[i][0] - P[i - 1][0], ty = P[i][1] - P[i - 1][1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let nx = -ty, ny = tx; if (nx * cote[0] + ny * cote[1] < 0) { nx = -nx; ny = -ny; }
        const forme = type === 'occlus' ? (n % 2 ? 'demi' : 'tri') : type === 'chaud' ? 'demi' : 'tri';
        x.beginPath();
        if (forme === 'tri') { x.moveTo(px - tx * 5.5, py - ty * 5.5); x.lineTo(px + nx * 8, py + ny * 8); x.lineTo(px + tx * 5.5, py + ty * 5.5); }
        else { const a0 = Math.atan2(ty, tx); x.moveTo(px - tx * 5.5, py - ty * 5.5); x.arc(px, py, 5.5, a0 + Math.PI, a0, nx * -ty + ny * tx > 0); }
        x.closePath(); x.fill();
      }
    }
    function texte(str, x0, y0, opts = {}) {
      const x = xT; x.font = `${opts.poids || 500} ${opts.taille || 15}px Archivo, Arial, sans-serif`; x.textAlign = opts.align || 'center'; x.textBaseline = 'middle';
      x.lineWidth = 5; x.strokeStyle = rgba(opts.halo || col.mer, 0.92); x.lineJoin = 'round'; x.strokeText(str, x0, y0);
      x.fillStyle = rgba(opts.couleur || col.encre, 1); x.fillText(str, x0, y0);
    }
    function dessinerTrait() {
      const x = xT, t = etat.t; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
      // cotes des isobares le long d'une verticale, côté mer à gauche
      const xs = Math.max(26, etat.marge.g + 22);
      let prec = null;
      const haut = o.coteHaut ?? 40, bas = H - (o.coteBas ?? 40);
      for (let py = haut; py < bas && W >= 640; py += 2) { // sous 640 px, pas de cotes : elles gênaient l'horloge
        const pr = C.pression(kmX(xs), kmY(py), t), lv = Math.floor(pr / 4);
        if (prec !== null && lv !== prec) { const val = Math.max(lv, prec) * 4; texte(String(val), xs, py, { taille: 15, poids: 500, couleur: col.encre }); py += 18; prec = null; continue; }
        prec = lv;
      }
      front(C.occlus(t), 'occlus', rgba(col.orage, 1), [1, 0.3]);
      front(C.chaud(t), 'chaud', rgba(col.encre, 0.9), [0.6, -1]);
      front(C.froid(t), 'froid', rgba(col.accent, 1), [1, 0]);
      // centres de pression
      const [lx, ly] = C.low(t);
      if (X(lx) > -40 && X(lx) < W + 40 && Y(ly) > -40 && Y(ly) < H + 40) {
        texte('D', X(lx), Y(ly) - 8, { taille: 30, poids: 600 });
        texte(String(Math.round(C.pression(lx, ly, t))), X(lx), Y(ly) + 18, { taille: 15, poids: 500 });
      }
      const ax = 300, ay = -950;
      if (X(ax) > 0 && X(ax) < W && Y(ay) > 0 && Y(ay) < H) { texte('A', X(ax), Y(ay) - 8, { taille: 30, poids: 600 }); texte(String(Math.round(C.pression(ax, ay, t))), X(ax), Y(ay) + 18, { taille: 15 }); }
    }

    // ---------- Stations (DOM) : le modèle de station de l'OMM ----------
    const NS = 'http://www.w3.org/2000/svg';
    const stations = C.VILLES.map((v) => {
      const el = document.createElement('div'); el.className = 'av-station'; el.dataset.ville = v.id;
      el.innerHTML = `<svg viewBox="-40 -40 80 80" aria-hidden="true"><g class="av-station-barbule"></g><circle class="av-station-rond" r="6.5"/><g class="av-station-pluie"></g></svg><span class="av-station-nom">${v.nom}</span>`;
      couche.appendChild(el);
      return { v, el, barbule: el.querySelector('.av-station-barbule'), pluie: el.querySelector('.av-station-pluie'), k: -1, nd: -1 };
    });
    function barbule(nd) { // nd : vent moyen en nœuds, arrondi à 5 ; hampe vers l'est (rotation ensuite)
      let d = 'M6.5 0H26', x = 26, n = Math.round(nd / 5) * 5;
      while (n >= 50) { d += `M${x} 0L${x - 5} -10L${x - 7} 0Z`; x -= 8; n -= 50; }
      while (n >= 10) { d += `M${x} 0L${x + 4} -9`; x -= 4; n -= 10; }
      if (n >= 5) { if (x === 26) x -= 4.5; d += `M${x} 0L${x + 2} -5`; }
      return d;
    }
    function hachureStation(k, id) {
      if (!k) return '';
      const pas = 12 / k; let d = '';
      for (let u = -12; u <= 12; u += pas) { const dx = Math.sin(ANGLE) * 9, dy = Math.cos(ANGLE) * 9; d += `M${(u - dx).toFixed(2)} ${(-dy).toFixed(2)}L${(u + dx).toFixed(2)} ${dy.toFixed(2)}`; }
      return `<clipPath id="av-cl-${id}"><circle r="5.6"/></clipPath><path clip-path="url(#av-cl-${id})" d="${d}"/>`;
    }
    function dessinerStations() {
      const t = etat.t;
      for (const st of stations) {
        const [x, y] = st.v.xy, px = X(x), py = Y(y);
        const vis = etat.villes && px > -20 && px < W + 20 && py > -20 && py < H + 20;
        st.el.hidden = !vis; if (!vis) continue;
        st.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
        st.el.classList.toggle('est-choisie', st.v.id === etat.ville);
        const mm = C.pluie(x, y, t), k = mm < 0.2 ? 0 : mm < 1 ? 1 : mm < 2 ? 2 : mm < 4 ? 3 : 4;
        if (k !== st.k) { st.pluie.innerHTML = hachureStation(k, st.v.id); st.k = k; }
        // vent : direction depuis le gradient de pression, force depuis les rafales (vent moyen ≈ rafales / 1,45)
        const h = 12, gx = (C.pression(x + h, y, t) - C.pression(x - h, y, t)) / (2 * h), gy = (C.pression(x, y + h, t) - C.pression(x, y - h, t)) / (2 * h);
        const gn = Math.hypot(gx, gy) || 1e-9; let wx = -gy - 0.36 * gx, wy = gx - 0.36 * gy; // vers où souffle le vent
        const nd = Math.round(C.rafales(x, y, t) / 1.45 / 1.852 / 5) * 5;
        if (nd !== st.nd) { st.barbule.innerHTML = `<path d="${barbule(nd)}"/>`; st.nd = nd; }
        // la hampe pointe d'où vient le vent : angle écran de (-wx, wy) (y écran vers le bas)
        const ang = (Math.atan2(wy, -wx) * 180) / Math.PI;
        st.barbule.setAttribute('transform', `rotate(${ang.toFixed(1)})`);
      }
    }

    // ---------- Boucle ----------
    let raf = 0, dernier = 0, sale = { fond: true, champs: true, trait: true };
    function taille() {
      const r = host.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, o.dprMax || 2);
      for (const c of [cFond, cVent, cTrait]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      const dg = Math.min(dpr, o.dprChamps || 2); cGl.width = Math.round(W * dg); cGl.height = Math.round(H * dg);
      cam = cadrer(etat.vue); semer(); sale = { fond: true, champs: true, trait: true }; grille = null;
    }
    function dessiner(now) {
      if (camAnim) {
        const q = clamp((now - camAnim.t0) / camAnim.d), e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
        const a = camAnim.de, b = camAnim.vers, ls = Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * e;
        cam = { s: Math.exp(ls), cx: a.cx + (b.cx - a.cx) * e, cy: a.cy + (b.cy - a.cy) * e, px: a.px + (b.px - a.px) * e, py: a.py + (b.py - a.py) * e };
        sale = { fond: true, champs: true, trait: true }; grille = null; xV.clearRect(0, 0, cVent.width, cVent.height);
        if (q >= 1) camAnim = null;
      }
      if (sale.fond) { dessinerFond(); sale.fond = false; }
      if (sale.champs) { dessinerChamps(); sale.champs = false; }
      if (sale.trait) { dessinerTrait(); dessinerStations(); sale.trait = false; }
      if (etat.particules) {
        if (!grille || gT !== etat.t || gCam !== cam) calculerVent();
        const dt = dernier ? clamp((now - dernier) / 16.67, 0.25, 3) : 1; pasVent(dt);
      }
      dernier = now;
    }
    function boucle(now) { dessiner(now); raf = requestAnimationFrame(boucle); }
    function marquer() { sale.champs = true; sale.trait = true; if (!etat.particules) { cancelAnimationFrame(raf); raf = requestAnimationFrame((n) => { dessiner(n); }); } }

    lireCouleurs(); taille();
    const ro = new ResizeObserver(() => { taille(); marquer(); sale.fond = true; if (!etat.particules) dessiner(performance.now()); });
    ro.observe(host);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const theme = () => { lireCouleurs(); sale = { fond: true, champs: true, trait: true }; xV.clearRect(0, 0, cVent.width, cVent.height); if (!etat.particules) dessiner(performance.now()); };
    mq.addEventListener('change', theme);
    const mo = new MutationObserver(theme); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    // mode manuel (films rendus image par image) : aucune boucle ; l'appelant peint chaque instant avec api.dessiner(ms)
    if (o.manuel) { cancelAnimationFrame(raf); } else if (etat.particules) raf = requestAnimationFrame(boucle); else dessiner(performance.now());

    const api = {
      etat,
      set(t) { if (t === etat.t) return; etat.t = t; marquer(); },
      ville(id) { etat.ville = id; sale.trait = true; if (!etat.particules) dessiner(performance.now()); },
      seuil(v) { etat.seuil = v; marquer(); },
      vue(v, d = 1100) { etat.vue = v.slice(); const vers = cadrer(v); if (reduit || !d) { cam = vers; sale = { fond: true, champs: true, trait: true }; grille = null; if (!etat.particules) dessiner(performance.now()); return; } camAnim = { de: cam, vers, t0: performance.now(), d }; if (!etat.particules) { const tick = (n) => { dessiner(n); if (camAnim) requestAnimationFrame(tick); }; requestAnimationFrame(tick); } },
      marge(m) { etat.marge = m; cam = cadrer(etat.vue); sale = { fond: true, champs: true, trait: true }; grille = null; },
      ecran(x, y) { return [X(x), Y(y)]; },
      dessiner(now = performance.now()) { dessiner(now); },
      particules(on) { etat.particules = !!on && (!reduit || o.manuel); cancelAnimationFrame(raf); xV.clearRect(0, 0, cVent.width, cVent.height); if (o.manuel) return; if (etat.particules) raf = requestAnimationFrame(boucle); else dessiner(performance.now()); },
      reamorcer() { graine = 12345; semer(); dernier = 0; xV.clearRect(0, 0, cVent.width, cVent.height); },
      cadrerDirect(v) { etat.vue = v.slice(); cam = cadrer(v); sale = { fond: true, champs: true, trait: true }; grille = null; },
      detruire() { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); mq.removeEventListener('change', theme); host.replaceChildren(); },
      webgl: !!prog,
    };
    return api;
  }
  A.ciel = ciel;
})();
