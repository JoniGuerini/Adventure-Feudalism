'use strict';
// Linha da alquimia, tiers 3 a 6: Mosteiro (abre boticas), Destilaria (sustenta
// mosteiros), Alquimista (monta destilarias) e Laboratório (forma alquimistas).
// Retratos animados, silhuetas bloqueadas e ícones.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun, makeCloud } = ART;

const MOSS = ramp('#16261a', '#22381f', '#2f4d26', '#43662f', '#5e8239');
const SLATE = ramp('#1a1e28', '#29303c', '#3a4450', '#505c66', '#6a7880', '#8c9a9c');
const HABIT = ramp('#1a0f0a', '#2e1b12', '#48301e', '#634229', '#805837', '#9e7046');
const BRONZE = ramp('#2a1a0a', '#4e3214', '#7a5222', '#a87834', '#d0a24c', '#f0d282');
const COPPER = ramp('#260c08', '#4e170d', '#7e2a15', '#ac4520', '#d26a30', '#ec9a56', '#ffd6a0');
const CHAMOMILE = C('#f6f2e2');
const CALENDULA = ramp('#a8460e', '#e07a1c', '#f4a83a');
const SAGE = ramp('#2e3a30', '#46584a', '#62786a', '#86998a');
const DOVE = ramp('#4a4656', '#7c7888', '#c4c0c8', '#f6f4f0');
const SAGE_BUSH = ramp('#1e3024', '#30483a', '#4a6652', '#6c8a72', '#98b49a');
const GALLERY = ramp('#15111a', '#211a24', '#2e2530', '#3e333c');
const CELLAR = ramp('#110c12', '#1a141b', '#251c25', '#33272f', '#43343a', '#574546', '#6f5a54', '#8a7262');
const BRICK = ramp('#2a1210', '#46201a', '#682e22', '#8a402c', '#a85638', '#c4724a');
const GLASSY = ramp('#202c34', '#34484e', '#56747a', '#86aaa8', '#c4e0d8', '#f0fff6');
const LIQ = ramp('#0e3a22', '#1a6436', '#2c9648', '#5cc85e', '#a4ec84', '#e4ffc4');
const ROBE = ramp('#1a1030', '#291a48', '#3a2862', '#50397e', '#684e9a', '#8468b4');
const BEARD_W = ramp('#4a4452', '#6e6876', '#9a94a0', '#c4c0c6', '#e6e2e2', '#fbf9f4');
const PANEL = ramp('#120c10', '#1b1218', '#251a20', '#32232a', '#422f34', '#553e40');
const WAX = ramp('#8a7458', '#c4ae86', '#e8dab4', '#fbf3dc');
const CANDLE_GLOW = [C('#4e3226'), C('#7e5234')];
const SMOKE = [ramp('#2e6a4a', '#5aae78', '#b6f0c4'), ramp('#4b3474', '#8a6cc0', '#ddd0f4'), ramp('#7a2a5a', '#c45a8e', '#f8c4dc')];
const LOG_END = C('#c9a070');
const STEAM = ramp('#8ea6bb', '#d6e1e4', '#fffdf6');
const LAB_WALL = ramp('#0e0b14', '#16111e', '#1f1829', '#2a2135', '#362b43', '#443652', '#554464');
const LAB_WALL_G = ramp('#0b120f', '#111c17', '#182820', '#20362a', '#2a4636', '#365a44', '#467054');
const DUSK_SKY = ramp('#141034', '#1e1848', '#2c2262', '#40307a', '#5c4290', '#f6eeff');
const POT = ramp('#0b0a0e', '#16141c', '#222029', '#302e38', '#46444e', '#625f68');
const PINK = ramp('#4a1036', '#8a1e5a', '#c43a7e', '#ec70a8', '#ffb6d6');
const GLASS = [C('#3fb8a8'), C('#c8406e'), C('#86c84a'), C('#e0a43a'), C('#6a7ad8')];
const GLASS_DARK = [C('#1e6a62'), C('#7a2244'), C('#4a7a28'), C('#8a5a1c'), C('#3a4486')];
const WHITE = C('#ffffff');

// ---------------------------------------------------------------------------
// Peças comuns

const archTest = (cx, rx, top, bottom) => (x, y) =>
  y <= bottom && ((Math.abs(x - cx) <= rx && y >= top + rx) || ((x - cx) / rx) ** 2 + ((y - top - rx) / rx) ** 2 <= 1);

// Alvenaria: ajuste de tom de um bloco (junta escura, aresta de cima clara, variação por bloco).
function masonry(x, y, bw, bh, seed, oy = 0) {
  const ry = (((y - oy) % bh) + bh) % bh;
  const row = Math.floor((y - oy) / bh), off = (row & 1) * (bw >> 1);
  if (ry === bh - 1 || (x + off) % bw === 0) return -0.17;
  return (hash(Math.floor((x + off) / bw), row, seed) - 0.5) * 0.16 + (ry === 0 ? 0.06 : 0);
}

// Baforada de fumaça pontilhada; dens cai com a idade até sumir.
function puff(f, sx, sy, r, dens, inner, outer) {
  for (let y = Math.floor(sy - r); y <= sy + r; y++) {
    for (let x = Math.floor(sx - r); x <= sx + r; x++) {
      const dx = x + 0.5 - sx, dy = y + 0.5 - sy, d2 = (dx * dx + dy * dy) / (r * r);
      if (d2 > 1) continue;
      const dd = Math.sqrt(d2);
      if (bayer(x, y) < dens * (1.1 - dd * 0.5)) f.set(x, y, dd < 0.5 && y < sy ? inner : outer);
    }
  }
}

// Vidro vazio: pinta com o marcador, contorna e depois abre o buraco para o fundo aparecer.
const HOLLOW = C('#ff00fe');
function clearHollow(p) {
  for (let i = 0; i < p.d.length; i++) if (p.d[i] === HOLLOW) p.d[i] = 0;
  return p;
}

// Bulbo redondo de vidro: borda e brilho por cima, vazio por dentro, líquido até a altura level.
function glassBulb(p, cx, cy, r, level, liq, liqBias = 0) {
  p.fill(cx - r, cy - r, cx + r, cy + r, (x, y) => Math.hypot(x - cx, y - cy) <= r, (x, y) => {
    const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r;
    const d = Math.hypot(nx, ny);
    if (y + 0.5 >= level) {
      let v = 0.2 + (1 - Math.hypot(nx * 1.1, ny + 0.25)) * 0.75 + liqBias;
      if (y + 0.5 < level + 1) v += 0.3; // superfície
      if (d > 0.8 && nx > 0.2) v -= 0.15;
      return pick(liq, v, x, y);
    }
    if (d > 1 - 1.1 / r) return GLASSY[nx < 0 && ny < 0.3 ? 4 : 2];
    return HOLLOW;
  });
  p.set(cx - r * 0.45, cy - r * 0.45, GLASSY[5]);
  p.set(cx - r * 0.62, cy - r * 0.18, GLASSY[4]);
}

// Mistura duas cores no formato do ImageData (k = 0 fica a, 1 vira b).
function mix(a, b, k) {
  const ch = (s) => Math.round(((a >>> s) & 255) + (((b >>> s) & 255) - ((a >>> s) & 255)) * k);
  return ((255 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0;
}

// Nuvenzinha de fumaça: núcleo cheio com luz por cima e borda pontilhada; some quando life chega a 0.
function blob(f, sx, sy, r, life, tones) {
  const core = clamp01(life) * 0.75, fade = (life * 1.4) / (1 - core), ir = 1 / r;
  for (let y = Math.floor(sy - r); y <= sy + r; y++) {
    const ny = (y + 0.5 - sy) * ir;
    for (let x = Math.floor(sx - r); x <= sx + r; x++) {
      const nx = (x + 0.5 - sx) * ir, d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const dd = Math.sqrt(d2);
      if (dd > core && bayer(x, y) > (1 - dd) * fade) continue;
      const l = sphereLight(nx, ny);
      f.set(x, y, tones[l > 0.8 ? 2 : l > 0.4 ? 1 : 0]);
    }
  }
}

// Estrelinha de brilho que cresce e some (e de 0 a 1).
function sparkle(f, x, y, e, c = WHITE, tip = PAL.gold[5]) {
  if (e <= 0.08) return;
  const arm = Math.round(e * 2.2);
  f.set(x, y, c);
  for (let k = 1; k <= arm; k++) {
    const cc = k === arm ? tip : c;
    f.set(x + k, y, cc); f.set(x - k, y, cc); f.set(x, y + k, cc); f.set(x, y - k, cc);
  }
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
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = y * 64 + x;
      if (base.d[i] === lit.d[i]) continue;
      idx.push(i);
      th.push(threshold(x, y) + (bayer(x, y) - 0.5) * 0.28);
      col.push(lit.d[i]);
    }
  }
  return { idx: Int32Array.from(idx), th: Float32Array.from(th), col: Uint32Array.from(col) };
}

function paintHalo(f, h, level) {
  const d = f.d;
  for (let k = 0; k < h.idx.length; k++) if (h.th[k] < level) d[h.idx[k]] = h.col[k];
}

// Pixels de uma rampa (cobre, latão) dentro de um retângulo: o brilho corre por eles.
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

// Faixa de brilho na diagonal passando pelos pixels da lista; s é a posição.
function sweepGlint(f, list, r, s, width = 1.8) {
  const top = r.length - 1;
  for (let i = 0; i < list.length; i += 3) {
    const d = Math.abs(list[i] * 0.8 + list[i + 1] * 0.6 - s);
    if (d < width) f.set(list[i], list[i + 1], r[Math.min(top, list[i + 2] + (d < width * 0.45 ? 2 : 1))]);
  }
}

// Fogo numa boca de fornalha (lista de pixels): mais quente embaixo, línguas tremendo.
function paintFire(f, pts, top, bottom, t, live) {
  const span = bottom - top;
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i], y = pts[i + 1];
    const tongue = Math.sin(t * 7 + x * 1.9) * 0.22 + Math.sin(t * 11.3 - x * 0.7 + y * 0.5) * 0.14;
    const v = 1.2 - ((bottom - y) / span) * (1.5 - live * 0.35) + tongue;
    if (v > 0.12) f.set(x, y, pick(PAL.fire, v, x, y, 1.5));
  }
}

// Chama de vela com a base em (x, y) e um halo pontilhado que pulsa junto.
function paintCandle(f, x, y, t, seed, glow) {
  const fl = 0.5 * Math.sin(t * 9.3 + seed * 1.7) + 0.3 * Math.sin(t * 15.1 + seed * 4.1) + 0.2 * Math.sin(t * 3.7 + seed);
  const R = 3 + fl * 0.5;
  for (let yy = Math.floor(y - 2 - R); yy <= y - 2 + R; yy++) {
    for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
      const d = Math.hypot(xx - x, (yy - y + 2) * 0.9) / R;
      if (d < 1 && bayer(xx, yy) < (1 - d) * 0.42) f.set(xx, yy, glow[d < 0.5 ? 1 : 0]);
    }
  }
  const lean = Math.sin(t * 2.3 + seed * 3) * 0.7 + fl * 0.4;
  const h = fl > 0.2 ? 4 : 3;
  for (let k = 1; k <= h; k++) f.set(x + Math.round(lean * ((k - 1) / h) * 1.6), y - k, PAL.fire[k === 1 ? 5 : k === h ? 3 : 4]);
  f.set(x + (lean > 0 ? 1 : -1), y - 1, PAL.fire[3]);
  f.set(x, y, PAL.out);
}

// ---------------------------------------------------------------------------
// Mosteiro

const BELL = [11.5, 15]; // eixo do sino
const SPOUT = [51, 54]; // crivo do regador

function buildMonasteryBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 34, PAL.morning, 2);
  paintSun(p, 34, 7, 3);
  // serra azulada ao longe
  for (let x = 0; x < 64; x++) {
    const top = Math.round(17 + 2.2 * Math.sin(x * 0.08 + 2.2) + 1.2 * Math.sin(x * 0.27));
    for (let y = top; y < 34; y++) p.set(x, y, pick(PAL.far, (y === top ? 0.95 : 0.6) - (y - top) * 0.035, x, y, 1.6));
  }
  // mata escura atrás do claustro
  for (let x = 0; x < 64; x++) {
    const top = Math.round(22 + 1.3 * Math.sin(x * 0.75 + 1) + Math.sin(x * 1.35));
    for (let y = top; y < 36; y++) p.set(x, y, pick(PAL.tree, 0.6 - (y - top) * 0.1 + (hash(x, y, 1) - 0.5) * 0.3, x, y, 1.6));
  }
  // grama do pátio
  for (let y = 36; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.48 + (y - 50) * 0.012 + (hash(x, y, 2) - 0.5) * 0.25;
      if (hash(x, y, 3) < 0.05) v += 0.2;
      if ((x * 3 + y * 5) % 11 === 0) v -= 0.12;
      p.set(x, y, pick(PAL.grass, v, x, y, 1.6));
    }
  }
  // trilha de lajes saindo da arcada
  const onPath = (x, y) => y > 49 && Math.abs(x - (31 + (y - 50) * 0.15)) < 5 + (y - 50) * 0.3;
  p.fill(20, 49, 44, 63, onPath, (x, y) => {
    const row = Math.floor((y - 50) / 3), off = (row % 2) * 3;
    const edge = (y - 50) % 3 === 2 || (x + off) % 5 === 0;
    let v = 0.62 + (hash(Math.floor((x + off) / 5), row, 4) - 0.5) * 0.2 + (y - 50) * 0.008;
    if (edge) v -= 0.28;
    if (!onPath(x - 1, y)) v -= 0.15;
    return pick(PAL.stone, v, x, y);
  });
  return p;
}

// Canteiro elevado de tábuas com terra escura.
function drawBed(p, x0, x1, top) {
  p.rect(x0, top, x1 - x0 + 1, 1, (x) => PAL.wood[x % 7 === 0 ? 2 : 4]);
  p.rect(x0, top + 1, x1 - x0 + 1, 3, (x, y) => pick(PAL.dirt, 0.15 + (hash(x, y, 7) - 0.5) * 0.25, x, y));
  p.rect(x0, top + 4, x1 - x0 + 1, 3, (x, y) => {
    let v = 0.5 - (y - top - 4) * 0.12 + (hash(x >> 2, y, 8) - 0.5) * 0.12;
    if (y === top + 4) v += 0.2;
    if ((x - x0) % 9 === 0) v -= 0.25;
    return pick(PAL.wood, v, x, y);
  });
}

// Moita de folhas com luz por cima.
function drawBush(p, cx, cy, rx, ry, r, seed) {
  p.fill(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 - hash(Math.floor(x), Math.floor(y), seed) * 0.25,
    (x, y) => {
      let v = 0.12 + sphereLight((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) * 0.95;
      if (hash(x, y, seed + 1) < 0.2) v -= 0.25;
      else if (hash(x, y, seed + 2) < 0.14) v += 0.3; // folhinha pegando luz
      return pick(r, v, x, y, 1.6);
    });
}

function buildMonastery() {
  const p = new Pix(64, 64);
  // ala do claustro: telhado de ardósia com musgo
  p.rect(17, 26, 47, 9, (x, y) => {
    const row = Math.floor((y - 26) / 2), off = (row % 2) * 2;
    let v = 0.66 - (y - 26) * 0.035 + (hash(Math.floor((x + off) / 4), row, 4) - 0.5) * 0.2;
    if ((y - 26) % 2 === 1) v -= 0.16;
    else if ((x + off) % 4 === 0) v -= 0.12;
    if (y === 26) v = 0.85 - (x % 3 === 0 ? 0.2 : 0); // cumeeira
    if (y === 34) v = 0.12;
    if (y > 26 && y < 34 && hash(Math.floor(x / 3), Math.floor((y - 1) / 2), 6) < 0.16) return pick(MOSS, v + 0.1, x, y);
    return pick(SLATE, v, x, y);
  });
  // sombra da torre no telhado
  p.fill(19, 26, 23, 34, (x, y) => x < 20.5 + (y - 26) * 0.3, (x, y) => SLATE[y === 34 ? 0 : 1]);
  // chaminé da cozinha
  p.rect(51, 18, 5, 9, (x, y) => pick(PAL.stone, (x === 51 ? 0.82 : x === 55 ? 0.3 : 0.55) + masonry(x, y, 3, 2, 9) * 0.8, x, y));
  p.rect(50, 17, 7, 2, (x, y) => PAL.stone[y === 17 ? 5 : 2]);
  p.rect(52, 17, 3, 1, GALLERY[0]);
  // faixa de pedra acima dos arcos
  p.rect(17, 35, 47, 5, (x, y) => pick(PAL.stone, 0.62 - (y === 35 ? 0.3 : 0) + masonry(x, y, 6, 3, 10, 35), x, y));
  // arcada: colunas, arcos redondos e a galeria na sombra
  const AY = 37, AB = 50;
  for (let k = 0; k < 7; k++) {
    const cx = 23.5 + k * 7;
    p.fill(cx - 4, AY - 1, cx + 4, AB, archTest(cx, 3.6, AY - 1, AB), (x, y) => pick(PAL.stone, 0.88 - (x > cx ? 0.3 : 0), x, y));
    p.fill(cx - 3, AY, cx + 3, AB, archTest(cx, 2.6, AY, AB), (x, y) => {
      let v = 0.15 + (y - AY) * 0.02;
      const sun = x - cx + 2.5 - (AB - y) * 0.45; // luz entrando de viés
      if (sun < 0 && y > 44) v += 0.45;
      if (y < AY + 3) v -= 0.1;
      return pick(GALLERY, v, x, y);
    });
  }
  // colunas finas com capitel e base
  for (let k = 0; k < 8; k++) {
    const x = 19 + k * 7;
    p.rect(x, AY + 3, 2, AB - AY - 3, (xx) => PAL.stone[xx === x ? 4 : 2]);
    p.rect(x - 1, AY + 3, 4, 1, (xx) => PAL.stone[xx < x + 1 ? 5 : 3]);
    p.rect(x - 1, AB - 1, 4, 2, (xx, yy) => PAL.stone[yy === AB - 1 ? 4 : 2]);
  }
  // mureta baixa da galeria
  p.rect(17, 48, 47, 3, (x, y) => pick(PAL.stone, (y === 48 ? 0.8 : 0.45) + masonry(x, y, 5, 3, 11, 48) * 0.6, x, y));

  // torre do sino
  const TX0 = 4, TX1 = 18, TC = 11.5;
  p.rect(TX0, 11, TX1 - TX0 + 1, 40, (x, y) => {
    let v = 0.66 - (x - TX0) * 0.016 + masonry(x, y, 5, 3, 12);
    if (x === TX0) v += 0.15;
    if (x === TX1) v -= 0.22;
    if ((x === TX0 || x === TX1) && Math.floor(y / 3) % 2) v += 0.1; // cunhais
    return pick(PAL.stone, v, x, y);
  });
  // cornija sob o telhado e parapeito do campanário
  p.rect(TX0 - 1, 11, TX1 - TX0 + 3, 2, (x, y) => PAL.stone[y === 11 ? 2 : x < 12 ? 5 : 4]);
  p.rect(TX0 - 1, 24, TX1 - TX0 + 3, 2, (x, y) => PAL.stone[y === 24 ? (x < 12 ? 5 : 4) : 2]);
  // campanário: arco com aduelas claras e o vão escuro
  p.fill(6, 13, 17, 24, archTest(TC, 4.6, 13, 23), (x, y) => pick(PAL.stone, 0.85 - (x > TC ? 0.25 : 0) - ((x + y) % 3 === 0 ? 0.1 : 0), x, y));
  p.fill(7, 14, 16, 23, archTest(TC, 3.6, 14, 23), (x, y) => pick(GALLERY, 0.12 + (y - 14) * 0.03, x, y));
  p.rect(8, 15, 8, 1, (x) => PAL.wood[x < 12 ? 3 : 2]);
  // seteira e porta em arco
  p.fill(10, 28, 13, 35, archTest(TC, 1, 28, 35), GALLERY[0]);
  p.set(11, 30, GALLERY[2]);
  p.fill(7, 39, 16, 50, archTest(TC, 3.6, 39, 50), (x, y) => pick(PAL.stone, 0.85 - (x > TC ? 0.25 : 0), x, y));
  p.fill(8, 40, 15, 50, archTest(TC, 2.6, 40, 50), (x, y) => {
    let v = 0.62 - (x - 9) * 0.06;
    if ((x - 9) % 2 === 1) v -= 0.18;
    return pick(PAL.wood, v, x, y);
  });
  p.rect(9, 44, 6, 1, PAL.iron[1]);
  p.set(13, 46, PAL.gold[4]);
  // hera subindo pela torre
  p.fill(TX0, 30, 10, 50, (x, y) => {
    const reach = 50 - (y - 30) * 0.9;
    return x < TX0 + 1 + (50 - y) * 0.18 + hash(Math.floor(x), Math.floor(y / 2), 13) * 3 && hash(Math.floor(x / 2), Math.floor(y / 2), 14) < 0.75 && reach > 0;
  }, (x, y) => pick(MOSS, 0.3 + (hash(x, y, 15) - 0.3) * 0.9 - (x - TX0) * 0.04, x, y, 1.6));
  // telhado de pirâmide e o pináculo
  p.poly([[1.5, 11.5], [TC, 2.5], [21.5, 11.5]], (x, y) => {
    let v = x + 0.5 < TC ? 0.68 - (TC - x) * 0.01 : 0.3;
    if ((y - 3) % 2 === 1) v -= 0.12;
    if (hash(x, y >> 1, 16) < 0.08) v += 0.15;
    return pick(SLATE, v, x, y);
  });
  p.rect(11, 0, 1, 3, PAL.iron[3]);
  p.sphere(11.5, 2.2, 1.3, 1.3, PAL.gold, 0.1);

  p.outline(PAL.out);
  // canteiros elevados com ervas, contornados à parte para destacar do claustro
  const g = new Pix(64, 64);
  drawBed(g, 0, 21, 54);
  drawBed(g, 43, 63, 55);
  // esquerda: sálvia e moitas de lavanda (as espigas balançam no quadro)
  for (const [x, w] of [[3, 3.4], [10, 3], [17, 3.4]]) drawBush(g, x, 53, w, 2.4, x === 10 ? SAGE_BUSH : PAL.herb, 20 + x);
  // direita: calêndulas, camomila e sálvia
  drawBush(g, 47, 53.5, 3.6, 2.6, PAL.herb, 31);
  drawBush(g, 54, 53, 3.4, 3, PAL.herb, 32);
  drawBush(g, 60.5, 53.5, 3.8, 2.6, SAGE_BUSH, 33);
  for (const [x, y] of [[46, 52], [48, 51], [49, 53], [45, 53]]) { g.set(x, y, CALENDULA[2]); g.set(x + 1, y, CALENDULA[1]); }
  for (const [x, y] of [[53, 51], [55, 50], [56, 52], [52, 53]]) { g.set(x, y, CHAMOMILE); g.set(x, y + 1, C('#f2c94c')); }
  for (const [x, y] of [[59, 51], [61, 52], [63, 53], [58, 53]]) g.set(x, y, SAGE[3]);
  g.outline(PAL.out);
  p.blit(g, 0, 0);
  const m = new Pix(64, 64);
  buildMonk(m);
  m.outline(PAL.out);
  p.blit(m, 0, 0);
  return p;
}

// Monge de hábito marrom, de três quartos, regando o canteiro com o braço esticado.
const MONK_HEAD = [30.5, 42.4];
function buildMonk(p) {
  const MX = 30.5;
  // hábito em sino, mais largo na barra
  const inRobe = (x, y) => {
    if (y < 46 || y > 62) return false;
    const half = y < 48.5 ? 4 + (y - 46) * 0.9 : 6.2 + (y - 48.5) * 0.11;
    return Math.abs(x - MX) <= half;
  };
  p.fill(22, 46, 39, 62, inRobe, (x, y) => {
    let v = 0.64 - ((x + 0.5 - MX) / 7) * 0.32 - (y - 47) * 0.006 + (hash(x, y, 17) - 0.5) * 0.06;
    if (y > 53 && (x === 27 || x === 33)) v -= 0.24; // pregas
    if (y > 53 && (x === 28 || x === 34)) v += 0.08;
    if (y === 62) v -= 0.22;
    return pick(HABIT, v, x, y);
  });
  // braço esquerdo caído junto ao corpo, mão na manga
  p.rect(25, 49, 1, 7, HABIT[1]);
  p.fill(22, 54, 27, 58, (x, y) => y >= 54.5 && x >= 22.5 + (y - 54.5) * 0.2 && x <= 26.5, (x, y) => pick(HABIT, 0.6 - (y - 54) * 0.06 + (x === 23 ? 0.12 : 0), x, y));
  p.rect(23, 58, 3, 1, HABIT[1]);
  p.rect(24, 58, 2, 1, PAL.skin[3]);
  // capuz caído formando gola em volta do pescoço
  p.fill(25, 45, 37, 50, (x, y) => ((x - MX) / 5.4) ** 2 + ((y - 47.6) / 2.5) ** 2 <= 1, (x, y) => {
    let v = 0.3 + sphereLight((x + 0.5 - MX) / 5.4, (y + 0.5 - 47) / 2.5) * 0.75;
    if (Math.abs(x + 0.5 - MX) < 1.6 && y > 47) v -= 0.4; // abertura da gola
    return pick(HABIT, v, x, y);
  });
  // cordão com nó e as pontas caindo
  for (let x = 25; x <= 36; x++) p.set(x, 53, PAL.straw[x < 30 ? 4 : x < 34 ? 3 : 2]);
  p.rect(28, 53, 2, 2, (x, y) => PAL.straw[y === 53 && x === 28 ? 5 : 3]);
  for (let y = 55; y <= 59; y++) p.set(28 + (y > 57 ? 1 : 0), y, PAL.straw[y % 2 ? 3 : 2]);
  p.set(29, 60, PAL.straw[4]);
  // sandálias
  for (const [x0, d] of [[26, 0], [33, 1]]) {
    p.rect(x0, 63, 3, 1, (x) => (x === x0 + 1 ? PAL.leather[2] : PAL.skin[d ? 3 : 2]));
  }
  // manga larga do braço que segura o regador
  p.poly([[34.5, 46.8], [37.5, 47.6], [41.4, 49.6], [41.2, 52.4], [38.4, 53.6], [35.4, 51.6]], (x, y) =>
    pick(HABIT, 0.6 - (y - 47) * 0.07 - (x > 39 ? 0.06 : 0), x, y));
  p.line(36, 52, 39, 53, HABIT[1]);
  // regador de cobre inclinado para a frente
  p.fill(41, 46, 48, 54, (x, y) => ((x - 44.6) / 3.1) ** 2 + ((y - 50.4) / 3.1) ** 2 <= 1 && y > 47.5, (x, y) =>
    pick(COPPER, 0.15 + sphereLight((x + 0.5 - 44.6) / 3.1, (y + 0.5 - 49.6) / 3.1) * 0.95 + (y === 48 ? 0.15 : 0), x, y));
  p.rect(42, 48, 6, 1, (x) => COPPER[x < 45 ? 5 : 4]);
  for (const [x, y] of [[42, 47], [42, 46], [43, 45], [44, 45], [45, 45], [46, 46]]) p.set(x, y, COPPER[x < 44 ? 3 : 2]);
  p.line(47, 51, 50, 53, COPPER[4]);
  p.line(47, 52, 50, 54, COPPER[2]);
  p.rect(50, 53, 2, 2, (x, y) => COPPER[x === 50 && y === 53 ? 5 : 3]);
  // mão na alça
  p.rect(41, 47, 2, 2, (x, y) => PAL.skin[x === 41 && y === 47 ? 5 : 3]);
  // cabeça com tonsura: cocuruto careca, coroa de cabelo, rosto sorridente
  const [hx, hy] = MONK_HEAD;
  p.fill(26, 37, 35, 47, (x, y) => {
    const dy = (y - hy) / 4.4;
    const w = dy > 0 ? 3.9 * (1 - 0.28 * dy * dy) : 3.9;
    return ((x - hx) / w) ** 2 + dy * dy <= 1;
  }, (x, y) => pick(PAL.skin, 0.34 + sphereLight((x + 0.5 - hx) / 3.9, (y + 0.5 - hy + 0.6) / 4.4) * 0.78, x, y, 3));
  // coroa de cabelo castanho
  p.fill(26, 38, 35, 44, (x, y) => {
    const dy = (y - hy) / 4.4;
    if (((x - hx) / 3.9) ** 2 + dy * dy > 1) return false;
    return (y > 40 && y < 41) || (Math.abs(x - hx) > 2.7 && y >= 41 && y < 44);
  }, (x, y) => pick(PAL.hair, 0.6 - (x - 27) * 0.06 + (hash(x, y, 18) - 0.5) * 0.2, x, y));
  p.set(29, 39, PAL.skin[5]);
  p.set(30, 38, PAL.skin[5]);
  p.set(29, 38, PAL.skin[4]);
  // olhos, nariz, bochechas e sorriso
  p.set(29, 42, PAL.hair[0]);
  p.set(32, 42, PAL.hair[0]);
  p.set(31, 43, PAL.skin[2]);
  p.set(31, 44, PAL.skin[2]);
  p.set(28, 44, PAL.blush);
  p.set(33, 44, PAL.blush);
  for (const x of [30, 31, 32]) p.set(x, 45, x === 31 ? PAL.lip : PAL.skin[1]);
}

// Sino de bronze balançando no campanário; o badalo atrasa um pouco.
const inBellArch = archTest(BELL[0], 3.6, 14, 23);
const BELL_O = [4.5 + 2.5, 1]; // eixo dentro do sprite
const BELL_X = Math.round(BELL[0] - BELL_O[0]), BELL_Y = Math.round(BELL[1] - BELL_O[1]);
const bellMask = new Uint8Array(14 * 12).map((_, i) => (inBellArch(BELL_X + (i % 14) + 0.5, BELL_Y + Math.floor(i / 14) + 0.5) ? 1 : 0));
const bellCache = new Map();

// Sino inclinado (a) já contornado; guardado por ângulo arredondado.
function bellSprite(a) {
  const key = Math.round(a * 40);
  let b = bellCache.get(key);
  if (b) return b;
  b = new Pix(14, 12);
  const ang = key / 40, ca = Math.cos(ang), sa = Math.sin(ang);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 14; x++) {
      const dx = x + 0.5 - BELL_O[0], dy = y + 0.5 - BELL_O[1];
      const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      if (v < 0 || v > 6.6) continue;
      const w = v < 1.2 ? 0.7 : 1.25 + (v - 1.2) * 0.3 + (v > 5.2 ? 0.75 : 0);
      if (Math.abs(u) > w) continue;
      let l = 0.62 - (u / w) * 0.4;
      if (v > 5.2 && v < 6) l += 0.2;
      if (v > 6) l -= 0.25;
      b.set(x, y, pick(BRONZE, l, x, y, 3));
    }
  }
  b.outline(PAL.out);
  bellCache.set(key, b);
  return b;
}

