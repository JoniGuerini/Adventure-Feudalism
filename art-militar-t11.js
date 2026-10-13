'use strict';
// Linha MILITAR, tiers 11 a 15: Marechal, Armada, Legião, Conquistador e Lenda.
// Retratos animados com luz de entardecer, silhuetas bloqueadas e ícones.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

const CANVAS = ramp('#24150f', '#3d2618', '#5a3a22', '#7a522e', '#9a6c3c', '#b8884e', '#d4a666');
const GRIZZLE = ramp('#2c2829', '#4a4546', '#6e6866', '#958e88', '#bdb6ac', '#e2dcd0');
const SASH = ramp('#3e0f14', '#6e1a20', '#a32a2c', '#cf4438', '#ec7258');
const BATON = ramp('#0c1230', '#18245a', '#283a84', '#3e58aa', '#6a86cc');
const PURPLE_HILLS = ramp('#2e2244', '#3e2e56', '#523c68', '#684c78');
const DUSK_SMOKE = ramp('#3a3040', '#5a4a5a', '#7a6a76', '#a08e96', '#c4b4b4');
const RUBY = ramp('#3a0610', '#7a0c1c', '#c01a2a', '#f04a4a', '#ffb4a8');
const EYE_STEEL = C('#34465c'), EYE_STEEL_HI = C('#7e94aa');
const WHITE = C('#ffffff');
const OUT_RAMP = [PAL.out];

// ---------------------------------------------------------------------------
// Peças comuns

// Cabeça em elipse que afina no queixo.
const headTest = (hx, hy, rx, ry, taper = 0.3) => (x, y) => {
  const dy = (y - hy) / ry;
  const w = dy > 0 ? rx * (1 - taper * dy * dy) : rx;
  return ((x - hx) / w) ** 2 + dy * dy <= 1;
};

function paintBitmap(p, rows, x0, y0, color) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== '.') p.set(x0 + i, y0 + j, color(i, j, ch));
  }));
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

// Pixels de uma rampa (ouro, aço) dentro de um retângulo: o brilho corre por eles.
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

// Estandarte: guarda rampa e valor de cada pixel; a cada quadro as linhas balançam
// com o vento e dobras de luz e sombra correm pelo pano.
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

// Luz que pulsa: compara o fundo apagado com o aceso e guarda, para cada pixel que
// muda, um limiar. A cada quadro acendem os pixels com limiar abaixo do nível pedido.
function makeHalo(base, lit, threshold) {
  const idx = [], th = [], col = [];
  for (let i = 0; i < base.d.length; i++) {
    if (base.d[i] === lit.d[i]) continue;
    const x = i % base.w, y = Math.floor(i / base.w);
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

// Linha grossa entre dois pontos: c(x, y, u, w) recebe a posição ao longo (u, 0..1)
// e o desvio para o lado (w, em pixels).
function strip(p, x0, y0, x1, y1, half, c) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  p.fill(Math.min(x0, x1) - half - 1, Math.min(y0, y1) - half - 1, Math.max(x0, x1) + half + 1, Math.max(y0, y1) + half + 1, (x, y) => {
    const a = (x - x0) * ux + (y - y0) * uy, b = (x - x0) * -uy + (y - y0) * ux;
    return a >= 0 && a <= len && Math.abs(b) <= half;
  }, (x, y) => {
    const a = (x + 0.5 - x0) * ux + (y + 0.5 - y0) * uy, b = (x + 0.5 - x0) * -uy + (y + 0.5 - y0) * ux;
    return c(x, y, a / len, b);
  });
}

// Sol baixo: disco claro e um halo curto e pontilhado (mais contido que o paintSun).
function sunDisc(p, sx, sy, r, reach = 1.7, density = 0.5) {
  const R = r * reach;
  for (let y = Math.floor(sy - R); y <= sy + R; y++) {
    for (let x = Math.floor(sx - R); x <= sx + R; x++) {
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d <= r) p.set(x, y, d < r - 1.2 ? PAL.sunCore : PAL.sunRim);
      else if (d < R && bayer(x, y) < (1 - (d - r) / (R - r)) * density) p.set(x, y, PAL.haze);
    }
  }
}

// ---------------------------------------------------------------------------
// Marechal

const MAR_HEAD = headTest(32, 31, 10.2, 12, 0.28);
const MAR_LAMP = [41, 11]; // centro do vidro da lanterna
const MAR_FIRE = [8, 44]; // fogueira do acampamento, vista pela porta
const inDoor = (x, y) => y > 9 && y < 54 && Math.abs(x - 7.5) <= (y - 9) * 0.28;
const MAR_STACHE = [
  '........xxxxxxxxxx........',
  '.....xxxxxxxxxxxxxxxx.....',
  'x...xxxxxxxxxxxxxxxxxx...x',
  'xx.xxxxxxxxxxxxxxxxxxxx.xx',
  '.xxxxxxxxx......xxxxxxxxx.',
  '..xxxxx............xxxxx..',
];

function buildMarshalBackdrop(glow) {
  const p = new Pix(64, 64);
  const [lx, ly] = MAR_LAMP;
  const lamp = (x, y) => (0.3 + glow * 0.18) * clamp01(1 - Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 0.9) / (30 + glow * 8)) ** 1.4;
  const dusk = (x, y) => 0.2 * clamp01(1 - Math.hypot(x - 6, y - 32) / 26);
  // lona da tenda em painéis costurados, cada um estufado no meio
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const col = (x + 2) % 11, pan = Math.floor((x + 2) / 11);
      let v = 0.22 + Math.sin(((col + 0.5) / 11) * Math.PI) * 0.1 + lamp(x, y) + dusk(x, y) - y * 0.003;
      v += (hash(pan, y >> 2, 5) - 0.5) * 0.04;
      if (col === 0) v -= y % 3 === 1 ? 0.06 : 0.14; // costura
      else if (col === 1) v += 0.04;
      if ((x + y * 2) % 5 === 0) v -= 0.03; // trama
      p.d[y * 64 + x] = pick(CANVAS, v, x, y, 2);
    }
  }
  // porta da tenda aberta: céu do entardecer, sol se pondo e o acampamento
  const [fx, fy] = MAR_FIRE;
  p.fill(0, 8, 24, 54, inDoor, (x, y) => {
    const hill = 35 + Math.round(Math.sin(x * 0.6 + 1) * 0.9);
    const sun = Math.hypot(x + 0.5 - 5, y + 0.5 - 35.5);
    if (y < hill) {
      if (sun < 3.4) return sun < 2.2 ? PAL.sunCore : PAL.sunRim;
      if (sun < 8 && bayer(x, y) < (1 - (sun - 3.4) / 4.6) * 0.7) return PAL.haze;
      return pick(PAL.dusk, 0.3 + ((y - 9) / 26) * 0.7, x, y, 2.4);
    }
    if (y < hill + 2) return pick(PURPLE_HILLS, y === hill ? 0.9 : 0.55, x, y);
    const fire = clamp01(1 - Math.hypot(x + 0.5 - fx, (y + 0.5 - fy) * 1.4) / 7);
    return pick(PAL.dirt, 0.08 + (y - hill) * 0.015 + (hash(x, y, 3) - 0.5) * 0.1 + fire * 0.55, x, y);
  });
  // barracas ao longe, contra o sol
  for (const [tx, ty, w] of [[2, 38, 3], [13, 39, 4]]) {
    for (let k = 0; k <= w; k++) {
      for (let x = tx - k; x <= tx + k; x++) {
        if (!inDoor(x + 0.5, ty + k + 0.5)) continue;
        p.set(x, ty + k, x === tx + k ? PAL.fire[1] : x < tx ? DUSK_SMOKE[1] : DUSK_SMOKE[0]);
      }
    }
    if (inDoor(tx + 0.5, ty - 0.5)) p.set(tx, ty - 1, PAL.wood[1]);
  }
  // aba dobrada para trás, presa por um cordão
  p.fill(0, 8, 28, 54, (x, y) => !inDoor(x, y) && inDoor(x - 3, y) && x > 7, (x, y) => {
    const inner = inDoor(x - 1, y);
    const crease = Math.sin((y - x * 0.5) * 0.8);
    return pick(CANVAS, (inner ? 0.62 : 0.4) + crease * 0.12 + dusk(x, y) - y * 0.004, x, y);
  });
  for (const [x, y, c] of [[14, 30, PAL.leather[1]], [15, 30, PAL.leather[3]], [16, 30, PAL.leather[3]], [17, 30, PAL.leather[2]], [14, 31, PAL.leather[2]], [16, 31, PAL.gold[3]], [16, 32, PAL.gold[2]], [17, 33, PAL.gold[3]], [17, 34, PAL.gold[1]]]) p.set(x, y, c);
  // sanefa de lona vermelha com franja dourada no alto
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 64; x++) {
      const sc = (x + 1) % 7, scx = x + 1 - sc + 3.5;
      const lip = 4.5 + Math.sqrt(Math.max(0, 9 - (x + 0.5 - scx + 1) ** 2)) * 0.8;
      if (y === 0) { p.set(x, y, PAL.wood[x % 5 === 0 ? 1 : 2]); continue; }
      if (y > lip + 0.6) continue;
      const edge = y > lip - 0.6;
      p.set(x, y, edge ? PAL.gold[x % 2 ? 3 : 2] : pick(SASH, 0.55 - y * 0.05 + (sc === 0 ? -0.2 : 0) + lamp(x, y) * 0.6, x, y));
    }
  }
  for (let x = 0; x < 64; x++) p.set(x, 2, PAL.gold[x % 3 === 0 ? 4 : 2]);
  // vara do estandarte
  p.rect(46, 8, 16, 1, PAL.wood[3]);
  p.rect(46, 9, 16, 1, PAL.wood[1]);
  p.sphere(46, 8.5, 1.4, 1.4, PAL.gold, 0.1);
  p.rect(62, 0, 2, 64, (x, y) => pick(PAL.wood, (x === 62 ? 0.6 : 0.3) + lamp(x, y) * 0.5, x, y));
  // lanterna pendurada: corrente, tampa, vidro aceso e base
  for (let y = 3; y < ly - 4; y++) p.set(lx, y, PAL.iron[y % 2 ? 3 : 1]);
  p.rect(lx - 1, ly - 5, 3, 1, PAL.iron[3]);
  p.rect(lx - 2, ly - 4, 5, 1, (x) => PAL.iron[x < lx ? 3 : 2]);
  p.rect(lx - 2, ly - 3, 5, 6, (x, y) => {
    if (x === lx - 2 || x === lx + 2) return PAL.iron[x < lx ? 2 : 1];
    return pick(PAL.fire, 0.95 - Math.hypot(x - lx, (y - ly - 1) * 0.6) * 0.22, x, y);
  });
  p.rect(lx - 3, ly + 3, 7, 1, (x) => PAL.iron[x < lx ? 3 : 2]);
  p.rect(lx - 2, ly + 4, 5, 1, PAL.iron[1]);
  p.set(lx, ly + 5, PAL.iron[1]);
  return p;
}

function buildMarshalBanner() {
  const w = 13, h = 30;
  return makeBanner(w, h, (put) => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const tip = j - (h - 6);
        if (tip > 0 && Math.abs(i - 6) < tip) continue; // rabo de andorinha
        const edge = i === 0 || i === w - 1 || j === h - 1 || (tip > 0 && Math.abs(i - 6) <= tip);
        if (edge) { put(i, j, OUT_RAMP, 0); continue; }
        const trim = i === 1 || i === w - 2 || j === 1 || (tip > -1 && Math.abs(i - 6) <= tip + 1);
        if (trim) put(i, j, PAL.gold, 0.62);
        else put(i, j, PAL.banner, 0.62 - (i - 6) * 0.03 - j * 0.006);
      }
    }
    // estrela de oito pontas do brasão
    const star = ['....x....', '.x..x..x.', '..xxxxx..', '..xxxxx..', 'xxxx.xxxx', '..xxxxx..', '..xxxxx..', '.x..x..x.', '....x....'];
    star.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === 'x') put(2 + i, 8 + j, PAL.gold, 0.88 - j * 0.04 - i * 0.03);
    }));
    put(6, 12, PAL.banner, 0.1);
  });
}

function buildMarshalBaton() {
  const p = new Pix(64, 64);
  // antebraço de aço subindo da borda até o punho
  strip(p, 56, 67, 46.5, 59.5, 3.6, (x, y, u, w) => {
    let v = 0.35 + (-w / 3.6) * 0.32;
    if (Math.abs(u - 0.45) < 0.05 || Math.abs(u - 0.75) < 0.05) v -= 0.25; // lâminas
    return pick(PAL.steel, v, x, y);
  });
  // bastão de comando: veludo azul com estrelas de ouro e ponteiras
  const bx0 = 42.5, by0 = 65, bx1 = 55.5, by1 = 34;
  strip(p, bx0, by0, bx1, by1, 1.6, (x, y, u, w) => {
    if (u < 0.08 || u > 0.9) return PAL.gold[w < -0.5 ? 5 : w < 0.5 ? 4 : 2];
    if (Math.abs(u - 0.9) < 0.025 || Math.abs(u - 0.08) < 0.025) return PAL.gold[1];
    if ((Math.floor(u * 40) % 5 === 2) && Math.abs(w) < 0.8) return PAL.gold[w < 0 ? 5 : 3];
    return pick(BATON, 0.55 - w * 0.25, x, y);
  });
  p.sphere(55.6, 33.6, 1.8, 1.8, PAL.gold, 0.15);
  // manopla fechada em volta do bastão: costas da mão, dedos em lâminas e rebite
  p.fill(41, 53, 50, 61, (x, y) => ((x + 0.5 - 45.6) / 4.2) ** 2 + ((y + 0.5 - 57.4) / 3.8) ** 2 <= 1, (x, y) => {
    let v = 0.12 + sphereLight((x + 0.5 - 45.6) / 4.2, (y + 0.5 - 57.4) / 3.8) * 0.72;
    if (y === 56 || y === 58) v -= 0.32; // juntas dos dedos
    if (x <= 42 && y >= 55) v -= 0.12; // polegar por baixo
    return pick(PAL.steel, v, x, y);
  });
  p.set(45, 54, PAL.steel[5]);
  p.set(47, 55, PAL.gold[4]);
  p.outline(PAL.out);
  return p;
}

