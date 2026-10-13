'use strict';
// Linha de produção: MINÉRIOS (pedra, cobre, ferro e ouro).
// Mineiro (tier 1) tira minério da rocha e Mina (tier 2) forma mineiros.
// Aqui ficam o ícone do minério, os retratos, os ícones e a cena da encosta das minas.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, makeCloud } = ART;

// rocha da serra: cinza quente puxando para o roxo
const ROCK = ramp('#141016', '#211b23', '#302730', '#41363c', '#56484b', '#6e5d5c', '#89746d', '#a58e80', '#c2aa94');
// parede de túnel: do breu ao tom quente da lamparina
const TUNNEL = ramp('#0b080b', '#151013', '#20171a', '#2d201f', '#3d2b24', '#523a2c', '#6c4d34', '#8a643f', '#ac7f4c');
const COPPER = ramp('#3e1a0e', '#6e2e14', '#a04a1e', '#cc6e2c', '#ec9a48', '#ffcc80');
const VERDIGRIS = ramp('#1a3e3a', '#286058', '#3e8a78', '#6cb89c');
const RUST = ramp('#2a1012', '#4a1c1a', '#6e2c22', '#94402c', '#b85c3a');
const AMETHYST = ramp('#2a1240', '#4e2378', '#7a3cb0', '#b07ae0', '#e6c8ff');
const HIDE = ramp('#1a0e09', '#2e1a10', '#472917', '#633a20', '#82502b', '#a26a3a'); // couro do capuz
const GRIME = ramp('#24171a', '#3c2a28', '#5a4034', '#775444', '#8e6650'); // pele suja de fuligem
const WOOL = ramp('#1a1816', '#2a2724', '#3e3a34', '#56503f', '#6e6650');
const TEETH = C('#e6dac4');
const WHITE = C('#ffffff');

// céu frio de fim de tarde, com o resto do sol atrás da serra
const DUSK_SKY = ramp('#161c38', '#1e2848', '#28365a', '#34466c', '#46597c', '#5e6e88', '#7c8490', '#a09a94', '#c4aa94', '#e2bc90');
const PEAK = ramp('#232a48', '#2c3556', '#384366', '#465276', '#566486', '#6a7896');
const SNOW = ramp('#5e6e92', '#8090b0', '#a8b6cc', '#cfd9e6', '#eef2f8');
const RIDGE = ramp('#161a2a', '#1d2234', '#252b40', '#30364c', '#3c4258');
const PINE = ramp('#0a1210', '#101c18', '#172820', '#20342a', '#2c4434');
const GRAVEL = ramp('#17131a', '#221c22', '#30282c', '#403634', '#52463f', '#68584c', '#80705e');
const DUSK_CLOUD = ramp('#3a3f5c', '#565a76', '#7c7a8e', '#a89c9e', '#d0bcae');
const BAT = C('#120d16');
// a mesma rocha batida pela luz da tocha
const WARM_GRAVEL = ramp('#20161a', '#2e2020', '#402c26', '#54382c', '#6a4834', '#845a3e', '#a07048');
const WARM_ROCK = ramp('#1c1214', '#2c1c1c', '#3e2822', '#523428', '#6a4430', '#845638', '#a06c44', '#bc8452', '#d6a066');
const MOSS = ramp('#141e16', '#1c2a1c', '#26381f', '#324826');
const DUST = [C('#6a5c50'), C('#a0907c'), C('#d2c4a8')];
const ROPE = ramp('#3a2814', '#5e4422', '#86663a', '#ae8c56', '#cdb07a');

// ---------------------------------------------------------------------------
// Peças comuns

// Rocha em lascas: estratos inclinados partidos em blocos irregulares, cada bloco
// com a quina de cima clara e a fresta de baixo escura. Devolve um ajuste de tom.
function rockTone(x, y, seed, rh = 5, tilt = 0.14) {
  const sy = y + x * tilt + Math.sin(x * 0.07 + seed) * 2;
  const row = Math.floor(sy / rh), fy = sy - row * rh;
  const bw = 6 + Math.floor(hash(row, 1, seed) * 8);
  const sx = x + hash(row, 2, seed) * 37 + Math.sin(y * 0.6 + row * 2) * 0.9;
  const col = Math.floor(sx / bw), fx = sx - col * bw;
  if (fy >= rh - 1) return -0.28; // fresta entre estratos
  if (fx >= bw - 1) return -0.2; // fresta entre blocos
  let v = (hash(col, row, seed) - 0.5) * 0.24 + (0.5 - fy / rh) * 0.2 + (0.5 - fx / bw) * 0.08;
  if (fy < 1) v += 0.14;
  return v;
}

// Rocha em lascas: pontos sorteados numa grade esticada na horizontal (Voronoi).
// Cada lasca tem tom e inclinação próprios, a borda de cima clara e a fresta de baixo
// escura. Devolve o ajuste de tom; FACET guarda a borda (-1 em cima, 1 embaixo) e a lasca.
const FACET = { edge: 0, id: 0 };
function facetTone(x, y, seed, sx = 11, sy = 6) {
  const gx = (x + 0.5) / sx, gy = (y + 0.5) / sy;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  let d1 = 99, d2 = 99, ax = 0, ay = 0, bx = 0, by = 0, id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j;
      const ox = cx + 0.1 + hash(cx, cy, seed) * 0.8, oy = cy + 0.1 + hash(cx, cy, seed + 1) * 0.8;
      const d = (gx - ox) ** 2 + (gy - oy) ** 2;
      if (d < d1) { d2 = d1; bx = ax; by = ay; d1 = d; ax = ox; ay = oy; id = cx * 7919 + cy; }
      else if (d < d2) { d2 = d; bx = ox; by = oy; }
    }
  }
  // distância em pixels até a fronteira com a lasca vizinha mais próxima
  const nx = (bx - ax) / sx, ny = (by - ay) / sy, nl = Math.hypot(nx, ny);
  const dist = (((ax + bx) / 2 * sx - x - 0.5) * nx + ((ay + by) / 2 * sy - y - 0.5) * ny) / nl;
  let v = (hash(id, 3, seed) - 0.5) * 0.3 - (gy - ay) * 0.3 - (gx - ax) * 0.12;
  FACET.edge = 0;
  FACET.id = id;
  if (dist < 1) {
    const below = ny + nx * 0.35 > 0;
    FACET.edge = below ? 1 : -1;
    v += below ? -0.32 : 0.15;
  }
  return v;
}

// Cascalho e entulho: lasquinhas pequenas, uma ou outra com minério.
function rubble(x, y, seed, base) {
  const v = base + facetTone(x, y, seed, 3, 2) * 0.9;
  const h = hash(FACET.id, 9, seed);
  if (h < 0.06) return pick(h < 0.02 ? PAL.gold : h < 0.04 ? COPPER : RUST, v, x, y);
  return pick(ROCK, v, x, y);
}

// Pedaços de minério amontoados (carrinho, pilhas): cada pedra com o topo claro,
// sorteada entre rocha, cobre, ferro e, de vez em quando, ouro. ore < 1 deixa mais pedra comum.
function oreChunk(x, y, seed, s = 3, rich = 0.1, ore = 1, bias = 0) {
  const cy = Math.floor(y / s), off = (cy & 1) * (s >> 1);
  const cx = Math.floor((x + off) / s);
  const fx = x + off - cx * s, fy = y - cy * s;
  const h = hash(cx, cy, seed);
  const r = h < rich ? PAL.gold : h < rich + 0.16 * ore ? COPPER : h < rich + 0.3 * ore ? RUST : ROCK;
  let v = 0.5 + bias + (hash(cx, cy, seed + 1) - 0.5) * 0.3 + (r === ROCK ? 0.08 : 0);
  if (fy === 0) v += 0.22;
  else if (fy === s - 1) v -= 0.28;
  if (fx === 0) v += 0.08;
  else if (fx === s - 1) v -= 0.18;
  return pick(r, v, x, y);
}

// Chama de lamparina ou tocha com a base em (x, y): núcleo claro embaixo, ponta que dança.
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

// Luz que pulsa: compara a versão apagada com a acesa e guarda, para cada pixel que
// muda, um limiar. A cada quadro acendem os pixels com limiar abaixo do nível pedido.
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

// Pulso de brilho que aparece de tempos em tempos: 0 quase sempre, sobe e desce rápido.
function pulse(t, period, width) {
  const ph = (((t % period) + period) % period) / width;
  return ph < 1 ? Math.sin(ph * Math.PI) : 0;
}

// Brilho em cruz (estrela de 4 pontas) num ponto, com intensidade 0..1.
function paintGlint(f, x, y, s) {
  if (s <= 0.05) return;
  f.set(x, y, s > 0.4 ? WHITE : PAL.gold[5]);
  if (s > 0.35) {
    const c = s > 0.7 ? PAL.gold[5] : PAL.gold[4];
    f.set(x - 1, y, c); f.set(x + 1, y, c); f.set(x, y - 1, c); f.set(x, y + 1, c);
  }
  if (s > 0.75) {
    f.set(x - 2, y, PAL.gold[4]); f.set(x + 2, y, PAL.gold[4]);
    f.set(x, y - 2, PAL.gold[4]); f.set(x, y + 2, PAL.gold[4]);
  }
}

// Morcego com as asas batendo; flap vai de -1 (asas embaixo) a 1 (em cima).
function paintBat(f, x, y, flap) {
  x = Math.round(x); y = Math.round(y);
  f.set(x, y, BAT); f.set(x, y + 1, BAT);
  f.set(x - 1, y - 1, BAT); f.set(x + 1, y - 1, BAT); // orelhas
  const up = flap > 0.3 ? -1 : flap < -0.3 ? 1 : 0;
  for (const d of [-1, 1]) {
    f.set(x + d, y, BAT);
    f.set(x + d * 2, y + up, BAT);
    f.set(x + d * 3, y + up * 2, BAT);
    if (up === 0) f.set(x + d * 3, y + 1, BAT);
  }
}

// ---------------------------------------------------------------------------
// Ícone do recurso: pedra com veios de ouro e cobre

