'use strict';
// Linha de produção: COMIDA, tiers 6 a 8.
// Feira (tier 6) produz aldeias, Vila (tier 7) produz feiras, Solar (tier 8) produz vilas.
// Aqui ficam os retratos, as silhuetas bloqueadas e os ícones desses três.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

// feira: toldos, bandeirinhas e mercadorias
const AWN_RED = ramp('#3e1014', '#6e1c20', '#a32c2c', '#cc4a3a', '#e8714f');
const AWN_BLUE = ramp('#141c3a', '#213566', '#30509a', '#4872bc', '#6f9cdc');
const CREAM = ramp('#6e5e4a', '#a39274', '#cebd98', '#ebdfbf', '#fbf3df');
const APPLE = ramp('#3a0a10', '#721a1e', '#a82a26', '#d44632', '#f2785a');
const CRUST = ramp('#3a1a0a', '#64300f', '#94501a', '#bc7428', '#dc9c44', '#f2c878');
const CHEESE = ramp('#5c3c0c', '#966814', '#c8982a', '#ecc24c', '#f8e08a', '#fff4c8');
const PUMPKIN = ramp('#4a1a08', '#80300e', '#ba5214', '#e27a22', '#f6a442', '#fcca72');
const BURLAP = ramp('#33251a', '#58422e', '#7e6446', '#a68a62', '#c8ae82', '#e2d0a6');
const WICKER = ramp('#33200e', '#5c3c18', '#866024', '#b08436', '#d4aa58', '#ecc87a');
const STRING = C('#3a2a22');
const SAUSAGE = ramp('#4a1a14', '#843424', '#b65438', '#da7e58');
const FLAGS = [AWN_RED, CREAM, AWN_BLUE, CHEESE, PAL.herb];
// vila e solar
const PLASTER = ramp('#5a4a48', '#8a7666', '#b6a088', '#d8c4a4', '#f0e2c4');
const SLATE = ramp('#1a1e2e', '#2a3046', '#3e4862', '#58647e', '#7c879e');
const BRONZE = ramp('#341e0a', '#663e14', '#9a6422', '#c89034', '#e8bc5a', '#fde69e');
const BROWN_ROOF = ramp('#3a2418', '#5a3420', '#7a4a2a', '#9a6236', '#b67c46');
const DARK = C('#140e12');
const GOLD_SKY = ramp('#6e5480', '#9c6684', '#c87c7a', '#e49a6c', '#f2b86a', '#fad488', '#fff0bc');
const GOLD_HILLS = ramp('#4a3450', '#644460', '#80586c', '#9e6e76', '#bc8a82');
const GOLD_GRASS = ramp('#1c2814', '#2c3e18', '#465a1e', '#687826', '#91962e', '#bcb44a');
const HEDGE = ramp('#0c1a12', '#16301e', '#224628', '#326032', '#4a7a38', '#6c9442');
const WARM_STONE = ramp('#36282c', '#584044', '#80605a', '#a6826e', '#c8a684', '#e6cca2');
const HERALD = ramp('#121a3c', '#1e2c66', '#2e4496', '#4862be');
const GLASS_A = C('#1d2130'), GLASS_B = C('#9a7a62');
const GLOW = ramp('#b8641e', '#e89a36', '#fcc85e', '#fff0b0');

const archTest = (cx, rx, top, bottom) => (x, y) =>
  y <= bottom && ((Math.abs(x - cx) <= rx && y >= top + rx) || ((x - cx) / rx) ** 2 + ((y - top - rx) / rx) ** 2 <= 1);

// Camada com contorno próprio, colada em p (separa peças que se sobrepõem).
function stamp(p, L) {
  L.outline(PAL.out);
  p.blit(L, 0, 0);
  L.clear();
}

// Pedras em fiadas: ajuste de luz por pixel, com juntas escuras e blocos de tons variados.
function masonry(x, y, x0, y0, bw, bh, seed) {
  const ry = (y - y0) % bh, row = Math.floor((y - y0) / bh);
  const off = (row % 2) * Math.floor(bw / 2);
  if (ry === bh - 1 || (x - x0 + off) % bw === 0) return -0.17;
  return (hash(Math.floor((x - x0 + off) / bw), row, seed) - 0.5) * 0.16 + (ry === 0 ? 0.07 : 0);
}

// Telhas em fiadas desencontradas, com sombra embaixo de cada fiada.
function tiles(x, y, y0, rh, tw) {
  const ry = (y - y0) % rh, row = Math.floor((y - y0) / rh);
  if (ry === rh - 1) return -0.2;
  if ((x + (row % 2) * Math.floor(tw / 2)) % tw === 0) return -0.1;
  return ry === 0 ? 0.06 : 0;
}

// Fumaça pontilhada subindo de (cx, cy), na escala do retrato.
function puffs(f, t, cx, cy, n, size, r0, seed = 0, speed = 0.24) {
  for (let k = 0; k < n; k++) {
    const s = (t * speed + k / n + seed * 0.37) % 1;
    const sx = cx + s * 9 * size + Math.sin(s * 6 + k + seed) * 1.1, sy = cy - s * 16 * size, r = (0.9 + s * 2.6) * size;
    for (let y = Math.floor(sy - r); y <= sy + r; y++) {
      for (let x = Math.floor(sx - r); x <= sx + r; x++) {
        const dd = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / r;
        if (dd <= 1 && bayer(x, y) < (1 - s) * 1.2 * (1.1 - dd * 0.5)) f.set(x, y, r0[dd < 0.5 && y < sy ? 4 : 2]);
      }
    }
  }
}

// Três pássaros cruzando o céu.
function paintBirds(f, t, y0, c) {
  const lead = ((t * 6.5) % 110) - 18;
  for (let i = 0; i < 3; i++) {
    const bx = Math.round(lead - i * 6);
    const by = Math.round(y0 + Math.sin(t * 0.8 + i) * 1.5 + i * 2 - (i === 1 ? 3 : 0));
    const up = Math.sin(t * 9 + i * 2.1) > 0;
    f.set(bx - 1, by, c); f.set(bx, by, c); f.set(bx + 1, by, c);
    f.set(bx - 2, by + (up ? -1 : 1), c);
    f.set(bx + 2, by + (up ? -1 : 1), c);
  }
}

// ---------------------------------------------------------------------------
// Feira

const STALLS = [
  { x0: 0, x1: 28, top: 15, front: 22, counter: 40, ground: 50, cloth: AWN_RED },
  { x0: 36, x1: 64, top: 15, front: 22, counter: 40, ground: 50, cloth: AWN_BLUE },
];
const STRIPES = 7;
const COIN = [14, 37];

function buildFairBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 44);
  paintSun(p, 9, 8, 3.5);
  // morros ao longe
  for (let x = 0; x < 64; x++) {
    const top = Math.round(37 + 1.5 * Math.sin(x * 0.15 + 1) + Math.sin(x * 0.5));
    for (let y = top; y < 44; y++) p.set(x, y, pick(PAL.far, (y === top ? 0.9 : 0.62) - (y - top) * 0.05, x, y));
  }
  // tendas de outros feirantes lá no fundo, listras saindo do bico
  for (const [x, c] of [[30, AWN_RED], [35.5, PAL.herb]]) {
    p.poly([[x - 3.6, 43], [x, 35.6], [x + 3.6, 43]], (xx, yy) => {
      const a = (xx + 0.5 - x) / Math.max(0.6, yy + 0.5 - 35.6);
      const lit = xx + 0.5 < x + 0.3;
      return Math.floor(a * 3 + 10) % 2 ? CREAM[lit ? 3 : 2] : c[lit ? 3 : 2];
    });
    p.rect(Math.floor(x), 41, 1, 2, PAL.wood[1]);
    p.set(Math.floor(x), 35, c[2]);
    p.set(Math.floor(x) + 1, 34, c[3]);
  }
  // praça calçada: pedras maiores perto de quem olha
  let y = 43, row = 0;
  while (y < 64) {
    const h = Math.max(1, Math.round(1 + (y - 43) * 0.12));
    const cw = h * 3;
    const off = (row % 2) * Math.round(cw / 2);
    for (let yy = y; yy < Math.min(64, y + h); yy++) {
      for (let x = 0; x < 64; x++) {
        const edge = (h > 1 && yy === y + h - 1) || (x + off) % cw === 0;
        const depth = (yy - 43) / 21;
        const v = edge ? 0.22 : 0.44 + depth * 0.14 + (hash(Math.floor((x + off) / cw), row, 5) - 0.5) * 0.16 + (yy === y && h > 1 ? 0.1 : 0);
        p.set(x, yy, pick(PAL.stone, v, x, yy, 3));
      }
    }
    y += h;
    row++;
  }
  // sombra embaixo das barracas e palha espalhada
  for (const s of STALLS) {
    for (let yy = s.ground; yy < s.ground + 3; yy++) {
      for (let x = s.x0; x < s.x1; x++) if (bayer(x, yy) < 0.75 - (yy - s.ground) * 0.25) p.set(x, yy, PAL.stone[0]);
    }
  }
  for (const [x, yy] of [[22, 55], [31, 58], [36, 52], [27, 61], [41, 62], [19, 60], [33, 48]]) {
    p.set(x, yy, PAL.straw[3]);
    p.set(x + 1, yy + 1, PAL.straw[2]);
  }
  return p;
}