// Aço polido: tons médios e escuros, com um reflexo estreito e claro.
const steelV = (l, spec) => 0.1 + l * 0.48 + spec * 0.4;
const specBand = (n, at = -0.42, w = 0.17) => clamp01(1 - Math.abs(n - at) / w);

function buildMarshal() {
  const p = new Pix(64, 64);
  const cx = 32;
  // peitoral de aço com nervura no meio
  p.poly([[12, 64], [15, 53], [21, 48.5], [43, 48.5], [49, 53], [52, 64]], (x, y) => {
    const nx = (x + 0.5 - cx) / 19;
    let v = steelV(cylLight(nx), specBand(nx)) - (y - 50) * 0.006;
    if (x === 31) v += 0.2;
    else if (x === 32) v -= 0.14;
    if (nx > 0.8) v += 0.1; // reflexo quente da lanterna
    return nx > 0.86 && y < 58 ? pick(CANVAS, 0.45 + (y % 2) * 0.1, x, y) : pick(PAL.steel, v, x, y);
  });
  // faixas gravadas a ouro descendo pelo peito
  for (const bx of [25, 39]) {
    for (let y = 51; y < 64; y++) {
      for (let x = bx - 1; x <= bx + 1; x++) {
        if (x !== bx) { p.set(x, y, PAL.gold[x < bx ? 3 : 1]); continue; }
        const vine = (y + (bx > cx ? 2 : 0)) % 4;
        p.set(x, y, vine === 0 ? PAL.gold[4] : vine === 2 ? PAL.gold[2] : PAL.steel[0]);
      }
    }
  }
  // ombreiras: copa abaulada e duas lâminas por baixo
  for (const s of [-1, 1]) {
    const pc = cx + s * 21.5;
    const edge = (k, x) => 54 + k * 4.4 + 2 * (1 - clamp01(((x - pc) / 13) ** 2));
    for (let k = 2; k >= 1; k--) {
      const half = 12 + k * 0.8;
      p.fill(pc - half - 1, 48, pc + half + 1, 64, (x, y) => Math.abs(x - pc) <= half && y > edge(k - 1, x) - 1.5 && y <= edge(k, x), (x, y) => {
        const u = (x + 0.5 - pc) / half;
        const d = edge(k, x + 0.5) - (y + 0.5);
        let v = steelV(cylLight(u), specBand(u, -0.45, 0.2)) - k * 0.05;
        if (y + 0.5 - edge(k - 1, x + 0.5) < 1.4) v -= 0.3; // sombra da lâmina de cima
        if (d < 1) return PAL.gold[u < -0.3 ? 3 : u < 0.4 ? 2 : 1];
        if (u > 0.82) v += 0.08;
        return pick(PAL.steel, v, x, y);
      });
    }
    const inCop = (x, y) => Math.abs(x - pc) <= 12 && y <= edge(0, x) && (((x - pc) / 12) ** 2 + ((y - 53) / 9.5) ** 2 <= 1 || y > 53);
    p.fill(pc - 13, 42, pc + 13, 60, inCop, (x, y) => {
      const u = (x + 0.5 - pc) / 12, w = (y + 0.5 - 50) / 9;
      const d = edge(0, x + 0.5) - (y + 0.5);
      if (d < 1.1) return PAL.gold[u < -0.3 ? 4 : u < 0.4 ? 3 : 2];
      // arabesco gravado acompanhando a borda da copa
      const ring = Math.hypot(u, (y + 0.5 - 53) / 9.5 * 1.02);
      if (ring > 0.74 && ring < 0.86 && y < 52 && (x + y) % 2 === 0) return PAL.gold[u < 0 ? 4 : 2];
      const spec = clamp01(1 - Math.hypot(u + 0.38, w + 0.35) / 0.28);
      return pick(PAL.steel, steelV(sphereLight(u * 0.95, w), spec) + (u > 0.8 ? 0.08 : 0), x, y);
    });
    for (const dx of [-8, 0, 8]) p.set(pc + dx, Math.round(edge(0, pc + dx)) - 2, PAL.gold[dx < 0 ? 5 : 3]);
  }
  // faixa vermelha atravessando o peito, do ombro ao quadril
  strip(p, 15, 47, 52, 70, 3.1, (x, y, u, w) => {
    if (Math.abs(w) > 2.4) return PAL.gold[w < 0 ? 4 : 2];
    let v = 0.5 - w * 0.1 - u * 0.2 + Math.sin(u * 30) * 0.1; // dobras do cetim
    if (w < -1.3) v += 0.18;
    else if (w > 1.4) v -= 0.14;
    return pick(SASH, v, x, y);
  });
  // condecoração: estrela de ouro com rubi
  paintBitmap(p, ['..x..', '.xxx.', 'xxxxx', '.xxx.', 'x.x.x'], 37, 50, (i, j) => PAL.gold[i + j < 3 ? 5 : i + j < 6 ? 4 : 2]);
  p.set(39, 52, RUBY[3]);
  // gorjal: duas lâminas em volta do pescoço
  p.fill(22, 42, 42, 50, (x, y) => y > 43.5 && y < 50 && Math.abs(x - cx) <= 8 + (y - 44) * 0.55, (x, y) => {
    const nx = (x + 0.5 - cx) / 11;
    if (y === 44 || y === 47) return PAL.gold[nx < -0.3 ? 4 : nx < 0.3 ? 3 : 2];
    let v = steelV(cylLight(nx), specBand(nx, -0.4, 0.22));
    if (y === 46 || y === 49) v -= 0.22;
    return pick(PAL.steel, v, x, y);
  });

  // orelhas
  p.sphere(21.8, 31.5, 2.1, 3.1, PAL.skin, 0);
  p.sphere(42.2, 31.5, 2.1, 3.1, PAL.skin, -0.2);
  p.set(21, 32, PAL.skin[1]);
  p.set(42, 32, PAL.skin[1]);
  // rosto curtido
  p.fill(20, 18, 44, 44, MAR_HEAD, (x, y) => {
    const v = 0.34 + sphereLight((x + 0.5 - 31) / 10.2, (y + 0.5 - 30) / 12) * 0.76;
    return pick(PAL.skin, v, x, y, 4);
  });
  // cabelo grisalho bem curto, com entradas fundas
  const hairLine = (x) => (Math.abs(x - cx) > 6.5 ? 20.2 : 21 + 0.9 * Math.exp(-(((x - cx) / 2.6) ** 2)));
  const volume = (x, y) => ((x - 31.5) / 11.3) ** 2 + ((y - 25) / 9.4) ** 2 <= 1 && y > 15.6 + hash(Math.floor(x / 2), 0, 12) * 0.8;
  const inHair = (x, y) => (volume(x, y) && y < hairLine(x)) || (MAR_HEAD(x, y) && Math.abs(x - cx) > 8.7 && y < 30.5) ||
    (volume(x, y) && Math.abs(x - cx) > 9.4 && y < 27);
  p.fill(18, 14, 46, 34, inHair, (x, y) => {
    // mechas penteadas para trás, abrindo para os lados
    const s = (x + 0.5 - cx) * (1 + (y - 16) * 0.06) + Math.sin(y * 0.7) * 0.6;
    const clump = Math.sin(s * 1.5) * 0.5 + (hash(Math.floor(s * 0.7 + 40), 1, 12) - 0.5) * 0.8;
    let v = 0.3 + sphereLight((x + 0.5 - 30) / 11.3, (y + 0.5 - 22) / 8) * 0.7 + clump * 0.2;
    if (y + 1 >= hairLine(x) && Math.abs(x - cx) < 8.7) v -= 0.15; // raiz mais escura
    return pick(GRIZZLE, v, x, y, 3);
  });
  // sobrancelhas grossas e grisalhas
  for (const [x, y, k] of [[24, 27, 3], [25, 26, 4], [26, 26, 4], [27, 26, 4], [28, 26, 3], [29, 27, 2], [25, 27, 2], [26, 27, 2], [27, 27, 2], [28, 27, 1]]) {
    p.set(x, y, GRIZZLE[k]);
    p.set(63 - x, y, GRIZZLE[Math.max(0, k - 1)]);
  }
  paintEyes(p, 28, 25, 38, GRIZZLE[0], EYE_STEEL, EYE_STEEL_HI, false);
  paintNose(p, 31, 31);
  // rugas: testa, pés de galinha e vincos do nariz
  for (const x of [27, 28, 29, 34, 35, 36]) p.set(x, 24, PAL.skin[2]);
  for (const x of [29, 30, 33, 34]) p.set(x, 23, PAL.skin[3]);
  for (const [x, y] of [[23, 28], [23, 30], [22, 29]]) { p.set(x, y, PAL.skin[2]); p.set(63 - x, y, PAL.skin[1]); }
  for (const [x, y] of [[27, 34], [26, 35]]) { p.set(x, y, PAL.skin[2]); p.set(63 - x, y, PAL.skin[1]); }
  // cicatriz antiga na face
  for (const [x, y] of [[37, 31], [38, 32], [38, 33], [39, 34]]) { p.set(x, y, PAL.skin[5]); p.set(x + 1, y, PAL.skin[1]); }
  // queixo com barba por fazer
  for (let y = 40; y <= 43; y++) for (let x = 25; x <= 39; x++) if (MAR_HEAD(x + 0.5, y + 0.5) && bayer(x, y) < 0.3) p.set(x, y, PAL.skin[2]);
  for (let x = 30; x <= 33; x++) p.set(x, 41, PAL.lip);
  p.set(30, 41, PAL.skin[1]);
  // bigodão grisalho de pontas viradas
  paintBitmap(p, MAR_STACHE, 19, 35, (i, j) => {
    const x = 19 + i, y = 35 + j;
    let v = 0.35 + sphereLight((x + 0.5 - 30) / 11, (y + 0.5 - 35) / 5) * 0.65 + ((x * 2 + y) % 3 === 0 ? -0.14 : 0);
    if (i < 3 || i > 22) v += 0.1;
    return pick(GRIZZLE, v, x, y, 2);
  });
  for (let x = 28; x <= 35; x++) p.set(x, 39, PAL.skin[0]);

  p.outline(PAL.out);
  p.blit(buildMarshalBaton(), 0, 0);
  return p;
}

const marshalArt = { bg: null, body: null, banner: null, halo: null, gold: null, frame: new Pix(64, 64) };

function paintMarshalPortrait(ctx, t, info) {
  const a = marshalArt;
  if (!a.bg) {
    a.bg = buildMarshalBackdrop(0);
    const [lx, ly] = MAR_LAMP;
    a.halo = makeHalo(a.bg, buildMarshalBackdrop(1), (x, y) => Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 0.9) / 38);
    a.body = buildMarshal();
    a.banner = buildMarshalBanner();
    a.gold = rampPixels(a.body, PAL.gold, 0, 30, 63, 63);
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  const [lx, ly] = MAR_LAMP;
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 14.7 + 1) * 0.3 + Math.sin(t * 3.3) * 0.2;
  paintHalo(f, a.halo, 0.42 + live * 0.12 + flick * 0.07 * live);
  paintFlame(f, lx, ly + 2, t, 3 + live * 0.8, 1.1, live);
  // fogueira e fumaça lá fora
  const [fx, fy] = MAR_FIRE;
  paintFlame(f, fx, fy, t * 1.3, 2.2 + live, 1, live);
  for (let k = 0; k < 4; k++) {
    const s = (t * 0.18 + k / 4) % 1;
    const x = fx + s * 5 + Math.sin(s * 5 + k) * 0.8, y = fy - 3 - s * 20;
    if (inDoor(x, y) && bayer(Math.floor(x), Math.floor(y)) < (1 - s) * 0.9) f.set(x, y, DUSK_SMOKE[s < 0.4 ? 3 : 2]);
  }
  drawBanner(f, a.banner, 47, 10, t, info.working ? 1.5 : 0.8);
  f.blit(a.body, 0, 0);
  if (t % 4.9 > 4.75 || t % 11.7 > 11.56) paintEyes(f, 28, 25, 38, GRIZZLE[0], EYE_STEEL, EYE_STEEL_HI, true);
  // brilho correndo pelo ouro da armadura e a estrela cintilando
  const period = info.working ? 3 : 5;
  const ph = t % period;
  sweepGlint(f, a.gold, PAL.gold, (ph - 0.6) * 40 + 30, 2.2);
  sparkle(f, 39, 51, pulse(ph, 99, -0.2, 0.55));
  sparkle(f, 55, 33, pulse(ph, 99, -1.4, 0.5), true);
  f.draw(ctx);
}

