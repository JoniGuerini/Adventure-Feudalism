'use strict';
// Linha da exploração, tiers 7 a 10: Estrada (faz desbravadores), Porto (faz
// estradas), Navio (faz portos) e Navegador (faz navios). Retratos animados,
// silhuetas bloqueadas e ícones.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

const HILL_FAR = ramp('#4a6484', '#5a7898', '#6e8ca8', '#86a2b8', '#a2bcc6', '#c0d4d2');
const MOSS = ramp('#2a3a1c', '#41562a', '#5e7432', '#80923e');
const LICHEN = C('#b4b46a');
const CLOAK = ramp('#1c2a1e', '#2c4430', '#3e5e3e', '#56784c');
const FELT = ramp('#24160e', '#3e2818', '#5c3c22', '#7a5430');
const HAWK = C('#2b2a38');
const GULL = ramp('#5a6270', '#9aa2ac', '#d6dadc', '#fbfbf6');

// Distância de (px, py) até a poligonal e o vetor do ponto mais próximo até ele.
function nearestOnPath(path, px, py) {
  let best = Infinity, bx = 0, by = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [cx, cy] = path[i + 1];
    const dx = cx - ax, dy = cy - ay;
    const s = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
    const ox = px - ax - dx * s, oy = py - ay - dy * s;
    const d = ox * ox + oy * oy;
    if (d < best) { best = d; bx = ox; by = oy; }
  }
  return [Math.sqrt(best), bx, by];
}

// Alvenaria: ajuste de tom de um bloco (junta escura, aresta de cima clara, variação por bloco).
function masonry(x, y, bw, bh, seed, oy = 0) {
  const ry = (((y - oy) % bh) + bh) % bh;
  const row = Math.floor((y - oy) / bh), off = (row & 1) * (bw >> 1);
  if (ry === bh - 1 || (x + off) % bw === 0) return -0.17;
  return (hash(Math.floor((x + off) / bw), row, seed) - 0.5) * 0.16 + (ry === 0 ? 0.06 : 0);
}

// Brilho em cruz (estrela de 4 pontas) num ponto, com intensidade 0..1.
function paintGlint(f, x, y, s) {
  if (s <= 0.05) return;
  f.set(x, y, s > 0.4 ? C('#ffffff') : PAL.gold[5]);
  if (s > 0.35) {
    const c = s > 0.7 ? PAL.gold[5] : PAL.gold[4];
    f.set(x - 1, y, c); f.set(x + 1, y, c); f.set(x, y - 1, c); f.set(x, y + 1, c);
  }
  if (s > 0.75) {
    f.set(x - 2, y, PAL.gold[4]); f.set(x + 2, y, PAL.gold[4]);
    f.set(x, y - 2, PAL.gold[4]); f.set(x, y + 2, PAL.gold[4]);
  }
}

// Pulso de brilho que aparece de tempos em tempos: 0 quase sempre, sobe e desce rápido.
function pulse(t, period, width) {
  const ph = (t % period) / width;
  return ph < 1 ? Math.sin(ph * Math.PI) : 0;
}

// Gaivota de asas abertas, em M; flap vai de -1 (asas baixas) a 1 (asas altas).
function paintGull(f, x, y, flap) {
  x = Math.round(x); y = Math.round(y);
  const ys = flap > 0.35 ? [-1, -2, -3] : flap < -0.35 ? [0, 1, 1] : [-1, -1, 0];
  f.set(x, y, GULL[3]);
  f.set(x, y + 1, GULL[2]);
  for (const d of [-1, 1]) {
    for (let i = 0; i < 3; i++) f.set(x + d * (i + 1), y + ys[i], i === 2 ? GULL[0] : GULL[3 - i]);
  }
}

// ---------------------------------------------------------------------------
// Estrada

// Linha central da estrada [x, y, largura], do primeiro plano até a crista do morro.
const ROAD = [[8.5, 70, 22], [11.5, 61, 17.5], [14.8, 53, 13.4], [17.6, 47, 10.4], [20.2, 42.6, 7.6], [24, 39.8, 4.6], [29, 38.7, 3.4],
  [52, 38.7, 3.4], [55.6, 37.4, 4], [58.6, 34.6, 3.8], [59, 31.4, 3.1], [55.6, 29, 2.5], [50.4, 27.3, 2.1], [46.6, 26.1, 1.7]];
const farTop = (x) => 20.5 + 2.4 * Math.sin(x * 0.13 + 0.4) + 1.3 * Math.sin(x * 0.41 + 2);
const midTop = (x) => Math.min(29 + ((x - 10) / 26) ** 2 * 5, 24.6 + ((x - 53) / 17) ** 2 * 6);
// ponte de um arco: parapeito, cordão e o arco sobre o riacho
const BR_X0 = 21, BR_X1 = 53, BR_TOP = 35, WATER_Y = 48.5;
const ARCH = [37, WATER_Y, 7, 8.8]; // centro, raio do vão e raio de fora das aduelas
const inArchHole = (x, y) => y < WATER_Y + 0.5 && Math.hypot(x - ARCH[0], y - ARCH[1]) < ARCH[2];
const inBridge = (x, y) => x >= BR_X0 && x < BR_X1 && y >= BR_TOP && y < WATER_Y + 0.5 && !inArchHole(x, y) &&
  (y < 44 || x >= BR_X0 + (y - 44) * 0.6 && x < BR_X1 - (y - 44) * 0.6);
// riacho: vem do vale lá atrás, passa sob o arco e se alarga até a frente
const creekEdges = (y) => {
  if (y < WATER_Y) {
    const k = clamp01((y - 33) / (WATER_Y - 33)) ** 2.2;
    return [35 - k * 4.4, 35.8 + k * 7.8];
  }
  const k = y - WATER_Y;
  return [30.6 + k * 0.42 + Math.sin(y * 0.55) * 0.6, 43.6 + k * 1.3 + Math.sin(y * 0.7 + 1) * 1.3 + (hash(Math.floor(y / 3), 0, 17) - 0.5) * 1.6];
};
const inCreek = (x, y) => {
  if (y < 33) return false;
  const [l, r] = creekEdges(y);
  return x >= l && x < r;
};
const MILE = [26, 49]; // canto de cima à esquerda do marco

// Ponto mais próximo da estrada: distância, meia largura ali, deslocamento lateral e
// posição ao longo (q, em pedras, que encolhem com a distância).
const roadSegs = (() => {
  const segs = [];
  let q = 0;
  for (let i = 0; i < ROAD.length - 1; i++) {
    const [ax, ay, aw] = ROAD[i], [bx, by, bw] = ROAD[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const cs = Math.max(1, (aw + bw) * 0.5 * 0.3);
    segs.push({ ax, ay, aw, bw, dx: bx - ax, dy: by - ay, len, cs, q });
    q += len / cs;
  }
  return segs;
})();
function roadAt(px, py) {
  let best = null;
  for (const g of roadSegs) {
    const s = clamp01(((px - g.ax) * g.dx + (py - g.ay) * g.dy) / (g.len * g.len));
    const ox = px - g.ax - g.dx * s, oy = py - g.ay - g.dy * s;
    const d = Math.hypot(ox, oy);
    const half = (g.aw + (g.bw - g.aw) * s) / 2;
    if (!best || d - half < best.d - best.half) {
      const u = (g.dx * oy - g.dy * ox) / g.len;
      best = { d, half, u, q: g.q + (s * g.len) / g.cs, cs: Math.max(1, half * 0.62) };
    }
  }
  return best;
}

function buildRoadBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 34);
  paintSun(p, 10, 7, 4);
  // serra azulada ao longe, com a encosta da esquerda pegando luz
  for (let x = 0; x < 64; x++) {
    const top = Math.round(farTop(x));
    const slope = farTop(x + 1) - farTop(x);
    for (let y = top; y < 40; y++) {
      let v = 0.58 - slope * 0.9 - (y - top) * 0.035 + (hash(x, y, 1) - 0.5) * 0.08;
      if (y === top) v += 0.2;
      p.set(x, y, pick(HILL_FAR, v, x, y));
    }
    // mata na base da serra
    const ft = Math.round(midTop(x) - 2.2 - hash(x, 2, 2) * 1.6 + Math.sin(x * 0.9) * 0.6);
    for (let y = ft; y < midTop(x) + 1; y++) p.set(x, y, pick(HILL_FAR, 0.2 - (y - ft) * 0.05 + (hash(x, y, 3) - 0.5) * 0.2, x, y));
  }
  // colinas verdes, mais claras na crista e nas encostas viradas para o sol
  for (let x = 0; x < 64; x++) {
    const top = midTop(x);
    const slope = midTop(x + 1) - midTop(x - 1);
    for (let y = Math.floor(top); y < 64; y++) {
      if (y + 0.5 < top) continue;
      const k = y - top;
      let v = 0.66 - slope * 0.55 - Math.min(k, 10) * 0.022 + (hash(x, y, 4) - 0.5) * 0.2;
      if (k < 1) v += 0.16;
      if (y > 44) v += (y - 44) * 0.008;
      if (hash(x, y, 5) < 0.06) v += 0.22; // tufos
      else if (hash(x, y - 1, 5) < 0.06) v -= 0.18;
      p.set(x, y, pick(PAL.grass, v, x, y, 1.6));
    }
  }
  // sebes seguindo as curvas de nível do morro da direita
  for (const [dy, x0, seed] of [[3.5, 39, 6], [8.5, 44, 7]]) {
    for (let x = x0; x < 64; x++) {
      const y = Math.round(midTop(x) + dy + Math.sin(x * 0.3) * 0.5);
      if (hash(x, 1, seed) < 0.12) continue;
      p.set(x, y, pick(PAL.tree, 0.5 + (hash(x, y, seed) - 0.5) * 0.4, x, y));
      p.set(x, y + 1, PAL.tree[0]);
    }
  }
  // moitas espalhadas pelas colinas
  for (const [x, y, r] of [[19, 30.5, 2.4], [23.5, 31.5, 1.8], [40, 30, 2], [62, 26.5, 2.6], [44.5, 36.5, 1.6], [61.5, 40, 2.2]]) {
    p.fill(x - r, y - r, x + r, y + r * 0.8, (xx, yy) => ((xx - x) / r) ** 2 + ((yy - y) / (r * 0.85)) ** 2 <= 1, (xx, yy) =>
      pick(PAL.tree, 0.15 + sphereLight((xx + 0.5 - x) / r, (yy + 0.5 - y) / r) * 0.9 + (hash(xx, yy, 8) - 0.5) * 0.25, xx, yy, 1.6));
  }

  // riacho: reflete o céu, escuro debaixo do arco, com o reflexo da ponte
  for (let y = 33; y < 64; y++) {
    const [l, r] = creekEdges(y);
    for (let x = Math.floor(l); x < r; x++) {
      if (!inCreek(x + 0.5, y + 0.5)) continue;
      const edge = x + 0.5 - l < 1 || r - x - 0.5 < 1;
      let v;
      if (y < WATER_Y) v = 0.3 - (y - 33) * 0.012 + (hash(x, y, 9) - 0.5) * 0.08;
      else {
        v = 0.66 - (y - WATER_Y) * 0.004 + (hash(x >> 1, y, 10) - 0.5) * 0.1;
        const my = 2 * WATER_Y - y - 0.5; // reflexo espelhado da ponte
        if (y < WATER_Y + 13 && inBridge(x + 0.5, my)) v = 0.24 + (hash(x, y, 11) - 0.5) * 0.1 - (my > BR_TOP + 4 ? 0 : 0.08);
        else if (y < WATER_Y + 9 && inArchHole(x + 0.5, my)) v = 0.12;
        if ((y + (x >> 2)) % 5 === 0) v += 0.1; // marolas
      }
      if (edge) v -= 0.12;
      p.set(x, y, pick(PAL.water, v, x, y, 2.2));
    }
  }
  // margens: barro molhado e pedras redondas
  for (let y = WATER_Y; y < 64; y++) {
    const [l, r] = creekEdges(y);
    p.set(l - 0.5, y, PAL.dirt[1]);
    p.set(r, y, PAL.dirt[hash(y, 1, 18) < 0.5 ? 2 : 1]);
    // capim debruçado sobre a água
    if (hash(y, 2, 18) < 0.55) p.set(r - 1, y, PAL.grass[hash(y, 3, 18) < 0.5 ? 3 : 4]);
    if (hash(y, 4, 18) < 0.3) p.set(r + 1, y - 1, PAL.grass[5]);
  }
  for (const [x, y, rx] of [[33.5, 54, 1.6], [35.5, 60.5, 2], [51.5, 55, 1.4], [57, 52.5, 1.8], [62, 58, 1.6], [38.5, 63, 1.8]]) {
    p.sphere(x, y, rx, rx * 0.75, PAL.stone, 0.05);
    p.set(x - rx + 0.6, y + 1, PAL.water[4]);
  }
  // juncos na beira da água
  for (const [x, y, h] of [[32, 51, 4], [33, 52, 3], [36, 58, 4], [55, 50, 3], [60, 54, 4], [61, 55, 3]]) {
    for (let k = 0; k < h; k++) p.set(x + (k > 2 ? 1 : 0), y - k, PAL.herb[k === h - 1 ? 5 : 3]);
    p.set(x, y - h, PAL.dirt[2]);
  }

  // estrada de pedra: cada pedra com a aresta de cima clara e a de baixo escura
  const id = (x, y) => {
    const r = roadAt(x + 0.5, y + 0.5);
    if (r.d > r.half) return -1;
    const row = Math.floor(r.q);
    return row * 97 + Math.floor(r.u / r.cs + (row & 1) * 0.5) + 48;
  };
  const ids = new Int32Array(64 * 66).fill(-1);
  for (let y = 0; y < 65; y++) for (let x = 0; x < 64; x++) ids[y * 64 + x] = id(x, y);
  const at = (x, y) => (x < 0 || x > 63 || y < 0 || y > 64 ? -1 : ids[y * 64 + x]);
  for (let y = 24; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const k = at(x, y);
      if (k < 0) continue;
      const r = roadAt(x + 0.5, y + 0.5);
      let v = 0.62 + (hash(k, 3, 12) - 0.5) * 0.18 - r.u / r.half * 0.05;
      if (r.cs >= 1.6) {
        if (at(x, y + 1) !== k || at(x + 1, y) !== k) v = 0.3 + (hash(x, y, 13) - 0.5) * 0.1;
        else if (at(x, y - 1) !== k || at(x - 1, y) !== k) v += 0.14;
      } else v += (hash(x, y, 13) - 0.5) * 0.2;
      if (r.d > r.half - 1) v = Math.min(v, 0.36); // meio-fio
      if (y < 34) v += 0.05; // névoa da distância
      p.set(x, y, pick(PAL.stone, v, x, y, 3));
    }
  }
  // capim invadindo as bordas da estrada
  for (let y = 26; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (at(x, y) < 0 || hash(x, y, 14) > 0.22) continue;
      if (at(x - 1, y) < 0 || at(x + 1, y) < 0) {
        p.set(x, y, PAL.grass[hash(x, y, 15) < 0.5 ? 3 : 4]);
        if (y > 44) p.set(x, y - 1, PAL.grass[4]);
      }
    }
  }
  // sombra do carvalho no capim, para a direita
  p.fill(4, 44, 22, 48, (x, y) => ((x - 12) / 9) ** 2 + ((y - 46) / 1.8) ** 2 <= 1 && at(x, y) < 0, (x, y) => {
    const g = PAL.grass.indexOf(p.get(x, y));
    return g > 0 ? PAL.grass[Math.max(0, g - 2)] : 0;
  });
  // flores no prado
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, 1, 16) * 64), y = 40 + Math.floor(hash(i, 2, 16) * 24);
    if (at(x, y) < 0 && !inCreek(x + 0.5, y + 0.5)) p.set(x, y, C(['#f4e9d0', '#e0644c', '#f3d47c', '#b9a2e0'][i % 4]));
  }
  return p;
}

