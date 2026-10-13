'use strict';
// Linha dos MINÉRIOS, tiers 11 a 15: Salão da montanha, Lapidário, Tesouraria,
// Banqueiro e Coração da montanha. Retratos animados, silhuetas bloqueadas e ícones.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL } = ART;

const WHITE = C('#ffffff');
const RUBY = ramp('#3a0610', '#7a0c1c', '#c01a2a', '#f04a4a', '#ffb4a8');
const SAPPHIRE = ramp('#0a1440', '#162c7c', '#2850bc', '#4c84ea', '#b0d0ff');
const EMERALD = ramp('#06301c', '#0c5a30', '#168a46', '#3cc06a', '#a8f0bc');
const AMETHYST = ramp('#1e0c34', '#3e1a62', '#6a34a0', '#9c62d4', '#d8b4f8');
const AX = 32; // eixo vertical dos bustos
const BRONZE = ramp('#24120a', '#43220f', '#6a3a18', '#94582a', '#bc7e40', '#e0aa66');

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

// Luz que pulsa: compara a versão apagada com a acesa e guarda, para cada pixel que muda,
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

// Estrelinha de brilho que cresce e some (e de 0 a 1); diag vira o x.
function sparkle(f, x, y, e, diag = false, tip = PAL.gold[5]) {
  if (e <= 0.08) return;
  const arm = Math.round(e * 2.2);
  f.set(x, y, WHITE);
  for (let k = 1; k <= arm; k++) {
    const c = k === arm ? tip : WHITE;
    if (diag) { f.set(x + k, y + k, c); f.set(x - k, y - k, c); f.set(x + k, y - k, c); f.set(x - k, y + k, c); }
    else { f.set(x + k, y, c); f.set(x - k, y, c); f.set(x, y + k, c); f.set(x, y - k, c); }
  }
}

// Envelope suave de um evento periódico: 0 fora da janela, sobe e desce dentro dela.
function pulse(t, period, offset, length) {
  const ph = (((t + offset) % period) + period) % period;
  return ph < length ? Math.sin((ph / length) * Math.PI) : 0;
}

// Rocha bruta em lascas: células de Voronoi; edge é a distância até a fresta mais
// próxima, (dx, dy) a posição dentro da lasca (para clarear o lado de cima à esquerda).
function rockCell(x, y, size, seed) {
  const gx = Math.floor(x / size), gy = Math.floor(y / size);
  let d1 = 1e9, d2 = 1e9, dx = 0, dy = 0, id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j;
      const px = (cx + 0.15 + hash(cx, cy, seed) * 0.7) * size, py = (cy + 0.15 + hash(cx, cy, seed + 1) * 0.7) * size;
      const d = Math.hypot(x - px, y - py);
      if (d < d1) { d2 = d1; d1 = d; dx = (x - px) / size; dy = (y - py) / size; id = hash(cx, cy, seed + 2); }
      else if (d < d2) d2 = d;
    }
  }
  return { edge: d2 - d1, dx, dy, id };
}

// Tom de uma rocha em lascas, já com fresta escura e aresta clara.
function rockTone(x, y, size, seed) {
  const r = rockCell(x + 0.5, y + 0.5, size, seed);
  let v = (r.id - 0.5) * 0.16 - (r.dx + r.dy) * 0.22;
  if (r.edge < 0.8) v -= 0.22;
  else if (r.edge < 1.6 && r.dx + r.dy < 0) v += 0.1;
  return v;
}

// Mistura duas cores no formato do ImageData (k = 0 fica a, 1 vira b).
function mix(a, b, k) {
  const ch = (s) => Math.round(((a >>> s) & 255) + (((b >>> s) & 255) - ((a >>> s) & 255)) * k);
  return ((255 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0;
}

// Pixels de uma rampa numa região (x, y, índice na rampa): o brilho corre por eles.
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

// Desenho a partir de linhas de texto; color(i, j, ch) devolve a cor de cada pixel.
function paintBitmap(p, rows, x0, y0, color) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== '.') p.set(x0 + i, y0 + j, color(i, j, ch));
  }));
}

// Fagulhas subindo de (x, y), com vida em ciclo.
function paintSparks(f, x, y, t, n, seed, rise = 12) {
  for (let k = 0; k < n; k++) {
    const life = (t * (0.5 + hash(k, 1, seed) * 0.4) + hash(k, 2, seed)) % 1;
    f.set(x + Math.sin(t * 3 + k * 2) * 1.6 * life + (hash(k, 3, seed) - 0.5) * 3, y - life * rise, PAL.fire[life < 0.4 ? 5 : life < 0.75 ? 4 : 3]);
  }
}

// ---------------------------------------------------------------------------
// Salão da montanha

const HALL_ROCK = ramp('#0b080c', '#140f16', '#1d161f', '#282029', '#352a33', '#46373c', '#5c4847', '#765c54', '#937262', '#b28c74');
const DRESSED = ramp('#1a1418', '#2a2026', '#3c2f33', '#524140', '#6c5650', '#8a6e60', '#aa8a72', '#cca888', '#e8c8a0');
const RUNE = ramp('#0c2a34', '#0f4654', '#16707c', '#24a2aa', '#62d8d2', '#b8fbee', '#f2fffb');
const DEEP = ramp('#2e140a', '#5a2a10', '#904a18', '#c87828', '#eca848', '#ffd47e', '#fff2c8');
const CARPET = ramp('#26060c', '#480c16', '#70141e', '#982428', '#bc3c34', '#d8604a');
const HALL_FIRES = [[9.5, 44], [54.5, 44]]; // base das chamas dos braseiros
const HALL_DOOR = archTest(32, 8, 15, 37); // vão do portal
const HALL_FRAME = archTest(32, 12, 11, 37); // arco com as runas
const HALL_VP = [32, 31]; // fundo do corredor atrás do portal
const hallVault = (x) => 3 + ((x - 32) / 32) ** 2 * 16; // borda da abóbada

// Runas 3x3 entalhadas no arco (sem cruzes).
const GLYPHS = [
  ['xx.', 'x.x', 'x..'], ['x..', 'xx.', 'x.x'], ['.x.', 'x.x', '.x.'], ['xxx', '..x', '.x.'],
  ['x..', 'x.x', 'xx.'], ['.xx', 'x..', '.xx'], ['x.x', '.x.', '.x.'], ['xx.', '.x.', '.xx'],
];
const RUNE_SPOTS = (() => {
  const s = [];
  for (const y of [35, 31, 27]) s.push([21, y]);
  for (let k = 0; k <= 6; k++) {
    const a = Math.PI - (k * Math.PI) / 6;
    s.push([Math.round(31.5 + Math.cos(a) * 10 - 1), Math.round(22.5 - Math.sin(a) * 10 - 1)]);
  }
  for (const y of [27, 31, 35]) s.push([41, y]);
  return s;
})();

const fireLight = (x, y, b) => {
  let v = 0;
  for (const [fx, fy] of HALL_FIRES) {
    v += (0.3 + b * 0.16) * clamp01(1 - Math.hypot(x + 0.5 - fx, (y + 0.5 - fy + 3) * 1.1) / (26 + b * 7)) ** 1.3;
  }
  return v;
};
const doorLight = (x, y, g) => (0.2 + g * 0.2) * clamp01(1 - Math.hypot(x + 0.5 - 32, (y + 0.5 - 36) * 1.15) / (19 + g * 7)) ** 1.5;
const hallLight = (x, y, b, g) => fireLight(x, y, b) + doorLight(x, y, g);

// Profundidade do corredor atrás do portal: 1 na boca, perto de 0 lá no fundo.
function tunnelDepth(x, y) {
  const [vx, vy] = HALL_VP;
  const inside = (s) => y <= vy + 6 * s && ((Math.abs(x - vx) <= 8 * s && y >= vy - 8 * s) || (x - vx) ** 2 + (y - (vy - 8 * s)) ** 2 <= (8 * s) ** 2);
  let lo = 0, hi = 1.05;
  for (let i = 0; i < 14; i++) {
    const m = (lo + hi) / 2;
    if (inside(m)) hi = m; else lo = m;
  }
  return hi;
}

function tunnelValue(x, y) {
  const s = tunnelDepth(x + 0.5, y + 0.5);
  if (s < 0.2) return 1.1; // a luz lá no fundo
  let v = 0.1 + (1 - s) ** 1.3 * 0.92;
  const ring = (Math.log(s) / Math.log(0.74)) % 1;
  if (ring < 0.2) v -= 0.3; // arcos do corredor, contra a luz
  else if (ring < 0.4) v += 0.06;
  const floor = y + 0.5 > HALL_VP[1] && (y + 0.5 - HALL_VP[1]) / 6 >= Math.abs(x + 0.5 - 32) / 8;
  if (floor) v += 0.08 + ((Math.floor(x + 0.5 - 32) & 1) ? 0 : -0.06);
  return v;
}

function buildHallBackdrop(b, g) {
  const p = new Pix(64, 64);
  const L = (x, y) => hallLight(x, y, b, g);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const vy = hallVault(x + 0.5);
      let v;
      if (y >= 53) {
        // lajes do piso, maiores perto de quem olha
        const rows = [53, 55, 58, 62, 67];
        let r = 0;
        while (y >= rows[r + 1]) r++;
        const u = (x + 0.5 - 32) / (5 + r * 3) + (r & 1) * 0.5;
        const joint = y === rows[r] || Math.abs(u - Math.round(u)) < 0.1;
        v = 0.2 + L(x, y) * 0.95 + (hash(Math.floor(u), r, 103) - 0.5) * 0.14 - (joint ? 0.16 : 0) + (y === rows[r] + 1 ? 0.06 : 0);
      }
      else if (y + 0.5 >= vy + 3) {
        v = 0.17 + L(x, y) + masonry(x, y, 10, 6, 102, 3) * 0.9 + (hash(x, y, 101) < 0.05 ? -0.08 : 0);
      }
      else if (y + 0.5 >= vy) {
        // aduelas da abóbada, uma ao lado da outra
        const u = (x + 0.5 - 32) / 5;
        const joint = Math.abs(u - Math.round(u)) < 0.12;
        v = 0.3 + L(x, y) + (hash(Math.round(u), 7, 107) - 0.5) * 0.12 - (joint ? 0.16 : 0) + (y + 0.5 >= vy + 2 ? -0.1 : y + 0.5 < vy + 1 ? 0.12 : 0);
      }
      else {
        // rocha bruta por cima da abóbada
        v = 0.2 + L(x, y) * 0.6 + rockTone(x, y, 6, 104) - (y + 0.5 > vy - 1 ? 0.12 : 0) - (12 - y) * 0.004;
      }
      p.d[y * 64 + x] = pick(HALL_ROCK, v, x, y, 2);
    }
  }
  // veios de ouro na rocha bruta
  for (let k = 0; k < 14; k++) {
    const x = Math.floor(hash(k, 1, 108) * 64), y = Math.floor(hash(k, 2, 108) * 16);
    if (y + 1.5 < hallVault(x + 0.5)) { p.set(x, y, PAL.gold[2]); if (k & 1) p.set(x + 1, y, PAL.gold[1]); }
  }
  // passagens laterais escuras, com uma tocha distante em cada
  for (const cx of [14.5, 49.5]) {
    p.fill(cx - 4, 22, cx + 4, 53, archTest(cx, 3.5, 24, 52), (x, y) => pick(DRESSED, 0.24 + L(x, y) * 0.9 + (x + 0.5 < cx ? 0.14 : -0.06) + (y === 52 ? -0.1 : 0), x, y));
    p.fill(cx - 3, 23, cx + 3, 53, archTest(cx, 2.5, 25, 52), (x, y) =>
      pick(HALL_ROCK, 0.04 + clamp01(1 - Math.hypot(x + 0.5 - cx, (y + 0.5 - 38) * 0.7) / 6) * 0.32, x, y));
  }
  // colunas lavradas, com capitel e base em degraus (com contorno próprio)
  const cols = new Pix(64, 64);
  for (const cx of [6.5, 57.5]) {
    cols.fill(cx - 3.5, 7, cx + 3.5, 50, () => true, (x, y) => {
      const nx = (x + 0.5 - cx) / 3.5;
      if (y === 28 || y === 29) return PAL.gold[Math.max(1, Math.min(5, Math.round(1 + cylLight(nx) * 3.4 + L(x, y) * 1.5 + (y === 28 ? 0.6 : 0))))];
      let v = 0.08 + cylLight(nx) * 0.58 + L(x, y) * 0.95;
      if ((x - Math.floor(cx - 3.5)) % 2 === 1) v -= 0.1; // caneluras
      return pick(DRESSED, v, x, y);
    });
    const block = (x0, x1, y0, y1, lift) => cols.fill(x0, y0, x1, y1, () => true, (x, y) => {
      const nx = (x + 0.5 - cx) / ((x1 - x0 + 1) / 2);
      return pick(DRESSED, 0.14 + cylLight(nx) * 0.52 + L(x, y) * 0.95 + (y === y0 ? 0.2 : 0) + lift, x, y);
    });
    block(Math.floor(cx - 5.5), Math.floor(cx + 5.5), 0, 3, 0.05);
    block(Math.floor(cx - 4.5), Math.floor(cx + 4.5), 4, 6, -0.04);
    block(Math.floor(cx - 4.5), Math.floor(cx + 4.5), 51, 52, 0);
    block(Math.floor(cx - 5.5), Math.floor(cx + 5.5), 53, 56, -0.04);
    for (let x = Math.floor(cx - 4.5); x <= cx + 4.5; x++) cols.set(x, 5, (x & 1) ? PAL.gold[3] : PAL.gold[1]);
  }
  cols.outline(PAL.out);
  p.blit(cols, 0, 0);
  // corredor atrás do portal, iluminado lá no fundo
  p.fill(23, 14, 41, 37, HALL_DOOR, (x, y) => pick(DEEP, tunnelValue(x, y) + g * 0.06, x, y, 2.6));
  return p;
}