function iconOre() {
  const p = new Pix(16, 16);
  const face = (pts, base) => p.poly(pts, (x, y) => pick(ROCK, base + (hash(x, y, 5) - 0.5) * 0.12, x, y));
  face([[0.5, 10.5], [1.5, 5.5], [5, 8], [9.5, 7.5], [9, 15.5], [3.5, 15]], 0.56); // frente
  face([[9.5, 7.5], [14.5, 4.5], [15.5, 10.5], [13, 14.5], [9, 15.5]], 0.32); // lado na sombra
  face([[1.5, 5.5], [5.5, 1.5], [11, 1], [14.5, 4.5], [9.5, 7.5], [5, 8]], 0.82); // topo
  // veio de ouro cortando as três faces
  const vein = [[1, 9, 3], [2, 9, 4], [3, 8, 4], [4, 9, 5], [5, 10, 4], [6, 10, 3], [7, 9, 4], [8, 9, 5], [9, 9, 4], [10, 9, 3], [11, 8, 3], [12, 8, 2], [13, 7, 3], [14, 7, 2]];
  for (const [x, y, k] of vein) p.set(x, y, PAL.gold[k]);
  for (const [x, y] of [[3, 9], [4, 10], [8, 10], [9, 10]]) p.set(x, y, PAL.gold[2]);
  // pepitas: uma grande na frente e uma no topo
  for (const [x, y, k] of [[5, 11, 5], [6, 11, 4], [5, 12, 3], [6, 12, 2], [7, 3, 5], [8, 3, 4], [8, 4, 3], [7, 4, 4]]) p.set(x, y, PAL.gold[k]);
  // cobre e um cristal roxo
  for (const [x, y, k] of [[11, 11, 3], [12, 11, 2], [11, 12, 2], [3, 13, 3], [4, 13, 2]]) p.set(x, y, COPPER[k]);
  for (const [x, y, k] of [[11, 3, 3], [12, 4, 2], [11, 4, 4]]) p.set(x, y, AMETHYST[k]);
  p.set(5, 11, WHITE);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Mineiro

const AX = 32.5;
const LAMP = [32.5, 11]; // base da chama da lamparina
const NEAR = [5, 3, 58, 70]; // vão das escoras da frente: x0, y0, x1, y1
const FAR = [7, 25, 19, 41]; // boca escura no fundo do túnel
const VEIN = (x) => 8 + (x - 36) * 0.42 + Math.sin(x * 0.45) * 1.3;
const PICK = [56, 33, 0.264, -0.965]; // cabeça da picareta e a direção do cabo

// Profundidade de um ponto no túnel (0 = escoras da frente, 1 = fundo) e a face:
// 0 parede esquerda, 1 parede direita, 2 teto, 3 chão.
function tunnelDepth(x, y) {
  const [n0, ny0, n1, ny1] = NEAR, [f0, fy0, f1, fy1] = FAR;
  let t = (x - n0) / (f0 - n0), side = 0;
  const tr = (n1 - x) / (n1 - f1), tt = (y - ny0) / (fy0 - ny0), tb = (ny1 - y) / (ny1 - fy1);
  if (tr < t) { t = tr; side = 1; }
  if (tt < t) { t = tt; side = 2; }
  if (tb < t) { t = tb; side = 3; }
  return [t, side];
}

function buildMinerBackdrop(glow) {
  const p = new Pix(64, 64);
  const [lx, ly] = LAMP;
  const reach = 40 + glow * 12, power = 0.42 + glow * 0.26;
  const light = (x, y) => power * clamp01(1 - Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 1.1) / reach) ** 1.4;
  const veinGlow = (x, y) => (x > 33 && x < 60 ? clamp01(1 - Math.abs(y + 0.5 - VEIN(x)) / 5) * (0.12 + glow * 0.1) : 0);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const [t, side] = tunnelDepth(x + 0.5, y + 0.5);
      const l = light(x, y);
      if (t >= 1) {
        p.d[y * 64 + x] = pick(TUNNEL, 0.02 + l * 0.15 - (y - 25) * 0.002, x, y, 1.5);
        continue;
      }
      const d = Math.max(0, t);
      let v = 0.2 + l * (1 - d * 0.6) - d * 0.22 + rockTone(x, y, 31, 5, side === 2 ? 0.5 : 0.12) * (0.75 - d * 0.35);
      if (side === 2) v -= 0.04; // teto
      if (side === 0) v -= 0.06;
      v += veinGlow(x, y);
      p.d[y * 64 + x] = pick(TUNNEL, v, x, y, 1.8);
    }
  }
  // escoras no meio do túnel, cada vez menores e mais escuras
  for (const k of [0.3, 0.58, 0.8]) {
    const lerp = (a, b) => a + (b - a) * k;
    const x0 = lerp(NEAR[0], FAR[0]), x1 = lerp(NEAR[2], FAR[2]), y0 = lerp(NEAR[1], FAR[1]);
    const tw = Math.max(1, Math.round(3.2 * (1 - k)));
    const wood = (x, y, edge) => pick(PAL.wood, 0.1 + light(x, y) * 1.1 - k * 0.3 + (edge ? 0.15 : 0) + (hash(x, y >> 1, 33) - 0.5) * 0.1, x, y);
    p.fill(x0 - tw, y0 - tw, x1 + tw, y0 - 1, () => true, (x, y) => wood(x, y, y === Math.floor(y0 - tw)));
    for (const px of [x0 - tw, x1]) p.fill(px, y0, px + tw - 1, 63, () => true, (x, y) => wood(x, y, x === Math.floor(px)));
  }
  // veio de minério brilhando no teto
  for (let x = 34; x < 59; x++) {
    const y = Math.round(VEIN(x));
    const k = 3 + (hash(x, 0, 34) < 0.35 ? 1 : 0) + glow;
    p.set(x, y, PAL.gold[Math.min(5, k)]);
    p.set(x, y + 1, PAL.gold[2 + glow]);
    if (hash(x, 1, 34) < 0.5) p.set(x, y - 1, COPPER[2 + glow]);
    if (hash(x, 2, 34) < 0.25) p.set(x, y + 2, COPPER[1 + glow]);
  }
  for (const [x, y] of [[39, 10], [46, 12], [53, 16]]) {
    p.rect(x, y, 2, 2, (xx, yy) => PAL.gold[(xx === x && yy === y ? 5 : 3) + (glow ? 0 : -1)]);
  }
  // drusa de ametista no canto do teto
  for (const [x, y, h, k] of [[8, 9, 3, 3], [10, 8, 4, 4], [12, 10, 2, 2], [9, 11, 2, 2]]) {
    for (let j = 0; j < h; j++) {
      p.set(x, y + j, AMETHYST[Math.max(0, k - j + glow)]);
      p.set(x + 1, y + j, AMETHYST[Math.max(0, k - j - 1 + glow)]);
    }
  }
  // manchas de cobre e azinhavre na parede direita
  for (let i = 0; i < 5; i++) {
    const x = 37 + Math.floor(hash(i, 1, 35) * 20), y = 24 + Math.floor(hash(i, 2, 35) * 22);
    const r = i % 2 ? COPPER : VERDIGRIS;
    p.set(x, y, r[1 + glow]); p.set(x + 1, y, r[2 + glow]); p.set(x, y + 1, r[glow]);
  }
  // escoras da frente: dois esteios, o chapéu e as mãos-francesas
  const timber = (x, y, along, lit) => {
    let v = 0.25 + light(x, y) * 0.9 + (lit ? 0.18 : 0) + (hash(along ? x >> 2 : x, along ? y : y >> 2, 36) - 0.5) * 0.12;
    if (hash(x, y, 37) < 0.03) v -= 0.25; // nós
    return pick(PAL.wood, v, x, y);
  };
  p.rect(0, 0, 5, 64, (x, y) => timber(x, y, false, x === 4));
  p.rect(59, 0, 5, 64, (x, y) => timber(x, y, false, x === 59));
  p.rect(0, 0, 64, 4, (x, y) => timber(x, y, true, y === 3));
  p.rect(0, 4, 64, 1, PAL.wood[0]);
  for (let k = 0; k < 7; k++) {
    p.rect(5 + k, 10 - k, 1, 2, PAL.wood[2 + (k < 5 ? 1 : 0)]);
    p.rect(58 - k, 10 - k, 1, 2, PAL.wood[2]);
  }
  for (const [x, y] of [[2, 2], [61, 2], [2, 30], [61, 30]]) { p.set(x, y, PAL.iron[3]); p.set(x, y + 1, PAL.iron[1]); }
  return p;
}

const inHood = (x, y) => ((x - AX) / 14.2) ** 2 + ((y - 29.5) / 16.8) ** 2 <= 1;
const inOpening = (x, y) => ((x - AX) / 9.8) ** 2 + ((y - 33.5) / 11.6) ** 2 <= 1;
function inMinerFace(x, y) {
  const dy = (y - 33.6) / 11;
  const rx = dy > 0 ? 9.1 * (1 - 0.3 * dy * dy) : 9.1;
  return ((x - AX) / rx) ** 2 + dy * dy <= 1;
}
// manchas de fuligem no rosto: [x, y, rx, ry, força]
const SOOT = [[26.5, 25.5, 4.5, 1.8, 0.95], [24.5, 36, 2.3, 4.2, 0.9], [40.5, 33.5, 2.2, 3.4, 0.75], [34, 35.8, 1.6, 1.2, 0.55],
  [37, 43, 4, 2, 0.65], [28, 43.5, 2.6, 1.5, 0.5], [37.5, 24.5, 2.4, 1.2, 0.5]];
function sootAt(x, y) {
  let s = 0;
  for (const [cx, cy, rx, ry, k] of SOOT) s = Math.max(s, k * clamp01(1.25 - Math.hypot((x - cx) / rx, (y - cy) / ry)));
  return s + (hash(x, y, 77) - 0.5) * 0.3;
}

function minerEyes(p, closed) {
  for (const x0 of [26, 36]) {
    const left = x0 === 26;
    if (closed) {
      for (let i = 0; i < 3; i++) {
        p.set(x0 + i, 31, GRIME[1]);
        p.set(x0 + i, 32, PAL.skin[left ? 3 : 2]);
      }
      continue;
    }
    for (let i = 0; i < 3; i++) p.set(x0 + i, 30, GRIME[0]);
    const row = left ? [PAL.eyeWhite, PAL.irisHi, PAL.iris] : [PAL.iris, PAL.irisHi, PAL.eyeWhite];
    for (let i = 0; i < 3; i++) p.set(x0 + i, 31, row[i]);
    p.set(x0 + (left ? 1 : 0), 32, PAL.iris);
    p.set(x0 + (left ? 2 : 1), 32, PAL.iris);
    p.set(x0 + (left ? 0 : 2), 32, PAL.skin[left ? 3 : 2]);
  }
}

// Picareta: cabo do pé (x0, y0) até a cabeça (hx, hy); a cabeça cruza o cabo e curva para baixo.
function paintPick(p, x0, y0, hx, hy, left, right) {
  const len = Math.hypot(hx - x0, hy - y0);
  const ux = (hx - x0) / len, uy = (hy - y0) / len; // ao longo do cabo, para cima
  const vx = -uy, vy = ux; // ao longo da cabeça
  p.line(x0, y0, hx + ux, hy + uy, (x, y) => PAL.wood[(x + y) % 4 ? 4 : 3]);
  p.line(x0 + 1, y0, hx + ux + 1, hy + uy, (x, y) => PAL.wood[(x + y) % 4 ? 2 : 1]);
  const bend = 0.032;
  p.fill(hx - 12, hy - 12, hx + 12, hy + 12, (x, y) => {
    const dx = x - hx, dy = y - hy;
    const a = dx * vx + dy * vy, b = dx * ux + dy * uy + bend * a * a;
    if (a < -left || a > right) return false;
    const tip = a < 0 ? -a / left : a / right;
    const half = Math.abs(a) < 1.7 ? 2.3 : 1.7 * (1 - tip ** 1.6) + 0.45;
    return Math.abs(b) <= half;
  }, (x, y) => {
    const dx = x + 0.5 - hx, dy = y + 0.5 - hy;
    const a = dx * vx + dy * vy, b = dx * ux + dy * uy + bend * a * a;
    if (Math.abs(a) < 1.7) return pick(PAL.iron, 0.45 + b * 0.12, x, y);
    return pick(PAL.steel, 0.55 + b * 0.16 - Math.abs(a) * 0.012, x, y);
  });
}

