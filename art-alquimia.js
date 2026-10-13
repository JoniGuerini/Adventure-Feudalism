'use strict';
// Linha de produção: ALQUIMIA (ervas medicinais, primeiros socorros).
// Herborista (tier 1) colhe ervas, Botica (tier 2) forma herboristas, Mosteiro (tier 3) virá depois.
// Aqui ficam os retratos, os ícones e a cena da horta na beira da mata.

(() => {
const { C, ramp, pick, hash, bayer, sphereLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun } = ART;

const LINING = C('#0d150f');
const PLASTER = ramp('#5a4a44', '#8a7464', '#b49c84', '#d6c0a2', '#eedcbe');
const MOSS = ramp('#16261a', '#22381f', '#2f4d26', '#43662f', '#5e8239');
const GLASS = [C('#3fb8a8'), C('#c8406e'), C('#86c84a'), C('#e0a43a'), C('#6a7ad8')];
const CHAMOMILE = C('#f6f2e2');
const CALENDULA = ramp('#a8460e', '#e07a1c', '#f4a83a');
const SAGE = ramp('#2e3a30', '#46584a', '#62786a', '#86998a');
const EYE = C('#3f7a3a'), EYE_HI = C('#8acb6a');

// ---------------------------------------------------------------------------
// Herborista

function buildHerbalistBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 40, PAL.morning, 2);
  // copas da mata ao fundo
  for (let i = 0; i < 18; i++) {
    const x = hash(i, 1, 41) * 70 - 3, y = 2 + hash(i, 2, 41) * 34;
    const r = 6 + hash(i, 3, 41) * 7;
    p.sphere(x, y, r, r * 0.85, PAL.tree, -0.3 + (y / 64) * 0.2, 1.6);
  }
  // troncos
  for (const [x, w] of [[4, 3], [57, 4], [13, 2]]) p.rect(x, 22, w, 32, (xx) => PAL.wood[xx === x ? 2 : 1]);
  // manchas de sol entre as folhas
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 7, 41) * 64), y = Math.floor(hash(i, 8, 41) * 40);
    if (p.get(x, y) === PAL.tree[4] || p.get(x, y) === PAL.tree[3]) { p.set(x, y, C('#9cc46a')); p.set(x + 1, y, PAL.tree[4]); }
  }
  // chão de musgo e samambaias
  for (let y = 50; y < 64; y++) {
    for (let x = 0; x < 64; x++) p.set(x, y, pick(MOSS, 0.45 + (y - 50) * 0.02 + (hash(x, y, 2) - 0.5) * 0.3, x, y));
  }
  for (let x = 1; x < 64; x += 7) {
    for (let k = 0; k < 5; k++) {
      const h = Math.round(Math.sin((k / 4) * Math.PI) * 3);
      p.set(x + k, 49 - h, PAL.herb[4]);
      p.set(x + k, 50 - h, PAL.herb[2]);
    }
  }
  return p;
}

