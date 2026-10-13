'use strict';
// Linha da comida, tiers 9 a 11: Castelo (gera solares), Barão (gera castelos) e
// Conde (gera barões). Retratos animados, silhuetas bloqueadas e ícones.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, makeCloud } = ART;

// céu de tempestade com o sol escondido atrás das nuvens
const STORM_SKY = ramp('#1e2240', '#2a3154', '#3a446c', '#505d86', '#6c789c', '#9696ac', '#c4aca0', '#e8c494');
const STORM_CLOUD = ramp('#2a2c4a', '#424664', '#62648a', '#8a88a4', '#b8aeb8', '#e2d0c2', '#fff0d8');
const FAR_HILLS = ramp('#262a48', '#33385a', '#454a6c', '#5a5e80', '#727696');
const DARK = C('#120c12'); // fundo de portão e frestas
const WIN = C('#170f19'); // janela que acende com as tochas

// salão do barão e gabinete do conde
const HALL = ramp('#120e12', '#1e171b', '#2c2226', '#3e3032', '#54423e', '#6e564a', '#8c6e56', '#ae8a64');
const TAPESTRY = ramp('#2a0a10', '#4a1219', '#6e1c22', '#922a2c', '#b4403a');
const TAP_BLUE = ramp('#0e1636', '#1a2856', '#2a3e7c', '#425ca2');
const STUDY = ramp('#100c0c', '#1c1514', '#2a201c', '#3a2c24', '#4e3b2e', '#665040', '#826852', '#a08466');
const GLASS = ramp('#33405e', '#4f6a8c', '#7898b8', '#a8c6da', '#d6e8ee', '#f8fcf4');

// gente nobre
const CHESTNUT = ramp('#1e0f09', '#3a1d0f', '#5c3016', '#80461f', '#a3602c', '#c27e40');
const CAPE = ramp('#0c1230', '#161f48', '#222f64', '#314486', '#475ea8', '#6680c6');
const FUR = ramp('#2a1f1a', '#46362c', '#685240', '#8c7158', '#b09476', '#d2b898', '#eedcc0');
const WINE = ramp('#220a12', '#3e1220', '#5e1a2c', '#82263c', '#a6384c', '#c45460');
const PEARL = ramp('#6a6474', '#a8a2b0', '#dad4dc', '#fbf8f2');
const VELVET = ramp('#08130d', '#0d1f15', '#142e1e', '#1d4029', '#285636', '#367046', '#4c8c58');
const GREY = ramp('#2a262c', '#47434a', '#68646c', '#8c888e', '#b2aeb2', '#d6d4d2', '#f2f0ec');
const PLUM = ramp('#160a1a', '#26112e', '#3a1a46', '#52275e', '#6c3678', '#8a4e94', '#a86cae');
const BROWN_EYE = C('#3a2416'), BROWN_HI = C('#7a5032');
const RUBY = ramp('#4a0a14', '#8e1626', '#d03a42', '#ff9a8a');
const SAPPHIRE = ramp('#0e1a4a', '#1e3a8e', '#3e6ad0', '#9ac0ff');

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

// Chama de tocha ou vela com a base em (x, y): núcleo claro embaixo, ponta que dança.
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
      const heat = 1.08 - r * 0.75 - u * 0.5;
      f.set(px, y - k, pick(PAL.fire, heat, px, y - k, 1.4));
    }
  }
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

// Mistura duas cores no formato do ImageData (k = 0 fica a, 1 vira b).
function mix(a, b, k) {
  const ch = (s) => Math.round(((a >>> s) & 255) + (((b >>> s) & 255) - ((a >>> s) & 255)) * k);
  return ((255 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0;
}

// Pulso de brilho que aparece de tempos em tempos: 0 quase sempre, sobe e desce rápido.
function pulse(t, period, width) {
  const ph = (t % period) / width;
  return ph < 1 ? Math.sin(ph * Math.PI) : 0;
}

// ---------------------------------------------------------------------------
// Castelo

const AX = 32.5; // eixo vertical dos três retratos (centro do pixel 32)
const hillTop = (x) => 47 + ((x - AX) / 32) ** 4 * 15;
const baseRow = (x) => Math.round(hillTop(x + 0.5));
const TOWERS = [12.5, 52.5];

function cloudBank(p, blobs, sx, sy) {
  let x0 = 64, y0 = 64, x1 = 0, y1 = 0;
  for (const [cx, cy, rx, ry] of blobs) {
    x0 = Math.min(x0, cx - rx); x1 = Math.max(x1, cx + rx);
    y0 = Math.min(y0, cy - ry); y1 = Math.max(y1, cy + ry);
  }
  p.fill(x0, y0, x1, y1, (x, y) => blobs.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1), (x, y) => {
    let best = 0, depth = 0, under = 0;
    for (const [cx, cy, rx, ry] of blobs) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const dd = nx * nx + ny * ny;
      if (dd > 1) continue;
      if (sphereLight(nx, ny) > best) { best = sphereLight(nx, ny); under = ny; }
      depth = Math.max(depth, 1 - dd);
    }
    const near = clamp01(1 - Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / 20);
    let v = 0.08 + best * 0.62 - Math.max(0, under) * 0.22;
    if (depth < 0.22) v += near * 1.1; // borda de prata contra o sol
    else v += near * 0.25;
    return pick(STORM_CLOUD, v, x, y, 1.8);
  });
}

function buildCastleBackdrop() {
  const p = new Pix(64, 64);
  const sx = 14, sy = 13;
  // céu com raios de sol saindo de trás das nuvens
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.04 + (y / 58) * 0.9;
      if (y > sy) {
        const a = Math.atan2(y + 0.5 - sy, x + 0.5 - sx);
        const ray = Math.max(0, Math.sin(a * 17 + 0.9)) ** 2;
        v += ray * 0.3 * clamp01(1 - Math.hypot(x - sx, y - sy) / 58);
      }
      p.d[y * 64 + x] = pick(STORM_SKY, v, x, y, 1.6);
    }
  }
  cloudBank(p, [[2, 13, 8, 5], [11, 9, 7, 6], [21, 11, 8, 5.5], [30, 15, 6, 3.4], [8, 17, 11, 3.6], [22, 18, 9, 3]], sx, sy);
  cloudBank(p, [[47, 6, 6, 3.2], [55, 4, 7, 4.5], [63, 6, 6, 4], [41, 9, 5, 2.4], [56, 9, 9, 2.6]], sx, sy);
  // serra azulada ao longe
  for (let x = 0; x < 64; x++) {
    const top = Math.round(44 + 2.5 * Math.sin(x * 0.17 + 1.2) + 1.5 * Math.sin(x * 0.43));
    const slope = Math.sin((x + 1) * 0.17 + 1.2) - Math.sin(x * 0.17 + 1.2);
    for (let y = top; y < 64; y++) p.set(x, y, pick(FAR_HILLS, (y === top ? 0.9 : 0.55) - slope * 1.5 - (y - top) * 0.05, x, y));
  }
  // mata e campos no vale
  for (let x = 0; x < 64; x++) {
    const top = Math.round(51 + Math.sin(x * 0.7) * 0.8 + hash(x, 3, 9) * 1.5);
    for (let y = top; y < 64; y++) {
      const k = y - top;
      const c = k < 3
        ? pick(PAL.tree, 0.55 - k * 0.18 + (hash(x, y, 4) - 0.5) * 0.3, x, y)
        : pick(PAL.grass, 0.3 + (k % 4 === 0 ? -0.12 : 0) + (Math.floor((x + k * 2) / 9) % 2) * 0.1, x, y);
      p.set(x, y, c);
    }
  }
  return p;
}