function buildHall(b = 0.5, g = 0.5) {
  const p = new Pix(64, 64);
  const L = (x, y) => hallLight(x, y, b, g);

  // escadaria subindo até o portal, com passadeira vermelha
  const steps = [38, 41, 44, 47, 51, 55, 59, 64];
  const hw = (y) => 11 + (y - 38) * 0.3;
  for (let s = 0; s < steps.length - 1; s++) {
    const w = hw(steps[s]), cw = w * 0.42;
    for (let y = steps[s]; y < steps[s + 1]; y++) {
      const k = y - steps[s];
      const lift = k === 0 ? 0.32 : k === 1 ? 0.06 : -(k - 1) * 0.04;
      for (let x = Math.floor(32 - w); x < Math.ceil(32 + w); x++) {
        const dx = Math.abs(x + 0.5 - 32);
        if (dx < cw) {
          if (dx > cw - 1) { p.set(x, y, PAL.gold[k === 0 ? 4 : x < 32 ? 3 : 2]); continue; }
          p.set(x, y, pick(CARPET, 0.22 + L(x, y) * 0.95 + lift * 0.9 - (x + 0.5 - 32) * 0.008 + (k > 0 && (x + y) % 3 === 0 ? -0.04 : 0), x, y));
          continue;
        }
        let v = 0.18 + L(x, y) * 1.05 - (x + 0.5 - 32) * 0.004 + (hash(x, y, 111) - 0.5) * 0.08 + lift;
        if (k > 0 && hash(x >> 2, s, 112) < 0.25 && (x & 3) === 0) v -= 0.08; // lascas
        p.set(x, y, pick(DRESSED, v, x, y));
      }
    }
  }
  // muretas dos lados da escada
  for (let y = 36; y < 64; y++) {
    const w = hw(y);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(32 + side * (w + 0.5 + i));
        let v = 0.24 + L(x, y) + (side < 0 ? 0.14 - i * 0.07 : -0.02 - i * 0.05) + masonry(x, y, 4, 4, 113) * 0.6;
        if (y === 36) v += 0.25;
        p.set(x, y, pick(DRESSED, v, x, y));
      }
    }
  }

  // portal: bloco lavrado com frontão em degraus
  const inBlock = (x, y) => (y >= 9 && y <= 37.9 && Math.abs(x - 32) <= 14) || (y >= 6 && y < 9 && Math.abs(x - 32) <= 10.5) || (y >= 3 && y < 6 && Math.abs(x - 32) <= 7);
  p.fill(17, 3, 46, 37, (x, y) => inBlock(x, y) && !HALL_DOOR(x, y), (x, y) => {
    const cx = x + 0.5, cy = y + 0.5;
    let v = 0.26 + L(x, y) * 0.9 - (cx - 32) * 0.006;
    if (HALL_FRAME(cx, cy)) {
      // arco das runas, em relevo
      v += 0.14;
      if (!HALL_FRAME(cx - 1, cy) || !HALL_FRAME(cx, cy - 1)) v += 0.18;
      if (!HALL_FRAME(cx + 1, cy) || !HALL_FRAME(cx, cy + 1)) v -= 0.16;
      if (HALL_DOOR(cx + 1, cy) || HALL_DOOR(cx, cy + 1)) v -= 0.1;
      if (HALL_DOOR(cx - 1, cy) || HALL_DOOR(cx, cy - 1)) v += 0.08;
    }
    else {
      v += masonry(x, y, 7, 4, 114, 1) * 0.7;
      if (!inBlock(cx, cy - 1)) v += 0.24; // topo de cada degrau
      if (!inBlock(cx - 1, cy)) v += 0.14;
      if (!inBlock(cx + 1, cy)) v -= 0.18;
    }
    return pick(DRESSED, v, x, y);
  });
  // friso dourado com dentículos e emblema da montanha no frontão
  for (let x = 18; x <= 45; x++) {
    p.set(x, 9, PAL.gold[x < 26 ? 5 : x < 38 ? 4 : 3]);
    p.set(x, 10, (x & 1) ? PAL.gold[x < 32 ? 3 : 2] : DRESSED[1]);
  }
  paintBitmap(p, ['...x...', '..xxx..', '.xxxxx.', 'xxxxxxx'], 28.5, 4, (i, j) => PAL.gold[i < 3 ? 5 - (j >> 1) : i === 3 ? 4 : 2]);
  p.set(32, 4, RUNE[5]);
  p.set(31, 6, RUNE[4]);
  // runas apagadas
  RUNE_SPOTS.forEach(([rx, ry], k) => paintBitmap(p, GLYPHS[k % GLYPHS.length], rx, ry, () => RUNE[1]));
  // soleira do portal
  p.rect(22, 37, 20, 1, (x) => pick(DRESSED, 0.6 + L(x, 37) - (x - 22) * 0.02, x, 37));

  // braseiros de bronze sobre pé alto
  for (const [cx, fy] of HALL_FIRES) {
    p.fill(cx - 6, fy + 1, cx + 6, fy + 6, (x, y) => ((x - cx) / 6) ** 2 + ((y - fy - 1) / 5) ** 2 <= 1, (x, y) =>
      pick(BRONZE, 0.2 + cylLight((x + 0.5 - cx) / 6) * 0.7 + (y === fy + 1 ? 0.3 : y === fy + 3 ? -0.12 : 0) + fireLight(x, y, b) * 0.4, x, y));
    for (let x = Math.floor(cx - 4); x <= cx + 4; x += 2) p.set(x, fy + 3, BRONZE[(x + 0.5 < cx) ? 5 : 3]); // rebites
    p.fill(cx - 2, fy + 6, cx + 2, fy + 14, (x) => Math.abs(x - cx) <= 1.5, (x, y) => pick(BRONZE, 0.25 + cylLight((x + 0.5 - cx) / 1.6) * 0.5 + ((y - fy) % 4 === 0 ? 0.15 : 0), x, y));
    p.fill(cx - 4, fy + 14, cx + 4, fy + 16, (x, y) => Math.abs(x - cx) <= 2.6 + (y - fy - 14) * 0.8, (x, y) => pick(BRONZE, 0.2 + cylLight((x + 0.5 - cx) / 4) * 0.6 + (y === fy + 14 ? 0.2 : 0), x, y));
    // brasas
    for (let x = Math.floor(cx - 4); x <= cx + 4; x++) p.set(x, fy, pick(PAL.fire, 0.35 + hash(x, fy, 115) * 0.4, x, fy));
  }

  p.outline(PAL.out);
  return p;
}

const hallArt = { base: null, body: null, frame: new Pix(64, 64) };

function paintHallPortrait(ctx, t, info) {
  const a = hallArt;
  if (!a.base) {
    a.body = buildHall(0, 0);
    a.base = buildHallBackdrop(0, 0).blit(a.body, 0, 0);
    const fireLit = buildHallBackdrop(1, 0).blit(buildHall(1, 0), 0, 0);
    const doorLit = buildHallBackdrop(0, 1).blit(buildHall(0, 1), 0, 0);
    const fd = (x, y) => Math.min(...HALL_FIRES.map(([fx, fy]) => Math.hypot(x + 0.5 - fx, (y + 0.5 - fy) * 1.1)));
    a.fire = makeHalo(a.base, fireLit, (x, y) => (fireLight(x, y, 1) >= doorLight(x, y, 1) ? fd(x, y) / 34 : null));
    a.door = makeHalo(a.base, doorLit, (x, y) => (fireLight(x, y, 1) < doorLight(x, y, 1) ? Math.hypot(x + 0.5 - 32, (y + 0.5 - 36) * 1.15) / 28 : null));
    // corredor do portal: valor de cada pixel, para a luz do fundo pulsar
    a.deep = [];
    for (let y = 14; y <= 37; y++) for (let x = 23; x <= 41; x++) if (HALL_DOOR(x + 0.5, y + 0.5) && !a.body.get(x, y)) a.deep.push(y * 64 + x, tunnelValue(x, y));
    // runas: pixels de cada uma e o brilho em volta
    a.runes = RUNE_SPOTS.map(([rx, ry], k) => {
      const px = [], ring = [];
      GLYPHS[k % GLYPHS.length].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'x') px.push((ry + j) * 64 + rx + i); }));
      for (const n of px) {
        for (const m of [n - 1, n + 1, n - 64, n + 64]) {
          const x = m & 63, y = m >> 6;
          if (px.includes(m) || ring.includes(m) || !HALL_FRAME(x + 0.5, y + 0.5) || HALL_DOOR(x + 0.5, y + 0.5)) continue;
          ring.push(m, mix(a.base.d[m], RUNE[4], 0.3));
        }
      }
      return { px, ring };
    });
    // pepitas de ouro na rocha, que cintilam
    a.ore = [];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 64; x++) if (a.base.get(x, y) === PAL.gold[2]) a.ore.push([x, y]);
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.base);
  const d = f.d;
  // luz do fundo do corredor, respirando
  const breath = 0.5 + Math.sin(t * (info.working ? 1.7 : 0.9)) * 0.3 + Math.sin(t * 2.9 + 1) * 0.2;
  for (let k = 0; k < a.deep.length; k += 2) {
    const i = a.deep[k];
    d[i] = pick(DEEP, a.deep[k + 1] + breath * 0.12 * live, i & 63, i >> 6, 2.6);
  }
  paintHalo(f, a.door, 0.35 + breath * 0.5 * live);
  // braseiros tremulando
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 14.7 + 1) * 0.3 + Math.sin(t * 3.3) * 0.2;
  paintHalo(f, a.fire, 0.45 + live * 0.12 + flick * 0.08 * live);
  HALL_FIRES.forEach(([fx, fy], k) => {
    const tt = t + k * 1.37;
    paintFlame(f, fx, fy, tt, 6.5 + live * 2.5, 3.2, live);
    paintSparks(f, fx, fy - 6, tt, info.working ? 4 : 2, 120 + k, 16);
    for (let x = Math.floor(fx - 4); x <= fx + 4; x++) if (Math.sin(t * 5 + x * 2.1 + k) > 0.6) f.set(x, fy, PAL.fire[4]);
  });
  // runas acendendo em onda pelo arco
  a.runes.forEach((r, k) => {
    const wave = info.working ? Math.max(0, Math.sin(t * 2.2 - k * 0.55)) ** 3 : 0;
    const lvl = 0.42 + Math.sin(t * 1.3 + k * 0.4) * 0.08 + wave * 0.55;
    const c = pick(RUNE, lvl, k, 0, 1);
    for (const i of r.px) d[i] = c;
    if (lvl > 0.72) for (let j = 0; j < r.ring.length; j += 2) d[r.ring[j]] = r.ring[j + 1];
  });
  // poeira dourada saindo do portal
  for (let k = 0; k < 6; k++) {
    const u = (t * (0.08 + hash(k, 1, 121) * 0.06) + hash(k, 2, 121)) % 1;
    const x = 26 + hash(k, 3, 121) * 12 + Math.sin(t * 0.8 + k * 2) * 2;
    const y = 36 - u * 26;
    if (u > 0.05 && u < 0.9) f.set(x, y, u < 0.5 ? DEEP[6] : DEEP[4]);
  }
  // ouro cintilando na rocha e tochas distantes nas passagens
  a.ore.forEach(([x, y], k) => { const e = pulse(t, 3.1 + (k % 4) * 0.7, k * 1.13, 0.5); if (e > 0.3) f.set(x, y, PAL.gold[e > 0.7 ? 5 : 4]); });
  for (const [x, k] of [[14, 0], [49, 1]]) {
    f.set(x, 38, PAL.fire[Math.sin(t * 7 + k * 3) > 0 ? 4 : 3]);
    f.set(x, 37, PAL.fire[Math.sin(t * 9 + k) > 0.3 ? 3 : 2]);
  }
  f.draw(ctx);
}

function iconHall() {
  const p = new Pix(16, 16);
  // montanha de dois picos com o portal aceso na base
  p.poly([[0, 15.5], [7, 1], [10, 6], [12, 4], [16, 10], [16, 15.5]], (x, y) => {
    const face = x + 0.5 < 7 + (y - 1) * 0.15 ? 0.78 : x > 11 && y < 9 ? 0.55 : 0.4;
    return pick(PAL.stone, face - (y - 2) * 0.025 + ((x * 3 + y * 2) % 7 === 0 ? -0.14 : 0), x, y);
  });
  for (const [x, y] of [[7, 1], [6, 2], [7, 2], [6, 3], [12, 4]]) p.set(x, y, PAL.stone[5]); // cume claro
  p.fill(3, 7, 13, 15, archTest(8, 3.5, 7, 15), (x, y) => pick(RUNE, 0.55 + (x < 8 ? 0.15 : 0), x, y));
  p.fill(5, 8, 11, 15, archTest(8, 2.5, 8, 15), (x, y) => pick(DEEP, 0.45 + (y - 8) * 0.06 + (Math.abs(x + 0.5 - 8) < 1 ? 0.3 : 0), x, y));
  p.rect(3, 15, 10, 1, DRESSED[6]);
  p.outline(PAL.out);
  return p;
}