// Limites do toldo na linha y: as listras correm do fundo (estreito) para a frente (largo).
function awnSpan(s, y) {
  const k = (y - s.top) / (s.front - s.top);
  return [s.x0 + 4 - 4 * k, s.x1 - 4 + 4 * k, k];
}

function paintAwning(p, s) {
  p.fill(s.x0, s.top, s.x1, s.front, (x, y) => {
    const [l, r] = awnSpan(s, y);
    return x >= l && x <= r;
  }, (x, y) => {
    const [l, r, k] = awnSpan(s, y + 0.5);
    const u = clamp01((x + 0.5 - l) / (r - l));
    const band = Math.min(STRIPES - 1, Math.floor(u * STRIPES));
    const f = u * STRIPES - band;
    let v = 0.72 - u * 0.34 - k * 0.1;
    if (y === s.top) v += 0.15;
    if (f > 0.76) v -= 0.1; // dobra entre as listras
    return pick(band % 2 ? CREAM : s.cloth, v, x, y, 3);
  });
}

// Babado recortado na frente do toldo: um gomo por listra, que ondula com o vento.
function paintValance(p, s, t, amp) {
  const w = s.x1 - s.x0;
  const band = (i) => Math.min(STRIPES - 1, Math.floor(((i + 0.5) / (w + 1)) * STRIPES));
  const d = new Int8Array(w + 3);
  for (let i = 0; i <= w; i++) {
    const f = (((i + 0.5) / (w + 1)) * STRIPES) % 1;
    const drop = Math.sin(t * 2.2 - band(i) * 1.05 - s.x0 * 0.1) * amp > 0.5 ? 1 : 0;
    d[i + 1] = (f > 0.24 && f < 0.76 ? 4 : 2) + drop;
  }
  for (let i = -1; i <= w + 1; i++) {
    const x = s.x0 + i, di = d[i + 1];
    if (di) {
      const u = (i + 0.5) / (w + 1);
      const cloth = band(i) % 2 ? CREAM : s.cloth;
      for (let j = 0; j < di; j++) {
        const y = s.front + 1 + j;
        p.set(x, y, pick(cloth, 0.62 - u * 0.3 - (j === di - 1 ? 0.2 : 0) - (j === 0 ? 0.1 : 0), x, y, 3));
      }
    }
    const nb = Math.max(i >= 0 ? d[i] : 0, i <= w ? d[i + 2] : 0);
    for (let j = di; j <= Math.max(di, nb - 1); j++) p.set(x, s.front + 1 + j, PAL.out);
  }
}

function drawBread(g) {
  const loaf = (cx, cy, rx, ry, cuts) => {
    g.ellipse(cx, cy, rx, ry, (x, y) => pick(CRUST, 0.08 + sphereLight((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) * 1.02, x, y));
    for (const [x, y] of cuts) {
      g.set(x, y, CRUST[5]);
      g.set(x + 1, y, CRUST[4]);
      g.set(x + 1, y + 1, CRUST[1]);
    }
  };
  loaf(7, 37.6, 4.4, 2.3, [[4, 37], [7, 36]]);
  loaf(5.5, 34.4, 3.4, 1.9, [[4, 33]]);
  loaf(11.6, 37, 2.7, 2.7, [[10, 35]]);
}

// Roda de queijo vista um pouco de cima: face clara em cima, casca dos lados.
function cheeseWheel(g, cx, top, rx, h) {
  const ry = 1.5;
  const onTop = (x, y) => ((x - cx) / rx) ** 2 + ((y - top) / ry) ** 2 <= 1;
  g.fill(cx - rx, top - ry, cx + rx, top + h + ry, (x, y) => Math.abs(x - cx) <= rx &&
    ((y >= top && y <= top + h) || ((x - cx) / rx) ** 2 + ((y - top - h) / ry) ** 2 <= 1 || onTop(x, y)),
  (x, y) => {
    const nx = (x + 0.5 - cx) / rx;
    if (onTop(x + 0.5, y + 0.5)) return pick(CHEESE, 0.86 - nx * 0.2, x, y, 3);
    return pick(CHEESE, 0.12 + cylLight(nx) * 0.7, x, y, 3);
  });
}

// Roda grande com uma cunha cortada mostrando o miolo com furos.
function drawCheese(g) {
  cheeseWheel(g, 21.5, 34.6, 4.6, 3.6);
  g.poly([[21.5, 34.6], [25.1, 35.9], [25.1, 39.5], [21.5, 38.4]], (x, y) => CHEESE[x === 21 || y === 35 ? 5 : 4]);
  for (const [x, y] of [[23, 37], [24, 38], [22, 36]]) g.set(x, y, CHEESE[2]);
}

function drawPumpkin(g, cx, cy, rx, ry) {
  g.ellipse(cx, cy, rx, ry, (x, y) => {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    let v = 0.1 + sphereLight(nx, ny) * 1.05;
    const lon = Math.asin(Math.max(-0.999, Math.min(0.999, nx / Math.sqrt(Math.max(0.05, 1 - ny * ny))))) / (Math.PI / 2);
    const seg = (lon * 2.2 + 10.5) % 1;
    if (seg < 0.16 || seg > 0.9) v -= 0.24;
    return pick(PUMPKIN, v, x, y);
  });
  const sx = Math.round(cx - 0.5), sy = Math.round(cy - ry);
  g.set(sx, sy, PAL.herb[1]);
  g.set(sx, sy - 1, PAL.herb[2]);
  g.set(sx + 1, sy - 2, PAL.herb[3]);
}

// Maçãs empilhadas: cada uma com um aro escuro, para não virarem uma massa só.
function drawApples(g, pile) {
  for (const [ax, ay, green] of pile) {
    const R = green ? PAL.herb : APPLE;
    g.ellipse(ax, ay, 2.1, 2, R[0]);
    g.sphere(ax, ay, 1.6, 1.5, R, green ? 0.2 : 0.12);
    g.set(ax - 0.6, ay - 0.6, R[R.length - 1]);
  }
  for (const [ax, ay] of pile.slice(-3)) g.set(ax + 0.4, ay - 1.6, PAL.wood[1]);
  const [lx, ly] = pile[pile.length - 1];
  g.set(lx + 1.4, ly - 1.8, PAL.herb[4]);
}

// Cesto de vime: fiadas horizontais, varetas e borda clara.
function drawBasket(g, cx, rim, rx, h) {
  g.fill(cx - rx, rim, cx + rx, rim + h, (x, y) => Math.abs(x + 0.5 - cx) <= rx - (y - rim) * 0.35, (x, y) => {
    const nx = (x + 0.5 - cx) / rx;
    const r = y - rim;
    let v = 0.2 + cylLight(nx) * 0.7;
    v += r % 2 ? -0.1 : 0.06;
    if ((x + Math.floor(r / 2)) % 3 === 0 && r % 2) v -= 0.12;
    return pick(WICKER, v, x, y, 3);
  });
  for (let x = Math.ceil(cx - rx - 0.5); x <= cx + rx - 0.5; x++) {
    g.set(x, rim, WICKER[x < cx - 1 ? 5 : 4]);
    g.set(x, rim + 1, WICKER[x < cx - 1 ? 3 : 2]);
  }
}

function drawSack(g, cx, bottom, hw, h, open) {
  const top = bottom - h;
  const width = (y) => {
    const k = (y - top) / h;
    if (!open && k < 0.22) return hw * (k < 0.1 ? 0.5 : 0.32);
    let w = hw * (0.8 + 0.2 * Math.sin(Math.min(1, k) * Math.PI * 0.9));
    if (k > 0.84) w *= 0.5 + 0.5 * Math.sqrt(Math.max(0, 1 - ((k - 0.84) / 0.16) ** 2));
    return w;
  };
  g.fill(cx - hw - 1, top, cx + hw + 1, bottom, (x, y) => Math.abs(x - cx) <= width(y), (x, y) => {
    const w = Math.max(1, width(y + 0.5));
    let v = 0.14 + cylLight((x + 0.5 - cx) / w) * 0.78;
    if ((x + y) % 2 === 0) v -= 0.05;
    return pick(BURLAP, v, x, y, 3);
  });
  if (open) {
    // boca dobrada para fora, trigo à mostra e espigas espetadas
    const my = top + 1;
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
      if (Math.abs(x + 0.5 - cx) > hw * 0.95) continue;
      g.set(x, my, BURLAP[x < cx ? 5 : 4]);
      g.set(x, my + 1, BURLAP[2]);
    }
    for (const [dx, h2, lean] of [[-1.2, 6, -1], [1.4, 7, 1], [0, 4, 0]]) {
      const x = Math.round(cx + dx), tx = x + lean;
      g.line(x, my - 1, tx, top - h2 + 3, PAL.wheat[2]);
      g.set(tx, top - h2 + 2, PAL.wheat[4]);
      g.set(tx, top - h2 + 1, PAL.wheat[5]);
      g.set(tx - 1, top - h2 + 2, PAL.wheat[3]);
      g.set(tx + 1, top - h2 + 3, PAL.wheat[3]);
    }
    g.ellipse(cx, my - 0.6, hw * 0.75, 1.5, (x, y) => PAL.wheat[(x * 3 + y) % 4 === 0 ? 2 : x < cx ? 5 : 4]);
  } else {
    // amarrado com corda, a ponta do pano para cima
    const ny = top + Math.round(h * 0.2);
    g.rect(Math.round(cx - hw * 0.45), ny, Math.round(hw * 0.9) + 1, 1, (x) => PAL.straw[x < cx ? 4 : 2]);
    g.set(Math.round(cx + hw * 0.5), ny + 1, PAL.straw[2]);
    g.set(Math.round(cx + hw * 0.5), ny + 2, PAL.straw[3]);
  }
  // marca de espiga pintada no saco
  const my = Math.round(top + h * 0.58), mx = Math.round(cx - 0.5);
  for (const [dx, dy] of [[0, -1], [0, 0], [0, 1], [0, 2], [-1, 0], [1, 1]]) g.set(mx + dx, my + dy, BURLAP[1]);
}