function buildCastle() {
  const p = new Pix(64, 64);

  // colina gramada
  p.fill(0, 40, 63, 63, (x, y) => y >= hillTop(x) - 1, (x, y) => {
    let v = 0.02 + sphereLight((x + 0.5 - 24) / 46, (y + 0.5 - 80) / 34) * 0.86 - (y - 52) * 0.01;
    if (y + 0.5 < hillTop(x + 0.5) + 0.6) v += 0.16; // crista iluminada
    if (hash(x, y, 31) < 0.07) v += 0.24; // tufos de capim
    else if (hash(x, y - 1, 31) < 0.07) v -= 0.2;
    if (hash(x, y, 32) < 0.06) v -= 0.18;
    return pick(PAL.grass, v, x, y, 1.6);
  });
  // moitas nas encostas
  for (const [x, y, r] of [[3, 59, 3.2], [60, 59, 3], [9, 61, 2.4], [55, 62, 2.6]]) p.sphere(x, y, r, r * 0.8, PAL.tree, 0.1, 1.6);
  for (const [x, y, c] of [[14, 60, '#f4e9d0'], [47, 58, '#e0644c'], [19, 62, '#f3d47c'], [43, 62, '#f4e9d0']]) p.set(x, y, C(c));

  // fosso com água em volta da muralha
  for (let x = 3; x <= 61; x++) {
    const b = baseRow(x);
    const n = Math.min(4, x - 2, 62 - x);
    for (let k = 1; k <= n; k++) {
      const y = b + k;
      p.set(x, y, k === 1 ? PAL.stone[0]
        : pick(PAL.water, 0.14 + (k - 2) * 0.13 + (hash(x, y, 33) - 0.5) * 0.12 + ((x + k * 3) % 7 === 0 ? 0.16 : 0), x, y));
    }
    p.set(x, b + n + 1, pick(PAL.dirt, 0.5 + (hash(x, 1, 35) - 0.5) * 0.3, x, b + n + 1));
  }
  // caminho de terra descendo da ponte
  const b0 = baseRow(32);
  for (let y = b0 + 6; y < 64; y++) {
    const k = y - b0 - 6;
    const c = AX + Math.sin(k * 0.34) * 2.4 + k * 0.2;
    const hw = 2.4 + k * 0.24;
    for (let x = Math.floor(c - hw); x <= c + hw; x++) {
      const edge = Math.abs(x + 0.5 - c) > hw - 0.9;
      p.set(x, y, pick(PAL.dirt, 0.58 + (hash(x, y, 34) - 0.5) * 0.36 - (edge ? 0.22 : 0) - (x + 0.5 - c) * 0.03, x, y));
    }
  }

  // torre de menagem
  const kx0 = 21, kx1 = 43;
  p.fill(kx0, 13, kx1, 36, () => true, (x, y) => {
    let v = 0.5 + masonry(x, y, 5, 3, 41, 14);
    if (x <= kx0 + 1) v += 0.2;
    else if (x >= kx1 - 1) v -= 0.24;
    return pick(PAL.stone, v - (y - 14) * 0.006, x, y);
  });
  // parapeito saliente sobre cachorros de pedra, com ameias
  p.fill(kx0 - 1, 10, kx1 + 1, 11, () => true, (x, y) => pick(PAL.stone, (y === 10 ? 0.78 : 0.5) - (x - kx0) * 0.008 + (x < kx0 + 1 ? 0.12 : x > kx1 - 1 ? -0.25 : 0), x, y));
  for (let x = kx0 - 1; x <= kx1 + 1; x++) {
    p.set(x, 12, (x & 1) ? PAL.stone[x < 30 ? 4 : 3] : PAL.stone[0]);
    if ((x - kx0 + 1) % 5 < 3) {
      for (let y = 7; y < 10; y++) p.set(x, y, pick(PAL.stone, (y === 7 ? 0.82 : 0.56) + ((x - kx0 + 1) % 5 === 0 ? 0.14 : (x - kx0 + 1) % 5 === 2 ? -0.18 : 0) - (x - kx0) * 0.008, x, y));
    }
  }
  // janelas em arco e seteiras
  for (const wx of [25, 39]) {
    p.rect(wx - 1, 17, 3, 6, WIN);
    p.set(wx, 16, WIN);
    for (const [dx, dy, k] of [[-1, 16, 4], [0, 15, 4], [1, 16, 3], [-2, 17, 3], [2, 17, 1]]) p.set(wx + dx, dy, PAL.stone[k]);
    p.rect(wx - 2, 23, 5, 1, (x) => PAL.stone[x < wx ? 5 : 4]);
    p.rect(wx - 1, 24, 3, 1, PAL.stone[1]);
    p.rect(wx, 27, 1, 3, WIN);
    p.set(wx, 30, PAL.stone[4]);
  }
  // estandarte com o feixe de trigo
  p.rect(28, 14, 9, 1, (x) => (x === 28 || x === 36 ? PAL.gold[4] : PAL.wood[3]));
  p.fill(29, 15, 35, 28, (x, y) => !(y >= 26.5 && Math.abs(x - AX) < (y - 25)), (x, y) => {
    if (x === 29 || x === 35) return PAL.gold[x === 29 ? 3 : 2];
    return pick(PAL.banner, 0.62 - (x - 30) * 0.1 + (x === 31 ? 0.15 : 0) - (y - 15) * 0.012, x, y);
  });
  for (const [x, y, k] of [[31, 18, 5], [32, 17, 5], [33, 18, 4], [31, 19, 4], [32, 19, 4], [33, 19, 3], [32, 20, 3], [31, 21, 2], [32, 21, 4], [33, 21, 2], [31, 22, 3], [32, 22, 3], [33, 22, 2], [30, 23, 3], [32, 23, 2], [34, 23, 2]]) {
    p.set(x, y, PAL.wheat[k]);
  }
  // mastro da bandeira
  p.rect(32, 1, 1, 6, (x, y) => (y === 1 ? PAL.gold[5] : PAL.iron[y < 4 ? 3 : 2]));

  // muralha com ameias
  const wallTone = (x, y) => {
    let v = 0.46 + masonry(x, y, 6, 3, 43, 35) - (y - 35) * 0.009;
    if (y === 35) v += 0.12;
    return pick(PAL.stone, v, x, y);
  };
  p.fill(17, 35, 47, 63, (x, y) => y <= baseRow(Math.floor(x)) + 0.5, wallTone);
  for (let x = 17; x <= 47; x++) {
    if (Math.abs(x - 32) % 4 < 2) continue;
    for (let y = 32; y < 35; y++) p.set(x, y, pick(PAL.stone, (y === 32 ? 0.8 : 0.5) + (Math.abs(x - 32) % 4 === 2 ? 0.1 : -0.1), x, y));
  }
  // hera subindo pela muralha
  const ivy = (cx, cy, rx, ry) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (d < 1 && hash(x, y, 47) < 0.9 - d * 0.55) p.set(x, y, pick(PAL.herb, 0.6 - d * 0.25 - (y - cy) * 0.04 + (hash(x, y, 48) - 0.5) * 0.5, x, y));
      }
    }
  };
  for (const [x, y, r] of [[19.4, 40.6, 1.6], [21.2, 43, 2.1], [18.8, 45.2, 2], [21.6, 46.8, 1.8], [19.6, 48.2, 1.7]]) p.sphere(x, y, r, r, PAL.herb, -0.08, 1.4);
  ivy(20, 44.5, 3.4, 5.4);

  // portaria com o portão
  const gx0 = 26, gx1 = 38;
  p.fill(gx0, 30, gx1, 63, (x, y) => y <= baseRow(Math.floor(x)) + 0.5, (x, y) => {
    let v = 0.56 + masonry(x, y, 5, 3, 44, 30);
    if (x === gx0) v += 0.2;
    else if (x === gx1) v -= 0.24;
    return pick(PAL.stone, v - (y - 30) * 0.006, x, y);
  });
  p.fill(gx0 - 1, 28, gx1 + 1, 29, () => true, (x, y) => pick(PAL.stone, (y === 28 ? 0.84 : 0.56) + (x < gx0 ? 0.1 : x > gx1 ? -0.25 : 0), x, y));
  for (let x = gx0 - 1; x <= gx1 + 1; x++) {
    p.set(x, 30, (x & 1) ? PAL.stone[3] : PAL.stone[0]);
    if ((x - gx0 + 1) % 5 < 3) for (let y = 25; y < 28; y++) p.set(x, y, pick(PAL.stone, (y === 25 ? 0.86 : 0.6) + ((x - gx0 + 1) % 5 === 2 ? -0.16 : 0), x, y));
  }
  // brasão sobre o portão: partido de ouro e vermelho
  const shield = new Pix(64, 64);
  shield.fill(30, 31, 34, 36, (x, y) => y < 34.6 || Math.abs(x - AX) < 36.6 - y, (x, y) =>
    x < 32 ? PAL.gold[y === 31 || x === 30 ? 5 : 4] : x === 32 ? PAL.gold[2] : PAL.banner[y === 31 ? 3 : 2]);
  shield.outline(PAL.out);
  p.blit(shield, 0, 0);
  // portão em arco, grade levantada e o pátio escuro
  p.fill(27, 37, 38, b0, archTest(AX, 4.5, 37, b0), (x, y) => pick(PAL.stone, 0.88 - (x - 28) * 0.045 - ((x + y) % 3 === 0 ? 0.12 : 0), x, y));
  p.fill(28, 38, 37, b0, archTest(AX, 3.5, 38, b0), DARK);
  for (const x of [30, 32, 34]) {
    p.rect(x, 39, 1, 5, (xx, y) => PAL.iron[y === 43 ? 3 : 2]);
    p.set(x, 44, PAL.iron[1]);
  }
  p.rect(29, 41, 7, 1, PAL.iron[1]);
  p.rect(29, b0, 7, 1, PAL.dirt[1]);

  // torres redondas com telhado cônico
  for (const tc of TOWERS) {
    const tx = Math.floor(tc);
    p.fill(tc - 6, 28, tc + 6, 63, (x, y) => Math.abs(x - tc) <= 5.5 && y <= baseRow(Math.floor(x)) + 1.5, (x, y) => {
      let v = 0.06 + cylLight((x + 0.5 - tc) / 5.5) * 0.84 + masonry(x, y, 4, 3, 45, 29) * 0.9;
      if (y >= baseRow(x)) v -= 0.12;
      return pick(PAL.stone, v, x, y);
    });
    p.fill(tc - 7, 26, tc + 7, 27, (x) => Math.abs(x - tc) <= 6.5, (x, y) =>
      pick(PAL.stone, 0.12 + cylLight((x + 0.5 - tc) / 6.5) * 0.9 + (y === 26 ? 0.15 : -0.1), x, y));
    for (let x = tx - 6; x <= tx + 6; x++) p.set(x, 28, (x & 1) ? PAL.stone[x < tx ? 3 : 2] : PAL.stone[0]);
    // telhas em escamas
    const rw = (y) => 7.6 * (y - 11) / 14.5;
    p.fill(tc - 8, 11, tc + 8, 25, (x, y) => Math.abs(x - tc) <= rw(y), (x, y) => {
      const w = Math.max(0.8, rw(y + 0.5));
      let v = 0.1 + cylLight((x + 0.5 - tc) / w) * 0.95 + (25 - y) * 0.012;
      const r = (y - 11) % 3;
      if (r === 2) v -= 0.24;
      else if ((x + Math.floor((y - 11) / 3) * 2) % 4 === 0) v -= 0.12;
      else if (r === 0) v += 0.06;
      return pick(PAL.roof, v, x, y);
    });
    p.rect(tx - 7, 25, 15, 1, (x) => PAL.roof[x < tx - 3 ? 1 : 0]);
    p.set(tx, 10, PAL.gold[4]);
    p.set(tx, 9, PAL.gold[5]);
    p.rect(tx, 3, 1, 6, (x, y) => (y === 3 ? PAL.gold[5] : PAL.iron[2]));
    // janelinhas
    p.rect(tx - 1, 33, 3, 4, WIN);
    p.set(tx, 32, WIN);
    p.set(tx, 31, PAL.stone[4]);
    p.rect(tx - 1, 37, 3, 1, PAL.stone[4]);
    p.rect(tx, 41, 1, 3, WIN);
  }

  // ponte levadiça baixada sobre o fosso, com as correntes
  for (let y = b0 + 1; y <= b0 + 5; y++) {
    const k = y - b0 - 1;
    const x0 = 29 - (k >> 1), x1 = 35 + (k >> 1);
    for (let x = x0; x <= x1; x++) {
      if (x === x0 || x === x1) { p.set(x, y, PAL.wood[x === x0 ? 2 : 1]); continue; }
      p.set(x, y, pick(PAL.wood, 0.86 - (x - x0) * 0.045 - (y & 1 ? 0.2 : 0) + (hash(x, y, 50) - 0.5) * 0.12, x, y));
    }
  }
  for (const x of [26, 38]) { p.set(x, b0 + 5, PAL.stone[x < 32 ? 4 : 2]); p.set(x, b0 + 6, PAL.stone[1]); }
  for (const [xa, xb] of [[27, 28], [37, 36]]) {
    for (let y = 38; y <= b0 + 4; y++) {
      const x = Math.round(xa + (xb - xa) * (y - 38) / (b0 + 4 - 38));
      p.set(x, y, PAL.iron[(y & 1) ? 3 : 1]);
    }
  }

  p.outline(PAL.out);
  return p;
}

