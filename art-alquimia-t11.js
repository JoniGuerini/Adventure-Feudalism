'use strict';
// Linha da ALQUIMIA, tiers 11 a 15: Arquimago, Torre arcana, Pedra filosofal,
// Elixir da vida e Grande Obra. A magia toma conta: violetas, dourados e luz.
(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

const WHITE = C('#ffffff');
const VIOLET = ramp('#140a26', '#24123e', '#3a1c5c', '#552a7e', '#7440a0', '#9866c2', '#c0a0e0');
const ROBE = ramp('#0b0e2e', '#141a4c', '#20286c', '#30398e', '#4549ae', '#625ec8', '#8c84e0');
const PSTONE = ramp('#150f1d', '#21182b', '#30233c', '#42314f', '#584264', '#70587c', '#8c7496');
const NIGHT_SKY = ramp('#0a0818', '#110d26', '#1a1436', '#251c48', '#33265a', '#46306c', '#5e3c7a', '#7c4c86');
const CRYSTAL = ramp('#1a1450', '#2a2c8a', '#3c5cbc', '#4c94dc', '#7cd0f0', '#c4f4fc', '#ffffff');
const BEARD = ramp('#4e4a5a', '#7a7688', '#a6a2b2', '#cac6d2', '#e6e2ea', '#fbf9fa');
const MOTE = [C('#8a7ae8'), C('#c0b4ff'), C('#7cd0f0'), PAL.gold[4], C('#eee8ff')];
const BOOKS = [ramp('#2a0e18', '#561c2a', '#83303a'), ramp('#0e2418', '#1c4430', '#2e6a46'),
  ramp('#141a3e', '#232f6c', '#3a4c98'), ramp('#2a1a0c', '#4e3418', '#7a5426'), ramp('#24103a', '#3e1e60', '#5e3288')];

// ---------------------------------------------------------------------------
// Peças comuns

const headTest = (hx, hy, rx, ry, taper = 0.3) => (x, y) => {
  const dy = (y - hy) / ry;
  const w = dy > 0 ? rx * (1 - taper * dy * dy) : rx;
  return ((x - hx) / w) ** 2 + dy * dy <= 1;
};

const archTest = (cx, rx, top, bottom) => (x, y) =>
  y <= bottom && ((Math.abs(x - cx) <= rx && y >= top + rx) || ((x - cx) / rx) ** 2 + ((y - top - rx) / rx) ** 2 <= 1);

// Alvenaria: junta escura, aresta de cima clara e um tom diferente por bloco.
function masonry(x, y, bw, bh, seed, oy = 0) {
  const ry = (((y - oy) % bh) + bh) % bh;
  const row = Math.floor((y - oy) / bh), off = (row & 1) * (bw >> 1);
  if (ry === bh - 1 || (x + off) % bw === 0) return -0.15;
  return (hash(Math.floor((x + off) / bw), row, seed) - 0.5) * 0.14 + (ry === 0 ? 0.06 : 0);
}

// Envelope suave de um evento periódico: 0 fora da janela, sobe e desce dentro dela.
function pulse(t, period, offset, length) {
  const ph = (((t + offset) % period) + period) % period;
  return ph < length ? Math.sin((ph / length) * Math.PI) : 0;
}

// Luz que pulsa: compara o fundo apagado com o aceso e guarda, para cada pixel que muda,
// um limiar. A cada quadro acendem os pixels com limiar abaixo do nível pedido.
function makeHalo(base, lit, threshold) {
  const idx = [], th = [], col = [];
  for (let i = 0; i < base.d.length; i++) {
    if (base.d[i] === lit.d[i]) continue;
    const x = i % base.w, y = (i / base.w) | 0;
    const v = threshold(x, y);
    if (v === null) continue;
    idx.push(i);
    th.push(v + (bayer(x, y) - 0.5) * 0.24);
    col.push(lit.d[i]);
  }
  return { idx: Int32Array.from(idx), th: Float32Array.from(th), col: Uint32Array.from(col) };
}

function paintHalo(f, h, level) {
  const d = f.d;
  for (let k = 0; k < h.idx.length; k++) if (h.th[k] < level) d[h.idx[k]] = h.col[k];
}

// Estrelinha de brilho que cresce e some (e de 0 a 1).
function sparkle(f, x, y, e, tip = PAL.gold[5], diag = false) {
  if (e <= 0.08) return;
  const arm = Math.round(e * 2.2);
  f.set(x, y, WHITE);
  for (let k = 1; k <= arm; k++) {
    const c = k === arm ? tip : WHITE;
    if (diag) { f.set(x + k, y + k, c); f.set(x - k, y - k, c); f.set(x + k, y - k, c); f.set(x - k, y + k, c); }
    else { f.set(x + k, y, c); f.set(x - k, y, c); f.set(x, y + k, c); f.set(x, y - k, c); }
  }
}

// Pixels de uma rampa dentro de um retângulo, para o brilho correr por eles.
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

// Estrelas do céu: guardadas uma vez, piscam cada uma no seu ritmo.
function makeStars(n, seed, ok) {
  const list = [];
  for (let i = 0; i < n * 4 && list.length < n * 4; i++) {
    const x = Math.floor(hash(i, 1, seed) * 64), y = Math.floor(hash(i, 2, seed) * 64);
    if (ok(x, y)) list.push(x, y, hash(i, 3, seed) * 6.28, 1.5 + hash(i, 4, seed) * 2.5);
  }
  return Float32Array.from(list);
}

const EMBERS = [PAL.fire[3], PAL.fire[4], C('#ffc85a'), C('#ff8a70')];
const LIFE_MOTES = [C('#eef290'), C('#fffde0'), PAL.gold[4], C('#a0cc62')];
const SUN_MOTES = [C('#f8dc7a'), C('#fff2b8'), C('#fffbe8'), C('#b05c94')];
const STAR_TONES = [C('#5a4a86'), C('#9a8cc8'), C('#e8e0ff'), WHITE];
function paintStars(f, s, t) {
  for (let i = 0; i < s.length; i += 4) {
    const v = Math.sin(t * s[i + 3] + s[i + 2]);
    if (v > -0.6) f.set(s[i], s[i + 1], STAR_TONES[v > 0.85 ? 3 : v > 0.3 ? 2 : v > -0.2 ? 1 : 0]);
  }
}

// Fagulhas mágicas que sobem tremeluzindo: (x, y) de origem, espalhamento e altura.
function paintMotes(f, t, n, seed, x0, y0, spread, rise, speed, colors = MOTE) {
  for (let k = 0; k < n; k++) {
    const u = (t * speed * (0.7 + hash(k, 1, seed) * 0.6) + hash(k, 2, seed)) % 1;
    const x = x0 + (hash(k, 3, seed) - 0.5) * spread + Math.sin(t * 1.7 + k * 2.1) * 2 * u;
    const y = y0 - u * rise;
    const tw = Math.sin(t * 7 + k * 3);
    if (u > 0.92 || tw < -0.7) continue;
    const c = colors[k % colors.length];
    f.set(x, y, c);
    if (u < 0.45 && tw > 0.6) { f.set(x + 1, y, c); f.set(x - 1, y, c); f.set(x, y - 1, c); f.set(x, y + 1, c); f.set(x, y, WHITE); }
  }
}

// Brilho suave pontilhado em volta de um ponto (cores do escuro ao claro). Os
// deslocamentos ficam guardados em ordem de distância para não medir nada por quadro.
const GLOW_OFS = (() => {
  const list = [];
  for (let dy = -20; dy <= 20; dy++) for (let dx = -20; dx <= 20; dx++) {
    const d = Math.hypot(dx + 0.5, dy + 0.5);
    if (d <= 20) list.push([dx, dy, d]);
  }
  list.sort((a, b) => a[2] - b[2]);
  return Float32Array.from(list.flat());
})();

function paintGlow(f, x, y, R, dens, colors) {
  const x0 = Math.floor(x), y0 = Math.floor(y), n = colors.length;
  for (let i = 0; i < GLOW_OFS.length; i += 3) {
    const d = GLOW_OFS[i + 2] / R;
    if (d >= 1) break;
    const xx = x0 + GLOW_OFS[i], yy = y0 + GLOW_OFS[i + 1];
    if (bayer(xx, yy) < (1 - d) * dens) f.set(xx, yy, colors[Math.min(n - 1, ((1 - d) * n) | 0)]);
  }
}

// Raios de luz em volta de um centro: os pixels vão agrupados pelo setor do ângulo (128),
// cada um com seu limiar; por quadro só os setores acesos são percorridos.
const groupRays = (list) => {
  const buckets = Array.from({ length: 128 }, () => []);
  for (const e of list) buckets[e[0]].push(e);
  const flat = buckets.flat(), start = new Uint16Array(129);
  buckets.forEach((l, b) => { start[b + 1] = start[b] + l.length; });
  return { start, beam: new Float32Array(128), pos: Uint16Array.from(flat, (e) => e[1]), thr: Uint8Array.from(flat, (e) => e[2]), col: Uint32Array.from(flat, (e) => e[3]) };
};
const paintRays = (d, rays) => {
  const { start, beam, pos, thr, col } = rays;
  for (let b = 0; b < 128; b++) {
    const v = beam[b];
    if (v <= 0) continue;
    for (let i = start[b]; i < start[b + 1]; i++) if (v > thr[i]) d[pos[i]] = col[i];
  }
};
// senos dos setores em tabela (8 e 13 voltas), girados por quadro pela soma de ângulos
const SECTOR_TRIG = new Float32Array(128 * 4).map((_, i) => {
  const ang = ((i >> 2) / 128) * Math.PI * 2 * ((i & 3) < 2 ? 8 : 13);
  return i & 1 ? Math.cos(ang) : Math.sin(ang);
});
// cosseno e seno de cada um dos 64 setores dos círculos do chão (de -π a π)
const RUN_TRIG = new Float32Array(128).map((_, i) => {
  const ang = ((i >> 1) / 64) * Math.PI * 2 - Math.PI;
  return i & 1 ? Math.sin(ang) : Math.cos(ang);
});

// Luz vinda de cima à esquerda (a mesma do motor), para tubos e superfícies.
const LIGHT = [-0.55, -0.7, 0.6].map((c, _, v) => c / Math.hypot(...v));
const shade3 = (nx, ny, nz) => Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);

// ---------------------------------------------------------------------------
// Arquimago

const AM_HEAD = headTest(32, 31, 8.4, 10.2, 0.3);
const AM_WIN = archTest(12, 8.5, 3.5, 45);
const AM_GEM = [53.5, 8]; // centro do cristal do cajado
const AM_HAT_STARS = [[27, 12], [35, 9], [30, 4]];

// Espinha do chapéu: da aba até a ponta, que cai para a esquerda.
const AM_HAT = (() => {
  const pts = [];
  const P = [[32, 19.5], [33, 7], [31, -2], [16, 5.5]];
  for (let i = 0; i <= 72; i++) {
    const s = i / 72, u = 1 - s;
    const b = [u * u * u, 3 * u * u * s, 3 * u * s * s, s * s * s];
    const x = b.reduce((acc, k, j) => acc + k * P[j][0], 0);
    const y = b.reduce((acc, k, j) => acc + k * P[j][1], 0);
    pts.push([x, y, 10.6 * u ** 1.25 + 0.45, s]);
  }
  return pts;
})();

function hatAt(x, y) {
  let best = Infinity, b = null;
  for (const q of AM_HAT) {
    const d = (x - q[0]) ** 2 + (y - q[1]) ** 2;
    if (d < best) { best = d; b = q; }
  }
  const d = Math.sqrt(best);
  return d <= b[2] ? [b, (x - b[0]) / b[2], (y - b[1]) / b[2], d / b[2]] : null;
}

