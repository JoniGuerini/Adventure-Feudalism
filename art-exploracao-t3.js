'use strict';
// Linha da exploração, tiers 3 a 6: Cartógrafo (faz acampamentos), Posto avançado
// (faz cartógrafos), Caravana (faz postos) e Desbravador (faz caravanas).
// Retratos animados, silhuetas bloqueadas e ícones.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

// gabinete do cartógrafo
const PANEL = ramp('#130c09', '#1f150f', '#2d1f16', '#3e2b1e', '#523a28', '#6a4c33', '#865f3f');
const PARCH = ramp('#4a3420', '#7a5a36', '#a88452', '#ceac74', '#e8d29e', '#f8ecc8');
const SEA_WASH = ramp('#6a7a66', '#8e9c84', '#b0b89c', '#ccd0b2', '#e2e2c6');
const INK = C('#3a2416');
const ROUTE = C('#b03a2a');
const COAT = ramp('#081a20', '#0f2c34', '#164049', '#1f5760', '#2c7078', '#438c8c');
const FELT = ramp('#1e1610', '#36281c', '#54402c', '#76593c', '#987650', '#b89468', '#d4b284');
const QUILL = ramp('#5e5446', '#968872', '#c6b89a', '#e8dec4', '#fbf6e8');
const OCEAN = ramp('#10284a', '#1a3e6a', '#2a5a8c', '#4278aa', '#6a9ec4', '#9cc4dc');
const LAND = ramp('#3e3418', '#6a5a2a', '#968240', '#bca85c', '#dccb84', '#f2e6b0');
const DARK_HAIR = ramp('#1e0f09', '#3a1d0f', '#5c3016', '#80461f', '#a3602c', '#c27e40');

// posto avançado
const FOREST_FAR = ramp('#22403e', '#2e524a', '#3e6658', '#527a68', '#6a9078');
const LOG = ramp('#1e120b', '#352015', '#51321f', '#70482b', '#90613a', '#ad7c4c');
const PENNANT = ramp('#0c3626', '#145238', '#1f6e48', '#32905c', '#52b074');
const SMOKE = ramp('#6c6a70', '#8e8c90', '#b0aeae', '#d2d0cc', '#eeece6');

const AX = 32.5; // eixo dos bustos (centro do pixel 32)
const WHITE = C('#ffffff');
const BIRD = C('#2b2a38');
const CUT = ramp('#a8845a', '#b8946a', '#d2b088'); // madeira recém-cortada

// ---------------------------------------------------------------------------
// Peças comuns

// Cabeça em elipse que afina no queixo.
const headTest = (hx, hy, rx, ry, taper = 0.3) => (x, y) => {
  const dy = (y - hy) / ry;
  const w = dy > 0 ? rx * (1 - taper * dy * dy) : rx;
  return ((x - hx) / w) ** 2 + dy * dy <= 1;
};

// Distância de (px, py) até a poligonal, o vetor do ponto mais próximo até ele e
// a posição ao longo do caminho (0 no início, 1 no fim).
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

// Envelope suave de um evento periódico: 0 fora da janela, sobe e desce dentro dela.
function pulse(t, period, offset, length) {
  const ph = (((t + offset) % period) + period) % period;
  return ph < length ? Math.sin((ph / length) * Math.PI) : 0;
}

// Fase que avança na velocidade do momento: trocar a velocidade (trabalhando ou
// parado) não dá salto na animação. Num salto grande de t, volta a t * rate.
function advance(a, key, t, rate) {
  const c = a[key] || (a[key] = { t, v: t * rate });
  const dt = t - c.t;
  c.v = dt >= 0 && dt < 0.5 ? c.v + dt * rate : t * rate;
  c.t = t;
  return c.v;
}

// Valor que desliza suavemente até o alvo (para luzes e chamas que crescem).
function ease(a, key, t, target, speed) {
  const c = a[key] || (a[key] = { t, v: target });
  const dt = t - c.t;
  c.v = dt >= 0 && dt < 0.5 ? c.v + (target - c.v) * Math.min(1, dt * speed) : target;
  c.t = t;
  return c.v;
}

