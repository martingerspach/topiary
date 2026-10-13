// Ourlet · trace : la pièce et le film dessinés en WebGL2, en trame de lignes attachée à la matière
// v11 (film seulement) : la peinture en trois états lisibles. La poudre se dépose en grains attachés à la matière (chaque
// grain a son seuil : le voile se densifie, sans front), elle est mate et plus claire que la teinte, elle pénètre moins
// au fond des creux (cage de Faraday) ; la peinture cuite est une plaque pleine à la teinte, tailles sombres, liseré
// clair et reflet satiné près du bord ; à la sortie du four elle est encore chaude (une nuance d'ambre qui s'éteint).
// L'intérieur du four est une lueur (papier chaud, tailles d'ambre). Deux couleurs de trait de plus : liseré, poudre.
// v9 (film seulement) : solides articulés (rotation par instance, ton calculé selon la normale), arêtes vues décidées dans
// le shader et couchées dans le plan de leur face. Détail plus bas.
// v7 (film seulement) : le dépôt de poudre calculé par exposition aux pistolets (fonction depot du shader de faces).
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
//
// v9 (film seulement) : des solides qui tournent, et des arêtes qui ne transparaissent plus.
// - solides articulés (les bras, le plateau tournant) : un maillage envoyé une fois est posé par une rotation et un décalage
//   (tr.solide) ; son ton n'est plus cuit dans le maillage, il est calculé pour chaque sommet selon sa normale tournée
//   (Lambert, deux faces ; normales lissées sur les cylindres : le trait de la trame s'épaissit en tournant autour du volume,
//   comme une taille de gravure) ; sa trame reste attachée à sa matière (uv de l'objet) ; sa vitesse à l'écran, pour le flou
//   de bougé de la trame, vient de sa pose à l'instant précédent (rotation comprise) ;
// - arêtes vues décidées dans le shader : une arête est tracée si sa face regarde la caméra ; une génératrice de cylindre
//   seulement en silhouette (sa face regarde la caméra, sa voisine non) ;
// - arêtes dans le plan de leur face : en vue axonométrique, la profondeur de chaque point du trait est celle du plan de sa
//   face à cet endroit (moins 0,35 mm), et non plus celle de l'axe du trait avancée d'un biais proportionnel à la pente ; ce
//   biais (jusqu'à 30 mm sur une face vue de biais) faisait passer l'arête de la matrice devant la tôle posée dessus.
//
// Usage : const tr = createTrace(canvas, opts) (null sans WebGL2) ; const m = tr.maille(faces) ;
// à chaque image : tr.begin(vue) ; tr.instance(m, décalage, vitesse) ; tr.solide(m, pose, pose d'avant, pas) ; tr.face(…) ;
// tr.arete(…) ; tr.end().

const VS_FACE = `#version 300 es
in vec3 aPos; in vec2 aUv; in vec2 aTon; in vec2 aCut; in vec3 aVit; in vec3 aNrm;
uniform vec3 uT, uR, uU, uF, uVcam, uOff, uVitI, uOffp, uLum; uniform mat3 uM, uMp;
uniform float uS, uZ, uK, uVitE, uRig, uAmb; uniform vec2 uCtr, uRes, uNF;
out vec2 vUv; out vec2 vTon; out vec2 vCut; out float vX; out vec2 vVit; out float vZ;
void main() {
  vec3 w0 = uM * aPos + uOff, d = w0 - uT;
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
  // ton : cuit dans le sommet (normale nulle : la pièce, les ombres), ou calculé selon la normale tournée ; aTon.x porte
  // alors la part du groupe (outil, sol…), plus 2 pour une face pleine ; une normale de longueur 2 est lissée (cylindre) :
  // pas d'éclairage à deux faces pour elle (le dos d'un cylindre n'est jamais vu)
  float ton = aTon.x, l2 = dot(aNrm, aNrm);
  if (l2 > 0.25) {
    float pl = step(1.5, ton); ton -= 2.0 * pl;
    vec3 n = normalize(uM * aNrm); float ndl = dot(n, uLum);
    if (l2 < 2.0 && dot(n, uF) > 0.0) ndl = -ndl;
    ton = clamp((1.0 - (uAmb + (1.0 - uAmb) * max(0.0, ndl))) * ton, 0.0, 1.0) + 2.0 * pl;
  }
  vUv = aUv; vTon = vec2(ton, aTon.y); vCut = aCut; vX = w0.x; vZ = w0.z;
  if (uVitE > 0.5) vVit = aVit.xy;                  // vitesse à l'écran fournie (px CSS par ms)
  else {
    // vitesse du monde : celle du sommet, celle de l'instance, et pour un solide articulé l'écart à sa pose d'avant (uRig = 1 / pas)
    vec3 w = aVit + uVitI - uVcam + (w0 - (uMp * aPos + uOffp)) * uRig;
    vVit = vec2(dot(w, uR), -dot(w, uU)) * uS;
  }
}`;