function buildMiner() {
  const p = new Pix(64, 64);
  // capa de couro sobre os ombros, com costuras e arranhões
  p.poly([[0, 64], [0.5, 56], [5, 50.5], [13, 47], [21, 45.5], [44, 45.5], [52, 47], [60, 50.5], [64, 56], [65, 64]], (x, y) => {
    const nx = (x + 0.5 - AX) / 31;
    let v = 0.5 - nx * 0.36 - (y - 50) * 0.012 + Math.sin(x * 0.55) * 0.06 + (hash(x, y, 71) - 0.5) * 0.1;
    v += clamp01(1 - Math.hypot((x - 10) / 9, (y - 53) / 5)) * 0.18; // ombro iluminado
    if (hash(x >> 1, y, 72) < 0.035) v -= 0.25;
    return pick(HIDE, v, x, y);
  });
  for (let y = 50; y < 64; y += 2) { p.set(11 - (y - 50) * 0.25, y, HIDE[4]); p.set(53 + (y - 50) * 0.25, y, HIDE[2]); }
  // túnica de lã aparecendo na abertura da capa
  p.poly([[25, 64], [28.5, 49], [36.5, 49], [40, 64]], (x, y) => pick(WOOL, 0.62 - (x - 28) * 0.03 - (x === 32 ? 0.2 : 0), x, y));
  for (const x of [24, 25, 39, 40]) for (let y = 52; y < 64; y++) if (p.get(x, y) && (x + y) % 2) p.set(x, y, HIDE[x < 32 ? 1 : 0]);
  // rolo de corda no ombro esquerdo: duas voltas torcidas
  for (const [ox, oy] of [[1.5, 1.6], [0, 0]]) {
    const ccx = 12 + ox, ccy = 54.5 + oy;
    p.fill(2, 47, 24, 63, (x, y) => {
      const r = Math.hypot((x - ccx) / 9, (y - ccy) / 5);
      return r <= 1 && r >= 0.62;
    }, (x, y) => {
      const r = Math.hypot((x + 0.5 - ccx) / 9, (y + 0.5 - ccy) / 5);
      const s = (r - 0.81) / 0.19, top = y + 0.5 < ccy ? 0.12 : -0.12;
      let v = 0.2 + (1 - s * s) * 0.6 + top - (x - 4) * 0.012 - (ox ? 0.12 : 0);
      if ((x * 2 + y * 3) % 5 < 2) v -= 0.22; // fios torcidos
      return pick(ROPE, v, x, y);
    });
  }
  // capuz de couro
  p.fill(17, 11, 48, 47, inHood, (x, y) => {
    let v = 0.1 + sphereLight((x + 0.5 - AX) / 14.2, (y + 0.5 - 27) / 16.8) * 1.0 + (hash(x, y, 73) - 0.5) * 0.1;
    if (Math.abs(x + 0.5 - AX) < 1 && y < 19) v -= 0.22; // costura do meio
    if (y > 41) v -= 0.12;
    return pick(HIDE, v, x, y);
  });
  for (let y = 13; y < 18; y += 2) p.set(31, y, HIDE[4]);
  // correia da lamparina em volta do capuz, com a fivela
  for (let x = 19; x <= 46; x++) {
    const y = Math.round(18.6 + ((x + 0.5 - AX) / 14) ** 2 * 3);
    if (!inHood(x + 0.5, y + 0.5)) continue;
    p.set(x, y, HIDE[x < 30 ? 2 : 1]);
    p.set(x, y + 1, HIDE[0]);
    if (x < 28 && x % 3 === 0) p.set(x, y, HIDE[4]);
  }
  // costuras dos gomos do capuz e o pesponto em volta do rosto
  for (let y = 14; y < 44; y += 2) {
    for (const s of [-1, 1]) {
      const x = AX + s * (6.5 + (y - 14) * 0.24 + Math.sin((y - 14) * 0.1) * 2);
      if (inHood(x, y + 0.5) && !inOpening(x - s, y + 0.5)) p.set(x, y, HIDE[s < 0 ? 4 : 2]);
    }
  }
  for (let a = 0; a < Math.PI * 2; a += 0.21) {
    const x = AX + Math.cos(a) * 11.3, y = 33.5 + Math.sin(a) * 13;
    if (y < 44 && inHood(x, y)) p.set(x, y, HIDE[Math.cos(a) < 0.3 ? 5 : 3]);
  }
  // forro escuro da abertura
  p.fill(22, 21, 43, 46, inOpening, HIDE[0]);
  // rosto sujo de fuligem
  p.fill(23, 22, 42, 45, inMinerFace, (x, y) => {
    let v = 0.38 + sphereLight((x + 0.5 - AX) / 9.1 * 0.85, (y + 0.5 - 33.6) / 11 * 0.5 - 0.12) * 0.66;
    if (y < 26) v -= 0.22; // sombra do capuz
    if (x > 39) v -= 0.08;
    return sootAt(x, y) > 0.5 ? pick(GRIME, v + 0.08, x, y) : pick(PAL.skin, v, x, y, 3);
  });
  // sobrancelhas grossas e franzidas
  for (const [x, y] of [[25, 28], [26, 28], [27, 28], [28, 28], [29, 29], [24, 29]]) {
    p.set(x, y, PAL.hair[1]);
    p.set(65 - x, y, PAL.hair[1]);
  }
  p.set(26, 28, PAL.hair[2]);
  minerEyes(p, false);
  // nariz largo com a ponta suja
  for (const [x, y, k] of [[32, 31, 4], [32, 32, 4], [32, 33, 5], [33, 33, 2], [32, 34, 4], [33, 34, 3], [31, 35, 2], [32, 35, 3],
    [33, 35, 3], [34, 35, 1], [30, 36, 1], [31, 36, 2], [34, 36, 1], [35, 36, 1]]) p.set(x, y, PAL.skin[k]);
  p.set(33, 35, GRIME[2]);
  // bigode farto, barba por fazer e um sorriso de dentes à mostra
  const stache = [[27, 38], [28, 37], [29, 37], [30, 37], [31, 37], [32, 37], [26, 39], [27, 39], [28, 38], [29, 38], [30, 38], [31, 38], [32, 38]];
  for (const [x, y] of stache) {
    p.set(x, y, PAL.hair[y === 37 ? 3 : y === 39 ? 1 : 2]);
    p.set(65 - x, y, PAL.hair[y === 37 ? 2 : y === 39 ? 0 : 1]);
  }
  for (let x = 29; x <= 36; x++) p.set(x, 40, PAL.skin[0]);
  for (let x = 30; x <= 35; x++) p.set(x, 40, x === 32 ? C('#b8ab98') : TEETH);
  for (let x = 31; x <= 34; x++) p.set(x, 41, PAL.lip);
  p.set(29, 41, PAL.skin[1]);
  p.set(36, 41, PAL.skin[1]);
  p.fill(23, 39, 42, 45, (x, y) => inMinerFace(x, y) && y > 41 && hash(x, y, 78) < 0.45, (x, y) => (y > 43 ? GRIME[1] : GRIME[2]));
  // lenço vermelho amarrado no pescoço
  p.poly([[23, 45], [AX, 47.5], [42, 45], [42.5, 47.5], [AX, 50.5], [22.5, 47.5]], (x, y) =>
    pick(PAL.scarf, 0.7 - (x - 23) * 0.025 - (y - 45) * 0.06, x, y));
  p.poly([[30.5, 48], [AX, 47], [35, 48], [36, 54], [33.5, 52], [31, 54.5]], (x, y) =>
    pick(PAL.scarf, 0.55 - (x - 30) * 0.05 - (y - 48) * 0.03, x, y));
  p.sphere(AX, 48.6, 1.8, 1.4, PAL.scarf, 0.15);
  // lamparina de óleo presa na correia: suporte de ferro e o pote de latão
  p.rect(32, 14, 2, 6, (x) => PAL.iron[x === 32 ? 3 : 1]);
  p.rect(31, 18, 4, 2, (x, y) => PAL.gold[y === 18 ? 4 : 2]);
  p.sphere(AX, 13.6, 3.6, 2.2, PAL.gold, 0.12);
  p.rect(30, 11, 5, 1, (x) => PAL.gold[x < 32 ? 4 : 2]);
  p.set(36, 12, PAL.gold[2]);
  p.set(37, 11, PAL.gold[3]); // bico
  p.set(28, 13, PAL.gold[1]); // alça
  p.set(28, 14, PAL.gold[1]);
  // picareta no ombro direito
  paintPick(p, 47.5, 64, PICK[0], PICK[1], 10, 7.6);
  // luva segurando o cabo
  p.sphere(49.5, 55.5, 3.4, 3, HIDE, 0.2);
  for (const y of [54, 56]) p.set(48, y, HIDE[1]);
  p.set(47, 57, HIDE[1]);
  p.outline(PAL.out);
  return p;
}

const minerArt = { bg: null, body: null, halo: null, frame: new Pix(64, 64) };

function paintMinerPortrait(ctx, t, info) {
  const a = minerArt;
  if (!a.bg) {
    a.bg = buildMinerBackdrop(0);
    const [lx, ly] = LAMP;
    a.halo = makeHalo(a.bg, buildMinerBackdrop(1), (x, y) => Math.hypot(x + 0.5 - lx, y + 0.5 - ly) / 52);
    a.body = buildMiner();
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 14.7 + 1) * 0.3 + Math.sin(t * 3.3) * 0.2;
  paintHalo(f, a.halo, 0.36 + live * 0.12 + flick * 0.07 * live);
  // lamparina de outro mineiro lá no fundo do túnel
  const fx = 12.5 + Math.sin(t * 0.37) * 3.5, fy = 34 + Math.abs(Math.sin(t * 2.2)) * 0.6;
  f.set(fx, fy, PAL.fire[4]);
  if (Math.sin(t * 7.3) > -0.6) f.set(fx, fy - 1, PAL.fire[2]);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1]]) if (bayer(Math.floor(fx + dx), Math.floor(fy + dy)) < 0.5) f.set(fx + dx, fy + dy, TUNNEL[4]);
  // brilho correndo pelo veio
  for (let k = 0; k < 4; k++) {
    const x = 36 + ((k * 6.3 + Math.floor(t * 0.4 + k * 0.25) * 7) % 21);
    const s = pulse(t + k * 0.9, info.working ? 2.6 : 3.8, 0.7);
    paintGlint(f, Math.round(x), Math.round(VEIN(x)), s * 0.85);
  }
  paintGlint(f, 10, 8, pulse(t + 2.1, 5.1, 0.5) * 0.5);
  // poeira flutuando na luz da lamparina e grãos caindo do teto
  for (let k = 0; k < (info.working ? 14 : 7); k++) {
    const life = (t * (0.05 + hash(k, 1, 79) * 0.05) + hash(k, 2, 79)) % 1;
    const x = 8 + hash(k, 3, 79) * 50 + Math.sin(t * 0.7 + k * 2.1) * 2.5;
    const y = 4 + life * 44;
    const lit = 1 - Math.hypot(x - LAMP[0], y - LAMP[1]) / 40;
    f.set(x, y, DUST[life > 0.2 && life < 0.8 && lit > 0.3 ? 2 : lit > 0 ? 1 : 0]);
  }
  if (info.working) {
    for (let k = 0; k < 3; k++) {
      const life = (t * 0.9 + k / 3) % 1;
      f.set(22 + k * 3 + Math.sin(k * 5) * 1.5, 5 + life * life * 40, ROCK[5 + (k % 2)]);
    }
  }
  f.blit(a.body, 0, 0);
  if (t % 4.9 > 4.75 || t % 11.3 > 11.15) minerEyes(f, true);
  paintFlame(f, LAMP[0] - 0.5, LAMP[1], t, 5 + live * 1.5, 1.7, live);
  // brilho deslizando pela aresta de cima da cabeça da picareta
  const g = (t * 0.5) % 3;
  if (g < 1) {
    const [hx, hy, ux, uy] = PICK;
    const s = -8 + g * 14, b = 1.1 - 0.032 * s * s;
    f.set(hx - uy * s + ux * b, hy + ux * s + uy * b, PAL.steel[5]);
  }
  f.draw(ctx);
}

