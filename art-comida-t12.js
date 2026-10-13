'use strict';
// Linha da COMIDA, tiers 12 a 15: Duque, Rei, Imperador e Dinastia.
// Retratos da nobreza em salões de pedra e mármore, com ícones e silhuetas.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

const VELVET = ramp('#26070d', '#4a0e17', '#761822', '#a2262b', '#c8403a', '#e46c52');
const ERMINE = ramp('#5c5864', '#8e8a96', '#bcb8c0', '#e2ded8', '#f8f5ee');
const ERMINE_TAIL = C('#16111a');
const ROYAL = ramp('#0f1736', '#1a2a58', '#24407e', '#335ca0', '#4a7cbe', '#74a2d8');
const BLOND = ramp('#33210e', '#583a17', '#805a26', '#a67e38', '#c6a052', '#e0c278');
const HALL = ramp('#141018', '#1f1922', '#2b232c', '#3a3038', '#4c4046', '#625256', '#7c6a68');
const RUBY = ramp('#3a0610', '#7a0c1c', '#c01a2a', '#f04a4a', '#ffb4a8');
const SAPPHIRE = ramp('#0a1440', '#162c7c', '#2850bc', '#4c84ea', '#b0d0ff');
const EYE_BLUE = C('#2c4c7e'), EYE_BLUE_HI = C('#6c9cd2');
const DUST = C('#a89a86');
const WHITE = C('#ffffff');
const KING_HAIR = ramp('#1c100a', '#36200f', '#55351a', '#774c26', '#986634', '#b8844a');
const WAX = ramp('#8a7458', '#c4ae86', '#e8dab4', '#fbf3dc');
const CANDLE_GLOW = [C('#5e3c26'), C('#9a6634')];
const PURPLE = ramp('#1a0c2a', '#2e1648', '#462266', '#62328a', '#8250ae', '#a87ccc');
const GRAY = ramp('#24242a', '#45444c', '#6e6c72', '#9a979a', '#c4c0bc', '#e8e4dc');
const MARBLE = ramp('#5a5462', '#827a86', '#a8a0a6', '#cdc5c2', '#e8e1da', '#faf6ee');
const DARK_MARBLE = ramp('#16121c', '#211b28', '#2e2636', '#3c3344', '#4c4254', '#5e5266');
const EMERALD = ramp('#06301c', '#0c5a30', '#168a46', '#3cc06a', '#a8f0bc');
const MEDAL_BG = ramp('#2a1c14', '#4a3420', '#7a5a34', '#b8975c', '#e2cc94');
const TAPESTRY = ramp('#0a1712', '#10241b', '#173326', '#1f4432', '#2b5841', '#3a6e52');
const COLUMN = ramp('#1e171c', '#2e242a', '#44363a', '#5e4c4c', '#7c6660', '#a08676');

// ---------------------------------------------------------------------------
// Peças comuns

// Cabeça em elipse que afina no queixo.
const headTest = (hx, hy, rx, ry, taper = 0.3) => (x, y) => {
  const dy = (y - hy) / ry;
  const w = dy > 0 ? rx * (1 - taper * dy * dy) : rx;
  return ((x - hx) / w) ** 2 + dy * dy <= 1;
};

const archTest = (cx, rx, top, bottom) => (x, y) =>
  (Math.abs(x - cx) <= rx && y >= top + rx && y <= bottom) || (((x - cx) / rx) ** 2 + ((y - top - rx) / rx) ** 2 <= 1 && y <= bottom);

// Arminho: pelo branco macio com as caudinhas pretas em fileiras alternadas.
function ermine(x, y, v) {
  const row = Math.floor(y / 5);
  const col = (x + (row % 2) * 3) % 6;
  const ry = y % 5;
  if (col === 2 && (ry === 1 || ry === 2)) return ERMINE_TAIL;
  if (ry === 3 && (col === 1 || col === 3)) return ERMINE[0];
  return pick(ERMINE, v + (hash(x, y >> 1, 3) - 0.5) * 0.12, x, y, 2.6);
}

// Olhos 3x3 (cílios, íris e pálpebra de baixo); xl e xr são as colunas de fora.
function paintEyes(p, y, xl, xr, lash, iris, irisHi, closed) {
  for (const [x0, left] of [[xl, true], [xr - 2, false]]) {
    if (closed) {
      for (let i = 0; i < 3; i++) {
        p.set(x0 + i, y, PAL.skin[3]);
        p.set(x0 + i, y + 1, lash);
        p.set(x0 + i, y + 2, PAL.skin[left ? 3 : 2]);
      }
      continue;
    }
    for (let i = 0; i < 3; i++) p.set(x0 + i, y, lash);
    const row = left ? [PAL.eyeWhite, iris, iris] : [iris, iris, PAL.eyeWhite];
    row.forEach((c, i) => p.set(x0 + i, y + 1, c));
    p.set(x0 + (left ? 2 : 1), y + 1, irisHi);
    p.set(x0, y + 2, left ? PAL.skin[3] : iris);
    p.set(x0 + 1, y + 2, iris);
    p.set(x0 + 2, y + 2, left ? iris : PAL.skin[2]);
  }
}

// Nariz visto de frente, com a luz batendo pela esquerda.
function paintNose(p, x, y) {
  for (const [dx, dy, k] of [[0, 0, 4], [0, 1, 5], [1, 1, 3], [2, 1, 2], [2, 2, 1], [-1, 3, 2], [0, 3, 3], [1, 3, 2], [2, 3, 1], [0, 4, 2], [1, 4, 2]]) {
    p.set(x + dx, y + dy, PAL.skin[k]);
  }
}

// Pixels dourados de uma peça (coroa, cetro, galhos): o brilho corre por eles.
function goldPixels(p, r, x0, y0, x1, y1) {
  const list = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = r.indexOf(p.get(x, y));
      if (k >= 0) list.push(x, y, k);
    }
  }
  return Int16Array.from(list);
}

// Faixa de brilho na diagonal passando pelos pixels dourados; s é a posição.
function sweepGlint(f, list, r, s, width = 1.8) {
  const top = r.length - 1;
  for (let i = 0; i < list.length; i += 3) {
    const d = Math.abs(list[i] * 0.8 + list[i + 1] * 0.6 - s);
    if (d < width) f.set(list[i], list[i + 1], r[Math.min(top, list[i + 2] + (d < width * 0.45 ? 2 : 1))]);
  }
}

// Estrelinha de brilho que cresce e some (e de 0 a 1); diag vira o x.
function sparkle(f, x, y, e, diag = false) {
  if (e <= 0.08) return;
  const arm = Math.round(e * 2.2);
  f.set(x, y, WHITE);
  for (let k = 1; k <= arm; k++) {
    const c = k === arm ? PAL.gold[5] : WHITE;
    if (diag) { f.set(x + k, y + k, c); f.set(x - k, y - k, c); f.set(x + k, y - k, c); f.set(x - k, y + k, c); }
    else { f.set(x + k, y, c); f.set(x - k, y, c); f.set(x, y + k, c); f.set(x, y - k, c); }
  }
}

// Envelope suave de um evento periódico: 0 fora da janela, sobe e desce dentro dela.
function pulse(t, period, offset, length) {
  const ph = (((t + offset) % period) + period) % period;
  return ph < length ? Math.sin((ph / length) * Math.PI) : 0;
}

// Estandarte pendurado: guarda rampa e valor de cada pixel; a cada quadro as linhas
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

const OUT_RAMP = [PAL.out];

// Parede de blocos de pedra; light(x, y) diz quanto cada ponto recebe de luz.
function paintWall(p, r, bw, bh, light, seed) {
  for (let y = 0; y < 64; y++) {
    const row = Math.floor(y / bh), off = (row % 2) * (bw >> 1);
    for (let x = 0; x < 64; x++) {
      const mortar = y % bh === bh - 1 || (x + off) % bw === 0;
      let v = light(x, y) + (hash(Math.floor((x + off) / bw), row, seed) - 0.5) * 0.12;
      if (mortar) v -= 0.13;
      else if (y % bh === 0) v += 0.05;
      p.d[y * 64 + x] = pick(r, v, x, y, 2);
    }
  }
}

// ---------------------------------------------------------------------------
// Duque

const DUKE_HEAD = headTest(32, 34, 10.4, 12.2, 0.32);
const DUKE_GLASS = archTest(10, 4.6, 5, 47);
const dukeHills = (x) => 39 + Math.round(1.5 * Math.sin(x * 0.9 + 1));
const dukeLead = (x, y) => (x + y) % 4 === 0 || (x - y + 64) % 4 === 0;
// Vidro com céu aberto, onde as nuvens podem passar (fora do chumbo e da cruzeta).
const dukeSky = (x, y) => DUKE_GLASS(x + 0.5, y + 0.5) && y < dukeHills(x) && !dukeLead(x, y) && x !== 10 && y !== 25 && y !== 26;

function buildDukeBackdrop() {
  const p = new Pix(64, 64);
  // parede do salão, mais clara perto da janela e no facho de luz que entra por ela
  paintWall(p, HALL, 9, 5, (x, y) => {
    let v = 0.36 - x * 0.003 - y * 0.003 + clamp01(1 - Math.hypot(x - 10, y - 26) / 30) * 0.22;
    const back = y - (x - 10) * 0.7;
    if (x > 16 && back > 6 && back < 44) v += 0.14 * (1 - (x - 16) / 40) * Math.min(1, (back - 6) / 6, (44 - back) / 6);
    return v;
  }, 4);
  // janela alta em arco: moldura de pedra, céu, morros e vidro em losangos
  p.fill(2, 3, 18, 50, archTest(10, 6.5, 3, 50), (x, y) => pick(PAL.stone, (x < 10 ? 0.7 : 0.38) - (y - 3) * 0.004, x, y));
  p.fill(4, 5, 16, 47, DUKE_GLASS, (x, y) => {
    const hills = dukeHills(x);
    const lead = dukeLead(x, y);
    if (y >= 44) return pick(PAL.grass, 0.45 + (hash(x, y, 2) - 0.5) * 0.3 - (lead ? 0.2 : 0), x, y);
    if (y >= hills) return pick(PAL.far, 0.75 - (y - hills) * 0.08 - (lead ? 0.25 : 0), x, y);
    return pick(PAL.morning, 0.2 + (y - 5) / 38 - (lead ? 0.3 : 0), x, y, 1.5);
  });
  for (let y = 5; y < 48; y++) if (DUKE_GLASS(10.5, y + 0.5)) p.set(10, y, PAL.stone[y < 25 ? 3 : 2]);
  p.rect(4, 25, 13, 1, PAL.stone[3]);
  p.rect(4, 26, 13, 1, PAL.stone[1]);
  p.rect(1, 50, 19, 2, (x, y) => PAL.stone[y === 50 ? 4 : 1]);
  // vara do estandarte
  p.rect(44, 3, 18, 1, PAL.wood[3]);
  p.rect(44, 4, 18, 1, PAL.wood[1]);
  p.sphere(44, 3.5, 1.4, 1.4, PAL.gold, 0.1);
  p.sphere(62, 3.5, 1.4, 1.4, PAL.gold, 0.1);
  return p;
}

