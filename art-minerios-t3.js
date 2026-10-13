'use strict';
// Linha dos minérios, tiers 3 a 6: Pedreira (faz minas), Fundição (faz pedreiras),
// Capataz (faz fundições) e Poço (faz capatazes). Retratos animados, silhuetas
// bloqueadas e ícones.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

const LIME = ramp('#3c322c', '#605346', '#887a66', '#ae9f86', '#cfc3a6', '#ebe1c6', '#faf4e2');
const DUST = ramp('#9a8c74', '#bcae94', '#dcd0b6', '#f2ead8');
const ROPE = ramp('#4a3418', '#76562a', '#a48242', '#ccaa66');
const COPPER = ramp('#3a1610', '#6c2c18', '#9e4a26', '#cc7038', '#ec9c5c', '#fcc890');
const WHITE = C('#ffffff');

// ---------------------------------------------------------------------------
// Peças comuns

// Coordenadas (a, b) de um ponto num paralelogramo o + a*e1 + b*e2.
function planeUV(o, e1, e2) {
  const det = e1[0] * e2[1] - e1[1] * e2[0];
  return (x, y) => {
    const dx = x - o[0], dy = y - o[1];
    return [(dx * e2[1] - dy * e2[0]) / det, (e1[0] * dy - e1[1] * dx) / det];
  };
}
const quad = (o, e1, e2) => [o, [o[0] + e1[0], o[1] + e1[1]], [o[0] + e1[0] + e2[0], o[1] + e1[1] + e2[1]], [o[0] + e2[0], o[1] + e2[1]]];

const smooth = (u) => u * u * (3 - 2 * u);

// Sobe, espera no alto, desce e espera embaixo: 0 = embaixo, 1 = no alto.
function liftCycle(ph) {
  const s = (a, b) => smooth(clamp01((ph - a) / (b - a)));
  return s(0.06, 0.44) - s(0.58, 0.94);
}

// Pulso de brilho que aparece de tempos em tempos: 0 quase sempre, sobe e desce rápido.
function pulse(t, period, width) {
  const ph = (((t % period) + period) % period) / width;
  return ph < 1 ? Math.sin(ph * Math.PI) : 0;
}

// Brilho em cruz num ponto, com intensidade 0..1.
function paintGlint(f, x, y, s, r = PAL.gold) {
  if (s <= 0.05) return;
  f.set(x, y, s > 0.4 ? WHITE : r[r.length - 1]);
  if (s > 0.35) {
    const c = s > 0.7 ? r[r.length - 1] : r[r.length - 2];
    f.set(x - 1, y, c); f.set(x + 1, y, c); f.set(x, y - 1, c); f.set(x, y + 1, c);
  }
  if (s > 0.75) {
    const c = r[r.length - 2];
    f.set(x - 2, y, c); f.set(x + 2, y, c); f.set(x, y - 2, c); f.set(x, y + 2, c);
  }
}

// Nuvenzinha de pó ou fumaça pontilhada: k vai de 0 (nasce) a 1 (some).
function paintPuff(f, sx, sy, r, k, colors, dens = 1.2) {
  for (let y = Math.floor(sy - r); y <= sy + r; y++) {
    for (let x = Math.floor(sx - r); x <= sx + r; x++) {
      const dd = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / r;
      if (dd <= 1 && bayer(x, y) < (1 - k) * dens * (1.1 - dd * 0.6)) {
        f.set(x, y, colors[dd < 0.45 && y < sy ? colors.length - 1 : y > sy ? 0 : Math.min(colors.length - 1, 1)]);
      }
    }
  }
}

// Luz que pulsa: compara a imagem apagada com a acesa e guarda, para cada pixel que muda,
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
function paintFlame(f, x, y, t, h, w, live, seed = 0) {
  const sway = Math.sin(t * 6.3 + seed) * 0.7 + Math.sin(t * 11.9 + 1 + seed * 2) * 0.4 * live;
  const hh = h + Math.sin(t * 8.7 + seed) * 0.7 * live + Math.sin(t * 14.3 + 2 + seed) * 0.4;
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

// ---------------------------------------------------------------------------
// Pedreira

const QF = 55;                                  // pé da parede de pedra (altura 0)
const QDX = -5, QDY = -4;                       // fundo das bancadas, projetado para cima e à esquerda
const QSTEPS = [[26, 9], [37, 18], [48, 27]];   // [x da quina, altura da bancada]
const QWHEEL = [12, 43], QR = 10;               // roda de pisar
const QMAST = 24;                               // mastro do guindaste (colunas 24 e 25)
const QTOP = [25, 10];                          // roldana do alto do mastro
const QTIP = [47, 4];                           // roldana da ponta da lança
const QHOOK_LOW = 47, QHOOK_HIGH = 17;          // altura do gancho com o bloco embaixo e no alto
const QPICK = [35, 40];                         // onde a picareta bate
const SHIRT = ramp('#1e2a40', '#2e4262', '#46628a', '#6a88ae');

// Camadas da rocha: índice da camada e posição dentro dela (0 embaixo, 1 em cima).
function strata(h, x) {
  const s = (h + Math.sin(x * 0.35) * 0.4) / 4.5;
  const c = Math.floor(s);
  return [c, s - c];
}

function buildQuarryBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 47);
  paintSun(p, 8, 9, 4);
  // serra azulada ao longe, com as encostas da esquerda pegando sol
  const ridge = (x) => 31 + 4 * Math.sin(x * 0.12 + 0.4) + 2.2 * Math.sin(x * 0.31 + 1.3);
  for (let x = 0; x < 64; x++) {
    const top = Math.round(ridge(x));
    const lit = ridge(x + 1) < ridge(x - 1);
    for (let y = top; y < 47; y++) {
      let v = 0.6 - (y - top) * 0.02 + (lit ? 0.12 : -0.06) + (hash(x, y, 101) - 0.5) * 0.06;
      if (y === top) v += 0.15;
      p.set(x, y, pick(PAL.far, v, x, y));
    }
  }
  // morro de capim onde a pedreira foi aberta (aparece acima das bancadas)
  for (let x = 28; x < 64; x++) {
    const top = Math.round(28 - (x - 28) * 0.3 + Math.sin(x * 0.7) * 0.7);
    for (let y = top; y < 47; y++) {
      let v = 0.56 - (y - top) * 0.025 + (hash(x >> 1, y, 102) - 0.5) * 0.18;
      if (y === top) v += 0.2;
      p.set(x, y, pick(PAL.grass, v, x, y, 1.6));
    }
  }
  // moitas no alto do morro
  for (const [x, y, r] of [[34, 25, 2.2], [40, 23, 1.8], [62, 15, 2.4]]) p.sphere(x, y, r, r * 0.8, PAL.tree, 0.05);
  // mata baixa no horizonte, atrás do guindaste
  for (let x = 0; x < 40; x++) {
    const top = 44 + Math.round(Math.sin(x * 0.55 + 1) + 0.8 * Math.sin(x * 1.3));
    for (let y = top; y < 48; y++) p.set(x, y, pick(PAL.tree, 0.55 - (y - top) * 0.1 + (hash(x, y, 103) - 0.5) * 0.25, x, y));
  }
  // chão da cava: pó claro, trilhas de arrasto e pedrinhas
  for (let y = 47; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.52 + (y - 47) * 0.012 + (hash(x >> 1, y, 104) - 0.5) * 0.1;
      const rut = Math.abs(y - 59.5 - (x - 30) * 0.1);
      if (x < 44 && rut > 0.4 && rut < 1.2) v -= 0.12;
      p.set(x, y, pick(LIME, v, x, y, 1.8));
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, 1, 105) * 64), y = 48 + Math.floor(hash(i, 2, 105) * 16);
    p.set(x, y, LIME[5]);
    p.set(x + 1, y, LIME[2]);
  }
  // sombra da roda e do mastro no chão
  p.fill(4, 53, 36, 57, (x, y) => ((x - 19) / 15) ** 2 + ((y - 55) / 1.8) ** 2 <= 1, (x, y) => pick(LIME, 0.28 + (hash(x, y, 107) - 0.5) * 0.08, x, y));
  return p;
}

// Parede de pedra em bancadas: piso de cada degrau, espelho virado para a luz e a face da frente.
function paintTerraces(p) {
  const last = QSTEPS.length - 1;
  const e2 = [QDX, QDY];
  for (let k = last; k >= 0; k--) {
    const [x0, h] = QSTEPS[k];
    const x1 = k < last ? QSTEPS[k + 1][0] : 72;
    const hPrev = k ? QSTEPS[k - 1][1] : 0;
    const y = QF - h, yPrev = QF - hPrev;
    const top = k === last;
    // piso da bancada; a de cima é o alto do morro, coberto de capim
    const uv = planeUV([x0, y], [x1 - x0, 0], e2);
    p.poly(quad([x0, y], [x1 - x0, 0], e2), (px, py) => {
      const [a, b] = uv(px + 0.5, py + 0.5);
      if (top && b > 0.3 + hash(px, 0, 111) * 0.3) {
        let v = 0.58 - b * 0.12 + (hash(px >> 1, py, 112) - 0.5) * 0.16;
        if ((px + py * 2) % 5 === 0) v += 0.14;
        return pick(PAL.grass, v, px, py, 1.6);
      }
      let v = 0.9 - b * 0.08 + (hash(px >> 1, py, 114) - 0.5) * 0.06;
      if (b < 0.2) v += 0.06;                     // quina que pega sol
      if (!top && a > 0.92) v -= 0.22;             // pé da bancada seguinte
      if (hash(px, py, 115) < 0.05) v -= 0.24;     // cascalho
      return pick(LIME, v, px, py);
    });
    // espelho: parede voltada para a esquerda, com as juntas das camadas
    const uv2 = planeUV([x0, yPrev], [0, y - yPrev], e2);
    p.poly(quad([x0, yPrev], [0, y - yPrev], e2), (px, py) => {
      const [a, b] = uv2(px + 0.5, py + 0.5);
      const [c, fc] = strata(hPrev + a * (h - hPrev), b * 10);
      let v = 0.6 + (hash(Math.floor(b * 3), c, 116 + k) - 0.5) * 0.1;
      if (fc < 0.22) v -= 0.18;
      else if ((b * 15 + c * 2) % 5 < 0.8) v -= 0.12;
      if (a > 0.86) v += 0.08;
      return pick(LIME, v, px, py);
    });
  }
  // face da frente: blocos marcados para o corte, em camadas, com estrias de cinzel
  const prof = [[QSTEPS[0][0], QF]];
  QSTEPS.forEach(([x0, h], k) => {
    prof.push([x0, QF - h]);
    prof.push([k < last ? QSTEPS[k + 1][0] : 70, QF - h]);
  });
  prof.push([70, QF]);
  p.poly(prof, (px, py) => {
    const [c, fc] = strata(QF - py - 0.5, px);
    const w = 5 + Math.floor(hash(c, 0, 117) * 4);
    const cell = (px + c * 3) / w, block = Math.floor(cell);
    const step = QSTEPS.reduce((s, [x0], k) => (px >= x0 ? k : s), 0);
    let v = 0.4 + (hash(block, c, 118) - 0.5) * 0.12 + (hash(px, py, 119) - 0.5) * 0.04;
    if (fc < 0.22) v -= 0.16;                                   // junta da camada
    else if (cell - block < 1 / w) v -= 0.12;                   // corte vertical
    else if (fc > 0.78) v += 0.06;                              // aresta de cima de cada bloco
    else if ((px - py * 2) % 5 === 0 && hash(block, c, 120) > 0.4) v -= 0.06;
    if (py === QF - QSTEPS[step][1]) v += 0.1;                  // beirada da bancada
    if (px === QSTEPS[step][0]) v += 0.14;                      // quina da esquerda
    if (py > QF - 4) v -= (py - QF + 4) * 0.05;                 // pé da parede
    return pick(LIME, v, px, py);
  });
  // árvore no alto do morro, com o capim da beirada
  p.rect(58, 18, 2, 6, (x) => PAL.wood[x === 58 ? 3 : 1]);
  p.fill(53, 9, 64, 21, (x, y) => ((x - 58.5) / 5) ** 2 + ((y - 15) / 5.2) ** 2 <= 1 - hash(Math.floor(Math.atan2(y - 15, x - 58.5) * 3), 0, 124) * 0.15,
    (x, y) => {
      let v = 0.1 + sphereLight((x + 0.5 - 58.5) / 5, (y + 0.5 - 15) / 5.2) * 1.05;
      if (hash(x, y, 125) < 0.18) v -= 0.22;
      return pick(PAL.tree, v, x, y, 1.6);
    });
  for (const [x, y] of [[44, 24], [49, 24], [53, 23], [63, 23], [47, 29], [56, 29], [61, 29]]) {
    p.set(x, y, PAL.grass[4]); p.set(x + 1, y - 1, PAL.grass[3]); p.set(x - 1, y, PAL.grass[2]);
  }
}