function buildFair() {
  const p = new Pix(64, 64);
  const L = new Pix(64, 64);
  // mastros das pontas, que seguram o varal de bandeirinhas
  for (const x of [1, 62]) {
    p.rect(x, 3, 2, 47, (xx) => PAL.wood[xx === x ? 3 : 1]);
    p.sphere(x + 1, 2.5, 1.6, 1.6, PAL.gold, 0.1);
  }
  for (const s of STALLS) {
    // fundo da barraca: tábuas na sombra do toldo
    p.rect(s.x0 + 3, s.front, s.x1 - s.x0 - 5, s.counter - s.front, (x, y) => {
      let v = 0.1 + ((y - s.front) / (s.counter - s.front)) * 0.32 + (hash(Math.floor((x - s.x0) / 3), 0, 3) - 0.5) * 0.08;
      if ((x - s.x0) % 3 === 0) v -= 0.14;
      return pick(PAL.wood, v, x, y, 3);
    });
    paintAwning(p, s);
    // bancada: tampo claro, frente de tábuas com travessa
    p.rect(s.x0 + 1, s.counter, s.x1 - s.x0 - 1, 2, (x, y) => pick(PAL.wood, (y === s.counter ? 0.9 : 0.62) - (x - s.x0) * 0.008, x, y, 3));
    p.rect(s.x0 + 1, s.counter + 2, s.x1 - s.x0 - 1, s.ground - s.counter - 2, (x, y) => {
      const r = y - s.counter - 2;
      let v = 0.56 - (x - s.x0) * 0.008 + (hash(Math.floor((x - s.x0 + 2) / 4), 1, 4) - 0.5) * 0.1;
      if ((x - s.x0 + 2) % 4 === 0) v -= 0.2;
      if (r === 0) v -= 0.28;
      if (r === 4) v += 0.12;
      if (r === 5) v -= 0.16;
      return pick(PAL.wood, v, x, y, 3);
    });
    // esteios
    for (const x of [s.x0 + 1, s.x1 - 2]) p.rect(x, s.front + 1, 2, s.ground - s.front - 1, (xx) => PAL.wood[xx === x ? 3 : 1]);
  }
  // pendurados: trança de alho na barraca vermelha, linguiças na azul
  L.line(15, 27, 15, 32, PAL.straw[1]);
  for (const [dx, y] of [[-1, 28], [1, 29], [-1, 30], [1, 31], [0, 33]]) {
    L.set(15 + dx, y, CREAM[4]);
    L.set(15 + dx + (dx < 0 ? 1 : 0), y + 1, CREAM[1]);
  }
  for (let x = 40; x <= 60; x++) {
    const y = 28 + Math.round(Math.sin(((x - 40) / 10) * Math.PI) ** 2 * 2);
    const k = (x - 40) % 3;
    if (k === 2) { // nó do barbante entre os gomos
      L.set(x, y, PAL.straw[1]);
      continue;
    }
    L.set(x, y, SAUSAGE[k === 0 ? 3 : 2]);
    L.set(x, y + 1, SAUSAGE[k === 0 ? 2 : 1]);
  }
  stamp(p, L);
  // mercadorias da barraca vermelha: pães, moedas e queijos
  drawBread(L);
  for (const [x, y, k] of [[14, 37, 5], [15, 37, 4], [13, 38, 3], [14, 38, 2], [15, 38, 1], [13, 39, 4], [14, 39, 3], [15, 39, 2], [16, 39, 1]]) L.set(x, y, PAL.gold[k]);
  drawCheese(L);
  stamp(p, L);
  cheeseWheel(L, 19.4, 32, 2.8, 1.4);
  stamp(p, L);
  // barraca azul: abóboras e um cesto de maçãs
  drawPumpkin(L, 44, 36.2, 4.8, 3.5);
  drawPumpkin(L, 51.6, 37.2, 3.6, 2.6);
  drawApples(L, [[56.6, 36.4], [59.6, 36.4], [58.1, 34.6, true]]);
  drawBasket(L, 58, 37, 3.8, 3);
  stamp(p, L);
  // no chão: cesto grande de maçãs e sacos de trigo
  drawApples(L, [[7.5, 51.8], [12.5, 51.6], [10, 49.6, true], [5.6, 53.4], [9, 53.2], [12.4, 53.3], [15.6, 53.5]]);
  drawBasket(L, 10.5, 54, 7, 6);
  stamp(p, L);
  drawSack(L, 47, 60, 4.2, 10, true);
  stamp(p, L);
  drawSack(L, 55.5, 62, 4.6, 11, false);
  stamp(p, L);
  p.outline(PAL.out);
  return p;
}

