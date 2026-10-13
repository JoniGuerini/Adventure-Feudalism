'use strict';
// Linha da comida, tiers 3 a 5: Celeiro (faz moinhos), Granja (faz celeiros) e
// Aldeia (faz granjas). Retratos animados, silhuetas bloqueadas e ícones.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

const BARN = ramp('#2a0d10', '#481519', '#6a2020', '#8a2f27', '#a6432f', '#c06046');
const SHINGLE = ramp('#1e1819', '#342a29', '#4c3e38', '#685447', '#866d58', '#a68a6c');
const TRIM = PAL.sail;
const DARK = ramp('#120807', '#1e100c', '#2c1a12', '#3e2618');
const SWALLOW = C('#1d2238');

// Coordenadas (a, b) de um ponto num paralelogramo o + a*e1 + b*e2.
function planeUV(o, e1, e2) {
  const det = e1[0] * e2[1] - e1[1] * e2[0];
  return (x, y) => {
    const dx = x - o[0], dy = y - o[1];
    return [(dx * e2[1] - dy * e2[0]) / det, (e1[0] * dy - e1[1] * dx) / det];
  };
}
const quad = (o, e1, e2) => [o, [o[0] + e1[0], o[1] + e1[1]], [o[0] + e1[0] + e2[0], o[1] + e1[1] + e2[1]], [o[0] + e2[0], o[1] + e2[1]]];

// Telhas de madeira num plano: fiadas ao longo de e1, desencontradas, com a
// sombra de cada fiada na borda de baixo. b vai da cumeeira (0) ao beiral (1).
function shingles(p, o, e1, e2, rows, cols, base, seed) {
  const uv = planeUV(o, e1, e2);
  p.poly(quad(o, e1, e2), (x, y) => {
    const [a, b] = uv(x + 0.5, y + 0.5);
    const rb = clamp01(b) * rows, row = Math.floor(rb), fb = rb - row;
    const ca = a * cols + (row % 2) * 0.5, col = Math.floor(ca), fa = ca - col;
    let v = base + (hash(col, row, seed) - 0.5) * 0.22 + (0.5 - fb) * 0.18;
    if (fb > 0.72) v -= 0.3;
    else if (fa < 0.16) v -= 0.18;
    if (hash(col, row, seed + 1) < 0.06) v += 0.2; // telha nova, mais clara
    return pick(SHINGLE, v, x, y, 2.6);
  });
}

// ---------------------------------------------------------------------------
// Celeiro

function buildBarnBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 46);
  paintSun(p, 8, 8, 4);
  // árvores ao longe
  for (let x = 0; x < 64; x++) {
    const top = 41 + Math.round(1.4 * Math.sin(x * 0.5 + 1) + Math.sin(x * 1.3));
    for (let y = top; y < 46; y++) p.set(x, y, pick(PAL.tree, 0.55 - (y - top) * 0.12 + (hash(x, y) - 0.5) * 0.3, x, y));
  }
  // trigal
  for (let y = 45; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.42 + (y - 45) * 0.018 + (hash(x, y, 2) - 0.5) * 0.22 - (y % 4 === 0 ? 0.1 : 0);
      p.set(x, y, pick(PAL.wheat, v, x, y, 1.6));
    }
  }
  // sombra do celeiro no trigal, à direita
  for (let y = 52; y < 61; y++) {
    for (let x = 40; x < 64; x++) {
      if (y - 52 < (x - 40) * 0.5 && bayer(x, y) < 0.75 - (y - 52) * 0.06) p.set(x, y, PAL.wheat[1]);
    }
  }
  // terreiro batido na frente do portão, com feno espalhado
  p.poly([[14, 56], [35, 56], [44, 64], [7, 64]], (x, y) =>
    pick(PAL.dirt, 0.6 + (hash(x, y, 6) - 0.5) * 0.35 - Math.abs(x - 24) * 0.012, x, y));
  for (let i = 0; i < 16; i++) {
    const x = 12 + hash(i, 1, 21) * 28, y = 57 + hash(i, 2, 21) * 7;
    p.set(x, y, PAL.straw[3 + (i % 2)]);
    p.set(x + (i % 3 === 0 ? 1 : -1), y, PAL.straw[2]);
  }
  return p;
}