// Bandeira tremulando presa no mastro (px, py); cresce de onda para a ponta.
const FLAG = ramp('#5a3410', '#9a6418', '#d49a2c', '#f2c650', '#ffe68a');
function paintFlag(f, q, px, py, len, h, ph, amp) {
  q.clear();
  for (let i = 0; i < len; i++) {
    const s = Math.sin(ph - i * 0.8);
    const dy = Math.round(s * amp * (i + 1) / len);
    const lit = Math.cos(ph - i * 0.8);
    for (let j = 0; j < h; j++) {
      if (i === len - 1 && j > 0 && j < h - 1) continue; // ponta recortada
      const stripe = j === (h >> 1);
      const v = 0.6 + lit * 0.28 - j * 0.03 - i * 0.015;
      q.set(1 + i, 3 + j + dy, stripe ? pick(PAL.banner, v, i, j) : pick(FLAG, v, i, j, 3));
    }
  }
  q.outline(PAL.out);
  for (let y = 0; y < q.h; y++) q.d[y * q.w] = 0; // não cobre o mastro
  f.blit(q, px, py - 3);
}

function paintCastleFlags(f, q, t, working) {
  const ph = t * (working ? 6.5 : 3.8);
  paintFlag(f, q, 32, 2, 9, 5, ph, 1.6);
  paintFlag(f, q, 12, 4, 7, 4, ph + 1.3, 1.3);
  paintFlag(f, q, 52, 4, 7, 4, ph + 2.1, 1.3);
}

const castleArt = { bg: null, body: null, frame: new Pix(64, 64), flag: new Pix(12, 12) };

function paintCastlePortrait(ctx, t, info) {
  const a = castleArt;
  if (!a.bg) {
    a.bg = buildCastleBackdrop();
    a.body = buildCastle();
    a.clouds = [makeCloud(26, 9, 5, STORM_CLOUD), makeCloud(17, 7, 12, STORM_CLOUD)];
    a.windows = [];
    a.water = [];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const c = a.body.get(x, y);
        if (c === WIN) {
          let up = 0, dn = 0;
          while (a.body.get(x, y - up - 1) === WIN) up++;
          while (a.body.get(x, y + dn + 1) === WIN) dn++;
          a.windows.push([x, y, up / Math.max(1, up + dn)]);
        }
        else if (PAL.water.includes(c)) a.water.push([x, y]);
      }
    }
  }
  const f = a.frame.copyFrom(a.bg);
  // nuvens passando atrás do castelo
  f.blit(a.clouds[0], ((t * 1.7) % 96) - 28, 21);
  f.blit(a.clouds[1], ((t * 2.6 + 40) % 84) - 18, 0);
  f.blit(a.body, 0, 0);
  // reflexos correndo na água do fosso
  for (const [x, y] of a.water) {
    const s = Math.sin(x * 0.9 - t * 2.6 + y * 1.7) * Math.sin(x * 0.31 + t * 0.9 + y);
    if (s > 0.82) f.set(x, y, PAL.water[s > 0.93 ? 5 : 4]);
  }
  // tochas acesas nas janelas
  if (info.working) {
    for (const [x, y, rel] of a.windows) {
      const fl = Math.sin(t * 9 + x * 1.7) * 0.5 + Math.sin(t * 15.3 + y * 2.3 + x) * 0.5;
      f.set(x, y, pick(PAL.fire, 0.36 + rel * 0.42 + fl * 0.16, x, y, 1.2));
    }
  }
  paintCastleFlags(f, a.flag, t, info.working);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Barão

const BARON_TORCH = [55, 21]; // base da chama