// Bloco de pedra cortado, visto de quina: frente, topo claro e lado na sombra.
function cutBlock(p, x0, y0, w, h, d, seed) {
  p.rect(x0, y0 + d, w, h, (x, y) => {
    let v = 0.5 - (x - x0) * 0.015 + (hash(x, y, seed) - 0.5) * 0.06;
    if (x === x0) v += 0.14;
    if ((x * 2 + y) % 5 === 0) v -= 0.06;
    return pick(LIME, v, x, y);
  });
  p.poly([[x0, y0 + d], [x0 + d, y0], [x0 + w + d, y0], [x0 + w, y0 + d]], (x, y) =>
    pick(LIME, 0.88 + (hash(x, y, seed + 1) - 0.5) * 0.06, x, y));
  p.poly([[x0 + w, y0 + d], [x0 + w + d, y0], [x0 + w + d, y0 + h], [x0 + w, y0 + h + d]], (x, y) =>
    pick(LIME, 0.28 + (hash(x, y, seed + 2) - 0.5) * 0.06, x, y));
}

// Blocos prontos empilhados e o trenó de madeira onde o guindaste pousa a pedra.
function paintQuarryYard(p) {
  cutBlock(p, 56, 57, 8, 4, 2, 121);
  cutBlock(p, 58, 52, 6, 4, 2, 124);
  // trenó
  p.rect(41, 61, 13, 1, (x) => PAL.wood[x % 4 === 0 ? 2 : 4]);
  p.rect(41, 62, 13, 1, PAL.wood[1]);
  p.set(40, 61, PAL.wood[3]); p.set(54, 61, PAL.wood[2]);
}

// Guindaste: mastro, lança, aro da roda e o cabo parado (raios, eixo e bloco vão por quadro).
function buildCrane() {
  const p = new Pix(64, 64);
  const [wx, wy] = QWHEEL;
  // cavalete que segura o eixo, atrás da roda
  for (const [xa, xb] of [[7, 11], [17, 13]]) {
    p.line(xa, 53, xb, wy + 1, PAL.wood[xa < 12 ? 2 : 1]);
    p.line(xa + 1, 53, xb + 1, wy + 1, PAL.wood[xa < 12 ? 3 : 2]);
  }
  // viga de base
  p.rect(1, 53, 30, 2, (x, y) => pick(PAL.wood, (y === 53 ? 0.75 : 0.35) + (hash(x, y, 131) - 0.5) * 0.12 - (x % 8 === 0 ? 0.2 : 0), x, y));
  // aro da roda: duas tábuas curvas
  p.fill(wx - QR, wy - QR, wx + QR, wy + QR, (x, y) => {
    const d = Math.hypot(x - wx, y - wy);
    return d <= QR && d >= QR - 2.2;
  }, (x, y) => {
    const nx = (x + 0.5 - wx) / QR, ny = (y + 0.5 - wy) / QR;
    const outer = Math.hypot(x + 0.5 - wx, y + 0.5 - wy) > QR - 1.1;
    const v = 0.3 + sphereLight(nx, ny) * 0.55 + (outer ? 0.1 : -0.14) + (hash(x, y, 132) - 0.5) * 0.08;
    return pick(PAL.wood, v, x, y);
  });
  // mastro
  p.rect(QMAST, 8, 2, 46, (x, y) => pick(PAL.wood, (x === QMAST ? 0.74 : 0.36) + (hash(x, y >> 1, 133) - 0.5) * 0.12 - (y % 9 === 0 ? 0.15 : 0), x, y));
  p.rect(QMAST - 1, 7, 4, 2, (x, y) => PAL.wood[y === 7 ? 4 : 2]);
  // mão-francesa no pé do mastro
  p.line(31, 53, QMAST + 2, 46, PAL.wood[3]);
  p.line(32, 53, QMAST + 3, 46, PAL.wood[1]);
  // lança inclinada e escora
  p.line(QMAST + 1, 14, QTIP[0], QTIP[1], (x) => PAL.wood[x % 6 === 0 ? 3 : 4]);
  p.line(QMAST + 1, 15, QTIP[0], QTIP[1] + 1, (x) => PAL.wood[x % 6 === 0 ? 1 : 2]);
  p.line(QMAST + 2, 28, 35, 10, PAL.wood[3]);
  p.line(QMAST + 2, 29, 36, 10, PAL.wood[1]);
  // roldanas
  for (const [x, y] of [QTOP, [QTIP[0], QTIP[1] + 1]]) p.sphere(x + 0.5, y + 0.5, 1.8, 1.8, PAL.iron, 0.1);
  // cabo: do tambor do eixo até o alto do mastro e pela lança até a ponta
  p.line(wx + 1.5, wy - 1.5, QTOP[0] - 1, QTOP[1] + 1, (x, y) => ROPE[(x + y) % 3 ? 3 : 2]);
  p.line(QTOP[0] + 1, QTOP[1] + 2, QTIP[0], QTIP[1] + 3, (x) => ROPE[x % 3 ? 2 : 3]);
  p.outline(PAL.out);
  return p;
}

// Cubo da roda, com o tambor onde o cabo enrola.
function buildCraneHub() {
  const p = new Pix(64, 64);
  const [wx, wy] = QWHEEL;
  p.sphere(wx + 0.5, wy + 0.5, 2.4, 2.4, PAL.wood, 0.05);
  p.sphere(wx + 0.2, wy + 0.2, 1.1, 1.1, PAL.iron, 0.25);
  p.outline(PAL.out);
  return p;
}

function buildQuarry() {
  const p = new Pix(64, 64);
  paintTerraces(p);
  paintQuarryYard(p);
  p.outline(PAL.out);
  p.blit(buildCrane(), 0, 0);
  return p;
}

// Bloco pendurado na linga, com o gancho em (6, 0).
function buildHangingBlock() {
  const p = new Pix(14, 15);
  cutBlock(p, 2, 7, 8, 5, 2, 141);
  p.line(3, 8, 6, 2, ROPE[3]);
  p.line(10, 7, 7, 2, ROPE[2]);
  p.rect(3, 10, 1, 4, ROPE[3]);
  p.rect(8, 10, 1, 4, ROPE[2]);
  p.set(6, 1, PAL.iron[4]); p.set(7, 1, PAL.iron[2]); p.set(6, 0, PAL.iron[3]);
  p.outline(PAL.out);
  return p;
}

// Gente miúda: canteiro de picareta e o homem dentro da roda, com contorno próprio.
const tinyPix = new Pix(16, 16);

// Canteiro de perfil, virado para a direita, pés em (x, y). swing: 0 = erguida, 1 = batendo.
function paintCutter(f, x, y, swing) {
  const p = tinyPix.clear();
  const fx = 5, fy = 13;
  const lean = swing > 0.6 ? 1 : 0;
  p.set(fx - 1, fy, PAL.leather[1]); p.set(fx + 1, fy, PAL.leather[1]);
  p.set(fx - 1, fy - 1, PAL.wood[2]); p.set(fx + 1, fy - 1, PAL.wood[2]);
  p.rect(fx - 1, fy - 2, 3, 1, PAL.wood[2]);
  p.rect(fx - 1 + lean, fy - 3, 3, 1, PAL.leather[2]);
  p.rect(fx - 1 + lean, fy - 6, 3, 3, (xx, yy) => SHIRT[xx === fx - 1 + lean ? 3 : yy === fy - 6 ? 2 : 1]);
  const hx = fx + lean, hy = fy - 8;
  p.rect(hx, hy, 2, 2, (xx) => PAL.skin[xx === hx ? 3 : 2]);
  p.rect(hx - 1, hy - 1, 3, 1, PAL.band[2]);
  p.set(hx - 1, hy, PAL.band[1]);
  // braço e cabo girando em torno do ombro
  const ang = -2.25 + swing * 2.45;
  const sx = hx + 0.5, sy = fy - 5.5;
  const c = Math.cos(ang), s = Math.sin(ang);
  p.line(sx, sy, sx + c * 2, sy + s * 2, PAL.skin[2]);
  p.line(sx + c * 2, sy + s * 2, sx + c * 6, sy + s * 6, PAL.wood[4]);
  const ex = sx + c * 6, ey = sy + s * 6;
  p.line(ex + s * 2, ey - c * 2, ex - s * 2, ey + c * 2, PAL.iron[3]);
  p.set(ex - s * 2, ey + c * 2, PAL.iron[4]);
  p.outline(PAL.out);
  f.blit(p, x - fx, y - fy);
}

// Homem andando dentro da roda, subindo pela tábua; pés em (x, y).
function paintWalker(f, x, y, walk) {
  const p = tinyPix.clear();
  const fx = 4, fy = 10;
  const st = Math.sin(walk), s2 = st > 0 ? 1 : 0;
  p.set(fx - 1 + s2, fy, PAL.leather[1]); p.set(fx + 1 - s2, fy, PAL.leather[2]);
  p.set(fx, fy - 1, PAL.wood[2]); p.set(fx - 1 + s2, fy - 1, PAL.wood[1]);
  p.rect(fx, fy - 4, 2, 3, (xx, yy) => PAL.linen[xx === fx ? 3 : 2]);
  p.set(fx, fy - 2, PAL.leather[2]); p.set(fx + 1, fy - 2, PAL.leather[1]);
  p.rect(fx + 1, fy - 6, 2, 2, (xx) => PAL.skin[xx === fx + 1 ? 3 : 2]);
  p.set(fx + 1, fy - 7, PAL.hair[2]); p.set(fx + 2, fy - 7, PAL.hair[1]); p.set(fx, fy - 6, PAL.hair[2]);
  // braços agarrados na trave
  p.set(fx + 2, fy - 4, PAL.skin[2]); p.set(fx + 3, fy - 5, PAL.skin[3]);
  p.outline(PAL.out);
  f.blit(p, x - fx, y - fy);
}

// Andorinha vista de baixo, para dar vida ao céu.
function paintBird(f, x, y, flap, c) {
  x = Math.round(x); y = Math.round(y);
  f.set(x, y, c); f.set(x, y + 1, c);
  for (const d of [-1, 1]) {
    f.set(x + d, y - (flap > 0 ? 1 : 0), c);
    f.set(x + d * 2, y + (flap > 0 ? -1 : 1), c);
  }
}

const quarryArt = { bg: null, body: null, hub: null, block: null, cloud: null, frame: new Pix(64, 64) };

// Raios, homem na roda, cabo e bloco. lift: 0 = bloco no trenó, 1 = no alto.
function paintCraneMoving(f, a, lift, ang) {
  const [wx, wy] = QWHEEL;
  const ri = QR - 2;
  for (let i = 0; i < 3; i++) {
    const s = ang + (i * Math.PI) / 3;
    const cx = Math.cos(s) * ri, cy = Math.sin(s) * ri;
    f.line(wx + 0.5 - cx, wy + 1.3 - cy, wx + 0.5 + cx, wy + 1.3 + cy, PAL.wood[0]);
    f.line(wx + 0.5 - cx, wy + 0.5 - cy, wx + 0.5 + cx, wy + 0.5 + cy, (x, y) => PAL.wood[(x + y) & 1 ? 4 : 3]);
  }
  for (let i = 0; i < 16; i++) {
    const s = ang + (i * Math.PI) / 8;
    f.set(wx + 0.5 + Math.cos(s) * (QR - 1.1), wy + 0.5 + Math.sin(s) * (QR - 1.1), PAL.wood[0]);
  }
  paintWalker(f, 16, 49, ang * 2.4);
  f.blit(a.hub, 0, 0);
  // cabo da ponta da lança até o gancho, e o bloco balançando de leve
  const hy = Math.round(QHOOK_LOW + (QHOOK_HIGH - QHOOK_LOW) * lift);
  const hx = Math.round(QTIP[0] + 0.5 + Math.sin(ang * 0.6) * lift * (1 - lift) * 3);
  f.line(QTIP[0] + 1, QTIP[1] + 3, hx, hy, (x, y) => ROPE[y % 3 ? 3 : 2]);
  f.line(QTIP[0] + 2, QTIP[1] + 3, hx + 1, hy, PAL.out);
  f.blit(a.block, hx - 6, hy);
}