function iconMarshal() {
  const p = new Pix(16, 16);
  // ombreiras de aço com filete de ouro e a faixa vermelha
  p.ellipse(8, 17.5, 8, 5.5, (x, y) => (y === 12 ? PAL.gold[x < 8 ? 4 : 3] : PAL.steel[x < 5 ? 4 : x < 11 ? 3 : 2]));
  p.line(2, 13, 7, 15, PAL.banner[3]);
  p.line(3, 13, 8, 15, PAL.banner[2]);
  p.fill(1, 1, 15, 15, headTest(8, 8.2, 4.3, 5.1, 0.25), (x, y) =>
    pick(PAL.skin, 0.36 + sphereLight((x + 0.5 - 7.5) / 4.3, (y + 0.5 - 7.5) / 5.1) * 0.75, x, y, 3));
  // cabelo grisalho penteado para trás
  p.rect(4, 3, 8, 2, (x, y) => GRIZZLE[y === 3 ? (x < 8 ? 5 : 4) : 3]);
  p.set(4, 5, GRIZZLE[3]); p.set(11, 5, GRIZZLE[2]); p.set(4, 6, GRIZZLE[2]); p.set(11, 6, GRIZZLE[1]);
  // olhos e bigodão de pontas viradas
  p.rect(5, 7, 2, 1, GRIZZLE[3]); p.rect(9, 7, 2, 1, GRIZZLE[3]);
  p.set(6, 8, EYE_STEEL); p.set(9, 8, EYE_STEEL);
  p.rect(5, 10, 6, 1, (x) => GRIZZLE[x < 8 ? 5 : 4]);
  p.rect(3, 11, 3, 1, GRIZZLE[4]); p.rect(10, 11, 3, 1, GRIZZLE[3]);
  p.set(2, 10, GRIZZLE[4]); p.set(13, 10, GRIZZLE[3]);
  // bastão de comando
  p.line(12, 15, 15, 9, BATON[2]);
  p.set(15, 8, PAL.gold[5]);
  p.set(13, 13, PAL.gold[4]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Armada

const SEA = ramp('#16142e', '#221f44', '#30305a', '#424670', '#5c5a86', '#86708e', '#b8848a', '#e6aa88');
const GULL = C('#2a2234');

// Mistura duas cores no formato do ImageData (k = 0 fica a, 1 vira b).
function mix(a, b, k) {
  const ch = (s) => Math.round(((a >>> s) & 255) + (((b >>> s) & 255) - ((a >>> s) & 255)) * k);
  return ((255 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0;
}

// Brasão das velas: escudo de ouro com a torre vermelha.
const SAIL_ARMS = [
  'ooooooooo',
  'oGGGGGGGo',
  'oGr.r.rGo',
  'oGrrrrrGo',
  'oGGrrrGGo',
  'oGGr.rGGo',
  'oGGrrrGGo',
  '.oGrrrGo.',
  '.oGGGGGo.',
  '..oGGGo..',
  '...ooo...',
];

// Navio de guerra visto de lado, proa para a direita. (ox, wl) é o meio da linha
// d'água e s a escala; haze puxa as cores para o tom do horizonte nos navios distantes.
// Devolve o sprite e os pontos onde ficam as bandeiras.
function buildWarship(ox, wl, s, haze, hazeColor) {
  const p = new Pix(64, 64);
  const area = (lx0, ly0, lx1, ly1, test, c) => p.fill(ox + lx0 * s - 1, wl + ly0 * s - 1, ox + lx1 * s + 1, wl + ly1 * s + 1,
    (x, y) => test((x - ox) / s, (y - wl) / s), (x, y) => c((x + 0.5 - ox) / s, (y + 0.5 - wl) / s, x, y));
  // casco em meia-lua: amurada que sobe nas pontas, roda de proa e cadaste curvos
  const top = (lx) => -7.4 - 7.2 * Math.abs(lx / 21) ** 3;
  const end = (ly) => 14.5 + 7.5 * clamp01(-ly / 15) ** 0.7;
  const big = s > 0.8;

  // mastro, cesto da gávea e verga
  area(-1, -50, 1, -8, (lx, ly) => Math.abs(lx) <= 0.9 && ly >= -49.5, (lx) => PAL.wood[lx < 0 ? 3 : 1]);
  area(-3, -47, 3, -43, (lx, ly) => Math.abs(lx) <= 2.4 && ly >= -46.6 && ly <= -43.4, (lx, ly, x, y) =>
    pick(PAL.wood, 0.25 + cylLight(lx / 2.4) * 0.6 + (ly < -45.8 ? 0.2 : 0), x, y));
  area(-13, -42, 13, -39, (lx, ly) => Math.abs(lx) <= 12.6 - Math.abs(ly + 40.6) * 2 && ly >= -41.4 && ly <= -39.8, (lx, ly) =>
    PAL.wood[ly < -40.6 ? 3 : 1]);
  // vela vermelha estufada pelo vento
  const sailTop = -39.6;
  const sailBot = (lx) => -13 + 2.4 * (1 - (lx / 11.5) ** 2);
  const sailHalf = (ly) => 10.6 + 1.4 * Math.sin(Math.PI * clamp01((ly - sailTop) / 26));
  area(-13, -40, 13, -10, (lx, ly) => ly >= sailTop && ly <= sailBot(lx) && Math.abs(lx) <= sailHalf(ly), (lx, ly, x, y) => {
    const u = lx / sailHalf(ly), w = (ly - sailTop) / 26;
    if (sailBot(lx) - ly < 1.1 / s || ly - sailTop < 1 / s) return PAL.gold[u < 0 ? 3 : 2];
    let v = 0.5 - u * 0.28 + Math.sin(w * Math.PI) * 0.12 - w * 0.08;
    if (big && ((lx + 40) % 4.4) < 0.7) v -= 0.12; // costuras do pano
    if (u < -0.6) v += 0.14; // sol atravessando a borda
    return pick(PAL.banner, v, x, y);
  });
  // tripulação: elmos e lanças aparecendo por cima da amurada
  if (big) {
    for (let lx = -10.4; lx <= 11; lx += 3.2) {
      const hx = Math.round(ox + lx * s), hy = Math.round(wl + (top(lx) - 1.2) * s);
      p.set(hx, hy - 1, PAL.steel[4]); // elmo de ponta
      p.set(hx, hy, PAL.steel[3]);
      p.set(hx + 1, hy, PAL.steel[1]);
      p.set(hx, hy + 1, PAL.skin[2]);
      p.set(hx + 1, hy + 1, PAL.skin[1]);
      if (Math.round(lx * 10) % 3 === 0) {
        for (let k = 1; k <= 6; k++) p.set(hx + 1, hy - k, PAL.wood[2]);
        p.set(hx + 1, hy - 7, PAL.steel[5]);
      }
    }
  }
  // castelos de popa e de proa, com ameias e faixas pintadas
  const castle = (x0, x1, y0) => (lx, ly) => lx >= x0 && lx <= x1 && ly >= y0 - 2 && ly <= top(lx) + 1 &&
    (ly >= y0 || Math.floor((lx - x0) * 0.55) % 2 === 0);
  const castleTone = (y0) => (lx, ly, x, y) => {
    if (Math.abs(ly - (y0 + 1.4)) < 0.6) return PAL.gold[lx < 0 ? 4 : 3];
    if (big && ly > y0 + 2.2 && ly < y0 + 4.6) return Math.floor((lx + 30) / 2.2) % 2 ? PAL.gold[3] : pick(PAL.banner, 0.55, x, y);
    return pick(PAL.wood, 0.62 - (ly - y0) * 0.04 - (lx + 21) * 0.006 + (ly < y0 ? 0.15 : 0), x, y);
  };
  area(-23, -24, -12, -8, castle(-22.5, -12.5, -20.5), castleTone(-20.5));
  area(11, -23, 24, -8, (lx, ly) => castle(11.5, 22.8, -19.5)(lx, ly) && lx <= end(ly) + 1, castleTone(-19.5));
  // casco de tábuas, acompanhando a curva da amurada
  area(-23, -16, 24, 3, (lx, ly) => ly >= top(lx) && ly <= 2.5 && Math.abs(lx) <= end(ly), (lx, ly, x, y) => {
    const k = (ly - top(lx)) / (2.5 - top(lx));
    const strake = Math.floor(k * 5), fr = k * 5 - strake;
    let v = 0.56 - k * 0.3 - (lx / 21) * 0.12 + (hash(strake, Math.floor((lx + 30) / 6), 7) - 0.5) * 0.1;
    if (fr < 0.22) v -= 0.2;
    if (ly - top(lx) < 0.9 / s) return PAL.gold[lx < 0 ? 4 : 3];
    if (Math.abs(lx) > end(ly) - 1.1 / s) v -= 0.12; // roda e cadaste
    return pick(PAL.wood, v, x, y);
  });
  // escudos pendurados na amurada
  if (s > 0.4) {
    const kinds = [PAL.gold, PAL.banner, PAL.steel];
    let i = 0;
    for (let lx = -9; lx <= 10; lx += 3.2, i++) {
      const cx = ox + lx * s, cy = wl + (top(lx) + 1.6) * s, r = 1.6 * s + 0.15;
      const rr = kinds[i % 3];
      p.ellipse(cx, cy, r, r, (x, y) => pick(rr, 0.35 + sphereLight((x + 0.5 - cx) / r, (y + 0.5 - cy) / r) * 0.7, x, y, 3));
      if (big) p.set(cx, cy, rr === PAL.gold ? PAL.banner[2] : PAL.gold[4]);
    }
  }
  // mastro da bandeira de popa
  if (s > 0.4) p.line(ox - 20 * s, wl - 22 * s, ox - 20 * s, wl - 27 * s, PAL.wood[3]);
  // gurupés
  for (let k = 0; k <= 12 * s; k++) {
    const u = k / (12 * s);
    p.set(ox + (20 + u * 10) * s, wl + (-14 - u * 4) * s, PAL.wood[u < 0.5 ? 3 : 2]);
  }
  // brasão da vela
  if (big) {
    paintBitmap(p, SAIL_ARMS, Math.round(ox - 4), Math.round(wl - 31 * s), (i, j, ch) =>
      ch === 'o' ? PAL.out : ch === 'r' ? PAL.banner[i < 4 ? 3 : 2] : PAL.gold[i + j < 6 ? 5 : i < 5 ? 4 : 3]);
  } else {
    const ex = Math.round(ox), ey = Math.round(wl - 28 * s);
    p.rect(ex - 1, ey - 1, 3, 2, PAL.gold[4]);
    p.set(ex, ey + 1, PAL.gold[3]);
  }
  if (haze > 0) for (let i = 0; i < p.d.length; i++) if (p.d[i]) p.d[i] = mix(p.d[i], hazeColor, haze);
  p.outline(haze > 0.3 ? PURPLE_HILLS[0] : PAL.out);
  // cordame (fino, por cima do contorno)
  const rope = haze > 0 ? mix(PAL.wood[0], hazeColor, haze * 0.5) : PAL.wood[0];
  p.line(ox + 1, wl - 47 * s, ox + 30 * s, wl - 18 * s, rope);
  p.line(ox - 1, wl - 47 * s, ox - 21 * s, wl - 23 * s, rope);
  if (big) {
    p.line(ox - 12 * s, wl - 40 * s, ox - 16 * s, wl - 21 * s, rope);
    p.line(ox + 12 * s, wl - 40 * s, ox + 15 * s, wl - 20 * s, rope);
  }
  return {
    pix: p, ox, wl, s,
    hull: [Math.floor(ox - end(0) * s) - 1, Math.ceil(ox + end(0) * s) + 1],
    flags: [[ox, wl - 49.5 * s, 1], [ox - 20 * s, wl - 27 * s, 0.6]],
  };
}

const ARMADA_SUN = [8, 31];
const ARMADA_SHIPS = () => [
  buildWarship(8, 40.5, 0.32, 0.7, C('#3e3058')),
  buildWarship(53, 46.5, 0.52, 0.32, C('#7a5e84')),
  buildWarship(30, 55.5, 0.9, 0, 0),
];

function buildArmadaBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 38, PAL.dusk, 2.4);
  // nuvens compridas, acesas por baixo pelo sol
  for (const [cx, cy, w] of [[40, 9, 22], [18, 15, 14], [52, 20, 12], [6, 6, 9]]) {
    for (let y = cy - 2; y <= cy + 1; y++) {
      for (let x = Math.floor(cx - w); x <= cx + w; x++) {
        const u = (x + 0.5 - cx) / w, half = (1 - u * u) * 2;
        if (Math.abs(y + 0.5 - cy) > half) continue;
        p.set(x, y, pick(PAL.duskCloud, 0.35 + (y + 0.5 - cy) * 0.25 - u * 0.2, x, y, 2));
      }
    }
  }
  sunDisc(p, ARMADA_SUN[0], ARMADA_SUN[1], 4, 2, 0.5);
  // costa distante com uma torre de vigia
  for (let x = 34; x < 64; x++) {
    const top = Math.round(35 - clamp01((x - 34) / 10) * 2.5 - Math.sin(x * 0.35) * 0.8);
    for (let y = top; y < 38; y++) p.set(x, y, pick(PURPLE_HILLS, (y === top ? 0.8 : 0.45) - (x - 34) * 0.004, x, y));
  }
  p.rect(58, 29, 2, 4, PURPLE_HILLS[1]);
  p.rect(57, 28, 4, 1, PURPLE_HILLS[1]);
  p.set(58, 30, PAL.fire[4]);
  // mar: claro no horizonte, escuro perto, com o reflexo do sol
  const [sx] = ARMADA_SUN;
  for (let y = 37; y < 64; y++) {
    const d = (y - 37) / 27;
    for (let x = 0; x < 64; x++) {
      let v = 0.66 - d * 0.6 + clamp01(1 - Math.abs(x + 0.5 - sx) / (3 + d * 12)) * 0.32 * (1 - d * 0.4);
      const w = Math.sin(x * (0.42 + hash(y, 1, 4) * 0.3) + y * 2.3 + hash(y, 2, 4) * 6);
      if (w > 0.72) v += 0.12 * (1 - d * 0.5);
      else if (w < -0.85) v -= 0.1;
      if (y === 37) v += 0.15;
      p.set(x, y, pick(SEA, v, x, y, 2));
    }
  }
  return p;
}

function buildArmada() {
  const p = new Pix(64, 64);
  for (const sh of ARMADA_SHIPS()) p.blit(sh.pix, 0, 0);
  return p;
}

// Flâmula comprida de ponta dupla saindo do mastro para a direita.
function paintPennant(f, x, y, t, len, amp, seed) {
  x = Math.round(x); y = Math.round(y);
  for (let i = 0; i < len; i++) {
    const s = Math.sin(t * 5 - i * 0.6 + seed);
    const dy = Math.round(s * amp * (i / len));
    const c = PAL.banner[Math.max(1, Math.min(3, Math.round(2 + Math.cos(t * 5 - i * 0.6 + seed) * 1.2)))];
    f.set(x + 1 + i, y + dy, c);
    if (i < len - 2) f.set(x + 1 + i, y + 1 + dy, i < 2 ? PAL.gold[4] : PAL.banner[1]);
  }
  f.set(x, y - 1, PAL.gold[5]);
}

const armadaArt = { bg: null, ships: null, sails: null, glitter: null, cloud: null, frame: new Pix(64, 64) };

function paintArmadaPortrait(ctx, t, info) {
  const a = armadaArt;
  if (!a.bg) {
    a.bg = buildArmadaBackdrop();
    a.ships = ARMADA_SHIPS();
    a.sail = rampPixels(a.ships[2].pix, PAL.banner, 0, 0, 63, 50);
    a.glitter = [];
    for (let y = 38; y < 64; y++) for (let x = 0; x < 64; x++) if (hash(x, y, 21) < 0.14) a.glitter.push(x, y);
    a.glitter = Int16Array.from(a.glitter);
    a.cloud = makeCloud(16, 6, 7, PAL.duskCloud);
    // reflexo da nau capitânia: o casco espelhado e escurecido na água
    const sh = a.ships[2], wl = Math.round(sh.wl);
    a.mirror = new Pix(64, 8);
    for (let r = 0; r < 8; r++) {
      for (let x = 0; x < 64; x++) {
        const c = sh.pix.get(x, wl - 1 - r);
        if (c) a.mirror.d[r * 64 + x] = mix(c, SEA[1], 0.55 + r * 0.05);
      }
    }
  }
  const live = info.working ? 1 : 0.6;
  const f = a.frame.copyFrom(a.bg);
  const bg = a.bg.d, d = f.d;
  f.blit(a.cloud, Math.floor(((t * 1.2) % 90) - 18), 14);
  // reflexos correndo no mar e o caminho de luz do sol
  const g = a.glitter;
  for (let i = 0; i < g.length; i += 2) {
    const x = g[i], y = g[i + 1];
    const s = Math.sin(x * 0.9 - t * 2.2 + y * 1.7) * Math.sin(x * 0.27 + t * 0.7 + y * 0.6);
    if (s > 0.8) f.set(x, y, SEA[s > 0.93 ? 6 : 5]);
  }
  const [sx] = ARMADA_SUN;
  for (let y = 38; y < 64; y++) {
    const hw = 1.2 + (y - 37) * 0.32;
    for (let k = 0; k < 2; k++) {
      const x = sx + Math.sin(t * (1.3 + k * 0.7) + y * 1.9 + k * 2) * hw;
      const len = 1 + ((y + k) & 1);
      for (let j = 0; j < len; j++) f.set(x + j, y, y < 46 ? PAL.haze : PAL.sunRim);
    }
  }
  // gaivotas
  for (let k = 0; k < 2; k++) {
    const x = ((t * (3 + k) + k * 37) % 84) - 10, y = 12 + k * 7 + Math.sin(t * 0.8 + k * 2) * 2;
    const up = Math.sin(t * 7 + k * 3) > 0;
    f.set(x, y, GULL); f.set(x - 1, y + (up ? -1 : 0), GULL); f.set(x + 1, y + (up ? -1 : 0), GULL);
    f.set(x - 2, y + (up ? -1 : 1), GULL); f.set(x + 2, y + (up ? -1 : 1), GULL);
  }
  // navios balançando nas ondas; a água cobre o fundo do casco
  a.ships.forEach((sh, n) => {
    const bob = Math.round(Math.sin(t * (1.1 + n * 0.25) + n * 2) * (n === 0 ? 0.4 : 0.55 + live * 0.35));
    f.blit(sh.pix, 0, bob);
    const [hx0, hx1] = sh.hull;
    for (let x = Math.max(0, hx0); x <= Math.min(63, hx1); x++) {
      const wave = Math.round(sh.wl + Math.sin(x * 0.5 - t * 2.4 + n) * 0.6 * sh.s);
      for (let y = wave; y < sh.wl + 4 * sh.s + 2; y++) if (y >= 0 && y < 64) d[y * 64 + x] = bg[y * 64 + x];
      if (sh.s > 0.5 && Math.sin(x * 1.3 + t * 3 + n) > 0.2) f.set(x, wave, SEA[sh.s > 0.9 ? 6 : 5]);
    }
    if (n === 2) {
      const wl = Math.round(sh.wl), m = a.mirror;
      for (let r = 0; r < 8; r += 1) {
        if (r > 2 && (r & 1)) continue; // reflexo partido pelas ondas
        const dx = Math.round(Math.sin(t * 2.1 + r * 1.4) * (0.4 + r * 0.15));
        for (let x = 0; x < 64; x++) {
          const c = m.d[r * 64 + x];
          if (c && x + dx >= 0 && x + dx < 64) d[(wl + r) * 64 + x + dx] = c;
        }
      }
    }
    // espuma na proa
    if (sh.s > 0.5) {
      const bx = sh.ox + 16 * sh.s, by = sh.wl;
      for (let k = 0; k < 5; k++) {
        const life = (t * (0.9 + live * 0.6) + k / 5) % 1;
        f.set(bx + life * 7 * sh.s, by - Math.sin(life * Math.PI) * 2.5 * sh.s, life < 0.5 ? PAL.sail[4] : PAL.sail[2]);
      }
    }
    for (const [fx, fy, fs] of sh.flags) paintPennant(f, fx, fy + bob, t * (0.8 + live * 0.5), Math.round(9 * sh.s * fs) + 1, 1.6 * sh.s, n);
  });
  // vento enfunando a vela da nau capitânia
  sweepGlint(f, a.sail, PAL.banner, ((t * 0.7) % 1.6) * 70 + 4, 2.6);
  // marola em primeiro plano
  for (let x = 0; x < 64; x++) {
    const y = 61 + Math.round(Math.sin(x * 0.22 - t * 1.4) * 1.2 + Math.sin(x * 0.57 + t * 0.9) * 0.5);
    f.set(x, y, SEA[3]);
    if (Math.sin(x * 0.22 - t * 1.4 + 0.6) > 0.55) f.set(x, y - 1, SEA[5]);
    f.set(x, y + 1, SEA[1]);
  }
  f.draw(ctx);
}

function iconArmada() {
  const p = new Pix(16, 16);
  // mastro, verga e vela vermelha estufada, com o brasão
  p.rect(7, 0, 1, 10, (x, y) => PAL.wood[y < 2 ? 3 : 2]);
  p.rect(3, 1, 10, 1, PAL.wood[3]);
  p.poly([[3.6, 2], [12.4, 2], [13, 6.6], [8, 7.6], [3, 6.6]], (x, y) => PAL.banner[y >= 6 ? 1 : x < 6 ? 3 : x < 10 ? 2 : 1]);
  p.rect(6, 3, 3, 2, (x) => PAL.gold[x < 8 ? 5 : 4]);
  p.set(7, 5, PAL.gold[3]);
  p.set(7, 3, PAL.banner[1]);
  // castelos e casco em meia-lua, com os escudos na amurada
  p.rect(0, 7, 4, 2, (x, y) => PAL.wood[y === 7 ? 4 : 3]);
  p.rect(12, 7, 4, 2, (x, y) => PAL.wood[y === 7 ? 3 : 2]);
  p.poly([[0, 9], [16, 9], [13, 12.6], [3, 12.6]], (x, y) => PAL.wood[y < 11 ? 2 : 1]);
  p.rect(0, 9, 16, 1, (x) => PAL.gold[x < 8 ? 4 : 3]);
  for (const [x, c] of [[4, PAL.gold[5]], [6, PAL.banner[3]], [8, PAL.steel[4]], [10, PAL.gold[5]], [12, PAL.banner[3]]]) p.set(x, 10, c);
  // flâmula
  p.rect(8, 0, 4, 1, (x) => PAL.banner[x < 10 ? 3 : 2]);
  p.outline(PAL.out);
  // ondas
  for (let x = 0; x < 16; x++) {
    p.set(x, 14, (x & 3) === 2 ? PAL.water[4] : 0);
    p.set(x, 15, (x & 3) === 1 ? PAL.water[3] : PAL.water[2]);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Legião

const DRY = ramp('#2e1c14', '#4a2c1a', '#6a4224', '#8e5c30', '#b07a42', '#cf9c5c', '#e8c084');
const DUST_HI = C('#f4dcb0');
const RANK_SHADE = C('#4a3248'); // fileiras de trás, contra a poeira iluminada
const CROW = C('#1e1622');

// Soldados em três tamanhos (perto, meio e longe), virados para a esquerda.
// c penacho, h/H elmo, f/F rosto, g ouro, s/S escudo, b umbo, a/A couraça,
// t túnica, k mão na lança, l perna, d bota.
const SOLDIER_L = [
  '..ccccc..',
  '..hhhhh..',
  '.hhhhhhh.',
  '..ffhHHH.',
  '..fFF....',
  'ggggaaat.',
  'gsssgaaa.',
  'gsssgaaAk',
  'gssbgAAt.',
  'gsssgttt.',
  'gsssgtt..',
  'gsssg.l..',
  'ggggg.l..',
  '..l..l...',
  '..dd.dd..',
];
const SOLDIER_M = [
  '.cccc..',
  '.hhhh..',
  '.hhhhH.',
  '.ffH...',
  'gggaat.',
  'gsgaaak',
  'gbgAAt.',
  'gsgtt..',
  'gsg.l..',
  'ggg.l..',
  '.l..l..',
  '.d..d..',
];
const SOLDIER_S = [
  '.ch..',
  '.hH..',
  '.fF..',
  'ggaak',
  'gbaA.',
  'ggt..',
  '.l.l.',
  '.d.d.',
];
const SOLDIER_COLORS = {
  c: PAL.banner[3], h: PAL.steel[4], H: PAL.steel[2], f: PAL.skin[3], F: PAL.skin[1],
  g: PAL.gold[3], s: PAL.banner[2], S: PAL.banner[1], b: PAL.gold[5], a: PAL.steel[3], A: PAL.steel[1],
  t: PAL.banner[1], k: PAL.skin[2], l: PAL.leather[2], d: PAL.leather[0],
};
const SOLDIER_KINDS = [
  { rows: SOLDIER_L, spear: 12, hand: [8, 7] },
  { rows: SOLDIER_M, spear: 9, hand: [6, 5] },
  { rows: SOLDIER_S, spear: 6, hand: [4, 3] },
];

// Fileiras da frente para trás: tamanho, névoa de poeira, onde começa e o passo.
const LEGION_RANKS = [
  { kind: 0, haze: 0, x: 6, y: 63, dx: 8.6, dy: -2.6, n: 7 },
  { kind: 1, haze: 0.16, x: 11, y: 55, dx: 7.2, dy: -2.2, n: 7 },
  { kind: 1, haze: 0.3, x: 15, y: 48.5, dx: 6.3, dy: -1.9, n: 7 },
  { kind: 2, haze: 0.42, x: 18, y: 43, dx: 5.4, dy: -1.6, n: 7 },
  { kind: 2, haze: 0.54, x: 21, y: 38.5, dx: 4.8, dy: -1.4, n: 7 },
];
const STANDARD = { rank: 2, file: 3 }; // porta-estandarte no meio do bloco

function standardPos() {
  const r = LEGION_RANKS[STANDARD.rank];
  return [Math.round(r.x + r.dx * STANDARD.file), Math.round(r.y + r.dy * STANDARD.file)];
}

// Uma fileira inteira num sprite recortado, com as pontas das lanças guardadas.
function buildRank(ri) {
  const R = LEGION_RANKS[ri];
  const K = SOLDIER_KINDS[R.kind];
  const p = new Pix(64, 64);
  const spears = [];
  for (let i = R.n - 1; i >= 0; i--) {
    const fx = Math.round(R.x + R.dx * i), fy = Math.round(R.y + R.dy * i);
    const w = K.rows[0].length, h = K.rows.length;
    const x0 = fx - (w >> 1), y0 = fy - h + 1;
    if (ri === STANDARD.rank && i === STANDARD.file) {
      spears.push([x0 + K.hand[0], y0 + K.hand[1] + 2, 0]); // vara do estandarte (sem ponta)
    } else {
      spears.push([x0 + K.hand[0], y0 + K.hand[1] + 2, K.spear + h - K.hand[1] + ((i * 7 + ri * 3) % 3) - 1]);
    }
    paintBitmap(p, K.rows, x0, y0, (bx, by, ch) => {
      let c = SOLDIER_COLORS[ch];
      if (ch === 's' && bx === 1) c = PAL.banner[3]; // luz na borda do escudo
      if (ch === 'g' && by > 0 && bx === 0) c = PAL.gold[4];
      return R.haze ? mix(c, RANK_SHADE, R.haze) : c;
    });
  }
  p.outline(PAL.out);
  // lanças finas por cima do contorno, com a ponta de aço
  const tips = [];
  const shaft = mix(PAL.wood[1], RANK_SHADE, R.haze * 0.5), tip = mix(PAL.steel[5], RANK_SHADE, R.haze * 0.3);
  for (const [x, y, len] of spears) {
    if (!len) continue;
    for (let k = 0; k < len; k++) p.set(x, y - k, shaft);
    p.set(x, y - len, tip);
    p.set(x, y - len - 1, tip);
    tips.push(x, y - len - 1);
  }
  let x0 = 64, y0 = 64, x1 = 0, y1 = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (p.d[y * 64 + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const q = new Pix(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) q.d[(y - y0) * q.w + x - x0] = p.d[y * 64 + x];
  return { pix: q, x: x0, y: y0, tips: Int16Array.from(tips) };
}

// Vara do estandarte com a águia de ouro no alto.
const EAGLE_SMALL = ['x.....x', 'xx.x.xx', '.xxxxx.', '..xxx..', '..x.x..'];
function buildStandard() {
  const p = new Pix(64, 64);
  const [sx, sy] = standardPos();
  const K = SOLDIER_KINDS[LEGION_RANKS[STANDARD.rank].kind];
  const hx = sx - (K.rows[0].length >> 1) + K.hand[0], top = 6;
  for (let y = top; y < sy - 2; y++) p.set(hx, y, PAL.wood[y < top + 3 ? 3 : 2]);
  p.rect(hx - 5, top + 6, 11, 1, PAL.wood[3]);
  p.set(hx - 5, top + 6, PAL.gold[4]);
  p.set(hx + 5, top + 6, PAL.gold[4]);
  // coroa de louros e águia
  for (const [dx, dy] of [[-2, 3], [-2, 4], [-1, 5], [2, 3], [2, 4], [1, 5]]) p.set(hx + dx, top + dy, PAL.herb[3]);
  paintBitmap(p, EAGLE_SMALL, hx - 3, top - 3, (i, j) => PAL.gold[j === 0 ? 5 : i < 3 ? 4 : 3]);
  p.outline(PAL.out);
  return { pix: p, hx, top };
}

function buildLegionBanner() {
  const w = 9, h = 11;
  return makeBanner(w, h, (put) => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (j === h - 1 && i % 2 === 1) continue; // franja
        const edge = i === 0 || i === w - 1 || j === h - 2;
        if (j === h - 1) { put(i, j, PAL.gold, 0.7); continue; }
        if (edge) { put(i, j, OUT_RAMP, 0); continue; }
        put(i, j, PAL.banner, 0.6 - (i - 4) * 0.04);
      }
    }
    // coroa de louros dourada
    for (const [i, j] of [[3, 2], [5, 2], [2, 3], [6, 3], [2, 4], [6, 4], [2, 5], [6, 5], [3, 6], [5, 6], [4, 7]]) put(i, j, PAL.gold, 0.85 - j * 0.04);
    put(4, 4, PAL.gold, 0.95);
  });
}

function buildLegionBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 32, PAL.dusk, 2.4);
  // nuvens compridas acesas por baixo
  for (const [cx, cy, w] of [[44, 7, 18], [14, 12, 12], [58, 15, 8]]) {
    for (let y = cy - 2; y <= cy + 1; y++) {
      for (let x = Math.floor(cx - w); x <= cx + w; x++) {
        const u = (x + 0.5 - cx) / w;
        if (Math.abs(y + 0.5 - cy) > (1 - u * u) * 2) continue;
        p.set(x, y, pick(PAL.duskCloud, 0.3 + (y + 0.5 - cy) * 0.25 - u * 0.15, x, y, 2));
      }
    }
  }
  sunDisc(p, 7, 27, 4, 2, 0.5);
  // morros roxos ao longe e um mais perto, pardo
  for (let x = 0; x < 64; x++) {
    const far = Math.round(27 + Math.sin(x * 0.11 + 1) * 2 + Math.sin(x * 0.37) * 0.8);
    for (let y = far; y < 34; y++) p.set(x, y, pick(PURPLE_HILLS, (y === far ? 0.85 : 0.5) - (y - far) * 0.04, x, y));
    const near = Math.round(31 + Math.sin(x * 0.08 + 3) * 1.5);
    for (let y = near; y < 36; y++) p.set(x, y, pick(DRY, 0.35 - (y - near) * 0.03, x, y));
  }
  // planície seca, mais clara perto do sol, com tufos de capim
  for (let y = 33; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (y < 36 && p.get(x, y) !== 0 && y < Math.round(31 + Math.sin(x * 0.08 + 3) * 1.5)) continue;
      let v = 0.45 + (y - 33) * 0.008 - x * 0.003 + (hash(x, y, 5) - 0.5) * 0.16;
      v += clamp01(1 - Math.hypot(x - 7, (y - 33) * 2) / 30) * 0.25;
      if (hash(x, y, 6) < 0.05) v -= 0.22;
      p.set(x, y, pick(DRY, v, x, y, 1.8));
    }
  }
  // estrada de terra batida por onde a legião marcha
  for (let y = 33; y < 64; y++) {
    const c = 60 - (y - 33) * 1.25, hw = 3 + (y - 33) * 0.45;
    for (let x = Math.floor(c - hw); x <= c + hw; x++) {
      const e = Math.abs(x + 0.5 - c) / hw;
      if (e > 1 || x < 0 || x > 63) continue;
      let v = 0.62 + (hash(x, y, 7) - 0.5) * 0.14 - e * 0.1 + clamp01(1 - Math.hypot(x - 7, (y - 33) * 2) / 30) * 0.2;
      if ((x * 3 + y * 5) % 11 === 0) v -= 0.12; // pedrinhas e marcas de pés
      p.set(x, y, pick(DRY, v, x, y, 1.8));
    }
  }
  // poeira levantada pela marcha, pairando atrás do bloco
  for (let y = 22; y < 46; y++) {
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot((x - 38) / 32, (y - 34) / 10);
      if (d < 1 && bayer(x, y) < (1 - d) * 0.8) p.set(x, y, pick(DRY, 0.8 + (1 - d) * 0.25, x, y));
    }
  }
  return p;
}

