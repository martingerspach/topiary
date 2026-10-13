// Ourlet · trace : le film dessiné en WebGL2, en trame de lignes attachée à la matière (itération 5, refonte du film).
//
// Ce que ce moteur règle, par rapport à la trame calculée à l'écran (gravure.js) :
// - les hachures sont des coordonnées de la matière (uv, en mm) et non de l'écran : elles suivent la pièce qui glisse, tourne
//   ou se plie, sans « effet de vitre » (la trame immobile pendant que l'objet passe dessous) ;
// - la couverture de chaque ligne est filtrée analytiquement : moyenne exacte d'un motif périodique sur l'empreinte du pixel
//   (anticrénelage, et fusion en aplat quand les lignes deviennent plus fines qu'un pixel) et sur le déplacement pendant
//   l'obturation (flou de bougé : une trame qui défile vite se fond au lieu de stroboscoper) ;
// - les faces sont rangées par un tampon de profondeur (plus d'erreur de tri du peintre) et lissées par multiéchantillonnage ;
// - les arêtes vues sont tracées en GL, en bandes anticrénelées, cachées par la profondeur (biais proportionnel à la pente).
// La caméra est axonométrique (projection parallèle) : un même décalage d'écran pour tout le décor pendant le travelling.
// Le décor est envoyé une fois (maillages) et dessiné à son poste par un simple décalage ; seule la pièce change à chaque image.
//
// Usage : const tr = createTrace(canvas, opts) (null sans WebGL2) ; const m = tr.maille(faces) ;
// à chaque image : tr.begin(vue) ; tr.instance(m, décalage, vitesse) ; tr.face(…) ; tr.arete(…) ; tr.end().

const VS_FACE = `#version 300 es
in vec3 aPos; in vec2 aUv; in vec2 aTon; in vec2 aCut; in vec3 aVit;
uniform vec3 uT, uR, uU, uF, uVcam, uOff, uVitI; uniform float uS, uZ; uniform vec2 uCtr, uRes;
out vec2 vUv; out vec2 vTon; out vec2 vCut; out float vX; out vec2 vVit;
void main() {
  vec3 w0 = aPos + uOff, d = w0 - uT;
  vec2 p = uCtr + vec2(dot(d, uR), -dot(d, uU)) * uS;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, dot(d, uF) / uZ, 1.0);
  vUv = aUv; vTon = aTon; vCut = aCut; vX = w0.x;
  vec3 w = aVit + uVitI - uVcam;
  vVit = vec2(dot(w, uR), -dot(w, uU)) * uS;   // vitesse à l'écran, px CSS par ms
}`;

