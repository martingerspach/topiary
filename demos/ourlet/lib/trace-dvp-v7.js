// Ourlet · trace du développé (itération 7) : la pièce du premier écran et de l'outil, dessinée en WebGL2, en trame de lignes
// attachée à la matière. Copie de trace-gl-v6.js, réduite à ce que le développé utilise (plus de flou de bougé de caméra ni
// de coupe au four, qui restent dans le moteur du film), avec le dépôt de poudre à la place du rideau d'écran.
//
// Ce que le moteur garde de la v6 :
// - hachures en coordonnées de la matière (uv, en mm), filtrées analytiquement (moyenne exacte d'un motif périodique sur
//   l'empreinte du pixel et sur le déplacement pendant l'obturation) ; faces rangées par la profondeur ; arêtes vues en
//   bandes anticrénelées, cachées par la profondeur ; perspective ou axonométrie ; traits mixtes des lignes de pli.
//
// Itération 7, le dépôt de poudre (à la place du rideau qui traversait l'écran, lu comme une barre de progression) :
// - référence de métier : le poudrage électrostatique au pistolet. Le peintre couvre la pièce par passes parallèles qui se
//   recouvrent à moitié, dans le sens long, en allers et retours ; le nuage de poudre n'a pas de bord, la couche s'épaissit
//   à mesure qu'il passe et les creux (faces intérieures, effet de cage de Faraday) se couvrent un peu plus tard ;
// - ici, les passes sont tracées dans la matière (les coordonnées du développé) : le dépôt suit la tôle, face après face,
//   quelle que soit la pose de la pièce ou de la caméra. Chaque point cumule l'exposition des passes (profil de Gauss en
//   travers, front adouci le long de la passe), puis la couche sature (1 − e^(−K·exposition)) : elle fonce progressivement ;
// - le grain : un bruit de valeur en mm de matière (un grain fin, un nuage plus large) décale le seuil de chaque point :
//   la poudre prend par grains, le bord du nuage est irrégulier ; rien ne papillote puisque le grain est fixé à la tôle,
//   et il s'efface de lui-même quand il devient plus fin qu'un pixel ;
// - plusieurs couches peuvent se suivre (l'acheteur change de teinte pendant qu'une couche se dépose) ; « sans peinture »
//   retire la couche par le même grain, d'un seul geste (aucun pistolet ne dépose de la tôle nue).
// Référence de la trame : Praun, Hoppe, Webb, Finkelstein, « Real-Time Hatching » (SIGGRAPH 2001).
//
// Usage : const tr = createTrace(canvas, opts) (null sans WebGL2) ; const m = tr.maille(faces) ;
// à chaque image : tr.begin(vue) ; tr.instance(m, décalage) ; tr.face(…) ; tr.arete(…) ; tr.end().

const VS_FACE = `#version 300 es
in vec3 aPos; in vec2 aUv; in vec2 aTon; in vec2 aDep; in vec3 aVit;
uniform vec3 uT, uR, uU, uF, uVcam, uOff, uVitI; uniform float uS, uZ, uK, uVitE; uniform vec2 uCtr, uRes, uNF;
out vec2 vUv; out vec2 vTon; out vec2 vDep; out vec2 vVit;
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
  vUv = aUv; vTon = aTon; vDep = aDep;
  if (uVitE > 0.5) vVit = aVit.xy;                  // vitesse à l'écran fournie (px CSS par ms)
  else { vec3 w = aVit + uVitI - uVcam; vVit = vec2(dot(w, uR), -dot(w, uU)) * uS; }
}`;