// silhueta: portal, escada e braseiros com as chamas paradas
function buildHallLocked() {
  const p = buildHall();
  for (const [fx, fy] of HALL_FIRES) paintFlame(p, fx, fy, 0.4, 9, 3.2, 1);
  return p;
}

// ---------------------------------------------------------------------------
// Lapidário

const SHOP = ramp('#140d0c', '#211613', '#30211b', '#423024', '#57412f', '#6e543c', '#88694b', '#a4825e'); // parede de reboco da oficina
const GRIND = ramp('#2a2a32', '#44444e', '#62616a', '#84828a', '#a6a3a6', '#c8c4c0'); // arenito da roda
const FELT = ramp('#0e1a1c', '#16282c', '#20383e', '#2c4a50', '#3a5e64'); // feltro do mostruário
const CAP_RED = ramp('#2a0c0e', '#4a1416', '#6e1e1e', '#94302a', '#b8483a', '#d26a52');
const SHIRT = ramp('#14201a', '#1e3026', '#2a4232', '#38563e', '#4a6c4c');
const GEM_LAMP = [6.5, 17]; // pavio da lamparina
const GEM_WHEEL = [54.5, 33.5, 9]; // centro e raio da roda de polir
const GEM_HELD = [10, 27]; // canto de cima da gema na mão
const CUTTER_HEAD = headTest(32, 31, 10, 11.6, 0.3);

// Gema lapidada vista de lado: mesa, coroa, cintura e pavilhão; cada letra é uma faceta.
const GEM_CUT = ['..aaaaa..', '.bbcccdd.', 'bbbcccddd', 'gggggggg.', '.eeffhhh.', '..effhh..', '...ffh...', '....f....'];
const FACET = { a: 0.82, b: 0.95, c: 0.62, d: 0.4, g: 0.5, e: 0.74, f: 0.56, h: 0.34 }; // o pavilhão devolve a luz que entra pela coroa
const FACET_PHASE = { a: 0, b: 1.1, c: 2.3, d: 3.1, g: 4.2, e: 5.0, f: 0.6, h: 1.9 };

function paintCutGem(p, x0, y0, r, t, amp) {
  GEM_CUT.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    const v = FACET[ch] + Math.sin(t * 2.2 + FACET_PHASE[ch]) * amp;
    p.set(x0 + i, y0 + j, pick(r, v, i, j, 3));
  }));
}

// Gema pequena (3x3 ou 2x2) com ponto de luz em cima à esquerda.
function smallGem(p, x, y, r, big) {
  if (big) {
    paintBitmap(p, ['.x.', 'xxx', '.x.'], x - 1, y - 1, (i, j) => r[i + j <= 1 ? 3 : i + j === 2 ? 2 : 1]);
    p.set(x, y - 1, r[4] || r[3]);
  }
  else {
    p.set(x, y, r[3]); p.set(x + 1, y, r[2]);
    p.set(x, y + 1, r[2]); p.set(x + 1, y + 1, r[1]);
  }
}

const lampLight = (x, y, k) => (0.26 + k * 0.16) * clamp01(1 - Math.hypot(x + 0.5 - GEM_LAMP[0], (y + 0.5 - GEM_LAMP[1]) * 0.9) / (40 + k * 10)) ** 1.3;

function buildGemBackdrop(k) {
  const p = new Pix(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      // reboco com manchas e algumas pedras aparecendo
      const n = hash(x >> 2, y >> 2, 131) * 0.5 + hash(x >> 1, y >> 1, 132) * 0.5;
      let v = 0.14 + lampLight(x, y, k) + (n - 0.5) * 0.12 + (hash(x, y, 133) < 0.04 ? -0.06 : 0);
      if (y > 52) v -= (y - 52) * 0.012;
      p.d[y * 64 + x] = pick(SHOP, v, x, y, 2);
    }
  }
  // viga do teto
  p.rect(0, 0, 64, 4, (x, y) => pick(PAL.wood, (y === 3 ? 0.15 : 0.32) + lampLight(x, y, k) * 0.8 + (hash(x >> 2, y, 134) - 0.5) * 0.12 - (y === 0 ? 0.1 : 0), x, y));
  p.rect(0, 4, 64, 1, PAL.out);

  // prateleira com a lamparina e uma tigela de gemas
  p.rect(0, 21, 21, 2, (x, y) => pick(PAL.wood, (y === 21 ? 0.72 : 0.32) + lampLight(x, y, k) * 0.6 - x * 0.006, x, y));
  p.rect(0, 23, 21, 1, PAL.out);
  for (const x of [3, 17]) { p.rect(x, 24, 1, 3, PAL.wood[1]); p.set(x, 27, PAL.out); }
  // lamparina de barro
  p.fill(2, 17, 11, 20, (x, y) => ((x - 6.5) / 4.6) ** 2 + ((y - 19) / 2.4) ** 2 <= 1 && y < 20.9, (x, y) =>
    pick(PAL.roof, 0.3 + sphereLight((x + 0.5 - 6.5) / 4.6, (y + 0.5 - 18.5) / 2.4) * 0.8 + k * 0.1, x, y));
  p.rect(10, 17, 2, 1, PAL.roof[2]);
  p.set(6, 17, PAL.out);
  // tigela de rubis e ametistas
  p.fill(12, 17, 20, 20, (x, y) => ((x - 16) / 4.2) ** 2 + ((y - 17.4) / 3.4) ** 2 <= 1 && y >= 17.5, (x, y) =>
    pick(PAL.wood, 0.25 + cylLight((x + 0.5 - 16) / 4.2) * 0.6, x, y));
  for (const [x, y, r] of [[13, 16, RUBY], [15, 15, RUBY], [17, 16, AMETHYST], [18, 16, RUBY], [15, 17, RUBY]]) smallGem(p, x, y, r, false);
  // tenaz pendurada debaixo da prateleira
  p.line(3, 24, 1, 33, PAL.iron[2]);
  p.line(4, 24, 6, 33, PAL.iron[1]);
  p.set(3, 24, PAL.iron[3]);

  // mostruário de feltro com gemas de todas as cores
  p.rect(44, 7, 19, 14, (x, y) => {
    if (x === 44 || x === 62 || y === 7 || y === 20) return pick(PAL.wood, (x === 44 || y === 7 ? 0.7 : 0.3) + lampLight(x, y, k) * 0.4, x, y);
    return pick(FELT, 0.35 + lampLight(x, y, k) * 0.8 + ((x + y) % 4 === 0 ? -0.08 : 0), x, y);
  });
  p.rect(43, 6, 21, 1, PAL.out);
  p.rect(43, 21, 21, 1, PAL.out);
  p.rect(43, 6, 1, 16, PAL.out);
  const showcase = [[47, 11, RUBY], [52, 11, EMERALD], [57, 11, AMETHYST], [47, 16, PAL.gold], [52, 16, SAPPHIRE], [57, 16, RUBY]];
  for (const [x, y, r] of showcase) smallGem(p, x + 1, y, r, true);
  p.rect(53, 4, 1, 2, PAL.iron[2]);

  // roda de polir de arenito no cavalete
  const [wx, wy, wr] = GEM_WHEEL;
  p.poly([[45, 64], [50, 39], [52, 39], [48.5, 64]], (x, y) => pick(PAL.wood, 0.42 + lampLight(x, y, k) * 0.5, x, y));
  p.poly([[64, 64], [58, 39], [60, 39], [65.5, 64]], (x, y) => pick(PAL.wood, 0.22, x, y));
  p.fill(wx - wr - 1, wy - wr - 1, wx + wr + 1, wy + wr + 1, (x, y) => Math.hypot(x - wx, y - wy) <= wr + 0.4, (x, y) => {
    const dx = x + 0.5 - wx, dy = y + 0.5 - wy, d = Math.hypot(dx, dy);
    if (d > wr - 1) return pick(GRIND, 0.3 + sphereLight(dx / wr, dy / wr) * 0.5, x, y);
    return pick(GRIND, 0.22 + sphereLight(dx / wr * 0.6, dy / wr * 0.6) * 0.5 + lampLight(x, y, k) * 0.4 + (hash(x, y, 135) - 0.5) * 0.12 - (d > wr - 2 ? 0.08 : 0), x, y);
  });
  p.sphere(wx, wy, 2, 2, PAL.iron, 0.1);
  p.set(wx - 0.5, wy - 0.5, PAL.iron[1]);
  // manivela
  p.line(wx + 1, wy, wx + 6, wy - 1, PAL.iron[2]);
  p.rect(Math.floor(wx + 6), Math.floor(wy - 3), 1, 3, PAL.wood[3]);
  return p;
}

function cutterEyes(p, closed) {
  for (const x0 of [26, 36]) {
    if (closed) {
      for (let i = 0; i < 3; i++) { p.set(x0 + i, 31, PAL.skin[3]); p.set(x0 + i, 32, PAL.hair[1]); }
      continue;
    }
    // olhando para a gema, embaixo à esquerda
    for (let i = 0; i < 3; i++) p.set(x0 + i, 31, PAL.hair[1]);
    p.set(x0, 32, PAL.iris);
    p.set(x0 + 1, 32, PAL.irisHi);
    p.set(x0 + 2, 32, PAL.eyeWhite);
  }
}

