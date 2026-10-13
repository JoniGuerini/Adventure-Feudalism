'use strict';
// Linha da EXPLORAÇÃO, tiers 11 a 15: Expedição, Farol, Colônia, Descobridor e
// Novo Mundo. Retratos de céu aberto, mar e mata, com ícones e silhuetas.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

const WHITE = C('#ffffff');
// montanha nevada
const SNOW = ramp('#3a4664', '#556388', '#7787ab', '#9dadca', '#c3d1e3', '#e3ebf4', '#ffffff');
const ICE_SKY = ramp('#34558a', '#44679b', '#587dad', '#7397bf', '#91b1d1', '#b4cce1', '#d8e6ef');
const FAR_ICE = ramp('#62759a', '#788cae', '#90a3c1', '#abbdd3', '#c8d5e4', '#e2eaf3');
const MID_ROCK = ramp('#3c4562', '#4c5674', '#5e6886', '#727c98');
const ROCK = ramp('#16131d', '#25212d', '#383241', '#4e4656', '#685e6e', '#857a88');
const COLD_CLOUD = ramp('#8e9ebb', '#adbdd2', '#cdd8e5', '#e8eef4', '#fbfdff');
const COAT_RED = ramp('#3e1016', '#6c1c22', '#9c3029', '#c44f37', '#e27a50');
const COAT_BLUE = ramp('#121b38', '#1f3058', '#304a78', '#47689a', '#6c8ebc');
const COAT_OCHRE = ramp('#3a220e', '#664016', '#925e22', '#ba8232', '#daa850');
const COAT_GREEN = ramp('#10251a', '#1d3c28', '#2d5838', '#45764a', '#669a62');
const FUR = ramp('#5e4a3a', '#8e7660', '#bea68a', '#e6d6bc');
const PACK = ramp('#2a1c12', '#4c341f', '#76552f', '#9c7843', '#c09a5e');
const ROLL_GRAY = ramp('#2e2c34', '#4c4a56', '#706e7a', '#9896a0');
const ROLL_RED = ramp('#3e1418', '#6a2026', '#94343a', '#ba5450');
const WOOL = ramp('#1e1a20', '#353036', '#4e474e', '#686066');
const BOOT = ramp('#140d0a', '#2a1a12', '#432a1c');
const FLAG_RED = ramp('#3e0c12', '#6e1820', '#a2282c', '#cc403a', '#ea6650');

// ---------------------------------------------------------------------------
// Peças comuns

// Ruído suave: valores do hash numa grade de passo s, interpolados.
function vnoise(x, y, s, seed) {
  const gx = Math.floor(x / s), gy = Math.floor(y / s);
  const fx = x / s - gx, fy = y / s - gy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(gx, gy, seed), b = hash(gx + 1, gy, seed), c = hash(gx, gy + 1, seed), d = hash(gx + 1, gy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Mistura uma cor do buffer (0xAABBGGRR) com outra em hex, na fração f.
function mixC(c, hex, f) {
  const t = C(hex);
  const ch = (s) => Math.round(((c >> s) & 255) + (((t >> s) & 255) - ((c >> s) & 255)) * f) << s;
  return ((255 << 24) | ch(16) | ch(8) | ch(0)) >>> 0;
}

// Envelope suave de um evento periódico: 0 fora da janela, sobe e desce dentro dela.
function pulse(t, period, offset, length) {
  const ph = (((t + offset) % period) + period) % period;
  return ph < length ? Math.sin((ph / length) * Math.PI) : 0;
}

// Desenho a partir de linhas de texto; color(ch, i, j) devolve a cor de cada letra.
function paintRows(p, rows, x0, y0, color) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== '.') p.set(x0 + i, y0 + j, color(ch, i, j));
  }));
}

// Nuvem de fumaça, névoa ou espuma: círculo pontilhado que rareia na borda.
function puff(f, cx, cy, r, dens, hi, lo) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (dd <= 1 && bayer(x, y) < dens * (1.1 - dd * 0.6)) f.set(x, y, dd < 0.5 && y < cy ? hi : lo);
    }
  }
}

// Bandeira presa no mastro: guarda rampa e valor de cada pixel. A cada quadro as
// colunas ondulam, mais longe do mastro, e dobras de luz correm pelo pano.
function makeFlag(w, h, paint) {
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
  const amp = 2;
  return { w, h, ramps, kind, val, amp, buf: new Pix(w + 3, h + amp * 2 + 3) };
}

// (px, py): topo do mastro; dir 1 tremula para a direita, -1 para a esquerda.
function paintFlag(f, fl, px, py, dir, t, amp, speed) {
  const b = fl.buf.clear();
  const oy = fl.amp + 1;
  for (let i = 0; i < fl.w; i++) {
    const k = (i + 1) / fl.w;
    const ph = t * speed - i * 0.62;
    const dy = Math.round(Math.sin(ph) * amp * k + k * k * 0.8);
    const fold = Math.cos(ph) * 0.22 * (0.3 + k);
    const bx = dir > 0 ? i + 1 : b.w - 2 - i;
    for (let j = 0; j < fl.h; j++) {
      const n = j * fl.w + i, ri = fl.kind[n];
      if (ri >= 0) b.set(bx, oy + j + dy, pick(fl.ramps[ri], fl.val[n] + fold, i, j));
    }
  }
  b.outline(PAL.out);
  f.blit(b, dir > 0 ? px : px - b.w + 1, py - oy);
}

// Estrelinha de brilho que cresce e some (e de 0 a 1).
function sparkle(f, x, y, e, c = WHITE) {
  if (e <= 0.08) return;
  const arm = Math.round(e * 2.2);
  f.set(x, y, c);
  for (let k = 1; k <= arm; k++) {
    const cc = k === arm ? PAL.gold[5] : c;
    f.set(x + k, y, cc); f.set(x - k, y, cc); f.set(x, y + k, cc); f.set(x, y - k, cc);
  }
}

// Gaivota vista de longe: asas em M batendo (flap de -1 a 1).
function paintGull(f, x, y, flap, c, wing = c) {
  x = Math.round(x); y = Math.round(y);
  f.set(x, y, c);
  for (const d of [-1, 1]) {
    if (flap > 0.35) { f.set(x + d, y - 1, wing); f.set(x + d * 2, y - 2, wing); }
    else if (flap < -0.35) { f.set(x + d, y, wing); f.set(x + d * 2, y + 1, wing); }
    else { f.set(x + d, y - 1, wing); f.set(x + d * 2, y - 1, wing); f.set(x + d * 3, y, wing); }
  }
}

// ---------------------------------------------------------------------------
// Expedição

const EXP_X = [8, 19, 30, 41]; // pé de cada explorador, de baixo para cima
const expCrest = (x) => (x <= 50 ? 57.5 - x * 0.82 : 16.5 + (x - 50) * 0.95) + Math.sin(x * 0.9) * 0.45;
const expPath = (x) => Math.round(58.6 - x * 0.82);
const expArete = (y) => 50 + (y - 16.5) * 0.26; // aresta entre a face ao sol e a face na sombra
const EXP_POLE = EXP_X[3] + 5;

// Cordilheira: picos [x, y, inclinação à esquerda, à direita]. Face esquerda ao sol.
function paintRange(p, peaks, snowR, rockR, seed, capMin, capVar) {
  for (let x = 0; x < 64; x++) {
    let top = Infinity, lit = true;
    for (const [px, py, sl, sr] of peaks) {
      const y = py + (x < px ? (px - x) * sl : (x - px) * sr);
      if (y < top) { top = y; lit = x < px; }
    }
    top += (hash(x, 0, seed) - 0.5) * 0.8;
    const cap = capMin + vnoise(x, 0, 4, seed) * capVar;
    for (let y = Math.max(0, Math.ceil(top)); y < 64; y++) {
      const d = y - top;
      const n = (hash(x, y, seed + 1) - 0.5) * 0.1;
      const gully = ((x * 2 + (lit ? 1 : -1) * y * 1.3 + 640) % 7) < 1.3;
      if (d < cap + (hash(x >> 1, y >> 1, seed + 2) - 0.5) * 3 || (gully && d < cap * 2.2)) {
        p.set(x, y, pick(snowR, (lit ? 0.84 : 0.42) - d * 0.025 + n + (d < 1 ? 0.12 : 0), x, y, 2));
      } else {
        p.set(x, y, pick(rockR, (lit ? 0.62 : 0.3) - (d - cap) * 0.025 + n, x, y, 2));
      }
    }
  }
}

function buildExpeditionBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 64, ICE_SKY, 1.6);
  // sol pálido atrás da névoa alta
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 24; x++) {
      const d = Math.hypot(x + 0.5 - 11, y + 0.5 - 9);
      if (d < 2.8) p.set(x, y, d < 1.6 ? WHITE : C('#f3f1e4'));
      else if (d < 6.5 && bayer(x, y) < (1 - (d - 2.8) / 3.7) * 0.5) p.set(x, y, ICE_SKY[6]);
    }
  }
  // cordilheira ao longe, um banco de névoa e a serra mais perto
  paintRange(p, [[3, 32, 0.9, 1], [15, 24, 0.95, 0.8], [28, 31, 0.8, 0.9], [38, 27, 0.85, 1], [58, 22, 1, 1]], FAR_ICE, FAR_ICE.slice(1, 4), 3, 4, 5);
  for (let y = 36; y < 48; y++) {
    for (let x = 0; x < 64; x++) {
      const n = vnoise(x, y * 2, 6, 7) - Math.abs(y - 41) * 0.06;
      if (n > 0.45 && bayer(x, y) < (n - 0.45) * 3) p.set(x, y, n > 0.62 ? COLD_CLOUD[4] : COLD_CLOUD[3]);
    }
  }
  paintRange(p, [[-3, 42, 1, 0.9], [12, 39, 0.85, 1.1], [26, 47, 1, 1]], SNOW, MID_ROCK, 5, 3, 4);
  return p;
}

// Penhasco de pedra num polígono: a aresta de (top) até (foot) separa a face ao
// sol da face na sombra; neve nas bordas de cima e nas saliências.
function crag(p, pts, top, foot, lit, seed) {
  const inside = [];
  p.poly(pts, (x, y) => { inside.push(x + y * 64); return 0; });
  const set = new Set(inside);
  const ridge = (y) => top[0] + (foot[0] - top[0]) * clamp01((y - top[1]) / (foot[1] - top[1]));
  for (const i of inside) {
    const x = i % 64, y = (i / 64) | 0;
    if (!set.has(i - 64) || (!set.has(i - 128) && hash(x, y, seed) < 0.6)) { p.set(x, y, SNOW[x + 0.5 < ridge(y) ? 6 : 4]); continue; }
    const sunny = x + 0.5 < ridge(y);
    let v = (sunny ? lit : lit - 0.32) + (hash(x >> 1, y >> 2, seed) - 0.5) * 0.16;
    if (!set.has(i - 1)) v += 0.15;
    if ((y + (x >> 2)) % 5 === 0) { // saliências com neve
      if (sunny && hash(x >> 1, y, seed + 1) < 0.45) { p.set(x, y, SNOW[5]); continue; }
      v -= 0.12;
    }
    p.set(x, y, pick(ROCK, v, x, y, 2));
  }
}

// Montanha principal: face ao sol, face na sombra, rochas e a trilha de pegadas.
function buildExpeditionMountain(p) {
  const bump = (x, y) => vnoise(x, y, 9, 21);
  p.fill(0, 10, 63, 63, (x, y) => y >= expCrest(x), (x, y) => {
    const d = y + 0.5 - expCrest(x + 0.5);
    const shade = x + 0.5 > expArete(y + 0.5);
    // montes de neve: claros do lado de cima à esquerda
    const g = (bump(x - 1.5, y - 1.5) - bump(x + 1.5, y + 1.5)) * 1.9;
    let v = shade ? 0.38 - d * 0.003 + g * 0.5 : 0.7 - d * 0.006 + g;
    // ondas de neve esculpidas pelo vento
    const rip = (x * 0.9 + y * 1.7 + Math.sin(x * 0.35 + y * 0.2) * 2.2 + 600) % 7;
    if (rip < 1) v -= 0.1;
    else if (rip < 2) v += 0.04;
    if (d < 1.4) v += shade ? 0.15 : 0.35; // cornija
    else if (!shade && d < 3.2) v -= 0.2; // sombra da cornija
    if (!shade && x + 0.5 > expArete(y + 0.5) - 1.5) v += 0.12;
    return pick(SNOW, v, x, y, 2.2);
  });
  // penhascos aflorando na neve
  crag(p, [[30, 64], [33, 52], [37, 47], [40, 45], [43, 49], [46, 50], [49, 64]], [40, 45], [44, 64], 0.62, 23);
  crag(p, [[0, 64], [0, 59], [4, 57], [8, 59], [11, 64]], [4, 57], [7, 64], 0.66, 24);
  crag(p, [[53, 39], [56, 32], [59, 30], [62, 34], [64, 33], [64, 45], [58, 46]], [59, 30], [61, 46], 0.6, 25);
  crag(p, [[18, 64], [21, 60], [24, 59], [26, 64]], [22, 60], [23, 64], 0.6, 26);
  // sombra azulada de cada explorador na neve
  for (const ex of EXP_X) {
    const y = expPath(ex) + 1;
    for (let x = ex - 3; x <= ex + 5; x++) p.set(x, y - Math.round((x - ex) * 0.82), x > ex + 2 ? SNOW[3] : SNOW[2]);
  }
  // pegadas atrás dos exploradores
  for (let x = 0; x < EXP_X[3]; x += 3) {
    const y = expPath(x);
    p.set(x, y, SNOW[2]);
    p.set(x + 1, y, SNOW[3]);
  }
}

// Explorador de lado subindo para a direita, curvado para a frente, com a mochila,
// o colchonete enrolado em cima e o cajado.
const CLIMBER_TOP = [
  '..rRRRRr.....',
  '..rrrrrr.hH..',
  '...PPPp.hHHF.',
  '...pPPpshFKK.',
  '...sgssshfKk.',
  '...pPPpsCHh..',
  '..pPPPpsHHhhM',
  '..ppPPpsHHhd.',
  '...ppp.dHhhd.',
  '.......dhhhd.',
  '.......dhhd..',
];
const CLIMBER_LEGS = [
  ['......lLLL...', '.....ll..LL..', '....ll....LL.', '...bB.....bB.', '..bBB.....bBB'],
  ['.......lLL...', '.......lLL...', '.......llLL..', '.......bbBB..', '......bbbBBB.'],
  ['......LLll...', '.....LL..ll..', '....LL....ll.', '...BB.....bb.', '..BBB.....bbb'],
];

