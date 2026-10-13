// Ourlet · gravure : la trame de lignes de la v5, une photogravure en monochrome chaud.
// Référence : la trame de lignes des gravures sur acier et des notices techniques imprimées, où chaque ligne horizontale
// s'épaissit avec le ton. La ligne est continue dans son sens : une pièce qui glisse le long des lignes (convoyeur, travelling)
// se déplace sans sauter de cellule en cellule ; seul le sens perpendiculaire est quantifié, au pas de la trame.
//
// Deux temps par image :
// 1. la scène (pièce, outils) est peinte en 2D dans un petit canvas de « tons » : rouge = ton de la face (0 à 1),
//    vert = part de peinture (0 à 1, la teinte du client), bleu = présence d'un objet (0 = fond) ; une rangée de pixels par
//    sous-ligne (SUB sous-lignes par ligne de trame), une colonne par pixel d'écran divisé par COLX ;
// 2. un fragment shader WebGL2 lit ce canvas et dessine, pour chaque pixel de l'écran, la ligne de trame qui le traverse :
//    épaisseur = ton moyen de la ligne (moyenne des sous-lignes), bord adouci sur un pixel. Coût CPU : la peinture 2D du
//    petit canvas et un envoi de texture ; le reste est sur la carte graphique.
// Sans WebGL2 : repli en 2D (traits par cellule, pas plus grossier), même rendu au repos, plus lent.

