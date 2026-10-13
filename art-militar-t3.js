'use strict';
// Linha militar, tiers 3 a 6: Arsenal (ergue forjas), Quartel (forma arsenais),
// Torre de vigia (forma quartéis) e Cavaleiro (forma torres de vigia).
// Retratos animados, silhuetas bloqueadas e ícones, no entardecer do castelo.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

const STONE_WARM = ramp('#2a2026', '#3e3036', '#5a4648', '#7a6058', '#9c7c68', '#c09c7e');
const PURPLE_HILLS = ramp('#2e2244', '#3e2e56', '#523c68', '#684c78');
const DUSK_SMOKE = ramp('#3a3040', '#5a4a5a', '#7a6a76', '#a08e96', '#c4b4b4');
const WARM_COBBLE = ramp('#2c2026', '#45302e', '#624232', '#865a38', '#ac7642', '#d09a56');
const INSIDE = ramp('#120a08', '#1e110c', '#2e1a10', '#442616', '#5e361c', '#7e4a24', '#a0632e');
const SHINGLE = ramp('#1e1819', '#342a29', '#4c3e38', '#685447', '#866d58', '#a68a6c');
const MAIL = ramp('#15171e', '#272c37', '#404755', '#636b7a', '#8f97a3', '#c2c8d0');
const HERALD = ramp('#0c1434', '#162452', '#233a78', '#34549e', '#4c74c0', '#7096d8');
const DUSK_GRASS = ramp('#1a1826', '#262a30', '#343e32', '#4a5838', '#68743e', '#8e9246');
const FAR_DUSK = ramp('#3a2c50', '#4c3a60', '#624a6e', '#7c5c7a', '#9a7084');
const PLUME = ramp('#3e0c14', '#6e1620', '#a42630', '#d4443e', '#f2725a', '#ffa888');
const LINEN = ramp('#5e5058', '#8e8080', '#bcae9e', '#e2d6bc', '#f8f0dc');
const EYE_GREY = C('#3a4a5a'), EYE_GREY_HI = C('#7a92a6');
const BIRD = C('#1c1424');
const WHITE = C('#fffaf0');
const OUT_RAMP = [PAL.out];

// ---------------------------------------------------------------------------
// Peças comuns

const archTest = (cx, rx, top, bottom) => (x, y) =>
  y <= bottom && ((Math.abs(x - cx) <= rx && y >= top + rx) || ((x - cx) / rx) ** 2 + ((y - top - rx) / rx) ** 2 <= 1);

// Alvenaria: ajuste de tom de um bloco (junta escura, aresta de cima clara, variação por bloco).
function masonry(x, y, bw, bh, seed, oy = 0) {
  const ry = (((y - oy) % bh) + bh) % bh;
  const row = Math.floor((y - oy) / bh), off = (row & 1) * (bw >> 1);
  if (ry === bh - 1 || (x + off) % bw === 0) return -0.17;
  return (hash(Math.floor((x + off) / bw), row, seed) - 0.5) * 0.16 + (ry === 0 ? 0.06 : 0);
}

// Coordenadas (a, b) de um ponto num paralelogramo o + a*e1 + b*e2.
function planeUV(o, e1, e2) {
  const det = e1[0] * e2[1] - e1[1] * e2[0];
  return (x, y) => {
    const dx = x - o[0], dy = y - o[1];
    return [(dx * e2[1] - dy * e2[0]) / det, (e1[0] * dy - e1[1] * dx) / det];
  };
}
const quad = (o, e1, e2) => [o, [o[0] + e1[0], o[1] + e1[1]], [o[0] + e1[0] + e2[0], o[1] + e1[1] + e2[1]], [o[0] + e2[0], o[1] + e2[1]]];

// Distância de (px, py) até a poligonal, o vetor do ponto mais próximo até ele e
// a posição ao longo do caminho (0 no começo, 1 no fim).
function nearestOnPath(path, px, py) {
  let best = Infinity, bx = 0, by = 0, bs = 0, total = 0;
  const lens = [];
  for (let i = 0; i < path.length - 1; i++) {
    lens.push(Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]));
    total += lens[i];
  }
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [cx, cy] = path[i + 1];
    const dx = cx - ax, dy = cy - ay;
    const s = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
    const ox = px - ax - dx * s, oy = py - ay - dy * s;
    const d = ox * ox + oy * oy;
    if (d < best) { best = d; bx = ox; by = oy; bs = (acc + lens[i] * s) / total; }
    acc += lens[i];
  }
  return [Math.sqrt(best), bx, by, bs];
}

// Luz que pulsa: compara a versão apagada com a acesa e guarda, para cada pixel que
// muda, um limiar. A cada quadro acendem os pixels com limiar abaixo do nível pedido.
function makeHalo(base, lit, threshold) {
  const idx = [], th = [], col = [];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = y * 64 + x;
      if (base.d[i] === lit.d[i]) continue;
      const v = threshold(x, y);
      if (v === null) continue;
      idx.push(i);
      th.push(v + (bayer(x, y) - 0.5) * 0.28);
      col.push(lit.d[i]);
    }
  }
  return { idx: Int32Array.from(idx), th: Float32Array.from(th), col: Uint32Array.from(col) };
}

function paintHalo(f, h, level) {
  const d = f.d;
  for (let k = 0; k < h.idx.length; k++) if (h.th[k] < level) d[h.idx[k]] = h.col[k];
}

// Chama com a base em (x, y): núcleo claro embaixo, ponta que dança.
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

// Fagulhas subindo de (x, y) e apagando no alto.
function paintEmbers(f, x, y, t, n, rise, seed) {
  for (let k = 0; k < n; k++) {
    const life = (t * (0.45 + hash(k, 1, seed) * 0.4) + hash(k, 2, seed)) % 1;
    f.set(x + (hash(k, 3, seed) - 0.5) * 4 + Math.sin(t * 3 + k * 2.1) * 1.6 * life, y - life * rise,
      PAL.fire[life < 0.35 ? 5 : life < 0.7 ? 4 : 3]);
  }
}

// Fumaça pontilhada subindo de (x0, y0) e indo com o vento para a direita.
function paintSmoke(f, t, x0, y0, speed, drift, rise, size, seed) {
  for (let k = 0; k < 7; k++) {
    const s = (t * speed + k / 7 + seed * 0.31) % 1;
    const sx = x0 + s * drift + Math.sin(s * 6 + k + seed) * 1.2, sy = y0 - s * rise, r = (1 + s * 3.2) * size;
    for (let y = Math.floor(sy - r); y <= sy + r; y++) {
      for (let x = Math.floor(sx - r); x <= sx + r; x++) {
        const dd = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / r;
        if (dd <= 1 && bayer(x, y) < (1 - s) * 1.2 * (1.1 - dd * 0.5)) f.set(x, y, DUSK_SMOKE[dd < 0.5 && y < sy ? 3 : 2]);
      }
    }
  }
}

// Envelope de um evento periódico: 0 quase sempre, sobe e desce rápido.
function pulse(t, period, width) {
  const ph = (((t % period) + period) % period) / width;
  return ph < 1 ? Math.sin(ph * Math.PI) : 0;
}

// Estrelinha de brilho em metal (s de 0 a 1).
function sparkle(f, x, y, s) {
  if (s <= 0.08) return;
  f.set(x, y, WHITE);
  const arm = Math.round(s * 2.2);
  for (let k = 1; k <= arm; k++) {
    const c = k === arm ? PAL.steel[4] : WHITE;
    f.set(x + k, y, c); f.set(x - k, y, c); f.set(x, y + k, c); f.set(x, y - k, c);
  }
}

// Pixels de uma rampa (aço, ouro) numa área: o brilho corre por eles.
function rampPixels(p, r, x0, y0, x1, y1) {
  const list = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = r.indexOf(p.get(x, y));
      if (k >= 0) list.push(x, y, k);
    }
  }
  return Int16Array.from(list);
}

// Faixa de brilho na diagonal passando pelos pixels guardados; s é a posição.
function sweepGlint(f, list, r, s, width = 1.8) {
  const top = r.length - 1;
  for (let i = 0; i < list.length; i += 3) {
    const d = Math.abs(list[i] * 0.8 + list[i + 1] * 0.6 - s);
    if (d < width) f.set(list[i], list[i + 1], r[Math.min(top, list[i + 2] + (d < width * 0.45 ? 2 : 1))]);
  }
}

// Bandeira presa no mastro em (px, py), tremulando para a direita. paint(i, j)
// devolve [rampa, tom] de cada pixel do pano, ou null para recortar a ponta.
function paintFlag(f, q, px, py, len, h, ph, amp, paint) {
  q.clear();
  for (let i = 0; i < len; i++) {
    const s = Math.sin(ph - i * 0.8);
    const dy = Math.round(s * amp * (i + 1) / len);
    const lit = Math.cos(ph - i * 0.8) * 0.24;
    for (let j = 0; j < h; j++) {
      const c = paint(i, j);
      if (c) q.set(1 + i, 3 + j + dy, pick(c[0], c[1] + lit - i * 0.012, i, j, 3));
    }
  }
  q.outline(PAL.out);
  for (let y = 0; y < q.h; y++) q.d[y * q.w] = 0; // não cobre o mastro
  f.blit(q, px, py - 3);
}

// Estandarte pendurado: guarda rampa e tom de cada pixel; a cada quadro as linhas
// balançam com o vento e dobras de luz e sombra correm pelo pano.
function makeBanner(w, h, paint) {
  const ramps = [];
  const kind = new Int8Array(w * h).fill(-1);
  const val = new Float32Array(w * h);
  paint((i, j, r, v) => {
    if (i < 0 || j < 0 || i >= w || j >= h) return;
    let k = ramps.indexOf(r);
    if (k < 0) { k = ramps.length; ramps.push(r); }
    kind[j * w + i] = k;
    val[j * w + i] = v;
  });
  return { w, h, ramps, kind, val };
}

function drawBanner(f, b, x0, y0, t, amp) {
  for (let j = 0; j < b.h; j++) {
    const k = j / b.h;
    const dx = Math.round(Math.sin(t * 1.5 - j * 0.12) * amp * k * k);
    for (let i = 0; i < b.w; i++) {
      const n = j * b.w + i;
      const ri = b.kind[n];
      if (ri < 0) continue;
      const fold = Math.sin(i * 0.8 - t * 2.2 + j * 0.07) * 0.17 * (0.35 + k);
      f.set(x0 + i + dx, y0 + j, pick(b.ramps[ri], b.val[n] + fold, i, j));
    }
  }
}

// Pássaro em V; flap > 0 com as asas para cima.
function paintBird(f, x, y, flap) {
  x = Math.round(x); y = Math.round(y);
  const up = flap > 0 ? -1 : 1;
  f.set(x, y, BIRD); f.set(x - 1, y, BIRD); f.set(x + 1, y, BIRD);
  f.set(x - 2, y + up, BIRD); f.set(x + 2, y + up, BIRD);
}

// Leão rampante dourado, virado para a esquerda (o mesmo brasão do cavaleiro e do estandarte).
const LION = [
  '....##.....',
  '...####....',
  '..##.##....',
  '.#####.#...',
  '##.####.#..',
  '...######..',
  '..#######.#',
  '....####..#',
  '...#####.#.',
  '..##..###..',
  '.##....##..',
  '##....###..',
];

// Escudo em forma de amêndoa: meia largura na linha y (topo em y0, altura h).
const heaterHalf = (w, h, y0) => (y) => {
  const r = (y - y0) / h;
  return r < 0.5 ? w / 2 : (w / 2) * Math.sqrt(Math.max(0, 1 - ((r - 0.5) / 0.52) ** 2));
};

// ---------------------------------------------------------------------------
// Arsenal

const AR_CX = 21.5;
const AR_TORCHES = [[8, 36], [35, 36]]; // base das chamas
const AR_DOOR = archTest(AR_CX, 10, 33, 56);
const AR_ARCH = archTest(AR_CX, 12, 31, 56);
const arWallLight = (x, y) => {
  let l = 0;
  for (const [tx, ty] of AR_TORCHES) l += clamp01(1 - Math.hypot(x + 0.5 - tx, (y + 0.5 - ty) * 1.15) / 15) ** 1.5;
  return l;
};
const arGroundLight = (x, y) => {
  let l = 0;
  for (const [tx] of AR_TORCHES) l += clamp01(1 - Math.hypot((x + 0.5 - tx) / 9, (y + 0.5 - 57) / 4));
  return l;
};
const arTorchDist = (x, y) => Math.min(...AR_TORCHES.map(([tx, ty]) => Math.hypot(x + 0.5 - tx, (y + 0.5 - ty) * 0.9))) / 26;