function buildBarn() {
  const p = new Pix(64, 64);
  // fachada em gambrel (colunas 5 a 41, centro em 23,5)
  const inFace = (x, y) => {
    if (x < 5 || x >= 42 || y >= 58 || y < 14) return false;
    if (y >= 34) return true;
    const d = Math.abs(x - 23.5);
    if (y >= 23) return d <= 12.5 + (y - 23) * 0.55;
    return d <= (y - 14) * (12.5 / 9);
  };
  // borda das telhas do lado esquerdo, vista de quina
  p.poly([[3.6, 35.6], [9.6, 22.3], [23.5, 12.3], [37, 22], [43.5, 34.5]], (x, y) => SHINGLE[(x + y) % 3 ? 2 : 1]);
  // tábuas verticais
  p.fill(5, 14, 42, 58, inFace, (x, y) => {
    const board = Math.floor((x - 5) / 3);
    let v = 0.6 + (hash(board, 0, 3) - 0.5) * 0.16 + (hash(x, y >> 2, 4) - 0.5) * 0.1 - (y - 14) * 0.004;
    if ((x - 5) % 3 === 0) v -= 0.3;
    if (hash(x, y, 5) < 0.03) v -= 0.25; // nós da madeira
    if (y > 51) v -= (y - 51) * 0.03;
    return pick(BARN, v, x, y);
  });
  // acabamento branco nas bordas do gambrel e nas quinas
  p.fill(5, 14, 42, 35, (x, y) => inFace(x, y) && (!inFace(x - 1, y) || !inFace(x + 1, y) || !inFace(x, y - 1)),
    (x, y) => pick(TRIM, x < 24 ? 0.85 : 0.5, x, y));
  p.rect(5, 34, 2, 22, (x) => TRIM[x === 5 ? 4 : 3]);
  p.rect(40, 34, 2, 22, (x) => TRIM[x === 40 ? 2 : 1]);
  p.rect(5, 34, 37, 1, (x) => TRIM[x < 24 ? 4 : 3]);

  // parede lateral na sombra
  p.poly([[42, 34], [59, 35], [59, 56], [42, 58]], (x, y) => {
    const board = Math.floor((x - 42) / 3);
    let v = 0.3 + (hash(board, 1, 3) - 0.5) * 0.14 + (hash(x, y >> 2, 6) - 0.5) * 0.08;
    if ((x - 42) % 3 === 0) v -= 0.22;
    if (y < 37.5 + (x - 42) * 0.06) v -= 0.18; // sombra do beiral
    return pick(BARN, v, x, y);
  });
  // janelinha lateral
  p.rect(48, 41, 5, 5, TRIM[1]);
  p.rect(49, 42, 3, 3, DARK[1]);
  p.set(49, 42, DARK[3]);
  p.rect(58, 35, 1, 21, TRIM[0]);

  // telhado: plano de cima (mais claro) e o de baixo (mais íngreme, na sombra)
  shingles(p, [23.5, 13], [17, 1], [12.5, 9.5], 4, 6, 0.62, 11);
  shingles(p, [36, 22.5], [17, 1], [7.5, 12.5], 5, 6, 0.36, 13);
  // cumeeira
  p.line(24, 13, 40, 14, (x) => SHINGLE[x % 3 ? 4 : 3]);

  // fundação de pedra (interrompida no portão)
  p.fill(5, 56, 60, 58, (x, y) => (x < 42 ? y >= 56 && (x < 17 || x > 30) : y >= 55.5 - (x - 42) * 0.1 && y < 58 - (x - 42) * 0.12), (x, y) => {
    const v = (x < 42 ? 0.42 : 0.2) + (hash(x >> 1, y, 8) - 0.5) * 0.3 - ((x + (y % 2) * 2) % 4 === 0 ? 0.2 : 0) + (y === 56 && x < 42 ? 0.15 : 0);
    return pick(PAL.stone, v, x, y);
  });

  // tufos de capim na base
  for (const x of [7, 8, 12, 15, 33, 37, 44, 47, 51, 56]) {
    const y = x < 42 ? 57 : 57 - Math.round((x - 42) * 0.12);
    p.set(x, y, PAL.grass[3]);
    p.set(x + 1, y - 1, PAL.grass[4]);
    p.set(x - 1, y - (x % 2), PAL.grass[2]);
  }

  // portão aberto: interior escuro com o feno
  const inDoor = (x, y) => x >= 18 && x < 30 && y >= 40 && y < 58;
  p.fill(18, 40, 29, 57, inDoor, (x, y) => {
    let v = 0.12 + (y - 40) * 0.012;
    if ((x - 18) % 4 === 1) v -= 0.1;
    else if ((x - 18) % 4 === 2) v += 0.06;
    const shaft = x - 18 - (y - 40) * 0.55; // luz do sol entrando em diagonal
    if (shaft > 2.5 && shaft < 7.5) v += 0.22;
    return pick(DARK, v, x, y, 1.6);
  });
  // monte de feno solto no fundo
  const pileTop = (x) => 47.5 + 2.2 * Math.cos((x - 25.5) * 0.42) - hash(x, 0, 9) * 1.2;
  p.fill(18, 44, 29, 57, (x, y) => inDoor(x, y) && y > pileTop(x), (x, y) => {
    const shaft = x - 18 - (y - 40) * 0.55;
    let v = 0.42 - (y - pileTop(x)) * 0.02 + (hash(x, y, 10) - 0.5) * 0.35 + (shaft > 2.5 && shaft < 7.5 ? 0.18 : 0);
    if ((x + y * 3) % 5 === 0) v -= 0.16;
    if (y < pileTop(x) + 1) v += 0.15;
    return pick(PAL.straw, v, x, y, 1.5);
  });
  // dois fardos empilhados, com a amarração
  const bale = (x0, y0, w, h) => {
    p.rect(x0, y0 - 1, w + 1, 1, DARK[0]);
    p.rect(x0 + w, y0 - 1, 1, h + 1, DARK[0]);
    p.rect(x0, y0, w, h, (x, y) => {
      let v = 0.62 - (x - x0) * 0.035 + (y === y0 ? 0.3 : 0) + (hash(x, y, 12) - 0.5) * 0.2;
      if ((x * 2 + y) % 4 === 0) v -= 0.1;
      if (y === y0 + h - 1) v -= 0.22;
      return pick(PAL.straw, v, x, y);
    });
    for (const bx of [x0 + 1, x0 + w - 2]) for (let y = y0 + 1; y < y0 + h; y++) p.set(bx, y, PAL.straw[1]);
  };
  bale(18, 52, 7, 5);
  bale(18, 47, 6, 5);
  // forcado encostado no batente
  p.line(29, 57, 26, 46, (x, y) => PAL.wood[y % 3 ? 4 : 3]);
  for (const [x, y] of [[24, 46], [25, 46], [26, 45], [27, 45], [28, 45]]) p.set(x, y, PAL.iron[2]);
  for (const x0 of [24, 26, 28]) {
    for (let k = 1; k <= 4; k++) p.set(x0 - (k > 2 ? 1 : 0), 46 - k - (x0 > 24 ? 1 : 0), PAL.iron[k > 2 ? 4 : 3]);
  }
  // feno espalhado na soleira
  for (const [x, y, k] of [[19, 57, 4], [21, 57, 3], [23, 57, 4], [24, 56, 3], [26, 57, 4], [17, 57, 3], [31, 57, 4]]) p.set(x, y, PAL.straw[k]);
  // batente branco
  p.rect(17, 39, 1, 18, TRIM[4]);
  p.rect(30, 39, 1, 18, TRIM[2]);
  p.rect(17, 39, 14, 1, TRIM[4]);
  // folhas do portão abertas, encostadas na parede, com o X de reforço
  const leaf = (x0, lit) => {
    p.rect(x0, 40, 7, 16, (x, y) => {
      let v = (lit ? 0.62 : 0.5) + (hash(x, 1, 14) - 0.5) * 0.1;
      if ((x - x0) % 2 === 1) v -= 0.12;
      return pick(BARN, v, x, y);
    });
    const t = TRIM[lit ? 4 : 3], s = TRIM[lit ? 2 : 1];
    p.rect(x0, 40, 7, 1, t); p.rect(x0, 47, 7, 1, t); p.rect(x0, 55, 7, 1, s);
    p.rect(x0, 40, 1, 16, t); p.rect(x0 + 6, 40, 1, 16, s);
    p.line(x0 + 1, 41, x0 + 5, 46, t); p.line(x0 + 5, 41, x0 + 1, 46, t);
    p.line(x0 + 1, 48, x0 + 5, 54, t); p.line(x0 + 5, 48, x0 + 1, 54, t);
  };
  leaf(10, true);
  leaf(31, false);
  for (const y of [42, 52]) { p.set(16, y, PAL.iron[1]); p.set(31, y, PAL.iron[1]); }
  // ferradura da sorte em cima do portão
  for (const [x, y, k] of [[22, 36, 3], [22, 37, 2], [23, 38, 2], [24, 38, 1], [25, 37, 1], [25, 36, 2]]) p.set(x, y, PAL.iron[k]);

  // porta do palheiro com feno saindo
  p.rect(19, 25, 10, 9, (x, y) => TRIM[x === 19 || y === 25 ? 4 : 3]);
  p.rect(20, 26, 8, 7, (x, y) => pick(DARK, 0.15 + (y - 26) * 0.05, x, y));
  p.fill(20, 28, 27, 32, (x, y) => y > 29.5 + Math.sin(x * 1.3) * 1.1, (x, y) => pick(PAL.straw, 0.5 + (hash(x, y, 15) - 0.5) * 0.5, x, y));
  for (const [x, y] of [[21, 33], [22, 34], [25, 33], [26, 34], [24, 33]]) p.set(x, y, PAL.straw[x % 2 ? 4 : 3]);
  // viga do guincho
  p.rect(22, 20, 4, 2, (x, y) => PAL.wood[y === 20 ? 4 : 2]);
  p.set(25, 20, PAL.wood[3]);
  // haste do cata-vento
  p.rect(23, 7, 1, 7, (x, y) => PAL.iron[y < 10 ? 2 : 3]);
  p.sphere(23.5, 12.5, 1.5, 1.5, PAL.gold, 0.1);

  p.outline(PAL.out);
  return p;
}

// Galo do cata-vento (virado para a direita). A coluna 4 fica na haste.
const ROOSTER = [
  '.....##...',
  '#....###..',
  '##..####>.',
  '###.####..',
  '.#######..',
  '..#####...',
  '...#.#....',
];
const ARROW = [
  '<.........',
  '<<=======>',
  '<.........',
];

