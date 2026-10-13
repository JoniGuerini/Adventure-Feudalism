'use strict';
// Linha de produção: EXPLORAÇÃO (terras).
// Batedor (tier 1) desbrava terras, Acampamento (tier 2) forma batedores.
// Aqui ficam o ícone do mapa, os retratos, os ícones e a cena da costa selvagem.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun } = ART;

const OLIVE = ramp('#121a0e', '#1e2c16', '#30431f', '#465c28', '#607834', '#809646', '#a2b25e');
const PARCH = ramp('#5c3e22', '#8c683c', '#b8945c', '#dcc088', '#f0dcac', '#fcf2d6');
const INK = C('#4a2c16');
const MARK = ramp('#5a0e10', '#a8201c', '#e0402e', '#f47a5a');
const CANVAS = ramp('#3a3230', '#5c534c', '#83786a', '#ab9e86', '#cfc2a2', '#e9dfc0', '#faf5e2');
const OCHRE = ramp('#3a1e10', '#64341a', '#8e4e24', '#b46e32', '#d49248', '#ecba6e');
const BARK = ramp('#140e0b', '#241a13', '#382a1e', '#4e3c2a', '#685238', '#86704e');
const MIST = ramp('#16281e', '#1e3628', '#284632', '#36583e', '#4a6e4c', '#64885e', '#86a476', '#b0c494');
const FEATHER = ramp('#2a0e08', '#561a0e', '#8a3016', '#bc5022', '#e07c36', '#f4ac5c');
const CREAM = ramp('#8a7a62', '#c4b28e', '#eadcb8', '#fcf4dc');
const HAIR = ramp('#20140c', '#3c2612', '#5e3c1a', '#825626', '#a87436', '#c8964e');
const SUNSET = ramp('#22244a', '#343666', '#544478', '#82527a', '#b8646c', '#e08060', '#f4a462', '#fcce86');
const DUSK_PINE = ramp('#0e141c', '#152029', '#1d2c33', '#273a3e', '#344a48');
const DUSK_HILL = ramp('#2e2a4c', '#3c3658', '#4c4264', '#5e4e6c', '#745a72');
const DUSK_GRASS = ramp('#141c12', '#1e2a16', '#2c3a1a', '#3e4c20', '#566026', '#727432', '#948a44');
const SMOKE = ramp('#3a3644', '#58525e', '#7a7280', '#9e94a0', '#c2b8bc');
const LINING = C('#0e140b');
const TENT_DARK = C('#24160f');
const INSIDE = ramp('#24160f', '#3a2214', '#5a3418', '#82501f', '#a8702c');
const EYE = C('#33526e'), EYE_HI = C('#7aa0c0');
const FIREFLY = ramp('#6a8a2a', '#c8e050', '#f4ffa0');

// Chama com a base em (x, y): núcleo claro embaixo e a ponta dançando.
function paintFlame(f, x, y, t, h, w, live) {
  const sway = Math.sin(t * 6.3) * 0.7 + Math.sin(t * 11.9 + 1) * 0.4 * live;
  const hh = h + Math.sin(t * 8.7) * 0.7 * live + Math.sin(t * 14.3 + 2) * 0.4;
  const rows = Math.ceil(hh);
  for (let k = 0; k < rows; k++) {
    const r = k / hh;
    const half = Math.max(0.5, w * Math.pow(1 - r, 0.75) * (k === 0 ? 0.85 : 1));
    const cx = x + sway * r * r * 1.6;
    for (let px = Math.floor(cx - half); px <= cx + half; px++) {
      const u = Math.abs(px + 0.5 - cx) / half;
      f.set(px, y - k, pick(PAL.fire, 1.08 - r * 0.75 - u * 0.5, px, y - k, 1.4));
    }
  }
}

// Luz que pulsa: guarda, para cada pixel que muda entre a versão apagada e a acesa,
// um limiar. A cada quadro acendem os pixels com limiar abaixo do nível pedido.
function makeHalo(base, lit, threshold) {
  const idx = [], th = [], col = [];
  for (let y = 0; y < base.h; y++) {
    for (let x = 0; x < base.w; x++) {
      const i = y * base.w + x;
      if (base.d[i] === lit.d[i]) continue;
      idx.push(i);
      th.push(threshold(x, y) + (bayer(x, y) - 0.5) * 0.28);
      col.push(lit.d[i]);
    }
  }
  return { idx: Int32Array.from(idx), th: Float32Array.from(th), col: Uint32Array.from(col) };
}

function paintHalo(f, h, level) {
  const d = f.d;
  for (let k = 0; k < h.idx.length; k++) if (h.th[k] < level) d[h.idx[k]] = h.col[k];
}

// Brilho em cruz num ponto, com intensidade 0..1.
function paintGlint(f, x, y, s) {
  if (s <= 0.05) return;
  f.set(x, y, s > 0.4 ? C('#ffffff') : PAL.gold[5]);
  if (s > 0.4) {
    const c = s > 0.7 ? PAL.gold[5] : PAL.gold[4];
    f.set(x - 1, y, c); f.set(x + 1, y, c); f.set(x, y - 1, c); f.set(x, y + 1, c);
  }
}

const pulse = (t, period, width) => {
  const ph = (t % period) / width;
  return ph < 1 ? Math.sin(ph * Math.PI) : 0;
};

// ---------------------------------------------------------------------------
// Ícone do recurso: mapa de pergaminho aberto, com trilha e o X vermelho

function iconMap() {
  const p = new Pix(16, 16);
  // folha entre os dois rolos
  p.rect(3, 3, 10, 10, (x, y) => {
    let v = 0.76 - (x - 3) * 0.022 - (y - 3) * 0.01 + (hash(x, y, 5) - 0.5) * 0.12;
    if (y === 3) v += 0.1;
    if (y === 12) v -= 0.2;
    return pick(PARCH, v, x, y);
  });
  // mar no canto e uma mata
  for (const [x, y] of [[3, 3], [4, 3], [5, 3], [3, 4], [4, 4], [3, 5]]) p.set(x, y, PAL.water[x + y < 7 ? 2 : 3]);
  p.set(4, 3, PAL.water[4]);
  for (const [x, y, k] of [[11, 10, 3], [12, 10, 2], [11, 11, 2], [12, 11, 1], [10, 11, 3]]) p.set(x, y, PAL.tree[k]);
  // trilha tracejada até o X
  for (const [x, y] of [[4, 11], [5, 11], [6, 10], [7, 9], [7, 8], [8, 7]]) p.set(x, y, INK);
  // X vermelho
  for (const [x, y, k] of [[9, 4, 3], [11, 4, 2], [10, 5, 2], [9, 6, 2], [11, 6, 1]]) p.set(x, y, MARK[k]);
  // rolos nas pontas
  for (const x0 of [1, 13]) {
    p.rect(x0, 2, 2, 12, (x, y) => {
      const left = x === x0;
      if (y === 2 || y === 13) return PARCH[left ? 2 : 1];
      return PARCH[x0 === 1 ? (left ? 5 : 3) : (left ? 3 : 1)];
    });
  }
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Batedor

const AX = 32;

// Fachos de luz descendo pela copa, em diagonal.
const shaft = (x, y) => {
  const s = (((x - y * 0.55) % 21) + 21) % 21;
  return s < 5 ? Math.sin((s / 5) * Math.PI) : 0;
};

function buildScoutBackdrop() {
  const p = new Pix(64, 64);
  // névoa da mata, mais clara atrás da cabeça, onde a luz entra pela copa
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const glow = clamp01(1 - Math.hypot((x - 30) / 44, (y - 20) / 40));
      const v = 0.16 + glow * 0.74 + shaft(x, y) * 0.16 + (hash(x >> 2, y >> 2, 3) - 0.5) * 0.06;
      p.d[y * 64 + x] = pick(MIST, v, x, y, 1.6);
    }
  }
  // troncos distantes, sumindo na névoa
  for (const [x, w, b] of [[8, 2, 0.46], [15, 1, 0.56], [25, 2, 0.6], [41, 1, 0.58], [47, 2, 0.5], [55, 2, 0.44]]) {
    p.rect(x, 0, w, 64, (xx, yy) => pick(MIST, b - (yy / 64) * 0.1 + (xx === x ? 0.08 : 0) + shaft(xx, yy) * 0.12, xx, yy, 1.6));
  }
  // copa escura no alto, com nesgas de céu
  for (let i = 0; i < 16; i++) {
    const x = hash(i, 1, 51) * 72 - 4, y = hash(i, 2, 51) * 8 - 2;
    const r = 5 + hash(i, 3, 51) * 6;
    p.sphere(x, y, r, r * 0.7, PAL.tree, -0.3, 1.6);
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(hash(i, 4, 51) * 64), y = Math.floor(hash(i, 5, 51) * 6);
    p.set(x, y, C('#d4e4c0'));
    if (i % 2) p.set(x + 1, y, PAL.tree[4]);
  }
  // troncos de perto nas beiradas, com casca e luz pela esquerda
  for (const [x0, w] of [[-1, 5], [60, 5]]) {
    p.rect(x0, 2, w, 62, (x, y) => {
      const nx = (x + 0.5 - x0 - w / 2) / (w / 2);
      let v = 0.1 + cylLight(nx) * 0.55 + (hash(x, y >> 2, 52) - 0.5) * 0.12;
      if ((x * 3 + (y >> 1)) % 7 === 0) v -= 0.14; // sulcos
      return pick(BARK, v, x, y);
    });
  }
  // galhos com folhas pendendo
  for (const [x, y, d] of [[3, 15, 1], [60, 22, -1], [3, 33, 1]]) {
    p.line(x, y, x + d * 7, y - 3, BARK[3]);
    for (let k = 0; k < 4; k++) p.sphere(x + d * (3 + k * 1.7), y - 3 + (k % 2) * 2, 1.9, 1.4, PAL.herb, -0.05, 1.6);
  }
  // samambaias no chão, dos lados
  for (const [x0, d] of [[4, 1], [60, -1]]) {
    for (let k = 0; k < 9; k++) {
      const x = x0 + d * k * 1.3, y = 50 - Math.sin((k / 8) * Math.PI) * 5 + k * 0.5;
      p.set(x, y, PAL.herb[3]);
      p.set(x, y + 1, PAL.herb[2]);
      if (k % 2 === 0) { p.set(x, y - 1, PAL.herb[4]); p.set(x + d, y + 2, PAL.herb[1]); }
    }
  }
  return p;
}