function buildBaronBackdrop(glow) {
  const p = new Pix(64, 64);
  const [tx, ty] = BARON_TORCH;
  const reach = 30 + glow * 9, power = 0.48 + glow * 0.22;
  const light = (x, y) => power * clamp01(1 - Math.hypot((x + 0.5 - tx) * 0.9, y + 0.5 - ty) / reach) ** 1.5;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.1 + light(x, y) + masonry(x, y, 9, 5, 61) * 0.9 + (hash(x, y, 62) - 0.5) * 0.05;
      p.d[y * 64 + x] = pick(HALL, v, x, y, 2);
    }
  }
  // tapeçaria pendurada, com losangos dourados e franja
  const x0 = 3, x1 = 20, y0 = 5, y1 = 47;
  p.fill(x0, y0, x1, y1, () => true, (x, y) => {
    const fold = Math.sin((x - x0) * 0.85 + 0.6) * 0.14;
    const lit = light(x, y) * 0.5 + fold;
    const bx = Math.min(x - x0, x1 - x), by = Math.min(y - y0, y1 - y);
    if (bx < 2 || by < 2) return (bx === 1 || by === 1) && (x + y) % 2 === 0 ? PAL.gold[3] : pick(TAP_BLUE, 0.4 + lit, x, y);
    if (bx === 2 || by === 2) return PAL.gold[lit > 0.05 ? 3 : 2];
    const u = (x - 11.5 + (y - 26)) & 7, w = (x - 11.5 - (y - 26) + 64) & 7;
    if (u === 0 || w === 0) return PAL.gold[u === w ? 4 : 2];
    if (u === 4 && w === 4) return TAP_BLUE[3];
    return pick(TAPESTRY, 0.45 + lit + (hash(x, y, 63) - 0.5) * 0.12, x, y);
  });
  for (let x = x0; x <= x1; x++) if (x % 2 === 0) p.set(x, y1 + 1, PAL.gold[2]);
  p.rect(x0 - 2, y0 - 1, x1 - x0 + 5, 1, (x) => (x === x0 - 2 || x === x1 + 2 ? PAL.gold[4] : PAL.wood[2]));
  // suporte de ferro da tocha
  p.rect(56, 25, 2, 7, (x) => PAL.iron[x === 56 ? 2 : 1]);
  p.line(56, 27, 54, 27, PAL.iron[2]);
  p.line(55, 29, 55, 22, PAL.wood[3]);
  p.line(54, 29, 54, 23, PAL.wood[2]);
  p.rect(53, 21, 3, 2, (x, y) => (y === 21 ? HALL[1] : PAL.wood[1]));
  p.set(53, 26, PAL.iron[3]);
  p.set(55, 26, PAL.iron[1]);
  return p;
}

function inBaronHead(x, y) {
  const dy = (y - 32) / 13;
  const rx = dy > 0 ? 11.4 * (1 - 0.3 * dy * dy) : 11.4;
  return ((x - AX) / rx) ** 2 + dy * dy <= 1;
}

function baronEyes(p, closed, gaze) {
  for (const x0 of [26, 36]) {
    const left = x0 === 26;
    if (closed) {
      for (let i = 0; i < 3; i++) {
        p.set(x0 + i, 30, PAL.skin[3]);
        p.set(x0 + i, 31, CHESTNUT[1]);
        p.set(x0 + i, 32, PAL.skin[left ? 3 : 2]);
      }
      continue;
    }
    for (let i = 0; i < 3; i++) p.set(x0 + i, 30, CHESTNUT[1]);
    const ix = left ? (gaze < 0 ? 0 : 1) : (gaze > 0 ? 1 : 0);
    for (let i = 0; i < 3; i++) {
      const iris = i === ix || i === ix + 1;
      p.set(x0 + i, 31, iris ? (i === ix + (left ? 1 : 0) ? BROWN_HI : BROWN_EYE) : PAL.eyeWhite);
      p.set(x0 + i, 32, i === ix + (left ? 1 : 0) ? BROWN_EYE : PAL.skin[left ? 3 : 2]);
    }
  }
}

function buildBaron() {
  const p = new Pix(64, 64);
  const mx = (pts) => pts.map(([x, y]) => [65 - x, y]);

  // capa azul sobre os ombros
  p.poly([[0, 64], [1, 57], [6, 51], [15, 47.5], [24, 46], [41, 46], [50, 47.5], [59, 51], [64, 57], [65, 64]], (x, y) => {
    const nx = (x + 0.5 - AX) / 31;
    let v = 0.5 - nx * 0.4 - (y - 50) * 0.016 + Math.sin(x * 0.62 + 1) * 0.08;
    v += clamp01(1 - Math.hypot((x - 9) / 8, (y - 54) / 5)) * 0.18; // ombro iluminado
    if (x === 9 || x === 55 || x === 13) v -= 0.16; // dobras
    return pick(CAPE, v, x, y);
  });
  // gibão bordado
  p.poly([[19, 64], [23, 50], [AX, 47], [42, 50], [46, 64]], (x, y) => {
    const u = (x + y) & 3, w = (x - y + 64) & 3;
    const nx = (x + 0.5 - AX) / 12;
    if (u === 0 && w === 0) return PAL.gold[nx < 0.2 ? 4 : 3];
    if (u === 0 || w === 0) return PAL.gold[nx < -0.2 ? 2 : 1];
    return pick(WINE, 0.6 - nx * 0.3 - (y - 50) * 0.01, x, y);
  });
  // pescoço
  p.rect(27, 40, 11, 8, (x, y) => pick(PAL.skin, (y < 44 ? 0.16 : 0.34) - (x - 31) * 0.03, x, y));

  // cabelo castanho em cuia, caindo até a altura da boca
  const hairHalf = (y) => (y < 30 ? 13.6 * Math.sqrt(Math.max(0, 1 - ((y - 30) / 13.2) ** 2)) : 13.6 + (y - 30) * 0.06);
  p.fill(17, 16, 48, 40, (x, y) => y < 39.2 - (Math.abs(x - AX) < 11 ? 9 : 0) && Math.abs(x - AX) <= hairHalf(y), (x, y) => {
    const nx = (x + 0.5 - AX) / 13.6, ny = (y + 0.5 - 28) / 13;
    let v = 0.12 + sphereLight(nx, Math.min(0.9, ny)) * 0.85 + Math.sin(x * 1.2 + y * 0.5) * 0.1 + (hash(x, y, 64) - 0.5) * 0.14;
    if (y > 36) v += 0.1; // pontas viradas para dentro
    if (y === 38) v -= 0.25;
    return pick(CHESTNUT, v, x, y, 1.6);
  });

  // rosto barbeado: luz suave, para o queixo não sumir na sombra
  p.fill(21, 19, 44, 45, inBaronHead, (x, y) => {
    let v = 0.4 + sphereLight((x + 0.5 - AX) / 11.4 * 0.8, (y + 0.5 - 32) / 13 * 0.45 - 0.15) * 0.68;
    if (y < 26) v -= 0.18; // sombra da coroa
    if (y > 42) v -= 0.1;
    return pick(PAL.skin, v, x, y, 6);
  });
  // cabelo da frente: topo e têmporas, com fios grisalhos
  p.fill(18, 16, 47, 40, (x, y) => inBaronHead(x, y) && (y < 25.5 + Math.sin(x * 0.9) * 0.6 || (Math.abs(x - AX) > 9.6 - (y > 31 ? (y - 31) * 0.3 : 0) && y < 35)), (x, y) => {
    const nx = (x + 0.5 - AX) / 12;
    let v = 0.22 + sphereLight(nx, (y + 0.5 - 28) / 12) * 0.75 + Math.sin(x * 1.1 + y * 0.45) * 0.1 + (hash(x, y, 65) - 0.5) * 0.14;
    if (x === 32 && y < 26) v -= 0.25; // risca
    return pick(CHESTNUT, v, x, y, 1.6);
  });
  // fios grisalhos nas têmporas
  for (const [x, y] of [[20, 27], [20, 28], [21, 29], [21, 30], [44, 27], [44, 28], [43, 29], [43, 30]]) p.set(x, y, GREY[x < 32 ? 4 : 2]);

  // sobrancelhas
  for (const [x, y] of [[26, 27], [27, 27], [28, 27], [29, 28], [25, 28]]) {
    p.set(x, y, CHESTNUT[1]);
    p.set(64 - x, y, CHESTNUT[1]);
  }
  p.set(27, 27, CHESTNUT[3]);
  // rugas da testa e pés de galinha
  for (const x of [29, 30, 34, 35]) p.set(x, 25, PAL.skin[2]);
  p.set(24, 31, PAL.skin[2]);
  p.set(41, 31, PAL.skin[1]);
  baronEyes(p, false, 0);
  // nariz aquilino
  for (const [x, y, k] of [[32, 30, 4], [32, 31, 4], [32, 32, 5], [33, 32, 2], [33, 33, 2], [32, 33, 4], [32, 34, 4], [33, 34, 3],
    [34, 35, 1], [31, 35, 3], [32, 35, 4], [33, 35, 3], [30, 36, 2], [31, 36, 1], [32, 36, 3], [33, 36, 2], [34, 36, 1], [35, 36, 1]]) p.set(x, y, PAL.skin[k]);
  p.set(28, 35, PAL.skin[2]);
  p.set(27, 36, PAL.skin[2]);
  p.set(37, 35, PAL.skin[1]);
  p.set(38, 36, PAL.skin[1]);
  // faces coradas
  for (const [x, y] of [[24, 34], [26, 34], [25, 35]]) { p.set(x, y, PAL.blush); p.set(64 - x, y, PAL.blush); }
  // bigode farto com as pontas viradas para cima
  const stache = [[26, 37], [27, 37], [28, 37], [29, 37], [30, 37], [31, 37], [32, 37],
    [24, 38], [25, 38], [26, 38], [27, 38], [28, 38], [29, 38], [30, 38], [31, 38],
    [23, 37], [22, 36], [22, 35], [25, 39], [26, 39], [27, 39]];
  for (const [x, y] of stache) {
    p.set(x, y, CHESTNUT[y === 37 && x > 24 ? 4 : y === 39 ? 1 : x < 24 ? 3 : 2]);
    p.set(64 - x, y, CHESTNUT[y === 37 && x > 24 ? 2 : y === 39 ? 0 : x < 24 ? 2 : 1]);
  }
  p.set(32, 38, CHESTNUT[1]);
  // boca e queixo
  for (let x = 30; x <= 34; x++) p.set(x, 40, PAL.skin[0]);
  for (let x = 31; x <= 33; x++) p.set(x, 41, PAL.lip);
  p.set(31, 41, C('#c06850'));
  p.set(32, 43, PAL.skin[2]);

  // gola de pele: um rolo grosso sobre os ombros que desce pela frente da capa
  const furL = [[3, 56], [8, 51.6], [14, 48.6], [20, 46.6], [25, 46.4], [28.2, 49.4], [29.2, 54], [29, 59], [28.6, 65]];
  const furs = [furL, mx(furL)];
  const furHalf = (y) => (y < 50 ? 3.7 : 3.2);
  const nearFur = (x, y) => {
    let best = null;
    for (let k = 0; k < 2; k++) {
      const [d, ox, oy] = nearestOnPath(furs[k], x, y);
      if (!best || d < best[0]) best = [d, ox, oy, k];
    }
    return best;
  };
  p.fill(0, 40, 63, 63, (x, y) => nearFur(x, y)[0] <= furHalf(y) + (hash(Math.floor(x), Math.floor(y), 66) - 0.5) * 1.3, (x, y) => {
    const [, ox, oy, k] = nearFur(x + 0.5, y + 0.5);
    const hw = furHalf(y) + 0.6;
    let v = 0.14 + sphereLight(ox / hw, oy / hw) * 0.85 - k * 0.12 + (hash(x, y, 67) - 0.5) * 0.24;
    if ((x + y * 2) % 4 === 0) v += 0.12; // mechas
    else if ((x * 3 + y) % 5 === 0) v -= 0.14;
    return pick(FUR, v, x, y, 1.5);
  });

  // corrente de ouro com medalhão
  for (let i = 0; i <= 14; i++) {
    const s = -1 + (2 * i) / 14;
    const x = AX + s * 4.6, y = 51 + (1 - s * s) * 3.6;
    p.set(x, y, PAL.gold[i & 1 ? 2 : 4]);
    if (!(i & 1)) p.set(x, y + 1, PAL.gold[1]);
  }
  p.sphere(AX, 58.5, 3.2, 3.2, PAL.gold, 0.08);
  for (const [x, y] of [[31, 57], [33, 57], [31, 59], [33, 59]]) p.set(x, y, PAL.gold[2]);
  p.set(32, 58, RUBY[2]);
  p.set(32, 57, PAL.gold[1]);

  // coroa de barão: aro de ouro com pérolas
  const band = (x) => 21.6 + 1.7 * (1 - ((x + 0.5 - AX) / 12.4) ** 2);
  for (let x = 21; x <= 44; x++) {
    const c = Math.round(band(x));
    for (let k = -1; k <= 1; k++) {
      const v = 0.18 + cylLight((x + 0.5 - AX) / 12.6) * 0.85 + (k === -1 ? 0.18 : k === 1 ? -0.22 : 0);
      p.set(x, c + k, pick(PAL.gold, v, x, c + k));
    }
  }
  for (const [x, gem] of [[26, RUBY], [32, SAPPHIRE], [38, RUBY]]) {
    const c = Math.round(band(x));
    p.set(x, c, gem[2]);
    p.set(x + 1, c, gem[1]);
  }
  const pearl = [[-1, -1, 2], [0, -1, 3], [1, -1, 1], [-1, 0, 3], [0, 0, 3], [1, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 0]];
  for (const x of [21, 26, 32, 38, 43]) {
    const c = Math.round(band(x)) - 3;
    for (const [dx, dy, k] of pearl) p.set(x + dx, c + dy, PEARL[k]);
  }

  p.outline(PAL.out);
  return p;
}