const vane = new Pix(20, 14);
function paintVane(f, t, working) {
  const ang = t * (working ? 0.75 : 0.45) + Math.sin(t * 0.6) * 0.9;
  const s = Math.cos(ang);
  const v = vane.clear();
  const rod = 10;
  const draw = (rows, y0, ramp0) => {
    const w = rows[0].length;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (Math.abs(s) * w < 1.2) {
        if (row.indexOf('#') >= 0 || row.indexOf('=') >= 0 || row.indexOf('<') >= 0) v.set(rod, y0 + r, ramp0[2]);
        continue;
      }
      const half = Math.ceil(Math.abs(s) * 6);
      for (let x = rod - half; x <= rod + half; x++) {
        const lx = Math.floor((x + 0.5 - rod) / s + 4.5);
        const ch = row[lx];
        if (!ch || ch === '.') continue;
        const k = ch === '>' ? 3 : s > 0 ? (r < 2 || lx > 6 ? 5 : 4) : (r < 2 ? 3 : 2);
        v.set(x, y0 + r, ramp0[k]);
      }
    }
  };
  draw(ROOSTER, 2, PAL.gold);
  draw(ARROW, 10, PAL.iron);
  v.outline(PAL.out);
  f.blit(v, 23 - rod, -1);
}

// Andorinha vista de baixo: asas em foice e cauda bifurcada.
function paintSwallow(f, x, y, flap) {
  x = Math.round(x); y = Math.round(y);
  const c = SWALLOW;
  f.set(x, y - 1, c); f.set(x, y, c); f.set(x, y + 1, c);
  f.set(x - 1, y + 2, c); f.set(x + 1, y + 2, c);
  for (const d of [-1, 1]) {
    f.set(x + d, y, c);
    if (flap > 0) {
      f.set(x + d * 2, y - 1, c);
      f.set(x + d * 3, y - 2, c);
    } else {
      f.set(x + d * 2, y, c);
      f.set(x + d * 3, y + 1, c);
    }
  }
}

const barnArt = { bg: null, body: null, cloud: null, frame: new Pix(64, 64) };

function paintBarnPortrait(ctx, t, info) {
  const a = barnArt;
  if (!a.bg) {
    a.bg = buildBarnBackdrop();
    a.body = buildBarn();
    a.cloud = makeCloud(20, 8, 5);
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.cloud, Math.floor(((t * 1.6) % 92) - 22), 17);
  // espigas balançando nos cantos
  for (let row = 0; row < 5; row++) {
    const y = 47 + row * 3;
    for (let x = (row % 2) * 2; x < 64; x += 4) {
      const sway = Math.round(Math.sin(t * 1.8 - x * 0.09 + row * 0.6) * (1 + row * 0.25));
      f.set(x + sway, y, PAL.wheat[row > 2 ? 5 : 4]);
      f.set(x + sway, y + 1, PAL.wheat[row > 2 ? 4 : 3]);
    }
  }
  f.blit(a.body, 0, 0);
  paintVane(f, t, working);
  // corda do guincho balançando com o gancho
  const sway = Math.sin(t * 1.3) * 1.1;
  for (let k = 0; k < 6; k++) f.set(24 + sway * (k / 6), 22 + k, k % 2 ? PAL.wood[4] : PAL.straw[3]);
  const hx = Math.round(24 + sway);
  f.set(hx, 28, PAL.iron[3]);
  f.set(hx + 1, 29, PAL.iron[2]);
  f.set(hx, 30, PAL.iron[1]);
  // andorinhas fazendo voltas em torno do telhado
  for (let k = 0; k < 3; k++) {
    const w = 0.55 + k * 0.12, ph = k * 2.1 + t * w;
    const cx = [12, 52, 30][k], cy = [10, 12, 24][k];
    const x = cx + Math.cos(ph) * [9, 9, 12][k];
    const y = cy + Math.sin(ph * 2) * 3.5;
    paintSwallow(f, x, y, Math.sin(t * 11 + k * 1.3));
  }
  // poeira de feno flutuando na luz do portão
  const motes = working ? 14 : 6;
  for (let k = 0; k < motes; k++) {
    const life = (t * (working ? 0.16 : 0.07) * (0.6 + hash(k, 1, 31)) + hash(k, 2, 31)) % 1;
    const x = 19 + hash(k, 3, 31) * 10 + Math.sin(t * 0.9 + k * 2.3) * 1.5;
    const y = 55 - life * 15;
    const shaft = x - 18 - (y - 40) * 0.55;
    if (shaft > 1 && shaft < 9) f.set(x, y, life > 0.15 && life < 0.85 ? PAL.straw[5] : PAL.straw[4]);
  }
  f.draw(ctx);
}

function iconBarn() {
  const p = new Pix(16, 16);
  p.poly([[1, 16], [1, 8], [3.5, 4], [8, 1], [12.5, 4], [15, 8], [15, 16]], (x, y) =>
    pick(BARN, 0.6 - (x - 3) * 0.03 - (x % 3 === 0 ? 0.25 : 0), x, y));
  // acabamento branco no contorno do gambrel
  const inside = (x, y) => (y >= 8 ? x >= 1 && x < 15 : y >= 4 ? Math.abs(x - 8) <= 4.5 + (y - 4) * 0.62 : Math.abs(x - 8) <= (y - 1) * 1.5);
  p.fill(0, 0, 16, 9, (x, y) => inside(x, y) && (!inside(x, y - 1) || !inside(x - 1, y) || !inside(x + 1, y)), (x) => TRIM[x < 8 ? 4 : 3]);
  p.rect(5, 9, 6, 7, TRIM[3]);
  p.rect(6, 10, 4, 6, BARN[2]);
  p.line(6, 10, 9, 15, TRIM[4]);
  p.line(9, 10, 6, 15, TRIM[4]);
  p.rect(7, 5, 2, 2, DARK[1]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Granja

const COW = ramp('#3c3a4a', '#6c6a7a', '#a4a2aa', '#d4d0ca', '#f2eee4', '#fffdf6');
const SPOT = ramp('#121016', '#221e26', '#36303a', '#4c4450');
const PINK = ramp('#8a4a52', '#c47a7a', '#e8a6a0', '#f8cec4');
const HEN_WHITE = ramp('#6a6470', '#a8a2a4', '#dcd6cc', '#f6f2e8', '#ffffff');
const HEN_BROWN = ramp('#3e1c10', '#6e3216', '#9c4e20', '#c47234', '#e0995a');
const COMB = C('#d23a30'), BEAK = C('#f0b030');
const CABBAGE = ramp('#1c3a2a', '#2c5a3c', '#468050', '#6ca866', '#a2cc84');
const CARROT = ramp('#9a3a12', '#d8641c', '#f49a3a');

function buildFarmBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 40);
  // morros distantes com retalhos de lavoura
  for (let x = 0; x < 64; x++) {
    const top = 31 + Math.round(2.5 * Math.sin(x * 0.09 + 2) + Math.sin(x * 0.31));
    for (let y = top; y < 42; y++) {
      const patch = Math.floor((x + (y - top) * 3) / 13) % 3;
      let v = 0.62 - (y - top) * 0.03 + (patch - 1) * 0.08;
      if (y === top) v += 0.15;
      p.set(x, y, patch === 2 && y > top + 1 ? pick(PAL.wheat, 0.45 + (y === top + 2 ? 0.15 : 0), x, y) : pick(PAL.far, v, x, y));
    }
  }
  // fileira de árvores
  for (let x = 0; x < 64; x++) {
    const top = 37 + Math.round(1.5 * Math.sin(x * 0.6) + Math.sin(x * 1.4 + 1));
    for (let y = top; y < 41; y++) p.set(x, y, pick(PAL.tree, 0.6 - (y - top) * 0.12 + (hash(x, y, 2) - 0.5) * 0.3, x, y));
  }
  // pasto
  for (let y = 40; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.55 + (y - 40) * 0.008 + (hash(x, y, 3) - 0.5) * 0.25;
      if (hash(x, y, 4) < 0.06) v += 0.2;
      if ((x * 3 + y * 5) % 11 === 0) v -= 0.15;
      p.set(x, y, pick(PAL.grass, v, x, y, 1.6));
    }
  }
  // trilha de terra até a porta
  p.poly([[23, 45], [28, 45], [34, 64], [16, 64]], (x, y) => pick(PAL.dirt, 0.62 + (hash(x, y, 5) - 0.5) * 0.35 - (y - 45) * 0.006, x, y));
  // canteiros da horta
  for (let y = 51; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (x > 14 + (y - 51) * 0.1) continue;
      const furrow = (y - 51) % 4;
      p.set(x, y, pick(PAL.dirt, (furrow === 0 ? 0.25 : furrow === 1 ? 0.6 : 0.42) + (hash(x, y, 6) - 0.5) * 0.2, x, y));
    }
  }
  // grãos de milho jogados para as galinhas
  for (let i = 0; i < 12; i++) p.set(30 + hash(i, 1, 7) * 18, 57 + hash(i, 2, 7) * 6, PAL.gold[4]);
  return p;
}