function buildClimber(coat, roll, step, staff) {
  const p = new Pix(15, 17);
  const colors = {
    r: roll[1], R: roll[2], p: PACK[1], s: PAL.leather[1], g: PAL.gold[4],
    d: coat[1], h: coat[2], H: coat[3], C: coat[4], F: FUR[3], f: FUR[1],
    K: PAL.skin[4], k: PAL.skin[2], l: WOOL[1], L: WOOL[3], b: BOOT[0], B: BOOT[2], M: PAL.leather[2],
  };
  if (staff) p.line(13, 3, 14, 16, (x, y) => PAL.wood[y < 8 ? 4 : 3]);
  paintRows(p, CLIMBER_TOP, 1, 1, (ch, i, j) => {
    if (ch === 'P') return PACK[j < 3 ? 4 : i <= 3 ? 3 : 2];
    if (ch === 'R') return roll[i % 2 ? 3 : 2];
    return colors[ch];
  });
  paintRows(p, CLIMBER_LEGS[step], 1, 12, (ch) => colors[ch]);
  p.outline(PAL.out);
  return p;
}

function buildExpFlag() {
  const w = 12, h = 7;
  const star = ['..x..', '..x..', 'xxxxx', '.xxx.', '.x.x.'];
  return makeFlag(w, h, (put) => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (i >= w - 3 && Math.abs(j - 3) < i - (w - 4)) continue; // rabo de andorinha
        put(i, j, FLAG_RED, 0.62 - j * 0.04 + (j === 0 ? 0.15 : 0));
      }
    }
    paintRows({ set: (i, j) => put(i, j, PAL.gold, 0.85 - (j - 1) * 0.08) }, star, 3, 1, () => 1);
  });
}

const EXP_COATS = [[COAT_GREEN, ROLL_GRAY], [COAT_OCHRE, ROLL_RED], [COAT_BLUE, ROLL_GRAY], [COAT_RED, ROLL_RED]];

function buildExpedition() {
  const p = new Pix(64, 64);
  buildExpeditionMountain(p);
  // mastro da bandeira do líder
  p.rect(EXP_POLE, 2, 1, expPath(EXP_X[3]) - 1, (x, y) => PAL.wood[y % 5 === 0 ? 2 : 4]);
  p.rect(EXP_POLE + 1, 2, 1, expPath(EXP_X[3]) - 1, PAL.wood[1]);
  p.outline(PAL.out);
  p.sphere(EXP_POLE + 0.5, 1.5, 1.3, 1.3, PAL.gold, 0.1);
  return p;
}

// Silhueta: montanha, exploradores parados e a bandeira em repouso.
function buildExpeditionSil() {
  const p = buildExpedition();
  EXP_X.forEach((x, i) => p.blit(buildClimber(EXP_COATS[i][0], EXP_COATS[i][1], 0, i < 3), x - 8, expPath(x) - 16));
  p.rect(EXP_POLE + 1, 2, 11, 7, PAL.out);
  return p;
}

const expArt = { bg: null, body: null, climbers: null, flag: null, cloud: null, frame: new Pix(64, 64) };

function paintExpeditionPortrait(ctx, t, info) {
  const a = expArt;
  if (!a.bg) {
    a.bg = buildExpeditionBackdrop();
    a.body = buildExpedition();
    a.climbers = EXP_COATS.map(([coat, roll], i) => [0, 1, 2].map((s) => buildClimber(coat, roll, s, i < 3)));
    a.flag = buildExpFlag();
    a.cloud = makeCloud(18, 7, 4, COLD_CLOUD);
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.cloud, Math.floor(((t * 1.2) % 90) - 20), 15);
  f.blit(a.body, 0, 0);
  // neve soprada do cume
  for (let k = 0; k < 8; k++) {
    const s = (t * (working ? 0.32 : 0.22) + k / 8) % 1;
    puff(f, 51 + s * 16 + Math.sin(s * 5 + k) * 0.8, 15.5 - s * 5 + Math.sin(s * 7 + k * 2) * 0.8, 0.8 + s * 2.6, (1 - s) * 0.85, WHITE, SNOW[5]);
  }
  // corda entre os exploradores, com barriga
  for (let i = 0; i < 3; i++) {
    const x0 = EXP_X[i] + 3, y0 = expPath(EXP_X[i]) - 7;
    const x1 = EXP_X[i + 1] - 4, y1 = expPath(EXP_X[i + 1]) - 7;
    const sag = 2.2 + Math.sin(t * 1.7 + i) * 0.4;
    for (let k = 1; k < 12; k++) {
      const u = k / 12;
      f.set(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag, k % 2 ? PAL.straw[3] : PAL.straw[2]);
    }
  }
  // exploradores caminhando: passada, pernas juntas, outra passada
  const rate = working ? 1.1 : 0.6;
  EXP_X.forEach((x, i) => {
    const ph = (t * rate + i * 0.27) % 1;
    const step = ph < 0.25 ? 0 : ph < 0.5 ? 1 : ph < 0.75 ? 2 : 1;
    const sx = x - 8, sy = expPath(x) - 16;
    f.blit(a.climbers[i][step], sx, sy);
    // bafo no ar frio
    const b = ((t + i * 0.61) % 2.4) / 2.4;
    if (b < 0.55) {
      const u = b / 0.55;
      puff(f, sx + 14 + u * 3, sy + 5 - u * 2, 0.6 + u * 1.3, (1 - u) * 0.9, WHITE, SNOW[5]);
    }
  });
  paintFlag(f, a.flag, EXP_POLE + 1, 3, 1, t, working ? 1.6 : 1.1, working ? 7 : 4.5);
  // neve caindo, levada pelo vento
  const n = working ? 46 : 30;
  for (let k = 0; k < n; k++) {
    const near = k % 5 === 0;
    const vy = (near ? 12 : 6.5) + hash(k, 1, 51) * 4;
    const vx = (near ? 6 : 3.5) + hash(k, 2, 51) * 2;
    const y = ((hash(k, 3, 51) * 70 + t * vy) % 70) - 3;
    const x = ((hash(k, 4, 51) * 72 + t * vx + Math.sin(t * 1.3 + k) * 1.4) % 72) - 4;
    f.set(x, y, near ? WHITE : SNOW[5]);
    if (near) f.set(x - 1, y, SNOW[4]);
  }
  f.draw(ctx);
}

function iconExpedition() {
  const p = new Pix(16, 16);
  // montanha com o pico nevado
  p.poly([[0, 16], [8.5, 3], [16, 16]], (x, y) => {
    const lit = x + 0.5 < 8.5 + (y - 3) * 0.15;
    const snow = y < [9, 8, 9, 7, 8, 9, 8, 10, 9, 8, 10, 9, 10, 11, 10, 11][x];
    if (snow) return SNOW[lit ? 6 : y > 6 ? 3 : 4];
    return pick(ROCK, (lit ? 0.7 : 0.35) + (hash(x, y, 4) - 0.5) * 0.2, x, y);
  });
  // bandeira vermelha no cume
  p.rect(8, 0, 1, 4, PAL.wood[4]);
  p.rect(9, 0, 4, 3, (x, y) => FLAG_RED[y === 0 ? 4 : x > 11 ? 2 : 3]);
  p.set(10, 1, PAL.gold[4]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Farol

const DUSK_SEA = ramp('#0e1330', '#171f48', '#212c5c', '#2d3a6e', '#3e4c80', '#58628f', '#7c7aa6');
const LH_STONE = ramp('#2a1f30', '#433248', '#614858', '#86625e', '#aa806a', '#cca07c', '#eac699');
const ROCK_DUSK = ramp('#120d18', '#1f1728', '#2e2238', '#40304a', '#58405a', '#7a5462', '#a46c66', '#d08e6c');
const GRASS_DUSK = ramp('#1a2218', '#2a3422', '#40482c', '#5e5c36', '#827440');
const COPPER = ramp('#122a28', '#1c4440', '#2a6054', '#3e7e68', '#5ea084', '#94c6a4');
const LAMP = ramp('#6a3418', '#b05a26', '#ee9638', '#ffcc5a', '#fff2bc', '#ffffff');
const FAR_ISLE = ramp('#3a2c52', '#4a3862', '#5c4672', '#705682');
const FOAM = ramp('#6c76a6', '#9ea8cc', '#cfd6ea', '#f4f6fb');
const GULL_DUSK = C('#2a1d33');
const LH_X = 44; // eixo da torre
const LH_TOP = 18; // base da galeria
const LH_SEA = 40; // horizonte
const LH_LAMP = [44, 10];
const LH_SUN = [13, 39.5];
const lhRx = (y) => 4.3 + (y - LH_TOP) * 0.075;
const lhRockTop = (x) => 48 + (x < 26 ? (26 - x) * 1.05 : 0) + (x > 57 ? (x - 57) * 0.55 : 0) + Math.sin(x * 1.3) * 0.5 + (hash(x, 0, 61) - 0.5) * 0.8;
const lhWater = (x) => 57.5 + Math.sin(x * 0.45) * 0.7;
const LH_SPLASH = [[18, 57], [27, 58], [39, 58], [52, 58], [61, 57]];

function buildLighthouseBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, LH_SEA, PAL.dusk, 2.4);
  // sol se pondo, metade escondida atrás do mar
  const [sx, sy] = LH_SUN, sr = 5.2;
  for (let y = 26; y < LH_SEA; y++) {
    for (let x = 0; x < 30; x++) {
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d <= sr) p.set(x, y, d < sr - 1.4 ? (y > 36 ? C('#ffd890') : C('#fff2c4')) : C('#ffb860'));
      else if (d < sr + 5 && bayer(x, y) < (1 - (d - sr) / 5) * 0.55) p.set(x, y, PAL.dusk[6]);
    }
  }
  // nuvens compridas, acesas por baixo
  for (const [cx, cy, len, th, seed] of [[20, 4, 17, 1.9, 1], [54, 21, 11, 1.4, 2], [8, 17, 11, 1.3, 3], [34, 25, 9, 1.1, 4], [58, 31, 8, 0.9, 5], [24, 32, 7, 0.8, 6]]) {
    for (let x = Math.floor(cx - len); x <= cx + len; x++) {
      const k = 1 - ((x + 0.5 - cx) / len) ** 2;
      if (k <= 0) continue;
      const h = th * Math.sqrt(k) * (0.75 + vnoise(x, seed, 3, 66) * 0.5);
      const top = cy - h + Math.sin(x * 0.7 + seed) * 0.4;
      for (let y = Math.floor(top); y <= cy + h * 0.5; y++) {
        const near = clamp01(1 - Math.hypot(x - sx, y - sy) / 40);
        p.set(x, y, pick(PAL.duskCloud, 0.15 + ((y + 0.5 - top) / (h * 1.5 + 0.5)) * 0.6 + near * 0.35, x, y, 2));
      }
    }
  }
  // ilhas lilases ao longe
  for (let x = 20; x < 40; x++) {
    const top = LH_SEA - 1.5 - 2.4 * Math.max(0, Math.sin((x - 20) * 0.2)) - Math.max(0, 2 - Math.abs(x - 33)) * 0.8;
    for (let y = Math.ceil(top); y < LH_SEA; y++) p.set(x, y, pick(FAR_ISLE, 0.6 - (y - top) * 0.15 + (x < 28 ? 0.15 : 0), x, y));
  }
  // mar com reflexo do céu, cristas das ondas e o rastro do sol
  for (let y = LH_SEA; y < 64; y++) {
    const z = y - LH_SEA;
    const dash = 2 + z * 0.3;
    for (let x = 0; x < 64; x++) {
      const w = hash(Math.floor((x + z * 3.7) / dash), y, 62);
      let v = 0.68 - z * 0.022;
      if (w < 0.2) v += 0.16;
      else if (w > 0.82) v -= 0.12;
      const glow = Math.abs(x + 0.5 - sx) < 2 + z * 0.28;
      if (glow && w < 0.45) { p.set(x, y, w < 0.15 ? C('#ffd890') : C('#e88a52')); continue; }
      if (glow) v += 0.12;
      p.set(x, y, pick(DUSK_SEA, v, x, y, 2));
    }
  }
  p.rect(0, LH_SEA, 64, 1, (x) => (Math.abs(x - sx) < 6 ? C('#ffc878') : DUSK_SEA[6]));
  return p;
}