function buildArchmageBackdrop(lit) {
  const p = new Pix(64, 64);
  const [gx, gy] = AM_GEM;
  // parede de pedra roxa da torre, clareada pela lua da janela e (aceso) pelo cristal
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.26 - y * 0.002 + masonry(x, y, 7, 4, 11) + clamp01(1 - Math.hypot(x - 12, y - 24) / 30) * 0.14;
      if (lit) v += clamp01(1 - Math.hypot(x - gx, y - gy) / 24) * 0.4;
      p.d[y * 64 + x] = pick(PSTONE, v, x, y, 2);
    }
  }
  // janela alta em arco com o céu da noite, a lua e a serra
  p.fill(1, 1, 23, 48, archTest(12, 10.5, 1.5, 48), (x, y) =>
    pick(PSTONE, (x < 12 ? 0.72 : 0.42) + masonry(x, y, 4, 3, 12) * 0.6 - (y - 2) * 0.003, x, y));
  p.fill(3, 3, 21, 45, AM_WIN, (x, y) => pick(NIGHT_SKY, 0.05 + ((y - 3) / 40) ** 1.3 * 0.95, x, y, 1.6));
  // lua crescente
  p.fill(4, 6, 13, 15, (x, y) => Math.hypot(x - 8, y - 10) <= 3.4 && Math.hypot(x - 9.6, y - 8.8) > 2.9, (x, y) =>
    C(x + y < 17 ? '#fff6d8' : '#e8d8a8'));
  // serra e uma torre distante
  for (let x = 3; x < 22; x++) {
    const top = Math.round(37 + 2.2 * Math.sin(x * 0.45 + 1) + Math.sin(x * 1.3));
    for (let y = top; y < 46; y++) if (AM_WIN(x + 0.5, y + 0.5)) p.set(x, y, pick(VIOLET, (y === top ? 0.36 : 0.18) - (y - top) * 0.02, x, y));
  }
  p.rect(16, 29, 2, 9, VIOLET[1]);
  p.poly([[15, 29.5], [17, 25], [19, 29.5]], VIOLET[1]);
  p.set(16, 31, PAL.fire[4]);
  // peitoril
  p.rect(1, 46, 23, 3, (x, y) => pick(PSTONE, (y === 46 ? 0.8 : 0.36) - x * 0.008, x, y));
  // estante com livros e frascos à direita
  const sx0 = 44;
  p.rect(sx0, 22, 20, 34, (x, y) => pick(PAL.wood, 0.12 + (x === sx0 ? 0.25 : 0), x, y));
  for (const sy of [22, 33, 44]) p.rect(sx0, sy, 20, 2, (x, y) => pick(PAL.wood, (y === sy ? 0.6 : 0.3) + (lit ? clamp01(1 - Math.hypot(x - gx, y - gy) / 30) * 0.35 : 0), x, y));
  let bx = sx0 + 1;
  for (let i = 0; bx < 63; i++) {
    const w = 2 + Math.floor(hash(i, 1, 5) * 2), h = 6 + Math.floor(hash(i, 2, 5) * 3);
    const r = BOOKS[Math.floor(hash(i, 3, 5) * BOOKS.length)];
    const lean = hash(i, 4, 5) < 0.15 && w === 2;
    for (let y = 33 - h; y < 33; y++) {
      for (let x = bx; x < bx + w && x < 64; x++) {
        let k = x === bx ? 2 : 1;
        if (y === 33 - h + 1 || y === 31) k = 0; // faixas da lombada
        if (lit && hash(x, y, 3) < 0.4 && Math.hypot(x - gx, y - gy) < 26) k = Math.min(2, k + 1);
        p.set(x + (lean && y < 29 ? 1 : 0), y, r[k]);
      }
    }
    if (hash(i, 5, 5) < 0.5) p.set(bx, 29, PAL.gold[3]);
    bx += w + (hash(i, 6, 5) < 0.2 ? 1 : 0);
  }
  // frascos na prateleira de baixo
  const flasks = [[47, VIOLET], [52, ramp('#0c3a2a', '#1c6a44', '#3caa62', '#8ae08a')], [57, ramp('#4a0c1a', '#8a1a2a', '#d0384a', '#ff8a8a')], [61, CRYSTAL]];
  for (const [fx, r] of flasks) {
    p.sphere(fx, 41, 2.4, 2.2, ramp('#2a3040', '#4a5468', '#7a88a0', '#b8c8d8'), 0, 2);
    p.fill(fx - 2, 41, fx + 2, 43, (x, y) => Math.hypot(x - fx, y - 41) <= 2.2 && y >= 41, (x, y) => r[x < fx ? 3 : 2]);
    p.rect(fx - 0.5, 36, 1, 3, C('#7a88a0'));
    p.set(fx - 0.5, 35, PAL.wood[3]);
    p.set(fx - 1, 40, WHITE);
  }
  // pergaminhos enrolados
  for (const [x, y] of [[46, 52], [50, 53], [55, 52]]) {
    p.rect(x, y, 4, 2, (xx, yy) => PAL.sail[yy === y ? 3 : 1]);
    p.set(x + 3, y, PAL.sail[4]);
    p.set(x + 3, y + 1, PAL.sail[2]);
  }
  return p;
}

function buildArchmageCrystal() {
  const p = new Pix(64, 64);
  const [gx, gy] = AM_GEM;
  // cristal de seis faces, ponta em cima e embaixo
  const pts = [[gx, gy - 6.5], [gx + 3, gy - 3], [gx + 3, gy + 3], [gx, gy + 6.5], [gx - 3, gy + 3], [gx - 3, gy - 3]];
  p.poly(pts, (x, y) => {
    const dx = x + 0.5 - gx;
    let v = dx < -1 ? 0.78 : dx < 1 ? 0.55 : 0.3;
    v += (gy - y) * 0.03;
    if (y + 0.5 < gy - 2.2 + Math.abs(dx) * 0.4) v += 0.15; // facetas de cima
    if (y + 0.5 > gy + 2.6 - Math.abs(dx) * 0.4) v -= 0.12;
    return pick(CRYSTAL, v, x, y);
  });
  p.set(gx - 2, gy - 3, WHITE);
  p.set(gx - 2, gy - 2, CRYSTAL[5]);
  return p;
}

function buildArchmage() {
  const p = new Pix(64, 64);
  const cx = 32;
  const mirror = (pts) => pts.map(([x, y]) => [64 - x, y]);

  // gola alta violeta atrás dos ombros
  for (const s of [-1, 1]) {
    const pts = [[cx + s * 9, 46], [cx + s * 17.5, 34], [cx + s * 19.5, 40], [cx + s * 16, 47]];
    p.poly(pts, (x, y) => pick(VIOLET, (s < 0 ? 0.55 : 0.32) - (y - 34) * 0.015 + ((x + y) % 5 === 0 ? -0.1 : 0), x, y));
  }
  // manto azul-violeta
  p.poly([[0, 64], [1, 55], [7, 49.5], [18, 45.5], [46, 45.5], [57, 49.5], [63, 55], [64, 64]], (x, y) => {
    let v = 0.5 - ((x + 0.5 - cx) / 30) * 0.42 - (y - 50) * 0.01;
    if (x === 9 || x === 15 || x === 50) v -= 0.2; // dobras
    if (x === 10 || x === 16) v += 0.1;
    // estrelinhas bordadas espalhadas pelo pano
    const row = Math.floor(y / 6), gx = (x + (row % 2) * 5) % 10;
    if (gx === 5 && y % 6 === 3) return PAL.gold[v > 0.4 ? 4 : 3];
    if (Math.abs(gx - 5) + Math.abs((y % 6) - 3) === 1) return pick(ROBE, v + 0.2, x, y);
    return pick(ROBE, v, x, y);
  });
  // faixas bordadas de ouro na abertura do manto, com estrelinhas
  const band = [[22.5, 46], [26.5, 46], [24, 64], [20, 64]];
  for (const pts of [band, mirror(band)]) {
    p.poly(pts, (x, y) => {
      const star = y % 5 === 2 && (x === 22 || x === 23 || x === 40 || x === 41);
      return star ? PAL.gold[5] : pick(PAL.gold, (x < cx ? 0.55 : 0.32) + ((x + y) % 3 === 0 ? 0.12 : 0) - (y - 46) * 0.008, x, y);
    });
  }
  // cabelo branco comprido atrás do rosto
  p.fill(18, 20, 46, 52, (x, y) => ((x - cx) / 13) ** 2 + ((y - 34) / 16) ** 2 <= 1 && y > 21 && y < 49.5 + Math.sin(x * 1.1) * 0.8, (x, y) => {
    const sx = x + (x - cx) * (y - 26) * 0.02;
    let v = 0.2 + sphereLight((x + 0.5 - cx) / 13, (y + 0.5 - 28) / 16) * 0.72 + (hash(Math.floor(sx / 2), 1, 7) - 0.5) * 0.25;
    if (Math.floor(sx) % 3 === 0) v -= 0.12;
    return pick(BEARD, v, x, y, 2);
  });
  // rosto
  p.fill(22, 20, 42, 42, AM_HEAD, (x, y) => {
    let v = 0.34 + sphereLight((x + 0.5 - 31) / 8.4, (y + 0.5 - 30) / 10.2) * 0.78;
    if (y < 26) v -= 0.3; // sombra da aba
    return pick(PAL.skin, v, x, y, 4);
  });
  // rugas da testa e dos olhos
  for (const x of [28, 29, 30, 34, 35, 36]) p.set(x, 25, PAL.skin[1]);
  for (const [x, y] of [[24, 30], [24, 31], [40, 30], [40, 31]]) p.set(x, y, PAL.skin[2]);
  // olhos azuis e claros sob sobrancelhas fartas
  for (const [x0, left] of [[26, true], [35, false]]) {
    for (let i = 0; i < 3; i++) p.set(x0 + i, 28, BEARD[0]);
    const row = left ? [PAL.eyeWhite, CRYSTAL[3], CRYSTAL[2]] : [CRYSTAL[3], CRYSTAL[2], PAL.eyeWhite];
    row.forEach((c, i) => p.set(x0 + i, 29, c));
    p.set(x0 + (left ? 1 : 0), 29, CRYSTAL[5]);
    for (let i = 0; i < 3; i++) p.set(x0 + i, 30, PAL.skin[2]);
  }
  for (const [x, y, k] of [[22, 26, 2], [23, 26, 3], [24, 26, 4], [25, 26, 5], [26, 26, 5], [27, 27, 4], [28, 27, 4], [29, 27, 3], [24, 27, 3], [25, 27, 4], [26, 27, 3], [23, 25, 4], [21, 25, 3]]) {
    p.set(x, y, BEARD[k]);
    p.set(64 - x, y, BEARD[Math.max(1, k - 1)]);
  }
  // nariz comprido
  for (const [dx, dy, k] of [[0, 0, 4], [0, 1, 4], [0, 2, 5], [1, 2, 3], [0, 3, 4], [1, 3, 3], [2, 3, 2], [-1, 4, 3], [0, 4, 4], [1, 4, 3], [2, 4, 1], [-1, 5, 1], [0, 5, 2], [1, 5, 2], [2, 5, 1]]) p.set(31 + dx, 30 + dy, PAL.skin[k]);
  // barba longa que desce até o peito
  const beardW = (y) => (y < 44 ? 9.2 + (y - 35) * 0.26 : 11.5 * (1 - ((y - 44) / 19.5) ** 1.6));
  const beardX = (y) => cx + Math.sin(y * 0.24) * 1.1 * clamp01((y - 40) / 10);
  const inBeard = (x, y) => {
    if (y < 33) return false;
    if (AM_HEAD(x, y) && (y > 37.5 || Math.abs(x - cx) > 6.6 - (y - 33) * 0.2)) return true;
    return y > 37 && y < 63.5 && Math.abs(x - beardX(y)) <= beardW(y);
  };
  p.fill(18, 33, 46, 63, inBeard, (x, y) => {
    const l = sphereLight((x + 0.5 - 30) / 12, (y + 0.5 - 38) / 18);
    const sx = x + Math.sin(y * 0.5) * 1.2 - (x - cx) * (y - 40) * 0.025;
    let v = 0.32 + l * 0.6 + (hash(Math.floor(sx / 2), 2, 6) - 0.5) * 0.24;
    if (Math.floor(sx) % 3 === 0) v -= 0.14;
    if (y > 57) v -= (y - 57) * 0.05;
    return pick(BEARD, v, x, y, 3);
  });
  // argola de ouro prendendo a ponta da barba
  for (let x = 29; x <= 34; x++) {
    p.set(x, 55, PAL.gold[x < 31 ? 5 : x < 33 ? 4 : 2]);
    p.set(x, 56, PAL.gold[x < 31 ? 3 : 1]);
  }
  // bigode caído
  for (let x = 25; x <= 39; x++) {
    const d = Math.abs(x + 0.5 - cx);
    const y = 36 + Math.floor(Math.max(0, d - 3) * 0.45);
    p.set(x, y, BEARD[x < cx ? 4 : 3]);
    p.set(x, y + 1, BEARD[x < cx ? 3 : 2]);
    if (d > 4) p.set(x, y + 2, BEARD[2]);
  }
  for (let x = 30; x <= 34; x++) p.set(x, 38, BEARD[0]);

  // chapéu pontudo: copa estampada de estrelas e lua, com faixa dourada
  p.fill(10, 0, 50, 22, (x, y) => hatAt(x, y) !== null, (x, y) => {
    const [q, ox, oy, r] = hatAt(x + 0.5, y + 0.5);
    const nz = Math.sqrt(Math.max(0, 1 - r * r));
    let v = 0.1 + shade3(ox * 0.95, oy * 0.95, nz) * 0.95;
    const s = q[3];
    if (s > 0.06 && s < 0.15) return pick(PAL.gold, v + 0.1 + (x % 3 === 0 ? 0.12 : 0), x, y);
    if ((x * 3 + y * 5) % 11 === 0 && hash(x, y, 4) < 0.5) v -= 0.12; // pano amarrotado
    return pick(ROBE, v - 0.05, x, y);
  });
  // estrelas e lua estampadas
  for (const [sx, sy] of AM_HAT_STARS) {
    p.set(sx, sy, PAL.gold[5]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(sx + dx, sy + dy, PAL.gold[3]);
  }
  for (const [x, y] of [[32, 15.5], [25, 8], [38, 13], [21, 7]]) p.set(x, y, PAL.gold[4]);
  for (const [x, y, k] of [[35, 15, 4], [34, 16, 4], [34, 17, 3], [35, 18, 3], [36, 18, 2]]) p.set(x, y - 2, PAL.gold[k]);
  // pompom de estrela na ponta
  p.set(15, 6, PAL.gold[4]); p.set(14, 6, PAL.gold[5]); p.set(15, 7, PAL.gold[3]); p.set(16, 6, PAL.gold[3]); p.set(15, 5, PAL.gold[5]);
  // aba larga
  p.fill(11, 16, 53, 25, (x, y) => ((x - cx) / 20.5) ** 2 + ((y - 20.8) / 3.8) ** 2 <= 1, (x, y) => {
    const top = y + 0.5 < 20.8;
    let v = (top ? 0.5 : 0.2) - ((x + 0.5 - cx) / 20.5) * 0.3;
    if (Math.abs(((x + 0.5 - cx) / 20.5) ** 2 + ((y + 0.5 - 20.8) / 3.8) ** 2 - 0.75) < 0.12 && !top) v += 0.08;
    return pick(ROBE, v, x, y);
  });
  for (let x = 13; x <= 51; x++) {
    const y = Math.floor(20.8 + 3.8 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / 20.5) ** 2)) - 0.5);
    p.set(x, y, ROBE[x < cx ? 3 : 2]);
  }

  // cajado: madeira retorcida, com garras em volta do cristal
  const [gx, gy] = AM_GEM;
  for (let y = 14; y < 64; y++) {
    const x = Math.round(53 + Math.sin(y * 0.35) * 0.6);
    const knot = y % 9 === 4;
    p.set(x, y, PAL.wood[knot ? 4 : 3]);
    p.set(x + 1, y, PAL.wood[knot ? 2 : 1]);
  }
  for (const [x, y, k] of [[52, 14, 3], [51, 13, 3], [50, 12, 3], [50, 11, 2], [50, 10, 3], [49, 9, 2], [50, 8, 3], [50, 7, 2], [51, 6, 3],
    [55, 14, 2], [56, 13, 2], [57, 12, 1], [57, 11, 2], [57, 10, 1], [58, 9, 2], [57, 8, 1], [57, 7, 2], [56, 6, 1], [53, 15, 4], [54, 15, 2]]) p.set(x, y, PAL.wood[k]);
  // mão segurando o cajado, saindo da manga larga
  p.poly([[45, 64], [46, 54], [50, 49.5], [57, 49.5], [61, 55], [63, 64]], (x, y) => {
    let v = 0.42 - (x - 46) * 0.025 - (y - 50) * 0.008;
    if (x === 51 || x === 56) v -= 0.18;
    return pick(ROBE, v, x, y);
  });
  p.rect(49, 49, 9, 2, (x, y) => pick(PAL.gold, (y === 49 ? 0.75 : 0.35) - (x - 49) * 0.04, x, y));
  // punho fechado: polegar por cima e os dedos dobrados na frente da vara
  p.rect(51, 42, 3, 2, (x, y) => PAL.skin[y === 42 ? (x === 51 ? 5 : 4) : x === 53 ? 2 : 3]);
  for (let y = 44; y <= 48; y++) {
    for (let x = 50; x <= 56; x++) {
      if ((x === 50 || x === 56) && (y === 44 || y === 48)) continue;
      const crease = (y === 45 || y === 47) && x > 50;
      p.set(x, y, crease ? PAL.skin[1] : PAL.skin[clamp01(0.95 - (x - 50) * 0.11 - (y - 44) * 0.04) * 4 + 0.6 | 0]);
    }
  }
  p.outline(PAL.out);
  // cristal com contorno próprio, sobre as garras
  const gem = buildArchmageCrystal();
  gem.outline(PAL.out);
  for (const [x, y] of [[50, 8], [57, 8], [50, 7], [57, 7]]) gem.set(x, y, 0);
  p.blit(gem, 0, 0);
  for (const [x, y, k] of [[50, 8, 3], [57, 8, 1], [50, 9, 2]]) p.set(x, y, PAL.wood[k]);
  return p;
}

