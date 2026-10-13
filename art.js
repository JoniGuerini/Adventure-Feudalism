'use strict';
// Base da arte: paleta, peças comuns (céu, sol, nuvens, cadeado), ícones gerais
// e as molduras da interface. Cada linha de produção desenha seus retratos,
// ícones e cena no próprio arquivo (art-comida.js, art-militar.js, ...).

const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;

const PAL = {
  out: C('#1b100b'),
  skin: ramp('#4a2420', '#7d3b2e', '#b4604a', '#dc8c66', '#f2b88e', '#fbd8b4'),
  blush: C('#de7a62'),
  straw: ramp('#4f2e14', '#85541f', '#b9842e', '#dfb24a', '#f3d47c', '#fff0bc'),
  band: ramp('#3a1216', '#6b2026', '#a03634', '#c75844'),
  hair: ramp('#1d100a', '#3b2114', '#5e371e', '#82502b', '#a46c3a'),
  linen: ramp('#463c4c', '#76697a', '#a99d92', '#d6c9ae', '#f1e7d0'),
  vest: ramp('#22130c', '#402418', '#663b22', '#8c5630', '#b07646'),
  scarf: ramp('#46121a', '#82222a', '#b83a34', '#de604a'),
  wheat: ramp('#5a3712', '#8a5c1c', '#bc8b2c', '#e0b446', '#f4d478', '#fff0b2'),
  sky: ramp('#3a68a2', '#4b80b5', '#6299c5', '#7db1d0', '#9fc8d8', '#c3dedb', '#e5ecd5'),
  grass: ramp('#1a3322', '#294d2e', '#3d6936', '#5a8841', '#80ab54', '#a8c86a'),
  tree: ramp('#10251a', '#1d3d24', '#2d5a2f', '#44773b', '#62944b'),
  far: ramp('#566e8c', '#68839e', '#7d99ae', '#97b1bd', '#b4c9c9'),
  stone: ramp('#3a3240', '#5b5260', '#80767a', '#a69a8f', '#cbbea9', '#e8dcc4'),
  wood: ramp('#24150e', '#432819', '#683f25', '#8e5a33', '#b37b47'),
  roof: ramp('#3a1414', '#64221f', '#8e3227', '#b64a32', '#d56c46'),
  sail: ramp('#7e715e', '#ad9f83', '#d4c6a6', '#efe4cb', '#fbf6e6'),
  iron: ramp('#22222a', '#45454f', '#6f707a', '#a3a5ac', '#d7d9dc'),
  gold: ramp('#4a2a10', '#7f5018', '#b98126', '#e5b342', '#f8dc7a', '#fff6c8'),
  cloud: ramp('#8ea6bb', '#b3c5d1', '#d6e1e4', '#eff3ee', '#fffdf6'),
  dirt: ramp('#3e2617', '#5f3b22', '#83573a', '#a87952', '#c99c70'),
  night: ramp('#100c14', '#18131f', '#221b2b', '#2e2438', '#3d3146'),
  // linha militar
  fire: ramp('#5a1a0a', '#a3300f', '#e0621a', '#f59e2e', '#ffd45e', '#fff4c0'),
  steel: ramp('#1f2430', '#3b4250', '#606a7a', '#8f99a8', '#c3cbd6', '#eef2f6'),
  leather: ramp('#2a160e', '#4a2817', '#6e3f22', '#94582f', '#b67645'),
  cobble: ramp('#221e28', '#38323e', '#524a58', '#6f6672', '#918690', '#b3a8ac'),
  dusk: ramp('#2a2850', '#463a6a', '#704a78', '#a65a76', '#d4746c', '#eea06a', '#f8cc8a'),
  duskCloud: ramp('#6a4a6e', '#9a6278', '#d08a84', '#f0b496', '#ffdcb8'),
  banner: ramp('#3e0f14', '#6e1a20', '#a32a2c', '#cf4438'),
  beard: ramp('#2a120c', '#4e2214', '#7a3a1e', '#a0542a', '#c47038'),
  // linha de alquimia
  herb: ramp('#14301c', '#20492a', '#2f6838', '#46884a', '#68a85a', '#94c874'),
  lavender: ramp('#2e1f4a', '#4b3474', '#6e52a0', '#9479c4', '#b9a2e0', '#ddd0f4'),
  hood: ramp('#142218', '#213a27', '#315636', '#467448', '#62945c'),
  auburn: ramp('#2a100c', '#4e1e14', '#7a321c', '#a64a26', '#cc6a38'),
  water: ramp('#1e3a5a', '#2a5a80', '#3e7ea2', '#62a6c2', '#a6d6e2', '#e8f8fa'),
  morning: ramp('#5a8ec2', '#6fa2cc', '#88b6d6', '#a6cade', '#c6dde2', '#e2ecdf', '#f4f2dc'),
  eyeWhite: C('#efe6d4'),
  iris: C('#25304a'),
  irisHi: C('#5a7698'),
  lip: C('#a24a3c'),
  sunCore: C('#fff7d8'),
  sunRim: C('#ffe39a'),
  glow: C('#ffcf6a'),
  haze: C('#f3edcf'),
  glass: C('#1c2330'),
  glassHi: C('#7d9ab6'),
};

