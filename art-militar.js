'use strict';
// Linha de produção: MILITAR (armas).
// Ferreiro (tier 1) forja armas, Forja (tier 2) forma ferreiros, Arsenal (tier 3) virá depois.
// Aqui ficam os retratos, os ícones e a cena do pátio do castelo ao entardecer.

(() => {
const { C, ramp, pick, hash, bayer, clamp01, sphereLight, cylLight, Pix } = PixelArt;
const { PAL, paintSky, paintSun } = ART;

const SOOT_WALL = ramp('#120a0a', '#1f120e', '#331d14', '#4c2a19', '#6c3b1f', '#925228', '#b86c32');
const TUNIC = ramp('#161114', '#271e22', '#3b2e32', '#524246', '#6a585a');
const STONE_WARM = ramp('#2a2026', '#3e3036', '#5a4648', '#7a6058', '#9c7c68', '#c09c7e');
const PURPLE_HILLS = ramp('#2e2244', '#3e2e56', '#523c68', '#684c78');
const DUSK_SMOKE = ramp('#3a3040', '#5a4a5a', '#7a6a76', '#a08e96', '#c4b4b4');
const MOUTH = C('#1a0805');

// Fogo dentro de uma boca de forja: mais quente embaixo, chamas tremendo.
function paintFire(p, pts, ox, oy, top, bottom, t, seed = 0) {
  const span = bottom - top;
  const tick = Math.floor(t * 14);
  for (const [x, y] of pts) {
    const n = Math.sin(t * 8 + x * 1.7 + y * 0.9 + seed) * 0.18 + (hash(x, y, tick + seed) - 0.5) * 0.3;
    const v = 1.15 - ((bottom - y) / span) * 1.25 + n;
    if (v > 0.12) p.set(ox + x, oy + y, pick(PAL.fire, v, x, y, 1.5));
  }
}

// ---------------------------------------------------------------------------
// Ferreiro

function buildSmithBackdrop() {
  const p = new Pix(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const glow = clamp01(1 - Math.hypot(x - 66, y - 66) / 78);
      const row = Math.floor(y / 6), off = (row % 2) * 5;
      const mortar = y % 6 === 5 || (x + off) % 10 === 0;
      const v = 0.06 + glow * glow + (hash(Math.floor((x + off) / 10), row, 3) - 0.5) * 0.12 - (mortar ? 0.12 : 0);
      p.d[y * 64 + x] = pick(SOOT_WALL, v, x, y, 2);
    }
  }
  // prateleira de ferramentas na parede
  p.rect(3, 11, 24, 2, (x, y) => PAL.wood[y === 11 ? 2 : 1]);
  p.line(7, 13, 5, 27, PAL.steel[1]);
  p.line(9, 13, 11, 27, PAL.steel[2]);
  p.set(8, 13, PAL.steel[2]);
  p.line(16, 13, 16, 25, PAL.wood[1]);
  p.rect(13, 25, 7, 3, (x) => PAL.steel[x < 15 ? 2 : 1]);
  for (let a = 0; a <= Math.PI; a += 0.12) p.set(23.5 + Math.cos(a) * 2.6, 15 + Math.sin(a) * 3.2, PAL.steel[2]);
  return p;
}

function buildSmith() {
  const p = new Pix(64, 64);
  // tronco e braços nus, com a luz da forja batendo pela direita
  p.poly([[0, 64], [2, 55], [9, 49], [20, 45.5], [44, 45.5], [55, 49], [62, 55], [64, 64]], (x, y) => {
    const nx = (x + 0.5 - 32) / 31;
    let v = 0.3 + nx * 0.38 - (y - 50) * 0.006;
    if (nx > 0.72) v += 0.28;
    return pick(PAL.skin, v, x, y);
  });
  // regata escura
  p.poly([[14, 64], [15, 53], [21, 48], [43, 48], [49, 53], [50, 64]], (x, y) => pick(TUNIC, 0.35 + ((x + 0.5 - 32) / 18) * 0.35, x, y));
  // avental de couro, com marcas de queimado
  p.poly([[17, 64], [18, 54.5], [46, 54.5], [47, 64]], (x, y) => {
    let v = 0.42 + ((x + 0.5 - 32) / 15) * 0.32 + (y === 55 ? 0.25 : 0) + (hash(x, y, 4) - 0.5) * 0.14;
    if (hash(x, y, 9) < 0.05) v -= 0.3;
    return pick(PAL.leather, v, x, y);
  });
  for (const [x0, y0, x1, y1] of [[20, 55, 24, 46], [21, 55, 25, 46], [44, 55, 40, 46], [43, 55, 39, 46]]) {
    p.line(x0, y0, x1, y1, PAL.leather[x0 > 32 ? 3 : 2]);
  }
  p.set(20, 56, PAL.gold[4]);
  p.set(44, 56, PAL.gold[4]);
  // pescoço largo
  p.rect(26, 39, 12, 9, (x, y) => pick(PAL.skin, 0.22 + (x - 32) * 0.035 + (y > 44 ? 0.1 : 0), x, y));
  // orelhas
  p.sphere(20.4, 32, 2.2, 3.2, PAL.skin, -0.1);
  p.sphere(43.6, 32, 2.2, 3.2, PAL.skin, 0.2);

  // cabeça careca
  const hx = 32, hy = 30.5, hrx = 11.6, hry = 12.6;
  const inHead = (x, y) => {
    const dy = (y - hy) / hry;
    const rx = dy > 0 ? hrx * (1 - 0.22 * dy * dy) : hrx;
    return ((x - hx) / rx) ** 2 + dy * dy <= 1;
  };
  p.fill(hx - hrx, hy - hry, hx + hrx, hy + hry, inHead, (x, y) => {
    const nx = (x + 0.5 - hx) / hrx, ny = (y + 0.5 - hy) / hry;
    let v = 0.12 + sphereLight(-nx * 0.9, ny) * 0.95;
    if (nx > 0.75) v += 0.2;
    return pick(PAL.skin, v, x, y);
  });
  p.set(36, 20, PAL.skin[5]);
  p.set(37, 20, PAL.skin[5]);
  p.set(37, 21, PAL.skin[4]);
  // faixa na testa, com o nó caindo do lado
  p.fill(18, 22, 46, 26, (x, y) => inHead(x, y) && y > 22 && y < 25.6, (x, y) =>
    pick(PAL.band, 0.3 + ((x - 32) / 12) * 0.35 + (y === 23 ? 0.25 : 0), x, y));
  for (const [x, y, k] of [[19, 24, 1], [18, 25, 2], [17, 26, 2], [17, 27, 1], [16, 28, 2], [18, 27, 1], [17, 29, 1], [16, 30, 2]]) p.set(x, y, PAL.band[k]);
  // sobrancelhas grossas
  for (let x = 25; x <= 29; x++) {
    p.set(x, 28, PAL.beard[1]);
    p.set(63 - x, 28, PAL.beard[1]);
  }
  p.set(25, 29, PAL.beard[1]);
  p.set(38, 29, PAL.beard[1]);
  // olhos
  for (const [x, c] of [[26, PAL.eyeWhite], [27, PAL.iris], [28, PAL.iris], [35, PAL.iris], [36, PAL.iris], [37, PAL.eyeWhite]]) p.set(x, 31, c);
  p.set(27, 32, PAL.skin[2]);
  p.set(36, 32, PAL.skin[3]);
  // nariz largo
  for (const [x, y, k] of [[31, 32, 3], [31, 33, 3], [32, 33, 4], [32, 34, 4], [31, 34, 2], [30, 35, 1], [31, 35, 2], [32, 35, 3], [33, 35, 3], [33, 34, 5]]) p.set(x, y, PAL.skin[k]);

  // barba cheia descendo pelo peito
  const inBeard = (x, y) => {
    if (y < 34.5) return false;
    if (inHead(x, y) && (y > 36.5 || Math.abs(x - 32) > 7.8)) return true;
    const w = 10.5 - Math.max(0, y - 41) * 0.75;
    return y < 51 && y > 38 && Math.abs(x - 32) <= w;
  };
  p.fill(18, 34, 46, 51, inBeard, (x, y) => {
    const l = sphereLight(-(x + 0.5 - 32) / 11, (y + 0.5 - 38) / 13);
    let v = 0.2 + l * 0.7 + (hash(x, y, 6) - 0.5) * 0.2;
    if ((x * 2 + y) % 5 === 0) v -= 0.18;
    return pick(PAL.beard, v, x, y, 1.6);
  });
  for (let x = 28; x <= 35; x++) p.set(x, 37, PAL.beard[x > 32 ? 3 : 2]);
  for (let x = 30; x <= 33; x++) p.set(x, 39, PAL.beard[0]);
  // fuligem no rosto
  for (const [x, y] of [[24, 34], [25, 35], [39, 26], [40, 27]]) p.set(x, y, PAL.skin[1]);

  // martelo apoiado no ombro
  p.line(44, 63, 52, 41, PAL.wood[2]);
  p.line(45, 63, 53, 41, PAL.wood[3]);
  const ux = 0.35, uy = -0.94, vx = 0.94, vy = 0.35, cx = 55, cy = 36;
  p.fill(46, 26, 63, 44, (x, y) => {
    const dx = x - cx, dy = y - cy;
    const a = dx * vx + dy * vy, b = dx * ux + dy * uy;
    return a >= -6 && a <= 5.5 && Math.abs(b) <= 2.8;
  }, (x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const a = dx * vx + dy * vy, b = dx * ux + dy * uy;
    return pick(PAL.steel, 0.5 + b * 0.12 + (a > 4.5 ? 0.25 : 0) - (a < -5 ? 0.15 : 0), x, y);
  });
  p.sphere(48.5, 53, 3.2, 2.8, PAL.skin, 0.2);
  p.line(46, 53, 51, 54, PAL.skin[2]);
  p.outline(PAL.out);
  return p;
}

const smithArt = { bg: null, body: null, frame: new Pix(64, 64) };

function paintSmithPortrait(ctx, t, info) {
  const a = smithArt;
  if (!a.bg) {
    a.bg = buildSmithBackdrop();
    a.body = buildSmith();
  }
  const f = a.frame.copyFrom(a.bg);
  // fagulhas subindo da forja, que fica fora do quadro à direita
  const sparks = info.working ? 16 : 6;
  for (let k = 0; k < sparks; k++) {
    const life = (t * (0.35 + hash(k, 1, 5) * 0.3) + hash(k, 2, 5)) % 1;
    const x = 64 - life * (18 + hash(k, 3, 5) * 30) + Math.sin(t * 4 + k) * 1.5;
    const y = 64 - life * (30 + hash(k, 4, 5) * 30);
    f.set(x, y, PAL.fire[life < 0.3 ? 5 : life < 0.7 ? 4 : 3]);
  }
  f.blit(a.body, 0, 0);
  if (t % 5.1 > 4.95) for (const x of [26, 27, 28, 35, 36, 37]) f.set(x, 31, PAL.skin[2]);
  // brilho correndo pela cabeça do martelo
  const g = (t * 0.6) % 3;
  if (g < 1) {
    const s = -5 + g * 10;
    f.set(55 + 0.94 * s + 0.35 * 1.8, 36 + 0.35 * s - 0.94 * 1.8, PAL.steel[5]);
  }
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Forja

function buildForgeBackdrop() {
  const p = new Pix(64, 64);
  paintSky(p, 0, 40, PAL.dusk, 2.4);
  // muralha do castelo ao fundo, com ameias
  for (let x = 0; x < 64; x++) {
    const top = x % 8 < 5 ? 29 : 32;
    for (let y = top; y < 50; y++) {
      const row = Math.floor((y - 29) / 4), off = (row % 2) * 4;
      const mortar = (y - 29) % 4 === 3 || (x + off) % 8 === 0;
      const v = 0.34 - (y - 29) * 0.008 - (mortar ? 0.1 : 0) + (hash(Math.floor((x + off) / 8), row, 2) - 0.5) * 0.1 + (y === top ? 0.2 : 0);
      p.set(x, y, pick(PAL.cobble, v, x, y));
    }
  }
  // pátio calçado de pedras
  for (let y = 50; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const row = Math.floor((y - 50) / 3), off = (row % 2) * 2.5;
      const edge = (y - 50) % 3 === 2 || (x + off) % 5 < 1;
      const v = 0.35 + (y - 50) * 0.025 - (edge ? 0.2 : 0) + (hash(Math.floor((x + off) / 5), row, 4) - 0.5) * 0.15;
      p.set(x, y, pick(PAL.cobble, v, x, y));
    }
  }
  return p;
}

const archTest = (cx, rx, top, bottom) => (x, y) =>
  (Math.abs(x - cx) <= rx && y >= top + rx && y <= bottom) || (((x - cx) / rx) ** 2 + ((y - top - rx) / rx) ** 2 <= 1 && y <= bottom);

function buildForge() {
  const p = new Pix(64, 64);
  // chaminé de tijolos
  p.rect(37, 6, 9, 26, (x, y) => {
    const mortar = y % 3 === 2 || (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0;
    return pick(STONE_WARM, 0.45 - ((x + 0.5 - 41) / 4.5) * 0.2 - (mortar ? 0.15 : 0), x, y);
  });
  p.rect(36, 4, 11, 3, (x, y) => pick(STONE_WARM, y === 4 ? 0.7 : 0.35, x, y));
  // fornalha em cúpula
  const inKiln = (x, y) => (y >= 34 && y <= 59 && Math.abs(x - 32) <= 21) || (((x - 32) / 21) ** 2 + ((y - 34) / 13) ** 2 <= 1 && y < 34);
  p.fill(10, 20, 54, 59, inKiln, (x, y) => {
    const nx = (x + 0.5 - 32) / 21;
    const row = Math.floor((y - 20) / 4), off = (row % 2) * 3;
    const mortar = (y - 20) % 4 === 3 || (x + off) % 6 === 0;
    let v = 0.12 + cylLight(nx) * 0.75 + (y < 34 ? (34 - y) * 0.012 : 0) + (hash(Math.floor((x + off) / 6), row, 7) - 0.5) * 0.14;
    if (mortar) v -= 0.14;
    v += clamp01(1 - Math.hypot((x - 32) / 14, (y - 50) / 12)) * 0.3; // calor perto da boca
    return pick(STONE_WARM, v, x, y);
  });
  // boca em arco
  p.fill(20, 36, 44, 57, archTest(32, 10, 37, 57), (x, y) => pick(STONE_WARM, 0.9 - (y - 37) * 0.015, x, y));
  p.fill(22, 38, 42, 57, archTest(32, 8, 39, 57), MOUTH);
  // bigorna
  p.rect(7, 57, 8, 5, (x, y) => pick(PAL.steel, 0.35 - (x - 7) * 0.03, x, y));
  p.rect(9, 55, 4, 2, PAL.steel[1]);
  p.poly([[1, 51.5], [6, 50.5], [18, 50.5], [18, 55], [6, 55], [3, 53.5]], (x, y) => pick(PAL.steel, y < 52 ? 0.85 : 0.45 - (y - 52) * 0.08, x, y));
  // fole de couro
  p.poly([[49, 50], [60, 47], [60, 57], [49, 56]], (x, y) => pick(PAL.leather, 0.65 - (y - 47) * 0.04 - (x % 3 === 0 ? 0.15 : 0), x, y));
  p.rect(60, 46, 2, 12, (x) => PAL.wood[x === 60 ? 3 : 2]);
  p.line(48, 52, 45, 54, PAL.steel[2]);
  p.outline(PAL.out);
  return p;
}

const forgeArt = { bg: null, body: null, mouth: null, frame: new Pix(64, 64) };

function paintForgePortrait(ctx, t, info) {
  const a = forgeArt;
  if (!a.bg) {
    a.bg = buildForgeBackdrop();
    a.body = buildForge();
    a.mouth = [];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (a.body.get(x, y) === MOUTH) a.mouth.push([x, y]);
  }
  const f = a.frame.copyFrom(a.bg);
  // fumaça saindo da chaminé
  for (let k = 0; k < 6; k++) {
    const s = (t * 0.25 + k / 6) % 1;
    const sx = 41 + s * 10 + Math.sin(s * 6 + k) * 1.2, sy = 3 - s * 14, r = 1.2 + s * 3;
    for (let y = Math.floor(sy - r); y <= sy + r; y++) {
      for (let x = Math.floor(sx - r); x <= sx + r; x++) {
        const dd = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / r;
        if (dd <= 1 && bayer(x, y) < (1 - s) * 1.2 * (1.1 - dd * 0.5)) f.set(x, y, DUSK_SMOKE[dd < 0.5 ? 3 : 2]);
      }
    }
  }
  f.blit(a.body, 0, 0);
  paintFire(f, a.mouth, 0, 0, 39, 57, t * (info.working ? 1 : 0.5));
  // brasa iluminando o chão em frente
  const flick = 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 17) * 0.05;
  for (let y = 60; y < 64; y++) {
    for (let x = 16; x < 48; x++) {
      const d = Math.hypot((x - 32) / 16, (y - 59) / 5);
      if (d < 1 && bayer(x, y) < (1 - d) * 0.7 * flick) f.set(x, y, PAL.fire[d < 0.4 ? 3 : 2]);
    }
  }
  // fagulhas saindo da boca
  if (info.working) {
    for (let k = 0; k < 5; k++) {
      const life = (t * 0.8 + hash(k, 1, 8)) % 1;
      f.set(32 + (hash(k, 2, 8) - 0.5) * 14 * life + Math.sin(t * 5 + k), 44 - life * 20, PAL.fire[life < 0.5 ? 5 : 4]);
    }
  }
  f.draw(ctx);
}

// ---------------------------------------------------------------------------
// Arsenal (tier 3 bloqueado)

// ---------------------------------------------------------------------------
// Ícones

function iconSword() {
  const p = new Pix(16, 16);
  p.line(5, 10, 13, 2, PAL.steel[4]);
  p.line(6, 10, 13, 3, PAL.steel[2]);
  p.set(14, 1, PAL.steel[5]);
  p.line(3, 8, 7, 12, (x, y) => PAL.gold[x < 5 ? 4 : 2]);
  p.line(4, 11, 2, 13, PAL.leather[3]);
  p.rect(1, 13, 2, 2, (x, y) => PAL.gold[x === 1 && y === 13 ? 5 : 3]);
  p.outline(PAL.out);
  return p;
}

function iconSmith() {
  const p = new Pix(16, 16);
  const inHead = (x, y) => ((x - 8) / 5) ** 2 + ((y - 8) / 5.6) ** 2 <= 1;
  p.fill(2, 2, 14, 14, inHead, (x, y) => pick(PAL.skin, 0.1 + sphereLight(-(x + 0.5 - 8) / 5, (y + 0.5 - 8) / 5.6) * 1.05, x, y));
  p.fill(2, 4, 14, 7, (x, y) => inHead(x, y) && y > 4 && y < 6.6, (x, y) => PAL.band[y === 5 ? 3 : 2]);
  p.fill(1, 9, 15, 16, (x, y) => ((x - 8) / 5.4) ** 2 + ((y - 9.5) / 6) ** 2 <= 1 && y >= 10.5, (x, y) =>
    pick(PAL.beard, 0.65 - (y - 10) * 0.08 + ((x + y) % 3 === 0 ? -0.15 : 0), x, y));
  p.set(6, 8, PAL.iris);
  p.set(10, 8, PAL.iris);
  p.rect(5, 7, 2, 1, PAL.beard[1]);
  p.rect(10, 7, 2, 1, PAL.beard[1]);
  p.outline(PAL.out);
  return p;
}

function iconForge() {
  const p = new Pix(16, 16);
  p.rect(9, 1, 3, 6, (x) => STONE_WARM[x === 9 ? 4 : 2]);
  p.fill(1, 4, 15, 15, (x, y) => (y >= 8 && Math.abs(x - 8) <= 6.5) || (((x - 8) / 6.5) ** 2 + ((y - 8) / 4.5) ** 2 <= 1), (x, y) =>
    pick(STONE_WARM, 0.15 + cylLight((x + 0.5 - 8) / 6.5) * 0.8 - (y % 3 === 0 ? 0.12 : 0), x, y));
  p.fill(4, 8, 12, 15, archTest(8, 2.6, 9, 15), (x, y) => PAL.fire[y > 13 ? 5 : y > 11 ? 4 : 3]);
  p.outline(PAL.out);
  return p;
}

// ---------------------------------------------------------------------------
// Cena: pátio do castelo ao entardecer, com forjas acesas e ferreiros martelando.

const SH = SCENES.H;
const WALL_TOP = 60;
const GROUND = 86;
const hills = (x) => 54 + 3 * Math.sin(x * 0.02 + 1) + 2 * Math.sin(x * 0.07);

function buildMiniForge() {
  const p = new Pix(30, 28);
  p.rect(18, 1, 5, 12, (x, y) => pick(STONE_WARM, (x === 18 ? 0.6 : 0.35) - (y % 3 === 0 ? 0.1 : 0), x, y));
  const inKiln = (x, y) => (y >= 13 && y <= 26 && Math.abs(x - 15) <= 12) || (((x - 15) / 12) ** 2 + ((y - 13) / 7) ** 2 <= 1 && y < 13);
  p.fill(2, 5, 28, 26, inKiln, (x, y) => {
    const mortar = y % 3 === 2 || (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0;
    return pick(STONE_WARM, 0.15 + cylLight((x + 0.5 - 15) / 12) * 0.75 - (mortar ? 0.13 : 0), x, y);
  });
  p.fill(9, 14, 21, 26, archTest(15, 5, 15, 26), (x, y) => pick(STONE_WARM, 0.85, x, y));
  p.fill(10, 15, 20, 26, archTest(15, 4, 16, 26), MOUTH);
  p.outline(PAL.out);
  return p;
}

class CastleScene extends SCENES.BaseScene {
  constructor() {
    super();
    this.cloudRamp = PAL.duskCloud;
    this.smokeRamp = DUSK_SMOKE;
    this.birdColor = C('#1c1424');
    this.miniForge = buildMiniForge();
    this.forgeMouth = [];
    for (let y = 0; y < 28; y++) for (let x = 0; x < 30; x++) if (this.miniForge.get(x, y) === MOUTH) this.forgeMouth.push([x, y]);
    this.man = new Pix(32, 36);
  }

  layout() {
    const w = this.w;
    const near = (list, x, d) => list.some((v) => Math.abs(v - x) < d);
    this.towers = [];
    for (let x = 70; x < w + 20; x += 240) this.towers.push(x);
    this.forgeSpots = [];
    for (let x = 150; x < w - 24; x += 150) if (!near(this.towers, x, 34)) this.forgeSpots.push(x);
    this.torches = [];
    for (let x = 30; x < w; x += 96) if (!near(this.towers, x, 22) && !near(this.forgeSpots, x, 22)) this.torches.push(x);
    this.smithSpots = [];
    let i = 0;
    for (let x = 46; x < w - 20; x += 66, i++) {
      this.smithSpots.push({ x: x + Math.round((hash(i, 4) - 0.5) * 16), foot: 100 + (i % 3) * 5, dir: i % 2 ? -1 : 1, phase: hash(i, 5) });
    }
  }

  buildBackground() {
    const p = this.bg, w = this.w;
    paintSky(p, 0, 72, PAL.dusk, 3);
    paintSun(p, Math.round(w * 0.68), 50, 11);
    // morros roxos ao longe
    for (let x = 0; x < w; x++) {
      const top = Math.round(hills(x));
      for (let y = top; y < 72; y++) p.d[y * w + x] = pick(PURPLE_HILLS, (y === top ? 0.9 : 0.55) - (y - top) * 0.03, x, y, 2);
    }
    // muralha com ameias
    for (let x = 0; x < w; x++) {
      const top = x % 9 < 6 ? WALL_TOP - 5 : WALL_TOP;
      for (let y = top; y < GROUND; y++) {
        const row = Math.floor((y - 55) / 5), off = (row % 2) * 6;
        const mortar = (y - 55) % 5 === 4 || (x + off) % 12 === 0;
        let v = 0.44 + (hash(Math.floor((x + off) / 12), row, 3) - 0.5) * 0.14 - (mortar ? 0.14 : 0) - Math.max(0, y - 74) * 0.02;
        if (y === top) v += 0.25;
        p.d[y * w + x] = pick(PAL.cobble, v, x, y);
      }
    }
    for (let x = 22; x < w; x += 47) {
      if (this.towers.some((tx) => Math.abs(tx - x) < 18)) continue;
      p.rect(x, 64, 1, 6, PAL.cobble[0]);
    }
    // estandartes pendurados entre as torres
    for (const tx of this.towers) {
      const bx = tx + 120;
      if (bx > w - 8 || this.forgeSpots.some((f) => Math.abs(f - bx) < 20)) continue;
      this.paintBanner(p, bx, 62);
    }
    // torres redondas com telhado cônico
    for (const tx of this.towers) this.paintTower(p, tx);
    // pátio calçado: pedras maiores perto de quem olha
    let y = GROUND, row = 0;
    while (y < SH) {
      const h = Math.max(2, Math.round(2 + (y - GROUND) * 0.12));
      const cw = Math.round(h * 2.4);
      const off = (row % 2) * Math.round(cw / 2);
      for (let yy = y; yy < Math.min(SH, y + h); yy++) {
        for (let x = 0; x < w; x++) {
          const cx = Math.floor((x + off) / cw);
          const edge = yy === y + h - 1 || (x + off) % cw === 0;
          const depth = (yy - GROUND) / (SH - GROUND);
          const v = edge ? 0.12 : 0.36 + depth * 0.2 + (hash(cx, row, 5) - 0.5) * 0.18 + (yy === y ? 0.1 : 0);
          p.d[yy * w + x] = pick(PAL.cobble, v, x, yy);
        }
      }
      y += h;
      row++;
    }
    // sombra da muralha no chão
    for (let x = 0; x < w; x++) for (let yy = GROUND; yy < GROUND + 3; yy++) if (bayer(x, yy) < 0.6 - (yy - GROUND) * 0.2) p.d[yy * w + x] = PAL.cobble[0];
    // suportes de armas encostados na muralha
    for (let x = 40; x < w - 10; x += 175) {
      if (this.forgeSpots.some((f) => Math.abs(f - x) < 24) || this.towers.some((tx) => Math.abs(tx - x) < 22)) continue;
      this.paintRack(p, x, GROUND + 1);
    }
  }

  paintTower(p, tx) {
    const w = this.w;
    const top = 30, half = 13;
    for (let y = top; y < GROUND; y++) {
      for (let x = tx - half; x <= tx + half; x++) {
        if (x < 0 || x >= w) continue;
        const nx = (x + 0.5 - tx) / half;
        const row = Math.floor(y / 5), off = (row % 2) * 4;
        const mortar = y % 5 === 4 || (x + off) % 8 === 0;
        const v = 0.1 + cylLight(-nx) * 0.75 + (hash(Math.floor((x + off) / 8), row, 6) - 0.5) * 0.12 - (mortar ? 0.12 : 0);
        p.d[y * w + x] = pick(PAL.cobble, v, x, y);
      }
    }
    // telhado
    p.poly([[tx - 16, top + 1], [tx, 8], [tx + 16, top + 1]], (x, y) => {
      let v = 0.65 - ((x - tx) / 16) * 0.35;
      if (y % 3 === 0) v -= 0.18;
      return pick(PAL.roof, v, x, y);
    });
    p.rect(tx - 16, top, 33, 1, PAL.roof[0]);
    // janelas em arco
    for (const wy of [42, 60]) {
      p.rect(tx - 1, wy, 3, 5, C('#120c10'));
      p.set(tx, wy - 1, C('#120c10'));
    }
    p.set(tx, 61, PAL.glow);
    p.set(tx, 62, PAL.fire[3]);
  }

  paintBanner(p, x, y) {
    for (let j = 0; j < 16; j++) {
      for (let i = -4; i <= 4; i++) {
        if (j > 12 && Math.abs(i) < j - 12) continue; // ponta recortada em V
        const edge = Math.abs(i) === 4;
        p.set(x + i, y + j, PAL.banner[edge ? 1 : i < 0 ? 3 : 2]);
      }
    }
    for (const [i, j] of [[0, 4], [-1, 5], [0, 5], [1, 5], [0, 6], [-2, 6], [2, 6], [0, 7], [0, 8], [-1, 9], [1, 9]]) p.set(x + i, y + j, PAL.gold[4]);
    p.rect(x - 5, y - 1, 11, 1, PAL.wood[2]);
  }

  paintRack(p, x, foot) {
    p.rect(x - 7, foot - 12, 1, 12, PAL.wood[2]);
    p.rect(x + 7, foot - 12, 1, 12, PAL.wood[2]);
    p.rect(x - 7, foot - 9, 15, 1, PAL.wood[3]);
    for (let k = -5; k <= 5; k += 2) {
      const tall = k % 4 === 1;
      p.line(x + k, foot - 1, x + k + 1, foot - (tall ? 19 : 15), PAL.wood[1]);
      p.set(x + k + 1, foot - (tall ? 20 : 16), PAL.steel[4]);
      p.set(x + k + 1, foot - (tall ? 21 : 17), PAL.steel[5]);
    }
    // barril ao lado
    p.fill(x + 9, foot - 9, x + 17, foot, (xx) => true, (xx, yy) => {
      if (yy === foot - 7 || yy === foot - 3) return PAL.iron[1];
      return pick(PAL.wood, 0.25 + cylLight((xx + 0.5 - (x + 13)) / 4.5) * 0.6, xx, yy);
    });
  }

  paintFrame(p, t, info) {
    for (const tx of this.towers) this.paintFlag(p, tx, 1, t);
    this.paintBirds(p, t, 24);
    for (const x of this.torches) this.paintTorch(p, x, 70, t);

    const forges = Math.min(info.t2, this.forgeSpots.length);
    for (let i = 0; i < forges; i++) {
      const x = this.forgeSpots[i] - 15, y = GROUND + 2 - 28;
      p.blit(this.miniForge, x, y);
      paintFire(p, this.forgeMouth, x, y, 16, 26, t, i * 3);
      this.paintSmoke(p, t, x + 20, y + 1, i, 0.7);
    }

    const shown = Math.min(info.t1, this.smithSpots.length);
    const men = this.smithSpots.slice(0, shown).sort((a, b) => a.foot - b.foot);
    for (const m of men) this.paintSmith(p, m, t);
  }

  paintFlag(p, x, y, t) {
    p.line(x, y, x, y + 8, PAL.iron[2]);
    for (let i = 0; i < 10; i++) {
      const s = Math.sin(t * 5 - i * 0.7);
      const wave = Math.round(s * (i / 9) * 1.5);
      for (let j = 0; j < 5; j++) {
        p.set(x + 1 + i, y + j + wave, PAL.banner[j === 0 ? 3 : Math.max(0, Math.min(3, Math.round(1.6 + s * 1.2)))]);
      }
    }
  }

  paintTorch(p, x, y, t) {
    const flick = Math.sin(t * 13 + x) * 0.5 + Math.sin(t * 7.3 + x * 0.3) * 0.5;
    const R = 7 + flick;
    for (let yy = Math.floor(y - R); yy <= y + R; yy++) {
      for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - (y - 1)) / R;
        if (d < 1 && bayer(xx, yy) < (1 - d) * 0.35) p.set(xx, yy, PAL.fire[d < 0.5 ? 3 : 2]);
      }
    }
    p.rect(x, y + 1, 1, 4, PAL.wood[1]);
    p.rect(x - 1, y + 4, 3, 1, PAL.iron[1]);
    const h = 3 + Math.round(flick + hash(Math.floor(t * 10), x) * 1.2);
    for (let k = 0; k < h; k++) {
      const c = PAL.fire[k === 0 ? 5 : k < h - 1 ? 4 : 3];
      p.set(x + (k === h - 1 ? Math.round(Math.sin(t * 9 + x)) : 0), y - k, c);
      if (k < 2) {
        p.set(x - 1, y - k, PAL.fire[3]);
        p.set(x + 1, y - k, PAL.fire[3]);
      }
    }
  }

  // Ferreiro pequeno batendo na bigorna.
  paintSmith(p, spot, t) {
    const m = this.man.clear();
    const dir = spot.dir;
    const cx = 13, foot = 34;
    const X = (dx) => cx + dx * dir;
    // bigorna na frente dele
    const ax = X(9);
    m.rect(ax - 2, foot - 5, 5, 5, PAL.steel[1]);
    m.rect(ax - 1, foot - 6, 3, 1, PAL.steel[2]);
    m.rect(ax - 4, foot - 9, 9, 3, (x, y) => PAL.steel[y === foot - 9 ? 4 : 3]);
    m.set(ax + 5 * dir, foot - 8, PAL.steel[3]);
    // pernas, tronco, avental
    m.rect(cx - 3, foot - 8, 2, 8, TUNIC[1]);
    m.rect(cx + 1, foot - 8, 2, 8, TUNIC[2]);
    m.fill(cx - 4, foot - 19, cx + 4, foot - 8, (x, y) => Math.abs(x - cx) <= 4 - (y < foot - 18 ? 1 : 0), (x, y) => {
      const s = (x + 0.5 - cx) * dir;
      if (y > foot - 15) return PAL.leather[s > 0 ? 3 : 2];
      return Math.abs(s) > 2.5 ? PAL.skin[s > 0 ? 3 : 2] : TUNIC[s > 0 ? 3 : 2];
    });
    // cabeça careca, faixa e barba
    m.sphere(cx + 0.5, foot - 22, 3.1, 3.3, PAL.skin, 0.1);
    m.rect(cx - 2, foot - 24, 6, 1, PAL.band[2]);
    m.set(X(-3), foot - 23, PAL.band[1]);
    m.fill(cx - 3, foot - 21, cx + 4, foot - 17, (x, y) => Math.abs(x + 0.5 - cx - 0.5) <= 3 - (y - (foot - 21)) * 0.5, (x, y) => PAL.beard[(x + y) % 2 ? 2 : 3]);
    m.set(X(2), foot - 22, PAL.iris);

    // martelada: sobe devagar, desce rápido
    const ph = (t * 1.6 + spot.phase) % 1;
    const raise = ph < 0.72 ? ph / 0.72 : 1 - (ph - 0.72) / 0.08;
    const up = ph < 0.8 ? clamp01(raise) : 0;
    const ang = -0.25 - up * 1.9; // 0 = para frente, negativo = para cima
    const sx = X(3), sy = foot - 17;
    const hx = sx + Math.cos(ang) * 5 * dir, hy = sy + Math.sin(ang) * 5;
    m.line(sx, sy, hx, hy, PAL.skin[3]);
    const ex = hx + Math.cos(ang) * 5 * dir, ey = hy + Math.sin(ang) * 5;
    m.line(hx, hy, ex, ey, PAL.wood[3]);
    const qx = -Math.sin(ang) * dir, qy = Math.cos(ang);
    for (let k = -1; k <= 1; k++) for (let j = 0; j < 2; j++) m.set(ex + qx * k + Math.cos(ang) * dir * j, ey + qy * k + Math.sin(ang) * j, PAL.steel[k < 0 ? 4 : 3]);
    // peça em brasa sobre a bigorna
    m.rect(ax - 2, foot - 10, 4, 1, PAL.fire[4]);
    m.outline(PAL.out);
    p.blit(m, spot.x - cx, spot.foot - foot);

    // faíscas no impacto
    if (ph > 0.78 && ph < 0.98) {
      const age = (ph - 0.78) / 0.2;
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (hash(k, 1, Math.floor(t * 1.6 + spot.phase)) - 0.5) * 2.6;
        const r = age * (5 + hash(k, 2) * 7);
        p.set(spot.x - cx + ax + Math.cos(a) * r, spot.foot - foot + foot - 11 + Math.sin(a) * r + age * age * 4, PAL.fire[age < 0.5 ? 5 : 4]);
      }
    }
  }
}

ART.portraits.smith = paintSmithPortrait;
ART.portraits.forge = paintForgePortrait;
ART.locked.smith = ART.silhouette(buildSmith);
ART.locked.forge = ART.silhouette(buildForge);
Object.assign(ART.icons, { sword: iconSword, smith: iconSmith, forge: iconForge });
SCENES.register('castle', CastleScene);
})();
