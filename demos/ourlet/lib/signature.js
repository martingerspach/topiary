// Ourlet · signature animée : l'ourlet du L se fait comme à l'atelier, en deux coups de presse.
// Référence de métier : l'ourlet en presse plieuse (outillage en deux temps) : 1) pré-pliage aigu, le bord remonte à 150°
// (il reste 30° d'ouverture), pause de l'opérateur qui repositionne la pièce ; 2) écrasement entre outils plats, de 150° à 180°.
// Ici, le second coup est montré littéralement : un tablier plat descend et referme le bord ; l'angle est lu par une cote
// dessinée comme sur un plan. Le bord déplié dépasserait sous le E : le E et le T s'écartent juste assez, puis le mot se resserre
// au crénage final à mesure que l'ourlet se ferme. Tout est calculé depuis la géométrie du logotype (lib/marque.js) ; seek(t) est
// déterministe (captures, films). Animations réduites : l'état final s'affiche directement.
import { LOGO, LOGO_REST, HEM } from './marque.js';

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // courbe « presse » des tokens
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));

// Géométrie (unités de la police, y vers le haut, origine sur la ligne de base)
const H = HEM.H, G = HEM.G, ts = (H - G) / 2, r = H / 2, ri = G / 2, rm = ri + ts / 2;
const Lx = HEM.Lx, cx = Lx + HEM.footEnd - r, xs = cx - HEM.LRET, Lr = cx - xs;
const stemL = Lx + 54.14, stemR = Lx + HEM.stemRight, CAP = HEM.cap;
const E_LEFT = LOGO_REST.eLeft;