// ---------------------------------------------------------------------------
// Peças de fundo reaproveitadas

function paintSky(p, y0, y1, r = PAL.sky, crisp = 1.5) {
  for (let y = y0; y < y1; y++) {
    const v = 0.08 + ((y - y0) / Math.max(1, y1 - y0 - 1)) * 0.92;
    for (let x = 0; x < p.w; x++) p.d[y * p.w + x] = pick(r, v, x, y, crisp);
  }
}

function paintSun(p, sx, sy, r) {
  const R = r * 2.4;
  for (let y = Math.floor(sy - R); y <= sy + R; y++) {
    for (let x = Math.floor(sx - R); x <= sx + R; x++) {
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d <= r) p.set(x, y, d < r - 1.3 ? PAL.sunCore : PAL.sunRim);
      else if (d < R && bayer(x, y) < (1 - (d - r) / (R - r)) * 0.6) p.set(x, y, PAL.haze);
    }
  }
}

function makeCloud(w, h, seed, r = PAL.cloud) {
  const p = new Pix(w, h);
  const base = h - 2;
  const blobs = [];
  const n = 3 + Math.floor(hash(seed, 1) * 3);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const rx = w * (0.16 + hash(seed, i + 2) * 0.12);
    const ry = Math.min(h - 3, rx * (0.75 + hash(seed, i + 9) * 0.3) * (1 - Math.abs(t - 0.5)));
    blobs.push([w * (0.15 + t * 0.7), base - ry * 0.8, rx, ry]);
  }
  p.fill(0, 0, w, base, (x, y) => blobs.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1),
    (x, y) => {
      let best = 0;
      for (const [cx, cy, rx, ry] of blobs) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) best = Math.max(best, sphereLight(nx, ny));
      }
      const bottom = (y - (base - 3)) / 3;
      return pick(r, 0.25 + best * 0.9 - Math.max(0, bottom) * 0.35, x, y, 1.8);
    });
  return p;
}


// ---------------------------------------------------------------------------
// Tier bloqueado: noite estrelada, silhueta do prédio e um cadeado na frente.
// drawSilhouette(p, corDoCorpo, corDaBorda) desenha o prédio de cada linha.

function paintLocked(ctx, drawSilhouette) {
  const p = new Pix(64, 64);
  paintSky(p, 0, 64, PAL.night, 1.2);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, 9) * 64), y = Math.floor(hash(i, 2, 9) * 30);
    p.set(x, y, i % 5 ? PAL.night[4] : C('#8a7d9a'));
  }
  p.ellipse(32, 92, 70, 36, PAL.night[0]);
  const body = C('#0b080b');
  drawSilhouette(p, body, C('#3a2e40'));
  // luz de contorno pelo lado esquerdo
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 33; x++) {
      if (p.get(x, y) === body) { p.set(x, y, C('#2c2232')); break; }
    }
  }
  const lock = new Pix(64, 64);
  lock.fill(24, 26, 40, 40, (x, y) => {
    const d = Math.hypot(x - 32, y - 35);
    return y < 39 && d <= 5.6 && d >= 3.4;
  }, (x, y) => pick(PAL.iron, 0.2 + sphereLight((x + 0.5 - 32) / 6, (y + 0.5 - 33) / 6) * 0.9, x, y));
  lock.rect(25, 38, 14, 12, (x, y) => pick(PAL.gold, 0.15 + cylLight((x + 0.5 - 32) / 7) * 0.85 + (y === 38 ? 0.2 : 0) - (y - 38) * 0.02, x, y));
  lock.rect(31, 42, 2, 3, C('#1a0f08'));
  lock.rect(31.5, 45, 1, 2, C('#1a0f08'));
  lock.outline(PAL.out);
  p.blit(lock, 0, 0);
  p.draw(ctx);
}

