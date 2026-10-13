'use strict';
// Linha dos minérios, tiers 7 a 10: Ourives (gera poços), Casa da moeda (gera
// ourives), Guilda (gera casas da moeda) e Veio de ouro (gera guildas).
// Retratos animados, silhuetas bloqueadas e ícones.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL } = ART;

const AX = 32.5; // eixo vertical dos retratos (centro do pixel 32)

// pedras, metais e gemas da linha
const COPPER = ramp('#2e140c', '#5a2614', '#8a3c1e', '#b65a2c', '#d8803e', '#f0aa66', '#fcd49a');
const BRONZE = ramp('#1c120a', '#3a2412', '#5c3a1a', '#805426', '#a67036', '#c8924c', '#e6b86c', '#f8e0a0');
const RUBY = ramp('#3a0610', '#7a1020', '#be2234', '#ee5a5a', '#ffc0b0');
const EMERALD = ramp('#06281a', '#0e4a2c', '#1a7a44', '#3cb066', '#a4ecae');
const SAPPHIRE = ramp('#0a1440', '#162c80', '#2a52c0', '#5e8ef0', '#bcd6ff');
const QUARTZ = ramp('#3e3844', '#6a6270', '#9a9298', '#c8c0bc', '#ece6dc', '#fffcf2');

// ---------------------------------------------------------------------------
// Peças comuns

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

// Chama de tocha ou lamparina com a base em (x, y): núcleo claro embaixo, ponta que dança.
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

// Pulso de brilho que aparece de tempos em tempos: 0 quase sempre, sobe e desce rápido.
function pulse(t, period, width) {
  const ph = (t % period) / width;
  return ph < 1 ? Math.sin(ph * Math.PI) : 0;
}

// Distância de (px, py) até a poligonal e o vetor do ponto mais próximo até ele.
function nearestOnPath(path, px, py) {
  let best = Infinity, bx = 0, by = 0, at = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [cx, cy] = path[i + 1];
    const dx = cx - ax, dy = cy - ay;
    const s = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
    const ox = px - ax - dx * s, oy = py - ay - dy * s;
    const d = ox * ox + oy * oy;
    if (d < best) { best = d; bx = ox; by = oy; at = i + s; }
  }
  return [Math.sqrt(best), bx, by, at];
}

// Tubo grosso ao longo de uma poligonal, sombreado como cilindro.
function tube(p, path, half, r, bias = 0, crisp = 2.2) {
  let x0 = 64, y0 = 64, x1 = 0, y1 = 0;
  for (const [x, y] of path) {
    x0 = Math.min(x0, x - half - 1); x1 = Math.max(x1, x + half + 1);
    y0 = Math.min(y0, y - half - 1); y1 = Math.max(y1, y + half + 1);
  }
  p.fill(x0, y0, x1, y1, (x, y) => nearestOnPath(path, x, y)[0] <= half, (x, y) => {
    const [, ox, oy] = nearestOnPath(path, x + 0.5, y + 0.5);
    return pick(r, 0.08 + sphereLight(ox / (half + 0.4), oy / (half + 0.4)) * 0.9 + bias, x, y, crisp);
  });
}

// ---------------------------------------------------------------------------
// Ourives

const SHOP = ramp('#151012', '#221a1a', '#31251f', '#433328', '#584334', '#6f5641', '#896c50', '#a68a64');
const CAP = ramp('#0a141c', '#11222e', '#1a3444', '#25485a', '#335e72', '#477a8c');
const GREY = ramp('#2a262c', '#47434a', '#68646c', '#8c888e', '#b2aeb2', '#d6d4d2', '#f2f0ec');
const PANE = ramp('#5a7a96', '#7896ae', '#9cb6c6', '#c2d6dc', '#e6eee8', '#fbfcf2');
const LASH = C('#33201a');

const WIN_X = 9.5, WIN_HALF = 5.5, WIN_TOP = 3, WIN_SPRING = 8.5, WIN_SILL = 21;
const inWindow = (x, y, grow = 0) => {
  if (y > WIN_SILL + grow * 0.6 || Math.abs(x - WIN_X) > WIN_HALF + grow) return false;
  if (y >= WIN_SPRING) return true;
  return ((x - WIN_X) / (WIN_HALF + grow)) ** 2 + ((y - WIN_SPRING) / (WIN_SPRING - WIN_TOP + grow)) ** 2 <= 1;
};
// raios de luz entrando pela janela, descendo para a direita
const windowShaft = (x, y) => {
  for (let s = 2; s < 52; s++) {
    const qx = x + 0.5 - s * 0.62, qy = y + 0.5 - s;
    if (qy < WIN_TOP) break;
    if (inWindow(qx, qy) && (Math.floor(qx) + Math.floor(qy)) % 4 !== 0) return s;
  }
  return 0;
};

const SCALE_X = 55.5, SCALE_Y = 24; // pivô da balança

function buildGoldsmithBackdrop() {
  const p = new Pix(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const s = inWindow(x + 0.5, y + 0.5, 1.6) ? 0 : windowShaft(x, y);
      const beam = s ? 0.2 * (1 - s / 52) : 0;
      const near = 0.24 * clamp01(1 - Math.hypot(x - 9, (y - 14) * 0.8) / 40);
      const v = 0.12 + beam + near + masonry(x, y, 8, 4, 91) * 0.85 + (hash(x, y, 92) - 0.5) * 0.06;
      p.d[y * 64 + x] = pick(SHOP, v, x, y, 2);
    }
  }
  // janela em arco com vidraça de losangos
  p.fill(0, 0, 20, 24, (x, y) => inWindow(x, y, 1.6), (x, y) => pick(PAL.stone, 0.66 - (x - WIN_X) * 0.04 + masonry(x, y, 4, 3, 93) * 0.6, x, y));
  p.fill(0, 0, 20, 24, (x, y) => inWindow(x, y), (x, y) => {
    if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) return C('#3a3238');
    let v = 0.82 - (y - 3) * 0.022 - (x - 4) * 0.012;
    if (y > 15) v -= (y - 15) * 0.03; // telhados lá fora
    return pick(PANE, v + (hash((x + y) >> 2, (x - y + 64) >> 2, 94) - 0.5) * 0.14, x, y, 1.5);
  });
  p.rect(WIN_X - 7, WIN_SILL + 1, 15, 2, (x, y) => pick(PAL.stone, (y === WIN_SILL + 1 ? 0.88 : 0.42) - (x - WIN_X) * 0.02, x, y));
  // vaso com uma planta no peitoril
  p.rect(12, 19, 3, 3, (x) => COPPER[x === 12 ? 4 : x === 13 ? 3 : 2]);
  for (const [x, y, k] of [[13, 18, 4], [12, 17, 3], [14, 17, 3], [11, 16, 4], [15, 16, 2], [13, 16, 5], [12, 18, 2]]) p.set(x, y, PAL.herb[k]);

  // régua de ferramentas pendurada na parede
  p.rect(45, 6, 19, 2, (x, y) => pick(PAL.wood, (y === 6 ? 0.66 : 0.3) + (hash(x >> 2, 0, 95) - 0.5) * 0.1, x, y));
  for (const x of [48, 53, 57, 61]) p.set(x, 8, PAL.iron[1]);
  // alicate
  p.set(48, 9, PAL.iron[3]); p.set(47, 9, PAL.iron[2]); p.set(49, 9, PAL.iron[2]);
  p.set(48, 10, PAL.iron[4]);
  p.line(47, 11, 46, 17, PAL.iron[3]);
  p.line(49, 11, 50, 17, PAL.iron[2]);
  p.set(46, 18, COPPER[3]); p.set(50, 18, COPPER[2]);
  // martelinho pendurado pela cabeça
  p.rect(51, 9, 5, 2, (x, y) => PAL.iron[y === 9 ? (x < 53 ? 4 : 3) : 1]);
  p.line(53, 11, 53, 18, (x, y) => PAL.wood[y % 3 ? 3 : 2]);
  // lima
  p.rect(57, 9, 1, 3, (x, y) => PAL.wood[y === 9 ? 4 : 3]);
  for (let y = 12; y <= 19; y++) { p.set(57, y, PAL.iron[y % 2 ? 3 : 4]); p.set(58, y, PAL.iron[y % 2 ? 1 : 2]); }
  // compasso aberto
  p.set(61, 9, PAL.gold[4]);
  p.line(61, 10, 59, 18, PAL.iron[3]);
  p.line(61, 10, 63, 18, PAL.iron[2]);

  // bancada com a balança e lingotes
  p.rect(45, 41, 19, 2, (x, y) => pick(PAL.wood, (y === 41 ? 0.78 : 0.42) + (hash(x >> 2, y, 96) - 0.5) * 0.12, x, y));
  p.rect(45, 43, 19, 21, (x, y) => pick(PAL.wood, 0.18 - (y - 43) * 0.01 + ((x - 45) % 6 === 0 ? -0.08 : 0), x, y));
  p.rect(52, 39, 7, 2, (x, y) => pick(PAL.wood, y === 39 ? 0.62 : 0.32, x, y));
  p.rect(55, 25, 1, 14, PAL.gold[4]);
  p.rect(56, 25, 1, 14, PAL.gold[2]);
  p.rect(54, 37, 4, 2, (x, y) => PAL.gold[y === 37 ? 4 : 1]);
  for (const [x0, y0] of [[46, 39], [47, 37]]) {
    p.rect(x0, y0, 4, 2, (x, y) => PAL.gold[y === y0 ? (x === x0 ? 5 : 4) : 2]);
    p.set(x0 + 3, y0, PAL.gold[3]);
  }
  p.rect(60, 39, 3, 2, (x, y) => (y === 39 ? QUARTZ[4] : QUARTZ[2])); // caixinha de marfim
  return p;
}

function inSmithHead(x, y) {
  const dy = (y - 30.5) / 12.4;
  const rx = dy > 0 ? 10.6 * (1 - 0.28 * dy * dy) : 10.6;
  return ((x - AX) / rx) ** 2 + dy * dy <= 1;
}

// Olho atrás da lupa (aumentado) e o outro, apertado. closed fecha a pálpebra na lente.
const LOUPE = [38, 30.5], LENS_R = 2.8, LOUPE_R = 4.3;
function goldsmithEye(p, closed) {
  const [lx, ly] = LOUPE;
  for (let y = Math.floor(ly - LENS_R); y <= ly + LENS_R; y++) {
    for (let x = Math.floor(lx - LENS_R); x <= lx + LENS_R; x++) {
      const dx = x + 0.5 - lx, dy = y + 0.5 - ly;
      if (dx * dx + dy * dy > LENS_R * LENS_R) continue;
      let c;
      if (closed) c = Math.abs(dy) < 0.6 ? LASH : PAL.skin[dy < 0 ? 4 : 3];
      else if (dy < -1.6) c = PAL.skin[2]; // pálpebra de cima
      else {
        const ix = dx + 0.3, iy = dy - 0.35;
        const ir = Math.hypot(ix, iy);
        if (ir < 0.75) c = C('#0c0e16');
        else if (ir < 1.9) c = ix + iy > 0.4 ? PAL.irisHi : PAL.iris;
        else c = dy > 1.5 ? C('#c8c2b4') : PAL.eyeWhite;
      }
      p.set(x, y, c);
    }
  }
  if (!closed) {
    p.set(lx - 1.5, ly - 1, C('#ffffff')); // reflexo do vidro
    p.set(lx - 0.5, ly - 1.5, PAL.glassHi);
  }
}