function paintQuarryPortrait(ctx, t, info) {
  const a = quarryArt;
  if (!a.bg) {
    a.bg = buildQuarryBackdrop();
    a.body = buildQuarry();
    a.hub = buildCraneHub();
    a.block = buildHangingBlock();
    a.cloud = makeCloud(20, 8, 31);
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.cloud, Math.floor(((t * 1.5) % 92) - 22), 14);
  // andorinhas sobre a cava
  for (let k = 0; k < 2; k++) {
    const ph = t * (0.45 + k * 0.13) + k * 2.6;
    paintBird(f, 40 + Math.cos(ph) * (13 - k * 4), 9 + k * 6 + Math.sin(ph * 2) * 2.5, Math.sin(t * 10 + k * 2), C('#2a3048'));
  }
  const lift = liftCycle(t / (working ? 7 : 12));
  const ang = lift * 11;
  f.blit(a.body, 0, 0);
  // sombra do bloco no chão, que se afasta e encolhe quando ele sobe
  const shx = QTIP[0] + 2 + lift * 5, shw = 5 - lift * 1.5;
  for (let y = 62; y <= 63; y++) {
    for (let x = Math.floor(shx - shw); x <= shx + shw; x++) {
      if (Math.abs(x + 0.5 - shx) <= shw - (y - 62) && bayer(x, y) < 0.8 - lift * 0.45) f.set(x, y, LIME[1]);
    }
  }
  paintCraneMoving(f, a, lift, ang);
  // canteiro batendo no espelho da bancada de cima
  const ph = (t * (working ? 0.9 : 0.45)) % 1;
  const swing = ph < 0.7 ? smooth(ph / 0.7) * 0.12 : ph < 0.8 ? 0.12 + smooth((ph - 0.7) / 0.1) * 0.88 : 1 - smooth((ph - 0.8) / 0.2);
  paintCutter(f, 30, 45, swing);
  // lascas e pó no golpe
  const hit = (ph - 0.8 + 1) % 1;
  if (hit < 0.6) {
    const [px, py] = QPICK;
    paintPuff(f, px + hit * 2, py - hit * 5, 1.2 + hit * 3.5, hit / 0.6, DUST, 1.4);
    for (let k = 0; k < 3; k++) {
      const vx = (hash(k, 1, 151) - 0.8) * 9, vy = -4 - hash(k, 2, 151) * 6;
      const s = hit * 1.2;
      f.set(px + vx * s, py + vy * s + 14 * s * s, LIME[k === 0 ? 6 : 5]);
    }
  }
  // poeira levantando quando o bloco sai do trenó ou pousa
  if (lift < 0.12) {
    const k = lift / 0.12;
    for (const s of [-1, 1]) paintPuff(f, QTIP[0] + 1 + s * (6 + k * 3), 60 - k * 3, 1.5 + k * 2, k, DUST, 1.1);
  }
  // pó solto subindo da cava
  const motes = working ? 10 : 4;
  for (let k = 0; k < motes; k++) {
    const life = (t * (0.08 + hash(k, 1, 152) * 0.06) + hash(k, 2, 152)) % 1;
    const x = 4 + hash(k, 3, 152) * 56 + Math.sin(t * 0.7 + k * 1.9) * 2;
    f.set(x, 62 - life * 26, life < 0.7 ? DUST[3] : DUST[2]);
  }
  f.draw(ctx);
}

function quarrySilhouette() {
  const p = buildQuarry();
  paintCraneMoving(p, { hub: buildCraneHub(), block: buildHangingBlock() }, 0.62, 2.2);
  return p;
}

function iconQuarry() {
  const p = new Pix(16, 16);
  // bancadas de pedra clara
  for (const [x0, y0] of [[0, 11], [5, 7], [10, 3]]) {
    p.rect(x0, y0, 16 - x0, 16 - y0, (x, y) => {
      let v = y === y0 ? 0.92 : x === x0 ? 0.7 : 0.45;
      if (y > y0 + 1 && (y - y0) % 3 === 0) v -= 0.16;
      return pick(LIME, v, x, y);
    });
  }
  p.set(12, 2, PAL.grass[4]); p.set(14, 2, PAL.grass[3]); p.set(13, 3, PAL.grass[4]); p.set(15, 3, PAL.grass[3]);
  // picareta cravada na bancada
  p.line(2, 4, 6, 10, (x) => PAL.wood[x < 4 ? 4 : 3]);
  p.line(0, 5, 4, 1, (x) => PAL.iron[x < 2 ? 4 : 3]);
  p.set(4, 2, PAL.iron[2]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Fundição

const NIGHT_SKY = ramp('#0b0a18', '#121026', '#1a1734', '#241e40', '#31274c', '#443256');
const RIDGE = ramp('#0d0b15', '#15111e', '#1d1828', '#272033', '#342a40');
const COOL_STONE = ramp('#121019', '#1b1724', '#25202f', '#332c3e', '#443b4f', '#5a4f63');
const WARM = ramp('#26171a', '#40241f', '#623624', '#874c2a', '#ae6632', '#d6863e', '#f6aa58', '#ffd48a');
const METAL = ramp('#22110e', '#4a1a10', '#7e2610', '#bc4012', '#ea761e', '#ffb43e', '#ffec96', '#ffffff');
const SMOKE = ramp('#17131d', '#241e2a', '#383040', '#56424a', '#7c584c', '#a8744e');
const ORE_GREEN = ramp('#0c2422', '#14403a', '#20624e', '#3a8a64', '#62b07e');
const OXBLOOD = ramp('#1a0c0e', '#341418', '#521f20', '#74302a', '#984636', '#b8604a');
const MOON = ramp('#9c98a8', '#c8c4c4', '#ece6d4', '#fffbea');

const FX = 31.5;                                   // eixo do forno
const F_TOP = 13, F_BASE = 56;
const fHalf = (y) => 7 + (y - F_TOP) * (5 / (F_BASE - F_TOP));
const F_TAP = [31.5, 51];                          // furo de corrida
const F_MOUTH = [31.5, 11];                        // boca de cima
const F_RUNNER = 58;                               // canal de areia na frente
const F_MOLDS = [17, 23, 36, 42, 48, 54];          // moldes de lingote (x da esquerda)
const F_BELLOWS = [5, 18, 47];                     // fole: ponta solta, dobradiça, tábua de baixo

// Luz da fundição: o metal derretido embaixo e a boca acesa no alto. g = 0 apagado, 1 aceso.
function smeltLight(x, y, g) {
  const a = clamp01(1 - Math.hypot((x - F_TAP[0]) * 0.8, (y - F_TAP[1] - 6) * 1.1) / (22 + g * 9));
  const b = clamp01(1 - Math.hypot(x - F_MOUTH[0], (y - F_MOUTH[1]) * 1.3) / (11 + g * 6));
  return (0.62 + g * 0.3) * (a * a * 1.1 + b * b * 0.75);
}

// Pedra que passa do frio da noite para o laranja da brasa conforme a luz.
function litStone(x, y, cool, light, tex = 0) {
  if (light > 0.12 + (bayer(x, y) - 0.5) * 0.12) return pick(WARM, 0.1 + light * 0.95 + tex, x, y);
  return pick(COOL_STONE, cool + tex, x, y);
}

// Moldes e canal: pixels do metal, com o calor de cada um (mais quente perto do furo).
const smeltMetal = (() => {
  const px = [];
  for (let x = 19; x <= 56; x++) px.push([x, F_RUNNER, 1 - Math.abs(x - F_TAP[0]) / 32]);
  for (const x0 of F_MOLDS) {
    const heat = 0.74 - Math.abs(x0 + 2 - F_TAP[0]) / 28;
    px.push([x0 + 2, F_RUNNER + 1, heat + 0.06]);
    for (let y = F_RUNNER + 2; y < F_RUNNER + 4; y++) for (let x = x0; x < x0 + 5; x++) px.push([x, y, heat - (y - F_RUNNER - 2) * 0.05]);
  }
  return px;
})();

function buildSmelterBackdrop(g) {
  const p = new Pix(64, 64);
  paintSky(p, 0, 44, NIGHT_SKY, 1.4);
  for (let i = 0; i < 34; i++) {
    const x = Math.floor(hash(i, 1, 201) * 64), y = Math.floor(hash(i, 2, 201) * 34);
    p.set(x, y, i % 5 ? NIGHT_SKY[5] : C('#9c90b8'));
  }
  // lua cheia com halo
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 20; x++) {
      const d = Math.hypot(x + 0.5 - 9, y + 0.5 - 8);
      if (d <= 3.4) {
        const crater = ((x - 8) ** 2 + (y - 9) ** 2 < 1.6) || ((x - 10) ** 2 + (y - 7) ** 2 < 0.8);
        p.set(x, y, pick(MOON, 0.2 + sphereLight((x + 0.5 - 9) / 3.4, (y + 0.5 - 8) / 3.4) * 0.9 - (crater ? 0.3 : 0), x, y));
      } else if (d < 7.5 && bayer(x, y) < (1 - (d - 3.4) / 4.1) * 0.5) p.set(x, y, NIGHT_SKY[4]);
    }
  }
  // serra escura, com a crista tocada pela lua
  const ridge = (x) => 31 + 3.5 * Math.sin(x * 0.1 + 2) + 2 * Math.sin(x * 0.29 + 0.7);
  for (let x = 0; x < 64; x++) {
    const top = Math.round(ridge(x));
    const lit = ridge(x + 1) < ridge(x - 1);
    for (let y = top; y < 46; y++) {
      let v = 0.45 - (y - top) * 0.025 + (lit ? 0.12 : 0) + (hash(x, y, 202) - 0.5) * 0.06;
      if (y === top) v += 0.2;
      p.set(x, y, pick(RIDGE, v, x, y));
    }
  }
  // chão de escória e terra batida, que esquenta perto do forno
  for (let y = 44; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const tex = (hash(x >> 1, y, 203) - 0.5) * 0.08 + (hash(x, y, 204) < 0.05 ? 0.12 : 0) - ((x * 3 + y * 7) % 11 === 0 ? 0.08 : 0);
      p.set(x, y, litStone(x, y, 0.2 + (y - 44) * 0.008, smeltLight(x, y, g) * (y > 55 ? 0.5 : 0.75), tex));
    }
  }
  // leito de areia: canal e moldes rebaixados, com a beirada da frente pegando luz
  const bank = (x, y, cool, k) => litStone(x, y, cool, smeltLight(x, y, g) * k);
  const inMetal = new Set(smeltMetal.map(([x, y]) => y * 64 + x));
  for (const [x, y] of smeltMetal) {
    for (const [dx, dy, cool, k] of [[0, -1, 0.04, 0.12], [0, 1, 0.3, 0.55], [-1, 0, 0.08, 0.2], [1, 0, 0.2, 0.35]]) {
      if (!inMetal.has((y + dy) * 64 + x + dx)) p.set(x + dx, y + dy, bank(x + dx, y + dy, cool, k));
    }
  }
  for (const [x, y] of smeltMetal) p.set(x, y, METAL[0]);
  return p;
}