const FS_FACE = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vTon; in vec2 vDep; in vec2 vVit;
uniform float uPas, uDt, uDpr, uAplat; uniform vec2 uEp;
uniform vec3 uFond, uTrait0, uTrait1;
uniform int uNC; uniform bool uGrainActif; uniform vec2 uCP[6]; uniform float uCPe[6]; uniform vec3 uCT0[6], uCT1[6], uCPl[6];
uniform vec4 uDepA, uDepB; uniform vec3 uGrain;
out vec4 o;
// intégrale d'un motif de lignes de largeur wf (part du pas), centrées sur k + 1/2
float C(float x, float wf) { return floor(x) * wf + clamp(fract(x) - 0.5 + 0.5 * wf, 0.0, wf); }
// bruit de valeur sur une grille de la matière (hachage entier : le même sur toutes les cartes)
float hachage(ivec2 p) { uint h = uint(p.x) * 1597334677u ^ uint(p.y) * 3812015801u; h ^= h >> 15u; h *= 2246822519u; h ^= h >> 13u; return float(h & 65535u) / 65535.0; }
float bruit(vec2 q) {
  vec2 i = floor(q), f = q - i; f = f * f * (3.0 - 2.0 * f); ivec2 c = ivec2(i);
  return mix(mix(hachage(c), hachage(c + ivec2(1, 0)), f.x), mix(hachage(c + ivec2(0, 1)), hachage(c + ivec2(1, 1)), f.x), f.y);
}
// part de la couche déposée en un point de la matière. cp.x : 0 = couche entière, 1 = passes du pistolet, 2 = d'un seul geste ;
// cp.y : l'avancement (passes : le rang de la passe en cours et sa part faite ; geste : de 0 à 1).
// uDepA : première passe (mm, en travers), écart entre passes, largeur du nuage en travers, nombre de passes ;
// uDepB : les deux bords de la tôle dans le sens long (mm), saturation K, largeur du front le long de la passe.
float couche(vec2 uv, vec2 cp, float creux) {
  if (cp.x < 0.5) return 1.0;
  if (cp.x > 1.5) return cp.y;
  int n = int(uDepA.w); float e = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= n) break;
    float p = clamp(cp.y - float(i), 0.0, 1.0);
    if (p <= 0.0) break;
    bool aller = (i & 1) == 0;
    // le nuage entre avant le bord (2,4 largeurs : il arrive de rien) et sort juste après l'autre bord (la passe suivante repart de là)
    float s = aller ? mix(uDepB.x - 2.4 * uDepB.w, uDepB.y + 0.9 * uDepB.w, p) : mix(uDepB.y + 2.4 * uDepB.w, uDepB.x - 0.9 * uDepB.w, p);
    float x = (aller ? s - uv.x : uv.x - s) / uDepB.w;
    float a = (uv.y - (uDepA.x + uDepA.y * float(i))) / uDepA.z;
    e += exp(-0.5 * a * a) * smoothstep(-2.4, 2.4, x);
  }
  float c = 1.0 - exp(-uDepB.z * creux * e);
  return mix(c, 1.0, smoothstep(float(n) - 0.5, float(n) - 0.22, cp.y));  // la fin de la dernière passe ferme la couche partout
}
void main() {
  float ton = vTon.x;
  bool plein = ton > 1.5; if (plein) ton -= 2.0;   // face pleine : le ton moyen de la trame
  float wf = mix(uEp.x, uEp.y, ton), cov = wf;
  // dérivées hors de toute branche (elles ne sont définies qu'en contrôle uniforme)
  float s = vUv.y / uPas;                          // rang de ligne
  vec2 g = vec2(dFdx(s), dFdy(s));                 // lignes par pixel physique
  float fw = max(length(g), 1e-4);
  if (!plein) {
    float mb = abs(dot(vVit * uDt, g * uDpr));     // lignes balayées pendant l'obturation
    float D = max(fw, mb);
    cov = (C(s + 0.5 * D, wf) - C(s - 0.5 * D, wf)) / D;
  }
  // le grain de la poudre : calculé seulement pendant un dépôt (branche sur un uniforme : les dérivées restent définies)
  float grain = 0.5;
  if (uGrainActif) {
    vec2 qf = vUv / uGrain.x, qn = vUv / uGrain.y;
    float fin = bruit(qf), nuage = bruit(qn);
    float af = clamp(1.7 - max(fwidth(qf.x), fwidth(qf.y)), 0.0, 1.0);   // plus fin qu'un pixel : il se fond dans sa moyenne
    grain = clamp(0.5 + (fin - 0.5) * 0.72 * af + (nuage - 0.5) * 0.56, 0.0, 1.0);
  }
  vec3 t0 = uTrait0, t1 = uTrait1, pl = uFond; float peint = 0.0, w = uGrain.z;
  for (int i = 0; i < 6; i++) {
    if (i >= uNC) break;
    float c = couche(vUv, uCP[i], vDep.x);
    if (uCP[i].x > 0.5) c = clamp((c - grain * (1.0 - w)) / w, 0.0, 1.0);   // la poudre prend par grains
    t0 = mix(t0, uCT0[i], c); t1 = mix(t1, uCT1[i], c); pl = mix(pl, uCPl[i], c); peint = mix(peint, uCPe[i], c);
  }
  peint *= vTon.y;
  vec3 trait = mix(mix(uTrait0, uTrait1, ton), mix(t0, t1, ton), peint);
  vec3 sous = mix(uFond, pl, uAplat * peint);
  o = vec4(mix(sous, trait, cov), 1.0);
}`;

const VS_ARETE = `#version 300 es
in vec3 aA; in vec3 aB; in vec2 aK; in vec3 aE; in vec3 aN; in vec2 aX;
uniform vec3 uT, uR, uU, uF, uOff; uniform float uS, uZ, uDpr, uK; uniform vec2 uCtr, uRes, uNF;
out float vD; out float vW; out float vC; out float vS; out float vTir; out float vAl;
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
  float biais = min(aE.z, 0.3 + nxy / max(nz, 0.04) * mmpx * (0.5 * w + 1.2));
  float zb = c.z - biais, zn;
  if (uK > 0.0) zn = (uNF.y + uNF.x) / (uNF.y - uNF.x) - 2.0 * uNF.y * uNF.x / ((uNF.y - uNF.x) * zb);
  else zn = zb / uZ;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, zn, 1.0);
  vD = aK.y * h; vW = w; vC = aE.y;
  vS = aK.x * L + ext; vTir = aX.x; vAl = aX.y;
}`;

const FS_ARETE = `#version 300 es
precision highp float;
in float vD; in float vW; in float vC; in float vS; in float vTir; in float vAl;
uniform float uDpr; uniform vec3 uEncre, uTrait2, uFond; uniform vec4 uTirets;
out vec4 o;
void main() {
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
const NF = 12, NA = 16; // flottants par sommet : faces (pos 3, uv 2, ton 2, dépôt 2, vitesse 3), arêtes (a 3, b 3, k 2, e 3, n 3, x 2)
const tampon = (n) => ({ a: new Float32Array(n), n: 0 });
const grandir = (t, k) => { if (t.n + k > t.a.length) { const G = new Float32Array(Math.max(t.a.length * 2, t.n + k)); G.set(t.a.subarray(0, t.n)); t.a = G; } };
const tris = new Map(); // triangulations gardées par clé (un polygone qui ne change que par mouvement rigide ou affine)
// écrit une face plane : pts [[x,y,z]…], uv [[u,v]…] en mm dans la matière (lignes le long de u), trous { pts, uv }
// plein : la face prend le ton moyen de la trame (chants, arrondis : plus fins qu'une ligne ; leurs uv, alignés le long du
// contour, donnent un éventail) ; creux : part d'exposition à la poudre (1 = pleine)
function ecrireFace(T, pts, uv, ton, { trous = null, tons = null, peint = 0, creux = 1, vit = null, vits = null, cle = null, plein = false } = {}) {
  let idx = cle ? tris.get(cle) : null;
  if (!idx) {
    if (plein || (!trous && convexe(uv))) { idx = []; for (let k = 1; k + 1 < pts.length; k++) idx.push(0, k, k + 1); }
    else idx = trianguler(uv, trous ? trous.map((h) => h.uv) : []);
    if (cle && Math.abs(aire(uv, uv.map((_, i) => i))) > 1) tris.set(cle, idx); // une pose dégénérée (face vue de chant) n'est pas gardée
  }
  const P = trous ? pts.concat(...trous.map((h) => h.pts)) : pts, U = trous ? uv.concat(...trous.map((h) => h.uv)) : uv;
  grandir(T, idx.length * NF);
  const F = T.a, pl = plein ? 2 : 0;
  let n = T.n;
  for (const i of idx) {
    const p = P[i], q = U[i], w = (vits && vits[i]) || vit;
    F[n++] = p[0]; F[n++] = p[1]; F[n++] = p[2]; F[n++] = q[0]; F[n++] = q[1];
    F[n++] = (tons && tons[i] !== undefined ? tons[i] : ton) + pl; F[n++] = peint; F[n++] = creux; F[n++] = 0;
    F[n++] = w ? w[0] : 0; F[n++] = w ? w[1] : 0; F[n++] = w ? w[2] || 0 : 0;
  }
  T.n = n;
}
// écrit une arête vue : a, b dans le monde, largeur en px CSS, couleur 0 (encre), 1 (trait clair) ou 2 (papier), normale de
// sa face (zéro : aucun biais de pente), plafond du biais de profondeur (mm), tirets (trait mixte) et opacité
function ecrireArete(T, a, b, w, c, nrm, biaisMax = 30, tiret = 0, alpha = 1) {
  grandir(T, 6 * NA);
  const A = T.a; let n = T.n;
  for (let s = 0; s < 6; s++) {
    const t = s === 1 || s === 2 || s === 4 ? 1 : 0, sd = s === 2 || s === 4 || s === 5 ? 1 : -1;
    A[n++] = a[0]; A[n++] = a[1]; A[n++] = a[2]; A[n++] = b[0]; A[n++] = b[1]; A[n++] = b[2];
    A[n++] = t; A[n++] = sd; A[n++] = w; A[n++] = c; A[n++] = biaisMax; A[n++] = nrm[0]; A[n++] = nrm[1]; A[n++] = nrm[2];
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
export function createTrace(canvas, { dprMax = 2, couleurs, aplat = 0.85, ep = [0.05, 0.92] } = {}) {
  let gl = null;
  try { gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true }); } catch { gl = null; }
  if (!gl) return null;
  let lost = false, pF, pA, uF = {}, uA = {};
  const col = {};
  const setCouleurs = (c) => { for (const k of ['fond', 'trait0', 'trait1']) col[k] = rgb(c[k]); col.encre = rgb(c.trait1); col.trait2 = rgb(c.trait0); };
  setCouleurs(couleurs);
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
    const [p, attrs, N] = L.arete ? [pA, [['aA', 3, 0], ['aB', 3, 3], ['aK', 2, 6], ['aE', 3, 8], ['aN', 3, 11], ['aX', 2, 14]], NA] : [pF, [['aPos', 3, 0], ['aUv', 2, 3], ['aTon', 2, 5], ['aDep', 2, 7], ['aVit', 3, 9]], NF];
    for (const [nm, s, o] of attrs) { const l = gl.getAttribLocation(p, nm); if (l < 0) continue; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, s, gl.FLOAT, false, N * 4, o * 4); }
    if (L.data) gl.bufferData(gl.ARRAY_BUFFER, L.data, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }
  const lot = (arete, data = null) => { const L = { arete, data, n: data ? data.length / (arete ? NA : NF) : 0 }; lots.push(L); if (!lost) lotGL(L); return L; };
  function init() {
    pF = prog(VS_FACE, FS_FACE); pA = prog(VS_ARETE, FS_ARETE);
    for (const k of ['uT', 'uR', 'uU', 'uF', 'uVcam', 'uOff', 'uVitI', 'uS', 'uZ', 'uK', 'uVitE', 'uNF', 'uCtr', 'uRes', 'uPas', 'uDt', 'uDpr', 'uAplat', 'uEp', 'uFond', 'uTrait0', 'uTrait1', 'uNC', 'uGrainActif', 'uCP', 'uCPe', 'uCT0', 'uCT1', 'uCPl', 'uDepA', 'uDepB', 'uGrain']) uF[k] = gl.getUniformLocation(pF, k);
    for (const k of ['uT', 'uR', 'uU', 'uF', 'uOff', 'uS', 'uZ', 'uK', 'uNF', 'uDpr', 'uCtr', 'uRes', 'uEncre', 'uTrait2', 'uFond', 'uTirets']) uA[k] = gl.getUniformLocation(pA, k);
    for (const L of lots) lotGL(L);
  }
  try { init(); } catch (e) { console.warn('trace-dvp', e); return null; }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { try { init(); lost = false; } catch { lost = true; } });

  // la part dynamique de chaque image (la pièce), réécrite à chaque image dans les mêmes tampons
  const dynF = tampon(NF * 4000), dynA = tampon(NA * 6 * 1000);
  const lotF = lot(false), lotA = lot(true);
  let vue = null, inst = [];
  const mesCles = new Set();

  return {
    get mode() { return lost ? 'perdu' : 'gl'; },
    rampe: (hex) => rampe(col, hex),
    // un maillage fixe, envoyé une fois : faces [{ pts, uv, ton, trous?, tons?, aretes?: [[a, b, largeur, couleur, tiret?, alpha?]…], n }]
    maille(faces) {
      const tf = tampon(NF * 512), ta = tampon(NA * 6 * 128);
      for (const f of faces) {
        if (f.pts && f.pts.length) ecrireFace(tf, f.pts, f.uv, f.ton, { trous: f.trous, tons: f.tons, cle: f.cle, plein: f.plein });
        for (const [a, b, w, c, ti = 0, al = 1] of f.aretes || []) ecrireArete(ta, a, b, w, c, f.n || [0, 0, 0], 30, ti, al);
      }
      return { f: lot(false, tf.a.slice(0, tf.n)), a: lot(true, ta.a.slice(0, ta.n)) };
    },
    // vue : { W, H (px CSS), dpr?, cam: { t, r, u, f } (axonométrique) ou { eye, r, u, f, k } avec persp: true et nf: [près, loin] (mm),
    // s (px CSS par mm ; en perspective, facteur d'échelle de la projection), cx, cy, pas (mm par ligne), dt (ms d'obturation),
    // vitEcran (vitesses des faces déjà à l'écran, px CSS par ms), tirets ([long, jour, court, jour] px CSS),
    // couches ([{ teinte, mode: 0 entière | 1 passes | 2 d'un geste, prog, de?, mel? }], la première dessous ; six au plus),
    // depot ({ v0, dv, sv, n, u0, u1, k, su } en mm de matière), grain ([grain fin, nuage] en mm, mordant de 0 à 1) }
    begin(v) { vue = v; dynF.n = 0; dynA.n = 0; inst = []; },
    instance(m, off, vit = null) { inst.push([m, off, vit || [0, 0, 0]]); },
    face(pts, uv, ton, o) { if (o && o.cle) mesCles.add(o.cle); ecrireFace(dynF, pts, uv, ton, o); },
    arete(a, b, w, c, nrm, biaisMax, tiret, alpha) { ecrireArete(dynA, a, b, w, c, nrm, biaisMax, tiret, alpha); },
    // oublie les triangulations gardées sous un préfixe de clé (une pièce remplacée dans l'outil)
    oublier(prefixe) { for (const k of mesCles) if (k.startsWith(prefixe)) { tris.delete(k); mesCles.delete(k); } },
    end() {
      if (lost || !vue) return false;
      const { W, H } = vue, dpr = vue.dpr || Math.min(dprMax, window.devicePixelRatio || 1);
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
      const cs = (vue.couches || []).slice(-6);
      gl.uniform1i(uF.uNC, cs.length);
      if (cs.length) {
        // une couche jeune dont l'acheteur change la teinte passe de l'une à l'autre (de, mel) au lieu d'en empiler une de plus
        // (de : une teinte, ou un mélange { a, b, m } si la teinte a déjà changé en chemin)
        const rampeDe = (x) => { if (x === null || typeof x === 'string') return rampe(col, x); const a = rampeDe(x.a), b = rampeDe(x.b), mx = (p, q) => p.map((v, i) => v + (q[i] - v) * x.m); return { t0: mx(a.t0, b.t0), t1: mx(a.t1, b.t1), pl: mx(a.pl, b.pl), pe: a.pe + (b.pe - a.pe) * x.m }; };
        const R = cs.map((k) => (k.de === undefined || !(k.mel < 1) ? rampe(col, k.teinte) : rampeDe({ a: k.de, b: k.teinte, m: k.mel })));
        const pad = (a, n) => { const o = new Float32Array(6 * n); a.forEach((v, i) => o.set(v, i * n)); return o; };
        gl.uniform2fv(uF.uCP, pad(cs.map((k) => [k.mode || 0, k.prog || 0]), 2)); gl.uniform1fv(uF.uCPe, pad(R.map((r) => [r.pe]), 1));
        gl.uniform3fv(uF.uCT0, pad(R.map((r) => r.t0), 3)); gl.uniform3fv(uF.uCT1, pad(R.map((r) => r.t1), 3)); gl.uniform3fv(uF.uCPl, pad(R.map((r) => r.pl), 3));
      }
      const dp = vue.depot, gr = vue.grain || [4, 24, 0.35];
      gl.uniform1i(uF.uGrainActif, cs.some((k) => k.mode) ? 1 : 0);
      gl.uniform4f(uF.uDepA, dp ? dp.v0 : 0, dp ? dp.dv : 1, dp ? dp.sv : 1, dp ? dp.n : 0);
      gl.uniform4f(uF.uDepB, dp ? dp.u0 : 0, dp ? dp.u1 : 1, dp ? dp.k : 1, dp ? dp.su : 1);
      gl.uniform3f(uF.uGrain, gr[0], gr[1], gr[2]);
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
      return true;
    },
    destroy() { for (const k of mesCles) tris.delete(k); mesCles.clear(); const ext = gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); },
  };
}