// Cadeado sobre a silhueta de um sprite de verdade: o gerador aparece só como
// sombra até ser liberado. makeSprite devolve um Pix 64x64 com fundo vazio.
function silhouette(makeSprite) {
  let sprite = null;
  return (ctx) => {
    if (!sprite) sprite = makeSprite();
    paintLocked(ctx, (p, body) => {
      for (let i = 0; i < sprite.d.length; i++) if (sprite.d[i]) p.d[i] = body;
    });
  };
}

// ---------------------------------------------------------------------------
// Ícones 16x16

// Seta para cima: liga um tier ao de baixo na linha de produção.
function iconArrow() {
  const p = new Pix(16, 16);
  p.poly([[8, 1], [15, 8.5], [10.5, 8.5], [10.5, 15], [5.5, 15], [5.5, 8.5], [1, 8.5]], (x, y) =>
    PAL.gold[x < 7 ? 4 : x < 9 ? 3 : 2] );
  p.set(7, 3, PAL.gold[5]);
  p.set(6, 4, PAL.gold[5]);
  p.outline(PAL.out);
  return p;
}

// Cadeado: linhas ainda fechadas.
function iconLock() {
  const p = new Pix(16, 16);
  p.fill(3, 1, 13, 9, (x, y) => {
    const d = Math.hypot(x - 8, y - 7);
    return y < 8 && d <= 4.6 && d >= 2.6;
  }, (x, y) => pick(PAL.iron, 0.3 + sphereLight((x + 0.5 - 8) / 5, (y + 0.5 - 5) / 5) * 0.8, x, y));
  p.rect(3, 7, 10, 8, (x, y) => pick(PAL.gold, 0.2 + cylLight((x + 0.5 - 8) / 5) * 0.8 + (y === 7 ? 0.2 : 0), x, y));
  p.rect(7, 10, 2, 2, C('#1a0f08'));
  p.set(7.5, 12, C('#1a0f08'));
  p.outline(PAL.out);
  return p;
}

// Coroa: a moeda dos marcos.
function iconCrown() {
  const p = new Pix(16, 16);
  const gold = (x, y) => pick(PAL.gold, 0.25 + cylLight((x + 0.5 - 7) / 7) * 0.75 - (y > 10 ? 0.15 : 0), x, y);
  p.poly([[1.5, 4.5], [5, 8.5], [8, 2.5], [11, 8.5], [14.5, 4.5], [13.5, 13], [2.5, 13]], gold);
  p.rect(3, 10, 10, 3, (x, y) => pick(PAL.gold, y === 10 ? 0.75 : 0.35 + cylLight((x + 0.5 - 7) / 7) * 0.4, x, y));
  const gem = (x, y, c, hi) => { p.set(x, y, c); p.set(x - 0.5, y - 0.5, hi); };
  for (const [x, y] of [[1, 3], [8, 1], [14, 3]]) p.rect(x, y, 2, 2, C('#c43a3a'));
  p.set(1, 3, C('#ff8a7a'));
  p.set(8, 1, C('#ff8a7a'));
  p.set(14, 3, C('#ff8a7a'));
  gem(8, 11, C('#3a6fd0'), C('#9cc4ff'));
  p.set(5, 11, C('#c43a3a'));
  p.set(11, 11, C('#2f9a5a'));
  p.set(6, 6, PAL.gold[5]);
  p.outline(PAL.out);
  return p;
}