// Estrelinha de brilho que cresce e some (e de 0 a 1).
function sparkle(f, x, y, e) {
  if (e <= 0.08) return;
  const arm = Math.round(e * 2.2);
  f.set(x, y, WHITE);
  for (let k = 1; k <= arm; k++) {
    const c = k === arm ? PAL.gold[5] : WHITE;
    f.set(x + k, y, c); f.set(x - k, y, c); f.set(x, y + k, c); f.set(x, y - k, c);
  }
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

// Luz que pulsa: guarda, para cada pixel que muda entre o fundo apagado e o
// aceso, um limiar. A cada quadro acendem os pixels com limiar abaixo do nível.
function makeHalo(base, lit, threshold) {
  const idx = [], th = [], col = [];
  for (let i = 0; i < 64 * 64; i++) {
    if (base.d[i] === lit.d[i]) continue;
    idx.push(i);
    th.push(threshold(i & 63, i >> 6) + (bayer(i & 63, i >> 6) - 0.5) * 0.3);
    col.push(lit.d[i]);
  }
  return { idx: Int32Array.from(idx), th: Float32Array.from(th), col: Uint32Array.from(col) };
}

// Recorta um Pix 64x64 no menor retângulo com pixels: { pix, x, y }.
function trim(p) {
  let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (!p.d[y * p.w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const out = new Pix(Math.max(1, x1 - x0 + 1), Math.max(1, y1 - y0 + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.d[(y - y0) * out.w + x - x0] = p.d[y * p.w + x];
  return { pix: out, x: x0, y: y0 };
}

// Pinheiro em camadas, com a luz pela esquerda. base é a linha do chão.
function drawPine(p, cx, base, h, hw, r, bias, seed, tiers = 4.5) {
  const top = base - h;
  for (let y = Math.floor(top); y < base; y++) {
    const k = (y + 0.5 - top) / h;
    const tier = (k * tiers) % 1;
    const w = hw * (0.1 + 0.9 * k) * (0.55 + 0.45 * tier);
    for (let x = Math.floor(cx - w); x <= cx + w; x++) {
      const u = (x + 0.5 - cx) / Math.max(0.8, w);
      let v = 0.42 + bias - u * 0.28 + (tier > 0.8 ? -0.16 : tier < 0.3 ? 0.08 : 0) + (hash(x, y, seed) - 0.5) * 0.28;
      if (Math.abs(u) > 0.8 && hash(x, y, seed + 1) < 0.35) continue; // ponta dos galhos rendada
      p.set(x, y, pick(r, v, x, y, 1.6));
    }
  }
}

// Bandeira tremulando presa no mastro (px, py), desenhada no buffer q e colada em f.
function paintPennant(f, q, px, py, len, h, ph, amp, r, mark) {
  q.clear();
  for (let i = 0; i < len; i++) {
    const s = Math.sin(ph - i * 0.75);
    const dy = s * amp * (i + 1) / len;
    const lit = Math.cos(ph - i * 0.75);
    const taper = Math.round((i / len) * (h - 2) * 0.5); // vai afinando para a ponta
    for (let j = taper; j < h - taper; j++) {
      const v = 0.58 + lit * 0.26 - j * 0.04 - i * 0.012;
      let c = pick(r, v, i, j, 3);
      if (mark && mark(i, j)) c = PAL.gold[lit > -0.3 ? 5 : 4];
      q.set(1 + i, 2 + j + dy, c);
    }
  }
  q.outline(PAL.out);
  for (let y = 0; y < q.h; y++) q.d[y * q.w] = 0; // não cobre o mastro
  f.blit(q, px, py - 2);
}

// ---------------------------------------------------------------------------
// Cartógrafo

const WIN = { cx: 11.5, half: 8, top: 3, sill: 33, horizon: 21 };
const inWin = (x, y, g = 0) => {
  const h = WIN.half + g, top = WIN.top - g;
  if (y > WIN.sill + g * 0.5 || y < top || Math.abs(x - WIN.cx) > h) return false;
  const sy = top + h;
  return y >= sy || ((x - WIN.cx) / h) ** 2 + ((y - sy) / h) ** 2 <= 1;
};
const winBar = (x, y) => Math.floor(x) === 11 || Math.floor(y) === 17;
const GLOBE = [54.5, 20.5, 7.6];

// Terras do globo: continentes desenhados por ondas, numa grade de 64 longitudes.
const GLOBE_LON = 64, GLOBE_LAT = 24;
const globeLand = (() => {
  const m = new Uint8Array(GLOBE_LON * GLOBE_LAT);
  for (let j = 0; j < GLOBE_LAT; j++) {
    const b = ((j + 0.5) / GLOBE_LAT - 0.5) * Math.PI;
    for (let i = 0; i < GLOBE_LON; i++) {
      const a = (i / GLOBE_LON) * Math.PI * 2;
      const v = Math.sin(a * 2 + 0.6) * 0.6 + Math.sin(a * 3 - b * 2.2 + 2) * 0.5 + Math.sin(a * 5 + b * 3.1) * 0.25 + Math.cos(b * 2.4) * 0.2 - 0.3;
      m[j * GLOBE_LON + i] = Math.abs(b) > 1.25 ? 2 : v > 0 ? 1 : 0; // 2 = gelo
    }
  }
  return m;
})();

function buildCartographerBackdrop() {
  const p = new Pix(64, 64);
  const sky = new Uint8Array(64 * 64); // 1 = céu da janela, 2 = mar da janela
  // parede de tábuas, mais clara perto da janela
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const glow = clamp01(1 - Math.hypot(x - 12, (y - 18) * 0.8) / 44) ** 1.4;
      const board = Math.floor(x / 5);
      let v = 0.1 + glow * 0.62 + (hash(board, 0, 3) - 0.5) * 0.1 + (hash(x, y >> 2, 4) - 0.5) * 0.06;
      if (x % 5 === 0) v -= 0.12;
      else if (x % 5 === 1) v += 0.05;
      if (y === 40) v += 0.25; // rodameio
      else if (y === 41 || y === 39) v -= 0.12;
      p.d[y * 64 + x] = pick(PANEL, v, x, y, 2);
    }
  }
  // moldura da janela em arco e o peitoril
  p.fill(0, 0, 22, 36, (x, y) => inWin(x, y, 2) && !inWin(x, y), (x, y) =>
    pick(PAL.wood, 0.62 - (x - WIN.cx) * 0.03 - (y - 4) * 0.004 + (hash(x, y, 5) - 0.5) * 0.12, x, y));
  // vista do mar: céu, mar, um cabo verde e uma ilha ao longe
  p.fill(0, 0, 22, 36, (x, y) => inWin(x, y), (x, y) => {
    if (winBar(x + 0.5, y + 0.5)) return pick(PAL.wood, x === 11 ? 0.55 : 0.75, x, y);
    const i = y * 64 + x;
    if (y < WIN.horizon) {
      if (x < 7 && y >= 18 + Math.floor((x - 3) * 0.4) && y > 16) return pick(PAL.tree, 0.5 - (y - 17) * 0.1 + (x === 3 ? 0.15 : 0), x, y);
      sky[i] = 1;
      return pick(PAL.morning, 0.15 + (y - 3) / 18 * 0.8, x, y, 1.4);
    }
    if (y === WIN.horizon && x >= 14 && x <= 17) return pick(PAL.far, x === 14 ? 0.7 : 0.45, x, y);
    sky[i] = 2;
    return pick(PAL.water, 0.72 - (y - WIN.horizon) * 0.05 + (hash(x, y, 6) - 0.5) * 0.16, x, y, 1.6);
  });
  p.rect(1, 34, 22, 2, (x, y) => pick(PAL.wood, (y === 34 ? 0.82 : 0.32) - x * 0.008, x, y));

  // cesto de vime com mapas enrolados, embaixo da janela
  for (const [x, top] of [[0, 39], [3, 36], [6, 38]]) {
    p.rect(x, top, 3, 46 - top, (xx, y) => pick(PARCH, 0.2 + cylLight((xx + 0.5 - x - 1.5) / 1.6) * 0.75 - (y - top) * 0.01, xx, y));
    p.rect(x, top, 3, 1, (xx) => PARCH[xx === x + 1 ? 1 : xx === x ? 5 : 3]);
    p.rect(x, top + 3, 3, 1, (xx) => (xx === x + 2 ? C('#6a2018') : ROUTE));
  }
  p.fill(0, 44, 11, 54, (x, y) => y >= 44 && x <= 10 - (y - 44) * 0.15, (x, y) => {
    let v = 0.5 - x * 0.03 + (y === 44 ? 0.25 : 0);
    if ((x + (y >> 1) * 2) % 4 === 0) v -= 0.18; // trançado do vime
    return pick(PAL.wood, v, x, y);
  });

  // mesa ao fundo, com o globo e um mapa enrolado
  p.rect(40, 37, 24, 2, (x, y) => pick(PAL.wood, (y === 37 ? 0.8 : 0.55) - (x - 40) * 0.008, x, y));
  p.rect(40, 39, 24, 10, (x, y) => pick(PAL.wood, 0.22 - (y - 39) * 0.012 + (x % 8 === 0 ? -0.1 : 0), x, y));
  p.rect(58, 35, 6, 2, (x, y) => pick(PARCH, (y === 35 ? 0.75 : 0.45) - (x - 58) * 0.04, x, y));
  p.set(57, 35, PARCH[2]); p.set(57, 36, PARCH[1]);
  p.set(61, 35, ROUTE); p.set(61, 36, C('#7a2a20'));
  // pé do globo
  const [gx, gy, gr] = GLOBE;
  p.rect(53, 30, 3, 5, (x) => PAL.wood[x === 53 ? 4 : x === 54 ? 3 : 1]);
  p.ellipse(54.5, 36, 4.6, 1.4, (x, y) => PAL.wood[y < 36 ? 4 : 2]);
  p.rect(52, 33, 5, 1, (x) => PAL.gold[x < 54 ? 4 : 2]);
  // globo: o mar e as terras são pintados a cada quadro (ele gira)
  const globe = [];
  p.fill(gx - gr, gy - gr, gx + gr, gy + gr, (x, y) => Math.hypot(x - gx, y - gy) <= gr, (x, y) => {
    const nx = (x + 0.5 - gx) / gr, ny = (y + 0.5 - gy) / gr;
    const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
    const lon = Math.asin(Math.max(-1, Math.min(1, nx / Math.max(0.05, Math.cos(lat)))));
    const light = 0.05 + sphereLight(nx, ny) * 1.0;
    globe.push(x, y, Math.round((lon / (Math.PI * 2)) * GLOBE_LON * 8), Math.floor((lat / Math.PI + 0.5) * GLOBE_LAT * 0.999), light);
    return OCEAN[2];
  });
  // anel de latão do meridiano e o horizonte de madeira
  p.fill(gx - gr - 3, gy - gr - 3, gx + gr + 3, gy + gr + 3, (x, y) => {
    const d = Math.hypot(x - gx, y - gy);
    return d > gr + 0.6 && d <= gr + 1.6 && y < gy + gr;
  }, (x, y) => PAL.gold[x < gx - 3 ? 4 : x < gx + 3 ? 3 : 2]);
  p.set(54, 11, PAL.gold[5]);
  p.fill(gx - gr - 3, gy, gx + gr + 3, gy + 3, (x, y) => ((x - gx) / (gr + 2.4)) ** 2 + ((y - gy - 1) / 1.6) ** 2 <= 1 &&
    !(((x - gx) / (gr + 0.4)) ** 2 + ((y - gy - 0.4) / 1.2) ** 2 <= 1), (x, y) => PAL.wood[y > gy + 1 ? 2 : x < gx ? 4 : 3]);
  p.rect(44, 21, 2, 9, (x) => PAL.wood[x === 44 ? 3 : 1]);
  p.rect(63, 21, 1, 9, PAL.wood[1]);
  p.rect(44, 29, 20, 1, PAL.wood[2]);
  p.globe = globe;
  p.sky = sky;
  return p;
}

// Mapa aberto na frente do peito: coordenadas (u, v) dentro do quadrilátero.
const MAP_TL = [9, 53.5], MAP_TR = [57, 52.5], MAP_BL = [3, 64.5], MAP_BR = [63, 64.5];
function mapUV(x, y) {
  const v = (y - MAP_TL[1]) / (MAP_BL[1] - MAP_TL[1]);
  const xl = MAP_TL[0] + (MAP_BL[0] - MAP_TL[0]) * v, xr = MAP_TR[0] + (MAP_BR[0] - MAP_TR[0]) * v;
  const yt = MAP_TL[1] + (MAP_TR[1] - MAP_TL[1]) * ((x - xl) / (xr - xl));
  return [(x - xl) / (xr - xl), (y - yt) / (MAP_BL[1] - yt)];
}
const mapLand = (x, y) => x < 20.5 + Math.sin(y * 0.9 + 1) * 1.6 - (y - 54) * 0.35 || ((x - 47.5) / 4.6) ** 2 + ((y - 56.2) / 2) ** 2 <= 1;

function buildCartographer() {
  const p = new Pix(64, 64);
  const mx = (pts) => pts.map(([x, y]) => [65 - x, y]);

  // casaco azul-petróleo
  p.poly([[0, 64], [1, 57], [6, 51.5], [15, 48], [24, 46.5], [41, 46.5], [50, 48], [59, 51.5], [64, 57], [65, 64]], (x, y) => {
    const nx = (x + 0.5 - AX) / 31;
    let v = 0.5 - nx * 0.4 - (y - 50) * 0.014;
    v += clamp01(1 - Math.hypot((x - 10) / 8, (y - 53) / 5)) * 0.22; // ombro iluminado
    if (x === 13 || x === 52) v -= 0.16; // costura da manga
    return pick(COAT, v, x, y);
  });
  // pescoço
  p.rect(27, 40, 11, 8, (x, y) => pick(PAL.skin, (y < 44 ? 0.14 : 0.3) - (x - 31) * 0.03, x, y));

  // cabelo escuro até o queixo
  p.fill(18, 18, 47, 44, (x, y) => ((x - AX) / 12.8) ** 2 + ((y - 31) / 12.6) ** 2 <= 1 && y < 42.5, (x, y) => {
    const nx = (x + 0.5 - AX) / 12.8, ny = (y + 0.5 - 30) / 12.6;
    let v = 0.12 + sphereLight(nx, ny) * 0.8 + Math.sin(x * 1.3 + y * 0.4) * 0.1 + (hash(x, y, 11) - 0.5) * 0.14;
    if (y > 40) v -= 0.12;
    return pick(DARK_HAIR, v, x, y, 1.6);
  });

  // gola de linho caída sobre os ombros, com renda na beirada
  const collar = [[AX, 45.5], [27, 44], [21.5, 47], [19, 51.6], [25, 53.4], [AX - 0.5, 50.8]];
  for (const [pts, dark] of [[collar, 0], [mx(collar), 1]]) {
    p.poly(pts, (x, y) => {
      const [d] = nearestOnPath([pts[3], pts[4], pts[5]], x + 0.5, y + 0.5);
      if (d < 1.1) return (x + y) % 2 ? PAL.linen[dark ? 3 : 4] : PAL.linen[dark ? 1 : 2]; // renda
      return pick(PAL.linen, 0.98 - dark * 0.2 - (y - 45) * 0.03 - Math.abs(x + 0.5 - AX) * 0.006, x, y);
    });
  }
  p.line(32, 46, 32, 51, PAL.linen[1]);

  // rosto
  const inHead = headTest(AX, 32, 10.4, 12.2);
  p.fill(21, 19, 44, 45, inHead, (x, y) => {
    let v = 0.36 + sphereLight((x + 0.5 - AX) / 10.4 * 0.8, (y + 0.5 - 32) / 12.2 * 0.5 - 0.12) * 0.7;
    if (y < 27) v -= 0.26; // sombra da aba
    else if (y < 28) v -= 0.12;
    return pick(PAL.skin, v, x, y, 6);
  });
  // mechas caindo dos lados do rosto
  p.fill(18, 24, 47, 42, (x, y) => inHead(x, y) && Math.abs(x - AX) > 8.6 - (y > 36 ? (y - 36) * 0.15 : 0) && y < 39, (x, y) =>
    pick(DARK_HAIR, 0.3 + sphereLight((x + 0.5 - AX) / 11, 0) * 0.5 + (hash(x, y, 12) - 0.5) * 0.2, x, y));

  // sobrancelhas finas e arqueadas
  for (const [x, y] of [[25, 28], [26, 27], [27, 27], [28, 27], [29, 28]]) {
    p.set(x, y, DARK_HAIR[1]);
    p.set(64 - x, y, DARK_HAIR[1]);
  }
  paintEyes(p, 30, 26, 38, DARK_HAIR[0], C('#2e4a3a'), C('#6a9a72'), false);
  // nariz fino e comprido
  for (const [x, y, k] of [[32, 30, 4], [32, 31, 4], [32, 32, 4], [33, 32, 2], [32, 33, 5], [33, 33, 2], [32, 34, 4], [33, 34, 2],
    [31, 35, 3], [32, 35, 4], [33, 35, 3], [34, 35, 1], [30, 36, 2], [31, 36, 1], [32, 36, 2], [33, 36, 1], [34, 36, 1]]) p.set(x, y, PAL.skin[k]);
  // óculos redondos de aro de latão
  for (const cx of [27.5, 37.5]) {
    p.fill(cx - 4, 27, cx + 4, 36, (x, y) => Math.abs(Math.hypot(x - cx, y - 31.5) - 2.6) < 0.55, (x, y) => PAL.gold[y < 31 && x < cx ? 4 : y < 31 ? 3 : 2]);
    p.set(cx - 1.5, 30, PAL.eyeWhite);
  }
  p.set(31, 30, PAL.gold[3]); p.set(32, 30, PAL.gold[4]); p.set(33, 30, PAL.gold[3]);
  p.set(23, 31, PAL.gold[2]); p.set(41, 31, PAL.gold[1]);
  // bigode fino de pontas viradas e cavanhaque
  for (const [x, y, k] of [[31, 37, 3], [30, 37, 4], [29, 37, 3], [28, 38, 3], [27, 38, 2], [26, 38, 2], [25, 37, 3], [31, 38, 1], [30, 38, 1], [29, 38, 1]]) {
    p.set(x, y, DARK_HAIR[k]);
    p.set(64 - x, y, DARK_HAIR[Math.max(0, k - 1)]);
  }
  for (let x = 30; x <= 34; x++) p.set(x, 39, PAL.skin[1]);
  for (let x = 31; x <= 33; x++) p.set(x, 40, PAL.lip);
  p.set(31, 40, C('#c06850'));
  p.fill(29, 41, 36, 46, (x, y) => Math.abs(x - AX) <= 2.4 - (y - 41) * 0.62, (x, y) =>
    pick(DARK_HAIR, 0.62 - (x - 31) * 0.12 - (y - 41) * 0.06 + (hash(x, y, 13) - 0.5) * 0.16, x, y));
  // faces coradas
  for (const [x, y] of [[24, 34], [26, 34], [25, 35]]) { p.set(x, y, PAL.blush); p.set(64 - x, y, PAL.blush); }

  // chapéu de feltro: aba larga levemente inclinada
  const brimY = (x) => 23.6 - (x - AX) * 0.07;
  p.fill(10, 15, 55, 30, (x, y) => ((x - AX) / 21.5) ** 2 + ((y - brimY(x)) / 4.4) ** 2 <= 1, (x, y) => {
    const nx = (x + 0.5 - AX) / 21.5, by = brimY(x + 0.5);
    let v = y + 0.5 < by ? 0.62 - nx * 0.3 + (by - y) * 0.05 : 0.2 - nx * 0.12 - (y - by) * 0.05;
    if (Math.abs(y + 0.5 - by) < 0.6) v += 0.12; // quina da aba
    return pick(FELT, v + (hash(x, y, 14) - 0.5) * 0.1, x, y);
  });
  // copa com o vinco no alto
  p.fill(21, 6, 44, 24, (x, y) => ((x - AX) / 10.6) ** 2 + ((y - 19) / 12) ** 2 <= 1 && y < brimY(x) - 0.4 &&
    !(y < 8.4 && Math.abs(x - AX) < 3), (x, y) => {
    const nx = (x + 0.5 - AX) / 10.6, ny = (y + 0.5 - 15) / 10;
    let v = 0.1 + sphereLight(nx, ny) * 0.95;
    if (Math.abs(x + 0.5 - AX) < 1 && y < 14) v -= 0.3; // vinco
    else if (x === 31 && y < 14) v += 0.15;
    if (Math.abs(Math.abs(x + 0.5 - AX) - 6) < 0.6 && y > 10 && y < 16) v -= 0.12; // amassado dos lados
    return pick(FELT, v + (hash(x, y, 15) - 0.5) * 0.08, x, y);
  });
  // fita de couro vermelho com fivela de latão
  p.fill(21, 17, 44, 23, (x, y) => ((x - AX) / 10.6) ** 2 + ((y - 19) / 12) ** 2 <= 1 && y > brimY(x) - 3.6 && y < brimY(x) - 0.4, (x, y) =>
    pick(PAL.band, 0.15 + cylLight((x + 0.5 - AX) / 10.6) * 0.8 + (y + 0.5 < brimY(x) - 2.4 ? 0.2 : 0), x, y));
  p.rect(25, 20, 3, 3, (x, y) => (x === 26 && y === 21 ? PAL.band[1] : PAL.gold[x === 25 || y === 20 ? 5 : 3]));
  // pena comprida presa na fita, curvando para trás
  const plume = [[40, 21], [42.6, 16.6], [45.6, 12.4], [49.4, 8.6], [53.6, 5.8], [58, 4.2], [61.4, 4.4]];
  p.fill(37, 1, 63, 23, (x, y) => {
    const [d, , , at] = nearestOnPath(plume, x, y);
    return d <= 0.6 + Math.sin(at * Math.PI) ** 0.7 * 1.9 && !(at > 0.97);
  }, (x, y) => {
    const [d, ox, oy, at] = nearestOnPath(plume, x + 0.5, y + 0.5);
    const hw = 0.6 + Math.sin(at * Math.PI) ** 0.7 * 1.9;
    let v = 0.3 + sphereLight(ox / (hw + 0.4), oy / (hw + 0.4)) * 0.7;
    if (d < 0.5) v += 0.2; // haste
    else if ((x + y) % 2 === 0) v -= 0.1; // barbas
    if (at > 0.55 && Math.floor(at * 22) % 3 === 0) v -= 0.35; // listras da ponta
    return pick(QUILL, v, x, y);
  });

  // mapa aberto na frente: terra com a costa a nanquim, mar aguado, rosa dos ventos e a rota
  p.poly([MAP_TL, MAP_TR, MAP_BR, MAP_BL], (x, y) => {
    const land = mapLand(x + 0.5, y + 0.5);
    let coast = false, shore = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (mapLand(x + 0.5 + dx, y + 0.5 + dy) !== land) coast = true;
      if (!land && mapLand(x + 0.5 + dx * 2, y + 0.5 + dy * 2)) shore = true;
    }
    const [u, v] = mapUV(x + 0.5, y + 0.5);
    const edge = Math.min(u, 1 - u, v * 2.2, 1 - v);
    const age = (hash(x >> 1, y >> 1, 16) - 0.5) * 0.1 - clamp01(0.08 - edge) * 3;
    if (coast && land) return INK;
    if (land) return pick(PARCH, 0.74 + age + (hash(x, y, 17) < 0.08 ? -0.14 : 0), x, y);
    if (coast || shore) return SEA_WASH[coast ? 1 : 2]; // sombreado rente à costa
    return pick(SEA_WASH, 0.8 + age, x, y);
  });
  // borda de cima enrolando
  for (let x = 9; x <= 57; x++) p.set(x, Math.round(53 - (x - 9) / 48), PARCH[x < 30 ? 5 : 4]);
  // montanhas e matas desenhadas na terra
  for (const [x, y] of [[9, 57], [13, 56], [11, 60]]) {
    p.set(x, y, INK); p.set(x - 1, y + 1, INK); p.set(x + 1, y + 1, PARCH[2]);
  }
  for (const [x, y] of [[16, 59], [6, 62], [15, 62]]) { p.set(x, y, C('#4e6e34')); p.set(x + 1, y, C('#3a5428')); p.set(x, y + 1, INK); }
  // ondinhas no mar
  for (const [x, y] of [[40, 62], [29, 55]]) { p.set(x, y, SEA_WASH[1]); p.set(x + 1, y - 1, SEA_WASH[1]); p.set(x + 2, y, SEA_WASH[1]); }
  // naviozinho desenhado a nanquim
  ['..#..', '..##.', '#####', '.###.'].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') p.set(23 + i, 58 + j, INK); }));
  p.set(26, 59, PARCH[5]);
  // rosa dos ventos
  const [rx, ry] = [34, 61];
  for (let k = -3; k <= 3; k++) { p.set(rx + k, ry, INK); p.set(rx, ry + k, INK); }
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-2, -2], [2, -2], [-2, 2], [2, 2]]) p.set(rx + dx, ry + dy, PARCH[1]);
  p.set(rx, ry - 3, ROUTE);
  p.set(rx, ry - 2, ROUTE);
  p.set(rx, ry, PAL.gold[4]);
  // rota tracejada do porto até a ilha, com o X do destino
  for (let i = 0; i < 24; i++) {
    const x = 22 + i, y = 58.4 - Math.sin(i * 0.26) * 1.6 - i * 0.04;
    if (i % 3 !== 2) p.set(x, y, ROUTE);
  }
  for (const [x, y] of [[46, 55], [48, 55], [47, 56], [46, 57], [48, 57]]) p.set(x, y, ROUTE);

  p.outline(PAL.out);
  return p;
}