// Sino de bronze balançando no campanário; o badalo atrasa um pouco.
function paintBell(f, a, clap) {
  const b = bellSprite(a);
  for (let i = 0; i < 14 * 12; i++) if (b.d[i] && bellMask[i]) f.d[(BELL_Y + Math.floor(i / 14)) * 64 + BELL_X + (i % 14)] = b.d[i];
  const cx = BELL[0] + Math.sin(clap) * 6.2, cy = BELL[1] + Math.cos(clap) * 6.2;
  if (inBellArch(Math.floor(cx) + 0.5, Math.floor(cy) + 0.5)) f.set(cx, cy, BRONZE[0]);
}

// Pomba em voo: corpo cinza, asas claras batendo.
function paintDove(f, x, y, flap) {
  x = Math.round(x); y = Math.round(y);
  f.set(x, y - 1, DOVE[2]); f.set(x, y, DOVE[1]); f.set(x, y + 1, DOVE[0]);
  for (const d of [-1, 1]) {
    f.set(x + d, y, DOVE[2]);
    if (flap > 0) {
      f.set(x + d * 2, y - 1, DOVE[3]);
      f.set(x + d * 3, y - 2, DOVE[3]);
    } else {
      f.set(x + d * 2, y, DOVE[3]);
      f.set(x + d * 3, y + 1, DOVE[2]);
    }
  }
}

const LAVENDER = [[1, 53, 5], [2, 52, 6], [4, 52, 7], [6, 52, 5], [14, 52, 5], [16, 52, 7], [18, 52, 6], [20, 53, 5]];

const monasteryArt = { bg: null, body: null, clouds: null, frame: new Pix(64, 64) };

function paintMonasteryPortrait(ctx, t, info) {
  const a = monasteryArt;
  if (!a.bg) {
    a.bg = buildMonasteryBackdrop();
    a.body = buildMonastery();
    a.clouds = [makeCloud(18, 7, 11), makeCloud(13, 6, 4)];
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.bg);
  f.blit(a.clouds[0], Math.floor(((t * 1.2) % 90) - 20), 3);
  f.blit(a.clouds[1], Math.floor(((t * 0.8 + 45) % 84) - 14), 11);
  // fumaça da cozinha
  for (let k = 0; k < 5; k++) {
    const s = (t * (working ? 0.26 : 0.16) + k / 5) % 1;
    puff(f, 53.5 + s * 9 + Math.sin(s * 6 + k) * 0.8, 16 - s * 12, 1 + s * 2.6, (1 - s) * 1.2, PAL.cloud[4], PAL.cloud[2]);
  }
  f.blit(a.body, 0, 0);
  // sino tocando: mais forte enquanto o mosteiro trabalha
  const amp = working ? 0.62 : 0.22;
  const sw = t * 2.4;
  paintBell(f, Math.sin(sw) * amp, Math.sin(sw - 0.7) * amp * 1.5);
  // espigas de lavanda balançando no canteiro da esquerda
  for (const [x, base, h] of LAVENDER) {
    const sway = Math.sin(t * 1.7 - x * 0.3) * 0.9;
    for (let k = 1; k <= h; k++) {
      const xx = x + Math.round(sway * (k / h) * (k / h));
      f.set(xx, base - k, k < h - 2 ? PAL.herb[k % 2 ? 3 : 2] : PAL.lavender[k === h ? 5 : 4 - (k % 2)]);
    }
  }
  // água caindo do regador
  const drops = working ? 9 : 5;
  const [sx, sy] = SPOUT;
  for (let k = 0; k < drops; k++) {
    const s = (t * (working ? 1.5 : 0.9) + k / drops + hash(k, 1, 18) * 0.1) % 1;
    const spread = (hash(k, 2, 18) - 0.5) * 2.4;
    const x = sx + s * (2 + spread), y = sy + 1 + s * s * 3.5;
    f.set(x, y, k % 3 ? PAL.water[4] : PAL.water[5]);
  }
  // borrifo nas folhas
  if (Math.sin(t * 9) > 0) f.set(sx + 2, 52, PAL.water[5]);
  // pombas rodeando a torre
  for (let k = 0; k < 3; k++) {
    const w = (working ? 0.7 : 0.45) + k * 0.1, ph = k * 2.2 + t * w;
    const x = 12 + Math.cos(ph) * (14 + k * 4);
    const y = 9 + k * 4 + Math.sin(ph) * 3;
    paintDove(f, x, y, Math.sin(t * 10 + k * 1.7));
  }
  // borboleta nas ervas
  const bx = 46 + Math.sin(t * 0.7) * 8, by = 46 + Math.sin(t * 1.9) * 2.5;
  const c = PAL.lavender[4];
  f.set(bx, by, PAL.out);
  if (Math.sin(t * 22) > 0) { f.set(bx - 1, by - 1, c); f.set(bx + 1, by - 1, c); f.set(bx - 1, by, c); f.set(bx + 1, by, c); }
  else { f.set(bx, by - 1, c); f.set(bx, by - 2, c); }
  // piscar do monge
  if (t % 4.3 > 4.15) { f.set(29, 42, PAL.skin[3]); f.set(32, 42, PAL.skin[3]); }
  f.draw(ctx);
}