function iconMiner() {
  const p = new Pix(16, 16);
  // capuz de couro, rosto sujo e a lamparina acesa na testa
  p.fill(0, 2, 16, 16, (x, y) => ((x - 8) / 6.8) ** 2 + ((y - 9.5) / 6.8) ** 2 <= 1, (x, y) =>
    pick(HIDE, 0.15 + sphereLight((x + 0.5 - 8) / 6.8, (y + 0.5 - 8.5) / 6.8) * 1.05, x, y));
  p.ellipse(8, 11, 4.3, 4.6, HIDE[0]);
  p.fill(3, 7, 13, 15, (x, y) => ((x - 8) / 3.6) ** 2 + ((y - 11) / 4.1) ** 2 <= 1, (x, y) =>
    (hash(x, y, 9) < 0.25 ? GRIME[3] : pick(PAL.skin, y < 8 ? 0.35 : 0.72 - (x - 7) * 0.05, x, y)));
  p.set(6, 10, PAL.iris);
  p.set(10, 10, PAL.iris);
  p.set(5, 9, PAL.hair[1]); p.set(6, 9, PAL.hair[1]);
  p.set(10, 9, PAL.hair[1]); p.set(11, 9, PAL.hair[1]);
  for (let x = 6; x <= 10; x++) p.set(x, 13, PAL.hair[x === 8 ? 1 : 2]);
  p.rect(6, 4, 4, 2, (x, y) => PAL.gold[y === 4 ? 4 : 2]);
  p.set(7, 3, PAL.fire[4]); p.set(8, 3, PAL.fire[3]);
  p.set(7, 2, PAL.fire[5]); p.set(8, 1, PAL.fire[3]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Mina

const HILL = (x) => (x < 15 ? 8 + (15 - x) ** 2 * 0.045 : 8 + (x - 15) ** 2 * 0.043) + Math.sin(x * 0.9) * 0.7 + (hash(x >> 1, 0, 81) - 0.5) * 1.6;
const MOUTH = [12, 27, 27, 52]; // interior do túnel: x0, y0, x1, y1
const TORCH_IN = [15, 37]; // tocha presa na parede de dentro
const POST = [59, 17]; // poste da lanterna: x, topo
const HOOK = [52.5, 20]; // onde a lanterna pendura

function buildMineBackdrop() {
  const p = new Pix(64, 64);
  for (let y = 0; y < 54; y++) {
    for (let x = 0; x < 64; x++) {
      const glow = clamp01(1 - Math.hypot((x - 44) / 40, (y - 50) / 22)) * 0.18;
      p.d[y * 64 + x] = pick(DUSK_SKY, 0.04 + (y / 53) * 0.9 + glow, x, y, 2.4);
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(hash(i, 1, 82) * 64), y = Math.floor(hash(i, 2, 82) * 16);
    p.set(x, y, i % 4 ? DUSK_SKY[4] : SNOW[3]);
  }
  // pico nevado lá atrás
  const peak = (x) => Math.min(13 + Math.abs(x - 47) * 0.9, 25 + Math.abs(x - 22) * 0.55) + Math.sin(x * 1.7) * 0.5;
  for (let x = 0; x < 64; x++) {
    const top = Math.round(peak(x));
    const lit = x < 47 && 13 + Math.abs(x - 47) * 0.9 <= 25 + Math.abs(x - 22) * 0.55;
    for (let y = top; y < 54; y++) {
      const snow = y < 22 + Math.sin(x * 0.8) * 1.5 + (lit ? 1 : 0) || (y < 31 && hash(x, y >> 1, 83) < 0.3 && y < top + 6);
      const v = (lit ? 0.62 : 0.3) - (y - top) * 0.012 + (y === top ? 0.2 : 0) + (hash(x, y, 84) - 0.5) * 0.12;
      p.set(x, y, snow ? pick(SNOW, v + 0.2, x, y) : pick(PEAK, v, x, y));
    }
  }
  // serra escura mais perto
  for (let x = 0; x < 64; x++) {
    const top = Math.round(42 + 2.5 * Math.sin(x * 0.11 + 1) + Math.sin(x * 0.37));
    for (let y = top; y < 54; y++) p.set(x, y, pick(RIDGE, (y === top ? 0.8 : 0.45) - (y - top) * 0.03 + (hash(x, y, 85) - 0.5) * 0.2, x, y));
  }
  for (let x = 1; x < 64; x += 4 + Math.floor(hash(x, 1, 86) * 4)) {
    const base = Math.round(43 + 2.5 * Math.sin(x * 0.11 + 1)), h = 3 + Math.floor(hash(x, 2, 86) * 4);
    for (let k = 0; k < h; k++) {
      const half = Math.floor((h - k) * 0.4);
      for (let dx = -half; dx <= half; dx++) p.set(x + dx, base - k, PINE[dx < 0 ? 3 : 1]);
    }
  }
  // chão de cascalho
  for (let y = 51; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.42 + (y - 51) * 0.02 + (hash(x, y, 87) - 0.5) * 0.25;
      if (hash(x >> 1, y, 88) < 0.06) v += 0.25;
      if (y === 51) v -= 0.15;
      p.set(x, y, pick(GRAVEL, v, x, y));
    }
  }
  for (let i = 0; i < 6; i++) p.set(30 + hash(i, 1, 89) * 34, 61 + hash(i, 2, 89) * 3, i % 2 ? COPPER[3] : PAL.gold[3]);
  // trilhos: saem da boca na direção de quem olha e fazem a curva para a direita
  const R = 14, RY = 7, S0 = [20, 52];
  const rail = (phi) => [S0[0] + R * (1 - Math.cos(phi)), S0[1] + RY * Math.sin(phi), Math.cos(phi), Math.sin(phi)];
  const path = [];
  for (let k = 0; k <= 60; k++) path.push(rail((k / 60) * (Math.PI / 2)));
  for (let x = 35; x < 66; x++) path.push([x, S0[1] + RY, 0, 1]);
  const gx = 4.2, gy = 1.6;
  for (let i = 0; i < path.length; i += 1) {
    const [x, y, c, s] = path[i];
    const sleeper = i <= 60 ? i % 9 === 4 : Math.round(x) % 4 === 0;
    if (sleeper) {
      p.line(x - c * gx * 1.45, y + s * gy * 1.45 - 0.5, x + c * gx * 1.45, y - s * gy * 1.45 + 0.5, PAL.wood[1]);
      p.set(x - c * gx * 1.45, y + s * gy * 1.45 - 0.5, PAL.wood[3]);
    }
  }
  for (const [x, y, c, s] of path) {
    p.set(x + c * gx, y - s * gy, PAL.iron[2]);
    p.set(x - c * gx, y + s * gy, PAL.iron[3]);
    p.set(x - c * gx, y + s * gy + 1, PAL.iron[1]);
  }
  return p;
}

// lit = 1 acende o túnel por dentro com a tocha
function buildMine(lit) {
  const p = new Pix(64, 64);
  const [m0, my0, m1, my1] = MOUTH;
  // morro de pedra com o túnel
  p.fill(0, 4, 48, 53, (x, y) => y >= HILL(x) && y < 53, (x, y) => {
    const top = HILL(x);
    let v = 0.42 + facetTone(x, y, 91, 8, 5) * 0.9 - (x - 15) * 0.006 + (y - top < 1.5 ? 0.25 : 0);
    v += clamp01(1 - Math.hypot((x - 19.5) / 15, (y - 38) / 18)) * 0.1; // pedra mais clara em volta da boca
    v -= clamp01((y - 46) / 7) * 0.12;
    return pick(ROCK, v, x, y);
  });
  // capim e uma moita no alto
  for (let x = 0; x < 47; x++) {
    const top = Math.round(HILL(x));
    if (hash(x, 3, 92) < 0.55) p.set(x, top - 1, PAL.grass[hash(x, 4, 92) < 0.5 ? 2 : 1]);
    if (hash(x, 5, 92) < 0.25) p.set(x, top - 2, PAL.grass[2]);
  }
  // pinheirinho no ombro do morro
  for (let k = 0; k < 11; k++) {
    const half = Math.floor((11 - k) * 0.42 + (k % 3 === 0 ? 0.6 : 0));
    for (let dx = -half; dx <= half; dx++) p.set(32 + dx, 18 - k, PINE[dx < 0 ? 4 : dx === 0 ? 3 : 1]);
  }
  p.rect(32, 18, 1, 3, PAL.wood[1]);
  // interior do túnel: escuro, com uma escora lá dentro e os trilhos sumindo
  p.fill(m0, my0, m1, my1, () => true, (x, y) => {
    const d = Math.hypot((x + 0.5 - TORCH_IN[0]) * 0.9, y + 0.5 - TORCH_IN[1]);
    const v = 0.06 + lit * 0.62 * clamp01(1 - d / 15) ** 1.3 + (y - my0) * 0.004;
    return pick(TUNNEL, v + (lit ? rockTone(x, y, 93, 3, 0.4) * 0.3 : 0), x, y, 1.6);
  });
  p.fill(15, 33, 24, 52, (x, y) => y > 41 - (Math.abs(x - 19.5) < 4 ? 0 : 1) && Math.abs(x - 19.5) < 1.5 + (y - 41) * 0.27, (x, y) =>
    pick(TUNNEL, 0.02 + lit * 0.1, x, y));
  for (let y = 41; y < 53; y++) {
    const half = 1.6 + (y - 41) * 0.22;
    p.set(19.5 - half, y, TUNNEL[2 + lit * 2]);
    p.set(19.5 + half, y, TUNNEL[3 + lit * 3]);
    if (y % 3 === 0) for (let x = Math.ceil(19.5 - half); x < 19.5 + half; x++) p.set(x, y, TUNNEL[1 + lit * 2]);
  }
  for (const x of [14, 24]) p.rect(x, 31, 1, 22, TUNNEL[1 + lit * 3]);
  p.rect(14, 30, 11, 1, TUNNEL[1 + lit * 4]);
  p.rect(TORCH_IN[0], TORCH_IN[1], 1, 3, PAL.wood[lit ? 2 : 0]);
  // escoras da boca: esteios, chapéu com as pontas para fora e cunhas
  const beam = (x, y, lit0, along) => pick(PAL.wood, (lit0 ? 0.72 : 0.42) + (hash(along ? x >> 2 : x, along ? y : y >> 2, 94) - 0.5) * 0.18 - (hash(x, y, 95) < 0.04 ? 0.3 : 0), x, y);
  p.rect(9, 27, 3, 26, (x, y) => beam(x, y, x === 9, false));
  p.rect(28, 27, 3, 26, (x, y) => beam(x, y, x === 28, false));
  p.rect(7, 23, 26, 4, (x, y) => beam(x, y, y === 23, true));
  p.rect(7, 26, 26, 1, PAL.wood[1]);
  for (const x of [8, 31]) p.rect(x, 24, 1, 2, PAL.wood[0]);
  for (const [x, y] of [[10, 25], [29, 25], [10, 30], [29, 30]]) p.set(x, y, PAL.iron[3]);
  // placa com a picareta pintada
  p.rect(15, 17, 10, 5, (x, y) => pick(PAL.wood, 0.6 - (y - 17) * 0.05 - (x === 15 || y === 21 ? 0.25 : 0), x, y));
  for (const [x, y] of [[17, 20], [18, 19], [19, 19], [20, 18], [21, 18]]) p.set(x, y, PAL.wood[1]);
  for (const [x, y] of [[19, 18], [20, 17], [22, 19], [23, 20]]) p.set(x, y, PAL.steel[3]);
  p.rect(17, 16, 1, 1, PAL.iron[2]);
  p.rect(23, 16, 1, 1, PAL.iron[2]);
  // picareta encostada no esteio
  p.line(7, 52, 4, 40, PAL.wood[3]);
  for (const [x, y, k] of [[1, 41, 3], [2, 40, 4], [3, 40, 4], [4, 39, 3], [5, 39, 3], [6, 40, 2], [7, 41, 2]]) p.set(x, y, PAL.steel[k]);
  // pilha de minério ao pé do morro
  p.fill(0, 42, 12, 53, (x, y) => y >= 45 + Math.abs(x - 3) * 0.75 + (hash(x, 0, 96) - 0.5) && y < 54, (x, y) => oreChunk(x, y, 97, 3, 0.12));
  // carrinho cheio de minério
  p.poly([[36.5, 45], [57.5, 45], [55.5, 56], [38.5, 56]], (x, y) => {
    const board = Math.floor((y - 45) / 3);
    let v = 0.62 - (x - 37) * 0.012 + (hash(board, x >> 3, 98) - 0.5) * 0.12;
    if ((y - 45) % 3 === 2) v -= 0.25;
    return pick(PAL.wood, v, x, y);
  });
  for (const x of [38, 47, 56]) p.fill(x - 1, 45, x + 1, 56, (xx, yy) => xx === x - (yy - 45) * (x < 47 ? -0.18 : x > 47 ? 0.18 : 0) || xx === Math.round(x - (yy - 45) * (x < 47 ? -0.18 : x > 47 ? 0.18 : 0)), (xx) => PAL.iron[xx < 47 ? 3 : 2]);
  p.rect(36, 45, 22, 1, (x) => PAL.iron[x < 46 ? 4 : 3]);
  p.rect(38, 55, 18, 1, PAL.iron[1]);
  for (const x of [40, 45, 49, 54]) p.set(x, 50, PAL.iron[1]);
  p.fill(37, 37, 57, 45, (x, y) => y < 45 && y >= 44.6 - 6 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 47) / 10.6) ** 2)) + (hash(x, 1, 99) - 0.5) * 1.4,
    (x, y) => oreChunk(x, y, 100, 3, 0.16));
  p.sphere(41.5, 39.5, 1.6, 1.4, AMETHYST, 0.2);
  // rodas
  for (const wx of [42, 52]) {
    p.ellipse(wx, 57.5, 2.7, 2.7, (x, y) => (Math.hypot(x + 0.5 - wx, y + 0.5 - 57.5) > 1.6 ? PAL.iron[x < wx || y < 57 ? 3 : 1] : PAL.iron[0]));
    p.set(wx, 57, PAL.iron[3]);
    p.set(wx - 1, 56, PAL.iron[4]);
  }
  // poste da lanterna com o braço e a mão-francesa
  const [px, ptop] = POST;
  p.rect(px, ptop, 2, 61 - ptop, (x, y) => pick(PAL.wood, (x === px ? 0.7 : 0.35) + (hash(x, y >> 2, 101) - 0.5) * 0.12, x, y));
  p.rect(51, ptop + 1, px - 51, 2, (x, y) => PAL.wood[y === ptop + 1 ? 4 : 2]);
  p.line(px - 1, ptop + 7, px - 6, ptop + 3, PAL.wood[2]);
  p.set(px, ptop - 1, PAL.wood[3]);
  p.rect(52, ptop + 3, 1, 1, PAL.iron[2]);
  p.outline(PAL.out);
  return p;
}

// Lanterna pendurada no braço do poste, balançando em torno do gancho.
function paintLantern(f, ang, t, live) {
  const [hx, hy] = HOOK;
  const ux = Math.sin(ang), uy = Math.cos(ang);
  const at = (d, s) => [hx + ux * d + uy * s, hy + uy * d - ux * s];
  for (let d = 0; d < 3; d++) f.set(...at(d, 0), PAL.iron[d % 2 ? 1 : 3]);
  // tampa, vidro aceso e base
  for (let d = 3; d <= 9; d++) {
    for (let s = -2; s <= 2; s++) {
      const [x, y] = at(d, s);
      let c;
      if (d === 3) c = Math.abs(s) < 2 ? PAL.iron[2] : 0;
      else if (d === 4 || d === 9) c = PAL.iron[d === 4 ? 3 : 1];
      else if (Math.abs(s) === 2) c = PAL.iron[s < 0 ? 2 : 1];
      else {
        const heat = 1 - (Math.abs(s) * 0.3 + Math.abs(d - 7) * 0.12) + Math.sin(t * 13 + d) * 0.08 * live;
        c = pick(PAL.fire, 0.35 + heat * 0.65, Math.round(x), Math.round(y));
      }
      if (c) f.set(x, y, c);
    }
  }
  // contorno simples por fora do vidro
  for (const s of [-3, 3]) for (let d = 4; d <= 9; d++) f.set(...at(d, s), PAL.out);
  f.set(...at(10, 0), PAL.out);
  f.set(...at(10, -1), PAL.out);
  f.set(...at(10, 1), PAL.out);
}