function buildFarmhouse(p) {
  // empena de pedra e tábuas, vista de quina pela esquerda
  const gable = [[17, 46], [17, 27], [11.5, 13.5], [6, 25.5], [6, 44]];
  p.poly(gable, (x, y) => {
    if (y < 27 - (17 - x) * 0.1) {
      let v = 0.72 + (hash(x, 1, 21) - 0.5) * 0.08;
      if ((y - 14) % 3 === 0) v -= 0.25;
      return pick(PAL.wood, v, x, y);
    }
    return stoneWall(x, y, 0.62);
  });
  // janelinha redonda na empena
  p.sphere(11.5, 20.5, 1.7, 1.7, DARK, -0.2);
  p.set(11, 20, PAL.glassHi);
  // parede da frente: pedra embaixo, tábuas em cima
  p.rect(17, 27, 28, 19, (x, y) => {
    if (y < 33) {
      let v = 0.5 + (hash(x, y >> 1, 22) - 0.5) * 0.1 - (y < 29 ? 0.25 : 0);
      if ((y - 27) % 2 === 1 && (x + y) % 9 !== 0) v -= 0.12;
      return pick(PAL.wood, v, x, y);
    }
    return stoneWall(x, y, 0.42);
  });
  p.rect(17, 33, 28, 1, (x) => PAL.wood[x % 6 === 0 ? 2 : 1]);
  p.rect(17, 27, 1, 19, PAL.stone[4]);
  // porta de tábuas com verga
  p.rect(21, 36, 7, 10, PAL.wood[1]);
  p.rect(22, 37, 5, 9, (x, y) => pick(PAL.wood, 0.62 - (x - 22) * 0.06 - ((x - 22) % 2 ? 0.15 : 0), x, y));
  p.rect(21, 35, 7, 1, PAL.stone[4]);
  p.set(25, 41, PAL.gold[4]);
  p.rect(22, 39, 5, 1, PAL.iron[1]);
  // janela com venezianas abertas e floreira
  const win = (x0, y0) => {
    p.rect(x0, y0, 5, 4, PAL.glass);
    p.set(x0 + 1, y0 + 1, PAL.glassHi);
    p.rect(x0 + 2, y0, 1, 4, PAL.wood[2]);
    p.rect(x0 - 2, y0, 2, 4, (x) => PAL.wood[x === x0 - 2 ? 4 : 3]);
    p.rect(x0 + 5, y0, 2, 4, (x) => PAL.wood[x === x0 + 5 ? 3 : 2]);
  };
  win(30, 28);
  // lampião ao lado da porta
  p.set(19, 36, PAL.iron[1]);
  p.rect(18, 37, 2, 2, (x, y) => (y === 37 ? PAL.fire[4] : PAL.fire[3]));
  p.rect(18, 39, 2, 1, PAL.iron[1]);
  // janela na parede da empena, com floreira
  p.rect(9, 31, 4, 4, PAL.glass);
  p.set(10, 32, PAL.glassHi);
  p.rect(8, 30, 6, 1, PAL.wood[3]);
  p.rect(8, 35, 6, 2, (x, y) => PAL.wood[y === 35 ? 4 : 2]);
  for (const [x, c] of [[8, '#e0644c'], [10, '#f4e9d0'], [12, '#e0644c']]) { p.set(x, 34, C(c)); p.set(x + 1, 34, PAL.herb[4]); }
  // telhado de telhas: plano da frente
  const o = [9.5, 12.5], e1 = [33, 0], e2 = [6, 16];
  const uv = planeUV(o, e1, e2);
  p.poly(quad(o, e1, e2), (x, y) => {
    const [a, b] = uv(x + 0.5, y + 0.5);
    const rb = b * 6, row = Math.floor(rb), fb = rb - row;
    const ca = a * 15 + (row % 2) * 0.5, fa = ca - Math.floor(ca);
    let v = 0.68 - a * 0.15 + (hash(Math.floor(ca), row, 23) - 0.5) * 0.15;
    if (fb > 0.68) v -= 0.32;
    else if (fa < 0.18) v -= 0.16;
    else if (fb < 0.3) v += 0.08;
    if (b > 0.94) v -= 0.25;
    return pick(PAL.roof, v, x, y, 2.4);
  });
  // borda do telhado sobre a empena e a cumeeira
  p.line(9, 13, 15, 28, (x, y) => PAL.roof[y % 2 ? 4 : 3]);
  p.line(10, 12, 42, 12, (x) => PAL.roof[x % 3 ? 2 : 1]);
  p.line(11, 13, 5, 26, PAL.roof[1]);
  // chaminé de pedra
  p.rect(36, 9, 5, 8, (x, y) => pick(PAL.stone, (x === 36 ? 0.8 : x === 40 ? 0.3 : 0.55) - (y % 3 === 0 ? 0.15 : 0) + (hash(x, y, 24) - 0.5) * 0.15, x, y));
  p.rect(35, 8, 7, 2, (x, y) => PAL.stone[y === 8 ? 4 : 2]);
  p.rect(37, 8, 3, 1, DARK[0]);
  for (let x = 37; x < 44; x++) p.set(x, 17, PAL.roof[1]);
}

function stoneWall(x, y, base) {
  const row = Math.floor(y / 3), off = (row % 2) * 2;
  const sx = Math.floor((x + off) / 4);
  let v = base + (hash(sx, row, 25) - 0.5) * 0.3;
  if (y % 3 === 2 || (x + off) % 4 === 0) v -= 0.22;
  else if (y % 3 === 0) v += 0.08;
  return pick(PAL.stone, v, x, y);
}

function buildFence(p) {
  for (let x = 0; x < 64; x += 6) {
    p.rect(x, 45, 2, 7, (xx, yy) => pick(PAL.wood, (xx === x ? 0.7 : 0.4) - (yy - 45) * 0.03, xx, yy));
    p.set(x, 44, PAL.wood[3]);
  }
  for (const y of [46, 49]) {
    p.rect(0, y, 64, 1, (x) => PAL.wood[(x * 7) % 5 === 0 ? 2 : 3]);
    p.rect(0, y + 1, 64, 1, PAL.wood[1]);
  }
}

