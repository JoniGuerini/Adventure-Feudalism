'use strict';
// Linha da alquimia, tiers 7 a 10: Biblioteca, Sábio (gera bibliotecas), Observatório
// (gera sábios) e Academia (gera observatórios). Retratos animados, silhuetas
// bloqueadas e ícones. Quanto mais alto o tier, mais mágica a luz.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, makeCloud } = ART;

const WHITE = C('#ffffff');
const AX = 32.5; // eixo vertical dos retratos (centro do pixel 32)

// vidro, cera, pergaminho e o lilás mágico, usados em mais de um retrato
const PARCH = ramp('#5e4a30', '#8e7650', '#bca576', '#ddc99a', '#f2e6c0', '#fff8e2');
const WAX = ramp('#8a7458', '#c4ae86', '#e8dab4', '#fbf3dc');
const POTION = ramp('#0a3020', '#145c34', '#22904c', '#4cc46a', '#9cf09a', '#e4ffd8');
const MAGE = ramp('#1a0e2e', '#2c1848', '#422666', '#5a3886', '#7650a6', '#9672c4', '#bc9ce0', '#e2d0f8');
const WALNUT = ramp('#160c08', '#25150d', '#382013', '#4f301c', '#684226', '#855832', '#a4723f');
const TERRA = ramp('#3e180c', '#6a2c16', '#984424', '#c06636', '#dc8c56');
const WARM = ramp('#3a1a0c', '#7a3a12', '#c46a1e', '#f0a03a', '#ffd870', '#fff4c0');
const VERDI = ramp('#0a1e1e', '#10302e', '#174640', '#205c50', '#2e7662', '#448f74', '#64ac8c', '#90cca8');
const INK = C('#2a1610');
const BOOKS = [
  ramp('#2e0c10', '#561a1c', '#7e2a26', '#a43c30', '#c45a40'), // vermelho
  ramp('#0c2416', '#163c22', '#235a30', '#347a40', '#4c9a52'), // verde
  ramp('#101a3a', '#1c2c5e', '#2c4484', '#4060a8', '#5c80c4'), // azul
  ramp('#22143a', '#38225a', '#523480', '#6e4ca4', '#8e6cc4'), // lilás
  ramp('#3a2a0c', '#5e4414', '#86621e', '#ac8430', '#ccaa48'), // ocre
  ramp('#0e2a2c', '#184446', '#246264', '#368484', '#52a4a0'), // verde-água
  ramp('#2a170e', '#432616', '#603820', '#7e4c2c', '#9c663a'), // couro
];

// ---------------------------------------------------------------------------
// Peças comuns

const archTest = (cx, rx, top, bottom) => (x, y) =>
  y <= bottom && ((Math.abs(x - cx) <= rx && y >= top + rx) || ((x - cx) / rx) ** 2 + ((y - top - rx) / rx) ** 2 <= 1);

// Cabeça em elipse que afina no queixo.
const headTest = (hx, hy, rx, ry, taper = 0.3) => (x, y) => {
  const dy = (y - hy) / ry;
  const w = dy > 0 ? rx * (1 - taper * dy * dy) : rx;
  return ((x - hx) / w) ** 2 + dy * dy <= 1;
};

// Alvenaria: ajuste de tom de um bloco (junta escura, aresta de cima clara, variação por bloco).
function masonry(x, y, bw, bh, seed, oy = 0) {
  const ry = (((y - oy) % bh) + bh) % bh;
  const row = Math.floor((y - oy) / bh), off = (row & 1) * (bw >> 1);
  if (ry === bh - 1 || (x + off) % bw === 0) return -0.17;
  return (hash(Math.floor((x + off) / bw), row, seed) - 0.5) * 0.16 + (ry === 0 ? 0.06 : 0);
}

// Luz que pulsa: compara o quadro apagado com o aceso e guarda, para cada pixel que
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

// Chama de vela com a base em (x, y): núcleo claro embaixo, ponta que dança.
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

// Estrelinha de brilho que cresce e some (e de 0 a 1).
function sparkle(f, x, y, e, core = WHITE, tip = PAL.gold[5]) {
  if (e <= 0.08) return;
  const arm = Math.round(e * 2.2);
  f.set(x, y, core);
  for (let k = 1; k <= arm; k++) {
    const c = k === arm ? tip : core;
    f.set(x + k, y, c); f.set(x - k, y, c); f.set(x, y + k, c); f.set(x, y - k, c);
  }
}

// Envelope suave de um evento periódico: 0 fora da janela, sobe e desce dentro dela.
function pulse(t, period, offset, length) {
  const ph = (((t + offset) % period) + period) % period;
  return ph < length ? Math.sin((ph / length) * Math.PI) : 0;
}

// Pixels de uma rampa dentro de um retângulo: o brilho corre por eles.
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

// Ponto de luz mágico com um brilho pontilhado em volta (e de 0 a 1).
function paintWisp(f, x, y, e, r) {
  x = Math.round(x); y = Math.round(y);
  if (e <= 0.05) return;
  const top = r.length - 1;
  f.set(x, y, r[Math.min(top, Math.round(top * (0.55 + e * 0.45)))]);
  if (e > 0.35) {
    const c = r[Math.max(0, Math.round(top * 0.45 * e + top * 0.2))];
    if (bayer(x - 1, y) < e) f.set(x - 1, y, c);
    if (bayer(x + 1, y) < e) f.set(x + 1, y, c);
    if (bayer(x, y - 1) < e) f.set(x, y - 1, c);
    if (bayer(x, y + 1) < e) f.set(x, y + 1, c);
  }
}

// ---------------------------------------------------------------------------
// Biblioteca

const PANEL = ramp('#0c1411', '#131f19', '#1b2b22', '#24392c', '#304838', '#3e5a46', '#516e56', '#688666', '#84a07c');
const RUG = ramp('#1c1230', '#2c1e4a', '#422e68', '#5a428a', '#765caa', '#9a80c8');
const GLASS_PALE = ramp('#4a6a6c', '#7a9e9c', '#b4d2cc', '#e2f4ee');

const LIB_WIN = archTest(10.5, 6, 4, 33); // vidro da janela
const LIB_FRAME = archTest(10.5, 7.6, 2.4, 35);
const libBar = (x, y) => Math.floor(x) === 10 || Math.floor(y) === 19; // mainel e travessa
const libLead = (x, y) => { const px = Math.floor(x), py = Math.floor(y); return px === 7 || px === 13 || py === 12 || py === 26; };
const libTree = (x) => 27.5 + Math.sin(x * 1.3) * 1.3 + hash(x, 0, 7) * 1.2;
const LIB_CANDLE = [20.5, 38]; // base da chama
const LIB_FLOOR = 58;
const LIB_X0 = 26, LIB_X1 = 49, LIB_CX = 38; // laterais e eixo da estante
const LIB_ROWS = [[12, 19], [22, 29], [32, 39], [42, 49]]; // fileiras de livros
const LIB_SPOTS = [[[41, 47]], [[30, 35], [44, 47]], [[39, 42]], [[28, 32]]]; // lugares sem livro em pé
const LIB_FLASK = [32.5, 27.2];
const LIB_STAR = [38, 5];
const libLadder = (y) => 46.4 + (y - 1) * 0.11; // trilho esquerdo da escada

// Raio de sol entrando pela janela: para cada pixel, a distância percorrida desde o vidro (0 = fora do raio).
let libShaftMap = null;
function libShaft() {
  if (libShaftMap) return libShaftMap;
  const m = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (LIB_FRAME(x + 0.5, y + 0.5)) continue;
      for (let s = 2; s < 70; s++) {
        const qx = x + 0.5 - s * 0.5, qy = y + 0.5 - s;
        if (qy < 4) break;
        if (LIB_WIN(qx, qy) && !libBar(qx, qy) && qy < libTree(Math.floor(qx)) + 1) { m[y * 64 + x] = s; break; }
      }
    }
  }
  return (libShaftMap = m);
}

// Luz de um ponto: raio de sol (fixo) mais a vela (g = 0 apagada, 1 no máximo).
function libLight(x, y, g) {
  const s = libShaft()[y * 64 + x];
  const beam = s ? 0.4 * (1 - s / 74) : 0;
  const [cx, cy] = LIB_CANDLE;
  const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy + 1.5) * 1.15);
  return beam + (0.2 + g * 0.2) * clamp01(1 - d / (16 + g * 8)) ** 1.5;
}

function buildLibraryBackdrop(g) {
  const p = new Pix(64, 64);
  const L = (x, y) => libLight(x, y, g);
  // lambris verde-escuro: tábuas verticais com friso e um rodameio
  for (let y = 0; y < LIB_FLOOR; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.2 + L(x, y) - x * 0.002 + (hash(x, y >> 2, 3) - 0.5) * 0.05;
      const bx = x % 5;
      if (bx === 0) v -= 0.12;
      else if (bx === 1) v += 0.05;
      if (y === 42) v += 0.22;
      else if (y === 43) v -= 0.16;
      else if (y > 43) v -= 0.05;
      if (y >= LIB_FLOOR - 2) v -= y === LIB_FLOOR - 2 ? -0.1 : 0.2; // rodapé
      p.d[y * 64 + x] = pick(PANEL, v, x, y, 2);
    }
  }
  // janela em arco: moldura de madeira, vidraças e o céu da manhã lá fora
  p.fill(0, 0, 24, 40, LIB_FRAME, (x, y) => pick(WALNUT, 0.5 - (x + 0.5 - 10.5) * 0.04 + L(x, y) * 0.5 + (y < 6 ? 0.1 : 0), x, y));
  p.fill(0, 0, 24, 40, LIB_WIN, (x, y) => {
    if (libBar(x + 0.5, y + 0.5)) return pick(WALNUT, 0.5 - (x - 10) * 0.1 - (y === 19 ? 0.1 : 0), x, y);
    if (libLead(x + 0.5, y + 0.5)) return C('#3a3e40');
    const top = libTree(x);
    if (y > top) return pick(PAL.tree, 0.92 - (y - top) * 0.1 + (hash(x, y, 8) - 0.5) * 0.3, x, y, 1.6);
    return pick(PAL.morning, 0.15 + ((y - 4) / 26) * 0.8, x, y, 1.6);
  });
  p.rect(1, 34, 20, 2, (x, y) => pick(WALNUT, (y === 34 ? 0.85 : 0.35) - (x - 1) * 0.015 + L(x, y) * 0.4, x, y));
  // mapa do céu emoldurado na parede da direita
  p.rect(54, 9, 9, 13, (x, y) => pick(WALNUT, (x === 54 || y === 9 ? 0.6 : 0.3) + (x === 62 || y === 21 ? -0.15 : 0), x, y));
  p.rect(55, 10, 7, 11, (x, y) => pick(PARCH, 0.42 - (x - 55) * 0.03 - (y - 10) * 0.01 + (hash(x, y, 4) - 0.5) * 0.12, x, y));
  for (const [x0, y0, x1, y1] of [[56, 12, 58, 14], [58, 14, 60, 13], [57, 17, 59, 19], [59, 19, 60, 17]]) p.line(x0, y0, x1, y1, PARCH[1]);
  for (const [x, y] of [[56, 12], [58, 14], [60, 13], [57, 17], [59, 19], [60, 17]]) p.set(x, y, MAGE[3]);
  p.set(59, 11, MAGE[4]);
  // chão de tábuas
  for (let y = LIB_FLOOR; y < 64; y++) {
    const row = (y - LIB_FLOOR) >> 1, ry = (y - LIB_FLOOR) & 1;
    for (let x = 0; x < 64; x++) {
      const board = Math.floor((x + row * 7) / 11);
      let v = 0.3 + (y - LIB_FLOOR) * 0.025 + L(x, y) * 0.9 + (hash(board, row, 9) - 0.5) * 0.12 - x * 0.002;
      if (ry === 0) v += 0.08;
      if ((x + row * 7) % 11 === 0) v -= 0.18;
      p.set(x, y, pick(PAL.wood, v, x, y));
    }
  }
  // tapete lilás com barra verde e losangos
  p.fill(2, 59, 50, 63, (x, y) => y >= 59 && x >= 3 + (63 - y) * 0.5 && x <= 47 - (63 - y) * 0.5, (x, y) => {
    const edge = y === 59 || x < 5 + (63 - y) * 0.5 || x > 45 - (63 - y) * 0.5;
    const light = L(x, y) * 0.8;
    if (edge) return pick(PAL.herb, 0.35 + light + ((x + y) % 2 ? 0.08 : 0), x, y);
    if (y === 60) return (x % 3 === 0) ? PAL.gold[2] : pick(RUG, 0.3 + light, x, y);
    const u = (x - 25 + (y - 61) * 2) & 7, w = (x - 25 - (y - 61) * 2 + 64) & 7;
    if (u === 0 || w === 0) return pick(RUG, 0.72 + light, x, y);
    return pick(RUG, 0.42 + light + (hash(x, y, 10) - 0.5) * 0.1, x, y);
  });
  return p;
}

// Livro em pé na estante: lombada com luz à esquerda e frisos dourados.
function libBook(p, x0, w, top, bot, r, L) {
  const style = hash(x0, top, 17);
  for (let i = 0; i < w; i++) {
    const x = x0 + i;
    const col = w === 1 ? 0.45 : i === 0 ? 0.8 : i === w - 1 ? 0.2 : 0.52;
    for (let y = top; y <= bot; y++) {
      const v = col + L(x, y) * 0.9 - (x - 28) * 0.008 + (y === top ? 0.1 : 0);
      const band = style < 0.65 ? (y === top + 1 || y === bot - 1) : style < 0.85 ? y === top + 2 : false;
      if (band) p.set(x, y, PAL.gold[v > 0.7 ? 4 : v > 0.42 ? 3 : v > 0.2 ? 2 : 1]);
      else p.set(x, y, pick(r, v * 0.92, x, y, 3));
    }
  }
  // etiqueta clara no meio das lombadas largas
  if (w >= 3 && style >= 0.85) {
    const y = Math.round((top + bot) / 2);
    p.set(x0 + 1, y, PARCH[4]);
    p.set(x0 + 1, y + 1, PARCH[3]);
  }
}