const mineArt = { bg: null, body: null, halo: null, clouds: null, frame: new Pix(64, 64) };

function paintMinePortrait(ctx, t, info) {
  const a = mineArt;
  if (!a.bg) {
    a.bg = buildMineBackdrop();
    a.body = buildMine(0);
    const [tx, ty] = TORCH_IN;
    a.halo = makeHalo(a.body, buildMine(1), (x, y) => Math.hypot((x + 0.5 - tx) * 0.9, y + 0.5 - ty) / 16);
    a.clouds = [makeCloud(20, 7, 31, DUSK_CLOUD), makeCloud(14, 6, 12, DUSK_CLOUD)];
    a.glints = [];
    for (let y = 37; y < 56; y++) {
      for (let x = 0; x < 58; x++) if (a.body.get(x, y) === PAL.gold[5] || a.body.get(x, y) === PAL.gold[4]) a.glints.push([x, y]);
    }
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 1.2) % 90) - 22), 5);
  f.blit(a.clouds[1], Math.floor(((t * 0.8 + 47) % 84) - 16), 13);
  // estrelas piscando
  for (let i = 0; i < 3; i++) {
    if (Math.sin(t * (1.3 + i * 0.4) + i * 2) > 0.6) f.set(Math.floor(hash(i, 1, 82) * 64), Math.floor(hash(i, 2, 82) * 16), SNOW[4]);
  }
  // morcegos rodando em volta do pico
  for (let k = 0; k < 2; k++) {
    const ph = t * (0.5 + k * 0.17) + k * 2.5;
    paintBat(f, 44 + Math.cos(ph) * (9 + k * 4) + Math.sin(ph * 2.3) * 2, 9 + k * 4 + Math.sin(ph * 2) * 3, Math.sin(t * 16 + k * 2));
  }
  f.blit(a.body, 0, 0);
  // tocha lá dentro acendendo o túnel
  const flick = Math.sin(t * 9.4) * 0.5 + Math.sin(t * 15.1 + 1) * 0.3 + Math.sin(t * 3.7) * 0.2;
  paintHalo(f, a.halo, 0.5 + live * 0.18 + flick * 0.1);
  paintFlame(f, TORCH_IN[0] + 0.5, TORCH_IN[1] - 1, t, 3 + live, 1.2, live);
  // trabalhando: a lamparina de um mineiro vem chegando pelo túnel
  if (info.working) {
    const u = 0.5 - 0.5 * Math.cos(t * 0.5);
    const x = 21 + u * 2.5, y = 36 + u * 6 + Math.abs(Math.sin(t * 3.2)) * 0.8;
    f.set(x, y, PAL.fire[u > 0.5 ? 5 : 4]);
    if (u > 0.4) { f.set(x - 1, y, PAL.fire[2]); f.set(x + 1, y, PAL.fire[2]); }
  }
  // lanterna balançando, com um halo de luz em volta
  const ang = Math.sin(t * 1.4) * 0.22 + Math.sin(t * 0.6) * 0.06;
  const lx = HOOK[0] + Math.sin(ang) * 6.5, ly = HOOK[1] + Math.cos(ang) * 6.5;
  const R = 6 + flick * 0.6;
  for (let y = Math.floor(ly - R); y <= ly + R; y++) {
    for (let x = Math.floor(lx - R); x <= lx + R; x++) {
      const d = Math.sqrt((x + 0.5 - lx) ** 2 + (y + 0.5 - ly) ** 2) / R;
      if (d < 1 && d > 0.35 && bayer(x, y) < (1 - d) * 0.3) f.set(x, y, PAL.fire[d < 0.6 ? 3 : 2]);
    }
  }
  paintLantern(f, ang, t, live);
  // ouro faiscando no carrinho e na pilha
  for (let k = 0; k < 3; k++) {
    const g = a.glints[Math.floor(hash(k, Math.floor((t + k * 1.3) / 2.6), 7) * a.glints.length)];
    if (g) paintGlint(f, g[0], g[1], pulse(t + k * 1.3, 2.6, info.working ? 0.7 : 0.45) * 0.8);
  }
  f.draw(ctx);
}

function iconMine() {
  const p = new Pix(16, 16);
  // morro de pedra com a boca escorada e os trilhos saindo
  p.fill(0, 2, 15, 15, (x, y) => y >= 2.5 + ((x - 7.5) / 7.5) ** 2 * 7, (x, y) =>
    pick(ROCK, 0.3 + sphereLight((x + 0.5 - 6) / 9, (y + 0.5 - 6) / 9) * 0.75 + (hash(x, y, 4) - 0.5) * 0.15, x, y));
  p.rect(4, 7, 8, 9, TUNNEL[0]);
  p.rect(3, 7, 2, 9, (x) => PAL.wood[x === 3 ? 4 : 3]);
  p.rect(11, 7, 2, 9, (x) => PAL.wood[x === 11 ? 3 : 2]);
  p.rect(2, 5, 12, 2, (x, y) => PAL.wood[y === 5 ? 4 : 2]);
  for (let y = 10; y < 16; y++) {
    const h = 1 + (y - 10) * 0.45;
    p.set(7.5 - h, y, PAL.iron[3]);
    p.set(8.5 + h, y, PAL.iron[4]);
  }
  p.rect(6, 12, 4, 1, PAL.wood[1]);
  p.rect(5, 14, 6, 1, PAL.wood[1]);
  p.set(7, 9, PAL.fire[4]);
  p.set(7, 8, PAL.fire[3]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Cena: encosta da serra ao anoitecer, com bocas de mina, trilhos, pilhas de minério
// e mineiros trabalhando à luz das tochas.

const SH = SCENES.H;
const FOOT = 86; // pé do paredão
const RAIL = 97; // trilho de trás (o da frente fica 3 pixels abaixo)
const LEDGE = 62; // chão das minas altas, nas plataformas
const ridgeAt = (x) => 33 + 7 * Math.sin(x * 0.017 + 0.7) + 4 * Math.sin(x * 0.043 + 2.1) + 1.5 * Math.sin(x * 0.15) + (hash(x >> 2, 0, 7) - 0.5) * 2.4;
const midAt = (x) => 54 + 4 * Math.sin(x * 0.021 + 1) + 2.5 * Math.sin(x * 0.067);
const footAt = (x) => FOOT + Math.round(Math.sin(x * 0.05) * 0.8 + Math.sin(x * 0.23));

// Boca de mina com escoras; high = no alto do paredão, com plataforma, escada e entulho.
// Devolve o sprite, os pixels da boca (com a distância até a tocha de dentro) e a tocha.
function buildSceneMine(high) {
  const w = 34, h = high ? 56 : 42;
  const p = new Pix(w, h);
  const cx = 17, bottom = 28; // chão da boca
  if (high) {
    // entulho claro escorrendo da plataforma até o pé do paredão
    p.fill(0, bottom + 2, w - 1, h - 1, (x, y) => y < h - 1 && Math.abs(x + 0.5 - cx + 2) < 3 + (y - bottom - 2) * 0.5 + (hash(x, y >> 1, 11) - 0.5) * 1.5,
      (x, y) => rubble(x, y, 12, 0.66 - (y - bottom) * 0.008));
  }
  // moldura de pedra em volta da boca
  p.fill(cx - 12, 3, cx + 12, bottom, (x, y) => ((x + 0.5 - cx) / 12) ** 2 + ((y + 0.5 - bottom) / 25) ** 2 <= 1, (x, y) =>
    pick(ROCK, 0.56 + facetTone(x, y, 14, 5, 3) * 0.8 - (y - 6) * 0.004, x, y));
  // boca escura
  const mouth = [];
  p.fill(cx - 6, 10, cx + 5, bottom, () => true, (x, y) => pick(TUNNEL, 0.03 + (y - 10) * 0.004, x, y));
  for (let y = 10; y <= bottom; y++) for (let x = cx - 6; x <= cx + 5; x++) mouth.push([x, y]);
  // escora de dentro e os trilhos sumindo no escuro
  for (let y = 18; y <= bottom; y++) {
    const half = 1 + (y - 18) * 0.3;
    p.set(cx - 0.5 - half, y, TUNNEL[3]);
    p.set(cx - 0.5 + half, y, TUNNEL[4]);
  }
  p.rect(cx - 4, 14, 1, bottom - 13, TUNNEL[2]);
  p.rect(cx + 3, 14, 1, bottom - 13, TUNNEL[2]);
  p.rect(cx - 4, 14, 8, 1, TUNNEL[3]);
  // esteios e chapéu
  const beam = (x, y, lit, along) => pick(PAL.wood, (lit ? 0.75 : 0.45) + (hash(along ? x >> 2 : x, along ? y : y >> 2, 15) - 0.5) * 0.16, x, y);
  p.rect(cx - 8, 10, 2, bottom - 9, (x, y) => beam(x, y, x === cx - 8, false));
  p.rect(cx + 6, 10, 2, bottom - 9, (x, y) => beam(x, y, x === cx + 6, false));
  p.rect(cx - 10, 7, 20, 3, (x, y) => beam(x, y, y === 7, true));
  p.rect(cx - 10, 9, 20, 1, PAL.wood[1]);
  if (high) {
    // plataforma de tábuas, com as escoras e a escada descendo
    p.rect(cx - 13, bottom + 1, 26, 2, (x, y) => PAL.wood[y === bottom + 1 ? ((x - cx) % 4 === 0 ? 2 : 4) : 1]);
    p.line(cx - 11, bottom + 3, cx - 7, bottom + 9, PAL.wood[2]);
    p.line(cx + 10, bottom + 3, cx + 6, bottom + 9, PAL.wood[1]);
    for (const x of [cx + 8, cx + 11]) p.rect(x, bottom + 1, 1, h - bottom - 1, PAL.wood[x === cx + 8 ? 3 : 2]);
    for (let y = bottom + 4; y < h; y += 3) p.rect(cx + 9, y, 2, 1, PAL.wood[3]);
  } else {
    // trilhos descendo até a linha principal
    for (let y = bottom + 1; y < h - 1; y++) {
      const half = 3 + (y - bottom) * 0.2;
      if ((y - bottom) % 3 === 1) p.rect(Math.round(cx - 0.5 - half - 1), y, Math.round(half * 2 + 2), 1, PAL.wood[1]);
      p.set(cx - 0.5 - half, y, PAL.iron[2]);
      p.set(cx - 0.5 + half, y, PAL.iron[3]);
    }
  }
  p.outline(PAL.out);
  // a tocha fica no esteio de dentro; os pixels da boca que sobraram escuros acendem
  const lit = mouth.filter(([x, y]) => p.get(x, y) !== PAL.out);
  const pts = lit.map(([x, y]) => [x, y, Math.hypot(x + 0.5 - (cx - 4), (y + 0.5 - 18) * 1.1)]);
  return { p, pts, cx, bottom, torch: [cx - 4, 18] };
}

// Boca principal, maior, com telhadinho de tábuas, placa, barril e caixote.
function buildMainMine() {
  const w = 48, h = 44;
  const p = new Pix(w, h);
  const cx = 24, bottom = 34;
  p.fill(cx - 17, 0, cx + 17, bottom, (x, y) => ((x + 0.5 - cx) / 17) ** 2 + ((y + 0.5 - bottom) / 33) ** 2 <= 1, (x, y) =>
    pick(ROCK, 0.56 + facetTone(x, y, 16, 6, 4) * 0.8, x, y));
  p.fill(cx - 8, 12, cx + 7, bottom, () => true, (x, y) => pick(TUNNEL, 0.03 + (y - 12) * 0.004, x, y));
  const mouth = [];
  for (let y = 12; y <= bottom; y++) for (let x = cx - 8; x <= cx + 7; x++) mouth.push([x, y]);
  for (let y = 20; y <= bottom; y++) {
    const half = 1.5 + (y - 20) * 0.32;
    p.set(cx - 0.5 - half, y, TUNNEL[3]);
    p.set(cx - 0.5 + half, y, TUNNEL[4]);
    if (y % 3 === 0) for (let x = Math.ceil(cx - 0.5 - half) + 1; x < cx - 0.5 + half; x++) p.set(x, y, TUNNEL[2]);
  }
  p.rect(cx - 5, 16, 1, bottom - 15, TUNNEL[2]);
  p.rect(cx + 4, 16, 1, bottom - 15, TUNNEL[2]);
  p.rect(cx - 5, 16, 10, 1, TUNNEL[3]);
  const beam = (x, y, lit, along) => pick(PAL.wood, (lit ? 0.75 : 0.45) + (hash(along ? x >> 2 : x, along ? y : y >> 2, 17) - 0.5) * 0.16, x, y);
  p.rect(cx - 11, 12, 3, bottom - 11, (x, y) => beam(x, y, x === cx - 11, false));
  p.rect(cx + 8, 12, 3, bottom - 11, (x, y) => beam(x, y, x === cx + 8, false));
  p.rect(cx - 13, 8, 26, 4, (x, y) => beam(x, y, y === 8, true));
  p.rect(cx - 13, 11, 26, 1, PAL.wood[1]);
  for (const [x, y] of [[cx - 10, 10], [cx + 9, 10]]) p.set(x, y, PAL.iron[3]);
  // telhadinho de tábuas sobre a boca
  p.poly([[cx - 16, 8.5], [cx - 12, 2.5], [cx + 12, 2.5], [cx + 16, 8.5]], (x, y) => {
    let v = 0.55 - (x - cx) * 0.012 - ((x - cx + 40) % 4 === 0 ? 0.22 : 0) + (y === 3 ? 0.2 : 0);
    if (y === 8) v -= 0.25;
    return pick(PAL.wood, v, x, y);
  });
  // placa com a picareta
  p.rect(cx - 4, 4, 8, 4, (x, y) => PAL.wood[y === 4 ? 4 : 3]);
  for (const [x, y] of [[cx - 2, 7], [cx - 1, 6], [cx, 6], [cx + 1, 5]]) p.set(x, y, PAL.wood[1]);
  for (const [x, y] of [[cx - 1, 5], [cx, 4], [cx + 2, 6], [cx + 3, 7]]) p.set(x, y, PAL.steel[3]);
  // trilhos descendo até a linha principal
  for (let y = bottom + 1; y < h - 1; y++) {
    const half = 3.5 + (y - bottom) * 0.25;
    if ((y - bottom) % 3 === 1) p.rect(Math.round(cx - 0.5 - half - 1), y, Math.round(half * 2 + 2), 1, PAL.wood[1]);
    p.set(cx - 0.5 - half, y, PAL.iron[2]);
    p.set(cx - 0.5 + half, y, PAL.iron[3]);
  }
  // barril e caixote do lado
  p.fill(cx + 13, bottom - 6, cx + 18, bottom, () => true, (x, y) =>
    y === bottom - 4 || y === bottom - 1 ? PAL.iron[1] : pick(PAL.wood, 0.25 + cylLight((x + 0.5 - (cx + 15.5)) / 3) * 0.6, x, y));
  p.rect(cx + 19, bottom - 4, 6, 5, (x, y) => pick(PAL.wood, (y === bottom - 4 ? 0.8 : 0.5) - ((x - cx) % 3 === 0 ? 0.2 : 0), x, y));
  p.outline(PAL.out);
  const lit = mouth.filter(([x, y]) => p.get(x, y) !== PAL.out);
  const pts = lit.map(([x, y]) => [x, y, Math.hypot(x + 0.5 - (cx - 5), (y + 0.5 - 21) * 1.1)]);
  return { p, pts, cx, bottom, torch: [cx - 5, 21] };
}

// Carrinho de mina cheio (sem as rodas, que giram a cada quadro).
function buildCart(seed) {
  const p = new Pix(16, 12);
  p.poly([[0.5, 4], [15.5, 4], [14, 10], [2, 10]], (x, y) => {
    let v = 0.55 - (x - 1) * 0.015 + (y === 4 ? 0.2 : 0);
    if (y === 7) v -= 0.22;
    return pick(PAL.wood, v, x, y);
  });
  for (const x of [1, 8, 14]) p.rect(x, 4, 1, 6, PAL.iron[x < 8 ? 3 : 2]);
  p.rect(0, 4, 16, 1, (x) => PAL.iron[x < 8 ? 4 : 3]);
  p.fill(1, 0, 15, 4, (x, y) => y < 4 && y >= 3.6 - 3.2 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 8) / 7.2) ** 2)) + (hash(x, seed, 18) - 0.5), (x, y) =>
    oreChunk(x, y, 19 + seed, 2, seed === 2 ? 0.3 : 0.1));
  p.outline(PAL.out);
  return p;
}