function buildOak(p) {
  // tronco e galhos
  p.rect(6, 36, 3, 11, (x, y) => pick(PAL.wood, (x === 6 ? 0.75 : x === 7 ? 0.5 : 0.2) + (hash(x, y, 20) - 0.5) * 0.15, x, y));
  p.set(5, 46, PAL.wood[2]); p.set(9, 46, PAL.wood[1]);
  p.line(8, 38, 12, 34, PAL.wood[2]);
  p.line(6, 39, 3, 35, PAL.wood[3]);
  // copa em tufos
  const blobs = [[7, 29, 7, 5.5], [2.5, 32, 4.5, 3.6], [13, 31.5, 4.6, 3.8], [8, 24.5, 5, 3.8], [3, 26.5, 3.8, 3.2], [11.5, 26, 3.6, 3]];
  const inside = (x, y) => blobs.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 - hash(Math.floor(x), Math.floor(y), 21) * 0.18);
  p.fill(0, 19, 18, 36, inside, (x, y) => {
    let best = 0;
    for (const [cx, cy, rx, ry] of blobs) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) best = Math.max(best, sphereLight(nx, ny));
    }
    let v = 0.12 + best * 0.95 - (y > 32 ? (y - 32) * 0.06 : 0);
    if (hash(x, y, 22) < 0.2) v -= 0.22;
    else if (hash(x, y, 23) < 0.08) v += 0.2;
    return pick(PAL.tree, v, x, y, 1.6);
  });
}

function buildBridge(p) {
  const [ax, ay, ri, ro] = ARCH;
  p.fill(BR_X0, BR_TOP, BR_X1, 49, inBridge, (x, y) => {
    const dx = x + 0.5 - ax, dy = y + 0.5 - ay;
    const r = Math.hypot(dx, dy);
    // aduelas do arco: pedras em leque, com junta radial
    if (r < ro && dy < 0.5) {
      const a = Math.atan2(-dy, dx);
      const k = Math.floor(a / (Math.PI / 11));
      const fa = a / (Math.PI / 11) - k;
      let v = 0.66 - dx * 0.018 + (hash(k, 0, 24) - 0.5) * 0.16 + (r > ro - 1 ? 0.1 : 0);
      if (fa < 0.16) v -= 0.3;
      if (k === 5) v += 0.1; // pedra de fecho
      return pick(PAL.stone, v, x, y);
    }
    // parapeito com capa, cordão saliente e a parede de blocos
    if (y <= BR_TOP + 1) return pick(PAL.stone, (y === BR_TOP ? 0.84 : 0.4) - (x - BR_X0) * 0.006 - ((x - BR_X0) % 5 === 0 && y > BR_TOP ? 0.15 : 0), x, y);
    if (y === 39) return pick(PAL.stone, 0.78 - (x - BR_X0) * 0.006, x, y);
    if (y === 40) return pick(PAL.stone, 0.22, x, y);
    let v = 0.5 + masonry(x, y, 5, 3, 25, y < 39 ? 37 : 41) - (x - BR_X0) * 0.005;
    if (y > 45) v -= (y - 45) * 0.06; // umidade perto da água
    return pick(PAL.stone, v, x, y);
  });
  // limo verde na linha d'água e manchas de musgo
  for (let x = BR_X0; x < BR_X1; x++) {
    for (let y = 46; y < 49; y++) {
      if (inBridge(x + 0.5, y + 0.5) && hash(x, y, 26) < 0.5 - (48 - y) * 0.15) p.set(x, y, MOSS[hash(x, y, 27) < 0.5 ? 1 : 0]);
    }
  }
  for (const [mx, my] of [[24, 42], [47, 43], [50, 37], [27, 46]]) {
    for (let k = 0; k < 6; k++) {
      const x = mx + Math.round((hash(k, mx, 28) - 0.5) * 4), y = my + Math.round((hash(k, my, 29) - 0.5) * 2);
      if (inBridge(x + 0.5, y + 0.5)) p.set(x, y, MOSS[2 + (k & 1)]);
    }
  }
  // pilares das cabeceiras, um pouco mais altos
  for (const [x0, lit] of [[BR_X0, true], [BR_X1 - 3, false]]) {
    p.rect(x0, 33, 3, 6, (x, y) => pick(PAL.stone, (y === 33 ? 0.9 : 0.55) + (x === x0 ? (lit ? 0.2 : 0.05) : x === x0 + 2 ? -0.2 : 0) - (y === 36 ? 0.12 : 0), x, y));
    p.set(x0 + 1, 32, PAL.stone[lit ? 5 : 4]);
  }
  // barranco gramado na frente das cabeceiras
  const bank = (x0, x1, y0, dir) => {
    p.fill(x0, y0, x1, 49, (x, y) => y >= y0 + Math.abs(x - (dir < 0 ? x0 : x1)) * 0.5 + (hash(Math.floor(x), 0, 30) - 0.5), (x, y) =>
      pick(PAL.grass, 0.52 + (hash(x, y, 31) - 0.5) * 0.3 - (y - y0) * 0.02, x, y, 1.6));
  };
  bank(BR_X0 - 1, BR_X0 + 7, 44, -1);
  bank(BR_X1 - 7, BR_X1, 44, 1);
}

function buildMilestone(p) {
  const [x0, y0] = MILE;
  const w = 8, h = 13, cx = x0 + w / 2;
  // coluna de pedra com topo em cúpula, anel no alto e base mais larga
  const inCol = (x, y) => Math.abs(x - cx) <= w / 2 && (y >= y0 + 2 || ((x - cx) / (w / 2)) ** 2 + ((y - y0 - 2) / 2.2) ** 2 <= 1);
  p.fill(x0, y0 - 1, x0 + w, y0 + h - 2, inCol, (x, y) => {
    let v = 0.02 + cylLight((x + 0.5 - cx) / (w / 2 + 0.4)) * 0.84 + (hash(x, y, 32) - 0.5) * 0.12;
    if (y < y0 + 2) v += 0.1;
    if (y === y0 + 3) v += 0.12; // anel saliente
    else if (y === y0 + 4) v -= 0.3;
    return pick(PAL.stone, v, x, y);
  });
  p.rect(x0 - 1, y0 + h - 2, w + 2, 2, (x, y) => pick(PAL.stone, (y === y0 + h - 2 ? 0.75 : 0.35) + cylLight((x + 0.5 - cx) / (w / 2 + 1)) * 0.3 - 0.15, x, y));
  // inscrição entalhada em linhas curtas, com a borda de baixo pegando luz
  for (const [gy, a, b] of [[6, 2, 5], [8, 2, 3], [8, 5, 6], [10, 2, 4]]) {
    for (let x = x0 + a; x <= x0 + b; x++) {
      p.set(x, y0 + gy, PAL.stone[x < cx ? 1 : 0]);
      if (x < cx) p.set(x, y0 + gy + 1, PAL.stone[4]);
    }
  }
  // líquen e musgo na base
  for (const [x, y] of [[x0 + 5, y0], [x0 + 6, y0 + 1], [x0 + 7, y0 + 2], [x0 + 6, y0 + 9], [x0 + 7, y0 + 7]]) p.set(x, y, LICHEN);
  for (let x = x0 - 1; x <= x0 + w + 1; x++) {
    p.set(x, y0 + h, MOSS[hash(x, 1, 33) < 0.5 ? 2 : 1]);
    if (hash(x, 2, 33) < 0.5) p.set(x, y0 + h - 1, MOSS[3]);
  }
  // capim alto em volta
  for (const [x, hh] of [[x0 - 2, 3], [x0, 2], [x0 + 3, 2], [x0 + 7, 3], [x0 + 9, 2], [x0 + 10, 3]]) {
    for (let k = 0; k < hh; k++) p.set(x + (k === hh - 1 && x > cx ? 1 : 0), y0 + h + 1 - k, PAL.grass[k ? 4 : 3]);
  }
}

function buildRoad() {
  const p = new Pix(64, 64);
  buildOak(p);
  buildBridge(p);
  buildMilestone(p);
  p.outline(PAL.out);
  return p;
}

// Viajante de chapéu, capa e trouxa nas costas, de perfil para a direita, em três
// tamanhos (perto, meio, longe). Pernas: 4 quadros de passada.
const WALKER = [
  {
    rows: ['...hh..', '..hHhh.', '.HHHHHH', '...fs..', '..bfss.', '.bbcCc.', '.bbcCcs', '..ccCc.', '..ccCc.'],
    legs: [['..l..l.', '.l....l'], ['...ll..', '...ll..'], ['..l..l.', '.l....l'], ['...l...', '...l...']],
    staff: [6, 3, 11],
  },
  {
    rows: ['..hh.', '.HHHH', '..fs.', '.bcCs', '..cC.'],
    legs: [['.l..l'], ['..ll.'], ['.l..l'], ['..l..']],
    staff: [4, 2, 6],
  },
  {
    rows: ['.h.', 'HHH', '.s.', 'cC.'],
    legs: [['l.l'], ['.l.'], ['l.l'], ['.l.']],
    staff: [2, 1, 5],
  },
];
const WALK_COL = [
  { h: FELT[1], H: FELT[2], f: PAL.skin[2], s: PAL.skin[4], b: PAL.linen[3], c: CLOAK[1], C: CLOAK[3], l: PAL.leather[1] },
  { h: PAL.wood[1], H: PAL.straw[3], f: PAL.skin[1], s: PAL.skin[3], b: PAL.wheat[3], c: PAL.scarf[1], C: PAL.scarf[3], l: PAL.leather[1] },
];
// quadros prontos: [tamanho][passo][direção]
function buildWalkers(col) {
  return WALKER.map(({ rows, legs, staff }, size) => legs.map((lg, step) => [1, -1].map((dir) => {
    const all = rows.concat(lg);
    const w = rows[0].length, h = all.length;
    const q = new Pix(w + 4, h + 3);
    const X = (x) => (dir > 0 ? x + 2 : w + 1 - x);
    all.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      let c = col[ch];
      if (ch === 'l' && y >= rows.length && x > w / 2 === (step < 2)) c = PAL.leather[2];
      q.set(X(x), y + 1, c);
    }));
    // cajado: balança junto com a passada
    const [sx, top, len] = staff;
    const lean = step === 0 ? 1 : step === 2 ? -1 : 0;
    for (let k = 0; k < len; k++) {
      const x = X(sx + Math.round(lean * (k / len - 0.4)));
      if (!q.get(x, top + k)) q.set(x, top + k, PAL.wood[k < 2 ? 4 : 3]);
    }
    if (size < 2) q.outline(PAL.out); // o de longe fica sem contorno, senão parece grande
    return q;
  })));
}