function buildGoldsmith() {
  const p = new Pix(64, 64);
  // camisa de linho
  p.poly([[0, 64], [1, 56], [6, 51], [15, 48], [24, 46.5], [41, 46.5], [50, 48], [59, 51], [64, 56], [65, 64]], (x, y) => {
    const nx = (x + 0.5 - AX) / 31;
    let v = 0.62 - nx * 0.26 - (y - 50) * 0.008 + Math.sin(x * 0.7 + y * 0.25) * 0.06;
    v += clamp01(1 - Math.hypot((x - 10) / 8, (y - 52) / 5)) * 0.16;
    if ((x === 13 || x === 52) && y > 52) v -= 0.2; // dobras
    return pick(PAL.linen, v, x, y);
  });
  // pescoço e o decote da camisa
  p.rect(28, 39, 9, 8, (x, y) => pick(PAL.skin, 0.2 + cylLight((x + 0.5 - AX) / 4.8) * 0.4 - (y < 44 ? 0.1 : 0), x, y, 3));
  p.poly([[28.5, 46], [36.5, 46], [AX, 51.5]], (x, y) => pick(PAL.skin, 0.5 - (x - 30) * 0.04 - (y - 46) * 0.03, x, y, 3));
  // gola da camisa e o cordão do decote
  p.poly([[25, 44.5], [29, 45], [31.6, 50.5], [26.5, 48.5]], (x, y) => pick(PAL.linen, 0.85 - (y - 45) * 0.05, x, y));
  p.poly([[40, 44.5], [36, 45], [33.4, 50.5], [38.5, 48.5]], (x, y) => pick(PAL.linen, 0.6 - (y - 45) * 0.05, x, y));
  for (const [x, y] of [[31, 48], [33, 48], [32, 49], [31, 50], [33, 50]]) p.set(x, y, PAL.leather[x === 32 ? 4 : 2]);
  // avental de couro com alças, rebites e o bolso das ferramentas
  p.poly([[19, 64], [21, 52], [24.5, 50], [40.5, 50], [44, 52], [46, 64]], (x, y) => {
    const nx = (x + 0.5 - AX) / 13;
    let v = 0.52 - nx * 0.3 + (y === 50 ? 0.22 : 0) + (hash(x, y, 101) - 0.5) * 0.12;
    if (hash(x >> 1, y, 102) < 0.04) v -= 0.25; // marcas de uso
    return pick(PAL.leather, v, x, y);
  });
  for (let y = 52; y < 64; y += 2) { p.set(22 + (y - 52) * 0.12, y, PAL.leather[4]); p.set(43 - (y - 52) * 0.12, y, PAL.leather[2]); }
  p.line(25, 50, 27, 43, PAL.leather[3]);
  p.line(24, 50, 26, 43, PAL.leather[2]);
  p.line(40, 50, 38, 43, PAL.leather[2]);
  p.line(41, 50, 39, 43, PAL.leather[1]);
  p.set(25, 51, PAL.gold[5]); p.set(40, 51, PAL.gold[3]);
  p.rect(33, 56, 8, 7, (x, y) => pick(PAL.leather, (y === 56 ? 0.66 : 0.38) - (x - 33) * 0.03 + (hash(x, y, 103) - 0.5) * 0.1, x, y));
  for (let x = 34; x <= 39; x += 2) p.set(x, 57, PAL.leather[4]);
  p.line(35, 55, 35, 52, PAL.iron[4]); p.line(36, 55, 36, 53, PAL.iron[2]); // pinça
  p.rect(38, 52, 2, 4, (x, y) => (y === 52 ? PAL.iron[3] : PAL.wood[x === 38 ? 4 : 2])); // buril

  // cabelo grisalho dos lados
  p.fill(18, 18, 47, 36, (x, y) => ((x - AX) / 12.6) ** 2 + ((y - 28) / 10.5) ** 2 <= 1 && y < 35, (x, y) => {
    let v = 0.25 + sphereLight((x + 0.5 - AX) / 12.6, (y + 0.5 - 26) / 10.5) * 0.75 + (hash(x, y, 104) - 0.5) * 0.24;
    if ((x + y * 2) % 4 === 0) v -= 0.14;
    return pick(GREY, v, x, y, 1.5);
  });
  // orelhas
  p.sphere(21.6, 31.5, 2.1, 3.1, PAL.skin, 0.08);
  p.sphere(43.4, 31.5, 2.1, 3.1, PAL.skin, -0.18);
  p.set(21, 31, PAL.skin[1]); p.set(44, 31, PAL.skin[0]);
  // rosto
  p.fill(21, 18, 44, 43, inSmithHead, (x, y) => {
    let v = 0.38 + sphereLight((x + 0.5 - AX) / 10.6 * 0.8, (y + 0.5 - 30.5) / 12.4 * 0.45 - 0.15) * 0.7;
    if (y < 24) v -= 0.2; // sombra do gorro
    return pick(PAL.skin, v, x, y, 6);
  });
  p.fill(19, 20, 46, 33, (x, y) => inSmithHead(x, y) && Math.abs(x - AX) > 9.2 && y < 31, (x, y) =>
    pick(GREY, 0.4 + sphereLight((x + 0.5 - AX) / 10.6, 0) * 0.45 + (hash(x, y, 105) - 0.5) * 0.24, x, y));

  // rugas da testa
  for (const x of [29, 30, 31, 34, 35]) p.set(x, 24, PAL.skin[3]);
  // olho esquerdo apertado
  for (let x = 25; x <= 29; x++) { p.set(x, 30, LASH); p.set(x, 29, PAL.skin[x === 25 ? 3 : 4]); }
  for (const x of [26, 27, 28]) p.set(x, 31, PAL.skin[3]);
  p.set(24, 30, PAL.skin[3]);
  // sobrancelhas grossas: a de cá franzida, a de lá erguida sobre a lupa
  for (const [x, y, k] of [[24, 28, 3], [25, 27, 4], [26, 27, 5], [27, 27, 4], [28, 28, 4], [29, 28, 3], [30, 29, 2], [25, 28, 1], [26, 28, 2], [27, 28, 2]]) p.set(x, y, GREY[k]);
  for (const [x, y, k] of [[34, 25, 3], [35, 24, 4], [36, 24, 4], [37, 23, 5], [38, 23, 4], [39, 23, 4], [40, 24, 3], [41, 24, 2], [42, 25, 2], [36, 25, 1], [37, 24, 2], [38, 24, 2], [39, 24, 1]]) p.set(x, y, GREY[k]);
  // nariz redondo e corado
  for (const [x, y, k] of [[32, 30, 5], [33, 30, 3], [32, 31, 5], [33, 31, 3], [32, 32, 5], [33, 32, 3], [31, 33, 5], [32, 33, 5], [33, 33, 4], [34, 33, 3],
    [30, 34, 4], [31, 34, 4], [32, 34, 4], [33, 34, 3], [34, 34, 2], [30, 35, 2], [31, 35, 1], [32, 35, 3], [33, 35, 1], [34, 35, 2]]) p.set(x, y, PAL.skin[k]);
  p.set(33, 34, PAL.blush);
  p.set(32, 34, C('#e89a7c'));
  // bochechas coradas
  for (const [x, y] of [[24, 35], [25, 35]]) { p.set(x, y, PAL.blush); p.set(64 - x, y + 1, PAL.blush); }
  // bigode grisalho caído e a boca concentrada
  const stache = [[27, 37], [28, 36], [29, 36], [30, 36], [31, 36], [32, 37], [26, 38], [27, 38], [28, 37], [29, 37], [30, 37], [31, 37], [25, 39], [26, 39], [27, 39], [28, 38], [29, 38], [30, 38]];
  for (const [x, y] of stache) {
    p.set(x, y, GREY[y === 36 ? 5 : x < 27 ? 3 : 4]);
    p.set(64 - x, y, GREY[y === 36 ? 3 : x < 27 ? 1 : 2]);
  }
  p.set(32, 36, GREY[4]); p.set(32, 38, GREY[2]);
  for (let x = 31; x <= 33; x++) p.set(x, 40, PAL.lip);
  p.set(31, 40, C('#c06850'));
  p.set(32, 42, PAL.skin[2]);

  // lupa de joalheiro presa no olho: aro de latão em volta da lente
  const [lx, ly] = LOUPE;
  p.fill(lx - 5, ly - 5, lx + 5, ly + 5, (x, y) => Math.hypot(x - lx, y - ly) <= LOUPE_R + 0.9, () => PAL.out);
  p.fill(lx - 5, ly - 5, lx + 5, ly + 5, (x, y) => Math.hypot(x - lx, y - ly) <= LOUPE_R, (x, y) => {
    const dx = x + 0.5 - lx, dy = y + 0.5 - ly;
    const d = Math.hypot(dx, dy) || 1;
    const facing = -(dx * 0.6 + dy * 0.8) / d;
    if (d > 3.3) return pick(PAL.gold, 0.5 + facing * 0.42, x, y);
    return pick(PAL.gold, 0.32 - facing * 0.3, x, y); // borda de dentro do tubo
  });
  goldsmithEye(p, false);

  // gorro de pano caído para o lado
  const band = (x) => 21.4 + 1.4 * (1 - ((x + 0.5 - AX) / 12) ** 2);
  p.fill(15, 7, 48, 22, (x, y) => ((x - 30.5) / 14.6) ** 2 + ((y - 15.5) / 7) ** 2 <= 1 && y < band(x) - 0.5, (x, y) => {
    const nx = (x + 0.5 - 30.5) / 14.6, ny = (y + 0.5 - 13.5) / 7;
    const ang = Math.atan2(y + 0.5 - 11, x + 0.5 - 30);
    let v = 0.08 + sphereLight(nx, ny) * 0.9 + Math.sin(ang * 6 + 0.4) * 0.08;
    if (y > 18) v -= (y - 18) * 0.08;
    return pick(CAP, v, x, y, 1.6);
  });
  for (let x = 20; x <= 45; x++) {
    const c = Math.round(band(x));
    const lit = cylLight((x + 0.5 - AX) / 13);
    p.set(x, c - 1, pick(CAP, 0.2 + lit * 0.55, x, c - 1));
    p.set(x, c, pick(CAP, 0.05 + lit * 0.4, x, c));
  }
  p.sphere(30.5, 8.5, 1.4, 1.2, CAP, 0.15);
  // broche de ouro no gorro
  p.sphere(41.5, 19.5, 1.7, 1.7, PAL.gold, 0.15);
  p.set(41, 19, EMERALD[3]);
  p.set(42, 20, EMERALD[1]);

  // braço erguido com o anel
  p.fill(0, 50, 14, 63, (x, y) => nearestOnPath([[1, 66], [4.5, 57], [10.5, 47.5]], x, y)[0] <= 3.1, (x, y) => {
    const [, ox, oy] = nearestOnPath([[1, 66], [4.5, 57], [10.5, 47.5]], x + 0.5, y + 0.5);
    return pick(PAL.skin, 0.12 + sphereLight(ox / 3.6, oy / 3.6) * 0.85, x, y);
  });
  // manga arregaçada
  p.fill(0, 55, 10, 63, (x, y) => nearestOnPath([[0, 66], [3, 59.5]], x, y)[0] <= 4.3, (x, y) => {
    const [, ox, oy] = nearestOnPath([[0, 66], [3, 59.5]], x + 0.5, y + 0.5);
    let v = 0.2 + sphereLight(ox / 4.8, oy / 4.8) * 0.85;
    if ((x * 2 + y) % 5 === 0) v -= 0.18;
    return pick(PAL.linen, v, x, y);
  });
  // mão fechada, polegar e indicador pinçando o anel
  p.sphere(12, 46.2, 3.7, 3.2, PAL.skin, 0.14);
  for (const [x, y] of [[13, 47], [14, 46], [12, 48]]) p.set(x, y, PAL.skin[3]);
  paintRing(p);
  tube(p, [[14.4, 44], [15.4, 40.4]], 1.15, PAL.skin, 0.16);
  tube(p, [[9.8, 44.8], [11.2, 40.6]], 1.15, PAL.skin, 0.16);
  p.set(15, 40, PAL.skin[5]);

  p.outline(PAL.out);
  return p;
}