function buildLegion() {
  const p = new Pix(64, 64);
  const st = buildStandard();
  for (let r = LEGION_RANKS.length - 1; r >= 0; r--) {
    const rk = buildRank(r);
    p.blit(rk.pix, rk.x, rk.y);
    if (r === STANDARD.rank) p.blit(st.pix, 0, 0);
  }
  return p;
}

const legionArt = { bg: null, ranks: null, std: null, banner: null, frame: new Pix(64, 64) };

function paintLegionPortrait(ctx, t, info) {
  const a = legionArt;
  if (!a.bg) {
    a.bg = buildLegionBackdrop();
    a.ranks = LEGION_RANKS.map((_, r) => buildRank(r));
    a.std = buildStandard();
    a.banner = buildLegionBanner();
  }
  const live = info.working ? 1 : 0;
  const f = a.frame.copyFrom(a.bg);
  // corvos rondando
  for (let k = 0; k < 3; k++) {
    const ang = t * (0.35 + k * 0.07) + k * 2.1;
    const x = 30 + Math.cos(ang) * (12 + k * 4), y = 10 + k * 2 + Math.sin(ang) * 3;
    const up = Math.sin(t * 6 + k * 2) > 0;
    f.set(x, y, CROW); f.set(x - 1, y + (up ? -1 : 0), CROW); f.set(x + 1, y + (up ? -1 : 0), CROW);
    f.set(x - 2, y + (up ? -1 : 1), CROW); f.set(x + 2, y + (up ? -1 : 1), CROW);
  }
  // fileiras de trás para a frente; marchando, elas sobem e descem no passo
  const glint = ((t * (0.5 + live * 0.3)) % 1.4) * 90 - 10;
  for (let r = a.ranks.length - 1; r >= 0; r--) {
    const rk = a.ranks[r];
    const bob = live ? Math.round(Math.max(0, Math.sin(t * 5.2 + r * 1.6)) * 0.9) : 0;
    f.blit(rk.pix, rk.x, rk.y - bob);
    // brilho do sol correndo pelas pontas das lanças
    const tp = rk.tips;
    for (let i = 0; i < tp.length; i += 2) {
      const d = Math.abs(tp[i] - glint + tp[i + 1] * 0.4);
      if (d < 2.5) f.set(tp[i], tp[i + 1] - bob, d < 1 ? WHITE : PAL.steel[5]);
    }
    if (r === STANDARD.rank) {
      f.blit(a.std.pix, 0, -bob);
      drawBanner(f, a.banner, a.std.hx - 4, a.std.top + 7 - bob, t * 1.3, 1 + live * 0.6);
    }
  }
  // poeira dos pés, soprando para a esquerda
  const puffs = info.working ? 8 : 4;
  for (let k = 0; k < puffs; k++) {
    const life = (t * (0.16 + live * 0.08) + k / puffs) % 1;
    const rr = LEGION_RANKS[k % 2];
    const file = hash(k, 3, 9) * 6;
    const cx = rr.x + rr.dx * file - life * 16, cy = rr.y + rr.dy * file - 1 - life * 5;
    const r = 2.5 + life * 4;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dd = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.6) / r;
        if (dd < 1 && bayer(x, y) < (1.1 - dd) * (1 - life * 0.85)) f.set(x, y, dd < 0.5 ? DUST_HI : DRY[6]);
      }
    }
  }
  f.draw(ctx);
}