// ombros caindo para os lados
const shoulderTop = (x) => {
  const d = Math.max(0, Math.abs(x + 0.5 - AX) - 6) / 26;
  return 45.5 + 12 * d * d;
};
// barra da capa recortada em folhas
const tongue = (x) => {
  const u = ((((x - 2) % 7) + 7) % 7) / 7;
  return Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2));
};
// capuz: arco quebrado em cima (a ponta tomba um pouco para trás) e elipse embaixo
const inScoutHood = (x, y) => {
  if (y >= 31) return ((x - AX) / 16) ** 2 + ((y - 31) / 17.5) ** 2 <= 1;
  const sx = x - (31 - y) * 0.14;
  return (sx - AX - 5) ** 2 + (y - 31) ** 2 <= 441 && (sx - AX + 5) ** 2 + (y - 31) ** 2 <= 441;
};
const inScoutOpening = (x, y) => ((x - AX) / 10.4) ** 2 + ((y - 34.5) / 12.6) ** 2 <= 1;
const inScoutFace = (x, y) => {
  const dy = (y - 35.5) / 9.8;
  const rx = dy > 0 ? 7.8 * (1 - 0.28 * dy * dy) : 7.8;
  return ((x - AX) / rx) ** 2 + dy * dy <= 1;
};

// Olhos: gaze -1 olha para a esquerda, 1 para a direita.
function scoutEyes(p, closed, gaze) {
  for (const x0 of [27, 35]) {
    const left = x0 === 27;
    if (closed) {
      for (let i = 0; i < 3; i++) {
        p.set(x0 + i, 32, PAL.skin[3]);
        p.set(x0 + i, 33, HAIR[1]);
        p.set(x0 + i, 34, PAL.skin[left ? 3 : 2]);
      }
      continue;
    }
    for (let i = 0; i < 3; i++) p.set(x0 + i, 32, HAIR[1]);
    const ix = gaze < 0 ? 0 : gaze > 0 ? 1 : left ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      const iris = i === ix || i === ix + 1;
      p.set(x0 + i, 33, iris ? (i === ix ? EYE_HI : EYE) : PAL.eyeWhite);
      p.set(x0 + i, 34, iris ? EYE : PAL.skin[left ? 3 : 2]);
    }
  }
}

// Pena presa no capuz. ang = inclinação (0 = em pé), girando em volta da base.
function paintFeather(f, bx, by, ang) {
  const L = 17;
  const dx = Math.sin(ang), dy = -Math.cos(ang);
  const nx = -dy, ny = dx;
  const x0 = Math.floor(Math.min(bx, bx + dx * L) - 3), x1 = Math.ceil(Math.max(bx, bx + dx * L) + 3);
  const y0 = Math.floor(Math.min(by, by + dy * L) - 3), y1 = Math.ceil(Math.max(by, by + dy * L) + 3);
  const half = (s) => (s < 0.14 ? 0.6 : 2.1 * Math.pow(Math.sin(Math.PI * Math.min(1, (s - 0.08) * 1.05)), 0.55));
  f.fill(x0, y0, x1, y1, (x, y) => {
    const ax = x - bx, ay = y - by;
    const s = (ax * dx + ay * dy) / L, b = ax * nx + ay * ny;
    return s >= -0.06 && s <= 1 && Math.abs(b) <= Math.max(0.6, half(s));
  }, (x, y) => {
    const ax = x + 0.5 - bx, ay = y + 0.5 - by;
    const s = (ax * dx + ay * dy) / L, b = ax * nx + ay * ny;
    if (s < 0.14 || Math.abs(b) < 0.5) return CREAM[s > 0.8 ? 1 : 2];
    // listras de faisão, inclinadas como as barbas da pena
    const band = Math.floor(s * 7 + Math.abs(b) * 0.3) % 2;
    const v = 0.55 + (b < 0 ? 0.2 : -0.12) - (s > 0.86 ? 0.3 : 0);
    return band ? pick(FEATHER, v, x, y) : CREAM[b < 0 ? 3 : 2];
  });
}

const FEATHER_AT = [21, 24, -0.5];
const bowAt = (s) => [46 + 10 * s + 4.5 * Math.sin(Math.PI * s) + Math.max(0, s - 0.88) * 18, 52 - 42 * s];

function buildScout(withFeather = false) {
  const p = new Pix(64, 64);
  // arco preso nas costas, passando do ombro direito
  for (let s = 0; s <= 1; s += 0.004) {
    const [x, y] = bowAt(s);
    if (s > 0.95) { p.set(x, y, CREAM[2]); continue; }
    p.set(x, y, PAL.wood[4]);
    p.set(x + 1, y, PAL.wood[2]);
    if (s < 0.6) p.set(x + 2, y, PAL.wood[1]);
  }
  // gibão de couro
  p.fill(0, 44, 63, 63, (x, y) => y >= shoulderTop(x), (x, y) =>
    pick(PAL.leather, 0.5 - ((x + 0.5 - AX) / 30) * 0.4 - (y - 54) * 0.01 + (hash(x, y, 7) - 0.5) * 0.1, x, y));
  // cordão cruzado no peito
  for (let y = 52; y < 64; y++) {
    p.set(31, y, PAL.leather[1]);
    p.set(33, y, PAL.leather[0]);
    if (y % 3 === 1) { p.set(31, y, CREAM[1]); p.set(33, y, CREAM[1]); p.set(32, y + 1, CREAM[2]); }
  }
  // capa curta, aberta em V embaixo do broche, com a barra em folhas
  const inCape = (x, y) => y >= shoulderTop(x) && y < shoulderTop(x) + 7.5 + tongue(x) * 3.2 && !(y > 50 && Math.abs(x - AX) < (y - 50) * 0.55);
  p.fill(0, 44, 63, 63, inCape, (x, y) => {
    const nx = (x + 0.5 - AX) / 30;
    const top = shoulderTop(x);
    let v = 0.6 - nx * 0.42 - (y - top) * 0.02 + (hash(x, y, 8) - 0.5) * 0.08;
    if (y - top < 1.5 && nx < 0.3) v += 0.15;
    if (!inCape(x, y + 1)) v -= 0.22;
    return pick(OLIVE, v, x, y);
  });
  // capuz pontudo
  p.fill(14, 8, 50, 50, inScoutHood, (x, y) => {
    let v = 0.1 + sphereLight((x + 0.5 - AX) / 16, (y + 0.5 - 28) / 18) * 1.0 + (hash(x, y, 9) - 0.5) * 0.07;
    // costura central, que acompanha a ponta inclinada
    if (y < 21 && Math.abs(x - AX - (31 - y) * 0.14) < 0.5) v -= 0.16;
    // borda dobrada em volta do rosto
    if (((x + 0.5 - AX) / 12) ** 2 + ((y + 0.5 - 34.3) / 14.2) ** 2 < 1) v += 0.16;
    return pick(OLIVE, v, x, y);
  });
  p.fill(20, 20, 44, 48, inScoutOpening, LINING);
  // cabelo castanho: franja de lado e mechas nas têmporas
  p.fill(20, 20, 44, 42, (x, y) => inScoutOpening(x, y) && !(inScoutFace(x, y) && y > 27.4 - (x - 24) * 0.1) && y < 38.5, (x, y) => {
    let v = 0.5 - (x - AX) * 0.03 + (hash(x, y, 10) - 0.5) * 0.2 - (y - 24) * 0.02;
    if ((x * 2 + y) % 5 === 0) v += 0.22;
    return pick(HAIR, v, x, y);
  });
  // rosto queimado de sol
  p.fill(23, 26, 41, 46, (x, y) => inScoutFace(x, y) && y > 27.4 - (x - 24) * 0.1, (x, y) => {
    let v = 0.36 + sphereLight((x + 0.5 - AX) / 7.8, (y + 0.5 - 34) / 9.8) * 0.85;
    if (y < 30) v -= 0.22; // sombra da franja
    return pick(PAL.skin, v, x, y);
  });
  // barba por fazer no queixo e na mandíbula
  p.fill(23, 37, 41, 46, (x, y) => inScoutFace(x, y) && y > 38 && !(Math.abs(x + 0.5 - AX) < 3.2 && y < 41), (x, y) =>
    hash(x, y, 11) < 0.45 ? PAL.skin[y > 43 || Math.abs(x + 0.5 - AX) > 5.5 ? 1 : 2] : 0);
  // sobrancelhas firmes
  for (const [x, y] of [[26, 30], [27, 30], [28, 30], [29, 30], [30, 31]]) {
    p.set(x, y, HAIR[1]);
    p.set(64 - x, y, HAIR[1]);
  }
  p.set(27, 30, HAIR[3]);
  scoutEyes(p, false, 0);
  // nariz reto
  for (const [x, y, k] of [[32, 33, 4], [32, 34, 4], [32, 35, 5], [33, 34, 2], [33, 35, 2], [31, 36, 2], [32, 36, 3], [33, 36, 1], [32, 37, 2]]) p.set(x, y, PAL.skin[k]);
  // boca de canto, meio sorriso
  for (const [x, y] of [[30, 39], [31, 39], [32, 39], [33, 39], [34, 38]]) p.set(x, y, PAL.skin[0]);
  for (const x of [31, 32]) p.set(x, 40, PAL.lip);
  // marca de sol na maçã do rosto
  for (const [x, y] of [[26, 36], [37, 36], [38, 35]]) p.set(x, y, PAL.blush);
  // broche de rosa dos ventos fechando a capa
  for (const [x, y, k] of [[32, 45, 5], [32, 46, 4], [29, 48, 4], [30, 48, 4], [34, 48, 2], [35, 48, 2], [32, 50, 2], [32, 51, 1],
    [31, 47, 4], [33, 47, 3], [31, 49, 3], [33, 49, 1]]) p.set(x, y, PAL.gold[k]);
  p.set(32, 47, PAL.gold[5]); p.set(31, 48, PAL.gold[4]); p.set(33, 48, PAL.gold[2]); p.set(32, 49, PAL.gold[2]);
  p.set(32, 48, PAL.water[4]);
  // corda do arco: do topo até o ombro e depois cruzando o peito
  const [tx, ty] = bowAt(0.97);
  p.line(tx - 1, ty, 46, 47, CREAM[2]);
  p.line(46, 47, 18, 64, (x, y) => CREAM[(x + y) % 3 ? 2 : 1]);
  if (withFeather) paintFeather(p, ...FEATHER_AT);
  p.outline(PAL.out);
  return p;
}