// Pedra grande com veio, onde o mineiro bate.
function buildBoulder(seed) {
  const p = new Pix(14, 10);
  const vein = [COPPER, PAL.gold, RUST][seed % 3];
  p.fill(0, 0, 13, 9, (x, y) => ((x - 7) / 6.2) ** 2 + ((y - 8) / (6 + hash(x, 0, seed) * 1.2)) ** 2 <= 1 && y < 9.5, (x, y) =>
    pick(ROCK, 0.2 + sphereLight((x + 0.5 - 7) / 6.2, (y + 0.5 - 6) / 6) * 0.8 + facetTone(x, y, 20 + seed, 4, 3) * 0.5, x, y));
  for (let x = 2; x < 12; x++) {
    const y = Math.round(5 + Math.sin(x * 0.9 + seed) * 1.2 + (x - 7) * 0.2);
    if (p.get(x, y)) p.set(x, y, vein[x % 3 ? 3 : 4]);
  }
  p.outline(PAL.out);
  return p;
}

class MineScene extends SCENES.BaseScene {
  constructor() {
    super();
    this.cloudRamp = DUSK_CLOUD;
    this.birdColor = BAT;
    this.mines = [buildSceneMine(false), buildSceneMine(true)];
    this.main = buildMainMine();
    this.carts = [0, 1, 2].map(buildCart);
    this.boulders = [0, 1, 2].map(buildBoulder);
    this.manCache = [];
  }

  buildClouds() {
    super.buildClouds(12);
  }