// Varal de bandeirinhas entre os mastros; cada uma tremula no seu ritmo.
function paintBunting(f, t, working) {
  const amp = working ? 1.5 : 0.9, spd = working ? 4.4 : 2.6;
  const sag = 6.5 + Math.sin(t * 0.9) * 0.4;
  const yAt = (x) => 3.5 + Math.sin(clamp01((x - 2) / 60) * Math.PI) * sag;
  for (let x = 3; x < 62; x++) f.set(x, yAt(x + 0.5), STRING);
  let i = 0;
  for (let fx = 6.5; fx < 60; fx += 5.6, i++) {
    const R = FLAGS[i % FLAGS.length];
    const y0 = Math.floor(yAt(fx)) + 1;
    const ph = t * spd + i * 1.37;
    for (let j = 0; j < 5; j++) {
      const k = j / 4;
      const cx = fx + (Math.sin(ph - j * 0.5) * amp + 0.4) * k;
      const hw = 2.5 * (1 - j / 5);
      const lit = Math.cos(ph - j * 0.5) * 0.4;
      for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
        if (Math.abs(x + 0.5 - cx) > hw) continue;
        f.set(x, y0 + j, R[Math.max(0, Math.min(R.length - 1, Math.round((x + 0.5 < cx ? 3 : 2) + lit - (j === 4 ? 1 : 0))))]);
      }
    }
  }
}

// Brilho na pilha de moedas do balcão.
function paintCoinGlint(f, t, working) {
  const ph = (t * (working ? 0.75 : 0.4)) % 1;
  if (ph > 0.32) return;
  const s = Math.sin((ph / 0.32) * Math.PI);
  const [cx, cy] = COIN;
  f.set(cx, cy, C('#ffffff'));
  const len = s > 0.75 ? 2 : s > 0.3 ? 1 : 0;
  for (let k = 1; k <= len; k++) {
    const c = k === len ? PAL.gold[5] : C('#fffbe8');
    f.set(cx - k, cy, c); f.set(cx + k, cy, c); f.set(cx, cy - k, c); f.set(cx, cy + k, c);
  }
}

const fairArt = { bg: null, body: null, clouds: null, frame: new Pix(64, 64) };

function paintFairPortrait(ctx, t, info) {
  const a = fairArt;
  if (!a.bg) {
    a.bg = buildFairBackdrop();
    a.body = buildFair();
    a.clouds = [makeCloud(20, 8, 11), makeCloud(14, 7, 5)];
  }
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 1.6) % 100) - 22), 4);
  f.blit(a.clouds[1], Math.floor(((t * 1.1 + 40) % 90) - 16), 25);
  f.blit(a.body, 0, 0);
  for (const s of STALLS) paintValance(f, s, t, info.working ? 1 : 0.7);
  paintBunting(f, t, info.working);
  paintCoinGlint(f, t, info.working);
  f.draw(ctx);
}

function buildFairLocked() {
  const p = buildFair();
  for (const s of STALLS) paintValance(p, s, 0, 0);
  paintBunting(p, 0, false);
  return p;
}

// ---------------------------------------------------------------------------
// Vila

const BELL = { px: 51.5, py: 16.4 };
const TOWN_CHIMNEYS = [[11, 11], [61, 12]];

function buildTownBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 38);
  paintSun(p, 9, 8, 4);
  // serra azulada
  for (let x = 0; x < 64; x++) {
    const top = Math.round(24 + 2.5 * Math.sin(x * 0.12 + 2) + 1.2 * Math.sin(x * 0.37));
    for (let y = top; y < 38; y++) p.set(x, y, pick(PAL.far, (y === top ? 0.92 : 0.6) - (y - top) * 0.04, x, y));
  }
  // bosque na encosta
  for (let x = 0; x < 64; x++) {
    const top = Math.round(30 + 1.6 * Math.sin(x * 0.5) + 1.2 * Math.sin(x * 1.3 + 1));
    for (let y = top; y < 40; y++) p.set(x, y, pick(PAL.tree, 0.6 - (y - top) * 0.1 + (hash(x, y, 2) - 0.5) * 0.3, x, y));
  }
  // campo, com a sombra da muralha no pé
  for (let y = 38; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.48 + (y - 38) * 0.012 + (hash(x, y, 4) - 0.5) * 0.16;
      if ((x * 3 + y * 5) % 11 === 0) v += 0.14;
      if (y < 59) v -= (59 - y) * 0.09;
      p.set(x, y, pick(PAL.grass, v, x, y, 2));
    }
  }
  // estrada de terra saindo do portão, com sulcos de roda
  p.poly([[26, 56], [38, 56], [49, 64], [15, 64]], (x, y) => {
    const rut = Math.abs(Math.abs(x + 0.5 - 32) - (2.5 + (y - 56) * 0.6)) < 0.6;
    return pick(PAL.dirt, 0.62 - (y < 58 ? 0.2 : 0) + (hash(x, y, 6) - 0.5) * 0.2 - (rut ? 0.24 : 0), x, y, 3);
  });
  // tufos e flores no capim
  for (const [x, y] of [[4, 60], [9, 62], [20, 59], [45, 61], [54, 59], [60, 62]]) {
    p.set(x, y, PAL.grass[5]); p.set(x + 1, y - 1, PAL.grass[4]); p.set(x - 1, y - 1, PAL.grass[4]);
  }
  for (const [x, y, c] of [[6, 59, '#f4e9d0'], [12, 61, '#e0644c'], [52, 60, '#f3d47c'], [58, 62, '#f4e9d0'], [2, 62, '#f3d47c'], [61, 58, '#e0644c']]) p.set(x, y, C(c));
  return p;
}

// Casa de enxaimel com a empena para frente; a base fica escondida atrás da muralha.
function paintHouse(L, x0, x1, eave, apex, roofR, seed, opts = {}) {
  const cx = (x0 + x1 + 1) / 2;
  const base = 40;
  L.rect(x0, eave, x1 - x0 + 1, base - eave, (x, y) => pick(PLASTER, 0.8 - (x - x0) * 0.025 + (hash(x, y, seed) - 0.5) * 0.08, x, y, 3));
  const beam = PAL.wood[1];
  for (const x of [x0, Math.round(cx - 0.5), x1]) L.rect(x, eave, 1, base - eave, beam);
  for (const y of [eave, eave + 6]) L.rect(x0, y, x1 - x0 + 1, 1, beam);
  L.line(x0 + 1, eave + 5, Math.round(cx - 0.5) - 1, eave + 1, PAL.wood[2]);
  L.line(x1 - 1, eave + 5, Math.round(cx - 0.5) + 1, eave + 1, PAL.wood[1]);
  // janelas com postigos
  for (const [wx, wy] of opts.windows || []) {
    L.rect(wx, wy, 2, 3, (x, y) => (x === wx && y === wy ? PAL.glassHi : PAL.glass));
    L.rect(wx - 1, wy, 1, 3, (opts.shutter || PAL.herb)[2]);
    L.rect(wx + 2, wy, 1, 3, (opts.shutter || PAL.herb)[1]);
    L.rect(wx - 1, wy + 3, 4, 1, PAL.wood[3]);
  }
  // telhado alto de telhas
  L.poly([[x0 - 1.5, eave + 0.5], [cx, apex], [x1 + 2.5, eave + 0.5]], (x, y) =>
    pick(roofR, 0.66 - ((x + 0.5 - cx) / (x1 - x0 + 4)) * 0.7 + tiles(x, y, apex, 2, 4), x, y, 3));
  if (opts.chimney) {
    const [hx, hy] = opts.chimney;
    L.rect(hx - 1, hy, 3, 5, (x, y) => pick(PAL.stone, (x === hx - 1 ? 0.78 : 0.42) - (y % 2 ? 0.1 : 0), x, y, 3));
    L.rect(hx - 2, hy, 5, 1, PAL.stone[4]);
  }
}

function paintChurch(L) {
  const x0 = 46, x1 = 56, top = 13;
  L.rect(x0, top, x1 - x0 + 1, 40 - top, (x, y) => {
    let v = 0.64 - (x - x0) * 0.03 + masonry(x, y, x0, top, 4, 3, 9);
    if ((x <= x0 + 1 || x >= x1 - 1) && Math.floor((y - top) / 3) % 2 === 0) v += 0.14; // cunhais
    return pick(PAL.stone, v, x, y, 3);
  });
  // vão do sino com moldura clara, viga e peitoril
  L.fill(47, 14, 55, 23, archTest(51.5, 4, 14, 23), (x, y) => pick(PAL.stone, 0.9 - (x - 47) * 0.04, x, y, 3));
  L.fill(48, 15, 54, 22, archTest(51.5, 3, 15, 22), DARK);
  L.rect(48, 16, 7, 1, PAL.wood[1]);
  L.rect(47, 23, 9, 1, PAL.stone[5]);
  // seteira
  L.rect(51, 27, 1, 4, DARK);
  L.set(51, 26, PAL.stone[1]);
  // flecha de ardósia
  L.poly([[x0 - 1.5, top + 0.5], [51.5, 2], [x1 + 2.5, top + 0.5]], (x, y) =>
    pick(SLATE, 0.72 - ((x + 0.5 - 51.5) / 7) * 0.45 + tiles(x, y, 2, 2, 3), x, y, 3));
  L.rect(x0 - 1, top, x1 - x0 + 3, 1, SLATE[0]);
  L.set(51, 1, PAL.gold[4]);
  L.set(51, 0, PAL.gold[5]);
}