const scoutArt = { bg: null, body: null, frame: new Pix(64, 64), feather: new Pix(22, 26) };

function paintScoutPortrait(ctx, t, info) {
  const a = scoutArt;
  if (!a.bg) {
    a.bg = buildScoutBackdrop();
    a.body = buildScout();
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  // poeira dourada flutuando nos fachos de luz
  for (let k = 0; k < (working ? 16 : 9); k++) {
    const life = (t * (0.04 + hash(k, 1, 53) * 0.05) + hash(k, 2, 53)) % 1;
    const x = 4 + hash(k, 3, 53) * 56 + Math.sin(t * 0.7 + k) * 2, y = 4 + life * 46;
    if (shaft(Math.floor(x), Math.floor(y)) > 0.25) f.set(x, y, k % 3 ? C('#e8f0b0') : PAL.gold[5]);
  }
  // folhas caindo
  for (let k = 0; k < 5; k++) {
    const life = (t * (0.07 + hash(k, 1, 54) * 0.05) + hash(k, 2, 54)) % 1;
    const x = hash(k, 3, 54) * 64 + Math.sin(t * 1.4 + k * 2) * 4, y = life * 70 - 4;
    const c = k % 3 === 0 ? PAL.gold[3] : PAL.herb[4];
    f.set(x, y, c);
    f.set(x + (Math.sin(t * 2.2 + k) > 0 ? 1 : -1), y + (k % 2), c);
  }
  f.blit(a.body, 0, 0);
  // olhar varrendo a mata e piscadas
  const g = Math.sin(t * (working ? 0.8 : 0.4) + 0.6);
  const gaze = g > 0.55 ? 1 : g < -0.55 ? -1 : 0;
  const blink = t % 4.4 > 4.26 || t % 9.7 > 9.56;
  if (blink || gaze) scoutEyes(f, blink, gaze);
  // pena balançando ao vento
  const fp = a.feather.clear();
  const wind = Math.sin(t * (working ? 2.1 : 1.3)) * 0.08 + Math.sin(t * 3.7 + 1) * 0.03;
  paintFeather(fp, FEATHER_AT[0] - 6, FEATHER_AT[1] - 4, FEATHER_AT[2] + wind);
  fp.outline(PAL.out);
  f.blit(fp, 6, 4);
  // brilho no broche
  paintGlint(f, 32, 48, pulse(t, working ? 3.1 : 5.2, 0.5) * 0.8);
  f.draw(ctx);
}

function iconScout() {
  const p = new Pix(16, 16);
  // capuz verde pontudo, inclinado para trás
  p.fill(0, 0, 16, 16, (x, y) => ((x - 8) / 7) ** 2 + ((y - 9.5) / 6.3) ** 2 <= 1 || (y > 0.5 && y < 5 && Math.abs(x - 8.5 - (5 - y) * 0.5) < (y - 0.5) * 1.1), (x, y) =>
    pick(OLIVE, 0.2 + sphereLight((x + 0.5 - 8) / 7, (y + 0.5 - 7.5) / 7) * 0.95, x, y));
  p.ellipse(8, 10.4, 4.2, 4.6, LINING);
  p.fill(4, 7, 12, 15, (x, y) => ((x - 8) / 3.3) ** 2 + ((y - 10.8) / 3.8) ** 2 <= 1, (x, y) => pick(PAL.skin, y < 8 ? 0.3 : 0.72 - (x - 7) * 0.06, x, y));
  for (const x of [5, 6, 7, 8]) p.set(x, 7, HAIR[3]);
  p.set(4, 8, HAIR[2]);
  p.set(6, 10, EYE);
  p.set(9, 10, EYE);
  p.set(7, 13, PAL.skin[1]);
  p.set(8, 13, PAL.skin[1]);
  // pena
  for (const [x, y, c] of [[3, 6, FEATHER[3]], [2, 5, CREAM[3]], [2, 4, FEATHER[3]], [1, 3, FEATHER[4]], [1, 2, CREAM[3]], [0, 1, FEATHER[2]], [3, 5, FEATHER[2]], [2, 3, FEATHER[2]]]) p.set(x, y, c);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Acampamento

const FIRE = [44, 57]; // base da fogueira
const TENT = { a: [24, 19], bl: [10, 50], br: [36, 50], b: [40, 22], bb: [50, 47] };
const DOOR = [[24, 28], [18.5, 50.5], [29.5, 50.5]];

const campLight = (glow) => (x, y) => glow * 0.55 * clamp01(1 - Math.hypot((x + 0.5 - FIRE[0]) * 0.8, (y + 0.5 - FIRE[1]) * 1.25) / 22) ** 1.4;

function buildCampBackdrop(glow) {
  const p = new Pix(64, 64);
  const light = campLight(glow);
  paintSky(p, 0, 46, SUNSET, 2.2);
  // fiapos de nuvem tingidos pelo poente
  for (const [x0, y0, w] of [[2, 10, 20], [34, 6, 18], [40, 21, 22], [6, 26, 14]]) {
    for (let x = x0; x < x0 + w; x++) {
      const e = Math.sin(((x - x0) / w) * Math.PI);
      p.set(x, y0, PAL.duskCloud[e > 0.6 ? 3 : 2]);
      if (e > 0.45) p.set(x + 1, y0 + 1, PAL.duskCloud[1]);
    }
  }
  // brilho do sol que acabou de se pôr, à direita
  p.fill(36, 32, 63, 46, (x, y) => Math.hypot((x - 58) / 1.6, y - 46) < 12, (x, y) =>
    bayer(x, y) < 1 - Math.hypot((x - 58) / 1.6, y - 46) / 12 ? SUNSET[7] : 0);
  // morros ao longe
  for (let x = 0; x < 64; x++) {
    const top = Math.round(38 + 2.5 * Math.sin(x * 0.09 + 1) + 1.5 * Math.sin(x * 0.27));
    for (let y = top; y < 48; y++) p.set(x, y, pick(DUSK_HILL, (y === top ? 0.95 : 0.55) - (y - top) * 0.05 + (x > 44 ? 0.12 : 0), x, y));
  }
  // pinheiros recortados contra o poente, com a borda direita acesa
  for (let i = 0; i < 16; i++) {
    const x = Math.round(i * 4.4 - 2 + hash(i, 1, 61) * 3), h = 7 + Math.floor(hash(i, 2, 61) * 11);
    const base = 48, half = h * 0.3;
    p.poly([[x - half, base], [x, base - h], [x + half, base]], (xx, yy) => {
      let v = 0.4 - ((xx - x) / half) * 0.15;
      if ((yy - (base - h)) % 3 === 0) v -= 0.25;
      if (xx > x + half * 0.5 && (yy - (base - h)) % 3 !== 0) return x > 40 ? SUNSET[4] : DUSK_PINE[4];
      return pick(DUSK_PINE, v, xx, yy);
    });
  }
  // clareira: capim escurecendo e terra batida em volta do fogo
  for (let y = 46; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const l = light(x, y);
      const fire = Math.hypot((x - FIRE[0]) / 13, (y - FIRE[1] - 1) / 5);
      if (fire < 1 + (hash(x, y, 62) - 0.5) * 0.3) {
        p.set(x, y, pick(PAL.dirt, 0.25 + l * 1.3 + (hash(x, y, 63) - 0.5) * 0.25, x, y));
        continue;
      }
      let v = 0.3 + (y - 46) * 0.014 + l * 1.2 + (hash(x, y, 64) - 0.5) * 0.24;
      if ((x * 3 + y * 5) % 11 === 0) v -= 0.12;
      p.set(x, y, pick(DUSK_GRASS, v, x, y, 1.6));
    }
  }
  // tufos de capim
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, 1, 65) * 64), y = 48 + Math.floor(hash(i, 2, 65) * 16);
    const c = DUSK_GRASS[Math.min(6, 4 + Math.round(light(x, y) * 3))];
    p.set(x, y, c);
    p.set(x - 1, y + 1, c);
    p.set(x + 1, y + 1, DUSK_GRASS[3]);
  }
  return p;
}