function buildSmelter(g) {
  const p = new Pix(64, 64);
  // ponte de carga, do alto do forno até a encosta
  const deck = (x) => 13 + (x - 38) * 0.36;
  for (const x0 of [47, 57]) {
    p.rect(x0, Math.round(deck(x0)) + 2, 2, 52 - Math.round(deck(x0)), (x, y) =>
      pick(PAL.wood, (x === x0 ? 0.3 : 0.14) + smeltLight(x, y, g) * 0.6, x, y));
  }
  p.line(48, 30, 57, 46, PAL.wood[1]);
  p.line(48, 44, 57, 32, PAL.wood[1]);
  for (let x = 38; x < 64; x++) {
    const y = Math.round(deck(x));
    p.set(x, y, PAL.wood[x % 3 ? 3 : 2]);
    p.set(x, y + 1, PAL.wood[1]);
    p.set(x, y + 2, PAL.wood[0]);
    if (x % 6 === 2) for (let k = 1; k <= 4; k++) p.set(x, y - k, PAL.wood[k === 4 ? 3 : 2]);
    p.set(x, y - 4, PAL.wood[2]);
  }
  // torre do forno: pedra em fiadas, cinta de ferro, borda de cima
  p.fill(FX - 13, F_TOP, FX + 13, F_BASE - 1, (x, y) => Math.abs(x + 0.5 - FX) <= fHalf(y + 0.5), (x, y) => {
    const nx = (x + 0.5 - FX) / fHalf(y + 0.5);
    const row = Math.floor((y - F_TOP) / 4), ry = (y - F_TOP) % 4;
    const off = (row & 1) * 3;
    let tex = (hash(Math.floor((x + off) / 6), row, 205) - 0.5) * 0.1;
    if (ry === 3 || (x + off) % 6 === 0) tex -= 0.12;
    else if (ry === 0) tex += 0.05;
    const cool = 0.42 - nx * 0.2 + (nx < -0.8 ? 0.14 : 0) - (y - F_TOP) * 0.003;
    return litStone(x, y, cool, smeltLight(x, y, g) * 1.05 - (y < 20 ? 0.04 : 0), tex);
  });
  // fuligem no alto, onde a chama lambe
  p.fill(FX - 8, F_TOP, FX + 8, F_TOP + 6, (x, y) => Math.abs(x + 0.5 - FX) <= fHalf(y + 0.5) && hash(x, y, 206) < 0.55 - (y - F_TOP) * 0.08,
    (x, y) => pick(WARM, 0.08 + smeltLight(x, y, g) * 0.5, x, y));
  for (const yb of [23, 36]) {
    for (let y = yb; y < yb + 2; y++) {
      const hw = fHalf(y + 0.5);
      for (let x = Math.ceil(FX - hw - 0.6); x < FX + hw + 0.6; x++) {
        const nx = (x + 0.5 - FX) / hw;
        const l = smeltLight(x, y, g);
        const v = 0.12 + cylLight(nx) * 0.28 + (y === yb ? 0.12 : -0.08);
        const rivet = (x - Math.round(FX) + 64) % 4 === 0 && y === yb;
        p.set(x, y, l > 0.12 ? pick(WARM, v * 0.6 + l * 0.7 + (rivet ? 0.2 : 0), x, y) : pick(PAL.iron, v + (rivet ? 0.3 : 0), x, y));
      }
    }
  }
  p.rect(Math.round(FX - 8.5), F_TOP - 2, 18, 2, (x, y) => litStone(x, y, y === F_TOP - 2 ? 0.5 : 0.3, smeltLight(x, y, g) * 1.2 + (y === F_TOP - 2 ? 0.08 : 0)));
  p.rect(Math.round(FX - 6), F_TOP - 2, 12, 1, (x) => pick(WARM, 0.75 + g * 0.15, x, 0));

  // arco da boca de corrida: aduelas de pedra e o fundo em brasa
  const arch = (cx, rx, top, bottom) => (x, y) =>
    y <= bottom && ((Math.abs(x - cx) <= rx && y >= top + rx) || ((x - cx) / rx) ** 2 + ((y - top - rx) / rx) ** 2 <= 1);
  p.fill(24, 39, 39, F_BASE - 1, arch(FX, 6.6, 39, F_BASE), (x, y) => {
    const a = Math.atan2(y + 0.5 - 46, x + 0.5 - FX);
    const joint = Math.abs(Math.sin(a * 4.5)) < 0.18;
    return pick(WARM, 0.3 + smeltLight(x, y, g) * 0.55 - (joint ? 0.18 : 0) + (x < FX ? 0.06 : -0.04), x, y);
  });
  p.fill(25, 40, 38, F_BASE - 1, arch(FX, 5, 41, F_BASE), (x, y) => {
    const glow = clamp01(1 - Math.hypot(x + 0.5 - F_TAP[0], (y + 0.5 - F_TAP[1] - 1) * 1.1) / (6 + g * 2.5));
    return pick(METAL, glow * glow * (0.55 + g * 0.1) + (y > 52 ? 0.08 : 0), x, y, 1.6);
  });
  // bica de barro que leva o metal para fora
  p.poly([[28.5, 53], [34.5, 53], [33.5, 56], [29.5, 56]], (x, y) => pick(WARM, 0.5 + (x < 31 ? 0.15 : -0.05) - (y - 53) * 0.06 + g * 0.08, x, y));
  p.rect(30, 53, 3, 1, METAL[4]);
  p.rect(30, 50, 3, 2, (x, y) => METAL[x === 31 ? 7 : 6]);
  p.set(31, 49, METAL[5]); p.set(29, 51, METAL[4]); p.set(33, 51, METAL[4]); p.set(31, 52, METAL[5]);

  // fole: pé do banco e o poste da alavanca (as tábuas e o couro mexem por quadro)
  const [bx0, bx1, by0] = F_BELLOWS;
  p.rect(bx0, by0, bx1 - bx0 + 1, 2, (x, y) => pick(PAL.wood, (y === by0 ? 0.55 : 0.25) + smeltLight(x, y, g) * 0.5, x, y));
  for (const x of [bx0 + 1, bx1 - 2]) p.rect(x, by0 + 2, 2, F_BASE - by0 - 2, (xx, yy) => pick(PAL.wood, (xx === x ? 0.3 : 0.14) + smeltLight(xx, yy, g) * 0.5, xx, yy));
  p.rect(1, 30, 2, 26, (x, y) => pick(PAL.wood, (x === 1 ? 0.4 : 0.18) + smeltLight(x, y, g) * 0.4, x, y));
  // bocal de ferro entrando no forno
  p.rect(bx1, by0 - 2, 3, 2, (x, y) => pick(PAL.iron, y === by0 - 2 ? 0.55 : 0.25, x, y));

  // monte de minério de cobre e malaquita à direita
  const inPile = (x, y) => ((x - 58) / 8) ** 2 + ((y - 58) / 5.5) ** 2 <= 1 - hash(x >> 1, 0, 207) * 0.12;
  p.fill(49, 51, 63, 57, inPile, (x, y) => {
    const cx = Math.floor((x + (y >> 1)) / 2), cy = y >> 1;
    const h = hash(cx, cy, 208);
    const l = smeltLight(x, y, g) * 0.9;
    const edge = (x + (y >> 1)) % 2 === 0 && y % 2 === 0 ? -0.12 : 0.03;
    const v = 0.24 + sphereLight((x + 0.5 - 58) / 8, (y + 0.5 - 54) / 5) * 0.42 + edge;
    const fleck = hash(x, y, 209);
    if (fleck < 0.06) return ORE_GREEN[3];
    if (fleck < 0.13) return COPPER[l > 0.15 ? 4 : 3];
    return litStone(x, y, v, l * 0.8, edge);
  });
  // caixote com minério na ponte
  const cy0 = Math.round(deck(53));
  p.rect(50, cy0 - 4, 6, 4, (x, y) => pick(PAL.wood, (x === 50 ? 0.45 : 0.25) + (y === cy0 - 4 ? 0.15 : 0) + smeltLight(x, y, g) * 0.4 - (x === 53 ? 0.1 : 0), x, y));
  for (const [x, y, c] of [[50, -5, COPPER[3]], [51, -5, COOL_STONE[4]], [52, -6, COPPER[4]], [53, -5, ORE_GREEN[3]], [54, -6, COOL_STONE[3]], [55, -5, COPPER[2]], [53, -6, COOL_STONE[5]]]) p.set(x, cy0 + y, c);
  p.outline(PAL.out);
  return p;
}

// Fole com a alavanca. open: abertura da ponta solta, em pixels. Cada abertura
// (em quartos de pixel, que é o que muda no desenho) vira um sprite guardado.
const bellowsCache = new Map();
function paintBellows(f, open) {
  const key = Math.round(open * 4);
  let p = bellowsCache.get(key);
  if (!p) bellowsCache.set(key, p = buildBellows(key / 4));
  f.blit(p, 0, 24);
}

function buildBellows(open) {
  const p = new Pix(22, 34);
  const oy = 24;
  const [x0, x1, y0] = F_BELLOWS;
  const topY = (x) => y0 - 2 - open * (x1 - x) / (x1 - x0);
  // couro sanfonado: dobras que abrem em leque a partir da dobradiça
  p.fill(x0 - 1, y0 - 3 - open - oy, x1, y0 - 1 - oy, (x, y) => {
    const yy = y + oy;
    const bulge = x === x0 - 1 ? 1.2 : 0;
    return x >= x0 - 1 && yy > topY(x) + 0.5 + bulge && yy < y0 - bulge * 0.3;
  }, (x, y) => {
    const u = (y0 - (y + oy + 0.5)) / Math.max(1, y0 - topY(x));
    const rib = u * 3.2, fr = rib - Math.floor(rib);
    let v = 0.65 - (x1 - x) * 0.01 - (x === x0 - 1 ? 0.12 : 0);
    if (fr < 0.3) v -= 0.4;
    else if (fr > 0.68) v += 0.22;
    return pick(OXBLOOD, v, x, y);
  });
  // tábua de cima, com a pega na ponta
  for (let x = x0; x <= x1; x++) {
    const y = Math.round(topY(x)) - oy;
    p.set(x, y, PAL.wood[x < 10 ? 4 : 3]);
    p.set(x, y + 1, PAL.wood[2]);
  }
  const hy = Math.round(topY(x0)) - oy;
  p.rect(x0 - 2, hy, 3, 1, PAL.wood[3]);
  // vara presa na alavanca do poste
  const rx = 7, rodTop = topY(rx) - 10;
  const k = (rodTop - 30) / (rx - 2.5);
  const lever = (x) => 30 + k * (x - 2.5);
  p.line(rx, rodTop - oy, rx, topY(rx) - oy, PAL.iron[3]);
  p.line(rx + 1, rodTop + 1 - oy, rx + 1, topY(rx) - 1 - oy, PAL.iron[1]);
  p.line(1, lever(1) - oy, 14, lever(14) - oy, (x) => PAL.wood[x < 8 ? 4 : 3]);
  p.line(1, lever(1) + 1 - oy, 14, lever(14) + 1 - oy, PAL.wood[1]);
  p.set(2, 30 - oy, PAL.iron[4]);
  // pedra de contrapeso pendurada na ponta
  const sx = 14, sy = Math.round(lever(14)) + 2 - oy;
  p.set(sx, sy - 1, ROPE[2]);
  p.rect(sx - 1, sy, 3, 3, (x, y) => COOL_STONE[y === sy ? 5 : x === sx + 1 ? 2 : 3]);
  p.outline(PAL.out);
  return p;
}

const smelterArt = { base: null, halo: null, frame: new Pix(64, 64) };

