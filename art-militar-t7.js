'use strict';
// Linha militar, tiers 7 a 10: Fortaleza, Capitão, Ordem de cavalaria e Trabuco.
// Retratos animados, silhuetas bloqueadas e ícones, sempre no clima de entardecer.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSun, makeCloud } = ART;

const AX = 32.5; // eixo vertical dos retratos (centro do pixel 32)

// fortaleza: pedra escura e fria; a face voltada para o poente pega a luz laranja
const FORT = ramp('#121017', '#1b1820', '#25212b', '#312c37', '#3e3844', '#4d4653', '#5f5764', '#766c78');
const SUNLIT = ramp('#2e2430', '#4a343c', '#6c4648', '#925a54', '#b87262', '#d8926e', '#f0b884');
const ROCK = ramp('#140e12', '#1f161a', '#2c1f22', '#3c2a2b', '#4f3834', '#664840', '#805c4c');
const HILLS = ramp('#2e2244', '#3e2e56', '#523c68', '#684c78');
const SLIT = C('#0c090e'); // seteiras e frestas
const FWIN = C('#1c0d10'); // janela que acende com as tochas

// capitão e tenda de comando
const CANVAS = ramp('#1a110c', '#281a12', '#3a2819', '#4f3822', '#684b2d', '#83603a', '#a07a4a', '#bc965e');
const GAMB = ramp('#1e070b', '#350c12', '#53141a', '#741f24', '#962f2e', '#b6463c');
const FELT = ramp('#0c090b', '#151014', '#1f1820', '#2b222c', '#3a2f3a', '#4c3f4a');
const DARK_HAIR = ramp('#120b09', '#21140e', '#331f15', '#47301f', '#5e422b', '#78583a');
const GREY = ramp('#2a262c', '#47434a', '#68646c', '#8c888e', '#b2aeb2', '#d6d4d2', '#f2f0ec');
const PARCH = ramp('#5a4228', '#8a6a42', '#b8975e', '#d8bc82', '#ecd8a4', '#f8ecc8');
const MAP_SEA = ramp('#3c4a5a', '#5a6e7c', '#7e94a0', '#a8b8b8');
const PLUME = ramp('#3e0f14', '#6e1a20', '#a32a2c', '#cf4438', '#ec7056', '#f8a888');
const PEARL = ramp('#6a6474', '#a8a2b0', '#dad4dc', '#fbf8f2');
const RUBY = ramp('#4a0a14', '#8e1626', '#d03a42', '#ff9a8a');
const SCAR = C('#e8ac96'), SCAR_DK = C('#8e4636');

// salão da ordem
const HALL = ramp('#110c0f', '#1b1418', '#271d20', '#35282a', '#463634', '#5a4640', '#73594c', '#8e6e58');
const WARM_STEEL = ramp('#252430', '#433f4c', '#6e6670', '#a0928e', '#d0bcae', '#f4e0cc');
const FIREHOLE = C('#160806'); // boca da lareira, onde dança o fogo
const AZURE = ramp('#0e1636', '#1a2856', '#2a3e7c', '#425ca2');
const VERT = ramp('#1a3e22', '#2a5c32', '#3e7a44', '#5a9a58');

// trabuco e acampamento
const TENT = ramp('#3a2c26', '#5e4a3c', '#8a7258', '#b49c78', '#d8c49a', '#f0e2be');
const FIELD = ramp('#1a1a1a', '#262620', '#363426', '#4a462c', '#625a34', '#7c703e');
const CITY = ramp('#3a2c4a', '#4a3a5a', '#5c4a6a', '#70587a');
const SMOKE = ramp('#2a2230', '#3e3442', '#584a58', '#76666e', '#968488');

const archTest = (cx, rx, top, bottom) => (x, y) =>
  y <= bottom && ((Math.abs(x - cx) <= rx && y >= top + rx) || ((x - cx) / rx) ** 2 + ((y - top - rx) / rx) ** 2 <= 1);

// Alvenaria: ajuste de tom de um bloco (junta escura, aresta de cima clara, variação por bloco).
function masonry(x, y, bw, bh, seed, oy = 0) {
  const ry = (((y - oy) % bh) + bh) % bh;
  const row = Math.floor((y - oy) / bh), off = (row & 1) * (bw >> 1);
  if (ry === bh - 1 || (x + off) % bw === 0) return -0.17;
  return (hash(Math.floor((x + off) / bw), row, seed) - 0.5) * 0.16 + (ry === 0 ? 0.06 : 0);
}

// Luz que pulsa: compara o fundo apagado com o aceso e guarda, para cada pixel que muda,
// um limiar. A cada quadro acendem os pixels com limiar abaixo do nível pedido.
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

// Chama de tocha ou lanterna com a base em (x, y): núcleo claro embaixo, ponta que dança.
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

// Brilho em estrela de 4 pontas num ponto, com intensidade 0..1.
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

// Distância de (px, py) até a poligonal, o vetor do ponto mais próximo até ele e o
// avanço (0..1) ao longo do caminho.
function nearestOnPath(path, px, py) {
  let best = Infinity, bx = 0, by = 0, at = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [cx, cy] = path[i + 1];
    const dx = cx - ax, dy = cy - ay;
    const s = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
    const ox = px - ax - dx * s, oy = py - ay - dy * s;
    const d = ox * ox + oy * oy;
    if (d < best) { best = d; bx = ox; by = oy; at = (i + s) / (path.length - 1); }
  }
  return [Math.sqrt(best), bx, by, at];
}

// Fumaça subindo de (x, y): bolinhas pontilhadas que crescem e somem.
function paintSmoke(f, x, y, t, n, rise, drift, size, ramp_, seed) {
  for (let k = 0; k < n; k++) {
    const s = (t * 0.16 + k / n + hash(k, 1, seed) * 0.1) % 1;
    const sx = x + s * drift + Math.sin(s * 6 + k + seed) * 1.1, sy = y - s * rise, r = 0.8 + s * size;
    for (let yy = Math.floor(sy - r); yy <= sy + r; yy++) {
      for (let xx = Math.floor(sx - r); xx <= sx + r; xx++) {
        const dd = Math.hypot(xx + 0.5 - sx, yy + 0.5 - sy) / r;
        if (dd <= 1 && bayer(xx, yy) < (1 - s) * 1.15 * (1.1 - dd * 0.5)) f.set(xx, yy, ramp_[dd < 0.45 ? 3 : dd < 0.8 ? 2 : 1]);
      }
    }
  }
}

// Nuvem comprida e fina de fim de tarde, acesa por baixo e mais clara perto do sol.
function streakCloud(p, cx, cy, hw, hh, sx, sy, seed) {
  for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
    const u = (x + 0.5 - cx) / hw;
    if (Math.abs(u) > 1) continue;
    const h = hh * Math.sqrt(1 - u * u) * (0.75 + hash(x >> 2, 1, seed) * 0.4);
    const c = cy + Math.sin(x * 0.31 + seed) * 0.5;
    for (let y = Math.floor(c - h); y <= c + h; y++) {
      const ny = (y + 0.5 - c) / Math.max(0.6, h);
      if (Math.abs(ny) > 1) continue;
      const near = clamp01(1 - Math.hypot(x - sx, (y - sy) * 1.5) / 34);
      const v = 0.18 + ny * 0.28 + near * 0.62 + (hash(x, y, seed) - 0.5) * 0.12;
      p.set(x, y, pick(PAL.duskCloud, v, x, y, 1.6));
    }
  }
}

// Bandeira vermelha tremulando presa no mastro (px, py), com rabo de andorinha.
function paintPennant(f, q, px, py, len, h, ph, amp) {
  q.clear();
  for (let i = 0; i < len; i++) {
    const s = Math.sin(ph - i * 0.75);
    const dy = Math.round(s * amp * (i + 1) / len);
    const lit = Math.cos(ph - i * 0.75);
    for (let j = 0; j < h; j++) {
      if (i >= len - 2 && j >= (h >> 1) - (i - len + 2) && j <= ((h - 1) >> 1) + (i - len + 2)) continue; // rabo
      const v = 0.55 + lit * 0.3 - j * 0.04;
      let c = pick(PAL.banner, v, i, j, 3);
      if (i === 0) c = PAL.gold[j === 0 ? 5 : 3];
      else if (j === 0 && i < len - 2) c = PAL.gold[lit > 0 ? 4 : 2];
      q.set(1 + i, 3 + j + dy, c);
    }
  }
  q.outline(PAL.out);
  for (let y = 0; y < q.h; y++) q.d[y * q.w] = 0; // não cobre o mastro
  f.blit(q, px, py - 3);
}

// Pássaro em V batendo as asas.
function paintBird(f, x, y, t, k, c) {
  const flap = Math.sin(t * 9 + k * 2.1);
  x = Math.round(x); y = Math.round(y);
  f.set(x, y, c);
  const wy = flap > 0.3 ? -1 : flap < -0.3 ? 1 : 0; // asas para cima, abertas ou para baixo
  f.set(x - 1, y + Math.min(0, wy), c);
  f.set(x + 1, y + Math.min(0, wy), c);
  f.set(x - 2, y + wy, c);
  f.set(x + 2, y + wy, c);
}

// ---------------------------------------------------------------------------
// Fortaleza

const FORT_SUN = [4, 33];
const TORCHES = [[27, 38], [38, 38]]; // base das chamas ao lado do portão
const VALLEY = ramp('#12161c', '#1a2024', '#222a2a', '#2c3630');

function buildFortressBackdrop() {
  const p = new Pix(64, 64);
  const [sx, sy] = FORT_SUN;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x + 0.5 - sx, (y + 0.5 - sy) * 1.3);
      const v = 0.02 + (y / 48) * 0.72 + 0.4 * clamp01(1 - d / 40) ** 1.6;
      p.d[y * 64 + x] = pick(PAL.dusk, v, x, y, 4);
    }
  }
  paintSun(p, sx, sy, 4);
  streakCloud(p, 42, 8, 22, 1.8, sx, sy, 3);
  streakCloud(p, 12, 17, 12, 1.3, sx, sy, 5);
  streakCloud(p, 56, 19, 9, 1.1, sx, sy, 7);
  streakCloud(p, 22, 3, 10, 0.9, sx, sy, 9);
  // serra roxa ao longe e o vale escuro com mata
  for (let x = 0; x < 64; x++) {
    const top = Math.round(42 + 2 * Math.sin(x * 0.21 + 0.5) + 1.2 * Math.sin(x * 0.53));
    for (let y = top; y < 64; y++) p.set(x, y, pick(HILLS, (y === top ? 0.85 : 0.52) - (y - top) * 0.05, x, y));
    const wood = Math.round(52 + Math.sin(x * 1.3) * 0.8 + hash(x, 2, 95) * 1.6);
    for (let y = wood; y < 64; y++) p.set(x, y, pick(VALLEY, 0.75 - (y - wood) * 0.09 + (hash(x, y, 96) - 0.5) * 0.3, x, y));
  }
  return p;
}

// Merlões centrados no eixo: 3 de pedra, 2 de vão; as quinas são sempre merlão.
const isMerlon = (x, x0, x1) => {
  const k = (((x - 32) % 5) + 5) % 5;
  return x === x0 || x === x1 || k <= 1 || k === 4;
};

// Luz das tochas do portão num ponto (0..1).
const torchLight = (x, y) => {
  let g = 0;
  for (const [tx, ty] of TORCHES) g = Math.max(g, clamp01(1 - Math.hypot(x + 0.5 - tx, (y + 0.5 - ty) * 0.85) / 7));
  return g * g;
};