// Mão com o punho de renda e a manga, que segura o compasso de pontas por cima.
function buildCartographerArm() {
  const p = new Pix(72, 72);
  p.poly([[46, 51], [52, 47.5], [72, 55], [72, 72], [58, 72]], (x, y) => {
    let v = 0.46 - (y - 51) * 0.02 + (x < 52 ? 0.08 : 0);
    if ((x - y) % 9 === 0) v -= 0.14; // dobras da manga
    return pick(COAT, v, x, y);
  });
  // punho virado do casaco, com o babado de renda no pulso
  p.poly([[45.4, 49.8], [49.6, 45.4], [54.4, 49.8], [49.6, 54.4]], (x, y) => pick(COAT, 0.78 - (x - 46) * 0.04 - (y - 46) * 0.035, x, y));
  for (let i = 0; i < 6; i++) p.set(45 + i * 0.75, 49.6 - i * 0.8, PAL.linen[i % 2 ? 3 : 4]);
  for (let i = 0; i < 5; i++) p.set(44.4 + i * 0.75, 50.2 - i * 0.8, PAL.linen[2]);
  // dorso da mão e os dedos dobrados em volta da cabeça do compasso
  p.sphere(45, 47.4, 3.9, 3.4, PAL.skin, 0.05);
  for (const [fy, len] of [[45.2, 2.4], [47.2, 2.9], [49.2, 2.6]]) {
    p.fill(38, fy - 1, 45, fy + 1, (x, y) => ((x - 42.4) / len) ** 2 + ((y - fy) / 1.05) ** 2 <= 1, (x, y) =>
      pick(PAL.skin, 0.2 + sphereLight((x + 0.5 - 41.8) / len, (y + 0.5 - fy - 0.3) / 1.2) * 0.85, x, y));
  }
  for (const fy of [46.2, 48.2]) for (let x = 40; x <= 43; x++) p.set(x, fy, PAL.skin[1]);
  for (const [x, y] of [[41, 44], [40, 46], [40, 48]]) p.set(x, y, PAL.skin[5]); // nós dos dedos
  // polegar na frente, apertando a cabeça do compasso
  p.line(40, 44, 44, 44, PAL.skin[5]);
  p.line(41, 45, 44, 45, PAL.skin[3]);
  p.outline(PAL.out);
  return p;
}

// Compasso de pontas: dobradiça de latão em (hx, hy) e as duas pernas de aço.
function paintDivider(f, q, hx, hy, spread, tilt) {
  q.clear();
  const ox = 10, oy = 4;
  const len = 13;
  for (const side of [-1, 1]) {
    const a = side * spread + tilt;
    const sx = Math.sin(a), cy = Math.cos(a);
    const ex = ox + sx * len, ey = oy + cy * len;
    q.line(ox, oy, ex, ey, side < 0 ? PAL.steel[4] : PAL.steel[3]);
    q.set(ex, ey, PAL.steel[5]);
  }
  q.rect(ox - 1, oy - 1, 3, 3, (x, y) => PAL.gold[x === ox - 1 || y === oy - 1 ? 5 : x === ox + 1 ? 2 : 3]);
  q.set(ox, oy, PAL.gold[1]);
  q.rect(ox, oy - 4, 2, 3, (x, y) => PAL.gold[x === ox ? (y === oy - 4 ? 5 : 4) : 2]);
  q.outline(PAL.out);
  f.blit(q, hx - ox, hy - oy);
}

const cartoArt = { bg: null, body: null, frame: new Pix(64, 64), divider: new Pix(22, 22) };

function paintCartographerPortrait(ctx, t, info) {
  const a = cartoArt;
  if (!a.bg) {
    a.bg = buildCartographerBackdrop();
    a.body = buildCartographer();
    a.arm = trim(buildCartographerArm());
    a.cloud = makeCloud(12, 5, 7);
    a.sea = [];
    for (let i = 0; i < 64 * 64; i++) if (a.bg.sky[i] === 2) a.sea.push(i, (i & 63) * 1.1 + (i >> 6) * 2.3 + hash(i, 1, 9) * 6);
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  const d = f.d, sky = a.bg.sky;
  // nuvem passando na janela
  const cx0 = Math.floor(((t * 0.9) % 34) - 12), cl = a.cloud;
  for (let y = 0; y < cl.h; y++) {
    for (let x = 0; x < cl.w; x++) {
      const c = cl.d[y * cl.w + x], tx = x + cx0, ty = y + 7;
      if (c && tx >= 0 && tx < 64 && sky[ty * 64 + tx] === 1) d[ty * 64 + tx] = c;
    }
  }
  // brilhos no mar
  for (let k = 0; k < a.sea.length; k += 2) {
    const s = Math.sin(a.sea[k + 1] - t * 1.7);
    if (s > 0.9) d[a.sea[k]] = PAL.water[s > 0.97 ? 5 : 4];
  }
  // um navio cruzando o horizonte, bem devagar
  const sx = Math.floor(((t * 0.35) % 30) - 4), sy = WIN.horizon;
  const ship = [[0, 0, PAL.wood[1]], [1, 0, PAL.wood[2]], [2, 0, PAL.wood[1]], [1, -1, PAL.sail[4]], [1, -2, PAL.sail[3]], [2, -1, PAL.sail[2]], [0, -1, PAL.sail[3]]];
  for (const [dx, dy, c] of ship) {
    const x = sx + dx, y = sy + dy;
    if (x >= 0 && x < 64 && sky[y * 64 + x]) d[y * 64 + x] = c;
  }
  // gaivota planando
  const gx = 4 + ((t * 2.2) % 20), gy = 9 + Math.sin(t * 0.9) * 2;
  const wings = Math.sin(t * 7) > 0 ? [[-1, -1], [1, -1], [-2, -1], [2, -1]] : [[-1, 0], [1, 0], [-2, 1], [2, 1]];
  for (const [dx, dy] of [[0, 0], ...wings]) {
    const x = Math.floor(gx + dx), y = Math.floor(gy + dy);
    if (x >= 0 && x < 64 && y >= 0 && sky[y * 64 + x] === 1) d[y * 64 + x] = PAL.cloud[4];
  }
  // o globo gira devagar
  const rot = Math.floor(advance(a, 'spin', t, working ? 34 : 14));
  const g = a.bg.globe;
  for (let k = 0; k < g.length; k += 5) {
    const x = g[k], y = g[k + 1];
    const lon = ((((g[k + 2] + rot) >> 3) % GLOBE_LON) + GLOBE_LON) % GLOBE_LON;
    const kind = globeLand[g[k + 3] * GLOBE_LON + lon];
    const v = g[k + 4];
    d[y * 64 + x] = kind === 2 ? pick(PAL.cloud, 0.3 + v * 0.7, x, y) : kind ? pick(LAND, v, x, y) : pick(OCEAN, v * 0.9, x, y);
  }
  f.blit(a.body, 0, 0);
  // o compasso vai medindo a rota, abrindo e fechando as pontas
  const ph = advance(a, 'measure', t, working ? 2.4 : 1.1);
  const hx = 41 + Math.round(Math.sin(t * 0.37) * 1.4);
  const spread = 0.3 + (Math.sin(ph) * 0.5 + 0.5) * 0.28;
  paintDivider(f, a.divider, hx, 45, spread, Math.sin(ph * 0.5) * 0.12);
  f.blit(a.arm.pix, a.arm.x + hx - 41, a.arm.y);
  // piscar
  if (t % 4.9 > 4.74 || t % 11.3 > 11.15) paintEyes(f, 30, 26, 38, DARK_HAIR[0], 0, 0, true);
  // reflexo correndo nas lentes e brilho na fivela
  const glint = pulse(t, working ? 3.1 : 5.2, 0, 0.5);
  if (glint > 0.2) { f.set(26, 30, WHITE); f.set(36, 30, WHITE); }
  if (glint > 0.6) { f.set(27, 30, PAL.eyeWhite); f.set(37, 30, PAL.eyeWhite); }
  sparkle(f, 25, 20, pulse(t, 6.3, 2.1, 0.45) * 0.7);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Posto avançado

const GATE = { x0: 27, x1: 37 };
const FIRE = [12.5, 59];
const CABIN = C('#1c130d'); // interior da cabine da torre

function buildOutpostBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 42);
  paintSun(p, 8, 8, 3.5);
  // serra com neve nos picos
  const ridge = (x) => 28 - 5.5 * Math.max(0, Math.sin(x * 0.11 + 0.4)) ** 2 - 2.6 * Math.sin(x * 0.29 + 1.3) - 1.2 * Math.sin(x * 0.71);
  for (let x = 0; x < 64; x++) {
    const top = Math.round(ridge(x));
    const slope = ridge(x + 1) - ridge(x - 1);
    for (let y = top; y < 42; y++) {
      const snow = y < top + 2 + (slope < 0 ? 1 : 0) && top < 26;
      p.set(x, y, snow ? PAL.cloud[slope > 0 ? 4 : 2] : pick(PAL.far, 0.62 + slope * 0.35 - (y - top) * 0.035 + (hash(x, y, 21) - 0.5) * 0.1, x, y));
    }
  }
  // mata de pinheiros: fileira de trás azulada e a da frente escura
  for (let i = 0; i < 26; i++) drawPine(p, i * 2.6 + hash(i, 1, 22) * 2, 40, 7 + hash(i, 2, 22) * 5, 2.4, FOREST_FAR, 0.08, 23, 3.5);
  for (let i = 0; i < 20; i++) drawPine(p, i * 3.4 + hash(i, 1, 24) * 2.5, 45, 10 + hash(i, 2, 24) * 7, 3.2, PAL.tree, 0.14, 25, 3.8);
  // clareira: capim, sombra da paliçada e o caminho de terra até o portão
  for (let y = 43; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (y < 45 + Math.sin(x * 0.7) * 0.8) continue;
      let v = 0.44 + (y - 48) * 0.012 + (hash(x, y, 26) - 0.5) * 0.2 - (y % 3 === 0 ? 0.06 : 0);
      if (y < 56) v -= 0.16; // sombra da paliçada
      if (hash(x, y, 27) < 0.06) v += 0.22;
      p.set(x, y, pick(PAL.grass, v, x, y, 1.6));
    }
  }
  p.fill(16, 52, 52, 63, (x, y) => {
    const k = (y - 53) / 11;
    const c = AX + Math.sin(k * 2.6) * 1.4;
    return y >= 53 && Math.abs(x - c) <= 5 + k * 6 + Math.sin(y * 1.7) * 0.5;
  }, (x, y) => pick(PAL.dirt, 0.58 + (hash(x, y, 28) - 0.5) * 0.34 - (y < 56 ? 0.14 : 0) + ((x + y * 2) % 7 === 0 ? -0.15 : 0), x, y));
  // tocos das árvores derrubadas na clareira
  for (const [x, y] of [[57, 59], [5, 63]]) {
    p.rect(x - 2, y - 1, 5, 3, (xx, yy) => pick(LOG, 0.6 - (xx - x) * 0.12 - (yy - y) * 0.06 + (hash(xx, yy, 29) - 0.5) * 0.12, xx, yy));
    p.rect(x - 2, y - 2, 5, 1, (xx) => CUT[xx === x ? 0 : xx < x ? 2 : 1]);
    p.set(x - 3, y + 1, LOG[2]);
    p.set(x + 3, y + 1, LOG[1]);
  }
  // pinheiros altos nas beiradas
  drawPine(p, 2, 54, 46, 7, PAL.tree, 0.0, 29, 6.5);
  drawPine(p, 62.5, 50, 32, 5.5, PAL.tree, -0.08, 30, 5);
  return p;
}

