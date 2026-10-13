// Ourlet · plaque du pied de page : une tôle d'acier brossé teintée grège, le nom découpé au laser, l'ourlet du L plié à la presse.
// Références :
//  - reflet anisotrope de Ward (G. Ward, « Measuring and modeling anisotropic reflection », 1992 ; Kajiya-Kay en est le
//    cousin pour les fibres) : le reflet s'étire perpendiculairement au brossage ;
//  - plaques signalétiques de machines : intitulés et valeurs alignés sur filets fins, posés sur une zone calme ;
//  - découpe laser : la saignée a une tranche (un chanfrein de 1,2 à 2,5 px) qui accroche la lumière ; par les lettres, on voit la
//    contre-plaque, avec l'ombre du bord. La languette du L, laissée par la découpe, bascule sous la presse et le reflet la suit.
// Sous [data-calme], chaque canal est comprimé sous charbon-800 : givre-2 y garde 7,86:1 quel que soit le reflet.
// Repli (sans WebGL, mouvements réduits, couleurs forcées) : img/plaque-repli.jpg, exportée de ce shader, et le nom en SVG.
import { svgFrame, stateAt, SPREAD0 } from './signature.js';
import { LOGO, HEM } from './marque.js';
import { MOTION, EASE, ticker, onceVisible } from './motion.js';
import { P } from '../tokens/tokens-v2.js';

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;       // canvas, en pixels
uniform float uDpr, uFade, uBevel; // densité ; fondu des zones calmes ; largeur du chanfrein (px CSS)
uniform vec3 uLight;     // lumière : position sur la plaque (px CSS, y vers le bas) et hauteur
uniform vec4 uLogo;      // boîte du tramage du nom (x, y, largeur, hauteur)
uniform vec4 uArc;       // pli : centre de l'arc, direction du retour droit
uniform float uFold;     // pli : 0 à plat, 1 fermé
uniform vec4 uBar;       // tablier de presse (x0, y0, x1, y1)
uniform vec2 uBarF;      // haut de sa face de contact, opacité
uniform vec4 uCalm[6];   // zones calmes (x0, y0, x1, y1)
uniform int uN;
uniform vec3 uCol[6];    // plaque, reflet, contre-plaque, chanfrein, plafond, outil (linéaires)
uniform sampler2D uTex;  // r : tôle (1) ou découpe (0) ; g : languette
out vec4 outColor;