function buildArsenalBackdrop(glow) {
  const p = new Pix(64, 64);
  paintSky(p, 0, 48, PAL.dusk, 2.4);
  // morros roxos ao longe
  for (let x = 0; x < 64; x++) {
    const top = Math.round(37 + 2 * Math.sin(x * 0.13 + 1) + Math.sin(x * 0.41));
    for (let y = top; y < 48; y++) p.set(x, y, pick(PURPLE_HILLS, (y === top ? 0.9 : 0.6) - (y - top) * 0.05, x, y, 2));
  }
  // torre redonda do castelo, lá atrás à direita
  const tc = 60.5;
  p.fill(54, 22, 63, 50, (x, y) => Math.abs(x + 0.5 - tc) <= 4.5 && y >= 25, (x, y) =>
    pick(PAL.cobble, 0.08 + cylLight((x + 0.5 - tc) / 4.5) * 0.6 + masonry(x, y, 4, 3, 3) * 0.7, x, y));
  p.fill(54, 14, 63, 25, (x, y) => Math.abs(x + 0.5 - tc) <= (y - 13.5) * 0.52 && y < 25, (x, y) =>
    pick(PAL.roof, 0.1 + cylLight((x + 0.5 - tc) / Math.max(1, (y - 13.5) * 0.52)) * 0.6 - (y % 3 === 2 ? 0.18 : 0), x, y));
  p.rect(60, 9, 1, 5, PAL.iron[1]);
  p.rect(61, 9, 3, 2, (x, y) => PAL.banner[y === 9 ? 2 : 1]);
  p.rect(60, 31, 1, 3, INSIDE[0]);
  p.set(60, 32, PAL.fire[2]);
  // muralha do castelo ao fundo, com ameias
  for (let x = 0; x < 64; x++) {
    const top = (x + 3) % 8 < 5 ? 41 : 44;
    for (let y = top; y < 57; y++) {
      let v = 0.3 + masonry(x, y, 8, 4, 2, 41) * 0.8 - (y - 41) * 0.012;
      if (y === top) v += 0.24;
      p.set(x, y, pick(PAL.cobble, v, x, y));
    }
  }
  // pátio calçado: a luz da porta aberta e das tochas cai nas pedras
  for (let y = 55; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const row = Math.floor((y - 55) / 3), off = (row % 2) * 3;
      const edge = (y - 55) % 3 === 2 || (x + off) % 6 === 0;
      const v = 0.3 + (y - 55) * 0.03 + (hash(Math.floor((x + off) / 6), row, 4) - 0.5) * 0.16 - (edge ? 0.2 : 0);
      const door = clamp01(1 - Math.hypot((x + 0.5 - AR_CX) / 12, (y + 0.5 - 56) / 8)) ** 1.2;
      const l = door * 0.5 + arGroundLight(x, y) * (0.12 + glow * 0.3);
      p.set(x, y, l * 3.2 > bayer(x, y) + 0.25 ? pick(WARM_COBBLE, v + l * 0.5, x, y) : pick(PAL.cobble, v, x, y));
    }
  }
  return p;
}

// Telhas de barro num plano o + a*e1 + b*e2: fiadas ao longo de e1, canais descendo
// pelo plano e sombra na borda de baixo de cada fiada. b vai da cumeeira ao beiral.
function roofTiles(p, o, e1, e2, rows, cols, base, seed) {
  const uv = planeUV(o, e1, e2);
  p.poly(quad(o, e1, e2), (x, y) => {
    const [a, b] = uv(x + 0.5, y + 0.5);
    const rb = clamp01(b) * rows, row = Math.floor(rb), fb = rb - row;
    const ca = a * cols + (row % 2) * 0.5, col = Math.floor(ca), fa = ca - col;
    let v = base + (hash(col, row, seed) - 0.5) * 0.14 + (0.5 - fb) * 0.14 - a * 0.14;
    v += Math.sin(fa * Math.PI) * 0.24 - 0.12; // telha-canal arredondada
    if (fb > 0.74) v -= 0.3;
    if (hash(col, row, seed + 1) < 0.05) v -= 0.18;
    return pick(PAL.roof, v, x, y, 2.4);
  });
}

// Escudo pequeno pendurado: campo e peça desenhados por field(i, j), borda escura.
function smallShield(p, x0, y0, w, h, field) {
  const half = heaterHalf(w, h, y0);
  const cx = x0 + w / 2;
  p.fill(x0, y0, x0 + w, y0 + h, (x, y) => Math.abs(x - cx) <= half(y) + 0.01 && y < y0 + h, (x, y) => {
    const edge = Math.abs(x + 0.5 - cx) > half(y + 0.5) - 1 || y === y0;
    return edge ? (x + 0.5 < cx ? PAL.gold[2] : PAL.gold[1]) : field(x - x0, y - y0);
  });
}

// Lança em pé com ponta em folha; tip é a linha da ponta.
function standingSpear(p, x, tip, foot) {
  p.rect(x, tip + 4, 1, foot - tip - 4, (xx, y) => PAL.wood[y % 4 === 0 ? 3 : 4]);
  p.set(x, tip, PAL.steel[5]);
  p.set(x - 1, tip + 1, PAL.steel[5]);
  p.set(x, tip + 1, PAL.steel[4]);
  p.set(x + 1, tip + 1, PAL.steel[2]);
  p.set(x - 1, tip + 2, PAL.steel[4]);
  p.set(x, tip + 2, PAL.steel[3]);
  p.set(x + 1, tip + 2, PAL.steel[1]);
  p.set(x, tip + 3, PAL.leather[1]);
}