function buildCutter() {
  const p = new Pix(64, 64);

  // camisa verde de mangas arregaçadas e avental de couro
  p.poly([[0, 64], [1, 57], [7, 51], [17, 47.5], [25, 46.5], [39, 46.5], [47, 47.5], [57, 51], [63, 57], [64, 64]], (x, y) => {
    const nx = (x + 0.5 - AX) / 31;
    let v = 0.5 - nx * 0.4 - (y - 50) * 0.012 + Math.sin(x * 0.7 + y * 0.2) * 0.06;
    v += clamp01(1 - Math.hypot((x - 12) / 8, (y - 52) / 4)) * 0.2;
    if (x === 14 || x === 50) v -= 0.14; // dobras
    return pick(SHIRT, v, x, y);
  });
  p.poly([[21, 64], [23, 52], [41, 52], [43, 64]], (x, y) => {
    let v = 0.55 - (x + 0.5 - AX) * 0.03 + (y === 52 ? 0.25 : 0) + (hash(x, y, 136) - 0.5) * 0.14;
    if (hash(x, y, 137) < 0.05) v -= 0.25; // riscos de pedra
    return pick(PAL.leather, v, x, y);
  });
  for (let x = 24; x <= 40; x++) p.set(x, 53, PAL.leather[x < 32 ? 2 : 1]); // costura
  p.line(24, 52, 27, 45, PAL.leather[3]);
  p.line(40, 52, 37, 45, PAL.leather[2]);
  // bolso com um buril
  p.rect(34, 56, 6, 5, (x, y) => pick(PAL.leather, (y === 56 ? 0.75 : 0.42) - (x - 34) * 0.04, x, y));
  p.rect(36, 53, 1, 3, PAL.wood[3]);
  p.set(37, 53, PAL.gold[3]);

  // pescoço
  p.rect(27, 40, 10, 8, (x, y) => pick(PAL.skin, (y < 44 ? 0.18 : 0.34) - (x - 31) * 0.03, x, y));
  // orelhas
  p.sphere(21.6, 33, 2, 3, PAL.skin, 0.12);
  p.sphere(42.4, 33, 2, 3, PAL.skin, -0.18);
  p.set(21, 33, PAL.skin[1]);
  p.set(43, 33, PAL.skin[0]);
  // rosto
  p.fill(21, 19, 43, 44, CUTTER_HEAD, (x, y) => {
    let v = 0.4 + sphereLight((x + 0.5 - 31) / 10 * 0.85, (y + 0.5 - 31) / 11.6 * 0.5 - 0.1) * 0.7;
    if (y < 27) v -= 0.14;
    return pick(PAL.skin, v, x, y, 5);
  });
  // costeletas e barba curta castanha
  const inBeard = (x, y) => CUTTER_HEAD(x, y) && ((y > 37.4 && Math.abs(x - AX) > 2.5 - (y - 38) * 0.8) || (Math.abs(x - AX) > 8.4 && y > 26) || (Math.abs(x - AX) > 6.8 && y > 34.5));
  p.fill(20, 24, 44, 45, inBeard, (x, y) => {
    let v = 0.2 + sphereLight((x + 0.5 - AX) / 10, (y + 0.5 - 36) / 10) * 0.7 + (hash(x, y, 138) - 0.5) * 0.24;
    if ((x + y * 2) % 4 === 0) v -= 0.12;
    return pick(PAL.hair, v, x, y, 1.6);
  });
  // bigode
  for (let x = 28; x <= 36; x++) p.set(x, 37, PAL.hair[x < 31 ? 3 : x < 34 ? 2 : 1]);
  for (const x of [27, 37]) p.set(x, 38, PAL.hair[x < 32 ? 2 : 1]);
  for (let x = 30; x <= 34; x++) p.set(x, 38, PAL.skin[0]);
  for (let x = 30; x <= 33; x++) p.set(x, 39, PAL.lip);
  p.set(31, 39, C('#c06a58'));
  // nariz
  for (const [x, y, k] of [[31, 31, 4], [31, 32, 4], [31, 33, 5], [32, 33, 3], [32, 34, 2], [30, 35, 2], [31, 35, 3], [32, 35, 2], [33, 35, 1], [33, 34, 1]]) p.set(x, y, PAL.skin[k]);
  // sobrancelhas erguidas de quem examina
  for (const [x, y] of [[25, 27], [26, 26], [27, 26], [28, 26], [29, 27]]) { p.set(x, y, PAL.hair[1]); p.set(63 - x, y, PAL.hair[1]); }
  p.set(27, 26, PAL.hair[3]);
  // rugas de concentração
  p.set(31, 28, PAL.skin[2]);
  p.set(32, 28, PAL.skin[2]);
  cutterEyes(p, false);

  // touca de pano vermelho, caída para a direita, com a aba enrolada
  p.fill(18, 8, 49, 25, (x, y) => (((x - 33) / 12.8) ** 2 + ((y - 20) / 10) ** 2 <= 1 || ((x - 39) / 9.4) ** 2 + ((y - 15.6) / 6.4) ** 2 <= 1) && y < 23.5, (x, y) => {
    const nx = (x + 0.5 - 34) / 13, ny = (y + 0.5 - 15) / 9;
    let v = 0.1 + sphereLight(nx, ny) * 0.86 + Math.sin(Math.atan2(y + 0.5 - 23, x + 0.5 - 30) * 6) * 0.08;
    if (y > 19) v -= (y - 19) * 0.06;
    return pick(CAP_RED, v, x, y, 1.8);
  });
  for (let x = 20; x <= 44; x++) {
    const c = Math.round(22.6 + 0.9 * (1 - ((x + 0.5 - AX) / 12.6) ** 2));
    const lit = cylLight((x + 0.5 - AX) / 13);
    for (let k = -1; k <= 1; k++) p.set(x, c + k, pick(CAP_RED, 0.2 + lit * 0.7 + (k < 0 ? 0.2 : k > 0 ? -0.2 : 0.05) + ((x & 3) === 0 ? -0.1 : 0), x, c + k));
  }

  // óculos de aro de latão
  for (const [lx, ly] of [[27, 31.5], [37, 31.5]]) {
    for (let y = 27; y <= 36; y++) {
      for (let x = lx - 5; x <= lx + 5; x++) {
        const d = Math.hypot(x + 0.5 - lx - 0.5, y + 0.5 - ly);
        if (d > 2.5 && d <= 3.4) p.set(x, y, PAL.gold[(x + 0.5 - lx) + (y + 0.5 - ly) < 0 ? 4 : 2]);
      }
    }
  }
  p.set(31, 30, PAL.gold[3]); p.set(32, 30, PAL.gold[3]);
  p.set(26, 29, PAL.glassHi);
  p.set(36, 29, PAL.glassHi);
  p.line(21, 30, 23, 31, PAL.gold[2]);
  p.line(41, 31, 43, 30, PAL.gold[1]);

  // braço erguido segurando a gema contra a luz
  p.poly([[0, 64], [2, 54], [9, 50.5], [14, 55], [10, 64]], (x, y) => pick(SHIRT, 0.62 - (x - 2) * 0.03 - (y - 52) * 0.02, x, y)); // manga
  p.poly([[5, 52], [10, 43], [16, 44.5], [12, 53]], (x, y) => pick(PAL.skin, 0.42 + (12 - x) * 0.04 - (y - 44) * 0.015, x, y)); // antebraço
  for (const [x, y] of [[6, 51], [8, 49], [10, 47], [7, 47]]) p.set(x, y, PAL.hair[2]);
  // mão em concha por baixo: a gema fica apoiada nas pontas do polegar e do indicador
  p.fill(9, 33, 21, 47, (x, y) => ((x - 14.6) / 4.8) ** 2 + ((y - 40.6) / 5.8) ** 2 <= 1, (x, y) =>
    pick(PAL.skin, 0.2 + sphereLight((x + 0.5 - 13.6) / 4.8, (y + 0.5 - 39) / 5.8) * 0.75 - (y < 37 ? 0.12 : 0), x, y));
  for (const [y, x0, x1] of [[41, 15, 18], [43, 15, 18]]) for (let x = x0; x <= x1; x++) p.set(x, y, PAL.skin[1]); // dedos dobrados
  for (const [x, y, k] of [[9, 34, 5], [10, 34, 4], [9, 35, 4], [10, 35, 3], [10, 36, 4], [11, 36, 3], [10, 37, 3], [11, 37, 3]]) p.set(x, y, PAL.skin[k]); // polegar
  for (const [x, y, k] of [[18, 34, 4], [19, 34, 3], [18, 35, 3], [19, 35, 2], [17, 36, 3], [18, 36, 2], [17, 37, 3], [18, 37, 2]]) p.set(x, y, PAL.skin[k]); // indicador
  // a gema azul
  paintCutGem(p, GEM_HELD[0], GEM_HELD[1], SAPPHIRE, 0, 0);

  p.outline(PAL.out);
  return p;
}

const gemArt = { base: null, body: null, frame: new Pix(64, 64) };

function paintGemPortrait(ctx, t, info) {
  const a = gemArt;
  if (!a.base) {
    a.body = buildCutter();
    a.base = buildGemBackdrop(0).blit(a.body, 0, 0);
    const lit = buildGemBackdrop(1).blit(a.body, 0, 0);
    a.lamp = makeHalo(a.base, lit, (x, y) => Math.hypot(x + 0.5 - GEM_LAMP[0], (y + 0.5 - GEM_LAMP[1]) * 0.9) / 46);
    // brilho azul da gema por cima de tudo em volta
    const gx = GEM_HELD[0] + 4.5, gy = GEM_HELD[1] + 3.5;
    const blue = new Pix(64, 64).copyFrom(a.base);
    for (let y = 14; y < 50; y++) {
      for (let x = 0; x < 30; x++) {
        const k = clamp01(1 - Math.hypot(x + 0.5 - gx, y + 0.5 - gy) / 14);
        const c = blue.d[y * 64 + x];
        if (k > 0 && c !== PAL.out && !SAPPHIRE.includes(c)) blue.d[y * 64 + x] = mix(c, SAPPHIRE[4], k * 0.55);
      }
    }
    a.glow = makeHalo(a.base, blue, (x, y) => Math.hypot(x + 0.5 - gx, y + 0.5 - gy) / 14);
    // roda: pixels visíveis do disco, com ângulo e valor
    const [wx, wy, wr] = GEM_WHEEL;
    a.wheel = [];
    for (let y = Math.floor(wy - wr); y <= wy + wr; y++) {
      for (let x = Math.floor(wx - wr); x <= wx + wr; x++) {
        const dx = x + 0.5 - wx, dy = y + 0.5 - wy, d = Math.hypot(dx, dy);
        if (d > 2.4 && d < wr - 1 && !a.body.get(x, y)) a.wheel.push(y * 64 + x, Math.atan2(dy, dx), a.base.d[y * 64 + x]);
      }
    }
    a.lenses = [[25, 30], [35, 30]];
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.base);
  const d = f.d;
  const flick = Math.sin(t * 8.3) * 0.5 + Math.sin(t * 13.1 + 2) * 0.3 + Math.sin(t * 2.7) * 0.2;
  paintHalo(f, a.lamp, 0.48 + flick * 0.06);
  paintFlame(f, GEM_LAMP[0], GEM_LAMP[1] - 1, t, 3.6, 1.3, 0.6);
  // a roda girando: marcas do arenito passando
  const spin = t * (info.working ? 5.5 : 1.2);
  const dark = GRIND[1];
  for (let k = 0; k < a.wheel.length; k += 3) {
    const ang = a.wheel[k + 1] - spin;
    const s = Math.sin(ang * 3);
    d[a.wheel[k]] = s > 0.93 ? dark : a.wheel[k + 2];
  }
  if (info.working) {
    // grão de pedra saltando da roda
    for (let k = 0; k < 5; k++) {
      const life = (t * 1.4 + hash(k, 1, 139)) % 1;
      const x = GEM_WHEEL[0] - 4 - life * (6 + hash(k, 2, 139) * 6), y = GEM_WHEEL[1] + 8 - life * 6 + life * life * 10;
      if (!a.body.get(Math.floor(x), Math.floor(y))) f.set(x, y, life < 0.5 ? GRIND[5] : GRIND[3]);
    }
  }
  // brilho da gema: halo azul pulsando e facetas cintilando
  const beat = 0.5 + Math.sin(t * (info.working ? 2.4 : 1.3)) * 0.5;
  paintHalo(f, a.glow, 0.35 + beat * 0.45 * live + 0.1);
  paintCutGem(f, GEM_HELD[0], GEM_HELD[1], SAPPHIRE, t * (info.working ? 1.6 : 0.8), 0.26);
  sparkle(f, GEM_HELD[0] + 3, GEM_HELD[1] + 1, pulse(t, info.working ? 1.7 : 3.1, 0, 0.6), false, SAPPHIRE[4]);
  sparkle(f, GEM_HELD[0] + 1, GEM_HELD[1] + 3, pulse(t, 2.9, 1.2, 0.45) * 0.6, true, SAPPHIRE[4]);
  // gemas do mostruário e da tigela cintilando de vez em quando
  [[48, 10], [53, 15], [58, 10], [16, 15], [48, 15]].forEach(([x, y], k) => {
    const e = pulse(t, 2.3 + k * 0.6, k * 0.9, 0.4);
    if (e > 0.2) f.set(x, y, e > 0.6 ? WHITE : PAL.gold[5]);
  });
  // piscar (por trás das lentes) e reflexo correndo nos óculos
  if (t % 4.9 > 4.74 || t % 11.7 > 11.55) cutterEyes(f, true);
  const shine = pulse(t, 5.3, 2.1, 0.5);
  if (shine > 0.2) for (const [lx, ly] of a.lenses) { f.set(lx, ly, WHITE); if (shine > 0.6) f.set(lx + 1, ly - 1, PAL.glassHi); }
  f.draw(ctx);
}