function buildCamp(glow = 0) {
  const p = new Pix(64, 64);
  const light = campLight(glow);
  const { a, bl, br, b, bb } = TENT;
  // barraca pequena de lona ocre, mais ao fundo
  p.poly([[56, 31], [64.5, 33], [64.5, 47], [62, 48.5]], (x, y) => pick(OCHRE, 0.22 + light(x, y) * 0.8 - (y % 4 === 0 ? 0.08 : 0), x, y));
  p.poly([[56, 31], [49, 48.5], [63, 48.5]], (x, y) => {
    let v = 0.6 - (y - 31) * 0.006 + light(x, y) - (x - 52) * 0.012;
    if (Math.abs(x + 0.5 - 56 + (y - 31) * 0.06) < 0.6) v -= 0.25;
    return pick(OCHRE, v, x, y);
  });
  p.poly([[56, 37], [53.5, 48.5], [58.5, 48.5]], (x, y) => pick(OCHRE, 0.05 + (y - 37) * 0.012, x, y));
  // barraca grande: lado na sombra, com as costuras correndo ao longo da cumeeira
  const rl = Math.hypot(b[0] - a[0], b[1] - a[1]);
  p.poly([a, b, bb, br], (x, y) => {
    const u = ((y + 0.5 - a[1]) * (b[0] - a[0]) - (x + 0.5 - a[0]) * (b[1] - a[1])) / rl; // distância até a cumeeira
    let v = 0.33 - u * 0.003 + light(x, y) * 0.55;
    if (u % 6.5 < 0.9 && u > 2) v -= 0.1;
    const edge = b[0] + (y - b[1]) * ((bb[0] - b[0]) / (bb[1] - b[1]));
    if (x > edge - 1.6) v += 0.16; // borda acesa pelo poente
    return pick(CANVAS, v, x, y, 3);
  });
  // frente iluminada, com costuras saindo do topo e a barra reforçada
  p.poly([a, bl, br], (x, y) => {
    const dy = y + 0.5 - a[1];
    let v = 0.86 - (x - a[0]) * 0.006 - (y - a[1]) * 0.004 + light(x, y) * 0.8;
    if (Math.abs(x + 0.5 - a[0] + dy * 0.29) < 0.5 || Math.abs(x + 0.5 - a[0] - dy * 0.29) < 0.5) v -= 0.2;
    if (y > 47) v -= 0.14;
    if (hash(x, y, 66) < 0.03) v -= 0.08;
    return pick(CANVAS, v, x, y, 3);
  });
  // porta aberta: interior escuro e as abas presas dos lados
  p.poly(DOOR, TENT_DARK);
  p.poly([[24, 28], [18.5, 50.5], [15.5, 50.5], [21, 34]], (x, y) => pick(CANVAS, 0.56 - (y - 28) * 0.004, x, y));
  p.poly([[24, 28], [29.5, 50.5], [32.5, 50.5], [27, 34]], (x, y) => pick(CANVAS, 0.42 + light(x, y), x, y));
  for (const [x, y] of [[17, 41], [18, 41], [30, 41], [31, 41]]) p.set(x, y, PAL.leather[2]);
  // mastro com a ponta para fora
  p.line(a[0], a[1], b[0], b[1], PAL.wood[1]);
  p.rect(a[0], a[1] - 7, 1, 8, (x, y) => PAL.wood[y < a[1] - 5 ? 4 : 3]);
  // tripé
  for (const [x1, y1] of [[37, 59], [51, 59], [46, 61]]) p.line(FIRE[0], 42, x1, y1, (x, y) => PAL.wood[(x + y) % 3 ? 2 : 1]);
  p.set(FIRE[0], 41, PAL.wood[3]);
  // pedras da fogueira
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2;
    if (Math.sin(ang) < -0.3) continue;
    const sx = FIRE[0] + Math.cos(ang) * 6, sy = FIRE[1] + 1 + Math.sin(ang) * 2;
    p.sphere(sx, sy, 1.6, 1.2, PAL.stone, -0.1 + light(sx, sy) * 0.8);
  }
  p.line(39, 58, 48, 56, PAL.wood[2]);
  p.line(40, 56, 49, 58, PAL.wood[1]);
  // caixote com um mapa enrolado em cima
  p.rect(23, 54, 10, 6, (x, y) => {
    let v = 0.45 - (x - 23) * 0.02 + light(x, y) + (y === 54 ? 0.25 : 0);
    if (y === 57 || x === 23 || x === 32) v -= 0.22;
    return pick(PAL.wood, v, x, y);
  });
  p.fill(22, 51, 34, 54, (x, y) => y > 51 && y < 54 && x > 22.5 && x < 33.5, (x, y) => pick(PARCH, y === 52 ? 0.85 : 0.45, x, y));
  p.rect(22, 52, 1, 2, PARCH[1]);
  p.rect(27, 52, 1, 2, MARK[1]);
  // mochila encostada na barraca, com o cobertor enrolado em cima
  p.fill(1, 44, 13, 61, (x, y) => ((x - 7) / 5.6) ** 4 + ((y - 52.5) / 8) ** 4 <= 1, (x, y) =>
    pick(PAL.leather, 0.2 + sphereLight((x + 0.5 - 7) / 5.6, (y + 0.5 - 51) / 8) * 0.75 + light(x, y) * 0.6, x, y));
  p.rect(2, 46, 10, 4, (x, y) => pick(PAL.leather, y === 46 ? 0.9 : 0.62 - (x - 2) * 0.03 - (y === 49 ? 0.2 : 0), x, y)); // aba
  p.rect(3, 53, 7, 5, (x, y) => pick(OLIVE, 0.62 - (x - 3) * 0.04 - (y === 57 ? 0.2 : 0) + (y === 53 ? 0.15 : 0), x, y)); // bolso
  for (const x of [4, 9]) p.rect(x, 49, 1, 6, PAL.leather[1]);
  p.set(4, 50, PAL.gold[4]);
  p.set(9, 50, PAL.gold[3]);
  p.fill(0, 41, 14, 46, (x, y) => ((x - 7) / 6.6) ** 2 + ((y - 43.5) / 2.4) ** 2 <= 1, (x, y) => {
    if (x % 4 === 1) return CREAM[y < 43 ? 3 : 2];
    return pick(MARK, 0.15 + sphereLight(0, (y + 0.5 - 43) / 2.4) * 0.9, x, y);
  });
  // caneca pendurada
  p.rect(12, 53, 2, 2, (x) => PAL.iron[x === 12 ? 3 : 2]);
  // cajado encostado
  p.line(0, 62, 9, 31, (x, y) => PAL.wood[y % 4 ? 3 : 2]);
  p.rect(9, 29, 2, 2, (x, y) => PAL.wood[x === 9 && y === 29 ? 4 : 2]);
  // tora para sentar, com os anéis na ponta
  p.fill(52, 56, 63, 61, (x, y) => y > 56.5 && y < 61.5, (x, y) =>
    pick(PAL.wood, 0.25 + light(x, y) * 1.1 + (y === 57 ? 0.3 : 0) - (y === 61 ? 0.15 : 0) + ((x + y) % 5 === 0 ? -0.12 : 0), x, y));
  p.ellipse(52.5, 59, 1.6, 2.6, (x, y) => (Math.hypot(x - 52.5, (y - 59) / 1.6) < 0.8 ? PAL.wood[2] : C('#c9a070')));
  p.outline(PAL.out);
  // corda da barraca (por cima do contorno, fina)
  p.line(a[0] - 1, a[1] + 1, 4, 41, (x, y) => (y % 3 ? PAL.linen[2] : PAL.linen[1]));
  return p;
}

// Caldeirão pendurado no tripé, desenhado sobre a chama.
function buildKettle() {
  const p = new Pix(64, 64);
  const x0 = FIRE[0];
  p.line(x0, 43, x0, 47, PAL.iron[2]);
  p.fill(x0 - 5, 47, x0 + 5, 53, (x, y) => ((x - x0) / 3.8) ** 2 + ((y - 50.5) / 3) ** 2 <= 1 && y > 47.5, (x, y) =>
    pick(PAL.iron, 0.05 + sphereLight((x + 0.5 - x0) / 3.8, (y + 0.5 - 49.5) / 3) * 0.75, x, y));
  p.rect(x0 - 4, 48, 9, 1, (x) => PAL.iron[x < x0 - 1 ? 4 : 3]);
  p.outline(PAL.out);
  return p;
}

// Flâmula no topo do mastro.
function paintPennant(f, t, live) {
  const [ax, ay] = TENT.a;
  const x0 = ax + 1, y0 = ay - 7;
  for (let i = 0; i < 9; i++) {
    const s = Math.sin(t * (3 + live * 2) - i * 0.8);
    const wave = Math.round(s * (i / 8) * 1.4);
    const h = Math.max(1, Math.round(3 * (1 - i / 9)));
    for (let j = 0; j < h; j++) f.set(x0 + i, y0 + j + wave + (3 - h) * 0.5, j === 0 ? MARK[3] : MARK[s > 0 ? 2 : 1]);
  }
}