// Caminho do viajante: tempo acumulado em cada vértice (anda mais devagar ao longe).
const walkPath = (() => {
  // no tabuleiro da ponte ele anda um pouco acima da linha da estrada, para aparecer
  // da cintura para cima atrás do parapeito
  const pts = ROAD.slice(1).map(([x, y]) => [x, y > 38 && y < 39 ? 36.2 : y]);
  pts.push([44.4, 31]); // desce pelo outro lado da crista
  const times = [0];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    times.push(times[i - 1] + Math.hypot(bx - ax, by - ay) / (1.2 + ((ay + by) / 2 - 24) * 0.14));
  }
  return { pts, times, total: times[times.length - 1] };
})();

function paintWalker(f, sprites, t, delay) {
  const { pts, times, total } = walkPath;
  const period = total + 3;
  const tt = (t + period - delay) % period;
  if (tt >= total) return;
  let i = 1;
  while (times[i] < tt) i++;
  const s = (tt - times[i - 1]) / (times[i] - times[i - 1]);
  const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
  const x = ax + (bx - ax) * s, y = ay + (by - ay) * s;
  const size = y > 46 ? 0 : y > 33.5 ? 1 : 2;
  const step = Math.floor(t * (size === 0 ? 5 : 4)) & 3;
  const q = sprites[size][step][bx >= ax ? 0 : 1];
  const ox = Math.round(x - q.w / 2), oy = Math.round(y) - q.h + 1;
  const behind = i === pts.length - 1; // já passou da crista
  for (let yy = 0; yy < q.h; yy++) {
    const ty = yy + oy;
    if (ty < 0 || ty >= 64) continue;
    for (let xx = 0; xx < q.w; xx++) {
      const c = q.d[yy * q.w + xx];
      const tx = xx + ox;
      if (!c || tx < 0 || tx >= 64) continue;
      if (behind && ty + 0.5 >= midTop(tx + 0.5)) continue;
      f.d[ty * 64 + tx] = c;
    }
  }
}

// Ave vista de longe, de asas abertas: flap > 0.4 asas no alto, < -0.4 embaixo.
function paintBird(f, x, y, flap, c) {
  x = Math.round(x); y = Math.round(y);
  const tip = flap > 0.4 ? -2 : flap < -0.4 ? 1 : -1;
  const mid = flap > 0.4 ? -1 : 0;
  f.set(x, y, c); f.set(x, y + 1, c);
  for (const d of [-1, 1]) {
    f.set(x + d, y, c);
    f.set(x + d * 2, y + mid, c);
    f.set(x + d * 3, y + tip, c);
  }
}

const roadArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintRoadPortrait(ctx, t, info) {
  const a = roadArt;
  if (!a.bg) {
    a.bg = buildRoadBackdrop();
    a.body = buildRoad();
    a.clouds = [makeCloud(22, 8, 3), makeCloud(15, 6, 14)];
    a.walkers = WALK_COL.map(buildWalkers);
    a.water = [];
    for (let y = WATER_Y; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        if (PAL.water.includes(a.bg.get(x, y)) && !a.body.get(x, y)) a.water.push(x, y);
      }
    }
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 1.4) % 92) - 22), 2);
  f.blit(a.clouds[1], Math.floor(((t * 0.9 + 46) % 84) - 16), 11);
  // correnteza: brilhos descendo o riacho em direção à frente
  const sp = working ? 3.4 : 2;
  const w = a.water;
  for (let k = 0; k < w.length; k += 2) {
    const x = w[k], y = w[k + 1];
    const s = Math.sin(y * 1.3 - t * sp + Math.sin(x * 0.7) * 1.5) * Math.sin(x * 0.45 + y * 0.2 + t * 0.6);
    if (s > 0.78) f.d[y * 64 + x] = PAL.water[s > 0.9 ? 5 : 4];
  }
  paintWalker(f, a.walkers[0], t, 0);
  if (working) paintWalker(f, a.walkers[1], t, walkPath.total * 0.5); // movimento: outro viajante na estrada
  f.blit(a.body, 0, 0);
  // capim alto balançando na frente
  for (const [x, y, h] of [[2, 63, 4], [5, 62, 3], [24, 63, 3], [27, 62, 4], [31, 63, 3], [22, 58, 3]]) {
    const sway = Math.sin(t * 1.7 + x * 0.4) * (working ? 1.2 : 0.7);
    for (let k = 0; k < h; k++) f.set(x + Math.round(sway * (k / h) ** 2), y - k, PAL.grass[k === h - 1 ? 5 : 3 + (k & 1)]);
  }
  // gaviões planando em círculos, batendo as asas de vez em quando
  for (let k = 0; k < 2; k++) {
    const ph = t * (0.32 + k * 0.1) + k * 2.6;
    const flap = Math.sin(t * 2.2 + k * 2) > 0.55 ? Math.sin(t * 13 + k) : 0.2;
    paintBird(f, 34 + k * 14 + Math.cos(ph) * (8 - k * 2), 9 + k * 3 + Math.sin(ph) * 2.2, flap, HAWK);
  }
  f.draw(ctx);
}

function iconRoad() {
  const p = new Pix(16, 16);
  // campo de capim até o horizonte, com o topo arredondado nas pontas
  const inField = (x, y) => y >= 6 + Math.max(0, Math.abs(x - 7.5) - 5) * 0.8 && y < 15.5 && x >= 0 && x < 15;
  p.fill(0, 5, 15, 15, inField, (x, y) => pick(PAL.grass, 0.8 - (y - 6) * 0.04 - (x - 3) * 0.02 + ((x * 3 + y) % 5 === 0 ? 0.15 : 0), x, y));
  // estrada de pedra sumindo no horizonte, com uma curva
  const center = (y) => 7.5 - (y - 6) * 0.35 + Math.sin((y - 6) * 0.5) * 1.2;
  const onRoad = (x, y) => inField(x, y) && Math.abs(x - center(y)) <= 0.5 + (y - 6) * 0.42;
  p.fill(0, 5, 15, 15, onRoad, (x, y) => {
    if (!onRoad(x + 1.5, y + 0.5) || !onRoad(x - 0.5, y + 0.5)) return PAL.stone[2]; // meio-fio
    return PAL.stone[y < 9 ? 4 : (x + (y >> 1) * 2) % 3 === 0 ? 3 : y % 2 ? 4 : 5];
  });
  // marco de pedra: coluna com anel e uma inscrição
  p.fill(10, 4, 15, 14, (x, y) => Math.abs(x - 12.5) <= 2 && (y >= 7 || ((x - 12.5) / 2) ** 2 + ((y - 7) / 2.2) ** 2 <= 1), (x, y) =>
    pick(PAL.stone, 0.12 + cylLight((x + 0.5 - 12.5) / 2.2) * 0.95 + (y < 7 ? 0.1 : 0), x, y));
  p.rect(11, 7, 4, 1, (x) => PAL.stone[x === 11 ? 3 : 1]);
  p.rect(11, 9, 2, 1, PAL.stone[1]);
  p.rect(11, 11, 3, 1, PAL.stone[1]);
  p.rect(10, 13, 5, 1, (x) => MOSS[x < 12 ? 3 : 2]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Porto

const PLASTER = ramp('#5e4e48', '#8c7868', '#b6a088', '#d8c4a4', '#f0e2c4');
const SEA = ramp('#16304e', '#1e4468', '#285c84', '#3a789e', '#5a98b8', '#86bed2', '#bfe0e6');
const HULL = ramp('#1e120c', '#3a2214', '#5a361e', '#7c4e2a', '#9e6838', '#bc8650');
const TAR = ramp('#141012', '#241c1c', '#342826');
const BURLAP = ramp('#3a2a1a', '#62482c', '#8c6c44', '#b4925e', '#d4b47c');
const BURLAP_NET = C('#2a1c12');
const HORIZON = 27, PIER_Y = 44, WHEEL = [31, 36.5, 6.6], JIB_TIP = [55, 5];
const PILES = [15, 22, 29, 36, 43, 50, 57];
const SIN = Float32Array.from({ length: 256 }, (_, i) => Math.sin((i / 256) * Math.PI * 2));

// Coordenadas (a, b) de um ponto num paralelogramo o + a*e1 + b*e2.
function planeUV(o, e1, e2) {
  const det = e1[0] * e2[1] - e1[1] * e2[0];
  return (x, y) => {
    const dx = x - o[0], dy = y - o[1];
    return [(dx * e2[1] - dy * e2[0]) / det, (e1[0] * dy - e1[1] * dx) / det];
  };
}
const quad = (o, e1, e2) => [o, [o[0] + e1[0], o[1] + e1[1]], [o[0] + e1[0] + e2[0], o[1] + e1[1] + e2[1]], [o[0] + e2[0], o[1] + e2[1]]];

// Ondas do mar: valor de cada pixel, com cristas que alargam perto de quem olha.
function seaValue(x, y, t, hz = HORIZON) {
  const d = (y - hz) / (64 - hz);
  const k = 1.1 - d * 0.75;
  const w = Math.sin(x * k * 0.55 + Math.sin(y * 1.9) * 2 + y * 2.3 - t);
  return 0.62 - d * 0.32 + w * (0.06 + d * 0.1);
}

function buildHarborBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, HORIZON);
  // costa distante
  for (let x = 26; x < 64; x++) {
    const top = Math.round(23.6 + Math.sin(x * 0.21 + 1) * 1.2 - (x - 26) * 0.05 + hash(x, 0, 41) * 0.8);
    for (let y = top; y < HORIZON; y++) p.set(x, y, pick(HILL_FAR, (y === top ? 0.72 : 0.45) - (y - top) * 0.08, x, y));
  }
  // mar: claro no horizonte, mais fundo e escuro perto
  for (let y = HORIZON; y < 64; y++) {
    for (let x = 0; x < 64; x++) p.set(x, y, pick(SEA, y === HORIZON ? 0.92 : seaValue(x, y, 0), x, y, 2));
  }
  // sombra do cais na água e reflexos das estacas
  p.fill(13, 49, 63, 53, () => true, (x, y) => pick(SEA, 0.12 + (y - 49) * 0.03 + (hash(x, y, 42) - 0.5) * 0.08, x, y));
  for (const x of PILES) {
    for (let y = 58; y < 63; y++) if ((y + x) % 3) p.set(x + Math.round(Math.sin(y * 1.3) * 0.6), y, SEA[1]);
  }
  return p;
}

function stoneBlock(x, y, base) {
  return pick(PAL.stone, base + masonry(x, y, 4, 3, 46) * 1.2, x, y);
}