function buildArsenal(glow = 0) {
  const p = new Pix(64, 64);
  const L = (x, y) => arWallLight(x, y) * (0.2 + glow * 0.24);

  // telhado: o plano da direita, visto de quina
  roofTiles(p, [AR_CX, 11], [13, 1], [19.5, 19.5], 7, 6, 0.52, 21);
  // cumeeira com as telhas de capa
  for (let i = 0; i <= 13; i++) {
    const x = AR_CX + i, y = 11 + i * 0.077;
    p.set(x, y - 1, PAL.roof[i % 3 === 0 ? 3 : 4]);
    p.set(x, y, PAL.roof[i % 3 === 0 ? 1 : 2]);
  }
  // parede lateral na sombra, indo para o fundo
  const sideTop = (x) => 30.4 + (x - 39) * 0.077;
  const sideBot = (x) => 57 - (x - 39) * 0.1;
  p.fill(39, 30, 53, 56, (x, y) => y >= sideTop(x) && y < sideBot(x), (x, y) => {
    let v = 0.36 + masonry(x, y, 5, 3, 5, 31) * 0.9 - (x - 39) * 0.01;
    if (y < sideTop(x) + 2.5) v -= 0.2; // sombra do beiral
    return pick(PAL.cobble, v, x, y);
  });
  p.rect(53, 31, 1, 25, (x, y) => PAL.cobble[(y - 31) % 3 === 2 ? 1 : 2]);
  // contraforte e seteira com luz lá dentro
  p.fill(45, 35, 48, 56, (x, y) => y >= 38 - (x - 45) * 0.8 && y < sideBot(x), (x, y) =>
    pick(PAL.cobble, (x === 45 ? 0.58 : 0.3) + masonry(x, y, 3, 3, 6) * 0.6, x, y));
  for (const sx of [42, 50]) {
    p.rect(sx, 37, 1, 6, INSIDE[1]);
    p.set(sx, 39, PAL.fire[2]);
    p.set(sx, 40, PAL.fire[3]);
    p.set(sx, 41, PAL.fire[2]);
    p.set(sx - 1, 36, PAL.cobble[4]);
  }

  // oitão de tábuas
  const inGable = (x, y) => y >= 12 && y < 31 && Math.abs(x - AR_CX) <= y - 12;
  p.fill(3, 12, 40, 30, inGable, (x, y) => {
    const board = Math.floor((x - 3) / 3);
    let v = 0.52 + (hash(board, 0, 11) - 0.5) * 0.14 + (hash(x, y >> 2, 12) - 0.5) * 0.08 - ((x + 0.5 - AR_CX) / 18) * 0.14 + L(x, y);
    if ((x - 3) % 3 === 0) v -= 0.26;
    if (hash(x, y, 13) < 0.03) v -= 0.2;
    return pick(PAL.wood, v, x, y);
  });
  // respiro redondo no alto
  p.sphere(AR_CX, 16.5, 1.6, 1.6, INSIDE, -0.1);
  p.set(21, 16, PAL.fire[2]);
  // troféu: duas lanças cruzadas atrás de um escudo com o brasão
  for (const [x0, y0, x1, y1] of [[15, 30, 27, 20], [28, 30, 16, 20]]) {
    p.line(x0, y0, x1, y1, (x) => PAL.wood[x < AR_CX ? 4 : 3]);
    const dx = Math.sign(x1 - x0);
    p.set(x1, y1, PAL.steel[4]);
    p.set(x1 + dx, y1 - 1, PAL.steel[5]);
    p.set(x1, y1 - 1, PAL.steel[3]);
    p.set(x1 + dx, y1, PAL.steel[2]);
  }
  const sh = heaterHalf(10, 11, 19);
  p.fill(16, 19, 27, 30, (x, y) => Math.abs(x - AR_CX) <= sh(y) && y < 30, (x, y) => {
    const dx = x + 0.5 - AR_CX;
    if (Math.abs(dx) > sh(y + 0.5) - 1 || y === 19) return PAL.gold[dx < 0 ? 4 : 2];
    const chev = y + 0.5 - (22.5 + Math.abs(dx) * 0.9);
    if (chev >= 0 && chev < 2) return PAL.gold[dx < 0 ? 4 : 3];
    return pick(PAL.banner, 0.62 - dx * 0.08 - (y - 20) * 0.02 + L(x, y), x, y);
  });
  // tábuas de beirada do oitão, a da esquerda pegando luz
  for (let y = 11; y <= 31; y++) {
    const d = y - 12;
    const xl = Math.floor(AR_CX - d) - 1, xr = Math.ceil(AR_CX + d);
    p.set(xl, y, PAL.wood[4]);
    p.set(xl - 1, y, PAL.wood[3]);
    p.set(xl - 2, y, PAL.roof[(y & 1) ? 1 : 2]); // pontas das telhas do lado de lá
    p.set(xr, y, PAL.wood[2]);
    p.set(xr + 1, y, PAL.wood[1]);
  }
  p.rect(20, 9, 3, 2, (x, y) => PAL.wood[y === 9 ? 4 : 2]);

  // viga entre a pedra e o oitão
  p.rect(3, 30, 38, 2, (x, y) => pick(PAL.wood, (y === 30 ? 0.6 : 0.24) - (x - 3) * 0.006 + L(x, y), x, y));
  for (const x of [6, 14, 29, 37]) p.set(x, 31, PAL.iron[2]);

  // fachada de pedra, com cunhais claros nas quinas
  p.fill(4, 32, 38, 56, () => true, (x, y) => {
    const qrow = Math.floor((y - 32) / 3), long = qrow % 2 === 0;
    const inner = x <= 21 ? 4 + (long ? 5 : 3) : 38 - (long ? 5 : 3);
    const quoin = x <= 21 ? x < inner : x > inner;
    let v;
    if (quoin) {
      v = 0.66 + (hash(qrow, x > 21 ? 1 : 0, 9) - 0.5) * 0.1;
      if ((y - 32) % 3 === 2 || x === inner + (x <= 21 ? -1 : 1)) v -= 0.2;
    } else {
      v = 0.46 + masonry(x, y, 6, 3, 7, 32);
    }
    if (x === 4) v += 0.16;
    else if (x === 38) v -= 0.22;
    return pick(STONE_WARM, v - (y - 32) * 0.004 + L(x, y), x, y);
  });

  // arco da porta: aduelas em leque e ombreiras
  p.fill(9, 31, 34, 56, (x, y) => AR_ARCH(x + 0.5, y + 0.5) && !AR_DOOR(x + 0.5, y + 0.5), (x, y) => {
    let v = 0.72 + L(x, y) * 0.8 - (x + 0.5 - AR_CX) * 0.012;
    if (y < 43) {
      const ang = Math.atan2(43 - (y + 0.5), x + 0.5 - AR_CX) / Math.PI * 9;
      const seg = Math.floor(ang), fa = ang - seg;
      if (fa < 0.16) v -= 0.3;
      v += (hash(seg, 0, 14) - 0.5) * 0.12 + (seg === 4 ? 0.12 : 0);
    } else {
      if ((y - 43) % 3 === 2) v -= 0.28;
      v += (hash(Math.floor((y - 43) / 3), x > 21 ? 1 : 0, 15) - 0.5) * 0.12;
    }
    return pick(STONE_WARM, v, x, y);
  });

  // interior: tábuas na parede do fundo, iluminadas por um lampião lá dentro
  const lamp = (x, y) => clamp01(1 - Math.hypot((x + 0.5 - 22) / 10, (y + 0.5 - 44) / 13));
  p.fill(11, 33, 32, 56, (x, y) => AR_DOOR(x + 0.5, y + 0.5), (x, y) => {
    if (y >= 53) {
      const v = 0.32 + lamp(x, y) * 0.45 + ((x + (y & 1) * 2) % 4 === 0 || y === 53 ? -0.18 : 0);
      return pick(INSIDE, v, x, y);
    }
    let v = 0.24 + lamp(x, y) * 0.55;
    if ((x - 11) % 3 === 0) v -= 0.16;
    return pick(INSIDE, v, x, y, 1.6);
  });
  // folhas da porta abertas para dentro, encostadas no vão, com ferragens
  for (const [x0, d] of [[12, 1], [29, -1]]) {
    p.fill(x0, 33, x0 + 2, 55, (x, y) => AR_DOOR(x + 0.5, y + 0.5), (x, y) => {
      const k = d > 0 ? x - x0 : x0 + 2 - x; // 0 na borda de fora
      if (k === 2) return INSIDE[0];
      if (y === 39 || y === 47 || y === 54) return PAL.iron[k === 0 ? 2 : 3];
      return pick(PAL.wood, (d > 0 ? 0.52 : 0.4) + (k === 0 ? -0.18 : 0.06) - (y > 50 ? 0.06 : 0), x, y);
    });
  }
  p.set(14, 43, PAL.gold[3]);
  p.set(29, 43, PAL.gold[2]);
  // duas lanças em pé
  standingSpear(p, 16, 37, 55);
  standingSpear(p, 19, 35, 55);
  // espada deitada nos ganchos
  for (let x = 20; x <= 25; x++) {
    p.set(x, 38, PAL.steel[x === 20 ? 3 : 5]);
    p.set(x, 39, PAL.steel[x === 20 ? 1 : 2]);
  }
  p.rect(26, 37, 1, 4, (x, y) => PAL.gold[y === 37 ? 5 : y === 40 ? 2 : 3]);
  p.rect(27, 38, 1, 2, PAL.leather[3]);
  p.set(28, 38, PAL.gold[4]);
  p.set(28, 39, PAL.gold[2]);
  for (const x of [21, 27]) p.set(x, 40, INSIDE[0]);
  // escudos: um vermelho com asna de ouro pendurado, outro azul e prata encostado no chão
  smallShield(p, 21, 41, 7, 8, (i, j) => {
    const chev = j - (2 + Math.abs(i - 3) * 0.8);
    if (chev >= 0 && chev < 1.5) return PAL.gold[i < 3 ? 5 : 3];
    return PAL.banner[i < 2 ? 3 : i < 5 ? 2 : 1];
  });
  p.set(24, 40, PAL.iron[3]);
  smallShield(p, 23, 49, 6, 7, (i) => (i < 3 ? HERALD[i < 2 ? 4 : 3] : LINEN[i < 4 ? 4 : 2]));
  // elmo no chão, ao pé das lanças
  p.fill(18, 51, 23, 55, (x, y) => ((x - 20.5) / 2.4) ** 2 + ((y - 54) / 2.6) ** 2 <= 1 && y < 54, (x, y) =>
    pick(PAL.steel, 0.2 + sphereLight((x + 0.5 - 20.5) / 2.4, (y + 0.5 - 53) / 2.6) * 0.9, x, y));
  p.rect(17, 54, 8, 1, (x) => PAL.steel[x < 20 ? 3 : 1]);
  p.rect(18, 55, 6, 1, INSIDE[1]);

  // tochas nos suportes de ferro, uma de cada lado da porta
  for (const [tx, ty] of AR_TORCHES) {
    p.rect(tx - 1, ty, 2, 1, (x) => (x === tx - 1 ? INSIDE[2] : INSIDE[1]));
    p.rect(tx - 1, ty + 1, 2, 4, (x) => PAL.wood[x === tx - 1 ? 3 : 2]);
    p.rect(tx - 2, ty + 2, 4, 1, (x) => PAL.iron[x < tx ? 3 : 1]);
    p.set(tx - 1, ty + 5, PAL.iron[2]);
    p.set(tx - 1, ty + 6, PAL.iron[1]);
  }

  // lanças de reserva encostadas na quina, barril e caixote
  for (const [x0, y0, x1, y1] of [[50, 56, 54, 34], [52, 56, 55, 36], [48, 56, 51, 37]]) {
    p.line(x0, y0, x1, y1, (x, y) => PAL.wood[(x + y) % 3 ? 3 : 2]);
    p.set(x1, y1 - 1, PAL.steel[4]);
    p.set(x1, y1 - 2, PAL.steel[5]);
    p.set(x1 - 1, y1 - 1, PAL.steel[3]);
  }
  p.fill(39, 47, 45, 57, () => true, (x, y) => {
    if (y === 49 || y === 54) return PAL.iron[x < 42 ? 2 : 1];
    let v = 0.15 + cylLight((x + 0.5 - 42) / 3.2) * 0.75;
    if (y === 47) v += 0.2;
    return pick(PAL.wood, v - (x % 2 ? 0.06 : 0), x, y);
  });
  p.rect(40, 46, 5, 1, (x) => PAL.wood[x < 42 ? 4 : 3]);
  for (const [x, y] of [[41, 45], [42, 44], [43, 45]]) p.set(x, y, PAL.wood[4]); // flechas no barril
  for (const [x, y] of [[40, 44], [42, 43], [44, 44]]) p.set(x, y, LINEN[4]);
  p.rect(45, 50, 8, 7, (x, y) => {
    if (x === 45 || x === 52 || y === 50 || y === 56) return PAL.wood[y === 50 ? 4 : x === 45 ? 3 : 1];
    if (x - 45 === y - 50 || x - 45 === 56 - y) return PAL.wood[2];
    return pick(PAL.wood, 0.36 - (x - 46) * 0.02, x, y);
  });
  // escudo redondo de tábuas encostado no caixote
  const [bx, by] = [49.5, 53.5];
  p.fill(45, 49, 54, 58, (x, y) => Math.hypot(x - bx, y - by) <= 3.6, (x, y) => {
    const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
    if (d > 2.7) return PAL.iron[x + y < bx + by ? 3 : 1];
    if (d < 1) return PAL.steel[x < bx ? 5 : 3];
    return pick(PAL.banner, 0.2 + sphereLight((x + 0.5 - bx) / 3, (y + 0.5 - by) / 3) * 0.75, x, y);
  });

  // mastro do pendão no topo do oitão
  p.rect(21, 1, 1, 9, (x, y) => (y === 1 ? PAL.gold[5] : PAL.iron[y < 5 ? 3 : 2]));

  p.outline(PAL.out);
  return p;
}

// Pendão vermelho com a ponta em rabo de andorinha e uma faixa dourada.
const pennant = (i, j) => {
  if (i >= 9 && (j === 1 || j === 2)) return null;
  return j === 0 ? [PAL.gold, 0.7] : [PAL.banner, 0.62 - j * 0.08];
};

function paintArsenalFlag(f, q, t, working) {
  paintFlag(f, q, 21, 2, 11, 4, t * (working ? 6 : 3.6), 1.3, pennant);
}

const arsenalArt = { bg: null, frame: new Pix(64, 64), flag: new Pix(14, 12) };

function paintArsenalPortrait(ctx, t, info) {
  const a = arsenalArt;
  if (!a.bg) {
    a.bg = buildArsenalBackdrop(0);
    a.ground = makeHalo(a.bg, buildArsenalBackdrop(1), (x, y) => arGroundLight(x, y) > 0 ? 1 - arGroundLight(x, y) : null);
    a.body = buildArsenal(0);
    a.wall = makeHalo(a.body, buildArsenal(1), arTorchDist);
    a.steel = rampPixels(a.body, PAL.steel, 12, 33, 31, 56);
    a.clouds = [makeCloud(18, 7, 3, PAL.duskCloud), makeCloud(13, 6, 8, PAL.duskCloud)];
  }
  const working = info.working;
  const live = working ? 1 : 0.6;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 1.1) % 92) - 20), 3);
  f.blit(a.clouds[1], Math.floor(((t * 0.7 + 50) % 84) - 15), 17);
  // pássaros voltando para o ninho
  for (let k = 0; k < 2; k++) {
    const u = ((t * 0.035 + k * 0.17) % 1);
    paintBird(f, 70 - u * 80 + k * 4, 8 + k * 3 + Math.sin(t * 0.8 + k) * 1.5, Math.sin(t * 9 + k * 2));
  }
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 14.7 + 1) * 0.3 + Math.sin(t * 3.3) * 0.2;
  const level = 0.4 + live * 0.14 + flick * 0.08 * live;
  paintHalo(f, a.ground, level + 0.3);
  f.blit(a.body, 0, 0);
  paintHalo(f, a.wall, level);
  AR_TORCHES.forEach(([tx, ty], k) => {
    paintFlame(f, tx - 0.5, ty, t + k * 1.7, 4 + live * 1.6, 1.6, live);
    paintEmbers(f, tx - 1, ty - 4, t + k * 0.6, working ? 3 : 1, 12, 40 + k);
  });
  // brilho correndo pelas lâminas e pontas guardadas lá dentro
  const period = working ? 2.4 : 4.4;
  sweepGlint(f, a.steel, PAL.steel, ((t % period) / 1.2) * 40 + 20, 1.6);
  sparkle(f, 25, 47, pulse(t + 1.1, working ? 3.1 : 5.3, 0.5) * 0.7);
  paintArsenalFlag(f, a.flag, t, working);
  f.draw(ctx);
}