// Livro deitado (lombada para fora): duas linhas de cor e frisos nas pontas.
function libLying(p, x0, x1, y, r, L) {
  for (let x = x0; x <= x1; x++) {
    const v = 0.78 - (x - x0) * 0.05 + L(x, y) * 0.6;
    const end = x === x0 + 1 || x === x1 - 1;
    p.set(x, y, end ? PAL.gold[v > 0.6 ? 4 : 3] : pick(r, v, x, y, 3));
    p.set(x, y + 1, end ? PAL.gold[2] : pick(r, v - 0.35, x, y + 1, 3));
  }
}

function buildLibrary(g) {
  const p = new Pix(64, 64);
  const L = (x, y) => libLight(x, y, g);
  const X0 = LIB_X0, X1 = LIB_X1;

  // fundo escuro da estante
  p.rect(X0, 11, X1 - X0 + 1, 47, (x, y) => pick(WALNUT, 0.06 + L(x, y) * 0.4 + (LIB_ROWS.some(([top]) => y === top) ? -0.06 : 0), x, y));
  // brilho verde da poção no fundo da estante
  const [fx, fy] = LIB_FLASK;
  p.fill(fx - 6, fy - 6, fx + 6, fy + 3, (x, y) => Math.hypot(x - fx, y - fy) < 5.5 && y < 30, (x, y) => {
    const d = Math.hypot(x + 0.5 - fx, y + 0.5 - fy) / 5.5;
    return bayer(x, y) < (1 - d) * 0.9 ? POTION[d < 0.6 ? 1 : 0] : 0;
  });

  // livros em pé, fileira por fileira, deixando os lugares dos objetos
  LIB_ROWS.forEach(([top, bot], row) => {
    const spots = LIB_SPOTS[row];
    let prev = -1, x = X0 + 2;
    while (x <= X1 - 2) {
      const s = spots.find(([a, b]) => x >= a && x <= b);
      if (s) { x = s[1] + 1; continue; }
      const next = spots.find(([a]) => a > x);
      const lim = (next ? next[0] : X1 - 1) - x;
      let w = Math.min(lim, 2 + (hash(x, row, 11) < 0.38 ? 1 : 0));
      if (lim - w === 1) w++; // sem fresta de um pixel
      let k = Math.floor(hash(x, row, 12) * BOOKS.length);
      if (k === prev) k = (k + 2) % BOOKS.length;
      prev = k;
      const h = bot - top + 1 - Math.floor(hash(x, row, 13) * 3.4);
      libBook(p, x, w, bot - h + 1, bot, BOOKS[k], L);
      x += w;
    }
  });
  // pilha de livros deitados
  libLying(p, 41, 47, 18, BOOKS[1], L);
  libLying(p, 42, 47, 16, BOOKS[0], L);
  libLying(p, 41, 46, 14, BOOKS[3], L);
  // frasco redondo com a poção verde que brilha
  const fc = Math.floor(fx);
  p.rect(fc - 1, 22, 2, 1, (x) => WALNUT[x < fc ? 6 : 5]);
  p.rect(fc - 1, 23, 2, 2, (x) => GLASS_PALE[x < fc ? 3 : 1]);
  p.fill(fx - 3, 24, fx + 3, 30, (x, y) => ((x - fx) / 2.7) ** 2 + ((y - fy) / 2.5) ** 2 <= 1, (x, y) => {
    const l = sphereLight((x + 0.5 - fx) / 2.7, (y + 0.5 - fy) / 2.5);
    if (y < 26) return pick(GLASS_PALE, 0.2 + l * 0.8, x, y);
    return pick(POTION, 0.25 + l * 0.75, x, y);
  });
  p.set(fc - 2, 26, WHITE);
  // livro inclinado encostado na lateral
  p.poly([[44, 30], [46.6, 30], [48.4, 23.4], [46, 22.6]], (x, y) => pick(BOOKS[4], 0.62 - (x - 44) * 0.08 + L(x, y), x, y, 3));
  for (const [x, y] of [[46, 25], [47, 25], [45, 28], [46, 28]]) p.set(x, y, PAL.gold[3]);
  // ampulheta de latão
  p.rect(39, 33, 4, 1, (x) => PAL.gold[x < 41 ? 4 : 2]);
  p.rect(39, 39, 4, 1, (x) => PAL.gold[x < 41 ? 3 : 1]);
  for (let y = 34; y <= 38; y++) {
    p.set(39, y, WALNUT[5]);
    p.set(42, y, WALNUT[2]);
    if (y === 36) { p.set(40, y, GLASS_PALE[2]); p.set(41, y, PAL.straw[4]); continue; }
    p.set(40, y, y === 35 || y === 38 ? PAL.straw[4] : GLASS_PALE[3]);
    p.set(41, y, y === 34 ? GLASS_PALE[1] : PAL.straw[3]);
  }
  // vaso de hera
  p.rect(29, 46, 4, 4, (x, y) => pick(TERRA, (y === 46 ? 0.85 : 0.5) - (x - 29) * 0.12 + L(x, y) * 0.5, x, y));
  p.sphere(30.5, 44.2, 2.6, 1.9, PAL.herb, 0.05, 1.6);

  // tábuas das prateleiras
  for (const [, bot] of LIB_ROWS) {
    p.rect(X0 + 2, bot + 1, X1 - X0 - 3, 2, (x, y) => pick(WALNUT, (y === bot + 1 ? 0.66 : 0.3) + L(x, y) * 0.8 - (x - X0) * 0.008, x, y));
  }
  // armário de baixo com duas portas
  for (const [d0, d1] of [[X0 + 2, LIB_CX - 1], [LIB_CX, X1 - 2]]) {
    p.rect(d0, 52, d1 - d0 + 1, 5, (x, y) => {
      let v = 0.4 + L(x, y) * 0.7 - (x - X0) * 0.008;
      if (x === d0 || y === 52) v += 0.2;
      else if (x === d1 || y === 56) v -= 0.22;
      else if (x > d0 + 1 && x < d1 - 1) v += y === 53 ? -0.16 : y === 55 ? 0.1 : -0.04;
      return pick(WALNUT, v + (hash(x >> 2, y, 19) - 0.5) * 0.06, x, y);
    });
  }
  p.set(LIB_CX - 2, 54, PAL.gold[4]);
  p.set(LIB_CX + 1, 54, PAL.gold[3]);
  p.rect(X0 - 1, 57, X1 - X0 + 3, 1, (x) => WALNUT[x < LIB_CX ? 2 : 1]);
  // laterais
  p.rect(X0, 8, 2, 50, (x, y) => pick(WALNUT, (x === X0 ? 0.72 : 0.5) + L(x, y) * 0.8 + (hash(x, y >> 2, 21) - 0.5) * 0.08, x, y));
  p.rect(X1 - 1, 8, 2, 50, (x, y) => pick(WALNUT, (x === X1 ? 0.14 : 0.3) + L(x, y) * 0.6 + (hash(x, y >> 2, 22) - 0.5) * 0.08, x, y));
  // cornija com dentículos e o frontão em arco com a estrela dourada
  p.rect(X0 - 2, 7, X1 - X0 + 5, 1, (x) => WALNUT[x < LIB_CX ? 6 : 5]);
  p.rect(X0 - 1, 8, X1 - X0 + 3, 3, (x, y) => pick(WALNUT, [0.6, 0.4, 0.2][y - 8] + L(x, y) * 0.5 - (x - X0) * 0.008, x, y));
  for (let x = X0; x <= X1; x++) p.set(x, 11, (x & 1) ? WALNUT[x < LIB_CX ? 4 : 3] : WALNUT[0]);
  p.fill(LIB_CX - 7, 0, LIB_CX + 7, 7, archTest(LIB_CX, 6, 1, 7), (x, y) => pick(WALNUT, 0.18 + cylLight((x + 0.5 - LIB_CX) / 6) * 0.72 + L(x, y) * 0.4, x, y));
  p.fill(LIB_CX - 5, 2, LIB_CX + 5, 7, archTest(LIB_CX, 4, 3, 7), (x, y) => pick(WALNUT, 0.12 + (y === 3 || x === LIB_CX - 4 ? -0.06 : 0), x, y));
  const [sx, sy] = LIB_STAR;
  for (const [dx, dy, k] of [[0, -2, 4], [-1, -1, 3], [0, -1, 5], [1, -1, 3], [-2, 0, 4], [-1, 0, 5], [0, 0, 5], [1, 0, 4], [2, 0, 3],
    [-1, 1, 3], [0, 1, 4], [1, 1, 2], [0, 2, 2]]) p.set(sx + dx, sy + dy, PAL.gold[k]);
  p.sphere(X1 + 0.5, 5.6, 1.4, 1.4, PAL.gold, 0.05);
  // samambaia num vaso em cima da estante
  p.rect(27, 4, 4, 3, (x, y) => pick(TERRA, (y === 4 ? 0.85 : 0.5) - (x - 27) * 0.12, x, y));
  for (const [x, y, k] of [[26, 3, 4], [25, 4, 3], [24, 5, 2], [27, 2, 4], [28, 1, 5], [29, 2, 4], [30, 1, 4], [31, 2, 3], [32, 3, 3],
    [26, 2, 5], [28, 3, 4], [29, 3, 3], [30, 3, 3], [27, 3, 4], [31, 3, 2], [29, 0, 4], [25, 1, 4], [32, 1, 3]]) p.set(x, y, PAL.herb[k]);

  // ramos da hera descendo pela frente do armário
  for (let y = 47; y <= 57; y++) {
    const x = Math.round(30 + Math.sin(y * 0.8) * 1.2);
    p.set(x, y, PAL.herb[2]);
    if (y % 2) {
      const side = (y >> 1) % 2 ? 1 : -1;
      p.set(x + side, y, PAL.herb[y < 52 ? 4 : 3]);
      p.set(x + side, y - 1, PAL.herb[5]);
    }
  }

  // escada de biblioteca encostada na quina da estante
  p.fill(44, 1, 63, 63, (x, y) => {
    const l = libLadder(y);
    return (x >= l - 0.5 && x < l + 1.5) || (x >= l + 4.5 && x < l + 6.5);
  }, (x, y) => {
    const l = libLadder(y + 0.5);
    const right = x + 0.5 > l + 3 ? 1 : 0;
    const inner = x + 0.5 - l - right * 5;
    const v = (inner < 0.5 ? 0.78 : 0.4) - right * 0.12 + L(x, y) * 0.5 + (hash(x, y >> 1, 23) - 0.5) * 0.1;
    return pick(PAL.wood, v, x, y);
  });
  for (let y = 6; y < 62; y += 5) {
    const l = libLadder(y);
    for (let x = Math.round(l + 1.5); x < l + 4.5; x++) p.set(x, y, PAL.wood[x < l + 3 ? 4 : 3]);
  }
  for (const dx of [0, 5]) {
    const l = Math.round(libLadder(1) - 0.5) + dx;
    p.set(l, 1, PAL.gold[4]);
    p.set(l + 1, 1, PAL.gold[3]);
    p.set(l + Math.round(62 * 0.11), 62, PAL.iron[2]);
    p.set(l + 1 + Math.round(62 * 0.11), 62, PAL.iron[1]);
  }

  // mesa de leitura
  p.rect(0, 45, 24, 3, (x, y) => pick(WALNUT, (y === 45 ? 0.82 : 0.62) + L(x, y) * 0.7 - x * 0.006 + (hash(x >> 2, y, 31) - 0.5) * 0.08, x, y));
  p.rect(0, 48, 24, 2, (x, y) => pick(WALNUT, (y === 48 ? 0.4 : 0.26) + L(x, y) * 0.5 - x * 0.004, x, y));
  p.rect(1, 50, 22, 1, (x, y) => pick(WALNUT, 0.12 + L(x, y) * 0.3, x, y));
  for (const lx of [2, 20]) {
    for (let y = 51; y < 64; y++) {
      const bulb = y === 54 || y === 55 || y === 61;
      const x0 = lx - (bulb ? 1 : 0), x1 = lx + 1 + (bulb ? 1 : 0);
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - (x0 + x1 + 1) / 2) / ((x1 - x0 + 1) / 2);
        p.set(x, y, pick(WALNUT, 0.12 + cylLight(nx) * 0.62 + L(x, y) * 0.5, x, y));
      }
    }
  }
  p.rect(4, 59, 16, 1, (x, y) => pick(WALNUT, 0.42 + L(x, y) * 0.5, x, y));
  // pilha de livros na mesa
  const stack = (x0, x1, y, r) => {
    for (let x = x0; x <= x1; x++) {
      p.set(x, y, pick(r, 0.85 + L(x, y) * 0.4 - (x - x0) * 0.05, x, y, 3));
      const page = x > x0 && x < x1;
      p.set(x, y + 1, page ? pick(PARCH, 0.6 + L(x, y + 1) * 0.4 - (x - x0) * 0.03, x, y + 1) : r[x === x0 ? 2 : 1]);
    }
  };
  stack(0, 6, 43, BOOKS[1]);
  stack(1, 6, 41, BOOKS[0]);
  stack(0, 5, 39, BOOKS[2]);
  // livro aberto: duas páginas com as linhas do texto
  p.rect(7, 46, 11, 1, (x) => BOOKS[3][x < 12 ? 2 : 1]);
  p.set(7, 45, BOOKS[3][3]);
  p.set(17, 45, BOOKS[3][1]);
  for (let x = 8; x <= 16; x++) {
    const top = x === 8 || x === 12 || x === 16 ? 43 : 42;
    for (let y = top; y <= 45; y++) {
      let v = 0.8 - (x > 12 ? 0.12 : 0) + L(x, y) * 0.3 + (y === top ? 0.12 : 0) - (y === 45 ? 0.22 : 0);
      if (x === 12) v -= 0.36; // lombada
      p.set(x, y, pick(PARCH, v, x, y));
    }
  }
  for (const [x, y] of [[9, 43], [10, 43], [9, 44], [11, 44], [14, 43], [15, 43], [13, 44], [14, 44]]) p.set(x, y, PARCH[2]);
  // vela no castiçal de latão
  p.rect(18, 45, 6, 1, (x) => PAL.gold[x < 21 ? 4 : 2]);
  p.rect(20, 44, 2, 1, (x) => PAL.gold[x === 20 ? 4 : 2]);
  p.set(23, 44, PAL.gold[3]);
  p.rect(20, 39, 2, 5, (x, y) => (x === 20 ? WAX[y === 39 ? 3 : 2] : WAX[y === 39 ? 2 : 1]));
  p.set(21, 41, WAX[3]);
  p.set(20, 38, INK);

  p.outline(PAL.out);
  return p;
}

const libArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintLibraryPortrait(ctx, t, info) {
  const a = libArt;
  if (!a.bg) {
    a.bg = buildLibraryBackdrop(0);
    a.body = buildLibrary(0);
    const base = new Pix(64, 64).copyFrom(a.bg).blit(a.body, 0, 0);
    const lit = new Pix(64, 64).copyFrom(buildLibraryBackdrop(1)).blit(buildLibrary(1), 0, 0);
    const [cx, cy] = LIB_CANDLE;
    a.halo = makeHalo(base, lit, (x, y) => Math.hypot(x + 0.5 - cx, (y + 0.5 - cy + 1.5) * 1.15) / 26);
    // poeira só aparece no ar (no raio de sol, fora dos móveis); nuvens só no céu da janela
    const shaft = libShaft();
    a.dust = new Uint8Array(64 * 64);
    a.sky = new Uint8Array(64 * 64);
    for (let i = 0; i < 64 * 64; i++) {
      const x = i & 63, y = i >> 6;
      if (shaft[i] && !a.body.d[i]) a.dust[i] = shaft[i] < 34 ? 2 : 1;
      if (LIB_WIN(x + 0.5, y + 0.5) && !libBar(x + 0.5, y + 0.5) && !libLead(x + 0.5, y + 0.5) && y <= libTree(x)) a.sky[i] = 1;
    }
    a.clouds = [makeCloud(11, 5, 3), makeCloud(8, 4, 8)];
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  // nuvens passando lá fora
  a.clouds.forEach((cl, k) => {
    const ox = Math.floor(((t * (0.7 + k * 0.4) + k * 13) % 30) - 11), oy = 7 + k * 8;
    for (let y = 0; y < cl.h; y++) {
      for (let x = 0; x < cl.w; x++) {
        const c = cl.d[y * cl.w + x], i = (y + oy) * 64 + x + ox;
        if (c && x + ox >= 0 && a.sky[i]) f.d[i] = c;
      }
    }
  });
  f.blit(a.body, 0, 0);
  const flick = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 12.1 + 2) * 0.3 + Math.sin(t * 2.9) * 0.2;
  paintHalo(f, a.halo, 0.42 + live * 0.12 + flick * 0.07 * live);
  paintFlame(f, LIB_CANDLE[0] - 0.5, LIB_CANDLE[1], t, 3.6 + live * 0.6, 1.25, live);
  // poeira dourada flutuando no raio de sol
  const motes = info.working ? 22 : 14;
  for (let k = 0; k < motes; k++) {
    const sp = 0.3 + hash(k, 1, 51) * 0.5;
    const x = Math.floor(4 + ((hash(k, 2, 51) * 46 + t * sp * 0.6 + Math.sin(t * 0.5 + k * 1.7) * 2) % 46));
    const y = Math.floor(6 + ((hash(k, 3, 51) * 56 + t * sp * (k % 3 ? 1.2 : -0.7) + 560) % 56));
    const d = a.dust[y * 64 + x];
    if (d && Math.sin(t * 1.3 + k * 2.1) > -0.4) f.d[y * 64 + x] = d === 2 && k % 3 ? PARCH[5] : PARCH[3];
  }
  // página virando no livro aberto
  const period = info.working ? 3.4 : 7.5;
  if (pulse(t, period, 0, 1.1) > 0) {
    const ang = ((t % period) / 1.1) * Math.PI;
    const tx = 12 + Math.cos(ang) * 4, ty = Math.sin(ang) * 3.4;
    for (let d = 2; d >= 0; d--) f.line(12, 42 + d, tx, 42 + d - ty, PARCH[d === 0 ? 5 : ang < Math.PI / 2 ? 3 : 4]);
  }
  // bolhas subindo na poção e o brilho da estrela no frontão
  const [fx, fy] = LIB_FLASK;
  for (let k = 0; k < 3; k++) {
    const life = (t * (info.working ? 0.9 : 0.45) + k / 3) % 1;
    f.set(fx - 1.5 + k, fy + 2 - life * 3.4, POTION[life > 0.6 ? 5 : 4]);
  }
  sparkle(f, LIB_STAR[0], LIB_STAR[1], pulse(t, info.working ? 4.2 : 6.5, 1.3, 0.6));
  // areia caindo na ampulheta
  if (info.working) f.set(40, 36 + ((t * 2.5) % 1) * 2, PAL.straw[5]);
  f.draw(ctx);
}

function buildLibrarySilhouette() {
  const p = buildLibrary(0);
  paintFlame(p, LIB_CANDLE[0] - 0.5, LIB_CANDLE[1], 0, 4, 1.25, 0);
  return p;
}

// ---------------------------------------------------------------------------
// Sábio

const GSTUDY = ramp('#0b0d0b', '#141712', '#1d211a', '#272d23', '#33392d', '#424838', '#545945', '#6a6c55');
const BEARD = ramp('#4a4654', '#706a7a', '#9a94a0', '#c2bcc2', '#e0dbd6', '#f6f2ea');
const ROBE = ramp('#08160f', '#0e2318', '#153322', '#1e462e', '#295c3c', '#36744c', '#4c8e5e');
const OLD_SKIN = ramp('#4a2622', '#7a4034', '#ab6a52', '#cf9272', '#e8b694', '#f6d4b6');
const NIGHT_GLASS = ramp('#0a0c22', '#121634', '#1c2048', '#282c5c');
const SAGE_EYE = C('#3a5a7a'), SAGE_EYE_HI = C('#8ab0cc');
const SAGE_HEAD = headTest(AX, 30, 9.2, 11.2, 0.3);
const SAGE_CANDLES = [[51.5, 34], [58.5, 32]];
const SAGE_OCULUS = [54.5, 15.5, 6.2];
const SAGE_STARS = [[57, 11], [52, 18], [58, 19], [56, 14], [51, 14]];
const QUILL = [[19.5, 54.5], [15.5, 46], [11.5, 38.5], [8.5, 33], [6.5, 28.5]];
const QUILL_TIP = [19, 55];
const SAGE_RUNES = [[44, 51], [47, 51], [50, 51], [53, 51], [45, 56], [49, 56], [52, 56]];

function sageLight(x, y, g) {
  let v = 0;
  for (const [cx, cy] of SAGE_CANDLES) {
    v += (0.18 + g * 0.14) * clamp01(1 - Math.hypot(x + 0.5 - cx, (y + 0.5 - cy + 2) * 1.1) / (15 + g * 6)) ** 1.5;
  }
  return v;
}

function buildSageBackdrop(g) {
  const p = new Pix(64, 64);
  const L = (x, y) => sageLight(x, y, g);
  // parede de pedra do gabinete, mais clara do lado da janela
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.22 + (1 - x / 64) * 0.06 - y * 0.002 + L(x, y) + masonry(x, y, 7, 4, 93) * 0.8 + (hash(x, y, 94) - 0.5) * 0.04;
      p.d[y * 64 + x] = pick(GSTUDY, v, x, y, 2);
    }
  }
  // estante na parede da esquerda
  p.rect(0, 9, 15, 34, (x, y) => pick(GSTUDY, 0.06 + (x === 14 ? -0.04 : 0), x, y));
  p.rect(14, 9, 2, 34, (x, y) => pick(WALNUT, (x === 14 ? 0.62 : 0.3) + (hash(x, y >> 2, 95) - 0.5) * 0.1, x, y));
  for (const sy of [21, 37]) p.rect(0, sy, 16, 2, (x, y) => pick(WALNUT, (y === sy ? 0.72 : 0.3) - x * 0.01, x, y));
  p.rect(0, 9, 16, 1, (x) => WALNUT[x < 8 ? 4 : 3]);
  // potes de vidro: verde, lilás e âmbar
  p.rect(1, 13, 4, 1, (x) => WALNUT[x < 3 ? 5 : 4]);
  p.rect(1, 14, 4, 7, (x, y) => (y < 16 ? GLASS_PALE[x === 1 ? 3 : 1] : pick(POTION, (x === 1 ? 0.75 : x === 4 ? 0.2 : 0.45) - (y - 16) * 0.04, x, y)));
  p.set(2, 17, POTION[5]);
  p.sphere(8, 18.6, 2.4, 2.3, MAGE, 0.1);
  p.rect(7, 14, 2, 2, (x) => GLASS_PALE[x === 7 ? 3 : 1]);
  p.rect(7, 13, 2, 1, WALNUT[5]);
  p.set(7, 17, MAGE[7]);
  p.rect(11, 16, 2, 5, (x, y) => pick(WARM, (x === 11 ? 0.6 : 0.3) - (y - 16) * 0.03, x, y));
  p.set(11, 15, WALNUT[4]); p.set(12, 15, WALNUT[3]);
  // livros e um rolo de pergaminho na prateleira de baixo
  let bx = 1;
  for (const [w, h, k] of [[2, 7, 0], [2, 6, 3], [3, 8, 1], [2, 7, 4]]) {
    for (let i = 0; i < w; i++) {
      for (let y = 37 - h; y < 37; y++) {
        const band = y === 37 - h + 1 || y === 35;
        p.set(bx + i, y, band ? PAL.gold[i === 0 ? 3 : 2] : BOOKS[k][i === 0 ? 3 : i === w - 1 ? 1 : 2]);
      }
    }
    bx += w;
  }
  p.poly([[10, 37], [11.6, 37], [14, 30], [12.5, 29.4]], (x, y) => pick(BOOKS[5], 0.6 - (x - 10) * 0.08, x, y, 3));
  // viga com ervas secando
  p.rect(0, 0, 26, 2, (x, y) => pick(WALNUT, (y === 0 ? 0.6 : 0.3) + (hash(x >> 2, y, 96) - 0.5) * 0.1, x, y));
  for (const [hx, r] of [[4, PAL.herb], [10, PAL.lavender], [16, PAL.herb]]) {
    p.rect(hx, 2, 1, 2, PARCH[2]);
    for (let y = 4; y < 10; y++) {
      const half = y < 6 ? 1 : (9 - y) * 0.6 + 0.6;
      for (let x = Math.round(hx - half); x <= hx + half; x++) p.set(x, y, pick(r, 0.7 - (x - hx) * 0.15 - (y - 4) * 0.05 + (hash(x, y, 97) - 0.5) * 0.3, x, y));
    }
  }
  // janela redonda com o céu da noite e a lua crescente
  const [ox, oy, orad] = SAGE_OCULUS;
  p.fill(ox - orad - 3, oy - orad - 3, ox + orad + 3, oy + orad + 3, (x, y) => Math.hypot(x - ox, y - oy) <= orad + 2, (x, y) => {
    const d = Math.hypot(x - ox, y - oy);
    const nx = (x - ox) / d, ny = (y - oy) / d;
    const v = 0.45 - (nx + ny) * 0.18 + L(x, y) + ((Math.round(Math.atan2(ny, nx) * 2.5) & 1) ? 0.06 : -0.06);
    return pick(PAL.stone, v, x, y);
  });
  p.fill(ox - orad, oy - orad, ox + orad, oy + orad, (x, y) => Math.hypot(x - ox, y - oy) <= orad, (x, y) =>
    pick(NIGHT_GLASS, 0.2 + (y - oy + orad) / (orad * 2) * 0.7, x, y, 1.6));
  p.fill(48, 9, 56, 17, (x, y) => Math.hypot(x - 52.6, y - 12.6) <= 2.4 && Math.hypot(x - 53.8, y - 11.8) > 2.1, (x, y) => PAL.cloud[x < 52 ? 4 : 3]);
  for (const [x, y] of SAGE_STARS) p.set(x, y, PAL.night[4]);
  p.rect(48, 16, 13, 1, (x, y) => pick(WALNUT, 0.4, x, y));
  // prateleira das velas com mão-francesa
  p.rect(46, 40, 18, 2, (x, y) => pick(WALNUT, (y === 40 ? 0.75 : 0.32) + L(x, y) * 0.8, x, y));
  p.line(61, 42, 61, 46, WALNUT[2]);
  p.line(58, 42, 61, 45, WALNUT[2]);
  for (const [cx, cy] of SAGE_CANDLES) {
    const x0 = Math.floor(cx);
    p.rect(x0 - 1, 39, 4, 1, (x) => PAL.gold[x < x0 + 1 ? 4 : 2]);
    p.rect(x0, cy + 1, 2, 38 - cy, (x, y) => (x === x0 ? WAX[y === cy + 1 ? 3 : 2] : WAX[y === cy + 1 ? 2 : 1]));
    p.set(x0 + 1, cy + 3, WAX[3]);
    p.set(x0, cy, INK);
  }
  // potinho e ampulheta entre as velas
  p.rect(54, 36, 3, 4, (x, y) => (y === 36 ? WALNUT[4] : pick(POTION, (x === 54 ? 0.7 : 0.35) - (y - 37) * 0.08 + L(x, y), x, y)));
  return p;
}