function buildHerbalist() {
  const p = new Pix(64, 64);
  // manto
  p.poly([[3, 64], [6, 53], [14, 46], [24, 43.5], [40, 43.5], [50, 46], [58, 53], [61, 64]], (x, y) => {
    let v = 0.55 - ((x + 0.5 - 32) / 29) * 0.4 - (y - 50) * 0.006;
    if ((x === 16 || x === 47) && y > 52) v -= 0.2; // dobras
    return pick(PAL.hood, v, x, y);
  });
  // alça da bolsa atravessando o peito
  p.line(17, 47, 43, 64, PAL.leather[3]);
  p.line(17, 48, 42, 64, PAL.leather[2]);
  // capuz
  p.fill(15, 11, 49, 48, (x, y) => ((x - 32) / 16.5) ** 2 + ((y - 30) / 18) ** 2 <= 1 && y < 48, (x, y) => {
    let v = 0.1 + sphereLight((x + 0.5 - 32) / 16.5, (y + 0.5 - 28) / 18) * 1.05;
    if (x === 32 && y < 20) v -= 0.18; // costura
    return pick(PAL.hood, v, x, y);
  });
  // forro escuro da abertura
  p.ellipse(32, 33.5, 11.4, 13.2, LINING);
  // cabelo ruivo dos lados e franja
  p.fill(20, 20, 44, 46, (x, y) => ((x - 32) / 11) ** 2 + ((y - 33.5) / 12.8) ** 2 <= 1 && (Math.abs(x - 32) > 6.6 || y < 26.5), (x, y) => {
    let v = 0.4 - (x - 32) * 0.02 + (hash(x, y, 3) - 0.5) * 0.2;
    if ((x + y * 2) % 5 === 0) v += 0.22;
    return pick(PAL.auburn, v, x, y);
  });
  // rosto
  const hx = 32, hy = 34.5, hrx = 7.6, hry = 9.6;
  const inFace = (x, y) => {
    const dy = (y - hy) / hry;
    const rx = dy > 0 ? hrx * (1 - 0.3 * dy * dy) : hrx;
    return ((x - hx) / rx) ** 2 + dy * dy <= 1;
  };
  p.fill(hx - hrx, 26, hx + hrx, hy + hry, (x, y) => inFace(x, y) && y > 26.5, (x, y) => {
    let v = 0.32 + sphereLight((x + 0.5 - hx) / hrx, (y + 0.5 - hy) / hry) * 0.9;
    if (y < 29) v -= 0.3; // sombra do capuz
    return pick(PAL.skin, v, x, y);
  });
  // sobrancelhas, olhos verdes, sardas, sorriso
  for (const x of [27, 28, 29, 35, 36, 37]) p.set(x, 30, PAL.auburn[1]);
  for (const [x, c] of [[27, PAL.eyeWhite], [28, EYE_HI], [29, EYE], [35, EYE_HI], [36, EYE], [37, PAL.eyeWhite]]) p.set(x, 32, c);
  for (const x of [28, 29, 35, 36]) p.set(x, 33, EYE);
  for (const x of [27, 37]) p.set(x, 33, PAL.skin[3]);
  p.set(32, 35, PAL.skin[4]);
  p.set(32, 36, PAL.skin[3]);
  p.set(33, 36, PAL.skin[2]);
  for (const [x, y] of [[26, 35], [28, 36], [38, 35], [36, 36], [27, 37], [37, 37]]) p.set(x, y, PAL.skin[2]);
  for (const [x, y] of [[30, 39], [31, 40], [32, 40], [33, 40], [34, 39]]) p.set(x, y, C('#8a3a2a'));
  for (const x of [31, 32, 33]) p.set(x, 41, PAL.lip);
  // trança caindo pelo ombro
  for (let k = 0; k < 6; k++) {
    p.sphere(22 - k * 0.4, 44 + k * 3, 2.3, 1.9, PAL.auburn, k % 2 ? -0.05 : 0.08);
  }
  p.rect(19, 62, 4, 1, PAL.hood[1]);
  // broche de folha
  for (const [x, y, k] of [[31, 46, 4], [32, 46, 5], [32, 47, 4], [33, 47, 3], [31, 47, 3], [32, 48, 2]]) p.set(x, y, PAL.gold[k]);
  p.outline(PAL.out);
  return p;
}

// Ramo de lavanda na mão; desenhado a cada quadro para balançar.
const hand = new Pix(64, 64);
function paintBundle(f, t) {
  const sway = Math.sin(t * 1.6) * 1.1;
  for (const [x1, y1] of [[44, 39], [48, 36], [52, 37], [56, 41]]) {
    const ex = x1 + sway * ((53 - y1) / 16);
    f.line(48, 53, ex, y1 + 3, PAL.herb[3]);
    for (let k = 0; k < 5; k++) {
      const xx = Math.round(ex), yy = y1 + k;
      f.set(xx, yy, PAL.lavender[k === 0 ? 5 : 4 - (k % 2)]);
      if (k > 0 && k < 4) f.set(xx + (k % 2 ? 1 : -1), yy, PAL.lavender[2]);
    }
  }
  for (const [x, y] of [[45, 46], [51, 45], [52, 46], [46, 47]]) f.set(x + Math.round(sway * 0.4), y, PAL.herb[4]);
  // mão e o barbante
  hand.clear();
  hand.sphere(48, 54.5, 3.2, 2.7, PAL.skin, 0.15);
  hand.rect(46, 51, 5, 1, C('#d8c49a'));
  hand.outline(PAL.out);
  f.blit(hand, 0, 0);
}

const herbArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintHerbalistPortrait(ctx, t, info) {
  const a = herbArt;
  if (!a.bg) {
    a.bg = buildHerbalistBackdrop();
    a.body = buildHerbalist();
  }
  const f = a.frame.copyFrom(a.bg);
  // folhas caindo devagar
  for (let k = 0; k < 7; k++) {
    const life = (t * (0.06 + hash(k, 1, 3) * 0.05) + hash(k, 2, 3)) % 1;
    const x = hash(k, 3, 3) * 64 + Math.sin(t * 1.3 + k) * 4;
    const y = life * 70 - 4;
    const c = k % 3 === 0 ? PAL.gold[3] : PAL.herb[4];
    f.set(x, y, c);
    f.set(x + (Math.sin(t * 2 + k) > 0 ? 1 : -1), y, c);
  }
  f.blit(a.body, 0, 0);
  if (t % 4.7 > 4.55) {
    for (const x of [27, 28, 29, 35, 36, 37]) { f.set(x, 32, PAL.skin[2]); f.set(x, 33, PAL.skin[3]); }
  }
  paintBundle(f, info.working ? t : t * 0.4);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Botica

function buildBoticaBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 56, PAL.morning, 2);
  p.sphere(3, 32, 10, 14, PAL.tree, -0.1, 1.6);
  p.sphere(62, 30, 8, 12, PAL.tree, -0.2, 1.6);
  for (let y = 56; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const row = Math.floor((y - 56) / 3);
      const edge = (y - 56) % 3 === 2 || (x + (row % 2) * 3) % 6 === 0;
      p.set(x, y, pick(PAL.cobble, 0.6 + (y - 56) * 0.03 - (edge ? 0.25 : 0) + (hash(x >> 2, row, 1) - 0.5) * 0.15, x, y));
    }
  }
  return p;
}

function buildBotica() {
  const p = new Pix(64, 64);
  // chaminé
  p.rect(44, 3, 6, 10, (x, y) => pick(PAL.stone, (x === 44 ? 0.75 : 0.45) - (y % 2 ? 0.1 : 0), x, y));
  p.rect(43, 2, 8, 2, PAL.stone[4]);
  // parede de taipa
  p.rect(6, 17, 52, 40, (x, y) => pick(PLASTER, 0.72 - (x - 6) * 0.006 + (hash(x, y, 5) - 0.5) * 0.12, x, y));
  // enxaimel
  const beam = (x, y) => PAL.wood[(x + y) % 7 === 0 ? 2 : 1];
  for (const x of [6, 23, 41, 57]) p.rect(x, 17, 1, 40, beam);
  for (const y of [17, 36]) p.rect(6, y, 52, 1, beam);
  p.line(7, 35, 22, 18, PAL.wood[1]);
  p.line(42, 18, 56, 35, PAL.wood[1]);
  // telhado com beiral
  p.poly([[1, 19], [32, 1.5], [63, 19]], (x, y) => {
    let v = 0.62 - ((x - 32) / 31) * 0.3;
    if ((y + 1) % 3 === 0) v -= 0.2;
    else if ((x + (Math.floor(y / 3) % 2) * 2) % 4 === 0) v -= 0.08;
    return pick(PAL.roof, v, x, y);
  });
  p.rect(2, 19, 60, 1, PAL.wood[0]);
  // janela de cima com ervas secando
  p.fill(26, 21, 38, 33, (x, y) => (Math.abs(x - 32) <= 5.5 && y >= 26) || ((x - 32) ** 2 + (y - 26) ** 2 <= 30), PAL.wood[2]);
  p.fill(27, 22, 37, 32, (x, y) => (Math.abs(x - 32) <= 4.5 && y >= 26) || ((x - 32) ** 2 + (y - 26) ** 2 <= 19), C('#2a1a12'));
  for (const [x, c] of [[29, PAL.herb[3]], [32, PAL.lavender[3]], [35, PAL.herb[4]]]) {
    p.set(x, 24, PAL.wood[3]);
    p.rect(x - 1, 25, 3, 3, c);
    p.set(x, 28, c);
  }
  p.rect(26, 33, 13, 1, PAL.wood[3]);
  // vitrine com prateleiras de frascos
  p.rect(8, 39, 14, 15, PAL.wood[2]);
  p.rect(9, 40, 12, 13, C('#3a2418'));
  for (const sy of [45, 52]) p.rect(9, sy, 12, 1, PAL.wood[3]);
  for (let i = 0; i < 10; i++) {
    const x = 10 + (i % 5) * 2, y = i < 5 ? 42 : 49;
    p.rect(x, y, 1, 3, GLASS[(i * 3) % GLASS.length]);
    p.set(x, y - 1, PAL.wood[3]);
  }
  p.rect(15, 40, 1, 13, PAL.wood[2]);
  // porta em arco com degrau
  p.fill(44, 40, 55, 56, (x, y) => (Math.abs(x - 49.5) <= 5 && y >= 45) || ((x - 49.5) ** 2 + (y - 45) ** 2 <= 25), (x, y) =>
    pick(PAL.wood, 0.55 - (x - 45) * 0.03 - ((x - 44) % 3 === 0 ? 0.2 : 0), x, y));
  p.set(46, 50, PAL.gold[4]);
  p.rect(43, 56, 14, 1, PAL.stone[3]);
  // ervas penduradas no beiral
  for (const x of [10, 17, 39]) {
    p.set(x, 20, PAL.wood[3]);
    p.rect(x - 1, 21, 3, 2, x === 17 ? PAL.lavender[3] : PAL.herb[3]);
    p.set(x, 23, PAL.herb[2]);
  }
  // vasos ao lado da porta
  for (const x of [25, 34]) {
    p.rect(x, 52, 4, 4, (xx, yy) => pick(CALENDULA, yy === 52 ? 0.9 : 0.35, xx, yy));
    p.sphere(x + 2, 50, 3, 2.2, PAL.herb, 0.05);
    p.set(x + 1, 49, CALENDULA[2]);
    p.set(x + 3, 50, CHAMOMILE);
  }
  // suporte de ferro da placa
  p.rect(29, 37, 10, 1, PAL.iron[2]);
  p.set(29, 38, PAL.iron[2]);
  p.outline(PAL.out);
  return p;
}