const baronArt = { bg: null, body: null, frame: new Pix(64, 64), halo: null };

function paintBaronPortrait(ctx, t, info) {
  const a = baronArt;
  if (!a.bg) {
    a.bg = buildBaronBackdrop(0);
    const [tx, ty] = BARON_TORCH;
    a.halo = makeHalo(a.bg, buildBaronBackdrop(1), (x, y) => Math.hypot((x + 0.5 - tx) * 0.9, y + 0.5 - ty) / 38);
    a.body = buildBaron();
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 14.7 + 1) * 0.3 + Math.sin(t * 3.3) * 0.2;
  paintHalo(f, a.halo, 0.42 + live * 0.12 + flick * 0.07 * live);
  const [tx, ty] = BARON_TORCH;
  paintFlame(f, tx - 0.5, ty, t, 6 + live * 2, 2.2, live);
  // fagulhas subindo da tocha
  for (let k = 0; k < (info.working ? 4 : 2); k++) {
    const life = (t * (0.5 + hash(k, 1, 67) * 0.4) + hash(k, 2, 67)) % 1;
    f.set(tx - 1 + Math.sin(t * 3 + k * 2) * 1.5 * life, ty - 7 - life * 12, PAL.fire[life < 0.5 ? 5 : 3]);
  }
  f.blit(a.body, 0, 0);
  // piscar e, trabalhando, olhar de lado de vez em quando
  const blink = t % 4.6 > 4.45 || t % 10.3 > 10.15;
  const g = Math.sin(t * 0.55 + 1);
  const gaze = info.working ? (g > 0.75 ? 1 : g < -0.8 ? -1 : 0) : 0;
  if (blink || gaze) baronEyes(f, blink, gaze);
  // brilho no medalhão e no aro da coroa
  paintGlint(f, 31, 57, pulse(t, info.working ? 2.4 : 4.2, 0.55));
  paintGlint(f, 24, 22, pulse(t + 1.7, 5.3, 0.5) * 0.6);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Conde

const CANDLE = [57, 30]; // base da chama
const WX = 12, WHALF = 6.5, WSPRING = 17, WAPEX = 5, WSILL = 38;
const WR = (WHALF * WHALF + (WSPRING - WAPEX) ** 2) / (2 * WHALF);
// arco gótico (ogival) da janela; grow alarga para a moldura
const inLancet = (x, y, grow = 0) => {
  const half = WHALF + grow, top = WAPEX - grow * 1.6;
  if (y < top || y > WSILL + grow * 0.5) return false;
  if (Math.abs(x - WX) > half) return false;
  if (y >= WSPRING) return true;
  const r = WR + grow;
  return Math.hypot(x - (WX - half + r), y - WSPRING) <= r && Math.hypot(x - (WX + half - r), y - WSPRING) <= r;
};
const tracery = (x, y) => {
  const px = Math.floor(x), py = Math.floor(y);
  if (px === WX && py >= 17) return true; // mainel
  if (py === 27) return true; // travessa
  const d = Math.hypot(x - (WX + 0.5), y - 12.5);
  return d > 1.6 && d < 2.7; // óculo no alto
};
// raios de luz entrando pela janela, descendo para a direita
const shaftOf = (x, y) => {
  for (let s = 2; s < 46; s += 1) {
    const qx = x + 0.5 - s * 0.45, qy = y + 0.5 - s;
    if (qy < WAPEX) break;
    if (inLancet(qx, qy) && !tracery(qx, qy)) return s;
  }
  return 0;
};

function buildCountBackdrop(sun, candle) {
  const p = new Pix(64, 64);
  const [cx, cy] = CANDLE;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const s = inLancet(x + 0.5, y + 0.5, 2.2) ? 0 : shaftOf(x, y);
      const beam = s ? (0.28 + sun * 0.2) * (1 - s / 46) : 0;
      const glow = (0.32 + candle * 0.2) * clamp01(1 - Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.1) / (24 + candle * 8)) ** 1.6;
      const v = 0.14 + beam + glow + masonry(x, y, 7, 4, 71) * 0.8 + (x < 24 ? 0.05 : 0);
      p.d[y * 64 + x] = pick(STUDY, v, x, y, 2);
    }
  }
  // janela gótica: moldura de pedra, vitral em losangos e peitoril
  p.fill(0, 0, 24, 42, (x, y) => inLancet(x, y, 2.2), (x, y) => pick(PAL.stone, 0.62 - (x - WX) * 0.035 + masonry(x, y, 4, 3, 72) * 0.6, x, y));
  p.fill(0, 0, 24, 42, (x, y) => inLancet(x, y), (x, y) => {
    if (tracery(x + 0.5, y + 0.5)) return pick(PAL.stone, 0.72 - (x - WX) * 0.06, x, y);
    if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) return C('#2a2630');
    return pick(GLASS, 0.5 + sun * 0.14 - (y - 5) * 0.008 - (x - 6) * 0.012 + (hash((x + y) >> 2, (x - y + 64) >> 2, 73) - 0.5) * 0.18, x, y, 1.5);
  });
  p.rect(WX - 9, WSILL + 1, 19, 2, (x, y) => pick(PAL.stone, (y === WSILL + 1 ? 0.85 : 0.4) - (x - WX) * 0.02, x, y));

  // estante de livros à direita
  const sx0 = 46;
  p.rect(sx0, 0, 18, 64, (x, y) => pick(STUDY, 0.06 + (x === sx0 + 2 ? -0.05 : 0), x, y));
  p.rect(sx0, 0, 2, 64, (x, y) => pick(PAL.wood, (x === sx0 ? 0.7 : 0.4) + (hash(x, y >> 2, 74) - 0.5) * 0.1, x, y));
  const BOOKS = [ramp('#3a0e12', '#6a1a1e', '#94302a'), ramp('#10301c', '#1e4e2c', '#2e6e3c'), ramp('#141c40', '#22306a', '#34488e'),
    ramp('#3a2414', '#5e3c20', '#84582e'), ramp('#4a3610', '#7a5a1c', '#a8822c'), ramp('#2a1a30', '#463054', '#624a74')];
  const shelves = [12, 26, 40, 54];
  let prev = -1;
  for (let s = 0; s < shelves.length; s++) {
    const floor = shelves[s], ceil = s ? shelves[s - 1] + 2 : 0;
    p.rect(sx0 + 2, floor, 16, 2, (x, y) => pick(PAL.wood, y === floor ? 0.75 : 0.3, x, y));
    for (let x = sx0 + 3; x < 64;) {
      const bw = 2 + Math.floor(hash(x, s, 75) * 2);
      if (s === 2 && x + bw > 52 && x < 61) { x = 61; continue; } // lugar da vela
      let k = Math.floor(hash(x, s, 76) * BOOKS.length);
      if (k === prev) k = (k + 1) % BOOKS.length;
      prev = k;
      const bh = floor - ceil - 2 - Math.floor(hash(x, s, 77) * 4);
      const r = BOOKS[k];
      for (let i = 0; i < bw && x + i < 64; i++) {
        for (let y = floor - bh; y < floor; y++) {
          let c = r[i === 0 ? 2 : i === bw - 1 ? 0 : 1];
          if (y === floor - bh + 1 || y === floor - 3) c = i === bw - 1 ? PAL.gold[1] : PAL.gold[3];
          p.set(x + i, y, c);
        }
      }
      x += bw + (hash(x, s, 78) < 0.15 ? 1 : 0);
    }
  }
  // castiçal de latão com a vela
  p.rect(54, 38, 7, 2, (x, y) => PAL.gold[y === 38 ? (x < 57 ? 4 : 3) : 1]);
  p.rect(56, 36, 3, 2, (x) => PAL.gold[x === 56 ? 4 : 2]);
  p.rect(56, 31, 2, 5, (x) => (x === 56 ? C('#f4ead2') : C('#c8b896')));
  p.set(57, 31, C('#fff8e4'));
  p.set(56, 30, PAL.out);
  return p;
}