// Bloco de alvenaria visto de frente, com a face da esquerda virada para o sol poente.
// tone: tom da frente; shade: escurece a parte de baixo (sombra da muralha da frente);
// glow: luz das tochas (0 apagada, 1 acesa).
function fortBlock(p, x0, x1, side, top, base, seed, tone, shade, glow, bw = 4, bh = 3) {
  for (let y = top - 3; y <= base; y++) {
    for (let x = x0 - side; x <= x1; x++) {
      const crown = y < top;
      if (crown && x >= x0 && !isMerlon(x, x0, x1)) continue;
      const m = masonry(x, y, bw, bh, seed, top);
      const low = shade ? Math.max(0, y - shade) * 0.05 : 0;
      if (x < x0) {
        let v = 0.5 + m * 0.8 - (y - top) * 0.016 + (x - x0 + side) * 0.07 - low;
        if (y === top - 3) v += 0.25;
        p.set(x, y, pick(SUNLIT, v, x, y));
        continue;
      }
      if (crown) {
        const k = (((x - 32) % 5) + 5) % 5;
        if (y === top - 3) { p.set(x, y, SUNLIT[k === 4 || x === x0 ? 5 : 4]); continue; }
        const v = tone + 0.06 + (k === 4 || x === x0 ? 0.16 : k === 1 || x === x1 ? -0.16 : 0) - (y - top + 3) * 0.04;
        p.set(x, y, pick(FORT, v, x, y));
        continue;
      }
      const g = torchLight(x, y) * glow;
      let v = tone + m - (y - top) * 0.006 - low + g * 0.7;
      if (y === top) v += 0.1;
      if (x === x0) v += 0.16;
      else if (x === x1) v -= 0.16;
      p.set(x, y, g > 0.18 ? pick(SUNLIT, v - 0.1, x, y) : pick(FORT, v, x, y));
    }
  }
}

// janela em arco (larga) ou fresta, com o peitoril de pedra
function fortWindow(p, x, y, w, h) {
  p.rect(x, y, w, h, FWIN);
  if (w > 1) {
    p.rect(x, y - 1, w, 1, FWIN);
    p.set(x + w - 1, y - 1, FORT[2]);
  }
  p.rect(x - 1, y + h, w + 2, 1, (xx) => FORT[xx === x - 1 ? 7 : 5]);
}

// Topo do rochedo: platô sob a fortaleza e encostas íngremes dos lados.
const cragTop = (x) => {
  const j = Math.round(Math.sin(x * 0.8) * 0.6 + hash(x, 1, 91) * 1.2);
  if (x < 9) return 47 + Math.round((9 - x) * 1.5) + j + (x % 3 === 1 ? 1 : 0);
  if (x > 55) return 47 + Math.round((x - 55) * 1.6) + j + (x % 3 === 2 ? 1 : 0);
  return 47 + j;
};

// Colunas de pedra do penhasco, levemente inclinadas: [x inicial, largura, tom, linha do ressalto].
const CRAG_COLS = (() => {
  const cols = [];
  for (let x = -12, i = 0; x < 80; i++) {
    const w = 3 + Math.floor(hash(i, 1, 97) * 4);
    cols.push([x, w, hash(i, 2, 97), 50 + Math.floor(hash(i, 3, 97) * 5)]);
    x += w;
  }
  return cols;
})();

function buildFortress(glow = 0) {
  const p = new Pix(64, 64);

  // torre de menagem: fuste, parapeito saliente com mata-cães e ameias
  fortBlock(p, 23, 41, 3, 11, 30, 101, 0.42, 19, glow);
  fortBlock(p, 22, 42, 3, 7, 9, 108, 0.5, 0, glow);
  for (let x = 22; x <= 42; x++) p.set(x, 10, x % 2 ? FORT[2] : SLIT);
  for (let x = 19; x <= 21; x++) p.set(x, 10, SUNLIT[1]);
  fortWindow(p, 25, 14, 2, 4);
  fortWindow(p, 38, 14, 2, 4);
  // estandarte com a estrela dourada
  p.rect(28, 11, 9, 1, (x) => (x === 28 || x === 36 ? PAL.gold[4] : PAL.wood[2]));
  p.fill(29, 12, 35, 21, (x, y) => !(y >= 19.5 && Math.abs(x - AX) < (y - 18.5)), (x, y) => {
    if (x === 29 || x === 35) return PAL.gold[x === 29 ? 3 : 2];
    return pick(PAL.banner, 0.68 - (x - 30) * 0.1 + (x === 31 ? 0.12 : 0) - (y - 12) * 0.016, x, y);
  });
  for (const [x, y, k] of [[32, 13, 5], [32, 14, 4], [30, 15, 4], [31, 15, 5], [32, 15, 4], [33, 15, 3], [34, 15, 3],
    [31, 16, 4], [32, 16, 4], [33, 16, 3], [31, 17, 3], [33, 17, 2], [30, 18, 3], [34, 18, 2]]) p.set(x, y, PAL.gold[k]);
  // mastro no alto da torre
  p.rect(32, 0, 1, 4, (x, y) => (y === 0 ? PAL.gold[5] : PAL.iron[y < 2 ? 3 : 2]));

  // muralha de dentro, mais escura e com a base na sombra da de fora
  fortBlock(p, 15, 49, 2, 23, 36, 102, 0.34, 26, glow, 5, 3);
  for (const x of [18, 46]) p.rect(x, 25, 1, 3, SLIT);

  // muralha de fora, baluartes quadrados nas pontas e a portaria
  fortBlock(p, 17, 47, 0, 33, 52, 103, 0.46, 47, glow, 5, 3);
  fortBlock(p, 10, 16, 2, 27, 52, 104, 0.47, 47, glow);
  fortBlock(p, 48, 54, 2, 27, 52, 105, 0.47, 47, glow);
  fortBlock(p, 25, 39, 2, 29, 52, 106, 0.5, 47, glow);
  for (const x of [12, 51]) {
    fortWindow(p, x, 31, 2, 3);
    p.rect(x + (x < 32 ? 0 : 1), 39, 1, 3, SLIT);
  }
  for (const x of [20, 44]) p.rect(x, 36, 1, 3, SLIT);
  // mastros dos baluartes
  for (const x of [10, 54]) p.rect(x, 16, 1, 8, (xx, y) => (y === 16 ? PAL.gold[4] : PAL.iron[2]));
  // janela da portaria e o portão em arco com a grade baixada
  fortWindow(p, 32, 31, 1, 2);
  p.fill(27, 34, 38, 48, archTest(AX, 4.6, 34.6, 48), (x, y) =>
    pick(FORT, 0.66 - (x - 28) * 0.03 - ((x + y) % 3 === 0 ? 0.12 : 0) + (y < 37 ? 0.1 : 0), x, y));
  p.fill(28, 36, 37, 48, archTest(AX, 3.6, 36, 48), SLIT);
  for (let y = 37; y <= 47; y++) {
    for (let x = 29; x <= 36; x++) {
      if (!archTest(AX, 3.6, 36, 48)(x + 0.5, y + 0.5)) continue;
      const bar = (x - 29) % 2 === 1, rail = (y - 37) % 3 === 2;
      if (bar || rail) p.set(x, y, PAL.iron[bar && rail ? 3 : bar ? (x < 33 ? 2 : 1) : 1]);
    }
  }
  for (const x of [30, 32, 34, 36]) p.set(x, 48, PAL.iron[3]); // pontas da grade
  // suportes das tochas
  for (const [tx, ty] of TORCHES) {
    p.rect(tx, ty + 1, 1, 3, PAL.wood[2]);
    p.rect(tx - 1, ty + 3, 3, 1, PAL.iron[1]);
    p.set(tx, ty + 4, PAL.iron[2]);
  }
  // talude: a base das muralhas se alarga em rampa sobre a rocha
  for (let y = 44; y <= 48; y++) {
    const grow = Math.floor((y - 44) / 2);
    for (let x = 7 - grow; x <= 57 + grow; x++) {
      if (x >= 27 && x <= 38) continue; // portão
      const v = 0.62 - (y - 44) * 0.07 + masonry(x, y, 4, 2, 109, 44) * 0.6 + (x < 10 ? 0.15 : 0);
      p.set(x, y, y === 44 ? SUNLIT[x < 10 ? 4 : 2] : pick(FORT, v, x, y));
    }
  }

  // rochedo: colunas de pedra com a face da esquerda clara, ressaltos e crista
  for (let x = 0; x < 64; x++) {
    const top = cragTop(x);
    for (let y = top; y < 64; y++) {
      const xs = x + (y - 47) * 0.35;
      let ci = 0;
      while (CRAG_COLS[ci + 1][0] <= xs) ci++;
      const [c0, w, tone, ledge] = CRAG_COLS[ci];
      const u = (xs - c0) / w;
      let v = 0.2 + tone * 0.22 + (1 - u) * 0.5 - (y - top) * 0.014;
      if (y === ledge && ci % 2) v += 0.2; // ressalto
      if (xs - c0 < 1) v = 0.04 + tone * 0.1; // fenda entre colunas
      if (y === top) v = 0.84 - (x > 40 ? 0.12 : 0);
      else if (y === top + 1) v += 0.08;
      else if (y === top + 2 || y === top + 3) v -= 0.14; // sombra sob a crista
      p.set(x, y, pick(ROCK, v, x, y, 4));
    }
  }
  // estrada cortada na encosta, descendo do portão
  for (let x = 33; x < 64; x++) {
    const y = Math.round(49 + (x - 33) * 0.45);
    if (y < cragTop(x)) continue;
    p.set(x, y, pick(PAL.dirt, 0.66 - (x - 33) * 0.008, x, y));
    p.set(x, y + 1, pick(PAL.dirt, 0.3, x, y + 1));
    p.set(x, y + 2, ROCK[0]);
    if (x % 3 === 0) p.set(x, y - 1, ROCK[5]); // mureta
  }
  // tufos de mato nas fendas
  for (const [x, y] of [[11, 48], [53, 48], [4, 55]]) {
    p.set(x, y, PAL.tree[2]);
    p.set(x + 1, y, PAL.tree[1]);
    p.set(x, y - 1, PAL.tree[3]);
  }

  p.outline(PAL.out);
  return p;
}

function paintFortressFlags(f, q, t, working) {
  const ph = t * (working ? 6.2 : 3.6);
  paintPennant(f, q, 32, 0, 11, 5, ph, 1.6);
  paintPennant(f, q, 10, 16, 7, 4, ph + 1.4, 1.2);
  paintPennant(f, q, 54, 16, 7, 4, ph + 2.3, 1.2);
}

const fortressArt = { bg: null, body: null, frame: new Pix(64, 64), flag: new Pix(14, 14) };