const campArt = { base: null, halo: null, kettle: null, door: null, frame: new Pix(64, 64) };

function paintCampPortrait(ctx, t, info) {
  const a = campArt;
  if (!a.base) {
    a.base = buildCampBackdrop(0).blit(buildCamp(0), 0, 0);
    const lit = buildCampBackdrop(1).blit(buildCamp(1), 0, 0);
    a.halo = makeHalo(a.base, lit, (x, y) => Math.hypot((x + 0.5 - FIRE[0]) * 0.8, (y + 0.5 - FIRE[1]) * 1.25) / 30);
    a.kettle = buildKettle();
    a.door = [];
    for (let y = 27; y < 52; y++) for (let x = 17; x < 31; x++) if (a.base.get(x, y) === TENT_DARK) a.door.push(x, y);
  }
  const working = info.working;
  const live = working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.base);
  // estrelas acendendo no alto
  for (let k = 0; k < 9; k++) {
    const x = Math.floor(hash(k, 1, 69) * 64), y = Math.floor(hash(k, 2, 69) * 14);
    const s = Math.sin(t * (0.8 + hash(k, 3, 69)) + k * 2);
    if (s > -0.2) f.set(x, y, s > 0.6 ? C('#fff6dc') : SUNSET[5]);
  }
  // fogo aceso iluminando a clareira
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 14.7 + 1) * 0.3 + Math.sin(t * 3.3) * 0.2;
  paintHalo(f, a.halo, 0.5 + live * 0.12 + flick * 0.08);
  // lamparina pendurada lá dentro, clareando a lona por dentro
  const lamp = 0.85 + Math.sin(t * 5.3) * 0.08 + Math.sin(t * 13.1) * 0.05;
  for (let k = 0; k < a.door.length; k += 2) {
    const x = a.door[k], y = a.door[k + 1];
    const v = lamp - Math.hypot(x + 0.5 - 24, (y + 0.5 - 41) * 0.8) / 7;
    if (v > 0.2) f.set(x, y, pick(INSIDE, v, x, y, 1.6));
  }
  for (const [x, y, c] of [[24, 38, PAL.iron[2]], [23, 39, PAL.iron[1]], [25, 39, PAL.iron[1]], [23, 40, PAL.iron[1]], [25, 40, PAL.iron[1]], [24, 41, PAL.iron[1]]]) f.set(x, y, c);
  f.set(24, 39, PAL.fire[lamp > 0.88 ? 5 : 4]);
  f.set(24, 40, PAL.fire[4]);
  // fumaça subindo da fogueira
  for (let k = 0; k < 7; k++) {
    const s = (t * 0.22 + k / 7) % 1;
    const sx = FIRE[0] + s * 9 + Math.sin(s * 6 + k) * 1.5, sy = 42 - s * 38, r = 1.2 + s * 3.4;
    for (let y = Math.floor(sy - r); y <= sy + r; y++) {
      for (let x = Math.floor(sx - r); x <= sx + r; x++) {
        const dd = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / r;
        if (dd <= 1 && bayer(x, y) < (1 - s) * 1.1 * (1.1 - dd * 0.5)) f.set(x, y, SMOKE[dd < 0.5 && y < sy ? 3 : 2]);
      }
    }
  }
  paintFlame(f, FIRE[0] - 3.5, FIRE[1], t, 5 + live * 2, 2, live);
  paintFlame(f, FIRE[0] + 0.5, FIRE[1], t + 1.3, 6 + live * 3, 2.6, live);
  paintFlame(f, FIRE[0] + 4, FIRE[1], t + 2.1, 4 + live * 2, 1.8, live);
  f.blit(a.kettle, 0, 0);
  // vapor do caldeirão
  if (working) {
    for (let k = 0; k < 4; k++) {
      const s = (t * 0.5 + k / 4) % 1;
      f.set(FIRE[0] + Math.sin(t * 2 + k * 1.7) * 1.5 + s * 2, 46 - s * 8, s < 0.5 ? CREAM[3] : CREAM[2]);
    }
  }
  // fagulhas
  for (let k = 0; k < (working ? 7 : 3); k++) {
    const life = (t * (0.5 + hash(k, 1, 70) * 0.5) + hash(k, 2, 70)) % 1;
    f.set(FIRE[0] + (hash(k, 3, 70) - 0.5) * 8 + Math.sin(t * 3 + k * 2) * 2 * life, FIRE[1] - 6 - life * 22, PAL.fire[life < 0.4 ? 5 : life < 0.75 ? 4 : 3]);
  }
  paintPennant(f, t, live);
  // vaga-lumes no capim
  for (let k = 0; k < 6; k++) {
    const x = 4 + hash(k, 1, 71) * 56 + Math.sin(t * 0.6 + k * 2.1) * 5;
    const y = 46 + hash(k, 2, 71) * 6 + Math.sin(t * 0.9 + k) * 2;
    const on = Math.sin(t * 1.7 + k * 1.9);
    if (on > 0.2) f.set(x, y, FIREFLY[on > 0.7 ? 2 : 1]);
  }
  f.draw(ctx);
}

function iconCamp() {
  const p = new Pix(16, 16);
  // barraca de lona com a porta aberta
  p.poly([[6, 2], [0.5, 14], [11.5, 14]], (x, y) => pick(CANVAS, 0.8 - (x - 3) * 0.04 - (y - 2) * 0.005, x, y));
  p.poly([[6, 2], [11.5, 14], [13, 12], [9, 3]], (x, y) => pick(CANVAS, 0.38, x, y));
  p.poly([[6, 6], [3.5, 14], [8.5, 14]], TENT_DARK);
  p.set(6, 12, PAL.fire[3]);
  p.set(6, 13, PAL.fire[4]);
  p.rect(6, 0, 1, 2, PAL.wood[3]);
  p.rect(7, 0, 3, 1, MARK[2]);
  p.set(7, 1, MARK[1]);
  // fogueira
  for (const [x, y, k] of [[13, 11, 3], [13, 12, 4], [14, 12, 3], [12, 12, 3], [13, 13, 5], [12, 13, 4], [14, 13, 4], [13, 10, 2]]) p.set(x, y, PAL.fire[k]);
  p.rect(11, 14, 5, 1, (x) => PAL.wood[x % 2 ? 3 : 1]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Cena: costa selvagem com mata, rio, colinas e o mar ao longe.
// Batedores seguem a trilha com mochila e cajado; acampamentos fumegam na campina.

const SH = SCENES.H;
const SEA = 48;
const shoreY = (x) => 57.5 + 1.3 * Math.sin(x * 0.041 + 1) + 0.7 * Math.sin(x * 0.12);
const islandH = (x) => Math.min(5.5, 2.2 * (Math.max(0, 7 * Math.sin(x * 0.011 + 4) - 3.4) + Math.max(0, 4 * Math.sin(x * 0.037 + 1.2) - 2.8)));
const ridgeBase = (x) => 68 + 5 * Math.sin(x * 0.015 + 0.3) + 3 * Math.sin(x * 0.043 + 1.7) + 0.9 * Math.sin(x * 0.13);
const riverRow = (x) => 82 + 1.6 * Math.sin(x * 0.024 + 2);
const trailY = (x) => 102.5 + 2.6 * Math.sin(x * 0.017 + 0.7) + 0.8 * Math.sin(x * 0.051);
const FAR_LAND = ramp('#4c6c5c', '#5a7e62', '#6e926a', '#88a876', '#a6be88');
const STONE_SEA = ramp('#3e3a46', '#5a5460', '#7a727a', '#9c9290', '#beb2a6', '#d8cebe');
const SAND = ramp('#7a6448', '#a88c64', '#cdb084', '#e6d0a2', '#f6e8c4');
const FOAM = C('#f4fbfa');
const BOOT = C('#22150e');
const CLOAKS = [OLIVE, OLIVE, PAL.hood, OCHRE];

function buildMiniCamp() {
  const p = new Pix(36, 26);
  // barraca de trás (ocre)
  p.poly([[26, 8], [20, 22.5], [32, 22.5]], (x, y) => pick(OCHRE, 0.64 - (x - 22) * 0.03, x, y));
  p.poly([[26, 8], [32, 22.5], [35, 21], [30, 9]], (x, y) => pick(OCHRE, 0.25, x, y));
  p.poly([[26, 13], [24, 22.5], [28, 22.5]], OCHRE[0]);
  // barraca da frente (lona clara)
  p.poly([[11, 4], [17, 5.5], [23, 21.5], [18, 23.5]], (x, y) => pick(CANVAS, 0.34 + (y % 3 === 0 ? -0.08 : 0), x, y));
  p.poly([[11, 4], [3, 23.5], [18.5, 23.5]], (x, y) => pick(CANVAS, 0.8 - (x - 6) * 0.012 - (Math.abs(x + 0.5 - 11 + (y - 4) * 0.22) < 0.5 ? 0.14 : 0) - (y > 21 ? 0.15 : 0), x, y));
  p.poly([[11, 11], [8, 23.5], [14, 23.5]], TENT_DARK);
  p.set(11, 21, PAL.fire[3]);
  p.set(10, 22, PAL.fire[2]);
  p.set(11, 22, PAL.fire[4]);
  p.rect(11, 0, 1, 5, PAL.wood[3]);
  // mochila encostada
  p.rect(1, 18, 4, 6, (x, y) => pick(PAL.leather, x === 1 ? 0.7 : 0.45, x, y));
  p.rect(0, 16, 6, 2, (x, y) => (x % 3 === 1 ? CREAM[3] : MARK[y === 16 ? 2 : 1]));
  // pedras da fogueira e lenha
  for (const x of [25, 27, 29, 31, 33]) p.set(x, 24, PAL.stone[x < 29 ? 3 : 2]);
  p.line(26, 23, 32, 22, PAL.wood[1]);
  p.outline(PAL.out);
  return p;
}

// Árvore de copa redonda da campina.
function buildMeadowTree(seed) {
  const r = 5.5 + hash(seed, 1) * 2.5;
  const w = Math.ceil(r * 2 + 4), h = Math.ceil(r * 1.9 + 8);
  const p = new Pix(w, h);
  const cx = w / 2, cy = r + 1;
  p.rect(Math.floor(cx) - 1, Math.floor(cy + r * 0.5), 2, h - Math.floor(cy + r * 0.5), (x) => PAL.wood[x < cx ? 3 : 1]);
  p.fill(0, 0, w, cy + r, (x, y) => {
    const n = hash(Math.floor(Math.atan2(y - cy, x - cx) * 3), 0, seed) * 0.14;
    return ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.86)) ** 2 <= 1 - n;
  }, (x, y) => {
    let v = 0.12 + sphereLight((x + 0.5 - cx) / r, (y + 0.5 - cy) / r) * 1.05;
    if (hash(x, y, seed) < 0.16) v -= 0.22;
    if (hash(x, y, seed + 1) < 0.06) v += 0.2;
    return pick(PAL.tree, v, x, y, 1.6);
  });
  p.outline(PAL.tree[0]);
  return { p, foot: h - 1 };
}