// Olhos fechados (piscada).
function paintArchmageBlink(f) {
  for (const x0 of [26, 35]) for (let i = 0; i < 3; i++) { f.set(x0 + i, 28, PAL.skin[2]); f.set(x0 + i, 29, BEARD[0]); }
}

const amArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintArchmagePortrait(ctx, t, info) {
  const a = amArt;
  if (!a.bg) {
    a.bg = buildArchmageBackdrop(false);
    const [gx, gy] = AM_GEM;
    a.halo = makeHalo(a.bg, buildArchmageBackdrop(true), (x, y) => Math.hypot(x - gx, y - gy) / 26);
    a.body = buildArchmage();
    a.stars = makeStars(16, 3, (x, y) => AM_WIN(x + 0.5, y + 0.5) && y < 30 && Math.hypot(x - 8, y - 10) > 5);
    a.gem = rampPixels(a.body, CRYSTAL, 48, 0, 59, 16);
  }
  const f = a.frame.copyFrom(a.bg);
  const w = info.working;
  paintStars(f, a.stars, t);
  // o cristal pulsa e ilumina a parede e a estante
  const beat = 0.5 + 0.5 * Math.sin(t * (w ? 3.2 : 1.8));
  paintHalo(f, a.halo, 0.35 + beat * (w ? 0.5 : 0.3));
  const [gx, gy] = AM_GEM;
  paintGlow(f, gx, gy, 9 + beat * 2, 0.5, [C('#2a2c6a'), C('#3c4c9a'), C('#5a7ccc')]);
  f.blit(a.body, 0, 0);
  if (t % 4.9 > 4.76 || t % 11.7 > 11.56) paintArchmageBlink(f);
  // brilho descendo pelas faces do cristal
  sweepGlint(f, a.gem, CRYSTAL, ((t * (w ? 1.2 : 0.6)) % 1.6) * 30 + 40, 1.4);
  sparkle(f, gx - 1, gy - 6, pulse(t, w ? 2.4 : 4, 0, 0.6), CRYSTAL[4]);
  // estrelas do chapéu cintilando uma de cada vez
  AM_HAT_STARS.forEach(([x, y], i) => sparkle(f, x, y, pulse(t, 5.1, -i * 1.7, 0.55) * 0.7));
  // fagulhas saindo do cristal
  paintMotes(f, t, w ? 9 : 5, 7, gx, gy + 2, 10, 14, w ? 0.5 : 0.25);
  paintMotes(f, t, w ? 7 : 4, 8, 40, 64, 46, 60, w ? 0.12 : 0.07);
  f.draw(ctx);
}

function iconArchmage() {
  const p = new Pix(16, 16);
  // barba branca
  p.fill(3, 8, 13, 16, (x, y) => ((x - 8) / 4.6) ** 2 + ((y - 9.5) / 6.4) ** 2 <= 1 && y > 9.5, (x, y) =>
    pick(BEARD, 0.8 - (y - 9) * 0.07 - (x - 6) * 0.05 - (x % 2 ? 0.1 : 0), x, y));
  p.fill(4, 6, 12, 11, (x, y) => ((x - 8) / 3.4) ** 2 + ((y - 8.6) / 2.6) ** 2 <= 1, (x, y) => pick(PAL.skin, 0.75 - (x - 6) * 0.06, x, y));
  p.set(6, 8, CRYSTAL[3]);
  p.set(9, 8, CRYSTAL[3]);
  p.rect(5, 7, 2, 1, BEARD[5]);
  p.rect(9, 7, 2, 1, BEARD[4]);
  p.rect(6, 11, 4, 1, BEARD[4]);
  // chapéu pontudo com a ponta caída e uma estrela
  p.rect(1, 5, 14, 2, (x, y) => ROBE[y === 5 ? (x < 8 ? 5 : 4) : 2]);
  p.poly([[3.5, 5], [7, 0.5], [9, 0], [12.5, 5]], (x) => ROBE[x < 7 ? 5 : x < 9 ? 4 : 3]);
  p.set(6, 1, ROBE[4]); p.set(5, 2, ROBE[5]); p.set(4, 2, PAL.gold[5]);
  p.rect(4, 4, 8, 1, PAL.gold[3]);
  p.set(9, 2, PAL.gold[5]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Torre arcana

const TWILIGHT = ramp('#110b2a', '#1a1240', '#271854', '#3a2068', '#552a78', '#773882', '#9c4a88', '#c2628a', '#e48486', '#f8ac86');
const TSTONE = ramp('#1c1028', '#2c1a40', '#422858', '#5a3a72', '#74508e', '#9070a8', '#b092c4');
const AMETHYST = ramp('#2a0e4a', '#4a1a7a', '#7030b0', '#9a5ad8', '#c290f0', '#ecd0ff', '#ffffff');
const RUNE = ramp('#2a2266', '#4436a6', '#6a5ee0', '#8ab4f4', '#c8f0ff', '#ffffff');
const DUSK_GRASS = ramp('#0e1418', '#152220', '#1e3228', '#2a4430', '#3a5836', '#506e3e');
// runas de 3x3 que formam as faixas gravadas na torre
const RUNES = [['x.x', 'xx.', 'x..'], ['x.x', '.x.', '.x.'], ['.x.', 'x.x', '.x.'], ['.xx', '.x.', 'xx.'], ['x..', 'xx.', 'x..'], ['xx.', 'x..', 'x..'], ['.x.', 'x.x', 'x.x']];
// Eixo torto da torre: inclina para a direita ao subir.
const atX = (y) => 31.5 + ((59 - y) / 42) ** 2 * 5.4 - ((59 - y) / 42) * 1.4;
const atW = (y) => 5.4 + ((y - 17) / 42) * 1.6;
const AT_GEM = [atX(12) + 0.5, 8.5];
const AT_LEDGES = [27, 38, 48];
const AT_WINDOWS = [[0.5, 32, 5], [-1, 42, 4]];
const AT_BANDS = [22, 34, 44];

function buildTowerBackdrop() {
  const p = new Pix(64, 64);
  // céu do crepúsculo, com o resto do sol atrás da serra à direita
  for (let y = 0; y < 56; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.02 + (y / 52) ** 1.25 * 0.86 + clamp01(1 - Math.hypot((x - 48) * 0.7, y - 50) / 34) * 0.18;
      p.d[y * 64 + x] = pick(TWILIGHT, v, x, y, 1.6);
    }
  }
  // nuvens finas acesas por baixo
  for (const [x0, x1, y, k] of [[2, 22, 33, 0], [40, 63, 29, 1], [30, 50, 38, 2], [0, 12, 40, 3]]) {
    for (let x = x0; x <= x1; x++) {
      const e = Math.min(x - x0, x1 - x) / 3;
      if (e < 0.3) continue;
      p.set(x, y, pick(PAL.duskCloud, 0.35 + k * 0.1, x, y));
      if (e > 1) p.set(x, y + 1, pick(PAL.duskCloud, 0.7 + k * 0.08, x, y + 1));
      if (e > 2 && hash(x, k, 3) < 0.6) p.set(x, y - 1, PAL.duskCloud[0]);
    }
  }
  // serra distante e morros
  for (let x = 0; x < 64; x++) {
    const top = Math.round(44 + 3 * Math.sin(x * 0.11 + 0.5) + 1.6 * Math.sin(x * 0.37 + 2));
    const slope = Math.sin((x + 1) * 0.11 + 0.5) - Math.sin(x * 0.11 + 0.5);
    for (let y = top; y < 56; y++) p.set(x, y, pick(VIOLET, (y === top ? 0.62 : 0.38) + slope * 2 - (y - top) * 0.03, x, y));
    const hill = Math.round(51 + 1.6 * Math.sin(x * 0.19 + 1.4));
    for (let y = hill; y < 58; y++) p.set(x, y, pick(DUSK_GRASS, (y === hill ? 0.45 : 0.22) - (y - hill) * 0.02, x, y));
  }
  // colina da torre com capim, pedras e um caminho
  for (let y = 55; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const top = 56.5 + ((x - 33) / 30) ** 2 * 3;
      if (y + 0.5 < top) continue;
      let v = 0.62 - (y - 56) * 0.04 + (hash(x, y, 5) - 0.5) * 0.3 - ((x - 33) / 32) * 0.15;
      if (y + 0.5 < top + 1) v += 0.15;
      p.set(x, y, pick(DUSK_GRASS, v, x, y, 1.8));
    }
  }
  for (let y = 60; y < 64; y++) {
    const c = 33 + (y - 60) * 1.5;
    for (let x = Math.floor(c - 2 - (y - 60) * 0.4); x <= c + 2 + (y - 60) * 0.4; x++) p.set(x, y, pick(PAL.dirt, 0.42 + (hash(x, y, 6) - 0.5) * 0.3 - (y === 60 ? 0.15 : 0), x, y));
  }
  for (const [x, y, r] of [[9, 60, 2.2], [52, 61, 2.6], [57, 59, 1.6], [14, 62, 1.5]]) p.sphere(x, y, r, r * 0.75, TSTONE, -0.05, 2);
  // cogumelos que brilham
  for (const [x, y] of [[20, 60], [22, 61], [45, 60], [47, 61], [6, 62]]) {
    p.set(x, y, C('#d8e8f0'));
    p.set(x, y - 1, RUNE[3]);
    p.set(x - 1, y - 1, RUNE[2]);
    p.set(x + 1, y - 1, RUNE[2]);
  }
  return p;
}