function buildOutpost() {
  const p = new Pix(64, 64);
  const cabin = new Uint8Array(64 * 64);
  // barraca de lona aparecendo por cima da paliçada
  p.poly([[6, 38], [15.5, 25.5], [25, 38]], (x, y) => {
    const left = x + 0.5 < 15.5;
    let v = left ? 0.66 + (15.5 - x) * 0.012 : 0.26;
    if (Math.abs(x + 0.5 - 15.5) < 1) v = 0.5;
    if ((y - 26) % 4 === 3) v -= 0.08; // costuras da lona
    return pick(PAL.sail, v, x, y);
  });
  p.rect(15, 23, 1, 3, PAL.wood[3]);
  p.line(16, 26, 20, 23, PAL.straw[2]);

  // torre de vigia: pernas com travas em X, cabine e telhado de tábuas
  for (const x of [43, 54]) p.rect(x, 18, 2, 21, (xx) => LOG[xx === x ? 4 : 2]);
  for (const [x0, y0, x1, y1] of [[45, 20, 53, 29], [53, 20, 45, 29], [45, 29, 53, 38], [53, 29, 45, 38]]) {
    p.line(x0, y0, x1, y1, LOG[3]);
    p.line(x0, y0 + 1, x1, y1 + 1, LOG[1]);
  }
  p.rect(41, 10, 17, 4, CABIN);
  for (let i = 0; i < 64 * 64; i++) if (p.d[i] === CABIN) cabin[i] = 1;
  for (const x of [41, 57]) p.rect(x, 10, 1, 8, LOG[x === 41 ? 4 : 1]);
  p.rect(40, 14, 19, 1, (x) => LOG[x < 48 ? 5 : 3]); // parapeito
  p.rect(41, 15, 17, 3, (x, y) => {
    let v = 0.5 - (x - 41) * 0.02 + (hash(x >> 2, y, 31) - 0.5) * 0.12;
    if ((x - 41) % 4 === 0) v -= 0.2;
    return pick(LOG, v, x, y);
  });
  p.rect(39, 18, 21, 1, (x) => LOG[x < 48 ? 3 : 1]);
  p.poly([[38, 9.6], [49.5, 2.4], [61, 9.6]], (x, y) => {
    let v = x + 0.5 < 49.5 ? 0.66 - (49.5 - x) * 0.006 : 0.3;
    if ((y - 3) % 2 === 1) v -= 0.14;
    if (hash(x >> 1, y, 32) < 0.15) v -= 0.1;
    return pick(PAL.roof, v, x, y);
  });
  p.rect(38, 9, 23, 1, (x) => PAL.roof[x < 49 ? 2 : 0]);
  p.rect(49, 0, 1, 3, (x, y) => (y === 0 ? PAL.gold[5] : PAL.iron[2]));

  // paliçada de troncos pontudos, com frestas escuras entre eles
  for (let k = 0; k < 16; k++) {
    const x0 = k * 4;
    if (x0 + 3 >= GATE.x0 - 3 && x0 <= GATE.x1 + 3) continue;
    const top = 36 + Math.floor(hash(k, 0, 33) * 2.6);
    for (let i = 0; i < 4; i++) {
      const x = x0 + i;
      const tip = i === 3 ? top + 2 : i === 1 ? top - 2 : top - 1;
      for (let y = tip; y < 54; y++) {
        if (i === 3) { p.set(x, y, LOG[0]); continue; }
        let v = [0.74, 0.54, 0.3][i] + (hash(x, y >> 1, 34 + k) - 0.5) * 0.16;
        if (y > 50) v -= (y - 50) * 0.07;
        if (hash(x, y, 35) < 0.05) v -= 0.25; // nós da casca
        if (y < top + 1) v += 0.16; // ponta talhada, madeira clara
        p.set(x, y, pick(LOG, v, x, y));
      }
    }
  }
  // amarras de corda em volta dos troncos
  for (const ry of [41, 49]) {
    for (let x = 0; x < 64; x++) {
      if (x >= GATE.x0 - 3 && x <= GATE.x1 + 3) continue;
      if (x % 4 === 3) { p.set(x, ry, PAL.straw[0]); continue; }
      p.set(x, ry, PAL.straw[(x % 4) === 0 ? 2 : 1]);
      p.set(x, ry + 1, PAL.straw[(x % 4) === 1 ? 1 : 0]);
    }
  }

  // portão aberto: pátio de terra lá dentro, o caixote e as folhas abertas
  p.rect(GATE.x0, 31, GATE.x1 - GATE.x0 + 1, 23, (x, y) => {
    if (y < 45) return pick(LOG, 0.1 + (x % 3 === 0 ? -0.06 : 0.04) + (y - 31) * 0.005, x, y);
    return pick(PAL.dirt, 0.3 + (y - 45) * 0.035 + (hash(x, y, 36) - 0.5) * 0.18, x, y);
  });
  p.rect(30, 42, 5, 4, (x, y) => pick(PAL.wood, (y === 42 ? 0.62 : 0.32) - (x - 30) * 0.05, x, y));
  p.line(30, 45, 34, 43, PAL.wood[1]);
  p.rect(33, 39, 3, 3, (x, y) => pick(PAL.sail, (y === 39 ? 0.7 : 0.4) - (x - 33) * 0.1, x, y)); // saco
  for (const [x0, lit] of [[GATE.x0, 1], [GATE.x1 - 1, 0]]) {
    p.rect(x0, 32, 2, 21, (x, y) => pick(PAL.wood, (lit ? 0.32 : 0.18) + (x === x0 ? 0.1 : 0) + (y % 5 === 0 ? -0.12 : 0), x, y));
  }
  // batentes grossos e a viga, com o escudo do pinheiro
  for (const x0 of [GATE.x0 - 3, GATE.x1 + 1]) {
    p.rect(x0, 28, 3, 26, (x, y) => pick(LOG, [0.8, 0.56, 0.3][x - x0] + (hash(x, y >> 1, 37) - 0.5) * 0.14 - (y > 50 ? 0.15 : 0), x, y));
    p.set(x0 + 1, 27, LOG[5]);
    p.set(x0, 28, LOG[4]);
    p.set(x0 + 2, 28, LOG[2]);
  }
  p.rect(GATE.x0 - 4, 29, GATE.x1 - GATE.x0 + 9, 2, (x, y) => pick(LOG, (y === 29 ? 0.8 : 0.42) - (x - 22) * 0.008, x, y));
  p.fill(28, 20, 37, 29, (x, y) => y < 25 || Math.abs(x - AX) < (29 - y) * 1.1, (x, y) => {
    if (Math.abs(x + 0.5 - AX) > 3.6 || y === 20) return PAL.gold[x < 32 ? 4 : 2];
    return pick(PENNANT, 0.6 - (x - 29) * 0.06 - (y - 21) * 0.03, x, y);
  });
  // pinheiro dourado no escudo
  [0, 1, 2, 1, 2].forEach((w, k) => {
    for (let i = -w; i <= w; i++) p.set(32 + i, 21 + k, PAL.gold[i < 0 ? 5 : i === 0 ? 4 : 3]);
  });
  p.set(32, 26, PAL.wood[4]);

  // machado cravado no toco, à direita do caminho
  p.rect(44, 57, 6, 4, (x, y) => pick(LOG, 0.62 - (x - 44) * 0.1 - (y - 57) * 0.06 + (hash(x, y, 39) - 0.5) * 0.1, x, y));
  p.rect(44, 56, 6, 1, (x) => CUT[x === 46 || x === 47 ? 0 : x < 46 ? 2 : 1]);
  p.set(43, 60, LOG[2]); p.set(50, 60, LOG[1]);
  p.line(47, 55, 51, 49, PAL.wood[4]);
  p.line(48, 55, 52, 49, PAL.wood[2]);
  p.poly([[44.5, 53.5], [47.5, 53], [48.6, 56], [45.4, 56.4]], (x, y) => PAL.steel[x < 46 ? 4 : y < 55 ? 3 : 2]);

  // tora para sentar ao lado da fogueira
  p.rect(1, 58, 6, 3, (x, y) => pick(LOG, 0.66 - (y - 58) * 0.18 + (hash(x, y, 38) - 0.5) * 0.14, x, y));
  p.rect(7, 58, 1, 3, (x, y) => CUT[y === 59 ? 0 : 2]);

  p.outline(PAL.out);
  p.cabin = cabin;
  return p;
}

// Pedras e lenha da fogueira: ficam por cima das chamas.
function buildCampfire() {
  const p = new Pix(64, 64);
  const [fx, fy] = FIRE;
  p.line(fx - 4, fy, fx + 3, fy - 2, LOG[3]);
  p.line(fx - 4, fy + 1, fx + 3, fy - 1, LOG[1]);
  p.line(fx - 3, fy - 2, fx + 4, fy, LOG[2]);
  p.line(fx - 3, fy - 1, fx + 4, fy + 1, LOG[1]);
  p.set(fx + 3, fy - 2, CUT[2]);
  p.set(fx - 3, fy - 2, CUT[1]);
  for (const [dx, dy, r] of [[-5.5, 1, 1.5], [-2.6, 2.2, 1.6], [0.8, 2.5, 1.5], [4, 2.1, 1.6], [6.2, 0.8, 1.3]]) {
    p.sphere(fx + dx, fy + dy, r, r * 0.8, PAL.stone, 0.12);
  }
  p.outline(PAL.out);
  return p;
}

const outpostArt = { bg: null, body: null, frame: new Pix(64, 64), flag: new Pix(14, 10) };

function paintOutpostFlag(f, q, ph) {
  paintPennant(f, q, 49, 1, 11, 6, ph, 1.5, PENNANT, (i, j) => j === 3 && i < 8);
}