function paintFortressPortrait(ctx, t, info) {
  const a = fortressArt;
  if (!a.bg) {
    a.bg = buildFortressBackdrop();
    a.body = buildFortress(0);
    a.halo = makeHalo(a.body, buildFortress(1), (x, y) => {
      let d = 9;
      for (const [tx, ty] of TORCHES) d = Math.min(d, Math.hypot(x + 0.5 - tx, (y + 0.5 - ty) * 0.85));
      return d / 8;
    });
    a.cloud = makeCloud(22, 7, 11, PAL.duskCloud);
    a.windows = [];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        if (a.body.get(x, y) !== FWIN) continue;
        let up = 0, dn = 0;
        while (a.body.get(x, y - up - 1) === FWIN) up++;
        while (a.body.get(x, y + dn + 1) === FWIN) dn++;
        a.windows.push([x, y, up / Math.max(1, up + dn)]);
      }
    }
  }
  const live = info.working ? 1 : 0.5;
  const f = a.frame.copyFrom(a.bg);
  // nuvem passando devagar atrás da torre
  f.blit(a.cloud, ((t * 1.3) % 92) - 24, 2);
  // corvos rodeando a torre de menagem
  for (let k = 0; k < 3; k++) {
    const ang = t * (0.35 + k * 0.07) + k * 2.1;
    paintBird(f, 32 + Math.cos(ang) * (17 + k * 4), 13 + Math.sin(ang) * (4 + k) - k * 3, t, k, C('#1a1220'));
  }
  f.blit(a.body, 0, 0);
  // tochas do portão iluminando a pedra
  const flick = Math.sin(t * 9.3) * 0.5 + Math.sin(t * 15.1 + 1) * 0.3 + Math.sin(t * 3.7) * 0.2;
  paintHalo(f, a.halo, 0.5 + live * 0.15 + flick * 0.1);
  for (const [tx, ty] of TORCHES) paintFlame(f, tx + 0.5, ty, t + tx, 3 + live, 1.2, live);
  // janelas com luz de tocha tremendo
  for (const [x, y, rel] of a.windows) {
    const fl = Math.sin(t * 9 + x * 1.7) * 0.5 + Math.sin(t * 15.3 + y * 2.3 + x) * 0.5;
    f.set(x, y, pick(PAL.fire, (info.working ? 0.34 : 0.14) + rel * 0.42 + fl * 0.14, x, y, 1.2));
  }
  paintFortressFlags(f, a.flag, t, info.working);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Capitão

const LANTERN = [56, 30]; // base da chama dentro da lanterna
const MAP = [3, 12, 18, 30]; // x0, y0, x1, y1 do mapa preso na lona

function buildCaptainBackdrop(glow) {
  const p = new Pix(64, 64);
  const [lx, ly] = LANTERN;
  const reach = 36 + glow * 10, power = 0.4 + glow * 0.24;
  const light = (x, y) => power * clamp01(1 - Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 1.05) / reach) ** 1.4;
  // lona da tenda em painéis costurados, com o pano cedendo entre as costuras
  const seams = [-3, 10, 24, 41, 54, 68];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let i = 0;
      while (seams[i + 1] <= x) i++;
      const u = (x - seams[i]) / (seams[i + 1] - seams[i]);
      let v = 0.16 + light(x, y) + Math.sin(u * Math.PI) * 0.08 + Math.sin(x * 0.7 + y * 0.12) * 0.03;
      if (x === seams[i]) v -= 0.12;
      else if (x === seams[i] + 1) v += 0.06;
      if (y < 8) v -= 0.1 + (8 - y) * 0.015; // teto da tenda
      v -= Math.max(0, y - 50) * 0.008;
      p.d[y * 64 + x] = pick(CANVAS, v, x, y, 1.8);
      if (x === seams[i] + 1 && y % 3 === 0 && y > 9) p.d[y * 64 + x] = pick(CANVAS, v + 0.12, x, y);
    }
  }
  // sanefa listrada de vermelho e cru, com a borda recortada
  for (let x = 0; x < 64; x++) {
    const stripe = Math.floor((x + 2) / 4) % 2;
    const bottom = 9 + (((x + 2) % 4 === 1 || (x + 2) % 4 === 2) ? 1 : 0);
    for (let y = 6; y <= bottom; y++) {
      const v = 0.42 + light(x, y) * 0.8 - (y - 6) * 0.05 + (y === 6 ? -0.15 : 0);
      p.set(x, y, stripe ? pick(PAL.banner, v, x, y) : pick(CANVAS, v + 0.32, x, y));
    }
    p.set(x, bottom + 1, CANVAS[1]);
  }
  // porta da tenda amarrada, mostrando o acampamento ao entardecer
  const inDoor = (x, y) => x > 51 && y > 31 + Math.max(0, 58 - x) * 1.15;
  p.fill(50, 30, 63, 63, inDoor, (x, y) => pick(PAL.dusk, 0.4 + (y - 32) * 0.055, x, y, 3));
  for (let x = 51; x < 64; x++) {
    const top = Math.round(43 + Math.sin(x * 0.5) * 0.7);
    for (let y = top; y < 64; y++) if (inDoor(x, y)) p.set(x, y, pick(HILLS, 0.42 - (y - top) * 0.14, x, y));
  }
  // tendas ao longe, com a luz da fogueira
  for (const [cx, base, hw] of [[56, 47, 2.5], [61.5, 46, 2]]) {
    p.fill(cx - hw, base - hw * 1.4, cx + hw, base, (x, y) => inDoor(x, y) && Math.abs(x - cx) <= (y - base + hw * 1.4) / 1.4, (x) => (x < cx ? TENT[1] : TENT[0]));
  }
  p.set(59, 47, PAL.fire[1]);
  p.fill(50, 30, 63, 63, (x, y) => !inDoor(x, y) && inDoor(x + 1.3, y + 1.3) && x > 50, (x, y) => pick(CANVAS, 0.66 + light(x, y), x, y));
  // corrente da lanterna
  for (let y = 10; y < 21; y++) p.set(lx, y, PAL.iron[y % 2 ? 1 : 3]);

  // mapa da campanha pregado na lona
  const [mx0, my0, mx1, my1] = MAP;
  p.rect(mx0 + 1, my0 + 1, mx1 - mx0 + 1, my1 - my0 + 1, CANVAS[1]); // sombra
  p.fill(mx0, my0, mx1, my1, (x, y) => !(x === mx1 && y === my0), (x, y) => {
    const mx = x - mx0, my = y - my0;
    const edge = Math.min(mx, my, mx1 - x, my1 - y);
    const coast = 4.2 + Math.sin(my * 0.55) * 1.4 + Math.sin(my * 1.3) * 0.5;
    let v = 0.6 + light(x, y) * 0.5 + (hash(x, y, 51) - 0.5) * 0.14 - (edge === 0 ? 0.3 : edge === 1 ? 0.08 : 0);
    if (mx < coast - 0.5) return pick(MAP_SEA, v - 0.1 + ((mx + my * 2) % 5 === 0 ? 0.25 : 0), x, y);
    if (mx < coast + 0.5) return PARCH[1];
    return pick(PARCH, v, x, y);
  });
  p.set(mx1, my0, PARCH[5]); // canto dobrado
  p.set(mx1 - 1, my0, PARCH[2]);
  // rio, montes, mata, fortes e as tropas em vermelho
  for (const [x, y] of [[13, 0], [13, 1], [12, 2], [12, 3], [11, 4], [11, 5], [10, 6], [10, 7], [9, 8], [8, 9], [8, 10], [7, 11]]) p.set(mx0 + x, my0 + y, C('#5a6e7c'));
  for (const [x, y] of [[12, 13], [13, 12], [14, 13], [9, 15], [10, 14], [11, 15]]) p.set(mx0 + x, my0 + y, PARCH[0]);
  for (const [x, y] of [[13, 6], [14, 7], [12, 7], [14, 5]]) p.set(mx0 + x, my0 + y, C('#3e5a2e'));
  p.rect(mx0 + 8, my0 + 3, 2, 2, PAL.out);
  for (const [x, y] of [[6, 14], [7, 14], [10, 10], [11, 10]]) p.set(mx0 + x, my0 + y, PAL.banner[2]);
  for (const [x, y] of [[9, 16], [11, 17], [13, 16], [14, 14]]) p.set(mx0 + x, my0 + y, PAL.banner[3]);
  // tachas de latão nos cantos
  for (const [x, y] of [[mx0 + 1, my0 + 1], [mx1 - 1, my0 + 1], [mx0 + 1, my1 - 1], [mx1 - 1, my1 - 1]]) {
    p.set(x, y, PAL.gold[4]);
    p.set(x + 1, y + 1, PARCH[1]);
  }

  // lanterna de ferro com vidros
  p.poly([[52.5, 24], [55, 21], [58, 21], [60.5, 24]], (x) => PAL.iron[x < 56 ? 2 : 1]);
  p.set(56, 20, PAL.iron[3]);
  p.fill(53, 24, 59, 31, () => true, (x, y) => {
    if (x === 53 || x === 59 || y === 24 || y === 31) return PAL.iron[x === 53 || y === 24 ? 2 : 1];
    if (x === 56) return PAL.iron[1];
    return pick(PAL.fire, 0.2 + glow * 0.2 + (31 - y) * 0.02 - Math.abs(x - 56) * 0.06, x, y);
  });
  p.rect(54, 32, 5, 1, PAL.iron[1]);
  return p;
}

function inCaptHead(x, y) {
  const dy = (y - 33) / 12.4;
  const rx = dy > 0 ? 10.8 * (1 - 0.26 * dy * dy) : 10.8;
  return ((x - AX) / rx) ** 2 + dy * dy <= 1;
}

function captainEyes(p, closed, gaze) {
  for (const x0 of [26, 36]) {
    const left = x0 === 26;
    for (let i = 0; i < 3; i++) p.set(x0 + i, 30, DARK_HAIR[1]); // pálpebra de cima, apertada
    if (closed) {
      for (let i = 0; i < 3; i++) p.set(x0 + i, 31, PAL.skin[2]);
      continue;
    }
    const ix = gaze < 0 ? 0 : gaze > 0 ? 1 : left ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      const iris = i === ix || i === ix + 1;
      p.set(x0 + i, 31, iris ? (i === ix ? PAL.iris : PAL.irisHi) : PAL.eyeWhite);
    }
    for (let i = 0; i < 3; i++) p.set(x0 + i, 32, PAL.skin[left ? 3 : 2]);
  }
}