  layout() {
    const w = this.w;
    this.ridge = new Int16Array(w);
    for (let x = 0; x < w; x++) this.ridge[x] = Math.round(ridgeAt(x));
    // penhascos pontudos aqui e ali na crista
    for (let x = 20; x < w; x += 50 + Math.floor(hash(x, 1, 20) * 70)) {
      const hgt = 4 + hash(x, 2, 20) * 5, half = 3 + hash(x, 3, 20) * 3;
      for (let k = Math.ceil(x - half); k <= x + half && k < w; k++) {
        this.ridge[k] = Math.min(this.ridge[k], Math.round(ridgeAt(x) - hgt * (1 - Math.abs(k - x) / half) + (k > x ? 1 : 0)));
      }
    }
    // picos nevados ao longe
    this.peaks = [];
    for (let x = -20, i = 0; x < w + 60; x += 46 + Math.floor(hash(i, 1, 21) * 50), i++) {
      this.peaks.push([x, 14 + hash(i, 2, 21) * 16, 0.5 + hash(i, 3, 21) * 0.35]);
    }
    const near = (list, x, d) => list.some((v) => Math.abs(v - x) < d);
    this.mainX = Math.max(30, Math.round(w * 0.1));
    // minas extras: no pé do paredão ou no alto, onde a rocha deixa
    this.mineSpots = [];
    for (let x = this.mainX + 74, i = 0; x < w - 20; x += 88, i++) {
      let top = 0;
      for (let k = x - 16; k <= x + 16; k++) top = Math.max(top, ridgeAt(k));
      this.mineSpots.push({ x, high: i % 2 === 1 && top < LEDGE - 30 });
    }
    const low = this.mineSpots.filter((m) => !m.high).map((m) => m.x).concat([this.mainX]);
    const all = this.mineSpots.map((m) => m.x).concat([this.mainX]);
    // tochas presas no paredão, entre as minas
    this.torches = [];
    for (let x = 18; x < w - 6; x += 64) if (!near(all, x, 26)) this.torches.push(x + Math.round((hash(x, 1, 22) - 0.5) * 10));
    // pilhas de minério e postes de lanterna no pátio
    this.piles = [];
    for (let x = this.mainX + 130; x < w - 10; x += 210) this.piles.push(x);
    this.lamps = [];
    for (let x = this.mainX + 60; x < w - 8; x += 210) if (!near(this.piles, x, 30)) this.lamps.push(x);
    // mineiros: fila de trás (no pé do paredão) e fila da frente
    const spots = [];
    let i = 0;
    for (let x = 22; x < w - 18; x += 56, i++) {
      if (near(low, x, 30) || near(this.torches, x, 10)) continue;
      spots.push({ x, foot: 91 + (i % 2), dir: hash(i, 3, 23) < 0.5 ? -1 : 1, phase: hash(i, 4, 23), rock: i % 3 });
    }
    for (let x = 40; x < w - 18; x += 50, i++) {
      const sx = x + Math.round((hash(i, 5, 23) - 0.5) * 12);
      if (near(this.piles, sx, 24) || near(this.lamps, sx, 16) || near([this.mainX], sx, 22)) continue;
      spots.push({ x: sx, foot: 104 + (i % 3) * 3, dir: hash(i, 3, 23) < 0.5 ? -1 : 1, phase: hash(i, 4, 23), rock: i % 3 });
    }
    // ordem de chegada espalhada pela tela (índices com os bits invertidos)
    spots.sort((a, b) => a.x - b.x);
    const rev = (n) => { let r = 0; for (let b = 0; b < 8; b++) r = (r << 1) | ((n >> b) & 1); return r; };
    this.minerSpots = spots.map((s, k) => [rev(k), s]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    this.maxCarts = Math.max(1, Math.floor(w / 140));
  }

  farAt(x) {
    let top = 99, lit = false;
    for (const [px, py, s] of this.peaks) {
      const y = py + Math.abs(x - px) * s;
      if (y < top) { top = y; lit = x < px; }
    }
    return [top + Math.sin(x * 0.9) * 0.6 + (hash(x >> 1, 0, 24) - 0.5) * 1.2, lit];
  }

  buildBackground() {
    const p = this.bg, w = this.w;
    const glowX = w * 0.64;
    // céu esfriando, com o resto do sol atrás da serra
    for (let y = 0; y < 80; y++) {
      for (let x = 0; x < w; x++) {
        const glow = clamp01(1 - Math.hypot((x - glowX) / 190, (y - 54) / 30)) * 0.24;
        p.d[y * w + x] = pick(DUSK_SKY, 0.02 + (y / 54) * 0.86 + glow, x, y, 3);
      }
    }
    // estrelas e lua
    this.stars = [];
    for (let i = 0; i < w / 9; i++) {
      const x = Math.floor(hash(i, 1, 25) * w), y = Math.floor(hash(i, 2, 25) * 22);
      p.set(x, y, i % 5 ? DUSK_SKY[3] : DUSK_SKY[6]);
      if (i % 4 === 0) this.stars.push([x, y]);
    }
    const mx = Math.round(w * 0.86), my = 11;
    p.fill(mx - 4, my - 4, mx + 4, my + 4, (x, y) => Math.hypot(x - mx, y - my) <= 3.6 && Math.hypot(x - mx - 1.8, y - my + 1) > 3, (x) => SNOW[x < mx - 1 ? 4 : 3]);
    // picos nevados
    this.sky = new Int16Array(w); // primeira linha que não é céu, para as nuvens
    for (let x = 0; x < w; x++) {
      const [ft, lit] = this.farAt(x);
      const top = Math.round(ft);
      this.sky[x] = Math.min(top, Math.round(midAt(x)), this.ridge[x]);
      for (let y = top; y < 80; y++) {
        const snow = y < top + 5 + hash(x, y >> 1, 26) * 3 && y < 40;
        const v = (lit ? 0.62 : 0.32) - (y - top) * 0.012 + (y === top ? 0.2 : 0) + (hash(x, y, 27) - 0.5) * 0.12;
        p.d[y * w + x] = snow ? pick(SNOW, v + 0.15, x, y) : pick(PEAK, v, x, y);
      }
    }
    // serra escura no meio, com pinheiros
    for (let x = 0; x < w; x++) {
      const top = Math.round(midAt(x));
      for (let y = top; y < 80; y++) p.d[y * w + x] = pick(RIDGE, (y === top ? 0.75 : 0.42) - (y - top) * 0.02 + (hash(x, y, 28) - 0.5) * 0.18, x, y);
    }
    for (let x = 2; x < w; x += 3 + Math.floor(hash(x, 1, 29) * 5)) {
      const base = Math.round(midAt(x)) + 1, h = 3 + Math.floor(hash(x, 2, 29) * 5);
      for (let k = 0; k < h; k++) {
        const half = Math.floor((h - k) * 0.4);
        for (let dx = -half; dx <= half; dx++) p.set(x + dx, base - k, PINE[dx < 0 ? 2 : 1]);
      }
    }
    // paredão: colunas largas (face clara à esquerda, sombra e fenda à direita),
    // estratos com a quina de cima pegando luz ou musgo, e lascas por cima de tudo
    for (let x = 0; x < w; x++) {
      const top = this.ridge[x], foot = footAt(x);
      for (let y = top; y < foot; y++) {
        const depth = (y - top) / (foot - top);
        const ph = (x * 0.075 + y * 0.03 + Math.sin(x * 0.013) * 2.2 + Math.sin(x * 0.033 + 1) * 1.2) / (Math.PI * 2);
        const u = ph - Math.floor(ph);
        let v = 0.5 + (u < 0.74 ? 0.13 - u * 0.15 : -0.13) + facetTone(x, y, 30, 15, 7) * 0.7 - depth * 0.2;
        if (Math.abs(u - 0.74) < 0.014) v -= 0.3;
        const s = y + x * 0.06 + Math.sin(x * 0.021 + 1) * 3, band = Math.floor(s / 14), fs = s - band * 14;
        let c = 0;
        if (fs < 1) v -= 0.32;
        else if (fs < 2) {
          v += 0.16;
          if (depth < 0.75 && hash(band, x >> 2, 32) < 0.55) c = MOSS[hash(x, y, 31) < 0.5 ? 3 : 2];
        } else if (fs < 3 && depth < 0.75 && hash(band, x >> 2, 32) < 0.3 && bayer(x, y) < 0.5) c = MOSS[1];
        if (y - top < 2) v += 0.25 - (y - top) * 0.1;
        p.d[y * w + x] = c || pick(ROCK, v, x, y);
      }
    }
    // fendas fundas descendo o paredão
    for (let i = 0; i < w / 70; i++) {
      const x0 = Math.floor(hash(i, 1, 42) * w), len = 10 + hash(i, 2, 42) * 20;
      const y0 = this.ridge[Math.min(w - 1, x0)] + 4;
      for (let k = 0; k < len; k++) {
        const x = Math.round(x0 + Math.sin(k * 0.35 + i) * 1.5 + k * 0.15), y = y0 + k;
        if (x < 1 || x >= w || y > FOOT - 4) break;
        p.set(x, y, ROCK[0]);
        p.set(x - 1, y, ROCK[6]);
      }
    }
    // veios de cobre, ferro e ouro, em zigue-zague, com manchas escorrendo
    this.glints = [];
    const kinds = [PAL.gold, COPPER, RUST, COPPER, PAL.gold];
    for (let i = 0; i < w / 50; i++) {
      const r = kinds[i % kinds.length];
      let x = Math.floor(hash(i, 1, 31) * w), y = Math.round(48 + hash(i, 3, 31) * 30);
      const len = 8 + Math.floor(hash(i, 2, 31) * 16);
      for (let k = 0; k < len && x < w; k++, x++) {
        if (hash(k, i, 32) < 0.35) y += hash(k, i, 33) < 0.5 ? -1 : 1;
        if (y < this.ridge[x] + 5 || y > footAt(x) - 4) continue;
        const bright = hash(x, y, 34) < 0.3;
        p.set(x, y, r[bright ? 4 : 2]);
        p.set(x, y + 1, ROCK[1]);
        if (bright && r === PAL.gold) this.glints.push([x, y]);
        if (r !== PAL.gold && hash(x, y, 35) < 0.12) {
          for (let s = 2; s < 4 + hash(x, 1, 35) * 4; s++) if (bayer(x, y + s) < 0.7) p.set(x, y + s, r === COPPER ? VERDIGRIS[1] : RUST[1]);
        }
      }
    }
    // drusas de ametista
    for (let i = 0; i < w / 110; i++) {
      const x = Math.floor(hash(i, 1, 33) * w), y = Math.round(this.ridge[Math.min(w - 1, x)] + 10 + hash(i, 2, 33) * 20);
      if (y > FOOT - 6) continue;
      for (const [dx, h] of [[0, 2], [1, 3], [2, 2]]) for (let j = 0; j < h; j++) p.set(x + dx, y - j, AMETHYST[Math.min(4, 4 - j + (dx === 1 ? 0 : -1))]);
      p.set(x - 1, y + 1, ROCK[1]);
      this.glints.push([x + 1, y - 2]);
    }
    // pinheiros e capim na crista
    for (let x = 0; x < w; x++) {
      if (hash(x, 1, 34) < 0.5) p.set(x, this.ridge[x] - 1, PINE[hash(x, 2, 34) < 0.5 ? 3 : 2]);
    }
    for (let x = 4; x < w; x += 7 + Math.floor(hash(x, 3, 34) * 30)) {
      const base = this.ridge[x] + 1, h = 5 + Math.floor(hash(x, 4, 34) * 9);
      for (let k = 0; k < h; k++) {
        const half = Math.floor((h - k) * 0.38 + (k % 3 === 0 ? 0.5 : 0));
        for (let dx = -half; dx <= half; dx++) p.set(x + dx, base - k, PINE[dx < 0 ? 4 : dx === 0 ? 3 : 1]);
      }
      p.set(x, base - h, PINE[3]);
    }
    // pátio de cascalho, mais escuro junto do paredão
    for (let x = 0; x < w; x++) {
      for (let y = footAt(x); y < SH; y++) {
        const depth = (y - FOOT) / (SH - FOOT);
        let v = 0.3 + depth * 0.3 + (hash(x, y, 35) - 0.5) * 0.22;
        if (hash(x >> 1, y, 36) < 0.05) v += 0.25;
        if (y >= RAIL - 2 && y <= RAIL + 5) v += 0.1; // leito de brita dos trilhos
        p.d[y * w + x] = pick(GRAVEL, v, x, y);
      }
    }
    for (let i = 0; i < w / 22; i++) {
      const x = Math.floor(hash(i, 1, 37) * w), y = FOOT + 3 + Math.floor(hash(i, 2, 37) * 23);
      p.set(x, y, [COPPER[3], PAL.gold[3], RUST[3], ROCK[6]][i % 4]);
    }
    // entulho no pé do paredão
    for (let x = 0; x < w; x++) {
      const hgt = 1.5 + 2.4 * Math.max(0, Math.sin(x * 0.11 + 1)) + hash(x >> 1, 0, 38) * 1.5;
      const foot = footAt(x);
      for (let y = Math.round(foot - hgt); y < foot + 2; y++) p.d[y * w + x] = rubble(x, y, 39, 0.46 - (y - foot) * 0.02);
    }
    // trilhos: dormentes e os dois trilhos de ferro
    for (let x = 0; x < w; x++) {
      if (x % 5 === 0) for (let y = RAIL - 1; y <= RAIL + 4; y++) p.d[y * w + x + (y > RAIL + 1 ? 1 : 0)] = PAL.wood[y === RAIL - 1 ? 3 : 1];
      if (x % 5 === 1) for (let y = RAIL; y <= RAIL + 4; y++) p.d[y * w + x + (y > RAIL + 1 ? 1 : 0)] = PAL.wood[2];
    }
    for (let x = 0; x < w; x++) {
      p.d[RAIL * w + x] = PAL.iron[2];
      p.d[(RAIL + 3) * w + x] = PAL.iron[x % 7 < 3 ? 4 : 3];
      p.d[(RAIL + 4) * w + x] = PAL.iron[0];
    }
    // boca principal com a pilha de minério ao lado
    const m = this.main;
    this.mainAt = [this.mainX - m.cx, footAt(this.mainX) + 2 - m.bottom];
    p.blit(m.p, ...this.mainAt);
    this.paintPile(p, this.mainX - 24, FOOT + 6, 8, 40);
    // pilhas de minério no pátio
    for (const x of this.piles) this.paintPile(p, x, SH - 2 - (x % 3), 14, x);
    // postes de lanterna, com a poça de luz no cascalho
    for (const x of this.lamps) {
      for (let y = 96; y < SH; y++) {
        for (let xx = x - 24; xx <= x + 30; xx++) {
          if (xx < 0 || xx >= w) continue;
          const d = Math.hypot((xx + 0.5 - x - 3) / 26, (y + 0.5 - 106) / 9);
          if (d >= 1 || bayer(xx, y) >= (1 - d) * 1.4) continue;
          const i = y * w + xx, k = GRAVEL.indexOf(p.d[i]);
          if (k >= 0) p.d[i] = WARM_GRAVEL[Math.min(6, k + (d < 0.45 ? 1 : 0))];
        }
      }
      const post = new Pix(9, 21);
      post.rect(1, 18, 4, 2, PAL.wood[1]);
      post.rect(2, 1, 2, 18, (xx, y) => PAL.wood[xx === 2 ? 4 : 2]);
      post.rect(4, 1, 4, 1, PAL.wood[3]);
      post.set(4, 2, PAL.wood[2]);
      post.outline(PAL.out);
      p.blit(post, x - 2, 90);
      p.set(x + 4, 92, PAL.iron[2]);
    }
    // luz quente das tochas esquentando a rocha, e o suporte de ferro
    for (const x of this.torches) {
      for (let y = 56; y < 96; y++) {
        for (let xx = x - 22; xx <= x + 22; xx++) {
          if (xx < 0 || xx >= w) continue;
          const d = Math.hypot((xx + 0.5 - x) / 22, (y + 0.5 - 73) / 17);
          if (d >= 1 || bayer(xx, y) >= (1 - d) * 1.3) continue;
          const i = y * w + xx, k = ROCK.indexOf(p.d[i]);
          if (k >= 0) p.d[i] = WARM_ROCK[Math.min(8, k + (d < 0.4 ? 1 : 0))];
        }
      }
      p.rect(x - 1, 74, 3, 1, PAL.iron[2]);
      p.rect(x, 73, 1, 4, PAL.wood[2]);
      p.set(x, 77, PAL.iron[1]);
    }
  }

  paintPile(p, cx, base, r, seed) {
    p.fill(cx - r - 1, base - r, cx + r + 1, base, (x, y) => y >= base - r * 0.8 + Math.abs(x + 0.5 - cx) * 0.75 + (hash(x, 0, seed) - 0.5) * 1.2, (x, y) =>
      oreChunk(x, y, seed, 3, 0.12));
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      for (let y = base - r; y <= base; y++) {
        if (p.get(x, y) === PAL.gold[5] || p.get(x, y) === PAL.gold[4]) this.glints.push([x, y]);
      }
    }
  }