function buildWarehouse(p) {
  // empena de taipa com enxaimel, virada para a luz
  p.poly([[7, 45], [7, 28], [3.5, 14.5], [0, 25], [0, 45]], (x, y) => (y > 37 ? stoneBlock(x, y, 0.68) : pick(PLASTER, 0.8 + (hash(x, y, 43) - 0.5) * 0.12, x, y)));
  for (const [x0, y0, x1, y1] of [[0, 31, 7, 31], [0, 37, 7, 37], [2, 25, 2, 37], [5, 25, 5, 37], [2, 25, 5, 25]]) p.line(x0, y0, x1, y1, PAL.wood[2]);
  p.sphere(3.5, 22, 1.5, 1.5, TAR, 0);
  p.set(3, 21, PAL.glassHi);
  // parede da frente: pedra embaixo, enxaimel em cima
  p.rect(7, 27, 17, 18, (x, y) => (y > 37 ? stoneBlock(x, y, 0.48) : pick(PLASTER, 0.6 - (x - 7) * 0.01 + (hash(x, y, 44) - 0.5) * 0.12 - (y < 30 ? 0.22 : 0), x, y)));
  for (const x of [7, 12, 18, 23]) p.rect(x, 27, 1, 11, PAL.wood[x === 7 ? 3 : 1]);
  p.rect(7, 32, 17, 1, PAL.wood[1]);
  p.rect(7, 37, 17, 1, PAL.wood[2]);
  p.line(19, 31, 22, 28, PAL.wood[1]);
  // portão de carga aberto, em arco, com sacos e um barril lá dentro
  const door = (x, y) => y < 45 && (y >= 36 ? Math.abs(x - 15) <= 3.5 : Math.hypot(x - 15, y - 36) <= 3.5);
  p.fill(11, 32, 19, 44, door, (x, y) => pick(TAR, 0.15 + (y - 33) * 0.035, x, y));
  for (const [x, y, r] of [[13.4, 42.6, 1.9], [16, 43, 1.6]]) p.sphere(x, y, r, r * 0.9, PAL.linen, -0.15);
  p.rect(16, 38, 2, 3, (x, y) => pick(PAL.wood, 0.35 - (y === 39 ? 0.2 : 0), x, y));
  p.fill(10, 31, 20, 44, (x, y) => !door(x, y) && (door(x - 1, y) || door(x + 1, y) || door(x, y + 1) || door(x - 1, y + 1) || door(x + 1, y + 1)), (x, y) =>
    pick(PAL.stone, x < 15 ? 0.85 : 0.5, x, y));
  // portinhola do sótão com a roldana e a janela de venezianas
  p.rect(13, 28, 4, 3, TAR[0]);
  p.rect(13, 28, 4, 1, PAL.wood[1]);
  p.set(14, 27, PAL.iron[3]);
  p.rect(19, 33, 3, 3, PAL.glass);
  p.set(19, 33, PAL.glassHi);
  p.rect(18, 33, 1, 3, PAL.wood[3]);
  p.rect(22, 33, 1, 3, PAL.wood[2]);
  // placa com um peixe pintado
  p.set(8, 32, PAL.iron[2]);
  p.rect(8, 33, 3, 3, (x, y) => PAL.wood[y === 33 ? 4 : 3]);
  p.set(9, 34, SEA[5]); p.set(10, 34, SEA[4]); p.set(8, 34, SEA[4]);
  // telhado de telhas: plano da frente, com a cumeeira e a borda sobre a empena
  const o = [3, 13.5], e1 = [18, 0], e2 = [6.5, 14.5];
  const uv = planeUV(o, e1, e2);
  p.poly(quad(o, e1, e2), (x, y) => {
    const [a, b] = uv(x + 0.5, y + 0.5);
    const rb = b * 5, row = Math.floor(rb), fb = rb - row;
    const ca = a * 9 + (row % 2) * 0.5, fa = ca - Math.floor(ca);
    let v = 0.72 - a * 0.2 + (hash(Math.floor(ca), row, 45) - 0.5) * 0.15;
    if (fb > 0.66) v -= 0.32;
    else if (fa < 0.2) v -= 0.16;
    else if (fb < 0.3) v += 0.08;
    if (b > 0.93) v -= 0.3;
    return pick(PAL.roof, v, x, y, 2.4);
  });
  p.line(3, 14, 9, 27, (x, y) => PAL.roof[y % 2 ? 4 : 3]);
  p.line(4, 13, 21, 13, (x) => PAL.roof[x % 3 ? 2 : 1]);
}

function buildQuay(p) {
  // cais de pedra com lajes em cima
  p.rect(0, 45, 14, 2, (x, y) => pick(PAL.stone, (y === 45 ? 0.82 : 0.6) - x * 0.01 + (x % 4 === 0 ? -0.2 : 0), x, y));
  p.rect(0, 47, 14, 9, (x, y) => {
    if (y === 55) return MOSS[hash(x, y, 48) < 0.5 ? 1 : 0];
    return pick(PAL.stone, 0.42 + masonry(x, y, 5, 3, 47, 47) * 1.2 - (y > 52 ? (y - 52) * 0.05 : 0), x, y);
  });
  // barril e caixote à espera do embarque
  p.rect(0, 39, 4, 6, (x, y) => pick(PAL.wood, 0.2 + cylLight((x + 0.5 - 2) / 2.2) * 0.8, x, y));
  for (const y of [40, 43]) p.rect(0, y, 4, 1, (x) => PAL.iron[x === 0 ? 3 : 1]);
  p.rect(0, 38, 4, 1, (x) => PAL.wood[x === 0 ? 4 : 3]);
  p.rect(4, 41, 5, 4, (x, y) => pick(PAL.wood, (y === 41 ? 0.8 : 0.45) - (x - 4) * 0.04 - ((x - 4) % 2 ? 0.1 : 0), x, y));
  p.line(4, 42, 8, 44, PAL.wood[1]);
  // cabeço de amarração
  p.rect(11, 42, 2, 3, (x) => PAL.iron[x === 11 ? 3 : 1]);
  p.rect(10, 42, 4, 1, (x) => PAL.iron[x < 12 ? 4 : 2]);
}

function buildPier(p) {
  // tábuas do deque vistas um pouco de cima
  p.rect(13, PIER_Y, 51, 3, (x, y) => {
    let v = 0.72 - (y - PIER_Y) * 0.12 + (hash(x >> 1, 0, 49) - 0.5) * 0.14;
    if ((x - 13) % 3 === 0) v -= 0.22;
    return pick(PAL.wood, v, x, y);
  });
  // viga da frente e estacas com limo na linha d'água
  p.rect(13, PIER_Y + 3, 51, 2, (x, y) => pick(PAL.wood, (y === PIER_Y + 3 ? 0.38 : 0.2) + (hash(x, y, 50) - 0.5) * 0.1, x, y));
  for (const x0 of PILES) {
    p.rect(x0, PIER_Y + 5, 2, 9, (x, y) => {
      if (y > PIER_Y + 10) return y === PIER_Y + 11 ? MOSS[2] : MOSS[1];
      return pick(PAL.wood, (x === x0 ? 0.5 : 0.2) - (y - PIER_Y) * 0.02, x, y);
    });
  }
  // escada descendo para os barcos
  for (let y = PIER_Y + 5; y < PIER_Y + 12; y++) {
    p.set(25, y, PAL.wood[1]);
    p.set(27, y, PAL.wood[1]);
    if (y % 2 === 0) p.set(26, y, PAL.wood[3]);
  }
}

function buildCrane(p) {
  const [wx, wy, wr] = WHEEL;
  // base, cavalete da roda e escoras da torre
  p.rect(25, PIER_Y - 2, 20, 2, (x, y) => pick(PAL.wood, (y === PIER_Y - 2 ? 0.72 : 0.38) - (x - 25) * 0.01, x, y));
  p.line(wx - 4, PIER_Y - 2, wx, wy, PAL.wood[1]);
  p.line(wx + 4, PIER_Y - 2, wx, wy, PAL.wood[1]);
  p.line(35, PIER_Y - 3, 38, 31, PAL.wood[2]);
  p.line(44, PIER_Y - 3, 40, 31, PAL.wood[1]);
  // mastro
  p.rect(38, 8, 2, 34, (x, y) => pick(PAL.wood, (x === 38 ? 0.72 : 0.3) + (hash(x, y >> 1, 51) - 0.5) * 0.12 - (y % 7 === 0 ? 0.15 : 0), x, y));
  p.rect(37, 7, 4, 2, (x, y) => PAL.wood[y === 7 ? 4 : 2]);
  // lança, tirante e roldana da ponta
  const [tx, ty] = JIB_TIP;
  p.line(40, 9, tx, ty, (x) => PAL.wood[x % 5 === 0 ? 3 : 4]);
  p.line(40, 10, tx, ty + 1, (x) => PAL.wood[x % 5 === 0 ? 1 : 2]);
  p.line(39, 20, 48, 8, PAL.wood[2]);
  p.sphere(tx, ty + 1.5, 1.4, 1.4, PAL.iron, 0.1);
  // roda de pisar: aro de tábuas grossas
  p.fill(wx - wr - 1, wy - wr - 1, wx + wr + 1, wy + wr + 1, (x, y) => {
    const d = Math.hypot(x - wx, y - wy);
    return d <= wr && d >= wr - 1.7;
  }, (x, y) => {
    const a = Math.atan2(y + 0.5 - wy, x + 0.5 - wx);
    let v = 0.22 + sphereLight(Math.cos(a) * 0.9, Math.sin(a) * 0.9) * 0.75;
    if (Math.hypot(x + 0.5 - wx, y + 0.5 - wy) > wr - 0.6) v += 0.12;
    if (Math.floor((a + Math.PI) * 3) % 2) v -= 0.1; // tábuas da pista
    return pick(PAL.wood, v, x, y);
  });
}

function buildHarbor() {
  const p = new Pix(64, 64);
  buildWarehouse(p);
  buildQuay(p);
  buildPier(p);
  buildCrane(p);
  p.outline(PAL.out);
  return p;
}

// Casco de tábuas sobrepostas num Pix (w x h), com a borda curva e a linha d'água.
function paintHull(p, x0, y0, w, h, seed) {
  const sheer = (x) => y0 - ((x - x0 - w / 2) / (w / 2)) ** 2 * 1.6;
  p.fill(x0, y0 - 2, x0 + w - 1, y0 + h, (x, y) => {
    const u = (x - x0 - w / 2) / (w / 2);
    return Math.abs(u) <= 1 && y >= sheer(x) && y <= y0 + h - 0.5 - u * u * (h - 2);
  }, (x, y) => {
    let v = 0.62 - (y - y0) * 0.08 + (hash(x >> 2, y, seed) - 0.5) * 0.1 - (x - x0) * 0.008;
    if ((y - y0) % 2 === 1) v -= 0.14; // tábuas sobrepostas
    if (y < sheer(x) + 1) v += 0.28; // amurada
    return pick(HULL, v, x, y);
  });
}

// Barco a remo com os remos guardados.
function buildRowboat() {
  const p = new Pix(22, 9);
  paintHull(p, 0, 2, 22, 6, 52);
  p.rect(4, 2, 14, 1, (x) => (x % 5 === 0 ? HULL[1] : HULL[0]));
  p.line(3, 1, 18, 1, (x) => PAL.wood[x < 8 ? 4 : 3]);
  p.rect(16, 1, 3, 1, PAL.wood[4]);
  p.outline(PAL.out);
  return p;
}

// Batelão de carga com barris e sacos, amarrado na ponta do cais.
function buildBarge() {
  const p = new Pix(20, 12);
  for (const x0 of [2, 6]) {
    p.rect(x0, 1, 4, 4, (x, y) => pick(PAL.wood, 0.3 + cylLight((x + 0.5 - x0 - 2) / 2.2) * 0.8, x, y));
    p.rect(x0, 2, 4, 1, (x) => PAL.iron[x === x0 ? 4 : 2]);
    p.rect(x0, 0, 4, 1, (x) => PAL.wood[x === x0 ? 4 : 3]);
    p.rect(x0 + 3, 0, 1, 5, PAL.wood[1]);
  }
  p.sphere(14, 3.4, 2.6, 1.8, BURLAP, 0.05);
  p.sphere(11, 3.8, 1.8, 1.4, BURLAP, -0.05);
  paintHull(p, 0, 5, 20, 6, 55);
  p.rect(1, 5, 18, 1, (x) => HULL[x < 9 ? 5 : 4]);
  p.outline(PAL.out);
  return p;
}

// Navio pequeno ao longe, de velas brancas.
function buildFarShip() {
  const p = new Pix(10, 10);
  p.rect(1, 7, 8, 1, HULL[2]);
  p.rect(2, 8, 6, 1, HULL[1]);
  p.rect(4, 1, 1, 6, PAL.wood[1]);
  p.rect(2, 2, 5, 4, (x, y) => PAL.sail[x < 4 ? 4 : 3]);
  p.rect(2, 5, 5, 1, PAL.sail[2]);
  p.set(6, 3, PAL.sail[4]); p.set(7, 4, PAL.sail[3]);
  p.set(4, 0, PAL.banner[2]); p.set(5, 0, PAL.banner[3]);
  return p;
}