function buildCaptain(withPlume) {
  const p = new Pix(64, 64);
  // ombros: gibão acolchoado vermelho, pespontado em losangos
  p.poly([[0, 64], [1, 57], [6, 51.5], [14, 48], [23, 46.5], [42, 46.5], [51, 48], [59, 51.5], [64, 57], [65, 64]], (x, y) => {
    const nx = (x + 0.5 - AX) / 31;
    const u = (((x + y) % 5) + 5) % 5, w = (((x - y) % 5) + 5) % 5;
    let v = 0.5 - nx * 0.3 - (y - 50) * 0.012;
    v += clamp01(1 - Math.hypot((x - 9) / 8, (y - 53) / 5)) * 0.15;
    if (nx > 0.55) v += 0.08; // luz da lanterna
    if (u === 0 || w === 0) v -= 0.3;
    else v += (Math.min(u, 5 - u) + Math.min(w, 5 - w)) * 0.04 - 0.08;
    return pick(GAMB, v, x, y);
  });
  // peitoral de aço com quilha no meio e borda de latão
  const plateTop = (x) => 49 + Math.abs(x + 0.5 - AX) * 0.18;
  const inPlate = (x, y) => y >= plateTop(x) && Math.abs(x - AX) <= Math.min(13, 9.6 + (y - 49) * 0.55);
  p.fill(18, 48, 47, 63, inPlate, (x, y) => {
    const nx = (x + 0.5 - AX) / 13;
    let v = -0.06 + cylLight(nx * 0.95) * 0.8 - (y - 50) * 0.012;
    if (x === 25 || x === 26) v += 0.18; // faixa de brilho
    if (y < 52) v -= 0.1; // sombra da barba
    if (x === 32) v += 0.28;
    else if (x === 33) v -= 0.1;
    if (nx > 0.6) v += 0.2; // reflexo da lanterna
    if (!inPlate(x - 1, y) || !inPlate(x + 1, y)) v -= 0.12;
    return pick(PAL.steel, v, x, y);
  });
  for (let x = 19; x <= 46; x++) {
    const y = Math.ceil(plateTop(x) - 0.5);
    if (inPlate(x + 0.5, y + 0.5)) p.set(x, y, PAL.gold[x < 32 ? 4 : x < 40 ? 3 : 2]);
  }
  for (const [x, y] of [[23, 54], [22, 58], [21, 62], [42, 54], [43, 58], [44, 62]]) p.set(x, y, PAL.steel[x < 32 ? 4 : 3]);
  // correias de couro com fivela sobre os ombros
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x = AX + dir * (10 + i * 0.7), y = 50 - i * 0.7;
      p.set(x, y, PAL.leather[dir < 0 ? 3 : 2]);
      p.set(x + dir, y, PAL.leather[dir < 0 ? 2 : 1]);
    }
    p.rect(AX + dir * 11 - 1, 48, 2, 2, (x, y) => PAL.gold[y === 48 ? 4 : 2]);
  }
  // pescoço
  p.rect(27, 41, 11, 7, (x, y) => pick(PAL.skin, 0.12 - (x - 31) * 0.03, x, y));

  // cabelo escuro caindo dos lados até o queixo
  p.fill(19, 20, 46, 42, (x, y) => ((x - AX) / 12.6) ** 2 + ((y - 30) / 12) ** 2 <= 1 && y < 41, (x, y) => {
    let v = 0.15 + sphereLight((x + 0.5 - AX) / 12.6, (y + 0.5 - 28) / 12) * 0.7 + Math.sin(x * 1.3 + y * 0.4) * 0.1 + (hash(x, y, 52) - 0.5) * 0.14;
    if (y > 38) v -= 0.12;
    return pick(DARK_HAIR, v, x, y, 1.6);
  });
  // orelhas
  p.sphere(21.4, 33, 2, 3, PAL.skin, -0.05);
  p.sphere(43.6, 33, 2, 3, PAL.skin, -0.2);
  p.set(21, 33, PAL.skin[1]);
  p.set(44, 33, PAL.skin[0]);
  // rosto curtido de sol
  p.fill(21, 20, 44, 46, inCaptHead, (x, y) => {
    let v = 0.3 + sphereLight((x + 0.5 - AX) / 10.8 * 0.85, (y + 0.5 - 33) / 12.4 * 0.5 - 0.12) * 0.7;
    if (y < 26) v -= 0.26 - (y - 21) * 0.03; // sombra da aba
    return pick(PAL.skin, v, x, y, 5);
  });
  // costeletas
  p.fill(19, 20, 46, 38, (x, y) => inCaptHead(x, y) && Math.abs(x - AX) > 9.2 && y < 37, (x, y) =>
    pick(DARK_HAIR, 0.3 + sphereLight((x + 0.5 - AX) / 11, 0) * 0.4 + (hash(x, y, 53) - 0.5) * 0.2, x, y));

  // sobrancelhas grossas, franzidas; a cicatriz corta a da direita
  for (const [x, y, k] of [[25, 28, 2], [26, 27, 3], [27, 27, 3], [28, 27, 2], [29, 28, 2], [30, 28, 1], [26, 28, 1], [27, 28, 1], [28, 28, 1]]) {
    p.set(x, y, DARK_HAIR[k]);
    if (64 - x !== 38) p.set(64 - x, y, DARK_HAIR[Math.max(0, k - 1)]);
  }
  captainEyes(p, false, 0);
  // rugas de quem aperta os olhos ao sol
  for (const [x, y] of [[24, 30], [23, 31], [24, 32]]) { p.set(x, y, PAL.skin[2]); p.set(64 - x, y, PAL.skin[1]); }
  for (const x of [29, 30, 34, 35]) p.set(x, 25, PAL.skin[1]);
  p.set(31, 29, PAL.skin[2]);
  p.set(33, 29, PAL.skin[1]);
  // nariz quebrado, um pouco torto
  for (const [x, y, k] of [[32, 30, 4], [32, 31, 4], [33, 31, 2], [33, 32, 4], [34, 32, 2], [33, 33, 4], [34, 33, 2], [32, 34, 4], [33, 34, 4], [34, 34, 2],
    [30, 35, 2], [31, 35, 1], [32, 35, 3], [33, 35, 3], [34, 35, 1], [35, 35, 1], [31, 34, 3]]) p.set(x, y, PAL.skin[k]);
  // cicatriz da testa até a bochecha, passando pelo olho
  for (const [x, y] of [[37, 22], [37, 23], [38, 24], [38, 25], [38, 26], [39, 27], [39, 28], [39, 29], [40, 32], [40, 33], [40, 34], [41, 35]]) {
    p.set(x - 1, y, PAL.skin[2]);
    p.set(x, y, SCAR);
    p.set(x + 1, y, SCAR_DK);
  }

  // barba cheia aparada em quadrado, grisalha nas bordas, e bigode caído
  const inBeard = (x, y) => {
    if (inCaptHead(x, y)) return y > 36.5 || (Math.abs(x - AX) > 8.6 && y > 33) || (Math.abs(x - AX) > 7 && y > 35);
    return y > 40 && y < 49 && Math.abs(x - AX) <= 9 - Math.max(0, y - 45) ** 1.5 * 0.9;
  };
  p.fill(19, 32, 46, 49, inBeard, (x, y) => {
    const nx = (x + 0.5 - AX) / 11, ny = (y + 0.5 - 38) / 12;
    let v = 0.16 + sphereLight(nx, ny) * 0.74 + (hash(x, y, 54) - 0.5) * 0.2;
    if ((x * 2 + y) % 4 === 0) v -= 0.14; // mechas
    else if ((x * 2 + y) % 4 === 2) v += 0.06;
    return pick(DARK_HAIR, v + 0.1, x, y, 1.6);
  });
  // fios grisalhos: dois tufos no queixo e as têmporas
  for (const [x, y, k] of [[27, 41, 3], [27, 42, 2], [28, 44, 3], [28, 45, 2], [29, 47, 2], [38, 41, 2], [38, 42, 1], [37, 44, 2], [37, 45, 1],
    [21, 27, 4], [21, 28, 3], [22, 30, 3], [44, 27, 3], [44, 28, 2], [43, 30, 2]]) p.set(x, y, GREY[k]);
  for (const [x, y, k] of [[27, 37, 3], [28, 36, 4], [29, 36, 4], [30, 36, 4], [31, 36, 3], [26, 38, 2], [27, 38, 2], [28, 37, 3], [29, 37, 3], [30, 37, 2], [31, 37, 2], [25, 39, 1], [26, 39, 1]]) {
    p.set(x, y, DARK_HAIR[k]);
    p.set(65 - x, y, DARK_HAIR[Math.max(0, k - 1)]);
  }
  p.set(32, 36, DARK_HAIR[1]);
  p.set(33, 36, DARK_HAIR[1]);
  // boca fechada, firme
  for (let x = 31; x <= 34; x++) p.set(x, 39, PAL.skin[0]);
  p.set(32, 40, C('#8e4434'));
  p.set(33, 40, C('#8e4434'));

  // chapéu de feltro: copa redonda, faixa vermelha e aba larga presa em cima de um lado
  p.fill(21, 6, 45, 21, (x, y) => ((x - 33) / 10.8) ** 2 + ((y - 15.5) / 9.2) ** 2 <= 1 && y < 20.5, (x, y) => {
    const nx = (x + 0.5 - 33) / 10.8, ny = (y + 0.5 - 13) / 9.2;
    let v = 0.14 + sphereLight(nx, ny) * 0.8 + (x > 39 ? 0.12 : 0);
    if (y === 9 && Math.abs(x - 33) < 5) v -= 0.18; // vinco da copa
    return pick(FELT, v, x, y, 1.6);
  });
  for (let x = 22; x <= 44; x++) {
    const lit = cylLight((x + 0.5 - 33) / 11.5);
    p.set(x, 18, pick(GAMB, 0.35 + lit * 0.6, x, 18));
    p.set(x, 19, pick(GAMB, 0.15 + lit * 0.45, x, 19));
  }
  const brim = [[11.5, 24.2], [16, 22.2], [22, 20.9], [30, 20.6], [38, 20.6], [43, 20], [46.4, 17.4], [48.2, 13.4], [48.6, 9.4]];
  p.fill(9, 7, 51, 27, (x, y) => nearestOnPath(brim, x, y)[0] <= 1.55, (x, y) => {
    const [, ox, oy, at] = nearestOnPath(brim, x + 0.5, y + 0.5);
    let v = 0.3 - oy * 0.18 - ox * 0.08 + (at > 0.7 ? 0.12 : 0);
    if (oy > 0.9 && at < 0.7) v -= 0.12; // lado de baixo da aba
    return pick(FELT, v, x, y, 1.6);
  });
  // broche de ouro com rubi segurando a aba e a pluma
  p.sphere(46, 17.5, 1.9, 1.9, PAL.gold, 0.1);
  p.set(46, 17, RUBY[2]);
  p.set(47, 18, RUBY[1]);
  if (withPlume) p.blit(buildPlume(0), PLUME_X, 0);
  p.outline(PAL.out);
  return p;
}

// Pluma do chapéu, à parte para poder balançar. sway em -1..1.
const PLUME_X = 40;
function buildPlume(sway) {
  const q = new Pix(24, 22);
  const bend = (pts, amt) => pts.map(([x, y]) => {
    const d = Math.hypot(x - 46, y - 17) / 16;
    return [x - PLUME_X + sway * amt * d * d * 0.6, y + sway * amt * d * d];
  });
  const feathers = [
    [bend([[46, 16.5], [47.2, 11.5], [50, 7.4], [54, 4.8], [58, 4.8], [61, 7.4], [61.6, 11]], 1.6), PLUME, 2.3, 0],
    [bend([[46.5, 17.4], [50, 14.2], [54, 12.4], [57.4, 13.2], [59, 15.6]], 1.1), PEARL, 1.5, 0.08],
  ];
  for (const [path, r, w, bias] of feathers) {
    q.fill(0, 0, 23, 21, (x, y) => {
      const [d, , , at] = nearestOnPath(path, x, y);
      const hw = w * (0.45 + Math.sin(at * Math.PI) * 0.75) - (at > 0.92 ? 0.4 : 0);
      return d <= hw && !(d > hw * 0.6 && at > 0.15 && hash(Math.floor(x), Math.floor(y), 58) < 0.3); // barbas desfiadas
    }, (x, y) => {
      const [d, ox, oy, at] = nearestOnPath(path, x + 0.5, y + 0.5);
      const hw = w * (0.45 + Math.sin(at * Math.PI) * 0.75);
      let v = 0.25 + sphereLight(ox / hw * 0.8, oy / hw * 0.8) * 0.75 + bias;
      if (d < 0.5) v += 0.12; // haste
      else if ((x + y) % 2 === 0 && d > hw * 0.55) v -= 0.18; // barbas soltas
      return pick(r, v, x, y);
    });
  }
  q.outline(PAL.out);
  return q;
}

const captainArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintCaptainPortrait(ctx, t, info) {
  const a = captainArt;
  if (!a.bg) {
    a.bg = buildCaptainBackdrop(0);
    const [lx, ly] = LANTERN;
    a.halo = makeHalo(a.bg, buildCaptainBackdrop(1), (x, y) => Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 1.05) / 46);
    a.body = buildCaptain(false);
    a.plumes = [];
    for (let i = 0; i < 9; i++) a.plumes.push(buildPlume(-1 + i / 4));
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  const flick = Math.sin(t * 8.1) * 0.5 + Math.sin(t * 13.7 + 1) * 0.3 + Math.sin(t * 2.9) * 0.2;
  paintHalo(f, a.halo, 0.42 + live * 0.12 + flick * 0.07 * live);
  paintFlame(f, LANTERN[0] - 1, LANTERN[1], t, 3 + live, 1.1, live * 0.6);
  // fogueira lá fora piscando
  if (Math.sin(t * 7 + 1) + Math.sin(t * 11.3) > -0.6) f.set(59, 46, PAL.fire[info.working ? 4 : 3]);
  f.blit(a.body, 0, 0);
  // pluma balançando com a brisa que entra pela porta
  const sway = Math.sin(t * 1.3) * 0.65 + Math.sin(t * 2.9 + 1) * 0.25 * live;
  f.blit(a.plumes[Math.max(0, Math.min(8, Math.round((sway + 1) * 4)))], PLUME_X, 0);
  // piscar e, trabalhando, olhar de lado para o mapa
  const blink = t % 4.9 > 4.75 || t % 11.3 > 11.15;
  const g = Math.sin(t * 0.5 + 2);
  const gaze = info.working && g > 0.7 ? -1 : 0;
  if (blink || gaze) captainEyes(f, blink, gaze);
  // reflexo correndo pelo peitoral e brilho no broche
  const s = (t * 0.45) % 2.4;
  if (s < 1) {
    const y = Math.round(50 + s * 13);
    f.set(31, y, PAL.steel[5]);
    f.set(30, y + 1, PAL.steel[4]);
  }
  paintGlint(f, 45, 17, pulse(t + 0.8, info.working ? 2.6 : 4.4, 0.5) * 0.8);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Ordem de cavalaria

const HEARTH = [32, 58]; // base do fogo
const SCONCE = [9, 40]; // tocha na parede da esquerda
const BANNERS = [
  // x da esquerda, comprimento, rampa, cor do emblema, emblema
  [2, 17, PAL.banner, PAL.gold[4], ['..#..', '..#..', '#####', '.###.', '.#.#.']],
  [12, 19, AZURE, PEARL[3], ['.###.', '##...', '#....', '##...', '.###.']],
  [23, 16, ramp('#0c2214', '#16381e', '#24542c', '#3a7240'), PAL.gold[4], ['.....', '#.#.#', '#####', '#####', '.....']],
  [34, 18, ramp('#4a2a10', '#8a5c1c', '#c48e2c', '#e8b848'), PAL.banner[2], ['..#..', '.###.', '##.##', '#...#', '.....']],
  [45, 16, ramp('#1e1030', '#36205a', '#523484', '#7050a8'), PEARL[3], ['#.#.#', '#####', '.###.', '.###.', '.#.#.']],
  [55, 18, ramp('#6a6474', '#a8a2b0', '#dad4dc', '#fbf8f2'), PAL.banner[2], ['#.#.#', '.###.', '#####', '.###.', '#.#.#']],
];

function buildOrderBackdrop(glow) {
  const p = new Pix(64, 64);
  const [hx, hy] = HEARTH, [sx, sy] = SCONCE;
  const light = (x, y) => {
    const a = (0.5 + glow * 0.2) * clamp01(1 - Math.hypot(x + 0.5 - hx, (y + 0.5 - hy) * 0.8) / (40 + glow * 8)) ** 1.5;
    const b = (0.3 + glow * 0.15) * clamp01(1 - Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / (16 + glow * 5)) ** 1.5;
    return a + b;
  };
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.1 + light(x, y) + masonry(x, y, 7, 4, 61) * 0.85 + (hash(x, y, 62) - 0.5) * 0.05;
      p.d[y * 64 + x] = pick(HALL, v, x, y, 2);
    }
  }
  // chaminé subindo até as vigas
  p.fill(24, 0, 40, 26, () => true, (x, y) => {
    let v = 0.2 + light(x, y) + masonry(x, y, 5, 3, 63) * 0.8;
    if (x === 24) v += 0.12;
    else if (x === 40) v -= 0.12;
    return pick(HALL, v, x, y, 2);
  });
  p.rect(41, 0, 1, 26, HALL[0]);
  // viga do teto
  p.rect(0, 0, 64, 3, (x, y) => pick(PAL.wood, (y === 2 ? 0.2 : 0.38) + light(x, y) * 0.4 + (hash(x >> 2, y, 64) - 0.5) * 0.12, x, y));
  p.rect(0, 3, 64, 1, HALL[0]);
  // chão de lajes e o tapete vermelho diante da lareira
  for (let y = 60; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.2 + light(x, y) * 0.8 + masonry(x, y, 8, 2, 65) * 0.8;
      p.set(x, y, pick(HALL, v, x, y));
    }
  }
  p.fill(13, 61, 51, 63, () => true, (x, y) => {
    const edge = y === 61 || x === 13 || x === 51;
    if (edge) return PAL.gold[(x + y) % 2 ? 2 : 1];
    return pick(PAL.banner, 0.35 + light(x, y) * 0.7 + ((x + y) % 4 === 0 ? 0.1 : 0), x, y);
  });
  // cordões das varas dos estandartes
  for (const [bx] of BANNERS) { p.set(bx + 1, 4, PAL.gold[1]); p.set(bx + 5, 4, PAL.gold[1]); }
  // escudos na parede da esquerda
  paintShield(p, 2, 24, 7, 9, null, (x, y, v) => (Math.abs(x - y * 0.75) < 1.3 ? PAL.gold[4] : pick(PAL.banner, v + 0.1, x, y)));
  paintShield(p, 11, 24, 7, 9, null, (x, y, v) => (x < 4 ? pick(VERT, v + 0.1, x, y) : PEARL[y % 3 === 0 ? 1 : 2]));
  // arca de carvalho com cintas de ferro e o suporte da tocha
  const q = new Pix(64, 64);
  q.fill(2, 50, 14, 59, () => true, (x, y) => {
    if (x === 4 || x === 12) return PAL.iron[x === 4 ? 2 : 1];
    if (y === 50) return PAL.wood[3];
    if (y === 53) return PAL.iron[1];
    return pick(PAL.wood, 0.42 + light(x, y) * 0.4 - (x - 2) * 0.02 + (y < 53 ? 0.12 : 0) + (hash(x, y, 68) - 0.5) * 0.1, x, y);
  });
  q.rect(7, 54, 3, 2, (x, y) => PAL.gold[y === 54 ? 4 : 2]);
  q.rect(sx, sy + 1, 1, 4, PAL.wood[2]);
  q.rect(sx - 1, sy + 1, 3, 1, PAL.iron[2]);
  q.rect(sx, sy + 5, 1, 2, PAL.iron[1]);
  q.outline(PAL.out);
  p.blit(q, 0, 0);
  return p;
}

// Estandarte pendurado, com dobras e balanço (sway em -1..1).
function buildBanner(i, sway) {
  const [, len, r, ec, emblem] = BANNERS[i];
  const q = new Pix(11, len + 6);
  const W = 7;
  q.rect(0, 1, W + 2, 1, (x) => (x === 0 || x === W + 1 ? PAL.gold[4] : PAL.wood[3]));
  for (let j = 0; j < len; j++) {
    const off = sway * (j / len) ** 2 * 1.6;
    for (let k = 0; k < W; k++) {
      const tip = len - 3;
      if (j > tip && (i % 2 ? Math.abs(k - 3) < (j - tip) * 1.2 : Math.abs(k - 3) > 3 - (j - tip) * 1.3)) continue; // rabo ou ponta
      const x = 1 + k + Math.round(off);
      const fold = Math.sin(k * 1.5 + sway * 1.4 + i) * 0.14;
      let c = pick(r, 0.55 + fold - (k - 3) * 0.05 - j * 0.012, x, j);
      if (k === 0 || k === W - 1) c = PAL.gold[k === 0 ? 3 : 2];
      const ex = k - 1, ey = j - 4;
      if (ex >= 0 && ex < 5 && ey >= 0 && ey < 5 && emblem[ey][ex] === '#') c = ec;
      q.set(x, j + 2, c);
    }
  }
  q.outline(PAL.out);
  return q;
}

// escudo de brasão (heater) com o canto superior esquerdo em (x, y)
function paintShield(p, x0, y0, w, h, field, paint) {
  const cx = x0 + w / 2;
  const inS = (x, y) => y >= y0 && (y < y0 + h * 0.5 || Math.abs(x - cx) <= (w / 2) * Math.sqrt(Math.max(0, 1 - ((y - y0 - h * 0.5) / (h * 0.5)) ** 2)));
  const s = new Pix(64, 64);
  s.fill(x0, y0, x0 + w, y0 + h, (x, y) => inS(x, y) && x >= x0 && x <= x0 + w, (x, y) => {
    const v = 0.55 - (x + 0.5 - cx) / w * 0.5 - (y - y0) * 0.02;
    return paint ? paint(x - x0, y - y0, v) : pick(field, v, x, y);
  });
  s.outline(PAL.out);
  p.blit(s, 0, 0);
}