function buildLighthouse() {
  const p = new Pix(64, 64);
  // rochedo: facetas de pedra, borda quente do lado do sol e capim no alto
  const inRock = (x, y) => x >= 16 && y >= lhRockTop(x) && y < lhWater(x) + 1;
  p.fill(14, 40, 63, 63, inRock, (x, y) => {
    const g = vnoise(x - 1, y - 1, 5, 63) - vnoise(x + 1, y + 1, 5, 63);
    let v = 0.42 + g * 3.2 + (hash(x >> 1, y >> 1, 64) - 0.5) * 0.12 - (y - 48) * 0.012;
    if (Math.floor(vnoise(x, y, 5, 63) * 6) !== Math.floor(vnoise(x + 1, y + 1, 5, 63) * 6)) v -= 0.14; // fendas
    if (!inRock(x - 1, y) || !inRock(x - 1, y - 1)) v += 0.32;
    if (y > lhWater(x) - 2) v -= 0.18; // pedra molhada
    if (y - lhRockTop(x) < 1.6) return pick(GRASS_DUSK, 0.5 + (x < 30 ? 0.3 : 0) + (hash(x, y, 65) - 0.5) * 0.3, x, y);
    return pick(ROCK_DUSK, v, x, y, 2);
  });
  // pedra solta na frente
  p.fill(10, 52, 22, 60, (x, y) => ((x - 15.5) / 4.6) ** 2 + ((y - 57.5) / 3.6) ** 2 <= 1 && y < lhWater(x) + 1, (x, y) =>
    pick(ROCK_DUSK, 0.2 + sphereLight((x + 0.5 - 15.5) / 4.6, (y + 0.5 - 56.5) / 3.6) * 0.9 - (y > 56 ? 0.15 : 0), x, y));

  // casinha do faroleiro: pedra, telhado de telhas e chaminé
  p.rect(26, 40, 10, 10, (x, y) => {
    const row = Math.floor((y - 40) / 2), off = (row % 2) * 2;
    let v = 0.62 - (x - 26) * 0.03 + (hash((x + off) >> 2, row, 67) - 0.5) * 0.14;
    if ((y - 40) % 2 === 1 || (x + off) % 4 === 0) v -= 0.14;
    if (x === 26) v += 0.18;
    if (y < 42) v -= 0.2; // sombra do beiral
    return pick(LH_STONE, v, x, y);
  });
  p.rect(27, 30, 3, 6, (x, y) => pick(LH_STONE, (x === 27 ? 0.7 : 0.4) - (y % 2) * 0.1, x, y));
  p.rect(26, 30, 5, 1, LH_STONE[4]);
  p.poly([[23.5, 41], [27, 34.5], [35, 34.5], [37.5, 41]], (x, y) => {
    let v = 0.6 - (x - 25) * 0.025 + (hash(x >> 1, y, 68) - 0.5) * 0.12;
    if ((y - 35) % 2 === 1) v -= 0.18;
    else if ((x + (y >> 1)) % 3 === 0) v -= 0.1;
    if (y === 40) v -= 0.2;
    return pick(PAL.roof, v, x, y);
  });
  p.line(27, 34, 35, 34, (x) => PAL.roof[x < 31 ? 4 : 3]);
  p.rect(28, 43, 3, 3, PAL.glow);
  p.set(28, 43, C('#fff1b8'));
  p.rect(28, 46, 3, 1, LH_STONE[5]);
  p.rect(32, 44, 3, 6, (x, y) => pick(PAL.wood, (x === 32 ? 0.6 : 0.35) - (y === 44 ? 0.15 : 0), x, y));

  // torre de pedra que afina para cima
  const towerBottom = (x) => lhRockTop(x) + 1;
  p.fill(LH_X - 8, LH_TOP, LH_X + 8, 51, (x, y) => Math.abs(x - LH_X) <= lhRx(y) + (y > 45 ? 1 : 0) && y <= towerBottom(x), (x, y) => {
    const plinth = y > 45;
    const rx = lhRx(y + 0.5) + (plinth ? 1 : 0);
    const nx = clamp01(((x + 0.5 - LH_X) / rx + 1) / 2) * 2 - 1;
    const ny = (y - LH_TOP) / 3, row = Math.floor(ny), off = (row % 2) * 0.5;
    const u0 = Math.asin(Math.max(-1, (x - LH_X) / rx)) * 2.6 + off;
    const u1 = Math.asin(Math.min(1, (x + 1 - LH_X) / rx)) * 2.6 + off;
    let v = 0.1 + cylLight(nx) * 0.82 + (hash(Math.floor(u0), row, 69) - 0.5) * 0.12;
    if ((y - LH_TOP) % 3 === 2 || Math.floor(u0) !== Math.floor(u1)) v -= 0.15;
    if (nx < -0.8) v += 0.2; // luz do poente na borda
    if (plinth) v -= y === 46 ? -0.12 : 0.12;
    return pick(LH_STONE, v, x, y);
  });
  // janelas em arco subindo com a escada, uma acesa
  for (const [wx, wy, lit] of [[LH_X - 2, 23, false], [LH_X + 1, 31, true], [LH_X - 1, 38, false]]) {
    p.rect(wx, wy + 1, 2, 3, lit ? PAL.glow : LH_STONE[0]);
    p.set(wx, wy + 1, lit ? C('#fff1b8') : LH_STONE[1]);
    p.rect(wx, wy, 2, 1, LH_STONE[1]);
    p.rect(wx - 1, wy + 4, 4, 1, LH_STONE[5]);
  }
  // porta com degraus
  p.rect(LH_X - 2, 42, 4, 6, (x, y) => (y === 42 && (x === LH_X - 2 || x === LH_X + 1) ? 0 : pick(PAL.wood, (x === LH_X - 2 ? 0.55 : 0.3) - (x - LH_X + 2) % 2 * 0.1, x, y)));
  p.set(LH_X, 45, PAL.gold[4]);
  p.rect(LH_X - 3, 48, 6, 1, (x) => LH_STONE[x < LH_X ? 5 : 3]);
  p.rect(LH_X - 4, 49, 8, 1, (x) => LH_STONE[x < LH_X ? 4 : 2]);

  // galeria com mísulas e grade
  for (let x = LH_X - 6; x <= LH_X + 6; x += 2) { p.set(x, 18, LH_STONE[x < LH_X ? 4 : 2]); p.set(x, 19, LH_STONE[1]); }
  p.rect(LH_X - 7, 16, 15, 2, (x, y) => pick(LH_STONE, (y === 16 ? 0.85 : 0.35) - (x - LH_X) * 0.02, x, y));
  // lanterna: base de ferro, vidros e a cúpula de cobre esverdeado
  p.rect(LH_X - 4, 13, 9, 3, (x, y) => PAL.iron[y === 13 ? 3 : x < LH_X ? 2 : 1]);
  p.rect(LH_X - 4, 7, 9, 6, (x, y) => {
    const bar = x === LH_X - 4 || x === LH_X + 4 || x === LH_X - 2 || x === LH_X + 2;
    if (bar) return PAL.iron[x < LH_X ? 2 : 1];
    return (x + y) % 5 === 0 ? PAL.glassHi : PAL.glass;
  });
  p.rect(LH_X - 5, 6, 11, 1, (x) => PAL.iron[x < LH_X ? 3 : 1]);
  p.fill(LH_X - 5, 1, LH_X + 5, 6, (x, y) => ((x - LH_X - 0.5) / 4.8) ** 2 + ((y - 6) / 4.4) ** 2 <= 1 && y < 6, (x, y) =>
    pick(COPPER, 0.2 + sphereLight((x + 0.5 - LH_X - 0.5) / 4.8, (y + 0.5 - 4.5) / 4.4) * 0.85 - ((x - LH_X + 8) % 3 === 0 ? 0.12 : 0), x, y));
  // grade da galeria
  p.rect(LH_X - 7, 12, 15, 1, (x) => PAL.iron[x < LH_X ? 3 : 2]);
  for (let x = LH_X - 7; x <= LH_X + 7; x += 2) p.rect(x, 13, 1, 3, PAL.iron[x < LH_X ? 2 : 1]);
  p.outline(PAL.out);
  // pináculo
  p.sphere(LH_X + 0.5, 1, 1.2, 1.2, PAL.gold, 0.1);
  p.set(LH_X, 0, PAL.gold[2]);
  return p;
}

const lhArt = { bg: null, body: null, lit1: null, lit2: null, glint: null, cloud: null, frame: new Pix(64, 64) };

function paintLighthousePortrait(ctx, t, info) {
  const a = lhArt;
  if (!a.bg) {
    a.bg = buildLighthouseBackdrop();
    a.body = buildLighthouse();
    a.lit1 = new Uint32Array(4096);
    a.lit2 = new Uint32Array(4096);
    for (let i = 0; i < 4096; i++) {
      a.lit1[i] = mixC(a.bg.d[i], '#ffe496', 0.5);
      a.lit2[i] = mixC(a.bg.d[i], '#fff4d0', 0.8);
    }
    // pontos do rastro do sol que cintilam
    const g = [];
    for (let y = LH_SEA + 1; y < 64; y++) {
      for (let x = 0; x < 30; x++) {
        if (Math.abs(x + 0.5 - LH_SUN[0]) < 1.5 + (y - LH_SEA) * 0.3 && hash(x, y, 70) < 0.35) g.push(x, y, Math.floor(hash(x, y, 71) * 628));
      }
    }
    a.glint = Int16Array.from(g);
    a.cloud = makeCloud(16, 5, 11, PAL.duskCloud);
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  const d = f.d;
  f.blit(a.cloud, Math.floor(((t * 0.8) % 84) - 18), 17);
  // rastro do sol cintilando na água
  for (let i = 0; i < a.glint.length; i += 3) {
    const s = Math.sin(t * 2.6 + a.glint[i + 2] * 0.01);
    if (s > 0.55) f.set(a.glint[i], a.glint[i + 1], s > 0.85 ? C('#fff2c4') : C('#ffb86a'));
  }
  // ondulação no primeiro plano
  for (const [y, sp, k0] of [[59, 2.2, 0], [62, 3.1, 4]]) {
    for (let k = 0; k < 6; k++) {
      const x = Math.floor(((k * 13 + k0 + t * sp) % 78) - 7);
      for (let i = 0; i < 4; i++) f.set(x + i, y, DUSK_SEA[i === 0 || i === 3 ? 4 : 5]);
    }
  }
  // facho do farol girando: um lado vem para a frente, o outro vai para trás
  const [lx, ly] = LH_LAMP;
  const ang = t * (working ? 1.3 : 0.8);
  let flare = 0;
  for (const off of [0, Math.PI]) {
    const c = Math.cos(ang + off), s = Math.sin(ang + off);
    if (s > 0) flare = clamp01((s - 0.82) / 0.18);
    const len = 74 * Math.abs(c);
    if (len < 4) continue;
    const dir = c > 0 ? 1 : -1;
    const power = 0.62 + 0.4 * Math.max(0, s);
    for (let dx = 4; dx <= len; dx++) {
      const x = lx + dir * dx;
      if (x < 0 || x > 63) break;
      const hh = 0.8 + dx * 0.12;
      const I = power * (1 - (dx / len) * 0.65);
      const y0 = Math.max(0, Math.floor(ly + 0.5 - hh)), y1 = Math.min(63, Math.floor(ly + 0.5 + hh));
      for (let y = y0; y <= y1; y++) {
        const e = 1 - Math.abs(y + 0.5 - ly - 0.5) / hh;
        const val = I * (0.2 + 0.8 * e);
        const i = y * 64 + x;
        if (e <= 0) continue;
        if (val > 0.6) d[i] = a.lit2[i];
        else if (val > 0.42) d[i] = val > 0.52 && bayer(x, y) < 0.5 ? a.lit2[i] : a.lit1[i];
        else if (val > 0.26 && bayer(x, y) < 0.5) d[i] = a.lit1[i];
      }
    }
  }
  // gaivotas voando em volta da torre
  for (let k = 0; k < 2; k++) {
    const ph = t * 0.42 + k * 2.6;
    paintGull(f, 24 + Math.cos(ph) * 15, 22 + Math.sin(ph) * 3 + k * 7, Math.sin(t * 6.5 + k * 2), GULL_DUSK);
  }
  // fumaça da chaminé, levada para a direita
  for (let k = 0; k < 5; k++) {
    const s = (t * (working ? 0.3 : 0.2) + k / 5) % 1;
    puff(f, 28.5 + s * 9 + Math.sin(s * 6 + k), 28.5 - s * 9, 0.8 + s * 2, (1 - s) * 0.9, PAL.duskCloud[3], PAL.duskCloud[1]);
  }
  f.blit(a.body, 0, 0);
  // lente acesa, mais forte quando o facho aponta para cá
  const b = 0.58 + flare * 0.42 + Math.sin(t * 13) * 0.04;
  for (let y = 8; y <= 12; y++) {
    for (let x = lx - 1; x <= lx + 1; x++) {
      if (y === 8 && x !== lx) continue;
      f.set(x, y, pick(LAMP, b - (y % 2) * 0.12 - (x === lx + 1 ? 0.12 : 0) + (x === lx - 1 ? 0.06 : 0), x, y));
    }
  }
  for (const x of [lx - 3, lx + 3]) for (let y = 7; y <= 12; y++) if (bayer(x, y) < 0.25 + flare * 0.6) f.set(x, y, LAMP[3]);
  if (flare > 0) {
    puff(f, lx + 0.5, ly + 0.5, 1.5 + flare * 3, flare * 0.9, LAMP[5], LAMP[4]);
    const arm = Math.round(flare * 5);
    for (let k = 1; k <= arm; k++) {
      const c = k > arm - 2 ? LAMP[3] : LAMP[5];
      f.set(lx - k, ly, c); f.set(lx + k, ly, c);
      if (k <= arm - 2) { f.set(lx, ly - k, c); f.set(lx, ly + k, c); }
    }
  }
  // janela da casinha tremeluzindo
  const fl = Math.sin(t * 7.1) * 0.5 + Math.sin(t * 11.7) * 0.3;
  if (fl > 0.35) { f.set(29, 44, PAL.fire[3]); f.set(30, 45, PAL.fire[3]); }
  // espuma batendo na base do rochedo
  for (let x = 10; x < 64; x++) {
    const wl = Math.round(lhWater(x)) + 1;
    const v = Math.sin(t * 2.1 - x * 0.45) + Math.sin(t * 1.3 + x * 0.21) * 0.6;
    if (v > 0.2) f.set(x, wl, v > 0.9 ? FOAM[3] : FOAM[2]);
    if (v > 0.9) f.set(x, wl + 1, FOAM[1]);
  }
  // ondas estourando no rochedo
  LH_SPLASH.forEach(([x0, y0], i) => {
    const period = (working ? 2.4 : 3.4) + i * 0.37;
    const ph = (((t + i * 1.31) % period) / 1.15);
    if (ph >= 1) return;
    // coluna de espuma que sobe e desaba, e gotas abrindo para os lados
    const h = Math.sin(ph * Math.PI) * (5 + hash(i, 0, 73) * 4);
    for (let k = 0; k < 3; k++) puff(f, x0 + (k - 1) * ph * 2, y0 - h * (0.3 + k * 0.35), 1 + ph * 1.6 - k * 0.2, (1.15 - ph) * (1 - k * 0.15), FOAM[3], FOAM[2]);
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1, sp = 0.6 + hash(k, i, 72) * 0.6;
      const x = x0 + side * ph * (2.5 + k) * sp;
      const y = y0 - h * 0.9 + ph * ph * 9 * sp - 1;
      if (ph > 0.25) { f.set(x, y, FOAM[3]); f.set(x, y + 1, FOAM[1]); }
    }
  });
  f.draw(ctx);
}

function iconLighthouse() {
  const p = new Pix(16, 16);
  // torre de pedra que afina, galeria, lanterna acesa e cúpula
  p.fill(4, 6, 12, 15, (x, y) => Math.abs(x + 0.5 - 8) <= 1.8 + (y - 6) * 0.22, (x, y) =>
    pick(LH_STONE, 0.15 + cylLight((x + 0.5 - 8) / (1.8 + (y - 6) * 0.22)) * 0.85 - (y % 3 === 0 ? 0.15 : 0), x, y));
  p.rect(7, 12, 2, 3, PAL.wood[2]);
  p.rect(4, 5, 8, 1, (x) => LH_STONE[x < 8 ? 5 : 3]);
  p.rect(6, 2, 4, 3, (x, y) => (x === 6 || x === 9 ? PAL.iron[2] : LAMP[y === 3 ? 5 : 4]));
  p.rect(6, 1, 4, 1, COPPER[3]);
  p.rect(7, 0, 2, 1, COPPER[4]);
  p.outline(PAL.out);
  // fachos de luz, sem contorno
  for (const [x, y, k] of [[4, 3, 5], [3, 3, 4], [2, 3, 4], [1, 3, 3], [3, 2, 3], [11, 3, 5], [12, 3, 4], [13, 3, 4], [14, 3, 3], [12, 2, 3]]) p.set(x, y, LAMP[k]);
  return p;
}

// ---------------------------------------------------------------------------
// Colônia