// Ampulheta: a melhoria de ritmo (ciclo mais curto).
function iconHourglass() {
  const p = new Pix(16, 16);
  const wood = (x, y) => pick(PAL.wood, 0.35 + cylLight((x + 0.5 - 7) / 7) * 0.6, x, y);
  p.rect(2, 1, 12, 2, wood);
  p.rect(2, 13, 12, 2, wood);
  // vidro: dois cones que se encontram no meio
  const glass = (x, y) => {
    const cx = x - 7.5;
    const half = y < 8 ? 5 - (y - 3) * 0.9 : 1 + (y - 8) * 0.9;
    return Math.abs(cx) <= half;
  };
  p.fill(2, 3, 14, 13, glass, (x, y) => pick(PAL.sky, 0.7 + (x < 7 ? 0.2 : 0), x, y));
  // areia: pouca em cima, monte embaixo, fio no meio
  p.fill(2, 3, 14, 13, (x, y) => glass(x, y) && ((y >= 5 && y < 8) || (y >= 10 && Math.abs(x - 7.5) <= (y - 9) * 1.3)),
    (x, y) => pick(PAL.wheat, 0.5 + (x < 8 ? 0.25 : 0), x, y));
  p.rect(7, 8, 1, 3, PAL.wheat[4]);
  p.rect(2, 3, 1, 10, wood);
  p.rect(13, 3, 1, 10, wood);
  p.outline(PAL.out);
  return p;
}

// Saco cheio com espigas: a melhoria de fartura (mais produção por ciclo).
function iconSack() {
  const p = new Pix(16, 16);
  p.fill(0, 5, 16, 16, (x, y) => ((x - 7.5) / 6.2) ** 2 + ((y - 10.5) / 5) ** 2 <= 1,
    (x, y) => pick(PAL.straw, 0.15 + sphereLight((x + 0.5 - 6) / 6, (y + 0.5 - 8) / 5) * 0.75, x, y));
  // espigas saindo da boca
  for (const [x, h] of [[5, 4], [7, 5], [9, 4], [11, 3]]) {
    p.rect(x, 6 - h, 1, h, (xx, y) => (y % 2 ? PAL.wheat[4] : PAL.wheat[3]));
    p.set(x + 1, 6 - h + 1, PAL.wheat[2]);
  }
  p.rect(4, 5, 8, 2, (x, y) => pick(PAL.straw, y === 5 ? 0.7 : 0.4, x, y));
  p.rect(5, 7, 6, 1, PAL.band[2]); // corda
  p.set(10, 8, PAL.band[3]);
  p.outline(PAL.out);
  return p;
}

// Etiqueta de preço com seta para baixo: a melhoria de desconto.
function iconTag() {
  const p = new Pix(16, 16);
  p.poly([[1, 8], [6, 2.5], [15, 2.5], [15, 13.5], [6, 13.5]], (x, y) => pick(PAL.linen, 0.55 + (y < 6 ? 0.25 : 0) - (x > 12 ? 0.15 : 0), x, y));
  p.rect(4, 7, 2, 2, PAL.out); // furo
  p.line(4, 7, 1, 1, PAL.band[1]);
  // seta para baixo
  p.rect(9, 5, 3, 4, PAL.scarf[2]);
  p.poly([[7.5, 9], [13.5, 9], [10.5, 12.5]], PAL.scarf[2]);
  p.rect(9, 5, 1, 4, PAL.scarf[3]);
  p.outline(PAL.out);
  return p;
}

const ICONS = { arrow: iconArrow, lock: iconLock, crown: iconCrown, hourglass: iconHourglass, sack: iconSack, tag: iconTag }; // cada linha acrescenta os seus
const iconCache = {};

function iconCanvas(name, scale = 2) {
  if (!iconCache[name]) iconCache[name] = ICONS[name]();
  const c = iconCache[name].toCanvas(scale);
  c.className = 'px-icon';
  c.setAttribute('aria-hidden', 'true');
  return c;
}

// ---------------------------------------------------------------------------
// Molduras da interface (viram border-image) e padrões das barras

const UI_SCALE = 3;