function iconMonastery() {
  const p = new Pix(16, 16);
  // ala baixa com telhado de ardósia e os arcos do claustro
  p.rect(8, 9, 7, 6, (x, y) => pick(PAL.stone, 0.6 + masonry(x, y, 3, 2, 3) * 0.6, x, y));
  p.rect(7, 7, 9, 2, (x, y) => SLATE[y === 7 ? 4 : 2]);
  for (const x of [9, 12]) {
    p.rect(x, 11, 2, 4, GALLERY[1]);
    p.set(x, 11, PAL.stone[3]);
  }
  // torre com o sino
  p.rect(2, 6, 7, 9, (x, y) => pick(PAL.stone, (x === 2 ? 0.85 : x === 8 ? 0.35 : 0.62) + ((y + x) % 3 === 0 ? -0.08 : 0), x, y));
  p.poly([[1, 6.5], [5.5, 1], [10, 6.5]], (x) => SLATE[x < 5 ? 4 : 2]);
  p.set(5, 0, PAL.gold[4]);
  p.rect(4, 7, 3, 4, GALLERY[0]);
  p.rect(4, 8, 3, 2, (x, y) => BRONZE[x === 4 ? 5 : y === 9 ? 3 : 4]);
  p.set(5, 7, BRONZE[3]);
  p.rect(4, 12, 3, 3, (x) => PAL.wood[x === 4 ? 3 : 2]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Destilaria

const FURNACE = [18, 53]; // boca da fornalha
const TAP = [50, 44]; // torneira na ponta da serpentina
const FLASK = [50, 58.2, 4.3]; // bulbo do frasco que recebe as gotas

function buildDistilleryBackdrop(glow) {
  const p = new Pix(64, 64);
  const [fx, fy] = FURNACE;
  const reach = 36 + glow * 8, power = 0.4 + glow * 0.24;
  const light = (x, y) => power * clamp01(1 - Math.hypot(x + 0.5 - fx, (y + 0.5 - fy) * 1.15) / reach) ** 1.4;
  // parede de pedra da adega
  for (let y = 0; y < 57; y++) {
    for (let x = 0; x < 64; x++) {
      let v = 0.14 + light(x, y) + masonry(x, y, 8, 4, 41) * 0.9 + (hash(x, y, 42) - 0.5) * 0.05;
      const shaft = x - 52 + (y - 21) * 0.6; // luz da janela pousando na parede
      if (y > 20 && shaft > 0 && shaft < 8) v += 0.12 * clamp01(1 - (y - 21) / 16);
      p.d[y * 64 + x] = pick(CELLAR, v, x, y, 2);
    }
  }
  // janelinha em arco com a manhã lá fora
  const win = archTest(56.5, 4, 6, 19);
  p.fill(51, 5, 62, 20, archTest(56.5, 5, 5, 20), (x, y) => pick(CELLAR, 0.5 + (x < 56 ? 0.1 : -0.1) + light(x, y), x, y));
  p.fill(52, 6, 61, 19, win, (x, y) => {
    if (y > 15 + Math.sin(x * 1.3) * 0.8) return pick(PAL.tree, 0.55 - (y - 15) * 0.1, x, y);
    return pick(PAL.morning, 0.1 + (y - 6) * 0.06, x, y, 2);
  });
  p.rect(56, 6, 1, 14, PAL.wood[1]);
  p.rect(51, 20, 11, 1, (x) => CELLAR[x < 56 ? 6 : 4]);
  // prateleira com frascos coloridos
  p.rect(0, 12, 12, 2, (x, y) => PAL.wood[y === 12 ? 3 : 1]);
  p.rect(2, 14, 1, 2, PAL.wood[1]);
  p.rect(9, 14, 1, 2, PAL.wood[1]);
  const bottle = (x, rows, k) => rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const y = 12 - rows.length + j;
    if (ch === 'c') p.set(x + i, y, PAL.wood[3]);
    else if (ch === 'g') p.set(x + i, y, GLASS[k]);
    else if (ch === 'w') p.set(x + i, y, WHITE);
    else if (ch === 'd') p.set(x + i, y, GLASS_DARK[k]);
  }));
  bottle(0, ['.c.', '.g.', 'wgd', 'gdd'], 0);
  bottle(4, ['c.', 'g.', 'wd', 'gd', 'gd'], 1);
  bottle(7, ['.c.', 'wgd', 'gdd'], 2);
  bottle(10, ['c', 'g', 'd'], 4);
  // viga do teto
  p.rect(0, 0, 64, 3, (x, y) => pick(PAL.wood, (y === 2 ? 0.2 : 0.45) + (hash(x >> 2, y, 43) - 0.5) * 0.2 + light(x, y), x, y));
  // chão de lajes
  for (let y = 57; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const row = Math.floor((y - 57) / 3), off = (row % 2) * 4;
      const edge = (y - 57) % 3 === 2 || (x + off) % 8 === 0;
      let v = 0.2 + light(x, y) * 1.1 + (hash(Math.floor((x + off) / 8), row, 44) - 0.5) * 0.14 + (y - 57) * 0.02;
      if (edge) v -= 0.16;
      p.d[y * 64 + x] = pick(CELLAR, v, x, y, 2);
    }
  }
  p.rect(0, 57, 64, 1, CELLAR[1]);
  return p;
}

// Cobre polido: luz por cima à esquerda, faixa escura do reflexo da sala e brilho forte.
function metal(x, y, cx, cy, rx, ry) {
  const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
  const l = sphereLight(nx, ny);
  let v = 0.08 + l * 0.72;
  if (ny > 0.05 && ny < 0.4) v -= 0.16;
  if (ny > 0.62) v += 0.12; // brasa refletida embaixo
  if (l > 0.93) v += 0.3;
  return pick(COPPER, v, x, y, 3);
}

// Barril em pé: aduelas com bojo, aros de ferro e a tampa vista de cima.
function drawBarrel(p, cx, top, bottom, hw, seed) {
  const H = bottom - top;
  const half = (y) => hw * (0.86 + Math.sin(((y + 0.5 - top) / H) * Math.PI) * 0.14);
  const hoops = [top + 2, top + 4, bottom - 4, bottom - 2];
  p.fill(cx - hw - 1, top, cx + hw + 1, bottom, (x, y) => Math.abs(x - cx) <= half(y), (x, y) => {
    const nx = (x + 0.5 - cx) / half(y);
    let v = 0.08 + cylLight(nx) * 0.82;
    const sv = (Math.asin(clamp01(Math.abs(nx)) * Math.sign(nx)) / Math.PI + 0.5) * 7;
    if (sv % 1 < 0.2) v -= 0.18;
    if (y === bottom) v -= 0.2;
    if (hoops.includes(y)) return pick(PAL.iron, v + 0.08, x, y);
    return pick(PAL.wood, v + (hash(Math.floor(sv), seed, 45) - 0.5) * 0.12, x, y);
  });
  p.ellipse(cx, top, half(top) - 0.3, 1.6, (x, y) => pick(PAL.wood, 0.72 - (x - cx) * 0.03 - (y > top ? 0.15 : 0), x, y));
}

// Barrilete deitado mostrando o fundo redondo, com a torneira.
function drawKeg(p, cx, cy, r) {
  p.fill(cx - r, cy - r, cx + r, cy + r, (x, y) => Math.hypot(x - cx, y - cy) <= r, (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > r - 1.1) return pick(PAL.iron, 0.25 + sphereLight((x + 0.5 - cx) / r, (y + 0.5 - cy) / r) * 0.75, x, y);
    let v = 0.35 + sphereLight((x + 0.5 - cx) / r * 0.6, (y + 0.5 - cy) / r * 0.6) * 0.5;
    if ((x - Math.floor(cx - r)) % 3 === 0) v -= 0.15;
    return pick(PAL.wood, v, x, y);
  });
  p.rect(cx - 0.5, cy + 1, 2, 2, (x, y) => PAL.gold[y === Math.round(cy + 1) ? 4 : 2]);
  p.set(cx + 0.5, cy + 3, PAL.gold[1]);
}

const MOUTH = C('#0d0606');

// Serpentina de cobre em hélice: só a metade da frente ou só a de trás.
function coil(p, front) {
  const steps = 3.25 * 48;
  for (let i = 0; i <= steps; i++) {
    const a = (i / 48) * Math.PI * 2 - Math.PI / 2;
    if (Math.sin(a) > 0 !== front) continue;
    const x = 45.5 + Math.cos(a) * 5.4, y = 25 + Math.sin(a) * 2.3 + (i / 48) * 5;
    const v = front ? 0.82 - Math.cos(a) * 0.28 : 0.3 - Math.cos(a) * 0.08;
    p.set(x, y, pick(COPPER, v, Math.floor(x), Math.floor(y), 3));
    p.set(x, y + 1, COPPER[front ? 3 : 1]);
  }
}

function buildDistillery() {
  const p = new Pix(64, 64);
  const g = new Pix(64, 64); // peças de trás, contornadas à parte
  // barril grande e o barrilete por cima
  drawBarrel(g, 59.5, 41, 62, 6.6, 1);
  drawKeg(g, 58.5, 34.5, 5.6);
  // serpentina: a metade de trás fica atrás do poste, a da frente por cima
  coil(g, false);
  // poste de madeira que segura a serpentina
  g.rect(44, 21, 3, 42, (x, y) => pick(PAL.wood, (x === 44 ? 0.62 : x === 45 ? 0.42 : 0.22) + (hash(x, y >> 2, 48) - 0.5) * 0.1, x, y));
  g.rect(43, 61, 5, 2, (x, y) => PAL.wood[y === 61 ? 3 : 1]);
  g.outline(PAL.out);
  p.blit(g, 0, 0);

  coil(p, true);
  // saída da serpentina com a torneira
  p.rect(50, 41, 2, 3, (x) => COPPER[x === 50 ? 4 : 2]);
  p.rect(49, 43, 3, 1, PAL.iron[3]);
  p.set(50, 44, COPPER[3]);

  // panela de cobre (cucúrbita) com a fileira de rebites
  p.fill(5, 25, 31, 45, (x, y) => ((x - 18) / 12) ** 2 + ((y - 35) / 9) ** 2 <= 1, (x, y) => metal(x, y, 18, 34.5, 12, 9));
  for (let x = 7; x <= 29; x++) p.set(x, 31, COPPER[x < 14 ? 2 : 1]);
  for (let x = 9; x <= 27; x += 3) p.set(x, 31, COPPER[5]);
  // pescoço e capitel em cúpula
  p.rect(15, 21, 7, 6, (x, y) => pick(COPPER, 0.15 + cylLight((x + 0.5 - 18.5) / 3.5) * 0.85, x, y));
  p.rect(14, 25, 9, 1, (x) => COPPER[x < 18 ? 5 : 2]);
  p.fill(12, 13, 25, 23, (x, y) => ((x - 18.5) / 6.2) ** 2 + ((y - 18) / 4.8) ** 2 <= 1, (x, y) => metal(x, y, 18.5, 18, 6.2, 4.8));
  p.rect(17, 12, 3, 2, (x, y) => COPPER[y === 12 ? (x === 17 ? 6 : 4) : 2]);
  p.rect(18, 11, 1, 1, PAL.iron[3]);
  // pescoço de cisne descendo até a serpentina
  for (let i = 0; i <= 40; i++) {
    const s = i / 40;
    const x = (1 - s) ** 2 * 23.5 + 2 * (1 - s) * s * 32 + s * s * 40.5;
    const y = (1 - s) ** 2 * 16.5 + 2 * (1 - s) * s * 12.5 + s * s * 24.5;
    p.set(x, y, COPPER[s < 0.5 ? 5 : 4]);
    p.set(x, y + 1, COPPER[3]);
    if (s < 0.45) p.set(x, y + 2, COPPER[1]);
  }

  // fornalha de tijolos com a boca em arco
  p.fill(4, 40, 32, 60, (x, y) => y >= 40.5 && Math.abs(x - 18) <= 13 - (y < 42 ? 0 : 1), (x, y) => {
    let v = 0.42 - ((x + 0.5 - 18) / 13) * 0.25 + masonry(x, y, 4, 2, 46, 40) * 1.1;
    v += clamp01(1 - Math.hypot((x - 18) / 9, (y - 54) / 7)) * 0.35; // calor perto da boca
    if (y < 42) v = 0.75 - (x - 4) * 0.012;
    return pick(BRICK, v, x, y);
  });
  p.fill(11, 45, 25, 59, archTest(18, 5.5, 45, 59), (x, y) => pick(BRICK, 0.85 - ((x + y) % 2) * 0.12, x, y));
  p.fill(13, 47, 23, 59, archTest(18, 4.5, 47, 59), MOUTH);
  // lenha na boca
  p.rect(14, 58, 9, 2, (x, y) => (y === 58 ? PAL.wood[(x % 3) + 1] : PAL.wood[0]));
  p.outline(PAL.out);
  // lenha empilhada ao lado da fornalha: pontas das toras viradas para a frente
  const w = new Pix(64, 64);
  for (const [x, y] of [[35.5, 60.5], [39.5, 60.5], [37.5, 57], [41.2, 57.4], [39.5, 53.8]]) {
    w.fill(x - 2, y - 2, x + 2, y + 2, (xx, yy) => Math.hypot(xx - x, yy - y) <= 1.9, (xx, yy) => {
      const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
      if (d > 1.3) return PAL.wood[xx + 0.5 < x ? 3 : 1];
      return d < 0.6 ? PAL.wood[2] : LOG_END;
    });
  }
  w.outline(PAL.out);
  p.blit(w, 0, 0);

  // frasco redondo recebendo o destilado
  const [qx, qy, qr] = FLASK;
  const f = new Pix(64, 64);
  f.rect(qx - 1, qy - qr - 4, 3, 5, (x) => (x === qx ? HOLLOW : GLASSY[x === qx - 1 ? 4 : 2]));
  f.rect(qx - 2, qy - qr - 5, 5, 1, (x) => GLASSY[x < qx ? 4 : 2]);
  glassBulb(f, qx, qy, qr, qy - 0.5, LIQ);
  f.outline(PAL.out);
  p.blit(clearHollow(f), 0, 0);
  return p;
}