function iconCutter() {
  const p = new Pix(16, 16);
  p.sphere(8, 9.5, 4.2, 4.6, PAL.skin, 0.12);
  // barba curta
  p.fill(3, 10, 13, 15, (x, y) => ((x - 8) / 4.4) ** 2 + ((y - 10) / 4.6) ** 2 <= 1 && (y > 11.5 || Math.abs(x - 8) > 3.4), (x, y) =>
    pick(PAL.hair, 0.55 - (y - 11) * 0.08 - (x - 6) * 0.04, x, y));
  // touca
  p.fill(2, 1, 15, 8, (x, y) => (((x - 8.4) / 5.8) ** 2 + ((y - 6.4) / 5.2) ** 2 <= 1 || ((x - 10.4) / 4.4) ** 2 + ((y - 4) / 3.4) ** 2 <= 1) && y < 7, (x, y) =>
    pick(CAP_RED, 0.2 + sphereLight((x + 0.5 - 8.6) / 6, (y + 0.5 - 3.4) / 4.6) * 0.95, x, y));
  p.rect(3, 6, 10, 1, (x) => CAP_RED[x < 8 ? 4 : 3]);
  // óculos
  for (const cx of [5.5, 10.5]) {
    for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 1], [0, 1], [-2, 0], [1, 0]]) p.set(cx + dx, 9 + dy, PAL.gold[dy < 0 || dx < -1 ? 4 : 2]);
    p.set(cx - 1, 9, PAL.iris);
    p.set(cx, 9, PAL.glassHi);
  }
  p.set(7, 9, PAL.gold[3]); p.set(8, 9, PAL.gold[3]);
  // gema azul na frente
  paintBitmap(p, ['.aaa.', 'bbcdd', '.eff.', '..f..'], 0, 11, (i, j, ch) => SAPPHIRE[{ a: 4, b: 3, c: 2, d: 1, e: 2, f: 1 }[ch]]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Banqueiro

const PANEL = ramp('#120b09', '#1d120e', '#2a1a13', '#3a2418', '#4c301e', '#623e26', '#7a4e30', '#94623c'); // lambri da casa de câmbio
const HAT = ramp('#090c22', '#10183a', '#1a2656', '#263876', '#344c96', '#4c68b4', '#6c88cc');
const WINE = ramp('#1c0610', '#320c1a', '#4e1426', '#6e1e34', '#8e2c42', '#b04454');
const FUR = ramp('#1e140e', '#34241a', '#4e3828', '#6a4e38', '#88684a', '#a8875e', '#c8a678');
const GREY = ramp('#2a262c', '#47434a', '#68646c', '#8c888e', '#b2aeb2', '#d6d4d2', '#f2f0ec');
const PAPER = ramp('#6e5a44', '#a08a68', '#c8b48e', '#e6d6b2', '#f6ecd2');
const BEAD = [ramp('#3a0a0c', '#6e1414', '#a42620', '#d04a38'), ramp('#5a4a36', '#94805e', '#c8b48a', '#ece0bc')];
const BANK_CANDLE = [8.5, 27]; // pavio da vela no balcão do fundo
const ABACUS = { x0: 46, x1: 62, rows: [25, 28, 31, 34] };
const BANKER_HEAD = headTest(32, 31, 10.6, 12.2, 0.16);
const STACK = [54, 44]; // topo da pilha alta de moedas
const BROWN_EYE = C('#3a2416');

const bankLight = (x, y, k) => (0.3 + k * 0.16) * clamp01(1 - Math.hypot(x + 0.5 - BANK_CANDLE[0], (y + 0.5 - BANK_CANDLE[1]) * 0.9) / (40 + k * 10)) ** 1.3;

function buildBankBackdrop(k) {
  const p = new Pix(64, 64);
  // lambri de tábuas verticais com uma moldura no meio da altura
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const board = Math.floor(x / 7);
      const seam = x % 7 === 0;
      let v = 0.18 + bankLight(x, y, k) + (hash(board, 0, 151) - 0.5) * 0.08 + Math.sin(y * 0.6 + board * 2.3 + Math.sin(x * 0.9) * 0.6) * 0.03;
      if (seam) v -= 0.12;
      else if (x % 7 === 1) v += 0.05;
      if (y === 14) v += 0.2; else if (y === 15) v -= 0.2; // friso
      p.d[y * 64 + x] = pick(PANEL, v, x, y, 2);
    }
  }
  // prateleira com livros de contas em pé
  p.rect(0, 13, 26, 2, (x, y) => pick(PAL.wood, (y === 13 ? 0.75 : 0.3) + bankLight(x, y, k) * 0.5, x, y));
  const BOOKS = [ramp('#3a0e12', '#6a1a1e', '#94302a'), ramp('#10301c', '#1e4e2c', '#2e6e3c'), ramp('#3a2414', '#5e3c20', '#84582e'),
    ramp('#141c40', '#22306a', '#34488e'), ramp('#4a3610', '#7a5a1c', '#a8822c')];
  let x = 1, b = 0;
  while (x < 24) {
    const bw = 2 + Math.floor(hash(x, 1, 152) * 2);
    const bh = 8 + Math.floor(hash(x, 2, 152) * 4);
    const r = BOOKS[b++ % BOOKS.length];
    for (let i = 0; i < bw; i++) {
      for (let y = 13 - bh; y < 13; y++) {
        let c = r[i === 0 ? 2 : i === bw - 1 ? 0 : 1];
        if (y === 13 - bh + 2 || y === 10) c = PAL.gold[i === bw - 1 ? 1 : 3];
        p.set(x + i, y, c);
      }
    }
    x += bw + (hash(x, 3, 152) < 0.2 ? 1 : 0);
  }
  // balcão do fundo
  p.rect(0, 38, 64, 3, (x, y) => pick(PAL.wood, (y === 38 ? 0.8 : 0.45) + bankLight(x, y, k) * 0.4 - x * 0.004, x, y));
  p.rect(0, 41, 64, 23, (x, y) => pick(PAL.wood, 0.14 + bankLight(x, y, k) * 0.6 + (x % 9 === 0 ? -0.08 : 0) - (y - 41) * 0.004, x, y));
  p.rect(0, 41, 64, 1, PAL.out);
  // livros-razão deitados e a vela em cima
  for (const [bx, by, bw, r] of [[1, 34, 15, BOOKS[0]], [2, 31, 13, BOOKS[3]], [1, 28, 14, BOOKS[2]]]) {
    p.rect(bx, by, bw, 3, (x, y) => {
      if (x >= bx + bw - 2) return PAPER[y === by ? 3 : 2]; // folhas na lateral
      return y === by ? r[2] : x === bx + 2 ? PAL.gold[3] : r[1];
    });
    p.rect(bx, by + 3, bw, 1, PAL.out);
  }
  p.rect(7, 23, 3, 5, (x) => (x === 7 ? C('#f4ead2') : x === 8 ? C('#e2d4b4') : C('#b8a888')));
  p.set(8, 23, C('#fff8e4'));
  p.rect(5, 27, 7, 1, PAL.gold[3]);
  p.set(BANK_CANDLE[0] - 0.5, BANK_CANDLE[1] - 4, PAL.out);

  // ábaco de madeira com contas (as contas são pintadas a cada quadro)
  const { x0, x1, rows } = ABACUS;
  p.rect(x0, 22, x1 - x0 + 1, 16, (x, y) => {
    if (x === x0 || x === x1 || x === x0 + 1 || x === x1 - 1 || y === 22 || y === 23 || y === 36 || y === 37) {
      return pick(PAL.wood, (x === x0 || y === 22 ? 0.85 : x === x1 || y === 37 ? 0.25 : 0.55) + bankLight(x, y, k) * 0.3, x, y);
    }
    return pick(PANEL, 0.08 + bankLight(x, y, k) * 0.5, x, y);
  });
  for (const ry of rows) p.rect(x0 + 2, ry, x1 - x0 - 3, 1, PAL.iron[2]);
  p.rect(x0 - 1, 21, x1 - x0 + 3, 1, PAL.out);
  p.rect(x0 - 1, 21, 1, 17, PAL.out);
  p.rect(x1 + 1, 21, 1, 17, PAL.out);
  return p;
}

function bankerEyes(p, closed) {
  for (const x0 of [26, 35]) {
    const left = x0 === 26;
    for (let i = 0; i < 3; i++) p.set(x0 + i, 30, PAL.skin[2]); // pálpebra pesada
    if (closed) {
      for (let i = 0; i < 3; i++) p.set(x0 + i, 31, GREY[1]);
      continue;
    }
    // olhando para as moedas, embaixo à direita
    p.set(x0, 31, PAL.eyeWhite);
    p.set(x0 + 1, 31, left ? C('#7a5032') : PAL.eyeWhite);
    p.set(x0 + 2, 31, BROWN_EYE);
  }
}

function buildBanker() {
  const p = new Pix(64, 64);

  // toga de veludo vinho
  p.poly([[0, 64], [1, 56], [6, 50], [16, 46.5], [25, 45.5], [39, 45.5], [48, 46.5], [58, 50], [63, 56], [64, 64]], (x, y) => {
    const nx = (x + 0.5 - AX) / 31;
    let v = 0.52 - nx * 0.4 - (y - 50) * 0.01 + Math.sin(x * 0.55 + 1) * 0.07;
    v += clamp01(1 - Math.hypot((x - 10) / 7, (y - 52) / 4)) * 0.16; // brilho do veludo
    if (x === 8 || x === 55) v -= 0.16; // dobras
    return pick(WINE, v, x, y);
  });
  // gibão escuro na abertura da toga, com botões
  p.poly([[23, 64], [27, 47], [37, 47], [41, 64]], (x, y) => pick(HAT, 0.3 - (x - 27) * 0.02, x, y));
  for (const y of [52, 56, 60]) { p.set(32, y, PAL.gold[4]); p.set(32, y + 1, PAL.gold[2]); }
  // debrum de pele de marta na abertura da toga
  for (const side of [-1, 1]) {
    const pts = [[16, 47.4], [24, 46.6], [27, 50], [26, 57], [24, 64]].map(([x, y]) => [side < 0 ? x : 64 - x, y]);
    p.fill(10, 44, 54, 63, (x, y) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        const dx = bx - ax, dy = by - ay;
        const s = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
        if (Math.hypot(x - ax - dx * s, y - ay - dy * s) <= 2.3 + (hash(Math.floor(x), Math.floor(y), 153) - 0.5) * 0.9) return true;
      }
      return false;
    }, (x, y) => pick(FUR, 0.6 - (side > 0 ? 0.2 : 0) + (hash(x, y, 154) - 0.5) * 0.22 + ((x + y * 2) % 4 === 0 ? 0.12 : 0) - (y - 47) * 0.008, x, y, 1.5));
  }
  // pescoço, com a gola branca de linho
  p.rect(26, 39, 12, 7, (x, y) => pick(PAL.skin, (y < 43 ? 0.2 : 0.34) - (x - 31) * 0.03, x, y));
  for (let x = 26; x <= 37; x++) { p.set(x, 45, PAL.linen[x < 32 ? 4 : 3]); p.set(x, 46, PAL.linen[(x & 1) ? 2 : 3]); }

  // cabelo grisalho dos lados
  p.fill(18, 20, 46, 38, (x, y) => ((x - AX) / 12.6) ** 2 + ((y - 29) / 9.5) ** 2 <= 1 && y > 21, (x, y) =>
    pick(GREY, 0.25 + sphereLight((x + 0.5 - AX) / 12.6, (y + 0.5 - 27) / 9.5) * 0.7 + (hash(x, y, 155) - 0.5) * 0.2 + (y % 2 ? 0 : 0.06), x, y, 1.6));
  // orelhas
  p.sphere(21.2, 32, 2, 3, PAL.skin, 0.1);
  p.sphere(42.8, 32, 2, 3, PAL.skin, -0.2);
  p.set(21, 32, PAL.skin[1]);
  p.set(43, 32, PAL.skin[0]);
  // rosto cheio, com bochechas e papada
  p.fill(20, 18, 44, 45, BANKER_HEAD, (x, y) => {
    let v = 0.4 + sphereLight((x + 0.5 - 31) / 10.6 * 0.8, (y + 0.5 - 31) / 12.2 * 0.45 - 0.15) * 0.68;
    if (y < 25) v -= 0.18; // sombra da aba
    if (y > 42) v -= 0.1;
    return pick(PAL.skin, v, x, y, 6);
  });
  // papada e bochechas
  for (let x = 28; x <= 36; x++) p.set(x, 42, PAL.skin[x < 32 ? 2 : 1]);
  for (const [x, y] of [[25, 36], [26, 36]]) { p.set(x, y, PAL.blush); p.set(63 - x, y, PAL.blush); }
  p.set(26, 38, PAL.skin[2]);
  p.set(37, 38, PAL.skin[1]);
  // sobrancelhas grisalhas
  for (const [x, y] of [[25, 28], [26, 27], [27, 27], [28, 27], [29, 28]]) { p.set(x, y, GREY[4]); p.set(63 - x, y, GREY[2]); }
  bankerEyes(p, false);
  // nariz grande
  for (const [x, y, k] of [[31, 30, 4], [31, 31, 4], [31, 32, 5], [32, 32, 3], [31, 33, 4], [32, 33, 3], [32, 34, 2], [30, 35, 3], [31, 35, 4], [32, 35, 3], [33, 35, 1], [30, 36, 1], [31, 36, 2], [32, 36, 2], [33, 36, 1]]) p.set(x, y, PAL.skin[k]);
  // sorriso fino de canto
  for (let x = 29; x <= 34; x++) p.set(x, 39, PAL.skin[x === 29 ? 2 : 0]);
  p.set(35, 38, PAL.skin[1]);
  for (let x = 30; x <= 33; x++) p.set(x, 40, PAL.skin[2]);
  p.set(31, 40, PAL.lip);
  p.set(32, 40, PAL.lip);

  // chapéu de veludo azul, largo e fofo, com faixa dourada
  p.fill(14, 4, 51, 25, (x, y) => ((x - 33) / 17.4) ** 2 + ((y - 15.4) / 8.4) ** 2 <= 1 && y < 23.5, (x, y) => {
    const nx = (x + 0.5 - 31) / 17.4, ny = (y + 0.5 - 12) / 8.4;
    const ang = Math.atan2(y + 0.5 - 22, x + 0.5 - 33);
    let v = 0.06 + sphereLight(nx, ny) * 0.92 + Math.sin(ang * 9 + 0.4) * 0.08;
    if (y > 19) v -= (y - 19) * 0.08;
    return pick(HAT, v, x, y, 1.6);
  });
  for (let x = 19; x <= 45; x++) {
    const c = Math.round(22.4 + 0.8 * (1 - ((x + 0.5 - AX) / 13) ** 2));
    const lit = cylLight((x + 0.5 - AX) / 13.4);
    p.set(x, c - 1, PAL.gold[lit > 0.6 ? 4 : lit > 0.3 ? 3 : 2]);
    p.set(x, c, x % 3 === 0 ? PEARL[lit > 0.5 ? 3 : 2] : PAL.gold[lit > 0.6 ? 3 : 2]);
    p.set(x, c + 1, PAL.gold[1]);
  }
  // broche com rubi e pérola pendurada
  p.sphere(23, 19, 2, 2, PAL.gold, 0.15);
  p.set(23, 19, RUBY[3]);
  p.set(22, 18, RUBY[4]);
  p.set(23, 20, RUBY[1]);
  p.set(23, 22, PEARL[3]);

  // colar de ouro de elos grandes sobre os ombros, com medalhão
  for (let i = 0; i <= 16; i++) {
    const s = -1 + (2 * i) / 16;
    const x = Math.round(AX - 0.5 + s * 13), y = Math.round(47 + (1 - s * s) * 6 + Math.abs(s) * 0.4);
    if (i % 2 === 0) {
      p.set(x, y, PAL.gold[s < 0.3 ? 5 : 4]); p.set(x + 1, y, PAL.gold[3]);
      p.set(x, y + 1, PAL.gold[3]); p.set(x + 1, y + 1, PAL.gold[1]);
    }
    else p.set(x, y, PAL.gold[2]);
  }
  p.sphere(AX, 57.6, 3.4, 3.4, PAL.gold, 0.08);
  p.fill(28, 54, 36, 61, (x, y) => Math.abs(Math.hypot(x - AX, y - 57.6) - 2.3) < 0.5, () => PAL.gold[2]);
  p.set(31, 57, RUBY[3]);
  p.set(32, 57, RUBY[2]);
  p.set(31, 58, RUBY[1]);

  // balcão da frente: tinteiro com pena, livro aberto e pilhas de moedas
  p.rect(0, 59, 64, 5, (x, y) => pick(PAL.wood, (y === 59 ? 0.85 : y === 60 ? 0.5 : 0.28) - x * 0.004, x, y));
  p.poly([[1, 59], [3, 54], [13, 54.4], [13, 59]], (x, y) => pick(PAPER, 0.85 - (y - 54) * 0.035 - (x < 3 ? 0.2 : 0), x, y));
  p.poly([[13, 59], [13, 54.4], [23, 54], [25, 59]], (x, y) => pick(PAPER, 0.62 - (y - 54) * 0.035 - (x > 22 ? 0.2 : 0), x, y));
  for (const y of [55, 57]) for (let x = 4; x <= 22; x++) if (x < 12 || x > 14) p.set(x, y, hash(x >> 1, y, 157) < 0.75 ? PAPER[x < 13 ? 1 : 0] : PAPER[x < 13 ? 3 : 2]);
  p.rect(13, 54, 1, 5, PAPER[1]);
  for (const x of [8, 18]) p.set(x, 58, PAL.banner[2]); // somas em vermelho
  // pilhas de moedas
  for (const [sx, top] of [[STACK[0], STACK[1]], [59, 51], [48, 53]]) {
    for (let y = top; y < 59; y++) {
      for (let x = sx - 2; x <= sx + 2; x++) {
        const edge = y === top;
        const v = edge ? 0.9 - (x - sx) * 0.1 : 0.45 + cylLight((x + 0.5 - sx) / 2.6) * 0.45 - ((y - top) % 2 ? 0.18 : 0);
        p.set(x, y, pick(PAL.gold, v, x, y));
      }
    }
  }
  // mão fechada com o polegar pronto para jogar a moeda
  p.poly([[37, 64], [38, 57], [44, 55], [46, 59], [45, 64]], (x, y) => pick(WINE, 0.5 - (x - 38) * 0.03 + (y < 58 ? 0.1 : 0), x, y)); // manga
  p.rect(38, 56, 7, 1, PAL.gold[3]); // punho bordado
  p.fill(37, 48, 46, 56, (x, y) => ((x - 41.6) / 3.8) ** 2 + ((y - 52.2) / 3.4) ** 2 <= 1, (x, y) =>
    pick(PAL.skin, 0.2 + sphereLight((x + 0.5 - 41) / 3.8, (y + 0.5 - 51.4) / 3.4) * 0.8, x, y));
  for (const [y, x0, x1] of [[51, 41, 44], [53, 41, 44]]) for (let x = x0; x <= x1; x++) p.set(x, y, PAL.skin[1]); // dedos dobrados
  p.rect(38, 48, 3, 2, (x, y) => PAL.skin[y === 48 ? 4 : 3]); // polegar
  p.set(38, 50, PAL.skin[3]);
  p.set(45, 52, PAL.gold[4]); // anel
  p.set(45, 53, PAL.gold[2]);

  p.outline(PAL.out);
  return p;
}