const TROPIC_SKY = ramp('#2c68b2', '#3a7cc0', '#5092cd', '#6aa8d8', '#8cc0e0', '#b2d8e6', '#d8eeea');
const LAGOON = ramp('#0e3c5c', '#145876', '#1a748e', '#2492a2', '#38aeb2', '#66c8bc', '#a2e0ce');
const SAND = ramp('#6a4a2e', '#987246', '#c09a66', '#dabb86', '#eed6a4', '#fbecc8');
const JUNGLE = ramp('#0a1e14', '#10301c', '#184424', '#225a2c', '#317436', '#468e40', '#68aa50');
const FROND = ramp('#11301a', '#1b4a24', '#29662e', '#3c843a', '#5aa448', '#84c25a');
const PALM_BARK = ramp('#2c1d13', '#48311f', '#694a2d', '#8b663d', '#ad8651');
const THATCH = ramp('#3a2a12', '#5e4520', '#86662e', '#ac8a40', '#ccac5c', '#e6cc84');
const HONEY = ramp('#3a2414', '#5e3c20', '#86582e', '#ad7a40', '#cc9a58', '#e4ba78');
const ISLE = ramp('#3e6a7a', '#4e7e8c', '#64949e', '#80aab0', '#a2c2c2');
const FLAG_BLUE = ramp('#0e1a44', '#1a2c6c', '#2a4494', '#3e60b4', '#5c82cc');
const SHUTTER = ramp('#123a3a', '#1c5652', '#2a766c', '#3e9686');
const GULL_GRAY = C('#2e3442');
const COL_HOR = 30; // horizonte
const colShore = (x) => 52 - x * 0.2 + Math.sin(x * 0.25) * 0.8;
const COL_POLE = 22;
const COL_CROWN = [51, 11];
const COL_BOAT = [1, 12];
const colTrunk = (u) => {
  // tronco curvo do coqueiro, da base (u = 0) até a copa (u = 1)
  const a = [59.5, 63], b = [61, 36], c = [52, 13];
  const v = 1 - u;
  return [v * v * a[0] + 2 * v * u * b[0] + u * u * c[0], v * v * a[1] + 2 * v * u * b[1] + u * u * c[1]];
};

function buildColonyBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, COL_HOR, TROPIC_SKY, 1.8);
  paintSun(p, 6, 5, 2.6);
  // nuvens de tempo bom no horizonte
  p.blit(makeCloud(26, 10, 14), 24, 13);
  p.blit(makeCloud(18, 8, 6), 44, 17);
  // ilha vulcânica ao longe, com a mata azulada
  for (let x = 0; x < 30; x++) {
    const top = 21 + Math.abs(x - 11) * 0.55 + (x > 11 ? Math.max(0, x - 18) * 0.3 : 0) + Math.sin(x * 1.3) * 0.4;
    for (let y = Math.ceil(top); y < COL_HOR; y++) {
      const lit = x < 11;
      p.set(x, y, pick(ISLE, (lit ? 0.62 : 0.38) + (y - top) * 0.02 + (hash(x, y, 81) - 0.5) * 0.12, x, y));
    }
  }
  p.blit(makeCloud(12, 5, 21), 5, 17);
  // mar da enseada: fundo ao longe, turquesa perto da praia
  for (let y = COL_HOR; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const sh = colShore(x);
      if (y >= sh) continue;
      const k = (y - COL_HOR) / Math.max(1, sh - COL_HOR);
      let v = 0.15 + k * 0.7;
      const w = hash(Math.floor((x + y * 2.3) / (2 + k * 4)), y, 82);
      if (w < 0.16) v += 0.18;
      else if (w > 0.85) v -= 0.1;
      if (y === COL_HOR) v = 0.75;
      p.set(x, y, pick(LAGOON, v, x, y, 2));
    }
  }
  // mata fechada do lado direito, com coqueiros ao fundo
  const jTop = (x) => 27 - (x - 40) * 0.35 + 2.2 * Math.abs(Math.sin(x * 0.42)) + Math.sin(x * 1.1) * 0.6;
  p.fill(36, 12, 63, 50, (x, y) => x >= 38 + (y > 40 ? (y - 40) * 0.6 : 0) && y >= jTop(x) && y < colShore(x) + 6, (x, y) => {
    const g = vnoise(x - 1, y - 1, 3, 83) - vnoise(x + 1, y + 1, 3, 83);
    let v = 0.42 + g * 2.4 - (y - jTop(x)) * 0.02 + (hash(x, y, 84) - 0.5) * 0.12;
    if (y - jTop(x) < 1) v += 0.15;
    return pick(JUNGLE, v, x, y, 2);
  });
  for (const [bx, by] of [[44, 21], [62, 16]]) {
    p.line(bx, by + 1, bx + 1, by + 8, PALM_BARK[1]);
    for (const [dx, dy] of [[-3, 1], [-2, 0], [-1, -1], [1, -1], [2, 0], [3, 1], [-4, 2], [4, 2], [0, -1]]) p.set(bx + dx, by + dy, JUNGLE[2]);
  }
  // areia: molhada perto da água, fofa e clara mais acima
  for (let y = 26; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const sh = colShore(x);
      if (y < sh || (p.get(x, y) && JUNGLE.includes(p.get(x, y)))) continue;
      const k = y - sh;
      let v = k < 2.5 ? 0.3 : 0.6 + Math.min(0.15, k * 0.01) + (hash(x, y, 85) - 0.5) * 0.18;
      if ((x * 2 + y * 5 + Math.floor(Math.sin(x * 0.3) * 3)) % 9 === 0) v -= 0.1; // marcas do vento
      p.set(x, y, pick(SAND, v, x, y, 2));
    }
  }
  // conchas
  for (let i = 0; i < 7; i++) p.set(4 + hash(i, 1, 86) * 56, 55 + hash(i, 2, 86) * 8, i % 2 ? C('#f4d8cc') : SAND[5]);
  return p;
}

function buildColonyHouse(p, x0, y0, w, wallH, roofH, stilt, seed, door) {
  const x1 = x0 + w - 1, wy = y0 + roofH;
  // palafitas
  for (let x = x0 + 1; x <= x1 - 1; x += Math.max(4, Math.floor((w - 2) / 2))) p.rect(x, wy + wallH, 1, stilt, PAL.wood[1]);
  p.rect(x1 - 1, wy + wallH, 1, stilt, PAL.wood[1]);
  // paredes de tábuas na horizontal
  p.rect(x0, wy, w, wallH, (x, y) => {
    let v = 0.62 - (x - x0) * 0.018 + (hash(x >> 2, y, seed) - 0.5) * 0.12;
    if ((y - wy) % 2 === 1) v -= 0.16;
    if (x === x0) v += 0.15;
    if (y === wy) v -= 0.3;
    return pick(HONEY, v, x, y);
  });
  p.rect(x0 - 1, wy + wallH, w + 2, 1, (x) => PAL.wood[x < x0 + w / 2 ? 3 : 2]);
  // janela com venezianas pintadas
  const wx = x0 + 2;
  p.rect(wx, wy + 2, 3, 3, PAL.glass);
  p.set(wx, wy + 2, PAL.glassHi);
  p.rect(wx - 1, wy + 2, 1, 3, SHUTTER[3]);
  p.rect(wx + 3, wy + 2, 1, 3, SHUTTER[2]);
  p.rect(wx - 1, wy + 5, 5, 1, PAL.wood[3]);
  if (door) {
    const dx = x0 + w - 6;
    p.rect(dx, wy + 2, 3, wallH - 2, (x, y) => PAL.wood[x === dx ? 2 : 1]);
    p.rect(dx - 1, wy + 1, 5, 1, PAL.wood[3]);
    p.set(dx + 2, wy + 5, PAL.gold[3]);
  }
  // telhado de palha, largo, com a franja no beiral
  const inRoof = (x, y) => {
    const f = (y - y0) / roofH;
    if (f < 0 || f > 1) return false;
    const inset = (1 - f) * 5.5;
    return x >= x0 - 3 + inset && x <= x1 + 3 - inset;
  };
  p.fill(x0 - 4, y0, x1 + 4, wy + 1, (x, y) => inRoof(x, y) || (y === wy && x >= x0 - 3 && x <= x1 + 3 && hash(x, y, seed) < 0.65), (x, y) => {
    let v = 0.68 - (x - x0) / w * 0.32 + (hash(x, (y - y0) >> 1, seed + 1) - 0.5) * 0.24;
    if ((y - y0) % 3 === 2) v -= 0.16;
    if ((x + ((y - y0) >> 1)) % 3 === 0) v -= 0.08;
    if (y >= wy - 1) v -= 0.22;
    if (y === y0) v += 0.1;
    return pick(THATCH, v, x, y);
  });
}

function buildBoat() {
  const p = new Pix(22, 34);
  // casco com faixa vermelha, castelo de popa e gurupés
  const hullTop = (x) => 26 - (x > 13 ? 3 : 0) - (x < 3 ? (3 - x) * 0.6 : 0);
  p.fill(1, 22, 19, 32, (x, y) => x >= 1 && x <= 18 && y >= hullTop(x) && y <= 31 - Math.max(0, 4 - x) * 0.9 - Math.max(0, x - 15) * 0.8, (x, y) => {
    if (y === Math.ceil(hullTop(x)) + 2) return PAL.roof[x < 9 ? 3 : 2];
    let v = 0.55 - (y - 26) * 0.06 - (x - 1) * 0.012;
    if ((y - 26) % 2 === 1) v -= 0.12;
    return pick(PAL.wood, v, x, y);
  });
  for (const x of [5, 8, 11]) p.set(x, 27, PAL.out);
  p.line(0, 25, -4, 22, PAL.wood[3]);
  p.rect(14, 22, 5, 1, PAL.wood[4]);
  // mastro, verga e a vela enrolada
  p.rect(9, 2, 1, 24, (x, y) => PAL.wood[y % 6 === 0 ? 2 : 3]);
  p.rect(3, 7, 13, 1, PAL.wood[3]);
  p.rect(4, 8, 11, 2, (x, y) => pick(PAL.sail, (y === 8 ? 0.85 : 0.45) - Math.abs(x - 9.5) * 0.02 - ((x + y) % 3 === 0 ? 0.12 : 0), x, y));
  p.rect(5, 16, 9, 1, PAL.wood[3]);
  p.rect(6, 17, 7, 1, (x) => PAL.sail[x % 3 ? 3 : 2]);
  p.rect(8, 1, 3, 1, PAL.wood[2]);
  p.outline(PAL.out);
  // cabos, sem contorno
  p.line(9, 2, 1, 24, PAL.wood[1]);
  p.line(9, 2, 18, 21, PAL.wood[1]);
  return p;
}

function buildColony() {
  const p = new Pix(64, 64);
  // trapiche de tábuas com estacas
  for (const x of [2, 8, 14, 20]) p.rect(x, 47, 1, 5, PAL.wood[1]);
  p.rect(0, 45, 26, 2, (x, y) => pick(PAL.wood, (y === 45 ? 0.75 : 0.5) - (x % 3 === 0 ? 0.2 : 0) + (hash(x, 0, 87) - 0.5) * 0.12, x, y));
  p.rect(0, 47, 26, 1, PAL.wood[1]);
  for (const x of [2, 14]) p.set(x, 44, PAL.wood[3]);
  // casas sobre palafitas
  buildColonyHouse(p, 47, 23, 11, 7, 7, 7, 88, false);
  buildColonyHouse(p, 30, 23, 15, 9, 9, 8, 89, true);
  // escadinha da porta
  p.line(39, 42, 41, 50, PAL.wood[3]);
  p.line(42, 42, 44, 50, PAL.wood[2]);
  for (const y of [44, 46, 48]) p.line(40 + (y - 44) * 0.25, y, 43 + (y - 44) * 0.25, y, PAL.wood[4]);
  // tronco do coqueiro, com os anéis
  for (let k = 0; k <= 60; k++) {
    const u = k / 60;
    const [x, y] = colTrunk(u);
    const r = 1.8 - u * 0.6;
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) > r) continue;
      const ring = Math.floor(u * 22) % 2 === 0;
      p.set(x + dx, y, pick(PALM_BARK, 0.62 - dx * 0.2 - (ring ? 0.18 : 0), Math.round(x + dx), Math.round(y)));
    }
  }
  // mastro da bandeira com a base de pedras
  p.rect(COL_POLE, 4, 1, 47, (x, y) => PAL.wood[y % 7 === 0 ? 2 : 4]);
  p.rect(COL_POLE + 1, 4, 1, 47, PAL.wood[2]);
  p.rect(COL_POLE - 2, 50, 6, 2, (x, y) => pick(PAL.stone, (y === 50 ? 0.7 : 0.4) - (x - COL_POLE) * 0.06, x, y));
  // caixotes e barris descarregados
  const crate = (x0, y0, w, h) => {
    p.rect(x0, y0, w, h, (x, y) => pick(HONEY, 0.58 - (x - x0) * 0.04 - ((y - y0) % 2) * 0.1 + (y === y0 ? 0.2 : 0), x, y));
    p.line(x0, y0 + h - 1, x0 + w - 1, y0, PAL.wood[2]);
    p.rect(x0, y0, w, 1, HONEY[5]);
  };
  crate(25, 52, 6, 5);
  crate(28, 48, 5, 4);
  for (const [bx, by] of [[50, 52], [54, 54]]) {
    p.rect(bx, by, 4, 5, (x, y) => pick(PAL.wood, 0.15 + cylLight((x + 0.5 - bx - 2) / 2) * 0.8 + (y === by ? 0.25 : 0), x, y));
    for (const y of [by + 1, by + 3]) p.rect(bx, y, 4, 1, (x) => PAL.iron[x === bx ? 3 : 1]);
  }
  // fogueira com a panela no tripé
  p.ellipse(36.5, 59, 3.6, 1.4, (x, y) => PAL.stone[(x + y) % 2 ? 3 : 1]);
  p.ellipse(36.5, 59, 2, 0.8, C('#2a1a12'));
  p.line(33, 59, 36, 52, PAL.wood[2]);
  p.line(40, 59, 37, 52, PAL.wood[1]);
  p.set(36, 53, PAL.iron[1]);
  p.sphere(36.5, 55.5, 2, 1.6, PAL.iron, 0);
  // canoa puxada para a areia
  p.fill(3, 55, 20, 60, (x, y) => Math.abs(x - 11.5) <= 8 - Math.max(0, y - 57) * 1.4 && y >= 56 && y <= 59, (x, y) => {
    if (y === 56) return PAL.wood[4];
    if (y === 57 && Math.abs(x - 11.5) < 6.5) return PAL.wood[1];
    return pick(PAL.wood, 0.55 - (y - 57) * 0.15 - (x - 4) * 0.01, x, y);
  });
  p.line(6, 57, 16, 54, PAL.wood[3]);
  p.rect(15, 53, 3, 2, PAL.wood[2]);
  // folhagem tropical no canto
  for (const [lx, ly, ang, len] of [[64, 63, -2.4, 9], [62, 64, -1.9, 10], [58, 64, -1.5, 7], [64, 58, -2.8, 7], [0, 64, -0.9, 6], [2, 64, -1.3, 5]]) {
    for (let k = 0; k <= len; k++) {
      const u = k / len, w = Math.sin(u * Math.PI) * 2.2;
      const cx = lx + Math.cos(ang) * k, cy = ly + Math.sin(ang) * k + u * u * 2;
      for (let j = -w; j <= w; j += 0.5) {
        const x = cx - Math.sin(ang) * j, y = cy + Math.cos(ang) * j;
        p.set(x, y, pick(FROND, 0.62 + j * 0.12 - u * 0.15 - (Math.abs(j) < 0.4 ? 0.3 : 0), Math.round(x), Math.round(y)));
      }
    }
  }
  p.outline(PAL.out);
  return p;
}