// Olhos atrás dos óculos (dentro de cada lente, 4x3): pálpebra, olho e olheira.
function sageEyes(p, closed) {
  for (const [x0, left] of [[25, true], [36, false]]) {
    for (let i = 0; i < 4; i++) {
      const x = x0 + i;
      if (closed) {
        p.set(x, 26, OLD_SKIN[3]);
        p.set(x, 27, OLD_SKIN[1]);
      } else {
        p.set(x, 26, OLD_SKIN[1]);
        p.set(x, 27, [PAL.eyeWhite, SAGE_EYE_HI, SAGE_EYE, PAL.eyeWhite][i]);
      }
      p.set(x, 28, OLD_SKIN[(left ? i === 3 : i === 0) ? 2 : 3]);
    }
    p.set(x0, 26, C('#f2f6f4')); // reflexo no vidro
  }
}

function buildSage() {
  const p = new Pix(64, 64);
  const mx = (pts) => pts.map(([x, y]) => [65 - x, y]);

  // manto de veludo verde
  p.poly([[0, 64], [1, 56], [6, 50], [15, 46], [24, 44.5], [41, 44.5], [50, 46], [59, 50], [64, 56], [65, 64]], (x, y) => {
    let v = 0.48 - ((x + 0.5 - AX) / 31) * 0.36 - (y - 50) * 0.008;
    v += clamp01(1 - Math.hypot((x - 11) / 7, (y - 51) / 4)) * 0.3; // brilho do veludo no ombro
    if (x === 9 || x === 56) v -= 0.16;
    return pick(ROBE, v, x, y, 1.6);
  });
  // estola lilás
  const stoleL = [[16, 46], [22, 44.6], [24.5, 64], [18, 64]];
  for (const [pts, dark] of [[stoleL, 0], [mx(stoleL), 1]]) {
    p.poly(pts, (x, y) => {
      const v = 0.55 - dark * 0.2 - (y - 46) * 0.006 + (x % 7 === 3 ? -0.08 : 0);
      return pick(MAGE, v, x, y, 1.6);
    });
  }
  // folhinhas douradas bordadas na estola
  for (const [x, y] of [[19, 49], [20, 55], [21, 61]]) {
    for (const [xx, d] of [[x, 1], [64 - x, -1]]) {
      p.set(xx, y, PAL.gold[d > 0 ? 5 : 4]);
      p.set(xx + d, y - 1, PAL.gold[d > 0 ? 4 : 3]);
      p.set(xx - d, y + 1, PAL.gold[2]);
      p.set(xx + d, y, PAL.gold[2]);
    }
  }

  // cabelo branco e ralo nos lados
  p.fill(18, 18, 47, 38, (x, y) => ((x - AX) / 13) ** 2 + ((y - 28) / 10) ** 2 <= 1 && y > 19 && hash(x, y, 98) < 0.92 - Math.max(0, y - 32) * 0.08, (x, y) =>
    pick(BEARD, 0.28 + sphereLight((x + 0.5 - AX) / 13, (y + 0.5 - 26) / 10) * 0.7 + Math.sin(x * 1.7 + y * 0.6) * 0.1, x, y, 1.6));
  // orelhas
  p.sphere(22.8, 30, 1.8, 2.7, OLD_SKIN, 0.05);
  p.sphere(42.2, 30, 1.8, 2.7, OLD_SKIN, -0.2);
  p.set(22, 30, OLD_SKIN[1]);
  p.set(42, 30, OLD_SKIN[0]);
  // rosto
  p.fill(22, 18, 43, 42, SAGE_HEAD, (x, y) => {
    let v = 0.4 + sphereLight((x + 0.5 - AX) / 9.2 * 0.85, (y + 0.5 - 30) / 11.2 * 0.5 - 0.12) * 0.62;
    if (y < 24) v -= 0.16; // sombra do gorro
    return pick(OLD_SKIN, v, x, y, 4);
  });
  // rugas da testa, olheiras e pés de galinha
  for (const x of [27, 28, 29, 35, 36, 37]) p.set(x, 22, OLD_SKIN[2]);
  for (const x of [31, 32, 33]) p.set(x, 23, OLD_SKIN[2]);
  for (const [x, y] of [[23, 28], [23, 30]]) { p.set(x, y, OLD_SKIN[2]); p.set(64 - x, y, OLD_SKIN[1]); }
  for (const x of [26, 27, 28]) { p.set(x, 30, OLD_SKIN[2]); p.set(64 - x, 30, OLD_SKIN[1]); }
  sageEyes(p, false);
  // óculos redondos de aro dourado
  const rim = [[1, 0, 4], [2, 0, 4], [3, 0, 3], [4, 0, 3], [0, 1, 3], [0, 2, 3], [0, 3, 2], [5, 1, 2], [5, 2, 2], [5, 3, 1], [1, 4, 2], [2, 4, 2], [3, 4, 1], [4, 4, 1]];
  for (const lx of [24, 35]) for (const [dx, dy, k] of rim) p.set(lx + dx, 25 + dy, PAL.gold[k - (lx > 32 && k > 1 ? 1 : 0)]);
  for (const [x, y, k] of [[30, 26, 3], [31, 25, 4], [32, 25, 3], [33, 25, 2], [34, 26, 2], [23, 26, 2], [22, 27, 1], [41, 26, 1], [42, 27, 1]]) p.set(x, y, PAL.gold[k]);
  // sobrancelhas brancas e fartas, caindo nas pontas
  for (const [x, y, k] of [[24, 23, 4], [25, 23, 5], [26, 23, 5], [27, 23, 5], [28, 23, 4], [29, 23, 4], [30, 24, 3], [26, 22, 4], [28, 22, 3],
    [23, 24, 4], [22, 25, 3], [24, 24, 3], [25, 24, 3], [27, 24, 2]]) {
    p.set(x, y, BEARD[k]);
    p.set(64 - x, y, BEARD[Math.max(1, k - 1)]);
  }
  // nariz grande
  for (const [x, y, k] of [[32, 27, 4], [32, 28, 4], [32, 29, 5], [33, 29, 3], [33, 28, 3]]) p.set(x, y, OLD_SKIN[k]);
  p.sphere(32.6, 32, 2.4, 1.9, OLD_SKIN, 0.12);
  p.set(31, 33, OLD_SKIN[1]);
  p.set(34, 33, OLD_SKIN[0]);
  p.set(31, 31, OLD_SKIN[5]);
  // faces coradas
  for (const [x, y] of [[25, 31], [26, 32], [24, 32]]) { p.set(x, y, C('#d6866a')); p.set(64 - x, y, C('#c07060')); }

  // barba branca e longa, em mechas onduladas
  const inBeard = (x, y) => {
    if (SAGE_HEAD(x, y)) return y > 36.5 || (Math.abs(x - AX) > 7.4 - Math.max(0, y - 31) * 0.3 && y > 31.5);
    if (y < 36) return false;
    const yy = y - 36;
    const w = yy < 8 ? 10.6 + yy * 0.3 : 13 * Math.sqrt(Math.max(0, 1 - ((yy - 8) / 22) ** 2));
    return Math.abs(x - AX - Math.sin(y * 0.3) * 0.8) <= w + Math.sin(y * 1.3 + x * 0.4) * 0.5;
  };
  p.fill(16, 30, 50, 63, inBeard, (x, y) => {
    const sx = x + Math.sin(y * 0.42) * 1.4 - (x - AX) * (y - 38) * 0.02;
    const l = sphereLight((x + 0.5 - 30) / 13, (y + 0.5 - 40) / 16);
    let v = 0.38 + l * 0.62 + (hash(Math.floor(sx / 2), 3, 91) - 0.5) * 0.24;
    if (Math.floor(sx) % 3 === 0) v -= 0.13;
    if (y > 57) v -= (y - 57) * 0.03;
    return pick(BEARD, v, x, y, 2.4);
  });
  // bigode caído e a boca
  for (const [x, y, k] of [[29, 34, 4], [30, 34, 5], [31, 34, 5], [32, 34, 4], [33, 34, 4], [34, 34, 4], [35, 34, 3],
    [27, 35, 4], [28, 35, 5], [29, 35, 4], [30, 35, 4], [31, 35, 3], [32, 35, 3], [33, 35, 3], [34, 35, 3], [35, 35, 3], [36, 35, 2], [37, 35, 2],
    [26, 36, 4], [27, 36, 3], [28, 36, 3], [37, 36, 2], [38, 36, 2], [25, 37, 3], [26, 37, 2], [39, 37, 1], [38, 37, 2]]) p.set(x, y, BEARD[k]);
  for (let x = 30; x <= 35; x++) p.set(x, 36, OLD_SKIN[0]);
  for (let x = 31; x <= 34; x++) p.set(x, 37, x === 31 ? C('#b46a5a') : PAL.lip);

  // gorro de veludo lilás: copa fofa que cai para a direita, aro bordado
  const inCap = (x, y) => (((x - 33) / 12.6) ** 2 + ((y - 13) / 8.6) ** 2 <= 1 && y < 21) || (((x - 44) / 6.6) ** 2 + ((y - 16.5) / 4.6) ** 2 <= 1 && y < 21.5);
  p.fill(18, 3, 52, 22, inCap, (x, y) => {
    const main = ((x - 33) / 12.6) ** 2 + ((y - 13) / 8.6) ** 2 <= 1;
    const nx = (x + 0.5 - 33) / 12.6, ny = (y + 0.5 - 11) / 8.6;
    const ang = Math.atan2(y + 0.5 - 8, x + 0.5 - 32);
    let v = 0.1 + sphereLight(nx, ny) * 0.85 + Math.sin(ang * 6 + 0.4) * 0.09;
    if (!main) v = 0.2 + sphereLight((x + 0.5 - 44) / 6.6, (y + 0.5 - 15) / 4.6) * 0.55; // ponta caída
    if (y > 18) v -= (y - 18) * 0.06;
    return pick(MAGE, v, x, y, 1.6);
  });
  p.sphere(29, 6.5, 1.3, 1.1, PAL.gold, 0.2);
  const band = (x) => 18.5 + 1.3 * (1 - ((x + 0.5 - AX) / 12) ** 2);
  for (let x = 21; x <= 44; x++) {
    const c = Math.round(band(x));
    const lit = cylLight((x + 0.5 - AX) / 12.6);
    for (let k = -1; k <= 1; k++) {
      let col;
      if (k === 0) col = x % 4 === 1 ? POTION[lit > 0.5 ? 4 : 3] : PAL.gold[lit > 0.62 ? 4 : lit > 0.35 ? 3 : 2];
      else col = pick(MAGE, 0.15 + lit * 0.5 + (k < 0 ? 0.12 : -0.1), x, c + k);
      p.set(x, c + k, col);
    }
  }
  p.set(50, 19, PAL.gold[4]); // presilha da borla
  p.set(49, 19, PAL.gold[2]);

  // mão direita segurando a pena
  p.poly([[0, 64], [0, 53], [5, 50], [11, 49.4], [15.5, 54], [14, 64]], (x, y) => pick(ROBE, 0.55 - (y - 52) * 0.02 + (x < 6 ? 0.1 : 0), x, y, 1.6));
  p.poly([[10, 49.2], [12.6, 48.2], [17, 53.6], [14.4, 55]], (x, y) => ((x + y) % 4 === 0 ? PAL.gold[3] : pick(MAGE, 0.62 - (x - 10) * 0.04, x, y)));
  p.fill(0, 26, 22, 56, (x, y) => {
    if (y > 47) return false;
    const [d] = nearestOnPath(QUILL, x, y);
    const hw = 0.5 + clamp01((46 - y) / 4) * 1.9 * Math.sqrt(clamp01((y - 27.6) / 6));
    return d <= hw;
  }, (x, y) => {
    const [d, ox, oy] = nearestOnPath(QUILL, x + 0.5, y + 0.5);
    if (d < 0.55) return PARCH[y < 33 ? 5 : 4]; // haste
    const side = ox * 0.9 - oy * 0.4; // lado de cima e de baixo da pena
    let v = (side < 0 ? 0.82 : 0.5) + (y < 33 ? 0.05 : 0) - ((x + y) % 2 ? 0.08 : 0);
    if (y < 34) return pick(MAGE, v + 0.2, x, y); // ponta tingida de lilás
    return pick(BEARD, v, x, y);
  });
  for (let y = 47; y <= 54; y++) {
    const [x] = [19.5 - (54.5 - y) * 0.47];
    p.set(x, y, PARCH[y < 51 ? 4 : 2]);
  }
  p.sphere(16.4, 50.8, 3.1, 2.7, OLD_SKIN, 0.15);
  for (const x of [15, 16, 17]) p.set(x, 52, OLD_SKIN[1]);
  p.set(18, 50, OLD_SKIN[1]);
  p.line(13, 49, 15, 48, OLD_SKIN[4]);
  p.set(QUILL_TIP[0], QUILL_TIP[1], INK);
  p.set(QUILL_TIP[0] - 1, QUILL_TIP[1] - 1, PAL.gold[2]);

  // pergaminho aberto na mão esquerda
  p.poly([[64, 64], [64, 51], [61.5, 47.5], [57.5, 49], [58.5, 64]], (x, y) => pick(ROBE, 0.32 - (x - 58) * 0.02, x, y, 1.6));
  p.poly([[39.5, 47.6], [56.8, 46.4], [58.6, 64], [41, 64]], (x, y) => {
    let v = 0.75 - (x - 40) * 0.016 + Math.sin(y * 0.55) * 0.06 - (y - 48) * 0.006 + (hash(x, y, 99) - 0.5) * 0.08;
    if (x <= 40.6 + (y - 48) * 0.08) v += 0.12;
    return pick(PARCH, v, x, y);
  });
  for (const y of [54, 59, 61, 63]) {
    for (let x = 43; x <= 55; x++) {
      if (hash(x >> 1, y, 100) < 0.22) continue;
      p.set(x + Math.round((y - 48) * 0.08), y, PARCH[1]);
    }
  }
  // runas lilases já escritas
  for (const [x, y] of SAGE_RUNES) {
    p.set(x, y, MAGE[3]);
    p.set(x + 1, y - 1, MAGE[4]);
    p.set(x + 1, y + 1, MAGE[3]);
  }
  // rolo de cima com os puxadores
  p.fill(37, 43, 60, 49, (x, y) => {
    const s = clamp01((x + 0.5 - 38) / 20);
    const cy = 47.4 - s * 1.4;
    return x >= 38 && x <= 58 && Math.abs(y + 0.5 - cy) <= 1.6;
  }, (x, y) => {
    const s = clamp01((x + 0.5 - 38) / 20);
    const ny = (y + 0.5 - (47.4 - s * 1.4)) / 1.6;
    return pick(PARCH, 0.2 + cylLight(ny) * 0.85, x, y);
  });
  p.rect(36, 46, 2, 3, (x) => WALNUT[x === 36 ? 5 : 3]);
  p.sphere(58.6, 46, 2.9, 2.5, OLD_SKIN, 0.05);
  for (const y of [46, 48]) p.line(57, y, 60, y - 0.5, OLD_SKIN[1]);
  p.set(56, 44, OLD_SKIN[4]);

  p.outline(PAL.out);
  return p;
}