function buildDukeBanner() {
  const w = 13, h = 34;
  return makeBanner(w, h, (put) => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const notch = j > h - 6 && Math.abs(i - 6) < j - (h - 6);
        if (notch) continue;
        const edge = i === 0 || i === w - 1 || j === h - 1 || (j > h - 6 && Math.abs(i - 6) < j - (h - 7));
        if (edge) { put(i, j, OUT_RAMP, 0); continue; }
        const trim = i === 1 || i === w - 2 || j === 1 || j === h - 2 || (j > h - 7 && Math.abs(i - 6) < j - (h - 8));
        if (trim) put(i, j, PAL.gold, 0.62);
        else put(i, j, ROYAL, 0.55 - (i - 6) * 0.02 - j * 0.006);
      }
    }
    // torre dourada do brasão
    const tower = ['x.x.x', 'xxxxx', 'xxxxx', '.xxx.', '.x.x.', '.x.x.', '.xxx.', '.xxx.'];
    tower.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === 'x') put(4 + i, 10 + j, PAL.gold, 0.85 - j * 0.04 - i * 0.03);
    }));
    put(6, 14, ROYAL, 0.1);
    put(6, 15, ROYAL, 0.1);
  });
}

// Folhas de morango da coroa ducal: a do meio de frente, as outras viradas.
const LEAF_BIG = ['...x...', '..xxx..', '..xxx..', 'x.xxx.x', 'xxxxxxx', '.xxxxx.', '..xxx..'];
const LEAF_MID = ['..x..', 'x.x.x', 'xxxxx', 'xxxxx', '.xxx.', '..x..'];
const LEAF_SIDE = ['.x.', 'xxx', 'xxx', '.x.'];

function paintBitmap(p, rows, x0, y0, color) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== '.') p.set(x0 + i, y0 + j, color(i, j, ch, rows[0].length, rows.length));
  }));
}

function buildDukeCrown() {
  const p = new Pix(64, 64);
  const cx = 32;
  const bandTop = (x) => 18.2 + 1.6 * (1 - ((x - cx) / 13) ** 2);
  const leafColor = (i, j, ch, w, h) => {
    const v = 0.3 + sphereLight((i + 0.5 - w / 2) / (w / 2), (j + 0.5 - h * 0.45) / (h / 2)) * 0.8;
    return PAL.gold[Math.max(1, Math.min(5, Math.round(v * 5)))];
  };
  for (const [rows, lx] of [[LEAF_SIDE, 20], [LEAF_SIDE, 44], [LEAF_MID, 25], [LEAF_MID, 39], [LEAF_BIG, 32]]) {
    const w = rows[0].length, h = rows.length;
    paintBitmap(p, rows, lx - (w >> 1), Math.round(bandTop(lx)) - h + 1, leafColor);
  }
  // aro
  p.fill(19, 16, 45, 24, (x, y) => Math.abs(x - cx) <= 13 && y >= bandTop(x) && y <= bandTop(x) + 3.6, (x, y) => {
    const ry = y - bandTop(x + 0.5);
    let v = 0.12 + cylLight((x + 0.5 - cx) / 13) * 0.85;
    if (ry < 0.8) v += 0.25;
    else if (ry > 2.6) v -= 0.25;
    return pick(PAL.gold, v, x, y);
  });
  // pedras do aro
  for (const [gx, r] of [[24, SAPPHIRE], [31, RUBY], [39, SAPPHIRE]]) {
    const gy = Math.round(bandTop(gx + 0.5) + 1);
    p.set(gx, gy, r[3]); p.set(gx + 1, gy, r[2]);
    p.set(gx, gy + 1, r[2]); p.set(gx + 1, gy + 1, r[1]);
    if (r === RUBY) { p.set(gx + 2, gy, r[2]); p.set(gx + 2, gy + 1, r[1]); p.set(gx, gy, r[4]); }
  }
  p.outline(PAL.out);
  return p;
}

function buildDuke() {
  const p = new Pix(64, 64);
  const cx = 32;
  const mirror = (pts) => pts.map(([x, y]) => [64 - x, y]);

  // manto de veludo vermelho
  p.poly([[1, 64], [3, 56], [9, 51], [19, 47.5], [45, 47.5], [55, 51], [61, 56], [63, 64]], (x, y) => {
    let v = 0.62 - ((x + 0.5 - cx) / 30) * 0.42 - (y - 52) * 0.01;
    if (x === 9 || x === 17 || x === 47 || x === 55) v -= 0.22; // dobras
    if (x === 10 || x === 18) v += 0.12;
    return pick(VELVET, v, x, y);
  });
  // gibão azul no peito, com botões de ouro
  p.poly([[25, 64], [28, 48], [36, 48], [39, 64]], (x, y) => pick(ROYAL, 0.62 - (x - 28) * 0.05, x, y));
  for (const y of [53, 56, 59, 62]) { p.set(32, y, PAL.gold[4]); p.set(32, y + 1, PAL.gold[2]); }
  // capa curta de arminho sobre os ombros
  const capeL = [[2.5, 57], [5, 53.5], [10, 50.5], [19, 47.5], [26.5, 46.5], [31, 49.5], [29.5, 54], [27.5, 58.5], [17, 59.5], [8, 59], [2.5, 58.5]];
  const capeShade = (x, y) => {
    const nx = (x + 0.5 - cx) / 30;
    const v = 0.82 - nx * 0.38 - Math.max(0, y - 56.5) * 0.14 - Math.max(0, 50 - y) * 0.03;
    return ermine(x, y, v);
  };
  p.poly(capeL, capeShade);
  p.poly(mirror(capeL), capeShade);
  for (let x = 4; x < 61; x++) if (p.get(x, 59) && p.get(x, 60) !== p.get(x, 59)) p.set(x, 59, ERMINE[1]);

  // cabelo loiro escuro caindo até os ombros
  const hairW = (y) => (y < 31 ? 14.4 * Math.sqrt(Math.max(0, 1 - ((y - 31) / 16) ** 2)) : 14.4 - (y - 31) * 0.06 + Math.sin(y * 0.9) * 0.5);
  const hairBack = (x, y) => y > 15 && y < 48.6 + Math.sin(x * 1.3) * 0.8 && Math.abs(x - cx) <= hairW(y);
  const hairShade = (x, y) => {
    const l = sphereLight((x + 0.5 - cx) / 14.4, (y + 0.5 - 27) / 17);
    // mechas: faixas de largura irregular que abrem para os lados ao descer
    const sx = x + (x - cx) * (y - 24) * 0.014 + Math.sin(y * 0.45 + x) * 0.6;
    let v = 0.16 + l * 0.82 + (hash(Math.floor(sx / 2), 0, 9) - 0.5) * 0.3 + (hash(x, y, 7) - 0.5) * 0.08;
    if (Math.floor(sx) % 4 === 0) v -= 0.1;
    if (y > 45) v -= (y - 45) * 0.06;
    return pick(BLOND, v, x, y, 2);
  };
  p.fill(16, 14, 48, 50, hairBack, hairShade);
  // pontas viradas para fora
  for (const [x, y, k] of [[17, 48, 3], [16, 48, 2], [16, 47, 3], [18, 49, 1], [47, 48, 2], [48, 48, 1], [48, 47, 2], [46, 49, 1]]) p.set(x, y, BLOND[k]);

  // pescoço, com a sombra do queixo
  p.rect(27, 41, 10, 8, (x, y) => pick(PAL.skin, (y < 46 ? 0.2 : 0.42) - (x - 31) * 0.03, x, y));

  // rosto
  p.fill(20, 21, 44, 47, DUKE_HEAD, (x, y) => {
    let v = 0.4 + sphereLight((x + 0.5 - 31) / 10.4, (y + 0.5 - 32) / 12.2) * 0.75;
    if (y < 27) v -= 0.18; // sombra da franja
    return pick(PAL.skin, v, x, y, 4);
  });
  // franja de lado e mechas cobrindo as orelhas
  const fringe = (x, y) => DUKE_HEAD(x, y) && (y < 24.8 + 1.4 * Math.sin((x - 21) * 0.5) + (x < 30 ? (30 - x) * 0.12 : 0) ||
    (Math.abs(x - cx) > (y < 31 ? 7.8 : 8.8 + (y - 31) * 0.06) && y < 42));
  p.fill(20, 20, 44, 43, fringe, hairShade);
  // sombra que a franja faz na testa
  for (let x = 23; x <= 41; x++) {
    for (let y = 22; y < 30; y++) {
      if (!fringe(x + 0.5, y + 0.5) && fringe(x + 0.5, y - 0.5) && DUKE_HEAD(x + 0.5, y + 0.5)) { p.set(x, y, PAL.skin[2]); break; }
    }
  }

  // sobrancelhas
  for (const [x, y] of [[26, 30], [27, 29], [28, 29], [29, 29]]) {
    p.set(x, y, BLOND[1]);
    p.set(63 - x, y, BLOND[1]);
  }
  paintEyes(p, 31, 26, 38, BLOND[0], EYE_BLUE, EYE_BLUE_HI, false);
  paintNose(p, 31, 34);
  // boca com um meio sorriso
  for (let x = 29; x <= 34; x++) p.set(x, 41, x === 29 || x === 34 ? PAL.skin[2] : PAL.skin[1]);
  p.set(35, 40, PAL.skin[2]);
  for (const x of [30, 31, 32, 33]) p.set(x, 42, PAL.lip);
  p.set(31, 42, C('#c06a58'));
  // queixo e bochechas
  p.set(31, 45, PAL.skin[3]);
  p.set(32, 45, PAL.skin[2]);
  for (let y = 37; y <= 38; y++) {
    for (let x = 25; x <= 27; x++) {
      if (bayer(x, y) < 0.5) { p.set(x, y, PAL.blush); p.set(63 - x, y, PAL.blush); }
    }
  }
  // gola: broche de ouro com um rubi
  p.sphere(32, 50, 2.4, 2, PAL.gold, 0.1);
  p.set(32, 50, RUBY[2]);
  p.set(31, 49, RUBY[4]);
  p.set(32, 49, RUBY[3]);

  p.outline(PAL.out);
  p.blit(buildDukeCrown(), 0, 0);
  return p;
}