function buildOrder(withBanners) {
  const p = new Pix(64, 64);
  // coifa da lareira, consolo e as ombreiras
  p.poly([[23.5, 24], [40.5, 24], [47, 37.5], [17, 37.5]], (x, y) => {
    let v = 0.42 + masonry(x, y, 5, 3, 66, 24) - (x - 32) * 0.02;
    if (y === 24) v += 0.15;
    return pick(HALL, v + 0.15, x, y);
  });
  p.rect(14, 37, 37, 3, (x, y) => pick(HALL, (y === 37 ? 0.85 : y === 38 ? 0.6 : 0.35) - (x - 14) * 0.008, x, y));
  for (const x0 of [17, 42]) {
    p.rect(x0, 40, 6, 20, (x, y) => pick(HALL, 0.45 + masonry(x, y, 6, 4, 67, 40) - (x === x0 ? -0.15 : x === x0 + 5 ? 0.15 : 0) + (x0 > 30 ? -0.05 : 0.1), x, y));
  }
  p.rect(23, 40, 19, 19, FIREHOLE);
  // fundo de tijolos queimados nas laterais da boca
  p.rect(23, 40, 19, 2, (x, y) => (y === 40 ? HALL[1] : HALL[0]));
  // degrau de pedra
  p.rect(15, 59, 35, 2, (x, y) => pick(HALL, y === 59 ? 0.75 : 0.45, x, y));
  // cães de ferro e as toras
  for (const x of [25, 38]) {
    p.rect(x, 53, 2, 6, (xx) => PAL.iron[xx === x ? 2 : 1]);
    p.set(x, 52, PAL.iron[3]);
    p.set(x + 1, 52, PAL.iron[2]);
  }
  p.poly([[24, 56], [40, 54], [41, 56], [25, 58]], (x, y) => pick(PAL.wood, 0.5 - (y - 54) * 0.12 + ((x + y) % 4 === 0 ? -0.15 : 0), x, y));
  p.poly([[26, 54.5], [36, 58], [34, 59], [24, 56]], (x, y) => pick(PAL.wood, 0.4 - (y - 55) * 0.08, x, y));
  for (const [x, y] of [[40, 55], [24, 56]]) { p.set(x, y, PAL.fire[3]); p.set(x, y + 1, PAL.fire[2]); }

  // brasão da ordem na coifa: campo azul, asna de ouro e três estrelas
  paintShield(p, 27, 25, 11, 12, null, (x, y, v) => {
    const chev = Math.abs(y - 8 + Math.abs(x - 5.5) * 0.9) < 1.1;
    if (chev) return PAL.gold[v > 0.5 ? 4 : 3];
    if ((x === 2 && y === 3) || (x === 8 && y === 3) || (x === 5 && y === 9)) return PEARL[3];
    if ((Math.abs(x - 2) + Math.abs(y - 3) === 1) || (Math.abs(x - 8) + Math.abs(y - 3) === 1) || (Math.abs(x - 5) + Math.abs(y - 9) === 1)) return PEARL[1];
    return pick(AZURE, v, x, y);
  });
  // armadura completa no suporte de madeira; o lado virado para a lareira pega um reflexo quente
  const steel = (x, y, v) => (x < 52 ? pick(WARM_STEEL, v * 0.9, x, y) : pick(PAL.steel, v * 0.86, x, y));
  p.rect(54, 56, 2, 5, PAL.wood[2]);
  p.rect(49, 60, 13, 2, (x, y) => pick(PAL.wood, y === 60 ? 0.65 : 0.3, x, y));
  // pernas: coxotes, joelheiras, grevas e escarpes
  for (const lx of [51, 56]) {
    p.fill(lx, 46, lx + 3, 58, () => true, (x, y) => steel(x, y, 0.12 + cylLight((x + 0.5 - lx - 2) / 2.2) * 0.78 - (y === 50 || y === 54 ? 0.22 : 0)));
    p.fill(lx, 50, lx + 3, 53, (x, y) => ((x - lx - 2) / 2.1) ** 2 + ((y - 51.5) / 1.6) ** 2 <= 1, (x, y) =>
      steel(x, y, 0.15 + sphereLight((x + 0.5 - lx - 2) / 2.1, (y + 0.5 - 51.5) / 1.6) * 0.85));
    p.rect(lx - (lx < 54 ? 1 : 0), 58, 5, 2, (x, y) => steel(x, y, y === 58 ? 0.7 : 0.35));
  }
  // fraldão em lâminas
  for (let k = 0; k < 4; k++) {
    const y = 41 + k, hw = 4.6 + k * 0.4;
    for (let x = Math.round(55 - hw); x <= 55 + hw; x++) p.set(x, y, k === 3 ? PAL.steel[1] : steel(x, y, 0.16 + cylLight((x + 0.5 - 55.5) / hw) * 0.72 - k * 0.05));
  }
  // peitoral com quilha
  p.fill(50, 30, 61, 41, (x, y) => Math.abs(x + 0.5 - 55.5) <= 5.2 - (y > 37 ? (y - 37) * 0.4 : 0), (x, y) => {
    let v = 0.08 + cylLight((x + 0.5 - 55.5) / 5.4) * 0.8 - (y - 31) * 0.012;
    if (x === 55) v += 0.2;
    else if (x === 56) v -= 0.08;
    return steel(x, y, v);
  });
  // braços pendendo, com cotoveleiras e manoplas
  for (const ax of [48, 61]) {
    p.fill(ax, 35, ax + 2, 48, () => true, (x, y) => steel(x, y, 0.16 + cylLight((x + 0.5 - ax - 1.5) / 1.6) * 0.66 - (y === 40 || y === 44 ? 0.22 : 0)));
    p.rect(ax, 46, 3, 3, (x, y) => steel(x, y, y === 46 ? 0.6 : 0.28));
  }
  // ombreiras em lâminas arredondadas
  for (const [cx, b] of [[50, 0.06], [61, -0.08]]) {
    p.fill(cx - 4, 30, cx + 4, 36, (x, y) => ((x - cx) / 3.7) ** 2 + ((y - 33) / 2.9) ** 2 <= 1, (x, y) => {
      let v = 0.1 + sphereLight((x + 0.5 - cx) / 3.7, (y + 0.5 - 32.5) / 2.9) * 0.82 + b;
      if (y === 34) v -= 0.25; // junta das lâminas
      return steel(x, y, v);
    });
  }
  // gorjal e elmo com viseira
  p.rect(53, 29, 6, 2, (x, y) => steel(x, y, y === 29 ? 0.6 : 0.3));
  p.fill(51, 20, 60, 29, (x, y) => ((x - 55.5) / 4.6) ** 2 + ((y - 24.5) / 5) ** 2 <= 1 || (y > 25 && Math.abs(x - 55.5) < 4.2), (x, y) =>
    steel(x, y, 0.08 + sphereLight((x + 0.5 - 55.5) / 4.6, (y + 0.5 - 24) / 5) * 0.9));
  for (let x = 52; x <= 59; x++) p.set(x, 25, x < 53 ? PAL.steel[1] : SLIT);
  p.line(55, 21, 55, 24, PAL.steel[4]);
  for (const [x, y] of [[53, 27], [55, 27], [57, 27], [54, 28], [56, 28]]) p.set(x, y, PAL.steel[0]);
  // penacho vermelho caindo para trás
  const crest = [[55.5, 20.6], [57, 17.4], [59.6, 15.8], [62.2, 16.6], [63.4, 19.6]];
  p.fill(53, 13, 63, 22, (x, y) => {
    const [d, , , at] = nearestOnPath(crest, x, y);
    const hw = 1.1 + Math.sin(at * Math.PI) * 1;
    return d <= hw && !(d > hw * 0.6 && at > 0.2 && hash(Math.floor(x), Math.floor(y), 70) < 0.3);
  }, (x, y) => {
    const [, ox, oy] = nearestOnPath(crest, x + 0.5, y + 0.5);
    return pick(PLUME, 0.3 + sphereLight(ox / 2, oy / 2) * 0.7, x, y);
  });

  if (withBanners) BANNERS.forEach(([bx], i) => p.blit(buildBanner(i, 0), bx - 1, 3));
  p.outline(PAL.out);
  return p;
}

const orderArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintOrderPortrait(ctx, t, info) {
  const a = orderArt;
  if (!a.bg) {
    a.bg = buildOrderBackdrop(0);
    const [hx, hy] = HEARTH, [sx, sy] = SCONCE;
    a.halo = makeHalo(a.bg, buildOrderBackdrop(1), (x, y) =>
      Math.min(Math.hypot(x + 0.5 - hx, (y + 0.5 - hy) * 0.8) / 48, Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / 21));
    a.body = buildOrder(false);
    a.mouth = [];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (a.body.get(x, y) === FIREHOLE) a.mouth.push([x, y]);
    a.banners = BANNERS.map((b, i) => Array.from({ length: 7 }, (_, k) => buildBanner(i, -1 + k / 3)));
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  const flick = Math.sin(t * 7.9) * 0.5 + Math.sin(t * 12.7 + 1) * 0.3 + Math.sin(t * 3.1) * 0.2;
  paintHalo(f, a.halo, 0.42 + live * 0.12 + flick * 0.07 * live);
  // estandartes balançando com a corrente de ar quente
  for (let i = 0; i < BANNERS.length; i++) {
    const s = Math.sin(t * 0.9 + i * 1.7) * 0.7 + Math.sin(t * 2.1 + i) * 0.3 * live;
    f.blit(a.banners[i][Math.max(0, Math.min(6, Math.round((s + 1) * 3)))], BANNERS[i][0] - 1, 3);
  }
  f.blit(a.body, 0, 0);
  // fogo na lareira
  const tick = Math.floor(t * 14);
  const ft = t * (info.working ? 1 : 0.6);
  for (const [x, y] of a.mouth) {
    const n = Math.sin(ft * 8 + x * 1.7 + y * 0.9) * 0.18 + (hash(x, y, tick) - 0.5) * 0.3;
    const v = 1.2 - ((58 - y) / 16) * 1.3 - Math.abs(x + 0.5 - 32.5) * 0.045 + n;
    if (v > 0.12) f.set(x, y, pick(PAL.fire, v, x, y, 1.5));
  }
  // fagulhas subindo pela chaminé
  for (let k = 0; k < (info.working ? 6 : 3); k++) {
    const life = (t * (0.5 + hash(k, 1, 69) * 0.4) + hash(k, 2, 69)) % 1;
    const x = 32 + (hash(k, 3, 69) - 0.5) * 12 + Math.sin(t * 3 + k * 2) * 1.5 * life;
    const y = 54 - life * 16;
    if (y > 41) f.set(x, y, PAL.fire[life < 0.5 ? 5 : 4]);
  }
  paintFlame(f, SCONCE[0] + 0.5, SCONCE[1], t, 4 + live, 1.4, live);
  // brilho do fogo na armadura e na estrela do brasão
  paintGlint(f, 53, 22, pulse(t, info.working ? 2.3 : 4, 0.5) * 0.9);
  paintGlint(f, 32, 34, pulse(t + 1.3, 5.2, 0.5) * 0.6);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Trabuco

const PIVOT = [30, 31]; // eixo do braço
const LONG_ARM = 25, SHORT_ARM = 8, SLING = 7;
const TARGET = [53, 33]; // onde a pedra cai, na muralha da cidade
const LEGS = [[[18, 54], [29.4, 31]], [[42, 54], [30.6, 31]]];
const TREB_SUN = [11, 31];

function buildTrebuchetBackdrop() {
  const p = new Pix(64, 64);
  const [sx, sy] = TREB_SUN;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x + 0.5 - sx, (y + 0.5 - sy) * 1.3);
      const v = 0.02 + (y / 42) * 0.74 + 0.38 * clamp01(1 - d / 36) ** 1.6;
      p.d[y * 64 + x] = pick(PAL.dusk, v, x, y, 4);
    }
  }
  paintSun(p, sx, sy, 3.6);
  streakCloud(p, 16, 25, 17, 1.3, sx, sy, 21);
  streakCloud(p, 50, 11, 16, 1.7, sx, sy, 23);
  streakCloud(p, 26, 5, 12, 1.0, sx, sy, 25);
  // serra roxa ao longe
  for (let x = 0; x < 64; x++) {
    const top = Math.round(37 + 2 * Math.sin(x * 0.17 + 2) + Math.sin(x * 0.5));
    for (let y = top; y < 64; y++) p.set(x, y, pick(HILLS, (y === top ? 0.8 : 0.45) - (y - top) * 0.04, x, y));
  }
  // cidade sitiada: muralha e torres quadradas no morro da direita
  for (let x = 37; x < 64; x++) {
    const tower = (x >= 41 && x <= 45) || (x >= 56 && x <= 61);
    let top = tower ? (x <= 45 ? 27 : 25) : 32;
    if (!tower && x % 3 === 0) top -= 1;
    if (tower && (x === 42 || x === 44 || x === 57 || x === 59)) top += 1;
    for (let y = top; y < 44; y++) {
      const v = 0.45 + (x === 41 || x === 56 || x === 37 ? 0.25 : 0) - (y - top) * 0.012 + masonry(x, y, 4, 3, 26) * 0.5;
      p.set(x, y, pick(CITY, v, x, y));
    }
  }
  for (const [x, y] of [[43, 30], [58, 29], [58, 33], [49, 36]]) p.set(x, y, C('#20141e'));
  // campo pisado do acampamento
  for (let y = 43; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.62 - (y - 43) * 0.022 + (hash(x >> 1, y, 27) - 0.5) * 0.16 + (((x * 3 + y * 7) % 11) === 0 ? -0.15 : 0);
      p.set(x, y, pick(FIELD, v, x, y));
    }
  }
  // tendas listradas com flâmulas
  const tent = (cx, base, hw, h, seed) => {
    const s = new Pix(64, 64);
    s.fill(cx - hw, base - h, cx + hw, base, (x, y) => Math.abs(x - cx) <= hw * (y - base + h) / h, (x, y) => {
      const stripe = Math.floor((x - cx + 50) * 0.5) % 2;
      const v = 0.6 - (x + 0.5 - cx) / hw * 0.3 - (y - base + h) * 0.02;
      return stripe ? pick(TENT, v, x, y) : pick(PAL.banner, v - 0.05, x, y);
    });
    s.set(cx, base - 1, TENT[0]);
    s.set(cx, base, TENT[0]);
    s.outline(PAL.out);
    p.blit(s, 0, 0);
    p.rect(cx, base - h - 3, 1, 3, PAL.wood[1]);
    p.rect(cx + 1, base - h - 3, 2, 1, PAL.banner[seed % 2 ? 3 : 2]);
  };
  tent(36, 46, 3.5, 5, 3);
  tent(49, 45, 3, 4, 4);
  tent(21, 45, 3, 4, 5);
  tent(5, 50, 5, 7, 1);
  tent(62, 49, 4, 6, 2);
  // estacas da paliçada
  for (let x = 0; x < 64; x += 3) {
    if (x > 9 && x < 52) continue;
    p.rect(x, 54, 1, 4, PAL.wood[1]);
    p.set(x, 53, PAL.wood[3]);
  }
  return p;
}