// Borla dourada pendurada na ponta do gorro: cordão, nó e franja que balança.
const tasselPix = new Pix(9, 11);
function paintTassel(f, t, live) {
  const q = tasselPix.clear();
  const sw = Math.sin(t * 1.7) * 0.9 * (0.6 + live * 0.4) + Math.sin(t * 3.1) * 0.25;
  const x0 = 4;
  q.set(x0, 1, PAL.gold[2]);
  q.set(x0 + Math.round(sw * 0.3), 2, PAL.gold[2]);
  q.set(Math.round(x0 + sw * 0.6), 3, PAL.gold[5]);
  for (let k = 0; k < 4; k++) {
    const cx = x0 + 0.5 + sw * (0.7 + k * 0.18);
    const half = k === 0 ? 1 : 1.5;
    for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) {
      q.set(x, 4 + k, PAL.gold[x + 0.5 < cx - 0.6 ? 4 : x + 0.5 > cx + 0.4 ? 2 : 3]);
    }
  }
  q.outline(PAL.out);
  for (let x = 0; x < q.w; x++) q.d[x] = 0; // não cobre a presilha
  f.blit(q, 50 - x0, 19);
}

const sageArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintSagePortrait(ctx, t, info) {
  const a = sageArt;
  if (!a.bg) {
    a.bg = buildSageBackdrop(0);
    a.halo = makeHalo(a.bg, buildSageBackdrop(1), (x, y) => Math.min(...SAGE_CANDLES.map(([cx, cy]) => Math.hypot(x + 0.5 - cx, (y + 0.5 - cy + 2) * 1.1))) / 24);
    a.body = buildSage();
    // pixels dos aros dos óculos, onde corre o brilho
    a.rims = rampPixels(a.body, PAL.gold, 22, 23, 43, 32);
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  const flick = Math.sin(t * 7.9) * 0.5 + Math.sin(t * 13.3 + 1) * 0.3 + Math.sin(t * 3.1) * 0.2;
  paintHalo(f, a.halo, 0.42 + live * 0.12 + flick * 0.07 * live);
  SAGE_CANDLES.forEach(([x, y], i) => paintFlame(f, x - 0.5, y, t * (0.9 + i * 0.17) + i * 2, 3 + live * 0.6, 1.1, live * 0.7));
  // estrelas piscando na janela redonda
  SAGE_STARS.forEach(([x, y], k) => {
    const s = Math.sin(t * (1.3 + k * 0.4) + k * 2.2);
    if (s > 0.2) f.set(x, y, s > 0.75 ? WHITE : PAL.cloud[2]);
  });
  f.blit(a.body, 0, 0);
  paintTassel(f, t, live);
  if (t % 5.1 > 4.95 || t % 11.3 > 11.15) sageEyes(f, true);
  // brilho correndo pelos óculos
  sweepGlint(f, a.rims, PAL.gold, ((t % (info.working ? 3.2 : 5)) - 0.6) * 40 + 30, 1.6);
  // ponta da pena acesa e runas brilhando no pergaminho
  const [qx, qy] = QUILL_TIP;
  const glow = 0.5 + Math.sin(t * 3.3) * 0.25 + (info.working ? 0.25 : 0);
  paintWisp(f, qx, qy, glow, MAGE);
  SAGE_RUNES.forEach(([x, y], k) => {
    const e = pulse(t * (info.working ? 1 : 0.5), 2.4, -k * 0.3, 0.9);
    if (e > 0.2) { f.set(x, y, MAGE[e > 0.7 ? 7 : 6]); f.set(x + 1, y - 1, MAGE[e > 0.6 ? 6 : 5]); f.set(x + 1, y + 1, MAGE[5]); }
  });
  // faíscas lilases subindo do pergaminho
  const n = info.working ? 6 : 3;
  for (let k = 0; k < n; k++) {
    const life = (t * (0.35 + hash(k, 1, 101) * 0.25) + hash(k, 2, 101)) % 1;
    const x = 44 + hash(k, 3, 101) * 11 + Math.sin(t * 1.6 + k * 2) * 1.6;
    const y = 52 - life * 22;
    paintWisp(f, x, y, Math.sin(life * Math.PI) * (k % 2 ? 0.9 : 0.6), k % 3 === 2 ? POTION : MAGE);
  }
  f.draw(ctx);
}

function buildSageSilhouette() {
  const p = buildSage();
  paintTassel(p, 0, 1);
  return p;
}

// ---------------------------------------------------------------------------
// Observatório

const NIGHT_SKY = ramp('#06061a', '#0b0c24', '#111432', '#191b40', '#22244e', '#2e2c5c', '#3c366a', '#4e4278', '#645286');
const NEBULA = ramp('#241e4c', '#342a62', '#4a3a7a', '#665092', '#8a70b0');
const MOON = ramp('#5e5a7c', '#8c88a6', '#b8b4c8', '#dcd8e0', '#f6f2ea', '#fffdf4');
const NSTONE = ramp('#121220', '#1b1b2c', '#26263a', '#33334a', '#43425a', '#56536c', '#6d6882', '#8a8298');
const NGRASS = ramp('#050c10', '#0a1618', '#102220', '#172e28', '#203c32', '#2c4c3c');
const NFAR = ramp('#0c0e24', '#121530', '#191c3c', '#212448', '#2b2c54');
const BRASS = ramp('#2e1c0c', '#563814', '#86602a', '#b48a40', '#d8b464', '#f2dc9c', '#fff6d6');
const NCLOUD = ramp('#1c1a3a', '#28244a', '#38325c', '#4a426e', '#5e5480');
const OBS_MOON = [12.5, 11.5, 5.5];
const OBS_TX = 31.5, OBS_TR = 8.5; // eixo e raio da torre
const OBS_DOME = [31.5, 29, 10.4, 12.4];
const OBS_PIVOT = [34.5, 24], OBS_LENS = [52.6, 8.4];
const OBS_LANTERN = [37, 47];
const obsHill = (x) => 53.5 + ((x + 0.5 - 30) / 30) ** 2 * 8;
// coordenadas ao longo da luneta: s (0 no pivô, 1 na lente) e a distância lateral
const obsTube = (() => {
  const [px, py] = OBS_PIVOT, [lx, ly] = OBS_LENS;
  const dx = lx - px, dy = ly - py, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  return (x, y) => {
    const qx = x - px, qy = y - py;
    return [(qx * ux + qy * uy) / len, qx * -uy + qy * ux, len];
  };
})();
// estrelas que cintilam: x, y, fase, velocidade, tamanho
const OBS_STARS = [[4, 27, 0.3, 1.7, 1], [22, 4, 1.9, 2.3, 2], [29, 12, 4.1, 1.4, 0], [40, 3, 2.6, 2.9, 1], [46, 16, 0.9, 1.9, 0],
  [58, 3, 5.2, 1.3, 2], [61, 20, 3.3, 2.1, 1], [6, 40, 2.2, 1.6, 0], [55, 30, 1.1, 2.6, 1], [44, 26, 4.7, 1.2, 0],
  [26, 22, 3.8, 2.4, 0], [16, 33, 0.6, 1.9, 1], [35, 7, 2.9, 3.1, 0], [62, 38, 1.4, 1.5, 0]];

function buildObservatoryBackdrop() {
  const p = new Pix(64, 64);
  const [mx, my, mr] = OBS_MOON;
  // céu da noite, mais claro em volta da lua e perto do horizonte
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const md = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      // via láctea: faixa de nebulosa lilás atravessando o céu na diagonal
      const u = y + 0.62 * x - 42 + Math.sin(x * 0.21) * 2.2;
      const band = clamp01(1 - Math.abs(u) / 9);
      let v = 0.04 + (y / 56) * 0.66 + clamp01(1 - md / 20) ** 2 * 0.34 + band * 0.12;
      let c = pick(NIGHT_SKY, v, x, y, 1.4);
      const n = hash(x >> 1, y >> 1, 61) * 0.6 + hash(x, y, 62) * 0.4;
      if (band > 0.15 && n < band * 0.52) c = pick(NEBULA, band * 0.9 + (hash(x, y, 63) - 0.5) * 0.3, x, y);
      if (hash(x, y, 64) < 0.035 * band) c = n < 0.3 ? C('#d8d0f4') : NEBULA[4];
      p.d[y * 64 + x] = c;
    }
  }
  // estrelas fixas e fracas
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(hash(i, 1, 65) * 64), y = Math.floor(hash(i, 2, 65) * 46);
    if (Math.hypot(x - mx, y - my) > mr + 3) p.set(x, y, i % 4 ? NIGHT_SKY[7] : C('#a8a4c8'));
  }
  // lua cheia com crateras
  p.fill(mx - mr, my - mr, mx + mr, my + mr, (x, y) => Math.hypot(x - mx, y - my) <= mr, (x, y) => {
    const nx = (x + 0.5 - mx) / mr, ny = (y + 0.5 - my) / mr;
    let v = 0.42 + sphereLight(nx, ny) * 0.62;
    for (const [cx, cy, r] of [[-0.35, -0.2, 0.28], [0.32, 0.18, 0.32], [-0.05, 0.5, 0.2], [0.45, -0.45, 0.16]]) {
      if (Math.hypot(nx - cx, ny - cy) < r) v -= 0.22;
    }
    return pick(MOON, v, x, y);
  });
  // serra ao longe com pinheiros
  for (let x = 0; x < 64; x++) {
    let top = 47 + 2.4 * Math.sin(x * 0.11 + 1) + 1.4 * Math.sin(x * 0.31);
    for (const [px, h] of [[3, 6], [7, 4], [12, 7], [45, 5], [50, 8], [55, 5], [60, 7]]) {
      const d = Math.abs(x - px);
      if (d < h * 0.32) top = Math.min(top, 47.5 - h + d * 3.1 + Math.sin(px) * 1.5);
    }
    top = Math.round(top);
    for (let y = top; y < 64; y++) p.set(x, y, pick(NFAR, (y === top ? 0.85 : 0.5) - (y - top) * 0.04 + (hash(x, y, 66) - 0.5) * 0.1, x, y));
  }
  return p;
}