// Ramo de ervas secando de cabeça para baixo na viga; balança com o ar quente.
function paintHerbBundle(f, x, t, len, leaf, bloom) {
  const sway = Math.sin(t * 1.3 + x) * 0.8;
  f.set(x, 3, PAL.straw[1]);
  for (let k = 0; k < len; k++) {
    const xx = x + Math.round(sway * (k / len));
    const w = k < 2 ? 0 : k < 4 ? 1 : 2;
    for (let i = -w; i <= w; i++) {
      if (k > 2 && Math.abs(i) === w && hash(i, k, x) < 0.4) continue;
      let c = k === 1 ? PAL.straw[3] : leaf[(i + k) % 2 ? 2 : 3 - (i > 0 ? 1 : 0)];
      if (k === 0) c = leaf[1];
      if (k >= len - 2 && (i + k) % 2 === 0) c = bloom[k === len - 1 ? 4 : 3];
      f.set(xx + i, 4 + k, c);
    }
  }
}

const distArt = { base: null, halo: null, mouth: null, copper: null, frame: new Pix(64, 64) };

function paintDistilleryPortrait(ctx, t, info) {
  const a = distArt;
  if (!a.base) {
    // fundo e corpo juntos; o brilho do fogo pulsa só no que fica à mostra
    const body = buildDistillery();
    const [fx, fy] = FURNACE;
    a.base = buildDistilleryBackdrop(0).blit(body, 0, 0);
    a.halo = makeHalo(a.base, buildDistilleryBackdrop(1).blit(body, 0, 0), (x, y) => Math.hypot(x + 0.5 - fx, (y + 0.5 - fy) * 1.15) / 44);
    const m = [];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (body.get(x, y) === MOUTH) m.push(x, y);
    a.mouth = Int8Array.from(m);
    a.copper = rampPixels(body, COPPER, 4, 10, 54, 48);
  }
  const working = info.working;
  const live = working ? 1 : 0.5;
  const f = a.frame.copyFrom(a.base);
  const flick = Math.sin(t * 9.1) * 0.5 + Math.sin(t * 14.7 + 1) * 0.3 + Math.sin(t * 3.3) * 0.2;
  paintHalo(f, a.halo, 0.38 + live * 0.16 + flick * 0.07 * live);
  paintHerbBundle(f, 28, t, 7, PAL.herb, PAL.herb);
  paintHerbBundle(f, 35, t + 1, 6, PAL.herb, PAL.lavender);
  paintHerbBundle(f, 42, t + 2, 7, SAGE, [0, 0, 0, CALENDULA[1], CALENDULA[2]]);
  paintFire(f, a.mouth, 47, 59, t * (working ? 1 : 0.6), live);
  // brasa iluminando o chão em frente
  for (let y = 60; y < 64; y++) {
    for (let x = 6; x < 31; x++) {
      const d = Math.hypot((x + 0.5 - 18) / 12, (y - 59.5) / 4.5);
      if (d < 1 && bayer(x, y) < (1 - d) * 0.6 * (0.8 + flick * 0.12)) f.set(x, y, PAL.fire[d < 0.45 ? 2 : 1]);
    }
  }
  // fagulhas saindo da boca
  for (let k = 0; k < (working ? 4 : 1); k++) {
    const life = (t * (0.7 + hash(k, 1, 47) * 0.4) + hash(k, 2, 47)) % 1;
    f.set(18 + (hash(k, 3, 47) - 0.5) * 9 * life + Math.sin(t * 5 + k) * 0.8, 50 - life * 8, PAL.fire[life < 0.5 ? 5 : 4]);
  }
  // vapor escapando pela válvula do capitel
  for (let k = 0; k < 4; k++) {
    const s = (t * (working ? 0.45 : 0.25) + k / 4) % 1;
    blob(f, 18.5 + Math.sin(s * 5 + k) * 1 + s * 4, 10 - s * 8, 0.8 + s * 2.2, (1 - s) * (working ? 1 : 0.7), STEAM);
  }
  // brilho correndo pelo cobre
  sweepGlint(f, a.copper, COPPER, ((t * 0.5) % 4) * 26 - 10, 1.6);
  // gota se formando na torneira, caindo e espirrando no frasco
  const [tx, ty] = TAP;
  const rate = working ? 1.1 : 0.55;
  const ph = (t * rate) % 1;
  const [qx, qy, qr] = FLASK;
  const mouthY = qy - qr - 5;
  if (ph < 0.55) {
    f.set(tx, ty, ph > 0.25 ? LIQ[4] : LIQ[3]);
  } else {
    const s = (ph - 0.55) / 0.45;
    const y = ty + s * s * (mouthY + 4 - ty);
    f.set(tx, y, LIQ[4]);
    f.set(tx, y - 1, LIQ[2]);
  }
  // ondinha e bolhas no destilado
  const lvl = Math.round(qy);
  const wob = Math.sin(t * 6) > 0 ? 1 : -1;
  f.set(qx + wob, lvl, LIQ[5]);
  for (let k = 0; k < (working ? 3 : 2); k++) {
    const s = (t * (0.6 + k * 0.17) + k * 0.37) % 1;
    f.set(qx - 2 + k * 2 + Math.round(Math.sin(t * 3 + k)), qy + qr - 1 - s * (qr - 0.5), LIQ[5]);
  }
  f.draw(ctx);
}

function iconDistillery() {
  const p = new Pix(16, 16);
  // fornalha com fogo
  p.rect(1, 12, 11, 3, (x, y) => pick(BRICK, 0.62 - (x - 1) * 0.03 + (((x + (y % 2) * 2) % 4) === 0 ? -0.22 : 0), x, y));
  p.rect(4, 12, 5, 3, (x, y) => PAL.fire[y === 14 ? 5 : y === 13 ? 4 : 3]);
  // panela larga, pescoço e capitel de cobre
  p.sphere(6.5, 9.2, 5.8, 3.6, COPPER, 0.22, 3);
  p.rect(2, 9, 10, 1, (x) => COPPER[x < 5 ? 3 : 2]);
  p.rect(5, 4, 3, 2, (x) => COPPER[x === 5 ? 5 : 3]);
  p.sphere(6.5, 3.2, 2.9, 2.1, COPPER, 0.25, 3);
  p.set(4, 7, COPPER[6]);
  p.set(5, 2, COPPER[6]);
  // cano descendo até a gota
  p.line(9, 2, 12, 4, COPPER[5]);
  p.line(9, 3, 12, 5, COPPER[3]);
  p.rect(13, 5, 2, 4, (x) => COPPER[x === 13 ? 4 : 2]);
  p.set(13, 10, LIQ[4]);
  p.set(13, 11, LIQ[3]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Alquimista

const AX = 32; // eixo do rosto
const ALC_HEAD = headTest(AX, 30.5, 9.2, 11.6, 0.26);
const LENSES = [[27.5, 30.5], [36.5, 30.5]];
const ALC_FLASK = [52.5, 36, 5.8]; // bulbo do frasco na mão
const ALC_CANDLE = [7, 29]; // pavio da vela da prateleira
const HOURGLASS = [32, 3]; // topo da ampulheta

// Garrafinhas da estante: [x, base, desenho, cor]; g vidro, d sombra, w brilho, c rolha, l rótulo.
const SHELF_ITEMS = [
  [1, 12, ['.c.', '.g.', 'wgd', 'ggd', 'gdd'], 4], [5, 12, ['c.', 'g.', 'w.', 'gd', 'gd', 'gd'], 2], [8, 12, ['ccc', 'gwg', 'lll', 'ggd'], 3],
  [41, 12, ['ccc', 'wgg', 'lll', 'gdd'], 0], [46, 12, ['.c.', '.g.', '.g.', 'wgd', 'gdd'], 1], [56, 12, ['c.', 'g.', 'wd', 'gd', 'gd'], 4], [60, 12, ['.c.', 'wgd', 'ggd', 'gdd'], 2],
  [11, 30, ['.c.', '.g.', 'wgd', 'ggd', 'gdd'], 1], [58, 30, ['c.', 'g.', 'g.', 'wd', 'gd', 'gd'], 0], [61, 30, ['ccc', 'wgg', 'lll', 'gdd'], 3],
  [1, 48, ['ccc', 'wgg', 'lll', 'ggd', 'gdd'], 2], [5, 48, ['.c.', 'wgd', 'gdd'], 4], [60, 48, ['.c.', '.g.', 'wgd', 'gdd'], 1],
];

function headTest(hx, hy, rx, ry, taper) {
  return (x, y) => {
    const dy = (y - hy) / ry;
    const w = dy > 0 ? rx * (1 - taper * dy * dy) : rx;
    return ((x - hx) / w) ** 2 + dy * dy <= 1;
  };
}

function buildAlchemistBackdrop() {
  const p = new Pix(64, 64);
  const [cx, cy] = ALC_CANDLE;
  // fundo do armário em tábuas, aquecido pela vela
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const warm = clamp01(1 - Math.hypot(x - cx, (y - cy + 3) * 1.2) / 24) * 0.3;
      let v = 0.24 + warm + (hash(x >> 2, y >> 3, 51) - 0.5) * 0.08 - y * 0.002;
      if (x % 8 === 0) v -= 0.12;
      p.d[y * 64 + x] = pick(PANEL, v, x, y, 2);
    }
  }
  // prateleiras
  for (const y of [13, 31, 49]) {
    p.rect(0, y, 64, 2, (x, yy) => pick(PAL.wood, yy === y ? 0.78 - Math.abs(x - 7) * 0.006 : 0.22, x, yy));
    p.rect(0, y + 2, 64, 1, PANEL[0]);
  }
  // frascos e garrafas
  for (const [x, base, rows, k] of SHELF_ITEMS) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      const y = base - rows.length + 1 + j;
      const c = { g: GLASS[k], d: GLASS_DARK[k], w: WHITE, c: PAL.wood[3], l: PAL.linen[3] }[ch];
      if (c) p.set(x + i, y, c);
    }));
  }
  // pilha de livros na prateleira de cima, atrás da cabeça
  for (const [x0, y0, w, c] of [[14, 10, 9, '#6a2a3a'], [15, 8, 7, '#2a4a6a'], [14, 6, 8, '#4a5a2a']]) {
    p.rect(x0, y0, w, 2, (x, y) => (x === x0 + w - 1 ? PAL.linen[3] : y === y0 ? C(c) : PAL.out));
  }
  // ampulheta de latão
  const [hx, hy] = HOURGLASS;
  p.rect(hx - 3, hy, 7, 1, PAL.gold[3]);
  p.rect(hx - 3, hy + 9, 7, 1, PAL.gold[2]);
  for (const x of [hx - 3, hx + 3]) p.rect(x, hy + 1, 1, 8, PAL.gold[x < hx ? 3 : 1]);
  p.fill(hx - 2, hy + 1, hx + 2, hy + 8, (x, y) => Math.abs(x - hx - 0.5) <= 0.6 + Math.abs(y - hy - 5) * 0.55, GLASSY[2]);
  // castiçal da vela
  p.rect(cx - 2, 30, 5, 1, PAL.gold[4]);
  p.rect(cx, 24 + 5, 1, 1, PAL.gold[2]);
  p.rect(cx - 1, 23 + 7 - 6, 3, 6, (x, y) => (x === cx - 1 ? WAX[3] : x === cx ? WAX[2] : WAX[1]));
  p.set(cx - 1, 24, WAX[3]);
  return p;
}

// Mão fechada segurando o frasco (canto em 51, 34); números são tons da pele.
const HAND = [
  '...ooo....',
  '..o5543o..',
  '..o44443oo',
  '.ooooo3332o',
  'o4443o3322o',
  'o2221o2321o',
  'o4443o3221o',
  'o2221o2211o',
  '.o443o2211o',
  '.o221o1110o',
  '..ooooooooo',
];