function buildTowerGem() {
  const p = new Pix(16, 16);
  // cristal de ametista em losango alongado, faces com luz de cima à esquerda
  const cx = 8, cy = 8;
  p.poly([[cx, cy - 5.5], [cx + 3.2, cy - 1], [cx, cy + 5.5], [cx - 3.2, cy - 1]], (x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    let v = dx < 0 ? 0.72 : 0.38;
    if (dy < -1 + Math.abs(dx) * 0.2) v += 0.16;
    if (Math.abs(dx) < 0.8) v += 0.08;
    v -= dy * 0.02;
    return pick(AMETHYST, v, x, y);
  });
  p.set(cx - 2, cy - 2, WHITE);
  p.set(cx - 1, cy - 4, AMETHYST[5]);
  p.outline(PAL.out);
  return p;
}

function buildTower() {
  const p = new Pix(64, 64);
  const tone = (x, y, hw, base) => {
    const cx = atX(y);
    const nx = (x + 0.5 - cx) / hw;
    return base + cylLight(nx) * 0.8;
  };
  // torrezinha anexa à esquerda, com telhado cônico de ardósia
  const tc = 20.5;
  p.fill(16, 40, 26, 60, (x) => Math.abs(x + 0.5 - tc) <= 3.6, (x, y) =>
    pick(TSTONE, 0.04 + cylLight((x + 0.5 - tc) / 3.6) * 0.75 + masonry(x, y, 4, 3, 21), x, y));
  p.fill(15, 30, 27, 41, (x, y) => Math.abs(x + 0.5 - tc) <= (y - 30.5) * 0.48 + 0.3, (x, y) => {
    let v = 0.1 + cylLight((x + 0.5 - tc) / Math.max(1, (y - 30.5) * 0.48)) * 0.8;
    if ((y - 30) % 3 === 2) v -= 0.2;
    return pick(VIOLET, v, x, y);
  });
  p.rect(15, 40, 12, 1, (x) => VIOLET[x < 21 ? 2 : 1]);
  p.set(20, 29, PAL.gold[4]);
  p.set(20, 28, PAL.gold[5]);
  p.rect(19, 46, 2, 3, AMETHYST[3]);
  p.set(19, 46, AMETHYST[5]);
  // corpo da torre: pedra roxa em blocos, cilindro torto
  p.fill(20, 17, 46, 60, (x, y) => Math.abs(x - atX(y)) <= atW(y), (x, y) => {
    const v = tone(x, y, atW(y), 0.02) + masonry(x, y, 5, 3, 22) - (y - 17) * 0.002;
    return pick(TSTONE, v, x, y);
  });
  // rachaduras e musgo
  for (const [x, y] of [[29, 33], [30, 34], [30, 35], [37, 21], [36, 22], [34, 44], [35, 45]]) p.set(x, y, TSTONE[0]);
  for (const [x, y] of [[27, 58], [28, 57], [27, 57], [26, 59], [38, 58], [39, 59], [28, 49], [27, 50]]) p.set(x, y, DUSK_GRASS[4]);
  // cornijas entre os andares
  for (const ly of AT_LEDGES) {
    const hw = atW(ly) + 1;
    p.fill(15, ly - 1, 48, ly + 1, (x, y) => Math.abs(x - atX(ly)) <= hw, (x, y) =>
      pick(TSTONE, tone(x, ly, hw, y === ly - 1 ? 0.22 : y === ly ? 0.02 : -0.2), x, y));
  }
  // base larga
  p.fill(18, 56, 48, 61, (x, y) => Math.abs(x - atX(58)) <= atW(58) + 2 - (y === 56 ? 0.8 : 0), (x, y) =>
    pick(TSTONE, tone(x, 58, atW(58) + 2, (y === 56 ? 0.15 : 0) - 0.05) + masonry(x, y, 6, 3, 23, 56), x, y));
  // varanda no alto com ameias
  const bx = atX(17), bw = atW(17) + 2.2;
  p.fill(bx - bw - 1, 14, bx + bw + 1, 19, (x, y) => Math.abs(x - bx) <= bw && (y >= 16 || Math.round(x - bx + 20) % 3 !== 0), (x, y) =>
    pick(TSTONE, tone(x, 17, bw, y === 14 || y === 16 ? 0.18 : y === 19 ? -0.2 : 0.02), x, y));
  p.fill(bx - bw, 20, bx + bw, 20, (x) => Math.abs(x - bx) <= bw - 1 && x % 2 === 0, (x) => TSTONE[1]);
  // garras de pedra que seguram o cristal no ar
  for (const s of [-1, 1]) {
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      const x = bx + s * (bw - 0.5 - u * u * 3.4), y = 14 - u * 6.5;
      p.set(x, y, TSTONE[s < 0 ? 5 : 3]);
      if (u < 0.75) p.set(x - s, y, TSTONE[s < 0 ? 4 : 2]);
    }
  }
  // janelas em arco com luz arcana
  for (const [dx, wy, h] of AT_WINDOWS) {
    const wx = Math.round(atX(wy) + dx);
    p.fill(wx - 2, wy - h - 1, wx + 2, wy, archTest(wx + 0.5, 2.5, wy - h - 1, wy), (x) => TSTONE[x < wx ? 1 : 0]);
    p.fill(wx - 1, wy - h, wx + 1, wy - 1, archTest(wx + 0.5, 1.5, wy - h, wy - 1), AMETHYST[2]);
    p.rect(wx - 1, wy - 2, 3, 1, TSTONE[1]); // travessa
    p.set(wx - 1, wy - h + 1, AMETHYST[4]);
    p.rect(wx - 2, wy, 5, 1, (x) => TSTONE[x < wx ? 6 : 4]);
  }
  // porta em arco
  const dx0 = Math.round(atX(58));
  p.fill(dx0 - 3, 53, dx0 + 3, 61, archTest(dx0 + 0.5, 2.5, 53, 61), (x, y) => pick(PAL.wood, 0.45 - (x - dx0 + 2) * 0.08 - ((x - dx0) % 2 === 0 ? 0.1 : 0), x, y));
  p.set(dx0 + 1, 58, PAL.gold[4]);
  // faixas de runas gravadas em volta da torre (o brilho delas corre por cima)
  AT_BANDS.forEach((by, b) => {
    const cx = atX(by + 1), hw = atW(by + 1);
    p.fill(cx - hw, by - 1, cx + hw, by + 3, (x) => Math.abs(x - cx) <= hw - 0.5, (x, y) =>
      y === by - 1 ? TSTONE[x < cx ? 4 : 2] : y === by + 3 ? TSTONE[1] : pick(TSTONE, 0.04 + cylLight((x + 0.5 - cx) / hw) * 0.5, x, y));
    for (let i = -1; i <= 1; i++) {
      const gx = Math.round(cx + i * 4 - 1.5);
      RUNES[(i + 1 + b * 2) % RUNES.length].forEach((row, j) => [...row].forEach((ch, k) => {
        if (ch === 'x') p.set(gx + k, by + j, RUNE[1]);
      }));
    }
  });
  p.outline(PAL.out);
  return p;
}

// Pedras soltas flutuando em volta do alto da torre: posição, tamanho e fase.
const AT_ROCKS = [[12, 15, 2, 0], [49, 22, 2, 1.7], [47, 8, 1, 3.1], [9, 29, 1, 4.4]];

function buildTowerRock(n, seed) {
  // lasca de rocha: topo chato com musgo, fundo em ponta
  const p = new Pix(10, 9);
  const w = n * 2 + 1;
  p.poly([[1, 1.5], [1 + w, 1.5], [1 + w - 0.5, 3], [1 + w * 0.55, 2 + n * 1.8], [1.5, 3]], (x, y) =>
    pick(TSTONE, (y < 2 ? 0.85 : 0.5 - (y - 2) * 0.1) - (x - 1) * 0.04 + (hash(x, y, seed) - 0.5) * 0.15, x, y));
  for (let x = 1; x < 1 + w; x++) if (hash(x, seed, 3) < 0.5) p.set(x, 1, DUSK_GRASS[4]);
  p.set(1 + (w >> 1), 3, RUNE[2]);
  p.outline(PAL.out);
  return p;
}

const atArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintTowerPortrait(ctx, t, info) {
  const a = atArt;
  if (!a.bg) {
    a.bg = buildTowerBackdrop();
    a.body = buildTower();
    a.gem = buildTowerGem();
    a.stars = makeStars(22, 5, (x, y) => y < 26 + x * 0.1 && a.bg.get(x, y) !== 0);
    a.cloud = makeCloud(18, 6, 4, PAL.duskCloud);
    a.rocks = AT_ROCKS.map(([, , n], i) => buildTowerRock(n, i));
    // pixels das runas e das janelas, que acendem por cima a cada quadro
    const runes = [], windows = [];
    for (let i = 0; i < 4096; i++) {
      if (a.body.d[i] === RUNE[1]) runes.push(i);
      else if (a.body.d[i] === AMETHYST[2]) windows.push(i);
    }
    a.runes = Uint16Array.from(runes);
    a.windows = Uint16Array.from(windows);
    a.spiral = new Float32Array(14 * 4);
  }
  const f = a.frame.copyFrom(a.bg);
  const w = info.working;
  paintStars(f, a.stars, t);
  f.blit(a.cloud, ((t * 1.3) % 90) - 22, 18);
  // fagulhas girando em espiral: as de trás passam antes da torre
  const n = w ? 14 : 8, sp = a.spiral;
  for (let k = 0; k < n; k++) {
    const u = (t * (w ? 0.16 : 0.09) + k / n) % 1;
    const y = 60 - u * 54;
    const th = t * (w ? 2.4 : 1.4) + k * 2.4 + u * 9;
    sp[k * 4] = atX(y) + Math.cos(th) * (atW(y) + 3.5 - u * 2);
    sp[k * 4 + 1] = y;
    sp[k * 4 + 2] = Math.sin(th);
    sp[k * 4 + 3] = u;
    if (sp[k * 4 + 2] <= 0) f.set(sp[k * 4], y, MOTE[k % MOTE.length]);
  }
  f.blit(a.body, 0, 0);
  // runas acendendo numa onda que sobe pela torre
  const speed = w ? 3.2 : 1.6;
  for (const i of a.runes) {
    const y = i >> 6;
    const v = Math.sin(t * speed + y * 0.22);
    f.d[i] = RUNE[v > 0.8 ? 4 : v > 0.35 ? 3 : v > -0.2 ? 2 : 1];
  }
  // janelas tremulando
  for (const i of a.windows) {
    const v = Math.sin(t * 5.3 + (i & 63) * 1.7 + (i >> 6)) + Math.sin(t * 8.1 + i);
    f.d[i] = AMETHYST[v > 1.2 ? 4 : v > -0.4 ? 3 : 2];
  }
  for (let k = 0; k < n; k++) {
    if (sp[k * 4 + 2] <= 0) continue;
    const x = sp[k * 4], y = sp[k * 4 + 1], c = MOTE[k % MOTE.length];
    f.set(x, y, c);
    if (sp[k * 4 + 3] < 0.3 && Math.sin(t * 9 + y) > 0.7) f.set(x, y - 1, c);
  }
  // pedras soltas boiando no ar
  AT_ROCKS.forEach(([x, y, , ph], i) => f.blit(a.rocks[i], x - 1, Math.round(y + Math.sin(t * 1.1 + ph) * 1.5)));
  // cristal flutuando, com aura e faíscas em órbita
  const [gx, gy] = AT_GEM;
  const bob = Math.sin(t * 1.8) * 1.2;
  const beat = 0.5 + 0.5 * Math.sin(t * (w ? 3 : 1.7));
  paintGlow(f, gx, gy + bob, 6 + beat * 2.5, 0.42, [AMETHYST[1], AMETHYST[2], AMETHYST[3]]);
  f.blit(a.gem, Math.round(gx - 8), Math.round(gy + bob - 8));
  for (let k = 0; k < 3; k++) {
    const th = t * (w ? 3 : 1.8) + k * 2.09;
    f.set(gx + Math.cos(th) * 6, gy + bob + Math.sin(th) * 2, k ? AMETHYST[5] : RUNE[4]);
  }
  sparkle(f, Math.round(gx - 1), Math.round(gy + bob - 3), pulse(t, w ? 2.2 : 3.6, 0, 0.6), AMETHYST[4]);
  f.draw(ctx);
}