function iconLegion() {
  const p = new Pix(16, 16);
  // lanças erguidas atrás
  for (const x of [3, 8, 13]) {
    p.rect(x, 1, 1, 10, PAL.wood[2]);
    p.set(x, 0, PAL.steel[5]);
    p.set(x, 1, PAL.steel[4]);
  }
  // três escudos lado a lado
  for (const [x0, y0] of [[0, 5], [10, 5], [5, 6]]) {
    p.rect(x0, y0, 6, 9, (x, y) => {
      if (x === x0 || x === x0 + 5 || y === y0 || y === y0 + 8) return PAL.gold[x === x0 ? 4 : 2];
      return PAL.banner[x === x0 + 1 ? 3 : 2];
    });
    p.set(x0 + 2, y0 + 4, PAL.gold[5]);
    p.set(x0 + 3, y0 + 4, PAL.gold[3]);
  }
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Conquistador

const EMBER_SKY = ramp('#22122a', '#3a1832', '#5e2038', '#8c2a36', '#bc4032', '#e26a30', '#f4a044', '#fcd480');
const BLACK_STEEL = ramp('#0b0b12', '#161620', '#232332', '#363648', '#525468', '#7c8094', '#b2b6c6');
const CAPE = ramp('#26050a', '#480b10', '#721418', '#a0201e', '#c83a2a', '#e46040');
const RAVEN_HAIR = ramp('#0c0909', '#1a1312', '#2a201c', '#3e3028', '#564436');
const SCORCH = ramp('#140c12', '#22141a', '#341e20', '#4c2a26', '#6a3a2c');
const SMOKE = ramp('#1e1520', '#30222c', '#46323a', '#5e464a');
const CONQ_HEAD = headTest(32, 30, 9.8, 12, 0.16);
const CONQ_SUN = [12, 37];
const CONQ_SMOKE = [[24, 41], [56, 40]];

function buildConquerorBackdrop() {
  const p = new Pix(64, 64);
  const [sx, sy] = CONQ_SUN;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const glow = clamp01(1 - Math.hypot(x + 0.5 - sx, (y + 0.5 - sy) * 1.3) / 34);
      p.d[y * 64 + x] = pick(EMBER_SKY, 0.05 + (y / 44) * 0.62 + glow * glow * 0.45, x, y, 2.2);
    }
  }
  // faixas de nuvem e fumaça no céu
  for (const [cx, cy, w] of [[44, 10, 20], [10, 18, 12], [56, 24, 9], [26, 6, 9]]) {
    for (let y = cy - 2; y <= cy + 1; y++) {
      for (let x = Math.floor(cx - w); x <= cx + w; x++) {
        const u = (x + 0.5 - cx) / w;
        if (Math.abs(y + 0.5 - cy) > (1 - u * u) * 2) continue;
        p.set(x, y, pick(EMBER_SKY, 0.12 + (y + 0.5 - cy) * 0.16 + clamp01(1 - Math.hypot(x - sx, y - sy) / 30) * 0.5, x, y, 2));
      }
    }
  }
  sunDisc(p, sx, sy, 6.5, 1.5, 0.45);
  // colunas de fumaça escura subindo do campo, tortas pelo vento
  for (const [bx, by] of CONQ_SMOKE) {
    for (let y = 0; y < by; y++) {
      const h = by - y, c = bx - h * 0.42 + Math.sin(y * 0.21 + bx) * 1.6, w = 1.2 + h * 0.13;
      for (let x = Math.floor(c - w); x <= c + w; x++) {
        const e = Math.abs(x + 0.5 - c) / w;
        if (e > 1 || bayer(x, y) > 1.2 - e * 0.9 - h * 0.012) continue;
        const k = EMBER_SKY.indexOf(p.get(x, y));
        p.set(x, y, k >= 0 ? EMBER_SKY[Math.max(0, k - 2)] : SMOKE[1]);
      }
    }
  }
  // colinas do campo de batalha, escuras contra o sol
  for (let x = 0; x < 64; x++) {
    const far = Math.round(41 + Math.sin(x * 0.13 + 2) * 1.6 + Math.sin(x * 0.41) * 0.6);
    for (let y = far; y < 64; y++) p.set(x, y, pick(SCORCH, (y === far ? 0.75 : 0.45) - (y - far) * 0.025 + (hash(x, y, 4) - 0.5) * 0.08, x, y));
  }
  // lanças quebradas e estandartes caídos no horizonte
  for (const [x, h, lean] of [[3, 6, 1], [8, 4, -1], [19, 5, 1], [27, 3, 0], [47, 5, -1], [52, 7, 1], [61, 4, 0]]) {
    const base = Math.round(41 + Math.sin(x * 0.13 + 2) * 1.6 + Math.sin(x * 0.41) * 0.6);
    for (let k = 0; k < h; k++) p.set(x + Math.round(lean * k * 0.3), base - k, SCORCH[0]);
  }
  for (const [x, y] of [[20, 37], [21, 37], [21, 38], [53, 35], [54, 35], [54, 36], [55, 35]]) p.set(x, y, SCORCH[1]);
  // mastros dos estandartes fincados
  for (const [x, top] of [[49, 6], [58, 11]]) {
    p.rect(x, top, 1, 64 - top, (xx, y) => PAL.wood[y % 5 === 0 ? 1 : 2]);
    p.set(x, top - 1, PAL.steel[4]);
    p.set(x, top - 2, PAL.steel[5]);
    p.rect(x - 1, top + 1, 3, 1, PAL.wood[1]);
  }
  return p;
}