// Cavalete em A (pernas e travessas). dx, dy desloca; shade escurece a estrutura de trás.
function trebFrame(p, dx, dy, shade, bars) {
  for (const [[ax, ay], [bx, by]] of LEGS) {
    const lx = ax + dx, ly = ay + dy, tx = bx + dx, ty = by + dy;
    const len2 = (tx - lx) ** 2 + (ty - ly) ** 2;
    const at = (x, y) => {
      const s = ((x - lx) * (tx - lx) + (y - ly) * (ty - ly)) / len2;
      return [s, x - lx - (tx - lx) * s];
    };
    p.fill(Math.min(lx, tx) - 2, ty - 1, Math.max(lx, tx) + 2, ly, (x, y) => {
      const [s, ox] = at(x, y);
      return s >= 0 && s <= 1 && Math.abs(ox) <= 1.15;
    }, (x, y) => {
      const [, ox] = at(x + 0.5, y + 0.5);
      return pick(PAL.wood, 0.5 - ox * 0.28 + shade + (hash(x, y >> 1, 28) - 0.5) * 0.12, x, y);
    });
  }
  if (!bars) return;
  // travessas e escoras
  p.rect(22 + dx, 47 + dy, 17, 2, (x, y) => pick(PAL.wood, (y === 47 + dy ? 0.6 : 0.3) + shade, x, y));
  p.line(8 + dx, 53 + dy, 22 + dx, 41 + dy, (x, y) => pick(PAL.wood, 0.4 + shade, x, y));
}

function buildTrebuchet() {
  const p = new Pix(64, 64);
  // estrutura de trás, mais escura
  trebFrame(p, 2, -1, -0.24, true);
  // base com a viga longa
  p.fill(5, 53, 55, 56, () => true, (x, y) => {
    let v = y === 53 ? 0.78 : y === 56 ? 0.2 : 0.5;
    if ((x - 5) % 10 === 0) v -= 0.22;
    return pick(PAL.wood, v + (hash(x >> 1, y, 29) - 0.5) * 0.12, x, y);
  });
  for (const [x, y] of [[7, 54], [17, 54], [27, 54], [37, 54], [47, 54]]) p.set(x, y, PAL.iron[3]);
  // rodas raiadas
  for (const wx of [13, 47]) {
    p.fill(wx - 4, 55, wx + 4, 63, (x, y) => Math.hypot(x - wx, y - 59.5) <= 3.9, (x, y) => {
      const d = Math.hypot(x + 0.5 - wx, y + 0.5 - 59.5);
      if (d > 2.8) return pick(PAL.wood, 0.25 + sphereLight((x + 0.5 - wx) / 4, (y + 0.5 - 59.5) / 4) * 0.7, x, y);
      if (d < 1.1) return PAL.iron[2];
      const ang = Math.atan2(y + 0.5 - 59.5, x + 0.5 - wx);
      return Math.abs(Math.sin(ang * 2)) < 0.4 ? PAL.wood[2] : 0;
    });
  }
  // sarilho na traseira
  p.fill(5, 47, 12, 53, (x, y) => Math.hypot(x - 8.5, y - 50) <= 2.9, (x, y) =>
    pick(PAL.wood, 0.3 + sphereLight((x + 0.5 - 8.5) / 2.9, (y + 0.5 - 50) / 2.9) * 0.7 - ((x + y) % 3 === 0 ? 0.2 : 0), x, y));
  p.rect(7, 49, 3, 2, PAL.leather[2]);
  // soldado de guarda com a lança, pequeno perto da máquina
  p.rect(60, 43, 1, 13, (x, y) => (y < 45 ? PAL.steel[y === 43 ? 5 : 3] : PAL.wood[2]));
  p.set(57, 53, PAL.leather[1]);
  p.set(57, 54, PAL.leather[1]);
  p.set(59, 53, PAL.leather[2]);
  p.set(59, 54, PAL.leather[2]);
  p.rect(57, 49, 3, 4, (x, y) => (y === 51 ? PAL.leather[2] : PAL.banner[x === 57 ? 3 : 2]));
  p.set(58, 48, PAL.skin[4]);
  p.rect(57, 47, 3, 1, (x) => PAL.steel[x === 57 ? 5 : 3]);
  p.set(58, 46, PAL.steel[4]);
  p.set(60, 50, PAL.skin[3]);
  // pilha de pedras para atirar
  for (const [x, y, r] of [[56, 61, 2.1], [60, 61.5, 2], [58, 58.6, 1.9], [62.5, 59, 1.6]]) p.sphere(x, y, r, r * 0.9, PAL.stone, 0, 1.8);
  p.outline(PAL.out);
  return p;
}

// Estrutura da frente: fica por cima do braço, que gira entre as duas.
function buildTrebuchetFront() {
  const p = new Pix(64, 64);
  trebFrame(p, 0, 0, 0, false);
  p.sphere(PIVOT[0], PIVOT[1], 2.2, 2.2, PAL.iron, 0.1);
  p.set(PIVOT[0], PIVOT[1], PAL.iron[0]);
  p.outline(PAL.out);
  return p;
}

// Ponta da funda para o braço em a, com o ângulo da funda sl (0 = pendurada).
function slingEnd(a, sl) {
  const lx = PIVOT[0] + Math.sin(a) * LONG_ARM, ly = PIVOT[1] - Math.cos(a) * LONG_ARM;
  return [lx, ly, lx + Math.sin(sl) * SLING, ly + Math.cos(sl) * SLING];
}

// Braço, contrapeso e funda para o ângulo a (0 = braço comprido para cima).
// Primeiro passa o contorno engordado, depois o miolo, para não precisar de outline.
function paintArm(f, a, sl, loaded) {
  const [px, py] = PIVOT;
  const dx = Math.sin(a), dy = -Math.cos(a);
  const sx = px - dx * SHORT_ARM, sy = py - dy * SHORT_ARM;
  const [lx, ly, ex, ey] = slingEnd(a, sl);
  const bx0 = Math.round(sx - 6), by0 = Math.round(sy + 3);
  const L = LONG_ARM + SHORT_ARM;
  const x0 = Math.floor(Math.min(lx, sx) - 3), x1 = Math.ceil(Math.max(lx, sx) + 3);
  const y0 = Math.floor(Math.min(ly, sy) - 3), y1 = Math.ceil(Math.max(ly, sy) + 3);
  for (let pass = 0; pass < 2; pass++) {
    const grow = pass ? 0 : 1;
    // cordas da funda
    if (pass) {
      f.line(lx, ly, ex - 0.6, ey, PAL.leather[1]);
      f.line(lx, ly, ex + 0.6, ey, PAL.leather[3]);
    }
    // braço afinando para a ponta, com duas cintas de ferro; em cada linha só
    // percorre o trecho de x onde a faixa do braço pode estar
    const W = 1.6 + grow;
    for (let y = y0; y <= y1; y++) {
      const qy = y + 0.5 - sy;
      let u0 = -99, u1 = 99;
      if (Math.abs(dy) > 1e-4) {
        const ua = (-W - qy * dx) / -dy, ub = (W - qy * dx) / -dy;
        u0 = Math.min(ua, ub); u1 = Math.max(ua, ub);
      } else if (Math.abs(qy * dx) > W) continue;
      if (Math.abs(dx) > 1e-4) {
        const ua = (-0.03 * L - qy * dy) / dx, ub = (1.02 * L - qy * dy) / dx;
        u0 = Math.max(u0, Math.min(ua, ub)); u1 = Math.min(u1, Math.max(ua, ub));
      }
      for (let x = Math.max(x0, Math.ceil(u0 + sx - 0.5)); x <= Math.min(x1, Math.floor(u1 + sx - 0.5)); x++) {
        const qx = x + 0.5 - sx;
        const s = (qx * dx + qy * dy) / L;
        if (s < -0.03 || s > 1.02) continue;
        const side = qx * -dy + qy * dx;
        if (Math.abs(side) > 1.6 - s * 0.75 + grow) continue;
        if (!pass) { f.set(x, y, PAL.out); continue; }
        const band = Math.abs(s * L - 3.5) < 0.6 || Math.abs(s * L - 16) < 0.6;
        f.set(x, y, band ? PAL.iron[side < 0 ? 3 : 1] : pick(PAL.wood, 0.55 - side * 0.3 + (hash(Math.floor(s * 30), 0, 31) - 0.5) * 0.12, x, y));
      }
    }
    // ferragem do contrapeso e a caixa cheia de pedras
    if (pass) {
      f.line(sx, sy, bx0 + 1, by0, PAL.iron[2]);
      f.line(sx, sy, bx0 + 10, by0, PAL.iron[1]);
    } else {
      f.line(sx - 1, sy, bx0, by0, PAL.out);
      f.line(sx + 1, sy, bx0 + 11, by0, PAL.out);
    }
    for (let y = by0 - 1 - grow; y <= by0 + 9 + grow; y++) {
      for (let x = bx0 - grow; x <= bx0 + 11 + grow; x++) {
        if (!pass) { if (y >= by0 || (x > bx0 - 1 && x < bx0 + 12 && hash(x - bx0, 0, 32) < 0.85)) f.set(x, y, PAL.out); continue; }
        if (y < by0) {
          if (x > bx0 && x < bx0 + 11 && hash(x - bx0, 0, 32) < 0.85) f.set(x, y, PAL.stone[((x - bx0) % 3) + 2]);
          continue;
        }
        let c;
        if (x === bx0 || x === bx0 + 11 || x === bx0 + 5) c = PAL.iron[x === bx0 ? 3 : 1];
        else if (y === by0) c = PAL.wood[4];
        else c = pick(PAL.wood, 0.68 - (x - bx0) * 0.04 - ((y - by0) % 3 === 0 ? 0.26 : 0), x, y);
        f.set(x, y, c);
      }
    }
    // bolsa da funda com a pedra
    if (loaded) {
      const r = 1.5 + grow;
      for (let y = Math.floor(ey - r); y <= ey + r; y++) {
        for (let x = Math.floor(ex - r); x <= ex + r; x++) {
          if (Math.hypot(x + 0.5 - ex, y + 0.5 - ey) > r) continue;
          f.set(x, y, pass ? pick(PAL.stone, 0.3 + sphereLight((x + 0.5 - ex) / r, (y + 0.5 - ey) / r) * 0.8, x, y) : PAL.out);
        }
      }
    } else if (pass) f.set(ex, ey, PAL.leather[2]);
  }
}