// Silhueta: a torre com o cristal parado no alto.
function buildTowerLocked() {
  const p = buildTower();
  const [gx, gy] = AT_GEM;
  p.blit(buildTowerGem(), Math.round(gx - 8), Math.round(gy - 8));
  return p;
}

function iconTower() {
  const p = new Pix(16, 16);
  p.fill(4, 4, 12, 16, (x, y) => Math.abs(x + 0.5 - (8 + (15 - y) * 0.12)) <= 2.6 + (y - 4) * 0.08, (x, y) =>
    pick(TSTONE, (x < 7 ? 0.8 : x < 9 ? 0.55 : 0.3) - (y % 3 === 0 ? 0.12 : 0), x, y));
  p.rect(4, 5, 9, 2, (x, y) => TSTONE[y === 5 ? (x < 8 ? 6 : 5) : 3]);
  p.set(4, 4, TSTONE[5]); p.set(12, 4, TSTONE[3]);
  p.rect(8, 8, 1, 2, RUNE[4]);
  p.set(9, 12, AMETHYST[4]);
  p.rect(7, 13, 2, 3, PAL.wood[2]);
  // cristal flutuando
  p.poly([[8.5, -0.2], [10.6, 2], [8.5, 4.2], [6.4, 2]], (x) => AMETHYST[x < 8 ? 5 : 3]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Pedra filosofal

const PHIL = ramp('#2a0410', '#56081a', '#8a1026', '#c41c30', '#ec4040', '#ff8a70', '#ffd2b8', '#ffffff');
const SANCTUM = ramp('#100914', '#1a0f1e', '#26152a', '#341c36', '#462644', '#5c3254', '#764264');
const SANCTUM_LIT = ramp('#341420', '#52202e', '#76323a', '#9c4a46', '#c06a54', '#de9268', '#f4bc84');
const CIRCLE = ramp('#3a1a10', '#6a3418', '#a85a1e', '#e0902e', '#ffc85a', '#fff0b0');
const PS_GEM = [32, 21];
const PS_RING = [32, 55.5, 29, 7]; // círculo alquímico no chão: centro e raios

function buildPhilBackdrop(lit) {
  const p = new Pix(64, 64);
  const r = lit ? SANCTUM_LIT : SANCTUM;
  const [gx, gy] = PS_GEM;
  // parede do santuário, mais clara em volta da pedra (acesa: tingida pelos raios)
  for (let y = 0; y < 47; y++) {
    for (let x = 0; x < 64; x++) {
      const near = clamp01(1 - Math.hypot(x - gx, (y - gy) * 1.2) / 34);
      const v = lit ? 0.24 + near * 0.5 + masonry(x, y, 8, 4, 31) * 0.25 : 0.2 + near * 0.32 + masonry(x, y, 8, 4, 31);
      p.d[y * 64 + x] = pick(r, v, x, y, 2);
    }
  }
  // nicho em arco atrás da pedra
  p.fill(14, 0, 50, 46, archTest(32, 16, 1, 46), (x, y) => pick(r, 0.42 - (x - 16) * 0.008 + (lit ? 0.1 : 0) + masonry(x, y, 5, 3, 32) * 0.5, x, y));
  p.fill(16, 2, 48, 46, archTest(32, 14, 3, 46), (x, y) => pick(r, 0.1 + clamp01(1 - Math.hypot(x - gx, y - gy) / 22) * 0.4 + (lit ? 0.12 : 0), x, y, 1.6));
  // pilares dos lados com placas de símbolos
  for (const px of [4, 59]) {
    p.fill(px - 4, 0, px + 4, 46, (x) => Math.abs(x + 0.5 - px) <= 3.6, (x, y) =>
      pick(r, 0.06 + cylLight((x + 0.5 - px) / 3.6) * 0.55 - (x % 2 ? 0.06 : 0) + (lit ? 0.1 : 0), x, y));
    p.rect(px - 4, 6, 9, 2, (x, y) => pick(r, (y === 6 ? 0.7 : 0.3) - (x - px) * 0.03, x, y));
    p.rect(px - 2, 18, 5, 6, (x, y) => (x === px - 2 || y === 18 ? PAL.gold[2] : PAL.gold[1]));
    p.set(px, 20, PAL.gold[4]); p.set(px, 21, PAL.gold[3]); p.set(px - 1, 21, PAL.gold[3]); p.set(px + 1, 21, PAL.gold[3]);
  }
  // chão de lajes em perspectiva
  for (let y = 47; y < 64; y++) {
    const k = (y - 46) / 18;
    for (let x = 0; x < 64; x++) {
      const u = (x - 32) / (0.6 + k * 1.4);
      const joint = Math.abs(((u / 6) % 1 + 1) % 1 - 0.5) > 0.46 || [48, 51, 55, 60].includes(y);
      let v = 0.18 + k * 0.2 + clamp01(1 - Math.hypot(x - 32, (y - 56) * 2.6) / 40) * 0.25 - (joint ? 0.12 : 0) + (hash(Math.floor(u / 6), y >> 2, 33) - 0.5) * 0.08;
      if (y === 47) v = 0.05;
      if (lit) v += 0.12;
      p.d[y * 64 + x] = pick(r, v, x, y, 2);
    }
  }
  return p;
}

// Círculo de transmutação no chão: dois anéis, os sinais dos sete metais e pontos.
function buildPhilCircle() {
  const p = new Pix(64, 64);
  const [cx, cy, rx, ry] = PS_RING;
  const at = (a, r) => [cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry];
  for (let y = 46; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
      const d = Math.hypot(u, v);
      if ((d > 0.93 && d <= 1) || (d > 0.77 && d <= 0.82)) p.set(x, y, CIRCLE[2]);
    }
  }
  // os sete sinais dos metais entre os anéis, e um anel de pontos por dentro
  for (let i = 0; i < 7; i++) {
    const [x, y] = at((i / 7) * Math.PI * 2 + 0.25, 0.875);
    p.set(x, y, CIRCLE[3]);
    p.set(x + 1, y, CIRCLE[3]);
    p.set(x + (i % 2 ? 1 : 0), y - 1, CIRCLE[3]);
  }
  for (let i = 0; i < 24; i++) {
    const [x, y] = at((i / 24) * Math.PI * 2, 0.66);
    if (i % 2) p.set(x, y, CIRCLE[2]);
  }
  return p;
}

function buildPhilGemFacets() {
  // pedra lapidada vista de lado: coroa com facetas em cima, pavilhão em V embaixo
  const T0 = [5, 1], T1 = [13, 1], P = [9, 21];
  const G = [[0, 7], [4.5, 7.5], [9, 7.8], [13.5, 7.5], [18, 7]];
  const facets = [
    { pts: [G[0], T0, G[1]], n: [-0.7, -0.6, 0.5] },
    { pts: [T0, G[2], G[1]], n: [-0.3, -0.7, 0.6] },
    { pts: [T0, T1, G[2]], n: [0, -0.8, 0.6] },
    { pts: [T1, G[3], G[2]], n: [0.3, -0.7, 0.6] },
    { pts: [T1, G[4], G[3]], n: [0.7, -0.6, 0.5] },
    { pts: [G[0], G[1], [6, 13], P], n: [-0.75, 0.35, 0.55] },
    { pts: [G[1], G[2], P, [6, 13]], n: [-0.3, 0.3, 0.9] },
    { pts: [G[2], G[3], [12, 13], P], n: [0.25, 0.3, 0.9] },
    { pts: [G[3], G[4], P, [12, 13]], n: [0.75, 0.35, 0.55] },
  ];
  const inside = (pts, x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const list = [];
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 19; x++) {
      const fi = facets.findIndex((f) => inside(f.pts, x + 0.5, y + 0.5));
      if (fi < 0) continue;
      const [nx, ny, nz] = facets[fi].n;
      const l = Math.hypot(nx, ny, nz);
      let v = 0.1 + shade3(nx / l, ny / l, nz / l) * 0.56;
      if (fi >= 5) v += clamp01(1 - Math.hypot(x - 8, y - 10) / 7) * 0.22; // fogo lá dentro
      // arestas: a de cima de cada faceta pega um fio de luz
      if (fi < 5 ? !facets.some((f, k) => k !== fi && inside(f.pts, x + 0.5, y - 0.5)) && y > 1 : false) v += 0.1;
      list.push(x, y, fi, v);
    }
  }
  return Float32Array.from(list);
}

function buildPedestal() {
  const p = new Pix(64, 64);
  const cx = 32;
  const marble = (x, y, hw, base) => pick(SANCTUM, base + cylLight((x + 0.5 - cx) / hw) * 0.55 + (Math.abs(Math.sin(x * 0.9 + y * 0.35)) < 0.1 ? -0.1 : 0), x, y);
  // coluna com caneluras
  p.rect(26, 42, 13, 11, (x, y) => marble(x, y, 6.5, 0.12 - ((x - 26) % 3 === 0 ? 0.12 : 0)));
  // capitel e tampo
  p.rect(25, 40, 15, 2, (x, y) => marble(x, y, 7.5, y === 40 ? 0.3 : 0.08));
  p.rect(22, 37, 21, 3, (x, y) => (y === 37 ? PAL.gold[x < 32 ? 4 : 3] : marble(x, y, 10.5, y === 38 ? 0.25 : 0.05)));
  // base em degraus
  p.rect(24, 53, 17, 2, (x, y) => marble(x, y, 8.5, y === 53 ? 0.28 : 0.06));
  p.rect(21, 55, 23, 3, (x, y) => (y === 55 ? PAL.gold[x < 32 ? 3 : 2] : marble(x, y, 11.5, y === 56 ? 0.2 : 0.02)));
  // runa da pedra gravada em ouro na coluna
  for (const [x, y, k] of [[32, 44, 4], [31, 45, 3], [33, 45, 3], [32, 46, 4], [32, 47, 3], [31, 48, 3], [33, 48, 2], [32, 49, 3], [30, 46, 2], [34, 46, 2]]) p.set(x, y, PAL.gold[k]);
  p.outline(PAL.out);
  return p;
}

const psArt = { bg: null, body: null, frame: new Pix(64, 64) };
const PS_GLOW = [PHIL[1], PHIL[2], PHIL[3]];

function paintPhilGem(f, a, x0, y0, t, w) {
  const g = a.gem;
  const sp = w ? 1.6 : 0.9;
  for (let i = 0; i < g.length; i += 4) {
    const fi = g[i + 2];
    // cada faceta pega a luz numa hora, como se a pedra girasse devagar
    const v = g[i + 3] + Math.sin(t * sp + fi * 1.9) * 0.09;
    f.set(x0 + g[i], y0 + g[i + 1], pick(PHIL, v, g[i], g[i + 1], 3));
  }
  for (let i = 0; i < a.gemEdge.length; i += 2) f.set(x0 - 1 + a.gemEdge[i], y0 - 1 + a.gemEdge[i + 1], PAL.out);
}