// Estandarte rasgado preso no mastro pela direita, com a ponta livre em farrapos.
function buildTatteredBanner(w, h, r, seed) {
  return makeBanner(w, h, (put) => {
    for (let j = 0; j < h; j++) {
      const rag = Math.floor(hash(j >> 1, seed, 3) * 4) + (j > h - 3 ? 2 : 0);
      for (let i = 0; i < w; i++) {
        if (i < rag) continue;
        if (hash(i, j, seed + 5) < 0.05 && i < w - 3 && i > rag) continue; // furos
        const edge = j === 0 || j === h - 1 || i === rag;
        if (edge) { put(i, j, OUT_RAMP, 0); continue; }
        put(i, j, r, 0.45 + (i / w) * 0.2 + (hash(i >> 1, j, seed) - 0.5) * 0.1);
      }
    }
    // brasão: estrela de ouro desbotada
    for (const [i, j] of [[6, 3], [5, 4], [6, 4], [7, 4], [6, 5], [5, 6], [7, 6]]) put(i - (10 - w), j, PAL.gold, 0.55);
  });
}

// Bandeira deitada ao vento: as colunas ondulam mais longe do mastro (à direita).
function drawFlag(f, b, x0, y0, t, amp) {
  for (let i = 0; i < b.w; i++) {
    const k = (b.w - 1 - i) / b.w;
    const dy = Math.round(Math.sin(t * 4 + i * 0.7) * amp * k);
    for (let j = 0; j < b.h; j++) {
      const n = j * b.w + i;
      const ri = b.kind[n];
      if (ri < 0) continue;
      const fold = Math.cos(t * 4 + i * 0.7) * 0.2 * k;
      f.set(x0 + i, y0 + j + dy, pick(b.ramps[ri], b.val[n] + fold, i, j));
    }
  }
}

// Coroa de louros: um ramo de cada lado subindo pela testa, com folhas para
// cima e para baixo do ramo e tufos saindo pelas têmporas. Tem contorno próprio.
function buildLaurel() {
  const p = new Pix(64, 64);
  const cx = 32;
  const band = (x) => 20.4 + 1.4 * (1 - ((x - cx) / 11.5) ** 2);
  for (const side of [-1, 1]) {
    // folhas de cima, apontando para a frente e para o alto
    for (let k = 1; k <= 5; k++) {
      const x = Math.round(cx + side * (k * 2.1 + 0.4)), y = Math.round(band(x));
      const d = -side;
      p.set(x, y - 1, PAL.gold[3]);
      p.set(x, y - 2, PAL.gold[side < 0 ? 5 : 4]);
      p.set(x + d, y - 2, PAL.gold[4]);
      p.set(x + d, y - 3, PAL.gold[side < 0 ? 5 : 4]);
      // folhas de baixo, deitadas sobre a testa
      p.set(x, y + 1, PAL.gold[2]);
      p.set(x + d, y + 1, PAL.gold[3]);
    }
    // ramo
    for (let k = 0; k <= 11; k++) {
      const x = cx + side * (1.5 + k);
      p.set(x, Math.round(band(x)), PAL.gold[side < 0 ? 3 : 2]);
    }
    // tufo nas têmporas, saindo para trás
    const tx = cx + side * 12;
    for (const [dx, dy, k] of [[0, 0, 3], [1, -1, 4], [2, -2, 4], [2, -3, 5], [1, 1, 3], [2, 1, 3], [3, 0, 4], [3, -1, 4], [4, -1, 5]]) {
      p.set(tx + dx * side, Math.round(band(tx)) + dy, PAL.gold[side < 0 ? k : k - 1]);
    }
  }
  // fita presa na frente
  p.set(cx, Math.round(band(cx)) - 1, PAL.gold[5]);
  p.set(cx - 1, Math.round(band(cx)), PAL.gold[4]);
  p.set(cx, Math.round(band(cx)), PAL.gold[3]);
  p.outline(PAL.out);
  return p;
}

function buildConqueror() {
  const p = new Pix(64, 64);
  const cx = 32;
  const [sx, sy] = CONQ_SUN;
  const rim = (x, y) => clamp01(1 - Math.hypot(x - sx, y - sy) / 40);
  // capa vermelha: gola alta atrás da cabeça e o pano caindo pelas costas
  p.poly([[0, 64], [0, 50], [8, 44], [16, 37], [24, 35], [40, 35], [48, 37], [56, 44], [64, 50], [64, 64]], (x, y) => {
    const fold = Math.sin(x * 0.75 + 0.5) * 0.14;
    const v = 0.38 - ((x + 0.5 - cx) / 32) * 0.22 + fold + rim(x, y) * 0.25 - (y - 40) * 0.006;
    return pick(CAPE, v, x, y);
  });
  // gorjal escuro
  p.fill(22, 38, 42, 47, (x, y) => y > 39.5 && Math.abs(x - cx) <= 7 + (y - 40) * 0.5, (x, y) => {
    const nx = (x + 0.5 - cx) / 10;
    let v = 0.12 + cylLight(nx) * 0.45 + specBand(nx, -0.45, 0.2) * 0.3;
    if (y % 3 === 0) v -= 0.18;
    return pick(BLACK_STEEL, v, x, y);
  });
  // couraça negra com a nervura e o relevo de um sol
  p.poly([[13, 64], [15, 52], [21, 46], [43, 46], [49, 52], [51, 64]], (x, y) => {
    const nx = (x + 0.5 - cx) / 19;
    let v = 0.1 + cylLight(nx) * 0.42 + specBand(nx, -0.45, 0.16) * 0.38 - (y - 48) * 0.005;
    if (x === 31) v += 0.16;
    else if (x === 32) v -= 0.1;
    return pick(BLACK_STEEL, v, x, y);
  });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    for (let r = 2.5; r < 4.6; r += 0.5) p.set(cx + Math.cos(a) * r, 57 + Math.sin(a) * r, BLACK_STEEL[k < 4 ? 2 : 4]);
  }
  p.sphere(cx, 57, 2, 2, PAL.gold, -0.05);
  // ombreiras pesadas: copa com aba erguida junto ao pescoço e lâminas
  for (const s of [-1, 1]) {
    const pc = cx + s * 21;
    const edge = (k, x) => 51 + k * 4.4 + 2 * (1 - clamp01(((x - pc) / 13) ** 2));
    for (let k = 2; k >= 1; k--) {
      const half = 12.6 + k * 0.8;
      p.fill(pc - half - 1, 44, pc + half + 1, 64, (x, y) => Math.abs(x - pc) <= half && y > edge(k - 1, x) - 1.5 && y <= edge(k, x), (x, y) => {
        const u = (x + 0.5 - pc) / half;
        let v = 0.08 + cylLight(u) * 0.42 + specBand(u, -0.5, 0.2) * 0.3 - k * 0.04;
        if (y + 0.5 - edge(k - 1, x + 0.5) < 1.4) v -= 0.25;
        if (edge(k, x + 0.5) - (y + 0.5) < 1) v += 0.25; // borda dobrada
        return pick(BLACK_STEEL, v, x, y);
      });
    }
    p.fill(pc - 14, 38, pc + 14, 56, (x, y) => Math.abs(x - pc) <= 12.6 && y <= edge(0, x) && (((x - pc) / 12.6) ** 2 + ((y - 50.5) / 10) ** 2 <= 1 || y > 50.5), (x, y) => {
      const u = (x + 0.5 - pc) / 12.6, w = (y + 0.5 - 47) / 9;
      if (edge(0, x + 0.5) - (y + 0.5) < 1) return PAL.gold[u < -0.3 ? 3 : 2];
      const spec = clamp01(1 - Math.hypot(u + 0.4, w + 0.4) / 0.3);
      let v = 0.08 + sphereLight(u * 0.95, w) * 0.48 + spec * 0.42;
      if (Math.hypot(u, w * 1.05) > 0.86 && y < 48) v += 0.12 + rim(x, y) * 0.5; // luz do poente na borda
      return pick(BLACK_STEEL, v, x, y);
    });
    for (const dx of [-7, 0, 7]) p.set(pc + dx, Math.round(edge(0, pc + dx)) - 2, PAL.gold[dx < 0 ? 4 : 2]);
  }
  // fivelas de ouro prendendo a capa, com uma corrente entre elas
  for (let i = 0; i <= 12; i++) {
    const u = -1 + i / 6, x = cx + u * 8, y = 47.5 + (1 - u * u) * 2.6;
    p.set(x, y, PAL.gold[i & 1 ? 2 : 4]);
  }
  for (const bx of [23.5, 40.5]) {
    p.sphere(bx, 46.5, 2.2, 2.2, PAL.gold, 0.08);
    p.set(Math.floor(bx), 46, RUBY[3]);
  }

  // cabelo escuro bem curto atrás das orelhas
  p.fill(20, 15, 44, 34, (x, y) => ((x - cx) / 10.6) ** 2 + ((y - 28) / 12) ** 2 <= 1 && y < 33, (x, y) =>
    pick(RAVEN_HAIR, 0.2 + sphereLight((x + 0.5 - 30) / 10.6, (y + 0.5 - 22) / 10) * 0.7 + (hash(x, y, 13) - 0.5) * 0.2, x, y));
  // orelhas
  p.sphere(22.3, 31, 1.9, 2.9, PAL.skin, -0.05);
  p.sphere(41.7, 31, 1.9, 2.9, PAL.skin, -0.25);
  p.set(22, 31, PAL.skin[1]);
  p.set(41, 31, PAL.skin[1]);
  // rosto de queixo quadrado, maçãs marcadas
  p.fill(20, 17, 44, 43, CONQ_HEAD, (x, y) => {
    const nx = (x + 0.5 - 31) / 9.8, ny = (y + 0.5 - 29) / 12;
    let v = 0.38 + sphereLight(nx, ny) * 0.7;
    if (y > 33 && y < 37 && Math.abs(nx) > 0.5) v -= 0.14; // maçãs fundas
    return pick(PAL.skin, v, x, y, 6);
  });
  // barba curta e aparada, das costeletas ao queixo, e bigode fino
  const inBeard = (x, y) => (CONQ_HEAD(x, y) && ((y > 31 && Math.abs(x - cx) > 8 - (y - 31) * 0.3) || y > 40.2 ||
    (y > 35.8 && y < 37.4 && Math.abs(x - cx) < 4.6))) || (y > 41 && y < 44.2 && Math.abs(x - cx) < 6 - (y - 41) * 0.7);
  p.fill(20, 30, 44, 45, inBeard, (x, y) => {
    let v = 0.22 + sphereLight((x + 0.5 - 30) / 10, (y + 0.5 - 36) / 9) * 0.6 + (hash(x, y, 14) - 0.5) * 0.12;
    if ((x + y * 2) % 3 === 0) v -= 0.12;
    return pick(RAVEN_HAIR, v, x, y);
  });
  // franja curta e reta
  p.fill(21, 16, 43, 25, (x, y) => CONQ_HEAD(x, y) && y < 22.6 - Math.abs(x - cx) * 0.05 + (Math.floor(x) % 3 === 0 ? 0.7 : 0), (x, y) =>
    pick(RAVEN_HAIR, 0.3 + sphereLight((x + 0.5 - 30) / 10, (y + 0.5 - 18) / 8) * 0.6 + ((x * 3) % 4 === 0 ? -0.15 : 0), x, y));
  // sobrancelhas carregadas, descendo para o meio
  for (const [x, y] of [[24, 26], [25, 26], [26, 26], [27, 27], [28, 27], [29, 28], [25, 27], [26, 27]]) {
    p.set(x, y, RAVEN_HAIR[1]);
    p.set(63 - x, y, RAVEN_HAIR[0]);
  }
  p.set(31, 27, PAL.skin[2]);
  p.set(32, 27, PAL.skin[1]);
  paintHardEyes(p, false);
  paintNose(p, 31, 31);
  // boca firme, com os cantos para baixo
  for (let x = 29; x <= 34; x++) p.set(x, 38, PAL.skin[0]);
  p.set(28, 39, RAVEN_HAIR[1]);
  p.set(35, 39, RAVEN_HAIR[0]);
  for (let x = 29; x <= 34; x++) p.set(x, 39, PAL.skin[x < 31 ? 3 : 2]);
  p.set(31, 40, PAL.skin[1]);
  p.set(32, 40, PAL.skin[1]);
  // cicatriz cruzando a sobrancelha
  for (const [x, y] of [[36, 24], [37, 25], [37, 26], [38, 27], [39, 31], [39, 32], [40, 33]]) p.set(x, y, PAL.skin[5]);
  for (const [x, y] of [[37, 24], [38, 25], [38, 26], [40, 32]]) p.set(x, y, PAL.skin[1]);

  p.outline(PAL.out);
  p.blit(buildLaurel(), 0, 0);
  return p;
}