function paintSmelterPortrait(ctx, t, info) {
  const a = smelterArt;
  if (!a.base) {
    const compose = (g) => buildSmelterBackdrop(g).blit(buildSmelter(g), 0, 0);
    a.base = compose(0);
    a.halo = makeHalo(a.base, compose(1), (x, y) =>
      Math.min(Math.hypot(x + 0.5 - F_TAP[0], y + 0.5 - F_TAP[1] - 4) / 36, Math.hypot(x + 0.5 - F_MOUTH[0], y + 0.5 - F_MOUTH[1]) / 26));
  }
  const working = info.working;
  const live = working ? 1 : 0.5;
  const w = working ? 2.6 : 1.2;
  const open = 4.2 + 2.8 * Math.sin(t * w);
  const push = clamp01(-Math.cos(t * w)) * live;   // o fole soprando
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 14.7 + 1) * 0.3 + Math.sin(t * 3.3) * 0.2;
  const f = a.frame.copyFrom(a.base);
  paintHalo(f, a.halo, 0.36 + push * 0.22 + flick * 0.05 + live * 0.08);
  // estrelas piscando
  for (let k = 0; k < 4; k++) {
    const s = pulse(t + k * 1.7, 3.1 + k * 0.7, 0.5);
    if (s > 0.3) f.set(Math.floor(hash(k, 3, 209) * 60) + 2, Math.floor(hash(k, 4, 209) * 22) + 2, s > 0.7 ? WHITE : C('#c8bce0'));
  }
  // fumaça subindo da boca, avermelhada embaixo pela chama
  for (let k = 0; k < 6; k++) {
    const s = (t * (working ? 0.14 : 0.09) + k / 6) % 1;
    const sx = F_MOUTH[0] + 1 + s * 30 + Math.sin(s * 5 + k) * 1.5, sy = 8 - s * 8 - Math.sin(s * 3) * 2, r = 2 + s * 3.6;
    paintPuff(f, sx, sy, r, s * 0.85, s < 0.3 ? [SMOKE[3], SMOKE[4], SMOKE[5]] : [SMOKE[2], SMOKE[3], SMOKE[4]], 1.5);
  }
  // chamas na boca de cima, que crescem quando o fole sopra
  const fl = 1 + push * 0.7;
  paintFlame(f, 27.5, F_TOP - 3, t, 4 * fl, 1.6, live, 1.3);
  paintFlame(f, 35.5, F_TOP - 3, t * 1.1, 4.5 * fl, 1.6, live, 2.1);
  paintFlame(f, 31.5, F_TOP - 3, t * 0.9, 7 * fl, 2.6, live, 0);
  // fagulhas subindo
  for (let k = 0; k < (working ? 9 : 4); k++) {
    const life = (t * (0.35 + hash(k, 1, 210) * 0.3) + hash(k, 2, 210)) % 1;
    const x = F_MOUTH[0] + (hash(k, 3, 210) - 0.5) * 8 + Math.sin(t * 2.3 + k * 1.7) * 2 * life + life * 5;
    f.set(x, F_TOP - 5 - life * 26, PAL.fire[life < 0.3 ? 5 : life < 0.7 ? 4 : 2]);
  }
  paintBellows(f, open);
  // metal derretido: filete caindo da bica e correndo pelo canal até os moldes
  for (let y = 56; y < F_RUNNER; y++) {
    for (const x of [31, 32]) f.set(x, y, pick(METAL, 0.9 + Math.sin(t * 9 - y * 1.7 + x) * 0.1, x, y));
  }
  for (const [x, y, heat] of smeltMetal) {
    const d = Math.abs(x - F_TAP[0]);
    const flow = Math.sin(t * (working ? 4 : 2) - d * 0.55) * 0.08;
    const crust = hash(x, y, 211) < 0.35 - heat * 0.4 ? -0.18 : 0;
    f.set(x, y, pick(METAL, 0.18 + heat * 0.66 + flow + crust + Math.sin(t * 1.3 + x * 0.7 + y) * 0.04, x, y, 1.8));
  }
  // brilho no metal perto da bica
  paintGlint(f, 32, F_RUNNER, pulse(t, working ? 1.6 : 3.2, 0.4), METAL);
  f.draw(ctx);
}

function smelterSilhouette() {
  const p = buildSmelter(0);
  paintBellows(p, 4);
  return p;
}

function iconSmelter() {
  const p = new Pix(16, 16);
  // torre de pedra afunilada, com cinta de ferro
  p.poly([[2.5, 16], [4.5, 3], [11.5, 3], [13.5, 16]], (x, y) => {
    let v = x < 6 ? 0.62 : x > 10 ? 0.22 : 0.42;
    if (y % 3 === 0) v -= 0.14;
    return pick(COOL_STONE, v + 0.15, x, y);
  });
  p.rect(4, 2, 8, 1, COOL_STONE[5]);
  p.rect(4, 7, 8, 1, (x) => PAL.iron[x < 7 ? 4 : 2]);
  // boca em arco, em brasa, e o metal escorrendo
  p.rect(6, 10, 4, 6, (x, y) => pick(METAL, 0.3 + (y - 10) * 0.1, x, y));
  p.set(6, 10, COOL_STONE[3]); p.set(9, 10, COOL_STONE[2]);
  p.rect(7, 12, 2, 4, (x) => METAL[x === 7 ? 7 : 6]);
  // chama no alto
  for (const [x, y, k] of [[6, 1, 3], [7, 1, 5], [8, 1, 4], [9, 1, 3], [7, 0, 4], [8, 0, 3], [10, 1, 2], [5, 1, 2]]) p.set(x, y, PAL.fire[k]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Capataz

const ROCK = ramp('#181412', '#28201b', '#3a2f27', '#504034', '#685442', '#826a52', '#a08668');
const FELT = ramp('#18140f', '#272017', '#3a3021', '#4f432e', '#67583c', '#82704c');
const BOOK = ramp('#1c090b', '#361014', '#54191c', '#762724', '#983a2e', '#b4523a');
const PAGES = ramp('#7e6e54', '#ae9c7a', '#d8caa6', '#f2e8ca');
const KERCHIEF = ramp('#121a30', '#1e2c4e', '#2e4474', '#44609a', '#6684bc');
const F_LANTERN = [11, 18];                     // chama da lanterna pendurada no esteio
const F_VP = [49, 31];                          // ponto de fuga da galeria, que entra para a direita

// Luz da lanterna; g = 0 apagada, 1 no máximo.
const lanternLight = (x, y, g) =>
  (0.45 + g * 0.35) * clamp01(1 - Math.hypot((x + 0.5 - F_LANTERN[0]) * 0.85, y + 0.5 - F_LANTERN[1]) / (22 + g * 9)) ** 1.5;

function buildForemanBackdrop(g) {
  const p = new Pix(64, 64);
  // encosta de rocha em camadas
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const s = (y + Math.sin(x * 0.3) * 1.2 + x * 0.12) / 5, c = Math.floor(s), fs = s - c;
      const block = Math.floor((x + c * 4) / 7);
      let v = 0.38 + (hash(block, c, 301) - 0.5) * 0.14 + lanternLight(x, y, g) * 0.6 - y * 0.002;
      if (fs < 0.2) v -= 0.16;
      else if ((x + c * 4) % 7 === 0) v -= 0.1;
      else if (fs > 0.8) v += 0.06;
      p.d[y * 64 + x] = pick(ROCK, v, x, y);
    }
  }
  // capim do barranco caindo por cima do quadro
  for (let x = 0; x < 64; x++) {
    const h = 1 + Math.floor(hash(x, 0, 312) * 3) + (Math.sin(x * 0.4) > 0.3 ? 1 : 0);
    for (let y = 0; y < h; y++) p.set(x, y, pick(PAL.grass, 0.65 - y * 0.15 + (hash(x, y, 313) - 0.5) * 0.2, x, y));
  }
  // galeria: escuridão que aprofunda até o ponto de fuga, com os quadros de escoramento
  const [vx, vy] = F_VP;
  p.fill(8, 9, 55, 63, () => true, (x, y) => {
    const dx = (x + 0.5 - vx) / (x < vx ? vx - 8 : 56 - vx), dy = (y + 0.5 - vy) / (y < vy ? vy - 9 : 64 - vy);
    const d = Math.max(Math.abs(dx), Math.abs(dy), 0.03);
    const z = 1 / d;
    const l = lanternLight(x, y, g) / (z * z);
    const ring = (z - 1) / 0.75, fr = ring - Math.floor(ring);
    const floor = dy > Math.abs(dx);
    if (!floor && fr < 0.3 && z < 7) {
      const side = Math.abs(dx) > Math.abs(dy);
      return pick(PAL.wood, 0.06 + 0.62 / (z * z) + l + (side && dx < 0 ? 0.06 : 0) + (fr < 0.1 ? 0.06 : -0.04), x, y);
    }
    let v = 0.02 + 0.46 / (z * z) + l * 0.9 + (hash(Math.floor(z * 3), Math.floor(Math.atan2(dy, dx) * 8), 302) - 0.5) * 0.1 / z;
    if (floor) v -= 0.04;
    return pick(ROCK, v, x, y, 1.6);
  });
  // trilhos sumindo no escuro
  for (const off of [-0.32, 0.12]) {
    for (let y = 40; y < 64; y++) {
      const d = (y + 0.5 - vy) / (64 - vy);
      const x = Math.round(vx + off * d * (vx - 8) * 1.6);
      if (x > 8 && x < 55) p.set(x, y, pick(PAL.iron, 0.12 + d * 0.5, x, y));
    }
  }
  // quadro de fora: esteios e chapéu de tronco
  for (const [x0, lit] of [[5, true], [55, false]]) {
    p.rect(x0, 9, 4, 55, (x, y) => {
      const nx = (x - x0) / 3;
      let v = (lit ? 0.62 : 0.32) - nx * 0.28 + (hash(x, y >> 2, 303) - 0.5) * 0.1 + lanternLight(x, y, g) * 0.5;
      if ((y + x0) % 11 === 0) v -= 0.18;
      return pick(PAL.wood, v, x, y);
    });
  }
  p.rect(2, 4, 61, 6, (x, y) => {
    let v = (y === 4 ? 0.8 : y === 9 ? 0.18 : 0.52 - (y - 5) * 0.06) + (hash(x >> 2, y, 304) - 0.5) * 0.1 + lanternLight(x, y, g) * 0.4;
    if ((x * 3 + y) % 13 === 0) v -= 0.14;
    return pick(PAL.wood, v, x, y);
  });
  for (const x of [2, 62]) p.rect(x, 4, 1, 6, PAL.wood[1]);
  // braço de ferro no esteio e a lanterna
  const [lx, ly] = F_LANTERN;
  p.line(7, 11, lx + 1, 11, PAL.iron[2]);
  p.line(7, 13, lx - 1, 11, PAL.iron[1]);
  p.rect(lx, 12, 1, 1, PAL.iron[2]);
  p.rect(lx - 1, 13, 3, 1, PAL.iron[2]);
  p.rect(lx - 2, 14, 5, 1, PAL.iron[1]);
  p.rect(lx - 2, 15, 5, 6, (x, y) => (x === lx - 2 || x === lx + 2 ? PAL.iron[x < lx ? 3 : 1] : pick(PAL.fire, 0.5 + g * 0.25 - Math.abs(x - lx) * 0.18 - Math.abs(y - 17.5) * 0.07, x, y)));
  p.rect(lx, 15, 1, 6, (x, y) => (y >= 16 && y <= 18 ? 0 : PAL.iron[1]));
  p.rect(lx - 2, 21, 5, 1, PAL.iron[1]);
  p.set(lx, 22, PAL.iron[0]);
  return p;
}

function inForemanHead(x, y) {
  const dy = (y - 33) / 12.6;
  const rx = dy > 0 ? 11.8 * (1 - 0.22 * dy * dy) : 11.8;
  return ((x - 32) / rx) ** 2 + dy * dy <= 1;
}

// Olhos miúdos debaixo das sobrancelhas. gaze: -1 esquerda, 0 frente, 1 direita.
function foremanEyes(p, closed, gaze) {
  for (const x0 of [26, 36]) {
    const left = x0 === 26;
    if (closed) {
      for (let i = 0; i < 3; i++) {
        p.set(x0 + i, 30, PAL.skin[left ? 3 : 2]);
        p.set(x0 + i, 31, PAL.hair[1]);
      }
      continue;
    }
    const ix = Math.max(0, Math.min(1, (left ? 1 : 0) + gaze));
    for (let i = 0; i < 3; i++) {
      const iris = i === ix || i === ix + 1;
      p.set(x0 + i, 30, iris ? (i === ix ? PAL.iris : PAL.irisHi) : PAL.eyeWhite);
      p.set(x0 + i, 31, iris ? PAL.iris : PAL.skin[left ? 2 : 1]);
    }
  }
}