function iconArsenal() {
  const p = new Pix(16, 16);
  // lanças cruzadas atrás do escudo
  for (const [x0, y0, x1, y1] of [[2, 14, 12, 4], [13, 14, 3, 4]]) {
    p.line(x0, y0, x1, y1, PAL.wood[3]);
    const dx = Math.sign(x1 - x0);
    p.set(x1 + dx, y1 - 1, PAL.steel[4]);
    p.set(x1 + dx * 2, y1 - 2, PAL.steel[5]);
    p.set(x1 + dx, y1 - 2, PAL.steel[3]);
    p.set(x1 + dx * 2, y1 - 1, PAL.steel[3]);
  }
  const half = heaterHalf(9, 10, 4);
  p.fill(3, 4, 13, 14, (x, y) => Math.abs(x - 8) <= half(y) && y < 14, (x, y) => {
    const dx = x + 0.5 - 8;
    if (Math.abs(dx) > half(y + 0.5) - 1 || y === 4) return PAL.gold[dx < 0 ? 4 : 2];
    const chev = y + 0.5 - (7 + Math.abs(dx) * 0.9);
    if (chev >= 0 && chev < 1.6) return PAL.gold[dx < 0 ? 5 : 3];
    return PAL.banner[dx < -1 ? 3 : 2];
  });
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Quartel

const BK_TARGET = [55, 46]; // centro do alvo
const BK_DUMMY = [11, 61]; // pé do boneco da frente
const BK_SHOOT = [-4, 40]; // de onde vêm as flechas, fora do quadro
const BK_CHIMNEY = [26, 6];
const BK_WINDOWS = [[5, 30], [24, 30]];

function buildBarracksBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 34, PAL.dusk, 2.4);
  // morros roxos
  for (let x = 0; x < 64; x++) {
    const top = Math.round(24 + 2 * Math.sin(x * 0.12 + 2) + Math.sin(x * 0.45));
    for (let y = top; y < 34; y++) p.set(x, y, pick(PURPLE_HILLS, (y === top ? 0.9 : 0.6) - (y - top) * 0.05, x, y, 2));
  }
  // paliçada de troncos pontudos
  for (let x = 0; x < 64; x++) {
    const log = Math.floor(x / 3), i = x % 3;
    const top = 27 + Math.floor(hash(log, 0, 31) * 3);
    for (let y = top; y < 42; y++) {
      if (y === top && i !== 1) continue;
      let v = 0.16 + cylLight((i - 1) / 1.6) * 0.5 - (y - top) * 0.008 + (hash(x, y >> 1, 32) - 0.5) * 0.1;
      if (y === top || (y === top + 1 && i === 0)) v += 0.22;
      if (y === 31 || y === 37) v -= 0.22; // amarras
      p.set(x, y, pick(PAL.wood, v, x, y));
    }
  }
  // pátio de terra batida, pisoteado
  for (let y = 41; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.4 + (y - 41) * 0.012 + (hash(x, y, 33) - 0.5) * 0.2;
      if (hash(x >> 1, y, 34) < 0.05) v -= 0.18;
      if (y < 43) v -= 0.22 - (y - 41) * 0.08; // sombra da paliçada
      p.set(x, y, pick(PAL.dirt, v, x, y, 1.6));
    }
  }
  // tufos de capim junto da cerca e palha espalhada
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(hash(i, 1, 35) * 64), y = 42 + Math.floor(hash(i, 2, 35) * 2);
    p.set(x, y, DUSK_GRASS[4]);
    p.set(x + 1, y - 1, DUSK_GRASS[5]);
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(hash(i, 3, 35) * 64), y = 47 + Math.floor(hash(i, 4, 35) * 17);
    p.set(x, y, PAL.straw[3]);
    p.set(x + 1, y + (i % 3 === 0 ? 1 : 0), PAL.straw[2]);
  }
  // sombras do alvo e dos bonecos
  for (const [cx, cy, rx] of [[BK_TARGET[0], 59, 7], [BK_DUMMY[0] + 1, 61, 5], [31, 51, 3.5]]) {
    p.fill(cx - rx, cy - 1, cx + rx, cy + 1, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / 1.4) ** 2 <= 1, () => PAL.dirt[1]);
  }
  return p;
}

const BURLAP = ramp('#33251a', '#58422e', '#7e6446', '#a68a62', '#c8ae82', '#e2d0a6');

// Boneco de treino de palha num poste: saco de palha amarrado na cintura, braços de
// palha caídos, cabeça de saco e, no da frente, chapéu de ferro e escudinho. s é a escala.
function drawDummy(p, cx, base, s, seed, armed) {
  const S = (v) => Math.round(v * s);
  // poste
  p.rect(cx - 1, base - S(10), 2, S(10), (x) => PAL.wood[x === cx - 1 ? 3 : 1]);
  // braços de palha, com as pontas desfiadas
  for (const d of [-1, 1]) {
    const x0 = cx + d * S(3), y0 = base - S(18), x1 = cx + d * S(7), y1 = base - S(13);
    p.line(x0, y0, x1, y1, PAL.straw[d < 0 ? 4 : 2]);
    p.line(x0, y0 + 1, x1, y1 + 1, PAL.straw[d < 0 ? 3 : 1]);
    p.set(x1 + d, y1 + 1, PAL.straw[d < 0 ? 4 : 3]);
    p.set(x1, y1 + 2, PAL.straw[2]);
    p.set(x1 + d, y1 + 2, PAL.straw[1]);
  }
  // corpo: saco de palha mais largo no peito, amarrado na cintura
  const top = base - 19 * s, bot = base - 9 * s;
  const half = (y) => {
    const r = (y - top) / (bot - top);
    return (r < 0.15 ? 2.8 + r * 8 : 4 - r * 1.1) * s - (r > 0.55 && r < 0.68 ? 0.7 * s : 0);
  };
  p.fill(cx - 5 * s, top, cx + 5 * s, bot, (x, y) => y < bot && Math.abs(x - cx) <= half(y), (x, y) => {
    const nx = (x + 0.5 - cx) / (4 * s);
    let v = 0.1 + cylLight(nx) * 0.72 + (hash(x, y >> 1, seed) - 0.5) * 0.2 - ((y - top) / (bot - top)) * 0.08;
    if ((x + (y >> 2)) % 2 === 0) v -= 0.1; // fios de palha
    const r = (y + 0.5 - top) / (bot - top);
    if (r > 0.55 && r < 0.68) return PAL.leather[nx < 0 ? 3 : 1]; // corda na cintura
    return pick(PAL.straw, v, x, y, 1.6);
  });
  for (let x = Math.ceil(cx - 3 * s); x < cx + 3 * s; x++) if (x % 2) p.set(x, Math.round(bot), PAL.straw[x < cx ? 3 : 1]);
  // cabeça de saco amarrada no pescoço, cara costurada
  const hy = base - 22.5 * s, hr = 3 * s;
  p.fill(cx - hr, hy - hr, cx + hr, hy + hr, (x, y) => ((x - cx) / hr) ** 2 + ((y - hy) / hr) ** 2 <= 1, (x, y) =>
    pick(BURLAP, 0.3 + sphereLight((x + 0.5 - cx) / hr, (y + 0.5 - hy) / hr) * 0.75 + ((x + y) % 2 ? 0 : -0.06), x, y));
  p.rect(cx - 1, Math.round(hy + hr) - 1, 3, 1, PAL.leather[2]);
  p.set(cx - 1, Math.round(hy), BURLAP[0]);
  p.set(cx + 1, Math.round(hy), BURLAP[0]);
  p.set(cx, Math.round(hy + 1.5), BURLAP[1]);
  const ht = Math.round(hy - hr);
  if (armed) {
    // chapéu de ferro com aba
    p.rect(cx - 4, ht + 1, 9, 1, (x) => PAL.steel[x < cx - 1 ? 4 : x < cx + 2 ? 3 : 1]);
    p.fill(cx - 3, ht - 2, cx + 3, ht + 1, (x, y) => ((x + 0.5 - cx - 0.5) / 2.9) ** 2 + ((y + 0.5 - ht - 1) / 2.6) ** 2 <= 1 && y <= ht, (x, y) =>
      pick(PAL.steel, 0.15 + sphereLight((x + 0.5 - cx - 0.5) / 2.9, (y + 0.5 - ht) / 2.6) * 0.9, x, y));
    // escudinho redondo de tábuas na mão esquerda
    const sx = cx - 8, sy = base - 12;
    p.fill(sx - 3, sy - 3, sx + 3, sy + 3, (x, y) => Math.hypot(x - sx, y - sy) <= 2.8, (x, y) => {
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d < 0.9) return PAL.iron[4];
      if (d > 2.1) return PAL.iron[x < sx ? 3 : 1];
      return pick(PAL.wood, 0.3 + sphereLight((x + 0.5 - sx) / 2.8, (y + 0.5 - sy) / 2.8) * 0.6 - (x % 2 ? 0.1 : 0), x, y);
    });
  } else {
    // gorro de couro velho
    p.fill(cx - 3, ht - 1, cx + 3, ht + 2, (x, y) => ((x + 0.5 - cx) / 2.9) ** 2 + ((y + 0.5 - ht - 1.5) / 2.4) ** 2 <= 1 && y <= ht + 1, (x, y) =>
      pick(PAL.leather, 0.2 + sphereLight((x + 0.5 - cx) / 2.9, (y + 0.5 - ht) / 2.4) * 0.85, x, y));
    p.set(cx - 2, ht + 1, PAL.leather[1]);
  }
}

function buildDummyPix() {
  const p = new Pix(20, 28);
  drawDummy(p, 11, 27, 1, 51, true);
  p.outline(PAL.out);
  return p;
}

function buildBarracks() {
  const p = new Pix(64, 64);

  // alojamento: paredes de troncos deitados
  p.fill(1, 26, 34, 41, () => true, (x, y) => {
    const ry = (y - 26) % 3;
    let v = 0.42 + (ry === 0 ? 0.18 : ry === 2 ? -0.22 : 0) + (hash(x >> 2, Math.floor((y - 26) / 3), 41) - 0.5) * 0.12 - x * 0.005;
    if (y < 29) v -= 0.2; // sombra do beiral
    return pick(PAL.wood, v, x, y);
  });
  // pontas dos troncos nas quinas
  for (let y = 26; y < 41; y += 3) {
    for (const [x, d] of [[0, -1], [34, 1]]) {
      p.set(x, y, C('#c9a070'));
      p.set(x, y + 1, PAL.wood[d < 0 ? 3 : 2]);
    }
  }
  // telhado de tabuinhas, de quatro águas
  const hipL = (y) => 4 - (y - 12) * (6 / 15.5), hipR = (y) => 30 + (y - 12) * (6 / 15.5);
  p.poly([[-2, 27.5], [4, 12], [30, 12], [36, 27.5]], (x, y) => {
    const row = Math.floor((y - 12) / 3), ry = (y - 12) % 3;
    const off = (row % 2) * 2;
    let v = 0.5 - x * 0.004 + (hash(Math.floor((x + off) / 4), row, 42) - 0.5) * 0.2;
    if (ry === 2) v -= 0.26;
    else if (ry === 0) v += 0.08;
    if ((x + off) % 4 === 0) v -= 0.12;
    if (x + 0.5 < hipL(y + 0.5)) v += 0.2;
    else if (x + 0.5 > hipR(y + 0.5)) v -= 0.24;
    if (y === 27) v -= 0.22;
    return pick(SHINGLE, v, x, y, 2.4);
  });
  p.rect(4, 11, 27, 2, (x, y) => SHINGLE[y === 11 ? (x % 3 ? 5 : 4) : 3]);
  for (let y = 12; y < 28; y++) {
    p.set(Math.round(hipL(y + 0.5)), y, SHINGLE[5]);
    p.set(Math.round(hipR(y + 0.5)), y, SHINGLE[1]);
  }
  // chaminé de pedra
  const [chx, chy] = BK_CHIMNEY;
  p.rect(chx - 2, chy + 1, 4, 9, (x, y) => pick(PAL.stone, (x === chx - 2 ? 0.75 : x === chx + 1 ? 0.25 : 0.5) - (y % 3 === 0 ? 0.15 : 0) + (hash(x, y, 43) - 0.5) * 0.14, x, y));
  p.rect(chx - 3, chy, 6, 2, (x, y) => PAL.stone[y === chy ? 4 : 2]);
  p.rect(chx - 1, chy, 2, 1, INSIDE[0]);
  // porta de tábuas com ferragens
  p.rect(15, 33, 7, 8, PAL.wood[0]);
  p.rect(16, 34, 5, 7, (x, y) => pick(PAL.wood, 0.62 - (x - 16) * 0.07 - ((x - 16) % 2 ? 0.14 : 0), x, y));
  for (const y of [35, 38]) p.rect(16, y, 4, 1, PAL.iron[1]);
  p.set(20, 37, PAL.gold[4]);
  p.rect(14, 32, 9, 1, (x) => PAL.wood[x < 18 ? 4 : 3]);
  // escudo do quartel sobre a porta
  ['#####', '#####', '.###.', '..#..'].forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== '#') return;
    const edge = j === 0 || i === 0 || i === 4 || (j === 2 && (i === 1 || i === 3)) || j === 3;
    p.set(16 + i, 28 + j, edge ? PAL.gold[i < 2 ? 4 : 2] : PAL.banner[i < 2 ? 3 : 2]);
  }));
  // janelas acesas, com venezianas abertas
  for (const [wx, wy] of BK_WINDOWS) {
    p.rect(wx, wy, 4, 4, INSIDE[1]);
    p.rect(wx + 1, wy + 1, 2, 3, PAL.fire[2]);
    p.set(wx + 1, wy + 1, PAL.fire[3]);
    p.rect(wx - 2, wy, 2, 4, (x) => PAL.wood[x === wx - 2 ? 4 : 3]);
    p.rect(wx + 4, wy, 2, 4, (x) => PAL.wood[x === wx + 4 ? 2 : 1]);
    p.rect(wx - 1, wy + 4, 6, 1, PAL.wood[4]);
  }
  // banco com um elmo e uma tina d'água
  p.rect(24, 38, 9, 1, (x) => PAL.wood[x < 28 ? 4 : 3]);
  p.rect(25, 39, 1, 2, PAL.wood[1]);
  p.rect(31, 39, 1, 2, PAL.wood[1]);
  p.sphere(28.5, 37, 2.2, 1.9, PAL.steel, 0);
  p.rect(26, 37, 6, 1, (x) => PAL.steel[x < 29 ? 3 : 2]);
  p.rect(2, 36, 5, 5, (x, y) => (y === 37 || y === 39 ? PAL.iron[1] : pick(PAL.wood, 0.2 + cylLight((x + 0.5 - 4.5) / 2.5) * 0.6, x, y)));
  p.rect(3, 36, 3, 1, PAL.water[2]);

  // mastro preso na quina do telhado
  p.rect(3, 1, 1, 16, (x, y) => (y === 1 ? PAL.gold[5] : PAL.iron[y < 8 ? 3 : 2]));

  // suporte de armas junto da paliçada
  p.rect(37, 33, 1, 12, PAL.wood[3]);
  p.rect(46, 33, 1, 12, PAL.wood[2]);
  p.rect(37, 36, 10, 1, (x) => PAL.wood[x < 41 ? 4 : 3]);
  p.rect(37, 42, 10, 1, PAL.wood[2]);
  for (const [x0, x1, top] of [[38, 39, 28], [40, 41, 30], [42, 43, 27], [44, 45, 29]]) {
    p.line(x0, 44, x1, top + 2, (x, y) => PAL.wood[y % 3 ? 3 : 2]);
    p.set(x1, top + 1, PAL.steel[4]);
    p.set(x1, top, PAL.steel[5]);
    p.set(x1 - 1, top + 1, PAL.steel[3]);
  }
  // espada de treino de madeira e um escudo encostados
  p.line(39, 44, 41, 37, PAL.wood[4]);
  p.rect(38, 39, 4, 1, PAL.wood[2]);
  p.fill(41, 38, 47, 45, (x, y) => ((x - 44.5) / 2.4) ** 2 + ((y - 41.5) / 2.9) ** 2 <= 1, (x, y) =>
    (Math.abs(x + 0.5 - 44.5) < 0.6 ? PAL.gold[y < 41 ? 4 : 3] : pick(HERALD, 0.25 + sphereLight((x + 0.5 - 44.5) / 2.4, (y + 0.5 - 41.5) / 2.9) * 0.8, x, y)));

  // alvo de palha trançada no cavalete
  const [tx, ty] = BK_TARGET;
  for (const [x0, x1] of [[tx - 3, tx - 6], [tx + 3, tx + 6]]) p.line(x0, ty + 4, x1, 59, PAL.wood[x0 < tx ? 3 : 2]);
  p.line(tx, ty + 5, tx, 58, PAL.wood[1]);
  p.rect(tx - 4, 55, 9, 1, PAL.wood[2]);
  p.fill(tx - 7, ty - 7, tx + 7, ty + 7, (x, y) => Math.hypot(x - tx, (y - ty) * 1.05) <= 6.6, (x, y) => {
    const d = Math.hypot(x + 0.5 - tx, (y + 0.5 - ty) * 1.05);
    const l = sphereLight((x + 0.5 - tx) / 7, (y + 0.5 - ty) / 7);
    if (d > 5.4) return pick(PAL.straw, 0.15 + l * 0.8 - ((Math.atan2(y - ty, x - tx) * 4 + 8) % 1 < 0.3 ? 0.15 : 0), x, y);
    if (d > 4.2) return pick(LINEN, 0.3 + l * 0.7, x, y);
    if (d > 3) return pick(PAL.banner, 0.2 + l * 0.8, x, y);
    if (d > 1.8) return pick(LINEN, 0.35 + l * 0.65, x, y);
    return PAL.gold[l > 0.5 ? 4 : 3];
  });

  // boneco do fundo, menor e sem elmo
  drawDummy(p, 30, 51, 0.8, 52, false);

  p.outline(PAL.out);
  return p;
}