// Cabo, gancho e a carga (fardo numa rede) pendurados na ponta da lança.
function paintCargo(f, y, swing) {
  const [tx, ty] = JIB_TIP;
  const top = ty + 3;
  for (let yy = top; yy < y; yy++) f.set(tx + swing * ((yy - top) / Math.max(1, y - top)), yy, PAL.linen[yy % 2 ? 2 : 3]);
  const cx = Math.round(tx + swing), cy = Math.round(y);
  f.set(cx, cy, PAL.iron[3]);
  f.set(cx, cy + 1, PAL.iron[1]);
  const ccx = cx + 0.5, ccy = cy + 4.6;
  f.fill(cx - 4, cy + 1, cx + 4, cy + 8, (x, y2) => ((x - ccx) / 3.4) ** 2 + ((y2 - ccy) / 3.1) ** 2 <= 1, (x, y2) =>
    (x + y2) % 3 === 0 ? BURLAP_NET : pick(BURLAP, 0.2 + sphereLight((x + 0.5 - ccx) / 3.4, (y2 + 0.5 - ccy) / 3.1) * 0.9, x, y2));
  // contorno do fardo
  for (let y2 = cy + 1; y2 <= cy + 9; y2++) {
    for (let x = cx - 4; x <= cx + 4; x++) {
      if (BURLAP.includes(f.get(x, y2)) || f.get(x, y2) === BURLAP_NET) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const c = f.get(x + dx, y2 + dy);
        return BURLAP.includes(c) || c === BURLAP_NET;
      });
      if (near) f.set(x, y2, PAL.out);
    }
  }
}

// Raios da roda girando; ang em radianos.
function paintWheelSpokes(f, ang) {
  const [wx, wy, wr] = WHEEL;
  for (let k = 0; k < 4; k++) {
    const a = ang + (k * Math.PI) / 4;
    const dx = Math.cos(a) * (wr - 1.6), dy = Math.sin(a) * (wr - 1.6);
    f.line(wx - 0.5 - dx, wy - 0.5 - dy, wx - 0.5 + dx, wy - 0.5 + dy, (x, y) => PAL.wood[(x + y) % 2 ? 2 : 1]);
  }
  f.set(wx - 1, wy - 1, PAL.iron[4]);
  f.set(wx, wy - 1, PAL.iron[2]);
  f.set(wx - 1, wy, PAL.iron[2]);
  f.set(wx, wy, PAL.iron[1]);
}

// Bandeirola tremulando presa no mastro (px, py).
function paintPennant(f, px, py, len, ph, ramp0) {
  for (let i = 0; i < len; i++) {
    const s = Math.sin(ph - i * 0.9);
    const dy = Math.round(s * (i / len) * 1.4);
    const h = i < len - 2 ? 2 : 1;
    for (let j = 0; j < h; j++) f.set(px + 1 + i, py + j + dy, ramp0[Math.cos(ph - i * 0.9) > 0 ? 3 : j ? 1 : 2]);
  }
}

// Gaivota pousada, virada para a esquerda; flap abre as asas num pulinho.
function paintPerchedGull(f, x, y, flap) {
  f.set(x - 1, y, C('#e8a83a'));
  f.set(x, y - 1, GULL[3]); f.set(x, y, GULL[3]); f.set(x + 1, y, GULL[3]);
  f.set(x, y + 1, GULL[3]); f.set(x + 1, y + 1, GULL[2]); f.set(x + 2, y + 1, GULL[1]); f.set(x + 3, y + 1, GULL[0]);
  f.set(x + 1, y + 2, GULL[2]); f.set(x + 2, y + 2, GULL[1]);
  f.set(x + 1, y + 3, C('#e8a83a'));
  if (flap) { f.set(x + 2, y - 1, GULL[2]); f.set(x + 3, y - 2, GULL[1]); f.set(x - 1, y - 2, GULL[2]); }
}

const harborArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintHarborPortrait(ctx, t, info) {
  const a = harborArt;
  if (!a.bg) {
    a.bg = buildHarborBackdrop();
    a.body = buildHarbor();
    a.row = buildRowboat();
    a.barge = buildBarge();
    a.far = buildFarShip();
    a.clouds = [makeCloud(20, 8, 7), makeCloud(14, 6, 21)];
    // mar: para cada pixel, a cor em 32 fases da onda (o quadro só consulta a tabela)
    const idx = [], tab = [], ph = [];
    for (let y = HORIZON + 1; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        if (a.body.get(x, y) || !SEA.includes(a.bg.get(x, y)) || (y > 48 && y < 54 && x > 12)) continue;
        idx.push(y * 64 + x);
        for (let k = 0; k < 32; k++) tab.push(pick(SEA, seaValue(x, y, (k / 32) * Math.PI * 2), x, y, 2));
        ph.push(Math.floor(((x * 0.9 + y * 3.1) / (Math.PI * 2)) * 256) & 255, Math.floor(((x * 0.23 + y) / (Math.PI * 2)) * 256) & 255);
      }
    }
    a.sea = { idx: Int32Array.from(idx), tab: Uint32Array.from(tab), ph: Uint8Array.from(ph) };
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 1.2) % 90) - 20), 3);
  f.blit(a.clouds[1], Math.floor(((t * 0.8 + 40) % 82) - 14), 13);
  // navio cruzando o horizonte, bem devagar
  f.blit(a.far, Math.floor(((t * 0.45 + 30) % 84) - 12), HORIZON - 8);
  // ondas: cristas correndo e brilhos do sol
  const { idx, tab, ph } = a.sea;
  const step = Math.floor(t * (working ? 2.2 : 1.4) * (32 / (Math.PI * 2)));
  const g1 = Math.floor(t * 2.1 * (256 / (Math.PI * 2))), g2 = Math.floor(t * 0.7 * (256 / (Math.PI * 2)));
  for (let k = 0; k < idx.length; k++) {
    const glint = SIN[(ph[k * 2] + g1) & 255] * SIN[(ph[k * 2 + 1] - g2) & 255];
    f.d[idx[k]] = glint > 0.86 ? SEA[6] : tab[k * 32 + (step & 31)];
  }
  f.blit(a.body, 0, 0);
  // barcos amarrados balançando na água
  const bob = (p0) => Math.round(Math.sin(t * 1.5 + p0) * 0.6 + Math.sin(t * 0.7 + p0 * 2) * 0.4);
  const bb = bob(0), rb = bob(1.7);
  f.blit(a.barge, 44, 44 + bb);
  f.line(45, 49 + bb, 44, 46, PAL.linen[2]);
  f.blit(a.row, 16, 54 + rb);
  f.line(18, 55 + rb, 16, 50, PAL.linen[2]);
  // guindaste: com trabalho, o fardo sobe e desce e a roda gira junto
  const lift = working ? 0.5 - 0.5 * Math.cos(t * 0.55) : 0.3;
  const cy = 11 + lift * 27 + (lift > 0.98 ? bb : 0);
  paintWheelSpokes(f, cy / WHEEL[2]);
  paintCargo(f, cy, Math.round(Math.sin(t * 1.3) * (working ? 0.4 : 0.8)));
  // bandeirola no topo do guindaste
  f.rect(38, 2, 1, 5, PAL.wood[3]);
  paintPennant(f, 38, 2, 7, t * (working ? 6 : 4), PAL.banner);
  // gaivotas: duas voando em círculos e uma pousada na cumeeira
  for (let k = 0; k < 2; k++) {
    const p0 = t * (0.5 + k * 0.17) + k * 2.4;
    paintGull(f, 26 + k * 18 + Math.cos(p0) * (9 - k * 3), 9 + k * 7 + Math.sin(p0 * 1.6) * 2.5, Math.sin(t * 7 + k * 1.9));
  }
  const hop = pulse(t + 1, 7, 0.8);
  paintPerchedGull(f, 9, 10 - Math.round(hop * 2), hop > 0.3);
  f.draw(ctx);
}

function iconHarbor() {
  const p = new Pix(16, 16);
  // água
  p.rect(0, 12, 16, 4, (x, y) => pick(SEA, 0.6 - (y - 12) * 0.12 + ((x + y * 2) % 5 === 0 ? 0.25 : 0), x, y));
  // cais com estacas
  p.rect(0, 10, 12, 2, (x, y) => PAL.wood[y === 10 ? 4 : 2]);
  for (const x of [1, 6, 10]) p.rect(x, 12, 1, 3, PAL.wood[1]);
  // guindaste: mastro, lança e o fardo pendurado
  p.rect(4, 2, 2, 8, (x) => PAL.wood[x === 4 ? 4 : 2]);
  p.line(5, 2, 13, 0, PAL.wood[3]);
  p.line(5, 6, 9, 1, PAL.wood[2]);
  p.rect(13, 1, 1, 4, PAL.linen[3]);
  p.sphere(13, 6.5, 2.2, 2, BURLAP, 0.15);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Navio

const SKY_DEEP = ramp('#2a5690', '#36679f', '#4479af', '#568cbd', '#6ea2ca', '#8ebad6', '#b4d2e0', '#d8e8e6');
const SHIP_HZ = 42; // horizonte do mar alto
const STERN = 9, CASTLE_X = 22, CASTLE_Y = 33, WATERLINE = 47;
const sheerOf = (x) => 40 - ((x - 32) / 23) ** 2 * 3.6; // borda do casco
const bottomOf = (x) => 50 - ((x - 31) / 24) ** 4 * 5.5;
const bowOf = (y) => 56.5 - (y - 36) * 0.45;
const inHull = (x, y) => x >= STERN && x <= bowOf(y) && y >= sheerOf(x) && y <= bottomOf(x);
const inCastle = (x, y) => x >= STERN && x < CASTLE_X && y >= CASTLE_Y && y < sheerOf(x) + 1;
// velas latinas: ponta de baixo da verga (vante), ponta de cima (ré) e punho da escota
const SAILS = [
  { a: [26, 30], b: [9, 13], c: [11, 32], mast: 17.5, top: 17, deck: CASTLE_Y },
  { a: [43, 36], b: [18, 6], c: [22, 38], mast: 32.5, top: 9, deck: 40 },
  { a: [55, 33], b: [36, 10], c: [39, 37], mast: 45.5, top: 16, deck: 39 },
];

function buildShipBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, SHIP_HZ, SKY_DEEP, 1.4);
  // ilha ao longe, terra à vista
  for (let x = 44; x < 64; x++) {
    const top = SHIP_HZ - 1 - Math.round(Math.max(0, 4.2 - Math.abs(x - 55) * 0.45 + Math.sin(x * 1.1) * 0.5));
    for (let y = top; y < SHIP_HZ; y++) p.set(x, y, pick(HILL_FAR, (y === top ? 0.75 : 0.42) - (x - 55) * 0.02 - (y - top) * 0.05, x, y));
  }
  for (let y = SHIP_HZ; y < 64; y++) {
    for (let x = 0; x < 64; x++) p.set(x, y, pick(SEA, y === SHIP_HZ ? 0.9 : seaValue(x, y, 0, SHIP_HZ), x, y, 2));
  }
  return p;
}

function buildSail({ a, b, c }) {
  const q = new Pix(64, 64);
  const [ax, ay] = a, [bx, by] = b, [cx, cy] = c;
  // coordenadas baricêntricas: lc = 0 na verga e 1 no punho da escota
  const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  const bary = (x, y) => {
    const la = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det;
    const lb = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det;
    return [la, lb, 1 - la - lb];
  };
  // a esteira (de c até a) estufa para fora, cheia de vento
  const hb = Math.abs(det) / Math.hypot(ax - cx, ay - cy);
  const inside = (x, y) => {
    const [la, lb, lc] = bary(x, y);
    if (la < 0 || lc < 0) return false;
    const s = la / Math.max(1e-6, la + lc);
    return lb >= -(Math.sin(s * Math.PI) * 2.4) / hb;
  };
  q.fill(Math.min(ax, bx, cx) - 3, Math.min(ay, by, cy), Math.max(ax, bx, cx) + 3, Math.max(ay, by, cy) + 3, inside, (x, y) => {
    const [la, lb, lc] = bary(x + 0.5, y + 0.5);
    // mais claro no alto da ré, sombra embaixo da verga e na barriga perto da esteira
    let v = 0.8 + lb * 0.22 - la * 0.18 - lc * 0.3 + Math.sin(clamp01(lc) * Math.PI) * 0.1;
    if (lc < 0.06) v -= 0.22;
    if (Math.floor(x + y * 0.2) % 3 === 0) v -= 0.09; // costuras dos panos
    return pick(PAL.sail, v, x, y, 2.4);
  });
  // verga
  q.line(ax, ay, bx, by, (x) => PAL.wood[x % 4 ? 2 : 1]);
  q.outline(PAL.out);
  return q;
}