const dukeArt = { bg: null, body: null, banner: null, gold: null, sky: null, clouds: null, frame: new Pix(64, 64) };

function paintDukePortrait(ctx, t, info) {
  const a = dukeArt;
  if (!a.bg) {
    a.bg = buildDukeBackdrop();
    a.body = buildDuke();
    a.banner = buildDukeBanner();
    a.gold = goldPixels(a.body, PAL.gold, 17, 10, 47, 26);
    a.sky = new Uint8Array(64 * 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 20; x++) a.sky[y * 64 + x] = dukeSky(x, y) ? 1 : 0;
    a.clouds = [makeCloud(11, 6, 5), makeCloud(8, 5, 9)];
  }
  const f = a.frame.copyFrom(a.bg);
  // nuvens passando pela janela, atrás do chumbo dos vidros
  a.clouds.forEach((c, k) => {
    const ox = Math.floor(((t * (0.9 - k * 0.3) + k * 13) % 30) - 11), oy = k ? 30 : 10;
    for (let j = 0; j < c.h; j++) {
      for (let i = 0; i < c.w; i++) {
        const v = c.d[j * c.w + i], x = ox + i, y = oy + j;
        if (v && x >= 0 && x < 20 && a.sky[y * 64 + x]) f.d[y * 64 + x] = v;
      }
    }
  });
  drawBanner(f, a.banner, 48, 5, t, info.working ? 1.6 : 0.9);
  // poeira flutuando devagar no facho de luz da janela
  for (let k = 0; k < 10; k++) {
    const u = (t * (0.025 + hash(k, 1, 6) * 0.03) + hash(k, 2, 6)) % 1;
    const x = 18 + u * 26 + Math.sin(t * 0.7 + k * 2) * 1.5;
    const y = 10 + hash(k, 3, 6) * 30 + Math.sin(t * 0.9 + k) * 1.5 + (x - 10) * 0.7;
    if (u > 0.04 && u < 0.92) f.set(x, y, u < 0.5 && k % 3 === 0 ? PAL.haze : DUST);
  }
  f.blit(a.body, 0, 0);
  if (t % 4.6 > 4.45 || t % 11.3 > 11.15) paintEyes(f, 31, 26, 38, BLOND[0], EYE_BLUE, EYE_BLUE_HI, true);
  // brilho passando pela coroa
  const period = info.working ? 2.6 : 4.2;
  sweepGlint(f, a.gold, PAL.gold, ((t % period) / 1.4) * 34 + 18);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Rei

const KING_HEAD = headTest(32, 33, 10.6, 12.2, 0.3);
const KING_CANDLES = [[5, 31], [9, 28], [13, 31], [56, 32], [60, 30]];
const KING_GEMS = [[21, 19], [26, 20], [32, 20], [38, 20], [43, 19], [32, 13], [26, 15], [38, 15]];

// Vela acesa: chama que tremula e um halo pontilhado que pulsa junto. (x, y) é o pavio.
function paintCandle(f, x, y, t, seed, strong) {
  const fl = 0.5 * Math.sin(t * 9.3 + seed * 1.7) + 0.3 * Math.sin(t * 15.1 + seed * 4.1) + 0.2 * Math.sin(t * 3.7 + seed);
  const R = 2.8 + fl * 0.5 + (strong ? 0.7 : 0);
  for (let yy = Math.floor(y - 2 - R); yy <= y - 2 + R; yy++) {
    for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
      const d = Math.hypot(xx - x, (yy - y + 2) * 0.9) / R;
      if (d < 1 && bayer(xx, yy) < (1 - d) * 0.42) f.set(xx, yy, CANDLE_GLOW[d < 0.5 ? 1 : 0]);
    }
  }
  const lean = Math.sin(t * 2.3 + seed * 3) * 0.7 + fl * 0.4;
  const h = fl > 0.2 ? 4 : 3;
  for (let k = 1; k <= h; k++) {
    const c = PAL.fire[k === 1 ? 5 : k === h ? 3 : 4];
    f.set(x + Math.round(lean * ((k - 1) / h) * 1.6), y - k, c);
  }
  f.set(x + (lean > 0 ? 1 : -1), y - 1, PAL.fire[3]);
  f.set(x, y, PAL.out);
}

function buildKingBackdrop() {
  const p = new Pix(64, 64);
  const warm = (x, y) => KING_CANDLES.reduce((s, [cx, cy]) => s + clamp01(1 - Math.hypot(x - cx, y - cy + 3) / 15) * 0.16, 0);
  paintWall(p, HALL, 8, 4, (x, y) => 0.3 - y * 0.002 + warm(x, y), 6);
  // nicho escuro em arco atrás do rei, com moldura de pedra
  p.fill(14, 0, 50, 64, archTest(32, 17, 1, 64), (x, y) => pick(HALL, 0.62 - (x - 15) * 0.012, x, y));
  p.fill(16, 2, 48, 64, archTest(32, 15, 3, 64), (x, y) => pick(HALL, 0.06 + clamp01(1 - Math.hypot(x - 32, y - 26) / 22) * 0.16, x, y, 1.6));
  for (let a = 0.15; a < Math.PI; a += 0.3) {
    const x = 32 - Math.cos(a) * 16.2, y = 18 - Math.sin(a) * 16.2;
    p.set(x, y, HALL[2]);
  }
  // colunas de pedra com caneluras
  for (const cx of [2, 61]) {
    p.fill(cx - 4, 0, cx + 4, 63, (x) => Math.abs(x - cx - 0.5) <= 3.6, (x, y) =>
      pick(COLUMN, 0.08 + cylLight((x + 0.5 - cx - 0.5) / 3.6) * 0.6 - (x % 2 ? 0.08 : 0) + warm(x, y) * 1.2 - y * 0.003, x, y));
    p.rect(cx - 4, 5, 10, 3, (x, y) => pick(COLUMN, (y === 5 ? 0.75 : 0.4) - (x - cx) * 0.04, x, y));
    p.rect(cx - 4, 8, 10, 1, COLUMN[0]);
  }
  // estandartes vermelhos com uma coroa dourada
  for (const bx of [6, 50]) {
    p.rect(bx - 1, 0, 11, 1, PAL.wood[2]);
    for (let j = 1; j < 28; j++) {
      for (let i = 0; i < 9; i++) {
        if (j > 23 && Math.abs(i - 4) > 27 - j) continue; // ponta
        const edge = i === 0 || i === 8 || (j > 23 && Math.abs(i - 4) === 27 - j);
        const trim = i === 1 || i === 7 || (j > 22 && Math.abs(i - 4) === 26 - j);
        const fold = Math.sin(i * 1.1 + bx) * 0.12;
        p.set(bx + i, j, edge ? PAL.out : trim ? PAL.gold[3] : pick(VELVET, 0.5 + fold - j * 0.01 + warm(bx + i, j) * 0.5, i, j));
      }
    }
    paintBitmap(p, ['x.x.x', 'xxxxx', 'xxxxx'], bx + 2, 9, (i, j) => PAL.gold[j === 0 ? 5 : 4 - j]);
    p.set(bx + 4, 10, RUBY[2]);
  }
  // candelabro de ouro com três velas
  const cx = 9;
  p.rect(cx, 34, 2, 24, (x, y) => PAL.gold[y % 6 === 5 ? 4 : x === cx ? 3 : 1]);
  p.rect(cx - 4, 39, 10, 1, (x) => PAL.gold[x < cx + 1 ? 4 : 3]);
  p.rect(cx - 4, 40, 10, 1, PAL.gold[1]);
  for (const x of [cx - 4, cx + 5]) p.rect(x, 37, 1, 2, PAL.gold[2]);
  // arandela presa na coluna da direita
  p.rect(55, 38, 8, 1, PAL.gold[3]);
  p.rect(55, 39, 8, 1, PAL.gold[1]);
  p.line(58, 40, 60, 42, PAL.gold[2]);
  p.rect(60, 40, 2, 4, PAL.gold[1]);
  for (const [x, y] of KING_CANDLES) {
    const plate = x === cx ? 33 : x > 40 ? 37 : 36;
    p.rect(x - 1, plate, 4, 1, (xx) => PAL.gold[xx < x + 1 ? 4 : 2]);
    p.rect(x, y + 1, 2, plate - y - 1, (xx, yy) => (xx === x ? WAX[yy === y + 1 ? 3 : 2] : WAX[yy === y + 1 ? 2 : 1]));
  }
  return p;
}