// Anel de ouro com rubi, seguro entre os dedos.
const RING = [13.5, 36.5];
function paintRing(p) {
  const [rx, ry] = RING;
  p.fill(rx - 4, ry - 4, rx + 4, ry + 4, (x, y) => {
    const d = Math.hypot(x - rx, y - ry);
    return d <= 3.4 && d >= 1.8;
  }, (x, y) => {
    const dx = x + 0.5 - rx, dy = y + 0.5 - ry;
    const d = Math.hypot(dx, dy) || 1;
    const across = (d - 2.6) / 0.8; // -1 dentro, +1 fora
    const facing = -(dx * 0.55 + dy * 0.75) / d;
    return pick(PAL.gold, 0.5 + across * facing * 0.5, x, y);
  });
  // engaste e a pedra lapidada
  p.rect(12, 33, 4, 1, (x) => PAL.gold[x === 12 ? 5 : x === 15 ? 2 : 4]);
  const gem = ['.ab.', 'bccd', 'bcdd', '.dd.'];
  const k = { a: 4, b: 3, c: 2, d: 1 };
  gem.forEach((row, j) => [...row].forEach((ch, i) => { if (k[ch] !== undefined) p.set(12 + i, 29 + j, RUBY[k[ch]]); }));
  p.set(12, 30, RUBY[4]);
  p.set(11, 32, PAL.gold[4]);
  p.set(16, 32, PAL.gold[2]);
}

// Balança de pratos: o travessão inclina com o ângulo a.
function paintScale(f, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const string = SHOP[6];
  for (const side of [-1, 1]) {
    const ex = SCALE_X + side * 7 * c, ey = SCALE_Y + side * 7 * s;
    const px = Math.floor(ex), py = Math.round(ey + 9);
    f.line(px, Math.round(ey) + 1, px - 3, py - 1, string);
    f.line(px, Math.round(ey) + 1, px + 3, py - 1, string);
    for (let x = px - 3; x <= px + 3; x++) f.set(x, py, PAL.gold[x < px ? 4 : 3]);
    for (let x = px - 2; x <= px + 2; x++) f.set(x, py + 1, PAL.gold[x < px ? 2 : 1]);
    for (let x = px - 1; x <= px + 1; x++) f.set(x, py + 2, PAL.out);
    if (side < 0) { f.set(px - 1, py - 1, PAL.gold[5]); f.set(px, py - 1, PAL.gold[4]); f.set(px + 1, py - 1, PAL.gold[3]); }
  }
  for (let k = -7; k <= 7; k++) {
    const x = SCALE_X - 0.5 + k * c, y = SCALE_Y + k * s;
    f.set(x, y, PAL.gold[k < 0 ? 4 : 3]);
    f.set(x, y + 1, PAL.out);
  }
  for (let k = 1; k <= 3; k++) f.set(SCALE_X - 0.5 + k * s, SCALE_Y - k * c, PAL.gold[k === 3 ? 5 : 4]);
  f.set(SCALE_X - 0.5, SCALE_Y, PAL.gold[5]);
}

const goldsmithArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintGoldsmithPortrait(ctx, t, info) {
  const a = goldsmithArt;
  if (!a.bg) {
    a.bg = buildGoldsmithBackdrop();
    a.body = buildGoldsmith();
    a.shaft = new Uint8Array(64 * 64);
    for (let i = 0; i < 64 * 64; i++) a.shaft[i] = inWindow((i & 63) + 0.5, (i >> 6) + 0.5, 1.6) ? 0 : windowShaft(i & 63, i >> 6);
    // pixels do aro do anel, com o ângulo de cada um
    a.band = [];
    const [rx, ry] = RING;
    for (let y = 32; y < 41; y++) {
      for (let x = 9; x < 18; x++) {
        const c = a.body.get(x, y);
        if (PAL.gold.includes(c) && y > 33) a.band.push([x, y, Math.atan2(y + 0.5 - ry, x + 0.5 - rx)]);
      }
    }
  }
  const live = info.working ? 1 : 0.5;
  const f = a.frame.copyFrom(a.bg);
  // poeira dourada flutuando nos raios da janela
  for (let k = 0; k < 6 + live * 10; k++) {
    const x = Math.floor((hash(k, 1, 106) * 40 + Math.sin(t * 0.4 + k) * 2 + t * 0.6 * live) % 40);
    const y = Math.floor(10 + ((hash(k, 2, 106) * 40 + t * (0.6 + hash(k, 3, 106) * 0.8) * live) % 40));
    if (a.shaft[y * 64 + x] && Math.sin(t * 1.9 + k * 2.1) > -0.3) f.d[y * 64 + x] = SHOP[7];
  }
  // balança oscilando
  paintScale(f, Math.sin(t * 0.9) * 0.09 + Math.sin(t * 2.3 + 1) * 0.04 * live);
  f.blit(a.body, 0, 0);
  // piscar o olho da lupa
  if (t % 4.9 > 4.74 || t % 11.3 > 11.14) goldsmithEye(f, true);
  // brilho correndo pelo aro do anel e faísca no rubi
  const th = ((t * (0.9 + live * 0.8)) % (Math.PI * 2)) - Math.PI;
  for (const [x, y, ang] of a.band) {
    let dd = Math.abs(ang - th);
    if (dd > Math.PI) dd = Math.PI * 2 - dd;
    if (dd < 0.35) f.set(x, y, PAL.gold[5]);
  }
  paintGlint(f, 13, 30, pulse(t, info.working ? 2.2 : 3.9, 0.6));
  paintGlint(f, 36, 29, pulse(t + 1.3, 6.4, 0.4) * 0.5);
  paintGlint(f, 41, 19, pulse(t + 3.1, 5.7, 0.45) * 0.6);
  f.draw(ctx);
}

function iconGoldsmith() {
  const p = new Pix(16, 16);
  p.fill(1, 4, 15, 16, (x, y) => {
    const d = Math.hypot(x - 8, y - 10);
    return d <= 5.4 && d >= 3;
  }, (x, y) => {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 10;
    const d = Math.hypot(dx, dy) || 1;
    const across = (d - 4.2) / 1.2;
    return pick(PAL.gold, 0.52 + across * (-(dx * 0.55 + dy * 0.75) / d) * 0.55, x, y);
  });
  p.rect(5, 4, 6, 1, (x) => PAL.gold[x < 7 ? 5 : 3]);
  const gem = ['.aab.', 'abbcc', 'bccdd', '.cdd.', '..d..'];
  const k = { a: 4, b: 3, c: 2, d: 1 };
  gem.forEach((row, j) => [...row].forEach((ch, i) => { if (k[ch] !== undefined) p.set(5.5 + i, j, RUBY[k[ch]]); }));
  p.set(6, 1, C('#ffffff'));
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Casa da moeda

const VAULT = ramp('#110c0f', '#1c1416', '#2a1e1d', '#3a2a25', '#4d382d', '#634834', '#7d5c3e', '#9a744a', '#b88e5a');
const MINT_TORCHES = [[7.5, 22], [57.5, 22]];
const RAM_UP = 33; // topo do martelo em cima; desce 5 pixels até bater

function buildMintBackdrop(glow) {
  const p = new Pix(64, 64);
  const reach = 30 + glow * 8, power = 0.42 + glow * 0.2;
  const light = (x, y) => {
    let v = 0;
    for (const [tx, ty] of MINT_TORCHES) v += power * clamp01(1 - Math.hypot((x + 0.5 - tx) * 0.85, y + 0.5 - ty) / reach) ** 1.5;
    return v;
  };
  const FLOOR = 53;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v;
      if (y < FLOOR) {
        const e = y < 46 ? Math.hypot((x + 0.5 - AX) / 34, (y + 0.5 - 46) / 40) : 0;
        v = 0.1 + light(x, y) + (hash(x, y, 111) - 0.5) * 0.05;
        if (e > 1.085) v += -0.16 + masonry(x, y, 7, 3, 112) * 0.5; // abóbada fora do arco
        else if (e > 1) {
          // aduelas do arco
          const ang = Math.atan2((y + 0.5 - 46) / 40, (x + 0.5 - AX) / 34);
          const seg = Math.floor(ang * 8);
          v += 0.08 + (e > 1.07 ? -0.18 : e < 1.025 ? 0.14 : 0) + (ang * 8 - seg < 0.14 ? -0.22 : (hash(seg, 0, 113) - 0.5) * 0.12);
        } else v += masonry(x, y, 10, 5, 114) * 0.9;
      } else {
        // lajes do chão em perspectiva
        const s = y - 30;
        const u = (x + 0.5 - AX) / s * 5, u1 = (x + 1.5 - AX) / s * 5;
        const row = Math.floor(70 / s), rowNext = Math.floor(70 / (s + 1));
        v = 0.2 + light(x, y) * 0.8 - (y - FLOOR) * 0.008 + (hash(Math.floor(u), row, 115) - 0.5) * 0.12;
        if (Math.floor(u) !== Math.floor(u1) || row !== rowNext) v -= 0.16;
        if (y === FLOOR) v -= 0.2;
      }
      p.d[y * 64 + x] = pick(VAULT, v, x, y, 2);
    }
  }
  // suportes de ferro das tochas
  for (const [tx, ty] of MINT_TORCHES) {
    const x = Math.floor(tx);
    p.rect(x - 1, ty + 4, 3, 1, PAL.iron[1]);
    p.rect(x, ty + 5, 1, 4, (xx, y) => PAL.iron[y === ty + 5 ? 3 : 2]);
    p.line(x - 1, ty, x - 1, ty + 3, PAL.wood[3]);
    p.line(x, ty, x, ty + 3, PAL.wood[2]);
    p.line(x + 1, ty, x + 1, ty + 3, PAL.wood[1]);
    p.rect(x - 1, ty - 1, 3, 1, VAULT[0]);
  }
  return p;
}