// Bandeira do quartel: vermelha com uma faixa dourada e a ponta recortada.
const barracksFlag = (i, j) => {
  if (i === 10 && j >= 2 && j <= 3) return null;
  if (i === 9 && j >= 2 && j <= 3) return [PAL.banner, 0.4];
  if (j === 2 || j === 3) return [PAL.gold, 0.66];
  return [PAL.banner, 0.6 - Math.abs(j - 2.5) * 0.06];
};

function paintBarracksFlag(f, q, t, working) {
  paintFlag(f, q, 3, 2, 11, 6, t * (working ? 6.5 : 4), 1.6, barracksFlag);
}

// Flecha na direção (dx, dy), com a ponta em (x, y): haste, ponta de aço e penas.
function paintArrow(f, x, y, dx, dy, len) {
  const n = Math.hypot(dx, dy);
  dx /= n; dy /= n;
  for (let k = 1; k < len; k++) {
    f.set(x - dx * k, y - dy * k + 1, PAL.out);
    f.set(x - dx * k, y - dy * k, PAL.wood[k % 2 ? 4 : 3]);
  }
  f.set(x, y, PAL.steel[5]);
  const bx = x - dx * len, by = y - dy * len;
  f.set(bx, by - 1, LINEN[4]);
  f.set(bx - 1, by - 1, LINEN[3]);
  f.set(bx, by + 1, PAL.banner[3]);
  f.set(bx - 1, by + 1, PAL.banner[2]);
  f.set(bx, by, PAL.wood[4]);
}

const barracksArt = { bg: null, frame: new Pix(64, 64), flag: new Pix(14, 14) };

function paintBarracksPortrait(ctx, t, info) {
  const a = barracksArt;
  if (!a.bg) {
    a.bg = buildBarracksBackdrop();
    a.body = buildBarracks();
    a.dummy = buildDummyPix();
    a.clouds = [makeCloud(16, 6, 4, PAL.duskCloud), makeCloud(12, 5, 9, PAL.duskCloud)];
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 1.2) % 88) - 18), 4);
  f.blit(a.clouds[1], Math.floor(((t * 0.8 + 40) % 82) - 14), 15);
  for (let k = 0; k < 2; k++) {
    const u = (t * 0.04 + k * 0.13) % 1;
    paintBird(f, 72 - u * 84 + k * 5, 6 + k * 3 + Math.sin(t * 0.9 + k) * 1.3, Math.sin(t * 9.5 + k * 2));
  }
  paintSmoke(f, t, BK_CHIMNEY[0], BK_CHIMNEY[1] - 1, working ? 0.3 : 0.18, 12, 13, 0.85, 0);
  f.blit(a.body, 0, 0);
  // luz das janelas tremendo
  BK_WINDOWS.forEach(([wx, wy], k) => {
    const fl = Math.sin(t * 7 + k * 2) * 0.5 + Math.sin(t * 12.3 + k) * 0.5;
    f.set(wx + 2, wy + 2, PAL.fire[fl > 0 ? 4 : 3]);
    f.set(wx + 1, wy + 3, PAL.fire[fl > 0.4 ? 3 : 2]);
  });
  // flechas: chegam de fora do quadro e cravam no alvo; as três últimas ficam lá
  const period = working ? 1.5 : 3.2, flight = 0.42;
  const n = Math.floor(t / period), u = (t % period) / flight;
  const [tx, ty] = BK_TARGET;
  const hit = (k) => {
    const ang = hash(k, 1, 61) * Math.PI * 2, r = Math.sqrt(hash(k, 2, 61)) * 3.6;
    return [Math.round(tx + Math.cos(ang) * r), Math.round(ty + Math.sin(ang) * r)];
  };
  for (let j = 3; j >= 0; j--) {
    const k = n - j;
    if (k < 0 || (j === 0 && u < 1)) continue;
    const [hx, hy] = hit(k);
    paintArrow(f, hx, hy, hx - BK_SHOOT[0], hy - BK_SHOOT[1] + 6, 6);
  }
  if (u < 1) {
    const [hx, hy] = hit(n);
    const x = BK_SHOOT[0] + (hx - BK_SHOOT[0]) * u;
    const y = BK_SHOOT[1] + (hy - BK_SHOOT[1]) * u - Math.sin(u * Math.PI) * 5;
    paintArrow(f, x, y, hx - BK_SHOOT[0], hy - BK_SHOOT[1] - Math.cos(u * Math.PI) * 15.7, 6);
  } else {
    // palha voando do impacto
    const since = (u - 1) * flight;
    if (since < 0.3) {
      const [hx, hy] = hit(n);
      for (let k = 0; k < 4; k++) f.set(hx - 1 + (k - 1.5) * since * 14, hy - since * 10 + since * since * 50 * (k % 2), PAL.straw[k % 2 ? 4 : 5]);
    }
  }
  // boneco da frente balançando no poste com o vento
  const sway = Math.sin(t * 1.3) * 0.6 + Math.sin(t * 3.1) * 0.25 * (working ? 1 : 0.4);
  const d = a.dummy;
  const dx0 = BK_DUMMY[0] - 11, dy0 = BK_DUMMY[1] - 27;
  for (let y = 0; y < d.h; y++) {
    const off = Math.round(sway * (1 - y / 17));
    for (let x = 0; x < d.w; x++) {
      const c = d.d[y * d.w + x];
      if (c) f.set(dx0 + x + (y < 17 ? off : 0), dy0 + y, c);
    }
  }
  paintBarracksFlag(f, a.flag, t, working);
  f.draw(ctx);
}

function iconBarracks() {
  const p = new Pix(16, 16);
  // cavalete
  p.line(4, 10, 2, 15, PAL.wood[3]);
  p.line(11, 10, 13, 15, PAL.wood[2]);
  // alvo
  p.fill(1, 0, 15, 13, (x, y) => Math.hypot(x - 7.5, y - 6.5) <= 6.4, (x, y) => {
    const d = Math.hypot(x + 0.5 - 7.5, y + 0.5 - 6.5);
    const lit = x + y < 13;
    if (d > 5.2) return PAL.straw[lit ? 4 : 2];
    if (d > 3.9) return LINEN[lit ? 4 : 3];
    if (d > 2.6) return PAL.banner[lit ? 3 : 2];
    if (d > 1.4) return LINEN[lit ? 4 : 3];
    return PAL.gold[4];
  });
  // flecha cravada no meio
  p.line(8, 6, 13, 2, PAL.wood[4]);
  p.set(14, 1, LINEN[4]);
  p.set(13, 1, PAL.banner[3]);
  p.set(14, 2, PAL.banner[2]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Torre de vigia

const WT_CX = 34.5;
const WT_FIRE = [28.5, 18]; // base da chama no braseiro
const WT_FAR = [56, 39]; // torre distante que responde ao sinal
const wtHill = (x) => 50.5 + ((x + 0.5 - WT_CX) / 30) ** 2 * 10;

function buildWatchtowerBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 50, PAL.dusk, 2.6);
  paintSun(p, 10, 44, 5);
  // faixas de nuvem compridas, acesas por baixo
  for (const [cx, cy, w, seed] of [[42, 18, 18, 3], [14, 27, 14, 5], [54, 31, 10, 7]]) {
    p.fill(cx - w, cy - 2, cx + w, cy + 1, (x, y) => {
      const r = Math.abs(x - cx) / w;
      const top = cy - 1.6 * (1 - r * r) + hash(Math.floor(x / 3), 0, seed) * 0.8;
      return r < 1 && y >= top && y < cy + 0.8;
    }, (x, y) => pick(PAL.duskCloud, (y >= cy ? 0.75 : 0.35) + (1 - Math.abs(x - cx) / w) * 0.2 + (hash(x, y, seed) - 0.5) * 0.1 - (x - 10) * 0.004, x, y, 1.8));
  }
  // serra roxa ao longe, com a torre distante
  for (let x = 0; x < 64; x++) {
    const top = Math.round(42 + 2.2 * Math.sin(x * 0.15 + 0.8) + Math.sin(x * 0.4) - (x > 48 && x < 62 ? Math.sin((x - 48) / 14 * Math.PI) * 3 : 0));
    for (let y = top; y < 64; y++) p.set(x, y, pick(PURPLE_HILLS, (y === top ? 0.95 : 0.62) - (y - top) * 0.04 - (x - 10) * 0.004, x, y, 2));
  }
  const [fx, fy] = WT_FAR;
  p.rect(fx - 1, fy - 5, 3, 6, (x) => PURPLE_HILLS[x === fx - 1 ? 2 : 0]);
  p.rect(fx - 2, fy - 6, 5, 1, PURPLE_HILLS[0]);
  // mata escura no vale
  for (let x = 0; x < 64; x++) {
    const top = Math.round(49 + Math.sin(x * 0.8) * 0.8 + hash(x, 0, 71) * 1.6);
    for (let y = top; y < 64; y++) p.set(x, y, pick(FAR_DUSK, 0.45 - (y - top) * 0.06 + (hash(x, y, 72) - 0.5) * 0.3 - (x - 10) * 0.004, x, y));
  }
  return p;
}