// Hera subindo pela muralha: um ramo sinuoso com tufos de folhas.
function paintIvy(L, x, y, n, seed) {
  for (let i = 0; i < n; i++) {
    const px = Math.round(x + Math.sin(i * 0.7 + seed) * 1.4), py = y - i;
    L.set(px, py, PAL.tree[1]);
    if (i % 2 === 0) {
      const s = i % 4 ? 1 : -1;
      L.set(px + s, py, PAL.tree[3]);
      L.set(px + s, py - 1, PAL.tree[4]);
      L.set(px + s * 2, py, PAL.tree[2]);
    }
  }
}

function buildTown() {
  const p = new Pix(64, 64);
  const L = new Pix(64, 64);
  // casas atrás da muralha, de trás para frente
  paintHouse(L, 26, 38, 21, 9, BROWN_ROOF, 3);
  stamp(p, L);
  paintHouse(L, 3, 14, 21, 7, PAL.roof, 5, { windows: [[5, 24], [10, 28]], chimney: TOWN_CHIMNEYS[0] });
  stamp(p, L);
  paintHouse(L, 39, 47, 25, 15, ramp('#3a1a1a', '#5e2a24', '#84402e', '#a85a3c', '#c47650'), 7, { windows: [[42, 28]] });
  stamp(p, L);
  paintChurch(L);
  stamp(p, L);
  paintHouse(L, -3, 6, 25, 15, SLATE, 2, { windows: [[1, 28]], shutter: PAL.banner });
  stamp(p, L);
  paintHouse(L, 13, 21, 24, 12, PAL.roof, 4, { windows: [[16, 27]], shutter: AWN_BLUE });
  stamp(p, L);
  paintHouse(L, 56, 66, 22, 11, BROWN_ROOF, 9, { windows: [[58, 26]], chimney: TOWN_CHIMNEYS[1], shutter: PAL.banner });
  stamp(p, L);

  // muralha com ameias
  L.fill(0, 33, 63, 56, (x, y) => y >= 36 || (x % 7) < 4, (x, y) => {
    let v = 0.52 + masonry(x, y, 0, 36, 6, 3, 3) - Math.max(0, y - 51) * 0.04;
    if (y < 36) v = 0.6 + (x % 7 === 0 ? 0.12 : 0) + (y === 33 ? 0.16 : 0);
    if (y === 36) v += 0.18;
    if (x >= 44 && x <= 46 && y > 33) v -= 0.3; // sombra da torre do portão
    return pick(PAL.stone, v, x, y, 3);
  });
  for (const x of [8, 15, 52, 58]) {
    L.rect(x, 41, 1, 4, DARK);
    L.set(x, 40, PAL.stone[1]);
  }
  paintIvy(L, 4, 55, 14, 0);
  paintIvy(L, 11, 55, 8, 2);
  paintIvy(L, 60, 55, 10, 1);
  stamp(p, L);

  // torre do portão
  L.fill(21, 18, 43, 56, (x, y) => y >= 21 || (x - 21) % 5 < 3, (x, y) => {
    let v = 0.64 - (x - 21) * 0.006 + masonry(x, y, 21, 24, 6, 4, 8);
    if (y < 21) v = 0.68 + (y === 18 ? 0.16 : 0) - ((x - 21) % 5 === 2 ? 0.12 : 0);
    if (y === 21) v = 0.86;
    if (y === 22 || y === 23) v = (x - 21) % 3 === 0 ? 0.3 : 0.08; // mísulas do balcão
    if (x === 21 && y > 21) v += 0.1;
    return pick(PAL.stone, v, x, y, 3);
  });
  // varão do estandarte
  L.rect(26, 25, 13, 1, PAL.iron[2]);
  L.set(25, 25, PAL.iron[3]);
  L.set(39, 25, PAL.iron[1]);
  // arco de aduelas
  L.fill(24, 37, 40, 56, archTest(32, 8, 37.5, 56), (x, y) => {
    const a = Math.atan2(y + 0.5 - 45.5, x + 0.5 - 32);
    const joint = Math.abs(((a / Math.PI) * 9 + 20) % 1 - 0.5) > 0.4;
    return pick(PAL.stone, 0.84 - (x - 24) * 0.02 - (joint && y < 46 ? 0.25 : 0), x, y, 3);
  });
  // passagem: túnel escuro e a rua iluminada lá no fundo
  L.fill(26, 39, 38, 56, archTest(32, 6, 39.5, 56), (x, y) => {
    const dx = Math.abs(x + 0.5 - 32);
    if (dx <= 3 && y >= 45 && y < 53) {
      if (y < 50) return x === 33 && y >= 47 ? PAL.wood[1] : y === 45 ? PAL.wood[1] : pick(PLASTER, 0.82 - dx * 0.06, x, y, 3);
      return pick(PAL.stone, 0.72 - (y - 50) * 0.06, x, y, 3);
    }
    if (y >= 53 && dx <= 3 + (y - 53) * 0.9) return pick(PAL.cobble, 0.62 - (y - 53) * 0.12, x, y, 3);
    return pick(PAL.cobble, 0.04 + (y - 39) * 0.008, x, y, 3);
  });
  // grade levadiça meio erguida
  L.fill(26, 39, 38, 49, archTest(32, 6, 39.5, 49), (x, y) => {
    if ((x - 27) % 2 === 0 && x >= 27 && x <= 37) return PAL.iron[y === 49 ? 3 : 2];
    if (y === 42 || y === 45 || y === 48) return PAL.iron[3];
    return 0;
  });
  for (let x = 27; x <= 37; x += 2) L.set(x, 50, PAL.iron[1]);
  stamp(p, L);
  p.outline(PAL.out);
  return p;
}

// Sino balançando dentro do vão (só aparece onde o vão é escuro).
function paintBell(f, body, t, working) {
  const a = Math.sin(t * (working ? 3.4 : 1.7)) * (working ? 0.38 : 0.14);
  const ca = Math.cos(a), sa = Math.sin(a);
  for (let y = 16; y <= 22; y++) {
    for (let x = 48; x <= 54; x++) {
      if (body.get(x, y) !== DARK) continue;
      const dx = x + 0.5 - BELL.px, dy = y + 0.5 - BELL.py;
      const v = dx * sa + dy * ca, u = dx * ca - dy * sa;
      if (v < 0.2 || v > 5.4) continue;
      const w = (v < 1 ? 0.75 : 0.6 + v * 0.28) + (v > 4.5 ? 0.45 : 0);
      if (Math.abs(u) > w) continue;
      f.set(x, y, pick(BRONZE, 0.18 + cylLight(u / w) * 0.85 - (v > 4.5 ? 0.18 : 0), x, y));
    }
  }
  const b = a * 0.45;
  const cx = BELL.px + Math.sin(b) * 5.7, cy = BELL.py + Math.cos(b) * 5.7;
  if (body.get(Math.floor(cx), Math.floor(cy)) === DARK) f.set(cx, cy, PAL.iron[1]);
}