  paintWheel(p, x, y, ang) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) p.set(x + dx, y + dy, PAL.iron[dx + dy < 0 ? 2 : 1]);
    for (const [dx, dy] of [[-2, -1], [-2, 0], [-2, 1], [2, -1], [2, 0], [2, 1], [-1, -2], [0, -2], [1, -2], [-1, 2], [0, 2], [1, 2]]) p.set(x + dx, y + dy, PAL.out);
    p.set(x, y, PAL.iron[3]);
    p.set(x + Math.round(Math.cos(ang)), y + Math.round(Math.sin(ang)), PAL.iron[4]);
  }

  // Nuvens só por trás das montanhas.
  paintClouds(p, t) {
    const w = this.w, d = p.d, sky = this.sky;
    for (const c of this.clouds) {
      const span = w + c.p.w + 20;
      const ox = Math.floor(((c.x0 + t * c.speed) % span) - c.p.w - 10);
      for (let y = 0; y < c.p.h; y++) {
        const ty = y + c.y;
        for (let x = 0; x < c.p.w; x++) {
          const col = c.p.d[y * c.p.w + x], tx = x + ox;
          if (col && tx >= 0 && tx < w && ty < sky[tx]) d[ty * w + tx] = col;
        }
      }
    }
  }

  paintFrame(p, t, info) {
    const w = this.w;
    // estrelas piscando e morcegos
    for (let i = 0; i < this.stars.length; i++) {
      const [x, y] = this.stars[i];
      if (Math.sin(t * (1.1 + (i % 5) * 0.3) + i * 1.7) > 0.7) p.set(x, y, SNOW[4]);
    }
    for (let k = 0; k < 3; k++) {
      const span = w + 60;
      const x = ((hash(k, 1, 40) * span + t * (7 + k * 2)) % span) - 30 + Math.sin(t * 1.3 + k) * 8;
      const y = 22 + k * 7 + Math.sin(t * 2.1 + k * 2) * 5 + Math.sin(t * 5.3 + k) * 1.5;
      paintBat(p, x, y, Math.sin(t * 15 + k * 2.1));
    }
    // ouro e cristais faiscando na rocha
    for (let k = 0; k < Math.min(6, this.glints.length); k++) {
      const n = Math.floor(t / 2.2 + k * 0.37);
      const g = this.glints[Math.floor(hash(k, n, 41) * this.glints.length)];
      paintGlint(p, g[0], g[1], pulse(t + k * 0.37 * 2.2, 2.2, 0.5) * 0.75);
    }
    // boca principal acesa por dentro
    this.paintMouth(p, this.main, this.mainAt[0], this.mainAt[1], t, 0);
    // minas extras
    const mines = Math.min(info.t2, this.mineSpots.length);
    for (let i = 0; i < mines; i++) {
      const s = this.mineSpots[i], m = this.mines[s.high ? 1 : 0];
      const ox = s.x - m.cx, oy = (s.high ? LEDGE : footAt(s.x) + 2) - m.bottom;
      p.blit(m.p, ox, oy);
      this.paintMouth(p, m, ox, oy, t, i + 1);
      // lanterna no esteio da direita
      const lx = ox + m.cx + 8, ly = oy + 13;
      p.set(lx, ly, PAL.iron[2]);
      p.set(lx, ly + 1, PAL.fire[Math.sin(t * 11 + i) > 0 ? 4 : 5]);
      p.set(lx, ly + 2, PAL.iron[1]);
    }
    // tochas do paredão
    for (const x of this.torches) this.paintTorch(p, x, 72, t);

    const shown = Math.min(info.t1, this.minerSpots.length);
    const men = this.minerSpots.slice(0, shown);
    const back = men.filter((m) => m.foot < RAIL).sort((a, b) => a.foot - b.foot);
    const front = men.filter((m) => m.foot >= RAIL).sort((a, b) => a.foot - b.foot);
    for (const m of back) this.paintMiner(p, m, t);
    // carrinhos andando pela linha; sem ninguém trabalhando, um fica parado na boca principal
    const span = w + 40;
    const n = info.t1 + info.t2 > 0 ? Math.min(this.maxCarts, 1 + info.t2) : 0;
    for (let k = 0; k < Math.max(1, n); k++) {
      const x = n ? ((t * 9 + (k * span) / n + 13) % span) - 20 : this.mainX + 20;
      p.blit(this.carts[k % 3], Math.floor(x), RAIL - 8);
      for (const dx of [4, 11]) this.paintWheel(p, Math.floor(x) + dx, RAIL + 2, (x + dx) / 2);
    }
    for (const m of front) this.paintMiner(p, m, t);
    for (const x of this.lamps) this.paintPostLantern(p, x + 4, 92, t);
  }

  // Lanterninha pendurada no poste do pátio: vidro aceso tremendo e um halo fraco.
  paintPostLantern(p, x, y, t) {
    const flick = Math.sin(t * 10.3 + x) * 0.5 + Math.sin(t * 6.1 + x * 0.7) * 0.5;
    const R = 6 + flick * 0.7;
    for (let yy = Math.floor(y + 3 - R); yy <= y + 3 + R; yy++) {
      for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
        const d = Math.sqrt((xx + 0.5 - x) ** 2 + (yy + 0.5 - y - 3) ** 2) / R;
        if (d < 1 && d > 0.4 && bayer(xx, yy) < (1 - d) * 0.3) p.set(xx, yy, PAL.fire[2]);
      }
    }
    p.set(x, y, PAL.out);
    p.rect(x - 1, y + 1, 3, 1, PAL.iron[2]);
    p.rect(x - 1, y + 2, 3, 3, (xx, yy) => PAL.fire[xx === x ? (flick > 0 ? 5 : 4) : yy === y + 2 ? 4 : 3]);
    p.rect(x - 1, y + 5, 3, 1, PAL.iron[1]);
    for (const yy of [y + 1, y + 2, y + 3, y + 4, y + 5]) { p.set(x - 2, yy, PAL.out); p.set(x + 2, yy, PAL.out); }
    p.rect(x - 1, y + 6, 3, 1, PAL.out);
  }

  // Luz da tocha de dentro da mina tremendo nos pixels da boca.
  paintMouth(p, m, ox, oy, t, seed) {
    const R = 7.5 + Math.sin(t * 9.3 + seed * 2) * 0.8 + Math.sin(t * 14.1 + seed) * 0.5;
    const w = this.w, d = p.d;
    for (const [x, y, dist] of m.pts) {
      const k = (1 - dist / R) * 1.4 - (bayer(x, y) - 0.5) * 0.4;
      if (k <= 0.05) continue;
      const tx = x + ox, ty = y + oy;
      if (tx < 0 || tx >= w || ty < 0 || ty >= SH) continue;
      d[ty * w + tx] = TUNNEL[Math.min(8, 2 + Math.floor(k * 5))];
    }
    const [tx, ty] = m.torch;
    p.set(tx + ox, ty + oy + 1, PAL.wood[2]);
    p.set(tx + ox, ty + oy, PAL.fire[5]);
    p.set(tx + ox, ty + oy - 1, PAL.fire[Math.sin(t * 12 + seed) > 0 ? 4 : 3]);
  }

  paintTorch(p, x, y, t) {
    const flick = Math.sin(t * 13 + x) * 0.5 + Math.sin(t * 7.3 + x * 0.3) * 0.5;
    const R = 7 + flick;
    for (let yy = Math.floor(y - R); yy <= y + R; yy++) {
      for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
        const d = Math.sqrt((xx + 0.5 - x) ** 2 + (yy + 0.5 - (y - 1)) ** 2) / R;
        if (d < 1 && bayer(xx, yy) < (1 - d) * 0.3) p.set(xx, yy, PAL.fire[d < 0.5 ? 3 : 2]);
      }
    }
    p.rect(x, y + 1, 1, 2, PAL.wood[1]);
    const h = 3 + Math.round(flick + hash(Math.floor(t * 10), x) * 1.2);
    for (let k = 0; k < h; k++) {
      const c = PAL.fire[k === 0 ? 5 : k < h - 1 ? 4 : 3];
      p.set(x + (k === h - 1 ? Math.round(Math.sin(t * 9 + x)) : 0), y - k, c);
      if (k < 2) {
        p.set(x - 1, y - k, PAL.fire[3]);
        p.set(x + 1, y - k, PAL.fire[3]);
      }
    }
  }

  // Mineiro pequeno, de perfil, com a picareta numa altura do golpe (0 = na pedra,
  // 1 = lá em cima). Fica guardado já contornado: são 64 alturas por direção.
  minerSprite(dir, step) {
    const key = (dir > 0 ? 0 : 64) + step;
    if (this.manCache[key]) return this.manCache[key];
    const m = new Pix(32, 30);
    const cx = 16, foot = 27;
    const X = (dx) => cx + dx * dir;
    const put = (dx, y, c) => m.set(cx + dx * dir, y, c);
    // botas e calça
    for (const [dx, k] of [[-2, 1], [-1, 1], [1, 2], [2, 2]]) for (let y = foot - 6; y < foot - 1; y++) put(dx, y, WOOL[k + (dx === 2 || dx === -1 ? 1 : 0)]);
    for (const dx of [-2, -1, 1, 2, 3]) put(dx, foot - 1, HIDE[dx === 3 ? 3 : 1]);
    // túnica clara, cinto com fivela e o couro de sentar nas costas
    for (let y = foot - 14; y <= foot - 7; y++) for (let dx = -2; dx <= 2; dx++) put(dx, y, PAL.linen[dx > 0 ? 3 : dx === -2 ? 1 : 2]);
    for (let dx = -2; dx <= 2; dx++) put(dx, foot - 8, HIDE[1]);
    put(1, foot - 8, PAL.gold[3]);
    for (let y = foot - 9; y <= foot - 5; y++) { put(-3, y, HIDE[2]); if (y > foot - 8) put(-2, y, HIDE[y === foot - 5 ? 1 : 3]); }
    // capinha de couro nos ombros e o capuz
    for (let dx = -3; dx <= 2; dx++) { put(dx, foot - 15, HIDE[dx < 0 ? 4 : 3]); put(dx, foot - 14, HIDE[dx < 0 ? 2 : 1]); }
    for (const [y, a, b] of [[foot - 21, -1, 1], [foot - 20, -2, 0], [foot - 19, -2, 0], [foot - 18, -2, 0], [foot - 17, -2, 1], [foot - 16, -2, 2]]) {
      for (let dx = a; dx <= b; dx++) put(dx, y, HIDE[y === foot - 21 || dx === a + 1 ? 4 : dx === a ? 2 : 3]);
    }
    put(-3, foot - 18, HIDE[2]); // ponta do capuz caindo atrás
    put(-3, foot - 17, HIDE[1]);
    // rosto de perfil, sujo de fuligem, e a lamparina na testa
    put(1, foot - 20, PAL.skin[3]); put(2, foot - 20, PAL.skin[4]);
    put(1, foot - 19, PAL.iris); put(2, foot - 19, PAL.skin[3]); put(3, foot - 19, PAL.skin[3]);
    put(1, foot - 18, GRIME[3]); put(2, foot - 18, PAL.hair[1]);
    put(2, foot - 21, PAL.gold[3]);
    // braços, cabo e a cabeça da picareta com as pontas curvando para o cabo
    const ang = 0.55 - (step / 63) * 2.6; // 0 = para a frente, negativo = para cima
    const ca = Math.cos(ang) * dir, sa = Math.sin(ang);
    const sx = X(0.5), sy = foot - 14;
    const hx = sx + ca * 4.5, hy = sy + sa * 4.5;
    m.line(X(-1), sy, hx - ca, hy - sa, PAL.linen[1]);
    m.line(hx - ca * 2.5, hy - sa * 2.5, hx + ca * 7, hy + sa * 7, PAL.wood[3]);
    m.line(sx, sy, hx, hy, PAL.linen[3]);
    m.set(hx, hy, PAL.skin[2]);
    const ex = hx + ca * 7, ey = hy + sa * 7;
    const qx = -Math.sin(ang) * dir, qy = Math.cos(ang);
    for (let k = -3; k <= 3; k++) {
      const bend = k * k * 0.16;
      m.set(ex + qx * k - ca * bend, ey + qy * k - sa * bend, PAL.steel[k < 0 ? 4 : k === 0 ? 2 : 3]);
    }
    m.outline(PAL.out);
    this.manCache[key] = m;
    return m;
  }

  paintMiner(p, spot, t) {
    const dir = spot.dir;
    const cx = 16, foot = 27;
    const ox = spot.x - cx, oy = spot.foot - foot;
    const bx = ox + cx + 9 * dir;
    // pedra na frente dele
    p.blit(this.boulders[spot.rock], bx - 7, oy + foot - 9);
    // picareta: sobe devagar e desce rápido
    const ph = (t * 1.25 + spot.phase) % 1;
    const up = ph < 0.72 ? ph / 0.72 : ph < 0.8 ? 1 - (ph - 0.72) / 0.08 : 0;
    p.blit(this.minerSprite(dir, Math.round(up * up * (3 - 2 * up) * 63)), ox, oy);
    // chama da lamparina
    const lx = ox + cx + 2 * dir, ly = oy + foot - 22;
    const flame = Math.sin(t * 11 + spot.phase * 9);
    p.set(lx, ly, PAL.fire[flame > -0.3 ? 5 : 4]);
    if (flame > 0) p.set(lx, ly - 1, PAL.fire[3]);
    // lascas e faíscas no golpe
    if (ph > 0.79 && ph < 0.99) {
      const age = (ph - 0.79) / 0.2;
      const by = oy + foot - 7;
      const n = Math.floor(t * 1.25 + spot.phase);
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (hash(k, 1, n) - 0.5) * 2.4;
        const r = age * (3 + hash(k, 2, n) * 6);
        const c = k < 3 ? PAL.fire[age < 0.5 ? 5 : 4] : k < 5 ? ROCK[6] : COPPER[4];
        p.set(bx + Math.cos(a) * r, by + Math.sin(a) * r + age * age * 5, c);
      }
    }
  }
}

ART.portraits.miner = paintMinerPortrait;
ART.portraits.mine = paintMinePortrait;
ART.locked.miner = ART.silhouette(buildMiner);
ART.locked.mine = ART.silhouette(() => {
  const p = buildMine(0);
  paintLantern(p, 0, 0, 0);
  return p;
});
Object.assign(ART.icons, { ore: iconOre, miner: iconMiner, mine: iconMine });
SCENES.register('mine', MineScene);
})();