const VS = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D tons;
uniform vec2 res;        // taille du canvas, px d'écran
uniform float pas;       // pas de la trame, px d'écran
uniform float lignes;    // nombre de lignes de trame
uniform float sub;       // sous-lignes par ligne dans la texture
uniform vec2 ep;         // épaisseur relative au ton 0 et au ton 1 (part du pas)
uniform float epFond;    // épaisseur relative des lignes du fond
uniform vec3 fond, traitFond, trait0, trait1, teinte0, teinte1, plaque;
uniform float aplat;     // seconde plaque d'impression : la teinte en aplat clair sous les traits, là où la pièce est peinte
uniform sampler2D sens;  // trame orientée : rouge = angle des hachures (0 à π), vert = face orientée ; lu au texel près
uniform float oriente;
uniform vec2 tsize;      // taille des canvas de tons et de sens, en texels
uniform float packed;    // un seul canvas : rouge = ton / 2 + peinture / 2, vert = angle des hachures, bleu = présence
out vec4 o;
void main() {
  float y = res.y - gl_FragCoord.y;             // origine en haut, centre du pixel
  float li = floor(y / pas);
  float yc = (li + 0.5) * pas;
  float u = gl_FragCoord.x / res.x;
  vec3 m = vec3(0.0);
  for (float k = 0.0; k < 4.0; k += 1.0) {
    if (k >= sub) break;
    m += texture(tons, vec2(u, (li * sub + k + 0.5) / (lignes * sub))).rgb;
  }
  m /= sub;
  float d = abs(y - yc);
  // trame orientée : sur une face, les hachures suivent la face (leur angle vient du canvas de sens) et le ton se lit au
  // pixel ; hors des faces, la trame horizontale reste
  if (oriente > 0.5) {
    vec2 tc = vec2(u, y / (lignes * pas));
    ivec2 ti = ivec2(min(tc * tsize, tsize - 1.0));
    vec4 dv = packed > 0.5 ? texelFetch(tons, ti, 0) : texelFetch(sens, ti, 0);
    float has = packed > 0.5 ? step(0.5, dv.b) : dv.g;
    if (has > 0.5) {
      float th = (packed > 0.5 ? dv.g / max(dv.b, 0.001) : dv.r) * 3.14159265;
      float s = -gl_FragCoord.x * sin(th) + y * cos(th);
      float lj = floor(s / pas);
      d = abs(s - (lj + 0.5) * pas);
      m = texture(tons, tc).rgb;
    }
  }
  float pres = m.b;
  float rr = pres > 0.001 ? clamp(m.r / pres, 0.0, 1.0) : 0.0;
  float gg = pres > 0.001 ? clamp(m.g / pres, 0.0, 1.0) : 0.0;
  float peint = packed > 0.5 ? step(0.5, rr) : gg;
  float ton = packed > 0.5 ? clamp((rr - 0.5 * peint) * 2.0, 0.0, 1.0) : rr;   // ton de l'objet seul, sans le fond
  float w = mix(epFond, mix(ep.x, ep.y, ton), pres) * pas;
  float cov = clamp(w * 0.5 - d + 0.5, 0.0, 1.0);
  vec3 brut = mix(trait0, trait1, ton);
  vec3 tnt = mix(teinte0, teinte1, ton);
  vec3 trait = mix(traitFond, mix(brut, tnt, peint), pres);
  vec3 sous = mix(fond, plaque, aplat * peint * pres);
  o = vec4(mix(sous, trait, cov), 1.0);
}`;

const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

// canvas : le canvas affiché. opts : pas (px CSS), sub, colx, dprMax, couleurs (hex).
// Couleurs : fond (entre les lignes), traitFond (lignes du fond, sans objet), trait0 et trait1 (lignes d'un objet au ton 0 et
// au ton 1), teinte (la peinture du client ; sa rampe suit celle des traits). Le « ton » décide de l'épaisseur : à l'appelant de
// le tirer de l'éclairage (traits clairs sur fond sombre) ou de son inverse (traits d'encre sur papier).
export function createGravure(canvas, { pas = 3, sub = 3, colx = 1, dprMax = 2, ep = [0.12, 0.92], epFond = 0.1, fond, traitFond, trait0, trait1, teinte = null, aplat = 0, oriente = false, packed = false } = {}) {
  const tons = document.createElement('canvas');
  const tctx = tons.getContext('2d', { willReadFrequently: false, alpha: false });
  // canvas de sens (trame orientée) : l'angle des hachures de chaque face, même taille que les tons
  const sens = document.createElement('canvas');
  const sctx = sens.getContext('2d', { alpha: false });
  let gl = null, prog = null, tex = null, texS = null, loc = {}, lost = false, mode = '2d';
  const col = { fond: rgb(fond), traitFond: rgb(traitFond), trait0: rgb(trait0), trait1: rgb(trait1), teinte0: rgb(trait0), teinte1: rgb(trait1), plaque: rgb(fond) };
  // la teinte du client suit la rampe des traits (plus claire où les traits sont clairs) sans quitter sa couleur
  const setTeinte = (hex, k = 0.3) => {
    if (!hex) { col.teinte0 = col.trait0; col.teinte1 = col.trait1; col.plaque = col.fond; return; }
    const c = rgb(hex);
    col.plaque = c.map((v, i) => v + (col.fond[i] - v) * 0.45);
    col.teinte0 = c.map((v, i) => v + (col.trait0[i] - v) * k);
    col.teinte1 = c.map((v, i) => v + (col.trait1[i] - v) * k);
  };
  setTeinte(teinte);

  function initGL() {
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) { mode = '2d'; return false; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const ap = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
    for (const k of ['tons', 'res', 'pas', 'lignes', 'sub', 'ep', 'epFond', 'fond', 'traitFond', 'trait0', 'trait1', 'teinte0', 'teinte1', 'plaque', 'aplat', 'sens', 'oriente', 'tsize', 'packed']) loc[k] = gl.getUniformLocation(prog, k);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(loc.tons, 0);
    texS = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(loc.sens, 1); gl.activeTexture(gl.TEXTURE0);
    mode = 'gl';
    return true;
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; try { initGL(); } catch { mode = '2d'; } });
  try { initGL(); } catch { mode = '2d'; gl = null; }

  // Géométrie de la trame pour la taille actuelle ; renvoie la transformation à appliquer aux dessins (px CSS → canvas des tons)
  let geo = null;
  function layout() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return null;
    const dpr = Math.min(dprMax, window.devicePixelRatio || 1);
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    // pas en px d'écran, entier : la trame tombe juste sur les pixels
    const p = Math.max(2, Math.round(pas * dpr));
    const lignes = Math.ceil(ch / p);
    const tw = Math.max(1, Math.round(cw / colx)), th = lignes * sub;
    if (geo && geo.cw === cw && geo.ch === ch && geo.p === p) return geo;
    if (mode === 'gl' && (canvas.width !== cw || canvas.height !== ch)) { canvas.width = cw; canvas.height = ch; }
    tons.width = tw; tons.height = th; if (oriente && !packed) { sens.width = tw; sens.height = th; }
    // px CSS → tons : x * (tw / W), y * (th / (lignes * p / dpr))
    geo = { W, H, dpr, cw, ch, p, lignes, tw, th, sx: tw / W, sy: th / ((lignes * p) / dpr) };
    return geo;
  }

  // paint(ctx, g) : la scène peint ses polygones en px CSS dans ctx (transformation déjà posée) avec tonColor()
  function frame(paint) {
    if (lost) return false;
    const g = layout(); if (!g) return false;
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.fillStyle = '#000'; tctx.fillRect(0, 0, g.tw, g.th);
    tctx.setTransform(g.sx, 0, 0, g.sy, 0, 0);
    const sep = oriente && !packed; // canvas de sens séparé (premier écran) ; en mode groupé, l'angle est dans le vert des tons
    if (sep) { sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.fillStyle = '#000'; sctx.fillRect(0, 0, g.tw, g.th); sctx.setTransform(g.sx, 0, 0, g.sy, 0, 0); }
    paint(tctx, g, sep ? sctx : null);
    if (mode === 'gl') {
      gl.viewport(0, 0, g.cw, g.ch);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tons);
      gl.uniform1f(loc.oriente, oriente ? 1 : 0); gl.uniform2f(loc.tsize, g.tw, g.th); gl.uniform1f(loc.packed, packed ? 1 : 0);
      if (sep) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texS); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sens); gl.activeTexture(gl.TEXTURE0); }
      gl.uniform2f(loc.res, g.cw, g.ch); gl.uniform1f(loc.pas, g.p); gl.uniform1f(loc.lignes, g.lignes); gl.uniform1f(loc.sub, sub);
      gl.uniform2f(loc.ep, ep[0], ep[1]); gl.uniform1f(loc.epFond, epFond);
      for (const k of ['fond', 'traitFond', 'trait0', 'trait1', 'teinte0', 'teinte1', 'plaque']) gl.uniform3fv(loc[k], col[k]);
      gl.uniform1f(loc.aplat, aplat);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else draw2d(g);
    return true;
  }

  // Repli sans WebGL2 : une lecture des tons, puis un trait par cellule (colonnes de 2 px CSS)
  function draw2d(g) {
    const dpr = g.dpr, cw = Math.round(g.W * dpr), ch = Math.round(g.H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const ctx = canvas.getContext('2d');
    const d = tctx.getImageData(0, 0, g.tw, g.th).data;
    const hex = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = hex(col.fond); ctx.fillRect(0, 0, cw, ch);
    const step = Math.max(1, Math.round(2 * dpr / colx * colx));
    for (let li = 0; li < g.lignes; li++) {
      const yc = (li + 0.5) * g.p;
      for (let x = 0; x < g.tw; x += step) {
        let r = 0, gg = 0, b = 0;
        for (let k = 0; k < sub; k++) {
          const o = ((li * sub + k) * g.tw + x) * 4;
          if (packed) { // mode groupé : rouge = ton / 2 + peinture / 2, décodé échantillon par échantillon (le vert est l'angle)
            const pr = d[o + 2] / 255; if (pr < 0.002) continue;
            const rr = d[o] / d[o + 2], pk = rr >= 0.5 ? 1 : 0;
            r += Math.min(1, Math.max(0, (rr - 0.5 * pk) * 2)) * pr; gg += pk * pr; b += pr;
          } else { r += d[o] / 255; gg += d[o + 1] / 255; b += d[o + 2] / 255; }
        }
        r /= sub; gg /= sub; b /= sub;
        const ton = b > 0.001 ? Math.min(1, r / b) : 0, pe = b > 0.001 ? Math.min(1, gg / b) : 0;
        const w = (epFond + (ep[0] + (ep[1] - ep[0]) * ton - epFond) * b) * g.p;
        const c = col.traitFond.map((v, i) => v + ((col.trait0[i] + (col.trait1[i] - col.trait0[i]) * ton) * (1 - pe) + (col.teinte0[i] + (col.teinte1[i] - col.teinte0[i]) * ton) * pe - v) * b);
        const ap = aplat * pe * b; // la seconde plaque, comme le shader : la teinte en aplat sous les traits peints
        if (ap > 0.01) { ctx.fillStyle = hex(col.fond.map((v, i) => v + (col.plaque[i] - v) * ap)); ctx.fillRect(x * colx, li * g.p, step * colx, g.p); }
        ctx.fillStyle = hex(c); ctx.fillRect(x * colx, yc - w / 2, step * colx, w);
      }
    }
  }

  return {
    frame, layout, setTeinte,
    get mode() { return mode; },
    get tons() { return tons; },
    destroy() { const ext = gl && gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); },
  };
}

// Couleur de remplissage d'un polygone dans le canvas des tons
export const tonColor = (ton, peint = 0, pres = 1) => `rgb(${Math.round(255 * ton * pres)},${Math.round(255 * peint * pres)},${Math.round(255 * pres)})`;
// Couleur d'un polygone dans le canvas de sens : l'angle des hachures, en radians (ramené à [0, π))
// Mode groupé : un seul remplissage par polygone (ton, peinture, angle, présence)
export const tonPack = (ton, peint = 0, a = 0, pres = 1) => { let x = a % Math.PI; if (x < 0) x += Math.PI; return `rgb(${Math.round(255 * pres * (ton * 0.5 + (peint > 0.5 ? 0.5 : 0)))},${Math.round((255 * pres * x) / Math.PI)},${Math.round(255 * pres)})`; };
export const sensColor = (a) => { let x = a % Math.PI; if (x < 0) x += Math.PI; return `rgb(${Math.round((255 * x) / Math.PI)},255,0)`; };