// Pilha de moedas com a base em (cx, base): anéis de ouro empilhados e a face de cima.
function coinStack(p, c, base, n, seed) {
  for (let j = 0; j < n; j++) {
    const y = base - j;
    const tone = (hash(j, seed, 116) - 0.5) * 0.12 + (j & 1 ? -0.16 : 0.06);
    for (let x = c - 2; x <= c + 2; x++) p.set(x, y, pick(PAL.gold, 0.06 + cylLight((x - c) / 2.5) * 0.8 + tone, x, y, 3));
  }
  const top = base - n;
  for (let x = c - 1; x <= c + 1; x++) p.set(x, top, PAL.gold[x < c ? 5 : 4]);
  for (let x = c - 2; x <= c + 2; x++) p.set(x, top + 1, PAL.gold[x < c ? 4 : x === c ? 3 : 2]);
  p.set(c, top + 1, PAL.gold[2]); // marca cunhada na moeda de cima
}

function buildMint() {
  const p = new Pix(64, 64);
  // pedestal de pedra
  p.rect(17, 50, 31, 7, (x, y) => {
    let v = (y <= 51 ? 0.78 : 0.42) - (x - 17) * 0.008 + masonry(x, y, 8, 3, 117, 52) * (y > 51 ? 0.7 : 0);
    if (x === 17) v += 0.12;
    else if (x === 47) v -= 0.2;
    return pick(PAL.stone, v, x, y);
  });
  // bigorna com o cunho de baixo
  p.rect(28, 45, 9, 5, (x, y) => pick(PAL.iron, 0.15 + cylLight((x + 0.5 - AX) / 4.5) * 0.7 + (y === 45 ? 0.15 : 0), x, y));
  p.rect(30, 44, 5, 1, (x) => PAL.steel[x < 32 ? 5 : 4]);
  // colunas de bronze
  for (const cx of [24, 41]) {
    const metal = (n) => { const l = cylLight(n); return 0.02 + l * 0.62 + l ** 8 * 0.32; };
    p.rect(cx - 2, 28, 5, 21, (x, y) => pick(BRONZE, metal((x + 0.5 - cx - 0.5) / 2.6) + (y > 42 ? -(y - 42) * 0.02 : 0), x, y, 4));
    for (const y0 of [27, 46]) p.rect(cx - 3, y0, 7, 2, (x, y) => pick(BRONZE, metal((x + 0.5 - cx - 0.5) / 3.6) + (y === y0 ? 0.14 : -0.12), x, y, 4));
    p.rect(cx - 3, 48, 7, 1, (x) => BRONZE[x < cx ? 3 : 1]);
  }
  // coroa em arco, com o mancal da rosca em cima
  p.fill(20, 16, 45, 27, (x, y) => ((x - AX) / 12.6) ** 2 + ((y - 27.5) / 10.5) ** 2 <= 1, (x, y) => {
    const nx = (x + 0.5 - AX) / 12.6, ny = (y + 0.5 - 27.5) / 10.5;
    const d = Math.sqrt(nx * nx + ny * ny);
    const l = sphereLight(nx * 0.9, ny * 0.9 - 0.1);
    let v = 0.02 + l * 0.64 + l ** 8 * 0.3;
    if (d > 0.8 && d < 0.88) v = d < 0.84 ? v - 0.3 : v + 0.12; // friso
    if (y === 26) v -= 0.2;
    return pick(BRONZE, v, x, y, 4);
  });
  p.rect(28, 13, 9, 5, (x, y) => pick(BRONZE, 0.04 + cylLight((x + 0.5 - AX) / 4.5) * 0.76 + (y === 13 ? 0.2 : y === 17 ? -0.2 : 0), x, y));
  // medalhão com a estrela no meio da coroa
  p.sphere(AX, 22, 2.8, 2.8, PAL.gold, 0.12);
  for (const [x, y] of [[32, 20], [31, 21], [33, 21], [32, 22], [31, 23], [33, 23]]) p.set(x, y, PAL.gold[2]);
  p.set(32, 21, PAL.gold[5]);

  // baú fechado com pilhas de moedas em cima
  p.rect(1, 51, 19, 11, (x, y) => {
    let v = 0.42 - (x - 1) * 0.012 + (hash(x >> 2, y >> 1, 118) - 0.5) * 0.1;
    if ((y - 51) % 3 === 2) v -= 0.16;
    return pick(PAL.wood, v, x, y);
  });
  p.rect(1, 49, 19, 2, (x, y) => pick(PAL.wood, y === 49 ? 0.82 : 0.6, x, y));
  for (const bx of [3, 17]) p.rect(bx, 49, 2, 13, (x, y) => PAL.iron[y === 49 ? 4 : x === bx ? 3 : 1]);
  p.rect(1, 58, 19, 1, (x) => PAL.iron[x < 8 ? 3 : 2]);
  p.rect(8, 52, 5, 5, (x, y) => PAL.gold[x === 8 || y === 52 ? 4 : 2]);
  p.rect(10, 54, 1, 2, PAL.out);
  coinStack(p, 4, 48, 9, 1);
  coinStack(p, 10, 48, 13, 2);
  coinStack(p, 16, 48, 6, 3);
  // moedas soltas no chão
  for (const [x, y] of [[22, 61], [25, 62], [41, 62], [20, 63]]) {
    p.rect(x, y, 3, 1, (xx) => PAL.gold[xx === x ? 5 : 3]);
  }

  // cofre aberto transbordando de ouro e gemas
  p.poly([[46, 49], [62, 49], [61, 39], [47, 39]], (x, y) => {
    let v = 0.22 + (y - 39) * 0.012 + (hash(x >> 1, y >> 2, 119) - 0.5) * 0.08;
    if ((y - 39) % 4 === 3) v -= 0.12;
    return pick(PAL.wood, v, x, y);
  });
  for (const x of [48, 59]) p.rect(x, 39, 2, 10, (xx) => PAL.iron[xx === x ? 2 : 1]);
  p.rect(47, 39, 14, 1, PAL.iron[2]);
  p.rect(45, 50, 18, 12, (x, y) => {
    let v = 0.46 - (x - 45) * 0.014 + (hash(x >> 2, y >> 1, 120) - 0.5) * 0.1;
    if ((y - 50) % 3 === 2) v -= 0.16;
    return pick(PAL.wood, v, x, y);
  });
  for (const bx of [46, 60]) p.rect(bx, 50, 2, 12, (x) => PAL.iron[x === bx ? 3 : 1]);
  p.rect(45, 50, 18, 1, (x) => PAL.iron[x < 52 ? 4 : 3]);
  p.rect(52, 53, 4, 4, (x, y) => PAL.gold[x === 52 || y === 53 ? 4 : 2]);
  p.rect(53, 55, 2, 1, PAL.out);
  p.fill(45, 43, 63, 50, (x, y) => ((x - 54) / 8.6) ** 2 + ((y - 50.5) / 6.4) ** 2 <= 1 && y < 50.5, (x, y) => {
    let v = 0.25 + sphereLight((x + 0.5 - 54) / 8.6, (y + 0.5 - 49) / 6.4) * 0.75;
    const coin = (x + (y & 1) * 2) % 4;
    if (coin === 0) v -= 0.2;
    else if (coin === 1 && y % 2 === 0) v += 0.15;
    return pick(PAL.gold, v, x, y, 1.6);
  });
  for (const [x, y, r] of [[50, 46, RUBY], [57, 45, SAPPHIRE], [54, 48, EMERALD], [59, 48, RUBY]]) {
    p.set(x, y, r[3]); p.set(x + 1, y, r[2]); p.set(x, y + 1, r[1]); p.set(x + 1, y + 1, r[1]);
  }
  p.outline(PAL.out);
  return p;
}

// Pose do balancim no tempo t: ângulo da barra (phi) e quanto a rosca desceu (0..1).
function mintPose(t, working) {
  if (!working) return { phi: -1.05 + Math.sin(t * 0.7) * 0.14, k: 0, u: -1 };
  const u = (t / 1.6) % 1;
  let k;
  if (u < 0.5) { const s = u / 0.5; k = 1 - s * s * (3 - 2 * s); } // volta devagar
  else if (u < 0.72) k = ((u - 0.5) / 0.22) ** 2; // desce acelerando
  else k = 1 - Math.sin(clamp01((u - 0.72) / 0.12) * Math.PI) * 0.08; // bate e repica
  return { phi: -1.15 + k * 2.3, k, u };
}

// Rosca, cubo, barra com os pesos e o martelo com o cunho de cima.
function paintPress(f, phi, k) {
  const drop = Math.round(k * 5);
  const ramY = RAM_UP + drop;
  const ph = phi * 4.5;
  const thread = (x, y) => {
    const band = ((y + (x - 31) * 0.5 - ph) % 3 + 3) % 3;
    const v = 0.2 + cylLight((x + 0.5 - AX) / 1.8) * 0.75 + (band < 1 ? -0.3 : band < 2 ? 0.1 : 0);
    return pick(PAL.iron, v, x, y);
  };
  // rosca acima da coroa e abaixo dela, até o martelo
  for (let y = 3 + drop; y <= 12; y++) {
    f.set(30, y, PAL.out); f.set(34, y, PAL.out);
    for (let x = 31; x <= 33; x++) f.set(x, y, thread(x, y));
  }
  for (let y = 27; y < ramY; y++) {
    f.set(30, y, PAL.out); f.set(34, y, PAL.out);
    for (let x = 31; x <= 33; x++) f.set(x, y, thread(x, y));
  }
  // martelo
  f.rect(28, ramY - 1, 9, 5, PAL.out);
  f.rect(29, ramY + 3, 7, 3, PAL.out);
  f.rect(29, ramY, 7, 3, (x, y) => pick(PAL.iron, 0.15 + cylLight((x + 0.5 - AX) / 3.5) * 0.8 + (y === ramY ? 0.2 : 0), x, y));
  f.rect(30, ramY + 3, 5, 2, (x, y) => pick(PAL.steel, 0.3 + cylLight((x + 0.5 - AX) / 2.5) * 0.7, x, y));

  // barra girando em volta da rosca: as pontas descrevem uma elipse
  const yb = 8.5 + drop;
  const L = 23;
  const ends = [1, -1].map((sg) => ({
    x: AX + sg * L * Math.cos(phi),
    y: yb + sg * 2.4 * Math.sin(phi),
    z: sg * Math.sin(phi),
  })).sort((a, b) => a.z - b.z);
  // o braço sai da lateral do cubo; virado para a frente, cobre o cubo
  const skip = 3.5 * Math.abs(Math.cos(phi));
  const arm = (e) => {
    const n = Math.ceil(Math.abs(e.x - AX)) + 1;
    const i0 = Math.min(n, Math.ceil(skip / Math.max(0.01, Math.abs(e.x - AX)) * n));
    for (let i = i0; i <= n; i++) {
      const x = AX + (e.x - AX) * i / n, y = yb + (e.y - yb) * i / n;
      f.set(x - 0.5, y - 1.5, PAL.out);
      f.set(x - 0.5, y + 1.5, PAL.out);
    }
    for (let i = i0; i <= n; i++) {
      const x = AX + (e.x - AX) * i / n, y = yb + (e.y - yb) * i / n;
      f.set(x - 0.5, y - 0.5, PAL.iron[e.z > 0 ? 4 : 3]);
      f.set(x - 0.5, y + 0.5, PAL.iron[e.z > 0 ? 2 : 1]);
    }
    const r = 3.3 + e.z * 0.5;
    f.ellipse(e.x, e.y, r + 1, r + 1, PAL.out);
    f.sphere(e.x, e.y, r, r, PAL.iron, e.z * 0.1);
  };
  arm(ends[0]);
  // cubo da barra
  f.rect(28, yb - 2.5, 9, 6, PAL.out);
  f.rect(29, yb - 1.5, 7, 4, (x, y) => pick(BRONZE, 0.15 + cylLight((x + 0.5 - AX) / 3.5) * 0.8 + (y === Math.floor(yb - 1.5) ? 0.2 : 0), x, y));
  arm(ends[1]);
}