// Olhos estreitos sob as pálpebras pesadas.
function paintHardEyes(p, closed) {
  for (const [x0, left] of [[25, true], [36, false]]) {
    for (let i = 0; i < 3; i++) p.set(x0 + i, 29, RAVEN_HAIR[0]);
    if (closed) {
      for (let i = 0; i < 3; i++) p.set(x0 + i, 30, PAL.skin[2]);
      continue;
    }
    const row = left ? [PAL.eyeWhite, C('#3a2a1e'), PAL.out] : [PAL.out, C('#3a2a1e'), PAL.eyeWhite];
    row.forEach((c, i) => p.set(x0 + i, 30, c));
    p.set(x0 + (left ? 1 : 1), 30, C('#6a4a30'));
  }
  for (const x of [25, 26, 27, 36, 37, 38]) p.set(x, 31, PAL.skin[2]);
}

// Ponta da capa esvoaçando para a esquerda, por trás do ombro (pose fixa na silhueta).
function paintCapeTail(p, t, amp) {
  for (let x = 0; x <= 14; x++) {
    const k = 1 - x / 14; // 0 no ombro, 1 na ponta
    const wave = Math.sin(t * 3.4 - x * 0.55) * amp * k;
    const top = 39 - k * 7 + wave, bot = 50 - k * 5 + wave * 0.6 + Math.sin(t * 2.3 - x * 0.4) * amp * 0.5 * k;
    for (let y = Math.floor(top); y <= bot; y++) {
      if (x < 2 && (y - top) % 4 > 2.6) continue; // pontas recortadas
      const fold = Math.sin((y - top) * 1.1 + x * 0.35 - t * 2) * 0.14;
      const edge = y === Math.floor(top) || y >= Math.floor(bot);
      p.set(x, y, edge ? PAL.out : pick(CAPE, 0.36 + fold + (1 - k) * 0.08 - (y - top) * 0.012, x, y));
    }
  }
}

const conquerorArt = { bg: null, body: null, banners: null, gold: null, frame: new Pix(64, 64) };

function paintConquerorPortrait(ctx, t, info) {
  const a = conquerorArt;
  if (!a.bg) {
    a.bg = buildConquerorBackdrop();
    a.body = buildConqueror();
    a.banners = [buildTatteredBanner(10, 13, PAL.banner, 3), buildTatteredBanner(8, 10, SMOKE, 8)];
    a.gold = rampPixels(a.body, PAL.gold, 16, 14, 48, 30);
  }
  const live = info.working ? 1 : 0.5;
  const f = a.frame.copyFrom(a.bg);
  // fumaça nova saindo das fogueiras do campo
  for (const [bx, by] of CONQ_SMOKE) {
    for (let k = 0; k < 4; k++) {
      const s = (t * (0.1 + live * 0.05) + k / 4 + bx * 0.01) % 1;
      const x = bx - s * 5 + Math.sin(s * 6 + k + bx) * 0.8, y = by - 1 - s * 11, r = 1 + s * 2.4;
      for (let yy = Math.floor(y - r); yy <= y + r; yy++) {
        for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
          const dd = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / r;
          if (dd <= 1 && bayer(xx, yy) < (1 - s) * (1.1 - dd * 0.6)) f.set(xx, yy, SMOKE[dd < 0.5 ? 3 : 2]);
        }
      }
    }
    const fl = Math.sin(t * 11 + bx) * 0.5 + 0.5;
    f.set(bx, by, PAL.fire[fl > 0.5 ? 5 : 4]);
    f.set(bx - 1, by, PAL.fire[3]);
    f.set(bx + 1, by, PAL.fire[fl > 0.3 ? 3 : 2]);
    if (fl > 0.6) f.set(bx, by - 1, PAL.fire[3]);
  }
  // estandartes rasgados tremulando para a esquerda
  drawFlag(f, a.banners[0], 39, 7, t * (1 + live * 0.5), 1.3);
  drawFlag(f, a.banners[1], 50, 12, t * (1.1 + live * 0.5) + 2, 1.1);
  paintCapeTail(f, t, 0.8 + live * 0.8);
  f.blit(a.body, 0, 0);
  if (t % 6.3 > 6.17) paintHardEyes(f, true);
  // brasas subindo
  for (let k = 0; k < (info.working ? 10 : 5); k++) {
    const life = (t * (0.18 + hash(k, 1, 31) * 0.12) + hash(k, 2, 31)) % 1;
    const x = 64 - (hash(k, 3, 31) * 50 + life * 22) + Math.sin(t * 2 + k) * 1.5, y = 66 - life * 64;
    f.set(x, y, PAL.fire[life < 0.4 ? 5 : life < 0.75 ? 4 : 2]);
  }
  // brilho correndo pelos louros
  const period = info.working ? 3.2 : 5.2;
  sweepGlint(f, a.gold, PAL.gold, ((t % period) / 1.3) * 34 + 18, 2);
  f.draw(ctx);
}

function buildConquerorSilhouette() {
  const p = buildConqueror();
  paintCapeTail(p, 0, 0.8);
  return p;
}

function iconConqueror() {
  const p = new Pix(16, 16);
  // capa vermelha e ombros de aço negro
  p.ellipse(8, 17, 8, 5.5, (x, y) => CAPE[y < 13 ? 4 : 3]);
  p.ellipse(8, 17.6, 6.2, 4.4, (x) => BLACK_STEEL[x < 6 ? 5 : x < 10 ? 4 : 3]);
  const head = headTest(8, 8.6, 4.2, 5.2, 0.12);
  p.fill(1, 1, 15, 15, head, (x, y) =>
    pick(PAL.skin, 0.36 + sphereLight((x + 0.5 - 7.5) / 4.2, (y + 0.5 - 7.5) / 5.2) * 0.72, x, y, 3));
  // cabelo, barba curta e olhar duro
  p.rect(5, 3, 6, 2, RAVEN_HAIR[2]);
  p.fill(1, 8, 15, 15, (x, y) => head(x, y) && (y > 11 || (Math.abs(x - 8) > 3 && y > 9)), (x, y) => RAVEN_HAIR[x < 8 ? 3 : 2]);
  p.rect(6, 10, 4, 1, RAVEN_HAIR[2]);
  p.rect(6, 11, 4, 1, PAL.skin[1]);
  p.rect(5, 7, 2, 1, RAVEN_HAIR[0]); p.rect(9, 7, 2, 1, RAVEN_HAIR[0]);
  p.set(7, 7, RAVEN_HAIR[1]); p.set(8, 7, RAVEN_HAIR[1]);
  p.set(6, 8, PAL.out); p.set(9, 8, PAL.out);
  // louros de ouro: ramo na testa e folhas saindo pelos lados
  p.rect(4, 5, 8, 1, (x) => PAL.gold[x < 8 ? 4 : 3]);
  for (const [x, y, k] of [[4, 4, 5], [6, 4, 4], [9, 4, 4], [11, 4, 3], [3, 5, 4], [2, 4, 5], [2, 6, 4], [12, 5, 3], [13, 4, 4], [13, 6, 3], [1, 5, 4], [14, 5, 3]]) p.set(x, y, PAL.gold[k]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Lenda

const LEGEND_SKY = ramp('#120c26', '#1e163a', '#30204e', '#4a2a62', '#6e366c', '#9a466e', '#c8626a', '#eb946c', '#fbcc86');
const RUIN = ramp('#221c2e', '#362c42', '#4e4054', '#6c5864', '#8e746e', '#b4927e', '#d8b494');
const SAPPHIRE = ramp('#0a1440', '#162c7c', '#2850bc', '#4c84ea', '#b0d0ff');
const AURA = [C('#f6c27a'), C('#fde6a6'), C('#fff8e0')];
const DUSK_GRASS = ramp('#16182a', '#222a34', '#2e3e38', '#44543c', '#5e6a40', '#808046', '#a69452');
const LEG_C = [32, 19]; // centro da guarda, de onde saem os raios
const legendHill = (x) => 49.5 + ((x - 32) / 30) ** 2 * 10.5;
const LEG_RUNES = [[26, 46], [29, 47], [35, 47], [38, 46]];

function buildLegendBackdrop() {
  const p = new Pix(64, 64);
  const [cx, cy] = LEG_C;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const glow = clamp01(1 - Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 0.9) / 30);
      p.d[y * 64 + x] = pick(LEGEND_SKY, 0.04 + (y / 52) * 0.8 + glow * glow * 0.3, x, y, 2.2);
    }
  }
  // nuvens escuras abrindo em volta da espada
  for (const [ncx, ncy, w] of [[8, 9, 13], [56, 6, 12], [50, 15, 9], [14, 20, 8], [30, 3, 7]]) {
    for (let y = ncy - 2; y <= ncy + 1; y++) {
      for (let x = Math.floor(ncx - w); x <= ncx + w; x++) {
        const u = (x + 0.5 - ncx) / w;
        if (Math.abs(y + 0.5 - ncy) > (1 - u * u) * 2.2) continue;
        const lit = clamp01(1 - Math.hypot(x - cx, y - cy) / 26);
        p.set(x, y, pick(LEGEND_SKY, 0.16 + (y + 0.5 - ncy) * 0.12 + lit * 0.5, x, y, 2));
      }
    }
  }
  // serras distantes atrás da colina, com o resto do poente
  for (let x = 0; x < 64; x++) {
    const top = Math.round(45 + Math.abs(Math.sin(x * 0.19 + 0.6)) * 3 - Math.sin(x * 0.07) * 2);
    for (let y = top; y < 64; y++) p.set(x, y, pick(PURPLE_HILLS, (y === top ? 0.85 : 0.5) - (y - top) * 0.04, x, y));
  }
  return p;
}

// Ruínas em volta: coluna partida à esquerda, pedaço de arco à direita.
function paintRuins(p) {
  const [cx, cy] = LEG_C;
  const warm = (x, y) => clamp01(1 - Math.hypot(x - cx, y - cy - 10) / 34) * 0.3;
  // coluna canelada, quebrada no alto
  const colTop = (x) => 21 + Math.abs(Math.sin(x * 2.1)) * 3 + (x > 7 ? 2 : 0);
  p.fill(2, 18, 12, 60, (x, y) => Math.abs(x - 7) <= 4 && y >= colTop(Math.floor(x)) && y <= legendHill(x) + 1, (x, y) => {
    const nx = (x + 0.5 - 7) / 4;
    let v = 0.12 + cylLight(nx) * 0.55 + warm(x, y) * (nx > 0 ? 1.2 : 0.4);
    if ((x - 3) % 2 === 1) v -= 0.1; // caneluras
    if (y % 9 === 0) v -= 0.18; // tambores
    if (hash(x, y, 41) < 0.05) v -= 0.2;
    return pick(RUIN, v, x, y);
  });
  p.rect(1, 22 + 0, 0, 0, RUIN[0]);
  // capitel caído na base da coluna
  p.fill(10, 52, 20, 58, (x, y) => Math.abs(x + 0.5 - 15) <= 4.6 && y >= 53 && y <= legendHill(x) + 1.5, (x, y) =>
    pick(RUIN, 0.25 + (y === 53 ? 0.35 : 0) + warm(x, y) + ((x + y) % 3 === 0 ? -0.08 : 0), x, y));
  // hera subindo pela coluna
  for (let k = 0; k < 14; k++) {
    const y = 50 - k * 2 + Math.round(hash(k, 1, 42) * 2), x = 4 + Math.round(Math.sin(k * 0.9) * 1.5 + hash(k, 2, 42));
    p.set(x, y, PAL.herb[2 + (k % 3)]);
    p.set(x + 1, y + 1, PAL.herb[1 + (k % 2)]);
  }
  // pilar e arco quebrado
  p.fill(51, 22, 61, 60, (x, y) => x >= 52 && x <= 59 && y >= 26 && y <= legendHill(x) + 1, (x, y) => {
    const row = Math.floor((y - 26) / 4), off = (row % 2) * 3;
    let v = 0.18 + ((59 - x) / 7) * 0.12 + (x === 52 ? 0.25 : 0) + warm(x, y);
    if ((y - 26) % 4 === 3 || (x + off) % 6 === 0) v -= 0.15;
    return pick(RUIN, v, x, y);
  });
  p.fill(40, 10, 61, 30, (x, y) => {
    const d = Math.hypot(x - 46, y - 31);
    return d >= 9 && d <= 13.5 && y < 28 && x > 46.5 - (y - 18) * 0.25 + Math.abs(Math.sin(y * 1.7)) * 1.5 && x < 61;
  }, (x, y) => {
    const a = Math.atan2(y - 31, x - 46), d = Math.hypot(x + 0.5 - 46, y + 0.5 - 31);
    let v = 0.25 + (d < 10 ? 0.3 : 0) + warm(x, y) * 0.8;
    if (Math.floor(a * 6) % 2 === 0 && Math.abs(Math.sin(a * 6 * Math.PI / Math.PI)) < 0.25) v -= 0.18;
    if (Math.abs(((a * 180 / Math.PI + 360) % 14) - 7) > 6) v -= 0.18; // aduelas
    return pick(RUIN, v, x, y);
  });
  // bloco caído perto da pedra
  p.fill(45, 50, 52, 57, (x, y) => x >= 46 && x <= 51 && y >= 52 && y <= legendHill(x) + 1, (x, y) =>
    pick(RUIN, 0.3 + (y === 52 ? 0.3 : 0) + (x === 46 ? 0.1 : 0) + warm(x, y), x, y));
}