function buildObservatory() {
  const p = new Pix(64, 64);
  const tc = OBS_TX, tr = OBS_TR;
  // morro gramado com a crista prateada pelo luar
  p.fill(0, 50, 63, 63, (x, y) => y + 0.5 >= obsHill(x), (x, y) => {
    let v = 0.06 + sphereLight((x + 0.5 - 22) / 44, (y + 0.5 - 76) / 26) * 0.75 - (y - 54) * 0.01;
    if (y + 0.5 < obsHill(x) + 1.2) v += 0.22;
    if (hash(x, y, 67) < 0.08) v += 0.18;
    else if (hash(x, y - 1, 67) < 0.08) v -= 0.15;
    return pick(NGRASS, v, x, y, 1.6);
  });
  // trilha até a porta
  for (let y = 55; y < 64; y++) {
    const k = y - 55, c = tc + 1 + k * 1.1 + Math.sin(k * 0.5) * 0.8, hw = 1.4 + k * 0.2;
    for (let x = Math.floor(c - hw); x <= c + hw; x++) {
      p.set(x, y, pick(NSTONE, 0.42 + (hash(x, y, 68) - 0.5) * 0.3 - (x + 0.5 - c) * 0.05 + (Math.abs(x + 0.5 - c) > hw - 0.8 ? -0.15 : 0), x, y));
    }
  }
  // moitas
  for (const [x, y, r] of [[6, 59, 3.4], [11, 61, 2.6], [52, 59, 3], [57, 60, 3.2], [47, 62, 2.2]]) p.sphere(x, y, r, r * 0.8, NGRASS, 0.12, 1.6);

  // torre de pedra (blocos curvos, porque ela é redonda)
  const tower = (x, y, rr, oy) => {
    const nx = clamp01((x + 0.5 - tc) / rr / 2 + 0.5) * 2 - 1;
    const u = Math.asin(Math.max(-1, Math.min(1, nx))) * 5.2;
    const row = Math.floor((y - oy) / 3), ry = (((y - oy) % 3) + 3) % 3;
    const bu = u + (row & 1) * 0.5;
    let v = 0.06 + cylLight(nx) * 0.82 + (hash(Math.floor(bu), row, 69) - 0.5) * 0.14;
    if (ry === 2 || bu - Math.floor(bu) < 0.16) v -= 0.16;
    return v;
  };
  p.fill(tc - tr - 1, 31, tc + tr + 1, 56, (x, y) => Math.abs(x - tc) <= tr && y + 0.5 <= obsHill(x) + 1.5, (x, y) =>
    pick(NSTONE, tower(x, y, tr, 31), x, y));
  // embasamento e a cinta de pedra
  p.fill(tc - tr - 2, 50, tc + tr + 2, 56, (x, y) => Math.abs(x - tc) <= tr + 1 && y >= 51 && y + 0.5 <= obsHill(x) + 1.5, (x, y) =>
    pick(NSTONE, tower(x, y, tr + 1, 51) + (y === 51 ? 0.18 : 0), x, y));
  p.fill(tc - tr - 2, 43, tc + tr + 2, 44, (x) => Math.abs(x - tc) <= tr + 0.8, (x, y) =>
    pick(NSTONE, 0.1 + cylLight((x + 0.5 - tc) / (tr + 0.8)) * 0.85 + (y === 43 ? 0.16 : -0.2), x, y));
  // janelas em arco, acesas por dentro
  for (const [wx, top] of [[27.5, 34], [35.5, 36]]) {
    p.fill(wx - 3, top - 1, wx + 3, top + 7, archTest(wx, 2.4, top - 1, top + 6), (x, y) => pick(NSTONE, 0.62 - (x - wx) * 0.08, x, y));
    p.fill(wx - 2, top, wx + 2, top + 6, archTest(wx, 1.5, top, top + 5), (x, y) => pick(WARM, 0.72 - (y - top) * 0.06 - (x + 0.5 - wx) * 0.1, x, y));
    p.rect(Math.floor(wx) - 2, top + 6, 5, 1, (x) => NSTONE[x < wx ? 6 : 4]);
  }
  // porta de madeira com ferragens
  const dc = tc;
  p.fill(dc - 4, 44, dc + 4, 54, archTest(dc, 3.4, 45, 54), (x, y) => pick(NSTONE, 0.66 - (x + 0.5 - dc) * 0.07 + ((x + y) % 3 === 0 ? -0.08 : 0), x, y));
  p.fill(dc - 3, 46, dc + 3, 54, archTest(dc, 2.4, 46.4, 54), (x, y) => {
    let v = 0.42 - (x + 0.5 - dc) * 0.06 - (Math.floor(x + 0.5 - dc + 3) % 2 === 0 ? 0.1 : 0);
    if (y === 49 || y === 52) return PAL.iron[x < dc ? 2 : 1];
    return pick(PAL.wood, v, x, y);
  });
  p.set(Math.floor(dc) + 1, 51, PAL.gold[4]);
  // hera subindo pelo lado da torre que pega o luar
  for (let y = 38; y <= 54; y++) {
    const w = 1.6 + (y - 38) * 0.14 + Math.sin(y * 1.3) * 0.7;
    for (let x = Math.floor(tc - tr - 1); x <= tc - tr - 1 + w; x++) {
      if (hash(x, y, 72) < 0.25 + (y - 38) * 0.03 && y < obsHill(x) + 1) p.set(x, y, pick(PAL.herb, 0.2 + (hash(x, y, 73) * 0.5) - (x - tc + tr) * 0.05, x, y));
    }
  }
  p.rect(tc - 4, 55, 9, 1, (x) => NSTONE[x < tc ? 5 : 3]);
  // lanterna presa na parede ao lado da porta
  const [lx, ly] = OBS_LANTERN;
  p.line(lx - 2, ly - 4, lx, ly - 4, PAL.iron[2]);
  p.rect(lx - 1, ly - 3, 3, 1, PAL.iron[3]);
  p.rect(lx - 1, ly + 1, 3, 1, PAL.iron[1]);
  p.set(lx - 1, ly - 1, PAL.iron[2]); p.set(lx + 1, ly - 1, PAL.iron[1]);
  p.set(lx - 1, ly, PAL.iron[2]); p.set(lx + 1, ly, PAL.iron[1]);
  p.set(lx, ly - 2, PAL.iron[2]);

  // cúpula de cobre esverdeado, com gomos e a fenda aberta
  const [cx, cy, rx, ry] = OBS_DOME;
  const slit = (lam) => lam > 0.1 && lam < 0.46;
  p.fill(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && y < cy, (x, y) => {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    const lam = Math.asin(Math.max(-1, Math.min(1, nx / Math.sqrt(Math.max(0.02, 1 - ny * ny)))));
    if (slit(lam)) return y > cy - 3 ? pick(WARM, 0.12 - (cy - y) * 0.04, x, y) : pick(NIGHT_SKY, 0.1, x, y); // interior escuro
    let v = 0.1 + sphereLight(nx, ny) * 0.9;
    const k = lam / (Math.PI / 8);
    const f = k - Math.round(k);
    if (Math.abs(f) < 0.13) v -= 0.22;
    else if (f > 0.13 && f < 0.3) v += 0.1;
    if (Math.abs(lam - 0.1) < 0.07 || Math.abs(lam - 0.46) < 0.07) v += 0.22; // bordas da fenda
    return pick(VERDI, v, x, y, 1.6);
  });
  // luneta de latão saindo pela fenda
  p.fill(30, 2, 58, 26, (x, y) => {
    const [s, d] = obsTube(x + 0.5, y + 0.5);
    return s >= 0 && s <= 1 && Math.abs(d) <= 1.3 + s * 0.8;
  }, (x, y) => {
    const [s, d] = obsTube(x + 0.5, y + 0.5);
    const hw = 1.3 + s * 0.8;
    let v = 0.1 + cylLight(-d / hw * 0.9) * 0.82;
    if (Math.abs(s - 0.42) < 0.03 || Math.abs(s - 0.7) < 0.03) v -= 0.3; // anéis
    if (s > 0.9) v += 0.14;
    return pick(BRASS, v, x, y);
  });
  // lente na boca da luneta e a lunetinha de mira por cima
  const [lensX, lensY] = OBS_LENS;
  for (const [dx, dy, c] of [[0, 0, '#1a2a5a'], [1, 0, '#2a4a8a'], [0, 1, '#10183a'], [1, 1, '#1a2a5a'], [-1, 1, '#2a4a8a']]) p.set(Math.floor(lensX) + dx, Math.floor(lensY) + dy, C(c));
  for (let s = 0.48; s <= 0.78; s += 0.04) {
    const [px, py] = OBS_PIVOT;
    const x = px + (lensX - px) * s - 0.62 * 2.8, y = py + (lensY - py) * s - 0.79 * 2.8;
    p.set(x, y, BRASS[s < 0.5 || s > 0.76 ? 2 : 4]);
  }
  // galeria em volta da cúpula: piso de pedra e o parapeito de ferro
  p.fill(tc - tr - 3, 29, tc + tr + 3, 31, (x) => Math.abs(x + 0.5 - tc) <= tr + 2.6, (x, y) =>
    pick(NSTONE, 0.12 + cylLight((x + 0.5 - tc) / (tr + 2.6)) * 0.8 + (y === 29 ? 0.2 : y === 31 ? -0.25 : 0), x, y));
  for (let x = Math.ceil(tc - tr - 2.6); x <= tc + tr + 2; x++) if ((x & 1) === 0) p.set(x, 32, NSTONE[1]);
  p.rect(Math.ceil(tc - tr - 2.6), 26, Math.floor(tr * 2 + 5), 1, (x) => PAL.iron[x < tc ? 3 : 2]);
  for (let x = Math.ceil(tc - tr - 2.6); x <= tc + tr + 2; x += 2) {
    p.set(x, 27, PAL.iron[2]); p.set(x, 28, PAL.iron[1]);
  }
  p.outline(PAL.out);
  return p;
}

const obsArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintObservatoryPortrait(ctx, t, info) {
  const a = obsArt;
  if (!a.bg) {
    a.bg = buildObservatoryBackdrop();
    a.body = buildObservatory();
    a.cloud = makeCloud(24, 7, 4, NCLOUD);
    a.windows = [];
    for (let y = 30; y < 56; y++) {
      for (let x = 20; x < 44; x++) {
        const k = WARM.indexOf(a.body.get(x, y));
        if (k >= 0) a.windows.push([x, y, k / (WARM.length - 1)]);
      }
    }
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  // estrelas cintilando
  for (const [x, y, ph, sp, big] of OBS_STARS) {
    const s = 0.5 + 0.5 * Math.sin(t * sp + ph) * Math.sin(t * sp * 0.37 + ph * 2);
    if (big && s > 0.62) sparkle(f, x, y, (s - 0.55) * (big === 2 ? 2.2 : 1.6), WHITE, NEBULA[4]);
    else f.set(x, y, s > 0.66 ? WHITE : s > 0.33 ? C('#b4b0d8') : NIGHT_SKY[8]);
  }
  // estrela cadente de vez em quando
  const period = info.working ? 5.5 : 10;
  const ph = (t % period) / 0.8;
  if (ph < 1) {
    const sx = 50 - Math.floor(t / period) * 17 % 30, sy = 3 + Math.floor(t / period) * 7 % 12;
    for (let k = 0; k < 7; k++) {
      const q = ph - k * 0.045;
      if (q < 0 || q > 1) continue;
      const x = sx - q * 24, y = sy + q * 10;
      f.set(x, y, k === 0 ? WHITE : k < 3 ? C('#d8d0f4') : NEBULA[3]);
    }
  }
  // nuvem fina passando
  f.blit(a.cloud, ((t * 1.3) % 100) - 30, 13);
  f.blit(a.body, 0, 0);
  // janelas e lanterna com a luz tremendo
  for (const [x, y, k] of a.windows) {
    const fl = Math.sin(t * 7 + x * 1.3) * 0.5 + Math.sin(t * 13.1 + y * 2.1) * 0.5;
    f.set(x, y, pick(WARM, k + fl * 0.1 * live + (live - 0.8) * 0.15, x, y, 1.2));
  }
  paintFlame(f, OBS_LANTERN[0] - 0.5, OBS_LANTERN[1] + 0.6, t, 2.2 + live * 0.4, 0.9, live);
  // luz das estrelas escorrendo para dentro da luneta
  const [lensX, lensY] = OBS_LENS;
  const n = info.working ? 7 : 3;
  for (let k = 0; k < n; k++) {
    const life = (t * (0.28 + hash(k, 1, 71) * 0.18) + hash(k, 2, 71)) % 1;
    const sx = 40 + hash(k, 3, 71) * 26, sy = -2 + hash(k, 4, 71) * 10;
    const e = life * life;
    const x = sx + (lensX + 1 - sx) * e + Math.sin(t * 2 + k) * (1 - e) * 2, y = sy + (lensY - sy) * e;
    paintWisp(f, x, y, Math.sin(life * Math.PI) * 0.95, k % 3 === 1 ? VERDI : MAGE);
  }
  sparkle(f, Math.floor(lensX) + 1, Math.floor(lensY), pulse(t, info.working ? 2.2 : 4.4, 0.4, 0.5), WHITE, MAGE[6]);
  // vaga-lumes nas moitas
  for (let k = 0; k < 5; k++) {
    const bx = [7, 13, 50, 56, 44][k], by = [56, 58, 56, 57, 60][k];
    const x = bx + Math.sin(t * 0.7 + k * 2.1) * 3.5, y = by + Math.sin(t * 1.1 + k * 1.3) * 2;
    const s = Math.sin(t * 2.3 + k * 3.7);
    if (s > 0.1) f.set(x, y, s > 0.6 ? C('#e6f490') : C('#8ab048'));
  }
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Academia

const TWILIGHT = ramp('#1a1636', '#241e4a', '#33295e', '#46346e', '#5c407c', '#764c86', '#925c8c', '#b07090', '#cc8c92', '#e4ac98', '#f4cca4');
const MARBLE = ramp('#3a3046', '#574a60', '#78687c', '#9a8896', '#bcaab0', '#dccac4', '#f4e6da');
const AFAR = ramp('#1e1a3a', '#2a2248', '#382c58', '#4a3866', '#5c4674');
const ACLOUD = ramp('#4e3a68', '#6e5080', '#966c94', '#c08c9c', '#e6b2aa');
const FLAGSTONE = ramp('#2a2236', '#3c3248', '#52465a', '#6a5c6c', '#84747e', '#a08e92');
const TOGA = ramp('#5a5064', '#8a7e8c', '#b8acb2', '#dcd2cc', '#f6f0e6');
const BANNER_GREEN = ramp('#0c2416', '#163c22', '#235a30', '#347a40', '#4c9a52', '#6aba6a');
const ACAD_COLS = [18.5, 27.5, 37.5, 46.5];
const ACAD_ORB = [32.5, 2.4];
const ACAD_POLES = [3, 60];
const ACAD_X0 = 12, ACAD_X1 = 52; // paredes do prédio
const ACAD_APEX = 15, ACAD_BASE = 25; // frontão
const ACAD_COURT = 51; // começo do pátio
const ACAD_STARS = [[6, 3, 0.4], [15, 9, 2.1], [24, 2, 3.7], [44, 4, 1.2], [53, 10, 4.4], [58, 2, 2.8], [49, 15, 0.9], [10, 15, 5.1]];

// Estandarte comprido no mastro: guarda o valor de cada pixel; balança com o vento.
function makeAcadBanner(r) {
  const w = 5, h = 15;
  const val = new Float32Array(w * h).fill(-1);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (j > h - 4 && Math.abs(i - 2) < j - (h - 4) + 0.1 && i !== 0 && i !== 4) continue; // rabo de andorinha
      val[j * w + i] = 0.62 - i * 0.1 + (i === 0 ? 0.15 : 0) - j * 0.01;
    }
  }
  // anel dourado do sol (o ouro dos alquimistas) no meio
  const ring = new Set([[1, 4], [2, 4], [3, 4], [1, 5], [3, 5], [1, 6], [2, 6], [3, 6]].map(([i, j]) => j * w + i));
  return { w, h, r, val, ring, dot: 5 * w + 2 };
}