function buildKingCrown() {
  const p = new Pix(64, 64);
  const cx = 32;
  const bandTop = (x) => 16.8 + 1.4 * (1 - ((x - cx) / 13.5) ** 2);
  // pontas com pérolas
  for (const [nx, h, hw] of [[-0.9, 5, 1.8], [0.9, 5, 1.8], [-0.47, 8, 2.6], [0.47, 8, 2.6], [0, 10, 3]]) {
    const px = cx + nx * 13.5, base = bandTop(px) + 0.5, tip = base - h;
    p.fill(px - hw - 1, tip, px + hw + 1, base, (x, y) => Math.abs(x - px) <= hw * ((y - tip) / h) + 0.4, (x, y) =>
      pick(PAL.gold, 0.55 - ((x + 0.5 - px) / hw) * 0.3 + (y < tip + 2 ? 0.1 : 0), x, y));
    p.sphere(px, tip - 0.8, 1.4, 1.4, ERMINE, 0.15);
  }
  // aro com rubis e safiras
  p.fill(18, 15, 46, 23, (x, y) => Math.abs(x - cx) <= 13.5 && y >= bandTop(x) && y <= bandTop(x) + 4.2, (x, y) => {
    const ry = y - bandTop(x + 0.5);
    let v = 0.12 + cylLight((x + 0.5 - cx) / 13.5) * 0.85;
    if (ry < 0.8) v += 0.25;
    else if (ry > 3.2) v -= 0.25;
    return pick(PAL.gold, v, x, y);
  });
  KING_GEMS.forEach(([gx, gy], i) => {
    const r = i % 2 ? SAPPHIRE : RUBY;
    p.set(gx, gy, r[4]); p.set(gx + 1, gy, r[2]);
    p.set(gx, gy + 1, r[2]); p.set(gx + 1, gy + 1, r[1]);
  });
  p.outline(PAL.out);
  return p;
}

function buildScepter() {
  const p = new Pix(64, 64);
  // vara de ouro do cetro, da mão até acima do ombro
  const x0 = 41, y0 = 63, x1 = 48.6, y1 = 35;
  p.line(x0, y0, x1, y1, (x, y) => PAL.gold[(y % 5 === 0) ? 5 : 3]);
  p.line(x0 + 1, y0, x1 + 1, y1, (x, y) => PAL.gold[(y % 5 === 0) ? 3 : 1]);
  // ponteira: anel, globo com rubi e flor de lis
  p.rect(48, 34, 4, 1, PAL.gold[4]);
  p.sphere(49.8, 31, 2.6, 2.6, PAL.gold, 0.05);
  p.set(49, 31, RUBY[3]); p.set(50, 31, RUBY[2]); p.set(49, 32, RUBY[2]); p.set(50, 32, RUBY[1]);
  paintBitmap(p, ['..x..', '.xxx.', 'x.x.x', 'xxxxx'], 48, 24, (i, j) => PAL.gold[j === 0 ? 5 : i < 2 ? 4 : 3]);
  // manga vermelha com punho de arminho e a mão segurando
  p.poly([[45, 64], [45.5, 58.5], [49, 56.5], [54, 58], [55, 64]], (x, y) => pick(VELVET, 0.5 - (x - 45) * 0.04, x, y));
  p.poly([[44, 61], [44.5, 56], [47.5, 54.5], [48.5, 60]], (x, y) => ermine(x, y + 2, 0.75 - (x - 44) * 0.06));
  p.sphere(42.4, 57.2, 2.9, 2.6, PAL.skin, 0.25);
  p.line(40, 56, 44, 56, PAL.skin[2]);
  p.line(40, 58, 44, 58, PAL.skin[2]);
  p.set(41, 57, PAL.gold[4]);
  p.outline(PAL.out);
  return p;
}

function buildKing() {
  const p = new Pix(64, 64);
  const cx = 32;
  const mirror = (pts) => pts.map(([x, y]) => [64 - x, y]);

  // manto de veludo vermelho
  p.poly([[0, 64], [2, 55], [8, 50], [19, 46.5], [45, 46.5], [56, 50], [62, 55], [64, 64]], (x, y) => {
    let v = 0.6 - ((x + 0.5 - cx) / 30) * 0.45 - (y - 52) * 0.01;
    if (x === 6 || x === 13 || x === 51 || x === 58) v -= 0.2; // dobras
    if (x === 7 || x === 14) v += 0.12;
    return pick(VELVET, v, x, y);
  });
  // túnica de brocado dourado
  p.poly([[23, 64], [26, 47], [38, 47], [41, 64]], (x, y) => {
    const motif = (x + y) % 4 === 0 && (x - y + 64) % 4 === 0;
    return pick(PAL.gold, 0.42 - (x - 32) * 0.03 + (motif ? 0.25 : 0) - ((x + y) % 2 ? 0.05 : 0), x, y);
  });
  // gola larga de arminho que desce pela frente do manto
  const collarL = [[3, 56.5], [8, 51.5], [18, 47.5], [27, 46], [29.5, 49], [27.5, 64], [20.5, 64], [21, 57.5], [14, 56.5], [7, 58], [3, 58.5]];
  const collarShade = (x, y) => ermine(x, y, 0.82 - ((x + 0.5 - cx) / 30) * 0.4 - Math.max(0, 52 - y) * 0.03);
  p.poly(collarL, collarShade);
  p.poly(mirror(collarL), collarShade);

  // cabelo castanho atrás
  p.fill(18, 14, 46, 50, (x, y) => ((x - cx) / 13.6) ** 2 + ((y - 31) / 16) ** 2 <= 1 && y < 47, (x, y) => {
    const sx = x + (x - cx) * (y - 24) * 0.012;
    const v = 0.15 + sphereLight((x + 0.5 - cx) / 13.6, (y + 0.5 - 26) / 16) * 0.75 + (hash(Math.floor(sx / 2), 1, 9) - 0.5) * 0.28;
    return pick(KING_HAIR, v, x, y, 2);
  });

  // rosto
  p.fill(20, 20, 44, 46, KING_HEAD, (x, y) => {
    let v = 0.36 + sphereLight((x + 0.5 - 31) / 10.6, (y + 0.5 - 31) / 12.2) * 0.78;
    if (y < 25) v -= 0.18;
    return pick(PAL.skin, v, x, y, 4);
  });
  // cabelo nas têmporas
  p.fill(20, 20, 44, 36, (x, y) => KING_HEAD(x, y) && Math.abs(x - cx) > 8.6 - Math.max(0, 24 - y) * 0.8 && y < 35, (x, y) =>
    pick(KING_HAIR, 0.5 - (x - cx) * 0.03 + (hash(x, y, 4) - 0.5) * 0.2, x, y));

  // barba cheia descendo pelo peito
  const inBeard = (x, y) => {
    if (y < 31.5) return false;
    if (KING_HEAD(x, y) && (y > 38.5 || Math.abs(x - cx) > 8.4 - (y - 31.5) * 0.12)) return true;
    const w = 11 - Math.max(0, y - 45) * 0.62;
    return y > 38 && y < 56 && Math.abs(x - cx) <= w;
  };
  p.fill(18, 31, 46, 56, inBeard, (x, y) => {
    const l = sphereLight((x + 0.5 - 30) / 12, (y + 0.5 - 38) / 14);
    // mechas onduladas que descem e se juntam no meio
    const sx = x + Math.sin(y * 0.55) * 1.2 - (x - cx) * (y - 40) * 0.03;
    let v = 0.3 + l * 0.62 + (hash(Math.floor(sx / 2), 2, 6) - 0.5) * 0.26;
    if (Math.floor(sx) % 3 === 0) v -= 0.14;
    if (y > 51) v -= (y - 51) * 0.07;
    return pick(KING_HAIR, v, x, y, 3);
  });
  // fios grisalhos
  for (const [x, y] of [[24, 42], [25, 43], [38, 44], [39, 45], [29, 49], [29, 50], [35, 50], [22, 38]]) p.set(x, y, C('#9a8a78'));
  // bigode e boca
  for (let x = 27; x <= 37; x++) p.set(x, 38, KING_HAIR[x < 32 ? 3 : 2]);
  for (let x = 26; x <= 38; x++) p.set(x, 39, KING_HAIR[x < 30 ? 3 : x < 35 ? 2 : 1]);
  for (let x = 30; x <= 34; x++) p.set(x, 40, PAL.skin[0]);
  for (let x = 30; x <= 33; x++) p.set(x, 41, PAL.lip);
  // sobrancelhas grossas
  for (const [x, y] of [[25, 28], [26, 27], [27, 27], [28, 27], [29, 27], [26, 28]]) {
    p.set(x, y, KING_HAIR[1]);
    p.set(63 - x, y, KING_HAIR[1]);
  }
  paintEyes(p, 29, 26, 38, KING_HAIR[0], PAL.iris, PAL.irisHi, false);
  paintNose(p, 31, 32);
  for (const [x, y] of [[25, 35], [26, 35], [38, 35], [37, 35]]) if (bayer(x, y) < 0.5) p.set(x, y, PAL.blush);

  p.outline(PAL.out);
  p.blit(buildKingCrown(), 0, 0);
  p.blit(buildScepter(), 0, 0);
  return p;
}

const kingArt = { bg: null, body: null, gold: null, frame: new Pix(64, 64) };