const mintArt = { bg: null, body: null, frame: new Pix(64, 64), halo: null };

function paintMintPortrait(ctx, t, info) {
  const a = mintArt;
  if (!a.bg) {
    a.bg = buildMintBackdrop(0);
    a.halo = makeHalo(a.bg, buildMintBackdrop(1), (x, y) => {
      let d = Infinity;
      for (const [tx, ty] of MINT_TORCHES) d = Math.min(d, Math.hypot((x + 0.5 - tx) * 0.85, y + 0.5 - ty));
      return d / 38;
    });
    a.body = buildMint();
  }
  const working = info.working;
  const live = working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 14.7 + 1) * 0.3 + Math.sin(t * 3.3) * 0.2;
  paintHalo(f, a.halo, 0.42 + live * 0.1 + flick * 0.07);
  MINT_TORCHES.forEach(([tx, ty], i) => paintFlame(f, tx - 0.5, ty - 1, t + i * 1.7, 5 + live * 1.5, 1.9, live));
  f.blit(a.body, 0, 0);

  const { phi, k, u } = mintPose(t, working);
  // disco de metal esperando a batida
  if (u < 0 || (u > 0.15 && u < 0.78)) {
    f.rect(30, 43, 5, 1, PAL.gold[3]);
    f.set(30, 43, PAL.gold[4]);
  }
  paintPress(f, phi, k);
  if (working) {
    // clarão e faíscas da batida
    const hit = (u - 0.72) / 0.1;
    if (hit >= 0 && hit < 1) paintGlint(f, 32, 43, 1 - hit);
    const e = (u - 0.72) / 0.28;
    if (e >= 0 && e < 1) {
      for (let s = 0; s < 6; s++) {
        const ang = Math.PI * (0.15 + 0.7 * hash(s, 1, 121)) * (s & 1 ? 1 : -1) + (s & 1 ? 0 : Math.PI);
        const sp = 7 + hash(s, 2, 121) * 6;
        f.set(32 + Math.cos(ang) * sp * e, 43 - Math.abs(Math.sin(ang)) * sp * e + e * e * 6, PAL.fire[e < 0.4 ? 5 : 4]);
      }
    }
    // moeda pronta pulando para o cofre
    const c = (((u - 0.76) % 1) + 1) % 1 / 0.3;
    if (c < 1) {
      const x = 33 + c * 20, y = 42 - Math.sin(c * Math.PI) * 15 + c * 3;
      const wide = Math.abs(Math.cos(c * 14)) > 0.45;
      f.rect(x - (wide ? 2 : 1), y - 1, wide ? 5 : 3, 4, PAL.out);
      f.rect(x - (wide ? 1 : 0), y, wide ? 3 : 1, 2, (xx, yy) => PAL.gold[yy === Math.floor(y) ? 5 : 3]);
    }
  }
  // brilhos nas pilhas e no cofre
  paintGlint(f, 10, 35, pulse(t, working ? 2.3 : 4.1, 0.5));
  paintGlint(f, 52, 45, pulse(t + 0.9, working ? 1.9 : 3.6, 0.45));
  paintGlint(f, 5, 39, pulse(t + 1.7, 3.3, 0.4) * 0.6);
  paintGlint(f, 58, 47, pulse(t + 2.6, 4.4, 0.4) * 0.7);
  f.draw(ctx);
}

function iconMint() {
  const p = new Pix(16, 16);
  // pedestal, colunas e coroa
  p.rect(2, 13, 12, 3, (x, y) => pick(PAL.stone, (y === 13 ? 0.8 : 0.45) - x * 0.01, x, y));
  for (const cx of [4, 11]) p.rect(cx - 1, 7, 2, 6, (x) => BRONZE[x === cx - 1 ? 5 : 3]);
  p.fill(2, 5, 14, 8, (x, y) => ((x - 8) / 5.8) ** 2 + ((y - 8.5) / 3.4) ** 2 <= 1, (x, y) => BRONZE[y < 6 ? 6 : x < 8 ? 5 : 4]);
  // rosca e barra com os pesos
  p.rect(7, 2, 2, 4, (x, y) => PAL.iron[(x + y) % 2 ? 4 : 2]);
  p.rect(3, 2, 10, 2, (x, y) => PAL.iron[y === 2 ? (x < 8 ? 4 : 3) : 1]);
  p.rect(7, 1, 2, 3, (x) => BRONZE[x === 7 ? 6 : 4]);
  p.sphere(2.5, 2.5, 1.7, 1.7, PAL.iron, 0.15);
  p.sphere(13.5, 2.5, 1.7, 1.7, PAL.iron, 0.15);
  // martelo e a moeda reluzindo
  p.rect(7, 8, 2, 2, (x) => PAL.steel[x === 7 ? 4 : 3]);
  p.rect(6, 11, 4, 2, (x, y) => PAL.gold[y === 11 ? (x < 8 ? 5 : 4) : 2]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Guilda

const TWILIGHT = ramp('#121634', '#1a2048', '#262c5a', '#36386a', '#4c4476', '#6a5080', '#8e5c80', '#b66c7a', '#da8a70', '#f0b07a');
const PEAKS = ramp('#1a1c38', '#262a4a', '#343a5c', '#4a4e70', '#666684', '#8c88a0', '#bcb2c0');
const PLASTER = ramp('#4a3a3a', '#6e5850', '#94786a', '#b49a84', '#cebaa0', '#e6d6bc');
const BEAM = ramp('#140b08', '#24140e', '#382016', '#4e2e1c', '#6a4026');
const SLATE = ramp('#14141e', '#1e1f2c', '#2c2e3e', '#3e4254', '#545a6c', '#6e7486');
const ROYAL = ramp('#1e0c2e', '#341650', '#4e2276', '#6c349a', '#9058c0', '#b884e0');
const GLOW = ramp('#3a1a0c', '#7a3812', '#c0661c', '#ec9a34', '#ffc860', '#ffe9a6');
const LIT_COBBLE = ramp('#2a1a18', '#4a2c20', '#6e4428', '#966232', '#bc8642', '#dcaa5a');
const WIN_DARK = C('#1a0e0a');

function buildGuildBackdrop() {
  const p = new Pix(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const v = 0.02 + (y / 44) * 0.9 + (x / 64) * 0.06;
      p.d[y * 64 + x] = pick(TWILIGHT, v, x, y, 1.4);
    }
  }
  // estrelas fixas mais fracas
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, 1, 131) * 64), y = Math.floor(hash(i, 2, 131) * 20);
    p.set(x, y, TWILIGHT[i % 3 ? 4 : 6]);
  }
  // montanhas com neve, pegando o resto da luz
  for (let x = 0; x < 64; x++) {
    const top = Math.round(30 + 7 * Math.abs(Math.sin(x * 0.085 + 0.4)) + 3 * Math.sin(x * 0.31 + 1) - (x > 40 ? (x - 40) * 0.1 : 0));
    const slope = Math.sign(Math.cos(x * 0.085 + 0.4) * Math.sin(x * 0.085 + 0.4) + 0.31 * 3 / 7 * Math.cos(x * 0.31 + 1) / 3);
    for (let y = top; y < 64; y++) {
      const k = y - top;
      let v = 0.45 - k * 0.035 + (slope < 0 ? 0.12 : -0.08) + (hash(x, y, 132) - 0.5) * 0.1;
      if (k < 3 && top < 34) v = 0.95 - k * 0.15 + (slope < 0 ? 0.05 : -0.25); // neve
      p.set(x, y, pick(PEAKS, v, x, y));
    }
  }
  // encosta escura com a torre de um poço lá em cima
  for (let x = 0; x < 64; x++) {
    const top = Math.round(41 + 3 * Math.sin(x * 0.12 + 2.2) + hash(x, 0, 133) * 1.2);
    for (let y = top; y < 64; y++) p.set(x, y, pick(PEAKS, 0.2 - (y - top) * 0.02 + (hash(x, y, 134) - 0.5) * 0.12, x, y));
  }
  // casas vizinhas nos cantos
  const house = (x0, x1, eave, apex, win) => {
    const mid = (x0 + x1) / 2;
    p.fill(x0, apex, x1, 63, (x, y) => y >= eave - (1 - Math.abs(x - mid) / ((x1 - x0) / 2)) * (eave - apex), (x, y) => {
      const roof = y < eave + 1 - (1 - Math.abs(x + 0.5 - mid) / ((x1 - x0) / 2)) * (eave - apex) + 3;
      if (roof) return pick(SLATE, 0.3 + ((y + (x & 1)) % 2 ? 0 : -0.1) + (x < mid ? 0.08 : -0.06), x, y);
      return pick(PLASTER, 0.12 + ((x - x0) % 5 === 0 ? -0.15 : 0) + (x < mid ? 0.05 : 0), x, y);
    });
    for (const [wx, wy] of win) p.rect(wx, wy, 2, 3, WIN_DARK);
  };
  house(-6, 11, 42, 30, [[2, 47], [6, 47], [4, 54]]);
  house(53, 70, 40, 27, [[56, 45], [60, 45], [58, 52]]);
  // rua de pedras
  for (let y = 58; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const row = y - 58, off = (row & 1) * 2;
      const edge = (x + off) % 4 === 0;
      const v = 0.36 + row * 0.03 - (edge ? 0.22 : 0) + (hash((x + off) >> 2, y, 135) - 0.5) * 0.16;
      const warm = clamp01(1 - Math.hypot((x + 0.5 - AX) / 15, (y - 57) / 6));
      p.set(x, y, warm > bayer(x, y) * 0.8 + 0.1 ? pick(LIT_COBBLE, v + warm * 0.35, x, y) : pick(PAL.cobble, v, x, y));
    }
  }
  return p;
}