// Copa do coqueiro: folhas compridas que sobem e caem em arco, com a franja de
// folíolos pendurada embaixo, balançando com o vento.
const COL_FRONDS = [[-2.6, 12, 1.1], [3.05, 13, 0.95], [2.35, 10, 0.9], [1.6, 7, 0.6], [0.85, 10, 0.95], [0.15, 13, 1], [-0.55, 12, 1.1], [-1.6, 9, 1.2]];

function paintCrown(b, cx, cy, t, wind) {
  b.clear();
  COL_FRONDS.forEach(([ang, len, droop], k) => {
    const a = ang + Math.sin(t * 1.5 + k * 0.7) * 0.06 + wind * (Math.cos(ang) > 0 ? 0.5 : 1);
    const dx = Math.cos(a), dy = Math.sin(a) - 0.35;
    const steps = Math.round(len * 1.5);
    let px = cx, py = cy;
    for (let i = 1; i <= steps; i++) {
      const s = i / steps;
      const x = cx + dx * len * s + wind * s * s * 8;
      const y = cy + dy * len * s + droop * len * s * s * 0.75;
      // folíolos: franja caindo embaixo e uma pontinha em cima
      if (i % 2 === 0 && s < 0.97) {
        const ll = Math.round(3.4 * (1 - s * 0.6) * Math.min(1, s * 4));
        for (let q = 1; q <= ll; q++) b.set(x - dx * q * 0.45, y + q, FROND[q === 1 ? 3 : q === ll ? 1 : 2]);
        if (s > 0.15) b.set(x - dx * 0.6, y - 1, FROND[4]);
      }
      b.set(x, y, FROND[s < 0.5 ? 5 : 4]);
      if (Math.abs(x - px) > 1.2 || Math.abs(y - py) > 1.2) b.set((x + px) / 2, (y + py) / 2, FROND[4]);
      px = x; py = y;
    }
  });
  // cocos
  for (const [x, y] of [[cx - 1, cy + 1], [cx + 1, cy + 1], [cx, cy + 2]]) {
    b.set(x, y, PAL.wood[3]); b.set(x + 1, y, PAL.wood[2]); b.set(x, y + 1, PAL.wood[1]);
  }
  b.outline(PAL.out);
}

function buildColonyFlag() {
  const w = 11, h = 7;
  return makeFlag(w, h, (put) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(i, j, FLAG_BLUE, 0.6 - j * 0.04 + (j === 0 ? 0.12 : 0));
    // sol dourado
    for (const [i, j, v] of [[5, 2, 0.95], [6, 2, 0.8], [5, 3, 0.85], [6, 3, 0.7], [5, 1, 0.75], [4, 3, 0.75], [7, 3, 0.6], [5, 4, 0.6], [6, 4, 0.55], [3, 1, 0.7], [8, 1, 0.6], [3, 5, 0.6], [8, 5, 0.55]]) put(i, j, PAL.gold, v);
    for (let i = 0; i < w; i++) put(i, h - 1, PAL.linen, 0.75);
  });
}

function buildColonySil() {
  const p = buildColony();
  p.blit(buildBoat(), COL_BOAT[0], COL_BOAT[1]);
  const b = new Pix(32, 28);
  paintCrown(b, 15, 10, 0, 0);
  p.blit(b, COL_CROWN[0] - 15, COL_CROWN[1] - 10);
  p.rect(COL_POLE + 1, 4, 11, 7, PAL.out);
  return p;
}

// Colono de chapéu de palha levando um saco no ombro pela praia.
const colonist = new Pix(10, 13);
function paintColonist(f, x, y, dir, step) {
  const m = colonist.clear();
  const cx = 5, foot = 11;
  const sw = step > 0.35 ? 1 : step < -0.35 ? -1 : 0;
  m.set(cx - 1 + sw, foot, PAL.wood[1]);
  m.set(cx + 1 - sw, foot, PAL.wood[0]);
  m.set(cx - 1 + Math.round(sw / 2), foot - 1, WOOL[3]);
  m.set(cx + 1 - Math.round(sw / 2), foot - 1, WOOL[2]);
  m.rect(cx - 1, foot - 2, 3, 1, WOOL[2]);
  m.rect(cx - 1, foot - 5, 3, 3, (xx, yy) => PAL.linen[xx === cx + dir ? 2 : yy === foot - 5 ? 4 : 3]);
  m.set(cx + dir, foot - 3, PAL.skin[3]);
  m.rect(cx - 1, foot - 6, 3, 1, (xx) => PAL.skin[xx === cx + dir ? 4 : 3]);
  m.rect(cx - 2, foot - 7, 5, 1, (xx) => PAL.straw[xx === cx - 2 ? 5 : 3]);
  m.rect(cx - 1, foot - 8, 3, 1, PAL.straw[4]);
  m.rect(cx - dir * 2 - (dir > 0 ? 1 : 0), foot - 7, 2, 3, (xx, yy) => PAL.sail[yy === foot - 7 ? 3 : 1]);
  m.outline(PAL.out);
  f.blit(m, x - cx, y - foot);
}

const colArt = { bg: null, body: null, boat: null, flag: null, crown: new Pix(32, 28), cloud: null, glint: null, frame: new Pix(64, 64) };

function paintColonyPortrait(ctx, t, info) {
  const a = colArt;
  if (!a.bg) {
    a.bg = buildColonyBackdrop();
    a.body = buildColony();
    a.boat = buildBoat();
    a.flag = buildColonyFlag();
    a.cloud = makeCloud(16, 6, 31);
    const g = [];
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(hash(i, 1, 90) * 64), y = COL_HOR + 1 + Math.floor(hash(i, 2, 90) * 16);
      if (y < colShore(x) - 2) g.push(x, y, Math.floor(hash(i, 3, 90) * 628));
    }
    a.glint = Int16Array.from(g);
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.cloud, Math.floor(((t * 1.1) % 84) - 18), 4);
  // brilhos na água
  for (let i = 0; i < a.glint.length; i += 3) {
    const s = Math.sin(t * 2.2 + a.glint[i + 2] * 0.01);
    if (s > 0.6) {
      f.set(a.glint[i], a.glint[i + 1], WHITE);
      if (s > 0.85) { f.set(a.glint[i] - 1, a.glint[i + 1], LAGOON[6]); f.set(a.glint[i] + 1, a.glint[i + 1], LAGOON[6]); }
    }
  }
  // ondinhas indo e vindo na areia
  for (let x = 0; x < 64; x++) {
    const sh = colShore(x);
    const edge = sh + 1.3 + 1.3 * Math.sin(t * 0.9 - x * 0.07);
    for (let y = Math.floor(sh); y < edge; y++) f.set(x, y, y < sh + 0.5 ? LAGOON[5] : LAGOON[6]);
    if (Math.sin(x * 0.9 + t * 1.3) > -0.5) f.set(x, edge, WHITE);
    f.set(x, edge + 1, SAND[2]);
  }
  // gaivotas
  for (let k = 0; k < 2; k++) {
    const x = ((t * (5 + k * 1.5) + k * 37) % 90) - 13;
    paintGull(f, x, 8 + k * 5 + Math.sin(t * 0.8 + k) * 2, Math.sin(t * 5.5 + k * 1.7), GULL_GRAY);
  }
  // barco balançando no ancoradouro
  const bob = Math.round(Math.sin(t * 1.3) * 0.75);
  f.blit(a.boat, COL_BOAT[0], COL_BOAT[1] + bob);
  // flâmula no alto do mastro
  for (let i = 0; i < 6; i++) {
    const y = COL_BOAT[1] + bob + 2 + Math.round(Math.sin(t * 6 - i * 0.9) * 0.6 * (i / 5));
    f.set(COL_BOAT[0] + 11 + i, y, FLAG_RED[i < 3 ? 3 : 2]);
    if (i < 3) f.set(COL_BOAT[0] + 11 + i, y + 1, FLAG_RED[1]);
  }
  f.blit(a.body, 0, 0);
  // fogo da panela e o vapor subindo
  for (let k = 0; k < 3; k++) {
    const h = 1 + Math.round(1.2 + Math.sin(t * 11 + k * 2.1) * 0.8 + Math.sin(t * 17 + k) * 0.5);
    for (let j = 0; j < h; j++) f.set(35 + k, 58 - j, PAL.fire[j === 0 ? 4 : j === h - 1 ? 2 : 3]);
  }
  for (let k = 0; k < 4; k++) {
    const s = (t * (working ? 0.35 : 0.22) + k / 4) % 1;
    puff(f, 37 + s * 5 + Math.sin(s * 6 + k), 53 - s * 12, 0.7 + s * 2, (1 - s) * 0.8, PAL.cloud[4], PAL.cloud[2]);
  }
  // copa do coqueiro ao vento
  paintCrown(a.crown, 15, 10, t, Math.sin(t * 0.7) * 0.05 + (working ? 0.04 : 0));
  f.blit(a.crown, COL_CROWN[0] - 15, COL_CROWN[1] - 10);
  paintFlag(f, a.flag, COL_POLE + 1, 5, 1, t, working ? 1.6 : 1.1, working ? 6.5 : 4.2);
  // colono indo e voltando entre o trapiche e a casa
  const ph = t * 0.22;
  const u = 0.5 - 0.5 * Math.cos(ph);
  const moving = Math.abs(Math.sin(ph)) > 0.1;
  paintColonist(f, 21 + u * 26, 62, Math.sin(ph) > 0 ? 1 : -1, moving ? Math.sin(t * 7) : 0);
  f.draw(ctx);
}

function iconColony() {
  const p = new Pix(16, 16);
  // casinha de palafita com telhado de palha
  p.rect(2, 9, 8, 4, (x, y) => HONEY[(y - 9) % 2 ? 2 : x === 2 ? 4 : 3]);
  p.rect(6, 10, 2, 3, PAL.wood[1]);
  p.rect(3, 10, 2, 2, PAL.glass);
  for (const x of [3, 8]) p.rect(x, 13, 1, 3, PAL.wood[1]);
  p.poly([[0, 9.5], [3, 5], [9, 5], [12, 9.5]], (x, y) => THATCH[y < 7 ? (x < 6 ? 5 : 4) : (x < 6 ? 3 : 2)]);
  // coqueiro inclinado
  p.line(13, 15, 12, 5, (x, y) => PALM_BARK[y % 2 ? 3 : 2]);
  for (const [x, y, k] of [[9, 3, 4], [10, 2, 4], [11, 2, 5], [12, 3, 3], [13, 2, 5], [14, 2, 4], [15, 3, 3], [10, 4, 2], [14, 4, 2], [12, 1, 4], [11, 3, 3], [13, 3, 3], [9, 5, 2], [15, 5, 2]]) p.set(x, y, FROND[k]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Descobridor

const GOLD_SKY = ramp('#3a4884', '#4c5c98', '#6874aa', '#8e8cb4', '#bca2b0', '#e2b8a4', '#f6d4a6', '#fde8c0');
const SEA_GOLD = ramp('#142a4a', '#1c3a5e', '#284c70', '#386284', '#527a96', '#7a98aa', '#a8b8b8');
const WARM_CLOUD = ramp('#8e7c9e', '#bc9eac', '#e4bcae', '#f6d8bc', '#fff0dc');
const TEAL_VELVET = ramp('#061a1e', '#0c2c32', '#124048', '#1a5862', '#26727a', '#3a9094', '#5aaeaa');
const WINE = ramp('#1e0610', '#3a0c1a', '#5c1426', '#821e32', '#a6303e', '#c84c50');
const LACE = ramp('#6a6466', '#9c9694', '#c8c2ba', '#e6e0d6', '#fbf8f0');
const HAT = ramp('#0c0a10', '#1a1620', '#29232f', '#3a3242', '#4e4458', '#665a70');
const DIS_HAIR = ramp('#170d0a', '#2c1810', '#462717', '#62381f', '#7e4c2a', '#9a6236');
const PLUME = ramp('#8c8088', '#b8aeb0', '#dcd4d0', '#f4eee6', '#ffffff');
const PLUME_RED = ramp('#4a0e16', '#7c1a22', '#b02e30', '#d85046', '#f08068');
const PARCH = ramp('#5a3e22', '#86643c', '#b08e5c', '#d4b886', '#ecd8aa', '#fbf0d2');
const FAR_COAST = ramp('#3c5a6a', '#4c6c76', '#62827e', '#7c9888', '#9aae96');
const RUBY_RED = C('#d8303a');
// cabeça: elipse que afina para o queixo
const headTest = (hx, hy, rx, ry, taper) => (x, y) => {
  const dy = (y - hy) / ry;
  const w = dy > 0 ? rx * (1 - taper * dy * dy) : rx;
  return ((x - hx) / w) ** 2 + dy * dy <= 1;
};
const DIS_HOR = 47;
const DIS_HEAD = headTest(31.5, 30.5, 8.4, 10.6, 0.34);
const DIS_ROLL = [[6, 63], [20.5, 44]]; // eixo do mapa enrolado
const DIS_KNOT = [13.8, 52.4];

function buildDiscovererBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, DIS_HOR, GOLD_SKY, 2);
  p.blit(makeCloud(24, 8, 41, WARM_CLOUD), 40, 22);
  p.blit(makeCloud(16, 6, 42, WARM_CLOUD), 2, 26);
  // a costa nova ao longe, para onde ele olha
  for (let x = 0; x < 30; x++) {
    const top = DIS_HOR - 1.5 - 3.2 * Math.max(0, Math.sin(x * 0.16 + 0.4)) - Math.sin(x * 0.9) * 0.4;
    for (let y = Math.ceil(top); y < DIS_HOR; y++) p.set(x, y, pick(FAR_COAST, 0.7 - (y - top) * 0.12, x, y));
  }
  // galeão ao longe, com as velas acesas pelo sol baixo
  paintRows(p, ['.....x.....', '...x.s..x..', '...s.ss.s..', '..ss.ss.ss.', '..ss.ss.ss.', '..ss.ss.ss.', '...x.x..x..', 'hhhhhhhhhhh', '.hhhhhhhhh.', '..hhhhhhh..'], 3, 37, (ch, i) =>
    ch === 's' ? WARM_CLOUD[i < 6 ? 4 : 3] : ch === 'x' ? PAL.wood[1] : PAL.wood[i % 3 ? 1 : 2]);
  // mar com reflexos dourados
  for (let y = DIS_HOR; y < 64; y++) {
    const z = y - DIS_HOR;
    for (let x = 0; x < 64; x++) {
      const w = hash(Math.floor((x + z * 2.9) / (2 + z * 0.3)), y, 43);
      let v = 0.72 - z * 0.035;
      if (w < 0.2) v += 0.16;
      else if (w > 0.85) v -= 0.1;
      p.set(x, y, w < 0.06 ? GOLD_SKY[6] : pick(SEA_GOLD, v, x, y, 2));
    }
  }
  return p;
}