function inCountHead(x, y) {
  const dy = (y - 32) / 12.8;
  const rx = dy > 0 ? 11 * (1 - 0.3 * dy * dy) : 11;
  return ((x - AX) / rx) ** 2 + dy * dy <= 1;
}

function countEyes(p, closed) {
  for (const x0 of [26, 36]) {
    const left = x0 === 26;
    for (let i = 0; i < 3; i++) p.set(x0 + i, 29, PAL.skin[2]); // pálpebra pesada
    if (closed) {
      for (let i = 0; i < 3; i++) { p.set(x0 + i, 30, GREY[1]); p.set(x0 + i, 31, PAL.skin[2]); }
      continue;
    }
    const row = left ? [PAL.eyeWhite, PAL.irisHi, PAL.iris] : [PAL.iris, PAL.irisHi, PAL.eyeWhite];
    row.forEach((c, i) => p.set(x0 + i, 30, c));
    for (let i = 0; i < 3; i++) p.set(x0 + i, 31, PAL.skin[2]);
  }
}

function buildCount() {
  const p = new Pix(64, 64);
  // gibão de veludo verde
  p.poly([[0, 64], [1, 56], [6, 50.5], [15, 47], [24, 45.5], [41, 45.5], [50, 47], [59, 50.5], [64, 56], [65, 64]], (x, y) => {
    const nx = (x + 0.5 - AX) / 31;
    let v = 0.5 - nx * 0.36 - (y - 50) * 0.006;
    v += clamp01(1 - Math.hypot((x - 12) / 7, (y - 52) / 4)) * 0.3; // brilho do veludo no ombro
    if ((x % 6 === 0 && y % 6 === 2) || (x % 6 === 3 && y % 6 === 5)) return v > 0.45 ? PAL.gold[2] : PAL.gold[1]; // brocado
    return pick(VELVET, v, x, y, 1.6);
  });
  // costura dos ombros debruada a ouro
  for (const dir of [1, -1]) {
    for (let i = 0; i <= 18; i++) {
      const x = dir > 0 ? 24 - i : 41 + i;
      const y = 46.4 + i * 0.1 + (i / 18) ** 2 * 5.2;
      p.set(x, y, PAL.gold[i & 1 ? 2 : dir > 0 ? 4 : 3]);
      if (i % 3 === 1) p.set(x, y + 1, PAL.gold[1]);
    }
  }
  // peitilho: faixas bordadas e botões
  for (let y = 46; y < 64; y++) {
    for (const x of [28, 37]) {
      p.set(x, y, PAL.gold[x === 28 ? 3 : 2]);
      p.set(x + 1, y, (y + x) % 3 === 0 ? PAL.gold[4] : VELVET[x === 28 ? 4 : 2]);
    }
  }
  for (let y = 50; y < 64; y += 3) {
    p.set(32, y, PAL.gold[4]);
    p.set(33, y, PAL.gold[2]);
  }
  // gola alta
  p.poly([[23, 47], [25, 42], [AX, 43.5], [40, 42], [42, 47], [AX, 48.5]], (x, y) => pick(VELVET, 0.6 - (x - 25) * 0.025, x, y));
  for (let x = 24; x <= 41; x++) p.set(x, Math.round(42.4 + Math.abs(x + 0.5 - AX) * -0.08 + 1), PAL.gold[x < 32 ? 4 : 3]);
  // pescoço
  p.rect(27, 38, 11, 6, (x, y) => pick(PAL.skin, 0.2 - (x - 31) * 0.03, x, y));

  // cabelo grisalho curto dos lados
  p.fill(19, 20, 46, 40, (x, y) => ((x - AX) / 12.4) ** 2 + ((y - 30) / 11.5) ** 2 <= 1 && y < 38, (x, y) =>
    pick(GREY, 0.2 + sphereLight((x + 0.5 - AX) / 12.4, (y + 0.5 - 28) / 11.5) * 0.8 + (hash(x, y, 81) - 0.5) * 0.2 + (y % 2 ? 0 : 0.06), x, y, 1.6));
  // orelhas
  p.sphere(21.4, 33, 2.1, 3.1, PAL.skin, 0.05);
  p.sphere(43.6, 33, 2.1, 3.1, PAL.skin, -0.2);
  p.set(21, 33, PAL.skin[1]);
  p.set(44, 33, PAL.skin[0]);
  // rosto
  p.fill(21, 19, 44, 45, inCountHead, (x, y) => {
    let v = 0.34 + sphereLight((x + 0.5 - AX) / 11 * 0.8, (y + 0.5 - 32) / 12.8 * 0.5 - 0.12) * 0.7;
    if (y < 26) v -= 0.22; // sombra do chapéu
    return pick(PAL.skin, v, x, y, 6);
  });
  p.fill(19, 20, 46, 34, (x, y) => inCountHead(x, y) && Math.abs(x - AX) > 9.4 && y < 33, (x, y) =>
    pick(GREY, 0.35 + sphereLight((x + 0.5 - AX) / 11, 0) * 0.5 + (hash(x, y, 82) - 0.5) * 0.2, x, y));

  // sobrancelhas grossas e grisalhas
  for (const [x, y, k] of [[25, 27, 3], [26, 26, 4], [27, 26, 5], [28, 26, 4], [29, 27, 3], [30, 27, 2], [26, 27, 1], [27, 27, 2], [28, 27, 2]]) {
    p.set(x, y, GREY[k]);
    p.set(64 - x, y, GREY[Math.max(0, k - 1)]);
  }
  countEyes(p, false);
  // olheiras, rugas da testa e pés de galinha
  for (const x of [26, 27, 28]) { p.set(x, 32, PAL.skin[3]); p.set(64 - x, 32, PAL.skin[2]); }
  for (const x of [28, 29, 30, 34, 35, 36]) p.set(x, 24, PAL.skin[2]);
  for (const x of [30, 31, 33, 34]) p.set(x, 25, PAL.skin[3]);
  for (const [x, y] of [[24, 29], [23, 30], [24, 31]]) { p.set(x, y, PAL.skin[2]); p.set(64 - x, y, PAL.skin[1]); }
  // nariz comprido
  for (const [x, y, k] of [[32, 29, 4], [32, 30, 4], [32, 31, 4], [33, 31, 2], [32, 32, 5], [33, 32, 2], [32, 33, 4], [33, 33, 2],
    [31, 34, 3], [32, 34, 4], [33, 34, 3], [34, 34, 1], [30, 35, 2], [31, 35, 1], [32, 35, 2], [33, 35, 1], [34, 35, 1]]) p.set(x, y, PAL.skin[k]);

  // barba grisalha bem aparada, com bigode
  const inBeard = (x, y) => {
    if (inCountHead(x, y)) return y > 36 || (Math.abs(x - AX) > 8.2 && y > 32.6) || (Math.abs(x - AX) > 6.6 && y > 34.5);
    return y > 40 && y < 46.6 && Math.abs(x - AX) <= 7.6 - (y - 42) * 1.2;
  };
  p.fill(20, 32, 45, 48, inBeard, (x, y) => {
    const nx = (x + 0.5 - AX) / 11, ny = (y + 0.5 - 36) / 12;
    let v = 0.1 + sphereLight(nx, ny) * 0.78 + (hash(x, y, 83) - 0.5) * 0.24;
    if ((x * 2 + y) % 4 === 0) v -= 0.12;
    return pick(GREY, v, x, y, 1.5);
  });
  for (let x = 27; x <= 38; x++) p.set(x, 36, GREY[x < 32 ? 4 : x < 35 ? 3 : 2]);
  for (let x = 26; x <= 39; x++) if (x < 30 || x > 35) p.set(x, 37, GREY[x < 32 ? 3 : 1]);
  for (let x = 30; x <= 35; x++) p.set(x, 37, PAL.skin[0]);
  for (let x = 31; x <= 34; x++) p.set(x, 38, PAL.lip);
  p.set(31, 38, C('#be6a52'));

  // chapéu de veludo ameixa: copa fofa caída para a direita e faixa bordada a ouro
  const band = (x) => 20.6 + 1.3 * (1 - ((x + 0.5 - AX) / 12.6) ** 2);
  p.fill(17, 4, 50, 22, (x, y) => ((x - 34) / 14.6) ** 2 + ((y - 14) / 8) ** 2 <= 1 && y < 20.4, (x, y) => {
    const nx = (x + 0.5 - 34) / 14.6, ny = (y + 0.5 - 12) / 8;
    const ang = Math.atan2(y + 0.5 - 9, x + 0.5 - 33);
    let v = 0.1 + sphereLight(nx, ny) * 0.88 + Math.sin(ang * 7 + 0.5) * 0.09;
    if (y > 17) v -= (y - 17) * 0.1; // sombra embaixo da copa
    return pick(PLUM, v, x, y, 1.6);
  });
  p.sphere(33, 6.5, 1.3, 1.1, PAL.gold, 0.2);
  for (let x = 20; x <= 45; x++) {
    const c = Math.round(band(x));
    const lit = cylLight((x + 0.5 - AX) / 13);
    for (let k = -1; k <= 1; k++) {
      let col;
      if (k === 0) col = x % 3 === 1 ? PEARL[lit > 0.5 ? 3 : 2] : PAL.gold[lit > 0.62 ? 4 : lit > 0.35 ? 3 : 2];
      else col = pick(PLUM, 0.12 + lit * 0.5 + (k < 0 ? 0.12 : -0.1), x, c + k);
      p.set(x, c + k, col);
    }
  }
  // broche com safira e pluma
  p.sphere(39.5, 20.5, 1.8, 1.8, PAL.gold, 0.1);
  p.set(39, 20, SAPPHIRE[2]);
  p.set(40, 21, SAPPHIRE[1]);
  const plume = [[40, 19.4], [41.6, 16.2], [43.6, 13.2], [46, 10.8], [48.6, 9.6], [50.4, 10.2]];
  p.fill(37, 6, 52, 21, (x, y) => nearestOnPath(plume, x, y)[0] <= 0.7 + (y - 9) * 0.1, (x, y) => {
    const [d, ox, oy] = nearestOnPath(plume, x + 0.5, y + 0.5);
    const hw = 0.9 + (y - 9) * 0.1;
    let v = 0.25 + sphereLight(ox / hw, oy / hw) * 0.75;
    if (d < 0.45) v += 0.15; // haste
    else if ((x + y) % 2 === 0) v -= 0.12; // barbas
    return pick(PEARL, v, x, y);
  });

  // mão com o anel de sinete, saindo da manga
  p.poly([[0, 64], [0, 57], [6, 54.5], [12, 53.5], [16.5, 57.5], [15, 64]], (x, y) => pick(VELVET, 0.6 - (y - 55) * 0.03 + (x < 6 ? 0.08 : 0), x, y));
  // punho bordado e renda
  p.poly([[11, 53], [14, 50.6], [18.4, 56.6], [15.6, 58.6]], (x, y) => PAL.gold[(x + y) % 3 === 0 ? 2 : x + y < 66 ? 4 : 3]);
  for (let i = 0; i < 7; i++) p.set(15.6 + i * 0.62 + (i & 1), 50.2 + i * 1, PAL.linen[i & 1 ? 3 : 4]);
  p.sphere(20.5, 53, 4.4, 3.8, PAL.skin, 0.1);
  const fingers = [[48.6, 4.2], [50.6, 4.6], [52.6, 4.4], [54.6, 3.6]];
  for (const [fy, len] of fingers) {
    p.fill(21, fy - 1, 27, fy + 1, (x, y) => ((x - 23) / len) ** 2 + ((y - fy) / 1.05) ** 2 <= 1 || (x < 23 && Math.abs(y - fy) <= 1.05), (x, y) =>
      pick(PAL.skin, 0.25 + sphereLight((x + 0.5 - 22) / len, (y + 0.5 - fy) / 1.2) * 0.8, x, y));
  }
  for (const fy of [49.6, 51.6, 53.6]) for (let x = 23; x <= 26; x++) p.set(x, fy, PAL.skin[1]);
  p.line(17, 50, 21, 47, PAL.skin[4]);
  p.line(17, 51, 22, 48, PAL.skin[3]);
  // anel de ouro com pedra de cornalina
  p.rect(22, 52, 3, 3, (x, y) => PAL.gold[x === 22 || y === 52 ? 4 : 2]);
  p.set(23, 53, RUBY[1]);

  p.outline(PAL.out);
  return p;
}

const countArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintCountPortrait(ctx, t, info) {
  const a = countArt;
  if (!a.bg) {
    a.bg = buildCountBackdrop(0, 0);
    const [cx, cy] = CANDLE;
    a.shaft = new Uint8Array(64 * 64);
    for (let i = 0; i < 64 * 64; i++) a.shaft[i] = shaftOf(i & 63, i >> 6);
    a.sun = makeHalo(a.bg, buildCountBackdrop(1, 0), (x, y) => (a.shaft[y * 64 + x] ? a.shaft[y * 64 + x] / 46 : null));
    a.candle = makeHalo(a.bg, buildCountBackdrop(0, 1), (x, y) => Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.1) / 32);
    a.glass = [];
    for (let y = 0; y < 42; y++) {
      for (let x = 0; x < 24; x++) {
        const c = a.bg.get(x, y);
        if (GLASS.includes(c)) a.glass.push([x, y, 0.5 - (y - 5) * 0.008 - (x - 6) * 0.012 + (hash((x + y) >> 2, (x - y + 64) >> 2, 73) - 0.5) * 0.18]);
      }
    }
    a.body = buildCount();
    // contorno esquerdo da cabeça, que pega a luz da janela
    a.rim = [];
    const sky = C('#eef4ee');
    for (let y = 2; y < 48; y++) {
      for (let x = 0; x < 32; x++) {
        if (!a.body.get(x, y)) continue;
        for (let k = 1; k <= 2; k++) {
          const c = a.body.get(x + k, y);
          if (c && c !== PAL.out) a.rim.push([x + k, y, mix(c, sky, k === 1 ? 0.42 : 0.2), bayer(x + k, y) * 0.35 + k * 0.12]);
        }
        break;
      }
    }
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  // luz da janela: nuvens passando lá fora mudam o vitral e os raios
  const sun = 0.5 + Math.sin(t * 0.37) * 0.3 + Math.sin(t * 0.83 + 1) * 0.2;
  for (const [x, y, v] of a.glass) f.d[y * 64 + x] = pick(GLASS, v + sun * 0.18 + Math.sin(t * 0.9 - x * 0.35 + y * 0.12) * 0.05, x, y, 1.5);
  paintHalo(f, a.sun, 0.2 + sun * 0.7);
  // poeira dançando nos raios
  for (let k = 0; k < 10; k++) {
    const x = Math.floor(2 + ((hash(k, 1, 84) * 24 + Math.sin(t * 0.3 + k) * 2 + t * 0.3) % 24));
    const y = Math.floor(30 + ((hash(k, 2, 84) * 24 + t * (0.5 + hash(k, 3, 84) * 0.6)) % 24));
    if (a.shaft[y * 64 + x] && Math.sin(t * 1.7 + k * 1.9) > -0.2) f.d[y * 64 + x] = STUDY[7];
  }
  const flick = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 12.1 + 2) * 0.3 + Math.sin(t * 2.9) * 0.2;
  paintHalo(f, a.candle, 0.45 + live * 0.1 + flick * 0.06 * live);
  paintFlame(f, CANDLE[0] - 0.5, CANDLE[1], t * (0.6 + live * 0.4), 3.4 + live * 0.6, 1.2, live * 0.6);
  f.blit(a.body, 0, 0);
  for (const [x, y, c, th] of a.rim) if (sun - 0.45 > th) f.d[y * 64 + x] = c;
  if (t % 5.4 > 5.22 || t % 12.7 > 12.52) countEyes(f, true);
  // brilho no anel e na safira do broche
  paintGlint(f, 22, 52, pulse(t, info.working ? 2.1 : 3.8, 0.6));
  paintGlint(f, 39, 20, pulse(t + 2.2, 6.1, 0.45) * 0.55);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Ícones 16x16

