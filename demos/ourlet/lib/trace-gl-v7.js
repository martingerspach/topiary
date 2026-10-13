// Ourlet · trace : la pièce et le film dessinés en WebGL2, en trame de lignes attachée à la matière
// (itération 5, refonte du film ; itération 6 : le premier écran et l'outil passent sur ce moteur).
//
// Ce que ce moteur règle, par rapport à la trame calculée à l'écran (gravure.js) :
// - les hachures sont des coordonnées de la matière (uv, en mm) et non de l'écran : elles suivent la pièce qui glisse, tourne
//   ou se plie, sans « effet de vitre » (la trame immobile pendant que l'objet passe dessous) ;
// - la couverture de chaque ligne est filtrée analytiquement : moyenne exacte d'un motif périodique sur l'empreinte du pixel
//   (anticrénelage, et fusion en aplat quand les lignes deviennent plus fines qu'un pixel) et sur le déplacement pendant
//   l'obturation (flou de bougé : une trame qui défile vite se fond au lieu de stroboscoper) ;
// - les faces sont rangées par un tampon de profondeur (plus d'erreur de tri du peintre) et lissées par multiéchantillonnage ;
// - les arêtes vues sont tracées en GL, en bandes anticrénelées, cachées par la profondeur (biais proportionnel à la pente).
// Le décor est envoyé une fois (maillages) et dessiné à son poste par un simple décalage ; seule la pièce change à chaque image.
//
// Itération 6 :
// - projection au choix : axonométrique (le film : un même décalage d'écran pour tout le décor pendant le travelling) ou
//   perspective (le premier écran et l'outil : la bascule de la vue de dessus vers les trois quarts) ; profondeur en 1/z,
//   exacte pour les faces planes comme pour les arêtes ;
// - vitesses à l'écran fournies par l'appelant (perspective : la caméra tourne, aucune vitesse de monde ne la décrit) ;
// - faces « pleines » (chants de découpe, arrondis de pli : plus fins qu'une ligne de trame, ils prennent le ton moyen) ;
// - couches de peinture à l'écran : un rideau (ou plusieurs, si l'acheteur change de teinte pendant qu'un rideau passe)
//   avance de gauche à droite ; chaque couche recouvre la précédente, net au pixel (le geste rideau de MOTION) ;
// - arêtes en tirets (trait mixte des lignes de pli, comme sur un plan), avec une opacité (le dessin resté sur le papier) ;
// - flou de bougé de la caméra en une passe (rendu dans une image, puis moyenne le long du déplacement pendant l'obturation) :
//   le raccord en mouvement des chapitres du film. Référence : le filé d'un panoramique rapide, qui masque un raccord
//   (« whip pan ») ; ici, la caméra file le long de l'atelier jusqu'au poste demandé.
// Références : Praun, Hoppe, Webb, Finkelstein, « Real-Time Hatching » (SIGGRAPH 2001), pour la trame attachée à la surface ;
// le filtrage analytique des motifs périodiques (boîte intégrée sur l'empreinte du pixel), pour l'anticrénelage.
//
// Usage : const tr = createTrace(canvas, opts) (null sans WebGL2) ; const m = tr.maille(faces) ;
// à chaque image : tr.begin(vue) ; tr.instance(m, décalage, vitesse) ; tr.face(…) ; tr.arete(…) ; tr.end().

const VS_FACE = `#version 300 es
in vec3 aPos; in vec2 aUv; in vec2 aTon; in vec2 aCut; in vec3 aVit;
uniform vec3 uT, uR, uU, uF, uVcam, uOff, uVitI; uniform float uS, uZ, uK, uVitE; uniform vec2 uCtr, uRes, uNF;
out vec2 vUv; out vec2 vTon; out vec2 vCut; out float vX; out vec2 vVit;
void main() {
  vec3 w0 = aPos + uOff, d = w0 - uT;
  float x = dot(d, uR), y = dot(d, uU), z = dot(d, uF);
  if (uK > 0.0) {
    // perspective : uT est l'œil ; profondeur en 1/z (affine à l'écran, exacte pour une face plane)
    vec2 p = uCtr + vec2(x, -y) * (uK / z) * uS;
    float zn = (uNF.y + uNF.x) / (uNF.y - uNF.x) - 2.0 * uNF.y * uNF.x / ((uNF.y - uNF.x) * z);
    gl_Position = vec4((p.x / uRes.x * 2.0 - 1.0) * z, (1.0 - p.y / uRes.y * 2.0) * z, zn * z, z);
  } else {
    vec2 p = uCtr + vec2(x, -y) * uS;
    gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, z / uZ, 1.0);
  }
  vUv = aUv; vTon = aTon; vCut = aCut; vX = w0.x;
  if (uVitE > 0.5) vVit = aVit.xy;                  // vitesse à l'écran fournie (px CSS par ms)
  else { vec3 w = aVit + uVitI - uVcam; vVit = vec2(dot(w, uR), -dot(w, uU)) * uS; }
}`;