class FrontierScene extends SCENES.BaseScene {
  constructor() {
    super();
    this.birdColor = C('#2e3440');
    this.miniCamp = buildMiniCamp();
    this.man = new Pix(16, 30);
  }

  layout() {
    const w = this.w;
    const mx = Math.round(w * 0.7);
    this.mouth = mx;
    this.cape = Math.round(Math.min(120, Math.max(34, w * 0.17)));
    this.ridge = new Float32Array(w + 2);
    for (let x = 0; x <= w + 1; x++) {
      const r = ridgeBase(x);
      this.ridge[x] = r + (84 - r) * Math.exp(-(((x - mx) / 22) ** 2));
    }
    // rio: corre pela frente da mata e faz a curva até a foz
    const pts = [];
    const bx = mx - 30;
    for (let x = -12; x < bx; x += 3) pts.push([x, riverRow(x)]);
    const y0 = riverRow(bx), top = shoreY(mx) - 0.5;
    for (let k = 0; k <= 18; k++) {
      const a = (Math.PI / 2) * (1 - k / 18);
      pts.push([bx + 30 * Math.cos(a), top + (y0 - top) * Math.sin(a)]);
    }
    this.river = pts;
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.riverLen = len;
    // vagas: acampamentos na campina e batedores na trilha
    this.campSpots = [];
    for (let x = 70; x < w - 22; x += 150) if (Math.abs(x - mx) > 36) this.campSpots.push(x);
    this.trees = [];
    for (let x = 30; x < w - 6; x += 64 + Math.floor(hash(x, 1, 80) * 50)) {
      if (this.campSpots.some((c) => Math.abs(c - x) < 34) || Math.abs(x - mx) < 30) continue;
      this.trees.push(x);
    }
    const slots = Math.max(2, Math.floor((w - 16) / 52));
    this.scouts = [];
    for (let i = 0; i < slots; i++) {
      const lane = i % 3;
      this.scouts.push({
        x0: ((i + 0.5) / slots) * (w + 40) + (hash(i, 1, 81) - 0.5) * 20,
        off: [-3, 0, 3][lane], dir: lane === 1 ? -1 : 1,
        speed: 3.4 + hash(i, 2, 81) * 1.4, phase: hash(i, 3, 81) * 6,
        cloak: CLOAKS[i % CLOAKS.length], roll: i % 3 === 2 ? PAL.water : MARK,
      });
    }
  }

  riverHalf(y) {
    return 0.7 + Math.max(0, y - SEA) * 0.105;
  }

  buildBackground() {
    const p = this.bg, w = this.w, mx = this.mouth;
    paintSky(p, 0, SEA, PAL.sky, 3);
    this.sun = [Math.round(w * 0.36), 14];
    paintSun(p, this.sun[0], this.sun[1], 7);
    // mar: mais claro no horizonte, com faixas de onda
    for (let y = SEA; y < 66; y++) {
      for (let x = 0; x < w; x++) {
        const k = (y - SEA) / 10;
        let v = 0.8 - k * 0.44 + (hash(x >> 3, y, 82) - 0.5) * 0.12;
        if (y === SEA) v = 0.98;
        if ((x + y * 7) % 13 === 0 && hash(x, y, 83) < 0.5) v += 0.15;
        p.d[y * w + x] = pick(PAL.water, v, x, y, 2);
      }
    }
    // ilhas azuladas no horizonte, com paredões de pedra
    for (let x = 0; x < w; x++) {
      const h = islandH(x);
      if (h < 0.6) continue;
      const top = Math.round(SEA + 1 - h);
      const slope = islandH(x + 1) - islandH(x - 1);
      for (let y = top; y <= SEA + 1; y++) {
        const v = y === top ? 0.95 : 0.6 + clamp01(slope) * 0.25 - clamp01(-slope) * 0.2 - (y - top) * 0.03;
        p.d[y * w + x] = pick(PAL.far, v, x, y, 1.6);
      }
    }
    // cabo à esquerda, entrando no mar: encosta verde e paredão de pedra na ponta
    const P = this.cape;
    for (let x = 0; x < P + 2; x++) {
      const h = 11 * clamp01((P - x) / 9) + 1.5 * Math.sin(x * 0.19) + Math.sin(x * 0.47);
      if (h < 0.5) continue;
      const top = Math.round(55 - h), end = P - x < 9;
      for (let y = top; y < 58; y++) {
        const rock = end ? y > top : y >= 56 - ((x * 7) % 5 === 0 ? 1 : 0);
        p.d[y * w + x] = rock
          ? pick(STONE_SEA, (end ? 0.8 : 0.62) - (y - top) * 0.015 - ((y + (x >> 2)) % 3 === 0 ? 0.12 : 0), x, y)
          : pick(FAR_LAND, (y === top ? 0.95 : 0.66) - (y - top) * 0.025 + (hash(x >> 1, y, 104) - 0.5) * 0.14, x, y, 1.6);
      }
    }
    // pinheirinhos no alto do cabo
    for (let x = 3; x < P - 10; x += 5 + Math.floor(hash(x, 1, 106) * 6)) {
      const top = Math.round(55 - 11 - 1.5 * Math.sin(x * 0.19) - Math.sin(x * 0.47));
      const h = 3 + Math.floor(hash(x, 2, 106) * 3);
      for (let k = 0; k < h; k++) for (let i = -Math.floor((h - k) / 2.2); i <= Math.floor((h - k) / 2.2); i++) p.set(x + i, top + 1 - k, FAR_LAND[i < 0 ? 2 : 1]);
    }
    // rochedos no mar perto da praia
    this.rocks = [];
    for (let x = P + 26; x < w - 8; x += 60 + Math.floor(hash(x, 1, 84) * 50)) {
      if (Math.abs(x - mx) < 20) continue;
      const y = Math.round(shoreY(x) - 3), r = 1.4 + hash(x, 2, 84) * 1.4;
      p.fill(x - r, y - r * 2, x + r, y + 1, (xx, yy) => ((xx - x) / r) ** 2 + ((yy - y) / (r * 1.7)) ** 2 <= 1 && yy < y + 0.5, (xx, yy) =>
        pick(STONE_SEA, 0.25 + sphereLight((xx + 0.5 - x) / r, (yy + 0.5 - y + r) / (r * 1.7)) * 0.9, xx, yy));
      this.rocks.push([x, y, r]);
    }
    // praia, dunas e a planície da costa; a campina vem chegando mais verde
    for (let x = 0; x < w; x++) {
      const sy = Math.round(shoreY(x));
      for (let y = sy; y < SH; y++) {
        let c;
        if (y < sy + 2) c = pick(SAND, y === sy ? 0.88 : 0.55, x, y);
        else if (y < 76) {
          const k = (y - sy - 2) / 14;
          c = pick(FAR_LAND, 0.74 - k * 0.3 + (hash(x >> 1, y, 85) - 0.5) * 0.18 + Math.sin(x * 0.05 + y * 0.3) * 0.06, x, y, 1.6);
        } else {
          const depth = (y - 76) / (SH - 76);
          let v = 0.66 - depth * 0.12 + (hash(x, y, 86) - 0.5) * (0.18 + depth * 0.12);
          if (hash(x, y, 87) < 0.04 + depth * 0.03) v += 0.2;
          if ((x * 3 + y * 5) % 13 === 0) v -= 0.12;
          c = pick(PAL.grass, v, x, y, 1.6);
        }
        p.d[y * w + x] = c;
      }
    }
    // mata nas colinas do meio: chão escuro e copas por cima
    for (let x = 0; x < w; x++) {
      const top = Math.round(this.ridge[x]);
      for (let y = top; y < 86; y++) {
        const v = 0.42 - (y - top) * 0.025 + (hash(x, y, 88) - 0.5) * 0.2;
        p.d[y * w + x] = pick(PAL.tree, v, x, y, 1.6);
      }
    }
    for (const [row, step, bias] of [[0, 4, -0.05], [1, 6, 0.05], [2, 9, 0.1]]) {
      for (let x = -6; x < w + 8; x += step + Math.floor(hash(x, row, 89) * 4)) {
        const rx = Math.max(0, Math.min(w, x));
        if (this.ridge[rx] > 79) continue;
        const base = this.ridge[rx] + 3 + row * 4 + hash(x, row, 90) * 2;
        if (hash(x, row, 91) < 0.55) {
          // pinheiro
          const h = 8 + row * 3 + Math.floor(hash(x, row, 92) * 7), half = h * 0.32;
          p.poly([[x - half, base], [x, base - h], [x + half, base]], (xx, yy) => {
            let v = 0.55 - ((xx - x) / half) * 0.35 + bias;
            if ((yy - (base - h)) % 3 === 0) v -= 0.2;
            return pick(PAL.tree, v, xx, yy, 1.6);
          });
        } else {
          // árvore de copa redonda
          const r = 3.5 + row + hash(x, row, 93) * 2.5;
          p.fill(x - r, base - r * 2, x + r, base, (xx, yy) => ((xx - x) / r) ** 2 + ((yy - base + r) / (r * 0.9)) ** 2 <= 1 - hash(Math.floor(Math.atan2(yy - base + r, xx - x) * 3), 0, x) * 0.15, (xx, yy) => {
            let v = 0.08 + sphereLight((xx + 0.5 - x) / r, (yy + 0.5 - base + r) / r) * 1.0 + bias;
            if (hash(xx, yy, 94) < 0.16) v -= 0.2;
            return pick(PAL.tree, v, xx, yy, 1.6);
          });
        }
      }
    }
    // rio com margens de areia
    this.paintRiver(p);
    // trilha de terra batida, com as bordas comidas pelo capim
    for (let x = 0; x < w; x++) {
      const c = trailY(x);
      for (let y = Math.floor(c - 6); y <= c + 6; y++) {
        const d = Math.abs(y + 0.5 - c) / 5.5;
        if (d > 0.85 + (hash(x, y, 95) - 0.5) * 0.35) continue;
        let v = 0.58 + (hash(x, y, 96) - 0.5) * 0.28 - d * 0.18 + (y + 0.5 < c ? -0.06 : 0.04);
        if (hash(x, y, 97) < 0.05) v += 0.3; // pedrinhas
        p.set(x, y, pick(PAL.dirt, v, x, y));
      }
      if (hash(x, 1, 105) < 0.08) p.set(x, Math.round(c + (hash(x, 2, 105) - 0.5) * 4), PAL.grass[4]);
    }
    // árvores de copa redonda na campina
    for (const x of this.trees) {
      const tr = buildMeadowTree(x);
      p.blit(tr.p, x - tr.p.w / 2, 92 + Math.round(hash(x, 3, 80) * 2) - tr.foot);
    }
    // marco de pedras e placa no começo da trilha
    this.paintCairn(p, 14, Math.round(trailY(14) - 7));
    // tufos e flores na campina
    for (let i = 0; i < w / 3; i++) {
      const x = Math.floor(hash(i, 1, 98) * w), y = 87 + Math.floor(hash(i, 2, 98) * 25);
      if (Math.abs(y - trailY(x)) < 6) continue;
      const fl = hash(i, 3, 98);
      if (fl < 0.2) { p.set(x, y, fl < 0.07 ? C('#f4e9d0') : fl < 0.14 ? C('#f3d47c') : C('#b9a2e0')); continue; }
      p.set(x, y, PAL.grass[5]);
      p.set(x - 1, y + 1, PAL.grass[4]);
      p.set(x + 1, y + 1, PAL.grass[3]);
    }
    // máscaras para o que se mexe: mar aberto (barco e brilho) e espuma na praia
    this.openSea = new Uint8Array(w * SH);
    const seaSet = new Set([...PAL.water, ...PAL.sky, PAL.sunCore, PAL.sunRim, PAL.haze]);
    for (let y = 36; y < 66; y++) for (let x = 0; x < w; x++) if (seaSet.has(p.d[y * w + x])) this.openSea[y * w + x] = 1;
    this.foam = [];
    for (let x = 0; x < w; x++) {
      const sy = Math.round(shoreY(x)) - 1;
      if (this.openSea[sy * w + x]) this.foam.push(x, sy);
    }
    // pé do cabo, onde as ondas quebram
    for (let x = P - 12; x < P + 2; x++) if (x >= 0 && this.openSea[56 * w + x]) this.foam.push(x, 56);
  }