function buildHullShip(p) {
  // casco de tábuas seguindo a curva da borda
  p.fill(STERN, CASTLE_Y, 60, 51, (x, y) => inHull(x + 0.5, y + 0.5) || inCastle(x + 0.5, y + 0.5), (x, y) => {
    const castle = x < CASTLE_X && y < sheerOf(x) + 1;
    const y0 = castle ? CASTLE_Y : Math.floor(sheerOf(x + 0.5));
    const r = Math.floor((y - y0) / 2);
    let v = 0.64 - (y - 37) * 0.04 + (hash(Math.floor((x + r * 5) / 7), r, 61) - 0.5) * 0.12 - (x - 30) * 0.004;
    if (((y - y0) & 1) === 1) v -= 0.12;
    if (x === STERN) v -= 0.15;
    return pick(HULL, v, x, y);
  });
  // cintas escuras e um friso ocre logo abaixo da borda
  for (let x = STERN; x <= 57; x++) {
    const sy = sheerOf(x + 0.5);
    for (const [dy, c] of [[1, HULL[4]], [3, PAL.gold[2]], [4, PAL.gold[1]], [7, HULL[0]], [8, HULL[1]]]) {
      const y = Math.floor(sy + dy);
      if (inHull(x + 0.5, y + 0.5)) p.set(x, y, c);
    }
  }
  // castelo de popa: amurada com balaústres, janelinhas e a lanterna
  p.rect(STERN, CASTLE_Y - 2, CASTLE_X - STERN, 1, (x) => PAL.wood[x < 15 ? 4 : 3]);
  for (let x = STERN; x < CASTLE_X; x += 2) p.set(x, CASTLE_Y - 1, PAL.wood[2]);
  p.rect(10, 34, 11, 1, PAL.gold[3]);
  p.rect(10, 37, 11, 1, PAL.gold[1]);
  for (let x = 11; x < 20; x += 2) p.rect(x, 35, 1, 2, (xx, y) => (y === 35 ? PAL.glassHi : PAL.glass));
  p.rect(CASTLE_X - 1, CASTLE_Y, 1, 6, HULL[1]);
  p.rect(STERN - 1, 27, 1, 4, PAL.iron[2]);
  p.rect(STERN - 2, 25, 3, 2, (x, y) => PAL.gold[y === 25 ? 4 : 2]);
  p.set(STERN - 1, 26, PAL.fire[4]);
  // leme, amurada da proa e escovém
  p.rect(STERN - 2, 39, 2, 9, (x, y) => pick(PAL.wood, (x === STERN - 2 ? 0.55 : 0.3) - (y - 39) * 0.02, x, y));
  for (let x = 48; x <= 55; x += 2) p.set(x, Math.floor(sheerOf(x)) - 1, PAL.wood[3]);
  p.line(48, Math.floor(sheerOf(48)) - 2, 55, Math.floor(sheerOf(55)) - 2, PAL.wood[4]);
  p.sphere(52, 40.5, 1.1, 1.1, TAR, 0);
}

function buildShip() {
  const p = new Pix(64, 64);
  // enxárcias: cabos dos mastros até a borda
  for (const { mast, top } of SAILS) {
    for (const dx of [-5, -2, 3]) p.line(mast + dx, Math.floor(sheerOf(mast + dx)), Math.floor(mast), top + 3, PAL.wood[1]);
  }
  for (const s of SAILS) p.blit(buildSail(s), 0, 0);
  // mastros por cima das velas, com o cesto da gávea no grande
  for (const { mast, top, deck } of SAILS) {
    const x = Math.floor(mast);
    p.rect(x, top, 1, deck - top, (xx, y) => PAL.wood[y % 6 === 0 ? 2 : 4]);
    p.set(x, top - 1, PAL.gold[4]);
  }
  p.rect(30, 12, 6, 3, (x, y) => pick(PAL.wood, (y === 12 ? 0.8 : 0.4) - (x - 30) * 0.06, x, y));
  buildHullShip(p);
  p.outline(PAL.out);
  return p;
}

// Bandeirolas longas no topo dos mastros, soprando para a proa.
function paintShipPennants(f, t, oy, live) {
  SAILS.forEach(({ mast, top }, k) => {
    const len = k === 1 ? 9 : 6;
    const ph = t * (3.5 + live * 3) + k * 1.7;
    for (let i = 0; i < len; i++) {
      const dy = Math.round(Math.sin(ph - i * 0.8) * (i / len) * 1.6);
      const c = i < 2 ? PAL.gold[4] : PAL.banner[Math.cos(ph - i * 0.8) > 0 ? 3 : 2];
      f.set(Math.floor(mast) + 1 + i, top - 1 + dy + oy, c);
      if (i < len - 3) f.set(Math.floor(mast) + 1 + i, top + dy + oy, i < 2 ? PAL.gold[2] : PAL.banner[1]);
    }
  });
}

const shipArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintShipPortrait(ctx, t, info) {
  const a = shipArt;
  if (!a.bg) {
    a.bg = buildShipBackdrop();
    a.body = buildShip();
    a.clouds = [makeCloud(26, 9, 4), makeCloud(18, 7, 9), makeCloud(13, 6, 30)];
    const idx = [], tab = [], ph = [];
    for (let y = SHIP_HZ + 1; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        idx.push(y * 64 + x);
        for (let k = 0; k < 32; k++) tab.push(pick(SEA, seaValue(x, y, (k / 32) * Math.PI * 2, SHIP_HZ), x, y, 2));
        ph.push(Math.floor(((x * 0.9 + y * 3.1) / (Math.PI * 2)) * 256) & 255, Math.floor(((x * 0.23 + y) / (Math.PI * 2)) * 256) & 255);
      }
    }
    a.sea = { idx: Int32Array.from(idx), tab: Uint32Array.from(tab), ph: Uint8Array.from(ph) };
  }
  const working = info.working, live = working ? 1 : 0;
  const f = a.frame.copyFrom(a.bg);
  // nuvens ficando para trás
  f.blit(a.clouds[0], Math.floor(70 - ((t * 1.6) % 100)), 3);
  f.blit(a.clouds[1], Math.floor(70 - ((t * 1.1 + 50) % 94)), 17);
  f.blit(a.clouds[2], Math.floor(68 - ((t * 0.8 + 20) % 88)), 30);
  // mar: ondas correndo para a popa
  const { idx, tab, ph } = a.sea;
  const step = Math.floor(t * (working ? 3 : 1.8) * (32 / (Math.PI * 2)));
  const g1 = Math.floor(t * 2.1 * (256 / (Math.PI * 2))), g2 = Math.floor(t * 0.7 * (256 / (Math.PI * 2)));
  for (let k = 0; k < idx.length; k++) {
    const glint = SIN[(ph[k * 2] + g1) & 255] * SIN[(ph[k * 2 + 1] - g2) & 255];
    f.d[idx[k]] = glint > 0.88 ? SEA[6] : tab[k * 32 + (step & 31)];
  }
  // o navio sobe e desce nas ondas
  const oy = Math.round(Math.sin(t * 1.25) * 0.9);
  // reflexo escuro do casco na água
  for (let x = 10; x < 54; x++) {
    for (let y = WATERLINE + 1; y < WATERLINE + 6; y++) {
      if ((x * 2 + y * 3 + Math.floor(t * 4)) % 5 < 2 + (y < WATERLINE + 3 ? 2 : 0)) f.set(x, y + oy, SEA[1]);
    }
  }
  f.blit(a.body, 0, oy);
  // ondas batendo no casco na linha d'água
  for (let x = STERN - 2; x < 57; x++) {
    const wy = WATERLINE + oy + Math.round(Math.sin(x * 0.55 + t * (2 + live)) * 0.7);
    for (let y = wy; y < WATERLINE + 5 + oy; y++) f.set(x, y, SEA[y === wy ? 4 : 3 - (y - wy > 1 ? 1 : 0)]);
    if (Math.sin(x * 1.3 + t * 5) > 0.55) f.set(x, wy, SEA[6]);
  }
  // espuma da proa e esteira atrás da popa
  for (let k = 0; k < (working ? 9 : 5); k++) {
    const life = (t * (0.9 + hash(k, 1, 62) * 0.6) + hash(k, 2, 62)) % 1;
    const x = 53 + life * 6 - hash(k, 3, 62) * 3, y = WATERLINE - 1 + oy - Math.sin(life * Math.PI) * 3;
    f.set(x, y, life < 0.6 ? SEA[6] : SEA[5]);
  }
  for (let k = 0; k < 7; k++) {
    const life = (t * 0.5 + k / 7) % 1;
    const x = STERN - 3 - life * 14, y = WATERLINE + oy + (k % 3);
    f.set(x, y, SEA[6]);
    f.set(x - 1, y, SEA[5]);
  }
  paintShipPennants(f, t, oy, live);
  // gaivotas seguindo o navio
  for (let k = 0; k < 3; k++) {
    const p0 = t * (0.45 + k * 0.13) + k * 2.1;
    paintGull(f, [54, 6, 27][k] + Math.cos(p0) * 6, [7, 9, 3][k] + Math.sin(p0 * 1.4) * 2.5, Math.sin(t * 6.5 + k * 2.3));
  }
  f.draw(ctx);
}