function buildCow(p) {
  // pernas (as de trás mais escuras)
  for (const [x, far] of [[42, 1], [45, 0], [53, 1], [56, 0]]) {
    p.rect(x, 50, 2, 7, (xx, yy) => pick(COW, (far ? 0.35 : 0.6) - (yy - 50) * 0.04 - (xx === x + 1 ? 0.15 : 0), xx, yy));
    p.rect(x, 56, 2, 1, SPOT[0]);
  }
  // corpo arredondado
  const cx = 49.5, cy = 46, rx = 9.5, ry = 5;
  p.fill(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 4 + ((y - cy) / ry) ** 4 <= 1, (x, y) => {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    const l = 0.15 + sphereLight(nx * 0.8, ny) * 0.95;
    const spot = ((x - 52) / 3.5) ** 2 + ((y - 44.5) / 2.6) ** 2 <= 1 || ((x - 44) / 2.4) ** 2 + ((y - 48) / 2.2) ** 2 <= 1 ||
      ((x - 57.5) / 1.6) ** 2 + ((y - 47.5) / 2.4) ** 2 <= 1;
    return spot ? pick(SPOT, l * 0.9, x, y) : pick(COW, l, x, y);
  });
  // úbere
  p.ellipse(52.5, 51.2, 2.2, 1.3, (x, y) => PINK[y < 51 ? 2 : 1]);
  p.set(51, 52, PINK[1]); p.set(53, 52, PINK[1]);
  // pescoço
  p.fill(39, 42, 43, 49, (x, y) => y > 42 + (43 - x) * 0.4 && y < 49 - (43 - x) * 0.3, (x, y) => pick(COW, 0.6 - (y - 42) * 0.05, x, y));
  // cabeça de frente: chifres, orelhas, mancha no olho e focinho rosado
  p.set(34, 37, COW[4]); p.set(35, 38, COW[3]);
  p.set(40, 37, COW[3]); p.set(39, 38, COW[2]);
  p.rect(31, 39, 3, 2, (x, y) => (y === 39 ? SPOT[2] : PINK[1]));
  p.rect(40, 39, 3, 2, (x, y) => (y === 39 ? SPOT[1] : PINK[0]));
  p.fill(33, 38, 41, 48, (x, y) => ((x - 37) / 3.6) ** 2 + ((y - 42.5) / 4.6) ** 2 <= 1, (x, y) => {
    const l = 0.2 + sphereLight((x + 0.5 - 37) / 3.6, (y + 0.5 - 42) / 4.6) * 0.95;
    const patch = ((x - 38.5) / 1.8) ** 2 + ((y - 41) / 2.4) ** 2 <= 1 || y < 39.5;
    return patch ? pick(SPOT, l, x, y) : pick(COW, l + 0.1, x, y);
  });
  p.ellipse(37, 46.3, 3.1, 1.8, (x, y) => pick(PINK, y < 46 ? 0.8 : 0.45 - (x - 35) * 0.04, x, y));
  p.set(35, 46, PINK[0]); p.set(38, 46, PINK[0]);
  p.set(35, 42, SPOT[0]); p.set(38, 42, SPOT[3]);
  p.set(35, 41, COW[5]);
  // sininho no pescoço
  p.rect(36, 48, 3, 1, PAL.band[2]);
  p.rect(36, 49, 3, 2, (x, y) => PAL.gold[x === 36 ? 5 : y === 50 ? 2 : 3]);
}

function buildHorta(p) {
  // couves na fileira de trás, cenouras na do meio, couves maiores na frente
  for (const x of [2, 7, 12]) p.sphere(x, 52, 2.2, 1.6, CABBAGE, 0.05);
  for (const x of [1, 4, 7, 10, 13]) {
    p.set(x, 55, CARROT[2]); p.set(x + 1, 55, CARROT[1]);
    p.set(x, 54, PAL.herb[4]); p.set(x + 1, 53, PAL.herb[3]); p.set(x - 1, 53, PAL.herb[3]);
  }
  for (const x of [3, 9]) {
    p.sphere(x, 59.5, 3, 2.2, CABBAGE, 0.1);
    p.set(x - 1, 59, CABBAGE[4]);
    p.set(x, 60, CABBAGE[1]);
  }
  p.sphere(14.5, 61, 2, 1.6, CABBAGE, 0);
}

function buildFarmstead() {
  const p = new Pix(64, 64);
  buildFarmhouse(p);
  buildFence(p);
  buildHorta(p);
  buildCow(p);
  p.outline(PAL.out);
  return p;
}

// Galinha pequena, desenhada a cada quadro para bicar o chão.
const henPix = new Pix(14, 12);
function paintHen(f, x0, y0, dir, peck, ramp0) {
  const h = henPix.clear();
  const cx = 7, cy = 6;
  const X = (dx) => cx + dx * dir;
  // corpo, rabo e pernas
  h.fill(cx - 3, cy - 2, cx + 3, cy + 2, (x, y) => ((x - cx - 0.5) / 2.8) ** 2 + ((y - cy - 0.5) / 2) ** 2 <= 1, (x, y) =>
    pick(ramp0, 0.2 + sphereLight((x - cx) / 2.8 * dir, (y + 0.5 - cy) / 2) * 1.1, x, y));
  h.set(X(3), cy - 1, ramp0[2]); h.set(X(3), cy - 2, ramp0[3]); h.set(X(4), cy - 2, ramp0[2]); h.set(X(3), cy, ramp0[1]);
  h.set(X(1), cy, ramp0[1]); h.set(X(2), cy + 1, ramp0[1]);
  h.set(cx, cy + 3, BEAK); h.set(X(1), cy + 3, BEAK);
  // cabeça: sobe e desce, bicando
  const hx = cx - dir * (2 + peck * 1.6), hy = cy - 3 + peck * 4;
  h.line(cx - dir, cy - 1, hx, hy + 1, ramp0[3]);
  h.set(hx, hy, ramp0[4]); h.set(hx + dir, hy, ramp0[3]);
  h.set(hx, hy + 1, ramp0[3]); h.set(hx + dir, hy + 1, ramp0[2]);
  h.set(hx, hy - 1, COMB); h.set(hx + dir, hy - 1, COMB);
  h.set(hx - dir, hy + 1, BEAK);
  h.set(hx, hy + 2, COMB);
  h.set(hx, hy, PAL.out);
  h.outline(PAL.out);
  f.blit(h, x0 - cx, y0 - cy);
}

// 0 = cabeça erguida, 1 = bico no chão; duas bicadas por ciclo
function peckAt(t, rate, off) {
  const ph = (t * rate + off) % 1;
  const s = (a, b) => clamp01((ph - a) / (b - a));
  const down = s(0.45, 0.52) - s(0.6, 0.66) + s(0.7, 0.76) - s(0.86, 0.95);
  return down * down * (3 - 2 * down);
}

const farmArt = { bg: null, body: null, clouds: null, tail: new Pix(16, 16), frame: new Pix(64, 64) };