function buildWatchtower(glow = 0) {
  const p = new Pix(64, 64);
  const [fx, fy] = WT_FIRE;
  const L = (x, y) => (0.25 + glow * 0.3) * clamp01(1 - Math.hypot(x + 0.5 - fx, (y + 0.5 - fy + 2) * 0.9) / 13) ** 1.3;

  // colina com o capim pegando o último sol pela esquerda
  p.fill(0, 44, 63, 63, (x, y) => y + 0.5 >= wtHill(x), (x, y) => {
    let v = 0.06 + sphereLight((x + 0.5 - 28) / 44, (y + 0.5 - 80) / 32) * 0.85 - (y - 52) * 0.008;
    if (y + 0.5 < wtHill(x) + 1) v += 0.16;
    if (hash(x, y, 81) < 0.08) v += 0.22;
    else if (hash(x, y - 1, 81) < 0.08) v -= 0.18;
    return pick(DUSK_GRASS, v, x, y, 1.6);
  });
  // trilha subindo até a porta
  for (let y = 52; y < 64; y++) {
    const k = y - 52;
    const c = WT_CX + Math.sin(k * 0.4) * 2 + k * 0.5;
    const hw = 1.2 + k * 0.18;
    for (let x = Math.floor(c - hw); x <= c + hw; x++) {
      const edge = Math.abs(x + 0.5 - c) > hw - 0.8;
      p.set(x, y, pick(PAL.dirt, 0.5 + (hash(x, y, 82) - 0.5) * 0.3 - (edge ? 0.2 : 0) - (x + 0.5 - c) * 0.05, x, y));
    }
  }
  // pedras e moitas
  for (const [x, y, r] of [[13, 58, 2.2], [52, 57, 1.8], [22, 61, 1.6]]) p.sphere(x, y, r, r * 0.75, STONE_WARM, 0.05);
  for (const [x, y, r] of [[5, 60, 3], [59, 59, 2.8], [45, 62, 2.2]]) p.sphere(x, y, r, r * 0.8, DUSK_GRASS, -0.05, 1.6);

  // fuste redondo de pedra, mais largo na base
  const hw = (y) => 5.6 + (y - 31) * 0.04;
  p.fill(26, 31, 43, 55, (x, y) => y >= 31 && Math.abs(x + 0.5 - WT_CX) <= hw(y + 0.5) && y + 0.5 < wtHill(x) + 1.5, (x, y) => {
    const nx = (x + 0.5 - WT_CX) / hw(y + 0.5);
    let v = 0.04 + cylLight(nx) * 0.88 + masonry(x, y, 4, 3, 83, 31) * 0.9 + L(x, y);
    if (y > 50) v -= (y - 50) * 0.05;
    return pick(STONE_WARM, v, x, y);
  });
  // porta em arco e seteiras
  p.fill(32, 44, 37, 52, archTest(WT_CX, 2.6, 44, 52), (x) => PAL.stone[x < 34 ? 4 : 2]);
  p.fill(33, 45, 36, 52, archTest(WT_CX, 1.7, 45.5, 52), (x, y) => pick(PAL.wood, 0.45 - (x - 33) * 0.1 - (y === 48 ? 0.2 : 0), x, y));
  p.set(35, 49, PAL.gold[3]);
  for (const [sx, sy] of [[34, 34], [31, 40], [37, 39]]) {
    p.rect(sx, sy, 1, 3, INSIDE[0]);
    p.set(sx, sy + 1, INSIDE[2]);
    p.set(sx - 1, sy - 1, PAL.stone[sx < 34 ? 4 : 3]);
  }
  // mísulas de pedra segurando o balcão
  for (let x = 26; x <= 42; x++) {
    const corbel = (x - 26) % 4 < 2;
    for (let y = 29; y < 32; y++) {
      if (!corbel && y > 29) continue;
      if (corbel && y === 31 && Math.abs(x + 0.5 - WT_CX) > hw(31)) continue;
      p.set(x, y, pick(STONE_WARM, (y === 29 ? 0.7 : 0.45) + (x < 31 ? 0.15 : x > 38 ? -0.2 : 0) + L(x, y), x, y));
    }
  }
  // balcão de tábuas (galeria de madeira), com frestas
  p.fill(25, 22, 44, 28, () => true, (x, y) => {
    let v = 0.42 + (hash(x >> 1, 0, 84) - 0.5) * 0.14 - ((x + 0.5 - WT_CX) / 10) * 0.22 + L(x, y) * 1.4;
    if (x % 2 === 0) v -= 0.12;
    if (y === 28) v -= 0.2;
    if (y === 25 && x % 5 === 2) return INSIDE[0];
    return pick(PAL.wood, v, x, y);
  });
  p.rect(24, 22, 22, 1, (x) => pick(PAL.wood, 0.78 - (x - 24) * 0.02 + L(x, 22), x, 22));
  for (let x = 24; x <= 45; x += 3) p.set(x, 23, PAL.wood[1]); // ponta das vigas do piso
  // parapeito: postes e corrimão
  for (const x of [25, 31, 38, 44]) p.rect(x, 16, 1, 6, (xx, y) => pick(PAL.wood, 0.55 + L(xx, y) * 1.4 - (x > 34 ? 0.2 : 0), xx, y));
  for (const y of [16, 19]) p.rect(25, y, 20, 1, (x) => pick(PAL.wood, (y === 16 ? 0.62 : 0.4) - (x - 25) * 0.012 + L(x, y) * 1.4, x, y));

  // sentinela de pé, olhando o horizonte, com capa azul
  const sx = 35;
  p.fill(31, 13, 40, 22, (x, y) => y >= 13 && Math.abs(x + 0.5 - sx) <= 3.2 + (y - 13) * 0.3 && y < 22, (x, y) =>
    pick(HERALD, 0.25 + ((sx - x) / 5) * 0.25 + (y === 13 ? 0.2 : 0) + L(x, y), x, y));
  for (let y = 14; y < 19; y++) p.set(sx, y, PAL.gold[y === 14 ? 4 : 3]);
  // rosto de perfil, virado para a direita
  p.rect(sx - 1, 10, 3, 3, (x, y) => pick(PAL.skin, 0.5 + (x - sx) * 0.12 + L(x, y), x, y));
  p.set(sx + 2, 11, PAL.skin[3]);
  p.set(sx + 1, 11, PAL.iris);
  p.set(sx - 1, 12, PAL.beard[2]);
  p.set(sx, 12, PAL.beard[2]);
  // elmo cônico com nasal
  p.rect(sx - 2, 9, 5, 1, (x) => PAL.steel[x < sx ? 4 : 2]);
  p.rect(sx - 1, 8, 3, 1, (x) => PAL.steel[x < sx ? 5 : 3]);
  p.set(sx, 7, PAL.steel[4]);
  p.set(sx + 2, 10, PAL.steel[3]);
  // mão e lança do lado de fora
  const lx = 40;
  p.rect(lx, 8, 1, 14, (x, y) => PAL.wood[y % 3 ? 3 : 2]);
  p.set(lx, 5, PAL.steel[5]);
  p.set(lx, 6, PAL.steel[4]);
  p.set(lx - 1, 7, PAL.steel[4]);
  p.set(lx, 7, PAL.steel[3]);
  p.set(lx + 1, 7, PAL.steel[2]);
  p.set(lx - 1, 15, PAL.skin[3]);
  p.set(lx - 1, 16, PAL.skin[2]);
  // braseiro de ferro no canto
  p.rect(fx - 0.5, fy + 1, 1, 4, PAL.iron[1]);
  p.fill(fx - 3, fy - 1, fx + 3, fy + 1, (x, y) => Math.abs(x + 0.5 - fx) <= 3 - (y - fy + 1) * 0.6, (x, y) =>
    pick(PAL.iron, (y === fy - 1 ? 0.65 : 0.3) - (x - fx) * 0.05 + L(x, y), x, y));
  p.rect(fx - 2, fy - 1, 4, 1, (x) => PAL.fire[x % 2 ? 3 : 2]);
  // mastro da bandeira no poste do canto
  p.rect(44, 4, 1, 12, (x, y) => (y === 4 ? PAL.gold[5] : PAL.iron[y < 9 ? 3 : 2]));

  p.outline(PAL.out);
  return p;
}

const watchFlag = (i, j) => {
  if (i >= 9 && j === 2) return null;
  if (j === 0 || j === 4) return [PAL.gold, 0.66];
  return [PAL.banner, 0.62 - j * 0.04];
};

function paintWatchFlag(f, q, t, working) {
  paintFlag(f, q, 44, 5, 10, 5, t * (working ? 6.8 : 4.2), 1.5, watchFlag);
}

const watchArt = { bg: null, frame: new Pix(64, 64), flag: new Pix(14, 12) };

function paintWatchtowerPortrait(ctx, t, info) {
  const a = watchArt;
  if (!a.bg) {
    a.bg = buildWatchtowerBackdrop();
    a.body = buildWatchtower(0);
    const [fx, fy] = WT_FIRE;
    a.glow = makeHalo(a.body, buildWatchtower(1), (x, y) => Math.hypot(x + 0.5 - fx, (y + 0.5 - fy + 2) * 0.9) / 16);
    a.clouds = [makeCloud(15, 5, 6, PAL.duskCloud), makeCloud(11, 5, 2, PAL.duskCloud)];
  }
  const working = info.working;
  const live = working ? 1 : 0.6;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 0.9) % 84) - 16), 6);
  f.blit(a.clouds[1], Math.floor(((t * 0.6 + 30) % 76) - 12), 34);
  // gaivotas passando longe
  for (let k = 0; k < 3; k++) {
    const u = (t * 0.03 + k * 0.08) % 1;
    paintBird(f, -6 + u * 76 - k * 3, 30 - u * 6 + k * 2 + Math.sin(t * 0.7 + k) * 1.2, Math.sin(t * 8 + k * 1.9));
  }
  // a torre distante responde ao sinal
  const [dfx, dfy] = WT_FAR;
  const answer = working ? 0.6 + Math.sin(t * 7.3) * 0.25 + Math.sin(t * 13.1) * 0.15 : 0.25 + Math.sin(t * 3) * 0.1;
  f.set(dfx, dfy - 7, PAL.fire[answer > 0.5 ? 5 : 4]);
  f.set(dfx, dfy - 8, PAL.fire[answer > 0.7 ? 4 : 3]);
  if (answer > 0.55) { f.set(dfx - 1, dfy - 7, PAL.fire[2]); f.set(dfx + 1, dfy - 7, PAL.fire[2]); }
  // fumaça do sinal subindo e indo com o vento
  const [fx, fy] = WT_FIRE;
  paintSmoke(f, t, fx, fy - 9, working ? 0.3 : 0.2, 26, 22, working ? 1.25 : 1, 1);
  f.blit(a.body, 0, 0);
  const flick = Math.sin(t * 8.3) * 0.5 + Math.sin(t * 13.7 + 1) * 0.3 + Math.sin(t * 2.9) * 0.2;
  paintHalo(f, a.glow, 0.42 + live * 0.14 + flick * 0.08);
  paintFlame(f, fx - 0.5, fy - 1, t, 6 + live * 3, 2.8, live);
  paintEmbers(f, fx, fy - 6, t, working ? 6 : 3, 16, 70);
  paintWatchFlag(f, a.flag, t, working);
  // brilho na ponta da lança
  sparkle(f, 40, 5, pulse(t + 0.4, working ? 2.7 : 4.9, 0.5) * 0.7);
  f.draw(ctx);
}