function buildAlchemist() {
  const p = new Pix(64, 64);
  // túnica roxa nos ombros
  p.poly([[0, 64], [1, 57], [6, 51.5], [15, 48], [24, 46.5], [41, 46.5], [50, 48], [59, 51.5], [64, 57], [65, 64]], (x, y) => {
    let v = 0.52 - ((x + 0.5 - AX) / 31) * 0.38 - (y - 50) * 0.012;
    v += clamp01(1 - Math.hypot((x - 9) / 8, (y - 54) / 5)) * 0.15;
    if (x === 11 || x === 54) v -= 0.18;
    return pick(ROBE, v, x, y);
  });
  // avental de couro com alças, rebites e marcas de queimado
  p.poly([[19.5, 64], [21, 50.5], [43, 50.5], [44.5, 64]], (x, y) => {
    let v = 0.55 - ((x + 0.5 - AX) / 12) * 0.25 + (y === 51 ? 0.25 : 0) + (hash(x, y, 52) - 0.5) * 0.14;
    if (hash(x >> 1, y >> 1, 53) < 0.06) v -= 0.3;
    return pick(PAL.leather, v, x, y);
  });
  for (const [x0, x1] of [[21, 17], [42, 46]]) {
    p.line(x0, 51, x1, 46.5, PAL.leather[x0 < AX ? 3 : 2]);
    p.line(x0 + (x0 < AX ? 1 : -1), 51, x1 + (x0 < AX ? 1 : -1), 46.5, PAL.leather[x0 < AX ? 2 : 1]);
  }
  p.set(22, 52, PAL.gold[4]);
  p.set(42, 52, PAL.gold[3]);
  // bolso com uma pena
  p.rect(23, 58, 7, 5, (x, y) => pick(PAL.leather, (y === 58 ? 0.85 : 0.4) - (x - 23) * 0.03, x, y));
  p.line(25, 57, 22, 52, PAL.linen[4]);
  p.line(26, 57, 23, 53, PAL.linen[2]);

  // cabelo branco revolto dos lados
  for (const [x, y, r] of [[21, 23, 3.4], [19.5, 28, 4.4], [20.5, 33.5, 3.8], [43, 23, 3.4], [44.5, 28, 4.4], [43.5, 33.5, 3.8]]) {
    p.fill(x - r - 1, y - r - 1, x + r + 1, y + r + 1, (xx, yy) => Math.hypot(xx - x, yy - y) <= r - hash(Math.floor(xx), Math.floor(yy), 54) * 0.9, (xx, yy) => {
      let v = 0.2 + sphereLight((xx + 0.5 - x) / r, (yy + 0.5 - y) / r) * 0.85 - (x > AX ? 0.12 : 0);
      if ((xx + yy * 2) % 4 === 0) v -= 0.16;
      return pick(BEARD_W, v, xx, yy, 1.8);
    });
  }
  // rosto com o alto da cabeça careca
  p.fill(21, 17, 43, 43, ALC_HEAD, (x, y) => {
    let v = 0.36 + sphereLight((x + 0.5 - AX + 1) / 9.2, (y + 0.5 - 28) / 11.6) * 0.78;
    if (y > 37) v -= 0.08;
    return pick(PAL.skin, v, x, y, 4);
  });
  for (const [x, y] of [[28, 20], [29, 20], [28, 21]]) p.set(x, y, PAL.skin[5]);
  // rugas da testa
  for (const x of [28, 29, 30, 34, 35, 36]) p.set(x, 24, PAL.skin[2]);
  for (const x of [30, 31, 32, 33, 34]) p.set(x, 22, PAL.skin[3]);
  // sobrancelhas brancas e fartas
  for (const [x, y] of [[24, 27], [25, 26], [26, 26], [27, 26], [28, 26], [29, 26], [30, 27], [25, 27]]) {
    p.set(x, y, BEARD_W[x === 26 || x === 27 ? 5 : 4]);
    p.set(64 - x, y, BEARD_W[3]);
  }
  // nariz grande e rosado, bochechas coradas
  for (const [x, y, k] of [[32, 32, 4], [32, 33, 4], [33, 33, 3], [31, 34, 3], [32, 34, 5], [33, 34, 3], [34, 34, 2], [30, 35, 2], [31, 35, 3], [32, 35, 4], [33, 35, 3], [34, 35, 2], [31, 36, 1], [32, 36, 2], [33, 36, 1]]) p.set(x, y, PAL.skin[k]);
  p.set(33, 34, PAL.blush);
  for (const [x, y] of [[24, 34], [25, 35], [23, 35]]) { p.set(x, y, PAL.blush); p.set(64 - x, y, PAL.blush); }

  // barba longa e branca
  const beardHalf = (y) => (y < 41 ? 9.6 : 9.6 * ((60 - y) / 19) ** 0.8);
  const inBeard = (x, y) => y > 35.5 && y < 60 && (ALC_HEAD(x, y) && (y > 38.5 || Math.abs(x - AX) > 7.4 - (y - 35.5) * 0.4) || Math.abs(x - AX) <= beardHalf(y));
  p.fill(20, 35, 44, 60, inBeard, (x, y) => {
    const l = sphereLight((x + 0.5 - AX + 2) / 11, (y + 0.5 - 40) / 14);
    const sx = x + Math.sin(y * 0.5) * 1.1 - (x - AX) * (y - 42) * 0.025;
    let v = 0.3 + l * 0.7 + (hash(Math.floor(sx / 2), 3, 55) - 0.5) * 0.24;
    if (Math.floor(sx) % 3 === 0) v -= 0.14;
    if (y > 54) v -= (y - 54) * 0.05;
    return pick(BEARD_W, v, x, y, 2.4);
  });
  // bigode caído e a boca
  for (let x = 25; x <= 39; x++) {
    const y = 37 + Math.round(Math.abs(x - AX) * 0.16);
    p.set(x, y, BEARD_W[x < AX ? 5 : 3]);
    p.set(x, y + 1, BEARD_W[x < AX ? 4 : 2]);
  }
  for (let x = 30; x <= 34; x++) p.set(x, 39, PAL.skin[0]);
  p.set(31, 40, PAL.lip);
  p.set(32, 40, PAL.lip);

  // óculos redondos de aro de latão
  paintAlchemistEyes(p, false);
  for (const [lx, ly] of LENSES) {
    p.fill(lx - 4, ly - 4, lx + 4, ly + 4, (x, y) => {
      const d = Math.hypot(x - lx, y - ly);
      return d > 2.5 && d <= 3.5;
    }, (x, y) => PAL.gold[x + 0.5 < lx && y + 0.5 < ly ? 5 : x + 0.5 > lx && y + 0.5 > ly ? 2 : 3]);
    p.set(lx - 1.5, ly - 1.5, WHITE);
  }
  p.rect(31, 30, 3, 1, PAL.gold[4]);
  p.line(24, 30, 22, 29, PAL.gold[2]);
  p.line(40, 30, 42, 29, PAL.gold[1]);

  // braço erguendo o frasco
  p.poly([[47.5, 64], [50, 54], [54, 46.5], [61.5, 45.5], [63, 52], [63.5, 64]], (x, y) => {
    let v = 0.48 - ((x + 0.5 - 56) / 7) * 0.3 - (y - 48) * 0.006;
    if (x === 53 && y > 53) v -= 0.15;
    return pick(ROBE, v, x, y);
  });
  p.poly([[53.5, 47.5], [55, 44.5], [62, 43.5], [62.5, 46.5]], (x, y) => pick(ROBE, y < 45 ? 0.8 : 0.45, x, y));
  p.outline(PAL.out);

  // frasco redondo com o líquido verde, contornado à parte
  const q = new Pix(64, 64);
  const [fx, fy, fr] = ALC_FLASK;
  q.rect(fx - 1.5, 22, 3, 9, (x) => (x === Math.floor(fx - 1.5) ? GLASSY[4] : x === Math.floor(fx - 0.5) ? HOLLOW : GLASSY[2]));
  q.rect(fx - 2.5, 21, 5, 1, (x) => GLASSY[x < fx ? 4 : 2]);
  glassBulb(q, fx, fy, fr, fy - 2.5, LIQ, 0.1);
  q.outline(PAL.out);
  clearHollow(q);
  // mão pela direita: polegar por cima e três dedos dobrados em volta do bulbo
  HAND.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === 'o') q.set(51 + i, 34 + j, PAL.out);
    else if (ch !== '.') q.set(51 + i, 34 + j, PAL.skin[+ch]);
  }));
  p.blit(q, 0, 0);
  return p;
}

// Olhos atrás das lentes, abertos ou piscando.
function paintAlchemistEyes(p, closed) {
  for (const [lx, ly] of LENSES) {
    const left = lx < AX;
    p.fill(lx - 3, ly - 3, lx + 3, ly + 3, (x, y) => Math.hypot(x - lx, y - ly) <= 2.6, (x, y) => PAL.skin[y < ly ? 4 : 3]);
    const x0 = Math.round(lx - 1.5), y0 = Math.round(ly - 0.5);
    if (closed) {
      for (let i = 0; i < 3; i++) p.set(x0 + i, y0 + 1, PAL.skin[1]);
      continue;
    }
    for (let i = 0; i < 3; i++) p.set(x0 + i, y0, PAL.skin[1]);
    const row = left ? [PAL.eyeWhite, PAL.iris, PAL.iris] : [PAL.iris, PAL.iris, PAL.eyeWhite];
    row.forEach((c, i) => p.set(x0 + i, y0 + 1, c));
    p.set(x0 + (left ? 2 : 1), y0 + 1, PAL.irisHi);
  }
}

const alcArt = { base: null, halo: null, frame: new Pix(64, 64) };

function paintAlchemistPortrait(ctx, t, info) {
  const a = alcArt;
  if (!a.base) {
    // fundo e corpo juntos; a luz verde do frasco acende por cima deles
    a.base = buildAlchemistBackdrop().blit(buildAlchemist(), 0, 0);
    const [fx, fy, fr] = ALC_FLASK;
    const R = 19;
    const lit = new Pix(64, 64).copyFrom(a.base);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const d = Math.hypot(x + 0.5 - fx, (y + 0.5 - fy) * 1.1);
        if (d < fr + 1.5 || d > R || lit.get(x, y) === PAL.out) continue;
        lit.set(x, y, mix(lit.get(x, y), LIQ[4], 0.36 * (1 - d / R) ** 0.8));
      }
    }
    a.halo = makeHalo(a.base, lit, (x, y) => Math.hypot(x + 0.5 - fx, (y + 0.5 - fy) * 1.1) / R);
  }
  const working = info.working;
  const f = a.frame.copyFrom(a.base);
  paintHalo(f, a.halo, (working ? 0.62 : 0.42) + Math.sin(t * 2.1) * 0.08 + Math.sin(t * 5.3) * 0.03);
  // vela e areia correndo na ampulheta
  paintCandle(f, ALC_CANDLE[0], ALC_CANDLE[1] - 6, t, 1, CANDLE_GLOW);
  const [hx, hy] = HOURGLASS;
  const sand = (t * 0.05) % 1;
  for (let y = hy + 1; y <= hy + 8; y++) {
    const half = 0.6 + Math.abs(y - hy - 5) * 0.55;
    const top = y < hy + 5 && y >= hy + 1 + Math.floor(sand * 4);
    const bottom = y > hy + 5 && y >= hy + 9 - Math.ceil(sand * 3.2);
    if (top || bottom) for (let x = Math.ceil(hx + 0.5 - half - 0.5); x <= Math.floor(hx + 0.5 + half - 0.5); x++) f.set(x, y, PAL.straw[x <= hx ? 4 : 3]);
  }
  f.set(hx, hy + 5 + (Math.floor(t * 8) % 3), PAL.straw[4]);
  // piscar atrás dos óculos
  if (t % 4.9 > 4.75 || t % 11.3 > 11.16) paintAlchemistEyes(f, true);
  // brilho passando pelas lentes
  const g = pulse(t, working ? 3.4 : 5.6, 0, 0.9);
  if (g > 0) {
    for (const [lx, ly] of LENSES) {
      const s = -3 + (1 - g) * 6;
      for (let k = -2; k <= 2; k++) {
        const x = Math.round(lx + s + k * 0.5), y = Math.round(ly + k);
        if (Math.hypot(x + 0.5 - lx, y + 0.5 - ly) <= 2.6) f.set(x, y, k === 0 ? WHITE : GLASSY[5]);
      }
    }
  }
  // bolhas subindo no líquido e a superfície mexendo
  const [fx, fy, fr] = ALC_FLASK;
  const bubbles = working ? 6 : 3;
  for (let k = 0; k < bubbles; k++) {
    const s = (t * (0.7 + hash(k, 1, 56) * 0.6) + hash(k, 2, 56)) % 1;
    const x = fx - 3 + hash(k, 3, 56) * 6 + Math.sin(t * 4 + k) * 0.6;
    const y = fy + fr - 1 - s * (fr + 1.5);
    if (LIQ.includes(f.get(Math.floor(x), Math.floor(y)))) f.set(x, y, s > 0.7 ? LIQ[5] : LIQ[4]);
  }
  const wx = Math.floor(fx - 2 + Math.sin(t * 5) * 2);
  if (LIQ.includes(f.get(wx, Math.floor(fy - 2)))) f.set(wx, fy - 2, LIQ[5]);
  // vapor colorido saindo da boca do frasco
  for (let k = 0; k < 5; k++) {
    const s = (t * (working ? 0.36 : 0.22) + k / 5) % 1;
    blob(f, fx + Math.sin(s * 6 + k * 1.3) * 1.6 - s * 6, 19.5 - s * 17, 1.2 + s * 2.6, 1.05 - s, SMOKE[(k + 1) % 3]);
  }
  // faíscas em volta do frasco
  for (let k = 0; k < (working ? 3 : 1); k++) {
    const e = pulse(t, 1.7 + k * 0.4, k * 0.9, 0.5);
    sparkle(f, Math.round(fx - 6 + hash(Math.floor((t + k * 0.9) / (1.7 + k * 0.4)), k, 57) * 12), Math.round(fy - 14 + hash(k, Math.floor(t / 1.7), 58) * 10), e, WHITE, LIQ[4]);
  }
  f.draw(ctx);
}