function paintKingPortrait(ctx, t, info) {
  const a = kingArt;
  if (!a.bg) {
    a.bg = buildKingBackdrop();
    a.body = buildKing();
    a.gold = goldPixels(a.body, PAL.gold, 17, 5, 47, 24);
  }
  const f = a.frame.copyFrom(a.bg);
  KING_CANDLES.forEach(([x, y], i) => paintCandle(f, x, y, t, i, info.working));
  f.blit(a.body, 0, 0);
  if (t % 5.3 > 5.15 || t % 12.1 > 11.96) paintEyes(f, 29, 26, 38, KING_HAIR[0], PAL.iris, PAL.irisHi, true);
  // brilho correndo pelas joias, uma a uma, e depois pelo ouro
  const period = info.working ? 3 : 5;
  const ph = t % period;
  for (let i = 0; i < 5; i++) {
    const [gx, gy] = KING_GEMS[i];
    sparkle(f, gx, gy, pulse(ph, 99, -i * 0.22, 0.5));
  }
  sweepGlint(f, a.gold, PAL.gold, (ph - 1.2) * 30 + 22);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Imperador

const EMP_HEAD = headTest(32, 34, 9.5, 12.3, 0.2);
// Águia de asas abertas, cabeça virada para a esquerda.
const EAGLE = [
  '......xx.......',
  '.....xxxx......',
  '....xxxxx......',
  'x.....xxx.....x',
  'xx...xxxxx...xx',
  'xxx.xxxxxxx.xxx',
  'xxxxxxxxxxxxxxx',
  '.xxxxxxxxxxxxx.',
  '..xx.xxxxx.xx..',
  '....x.xxx.x....',
  '...xx.xxx.xx...',
  '.....xxxxx.....',
  '....x.x.x.x....',
];

function buildEmperorBackdrop() {
  const p = new Pix(64, 64);
  // parede de mármore escuro em painéis, com veios
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const vein = Math.abs(Math.sin(x * 0.21 + y * 0.13 + Math.sin(y * 0.3 + x * 0.05) * 2.2));
      let v = 0.42 - y * 0.003 + clamp01(1 - Math.hypot(x - 8, y - 10) / 40) * 0.15 - (vein < 0.06 ? 0.14 : 0);
      if (x % 21 === 20 || y % 26 === 25) v -= 0.18; // juntas das placas
      p.d[y * 64 + x] = pick(DARK_MARBLE, v, x, y, 2.4);
    }
  }
  // friso dourado no alto
  p.rect(0, 1, 64, 1, PAL.gold[3]);
  p.rect(0, 2, 64, 1, PAL.gold[1]);
  // coluna de mármore claro com caneluras
  const cx = 56;
  p.fill(48, 0, 63, 63, (x) => Math.abs(x - cx) <= 5.6, (x, y) => {
    const nx = (x + 0.5 - cx) / 5.6;
    const vein = Math.abs(Math.sin(x * 0.7 + y * 0.18 + Math.sin(y * 0.21) * 2)) < 0.08;
    let v = 0.12 + cylLight(nx) * 0.8 - ((x - cx + 64) % 3 === 0 ? 0.12 : 0) - (vein ? 0.12 : 0);
    return pick(MARBLE, v, x, y);
  });
  p.rect(48, 8, 17, 3, (x, y) => pick(MARBLE, (y === 8 ? 0.85 : 0.5) - (x - 48) * 0.02, x, y));
  p.rect(49, 5, 15, 3, (x, y) => pick(MARBLE, (y === 5 ? 0.75 : 0.45) - (x - 49) * 0.02, x, y));
  p.rect(48, 11, 17, 1, MARBLE[0]);
  p.rect(48, 4, 17, 1, MARBLE[0]);
  // sombra da coluna na parede
  for (let y = 12; y < 64; y++) p.set(49, y, DARK_MARBLE[0]);
  // vara do estandarte
  p.rect(0, 4, 19, 1, PAL.gold[4]);
  p.rect(0, 5, 19, 1, PAL.gold[1]);
  p.sphere(19, 4.5, 1.4, 1.4, PAL.gold, 0.1);
  return p;
}

function buildEmperorBanner() {
  const w = 17, h = 38;
  return makeBanner(w, h, (put) => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const tip = j - (h - 9);
        if (tip > 0 && Math.abs(i - 8) > 8 - tip) continue; // ponta em V
        const edge = i === 0 || i === w - 1 || (tip > 0 && Math.abs(i - 8) >= 8 - tip);
        if (edge) { put(i, j, OUT_RAMP, 0); continue; }
        const trim = i === 1 || i === w - 2 || j === 1 || (tip > -1 && Math.abs(i - 8) >= 7 - tip);
        if (trim) put(i, j, PAL.gold, 0.6);
        else put(i, j, PURPLE, 0.55 - (i - 8) * 0.02 - j * 0.005);
      }
    }
    // águia dourada
    EAGLE.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== 'x') return;
      let v = 0.8 - j * 0.025 - (i - 7) * 0.03;
      if (j === 7 && i % 2 === 0) v -= 0.3; // penas
      if (j === 5 && (i === 2 || i === 12)) v -= 0.3;
      put(1 + i, 8 + j, PAL.gold, v);
    }));
    put(7, 9, PURPLE, 0.05); // olho
    put(5, 10, RUBY, 0.5); // bico
  });
}

function buildEmperorCrown() {
  const p = new Pix(64, 64);
  const cx = 32;
  const bandTop = (x) => 17.6 + 1.3 * (1 - ((x - cx) / 12.6) ** 2);
  // barrete de veludo roxo dentro dos arcos
  const dome = (x, y) => ((x - cx) / 11.6) ** 2 + ((y - 19) / 11) ** 2 <= 1 && y < 19;
  p.fill(19, 7, 45, 19, dome, (x, y) => pick(PURPLE, 0.15 + sphereLight((x + 0.5 - cx) / 11.6, (y + 0.5 - 15) / 11) * 0.9, x, y));
  // arcos de ouro: a borda do domo, o arco do meio e dois arcos em curva
  const rim = (x, y) => dome(x, y) && !(((x - cx) / 10) ** 2 + ((y - 19.5) / 9.4) ** 2 <= 1);
  const meridian = (x, y) => dome(x, y) && Math.abs(x - cx) <= 1.6;
  const sides = (x, y) => dome(x, y) && [-1, 1].some((sx) => Math.abs(x - cx - sx * 6.8 * Math.sqrt(clamp01(1 - ((19 - y) / 11) ** 2))) <= 0.9);
  p.fill(19, 7, 45, 19, (x, y) => rim(x, y) || meridian(x, y) || sides(x, y), (x, y) =>
    pick(PAL.gold, 0.25 + sphereLight((x + 0.5 - cx) / 11.6, (y + 0.5 - 15) / 11) * 0.85, x, y));
  // pérolas pelo arco do meio
  for (const y of [10, 13, 16]) p.set(cx, y, ERMINE[4]);
  // aro com esmeraldas, safiras e rubi
  p.fill(18, 16, 46, 24, (x, y) => Math.abs(x - cx) <= 12.6 && y >= bandTop(x) && y <= bandTop(x) + 4.2, (x, y) => {
    const ry = y - bandTop(x + 0.5);
    let v = 0.12 + cylLight((x + 0.5 - cx) / 12.6) * 0.85;
    if (ry < 0.8) v += 0.25;
    else if (ry > 3.2) v -= 0.25;
    return pick(PAL.gold, v, x, y);
  });
  for (const [gx, r] of [[22, EMERALD], [27, SAPPHIRE], [31, RUBY], [36, SAPPHIRE], [41, EMERALD]]) {
    const gy = Math.round(bandTop(gx + 0.5) + 1.3);
    p.set(gx, gy, r[4]); p.set(gx + 1, gy, r[2]);
    p.set(gx, gy + 1, r[2]); p.set(gx + 1, gy + 1, r[1]);
    if (r === RUBY) { p.set(gx + 2, gy, r[2]); p.set(gx + 2, gy + 1, r[1]); }
  }
  // orbe no topo, sem cruz
  p.rect(31, 7, 2, 2, PAL.gold[2]);
  p.sphere(32, 4.4, 2.8, 2.8, PAL.gold, 0.1);
  p.rect(30, 5, 5, 1, (x) => PAL.gold[x < 32 ? 3 : 1]);
  p.set(31, 3, PAL.gold[5]);
  p.outline(PAL.out);
  return p;
}

function buildEmperorChain() {
  const p = new Pix(64, 64);
  const cx = 32;
  // elos grandes alternando de lado e de frente, caindo em curva pelo peito
  const chainY = (x) => 48.5 + 8 * (1 - ((x - cx) / 15.5) ** 2);
  for (let k = 0; k <= 10; k++) {
    const x = 17 + k * 3, y = chainY(x);
    if (k % 2) {
      p.ellipse(x, y, 1.7, 1.1, (xx, yy) => PAL.gold[yy + 0.5 < y ? 5 : 3]);
    } else {
      p.ellipse(x, y, 1.2, 1.8, (xx, yy) => PAL.gold[xx + 0.5 < x ? 4 : 2]);
      p.set(x, y, PAL.gold[0]);
    }
  }
  // medalhão com um rubi
  p.rect(31, 56, 2, 2, PAL.gold[2]);
  p.sphere(32, 60, 3.6, 3.4, PAL.gold, 0.05);
  p.sphere(32, 60, 1.7, 1.6, RUBY, 0.15);
  p.outline(PAL.out);
  return p;
}