function paintFarmPortrait(ctx, t, info) {
  const a = farmArt;
  if (!a.bg) {
    a.bg = buildFarmBackdrop();
    a.body = buildFarmstead();
    a.clouds = [makeCloud(18, 7, 8), makeCloud(14, 6, 2)];
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 1.3) % 86) - 20), 4);
  f.blit(a.clouds[1], Math.floor(((t * 0.9 + 50) % 82) - 16), 15);
  // fumaça da chaminé
  for (let k = 0; k < 6; k++) {
    const s = (t * (working ? 0.3 : 0.18) + k / 6) % 1;
    const sx = 38.5 + s * 12 + Math.sin(s * 6 + k), sy = 7 - s * 11, r = 1.1 + s * 2.8;
    for (let y = Math.floor(sy - r); y <= sy + r; y++) {
      for (let x = Math.floor(sx - r); x <= sx + r; x++) {
        const dd = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / r;
        if (dd <= 1 && bayer(x, y) < (1 - s) * 1.25 * (1.1 - dd * 0.5)) f.set(x, y, PAL.cloud[dd < 0.5 && y < sy ? 4 : 2]);
      }
    }
  }
  f.blit(a.body, 0, 0);
  // rabo da vaca balançando
  const tp = a.tail.clear();
  const swing = Math.sin(t * (working ? 2.4 : 1.5)) * 0.55 + Math.sin(t * 0.7) * 0.15;
  let px = 4, py = 1;
  for (let k = 0; k < 9; k++) {
    const ang = swing * (k / 9);
    const nx = px + Math.sin(ang) * 1 + 0.12, ny = py + Math.cos(ang) * 1;
    tp.set(nx, ny, k < 7 ? COW[k < 3 ? 3 : 2] : SPOT[1]);
    px = nx; py = ny;
  }
  tp.set(px - 0.6, py, SPOT[2]); tp.set(px + 0.6, py + 0.6, SPOT[0]); tp.set(px, py + 1, SPOT[1]);
  tp.outline(PAL.out);
  f.blit(tp, 55, 42);
  // galinhas ciscando
  const rate = working ? 0.55 : 0.3;
  paintHen(f, 32, 57, -1, peckAt(t, rate, 0), HEN_WHITE);
  paintHen(f, 44, 60, 1, peckAt(t, rate * 0.85, 0.45), HEN_BROWN);
  paintHen(f, 23, 59, 1, peckAt(t, rate * 1.15, 0.7), HEN_BROWN);
  f.draw(ctx);
}

function iconFarmstead() {
  const p = new Pix(16, 16);
  p.rect(2, 8, 12, 7, (x, y) => stoneWall(x * 2, y * 2, 0.6 - (x - 2) * 0.03));
  p.rect(2, 8, 12, 2, (x, y) => PAL.wood[y === 8 ? 2 : 3]);
  p.rect(6, 11, 3, 4, PAL.wood[2]);
  p.rect(10, 10, 2, 2, PAL.glass);
  p.poly([[0, 9], [3.5, 2], [12.5, 2], [16, 9]], (x, y) => pick(PAL.roof, 0.75 - (x - 2) * 0.03 - (y % 2 ? 0.2 : 0), x, y));
  p.rect(11, 0, 2, 3, (x) => PAL.stone[x === 11 ? 4 : 2]);
  for (const x of [1, 5, 9, 13]) p.rect(x, 12, 1, 4, PAL.wood[4]);
  p.rect(0, 13, 16, 1, PAL.wood[3]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Aldeia

const THATCH = ramp('#3a2812', '#644520', '#8e6a2c', '#b48f40', '#d4b460', '#ecd48c');
const PLASTER = ramp('#5a4a44', '#8a7464', '#b49c84', '#d6c0a2', '#eedcbe');
const CLOTHES = [[PAL.linen[4], PAL.linen[3]], [C('#4a78b0'), C('#2f5a8c')], [C('#c84a3a'), C('#a83a2c')]];
const LOG_END = C('#c9a070');

// Casas da aldeia: [x, y do topo do telhado, largura, altura do telhado, altura da parede, semente]
const HUTS = [
  [3, 10, 18, 9, 5, 1],
  [42, 8, 19, 9, 5, 2],
  [1, 40, 22, 11, 6, 3],
  [41, 42, 22, 11, 6, 4],
];
const chimneyOf = ([x, y, w, , , seed]) => [x + Math.round(w * (seed % 2 ? 0.7 : 0.28)), y];
const WELL = [32, 37];
const TREES = [[31, 13, 5], [5, 31, 4.5], [60, 36, 4], [57, 60, 3.5]];

function buildVillageBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 9, PAL.sky, 2);
  // mata ao longe
  for (let x = 0; x < 64; x++) {
    const top = 4 + Math.round(1.6 * Math.sin(x * 0.45) + Math.sin(x * 1.2 + 2));
    for (let y = top; y < 12; y++) p.set(x, y, pick(PAL.tree, 0.5 - (y - top) * 0.07 + (hash(x, y, 31) - 0.5) * 0.3, x, y));
  }
  // grama, mais escura ao longe
  for (let y = 10; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.58 + (y - 10) * 0.003 + (hash(x, y, 32) - 0.5) * 0.22;
      if (hash(x, y, 33) < 0.05) v += 0.2;
      if ((x * 5 + y * 3) % 13 === 0) v -= 0.14;
      p.set(x, y, pick(PAL.grass, v, x, y, 1.6));
    }
  }
  // caminhos de terra: praça em volta do poço, saída para baixo e trilhas para as casas
  const [wx, wy] = WELL;
  const onPath = (x, y) => {
    if (((x - wx) / 15) ** 2 + ((y - wy - 2) / 8) ** 2 <= 1) return true;
    const c = 31 + (y - 44) * 0.2 + Math.sin(y * 0.3) * 1.2;
    if (y > 42 && Math.abs(x - c) < 3 + (y - 44) * 0.08) return true;
    if (y > 14 && y < 34 && Math.abs(x - (24 - (y - 34) * 0.35)) < 1.6) return true;
    if (y > 20 && y < 34 && Math.abs(x - (44 + (y - 34) * 0.3)) < 1.6) return true;
    if (y > 47 && y < 53 && x > 10 && x < 30 && Math.abs(y - 50 + (x - 20) * 0.05) < 1.4) return true;
    return y > 50 && y < 56 && x > 33 && x < 54 && Math.abs(y - 53 + (x - 44) * 0.04) < 1.4;
  };
  p.fill(0, 10, 63, 63, onPath, (x, y) => {
    let v = 0.55 + (hash(x, y, 34) - 0.5) * 0.35;
    if (!onPath(x - 1, y) || !onPath(x, y - 1)) v -= 0.25;
    if (hash(x, y, 35) < 0.04) v += 0.3;
    return pick(PAL.dirt, v, x, y);
  });
  // sombras das casas, das árvores e do poço no chão
  const shade = (x0, y0, x1, y1) => p.fill(x0, y0, x1, y1, () => true, (x, y) => {
    const c = p.get(x, y);
    const g = PAL.grass.indexOf(c), d = PAL.dirt.indexOf(c);
    return g > 0 ? PAL.grass[Math.max(0, g - 2)] : d > 0 ? PAL.dirt[Math.max(0, d - 2)] : 0;
  });
  for (const [x, y, w, rh, wh] of HUTS) shade(x + 3, y + rh + wh - 1, x + w + 1, y + rh + wh + 1);
  shade(27, 43, 40, 44);
  for (const [x, y, r] of TREES) p.fill(x - r + 1, y + r - 1, x + r + 2, y + r + 2, (xx, yy) => ((xx - x - 1.5) / r) ** 2 + ((yy - y - r - 0.5) / 1.8) ** 2 <= 1, (xx, yy) => {
    const g = PAL.grass.indexOf(p.get(xx, yy));
    return g > 0 ? PAL.grass[Math.max(0, g - 2)] : 0;
  });
  // flores
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(hash(i, 1, 36) * 64), y = 14 + Math.floor(hash(i, 2, 36) * 50);
    if (!onPath(x, y)) p.set(x, y, C(['#f4e9d0', '#e0644c', '#f3d47c', '#b9a2e0'][i % 4]));
  }
  return p;
}