function paintPhilPortrait(ctx, t, info) {
  const a = psArt;
  const [gx, gy] = PS_GEM;
  if (!a.bg) {
    a.bg = buildPhilBackdrop(false);
    const lit = buildPhilBackdrop(true);
    a.body = buildPedestal();
    a.gem = buildPhilGemFacets();
    // contorno da pedra
    const m = new Pix(20, 23);
    for (let i = 0; i < a.gem.length; i += 4) m.set(a.gem[i] + 1, a.gem[i + 1] + 1, 1);
    const o = new Pix(20, 23).copyFrom(m).outline(2);
    a.gemEdge = [];
    for (let i = 0; i < o.d.length; i++) if (o.d[i] === 2) a.gemEdge.push(i % 20, (i / 20) | 0);
    // raios: cada pixel da parede guarda o setor do ângulo em volta da pedra
    const rays = [];
    for (let y = 0; y < 47; y++) {
      for (let x = 0; x < 64; x++) {
        const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
        if (d < 9 || a.bg.d[y * 64 + x] === lit.d[y * 64 + x]) continue;
        const b = Math.floor(((Math.atan2(y + 0.5 - gy, x + 0.5 - gx) + Math.PI) / (Math.PI * 2)) * 128) & 127;
        const k = clamp01(1.5 - d / 30);
        if (k <= bayer(x, y)) continue; // esse pixel nunca acenderia
        rays.push([b, y * 64 + x, Math.round((bayer(x, y) / k) * 255), lit.d[y * 64 + x]]);
      }
    }
    a.rays = groupRays(rays);
    // círculo do chão: pixels e o ângulo de cada um
    const circle = buildPhilCircle();
    a.circle = [];
    for (let i = 0; i < 4096; i++) {
      if (!circle.d[i]) continue;
      const x = i & 63, y = i >> 6;
      const ang = Math.atan2((y + 0.5 - PS_RING[1]) / PS_RING[3], (x + 0.5 - PS_RING[0]) / PS_RING[2]);
      a.circle.push(i, Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 64) & 63, circle.d[i] === CIRCLE[3] ? 0.15 : 0);
    }
    a.circle = Float32Array.from(a.circle);
    a.run = new Float32Array(64);
  }
  const f = a.frame.copyFrom(a.bg);
  const w = info.working;
  // raios de luz girando devagar em volta da pedra
  const p = t * (w ? 0.5 : 0.25), cp = Math.cos(p), sp = Math.sin(p), beam = a.rays.beam, d = f.d;
  for (let b = 0, j = 0; b < 128; b++, j += 4) beam[b] = (SECTOR_TRIG[j] * cp + SECTOR_TRIG[j + 1] * sp - 0.55) * 765;
  paintRays(d, a.rays);
  // círculo no chão: pulso de luz correndo pela volta
  const beat = 0.5 + 0.5 * Math.sin(t * (w ? 3 : 1.6));
  const c = a.circle, run = a.run;
  const q = t * (w ? 2.2 : 1.1), cq = Math.cos(q), sq = Math.sin(q);
  for (let b = 0; b < 64; b++) {
    const v = Math.max(0, RUN_TRIG[b * 2] * cq + RUN_TRIG[b * 2 + 1] * sq), v2 = v * v;
    run[b] = 0.2 + beat * 0.16 + v2 * v2 * v2 * 0.55;
  }
  for (let i = 0; i < c.length; i += 3) d[c[i]] = CIRCLE[Math.min(5, ((run[c[i + 1]] + c[i + 2]) * 6) | 0)];
  // brasas subindo do círculo
  paintMotes(f, t, w ? 12 : 7, 13, 32, 62, 50, 40, w ? 0.3 : 0.16, EMBERS);
  f.blit(a.body, 0, 0);
  // reflexo da pedra no tampo do pedestal
  for (let x = 25; x <= 39; x++) if (bayer(x, 38) < 0.55 - Math.abs(x - 32) * 0.05 + beat * 0.2) f.set(x, 38, PHIL[x < 32 ? 4 : 3]);
  // a pedra flutua, com aura vermelha pulsando
  const bob = Math.round(Math.sin(t * 1.5) * 1.6);
  paintGlow(f, gx, gy + bob, 12 + beat * 3, 0.42, PS_GLOW);
  paintPhilGem(f, a, gx - 9, gy - 11 + bob, t, w);
  // cintilar nas facetas
  sparkle(f, gx - 3, gy - 5 + bob, pulse(t, w ? 2 : 3.4, 0, 0.6), PHIL[6]);
  sparkle(f, gx + 3, gy + 3 + bob, pulse(t, w ? 2 : 3.4, -1, 0.5) * 0.7, PHIL[5], true);
  // faíscas em órbita
  for (let k = 0; k < 4; k++) {
    const th = t * (w ? 2.4 : 1.3) + k * 1.57;
    const x = gx + Math.cos(th) * 12, y = gy + bob + Math.sin(th) * 3.5 + 2;
    if (Math.sin(th) < 0 && Math.abs(x - gx) < 8) continue; // atrás da pedra
    f.set(x, y, k % 2 ? CIRCLE[5] : PHIL[6]);
  }
  f.draw(ctx);
}

// Silhueta: o pedestal com a pedra parada no alto.
function buildPhilLocked() {
  const p = buildPedestal();
  const g = buildPhilGemFacets();
  for (let i = 0; i < g.length; i += 4) p.set(PS_GEM[0] - 9 + g[i], PS_GEM[1] - 11 + g[i + 1], PHIL[3]);
  return p;
}

function iconPhilstone() {
  const p = new Pix(16, 16);
  // pedestal
  p.rect(5, 12, 7, 1, PAL.gold[3]);
  p.rect(6, 13, 5, 2, (x) => SANCTUM[x < 8 ? 6 : 4]);
  p.rect(4, 15, 9, 1, SANCTUM[5]);
  // pedra facetada
  p.poly([[8.5, 0.5], [13, 3.5], [13, 7.5], [8.5, 11], [4, 7.5], [4, 3.5]], (x, y) => {
    if (x >= 6 && x <= 10 && y >= 3 && y <= 7) return PHIL[x < 8 ? 5 : 4];
    return PHIL[x < 8 ? (y < 5 ? 4 : 3) : y < 5 ? 3 : 2];
  });
  p.set(6, 3, WHITE);
  p.set(7, 4, PHIL[6]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Elixir da vida

const ELIXIR = ramp('#1a3410', '#305e14', '#4f8a1a', '#82b828', '#bede44', '#eef290', '#fffde0');
const DAWN = ramp('#34406e', '#4c5a8c', '#6e72a4', '#9a86ac', '#c89aa6', '#eab296', '#f8cc92', '#fce6b4');
const GLASSY = ramp('#4a6a6e', '#7a9c9a', '#aaccc4', '#d8f0e6', '#f6fff8');
const PETAL = [C('#f4a6b6'), C('#e47a92'), C('#fbe0e6'), C('#f6f0dc')];
const LEAF = ramp('#1c3a18', '#2e5a22', '#4a8030', '#72a844', '#a0cc62');
const SAND = ramp('#3e3036', '#625050', '#8a7266', '#b0967e', '#d0b896', '#ead8b4');
const EL_BULB = [32, 41, 10.6, 9.6];
const EL_SURF = 34; // nível do líquido

function buildElixirBackdrop(lit) {
  const p = new Pix(64, 64);
  const glow = (x, y) => (lit ? clamp01(1 - Math.hypot(x - 32, (y - 44) * 1.4) / 30) * 0.5 : 0);
  // parede de pedra clara, com a luz da manhã batendo
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.42 + masonry(x, y, 7, 4, 41) - y * 0.003 + glow(x, y);
      p.d[y * 64 + x] = pick(SAND, v, x, y, 2);
    }
  }
  // janela larga em arco com a aurora sobre a mata
  const win = archTest(32, 23, 2, 47);
  p.fill(7, 1, 57, 48, archTest(32, 25, 0.5, 48), (x, y) => pick(SAND, (x < 32 ? 0.78 : 0.55) - (y < 20 ? 0 : 0.05) + glow(x, y), x, y));
  p.fill(9, 2, 55, 47, win, (x, y) => {
    let v = 0.04 + (y / 40) ** 1.4 * 0.86 + clamp01(1 - Math.hypot(x - 44, y - 40) / 18) * 0.2;
    return pick(DAWN, v, x, y, 1.5);
  });
  paintSun(p, 44, 40, 3.6);
  // serra azulada, colinas e copas
  for (let x = 9; x < 56; x++) {
    const far = Math.round(37 + 1.8 * Math.sin(x * 0.2 + 1) + Math.sin(x * 0.53));
    for (let y = far; y < 48; y++) if (win(x + 0.5, y + 0.5)) p.set(x, y, pick(PAL.far, (y === far ? 0.95 : 0.6) - (y - far) * 0.06 + clamp01(1 - Math.abs(x - 44) / 10) * 0.15, x, y));
    const near = Math.round(42 + 1.4 * Math.sin(x * 0.31 + 2));
    for (let y = near; y < 48; y++) if (win(x + 0.5, y + 0.5)) p.set(x, y, pick(PAL.grass, (y === near ? 0.55 : 0.32) - (y - near) * 0.04, x, y));
  }
  for (const [x, y, r] of [[12, 41, 4], [17, 43, 3], [52, 42, 3.5], [24, 45, 2.6], [46, 45, 2.4]]) {
    p.sphere(x, y, r, r * 0.9, PAL.tree, -0.05, 1.6);
  }
  // hera subindo pelo batente, com florzinhas
  for (const [x0, dir] of [[8, 1], [56, -1]]) {
    for (let y = 4; y < 49; y++) {
      const x = x0 + Math.round(Math.sin(y * 0.4 + x0) * 1.2);
      if (hash(x, y, 7) < 0.75) p.set(x, y, LEAF[hash(x, y, 8) < 0.4 ? 1 : 2]);
      if (y % 4 === 0) {
        p.set(x + dir, y, LEAF[3]);
        p.set(x + dir * 2, y - 1, LEAF[hash(x, y, 9) < 0.5 ? 4 : 3]);
        p.set(x + dir, y + 1, LEAF[1]);
      }
      if (y % 9 === 5) p.set(x - dir, y, PETAL[y % 2 ? 0 : 2]);
    }
  }
  // ramos pendurados no alto do arco
  for (const [x, len] of [[18, 7], [24, 4], [40, 5], [46, 8], [30, 3]]) {
    for (let k = 0; k < len; k++) {
      const y = Math.round(5 + Math.abs(x - 32) * 0.35 - (Math.abs(x - 32) > 14 ? 3 : 0)) + k;
      p.set(x + (k % 3 === 2 ? 1 : 0), y, LEAF[k % 2 ? 2 : 3]);
      if (k % 2) p.set(x - 1, y, LEAF[1]);
    }
  }
  // peitoril
  p.rect(6, 47, 52, 2, (x, y) => pick(SAND, (y === 47 ? 0.85 : 0.4) - (x - 6) * 0.004 + glow(x, y), x, y));
  // mesa de madeira em perspectiva, com pétalas e folhas espalhadas
  for (let y = 49; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v;
      if (y < 59) {
        const plank = Math.floor((y - 49) / 2.5);
        v = 0.5 - (y - 49) * 0.012 + (hash(plank, x >> 3, 42) - 0.5) * 0.12 + (hash(x, y, 43) - 0.5) * 0.08;
        if ((y - 49) % 3 === 2) v -= 0.12;
      } else if (y < 61) v = y === 59 ? 0.42 : 0.24;
      else v = 0.05;
      v += glow(x, y) * (y < 59 ? 1 : 0.4);
      p.d[y * 64 + x] = pick(PAL.wood, v, x, y, 2);
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(4 + hash(i, 1, 44) * 56), y = Math.floor(51 + hash(i, 2, 44) * 7);
    if (Math.abs(x - 32) < 9) continue;
    const c = PETAL[i % 4];
    p.set(x, y, c);
    p.set(x + 1, y, i % 4 === 1 ? PETAL[0] : c);
    if (i % 3 === 0) p.set(x, y - 1, PETAL[2]);
  }
  for (const [x, y] of [[9, 54], [50, 56], [55, 52]]) {
    p.set(x, y, LEAF[3]); p.set(x + 1, y, LEAF[2]); p.set(x + 2, y - 1, LEAF[4]); p.set(x + 1, y + 1, LEAF[1]);
  }
  return p;
}

const elInBulb = (x, y) => ((x - EL_BULB[0]) / EL_BULB[2]) ** 2 + ((y - EL_BULB[1]) / EL_BULB[3]) ** 2 <= 1;