function paintOutpostPortrait(ctx, t, info) {
  const a = outpostArt;
  if (!a.bg) {
    a.bg = buildOutpostBackdrop();
    a.body = buildOutpost();
    a.fire = trim(buildCampfire());
    a.clouds = [makeCloud(22, 8, 3), makeCloud(14, 6, 9)];
  }
  const working = info.working;
  const live = ease(a, 'live', t, working ? 1 : 0.6, 1.5);
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], ((t * 1.3) % 92) - 24, 10);
  f.blit(a.clouds[1], ((t * 2 + 50) % 84) - 16, 1);
  // pássaros voando sobre a mata
  for (let k = 0; k < 2; k++) {
    const x = ((t * (3 + k) + k * 30) % 80) - 8, y = 17 + k * 5 + Math.sin(t * 0.8 + k) * 2;
    const up = Math.sin(t * 9 + k * 2) > 0 ? 1 : 0;
    f.set(x, y, BIRD); f.set(x - 1, y - up, BIRD); f.set(x + 1, y - up, BIRD);
  }
  f.blit(a.body, 0, 0);
  // vigia andando de um lado para o outro na cabine
  const gx = Math.round(49 + Math.sin(advance(a, 'watch', t, working ? 0.7 : 0.4)) * 4);
  const cab = a.body.cabin;
  for (const [dx, dy, c] of [[-1, 10, PAL.straw[2]], [0, 10, PAL.straw[3]], [1, 10, PAL.straw[2]], [0, 11, PAL.skin[3]], [1, 11, PAL.skin[2]],
    [0, 12, PAL.skin[2]], [1, 12, PAL.skin[1]], [-1, 13, PENNANT[2]], [0, 13, PENNANT[3]], [1, 13, PENNANT[2]], [2, 13, PENNANT[1]]]) {
    const x = gx + dx;
    if (cab[dy * 64 + x]) f.d[dy * 64 + x] = c;
  }
  // fogueira: chamas, fagulhas e fumaça subindo para a direita
  const [fx, fy] = FIRE;
  paintFlame(f, fx, fy - 1, t, 5 + live * 2.5, 2.8, live);
  paintFlame(f, fx - 2.4, fy - 1, t * 1.3 + 2, 3 + live, 1.3, live);
  paintFlame(f, fx + 2.4, fy - 1, t * 1.1 + 4, 3 + live * 1.4, 1.4, live);
  f.blit(a.fire.pix, a.fire.x, a.fire.y);
  for (let k = 0; k < 8; k++) {
    const life = (t * (0.16 + hash(k, 1, 39) * 0.06) + k / 8) % 1;
    const x = fx + life * 16 + Math.sin(t * 1.3 + k * 2) * 1.6 * life;
    const y = fy - 9 - life * 30;
    const r = 1.4 + life * 2.8, r2 = r * r;
    const v = 0.95 - life * 0.5;
    for (let yy = Math.floor(y - r); yy <= y + r; yy++) {
      const dy = yy + 0.5 - y;
      for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
        const dx = xx + 0.5 - x, dd = (dx * dx + dy * dy) / r2;
        if (dd < 1 && bayer(xx, yy) < (1 - dd) * 2.2 - life * 1.1) f.set(xx, yy, pick(SMOKE, v - dd * 0.3 + (dy < 0 ? 0.12 : 0), xx, yy));
      }
    }
  }
  for (let k = 0; k < (working ? 6 : 2); k++) {
    const life = (t * (0.6 + hash(k, 1, 40) * 0.5) + hash(k, 2, 40)) % 1;
    f.set(fx + Math.sin(t * 3 + k * 2) * 2 * life + life * 3, fy - 7 - life * 14, PAL.fire[life < 0.5 ? 5 : 3]);
  }
  paintOutpostFlag(f, a.flag, advance(a, 'wind', t, working ? 6.2 : 3.6));
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Caravana

const MULE = ramp('#1c1612', '#362a22', '#524034', '#715a48', '#917660', '#b2967c', '#d0b698');
const MANE = ramp('#120c0a', '#221812', '#34261c');
const INSIDE = C('#1c130d'); // escuro debaixo da lona
const WHEELS = [[10.5, 51.5, 7], [29.5, 53, 5.5]]; // centro e raio de cada roda
const GROUND = 58.5; // linha onde as rodas e os cascos tocam a estrada
const MULE_HIPS = [[42, 45, 1], [44, 45, 0], [51, 45, 1], [53, 45, 0]]; // quadril de cada perna (1 = do lado de lá)

function buildCaravanBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 42);
  paintSun(p, 9, 8, 3.5);
  // colinas azuladas ao longe
  for (let x = 0; x < 64; x++) {
    const top = Math.round(31 + 2.6 * Math.sin(x * 0.09 + 1) + 1.4 * Math.sin(x * 0.23 + 0.4));
    for (let y = top; y < 44; y++) p.set(x, y, pick(PAL.far, (y === top ? 0.85 : 0.6) - (y - top) * 0.04 + Math.cos(x * 0.09 + 1) * 0.12, x, y));
  }
  // duas colinas verdes, com a estrada subindo pela da direita
  const hill = (x) => Math.min(36 + ((x - 10) / 14) ** 2 * 6, 38.5 + ((x - 52) / 15) ** 2 * 5);
  for (let x = 0; x < 64; x++) {
    const top = Math.round(hill(x));
    const slope = hill(x + 1) - hill(x - 1);
    for (let y = top; y < 64; y++) {
      let v = 0.5 + slope * 0.45 - (y - top) * 0.018 + (hash(x, y, 41) - 0.5) * 0.16;
      if (y === top) v += 0.18;
      if ((Math.floor((x + (y - top) * 1.5) / 7) + Math.floor((y - top) / 4)) % 2 === 0) v -= 0.06; // retalhos de campo
      p.set(x, y, pick(PAL.grass, v, x, y, 1.6));
    }
  }
  for (let i = 0; i < 9; i++) {
    const y = 40 + i * 1.2, x = 60 - i * 2.2 + Math.sin(i * 0.8) * 1.5;
    p.set(x, y, PAL.dirt[3]);
    p.set(x + 1, y, PAL.dirt[4]);
  }
  // arvoredos nas encostas
  for (const [x, y, r] of [[3, 38, 3.4], [7, 37, 2.6], [22, 42, 2.2], [42, 42, 2.4], [46, 41, 3], [31, 46, 2]]) {
    p.rect(Math.round(x), Math.round(y + r * 0.6), 1, 2, PAL.wood[1]);
    p.sphere(x, y, r, r * 0.9, PAL.tree, 0.15, 1.6);
  }
  // estrada de terra com as marcas das rodas
  const top = (x) => 52.5 + Math.sin(x * 0.08) * 0.8;
  for (let x = 0; x < 64; x++) {
    for (let y = Math.round(top(x)); y < 62; y++) {
      const k = y - top(x);
      let v = 0.58 + (hash(x, y, 42) - 0.5) * 0.24 - (k < 1 ? 0.22 : 0);
      if (Math.abs(y - 57.5) < 0.6 || Math.abs(y - 60) < 0.6) v -= 0.14; // sulcos
      p.set(x, y, pick(PAL.dirt, v, x, y));
    }
    for (let y = 62; y < 64; y++) p.set(x, y, pick(PAL.grass, 0.55 - (y - 62) * 0.1 + (hash(x, y, 43) - 0.5) * 0.3, x, y));
  }
  return p;
}

function buildCaravan() {
  const p = new Pix(64, 64);
  // lona sobre os aros: um pão comprido, de cantos redondos
  const inCanvas = (x, y) => {
    if (x < 3 || x > 32.5 || y < 21 || y > 35.5) return false;
    if (y < 26 && x < 8) return Math.hypot(x - 8, y - 26) <= 5;
    if (y < 26 && x > 27.5) return Math.hypot(x - 27.5, y - 26) <= 5;
    return true;
  };
  p.fill(2, 20, 34, 36, inCanvas, (x, y) => {
    const k = (y + 0.5 - 21) / 14;
    let v = 0.9 - k * 0.5 + Math.sin(x * 0.7 + y * 1.3) * 0.03 + (hash(x, y, 44) - 0.5) * 0.05;
    if (x < 6) v += 0.06; // ponta de trás pega luz
    else if (x > 29) v -= (x - 29) * 0.07;
    const hoop = (x - 8) % 6;
    if (x >= 8 && x <= 26 && hoop === 0) v += 0.12; // aro por baixo da lona
    else if (x >= 8 && x <= 27 && (hoop === 1 || hoop === 5)) v -= 0.14;
    if (x < 5 && (y + 0.5 - 28) % 3 < 1) v -= 0.25; // franzido da boca de trás
    return pick(PAL.sail, v, x, y, 3);
  });
  // remendo costurado
  p.rect(20, 25, 5, 4, (x, y) => ((y === 25 || y === 28) && x % 2 ? PAL.sail[1] : pick(PAL.linen, 0.78 - (y - 25) * 0.05, x, y)));
  // lona da lateral enrolada e amarrada
  p.rect(3, 34, 30, 2, (x, y) => pick(PAL.sail, (y === 34 ? 0.72 : 0.3) - x * 0.004, x, y));
  for (const x of [7, 14, 21, 28]) { p.set(x, 34, PAL.straw[1]); p.set(x, 35, PAL.straw[0]); p.set(x, 36, PAL.straw[2]); p.set(x, 37, PAL.straw[1]); }

  // carga à mostra: baús, um saco e um bauzinho com ferragens de ouro
  p.rect(3, 36, 30, 5, INSIDE);
  const chest = (x0, y0, w, h, r, band) => {
    p.rect(x0, y0 + 2, w, h - 2, (x, y) => pick(r, 0.6 - (x - x0) * 0.04 - (y - y0) * 0.03 + (hash(x, y, 45) - 0.5) * 0.08, x, y));
    p.rect(x0, y0, w, 2, (x, y) => pick(r, (y === y0 ? 0.85 : 0.5) - (x - x0) * 0.03, x, y));
    for (const bx of [x0 + 1, x0 + w - 2]) for (let y = y0; y < y0 + h; y++) p.set(bx, y, band[y === y0 ? 3 : 2]);
    p.rect(x0, y0 + 2, w, 1, (x) => band[x < x0 + 2 ? 3 : 1]);
    const lx = x0 + (w >> 1);
    p.set(lx, y0 + 2, PAL.gold[4]);
    p.set(lx, y0 + 3, PAL.gold[2]);
  };
  chest(4, 36, 8, 5, PAL.leather, PAL.iron);
  chest(13, 37, 6, 4, ramp('#1a2a1a', '#24402a', '#335a38', '#4a7448', '#62905a'), PAL.iron);
  p.fill(19, 35, 26, 41, (x, y) => ((x - 22.5) / 2.8) ** 2 + ((y - 38.8) / 2.6) ** 2 <= 1 || (y < 37 && y >= 35.5 && Math.abs(x - 22.5) < 1), (x, y) =>
    pick(PAL.linen, 0.1 + sphereLight((x + 0.5 - 22.5) / 2.8, (y + 0.5 - 38) / 2.8) * 0.65 + ((x + y) % 2 ? -0.05 : 0), x, y));
  p.set(22, 36, PAL.straw[1]);
  chest(26, 37, 6, 4, PAL.wood, PAL.gold);
  // caixa da carroça: tábuas, fueiros e cantoneiras de ferro
  p.rect(2, 41, 32, 6, (x, y) => {
    let v = 0.55 - (x - 2) * 0.004 + (hash(x >> 2, y, 46) - 0.5) * 0.12;
    if (y === 41) v += 0.28;
    else if (y === 44) v -= 0.22;
    else if (y === 46) v -= 0.18;
    return pick(PAL.wood, v, x, y);
  });
  for (const x of [3, 11, 19, 27, 33]) p.rect(x, 41, 1, 6, (xx, y) => PAL.wood[y === 41 ? 4 : 1]);
  for (const x of [2, 33]) { p.set(x, 42, PAL.iron[3]); p.set(x, 45, PAL.iron[2]); }
  p.rect(4, 47, 29, 1, PAL.wood[0]);
  // balde pendurado embaixo
  p.rect(18, 48, 4, 3, (x, y) => PAL.wood[x === 18 ? 3 : y === 48 ? 2 : 1]);
  p.rect(18, 48, 4, 1, (x) => PAL.iron[x < 20 ? 3 : 2]);

  // rodas: aro com o ferro e o cubo; os raios giram a cada quadro
  for (const [cx, cy, r] of WHEELS) {
    p.fill(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      return d <= r && d > r - 1.9;
    }, (x, y) => {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const lit = -((x + 0.5 - cx) * 0.6 + (y + 0.5 - cy) * 0.8) / r;
      return d > r - 0.8 ? pick(PAL.iron, 0.45 + lit * 0.4, x, y) : pick(PAL.wood, 0.4 + lit * 0.3, x, y);
    });
    p.sphere(cx, cy, 1.7, 1.7, PAL.wood, 0.15);
    p.set(cx - 0.5, cy - 0.5, PAL.iron[4]);
  }

  // mula: garupa, corpo, peito, pescoço, cabeça comprida e orelhas
  const lit = (x, y, cx, cy, rx, ry, b = 0) => pick(MULE, 0.12 + b + sphereLight((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) * 0.85, x, y);
  const inBody = (x, y) => ((x - 47.5) / 7.8) ** 2 + ((y - 42.6) / 4.5) ** 2 <= 1 || Math.hypot(x - 42, y - 41.8) <= 4.4 || Math.hypot(x - 52.6, y - 42.8) <= 4;
  p.fill(36, 36, 58, 48, inBody, (x, y) => {
    if (y > 45.2 && x > 39) return pick(MULE, 0.78 - (y - 45) * 0.12, x, y); // barriga clara
    return lit(x, y, 45, 40.5, 11, 6);
  });
  // orelhas compridas (a de lá primeiro)
  for (const [bx, tx, tip, far] of [[58, 59.6, 23.8, 1], [56.2, 53.8, 23.2, 0]]) {
    p.fill(52, 22, 60, 31, (x, y) => {
      const s = clamp01((30.4 - y) / (30.4 - tip));
      const cx = bx + (tx - bx) * s;
      return y <= 30.4 && y >= tip && Math.abs(x - cx) <= 1.25 * Math.sin(Math.min(1, s * 1.3 + 0.25) * Math.PI) ** 0.6;
    }, (x, y) => {
      const s = (30.4 - y) / (30.4 - tip);
      const cx = bx + (tx - bx) * s;
      if (s > 0.8) return MANE[far ? 0 : 1]; // ponta escura
      return MULE[(x + 0.5 < cx ? 4 : 2) - far * 2];
    });
  }
  p.poly([[50, 41], [52, 36], [54.4, 31.6], [58.4, 31], [57.6, 36.4], [56, 43]], (x, y) => lit(x, y, 53.5, 35, 5, 8, 0.05));
  p.poly([[54.4, 31.8], [56.2, 29.2], [58.8, 29.2], [63.6, 34.8], [63.4, 37.6], [61.2, 38.2], [57.2, 35.4]], (x, y) => {
    const along = ((x + 0.5 - 56.6) * 0.7 + (y + 0.5 - 30) * 0.7) / 9;
    if (along > 0.62) return pick(MULE, 0.9 - (y - 35) * 0.06, x, y); // focinho claro
    return lit(x, y, 57, 31, 6, 6, 0.08);
  });
  p.set(58, 31, MANE[0]);
  p.set(57, 30, MULE[5]);
  p.set(62, 36, MANE[1]); // narina
  p.set(61, 37, MULE[3]);
  p.set(62, 37, MULE[2]);
  for (let i = 0; i < 9; i++) { // crina curta e escovada
    const x = 54.8 - i * 0.55, y = 30.6 + i * 0.85;
    p.set(x, y, MANE[i % 2 ? 1 : 2]);
    p.set(x - 1, y + 0.5, MANE[0]);
  }
  // arreio: coelheira de couro com tachas, manta vermelha e a correia da barriga
  p.poly([[50.4, 41.8], [52.6, 35.2], [54.8, 35.6], [53.4, 42.8]], (x, y) => pick(PAL.leather, 0.66 - (x - 51) * 0.08, x, y));
  for (const [x, y] of [[52, 38], [53, 36], [52, 40]]) p.set(x, y, PAL.gold[4]);
  p.rect(44, 37, 6, 3, (x, y) => pick(PAL.banner, (y === 37 ? 0.85 : 0.45) - (x - 44) * 0.04, x, y));
  for (let x = 44; x < 50; x += 2) p.set(x, 40, PAL.gold[3]);
  p.rect(45, 36, 4, 1, PAL.leather[3]);
  p.line(47, 40, 47, 46, PAL.leather[1]);
  // varal de madeira ligando a carroça à coelheira
  p.line(33, 44, 52, 39, PAL.wood[4]);
  p.line(33, 45, 52, 40, PAL.wood[2]);
  p.outline(PAL.out);
  return p;
}