// Bigode de morsa, castanho com mechas grisalhas; twitch ergue as pontas.
const STACHE = [[36, 28, 36], [37, 25, 39], [38, 23, 41], [39, 22, 42], [40, 22, 26], [40, 38, 42], [41, 22, 23], [41, 41, 42]];
function foremanStache(p, twitch) {
  for (const [y, a, b] of STACHE) {
    for (let x = a; x <= b; x++) {
      const tip = x < 25 || x > 39;
      const yy = y - (tip && twitch ? 1 : 0);
      const nx = (x + 0.5 - 32) / 10;
      let v = 0.66 - nx * 0.28 - (y - 36) * 0.1 - Math.abs(nx) * 0.12;
      if (x === 32 && y > 36) v -= 0.3;
      if (y > 37 && (x * 3 + y) % 7 === 0) v -= 0.16; // fios
      p.set(x, yy, pick(PAL.hair, v, x, yy, 2));
    }
  }
  for (const [x, y] of [[27, 37], [30, 36], [35, 37], [26, 38]]) p.set(x, y, C(x < 32 ? '#c4b8aa' : '#988c84'));
}

function buildForeman(twitch = false) {
  const p = new Pix(64, 64);
  const mx = (pts) => pts.map(([x, y]) => [64 - x, y]);
  // camisa de linho: ombros largos e mangas arregaçadas
  p.poly([[0, 64], [0, 55], [6, 49.5], [18, 46], [46, 46], [58, 49.5], [64, 55], [64, 64]], (x, y) => {
    const nx = (x + 0.5 - 32) / 32;
    return pick(PAL.linen, 0.62 - nx * 0.4 - (y - 48) * 0.012 + Math.sin(x * 0.7) * 0.05, x, y);
  });
  // colete de couro com costura e botões de latão
  const vestL = [[3, 64], [5, 55], [12, 50], [21, 47], [26, 47], [29.5, 55], [30, 64]];
  const vest = (bias) => (x, y) => {
    const nx = (x + 0.5 - 32) / 26;
    let v = 0.52 - nx * 0.38 + bias + (hash(x, y, 306) - 0.5) * 0.1;
    if ((x * 2 + y * 3) % 9 === 0) v -= 0.08;
    return pick(PAL.vest, v, x, y);
  };
  p.poly(vestL, vest(0.04));
  p.poly(mx(vestL), vest(-0.04));
  for (let y = 50; y < 64; y++) {
    p.set(Math.round(26 + (y - 47) * 0.22), y, PAL.vest[4]);
    p.set(Math.round(38 - (y - 47) * 0.22), y, PAL.vest[1]);
  }
  for (const y of [54, 58, 62]) {
    const x = Math.round(28.5 + (y - 47) * 0.1);
    p.set(x, y, PAL.gold[4]); p.set(x + 1, y, PAL.gold[2]);
  }
  // bolso com o apito pendurado num cordão
  p.rect(40, 56, 7, 1, PAL.vest[0]);
  p.rect(40, 57, 7, 4, (x, y) => PAL.vest[y === 57 ? 3 : 2]);
  p.line(36, 48, 42, 55, ROPE[2]);
  p.rect(41, 55, 4, 2, (x, y) => PAL.gold[y === 55 ? (x < 43 ? 5 : 4) : 2]);
  p.set(45, 56, PAL.gold[1]);
  // pescoço grosso
  p.rect(25, 40, 14, 8, (x, y) => pick(PAL.skin, (y < 46 ? 0.1 : 0.26) - (x - 30) * 0.02, x, y));
  // lenço azul amarrado no pescoço
  p.poly([[23, 46], [41, 46], [39, 49], [25, 49]], (x, y) => pick(KERCHIEF, 0.7 - (x - 24) * 0.03 - (y - 46) * 0.08, x, y));
  p.sphere(32, 48.5, 2.6, 2, KERCHIEF, 0.12);
  p.poly([[30, 49], [34, 49], [35, 54], [32, 53], [29, 55]], (x, y) => pick(KERCHIEF, 0.55 - (x - 30) * 0.06 - (y - 49) * 0.04, x, y));
  // orelhas
  p.sphere(20.2, 33, 2.2, 3.3, PAL.skin, 0.12);
  p.sphere(43.8, 33, 2.2, 3.3, PAL.skin, -0.1);
  p.set(20, 33, PAL.skin[1]);
  p.set(44, 33, PAL.skin[0]);
  // rosto largo e corado, com a sombra da aba
  p.fill(19, 20, 45, 46, inForemanHead, (x, y) => {
    let v = 0.4 + sphereLight((x + 0.5 - 32) / 11.8 * 0.8, (y + 0.5 - 33) / 12.6 * 0.45 - 0.15) * 0.66;
    if (y < 27) v -= 0.26 - (y - 23) * 0.04;
    if (y > 43) v -= 0.1;
    return pick(PAL.skin, v, x, y, 5);
  });
  // costeletas grisalhas debaixo do chapéu
  for (const [x0, d] of [[21, 1], [43, -1]]) {
    for (let y = 25; y <= 33; y++) {
      for (let k = 0; k < (y < 30 ? 2 : 1); k++) {
        const x = x0 + k * d;
        p.set(x, y, (y + k) % 3 === 0 ? C(d > 0 ? '#b0a498' : '#8a7e76') : PAL.hair[d > 0 ? 3 : 1]);
      }
    }
  }
  // bochechas coradas e o nariz de batata
  for (const [x, y] of [[24, 34], [25, 34], [26, 35], [25, 35]]) { p.set(x, y, PAL.blush); p.set(64 - x, y, PAL.blush); }
  for (const [x, y, k] of [[31, 30, 5], [31, 31, 5], [32, 31, 3], [31, 32, 4], [32, 32, 3], [33, 30, 2], [33, 31, 2], [33, 32, 2]]) p.set(x, y, PAL.skin[k]);
  p.sphere(32.3, 34.2, 2.5, 1.8, PAL.skin, 0.12, 4);
  p.set(31, 33, PAL.skin[5]); p.set(32, 35, PAL.blush); p.set(33, 35, PAL.blush);
  p.set(30, 35, PAL.skin[1]); p.set(31, 35, PAL.skin[0]); p.set(34, 35, PAL.skin[0]);
  // olheiras
  for (const x of [26, 27, 28]) { p.set(x, 32, PAL.skin[2]); p.set(x + 10, 32, PAL.skin[1]); }
  // rugas de quem fecha a cara
  p.set(31, 27, PAL.skin[2]); p.set(33, 27, PAL.skin[2]);
  p.set(24, 31, PAL.skin[2]); p.set(40, 31, PAL.skin[1]);
  // sobrancelhas grossas, franzidas
  for (const [x, y] of [[24, 29], [25, 28], [26, 28], [27, 28], [28, 28], [29, 29], [25, 29], [26, 29], [27, 29]]) {
    p.set(x, y, PAL.hair[y === 28 && x < 28 ? 3 : 1]);
    p.set(64 - x, y, PAL.hair[y === 28 && x < 28 ? 2 : 0]);
  }
  foremanEyes(p, false, 0);
  foremanStache(p, twitch);
  // lábio de baixo e queixo
  for (let x = 30; x <= 34; x++) p.set(x, 41, x === 30 || x === 34 ? PAL.skin[2] : PAL.lip);
  p.set(31, 41, C('#c06850'));
  p.set(31, 43, PAL.skin[3]); p.set(32, 43, PAL.skin[3]); p.set(33, 43, PAL.skin[2]);

  // lápis atrás da orelha
  p.line(42, 30, 46, 26, (x) => (x > 45 ? PAL.wood[4] : C('#d8a83a')));
  p.set(42, 30, PAL.iron[1]);

  // chapéu de feltro: aba larga, copa amassada no meio e fita com fivela
  p.ellipse(32, 23, 20.5, 4.4, (x, y) => {
    const nx = (x + 0.5 - 32) / 20.5;
    let v = y < 23 ? 0.6 - nx * 0.3 + (23 - y) * 0.03 : 0.2 - nx * 0.1 - (y - 23) * 0.05;
    if (hash(x, y, 307) < 0.08) v -= 0.1;
    if (x < 17 && y >= 22) v += 0.15; // lanterna batendo na aba
    return pick(FELT, v, x, y);
  });
  const crown = (x, y) => {
    const nx = (x - 32) / 10.6;
    if (y > 22 || y < 9) return false;
    const top = 10.5 + nx * nx * 3 + (Math.abs(x - 32) < 2.5 ? 1.2 - Math.abs(x - 32) * 0.3 : 0);
    return Math.abs(nx) <= 1 - (22 - y) * 0.006 && y >= top;
  };
  p.fill(20, 9, 44, 22, crown, (x, y) => {
    const nx = (x + 0.5 - 32) / 10.6;
    let v = 0.15 + cylLight(nx) * 0.75 + (Math.abs(x - 32) < 1.5 && y < 15 ? -0.3 : 0) - (y - 12) * 0.01;
    if (x === 33 || x === 34) v -= 0.08; // vinco
    if (hash(x, y, 308) < 0.06) v += 0.1;
    return pick(FELT, v, x, y);
  });
  p.fill(21, 18, 43, 21, (x, y) => crown(x, y) && y >= 18.5 && y < 21, (x, y) =>
    pick(PAL.leather, 0.15 + cylLight((x + 0.5 - 32) / 10.6) * 0.8 + (y === 18 ? 0.15 : 0), x, y));
  p.rect(37, 18, 3, 3, (x, y) => (x === 38 && y === 19 ? PAL.leather[1] : PAL.gold[x === 37 || y === 18 ? 4 : 2]));

  // braço com a manga arregaçada, apertando o livro contra o corpo
  p.poly([[0, 64], [0, 51], [5, 48.5], [9, 50], [9, 64]], (x, y) => pick(PAL.linen, 0.5 - (y - 50) * 0.012 + (x < 2 ? 0.12 : 0) - (x > 7 ? 0.15 : 0), x, y));
  // livro de contas grosso: capa de couro por cima, corte das folhas virado para a frente
  p.poly([[5, 49], [19, 48], [22, 51], [8, 52]], (x, y) => {
    let v = 0.62 - (x - 5) * 0.012 + (y === 48 || y === 49 ? 0.1 : 0);
    if ((x + y * 2) % 6 === 0) v -= 0.1;
    return pick(BOOK, v, x, y);
  });
  p.rect(8, 52, 14, 1, (x) => BOOK[x < 10 ? 4 : 3]);
  p.rect(8, 53, 14, 6, (x, y) => {
    let v = 0.8 - (x - 8) * 0.012 - (y - 53) * 0.03;
    if ((y - 53) % 2 === 1) v -= 0.22;
    return pick(PAGES, v, x, y);
  });
  p.rect(8, 59, 14, 1, (x) => BOOK[x < 10 ? 3 : 2]);
  p.rect(22, 52, 1, 8, (x, y) => BOOK[y < 54 ? 2 : 1]);
  // cantoneiras de latão, fita marcadora e a mão por baixo
  for (const [x, y, k] of [[8, 52, 5], [9, 52, 4], [21, 52, 3], [22, 52, 2], [8, 59, 3], [21, 59, 2], [19, 48, 4], [20, 49, 3]]) p.set(x, y, PAL.gold[k]);
  for (const [x, y] of [[15, 59], [15, 60], [16, 61], [15, 62]]) p.set(x, y, C('#b83a34'));
  for (const [x, y, k] of [[9, 60, 3], [10, 60, 3], [11, 60, 2], [12, 60, 2], [10, 61, 2], [11, 61, 1], [12, 61, 1], [13, 60, 1]]) p.set(x, y, PAL.skin[k]);
  p.outline(PAL.out);
  return p;
}

const foremanArt = { bg: null, halo: null, body: null, twitch: null, frame: new Pix(64, 64) };