const FS_FACE = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vTon; in vec2 vCut; in float vX; in vec2 vVit; in float vZ;
uniform vec4 uDep, uRec, uRec2;
uniform float uPas, uDt, uDpr, uAplat; uniform vec2 uEp;
uniform vec3 uFond, uTrait0, uTrait1, uTeinte0, uTeinte1, uPlaque;
uniform int uNC; uniform float uFront[4], uCPe[4]; uniform vec3 uCT0[4], uCT1[4], uCPl[4];
uniform vec3 uPdr, uPdrT, uCuitP, uCuitT, uChaud, uAmbre, uDemi, uSatin; uniform float uChaleur, uGrain;
out vec4 o;
float hach(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// intégrale d'un motif de lignes de largeur wf (part du pas), centrées sur k + 1/2
float C(float x, float wf) { return floor(x) * wf + clamp(fract(x) - 0.5 + 0.5 * wf, 0.0, wf); }
// v7 · le dépôt de poudre (film) : exposition cumulée d'un point de la matière aux pistolets d'un élévateur. La pièce défile
// à vitesse constante (uDep.y) devant le poste (vCut.x) ; l'empreinte d'un pistolet est une gaussienne (uDep.w en x, uRec.w en z) ;
// les deux pistolets (écart uRec2.x) montent et descendent sur l'élévateur (centre uRec.x, course uRec.y, période uRec.z,
// triangle aux retournements arrondis). Intégrale le long du passage (16 points qui suivent le point : aucune bande fixe),
// puis saturation (uRec2.y) : la couche fonce selon l'exposition, progressivement, sans front.
float depot(float x, float z, float w) {
  float xg = vCut.x, sx = uDep.w, lo = xg - 1.7 * sx, hi = min(x, xg + 1.7 * sx);   // v11 : l'empreinte du cône (la poudre ne précède pas les grains)
  if (hi <= lo) return 0.0;
  float dx = (hi - lo) / 16.0, acc = 0.0;
  for (int i = 0; i < 16; i++) {
    float xp = lo + (float(i) + 0.5) * dx;
    float ph = 6.2831853 * (uDep.z - (x - xp) / uDep.y) / uRec.z;
    float zg = uRec.x + uRec.y * asin(0.98 * sin(ph)) * 0.7303;      // 1 / asin(0.98)
    float ex = (xp - xg) / sx, e0 = (z - zg) / uRec.w, e1 = (z - zg - uRec2.x) / uRec.w;
    acc += exp(-0.5 * ex * ex) * (exp(-0.5 * e0 * e0) + exp(-0.5 * e1 * e1));
  }
  return 1.0 - exp(-uRec2.y * w * acc * dx / (sx * 2.5066283));
}
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
  vec2 gq = vUv / uGrain; float fwg = max(fwidth(gq.x), fwidth(gq.y));   // grains de poudre par pixel
  float hp = max(abs(vUv.x) - uDemi.x, abs(vUv.y) - uDemi.y);            // hauteur sur une paroi (0 au pli, uDemi.z au bord)
  if (!plein) {
    float mb = abs(dot(vVit * uDt, g * uDpr));     // lignes balayées pendant l'obturation
    float D = max(fw, mb);
    cov = (C(s + 0.5 * D, wf) - C(s - 0.5 * D, wf)) / D;
  }
  vec3 trait = mix(uTrait0, uTrait1, ton), sous = uFond;
  if (uNC > 0) {
    // couches de peinture à l'écran (premier écran, outil) : chacune recouvre la précédente à gauche de son front
    float xs = gl_FragCoord.x, peint = 0.0;
    vec3 t0 = uTrait0, t1 = uTrait1, pl = uFond;
    for (int i = 0; i < 4; i++) {
      if (i >= uNC) break;
      float c = clamp(uFront[i] * uDpr - xs + 0.5, 0.0, 1.0);
      t0 = mix(t0, uCT0[i], c); t1 = mix(t1, uCT1[i], c); pl = mix(pl, uCPl[i], c); peint = mix(peint, uCPe[i], c);
    }
    peint *= vTon.y;
    trait = mix(trait, mix(t0, t1, ton), peint); sous = mix(uFond, pl, uAplat * peint);
  } else if (vTon.y > 3.5) {
    // l'intérieur du four : papier chaud, tailles d'ambre (le ton de la face dit la profondeur)
    trait = uAmbre; sous = mix(uFond, uChaud, 0.9);
  } else if (vTon.y > 1.5) {
    // peinture cuite : plaque pleine, tailles sombres ; un reflet satiné court le long du bord ; chaude à la sortie du four
    float e = (hp - uSatin.z) / uSatin.y, sat = uSatin.x * exp(-e * e) * (1.0 - uChaleur);
    trait = mix(mix(uCuitT, uCuitP, min(1.0, 2.0 * sat)), uAmbre, 0.42 * uChaleur * uChaleur);   // chaude : ses tailles rougeoient
    sous = mix(mix(uCuitP, uFond, sat), uAmbre, 0.04 * uChaleur);
  } else if (vTon.y > 0.0) {
    // poudre : l'exposition cumulée aux pistolets (moindre au fond des creux), puis un grain par cellule de la matière,
    // chacun avec son seuil ; quand les cellules passent sous le pixel, le voile moyen
    float w = vTon.y < 0.9 ? vTon.y * mix(0.5, 1.0, clamp(hp / uDemi.z, 0.0, 1.0)) : 1.0;
    float d = uDep.y > 0.0 ? depot(vX, vZ, w) : 1.0;
    float r = hach(floor(gq)), g = smoothstep(r * 0.8 - 0.1, r * 0.8 + 0.1, d);
    g = mix(g, smoothstep(0.0, 0.9, d), clamp((fwg - 0.45) / 0.4, 0.0, 1.0));
    trait = mix(trait, uPdrT, g); sous = mix(uFond, uPdr, g);
  }
  o = vec4(mix(sous, trait, cov), 1.0);
}`;

const VS_ARETE = `#version 300 es
in vec3 aA; in vec3 aB; in vec2 aK; in vec3 aE; in vec3 aN; in vec2 aX; in vec3 aN2;
uniform vec3 uT, uR, uU, uF, uOff; uniform mat3 uM; uniform float uS, uZ, uDpr, uK; uniform vec2 uCtr, uRes, uNF;
out float vD; out float vW; out float vC; out float vX; out float vCut; out float vS; out float vTir; out float vAl;
vec3 vue(vec3 P) { vec3 d = P - uT; return vec3(dot(d, uR), dot(d, uU), dot(d, uF)); }
vec2 ecran(vec3 c) { return uK > 0.0 ? uCtr + vec2(c.x, -c.y) * (uK / c.z) * uS : uCtr + vec2(c.x, -c.y) * uS; }
void main() {
  vec3 A = uM * aA + uOff, B = uM * aB + uOff, ca = vue(A), cb = vue(B);
  vec2 pa = ecran(ca), pb = ecran(cb);
  vec2 dir = pb - pa; float L = length(dir); dir = L > 1e-4 ? dir / L : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  float w = aE.x, h = 0.5 * w + 1.0 / uDpr;         // demi-largeur, plus un pixel physique pour l'anticrénelage
  float ext = (aK.x * 2.0 - 1.0) * h * 0.5;
  vec2 o = dir * ext + n * aK.y * h;                // écart de ce sommet à l'axe du trait (px CSS, y vers le bas)
  vec2 p = mix(pa, pb, aK.x) + o;
  vec3 n1 = uM * aN, c = mix(ca, cb, aK.x), nv = vec3(dot(n1, uR), dot(n1, uU), dot(n1, uF));
  bool orientee = dot(aN, aN) > 0.25;
  float zn;
  if (uK > 0.0) {
    // perspective (premier écran, outil) : biais de profondeur selon la pente de la face (mm par px) et la demi-largeur du trait
    vec3 vd = normalize(c);
    float nz = abs(dot(nv, vd)), nxy = length(nv - vd * dot(nv, vd));
    float biais = min(30.0, 0.3 + nxy / max(nz, 0.04) * c.z / (uK * uS) * (0.5 * w + 1.2)), zb = c.z - biais;
    zn = (uNF.y + uNF.x) / (uNF.y - uNF.x) - 2.0 * uNF.y * uNF.x / ((uNF.y - uNF.x) * zb);
  } else {
    // axonométrie (le film). Arête vue : sa face regarde la caméra ; une génératrice (aN2 : la face voisine) seulement en silhouette
    if (orientee && (nv.z >= 0.0 || (dot(aN2, aN2) > 0.25 && dot(uM * aN2, uF) < 0.0))) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    // le trait est couché dans le plan de sa face : profondeur du plan à cet écart de l'axe, moins 0,35 mm
    float ez = orientee ? clamp((nv.x * o.x - nv.y * o.y) / (uS * max(-nv.z, 0.05)), -40.0, 40.0) : 0.0;
    zn = (c.z + ez - 0.35) / uZ;
  }
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, zn, 1.0);
  vD = aK.y * h; vW = w; vC = aE.y; vX = mix(A.x, B.x, aK.x); vCut = aE.z;
  vS = aK.x * L + ext; vTir = aX.x; vAl = aX.y;
}`;

const FS_ARETE = `#version 300 es
precision highp float;
in float vD; in float vW; in float vC; in float vX; in float vCut; in float vS; in float vTir; in float vAl;
uniform float uDpr; uniform vec3 uEncre, uTrait2, uFond, uChaud, uEtinc, uAmbre, uLisere, uPoudre; uniform vec4 uTirets;
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
  // couleurs : 0 encre, 1 trait clair, 2 papier, puis les lumières chaudes : 3 cœur de l'arc, 4 étincelle, 5 ambre ;
  // v11 : 6 liseré de la peinture cuite, 7 grain de poudre
  vec3 c = vC < 0.5 ? uEncre : vC < 1.5 ? uTrait2 : vC < 2.5 ? uFond : vC < 3.5 ? uChaud : vC < 4.5 ? uEtinc : vC < 5.5 ? uAmbre : vC < 6.5 ? uLisere : uPoudre;
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