function buildElixir() {
  const p = new Pix(64, 64);
  const [cx, cy, rx, ry] = EL_BULB;
  // pezinho de ouro
  p.fill(24, 49, 40, 53, (x, y) => Math.abs(x + 0.5 - cx) <= 6.5 + (y - 49) * 0.6, (x, y) =>
    pick(PAL.gold, 0.15 + cylLight((x + 0.5 - cx) / 9) * 0.8 + (y === 49 ? 0.15 : y === 53 ? -0.2 : 0), x, y));
  for (const x of [26, 32, 38]) p.set(x, 51, PAL.gold[5]);
  // bojo de vidro: em cima vazio, embaixo o elixir
  p.fill(cx - rx, cy - ry, cx + rx, cy + ry, elInBulb, (x, y) => {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (y < EL_SURF) return pick(GLASSY, 0.3 + sphereLight(nx, ny) * 0.55, x, y);
    const core = clamp01(1 - Math.hypot(x + 0.5 - cx, (y + 0.5 - 43) * 1.1) / 8.5);
    return pick(ELIXIR, 0.18 + sphereLight(nx, ny) * 0.3 + core * core * 0.55 + core * 0.12, x, y, 2.6);
  });
  // linha da superfície
  for (let x = Math.ceil(cx - rx); x <= cx + rx; x++) if (elInBulb(x + 0.5, EL_SURF + 0.5)) p.set(x, EL_SURF, ELIXIR[6]);
  // gargalo com espiral de arame dourado
  p.rect(29, 17, 7, 14, (x, y) => {
    const k = x - 29;
    if ((y + k * 0.8) % 5 < 1 && k > 0 && k < 6) return PAL.gold[k < 3 ? 4 : 2];
    return GLASSY[[2, 4, 3, 2, 2, 1, 0][k]];
  });
  p.rect(27, 15, 11, 2, (x, y) => pick(PAL.gold, (y === 15 ? 0.8 : 0.4) + cylLight((x + 0.5 - cx) / 5.5) * 0.3 - 0.15, x, y));
  // gola de ouro com folhas em volta do gargalo
  p.rect(26, 30, 13, 2, (x, y) => pick(PAL.gold, (y === 30 ? 0.85 : 0.35) + cylLight((x + 0.5 - cx) / 6.5) * 0.25 - 0.1, x, y));
  // folhas de ouro caindo pelos ombros do bojo
  for (const s of [-1, 1]) {
    for (const [dx, dy, k] of [[6, 2, 4], [7, 2, 3], [7, 3, 4], [8, 3, 3], [8, 4, 2], [9, 4, 3], [9, 5, 2], [6, 3, 2], [7, 4, 1]]) {
      p.set(Math.round(cx - 0.5 + s * dx), 30 + dy, PAL.gold[s < 0 ? Math.min(5, k + 1) : k]);
    }
  }
  for (const x of [29, 32, 35]) p.set(x, 31, x === 32 ? ELIXIR[5] : PAL.gold[5]);
  // filigrana de ouro descendo pelo bojo
  for (const a of [-0.62, 0.62, -1.15, 1.15]) {
    for (let y = 32; y <= 50; y++) {
      const ny = (y + 0.5 - cy) / ry;
      if (Math.abs(ny) > 1) continue;
      const x = Math.round(cx - 0.5 + Math.sin(a) * rx * Math.sqrt(1 - ny * ny));
      if (!elInBulb(x + 0.5, y + 0.5)) continue;
      p.set(x, y, PAL.gold[a < 0 ? (y < 40 ? 5 : 4) : y < 40 ? 3 : 2]);
    }
  }
  for (const [x, y] of [[26, 36], [38, 36], [27, 47], [37, 47]]) p.set(x, y, PAL.gold[5]);
  // reflexos no vidro
  for (const [x, y] of [[25, 35], [24, 36], [24, 37], [23, 38], [23, 39], [30, 18], [30, 19], [30, 20]]) p.set(x, y, GLASSY[4]);
  p.set(26, 33, WHITE);
  p.outline(PAL.out);
  // rolha de cristal verde
  const stop = new Pix(64, 64);
  stop.poly([[32.5, 5], [36, 10], [34.5, 14.5], [30.5, 14.5], [29, 10]], (x, y) => {
    const dx = x + 0.5 - 32.5;
    return pick(ELIXIR, (dx < -0.5 ? 0.8 : dx < 1 ? 0.62 : 0.4) - (y - 5) * 0.02 + (y < 9 ? 0.1 : 0), x, y);
  });
  stop.set(31, 9, WHITE);
  stop.outline(PAL.out);
  p.blit(stop, 0, 0);
  return p;
}

const elArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintElixirPortrait(ctx, t, info) {
  const a = elArt;
  if (!a.bg) {
    a.bg = buildElixirBackdrop(false);
    a.halo = makeHalo(a.bg, buildElixirBackdrop(true), (x, y) => Math.hypot(x - 32, (y - 44) * 1.4) / 30);
    a.body = buildElixir();
    // pixels do líquido para o brilho que gira lá dentro
    a.liquid = [];
    for (let i = 0; i < 4096; i++) {
      const k = ELIXIR.indexOf(a.body.d[i]);
      if (k >= 0 && (i >> 6) > EL_SURF && elInBulb((i & 63) + 0.5, (i >> 6) + 0.5)) a.liquid.push(i, k);
    }
    a.liquid = Int16Array.from(a.liquid);
    a.gold = rampPixels(a.body, PAL.gold, 20, 14, 44, 54);
  }
  const f = a.frame.copyFrom(a.bg);
  const w = info.working;
  const beat = 0.5 + 0.5 * Math.sin(t * (w ? 2.6 : 1.5));
  paintHalo(f, a.halo, 0.25 + beat * (w ? 0.55 : 0.35));
  // folhas caindo atrás do frasco
  const leaves = (n, seed, front) => {
    for (let k = 0; k < n; k++) {
      const u = (t * (0.05 + hash(k, 1, seed) * 0.04) + hash(k, 2, seed)) % 1;
      const x = hash(k, 3, seed) * 70 - 3 + Math.sin(t * 0.9 + k * 1.7) * 5;
      const y = u * 66 - 3;
      if (front && Math.abs(x - 32) < 12 && y > 4 && y < 54) continue;
      const turn = Math.sin(t * 2.2 + k * 2);
      f.set(x, y, LEAF[4]);
      f.set(x + (turn > 0 ? 1 : -1), y + (Math.abs(turn) < 0.5 ? 1 : 0), LEAF[2]);
      if (Math.abs(turn) > 0.6) f.set(x, y + 1, LEAF[3]);
    }
  };
  leaves(5, 51, false);
  f.blit(a.body, 0, 0);
  // o elixir ondula por dentro, com bolhas subindo
  const L = a.liquid, d = f.d;
  const sp = w ? 2.4 : 1.2;
  for (let i = 0; i < L.length; i += 2) {
    const x = L[i] & 63, y = L[i] >> 6;
    const s = Math.sin(x * 0.7 - y * 0.5 + t * sp) + Math.sin(x * 0.3 + y * 0.9 - t * sp * 0.7);
    if (s > 1.45) d[L[i]] = ELIXIR[Math.min(6, L[i + 1] + 1)];
    else if (s < -1.6) d[L[i]] = ELIXIR[Math.max(1, L[i + 1] - 1)];
  }
  const nb = w ? 9 : 5;
  for (let k = 0; k < nb; k++) {
    const u = (t * (0.35 + hash(k, 1, 52) * 0.3) * (w ? 1.4 : 1) + hash(k, 2, 52)) % 1;
    const y = 49 - u * 15;
    const x = 26 + hash(k, 3, 52) * 12 + Math.sin(t * 4 + k * 2) * 0.8;
    if (!elInBulb(x, y) || y < EL_SURF + 1) continue;
    const big = k % 3 === 0 && u > 0.3;
    f.set(x, y, ELIXIR[6]);
    if (big) { f.set(x + 1, y, ELIXIR[5]); f.set(x, y - 1, ELIXIR[5]); f.set(x + 1, y - 1, WHITE); }
  }
  // brilho correndo pelo ouro e cintilar da rolha
  sweepGlint(f, a.gold, PAL.gold, ((t * (w ? 0.55 : 0.32)) % 1.4) * 60 + 20);
  sparkle(f, 31, 8, pulse(t, w ? 2.6 : 4.2, 0, 0.6), ELIXIR[5]);
  // fagulhas de vida subindo da rolha
  paintMotes(f, t, w ? 8 : 4, 53, 32, 14, 8, 16, w ? 0.45 : 0.25, LIFE_MOTES);
  leaves(4, 54, true);
  f.draw(ctx);
}

function iconElixir() {
  const p = new Pix(16, 16);
  p.sphere(8, 10.5, 5.4, 4.8, GLASSY, 0.1);
  p.fill(2, 9, 14, 16, (x, y) => ((x - 8) / 4.6) ** 2 + ((y - 10.5) / 4) ** 2 <= 1 && y >= 9, (x, y) =>
    ELIXIR[y > 13 ? 2 : x < 6 ? 5 : 4 - ((x + y) % 4 === 0 ? 1 : 0)]);
  p.rect(7, 3, 3, 3, (x) => GLASSY[x === 7 ? 4 : 2]);
  p.rect(6, 5, 5, 1, PAL.gold[4]);
  p.rect(7, 0, 3, 3, (x, y) => ELIXIR[x === 7 ? 6 : y === 0 ? 5 : 3]);
  p.set(5, 9, WHITE);
  p.set(10, 12, ELIXIR[6]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Grande Obra

const COSMOS = ramp('#06051a', '#0c0a26', '#151036', '#1f1748', '#2b1f5a', '#3a2a6c', '#4c3880');
const COSMOS_LIT = ramp('#2c2050', '#463068', '#6a4478', '#94607e', '#c08a7e', '#e2b47e', '#f8dc96');
const NEBULA = ramp('#1a1040', '#2e1656', '#4a1e6a', '#6a2c7a', '#8c4088', '#b05c94');
const SUN = ramp('#7f5018', '#b98126', '#e5b342', '#f8dc7a', '#fff2b8', '#fffbe8', '#ffffff');
const SERPENT = ramp('#062418', '#0c4028', '#16683c', '#24904c', '#4cb862', '#94e08a');
const MARBLE_DK = ramp('#0e0a18', '#171126', '#221934', '#2e2244', '#3c2e56', '#4e3c6a');
const MO_SUN = [32, 24];
const MO_RING = { rx: 18, ry: 6.6, tilt: -0.26, half: 2 };
const MO_FLOOR = [32, 55.5, 30, 8.2];

function buildOpusBackdrop(lit) {
  const p = new Pix(64, 64);
  const [sx, sy] = MO_SUN;
  // cosmos: fundo violeta com nebulosas e a claridade em volta do sol
  for (let y = 0; y < 47; y++) {
    for (let x = 0; x < 64; x++) {
      // nebulosa: uma faixa ondulada atravessando o céu na diagonal
      const band = (y - 10 - x * 0.45 - Math.sin(x * 0.12) * 4) / 9;
      const n = Math.exp(-band * band) * (0.75 + Math.sin(x * 0.21 + y * 0.17) * 0.25);
      const near = clamp01(1 - Math.hypot(x - sx, (y - sy) * 1.1) / 36);
      if (lit) { p.d[y * 64 + x] = pick(COSMOS_LIT, 0.1 + near * 0.8 + n * 0.1, x, y, 2); continue; }
      let c = pick(COSMOS, 0.1 + y * 0.008 + near * 0.55 + n * 0.1, x, y, 1.8);
      if (n > 0.45 && near < 0.6) c = pick(NEBULA, (n - 0.45) * 1.6 + near * 0.4, x, y, 1.4);
      p.d[y * 64 + x] = c;
    }
  }
  // chão de mármore escuro em perspectiva, com o círculo de transmutação
  for (let y = 47; y < 64; y++) {
    const k = (y - 46) / 18;
    for (let x = 0; x < 64; x++) {
      const u = (x - 32) / (0.6 + k * 1.4);
      const joint = Math.abs(((u / 7) % 1 + 1) % 1 - 0.5) > 0.465 || [49, 53, 58].includes(y);
      const vein = Math.abs(Math.sin(x * 0.4 + y * 0.9 + Math.sin(x * 0.13) * 3)) < 0.1;
      let v = 0.25 + k * 0.2 + clamp01(1 - Math.hypot(x - 32, (y - 55) * 3) / 36) * 0.3 - (joint ? 0.14 : 0) - (vein ? 0.08 : 0);
      if (y === 47) v = 0.55;
      if (lit) v += 0.25;
      p.d[y * 64 + x] = pick(MARBLE_DK, v, x, y, 2);
    }
  }
  return p;
}

// Círculo da Grande Obra: anéis ligados por raios, com sinais em volta.
function buildOpusCircle() {
  const p = new Pix(64, 64);
  const [cx, cy, rx, ry] = MO_FLOOR;
  const at = (a, r) => [cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry];
  for (let y = 46; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if ((d > 0.94 && d <= 1) || (d > 0.82 && d <= 0.86) || (d > 0.26 && d <= 0.33)) p.set(x, y, SUN[1]);
    }
  }
  // raios curtos ligando os anéis, como um mostrador, e sinais entre eles
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const [x0, y0] = at(a, 0.33), [x1, y1] = at(a, 0.82);
    if (i % 3 === 0) p.line(x0, y0, x1, y1, SUN[1]);
    const [gx, gy] = at(a + Math.PI / 12, 0.9);
    p.set(gx, gy, SUN[3]);
    p.set(gx + 1, gy, SUN[3]);
  }
  return p;
}

function buildOpusRing() {
  // anel inclinado da ouroboros: cada pixel guarda o ângulo ao longo do corpo,
  // a distância até o eixo do corpo e se fica na frente ou atrás do sol
  const { rx, ry, tilt, half } = MO_RING;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const pts = [];
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
    pts.push([ex * ct - ey * st, ex * st + ey * ct, a]);
  }
  const list = [];
  for (let y = -16; y <= 16; y++) {
    for (let x = -24; x <= 24; x++) {
      let best = Infinity, ba = 0, bx = 0, by = 0;
      for (const [px, py, a] of pts) {
        const d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2;
        if (d < best) { best = d; ba = a; bx = px; by = py; }
      }
      const dist = Math.sqrt(best);
      if (dist > half + 0.6) continue;
      // lado de fora (+) ou de dentro (-) do anel
      const out = (x + 0.5) * bx + (y + 0.5) * by > bx * bx + by * by ? 1 : -1;
      list.push(x, y, ba / (Math.PI * 2), (dist * out) / half, Math.sin(ba) > 0 ? 1 : 0);
    }
  }
  // separa em duas listas: a metade de trás e a da frente do sol
  const part = (front) => {
    const out = [];
    for (let i = 0; i < list.length; i += 5) if (list[i + 4] === front) out.push(list[i], list[i + 1], list[i + 2], list[i + 3]);
    return Float32Array.from(out);
  };
  return [part(0), part(1)];
}