// moeda segura entre os dedos (some quando é lançada)
const HAND_COIN = [40, 46];

const bankArt = { base: null, body: null, frame: new Pix(64, 64), coin: new Pix(6, 6) };

function paintBankPortrait(ctx, t, info) {
  const a = bankArt;
  if (!a.base) {
    a.body = buildBanker();
    a.base = buildBankBackdrop(0).blit(a.body, 0, 0);
    const lit = buildBankBackdrop(1).blit(a.body, 0, 0);
    a.candle = makeHalo(a.base, lit, (x, y) => Math.hypot(x + 0.5 - BANK_CANDLE[0], (y + 0.5 - BANK_CANDLE[1]) * 0.9) / 48);
    a.gold = rampPixels(a.base, PAL.gold, 16, 44, 48, 62);
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.base);
  const flick = Math.sin(t * 7.9) * 0.5 + Math.sin(t * 12.7 + 2) * 0.3 + Math.sin(t * 2.6) * 0.2;
  paintHalo(f, a.candle, 0.5 + flick * 0.06);
  paintFlame(f, BANK_CANDLE[0] - 0.5, BANK_CANDLE[1] - 5, t, 3.4, 1.2, 0.6);
  // contas do ábaco correndo nas varetas
  const { x0, x1, rows } = ABACUS;
  const span = x1 - x0 - 5;
  rows.forEach((ry, r) => {
    const move = info.working ? clamp01(Math.sin(t * 1.6 + r * 1.9) * 1.4 + 0.5) : 0.3 + r * 0.1;
    for (let b = 0; b < 4; b++) {
      const left = b < 2 + (r & 1);
      const bx = left ? x0 + 2 + b * 2 + move * (span - 8) * 0.35 : x1 - 3 - (3 - b) * 2 - (1 - move) * (span - 8) * 0.35;
      const col = BEAD[(r + (left ? 0 : 1)) & 1];
      const x = Math.round(bx);
      for (const [dx, dy, k] of [[0, -1, 3], [1, -1, 2], [0, 0, 2], [1, 0, 1], [0, 1, 1], [1, 1, 0]]) {
        if (!a.body.get(x + dx, ry + dy)) f.set(x + dx, ry + dy, col[k]);
      }
    }
  });
  // moeda saltando da mão para a pilha
  const per = info.working ? 1.5 : 3.2;
  const u = (t % per) / per;
  const c = a.coin;
  const coin = (x, y, w) => {
    c.clear();
    c.fill(0, 0, 5, 5, (px, py) => ((px - 3) / Math.max(0.55, w * 2.4)) ** 2 + ((py - 3) / 2.4) ** 2 <= 1, (px, py) => PAL.gold[px + py < 5 ? 5 : px + py < 7 ? 4 : 2]);
    c.outline(PAL.out);
    f.blit(c, x - 3, y - 3);
  };
  if (u < 0.6) {
    const s = u / 0.6;
    const x = HAND_COIN[0] + (STACK[0] - HAND_COIN[0]) * s, y = HAND_COIN[1] + (STACK[1] - 2 - HAND_COIN[1]) * s - Math.sin(s * Math.PI) * 9;
    coin(x, y, Math.abs(Math.cos(t * 10)));
  }
  else {
    sparkle(f, STACK[0], STACK[1] - 1, pulse(u, 1, -0.6, 0.3));
    if (u > 0.7) coin(HAND_COIN[0], HAND_COIN[1], 1); // a próxima moeda já na mão
  }
  // piscar e brilho correndo pelo colar
  if (t % 5.2 > 5.05 || t % 13.1 > 12.95) bankerEyes(f, true);
  sweepGlint(f, a.gold, PAL.gold, ((t % (info.working ? 3 : 5)) / 1.5) * 40 + 40, 1.6);
  sparkle(f, 22, 18, pulse(t, 4.4, 1.1, 0.5) * 0.7);
  f.draw(ctx);
}

function iconBanker() {
  const p = new Pix(16, 16);
  p.fill(1, 4, 15, 13, (x, y) => ((x - 8) / 6) ** 2 + ((y - 9) / 4.4) ** 2 <= 1 && y > 6, (x, y) => pick(GREY, 0.3 + sphereLight((x + 0.5 - 8) / 6, 0) * 0.6, x, y));
  p.sphere(8, 9.6, 4.4, 4.4, PAL.skin, 0.12);
  p.set(6, 9, BROWN_EYE);
  p.set(10, 9, BROWN_EYE);
  for (let x = 6; x <= 9; x++) p.set(x, 12, PAL.skin[1]);
  // chapéu largo de veludo azul
  p.fill(0, 0, 16, 7, (x, y) => ((x - 8.4) / 7.6) ** 2 + ((y - 4) / 3.8) ** 2 <= 1 && y < 6.5, (x, y) =>
    pick(HAT, 0.15 + sphereLight((x + 0.5 - 7.6) / 7.6, (y + 0.5 - 2.4) / 3.8) * 0.95, x, y));
  p.rect(3, 6, 10, 1, (x) => (x % 3 === 0 ? PEARL[3] : PAL.gold[x < 8 ? 4 : 3]));
  // colar e moeda
  p.rect(4, 14, 8, 1, (x) => PAL.gold[x & 1 ? 2 : 4]);
  p.fill(10, 11, 16, 16, (x, y) => Math.hypot(x - 13, y - 13.5) <= 2.6, (x, y) => PAL.gold[x + y < 25 ? 5 : x + y < 27 ? 4 : 2]);
  p.set(13, 13, PAL.gold[2]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Coração da montanha

const CAVE = ramp('#07050a', '#0f0a14', '#18101e', '#22162a', '#2e1c36', '#3e2442', '#522c4c', '#6a3654', '#86445a'); // rocha tingida pela luz do cristal
const HEART = ramp('#22040e', '#460a1e', '#781232', '#ac1e48', '#dc3a64', '#f87092', '#ffb0c8', '#ffe6ee');
const VEIN = ramp('#2a0c0a', '#5a1a0e', '#9a3412', '#d8641c', '#f8a438', '#ffd878', '#fff6d0');
const HEART_C = [32, 30]; // centro da luz
// Cristais: base, ponta e meia largura.
const CRYSTALS = [
  [[25, 49], [14, 27], 3.6],
  [[40, 49], [50.5, 31], 3.2],
  [[32, 49], [33, 6], 6.2],
  [[27.5, 53], [22.5, 45], 2],
  [[37.5, 53], [42, 46], 1.8],
];

// Batida do coração: duas pancadas e um descanso (ph de 0 a 1).
function heartbeat(ph) {
  ph -= Math.floor(ph);
  return Math.exp(-(((ph - 0.15) / 0.055) ** 2)) + 0.62 * Math.exp(-(((ph - 0.36) / 0.065) ** 2));
}

// Ponto (x, y) no sistema de um cristal: u ao longo do eixo (0 na base), s de lado (-1 a 1).
function crystalAt(c, x, y) {
  const [[bx, by], [tx, ty], w] = c;
  const len = Math.hypot(tx - bx, ty - by), ax = (tx - bx) / len, ay = (ty - by) / len;
  const u = (x - bx) * ax + (y - by) * ay, s = (x - bx) * -ay + (y - by) * ax;
  const shoulder = len - w * 1.7;
  if (u < -0.5 || u > len) return null;
  const half = u < shoulder ? w : w * (len - u) / (len - shoulder);
  if (Math.abs(s) > half) return null;
  return { u: u / len, s: s / Math.max(0.6, half), tip: u >= shoulder };
}

const HEART_SHARDS = [[5, 30, 1], [9, 49, 1], [58, 24, -1], [55, 47, -1], [14, 8, 1], [47, 9, -1], [20, 59, 1], [45, 60, -1]];
const heartGlow = (x, y, k) => (0.36 + k * 0.3) * clamp01(1 - Math.hypot(x + 0.5 - HEART_C[0], (y + 0.5 - HEART_C[1]) * 0.8) / (36 + k * 12)) ** 1.1;

// Veios: caminhos tortos saindo de perto do cristal pelas paredes; cada pixel guarda a distância.
const HEART_VEINS = (() => {
  const px = new Map();
  const walk = (x, y, ang, len, d0, seed) => {
    for (let i = 0; i < len; i++) {
      ang += (hash(i, seed, 161) - 0.5) * 0.9;
      x += Math.cos(ang);
      y += Math.sin(ang) * 0.8;
      const k = Math.floor(y) * 64 + Math.floor(x);
      if (x < 0 || x >= 64 || y < 0 || y >= 64) return;
      if (!px.has(k)) px.set(k, d0 + i);
      if (hash(i, seed, 162) < 0.06 && len - i > 6) walk(x, y, ang + (hash(i, seed, 163) < 0.5 ? 0.9 : -0.9), (len - i) >> 1, d0 + i, seed * 7 + i);
    }
  };
  const starts = [[-2.7, 34], [-2.25, 30], [-1.85, 26], [-1.25, 24], [-0.75, 28], [-0.3, 34], [0.2, 30], [2.95, 26], [0.5, 22], [-3.05, 30], [2.6, 18]];
  starts.forEach(([a, len], k) => walk(HEART_C[0] + Math.cos(a) * 10, 42 + Math.sin(a) * 8, a, len, 0, k + 1));
  return px;
})();

function buildHeartBackdrop(k) {
  const p = new Pix(64, 64);
  // fundo da caverna
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const strata = Math.sin((y + x * 0.35) * 0.9 + Math.sin(x * 0.2) * 2) * 0.05;
      const far = Math.hypot(x + 0.5 - HEART_C[0], (y + 0.5 - HEART_C[1]) * 0.8);
      const v = 0.2 + heartGlow(x, y, k) + rockTone(x, y, 11, 164) * 0.7 + strata - far * 0.004;
      p.d[y * 64 + x] = pick(CAVE, v, x, y, 2);
    }
  }
  // veios apagados
  for (const [i] of HEART_VEINS) p.d[i] = VEIN[2];
  // rochas da frente: paredes dos lados, estalactites e o chão
  const front = new Pix(64, 64);
  const wallL = (y) => 7 + Math.sin(y * 0.21 + 1) * 3 + Math.sin(y * 0.57) * 1.4 - (y > 50 ? (y - 50) * 0.3 : 0);
  const wallR = (y) => 57 - Math.sin(y * 0.19 + 2) * 3 - Math.sin(y * 0.5 + 1) * 1.4 + (y > 50 ? (y - 50) * 0.3 : 0);
  const stalac = [[13, 9, 3.4], [21, 5, 2.4], [44, 7, 3], [51, 12, 3.2], [36, 3, 1.8]];
  const ceil = (x) => 2.4 + Math.sin(x * 0.3) * 1.4 + stalac.reduce((m, [sx, len, w]) => Math.max(m, len * clamp01(1 - Math.abs(x + 0.5 - sx) / w)), 0);
  const floor = (x) => 57 + Math.sin(x * 0.4) * 1.2 + Math.sin(x * 0.13 + 2) * 1.5;
  front.fill(0, 0, 63, 63, (x, y) => x < wallL(y) || x > wallR(y) || y < ceil(x) || y > floor(x), (x, y) => {
    const g = heartGlow(x, y, k);
    let v = 0.03 + g * 0.55 + rockTone(x, y, 6, 165) * 0.6;
    // borda que pega a luz do cristal
    const toward = x < wallL(y) + 0.5 ? x + 1.5 > wallL(y) : x > wallR(y) - 0.5 ? x - 1.5 < wallR(y) : y < ceil(x) + 0.5 ? y + 1.5 > ceil(x) : y - 1.5 < floor(x);
    if (toward) v += 0.2 + g * 0.6;
    return pick(CAVE, v, x, y, 2);
  });
  front.outline(PAL.out);
  p.blit(front, 0, 0);
  // cristaizinhos brotando das paredes
  for (const [x, y, dx] of HEART_SHARDS) {
    p.set(x, y, HEART[5]); p.set(x + dx, y - 1, HEART[6]); p.set(x, y + 1, HEART[3]); p.set(x + dx, y, HEART[4]);
  }
  return p;
}