function buildLegendStone() {
  const p = new Pix(64, 64);
  const [cx] = LEG_C;
  // topo da colina, com capim
  p.fill(0, 44, 63, 63, (x, y) => y >= legendHill(x), (x, y) => {
    let v = 0.14 + sphereLight((x + 0.5 - 26) / 40, (y + 0.5 - 70) / 24) * 0.55 + clamp01(1 - Math.hypot(x - cx, y - 50) / 18) * 0.3;
    if (y < legendHill(x + 0.5) + 1) v += 0.18; // crista acesa pela espada
    if (hash(x, y, 51) < 0.09) v += 0.2; // tufos
    else if (hash(x, y - 1, 51) < 0.09) v -= 0.18;
    return pick(DUSK_GRASS, v, x, y, 1.6);
  });
  // florzinhas no capim
  for (const [x, y, c] of [[12, 60, '#e8c4a0'], [50, 59, '#f0a070'], [24, 58, '#e8c4a0'], [42, 61, '#d4706a'], [7, 62, '#f0a070']]) p.set(x, y, C(c));
  // pedra rachada com musgo e runas entalhadas
  const rock = [[19.5, 54], [20.5, 46], [23.5, 41.5], [28.5, 38.6], [36, 38.4], [41, 41], [44, 46.5], [45.5, 54]];
  p.poly(rock, (x, y) => {
    const nx = (x + 0.5 - 31) / 13, ny = (y + 0.5 - 42) / 12;
    // faces lascadas: blocos de luz diferente
    const facet = hash(Math.floor((x + y * 0.6) / 5), Math.floor((y - x * 0.4) / 4), 52);
    let v = 0.06 + sphereLight(nx, ny) * 0.72 + (facet - 0.5) * 0.22 + clamp01(1 - Math.hypot(x - cx, y - 39) / 9) * 0.32;
    if (y > 50) v -= (y - 50) * 0.06;
    if (hash(x, y, 53) < 0.06) v -= 0.15;
    return pick(PAL.stone, v, x, y);
  });
  for (const [x0, y0, x1, y1] of [[24, 43, 27, 47], [27, 47, 26, 51], [40, 43, 38, 46], [38, 46, 39, 50], [33, 40, 34, 43]]) p.line(x0, y0, x1, y1, PAL.stone[0]);
  for (const [x, y] of [[25, 43], [28, 47], [41, 43], [39, 46], [34, 40]]) p.set(x, y, PAL.stone[4]);
  for (const [x, y] of [[22, 44], [23, 43], [24, 42], [25, 42], [21, 46], [22, 45], [26, 41], [27, 40]]) p.set(x, y, PAL.herb[(x + y) % 2 ? 3 : 2]);
  for (const [x, y] of LEG_RUNES) {
    p.set(x, y, PAL.stone[0]); p.set(x, y + 1, PAL.stone[0]); p.set(x + 1, y + 2, PAL.stone[0]);
  }
  // fenda onde a lâmina entra
  p.rect(30, 38, 5, 1, PAL.stone[0]);
  p.outline(PAL.out);
  return p;
}

function buildLegendSword() {
  const p = new Pix(64, 64);
  const cx = LEG_C[0];
  // lâmina com a nervura no meio
  p.fill(29, 20, 35, 39, (x) => x >= 30 && x <= 34, (x, y) => {
    if (x === 30) return PAL.steel[5];
    if (x === 31) return PAL.steel[4];
    if (x === 32) return PAL.steel[y % 6 === 0 ? 4 : 2];
    if (x === 33) return PAL.steel[3];
    return PAL.steel[1];
  });
  // guarda de ouro em meia-lua, com as pontas subindo para o cabo
  for (let x = 24; x <= 41; x++) {
    const u = (x + 0.5 - 32.5) / 9;
    const y = Math.round(19.2 - u * u * 4.2);
    p.set(x, y, PAL.gold[x < cx ? 5 : 4]);
    p.set(x, y + 1, PAL.gold[x < cx ? 3 : 2]);
    if (Math.abs(u) < 0.5) p.set(x, y + 2, PAL.gold[1]);
  }
  p.sphere(23.6, 14.6, 1.3, 1.3, PAL.gold, 0.15);
  p.sphere(41.4, 14.6, 1.3, 1.3, PAL.gold, -0.05);
  p.rect(29, 17, 7, 4, (x, y) => PAL.gold[y === 17 ? 5 : x < cx ? 4 : 2]);
  p.rect(31, 18, 3, 2, (x, y) => RUBY[x === 31 && y === 18 ? 4 : x < 33 ? 3 : 2]);
  // empunhadura de couro com fio de ouro
  p.rect(31, 10, 3, 7, (x, y) => ((x + y) % 3 === 0 ? PAL.gold[3] : PAL.leather[x === 31 ? 3 : 1]));
  // pomo com safira
  p.sphere(32.5, 8, 2.6, 2.4, PAL.gold, 0.1);
  p.set(32, 7, SAPPHIRE[4]);
  p.set(33, 7, SAPPHIRE[2]);
  p.set(32, 8, SAPPHIRE[3]);
  p.set(33, 8, SAPPHIRE[1]);
  p.outline(PAL.out);
  return p;
}

function buildLegend() {
  const p = new Pix(64, 64);
  paintRuins(p);
  p.outline(PAL.out);
  p.blit(buildLegendStone(), 0, 0);
  p.blit(buildLegendSword(), 0, 0);
  return p;
}

const legendArt = { bg: null, body: null, rays: null, aura: null, rim: null, blade: null, table: new Float32Array(256), frame: new Pix(64, 64) };

function paintLegendPortrait(ctx, t, info) {
  const a = legendArt;
  const [cx, cy] = LEG_C;
  if (!a.bg) {
    a.bg = buildLegendBackdrop();
    a.body = buildLegend();
    // raios: cada pixel do céu guarda o ângulo (256 fatias) e um limiar pela distância
    const idx = [], bin = [], th = [], col = [];
    const auraIdx = [], auraTh = [], auraCol = [];
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 64; x++) {
        const i = y * 64 + x;
        if (a.body.d[i]) continue;
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.05);
        if (d < 46) {
          idx.push(i);
          bin.push(Math.floor(((Math.atan2(y + 0.5 - cy, x + 0.5 - cx) / (Math.PI * 2)) + 1) * 256) & 255);
          th.push(0.25 + (d / 46) * 0.75 + (bayer(x, y) - 0.5) * 0.3);
          const k = LEGEND_SKY.indexOf(a.bg.d[i]);
          col.push(LEGEND_SKY[Math.min(LEGEND_SKY.length - 1, (k < 0 ? 4 : k) + 2)]);
        }
        const da = Math.hypot((x + 0.5 - cx) * 1.15, (y + 0.5 - cy - 3) * 0.85);
        if (da < 12) {
          auraIdx.push(i);
          auraTh.push(da / 12 + (bayer(x, y) - 0.5) * 0.4);
          auraCol.push(AURA[da < 4 ? 2 : da < 8 ? 1 : 0]);
        }
      }
    }
    a.rays = { idx: Int32Array.from(idx), bin: Uint8Array.from(bin), th: Float32Array.from(th), col: Uint32Array.from(col) };
    a.aura = { idx: Int32Array.from(auraIdx), th: Float32Array.from(auraTh), col: Uint32Array.from(auraCol) };
    // anel fino de luz por fora do contorno da espada
    const sword = buildLegendSword();
    const rim = [];
    for (let y = 0; y < 38; y++) {
      for (let x = 18; x < 47; x++) {
        if (a.body.get(x, y)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => sword.get(x + dx, y + dy) === PAL.out)) rim.push(y * 64 + x);
      }
    }
    a.rim = Int32Array.from(rim);
    a.blade = rampPixels(a.body, PAL.steel, 29, 19, 35, 38);
  }
  const live = info.working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  const d = f.d;
  // nove raios girando devagar em volta da espada
  const tb = a.table;
  const rot = t * (0.12 + live * 0.1);
  for (let b = 0; b < 256; b++) {
    const v = Math.sin((b / 256) * Math.PI * 2 * 9 + rot * Math.PI * 2);
    tb[b] = v > 0 ? v * v * (0.75 + live * 0.25) : 0;
  }
  const R = a.rays;
  for (let k = 0; k < R.idx.length; k++) if (tb[R.bin[k]] > R.th[k]) d[R.idx[k]] = R.col[k];
  // aura pulsando
  const level = 0.45 + live * 0.22 + Math.sin(t * 2.2) * 0.12 + Math.sin(t * 5.3) * 0.04;
  const A = a.aura;
  for (let k = 0; k < A.idx.length; k++) if (A.th[k] < level) d[A.idx[k]] = A.col[k];
  f.blit(a.body, 0, 0);
  // contorno da espada aceso
  const rimC = Math.sin(t * 2.2) > 0.3 ? AURA[1] : AURA[0];
  for (let k = 0; k < a.rim.length; k++) d[a.rim[k]] = rimC;
  // runas acendendo uma a uma
  LEG_RUNES.forEach(([x, y], i) => {
    const e = pulse(t, 2.4, -i * 0.35, 1.1);
    if (e > 0.2) {
      const c = e > 0.6 ? AURA[2] : AURA[0];
      f.set(x, y, c); f.set(x, y + 1, c); f.set(x + 1, y + 2, c);
    }
  });
  // brilho subindo pela lâmina e a safira cintilando
  const period = info.working ? 2.4 : 3.6;
  const ph = t % period;
  sweepGlint(f, a.blade, PAL.steel, 60 - ph * 30, 1.6);
  sparkle(f, 32, 7, pulse(ph, 99, -1.6, 0.6), true);
  sparkle(f, 31, 18, pulse(ph, 99, -2.1, 0.45));
  // partículas de luz subindo da pedra
  const n = info.working ? 16 : 9;
  for (let k = 0; k < n; k++) {
    const life = (t * (0.12 + hash(k, 1, 61) * 0.1) + hash(k, 2, 61)) % 1;
    const x = 22 + hash(k, 3, 61) * 20 + Math.sin(t * 1.4 + k * 1.7) * (2 + life * 3);
    const y = 50 - life * 48;
    f.set(x, y, life < 0.35 ? AURA[2] : life < 0.7 ? AURA[1] : AURA[0]);
    if (life < 0.25) f.set(x, y + 1, AURA[0]);
  }
  f.draw(ctx);
}

function iconLegend() {
  const p = new Pix(16, 16);
  // pedra
  p.poly([[1.5, 16], [2.5, 12], [5, 10], [11, 10], [13.5, 12], [14.5, 16]], (x, y) => pick(PAL.stone, 0.75 - (x - 2) * 0.04 - (y - 10) * 0.05, x, y));
  // lâmina, guarda e cabo
  p.rect(7, 4, 2, 7, (x) => PAL.steel[x === 7 ? 5 : 3]);
  p.rect(5, 4, 6, 1, (x) => PAL.gold[x < 8 ? 5 : 3]);
  p.set(4, 3, PAL.gold[5]);
  p.set(11, 3, PAL.gold[3]);
  p.rect(7, 1, 2, 3, (x, y) => (y === 2 ? PAL.gold[3] : PAL.leather[x === 7 ? 3 : 2]));
  p.rect(7, 0, 2, 1, PAL.gold[4]);
  p.outline(PAL.out);
  // brilho em volta
  for (const [x, y] of [[2, 1], [13, 1], [2, 7], [13, 7], [5, 0], [10, 0]]) if (!p.get(x, y)) p.set(x, y, AURA[1]);
  return p;
}

ART.portraits.marshal = paintMarshalPortrait;
ART.locked.marshal = ART.silhouette(buildMarshal);
ART.portraits.armada = paintArmadaPortrait;
ART.locked.armada = ART.silhouette(buildArmada);
ART.portraits.legion = paintLegionPortrait;
ART.locked.legion = ART.silhouette(buildLegion);
ART.portraits.conqueror = paintConquerorPortrait;
ART.locked.conqueror = ART.silhouette(buildConquerorSilhouette);
ART.portraits.legend = paintLegendPortrait;
ART.locked.legend = ART.silhouette(buildLegend);
Object.assign(ART.icons, { marshal: iconMarshal, armada: iconArmada, legion: iconLegion, conqueror: iconConqueror, legend: iconLegend });
})();