function buildEmperor() {
  const p = new Pix(64, 64);
  const cx = 32;
  // manto roxo com bordado de ouro em losangos
  p.poly([[0, 64], [1, 56], [7, 51], [18, 47.5], [46, 47.5], [57, 51], [63, 56], [64, 64]], (x, y) => {
    const row = Math.floor(y / 6), gx = (x + (row % 2) * 4) % 8, gy = y % 6;
    let v = 0.6 - ((x + 0.5 - cx) / 30) * 0.45 - (y - 52) * 0.01;
    if (x === 8 || x === 55) v -= 0.18; // dobras
    if (gx === 4 && gy === 3) return PAL.gold[v > 0.45 ? 4 : 3];
    if (Math.abs(gx - 4) + Math.abs(gy - 3) === 2 && gx !== 4) return PAL.gold[v > 0.45 ? 2 : 1];
    return pick(PURPLE, v, x, y);
  });
  // túnica de seda clara com barras douradas na abertura do manto
  p.poly([[23, 64], [25.5, 48], [38.5, 48], [41, 64]], (x, y) => pick(PAL.linen, 0.75 - (x - 25) * 0.025, x, y));
  for (const sx of [-1, 1]) {
    p.fill(18, 47, 46, 64, (x, y) => y > 47.5 && Math.abs(x - cx - sx * (6.5 + (y - 48) * 0.16)) <= 1.6, (x, y) =>
      pick(PAL.gold, 0.55 - sx * 0.2 + ((x + y) % 3 === 0 ? 0.15 : -0.05), x, y));
  }
  // pescoço e gola alta de veludo com borda de ouro
  p.rect(27, 41, 10, 7, (x, y) => pick(PAL.skin, 0.22 - (x - 31) * 0.03, x, y));
  p.fill(25, 45, 39, 49, (x, y) => Math.abs(x - cx) <= 6.5 + (y - 45) * 0.4, (x, y) =>
    y === 45 ? PAL.gold[x < cx ? 4 : 3] : pick(PURPLE, 0.2 + cylLight((x + 0.5 - cx) / 8) * 0.6, x, y));
  // orelhas
  p.sphere(22.4, 34.5, 2, 3, PAL.skin, 0.1);
  p.sphere(41.6, 34.5, 2, 3, PAL.skin, -0.15);
  p.set(22, 35, PAL.skin[1]);
  p.set(41, 35, PAL.skin[1]);

  // rosto magro, maçãs marcadas
  p.fill(20, 21, 44, 47, EMP_HEAD, (x, y) => {
    const nx = (x + 0.5 - 31) / 9.5, ny = (y + 0.5 - 32) / 12.3;
    let v = 0.36 + sphereLight(nx, ny) * 0.76;
    if (y < 25) v -= 0.16;
    if (y > 36 && y < 40 && Math.abs(nx + 0.05) > 0.62) v -= 0.1; // bochecha funda
    return pick(PAL.skin, v, x, y, 4);
  });
  // cabelo grisalho curto nas têmporas
  p.fill(20, 20, 44, 34, (x, y) => EMP_HEAD(x, y) && Math.abs(x - cx) > 8.2 - Math.max(0, 25 - y) * 0.9 && y < 33, (x, y) =>
    pick(GRAY, 0.62 - (x - cx) * 0.025 + ((x + y) % 3 === 0 ? -0.12 : 0), x, y));
  // barba curta e aparada pelo queixo
  const inBeard = (x, y) => EMP_HEAD(x, y) && y > 37 && (y > 43.2 || Math.abs(x - cx) > 8.4 - (y - 37) * 0.25);
  p.fill(20, 36, 44, 47, inBeard, (x, y) => {
    const v = 0.3 + sphereLight((x + 0.5 - 30) / 10, (y + 0.5 - 38) / 10) * 0.65 + (hash(x, y, 8) - 0.5) * 0.14 - ((x + y * 2) % 4 === 0 ? 0.1 : 0);
    return pick(GRAY, v, x, y, 2.4);
  });
  // bigode e boca fechada com os cantos para baixo
  for (let x = 27; x <= 37; x++) p.set(x, 40, GRAY[x < 32 ? 4 : 3]);
  for (let x = 28; x <= 36; x++) p.set(x, 41, GRAY[x < 31 ? 3 : 2]);
  p.set(27, 41, GRAY[3]); p.set(37, 41, GRAY[2]); p.set(27, 42, GRAY[2]); p.set(37, 42, GRAY[1]);
  for (let x = 29; x <= 35; x++) p.set(x, 42, PAL.skin[0]);
  p.set(28, 43, PAL.skin[0]); p.set(36, 43, PAL.skin[0]);
  // sobrancelhas grossas e franzidas, com a ruga no meio
  for (const [x, y] of [[24, 27], [25, 27], [26, 28], [27, 28], [28, 29], [29, 29], [29, 30], [25, 28], [26, 29], [27, 29]]) {
    p.set(x, y, GRAY[1]);
    p.set(63 - x, y, GRAY[1]);
  }
  p.set(31, 29, PAL.skin[2]);
  p.set(31, 30, PAL.skin[2]);
  p.set(32, 30, PAL.skin[1]);
  paintStern(p, false);
  paintNose(p, 31, 33);
  // vincos do nariz até a boca
  for (const [x, y] of [[27, 37], [27, 38], [26, 39]]) {
    p.set(x, y, PAL.skin[2]);
    p.set(63 - x, y, PAL.skin[1]);
  }

  p.outline(PAL.out);
  p.blit(buildEmperorChain(), 0, 0);
  p.blit(buildEmperorCrown(), 0, 0);
  return p;
}

// Olhos estreitos e severos, meio cobertos pelas pálpebras.
function paintStern(p, closed) {
  for (const [x0, left] of [[26, true], [36, false]]) {
    for (let i = 0; i < 3; i++) p.set(x0 + i, 31, GRAY[0]);
    if (closed) {
      for (let i = 0; i < 3; i++) p.set(x0 + i, 32, PAL.skin[2]);
      continue;
    }
    const row = left ? [PAL.eyeWhite, PAL.irisHi, PAL.iris] : [PAL.irisHi, PAL.iris, PAL.eyeWhite];
    row.forEach((c, i) => p.set(x0 + i, 32, c));
  }
  for (const x of [26, 27, 28, 36, 37, 38]) p.set(x, 33, PAL.skin[2]);
}

const emperorArt = { bg: null, body: null, banner: null, gold: null, frame: new Pix(64, 64) };