function drawAcadBanner(f, b, x0, y0, t, amp) {
  for (let j = 0; j < b.h; j++) {
    const k = j / b.h;
    const dx = Math.round(Math.sin(t * 1.6 - j * 0.15) * amp * k * k);
    for (let i = 0; i < b.w; i++) {
      const n = j * b.w + i;
      const v = b.val[n];
      if (v < 0) continue;
      const fold = Math.sin(i * 0.9 - t * 2.4 + j * 0.1) * 0.16 * (0.4 + k);
      let c = pick(b.r, v + fold, i, j);
      if (b.ring.has(n)) c = PAL.gold[i === 1 || j === 4 ? 4 : 3];
      else if (n === b.dot) c = PAL.gold[5];
      f.set(x0 + i + dx, y0 + j, c);
    }
  }
}

function acadSkyLight(x, y, g) {
  const [ox, oy] = ACAD_ORB;
  return (0.12 + g * 0.18) * clamp01(1 - Math.hypot(x + 0.5 - ox, y + 0.5 - oy) / (12 + g * 6)) ** 1.6;
}

function buildAcademyBackdrop(g) {
  const p = new Pix(64, 64);
  // céu do entardecer: lilás em cima, pêssego no horizonte atrás do prédio
  for (let y = 0; y < ACAD_COURT; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.02 + (y / 46) * 0.86 + clamp01(1 - Math.hypot((x - 40) / 40, (y - 48) / 20)) * 0.12 + acadSkyLight(x, y, g) * 1.4;
      p.d[y * 64 + x] = pick(TWILIGHT, v, x, y, 1.5);
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, 1, 81) * 64), y = Math.floor(hash(i, 2, 81) * 20);
    p.set(x, y, TWILIGHT[i % 3 ? 4 : 5]);
  }
  // colinas e ciprestes ao longe
  for (let x = 0; x < 64; x++) {
    let top = 41 + 2 * Math.sin(x * 0.13 + 2) + Math.sin(x * 0.37);
    for (const [px, h] of [[8.5, 13], [11.5, 9], [55.5, 12], [52.5, 8], [0.5, 7], [63.5, 9]]) {
      const d = Math.abs(x + 0.5 - px);
      if (d < 1.9) top = Math.min(top, 41 - h + (d / 1.9) ** 2 * h * 0.9);
    }
    top = Math.round(top);
    for (let y = top; y < ACAD_COURT; y++) p.set(x, y, pick(AFAR, (y === top ? 0.8 : 0.45) - (y - top) * 0.03 + (hash(x, y, 82) - 0.5) * 0.1, x, y));
  }
  // pátio de lajes, com a luz da porta espalhada no chão
  const rows = [ACAD_COURT, 53, 55, 58, 61, 64];
  for (let y = ACAD_COURT; y < 64; y++) {
    const r = rows.findIndex((ry) => ry > y) - 1;
    const r0 = rows[r], rh = rows[r + 1] - r0;
    const bw = 5 + r * 2;
    for (let x = 0; x < 64; x++) {
      const off = (r & 1) * (bw >> 1);
      const jx = (x + off) % bw === 0, jy = y === r0;
      const warm = clamp01(1 - Math.hypot((x + 0.5 - AX) / 13, (y - ACAD_COURT + 1) / 6)) * 0.3;
      let v = 0.36 + (y - ACAD_COURT) * 0.018 + warm + (hash(Math.floor((x + off) / bw), r, 83) - 0.5) * 0.14;
      if (jx || jy) v -= 0.2;
      else if (y === r0 + 1 && rh > 1) v += 0.06;
      p.set(x, y, warm > 0.12 && !(jx || jy) && bayer(x, y) < warm * 1.6 ? pick(WARM, 0.3 + warm, x, y) : pick(FLAGSTONE, v, x, y));
    }
  }
  return p;
}

function buildAcademy() {
  const p = new Pix(64, 64);
  const X0 = ACAD_X0, X1 = ACAD_X1;
  // tambor e cúpula de cobre, com a lanterna e a esfera no alto
  p.fill(25, 10, 40, 22, (x) => Math.abs(x + 0.5 - AX) <= 6.5, (x, y) => {
    let v = 0.12 + cylLight((x + 0.5 - AX) / 6.5) * 0.8 + ((x - 26) % 3 === 0 ? -0.14 : 0);
    if (y === 12) v += 0.24;
    return pick(MARBLE, v, x, y);
  });
  p.fill(24, 5, 41, 12, (x, y) => ((x - AX) / 7.6) ** 2 + ((y - 12.4) / 6.6) ** 2 <= 1 && y < 12, (x, y) => {
    const nx = (x + 0.5 - AX) / 7.6, ny = (y + 0.5 - 12.4) / 6.6;
    let v = 0.12 + sphereLight(nx, ny) * 0.9;
    const lam = Math.asin(Math.max(-1, Math.min(1, nx / Math.sqrt(Math.max(0.05, 1 - ny * ny)))));
    const k = lam / (Math.PI / 6);
    if (Math.abs(k - Math.round(k)) < 0.14) v -= 0.2;
    return pick(VERDI, v, x, y, 1.6);
  });
  p.rect(31, 4, 3, 2, (x, y) => (y === 5 && x === 32 ? MAGE[2] : pick(MARBLE, (x === 31 ? 0.8 : 0.45), x, y)));
  p.sphere(ACAD_ORB[0], ACAD_ORB[1], 1.8, 1.7, MAGE, 0.3);

  // frontão: moldura inclinada clara, tímpano na sombra e o telhado de cobre
  const slope = (ACAD_BASE - ACAD_APEX) / (AX - (X0 - 2.5));
  p.poly([[X0 - 2.5, ACAD_BASE + 0.5], [AX, ACAD_APEX], [X1 + 3.5, ACAD_BASE + 0.5]], (x) => MARBLE[x + 0.5 < AX ? 6 : 4]);
  p.poly([[X0 + 2, ACAD_BASE + 0.2], [AX, ACAD_APEX + 2.4], [X1 - 1, ACAD_BASE + 0.2]], (x, y) => pick(MARBLE, 0.36 - (x - X0) * 0.004 + (y > ACAD_BASE - 1.6 ? -0.1 : 0), x, y));
  for (let x = X0 - 3; x <= X1 + 4; x++) {
    const y = Math.floor(ACAD_APEX + Math.abs(x + 0.5 - AX) * slope) - 1;
    if (y < ACAD_BASE) p.set(x, y, VERDI[x < AX ? 5 : 3]);
  }
  // relevo dourado no tímpano: livro aberto com um sol em cima
  for (const [x, y, k] of [[27, 23, 4], [28, 22, 5], [29, 22, 5], [30, 22, 4], [31, 23, 3], [32, 24, 2], [33, 23, 3], [34, 22, 4], [35, 22, 4], [36, 22, 3], [37, 23, 2],
    [28, 23, 3], [29, 23, 3], [30, 23, 3], [34, 23, 2], [35, 23, 2], [36, 23, 2], [32, 23, 3]]) p.set(x, y, PAL.gold[k]);
  p.sphere(32.5, 19.6, 1.5, 1.4, PAL.gold, 0.15);
  for (const [x, y] of [[29, 19], [36, 19], [30, 17], [35, 17]]) p.set(x, y, PAL.gold[2]);
  // acrotérios dourados nas pontas e no alto
  for (const [x, y] of [[X0 - 2, ACAD_BASE - 1], [X1 + 2, ACAD_BASE - 1], [32, ACAD_APEX - 1]]) {
    p.set(x, y, PAL.gold[4]); p.set(x, y - 1, PAL.gold[5]); p.set(x - 1, y, PAL.gold[3]); p.set(x + 1, y, PAL.gold[2]);
  }
  // entablamento: cornija, friso com tríglifos e arquitrave
  p.rect(X0 - 4, ACAD_BASE, X1 - X0 + 9, 1, (x) => MARBLE[x < AX ? 6 : 5]);
  p.rect(X0 - 3, ACAD_BASE + 1, X1 - X0 + 7, 2, (x, y) => {
    if ((x - X0) % 4 === 1 || (x - X0) % 4 === 2) return MARBLE[y === ACAD_BASE + 1 ? 2 : 1];
    return pick(MARBLE, 0.62 - (x - X0) * 0.006 - (y - ACAD_BASE - 1) * 0.12, x, y);
  });
  p.rect(X0 - 2, ACAD_BASE + 3, X1 - X0 + 5, 1, (x) => MARBLE[x < AX ? 4 : 3]);
  // parede do pórtico na sombra, com a porta acesa e as janelas
  const wall0 = ACAD_BASE + 4;
  p.rect(X0, wall0, X1 - X0 + 1, 43 - wall0, (x, y) => pick(MARBLE, 0.12 + masonry(x, y, 6, 3, 85, wall0) * 0.6 + (y === wall0 ? -0.08 : 0), x, y));
  p.fill(27, 30, 38, 42, archTest(AX, 4.4, 31, 42), (x, y) => pick(MARBLE, 0.5 - (x - 28) * 0.03, x, y));
  p.fill(28, 31, 37, 42, archTest(AX, 3.4, 32, 42), (x, y) => pick(WARM, 0.74 - (y - 32) * 0.01 - Math.abs(x + 0.5 - AX) * 0.05 + (y > 39 ? 0.1 : 0), x, y));
  for (const wx of [23, 42]) {
    p.fill(wx - 3, 32, wx + 3, 40, archTest(wx, 2.4, 32, 39), (x, y) => pick(MARBLE, 0.46 - (x - wx) * 0.06, x, y));
    p.fill(wx - 2, 33, wx + 2, 39, archTest(wx, 1.5, 33, 38), (x, y) => pick(WARM, 0.62 - (y - 33) * 0.05, x, y));
    p.rect(Math.floor(wx) - 2, 39, 4, 1, (x) => MARBLE[x < wx ? 5 : 3]);
  }
  // colunas jônicas com volutas
  for (const c of ACAD_COLS) {
    const cx = Math.floor(c);
    p.fill(c - 2, wall0 + 2, c + 2, 41, (x) => Math.abs(x + 0.5 - c) <= 2, (x, y) =>
      pick(MARBLE, 0.08 + cylLight((x + 0.5 - c) / 2) * 0.88 - (y - wall0) * 0.004, x, y));
    p.rect(cx - 3, wall0, 6, 1, (x) => MARBLE[x < cx ? 6 : 4]);
    p.rect(cx - 2, wall0 + 1, 4, 1, (x) => MARBLE[x < cx ? 5 : 3]);
    p.set(cx - 3, wall0 + 1, MARBLE[4]); p.set(cx + 2, wall0 + 1, MARBLE[2]); // volutas
    p.rect(cx - 3, 42, 6, 1, (x) => MARBLE[x < cx ? 5 : 3]);
  }
  // pilastras das pontas
  p.rect(X0, wall0, 2, 43 - wall0, (x) => MARBLE[x === X0 ? 6 : 4]);
  p.rect(X1 - 1, wall0, 2, 43 - wall0, (x) => MARBLE[x === X1 ? 1 : 2]);
  // estilóbata e a escadaria
  p.rect(X0 - 3, 43, X1 - X0 + 7, 2, (x, y) => pick(MARBLE, (y === 43 ? 0.82 : 0.5) - (x - X0) * 0.005, x, y));
  for (let k = 0; k < 3; k++) {
    const y = 45 + k * 2, x0 = X0 - 4 - k * 2, x1 = X1 + 4 + k * 2;
    p.rect(x0, y, x1 - x0 + 1, 1, (x) => pick(MARBLE, 0.78 - (x - x0) * 0.005 + (hash(x >> 2, y, 86) - 0.5) * 0.08, x, y));
    p.rect(x0, y + 1, x1 - x0 + 1, 1, (x) => pick(MARBLE, 0.38 - (x - x0) * 0.004, x, y + 1));
  }
  // mastros com a esfera dourada no alto
  for (const px of ACAD_POLES) {
    p.rect(px, 7, 1, 47, (x, y) => (y % 9 === 0 ? PAL.gold[3] : PAL.wood[4]));
    p.rect(px + 1, 7, 1, 47, PAL.wood[1]);
    p.sphere(px + 1, 5.6, 1.5, 1.5, PAL.gold, 0.1);
    p.rect(px - 1, 53, 4, 2, (x, y) => MARBLE[y === 53 ? 4 : 2]);
    p.rect(px < 32 ? px : px - 4, 8, 6, 1, PAL.wood[2]);
  }
  p.outline(PAL.out);
  return p;
}