// Estandarte vermelho com espiga dourada, pendurado no portão.
const bannerPix = new Pix(16, 16);
function paintTownBanner(f, t, working) {
  const b = bannerPix.clear();
  const spd = working ? 3.4 : 2, amp = working ? 1 : 0.55;
  const len = 9, hw = 4, cx = 8;
  const emblem = [[0, 1, 5], [0, 2, 4], [-1, 2, 3], [1, 2, 3], [0, 3, 4], [-1, 4, 3], [1, 4, 3], [0, 4, 4], [0, 5, 3], [0, 6, 2]];
  for (let j = 0; j < len; j++) {
    const k = j / (len - 1);
    const ph = t * spd - j * 0.6;
    const dx = Math.round((Math.sin(ph) * amp + Math.sin(t * 0.7) * 0.4) * k);
    const lit = Math.cos(ph) * 0.2 * k;
    for (let i = -hw; i <= hw; i++) {
      if (j > len - 4 && Math.abs(i) < j - (len - 4)) continue; // ponta em rabo de andorinha
      const v = (Math.abs(i) === hw ? 0.15 : i < 0 ? 0.85 : 0.6) + lit;
      b.set(cx + i + dx, 1 + j, pick(PAL.banner, v, i + 8, j, 3));
    }
    for (const [i, jj, g] of emblem) if (jj === j) b.set(cx + i + dx, 1 + j, PAL.gold[g]);
  }
  b.outline(PAL.out);
  f.blit(b, 24, 25);
}

const townArt = { bg: null, body: null, clouds: null, frame: new Pix(64, 64) };

function paintTownPortrait(ctx, t, info) {
  const a = townArt;
  if (!a.bg) {
    a.bg = buildTownBackdrop();
    a.body = buildTown();
    a.clouds = [makeCloud(22, 9, 7), makeCloud(15, 7, 21)];
  }
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 1.4 + 30) % 100) - 24), 3);
  f.blit(a.clouds[1], Math.floor(((t * 1.0) % 90) - 16), 14);
  paintBirds(f, t, 10, C('#2b2a38'));
  f.blit(a.body, 0, 0);
  const w = info.working;
  TOWN_CHIMNEYS.forEach(([x, y], i) => puffs(f, t, x, y - 1, w ? 6 : 4, w ? 0.75 : 0.6, PAL.cloud, i, w ? 0.3 : 0.2));
  paintBell(f, a.body, t, w);
  paintTownBanner(f, t, w);
  f.draw(ctx);
}

function buildTownLocked() {
  const p = buildTown();
  paintTownBanner(p, 0, false);
  return p;
}

// ---------------------------------------------------------------------------
// Solar

const TOWER = { cx: 54.5, r: 6.5, top: 20, apex: 6 };
const FX = 19; // centro da fonte

function buildManorBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 48, GOLD_SKY, 1.8);
  paintSun(p, 6, 38, 5);
  // morros ao longe, mais claros perto do sol
  for (let x = 0; x < 64; x++) {
    const top = Math.round(41 + 1.6 * Math.sin(x * 0.1 + 0.5) + Math.sin(x * 0.33));
    for (let y = top; y < 48; y++) p.set(x, y, pick(GOLD_HILLS, (y === top ? 0.85 : 0.55) - (y - top) * 0.05 - x * 0.004, x, y));
  }
  // gramado dourado
  for (let y = 46; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.62 + (y - 46) * 0.008 - x * 0.004 + (hash(x, y, 4) - 0.5) * 0.14;
      if ((x * 5 + y * 3) % 13 === 0) v += 0.14;
      p.set(x, y, pick(GOLD_GRASS, v, x, y, 2));
    }
  }
  // caminho de cascalho da porta até a borda, e cascalho em volta da fonte
  const gravel = (x, y) => pick(PAL.sail, 0.5 + (y - 54) * 0.015 + (hash(x, y, 7) - 0.5) * 0.3, x, y, 2);
  p.poly([[28, 52], [37, 52], [41, 64], [24, 64]], gravel);
  p.ellipse(FX + 0.5, 59, 14, 4.5, gravel);
  // sombras compridas das sebes, puxadas para a direita
  for (let y = 57; y < 60; y++) {
    for (let x = 40; x < 64; x++) if (bayer(x, y) < 0.6 - (y - 57) * 0.2) p.set(x, y, GOLD_GRASS[1]);
  }
  return p;
}