function buildOpusSun() {
  const p = new Pix(64, 64);
  const [sx, sy] = MO_SUN;
  // coroa de raios retos e ondulados, alternados
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const len = i % 2 ? 11.5 : 13.5;
    for (let r = 7; r <= len; r += 0.35) {
      const wob = i % 2 ? Math.sin(r * 1.6) * 0.9 : 0;
      const x = sx + Math.cos(a) * r - Math.sin(a) * wob, y = sy + Math.sin(a) * r + Math.cos(a) * wob;
      const k = r > len - 1.5 ? 3 : r < 9 ? 5 : 4;
      p.set(x, y, SUN[k]);
      if (i % 2 === 0 && r < len - 3) p.set(x + Math.cos(a + 1.57) * 0.8, y + Math.sin(a + 1.57) * 0.8, SUN[k - 1]);
    }
  }
  // esfera de luz
  p.fill(sx - 8, sy - 8, sx + 8, sy + 8, (x, y) => Math.hypot(x - sx, y - sy) <= 7.2, (x, y) => {
    const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / 7.2;
    return pick(SUN, 0.35 + sphereLight((x + 0.5 - sx) / 7.2, (y + 0.5 - sy) / 7.2) * 0.35 + (1 - d) * 0.45, x, y, 2.4);
  });
  p.outline(PAL.out);
  // o ponto do símbolo do sol, no meio
  p.rect(sx - 1, sy - 1, 2, 2, SUN[2]);
  return p;
}

const moArt = { bg: null, frame: new Pix(64, 64) };
const MO_GLOW = [COSMOS_LIT[3], COSMOS_LIT[5], SUN[3]];

function paintOpusRing(f, ring, ox, oy, t, front, w) {
  // a cabeça anda pelo anel; o corpo vem atrás e afina até a cauda presa na boca
  const head = t * (w ? 1.1 : 0.6);
  const hf = head / (Math.PI * 2);
  const part = ring[front];
  for (let i = 0; i < part.length; i += 4) {
    let u = hf - part[i + 2];
    u -= Math.floor(u);
    const r = part[i + 3];
    const wd = u > 0.78 ? 1 - (u - 0.78) * 2.6 : 1;
    const ar = Math.abs(r);
    if (ar > wd + 0.35 || u < 0.035) continue;
    const x = ox + part[i], y = oy + part[i + 1];
    if (ar > wd - 0.28) { f.set(x, y, PAL.out); continue; }
    // escamas em faixas ao longo do corpo, barriga dourada do lado de dentro
    const sv = u * 44 + (r > 0 ? 0.5 : 0);
    const scale = sv - Math.floor(sv) < 0.34;
    let c;
    if (r < -0.45) c = SUN[scale ? 1 : 3];
    else c = SERPENT[(r > 0.45 ? 2 : r > -0.05 ? 3 : 4) + (scale ? -1 : 1)];
    f.set(x, y, c);
  }
  // cabeça: elipse alongada na direção do movimento, com olho e focinho
  const { rx, ry, tilt } = MO_RING;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const at = (a) => {
    const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
    return [ox + ex * ct - ey * st, oy + ex * st + ey * ct];
  };
  if ((Math.sin(head) > 0 ? 1 : 0) !== front) return;
  const [hx, hy] = at(head - 0.06);
  const [nx, ny] = at(head + 0.08);
  let tx = nx - hx, ty = ny - hy;
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl; ty /= tl;
  for (let y = Math.floor(hy - 4); y <= hy + 4; y++) {
    for (let x = Math.floor(hx - 4); x <= hx + 4; x++) {
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy;
      const along = dx * tx + dy * ty, across = -dx * ty + dy * tx;
      const e = (along / 3.3) ** 2 + (across / 2.5) ** 2;
      if (e > 1.45) continue;
      if (e > 1) { f.set(x, y, PAL.out); continue; }
      f.set(x, y, SERPENT[along > 1.2 ? 3 : across * (tx > 0 ? 1 : -1) < -0.4 ? 5 : 4]);
    }
  }
  // olho dourado
  const ox2 = hx + tx * 0.7 + ty * 0.9 * (tx > 0 ? 1 : -1), oy2 = hy + ty * 0.7 - tx * 0.9 * (tx > 0 ? 1 : -1);
  f.set(ox2, oy2, PAL.gold[5]);
  f.set(ox2 - tx, oy2 - ty, PAL.gold[4]);
  f.set(ox2 + tx * 0.6, oy2 + ty * 0.6, PHIL[2]);
}

function paintOpusPortrait(ctx, t, info) {
  const a = moArt;
  const [sx, sy] = MO_SUN;
  if (!a.bg) {
    a.bg = buildOpusBackdrop(false);
    const lit = buildOpusBackdrop(true);
    a.stars = makeStars(30, 9, (x, y) => y < 46 && Math.hypot(x - sx, y - sy) > 18);
    // raios de luz atrás do sol
    const rays = [];
    for (let y = 0; y < 47; y++) {
      for (let x = 0; x < 64; x++) {
        const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
        const k = clamp01(1.3 - d / 32);
        if (d < 8 || k <= bayer(x, y)) continue;
        const b = Math.floor(((Math.atan2(y + 0.5 - sy, x + 0.5 - sx) + Math.PI) / (Math.PI * 2)) * 128) & 127;
        rays.push([b, y * 64 + x, Math.round((bayer(x, y) / k) * 255), lit.d[y * 64 + x]]);
      }
    }
    a.rays = groupRays(rays);
    a.floorHalo = makeHalo(a.bg, lit, (x, y) => (y < 47 ? null : Math.hypot(x - 32, (y - 55) * 3) / 34));
    const circle = buildOpusCircle();
    a.circle = [];
    for (let i = 0; i < 4096; i++) {
      if (!circle.d[i]) continue;
      const ang = Math.atan2(((i >> 6) + 0.5 - MO_FLOOR[1]) / MO_FLOOR[3], ((i & 63) + 0.5 - MO_FLOOR[0]) / MO_FLOOR[2]);
      a.circle.push(i, Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 64) & 63, circle.d[i] === SUN[3] ? 0.2 : 0);
    }
    a.circle = Float32Array.from(a.circle);
    a.run = new Float32Array(64);
    // o sol recortado no seu quadrado, para o blit não varrer os 64x64
    const sun = buildOpusSun();
    a.sun = new Pix(36, 36);
    for (let y = 0; y < 36; y++) for (let x = 0; x < 36; x++) a.sun.d[y * 36 + x] = sun.d[(sy - 18 + y) * 64 + sx - 18 + x];
    a.ring = buildOpusRing();
  }
  const f = a.frame.copyFrom(a.bg);
  const w = info.working;
  const d = f.d;
  paintStars(f, a.stars, t);
  // emanações: raios largos girando devagar em volta do sol
  // (sen(8a + p1) * 0.6 + sen(13a + p2) * 0.4, pela soma de ângulos)
  const p1 = t * (w ? 0.6 : 0.3), p2 = -t * 0.4;
  const c1 = Math.cos(p1) * 0.6, s1 = Math.sin(p1) * 0.6, c2 = Math.cos(p2) * 0.4, s2 = Math.sin(p2) * 0.4;
  const beam = a.rays.beam, st = SECTOR_TRIG;
  for (let b = 0, j = 0; b < 128; b++, j += 4) beam[b] = (st[j] * c1 + st[j + 1] * s1 + st[j + 2] * c2 + st[j + 3] * s2 - 0.2) * 612;
  paintRays(d, a.rays);
  // chão aceso pela luz que pulsa
  const beat = 0.5 + 0.5 * Math.sin(t * (w ? 2.8 : 1.6));
  paintHalo(f, a.floorHalo, 0.3 + beat * 0.4);
  // círculo de transmutação: o brilho corre pela volta
  const c = a.circle, run = a.run;
  const q = t * (w ? 1.8 : 0.9), cq = Math.cos(q), sq = Math.sin(q);
  for (let b = 0; b < 64; b++) {
    const v = Math.max(0, RUN_TRIG[b * 2] * cq - RUN_TRIG[b * 2 + 1] * sq), v2 = v * v;
    run[b] = 0.05 + beat * 0.12 + v * v2 * v2 * 0.55;
  }
  for (let i = 0; i < c.length; i += 3) d[c[i]] = SUN[Math.min(6, ((run[c[i + 1]] + c[i + 2]) * 6.5) | 0)];
  // coluna de luz descendo do sol até o círculo
  for (let y = sy + 8; y < 58; y++) {
    const hw = 1.5 + (y - sy) * 0.06 + beat * 0.6;
    for (let x = Math.floor(32 - hw); x <= 32 + hw; x++) {
      const e = 1 - Math.abs(x + 0.5 - 32) / hw;
      if (bayer(x, y + Math.floor(t * 8)) < e * 0.55) f.set(x, y, SUN[e > 0.6 ? 4 : 3]);
    }
  }
  paintMotes(f, t, w ? 14 : 8, 61, 32, 60, 52, 44, w ? 0.28 : 0.15, SUN_MOTES);
  const bob = Math.round(Math.sin(t * 1.2) * 1);
  paintOpusRing(f, a.ring, sx, sy + bob, t, 0, w);
  paintGlow(f, sx, sy + bob, 11 + beat * 3, 0.45, MO_GLOW);
  f.blit(a.sun, sx - 18, sy - 18 + bob);
  // pontos de luz girando em volta da coroa
  const spin = t * (w ? 0.5 : 0.25);
  for (let i = 0; i < 8; i++) {
    const ang = spin + (i / 8) * Math.PI * 2;
    const x = sx + Math.cos(ang) * 10.5, y = sy + bob + Math.sin(ang) * 10.5;
    f.set(x, y, SUN[6]);
  }
  paintOpusRing(f, a.ring, sx, sy + bob, t, 1, w);
  sparkle(f, sx - 3, sy - 3 + bob, pulse(t, w ? 1.8 : 3, 0, 0.7), SUN[4]);
  f.draw(ctx);
}

// Silhueta: o sol com a coroa de raios e o anel da serpente.
function buildOpusLocked() {
  const p = new Pix(64, 64);
  const [sx, sy] = MO_SUN;
  p.blit(buildOpusSun(), 0, 0);
  for (const part of buildOpusRing()) {
    for (let i = 0; i < part.length; i += 4) if (Math.abs(part[i + 3]) < 1.3) p.set(sx + part[i], sy + part[i + 1], SERPENT[3]);
  }
  return p;
}

function iconOpus() {
  const p = new Pix(16, 16);
  const ring = (back) => {
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      if ((Math.sin(a) < 0) !== back) continue;
      const x = 8 + Math.cos(a) * 6.8 * Math.cos(-0.3) - Math.sin(a) * 2.4 * Math.sin(-0.3);
      const y = 8.5 + Math.cos(a) * 6.8 * Math.sin(-0.3) + Math.sin(a) * 2.4 * Math.cos(-0.3);
      p.set(x, y, SERPENT[k > 8 && k < 13 ? 5 : back ? 2 : 4]);
    }
  };
  // a serpente passa atrás e na frente do sol com coroa de raios
  ring(true);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    for (let r = 4; r <= (i % 2 ? 5.6 : 7); r += 0.5) p.set(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, SUN[i % 2 ? 3 : 4]);
  }
  p.sphere(8, 8, 3.6, 3.6, SUN, 0.35);
  p.set(8, 8, SUN[1]);
  ring(false);
  p.outline(PAL.out);
  return p;
}

ART.portraits.archmage = paintArchmagePortrait;
ART.locked.archmage = ART.silhouette(buildArchmage);
ART.icons.archmage = iconArchmage;
ART.portraits.arcanetower = paintTowerPortrait;
ART.locked.arcanetower = ART.silhouette(buildTowerLocked);
ART.icons.arcanetower = iconTower;
ART.portraits.philstone = paintPhilPortrait;
ART.locked.philstone = ART.silhouette(buildPhilLocked);
ART.icons.philstone = iconPhilstone;
ART.portraits.elixir = paintElixirPortrait;
ART.locked.elixir = ART.silhouette(buildElixir);
ART.icons.elixir = iconElixir;
ART.portraits.magnumopus = paintOpusPortrait;
ART.locked.magnumopus = ART.silhouette(buildOpusLocked);
ART.icons.magnumopus = iconOpus;
})();