// Pernas da mula: coxa larga afinando até o casco; phase faz o passo.
function paintMuleLegs(f, phase, stride) {
  for (let k = 0; k < 4; k++) {
    const [hx, hy, far] = MULE_HIPS[k];
    const ph = phase + [0, 0.5, 0.25, 0.75][k] * Math.PI * 2;
    const swing = Math.sin(ph) * stride;
    const lift = Math.max(0, Math.cos(ph)) * 1.6;
    const fx = hx + swing, fy = GROUND - 0.5 - lift;
    const kx = hx + swing * 0.45 + (k < 2 ? -0.6 : 0.6) * lift, ky = hy + (fy - hy) * 0.5;
    const r = far ? MULE.slice(0, 4) : MULE.slice(1, 6);
    const seg = (x0, y0, x1, y1, w0, w1, v0) => {
      const n = Math.ceil(Math.abs(y1 - y0)) + 1;
      for (let i = 0; i <= n; i++) {
        const s = i / n, x = x0 + (x1 - x0) * s, y = Math.round(y0 + (y1 - y0) * s), w = w0 + (w1 - w0) * s;
        const xa = Math.round(x - w / 2), xb = Math.round(x + w / 2) - 1;
        f.set(xa - 1, y, PAL.out);
        f.set(xb + 1, y, PAL.out);
        for (let xx = xa; xx <= xb; xx++) f.set(xx, y, r[Math.max(0, Math.min(r.length - 1, Math.round(v0 * (r.length - 1)) - (xx === xb ? 1 : 0)))]);
      }
    };
    seg(hx, hy, kx, ky, 3, 2, 0.6);
    seg(kx, ky, fx, fy, 2, 2, 0.5);
    const hxr = Math.round(fx - 1);
    f.set(hxr - 1, Math.round(fy) + 1, PAL.out);
    f.set(hxr, Math.round(fy) + 1, MANE[1]);
    f.set(hxr + 1, Math.round(fy) + 1, MANE[0]);
    f.set(hxr + 2, Math.round(fy) + 1, PAL.out);
    f.set(hxr, Math.round(fy) + 2, PAL.out);
    f.set(hxr + 1, Math.round(fy) + 2, PAL.out);
  }
}

// Rabo balançando, preso na garupa.
function paintMuleTail(f, t) {
  const sw = Math.sin(t * 2.3) * 1.4 + Math.sin(t * 5.1) * 0.4;
  for (let i = 0; i < 9; i++) {
    const s = i / 8, x = 37.6 - s * 1.4 + sw * s * s, y = 40 + i;
    f.set(x - 1, y, PAL.out);
    f.set(x, y, i < 3 ? MULE[2] : MANE[i % 2 ? 1 : 2]);
    if (i > 4) f.set(x + 1, y, MANE[0]);
    f.set(x + (i > 4 ? 2 : 1), y, PAL.out);
  }
}

// Máscara dos pixels livres dentro de cada roda, onde os raios podem aparecer.
function wheelMask(body) {
  const m = new Uint8Array(64 * 64);
  for (const [cx, cy, r] of WHEELS) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r - 1 && !body.get(x, y)) m[y * 64 + x] = 1;
      }
    }
  }
  return m;
}

// Raios de madeira saindo do cubo; angles é o giro de cada roda.
function paintSpokes(f, mask, angles) {
  WHEELS.forEach(([cx, cy, r], w) => {
    for (let i = 0; i < 6; i++) {
      const a = angles[w] + (i * Math.PI) / 3;
      const c = Math.cos(a), s = Math.sin(a);
      const col = PAL.wood[c * -0.6 + s * -0.8 > 0.3 ? 4 : c * -0.6 + s * -0.8 > -0.3 ? 3 : 2];
      for (let d = 1.6; d < r - 1.2; d += 0.5) {
        const x = Math.floor(cx + c * d), y = Math.floor(cy + s * d);
        if (mask[y * 64 + x]) f.d[y * 64 + x] = col;
      }
    }
  });
}

const caravanArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintCaravanPortrait(ctx, t, info) {
  const a = caravanArt;
  if (!a.bg) {
    a.bg = buildCaravanBackdrop();
    a.body = buildCaravan();
    a.wheels = wheelMask(a.body);
    a.clouds = [makeCloud(20, 8, 4), makeCloud(13, 6, 11)];
  }
  const working = info.working;
  const dist = advance(a, 'dist', t, working ? 5 : 2.4); // pixels andados na estrada
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], 64 - ((t * 1.4) % 92), 11);
  f.blit(a.clouds[1], 64 - ((t * 0.9 + 40) % 80), 3);
  // bando de pássaros cruzando o céu
  for (let k = 0; k < 3; k++) {
    const x = ((t * 2.6 + k * 4) % 90) - 12 + (k === 1 ? 3 : 0), y = 16 + k * 2 - (k === 1 ? 3 : 0) + Math.sin(t * 0.7 + k) * 1.2;
    const up = Math.sin(t * 8 + k * 2.4) > 0 ? 1 : 0;
    f.set(x, y, BIRD); f.set(x - 1, y - up, BIRD); f.set(x + 1, y - up, BIRD);
  }
  // pedrinhas e tufos da estrada correndo para trás
  for (let k = 0; k < 18; k++) {
    const x = ((hash(k, 1, 47) * 80 - dist * (1 + (k % 3 === 0 ? 0.1 : 0))) % 80 + 80) % 80 - 8;
    const y = 54 + Math.floor(hash(k, 2, 47) * 8);
    if (k % 3 === 0) { f.set(x, y, PAL.dirt[4]); f.set(x + 1, y, PAL.dirt[1]); }
    else if (k % 3 === 1) f.set(x, y, PAL.dirt[1]);
    else { f.set(x, 62, PAL.grass[4]); f.set(x + 1, 61, PAL.grass[3]); }
  }
  // poeira levantando atrás das rodas
  for (let k = 0; k < (working ? 6 : 3); k++) {
    const life = (t * 0.7 + k / 6) % 1;
    const x = 3 + (k & 1) * 20 - life * 9, y = GROUND - 1 - life * 4;
    if (bayer(Math.round(x), Math.round(y)) < 1 - life) f.set(x, y, PAL.dirt[life < 0.5 ? 4 : 3]);
  }
  // rabo atrás do corpo; pernas e raios das rodas acompanham a distância andada
  paintMuleTail(f, t);
  f.blit(a.body, 0, 0);
  paintMuleLegs(f, (dist / 4.2) * Math.PI, 2);
  paintSpokes(f, a.wheels, WHEELS.map(([, , r]) => dist / r));
  // lampião pendurado na boca de trás, balançando
  const sw = Math.sin(t * 2.6) * 0.35;
  const lx = 4 + Math.sin(sw) * 4, ly = 25 + Math.cos(sw) * 4;
  f.line(4, 24, lx, ly - 1, PAL.iron[2]);
  for (const [dx, dy, c] of [[0, 0, PAL.iron[3]], [-1, 1, PAL.out], [0, 1, PAL.fire[4]], [1, 1, PAL.out], [-1, 2, PAL.out], [0, 2, PAL.fire[3]], [1, 2, PAL.out], [0, 3, PAL.iron[1]]]) {
    f.set(lx + dx, ly + dy, c);
  }
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Desbravador

const GINGER = ramp('#2a1208', '#4e2410', '#7a3a18', '#a2552a', '#c47640', '#dc9a5c');
const BUCK = ramp('#2e1c10', '#4c301c', '#6c4a2c', '#8e683e', '#ae8656', '#cca674');
const COON = ramp('#1c130d', '#36261a', '#563d2a', '#7a5a3e', '#9c7a56', '#bc9c74', '#dcc29a');
const WOOL = ramp('#2a0c0c', '#4e1414', '#7a2020', '#a2302a', '#c44c3a');
const DEEP = ramp('#06100c', '#0b1a12', '#10251a', '#173322', '#1f432c', '#2a5838', '#3a6e44', '#508a52');
const SHAFT = C('#cfe6a0');
const EYE_BLUE = C('#24364e'), EYE_BLUE_HI = C('#3a5878');