function iconAlchemist() {
  const p = new Pix(16, 16);
  // cabelo branco e barba
  for (const [x, y] of [[3, 6], [13, 6]]) p.sphere(x, y, 2.4, 3, BEARD_W, 0.1);
  const head = headTest(8, 7, 4.6, 5.6, 0.2);
  p.fill(3, 1, 13, 13, head, (x, y) => pick(PAL.skin, 0.3 + sphereLight((x + 0.5 - 8) / 4.6, (y + 0.5 - 6) / 5.6) * 0.85, x, y));
  p.fill(3, 8, 13, 16, (x, y) => y > 8.5 && Math.abs(x - 8) <= 4.8 * ((16.5 - y) / 7.5) ** 0.6, (x, y) => pick(BEARD_W, 0.75 - (x - 6) * 0.05 - (y - 9) * 0.03, x, y));
  // óculos
  for (const lx of [5.5, 10.5]) {
    p.fill(3, 4, 13, 9, (x, y) => Math.hypot(x - lx, y - 6.5) <= 2.1, (x, y) => (Math.hypot(x + 0.5 - lx, y + 0.5 - 6.5) > 1.2 ? PAL.gold[x < 8 ? 4 : 3] : GLASSY[4]));
  }
  p.set(5, 6, WHITE);
  p.set(10, 6, WHITE);
  p.set(8, 6, PAL.gold[4]);
  p.set(8, 9, PAL.skin[2]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Laboratório

const LAB_CANDLE = [11, 30]; // pavio
const CAULDRON = [7.5, 56, 10.5, 7]; // centro e raios do caldeirão
const SCALE = [35, 23]; // pivô do travessão da balança
const RETORT = [48.5, 33, 4.6]; // bulbo da retorta
const RECEIVER = [60, 36.4, 3.1]; // frasquinho que recebe o destilado
const LAB_WIN = archTest(29.5, 6.5, 3, 24);
const STARS = [[25, 8], [33, 6], [27, 14], [34, 17], [24, 20], [31, 11], [35, 12], [26, 4]];

function buildLabBackdrop(glow) {
  const p = new Pix(64, 64);
  const [cx, cy] = CAULDRON;
  const [lx, ly] = LAB_CANDLE;
  const green = (x, y) => (0.2 + glow * 0.24) * clamp01(1 - Math.hypot(x + 0.5 - cx, (y + 0.5 - cy + 9) * 1.15) / (30 + glow * 8)) ** 1.2;
  const warm = (x, y) => 0.26 * clamp01(1 - Math.hypot(x - lx, (y - ly + 2) * 1.1) / 20) ** 1.2;
  // parede de pedra arroxeada, com luz verde do caldeirão e quente da vela
  for (let y = 0; y < 53; y++) {
    for (let x = 0; x < 64; x++) {
      const g = green(x, y);
      const v = 0.16 + warm(x, y) + g + masonry(x, y, 7, 4, 61) * 0.9 + (hash(x, y, 62) - 0.5) * 0.05;
      p.d[y * 64 + x] = g > 0.03 + bayer(x, y) * 0.1 ? pick(LAB_WALL_G, v, x, y, 2) : pick(LAB_WALL, v, x, y, 2);
    }
  }
  // janela em arco com o céu do anoitecer, lua e estrelas
  p.fill(21, 2, 38, 26, archTest(29.5, 8, 1.5, 26), (x, y) => pick(LAB_WALL, 0.55 - (x > 29 ? 0.18 : 0) + masonry(x, y, 3, 3, 63) * 0.6 + warm(x, y), x, y));
  p.fill(22, 3, 37, 24, LAB_WIN, (x, y) => pick(DUSK_SKY, 0.05 + (y - 3) * 0.045, x, y, 1.6));
  p.fill(22, 18, 37, 24, (x, y) => LAB_WIN(x, y) && y > 20 + Math.sin(x * 0.9) * 1.2 + Math.sin(x * 0.4) * 1.5, (x, y) => pick(PAL.night, 0.5 - (y - 20) * 0.1, x, y));
  p.sphere(32.5, 8.5, 2.6, 2.6, ramp('#8a8070', '#d8ceb0', '#fbf3d6'), 0.2);
  p.ellipse(33.8, 7.6, 2.2, 2.3, DUSK_SKY[1]);
  for (const [x, y] of STARS) if (LAB_WIN(x + 0.5, y + 0.5)) p.set(x, y, DUSK_SKY[5]);
  p.rect(29, 3, 2, 22, (x) => PAL.iron[x === 29 ? 2 : 1]);
  p.rect(21, 25, 18, 2, (x, y) => pick(LAB_WALL, y === 25 ? 0.8 : 0.35, x, y));
  // chão de lajes
  for (let y = 53; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const row = Math.floor((y - 53) / 3), off = (row % 2) * 4;
      const edge = (y - 53) % 3 === 2 || (x + off) % 9 === 0;
      const g = green(x, y) * 1.2;
      let v = 0.2 + g + (hash(Math.floor((x + off) / 9), row, 64) - 0.5) * 0.14 + (y - 53) * 0.015;
      if (edge) v -= 0.16;
      p.d[y * 64 + x] = g > 0.05 + bayer(x, y) * 0.1 ? pick(LAB_WALL_G, v, x, y, 2) : pick(LAB_WALL, v, x, y, 2);
    }
  }
  return p;
}

function buildLaboratory() {
  const p = new Pix(64, 64);
  // prateleira da esquerda com livros e um pote
  p.rect(0, 13, 16, 2, (x, y) => pick(PAL.wood, y === 13 ? 0.72 : 0.2, x, y));
  for (const [x, h, c] of [[1, 7, '#6a2a3a'], [3, 6, '#2a4a6a'], [5, 8, '#4a5a2a'], [7, 6, '#6a4a2a'], [8, 7, '#3a2a5a']]) {
    p.rect(x, 13 - h, 2, h, (xx, yy) => (xx === x ? C(c) : PAL.out));
    p.set(x, 13 - h + 2, PAL.gold[3]);
  }
  p.sphere(12.5, 10.5, 2.4, 2.4, ramp('#2a3a30', '#3e6a4a', '#6aa070', '#b0e0b0'), 0.1);
  p.rect(11, 7, 3, 1, PAL.wood[3]);
  // prateleira da direita com frascos e um vaso de mandrágora
  p.rect(41, 15, 23, 2, (x, y) => pick(PAL.wood, y === 15 ? 0.6 : 0.18, x, y));
  for (const [x, rows, k] of [[42, ['.c.', '.g.', 'wgd', 'gdd'], 1], [46, ['c.', 'g.', 'wd', 'gd', 'gd'], 4], [49, ['ccc', 'wgg', 'lll', 'gdd'], 3], [60, ['.c.', 'wgd', 'ggd', 'gdd'], 0]]) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      const c = { g: GLASS[k], d: GLASS_DARK[k], w: WHITE, c: PAL.wood[3], l: PAL.linen[3] }[ch];
      if (c) p.set(x + i, 15 - rows.length + j, c);
    }));
  }
  p.rect(53, 11, 5, 4, (x, y) => pick(BRICK, 0.6 - (x - 53) * 0.08 + (y === 11 ? 0.2 : 0), x, y));
  for (const [x, y, c] of [[54, 10, 3], [55, 9, 4], [56, 10, 2], [53, 9, 3], [57, 8, 3], [55, 8, 5]]) p.set(x, y, PAL.herb[c]);
  // caixote de garrafas no chão, com palha
  p.rect(44, 55, 17, 9, (x, y) => {
    let v = 0.5 - (x - 44) * 0.012 + (hash(x >> 2, y, 73) - 0.5) * 0.1;
    if (y === 55) v += 0.25;
    if ((y - 55) % 4 === 3) v -= 0.25;
    if (x === 44 || x === 60) v -= 0.15;
    return pick(PAL.wood, v, x, y);
  });
  p.line(45, 62, 59, 56, PAL.wood[1]);
  for (const [x, k] of [[47, 2], [50, 4], [53, 0], [56, 1]]) {
    p.rect(x, 50, 2, 5, (xx, yy) => (yy === 50 ? PAL.wood[3] : xx === x ? GLASS[k] : GLASS_DARK[k]));
    p.set(x, 52, WHITE);
  }
  for (let x = 45; x < 60; x++) p.set(x, 54, PAL.straw[(x * 3) % 4 + 1]);
  p.set(46, 53, PAL.straw[4]); p.set(52, 53, PAL.straw[3]); p.set(58, 53, PAL.straw[4]);
  // bancada de madeira: tampo, frente de tábuas, pernas e prateleira de baixo
  p.rect(0, 40, 64, 2, (x, y) => pick(PAL.wood, (y === 40 ? 0.8 : 0.5) + (hash(x >> 3, y, 65) - 0.5) * 0.12, x, y));
  p.rect(0, 42, 64, 4, (x, y) => {
    let v = 0.38 - (y - 42) * 0.05 + (hash(x >> 2, y, 66) - 0.5) * 0.12;
    if (x % 16 === 0) v -= 0.2;
    return pick(PAL.wood, v, x, y);
  });
  for (const x of [28, 59]) p.rect(x, 46, 3, 7, (xx) => PAL.wood[xx === x ? 3 : 1]);
  p.rect(26, 50, 38, 1, PAL.wood[2]);
  // jarros embaixo da bancada
  p.sphere(38, 47.5, 2.4, 2.4, BRICK, -0.05);
  p.sphere(43, 48, 2, 2, ramp('#3a3a2a', '#6a6a4a', '#9a9a6a'), 0);
  p.rect(48, 46, 6, 4, (x, y) => pick(PAL.wood, 0.5 - (x - 48) * 0.05 - (y === 46 ? -0.2 : 0), x, y));

  // almofariz de pedra com o pilão
  p.line(5, 36, 3, 31, PAL.wood[4]);
  p.line(6, 36, 4, 31, PAL.wood[2]);
  p.fill(0, 35, 9, 40, (x, y) => y >= 35.5 && ((x - 5) / 3.6) ** 2 + ((y - 35.5) / 4.4) ** 2 <= 1, (x, y) =>
    pick(PAL.stone, (y === 35 ? 0.85 : 0.25 + cylLight((x + 0.5 - 5) / 3.6) * 0.7) + (hash(x, y, 68) - 0.5) * 0.1, x, y));
  p.rect(2, 35, 6, 1, (x) => PAL.stone[x < 5 ? 5 : 4]);
  p.rect(3, 36, 4, 1, PAL.herb[2]);
  // vela no prato de latão
  p.rect(9, 39, 5, 1, (x) => PAL.gold[x < 11 ? 4 : 2]);
  p.rect(10, 31, 3, 8, (x, y) => WAX[x === 10 ? 3 : x === 11 ? 2 : 1]);
  p.set(10, 33, WAX[2]);
  p.set(12, 35, WAX[3]);
  p.set(13, 38, WAX[2]);
  // livro aberto: páginas com linhas de texto e a fita marcadora
  const BX = 21.5;
  p.rect(14, 39, 16, 1, PAL.leather[2]);
  p.fill(14, 33, 29, 39, (x, y) => y >= 34.6 + Math.exp(-((x + 0.5 - BX) ** 2) / 3) * 1.4 - Math.abs(x + 0.5 - BX) * 0.08, (x, y) => {
    let v = x < BX ? 0.82 : 0.66;
    if (Math.abs(x + 0.5 - BX) < 1) v -= 0.25;
    const row = y - 36;
    if (row >= 0 && row % 2 === 0 && Math.abs(x + 0.5 - BX) > 1.5 && x > 14 && x < 28 && hash(x, y, 67) < 0.75) return PAL.linen[1];
    return pick(PAL.linen, v, x, y);
  });
  p.rect(21, 40, 1, 4, (x, y) => (y % 2 ? PAL.scarf[2] : PAL.scarf[1]));
  // balança: base e coluna de latão (o travessão é desenhado no quadro)
  p.rect(31, 38, 8, 2, (x, y) => PAL.gold[y === 38 ? (x < 34 ? 5 : 4) : 2]);
  p.rect(34, 23, 2, 15, (x) => PAL.gold[x === 34 ? 4 : 2]);
  p.sphere(34.9, 21.6, 1.2, 1.2, PAL.gold, 0.1);
  // tripé de ferro com a lamparina embaixo da retorta
  const [rx, ry, rr] = RETORT;
  p.line(44, 39, 45, 37, PAL.iron[2]);
  p.line(53, 39, 52, 37, PAL.iron[1]);
  p.rect(44, 37, 10, 1, (x) => PAL.iron[x < 48 ? 3 : 2]);
  p.rect(47, 38, 3, 2, (x, y) => PAL.gold[y === 38 ? 4 : 2]);
  p.outline(PAL.out);

  // retorta de vidro com líquido lilás e o bico descendo até o frasquinho
  const q = new Pix(64, 64);
  const [ex, ey, er] = RECEIVER;
  for (let i = 0; i <= 36; i++) {
    const s = i / 36;
    const x = (1 - s) ** 2 * (rx + 2.5) + 2 * (1 - s) * s * (rx + 7) + s * s * (ex - 0.5);
    const y = (1 - s) ** 2 * (ry - 3.5) + 2 * (1 - s) * s * (ry - 10) + s * s * (ey - er - 1);
    q.set(x, y, GLASSY[4]);
    if (s < 0.55) q.set(x, y + 1, GLASSY[2]);
    if (s < 0.25) q.set(x - 1, y + 1, GLASSY[3]);
  }
  glassBulb(q, rx, ry, rr, ry - 0.5, PAL.lavender);
  q.rect(ex - 1, ey - er - 1.5, 2, 2, (x) => GLASSY[x === Math.floor(ex - 1) ? 4 : 2]);
  glassBulb(q, ex, ey, er, ey - 0.2, PINK);
  q.outline(PAL.out);
  p.blit(clearHollow(q), 0, 0);

  // caldeirão de ferro na frente, sobre três pés e a fogueira
  const k = new Pix(64, 64);
  const [cx, cy, crx, cry] = CAULDRON;
  for (const [x, d] of [[0, -1], [7, 0], [15, 1]]) k.line(x, 60, x + d, 63, POT[d < 0 ? 3 : 1]);
  k.fill(cx - crx, cy - cry - 1, cx + crx, cy + cry, (x, y) => ((x - cx) / crx) ** 2 + ((y - cy) / cry) ** 2 <= 1 && y > cy - cry + 1.5, (x, y) => {
    const nx = (x + 0.5 - cx) / crx, ny = (y + 0.5 - cy) / cry;
    let v = 0.06 + sphereLight(nx, ny) * 0.8;
    if (ny < -0.4) v += 0.12; // brilho verde da borda
    if (hash(x >> 1, y, 69) < 0.08) v -= 0.12;
    return pick(POT, v, x, y);
  });
  // boca: aro grosso e o caldo verde
  k.ellipse(cx, cy - cry + 2, crx - 0.8, 2.6, (x, y) => POT[x < cx - 2 ? 5 : x < cx + 4 ? 4 : 3]);
  k.ellipse(cx, cy - cry + 2.2, crx - 2.2, 1.7, (x, y) => pick(LIQ, 0.55 + (1 - Math.abs(x + 0.5 - cx) / (crx - 2.2)) * 0.45, x, y));
  // alças
  for (const x of [cx - crx - 0.5, cx + crx - 0.5]) k.rect(x, cy - 3, 1, 3, POT[x < cx ? 4 : 2]);
  k.outline(PAL.out);
  p.blit(k, 0, 0);
  // lenha da fogueira entre os pés
  p.rect(1, 62, 14, 2, (x, y) => (y === 62 ? PAL.wood[(x % 3) + 1] : PAL.wood[0]));
  return p;
}