// Estudantes de toga: sprites pequenos (andando para os dois lados, dois passos).
const HAIRS = [PAL.hair[1], PAL.auburn[2], PAL.hair[3], PAL.straw[3], PAL.hair[0], PAL.auburn[3]];
const SASHES = [MAGE[4], PAL.herb[3], PAL.gold[3], MAGE[5], PAL.herb[4]];
function buildStudent(hair, sash, dir, step, book) {
  const p = new Pix(7, 9);
  // cabeça de 2 pixels: rosto para o lado em que anda, cabelo em cima e na nuca
  const face = dir > 0 ? 4 : 2;
  p.set(3, 1, hair); p.set(face, 1, hair);
  p.set(face, 2, PAL.skin[4]); p.set(3, 2, hair);
  // toga clara com a faixa colorida atravessada
  for (let y = 3; y <= 6; y++) for (let x = 2; x <= 4; x++) p.set(x, y, TOGA[6 - x - (y === 6 ? 1 : 0)]);
  for (let k = 0; k < 3; k++) p.set(dir > 0 ? 2 + k : 4 - k, 3 + k, sash);
  if (book) { p.set(face + dir, 4, book[3]); p.set(face + dir, 5, book[1]); }
  // pés: passada aberta ou fechada
  if (step) p.set(3, 7, PAL.leather[1]);
  else { p.set(2, 7, PAL.leather[1]); p.set(4, 7, PAL.leather[2]); }
  p.outline(PAL.out);
  return p;
}

const STUDENTS = [
  // x de partida, alcance, velocidade, linha do pé, fase, cabelo, faixa, livro
  [6, 20, 1.6, 55, 0.2, 0, 0, 2], [40, 16, 1.2, 57, 1.7, 1, 1, -1], [14, 26, 1.9, 60, 3.1, 2, 2, 0],
  [30, 0, 0, 54, 0, 3, 3, 3], [34, 0, 0, 54, 0, 4, 4, -1], [44, 14, 1.4, 62, 4.2, 5, 3, 5],
];

const acadArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintAcademyPortrait(ctx, t, info) {
  const a = acadArt;
  if (!a.bg) {
    a.bg = buildAcademyBackdrop(0);
    a.halo = makeHalo(a.bg, buildAcademyBackdrop(1), (x, y) => Math.hypot(x + 0.5 - ACAD_ORB[0], y + 0.5 - ACAD_ORB[1]) / 18);
    a.body = buildAcademy();
    a.clouds = [makeCloud(22, 7, 9, ACLOUD), makeCloud(15, 6, 13, ACLOUD)];
    a.banners = [makeAcadBanner(MAGE), makeAcadBanner(BANNER_GREEN)];
    a.lights = [];
    for (let y = 30; y < 43; y++) {
      for (let x = ACAD_X0; x <= ACAD_X1; x++) {
        const k = WARM.indexOf(a.body.get(x, y));
        if (k >= 0) a.lights.push([x, y, k / (WARM.length - 1)]);
      }
    }
    a.students = STUDENTS.map(([, , , , , h, s, b]) => [-1, 1].map((dir) => [0, 1].map((st) =>
      buildStudent(HAIRS[h], SASHES[s], dir, st, b >= 0 ? BOOKS[b] : null))));
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  // a esfera mágica pulsa e acende o céu em volta
  const glow = 0.45 + Math.sin(t * 1.9) * 0.18 + Math.sin(t * 4.7) * 0.06 + live * 0.12;
  paintHalo(f, a.halo, glow);
  ACAD_STARS.forEach(([x, y, ph]) => {
    const s = Math.sin(t * 1.7 + ph * 2) * Math.sin(t * 0.6 + ph);
    if (s > 0.1) f.set(x, y, s > 0.55 ? WHITE : TWILIGHT[6]);
  });
  f.blit(a.clouds[0], ((t * 1.2) % 96) - 26, 18);
  f.blit(a.clouds[1], ((t * 0.8 + 50) % 84) - 18, 31);
  f.blit(a.body, 0, 0);
  // luz da porta e das janelas tremendo
  for (const [x, y, k] of a.lights) {
    const fl = Math.sin(t * 6.1 + x * 1.1) * 0.5 + Math.sin(t * 11.7 + y * 1.9) * 0.5;
    f.set(x, y, pick(WARM, k + fl * 0.07 * live, x, y, 1.2));
  }
  // estandartes nos mastros
  const wind = t * (0.6 + live * 0.5);
  drawAcadBanner(f, a.banners[0], ACAD_POLES[0] + 1, 9, wind, 1.4);
  drawAcadBanner(f, a.banners[1], ACAD_POLES[1] - 4, 9, wind + 1.3, 1.4);
  // bandeirolas atravessando a frente da escadaria
  const [p0, p1] = [ACAD_POLES[0] + 1, ACAD_POLES[1]];
  const mid = (p0 + p1) / 2, half = (p1 - p0) / 2;
  const sag = (x) => 40 + 5 * (1 - ((x - mid) / half) ** 2) + Math.sin(wind * 1.3) * 0.4 * (1 - ((x - mid) / half) ** 2);
  for (let x = p0 + 1; x < p1; x++) f.set(x, sag(x), PAL.wood[1]);
  const flags = [MAGE[5], PAL.herb[4], PAL.gold[4], TOGA[4], MAGE[3], PAL.herb[3]];
  for (let i = 0, x = p0 + 3; x < p1 - 3; x += 4, i++) {
    const y = Math.round(sag(x + 1)) + 1;
    const sw = Math.sin(wind * 2.2 + i * 0.8);
    const c = flags[i % flags.length];
    f.set(x, y, c); f.set(x + 1, y, c); f.set(x + 2, y, c);
    f.set(x + 1 + (sw > 0.5 ? 1 : 0), y + 1, c);
    f.set(x + 1 + (sw > 0.2 ? 1 : sw < -0.6 ? -1 : 0), y + 2, PAL.out);
  }
  // estudantes andando de um lado para o outro
  STUDENTS.forEach(([x0, range, sp, foot, ph], i) => {
    let x = x0, dir = i % 2 ? -1 : 1;
    if (range) {
      const s = (t * sp * (0.5 + live * 0.5) / range + ph) % 2;
      x = x0 + range * (s < 1 ? s : 2 - s);
      dir = s < 1 ? 1 : -1;
    }
    const step = range ? Math.floor(x * 1.3) & 1 : 1;
    f.blit(a.students[i][dir > 0 ? 1 : 0][step], Math.round(x) - 3, foot - 7);
  });
  // luzinhas mágicas subindo do pátio
  const n = info.working ? 6 : 3;
  for (let k = 0; k < n; k++) {
    const life = (t * (0.07 + hash(k, 1, 87) * 0.05) + hash(k, 2, 87)) % 1;
    const x = 6 + hash(k, 3, 87) * 52 + Math.sin(t * 0.9 + k * 1.9) * 3;
    const y = 54 - life * 56;
    paintWisp(f, x, y, Math.sin(life * Math.PI) * 0.9, k % 2 ? POTION : MAGE);
  }
  sparkle(f, 32, 2, pulse(t, info.working ? 2.6 : 4.8, 0.3, 0.6), WHITE, MAGE[6]);
  f.draw(ctx);
}

function buildAcademySilhouette() {
  const p = buildAcademy();
  drawAcadBanner(p, makeAcadBanner(MAGE), ACAD_POLES[0] + 1, 9, 0, 0);
  drawAcadBanner(p, makeAcadBanner(MAGE), ACAD_POLES[1] - 4, 9, 0, 0);
  return p;
}

// ---------------------------------------------------------------------------
// Ícones 16x16

function iconLibrary() {
  const p = new Pix(16, 16);
  p.rect(2, 1, 12, 15, (x, y) => (x === 2 ? WALNUT[5] : x === 13 ? WALNUT[2] : WALNUT[0]));
  p.rect(1, 1, 14, 1, (x) => WALNUT[x < 8 ? 6 : 5]);
  for (const sy of [6, 11, 15]) p.rect(3, sy, 10, 1, (x) => WALNUT[x < 8 ? 5 : 4]);
  const cols = [0, 1, 2, 4, 3, 5, 0, 2, 1, 4];
  for (const [top, bot, seed] of [[2, 5, 0], [7, 10, 3], [12, 14, 6]]) {
    for (let x = 3; x <= 12; x++) {
      const r = BOOKS[cols[(x + seed) % cols.length]];
      const h = (x + seed) % 3 === 0 ? 1 : 0;
      for (let y = top + h; y <= bot; y++) p.set(x, y, y === top + h ? r[4] : r[(x + seed) % 2 ? 3 : 2]);
    }
  }
  p.outline(PAL.out);
  return p;
}

function iconSage() {
  const p = new Pix(16, 16);
  p.fill(1, 6, 15, 16, (x, y) => ((x - 8) / 5.6) ** 2 + ((y - 11) / 5.2) ** 2 <= 1 && y > 9, (x, y) =>
    pick(BEARD, 0.5 + sphereLight((x + 0.5 - 7) / 6, (y + 0.5 - 10) / 6) * 0.5 - ((x + y) % 3 === 0 ? 0.12 : 0), x, y));
  p.fill(3, 4, 13, 11, (x, y) => ((x - 8) / 4.4) ** 2 + ((y - 8) / 3.6) ** 2 <= 1 && y < 10.5, (x, y) =>
    pick(OLD_SKIN, 0.45 + sphereLight((x + 0.5 - 8) / 4.4, (y + 0.5 - 8) / 3.6) * 0.5, x, y));
  for (let x = 5; x <= 10; x++) p.set(x, 10, BEARD[x < 8 ? 5 : 4]);
  for (const [x, c] of [[5, PAL.gold[4]], [6, SAGE_EYE], [7, PAL.gold[3]], [8, PAL.gold[3]], [9, SAGE_EYE], [10, PAL.gold[2]]]) p.set(x, 8, c);
  p.fill(1, 0, 16, 6, (x, y) => (((x - 8) / 6.2) ** 2 + ((y - 3.6) / 3.4) ** 2 <= 1 && y < 5.5) || (((x - 12.5) / 2.6) ** 2 + ((y - 5) / 1.8) ** 2 <= 1), (x, y) =>
    pick(MAGE, 0.25 + sphereLight((x + 0.5 - 7.5) / 6.2, (y + 0.5 - 2.4) / 3.4) * 0.8, x, y));
  p.rect(2, 5, 12, 1, (x) => PAL.gold[x < 8 ? 4 : 3]);
  p.set(14, 6, PAL.gold[4]);
  p.set(14, 7, PAL.gold[3]);
  p.outline(PAL.out);
  return p;
}

function iconObservatory() {
  const p = new Pix(16, 16);
  p.rect(4, 9, 7, 7, (x, y) => pick(NSTONE, (x === 4 ? 0.85 : x === 10 ? 0.3 : 0.6) - (y % 3 === 2 ? 0.12 : 0), x, y));
  p.rect(7, 12, 1, 4, WARM[3]);
  p.fill(2, 3, 13, 9, (x, y) => ((x - 7.5) / 5) ** 2 + ((y - 9) / 5) ** 2 <= 1 && y < 9, (x, y) =>
    pick(VERDI, 0.2 + sphereLight((x + 0.5 - 7.5) / 5, (y + 0.5 - 9) / 5) * 0.85, x, y));
  p.set(8, 4, NIGHT_SKY[0]); p.set(8, 5, NIGHT_SKY[0]);
  p.line(8, 6, 13, 2, PAL.gold[4]);
  p.line(9, 6, 14, 2, PAL.gold[2]);
  p.set(14, 1, PAL.gold[5]);
  p.rect(3, 9, 9, 1, (x) => PAL.iron[x < 7 ? 3 : 2]);
  p.set(1, 1, MOON[4]); p.set(2, 1, MOON[3]); p.set(1, 2, MOON[3]);
  p.outline(PAL.out);
  return p;
}

function iconAcademy() {
  const p = new Pix(16, 16);
  p.poly([[0.5, 6], [8, 1.5], [15.5, 6]], (x) => MARBLE[x < 8 ? 6 : 4]);
  p.set(7, 4, PAL.gold[4]); p.set(8, 4, PAL.gold[3]);
  p.rect(1, 6, 14, 1, (x) => MARBLE[x < 8 ? 5 : 3]);
  p.rect(2, 7, 12, 6, MARBLE[1]);
  p.rect(7, 9, 2, 4, WARM[3]);
  for (const x of [2, 5, 10, 13]) {
    p.rect(x, 7, 1, 6, MARBLE[x < 8 ? 6 : 5]);
  }
  p.rect(1, 13, 14, 1, MARBLE[5]);
  p.rect(0, 14, 16, 1, MARBLE[4]);
  p.rect(0, 15, 16, 1, MARBLE[2]);
  p.set(8, 0, MAGE[6]);
  p.outline(PAL.out);
  return p;
}

ART.portraits.library = paintLibraryPortrait;
ART.portraits.sage = paintSagePortrait;
ART.portraits.observatory = paintObservatoryPortrait;
ART.portraits.academy = paintAcademyPortrait;
ART.locked.library = ART.silhouette(buildLibrarySilhouette);
ART.locked.sage = ART.silhouette(buildSageSilhouette);
ART.locked.observatory = ART.silhouette(buildObservatory);
ART.locked.academy = ART.silhouette(buildAcademySilhouette);
Object.assign(ART.icons, { library: iconLibrary, sage: iconSage, observatory: iconObservatory, academy: iconAcademy });
})();