function buildGuild() {
  const p = new Pix(64, 64);
  const plaster = (x, y, v) => pick(PLASTER, v + (hash(x, y, 136) - 0.5) * 0.08, x, y);
  const beam = (x, y) => pick(BEAM, 0.5 + (x < AX ? 0.1 : -0.06) + (hash(x, y >> 1, 138) - 0.5) * 0.14, x, y);
  const lit = (x0, y0, w, h) => {
    p.rect(x0, y0, w, h, WIN_DARK);
    p.rect(x0 - 1, y0 + h, w + 2, 1, beam);
  };

  // térreo de pedra
  p.rect(13, 45, 39, 14, (x, y) => {
    let v = 0.5 + masonry(x, y, 6, 3, 137, 45) - (x - 13) * 0.008;
    if (x === 13) v += 0.15;
    else if (x === 51) v -= 0.22;
    return pick(PAL.stone, v, x, y);
  });
  // porta em arco: aduelas de pedra, folha aberta e o salão aceso lá dentro
  p.fill(25, 44, 40, 58, (x, y) => y >= 51 || Math.hypot(x - AX, y - 51) <= 6.8, (x, y) => {
    const ang = Math.atan2(y + 0.5 - 51, x + 0.5 - AX);
    const joint = y < 51 ? Math.abs(Math.sin(ang * 4.5)) < 0.22 : (y - 45) % 3 === 2;
    return pick(PAL.stone, 0.8 - (x - 26) * 0.028 - (joint ? 0.28 : 0), x, y);
  });
  p.fill(28, 46, 37, 58, (x, y) => y >= 51 || Math.hypot(x - AX, y - 51) <= 4.7, (x, y) =>
    pick(GLOW, 0.8 - Math.abs(x + 0.5 - 34) * 0.07 - Math.max(0, 52 - y) * 0.04 + (y > 55 ? 0.08 : 0), x, y, 1.6));
  p.poly([[28, 58.6], [28, 47.6], [30.6, 49.4], [30.6, 58.6]], (x, y) => pick(PAL.wood, 0.36 + (x === 28 ? 0.2 : 0) + ((y - 48) % 4 === 0 ? -0.15 : 0), x, y));
  for (const y of [50, 55]) p.set(29, y, PAL.iron[3]);
  p.rect(27, 58, 11, 1, PAL.stone[1]);
  // janelas do térreo com lintel e peitoril de pedra
  for (const wx of [15, 45]) {
    p.rect(wx - 1, 47, 7, 1, (x) => PAL.stone[x < wx + 2 ? 5 : 3]);
    p.rect(wx, 48, 5, 5, WIN_DARK);
    p.rect(wx - 1, 53, 7, 1, (x) => PAL.stone[x < wx + 2 ? 5 : 4]);
    p.rect(wx + 2, 48, 1, 5, BEAM[1]);
    p.rect(wx, 50, 5, 1, BEAM[1]);
  }
  // viga do balanço sobre o térreo, com as cabeças dos barrotes
  p.rect(11, 43, 43, 2, (x, y) => pick(BEAM, (y === 43 ? 0.85 : 0.35) - (x - 11) * 0.005, x, y));
  for (let x = 12; x < 53; x += 4) { p.set(x, 45, BEAM[3]); p.set(x + 1, 45, BEAM[1]); }

  // andar de enxaimel: reboco claro entre vigas finas
  p.rect(12, 30, 41, 13, (x, y) => plaster(x, y, 0.72 - (x - 12) * 0.008 - (y - 30) * 0.006));
  p.rect(12, 30, 41, 1, beam);
  p.rect(12, 41, 41, 2, beam);
  for (const x0 of [12, 18, 25, 39, 46, 52]) p.rect(x0, 30, 1, 11, beam);
  for (const [xa, xb] of [[13, 17], [47, 51]]) {
    p.line(xa, 31, xb, 40, beam);
    p.line(xb, 31, xa, 40, beam);
  }
  lit(20, 32, 4, 5);
  lit(27, 32, 11, 5);
  lit(41, 32, 4, 5);
  for (const x of [21, 42, 30, 34]) p.rect(x + (x > 25 && x < 40 ? 0 : 1), 32, 1, 5, BEAM[1]);
  for (const [x0, w] of [[20, 4], [27, 11], [41, 4]]) p.rect(x0, 34, w, 1, BEAM[1]);
  // floreiras com gerânios
  for (const [x0, w] of [[19, 6], [26, 13], [40, 6]]) {
    p.rect(x0, 38, w, 1, (x) => PAL.wood[x === x0 ? 4 : 2]);
    for (let x = x0; x < x0 + w; x++) {
      const k = hash(x, 37, 139);
      if (k < 0.45) p.set(x, 37, k < 0.18 ? C('#e04a3c') : k < 0.26 ? C('#f4e2c4') : PAL.herb[3]);
    }
  }
  // mãos-francesas embaixo da janela do meio
  for (let x = 26; x <= 38; x += 3) p.set(x, 40, BEAM[1]);
  p.rect(10, 28, 45, 2, (x, y) => pick(BEAM, (y === 28 ? 0.85 : 0.35) - (x - 10) * 0.005, x, y));
  for (let x = 11; x < 55; x += 4) { p.set(x, 30, BEAM[3]); }

  // empena: reboco, pendural, linha alta, escoras e as janelas do sótão
  const half = (y) => (y - 6) * (22 / 21);
  p.fill(10, 6, 55, 27, (x, y) => Math.abs(x - AX) <= half(y) - 1.5, (x, y) => plaster(x, y, 0.64 - (x - 18) * 0.008));
  const inGable = (x, y) => Math.abs(x + 0.5 - AX) <= half(y + 0.5) - 1.5;
  const gbeam = (x0, y0, x1, y1) => p.line(x0, y0, x1, y1, (x, y) => (inGable(x, y) ? beam(x, y) : 0));
  gbeam(32, 9, 32, 26);
  gbeam(20, 19, 44, 19);
  gbeam(24, 19, 24, 26);
  gbeam(40, 19, 40, 26);
  gbeam(32, 19, 26, 25);
  gbeam(32, 19, 38, 25);
  gbeam(14, 26, 22, 20);
  gbeam(50, 26, 42, 20);
  p.rect(12, 26, 41, 2, beam);
  lit(27, 21, 3, 3);
  lit(35, 21, 3, 3);
  p.sphere(AX, 14, 2.4, 2.4, PAL.stone, 0.12);
  p.rect(31, 13, 3, 2, WIN_DARK);
  p.set(32, 12, WIN_DARK);
  // telhado de ardósia visto de frente, pela borda
  p.fill(6, 3, 59, 30, (x, y) => {
    const d = Math.abs(x - AX) - (y - 5.5) * (25 / 23);
    return d <= 0.4 && d > -3 && y < 29;
  }, (x, y) => {
    const d = Math.abs(x + 0.5 - AX) - (y + 0.5 - 5.5) * (25 / 23);
    let v = (d > -1 ? 0.15 : 0.55) + (x < AX ? 0.15 : -0.1);
    if ((y + x) % 3 === 0) v -= 0.12;
    return pick(SLATE, v, x, y);
  });
  // chaminé de pedra
  p.rect(16, 9, 4, 9, (x, y) => pick(PAL.stone, (x === 16 ? 0.7 : x === 19 ? 0.25 : 0.48) + masonry(x, y, 4, 2, 139) * 0.6, x, y));
  p.rect(15, 8, 6, 1, (x) => PAL.stone[x < 18 ? 4 : 2]);
  // pináculo
  p.rect(32, 1, 1, 5, (x, y) => (y === 1 ? PAL.gold[5] : PAL.iron[3]));

  // estandartes roxos dos lados da porta
  for (const bx of [21, 40]) {
    p.rect(bx - 1, 45, 6, 1, (x) => PAL.gold[x === bx - 1 ? 5 : 3]);
    p.fill(bx, 46, bx + 3, 57, (x, y) => !(y > 55.5 && Math.abs(x + 0.5 - bx - 2) < (y - 55)), (x, y) => {
      if (x === bx || x === bx + 3) return PAL.gold[x === bx ? 4 : 2];
      if (y === 48 || y === 53) return PAL.gold[3];
      return pick(ROYAL, 0.62 - (x - bx) * 0.1 - (y - 46) * 0.012, x, y);
    });
    p.set(bx + 1, 50, PAL.gold[5]); p.set(bx + 2, 50, PAL.gold[3]);
    p.set(bx + 1, 51, PAL.gold[3]); p.set(bx + 2, 51, PAL.gold[2]);
  }
  // braço de ferro da placa
  p.line(52, 33, 61, 33, PAL.iron[3]);
  p.line(52, 37, 56, 33, PAL.iron[1]);
  p.set(61, 32, PAL.gold[4]);
  p.outline(PAL.out);
  return p;
}

// Placa da guilda: martelo e picareta cruzados em ouro sobre o roxo.
function buildSign() {
  const s = new Pix(13, 13);
  s.rect(0, 2, 13, 10, (x, y) => {
    if (x === 0 || y === 2) return PAL.gold[4];
    if (x === 12 || y === 11) return PAL.gold[2];
    return pick(ROYAL, 0.42 - (x - 1) * 0.02 - (y - 3) * 0.02, x, y);
  });
  // cabos cruzados
  s.line(3, 10, 8, 5, PAL.wood[4]);
  s.line(9, 10, 4, 5, PAL.wood[3]);
  // ponta da picareta, curva, e a cabeça do martelo
  for (const [x, y, k] of [[6, 4, 3], [7, 4, 4], [8, 4, 5], [9, 4, 4], [10, 5, 3], [11, 6, 2], [5, 5, 2], [9, 5, 2]]) s.set(x, y, PAL.gold[k]);
  for (const [x, y, k] of [[2, 4, 5], [3, 3, 5], [4, 3, 4], [2, 5, 4], [3, 4, 4], [4, 4, 3], [3, 5, 3], [4, 5, 2], [5, 4, 2], [1, 5, 3]]) s.set(x, y, PAL.gold[k]);
  s.rect(3, 0, 1, 2, PAL.iron[3]);
  s.rect(9, 0, 1, 2, PAL.iron[2]);
  s.outline(PAL.out);
  return s;
}

// Bandeira na haste inclinada: tremula a partir da ponta.
function paintGuildFlag(f, q, t, working) {
  const ph = t * (working ? 6.2 : 3.6);
  q.clear();
  const len = 9, h = 5;
  for (let i = 0; i < len; i++) {
    const dy = Math.round(Math.sin(ph - i * 0.8) * 1.4 * (i + 1) / len);
    const lit = Math.cos(ph - i * 0.8);
    for (let j = 0; j < h; j++) {
      if (i === len - 1 && j === 2) continue; // ponta recortada
      const v = 0.6 + lit * 0.25 - j * 0.04;
      q.set(len - i, 1 + j + dy, j === 2 && i > 1 && i < len - 2 ? pick(PAL.gold, v + 0.2, i, j) : pick(ROYAL, v, i, j, 3));
    }
  }
  q.outline(PAL.out);
  f.blit(q, 0, 22);
}

const guildArt = { bg: null, body: null, frame: new Pix(64, 64), flag: new Pix(12, 9) };

function paintGuildSign(f, sign, t, working) {
  const a = Math.sin(t * (working ? 1.7 : 1.1)) * (working ? 0.18 : 0.1);
  for (let y = 0; y < sign.h; y++) {
    const dx = Math.round(Math.sin(a) * y);
    for (let x = 0; x < sign.w; x++) {
      const c = sign.d[y * sign.w + x];
      if (c) f.set(50 + x + dx, 33 + y, c);
    }
  }
}

function paintGuildPole(f) {
  f.line(12, 37, 3, 24, PAL.out);
  f.line(13, 37, 4, 24, PAL.out);
  f.line(12, 36, 4, 24, PAL.wood[3]);
  f.set(3, 23, PAL.gold[5]);
}