function buildPathfinderBackdrop(sun) {
  const p = new Pix(64, 64);
  // fundo da mata, com raios de luz descendo da esquerda
  const shaft = (x, y) => {
    const u = x + y * 0.55;
    return Math.max(0, Math.sin(u * 0.36 + 0.4)) ** 6 * clamp01(1 - y / 70) * (u < 52 ? 1 : 0.4);
  };
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.3 - y * 0.003 + (hash(x >> 1, y >> 1, 51) - 0.5) * 0.08 + shaft(x, y) * (0.18 + sun * 0.22);
      p.d[y * 64 + x] = pick(DEEP, v, x, y, 1.6);
    }
  }
  // troncos ao longe, enevoados
  for (const [x0, w] of [[3, 2], [12, 3], [26, 2], [37, 3], [47, 2], [57, 3]]) {
    p.rect(x0, 0, w, 64, (x, y) => pick(FOREST_FAR, 0.45 + (x === x0 ? 0.15 : -0.1) + shaft(x, y) * (0.3 + sun * 0.3) + (hash(x, y >> 2, 52) - 0.5) * 0.1, x, y));
  }
  // copa: tufos de folhas no alto
  for (let i = 0; i < 26; i++) {
    const cx = hash(i, 1, 53) * 70 - 3, cy = hash(i, 2, 53) * 14 - 2, r = 3 + hash(i, 3, 53) * 4;
    p.fill(cx - r, cy - r, cx + r, cy + r, (x, y) => ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.8)) ** 2 <= 1 && hash(Math.floor(x), Math.floor(y), 54) < 0.85, (x, y) =>
      pick(PAL.herb, 0.2 + sphereLight((x + 0.5 - cx) / r, (y + 0.5 - cy) / (r * 0.8)) * 0.55 + shaft(x, y) * sun * 0.4 - (cy > 6 ? 0.1 : 0), x, y, 1.4));
  }
  // troncos de perto, escuros e cheios de musgo
  for (const [x0, w] of [[0, 6], [52, 7]]) {
    p.rect(x0, 0, w, 64, (x, y) => {
      let v = 0.08 + cylLight((x + 0.5 - x0 - w / 2) / (w / 2)) * 0.5 + (hash(x, y >> 1, 55) - 0.5) * 0.12 + shaft(x, y) * sun * 0.25;
      if (hash(x, y, 56) < 0.12 + (x - x0 < 2 ? 0.25 : 0)) return pick(PAL.herb, v + 0.15, x, y);
      return pick(LOG, v, x, y);
    });
  }
  // samambaias e moitas no chão
  for (let i = 0; i < 14; i++) {
    const bx = i * 5 + hash(i, 1, 57) * 3, by = 64, len = 8 + hash(i, 2, 57) * 6, lean = (hash(i, 3, 57) - 0.5) * 1.6;
    for (let s = 0; s < len; s++) {
      const x = bx + lean * s * 0.6, y = by - s;
      p.set(x, y, PAL.herb[2]);
      const leaf = Math.round((1 - s / len) * 3);
      for (let k = 1; k <= leaf; k++) {
        if ((s + k) % 2) continue;
        p.set(x - k, y + k * 0.4, pick(PAL.herb, 0.55 + shaft(x, y) * sun * 0.4 - k * 0.08, x - k, y));
        p.set(x + k, y + k * 0.4, pick(PAL.herb, 0.4 - k * 0.08, x + k, y));
      }
    }
  }
  return p;
}

function buildPathfinder() {
  const p = new Pix(64, 64);

  // mochila atrás do ombro direito, com o cobertor de lã enrolado em cima
  p.poly([[44, 52], [46, 41], [60, 40], [62, 52]], (x, y) => pick(PAL.leather, 0.55 - (x - 46) * 0.03 + (y === 41 ? 0.2 : 0) + (hash(x, y, 58) - 0.5) * 0.1, x, y));
  p.fill(42, 32, 64, 42, (x, y) => ((y - 37) / 3.6) ** 2 <= 1 && x >= 43 + Math.abs(y - 37) * 0.4 && x <= 63.5 - Math.abs(y - 37) * 0.3, (x, y) => {
    let v = 0.1 + cylLight(-(y + 0.5 - 37) / 3.6) * 0.8;
    if ((x + Math.floor(y / 2)) % 4 === 0) v -= 0.12; // xadrez da lã
    if (x === 49 || x === 58) return PAL.leather[1];
    return pick(WOOL, v, x, y);
  });
  for (const y of [34, 36, 38]) p.set(43 + Math.abs(y - 37) * 0.4, y, WOOL[1]);
  // caneca de lata pendurada
  p.rect(60, 44, 3, 3, (x) => PAL.iron[x === 60 ? 4 : x === 61 ? 3 : 2]);
  p.set(63, 45, PAL.iron[2]);

  // jaqueta de couro de cervo com franjas
  p.poly([[0, 64], [1, 56], [6, 50.5], [16, 47], [24, 45.5], [41, 45.5], [49, 47], [58, 50.5], [63, 56], [64, 64]], (x, y) => {
    const nx = (x + 0.5 - AX) / 31;
    let v = 0.52 - nx * 0.38 - (y - 50) * 0.01 + (hash(x, y, 59) - 0.5) * 0.08;
    v += clamp01(1 - Math.hypot((x - 10) / 8, (y - 52) / 4)) * 0.2;
    return pick(BUCK, v, x, y);
  });
  // costura da pala com as franjas caindo dos ombros
  for (const dir of [1, -1]) {
    for (let i = 0; i <= 18; i++) {
      const x = dir > 0 ? 23 - i : 42 + i;
      const y = Math.round(46.6 + i * 0.12 + (i / 18) ** 2 * 6.4);
      p.set(x, y, BUCK[dir > 0 ? 1 : 0]);
      if (i % 2 === 0) continue;
      const k = dir > 0 ? 5 : 3;
      p.set(x, y + 1, BUCK[k]);
      p.set(x, y + 2, BUCK[k - 1]);
      p.set(x, y + 3, BUCK[k - 2]);
      p.set(x + dir, y + 1, BUCK[1]);
    }
  }
  // alças da mochila descendo pelo peito
  for (const [x0, k] of [[19, 2], [44, 1]]) {
    p.rect(x0, 47, 3, 17, (x, y) => PAL.leather[k + (x === x0 ? 1 : 0) - (y > 60 ? 1 : 0)]);
    p.rect(x0, 56, 3, 2, (x, y) => PAL.gold[x === x0 ? 4 : y === 56 ? 3 : 2]);
    p.set(x0 + 1, 57, PAL.leather[0]);
  }
  // pescoço grosso
  p.rect(26, 38, 13, 9, (x, y) => pick(PAL.skin, 0.18 - (x - 30) * 0.03, x, y));

  // barba ruiva cheia, descendo pelo peito
  const inHead = headTest(AX, 30.5, 11, 12.5);
  const inBeard = (x, y) => {
    if (y < 31) return false;
    if (inHead(x, y) && (y > 35.5 || Math.abs(x - AX) > 7.6)) return true;
    const w = 12.2 - Math.max(0, y - 40) * 0.62;
    return y >= 36 && y < 56 && Math.abs(x - AX) <= w + Math.sin(y * 1.3 + x) * 0.6;
  };
  // cabelo desgrenhado saindo do gorro
  p.fill(18, 20, 47, 40, (x, y) => ((x - AX) / 13.4) ** 2 + ((y - 29) / 11) ** 2 <= 1 && y > 22 && hash(Math.floor(x), Math.floor(y), 60) < 0.92, (x, y) =>
    pick(GINGER, 0.25 + sphereLight((x + 0.5 - AX) / 13, (y + 0.5 - 27) / 11) * 0.6 + (hash(x, y, 61) - 0.5) * 0.3, x, y, 1.5));
  // rosto
  p.fill(20, 18, 45, 44, inHead, (x, y) => {
    let v = 0.3 + sphereLight((x + 0.5 - AX) / 11 * 0.8, (y + 0.5 - 30.5) / 12.5 * 0.5 - 0.15) * 0.7;
    if (y < 25) v -= 0.2; // sombra do gorro
    return pick(PAL.skin, v, x, y, 6);
  });
  p.fill(18, 30, 47, 57, inBeard, (x, y) => {
    const nx = (x + 0.5 - AX) / 12, ny = (y + 0.5 - 38) / 14;
    let v = 0.14 + sphereLight(nx, ny) * 0.78 + (hash(x, y, 62) - 0.5) * 0.22;
    if ((x * 2 + y) % 5 === 0) v -= 0.16; // mechas
    else if ((x + y * 3) % 7 === 0) v += 0.1;
    return pick(GINGER, v, x, y, 1.5);
  });
  // bigode cheio cobrindo a boca
  for (let x = 25; x <= 40; x++) {
    const d = Math.abs(x + 0.5 - AX);
    const y = Math.round(35.6 + d * 0.16);
    p.set(x, y, GINGER[d < 3 ? 4 : x < 32 ? 4 : 3]);
    p.set(x, y + 1, GINGER[x < 32 ? 3 : 2]);
    if (d > 3) p.set(x, y + 2, GINGER[x < 32 ? 2 : 1]);
  }
  for (let x = 30; x <= 34; x++) p.set(x, 38, PAL.skin[0]);
  p.set(31, 38, PAL.lip);
  p.set(32, 38, PAL.lip);
  // sobrancelhas grossas e olhos apertados
  for (const [x, y, k] of [[24, 27, 2], [25, 26, 3], [26, 26, 4], [27, 26, 4], [28, 26, 3], [29, 27, 2], [25, 27, 1], [26, 27, 2], [27, 27, 2], [28, 27, 1]]) {
    p.set(x, y, GINGER[k]);
    p.set(64 - x, y, GINGER[Math.max(0, k - 1)]);
  }
  pathfinderEyes(p, false);
  // nariz grande e queimado de sol
  for (const [x, y, k] of [[32, 28, 4], [32, 29, 4], [32, 30, 5], [33, 30, 3], [31, 31, 3], [32, 31, 5], [33, 31, 2], [30, 32, 2], [31, 32, 3], [32, 32, 4],
    [33, 32, 3], [34, 32, 1], [30, 33, 1], [31, 33, 0], [32, 33, 2], [33, 33, 0], [34, 33, 1]]) p.set(x, y, PAL.skin[k]);
  p.set(31, 32, PAL.blush);
  for (const [x, y] of [[24, 31], [25, 32], [26, 31], [24, 32]]) { p.set(x, y, PAL.blush); p.set(64 - x, y, PAL.blush); }
  // cicatriz na maçã do rosto
  p.set(39, 29, PAL.skin[5]); p.set(40, 30, PAL.skin[5]); p.set(40, 29, PAL.skin[2]);

  // gorro de pele com o rabo listrado caindo do lado
  p.fill(18, 6, 47, 26, (x, y) => ((x - AX) / 12.6) ** 2 + ((y - 20) / 13) ** 2 <= 1 && y < 24.5 + Math.sin(x * 1.7) * 0.5, (x, y) => {
    const nx = (x + 0.5 - AX) / 12.6, ny = (y + 0.5 - 16) / 11;
    let v = 0.1 + sphereLight(nx, ny) * 0.86 + (hash(x, y, 63) - 0.5) * 0.24;
    if ((x + Math.floor(y * 0.5)) % 3 === 0) v -= 0.1; // pelos
    if (y > 21) v += 0.12; // borda mais clara
    return pick(COON, v, x, y, 1.4);
  });
  // tufos de pelo na borda
  for (let x = 20; x <= 45; x += 2) p.set(x, 24 + (x % 4 === 0 ? 1 : 0) + Math.round(Math.sin(x * 1.7) * 0.5), COON[x < 32 ? 5 : 4]);
  const tail = [[42, 19], [45, 24], [46.6, 30], [47.2, 36], [46.4, 41]];
  p.fill(40, 16, 50, 45, (x, y) => nearestOnPath(tail, x, y)[0] <= 2.3 - nearestOnPath(tail, x, y)[3] * 0.4, (x, y) => {
    const [, ox, , at] = nearestOnPath(tail, x + 0.5, y + 0.5);
    const ring = Math.floor(at * 9) % 2;
    let v = (ring ? 0.18 : 0.62) + cylLight(ox / 2.3) * 0.3 + (hash(x, y, 64) - 0.5) * 0.18;
    if (at > 0.86) v = 0.08 + (hash(x, y, 65) - 0.5) * 0.1; // ponta escura
    return pick(COON, v, x, y);
  });

  // machado no ombro esquerdo: cabo, cabeça e a mão que segura
  p.line(22, 63, 6, 30, PAL.wood[4]);
  p.line(23, 63, 7, 30, PAL.wood[3]);
  p.line(24, 63, 8, 31, PAL.wood[1]);
  // cabeça do machado, de lâmina larga, presa no alto do cabo (eixo u ao longo do cabo, w para o gume)
  const [hx, hy] = [7.2, 29.4], du = [-0.436, -0.9], dw = [-0.9, 0.436];
  const axeUW = (x, y) => [(x - hx) * du[0] + (y - hy) * du[1], (x - hx) * dw[0] + (y - hy) * dw[1]];
  const edgeW = (u) => 7.2 - (u / 4.6) ** 2 * 1.4;
  p.fill(-2, 18, 15, 40, (x, y) => {
    const [u, w] = axeUW(x, y);
    if (w < -2.6 || w > edgeW(u)) return false;
    if (w < 1.6) return Math.abs(u) <= (w < -1.4 ? 1.5 : 2.1);
    return u <= 2.1 + (w - 1.6) * 0.3 && u >= -2.1 - (w - 1.6) * 0.8;
  }, (x, y) => {
    const [u, w] = axeUW(x + 0.5, y + 0.5);
    if (w > edgeW(u) - 1.3) return PAL.steel[u > -1 ? 5 : 4]; // gume afiado
    if (w < 1.6 && w > -1.4) return PAL.steel[u > 0 ? 2 : 1]; // olho
    return pick(PAL.steel, 0.5 + u * 0.06 + (w > 4 ? 0.1 : 0), x, y);
  });
  p.set(hx - 0.4 + du[0] * 2.6, hy + du[1] * 2.6, PAL.wood[3]); // ponta do cabo
  p.sphere(19.5, 56.5, 3.4, 3.2, PAL.skin, 0.05);
  for (const fy of [54.4, 56.4, 58.4]) for (let x = 17; x <= 21; x++) if (x !== 20) p.set(x, fy, PAL.skin[1]);
  p.line(17, 53, 21, 52, PAL.skin[4]);

  p.outline(PAL.out);
  return p;
}