function iconWatchtower() {
  const p = new Pix(16, 16);
  // fuste de pedra
  p.fill(4, 8, 12, 15, (x, y) => Math.abs(x + 0.5 - 8) <= 2.7 + (y - 8) * 0.12, (x, y) =>
    pick(STONE_WARM, 0.1 + cylLight((x + 0.5 - 8) / 3.3) * 0.85 - (y % 3 === 0 ? 0.14 : 0), x, y));
  p.rect(7, 12, 2, 4, (x) => PAL.wood[x === 7 ? 3 : 1]);
  p.set(8, 9, INSIDE[0]);
  // balcão de madeira com parapeito
  p.rect(3, 6, 10, 2, (x, y) => PAL.wood[y === 6 ? (x < 8 ? 4 : 3) : x < 8 ? 2 : 1]);
  p.rect(3, 4, 1, 2, PAL.wood[3]);
  p.rect(12, 4, 1, 2, PAL.wood[2]);
  // fogo de sinal no braseiro
  p.rect(5, 5, 4, 1, PAL.iron[2]);
  for (const [y, x0, x1, k] of [[0, 7, 7, 3], [1, 6, 7, 3], [2, 6, 8, 4], [3, 5, 8, 4], [4, 5, 8, 5]]) {
    for (let x = x0; x <= x1; x++) p.set(x, y, PAL.fire[x === x0 && k > 3 ? k - 1 : k]);
  }
  p.set(7, 3, PAL.fire[5]);
  // bandeirinha
  p.rect(12, 0, 1, 4, PAL.iron[2]);
  p.rect(13, 0, 3, 2, (x, y) => PAL.banner[y === 0 ? 3 : 2]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Cavaleiro

const KX = 32.5; // eixo do rosto
const K_TORCH = [9, 30];
// Penas da pluma: [caminho, meia largura, rampa, ajuste de tom], da de trás para a da frente.
const K_PLUMES = [
  [[[33, 11], [37, 9.4], [42, 8.6], [47, 9.8], [50.6, 13.8], [51.6, 19.6]], 1.5, PLUME, -0.12],
  [[[33, 11], [36, 7], [41, 4.6], [47, 4.8], [52, 8.4], [54.6, 14.5], [55.2, 21]], 1.7, LINEN, 0.04],
  [[[33, 11], [34.6, 5.6], [39, 1.8], [46, 1], [52, 3.6], [56.6, 9.2], [58.6, 16.5]], 1.9, PLUME, 0.1],
];

function buildKnightBackdrop(glow) {
  const p = new Pix(64, 64);
  const [tx, ty] = K_TORCH;
  const light = (x, y) => (0.3 + glow * 0.22) * clamp01(1 - Math.hypot(x + 0.5 - tx, (y + 0.5 - ty) * 0.9) / (20 + glow * 6)) ** 1.5;
  paintSky(p, 0, 26, PAL.dusk, 2.4);
  // muralha do pátio, com ameias recortadas no céu
  for (let x = 0; x < 64; x++) {
    const top = (x + 1) % 9 < 5 ? 17 : 20;
    for (let y = top; y < 64; y++) {
      let v = 0.32 + masonry(x, y, 7, 4, 91, 17) * 0.9 - (y - 17) * 0.006 + light(x, y) + (x < 30 ? 0.04 : 0);
      if (y === top) v += 0.2;
      p.d[y * 64 + x] = pick(STONE_WARM, v, x, y, 2);
    }
  }
  // torre redonda à esquerda, com telhado cônico
  const tc = 6;
  p.fill(0, 10, 13, 63, (x, y) => Math.abs(x + 0.5 - tc) <= 6.5 && y >= 12, (x, y) => {
    const v = 0.06 + cylLight((x + 0.5 - tc) / 6.5) * 0.82 + masonry(x, y, 4, 3, 92) * 0.9 + light(x, y) * 0.7;
    return pick(STONE_WARM, v, x, y);
  });
  p.fill(0, 0, 15, 12, (x, y) => Math.abs(x + 0.5 - tc) <= (y + 0.5) * 0.62 && y < 12, (x, y) => {
    let v = 0.15 + cylLight((x + 0.5 - tc) / Math.max(1, (y + 0.5) * 0.62)) * 0.8;
    if (y % 3 === 2) v -= 0.22;
    return pick(PAL.roof, v, x, y);
  });
  p.rect(0, 11, 14, 1, PAL.roof[0]);
  p.rect(tc - 1, 18, 2, 4, INSIDE[0]);
  p.set(tc - 1, 18, INSIDE[2]);
  // portão em arco ao fundo, à direita
  p.fill(43, 30, 64, 64, archTest(56, 7, 31, 64), (x) => pick(STONE_WARM, 0.72 - (x - 49) * 0.03, x, 0));
  p.fill(45, 32, 64, 64, archTest(56, 5.5, 32.5, 64), (x, y) => pick(INSIDE, 0.12 + (y - 33) * 0.008 + ((x - 45) % 3 === 0 ? -0.06 : 0), x, y));
  // suporte da tocha
  p.rect(tx - 1, ty + 1, 2, 5, (x) => PAL.wood[x === tx - 1 ? 3 : 2]);
  p.rect(tx - 2, ty + 3, 4, 1, (x) => PAL.iron[x < tx ? 3 : 1]);
  p.rect(tx - 1, ty, 2, 1, INSIDE[1]);
  p.set(tx - 1, ty + 6, PAL.iron[2]);
  // vara do estandarte
  p.rect(48, 5, 15, 1, PAL.wood[3]);
  p.rect(48, 6, 15, 1, PAL.wood[1]);
  p.sphere(48, 5.5, 1.3, 1.3, PAL.gold, 0.1);
  p.rect(62, 0, 1, 64, (x, y) => PAL.wood[y % 4 ? 2 : 1]);
  return p;
}

function buildKnightBanner() {
  const w = 13, h = 37;
  return makeBanner(w, h, (put) => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const tail = j > h - 7 && Math.abs(i - 6) < j - (h - 7);
        if (tail) continue;
        const edge = i === 0 || i === w - 1 || j === h - 1 || (j > h - 7 && Math.abs(i - 6) < j - (h - 8));
        if (edge) { put(i, j, OUT_RAMP, 0); continue; }
        const trim = i === 1 || i === w - 2 || j === 0 || (j > h - 8 && Math.abs(i - 6) < j - (h - 9));
        if (trim) put(i, j, PAL.gold, 0.58);
        else put(i, j, HERALD, 0.56 - (i - 6) * 0.025 - j * 0.004);
      }
    }
    LION.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '#') put(1 + i, 15 + j, PAL.gold, 0.85 - j * 0.03 - i * 0.02);
    }));
  });
}

function inKnightHelm(x, y) {
  const dy = (y - 26) / 15.5;
  const rx = 12.6 * (dy < 0 ? 1 - 0.12 * dy * dy : 1 - 0.1 * dy * dy);
  return ((x - KX) / rx) ** 2 + dy * dy <= 1 || (y < 13 && y > 9.5 && Math.abs(x - KX) < 1.6);
}
const inFace = (x, y) => y >= 24 && y < 41 && Math.abs(x - KX) <= 7.6 - (y > 35 ? (y - 35) * 0.75 : 0) - (y < 26 ? (26 - y) * 0.8 : 0);
// viseira levantada: placa abaulada sobre a testa, um pouco mais larga que o casco
const inVisor = (x, y) => {
  const dx = Math.abs(x - KX);
  const bottom = 24.4 - (dx / 13) ** 2 * 2.4;
  return y >= 12.5 && y < bottom && dx <= 12.9 * Math.sqrt(Math.max(0, 1 - ((bottom - y) / 11.5) ** 2));
};

function knightEyes(p, closed, gaze) {
  for (const [x0, left] of [[27, true], [35, false]]) {
    if (closed) {
      for (let i = 0; i < 3; i++) { p.set(x0 + i, 29, PAL.skin[2]); p.set(x0 + i, 30, PAL.beard[1]); }
      continue;
    }
    for (let i = 0; i < 3; i++) p.set(x0 + i, 29, PAL.beard[1]);
    const ix = Math.max(0, Math.min(1, (left ? 1 : 0) + gaze));
    for (let i = 0; i < 3; i++) {
      const iris = i === ix || i === ix + 1;
      p.set(x0 + i, 30, iris ? (i === ix ? EYE_GREY_HI : EYE_GREY) : PAL.eyeWhite);
    }
  }
}

// Pluma de três penas; guarda, para cada pixel, a posição ao longo da pena (0 na base),
// que diz quanto ele balança.
function buildKnightPlume() {
  const p = new Pix(64, 64);
  const sMap = new Float32Array(64 * 64);
  K_PLUMES.forEach(([path, w, r, adj], k) => {
    const half = (s) => w * (0.55 + 0.75 * Math.sin(Math.PI * Math.min(1, s * 1.05))) * (s > 0.82 ? 1 - (s - 0.82) * 2.6 : 1) +
      (s > 0.25 ? (hash(Math.floor(s * 26), k, 7) - 0.5) * 0.8 : 0);
    p.fill(26, 0, 63, 30, (x, y) => {
      const [d, , , s] = nearestOnPath(path, x, y);
      return d <= half(s);
    }, (x, y) => {
      const [d, ox, oy, s] = nearestOnPath(path, x + 0.5, y + 0.5);
      const hw = half(s) + 0.5;
      sMap[y * 64 + x] = s;
      let v = 0.22 + sphereLight(ox / hw, oy / hw) * 0.7 + adj;
      if ((x - y + k) % 3 === 0) v -= 0.12; // barbas da pena
      if (d > hw - 1.1) v -= 0.22; // separa uma pena da outra
      return pick(r, v, x, y, 1.8);
    });
  });
  p.outline(PAL.out);
  const list = [];
  for (let y = 0; y < 32; y++) {
    for (let x = 24; x < 64; x++) {
      const c = p.get(x, y);
      if (!c) continue;
      let s = sMap[y * 64 + x];
      if (!s) s = Math.max(sMap[y * 64 + x - 1] || 0, sMap[y * 64 + x + 1] || 0, y > 0 ? sMap[(y - 1) * 64 + x] : 0, sMap[(y + 1) * 64 + x] || 0);
      list.push(x, y, c, Math.round(s * 100));
    }
  }
  return { pix: p, list: Int32Array.from(list), dx: new Int8Array(101), dy: new Int8Array(101) };
}