// Olhos virados para a esquerda, para o horizonte.
function paintDisEyes(p, closed) {
  for (const [x0, w] of [[24, 2], [29, 3]]) {
    for (let i = 0; i < w; i++) p.set(x0 + i, 29, DIS_HAIR[0]);
    if (closed) {
      for (let i = 0; i < w; i++) { p.set(x0 + i, 30, PAL.skin[2]); p.set(x0 + i, 31, PAL.skin[3]); }
      continue;
    }
    p.set(x0, 30, PAL.iris);
    p.set(x0 + 1, 30, w === 3 ? PAL.irisHi : PAL.eyeWhite);
    if (w === 3) p.set(x0 + 2, 30, PAL.eyeWhite);
    for (let i = 0; i < w; i++) p.set(x0 + i, 31, PAL.skin[i === 0 ? 2 : 3]);
  }
}

function buildDiscoverer() {
  const p = new Pix(64, 64);
  const cx = 30;
  // gibão de veludo verde-mar com as mangas abertas mostrando a seda dourada
  p.poly([[0, 64], [1, 56], [6, 51], [15, 47.5], [45, 47.5], [53, 51], [60, 56], [64, 64]], (x, y) => {
    const nx = (x + 0.5 - cx) / 30;
    let v = 0.62 - nx * 0.42 - (y - 52) * 0.01 + Math.sin(x * 0.9 + y * 0.2) * 0.05;
    // mangas abertas em tiras, mostrando a seda dourada
    const slash = x < 12 && y > 52 && x % 3 === 1 && (y + (x % 2) * 2) % 6 < 4;
    if (slash) return PAL.gold[(y + (x % 2) * 2) % 6 === 0 ? 4 : 3];
    if (x === 12 || x === 48) v -= 0.2;
    return pick(TEAL_VELVET, v, x, y);
  });
  // botões de ouro na frente
  p.rect(cx - 1, 48, 1, 16, TEAL_VELVET[1]);
  for (const y of [53, 56, 59, 62]) { p.set(cx, y, PAL.gold[4]); p.set(cx + 1, y, PAL.gold[2]); p.set(cx, y + 1, PAL.gold[2]); }
  // capa de veludo vinho no ombro esquerdo, com a barra de ouro
  p.poly([[41, 48], [49, 48.2], [57, 51.5], [62, 57], [64, 64], [42, 64], [44.5, 56]], (x, y) => {
    let v = 0.5 - (x - 44) * 0.018 - (y - 50) * 0.008;
    if ((x + Math.floor(y * 0.3)) % 5 === 0) v -= 0.16; // dobras
    else if ((x + Math.floor(y * 0.3)) % 5 === 1) v += 0.1;
    return pick(WINE, v, x, y);
  });
  p.line(41, 48, 44, 56, PAL.gold[4]);
  p.line(44, 57, 42, 64, PAL.gold[3]);
  p.line(42, 49, 45, 56, PAL.gold[2]);

  // cabelo comprido caindo atrás, mais volume do lado da nuca
  const hairIn = (x, y) => y > 19 && y < 47.5 + Math.sin(x * 1.1) * 0.8 && x > 22 + (y > 25 ? 8 : 0) && x < 42.5 + Math.sin(y * 0.6) * 0.8 - Math.max(0, 26 - y) * 0.5;
  p.fill(20, 18, 45, 49, hairIn, (x, y) => {
    const sx = x + Math.sin(y * 0.5) * 0.9 + (x - 34) * (y - 26) * 0.01;
    let v = 0.2 + sphereLight((x + 0.5 - 33) / 11, (y + 0.5 - 28) / 16) * 0.7 + (hash(Math.floor(sx / 2), 0, 44) - 0.5) * 0.3;
    if (Math.floor(sx) % 3 === 0) v -= 0.12;
    if (y > 44) v -= (y - 44) * 0.07;
    return pick(DIS_HAIR, v, x, y, 2);
  });
  // pescoço
  p.rect(26, 39, 9, 6, (x, y) => pick(PAL.skin, 0.22 - (x - 28) * 0.03, x, y));
  // rosto em três quartos, com a luz da esquerda
  p.fill(22, 19, 41, 42, DIS_HEAD, (x, y) => {
    let v = 0.42 + sphereLight((x + 0.5 - 29) / 8.4, (y + 0.5 - 29) / 10.6) * 0.72;
    if (y < 24) v -= 0.3; // sombra da aba
    if (x > 35) v -= 0.08;
    return pick(PAL.skin, v, x, y, 4);
  });
  // orelha
  p.rect(37, 29, 2, 5, (x, y) => PAL.skin[x === 37 ? 3 : 2]);
  p.set(38, 30, PAL.skin[1]); p.set(38, 31, PAL.skin[1]); p.set(37, 33, PAL.skin[1]);
  // mechas sobre a orelha e caindo na frente do ombro
  p.fill(36, 20, 44, 46, (x, y) => hairIn(x, y) && x > 38.6 - Math.max(0, 28 - y) * 0.4 + (y > 34 ? (y - 34) * 0.12 : 0), (x, y) =>
    pick(DIS_HAIR, 0.5 - (x - 38) * 0.06 + (hash(x, y >> 1, 45) - 0.5) * 0.3 - (y > 42 ? 0.2 : 0), x, y, 2));
  for (const [x, y] of [[23, 22], [24, 22], [23, 23]]) p.set(x, y, DIS_HAIR[2]);
  // sobrancelhas
  for (const [x, y] of [[23, 27], [24, 27], [25, 27], [28, 27], [29, 26], [30, 26], [31, 26], [32, 27]]) p.set(x, y, DIS_HAIR[1]);
  paintDisEyes(p, false);
  // nariz em três quartos, com a ponta para a esquerda
  for (const [x, y, k] of [[26, 30, 4], [26, 31, 4], [26, 32, 3], [25, 33, 4], [26, 33, 3], [25, 34, 2], [26, 34, 1], [27, 34, 2], [27, 31, 2], [27, 32, 2], [27, 33, 2]]) p.set(x, y, PAL.skin[k]);
  // bigode retorcido, boca e cavanhaque pontudo
  for (let x = 24; x <= 30; x++) p.set(x, 35, DIS_HAIR[x < 27 ? 3 : 2]);
  for (const [x, y, k] of [[23, 36, 3], [22, 35, 3], [22, 34, 2], [31, 36, 2], [32, 35, 2], [32, 34, 1], [24, 36, 2], [30, 36, 1]]) p.set(x, y, DIS_HAIR[k]);
  for (let x = 25; x <= 28; x++) p.set(x, 37, x === 25 ? PAL.skin[1] : PAL.lip);
  for (const [x, y] of [[31, 33], [32, 33], [31, 34]]) if (bayer(x, y) < 0.6) p.set(x, y, PAL.blush);

  // gola de rufo em renda: pregas em leque e a borda recortada
  const rx = 15.5, ry = 5.8, rcx = 30.5, rcy = 44.8;
  const ruff = (x, y) => {
    const nx = (x - rcx) / rx, ny = (y - rcy) / ry;
    const ang = Math.atan2(ny, nx);
    const scal = 1 + Math.abs(Math.sin(ang * 13)) * 0.07;
    return nx * nx + ny * ny <= scal * scal * 0.93;
  };
  p.fill(14, 38, 47, 51, ruff, (x, y) => {
    const nx = (x + 0.5 - rcx) / rx, ny = (y + 0.5 - rcy) / ry;
    const r = Math.hypot(nx, ny), ang = Math.atan2(ny, nx);
    const fold = (ang * 8 / Math.PI + 40) % 1;
    const lit = nx < 0.15 && ny < 0.4 ? 1 : 0;
    if (r < 0.3) return LACE[0];
    if (fold < 0.2 || r < 0.42) return LACE[r < 0.6 ? 0 : 1]; // vão entre as pregas
    if (fold < 0.38) return LACE[1 + lit];
    if (r > 0.84 && (x + y) % 2 === 0) return LACE[2 + lit]; // renda da borda
    return LACE[fold > 0.7 ? 3 + lit : 2 + lit];
  });
  // cavanhaque pontudo por cima da gola
  p.fill(24, 38, 30, 47, (x, y) => Math.abs(x + 0.5 - 26.8) <= 2.3 - (y - 38) * 0.28, (x, y) =>
    pick(DIS_HAIR, 0.6 - (x - 25) * 0.1 - (y - 38) * 0.03 + ((x + y) % 3 === 0 ? -0.12 : 0), x, y));

  // corrente de ouro com o medalhão da rosa dos ventos
  for (let x = 19; x <= 43; x += 2) {
    const y = 49 + 8.5 * (1 - ((x - 31) / 12.5) ** 2);
    p.set(x, y, PAL.gold[x % 4 === 1 ? 4 : 3]);
    p.set(x + 1, y, PAL.gold[2]);
  }
  p.sphere(31.5, 60, 3.2, 3.2, PAL.gold, 0.05);
  for (const [x, y, c] of [[31, 57, 5], [31, 58, 4], [31, 61, 2], [31, 62, 1], [29, 60, 4], [30, 60, 4], [33, 60, 2], [34, 60, 1], [31, 60, 5]]) p.set(x, y, PAL.gold[c]);
  p.set(32, 59, RUBY_RED);

  p.outline(PAL.out);
  p.blit(buildDisHat(), 0, 0);
  p.blit(buildDisMap(), 0, 0);
  return p;
}

function buildDisHat() {
  const p = new Pix(64, 64);
  // copa de veludo preto
  p.fill(22, 7, 41, 19, (x, y) => ((x - 31.5) / 9) ** 2 + ((y - 18) / 10.5) ** 2 <= 1 && y <= 19, (x, y) =>
    pick(HAT, 0.15 + sphereLight((x + 0.5 - 30) / 9, (y + 0.5 - 13) / 10) * 0.85 + ((x + y) % 4 === 0 ? 0.08 : 0), x, y));
  // fita de ouro com a joia que segura a pluma
  p.fill(22, 15, 41, 18, (x, y) => ((x - 31.5) / 9) ** 2 + ((y - 18) / 10.5) ** 2 <= 1 && y >= 15.5 && y <= 17.5, (x, y) =>
    pick(PAL.gold, 0.2 + cylLight((x + 0.5 - 31.5) / 9) * 0.75 + (y === 15 ? 0.15 : 0), x, y));
  p.sphere(38, 16, 1.6, 1.6, PAL.gold, 0.2);
  p.set(38, 16, RUBY_RED);
  // aba larga, um pouco caída para a frente
  const brimY = (x) => 19.6 + (x < 31 ? (31 - x) * 0.07 : (x - 31) * 0.02);
  p.fill(14, 16, 48, 24, (x, y) => Math.abs(x + 0.5 - 31) <= 15.8 && Math.abs(y + 0.5 - brimY(x)) <= 1.6 * Math.sqrt(1 - ((x + 0.5 - 31) / 15.8) ** 2) + 0.4, (x, y) => {
    const top = y + 0.5 < brimY(x);
    return pick(HAT, (top ? 0.7 : 0.22) - (x - 22) * 0.012, x, y);
  });
  p.outline(PAL.out);
  return p;
}

function buildDisMap() {
  const p = new Pix(64, 64);
  const [[ax, ay], [bx, by]] = DIS_ROLL;
  const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
  // mapa enrolado: cilindro de pergaminho na diagonal
  p.fill(2, 40, 26, 63, (x, y) => {
    const u = (x - ax) * ux + (y - ay) * uy, w = (x - ax) * -uy + (y - ay) * ux;
    return u >= 0 && u <= L && Math.abs(w) <= 2.3;
  }, (x, y) => {
    const u = (x + 0.5 - ax) * ux + (y + 0.5 - ay) * uy, w = (x + 0.5 - ax) * -uy + (y + 0.5 - ay) * ux;
    let v = 0.25 + cylLight(-w / 2.3) * 0.8;
    if (Math.abs(u - L * 0.55) < 1.2) return pick(FLAG_RED, v + 0.1, x, y); // fita
    if (w > 1.2 && Math.floor(u) % 5 === 0) v -= 0.15; // borda da folha enrolada
    return pick(PARCH, v, x, y);
  });
  // ponta do rolo mostrando a espiral do papel
  p.ellipse(bx, by, 2.1, 1.8, (x, y) => PARCH[(x + y) % 2 ? 4 : 3]);
  p.set(Math.floor(bx), Math.floor(by), PARCH[1]);
  p.set(Math.floor(bx) + 1, Math.floor(by), PARCH[2]);
  // mão segurando, com o punho de renda e a manga
  const hx = ax + ux * L * 0.32, hy = ay + uy * L * 0.32;
  p.poly([[0, 64], [0, 58], [5, 56], [9, 59], [7, 64]], (x, y) => pick(TEAL_VELVET, 0.55 - (y - 56) * 0.03 + (x < 3 ? 0.1 : 0), x, y));
  p.poly([[4, 56.5], [7.5, 55], [10.5, 58.5], [7, 61]], (x, y) => pick(LACE, 0.8 - (x - 4) * 0.05 - ((x + y) % 3 === 0 ? 0.3 : 0), x, y));
  // dedos fechados em volta do rolo, um acima do outro, e o polegar por cima
  const wx = -uy, wy = ux;
  for (let k = 0; k < 4; k++) {
    const fx = hx + ux * (k - 1.5) * 1.25, fy = hy + uy * (k - 1.5) * 1.25;
    for (let j = -2; j <= 2.6; j += 0.5) p.set(fx + wx * j, fy + wy * j, PAL.skin[j > 1.8 ? 2 : k === 3 ? 4 : 3]);
  }
  for (let k = -1.5; k <= 1.2; k += 0.5) p.set(hx + ux * k - wx * 2.4, hy + uy * k - wy * 2.4, PAL.skin[k > 0.5 ? 4 : 3]);
  p.outline(PAL.out);
  return p;
}