function pathfinderEyes(p, closed) {
  for (const [x0, left] of [[25, true], [37, false]]) {
    if (closed) {
      for (let i = 0; i < 3; i++) { p.set(x0 + i, 28, PAL.skin[2]); p.set(x0 + i, 29, GINGER[0]); }
      continue;
    }
    for (let i = 0; i < 3; i++) p.set(x0 + i, 28, GINGER[0]);
    const row = left ? [PAL.eyeWhite, EYE_BLUE_HI, EYE_BLUE] : [EYE_BLUE, EYE_BLUE_HI, PAL.eyeWhite];
    row.forEach((c, i) => p.set(x0 + i, 29, c));
    for (let i = 0; i < 3; i++) p.set(x0 + i, 30, PAL.skin[2]);
  }
}

const pathArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintPathfinderPortrait(ctx, t, info) {
  const a = pathArt;
  if (!a.bg) {
    a.bg = buildPathfinderBackdrop(0);
    a.halo = makeHalo(a.bg, buildPathfinderBackdrop(1), (x, y) => 0.5 + Math.sin((x + y * 0.55) * 0.09) * 0.3);
    a.body = buildPathfinder();
    a.axe = [];
    for (let y = 18; y < 40; y++) for (let x = 0; x < 15; x++) if (PAL.steel.includes(a.body.get(x, y))) a.axe.push(x, y);
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  // raios de sol que vêm e vão com as nuvens e o vento nas copas
  const level = 0.45 + Math.sin(t * 0.5) * 0.25 + Math.sin(t * 1.7 + 1) * 0.1 + ease(a, 'sun', t, working ? 0.15 : 0, 0.8);
  const { idx, th, col } = a.halo;
  for (let k = 0; k < idx.length; k++) if (th[k] < level) f.d[idx[k]] = col[k];
  // poeira brilhando nos raios
  for (let k = 0; k < 9; k++) {
    const x = (hash(k, 1, 66) * 60 + Math.sin(t * 0.4 + k) * 3 + t * 0.6) % 64;
    const y = (hash(k, 2, 66) * 50 + t * (0.6 + hash(k, 3, 66))) % 50;
    if (Math.sin(t * 2 + k * 1.7) > 0 && Math.sin((x + y * 0.55) * 0.36 + 0.4) > 0.8) f.set(x, y, SHAFT);
  }
  // folhas caindo, girando
  const fall = advance(a, 'fall', t, working ? 1.5 : 0.8);
  for (let k = 0; k < 5; k++) {
    const life = (fall * (0.07 + hash(k, 1, 67) * 0.05) + hash(k, 2, 67)) % 1;
    const x = hash(k, 3, 67) * 64 + Math.sin(t * 1.4 + k * 2.1) * 3;
    const y = life * 70 - 4;
    const flip = Math.sin(t * 4 + k) > 0;
    const c = [PAL.wheat[3], PAL.fire[2], PAL.herb[4]][k % 3];
    f.set(x, y, c);
    f.set(x + (flip ? 1 : -1), y + (flip ? 0 : 1), PAL.out);
    f.set(x + (flip ? 1 : 0), y + (flip ? 1 : 0), c);
  }
  f.blit(a.body, 0, 0);
  // brilho correndo pelo fio do machado
  const s = (advance(a, 'edge', t, working ? 0.9 : 0.5) % 3) * 20 - 10;
  for (let k = 0; k < a.axe.length; k += 2) {
    const d = Math.abs(a.axe[k] * 0.6 + a.axe[k + 1] * 0.8 - s - 22);
    if (d < 1.2) f.set(a.axe[k], a.axe[k + 1], d < 0.6 ? WHITE : PAL.steel[5]);
  }
  if (t % 4.4 > 4.26 || t % 9.7 > 9.56) pathfinderEyes(f, true);
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Ícones 16x16

function iconCartographer() {
  const p = new Pix(16, 16);
  p.sphere(8, 10, 4, 4.4, PAL.skin, 0.2);
  p.fill(3, 9, 13, 15, (x, y) => ((x - 8) / 4.6) ** 2 + ((y - 10) / 5) ** 2 <= 1 && Math.abs(x - 8) > 3.2 && y < 13.5, (x, y) => DARK_HAIR[x < 8 ? 3 : 2]);
  for (const [x, c] of [[5, PAL.gold[4]], [6, PAL.iris], [7, PAL.gold[3]], [9, PAL.gold[3]], [10, PAL.iris], [11, PAL.gold[2]]]) p.set(x, 10, c);
  p.set(8, 10, PAL.gold[3]);
  p.set(8, 13, DARK_HAIR[1]);
  p.set(8, 14, DARK_HAIR[2]);
  // chapéu de aba larga com a pena
  p.fill(0, 6, 16, 9, (x, y) => ((x - 7.6) / 7.6) ** 2 + ((y - 7.6) / 1.5) ** 2 <= 1, (x, y) => FELT[y < 7.5 ? (x < 8 ? 5 : 4) : 2]);
  p.fill(4, 1, 12, 7, (x, y) => ((x - 7.6) / 4) ** 2 + ((y - 6) / 4.6) ** 2 <= 1 && y < 7, (x, y) => pick(FELT, 0.3 + sphereLight((x + 0.5 - 7.6) / 4, (y + 0.5 - 4) / 4) * 0.8, x, y));
  p.rect(4, 5, 8, 1, (x) => PAL.band[x < 8 ? 3 : 2]);
  for (const [x, y, k] of [[11, 5, 3], [12, 4, 4], [12, 3, 3], [13, 2, 4], [14, 1, 3], [13, 3, 2], [14, 2, 2], [15, 1, 1]]) p.set(x, y, QUILL[k]);
  p.outline(PAL.out);
  return p;
}

function iconOutpost() {
  const p = new Pix(16, 16);
  // torre com telhado e bandeira
  p.rect(9, 6, 6, 3, (x, y) => pick(LOG, 0.6 - (x - 9) * 0.06 - (y === 7 ? 0.15 : 0), x, y));
  p.poly([[8, 6.2], [12, 2.6], [16, 6.2]], (x) => PAL.roof[x < 12 ? 4 : 2]);
  p.rect(10, 9, 1, 3, LOG[3]);
  p.rect(13, 9, 1, 3, LOG[2]);
  p.rect(12, 0, 1, 3, PAL.iron[2]);
  p.rect(13, 0, 3, 2, (x, y) => PENNANT[y === 0 ? 4 : 2]);
  // paliçada de troncos pontudos
  for (let k = 0; k < 5; k++) {
    const x0 = k * 3 + (k > 2 ? 1 : 0);
    const top = 9 + (k % 2);
    if (k === 2) continue;
    for (let i = 0; i < 3 && x0 + i < 16; i++) {
      for (let y = i === 1 ? top - 1 : top; y < 16; y++) p.set(x0 + i, y, LOG[[4, 3, 1][i] - (y > 13 ? 1 : 0)]);
    }
  }
  p.rect(6, 9, 4, 7, (x, y) => (y === 9 ? LOG[3] : C('#2a1a10')));
  p.rect(6, 9, 4, 1, LOG[4]);
  for (let x = 0; x < 16; x++) if (x < 6 || x > 9) p.set(x, 12, PAL.straw[x & 1 ? 3 : 2]);
  p.outline(PAL.out);
  return p;
}

function iconCaravan() {
  const p = new Pix(16, 16);
  p.fill(0, 2, 13, 10, (x, y) => y >= 3.4 + ((x - 6.5) / 7) ** 2 * -1.2 && y < 9 && x >= 1 - (9 - y) * 0.15 && x <= 12 + (9 - y) * 0.12, (x, y) =>
    pick(PAL.sail, 0.85 - (y - 3) * 0.08 - ((x - 2) % 4 === 0 ? 0.12 : 0), x, y));
  p.rect(1, 9, 12, 3, (x, y) => pick(PAL.wood, y === 9 ? 0.85 : 0.45, x, y));
  for (const [cx, cy, r] of [[4, 12.5, 3], [11, 13, 2.4]]) {
    p.fill(cx - r, cy - r, cx + r, cy + r, (x, y) => Math.hypot(x - cx, y - cy) <= r, (x, y) => {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      return d > r - 1 ? PAL.iron[x < cx ? 3 : 1] : d < 0.9 ? PAL.wood[4] : (x + y) % 2 ? PAL.wood[2] : PAL.wood[0];
    });
  }
  // cabeça da mula com as orelhas
  p.rect(13, 7, 2, 4, (x) => MULE[x === 13 ? 4 : 3]);
  p.set(15, 9, MULE[5]); p.set(15, 10, MULE[5]);
  p.set(13, 5, MULE[3]); p.set(13, 6, MULE[4]); p.set(14, 5, MULE[2]); p.set(14, 6, MULE[3]);
  p.outline(PAL.out);
  return p;
}

function iconPathfinder() {
  const p = new Pix(16, 16);
  p.sphere(8.5, 9, 4, 4.2, PAL.skin, 0.15);
  p.fill(3, 9, 15, 16, (x, y) => ((x - 8.5) / 5) ** 2 + ((y - 10) / 6) ** 2 <= 1 && (y > 10.5 || Math.abs(x - 8.5) > 3.4), (x, y) =>
    pick(GINGER, 0.75 - (y - 10) * 0.07 - (x - 6) * 0.05, x, y));
  p.set(7, 9, EYE_BLUE); p.set(10, 9, EYE_BLUE);
  for (let x = 6; x <= 11; x++) p.set(x, 11, GINGER[x < 9 ? 4 : 3]);
  p.fill(3, 1, 14, 8, (x, y) => ((x - 8.5) / 5.4) ** 2 + ((y - 6.5) / 5.4) ** 2 <= 1 && y < 7.5, (x, y) =>
    pick(COON, 0.25 + sphereLight((x + 0.5 - 8.5) / 5.4, (y + 0.5 - 4) / 5) * 0.85, x, y));
  for (const [x, y] of [[13, 7], [14, 9], [14, 11]]) { p.set(x, y, COON[5]); p.set(x, y + 1, COON[1]); }
  // machado
  p.line(5, 15, 1, 6, PAL.wood[3]);
  p.poly([[0, 3], [3, 2.6], [3.4, 6], [0, 7]], (x, y) => PAL.steel[x === 0 ? 5 : 3]);
  p.outline(PAL.out);
  return p;
}

ART.portraits.cartographer = paintCartographerPortrait;
ART.portraits.outpost = paintOutpostPortrait;
ART.portraits.caravan = paintCaravanPortrait;
ART.portraits.pathfinder = paintPathfinderPortrait;
ART.locked.cartographer = ART.silhouette(() => {
  const p = buildCartographer();
  const arm = trim(buildCartographerArm());
  paintDivider(p, new Pix(22, 22), 41, 45, 0.44, 0);
  p.blit(arm.pix, arm.x, arm.y);
  return p;
});
ART.locked.outpost = ART.silhouette(() => {
  const p = buildOutpost();
  paintFlame(p, FIRE[0], FIRE[1] - 1, 0, 6, 2.8, 0.6);
  p.blit(buildCampfire(), 0, 0);
  paintOutpostFlag(p, new Pix(14, 10), 0);
  return p;
});
ART.locked.caravan = ART.silhouette(() => {
  const p = buildCaravan();
  paintMuleLegs(p, 0.6, 2);
  paintMuleTail(p, 0);
  paintSpokes(p, wheelMask(p), [0.2, 0.2]);
  return p;
});
ART.locked.pathfinder = ART.silhouette(buildPathfinder);
Object.assign(ART.icons, { cartographer: iconCartographer, outpost: iconOutpost, caravan: iconCaravan, pathfinder: iconPathfinder });
})();