  paintRiver(p) {
    const w = this.w, pts = this.river;
    const y0 = SEA, y1 = 92;
    const dist = new Float32Array(w * (y1 - y0)).fill(99);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const pad = this.riverHalf(Math.max(ay, by)) + 2;
      const xa = Math.max(0, Math.floor(Math.min(ax, bx) - pad)), xb = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + pad));
      const ya = Math.max(y0, Math.floor(Math.min(ay, by) - pad)), yb = Math.min(y1 - 1, Math.ceil(Math.max(ay, by) + pad));
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      for (let y = ya; y <= yb; y++) {
        for (let x = xa; x <= xb; x++) {
          const s = clamp01(((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / l2);
          const d = Math.hypot(x + 0.5 - ax - dx * s, y + 0.5 - ay - dy * s);
          const k = (y - y0) * w + x;
          if (d < dist[k]) dist[k] = d;
        }
      }
    }
    this.riverMask = new Uint8Array(w * SH);
    for (let y = y0; y < y1; y++) {
      const hw = this.riverHalf(y);
      for (let x = 0; x < w; x++) {
        const d = dist[(y - y0) * w + x];
        if (d > hw + 1.2) continue;
        if (d > hw) {
          p.d[y * w + x] = pick(SAND, 0.35 + (hash(x, y, 99) - 0.5) * 0.3, x, y);
          continue;
        }
        const u = d / hw;
        const v = 0.62 - u * 0.25 - (y > 70 ? 0.08 : 0) + (hash(x >> 1, y, 100) - 0.5) * 0.1;
        p.d[y * w + x] = pick(PAL.water, v, x, y, 2);
        this.riverMask[y * w + x] = 1;
      }
    }
    // juncos na margem de baixo
    for (let x = 0; x < w; x += 2 + Math.floor(hash(x, 1, 101) * 5)) {
      if (Math.abs(x - this.mouth) < 34) continue;
      const by = Math.round(riverRow(x) + this.riverHalf(riverRow(x)) + 1);
      const h = 2 + Math.floor(hash(x, 2, 101) * 3);
      for (let k = 0; k < h; k++) p.set(x, by - k, PAL.herb[k === h - 1 ? 4 : 2]);
      if (hash(x, 3, 101) < 0.3) p.set(x, by - h, PAL.leather[2]);
    }
  }

  paintCairn(p, x, foot) {
    // pilha de pedras e uma placa de madeira apontando a trilha
    p.sphere(x, foot - 1.5, 3.4, 2, PAL.stone, 0.05);
    p.sphere(x - 0.5, foot - 4, 2.4, 1.6, PAL.stone, 0.1);
    p.sphere(x, foot - 6, 1.5, 1.2, PAL.stone, 0.15);
    p.rect(x + 5, foot - 11, 1, 11, (xx, yy) => PAL.wood[yy % 3 ? 2 : 1]);
    p.poly([[x + 2, foot - 11], [x + 10, foot - 11], [x + 12, foot - 9.5], [x + 10, foot - 8], [x + 2, foot - 8]], (xx, yy) => PAL.wood[yy === foot - 11 ? 4 : 3]);
    p.set(x + 4, foot - 10, PAL.wood[1]); p.set(x + 6, foot - 10, PAL.wood[1]); p.set(x + 8, foot - 10, PAL.wood[1]);
  }

  // ---------------------------------------------------------------- quadro a quadro

  paintFrame(p, t, info) {
    const w = this.w, d = p.d;
    this.paintBirds(p, t, 30);
    // brilho do sol no mar
    const sea = this.openSea;
    for (let k = 0; k < w / 5; k++) {
      const x = Math.floor((hash(k, 1, 102) * w + t * (1 + hash(k, 2, 102))) % w);
      const y = SEA + 1 + Math.floor(hash(k, 3, 102) * 8);
      if (!sea[y * w + x] || Math.sin(t * (1.5 + hash(k, 4, 102) * 2) + k) < 0.55) continue;
      const near = Math.abs(x - this.sun[0]) < 16;
      d[y * w + x] = near ? PAL.sunCore : PAL.water[5];
      if (near && x + 1 < w) d[y * w + x + 1] = PAL.water[4];
    }
    // barco à vela cruzando o horizonte
    this.paintShip(p, ((t * 1.1 + w * 0.5) % (w + 30)) - 15, SEA + 3);
    // espuma chegando na praia, no pé do cabo e em volta dos rochedos
    const F = this.foam;
    for (let k = 0; k < F.length; k += 2) {
      const x = F[k], wave = Math.sin(t * 1.4 - x * 0.21) + Math.sin(t * 0.7 + x * 0.05) * 0.6;
      if (wave > 0.75) d[F[k + 1] * w + x] = FOAM;
      else if (wave > 0.2 && (x & 1)) d[F[k + 1] * w + x] = PAL.water[4];
    }
    for (const [x, y, r] of this.rocks) {
      const s = Math.sin(t * 1.4 - x * 0.21);
      for (let i = -Math.ceil(r) - 1; i <= Math.ceil(r) + 1; i++) if ((i + Math.round(t * 2)) % 3 && s > -0.3) p.set(x + i, y + 1, FOAM);
    }
    // correnteza do rio descendo para a foz
    const R = this.river, L = this.riverLen, total = L[L.length - 1];
    let seg = 0;
    const n = Math.floor(total / 6);
    for (let k = 0; k < n; k++) {
      const s = (k * 6 + t * 7 + hash(k, 1, 103) * 6) % total;
      while (seg > 0 && L[seg] > s) seg--;
      while (seg < L.length - 2 && L[seg + 1] < s) seg++;
      const [ax, ay] = R[seg], [cx, cy] = R[seg + 1];
      const u = (s - L[seg]) / Math.max(0.001, L[seg + 1] - L[seg]);
      const y = ay + (cy - ay) * u;
      const off = (hash(k, 2, 103) - 0.5) * this.riverHalf(y) * 1.4;
      const nx = -(cy - ay), ny = cx - ax, nl = Math.hypot(nx, ny) || 1;
      const x = Math.round(ax + (cx - ax) * u + (nx / nl) * off), yy = Math.round(y + (ny / nl) * off);
      if (x < 0 || x >= w || !this.riverMask[yy * w + x]) continue;
      d[yy * w + x] = PAL.water[5];
      if (yy > 72 && x + 1 < w && this.riverMask[yy * w + x + 1]) d[yy * w + x + 1] = PAL.water[4];
    }
    // acampamentos
    const camps = Math.min(info.t2, this.campSpots.length);
    for (let i = 0; i < camps; i++) this.paintCamp(p, this.campSpots[i], t, i);
    // batedores na trilha, de trás para a frente
    const shown = Math.min(info.t1, this.scouts.length);
    const list = [];
    for (let i = 0; i < shown; i++) {
      const s = this.scouts[i];
      const span = w + 40;
      const x = ((((s.x0 + s.dir * s.speed * t) % span) + span) % span) - 20;
      list.push([trailY(x) + s.off, x, s]);
    }
    list.sort((a, b) => a[0] - b[0]);
    for (const [foot, x, s] of list) this.paintScout(p, s, x, foot, t);
    // capim balançando na beira de baixo
    for (let x = 1; x < w; x += 3) {
      const h = 2 + ((x * 7) % 3);
      const sway = Math.sin(t * 1.6 - x * 0.07) * 1.1;
      for (let k = 0; k < h; k++) p.set(x + Math.round(sway * (k / h)), SH - 1 - k, PAL.grass[k === h - 1 ? 5 : 3]);
    }
  }

  paintShip(p, x, y) {
    const w = this.w, sea = this.openSea, d = p.d;
    const put = (px, py, c) => {
      px = Math.round(px); py = Math.round(py);
      if (px >= 0 && px < w && py >= 0 && sea[py * w + px]) d[py * w + px] = c;
    };
    for (let i = -3; i <= 3; i++) put(x + i, y, PAL.wood[i < 0 ? 2 : 1]);
    for (let i = -2; i <= 2; i++) put(x + i, y + 1, PAL.wood[0]);
    put(x, y - 1, PAL.wood[1]);
    for (let k = 1; k <= 4; k++) for (let i = 0; i < (k > 3 ? 2 : 3); i++) put(x - 1 + i, y - k - 1, PAL.sail[i === 0 ? 4 : 3]);
    put(x + 2, y - 2, PAL.sail[2]);
    put(x + 2, y - 3, PAL.sail[3]);
    put(x, y - 6, MARK[2]);
  }

  paintCamp(p, cx, t, i) {
    const x0 = cx - 18, foot = 94, y0 = foot - 25;
    p.blit(this.miniCamp, x0, y0);
    // fogueira com fumaça
    const fx = x0 + 29, fy = y0 + 23;
    this.paintSmoke(p, t, fx, fy - 4, i, 0.55);
    paintFlame(p, fx, fy, t + i * 1.7, 3.5, 1.4, 1);
    // flâmula no mastro
    for (let k = 0; k < 5; k++) {
      const s = Math.sin(t * 4.5 - k * 0.9 + i);
      p.set(x0 + 12 + k, y0 + Math.round(s * (k / 4)), MARK[k === 0 ? 2 : s > 0 ? 3 : 2]);
      if (k < 3) p.set(x0 + 12 + k, y0 + 1 + Math.round(s * (k / 4)), MARK[1]);
    }
  }

  // Batedor pequeno andando pela trilha, com mochila nas costas e cajado na mão.
  paintScout(p, s, x, foot, t) {
    const m = this.man.clear();
    const dir = s.dir, cx = 8, fy = 28;
    const X = (dx) => cx + dx * dir;
    const put = (dx, y, c) => m.set(X(dx), y, c);
    const side = (dx) => (dx * dir < 0 ? 1 : 0); // o lado esquerdo da tela pega mais luz
    const cl = (k) => s.cloak[Math.min(k, s.cloak.length - 1)];
    const ph = (s.speed * t) / 11 * Math.PI * 2 + s.phase;
    const sw = Math.sin(ph), cw = Math.cos(ph);
    const hip = fy - 5 - (Math.abs(cw) > 0.7 ? 1 : 0);
    // pernas de duas colunas; a que vai para a frente levanta o pé
    [[-sw, -cw, PAL.leather[0]], [sw, cw, PAL.leather[1]]].forEach(([o, c, col]) => {
      const lift = c > 0.35 ? 1 : 0;
      const fx = X(Math.round(o * 2.2));
      m.line(cx, hip, fx, fy - 1 - lift, col);
      m.line(cx + dir, hip, fx + dir, fy - 1 - lift, col);
      for (let k = 0; k < 3; k++) m.set(fx + k * dir, fy - lift, BOOT);
    });
    // braço de trás balançando
    m.line(X(0), hip - 7, X(-Math.round(sw * 1.5)), hip - 3, cl(1));
    // mochila de lona, com o cobertor enrolado em cima e uma caneca
    for (let dx = -4; dx <= -2; dx++) {
      for (let y = hip - 9; y <= hip - 3; y++) {
        let v = 0.7 + side(dx) * 0.16 - (y - hip + 9) * 0.03;
        if (y === hip - 9) v += 0.15;
        if (y === hip - 7) v -= 0.25; // aba
        put(dx, y, pick(CANVAS, v, X(dx), y));
      }
    }
    put(-3, hip - 6, PAL.leather[1]);
    for (let dx = -5; dx <= -1; dx++) {
      for (const y of [hip - 11, hip - 10]) put(dx, y, dx === -5 || dx === -1 ? CREAM[y === hip - 11 ? 3 : 1] : s.roll[y === hip - 11 ? 3 : 2]);
    }
    put(-5, hip - 5, PAL.iron[1]);
    put(-5, hip - 4, PAL.iron[3]);
    // tronco coberto pela capa, com o cinto
    for (let dx = -1; dx <= 2; dx++) {
      for (let y = hip - 8; y <= hip - 1; y++) {
        if (y === hip - 8 && (dx === -1 || dx === 2)) continue;
        let c;
        if (y === hip - 2) c = dx === 1 ? PAL.gold[4] : PAL.leather[1];
        else if (y === hip - 1) c = cl(1 + side(dx));
        else c = cl(2 + side(dx) + (y < hip - 5 ? 1 : 0));
        put(dx, y, c);
      }
    }
    // cabeça: capuz com a ponta caindo para trás, rosto de perfil e a pena
    const hy = hip - 10;
    for (const [dx, dy, k] of [[0, -2, 5], [1, -2, 4], [-1, -1, 4], [0, -1, 5], [1, -1, 4], [2, -1, 3], [-1, 0, 3], [0, 0, 4],
      [-1, 1, 2], [0, 1, 3], [0, 2, 2], [1, 2, 3], [-2, 0, 2], [-2, 1, 1], [-3, 1, 1]]) put(dx, hy + dy, cl(k));
    put(1, hy, PAL.skin[4]);
    put(2, hy, PAL.iris);
    put(1, hy + 1, PAL.skin[3]);
    put(2, hy + 1, PAL.skin[3]);
    put(3, hy + 1, PAL.skin[2]);
    put(-1, hy - 2, FEATHER[3]);
    put(-2, hy - 3, FEATHER[4]);
    put(-2, hy - 2, FEATHER[2]);
    // braço da frente e o cajado, que vai e volta com o passo
    m.line(X(2), hip - 7, X(4), hip - 4, cl(4));
    const bx = X(4) + dir * Math.round(1 + sw), tx = X(4) - dir * Math.round(sw * 0.6);
    m.line(bx, fy, tx, hip - 15, (xx, yy) => PAL.wood[yy % 4 ? 4 : 3]);
    m.set(tx, hip - 16, PAL.wood[2]);
    put(4, hip - 4, PAL.skin[4]);
    m.outline(PAL.out);
    p.blit(m, Math.round(x) - cx, Math.round(foot) - fy);
  }
}

ART.icons.map = iconMap;
ART.portraits.scout = paintScoutPortrait;
ART.portraits.camp = paintCampPortrait;
ART.locked.scout = ART.silhouette(() => buildScout(true));
ART.locked.camp = ART.silhouette(() => {
  const p = buildCamp(0);
  paintPennant(p, 0, 0);
  return p;
});
Object.assign(ART.icons, { scout: iconScout, camp: iconCamp });
SCENES.register('frontier', FrontierScene);
})();