const FS_FACE = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vTon; in vec2 vCut; in float vX; in vec2 vVit;
uniform float uPas, uDt, uDpr, uAplat; uniform vec2 uEp;
uniform vec3 uFond, uTrait0, uTrait1, uTeinte0, uTeinte1, uPlaque;
out vec4 o;
// intégrale d'un motif de lignes de largeur wf (part du pas), centrées sur k + 1/2
float C(float x, float wf) { return floor(x) * wf + clamp(fract(x) - 0.5 + 0.5 * wf, 0.0, wf); }
void main() {
  if (vX > vCut.y) discard;                       // la pièce passée dans le four n'est plus vue
  float s = vUv.y / uPas;                          // rang de ligne
  vec2 g = vec2(dFdx(s), dFdy(s));                 // lignes par pixel physique
  float fw = max(length(g), 1e-4);
  float mb = abs(dot(vVit * uDt, g * uDpr));      // lignes balayées pendant l'obturation
  float D = max(fw, mb);
  float ton = vTon.x;
  float wf = mix(uEp.x, uEp.y, ton);
  float cov = (C(s + 0.5 * D, wf) - C(s - 0.5 * D, wf)) / D;
  float aa = max(fwidth(vX), 1e-3);
  float peint = vTon.y * clamp((vX - vCut.x) / aa + 0.5, 0.0, 1.0);   // le rideau de poudre, net au pixel
  vec3 trait = mix(mix(uTrait0, uTrait1, ton), mix(uTeinte0, uTeinte1, ton), peint);
  vec3 sous = mix(uFond, uPlaque, uAplat * peint);
  o = vec4(mix(sous, trait, cov), 1.0);
}`;

const VS_ARETE = `#version 300 es
in vec3 aA; in vec3 aB; in vec2 aK; in vec3 aE; in vec3 aN;
uniform vec3 uT, uR, uU, uF, uOff; uniform float uS, uZ, uDpr; uniform vec2 uCtr, uRes;
out float vD; out float vW; out float vC; out float vX; out float vCut;
void main() {
  vec3 A = aA + uOff, B = aB + uOff, da = A - uT, db = B - uT;
  vec2 pa = uCtr + vec2(dot(da, uR), -dot(da, uU)) * uS, pb = uCtr + vec2(dot(db, uR), -dot(db, uU)) * uS;
  vec2 dir = pb - pa; float L = length(dir); dir = L > 1e-4 ? dir / L : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  float w = aE.x, h = 0.5 * w + 1.0 / uDpr;         // demi-largeur, plus un pixel physique pour l'anticrénelage
  vec2 p = mix(pa, pb, aK.x) + dir * (aK.x * 2.0 - 1.0) * h * 0.5 + n * aK.y * h;
  // biais de profondeur : la pente de la face à l'écran fois la demi-largeur du trait (plus un peu)
  float pente = length(vec2(dot(aN, uR), dot(aN, uU))) / max(abs(dot(aN, uF)), 0.04) / uS;
  float biais = min(30.0, 0.3 + pente * (0.5 * w + 1.2));
  float z = (mix(dot(da, uF), dot(db, uF), aK.x) - biais) / uZ;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, z, 1.0);
  vD = aK.y * h; vW = w; vC = aE.y; vX = mix(A.x, B.x, aK.x); vCut = aE.z;
}`;

const FS_ARETE = `#version 300 es
precision highp float;
in float vD; in float vW; in float vC; in float vX; in float vCut;
uniform float uDpr; uniform vec3 uEncre, uTrait2;
out vec4 o;
void main() {
  if (vX > vCut) discard;
  float a = clamp((0.5 * vW - abs(vD)) * uDpr + 0.5, 0.0, 1.0);
  o = vec4(mix(uEncre, uTrait2, vC), a);
}`;

const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

// ---------- triangulation d'un polygone plan, trous compris (coupe des oreilles, ponts vers les trous) ----------
// pts : [[x, y], …] du contour ; trous : [[[x, y], …], …]. Renvoie des indices dans [contour, trou 1, trou 2, …].
const aire = (P, ids) => { let a = 0; for (let i = 0, j = ids.length - 1; i < ids.length; j = i++) a += (P[ids[j]][0] - P[ids[i]][0]) * (P[ids[j]][1] + P[ids[i]][1]); return a; };
const crx = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const dans = (a, b, c, p) => crx(a, b, p) >= 0 && crx(b, c, p) >= 0 && crx(c, a, p) >= 0;
export function trianguler(pts, trous = []) {
  const P = pts.slice(); let ring = pts.map((_, i) => i);
  if (aire(P, ring) < 0) ring.reverse();                       // contour dans le sens direct (aire > 0 avec cette formule)
  const hs = trous.map((H) => { const o = P.length; H.forEach((q) => P.push(q)); let r = H.map((_, i) => o + i); if (aire(P, r) > 0) r.reverse(); return r; }); // trous en sens inverse
  // ponts : chaque trou (du plus à droite au plus à gauche) est relié au contour par son sommet le plus à droite
  hs.sort((a, b) => Math.max(...b.map((i) => P[i][0])) - Math.max(...a.map((i) => P[i][0])));
  for (const h of hs) {
    let mi = 0; h.forEach((id, k) => { if (P[id][0] > P[h[mi]][0]) mi = k; });
    const M = P[h[mi]];
    let best = -1, bx = Infinity;
    for (let k = 0; k < ring.length; k++) {
      const a = P[ring[k]], b = P[ring[(k + 1) % ring.length]];
      if ((a[1] - M[1]) * (b[1] - M[1]) > 0 || a[1] === b[1]) continue;
      const x = a[0] + ((M[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      if (x >= M[0] && x < bx) { bx = x; best = a[0] > b[0] ? k : (k + 1) % ring.length; }
    }
    if (best < 0) continue;
    // un sommet réflexe du contour dans le triangle (M, intersection, P) bloquerait le pont : on prend le plus proche en angle
    const Pb = P[ring[best]], I = [bx, M[1]];
    let cand = best, ca = Infinity;
    for (let k = 0; k < ring.length; k++) {
      const q = P[ring[k]]; if (k === best) continue;
      if (q[0] >= M[0] && (dans(M, I, Pb, q) || dans(M, Pb, I, q))) { const an = Math.abs(Math.atan2(q[1] - M[1], q[0] - M[0])); if (an < ca) { ca = an; cand = k; } }
    }
    const hr = h.slice(mi).concat(h.slice(0, mi));
    ring = ring.slice(0, cand + 1).concat(hr, [hr[0], ring[cand]], ring.slice(cand + 1));
  }
  // coupe des oreilles
  const out = [], rr = ring.slice();
  let guard = rr.length * rr.length + 10, i = 0;
  while (rr.length > 3 && guard-- > 0) {
    const n = rr.length, ia = rr[(i + n - 1) % n], ib = rr[i % n], ic = rr[(i + 1) % n];
    const a = P[ia], b = P[ib], c = P[ic];
    let ear = crx(a, b, c) > 1e-9;
    if (ear) for (const id of rr) { if (id === ia || id === ib || id === ic) continue; const q = P[id]; if ((q[0] === a[0] && q[1] === a[1]) || (q[0] === b[0] && q[1] === b[1]) || (q[0] === c[0] && q[1] === c[1])) continue; if (dans(a, b, c, q)) { ear = false; break; } }
    if (ear) { out.push(ia, ib, ic); rr.splice(i % n, 1); i = Math.max(0, (i % n) - 1); } else i++;
    if (i > 2 * n) { // plus d'oreille franche (polygone dégénéré) : éventail sur le reste
      for (let k = 1; k + 1 < rr.length; k++) out.push(rr[0], rr[k], rr[k + 1]);
      return out;
    }
  }
  if (rr.length === 3) out.push(rr[0], rr[1], rr[2]);
  return out;
}
const convexe = (uv) => { let s = 0; for (let i = 0; i < uv.length; i++) { const c = crx(uv[i], uv[(i + 1) % uv.length], uv[(i + 2) % uv.length]); if (Math.abs(c) < 1e-9) continue; if (!s) s = Math.sign(c); else if (Math.sign(c) !== s) return false; } return true; };

// tampon de flottants qui grandit sans se réallouer à chaque image
const NF = 12, NA = 14; // flottants par sommet : faces (pos 3, uv 2, ton 2, coupe 2, vitesse 3), arêtes (a 3, b 3, k 2, e 3, n 3)
const tampon = (n) => ({ a: new Float32Array(n), n: 0 });
const grandir = (t, k) => { if (t.n + k > t.a.length) { const G = new Float32Array(Math.max(t.a.length * 2, t.n + k)); G.set(t.a.subarray(0, t.n)); t.a = G; } };
const tris = new Map(); // triangulations gardées par clé (un polygone qui ne change que par mouvement rigide ou affine)
// écrit une face plane : pts [[x,y,z]…], uv [[u,v]…] en mm dans la matière (lignes le long de u), trous { pts, uv }
function ecrireFace(T, pts, uv, ton, { trous = null, tons = null, peint = 0, cut = null, vit = null, vits = null, cle = null } = {}) {
  let idx = cle ? tris.get(cle) : null;
  if (!idx) {
    if (!trous && convexe(uv)) { idx = []; for (let k = 1; k + 1 < pts.length; k++) idx.push(0, k, k + 1); }
    else idx = trianguler(uv, trous ? trous.map((h) => h.uv) : []);
    if (cle && Math.abs(aire(uv, uv.map((_, i) => i))) > 1) tris.set(cle, idx); // une pose dégénérée (face vue de chant) n'est pas gardée
  }
  const P = trous ? pts.concat(...trous.map((h) => h.pts)) : pts, U = trous ? uv.concat(...trous.map((h) => h.uv)) : uv;
  grandir(T, idx.length * NF);
  const F = T.a, c0 = cut ? cut[0] : 1e9, c1 = cut ? cut[1] : 1e9;
  let n = T.n;
  for (const i of idx) {
    const p = P[i], q = U[i], w = (vits && vits[i]) || vit;
    F[n++] = p[0]; F[n++] = p[1]; F[n++] = p[2]; F[n++] = q[0]; F[n++] = q[1];
    F[n++] = tons && tons[i] !== undefined ? tons[i] : ton; F[n++] = peint; F[n++] = c0; F[n++] = c1;
    F[n++] = w ? w[0] : 0; F[n++] = w ? w[1] : 0; F[n++] = w ? w[2] : 0;
  }
  T.n = n;
}
// écrit une arête vue : a, b dans le monde, largeur en px CSS, couleur 0 (encre) ou 1 (trait clair), normale de sa face
function ecrireArete(T, a, b, w, c, nrm, cutX = 1e9) {
  grandir(T, 6 * NA);
  const A = T.a; let n = T.n;
  for (let s = 0; s < 6; s++) {
    const t = s === 1 || s === 2 || s === 4 ? 1 : 0, sd = s === 2 || s === 4 || s === 5 ? 1 : -1;
    A[n++] = a[0]; A[n++] = a[1]; A[n++] = a[2]; A[n++] = b[0]; A[n++] = b[1]; A[n++] = b[2];
    A[n++] = t; A[n++] = sd; A[n++] = w; A[n++] = c; A[n++] = cutX; A[n++] = nrm[0]; A[n++] = nrm[1]; A[n++] = nrm[2];
  }
  T.n = n;
}

// ---------- le moteur ----------
export function createTrace(canvas, { dprMax = 2, couleurs, teinte = null, aplat = 0.85, ep = [0.05, 0.92] } = {}) {
  let gl = null;
  try { gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true }); } catch { gl = null; }
  if (!gl) return null;
  let lost = false, pF, pA, uF = {}, uA = {};
  const col = {};
  const setCouleurs = (c) => { for (const k of ['fond', 'trait0', 'trait1']) col[k] = rgb(c[k]); col.encre = rgb(c.trait1); col.trait2 = rgb(c.trait0); };
  setCouleurs(couleurs);
  function setTeinte(hex, k = 0.3) { // la même rampe que gravure.js : la teinte du client suit les traits sans quitter sa couleur
    if (!hex) { col.teinte0 = col.trait0; col.teinte1 = col.trait1; col.plaque = col.fond; return; }
    const c = rgb(hex);
    col.plaque = c.map((v, i) => v + (col.fond[i] - v) * 0.45);
    col.teinte0 = c.map((v, i) => v + (col.trait0[i] - v) * k);
    col.teinte1 = c.map((v, i) => v + (col.trait1[i] - v) * k);
  }
  setTeinte(teinte);
  function prog(vs, fs) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  // un lot de sommets sur la carte : faces ou arêtes, avec son tableau d'attributs
  const lots = [];
  function lotGL(L) {
    L.buf = gl.createBuffer(); L.vao = gl.createVertexArray(); gl.bindVertexArray(L.vao); gl.bindBuffer(gl.ARRAY_BUFFER, L.buf);
    const [p, attrs, N] = L.arete ? [pA, [['aA', 3, 0], ['aB', 3, 3], ['aK', 2, 6], ['aE', 3, 8], ['aN', 3, 11]], NA] : [pF, [['aPos', 3, 0], ['aUv', 2, 3], ['aTon', 2, 5], ['aCut', 2, 7], ['aVit', 3, 9]], NF];
    for (const [nm, s, o] of attrs) { const l = gl.getAttribLocation(p, nm); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, s, gl.FLOAT, false, N * 4, o * 4); }
    if (L.data) gl.bufferData(gl.ARRAY_BUFFER, L.data, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }
  const lot = (arete, data = null) => { const L = { arete, data, n: data ? data.length / (arete ? NA : NF) : 0 }; lots.push(L); if (!lost) lotGL(L); return L; };
  function init() {
    pF = prog(VS_FACE, FS_FACE); pA = prog(VS_ARETE, FS_ARETE);
    for (const k of ['uT', 'uR', 'uU', 'uF', 'uVcam', 'uOff', 'uVitI', 'uS', 'uZ', 'uCtr', 'uRes', 'uPas', 'uDt', 'uDpr', 'uAplat', 'uEp', 'uFond', 'uTrait0', 'uTrait1', 'uTeinte0', 'uTeinte1', 'uPlaque']) uF[k] = gl.getUniformLocation(pF, k);
    for (const k of ['uT', 'uR', 'uU', 'uF', 'uOff', 'uS', 'uZ', 'uDpr', 'uCtr', 'uRes', 'uEncre', 'uTrait2']) uA[k] = gl.getUniformLocation(pA, k);
    for (const L of lots) lotGL(L);
  }
  try { init(); } catch (e) { console.warn('trace-gl', e); return null; }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { try { init(); lost = false; } catch { lost = true; } });

  // la part dynamique de chaque image (la pièce, son ombre), réécrite à chaque image dans les mêmes tampons
  const dynF = tampon(NF * 4000), dynA = tampon(NA * 6 * 1000);
  const lotF = lot(false), lotA = lot(true);
  let vue = null, inst = [];

  return {
    get mode() { return lost ? 'perdu' : 'gl'; },
    setTeinte,
    // un maillage fixe, envoyé une fois : faces [{ pts, uv, ton, trous?, tons?, aretes?: [[a, b, largeur, couleur]…], n }]
    maille(faces) {
      const tf = tampon(NF * 512), ta = tampon(NA * 6 * 128);
      for (const f of faces) {
        ecrireFace(tf, f.pts, f.uv, f.ton, { trous: f.trous, tons: f.tons, cle: f.cle });
        for (const [a, b, w, c] of f.aretes || []) ecrireArete(ta, a, b, w, c, f.n);
      }
      return { f: lot(false, tf.a.slice(0, tf.n)), a: lot(true, ta.a.slice(0, ta.n)) };
    },
    // vue : { W, H (px CSS), cam: { t, r, u, f }, s (px CSS par mm), cx, cy, pas (mm par ligne), dt (ms d'obturation), vcam (mm/ms) }
    begin(v) { vue = v; dynF.n = 0; dynA.n = 0; inst = []; },
    instance(m, off, vit = null) { inst.push([m, off, vit || [0, 0, 0]]); },
    face(pts, uv, ton, o) { ecrireFace(dynF, pts, uv, ton, o); },
    arete(a, b, w, c, nrm, cutX) { ecrireArete(dynA, a, b, w, c, nrm, cutX); },
    end() {
      if (lost || !vue) return false;
      const { W, H } = vue, dpr = Math.min(dprMax, window.devicePixelRatio || 1);
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      gl.viewport(0, 0, cw, ch);
      gl.clearColor(col.fond[0], col.fond[1], col.fond[2], 1); gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const c = vue.cam, Z = 40000;
      const commun = (u) => { gl.uniform3fv(u.uT, c.t); gl.uniform3fv(u.uR, c.r); gl.uniform3fv(u.uU, c.u); gl.uniform3fv(u.uF, c.f); gl.uniform1f(u.uS, vue.s); gl.uniform1f(u.uZ, Z); gl.uniform2f(u.uCtr, vue.cx, vue.cy); gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uDpr, dpr); };
      // la part dynamique
      gl.bindBuffer(gl.ARRAY_BUFFER, lotF.buf); gl.bufferData(gl.ARRAY_BUFFER, dynF.a.subarray(0, dynF.n), gl.DYNAMIC_DRAW); lotF.n = dynF.n / NF;
      gl.bindBuffer(gl.ARRAY_BUFFER, lotA.buf); gl.bufferData(gl.ARRAY_BUFFER, dynA.a.subarray(0, dynA.n), gl.DYNAMIC_DRAW); lotA.n = dynA.n / NA;
      // faces
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND);
      gl.useProgram(pF); commun(uF);
      gl.uniform3fv(uF.uVcam, vue.vcam || [0, 0, 0]); gl.uniform1f(uF.uPas, vue.pas); gl.uniform1f(uF.uDt, vue.dt || 0);
      gl.uniform1f(uF.uAplat, aplat); gl.uniform2f(uF.uEp, ep[0], ep[1]);
      gl.uniform3fv(uF.uFond, col.fond); gl.uniform3fv(uF.uTrait0, col.trait0); gl.uniform3fv(uF.uTrait1, col.trait1);
      gl.uniform3fv(uF.uTeinte0, col.teinte0); gl.uniform3fv(uF.uTeinte1, col.teinte1); gl.uniform3fv(uF.uPlaque, col.plaque);
      const tracer = (L) => { if (!L.n) return; gl.bindVertexArray(L.vao); gl.drawArrays(gl.TRIANGLES, 0, L.n); };
      for (const [m, off, vit] of inst) { gl.uniform3fv(uF.uOff, off); gl.uniform3fv(uF.uVitI, vit); tracer(m.f); }
      gl.uniform3f(uF.uOff, 0, 0, 0); gl.uniform3f(uF.uVitI, 0, 0, 0); tracer(lotF);
      // arêtes vues : testées contre la profondeur des faces, sans l'écrire
      gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(pA); commun(uA); gl.uniform3fv(uA.uEncre, col.encre); gl.uniform3fv(uA.uTrait2, col.trait2);
      for (const [m, off] of inst) { gl.uniform3fv(uA.uOff, off); tracer(m.a); }
      gl.uniform3f(uA.uOff, 0, 0, 0); tracer(lotA);
      gl.bindVertexArray(null); gl.depthMask(true);
      return true;
    },
    destroy() { const ext = gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); },
  };
}
