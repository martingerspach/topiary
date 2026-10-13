// Ourlet · déclinaisons de l'identité, dessinées en code (SVG) : fourgon, veste de travail, plaque d'identification,
// bâche de salon, étiquette de colis, poinçon sur pièce. Toutes les couleurs viennent des tokens d'Ourlet.
// Idée commune : « nos pièces sont partout, notre nom nulle part ». Chaque objet remet le nom là où les pièces vont.
import { LOGO, SIGNE } from './marque.js';
import { filetPath, partView, camera, hex } from './part.js';
import { pupitre } from './pieces.js';

export const C = { ink: '#23292B', ink2: '#3A4245', vert: '#B9CEAC', vertD: '#9DB192', soufre: '#EEDB3C', turq: '#7FB0AE', beige: '#C5856D', tole: '#ECEDE6', tole50: '#F6F7F2', acier: '#C9CCC8', grav: '#3B4043' };
const logo = (x, y, w, fill) => `<svg x="${x}" y="${y}" width="${w}" height="${(w / LOGO.ratio).toFixed(2)}" viewBox="${LOGO.viewBox}"><path d="${LOGO.d}" fill="${fill}"/></svg>`;
const signe = (x, y, h, fill, flip = false) => `<svg x="${x}" y="${y}" width="${(h * SIGNE.ratio).toFixed(2)}" height="${h}" viewBox="${SIGNE.viewBox}"${flip ? ' style="transform-box:fill-box;transform-origin:center;transform:scaleX(-1)"' : ''}><path d="${SIGNE.d}" fill="${fill}"/></svg>`;
const txt = (x, y, s, size, { fill = C.ink, w = 500, fam = "'Mona Sans', system-ui, sans-serif", anchor = 'start', stretch = '100%', ls = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${fam}" font-size="${size}" font-weight="${w}" font-stretch="${stretch}" letter-spacing="${ls}" text-anchor="${anchor}" fill="${fill}">${s}</text>`;
const CODE = "'Hubot Sans', 'Mona Sans', system-ui, sans-serif";

// ---------- Fourgon de 3,5 t, vue de côté ----------
export function fourgon({ body = C.vert, ink = C.ink } = {}) {
  const glass = '#2C3437', line = '#9DB192';
  const lw = 430, lh = lw / LOGO.ratio;
  return `<svg viewBox="0 0 1000 360" role="img" aria-label="Fourgon d'Ourlet, vue de côté : caisse en RAL 6019, logotype anthracite, filet ourlé qui finit à l'arrière">
  <rect width="1000" height="360" fill="${C.tole}"/>
  <line x1="30" y1="337" x2="970" y2="337" stroke="#CDD0C8" stroke-width="2"/>
  <path d="M84,58 L722,58 Q742,58 754,72 L842,168 Q850,176 862,179 L908,190 Q928,195 930,216 L934,296 L80,296 L80,62 Q80,58 84,58 Z" fill="${body}"/>
  <path d="M735,74 Q742,70 748,78 L824,164 L735,164 Z" fill="${glass}"/>
  <line x1="726" y1="62" x2="726" y2="292" stroke="${line}" stroke-width="2.5"/>
  <line x1="480" y1="62" x2="480" y2="292" stroke="${line}" stroke-width="2.5"/>
  <line x1="480" y1="96" x2="722" y2="96" stroke="${line}" stroke-width="2"/>
  <path d="M742,150 h-18 v22 h18 Z" fill="${ink}"/>
  <path d="M905,206 L929,210 L931,236 L905,232 Z" fill="${C.tole50}"/>
  <rect x="80" y="196" width="9" height="52" fill="#C4523D"/>
  <path d="M80,272 L934,272 L936,300 L80,300 Z" fill="${ink}"/>
  <path d="M184,300 A64,64 0 0 1 312,300 Z M700,300 A64,64 0 0 1 828,300 Z" fill="${C.tole}"/>
  <circle cx="248" cy="300" r="46" fill="${ink}"/><circle cx="248" cy="300" r="19" fill="#8E958E"/>
  <circle cx="764" cy="300" r="46" fill="${ink}"/><circle cx="764" cy="300" r="19" fill="#8E958E"/>
  ${logo(118, 84, lw, ink)}
  ${txt(120, 84 + lh + 38, 'Découpe, pliage, soudure et peinture à Baume-les-Dames', 22, { w: 560 })}
  ${txt(120, 84 + lh + 68, '03 53 01 47 20', 22, { w: 450 })}
  <path d="${filetPath(80, 700, 246, 14, 'left')}" fill="${ink}" fill-rule="evenodd"/>
  </svg>`;
}

// ---------- Veste de travail, face et dos ----------
function jacketOutline(cx, neckFront) {
  const L = [[cx, neckFront], [cx - 35, 62], [cx - 115, 82], [cx - 188, 440], [cx - 140, 452], [cx - 100, 200], [cx - 100, 470], [cx, 476]];
  const R = L.slice(1, -1).reverse().map(([x, y]) => [2 * cx - x, y]);
  const pts = [...L, ...R];
  return 'M' + pts.map((p) => p.join(',')).join(' L') + ' Z';
}
export function veste({ fabric = C.ink, yoke = C.vert } = {}) {
  const parts = [];
  for (const [cx, side] of [[250, 'face'], [750, 'dos']]) {
    const id = `jk-${side}`, out = jacketOutline(cx, side === 'face' ? 96 : 70);
    let s = `<clipPath id="${id}"><path d="${out}"/></clipPath>`;
    s += `<path d="${out}" fill="${fabric}"/>`;
    s += `<g clip-path="url(#${id})"><rect x="${cx - 260}" y="0" width="520" height="146" fill="${yoke}"/>`;
    s += `<rect x="${cx - 260}" y="410" width="160" height="70" fill="${yoke}"/><rect x="${cx + 100}" y="410" width="160" height="70" fill="${yoke}"/></g>`; // poignets
    s += `<path d="${out}" fill="none" stroke="#11161A" stroke-width="2"/>`;
    // coutures d'emmanchure et de côté
    s += `<path d="M${cx - 100},200 L${cx - 118},96 M${cx + 100},200 L${cx + 118},96" stroke="#11161A" stroke-width="1.6" fill="none"/>`;
    s += `<line x1="${cx - 100}" y1="452" x2="${cx + 100}" y2="452" stroke="#11161A" stroke-width="1.6"/>`;
    if (side === 'face') {
      s += `<path d="M${cx - 38},58 Q${cx},44 ${cx + 38},58 L${cx + 30},76 Q${cx},64 ${cx - 30},76 Z" fill="${yoke}" stroke="#11161A" stroke-width="1.6"/>`;
      s += `<line x1="${cx}" y1="96" x2="${cx}" y2="476" stroke="${C.tole}" stroke-width="2.5" stroke-dasharray="3 3"/>`;
      for (const dx of [-1, 1]) {
        const x0 = dx < 0 ? cx - 84 : cx + 20;
        s += `<rect x="${x0}" y="176" width="64" height="70" fill="none" stroke="${C.tole}" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="4 3"/>`;
        s += `<rect x="${x0 - 2}" y="170" width="68" height="22" fill="${fabric}" stroke="${C.tole}" stroke-opacity=".45" stroke-width="1.5"/>`;
        s += `<rect x="${x0}" y="330" width="64" height="74" fill="none" stroke="${C.tole}" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="4 3"/>`;
      }
      s += logo(cx + 24, 214, 56, yoke);
    } else {
      s += `<path d="M${cx - 34},64 Q${cx},54 ${cx + 34},64" stroke="#11161A" stroke-width="1.6" fill="none"/>`;
      s += signe(cx - 22, 104, 14, C.ink);
      s += logo(cx - 84, 226, 168, yoke);
      s += txt(cx, 300, 'Tôlerie fine · Doubs', 17, { fill: C.tole, anchor: 'middle', w: 520 });
    }
    s += txt(cx, 508, side === 'face' ? 'Face' : 'Dos', 17, { fill: '#4D5558', anchor: 'middle', w: 500 });
    parts.push(s);
  }
  return `<svg viewBox="0 0 1000 520" role="img" aria-label="Veste de travail d'Ourlet, face et dos : tissu anthracite, empiècement et poignets en RAL 6019, logotype sur la poche et en grand dans le dos"><rect width="1000" height="520" fill="${C.tole}"/>${parts.join('')}</svg>`;
}

// ---------- Plaque d'identification, inox gravé au laser ----------
function datamatrix(x, y, n, size, seed = 7, fill = C.grav) {
  let s = '', r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const m = size / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const border = i === n - 1 || j === 0; // motif en L de repérage
    const clock = (i === 0 && j % 2 === 0) || (j === n - 1 && i % 2 === 1);
    if (border || clock || (i > 0 && j < n - 1 && rnd() > 0.52)) s += `<rect x="${(x + j * m).toFixed(2)}" y="${(y + i * m).toFixed(2)}" width="${(m + 0.2).toFixed(2)}" height="${(m + 0.2).toFixed(2)}" fill="${fill}"/>`;
  }
  return s;
}
export function plaque() {
  let s = `<rect width="640" height="340" fill="${C.tole}"/>`;
  s += `<rect x="40" y="30" width="560" height="280" rx="12" fill="${C.acier}"/>`;
  for (let i = 0; i < 46; i++) { const y = 36 + i * 6; s += `<line x1="46" y1="${y}" x2="594" y2="${y}" stroke="${i % 3 ? '#D2D5D1' : '#BFC2BE'}" stroke-width="1"/>`; }
  s += `<rect x="40" y="30" width="560" height="280" rx="12" fill="none" stroke="#A9ACA8" stroke-width="2"/>`;
  for (const [x, y] of [[62, 52], [578, 52], [62, 288], [578, 288]]) s += `<circle cx="${x}" cy="${y}" r="7" fill="${C.tole}" stroke="#9EA19D" stroke-width="2"/>`;
  s += logo(88, 62, 190, C.grav);
  const rows = [['Désignation', 'Pupitre de commande'], ['Référence', '3107-A'], ['Lot', '26-1041'], ['Matière', 'DC01, ép. 2 mm'], ['Finition', 'RAL 6019, poudre']];
  rows.forEach(([k, v], i) => { const y = 154 + i * 27; s += txt(88, y, k, 16, { fill: '#5A5F62', w: 480 }) + txt(208, y, v, 16, { fill: C.grav, w: 560, fam: i >= 1 && i <= 2 ? CODE : undefined }); });
  s += datamatrix(468, 136, 16, 104);
  s += txt(520, 262, 'Lot 26-1041', 15, { fill: C.grav, anchor: 'middle', fam: CODE, w: 500 });
  s += txt(88, 296, 'Fabriqué à Baume-les-Dames (Doubs)', 15, { fill: '#5A5F62', w: 480 });
  return `<svg viewBox="0 0 640 340" role="img" aria-label="Plaque d'identification en inox gravé : logotype, référence 3107-A, lot 26-1041, code de traçabilité">${s}</svg>`;
}

// ---------- Bâche de salon, 3 × 1 m ----------
export function bache() {
  const W = 960, H = 320, x0 = 20, y0 = 20;
  let s = `<rect width="1000" height="360" fill="${C.tole}"/>`;
  s += `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${C.vert}"/>`;
  s += `<rect x="${x0 + 640}" y="${y0}" width="${W - 640}" height="${H}" fill="${C.ink}"/>`;
  s += txt(x0 + 44, y0 + 92, 'Vos pièces en tôle,', 50, { w: 720, stretch: '118%', ls: -1.4 });
  s += txt(x0 + 44, y0 + 146, 'pliées juste.', 50, { w: 720, stretch: '118%', ls: -1.4 });
  s += txt(x0 + 46, y0 + 196, 'Découpe laser, pliage, soudure, peinture poudre', 19, { w: 520 });
  s += `<path d="${filetPath(x0, x0 + 600, y0 + 262, 14, 'right')}" fill="${C.ink}" fill-rule="evenodd"/>`;
  s += logo(x0 + 670, y0 + 40, 250, C.tole);
  s += txt(x0 + 672, y0 + 140, 'Apportez votre plan :', 19, { fill: C.tole, w: 600 });
  s += txt(x0 + 672, y0 + 166, 'nous le chiffrons', 19, { fill: C.tole, w: 450 });
  s += txt(x0 + 672, y0 + 192, 'devant vous.', 19, { fill: C.tole, w: 450 });
  s += txt(x0 + 672, y0 + 246, 'Baume-les-Dames (Doubs)', 16, { fill: '#C3C5BD', w: 450 });
  [C.soufre, C.vert, C.turq, C.beige].forEach((c, i) => { s += `<rect x="${x0 + 672 + i * 64}" y="${y0 + 270}" width="58" height="22" fill="${c}"/>`; });
  for (let i = 0; i <= 6; i++) for (const y of [y0 + 12, y0 + H - 12]) { const x = x0 + 12 + i * (W - 24) / 6; s += `<circle cx="${x}" cy="${y}" r="6" fill="${C.tole}" stroke="#8E958E" stroke-width="2.5"/>`; }
  s += `<text x="20" y="352" font-family="system-ui" font-size="15" fill="#4D5558">Bâche de 3 × 1 m, œillets tous les 50 cm.</text>`;
  return `<svg viewBox="0 0 1000 360" role="img" aria-label="Bâche de salon de 3 mètres sur 1 : à gauche « Vos pièces en tôle, pliées juste. » sur RAL 6019, à droite le logotype sur anthracite et l'invitation à apporter son plan">${s}</svg>`;
}

// ---------- Étiquette de colis ----------
function barcode(x, y, w, h, seed = 3) {
  let s = '', r = seed, cx = x;
  const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  while (cx < x + w - 4) { const bw = 1.4 + Math.floor(rnd() * 4) * 1.4; if (rnd() > 0.42) s += `<rect x="${cx.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${h}" fill="${C.ink}"/>`; cx += bw + 1.4; }
  return s;
}
export function etiquette() {
  // étiquette de 150 × 100 mm collée sur le carton, en paysage
  let s = `<rect width="640" height="340" fill="#C9A77C"/>`;
  s += `<rect x="40" y="26" width="560" height="288" fill="${C.tole50}"/>`;
  s += `<rect x="40" y="26" width="560" height="64" fill="${C.vert}"/>`;
  s += logo(62, 44, 150, C.ink);
  s += signe(530, 50, 15, C.ink);
  const kv = (x, y, k, v, o = {}) => txt(x, y, k, 15, { fill: '#4F575A', w: 480 }) + txt(x, y + 24, v, o.size || 17, { w: o.w || 620, fam: o.code ? CODE : undefined, stretch: o.stretch || '100%' });
  s += kv(62, 118, 'De', 'Ourlet, Baume-les-Dames (25)');
  s += kv(62, 172, 'Pour', 'Votre commande CF-2026-0412');
  s += kv(62, 226, 'Pièce', '3107-A, pupitre de commande', { code: true });
  s += `<line x1="356" y1="104" x2="356" y2="296" stroke="#C3C5BD" stroke-width="1.5"/>`;
  s += txt(378, 118, 'Quantité', 15, { fill: '#4F575A', w: 480 }) + txt(378, 152, '24', 32, { w: 700, stretch: '110%' });
  s += txt(476, 118, 'Lot', 15, { fill: '#4F575A', w: 480 }) + txt(476, 146, '26-1041', 19, { w: 600, fam: CODE });
  s += barcode(378, 178, 200, 70);
  s += txt(378, 270, '3 107 026 104 1', 15, { fam: CODE, w: 480 });
  s += txt(62, 292, 'Pliées et peintes à Baume-les-Dames', 15, { fill: '#4F575A', w: 480 });
  return `<svg viewBox="0 0 640 340" role="img" aria-label="Étiquette de colis sur un carton : bandeau RAL 6019 avec le logotype, expéditeur, commande, pièce 3107-A, quantité 24, lot, code-barres">${s}</svg>`;
}

// ---------- Poinçon : marquage par micropercussion sur la pièce ----------
const DOTFONT = { // 5 × 7, colonnes de bits (haut → bas)
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};
function dotText(str, x, y, p, dot) {
  let s = '';
  [...str].forEach((ch, k) => {
    const g = DOTFONT[ch] || DOTFONT[' '];
    g.forEach((row, i) => [...row].forEach((b, j) => {
      if (b === '1') { const cx = x + (k * 6 + j) * p, cy = y + i * p; s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${dot}" fill="#5F7155"/><circle cx="${(cx - dot * 0.35).toFixed(1)}" cy="${(cy - dot * 0.35).toFixed(1)}" r="${(dot * 0.45).toFixed(2)}" fill="#7E9172"/>`; }
    }));
  });
  return s;
}
export function poincon() {
  // un coin de la pièce peinte, vu de près : le retour plié en haut, un trou de fixation, le marquage frappé (signe + lot)
  let s = `<rect width="640" height="340" fill="${C.tole}"/>`;
  s += `<path d="M0,0 L640,0 L640,58 L0,92 Z" fill="${C.vertD}"/>`;           // retour plié, dans l'ombre
  s += `<path d="M0,92 L640,58 L640,66 L0,100 Z" fill="#AFC4A2"/>`;            // arrondi du pli, éclairé
  s += `<path d="M0,100 L640,66 L640,340 L0,340 Z" fill="${C.vert}"/>`;
  s += `<ellipse cx="560" cy="250" rx="22" ry="21" fill="${C.ink}"/><path d="M538,250 A22,21 0 0 1 582,250" fill="none" stroke="#8FA383" stroke-width="3"/>`;
  const sig = { x: 70, y: 168, h: 58 };
  const w = sig.h * SIGNE.ratio, r = sig.h / 2, gap = sig.h * 0.16, step = 7.5;
  const pts = [];
  for (let x = 0; x <= w - r; x += step) { pts.push([x, 0]); pts.push([x, sig.h]); }
  for (let a2 = -90; a2 <= 90; a2 += 12) { const t = (a2 * Math.PI) / 180; pts.push([w - r + r * Math.cos(t), r + r * Math.sin(t)]); }
  for (let y = step; y < sig.h; y += step) pts.push([0, y]);
  for (let x = w - r - sig.h * 1.7; x <= w - r; x += step) { pts.push([x, r - gap / 2 - 2.5]); pts.push([x, r + gap / 2 + 2.5]); }
  s += `<g transform="translate(${sig.x},${sig.y}) skewY(-3)">` + pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="#5F7155"/><circle cx="${(x - 0.9).toFixed(1)}" cy="${(y - 0.9).toFixed(1)}" r="1.1" fill="#7E9172"/>`).join('') + `</g>`;
  s += `<g transform="translate(286,172) skewY(-3)">${dotText('OU 26-1041', 0, 0, 5.4, 2)}</g>`;
  return `<svg viewBox="0 0 640 340" role="img" aria-label="Gros plan sur une pièce peinte en RAL 6019 : le signe d'Ourlet et le lot OU 26-1041, frappés par micropercussion près d'un trou de fixation">${s}</svg>`;
}

// ---------- Pièce ton sur ton (pour les planches) ----------
export function pieceTon(color = C.vert, { eye = [-300, -260, 300], size = 100 } = {}) {
  const cam = camera({ eye, target: [120, 70, 70], fov: 30 });
  const v = partView(pupitre(), { cam, size, color: hex(color), ink: [29, 33, 35], outline: 0.35, amb: 0.4, lift: 0.14 });
  return v;
}