function buildHeart(glow = 0.5) {
  const p = new Pix(64, 64);
  // monte de rocha onde o cristal nasceu
  p.fill(10, 44, 54, 63, (x, y) => ((x - 32) / 21) ** 2 + ((y - 59) / 11) ** 2 <= 1 && y > 46 - Math.sin(x * 0.9) * 0.8, (x, y) => {
    const v = 0.2 + heartGlow(x, y, glow) * 0.9 + sphereLight((x + 0.5 - 32) / 21, (y + 0.5 - 56) / 10) * 0.25 + rockTone(x, y, 4, 166) * 0.8;
    return pick(CAVE, v, x, y, 2);
  });
  // cristais, do fundo para a frente
  for (const c of CRYSTALS) {
    const [[bx, by], [tx, ty], w] = c;
    p.fill(Math.min(bx, tx) - w - 1, Math.min(by, ty) - 1, Math.max(bx, tx) + w + 1, Math.max(by, ty) + 1, (x, y) => crystalAt(c, x, y) !== null, (x, y) => {
      const q = crystalAt(c, x + 0.5, y + 0.5);
      let v = q.s < -0.34 ? 0.72 : q.s > 0.34 ? 0.3 : 0.5; // três faces
      if (Math.abs(q.s + 0.34) < 0.16 || Math.abs(q.s - 0.34) < 0.16) v += 0.18; // arestas
      if (q.tip) v += q.s < 0 ? 0.14 : -0.06;
      v += (1 - Math.abs(q.s)) * 0.12 * glow + q.u * 0.12 - (q.u < 0.08 ? 0.15 : 0);
      return pick(HEART, v, x, y, 2.4);
    });
  }
  p.outline(PAL.out);
  return p;
}

const heartArt = { base: null, body: null, frame: new Pix(64, 64) };

function paintHeartPortrait(ctx, t, info) {
  const a = heartArt;
  if (!a.base) {
    a.body = buildHeart(0);
    a.base = buildHeartBackdrop(0).blit(a.body, 0, 0);
    const lit = buildHeartBackdrop(1).blit(buildHeart(1), 0, 0);
    // aura rosada em volta dos cristais
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const i = y * 64 + x, c = lit.d[i];
        const k = clamp01(1 - Math.hypot((x + 0.5 - 32) * 1.1, (y + 0.5 - 32) * 0.6) / 17);
        if (k > 0 && c !== PAL.out && !HEART.includes(c)) lit.d[i] = mix(c, HEART[4], k * 0.5);
      }
    }
    a.halo = makeHalo(a.base, lit, (x, y) => (HEART.includes(a.base.get(x, y)) ? null : Math.hypot(x + 0.5 - HEART_C[0], (y + 0.5 - HEART_C[1]) * 0.85) / 44));
    // pixels dos cristais com o tom de cada um e a força do brilho de dentro
    a.crys = [];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        let q = null;
        for (let i = CRYSTALS.length - 1; i >= 0 && !q; i--) q = crystalAt(CRYSTALS[i], x + 0.5, y + 0.5);
        const c = a.base.get(x, y);
        if (!q || !HEART.includes(c)) continue;
        a.crys.push(y * 64 + x, HEART.indexOf(c) / (HEART.length - 1), (1 - Math.abs(q.s)) * (0.4 + q.u * 0.6));
      }
    }
    a.veins = [];
    for (const [i, dist] of HEART_VEINS) if (!a.body.d[i] && a.base.d[i] === VEIN[2]) a.veins.push(i, dist);
  }
  const per = info.working ? 1.15 : 1.9;
  const beat = heartbeat(t / per);
  const f = a.frame.copyFrom(a.base);
  const d = f.d;
  paintHalo(f, a.halo, 0.25 + beat * (info.working ? 0.6 : 0.4));
  // veios: a pancada corre do cristal para as pontas
  for (let k = 0; k < a.veins.length; k += 2) {
    const i = a.veins[k];
    const b = heartbeat((t - a.veins[k + 1] * 0.03) / per);
    d[i] = VEIN[Math.min(6, 2 + Math.round(b * (info.working ? 4 : 3) + 0.2))];
  }
  // cristal brilhando de dentro para fora
  const glow = 0.06 + beat * 0.32;
  for (let k = 0; k < a.crys.length; k += 3) {
    const i = a.crys[k];
    d[i] = pick(HEART, a.crys[k + 1] + a.crys[k + 2] * glow, i & 63, i >> 6, 2.4);
  }
  // partículas subindo em espiral em volta do cristal
  const n = info.working ? 16 : 9;
  for (let k = 0; k < n; k++) {
    const life = (t * (0.12 + hash(k, 1, 167) * 0.1) + hash(k, 2, 167)) % 1;
    const r = 8 + hash(k, 3, 167) * 14;
    const x = HEART_C[0] + Math.sin(t * 0.9 + k * 2.1) * r * (1 - life * 0.4);
    const y = 54 - life * 50;
    const c = life < 0.25 ? VEIN[5] : life < 0.6 ? HEART[6] : HEART[4];
    if (life > 0.04 && life < 0.94) f.set(x, y, c);
  }
  // cristaizinhos das paredes piscando com a pancada
  HEART_SHARDS.forEach(([x, y], k) => { if (heartbeat(t / per - 0.05 - k * 0.02) > 0.6) f.set(x, y, HEART[7]); });
  // estrela de brilho na ponta a cada batida
  sparkle(f, 33, 9, beat * 0.9, false, HEART[6]);
  sparkle(f, 16, 29, heartbeat(t / per - 0.12) * 0.55, true, HEART[6]);
  f.draw(ctx);
}

function iconHeart() {
  const p = new Pix(16, 16);
  // monte de pedra
  p.fill(1, 11, 15, 16, (x, y) => ((x - 8) / 7) ** 2 + ((y - 15) / 4) ** 2 <= 1, (x, y) => pick(CAVE, 0.45 + (8 - x) * 0.03 + ((x + y) % 3 === 0 ? -0.1 : 0), x, y));
  // cristais
  const shard = (pts, lit) => p.poly(pts, (x) => HEART[lit(x)]);
  shard([[2, 6], [4, 5], [7, 12], [4, 13]], (x) => (x < 4 ? 5 : 3));
  shard([[13.5, 7], [15, 8.5], [11.5, 13], [10, 12]], (x) => (x < 13 ? 4 : 2));
  p.poly([[8, 0], [11, 3.5], [11, 13], [5, 13], [5, 3.5]], (x, y) => HEART[x < 7 ? (y < 4 ? 7 : 6) : x < 9 ? (y < 4 ? 5 : 4) : 3]);
  p.set(7, 2, WHITE);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Tesouraria

const VAULT = ramp('#100c10', '#1a1419', '#262024', '#342b2f', '#45383a', '#5a4946', '#725c54', '#8e7462', '#ac8e72');
const DOOR_IRON = ramp('#15151b', '#24242c', '#363640', '#4c4c56', '#66666f', '#84848b', '#a8a8ac', '#d0d0cc');
const LINING = ramp('#1e0408', '#3a0a12', '#5e121c', '#861e26', '#ac3232');
const PEARL = ramp('#6a6474', '#a8a2b0', '#dad4dc', '#fbf8f2');
const TREAS_LAMP = [20.5, 11]; // base da chama da lamparina pendurada
const TREAS_DOOR = [46.5, 26.5, 12.5]; // centro e raio da porta redonda
const heapTop = (x) => 61 - 12 * Math.exp(-(((x - 31) / 12) ** 2)) - 4 * Math.exp(-(((x - 13) / 6) ** 2)) - 3 * Math.exp(-(((x - 53) / 6) ** 2));

const treasLight = (x, y, k) => (0.28 + k * 0.16) * clamp01(1 - Math.hypot(x + 0.5 - TREAS_LAMP[0], (y + 0.5 - TREAS_LAMP[1] + 2) * 0.85) / (34 + k * 9)) ** 1.3
  + 0.16 * clamp01(1 - Math.hypot((x + 0.5 - 30) * 0.6, y + 0.5 - 56) / 22); // reflexo do ouro

// Montoado de moedas: cada lasca de Voronoi achatada vira uma moeda com borda escura.
function coinTone(x, y, seed) {
  const r = rockCell(x + 0.5, (y + 0.5) * 1.6, 2.7, seed);
  if (r.edge < 0.42) return -0.36;
  return (r.id - 0.5) * 0.3 - (r.dx + r.dy) * 0.55 + (r.dy < -0.15 ? 0.1 : 0);
}

function buildTreasuryBackdrop(k) {
  const p = new Pix(64, 64);
  const wall = archTest(32, 30, 4, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const L = treasLight(x, y, k);
      let v;
      if (wall(x + 0.5, y + 0.5)) {
        v = 0.14 + L + masonry(x, y, 8, 5, 141, 4) * 0.9 + (hash(x, y, 142) < 0.04 ? -0.06 : 0);
        if (!wall(x + 0.5, y - 1.5)) v += 0.1;
      }
      else {
        // abóbada de berço: fiadas acompanhando o arco e juntas em leque
        const dx = x + 0.5 - 32, dy = y + 0.5 - 34;
        const r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        const ring = Math.floor((r - 30) / 3.2);
        const u = ang * (9 + ring * 2) / Math.PI + (ring & 1) * 0.5;
        const joint = (r - 30) % 3.2 > 2.5 || Math.abs(u - Math.round(u)) < 0.07 * (4 + ring) / 4;
        v = 0.16 + L * 0.9 + (hash(Math.round(u), ring, 143) - 0.5) * 0.14 - (joint ? 0.16 : 0) - ring * 0.04;
        if ((r - 30) % 3.2 < 0.9) v += 0.08; // aresta de cada fiada
        if (ring === 0) v += 0.1; // aduelas na borda do arco
      }
      p.d[y * 64 + x] = pick(VAULT, v, x, y, 2);
    }
  }
  // corrente e lamparina de bronze pendurada no alto
  const [lx, ly] = TREAS_LAMP;
  for (let y = 0; y < ly - 1; y++) p.set(lx - 0.5 + ((y & 1) ? 1 : 0), y, PAL.iron[(y & 1) ? 1 : 3]);
  p.fill(lx - 4, ly, lx + 4, ly + 4, (x, y) => ((x - lx) / 4) ** 2 + ((y - ly) / 3.6) ** 2 <= 1, (x, y) =>
    pick(BRONZE, 0.3 + cylLight((x + 0.5 - lx) / 4) * 0.6 + (y === ly ? 0.3 : 0) + k * 0.1, x, y));
  p.set(lx - 0.5, ly + 4, BRONZE[2]);
  // piso de lajes
  for (let y = 56; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const joint = y === 56 || y === 59 || ((x + (y > 58 ? 5 : 0)) % 11 === 0);
      p.set(x, y, pick(VAULT, 0.2 + treasLight(x, y, k) - (joint ? 0.12 : 0) + (hash(x >> 3, y >> 2, 144) - 0.5) * 0.08, x, y));
    }
  }
  return p;
}

// Baú aberto: caixa de tábuas com cintas de ferro, tampa forrada de veludo e moedas por cima.
function paintChest(p, x0, y0, w, h, lidH, seed, k) {
  const x1 = x0 + w - 1, y1 = y0 + h - 1;
  // tampa aberta para trás, vista por dentro
  p.poly([[x0 + 1, y0 + 0.5], [x0 + 2.5, y0 - lidH], [x1 - 1.5, y0 - lidH], [x1, y0 + 0.5]], (x, y) => {
    const edge = x <= x0 + 2 + (y0 - y) * 0.1 || x >= x1 - 1 - (y0 - y) * 0.1 || y <= y0 - lidH + 0.5;
    if (edge) return pick(PAL.wood, 0.4 + (x < x0 + 3 ? 0.2 : 0) + treasLight(x, y, k) * 0.6, x, y);
    return pick(LINING, 0.35 + treasLight(x, y, k) * 0.8 - (y0 - y) * 0.02 + ((x + y) % 4 === 0 ? -0.08 : 0), x, y);
  });
  for (let x = x0 + 3; x <= x1 - 2; x += 3) p.set(x, y0 - lidH + 1, PAL.gold[3]); // tachas
  // moedas acima da borda
  p.fill(x0 + 1, y0 - 6, x1 - 1, y0, (x, y) => y >= y0 - 1.5 - 4.5 * Math.sin(Math.PI * clamp01((x - x0 - 0.5) / (w - 1))) ** 0.7, (x, y) =>
    pick(PAL.gold, 0.5 + coinTone(x, y, seed) + treasLight(x, y, k) * 0.6, x, y));
  // caixa
  p.fill(x0, y0, x1, y1, () => true, (x, y) => {
    const band = x === x0 + 2 || x === x1 - 2;
    if (band || y === y0 || y === y1) return PAL.iron[band ? (x < x0 + w / 2 ? 3 : 2) : y === y0 ? 3 : 1];
    const plank = (y - y0) % 4 === 0;
    return pick(PAL.wood, 0.5 + treasLight(x, y, k) * 0.7 - (x - x0) * 0.012 + (hash(x >> 2, (y - y0) >> 2, seed) - 0.5) * 0.14 - (plank ? 0.22 : 0) + (x === x0 ? 0.15 : 0), x, y);
  });
  // fechadura dourada
  const cx = Math.floor(x0 + w / 2) - 1;
  p.rect(cx, y0 + 1, 3, 4, (x, y) => PAL.gold[x === cx ? 5 : x === cx + 1 ? 4 : 2]);
  p.set(cx + 1, y0 + 3, PAL.out);
}