function buildKnight() {
  const p = new Pix(64, 64);

  // cota de malha nos braços
  const mail = (x, y, v) => {
    const ring = (x + (y >> 1)) % 2 === 0;
    return pick(MAIL, v + (y % 2 === 0 ? (ring ? 0.2 : -0.04) : -0.18), x, y, 3);
  };
  p.poly([[0, 64], [0, 52], [8, 47], [24, 45], [41, 45], [57, 47], [64, 52], [64, 64]], (x, y) =>
    mail(x, y, 0.42 - ((x + 0.5 - KX) / 31) * 0.3 - (y - 50) * 0.01));

  // sobreveste azul com o leão de ouro
  p.poly([[14, 64], [17, 51], [24, 47], [41, 47], [48, 51], [51, 64]], (x, y) => {
    const nx = (x + 0.5 - KX) / 17;
    let v = 0.52 - nx * 0.32 + Math.sin(x * 0.7 + 0.5) * 0.06 - (y - 52) * 0.006;
    if (x === 20 || x === 45) v -= 0.14; // dobras
    return pick(HERALD, v, x, y);
  });
  LION.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '#') p.set(27 + i, 52 + j, PAL.gold[i < 3 ? 4 : i < 7 ? 3 : 2]);
  }));
  p.set(30, 53, PAL.gold[5]);
  p.set(31, 52, PAL.gold[5]);
  // debrum dourado nas cavas
  for (let y = 50; y < 64; y++) {
    const xl = Math.round(17 - (y - 51) * (3 / 13)), xr = Math.round(48 + (y - 51) * (3 / 13));
    p.set(xl, y, PAL.gold[y % 2 ? 4 : 3]);
    p.set(xr, y, PAL.gold[y % 2 ? 2 : 1]);
  }

  // ombreiras de aço em lâminas
  for (const [cx, d] of [[8.5, -1], [56.5, 1]]) {
    p.fill(cx - 11, 45, cx + 11, 63, (x, y) => ((x - cx) / 10.5) ** 2 + ((y - 54) / 7.6) ** 2 <= 1 && y < 61.5, (x, y) => {
      const nx = (x + 0.5 - cx) / 10.5, ny = (y + 0.5 - 52) / 7.6;
      let v = 0.08 + sphereLight(nx, ny) * 0.95 + (d > 0 ? -0.1 : 0.04);
      const lame = (y - 47) % 4;
      if (lame === 3) v -= 0.3;
      else if (lame === 0) v += 0.12;
      return pick(PAL.steel, v, x, y, 2.4);
    });
    for (const [rx, ry] of [[cx - 5 * d, 50], [cx - 7 * d, 54], [cx - 8 * d, 58]]) p.set(rx, ry, PAL.gold[d < 0 ? 4 : 3]);
  }

  // camal de malha caindo do elmo sobre os ombros
  const aventail = (x, y) => {
    const dx = Math.abs(x - KX);
    const bottom = 50.5 - (dx / 16) ** 2 * 4.5 + Math.sin(x * 1.1) * 0.4;
    return y >= 33 && y < bottom && dx <= 11 + (y - 33) * 0.5;
  };
  p.fill(14, 33, 51, 51, aventail, (x, y) => {
    const nx = (x + 0.5 - KX) / 16, ny = (y + 0.5 - 40) / 12;
    let v = 0.12 + sphereLight(nx, ny) * 0.8;
    if (y > 49.5 - (Math.abs(x - KX) / 16) ** 2 * 4.5) v -= 0.18;
    return mail(x, y, v);
  });
  // borda de couro do camal, com rebites
  for (let x = 14; x <= 51; x++) {
    for (let y = 46; y < 52; y++) {
      if (aventail(x + 0.5, y + 0.5) && !aventail(x + 0.5, y + 1.5)) {
        p.set(x, y, PAL.leather[x < 32 ? 3 : 2]);
        if (x % 4 === 1) p.set(x, y, PAL.gold[x < 32 ? 4 : 3]);
      }
    }
  }

  // bacinete: casco de aço com a abertura do rosto
  p.fill(18, 8, 47, 42, (x, y) => inKnightHelm(x + 0.5, y + 0.5) && y < 37 + (Math.abs(x + 0.5 - KX) > 9 ? 3 : 0), (x, y) => {
    const nx = (x + 0.5 - KX) / 12.6, ny = (y + 0.5 - 24) / 15.5;
    let v = 0.05 + sphereLight(nx, ny) * 0.95;
    if (y > 35) v -= 0.12;
    return pick(PAL.steel, v, x, y, 2.6);
  });
  // rosto
  p.fill(24, 24, 41, 41, (x, y) => inFace(x + 0.5, y + 0.5), (x, y) => {
    let v = 0.36 + sphereLight((x + 0.5 - KX) / 9 * 0.8, (y + 0.5 - 31) / 10 * 0.5 - 0.1) * 0.7;
    if (y < 27) v -= 0.26; // sombra da viseira
    if (Math.abs(x + 0.5 - KX) > 5.5 && y > 30) v -= 0.16; // maçãs do rosto
    return pick(PAL.skin, v, x, y, 5);
  });
  // malha do queixo, por dentro da abertura
  p.fill(24, 37, 41, 41, (x, y) => inFace(x + 0.5, y + 0.5) && y >= 39, (x, y) => mail(x, y, 0.3));
  // sobrancelhas franzidas
  for (const [x, y] of [[26, 27], [27, 27], [28, 27], [29, 28], [30, 28]]) {
    p.set(x, y, PAL.beard[1]);
    p.set(65 - x, y, PAL.beard[1]);
  }
  p.set(27, 27, PAL.beard[3]);
  knightEyes(p, false, 0);
  for (const x of [27, 28, 29]) { p.set(x, 31, PAL.skin[3]); p.set(65 - x, 31, PAL.skin[2]); }
  // nariz reto
  for (const [x, y, k] of [[32, 29, 4], [32, 30, 4], [32, 31, 5], [33, 31, 2], [32, 32, 4], [33, 32, 2], [31, 33, 2], [32, 33, 3], [33, 33, 2], [34, 33, 1]]) p.set(x, y, PAL.skin[k]);
  // bigode, boca e barba por fazer
  for (let x = 29; x <= 36; x++) p.set(x, 34, PAL.beard[x < 32 ? 3 : 2]);
  p.set(28, 35, PAL.beard[2]);
  p.set(37, 35, PAL.beard[1]);
  for (let x = 30; x <= 35; x++) p.set(x, 35, x === 30 || x === 35 ? PAL.skin[1] : PAL.lip);
  p.set(31, 35, C('#b85a48'));
  for (let y = 36; y <= 38; y++) for (let x = 27; x <= 38; x++) if (inFace(x + 0.5, y + 0.5) && (x + y) % 2 === 0 && !(y === 36 && x > 30 && x < 35)) p.set(x, y, PAL.skin[y === 36 ? 3 : 2]);
  for (let x = 31; x <= 34; x++) p.set(x, 37, PAL.beard[x < 33 ? 3 : 2]);
  for (const [x, y] of [[38, 31], [38, 32], [37, 33]]) p.set(x, y, C('#c86a5a')); // cicatriz

  // viseira levantada com a fenda dos olhos e os respiros
  p.fill(19, 12, 46, 25, (x, y) => inVisor(x + 0.5, y + 0.5), (x, y) => {
    const nx = (x + 0.5 - KX) / 12.9, ny = (y + 0.5 - 16) / 9;
    let v = 0.16 + sphereLight(nx * 0.9, ny) * 0.9;
    if (x === 32) v += 0.14; // quilha no meio
    else if (x === 33) v -= 0.12;
    if (!inVisor(x + 0.5, y + 1.5)) v -= 0.34; // borda de baixo na sombra
    return pick(PAL.steel, v, x, y, 2.6);
  });
  for (let x = 24; x <= 41; x++) p.set(x, 18, x === 32 || x === 33 ? PAL.steel[2] : PAL.out);
  for (let x = 25; x <= 40; x++) if (x < 32 || x > 33) p.set(x, 19, PAL.steel[1]);
  for (const x of [26, 29, 36, 39]) p.set(x, 21, PAL.steel[0]);
  // fresta escura entre a viseira e o rosto
  for (let x = 21; x <= 44; x++) {
    for (let y = 20; y < 27; y++) {
      if (inVisor(x + 0.5, y - 0.5) && !inVisor(x + 0.5, y + 0.5)) {
        if (p.get(x, y) && (inFace(x + 0.5, y + 0.5) || inKnightHelm(x + 0.5, y + 0.5))) p.set(x, y, inFace(x + 0.5, y + 0.5) ? PAL.skin[0] : PAL.steel[0]);
        break;
      }
    }
  }
  // braços da viseira descendo até os pinos
  p.line(20, 27, 20, 23, PAL.steel[4]);
  p.line(45, 27, 45, 23, PAL.steel[2]);
  for (const [x, k] of [[20, 4], [45, 3]]) {
    p.set(x, 27, PAL.gold[k]);
    p.set(x, 28, PAL.gold[k - 2]);
  }
  // tubo da pluma no alto do casco
  p.rect(31, 9, 3, 3, (x, y) => PAL.gold[y === 9 ? 5 : x === 31 ? 4 : 2]);

  p.outline(PAL.out);
  return p;
}

const knightArt = { bg: null, frame: new Pix(64, 64) };

function paintKnightPortrait(ctx, t, info) {
  const a = knightArt;
  if (!a.bg) {
    a.bg = buildKnightBackdrop(0);
    const [tx, ty] = K_TORCH;
    a.halo = makeHalo(a.bg, buildKnightBackdrop(1), (x, y) => Math.hypot(x + 0.5 - tx, (y + 0.5 - ty) * 0.9) / 30);
    a.banner = buildKnightBanner();
    a.plume = buildKnightPlume();
    a.body = buildKnight();
    a.steel = rampPixels(a.body, PAL.steel, 16, 8, 63, 63);
  }
  const working = info.working;
  const live = working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 14.7 + 1) * 0.3 + Math.sin(t * 3.3) * 0.2;
  paintHalo(f, a.halo, 0.4 + live * 0.12 + flick * 0.07 * live);
  const [tx, ty] = K_TORCH;
  paintFlame(f, tx - 0.5, ty, t, 5 + live * 2, 2, live);
  paintEmbers(f, tx - 1, ty - 5, t, working ? 3 : 1, 12, 90);
  drawBanner(f, a.banner, 49, 7, t, working ? 1.6 : 1);
  // pluma balançando: mais na ponta, com a onda descendo pelas penas
  const { list, dx, dy } = a.plume;
  const w = t * (working ? 2.6 : 1.7);
  for (let k = 0; k <= 100; k++) {
    const s = k / 100, ph = w - s * 2.4;
    dx[k] = Math.round(Math.sin(ph) * 1.5 * s * s);
    dy[k] = Math.round(Math.cos(ph * 0.9) * 0.8 * s * s);
  }
  for (let i = 0; i < list.length; i += 4) {
    const k = list[i + 3];
    f.set(list[i] + dx[k], list[i + 1] + dy[k], list[i + 2]);
  }
  f.blit(a.body, 0, 0);
  const blink = t % 4.3 > 4.15 || t % 9.7 > 9.55;
  const g = Math.sin(t * 0.5 + 2);
  const gaze = working ? (g > 0.8 ? 1 : g < -0.85 ? -1 : 0) : 0;
  if (blink || gaze) knightEyes(f, blink, gaze);
  // brilho passando pelo aço do elmo e das ombreiras
  const period = working ? 2.6 : 4.6;
  sweepGlint(f, a.steel, PAL.steel, ((t % period) / 1.4) * 70 + 10, 1.8);
  sparkle(f, 24, 15, pulse(t + 0.8, working ? 3.3 : 5.7, 0.5) * 0.8);
  f.draw(ctx);
}

function iconKnight() {
  const p = new Pix(16, 16);
  // pluma
  p.fill(7, 0, 16, 9, (x, y) => {
    const d = Math.hypot(x - 8.5, y - 7.5);
    return d > 4.2 && d < 7.2 && y < 7.5 && x > 7.5;
  }, (x, y) => (Math.hypot(x + 0.5 - 8.5, y + 0.5 - 7.5) < 5.6 ? LINEN[4] : PLUME[(x + y) % 3 ? 3 : 2]));
  // elmo
  p.fill(2, 2, 14, 15, (x, y) => ((x - 8) / 5.8) ** 2 + ((y - 9) / 6.6) ** 2 <= 1, (x, y) =>
    pick(PAL.steel, 0.1 + sphereLight((x + 0.5 - 8) / 5.8, (y + 0.5 - 8) / 6.6) * 0.95, x, y));
  // rosto e viseira levantada
  p.fill(4, 7, 12, 15, (x, y) => y >= 7 && y < 14 && Math.abs(x - 8) <= 3.2 - (y > 11 ? (y - 11) * 0.8 : 0), (x, y) =>
    pick(PAL.skin, 0.65 - (x - 5) * 0.06 - (y === 7 ? 0.25 : 0), x, y));
  p.rect(6, 9, 1, 1, PAL.iris);
  p.rect(9, 9, 1, 1, PAL.iris);
  p.rect(3, 4, 10, 3, (x, y) => PAL.steel[y === 4 ? 5 : y === 5 ? (x < 8 ? 4 : 3) : 1]);
  p.rect(4, 5, 8, 1, PAL.out);
  p.set(8, 1, PAL.gold[4]);
  p.rect(5, 14, 6, 2, (x, y) => MAIL[(x + y) % 2 ? 4 : 2]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Registro

ART.portraits.arsenal = paintArsenalPortrait;
ART.locked.arsenal = ART.silhouette(() => {
  const p = buildArsenal(0);
  paintArsenalFlag(p, new Pix(14, 12), 0, false);
  return p;
});
ART.icons.arsenal = iconArsenal;

ART.portraits.barracks = paintBarracksPortrait;
ART.locked.barracks = ART.silhouette(() => {
  const p = buildBarracks();
  p.blit(buildDummyPix(), BK_DUMMY[0] - 11, BK_DUMMY[1] - 27);
  paintBarracksFlag(p, new Pix(14, 14), 0, false);
  return p;
});
ART.icons.barracks = iconBarracks;

ART.portraits.watchtower = paintWatchtowerPortrait;
ART.locked.watchtower = ART.silhouette(() => {
  const p = buildWatchtower(0);
  paintFlame(p, WT_FIRE[0] - 0.5, WT_FIRE[1] - 1, 0, 7, 2.6, 0.6);
  paintWatchFlag(p, new Pix(14, 12), 0, false);
  return p;
});
ART.icons.watchtower = iconWatchtower;

ART.portraits.knight = paintKnightPortrait;
ART.locked.knight = ART.silhouette(() => {
  const p = new Pix(64, 64);
  p.blit(buildKnightPlume().pix, 0, 0);
  p.blit(buildKnight(), 0, 0);
  return p;
});
ART.icons.knight = iconKnight;
})();