// Pluma do chapéu: espinha curva com as barbas fofas, a ponta tinge de vermelho.
function paintPlume(b, ox, oy, t, sway) {
  b.clear();
  const draw = (p0, p1, p2, wMax, r, tip) => {
    let px = p0[0], py = p0[1];
    for (let i = 0; i <= 40; i++) {
      const s = i / 40, v = 1 - s;
      const x = v * v * p0[0] + 2 * v * s * p1[0] + s * s * p2[0] - ox;
      const y = v * v * p0[1] + 2 * v * s * p1[1] + s * s * p2[1] - oy;
      let tx = x - px, ty = y - py;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      px = x; py = y;
      const w = wMax * Math.pow(Math.sin(Math.PI * (0.12 + s * 0.88)), 0.6);
      // barbas: franja serrilhada nas bordas, sombra embaixo e a raque no meio
      const ww = w + (i % 3 === 0 ? 0.6 : 0);
      for (let j = -ww; j <= ww + 0.01; j += 0.5) {
        const xx = x - ty * j, yy = y + tx * j;
        let val = 0.72 - j / w * 0.32 - s * 0.12;
        if (Math.abs(j) < 0.3) val -= 0.18;
        else if ((i + Math.round(j * 2)) % 4 === 0) val -= 0.14;
        b.set(xx, yy, pick(s > tip ? PLUME_RED : r, val, Math.round(xx), Math.round(yy)));
      }
    }
  };
  draw([38, 16], [41.5, 8 + sway * 0.4], [47 + sway * 0.6, 12.5 + sway * 0.5], 1.6, PLUME_RED, 2);
  draw([38, 15], [43, 1 + sway * 0.3], [54 + sway, 8.5 + sway * 0.8], 2.6, PLUME, 0.82);
  b.outline(PAL.out);
}

function buildDiscovererSil() {
  const p = buildDiscoverer();
  const b = new Pix(26, 22);
  paintPlume(b, 34, 0, 0, 0);
  p.blit(b, 34, 0);
  return p;
}

const disArt = { bg: null, body: null, plume: new Pix(26, 22), gold: null, cloud: null, frame: new Pix(64, 64) };

function paintDiscovererPortrait(ctx, t, info) {
  const a = disArt;
  if (!a.bg) {
    a.bg = buildDiscovererBackdrop();
    a.body = buildDiscoverer();
    a.cloud = makeCloud(14, 5, 47, WARM_CLOUD);
    const g = [];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const k = PAL.gold.indexOf(a.body.get(x, y)); if (k >= 0) g.push(x, y, k); }
    a.gold = Int16Array.from(g);
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.cloud, Math.floor(((t * 1.2) % 84) - 16), 8);
  // gaivotas
  for (let k = 0; k < 2; k++) {
    const ph = t * 0.5 + k * 2.9;
    paintGull(f, 12 + Math.cos(ph) * 9 + k * 4, 16 + Math.sin(ph * 1.3) * 3 + k * 6, Math.sin(t * 6 + k * 2), C('#3a3048'));
  }
  // brilhos no mar
  for (let k = 0; k < 10; k++) {
    const x = Math.floor(hash(k, 1, 48) * 64), y = DIS_HOR + 1 + Math.floor(hash(k, 2, 48) * 16);
    if (Math.sin(t * 2.4 + k * 1.9) > 0.7) { f.set(x, y, GOLD_SKY[7]); f.set(x + 1, y, GOLD_SKY[6]); }
  }
  f.blit(a.body, 0, 0);
  // pluma ao vento
  const sway = Math.sin(t * (working ? 2.2 : 1.4)) * 1.2 + Math.sin(t * 3.7) * 0.3;
  paintPlume(a.plume, 34, 0, t, sway);
  f.blit(a.plume, 34, 0);
  // pontas da fita do mapa tremulando
  const [kx, ky] = DIS_KNOT;
  for (let s2 = 0; s2 < 2; s2++) {
    for (let k = 1; k <= 6 - s2; k++) {
      const y = ky + 1 + s2 * 1.4 + k * 0.45 + Math.sin(t * (working ? 7 : 5) - k * 0.9 + s2) * k * 0.22;
      f.set(kx + 1 + k, y, FLAG_RED[k > 4 ? 2 : 3 - s2]);
    }
  }
  if (t % 5.2 > 5.05 || t % 13.1 > 12.96) paintDisEyes(f, true);
  // brilho correndo pelo ouro
  const period = working ? 3 : 5;
  const ph = t % period;
  const sw = (ph - 0.6) * 40;
  for (let i = 0; i < a.gold.length; i += 3) {
    const dd = Math.abs(a.gold[i] * 0.7 + a.gold[i + 1] * 0.7 - sw);
    if (dd < 2) f.set(a.gold[i], a.gold[i + 1], PAL.gold[Math.min(5, a.gold[i + 2] + (dd < 0.9 ? 2 : 1))]);
  }
  sparkle(f, 31, 58, pulse(ph, 99, -1.8, 0.5));
  f.draw(ctx);
}

function iconDiscoverer() {
  const p = new Pix(16, 16);
  // gola de renda, rosto de lado com cavanhaque, chapéu largo e pluma
  p.rect(2, 14, 12, 2, (x) => TEAL_VELVET[x < 7 ? 4 : 3]);
  p.rect(3, 12, 10, 2, (x, y) => LACE[(x + y) % 3 ? 4 : 2]);
  p.fill(5, 7, 12, 13, headTest(8, 9.5, 3.4, 3.8, 0.3), (x, y) => pick(PAL.skin, 0.4 + sphereLight((x + 0.5 - 7) / 3.4, (y + 0.5 - 9) / 3.8) * 0.75, x, y, 3));
  p.rect(10, 7, 2, 5, (x, y) => DIS_HAIR[x === 10 ? 3 : 2]);
  p.set(6, 9, PAL.iris);
  p.set(8, 9, PAL.iris);
  p.rect(5, 11, 4, 1, DIS_HAIR[2]);
  p.rect(6, 12, 2, 1, DIS_HAIR[3]);
  p.rect(5, 4, 7, 3, (x, y) => HAT[x < 7 ? 4 : 2]);
  p.rect(5, 6, 7, 1, PAL.gold[3]);
  p.rect(1, 7, 14, 1, (x) => HAT[x < 6 ? 5 : 3]);
  for (const [x, y, k] of [[11, 3, 4], [12, 2, 4], [13, 2, 3], [14, 3, 3], [12, 3, 2], [13, 3, 2], [14, 4, 2], [15, 5, 1]]) p.set(x, y, PLUME[k]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Novo Mundo

const DAWN = ramp('#26347a', '#36468a', '#525698', '#7a62a0', '#ac6e9e', '#de868e', '#f6a684', '#ffcc96', '#ffeec4');
const MTN_FAR = ramp('#4a3c78', '#5a4986', '#6e5894', '#866aa0', '#a27eaa', '#c096b2');
const MTN_MID = ramp('#22385a', '#2c4a66', '#385c70', '#4a7078', '#608680', '#7c9c8a');
const CLIFF = ramp('#24111a', '#3e1e1e', '#5e3224', '#84482c', '#aa643a', '#d0864c', '#eeb068');
const FALLS = ramp('#2a5a8a', '#4684ae', '#76b2d2', '#acd8ea', '#e2f4f8', '#ffffff');
const RIVER = ramp('#1a2c4e', '#243f66', '#34567e', '#4e7096', '#7a8eaa', '#b8a8b4', '#f2c6a6');
const VALLEY = ramp('#122a1e', '#1a3a26', '#24502e', '#326236', '#447640', '#5c8c4a', '#78a454');
const MACAW = { red: C('#d8302a'), dark: C('#7e1a1e'), yellow: C('#f4c430'), blue: C('#2a6ad0'), navy: C('#1a3a8a') };
const NW_SUN = [25, 33.5];
const NW_FALL = [50.5, 16, 55]; // centro, topo e pé da cachoeira
const nwRight = (y) => 45 - (y - 16) * 0.06 + Math.sin(y * 0.55) * 0.7; // borda do penhasco da direita
const nwLeft = (y) => 8.5 + (y - 34) * 0.1 + Math.sin(y * 0.7 + 1) * 0.6; // borda do penhasco da esquerda
const nwFront = (x) => (x > 15 && x < 38 ? 99 : 56.5 + Math.sin(x * 0.45) * 1.6 + (x > 37 && x < 46 ? (46 - x) * 0.35 : 0) + (x < 16 && x > 8 ? (x - 8) * 0.5 : 0)); // mata da frente
const nwFallW = (y) => 2.4 + (y - 15) * 0.035;

function buildNewWorldBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 46, DAWN, 2.2);
  // sol nascendo entre os morros
  const [sx, sy] = NW_SUN, sr = 5.6;
  for (let y = 20; y < 46; y++) {
    for (let x = 10; x < 44; x++) {
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d <= sr) p.set(x, y, d < sr - 1.3 ? C('#fff6d8') : C('#ffd27a'));
      else if (d < sr + 6 && bayer(x, y) < (1 - (d - sr) / 6) * 0.6) p.set(x, y, DAWN[8]);
    }
  }
  // cordilheira lilás ao longe
  for (let x = 0; x < 64; x++) {
    let top = Infinity, lit = true;
    for (const [px, py, sl, sr2] of [[2, 25, 0.9, 1.1], [15, 31, 1, 1], [35, 26.5, 1, 0.85], [52, 21, 0.9, 1]]) {
      const y = py + (x < px ? (px - x) * sl : (x - px) * sr2);
      if (y < top) { top = y; lit = x > px; }
    }
    top += (hash(x, 0, 91) - 0.5) * 0.8;
    for (let y = Math.ceil(top); y < 46; y++) {
      // borda acesa pelo sol que nasce atrás
      const rim = y - top < 1.2 && Math.abs(x - sx) < 16;
      p.set(x, y, rim ? DAWN[7] : pick(MTN_FAR, (lit ? 0.6 : 0.42) - (y - top) * 0.02 + (hash(x, y, 92) - 0.5) * 0.08, x, y, 2));
    }
  }
  // morros de mata azulados e, mais perto, o vale coberto de copas
  for (let x = 0; x < 64; x++) {
    const top = 39 + 2 * Math.sin(x * 0.21 + 1) + 1.2 * Math.abs(Math.sin(x * 0.6));
    for (let y = Math.ceil(top); y < 64; y++) {
      const g = vnoise(x - 1, y * 1.6 - 1, 3, 93) - vnoise(x + 1, y * 1.6 + 1, 3, 93);
      if (y < 48) p.set(x, y, pick(MTN_MID, 0.62 - (y - top) * 0.03 + g * 1.5 + (y - top < 1 ? 0.2 : 0), x, y, 2));
      else p.set(x, y, pick(VALLEY, 0.5 - (y - 48) * 0.012 + g * 2.6, x, y, 2));
    }
  }
  // faixas de névoa da manhã no vale
  for (let y = 41; y < 49; y++) {
    for (let x = 0; x < 64; x++) {
      const n = 0.55 + Math.sin(x * 0.11 + y * 0.6) * 0.25 + Math.sin(x * 0.29 - y) * 0.1 - Math.abs(y - 44.5) * 0.11;
      if (n > 0.6) p.set(x, y, n > 0.7 ? DAWN[8] : DAWN[7]);
    }
  }
  // rio fazendo curvas no vale, com o reflexo do sol
  const riverC = (y) => 25 + Math.sin(y * 0.38 + 0.6) * 3.4 + (y - 47) * 0.25;
  p.fill(0, 46, 63, 63, (x, y) => y > 46.5 && Math.abs(x - riverC(y)) < 1.2 + (y - 46.5) * 0.3, (x, y) => {
    let v = 0.5 - (y - 46) * 0.01 + (Math.abs(x + 0.5 - riverC(y + 0.5)) < 1 ? 0.12 : 0);
    if (hash(Math.floor((x + y * 3) / 3), y, 95) < 0.16) v += 0.18;
    if (Math.abs(x + 0.5 - NW_SUN[0]) < 1 + (y - 46) * 0.1) v += 0.3;
    return pick(RIVER, v, x, y, 2);
  });
  // poço ao pé da cachoeira
  p.fill(36, 52, 62, 62, (x, y) => ((x - 49) / 10.5) ** 2 + ((y - 57) / 3.4) ** 2 <= 1, (x, y) =>
    pick(RIVER, 0.45 + (y < 55 ? 0.12 : 0) + ((x * 3 + y * 7) % 11 === 0 ? 0.2 : 0), x, y, 2));
  return p;
}