const ID = [1, 0, 0, 0, 1, 0, 0, 0, 1];
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
// flottants par sommet : faces (pos 3, uv 2, ton 2, coupe 2, vitesse 3, et pour un maillage fixe sa normale 3),
// arêtes (a 3, b 3, k 2, e 3, n 3, x 2, n2 3)
const NF = 12, NFN = 15, NA = 19;
const tampon = (n, nrm = false) => ({ a: new Float32Array(n), n: 0, nrm });
const grandir = (t, k) => { if (t.n + k > t.a.length) { const G = new Float32Array(Math.max(t.a.length * 2, t.n + k)); G.set(t.a.subarray(0, t.n)); t.a = G; } };
const tris = new Map(); // triangulations gardées par clé (un polygone qui ne change que par mouvement rigide ou affine)
// écrit une face plane : pts [[x,y,z]…], uv [[u,v]…] en mm dans la matière (lignes le long de u), trous { pts, uv }
// plein : la face prend le ton moyen de la trame (chants, arrondis : plus fins qu'une ligne)
// nrm : la normale de la face (le ton est alors calculé dans le shader, `ton` étant la part du groupe) ; nrms : une normale
// par sommet (surface lissée) ; sans normale, le ton écrit est le ton final. Les normales ne sont écrites que dans un
// tampon de maillage fixe (T.nrm).
function ecrireFace(T, pts, uv, ton, { trous = null, tons = null, peint = 0, cut = null, vit = null, vits = null, cle = null, plein = false, nrm = null, nrms = null } = {}) {
  let idx = cle ? tris.get(cle) : null;
  if (!idx) {
    if (!trous && convexe(uv)) { idx = []; for (let k = 1; k + 1 < pts.length; k++) idx.push(0, k, k + 1); }
    else idx = trianguler(uv, trous ? trous.map((h) => h.uv) : []);
    if (cle && Math.abs(aire(uv, uv.map((_, i) => i))) > 1) tris.set(cle, idx); // une pose dégénérée (face vue de chant) n'est pas gardée
  }
  const P = trous ? pts.concat(...trous.map((h) => h.pts)) : pts, U = trous ? uv.concat(...trous.map((h) => h.uv)) : uv;
  const N = T.nrm ? NFN : NF;
  grandir(T, idx.length * N);
  const F = T.a, c0 = cut ? cut[0] : 1e9, c1 = cut ? cut[1] : 1e9, pl = plein ? 2 : 0;
  let n = T.n;
  for (const i of idx) {
    const p = P[i], q = U[i], w = (vits && vits[i]) || vit;
    F[n++] = p[0]; F[n++] = p[1]; F[n++] = p[2]; F[n++] = q[0]; F[n++] = q[1];
    F[n++] = (tons && tons[i] !== undefined ? tons[i] : ton) + pl; F[n++] = peint; F[n++] = c0; F[n++] = c1;
    F[n++] = w ? w[0] : 0; F[n++] = w ? w[1] : 0; F[n++] = w ? w[2] || 0 : 0;
    if (T.nrm) { const m = nrms && nrms[i] ? nrms[i] : nrm, k = nrms && nrms[i] ? 2 : 1; F[n++] = m ? m[0] * k : 0; F[n++] = m ? m[1] * k : 0; F[n++] = m ? m[2] * k : 0; }
  }
  T.n = n;
}
// écrit une arête vue : a, b dans le monde, largeur en px CSS, couleur 0 (encre), 1 (trait clair) ou 2 (papier), normale de
// sa face (zéro : toujours tracée, sans pente), coupe en x, tirets (trait mixte), opacité, et normale de la face voisine
// pour une arête qui n'est tracée qu'en silhouette (génératrice de cylindre)
const ZERO = [0, 0, 0];
function ecrireArete(T, a, b, w, c, nrm, cutX = 1e9, tiret = 0, alpha = 1, n2 = null) {
  grandir(T, 6 * NA);
  const A = T.a, m = n2 || ZERO; let n = T.n;
  for (let s = 0; s < 6; s++) {
    const t = s === 1 || s === 2 || s === 4 ? 1 : 0, sd = s === 2 || s === 4 || s === 5 ? 1 : -1;
    A[n++] = a[0]; A[n++] = a[1]; A[n++] = a[2]; A[n++] = b[0]; A[n++] = b[1]; A[n++] = b[2];
    A[n++] = t; A[n++] = sd; A[n++] = w; A[n++] = c; A[n++] = cutX; A[n++] = nrm[0]; A[n++] = nrm[1]; A[n++] = nrm[2];
    A[n++] = tiret; A[n++] = alpha; A[n++] = m[0]; A[n++] = m[1]; A[n++] = m[2];
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
// lum : direction de la lumière (unitaire) ; amb : part d'ambiance (Lambert) : le ton des maillages se calcule dans le shader
// chauds : les trois lumières chaudes des tracés ([cœur de l'arc, étincelle, ambre], en hexadécimal)
// peinture (film) : { poudre, plaque, lisere (parts de papier dans la poudre, la plaque cuite, le liseré), taille (part d'encre
// dans les tailles de la peinture cuite), satin [part, demi-largeur mm, hauteur mm], grain (mm), demi [A / 2, B / 2, hauteur] }
export function createTrace(canvas, { dprMax = 2, couleurs, teinte = null, aplat = 0.85, ep = [0.05, 0.92], lum = [-0.8, -0.35, 0.55], amb = 0.24, chauds = null, peinture = null } = {}) {
  let gl = null;
  try { gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true }); } catch { gl = null; }
  if (!gl) return null;
  let lost = false, pF, pA, pB, uF = {}, uA = {}, uB = {}, triBuf = null, triVao = null;
  const col = {};
  const setCouleurs = (c) => { for (const k of ['fond', 'trait0', 'trait1']) col[k] = rgb(c[k]); col.encre = rgb(c.trait1); col.trait2 = rgb(c.trait0); };
  setCouleurs(couleurs);
  function setTeinte(hex) { const r = rampe(col, hex); col.teinte0 = r.t0; col.teinte1 = r.t1; col.plaque = r.pl; }
  setTeinte(teinte);
  const PE = { poudre: 0.34, plaque: 0.07, lisere: 0.6, taille: 0.6, satin: [0.2, 42, 250], grain: 5.2, demi: [1e6, 1e6, 300], ...(peinture || {}) };
  const melC = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k), TT = teinte ? rgb(teinte) : col.encre, LC = (chauds || []).map(rgb);
  const TE = { pdr: melC(TT, col.fond, PE.poudre), pdrT: melC(TT, col.fond, PE.poudre * 0.3), cuitP: melC(TT, col.fond, PE.plaque), cuitT: melC(TT, col.encre, PE.taille), lisere: melC(TT, col.fond, PE.lisere) };
  // attr0 : l'attribut rangé à l'emplacement 0 (toujours fourni par un tableau : la normale, elle, manque aux faces de la pièce)
  function prog(vs, fs, attr0 = null) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); if (attr0) gl.bindAttribLocation(p, 0, attr0); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  // un lot de sommets sur la carte : faces ou arêtes, avec son tableau d'attributs
  const lots = [];
  function lotGL(L) {
    L.buf = gl.createBuffer(); L.vao = gl.createVertexArray(); gl.bindVertexArray(L.vao); gl.bindBuffer(gl.ARRAY_BUFFER, L.buf);
    const [p, attrs, N] = L.arete ? [pA, [['aA', 3, 0], ['aB', 3, 3], ['aK', 2, 6], ['aE', 3, 8], ['aN', 3, 11], ['aX', 2, 14], ['aN2', 3, 16]], NA]
      : [pF, [['aPos', 3, 0], ['aUv', 2, 3], ['aTon', 2, 5], ['aCut', 2, 7], ['aVit', 3, 9], ...(L.nrm ? [['aNrm', 3, 12]] : [])], L.nrm ? NFN : NF];
    for (const [nm, s, o] of attrs) { const l = gl.getAttribLocation(p, nm); if (l < 0) continue; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, s, gl.FLOAT, false, N * 4, o * 4); }
    if (!L.arete && !L.nrm) { const l = gl.getAttribLocation(pF, 'aNrm'); if (l >= 0) { gl.disableVertexAttribArray(l); gl.vertexAttrib3f(l, 0, 0, 0); } } // sans tableau : normale nulle, ton cuit
    if (L.data) gl.bufferData(gl.ARRAY_BUFFER, L.data, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }
  const lot = (arete, data = null, nrm = false) => { const L = { arete, data, nrm, n: data ? data.length / (arete ? NA : nrm ? NFN : NF) : 0 }; lots.push(L); if (!lost) lotGL(L); return L; };
  function init() {
    pF = prog(VS_FACE, FS_FACE, 'aPos'); pA = prog(VS_ARETE, FS_ARETE, 'aA'); pB = prog(VS_PLEIN, FS_FLOU);
    for (const k of ['uT', 'uR', 'uU', 'uF', 'uVcam', 'uOff', 'uVitI', 'uOffp', 'uLum', 'uM', 'uMp', 'uRig', 'uAmb', 'uS', 'uZ', 'uK', 'uVitE', 'uNF', 'uCtr', 'uRes', 'uPas', 'uDt', 'uDpr', 'uAplat', 'uEp', 'uFond', 'uTrait0', 'uTrait1', 'uTeinte0', 'uTeinte1', 'uPlaque', 'uNC', 'uFront', 'uCPe', 'uCT0', 'uCT1', 'uCPl', 'uDep', 'uRec', 'uRec2', 'uPdr', 'uPdrT', 'uCuitP', 'uCuitT', 'uChaud', 'uAmbre', 'uDemi', 'uSatin', 'uChaleur', 'uGrain']) uF[k] = gl.getUniformLocation(pF, k);
    for (const k of ['uT', 'uR', 'uU', 'uF', 'uOff', 'uM', 'uS', 'uZ', 'uK', 'uNF', 'uDpr', 'uCtr', 'uRes', 'uEncre', 'uTrait2', 'uFond', 'uChaud', 'uEtinc', 'uAmbre', 'uLisere', 'uPoudre', 'uTirets']) uA[k] = gl.getUniformLocation(pA, k);
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
    // v9 : n (normale de la face : le ton est calculé selon elle, `ton` est alors la part du groupe ; sans n, le ton est
    // cuit), nrms (normales par sommet, surface lissée), na (normale des arêtes, si la face n'a pas de n) ;
    // arête : [a, b, largeur, couleur, tiret?, alpha?, normale de la face voisine (arête tracée seulement en silhouette)?]
    maille(faces) {
      const tf = tampon(NFN * 512, true), ta = tampon(NA * 6 * 128);
      for (const f of faces) {
        ecrireFace(tf, f.pts, f.uv, f.ton, { trous: f.trous, tons: f.tons, cle: f.cle, plein: f.plein, nrm: f.n, nrms: f.nrms, peint: f.peint || 0 });
        for (const [a, b, w, c, ti = 0, al = 1, n2 = null] of f.aretes || []) ecrireArete(ta, a, b, w, c, f.na || f.n || ZERO, 1e9, ti, al, n2);
      }
      return { f: lot(false, tf.a.slice(0, tf.n), true), a: lot(true, ta.a.slice(0, ta.n)) };
    },
    // vue : { W, H (px CSS), cam: { t, r, u, f } (axonométrique) ou { eye, r, u, f, k } avec persp: true et nf: [près, loin] (mm),
    // s (px CSS par mm ; en perspective, facteur d'échelle de la projection), cx, cy, pas (mm par ligne), dt (ms d'obturation),
    // vcam (mm/ms), vitEcran (vitesses des faces déjà à l'écran, px CSS par ms), couches ([{ front (px CSS), teinte }]),
    // tirets ([long, jour, court, jour] px CSS), flou ([dx, dy] px CSS : déplacement de la caméra pendant l'obturation) }
    begin(v) { vue = v; dynF.n = 0; dynA.n = 0; inst = []; },
    instance(m, off, vit = null) { inst.push([m, off, vit || ZERO, null, null, null, 0]); },
    // un solide articulé : sa pose { R (rotation 3 × 3 rangée par lignes), p }, sa pose à l'instant d'avant (pour sa vitesse
    // à l'écran) et l'écart de temps entre les deux (ms)
    solide(m, pose, avant = null, pas = 0) { inst.push([m, pose.p, ZERO, pose.R, avant ? avant.R : pose.R, avant ? avant.p : pose.p, avant && pas > 0 ? 1 / pas : 0]); },
    face(pts, uv, ton, o) { if (o && o.cle) mesCles.add(o.cle); ecrireFace(dynF, pts, uv, ton, o); },
    arete(a, b, w, c, nrm, cutX, tiret, alpha, n2) { ecrireArete(dynA, a, b, w, c, nrm, cutX, tiret, alpha, n2); },
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
      gl.uniform1f(uF.uAplat, aplat); gl.uniform2f(uF.uEp, ep[0], ep[1]); gl.uniform3fv(uF.uLum, lum); gl.uniform1f(uF.uAmb, amb);
      const dp = vue.depot; // v7 : { v, t, sx, zc, course, per, sz, ecart, k } (le dépôt de poudre) ; absent : le rideau net
      gl.uniform4f(uF.uDep, 0, dp ? dp.v : 0, dp ? dp.t : 0, dp ? dp.sx : 1); gl.uniform4f(uF.uRec, dp ? dp.zc : 0, dp ? dp.course : 0, dp ? dp.per : 1, dp ? dp.sz : 1); gl.uniform4f(uF.uRec2, dp ? dp.ecart : 0, dp ? dp.k : 0, 0, 0);
      gl.uniform3fv(uF.uFond, col.fond); gl.uniform3fv(uF.uTrait0, col.trait0); gl.uniform3fv(uF.uTrait1, col.trait1);
      gl.uniform3fv(uF.uTeinte0, col.teinte0); gl.uniform3fv(uF.uTeinte1, col.teinte1); gl.uniform3fv(uF.uPlaque, col.plaque);
      gl.uniform3fv(uF.uPdr, TE.pdr); gl.uniform3fv(uF.uPdrT, TE.pdrT); gl.uniform3fv(uF.uCuitP, TE.cuitP); gl.uniform3fv(uF.uCuitT, TE.cuitT);
      gl.uniform3fv(uF.uChaud, LC[0] || col.fond); gl.uniform3fv(uF.uAmbre, LC[2] || col.fond); gl.uniform3fv(uF.uDemi, PE.demi); gl.uniform3fv(uF.uSatin, PE.satin);
      gl.uniform1f(uF.uGrain, PE.grain); gl.uniform1f(uF.uChaleur, 0);
      const cs = (vue.couches || []).slice(-4);
      gl.uniform1i(uF.uNC, cs.length);
      if (cs.length) {
        const R = cs.map((k) => k.rampe || rampe(col, k.teinte));
        const pad = (a, n) => { const o = new Float32Array(4 * n); a.forEach((v, i) => o.set(v, i * n)); return o; };
        gl.uniform1fv(uF.uFront, pad(cs.map((k) => [k.front]), 1)); gl.uniform1fv(uF.uCPe, pad(R.map((r) => [r.pe]), 1));
        gl.uniform3fv(uF.uCT0, pad(R.map((r) => r.t0), 3)); gl.uniform3fv(uF.uCT1, pad(R.map((r) => r.t1), 3)); gl.uniform3fv(uF.uCPl, pad(R.map((r) => r.pl), 3));
      }
      const tracer = (L) => { if (!L.n) return; gl.bindVertexArray(L.vao); gl.drawArrays(gl.TRIANGLES, 0, L.n); };
      // les matrices sont rangées par lignes : transposées à l'envoi
      const fixe = (u) => { gl.uniformMatrix3fv(u.uM, true, ID); if (u.uMp) { gl.uniformMatrix3fv(u.uMp, true, ID); gl.uniform3f(u.uOffp, 0, 0, 0); gl.uniform1f(u.uRig, 0); } };
      let tourne = true;
      for (const [m, off, vit, M, Mp, offp, rig] of inst) {
        if (!m.f.n) continue;
        gl.uniform3fv(uF.uOff, off); gl.uniform3fv(uF.uVitI, vit);
        if (M) { gl.uniformMatrix3fv(uF.uM, true, M); gl.uniformMatrix3fv(uF.uMp, true, Mp); gl.uniform3fv(uF.uOffp, offp); gl.uniform1f(uF.uRig, rig); tourne = true; }
        else if (tourne) { fixe(uF); tourne = false; }
        tracer(m.f);
      }
      // la part dynamique : la pièce (chaude à la sortie du four : vue.chaleur, de 0 à 1)
      fixe(uF); gl.uniform3f(uF.uOff, 0, 0, 0); gl.uniform3f(uF.uVitI, 0, 0, 0); gl.uniform1f(uF.uChaleur, vue.chaleur || 0); tracer(lotF);
      // arêtes vues : testées contre la profondeur des faces, sans l'écrire
      gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(pA); commun(uA); gl.uniform3fv(uA.uEncre, col.encre); gl.uniform3fv(uA.uTrait2, col.trait2); gl.uniform3fv(uA.uFond, col.fond);
      gl.uniform3fv(uA.uChaud, LC[0] || col.fond); gl.uniform3fv(uA.uEtinc, LC[1] || col.fond); gl.uniform3fv(uA.uAmbre, LC[2] || col.fond); gl.uniform3fv(uA.uLisere, TE.lisere); gl.uniform3fv(uA.uPoudre, TT);
      const ti = vue.tirets || [14, 3, 2, 3]; gl.uniform4f(uA.uTirets, ti[0], ti[1], ti[2], ti[3]);
      tourne = true;
      for (const [m, off, , M] of inst) {
        if (!m.a.n) continue;
        gl.uniform3fv(uA.uOff, off);
        if (M) { gl.uniformMatrix3fv(uA.uM, true, M); tourne = true; } else if (tourne) { fixe(uA); tourne = false; }
        tracer(m.a);
      }
      fixe(uA); gl.uniform3f(uA.uOff, 0, 0, 0); tracer(lotA);
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