// Travessão da balança inclinado (a), com as correntes e os pratos.
const scaleCache = new Map();
function paintScale(f, a) {
  const key = Math.round(a * 60);
  let sp = scaleCache.get(key);
  if (!sp) {
    sp = new Pix(24, 18);
    const ox = 12, oy = 1; // pivô dentro do sprite
    const L = 6;
    const ca = Math.cos(key / 60), sa = Math.sin(key / 60);
    for (let k = -L; k <= L; k += 0.5) sp.set(ox + k * ca, oy + k * sa, PAL.gold[k < 0 ? 4 : 3]);
    sp.set(ox, oy, PAL.gold[5]);
    for (const side of [-1, 1]) {
      const ex = ox + side * L * ca, ey = oy + side * L * sa;
      for (let k = 1; k < 7; k++) sp.set(ex, ey + k, k % 2 ? PAL.iron[3] : PAL.iron[2]);
      const by = Math.round(ey + 7);
      sp.rect(Math.round(ex) - 2, by, 5, 1, (x) => PAL.gold[x < ex ? 5 : 3]);
      sp.rect(Math.round(ex) - 1, by + 1, 3, 1, PAL.gold[1]);
      if (side < 0) { sp.set(ex - 1, by - 1, PAL.herb[4]); sp.set(ex, by - 1, PAL.herb[3]); sp.set(ex + 1, by - 1, PAL.lavender[4]); }
      else sp.rect(Math.round(ex) - 1, by - 2, 2, 2, (x, y) => PAL.iron[y === by - 2 ? 4 : 2]);
    }
    sp.outline(PAL.out);
    scaleCache.set(key, sp);
  }
  f.blit(sp, SCALE[0] - 12, SCALE[1] - 1);
}

const labArt = { base: null, halo: null, frame: new Pix(64, 64) };

function paintLaboratoryPortrait(ctx, t, info) {
  const a = labArt;
  const [cx, cy, crx, cry] = CAULDRON;
  if (!a.base) {
    // fundo e corpo juntos; a luz verde do caldeirão pulsa só no que fica à mostra
    const body = buildLaboratory();
    a.base = buildLabBackdrop(0).blit(body, 0, 0);
    a.halo = makeHalo(a.base, buildLabBackdrop(1).blit(body, 0, 0), (x, y) => Math.hypot(x + 0.5 - cx, (y + 0.5 - cy + 9) * 1.15) / 40);
  }
  const working = info.working;
  const live = working ? 1 : 0.55;
  const f = a.frame.copyFrom(a.base);
  const flick = Math.sin(t * 3.1) * 0.5 + Math.sin(t * 7.7 + 1) * 0.3;
  paintHalo(f, a.halo, 0.4 + live * 0.18 + flick * 0.06);
  // estrelas piscando na janela
  STARS.forEach(([x, y], i) => {
    if (!LAB_WIN(x + 0.5, y + 0.5)) return;
    const e = pulse(t, 2.3 + i * 0.37, i * 0.71, 0.6);
    if (e > 0.5) { f.set(x, y, WHITE); f.set(x + 1, y, DUSK_SKY[5]); f.set(x - 1, y, DUSK_SKY[5]); }
  });
  paintScale(f, Math.sin(t * (working ? 1.1 : 0.6)) * 0.14 + Math.sin(t * 0.37) * 0.04);
  paintCandle(f, LAB_CANDLE[0], LAB_CANDLE[1], t, 3, CANDLE_GLOW);
  // chama da lamparina e bolhas na retorta
  const [rx, ry, rr] = RETORT;
  const fl = Math.sin(t * 12) > 0;
  f.set(48, 37, PAL.fire[5]);
  f.set(48 + (fl ? 1 : 0), 36, PAL.fire[3]);
  for (let k = 0; k < (working ? 3 : 2); k++) {
    const s = (t * (0.9 + k * 0.3) + k * 0.4) % 1;
    const x = Math.round(rx - 2 + k * 2 + Math.sin(t * 4 + k) * 0.5), y = Math.round(ry + rr - 1 - s * (rr - 0.5));
    if (PAL.lavender.includes(f.get(x, y))) f.set(x, y, PAL.lavender[5]);
  }
  // gota pingando do bico no frasquinho
  const [ex, ey, er] = RECEIVER;
  const ph = (t * (working ? 0.9 : 0.5)) % 1;
  if (ph > 0.6) f.set(ex - 0.5, ey - er - 3 + (ph - 0.6) * 6, PINK[4]);
  // fogo embaixo do caldeirão
  for (let x = 1; x < 15; x++) {
    const h = 1.5 + live * 1.5 + Math.sin(t * 9 + x * 1.7) * 1 + Math.sin(t * 13 - x) * 0.6;
    for (let k = 0; k < h; k++) f.set(x, 61 - k, PAL.fire[Math.max(1, 5 - Math.floor((k / h) * 4) - (x % 3 === 0 ? 1 : 0))]);
  }
  // caldo borbulhando: bolhas que crescem e estouram
  const sy = cy - cry + 2.2;
  for (let k = 0; k < (working ? 5 : 3); k++) {
    const s = (t * (0.6 + hash(k, 1, 70) * 0.5) + hash(k, 2, 70)) % 1;
    const bx = Math.round(cx - 5 + hash(k, 3, 70) * 10 + (Math.floor(t * 0.6 + hash(k, 2, 70)) * 3.7) % 4 - 2);
    const by = Math.round(sy + (hash(k, 4, 70) - 0.5) * 1.5);
    if (s < 0.75) {
      f.set(bx, by, LIQ[5]);
      if (s > 0.35) { f.set(bx - 1, by, LIQ[4]); f.set(bx + 1, by, LIQ[3]); f.set(bx, by - 1, LIQ[5]); }
    } else {
      const r = 1 + (s - 0.75) * 6;
      f.set(bx - r, by - 1, LIQ[4]); f.set(bx + r, by - 1, LIQ[4]); f.set(bx, by - r, LIQ[5]);
    }
  }
  // fumaça colorida subindo: verde, depois lilás e rosa
  const n = working ? 8 : 6;
  for (let k = 0; k < n; k++) {
    const s = (t * (working ? 0.15 : 0.1) + k / n) % 1;
    const x = cx + 1 - s * 6 + Math.sin(s * 7 + k * 1.9) * 2;
    const y = sy - 2 - s * 40;
    blob(f, x, y, 1.8 + s * 3.4, 1.05 - s, SMOKE[s < 0.3 ? 0 : s < 0.62 ? 1 : 2]);
  }
  // faíscas mágicas na fumaça
  if (working) {
    for (let k = 0; k < 3; k++) {
      const e = pulse(t, 1.3 + k * 0.5, k * 0.6, 0.45);
      const cyc = Math.floor((t + k * 0.6) / (1.3 + k * 0.5));
      sparkle(f, Math.round(cx - 6 + hash(cyc, k, 71) * 10), Math.round(10 + hash(k, cyc, 72) * 24), e, WHITE, PAL.lavender[4]);
    }
  }
  f.draw(ctx);
}

function iconLaboratory() {
  const p = new Pix(16, 16);
  // fumaça colorida
  p.sphere(10, 2.6, 2.3, 2, SMOKE[1], 0.25);
  p.sphere(6, 3.4, 1.7, 1.5, SMOKE[0], 0.25);
  // caldeirão de ferro com o caldo verde
  p.fill(1, 6, 15, 13, (x, y) => ((x - 8) / 6.6) ** 2 + ((y - 9.4) / 4.2) ** 2 <= 1 && y > 6.5, (x, y) =>
    pick(PAL.iron, 0.05 + sphereLight((x + 0.5 - 8) / 6.6, (y + 0.5 - 8.6) / 4.2) * 0.9, x, y));
  p.rect(1, 6, 14, 2, (x, y) => PAL.iron[y === 6 ? (x < 7 ? 4 : 3) : 1]);
  p.rect(3, 6, 10, 1, (x) => LIQ[x < 8 ? 5 : 4]);
  p.set(5, 5, LIQ[5]);
  p.set(10, 4, LIQ[4]);
  // fogo embaixo
  for (const [x, h] of [[5, 2], [7, 3], [9, 2], [11, 2]]) for (let k = 0; k < h; k++) p.set(x, 14 - k, PAL.fire[5 - k * 2]);
  p.outline(PAL.out);
  return p;
}

ART.portraits.monastery = paintMonasteryPortrait;
ART.locked.monastery = ART.silhouette(() => {
  const p = buildMonastery();
  paintBell(p, 0, 0);
  return p;
});
ART.icons.monastery = iconMonastery;
ART.portraits.distillery = paintDistilleryPortrait;
ART.locked.distillery = ART.silhouette(buildDistillery);
ART.icons.distillery = iconDistillery;
ART.portraits.alchemist = paintAlchemistPortrait;
ART.locked.alchemist = ART.silhouette(buildAlchemist);
ART.icons.alchemist = iconAlchemist;
ART.portraits.laboratory = paintLaboratoryPortrait;
ART.locked.laboratory = ART.silhouette(() => {
  const p = buildLaboratory();
  paintScale(p, 0);
  return p;
});
ART.icons.laboratory = iconLaboratory;
})();