function ringFrame(size, layers, center, opts = {}) {
  const p = new Pix(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(x, y, size - 1 - x, size - 1 - y);
      const lit = (y === d && x < size - 1 - d) || (x === d && y < size - 1 - d);
      const layer = layers[d];
      let c;
      if (layer) c = typeof layer === 'function' ? layer(x, y, lit) : layer;
      else c = typeof center === 'function' ? center(x, y) : center;
      if (c) p.set(x, y, c);
    }
  }
  if (opts.studs) {
    const s = size - 4;
    for (const [x, y] of [[2, 2], [s + 1, 2], [2, s + 1], [s + 1, s + 1]]) {
      p.set(x, y, PAL.gold[5]);
      p.set(x + 1, y, PAL.gold[3]);
      p.set(x, y + 1, PAL.gold[3]);
      p.set(x + 1, y + 1, PAL.gold[1]);
    }
  }
  return p;
}

// Cursores 16x16, desenhados em 2x (32px). o = contorno; números e letras são
// tons do ouro e do ferro, do escuro ao claro.
const CURSOR_ARROW = [
  'o.........',
  'oo........',
  'o5o.......',
  'o54o......',
  'o543o.....',
  'o5433o....',
  'o54333o...',
  'o543332o..',
  'o5433322o.',
  'o54332222o',
  'o543oooooo',
  'o54o43o...',
  'o5o.o43o..',
  'oo..o43o..',
  '.....o43o.',
  '.....ooo..',
];
const CURSOR_HAND = [
  '.....oo.........',
  '....oedo........',
  '....odco........',
  '....odco........',
  '....obbo........',
  '....odcooo.oo.o.',
  '....odcoedoedoeo',
  '.oo.odcodcbdcbco',
  'oedoodcbccbccbbo',
  'odccdcccccccccbo',
  '.odcccccccccccbo',
  '..odcccccccccbo.',
  '...obccccccbbo..',
  '...ohhhhhhhhgo..',
  '...ohgggggggfo..',
  '...oooooooooo...',
];