function iconCastle() {
  const p = new Pix(16, 16);
  // torre de menagem e ameias
  p.rect(5, 4, 6, 11, (x, y) => pick(PAL.stone, (x === 5 ? 0.85 : x === 10 ? 0.3 : 0.6) - (y % 3 === 0 ? 0.12 : 0), x, y));
  for (const x of [5, 7, 8, 10]) p.set(x, 3, PAL.stone[x < 8 ? 4 : 3]);
  p.rect(7, 11, 2, 4, DARK);
  p.set(7, 10, PAL.stone[4]); p.set(8, 10, PAL.stone[3]);
  p.rect(7, 6, 2, 2, (x) => PAL.fire[x === 7 ? 5 : 4]);
  // bandeira
  p.rect(7, 0, 1, 3, PAL.iron[2]);
  p.rect(8, 0, 3, 2, (x, y) => (y === 0 ? FLAG[4] : PAL.banner[2]));
  // torres com telhado cônico
  for (const tc of [2, 13]) {
    p.rect(tc - 1, 7, 3, 8, (x, y) => pick(PAL.stone, (x === tc - 1 ? 0.8 : x === tc + 1 ? 0.25 : 0.55) - (y % 3 === 1 ? 0.12 : 0), x, y));
    p.poly([[tc - 2, 7.1], [tc + 0.5, 1.5], [tc + 3, 7.1]], (x) => PAL.roof[x < tc ? 4 : x === tc ? 3 : 1]);
    p.set(tc, 10, WIN);
  }
  p.rect(0, 15, 16, 1, PAL.grass[3]);
  p.outline(PAL.out);
  return p;
}

function iconBaron() {
  const p = new Pix(16, 16);
  p.fill(2, 4, 14, 13, (x, y) => ((x - 8) / 5.6) ** 2 + ((y - 9) / 5.4) ** 2 <= 1 && y < 12.6 && (y < 7 || Math.abs(x - 8) > 3.4), (x, y) =>
    pick(CHESTNUT, 0.25 + sphereLight((x + 0.5 - 8) / 5.6, (y + 0.5 - 8) / 5.6) * 0.8, x, y));
  p.sphere(8, 10, 4, 4.6, PAL.skin, 0.25);
  p.set(6, 10, BROWN_EYE);
  p.set(9, 10, BROWN_EYE);
  for (let x = 5; x <= 10; x++) p.set(x, 12, CHESTNUT[x < 8 ? 3 : 2]);
  p.set(4, 11, CHESTNUT[3]);
  p.set(11, 11, CHESTNUT[2]);
  p.rect(3, 5, 10, 2, (x, y) => PAL.gold[y === 5 ? (x < 8 ? 5 : 4) : 2]);
  for (const x of [3, 6, 9, 12]) p.set(x, 4, PEARL[x < 8 ? 3 : 2]);
  p.set(7, 6, RUBY[2]);
  p.outline(PAL.out);
  return p;
}

function iconCount() {
  const p = new Pix(16, 16);
  p.sphere(8, 9.5, 4, 4.6, PAL.skin, 0.1);
  p.fill(3, 10, 13, 16, (x, y) => ((x - 8) / 4.4) ** 2 + ((y - 10.5) / 4.8) ** 2 <= 1 && (y > 11.5 || Math.abs(x - 8) > 3.2), (x, y) =>
    pick(GREY, 0.62 - (y - 11) * 0.08 - (x - 6) * 0.05, x, y));
  for (let x = 6; x <= 9; x++) p.set(x, 11, GREY[x < 8 ? 5 : 4]);
  p.set(6, 9, PAL.iris);
  p.set(9, 9, PAL.iris);
  for (const x of [5, 6, 9, 10]) p.set(x, 8, GREY[4]);
  p.fill(1, 0, 15, 6, (x, y) => ((x - 8.6) / 6.6) ** 2 + ((y - 3.8) / 3.6) ** 2 <= 1 && y < 5.6, (x, y) =>
    pick(PLUM, 0.2 + sphereLight((x + 0.5 - 8.6) / 6.6, (y + 0.5 - 2.6) / 3.6) * 0.95, x, y));
  p.rect(3, 6, 10, 1, (x) => (x % 3 === 1 ? PEARL[3] : PAL.gold[x < 8 ? 4 : 3]));
  p.set(11, 5, PAL.gold[4]);
  p.set(12, 4, GREY[6]);
  p.set(13, 3, GREY[5]);
  p.outline(PAL.out);
  return p;
}

ART.portraits.castle = paintCastlePortrait;
ART.portraits.baron = paintBaronPortrait;
ART.portraits.count = paintCountPortrait;
ART.locked.castle = ART.silhouette(() => {
  const p = buildCastle();
  paintCastleFlags(p, new Pix(12, 12), 0, false);
  return p;
});
ART.locked.baron = ART.silhouette(buildBaron);
ART.locked.count = ART.silhouette(buildCount);
Object.assign(ART.icons, { castle: iconCastle, baron: iconBaron, count: iconCount });
})();
