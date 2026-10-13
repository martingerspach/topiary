/* HYPHA — le réseau du pied de page (landing v8, chantier A4b). Un réseau de transport vivant, calculé sur la carte graphique.
   Le modèle est celui de Jeff Jones (2010, « Characteristics of pattern formation and evolution in approximations of Physarum
   transport networks ») : des centaines de milliers d'agents avancent, sentent devant eux (trois capteurs), tournent vers la piste
   la plus forte et y déposent la leur ; la piste diffuse et s'évapore. Il en sort des réseaux qui se tendent, se ramifient et se
   réorganisent sans cesse, ceux d'un mycélium. Porté en temps réel par Sage Jenson (dont les pièces à plusieurs espèces) ; ici en
   WebGL 2, à la manière de l'exemple d'Amanda Ghassaei (gpu-io).
   Deux populations, comme un mycélium : les cordons (de grands capteurs, une piste qui dure) tracent les nervures qui portent ; les
   capillaires (de petits capteurs, une piste brève) remplissent les mailles et s'accrochent aux cordons. Chacune a sa piste (deux
   canaux d'une même texture) et sent un peu celle de l'autre.
   Les lettres du mot-symbole sont la matière que le réseau contourne : il les cerne d'une marge nette, sans passer dessous ni s'y
   accumuler (aucun halo). À l'arrivée, il est semé contre les lettres et colonise le pied de page depuis le mot. La main (le
   pointeur) l'éclaire : il s'en écarte, puis la trouée se referme. Le réseau se referme sur lui-même aux bords (un tore).
   L'affichage est lissé dans le temps (une moyenne glissante de la piste) : pas de grain qui grouille, un mouvement soyeux.
   Le réseau reste sombre derrière le texte (ses contrastes ne bougent pas), plus clair autour du mot.
   HyphaNetwork.mount(canvas, { food(ctx, w, h) (ce que le réseau contourne, peint en opaque), mask: () => y (en px CSS, depuis le
     haut, où le texte commence), colors: () => ({ bg, vein, cap, accent, dim }), still, scale, params })
     → { start(), stop(), still(n), resize(), refood(), light(x, y, r), redraw() } ; null si WebGL 2 ou les textures flottantes
     manquent (rien n'est dessiné, le pied de page reste tel quel). */