function drawTree(p, x, y, r, seed) {
  p.rect(Math.round(x) - 1, Math.round(y + r - 2), 2, 4, (xx) => PAL.wood[xx < x ? 3 : 1]);
  p.fill(x - r, y - r, x + r, y + r, (xx, yy) => {
    const n = hash(Math.floor(Math.atan2(yy - y, xx - x) * 3), 0, seed) * 0.12;
    return ((xx - x) / r) ** 2 + ((yy - y) / (r * 0.92)) ** 2 <= 1 - n;
  }, (xx, yy) => {
    let v = 0.1 + sphereLight((xx + 0.5 - x) / r, (yy + 0.5 - y) / r) * 1.05;
    if (hash(xx, yy, seed) < 0.18) v -= 0.22;
    if (hash(xx, yy, seed + 1) < 0.06) v += 0.2;
    return pick(PAL.tree, v, xx, yy, 1.6);
  });
}

// Casinha de taipa com telhado de palha, vista um pouco de cima.
function drawHut(p, [x0, y0, w, rh, wh, seed]) {
  const cx = x0 + w / 2;
  const wy = y0 + rh - 1;
  // parede da frente com enxaimel, porta e janela
  p.rect(x0 + 1, wy, w - 2, wh, (x, y) => pick(PLASTER, 0.75 - (x - x0) * 0.012 + (hash(x, y, seed) - 0.5) * 0.14 - (y === wy ? 0.3 : 0), x, y));
  for (const x of [x0 + 1, x0 + w - 2, Math.round(cx) + (seed % 2 ? -3 : 2)]) p.rect(x, wy, 1, wh, PAL.wood[1]);
  const door = Math.round(cx) + (seed % 2 ? 1 : -4);
  p.rect(door, wy + wh - 4, 3, 4, (x, y) => PAL.wood[x === door ? 3 : 2]);
  p.set(door + 2, wy + wh - 2, PAL.gold[3]);
  const win = Math.round(cx) + (seed % 2 ? -7 : 5);
  p.rect(win, wy + 1, 2, 2, PAL.glass);
  p.set(win, wy + 1, PAL.glassHi);
  p.rect(win - 1, wy + 3, 4, 1, PAL.wood[3]);
  // telhado de palha arredondado
  const hip = w * 0.2;
  const inRoof = (x, y) => {
    const f = (y - y0) / rh;
    if (f < 0 || f > 1) return false;
    const inset = hip * (1 - f) * (1 - f) + (f < 0.18 ? (0.18 - f) * 12 : 0);
    const lip = f > 0.86 ? (f - 0.86) * 8 : 0;
    return x >= x0 + inset + lip * (x < cx ? 1 : 0) && x <= x0 + w - inset - lip * (x > cx ? 1 : 0);
  };
  p.fill(x0, y0, x0 + w, y0 + rh, inRoof, (x, y) => {
    const nx = (x + 0.5 - cx) / (w / 2);
    let v = 0.62 - nx * 0.28 + (hash(x, Math.floor((y - y0) / 3), seed + 5) - 0.5) * 0.3;
    if ((x + Math.floor((y - y0) / 3) * 2) % 3 === 0) v -= 0.12;
    if ((y - y0) % 3 === 2) v -= 0.1;
    if (y - y0 < 2) v -= 0.12 + ((x + y) % 2) * 0.1; // cumeeira amarrada
    if (y === y0 + rh - 1) v -= 0.35;
    else if (y === y0 + rh - 2) v += 0.15;
    if (!inRoof(x - 1, y)) v += 0.15;
    if (!inRoof(x + 1, y)) v -= 0.2;
    return pick(THATCH, v, x, y, 2);
  });
  // chaminé de pedra
  const [chx, chy] = chimneyOf([x0, y0, w, rh, wh, seed]);
  p.rect(chx - 1, chy - 2, 3, 4, (x, y) => PAL.stone[x === chx - 1 ? 4 : x === chx ? 3 : 1]);
  p.set(chx, chy - 2, PAL.out);
}

function drawWell(p) {
  const [cx, cy] = WELL;
  const rx = 6.4, ry = 2.8;
  // poço de pedra: corpo cilíndrico e a borda em elipse
  const inTop = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const inBody = (x, y) => Math.abs(x - cx) < rx && y >= cy && (y <= cy + 4 || ((x - cx) / rx) ** 2 + ((y - cy - 4) / ry) ** 2 <= 1);
  p.fill(cx - 7, cy - 3, cx + 7, cy + 7, (x, y) => inTop(x, y) || inBody(x, y), (x, y) => {
    if (inTop(x, y)) {
      return pick(PAL.stone, 0.74 - (x - cx) * 0.035 + (hash(x, y, 39) - 0.5) * 0.2 - ((x + y * 2) % 4 === 0 ? 0.15 : 0), x, y);
    }
    const row = Math.floor((y - cy) / 2), off = (row % 2) * 2;
    let v = 0.1 + cylLight((x + 0.5 - cx) / rx) * 0.75 + (hash(Math.floor((x + off) / 3), row, 37) - 0.5) * 0.2;
    if ((x + off) % 3 === 0 || (y - cy) % 2 === 1) v -= 0.15;
    return pick(PAL.stone, v, x, y);
  });
  // boca escura com a água lá no fundo
  p.ellipse(cx, cy, 4.6, 1.7, (x, y) => (y < cy ? DARK[0] : DARK[1]));
  p.rect(cx + 1, cy, 2, 1, PAL.water[1]);
  // telhadinho de palha (os postes e o sarilho vêm depois do contorno)
  p.poly([[cx - 7.5, cy - 9.5], [cx - 4, cy - 14], [cx + 4, cy - 14], [cx + 7.5, cy - 9.5]], (x, y) => {
    let v = 0.64 - (x - cx) * 0.05 + (hash(x, y, 38) - 0.5) * 0.2;
    if ((x + y) % 3 === 0) v -= 0.12;
    if (y === cy - 10) v -= 0.3;
    return pick(THATCH, v, x, y);
  });
}

function drawWellFrame(p) {
  const [cx, cy] = WELL;
  for (const [x, d] of [[cx - 6, -1], [cx + 5, 1]]) {
    p.rect(x, cy - 8, 1, 9, PAL.wood[d < 0 ? 3 : 1]);
    p.rect(x + d, cy - 8, 1, 8, PAL.out);
  }
  p.rect(cx - 5, cy - 8, 10, 1, (x) => PAL.wood[x % 2 ? 4 : 3]);
  p.rect(cx - 1, cy - 8, 3, 1, PAL.straw[3]);
  p.set(cx + 7, cy - 8, PAL.wood[2]);
}

function buildVillage() {
  const p = new Pix(64, 64);
  drawTree(p, ...TREES[0], 41);
  drawHut(p, HUTS[0]);
  drawHut(p, HUTS[1]);
  drawTree(p, ...TREES[1], 42);
  drawTree(p, ...TREES[2], 43);
  // varal: postes e a corda com barriga
  for (const [x, y] of [[43, 27], [57, 30]]) p.rect(x, y - 6, 1, 7, (xx, yy) => PAL.wood[yy % 2 ? 3 : 2]);
  for (let x = 44; x < 57; x++) p.set(x, 21.5 + (x - 43) * 0.21 + Math.sin(((x - 43) / 14) * Math.PI) * 2, PAL.linen[1]);
  drawWell(p);
  // lenha empilhada e barril
  p.rect(21, 18, 7, 6, PAL.wood[1]);
  for (let i = 0; i < 7; i++) {
    const x = 21 + (i % 4) * 2 + (i > 3 ? 1 : 0), y = i > 3 ? 18 : 21;
    p.rect(x, y, 2, 2, (xx, yy) => (xx === x && yy === y ? PAL.wood[4] : LOG_END));
    p.set(x + 1, y + 1, PAL.wood[2]);
  }
  p.rect(38, 54, 3, 4, (x, y) => PAL.wood[y === 55 || y === 57 ? 1 : x === 38 ? 4 : 3]);
  drawHut(p, HUTS[2]);
  drawHut(p, HUTS[3]);
  drawTree(p, ...TREES[3], 44);
  p.outline(PAL.out);
  drawWellFrame(p);
  return p;
}