// Balanço lento do braço: devolve o ângulo, a velocidade angular e a fase.
function armState(t, working) {
  const w = working ? 0.85 : 0.6, amp = working ? 1.15 : 0.75;
  const ph = t * w;
  return [-0.55 + amp * Math.sin(ph), amp * w * Math.cos(ph), ph];
}
// a funda arrasta atrás do braço quando ele balança
const slingAngle = (a, v) => Math.max(-1.4, Math.min(1.4, -v * 1.3 + Math.sin(a) * 0.3));

const RELEASE = Math.PI / 2 - 0.2; // fase em que a pedra sai da funda
const trebArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintTrebuchetPortrait(ctx, t, info) {
  const a = trebArt;
  if (!a.bg) {
    a.bg = buildTrebuchetBackdrop();
    a.body = buildTrebuchet();
    a.front = buildTrebuchetFront();
    const ra = -0.55 + 1.15 * Math.sin(RELEASE), rv = 1.15 * 0.85 * Math.cos(RELEASE);
    a.release = slingEnd(ra, slingAngle(ra, rv)).slice(2);
  }
  const f = a.frame.copyFrom(a.bg);
  // fumaça da cidade queimando e da fogueira do acampamento
  paintSmoke(f, 51, 31, t, 8, 26, 9, 3.4, SMOKE, 1);
  paintSmoke(f, 28, 45, t * 0.8, 5, 14, 5, 2, SMOKE, 2);
  if (Math.sin(t * 7) + Math.sin(t * 11.7) > -0.8) f.set(28, 45, PAL.fire[4]);
  f.set(27, 45, PAL.fire[2]);
  f.set(29, 45, PAL.fire[3]);
  f.blit(a.body, 0, 0);
  const [ang, v, ph] = armState(t, info.working);
  // trabalhando: solta a pedra no alto do balanço e recarrega quando o braço volta
  const cyc = (((ph - RELEASE) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const flying = info.working && cyc < Math.PI + 0.2;
  paintArm(f, ang, slingAngle(ang, v), !flying);
  f.blit(a.front, 0, 0);
  if (flying) {
    const u = cyc / 1.3;
    const [ox, oy] = a.release;
    if (u < 1) {
      const x = Math.round(ox + (TARGET[0] - ox) * u), y = Math.round(oy + (TARGET[1] - oy) * u * u - Math.sin(u * Math.PI) * 6);
      for (const [dx, dy] of [[-1, 0], [0, -1], [1, -1], [2, 0], [2, 1], [1, 2], [0, 2], [-1, 1]]) f.set(x + dx, y + dy, PAL.out);
      f.set(x, y, PAL.stone[4]);
      f.set(x + 1, y, PAL.stone[3]);
      f.set(x, y + 1, PAL.stone[2]);
      f.set(x + 1, y + 1, PAL.stone[1]);
    } else if (u < 1.8) {
      // poeira e lascas do impacto
      const k = (u - 1) / 0.8;
      for (let i = 0; i < 9; i++) {
        const ang2 = -Math.PI * (0.1 + 0.8 * hash(i, 1, 33)), r = 1 + k * (2 + hash(i, 2, 33) * 3.5);
        f.set(TARGET[0] + Math.cos(ang2) * r, TARGET[1] + Math.sin(ang2) * r + k * k * 3, i % 3 ? SMOKE[k < 0.5 ? 4 : 3] : PAL.fire[3]);
      }
    }
  }
  f.draw(ctx);
}

function buildTrebuchetSilhouette() {
  const p = buildTrebuchet();
  paintArm(p, 0.35, 0.15, true);
  p.blit(buildTrebuchetFront(), 0, 0);
  return p;
}

// ---------------------------------------------------------------------------
// Ícones 16x16

function iconFortress() {
  const p = new Pix(16, 16);
  // rochedo
  p.fill(0, 12, 15, 15, (x, y) => y >= 13 || (x > 0 && x < 15), (x, y) => pick(ROCK, 0.9 - (x % 3) * 0.16 - (y - 12) * 0.1, x, y));
  // muralhas baixas dos lados
  for (const x0 of [1, 11]) {
    p.rect(x0, 7, 4, 6, (x, y) => (x === x0 ? SUNLIT[4] : pick(FORT, 0.8 - (x - x0) * 0.1 - (y % 2) * 0.1, x, y)));
    p.set(x0, 6, SUNLIT[5]);
    p.set(x0 + 2, 6, FORT[7]);
    p.set(x0 + (x0 < 8 ? 1 : 2), 9, SLIT);
  }
  // torre de menagem quadrada, janela acesa e portão
  p.rect(4, 3, 8, 10, (x, y) => (x === 4 ? SUNLIT[4] : pick(FORT, 0.92 - (x - 5) * 0.07 - (y % 3 === 0 ? 0.14 : 0), x, y)));
  for (const x of [4, 5, 7, 8, 10, 11]) p.set(x, 2, x === 4 ? SUNLIT[5] : FORT[7]);
  p.rect(7, 5, 2, 2, (x, y) => PAL.fire[y === 5 ? 5 : 4]);
  p.rect(7, 10, 2, 3, SLIT);
  // bandeira
  p.rect(8, 0, 1, 2, PAL.iron[3]);
  p.rect(9, 0, 3, 2, (x, y) => PAL.banner[y === 0 ? 3 : 2]);
  p.outline(PAL.out);
  return p;
}

function iconCaptain() {
  const p = new Pix(16, 16);
  p.sphere(7.5, 9.5, 4, 4.6, PAL.skin, 0.05);
  // barba
  p.fill(2, 9, 13, 16, (x, y) => ((x - 7.5) / 4.4) ** 2 + ((y - 10) / 5) ** 2 <= 1 && (y > 11.5 || Math.abs(x - 7.5) > 3), (x, y) =>
    pick(DARK_HAIR, 0.55 - (y - 11) * 0.06 + ((x + y) % 3 === 0 ? -0.15 : 0), x, y));
  for (let x = 5; x <= 9; x++) p.set(x, 11, DARK_HAIR[x < 7 ? 4 : 3]);
  p.set(6, 9, PAL.iris);
  p.set(9, 9, PAL.iris);
  p.set(10, 8, SCAR);
  p.set(10, 10, SCAR);
  // chapéu de aba larga e pluma
  p.fill(3, 1, 13, 7, (x, y) => ((x - 8) / 4.6) ** 2 + ((y - 5) / 4) ** 2 <= 1 && y < 6.6, (x, y) => pick(FELT, 0.3 + sphereLight((x + 0.5 - 8) / 4.6, (y + 0.5 - 3) / 4) * 0.7, x, y));
  p.rect(0, 6, 14, 1, (x) => FELT[x < 7 ? 4 : 3]);
  p.rect(1, 7, 3, 1, FELT[2]);
  p.rect(4, 5, 8, 1, (x) => PAL.banner[x < 8 ? 3 : 2]);
  for (const [x, y, k] of [[12, 4, 3], [13, 3, 3], [13, 2, 4], [14, 1, 4], [14, 2, 3], [15, 3, 2], [12, 5, 2]]) p.set(x, y, PLUME[k]);
  p.set(11, 5, PAL.gold[4]);
  p.outline(PAL.out);
  return p;
}

function iconOrder() {
  const p = new Pix(16, 16);
  // duas lanças em V atrás do escudo, com as flâmulas no alto
  for (const [x0, x1, dir] of [[1, 6, 1], [14, 9, -1]]) {
    p.line(x0, 2, x1, 14, PAL.wood[dir > 0 ? 4 : 3]);
    p.set(x0, 0, PAL.steel[4]);
    p.set(x0, 1, PAL.steel[5]);
    p.set(x0 + dir, 2, PAL.banner[3]);
    p.set(x0 + dir * 2, 2, PAL.banner[2]);
    p.set(x0 + dir, 3, PAL.banner[2]);
  }
  // escudo azul com asna de ouro e duas estrelas
  p.fill(4, 5, 11, 15, (x, y) => y < 10 || Math.abs(x - 7.5) <= 4 * Math.sqrt(Math.max(0, 1 - ((y - 10) / 5.2) ** 2)), (x, y) => {
    const chev = Math.abs(y - 11.2 + Math.abs(x + 0.5 - 8) * 0.95) < 0.9;
    if (chev) return PAL.gold[x < 8 ? 5 : 3];
    if ((x === 5 || x === 10) && y === 7) return PEARL[3];
    return pick(AZURE, 0.8 - (x - 4) * 0.08 - (y - 5) * 0.02, x, y);
  });
  p.outline(PAL.out);
  return p;
}

function iconTrebuchet() {
  const p = new Pix(16, 16);
  // base e rodas
  p.rect(1, 12, 14, 2, (x, y) => PAL.wood[y === 12 ? 4 : 2]);
  for (const x of [3, 12]) { p.rect(x - 1, 14, 3, 2, PAL.wood[1]); p.set(x, 14, PAL.iron[2]); }
  // cavalete em A
  p.line(3, 12, 7, 5, PAL.wood[3]);
  p.line(11, 12, 7, 5, PAL.wood[2]);
  p.rect(5, 9, 5, 1, PAL.wood[2]);
  // braço inclinado, funda com pedra e contrapeso
  p.line(1, 1, 10, 7, PAL.wood[4]);
  p.line(2, 1, 10, 6, PAL.wood[3]);
  p.rect(9, 8, 4, 3, (x, y) => (y === 8 ? PAL.stone[3] : x === 9 ? PAL.iron[2] : PAL.wood[2]));
  p.set(10, 7, PAL.iron[2]);
  p.set(1, 3, PAL.leather[2]);
  p.rect(0, 4, 2, 2, (x) => PAL.stone[x ? 2 : 4]);
  p.set(7, 5, PAL.iron[4]);
  p.outline(PAL.out);
  return p;
}

ART.portraits.fortress = paintFortressPortrait;
ART.portraits.captain = paintCaptainPortrait;
ART.portraits.order = paintOrderPortrait;
ART.portraits.trebuchet = paintTrebuchetPortrait;
ART.locked.fortress = ART.silhouette(() => {
  const p = buildFortress(0);
  paintFortressFlags(p, new Pix(14, 14), 0, false);
  return p;
});
ART.locked.captain = ART.silhouette(() => buildCaptain(true));
ART.locked.order = ART.silhouette(() => {
  // a boca da lareira fica vazada, para o arco aparecer contra o céu
  const p = buildOrder(true);
  for (let i = 0; i < p.d.length; i++) if (p.d[i] === FIREHOLE) p.d[i] = 0;
  return p;
});
ART.locked.trebuchet = ART.silhouette(buildTrebuchetSilhouette);
Object.assign(ART.icons, { fortress: iconFortress, captain: iconCaptain, order: iconOrder, trebuchet: iconTrebuchet });
})();