(function (root) {
  'use strict';
  var VS = '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var HASH = 'float hash(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}';
  // Les agents : position (px de la simulation, origine en bas à gauche), cap ; w = espèce (partie entière) + graine (partie décimale)
  var UPDATE = '#version 300 es\nprecision highp float;uniform highp sampler2D A;uniform sampler2D T;uniform sampler2D F;uniform vec2 res;' +
    'uniform vec2 SA,RA,SO,SS;uniform vec4 W;uniform float FW,RS,t;uniform vec3 L;out vec4 o;' + HASH +
    'float sense(vec2 p,vec2 w){vec2 uv=p/res;float v=dot(texture(T,uv).rg,w)-FW*texture(F,uv).r;' +
    'if(L.z>0.){float f=smoothstep(L.z,L.z*.35,distance(p,L.xy));v=v*(1.-f)-80.*f;}return v;}' +
    'void main(){vec4 a=texelFetch(A,ivec2(gl_FragCoord.xy),0);int s=int(a.w);vec2 pos=a.xy;float ang=a.z;' +
    'float sa=SA[s],ra=RA[s],so=SO[s],ss=SS[s];vec2 w=s==0?W.xy:W.zw;float r=hash(gl_FragCoord.xy*.731+fract(a.w)*97.+t);' +
    'float f=sense(pos+so*vec2(cos(ang),sin(ang)),w),l=sense(pos+so*vec2(cos(ang+sa),sin(ang+sa)),w),rr=sense(pos+so*vec2(cos(ang-sa),sin(ang-sa)),w);' +
    'if(f>l&&f>rr){}else if(f<l&&f<rr){ang+=(r<.5?ra:-ra);}else if(l>rr){ang+=ra*(.7+.3*r);}else if(rr>l){ang-=ra*(.7+.3*r);}' +
    'pos=mod(pos+ss*vec2(cos(ang),sin(ang)),res);' +
    'if(hash(gl_FragCoord.xy*1.37+t*3.1)<RS){pos=vec2(hash(gl_FragCoord.xy+t),hash(gl_FragCoord.yx-t))*res;ang=r*6.2831853;}' +
    'o=vec4(pos,ang,a.w);}';
  var DEPOSIT_VS = '#version 300 es\nuniform highp sampler2D A;uniform vec2 res;uniform int N;flat out int sp;' +
    'void main(){ivec2 c=ivec2(gl_VertexID%N,gl_VertexID/N);vec4 a=texelFetch(A,c,0);sp=int(a.w);gl_Position=vec4(a.xy/res*2.-1.,0.,1.);gl_PointSize=1.;}';
  var DEPOSIT_FS = '#version 300 es\nprecision mediump float;uniform vec2 D;flat in int sp;out vec4 o;void main(){o=sp==0?vec4(D.x,0.,0.,1.):vec4(0.,D.y,0.,1.);}';
  // La piste diffuse (moyenne 3 × 3) et s'évapore, chaque population à son rythme ; sous la main, elle s'évapore plus vite
  var DIFFUSE = '#version 300 es\nprecision highp float;uniform sampler2D T;uniform vec2 res,K,M;uniform vec3 L;out vec4 o;' +
    'void main(){vec2 px=1./res;vec2 uv=gl_FragCoord.xy*px;vec2 s=vec2(0.);for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)s+=texture(T,uv+vec2(x,y)*px).rg;' +
    'vec2 c=texture(T,uv).rg;vec2 v=mix(c,s/9.,M)*K;if(L.z>0.){v*=mix(.55,1.,smoothstep(L.z*.35,L.z,distance(gl_FragCoord.xy,L.xy)));}o=vec4(min(v,vec2(80.)),0.,1.);}';
  // Le lissage dans le temps : l'affichage rejoint la piste par une moyenne glissante
  var SMOOTH = '#version 300 es\nprecision highp float;uniform sampler2D T;uniform sampler2D P;uniform vec2 res;uniform float AL;out vec4 o;' +
    'void main(){vec2 uv=gl_FragCoord.xy/res;o=vec4(mix(texture(P,uv).rg,texture(T,uv).rg,AL),0.,1.);}';
  // L'affichage : les capillaires en filaments discrets, les cordons plus clairs ; les cordons les plus chargés prennent un peu de la
  // souche ; au-dessus du texte, tout s'atténue
  var SHOW = '#version 300 es\nprecision highp float;uniform sampler2D T;uniform vec2 res,G;uniform vec3 BG,LV,LC,AC;uniform float Y0,Y1,DK,IN;out vec4 o;' +
    'void main(){vec2 v=texture(T,gl_FragCoord.xy/res).rg;float a=smoothstep(.05,1.,1.-exp(-v.x*G.x))*IN,b=smoothstep(.05,1.,1.-exp(-v.y*G.y))*IN;' +
    'float dim=mix(DK,1.,smoothstep(Y0,Y1,gl_FragCoord.y));vec3 c=mix(BG,LC,b*.62*dim);c=mix(c,LV,pow(a,1.3)*.86*dim);' +
    'c=mix(c,AC,smoothstep(.62,1.,a)*.3*dim*dim);o=vec4(c,1.);}';

  function rgb(hex) { var n = parseInt(String(hex).replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  function prng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function mount(cv, opt) {
    var gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    // Les réglages (distances en px CSS) : [cordons, capillaires]. W : ce que sent chaque population de chaque piste (cordons :
    // la leur, un peu repoussés par les capillaires ; capillaires : la leur et celle des cordons). Choisis au banc.
    var Q = { SA: [0.5, 1.1], RA: [0.3, 0.7], SO: [12, 4], SS: [1.4, 1.1], W: [1, -0.3, 1.2, 1], K: [0.82, 0.6], M: [0.035, 0.25], D: [0.7, 0.9],
      G: [0.07, 0.6], FW: 4, RS: 0.0015, density: 0.6, share: 0.25, AL: 0.3 };
    if (opt.params) Object.keys(opt.params).forEach(function (k) { Q[k] = opt.params[k]; });
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    function prog(vs, fs) {
      var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i), nm = info.name.replace('[0]', ''); u[nm] = gl.getUniformLocation(p, nm); }
      return { p: p, u: u };
    }
    var P;
    try { P = { up: prog(VS, UPDATE), dep: prog(DEPOSIT_VS, DEPOSIT_FS), dif: prog(VS, DIFFUSE), sm: prog(VS, SMOOTH), show: prog(VS, SHOW) }; } catch (e) { console.error('HYPHA réseau :', e); return null; }
    // Un grand triangle qui couvre la cible
    var vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    var empty = gl.createVertexArray();
    function tex(w, h, fmt, filter, data) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      if (fmt === 'rgba32f') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data || null);
      else if (fmt === 'rgba16f') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, data || null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      // Le réseau se referme sur lui-même (un tore) : pas de nervures droites le long des bords
      var wrap = fmt === 'rgba32f' ? gl.CLAMP_TO_EDGE : gl.REPEAT;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      return t;
    }
    function fbo(t) { var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; }
    var S = { W: 0, H: 0, sc: 1, N: 0, ag: [], agF: [], tr: [], trF: [], ds: [], dsF: [], food: null, raf: 0, on: false, t: 0, light: [0, 0, 0], intro: 0, lost: false };
    var foodCv = document.createElement('canvas'), fctx = foodCv.getContext('2d', { willReadFrequently: true });
    function free() {
      S.ag.concat(S.tr, S.ds, S.food ? [S.food] : []).forEach(function (t) { gl.deleteTexture(t); });
      S.agF.concat(S.trF, S.dsF).forEach(function (f) { gl.deleteFramebuffer(f); });
      S.ag = []; S.agF = []; S.tr = []; S.trF = []; S.ds = []; S.dsF = []; S.food = null;
    }
    // Les obstacles : les lettres, peintes par la page dans un canvas 2D à la taille de la simulation
    function paintFood() {
      foodCv.width = S.W; foodCv.height = S.H;
      fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, S.W, S.H);
      fctx.setTransform(S.sc, 0, 0, S.sc, 0, 0);
      if (opt.food) opt.food(fctx, S.W / S.sc, S.H / S.sc);
      var d = fctx.getImageData(0, 0, S.W, S.H).data, red = new Uint8Array(S.W * S.H);
      for (var i = 0; i < red.length; i++) red[i] = d[i * 4 + 3];
      gl.bindTexture(gl.TEXTURE_2D, S.food);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, S.W, S.H, 0, gl.RED, gl.UNSIGNED_BYTE, red);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      return red;
    }
    function build() {
      var w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return false;
      S.sc = opt.scale || 1; S.W = Math.max(2, Math.round(w * S.sc)); S.H = Math.max(2, Math.round(h * S.sc));
      cv.width = S.W; cv.height = S.H;
      free();
      S.N = Math.max(96, Math.min(680, Math.round(Math.sqrt(S.W * S.H * Q.density))));
      S.food = tex(S.W, S.H, 'r8', gl.LINEAR);
      var red = paintFood(), i, x, y;
      // Le semis : contre les lettres (juste hors de leur marge), d'où le réseau colonise le pied de page ; quelques-uns ailleurs
      var R = prng(4412), ring = [], step = Math.max(1, Math.round(S.sc * 2));
      for (y = 3 * step; y < S.H - 3 * step; y += step) for (x = 3 * step; x < S.W - 3 * step; x += step) {
        var c = y * S.W + x; if (red[c] > 8) continue;
        if (red[c - step] > 200 || red[c + step] > 200 || red[c - step * S.W] > 200 || red[c + step * S.W] > 200 || red[c - 3 * step] > 200 || red[c + 3 * step] > 200) ring.push(c);
      }
      var n = S.N * S.N, A = new Float32Array(n * 4);
      for (i = 0; i < n; i++) {
        if (ring.length && R() < 0.85) { var cc = ring[Math.floor(R() * ring.length)]; x = cc % S.W + R(); y = S.H - 1 - Math.floor(cc / S.W) + R(); }
        else { x = R() * S.W; y = R() * S.H; }
        A[i * 4] = x; A[i * 4 + 1] = y; A[i * 4 + 2] = R() * Math.PI * 2; A[i * 4 + 3] = (R() < Q.share ? 0 : 1) + R() * 0.999;
      }
      for (i = 0; i < 2; i++) { S.ag.push(tex(S.N, S.N, 'rgba32f', gl.NEAREST, i ? null : A)); S.agF.push(fbo(S.ag[i])); }
      gl.clearColor(0, 0, 0, 1);
      for (i = 0; i < 2; i++) { S.tr.push(tex(S.W, S.H, 'rgba16f', gl.LINEAR)); S.trF.push(fbo(S.tr[i])); gl.clear(gl.COLOR_BUFFER_BIT); }
      for (i = 0; i < 2; i++) { S.ds.push(tex(S.W, S.H, 'rgba16f', gl.LINEAR)); S.dsF.push(fbo(S.ds[i])); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      S.intro = 0;
      return true;
    }
    function bindTex(unit, t, prg, name) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(prg.u[name], unit); }
    // Une itération : agents, dépôt, diffusion
    function step() {
      var sc = S.sc, L = S.light, Lz = L[2] * sc;
      S.t = (S.t + 1) % 100000;
      gl.useProgram(P.up.p); gl.bindVertexArray(vao); gl.viewport(0, 0, S.N, S.N); gl.bindFramebuffer(gl.FRAMEBUFFER, S.agF[1]); gl.disable(gl.BLEND);
      bindTex(0, S.ag[0], P.up, 'A'); bindTex(1, S.tr[0], P.up, 'T'); bindTex(2, S.food, P.up, 'F');
      gl.uniform2f(P.up.u.res, S.W, S.H);
      gl.uniform2f(P.up.u.SA, Q.SA[0], Q.SA[1]); gl.uniform2f(P.up.u.RA, Q.RA[0], Q.RA[1]);
      gl.uniform2f(P.up.u.SO, Q.SO[0] * sc, Q.SO[1] * sc); gl.uniform2f(P.up.u.SS, Q.SS[0] * sc, Q.SS[1] * sc);
      gl.uniform4f(P.up.u.W, Q.W[0], Q.W[1], Q.W[2], Q.W[3]);
      gl.uniform1f(P.up.u.FW, Q.FW); gl.uniform1f(P.up.u.RS, Q.RS); gl.uniform1f(P.up.u.t, S.t * 0.013);
      gl.uniform3f(P.up.u.L, L[0] * sc, S.H - L[1] * sc, Lz);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      S.ag.reverse(); S.agF.reverse();
      // Dépôt : chaque agent laisse sa trace sur la piste de sa population (addition)
      gl.useProgram(P.dep.p); gl.bindVertexArray(empty); gl.viewport(0, 0, S.W, S.H); gl.bindFramebuffer(gl.FRAMEBUFFER, S.trF[0]);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      bindTex(0, S.ag[0], P.dep, 'A'); gl.uniform2f(P.dep.u.res, S.W, S.H); gl.uniform1i(P.dep.u.N, S.N); gl.uniform2f(P.dep.u.D, Q.D[0], Q.D[1]);
      gl.drawArrays(gl.POINTS, 0, S.N * S.N);
      gl.disable(gl.BLEND);
      // Diffusion et évaporation
      gl.useProgram(P.dif.p); gl.bindVertexArray(vao); gl.bindFramebuffer(gl.FRAMEBUFFER, S.trF[1]);
      bindTex(0, S.tr[0], P.dif, 'T'); gl.uniform2f(P.dif.u.res, S.W, S.H);
      gl.uniform2f(P.dif.u.K, Q.K[0], Q.K[1]); gl.uniform2f(P.dif.u.M, Q.M[0], Q.M[1]); gl.uniform3f(P.dif.u.L, L[0] * sc, S.H - L[1] * sc, Lz);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      S.tr.reverse(); S.trF.reverse();
    }
    // L'affichage rejoint la piste (al = 1 : d'un coup)
    function smooth(al) {
      gl.useProgram(P.sm.p); gl.bindVertexArray(vao); gl.viewport(0, 0, S.W, S.H); gl.bindFramebuffer(gl.FRAMEBUFFER, S.dsF[1]);
      bindTex(0, S.tr[0], P.sm, 'T'); bindTex(1, S.ds[0], P.sm, 'P'); gl.uniform2f(P.sm.u.res, S.W, S.H); gl.uniform1f(P.sm.u.AL, al);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      S.ds.reverse(); S.dsF.reverse();
    }
    function show() {
      var c = opt.colors(), y = opt.mask ? opt.mask() : 0, sc = S.sc;
      gl.useProgram(P.show.p); gl.bindVertexArray(vao); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, S.W, S.H);
      bindTex(0, S.ds[0], P.show, 'T'); gl.uniform2f(P.show.u.res, S.W, S.H); gl.uniform2f(P.show.u.G, Q.G[0], Q.G[1]);
      var bg = rgb(c.bg), lv = rgb(c.vein), lc = rgb(c.cap), ac = rgb(c.accent);
      gl.uniform3f(P.show.u.BG, bg[0], bg[1], bg[2]); gl.uniform3f(P.show.u.LV, lv[0], lv[1], lv[2]); gl.uniform3f(P.show.u.LC, lc[0], lc[1], lc[2]); gl.uniform3f(P.show.u.AC, ac[0], ac[1], ac[2]);
      // Au-dessus du texte (en px de la simulation, origine en bas), le réseau s'atténue jusqu'à DK, entièrement avant la première ligne
      gl.uniform1f(P.show.u.Y1, S.H - (y - 72) * sc); gl.uniform1f(P.show.u.Y0, S.H - (y - 8) * sc); gl.uniform1f(P.show.u.DK, c.dim);
      gl.uniform1f(P.show.u.IN, S.intro);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function frame() {
      S.raf = 0;
      if (!S.on || S.lost) return;
      step(); step();
      smooth(Q.AL);
      // L'arrivée : le réseau monte en deux secondes, pendant qu'il colonise le pied de page depuis le mot
      S.intro = Math.min(1, S.intro + 1 / 120);
      show();
      S.raf = root.requestAnimationFrame(frame);
    }
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); S.lost = true; });
    cv.addEventListener('webglcontextrestored', function () { S.lost = false; build(); if (S.on) S.raf = root.requestAnimationFrame(frame); });
    if (!build()) return null;
    // Le premier tracé compile vraiment les programmes (les pilotes le diffèrent) : il se fait ici, au repos, et non à l'arrivée
    // du pied de page à l'écran, où il coûterait une image de 30 ms. L'arrivée étant à zéro, il ne peint que le fond.
    step(); smooth(Q.AL); show();
    var api = {
      // Animations réduites ou capture : le réseau pousse d'un coup (n itérations), puis reste figé
      still: function (n) { S.intro = 1; for (var i = 0; i < (n || 500); i++) step(); smooth(1); show(); },
      start: function () { if (S.on) return; S.on = true; if (!S.raf) S.raf = root.requestAnimationFrame(frame); },
      stop: function () { S.on = false; if (S.raf) { root.cancelAnimationFrame(S.raf); S.raf = 0; } },
      resize: function () { var was = S.on; api.stop(); if (build()) { if (was) api.start(); else if (opt.still) api.still(); } },
      refood: function () { if (S.food) paintFood(); },
      light: function (x, y, r) { S.light = [x, y, r || 0]; },
      redraw: function () { if (!S.on) show(); }
    };
    return api;
  }
  root.HyphaNetwork = { mount: mount };
})(window);