// Placa com pilão, balançando presa no suporte.
const sign = new Pix(64, 64);
function paintSign(f, t) {
  const sway = Math.sin(t * 1.4) * 1.3;
  sign.clear();
  const top = 39, x0 = 28;
  sign.set(x0 + 1, top, PAL.iron[2]);
  sign.set(x0 + 7, top, PAL.iron[2]);
  for (let y = 0; y < 9; y++) {
    const dx = Math.round(sway * ((y + 1) / 9));
    for (let x = 0; x < 9; x++) sign.set(x0 + x + dx, top + 1 + y, pick(PAL.wood, 0.75 - y * 0.04 - (x === 0 || y === 8 ? 0.25 : 0), x, y));
  }
  const dx = Math.round(sway * 0.6);
  // pilão claro desenhado na placa
  for (const [x, y] of [[30, 44], [31, 45], [32, 45], [33, 45], [34, 44], [31, 46], [32, 46], [33, 46]]) sign.set(x + dx, y, CHAMOMILE);
  for (const [x, y] of [[34, 43], [35, 42], [36, 41]]) sign.set(x + dx, y, PAL.sail[1]);
  sign.outline(PAL.out);
  f.blit(sign, 0, 0);
}

const boticaArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintBoticaPortrait(ctx, t, info) {
  const a = boticaArt;
  if (!a.bg) {
    a.bg = buildBoticaBackdrop();
    a.body = buildBotica();
  }
  const f = a.frame.copyFrom(a.bg);
  // fumaça da chaminé
  for (let k = 0; k < 5; k++) {
    const s = (t * 0.22 + k / 5) % 1;
    const sx = 47 + s * 9 + Math.sin(s * 6 + k), sy = 2 - s * 10, r = 1.2 + s * 2.6;
    for (let y = Math.floor(sy - r); y <= sy + r; y++) {
      for (let x = Math.floor(sx - r); x <= sx + r; x++) {
        const dd = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / r;
        if (dd <= 1 && bayer(x, y) < (1 - s) * 1.2 * (1.1 - dd * 0.5)) f.set(x, y, PAL.cloud[dd < 0.5 ? 4 : 2]);
      }
    }
  }
  f.blit(a.body, 0, 0);
  // brilho passando pelos frascos da vitrine
  const g = Math.floor((t * (info.working ? 4 : 1.5)) % 14);
  if (g < 10) f.set(10 + (g % 5) * 2, g < 5 ? 42 : 49, C('#ffffff'));
  // luz quente na janela de cima
  if (info.working) f.set(32, 31, PAL.fire[4]);
  paintSign(f, t);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Mosteiro (tier 3 bloqueado)

function paintMonasteryLocked(ctx) {
  ART.paintLocked(ctx, (p, body, rim) => {
    p.rect(5, 38, 36, 24, body);
    p.poly([[3, 39], [23, 26], [43, 39]], body);
    p.rect(38, 16, 16, 46, body);
    p.poly([[36, 17], [46, 3], [56, 17]], body);
    p.line(23, 26, 3, 39, rim);
    p.line(46, 3, 36, 17, rim);
    p.rect(38, 17, 1, 45, rim);
    p.rect(45, 0, 1, 4, body);
    p.rect(44, 1, 3, 1, body);
  });
}

// ---------------------------------------------------------------------------
// Ícones

function iconHerb() {
  const p = new Pix(16, 16);
  for (let y = 4; y <= 15; y++) p.set(8 + Math.round(Math.sin(y * 0.5) * 0.8), y, PAL.herb[2]);
  for (const [x, y] of [[5, 8], [11, 9], [5, 12], [11, 13]]) p.ellipse(x, y, 2.6, 1.4, (xx, yy) => PAL.herb[yy < y ? 5 : 3]);
  for (let k = 0; k < 4; k++) p.set(8, 1 + k, PAL.lavender[k === 0 ? 5 : 4 - (k % 2)]);
  p.set(7, 2, PAL.lavender[3]);
  p.set(9, 3, PAL.lavender[2]);
  p.outline(PAL.out);
  return p;
}

function iconHerbalist() {
  const p = new Pix(16, 16);
  p.fill(0, 0, 16, 16, (x, y) => ((x - 8) / 7) ** 2 + ((y - 8.5) / 7.5) ** 2 <= 1, (x, y) =>
    pick(PAL.hood, 0.15 + sphereLight((x + 0.5 - 8) / 7, (y + 0.5 - 7) / 7.5), x, y));
  p.ellipse(8, 10, 4, 4.6, LINING);
  p.fill(4, 7, 12, 15, (x, y) => ((x - 8) / 3.2) ** 2 + ((y - 10.5) / 3.8) ** 2 <= 1, (x, y) => pick(PAL.skin, y < 8 ? 0.35 : 0.7 - (x - 7) * 0.05, x, y));
  p.rect(5, 7, 6, 1, PAL.auburn[3]);
  p.set(6, 10, EYE);
  p.set(9, 10, EYE);
  p.outline(PAL.out);
  return p;
}

function iconFlask() {
  const p = new Pix(16, 16);
  p.sphere(8, 10.5, 5, 4.6, ramp('#5a6a70', '#8aa0a6', '#c0d4d6', '#eaf6f6'), 0.1);
  p.fill(3, 10, 13, 15, (x, y) => ((x - 8) / 4.2) ** 2 + ((y - 10.5) / 3.8) ** 2 <= 1 && y >= 10, (x, y) => pick(PAL.herb, 0.75 - (y - 10) * 0.08 - (x - 6) * 0.04, x, y));
  p.rect(7, 2, 3, 5, (x) => C(x === 7 ? '#d6e6e6' : '#9ab0b2'));
  p.rect(6, 1, 5, 2, (x, y) => PAL.wood[y === 1 ? 4 : 3]);
  p.set(6, 9, C('#ffffff'));
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Cena: horta de ervas na beira da mata, com riacho, boticas e herboristas.

const SH = SCENES.H;
const streamY = (x) => 84 + 1.5 * Math.sin(x * 0.03);
const BEDS = [{ y: 92, h: 5 }, { y: 99, h: 6 }, { y: 107, h: 6 }];

function buildMiniBotica() {
  const p = new Pix(30, 28);
  p.rect(20, 1, 3, 7, PAL.stone[3]);
  p.rect(3, 11, 24, 15, (x, y) => pick(PLASTER, 0.75 - (x - 3) * 0.01, x, y));
  for (const x of [3, 14, 26]) p.rect(x, 11, 1, 15, PAL.wood[1]);
  p.rect(3, 18, 24, 1, PAL.wood[1]);
  p.poly([[0.5, 12], [15, 2.5], [29.5, 12]], (x, y) => pick(PAL.roof, 0.6 - (x - 15) * 0.02 - ((y + 1) % 3 === 0 ? 0.2 : 0), x, y));
  p.rect(5, 20, 6, 4, C('#3a2418'));
  for (let i = 0; i < 3; i++) p.set(6 + i * 2, 21, GLASS[i]);
  p.rect(18, 19, 5, 7, (x) => PAL.wood[x === 18 ? 3 : 2]);
  p.rect(14, 14, 4, 3, PAL.wood[3]);
  p.set(15, 15, CHAMOMILE);
  p.outline(PAL.out);
  return p;
}

class GardenScene extends SCENES.BaseScene {
  constructor() {
    super();
    this.miniBotica = buildMiniBotica();
    this.man = new Pix(24, 32);
  }

  layout() {
    const w = this.w;
    this.boticaSpots = [];
    for (let x = 110; x < w - 24; x += 160) this.boticaSpots.push(x);
    this.herbSpots = [];
    let i = 0;
    for (let x = 34; x < w - 16; x += 52, i++) {
      this.herbSpots.push({ x: x + Math.round((hash(i, 4) - 0.5) * 14), bed: i % 3, dir: i % 2 ? -1 : 1, phase: hash(i, 5) * 6 });
    }
    // plantas de cada canteiro: tipo, posição e altura
    this.plants = BEDS.map((bed, b) => {
      const list = [];
      // canteiros em blocos de uma erva só, com um respiro de terra entre eles
      for (let x = 1; x < w; x += 3 + (b > 1 ? 1 : 0)) {
        const k = x + b * 37;
        if (k % 46 > 38) continue;
        const type = Math.floor(k / 46) % 5;
        list.push({ x: x + Math.floor(hash(x, b, 9) * 2), type, h: 3 + b + Math.floor(hash(x, b, 8) * 2) });
      }
      return list;
    });
  }

  buildBackground() {
    const p = this.bg, w = this.w;
    paintSky(p, 0, 72, PAL.morning, 3);
    paintSun(p, Math.round(w * 0.14), 18, 8);
    // serra azulada
    for (let x = 0; x < w; x++) {
      const top = Math.round(46 + 5 * Math.sin(x * 0.013 + 2) + 2 * Math.sin(x * 0.05));
      for (let y = top; y < 72; y++) p.d[y * w + x] = pick(PAL.far, (y === top ? 0.95 : 0.62) - (y - top) * 0.015, x, y, 1.6);
    }
    // mata: pinheiros em duas fileiras
    for (const [row, step, hmin, hvar, bias] of [[0, 5, 9, 8, -0.2], [1, 8, 13, 10, 0]]) {
      for (let x = -4; x < w + 8; x += step + Math.floor(hash(x, row, 2) * 4)) {
        const base = 68 + row * 4 + Math.round(2 * Math.sin(x * 0.05 + row));
        const h = hmin + Math.floor(hash(x, row, 3) * hvar);
        const half = h * 0.32;
        p.poly([[x - half, base], [x, base - h], [x + half, base]], (xx, yy) => {
          let v = 0.55 - ((xx - x) / half) * 0.35 + bias;
          if ((yy - (base - h)) % 3 === 0) v -= 0.2;
          return pick(PAL.tree, v, xx, yy, 1.6);
        });
      }
    }
    // campina com flores
    for (let y = 70; y < 89; y++) {
      for (let x = 0; x < w; x++) {
        const v = 0.5 + (y - 70) * 0.014 + (hash(x, y, 4) - 0.5) * 0.2;
        let c = pick(PAL.grass, v, x, y, 1.8);
        const fl = hash(x, y, 6);
        if (y > 73 && fl < 0.012) c = fl < 0.004 ? CHAMOMILE : fl < 0.008 ? PAL.lavender[4] : CALENDULA[2];
        p.d[y * w + x] = c;
      }
    }
    // riacho
    for (let x = 0; x < w; x++) {
      const c = streamY(x);
      for (let y = Math.floor(c - 2.5); y <= c + 2.5; y++) {
        const d = Math.abs(y + 0.5 - c);
        p.set(x, y, d > 2 ? PAL.dirt[2] : pick(PAL.water, 0.55 - (y + 0.5 - c) * 0.1, x, y));
      }
    }
    // horta: canteiros de madeira com terra, separados por trilhas
    for (let y = 89; y < SH; y++) for (let x = 0; x < w; x++) p.d[y * w + x] = pick(PAL.dirt, 0.62 + (hash(x, y, 7) - 0.5) * 0.2, x, y);
    for (const bed of BEDS) {
      for (let y = bed.y; y < Math.min(SH, bed.y + bed.h); y++) {
        for (let x = 0; x < w; x++) {
          let c;
          if (y === bed.y) c = PAL.wood[3];
          else if (y === bed.y + bed.h - 1) c = PAL.wood[1];
          else c = pick(PAL.dirt, 0.18 + (hash(x, y, 8) - 0.5) * 0.2, x, y);
          p.d[y * w + x] = c;
        }
      }
      for (let x = 0; x < w; x += 24) p.rect(x, bed.y, 1, bed.h, PAL.wood[2]);
    }
  }

  paintFrame(p, t, info) {
    this.paintBirds(p, t, 26);
    // brilho correndo no riacho
    for (let k = 0; k < this.w / 7; k++) {
      const x = Math.floor((k * 7 + t * 6 + hash(k, 1) * 7) % this.w);
      if (Math.sin(t * 3 + k) > 0.3) p.set(x, Math.round(streamY(x)) - 1 + (k % 3), PAL.water[5]);
    }
    const boticas = Math.min(info.t2, this.boticaSpots.length);
    for (let i = 0; i < boticas; i++) {
      const x = this.boticaSpots[i] - 15, y = 80 - 27;
      p.blit(this.miniBotica, x, y);
      this.paintSmoke(p, t, x + 21.5, y + 1, i, 0.6);
    }

    const shown = Math.min(info.t1, this.herbSpots.length);
    const byBed = [[], [], []];
    for (const s of this.herbSpots.slice(0, shown)) byBed[s.bed].push(s);
    for (let b = 0; b < BEDS.length; b++) {
      this.paintBed(p, b, t);
      for (const s of byBed[b]) this.paintHerbalist(p, s, t);
    }
    this.paintButterflies(p, t);
  }

  paintBed(p, b, t) {
    const ground = BEDS[b].y + 2;
    for (const pl of this.plants[b]) {
      const sway = Math.round(Math.sin(t * 1.5 - pl.x * 0.06) * (0.5 + b * 0.3));
      const x = pl.x, h = pl.h;
      switch (pl.type) {
        case 0: // lavanda
          for (let k = 0; k < h; k++) p.set(x + (k > h / 2 ? sway : 0), ground - k, k < h - 2 ? PAL.herb[2] : PAL.lavender[4 - (k % 2)]);
          p.set(x + sway, ground - h, PAL.lavender[5]);
          break;
        case 1: // camomila
          for (let k = 0; k < h - 1; k++) p.set(x, ground - k, PAL.herb[3]);
          p.set(x + sway, ground - h + 1, CHAMOMILE);
          p.set(x + sway - 1, ground - h + 1, CHAMOMILE);
          p.set(x + sway, ground - h, C('#f2c94c'));
          break;
        case 2: // sálvia: moitinha de folhas largas
          for (let k = 0; k < h - 1; k++) {
            p.set(x, ground - k, SAGE[2]);
            if (k % 2) { p.set(x - 1, ground - k, SAGE[1]); p.set(x + 1, ground - k, SAGE[3]); }
          }
          p.set(x + sway, ground - h + 1, SAGE[3]);
          break;
        case 3: // calêndula
          for (let k = 0; k < h - 1; k++) p.set(x, ground - k, PAL.herb[2]);
          p.set(x + sway, ground - h + 1, CALENDULA[2]);
          p.set(x + sway + 1, ground - h + 1, CALENDULA[1]);
          p.set(x + sway, ground - h, CALENDULA[2]);
          break;
        default: // hortelã
          for (let k = 0; k < h - 1; k++) {
            p.set(x, ground - k, PAL.herb[4 - (k % 2)]);
            if (k % 2) p.set(x + (k % 4 === 1 ? 1 : -1), ground - k, PAL.herb[5]);
          }
          p.set(x + sway, ground - h + 1, PAL.herb[5]);
      }
    }
  }

  // Herborista em pé na frente do canteiro; inclina o corpo, a mão desce até a planta e volta.
  paintHerbalist(p, spot, t) {
    const m = this.man.clear();
    const dir = spot.dir;
    const cx = 12, foot = 30;
    const ph = (Math.sin(t * 1.8 + spot.phase) + 1) / 2;
    const bend = ph * 2.2;
    const X = (dx) => cx + dx * dir;
    // saia marrom com avental de linho na frente
    m.fill(cx - 5, foot - 11, cx + 5, foot - 2, (x, y) => Math.abs(x - (cx + 0.5)) <= 2.2 + (y - (foot - 11)) * 0.24, (x, y) => {
      const front = (x - cx) * dir >= 0;
      return front ? pick(PAL.linen, 0.75 - (y - (foot - 11)) * 0.03, x, y) : pick(PAL.vest, 0.55, x, y);
    });
    m.set(X(-1), foot - 1, PAL.leather[1]);
    m.set(X(1), foot - 1, PAL.leather[1]);
    // cesto no quadril de trás
    const bx = Math.round(X(-4.5)), by = foot - 9;
    m.rect(bx - 2, by, 5, 4, (x, y) => PAL.wood[(x + y) % 2 ? 4 : 3]);
    m.rect(bx - 2, by, 5, 1, PAL.wood[2]);
    m.set(bx - 1, by - 1, PAL.herb[4]);
    m.set(bx, by - 1, PAL.lavender[4]);
    m.set(bx + 1, by - 1, CALENDULA[2]);
    // tronco com o manto verde, inclinado para frente
    const sx = cx + dir * bend * 0.9, sy = foot - 18 + bend * 0.8;
    m.fill(cx - 6, sy - 1, cx + 6, foot - 9, (x, y) => {
      const k = (y - (sy - 1)) / (foot - 9 - (sy - 1));
      const mid = sx + (cx + 0.5 - sx) * k;
      return Math.abs(x - mid) <= 2.4 + k * 0.6;
    }, (x, y) => pick(PAL.hood, 0.62 - (x - cx) * dir * 0.08, x, y));
    // capa caindo pelas costas
    m.line(X(-2.5), sy, X(-3), foot - 4, PAL.hood[1]);
    // cabeça: capuz com o rosto de perfil
    const hx = sx + dir * (1 + bend * 0.5), hy = sy - 3 + bend * 0.6;
    m.sphere(hx, hy, 3.1, 3.1, PAL.hood, 0.08);
    m.set(hx - dir * 3, hy - 1.5, PAL.hood[2]); // ponta do capuz
    const fx = Math.floor(hx + dir * 1.3), fy = Math.floor(hy);
    m.set(fx, fy, PAL.skin[4]);
    m.set(fx + dir, fy, PAL.skin[3]);
    m.set(fx, fy + 1, PAL.skin[3]);
    m.set(fx + dir, fy + 1, PAL.skin[2]);
    m.set(fx, fy - 1, PAL.auburn[3]);
    m.set(fx - dir, fy + 2, PAL.auburn[3]);
    // braço descendo até a planta
    const hxEnd = X(3.5 + bend * 1.2), hyEnd = foot - 12 + bend * 3.2;
    m.line(sx + dir * 1.5, sy + 1, hxEnd, hyEnd, PAL.hood[3]);
    m.set(hxEnd, hyEnd + 1, PAL.skin[4]);
    if (ph < 0.4) m.set(hxEnd, hyEnd, PAL.lavender[4]);
    m.outline(PAL.out);
    const bed = BEDS[spot.bed];
    p.blit(m, spot.x - cx, bed.y + bed.h - foot);
  }

  paintButterflies(p, t) {
    const colors = [CHAMOMILE, C('#f4d478'), CALENDULA[2], PAL.lavender[4]];
    const n = Math.max(3, Math.floor(this.w / 110));
    for (let k = 0; k < n; k++) {
      const span = this.w + 40;
      const x = Math.round(((hash(k, 1, 4) * span + t * (4 + hash(k, 2, 4) * 5)) % span) - 20 + Math.sin(t * 0.9 + k) * 10);
      const y = Math.round(76 + hash(k, 3, 4) * 20 + Math.sin(t * 2.3 + k * 2) * 4);
      const c = colors[k % colors.length];
      const open = Math.floor(t * 9 + k) % 2 === 0;
      p.set(x, y, PAL.out);
      if (open) {
        p.set(x - 1, y - 1, c); p.set(x + 1, y - 1, c);
        p.set(x - 1, y, c); p.set(x + 1, y, c);
      } else {
        p.set(x, y - 1, c); p.set(x, y - 2, c);
      }
    }
  }
}

ART.portraits.herbalist = paintHerbalistPortrait;
ART.portraits.botica = paintBoticaPortrait;
ART.locked.monastery = paintMonasteryLocked;
ART.locked.herbalist = ART.silhouette(buildHerbalist);
ART.locked.botica = ART.silhouette(buildBotica);
Object.assign(ART.icons, { herb: iconHerb, herbalist: iconHerbalist, flask: iconFlask });
SCENES.register('garden', GardenScene);
})();