// Aldeão pequeno andando pela trilha, com um balde na mão.
const walker = new Pix(9, 10);
function paintVillager(f, x, y, dir, step, ramp0) {
  const m = walker.clear();
  const cx = 4, foot = 8;
  const swing = step > 0.35 ? 1 : step < -0.35 ? -1 : 0;
  m.set(cx - 1 + swing, foot, PAL.wood[1]);
  m.set(cx + 1 - swing, foot, PAL.wood[0]);
  m.set(cx - 1 + Math.round(swing / 2), foot - 1, PAL.vest[2]);
  m.set(cx + 1 - Math.round(swing / 2), foot - 1, PAL.vest[1]);
  m.rect(cx - 1, foot - 4, 3, 3, (xx, yy) => ramp0[xx === cx - dir ? 2 : yy === foot - 4 ? 4 : 3]);
  m.set(cx, foot - 2, PAL.leather[1]);
  m.rect(cx - 1, foot - 5, 3, 1, (xx) => (xx === cx - dir ? PAL.hair[3] : PAL.skin[xx === cx ? 4 : 3]));
  m.rect(cx - 1, foot - 6, 3, 1, (xx) => PAL.hair[xx === cx - dir ? 2 : 3]);
  // balde na mão
  m.set(cx + dir * 2, foot - 3, PAL.iron[2]);
  m.set(cx + dir * 2, foot - 2, PAL.wood[3]);
  m.set(cx + dir * 3, foot - 2, PAL.wood[2]);
  m.outline(PAL.out);
  f.blit(m, x - cx, y - foot);
}

function paintSmokePuffs(f, t, x0, y0, seed, speed) {
  for (let k = 0; k < 5; k++) {
    const s = (t * speed + k / 5 + seed * 0.31) % 1;
    const sx = x0 + s * 7 + Math.sin(s * 6 + k + seed) * 0.8, sy = y0 - s * 9, r = 0.8 + s * 2;
    for (let y = Math.floor(sy - r); y <= sy + r; y++) {
      for (let x = Math.floor(sx - r); x <= sx + r; x++) {
        const dd = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / r;
        if (dd <= 1 && bayer(x, y) < (1 - s) * 1.1 * (1.1 - dd * 0.5)) f.set(x, y, PAL.cloud[dd < 0.5 && y < sy ? 4 : 2]);
      }
    }
  }
}

const villageArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintVillagePortrait(ctx, t, info) {
  const a = villageArt;
  if (!a.bg) {
    a.bg = buildVillageBackdrop();
    a.body = buildVillage();
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.body, 0, 0);
  // fumaça das chaminés
  HUTS.forEach((h, i) => {
    const [x, y] = chimneyOf(h);
    paintSmokePuffs(f, t, x, y - 3, i, working ? 0.3 : 0.18);
  });
  // roupa no varal balançando
  const sag = (x) => 21.5 + (x - 43) * 0.21 + Math.sin(((x - 43) / 14) * Math.PI) * 2;
  [[45, 4, 5, 0], [50, 3, 4, 1], [54, 2, 3, 2]].forEach(([x0, w, h, i]) => {
    const sway = Math.sin(t * (working ? 2.6 : 1.7) + i * 1.1) * 1.3;
    for (let r = 0; r < h; r++) {
      const dx = Math.round(sway * ((r + 1) / h));
      for (let c = 0; c < w; c++) {
        const top = Math.round(sag(x0 + c)) + 1;
        f.set(x0 + c + dx, top + r, CLOTHES[i][r === 0 || c === 0 ? 0 : 1]);
      }
    }
    f.set(x0 + 1, Math.round(sag(x0 + 1)), PAL.wood[3]);
  });
  // balde subindo e descendo no poço
  const [wx, wy] = WELL;
  const depth = 0.5 - 0.5 * Math.cos(t * (working ? 0.9 : 0.5));
  const by = wy - 6 + depth * 7;
  const front = (x) => wy + 1.7 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - wx) / 4.6) ** 2));
  for (let y = wy - 7; y < by; y++) f.set(wx, y, PAL.straw[3]);
  for (let dx = -1; dx <= 1; dx++) {
    for (let r = 0; r < 3; r++) {
      const x = wx + dx, y = Math.round(by) + r;
      if (y + 0.5 > front(x) && y > wy - 1) continue;
      f.set(x, y, r === 0 ? PAL.iron[3] : r === 2 ? PAL.wood[1] : PAL.wood[dx < 0 ? 4 : 3]);
    }
  }
  // manivela girando junto
  const ang = depth * 9;
  f.set(wx + 8 + Math.round(Math.cos(ang) * 1.2), wy - 8 + Math.round(Math.sin(ang) * 1.6), PAL.iron[4]);
  // aldeão indo até a praça e voltando pela trilha
  const u = 0.5 - 0.5 * Math.cos(t * 0.22);
  const dir = Math.sin(t * 0.22) > 0 ? -1 : 1;
  const vx = 34 - u * 6, vy = 63 - u * 16;
  const moving = Math.abs(Math.sin(t * 0.22)) > 0.08;
  paintVillager(f, vx, vy, dir, moving ? Math.sin(t * 7) : 0, PAL.hood);
  f.draw(ctx);
}

function iconVillage() {
  const hut = (x0, y0, w, rh, wh) => {
    const q = new Pix(16, 16);
    q.rect(x0 + 1, y0 + rh - 1, w - 2, wh, (x, y) => PLASTER[x === x0 + 1 ? 4 : y === y0 + rh - 1 ? 2 : 3]);
    const door = x0 + Math.floor(w / 2) - 1;
    q.rect(door, y0 + rh + wh - 4, 2, 3, (x) => PAL.wood[x === door ? 2 : 1]);
    q.set(x0 + 2, y0 + rh, PAL.glass);
    q.fill(x0, y0, x0 + w, y0 + rh, (x, y) => {
      const f = (y - y0 + 0.5) / rh;
      const inset = (1 - f) * (1 - f) * w * 0.32 + (f < 0.25 ? 1 : 0);
      return x >= x0 + inset && x <= x0 + w - inset;
    }, (x, y) => {
      let v = 0.78 - (x - x0) / w * 0.4;
      if ((y - y0) % 2 === 1) v -= 0.12;
      if (y === y0 + rh - 1) v -= 0.3;
      return pick(THATCH, v, x, y);
    });
    q.outline(PAL.out);
    return q;
  };
  const p = new Pix(16, 16);
  p.blit(hut(7, 1, 9, 6, 3), 0, 0);
  p.blit(hut(0, 5, 12, 7, 4), 0, 0);
  return p;
}

ART.portraits.barn = paintBarnPortrait;
ART.locked.barn = ART.silhouette(() => {
  const p = buildBarn();
  paintVane(p, 0, false);
  return p;
});
ART.icons.barn = iconBarn;
ART.portraits.farmstead = paintFarmPortrait;
ART.locked.farmstead = ART.silhouette(buildFarmstead);
ART.icons.farmstead = iconFarmstead;
ART.portraits.village = paintVillagePortrait;
ART.locked.village = ART.silhouette(buildVillage);
ART.icons.village = iconVillage;
})();