function paintGuildPortrait(ctx, t, info) {
  const a = guildArt;
  if (!a.bg) {
    a.bg = buildGuildBackdrop();
    a.body = buildGuild();
    a.sign = buildSign();
    // janelas e porta: cada pixel aceso guarda a altura relativa para o tremor da luz
    a.lights = [];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        if (a.body.get(x, y) === WIN_DARK) a.lights.push([x, y, 0]);
        else if (a.bg.get(x, y) === WIN_DARK) a.lights.push([x, y, 1]);
      }
    }
    a.stars = [];
    for (let i = 0; i < 9; i++) a.stars.push([Math.floor(hash(i, 3, 141) * 64), Math.floor(hash(i, 4, 141) * 16), hash(i, 5, 141) * 6]);
    a.door = [];
    for (let y = 44; y < 59; y++) {
      for (let x = 27; x < 38; x++) {
        const k = GLOW.indexOf(a.body.get(x, y));
        if (k >= 0) a.door.push([x, y, GLOW[Math.min(5, k + 1)], Math.abs(x + 0.5 - 34) * 0.08 + (58 - y) * 0.035 + bayer(x, y) * 0.12]);
      }
    }
  }
  const working = info.working;
  const live = working ? 1 : 0.5;
  const f = a.frame.copyFrom(a.bg);
  // estrelas piscando
  for (const [x, y, ph] of a.stars) {
    const s = Math.sin(t * 1.3 + ph * 2.1);
    if (s > -0.2) f.set(x, y, s > 0.7 ? C('#fff6d8') : TWILIGHT[7]);
  }
  // fumaça da chaminé
  for (let k = 0; k < 6; k++) {
    const e = (t * (0.14 + live * 0.1) + k / 6) % 1;
    const sx = 18 + e * 9 + Math.sin(e * 6 + k + t * 0.5) * 1.3;
    const sy = 7 - e * 16;
    const r = 1 + e * 3;
    for (let y = Math.floor(sy - r); y <= sy + r; y++) {
      for (let x = Math.floor(sx - r); x <= sx + r; x++) {
        const dd = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / r;
        if (dd <= 1 && bayer(x, y) < (1 - e) * (1.15 - dd * 0.6)) f.set(x, y, PEAKS[dd < 0.5 && y < sy ? 5 : 4]);
      }
    }
  }
  f.blit(a.body, 0, 0);
  // luz das janelas e da porta tremendo
  for (const [x, y, far] of a.lights) {
    const fl = Math.sin(t * 7 + x * 1.3) * 0.5 + Math.sin(t * 13.1 + y * 2.1 + x) * 0.5;
    const v = far ? 0.3 + fl * 0.1 : 0.5 + live * 0.12 + fl * 0.12 + (y % 3 === 0 ? -0.1 : 0);
    f.d[y * 64 + x] = pick(GLOW, v, x, y, 1.4);
  }
  const df = Math.sin(t * 8.3) * 0.5 + Math.sin(t * 12.7 + 1) * 0.3 + Math.sin(t * 3.1) * 0.2;
  const level = 0.25 + live * 0.2 + df * 0.25;
  for (const [x, y, c, th] of a.door) if (th < level) f.d[y * 64 + x] = c;
  paintGuildPole(f);
  paintGuildFlag(f, a.flag, t, working);
  paintGuildSign(f, a.sign, t, working);
  // flâmula no pináculo
  const pp = t * (working ? 6 : 3.5);
  for (let i = 0; i < 5; i++) {
    const y = 1 + Math.round(Math.sin(pp - i * 0.9) * 0.6 * (i / 4));
    f.set(33 + i, y, ROYAL[i < 2 ? 4 : 3]);
    if (i < 3) f.set(33 + i, y + 1, ROYAL[2]);
  }
  f.draw(ctx);
}

function iconGuild() {
  const p = new Pix(16, 16);
  // empena e telhado
  p.poly([[1.5, 9], [8, 1.5], [14.5, 9]], (x) => PLASTER[x < 8 ? 5 : 4]);
  p.fill(0, 1, 16, 10, (x, y) => {
    const d = Math.abs(x - 8) - (y - 1.5) * (6.5 / 7.5);
    return d <= 0.5 && d > -1.6 && y < 9.5;
  }, (x) => SLATE[x < 8 ? 4 : 2]);
  p.rect(8, 3, 1, 6, BEAM[2]);
  p.line(5, 8, 7, 5, BEAM[2]); p.line(11, 8, 9, 5, BEAM[2]);
  // paredes de enxaimel
  p.rect(2, 9, 12, 7, (x, y) => (x === 2 || x === 13 || x === 7 || y === 9 ? BEAM[3] : PLASTER[x < 8 ? 5 : 4]));
  p.line(3, 10, 6, 13, BEAM[2]); p.line(12, 10, 9, 13, BEAM[2]);
  p.rect(7, 12, 3, 4, (x, y) => GLOW[y === 12 ? 3 : 4]);
  p.rect(3, 13, 3, 3, PAL.stone[3]);
  p.rect(11, 13, 2, 3, ROYAL[3]);
  p.set(11, 14, PAL.gold[4]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Veio de ouro

const ROCK = ramp('#0a080c', '#141016', '#1e171c', '#2a2024', '#382a2a', '#4a3730', '#5e4636', '#78583e', '#967048');
const LANTERN = [19.5, 18]; // centro da chama
const VEIN = [[6, 51], [12, 47.5], [19, 44.5], [26, 38.5], [33, 33], [39, 29], [46, 22.5], [52, 17.5], [60, 13]];
const VEINLETS = [[[19, 44], [15, 38], [13, 33], [10, 31]], [[40, 28], [44, 33], [49, 35], [52, 39]], [[28, 37], [26, 42], [27, 46]], [[47, 21], [46, 15], [48, 11]]];
const veinHalf = (at, x, y) => 2.9 + Math.sin(at * 1.9 + 0.4) * 0.9 + (at > 3 && at < 5.5 ? 0.7 : 0) + (hash(Math.floor(x), Math.floor(y), 151) - 0.5) * 1.1;
const PICK_EYE = [35, 31];

// Rocha em facetas: ruído celular (pontos espalhados numa grade de 7 pixels).
function rockCell(x, y, seed) {
  const gx = Math.floor(x / 7), gy = Math.floor(y / 7);
  let d1 = Infinity, d2 = Infinity, id = 0, fx = 0, fy = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = (gx + i) * 7 + hash(gx + i, gy + j, seed) * 7;
      const cy = (gy + j) * 7 + hash(gx + i, gy + j, seed + 1) * 7;
      const d = Math.hypot(x - cx, (y - cy) * 1.2);
      if (d < d1) { d2 = d1; d1 = d; id = (gx + i) * 73 + (gy + j) * 31; fx = x - cx; fy = y - cy; }
      else if (d < d2) d2 = d;
    }
  }
  return { edge: d2 - d1, id, fx, fy };
}

function buildVeinBackdrop(lamp) {
  const p = new Pix(64, 64);
  const [lx, ly] = LANTERN;
  const reach = 40 + lamp * 10, power = 0.5 + lamp * 0.22;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const light = power * clamp01(1 - Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 0.9) / reach) ** 1.4;
      const [dv] = nearestOnPath(VEIN, x + 0.5, y + 0.5);
      const gold = 0.3 * clamp01(1 - dv / 12) ** 2;
      let v;
      if (y >= 52) {
        // chão de cascalho molhado
        v = 0.12 + light * 0.75 + gold * 0.4 + (hash(x, y, 152) - 0.5) * 0.22 + (hash(x >> 1, y, 153) < 0.12 ? 0.14 : 0);
        if (y === 52) v -= 0.14;
        if ((x * 3 + y * 7) % 23 === 0) v += 0.2; // brilho de água
      } else {
        const c = rockCell(x + 0.5, y + 0.5, 154);
        const tilt = (hash(c.id, 1, 155) - 0.5) * 0.3;
        v = 0.12 + light + gold + tilt - (c.fx * 0.025 + c.fy * 0.03);
        if (c.edge < 0.9) v -= 0.22;
        else if (c.edge < 1.7) v += 0.05;
        if (x < 11 || x > 53) v -= 0.14; // paredes do túnel, mais para trás
      }
      p.d[y * 64 + x] = pick(ROCK, v, x, y, 2);
      // rocha manchada de ouro perto do filão
      if (y < 52 && dv < 6 && hash(x, y, 156) < 0.3 * (1 - dv / 6)) p.d[y * 64 + x] = PAL.gold[dv < 4.5 ? 2 : 1];
    }
  }
  return p;
}