// Bord mobile pour un angle θ (0 = à plat vers la droite, π = rabattu à plat) : ligne médiane (arc puis retour droit)
function flange(th) {
  if (th < 1e-3) return [[cx, ts / 2], [cx + Lr, ts / 2]]; // à plat : un simple prolongement, sans arc dégénéré
  const pts = [], n = Math.max(2, Math.ceil(th / (Math.PI / 36)));
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (th * i) / n; pts.push([cx + rm * Math.cos(a), r + rm * Math.sin(a)]); }
  const a = -Math.PI / 2 + th, tx = -Math.sin(a), ty = Math.cos(a), e = pts[pts.length - 1];
  pts.push([e[0] + Lr * tx, e[1] + Lr * ty]);
  return pts;
}
const maxX = (pts) => Math.max(...pts.map((p) => p[0])) + ts / 2;
const topY = (pts) => Math.max(...pts.map((p) => p[1])) + ts / 2;
// θ pour lequel le haut du bord touche une hauteur donnée (le tablier qui descend), entre 150° et 180°
function thetaForHeight(h) {
  let lo = (150 * Math.PI) / 180, hi = Math.PI;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (topY(flange(m)) > h) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const TH1 = (150 * Math.PI) / 180;
const H150 = topY(flange(TH1));

export const DURATION = 3200;
// Phases par défaut (motion.html, le film) : pré-pliage, tablier qui descend, écrasement, remontée, signature.
// La landing passe les siennes, tirées de la grammaire de la presse (tokens), avec leurs courbes.
export const PHASES = { p1: [250, 1150], down: [1450, 1750], press: [1750, 2250], up: [2250, 2550], tag: [2550, 2950] };
// État à l'instant t (ms) : angle, ouverture du mot, tablier, cote, signature
export function stateAt(t, ph = PHASES, ez = {}) {
  const E = { p1: ez.p1 || ease, down: ez.down || ease, press: ez.press || ease, up: ez.up || ease, tag: ez.tag || ease };
  let th = 0, bar = null;
  const p1 = E.p1(seg(t, ph.p1[0], ph.p1[1]));
  th = TH1 * p1;
  if (t >= ph.down[0]) {
    const down = E.down(seg(t, ph.down[0], ph.down[1])); // le tablier arrive au contact
    const press = E.press(seg(t, ph.press[0], ph.press[1])); // puis écrase
    const up = E.up(seg(t, ph.up[0], ph.up[1])); // et remonte
    const contact = H150, top = 640;
    const hBar = t < ph.press[0] ? top + (contact - top) * down : t < ph.up[0] ? contact + (H - contact) * press : H + (top + 80 - H) * up;
    th = t < ph.press[0] ? TH1 : t < ph.up[0] ? thetaForHeight(Math.max(H, hBar)) : Math.PI;
    bar = { y: hBar, a: t < ph.up[0] ? 1 : 1 - clamp(up) };
  }
  if (t >= ph.up[0]) th = Math.PI;
  const pts = flange(th);
  const spread = Math.max(0, maxX(pts) + 46 - E_LEFT);
  const coteA = t < ph.p1[0] ? seg(t, 0, ph.p1[0] * 0.8) : t < ph.up[0] ? 1 : 1 - seg(t, ph.up[0], ph.up[1]);
  const tag = E.tag(seg(t, ph.tag[0], ph.tag[1]));
  return { th, pts, spread, bar, coteA, tag, final: t >= ph.up[1] };
}

// Dessin SVG (repère SVG : y vers le bas, origine en haut de capitale)
const fy = (y) => CAP - y;
const pathOf = (pts) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${fy(y).toFixed(1)}`).join(' L');
export const VIEW = { x0: -130, x1: 4570, y0: -150, y1: 1130 };
// Repos : la marge droite doit accueillir l'écartement de départ
const SPREAD0 = Math.max(0, maxX(flange(0)) + 46 - E_LEFT);

export function svgFrame(t, { ink = '#23292B', soft = '#666D70', bg = 'transparent', bar = '#9AA19B', tagline = 'Le pli juste.', font = "'Mona Sans', sans-serif", phases = PHASES, eases = {} } = {}) {
  const s = stateAt(t, phases, eases);
  const dl = -s.spread / 2, dr = s.spread / 2;
  let g = `<defs><clipPath id="sig-l"><rect x="${stemL - 2}" y="-20" width="${Lx + HEM.footEnd + 4 - stemL}" height="${CAP + 40}"/></clipPath></defs>`;
  // lettres O U R et le L (fût, pied plein jusqu'à la fente, couche basse) : décalés ensemble
  g += `<g transform="translate(${dl.toFixed(1)},0)">`;
  g += `<path d="${LOGO_REST.our}" fill="${ink}"/>`;
  if (s.final) g += `<path d="${LOGO.d}" fill="${ink}" clip-path="url(#sig-l)"/>`; // l'état final est le tracé exact du logotype
  else {
    g += `<path d="M${stemL},${fy(CAP)} L${stemR},${fy(CAP)} L${stemR},${fy(H)} L${xs},${fy(H)} L${xs},${fy(ts)} L${cx + 4},${fy(ts)} L${cx + 4},${fy(0)} L${stemL},${fy(0)} Z" fill="${ink}"/>`;
    g += `<path d="${pathOf(s.pts)}" fill="none" stroke="${ink}" stroke-width="${ts.toFixed(2)}" stroke-linejoin="round" stroke-linecap="butt"/>`;
  }
  // le tablier plat du second coup
  // outil plat : un corps clair et une face de contact plus sombre, juste au-dessus du bord à écraser
  if (s.bar && s.bar.a > 0.01) { const y = fy(s.bar.y); g += `<g opacity="${s.bar.a.toFixed(3)}"><rect x="${xs + 6}" y="${(y - 96).toFixed(1)}" width="${cx + r - xs + 24}" height="84" fill="${bar}"/><rect x="${xs + 6}" y="${(y - 14).toFixed(1)}" width="${cx + r - xs + 24}" height="14" fill="${soft}"/></g>`; }
  g += `</g>`;
  g += `<g transform="translate(${dr.toFixed(1)},0)"><path d="${LOGO_REST.et}" fill="${ink}"/></g>`;
  if (tagline && s.tag > 0.001) g += `<text x="${(VIEW.x0 + VIEW.x1) / 2}" y="${fy(-330)}" font-family="${font}" font-size="140" font-weight="560" fill="${ink}" text-anchor="middle" opacity="${s.tag.toFixed(3)}" transform="translate(0 ${(1 - s.tag) * 24})">${tagline}</text>`;
  return g;
}

export function mountSignature(svgEl, opts = {}) {
  const reduced = opts.reduced ?? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  svgEl.setAttribute('viewBox', `${VIEW.x0} ${VIEW.y0} ${VIEW.x1 - VIEW.x0} ${VIEW.y1 - VIEW.y0}`);
  let raf = 0, t0 = 0, cur = DURATION;
  const draw = (t) => { cur = t; svgEl.innerHTML = svgFrame(t, opts); };
  const loop = (now) => { if (!t0) t0 = now; const t = Math.min(DURATION, now - t0); draw(t); if (t < DURATION) raf = requestAnimationFrame(loop); else opts.onDone && opts.onDone(); };
  const api = {
    play() { cancelAnimationFrame(raf); if (reduced) { draw(DURATION); return; } t0 = 0; draw(0); raf = requestAnimationFrame(loop); },
    seek(t) { cancelAnimationFrame(raf); draw(clamp(t, 0, DURATION)); },
    get t() { return cur; },
  };
  draw(opts.start ?? (reduced ? DURATION : 0));
  return api;
}
export { SPREAD0 };