function buildNewWorld() {
  const p = new Pix(64, 64);
  // penhasco da direita: arenito em camadas, borda virada para o sol acesa
  p.fill(36, 14, 63, 63, (x, y) => x + 0.5 >= nwRight(y) && y >= 15.5 + Math.sin(x * 0.8) * 0.6, (x, y) => {
    const e = x + 0.5 - nwRight(y + 0.5);
    const band = Math.floor((y + Math.sin(x * 0.3) * 1.2) / 4);
    let v = 0.42 + (hash(band, 0, 97) - 0.5) * 0.22 + (hash(x >> 1, y, 98) - 0.5) * 0.1 - (y - 16) * 0.004;
    if ((y + Math.round(Math.sin(x * 0.3) * 1.2)) % 4 === 0) v -= 0.16; // camadas
    if (hash(x, band, 99) < 0.08) v -= 0.2; // fendas
    if (e < 1.5) v += 0.4;
    else if (e < 3) v += 0.15;
    if (Math.abs(x + 0.5 - NW_FALL[0]) < nwFallW(y) + 2.5) v -= 0.15; // molhado perto da água
    return pick(CLIFF, v, x, y, 2);
  });
  // penhasco da esquerda
  p.fill(0, 30, 16, 63, (x, y) => x + 0.5 <= nwLeft(y) && y >= 33.5 + Math.sin(x * 0.9) * 0.6, (x, y) => {
    const e = nwLeft(y + 0.5) - x - 0.5;
    const band = Math.floor((y + Math.sin(x * 0.4) * 1.2) / 4);
    let v = 0.36 + (hash(band, 1, 97) - 0.5) * 0.22 + (hash(x >> 1, y, 100) - 0.5) * 0.1;
    if ((y + Math.round(Math.sin(x * 0.4) * 1.2)) % 4 === 0) v -= 0.16;
    if (e < 1.5) v += 0.38;
    else if (e < 3) v += 0.12;
    return pick(CLIFF, v, x, y, 2);
  });
  // musgo nas saliências
  for (let i = 0; i < 26; i++) {
    const right = i % 2 === 0;
    const y = (right ? 18 : 36) + Math.floor(hash(i, 1, 101) * (right ? 34 : 18));
    const x = right ? Math.ceil(nwRight(y)) + Math.floor(hash(i, 2, 101) * 22) : Math.floor(hash(i, 2, 101) * nwLeft(y));
    if (right && Math.abs(x - NW_FALL[0]) < 5) continue;
    p.set(x, y, JUNGLE[5]); p.set(x + 1, y, JUNGLE[4]); p.set(x, y + 1, JUNGLE[2]);
  }
  // mata em cima dos penhascos
  const crowns = [[46, 14, 3.6], [52, 12, 3.4], [57, 11, 4.4], [62, 9, 4.6], [60, 14, 3.4], [1, 32, 3], [8, 32.5, 2.6]];
  for (const [cx, cy, r] of crowns) {
    p.fill(cx - r, cy - r, cx + r, cy + r, (x, y) => ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.85)) ** 2 <= 1 - hash(Math.floor(Math.atan2(y - cy, x - cx) * 3), 0, cx) * 0.12, (x, y) => {
      let v = 0.1 + sphereLight((x + 0.5 - cx) / r, (y + 0.5 - cy) / r) * 1.0;
      if (hash(x, y, cx) < 0.18) v -= 0.2;
      return pick(JUNGLE, v, x, y, 1.6);
    });
  }
  // árvore grande no penhasco da esquerda, com a copa em guarda-chuva
  p.rect(3, 13, 3, 20, (x, y) => PAL.wood[x === 3 ? 3 : x === 4 ? 2 : 1]);
  p.line(5, 22, 17, 25, PAL.wood[2]);
  p.line(5, 23, 17, 26, PAL.wood[1]);
  p.line(4, 15, 9, 11, PAL.wood[2]);
  p.fill(0, 2, 22, 16, (x, y) => ((x - 7) / 12.5) ** 2 + ((y - 10) / 5.6) ** 2 <= 1 && y < 14 - Math.abs(x - 7) * 0.1, (x, y) => {
    let v = 0.15 + sphereLight((x + 0.5 - 5) / 12, (y + 0.5 - 7) / 6) * 0.95;
    if (hash(x, y, 102) < 0.2) v -= 0.22;
    if ((x + y * 3) % 7 === 0) v += 0.1;
    return pick(JUNGLE, v, x, y, 1.6);
  });
  // cipós caindo do alto do penhasco
  for (const [vx, len] of [[46, 8], [55, 12], [58, 7], [62, 10]]) {
    for (let k = 0; k < len; k++) {
      const x = vx + Math.round(Math.sin(k * 0.5 + vx) * 0.6);
      p.set(x, 16 + k, k % 3 === 0 ? JUNGLE[5] : JUNGLE[3]);
      if (k % 3 === 1) p.set(x + 1, 16 + k, JUNGLE[4]);
    }
  }
  // cachoeira (o desenho fixo, para a silhueta; a cada quadro a água corre por cima)
  const [fx, ftop, fbot] = NW_FALL;
  p.fill(fx - 6, ftop - 1, fx + 6, fbot, (x, y) => Math.abs(x + 0.5 - fx) <= nwFallW(y), (x) => FALLS[x < fx ? 4 : 3]);
  // mata da frente com folhas grandes e flores
  p.fill(0, 50, 63, 63, (x, y) => y >= nwFront(x), (x, y) => {
    const g = vnoise(x - 1, y - 1, 3, 103) - vnoise(x + 1, y + 1, 3, 103);
    return pick(JUNGLE, 0.38 + g * 2.6 - (y - nwFront(x)) * 0.02 + (hash(x, y, 104) - 0.5) * 0.1, x, y, 2);
  });
  for (const [lx, ly, ang, len] of [[0, 63, -1.0, 9], [4, 64, -1.4, 10], [10, 64, -1.9, 8], [14, 63, -2.4, 6], [64, 63, -2.2, 10], [58, 64, -1.7, 9], [51, 64, -1.3, 8], [45, 63, -0.9, 6]]) {
    for (let k = 0; k <= len; k++) {
      const u = k / len, w = Math.sin(u * Math.PI) * 2.4;
      const cx = lx + Math.cos(ang) * k, cy = ly + Math.sin(ang) * k + u * u * 2.5;
      for (let j = -w; j <= w; j += 0.5) {
        const x = cx - Math.sin(ang) * j, y = cy + Math.cos(ang) * j;
        p.set(x, y, pick(FROND, 0.7 + j * 0.1 - u * 0.15 - (Math.abs(j) < 0.4 ? 0.32 : 0), Math.round(x), Math.round(y)));
      }
    }
  }
  for (const [x, y] of [[8, 56], [56, 57], [42, 59], [2, 58]]) {
    p.set(x, y, MACAW.red); p.set(x + 1, y, MACAW.red); p.set(x, y + 1, MACAW.dark); p.set(x + 1, y - 1, MACAW.yellow);
  }
  p.outline(PAL.out);
  // tucano empoleirado no galho
  paintRows(p, ['..kkk....', '.kkkwbOO.', 'kkkyyOOOo', 'kkkyyOOo.', 'kkkky....', '.kkkk....', '..kk.....', '..k......'], 12, 18, (ch) =>
    ({ k: C('#16121a'), w: WHITE, b: C('#3a7ad0'), y: MACAW.yellow, O: C('#f08a2a'), o: C('#1a0e0a') })[ch]);
  return p;
}

const nwArt = { bg: null, body: null, rays: null, lit: null, fall: null, mist: null, cloud: null, sky: new Pix(64, 64), shift: -1, frame: new Pix(64, 64) };
const RAY_LUT = new Float32Array(256).map((_, i) => Math.max(0, Math.cos((i / 256) * Math.PI * 2 * 7)) ** 3);

// Arara voando para a esquerda: corpo vermelho, asas amarelas e azuis e a cauda comprida.
function paintMacaw(f, x, y, flap) {
  x = Math.round(x); y = Math.round(y);
  const { red, dark, yellow, blue, navy } = MACAW;
  f.set(x - 1, y, C('#e8e0d0'));
  f.set(x - 1, y + 1, C('#2a2020'));
  f.set(x, y - 1, red); f.set(x + 1, y - 1, red);
  f.set(x, y, C('#f0e6d8'));
  for (let k = 1; k <= 4; k++) { f.set(x + k, y, red); f.set(x + k, y + 1, dark); }
  for (let k = 5; k <= 9; k++) f.set(x + k, y + 1 + (k > 7 ? 1 : 0), k > 7 ? blue : red);
  if (flap > 0.3) {
    for (const [dx, dy, c] of [[2, -1, yellow], [3, -1, yellow], [2, -2, blue], [3, -2, blue], [3, -3, navy], [4, -4, navy]]) f.set(x + dx, y + dy, c);
  } else if (flap < -0.3) {
    for (const [dx, dy, c] of [[2, 2, yellow], [3, 2, blue], [3, 3, blue], [4, 4, navy]]) f.set(x + dx, y + dy, c);
  } else {
    for (const [dx, dy, c] of [[2, -1, yellow], [3, -1, yellow], [4, -1, blue], [5, -1, blue], [6, -2, navy]]) f.set(x + dx, y + dy, c);
  }
}

function paintNewWorldPortrait(ctx, t, info) {
  const a = nwArt;
  if (!a.bg) {
    a.bg = buildNewWorldBackdrop();
    a.body = buildNewWorld();
    // raios de sol: só nos pixels de céu, guardando ângulo e força de cada um
    const r = [];
    a.lit = new Uint32Array(4096);
    for (let y = 0; y < 42; y++) {
      for (let x = 0; x < 64; x++) {
        const i = y * 64 + x;
        if (!DAWN.includes(a.bg.d[i]) || a.body.d[i]) continue;
        const dx = x + 0.5 - NW_SUN[0], dy = y + 0.5 - NW_SUN[1];
        const dist = Math.hypot(dx, dy);
        if (dist < 7 || dist > 36) continue;
        r.push(i, Math.floor(((Math.atan2(dy, dx) / (Math.PI * 2)) + 1) * 256) & 255, Math.round((1 - dist / 36) * 100));
        a.lit[i] = DAWN[Math.min(8, DAWN.indexOf(a.bg.d[i]) + 1)];
      }
    }
    a.rays = Int16Array.from(r);
    // pixels da cachoeira
    const w = [];
    const [fx, ftop, fbot] = NW_FALL;
    for (let y = ftop - 1; y <= fbot; y++) {
      for (let x = Math.floor(fx - 6); x <= fx + 6; x++) {
        const e = nwFallW(y) - Math.abs(x + 0.5 - fx);
        if (e >= 0) w.push(x, y, Math.round(e * 10), Math.round(hash(x, 0, 107) * 63));
      }
    }
    a.fall = Int16Array.from(w);
    a.mist = new Float32Array(128 * 6);
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 128; x++) {
        const n = 0.5 + Math.sin(x * Math.PI / 32 + y) * 0.25 + Math.sin(x * Math.PI / 16 + y * 2) * 0.12 - Math.abs(y - 3) * 0.1;
        a.mist[y * 128 + x] = Math.max(0, (n - 0.55) * 2.2);
      }
    }
    a.cloud = makeCloud(18, 6, 51, ramp('#a66e9a', '#d08896', '#f0a894', '#ffcaa6', '#ffe6c4'));
  }
  const working = info.working;
  // raios girando devagar em volta do sol: o céu com os raios só muda quando eles andam um passo
  const shift = Math.floor(t * 4) & 255;
  if (shift !== a.shift) {
    a.shift = shift;
    const sd = a.sky.copyFrom(a.bg).d;
    const rr = a.rays;
    for (let k = 0; k < rr.length; k += 3) {
      const i = rr[k];
      const v = RAY_LUT[(rr[k + 1] + shift) & 255] * rr[k + 2] * 0.012;
      if (v > 0.32) sd[i] = a.lit[i];
    }
  }
  const f = a.frame.copyFrom(a.sky);
  const d = f.d;
  f.blit(a.cloud, Math.floor(((t * 1.3) % 90) - 20), 6);
  // pássaros pequenos ao longe
  for (let k = 0; k < 3; k++) {
    const x = ((t * 3 + k * 23) % 80) - 8, y = 26 + k * 2 + Math.sin(t * 0.8 + k) * 1.5;
    const up = Math.sin(t * 7 + k * 2) > 0;
    f.set(x, y, MTN_FAR[0]); f.set(x - 1, y - (up ? 1 : 0), MTN_FAR[0]); f.set(x + 1, y - (up ? 1 : 0), MTN_FAR[0]);
  }
  // névoa correndo no vale (faixa pronta de 128 colunas, deslizando)
  const mo = Math.floor(t * 1.5);
  for (let y = 42; y < 48; y++) {
    const row = (y - 42) * 128;
    for (let x = 0; x < 64; x++) {
      const m = a.mist[row + ((x + 128 - (mo & 127)) & 127)];
      if (m > 0.3) d[y * 64 + x] = m > 0.5 ? DAWN[8] : DAWN[7];
    }
  }
  // brilho no rio
  for (let k = 0; k < 8; k++) {
    const u = (t * 0.12 + k / 8) % 1;
    const y = 47 + u * 16;
    const x = 25 + Math.sin(y * 0.38 + 0.6) * 3.4 + (y - 47) * 0.25 + (hash(k, 1, 106) - 0.5) * (1 + u * 8);
    if (Math.sin(t * 3 + k * 2.3) > 0) f.set(x, y, RIVER[6]);
  }
  f.blit(a.body, 0, 0);
  // água da cachoeira descendo, com as listras de espuma
  const sp = working ? 30 : 20;
  const fl = a.fall;
  for (let k = 0; k < fl.length; k += 4) {
    const x = fl[k], y = fl[k + 1], e = fl[k + 2] * 0.1;
    const ph = (y - t * sp) * 0.55 + fl[k + 3] * 0.1;
    let v = 0.62 + Math.sin(ph) * 0.2 + Math.sin(ph * 0.37 + x) * 0.12 - (e < 0.6 ? 0.25 : 0) + (y < NW_FALL[1] + 2 ? 0.25 : 0);
    d[y * 64 + x] = pick(FALLS, v, x, y, 2);
  }
  // espuma e borrifo no pé da cachoeira
  const [fx, , fbot] = NW_FALL;
  for (let k = 0; k < 6; k++) {
    const s = (t * (working ? 0.7 : 0.5) + k / 6) % 1;
    puff(f, fx + Math.sin(k * 2.1) * 4 * s, fbot - s * 7, 1.2 + s * 2.6, (1 - s) * 0.9, WHITE, FALLS[4]);
  }
  for (let x = fx - 7; x <= fx + 7; x++) if (Math.sin(x * 1.3 + t * 4) > 0) f.set(x, fbot + 1, x % 2 ? FALLS[5] : FALLS[4]);
  // araras atravessando o céu
  const n = working ? 3 : 2;
  for (let k = 0; k < n; k++) {
    const x = 70 - ((t * (7 + k) + k * 31) % 96);
    paintMacaw(f, x, 17 + k * 7 + Math.sin(t * 1.2 + k * 2) * 2, Math.sin(t * 7 + k * 1.9));
  }
  // o tucano pisca
  if (t % 4.3 > 4.15) { f.set(16, 19, C('#16121a')); f.set(17, 19, C('#16121a')); }
  f.draw(ctx);
}

function iconNewWorld() {
  const p = new Pix(16, 16);
  // globo azul com o continente novo, no pé de ouro
  p.rect(5, 14, 6, 2, (x, y) => PAL.gold[y === 14 ? (x < 8 ? 5 : 4) : 2]);
  p.rect(7, 12, 2, 2, PAL.gold[3]);
  p.sphere(8, 7, 5.6, 5.6, PAL.water, 0.05);
  // o continente novo: norte e sul ligados pelo istmo
  const land = ['..xxx..', '.xxxxx.', '..xxxx.', '...xx..', '....x..', '....xx.', '...xxxx', '...xxx.', '....x..'];
  paintRows(p, land, 3, 2, (ch, i, j) => PAL.herb[j < 3 ? (i < 3 ? 5 : 4) : i < 5 ? 4 : 3]);
  p.set(11, 4, PAL.herb[3]); p.set(12, 5, PAL.herb[2]);
  p.set(5, 3, WHITE);
  for (const [x, y] of [[13, 3], [14, 5], [14, 7], [14, 9], [13, 11]]) p.set(x, y, PAL.gold[4]);
  p.outline(PAL.out);
  return p;
}

ART.portraits.expedition = paintExpeditionPortrait;
ART.locked.expedition = ART.silhouette(buildExpeditionSil);
ART.icons.expedition = iconExpedition;
ART.portraits.lighthouse = paintLighthousePortrait;
ART.locked.lighthouse = ART.silhouette(buildLighthouse);
ART.icons.lighthouse = iconLighthouse;
ART.portraits.colony = paintColonyPortrait;
ART.locked.colony = ART.silhouette(buildColonySil);
ART.icons.colony = iconColony;
ART.portraits.discoverer = paintDiscovererPortrait;
ART.locked.discoverer = ART.silhouette(buildDiscovererSil);
ART.icons.discoverer = iconDiscoverer;
ART.portraits.newworld = paintNewWorldPortrait;
ART.locked.newworld = ART.silhouette(buildNewWorld);
ART.icons.newworld = iconNewWorld;
})();