float hash(vec2 p) { uvec2 q = uvec2(ivec2(p) + 8192) * uvec2(1597334673u, 3812015801u); return float((q.x ^ q.y) * 1597334673u) * 2.328306e-10; }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f *= f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y); }
// brossage : stries le long de x, trois octaves
float brush(vec2 p) { return .55 * noise(p / vec2(260, 1.2)) + .3 * noise(p / vec2(44, .6)) + .15 * noise(p / vec2(700, 11)); }
float tole(vec2 u) { return u == clamp(u, 0., 1.) ? texture(uTex, u).r : 1.; }
float inRect(vec2 p, vec4 r, float f) { vec2 e = max(r.xy - p, p - r.zw); return 1. - smoothstep(0., f, max(e.x, e.y)); }
// Ward anisotrope : t = sens du brossage, le reflet s'étire en travers ; E = éclairement reçu (n.l compris)
vec3 metal(vec3 n, vec3 t, vec3 l, float E, float b, vec3 albedo) {
  vec3 h = normalize(l + vec3(0, 0, 1)), bt = cross(n, t);
  float ax = .1 + .06 * b, ay = .7, hn = max(dot(h, n), .05), ht = dot(h, t) / ax, hb = dot(h, bt) / ay;
  float w = exp(-(ht * ht + hb * hb) / (hn * hn)) / (12.57 * ax * ay * sqrt(max(dot(n, l), .02) * max(n.z, .02)));
  return albedo * (.8 + .4 * b) * (.78 + .32 * E) + uCol[1] * w * E * (.4 + 1.2 * b) * .07;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec3 lv = uLight - vec3(p, 0); float d = dot(lv, lv); vec3 l = lv * inversesqrt(d);
  float I = uLight.z * uLight.z / d;
  vec3 c = metal(vec3(0, 0, 1), vec3(1, 0, 0), l, I * l.z, brush(p), uCol[0]);
  vec2 u = (p - uLogo.xy) / uLogo.zw;
  if (u == clamp(u, 0., 1.)) {
    vec4 tx = texture(uTex, u);
    vec2 o = uBevel / uLogo.zw, g = vec2(tole(u + vec2(o.x, 0)) - tole(u - vec2(o.x, 0)), tole(u + vec2(0, o.y)) - tole(u - vec2(0, o.y)));
    float e = length(g);
    // contre-plaque, 10 px derrière : éclairée par la découpe, dans l'ombre du bord
    float s = 1. - tole((p + (uLight.xy - p) * (10. / (uLight.z + 10.)) - uLogo.xy) / uLogo.zw);
    c = mix(uCol[2] * (.55 + .9 * s * I * l.z), c, tx.r);
    // chanfrein : la pente tournée vers le haut reçoit le ciel, celle du dessous reste dans l'ombre ; la lumière accroche le côté qui lui fait face
    if (e > .01) {
      vec2 dh = -g / e;
      float f = max(dot(dh, normalize(uLight.xy - p + 1e-3)), 0.), E = I * max(dot(normalize(vec3(dh, 1.1)), l), 0.);
      c = mix(c, uCol[3] * (.015 + .2 * pow(max(-dh.y, 0.), 1.5) + f * (.1 * E + 1.2 * E * E)), tx.r * smoothstep(.1, .6, e));
    }
    // languette du L : brossée dans sa longueur, elle tourne autour de la ligne de pli et part derrière la plaque. Dans le
    // coude, la bascule croît de la racine au retour droit (un cylindre) ; le reflet de Ward et le ciel glissent le long du
    // pli. Fermée, elle est vue par la tranche et rejoint la découpe.
    if (tx.g > .01) {
      vec2 q = p - uArc.xy; bool droit = dot(q, uArc.zw) > 0.;
      vec2 t = droit ? uArc.zw : normalize(vec2(q.y, -q.x) + 1e-4);
      float a = uFold * 1.5708 * (droit ? 1. : clamp((1.5708 - atan(q.y, q.x)) / max(uFold * 3.1416, 1e-3), 0., 1.));
      vec3 n = vec3(t * sin(a), cos(a));
      float bf = brush(droit ? vec2(dot(q, t), dot(q, vec2(-t.y, t.x))) : vec2(atan(q.y, q.x) * length(q), length(q)));
      vec3 m = metal(n, vec3(t * cos(a), -sin(a)), l, I * max(dot(n, l), 0.), bf, uCol[0]) + uCol[3] * .22 * pow(max(-n.y, 0.), 1.5) * (.6 + .4 * bf);
      c = mix(c, m, tx.g * (1. - smoothstep(.82, 1., uFold)));
    }
  }
  // tablier de presse : un bloc d'acier brossé verticalement, 14 px devant la plaque, avec son ombre
  if (uBarF.y > .01) {
    c *= 1. - .45 * uBarF.y * inRect(p + (uLight.xy - p) * (14. / uLight.z), uBar, 3.);
    float k = inRect(p, uBar, 1.);
    if (k > 0.) {
      bool face = p.y > uBarF.x; vec3 n = face ? vec3(0, .8, .6) : vec3(0, 0, 1), lb = normalize(uLight - vec3(p, 14));
      vec3 m = metal(n, face ? vec3(1, 0, 0) : vec3(0, 1, 0), lb, I * max(dot(n, lb), 0.), brush(p.yx), uCol[5]);
      c = mix(c, m + uCol[3] * .25 * (1. - smoothstep(0., 1.5, p.y - uBar.y)), k * uBarF.y);
    }
  }
  // zones calmes : genou doux, chaque canal reste sous le plafond (charbon-800)
  float z = 0.;
  for (int i = 0; i < 6; i++) { if (i >= uN) break; vec2 e = max(uCalm[i].xy - p, p - uCalm[i].zw); z = max(z, 1. - smoothstep(0., uFade, length(max(e, 0.)))); }
  vec3 cap = uCol[4], j = .6 * cap;
  c = mix(c, min(c, j) + .4 * cap * (1. - exp(-max(c - j, 0.) / (.4 * cap))), z);
  outColor = vec4(pow(c, vec3(1. / 2.2)), 1);
}`;
const VERT = '#version 300 es\nvoid main() { gl_Position = vec4(vec2(gl_VertexID & 1, gl_VertexID >> 1) * 2. - 1., 0, 1); }';
const COULEURS = ['charbon-850', 'greige-400', 'charbon-900', 'greige-300', 'charbon-800', 'charbon-700'];
const UNIFORMES = ['uRes', 'uDpr', 'uFade', 'uBevel', 'uLight', 'uLogo', 'uArc', 'uFold', 'uBar', 'uBarF', 'uCalm', 'uN', 'uCol', 'uTex'];
const [VX, VY, VW, VH] = LOGO.viewBox.split(' ').map(Number);
const MX = SPREAD0 / 2 + 60, MY = 60; // marges du tramage : l'écartement du E et du T, les ombres
const R_PLI = HEM.H / 2, CX_PLI = HEM.Lx + HEM.footEnd - R_PLI; // centre de l'arc du pli, comme dans signature.js
const RE = /<g(?: transform="translate\(([-\d.]+),0\)")?(?: opacity="([\d.]+)")?[^>]*>|<\/g>|<path d="([^"]+)"([^>]*)>|<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)" fill=/g;
const REPOS = 3 * MOTION.rideau.ms; // sans survol : la lumière dérive tant qu'on fait défiler, puis se pose
const plusTard = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 300 }) : setTimeout(fn, 32));
const lineaire = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2);

export function mountPlaque(foot, opts = {}) {
  const mark = foot.querySelector('[data-plaque-logo]'), sig = mark && mark.querySelector('svg'), ds = foot.dataset;
  // phases de la presse (comme la v4) : approche, appui (150°), maintien, approche, appui (180°), retour
  const PR = MOTION.presse, a1 = PR.approche.ms, b1 = a1 + PR.appui.ms, a2 = b1 + PR.maintien.ms, b2 = a2 + a1, c2 = b2 + PR.appui.ms, END = c2 + PR.retour.ms;
  const phases = { p1: [a1, b1], down: [a2, b2], press: [b2, c2], up: [c2, END], tag: [END, END] };
  const eases = { p1: EASE.appui, down: EASE.approche, press: EASE.appui, up: EASE.retour };
  const mqReduit = matchMedia('(prefers-reduced-motion: reduce)'), mqForce = matchMedia('(forced-colors: active)');
  const mode = opts.light ? 0 : matchMedia('(hover: hover) and (pointer: fine)').matches ? 1 : 2; // fixe, pointeur, dérive
  let reduit = mqReduit.matches, force = mqForce.matches, dead = false;
  let t = opts.t ?? (reduit || opts.still ? END : 0), sigOn = false;
  let cv, gl, prog, U = {}, ready = false, lost = false, essaye = false, rast, rc, tk, ro, io, stopSig;
  let W = 0, H = 0, D = 1, cpu = 1, z = 300, logo = [-9, -9, 1, 1], calm = [], texTaille = '', texT = -1;
  let x = 0, y = 0, tx = 0, ty = 0, place = false, px = null, py = null, horloge = 0, defile = 0;
  const pli = { arc: [0, 0, 1, 0], fold: 0, bar: [0, 0, 0, 0], barF: [0, 0] }, chemins = new Map();
  const ac = new AbortController(), on = { passive: true, signal: ac.signal };

  const enGL = () => ready && !lost && ds.plaque === 'gl';
  const vivant = () => !dead && !reduit && !force && !opts.still;
  const wake = () => tk && vivant() && tk.start();
  // la couche SVG : le nom visible en repli ; transparente quand la plaque le dessine
  const svgAt = (tt) => {
    if (!sig) return;
    const g = ds.plaque === 'gl';
    sig.innerHTML = svgFrame(tt, { phases, eases, tagline: '', ink: g ? 'none' : 'currentColor', bar: g ? 'none' : P['taupe-500'], soft: g ? 'none' : P['greige-500'] });
  };
  const repli = () => { ds.plaque = 'repli'; svgAt(t); };
  sig?.setAttribute('viewBox', LOGO.viewBox);
  svgAt(t);

  function creerGL() {
    essaye = true;
    cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) { cv = gl = null; return repli(); }
    rc = (rast = document.createElement('canvas')).getContext('2d');
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; ready = false; repli(); }, { signal: ac.signal });
    cv.addEventListener('webglcontextrestored', () => { lost = false; compiler(); }, { signal: ac.signal });
    foot.prepend(cv); // caché par le CSS tant que data-plaque n'est pas « gl »
    (ro = new ResizeObserver(resize)).observe(foot);
    document.fonts?.ready.then(resize);
    compiler();
  }

  // compilation sans bloquer : hors du fil avec KHR_parallel_shader_compile, sinon dans un temps mort
  function compiler() {
    const par = gl.getExtension('KHR_parallel_shader_compile');
    prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    const attendre = () => {
      if (dead || lost) return;
      if (par && !gl.getProgramParameter(prog, par.COMPLETION_STATUS_KHR)) return void plusTard(attendre);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cv.remove(); cv = gl = null; return repli(); }
      gl.useProgram(prog);
      for (const n of UNIFORMES) U[n] = gl.getUniformLocation(prog, n);
      gl.uniform3fv(U.uCol, COULEURS.flatMap((c) => lineaire(P[c])));
      const T = gl.TEXTURE_2D;
      gl.bindTexture(T, gl.createTexture());
      for (const a of ['MIN_FILTER', 'MAG_FILTER']) gl.texParameteri(T, gl['TEXTURE_' + a], gl.LINEAR);
      for (const a of ['WRAP_S', 'WRAP_T']) gl.texParameteri(T, gl['TEXTURE_' + a], gl.CLAMP_TO_EDGE);
      texTaille = ''; ready = true;
      if (!mesurer()) return; // taille nulle : le ResizeObserver dessinera
      // préchauffe, avant que le pied ne soit à l'écran : les états de la signature (pli, tablier) passent une fois par le
      // tramage, l'envoi (texSubImage2D) et le shader, pour que la première vraie signature ne paie pas l'amorçage
      const t0 = t;
      for (let i = 0; i <= 8; i++) { t = i < 8 ? (END * i) / 8 : t0; dessiner(); }
      wake();
    };
    plusTard(attendre);
  }

  function mesurer() {
    const r = foot.getBoundingClientRect(), rel = (b, m) => [b.left - r.left - m, b.top - r.top - m, b.right - r.left + m, b.bottom - r.top + m];
    W = r.width; H = r.height;
    if (!W || !H) return (W = 0);
    D = Math.min(devicePixelRatio || 1, opts.densiteMax || 1.5);
    cv.width = Math.round(W * D); cv.height = Math.round(H * D); D = cv.width / W;
    calm = [...foot.querySelectorAll('[data-calme]')].slice(0, 6).map((e) => rel(e.getBoundingClientRect(), 12));
    if (mark) {
      const b = mark.getBoundingClientRect(); cpu = b.width / VW; // px CSS par unité du logotype
      logo = [b.left - r.left - MX * cpu, b.top - r.top - MY * cpu, (VW + 2 * MX) * cpu, (VH + 2 * MY) * cpu];
      rast.width = Math.ceil(logo[2] * D); rast.height = Math.ceil(logo[3] * D);
    }
    z = Math.min(420, Math.max(W * 0.3, Math.min(W * 0.6, 360))); // téléphone : lumière plus haute, plus large
    if (opts.light) { x = tx = opts.light.x * W; y = ty = opts.light.y * H; }
    else if (!place) { x = tx = W * 0.3; y = ty = H * 0.68; place = true; }
    texT = -1;
    return true;
  }

  // le nom tiré de la signature dans une texture : rouge = tôle, noir = découpe, vert = languette ; le tablier part en uniformes
  function tramer(tt) {
    const st = stateAt(tt, phases, eases), svg = svgFrame(tt, { phases, eases, tagline: '', ink: '#000', bar: '#000', soft: '#000' });
    const w = rast.width, h = rast.height, k = w / (VW + 2 * MX), css = (sx, sy) => [logo[0] + (sx - VX + MX) * cpu, logo[1] + (sy - VY + MY) * cpu];
    const fold = st.th / Math.PI, kerf = (1.2 / cpu) * (1 - fold), pile = [];
    let dx = 0, op = 1, bar = null;
    rc.setTransform(1, 0, 0, 1, 0, 0); rc.fillStyle = '#f00'; rc.fillRect(0, 0, w, h);
    rc.setTransform(k, 0, 0, k, (MX - VX) * k, (MY - VY) * k); rc.lineJoin = 'round'; rc.lineCap = 'butt';
    for (const m of svg.matchAll(RE)) {
      if (m[0] === '</g>') { const [d, o] = pile.pop(); dx -= d; op = o; rc.translate(-d, 0); }
      else if (m[0].startsWith('<g')) { const d = +(m[1] || 0); pile.push([d, op]); dx += d; if (m[2]) op = +m[2]; rc.translate(d, 0); }
      else if (m[5]) { // tablier : union de ses rectangles, en px CSS de la plaque
        const [rx, ry, rw, rh] = [m[5], m[6], m[7], m[8]].map(Number), [x0, y0] = css(rx + dx, ry), [x1, y1] = css(rx + dx + rw, ry + rh);
        bar = bar ? [Math.min(bar[0], x0), Math.min(bar[1], y0), Math.max(bar[2], x1), Math.max(bar[3], y1), y0] : [x0, y0, x1, y1, y0];
      } else {
        const sw = /stroke-width="([\d.]+)"/.exec(m[4]);
        if (!sw) { let p = chemins.get(m[3]); if (!p) { p = new Path2D(m[3]); if (m[3].length > 400) chemins.set(m[3], p); } rc.fillStyle = '#000'; rc.fill(p); continue; }
        // le bord mobile : une saignée autour (prolongée aux deux bouts), puis la languette
        rc.strokeStyle = '#000'; rc.lineWidth = +sw[1] + 2 * kerf; rc.stroke(trait(st.pts, kerf));
        rc.strokeStyle = '#0f0'; rc.lineWidth = +sw[1]; rc.stroke(trait(st.pts, 0));
        const [cx, cy] = css(CX_PLI + dx, HEM.cap - R_PLI), a = st.th - Math.PI / 2;
        pli.arc = [cx, cy, -Math.sin(a), -Math.cos(a)];
      }
    }
    pli.fold = fold;
    pli.bar = bar ? bar.slice(0, 4) : [0, 0, 0, 0];
    pli.barF = bar ? [bar[4], op] : [0, 0];
    const T = gl.TEXTURE_2D, taille = w + 'x' + h;
    if (taille !== texTaille) { gl.texImage2D(T, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, rast); texTaille = taille; }
    else gl.texSubImage2D(T, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, rast);
  }
  // chemin du bord mobile (unités SVG), prolongé de « ext » à chaque bout pour que la saignée ferme aussi l'extrémité
  function trait(pts, ext) {
    const q = pts.map(([a, b]) => [a, HEM.cap - b]), n = q.length;
    const allonge = (a, b) => { const vx = a[0] - b[0], vy = a[1] - b[1], l = Math.hypot(vx, vy) || 1; return [a[0] + (vx / l) * ext, a[1] + (vy / l) * ext]; };
    if (ext) { q[0] = allonge(q[0], q[1]); q[n - 1] = allonge(q[n - 1], q[n - 2]); }
    const p = new Path2D();
    q.forEach(([a, b], i) => (i ? p.lineTo(a, b) : p.moveTo(a, b)));
    return p;
  }

  function dessiner() {
    if (!ready || lost || !W || reduit || force || dead) return;
    if (texT !== t && mark) { tramer(t); texT = t; }
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uDpr, D); gl.uniform1f(U.uFade, Math.min(72, Math.max(20, W / 20))); gl.uniform1f(U.uBevel, Math.min(2.5, Math.max(1.2, cpu * 8)));
    gl.uniform3f(U.uLight, x, y, z); gl.uniform4fv(U.uLogo, logo); gl.uniform4fv(U.uArc, pli.arc); gl.uniform1f(U.uFold, pli.fold);
    gl.uniform4fv(U.uBar, pli.bar); gl.uniform2fv(U.uBarF, pli.barF); gl.uniform1i(U.uN, calm.length);
    if (calm.length) gl.uniform4fv(U.uCalm, calm.flat());
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (ds.plaque !== 'gl') { ds.plaque = 'gl'; svgAt(t); }
  }

  function tick(dt, now) {
    let bouge = false;
    if (sigOn) { t = Math.min(END, t + dt); sigOn = t < END; bouge = true; }
    if (!enGL()) { if (bouge) svgAt(t); return sigOn; } // repli : la signature joue en SVG
    if (!W) return false; // taille nulle : le ResizeObserver relancera la boucle
    const r = foot.getBoundingClientRect();
    let actif = false;
    if (mode === 2) { // dérive ; descend avec le défilement, lu seulement ; se pose REPOS ms après le dernier défilement
      actif = now - defile < REPOS;
      if (actif) {
        horloge += dt;
        tx = W * (0.5 + 0.36 * Math.sin((horloge / (MOTION.rideau.ms * 8)) * 2 * Math.PI));
        ty = H * (0.08 + 0.62 * Math.min(1, Math.max(0, (innerHeight - r.top) / Math.min(H, innerHeight))));
      }
    } else if (mode === 1 && px != null) { tx = px - r.left; ty = Math.min(Math.max(py - r.top, -H / 4), H * 1.1); }
    const a = 1 - Math.exp(-dt / PR.retour.ms), dx = (tx - x) * a, dy = (ty - y) * a; // retard : le retour de la presse
    bouge ||= dx * dx + dy * dy > 1e-3;
    x += dx; y += dy;
    if (bouge || !dt) dessiner();
    return actif || bouge || !dt;
  }

  // réglages changés pendant la visite : mouvements réduits → image fixe, ourlet fermé ; couleurs forcées → couleurs du système
  function reglages() {
    reduit = mqReduit.matches; force = mqForce.matches;
    if (reduit || force) { tk?.stop(); sigOn = false; if (reduit) t = END; repli(); }
    else if (ready && !lost) { ds.plaque = ''; if (mesurer()) { dessiner(); wake(); } }
    else if (!essaye) creerGL();
  }
  const resize = () => { if (ready && mesurer()) { dessiner(); wake(); } };

  function monter() {
    io.disconnect();
    if (dead) return;
    tk = ticker(tick, { el: foot, margin: '0px', fps: 60 });
    mqReduit.addEventListener('change', reglages, { signal: ac.signal });
    mqForce.addEventListener('change', reglages, { signal: ac.signal });
    if (mode === 1) {
      addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; wake(); }, on);
      addEventListener('scroll', wake, on);
    } else if (mode === 2) {
      defile = performance.now();
      addEventListener('scroll', () => { defile = performance.now(); wake(); }, on);
    }
    if (reduit || force) repli(); else creerGL();
    if (!reduit && !opts.still && opts.t == null && mark) stopSig = onceVisible(mark, () => { if (vivant()) { sigOn = true; tk.start(); } }, { threshold: 0.6 });
  }
  // montage à un écran du pied de page ; root: document pour que la marge compte aussi dans un iframe d'une autre origine
  const cb = (es) => es.at(-1).isIntersecting && monter();
  try { io = new IntersectionObserver(cb, { root: document, rootMargin: '100% 0px' }); } catch { io = new IntersectionObserver(cb, { rootMargin: '100% 0px' }); }
  io.observe(foot);

  return {
    seek(v) { t = Math.min(Math.max(+v, 0), END); sigOn = false; if (enGL()) dessiner(); else svgAt(t); },
    light(a, b) { x = tx = a; y = ty = b; dessiner(); },
    destroy() {
      dead = true; ac.abort(); io.disconnect(); ro?.disconnect(); tk?.destroy(); stopSig?.();
      gl?.getExtension('WEBGL_lose_context')?.loseContext(); cv?.remove(); delete ds.plaque; svgAt(t);
    },
  };
}