function buildVein() {
  const p = new Pix(64, 64);
  // filão: ouro grosso em pepitas, com quartzo leitoso em manchas na borda
  p.fill(0, 6, 63, 56, (x, y) => {
    const [d, , , at] = nearestOnPath(VEIN, x, y);
    const hw = veinHalf(at, x, y);
    return d <= hw || (d <= hw + 1.3 && hash(Math.floor(x / 3), Math.floor(y / 2), 157) < 0.45);
  }, (x, y) => {
    const [d, ox, oy, at] = nearestOnPath(VEIN, x + 0.5, y + 0.5);
    const hw = veinHalf(at, x, y);
    if (d > hw) return pick(QUARTZ, 0.25 + (oy < 0 ? 0.35 : 0) + (hash(x, y, 158) - 0.5) * 0.3, x, y);
    const c = rockCell(x * 1.7 + 0.5, y * 1.7 + 0.5, 159);
    let v = 0.2 + sphereLight(ox / (hw + 1.2), oy / (hw + 1.2)) * 0.5 - c.fx * 0.05 - c.fy * 0.06;
    if (c.edge < 1) v -= 0.28;
    if (hash(c.id, 3, 160) < 0.2) v += 0.18; // pepita mais clara
    return pick(PAL.gold, v, x, y, 1.8);
  });
  // veios finos saindo do filão, falhados e mais escuros na ponta
  for (const path of VEINLETS) {
    for (let i = 0; i < path.length - 1; i++) {
      p.line(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1], (x, y) => {
        const h = hash(x, y, 161);
        return h < 0.22 + i * 0.12 ? 0 : PAL.gold[i === 0 ? (h > 0.8 ? 4 : 3) : 2];
      });
    }
  }
  // escoramento de madeira na frente: dois esteios e o chapéu
  const log = (x, y, cx, r) => pick(PAL.wood, 0.1 + cylLight((x + 0.5 - cx) / r) * 0.75 + (hash(x, y >> 1, 162) - 0.5) * 0.14 + ((y * 5 + x) % 11 === 0 ? -0.16 : 0), x, y);
  for (const cx of [6.5, 57.5]) p.fill(cx - 3, 6, cx + 3, 63, (x) => Math.abs(x - cx) <= 2.6, (x, y) => log(x, y, cx, 2.6));
  p.fill(1, 2, 63, 8, (x, y) => y >= 2.5 && y <= 7.5, (x, y) => {
    let v = 0.15 + sphereLight(0, (y + 0.5 - 5) / 3) * 0.75 + (hash(x >> 1, y, 163) - 0.5) * 0.14;
    if ((x + y * 3) % 9 === 0) v -= 0.14;
    return pick(PAL.wood, v, x, y);
  });
  for (const x of [1, 62]) for (let y = 3; y < 8; y++) p.set(x, y, PAL.wood[y === 4 ? 4 : 2]);
  for (const x of [1, 62]) p.set(x, 5, PAL.wood[1]);
  // cunhas entre o chapéu e o esteio
  for (const cx of [6, 57]) { p.rect(cx - 2, 8, 6, 1, PAL.wood[1]); p.set(cx - 1, 8, PAL.wood[3]); }

  // lanterna pendurada no chapéu
  const [lx] = LANTERN;
  const x0 = Math.floor(lx) - 3;
  p.rect(x0 + 3, 8, 1, 2, PAL.iron[2]);
  p.set(x0 + 3, 10, PAL.iron[4]);
  p.rect(x0 + 2, 11, 3, 1, PAL.iron[3]);
  p.rect(x0 + 1, 12, 5, 1, (x) => PAL.iron[x < x0 + 3 ? 4 : 2]);
  p.rect(x0, 13, 7, 1, (x) => PAL.iron[x < x0 + 3 ? 3 : 1]);
  p.rect(x0, 14, 7, 7, (x, y) => {
    if (x === x0 || x === x0 + 6) return PAL.iron[x === x0 ? 3 : 1];
    if (x === x0 + 3 && y !== 17) return PAL.iron[2];
    return pick(GLOW, 0.72 - Math.abs(x + 0.5 - lx) * 0.12 - Math.abs(y + 0.5 - 18) * 0.06, x, y, 1.6);
  });
  p.rect(x0, 21, 7, 1, (x) => PAL.iron[x < x0 + 3 ? 3 : 2]);
  p.rect(x0 + 1, 22, 5, 1, PAL.iron[1]);

  // cascalho caído no pé do filão
  p.fill(10, 54, 32, 63, (x, y) => ((x - 21) / 10.5) ** 2 + ((y - 63.5) / 8.5) ** 2 <= 1, (x, y) => {
    const c = rockCell(x * 2.2 + 0.5, y * 2.2 + 0.5, 164);
    let v = 0.3 + sphereLight((x + 0.5 - 21) / 10.5, (y + 0.5 - 60) / 8.5) * 0.5 - c.fx * 0.03 - c.fy * 0.03;
    if (c.edge < 1.5) v -= 0.22;
    if (hash(c.id, 2, 165) < 0.25) return pick(PAL.gold, v + 0.15, x, y);
    return pick(ROCK, v + 0.25, x, y);
  });
  paintPickaxe(p);

  // vagonete cheio de minério
  p.fill(36, 44, 58, 52, (x, y) => ((x - 47) / 9.6) ** 2 + ((y - 51) / 5.2) ** 2 <= 1 && y < 51, (x, y) => {
    const c = rockCell(x * 2 + 0.5, y * 2 + 0.5, 166);
    let v = 0.3 + sphereLight((x + 0.5 - 47) / 9.6, (y + 0.5 - 49) / 5.2) * 0.55 - c.fx * 0.035 - c.fy * 0.035;
    if (c.edge < 1.4) v -= 0.25;
    if (hash(c.id, 4, 167) < 0.35) return pick(PAL.gold, v + 0.2, x, y);
    return pick(ROCK, v + 0.3, x, y);
  });
  p.poly([[36.5, 50], [57.5, 50], [55.5, 59], [38.5, 59]], (x, y) => {
    let v = 0.48 - (x - 37) * 0.012 + (hash(x >> 2, y, 168) - 0.5) * 0.1;
    if ((y - 50) % 3 === 2) v -= 0.18;
    return pick(PAL.wood, v, x, y);
  });
  p.rect(36, 50, 22, 1, (x) => PAL.iron[x < 45 ? 4 : 3]);
  for (const [xa, xb] of [[37, 39], [56, 54]]) p.line(xa, 51, xb, 58, PAL.iron[xa < 45 ? 3 : 1]);
  p.rect(39, 58, 16, 1, PAL.iron[1]);
  for (const wx of [42, 52]) {
    p.sphere(wx, 60.5, 2.6, 2.6, PAL.iron, 0.05);
    p.set(wx, 60, PAL.iron[0]);
  }
  p.outline(PAL.out);
  return p;
}

// Picareta cravada no filão: cabo descendo para a direita e a ponta de trás para cima.
function paintPickaxe(p) {
  const [ex, ey] = PICK_EYE;
  // rachaduras em volta da ponta enterrada
  for (const [x, y] of [[30, 33], [29, 34], [31, 35], [30, 31], [29, 30], [32, 35], [28, 33]]) p.set(x, y, PAL.gold[0]);
  const hx = 0.82, hy = -0.57;
  const inHead = (grow) => (x, y) => {
    const dx = x - ex, dy = y - ey;
    const a = dx * hx + dy * hy, b = -dx * hy + dy * hx;
    return a >= -3 - grow && a <= 10 + grow && Math.abs(b + a * a * 0.012) <= 1.9 - Math.max(0, a - 3) * 0.24 + grow;
  };
  // contorno escuro para a ferramenta não sumir no ouro
  p.fill(ex - 5, ey - 11, ex + 12, ey + 5, inHead(1), PAL.out);
  tube(p, [[ex, ey], [46, 47.5]], 2.4, [PAL.out]);
  tube(p, [[ex, ey], [46, 47.5]], 1.4, PAL.wood, 0.18, 2);
  p.fill(ex - 4, ey - 10, ex + 11, ey + 4, inHead(0), (x, y) => {
    const dx = x + 0.5 - ex, dy = y + 0.5 - ey;
    const a = dx * hx + dy * hy, b = -dx * hy + dy * hx + a * a * 0.012;
    return pick(PAL.steel, 0.5 - b * 0.3 + (a > 7 ? 0.12 : 0), x, y);
  });
  p.rect(ex - 1, ey - 1, 3, 3, (x, y) => PAL.steel[x === ex - 1 || y === ey - 1 ? 4 : 2]);
  p.set(ex, ey, PAL.steel[1]);
}

const veinArt = { bg: null, body: null, frame: new Pix(64, 64), halo: null };

function paintVeinPortrait(ctx, t, info) {
  const a = veinArt;
  if (!a.bg) {
    a.bg = buildVeinBackdrop(0);
    const [lx, ly] = LANTERN;
    a.halo = makeHalo(a.bg, buildVeinBackdrop(1), (x, y) => Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 0.9) / 46);
    a.body = buildVein();
    // pixels de ouro do filão, com a posição ao longo dele para a onda de brilho
    a.gold = [];
    for (let y = 0; y < 52; y++) {
      for (let x = 0; x < 64; x++) {
        const k = PAL.gold.indexOf(a.body.get(x, y));
        const [d, , , at] = nearestOnPath(VEIN, x + 0.5, y + 0.5);
        if (k >= 1 && d < 6) a.gold.push([x, y, k, at]);
      }
    }
    a.glints = a.gold.filter(([x, y, k]) => k >= 3 && hash(x, y, 169) < 0.3);
  }
  const working = info.working;
  const live = working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.bg);
  const flick = Math.sin(t * 7.9) * 0.5 + Math.sin(t * 13.3 + 1) * 0.3 + Math.sin(t * 2.7) * 0.2;
  paintHalo(f, a.halo, 0.45 + live * 0.1 + flick * 0.06);
  f.blit(a.body, 0, 0);
  // onda de brilho correndo pelo filão
  const wave = t * (0.8 + live * 0.7);
  for (const [x, y, k, at] of a.gold) {
    const s = Math.sin(at * 1.6 - wave * 2) * 0.5 + 0.5;
    if (s > 0.78) f.d[y * 64 + x] = PAL.gold[Math.min(5, k + (s > 0.92 ? 2 : 1))];
  }
  // chama da lanterna
  const [lx, ly] = LANTERN;
  paintFlame(f, lx - 0.5, ly + 2, t, 4 + live, 1.3, live * 0.7);
  // faíscas de ouro caindo de onde a picareta entrou
  const [ex, ey] = PICK_EYE;
  for (let k = 0; k < (working ? 7 : 3); k++) {
    const e = (t * (0.5 + hash(k, 1, 170) * 0.5) + hash(k, 2, 170)) % 1;
    const x = ex - 4 + (hash(k, 3, 170) - 0.5) * 6 + Math.sin(t * 3 + k) * 0.6;
    const y = ey + 3 + e * e * 20;
    f.set(x, y, PAL.gold[e < 0.5 ? 5 : 4]);
  }
  // estrelinhas acendendo no filão
  const n = a.glints.length;
  for (let k = 0; k < (working ? 4 : 2); k++) {
    const cyc = t * (0.45 + k * 0.07) + k * 0.31;
    const [x, y] = a.glints[Math.floor(hash(Math.floor(cyc), k, 171) * n)];
    paintGlint(f, x, y, Math.sin((cyc % 1) * Math.PI));
  }
  f.draw(ctx);
}

function iconGoldvein() {
  const p = new Pix(16, 16);
  const inRock = (x, y) => ((x - 8) / 7.6) ** 2 + ((y - 10) / 6.4) ** 2 <= 1 && y < 15.5;
  p.fill(0, 2, 16, 16, inRock, (x, y) =>
    pick(PAL.stone, 0.1 + sphereLight((x + 0.5 - 8) / 7.6, (y + 0.5 - 9.5) / 6.4) * 0.65 + ((x * 3 + y * 5) % 7 === 0 ? -0.15 : 0), x, y));
  // filão
  const vy = (x) => 14.5 - x * 0.75;
  p.fill(0, 2, 16, 16, (x, y) => inRock(x, y) && Math.abs(y - vy(x)) <= 1.8, (x, y) => {
    const o = y + 0.5 - vy(x + 0.5);
    return PAL.gold[o < -0.7 ? 5 : o < 0.5 ? 4 : 2];
  });
  // picareta
  p.line(8, 8, 13, 14, PAL.wood[4]);
  p.line(9, 8, 14, 14, PAL.wood[2]);
  p.line(5, 10, 10, 4, PAL.steel[4]);
  p.line(6, 10, 11, 4, PAL.steel[2]);
  p.set(11, 3, PAL.steel[4]);
  p.outline(PAL.out);
  return p;
}

ART.portraits.goldsmith = paintGoldsmithPortrait;
ART.portraits.mint = paintMintPortrait;
ART.portraits.guild = paintGuildPortrait;
ART.portraits.goldvein = paintVeinPortrait;
ART.locked.goldsmith = ART.silhouette(buildGoldsmith);
ART.locked.mint = ART.silhouette(() => {
  const p = buildMint();
  paintPress(p, 0, 0);
  return p;
});
ART.locked.guild = ART.silhouette(() => {
  const p = buildGuild();
  paintGuildPole(p);
  paintGuildFlag(p, new Pix(12, 9), 0, false);
  paintGuildSign(p, buildSign(), 0, false);
  return p;
});
ART.locked.goldvein = ART.silhouette(buildVein);
Object.assign(ART.icons, { goldsmith: iconGoldsmith, mint: iconMint, guild: iconGuild, goldvein: iconGoldvein });
})();