function iconShip() {
  const p = new Pix(16, 16);
  // mar
  p.rect(0, 13, 16, 3, (x, y) => pick(SEA, 0.6 - (y - 13) * 0.15 + ((x + y * 3) % 5 === 0 ? 0.3 : 0), x, y));
  // casco
  p.poly([[1, 9], [6, 10], [12, 10], [15, 8], [13, 13], [3, 13]], (x, y) => pick(HULL, 0.62 - (y - 9) * 0.1 - (y === 11 ? 0.2 : 0), x, y));
  p.rect(1, 8, 4, 2, (x, y) => PAL.wood[y === 8 ? 4 : 3]);
  p.rect(2, 11, 11, 1, PAL.gold[2]);
  // duas velas latinas
  p.poly([[2, 7], [7, 0], [8, 7.6]], (x, y) => pick(PAL.sail, 0.95 - (y + x * 0.2) * 0.04, x, y));
  p.poly([[8, 8], [11, 1], [15, 8]], (x, y) => pick(PAL.sail, 0.85 - (y + (x - 8) * 0.3) * 0.05, x, y));
  p.line(2, 7, 7, 0, PAL.wood[2]);
  p.line(8, 8, 11, 1, PAL.wood[2]);
  p.set(11, 0, PAL.banner[3]); p.set(12, 0, PAL.banner[2]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Navegador

const CABIN = ramp('#120c0a', '#1c130e', '#281b13', '#362418', '#4a3020', '#5e3e28', '#785032', '#94683e');
const PARCH = ramp('#5e4628', '#8a6c42', '#b4966a', '#d4bc8e', '#ecdcb2');
const INK = C('#4a2e1a');
const NAVY = ramp('#0a0e22', '#121a38', '#1c2852', '#283a70', '#38508e', '#4e6aac', '#6e8cc8');
const FELT_HAT = ramp('#0e0c12', '#18141c', '#241e2a', '#322a3a', '#44394c', '#5a4c62');
const BEARD = ramp('#1a120e', '#2e2018', '#463224', '#5e4634', '#7c6450', '#a08a76', '#c4b4a2');
const NAV_LANTERN = [57, 15]; // base da chama
const WIN = { x0: 4, y0: 7, x1: 21, y1: 29 }; // vidro da janela
const ASTRO = [46, 53.5, 7.6, 5.6]; // centro, raio de fora e raio da placa

// Luz que pulsa: compara o fundo apagado com o aceso e guarda, para cada pixel que muda,
// um limiar. A cada quadro acendem os pixels com limiar abaixo do nível pedido.
function makeHalo(base, lit, threshold) {
  const idx = [], th = [], col = [];
  for (let i = 0; i < 64 * 64; i++) {
    if (base.d[i] === lit.d[i]) continue;
    const x = i & 63, y = i >> 6;
    idx.push(i);
    th.push(threshold(x, y) + (bayer(x, y) - 0.5) * 0.28);
    col.push(lit.d[i]);
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

const inWinGlass = (x, y) => x >= WIN.x0 && x <= WIN.x1 && y >= WIN.y0 && y <= WIN.y1 &&
  !(y < WIN.y0 + 2 && (x < WIN.x0 + 2 - (y - WIN.y0) || x > WIN.x1 - 2 + (y - WIN.y0)));
// caixilhos de chumbo da janela
const inLead = (x, y) => x === 12 || x === 13 || x === 8 || x === 17 || y === 13 || y === 18 || y === 24;

function buildNavBackdrop(glow) {
  const p = new Pix(64, 64);
  const [lx, ly] = NAV_LANTERN;
  const lantern = (x, y) => (0.36 + glow * 0.22) * clamp01(1 - Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 1.1) / (26 + glow * 8)) ** 1.5;
  const window = (x, y) => 0.3 * clamp01(1 - Math.hypot((x + 0.5 - 12) * 0.8, y + 0.5 - 22) / 30) ** 1.4;
  // tábuas do costado da cabine, na horizontal
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const row = Math.floor(y / 4), ry = y % 4;
      const seam = (x + row * 13) % 21 === 0;
      let v = 0.2 + lantern(x, y) + window(x, y) + (hash(Math.floor((x + row * 13) / 21), row, 71) - 0.5) * 0.1 + (hash(x, y, 72) - 0.5) * 0.05;
      if (ry === 3 || seam) v -= 0.12;
      else if (ry === 0) v += 0.05;
      p.d[y * 64 + x] = pick(CABIN, v, x, y, 2);
    }
  }
  // viga do teto com cavilhas
  p.rect(0, 0, 64, 3, (x, y) => pick(PAL.wood, (y === 2 ? 0.45 : 0.2) + lantern(x, y) * 0.8 + (hash(x >> 2, y, 73) - 0.5) * 0.1, x, y));
  p.rect(0, 3, 64, 1, CABIN[0]);
  for (const x of [8, 30, 50]) p.set(x, 1, PAL.gold[2]);
  // janela: moldura de madeira, peitoril e o vidro (o mar é pintado a cada quadro)
  p.fill(WIN.x0 - 2, WIN.y0 - 2, WIN.x1 + 2, WIN.y1 + 2, (x, y) => inWinGlass(x - 0.5, y - 0.5) || inWinGlass(x + 1.5, y + 1.5) || inWinGlass(x + 1.5, y - 0.5) || inWinGlass(x - 0.5, y + 1.5), (x, y) =>
    pick(PAL.wood, (x < WIN.x0 || y < WIN.y0 ? 0.55 : 0.3) + window(x, y) + (hash(x, y >> 1, 74) - 0.5) * 0.1, x, y));
  p.rect(WIN.x0 - 3, WIN.y1 + 2, WIN.x1 - WIN.x0 + 7, 2, (x, y) => pick(PAL.wood, (y === WIN.y1 + 2 ? 0.85 : 0.35) - (x - WIN.x0) * 0.01, x, y));
  p.fill(WIN.x0, WIN.y0, WIN.x1, WIN.y1, (x, y) => inWinGlass(x, y), (x, y) => (inLead(x, y) ? (x === 13 || y === 18 ? PAL.wood[1] : PAL.iron[0]) : PAL.sky[3]));
  // lanterna de latão pendurada na viga
  const [cx] = NAV_LANTERN;
  p.rect(cx, 4, 1, 3, (x, y) => PAL.iron[y % 2 ? 3 : 1]);
  p.rect(cx - 2, 7, 5, 1, PAL.gold[3]);
  p.rect(cx - 3, 8, 7, 1, PAL.gold[2]);
  p.rect(cx - 3, 9, 7, 7, (x, y) => {
    if (x === cx - 3 || x === cx + 3) return PAL.gold[x < cx ? 3 : 1];
    return pick(PAL.fire, 0.45 + glow * 0.25 - Math.abs(x - cx) * 0.08 + (y - 9) * 0.03, x, y);
  });
  p.rect(cx, 9, 1, 7, PAL.gold[2]);
  p.rect(cx - 3, 16, 7, 2, (x, y) => PAL.gold[y === 16 ? 3 : 1]);
  p.set(cx, 18, PAL.gold[1]);
  // carta náutica pregada na parede: costa, rumo pontilhado e rosa dos ventos
  const mx0 = 47, my0 = 22, mx1 = 63, my1 = 44;
  p.fill(mx0, my0, mx1, my1, () => true, (x, y) => {
    let v = 0.55 + lantern(x, y) * 0.9 - (y - my0) * 0.006 + (hash(x, y, 75) - 0.5) * 0.12;
    if (x === mx0 || y === my0) v += 0.12;
    if (y === my1) v -= 0.25;
    const coast = 30 + Math.sin(x * 0.7) * 2 + (x - 47) * 0.55;
    if (y > coast) {
      if (y < coast + 1) return INK;
      v -= 0.12;
    }
    return pick(PARCH, v, x, y);
  });
  for (let x = mx0 + 2; x < mx1; x += 2) {
    const y = Math.round(40 - (x - mx0) * 0.75 + Math.sin(x * 0.5) * 0.8);
    if (y > my0 + 1) p.set(x, y, PAL.banner[2]);
  }
  p.fill(47, 23, 54, 30, (x, y) => Math.abs(Math.hypot(x - 50.5, y - 26.5) - 2.4) < 0.6, INK);
  for (const [x, y, c] of [[52, 24, PAL.banner[3]], [51, 25, PAL.banner[2]], [50, 26, INK], [49, 27, PARCH[1]], [52, 23, PAL.banner[2]]]) p.set(x, y, c);
  for (const [x, y] of [[mx0, my0], [mx1, my0]]) p.set(x, y, PAL.iron[3]);
  return p;
}

function inNavHead(x, y) {
  const dy = (y - 31) / 12;
  const rx = dy > 0 ? 10.4 * (1 - 0.32 * dy * dy) : 10.4;
  return ((x - 32) / rx) ** 2 + dy * dy <= 1;
}

function navEyes(p, closed) {
  for (const x0 of [26, 36]) {
    const left = x0 === 26;
    if (closed) {
      for (let i = 0; i < 3; i++) { p.set(x0 + i, 28, BEARD[1]); p.set(x0 + i, 29, PAL.skin[left ? 3 : 2]); }
      continue;
    }
    const row = left ? [PAL.eyeWhite, BROWN_IRIS, BEARD[0]] : [BEARD[0], BROWN_IRIS, PAL.eyeWhite];
    row.forEach((c, i) => p.set(x0 + i, 28, c));
    p.set(left ? x0 + 1 : x0 + 1, 28, BROWN_IRIS);
    for (let i = 0; i < 3; i++) p.set(x0 + i, 29, PAL.skin[left ? 3 : 2]);
    p.set(left ? x0 + 2 : x0, 27, BEARD[1]);
  }
}
const BROWN_IRIS = C('#4a3020');

function buildNavigator() {
  const p = new Pix(64, 64);
  // casaco azul-marinho de pano grosso
  p.poly([[0, 64], [1, 55], [6, 49.5], [14, 46], [24, 44.5], [40, 44.5], [50, 46], [58, 49.5], [63, 55], [64, 64]], (x, y) => {
    const nx = (x + 0.5 - 32) / 31;
    let v = 0.46 - nx * 0.34 - (y - 50) * 0.008 + (hash(x, y, 76) - 0.5) * 0.1;
    v += clamp01(1 - Math.hypot((x - 10) / 8, (y - 52) / 5)) * 0.2; // ombro na luz da janela
    if ((x + y * 2) % 7 === 0) v -= 0.06;
    return pick(NAVY, v, x, y, 1.8);
  });
  // gola virada com debrum dourado e a camisa de linho aparecendo
  const lapel = (dir) => {
    const X = (x) => 32 + dir * x;
    const pts = [[X(4), 45], [X(12), 45.5], [X(15), 52], [X(9), 64], [X(5), 64], [X(3), 52]];
    p.poly(pts, (x, y) => pick(NAVY, (dir < 0 ? 0.62 : 0.3) - (y - 46) * 0.012, x, y));
    p.line(X(12), 46, X(15), 52, PAL.gold[dir < 0 ? 4 : 2]);
    p.line(X(15), 52, X(9), 63, PAL.gold[dir < 0 ? 3 : 2]);
  };
  p.poly([[26, 45], [38, 45], [35, 58], [32, 62], [29, 58]], (x, y) => pick(PAL.linen, 0.98 - (x - 26) * 0.035 - (y < 50 ? 0.25 : 0), x, y));
  lapel(-1);
  lapel(1);
  for (const y of [54, 59]) { p.set(31, y, PAL.linen[1]); p.set(33, y, PAL.linen[1]); }
  // cabelo grisalho caindo dos lados até os ombros
  p.fill(18, 18, 47, 46, (x, y) => Math.abs(x - 32) <= 12.6 - Math.max(0, y - 40) * 0.7 && Math.abs(x - 32) >= 7 && y > 19, (x, y) => {
    let v = 0.25 + sphereLight((x + 0.5 - 32) / 13, (y + 0.5 - 30) / 16) * 0.6 + Math.sin(x * 1.6) * 0.12 + (hash(x, y, 77) - 0.5) * 0.16;
    if (y > 42) v -= 0.12;
    return pick(BEARD, v, x, y, 1.6);
  });
  // rosto curtido de sol
  p.fill(21, 18, 43, 44, inNavHead, (x, y) => {
    let v = 0.26 + sphereLight((x + 0.5 - 32) / 10.4 * 0.8, (y + 0.5 - 31) / 12 * 0.45 - 0.12) * 0.66;
    if (y < 25) v -= 0.26; // sombra da aba
    return pick(PAL.skin, v, x, y, 6);
  });
  // orelhas meio escondidas no cabelo
  p.sphere(21.6, 30.5, 1.6, 2.6, PAL.skin, -0.05);
  p.sphere(42.4, 30.5, 1.6, 2.6, PAL.skin, -0.3);
  // sobrancelhas grossas, olhos apertados de quem olha o horizonte e rugas
  for (const [x, y, k] of [[25, 27, 2], [26, 26, 3], [27, 26, 4], [28, 26, 3], [29, 27, 2]]) {
    p.set(x, y, BEARD[k]);
    p.set(64 - x, y, BEARD[Math.max(0, k - 1)]);
  }
  navEyes(p, false);
  for (const [x, y] of [[24, 28], [23, 29], [24, 30]]) { p.set(x, y, PAL.skin[2]); p.set(64 - x, y, PAL.skin[1]); }
  for (const x of [28, 29, 30, 34, 35, 36]) p.set(x, 24, PAL.skin[2]);
  for (const x of [27, 28]) { p.set(x, 30, PAL.skin[3]); p.set(64 - x, 30, PAL.skin[2]); }
  // nariz grande
  for (const [x, y, k] of [[32, 27, 4], [32, 28, 4], [32, 29, 5], [33, 29, 2], [32, 30, 4], [33, 30, 2], [31, 31, 3], [32, 31, 5], [33, 31, 2],
    [30, 32, 2], [31, 32, 1], [32, 32, 3], [33, 32, 1], [34, 32, 1]]) p.set(x, y, PAL.skin[k]);
  // faces coradas de vento
  for (const [x, y] of [[25, 31], [26, 31]]) { p.set(x, y, PAL.blush); p.set(64 - x, y, PAL.blush); }
  // barba cheia e grisalha, terminando em ponta
  const inBeard = (x, y) => {
    if (inNavHead(x, y)) return y > 33 || (Math.abs(x - 32) > 8.4 && y > 29.5) || (Math.abs(x - 32) > 6.6 && y > 32);
    return y > 40 && y < 50 && Math.abs(x - 32) <= 8.4 - (y - 41) * 0.95;
  };
  p.fill(20, 29, 44, 50, inBeard, (x, y) => {
    const nx = (x + 0.5 - 32) / 11, ny = (y + 0.5 - 37) / 13;
    let v = 0.15 + sphereLight(nx, ny) * 0.72 + (hash(x, y, 78) - 0.5) * 0.2;
    if ((x * 2 + Math.floor(y / 2)) % 5 === 0) v -= 0.14; // mechas
    if (hash(x, y, 79) < 0.12) v += 0.28; // fios brancos
    return pick(BEARD, v, x, y, 1.5);
  });
  // bigode e boca
  for (let x = 27; x <= 37; x++) p.set(x, 33, BEARD[x < 32 ? 5 : x < 35 ? 4 : 3]);
  for (let x = 25; x <= 39; x++) if (x < 30 || x > 34) p.set(x, 34, BEARD[x < 32 ? 4 : 2]);
  for (const x of [25, 26, 38, 39]) p.set(x, 35, BEARD[x < 32 ? 3 : 1]);
  p.set(25, 36, BEARD[2]); p.set(39, 36, BEARD[1]);
  for (let x = 30; x <= 34; x++) p.set(x, 34, PAL.skin[0]);
  for (let x = 31; x <= 33; x++) p.set(x, 35, PAL.lip);

  // chapéu de feltro de aba larga, com fita dourada e uma pluma
  p.fill(20, 4, 45, 18, (x, y) => ((x - 32.5) / 11.4) ** 2 + ((y - 14) / 9) ** 2 <= 1 && y < 18, (x, y) => {
    let v = 0.1 + sphereLight((x + 0.5 - 31) / 11.4, (y + 0.5 - 10) / 9) * 0.95;
    if (y > 15) v -= (y - 15) * 0.08;
    if ((x === 32 && y < 10) || (x === 33 && y >= 10 && y < 12)) v -= 0.22; // vinco da copa
    return pick(FELT_HAT, v, x, y, 1.6);
  });
  for (let x = 21; x <= 44; x++) {
    const lit = cylLight((x + 0.5 - 32.5) / 12);
    p.set(x, 15, PAL.gold[lit > 0.6 ? 4 : lit > 0.35 ? 3 : 2]);
    p.set(x, 16, PAL.gold[lit > 0.6 ? 2 : 1]);
  }
  // aba: elipse larga, mais clara na borda de cima, que pega a luz da janela
  p.fill(11, 14, 54, 23, (x, y) => ((x - 32.5) / 21) ** 2 + ((y - 18.6) / 3.6) ** 2 <= 1 && !(((x - 32.5) / 11.6) ** 2 + ((y - 15.4) / 2.2) ** 2 <= 1 && y < 17), (x, y) => {
    const ny = (y + 0.5 - 18.6) / 3.6, nx = (x + 0.5 - 32.5) / 21;
    let v = 0.42 - ny * 0.32 - nx * 0.22;
    if (ny > 0.55) v -= 0.18;
    return pick(FELT_HAT, v, x, y, 1.6);
  });
  // pluma creme presa na fita, curvando para trás
  const plume = [[40, 15], [43, 11.5], [46.5, 8.6], [50, 7.4], [52.4, 8.4]];
  p.fill(38, 5, 54, 17, (x, y) => nearestOnPath(plume, x, y)[0] <= 0.8 + (x - 40) * 0.06, (x, y) => {
    const [d, ox, oy] = nearestOnPath(plume, x + 0.5, y + 0.5);
    const hw = 1 + (x - 40) * 0.06;
    let v = 0.3 + sphereLight(ox / hw, oy / hw) * 0.75;
    if (d < 0.4) v += 0.12;
    else if ((x + y) % 2 === 0) v -= 0.14;
    return pick(PAL.sail, v, x, y);
  });
  p.sphere(39.5, 15.5, 1.3, 1.3, PAL.gold, 0.2);

  // mão segurando o astrolábio pelo anel de cima, com o punho de renda
  const [ax, ay, ro] = ASTRO;
  p.poly([[49, 47], [55, 43], [64, 49], [64, 60], [54, 57]], (x, y) => pick(NAVY, 0.36 - (x - 49) * 0.012 + (hash(x, y, 80) - 0.5) * 0.1, x, y));
  p.poly([[48, 43], [51, 41], [54, 45.5], [50.5, 47.5]], (x, y) => PAL.gold[(x + y) % 3 === 0 ? 2 : 3]);
  for (let i = 0; i < 5; i++) p.set(47.6 + i * 0.7, 43.6 + i * 0.4 - (i & 1), PAL.linen[i & 1 ? 3 : 4]);
  // astrolábio de ouro: argola, anel graduado e a placa gravada
  p.fill(ax - 2, ay - ro - 4, ax + 2, ay - ro + 1, (x, y) => {
    const d = Math.hypot(x - ax, y - (ay - ro - 1.5));
    return d <= 1.8 && d >= 0.7;
  }, (x, y) => PAL.gold[y < ay - ro - 1.5 ? 4 : 2]);
  p.fill(ax - ro - 1, ay - ro - 1, ax + ro + 1, ay + ro + 1, (x, y) => Math.hypot(x - ax, y - ay) <= ro, (x, y) => {
    const dx = x + 0.5 - ax, dy = y + 0.5 - ay, r = Math.hypot(dx, dy);
    if (r > ASTRO[3]) {
      // limbo: anel claro e polido, com a graduação na borda de dentro
      const a = Math.atan2(dy, dx) + Math.PI;
      let v = 0.5 + sphereLight(dx / ro, dy / ro) * 0.62 - (r < ASTRO[3] + 0.8 ? 0.2 : 0);
      if (r < ASTRO[3] + 0.8 && Math.abs(((a * 4) / Math.PI + 0.5) % 1 - 0.5) < 0.16) v = 0.05; // marcas de 45 em 45 graus
      return pick(PAL.gold, v, x, y, 3);
    }
    // placa mais escura, com um círculo gravado e a linha do horizonte
    if (Math.abs(r - 3.4) < 0.5) return PAL.gold[x + y < ax + ay ? 3 : 2]; // círculo gravado
    return pick(PAL.gold, 0.1 + sphereLight(dx / ro * 0.5, dy / ro * 0.5) * 0.3, x, y, 3);
  });
  // a mão vem por cima da argola
  p.sphere(45.5, 41.2, 3.4, 2.4, PAL.skin, 0.12);
  // dedos dobrados, cada um com o nó claro e a dobra escura
  for (const [fx, k] of [[42, 4], [44, 4], [46, 3], [48, 2]]) {
    p.set(fx, 43, PAL.skin[k + 1]); p.set(fx + 1, 43, PAL.skin[k]);
    p.set(fx, 44, PAL.skin[k - 1]); p.set(fx + 1, 44, PAL.skin[k - 2]);
  }
  for (const x of [44, 46, 48]) { p.set(x, 42, PAL.skin[1]); p.set(x, 43, PAL.skin[0]); }
  p.line(42, 40, 45, 39, PAL.skin[5]);
  p.outline(PAL.out);
  return p;
}

// Alidade: régua de ouro com as pínulas, girando no centro do astrolábio.
function paintAlidade(f, ang) {
  const [ax, ay, , ri] = ASTRO;
  const dx = Math.cos(ang) * (ri - 0.4), dy = Math.sin(ang) * (ri - 0.4);
  f.line(ax - 0.5 - dx, ay - 0.5 - dy, ax - 0.5 + dx, ay - 0.5 + dy, (x, y) => PAL.gold[(x + y) % 2 ? 5 : 4]);
  // pínulas nas pontas e o pino do centro
  for (const s of [-0.62, 0.62]) {
    const px = ax - 0.5 + dx * s, py = ay - 0.5 + dy * s;
    f.set(px - Math.sin(ang), py + Math.cos(ang), PAL.gold[3]);
    f.set(px + Math.sin(ang), py - Math.cos(ang), PAL.gold[3]);
  }
  f.set(ax - 0.5, ay - 0.5, PAL.iron[1]);
}

const navArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintNavigatorPortrait(ctx, t, info) {
  const a = navArt;
  if (!a.bg) {
    a.bg = buildNavBackdrop(0);
    const [lx, ly] = NAV_LANTERN;
    a.halo = makeHalo(a.bg, buildNavBackdrop(1), (x, y) => Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 1.1) / 34);
    a.body = buildNavigator();
    a.glass = [];
    for (let y = WIN.y0; y <= WIN.y1; y++) {
      for (let x = WIN.x0; x <= WIN.x1; x++) if (inWinGlass(x, y) && !inLead(x, y) && !a.body.get(x, y)) a.glass.push(x, y);
    }
  }
  const working = info.working, live = working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  // mar visto pela janela: o horizonte balança com o navio
  const roll = Math.sin(t * 0.7), tilt = Math.sin(t * 0.7 + 1.2) * 0.06;
  const g = a.glass;
  for (let k = 0; k < g.length; k += 2) {
    const x = g[k], y = g[k + 1];
    const hz = 19.5 + roll * 1.4 + (x - 12.5) * tilt;
    let c;
    if (y < hz - 0.5) c = pick(PAL.sky, 0.25 + ((y - WIN.y0) / (hz - WIN.y0)) * 0.7, x, y, 1.5);
    else if (y < hz + 0.5) c = SEA[6];
    else {
      const w = Math.sin(x * 0.9 + y * 2.3 - t * (working ? 2.4 : 1.5)) * Math.sin(x * 0.3 - y + t * 0.5);
      c = w > 0.75 ? SEA[6] : pick(SEA, 0.72 - (y - hz) * 0.035 + w * 0.12, x, y, 2);
    }
    if ((x + y) % 9 === 0 && x - y > -12 && x - y < -6) c = PAL.sky[6]; // reflexo no vidro
    f.d[y * 64 + x] = c;
  }
  // gaivota passando lá fora de vez em quando
  const gx = ((t * 3) % 60) - 8;
  if (gx > WIN.x0 && gx < WIN.x1) {
    const gy = 11 + Math.sin(t * 0.9) * 2;
    for (const [dx, dy] of [[0, 0], [-1, -1], [1, -1], [-2, -1 - (Math.sin(t * 8) > 0 ? 1 : 0)], [2, -1 - (Math.sin(t * 8) > 0 ? 1 : 0)]]) {
      const x = Math.round(gx + dx), y = Math.round(gy + dy);
      if (inWinGlass(x, y) && !inLead(x, y)) f.set(x, y, GULL[3]);
    }
  }
  // lanterna: chama tremulando e a luz na parede
  const flick = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 12.1 + 2) * 0.3 + Math.sin(t * 2.9) * 0.2;
  paintHalo(f, a.halo, 0.45 + live * 0.1 + flick * 0.06 * live);
  paintFlame(f, NAV_LANTERN[0] + 0.5, NAV_LANTERN[1], t, 3.2 + live * 0.8, 1.1, live);
  f.blit(a.body, 0, 0);
  // a alidade gira lendo a altura do sol
  paintAlidade(f, working ? t * 0.5 : -0.6 + Math.sin(t * 0.4) * 0.35);
  if (t % 4.9 > 4.74 || t % 11.3 > 11.14) navEyes(f, true);
  // brilho no anel do astrolábio e na fivela do chapéu
  paintGlint(f, 41, 49, pulse(t, working ? 2.3 : 4, 0.6));
  paintGlint(f, 39, 15, pulse(t + 2, 6.3, 0.45) * 0.55);
  f.draw(ctx);
}