function buildTreasury(k = 0.5) {
  const p = new Pix(64, 64);
  // porta redonda de ferro na parede do fundo, com moldura de pedra
  const [dx0, dy0, dr] = TREAS_DOOR;
  p.fill(dx0 - dr - 3, dy0 - dr - 3, dx0 + dr + 3, dy0 + dr + 3, (x, y) => Math.hypot(x - dx0, y - dy0) <= dr + 2.6, (x, y) => {
    const ox = x + 0.5 - dx0, oy = y + 0.5 - dy0, r = Math.hypot(ox, oy);
    if (r > dr + 0.4) {
      const u = (Math.atan2(oy, ox) / Math.PI) * 9;
      return pick(PAL.stone, 0.35 - (ox + oy) / dr * 0.18 + treasLight(x, y, k) * 0.5 - (Math.abs(u - Math.round(u)) < 0.12 ? 0.18 : 0), x, y);
    }
    let v = 0.26 + sphereLight(ox / dr * 0.55, oy / dr * 0.55) * 0.45 + treasLight(x, y, k) * 0.5;
    if (r > dr - 1.4) v += (ox + oy < 0 ? 0.22 : -0.12); // borda chanfrada
    else if (Math.abs(r - 9.6) < 0.55) v -= 0.2; // sulco
    else if (Math.abs(r - 10.5) < 0.5) v += (ox + oy > 0 ? 0.14 : -0.04);
    return pick(DOOR_IRON, v, x, y);
  });
  // rebites em volta
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = Math.floor(dx0 + Math.cos(a) * 11.1), y = Math.floor(dy0 + Math.sin(a) * 11.1);
    p.set(x, y, DOOR_IRON[6]);
    p.set(x + 1, y + 1, DOOR_IRON[1]);
  }
  // dobradiças grossas à esquerda
  for (const hy of [19, 32]) {
    p.rect(31, hy, 7, 3, (x, y) => pick(DOOR_IRON, (y === hy ? 0.7 : 0.4) - (x - 31) * 0.03, x, y));
    p.rect(30, hy - 1, 2, 5, (x, y) => DOOR_IRON[x === 30 ? 5 : 3]);
  }
  // segredo de girar (as marcas são pintadas a cada quadro) e o puxador em barra
  p.fill(dx0 - 6, dy0 - 8, dx0 + 6, dy0 + 2, (x, y) => Math.hypot(x - dx0, y - (dy0 - 3)) <= 4.8, (x, y) => {
    const ox = x + 0.5 - dx0, oy = y + 0.5 - (dy0 - 3), r = Math.hypot(ox, oy);
    if (r > 3.9) return pick(PAL.gold, 0.45 - (ox + oy) / 5 * 0.4, x, y);
    return pick(DOOR_IRON, 0.2 + sphereLight(ox / 4, oy / 4) * 0.4, x, y);
  });
  p.sphere(dx0, dy0 - 3, 1.5, 1.5, PAL.gold, 0.1);
  for (const px of [dx0 - 5, dx0 + 4]) p.rect(Math.floor(px), dy0 + 4, 2, 3, (x, y) => DOOR_IRON[y === dy0 + 4 ? 6 : 3]);
  p.rect(Math.floor(dx0 - 7), dy0 + 6, 15, 2, (x, y) => PAL.gold[y === dy0 + 6 ? (x < dx0 ? 5 : 4) : (x < dx0 ? 3 : 2)]);
  p.sphere(dx0 - 7.5, dy0 + 7, 1.6, 1.6, PAL.gold, 0.1);
  p.sphere(dx0 + 7.5, dy0 + 7, 1.6, 1.6, PAL.gold, -0.05);
  // trincos que correm para dentro da parede
  for (const by of [dy0 - 7, dy0 + 2]) p.rect(Math.floor(dx0 + 10), by, 4, 2, (x, y) => DOOR_IRON[y === by ? 6 : 2]);

  // baús abertos
  paintChest(p, 2, 44, 21, 12, 11, 145, k);
  paintChest(p, 43, 48, 18, 10, 9, 146, k);
  // colar de pérolas largado em cima das moedas do baú
  for (let i = 0; i <= 9; i++) {
    const x = 6 + i, y = Math.round(39.4 + Math.sin((i / 9) * Math.PI) * 1.6 + (i > 6 ? (i - 6) * 0.6 : 0));
    p.set(x, y, PEARL[(i & 1) ? 2 : 3]);
  }
  // monte de moedas na frente, com gemas no meio
  p.fill(0, 40, 63, 63, (x, y) => y >= heapTop(x), (x, y) => {
    let v = 0.45 + coinTone(x, y, 147) + treasLight(x, y, k) * 0.7 - Math.max(0, y - 58) * 0.03;
    if (y + 0.5 < heapTop(x + 0.5) + 1) v += 0.2;
    return pick(PAL.gold, v, x, y);
  });
  for (const [x, y, r] of [[8, 60, RUBY], [22, 52, EMERALD], [37, 55, SAPPHIRE], [44, 61, AMETHYST], [16, 58, SAPPHIRE], [28, 60, RUBY], [56, 56, EMERALD]]) {
    if (y >= heapTop(x) + 1) { p.set(x, y, r[3]); p.set(x + 1, y, r[2]); p.set(x, y + 1, r[2]); p.set(x + 1, y + 1, r[1]); }
  }
  // cálice de ouro no alto do monte
  const gx = 31;
  p.fill(gx - 5, 37, gx + 5, 42, (x, y) => ((x - gx) / 4.8) ** 2 + ((y - 37) / 5.2) ** 2 <= 1, (x, y) =>
    pick(PAL.gold, 0.15 + cylLight((x + 0.5 - gx) / 4.8) * 0.85 + (y === 37 ? 0.2 : 0), x, y));
  p.rect(gx - 4, 37, 8, 1, (x) => PAL.gold[x < gx ? 2 : 1]);
  p.rect(gx - 1, 42, 2, 4, (x) => PAL.gold[x < gx ? 4 : 2]);
  p.fill(gx - 3, 45, gx + 3, 48, (x, y) => Math.abs(x - gx) <= 1.5 + (y - 45) * 0.8, (x, y) => pick(PAL.gold, 0.25 + cylLight((x + 0.5 - gx) / 3.4) * 0.75, x, y));
  p.set(gx - 2, 39, RUBY[3]);
  p.set(gx + 1, 39, SAPPHIRE[3]);
  // lingotes empilhados à direita
  for (const [bx, by] of [[50, 60], [56, 60], [53, 57]]) {
    p.rect(bx, by, 6, 3, (x, y) => PAL.gold[y === by ? (x < bx + 3 ? 5 : 4) : x === bx ? 3 : 2]);
    p.set(bx + 5, by + 2, PAL.gold[1]);
  }

  p.outline(PAL.out);
  return p;
}

const treasArt = { base: null, body: null, frame: new Pix(64, 64), coin: new Pix(5, 5) };

function paintTreasuryPortrait(ctx, t, info) {
  const a = treasArt;
  if (!a.base) {
    a.body = buildTreasury(0);
    a.base = buildTreasuryBackdrop(0).blit(a.body, 0, 0);
    const lit = buildTreasuryBackdrop(1).blit(buildTreasury(1), 0, 0);
    a.lamp = makeHalo(a.base, lit, (x, y) => Math.hypot(x + 0.5 - TREAS_LAMP[0], (y + 0.5 - TREAS_LAMP[1]) * 0.85) / 44);
    // pontos claros das moedas, onde nascem as estrelinhas
    a.shiny = [];
    for (let y = 30; y < 64; y++) for (let x = 0; x < 64; x++) if (a.base.get(x, y) === PAL.gold[5] || a.base.get(x, y) === PAL.gold[4]) a.shiny.push([x, y]);
    a.gold = rampPixels(a.base, PAL.gold, 24, 12, 60, 50);
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.base);
  const flick = Math.sin(t * 8.7) * 0.5 + Math.sin(t * 13.9 + 1) * 0.3 + Math.sin(t * 3.1) * 0.2;
  paintHalo(f, a.lamp, 0.5 + flick * 0.07);
  paintFlame(f, TREAS_LAMP[0] - 0.5, TREAS_LAMP[1], t, 3.6 + live, 1.6, live);
  // brilho passando pela roda da porta e pelo cálice
  const period = info.working ? 3.2 : 5.5;
  sweepGlint(f, a.gold, PAL.gold, ((t % period) / 1.6) * 60 + 20, 1.6);
  // o segredo girando para um lado e para o outro
  const [dx0, dy0] = TREAS_DOOR;
  const turn = info.working ? Math.sin(t * 1.3) * 2.6 + Math.sin(t * 0.47) * 1.2 : Math.sin(t * 0.3) * 0.4;
  for (let i = 0; i < 10; i++) {
    const ang = turn + (i / 10) * Math.PI * 2;
    f.set(dx0 - 0.5 + Math.cos(ang) * 3.2, dy0 - 3.5 + Math.sin(ang) * 3.2, i === 0 ? WHITE : PAL.gold[i % 5 === 0 ? 4 : 2]);
  }
  // estrelinhas pulando de moeda em moeda
  const n = info.working ? 7 : 4;
  for (let k = 0; k < n; k++) {
    const per = 1.3 + hash(k, 1, 148) * 0.9, off = hash(k, 2, 148) * per;
    const cyc = Math.floor((t + off) / per);
    const [x, y] = a.shiny[Math.floor(hash(k, cyc, 149) * a.shiny.length)];
    sparkle(f, x, y, pulse(t, per, off, per * 0.55), k % 3 === 0);
  }
  // moeda caindo no monte, girando
  if (info.working) {
    const u = (t % 2.2) / 2.2;
    if (u < 0.55) {
      const s = u / 0.55;
      const x = 37 + Math.sin(t * 0.7) * 4, y = -3 + s * s * (heapTop(x) - 1);
      const w = Math.abs(Math.cos(t * 9));
      const c = a.coin.clear();
      c.fill(0, 0, 4, 4, (px, py) => ((px - 2.5) / Math.max(0.5, w * 2.4)) ** 2 + ((py - 2.5) / 2.4) ** 2 <= 1, (px, py) => PAL.gold[px + py < 5 ? 5 : px + py < 6 ? 4 : 2]);
      c.outline(PAL.out);
      f.blit(c, x - 2, y - 2);
    }
    else {
      const x = 37 + Math.sin(t * 0.7) * 4;
      sparkle(f, x, heapTop(x) - 1, pulse(u, 1, -0.55, 0.25));
    }
  }
  f.draw(ctx);
}

function iconTreasury() {
  const p = new Pix(16, 16);
  // baú aberto transbordando de moedas
  p.poly([[2, 7.5], [3.5, 2], [12.5, 2], [14, 7.5]], (x, y) => (x <= 3 || x >= 12 || y <= 2 ? PAL.wood[x < 8 ? 4 : 2] : LINING[y < 5 ? 3 : 2]));
  p.fill(2, 3, 13, 8, (x, y) => y >= 8.5 - 4 * Math.sin(Math.PI * clamp01((x - 1.5) / 12)) ** 0.7, (x, y) => PAL.gold[(x + y * 2) % 5 === 0 ? 2 : x + y < 12 ? 5 : 4]);
  p.rect(1, 8, 14, 7, (x, y) => (x === 3 || x === 12 ? PAL.iron[3] : y === 8 ? PAL.wood[4] : PAL.wood[(y - 8) % 3 === 0 ? 1 : x < 8 ? 3 : 2]));
  p.rect(7, 9, 2, 3, (x) => PAL.gold[x === 7 ? 5 : 3]);
  p.set(5, 5, RUBY[3]);
  p.set(10, 4, SAPPHIRE[3]);
  p.set(8, 6, WHITE);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Registro

ART.portraits.mountainhall = paintHallPortrait;
ART.portraits.gemcutter = paintGemPortrait;
ART.portraits.treasury = paintTreasuryPortrait;
ART.portraits.banker = paintBankPortrait;
ART.portraits.mountainheart = paintHeartPortrait;
ART.locked.mountainhall = ART.silhouette(buildHallLocked);
ART.locked.gemcutter = ART.silhouette(buildCutter);
ART.locked.treasury = ART.silhouette(() => buildTreasury());
ART.locked.banker = ART.silhouette(buildBanker);
ART.locked.mountainheart = ART.silhouette(() => buildHeart());
Object.assign(ART.icons, { mountainhall: iconHall, gemcutter: iconCutter, treasury: iconTreasury, banker: iconBanker, mountainheart: iconHeart });
})();