function buildFrames() {
  const dark = C('#120a07');
  const woodLayer = (bias) => (x, y, lit) => pick(PAL.wood, (lit ? 0.68 : 0.26) + bias + (hash(x, y, 13) - 0.5) * 0.18, x, y);
  const panel = (x, y) => (hash(x % 6, y % 6, 21) < 0.14 ? C('#33241a') : C('#2a1d15'));

  const frames = {
    wood: ringFrame(16, [PAL.out, woodLayer(0.14), woodLayer(0), woodLayer(-0.14), dark], panel, { studs: true }),
    gold: ringFrame(12, [PAL.out, (x, y, lit) => PAL.gold[lit ? 4 : 2], (x, y, lit) => PAL.gold[lit ? 3 : 1], dark], dark),
    slot: ringFrame(12, [PAL.out, (x, y, lit) => (lit ? C('#0b0705') : PAL.wood[2]), C('#1a110c'), C('#140d09')], C('#140d09')),
    go: ringFrame(12, [PAL.out, (x, y, lit) => C(lit ? '#b8de7a' : '#2f511b'), (x, y, lit) => C(lit ? '#8cc052' : '#477526'), C('#629a34')], C('#629a34')),
    goPress: ringFrame(12, [PAL.out, (x, y, lit) => C(lit ? '#2f511b' : '#8cc052'), C('#4f8029'), C('#568b2e')], C('#568b2e')),
    off: ringFrame(12, [PAL.out, (x, y, lit) => C(lit ? '#6a5444' : '#21160f'), (x, y, lit) => C(lit ? '#4f3d30' : '#2e2119'), C('#3a2b21')], C('#3a2b21')),
    tab: ringFrame(12, [PAL.out, (x, y, lit) => PAL.gold[lit ? 5 : 2], (x, y, lit) => PAL.gold[lit ? 4 : 3], PAL.gold[3]], PAL.gold[3]),
  };
  const slices = { wood: 5, gold: 4, slot: 4, go: 4, goPress: 4, off: 4, tab: 4 };

  const root = document.documentElement.style;
  for (const [name, pix] of Object.entries(frames)) {
    root.setProperty(`--fr-${name}`, `url(${pix.toCanvas(UI_SCALE).toDataURL()})`);
    root.setProperty(`--fr-${name}-s`, String(slices[name] * UI_SCALE));
  }

  // listras diagonais das barras de progresso (8x8, repetidas)
  const stripes = (r) => {
    const p = new Pix(8, 8);
    p.fill(0, 0, 7, 7, () => true, (x, y) => {
      let k = ((x + y) & 7) < 4 ? 3 : 2;
      if (y === 0) k += 2;
      else if (y === 1) k += 1;
      else if (y === 7) k -= 2;
      return r[Math.max(0, Math.min(r.length - 1, k))];
    });
    return `url(${p.toCanvas(UI_SCALE).toDataURL()})`;
  };
  root.setProperty('--bar-wheat', stripes(PAL.wheat));
  root.setProperty('--bar-grass', stripes(ramp('#1f3a1d', '#2f5a24', '#4c8a2f', '#6fae42', '#a3d466', '#d4f09a')));
  root.setProperty('--bar-ember', stripes(PAL.fire));
  root.setProperty('--bar-steel', stripes(PAL.steel));
  root.setProperty('--bar-herb', stripes(PAL.herb));
  root.setProperty('--bar-lavender', stripes(PAL.lavender));
  root.setProperty('--bar-roof', stripes(ramp('#3a1414', '#64221f', '#8e3227', '#b64a32', '#e07a52', '#f4a882')));
  root.setProperty('--bar-earth', stripes(ramp('#3e2617', '#5f3b22', '#83573a', '#a87952', '#d4a070', '#ecc89a')));
  root.setProperty('--bar-sky', stripes(PAL.sky));
  root.setProperty('--bar-stone', stripes(PAL.stone));
  root.setProperty('--bar-gold', stripes(PAL.gold));
  root.setProperty('--bar-copper', stripes(ramp('#3a1a0e', '#6a3018', '#9c4e26', '#c8763a', '#e0a060', '#f6d0a0')));
  root.setProperty('--bar-mint', stripes(ramp('#0e3a2e', '#1a5e48', '#2e8a68', '#4cb48a', '#7ad4b0', '#c4f4de')));
  root.setProperty('--bar-crystal', stripes(ramp('#0e2e4a', '#16507a', '#2482a8', '#3eb4cc', '#62d4e0', '#c8f6fa')));
  root.setProperty('--bar-cape', stripes(ramp('#141e48', '#20307a', '#3450a8', '#5a7ed0', '#8fb8f0', '#cfe2fc')));
  root.setProperty('--bar-water', stripes(PAL.water));
  root.setProperty('--bar-royal', stripes(ramp('#2a1240', '#46206a', '#6a3494', '#9a58c0', '#c890e0', '#ecc8f8')));

  // barra dos marcos: ouro liso com brilho em cima e uma junta a cada gomo
  const segments = (r) => {
    const p = new Pix(8, 8);
    p.fill(0, 0, 7, 7, () => true, (x, y) => {
      let k = y === 0 ? 5 : y === 1 ? 4 : y === 7 ? 1 : y === 6 ? 2 : 3;
      if (x === 7) k -= 1;
      return r[Math.max(0, Math.min(r.length - 1, k))];
    });
    return `url(${p.toCanvas(UI_SCALE).toDataURL()})`;
  };
  root.setProperty('--bar-crown', segments(PAL.gold));

  // cursores: seta de ouro e manopla de ferro apontando (para o que dá para clicar)
  const fromRows = (rows, colors) => {
    const p = new Pix(16, 16);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (colors[ch]) p.set(x, y, colors[ch]); }));
    return `url(${p.toCanvas(2).toDataURL()})`;
  };
  const arrow = fromRows(CURSOR_ARROW, { o: PAL.out, 2: PAL.gold[1], 3: PAL.gold[2], 4: PAL.gold[3], 5: PAL.gold[4] });
  const hand = fromRows(CURSOR_HAND, {
    o: PAL.out, b: PAL.iron[1], c: PAL.iron[2], d: PAL.iron[3], e: PAL.iron[4],
    f: PAL.gold[1], g: PAL.gold[2], h: PAL.gold[3],
  });
  root.setProperty('--cur-arrow', `${arrow} 0 0, default`);
  root.setProperty('--cur-hand', `${hand} 11 0, pointer`);

  // barra de rolagem: trilho de madeira com sulco, pegador dourado com tampas de
  // ferro e botões de seta. Tudo em 8 pixels de largura (24px na tela).
  const rail = new Pix(8, 16).fill(0, 0, 7, 15, () => true, (x, y) => {
    const grain = (hash(x, y >> 1, 41) - 0.5) * 0.16;
    if (x === 0 || x === 7) return PAL.out;
    if (x === 3) return C('#0b0705');
    if (x === 4) return C('#140d09');
    return pick(PAL.wood, [0, 0.72, 0.46, 0, 0, 0.2, 0.4][x] + grain, x, y);
  });
  rail.set(1, 8, PAL.iron[4]);
  rail.set(6, 8, PAL.iron[2]);
  const thumb = (bright) => {
    const p = new Pix(8, 12).fill(0, 0, 7, 11, () => true, (x, y) => {
      if (x === 0 || x === 7 || y === 0 || y === 11) return PAL.out;
      const edge = x === 1 ? 0.15 : x === 6 ? -0.3 : 0;
      if (y <= 3 || y >= 8) {
        const v = (y === 1 || y === 8 ? 0.85 : y === 3 || y === 10 ? 0.25 : 0.55) + edge;
        return pick(PAL.iron, v + bright, x, y);
      }
      return pick(PAL.gold, (x === 1 ? 0.9 : x === 6 ? 0.25 : 0.62) + bright, x, y);
    });
    for (const [x, y] of [[2, 2], [5, 2], [2, 9], [5, 9]]) p.set(x, y, PAL.iron[bright > 0 ? 4 : 3]);
    return p;
  };
  const grip = new Pix(4, 5).fill(0, 0, 3, 4, () => true, (x, y) => (y % 2 ? PAL.gold[5] : PAL.gold[1]));
  const arrowBtn = (down, pressed) => {
    const p = new Pix(8, 8).fill(0, 0, 7, 7, () => true, (x, y) => {
      if (x === 0 || x === 7 || y === 0 || y === 7) return PAL.out;
      const lit = y === 1 || x === 1, shade = y === 6 || x === 6;
      const v = pressed ? (lit ? 0.15 : shade ? 0.55 : 0.35) : (lit ? 0.78 : shade ? 0.18 : 0.46);
      return pick(PAL.wood, v, x, y);
    });
    const dy = pressed ? 1 : 0;
    const rows = down ? [[2, 5], [3, 4]] : [[3, 4], [2, 5]];
    rows.forEach(([a, b], i) => {
      for (let x = a; x <= b; x++) p.set(x, 3 + i + dy, PAL.gold[x === a ? 5 : 3]);
    });
    return p;
  };
  const url = (pix) => `url(${pix.toCanvas(UI_SCALE).toDataURL()})`;
  root.setProperty('--sb-rail', url(rail));
  root.setProperty('--sb-thumb', url(thumb(0)));
  root.setProperty('--sb-thumb-hot', url(thumb(0.12)));
  root.setProperty('--sb-grip', url(grip));
  root.setProperty('--sb-up', url(arrowBtn(false, false)));
  root.setProperty('--sb-up-press', url(arrowBtn(false, true)));
  root.setProperty('--sb-down', url(arrowBtn(true, false)));
  root.setProperty('--sb-down-press', url(arrowBtn(true, true)));

  // textura do fundo da página
  const bgTile = new Pix(16, 16).fill(0, 0, 15, 15, () => true, (x, y) => {
    const h = hash(x, y, 31);
    return h < 0.06 ? C('#241912') : h > 0.97 ? C('#1a120d') : C('#1e1510');
  });
  root.setProperty('--bg-tile', `url(${bgTile.toCanvas(UI_SCALE).toDataURL()})`);
}

// Registro: os arquivos de cada linha penduram aqui seus retratos, cadeados,
// ícones e cenas.
window.ART = {
  PAL, makeCloud, paintSky, paintSun, paintLocked, silhouette,
  portraits: {}, locked: {}, icons: ICONS,
  iconCanvas, buildFrames, UI_SCALE,
};