function iconNavigator() {
  const p = new Pix(16, 16);
  // rosto, barba e chapéu de aba larga
  p.sphere(8, 9.5, 3.8, 4.2, PAL.skin, 0.1);
  p.fill(3, 9, 13, 16, (x, y) => ((x - 8) / 4.4) ** 2 + ((y - 10.5) / 5) ** 2 <= 1 && (y > 11.5 || Math.abs(x - 8) > 3), (x, y) =>
    pick(BEARD, 0.62 - (y - 11) * 0.06 - (x - 6) * 0.05 + (hash(x, y, 81) < 0.2 ? 0.25 : 0), x, y));
  for (let x = 6; x <= 9; x++) p.set(x, 11, BEARD[x < 8 ? 5 : 4]);
  p.set(6, 9, BEARD[0]);
  p.set(9, 9, BEARD[0]);
  p.fill(3, 0, 13, 6, (x, y) => ((x - 8) / 4.6) ** 2 + ((y - 5) / 4.4) ** 2 <= 1 && y < 6, (x, y) =>
    pick(FELT_HAT, 0.3 + sphereLight((x + 0.5 - 8) / 4.6, (y + 0.5 - 3) / 4.4) * 0.8, x, y));
  p.rect(0, 6, 16, 2, (x, y) => pick(FELT_HAT, (y === 6 ? 0.75 : 0.35) - (x - 8) * 0.03, x, y));
  p.rect(4, 5, 8, 1, (x) => PAL.gold[x < 8 ? 4 : 3]);
  // astrolábio no canto
  p.fill(10, 10, 16, 16, (x, y) => Math.hypot(x - 13, y - 13) <= 2.8, (x, y) => (Math.hypot(x - 13, y - 13) < 1.5 ? PAL.gold[2] : PAL.gold[x + y < 26 ? 5 : 3]));
  p.set(12, 12, PAL.gold[5]);
  p.set(13, 13, PAL.gold[1]);
  p.outline(PAL.out);
  return p;
}

ART.portraits.road = paintRoadPortrait;
ART.locked.road = ART.silhouette(() => {
  const p = buildRoad();
  p.blit(buildWalkers(WALK_COL[0])[0][0][0], 8, 46); // o viajante parado na estrada
  return p;
});
ART.icons.road = iconRoad;
ART.portraits.harbor = paintHarborPortrait;
ART.locked.harbor = ART.silhouette(() => {
  const p = buildHarbor();
  p.blit(buildBarge(), 44, 44);
  p.blit(buildRowboat(), 16, 54);
  paintWheelSpokes(p, 0.3);
  paintCargo(p, 22, 0);
  p.rect(38, 2, 1, 5, PAL.wood[3]);
  paintPennant(p, 38, 2, 7, 1, PAL.banner);
  return p;
});
ART.icons.harbor = iconHarbor;
ART.portraits.ship = paintShipPortrait;
ART.locked.ship = ART.silhouette(() => {
  const p = buildShip();
  paintShipPennants(p, 0, 0, 0);
  return p;
});
ART.icons.ship = iconShip;
ART.portraits.navigator = paintNavigatorPortrait;
ART.locked.navigator = ART.silhouette(() => {
  const p = buildNavigator();
  paintAlidade(p, -0.6);
  return p;
});
ART.icons.navigator = iconNavigator;
})();