function buildManor() {
  const p = new Pix(64, 64);
  const L = new Pix(64, 64);
  // chaminé
  L.rect(18, 4, 4, 11, (x, y) => pick(WARM_STONE, (x === 18 ? 0.8 : 0.48) + masonry(x, y, 18, 4, 4, 2, 5) * 0.6, x, y, 3));
  L.rect(17, 3, 6, 2, (x, y) => WARM_STONE[y === 3 ? 5 : 3]);
  stamp(p, L);
  // telhado de quatro águas
  L.poly([[9.5, 24.5], [18, 10], [47, 10], [53.5, 24.5]], (x, y) => {
    let v = 0.7 - ((x - 10) / 44) * 0.4 + (y - 10) * 0.006 + tiles(x, y, 11, 3, 4);
    if (x + 0.5 < 18 - (y - 10) * 0.25 + 2) v -= 0.14; // água lateral, mais escura
    return pick(PAL.roof, v, x, y, 3);
  });
  L.rect(18, 10, 29, 1, PAL.roof[4]);
  // lucarna com janela no meio do telhado
  L.rect(28, 15, 9, 9, (x, y) => pick(PLASTER, 0.84 - (x - 28) * 0.03, x, y, 3));
  for (const x of [28, 36]) L.rect(x, 15, 1, 9, PAL.wood[1]);
  L.fill(30, 16, 34, 22, archTest(32.5, 2, 16.5, 21), GLASS_A);
  L.set(31, 18, GLASS_B);
  L.rect(32, 17, 1, 5, PAL.wood[2]);
  L.poly([[26, 16.5], [32.5, 8], [39, 16.5]], (x, y) => pick(PAL.roof, 0.72 - (x - 26) * 0.035 + tiles(x, y, 9, 3, 4), x, y, 3));
  stamp(p, L);
  // andar de cima em enxaimel, um pouco saliente
  L.rect(11, 24, 40, 12, (x, y) => pick(PLASTER, 0.84 - (x - 11) * 0.008 + (hash(x, y, 13) - 0.5) * 0.06 + (y === 25 ? -0.2 : 0), x, y, 3));
  const beam = PAL.wood[1];
  for (const x of [11, 19, 26, 39, 46, 50]) L.rect(x, 24, 1, 12, beam);
  L.rect(11, 24, 40, 1, beam);
  L.rect(11, 35, 40, 1, beam);
  for (const [a, b] of [[19, 26], [39, 46]]) {
    L.line(a + 1, 34, b - 1, 25, PAL.wood[1]);
    L.line(a + 1, 25, b - 1, 34, PAL.wood[2]);
  }
  // janelas do andar de cima
  for (const wx of [13, 41]) {
    L.rect(wx, 27, 5, 6, PAL.wood[2]);
    L.rect(wx + 1, 28, 3, 4, GLASS_A);
    L.set(wx + 1, 28, GLASS_B);
    L.rect(wx + 2, 28, 1, 4, PAL.wood[3]);
    L.rect(wx - 1, 33, 7, 1, PAL.wood[3]);
  }
  // térreo de pedra, com a sombra do andar saliente
  L.rect(12, 36, 38, 17, (x, y) => {
    let v = 0.66 - (x - 12) * 0.006 + masonry(x, y, 12, 36, 6, 3, 15);
    if (y === 36) v -= 0.4;
    else if (y === 37) v -= 0.15;
    return pick(WARM_STONE, v, x, y, 3);
  });
  // porta em arco com degrau
  L.fill(27, 40, 38, 52, archTest(32.5, 5, 40.5, 52), (x, y) => pick(WARM_STONE, 0.92 - (x - 27) * 0.03, x, y, 3));
  L.fill(28, 41, 37, 52, archTest(32.5, 4, 41.5, 52), (x, y) => {
    let v = 0.55 - (x - 29) * 0.05;
    if (x === 30 || x === 32 || x === 35) v -= 0.25;
    return pick(PAL.wood, v, x, y, 3);
  });
  for (const y of [45, 49]) L.rect(29, y, 7, 1, PAL.iron[1]);
  L.set(35, 47, PAL.gold[4]);
  L.rect(26, 52, 13, 1, WARM_STONE[4]);
  // janela do térreo com grade de chumbo (do lado da fonte a parede fica lisa)
  L.fill(41, 39, 47, 47, archTest(44, 3, 39, 47), (x, y) => pick(WARM_STONE, 0.9, x, y, 3));
  L.fill(42, 40, 46, 46, archTest(44, 2, 40.5, 46), (x, y) => ((x + y) % 3 === 0 ? GLASS_B : GLASS_A));
  L.rect(44, 41, 1, 6, WARM_STONE[2]);
  L.rect(41, 47, 7, 1, WARM_STONE[4]);
  // brasão pendurado na fachada: escudo azul com chaveirão e borda dourados
  L.rect(30, 25, 7, 1, PAL.iron[2]);
  L.set(30, 26, PAL.iron[1]);
  L.set(36, 26, PAL.iron[1]);
  const inShield = (x, y) => {
    const dx = Math.abs(x + 0.5 - 33.5), k = y + 0.5 - 27;
    return k >= 0 && (k < 4.6 ? dx <= 4 : dx <= 4 - (k - 4.6) * 1.35);
  };
  L.fill(29, 27, 38, 35, (x, y) => inShield(x - 0.5, y - 0.5), (x, y) => {
    if (!inShield(x - 1, y) || !inShield(x + 1, y) || !inShield(x, y + 1) || y === 27) return PAL.gold[x < 33 ? 4 : 3];
    const ch = y + 0.5 - (29.2 + Math.abs(x + 0.5 - 33.5) * 0.9);
    if (ch >= 0 && ch < 1.4) return PAL.gold[x < 34 ? 5 : 4];
    return pick(HERALD, 0.75 - (x - 30) * 0.06 - (y - 28) * 0.04, x, y, 3);
  });
  stamp(p, L);

  // torre redonda com telhado cônico
  const { cx, r, top, apex } = TOWER;
  L.fill(cx - r, top, cx + r, 54, (x, y) => Math.abs(x - cx) <= r + (y > 51 ? 0.8 : 0), (x, y) => {
    const nx = (x + 0.5 - cx) / r;
    let v = 0.08 + cylLight(nx) * 0.9 + masonry(x, y, 48, top, 4, 3, 17) * 0.8;
    if (y > 51) v += 0.12;
    return pick(WARM_STONE, v, x, y, 3);
  });
  for (const wy of [26, 38]) {
    L.fill(53, wy - 1, 57, wy + 6, archTest(55, 1.6, wy - 0.5, wy + 6), WARM_STONE[4]);
    L.fill(54, wy, 56, wy + 5, archTest(55, 0.9, wy + 0.3, wy + 5), GLASS_A);
    L.set(54, wy + 1, GLASS_B);
  }
  const chw = (y) => 8.6 * Math.pow(clamp01((y - apex) / (top + 1 - apex)), 0.85);
  L.fill(cx - 9, apex, cx + 9, top + 1, (x, y) => y <= top + 1 && Math.abs(x - cx) <= chw(y), (x, y) => {
    const w = Math.max(1, chw(y + 0.5));
    return pick(SLATE, 0.2 + cylLight((x + 0.5 - cx) / w) * 0.85 + tiles(x, y, apex, 3, 3), x, y, 3);
  });
  L.rect(Math.round(cx - 8.6), top + 1, 18, 1, SLATE[0]);
  L.rect(54, 0, 1, apex, PAL.iron[2]);
  L.set(54, apex - 1, PAL.gold[4]);
  stamp(p, L);

  // sebe baixa, aberta na frente da porta, com topiarias em cone
  L.fill(0, 48, 63, 57, (x, y) => (x < 26 || x > 39) && y >= 50 + Math.round(Math.sin(x * 0.9) * 0.6 + hash(x, 1, 18) * 0.8), (x, y) => {
    const leaf = (hash(x >> 1, y >> 1, 19) - 0.5) * 0.24 + ((x + y * 2) % 5 === 0 ? -0.14 : 0);
    return pick(HEDGE, 0.74 - (y - 50) * 0.08 - x * 0.003 + leaf, x, y, 3);
  });
  stamp(p, L);
  for (const tx of [26, 39]) {
    L.poly([[tx - 3.5, 57], [tx + 0.5, 42], [tx + 4.5, 57]], (x, y) => {
      let v = 0.15 + cylLight((x - tx) / (1 + (y - 42) * 0.27)) * 0.8 + (hash(x >> 1, y >> 1, 21) - 0.5) * 0.2;
      if ((y + (x % 2)) % 4 === 0) v -= 0.14;
      return pick(HEDGE, v, x, y, 3);
    });
  }
  stamp(p, L);

  // fonte: bacia larga, coluna e bacia de cima
  const bx = FX + 0.5, brx = 10.5;
  L.fill(bx - brx - 1, 52, bx + brx + 1, 62, (x, y) => {
    const nx = (x - bx) / brx;
    return Math.abs(nx) <= 1 && ((y >= 56.5 && y <= 60) || nx * nx + ((y - 60) / 2.4) ** 2 <= 1 || nx * nx + ((y - 56.5) / 3) ** 2 <= 1);
  }, (x, y) => {
    const nx = (x + 0.5 - bx) / brx;
    if (nx * nx + ((y + 0.5 - 56.5) / 3) ** 2 <= 1) {
      if (nx * nx / 0.74 + ((y + 0.5 - 56.6) / 2.1) ** 2 <= 1) return pick(PAL.water, 0.3 + (y - 54.5) * 0.13, x, y, 3);
      return pick(WARM_STONE, 0.95 - nx * 0.25, x, y, 3);
    }
    let v = 0.15 + cylLight(nx) * 0.78;
    if (Math.round(x + 0.5 - bx + nx * 2) % 4 === 0) v -= 0.12;
    return pick(WARM_STONE, v, x, y, 3);
  });
  L.rect(FX - 1, 49, 3, 8, (x, y) => pick(WARM_STONE, 0.25 + cylLight((x + 0.5 - bx) / 1.6) * 0.75, x, y, 3));
  L.ellipse(bx, 49.4, 5.2, 1.9, (x, y) => pick(WARM_STONE, y < 49 ? 0.95 - (x - FX + 5) * 0.04 : 0.5 - (x - FX + 5) * 0.03, x, y, 3));
  L.ellipse(bx, 48.9, 3.8, 0.8, PAL.water[3]);
  L.sphere(bx, 47, 1.2, 1.3, WARM_STONE, 0.25);
  stamp(p, L);
  p.outline(PAL.out);
  return p;
}

// Água da fonte: jato no alto, gotas caindo na bacia de cima e fios descendo até a de baixo.
function paintFountain(f, t, working) {
  const W = PAL.water;
  const isWater = (c) => c === W[1] || c === W[2] || c === W[3] || c === W[4];
  const bx = FX + 0.5;
  const jet = (working ? 6 : 4.4) + Math.sin(t * 7.3) * 0.35 + Math.sin(t * 3.1) * 0.25;
  const top = 46.2 - jet;
  for (let y = Math.ceil(top); y <= 46; y++) f.set(FX, y, W[y < top + 1.5 ? 5 : 4]);
  f.set(FX + 1, Math.ceil(top) + 1, W[3]);
  // leque de gotas caindo do jato
  const n = working ? 16 : 10, spd = working ? 1.25 : 0.85;
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? 1 : -1;
    const ph = (t * spd + k / n + hash(k, 3, 31) * 0.13) % 1;
    const reach = 3.4 + hash(k, 4, 31) * 1.3;
    const x = bx + side * (0.4 + ph * reach);
    const y = top - Math.sin(ph * Math.PI) * 1.2 + (48.6 - top) * ph * ph;
    f.set(x, y, W[ph < 0.45 ? 5 : 4]);
  }
  // fios que transbordam da bacia de cima até a bacia larga
  for (const side of [-1, 1]) {
    const rx = bx + side * 5.5;
    f.set(rx, 49.8, W[4]);
    f.set(rx + side * 0.4, 50.8, W[3]);
    const m = working ? 7 : 5;
    for (let k = 0; k < m; k++) {
      const ph = (t * (spd + 0.45) + k / m + (side > 0 ? 0.37 : 0)) % 1;
      f.set(rx + side * ph * 1.4, 50.2 + ph * ph * 6.4, W[ph < 0.5 ? 4 : 5]);
    }
    // anéis abrindo na água onde os fios caem
    const rr = (t * 0.9 + (side > 0 ? 0.5 : 0)) % 1;
    const R = 0.6 + rr * 3.2;
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const x = Math.floor(rx + side * 1.4 + Math.cos(ang) * R * 1.5), y = Math.floor(56.6 + Math.sin(ang) * R * 0.45);
      if (bayer(x, y) < 1 - rr && isWater(f.get(x, y))) f.set(x, y, W[5]);
    }
  }
  // brilho dourado deslizando na água da bacia
  for (let k = 0; k < 4; k++) {
    const x = Math.floor(bx - 8 + ((t * (2 + k * 0.5) + k * 5) % 16)), y = 55 + (k % 3);
    if (isWater(f.get(x, y))) f.set(x, y, GLOW[3]);
  }
}