function paintForemanPortrait(ctx, t, info) {
  const a = foremanArt;
  if (!a.bg) {
    a.bg = buildForemanBackdrop(0);
    a.halo = makeHalo(a.bg, buildForemanBackdrop(1), (x, y) => Math.hypot(x + 0.5 - F_LANTERN[0], y + 0.5 - F_LANTERN[1]) / 34);
    a.body = buildForeman();
    a.twitch = buildForeman(true); // bigode com as pontas erguidas
  }
  const working = info.working;
  const live = working ? 1 : 0.6;
  const f = a.frame.copyFrom(a.bg);
  const flick = Math.sin(t * 8.3) * 0.5 + Math.sin(t * 13.1 + 1) * 0.3 + Math.sin(t * 2.9) * 0.2;
  paintHalo(f, a.halo, 0.4 + live * 0.12 + flick * 0.06);
  // chama da vela dentro da lanterna
  const [lx, ly] = F_LANTERN;
  const fh = 2.6 + Math.sin(t * 9.7) * 0.5 + flick * 0.3;
  for (let k = 0; k < fh; k++) f.set(lx + (k > 1 ? Math.round(Math.sin(t * 7) * 0.6) : 0), ly + 1 - k, PAL.fire[k < 1 ? 5 : k < 2 ? 4 : 3]);
  // poeira dançando na luz
  for (let k = 0; k < (working ? 8 : 4); k++) {
    const life = (t * (0.05 + hash(k, 1, 311) * 0.05) + hash(k, 2, 311)) % 1;
    const x = 2 + hash(k, 3, 311) * 18 + Math.sin(t * 0.8 + k * 2.1) * 2;
    const y = 12 + life * 34 + Math.sin(t * 1.3 + k) * 1.5;
    f.set(x, y, life > 0.15 && life < 0.85 ? PAL.fire[4] : PAL.fire[3]);
  }
  // bigode mexendo de vez em quando
  const twitch = working ? t % 3.7 > 3.45 : t % 7.1 > 6.9;
  f.blit(twitch ? a.twitch : a.body, 0, 0);
  // piscar e olhar de lado conferindo o serviço
  const blink = t % 4.9 > 4.76 || t % 11.3 > 11.16;
  const g = Math.sin(t * 0.5 + 0.7);
  const gaze = working ? (g > 0.7 ? 1 : g < -0.75 ? -1 : 0) : 0;
  if (blink || gaze) foremanEyes(f, blink, gaze);
  // brilho no apito e na fivela
  paintGlint(f, 42, 55, pulse(t, working ? 3.1 : 5.3, 0.5) * 0.9);
  paintGlint(f, 37, 18, pulse(t + 1.9, 6.1, 0.45) * 0.6);
  f.draw(ctx);
}

function iconForeman() {
  const p = new Pix(16, 16);
  p.sphere(8, 9.5, 4.6, 4.6, PAL.skin, 0.2);
  p.set(6, 9, PAL.iris); p.set(10, 9, PAL.iris);
  for (let x = 5; x <= 8; x++) p.set(x, 8, PAL.hair[1]);
  for (let x = 9; x <= 11; x++) p.set(x, 8, PAL.hair[1]);
  // bigode farto
  for (const [x, y, k] of [[5, 12, 3], [6, 11, 3], [7, 11, 3], [8, 11, 2], [9, 11, 2], [10, 11, 2], [11, 12, 1], [4, 13, 2], [12, 13, 1], [6, 12, 2], [10, 12, 1]]) p.set(x, y, PAL.hair[k]);
  p.set(8, 10, C('#d0705a'));
  // chapéu de feltro
  p.rect(1, 6, 14, 2, (x, y) => FELT[y === 6 ? (x < 8 ? 5 : 4) : 2]);
  p.fill(3, 1, 13, 6, (x, y) => Math.abs(x - 8) < 4.6 && y >= 1.5 + (Math.abs(x - 8) < 1.5 ? 0.8 : 0), (x) => FELT[x < 7 ? 4 : x < 10 ? 3 : 2]);
  p.rect(4, 4, 8, 1, PAL.leather[2]);
  p.set(10, 4, PAL.gold[4]);
  // lenço azul
  p.rect(5, 14, 6, 2, (x) => KERCHIEF[x < 8 ? 4 : 3]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Poço

const AFTERNOON = ramp('#3c5c96', '#4e70a6', '#6686b4', '#849ec0', '#a4b4c4', '#c6c2bc', '#e4d0ae');
const PEAK = ramp('#262234', '#38304a', '#4e445a', '#685a68', '#847274', '#a28e84', '#c4ac98');
const SNOW = ramp('#76829e', '#9eaac2', '#c8d2e0', '#eef2f6');
const FAR_PEAK = ramp('#4e5e86', '#62729a', '#7a88aa', '#96a2b8');
const PENNANT = ramp('#3c0e14', '#6a1a20', '#a02a2c', '#cc4a3a', '#e86e4e');

const S_FEET = 55;                            // chão onde pisam o sarilho e o mineiro
const S_SHEAVE = [33, 6], S_SR = 4.6;         // roldana no alto
const S_ROPE_X = 38;                          // cabo que desce no poço
const S_DRUM = [4, 13, 46];                   // sarilho: x inicial, x final, y do eixo
const S_LIP = 58;                             // beirada da frente da boca do poço
const S_HOOK_HIGH = 15, S_HOOK_LOW = 60;      // altura da alça do balde no alto e no fundo
const legL = (y) => 22 + (60 - y) * (8 / 49);  // perna esquerda do cavalete
const legR = (y) => 51 - (60 - y) * (8 / 49);

function buildShaftBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 44, AFTERNOON, 1.6);
  paintSun(p, 9, 12, 3.5);
  // serra distante, azulada
  for (let x = 0; x < 64; x++) {
    const top = Math.round(24 + Math.abs(((x - 8) % 26) - 13) * 0.6 + Math.sin(x * 0.7) * 0.8);
    for (let y = top; y < 44; y++) p.set(x, y, pick(FAR_PEAK, 0.6 - (y - top) * 0.03 + (x % 26 < 13 ? 0.1 : -0.05), x, y));
  }
  // o pico grande, com neve e as ravinas descendo
  const peakX = 53, peakY = 3;
  const edgeL = (y) => peakX - (y - peakY) * 0.95 + Math.sin(y * 0.9) * 0.8;
  const edgeR = (y) => peakX + (y - peakY) * 0.9 + Math.sin(y * 1.1 + 1) * 0.8;
  p.fill(0, peakY, 63, 44, (x, y) => x >= edgeL(y) && x <= edgeR(y), (x, y) => {
    const ridge = peakX + (y - peakY) * 0.15 + Math.sin(y * 0.5) * 1.2;
    const lit = x < ridge;
    const gully = Math.sin((x - ridge) * (lit ? 0.9 : 0.7) + y * 0.5) > 0.7;
    const snowLine = 14 + Math.sin(x * 0.8) * 2 + (lit ? 0 : -2) + hash(x, 0, 401) * 2;
    if (y < snowLine && !(gully && y > snowLine - 4)) {
      return pick(SNOW, (lit ? 0.85 : 0.35) - (y - peakY) * 0.01 + (gully ? -0.2 : 0), x, y);
    }
    let v = (lit ? 0.62 : 0.3) - (y - 15) * 0.008 + (hash(x >> 1, y >> 1, 402) - 0.5) * 0.12;
    if (gully) v -= 0.16;
    if (lit && x < edgeL(y) + 1.5) v += 0.12;
    return pick(PEAK, v, x, y);
  });
  // mata de pinheiros na encosta
  for (let x = -2; x < 66; x += 3) {
    const h = 5 + Math.floor(hash(x, 1, 403) * 5), base = 45 + Math.floor(hash(x, 2, 403) * 2);
    const cx = x + hash(x, 3, 403) * 2;
    for (let k = 0; k < h; k++) {
      const half = (k / h) * 2.4 + 0.3;
      for (let px = Math.floor(cx - half); px <= cx + half; px++) {
        const y = base - h + k;
        p.set(px, y, pick(PAL.tree, (px < cx ? 0.55 : 0.25) - k * 0.02 + ((k + px) % 3 === 0 ? -0.1 : 0), px, y));
      }
    }
  }
  // chão: capim alto nas bordas e terra batida em volta do poço
  for (let y = 44; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const yard = ((x - 36) / 26) ** 2 + ((y - 62) / 13) ** 2 < 1;
      if (yard) {
        let v = 0.55 + (hash(x >> 1, y, 405) - 0.5) * 0.2 + (y - 44) * 0.008;
        if (hash(x, y, 406) < 0.05) v -= 0.25;
        p.set(x, y, pick(PAL.dirt, v, x, y));
      } else {
        let v = 0.5 + (hash(x, y, 407) - 0.5) * 0.25 + (y - 44) * 0.01;
        if ((x * 3 + y * 5) % 11 === 0) v -= 0.15;
        p.set(x, y, pick(PAL.grass, v, x, y, 1.6));
      }
    }
  }
  // sombra do cavalete no chão
  p.fill(20, 58, 60, 62, (x, y) => ((x - 42) / 18) ** 2 + ((y - 60) / 1.8) ** 2 <= 1, (x, y) => pick(PAL.dirt, 0.2 + (hash(x, y, 408) - 0.5) * 0.1, x, y));
  return p;
}

// Boca do poço: escoramento de toras em quadro e o buraco escuro, com luz de tocha bem no fundo.
function paintShaftCollar(p, front) {
  const x0 = 31, x1 = 45, yb = 52, yf = S_LIP;
  const log = (x, y, lit) => pick(PAL.wood, (lit ? 0.62 : 0.32) + (hash(x >> 1, y, 409) - 0.5) * 0.12 - ((x + y) % 5 === 0 ? 0.12 : 0), x, y);
  if (!front) {
    p.rect(x0 + 2, yb + 2, x1 - x0 - 3, yf - yb - 2, (x, y) => {
      const depth = (y - yb - 2) / (yf - yb - 2);
      const glow = clamp01(1 - Math.hypot(x + 0.5 - 39, (y + 0.5 - yf) * 2) / 3.5);
      if (glow > 0.25 + (bayer(x, y) - 0.5) * 0.3) return PAL.fire[glow > 0.6 ? 2 : 1];
      return pick(ROCK, 0.34 - depth * 0.7 + (hash(x, y, 414) - 0.5) * 0.08, x, y);
    });
    for (let y = yb + 2; y < yf; y++) {
      p.set(x0 + 3, y, PAL.wood[2]); p.set(x0 + 5, y, PAL.wood[1]);
      if (y % 2 === 0) p.set(x0 + 4, y, PAL.wood[3]);
    }
    p.rect(x0, yb, x1 - x0 + 1, 2, (x, y) => log(x, y, y === yb));
    p.rect(x0, yb, 2, yf - yb, (x, y) => log(x, y, x === x0));
    p.rect(x1 - 1, yb, 2, yf - yb, (x, y) => log(x, y, false));
    return;
  }
  p.rect(x0 - 1, yf, x1 - x0 + 3, 3, (x, y) => (y === yf + 2 ? PAL.wood[1] : log(x, y, y === yf)));
  for (const x of [x0 - 1, x1 + 1]) p.set(x, yf + 1, LIME[4]);
}