function paintEmperorPortrait(ctx, t, info) {
  const a = emperorArt;
  if (!a.bg) {
    a.bg = buildEmperorBackdrop();
    a.body = buildEmperor();
    a.banner = buildEmperorBanner();
    a.gold = goldPixels(a.body, PAL.gold, 17, 0, 47, 24);
  }
  const f = a.frame.copyFrom(a.bg);
  drawBanner(f, a.banner, 1, 6, t * 0.9, info.working ? 1.5 : 0.8);
  f.blit(a.body, 0, 0);
  if (t % 6.1 > 5.95 || t % 13.7 > 13.56) paintStern(f, true);
  // o orbe cintila e depois o brilho desce pela coroa
  const period = info.working ? 3.2 : 5.4;
  const ph = t % period;
  sweepGlint(f, a.gold, PAL.gold, (ph - 0.5) * 28 + 20);
  sparkle(f, 31, 3, pulse(ph, 99, 0, 0.7), true);
  sparkle(f, 32, 21, pulse(ph, 99, -0.9, 0.5));
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Dinastia

const DYN_CANDLES = [[3, 41], [7, 38], [11, 41], [52, 41], [56, 38], [60, 41]];
// Galhos da árvore: curva (início, controle, fim) e a distância da raiz no início.
const DYN_BRANCHES = [
  [32, 46, 32, 30, 32, 11, 0],
  [32, 24, 26, 21, 21.5, 14, 22],
  [32, 24, 38, 21, 42.5, 14, 22],
  [32, 31, 20, 31, 14, 21.5, 15],
  [32, 31, 44, 31, 50, 21.5, 15],
  [32, 38, 15, 39, 11, 30, 8],
  [32, 38, 49, 39, 53, 30, 8],
];
const DYN_MEDALS = [[32.5, 7.5, 3.6, 0], [21.5, 12.5, 3, 1], [42.5, 12.5, 3, 2], [14, 20.5, 3, 3], [50, 20.5, 3, 1]];
const DYN_SHIELDS = [[11, 30], [53, 30]];
const DYN_GEMS = [[28, 40], [31, 40], [35, 40]];

function buildDynastyBackdrop() {
  const p = new Pix(64, 64);
  // salão escuro: pedra quase preta, um pouco aquecida pelas velas
  const warm = (x, y) => DYN_CANDLES.reduce((s, [cx, cy]) => s + clamp01(1 - Math.hypot(x - cx, y - cy + 3) / 13) * 0.14, 0);
  paintWall(p, HALL, 8, 4, (x, y) => 0.16 + warm(x, y) - y * 0.001, 9);
  // tapeçaria verde pendurada, com a trama do tecido e dobras leves
  const tx0 = 6, tx1 = 57, ty0 = 3, ty1 = 46;
  p.fill(tx0, ty0, tx1, ty1, () => true, (x, y) => {
    const border = Math.min(x - tx0, tx1 - x, y - ty0, ty1 - y);
    if (border === 0) return PAL.out;
    if (border <= 2) return PAL.gold[border === 1 ? 2 : (x + y) % 3 === 0 ? 4 : 3];
    if (border === 3) return TAPESTRY[0];
    let v = 0.62 - (x - tx0) * 0.006 - (y - ty0) * 0.006 + Math.sin(x * 0.55) * 0.08 + warm(x, y) * 0.6;
    if (y % 2 === 0) v -= 0.06; // trama
    return pick(TAPESTRY, v, x, y, 2);
  });
  // franja dourada embaixo e vara em cima
  for (let x = tx0 + 1; x < tx1; x += 2) { p.set(x, ty1 + 1, PAL.gold[3]); p.set(x, ty1 + 2, PAL.gold[1]); }
  p.rect(tx0 - 2, 2, tx1 - tx0 + 5, 1, PAL.gold[4]);
  p.sphere(tx0 - 2, 2.5, 1.4, 1.4, PAL.gold, 0.1);
  p.sphere(tx1 + 2, 2.5, 1.4, 1.4, PAL.gold, 0.1);

  // árvore da família bordada em fio de ouro
  const seen = new Map();
  for (const [x0, y0, qx, qy, x1, y1, s0] of DYN_BRANCHES) {
    let s = s0, px = x0, py = y0;
    for (let k = 0; k <= 60; k++) {
      const u = k / 60;
      const x = (1 - u) ** 2 * x0 + 2 * (1 - u) * u * qx + u * u * x1;
      const y = (1 - u) ** 2 * y0 + 2 * (1 - u) * u * qy + u * u * y1;
      s += Math.hypot(x - px, y - py);
      px = x; py = y;
      const cells = x0 === x1 ? [[x - 0.5, y, 3], [x + 0.5, y, 2]] : [[x, y, 3]];
      for (const [cx, cy, k2] of cells) {
        const key = Math.floor(cx) + Math.floor(cy) * 64;
        if (!seen.has(key)) seen.set(key, [Math.floor(cx), Math.floor(cy), k2, s]);
      }
    }
  }
  // folhinhas pelos galhos
  for (const [x, y, k] of [[26, 19, 4], [24, 17, 3], [38, 19, 3], [40, 17, 4], [19, 26, 4], [17, 24, 3], [45, 26, 3], [47, 24, 4],
    [16, 35, 4], [14, 33, 3], [48, 35, 3], [50, 33, 4], [30, 13, 4], [34, 13, 3]]) {
    p.set(x, y, TAPESTRY[4]);
    p.set(x + 1, y, PAL.gold[k - 1]);
  }
  const tree = [...seen.values()];
  for (const [x, y, k] of tree) p.set(x, y, PAL.gold[k]);
  // medalhões com o busto de cada antepassado; o aro brilha quando o galho termina nele
  const robes = [PURPLE, VELVET, ROYAL, EMERALD];
  const rings = [];
  for (const [mx, my, r, f] of DYN_MEDALS) {
    let end = 0, best = Infinity;
    for (const [x, y, , s] of tree) {
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      if (d < best) { best = d; end = s; }
    }
    for (let y = Math.floor(my - r - 1); y <= my + r + 1; y++) {
      for (let x = Math.floor(mx - r - 1); x <= mx + r + 1; x++) {
        const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
        if (d > r - 0.5 && d <= r + 0.5) rings.push([x, y, x + y < mx + my - 1 ? 4 : x + y > mx + my ? 2 : 3, end + 2]);
      }
    }
    p.ellipse(mx, my, r + 1, r + 1, PAL.out);
    p.ellipse(mx, my, r + 0.5, r + 0.5, (x, y) => PAL.gold[x + y < mx + my - 1 ? 4 : x + y > mx + my ? 2 : 3]);
    p.ellipse(mx, my, r - 0.5, r - 0.5, (x, y) => pick(MEDAL_BG, 0.85 - (y - my + r) * 0.12, x, y));
    const bx = Math.floor(mx), by = Math.floor(my);
    for (let i = -2; i <= 2; i++) for (let j = 1; j <= 2; j++) if (Math.abs(i) < 2 || j === 2) p.set(bx + i, by + j, robes[f][Math.max(1, robes[f].length - 3 + (i < 0 ? 1 : 0))]);
    p.set(bx, by - 1, PAL.skin[4]);
    p.set(bx, by, PAL.skin[3]);
    p.set(bx - 1, by - 1, PAL.skin[3]);
    p.set(bx + 1, by - 1, PAL.skin[2]);
    p.set(bx - 1, by, PAL.skin[2]);
    p.set(bx + 1, by, PAL.skin[1]);
    if (f === 0) for (const i of [-1, 0, 1]) p.set(bx + i, by - 2, PAL.gold[i ? 4 : 5]);
  }
  for (const [sx, sy] of DYN_SHIELDS) {
    paintBitmap(p, ['ooooooo', 'ogggggo', 'ogrrbgo', 'ogrrbgo', 'ogbbrgo', '.ogbgo.', '..ogo..', '...o...'], sx - 3, sy - 3, (i, j, ch) =>
      ch === 'o' ? PAL.out : ch === 'g' ? PAL.gold[i < 3 ? 4 : 2] : ch === 'r' ? RUBY[2] : SAPPHIRE[2]);
  }
  // só fica no brilho o que continua dourado depois dos medalhões e brasões
  const glint = [];
  for (const [x, y, k, s] of tree.concat(rings)) if (p.get(x, y) === PAL.gold[k]) glint.push(x, y, k, Math.round(s * 4));

  // degraus de pedra com o tapete vermelho no meio
  for (let y = 55; y < 64; y++) {
    const step = y < 59 ? 0 : 1;
    const top = y === 55 || y === 59;
    for (let x = 0; x < 64; x++) {
      if (step === 0 && (x < 4 || x > 59)) continue;
      const carpet = Math.abs(x + 0.5 - 32) < 9 + step * 2;
      let c;
      if (carpet) c = pick(VELVET, (top ? 0.6 : 0.35) - (x - 24) * 0.012 + (Math.abs(x + 0.5 - 32) > 7.5 + step * 2 ? 0.25 : 0), x, y);
      else c = pick(COLUMN, (top ? 0.55 : 0.28) + warm(x, y) + (hash(x >> 2, y, 3) - 0.5) * 0.1, x, y);
      p.set(x, y, c);
    }
  }
  for (let x = 23; x <= 41; x++) p.set(x, 59, PAL.gold[3]);
  // candelabros
  for (const cx of [7, 56]) {
    p.rect(cx, 46, 2, 10, (x, y) => PAL.gold[y % 4 === 3 ? 4 : x === cx ? 3 : 1]);
    p.rect(cx - 2, 55, 6, 1, PAL.gold[2]);
    p.rect(cx - 4, 45, 10, 1, (x) => PAL.gold[x < cx + 1 ? 4 : 3]);
    p.rect(cx - 4, 46, 10, 1, PAL.gold[1]);
    for (const [x, y] of DYN_CANDLES) {
      if (Math.abs(x - cx) > 5) continue;
      const plate = x === cx ? 42 : 44;
      p.rect(x - 1, plate, 4, 1, (xx) => PAL.gold[xx < x + 1 ? 4 : 2]);
      p.rect(x, y + 1, 2, plate - y - 1, (xx, yy) => (xx === x ? WAX[yy === y + 1 ? 3 : 2] : WAX[1]));
    }
    p.rect(cx, 43, 2, 2, PAL.gold[2]);
  }
  return { p, tree: Int16Array.from(glint) };
}

function buildThroneCrown() {
  const p = new Pix(64, 64);
  const cx = 32;
  // coroa pousada na almofada
  for (const [px, h, hw] of [[26.5, 3, 1.4], [37.5, 3, 1.4], [29.2, 5, 1.8], [34.8, 5, 1.8], [32, 6, 2]]) {
    const base = 39, tip = base - h;
    p.fill(px - hw - 1, tip, px + hw + 1, base, (x, y) => Math.abs(x - px) <= hw * ((y - tip) / h) + 0.3, (x, y) =>
      pick(PAL.gold, 0.6 - ((x + 0.5 - px) / hw) * 0.3, x, y));
    p.set(Math.floor(px), tip - 1, ERMINE[4]);
  }
  p.fill(25, 39, 39, 42, (x, y) => Math.abs(x + 0.5 - cx) <= 7, (x, y) =>
    pick(PAL.gold, 0.15 + cylLight((x + 0.5 - cx) / 7) * 0.85 + (y === 39 ? 0.2 : y === 42 ? -0.2 : 0), x, y));
  DYN_GEMS.forEach(([gx, gy], i) => {
    const r = i === 1 ? RUBY : SAPPHIRE;
    p.set(gx, gy, r[4]);
    p.set(gx, gy + 1, r[2]);
    if (i === 1) { p.set(gx + 1, gy, r[2]); p.set(gx + 1, gy + 1, r[1]); }
  });
  p.outline(PAL.out);
  return p;
}

function buildCushion() {
  const p = new Pix(64, 64);
  const cx = 32;
  // almofada vermelha fofa, com debrum e borlas de ouro
  const inC = (x, y) => Math.abs((x - cx) / 11.2) ** 4 + Math.abs((y - 45) / 4.2) ** 4 <= 1;
  p.fill(20, 40, 44, 50, inC, (x, y) => {
    if (!inC(x + 0.5, y + 1.5)) return PAL.gold[2];
    return pick(VELVET, 0.4 + sphereLight((x + 0.5 - 29) / 11.2, (y + 0.5 - 43) / 4.2) * 0.75, x, y);
  });
  for (const [x, y] of [[21, 42], [43, 42], [21, 47], [43, 47]]) {
    p.set(x, y, PAL.gold[4]);
    p.set(x + (x < cx ? -1 : 1), y + 1, PAL.gold[3]);
    p.set(x + (x < cx ? -1 : 1), y + 2, PAL.gold[2]);
  }
  p.outline(PAL.out);
  return p;
}

function buildDynasty() {
  const p = new Pix(64, 64);
  const cx = 32;
  // espaldar alto em arco ogival: moldura de ouro entalhada
  const ogive = (w, base, h) => (x, y) => {
    if (y > base) return Math.abs(x - cx) <= w;
    const u = (base - y) / h;
    return u <= 1 && Math.abs(x - cx) <= w * (1 - u ** 1.6);
  };
  const back = (x, y) => y <= 47 && ogive(11.5, 28, 14.5)(x, y);
  const panel = (x, y) => y <= 46 && ogive(8.4, 29, 11.5)(x, y);
  p.fill(20, 13, 44, 47, back, (x, y) => {
    const inner = panel(x - 0.5, y - 0.5) || panel(x - 0.5, y + 0.5);
    let v = 0.5 - ((x + 0.5 - cx) / 11.5) * 0.25 + (y < 24 ? 0.1 : 0) - (y - 24) * 0.005;
    if (inner) v -= 0.3;
    if ((x + y) % 4 === 0) v += 0.1; // entalhe
    return pick(PAL.gold, v, x, y);
  });
  // veludo vermelho escuro capitonê
  p.fill(23, 17, 41, 46, panel, (x, y) => {
    const dx = (x + y) % 6, dy = (x - y + 60) % 6;
    let v = 0.3 - ((x + 0.5 - cx) / 8.4) * 0.12 - (y - 27) * 0.004;
    if (dx === 0 || dy === 0) v -= 0.1;
    if (dx === 0 && dy === 0) return PAL.gold[3];
    return pick(VELVET, v, x, y);
  });
  // rubi no alto do arco
  p.sphere(32, 16, 1.6, 1.6, RUBY, 0.15);
  // colunas laterais com bolas no alto
  for (const px of [19.5, 44.5]) {
    p.fill(px - 1.5, 23, px + 1.5, 57, (x) => Math.abs(x + 0.5 - px) <= 1.4, (x, y) =>
      pick(PAL.gold, 0.08 + cylLight((x + 0.5 - px) / 1.6) * 0.72 - (y % 6 === 0 ? 0.25 : 0), x, y));
    p.sphere(px, 21.6, 2.1, 2.1, PAL.gold, 0.15);
  }
  // braços: laterais de ouro com almofada de veludo e voluta na ponta
  for (const sx of [-1, 1]) {
    const xa = sx < 0 ? 13 : 46;
    p.rect(xa, 41, 5, 8, (x, y) => {
      if (y === 41) return PAL.gold[sx < 0 ? 5 : 4];
      if (x === xa || x === xa + 4 || y === 48) return PAL.gold[x === xa ? 3 : 1];
      return pick(VELVET, 0.25 - (y - 42) * 0.02, x, y);
    });
    p.sphere(sx < 0 ? 13 : 51, 40.5, 2, 2, PAL.gold, 0.1);
    p.set(sx < 0 ? 13 : 51, 40, PAL.gold[1]);
  }
  // assento e saia da frente
  p.rect(13, 47, 39, 2, (x, y) => pick(VELVET, (y === 47 ? 0.4 : 0.22), x, y));
  p.rect(13, 49, 39, 3, (x, y) => pick(PAL.gold, (y === 49 ? 0.8 : y === 51 ? 0.2 : 0.5) - (x - 13) * 0.006, x, y));
  p.rect(16, 52, 33, 2, (x, y) => pick(PAL.gold, (x % 3 === 0 ? 0.15 : 0.35), x, y));
  // pés de leão
  for (const fx of [16, 46]) {
    p.rect(fx, 54, 3, 3, (x, y) => pick(PAL.gold, 0.6 - (x - fx) * 0.15, x, y));
    p.rect(fx - 1, 57, 5, 1, (x) => PAL.gold[x === fx - 1 ? 4 : 2]);
    for (const tx of [fx - 1, fx + 1, fx + 3]) p.set(tx, 57, PAL.gold[1]);
  }
  p.outline(PAL.out);
  p.blit(buildCushion(), 0, 0);
  p.blit(buildThroneCrown(), 0, 0);
  return p;
}

const dynastyArt = { bg: null, body: null, tree: null, gold: null, frame: new Pix(64, 64) };

function paintDynastyPortrait(ctx, t, info) {
  const a = dynastyArt;
  if (!a.bg) {
    const b = buildDynastyBackdrop();
    a.bg = b.p;
    a.tree = b.tree;
    a.body = buildDynasty();
    a.gold = goldPixels(buildThroneCrown(), PAL.gold, 24, 30, 40, 44);
  }
  const f = a.frame.copyFrom(a.bg);
  // brilho subindo pelos galhos dourados, da raiz até os medalhões
  const run = ((t * (info.working ? 0.4 : 0.25)) % 1) * 260 - 20;
  const tr = a.tree;
  for (let i = 0; i < tr.length; i += 4) {
    const d = Math.abs(tr[i + 3] - run);
    if (d < 12) f.set(tr[i], tr[i + 1], PAL.gold[Math.min(5, tr[i + 2] + (d < 6 ? 2 : 1))]);
  }
  DYN_CANDLES.forEach(([x, y], i) => paintCandle(f, x, y, t, i + 3, info.working));
  f.blit(a.body, 0, 0);
  // a coroa cintila
  const period = info.working ? 3.4 : 5.2;
  const ph = t % period;
  sweepGlint(f, a.gold, PAL.gold, (ph - 0.4) * 24 + 40);
  DYN_GEMS.forEach(([gx, gy], i) => sparkle(f, gx, gy, pulse(ph, 99, -1.6 - i * 0.25, 0.45)));
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Ícones 16x16

// Rosto pequeno de frente, usado nos três nobres.
function iconFace(p, cy, rx, ry) {
  p.fill(2, 2, 14, 16, headTest(8, cy, rx, ry, 0.3), (x, y) =>
    pick(PAL.skin, 0.38 + sphereLight((x + 0.5 - 7.5) / rx, (y + 0.5 - cy + 1) / ry) * 0.75, x, y, 3));
}

function iconDuke() {
  const p = new Pix(16, 16);
  // cabelo loiro até os ombros
  p.fill(1, 5, 15, 16, (x, y) => ((x - 8) / 6.2) ** 2 + ((y - 10.5) / 6.2) ** 2 <= 1 && y < 15.5, (x, y) =>
    pick(BLOND, 0.3 + sphereLight((x + 0.5 - 8) / 6.2, (y + 0.5 - 8) / 6.2) * 0.75 - (x % 3 === 0 ? 0.1 : 0), x, y));
  iconFace(p, 10, 3.8, 4.6);
  p.rect(4, 7, 8, 1, BLOND[3]);
  p.set(5, 8, BLOND[2]);
  p.set(6, 10, EYE_BLUE);
  p.set(9, 10, EYE_BLUE);
  p.set(7, 13, PAL.lip);
  p.set(8, 13, PAL.lip);
  // coroa com três folhas de morango
  p.rect(3, 5, 10, 2, (x, y) => PAL.gold[y === 5 ? (x < 8 ? 5 : 4) : 2]);
  for (const x of [4, 8, 12]) {
    p.set(x, 2, PAL.gold[5]);
    for (const y of [3, 4]) { p.set(x - 1, y, PAL.gold[4]); p.set(x, y, PAL.gold[y === 3 ? 4 : 3]); p.set(x + 1, y, PAL.gold[2]); }
  }
  p.set(8, 6, RUBY[3]);
  p.set(5, 6, SAPPHIRE[3]);
  p.set(11, 6, SAPPHIRE[3]);
  p.outline(PAL.out);
  return p;
}

function iconKing() {
  const p = new Pix(16, 16);
  p.ellipse(8, 9, 6, 6, (x, y) => KING_HAIR[x < 7 ? 3 : 2]);
  iconFace(p, 9.5, 3.8, 4.4);
  // barba cheia
  p.fill(2, 9, 14, 16, (x, y) => ((x - 7.5) / 5.4) ** 2 + ((y - 10) / 5.6) ** 2 <= 1 && (y > 11.5 || Math.abs(x + 0.5 - 8) > 3.4), (x, y) =>
    pick(KING_HAIR, 0.75 - (y - 10) * 0.07 - (x - 7) * 0.04 + ((x + y) % 3 === 0 ? -0.15 : 0), x, y));
  p.rect(6, 12, 4, 1, PAL.skin[0]);
  p.set(6, 9, PAL.iris);
  p.set(9, 9, PAL.iris);
  p.rect(5, 8, 2, 1, KING_HAIR[1]);
  p.rect(9, 8, 2, 1, KING_HAIR[1]);
  // coroa alta com pérolas e pedras
  p.rect(2, 5, 12, 2, (x, y) => PAL.gold[y === 5 ? (x < 8 ? 5 : 4) : 2]);
  for (const [x, h] of [[2, 2], [5, 3], [8, 4], [11, 3], [13, 2]]) {
    for (let k = 1; k <= h; k++) p.set(x, 5 - k, PAL.gold[k === h ? 5 : 3]);
    if (h > 2) { p.set(x - 1, 4, PAL.gold[4]); p.set(x + 1, 4, PAL.gold[2]); }
  }
  p.set(8, 0, ERMINE[4]);
  p.set(5, 6, SAPPHIRE[3]);
  p.set(8, 6, RUBY[3]);
  p.set(11, 6, SAPPHIRE[3]);
  p.outline(PAL.out);
  return p;
}

function iconEmperor() {
  const p = new Pix(16, 16);
  // gola roxa
  p.ellipse(8, 17, 7.5, 3.6, (x, y) => PURPLE[x < 8 ? 4 : 3]);
  p.set(8, 14, PAL.gold[4]);
  iconFace(p, 10, 3.6, 4.2);
  // têmporas e barba grisalhas
  p.set(4, 9, GRAY[3]); p.set(4, 10, GRAY[3]); p.set(11, 9, GRAY[2]); p.set(11, 10, GRAY[2]);
  p.rect(5, 12, 6, 1, GRAY[3]);
  p.rect(6, 13, 4, 1, GRAY[2]);
  p.set(7, 12, PAL.skin[0]); p.set(8, 12, PAL.skin[0]);
  // olhos sob sobrancelhas franzidas
  p.set(5, 8, GRAY[1]); p.set(6, 9, GRAY[1]); p.set(10, 8, GRAY[1]); p.set(9, 9, GRAY[1]);
  p.set(6, 10, PAL.iris);
  p.set(9, 10, PAL.iris);
  // coroa fechada: barrete roxo, arcos de ouro e orbe
  p.fill(3, 2, 13, 7, (x, y) => ((x - 8) / 4.8) ** 2 + ((y - 7) / 4.4) ** 2 <= 1 && y < 7, (x, y) =>
    Math.abs(x + 0.5 - 8) < 1 ? PAL.gold[4] : PURPLE[x < 8 ? 4 : 3]);
  for (const [x, y] of [[4, 5], [5, 4], [6, 3], [11, 5], [10, 4], [9, 3]]) p.set(x, y, PAL.gold[x < 8 ? 4 : 2]);
  p.rect(3, 6, 10, 2, (x, y) => PAL.gold[y === 6 ? (x < 8 ? 5 : 4) : 2]);
  p.set(5, 7, EMERALD[3]);
  p.set(8, 7, RUBY[3]);
  p.set(10, 7, EMERALD[3]);
  p.rect(7, 0, 2, 2, PAL.gold[4]);
  p.set(8, 1, PAL.gold[2]);
  p.set(7, 0, PAL.gold[5]);
  p.outline(PAL.out);
  return p;
}

function iconDynasty() {
  const p = new Pix(16, 16);
  // trono de ouro com espaldar ogival
  p.fill(3, 1, 13, 11, (x, y) => y >= 1 && Math.abs(x + 0.5 - 8) <= 4.6 * (y > 5 ? 1 : 1 - ((5 - y) / 4.6) ** 1.6), (x, y) =>
    PAL.gold[x < 7 ? 4 : 3]);
  p.fill(4, 3, 12, 10, (x, y) => y >= 3 && Math.abs(x + 0.5 - 8) <= 2.8 * (y > 6 ? 1 : 1 - ((6 - y) / 3.6) ** 1.6), (x, y) =>
    VELVET[y < 6 ? 2 : 1]);
  p.set(8, 5, RUBY[3]);
  // braços, assento e pés
  p.rect(1, 9, 3, 3, (x, y) => PAL.gold[y === 9 ? 5 : 2]);
  p.rect(12, 9, 3, 3, (x, y) => PAL.gold[y === 9 ? 4 : 1]);
  p.rect(2, 11, 12, 2, (x, y) => PAL.gold[y === 11 ? 5 : 3]);
  p.rect(3, 13, 2, 2, PAL.gold[3]);
  p.rect(11, 13, 2, 2, PAL.gold[2]);
  // almofada com a coroa no assento
  p.rect(5, 10, 6, 1, (x) => VELVET[x < 8 ? 5 : 4]);
  p.set(6, 7, PAL.gold[5]); p.set(8, 7, PAL.gold[5]); p.set(10, 7, PAL.gold[4]);
  p.rect(6, 8, 5, 2, (x, y) => PAL.gold[y === 8 ? 4 : 2]);
  p.set(8, 9, RUBY[3]);
  p.outline(PAL.out);
  return p;
}

ART.portraits.duke = paintDukePortrait;
ART.portraits.king = paintKingPortrait;
ART.portraits.emperor = paintEmperorPortrait;
ART.portraits.dynasty = paintDynastyPortrait;
ART.locked.duke = ART.silhouette(buildDuke);
ART.locked.king = ART.silhouette(buildKing);
ART.locked.emperor = ART.silhouette(buildEmperor);
ART.locked.dynasty = ART.silhouette(buildDynasty);
Object.assign(ART.icons, { duke: iconDuke, king: iconKing, emperor: iconEmperor, dynasty: iconDynasty });
})();