// Bandeira na ponta da torre: azul em cima, dourada embaixo.
function paintManorFlag(f, t, working) {
  const spd = working ? 6 : 3.6;
  for (let i = 0; i < 9; i++) {
    const s = Math.sin(t * spd - i * 0.75);
    const wave = Math.round(s * (i / 8) * 1.3);
    const h = i < 6 ? 5 : i === 6 ? 4 : i === 7 ? 3 : 2;
    for (let j = 0; j < h; j++) {
      const y = 1 + j + wave + (i >= 6 ? Math.floor((5 - h) / 2) : 0);
      const lift = s * 0.25 + (j === 0 ? 0.2 : 0);
      f.set(55 + i, y, j < 3 ? pick(HERALD, 0.6 + lift, i, j, 3) : pick(PAL.gold, 0.65 + lift, i, j, 3));
    }
  }
}

const manorArt = { bg: null, body: null, glass: null, clouds: null, frame: new Pix(64, 64) };

function paintManorPortrait(ctx, t, info) {
  const a = manorArt;
  if (!a.bg) {
    a.bg = buildManorBackdrop();
    a.body = buildManor();
    a.clouds = [makeCloud(24, 7, 4, PAL.duskCloud), makeCloud(16, 6, 13, PAL.duskCloud)];
    // vidros das janelas: acendem quando o solar está produzindo
    a.glass = [];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const c = a.body.get(x, y);
        if (c === GLASS_A || c === GLASS_B) a.glass.push([x, y, Math.floor(x / 9) + (y > 36 ? 7 : 0)]);
      }
    }
  }
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 0.9) % 100) - 26), 5);
  f.blit(a.clouds[1], Math.floor(((t * 0.6 + 50) % 90) - 18), 17);
  f.blit(a.body, 0, 0);
  if (info.working) {
    for (const [x, y, id] of a.glass) {
      const v = 0.5 + Math.sin(t * 1.7 + id * 1.9) * 0.12 + Math.sin(t * 6.1 + id) * 0.05 - (y % 4) * 0.06;
      f.set(x, y, pick(GLOW, v, x, y));
    }
  }
  paintManorFlag(f, t, info.working);
  paintFountain(f, t, info.working);
  f.draw(ctx);
}

function buildManorLocked() {
  const p = buildManor();
  paintManorFlag(p, 0, false);
  paintFountain(p, 0.3, false);
  return p;
}

// ---------------------------------------------------------------------------
// Ícones 16x16

function iconFair() {
  const p = new Pix(16, 16);
  // bancada e mercadorias
  p.rect(1, 11, 14, 5, (x, y) => (y === 11 ? PAL.wood[4] : PAL.wood[x % 4 === 0 ? 1 : 2]));
  for (const [x, y] of [[3, 10], [5, 10], [4, 9]]) p.set(x, y, APPLE[x === 4 ? 4 : 3]);
  p.ellipse(10.5, 9.4, 2.6, 1.8, (x) => PUMPKIN[x < 10 ? 4 : 3]);
  p.set(10, 7, PAL.herb[2]);
  // esteios
  for (const x of [1, 14]) p.rect(x, 7, 1, 9, PAL.wood[x === 1 ? 3 : 1]);
  // toldo listrado
  p.poly([[3, 1], [13, 1], [16, 6.5], [0, 6.5]], (x, y) => (Math.floor((x + 8) / 2) % 2 ? CREAM[y < 3 ? 4 : 3] : AWN_RED[y < 3 ? 4 : 3]));
  for (let x = 0; x < 16; x++) if (x % 2 === 0) p.set(x, 7, Math.floor((x + 8) / 2) % 2 ? CREAM[2] : AWN_RED[2]);
  p.outline(PAL.out);
  return p;
}

function iconTown() {
  const p = new Pix(16, 16);
  // torre do sino com flecha de ardósia
  p.rect(10, 4, 4, 6, (x, y) => PAL.stone[x === 10 ? 5 : y === 9 ? 2 : 3]);
  p.poly([[9.5, 4.5], [12, -0.5], [14.5, 4.5]], (x) => SLATE[x < 12 ? 4 : 2]);
  p.rect(11, 5, 2, 2, DARK);
  p.set(11, 6, BRONZE[4]);
  p.set(12, 6, BRONZE[2]);
  // casa de telhado alto
  p.poly([[0.5, 7.5], [4, 1.5], [7.5, 7.5]], (x, y) => PAL.roof[x < 4 ? 4 : y % 2 ? 2 : 3]);
  p.rect(1, 7, 6, 2, PLASTER[3]);
  p.set(4, 7, PAL.wood[1]);
  // muralha com ameias e portão em arco
  p.fill(0, 8, 15, 15, (x, y) => y >= 10 || x % 3 !== 2, (x, y) => {
    if (y === 8 || y === 10) return PAL.stone[4];
    return PAL.stone[(y === 12 || y === 14) && y > 10 ? 1 : x < 8 ? 3 : 2];
  });
  p.fill(4, 9, 11, 15, archTest(8, 3.5, 9.5, 15), (x, y) => pick(PAL.stone, 0.92 - (x - 4) * 0.05, x, y, 3));
  p.fill(5, 10, 10, 15, archTest(8, 2.5, 10.5, 15), (x, y) => (x % 2 === 0 && y < 14 ? PAL.iron[3] : DARK));
  p.outline(PAL.out);
  return p;
}

function iconManor() {
  const p = new Pix(16, 16);
  // telhado e andar de cima em enxaimel
  p.poly([[0, 6.5], [3, 2], [9, 2], [12, 6.5]], (x, y) => PAL.roof[y < 4 ? 4 : x < 6 ? 3 : 2]);
  p.rect(1, 6, 10, 4, (x, y) => (x === 1 || x === 4 || y === 6 ? PAL.wood[1] : PLASTER[4]));
  for (const [x, y] of [[5, 9], [6, 8], [7, 7], [8, 8], [9, 9]]) p.set(x, y, PAL.wood[2]);
  p.rect(2, 7, 2, 2, GLOW[2]);
  // térreo de pedra com porta em arco
  p.rect(1, 10, 10, 5, (x, y) => PAL.stone[y % 2 ? 2 : 3]);
  p.rect(6, 11, 3, 4, PAL.wood[2]);
  p.set(7, 11, PAL.wood[1]);
  p.set(3, 12, GLOW[2]);
  // torre redonda com cone e bandeira
  p.fill(10, 5, 15, 15, (x) => x >= 11 && x <= 15, (x, y) => pick(WARM_STONE, 0.2 + cylLight((x + 0.5 - 13) / 2.5) * 0.85, x, y, 3));
  p.poly([[9.5, 6], [13, 1.5], [16.5, 6]], (x) => SLATE[x < 13 ? 4 : x < 14 ? 3 : 2]);
  p.set(13, 0, PAL.iron[2]);
  p.set(13, 1, PAL.iron[2]);
  p.rect(14, 0, 2, 1, HERALD[3]);
  p.set(13, 9, GLOW[2]);
  p.set(13, 10, GLOW[1]);
  p.outline(PAL.out);
  return p;
}

ART.portraits.fair = paintFairPortrait;
ART.portraits.town = paintTownPortrait;
ART.portraits.manor = paintManorPortrait;
ART.locked.fair = ART.silhouette(buildFairLocked);
ART.locked.town = ART.silhouette(buildTownLocked);
ART.locked.manor = ART.silhouette(buildManorLocked);
Object.assign(ART.icons, { fair: iconFair, town: iconTown, manor: iconManor });
})();