function buildShaft() {
  const p = new Pix(64, 64);
  // monte de entulho à direita
  p.fill(48, 44, 63, 58, (x, y) => ((x - 60) / 12) ** 2 + ((y - 58) / 12) ** 2 <= 1 - hash(x >> 1, 0, 410) * 0.1, (x, y) => {
    const cell = hash((x + (y >> 1)) >> 1, y >> 1, 411);
    let v = 0.25 + sphereLight((x + 0.5 - 60) / 12, (y + 0.5 - 52) / 9) * 0.55 + ((x + (y >> 1)) % 2 === 0 && y % 2 === 0 ? -0.14 : 0);
    if (cell < 0.1) return pick(COPPER, v + 0.1, x, y);
    return pick(PEAK, v + (cell - 0.5) * 0.15, x, y);
  });
  // sarilho de mão: dois cavaletes e o tambor com o cabo enrolado
  const [d0, d1, dy] = S_DRUM;
  for (const x of [d0 - 1, d1 + 1]) {
    p.line(x - 2, S_FEET, x, dy, PAL.wood[2]);
    p.line(x + 2, S_FEET, x, dy, PAL.wood[1]);
  }
  p.rect(d0, dy - 2, d1 - d0 + 1, 5, (x, y) => {
    const ny = (y + 0.5 - dy - 0.5) / 2.6;
    const v = 0.1 + sphereLight(0, ny) * 0.75;
    if (x > d0 + 2 && x < d1 - 1) return pick(ROPE, v - (x % 2 === 0 ? 0.18 : 0), x, y); // voltas do cabo
    return pick(PAL.wood, v - 0.05, x, y);
  });
  for (const x of [d0, d1]) p.rect(x, dy - 3, 1, 7, (xx, yy) => PAL.wood[yy < dy ? 3 : 1]);
  // cavalete do poço: duas pernas, travessas, mão-francesa e o chapéu
  for (const [leg, lit] of [[legL, true], [legR, false]]) {
    for (let y = 9; y <= 60; y++) {
      const x = Math.round(leg(y));
      p.set(x, y, PAL.wood[lit ? 4 : 2]);
      p.set(x + 1, y, PAL.wood[lit ? 2 : 1]);
    }
  }
  for (const y of [31, 48]) {
    p.rect(Math.round(legL(y)) + 1, y, Math.round(legR(y) - legL(y)) - 1, 2, (x, yy) =>
      pick(PAL.wood, (yy === y ? 0.62 : 0.3) - (x - 30) * 0.004 + (hash(x >> 2, yy, 412) - 0.5) * 0.1, x, yy));
  }
  p.line(legL(33) + 1, 33, legR(47) - 1, 47, PAL.wood[2]);
  p.line(legR(33) - 1, 33, legL(47) + 1, 47, PAL.wood[3]);
  p.rect(26, 9, 23, 3, (x, y) => pick(PAL.wood, (y === 9 ? 0.78 : y === 10 ? 0.5 : 0.22) + (hash(x >> 2, y, 413) - 0.5) * 0.1, x, y));
  // mancais e aro da roldana (os raios giram por quadro)
  const [sx, sy] = S_SHEAVE;
  p.fill(sx - S_SR - 1, sy - S_SR - 1, sx + S_SR + 1, sy + S_SR + 1, (x, y) => {
    const d = Math.hypot(x - sx - 0.5, y - sy - 0.5);
    return d <= S_SR && d >= S_SR - 1.4;
  }, (x, y) => pick(PAL.iron, 0.25 + sphereLight((x + 0.5 - sx - 0.5) / S_SR, (y + 0.5 - sy - 0.5) / S_SR) * 0.7, x, y));
  p.rect(sx - 1, sy + 1, 3, 2, (x, y) => PAL.wood[y === sy + 1 ? 3 : 2]);
  p.rect(sx - 2, sy + 3, 5, 1, PAL.wood[3]);
  // mastro da flâmula
  p.rect(26, 0, 1, 10, (x, y) => PAL.wood[y < 3 ? 4 : 3]);
  // cabo da roldana até o sarilho
  p.line(sx - S_SR + 0.5, sy + 1, (d0 + d1) / 2 + 2, dy - 3, (x, y) => ROPE[(x + y) % 3 ? 3 : 2]);
  paintShaftCollar(p, false);
  p.outline(PAL.out);
  return p;
}

// Balde de minério com alça: madeira, cintas de ferro e pedras com cobre e gemas.
function buildOreBucket() {
  const p = new Pix(11, 12);
  p.line(1, 4, 5, 0, PAL.iron[2]);
  p.line(9, 4, 5, 0, PAL.iron[1]);
  p.fill(1, 4, 9, 11, (x, y) => Math.abs(x + 0.5 - 5) <= 4 - (y - 4) * 0.12, (x, y) => {
    let v = 0.2 + cylLight((x + 0.5 - 5) / 4) * 0.7;
    if (x % 2 === 0) v -= 0.1;
    if (y === 6 || y === 10) return pick(PAL.iron, v + 0.1, x, y);
    return pick(PAL.wood, v, x, y);
  });
  // minério por cima da borda
  for (const [x, y, c] of [[2, 4, PEAK[5]], [3, 3, PEAK[4]], [4, 3, COPPER[4]], [5, 3, PEAK[3]], [6, 2, PEAK[5]], [7, 3, COPPER[3]], [8, 4, PEAK[3]],
    [3, 4, PEAK[2]], [5, 4, COPPER[2]], [6, 3, C('#7ad0e8')], [7, 4, PEAK[2]], [4, 4, PEAK[4]]]) p.set(x, y, c);
  p.outline(PAL.out);
  return p;
}

// Flâmula presa no mastro, ondulando.
function paintPennant(f, t, amp) {
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    const wy = Math.sin(t * 5 - i * 0.8) * amp * u;
    const half = 1.6 * (1 - u) + 0.4;
    for (let k = -Math.ceil(half); k <= Math.ceil(half); k++) {
      if (Math.abs(k) > half) continue;
      const y = Math.round(2 + wy + k);
      const c = Math.abs(k) >= half - 0.5 ? PAL.out : PENNANT[Math.cos(t * 5 - i * 0.8) > 0 ? 4 : 2];
      f.set(25 - i, y, c);
    }
  }
}

// Mineiro girando a manivela, virado para a esquerda; pés em (x, y).
function paintCranker(f, x, y, hy) {
  const p = tinyPix.clear();
  const fx = 6, fy = 12;
  p.set(fx - 1, fy, PAL.leather[1]); p.set(fx + 1, fy, PAL.leather[1]);
  p.set(fx - 1, fy - 1, PAL.wood[2]); p.set(fx + 1, fy - 1, PAL.wood[2]);
  p.rect(fx - 1, fy - 2, 3, 1, PAL.wood[2]);
  p.rect(fx - 1, fy - 3, 3, 1, PAL.leather[2]);
  p.rect(fx - 1, fy - 6, 3, 3, (xx, yy) => (xx === fx - 1 ? PAL.band[3] : PAL.band[yy === fy - 6 ? 2 : 1]));
  p.rect(fx - 1, fy - 8, 2, 2, (xx) => PAL.skin[xx === fx - 1 ? 3 : 2]);
  p.rect(fx - 1, fy - 9, 3, 1, PAL.hair[2]);
  p.set(fx + 1, fy - 8, PAL.hair[1]);
  // braços até a manivela
  const hx = fx - 4, hyl = hy - (y - fy);
  p.line(fx - 1, fy - 5, hx, hyl, PAL.skin[2]);
  p.set(hx, hyl, PAL.skin[3]);
  p.outline(PAL.out);
  f.blit(p, x - fx, y - fy);
}

// Peça da frente: tora da boca e o chão logo abaixo, que escondem o balde no fundo.
function buildShaftFront(bg) {
  const p = new Pix(64, 64);
  paintShaftCollar(p, true);
  p.outline(PAL.out);
  if (bg) for (let y = S_LIP + 4; y < 64; y++) for (let x = 28; x < 51; x++) p.set(x, y, bg.get(x, y));
  return p;
}

const shaftArt = { bg: null, body: null, front: null, bucket: null, clouds: null, frame: new Pix(64, 64) };

// Raios da roldana, manivela, mineiro, cabo e balde. lift: 0 = balde no fundo, 1 = no alto.
function paintShaftMoving(f, a, lift, t) {
  const [sx, sy] = S_SHEAVE;
  const travel = (S_HOOK_LOW - S_HOOK_HIGH) * lift;
  const ang = travel / S_SR;
  for (let i = 0; i < 3; i++) {
    const s = ang + (i * Math.PI) / 3;
    const cx = Math.cos(s) * (S_SR - 1.2), cy = Math.sin(s) * (S_SR - 1.2);
    f.line(sx + 0.5 - cx, sy + 0.5 - cy, sx + 0.5 + cx, sy + 0.5 + cy, PAL.iron[i ? 2 : 3]);
  }
  f.set(sx, sy, PAL.iron[4]);
  // manivela do sarilho: o cabo de mão sobe e desce enquanto gira
  const [d0, d1, dy] = S_DRUM;
  const crank = -travel / 1.6;
  const hx = d1 + 2, hy = Math.round(dy + 0.5 + Math.sin(crank) * 2.6);
  f.line(d1 + 1, dy, hx, hy, PAL.iron[2]);
  f.set(hx, hy, PAL.wood[4]);
  for (let x = d0 + 1; x < d1; x += 3) f.set(x, Math.round(dy + 0.5 + Math.sin(crank + x) * 1.8), ROPE[0]);
  paintCranker(f, hx + 4, S_FEET, hy);
  // cabo e balde
  const hk = Math.round(S_HOOK_LOW - travel);
  const bx = S_ROPE_X + Math.round(Math.sin(t * 1.7) * lift * (1 - lift) * 2);
  f.line(S_ROPE_X, sy + 2, bx, hk, (x, y) => ROPE[y % 3 ? 3 : 2]);
  f.blit(a.bucket, bx - 5, hk);
  f.blit(a.front, 0, 0);
}

function paintShaftPortrait(ctx, t, info) {
  const a = shaftArt;
  if (!a.bg) {
    a.bg = buildShaftBackdrop();
    a.body = buildShaft();
    a.front = buildShaftFront(a.bg);
    a.bucket = buildOreBucket();
    a.clouds = [makeCloud(18, 7, 41), makeCloud(13, 6, 43)];
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 1.2) % 86) - 20), 8);
  f.blit(a.clouds[1], Math.floor(((t * 0.8 + 40) % 80) - 14), 20);
  // ave de rapina planando perto do pico
  const ph = t * 0.3;
  const ex = Math.round(46 + Math.cos(ph) * 10), ey = Math.round(16 + Math.sin(ph) * 3);
  const flap = Math.sin(t * 2) > 0.85 ? -1 : 0;
  for (const [dx, dy] of [[0, 0], [-1, flap], [1, flap], [-2, flap], [2, flap], [-3, 1 + flap], [3, 1 + flap]]) f.set(ex + dx, ey + dy, C('#2a2230'));
  f.blit(a.body, 0, 0);
  paintPennant(f, t, working ? 1.6 : 1);
  const lift = liftCycle(t / (working ? 6.5 : 11));
  paintShaftMoving(f, a, lift, t);
  // brilho da gema no balde quando ele chega em cima
  if (lift > 0.9) {
    const hk = Math.round(S_HOOK_LOW - (S_HOOK_LOW - S_HOOK_HIGH) * lift);
    paintGlint(f, S_ROPE_X + 1, hk + 3, pulse(t, 1.9, 0.5), ramp('#1a5a7a', '#3aa0c8', '#7ad0e8', '#d8f6ff'));
  }
  f.draw(ctx);
}

function shaftSilhouette() {
  const p = buildShaft();
  const a = { bucket: buildOreBucket(), front: buildShaftFront(null) };
  paintShaftMoving(p, a, 0.7, 0);
  paintPennant(p, 0.4, 1);
  return p;
}

function iconShaft() {
  const p = new Pix(16, 16);
  // cavalete em A com a roldana no alto
  p.line(2, 15, 6, 4, (x) => PAL.wood[x < 4 ? 4 : 3]);
  p.line(13, 15, 9, 4, PAL.wood[2]);
  p.line(3, 15, 7, 4, PAL.wood[2]);
  p.line(4, 10, 11, 10, PAL.wood[3]);
  p.rect(3, 4, 10, 1, PAL.wood[4]);
  p.fill(4, 0, 12, 5, (x, y) => {
    const d = Math.hypot(x - 8, y - 2.5);
    return d <= 2.8 && d >= 1.6;
  }, (x, y) => PAL.iron[x < 8 ? 4 : 2]);
  p.set(7, 2, PAL.iron[3]);
  // cabo e balde de minério
  p.line(10, 3, 10, 9, ROPE[3]);
  p.rect(8, 10, 5, 4, (x, y) => (y === 12 ? PAL.iron[2] : PAL.wood[x < 10 ? 4 : 2]));
  p.set(9, 9, COPPER[4]); p.set(11, 9, PEAK[5]); p.set(10, 9, C('#7ad0e8'));
  // boca do poço
  p.rect(5, 14, 7, 2, (x) => (x === 5 || x === 11 ? PAL.wood[3] : C('#0e0a08')));
  p.outline(PAL.out);
  return p;
}

ART.portraits.quarry = paintQuarryPortrait;
ART.portraits.smelter = paintSmelterPortrait;
ART.portraits.foreman = paintForemanPortrait;
ART.portraits.shaft = paintShaftPortrait;
ART.locked.quarry = ART.silhouette(quarrySilhouette);
ART.locked.smelter = ART.silhouette(smelterSilhouette);
ART.locked.foreman = ART.silhouette(() => buildForeman());
ART.locked.shaft = ART.silhouette(shaftSilhouette);
ART.icons.quarry = iconQuarry;
ART.icons.smelter = iconSmelter;
ART.icons.foreman = iconForeman;
ART.icons.shaft = iconShaft;
})();