const FS_FACE = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vTon; in vec2 vCut; in float vX; in vec2 vVit;
uniform float uPas, uDt, uDpr, uAplat; uniform vec2 uEp;
uniform vec3 uFond, uTrait0, uTrait1, uTeinte0, uTeinte1, uPlaque;
uniform int uNC; uniform float uFront[4], uCPe[4]; uniform vec3 uCT0[4], uCT1[4], uCPl[4];
out vec4 o;
// intégrale d'un motif de lignes de largeur wf (part du pas), centrées sur k + 1/2
float C(float x, float wf) { return floor(x) * wf + clamp(fract(x) - 0.5 + 0.5 * wf, 0.0, wf); }
// v7 : grain de pulvérisation, un bruit de valeur attaché à la matière (uv en mm) : il glisse avec la pièce et ne papillote pas
float Hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float grain(vec2 uv) { vec2 q = uv / 38.0, i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(Hh(i), Hh(i + vec2(1.0, 0.0)), f.x), mix(Hh(i + vec2(0.0, 1.0)), Hh(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  if (vX > vCut.y) discard;                       // la pièce passée dans le four n'est plus vue
  float ton = vTon.x;
  bool plein = ton > 1.5; if (plein) ton -= 2.0;   // face pleine : le ton moyen de la trame
  float wf = mix(uEp.x, uEp.y, ton), cov = wf;
  // dérivées hors de toute branche (elles ne sont définies qu'en contrôle uniforme)
  float s = vUv.y / uPas;                          // rang de ligne
  vec2 g = vec2(dFdx(s), dFdy(s));                 // lignes par pixel physique
  float fw = max(length(g), 1e-4);
  float aa = max(fwidth(vX), 1e-3);
  if (!plein) {
    float mb = abs(dot(vVit * uDt, g * uDpr));     // lignes balayées pendant l'obturation
    float D = max(fw, mb);
    cov = (C(s + 0.5 * D, wf) - C(s - 0.5 * D, wf)) / D;
  }
  vec3 t0 = uTeinte0, t1 = uTeinte1, pl = uPlaque;
  float peint;
  if (uNC > 0) {
    // couches de peinture à l'écran : chacune recouvre la précédente à gauche de son front (net au pixel physique)
    float xs = gl_FragCoord.x;
    peint = 0.0; t0 = uTrait0; t1 = uTrait1; pl = uFond;
    for (int i = 0; i < 4; i++) {
      if (i >= uNC) break;
      float c = clamp(uFront[i] * uDpr - xs + 0.5, 0.0, 1.0);
      t0 = mix(t0, uCT0[i], c); t1 = mix(t1, uCT1[i], c); pl = mix(pl, uCPl[i], c); peint = mix(peint, uCPe[i], c);
    }
    peint *= vTon.y;
  } else {
    // v7 : la poudre se dépose sur une bande de 220 mm devant le pistolet, en voile qui s'épaissit, au lieu d'un front net
    // (lu comme une barre de progression) ; le bord du dépôt suit le grain de pulvérisation de la matière
    peint = vTon.y * smoothstep(-110.0, 110.0, vX - vCut.x + (grain(vUv) - 0.5) * 90.0 + 0.0 * aa);
  }
  vec3 trait = mix(mix(uTrait0, uTrait1, ton), mix(t0, t1, ton), peint);
  vec3 sous = mix(uFond, pl, uAplat * peint);
  o = vec4(mix(sous, trait, cov), 1.0);
}`;

const VS_ARETE = `#version 300 es
in vec3 aA; in vec3 aB; in vec2 aK; in vec3 aE; in vec3 aN; in vec2 aX;
uniform vec3 uT, uR, uU, uF, uOff; uniform float uS, uZ, uDpr, uK; uniform vec2 uCtr, uRes, uNF;
out float vD; out float vW; out float vC; out float vX; out float vCut; out float vS; out float vTir; out float vAl;
vec3 vue(vec3 P) { vec3 d = P - uT; return vec3(dot(d, uR), dot(d, uU), dot(d, uF)); }
vec2 ecran(vec3 c) { return uK > 0.0 ? uCtr + vec2(c.x, -c.y) * (uK / c.z) * uS : uCtr + vec2(c.x, -c.y) * uS; }
void main() {
  vec3 A = aA + uOff, B = aB + uOff, ca = vue(A), cb = vue(B);
  vec2 pa = ecran(ca), pb = ecran(cb);
  vec2 dir = pb - pa; float L = length(dir); dir = L > 1e-4 ? dir / L : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  float w = aE.x, h = 0.5 * w + 1.0 / uDpr;         // demi-largeur, plus un pixel physique pour l'anticrénelage
  float ext = (aK.x * 2.0 - 1.0) * h * 0.5;
  vec2 p = mix(pa, pb, aK.x) + dir * ext + n * aK.y * h;
  // biais de profondeur : la pente de la face à l'écran (mm par px) fois la demi-largeur du trait (plus un peu)
  vec3 c = mix(ca, cb, aK.x), nv = vec3(dot(aN, uR), dot(aN, uU), dot(aN, uF));
  vec3 vd = uK > 0.0 ? normalize(c) : vec3(0.0, 0.0, 1.0);
  float nz = abs(dot(nv, vd)), nxy = length(nv - vd * dot(nv, vd));
  float mmpx = uK > 0.0 ? c.z / (uK * uS) : 1.0 / uS;
  float biais = min(30.0, 0.3 + nxy / max(nz, 0.04) * mmpx * (0.5 * w + 1.2));
  float zb = c.z - biais, zn;
  if (uK > 0.0) zn = (uNF.y + uNF.x) / (uNF.y - uNF.x) - 2.0 * uNF.y * uNF.x / ((uNF.y - uNF.x) * zb);
  else zn = zb / uZ;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, zn, 1.0);
  vD = aK.y * h; vW = w; vC = aE.y; vX = mix(A.x, B.x, aK.x); vCut = aE.z;
  vS = aK.x * L + ext; vTir = aX.x; vAl = aX.y;
}`;

const FS_ARETE = `#version 300 es
precision highp float;
in float vD; in float vW; in float vC; in float vX; in float vCut; in float vS; in float vTir; in float vAl;
uniform float uDpr; uniform vec3 uEncre, uTrait2, uFond; uniform vec4 uTirets;
out vec4 o;
void main() {
  if (vX > vCut) discard;
  float a = clamp((0.5 * vW - abs(vD)) * uDpr + 0.5, 0.0, 1.0);
  if (vTir > 0.5) {
    // trait mixte : un long, un court (uTirets : long, jour, court, jour, en px CSS), bouts anticrénelés
    float per = uTirets.x + uTirets.y + uTirets.z + uTirets.w, m = mod(vS, per), m2 = m - uTirets.x - uTirets.y;
    float on1 = max(clamp(min(m, uTirets.x - m) * uDpr + 0.5, 0.0, 1.0), clamp((m - per) * uDpr + 0.5, 0.0, 1.0));
    float on2 = clamp(min(m2, uTirets.z - m2) * uDpr + 0.5, 0.0, 1.0);
    a *= max(on1, on2);
  }
  vec3 c = vC < 0.5 ? uEncre : vC < 1.5 ? uTrait2 : uFond;
  o = vec4(c, a * vAl);
}`;

// la passe de flou de bougé : moyenne de l'image le long du déplacement de la caméra pendant l'obturation
const VS_PLEIN = `#version 300 es
in vec2 p; out vec2 vT;
void main() { vT = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS_FLOU = `#version 300 es
precision highp float;
in vec2 vT; uniform sampler2D uImg; uniform vec2 uPas; uniform int uN;
out vec4 o;
void main() {
  vec4 s = vec4(0.0);
  for (int i = 0; i < 64; i++) { if (i >= uN) break; float k = (float(i) + 0.5) / float(uN) - 0.5; s += texture(uImg, vT + uPas * k); }
  o = vec4(s.rgb / float(uN), 1.0);
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
const NF = 12, NA = 16; // flottants par sommet : faces (pos 3, uv 2, ton 2, coupe 2, vitesse 3), arêtes (a 3, b 3, k 2, e 3, n 3, x 2)
const tampon = (n) => ({ a: new Float32Array(n), n: 0 });
const grandir = (t, k) => { if (t.n + k > t.a.length) { const G = new Float32Array(Math.max(t.a.length * 2, t.n + k)); G.set(t.a.subarray(0, t.n)); t.a = G; } };
const tris = new Map(); // triangulations gardées par clé (un polygone qui ne change que par mouvement rigide ou affine)
// écrit une face plane : pts [[x,y,z]…], uv [[u,v]…] en mm dans la matière (lignes le long de u), trous { pts, uv }
// plein : la face prend le ton moyen de la trame (chants, arrondis : plus fins qu'une ligne)
function ecrireFace(T, pts, uv, ton, { trous = null, tons = null, peint = 0, cut = null, vit = null, vits = null, cle = null, plein = false } = {}) {
  let idx = cle ? tris.get(cle) : null;
  if (!idx) {
    if (!trous && convexe(uv)) { idx = []; for (let k = 1; k + 1 < pts.length; k++) idx.push(0, k, k + 1); }
    else idx = trianguler(uv, trous ? trous.map((h) => h.uv) : []);
    if (cle && Math.abs(aire(uv, uv.map((_, i) => i))) > 1) tris.set(cle, idx); // une pose dégénérée (face vue de chant) n'est pas gardée
  }
  const P = trous ? pts.concat(...trous.map((h) => h.pts)) : pts, U = trous ? uv.concat(...trous.map((h) => h.uv)) : uv;
  grandir(T, idx.length * NF);
  const F = T.a, c0 = cut ? cut[0] : 1e9, c1 = cut ? cut[1] : 1e9, pl = plein ? 2 : 0;
  let n = T.n;
  for (const i of idx) {
    const p = P[i], q = U[i], w = (vits && vits[i]) || vit;
    F[n++] = p[0]; F[n++] = p[1]; F[n++] = p[2]; F[n++] = q[0]; F[n++] = q[1];
    F[n++] = (tons && tons[i] !== undefined ? tons[i] : ton) + pl; F[n++] = peint; F[n++] = c0; F[n++] = c1;
    F[n++] = w ? w[0] : 0; F[n++] = w ? w[1] : 0; F[n++] = w ? w[2] || 0 : 0;
  }
  T.n = n;
}
// écrit une arête vue : a, b dans le monde, largeur en px CSS, couleur 0 (encre), 1 (trait clair) ou 2 (papier), normale de
// sa face (zéro : aucun biais de pente), coupe en x, tirets (trait mixte) et opacité
function ecrireArete(T, a, b, w, c, nrm, cutX = 1e9, tiret = 0, alpha = 1) {
  grandir(T, 6 * NA);
  const A = T.a; let n = T.n;
  for (let s = 0; s < 6; s++) {
    const t = s === 1 || s === 2 || s === 4 ? 1 : 0, sd = s === 2 || s === 4 || s === 5 ? 1 : -1;
    A[n++] = a[0]; A[n++] = a[1]; A[n++] = a[2]; A[n++] = b[0]; A[n++] = b[1]; A[n++] = b[2];
    A[n++] = t; A[n++] = sd; A[n++] = w; A[n++] = c; A[n++] = cutX; A[n++] = nrm[0]; A[n++] = nrm[1]; A[n++] = nrm[2];
    A[n++] = tiret; A[n++] = alpha;
  }
  T.n = n;
}

// la rampe d'une teinte de client : elle suit les traits (plus claire où les traits sont clairs) sans quitter sa couleur
export function rampe(col, hex, k = 0.3) {
  if (!hex) return { t0: col.trait0, t1: col.trait1, pl: col.fond, pe: 0 };
  const c = rgb(hex);
  return { t0: c.map((v, i) => v + (col.trait0[i] - v) * k), t1: c.map((v, i) => v + (col.trait1[i] - v) * k), pl: c.map((v, i) => v + (col.fond[i] - v) * 0.45), pe: 1 };
}

// ---------- le moteur ----------
export function createTrace(canvas, { dprMax = 2, couleurs, teinte = null, aplat = 0.85, ep = [0.05, 0.92] } = {}) {
  let gl = null;
  try { gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true }); } catch { gl = null; }
  if (!gl) return null;
  let lost = false, pF, pA, pB, uF = {}, uA = {}, uB = {}, triBuf = null, triVao = null;
  const col = {};
  const setCouleurs = (c) => { for (const k of ['fond', 'trait0', 'trait1']) col[k] = rgb(c[k]); col.encre = rgb(c.trait1); col.trait2 = rgb(c.trait0); };
  setCouleurs(couleurs);
  function setTeinte(hex) { const r = rampe(col, hex); col.teinte0 = r.t0; col.teinte1 = r.t1; col.plaque = r.pl; }
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
    const [p, attrs, N] = L.arete ? [pA, [['aA', 3, 0], ['aB', 3, 3], ['aK', 2, 6], ['aE', 3, 8], ['aN', 3, 11], ['aX', 2, 14]], NA] : [pF, [['aPos', 3, 0], ['aUv', 2, 3], ['aTon', 2, 5], ['aCut', 2, 7], ['aVit', 3, 9]], NF];
    for (const [nm, s, o] of attrs) { const l = gl.getAttribLocation(p, nm); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, s, gl.FLOAT, false, N * 4, o * 4); }
    if (L.data) gl.bufferData(gl.ARRAY_BUFFER, L.data, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }
  const lot = (arete, data = null) => { const L = { arete, data, n: data ? data.length / (arete ? NA : NF) : 0 }; lots.push(L); if (!lost) lotGL(L); return L; };
  function init() {
    pF = prog(VS_FACE, FS_FACE); pA = prog(VS_ARETE, FS_ARETE); pB = prog(VS_PLEIN, FS_FLOU);
    for (const k of ['uT', 'uR', 'uU', 'uF', 'uVcam', 'uOff', 'uVitI', 'uS', 'uZ', 'uK', 'uVitE', 'uNF', 'uCtr', 'uRes', 'uPas', 'uDt', 'uDpr', 'uAplat', 'uEp', 'uFond', 'uTrait0', 'uTrait1', 'uTeinte0', 'uTeinte1', 'uPlaque', 'uNC', 'uFront', 'uCPe', 'uCT0', 'uCT1', 'uCPl']) uF[k] = gl.getUniformLocation(pF, k);
    for (const k of ['uT', 'uR', 'uU', 'uF', 'uOff', 'uS', 'uZ', 'uK', 'uNF', 'uDpr', 'uCtr', 'uRes', 'uEncre', 'uTrait2', 'uFond', 'uTirets']) uA[k] = gl.getUniformLocation(pA, k);
    for (const k of ['uImg', 'uPas', 'uN']) uB[k] = gl.getUniformLocation(pB, k);
    triBuf = gl.createBuffer(); triVao = gl.createVertexArray(); gl.bindVertexArray(triVao); gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const l = gl.getAttribLocation(pB, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
    fbo = null;
    for (const L of lots) lotGL(L);
  }
  // images intermédiaires du flou de bougé (créées au premier besoin) : rendu multiéchantillonné, puis résolu dans une texture
  let fbo = null;
  function cibles(cw, ch) {
    if (fbo && fbo.cw === cw && fbo.ch === ch) return fbo;
    if (fbo) { gl.deleteFramebuffer(fbo.ms); gl.deleteFramebuffer(fbo.res); gl.deleteRenderbuffer(fbo.c); gl.deleteRenderbuffer(fbo.d); gl.deleteTexture(fbo.tex); }
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
    const c = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, c); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, cw, ch);
    const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, cw, ch);
    const ms = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, ms); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cw, ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const res = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, res); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    fbo = { cw, ch, ms, res, c, d, tex };
    return fbo;
  }
  try { init(); } catch (e) { console.warn('trace-gl', e); return null; }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { try { init(); lost = false; } catch { lost = true; } });

  // la part dynamique de chaque image (la pièce, son ombre), réécrite à chaque image dans les mêmes tampons
  const dynF = tampon(NF * 4000), dynA = tampon(NA * 6 * 1000);
  const lotF = lot(false), lotA = lot(true);
  let vue = null, inst = [];
  const mesCles = new Set();

  return {
    get mode() { return lost ? 'perdu' : 'gl'; },
    setTeinte, rampe: (hex) => rampe(col, hex),
    // un maillage fixe, envoyé une fois : faces [{ pts, uv, ton, trous?, tons?, aretes?: [[a, b, largeur, couleur, tiret?, alpha?]…], n }]
    maille(faces) {
      const tf = tampon(NF * 512), ta = tampon(NA * 6 * 128);
      for (const f of faces) {
        ecrireFace(tf, f.pts, f.uv, f.ton, { trous: f.trous, tons: f.tons, cle: f.cle, plein: f.plein });
        for (const [a, b, w, c, ti = 0, al = 1] of f.aretes || []) ecrireArete(ta, a, b, w, c, f.n || [0, 0, 0], 1e9, ti, al);
      }
      return { f: lot(false, tf.a.slice(0, tf.n)), a: lot(true, ta.a.slice(0, ta.n)) };
    },
    // vue : { W, H (px CSS), cam: { t, r, u, f } (axonométrique) ou { eye, r, u, f, k } avec persp: true et nf: [près, loin] (mm),
    // s (px CSS par mm ; en perspective, facteur d'échelle de la projection), cx, cy, pas (mm par ligne), dt (ms d'obturation),
    // vcam (mm/ms), vitEcran (vitesses des faces déjà à l'écran, px CSS par ms), couches ([{ front (px CSS), teinte }]),
    // tirets ([long, jour, court, jour] px CSS), flou ([dx, dy] px CSS : déplacement de la caméra pendant l'obturation) }
    begin(v) { vue = v; dynF.n = 0; dynA.n = 0; inst = []; },
    instance(m, off, vit = null) { inst.push([m, off, vit || [0, 0, 0]]); },
    face(pts, uv, ton, o) { if (o && o.cle) mesCles.add(o.cle); ecrireFace(dynF, pts, uv, ton, o); },
    arete(a, b, w, c, nrm, cutX, tiret, alpha) { ecrireArete(dynA, a, b, w, c, nrm, cutX, tiret, alpha); },
    // oublie les triangulations gardées sous un préfixe de clé (une pièce remplacée dans l'outil)
    oublier(prefixe) { for (const k of mesCles) if (k.startsWith(prefixe)) { tris.delete(k); mesCles.delete(k); } },
    end() {
      if (lost || !vue) return false;
      const { W, H } = vue, dpr = Math.min(dprMax, window.devicePixelRatio || 1);
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      const fl = vue.flou || [0, 0], flouPx = Math.hypot(fl[0], fl[1]) * dpr;
      const cible = flouPx >= 0.75 ? cibles(cw, ch) : null;
      gl.bindFramebuffer(gl.FRAMEBUFFER, cible ? cible.ms : null);
      gl.viewport(0, 0, cw, ch);
      gl.clearColor(col.fond[0], col.fond[1], col.fond[2], 1); gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const c = vue.cam, Z = 40000, persp = !!vue.persp, nf = vue.nf || [1, 1e6];
      const commun = (u) => { gl.uniform3fv(u.uT, persp ? c.eye : c.t); gl.uniform3fv(u.uR, c.r); gl.uniform3fv(u.uU, c.u); gl.uniform3fv(u.uF, c.f); gl.uniform1f(u.uS, vue.s); gl.uniform1f(u.uZ, Z); gl.uniform1f(u.uK, persp ? c.k : 0); gl.uniform2f(u.uNF, nf[0], nf[1]); gl.uniform2f(u.uCtr, vue.cx, vue.cy); gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uDpr, dpr); };
      // la part dynamique
      gl.bindBuffer(gl.ARRAY_BUFFER, lotF.buf); gl.bufferData(gl.ARRAY_BUFFER, dynF.a.subarray(0, dynF.n), gl.DYNAMIC_DRAW); lotF.n = dynF.n / NF;
      gl.bindBuffer(gl.ARRAY_BUFFER, lotA.buf); gl.bufferData(gl.ARRAY_BUFFER, dynA.a.subarray(0, dynA.n), gl.DYNAMIC_DRAW); lotA.n = dynA.n / NA;
      // faces
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND);
      gl.useProgram(pF); commun(uF);
      gl.uniform3fv(uF.uVcam, vue.vcam || [0, 0, 0]); gl.uniform1f(uF.uPas, vue.pas); gl.uniform1f(uF.uDt, vue.dt || 0); gl.uniform1f(uF.uVitE, vue.vitEcran ? 1 : 0);
      gl.uniform1f(uF.uAplat, aplat); gl.uniform2f(uF.uEp, ep[0], ep[1]);
      gl.uniform3fv(uF.uFond, col.fond); gl.uniform3fv(uF.uTrait0, col.trait0); gl.uniform3fv(uF.uTrait1, col.trait1);
      gl.uniform3fv(uF.uTeinte0, col.teinte0); gl.uniform3fv(uF.uTeinte1, col.teinte1); gl.uniform3fv(uF.uPlaque, col.plaque);
      const cs = (vue.couches || []).slice(-4);
      gl.uniform1i(uF.uNC, cs.length);
      if (cs.length) {
        const R = cs.map((k) => k.rampe || rampe(col, k.teinte));
        const pad = (a, n) => { const o = new Float32Array(4 * n); a.forEach((v, i) => o.set(v, i * n)); return o; };
        gl.uniform1fv(uF.uFront, pad(cs.map((k) => [k.front]), 1)); gl.uniform1fv(uF.uCPe, pad(R.map((r) => [r.pe]), 1));
        gl.uniform3fv(uF.uCT0, pad(R.map((r) => r.t0), 3)); gl.uniform3fv(uF.uCT1, pad(R.map((r) => r.t1), 3)); gl.uniform3fv(uF.uCPl, pad(R.map((r) => r.pl), 3));
      }
      const tracer = (L) => { if (!L.n) return; gl.bindVertexArray(L.vao); gl.drawArrays(gl.TRIANGLES, 0, L.n); };
      for (const [m, off, vit] of inst) { gl.uniform3fv(uF.uOff, off); gl.uniform3fv(uF.uVitI, vit); tracer(m.f); }
      gl.uniform3f(uF.uOff, 0, 0, 0); gl.uniform3f(uF.uVitI, 0, 0, 0); tracer(lotF);
      // arêtes vues : testées contre la profondeur des faces, sans l'écrire
      gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(pA); commun(uA); gl.uniform3fv(uA.uEncre, col.encre); gl.uniform3fv(uA.uTrait2, col.trait2); gl.uniform3fv(uA.uFond, col.fond);
      const ti = vue.tirets || [14, 3, 2, 3]; gl.uniform4f(uA.uTirets, ti[0], ti[1], ti[2], ti[3]);
      for (const [m, off] of inst) { gl.uniform3fv(uA.uOff, off); tracer(m.a); }
      gl.uniform3f(uA.uOff, 0, 0, 0); tracer(lotA);
      gl.bindVertexArray(null); gl.depthMask(true);
      if (cible) {
        // flou de bougé de la caméra : l'image résolue, moyennée le long du déplacement (une tache par pixel et demi)
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, cible.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, cible.res);
        gl.blitFramebuffer(0, 0, cw, ch, 0, 0, cw, ch, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.useProgram(pB); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cible.tex); gl.uniform1i(uB.uImg, 0);
        gl.uniform2f(uB.uPas, (fl[0] * dpr) / cw, (-fl[1] * dpr) / ch); gl.uniform1i(uB.uN, Math.max(2, Math.min(64, Math.ceil(flouPx / 1.5))));
        gl.bindVertexArray(triVao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
      }
      return true;
    },
    destroy() { for (const k of mesCles) tris.delete(k); mesCles.clear(); const ext = gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); },
  };
}
